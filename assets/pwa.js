/* ===== SBPress v6.0 · PWA (assets/pwa.js) — 설치 · 오프라인 · 최근 본 글 =====
   sw.js 등록 · 오프라인 배너(#/offline) · beforeinstallprompt → [설치] · 최근 본 글은 app.js 가 남깁니다 */
(function () {
  "use strict";

  var I18N = window.CRAFT_I18N || null;
  function T(key, vars) {
    if (I18N && I18N.t) return I18N.t(key, vars);
    return key;
  }
  function $(sel) { return document.querySelector(sel); }
  function recent() {
    try {
      var raw = localStorage.getItem("sbpress-recent-posts");
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
        || navigator.standalone === true;
    } catch (e) { return false; }
  }
  function swSupported() { return "serviceWorker" in navigator; }
  function swHostOk() {
    if (location.protocol === "https:") return true;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
  }

  var state = {
    registered: false,
    scope: "",
    controller: false,
    error: "",
    installable: false,
    deferred: null
  };

  /* ---------------- 서비스 워커 ---------------- */
  function register() {
    if (!swSupported() || !swHostOk()) return;
    try {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(function (reg) {
        state.registered = true;
        state.scope = reg.scope || "";
        if (navigator.serviceWorker.controller) state.controller = true;
        /* 새 버전이 준비되면 조용히 넘깁니다(캐시 키가 버전별이라 안전합니다). */
        if (reg.waiting) { try { reg.waiting.postMessage({ type: "skip-waiting" }); } catch (e) {} }
      }).catch(function (e) {
        state.error = (e && e.message) || String(e);
      });
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        state.controller = true;
      });
    } catch (e) {
      state.error = (e && e.message) || String(e);
    }
  }

  /* ---------------- 오프라인 배너 ---------------- */
  function paintOffline() {
    var bar = $("#offline-bar");
    if (!bar) return;
    var off = (typeof navigator.onLine === "boolean") ? !navigator.onLine : false;
    var n = recent().length;
    if (!off) { bar.hidden = true; return; }
    var text = $("#offline-text");
    if (text) {
      text.textContent = n
        ? T("pwa.offline.banner", { n: n })
        : T("pwa.offline.bannerZero");
    }
    var link = $("#offline-open");
    if (link) link.hidden = !n;
    bar.hidden = false;
  }

  /* ---------------- 설치 안내 ---------------- */
  function installDismissed() {
    try {
      var at = Number(localStorage.getItem("sbpress-install-dismiss") || 0);
      return at && (Date.now() - at) < 1000 * 60 * 60 * 24 * 14;   // 2주 동안 다시 묻지 않습니다
    } catch (e) { return false; }
  }
  function showInstall() {
    var bar = $("#install-bar");
    if (!bar || isStandalone() || installDismissed()) return;
    bar.hidden = false;
  }
  function hideInstall() {
    var bar = $("#install-bar");
    if (bar) bar.hidden = true;
  }

  function bind() {
    window.addEventListener("online", paintOffline);
    window.addEventListener("offline", paintOffline);

    var x = $("#offline-x");
    if (x) x.addEventListener("click", function () {
      var bar = $("#offline-bar");
      if (bar) bar.hidden = true;
    });

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      state.deferred = e;
      state.installable = true;
      showInstall();
    });
    window.addEventListener("appinstalled", function () {
      state.installable = false;
      state.deferred = null;
      hideInstall();
    });

    var go = $("#install-go");
    if (go) go.addEventListener("click", function () {
      var d = state.deferred;
      if (!d || !d.prompt) { hideInstall(); return; }
      try {
        d.prompt();
        if (d.userChoice && d.userChoice.then) {
          d.userChoice.then(function () { state.deferred = null; hideInstall(); });
        } else { hideInstall(); }
      } catch (e) { hideInstall(); }
    });
    var ix = $("#install-x");
    if (ix) ix.addEventListener("click", function () {
      try { localStorage.setItem("sbpress-install-dismiss", String(Date.now())); } catch (e) {}
      hideInstall();
    });

    paintOffline();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
  paintOffline();
  register();

  window.SBP_PWA = {
    register: register,
    repaint: paintOffline,
    recent: recent,
    status: function () {
      return {
        supported: swSupported(),
        hostOk: swHostOk(),
        registered: state.registered,
        scope: state.scope,
        controller: !!(navigator.serviceWorker && navigator.serviceWorker.controller) || state.controller,
        offline: (typeof navigator.onLine === "boolean") ? !navigator.onLine : false,
        installable: state.installable,
        standalone: isStandalone(),
        error: state.error,
        recent: recent().length
      };
    }
  };
})();
