/* ===== SBPress 플러그인 엔진 (assets/plugins.js) — API 문서: README.md
   플러그인: SBPress.registerPlugin({id, name, version, setup(ctx)})
   훅: decorateCard · addWidget · addMenuItem · addAdminTab · addCss · addBlock (v10.4)
   설정: ctx.getSettings() · ctx.onSettingsChange(fn)  (v10.2)
   버전: 관리자 화면의 원클릭 업데이트 · 이전 버전 롤백 (v10.3, supabase/24_v103)
   블록: ctx.addBlock({id, name_ko, fields, defaultData, render}) → hunmin 블록 (v10.4)
   마켓: 관리자의 구독 마켓 여러 곳을 합쳐 보여 줍니다 (v10.4, supabase/25_v104)
   무결성: 행의 integrity(sha256-…)로 받은 파일 바이트를 다시 해시해 비교하고, 다르면 실행을 막습니다 (v10.5)
   샌드박스: 매니페스트에 선언·동의된 권한 밖의 훅 호출을 막고 state.notices 에 남깁니다 (v10.5, supabase/26_v105)
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
    blocks: {},               // type → hunmin 커스텀 블록 정의 (v10.4)
    blockOrder: [],           // type 등록 순서 (v10.4)
    errors: [],               // {plugin, message, when}
    notices: [],              // {plugin, message, when} — 실행하지 않고 건너뛴 이유(관리자 화면의 custom 등)
    skipped: {},              // id → 이유 (이번 화면에서 실행하지 않은 플러그인)
    adminPage: false,         // /admin 화면인가
    loading: false,
    loadedOnce: false,
    admin: null,              // null=모름, true/false
    adminChecked: false,
    failed: {},               // id → 이유 (오류로 격리된 플러그인 — 자동 비활성)
    manifests: {},            // id → manifest v1
    /* v10.5 — SRI 무결성 · 권한 동의 · 샌드박스 */
    integrity: {},            // id → {state:'ok'|'bad'|'none'|'unchecked', expected, computed, checkedAt, reason}
    grants: {},               // id → [권한] (관리자가 동의한 granted_permissions)
    consentAt: {},            // id → 동의 시각
    modes: {},                // id → 'strict' | 'standard'
    blockedHooks: {},         // id → [{hook, permission, when, why}] — 권한 밖이라 건너뛴 훅
    security: { checked: 0, bad: 0, blocked: 0 }
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

  /* ---------------- v10.5 — SRI 무결성 (SHA-256) ----------------
     integrity 는 SRI 형식(sha256-<base64>)이며, 공백으로 여러 값을 적을 수 있습니다.
     받은 파일 바이트를 crypto.subtle.digest('SHA-256') 으로 다시 해시해 하나라도 맞으면 통과입니다. */
  var SRI_ONE = /^sha256-[A-Za-z0-9+/=]{43,44}$/;

  function sriOk(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return false;
    var parts = s.split(/\s+/);
    for (var i = 0; i < parts.length; i++) if (SRI_ONE.test(parts[i])) return true;
    return false;
  }

  function sriTokens(v) {
    return String(v == null ? "" : v).split(/\s+/).filter(function (x) { return SRI_ONE.test(x); }).slice(0, 4);
  }

  function bytesToBase64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return btoa(s); } catch (e) { return ""; }
  }

  function bytesToText(buf) {
    try {
      if (window.TextDecoder) return new TextDecoder("utf-8").decode(buf);
    } catch (e) { /* 아래로 */ }
    var view = new Uint8Array(buf), out = "";
    for (var i = 0; i < view.length; i += 8192) {
      out += String.fromCharCode.apply(null, view.subarray(i, i + 8192));
    }
    return out;
  }

  /* 바이트 → sha256-<base64>. crypto.subtle 이 없는 환경(구형·비보안 출처)이면 null. */
  function sha256Base64(buf) {
    var subtle = (window.crypto && window.crypto.subtle) || null;
    if (!subtle || typeof subtle.digest !== "function") return Promise.resolve(null);
    try {
      return subtle.digest("SHA-256", buf).then(function (d) {
        var b = bytesToBase64(new Uint8Array(d));
        return b ? ("sha256-" + b) : null;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function integrityStateText(id) {
    var x = state.integrity[id];
    if (!x) return "";
    return x.state || "";
  }

  /* 파일을 한 번 받아 바이트 해시(SRI)와 위험 코드 검사를 함께 합니다.
     받지 못하면(CORS·404) 검사 없이 통과시키되 unchecked 로 남깁니다 — CSP·격리가 2차 방어입니다. */
  function loadCheck(url, integrity) {
    var expected = String(integrity == null ? "" : integrity).trim();
    return new Promise(function (resolve) {
      var done = false, timer = null;
      function settle(v) { if (done) return; done = true; if (timer) clearTimeout(timer); resolve(v); }
      try {
        timer = setTimeout(function () { settle({ ok: true, unchecked: true, checked: false }); }, 6000);
        fetch(url, { cache: "no-store", credentials: "omit" }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.arrayBuffer();
        }).then(function (buf) {
          var scan = scanSource(bytesToText(buf));
          if (!expected || !sriOk(expected)) {
            settle({ ok: scan.ok, reasons: scan.reasons, checked: false, unchecked: true });
            return null;
          }
          return sha256Base64(buf).then(function (computed) {
            if (!computed) {
              settle({ ok: scan.ok, reasons: scan.reasons, checked: false, unchecked: true,
                       reason: "subtle-unavailable" });
              return;
            }
            var want = sriTokens(expected);
            var good = want.indexOf(computed) >= 0;
            settle({ ok: scan.ok && good, reasons: scan.reasons, checked: true, computed: computed,
                     expected: expected, mismatch: !good });
          });
        }).catch(function () {
          settle({ ok: true, unchecked: true, checked: false, reason: "unreachable" });
        });
      } catch (e) { settle({ ok: true, unchecked: true, checked: false, reason: "error" }); }
    });
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

  /* ---------------- v10.5 — 권한 기반 샌드박스 (ctx 가드) ----------------
     훅마다 필요한 권한의 앞자리를 정해 두고, 매니페스트가 그 권한을 선언했는지 봅니다.
     · 매니페스트가 권한을 하나도 선언하지 않은 예전 설치본은 그대로 동작합니다(호환).
     · 관리자가 동의한 목록(granted_permissions)이 있으면 그 안에 있는지도 봅니다.
     · sandbox_mode='standard' 는 막지 않고 알림만 남깁니다. 기본은 'strict'(막음). */
  var HOOK_NEED = {
    card: ["read:"],
    widget: ["ui:"],
    menu: ["nav:"],
    "admin-tab": ["read:admin", "ui:admin"],
    css: ["css:"],
    block: ["ui:block", "ui:"]
  };

  function permMatches(list, needs) {
    for (var i = 0; i < list.length; i++) {
      var p = String(list[i] || "");
      for (var j = 0; j < needs.length; j++) {
        if (p === needs[j] || p.indexOf(needs[j]) === 0) return p;
      }
    }
    return "";
  }

  function hookAllowed(id, hook) {
    var man = state.manifests[id];
    var declared = (man && Array.isArray(man.permissions)) ? man.permissions : [];
    if (!declared.length) return true;                     // 선언 없는 예전 설치본 — 호환
    var needs = HOOK_NEED[hook];
    if (!needs) return true;
    /* v10.5 이전에 설치한 행(동의 기록 없음)은 선언만 봅니다 — 사이트가 갑자기 바뀌지 않게. */
    var granted = state.grants[id];
    var consented = !!state.consentAt[id] || !!(granted && granted.length);
    if (!consented) {
      if (state.modes[id] === "standard") {
        recordNotice(id, "권한 동의 기록이 없어 ‘" + hook + "’ 훅을 선언만 보고 실행했습니다.");
      }
      return true;
    }
    var hit = permMatches(declared, needs);
    if (!hit) {
      blockHook(id, hook, needs.join(" 또는 "), "선언되지 않은 권한");
      return false;
    }
    if (granted && granted.length && state.modes[id] !== "standard") {
      if (!permMatches(granted, needs)) {
        blockHook(id, hook, hit, "동의하지 않은 권한");
        return false;
      }
    }
    return true;
  }

  function blockHook(id, hook, permission, why) {
    var rec = { hook: hook, permission: permission, why: why, when: new Date().toISOString() };
    (state.blockedHooks[id] = state.blockedHooks[id] || []).push(rec);
    state.security.blocked += 1;
    recordNotice(id, "권한 밖의 ‘" + hook + "’ 훅을 건너뛰었습니다 — " + why + "(" + permission +
      "). 관리자 > 플러그인 · 마켓에서 요청 권한을 확인하세요.");
  }

  /* manifest v1 — 없으면 정의에서 채웁니다. */
  var HOOKS = ["menu", "card", "widget", "admin-tab", "css", "settings", "block"];
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
    /* v10.4 — 오류로 격리된 플러그인의 커스텀 블록도 목록에서 뺍니다(페이지에는 폴백). */
    Object.keys(state.blocks).forEach(function (t) {
      if (state.blocks[t].plugin === id) delete state.blocks[t];
    });
    state.blockOrder = state.blockOrder.filter(function (t) { return !!state.blocks[t]; });
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
        if (!hookAllowed(id, "menu")) return;
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
        if (!hookAllowed(id, "card")) return;
        if (typeof fn !== "function") return;
        state.cardFns.push({ plugin: id, fn: fn });
        resetCards();
        applyCards();
        observeCards();
      },
      addWidget: function (zone, fn) {
        if (!hookAllowed(id, "widget")) return;
        if (typeof fn !== "function") return;
        var z = String(zone || "").trim();
        if (!z) return;
        if (!state.widgets[z]) state.widgets[z] = [];
        state.widgets[z].push({ plugin: id, fn: fn });
        if (z === "floating") ensureFloatingLayer();
        paintZones();
      },
      addAdminTab: function (tab) {
        if (!hookAllowed(id, "admin-tab")) return;
        if (!tab || !tab.render) return;
        var tid = String(tab.id || "").trim();
        if (!tid) return;
        for (var i = 0; i < state.tabs.length; i++) if (state.tabs[i].plugin === id && state.tabs[i].id === tid) return;
        state.tabs.push({ plugin: id, id: tid, label: String(tab.label || tid), render: tab.render });
        mountAdminTabs();
      },
      addCss: function (text) {
        if (!hookAllowed(id, "css")) return;
        var css = String(text || "").replace(/<\/?style/gi, "");   // </style> 로 페이지를 깨뜨리지 못하게
        if (!css.trim()) return;
        (state.css[id] = state.css[id] || []).push(css);
        injectCss(id);
      },
      /* v10.4 — hunmin 커스텀 블록을 등록합니다. (v10.5 — 권한 밖이면 등록하지 않습니다) */
      addBlock: function (def) {
        if (!hookAllowed(id, "block")) return "";
        return addBlock(id, def);
      },
      /* 이 플러그인의 블록 종류 키(페이지에 저장되는 type)를 돌려줍니다. */
      blockType: function (blockId) { return "sbp:" + id + ":" + String(blockId || ""); }
    };
    return ctx;
  }

  /* ---------------- v10.4 커스텀 hunmin 블록 ---------------- */
  var BLOCK_FIELD_TYPES = ["text", "textarea", "number", "boolean", "select", "color"];

  function blockField(x) {
    if (!x || typeof x !== "object") return null;
    var key = String(x.key || "").trim().slice(0, 30);
    if (!/^[a-z][a-z0-9_]*$/.test(key)) return null;
    var t = String(x.type || "text").toLowerCase();
    if (BLOCK_FIELD_TYPES.indexOf(t) < 0) t = "text";
    var opts = (Array.isArray(x.options) ? x.options : []).map(function (o) {
      if (!o || typeof o !== "object" || o.value == null) return null;
      return {
        value: String(o.value).slice(0, 40),
        label_ko: String(o.label_ko || o.label || o.value).slice(0, 80),
        label_en: String(o.label_en || o.label || o.value).slice(0, 80)
      };
    }).filter(Boolean).slice(0, 20);
    var def = x.default;
    if (t === "number") def = Number(def) || 0;
    else if (t === "boolean") def = def === true;
    else if (t === "select") {
      var ok = opts.some(function (o) { return o.value === String(def); });
      def = ok ? String(def) : (opts[0] ? opts[0].value : "");
    } else def = String(def == null ? "" : def).slice(0, 2000);
    return {
      key: key, type: t,
      label_ko: String(x.label_ko || x.label || key).slice(0, 80),
      label_en: String(x.label_en || x.label || x.label_ko || key).slice(0, 80),
      help_ko: String(x.help_ko || "").slice(0, 200),
      help_en: String(x.help_en || "").slice(0, 200),
      placeholder_ko: String(x.placeholder_ko || "").slice(0, 80),
      placeholder_en: String(x.placeholder_en || "").slice(0, 80),
      default: def,
      min: typeof x.min === "number" && isFinite(x.min) ? x.min : null,
      max: typeof x.max === "number" && isFinite(x.max) ? x.max : null,
      step: typeof x.step === "number" && x.step > 0 ? x.step : null,
      maxlength: typeof x.maxlength === "number" ? Math.max(1, Math.min(2000, x.maxlength)) : 2000,
      options: opts
    };
  }

  function addBlock(pluginId, def) {
    if (!def || typeof def !== "object") { recordError(pluginId, "addBlock 에 정의 객체가 없습니다."); return ""; }
    var bid = String(def.id || "").trim().slice(0, 40);
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(bid)) {
      recordError(pluginId, "블록 id 는 영문 소문자·숫자·-·_ 로 1~40자여야 합니다: " + bid);
      return "";
    }
    if (typeof def.render !== "function") { recordError(pluginId, "블록 ‘" + bid + "’ 에 render(data, ctx) 함수가 없습니다."); return ""; }
    var type = "sbp:" + pluginId + ":" + bid;
    if (state.blocks[type]) return type;                     // 같은 블록을 두 번 등록해도 한 번만
    var fields = (Array.isArray(def.fields) ? def.fields : []).map(blockField).filter(Boolean).slice(0, 16);
    /* 기본값은 스키마에 있는 칸만, 칸마다 형식에 맞게 다듬습니다. */
    var src = (def.defaultData && typeof def.defaultData === "object") ? def.defaultData : {};
    var data = {};
    fields.forEach(function (f) {
      if (f.type === "number") {
        var n = Number(src[f.key]);
        data[f.key] = isFinite(n) ? n : f.default;
      } else if (f.type === "boolean") {
        data[f.key] = src[f.key] === undefined ? f.default : src[f.key] === true;
      } else {
        var v = src[f.key] === undefined ? f.default : src[f.key];
        if (f.type === "select") {
          var ok = f.options.some(function (o) { return o.value === String(v); });
          data[f.key] = ok ? String(v) : f.default;
        } else data[f.key] = String(v == null ? "" : v).slice(0, 2000);
      }
    });
    state.blocks[type] = {
      type: type,
      id: bid,
      plugin: pluginId,
      name_ko: String(def.name_ko || def.name || bid).slice(0, 80),
      name_en: String(def.name_en || def.name || def.name_ko || bid).slice(0, 80),
      category: String(def.category || "content").slice(0, 30),
      fields: fields,
      defaultData: data,
      render: def.render
    };
    state.blockOrder.push(type);
    announceBlocks();
    return type;
  }

  function blockList() {
    return state.blockOrder.map(function (t) { return state.blocks[t]; }).filter(Boolean);
  }

  function announceBlocks() {
    try {
      document.dispatchEvent(new CustomEvent("sbpress:blocks", {
        detail: { blocks: blockList().map(function (b) { return { type: b.type, plugin: b.plugin, id: b.id }; }) }
      }));
    } catch (e) { /* 구형 브라우저 — 다음 그리기에서 반영됩니다 */ }
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
  function fetchRows(table, select, filter) {
    var qs = "?select=" + select;
    if (filter !== "") qs += (filter || "&enabled=eq.true");
    qs += "&order=installed_at.asc";
    return fetch(CFG.url + "/rest/v1/" + table + qs, {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (r) {
      if (!r.ok) throw new Error("플러그인 목록 HTTP " + r.status);
      return r.json();
    }).then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  /* v10.2 — 뷰(plugins_public)를 먼저, 없는 예전 DB 는 표를 읽습니다.
     v10.5 — 칸 이름을 나열하지 않고 *(있는 칸만) 로 받습니다. 26_v105 를 실행하지 않은 DB 에서도
     400 응답 없이 그대로 동작하고, 무결성·동의 칸이 있을 때만 검사합니다.
     뷰는 이미 켜진 플러그인만 보이므로 enabled 조건은 표에만 붙입니다. */
  function enabledRows() {
    if (!CFG.url || !CFG.anonKey) return Promise.resolve([]);
    return fetchRows("plugins_public", "*", "").then(function (rows) {
      var any = rows.some(function (r) { return r && ("sandbox_mode" in r || "integrity" in r); });
      if (rows.length && !any) {
        recordNotice("engine", "무결성·권한 동의 칸이 없어 코드 검사만 합니다(26_v105_plugin_security.sql 미실행).");
      }
      return rows;
    }).catch(function () {
      recordNotice("engine", "plugins_public 뷰가 없어 public.plugins 를 읽습니다(23_v102_plugin_settings.sql 미실행).");
      return fetchRows("plugins", "*");
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
      var expected = String(row.integrity == null ? "" : row.integrity).trim();
      loadCheck(src, expected).then(function (scan) {
        if (scan && scan.checked) {
          state.security.checked += 1;
          state.integrity[row.id] = {
            state: scan.mismatch ? "bad" : (scan.ok ? "ok" : "bad"),
            expected: scan.expected || expected, computed: scan.computed || "",
            checkedAt: new Date().toISOString(), reason: scan.mismatch ? "mismatch" : ""
          };
        } else {
          state.integrity[row.id] = { state: "unchecked", expected: expected, computed: "",
            checkedAt: new Date().toISOString(), reason: (scan && scan.reason) || "" };
          if (expected) {
            recordNotice(row.id, "무결성 값을 확인할 수 없어(파일을 읽지 못함·브라우저 제한) 코드 검사만 했습니다.");
          }
        }
        if (scan && scan.checked && scan.mismatch) {
          state.security.bad += 1;
          state.skipped[row.id] = "integrity";
          fail(row.id, "무결성 검사에 실패해 실행하지 않았습니다 — 파일이 바뀌었을 수 있습니다: " + src);
          paintSecurityAlert();
          resolve();
          return;
        }
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
      rows.forEach(function (r) {
        state.rows[r.id] = r;
        /* v10.5 — 동의한 권한·샌드박스 모드를 적어 둡니다. */
        state.grants[r.id] = Array.isArray(r.granted_permissions) ? r.granted_permissions.slice(0, 12) : [];
        state.consentAt[r.id] = r.consent_at || null;
        state.modes[r.id] = (String(r.sandbox_mode || "") === "standard") ? "standard" : "strict";
      });
      state.rows._order = rows;
      /* 이미 실행 중인 플러그인은 새 설정으로 다시 그립니다. */
      rows.forEach(function (r) {
        if (state.defs[r.id]) { try { emitSettings(r.id, mergedSettings(r.id)); } catch (e) { recordError(r.id, e); } }
      });
      var i = 0;
      function step() {
        if (i >= rows.length) {
          state.loading = false;
          state.loadedOnce = true;
          try { paintSecurityAlert(); } catch (e) { /* noop */ }
          return;
        }
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
        integrity: state.integrity[r.id] || null,
        granted_permissions: (state.grants[r.id] || []).slice(),
        consent_at: state.consentAt[r.id] || null,
        sandbox_mode: state.modes[r.id] || "strict",
        blocked_hooks: (state.blockedHooks[r.id] || []).slice(),
        errors: state.errors.filter(function (e) { return e.plugin === r.id; })
      });
    });
    return {
      plugins: out,
      errors: state.errors.slice(),
      notices: state.notices.slice(),
      disabled: Object.keys(state.failed).map(function (id) { return { id: id, reason: state.failed[id] }; }),
      adminPage: state.adminPage,
      admin: state.admin,
      security: {
        checked: state.security.checked,
        bad: state.security.bad,
        blocked: state.security.blocked,
        integrity: JSON.parse(JSON.stringify(state.integrity)),
        blockedHooks: JSON.parse(JSON.stringify(state.blockedHooks))
      },
      blocks: blockList().map(function (b) {
        return { type: b.type, id: b.id, plugin: b.plugin, name: b.name_ko, fields: b.fields.length };
      })
    };
  }

  /* ---------------- v10.5 — 관리자 경고 표시 ----------------
     무결성 실패나 권한 밖 훅 호출이 있으면 /admin 대시보드 맨 위에 한 줄 배너를 그립니다.
     관리자 화면이 아니거나 그릴 자리가 없으면 아무 것도 하지 않습니다(공개 사이트 = 조용). */
  function paintSecurityAlert() {
    if (!state.adminPage) return;
    var dash = document.getElementById("state-dash");
    if (!dash) return;
    var bad = [], hooks = [];
    Object.keys(state.integrity).forEach(function (id) {
      if (state.integrity[id] && state.integrity[id].state === "bad") bad.push(id);
    });
    Object.keys(state.blockedHooks).forEach(function (id) {
      (state.blockedHooks[id] || []).forEach(function (b) { hooks.push(id + " · " + b.hook); });
    });
    var box = document.getElementById("sbp-integrity-alert");
    if (!bad.length && !hooks.length) {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "sbp-integrity-alert";
      box.className = "sbp-security-alert";
      box.setAttribute("role", "alert");
      box.setAttribute("data-sbp-security", "1");
      var first = dash.querySelector(".tabpanel") || dash.firstChild;
      if (first && first.parentNode) first.parentNode.insertBefore(box, first);
      else dash.appendChild(box);
    }
    var html = "";
    if (bad.length) {
      html += '<p class="sbp-security-line"><b>무결성 오류로 막은 플러그인 ' + bad.length + '개</b> ' +
        '<span class="muted">' + esc(bad.join(", ")) + "</span> " +
        "<span>파일이 바뀌었을 수 있어 실행하지 않았습니다. 관리자 &gt; 플러그인 · 마켓에서 무결성 다시 검사로 확인하세요.</span></p>";
    }
    if (hooks.length) {
      html += '<p class="sbp-security-line"><b>권한 밖에서 부른 훅 ' + hooks.length + '건</b> ' +
        '<span class="muted">' + esc(hooks.slice(0, 6).join(", ")) + (hooks.length > 6 ? " …" : "") + "</span> " +
        "<span>그 기능만 건너뛰었습니다(페이지는 그대로).</span></p>";
    }
    box.innerHTML = html;
  }

  /* ---------------- 공개 API ---------------- */
  var SBPress = {
    __engine: true,
    version: "10.6.0",          // SBPress 엔진(사이트) 버전 — v10.2 부터 같은 번호를 씁니다.
    api: 2,                     // 플러그인이 기대는 엔진 API 판
    settingsApi: 1,             // getSettings · onSettingsChange · applySettings 가 있는 판
    versionsApi: 1,             // v10.3 — 원클릭 업데이트 · 버전 비교 · 롤백이 있는 판
    blocksApi: 1,               // v10.4 — addBlock · getBlocks · getBlock 이 있는 판
    securityApi: 1,             // v10.5 — SRI 무결성 · 권한 동의 · 샌드박스가 있는 판
    getBlocks: function () { return blockList().slice(); },
    getBlock: function (type) { return state.blocks[String(type || "")] || null; },
    hasBlock: function (type) { return !!state.blocks[String(type || "")]; },
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
    /* v10.5 — SRI 무결성 · 권한 기반 샌드박스 */
    sha256Base64: sha256Base64,
    sriOk: sriOk,
    verifyIntegrity: function (url, integrity) {
      var src = absUrl(safeScriptUrl(url) || url, location.origin + "/");
      return loadCheck(src, integrity).then(function (v) {
        return {
          ok: (v && v.checked) ? (!!v.ok && !v.mismatch) : true,
          checked: !!(v && v.checked),
          mismatch: !!(v && v.mismatch),
          computed: (v && v.computed) || "",
          expected: (v && v.expected) || String(integrity || ""),
          reason: (v && v.reason) || ""
        };
      });
    },
    /* 설치된 플러그인 하나를 다시 검사합니다. 결과는 status() 와 관리자 경고에 반영됩니다. */
    recheckIntegrity: function (id, cb) {
      var pid = String(id || "");
      var row = state.rows[pid];
      if (!row) {
        if (cb) cb("플러그인을 찾지 못했습니다: " + pid, null);
        return Promise.resolve(null);
      }
      var src = absUrl(safeScriptUrl(row.script_url) || "", location.origin + "/");
      return loadCheck(src, row.integrity).then(function (v) {
        var rec = {
          state: (v && v.checked) ? (v.mismatch ? "bad" : (v.ok ? "ok" : "bad")) : "unchecked",
          expected: String(row.integrity || ""), computed: (v && v.computed) || "",
          checkedAt: new Date().toISOString(), reason: (v && v.reason) || ""
        };
        state.integrity[pid] = rec;
        if (rec.state === "bad" && !state.failed[pid]) state.security.bad += 1;
        paintSecurityAlert();
        if (cb) cb(null, rec);
        return rec;
      });
    },
    integrityState: function (id) { return state.integrity[String(id || "")] || null; },
    securityState: function () { return status().security; },
    hookAllowed: hookAllowed,
    hookPermission: function (hook) { return (HOOK_NEED[String(hook || "")] || []).slice(); },
    paintSecurityAlert: paintSecurityAlert,
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
    try { paintSecurityAlert(); } catch (e) { /* noop */ }
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
