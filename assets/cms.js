/* ===== 전국공방 · CMS + 댓글 (assets/cms.js) =====
   - Supabase 의 site_contents(문구·이미지) / posts(게시판 글) / comments(댓글) 를 읽어 사이트에 반영합니다.
   - data.js 는 첫 화면용 기본값으로 그대로 쓰고, 서버 응답이 오면 그 내용으로 다시 그립니다.
   - 댓글: 누구나 읽기, 로그인한 회원은 쓰기·본인 것 삭제. 숨김 댓글은 서버(RLS)가 감춥니다.
   - 관리자 페이지(/admin.html)에서 저장한 내용이 곧 이 사이트에 보이는 내용입니다.
   의존: assets/data.js, assets/auth.js(선택), assets/app.js (window.CRAFT_APP.refresh)
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = CFG.url || "";
  var KEY = CFG.anonKey || "";
  var S = window.SITE;
  if (!API || !KEY || !S) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var contents = Object.create(null);
  var cmtCounts = Object.create(null);
  var booted = false;
  var loadedPosts = false;

  /* ---------------- REST (공개 읽기) ---------------- */
  function rest(path) {
    return fetch(API + "/rest/v1/" + path, {
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, Accept: "application/json" },
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---------------- 로그인 세션 (auth.js 와 같은 저장소를 읽습니다) ---------------- */
  function sessionToken() {
    try {
      var ref = API.replace(/^https?:\/\//, "").split(".")[0];
      var raw = localStorage.getItem("sb-" + ref + "-auth-token");
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.access_token) return o.access_token;
      if (o && o.currentSession && o.currentSession.access_token) return o.currentSession.access_token;
      return null;
    } catch (e) { return null; }
  }
  function me() {
    return (window.CRAFT_AUTH && window.CRAFT_AUTH.user) ? window.CRAFT_AUTH.user() : null;
  }
  function myName(user) {
    if (!user) return "";
    var m = user.user_metadata || {};
    var n = m.nickname || m.name || m.full_name || (user.email || "").split("@")[0];
    return String(n || "회원").slice(0, 40);
  }

  /* ---------------- 글(data.js) 에 slug 붙이기 ----------------
     posts 시드가 data.js 와 같은 순서라서, 서버 응답 전에도 댓글 키가 같습니다. */
  (function tagSlugs() {
    [["intro", "intro"], ["news", "news"], ["interviews", "interview"], ["info", "info"]].forEach(function (p) {
      (S[p[0]] || []).forEach(function (it, i) {
        if (it && !it.slug) it.slug = p[1] + "-" + pad(i + 1);
      });
    });
  })();

  /* ---------------- posts → 사이트 데이터 ---------------- */
  function num(v) { return v == null ? "" : String(v); }

  function mapArticle(p) {
    return {
      slug: p.slug, title: p.title, desc: num(p.summary),
      tag: (p.meta && p.meta.tag) || p.category, region: num(p.region),
      source: num(p.source_name), date: num(p.published_at), url: num(p.source_url),
      image: p.image_url || "", _id: p.id
    };
  }
  function mapInterview(p) {
    var m = p.meta || {};
    return {
      slug: p.slug, title: p.title, quote: num(p.summary), desc: num(p.body || p.summary),
      person: m.person || "공방", role: m.role || "", source: num(p.source_name),
      date: num(p.published_at), url: num(p.source_url), image: p.image_url || "", _id: p.id
    };
  }
  function mapInfo(p) {
    var m = p.meta || {};
    var due = p.deadline ? String(p.deadline).slice(0, 10) : "";
    if (due && m.due_time) due += "T" + m.due_time;
    return {
      slug: p.slug, title: p.title, org: num(p.source_name), period: m.period || "",
      due: due, kind: m.kind || "정보", desc: num(p.summary), url: num(p.source_url),
      image: p.image_url || "", _id: p.id
    };
  }
  function applyPosts(rows) {
    var by = { "소개": [], "뉴스": [], "인터뷰": [], "정보": [] };
    rows.forEach(function (p) { if (by[p.category]) by[p.category].push(p); });
    S.intro = by["소개"].map(mapArticle);
    S.news = by["뉴스"].map(mapArticle);
    S.interviews = by["인터뷰"].map(mapInterview);
    S.info = by["정보"].map(mapInfo);
    loadedPosts = true;
  }

  /* ---------------- site_contents → 화면 ---------------- */
  function vars(v) {
    var total = (S.workshops || []).length + (S.news || []).length + (S.interviews || []).length + (S.info || []).length;
    var arc = (window.ARCHIVE && window.ARCHIVE.total) || 0;
    return String(v)
      .replace(/\{total\}/g, total)
      .replace(/\{archive\}/g, arc)
      .replace(/\{count\}/g, (S.news || []).length)
      .replace(/\{from\}/g, (S.weekFrom || "").slice(5))
      .replace(/\{to\}/g, (S.weekTo || "").slice(5));
  }
  function applyContents() {
    $$("[data-cms]").forEach(function (node) {
      var key = node.getAttribute("data-cms");
      var row = contents[key];
      if (!row || row.value == null || row.value === "") return;
      node.innerHTML = esc(vars(row.value)).replace(/\n/g, "<br>");
    });

    // 대표 이미지 슬롯
    var hero = contents["hero.image_url"];
    if (hero && hero.image_url) {
      var pic = $("#hero-picture"), img = $("#hero-img");
      if (pic) $$("source", pic).forEach(function (s) { s.remove(); });
      if (img) { img.removeAttribute("srcset"); img.removeAttribute("sizes"); img.src = hero.image_url; }
    }
    var wb = contents["workshops.image_url"], wfig = $("#workshops-banner");
    if (wb && wfig) {
      var wimg = $("#workshops-banner-img");
      if (wimg && wb.image_url) { wimg.src = wb.image_url; wfig.hidden = false; }
    }

    // 공지 배너
    var bar = $("#notice-bar"), txt = contents["notice.text"];
    if (bar) {
      var text = txt && txt.value ? vars(txt.value).trim() : "";
      if (!text || sessionStorage.getItem("craft-notice-dismissed") === text) {
        bar.hidden = true;
      } else {
        bar.hidden = false;
        var p = $("#notice-text");
        if (p) p.textContent = text;
        var link = $("#notice-link");
        var lab = contents["notice.link_label"], url = contents["notice.link_url"];
        if (link) {
          if (url && url.value) {
            link.href = url.value;
            link.textContent = (lab && lab.value) || "자세히 보기";
            link.hidden = false;
          } else { link.hidden = true; }
        }
      }
    }
  }

  /* ---------------- 댓글 개수 ---------------- */
  function loadCounts() {
    return rest("comments?select=post_key&limit=5000").then(function (rows) {
      cmtCounts = Object.create(null);
      rows.forEach(function (r) { cmtCounts[r.post_key] = (cmtCounts[r.post_key] || 0) + 1; });
      paintButtons();
    }).catch(function () { /* 집계 실패는 조용히 무시 — 댓글 버튼은 0으로 표시 */ });
  }

  function paintButtons() {
    $$(".cmt-btn").forEach(function (b) {
      var key = b.getAttribute("data-key");
      var n = cmtCounts[key] || 0;
      b.innerHTML = '<span class="cmt-ico" aria-hidden="true">💬</span><span>댓글</span>' +
        (n ? ' <b class="cmt-n">' + n + "</b>" : "");
      b.setAttribute("aria-label", (n ? "댓글 " + n + "개 " : "댓글 ") + "보기");
    });
  }

  /* ---------------- 댓글 버튼 붙이기 (app.js 가 호출) ---------------- */
  function attach(node, key, title, image) {
    if (!node || !key) return;
    var slot = node.querySelector("[data-cmt]");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cmt-btn";
    btn.setAttribute("data-key", key);
    btn.setAttribute("data-title", title || "");
    if (image) btn.setAttribute("data-image", image);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openDrawer(key, title || "", btn.getAttribute("data-image") || "");
    });
    (slot || node).appendChild(btn);
    var n = cmtCounts[key] || 0;
    btn.innerHTML = '<span class="cmt-ico" aria-hidden="true">💬</span><span>댓글</span>' +
      (n ? ' <b class="cmt-n">' + n + "</b>" : "");
  }

  /* ---------------- 댓글 드로어 ---------------- */
  var drawer = null, state = { key: "", title: "", image: "", rows: [] };
  var lastFocus = null;

  function buildDrawer() {
    var root = document.getElementById("cmt-root") || document.body;
    var wrap = document.createElement("div");
    wrap.className = "cmt-shell";
    wrap.innerHTML =
      '<div class="cmt-overlay" id="cmt-overlay" hidden></div>' +
      '<aside class="cmt-drawer" id="cmt-drawer" role="dialog" aria-modal="true" aria-labelledby="cmt-title" hidden>' +
      '  <img class="cmt-hero" id="cmt-hero" alt="" hidden>' +
      '  <header class="cmt-head">' +
      '    <div><p class="cmt-eyebrow">댓글</p><h2 id="cmt-title"></h2></div>' +
      '    <button type="button" class="cmt-close" id="cmt-close" aria-label="댓글 닫기">×</button>' +
      "  </header>" +
      '  <div class="cmt-body"><div class="cmt-list" id="cmt-list"></div></div>' +
      '  <form class="cmt-form" id="cmt-form" hidden>' +
      '    <label class="sr-only" for="cmt-input">댓글 내용</label>' +
      '    <textarea id="cmt-input" maxlength="1000" rows="3" placeholder="서로에게 도움이 되는 말을 남겨 주세요. (최대 1000자)"></textarea>' +
      '    <div class="cmt-form-foot"><span class="cmt-who" id="cmt-who"></span>' +
      '      <span class="cmt-chars" id="cmt-chars">0/1000</span>' +
      '      <button type="submit" class="btn btn-primary btn-sm" id="cmt-send">댓글 등록</button></div>' +
      '    <p class="cmt-msg" id="cmt-msg" role="status" aria-live="polite"></p>' +
      "  </form>" +
      '  <div class="cmt-login" id="cmt-login" hidden>' +
      "    <p>댓글을 쓰려면 로그인이 필요합니다. 전국공방 회원은 누구나 남길 수 있어요.</p>" +
      '    <button type="button" class="btn btn-primary btn-sm" id="cmt-login-btn">로그인하고 댓글 쓰기</button>' +
      "  </div>" +
      "</aside>";
    root.appendChild(wrap);
    drawer = wrap;

    $("#cmt-close").addEventListener("click", closeDrawer);
    $("#cmt-overlay").addEventListener("click", closeDrawer);
    $("#cmt-login-btn").addEventListener("click", function () {
      if (window.CRAFT_AUTH) window.CRAFT_AUTH.openLogin("댓글을 쓰려면 로그인해 주세요.");
    });
    $("#cmt-input").addEventListener("input", function (e) {
      $("#cmt-chars").textContent = e.target.value.length + "/1000";
    });
    $("#cmt-form").addEventListener("submit", submitComment);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer && !$("#cmt-drawer").hidden) closeDrawer();
    });
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
      window.CRAFT_AUTH.onChange(function () { syncForm(); });
    }
  }

  function fmtWhen(iso) {
    if (!iso) return "";
    var d = new Date(iso), diff = Date.now() - d.getTime();
    if (diff >= 0 && diff < 60e3) return "방금";
    if (diff >= 0 && diff < 3600e3) return Math.round(diff / 60e3) + "분 전";
    if (diff >= 0 && diff < 86400e3) return Math.round(diff / 3600e3) + "시간 전";
    if (diff >= 0 && diff < 7 * 86400e3) return Math.round(diff / 86400e3) + "일 전";
    return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }).replace(/\s/g, "");
  }

  function openDrawer(key, title, image) {
    if (!drawer) buildDrawer();
    lastFocus = document.activeElement;
    state.key = key; state.title = title; state.image = image || "";
    $("#cmt-title").textContent = title || "댓글";
    var hero = $("#cmt-hero");
    if (state.image) { hero.src = state.image; hero.hidden = false; } else { hero.hidden = true; hero.removeAttribute("src"); }
    $("#cmt-list").innerHTML = '<p class="cmt-empty">댓글을 불러오는 중…</p>';
    $("#cmt-msg").textContent = "";
    $("#cmt-overlay").hidden = false;
    $("#cmt-drawer").hidden = false;
    document.body.classList.add("cmt-lock");
    syncForm();
    loadComments(key);
    setTimeout(function () { var i = $("#cmt-input"); if (i && !$("#cmt-form").hidden) i.focus(); }, 60);
  }

  function closeDrawer() {
    if (!drawer) return;
    $("#cmt-drawer").hidden = true;
    $("#cmt-overlay").hidden = true;
    document.body.classList.remove("cmt-lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function syncForm() {
    if (!drawer || $("#cmt-drawer").hidden) return;
    var user = me(), token = sessionToken();
    var on = !!(user && token);
    $("#cmt-form").hidden = !on;
    $("#cmt-login").hidden = on;
    if (on) $("#cmt-who").textContent = myName(user) + " 님으로 남깁니다";
  }

  function renderComments() {
    var list = $("#cmt-list");
    if (!state.rows.length) {
      list.innerHTML = '<div class="cmt-empty"><b>아직 댓글이 없습니다.</b><p>첫 번째 이야기를 남겨 보세요.</p></div>';
      return;
    }
    var user = me();
    list.innerHTML = state.rows.map(function (c) {
      var mine = user && c.user_id === user.id;
      return '<article class="cmt-item' + (mine ? " mine" : "") + '">' +
        '<div class="cmt-item-head"><span class="cmt-avatar">' + esc(String(c.author_name || "?").charAt(0)) + "</span>" +
        "<b>" + esc(c.author_name) + "</b>" +
        (mine ? '<span class="cmt-me">나</span>' : "") +
        '<time datetime="' + esc(c.created_at) + '">' + esc(fmtWhen(c.created_at)) + "</time></div>" +
        '<p class="cmt-text">' + esc(c.content).replace(/\n/g, "<br>") + "</p>" +
        (mine ? '<button type="button" class="cmt-del" data-del="' + esc(c.id) + '">삭제</button>' : "") +
        "</article>";
    }).join("");
    $$("[data-del]", list).forEach(function (b) {
      b.addEventListener("click", function () { deleteComment(b.getAttribute("data-del")); });
    });
  }

  function loadComments(key) {
    var q = "comments?select=id,post_key,user_id,author_name,content,is_hidden,created_at" +
      "&post_key=eq." + encodeURIComponent(key) + "&order=created_at.asc&limit=500";
    return rest(q).then(function (rows) {
      if (state.key !== key) return;
      state.rows = rows || [];
      renderComments();
    }).catch(function () {
      if (state.key !== key) return;
      $("#cmt-list").innerHTML = '<p class="cmt-empty">댓글을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>';
    });
  }

  function submitComment(e) {
    if (e) e.preventDefault();
    var input = $("#cmt-input"), msg = $("#cmt-msg");
    var text = (input.value || "").trim();
    var user = me(), token = sessionToken();
    if (!user || !token) { syncForm(); return; }
    if (!text) { msg.textContent = "댓글 내용을 입력해 주세요."; input.focus(); return; }
    if (text.length > 1000) { msg.textContent = "댓글은 1000자까지 쓸 수 있습니다."; return; }
    var btn = $("#cmt-send");
    btn.disabled = true; msg.textContent = "등록하는 중…";
    fetch(API + "/rest/v1/comments", {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: "Bearer " + token,
        "Content-Type": "application/json", Prefer: "return=representation"
      },
      body: JSON.stringify({
        post_key: state.key, user_id: user.id,
        author_name: myName(user), content: text
      })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      return r.json();
    }).then(function (rows) {
      var row = rows && rows[0];
      if (row && state.rows.every(function (c) { return c.id !== row.id; })) state.rows.push(row);
      input.value = ""; $("#cmt-chars").textContent = "0/1000";
      msg.textContent = "댓글을 남겼습니다.";
      cmtCounts[state.key] = (cmtCounts[state.key] || 0) + 1;
      paintButtons();
      renderComments();
      setTimeout(function () { msg.textContent = ""; }, 2200);
    }).catch(function (err) {
      var m = String(err && err.message || "");
      msg.textContent = /row-level security|permission|401|403/i.test(m)
        ? "로그인 정보가 만료되었습니다. 다시 로그인한 뒤 남겨 주세요."
        : "댓글을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }).then(function () { btn.disabled = false; });
  }

  function deleteComment(id) {
    var user = me(), token = sessionToken();
    if (!user || !token || !id) return;
    if (!window.confirm("이 댓글을 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) return;
    fetch(API + "/rest/v1/comments?id=eq." + encodeURIComponent(id), {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: "Bearer " + token, Prefer: "return=minimal" }
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      state.rows = state.rows.filter(function (c) { return c.id !== id; });
      cmtCounts[state.key] = Math.max(0, (cmtCounts[state.key] || 1) - 1);
      paintButtons();
      renderComments();
      $("#cmt-msg").textContent = "댓글을 삭제했습니다.";
      setTimeout(function () { $("#cmt-msg").textContent = ""; }, 2000);
    }).catch(function () {
      $("#cmt-msg").textContent = "댓글을 삭제하지 못했습니다. 로그인 상태를 확인해 주세요.";
    });
  }

  /* ---------------- 공지 닫기 ---------------- */
  function bindNotice() {
    var btn = $("#notice-close");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var t = $("#notice-text");
      try { sessionStorage.setItem("craft-notice-dismissed", t ? t.textContent : ""); } catch (e) { /* noop */ }
      $("#notice-bar").hidden = true;
    });
  }

  /* ---------------- 시작 ---------------- */
  function refresh() {
    if (window.CRAFT_APP && window.CRAFT_APP.refresh) window.CRAFT_APP.refresh();
  }

  function boot() {
    if (booted) return;
    booted = true;
    bindNotice();

    Promise.all([
      rest("site_contents?select=key,value,image_url").catch(function () { return null; }),
      rest("posts?select=*&is_published=eq.true&order=category.asc,sort_order.asc,published_at.desc&limit=500").catch(function () { return null; })
    ]).then(function (res) {
      var rows = res[0], posts = res[1];
      if (rows) { rows.forEach(function (r) { contents[r.key] = r; }); }
      if (posts && posts.length) { applyPosts(posts); refresh(); }
      applyContents();
      loadCounts();
      paintButtons();
    });
  }

  window.CRAFT_CMS = {
    attach: attach,
    recount: paintButtons,
    open: openDrawer,
    contents: function () { return contents; },
    postsLoaded: function () { return loadedPosts; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 0);
})();
