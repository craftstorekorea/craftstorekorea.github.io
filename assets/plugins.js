/* ===== SBPress 플러그인 엔진 (assets/plugins.js) — API 문서: README.md
   플러그인: SBPress.registerPlugin({id, name, version, setup(ctx)})
   훅: decorateCard · addWidget · addMenuItem · addAdminTab · addCss
   설정: ctx.getSettings() · ctx.onSettingsChange(fn)  (v10.2)
   목록: public.plugins_public 뷰(예전 DB 는 public.plugins) · 의존: auth-config.js */
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
    settingsFns: {},          // id → [fn] — 설정이 바뀌면 부를 함수(v10.2)
    errors: [],               // {plugin, message, when}
    notices: [],              // {plugin, message, when} — 실행하지 않고 건너뛴 이유(관리자 화면의 custom 등)
    skipped: {},              // id → 이유 (이번 화면에서 실행하지 않은 플러그인)
    adminPage: false,         // /admin 화면인가
    loading: false,
    loadedOnce: false,
    admin: null,              // null=모름, true/false
    adminChecked: false,
    failed: {},               // id → 이유 (오류로 격리된 플러그인 — 자동 비활성)
    manifests: {}             // id → manifest v1
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

  /* /admin 화면인지 확인합니다(body.admin-body 포함). */
  function isAdminPage() {
    var p = String((location && location.pathname) || "").replace(/\/+$/, "");
    if (/\/admin(\.html)?$/i.test(p) || /\/admin\/index\.html$/i.test(p)) return true;
    return !!(document.body && document.body.classList && document.body.classList.contains("admin-body"));
  }

  function absUrl(url, base) {
    try { return new URL(String(url), base || location.href).href; } catch (e) { return String(url || ""); }
  }

  /* v5.1 보안 — 주소는 https:// 또는 / 만, 코드에 eval·new Function·document.write·http://·<script> 금지. */
  var UNSAFE = [
    { re: /(^|[^\w$.])eval\s*\(/, why: "eval()" },
    { re: /new\s+Function\s*\(/, why: "new Function()" },
    { re: /document\.write\s*\(/, why: "document.write()" },
    { re: /(^|[^\w:])http:\/\//i, why: "http:// 주소" },
    { re: /<script[\s>]/i, why: "<script> 삽입" }
  ];

  function safeScriptUrl(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    if (/^https:\/\//i.test(s)) return s;
    if (s.charAt(0) === "/" && s.charAt(1) !== "/") return s;      // 사이트 안 경로
    return "";
  }

  function scanSource(text) {
    var s = String(text || "");
    var reasons = [];
    for (var i = 0; i < UNSAFE.length; i++) {
      if (UNSAFE[i].re.test(s)) reasons.push(UNSAFE[i].why);
    }
    return { ok: reasons.length === 0, reasons: reasons };
  }

  /* 못 받으면(CORS) 검사 없이 통과 — CSP·격리가 막아 줍니다. */
  function scanRemote(url) {
    return new Promise(function (resolve) {
      var done = false, timer = null;
      function settle(v) { if (done) return; done = true; if (timer) clearTimeout(timer); resolve(v); }
      try {
        timer = setTimeout(function () { settle({ ok: true, unchecked: true }); }, 4000);
        fetch(url, { cache: "no-store", credentials: "omit" }).then(function (r) {
          if (!r.ok) { settle({ ok: true, unchecked: true }); return null; }
          return r.text();
        }).then(function (t) {
          if (t == null) return;
          if (t.length > 600000) { settle({ ok: true, unchecked: true }); return; }
          settle(scanSource(t));
        }).catch(function () { settle({ ok: true, unchecked: true }); });
      } catch (e) { settle({ ok: true, unchecked: true }); }
    });
  }

  /* manifest v1 — 없으면 정의에서 채웁니다. */
  var HOOKS = ["menu", "card", "widget", "admin-tab", "css", "settings"];
  function manifestOf(def) {
    var m = (def && def.manifest && typeof def.manifest === "object") ? def.manifest : {};
    var v = parseInt(m.v != null ? m.v : 1, 10);
    if (!isFinite(v) || v < 1) v = 1;
    var hooks = Array.isArray(m.hooks) ? m.hooks : (Array.isArray(def.hooks) ? def.hooks : []);
    hooks = hooks.map(function (h) { return String(h || "").trim().slice(0, 40); })
      .filter(function (h) { return h && HOOKS.indexOf(h) >= 0; }).slice(0, 12);
    var perms = Array.isArray(m.permissions) ? m.permissions : (Array.isArray(def.permissions) ? def.permissions : []);
    perms = perms.map(function (x) { return String(x || "").trim().slice(0, 40); })
      .filter(Boolean).slice(0, 12);
    return {
      v: v,
      name: String(m.name || def.name || def.id || "").slice(0, 80),
      version: String(m.version || def.version || "1.0.0").slice(0, 24),
      author: String(m.author || def.author || "").slice(0, 80),
      hooks: hooks,
      permissions: perms
    };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* 오류 플러그인의 흔적을 걺어냅니다. */
  function purgePlugin(id) {
    state.menu = state.menu.filter(function (x) { return x.plugin !== id; });
    Object.keys(state.widgets).forEach(function (z) {
      state.widgets[z] = state.widgets[z].filter(function (w) { return w.plugin !== id; });
    });
    state.tabs.filter(function (t) { return t.plugin === id; }).forEach(function (t) {
      var btn = document.querySelector('[data-sbp-admin-tab="' + id + '"][data-tab="sbp-' + t.id + '"]');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
      var panel = document.getElementById("tab-sbp-" + t.id);
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    });
    state.tabs = state.tabs.filter(function (t) { return t.plugin !== id; });
    state.cardFns = state.cardFns.filter(function (c) { return c.plugin !== id; });
    delete state.css[id];
    var st = document.getElementById("sbp-css-" + id);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    try { renderMenu(); paintZones(); } catch (e) { /* noop */ }
  }

  function fail(id, message) {
    state.failed[id] = String(message || "오류");
    recordError(id, message);
    purgePlugin(id);
  }

  /* ---------------- 플러그인 등록 ---------------- */
  function registerPlugin(def) {
    if (!def || typeof def !== "object") { recordError("engine", "registerPlugin 에 정의 객체가 없습니다."); return false; }
    var id = String(def.id || "").trim().slice(0, 60);
    if (!id) { recordError("engine", "플러그인 id 가 없습니다."); return false; }
    if (state.defs[id] || state.failed[id]) return true;   // 두 번 불러와도 한 번만(실패한 것은 다시 등록하지 않음)
    if (typeof def.setup !== "function") { recordError(id, "setup(ctx) 함수가 없습니다."); return false; }
    var man = manifestOf(def);
    if (man.v > 1) { fail(id, "manifest v" + man.v + " 은 이 엔진이 읽을 수 없습니다(지원: v1)."); return false; }

    state.defs[id] = def;
    state.order.push(id);
    state.manifests[id] = man;

    var ctx = makeContext(id);
    try {
      def.setup(ctx);
    } catch (e) {
      fail(id, "setup 실행 중 오류: " + (e && e.message ? e.message : e));
      delete state.defs[id];
      state.order = state.order.filter(function (x) { return x !== id; });
      return false;
    }
    /* 새 훅을 이미 그려진 화면에도 반영합니다. */
    scheduleAll();
    return true;
  }

  /* ---------------- 설정(v10.2) ---------------- */
  function schemaOf(id) {
    var row = state.rows[id] || {}, sch = row.settings_schema;
    if (Array.isArray(sch) && sch.length) return sch;
    var def = state.defs[id] || {};
    return Array.isArray(def.settings_schema) ? def.settings_schema : (Array.isArray(sch) ? sch : []);
  }

  /* 기본값 + DB 저장값 — 형식·범위는 서버가 검사합니다. */
  function mergedSettings(id) {
    var out = {}, def = state.defs[id] || {}, d = def.settings || {}, sch = schemaOf(id);
    var saved = (state.rows[id] && state.rows[id].settings) || {}, i, k, v;
    for (k in d) if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k];
    for (i = 0; i < sch.length; i++) {
      if (sch[i] && sch[i].key && out[sch[i].key] === undefined && sch[i].default !== undefined) {
        out[sch[i].key] = sch[i].default;
      }
    }
    for (k in saved) {
      v = saved[k];
      if (typeof v === "number" && !isFinite(v)) continue;
      if (typeof v === "string") v = v.slice(0, 2000);
      if (v !== null && v !== undefined) out[k] = v;
    }
    return out;
  }

  function emitSettings(id, snap) {
    (state.settingsFns[id] || []).forEach(function (fn) {
      try { fn(snap); } catch (e) { recordError(id, "설정 적용 오류: " + (e && e.message ? e.message : e)); }
    });
  }

  function makeContext(id) {
    var row = state.rows[id] || null;
    var ctx = {
      id: id,
      plugin: row,
      settings: mergedSettings(id),
      getSettings: function () { return mergedSettings(id); },
      onSettingsChange: function (fn) {
        if (typeof fn !== "function") return;
        var list = state.settingsFns[id] = state.settingsFns[id] || [];
        for (var i = 0; i < list.length; i++) if (list[i] === fn) return;   // 같은 함수는 한 번만
        list.push(fn);
      },
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
      /* 원래 필드 + 화면에서 읽은 글자 수를 함께 넘깁니다. */
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
  function fetchRows(table, select) {
    return fetch(CFG.url + "/rest/v1/" + table + "?select=" + select + "&enabled=eq.true&order=installed_at.asc", {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (r) {
      if (!r.ok) throw new Error("플러그인 목록 HTTP " + r.status);
      return r.json();
    }).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  /* v10.2 — 뷰(plugins_public)를 먼저, 없는 예전 DB 는 표를 읽습니다. */
  function enabledRows() {
    if (!CFG.url || !CFG.anonKey) return Promise.resolve([]);
    return fetchRows("plugins_public", "id,name,version,script_url,source,settings,settings_schema")
      .then(function (rows) { return rows; })
      .catch(function () {
        recordNotice("engine", "plugins_public 뷰가 없어 public.plugins 를 읽습니다(23_v102_plugin_settings.sql 미실행).");
        return fetchRows("plugins", "id,name,version,script_url,source,settings");
      });
  }

  function loadOne(row) {
    return new Promise(function (resolve) {
      if (state.defs[row.id]) { resolve(); return; }       // 이미 불러온 플러그인은 다시 실행하지 않습니다
      if (state.failed[row.id]) { resolve(); return; }
      /* v1.3: custom 외부 JS 는 관리자 화면에서 실행하지 않습니다. */
      if (state.adminPage && row.source === "custom") {
        state.skipped[row.id] = "admin-custom";
        recordNotice(row.id, "관리자 화면에서는 직접 올린 외부 플러그인을 실행하지 않습니다(보안). 사이트에서는 그대로 동작합니다.");
        resolve();
        return;
      }
      var safe = safeScriptUrl(row.script_url);
      if (!safe) {
        state.skipped[row.id] = "insecure-url";
        fail(row.id, "스크립트 주소가 https:// 또는 사이트 안 경로(/)가 아니어서 실행하지 않았습니다: " + String(row.script_url || ""));
        resolve();
        return;
      }
      var src = absUrl(safe, location.origin + "/");
      scanRemote(src).then(function (scan) {
        if (scan && scan.ok === false) {
          state.skipped[row.id] = "unsafe-code";
          fail(row.id, "위험한 코드가 들어 있어 실행하지 않았습니다: " + (scan.reasons || []).join(", "));
          resolve();
          return;
        }
        injectScript(row, src, resolve);
      });
    });
  }

  function injectScript(row, src, resolve) {
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute("data-sbp-script", row.id);
    var settled = false;
    function done(ok, err) {
      if (settled) return;
      settled = true;
      if (!ok) {
        state.skipped[row.id] = "load-failed";
        fail(row.id, err || ("스크립트를 불러오지 못했습니다: " + src));
      } else if (!state.defs[row.id] && !state.failed[row.id]) {
        fail(row.id, "스크립트가 SBPress.registerPlugin 을 호출하지 않았습니다.");
      }
      resolve();
    }
    s.onload = function () { done(true); };
    s.onerror = function () { done(false, "스크립트를 불러오지 못했습니다(404·차단·CORS): " + src); };
    document.head.appendChild(s);
    setTimeout(function () { done(true); }, 9000);   // 응답이 없는 CDN 에서도 사이트가 멈추지 않게
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
      /* 이미 실행 중인 플러그인은 새 설정으로 다시 그립니다. */
      rows.forEach(function (r) {
        if (state.defs[r.id]) { try { emitSettings(r.id, mergedSettings(r.id)); } catch (e) { recordError(r.id, e); } }
      });
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
        version: (state.manifests[r.id] && state.manifests[r.id].version) || r.version || "",
        manifest: state.manifests[r.id] || null,
        settings: mergedSettings(r.id),
        disabled: state.failed[r.id] || null,
        skipped: state.skipped[r.id] || null,
        errors: state.errors.filter(function (e) { return e.plugin === r.id; })
      });
    });
    return {
      plugins: out,
      errors: state.errors.slice(),
      notices: state.notices.slice(),
      disabled: Object.keys(state.failed).map(function (id) { return { id: id, reason: state.failed[id] }; }),
      adminPage: state.adminPage,
      admin: state.admin
    };
  }

  /* ---------------- 공개 API ---------------- */
  var SBPress = {
    __engine: true,
    version: "10.2.0",          // SBPress 엔진(사이트) 버전 — v10.2 부터 같은 번호를 씁니다.
    api: 2,                     // 플러그인이 기대는 엔진 API 판
    settingsApi: 1,             // getSettings · onSettingsChange · applySettings 가 있는 판
    getSettings: function (id) { return mergedSettings(String(id || "")); },
    applySettings: function (id, settings, opts) {
      var pid = String(id || "");
      if (!pid) return {};
      if (!state.rows[pid]) state.rows[pid] = { id: pid };
      state.rows[pid].settings = (settings && typeof settings === "object") ? settings : {};
      var snap = mergedSettings(pid);
      emitSettings(pid, snap);
      /* 카드·위젯은 엔진이, 탭은 플러그인이 다시 그립니다. */
      try { resetCards(); applyCards(); } catch (e) { recordError(pid, e); }
      try { paintZones(); } catch (e) { recordError(pid, e); }
      if (!(opts && opts.silent)) {
        /* 다른 탭(관리자 미리보기)에도 알립니다. */
        try {
          localStorage.setItem("sbpress-plugin-settings", JSON.stringify({ id: pid, settings: snap, at: Date.now() }));
        } catch (e) { /* 저장소 차단 — 이 화면에만 적용 */ }
      }
      return snap;
    },
    registerPlugin: registerPlugin,
    register: registerPlugin,
    safeScriptUrl: safeScriptUrl,
    scanSource: scanSource,
    scanRemote: scanRemote,
    manifestOf: manifestOf,
    hooks: function () { return HOOKS.slice(); },
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
    if (window.SBP && window.SBP.feature && !window.SBP.feature("plugins")) return;
    state.adminPage = isAdminPage();
    try { observeCards(); } catch (e) { /* noop */ }
    mountAdminTabs();
    renderMenu();
    paintZones();
    applyCards();
    load();
    /* 늦게 그려지는 카드도 훑습니다. */
    window.addEventListener("hashchange", function () { setTimeout(function () { applyCards(); paintZones(); }, 120); });
    /* 설정 저장을 다른 탭에도 알립니다(v10.2). */
    window.addEventListener("storage", function (e) {
      if (!e || e.key !== "sbpress-plugin-settings" || !e.newValue) return;
      try {
        var msg = JSON.parse(e.newValue);
        if (msg && msg.id && msg.settings && state.defs[msg.id]) {
          SBPress.applySettings(msg.id, msg.settings, { silent: true });
        }
      } catch (err) { /* 남이 넣은 값 — 무시 */ }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
