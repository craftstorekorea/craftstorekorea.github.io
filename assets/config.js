/* ===== SBPress · 사이트 설정 로더 (assets/config.js) =====
   사이트마다 다른 값(사이트 이름·주소, Supabase, GA4, 기능 스위치, 구글 시트)을
   **sbpress.config.json 한 파일**에서 읽어 window.SBPRESS_CONFIG 로 내줍니다.
   - 이 파일은 다른 스크립트보다 먼저, 동기(synchronous)로 설정을 읽습니다.
     (app/auth/admin 이 시작되기 전에 값이 준비되어야 하기 때문입니다.)
   - 설정 파일이 없거나 읽지 못하면 아래 GENERIC 기본값으로 조용히 동작합니다.
   - 템플릿을 새 사이트로 복사할 때는 sbpress.config.json 만 바꾸면 됩니다.

   window.SBP 도우미:
     SBP.config            설정 객체
     SBP.feature("map")    기능 켜짐 여부 (기본 true)
     SBP.brandName()       사이트 이름
     SBP.tagline()         작은 글씨(부제)
     SBP.siteUrl()         사이트 주소(끝 / 없이)
     SBP.configured()      Supabase 주소·키가 실제 값인지
     SBP.sheetId()         등록 게시판 시트 ID (없으면 "")
     SBP.isPlaceholder(v)  예시값(YOUR_… 등)인지
*/
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var GENERIC = {
    siteName: "SBPress",
    siteTitle: "SBPress — 새 사이트",
    tagline: "",
    description: "",
    siteUrl: "",
    supabase: { url: "", anonKey: "" },
    ga4Id: "",
    providers: ["email"],
    defaultTheme: "magazine",
    defaultLang: "ko",
    features: { map: true, tasks: true, approvals: true, mypage: true, plugins: true, comments: true, sheets: true },
    sheets: null,
    ownerEmail: "",
    naverAuthUrl: ""
  };

  function basePath() {
    var src = SCRIPT && SCRIPT.src ? String(SCRIPT.src) : "";
    if (!src) return "./";
    return src.replace(/assets\/config\.js(?:\?.*)?$/, "");
  }

  function isPlaceholder(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return true;
    if (/^(your|yours|xxx|changeme|todo)\b/i.test(s)) return true;
    return /YOUR_|example\.com|changeme|^<.*>$|^__.*__$/i.test(s);
  }

  function readConfig() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", basePath() + "sbpress.config.json?_=" + Date.now(), false);
      xhr.send(null);
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        var data = JSON.parse(xhr.responseText);
        return data && typeof data === "object" ? data : null;
      }
    } catch (e) { /* 파일이 없거나 오프라인 — 기본값으로 동작 */ }
    return null;
  }

  function merge(base, over) {
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (var j in over) {
      if (!Object.prototype.hasOwnProperty.call(over, j)) continue;
      var v = over[j];
      if (v && typeof v === "object" && !Array.isArray(v) && base[j] && typeof base[j] === "object" && !Array.isArray(base[j])) {
        out[j] = merge(base[j], v);
      } else if (v !== undefined) {
        out[j] = v;
      }
    }
    return out;
  }

  var raw = readConfig() || (window.SBPRESS_CONFIG_DEFAULT || {});
  var cfg = merge(GENERIC, raw);
  cfg.siteUrl = String(cfg.siteUrl || "").replace(/\/+$/, "");
  cfg.supabase = cfg.supabase || {};
  if (isPlaceholder(cfg.supabase.url)) cfg.supabase.url = "";
  if (isPlaceholder(cfg.supabase.anonKey)) cfg.supabase.anonKey = "";
  if (isPlaceholder(cfg.ga4Id)) cfg.ga4Id = "";
  cfg.features = cfg.features || {};
  if (!cfg.sheets || typeof cfg.sheets !== "object") cfg.sheets = null;
  if (cfg.sheets) {
    Object.keys(cfg.sheets).forEach(function (k) {
      if (isPlaceholder(cfg.sheets[k])) cfg.sheets[k] = "";
    });
    if (!cfg.sheets.boardId && cfg.sheets.boardUrl) {
      var m = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(cfg.sheets.boardUrl);
      if (m) cfg.sheets.boardId = m[1];
    }
  }

  window.SBPRESS_CONFIG = cfg;

  var API = {
    config: cfg,
    brandName: function () { return String(cfg.siteName || GENERIC.siteName); },
    tagline: function () { return String(cfg.tagline || ""); },
    siteUrl: function () { return String(cfg.siteUrl || ""); },
    feature: function (name) { return cfg.features[name] !== false; },
    configured: function () { return !!(cfg.supabase.url && cfg.supabase.anonKey); },
    sheetId: function () { return (cfg.features.sheets !== false && cfg.sheets && cfg.sheets.boardId) || ""; },
    sheetUrl: function () { return (cfg.sheets && (cfg.sheets.boardUrl || (cfg.sheets.boardId ? "https://docs.google.com/spreadsheets/d/" + cfg.sheets.boardId + "/edit" : ""))) || ""; },
    isPlaceholder: isPlaceholder
  };
  window.SBP = API;

  /* 기존 코드와의 호환: auth-config.js·auth.js·cms.js 등이 쓰는 window.CRAFT_SUPABASE */
  window.CRAFT_SUPABASE = {
    url: cfg.supabase.url || "",
    anonKey: cfg.supabase.anonKey || "",
    providers: Array.isArray(cfg.providers) ? cfg.providers.slice() : ["email"],
    naverAuthUrl: cfg.naverAuthUrl || ""
  };

  /* ---------- 화면 브랜드 채우기 ---------- */
  function fillBrand(root) {
    var scope = root || document;
    [].forEach.call(scope.querySelectorAll("[data-sbp-brand]"), function (n) {
      var small = n.querySelector("small");
      if (small && n.firstChild && n.firstChild.nodeType === 3) {
        n.firstChild.nodeValue = API.brandName();
      } else if (small) {
        var prev = small.previousSibling;
        if (prev && prev.nodeType === 3) prev.nodeValue = API.brandName();
        else n.insertBefore(document.createTextNode(API.brandName()), small);
      } else {
        n.textContent = API.brandName();
      }
    });
    [].forEach.call(scope.querySelectorAll("[data-sbp-tagline]"), function (n) {
      n.textContent = API.tagline();
      if (!API.tagline() && n.parentNode && n.tagName === "SMALL") n.parentNode.removeChild(n);
    });
    [].forEach.call(scope.querySelectorAll("[data-sbp-site-title]"), function (n) {
      n.textContent = cfg.siteTitle || API.brandName();
    });
    [].forEach.call(scope.querySelectorAll("[data-sbp-aria-home]"), function (n) {
      n.setAttribute("aria-label", API.brandName() + " 홈");
    });
    [].forEach.call(scope.querySelectorAll("[data-sbp-aria-admin]"), function (n) {
      n.setAttribute("aria-label", API.brandName() + " 관리자");
    });
    [].forEach.call(scope.querySelectorAll("[data-sbp-email='owner']"), function (n) {
      if (cfg.ownerEmail) n.textContent = cfg.ownerEmail;
    });
    [].forEach.call(scope.querySelectorAll("[data-sbp-default]"), function (n) {
      if (!String(n.textContent || "").trim()) n.textContent = n.getAttribute("data-sbp-default");
    });
  }

  /* ---------- GA4 (설정에 ID가 있을 때만) ---------- */
  function loadAnalytics() {
    if (!cfg.ga4Id) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", cfg.ga4Id);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.ga4Id);
    document.head.appendChild(s);
  }

  function apply() {
    try {
      var html = document.documentElement;
      if (cfg.defaultLang) html.setAttribute("lang", cfg.defaultLang);
      if (document.body && cfg.defaultTheme && !document.body.getAttribute("data-theme")) {
        document.body.setAttribute("data-theme", cfg.defaultTheme);
      }
      fillBrand(document);
    } catch (e) { /* 화면 채우기 실패는 사이트를 멈추지 않습니다 */ }
    loadAnalytics();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();

  /* ---------- v6.0 지연 로딩 (코드 분할) ----------
     첫 화면에 필요 없는 스크립트는 그 화면에 들어갈 때 한 번만 받습니다.
       SBP.loadScript("assets/tasks.js").then(...)
     같은 파일을 두 번 요청하지 않고, 실패하면 다음에 다시 시도합니다. */
  var scriptCache = {};
  function scriptUrl(src) {
    var s = String(src || "");
    if (/^(https?:)?\/\//.test(s) || s.charAt(0) === "/") return s;
    return basePath() + s;
  }
  function loadScript(src) {
    var s = String(src || "");
    if (!s) return Promise.reject(new Error("loadScript: 빈 경로"));
    if (scriptCache[s]) return scriptCache[s];
    scriptCache[s] = new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = scriptUrl(s);
      tag.async = true;
      tag.setAttribute("data-sbp-lazy", s);
      tag.onload = function () { resolve(s); };
      tag.onerror = function () {
        delete scriptCache[s];
        reject(new Error("loadScript 실패: " + s));
      };
      document.head.appendChild(tag);
    });
    return scriptCache[s];
  }
  function loadScripts(list) {
    return Promise.all((list || []).map(loadScript));
  }
  /* v6.0 — 아카이브 자료(assets/archive.js, 58KB)는 #/archive 에 들어갈 때 받습니다.
     첫 화면의 ‘아카이브 N건’ 숫자는 설정값으로 먼저 보여 줍니다. */
  function archiveTotal() {
    if (window.ARCHIVE && window.ARCHIVE.total) return Number(window.ARCHIVE.total);
    return Number(cfg.archiveTotal || 0) || 0;
  }
  API.loadScript = loadScript;
  API.loadScripts = loadScripts;
  API.archiveTotal = archiveTotal;
  API.loadedScripts = function () { return Object.keys(scriptCache); };

  API.applyBrand = fillBrand;
})();
