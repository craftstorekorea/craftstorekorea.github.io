/* ============================================================================
   hunmin — 전국공방 블록 조립기  (사이트 렌더 + 관리자 편집기)
   ----------------------------------------------------------------------------
   hunmin 블록은 페이지(pages.blocks)에 순서대로 담기는 작은 화면 조각입니다.
     posts   [최신글]        게시판 글을 실시간으로 카드에 담습니다.
     map     [지도]          등록 공방의 전국 지도(SVG)를 페이지에 놓습니다.
     form    [구독/제보 폼]  뉴스레터 구독 · 공방 등록/제보를 접수합니다.
     gallery [이미지 갤러리] 페이지 사진 또는 블록 사진을 설명과 함께 보여 줍니다.
     text    [텍스트·배너]   제목 + 본문 + 버튼(CTA) 한 덩어리.
   사용:
     사이트   window.CRAFT_HUNMIN.render(container, page)
     관리자   window.CRAFT_HUNMIN.editor.mount(container, blocks, options)
   ============================================================================ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  var SBP = window.SBP || null;
  var SC = window.SBPRESS_CONFIG || {};
  function brandName() { return (SBP && SBP.brandName) ? SBP.brandName() : (SC.siteName || "사이트"); }
  function tagline() { return (SBP && SBP.tagline) ? (SBP.tagline() || SBP.brandName()) : (SC.tagline || SC.siteName || "사이트"); }
  /* 블록 안의 새 문구도 사이트 KO|EN 을 따라갑니다(사전에 없는 키는 키 그대로 — 테스트가 잡습니다). */
  var I18N = window.CRAFT_I18N || null;
  function hT(key) { return (I18N && I18N.t) ? I18N.t(key) : key; }
  function hEn(p, field) {
    if (!I18N || !I18N.isEn || !I18N.isEn()) return "";
    return (p && p.en && p.en[field]) ? p.en[field] : "";
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
  /* 사이트 상대 경로("assets/x.jpg")도 /admin 안에서 미리보기가 깨지지 않게 루트 기준으로 만듭니다. */
  function absUrl(u) {
    var v = str(u).trim();
    if (!v) return "";
    if (/^(https?:|data:|blob:|\/\/|\/)/i.test(v)) return v;
    return "/" + v.replace(/^\.\//, "");
  }
  function dateKo(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(iso));
    if (!m) return "";
    var months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    return months[Number(m[2]) - 1] + " " + Number(m[3]) + "일";
  }

  /* ---------------- 블록 정의 ---------------- */
  var TYPES = [
    {
      type: "posts", label: "최신글", badge: "posts", icon: "news",
      desc: "게시판 글을 실시간으로 카드에 담습니다.",
      defaults: { type: "posts", board: "all", count: 3, title: "최신 소식" }
    },
    {
      type: "popular", label: "인기글", badge: "popular", icon: "pin",
      desc: "조회수가 많은 글을 위에서부터 모읍니다.",
      defaults: { type: "popular", board: "all", count: 3, title: "인기글" }
    },
    {
      type: "map", label: "지도", badge: "map", icon: "map",
      desc: "등록 공방의 전국 지도를 페이지에 놓습니다.",
      defaults: { type: "map", title: "전국 공방 지도", desc_text: "" }
    },
    {
      type: "form", label: "구독/제보 폼", badge: "form", icon: "mail",
      desc: "뉴스레터 구독 또는 공방 등록·제보를 받습니다.",
      defaults: {
        type: "form", kind: "newsletter", title: tagline() + " 뉴스레터",
        desc_text: "매주 금요일, 이번 주 공방 소식을 메일로 보내 드립니다.",
        button: "구독하기"
      }
    },
    {
      type: "gallery", label: "이미지 갤러리", badge: "gallery", icon: "doc",
      desc: "페이지 사진이나 블록 사진을 설명과 함께 보여 줍니다.",
      defaults: { type: "gallery", source: "page", title: "", images: [] }
    },
    {
      type: "text", label: "텍스트·배너", badge: "text", icon: "doc",
      desc: "제목·본문·버튼을 한 덩어리로 강조합니다.",
      defaults: {
        type: "text", title: "제목을 입력하세요", body: "",
        cta_label: "", cta_url: "", tone: "soft"
      }
    }
  ];
  function typeDef(t) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].type === t) return TYPES[i];
    return null;
  }

  /* 저장된 값을 안전한 모양으로 다듬습니다(모르는 종류는 버립니다). */
  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var def = typeDef(raw.type);
    if (!def) return null;
    var b = {};
    for (var k in def.defaults) if (def.defaults.hasOwnProperty(k)) b[k] = def.defaults[k];
    for (var k2 in raw) {
      if (!raw.hasOwnProperty(k2)) continue;
      if (k2 === "images") continue;
      if (typeof raw[k2] === "string") b[k2] = raw[k2].slice(0, 2000);
      else if (typeof raw[k2] === "number" || typeof raw[k2] === "boolean") b[k2] = raw[k2];
    }
    b.type = def.type;
    if (def.type === "posts" || def.type === "popular") {
      b.board = str(b.board || "all").slice(0, 60) || "all";
      b.count = Math.max(1, Math.min(12, parseInt(b.count, 10) || 3));
    }
    if (def.type === "form") b.kind = (b.kind === "submit") ? "submit" : "newsletter";
    if (def.type === "gallery") {
      b.source = (b.source === "own") ? "own" : "page";
      b.images = [];
      var list = Array.isArray(raw.images) ? raw.images : [];
      list.slice(0, 24).forEach(function (im) {
        if (!im) return;
        var url = str(im.url || "").trim().slice(0, 800);
        if (!url) return;
        b.images.push({ url: url, caption: str(im.caption || "").trim().slice(0, 160) });
      });
    }
    if (def.type === "text") {
      b.tone = (b.tone === "dark" || b.tone === "plain") ? b.tone : "soft";
      b.cta_url = str(b.cta_url || "").trim().slice(0, 500);
    }
    return b;
  }
  function normalizeList(list) {
    return (Array.isArray(list) ? list : []).map(normalize).filter(Boolean);
  }

  /* ============================================================
     사이트 렌더
     ============================================================ */
  function currentPageSlug() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    return /^page\//.test(h) ? decodeURIComponent(h.slice(5)) : "";
  }

  function renderPosts(b) {
    var C = window.CRAFT_CMS;
    var sec = el("section", "hm-block hm-posts");
    var rows = (C && C.recentPosts) ? C.recentPosts(b.board, b.count || 3) : [];
    var board = (C && C.boardsList) ? C.boardsList().filter(function (x) { return x.slug === b.board; })[0] : null;
    var more = b.board === "all" ? "#/news" : "#/board/" + encodeURIComponent(b.board);
    var head = '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · 최신글</p>' +
      "<h2>" + esc(b.title || "최신 소식") + "</h2></div>" +
      (rows.length ? '<a class="link-more" href="' + esc(more) + '">' + esc(board ? board.name : "전체 글") +
        " <svg width=\"14\" height=\"14\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>" : "") + "</div>";
    if (!rows.length) {
      sec.innerHTML = head + '<p class="hm-empty">아직 이 게시판에 공개된 글이 없습니다.</p>';
      return sec;
    }
    var cards = rows.map(function (p) {
      var href = p.url || ("#/board/" + encodeURIComponent(p.boardSlug || "news"));
      var ext = p.url ? ' target="_blank" rel="noopener"' : "";
      return '<li class="hm-post"><a href="' + esc(href) + '"' + ext + ">" +
        (p.image ? '<span class="hm-post-img"><img src="' + esc(p.image) + '" alt="" loading="lazy"></span>' : "") +
        '<span class="hm-post-body">' +
          '<span class="hm-post-tags"><span class="tag">' + esc(p.tag || p.boardName || "소식") + "</span>" +
            (p.pinned ? '<span class="pin-badge">📌 고정</span>' : "") + "</span>" +
          "<h3>" + esc(p.title) + "</h3>" +
          (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") +
          '<span class="hm-post-meta">' + esc([p.boardName, dateKo(p.date), p.source].filter(Boolean).join(" · ")) + "</span>" +
        "</span></a></li>";
    }).join("");
    sec.innerHTML = head + '<ul class="hm-post-list">' + cards + "</ul>";
    return sec;
  }

  function renderPopular(b) {
    var C = window.CRAFT_CMS;
    var sec = el("section", "hm-block hm-posts hm-popular");
    var rows = (C && C.popularPosts) ? C.popularPosts(b.board, b.count || 3) : [];
    var board = (C && C.boardsList) ? C.boardsList().filter(function (x) { return x.slug === b.board; })[0] : null;
    var more = b.board === "all" ? "#/news" : "#/board/" + encodeURIComponent(b.board);
    var head = '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · ' + esc(hT("hm.popular.eyebrow")) + '</p>' +
      "<h2>" + esc(b.title || hT("hm.popular.title")) + "</h2></div>" +
      (rows.length ? '<a class="link-more" href="' + esc(more) + '">' + esc(board ? board.name : hT("hm.popular.all")) +
        " <svg width=\"14\" height=\"14\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>" : "") + "</div>";
    if (!rows.length) {
      sec.innerHTML = head + '<p class="hm-empty">' + esc(hT("hm.popular.empty")) + "</p>";
      return sec;
    }
    var counted = rows.some(function (r) { return (r.views || 0) > 0; });
    var cards = rows.map(function (p, i) {
      var href = p.url || ("#/board/" + encodeURIComponent(p.boardSlug || "news"));
      var ext = p.url ? ' target="_blank" rel="noopener"' : "";
      return '<li class="hm-post"><a href="' + esc(href) + '"' + ext + ">" +
        '<span class="hm-rank">' + (i + 1) + "</span>" +
        (p.image ? '<span class="hm-post-img"><img src="' + esc(p.image) + '" alt="" loading="lazy"></span>' : "") +
        '<span class="hm-post-body">' +
          '<span class="hm-post-tags"><span class="tag">' + esc(p.tag || p.boardName || "") + "</span>" +
            (p.pinned ? '<span class="pin-badge">📌</span>' : "") +
            (counted ? '<span class="hm-views">👁 ' + (p.views || 0) + "</span>" : "") + "</span>" +
          "<h3>" + esc(hEn(p, "title") || p.title) + "</h3>" +
          (p.summary ? "<p>" + esc(hEn(p, "summary") || p.summary) + "</p>" : "") +
          '<span class="hm-post-meta">' + esc([p.boardName, dateKo(p.date)].filter(Boolean).join(" · ")) + "</span>" +
        "</span></a></li>";
    }).join("");
    sec.innerHTML = head + (counted ? "" : '<p class="hm-views-note">' + esc(hT("hm.popular.note")) + "</p>") +
      '<ul class="hm-post-list">' + cards + "</ul>";
    return sec;
  }

  function renderMap(b) {
    var sec = el("section", "hm-block hm-map");
    var K = window.KOREA;
    var shops = ((window.CRAFT_APP && window.CRAFT_APP.mapPlaces) ? window.CRAFT_APP.mapPlaces() : [])
      .concat((window.SITE && window.SITE.workshops) || []);
    /* 같은 이름이 두 번 나오지 않게 정리하고, 좌표가 있는 곳만 지도에 점으로 표시합니다. */
    var seen = {}, uniq = [];
    shops.forEach(function (w) {
      if (!w || !w.name || seen[w.name]) return;
      seen[w.name] = 1;
      uniq.push(w);
    });
    shops = uniq.filter(function (w) { return w.lat && w.lng; });
    var title = b.title || "전국 공방 지도";
    sec.innerHTML = '<div class="hm-map-card"><figure class="hm-map-fig"><div class="hm-map-stage">' +
      '<svg class="hm-mini-map" viewBox="0 0 520 946" role="img" aria-label="' + esc(title) + '">' +
      '<g class="hm-mp-prov"></g><g class="hm-mp-pin"></g></svg></div></figure>' +
      '<div class="hm-map-copy"><p class="hm-eyebrow">hunmin · 지도</p><h2>' + esc(title) + "</h2>" +
      (b.desc_text ? "<p>" + esc(b.desc_text) + "</p>" : "") +
      '<p class="hm-map-stat"><b>' + shops.length + "</b>곳의 공방이 지도에 표시되어 있습니다.</p>" +
      '<a class="btn btn-primary btn-sm" href="#/map">지도·게시판 열기 <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow"/></svg></a>' +
      '<p class="hm-map-note">지도에서 지역을 누르면 그 지역 공방만 골라 볼 수 있습니다.</p></div></div>';
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
      K.provinces.forEach(function (p) {
        var path = svgEl("path", { d: p.d, class: "hm-prov" });
        var t = svgEl("title", {});
        t.textContent = p.name;
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
    var sec = el("section", "hm-block hm-form");
    var isNews = b.kind !== "submit";
    var button = b.button || (isNews ? "구독하기" : "제보 보내기");
    var fields = isNews
      ? '<label class="hm-field"><span>이메일</span><input type="email" name="email" required autocomplete="email" placeholder="name@example.com"></label>' +
        '<label class="hm-field"><span>이름 <em>선택</em></span><input type="text" name="name" maxlength="80" autocomplete="name"></label>'
      : '<label class="hm-field"><span>공방 이름 <em>필수</em></span><input type="text" name="title" maxlength="80" required></label>' +
        '<div class="hm-field-row">' +
          '<label class="hm-field"><span>지역</span><input type="text" name="region" maxlength="40" placeholder="예: 부산"></label>' +
          '<label class="hm-field"><span>분야</span><input type="text" name="craft" maxlength="40" placeholder="예: 도예"></label>' +
        "</div>" +
        '<div class="hm-field-row">' +
          '<label class="hm-field"><span>연락처</span><input type="text" name="phone" maxlength="40" placeholder="전화 또는 이메일"></label>' +
          '<label class="hm-field"><span>이메일</span><input type="email" name="email" autocomplete="email" placeholder="name@example.com"></label>' +
        "</div>" +
        '<label class="hm-field"><span>소개 <em>선택</em></span><textarea name="desc" rows="3" maxlength="1200" placeholder="공방 소개와 운영 프로그램을 적어 주세요."></textarea></label>';
    sec.innerHTML = '<div class="hm-form-card"><div class="hm-form-copy">' +
      '<p class="hm-eyebrow">hunmin · ' + (isNews ? "뉴스레터 구독" : "공방 등록·제보") + "</p>" +
      "<h2>" + esc(b.title || (isNews ? tagline() + " 뉴스레터" : "공방을 등록해 주세요")) + "</h2>" +
      (b.desc_text ? "<p>" + esc(b.desc_text) + "</p>" : "") +
      '</div><form class="hm-form-body" novalidate>' + fields +
      '<button type="submit" class="btn btn-primary">' + esc(button) + "</button>" +
      '<p class="hm-form-note">' + (isNews
        ? "입력하신 이메일은 뉴스레터 발송에만 사용합니다."
        : "적어 주신 내용은 공방 등록·제보 검토에만 사용합니다.") + "</p>" +
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
      if (!CFG.url) { msg.textContent = "지금은 접수할 수 없습니다. 잠시 뒤 다시 시도해 주세요."; return; }
      if (isNews && !data.email) { msg.textContent = "이메일 주소를 입력해 주세요."; return; }
      if (!isNews && !data.title) { msg.textContent = "공방 이름을 입력해 주세요."; return; }
      var payload = {};
      Object.keys(data).forEach(function (k) { if (k !== "email" && k !== "name") payload[k] = data[k]; });
      btn.disabled = true;
      msg.className = "hm-form-msg";
      msg.textContent = "보내는 중…";
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
        msg.textContent = isNews ? "구독 신청을 받았습니다. 다음 편부터 보내 드릴게요." : "제보를 받았습니다. 확인 후 연락드리겠습니다.";
      }).catch(function () {
        btn.disabled = false;
        msg.className = "hm-form-msg err";
        msg.textContent = "보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
      });
    });
    return sec;
  }

  function renderGallery(b, page) {
    var sec = el("section", "hm-block hm-gallery");
    var list = (b.source === "page")
      ? ((page && Array.isArray(page.images)) ? page.images : [])
      : (b.images || []);
    list = (list || []).filter(function (im) { return im && im.url; });
    var head = (b.title || list.length) ? '<div class="hm-head"><div><p class="hm-eyebrow">hunmin · 갤러리</p>' +
      (b.title ? "<h2>" + esc(b.title) + "</h2>" : "") + "</div></div>" : "";
    if (!list.length) {
      if (!b.title) return null;
      sec.innerHTML = head + '<p class="hm-empty">아직 사진이 없습니다.</p>';
      return sec;
    }
    sec.innerHTML = head + '<div class="hm-gallery-grid">' + list.map(function (im) {
      return '<figure><img src="' + esc(absUrl(im.url)) + '" alt="' + esc(im.caption || "") + '" loading="lazy">' +
        (im.caption ? "<figcaption>" + esc(im.caption) + "</figcaption>" : "") + "</figure>";
    }).join("") + "</div>";
    return sec;
  }

  function renderText(b) {
    var sec = el("section", "hm-block hm-text tone-" + (b.tone || "soft"));
    var body = str(b.body).split(/\n{2,}/).filter(Boolean).map(function (p) {
      return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
    var cta = "";
    if (b.cta_label && b.cta_url) {
      var ext = /^https?:/i.test(b.cta_url) ? ' target="_blank" rel="noopener"' : "";
      cta = '<a class="btn ' + (b.tone === "dark" ? "btn-accent" : "btn-primary") + '" href="' +
        esc(b.cta_url) + '"' + ext + ">" + esc(b.cta_label) + ' <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow"/></svg></a>';
    }
    sec.innerHTML = '<div class="hm-text-in"><p class="hm-eyebrow">hunmin · ' +
      (b.tone === "dark" ? "배너" : "텍스트") + "</p><h2>" + esc(b.title) + "</h2>" +
      (body ? '<div class="hm-text-body">' + body + "</div>" : "") +
      (cta ? '<div class="hm-text-cta">' + cta + "</div>" : "") + "</div>";
    return sec;
  }

  /* 페이지의 블록을 순서대로 그립니다. 그린 블록 수를 돌려줍니다. */
  function render(container, page) {
    if (!container) return 0;
    container.innerHTML = "";
    var blocks = normalizeList(page && page.blocks);
    var drawn = 0;
    blocks.forEach(function (b) {
      var node = null;
      try {
        if (b.type === "posts") node = renderPosts(b);
        else if (b.type === "popular") node = renderPopular(b);
        else if (b.type === "map") node = renderMap(b);
        else if (b.type === "form") node = renderForm(b);
        else if (b.type === "gallery") node = renderGallery(b, page);
        else if (b.type === "text") node = renderText(b);
      } catch (e) { node = null; }
      if (node) { node.setAttribute("data-block", b.type); container.appendChild(node); drawn++; }
    });
    container.hidden = drawn === 0;
    return drawn;
  }

  /* ============================================================
     관리자 편집기
     ============================================================ */
  var editorState = { root: null, blocks: [], opts: {}, open: -1 };

  function edEsc(s) { return esc(s); }

  function field(label, name, value, opts) {
    opts = opts || {};
    var id = "hmf-" + name + "-" + Math.random().toString(36).slice(2, 7);
    var input;
    if (opts.textarea) {
      input = '<textarea id="' + id + '" data-hmf="' + name + '" rows="' + (opts.rows || 2) + '" maxlength="' +
        (opts.maxlength || 2000) + '" placeholder="' + edEsc(opts.placeholder || "") + '">' + edEsc(value) + "</textarea>";
    } else if (opts.select) {
      input = '<select id="' + id + '" data-hmf="' + name + '">' + opts.select.map(function (o) {
        return '<option value="' + edEsc(o[0]) + '"' + (String(o[0]) === String(value) ? " selected" : "") + ">" +
          edEsc(o[1]) + "</option>";
      }).join("") + "</select>";
    } else {
      input = '<input id="' + id + '" data-hmf="' + name + '" type="' + (opts.type || "text") + '" value="' + edEsc(value) +
        '" maxlength="' + (opts.maxlength || 200) + '" placeholder="' + edEsc(opts.placeholder || "") + '">';
    }
    return '<label class="hm-field"><span>' + label + "</span>" + input + "</label>";
  }

  function blockFields(b, i, opts) {
    if (b.type === "posts" || b.type === "popular") {
      var boards = [["all", "전체 게시판"]].concat((opts.boards || []).map(function (x) { return [x.slug, x.name]; }));
      return '<div class="hm-grid2">' +
        field("게시판", "board", b.board, { select: boards }) +
        field("글 수", "count", b.count, { select: [["3", "3개"], ["6", "6개"], ["9", "9개"]] }) +
        "</div>" + field("제목", "title", b.title, { maxlength: 80, placeholder: b.type === "popular" ? "인기글" : "최신 소식" });
    }
    if (b.type === "map") {
      return field("제목", "title", b.title, { maxlength: 80 }) +
        field("설명 <em>선택</em>", "desc_text", b.desc_text, { textarea: true, maxlength: 300 });
    }
    if (b.type === "form") {
      return '<div class="hm-grid2">' +
        field("폼 종류", "kind", b.kind, {
          select: [["newsletter", "뉴스레터 구독"], ["submit", "공방 등록·제보"]]
        }) +
        field("버튼 글자", "button", b.button, { maxlength: 30, placeholder: "구독하기" }) +
        "</div>" + field("제목", "title", b.title, { maxlength: 80 }) +
        field("설명", "desc_text", b.desc_text, { textarea: true, maxlength: 300 });
    }
    if (b.type === "gallery") {
      var imgs = "";
      if (b.source === "own") {
        imgs = '<div class="hm-imgs">' + (b.images || []).map(function (im, k) {
          return '<div class="hm-img-row"><span class="hm-img-thumb">' +
            (im.url ? '<img src="' + edEsc(absUrl(im.url)) + '" alt="">' : "") + "</span>" +
            '<input class="admin-input" data-hmi="url" data-i="' + k + '" value="' + edEsc(im.url) + '" placeholder="이미지 주소(URL)">' +
            '<input class="admin-input" data-hmi="caption" data-i="' + k + '" value="' + edEsc(im.caption) + '" placeholder="설명" maxlength="160">' +
            '<button type="button" class="mini" data-hmimg="up" data-i="' + k + '"' + (k === 0 ? " disabled" : "") + ">↑</button>" +
            '<button type="button" class="mini" data-hmimg="down" data-i="' + k + '"' + (k === b.images.length - 1 ? " disabled" : "") + ">↓</button>" +
            '<button type="button" class="mini" data-hmimg="del" data-i="' + k + '">삭제</button></div>';
        }).join("") + "</div>" +
          '<div class="hm-img-tools"><input type="file" accept="image/*" multiple class="sr-only" data-hmimgfile="1" id="hm-file-' + i + '">' +
          '<label for="hm-file-' + i + '" class="btn btn-ghost btn-sm">사진 올리기</label>' +
          '<input class="admin-input" data-hmimgurl="1" placeholder="또는 이미지 주소(URL)">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-hmimgadd="1">주소로 추가</button></div>';
      }
      return '<div class="hm-grid2">' +
        field("사진", "source", b.source, { select: [["page", "이 페이지 사진 사용"], ["own", "블록 전용 사진"]] }) +
        field("제목 <em>선택</em>", "title", b.title, { maxlength: 80 }) +
        "</div>" + imgs;
    }
    if (b.type === "text") {
      return field("제목", "title", b.title, { maxlength: 100 }) +
        field("본문", "body", b.body, { textarea: true, rows: 3, maxlength: 1200, placeholder: "줄바꿈 그대로 표시됩니다." }) +
        '<div class="hm-grid3">' +
        field("버튼 글자", "cta_label", b.cta_label, { maxlength: 30, placeholder: "선택" }) +
        field("버튼 링크", "cta_url", b.cta_url, { maxlength: 500, placeholder: "#/map 또는 https://" }) +
        field("모양", "tone", b.tone, { select: [["soft", "밝은 배너"], ["dark", "어두운 배너"], ["plain", "텍스트만"]] }) +
        "</div>";
    }
    return "";
  }

  function renderEditor() {
    var root = editorState.root;
    if (!root) return;
    var blocks = editorState.blocks;
    var opts = editorState.opts;
    var html = "";
    if (!blocks.length) {
      html = '<p class="hm-empty-editor">아직 hunmin 블록이 없습니다. 아래에서 골라 추가하면 페이지 본문 위에 순서대로 나타납니다.</p>';
    }
    html += '<div class="hm-block-list">' + blocks.map(function (b, i) {
      var def = typeDef(b.type) || { label: b.type, desc: "", icon: "doc" };
      return '<article class="hm-block-card" data-i="' + i + '" data-type="' + edEsc(b.type) + '">' +
        '<header class="hm-block-head">' +
          '<span class="hm-block-no">' + (i + 1) + "</span>" +
          '<span class="hm-block-type"><svg width="15" height="15" aria-hidden="true"><use href="#i-' + edEsc(def.icon) + '"/></svg>' +
            edEsc(def.label) + ' <code>' + edEsc(b.type) + "</code></span>" +
          '<span class="hm-block-tools">' +
            '<button type="button" class="mini" data-hm="up" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="위로">↑</button>' +
            '<button type="button" class="mini" data-hm="down" data-i="' + i + '"' + (i === blocks.length - 1 ? " disabled" : "") + ' aria-label="아래로">↓</button>' +
            '<button type="button" class="mini danger" data-hm="del" data-i="' + i + '">삭제</button>' +
          "</span></header>" +
        '<div class="hm-block-body">' + blockFields(b, i, opts) + "</div></article>";
    }).join("") + "</div>";
    html += '<div class="hm-add"><span class="hm-add-label">hunmin 블록 추가</span>' +
      TYPES.map(function (t) {
        return '<button type="button" class="hm-add-btn" data-hmadd="' + t.type + '" title="' + edEsc(t.desc) + '">' +
          '<svg width="15" height="15" aria-hidden="true"><use href="#i-' + t.icon + '"/></svg>' + edEsc(t.label) + "</button>";
      }).join("") + "</div>";
    root.innerHTML = html;
  }

  function changed() {
    if (editorState.opts.onChange) editorState.opts.onChange(editorState.blocks);
  }

  function bindEditor() {
    var root = editorState.root;
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.addEventListener("input", function (e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute("data-hmf")) {
        var card = t.closest(".hm-block-card");
        var i = card ? +card.getAttribute("data-i") : -1;
        var b = editorState.blocks[i];
        if (!b) return;
        var key = t.getAttribute("data-hmf");
        var v = t.value;
        b[key] = (key === "count") ? (parseInt(v, 10) || 3) : v;
        changed();
      }
      if (t.hasAttribute && t.hasAttribute("data-hmi")) {
        var card2 = t.closest(".hm-block-card");
        var i2 = card2 ? +card2.getAttribute("data-i") : -1;
        var b2 = editorState.blocks[i2];
        if (!b2 || b2.type !== "gallery") return;
        var k = +t.getAttribute("data-i");
        if (!b2.images[k]) return;
        b2.images[k][t.getAttribute("data-hmi")] = t.value;
        changed();
      }
    });

    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute("data-hmf")) {
        var card = t.closest(".hm-block-card");
        var i = card ? +card.getAttribute("data-i") : -1;
        var b = editorState.blocks[i];
        if (!b) return;
        var key = t.getAttribute("data-hmf");
        if (b.type === "gallery" && key === "source") {
          b.source = t.value === "own" ? "own" : "page";
          renderEditor();
          changed();
          return;
        }
        b[key] = (key === "count") ? (parseInt(t.value, 10) || 3) : t.value;
        changed();
      }
      if (t.hasAttribute && t.hasAttribute("data-hmimgfile")) {
        var card3 = t.closest(".hm-block-card");
        var i3 = card3 ? +card3.getAttribute("data-i") : -1;
        var b3 = editorState.blocks[i3];
        if (!b3 || b3.type !== "gallery") return;
        var files = [].slice.call(t.files || []);
        if (!files.length) return;
        var upload = editorState.opts.upload;
        if (!upload) return;
        var chain = Promise.resolve();
        files.forEach(function (f) {
          chain = chain.then(function () {
            return upload(f).then(function (url) { b3.images.push({ url: url, caption: "" }); renderEditor(); });
          });
        });
        chain.then(function () { changed(); t.value = ""; });
      }
    });

    root.addEventListener("click", function (e) {
      var add = e.target.closest ? e.target.closest("[data-hmadd]") : null;
      if (add) {
        var def = typeDef(add.getAttribute("data-hmadd"));
        if (!def) return;
        editorState.blocks.push(normalize(JSON.parse(JSON.stringify(def.defaults))));
        renderEditor();
        changed();
        return;
      }
      var act = e.target.closest ? e.target.closest("[data-hm]") : null;
      if (act) {
        var i = +act.getAttribute("data-i");
        var list = editorState.blocks;
        if (act.getAttribute("data-hm") === "del") list.splice(i, 1);
        else {
          var j = i + (act.getAttribute("data-hm") === "up" ? -1 : 1);
          if (j < 0 || j >= list.length) return;
          var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
        }
        renderEditor();
        changed();
        return;
      }
      var img = e.target.closest ? e.target.closest("[data-hmimg]") : null;
      if (img) {
        var card = img.closest(".hm-block-card");
        var bi = card ? +card.getAttribute("data-i") : -1;
        var b = editorState.blocks[bi];
        if (!b || b.type !== "gallery") return;
        var k = +img.getAttribute("data-i");
        var what = img.getAttribute("data-hmimg");
        if (what === "del") b.images.splice(k, 1);
        else {
          var k2 = k + (what === "up" ? -1 : 1);
          if (k2 < 0 || k2 >= b.images.length) return;
          var t2 = b.images[k]; b.images[k] = b.images[k2]; b.images[k2] = t2;
        }
        renderEditor();
        changed();
        return;
      }
      var add2 = e.target.closest ? e.target.closest("[data-hmimgadd]") : null;
      if (add2) {
        var card4 = add2.closest(".hm-block-card");
        var bi2 = card4 ? +card4.getAttribute("data-i") : -1;
        var b4 = editorState.blocks[bi2];
        var input = card4 ? card4.querySelector("[data-hmimgurl]") : null;
        if (!b4 || !input) return;
        var url = (input.value || "").trim();
        if (!url) { input.focus(); return; }
        b4.images.push({ url: url, caption: "" });
        renderEditor();
        changed();
      }
    });
  }

  var editor = {
    mount: function (container, blocks, options) {
      editorState.root = container;
      editorState.blocks = Array.isArray(blocks) ? blocks : [];
      editorState.opts = options || {};
      if (container) container.dataset.bound = "";
      bindEditor();
      renderEditor();
      return editorState.blocks;
    },
    blocks: function () { return editorState.blocks; },
    render: renderEditor
  };

  window.CRAFT_HUNMIN = {
    name: "hunmin",
    version: "1.0",
    types: TYPES,
    normalize: normalize,
    normalizeList: normalizeList,
    render: render,
    editor: editor
  };
})();
