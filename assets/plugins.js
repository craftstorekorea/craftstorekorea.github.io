/* ===== 전국공방 · SBPress 플러그인 엔진 (assets/plugins.js) =====
   브라우저 JS 플러그인이 사이트(헤더 메뉴·카드·위젯)와 관리자(탭)에 훅을 거는
   작은 엔진입니다. 플러그인은 자기 파일에서 아래처럼 등록합니다.

     SBPress.registerPlugin({
       id: "reading-time", name: "읽기 시간 배지", version: "1.0.0",
       description: "카드에 예상 읽기 시간을 붙입니다.",
       setup: function (ctx) {
         ctx.decorateCard(function (card, post, meta) { ... });
         ctx.addWidget("home-top", function (box, ctx) { ... });
         ctx.addMenuItem({ id: "x", label_ko: "메뉴", label_en: "Menu", href: "#/news" });
         ctx.addAdminTab({ id: "x", label: "데이터 내보내기", render: function (box, ctx) { ... } });
         ctx.addCss(".x{color:red}");
       }
     });

   - 켜진 플러그인은 Supabase public.plugins(enabled=true) 에서 읽어 옵니다.
   - **관리자 화면 격리(v1.3)**: /admin(admin.html)에서는 source='custom'(직접 올린 외부 JS)을
     불러오지 않습니다. 관리자 세션을 외부 스크립트가 만질 수 없게 하기 위해서입니다.
     건너뛴 내역은 SBPress.status().notices / .skipped 에 남고, builtin·market 은 그대로 실행됩니다.
   - 플러그인 스크립트 주소는 https:// 또는 사이트 안 경로(/)만 됩니다(DB CHECK + CSP).
   - 플러그인 하나가 실패해도(스크립트 404·setup 예외·훅 예외) 사이트와 다른
     플러그인은 그대로 동작합니다. 실패 내역은 SBPress.status() 로 볼 수 있습니다.
   의존: assets/auth-config.js (window.CRAFT_SUPABASE) — 없으면 조용히 아무 것도 하지 않습니다.
   주의: service_role 키나 비밀 값은 이 파일에 절대 넣지 않습니다. 공개(publishable) 키만 사용. */
