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
  var SC = window.SBPRESS_CONFIG || {};
  var SBP = window.SBP || null;
  function feature(name) {
    if (SBP && SBP.feature) return SBP.feature(name);
    return !SC.features || SC.features[name] !== false;
  }
  function brandName() { return (SBP && SBP.brandName) ? SBP.brandName() : (SC.siteName || "SBPress"); }
  var API = CFG.url || "";
  var KEY = CFG.anonKey || "";
  var S = window.SITE;
  if (!API || !KEY || !S) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var I18N = window.CRAFT_I18N || null;
  function T(key, vars) { return I18N ? I18N.t(key, vars) : key; }
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
  var postsAll = [];                 // 발행된 글 전체 (게시판별 필터용)
  var boards = [];                   // public.boards (사용 중인 게시판)
  var customPages = [];              // public.pages (발행된 페이지)
  var policyDefault = "member";      // site_contents.comments.default_policy

  /* 게시판 slug ↔ posts.category 값 (기본 4개는 한글 분류를 그대로 씁니다) */
  var CAT_ALIAS = { intro: "소개", news: "뉴스", interview: "인터뷰", info: "정보" };
  function boardKey(b) { return (b && (CAT_ALIAS[b.slug] || b.slug)) || ""; }
  function boardBySlug(slug) {
    for (var i = 0; i < boards.length; i++) if (boards[i].slug === slug) return boards[i];
    return null;
  }
  function boardByKey(key) {
    for (var i = 0; i < boards.length; i++) {
      var b = boards[i];
      if (b.slug === key || CAT_ALIAS[b.slug] === key) return b;
    }
    return null;
  }
  function postBySlug(slug) {
    for (var i = 0; i < postsAll.length; i++) if (postsAll[i].slug === slug) return postsAll[i];
    return null;
  }
  function policyFor(key) {
    if (!key) return "off";
    if (key.indexOf("workshop:") === 0) return policyDefault || "member";
    var p = postBySlug(key);
    var b = p ? boardByKey(p.category) : boardBySlug(key);
    return (b && b.comment_policy) || policyDefault || "member";
  }
  function postsForBoard(slug) {
    var b = boardBySlug(slug);
    if (!b) return [];
    var key = boardKey(b);
    return postsAll.filter(function (p) { return p.category === key; }).map(mapArticle);
  }

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

  /* ---------------- 영문(KO/EN) 본문 ----------------
     글: posts.title_en/summary_en/body_en 열 → 없으면 meta.en (13_v22 SQL 전 폴백)
     페이지: pages.title_en/… 열 → 없으면 site_contents 의 page_en:<slug> JSON (폴백)
     값이 비어 있으면 한국어를 그대로 씁니다(화면에서 pick). */
  var viewColumn = null;                 // posts.view_count 열이 있는지 (null = 아직 모름)

  function enPost(p) {
    var m = p && p.meta && p.meta.en ? p.meta.en : {};
    return {
      title: num(p && p.title_en) || num(m.title),
      summary: num(p && p.summary_en) || num(m.summary),
      body: num(p && p.body_en) || num(m.body),
      format: num(p && p.body_format_en) || num(m.body_format)
    };
  }
  function pageEnRow(slug) {
    var row = contents["page_en:" + slug];
    if (!row || !row.value) return {};
    try {
      var o = JSON.parse(row.value);
      return (o && typeof o === "object") ? o : {};
    } catch (e) { return {}; }
  }
  function enPage(pg) {
    var s = pg ? pageEnRow(pg.slug) : {};
    return {
      title: num(pg && pg.title_en) || num(s.title),
      subtitle: num(pg && pg.subtitle_en) || num(s.subtitle),
      body: num(pg && pg.body_en) || num(s.body),
      format: num(pg && pg.body_format_en) || num(s.format)
    };
  }
  function hasEn(o) { return !!(o && (o.title || o.summary || o.subtitle || o.body)); }

  function mapArticle(p) {
    return {
      slug: p.slug, title: p.title, desc: num(p.summary),
      tag: (p.meta && p.meta.tag) || p.category, region: num(p.region),
      source: num(p.source_name), date: num(p.published_at), url: num(p.source_url),
      image: p.image_url || "", _id: p.id, body: p.body || "", format: p.body_format || "text",
      pinned: !!p.is_pinned, publish_at: p.publish_at || null, sort: p.sort_order || 0,
      views: baseViews(p), en: enPost(p)
    };
  }
  function mapInterview(p) {
    var m = p.meta || {};
    return {
      slug: p.slug, title: p.title, quote: num(p.summary), desc: num(p.body || p.summary),
      person: m.person || "공방", role: m.role || "", source: num(p.source_name),
      date: num(p.published_at), url: num(p.source_url), image: p.image_url || "", _id: p.id,
      body: p.body || "", format: p.body_format || "text",
      pinned: !!p.is_pinned, publish_at: p.publish_at || null, sort: p.sort_order || 0,
      views: baseViews(p), en: enPost(p)
    };
  }
  function mapInfo(p) {
    var m = p.meta || {};
    var due = p.deadline ? String(p.deadline).slice(0, 10) : "";
    if (due && m.due_time) due += "T" + m.due_time;
    return {
      slug: p.slug, title: p.title, org: num(p.source_name), period: m.period || "",
      due: due, kind: m.kind || "정보", desc: num(p.summary), url: num(p.source_url),
      image: p.image_url || "", _id: p.id, body: p.body || "", format: p.body_format || "text",
      pinned: !!p.is_pinned, publish_at: p.publish_at || null, sort: p.sort_order || 0,
      views: baseViews(p), en: enPost(p)
    };
  }

  /* ---------------- 조회수 (posts.view_count · increment_post_view) -------------
     · 브라우저 한 세션(sessionStorage)에 한 번만 셉니다.
     · 13_v22 SQL 을 아직 실행하지 않아 RPC 가 없으면 localStorage 로만 세고
       화면에는 그 브라우저에서 센 값이 보입니다(안내 문구는 관리자 대시보드에). */
  var viewCache = Object.create(null);
  var localView = {};

  function baseViews(p) { return Math.max(0, parseInt(p && p.view_count, 10) || 0); }
  function localKey(slug) { return "sbp:views:" + slug; }
  function seenKey(slug) { return "sbp:seen:" + slug; }
  function readLocal(slug) {
    try { return Math.max(0, parseInt(localStorage.getItem(localKey(slug)), 10) || 0); } catch (e) { return 0; }
  }
  function writeLocal(slug, n) {
    try { localStorage.setItem(localKey(slug), String(n)); } catch (e) { /* 저장 실패는 무시 */ }
  }
  function slugOf(p) { return p ? (p.slug || (p._id != null ? String(p._id) : "")) : ""; }

  function viewCountFor(pOrKey) {
    var slug = typeof pOrKey === "string" ? pOrKey : slugOf(pOrKey);
    if (!slug) return 0;
    if (viewCache[slug] != null) return viewCache[slug];
    var p = (pOrKey && typeof pOrKey === "object") ? pOrKey : postBySlug(slug);
    var n = baseViews(p);
    if (p && p.view_count == null) n += readLocal(slug);
    return n;
  }

  function paintViews(slug) {
    var n = viewCache[slug] != null ? viewCache[slug] : viewCountFor(slug);
    $$('[data-views="' + String(slug).replace(/"/g, "") + '"]').forEach(function (el) {
      el.textContent = String(n);
    });
    try {
      document.dispatchEvent(new CustomEvent("craft:views", { detail: { slug: slug, count: n } }));
    } catch (e) { /* 옛 브라우저 */ }
  }

  function countView(p) {
    var slug = slugOf(p);
    if (!slug) return;
    try {
      if (sessionStorage.getItem(seenKey(slug))) return;
      sessionStorage.setItem(seenKey(slug), "1");
    } catch (e) { /* 차단된 저장소면 그냥 셉니다 */ }

    var base = baseViews(p);
    if (viewColumn === false) {           // 열이 없다고 이미 확인된 경우 — 서버에 묻지 않습니다.
      var ln = readLocal(slug) + 1;
      writeLocal(slug, ln);
      viewCache[slug] = base + ln;
      paintViews(slug);
      return;
    }
    fetch(API + "/rest/v1/rpc/increment_post_view", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (n) {
      viewCache[slug] = (typeof n === "number" && n >= 0) ? n : base + 1;
      paintViews(slug);
    }).catch(function () {
      viewColumn = false;                 // RPC 가 없으면 이번 방문에서는 다시 부르지 않습니다.
      var ln2 = readLocal(slug) + 1;
      writeLocal(slug, ln2);
      viewCache[slug] = base + ln2;
      paintViews(slug);
    });
  }

  /* ---------------- 인기글 (hunmin 블록 · 관리자) ---------------- */
  function popularPosts(slug, limit) {
    var n = Math.max(1, Math.min(12, parseInt(limit, 10) || 3));
    var rows = postsAll.filter(isPublicPost);
    if (slug && slug !== "all") {
      var b = boardBySlug(slug);
      if (!b) return [];
      var key = boardKey(b);
      rows = rows.filter(function (p) { return p.category === key; });
    }
    rows = rows.slice().sort(function (a, b) {
      var va = baseViews(a), vb = baseViews(b);
      if (va !== vb) return vb - va;
      var da = rowDate(a), db = rowDate(b);
      if (da !== db) return da < db ? 1 : -1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    return rows.slice(0, n).map(function (p) {
      var c = postCard(p);
      c.views = baseViews(p);
      return c;
    });
  }
  function applyPosts(rows) {
    postsAll = rows.slice();
    if (rows.length) {
      viewColumn = rows.some(function (p) { return p && Object.prototype.hasOwnProperty.call(p, "view_count"); });
    }
    var by = { "소개": [], "뉴스": [], "인터뷰": [], "정보": [] };
    rows.forEach(function (p) { if (by[p.category]) by[p.category].push(p); });
    // 상단 고정(PIN) 글이 먼저, 그다음 sort_order 순서입니다.
    ["소개", "뉴스", "인터뷰", "정보"].forEach(function (cat) {
      by[cat].sort(function (a, b) {
        if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
    });
    S.intro = by["소개"].map(mapArticle);
    S.news = by["뉴스"].map(mapArticle);
    S.interviews = by["인터뷰"].map(mapInterview);
    S.info = by["정보"].map(mapInfo);
    loadedPosts = true;
  }

  /* ---------------- hunmin 블록 · 피드가 쓰는 글 목록 ----------------
     board = 'all' 이면 게시판 전체(소개·뉴스·인터뷰·정보 + 직접 만든 게시판)에서 최신순. */
  function boardSlugOfCategory(cat) {
    for (var i = 0; i < boards.length; i++) if (boardKey(boards[i]) === cat) return boards[i].slug;
    return ("intro news interview info".split(" ")).filter(function (k) { return CAT_ALIAS[k] === cat; })[0] || "";
  }
  function boardNameOfCategory(cat) {
    for (var i = 0; i < boards.length; i++) if (boardKey(boards[i]) === cat) return boards[i].name;
    return cat;
  }
  function rowDate(p) { return String(p.published_at || p.created_at || "").slice(0, 10); }
  function postCard(p) {
    var m = p.meta || {};
    return {
      slug: p.slug, title: p.title, summary: num(p.summary || p.body),
      date: rowDate(p), image: p.image_url || "", url: num(p.source_url),
      category: p.category, boardSlug: boardSlugOfCategory(p.category),
      boardName: boardNameOfCategory(p.category), tag: m.tag || p.category,
      pinned: !!p.is_pinned, sort: p.sort_order || 0,
      views: baseViews(p), en: enPost(p)
    };
  }
  function isPublicPost(p) {
    if (!p || p.deleted_at) return false;
    if (!p.is_published) return false;
    if (p.publish_at && new Date(p.publish_at).getTime() > Date.now()) return false;
    return true;
  }
  function recentPosts(slug, limit) {
    var n = Math.max(1, Math.min(12, parseInt(limit, 10) || 3));
    var rows = postsAll.filter(isPublicPost);
    if (slug && slug !== "all") {
      var b = boardBySlug(slug);
      if (!b) return [];
      var key = boardKey(b);
      rows = rows.filter(function (p) { return p.category === key; });
    }
    rows = rows.slice().sort(function (a, b) {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      var da = rowDate(a), db = rowDate(b);
      if (da !== db) return da < db ? 1 : -1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    return rows.slice(0, n).map(postCard);
  }

  /* ---------------- sitemap.xml · rss.xml (관리자 미리보기/다운로드) ---------------- */
  var FEED_BASE = (SC.siteUrl || "").replace(/\/+$/, "") ||
    ((location.origin && location.origin !== "null") ? location.origin : "");
  function xml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
    });
  }
  function rfc822(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toUTCString();
  }
  function feedPayload() {
    var posts = postsAll.filter(isPublicPost).slice().sort(function (a, b) {
      return rowDate(a) < rowDate(b) ? 1 : -1;
    });
    var pages = customPages.filter(function (p) { return p.is_published; });
    var active = boards.filter(function (b) { return b.is_active !== false; });
    var latest = "";
    posts.concat(pages).forEach(function (x) {
      var d = String(x.updated_at || x.published_at || x.created_at || "").slice(0, 10);
      if (d > latest) latest = d;
    });
    return {
      base: FEED_BASE,
      title: cval("seo_title") || SC.siteTitle || (brandName() + " — 새 소식"),
      description: cval("seo_description") || SC.description || "",
      latest: latest || new Date().toISOString().slice(0, 10),
      boards: active.map(function (b) {
        var last = "";
        posts.forEach(function (p) { if (boardKey(b) === p.category && rowDate(p) > last) last = rowDate(p); });
        return { slug: b.slug, name: b.name, description: b.description || "", url: FEED_BASE + "/#/board/" + b.slug, lastmod: last };
      }),
      pages: pages.map(function (p) {
        return {
          slug: p.slug, title: p.title, url: FEED_BASE + "/#/page/" + encodeURIComponent(p.slug),
          lastmod: String(p.updated_at || p.created_at || "").slice(0, 10)
        };
      }),
      posts: posts.slice(0, 30).map(function (p) {
        var c = postCard(p);
        return {
          title: p.title, url: (/^https?:/i.test(c.url) ? c.url : FEED_BASE + "/#/board/" + (c.boardSlug || "news")),
          summary: c.summary, category: c.boardName, date: rowDate(p), updated: String(p.updated_at || "").slice(0, 10), slug: p.slug
        };
      })
    };
  }
  function feedSitemap(data) {
    var d = data || feedPayload();
    var urls = [
      { loc: d.base + "/", lastmod: d.latest, pri: "1.0", freq: "daily" },
      { loc: d.base + "/#/workshops", lastmod: d.latest, pri: "0.8", freq: "weekly" },
      { loc: d.base + "/#/news", lastmod: d.latest, pri: "0.9", freq: "daily" },
      { loc: d.base + "/#/interview", lastmod: d.latest, pri: "0.7", freq: "weekly" },
      { loc: d.base + "/#/info", lastmod: d.latest, pri: "0.7", freq: "weekly" },
      { loc: d.base + "/#/archive", lastmod: d.latest, pri: "0.6", freq: "monthly" },
      { loc: d.base + "/#/map", lastmod: d.latest, pri: "0.8", freq: "weekly" }
    ];
    d.boards.forEach(function (b) {
      urls.push({ loc: b.url, lastmod: b.lastmod || d.latest, pri: "0.7", freq: "weekly" });
    });
    d.pages.forEach(function (p) {
      urls.push({ loc: p.url, lastmod: p.lastmod || d.latest, pri: "0.6", freq: "monthly" });
    });
    urls.push({ loc: d.base + "/privacy", lastmod: "2026-11-21", pri: "0.2", freq: "yearly" });
    urls.push({ loc: d.base + "/terms", lastmod: "2026-11-21", pri: "0.2", freq: "yearly" });
    var body = urls.map(function (u) {
      return "  <url>\n    <loc>" + xml(u.loc) + "</loc>\n    <lastmod>" + xml(u.lastmod) + "</lastmod>\n" +
        "    <changefreq>" + u.freq + "</changefreq>\n    <priority>" + u.pri + "</priority>\n  </url>";
    }).join("\n");
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n";
  }
  function feedRss(data) {
    var d = data || feedPayload();
    var items = d.posts.map(function (p) {
      var link = p.url;
      return "    <item>\n      <title>" + xml(p.title) + "</title>\n      <link>" + xml(link) + "</link>\n" +
        '      <guid isPermaLink="false">' + xml(d.base + "/#/post/" + (p.slug || p.title)) + "</guid>\n" +
        "      <pubDate>" + rfc822(p.date) + "</pubDate>\n      <category>" + xml(p.category) + "</category>\n" +
        "      <description>" + xml(p.summary || p.title) + "</description>\n    </item>";
    }).join("\n");
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n' +
      "    <title>" + xml(d.title) + "</title>\n" +
      "    <link>" + xml(d.base + "/") + "</link>\n" +
      "    <description>" + xml(d.description) + "</description>\n" +
      "    <language>ko-KR</language>\n" +
      "    <lastBuildDate>" + rfc822(d.latest) + "</lastBuildDate>\n" +
      '    <atom:link href="' + xml(d.base + "/rss.xml") + '" rel="self" type="application/rss+xml"/>\n' +
      (items ? items + "\n" : "") + "  </channel>\n</rss>\n";
  }

  /* ---------------- boards · pages 공개 읽기 ---------------- */
  function applyBoards(rows) {
    boards = (rows || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0) || String(a.slug).localeCompare(String(b.slug));
    });
  }
  function applyPages(rows) {
    customPages = (rows || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0) || String(a.slug).localeCompare(String(b.slug));
    });
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
    applyNotice();
  }

  /* ---------------- 공지 띠배너 : 켜짐 · 기간 ---------------- */
  function kstStamp(d) {
    // 2026-11-21T13:23  (Asia/Seoul 기준 분 단위)
    var s = new Date(d || Date.now()).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
    return s.replace(" ", "T").slice(0, 16);
  }
  function normStamp(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
    if (!m) return "";
    return m[1] + "-" + m[2] + "-" + m[3] + "T" + (m[4] || "00") + ":" + (m[5] || "00");
  }
  function withinWindow(startKey, endKey) {
    var now = kstStamp();
    var a = normStamp(cval(startKey)), b = normStamp(cval(endKey));
    if (a && now < a) return false;
    if (b && now > b) return false;
    return true;
  }
  function flagOn(key, fallback) {
    var v = cval(key).toLowerCase();
    if (!v) return !!fallback;
    return /^(1|true|yes|y|on|ok|켬|켜기)$/.test(v);
  }

  function noticeText() {
    // notice_banner_text 는 옛 이름 — 두 키를 모두 받습니다.
    var t = cval("notice.text") || cval("notice_banner_text");
    return t ? vars(t).trim() : "";
  }
  function applyNotice() {
    var bar = $("#notice-bar");
    if (!bar) return;
    var hasFlag = contents["banner_enabled"] != null;
    var text = noticeText();
    var on = hasFlag ? flagOn("banner_enabled", false) : !!text;   // 키가 없으면 옛 방식(문구가 있으면 표시)
    if (!on || !text || !withinWindow("banner_start_at", "banner_end_at") ||
        sessionStorage.getItem("craft-notice-dismissed") === text) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    var p = $("#notice-text");
    if (p) p.textContent = text;
    var link = $("#notice-link");
    var lab = contents["notice.link_label"], url = contents["notice.link_url"] || contents["notice_banner_link"];
    if (link) {
      if (url && url.value) {
        link.href = url.value;
        link.textContent = (lab && lab.value) || "자세히 보기";
        link.hidden = false;
      } else { link.hidden = true; }
    }
  }

  /* ---------------- 포인트 색상 (theme_accent_color) ---------------- */
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || "").trim());
    if (!m) return null;
    var s = m[1];
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function rgbHex(rgb) {
    return "#" + rgb.map(function (n) {
      var v = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return v.length === 1 ? "0" + v : v;
    }).join("").toUpperCase();
  }
  function shade(rgb, f) {   // f < 0 : 어둡게, f > 0 : 흰색에 가깝게
    if (f < 0) return rgb.map(function (n) { return n * (1 + f); });
    return rgb.map(function (n) { return n + (255 - n) * f; });
  }
  function applyTheme() {
    /* v5.1 — 테마 토큰(site_contents.theme.tokens)이 있으면 포인트 색보다 먼저 적용합니다.
       값은 색 코드·숫자·글꼴 이름뿐이라 CSS 주입이 될 수 없습니다. */
    var tok = themeTokens();
    var root = document.documentElement;
    if (tok.bg) root.style.setProperty("--bg", tok.bg);
    if (tok.ink) root.style.setProperty("--ink", tok.ink);
    if (tok.radius != null) {
      root.style.setProperty("--r", tok.radius + "px");
      root.style.setProperty("--r-s", Math.max(0, tok.radius - 6) + "px");
    }
    if (tok.fontCss) root.style.setProperty("--font-head", tok.fontCss);
    var raw = tok.accent || cval("theme_accent_color");
    var rgb = hexToRgb(raw);
    if (!rgb) return "";
    var hex = rgbHex(rgb);
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-d", rgbHex(shade(rgb, -0.18)));
    root.style.setProperty("--accent-s", rgbHex(shade(rgb, 0.86)));
    root.setAttribute("data-accent", hex);
    var th = document.querySelector('meta[name="theme-color"]');
    if (th) th.setAttribute("content", hex);
    return hex;
  }

  /* 테마 토큰 — site_contents.theme.tokens (JSON 문자열). 잘못된 값은 버립니다. */
  var TOKEN_FONTS = {
    nanum: "'Nanum Gothic','나눔고딕',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    system: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif",
    serif: "Georgia,'Nanum Myeongjo','바탕',serif",
    sans: "'Helvetica Neue',Arial,'Malgun Gothic',sans-serif"
  };
  function themeTokens() {
    var raw = cval("theme.tokens");
    var out = { accent: "", bg: "", ink: "", radius: null, fontCss: "" };
    if (!raw) return out;
    var v = raw;
    if (typeof raw === "string") {
      try { v = JSON.parse(raw); } catch (e) { return out; }
    }
    if (!v || typeof v !== "object") return out;
    var hex = /^#[0-9a-f]{6}$/i;
    if (hex.test(String(v.accent || ""))) out.accent = String(v.accent).toUpperCase();
    if (hex.test(String(v.bg || ""))) out.bg = String(v.bg).toUpperCase();
    if (hex.test(String(v.ink || ""))) out.ink = String(v.ink).toUpperCase();
    var r = parseInt(v.radius, 10);
    if (isFinite(r)) out.radius = Math.max(0, Math.min(32, r));
    if (v.fontStack && TOKEN_FONTS[v.fontStack]) out.fontCss = TOKEN_FONTS[v.fontStack];
    window.CRAFT_THEME_TOKENS = v;
    return out;
  }

  /* ---------------- 테마 프리셋 (site_contents.theme.preset) ----------------
     magazine = 매거진형 / craft = 공방·쇼케이스형 / org = 기관 소개형
     <body data-theme="…"> 로 styles.css 가 모양을 바꿉니다. */
  var THEMES = { magazine: 1, craft: 1, org: 1 };
  function applyPreset() {
    var v = cval("theme.preset");
    if (!THEMES[v]) v = THEMES[SC.defaultTheme] ? SC.defaultTheme : "magazine";
    document.body.setAttribute("data-theme", v);
    window.CRAFT_THEME = v;
    return v;
  }

  /* ---------------- SEO · OG · 파비콘 ---------------- */
  function setMeta(key, val, prop) {
    if (!val) return;
    var sel = prop ? 'meta[property="' + key + '"]' : 'meta[name="' + key + '"]';
    var n = document.head.querySelector(sel);
    if (!n) {
      n = document.createElement("meta");
      n.setAttribute(prop ? "property" : "name", key);
      document.head.appendChild(n);
    }
    n.setAttribute("content", val);
  }
  function applySeo() {
    var title = cval("seo_title");
    var desc = cval("seo_description");
    var og = contents["seo_og_image"];
    var fav = contents["seo_favicon_url"];
    var ogUrl = (og && og.image_url) || "";
    var favUrl = (fav && fav.image_url) || "";

    window.CRAFT_SEO = { title: title, description: desc, ogImage: ogUrl, favicon: favUrl };
    if (desc) {
      setMeta("description", desc);
      setMeta("og:description", desc, true);
    }
    if (title) {
      setMeta("og:title", title, true);
      var here = (location.hash || "#/home").replace(/^#\/?/, "") || "home";
      if (here === "home") document.title = title;
    }
    if (ogUrl) setMeta("og:image", ogUrl, true);
    if (favUrl) {
      var link = document.head.querySelector('link[rel~="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "icon");
        document.head.appendChild(link);
      }
      link.setAttribute("href", favUrl);
    }
  }

  /* ---------------- 기간제 팝업 ---------------- */
  var POP_LS = "craft-popup-hidden";
  function popupSig() {
    return (cval("popup_start_at") || "-") + "|" + (cval("popup_title") || cval("popup_body").slice(0, 20));
  }
  function popupHiddenToday() {
    try {
      var o = JSON.parse(localStorage.getItem(POP_LS) || "null");
      return !!(o && o.date === kstStamp().slice(0, 10) && o.sig === popupSig());
    } catch (e) { return false; }
  }
  function bindPopupOnce() {
    var shell = $("#craft-popup");
    if (!shell || shell.getAttribute("data-bound") === "1") return;
    shell.setAttribute("data-bound", "1");
    function hide(today) {
      shell.hidden = true;
      document.body.classList.remove("pop-lock");
      if (today) {
        try {
          localStorage.setItem(POP_LS, JSON.stringify({ date: kstStamp().slice(0, 10), sig: popupSig() }));
        } catch (e) { /* 저장 실패는 무시 */ }
      }
    }
    var closeBtn = $("#craft-popup-close"), xBtn = $("#craft-popup-x"), ov = $("#craft-popup-overlay");
    var today = $("#craft-popup-today");
    function onClose() { hide(today && today.checked); }
    if (closeBtn) closeBtn.addEventListener("click", onClose);
    if (xBtn) xBtn.addEventListener("click", onClose);
    if (ov) ov.addEventListener("click", onClose);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && shell && !shell.hidden) onClose();
    });
  }
  function applyPopup() {
    var shell = $("#craft-popup");
    if (!shell) return;
    bindPopupOnce();
    var title = cval("popup_title"), body = cval("popup_body");
    var img = contents["popup_image_url"], imgUrl = (img && img.image_url) || "";
    var link = cval("popup_link"), label = cval("popup_link_label");
    var on = flagOn("popup_enabled", false);
    if (!on || (!title && !body && !imgUrl) || !withinWindow("popup_start_at", "popup_end_at") || popupHiddenToday()) {
      shell.hidden = true;
      return;
    }
    $("#craft-popup-title").textContent = title || "공지";
    $("#craft-popup-text").innerHTML = esc(body).replace(/\n/g, "<br>");
    var im = $("#craft-popup-img");
    if (im) {
      if (imgUrl) { im.src = imgUrl; im.hidden = false; } else { im.hidden = true; im.removeAttribute("src"); }
    }
    var a = $("#craft-popup-link");
    if (a) {
      if (link) { a.href = link; a.textContent = label || "자세히 보기"; a.hidden = false; }
      else { a.hidden = true; }
    }
    var box = $("#craft-popup-today");
    if (box) box.checked = false;
    shell.hidden = false;
    document.body.classList.add("pop-lock");
  }

  /* ---------------- 푸터 : 회사 정보 · SNS · 저작권 ---------------- */
  function cval(key) {
    var r = contents[key];
    return r && r.value != null ? String(r.value).trim() : "";
  }

  var SNS_DEFS = [
    { key: "footer_sns_instagram", label: "인스타그램", icon: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>' },
    { key: "footer_sns_youtube", label: "유튜브", icon: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m11 9.4 4 2.6-4 2.6z" fill="currentColor" stroke="none"/>' },
    { key: "footer_sns_blog", label: "블로그", icon: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 8.5h3.1a2.1 2.1 0 0 1 0 4.2H9zM9 12.7h3.4a2.1 2.1 0 0 1 0 4.2H9z" stroke-linejoin="round"/>' },
    { key: "footer_sns_facebook", label: "페이스북", icon: '<path d="M14.6 21v-6.9h2.3l.4-2.8h-2.7V9.5c0-.8.2-1.4 1.4-1.4h1.4V5.6c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.6v2.2H9.6v2.8H12V21z" fill="currentColor" stroke="none"/>' },
    { key: "footer_sns_x", label: "X(트위터)", icon: '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>' }
  ];

  function wrapItems(list) {
    return list.map(function (t) { return '<span class="fc-item">' + t + "</span>"; }).join("<i>·</i>");
  }

  function applyFooter() {
    var firm = $("#foot-company");
    if (firm) {
      var rows = [];
      var company = cval("footer_company_name"), ceo = cval("footer_ceo"), biz = cval("footer_biz_no");
      var addr = cval("footer_address"), email = cval("footer_email"), phone = cval("footer_phone");
      var first = [];
      if (company) first.push(esc(company));
      if (ceo) first.push("대표 " + esc(ceo));
      if (biz) first.push("사업자등록번호 " + esc(biz));
      if (first.length) rows.push('<span class="fc-line">' + wrapItems(first) + "</span>");
      if (addr) rows.push('<span class="fc-line"><span class="fc-item">' + esc(addr) + "</span></span>");
      var contact = [];
      if (email) contact.push('<a href="mailto:' + esc(email) + '">' + esc(email) + "</a>");
      if (phone) contact.push('<a href="tel:' + esc(phone.replace(/[^\d+]/g, "")) + '">' + esc(phone) + "</a>");
      if (contact.length) rows.push('<span class="fc-line">' + wrapItems(contact) + "</span>");
      firm.hidden = !rows.length;
      firm.innerHTML = rows.join("");
    }

    var sns = $("#foot-sns");
    if (sns) {
      var links = SNS_DEFS.map(function (d) {
        var url = cval(d.key);
        if (!url) return "";
        return '<li><a href="' + esc(url) + '" target="_blank" rel="noopener" aria-label="' + esc(d.label) + '">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' + d.icon + "</svg>" +
          "<span>" + esc(d.label) + "</span></a></li>";
      }).join("");
      sns.hidden = !links;
      sns.innerHTML = links;
    }

    var copy = $("#foot-copy");
    var text = cval("footer_copyright");
    if (copy && text) copy.textContent = text;
  }

  /* ---------------- <head> 코드 주입 ---------------- */
  var headDone = false;

  function attrSig(node) {
    var tag = node.tagName ? node.tagName.toLowerCase() : "";
    if (tag === "meta") {
      var k = node.getAttribute("name") || node.getAttribute("property") ||
        node.getAttribute("http-equiv") || node.getAttribute("charset") || "";
      return "meta|" + k.toLowerCase() + "|" + (node.getAttribute("content") || "");
    }
    if (tag === "link") return "link|" + (node.getAttribute("rel") || "").toLowerCase() + "|" + (node.getAttribute("href") || "");
    if (tag === "script") return "script|" + (node.getAttribute("src") || (node.textContent || "").replace(/\s+/g, " ").trim());
    return tag + "|" + (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isDup(node) {
    var tag = node.tagName.toLowerCase();
    var sig = attrSig(node);
    var list = document.head.querySelectorAll(tag);
    for (var i = 0; i < list.length; i++) if (attrSig(list[i]) === sig) return true;
    return false;
  }

  function injectHead() {
    if (headDone) return;
    headDone = true;
    var row = contents["custom_head_html"];
    var html = row && row.value ? String(row.value).trim() : "";
    if (!html) return;
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    [].slice.call(tpl.content.childNodes).forEach(function (node) {
      if (!node || node.nodeType !== 1) return;   // 텍스트·주석은 무시
      var tag = node.tagName.toLowerCase();
      if (["meta", "link", "style", "script", "noscript", "base"].indexOf(tag) < 0) return;
      if (isDup(node)) return;                    // 같은 태그가 이미 있으면 건너뜀
      var fresh = document.createElement(tag);
      [].forEach.call(node.attributes, function (a) { fresh.setAttribute(a.name, a.value); });
      if (tag === "script") {
        if (node.getAttribute("src")) {
          if (node.hasAttribute("async")) fresh.async = true;
          if (node.hasAttribute("defer")) fresh.defer = true;
        } else {
          fresh.textContent = node.textContent;   // 새 script 노드는 붙이는 순간 실행됩니다
        }
      } else if (tag === "style" || tag === "noscript" || tag === "base") {
        if (tag !== "base") fresh.textContent = node.textContent;
      }
      fresh.setAttribute("data-head-cms", "1");
      document.head.appendChild(fresh);
    });
  }

  /* ---------------- 댓글 개수 ---------------- */
  function loadCounts() {
    if (!feature("comments")) return Promise.resolve();
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
      b.innerHTML = '<span class="cmt-ico" aria-hidden="true">💬</span><span>' + esc(T("cmt.btn")) + "</span>" +
        (n ? ' <b class="cmt-n">' + n + "</b>" : "");
      b.setAttribute("aria-label", n ? T("cmt.n.aria", { n: n }) : T("cmt.open.aria"));
    });
  }

  /* ---------------- 댓글 버튼 붙이기 (app.js 가 호출) ---------------- */
  function attach(node, key, title, image) {
    if (!node || !key) return;
    if (!feature("comments")) return;
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
    btn.innerHTML = '<span class="cmt-ico" aria-hidden="true">💬</span><span>' + esc(T("cmt.btn")) + "</span>" +
      (n ? ' <b class="cmt-n">' + n + "</b>" : "");
    btn.setAttribute("aria-label", n ? T("cmt.n.aria", { n: n }) : T("cmt.open.aria"));
  }

  /* ---------------- 댓글 드로어 ---------------- */
  var drawer = null, state = { key: "", title: "", image: "", rows: [], replyTo: null };
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
      '    <div><p class="cmt-eyebrow" data-i18n="cmt.title">댓글</p><h2 id="cmt-title"></h2></div>' +
      '    <button type="button" class="cmt-close" id="cmt-close" aria-label="댓글 닫기">×</button>' +
      "  </header>" +
      '  <div class="cmt-body"><div class="cmt-list" id="cmt-list"></div></div>' +
      '  <div class="cmt-reply-note" id="cmt-reply-note" hidden>' +
      '    <span id="cmt-reply-to"></span>' +
      '    <button type="button" class="cmt-reply-cancel" id="cmt-reply-cancel" aria-label="답글 취소">취소</button>' +
      "  </div>" +
      '  <form class="cmt-form" id="cmt-form" hidden>' +
      '    <label class="sr-only" for="cmt-input">댓글 내용</label>' +
      '    <textarea id="cmt-input" maxlength="1000" rows="3" placeholder="서로에게 도움이 되는 말을 남겨 주세요. (최대 1000자)" data-i18n-ph="cmt.input.ph"></textarea>' +
      '    <div class="cmt-form-foot"><span class="cmt-who" id="cmt-who"></span>' +
      '      <span class="cmt-chars" id="cmt-chars">0/1000</span>' +
      '      <button type="submit" class="btn btn-primary btn-sm" id="cmt-send" data-i18n="cmt.submit">댓글 등록</button></div>' +
      '    <p class="cmt-msg" id="cmt-msg" role="status" aria-live="polite"></p>' +
      "  </form>" +
      '  <form class="cmt-guest" id="cmt-guest" hidden>' +
      '    <div class="cmt-guest-head"><b data-i18n="cmt.guest.head">비회원으로 남기기</b><span data-i18n="cmt.guest.hint">그림에 보이는 글자를 함께 적어 주세요.</span></div>' +
      '    <label class="sr-only" for="cmt-name">닉네임</label>' +
      '    <input id="cmt-name" maxlength="60" placeholder="닉네임 (1~60자)" data-i18n-ph="cmt.guest.name" autocomplete="nickname">' +
      '    <div class="cap-row">' +
      '      <div class="cap-box" id="cmt-cap-img" aria-live="polite"></div>' +
      '      <button type="button" class="cap-refresh" id="cmt-cap-refresh" data-i18n="cmt.guest.refresh">다른 글자</button>' +
      '    </div>' +
      '    <label class="sr-only" for="cmt-cap-answer">보안 문자</label>' +
      '    <input id="cmt-cap-answer" maxlength="10" placeholder="그림에 보이는 글자 5자" data-i18n-ph="cmt.guest.captcha" autocomplete="off" spellcheck="false">' +
      '    <label class="sr-only" for="cmt-guest-input">댓글 내용</label>' +
      '    <textarea id="cmt-guest-input" maxlength="1000" rows="3" placeholder="서로에게 도움이 되는 말을 남겨 주세요. (최대 1000자)" data-i18n-ph="cmt.input.ph"></textarea>' +
      '    <div class="cmt-guest-foot"><span class="cmt-chars" id="cmt-guest-chars">0/1000</span>' +
      '      <button type="submit" class="btn btn-primary btn-sm" id="cmt-guest-send" data-i18n="cmt.submit">댓글 등록</button></div>' +
      '    <p class="cmt-guest-msg" id="cmt-guest-msg" role="status" aria-live="polite"></p>' +
      "  </form>" +
      '  <div class="cmt-off" id="cmt-off" hidden data-i18n="cmt.off">이 게시판은 댓글이 비활성화되어 있습니다.</div>' +
      '  <div class="cmt-login" id="cmt-login" hidden>' +
      "    <p data-i18n=\"cmt.login.need\">댓글을 쓰려면 로그인이 필요합니다. 회원은 누구나 남길 수 있어요.</p>" +
      '    <button type="button" class="btn btn-primary btn-sm" id="cmt-login-btn" data-i18n="cmt.login.btn">로그인하고 댓글 쓰기</button>' +
      "  </div>" +
      "</aside>";
    root.appendChild(wrap);
    drawer = wrap;
    if (I18N) I18N.apply(wrap);

    $("#cmt-close").addEventListener("click", closeDrawer);
    $("#cmt-overlay").addEventListener("click", closeDrawer);
    $("#cmt-login-btn").addEventListener("click", function () {
      if (window.CRAFT_AUTH) window.CRAFT_AUTH.openLogin("댓글을 쓰려면 로그인해 주세요.");
    });
    $("#cmt-input").addEventListener("input", function (e) {
      $("#cmt-chars").textContent = e.target.value.length + "/1000";
    });
    $("#cmt-form").addEventListener("submit", submitComment);
    $("#cmt-guest").addEventListener("submit", submitGuestComment);
    $("#cmt-guest-input").addEventListener("input", function (e) {
      $("#cmt-guest-chars").textContent = e.target.value.length + "/1000";
    });
    $("#cmt-cap-refresh").addEventListener("click", function () { loadCaptcha(); });
    $("#cmt-reply-cancel").addEventListener("click", function () { clearReply(); });
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
    state.replyTo = null;
    $("#cmt-title").textContent = title || T("cmt.title");
    var hero = $("#cmt-hero");
    if (state.image) { hero.src = state.image; hero.hidden = false; } else { hero.hidden = true; hero.removeAttribute("src"); }
    $("#cmt-list").innerHTML = '<p class="cmt-empty">' + esc(T("cmt.loading")) + "</p>";
    $("#cmt-msg").textContent = "";
    $("#cmt-guest-msg").textContent = "";
    $("#cmt-cap-answer").value = "";
    $("#cmt-guest-input").value = "";
    $("#cmt-guest-chars").textContent = "0/1000";
    capState.id = "";
    $("#cmt-cap-img").innerHTML = "";
    $("#cmt-overlay").hidden = false;
    $("#cmt-drawer").hidden = false;
    document.body.classList.add("cmt-lock");
    syncForm();
    loadComments(key);
    setTimeout(function () { var i = $("#cmt-input"); if (i && !$("#cmt-form").hidden) i.focus(); }, 60);
  }

  function closeDrawer() {
    if (!drawer) return;
    clearReply();
    $("#cmt-drawer").hidden = true;
    $("#cmt-overlay").hidden = true;
    document.body.classList.remove("cmt-lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function syncForm() {
    if (!drawer || $("#cmt-drawer").hidden) return;
    var user = me(), token = sessionToken();
    var on = !!(user && token);
    var policy = policyFor(state.key);
    var off = policy === "off";
    $("#cmt-off").hidden = !off;
    $("#cmt-form").hidden = off || !on;
    $("#cmt-login").hidden = off || on || policy !== "member";
    var guestOn = !off && !on && policy === "all";
    $("#cmt-guest").hidden = !guestOn;
    if (on) $("#cmt-who").textContent = T("cmt.as", { name: myName(user) });
    if (guestOn && !capState.id && !capState.loading) loadCaptcha();
    paintReplyNote();
  }

  /* ---------------- 대댓글 — 답글 대상 표시 ---------------- */
  function setReply(comment) {
    if (!comment || !comment.id) return;
    if (comment.parent_id) return;                 // 답글에는 다시 답글을 달지 않습니다
    state.replyTo = { id: comment.id, name: comment.author_name || "댓글" };
    paintReplyNote();
    var target = $("#cmt-form").hidden ? $("#cmt-guest-input") : $("#cmt-input");
    if (target) { target.focus(); }
  }

  function clearReply() {
    state.replyTo = null;
    paintReplyNote();
  }

  function paintReplyNote() {
    var note = $("#cmt-reply-note");
    if (!note) return;
    var r = state.replyTo;
    var visible = !!(r && !$("#cmt-drawer").hidden && !$("#cmt-form").hidden) ||
                  !!(r && !$("#cmt-drawer").hidden && !$("#cmt-guest").hidden);
    note.hidden = !visible;
    if (r) $("#cmt-reply-to").textContent = (r.name || "댓글") + "님의 댓글에 답글을 남깁니다.";
  }

  /* ---------------- 비회원 캡차 ---------------- */
  var capState = { id: "", loading: false };

  function loadCaptcha() {
    var box = $("#cmt-cap-img");
    if (!box || capState.loading) return Promise.resolve();
    capState.loading = true;
    capState.id = "";
    var btn = $("#cmt-cap-refresh");
    if (btn) btn.disabled = true;
    box.innerHTML = '<span class="cap-wait">보안 문자를 불러오는 중…</span>';
    return fetch(API + "/rest/v1/rpc/create_captcha", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: "{}"
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      return r.json();
    }).then(function (d) {
      capState.id = (d && d.id) || "";
      box.innerHTML = (d && d.svg) ? d.svg : "";
      var ans = $("#cmt-cap-answer");
      if (ans) ans.value = "";
      if (!capState.id) box.innerHTML = '<span class="cap-err">보안 문자를 받지 못했습니다.</span>';
    }).catch(function () {
      capState.id = "";
      box.innerHTML = '<span class="cap-err">보안 문자를 불러오지 못했습니다. ‘다른 글자’를 눌러 주세요.</span>';
    }).then(function () {
      capState.loading = false;
      if (btn) btn.disabled = false;
    });
  }

  function submitGuestComment(e) {
    if (e) e.preventDefault();
    var msg = $("#cmt-guest-msg");
    var name = ($("#cmt-name").value || "").trim();
    var answer = ($("#cmt-cap-answer").value || "").trim();
    var text = ($("#cmt-guest-input").value || "").trim();
    if (!name) { msg.textContent = "닉네임을 적어 주세요."; $("#cmt-name").focus(); return; }
    if (name.length > 60) { msg.textContent = "닉네임은 60자까지 쓸 수 있습니다."; return; }
    if (!answer) { msg.textContent = "그림에 보이는 글자를 적어 주세요."; $("#cmt-cap-answer").focus(); return; }
    if (!text) { msg.textContent = "댓글 내용을 입력해 주세요."; $("#cmt-guest-input").focus(); return; }
    if (text.length > 1000) { msg.textContent = "댓글은 1000자까지 쓸 수 있습니다."; return; }
    if (!capState.id) { msg.textContent = "보안 문자를 새로 받아 주세요."; loadCaptcha(); return; }

    var btn = $("#cmt-guest-send");
    btn.disabled = true;
    msg.textContent = "등록하는 중…";
    var cid = capState.id;
    capState.id = "";
    fetch(API + "/rest/v1/rpc/submit_guest_comment", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        p_challenge_id: cid, p_answer: answer, p_post_key: state.key,
        p_author_name: name, p_content: text,
        p_parent_id: state.replyTo ? state.replyTo.id : null
      })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var m = "";
        try { m = JSON.parse(t).message || ""; } catch (err) { m = t; }
        throw new Error(m || ("HTTP " + r.status));
      });
      return r.json();
    }).then(function (row) {
      var item = row && row.id ? row : null;
      if (item && state.rows.every(function (c) { return c.id !== item.id; })) state.rows.push(item);
      $("#cmt-guest-input").value = "";
      $("#cmt-guest-chars").textContent = "0/1000";
      $("#cmt-cap-answer").value = "";
      msg.textContent = "댓글을 남겼습니다.";
      clearReply();
      cmtCounts[state.key] = (cmtCounts[state.key] || 0) + 1;
      paintButtons();
      renderComments();
      loadCaptcha();
      setTimeout(function () { if (msg.textContent === "댓글을 남겼습니다.") msg.textContent = ""; }, 2400);
    }).catch(function (err) {
      var m = String((err && err.message) || "");
      if (/맞지 않습니다/.test(m)) msg.textContent = "보안 문자가 맞지 않습니다. 새 글자로 다시 시도해 주세요.";
      else if (/만료/.test(m)) msg.textContent = "보안 문자가 만료되었습니다. 새 글자를 받아 주세요.";
      else if (/비활성화/.test(m)) msg.textContent = "이 게시판은 댓글이 비활성화되어 있습니다.";
      else if (/받지 않습니다/.test(m)) msg.textContent = "이 게시판은 비회원 댓글을 받지 않습니다.";
      else msg.textContent = "댓글을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.";
      loadCaptcha();
    }).then(function () { btn.disabled = false; });
  }

  function commentItem(c, isReply) {
    var user = me();
    var mine = user && c.user_id === user.id;
    return '<article class="cmt-item' + (isReply ? " cmt-reply" : "") + (mine ? " mine" : "") + '" data-id="' + esc(c.id) + '">' +
      '<div class="cmt-item-head"><span class="cmt-avatar">' + esc(String(c.author_name || "?").charAt(0)) + "</span>" +
      "<b>" + esc(c.author_name) + "</b>" +
      (mine ? '<span class="cmt-me">' + esc(T("cmt.me")) + "</span>" : "") +
      (c.is_guest ? '<span class="cmt-guest-badge">' + esc(T("cmt.guest.badge")) + "</span>" : "") +
      '<time datetime="' + esc(c.created_at) + '">' + esc(fmtWhen(c.created_at)) + "</time></div>" +
      '<p class="cmt-text">' + esc(c.content).replace(/\n/g, "<br>") + "</p>" +
      '<div class="cmt-acts">' +
        (isReply ? "" : '<button type="button" class="cmt-reply-btn" data-reply="' + esc(c.id) + '">' + esc(T("cmt.reply")) + "</button>") +
        (mine ? '<button type="button" class="cmt-del" data-del="' + esc(c.id) + '">' + esc(T("cmt.delete")) + "</button>" : "") +
      "</div></article>";
  }

  function renderComments() {
    var list = $("#cmt-list");
    if (!list) return;
    if (!state.rows.length) {
      list.innerHTML = '<div class="cmt-empty"><b>' + esc(T("cmt.empty.title")) + "</b><p>" + esc(T("cmt.empty.desc")) + "</p></div>";
      return;
    }
    var byId = Object.create(null), replies = Object.create(null);
    state.rows.forEach(function (c) { byId[c.id] = c; });
    state.rows.forEach(function (c) {
      if (c.parent_id && byId[c.parent_id]) {
        (replies[c.parent_id] = replies[c.parent_id] || []).push(c);
      }
    });
    var html = state.rows.filter(function (c) {
      // 1단계 댓글 + (부모가 숨겨진) 고아 답글만 최상위로 그립니다.
      return !c.parent_id || !byId[c.parent_id];
    }).map(function (c) {
      return commentItem(c, false) +
        (replies[c.id] || []).map(function (r) { return commentItem(r, true); }).join("");
    }).join("");
    list.innerHTML = html;
    $$("[data-del]", list).forEach(function (b) {
      b.addEventListener("click", function () { deleteComment(b.getAttribute("data-del")); });
    });
    $$("[data-reply]", list).forEach(function (b) {
      b.addEventListener("click", function () { setReply(byId[b.getAttribute("data-reply")]); });
    });
  }

  function loadComments(key) {
    var q = "comments?select=id,post_key,user_id,author_name,content,is_hidden,is_guest,parent_id,created_at" +
      "&post_key=eq." + encodeURIComponent(key) + "&order=created_at.asc&limit=500";
    return rest(q).then(function (rows) {
      if (state.key !== key) return;
      state.rows = rows || [];
      renderComments();
    }).catch(function () {
      if (state.key !== key) return;
      $("#cmt-list").innerHTML = '<p class="cmt-empty">' + esc(T("cmt.load.fail")) + "</p>";
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
        author_name: myName(user), content: text,
        parent_id: state.replyTo ? state.replyTo.id : null
      })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
      return r.json();
    }).then(function (rows) {
      var row = rows && rows[0];
      if (row && state.rows.every(function (c) { return c.id !== row.id; })) state.rows.push(row);
      input.value = ""; $("#cmt-chars").textContent = "0/1000";
      msg.textContent = "댓글을 남겼습니다.";
      clearReply();
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
    if (!window.confirm(T("cmt.confirm.del"))) return;
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

  /* 화면(해시)을 옮기면 댓글 드로어를 닫습니다 — 다른 화면 위에 남지 않게. */
  window.addEventListener("hashchange", function () {
    if (drawer && !$("#cmt-drawer").hidden) closeDrawer();
  });

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
    if (I18N && I18N.onChange) {
      I18N.onChange(function () {
        paintButtons();
        if (drawer) {
          I18N.apply(drawer);
          if (!$("#cmt-drawer").hidden) { syncForm(); renderComments(); }
        }
      });
    }

    Promise.all([
      rest("site_contents?select=key,value,image_url").catch(function () { return null; }),
      rest("posts?select=*&is_published=eq.true&order=category.asc,is_pinned.desc,sort_order.asc,published_at.desc&limit=500").catch(function () { return null; }),
      rest("boards?select=slug,name,description,per_page,comment_policy,sort_order&order=sort_order").catch(function () { return null; }),
      rest("pages?select=slug,title,subtitle,body,images,blocks,sort_order,updated_at&is_published=eq.true&order=sort_order").catch(function () { return null; })
    ]).then(function (res) {
      var rows = res[0], posts = res[1], boardRows = res[2], pageRows = res[3];
      if (rows) {
        rows.forEach(function (r) { contents[r.key] = r; });
        policyDefault = cval("comments.default_policy") || "member";
      }
      if (boardRows) applyBoards(boardRows);
      if (pageRows) applyPages(pageRows);
      if (posts && posts.length) { applyPosts(posts); }
      applyContents();
      applyFooter();
      applyPreset();
      applyTheme();
      applySeo();
      applyPopup();
      injectHead();
      if (window.CRAFT_APP && window.CRAFT_APP.refresh) window.CRAFT_APP.refresh();
      loadCounts();
      paintButtons();
    });
  }

  window.CRAFT_CMS = {
    attach: attach,
    recount: paintButtons,
    open: openDrawer,
    contents: function () { return contents; },
    postsLoaded: function () { return loadedPosts; },
    headInjected: function () { return headDone; },
    /* 게시판·페이지 (app.js 가 화면을 그릴 때 씁니다) */
    boardsList: function () { return boards.slice(); },
    boardBySlug: boardBySlug,
    boardKey: function (b) { return b ? boardKey(b) : ""; },
    perPage: function (key) {
      var b = boardBySlug(key) || boardByKey(key);
      return b && b.per_page ? Number(b.per_page) : 12;
    },
    countFor: function (slug) { return postsForBoard(slug).length; },
    postsFor: function (slug) { return postsForBoard(slug); },
    recentPosts: recentPosts,
    popularPosts: popularPosts,
    /* 조회수 — 글 상세를 열 때 countView(p), 화면에는 viewCount(p|slug) */
    countView: countView,
    viewCount: viewCountFor,
    hasViewColumn: function () { return viewColumn !== false; },
    /* 영문(KO/EN) 본문 — 열이 없으면 meta.en / site_contents 폴백 */
    enPost: enPost,
    enPage: enPage,
    hasEn: hasEn,
    allPosts: function () { return postsAll.slice(); },
    /* 통합 검색용 — 지금 공개된 글·페이지만 돌려줍니다(휴지통·임시저장·예약 제외). */
    publicPosts: function () { return postsAll.filter(isPublicPost); },
    publicPages: function () {
      return customPages.filter(function (pg) { return pg && pg.is_published !== false && !pg.deleted_at; });
    },
    feedPayload: feedPayload,
    feedSitemap: feedSitemap,
    feedRss: feedRss,
    theme: function () { return window.CRAFT_THEME || "magazine"; },
    pageList: function () { return customPages.slice(); },
    pageEn: function (slug) {
      var pg = null;
      for (var i = 0; i < customPages.length; i++) if (customPages[i].slug === slug) pg = customPages[i];
      return enPage(pg);
    },
    pageBySlug: function (slug) {
      for (var i = 0; i < customPages.length; i++) if (customPages[i].slug === slug) return customPages[i];
      return null;
    },
    /* 글 상세(#/post/<slug|id>) — 발행된 글만 돌려줍니다 */
    postFor: function (key) {
      var k = String(key || "");
      for (var i = 0; i < postsAll.length; i++) {
        var p = postsAll[i];
        if (p.slug === k || String(p.id) === k) return isPublicPost(p) ? p : null;
      }
      return null;
    },
    policyFor: policyFor,
    defaultPolicy: function () { return policyDefault; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 0);
})();
