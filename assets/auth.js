/* ===== 전국공방 · 회원가입 / 로그인 / 관심 공방 (Supabase) =====
   - 이메일 로그인·회원가입, 구글·카카오 OAuth, 네이버(Edge Function 브리지)
   - 로그인 후: 닉네임 메뉴 · 관심 공방 · 로그아웃
   - 공방 카드 ♡ 찜하기 → bookmarks 테이블 저장 (본인만 읽기/쓰기, RLS)
   의존: assets/supabase.js, assets/auth-config.js
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var CONFIGURED = !!(CFG.url && CFG.anonKey);
  var SITE = (location.origin && location.origin !== "null")
    ? location.origin + location.pathname
    : "https://craftstorekorea.github.io/";

  var sb = null;
  var session = null;
  var profile = null;
  var bookmarks = [];           // [{workshop_name, created_at}]
  var bookmarkSet = Object.create(null);
  var registry = [];            // 찜 버튼 요소들
  var ready = false;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var I18N = window.CRAFT_I18N || null;
  function T(key, vars) { return I18N ? I18N.t(key, vars) : key; }
  function sessionToken() {
    return (session && session.access_token) ? session.access_token : null;
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function qs(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function cleanUrl() {
    try {
      var u = new URL(location.href);
      ["naver_token", "type", "state", "naver_error", "code", "error_description", "error"].forEach(function (k) {
        u.searchParams.delete(k);
      });
      history.replaceState(null, "", u.pathname + u.search + (location.hash || "#/home"));
    } catch (e) { /* noop */ }
  }

  /* ---------------- 아이콘 ---------------- */
  var I = {
    heart: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 20.3 4.9 13.4a4.4 4.4 0 0 1 6.2-6.2l.9.9.9-.9a4.4 4.4 0 0 1 6.2 6.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    heartOn: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 20.3 4.9 13.4a4.4 4.4 0 0 1 6.2-6.2l.9.9.9-.9a4.4 4.4 0 0 1 6.2 6.2z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.8 20c.7-3.6 3.6-5.6 7.2-5.6s6.5 2 7.2 5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    google: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5z"/><path fill="#FBBC05" d="M5.6 14.2a7 7 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4z"/><path fill="#EA4335" d="M12 4.9c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3A6.9 6.9 0 0 1 12 4.9z"/></svg>',
    kakao: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#3C1E1E" d="M12 3.5c-4.8 0-8.7 3-8.7 6.7 0 2.4 1.6 4.5 4 5.7-.2.7-.7 2.5-.8 2.9 0 .5.2.5.5.4.4-.1 2.4-1.6 3.3-2.2.6.1 1.1.1 1.7.1 4.8 0 8.7-3 8.7-6.8S16.8 3.5 12 3.5z"/></svg>',
    naver: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="#fff" d="M15.3 12.6 8.5 3H3.6v18h5.1v-9.6L15.5 21h4.9V3h-5.1z"/></svg>'
  };

  /* ---------------- 헤더 영역 ---------------- */
  var docMenuListener = null;
  function authArea() { return $("#auth-area"); }

  function renderHeader() {
    var host = authArea();
    if (!host) return;
    host.innerHTML = "";

    if (!session) {
      var b = el("button", "auth-btn", I.user + "<span>" + esc(T("auth.login.btn")) + "</span>");
      b.type = "button";
      b.setAttribute("aria-label", T("auth.login.aria"));
      b.addEventListener("click", function () { openAuth("signin"); });
      host.appendChild(b);
      return;
    }

    var name = displayName();
    var wrap = el("div", "auth-user");
    var btn = el("button", "auth-btn auth-user-btn",
      '<span class="auth-avatar" aria-hidden="true">' + esc(name.slice(0, 1)) + "</span>" +
      '<span class="auth-name">' + esc(name) + "</span>" +
      '<span class="grade-badge g' + gradeOf() + '">' + esc(gradeName(gradeOf())) + "</span>" +
      '<span class="auth-caret" aria-hidden="true">▾</span>');
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");

    var menu = el("div", "auth-menu");
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    menu.innerHTML =
      '<div class="auth-menu-head"><b>' + esc(name) + ' <span class="grade-badge g' + gradeOf() + '">' + esc(gradeName(gradeOf())) + "</span></b><span>" +
        esc(session.user.email || providerLabel()) + "</span></div>" +
      '<button type="button" role="menuitem" data-act="bookmarks">' + I.heartOn +
        '<span data-i18n="auth.menu.bookmarks"></span> <i>' + bookmarks.length + "</i></button>" +
      '<a role="menuitem" href="#/mypage" data-act="mypage" data-i18n="auth.menu.mypage">마이페이지</a>' +
      '<a role="menuitem" href="#/tasks" data-act="tasks" data-i18n="auth.menu.tasks"></a>' +
      '<a role="menuitem" href="#/map" data-act="map" data-i18n="auth.menu.board"></a>' +
      '<button type="button" role="menuitem" data-act="signout" data-i18n="auth.menu.signout"></button>';
    if (I18N) I18N.apply(menu);

    btn.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    if (docMenuListener) document.removeEventListener("click", docMenuListener);
    docMenuListener = function (e) {
      if (!wrap.isConnected) { document.removeEventListener("click", docMenuListener); docMenuListener = null; return; }
      if (!wrap.contains(e.target)) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    };
    document.addEventListener("click", docMenuListener);
    menu.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]");
      if (!t) return;
      var act = t.dataset.act;
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (act === "signout") signOut();
      if (act === "bookmarks") openBookmarks();
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    host.appendChild(wrap);
  }

  function displayName() {
    if (profile && profile.nickname) return profile.nickname;
    var u = session && session.user;
    if (!u) return "회원";
    var m = u.user_metadata || {};
    return m.nickname || m.name || m.full_name || m.preferred_username ||
      (u.email ? u.email.split("@")[0] : "회원");
  }

  /* ---------- 회원 등급 (1 일반 · 2 정회원 · 3 특별회원/VIP) ---------- */
  function gradeOf() {
    var g = profile && profile.member_grade != null ? parseInt(profile.member_grade, 10) : 1;
    return (g >= 1 && g <= 3) ? g : 1;
  }
  function gradeName(n) {
    var ko = { 1: "일반회원", 2: "정회원", 3: "특별회원(VIP)" };
    var en = { 1: "Member", 2: "Regular member", 3: "VIP" };
    var g = (n >= 1 && n <= 3) ? n : 1;
    var v = "";
    try {
      var c = window.CRAFT_CMS && window.CRAFT_CMS.contents ? window.CRAFT_CMS.contents() : null;
      var row = c && c["grade_" + g + "_name"];
      v = row && row.value != null ? String(row.value).trim() : "";
    } catch (e) { v = ""; }
    var english = !!(I18N && I18N.isEn && I18N.isEn());
    if (!v) return english ? en[g] : ko[g];
    if (english && v === ko[g]) return en[g];   // 관리자가 이름을 바꾸지 않았다면 영어 기본 이름
    return v;
  }
  function providerLabel() {
    var p = (profile && profile.provider) || (session && session.user && session.user.app_metadata && session.user.app_metadata.provider);
    return { google: "Google 계정", kakao: "카카오 계정", naver: "네이버 계정", email: "이메일 계정" }[p] || "회원";
  }

  /* ---------------- 로그인 모달 ---------------- */
  var modal, msgBox, form, mode = "signin";

  function buildModal() {
    modal = el("div", "auth-modal");
    modal.id = "auth-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="auth-backdrop" data-close="1"></div>' +
      '<div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">' +
        '<button type="button" class="auth-x" aria-label="close" data-close="1">' + I.close + "</button>" +
        '<p class="eyebrow auth-eyebrow" data-i18n="auth.eyebrow">우리동네공방 회원</p>' +
        '<h2 id="auth-title">로그인</h2>' +
        '<p class="auth-sub"></p>' +
        '<div class="auth-socials">' +
          '<button type="button" class="auth-social google" data-provider="google"><span class="ic">' + I.google + '</span><span data-i18n="auth.google">구글로 계속하기</span></button>' +
          '<button type="button" class="auth-social kakao" data-provider="kakao"><span class="ic">' + I.kakao + '</span><span data-i18n="auth.kakao">카카오로 계속하기</span></button>' +
          '<button type="button" class="auth-social naver" data-provider="naver"><span class="ic">' + I.naver + '</span><span data-i18n="auth.naver">네이버로 계속하기</span></button>' +
        "</div>" +
        '<div class="auth-or"><span data-i18n="auth.or">또는 이메일로</span></div>' +
        '<form id="auth-form" novalidate>' +
          '<label class="auth-field"><span data-i18n="auth.email">이메일</span>' +
            '<input type="email" id="auth-email" autocomplete="email" inputmode="email" placeholder="name@example.com" required></label>' +
          '<label class="auth-field" id="auth-nick-wrap" hidden><span><span data-i18n="auth.nickname">닉네임</span> <em data-i18n="auth.optional">(선택)</em></span>' +
            '<input type="text" id="auth-nick" autocomplete="nickname" maxlength="20" placeholder="게시판에 표시할 이름" data-i18n-ph="auth.nick.ph"></label>' +
          '<label class="auth-field"><span id="auth-pass-label">비밀번호</span>' +
            '<input type="password" id="auth-pass" autocomplete="current-password" minlength="6" placeholder="6자 이상" data-i18n-ph="auth.pass.ph" required></label>' +
          '<p class="auth-msg" id="auth-msg" role="status" aria-live="polite"></p>' +
          '<button type="submit" class="btn btn-primary auth-submit" id="auth-submit">로그인</button>' +
        "</form>" +
        '<div class="auth-foot">' +
          '<button type="button" class="auth-link" id="auth-toggle"></button>' +
          '<button type="button" class="auth-link" id="auth-forgot"></button>' +
        "</div>" +
        '<p class="auth-terms" data-i18n="auth.terms"></p>' +
      "</div>";
    document.body.appendChild(modal);
    if (I18N) I18N.apply(modal);

    // auth-config.js 의 providers 목록에 있는 로그인만 노출합니다. (없거나 비면 전부 노출)
    var only = (CFG.providers && CFG.providers.length) ? CFG.providers : null;
    if (only) {
      [].forEach.call(modal.querySelectorAll(".auth-social[data-provider]"), function (b) {
        if (only.indexOf(b.dataset.provider) < 0 && b.parentNode) b.parentNode.removeChild(b);
      });
      if (!modal.querySelector(".auth-social")) {
        var socBox = modal.querySelector(".auth-socials");
        var orLine = modal.querySelector(".auth-or");
        if (socBox && socBox.parentNode) socBox.parentNode.removeChild(socBox);
        if (orLine && orLine.parentNode) orLine.parentNode.removeChild(orLine);
      }
    }

    msgBox = $("#auth-msg", modal);
    form = $("#auth-form", modal);

    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) closeAuth();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeAuth();
    });

    $("#auth-toggle", modal).addEventListener("click", function () {
      setMode(mode === "signin" ? "signup" : "signin");
    });
    $("#auth-forgot", modal).addEventListener("click", function () { forgotPassword(); });

    [].forEach.call(modal.querySelectorAll("[data-provider]"), function (b) {
      b.addEventListener("click", function () { oauth(b.dataset.provider); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (mode === "reset") return updatePassword();
      mode === "signup" ? signUp() : signIn();
    });
  }

  function setMode(next) {
    mode = next;
    var title = $("#auth-title", modal);
    var sub = $(".auth-sub", modal);
    var submit = $("#auth-submit", modal);
    var nickWrap = $("#auth-nick-wrap", modal);
    var pass = $("#auth-pass", modal);
    var passLabel = $("#auth-pass-label", modal);
    var toggle = $("#auth-toggle", modal);
    var forgot = $("#auth-forgot", modal);
    msg("");

    var key = next === "signup" ? "signup" : (next === "reset" ? "reset" : "signin");
    title.textContent = T("auth." + key + ".title");
    sub.textContent = T("auth." + key + ".sub");
    submit.textContent = T("auth.submit." + key);
    submit.dataset.label = "";

    if (next === "signup") {
      nickWrap.hidden = false;
      pass.autocomplete = "new-password";
      passLabel.textContent = T("auth.password");
      toggle.innerHTML = T("auth.toggle.signup");
      toggle.hidden = false;
      forgot.hidden = false;
      forgot.textContent = T("auth.forgot");
    } else if (next === "reset") {
      nickWrap.hidden = true;
      pass.value = "";
      pass.autocomplete = "new-password";
      passLabel.textContent = T("auth.newPassword");
      toggle.hidden = true;
      forgot.hidden = true;
    } else {
      nickWrap.hidden = true;
      pass.autocomplete = "current-password";
      passLabel.textContent = T("auth.password");
      toggle.innerHTML = T("auth.toggle.signin");
      toggle.hidden = false;
      forgot.hidden = false;
      forgot.textContent = T("auth.forgot");
    }
  }

  function msg(text, kind) {
    if (!msgBox) return;
    msgBox.textContent = text || "";
    msgBox.className = "auth-msg" + (kind ? " " + kind : "");
  }

  function openAuth(which, note) {
    if (!modal) buildModal();
    if (!CONFIGURED) {
      setMode("signin");
      msg("로그인 기능을 준비 중입니다. 잠시 후 다시 이용해 주세요.", "warn");
      modal.hidden = false;
      document.body.classList.add("auth-lock");
      return;
    }
    if (which === "signup" || which === "reset") setMode(which);
    else setMode("signin");
    if (note) msg(note, "warn");
    modal.hidden = false;
    document.body.classList.add("auth-lock");
    setTimeout(function () {
      var f = mode === "signup" ? $("#auth-email", modal) : $("#auth-email", modal);
      if (f) f.focus();
    }, 40);
  }
  function closeAuth() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("auth-lock");
    msg("");
  }

  /* ---------------- 인증 동작 ---------------- */
  function busy(b) {
    var s = $("#auth-submit", modal);
    if (!s) return;
    s.disabled = !!b;
    s.dataset.label = s.dataset.label || s.textContent;
    s.textContent = b ? "처리 중…" : s.dataset.label;
  }

  function signIn() {
    if (!sb) return;
    var email = ($("#auth-email", modal).value || "").trim();
    var pass = $("#auth-pass", modal).value || "";
    if (!email || !pass) return msg("이메일과 비밀번호를 입력해 주세요.", "warn");
    busy(true); msg("로그인 중…");
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      busy(false);
      if (r.error) return msg(koErr(r.error), "err");
      msg("로그인되었습니다.", "ok");
      setTimeout(closeAuth, 400);
    });
  }

  function signUp() {
    if (!sb) return;
    var email = ($("#auth-email", modal).value || "").trim();
    var pass = $("#auth-pass", modal).value || "";
    var nick = ($("#auth-nick", modal).value || "").trim();
    if (!email || !pass) return msg("이메일과 비밀번호를 입력해 주세요.", "warn");
    if (pass.length < 6) return msg("비밀번호는 6자 이상으로 정해 주세요.", "warn");
    busy(true); msg("가입 처리 중…");
    sb.auth.signUp({
      email: email,
      password: pass,
      options: { data: { nickname: nick || email.split("@")[0] }, emailRedirectTo: SITE }
    }).then(function (r) {
      busy(false);
      if (r.error) return msg(koErr(r.error), "err");
      if (r.data.session) {
        msg("가입이 완료되었습니다. 환영합니다!", "ok");
        setTimeout(closeAuth, 500);
      } else {
        msg("가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 끝납니다.", "ok");
      }
    });
  }

  function forgotPassword() {
    if (!sb) return;
    var email = ($("#auth-email", modal).value || "").trim();
    if (!email) return msg("비밀번호를 재설정할 이메일을 먼저 입력해 주세요.", "warn");
    busy(true);
    sb.auth.resetPasswordForEmail(email, { redirectTo: SITE }).then(function (r) {
      busy(false);
      if (r.error) return msg(koErr(r.error), "err");
      msg("재설정 메일을 보냈습니다. 메일의 링크를 열어 새 비밀번호를 정해 주세요.", "ok");
    });
  }

  function updatePassword() {
    if (!sb) return;
    var pass = $("#auth-pass", modal).value || "";
    if (pass.length < 6) return msg("비밀번호는 6자 이상으로 정해 주세요.", "warn");
    busy(true);
    sb.auth.updateUser({ password: pass }).then(function (r) {
      busy(false);
      if (r.error) return msg(koErr(r.error), "err");
      msg("비밀번호를 바꿨습니다.", "ok");
      setTimeout(closeAuth, 600);
    });
  }

  function oauth(p) {
    if (!sb) return;
    if (p === "naver") {
      if (!CFG.naverAuthUrl) return msg("네이버 로그인은 준비 중입니다. 이메일 또는 구글·카카오로 로그인해 주세요.", "warn");
      msg("네이버로 이동합니다…");
      location.href = CFG.naverAuthUrl;
      return;
    }
    msg("이동 중…");
    sb.auth.signInWithOAuth({
      provider: p,
      options: { redirectTo: SITE }
    }).then(function (r) {
      if (r.error) msg(koErr(r.error), "err");
    });
  }

  function signOut() {
    if (!sb) return;
    sb.auth.signOut().then(function () {
      bookmarks = []; bookmarkSet = Object.create(null);
      paintBookmarks();
      renderHeader();
    });
  }

  function koErr(e) {
    var m = (e && e.message) || "문제가 생겼습니다.";
    if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않습니다.";
    if (/Email not confirmed/i.test(m)) return "메일함의 확인 링크를 먼저 눌러 주세요.";
    if (/User already registered/i.test(m)) return "이미 가입된 이메일입니다. 로그인해 주세요.";
    if (/Password should be at least/i.test(m)) return "비밀번호는 6자 이상으로 정해 주세요.";
    if (/rate limit|too many/i.test(m)) return "잠시 뒤에 다시 시도해 주세요. (요청이 너무 많습니다)";
    if (/provider is not enabled/i.test(m)) return "아직 준비되지 않은 로그인 방식입니다.";
    if (/Unable to validate email/i.test(m)) return "이메일 주소를 다시 확인해 주세요.";
    return m;
  }

  /* ---------------- 찜하기 ---------------- */
  function attachBookmark(card, name) {
    if (!card || !name || !CONFIGURED) return;
    if (card.querySelector(".bm-btn")) return;
    registry = registry.filter(function (x) { return x.isConnected; });
    var b = el("button", "bm-btn");
    b.type = "button";
    b.dataset.bm = name;
    b.dataset.on = "0";
    b.innerHTML = I.heart + '<span>찜하기</span>';
    b.title = name + " 찜하기";
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleBookmark(name);
    });
    var foot = card.querySelector(".bcard-foot, .ws-actions, .ws-foot");
    if (foot) foot.appendChild(b);
    else card.appendChild(b);
    registry.push(b);
    b.dataset.on = bookmarkSet[name] ? "1" : "0";
    if (bookmarkSet[name]) {
      b.classList.add("on");
      b.innerHTML = I.heartOn + "<span>찜했어요</span>";
    }
  }

  function toggleBookmark(name) {
    if (!session) {
      openAuth("signin", "찜하기는 로그인 후 이용할 수 있어요. 1분이면 가입됩니다.");
      return;
    }
    var on = !!bookmarkSet[name];
    // 화면 먼저 반영
    var next = !on;
    setLocal(name, next);
    if (next) {
      sb.from("bookmarks").insert({ user_id: session.user.id, workshop_name: name }).then(function (r) {
        if (r.error && !/duplicate|unique/i.test(r.error.message)) {
          setLocal(name, false);
          toast("찜하지 못했습니다: " + r.error.message, "err");
          return;
        }
        if (r.error) return; // 이미 찜한 상태 — 그대로 둔다
        reloadBookmarks().then(function () { toast(name + " — 관심 공방에 담았습니다", "ok"); });
      });
    } else {
      sb.from("bookmarks").delete().eq("user_id", session.user.id).eq("workshop_name", name).then(function (r) {
        if (r.error) {
          setLocal(name, true);
          toast("찜을 취소하지 못했습니다: " + r.error.message, "err");
          return;
        }
        reloadBookmarks().then(function () { toast(name + " — 관심 공방에서 뺐습니다"); });
      });
    }
  }

  function setLocal(name, on) {
    if (on) {
      bookmarkSet[name] = 1;
      if (!bookmarks.some(function (b) { return b.workshop_name === name; })) {
        bookmarks.unshift({ workshop_name: name, created_at: new Date().toISOString() });
      }
    } else {
      delete bookmarkSet[name];
      bookmarks = bookmarks.filter(function (b) { return b.workshop_name !== name; });
    }
    paintBookmarks();
    renderHeader();
  }

  function paintBookmarks() {
    registry.forEach(function (b) {
      if (!b.isConnected) return;
      var on = !!bookmarkSet[b.dataset.bm];
      b.dataset.on = on ? "1" : "0";
      b.classList.toggle("on", on);
      b.classList.remove("pulse");
      void b.offsetWidth;
      b.classList.add("pulse");
      b.innerHTML = (on ? I.heartOn : I.heart) + "<span>" + (on ? "찜했어요" : "찜하기") + "</span>";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var cnt = document.querySelector(".auth-menu [data-act='bookmarks'] i");
    if (cnt) cnt.textContent = String(bookmarks.length);
  }

  function reloadBookmarks() {
    if (!sb || !session) return Promise.resolve();
    return sb.from("bookmarks").select("workshop_name,created_at")
      .eq("user_id", session.user.id).order("created_at", { ascending: false })
      .then(function (r) {
        if (!r.error) {
          bookmarks = r.data || [];
          bookmarkSet = Object.create(null);
          bookmarks.forEach(function (b) { bookmarkSet[b.workshop_name] = 1; });
        }
        paintBookmarks();
        renderHeader();
        if (bmModal && !bmModal.hidden) paintBookmarkModal();
      });
  }

  /* ---------------- 관심 공방 모달 ---------------- */
  var bmModal = null;

  function openBookmarks() {
    if (!bmModal) {
      bmModal = el("div", "auth-modal");
      bmModal.id = "bm-modal";
      bmModal.hidden = true;
      bmModal.innerHTML =
        '<div class="auth-backdrop" data-close="1"></div>' +
        '<div class="auth-card wide" role="dialog" aria-modal="true" aria-labelledby="bm-title">' +
          '<button type="button" class="auth-x" aria-label="닫기" data-close="1">' + I.close + "</button>" +
          '<p class="eyebrow auth-eyebrow">관심 공방</p>' +
          '<h2 id="bm-title">찜해 둔 공방</h2>' +
          '<p class="auth-sub" id="bm-sub"></p>' +
          '<div class="bm-list" id="bm-list"></div>' +
        "</div>";
      document.body.appendChild(bmModal);
      bmModal.addEventListener("click", function (e) {
        if (e.target.closest("[data-close]")) { bmModal.hidden = true; document.body.classList.remove("auth-lock"); }
      });
    }
    bmModal.hidden = false;
    document.body.classList.add("auth-lock");
    paintBookmarkModal();
    reloadBookmarks();
  }

  function paintBookmarkModal() {
    var list = $("#bm-list", bmModal);
    var sub = $("#bm-sub", bmModal);
    if (!list) return;
    if (!bookmarks.length) {
      sub.textContent = "아직 찜한 공방이 없습니다.";
      list.innerHTML = '<p class="bm-empty">지도·게시판에서 마음에 드는 공방의 <b>♡ 찜하기</b>를 눌러 보세요.<br><a class="btn btn-ghost btn-sm" href="#/map" data-close="1">공방 게시판 가기</a></p>';
      return;
    }
    sub.textContent = bookmarks.length + "곳을 찜해 두었습니다.";
    list.innerHTML = bookmarks.map(function (b) {
      return '<div class="bm-row" data-name="' + esc(b.workshop_name) + '">' +
        '<span class="bm-name">' + esc(b.workshop_name) + "</span>" +
        '<button type="button" class="bm-open" data-open="' + esc(b.workshop_name) + '">지도에서 보기</button>' +
        '<button type="button" class="bm-del" aria-label="' + esc(b.workshop_name) + ' 찜 취소" data-del="' + esc(b.workshop_name) + '">×</button>' +
        "</div>";
    }).join("");
    list.onclick = function (e) {
      var del = e.target.closest("[data-del]");
      if (del) { toggleBookmark(del.dataset.del); return; }
      var op = e.target.closest("[data-open]");
      if (op) {
        bmModal.hidden = true;
        document.body.classList.remove("auth-lock");
        location.hash = "#/map";
        setTimeout(function () {
          var q = $("#q");
          if (q) {
            q.value = op.dataset.open;
            q.dispatchEvent(new Event("input", { bubbles: true }));
          }
          var card = document.querySelector('#board-grid .bcard[data-name="' + op.dataset.open.replace(/"/g, '\\"') + '"]');
          if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("flash"); }
        }, 200);
      }
    };
  }

  /* ---------------- 토스트 ---------------- */
  var toastEl = null, toastTimer = null;
  function toast(text, kind) {
    if (!toastEl) {
      toastEl = el("div", "auth-toast");
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.className = "auth-toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "auth-toast"; }, 2600);
  }

  /* ---------------- 세션 ---------------- */
  function loadProfile() {
    if (!sb || !session) { profile = null; return Promise.resolve(); }
    return sb.from("profiles").select("nickname,email,provider,member_grade").eq("id", session.user.id).maybeSingle()
      .then(function (r) {
        profile = (r && !r.error && r.data) ? r.data : null;
        if (!profile) {
          // 트리거가 없거나 늦은 경우 직접 생성
          var m = session.user.user_metadata || {};
          profile = {
            nickname: m.nickname || m.name || (session.user.email || "").split("@")[0],
            email: session.user.email,
            provider: (session.user.app_metadata && session.user.app_metadata.provider) || "email",
            member_grade: 1
          };
          sb.from("profiles").upsert({
            id: session.user.id, email: profile.email,
            nickname: profile.nickname, provider: profile.provider
          }).then(function () {});
        }
        renderHeader();
        fireSession();       // 화면(업무 관리 등)이 등급을 바로 읽을 수 있게 알립니다
      });
  }

  var sessionListeners = [];
  function fireSession() {
    sessionListeners.forEach(function (fn) {
      try { fn(session); } catch (e) { /* 한 곳이 실패해도 나머지는 그대로 */ }
    });
  }

  function onSession(s, force) {
    session = s || null;
    if (!session) {
      profile = null; bookmarks = []; bookmarkSet = Object.create(null);
      paintBookmarks(); renderHeader(); fireSession();
      return;
    }
    loadProfile().then(reloadBookmarks);
    fireSession();
    if (force && modal && !modal.hidden) { msg("로그인되었습니다.", "ok"); setTimeout(closeAuth, 500); }
  }

  function handleReturn() {
    var t = qs("naver_token");
    if (t) {
      var typ = qs("type") || "magiclink";
      cleanUrl();
      sb.auth.verifyOtp({ token_hash: t, type: typ }).then(function (r) {
        if (r.error) { openAuth("signin", "네이버 로그인을 마치지 못했습니다: " + koErr(r.error)); return; }
        toast("네이버 계정으로 로그인되었습니다", "ok");
      });
      return;
    }
    var err = qs("naver_error");
    if (err) {
      cleanUrl();
      openAuth("signin", "네이버 로그인을 마치지 못했습니다 (" + err + ")");
      return;
    }
    var hash = location.hash || "";
    if (/[#&]type=recovery/.test(hash) || /[?&]type=recovery/.test(location.search)) {
      setTimeout(function () { openAuth("reset", "새 비밀번호를 정해 주세요."); }, 600);
    }
    if (/error_description=/.test(location.search + hash)) {
      var d = decodeURIComponent((/error_description=([^&]+)/.exec(location.search + hash) || [])[1] || "");
      if (d) openAuth("signin", "로그인 연결에 실패했습니다: " + d.replace(/\+/g, " "));
    }
  }

  /* ---------------- 시작 ---------------- */
  function init() {
    if (I18N && I18N.onChange) {
      I18N.onChange(function () {
        var wasOpen = !!(modal && !modal.hidden);
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        modal = null;
        renderHeader();
        if (wasOpen) openAuth(mode === "reset" ? "reset" : (mode === "signup" ? "signup" : "signin"));
      });
    }
    if (!CONFIGURED) {
      document.body.classList.add("auth-off");
      console.warn("[auth] CRAFT_SUPABASE 설정이 비어 있습니다. assets/auth-config.js 를 채워 주세요.");
      return;
    }
    renderHeader();
    if (typeof supabase === "undefined" || !supabase.createClient) {
      console.error("[auth] supabase-js 를 불러오지 못했습니다.");
      return;
    }
    sb = supabase.createClient(CFG.url, CFG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    sb.auth.getSession().then(function (r) {
      ready = true;
      onSession(r.data ? r.data.session : null);
      handleReturn();
    });
    sb.auth.onAuthStateChange(function (_evt, s) {
      if (!ready) return;
      var changed = (s && s.user ? s.user.id : null) !== (session && session.user ? session.user.id : null);
      onSession(s, changed && !!s);
    });
  }

  window.CRAFT_AUTH = {
    attachBookmark: attachBookmark,
    openLogin: function (note) { openAuth("signin", note); },
    openBookmarks: openBookmarks,
    /* 로그인/로그아웃 때 알림을 받습니다 (댓글 UI 등). 등록 즉시 현재 상태로 한 번 호출됩니다. */
    onChange: function (fn) {
      if (typeof fn !== "function") return;
      sessionListeners.push(fn);
      try { fn(session); } catch (e) { /* noop */ }
    },
    isSignedIn: function () { return !!session; },
    user: function () { return session ? session.user : null; },
    token: sessionToken,
    profile: function () { return profile; },
    reloadProfile: function () { return loadProfile(); },
    memberGrade: gradeOf,
    gradeName: gradeName,
    configured: CONFIGURED
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