(function () {
  "use strict";
  if (window.SBPress && window.SBPress.__engine) return;

  var CFG = window.CRAFT_SUPABASE || {};
  var ZONES = ["home-top", "home-bottom", "board-top", "footer-top"];
  var DONE = "data-sbp-done";

  var state = {
    defs: {},                 // id → 정의
    order: [],                // 등록 순서
    menu: [],                 // {plugin, id, label_ko, label_en, href, adminOnly}
    widgets: {},              // zone → [{plugin, fn}]
    tabs: [],                 // {plugin, id, label, render}
    cardFns: [],              // [{plugin, fn}]
    css: {},                  // plugin → [cssText]
    rows: {},                 // id → DB 행(설정)
    errors: [],               // {plugin, message, when}
    notices: [],              // {plugin, message, when} — 실행하지 않고 건너뛴 이유(관리자 화면의 custom 등)
    skipped: {},              // id → 이유 (이번 화면에서 실행하지 않은 플러그인)
    adminPage: false,         // /admin 화면인가
    loading: false,
    loadedOnce: false,
    admin: null,              // null=모름, true/false
    adminChecked: false
  };

  function recordError(plugin, message) {
    var msg = String(message && message.message ? message.message : message || "알 수 없는 오류");
    state.errors.push({ plugin: plugin || "engine", message: msg, when: new Date().toISOString() });
    try { console.warn("[SBPress] " + (plugin || "engine") + ": " + msg); } catch (e) { /* noop */ }
  }

  function recordNotice(plugin, message) {
    var msg = String(message || "");
    state.notices.push({ plugin: plugin || "engine", message: msg, when: new Date().toISOString() });
    try { console.info("[SBPress] " + (plugin || "engine") + " — " + msg); } catch (e) { /* noop */ }
  }

  /* 관리자 화면(/admin · admin.html)인지 확인합니다. body.admin-body 도 함께 봅니다. */
  function isAdminPage() {
    var p = String((location && location.pathname) || "").replace(/\/+$/, "");
    if (/\/admin(\.html)?$/i.test(p) || /\/admin\/index\.html$/i.test(p)) return true;
    return !!(document.body && document.body.classList && document.body.classList.contains("admin-body"));
  }

  function absUrl(url, base) {
    try { return new URL(String(url), base || location.href).href; } catch (e) { return String(url || ""); }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 플러그인 등록 ---------------- */
  function registerPlugin(def) {
    if (!def || typeof def !== "object") { recordError("engine", "registerPlugin 에 정의 객체가 없습니다."); return false; }
    var id = String(def.id || "").trim();
    if (!id) { recordError("engine", "플러그인 id 가 없습니다."); return false; }
    if (state.defs[id]) return true;                     // 같은 플러그인이 두 번 불러와도 한 번만 실행
    if (typeof def.setup !== "function") { recordError(id, "setup(ctx) 함수가 없습니다."); return false; }

    state.defs[id] = def;
    state.order.push(id);

    var ctx = makeContext(id);
    try {
      def.setup(ctx);
    } catch (e) {
      recordError(id, "setup 실행 중 오류: " + (e && e.message ? e.message : e));
    }
    /* 새 플러그인의 훅을 이미 그려진 화면에도 반영합니다. */
    scheduleAll();
    return true;
  }

  function makeContext(id) {
    var row = state.rows[id] || null;
    var ctx = {
      id: id,
      plugin: row,
      settings: (row && row.settings && typeof row.settings === "object") ? row.settings : {},
      esc: esc,
      el: function (tag, cls, html) {
        var n = document.createElement(tag || "div");
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
      },
      addMenuItem: function (item) {
        if (!item || typeof item !== "object") return;
        var key = String(item.id || item.href || "").trim();
        if (!key) return;
        for (var i = 0; i < state.menu.length; i++) {
          if (state.menu[i].plugin === id && state.menu[i].key === key) return;
        }
        state.menu.push({
          plugin: id, key: key,
          label_ko: String(item.label_ko || item.label || "").trim(),
          label_en: String(item.label_en || item.label_ko || item.label || "").trim(),
          href: String(item.href || "#/home").trim() || "#/home",
          adminOnly: !!item.adminOnly
        });
        renderMenu();
      },
      decorateCard: function (fn) {
        if (typeof fn !== "function") return;
        state.cardFns.push({ plugin: id, fn: fn });
        resetCards();
        applyCards();
        observeCards();
      },
      addWidget: function (zone, fn) {
        if (typeof fn !== "function") return;
        var z = String(zone || "").trim();
        if (!z) return;
        if (!state.widgets[z]) state.widgets[z] = [];
        state.widgets[z].push({ plugin: id, fn: fn });
        if (z === "floating") ensureFloatingLayer();
        paintZones();
      },
      addAdminTab: function (tab) {
        if (!tab || !tab.render) return;
        var tid = String(tab.id || "").trim();
        if (!tid) return;
        for (var i = 0; i < state.tabs.length; i++) if (state.tabs[i].plugin === id && state.tabs[i].id === tid) return;
        state.tabs.push({ plugin: id, id: tid, label: String(tab.label || tid), render: tab.render });
        mountAdminTabs();
      },
      addCss: function (text) {
        var css = String(text || "").replace(/<\/?style/gi, "");   // </style> 로 페이지를 깨뜨리지 못하게
        if (!css.trim()) return;
        (state.css[id] = state.css[id] || []).push(css);
        injectCss(id);
      }
    };
    return ctx;
  }

  function injectCss(id) {
    if (document.getElementById("sbp-css-" + id)) return;
    var st = document.createElement("style");
    st.id = "sbp-css-" + id;
    st.setAttribute("data-sbp", id);
    st.textContent = (state.css[id] || []).join("\n");
    document.head.appendChild(st);
  }

  function scheduleAll() {
    if (scheduleAll.t) clearTimeout(scheduleAll.t);
    scheduleAll.t = setTimeout(function () {
      try { renderMenu(); } catch (e) { recordError("engine", e); }
      try { paintZones(); } catch (e) { recordError("engine", e); }
      try { mountAdminTabs(); } catch (e) { recordError("engine", e); }
      try { resetCards(); applyCards(); observeCards(); } catch (e) { recordError("engine", e); }
    }, 30);
  }

  /* ---------------- 헤더 메뉴 ---------------- */
  function menuVisible(it) {
    if (!it.adminOnly) return true;
    return state.admin === true;
  }

  function renderMenu() {
    var tabs = document.getElementById("tabs");
    if (!tabs) return;
    [].forEach.call(tabs.querySelectorAll("[data-sbp-item]"), function (n) { n.parentNode.removeChild(n); });
    var en = !!(window.CRAFT_I18N && window.CRAFT_I18N.isEn && window.CRAFT_I18N.isEn());
    state.menu.forEach(function (it) {
      if (!menuVisible(it)) return;
      var label = en ? (it.label_en || it.label_ko) : (it.label_ko || it.label_en);
      if (!label) return;
      var a = document.createElement("a");
      a.className = "tab tab-sbp";
      a.href = it.href;
      a.setAttribute("data-sbp-item", it.plugin + ":" + it.key);
      a.setAttribute("data-sbp-plugin", it.plugin);
      var ext = /^(https?:)?\/\//i.test(it.href) || /^mailto:/i.test(it.href);
      if (ext) { a.target = "_blank"; a.rel = "noopener"; }
      a.innerHTML = esc(label) + (ext ? ' <svg width="11" height="11" aria-hidden="true"><use href="#i-ext"/></svg>' : "");
      tabs.appendChild(a);
    });
    /* 관리자 전용 메뉴는 로그인했을 때만 확인합니다(한 번). */
    if (!state.adminChecked && window.CRAFT_AUTH && window.CRAFT_AUTH.isSignedIn && window.CRAFT_AUTH.isSignedIn()) {
      checkAdmin();
    }
  }

  function checkAdmin() {
    if (state.adminChecked || !CFG.url) return;
    state.adminChecked = true;
    var tok = null;
    try { tok = window.CRAFT_AUTH && window.CRAFT_AUTH.token ? window.CRAFT_AUTH.token() : null; } catch (e) { tok = null; }
    fetch(CFG.url + "/rest/v1/rpc/is_admin", {
      method: "POST",
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + (tok || CFG.anonKey), "Content-Type": "application/json" },
      body: "{}"
    }).then(function (r) { return r.ok ? r.json() : false; })
      .then(function (v) { state.admin = v === true; renderMenu(); })
      .catch(function () { state.admin = false; });
  }

  /* ---------------- 위젯 존 ---------------- */
  function zoneBox(zone) {
    if (zone === "floating") return ensureFloatingLayer();
    var box = document.querySelector('[data-sbp-zone="' + zone + '"]');
    if (!box && (ZONES.indexOf(zone) < 0)) {
      box = document.createElement("div");
      box.className = "sbp-zone";
      box.setAttribute("data-sbp-zone", zone);
      (document.getElementById("main") || document.body).appendChild(box);
    }
    return box;
  }

  function ensureFloatingLayer() {
    var layer = document.getElementById("sbp-floating");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "sbp-floating";
      layer.className = "sbp-floating";
      document.body.appendChild(layer);
    }
    return layer;
  }

  function paintZones() {
    Object.keys(state.widgets).forEach(function (zone) {
      var box = zoneBox(zone);
      if (!box) return;
      [].forEach.call(box.querySelectorAll("[data-sbp-widget]"), function (n) { n.parentNode.removeChild(n); });
      state.widgets[zone].forEach(function (w) {
        var holder = document.createElement("div");
        holder.className = "sbp-widget";
        holder.setAttribute("data-sbp-widget", w.plugin);
        box.appendChild(holder);
        try {
          w.fn(holder, makeContext(w.plugin));
        } catch (e) {
          recordError(w.plugin, "위젯(" + zone + ") 실행 중 오류: " + (e && e.message ? e.message : e));
          holder.parentNode && holder.parentNode.removeChild(holder);
        }
      });
      var has = box.querySelector("[data-sbp-widget]");
      box.classList.toggle("has-widget", !!has);
      if (zone !== "floating" && !has) box.hidden = true;
      if (has && zone !== "floating") box.hidden = false;
    });
  }

  /* ---------------- 카드 꾸미기 ---------------- */
  var CARD_SEL = "[data-sbp-card]";

  function postOf(card) {
    var head = card.querySelector("h3, h4, h2, blockquote");
    var text = (card.textContent || "").replace(/\s+/g, " ").trim();
    var derived = {
      title: head ? head.textContent.trim() : "",
      text: text,
      chars: text.replace(/\s/g, "").length,
      type: card.getAttribute("data-sbp-type") || (card.classList.contains("bcard") ? "workshop" : "post")
    };
    if (card.__sbpPost && typeof card.__sbpPost === "object") {
      /* 데이터의 원래 필드(title·summary·region…)와 화면에서 읽은 글자 수를 함께 넘깁니다. */
      var out = {};
      for (var k in card.__sbpPost) out[k] = card.__sbpPost[k];
      if (!out.title) out.title = derived.title;
      out.text = derived.text;
      out.chars = derived.chars;
      if (!out.type) out.type = derived.type;
      return out;
    }
    return derived;
  }

  function metaOf(card) {
    var view = card.closest ? card.closest(".view") : null;
    return {
      type: card.getAttribute("data-sbp-type") || (card.classList.contains("bcard") ? "workshop" : "post"),
      view: view ? view.id.replace(/^view-/, "") : "",
      className: card.className
    };
  }

  function applyCards(root) {
    var list = (root || document).querySelectorAll(CARD_SEL);
    if (!list.length) return;
    for (var i = 0; i < list.length; i++) {
      var card = list[i];
      if (card.getAttribute(DONE) === "1") continue;
      card.setAttribute(DONE, "1");
      var post = postOf(card), meta = metaOf(card);
      for (var j = 0; j < state.cardFns.length; j++) {
        try {
          state.cardFns[j].fn(card, post, meta);
        } catch (e) {
          recordError(state.cardFns[j].plugin, "카드 꾸미기 오류: " + (e && e.message ? e.message : e));
        }
      }
    }
  }

  function resetCards() {
    [].forEach.call(document.querySelectorAll(CARD_SEL), function (n) { n.removeAttribute(DONE); });
  }

  var observer = null;
  function observeCards() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function () {
      if (observeCards.t) clearTimeout(observeCards.t);
      observeCards.t = setTimeout(function () {
        try { applyCards(); } catch (e) { recordError("engine", e); }
      }, 40);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------------- 관리자 탭 ---------------- */
  function mountAdminTabs() {
    var nav = document.getElementById("admin-tabs");
    if (!nav) return;
    var dash = document.getElementById("state-dash");
    if (!dash) return;
    state.tabs.forEach(function (t) {
      var key = "sbp-" + t.id;
      var btn = nav.querySelector('[data-tab="' + key + '"]');
      if (!btn) {
        btn = document.createElement("button");
        btn.className = "admin-tab admin-tab-sbp";
        btn.type = "button";
        btn.setAttribute("role", "tab");
        btn.setAttribute("data-tab", key);
        btn.setAttribute("data-sbp-admin-tab", t.plugin);
        btn.setAttribute("aria-selected", "false");
        btn.textContent = t.label;
        nav.appendChild(btn);
      }
      var panel = document.getElementById("tab-" + key);
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "tabpanel tabpanel-sbp";
        panel.id = "tab-" + key;
        panel.setAttribute("role", "tabpanel");
        panel.hidden = true;
        panel.setAttribute("data-sbp-admin-panel", t.plugin);
        dash.appendChild(panel);
      }
    });
    if (!nav.getAttribute("data-sbp-bound")) {
      nav.setAttribute("data-sbp-bound", "1");
      nav.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("[data-sbp-admin-tab]") : null;
        if (!btn) return;
        activateAdminTab(btn.getAttribute("data-tab").replace(/^sbp-/, ""));
      });
      window.addEventListener("hashchange", openFromHash);
    }
    /* /admin#sbp-export 처럼 들어오면 그 플러그인 탭을 바로 엽니다. */
    setTimeout(openFromHash, 500);
  }

  function openFromHash() {
    var m = /^#sbp-([A-Za-z0-9_-]+)$/.exec(location.hash || "");
    if (m) activateAdminTab(m[1]);
  }

  function activateAdminTab(id) {
    var nav = document.getElementById("admin-tabs");
    if (!nav) return;
    var key = "sbp-" + id;
    [].forEach.call(nav.querySelectorAll(".admin-tab"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === key ? "true" : "false");
    });
    [].forEach.call(document.querySelectorAll("#state-dash .tabpanel"), function (p) {
      p.hidden = p.id !== "tab-" + key;
    });
    var tab = null;
    for (var i = 0; i < state.tabs.length; i++) if (state.tabs[i].id === id) tab = state.tabs[i];
    var panel = document.getElementById("tab-" + key);
    if (tab && panel) {
      try {
        panel.innerHTML = "";
        tab.render(panel, makeContext(tab.plugin));
      } catch (e) {
        recordError(tab.plugin, "관리자 탭 그리기 오류: " + (e && e.message ? e.message : e));
        panel.innerHTML = '<p class="panel-msg">이 탭을 그리지 못했습니다: ' + esc(e && e.message ? e.message : e) + "</p>";
      }
    }
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { /* noop */ }
  }

  /* ---------------- 불러오기 ---------------- */
  function enabledRows() {
    if (!CFG.url || !CFG.anonKey) return Promise.resolve([]);
    return fetch(CFG.url + "/rest/v1/plugins?select=id,name,version,script_url,source,settings&enabled=eq.true&order=installed_at.asc", {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (r) {
      if (!r.ok) throw new Error("플러그인 목록 HTTP " + r.status);
      return r.json();
    }).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  function loadOne(row) {
    return new Promise(function (resolve) {
      if (state.defs[row.id]) { resolve(); return; }       // 이미 불러온 플러그인은 다시 실행하지 않습니다
      /* 보안(v1.3): 직접 올린 외부 JS(source='custom')는 관리자 화면에서 실행하지 않습니다.
         관리자 세션(토큰·관리 권한)을 외부 스크립트가 만질 수 없게 하는 격리입니다.
         기본(builtin)·마켓(market) 플러그인은 그대로 동작합니다. */
      if (state.adminPage && row.source === "custom") {
        state.skipped[row.id] = "admin-custom";
        recordNotice(row.id, "관리자 화면에서는 직접 올린 외부 플러그인을 실행하지 않습니다(보안). 사이트에서는 그대로 동작합니다.");
        resolve();
        return;
      }
      var src = absUrl(row.script_url, location.origin + "/");
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute("data-sbp-script", row.id);
      var settled = false;
      function done(ok, err) {
        if (settled) return;
        settled = true;
        if (!ok) recordError(row.id, err || ("스크립트를 불러오지 못했습니다: " + src));
        else if (!state.defs[row.id]) recordError(row.id, "스크립트가 SBPress.registerPlugin 을 호출하지 않았습니다.");
        resolve();
      }
      s.onload = function () { done(true); };
      s.onerror = function () { done(false, "스크립트를 불러오지 못했습니다(404·차단·CORS): " + src); };
      document.head.appendChild(s);
      setTimeout(function () { done(true); }, 9000);   // 응답이 없는 CDN 에서도 사이트가 멈추지 않게
    });
  }

  function load(force) {
    if (state.loading) return Promise.resolve();
    if (state.loadedOnce && !force) return Promise.resolve();
    state.loading = true;
    state.loadedOnce = false;
    state.skipped = {};
    return enabledRows().then(function (rows) {
      rows.forEach(function (r) { state.rows[r.id] = r; });
      state.rows._order = rows;
      var i = 0;
      function step() {
        if (i >= rows.length) { state.loading = false; state.loadedOnce = true; return; }
        var row = rows[i++];
        loadOne(row).then(step, step);
      }
      step();
    }).catch(function (e) {
      state.loading = false;
      recordError("engine", "플러그인 목록을 읽지 못했습니다: " + (e && e.message ? e.message : e));
    });
  }

  function status() {
    var out = [];
    ((state.rows._order) || []).forEach(function (r) {
      var ok = !!state.defs[r.id];
      out.push({
        id: r.id, name: r.name, source: r.source, loaded: ok,
        skipped: state.skipped[r.id] || null,
        errors: state.errors.filter(function (e) { return e.plugin === r.id; })
      });
    });
    return {
      plugins: out,
      errors: state.errors.slice(),
      notices: state.notices.slice(),
      adminPage: state.adminPage,
      admin: state.admin
    };
  }

  /* ---------------- 공개 API ---------------- */
  var SBPress = {
    __engine: true,
    version: "1.3.0",
    registerPlugin: registerPlugin,
    register: registerPlugin,
    renderMenu: renderMenu,
    applyCards: function () { resetCards(); applyCards(); },
    paintZones: paintZones,
    mountAdminTabs: mountAdminTabs,
    activateAdminTab: activateAdminTab,
    openFromHash: openFromHash,
    load: load,
    status: status,
    isAdmin: function () { return state.admin; },
    isAdminPage: function () { return state.adminPage; },
    notices: function () { return state.notices.slice(); },
    plugins: function () { return state.order.slice(); },
    zones: function () { return ZONES.slice(); }
  };
  window.SBPress = SBPress;

  function boot() {
    state.adminPage = isAdminPage();
    try { observeCards(); } catch (e) { /* noop */ }
    mountAdminTabs();
    renderMenu();
    paintZones();
    applyCards();
    load();
    /* 늦게 그려지는 카드(라우팅·언어 전환)도 MutationObserver 가 잡지만,
       화면 전환 직후 한 번 더 훑어 줍니다. */
    window.addEventListener("hashchange", function () { setTimeout(function () { applyCards(); paintZones(); }, 120); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
