/* ===== 전국공방 · 마이페이지 (assets/mypage.js) =====
   #/mypage — 로그인한 회원의 내 정보(닉네임·등급) · 내 찜 목록 · 내가 쓴 댓글.
   - 읽기·수정은 본인 행만 가능합니다(Supabase RLS: profiles/bookmarks/comments).
   - 로그인하지 않았으면 로그인 안내만 보입니다.
   의존: assets/auth.js (CRAFT_AUTH), assets/cms.js (글 제목·주소), assets/auth-config.js
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = CFG.url || "";
  var KEY = CFG.anonKey || "";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? m[1] + "." + m[2] + "." + m[3] : "";
  }

  function auth() { return window.CRAFT_AUTH || null; }
  function user() { return auth() && auth().user ? auth().user() : null; }
  function token() { return auth() && auth().token ? auth().token() : null; }
  function profile() { return auth() && auth().profile ? auth().profile() : null; }

  function rest(path, method, body) {
    var t = token();
    if (!API || !t) return Promise.reject(new Error("로그인이 필요합니다."));
    var headers = {
      apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (method && method !== "GET") headers.Prefer = "return=representation";
    return fetch(API + "/rest/v1/" + path, {
      method: method || "GET", headers: headers,
      body: body ? JSON.stringify(body) : undefined, cache: "no-store"
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t2) {
        var m = "";
        try { m = JSON.parse(t2).message || ""; } catch (e) { m = t2; }
        throw new Error(m || ("HTTP " + r.status));
      });
      return r.status === 204 ? null : r.json();
    });
  }

  function gradeOf() { return auth() && auth().memberGrade ? auth().memberGrade() : 1; }
  function gradeName(n) { return auth() && auth().gradeName ? auth().gradeName(n) : "회원"; }
  function displayName() {
    var p = profile();
    if (p && p.nickname) return p.nickname;
    var u = user();
    var m = (u && u.user_metadata) || {};
    return m.nickname || m.name || (u && u.email ? u.email.split("@")[0] : "회원");
  }

  /* 글 slug → 제목·게시판 주소 (cms.js 가 읽어 둔 공개 글 사용) */
  function postInfo(key) {
    var C = window.CRAFT_CMS;
    var p = (C && C.postFor) ? C.postFor(key) : null;
    if (p) return { title: p.title, slug: p.slug || key, exists: true };
    return { title: key && String(key).indexOf("workshop:") === 0 ? "공방 소개 · " + String(key).slice(9) : key, slug: key, exists: false };
  }

  var state = { bookmarks: [], comments: [], loaded: false };

  /* ---------------- 로그인 안내 ---------------- */
  function renderGate() {
    var gate = $("#mypage-gate"), app = $("#mypage-app");
    if (!gate || !app) return;
    var on = !!user();
    gate.hidden = on;
    app.hidden = !on;
    if (on) { gate.innerHTML = ""; return; }
    app.innerHTML = "";
    gate.innerHTML =
      '<div class="mypage-login">' +
        '<p><b>마이페이지는 로그인 후에 볼 수 있습니다.</b></p>' +
        '<p>내 닉네임·회원 등급, 찜한 공방, 내가 쓴 댓글을 한 자리에서 관리할 수 있어요.</p>' +
        '<button type="button" class="btn btn-primary btn-sm" id="mypage-login-btn">로그인하기</button>' +
      "</div>";
    var b = $("#mypage-login-btn");
    if (b) b.addEventListener("click", function () {
      if (auth()) auth().openLogin("마이페이지는 로그인 후에 볼 수 있습니다.");
    });
  }

  /* ---------------- 화면 ---------------- */
  function render() {
    renderGate();
    var u = user();
    if (!u) return;
    var app = $("#mypage-app");
    if (!app) return;

    var g = gradeOf();
    var name = displayName();
    var p = profile() || {};
    var providerLabel = { google: "Google 계정", kakao: "카카오 계정", naver: "네이버 계정", email: "이메일 계정" }[p.provider] || "회원";

    var html =
      '<section class="mp-card mp-profile">' +
        '<div class="mp-head">' +
          '<span class="mp-avatar" aria-hidden="true">' + esc(String(name).charAt(0)) + "</span>" +
          "<div><b>" + esc(name) + ' <span class="grade-badge g' + g + '">' + esc(gradeName(g)) + "</span></b>" +
          "<span>" + esc(u.email || "") + " · " + esc(providerLabel) + "</span></div>" +
        "</div>" +
        '<div class="mp-nick">' +
          '<label for="mp-nickname">닉네임</label>' +
          '<input id="mp-nickname" class="admin-input" maxlength="20" value="' + esc(p.nickname || name) + '" autocomplete="nickname">' +
          '<button type="button" class="btn btn-primary btn-sm" id="mp-nick-save">저장</button>' +
          '<span class="mp-msg" id="mp-nick-msg" role="status" aria-live="polite"></span>' +
        "</div>" +
        '<p class="mp-note">닉네임은 댓글과 게시판에 표시됩니다. 회원 등급은 운영자가 바꿀 수 있습니다.</p>' +
      "</section>" +

      '<section class="mp-card">' +
        '<div class="mp-card-head"><h3>내 찜 목록</h3><span class="panel-tag" id="mp-bm-n">' + state.bookmarks.length + "곳</span></div>" +
        '<div id="mp-bookmarks" class="mp-bm"></div>' +
      "</section>" +

      '<section class="mp-card">' +
        '<div class="mp-card-head"><h3>내가 쓴 댓글</h3><span class="panel-tag" id="mp-cmt-n">' + state.comments.length + "개</span></div>" +
        '<div id="mp-comments" class="mp-cmts"></div>' +
      "</section>";

    app.innerHTML = html;
    bindProfile();
    renderBookmarks();
    renderComments();
  }

  function bindProfile() {
    var btn = $("#mp-nick-save");
    if (!btn) return;
    var input = $("#mp-nickname");
    function save() {
      var v = (input.value || "").trim();
      var msg = $("#mp-nick-msg");
      if (v.length < 1 || v.length > 20) {
        if (msg) msg.textContent = "닉네임은 1~20자로 적어 주세요.";
        input.focus();
        return;
      }
      var u = user();
      if (!u) return;
      btn.disabled = true;
      if (msg) msg.textContent = "저장하는 중…";
      rest("profiles?id=eq." + encodeURIComponent(u.id), "PATCH", { nickname: v })
        .then(function () {
          btn.disabled = false;
          if (msg) msg.textContent = "닉네임을 저장했습니다.";
          if (auth() && auth().reloadProfile) return auth().reloadProfile();
        })
        .then(function () { render(); })
        .catch(function (e) {
          btn.disabled = false;
          if (msg) msg.textContent = "저장하지 못했습니다: " + ((e && e.message) || "권한을 확인해 주세요.");
        });
    }
    btn.addEventListener("click", save);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); save(); }
    });
  }

  function renderBookmarks() {
    var box = $("#mp-bookmarks");
    if (!box) return;
    if (!state.bookmarks.length) {
      box.innerHTML = '<p class="mp-empty">아직 찜한 공방이 없습니다. <a href="#/map">지도·게시판</a>에서 마음에 드는 공방의 ♡ 찜하기를 눌러 보세요.</p>';
      return;
    }
    box.innerHTML = state.bookmarks.map(function (b) {
      return '<div class="mp-bm-row" data-name="' + esc(b.workshop_name) + '">' +
        '<span class="mp-bm-name">' + esc(b.workshop_name) + "</span>" +
        '<span class="mp-bm-date">' + esc(fmtDate(b.created_at)) + "</span>" +
        '<a class="mp-bm-open" href="#/map">지도에서 보기</a>' +
        '<button type="button" class="mp-bm-del" data-del="' + esc(b.workshop_name) + '" aria-label="' + esc(b.workshop_name) + ' 찜 취소">찜 취소</button>' +
        "</div>";
    }).join("");
    [].forEach.call(box.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function () { removeBookmark(b.getAttribute("data-del")); });
    });
  }

  function removeBookmark(name) {
    var u = user();
    if (!u || !name) return;
    var btn = null;
    [].forEach.call(document.querySelectorAll("#mp-bookmarks [data-del]"), function (b) {
      if (b.getAttribute("data-del") === name) btn = b;
    });
    if (btn) btn.disabled = true;
    rest("bookmarks?user_id=eq." + encodeURIComponent(u.id) + "&workshop_name=eq." + encodeURIComponent(name), "DELETE")
      .then(function () {
        state.bookmarks = state.bookmarks.filter(function (b) { return b.workshop_name !== name; });
        var n = $("#mp-bm-n");
        if (n) n.textContent = state.bookmarks.length + "곳";
        renderBookmarks();
      })
      .catch(function () {
        if (btn) btn.disabled = false;
      });
  }

  function renderComments() {
    var box = $("#mp-comments");
    if (!box) return;
    if (!state.comments.length) {
      box.innerHTML = '<p class="mp-empty">아직 남긴 댓글이 없습니다. 게시판 글에서 💬 댓글 버튼을 눌러 남겨 보세요.</p>';
      return;
    }
    box.innerHTML = state.comments.map(function (c) {
      var info = postInfo(c.post_key);
      var title = info.exists
        ? '<a href="#/post/' + encodeURIComponent(info.slug) + '">' + esc(info.title) + "</a>"
        : "<b>" + esc(info.title) + "</b>";
      return '<article class="mp-cmt">' +
        '<div class="mp-cmt-head">' + title +
          (c.parent_id ? ' <span class="mp-cmt-badge">답글</span>' : "") +
          "<time>" + esc(fmtDate(c.created_at)) + "</time></div>" +
        '<p class="mp-cmt-text">' + esc(c.content).replace(/\n/g, "<br>") + "</p>" +
        "</article>";
    }).join("");
  }

  /* ---------------- 데이터 ---------------- */
  function load() {
    var u = user();
    if (!u) { state.bookmarks = []; state.comments = []; state.loaded = false; return Promise.resolve(); }
    return Promise.all([
      rest("bookmarks?select=workshop_name,created_at&user_id=eq." + encodeURIComponent(u.id) + "&order=created_at.desc").catch(function () { return []; }),
      rest("comments?select=id,post_key,content,created_at,parent_id&user_id=eq." + encodeURIComponent(u.id) + "&order=created_at.desc&limit=100").catch(function () { return []; })
    ]).then(function (res) {
      state.bookmarks = res[0] || [];
      state.comments = res[1] || [];
      state.loaded = true;
    });
  }

  function show() {
    if (window.SBP && window.SBP.feature && !window.SBP.feature("mypage")) {
      location.hash = "#/home";
      return;
    }
    renderGate();
    if (!user()) { render(); return; }
    var app = $("#mypage-app");
    if (app && !app.innerHTML.trim()) app.innerHTML = '<p class="mp-empty">불러오는 중…</p>';
    load().then(render);
  }

  function refresh() {
    if (user()) { load().then(render); } else render();
  }

  window.CRAFT_MYPAGE = { show: show, refresh: refresh };

  /* 로그인/로그아웃하면 화면을 다시 그립니다. */
  if (auth() && auth().onChange) {
    auth().onChange(function () {
      var here = (location.hash || "").replace(/^#\/?/, "");
      if (here === "mypage") show();
    });
  }
})();
