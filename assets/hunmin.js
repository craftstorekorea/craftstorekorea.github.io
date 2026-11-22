/* ============================================================================
   hunmin — SBPress 블록 조립기 v2.0  (사이트 렌더 + 관리자 편집기)
   ----------------------------------------------------------------------------
   9종 블록을 페이지(pages.blocks)에 순서대로 담습니다.
     latest  [최신글]        게시판 글을 실시간으로 카드에 담습니다.
     popular [인기글]        조회수가 많은 글을 위에서부터 모읍니다.
     map     [지도]          등록 공방의 전국 지도(SVG)를 페이지에 놓습니다.
     form    [구독/제보 폼]  뉴스레터 구독 · 공방 등록/제보를 접수합니다.
     gallery [이미지 갤러리] 페이지 사진 또는 블록 사진을 설명과 함께 보여 줍니다.
     text    [텍스트·배너]   제목 + 본문 + 버튼 한 덩어리.
     table   [표]            머리글 + 행을 안전하게 그립니다(HTML 불가, 글자만).
     cta     [버튼/CTA]      큰 안내 띠 + 버튼.
     embed   [임베드]        유튜브·구글 드라이브/문서만 허용(https·허용 도메인).

   저장 형식 (v5.1)
     pages.blocks = { v: 1, items: [ {id, type, props:{…}, hidden:false, locked:false} ] }
     예전 형식([{type:'posts', title:…}] 평면 배열, v:1 필드가 붙은 배열)도 읽습니다.

   사용:
     사이트   window.CRAFT_HUNMIN.render(container, page)
     관리자   window.CRAFT_HUNMIN.editor.mount(container, blocks, options)
              options = { boards, upload, onChange, preview, page, historyLimit }
   ============================================================================ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var VERSION = "2.0";
  var HISTORY_LIMIT = 20;

  var SBP = window.SBP || null;
  var SC = window.SBPRESS_CONFIG || {};
  function brandName() { return (SBP && SBP.brandName) ? SBP.brandName() : (SC.siteName || "사이트"); }
  function tagline() { return (SBP && SBP.tagline) ? (SBP.tagline() || SBP.brandName()) : (SC.tagline || SC.siteName || "사이트"); }
  var I18N = window.CRAFT_I18N || null;
  function isEn() { return !!(I18N && I18N.isEn && I18N.isEn()); }
  function hT(key) { return (I18N && I18N.t) ? I18N.t(key) : key; }
  function hEn(p, field) {
    if (!isEn()) return "";
    return (p && p.en && p.en[field]) ? p.en[field] : "";
  }

  /* 블록 안의 문구 — 한국어를 열쇠로 영어를 찾습니다(사전에 없으면 한국어 그대로: 테스트가 잡습니다). */
  var EN = {
    "최신글": "Latest",
    "최신 소식": "Latest news",
    "인기글": "Popular posts",
    "전체 글": "All posts",
    "전체 게시판": "All boards",
    "지도": "Map",
    "갤러리": "Gallery",
    "텍스트": "Text",
    "배너": "Banner",
    "표": "Table",
    "버튼/CTA": "Call to action",
    "임베드": "Embed",
    "항목": "Item",
    "내용": "Details",
    "아직 이 게시판에 공개된 글이 없습니다.": "No published posts in this board yet.",
    "📌 고정": "📌 Pinned",
    "📌": "📌",
    "전국 공방 지도": "Workshop map across Korea",
    "곳의 공방이 지도에 표시되어 있습니다.": " workshop(s) are pinned on the map.",
    "지도·게시판 열기": "Open map and board",
    "지도에서 지역을 누르면 그 지역 공방만 골라 볼 수 있습니다.": "Pick a region on the map to see only its workshops.",
    "아직 사진이 없습니다.": "No photos yet.",
    "제목을 입력하세요": "Add a title",
    "이메일": "Email",
    "이름": "Name",
    "공방 이름": "Workshop name",
    "지역": "Region",
    "분야": "Craft",
    "연락처": "Contact",
    "소개": "About",
    "선택": "optional",
    "필수": "required",
    "구독하기": "Subscribe",
    "제보 보내기": "Send",
    "뉴스레터 구독": "Newsletter",
    "공방 등록·제보": "Workshop registration",
    "공방을 등록해 주세요": "Register your workshop",
    "입력하신 이메일은 뉴스레터 발송에만 사용합니다.": "Your email is used only to send the newsletter.",
    "적어 주신 내용은 공방 등록·제보 검토에만 사용합니다.": "What you send is used only to review the registration.",
    "지금은 접수할 수 없습니다. 잠시 뒤 다시 시도해 주세요.": "Submissions are unavailable now. Please try again shortly.",
    "이메일 주소를 입력해 주세요.": "Please enter your email address.",
    "공방 이름을 입력해 주세요.": "Please enter the workshop name.",
    "보내는 중…": "Sending…",
    "구독 신청을 받았습니다. 다음 편부터 보내 드릴게요.": "You are subscribed. You will hear from us from the next issue.",
    "제보를 받았습니다. 확인 후 연락드리겠습니다.": "Received. We will get back to you after reviewing it.",
    "보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.": "Could not send. Please try again shortly.",
    "이름·연락처·소개를 적어 주세요.": "name, contact and about",
    "공방 소개와 운영 프로그램을 적어 주세요.": "Tell us about your workshop and programs.",
    "전화 또는 이메일": "Phone or email",
    "예: 부산": "e.g. Busan",
    "예: 도예": "e.g. Ceramics",
    "표에 넣을 내용이 없습니다.": "This table has no rows yet.",
    "자세히 보기": "Learn more",
    "유튜브·구글 드라이브(문서) 주소만 넣을 수 있습니다.": "Only YouTube or Google Drive (Docs) links are allowed.",
    "미리보기를 표시할 수 없습니다.": "This preview cannot be shown."
  };
  function T(ko) {
    if (!isEn()) return ko;
    return EN[ko] != null ? EN[ko] : ko;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function str(v) { return v == null ? "" : String(v); }
  function absUrl(u) {
    var v = str(u).trim();
    if (!v) return "";
    if (/^(https?:|data:|blob:|\/\/|\/)/i.test(v)) return v;
    return "/" + v.replace(/^\.\//, "");
  }
  function dateKo(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(iso));
    if (!m) return "";
    if (isEn()) {
      var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return names[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1];
    }
    var months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    return months[Number(m[2]) - 1] + " " + Number(m[3]) + "일";
  }
  function clamp(n, min, max, dflt) {
    n = Number(n);
    if (!isFinite(n)) n = dflt;
    return Math.max(min, Math.min(max, n));
  }
  function safeHref(u) {
    var v = str(u).trim().slice(0, 500);
    if (!v) return "";
    if (/^(#|https:\/\/|mailto:|\/)/i.test(v)) return v;
    return "";
  }

  /* ---------------- 임베드 허용 규칙 ---------------- */
  var YT = /^[\w-]{6,20}$/;
  function embedInfo(raw) {
    var s = str(raw).trim();
    if (!s) return { ok: false, reason: "empty" };
    if (!/^https:\/\//i.test(s)) return { ok: false, reason: "scheme" };
    var u;
    try { u = new URL(s); } catch (e) { return { ok: false, reason: "url" }; }
    var host = String(u.hostname || "").toLowerCase().replace(/^www\./, "");
    var id = "";
    if (host === "youtu.be") {
      id = u.pathname.replace(/^\//, "").split("/")[0];
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch" || u.pathname === "/watch/") id = u.searchParams.get("v") || "";
      else {
        var m = /^\/(?:embed|shorts|live|v)\/([\w-]+)/.exec(u.pathname);
        if (m) id = m[1];
      }
    }
    if (id && YT.test(id)) {
      return { ok: true, provider: "youtube", id: id, src: "https://www.youtube-nocookie.com/embed/" + id };
    }
    if (host === "drive.google.com") {
      var md = /\/d\/([\w-]{10,})/.exec(u.pathname);
      if (md) return { ok: true, provider: "drive", id: md[1], src: "https://drive.google.com/file/d/" + md[1] + "/preview" };
      return { ok: false, reason: "drive" };
    }
    if (host === "docs.google.com") {
      var mo = /^\/(document|spreadsheets|presentation)\/d\/([\w-]{10,})/.exec(u.pathname);
      if (mo) {
        return { ok: true, provider: "docs", id: mo[2],
          src: "https://docs.google.com/" + mo[1] + "/d/" + mo[2] + "/preview" };
      }
      if (/^\/forms\//.test(u.pathname)) {
        return { ok: true, provider: "forms", id: "", src: "https://docs.google.com" + u.pathname + (u.search || "") };
      }
      return { ok: false, reason: "docs" };
    }
    return { ok: false, reason: "host" };
  }

  /* ---------------- 블록 정의 (9종) ---------------- */
  var TYPES = [
    {
      type: "latest", label: "최신글", icon: "news",
      desc: "게시판 글을 실시간으로 카드에 담습니다.",
      defaults: { board: "all", count: 3, title: "최신 소식" }
    },
    {
      type: "popular", label: "인기글", icon: "pin",
      desc: "조회수가 많은 글을 위에서부터 모읍니다.",
      defaults: { board: "all", count: 3, title: "인기글" }
    },
    {
      type: "map", label: "지도", icon: "map",
      desc: "등록 공방의 전국 지도를 페이지에 놓습니다.",
      defaults: { title: "전국 공방 지도", desc_text: "" }
    },
    {
      type: "form", label: "구독/제보 폼", icon: "mail",
      desc: "뉴스레터 구독 또는 공방 등록·제보를 받습니다.",
      defaults: {
        kind: "newsletter", title: tagline() + " 뉴스레터",
        desc_text: "매주 금요일, 이번 주 공방 소식을 메일로 보내 드립니다.",
        button: "구독하기"
      }
    },
    {
      type: "gallery", label: "이미지 갤러리", icon: "doc",
      desc: "페이지 사진이나 블록 사진을 설명과 함께 보여 줍니다.",
      defaults: { source: "page", title: "", images: [] }
    },
    {
      type: "text", label: "텍스트·배너", icon: "doc",
      desc: "제목·본문·버튼을 한 덩어리로 강조합니다.",
      defaults: { title: "제목을 입력하세요", body: "", cta_label: "", cta_url: "", tone: "soft" }
    },
    {
      type: "table", label: "표", icon: "doc",
      desc: "머리글과 행을 가진 표를 넣습니다. 글자만 들어가 안전합니다.",
      defaults: { title: "", columns: ["항목", "내용"], rows: [["", ""]], caption: "" }
    },
    {
      type: "cta", label: "버튼/CTA", icon: "arrow",
      desc: "큰 안내 띠와 버튼 하나로 행동을 이끕니다.",
      defaults: { title: "함께해 주세요", body: "", button: "자세히 보기", url: "", tone: "accent", align: "center" }
    },
    {
      type: "embed", label: "임베드", icon: "ext",
      desc: "유튜브 영상이나 구글 드라이브 문서를 페이지에 놓습니다.",
      defaults: { url: "", title: "", height: 360 }
    }
  ];
  /* 예전 이름(posts)은 latest 로 읽습니다. */
  var LEGACY = { posts: "latest" };

  function typeDef(t) {
    var key = LEGACY[t] || t;
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].type === key) return TYPES[i];
    return null;
  }

  var idSeq = 0;
  function blockId() { idSeq += 1; return "b" + Date.now().toString(36).slice(-4) + idSeq.toString(36); }

  /* 저장된 값을 안전한 모양으로 다듬습니다(모르는 종류는 버립니다). */
  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var def = typeDef(raw.type);
    if (!def) return null;
    var src = (raw.props && typeof raw.props === "object") ? raw.props : raw;
    var p = {};
    for (var k in def.defaults) if (def.defaults.hasOwnProperty(k)) p[k] = def.defaults[k];
    for (var k2 in src) {
      if (!src.hasOwnProperty(k2)) continue;
      if (k2 === "images" || k2 === "rows" || k2 === "columns") continue;
      if (typeof src[k2] === "string") p[k2] = src[k2].slice(0, 2000);
      else if (typeof src[k2] === "number" || typeof src[k2] === "boolean") p[k2] = src[k2];
    }
    var b = {
      id: str(raw.id || "").slice(0, 40) || blockId(),
      type: def.type,
      props: p,
      hidden: raw.hidden === true,
      locked: raw.locked === true
    };
    if (def.type === "latest" || def.type === "popular") {
      p.board = str(p.board || "all").slice(0, 60) || "all";
      p.count = Math.round(clamp(p.count, 1, 12, 3));
    }
    if (def.type === "form") p.kind = (p.kind === "submit") ? "submit" : "newsletter";
    if (def.type === "gallery") {
      p.source = (p.source === "own") ? "own" : "page";
      p.images = [];
      var list = Array.isArray(src.images) ? src.images : [];
      list.slice(0, 24).forEach(function (im) {
        if (!im) return;
        var url = str(im.url || "").trim().slice(0, 800);
        if (!url) return;
        p.images.push({ url: url, caption: str(im.caption || "").trim().slice(0, 160) });
      });
    }
    if (def.type === "text") {
      p.tone = (p.tone === "dark" || p.tone === "plain") ? p.tone : "soft";
      p.cta_url = safeHref(p.cta_url);
    }
    if (def.type === "cta") {
      p.tone = (p.tone === "dark" || p.tone === "soft") ? p.tone : "accent";
      p.align = (p.align === "left") ? "left" : "center";
      p.url = safeHref(p.url);
    }
    if (def.type === "table") {
      var cols = Array.isArray(src.columns) ? src.columns : [];
      p.columns = cols.slice(0, 6).map(function (c) { return str(c).slice(0, 120); });
      if (!p.columns.length) p.columns = ["항목", "내용"];
      var rows = Array.isArray(src.rows) ? src.rows : [];
      p.rows = rows.slice(0, 60).map(function (r) {
        var arr = Array.isArray(r) ? r : (r && typeof r === "object" ? p.columns.map(function (_, i) { return r[i]; }) : []);
        var out = [];
        for (var i = 0; i < p.columns.length; i++) out.push(str(arr[i]).slice(0, 400));
        return out;
      });
    }
    if (def.type === "embed") {
      p.url = str(p.url || "").trim().slice(0, 800);
      p.height = Math.round(clamp(p.height, 200, 720, 360));
    }
    return b;
  }
  function normalizeList(list) {
    return (Array.isArray(list) ? list : []).map(normalize).filter(Boolean);
  }
  /* pages.blocks — 배열 · {v:1, items} · v 필드가 붙은 배열 모두 읽습니다. */
  function parseBlocks(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return normalizeList(raw);
    if (typeof raw === "object" && Array.isArray(raw.items)) return normalizeList(raw.items);
    return [];
  }
  function serialize(list) {
    return { v: 1, items: normalizeList(list) };
  }
  function clone(b) { return JSON.parse(JSON.stringify(b)); }

  /* ============================================================
     사이트 렌더
     ============================================================ */
  function currentPageSlug() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    return /^page\//.test(h) ? decodeURIComponent(h.slice(5)) : "";
  }
  function P(b) { return (b && b.props) || {}; }

  function renderLatest(b) {
    var p = P(b), C = window.CRAFT_CMS;
    var sec = el("section", "hm-block hm-posts");
    var rows = (C && C.recentPosts) ? C.recentPosts(p.board, p.count || 3) : [];
    var board = (C && C.boardsList) ? C.boardsList().filter(function (x) { return x.slug === p.board; })[0] : null;
    var more = p.board === "all" ? "#/news" : "#/board/" + encodeURIComponent(p.board);
    var head = '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · ' + esc(T("최신글")) + '</p>' +
      "<h2>" + esc(p.title || hT("hm.latest.title")) + "</h2></div>" +
      (rows.length ? '<a class="link-more" href="' + esc(more) + '">' + esc(board ? board.name : T("전체 글")) +
        " <svg width=\"14\" height=\"14\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>" : "") + "</div>";
    if (!rows.length) {
      sec.innerHTML = head + '<p class="hm-empty">' + esc(T("아직 이 게시판에 공개된 글이 없습니다.")) + "</p>";
      return sec;
    }
    var cards = rows.map(function (post) {
      var href = post.url || ("#/board/" + encodeURIComponent(post.boardSlug || "news"));
      var ext = post.url ? ' target="_blank" rel="noopener"' : "";
      return '<li class="hm-post"><a href="' + esc(href) + '"' + ext + ">" +
        (post.image ? '<span class="hm-post-img"><img src="' + esc(post.image) + '" alt="" loading="lazy" decoding="async"></span>' : "") +
        '<span class="hm-post-body">' +
          '<span class="hm-post-tags"><span class="tag">' + esc(post.tag || post.boardName || hT("hm.tag.news")) + "</span>" +
            (post.pinned ? '<span class="pin-badge">' + esc(T("📌 고정")) + "</span>" : "") + "</span>" +
          "<h3>" + esc(hEn(post, "title") || post.title) + "</h3>" +
          (post.summary ? "<p>" + esc(hEn(post, "summary") || post.summary) + "</p>" : "") +
          '<span class="hm-post-meta">' + esc([post.boardName, dateKo(post.date), post.source].filter(Boolean).join(" · ")) + "</span>" +
        "</span></a></li>";
    }).join("");
    sec.innerHTML = head + '<ul class="hm-post-list">' + cards + "</ul>";
    return sec;
  }

  function renderPopular(b) {
    var p = P(b), C = window.CRAFT_CMS;
    var sec = el("section", "hm-block hm-posts hm-popular");
    var rows = (C && C.popularPosts) ? C.popularPosts(p.board, p.count || 3) : [];
    var board = (C && C.boardsList) ? C.boardsList().filter(function (x) { return x.slug === p.board; })[0] : null;
    var more = p.board === "all" ? "#/news" : "#/board/" + encodeURIComponent(p.board);
    var head = '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · ' + esc(hT("hm.popular.eyebrow")) + '</p>' +
      "<h2>" + esc(p.title || hT("hm.popular.title")) + "</h2></div>" +
      (rows.length ? '<a class="link-more" href="' + esc(more) + '">' + esc(board ? board.name : hT("hm.popular.all")) +
        " <svg width=\"14\" height=\"14\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>" : "") + "</div>";
    if (!rows.length) {
      sec.innerHTML = head + '<p class="hm-empty">' + esc(hT("hm.popular.empty")) + "</p>";
      return sec;
    }
    var counted = rows.some(function (r) { return (r.views || 0) > 0; });
    var cards = rows.map(function (post, i) {
      var href = post.url || ("#/board/" + encodeURIComponent(post.boardSlug || "news"));
      var ext = post.url ? ' target="_blank" rel="noopener"' : "";
      return '<li class="hm-post"><a href="' + esc(href) + '"' + ext + ">" +
        '<span class="hm-rank">' + (i + 1) + "</span>" +
        (post.image ? '<span class="hm-post-img"><img src="' + esc(post.image) + '" alt="" loading="lazy" decoding="async"></span>' : "") +
        '<span class="hm-post-body">' +
          '<span class="hm-post-tags"><span class="tag">' + esc(post.tag || post.boardName || "") + "</span>" +
            (post.pinned ? '<span class="pin-badge">' + esc(T("📌")) + "</span>" : "") +
            (counted ? '<span class="hm-views">👁 ' + (post.views || 0) + "</span>" : "") + "</span>" +
          "<h3>" + esc(hEn(post, "title") || post.title) + "</h3>" +
          (post.summary ? "<p>" + esc(hEn(post, "summary") || post.summary) + "</p>" : "") +
          '<span class="hm-post-meta">' + esc([post.boardName, dateKo(post.date)].filter(Boolean).join(" · ")) + "</span>" +
        "</span></a></li>";
    }).join("");
    sec.innerHTML = head + (counted ? "" : '<p class="hm-views-note">' + esc(hT("hm.popular.note")) + "</p>") +
      '<ul class="hm-post-list">' + cards + "</ul>";
    return sec;
  }

  function renderMap(b) {
    var p = P(b);
    var sec = el("section", "hm-block hm-map");
    var K = window.KOREA;
    var shops = ((window.CRAFT_APP && window.CRAFT_APP.mapPlaces) ? window.CRAFT_APP.mapPlaces() : [])
      .concat((window.SITE && window.SITE.workshops) || []);
    var seen = {}, uniq = [];
    shops.forEach(function (w) {
      if (!w || !w.name || seen[w.name]) return;
      seen[w.name] = 1;
      uniq.push(w);
    });
    shops = uniq.filter(function (w) { return w.lat && w.lng; });
    var title = p.title || T("전국 공방 지도");
    sec.innerHTML = '<div class="hm-map-card"><figure class="hm-map-fig"><div class="hm-map-stage">' +
      '<svg class="hm-mini-map" viewBox="0 0 520 946" role="img" aria-label="' + esc(title) + '">' +
      '<g class="hm-mp-prov"></g><g class="hm-mp-pin"></g></svg></div></figure>' +
      '<div class="hm-map-copy"><p class="hm-eyebrow">hunmin · ' + esc(T("지도")) + '</p><h2>' + esc(title) + "</h2>" +
      (p.desc_text ? "<p>" + esc(p.desc_text) + "</p>" : "") +
      '<p class="hm-map-stat"><b>' + shops.length + "</b>" + esc(T("곳의 공방이 지도에 표시되어 있습니다.")) + "</p>" +
      '<a class="btn btn-primary btn-sm" href="#/map">' + esc(T("지도·게시판 열기")) +
      ' <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow"/></svg></a>' +
      '<p class="hm-map-note">' + esc(T("지도에서 지역을 누르면 그 지역 공방만 골라 볼 수 있습니다.")) + "</p></div></div>";
    var svg = sec.querySelector(".hm-mini-map");
    if (K && K.provinces && svg) {
      var gP = svg.querySelector(".hm-mp-prov");
      var proj = K.proj;
      function xy(lat, lng) {
        return [
          (lng - proj.lonMin) * proj.k * proj.cosMid + proj.pad,
          (proj.latMax - lat) * proj.k + proj.pad
        ];
      }
      K.provinces.forEach(function (prov) {
        var path = svgEl("path", { d: prov.d, class: "hm-prov" });
        var t = svgEl("title", {});
        t.textContent = prov.name;
        path.appendChild(t);
        path.addEventListener("click", function () {
          try { location.hash = "#/map"; } catch (e) { /* noop */ }
        });
        gP.appendChild(path);
      });
      var gPin = svg.querySelector(".hm-mp-pin");
      shops.forEach(function (w) {
        var pos = xy(w.lat, w.lng);
        var g = svgEl("g", { class: "hm-pin", transform: "translate(" + pos[0].toFixed(1) + "," + pos[1].toFixed(1) + ")" });
        var ttl = svgEl("title", {});
        ttl.textContent = w.name + " · " + w.region;
        g.appendChild(ttl);
        g.appendChild(svgEl("circle", { r: "13", class: "hm-pin-halo" }));
        g.appendChild(svgEl("circle", { r: "6.4", class: "hm-pin-core" }));
        gPin.appendChild(g);
      });
    }
    return sec;
  }

  function renderForm(b) {
    var p = P(b);
    var sec = el("section", "hm-block hm-form");
    var isNews = p.kind !== "submit";
    var button = p.button || (isNews ? T("구독하기") : T("제보 보내기"));
    var fields = isNews
      ? '<label class="hm-field"><span>' + esc(T("이메일")) + '</span><input type="email" name="email" required autocomplete="email" placeholder="name@example.com"></label>' +
        '<label class="hm-field"><span>' + esc(T("이름")) + " <em>" + esc(T("선택")) + '</em></span><input type="text" name="name" maxlength="80" autocomplete="name"></label>'
      : '<label class="hm-field"><span>' + esc(T("공방 이름")) + " <em>" + esc(T("필수")) + '</em></span><input type="text" name="title" maxlength="80" required></label>' +
        '<div class="hm-field-row">' +
          '<label class="hm-field"><span>' + esc(T("지역")) + '</span><input type="text" name="region" maxlength="40" placeholder="' + esc(T("예: 부산")) + '"></label>' +
          '<label class="hm-field"><span>' + esc(T("분야")) + '</span><input type="text" name="craft" maxlength="40" placeholder="' + esc(T("예: 도예")) + '"></label>' +
        "</div>" +
        '<div class="hm-field-row">' +
          '<label class="hm-field"><span>' + esc(T("연락처")) + '</span><input type="text" name="phone" maxlength="40" placeholder="' + esc(T("전화 또는 이메일")) + '"></label>' +
          '<label class="hm-field"><span>' + esc(T("이메일")) + '</span><input type="email" name="email" autocomplete="email" placeholder="name@example.com"></label>' +
        "</div>" +
        '<label class="hm-field"><span>' + esc(T("소개")) + " <em>" + esc(T("선택")) + '</em></span><textarea name="desc" rows="3" maxlength="1200" placeholder="' + esc(T("공방 소개와 운영 프로그램을 적어 주세요.")) + '"></textarea></label>';
    sec.innerHTML = '<div class="hm-form-card"><div class="hm-form-copy">' +
      '<p class="hm-eyebrow">hunmin · ' + esc(isNews ? T("뉴스레터 구독") : T("공방 등록·제보")) + "</p>" +
      "<h2>" + esc(p.title || (isNews ? tagline() + " " + T("뉴스레터 구독") : T("공방을 등록해 주세요"))) + "</h2>" +
      (p.desc_text ? "<p>" + esc(p.desc_text) + "</p>" : "") +
      '</div><form class="hm-form-body" novalidate>' + fields +
      '<button type="submit" class="btn btn-primary">' + esc(button) + "</button>" +
      '<p class="hm-form-note">' + esc(isNews ? T("입력하신 이메일은 뉴스레터 발송에만 사용합니다.") : T("적어 주신 내용은 공방 등록·제보 검토에만 사용합니다.")) + "</p>" +
      '<p class="hm-form-msg" role="status" aria-live="polite"></p></form></div>';
    var form = sec.querySelector("form");
    var msg = sec.querySelector(".hm-form-msg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      var data = {};
      [].forEach.call(form.querySelectorAll("input,textarea"), function (n) {
        if (n.name) data[n.name] = (n.value || "").trim();
      });
      var CFG = window.CRAFT_SUPABASE || {};
      if (!CFG.url) { msg.textContent = T("지금은 접수할 수 없습니다. 잠시 뒤 다시 시도해 주세요."); return; }
      if (isNews && !data.email) { msg.textContent = T("이메일 주소를 입력해 주세요."); return; }
      if (!isNews && !data.title) { msg.textContent = T("공방 이름을 입력해 주세요."); return; }
      var payload = {};
      Object.keys(data).forEach(function (k) { if (k !== "email" && k !== "name") payload[k] = data[k]; });
      btn.disabled = true;
      msg.className = "hm-form-msg";
      msg.textContent = T("보내는 중…");
      fetch(CFG.url + "/rest/v1/rpc/submit_form", {
        method: "POST",
        headers: {
          apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_kind: isNews ? "newsletter" : "submit",
          p_email: data.email || null,
          p_name: data.name || data.title || null,
          p_payload: payload,
          p_page: currentPageSlug() || null
        })
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
        return r.json();
      }).then(function () {
        btn.disabled = false;
        form.reset();
        msg.className = "hm-form-msg ok";
        msg.textContent = isNews ? T("구독 신청을 받았습니다. 다음 편부터 보내 드릴게요.") : T("제보를 받았습니다. 확인 후 연락드리겠습니다.");
      }).catch(function () {
        btn.disabled = false;
        msg.className = "hm-form-msg err";
        msg.textContent = T("보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      });
    });
    return sec;
  }

  function renderGallery(b, page) {
    var p = P(b);
    var sec = el("section", "hm-block hm-gallery");
    var list = (p.source === "page")
      ? ((page && Array.isArray(page.images)) ? page.images : [])
      : (p.images || []);
    list = (list || []).filter(function (im) { return im && im.url; });
    var head = (p.title || list.length) ? '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · ' + esc(T("갤러리")) + '</p>' +
      (p.title ? "<h2>" + esc(p.title) + "</h2>" : "") + "</div></div>" : "";
    if (!list.length) {
      if (!p.title) return null;
      sec.innerHTML = head + '<p class="hm-empty">' + esc(T("아직 사진이 없습니다.")) + "</p>";
      return sec;
    }
    sec.innerHTML = head + '<div class="hm-gallery-grid">' + list.map(function (im) {
      return '<figure><img src="' + esc(absUrl(im.url)) + '" alt="' + esc(im.caption || "") + '" loading="lazy" decoding="async">' +
        (im.caption ? "<figcaption>" + esc(im.caption) + "</figcaption>" : "") + "</figure>";
    }).join("") + "</div>";
    return sec;
  }

  function renderText(b) {
    var p = P(b);
    var sec = el("section", "hm-block hm-text tone-" + (p.tone || "soft"));
    var body = str(p.body).split(/\n{2,}/).filter(Boolean).map(function (para) {
      return "<p>" + esc(para).replace(/\n/g, "<br>") + "</p>";
    }).join("");
    var cta = "";
    if (p.cta_label && safeHref(p.cta_url)) {
      var ext = /^https:\/\//i.test(p.cta_url) ? ' target="_blank" rel="noopener"' : "";
      cta = '<a class="btn ' + (p.tone === "dark" ? "btn-accent" : "btn-primary") + '" href="' +
        esc(safeHref(p.cta_url)) + '"' + ext + ">" + esc(p.cta_label) +
        ' <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow"/></svg></a>';
    }
    sec.innerHTML = '<div class="hm-text-in"><p class="hm-eyebrow">hunmin · ' +
      esc(p.tone === "dark" ? T("배너") : T("텍스트")) + "</p><h2>" + esc(p.title) + "</h2>" +
      (body ? '<div class="hm-text-body">' + body + "</div>" : "") +
      (cta ? '<div class="hm-text-cta">' + cta + "</div>" : "") + "</div>";
    return sec;
  }

  function renderTable(b) {
    var p = P(b);
    var sec = el("section", "hm-block hm-table");
    var title = p.title ? '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · ' + esc(T("표")) +
      "</p><h2>" + esc(p.title) + "</h2></div></div>" : "";
    var cols = (p.columns || []).filter(function (c) { return str(c).trim() !== ""; });
    if (!cols.length) cols = [T("항목"), T("내용")];
    var rows = (p.rows || []).filter(function (r) { return r && r.some(function (c) { return str(c).trim() !== ""; }); });
    var head = '<thead><tr>' + cols.map(function (c) {
      return '<th scope="col">' + esc(c) + "</th>";
    }).join("") + "</tr></thead>";
    var bodyRows = rows.map(function (r) {
      return "<tr>" + cols.map(function (_, i) {
        var cell = str(r[i] != null ? r[i] : "");
        return "<td>" + esc(cell).replace(/\n/g, "<br>") + "</td>";
      }).join("") + "</tr>";
    }).join("");
    sec.innerHTML = title + '<div class="hm-table-wrap"><table class="hm-table">' +
      (p.head === false ? "" : head) + "<tbody>" + bodyRows + "</tbody></table></div>" +
      (p.caption ? '<p class="hm-table-cap">' + esc(p.caption) + "</p>" : "") +
      (!rows.length ? '<p class="hm-empty">' + esc(T("표에 넣을 내용이 없습니다.")) + "</p>" : "");
    return sec;
  }

  function renderCta(b) {
    var p = P(b);
    var sec = el("section", "hm-block hm-cta tone-" + (p.tone || "accent") + " align-" + (p.align || "center"));
    var href = safeHref(p.url);
    var btn = (p.button && href)
      ? '<a class="btn btn-primary hm-cta-btn" href="' + esc(href) + '"' +
        (/^https:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(p.button) +
        ' <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow"/></svg></a>'
      : "";
    var body = str(p.body).split(/\n{2,}/).filter(Boolean).map(function (para) {
      return "<p>" + esc(para).replace(/\n/g, "<br>") + "</p>";
    }).join("");
    sec.innerHTML = '<div class="hm-cta-in"><p class="hm-eyebrow">hunmin · ' + esc(T("버튼/CTA")) + "</p>" +
      "<h2>" + esc(p.title) + "</h2>" + (body ? '<div class="hm-cta-body">' + body + "</div>" : "") +
      (btn ? '<div class="hm-cta-act">' + btn + "</div>" : "") + "</div>";
    return sec;
  }

  function renderEmbed(b) {
    var p = P(b);
    var sec = el("section", "hm-block hm-embed");
    var info = embedInfo(p.url);
    var title = p.title || (info.ok ? (info.provider === "youtube" ? "YouTube" : "Google Drive") : T("임베드"));
    if (!info.ok) {
      var msg = !p.url ? "" : ('<p class="hm-embed-note">' + esc(T("유튜브·구글 드라이브(문서) 주소만 넣을 수 있습니다.")) + "</p>");
      sec.innerHTML = '<div class="hm-embed-head"><p class="hm-eyebrow">hunmin · ' + esc(T("임베드")) + "</p>" +
        "<h2>" + esc(title) + "</h2></div>" +
        '<div class="hm-embed-empty"><p>' + esc(T("미리보기를 표시할 수 없습니다.")) + "</p>" + msg + "</div>";
      return sec;
    }
    sec.innerHTML = '<div class="hm-embed-head"><p class="hm-eyebrow">hunmin · ' + esc(T("임베드")) + "</p>" +
      "<h2>" + esc(title) + "</h2></div>" +
      '<div class="hm-embed-frame" style="--hm-embed-h:' + p.height + 'px">' +
      '<iframe src="' + esc(info.src) + '" title="' + esc(title) + '" loading="lazy" allowfullscreen ' +
      'referrerpolicy="strict-origin-when-cross-origin" ' +
      'sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe></div>';
    return sec;
  }

  /* 페이지의 블록을 순서대로 그립니다. 그린 블록 수를 돌려줍니다. */
  function render(container, page) {
    if (!container) return 0;
    container.innerHTML = "";
    var blocks = parseBlocks(page && page.blocks);
    var drawn = 0;
    blocks.forEach(function (b) {
      if (b.hidden) return;
      var node = null;
      try {
        if (b.type === "latest") node = renderLatest(b);
        else if (b.type === "popular") node = renderPopular(b);
        else if (b.type === "map") node = renderMap(b);
        else if (b.type === "form") node = renderForm(b);
        else if (b.type === "gallery") node = renderGallery(b, page);
        else if (b.type === "text") node = renderText(b);
        else if (b.type === "table") node = renderTable(b);
        else if (b.type === "cta") node = renderCta(b);
        else if (b.type === "embed") node = renderEmbed(b);
      } catch (e) { node = null; }
      if (node) { node.setAttribute("data-block", b.type); container.appendChild(node); drawn++; }
    });
    container.hidden = drawn === 0;
    return drawn;
  }

  /* ============================================================
     관리자 편집기 — 드래그 정렬 · 복제/숨김/잠금 · 실행 취소 20단계 · 미리보기
     ============================================================ */
  var editorState = {
    root: null, list: null, blocks: [], opts: {},
    undo: [], redo: [], limit: HISTORY_LIMIT,
    drag: null, pending: null, previewTimer: null
  };

  function edEsc(s) { return esc(s); }

  function snapshot() { return JSON.stringify(normalizeList(editorState.blocks)); }

  function pushHistory(before) {
    if (before == null) return;
    var undo = editorState.undo;
    undo.push(before);
    while (undo.length > editorState.limit) undo.shift();
    editorState.redo = [];
    paintHistory();
  }

  function paintHistory() {
    var root = editorState.root;
    if (!root) return;
    var u = root.querySelector("[data-hmundo]");
    var r = root.querySelector("[data-hmredo]");
    if (u) { u.disabled = !editorState.undo.length; u.setAttribute("data-count", String(editorState.undo.length)); }
    if (r) { r.disabled = !editorState.redo.length; r.setAttribute("data-count", String(editorState.redo.length)); }
    var n = root.querySelector("[data-hmcount]");
    if (n) n.textContent = editorState.blocks.length + " / 9";
  }

  function field(label, name, value, opts) {
    opts = opts || {};
    var id = "hmf-" + name + "-" + Math.random().toString(36).slice(2, 7);
    var dis = opts.disabled ? " disabled" : "";
    var input;
    if (opts.textarea) {
      input = '<textarea id="' + id + '" data-hmf="' + name + '" rows="' + (opts.rows || 2) + '" maxlength="' +
        (opts.maxlength || 2000) + '" placeholder="' + edEsc(opts.placeholder || "") + '"' + dis + ">" + edEsc(value) + "</textarea>";
    } else if (opts.select) {
      input = '<select id="' + id + '" data-hmf="' + name + '"' + dis + ">" + opts.select.map(function (o) {
        return '<option value="' + edEsc(o[0]) + '"' + (String(o[0]) === String(value) ? " selected" : "") + ">" +
          edEsc(o[1]) + "</option>";
      }).join("") + "</select>";
    } else {
      input = '<input id="' + id + '" data-hmf="' + name + '" type="' + (opts.type || "text") + '" value="' + edEsc(value) +
        '" maxlength="' + (opts.maxlength || 200) + '" placeholder="' + edEsc(opts.placeholder || "") + '"' + dis + ">";
    }
    return '<label class="hm-field"><span>' + label + "</span>" + input + "</label>";
  }

  /* 표 편집기 — 머리글은 쉼표, 행은 한 줄에 "값 | 값" 으로 적습니다. */
  function tableEditor(p, disabled) {
    var cols = (p.columns || []).join(", ");
    var rows = (p.rows || []).map(function (r) { return (r || []).join(" | "); }).join("\n");
    return '<div class="hm-grid2">' +
      field("머리글 <em>쉼표로 구분</em>", "columns_text", cols,
        { maxlength: 300, disabled: disabled, placeholder: "항목, 내용" }) +
      field("표 설명 <em>선택</em>", "caption", p.caption, { maxlength: 200, disabled: disabled }) +
      "</div>" +
      field("행 <em>한 줄에 값 | 값</em>", "rows_text", rows,
        { textarea: true, rows: 4, maxlength: 4000, disabled: disabled, placeholder: "가죽공방 | 서울\n도자기공방 | 경기" });
  }

  function blockFields(b, i, opts) {
    var p = b.props || {};
    var dis = !!b.locked;
    if (b.type === "latest" || b.type === "popular") {
      var boards = [["all", "전체 게시판"]].concat((opts.boards || []).map(function (x) { return [x.slug, x.name]; }));
      return '<div class="hm-grid2">' +
        field("게시판", "board", p.board, { select: boards, disabled: dis }) +
        field("글 수", "count", p.count, { select: [["3", "3개"], ["6", "6개"], ["9", "9개"]], disabled: dis }) +
        "</div>" + field("제목", "title", p.title, { maxlength: 80, disabled: dis, placeholder: b.type === "popular" ? "인기글" : "최신 소식" });
    }
    if (b.type === "map") {
      return field("제목", "title", p.title, { maxlength: 80, disabled: dis }) +
        field("설명 <em>선택</em>", "desc_text", p.desc_text, { textarea: true, maxlength: 300, disabled: dis });
    }
    if (b.type === "form") {
      return '<div class="hm-grid2">' +
        field("폼 종류", "kind", p.kind, {
          select: [["newsletter", "뉴스레터 구독"], ["submit", "공방 등록·제보"]], disabled: dis
        }) +
        field("버튼 글자", "button", p.button, { maxlength: 30, disabled: dis, placeholder: "구독하기" }) +
        "</div>" + field("제목", "title", p.title, { maxlength: 80, disabled: dis }) +
        field("설명", "desc_text", p.desc_text, { textarea: true, maxlength: 300, disabled: dis });
    }
    if (b.type === "gallery") {
      var imgs = "";
      if (p.source === "own") {
        imgs = '<div class="hm-imgs">' + (p.images || []).map(function (im, k) {
          return '<div class="hm-img-row"><span class="hm-img-thumb">' +
            (im.url ? '<img src="' + edEsc(absUrl(im.url)) + '" alt="">' : "") + "</span>" +
            '<input class="admin-input" data-hmi="url" data-i="' + k + '" value="' + edEsc(im.url) + '" placeholder="이미지 주소(URL)"' + (dis ? " disabled" : "") + ">" +
            '<input class="admin-input" data-hmi="caption" data-i="' + k + '" value="' + edEsc(im.caption) + '" placeholder="설명" maxlength="160"' + (dis ? " disabled" : "") + ">" +
            '<button type="button" class="mini" data-hmimg="up" data-i="' + k + '"' + (dis || k === 0 ? " disabled" : "") + ">↑</button>" +
            '<button type="button" class="mini" data-hmimg="down" data-i="' + k + '"' + (dis || k === p.images.length - 1 ? " disabled" : "") + ">↓</button>" +
            '<button type="button" class="mini" data-hmimg="del" data-i="' + k + '"' + (dis ? " disabled" : "") + ">삭제</button></div>";
        }).join("") + "</div>" +
          '<div class="hm-img-tools"><input type="file" accept="image/*" multiple class="sr-only" data-hmimgfile="1" id="hm-file-' + i + '"' + (dis ? " disabled" : "") + ">" +
          '<label for="hm-file-' + i + '" class="btn btn-ghost btn-sm">사진 올리기</label>' +
          '<input class="admin-input" data-hmimgurl="1" placeholder="또는 이미지 주소(URL)"' + (dis ? " disabled" : "") + ">" +
          '<button type="button" class="btn btn-ghost btn-sm" data-hmimgadd="1"' + (dis ? " disabled" : "") + ">주소로 추가</button></div>";
      }
      return '<div class="hm-grid2">' +
        field("사진", "source", p.source, { select: [["page", "이 페이지 사진 사용"], ["own", "블록 전용 사진"]], disabled: dis }) +
        field("제목 <em>선택</em>", "title", p.title, { maxlength: 80, disabled: dis }) +
        "</div>" + imgs;
    }
    if (b.type === "text") {
      return field("제목", "title", p.title, { maxlength: 100, disabled: dis }) +
        field("본문", "body", p.body, { textarea: true, rows: 3, maxlength: 1200, disabled: dis, placeholder: "줄바꿈 그대로 표시됩니다." }) +
        '<div class="hm-grid3">' +
        field("버튼 글자", "cta_label", p.cta_label, { maxlength: 30, disabled: dis, placeholder: "선택" }) +
        field("버튼 링크", "cta_url", p.cta_url, { maxlength: 500, disabled: dis, placeholder: "#/map 또는 https://" }) +
        field("모양", "tone", p.tone, { select: [["soft", "밝은 배너"], ["dark", "어두운 배너"], ["plain", "텍스트만"]], disabled: dis }) +
        "</div>";
    }
    if (b.type === "table") {
      return field("제목 <em>선택</em>", "title", p.title, { maxlength: 80, disabled: dis }) + tableEditor(p, dis);
    }
    if (b.type === "cta") {
      return field("제목", "title", p.title, { maxlength: 100, disabled: dis }) +
        field("본문", "body", p.body, { textarea: true, rows: 2, maxlength: 800, disabled: dis }) +
        '<div class="hm-grid3">' +
        field("버튼 글자", "button", p.button, { maxlength: 30, disabled: dis }) +
        field("버튼 링크", "url", p.url, { maxlength: 500, disabled: dis, placeholder: "#/map 또는 https://" }) +
        field("모양", "tone", p.tone, { select: [["accent", "포인트 색"], ["dark", "어두운 띠"], ["soft", "밝은 띠"]], disabled: dis }) +
        "</div>" +
        field("정렬", "align", p.align, { select: [["center", "가운데"], ["left", "왼쪽"]], disabled: dis });
    }
    if (b.type === "embed") {
      return field("주소 <em>유튜브 · 구글 드라이브/문서</em>", "url", p.url,
        { maxlength: 500, disabled: dis, placeholder: "https://www.youtube.com/watch?v=…" }) +
        '<div class="hm-grid2">' +
        field("제목 <em>선택</em>", "title", p.title, { maxlength: 80, disabled: dis }) +
        field("높이(px)", "height", p.height, { type: "number", disabled: dis }) +
        "</div>" +
        '<p class="hm-embed-help">유튜브 영상(주소·공유 링크)과 구글 드라이브 파일·문서·시트·슬라이드·설문 주소만 미리보기로 바뀝니다. 그 밖의 주소는 저장되지 않습니다.</p>';
    }
    return "";
  }

  function typeLabel(b) {
    var def = typeDef(b.type);
    return def ? def.label : b.type;
  }

  function renderEditor() {
    var root = editorState.root;
    if (!root) return;
    var blocks = editorState.blocks;
    var opts = editorState.opts;
    var html = "";
    html += '<div class="hm-toolbar">' +
      '<button type="button" class="mini" data-hmundo aria-label="실행 취소">↶ <span>실행 취소</span></button>' +
      '<button type="button" class="mini" data-hmredo aria-label="다시 실행">↷ <span>다시 실행</span></button>' +
      '<span class="hm-toolbar-count" data-hmcount>' + blocks.length + " / 9</span>" +
      '<span class="hm-toolbar-hint">블록을 끌어(또는 ↑↓) 순서를 바꿉니다 · 실행 취소 20단계</span>' +
      "</div>";
    html += '<p class="hm-sr" role="status" aria-live="polite" data-hmlive></p>';
    if (!blocks.length) {
      html += '<p class="hm-empty-editor">아직 hunmin 블록이 없습니다. 아래에서 골라 추가하면 페이지 본문 위에 순서대로 나타납니다.</p>';
    }
    html += '<div class="hm-block-list" role="list" data-hmlist>' + blocks.map(function (b, i) {
      var def = typeDef(b.type) || { label: b.type, icon: "doc" };
      var cls = "hm-block-card" + (b.hidden ? " is-hidden" : "") + (b.locked ? " is-locked" : "");
      return '<article class="' + cls + '" data-i="' + i + '" data-id="' + edEsc(b.id) + '" data-type="' + edEsc(b.type) + '" role="listitem" ' +
        'aria-label="' + (i + 1) + "번째 블록 — " + edEsc(def.label) + '">' +
        '<header class="hm-block-head">' +
          '<button type="button" class="hm-drag" data-hmdrag aria-label="' + (i + 1) + '번째 블록 끌어서 순서 바꾸기">⣿</button>' +
          '<span class="hm-block-no">' + (i + 1) + "</span>" +
          '<span class="hm-block-type"><svg width="15" height="15" aria-hidden="true"><use href="#i-' + edEsc(def.icon) + '"/></svg>' +
            edEsc(def.label) + ' <code>' + edEsc(b.type) + "</code>" +
            (b.hidden ? ' <span class="hm-state">숨김</span>' : "") +
            (b.locked ? ' <span class="hm-state lock">잠금</span>' : "") + "</span>" +
          '<span class="hm-block-tools">' +
            '<button type="button" class="mini" data-hm="dup" data-i="' + i + '"' + (b.locked ? " disabled" : "") + ' aria-label="' + (i + 1) + '번째 블록 복제">복제</button>' +
            '<button type="button" class="mini" data-hm="hide" data-i="' + i + '"' + (b.locked ? " disabled" : "") + ' aria-pressed="' + (b.hidden ? "true" : "false") + '" aria-label="' + (i + 1) + '번째 블록 숨김">' + (b.hidden ? "보이기" : "숨김") + "</button>" +
            '<button type="button" class="mini" data-hm="lock" data-i="' + i + '" aria-pressed="' + (b.locked ? "true" : "false") + '" aria-label="' + (i + 1) + '번째 블록 잠금">' + (b.locked ? "풀기" : "잠금") + "</button>" +
            '<button type="button" class="mini" data-hm="up" data-i="' + i + '"' + (i === 0 || b.locked ? " disabled" : "") + ' aria-label="' + (i + 1) + '번째 블록 위로">↑</button>' +
            '<button type="button" class="mini" data-hm="down" data-i="' + i + '"' + (i === blocks.length - 1 || b.locked ? " disabled" : "") + ' aria-label="' + (i + 1) + '번째 블록 아래로">↓</button>' +
            '<button type="button" class="mini danger" data-hm="del" data-i="' + i + '"' + (b.locked ? " disabled" : "") + ' aria-label="' + (i + 1) + '번째 블록 삭제">삭제</button>' +
          "</span></header>" +
        '<div class="hm-block-body"' + (b.locked ? ' aria-disabled="true"' : "") + '>' + blockFields(b, i, opts) + "</div></article>";
    }).join("") + "</div>";
    html += '<div class="hm-add"><span class="hm-add-label">hunmin 블록 추가</span>' +
      TYPES.map(function (t) {
        return '<button type="button" class="hm-add-btn" data-hmadd="' + t.type + '" title="' + edEsc(t.desc) + '">' +
          '<svg width="15" height="15" aria-hidden="true"><use href="#i-' + t.icon + '"/></svg>' + edEsc(t.label) + "</button>";
      }).join("") + "</div>";
    root.innerHTML = html;
    editorState.list = root.querySelector("[data-hmlist]");
    paintHistory();
  }

  function changed(opts) {
    if (editorState.opts.onChange) editorState.opts.onChange(editorState.blocks);
    schedulePreview();
  }

  function live(text) {
    var n = editorState.root && editorState.root.querySelector("[data-hmlive]");
    if (n) n.textContent = text;
  }

  function schedulePreview() {
    var box = editorState.opts.preview;
    if (!box) return;
    if (editorState.previewTimer) clearTimeout(editorState.previewTimer);
    editorState.previewTimer = setTimeout(function () {
      try {
        var page = editorState.opts.page || {};
        var pg = { images: page.images || [], blocks: serialize(editorState.blocks) };
        render(box, pg);
      } catch (e) { /* 미리보기는 실패해도 편집을 막지 않습니다 */ }
    }, 60);
  }

  /* -------- 표 입력값을 다시 블록에 담습니다 -------- */
  function applyTableText(p) {
    var cols = String(p.columns_text || "").split(",").map(function (c) { return c.trim(); }).filter(Boolean);
    p.columns = cols.length ? cols.slice(0, 6) : ["항목", "내용"];
    var rows = String(p.rows_text || "").split(/\n/).filter(function (line) { return line.trim() !== ""; });
    p.rows = rows.slice(0, 60).map(function (line) {
      var cells = line.split("|").map(function (c) { return c.trim(); });
      var out = [];
      for (var i = 0; i < p.columns.length; i++) out.push(cells[i] != null ? cells[i] : "");
      return out;
    });
  }

  function bindEditor() {
    var root = editorState.root;
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    /* ---- 텍스트 입력 ---- */
    function onEdit(t) {
      var card = t.closest ? t.closest(".hm-block-card") : null;
      var i = card ? +card.getAttribute("data-i") : -1;
      var b = editorState.blocks[i];
      if (!b) return;
      var key = t.getAttribute("data-hmf");
      if (b.type === "table" && (key === "columns_text" || key === "rows_text")) {
        b.props[key] = t.value;
        applyTableText(b.props);
        changed();
        return;
      }
      b.props[key] = (key === "count" || key === "height") ? (parseInt(t.value, 10) || 0) : t.value;
      if (key === "cta_url" || key === "url") b.props[key] = safeHref(t.value);
      changed();
    }
    /* 입력은 700ms 쉬면 한 단계로 기록합니다(타자마다 20단계를 쓰지 않게). */
    function queueTextHistory() {
      if (editorState.pending) return;
      editorState.pending = snapshot();
      clearTimeout(queueTextHistory.t);
      queueTextHistory.t = setTimeout(function () {
        var before = editorState.pending;
        editorState.pending = null;
        pushHistory(before);
      }, 700);
    }

    root.addEventListener("input", function (e) {
      var t = e.target;
      if (!t.hasAttribute) return;
      if (t.hasAttribute("data-hmf")) {
        var b = editorState.blocks[+((t.closest(".hm-block-card") || {}).getAttribute ? t.closest(".hm-block-card").getAttribute("data-i") : -1)];
        if (b && b.locked) return;
        queueTextHistory();
        onEdit(t);
        return;
      }
      if (t.hasAttribute("data-hmi")) {
        var card2 = t.closest(".hm-block-card");
        var i2 = card2 ? +card2.getAttribute("data-i") : -1;
        var b2 = editorState.blocks[i2];
        if (!b2 || b2.type !== "gallery" || b2.locked) return;
        var k = +t.getAttribute("data-i");
        if (!b2.props.images[k]) return;
        queueTextHistory();
        b2.props.images[k][t.getAttribute("data-hmi")] = t.value;
        changed();
      }
    });

    root.addEventListener("change", function (e) {
      var t = e.target;
      if (!t.hasAttribute) return;
      if (t.hasAttribute("data-hmf")) {
        var card = t.closest(".hm-block-card");
        var i = card ? +card.getAttribute("data-i") : -1;
        var b = editorState.blocks[i];
        if (!b || b.locked) return;
        var before = snapshot();
        var key = t.getAttribute("data-hmf");
        if (b.type === "gallery" && key === "source") {
          b.props.source = t.value === "own" ? "own" : "page";
          pushHistory(before);
          renderEditor();
          changed();
          return;
        }
        if (b.type === "table") { b.props[key] = t.value; applyTableText(b.props); }
        else b.props[key] = (key === "count" || key === "height") ? (parseInt(t.value, 10) || 0) : t.value;
        pushHistory(before);
        changed();
        return;
      }
      if (t.hasAttribute("data-hmimgfile")) {
        var card3 = t.closest(".hm-block-card");
        var i3 = card3 ? +card3.getAttribute("data-i") : -1;
        var b3 = editorState.blocks[i3];
        if (!b3 || b3.type !== "gallery" || b3.locked) return;
        var files = [].slice.call(t.files || []);
        if (!files.length) return;
        var upload = editorState.opts.upload;
        if (!upload) return;
        var before3 = snapshot();
        var chain = Promise.resolve();
        files.forEach(function (f) {
          chain = chain.then(function () {
            return upload(f).then(function (url) {
              b3.props.images.push({ url: url, caption: "" });
              renderEditor();
              changed();
            });
          });
        });
        chain.then(function () { pushHistory(before3); t.value = ""; });
      }
    });

    /* ---- 버튼 ---- */
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var undo = e.target.closest("[data-hmundo]");
      if (undo) { doUndo(); return; }
      var redo = e.target.closest("[data-hmredo]");
      if (redo) { doRedo(); return; }
      var add = e.target.closest("[data-hmadd]");
      if (add) {
        var def = typeDef(add.getAttribute("data-hmadd"));
        if (!def) return;
        var before = snapshot();
        var b = normalize({ type: def.type, props: clone(def.defaults) });
        b.id = blockId();
        editorState.blocks.push(b);
        pushHistory(before);
        renderEditor();
        changed();
        live(typeLabel(b) + " 블록을 " + editorState.blocks.length + "번째로 추가했습니다.");
        return;
      }
      var act = e.target.closest("[data-hm]");
      if (act) {
        var i = +act.getAttribute("data-i");
        var list = editorState.blocks;
        var b2 = list[i];
        if (!b2) return;
        var what = act.getAttribute("data-hm");
        var before2 = snapshot();
        if (what === "del") {
          if (b2.locked) return;
          list.splice(i, 1);
          live("블록을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.");
        } else if (what === "dup") {
          if (b2.locked) return;
          var copy = normalize(clone(b2));
          copy.id = blockId();
          copy.locked = false;
          list.splice(i + 1, 0, copy);
          live(typeLabel(b2) + " 블록을 복제했습니다.");
        } else if (what === "hide") {
          if (b2.locked) return;
          b2.hidden = !b2.hidden;
          live(b2.hidden ? "블록을 숨겼습니다. 사이트에는 나오지 않습니다." : "블록을 다시 보이게 했습니다.");
        } else if (what === "lock") {
          b2.locked = !b2.locked;
          live(b2.locked ? "블록을 잠갔습니다. 풀기 전에는 고칠 수 없습니다." : "블록 잠금을 풀었습니다.");
        } else {
          if (b2.locked) return;
          var j = i + (what === "up" ? -1 : 1);
          if (j < 0 || j >= list.length) return;
          var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
          live((i + 1) + "번째 블록을 " + (j + 1) + "번째로 옮겼습니다.");
        }
        pushHistory(before2);
        renderEditor();
        changed();
        return;
      }
      var img = e.target.closest("[data-hmimg]");
      if (img) {
        var card = img.closest(".hm-block-card");
        var bi = card ? +card.getAttribute("data-i") : -1;
        var gb = editorState.blocks[bi];
        if (!gb || gb.type !== "gallery" || gb.locked) return;
        var k = +img.getAttribute("data-i");
        var before4 = snapshot();
        var act2 = img.getAttribute("data-hmimg");
        if (act2 === "del") gb.props.images.splice(k, 1);
        else {
          var k2 = k + (act2 === "up" ? -1 : 1);
          if (k2 < 0 || k2 >= gb.props.images.length) return;
          var t2 = gb.props.images[k]; gb.props.images[k] = gb.props.images[k2]; gb.props.images[k2] = t2;
        }
        pushHistory(before4);
        renderEditor();
        changed();
        return;
      }
      var add2 = e.target.closest("[data-hmimgadd]");
      if (add2) {
        var card4 = add2.closest(".hm-block-card");
        var bi2 = card4 ? +card4.getAttribute("data-i") : -1;
        var b4 = editorState.blocks[bi2];
        var input = card4 ? card4.querySelector("[data-hmimgurl]") : null;
        if (!b4 || !input || b4.locked) return;
        var url = (input.value || "").trim();
        if (!url) { input.focus(); return; }
        var before5 = snapshot();
        b4.props.images.push({ url: url, caption: "" });
        pushHistory(before5);
        renderEditor();
        changed();
      }
    });

    /* ---- 드래그(포인터 이벤트 · 모바일 터치 포함) ---- */
    root.addEventListener("pointerdown", function (e) {
      var handle = e.target.closest ? e.target.closest("[data-hmdrag]") : null;
      if (!handle || (e.button && e.button !== 0)) return;
      var card = handle.closest(".hm-block-card");
      if (!card) return;
      var i = +card.getAttribute("data-i");
      var b = editorState.blocks[i];
      if (!b || b.locked) return;
      e.preventDefault();
      editorState.drag = {
        card: card, startIndex: i, before: snapshot(), moved: false,
        pointerId: e.pointerId, type: e.pointerType || "mouse"
      };
      card.classList.add("is-dragging");
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      live(typeLabel(b) + " 블록을 끌고 있습니다.");
    });

    /* 포인터 아래 카드 — 화면 밖으로 나가면 가장 가까운 카드를 씁니다(긴 목록에서도 끌 수 있게). */
    function cardAt(x, y) {
      var list = editorState.list;
      if (!list) return null;
      var over = document.elementFromPoint(x, y);
      var card = over && over.closest ? over.closest(".hm-block-card") : null;
      if (card && list.contains(card)) return card;
      var best = null, bestD = Infinity;
      [].slice.call(list.children).forEach(function (n) {
        var r = n.getBoundingClientRect();
        var dy = Math.max(r.top - y, 0, y - r.bottom);
        var dx = Math.max(r.left - x, 0, x - r.right);
        var d = dy * 4 + dx + Math.abs(y - (r.top + r.bottom) / 2) * 0.1;
        if (d < bestD) { bestD = d; best = n; }
      });
      return best;
    }

    root.addEventListener("pointermove", function (e) {
      var d = editorState.drag;
      if (!d) return;
      if (e.pointerId != null && d.pointerId != null && e.pointerId !== d.pointerId) return;
      if (e.cancelable) e.preventDefault();
      var list = editorState.list;
      if (!list) return;
      var card = cardAt(e.clientX, e.clientY);
      if (!card || card === d.card || !list.contains(card)) return;
      var rect = card.getBoundingClientRect();
      var after = (e.clientY - rect.top) > rect.height / 2;
      var next = after ? card.nextSibling : card;
      if (next === d.card) return;
      list.insertBefore(d.card, next);
      d.moved = true;
      /* 모델 순서도 화면 순서대로 다시 맞춥니다. */
      var order = [].slice.call(list.children).map(function (n) {
        return editorState.blocks[+n.getAttribute("data-i")];
      }).filter(Boolean);
      var ids = {};
      order.forEach(function (x) { ids[x.id] = 1; });
      editorState.blocks.forEach(function (x) { if (!ids[x.id]) order.push(x); });
      editorState.blocks = order;
      [].slice.call(list.children).forEach(function (n, idx) {
        n.setAttribute("data-i", idx);
        var no = n.querySelector(".hm-block-no");
        if (no) no.textContent = idx + 1;
      });
      changed();
    });

    function endDrag(e) {
      var d = editorState.drag;
      if (!d) return;
      editorState.drag = null;
      d.card.classList.remove("is-dragging");
      if (d.moved) {
        pushHistory(d.before);
        renderEditor();
        changed();
        live("블록 순서를 바꿨습니다. 새로 저장하면 페이지에 그대로 반영됩니다.");
      }
    }
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);

    /* ---- 키보드: Ctrl+Z / Ctrl+Shift+Z ---- */
    root.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = String(e.key || "").toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
      } else if (k === "y") {
        e.preventDefault();
        doRedo();
      }
    });
  }

  function doUndo() {
    if (!editorState.undo.length) return false;
    var before = snapshot();
    var prev = editorState.undo.pop();
    editorState.redo.push(before);
    while (editorState.redo.length > editorState.limit) editorState.redo.shift();
    editorState.blocks = normalizeList(JSON.parse(prev));
    renderEditor();
    changed();
    live("실행 취소 — 남은 되돌리기 " + editorState.undo.length + "단계");
    return true;
  }

  function doRedo() {
    if (!editorState.redo.length) return false;
    var cur = snapshot();
    var next = editorState.redo.pop();
    editorState.undo.push(cur);
    while (editorState.undo.length > editorState.limit) editorState.undo.shift();
    editorState.blocks = normalizeList(JSON.parse(next));
    renderEditor();
    changed();
    live("다시 실행 — 남은 다시 실행 " + editorState.redo.length + "단계");
    return true;
  }

  var editor = {
    mount: function (container, blocks, options) {
      editorState.root = container;
      editorState.blocks = parseBlocks(blocks).map(clone);
      editorState.opts = options || {};
      editorState.limit = Math.max(1, Math.min(50, parseInt(editorState.opts.historyLimit, 10) || HISTORY_LIMIT));
      editorState.undo = [];
      editorState.redo = [];
      editorState.drag = null;
      editorState.pending = null;
      if (container) container.dataset.bound = "";
      bindEditor();
      renderEditor();
      schedulePreview();
      return editorState.blocks;
    },
    blocks: function () { return editorState.blocks; },
    serialize: function () { return serialize(editorState.blocks); },
    render: renderEditor,
    preview: schedulePreview,
    undo: doUndo,
    redo: doRedo,
    history: function () {
      return { undo: editorState.undo.length, redo: editorState.redo.length, limit: editorState.limit };
    }
  };

  window.CRAFT_HUNMIN = {
    name: "hunmin",
    version: VERSION,
    types: TYPES,
    normalize: normalize,
    normalizeList: normalizeList,
    parseBlocks: parseBlocks,
    serialize: serialize,
    embedInfo: embedInfo,
    render: render,
    editor: editor
  };
})();
