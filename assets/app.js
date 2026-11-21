/* ===== 전국공방 app ===== */
(function () {
  "use strict";

  var S = window.SITE;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var NS = "http://www.w3.org/2000/svg";
  var TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

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
  function md(iso) { // 2026-11-20 -> 11.20
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? Number(m[2]) + "." + Number(m[3]) : "";
  }
  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? m[2] + "-" + m[3] : "";
  }
  function normal(s) { return String(s || "").replace(/[\s()·\-_.]/g, "").toLowerCase(); }

  /* ---------------- static links ---------------- */
  var L = S.links;
  var linkMap = {
    "register-link": L.register, "register-link-2": L.register, "foot-form": L.register,
    "cta-newsletter": L.newsletter,
    "foot-newsletter": L.newsletter, "foot-insta": L.instagram,
    "foot-sites": L.sites, "foot-sheet": L.sheet, "sheet-link": L.sheet
  };
  Object.keys(linkMap).forEach(function (id) {
    var n = document.getElementById(id);
    if (n) n.href = linkMap[id];
  });
  var ARC = window.ARCHIVE;
  ["arc-doc", "arc-home-doc"].forEach(function (id) {
    var n = document.getElementById(id);
    if (n && ARC) n.href = ARC.docUrl;
  });

  /* ---------------- counts ---------------- */
  var counts = { workshops: 0, news: 0, interview: 0, info: 0 };
  var total = 0;
  function recomputeCounts() {
    counts.workshops = S.workshops.length;
    counts.news = S.news.length;
    counts.interview = S.interviews.length;
    counts.info = S.info.length;
    total = counts.workshops + counts.news + counts.interview + counts.info;
  }
  recomputeCounts();
  var cornerRecords = {
    workshops: S.workshops[0], news: S.news[0], interview: S.interviews[0], info: S.info[0]
  };
  var cornerTitle = {
    workshops: S.workshops[0].name, news: S.news[0].title,
    interview: S.interviews[0].title, info: S.info[0].title
  };

  /* ---------------- 댓글 버튼 붙이기 (assets/cms.js) ---------------- */
  function cmt(node, key, title, image) {
    if (window.CRAFT_CMS && key) window.CRAFT_CMS.attach(node, key, title, image);
  }

  /* ---------------- hero ---------------- */
  function renderHeroMeta() {
    $("#hero-meta").innerHTML = [
      "<span><i>●</i>업데이트 " + md(S.updated) + "</span>",
      "<span>소식 <b>" + total + "</b>건</span>",
      "<span>등록 공방 <b>" + counts.workshops + "</b>곳</span>",
      "<span>아카이브 <b>" + (window.ARCHIVE ? window.ARCHIVE.total : 0) + "</b>건</span>",
      "<span>매주 금요일 오전</span>"
    ].join("");
  }
  $("#hero-week").textContent = "우리동네공방 · 2026년 11월 넷째 주";
  $("#hero-lede").textContent =
    "이번 주 전국 공방 소식 " + total + "건을 소개·뉴스·인터뷰·정보 네 코너로 정리했습니다. 등록된 공방은 지도와 게시판에서 지역과 분야로 찾아보세요.";
  renderHeroMeta();

  /* keywords */
  var kw = $("#keywords");
  S.keywords.forEach(function (k) { kw.appendChild(el("li", null, esc(k))); });

  /* ---------------- corners ---------------- */
  function renderCorners() {
    var cornerEl = $("#corners");
    if (!cornerEl) return;
    cornerEl.innerHTML = "";
    S.corners.forEach(function (c) {
      var n = counts[c.key];
      var card = el("a", "corner");
      card.href = "#/" + c.key;
      card.innerHTML =
        '<span class="corner-ico"><svg width="22" height="22" aria-hidden="true"><use href="#i-' + c.icon + '"/></svg></span>' +
        "<h3>" + c.label + " <span>" + c.en + "</span></h3>" +
        "<p>" + esc(c.desc) + "</p>" +
        '<span class="count"><b>' + n + "</b>건</span>" +
        '<span class="arrow"><svg width="18" height="18" aria-hidden="true"><use href="#i-arrow"/></svg></span>';
      cornerEl.appendChild(card);
    });
  }
  renderCorners();

  /* ---------------- featured ---------------- */
  var F = S.featured;
  var feat = $("#featured");
  var main = el("a", "feature-main");
  main.href = F.main.url; main.target = "_blank"; main.rel = "noopener";
  main.innerHTML =
    '<div><span class="tag">' + esc(F.main.tag) + "</span>" +
    "<h3>" + esc(F.main.title) + "</h3>" +
    "<p>" + esc(F.main.desc) + "</p></div>" +
    '<div class="meta"><span>' + esc(F.main.sub) + " · " + esc(F.main.meta) + "</span>" +
    '<span class="go">원문 보기 <svg width="14" height="14" aria-hidden="true"><use href="#i-ext"/></svg></span></div>';
  feat.appendChild(main);

  var side = el("div", "feature-side");
  F.side.forEach(function (it) {
    var a = el("a", "feature-item");
    a.href = it.url; a.target = "_blank"; a.rel = "noopener";
    a.innerHTML = '<span class="tag">' + esc(it.tag) + "</span>" +
      "<h4>" + esc(it.title) + '</h4><span class="meta">' + esc(it.meta) + "</span>";
    side.appendChild(a);
  });
  feat.appendChild(side);

  /* ---------------- stats ---------------- */
  function renderStats() {
    var stats = [
      [total, "건", "이번 주 새 소식"],
      [counts.workshops, "곳", "등록된 공방"],
      [17, "개", "시·도 단위 지도"],
      [4, "개", "소개·뉴스·인터뷰·정보"]
    ];
    var statBox = $("#stats");
    statBox.innerHTML = "";
    stats.forEach(function (s) {
      statBox.appendChild(el("div", "stat",
        "<b>" + s[0] + "<i>" + s[1] + "</i></b><span>" + s[2] + "</span>"));
    });
  }
  renderStats();

  /* ---------------- workshops ---------------- */
  var wg = $("#workshop-grid");
  S.workshops.forEach(function (w) {
    var card = el("article", "ws");
    card.dataset.name = w.name;
    card.innerHTML =
      '<div class="ws-top"><h3>' + esc(w.name) + "</h3>" +
      '<div class="chips"><span class="chip region">' + esc(w.region) + "</span></div></div>" +
      '<div class="chips"><span class="chip">' + esc(w.craft) + "</span>" +
      '<span class="chip oneday">원데이 ' + esc(w.oneday) + "</span></div>" +
      '<p class="addr"><svg width="15" height="15" aria-hidden="true"><use href="#i-pin"/></svg><span>' + esc(w.address) + "</span></p>" +
      "<p>" + esc(w.desc) + "</p>" +
      '<div class="ws-foot"><span class="ws-note">' + esc(w.note) + "</span>" +
      '<span class="ws-actions">' +
      '<span data-cmt></span>' +
      '<button class="mini" type="button" data-map="' + esc(w.name) + '"><svg width="13" height="13" aria-hidden="true"><use href="#i-map"/></svg>지도에서 보기</button>' +
      '<a class="mini" href="' + esc(w.url) + '" target="_blank" rel="noopener">자료 <svg width="12" height="12" aria-hidden="true"><use href="#i-ext"/></svg></a>' +
      "</span></div>";
    if (window.CRAFT_AUTH) window.CRAFT_AUTH.attachBookmark(card, w.name);
    cmt(card, "workshop:" + w.name, w.name);
    wg.appendChild(card);
  });

  var cg = $("#cat-grid");
  S.categories.forEach(function (c) {
    cg.appendChild(el("div", "cat",
      "<b>" + esc(c.name) + "<i>" + c.count + "곳</i></b><p>" + esc(c.desc) + "</p>"));
  });

  /* ---------------- 소개 코너 기사 (data.js 의 intro) ---------------- */
  function newsRow(it, i) {
    var row = el("article", "news-item");
    row.innerHTML =
      '<div class="news-num">' + String(i + 1).padStart(2, "0") + "</div>" +
      '<div class="news-body"><h3><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a></h3>" +
      "<p>" + esc(it.desc) + "</p>" +
      '<div class="news-tags">' + (it.tag ? '<span class="chip">' + esc(it.tag) + "</span>" : "") +
      (it.region ? '<span class="chip region">' + esc(it.region) + "</span>" : "") + "</div></div>" +
      '<div class="news-side"><span class="src">' + esc(it.source) + "</span><span>" + shortDate(it.date) + "</span>" +
      '<span data-cmt></span>' +
      '<a class="ext" href="' + esc(it.url) + '" target="_blank" rel="noopener">원문 <svg width="12" height="12" aria-hidden="true"><use href="#i-ext"/></svg></a></div>';
    cmt(row, it.slug, it.title, it.image);
    return row;
  }

  function renderIntro() {
    var introList = $("#intro-list");
    if (!introList) return;
    introList.innerHTML = "";
    (S.intro || []).forEach(function (it, i) { introList.appendChild(newsRow(it, i)); });
  }

  function renderNews() {
    var nl = $("#news-list");
    if (!nl) return;
    nl.innerHTML = "";
    S.news.forEach(function (it, i) { nl.appendChild(newsRow(it, i)); });
    $("#news-lede").textContent =
      "업계 지표부터 지역 공방 거리, 팝업과 페어까지 " + S.news.length +
      "건입니다. " + shortDate(S.weekFrom) + " ~ " + shortDate(S.weekTo) + " 보도 기준, 원문 링크로 바로 이동할 수 있습니다.";
  }
  renderIntro();
  renderNews();

  /* ---------------- interviews ---------------- */
  function renderInterviews() {
    var ivg = $("#iv-grid");
    if (!ivg) return;
    ivg.innerHTML = "";
    S.interviews.forEach(function (it) {
      var card = el("article", "iv");
      var who = String(it.person || "·").charAt(0);
      card.innerHTML =
        '<span class="qmark" aria-hidden="true">“</span>' +
        "<blockquote>" + esc(it.quote) + "</blockquote>" +
        "<p>" + esc(it.desc) + "</p>" +
        '<div class="iv-who"><span class="iv-avatar">' + esc(who) + "</span>" +
        "<span><b>" + esc(it.person) + "</b><span>" + esc(it.role) + " · " + esc(it.source) + " " + shortDate(it.date) + "</span></span>" +
        '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">인터뷰 읽기 <svg width="12" height="12" aria-hidden="true"><use href="#i-ext"/></svg></a></div>' +
        '<div class="cmt-slot" data-cmt></div>';
      cmt(card, it.slug, it.title, it.image);
      ivg.appendChild(card);
    });
  }
  renderInterviews();

  /* ---------------- archive (2024–2026) ---------------- */
  var A = window.ARCHIVE;

  function arcIssueById(id) {
    if (!A) return null;
    for (var i = 0; i < A.issues.length; i++) if (A.issues[i].id === id) return A.issues[i];
    return null;
  }

  var arcState = { issue: "all", corner: "전체", q: "" };

  function arcCornerCount(c) {
    return A.items.filter(function (it) { return it.corner === c; }).length;
  }

  function renderArcStats() {
    var box = $("#arc-stats");
    if (!box) return;
    var first = A.issues[0].first.replace(/-/g, ".");
    var last = A.issues[A.issues.length - 1].last.replace(/-/g, ".");
    box.innerHTML =
      "<div><b>" + A.total + "<i>건</i></b><span>아카이브 기사</span></div>" +
      "<div><b>" + A.issues.length + "<i>개 호</i></b><span>① 24년 ~ ⑧ " + A.issues[A.issues.length - 1].label + "</span></div>" +
      "<div><b>" + A.corners.length + "<i>개 코너</i></b><span>소개 " + arcCornerCount("소개") + " · 뉴스 " + arcCornerCount("뉴스") +
      " · 인터뷰 " + arcCornerCount("인터뷰") + " · 정보 " + arcCornerCount("정보") + "</span></div>" +
      "<div><b>3<i>년</i></b><span>" + first + " – " + last + " 수집</span></div>";
  }

  function renderArcHomeStats() {
    var box = $("#arc-home-stats");
    if (!box || !A) return;
    box.innerHTML = [
      [A.total, "건", "아카이브 기사"],
      [A.issues.length, "개", "호 (24년~26년 11월)"],
      [A.corners.length, "개", "소개·뉴스·인터뷰·정보"],
      [3, "년", "2023.12 – 2026.11"]
    ].map(function (s) {
      return "<li><b>" + s[0] + "<i>" + s[1] + "</i></b><span>" + s[2] + "</span></li>";
    }).join("");
  }

  function renderArcFilters() {
    var iBox = $("#arc-issues"), cBox = $("#arc-corners");
    if (!iBox || !cBox) return;

    var all = el("button", "arc-chip");
    all.type = "button";
    all.dataset.issue = "all";
    all.setAttribute("aria-pressed", "true");
    all.innerHTML = "전체 호 <i>" + A.total + "</i>";
    all.addEventListener("click", function () { setArc("issue", "all"); });
    iBox.appendChild(all);

    A.issues.forEach(function (is) {
      var b = el("button", "arc-chip");
      b.type = "button";
      b.dataset.issue = is.id;
      b.setAttribute("aria-pressed", "false");
      b.title = is.title + " · " + is.range;
      b.innerHTML = '<span class="no">' + is.no + "</span>" + esc(is.label) + " <i>" + is.count + "</i>";
      b.addEventListener("click", function () { setArc("issue", is.id); });
      iBox.appendChild(b);
    });

    var cAll = el("button", "arc-chip");
    cAll.type = "button";
    cAll.dataset.corner = "전체";
    cAll.setAttribute("aria-pressed", "true");
    cAll.innerHTML = "전체 코너 <i>" + A.total + "</i>";
    cAll.addEventListener("click", function () { setArc("corner", "전체"); });
    cBox.appendChild(cAll);

    A.corners.forEach(function (c) {
      var b = el("button", "arc-chip");
      b.type = "button";
      b.dataset.corner = c;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = esc(c) + " <i>" + arcCornerCount(c) + "</i>";
      b.addEventListener("click", function () { setArc("corner", c); });
      cBox.appendChild(b);
    });
  }

  function setArc(kind, value) {
    arcState[kind] = value;
    renderArc();
  }

  function arcMatch(it) {
    if (arcState.issue !== "all" && it.issue !== arcState.issue) return false;
    if (arcState.corner !== "전체" && it.corner !== arcState.corner) return false;
    var q = arcState.q.trim().toLowerCase();
    if (!q) return true;
    var issue = arcIssueById(it.issue) || {};
    var hay = [it.title, it.summary, it.source, it.date, it.corner, issue.label, issue.title, it.url]
      .join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function arcCard(it, showIssue) {
    var issue = arcIssueById(it.issue) || { no: "", label: "" };
    var card = el("article", "acard");
    card.innerHTML =
      '<div class="acard-top">' +
      '<span class="chip arc-corner" data-c="' + esc(it.corner) + '">' + esc(it.corner) + "</span>" +
      (showIssue ? '<span class="issue-badge">' + issue.no + " " + esc(issue.short) + "</span>" : "") +
      '<span class="date">' + esc(it.date) + "</span></div>" +
      '<h4><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a></h4>" +
      "<p>" + esc(it.summary) + "</p>" +
      '<div class="acard-foot"><span class="src">' + esc(it.source) + "</span>" +
      '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">원문 <svg width="11" height="11" aria-hidden="true"><use href="#i-ext"/></svg></a></div>';
    return card;
  }

  function renderArc() {
    var list = $("#arc-list");
    if (!list || !A) return;

    [].forEach.call(document.querySelectorAll("#arc-issues .arc-chip"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.issue === arcState.issue ? "true" : "false");
    });
    [].forEach.call(document.querySelectorAll("#arc-corners .arc-chip"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.corner === arcState.corner ? "true" : "false");
    });

    var rows = A.items.filter(arcMatch);
    $("#arc-count").innerHTML = (rows.length === A.total
      ? "전체 <b>" + A.total + "</b>건 · " + A.issues.length + "개 호"
      : "전체 " + A.total + "건 중 <b>" + rows.length + "</b>건");

    var lead = $("#arc-lead");
    var cur = arcState.issue === "all" ? null : arcIssueById(arcState.issue);
    if (cur && lead) {
      lead.hidden = false;
      lead.innerHTML = "<b>" + cur.no + " " + esc(cur.title) + " · " + esc(cur.range) + " · " + cur.count + "건</b><p>" + esc(cur.lead) + "</p>";
    } else if (lead) {
      lead.hidden = true;
      lead.innerHTML = "";
    }

    list.innerHTML = "";
    if (!rows.length) {
      list.appendChild(el("div", "empty", "해당하는 기사가 없습니다. 호·코너 필터나 검색어를 바꿔 보세요."));
      return;
    }

    var groups = arcState.issue === "all"
      ? A.issues.map(function (is) {
          return { issue: is, items: rows.filter(function (it) { return it.issue === is.id; }) };
        }).filter(function (g) { return g.items.length; })
      : [{ issue: cur, items: rows }];

    groups.forEach(function (g) {
      var box = el("section", "arc-group");
      if (arcState.issue === "all") {
        box.appendChild(el("div", "arc-group-head",
          '<h3><span class="no">' + g.issue.no + "</span>" + esc(g.issue.title) + "</h3>" +
          '<span class="range">' + esc(g.issue.range) + "</span>" +
          '<span class="n"><b>' + g.items.length + "</b>건" + (g.items.length !== g.issue.count ? " / " + g.issue.count + "건" : "") + "</span>"));
      }
      var cards = el("div", "arc-cards");
      g.items.forEach(function (it) { cards.appendChild(arcCard(it, arcState.issue === "all")); });
      box.appendChild(cards);
      list.appendChild(box);
    });
  }

  function initArc() {
    if (!A || !$("#arc-list")) return;
    renderArcStats();
    renderArcHomeStats();
    renderArcFilters();
    renderArc();

    var q = $("#arc-q");
    var qc = $("#arc-q-clear");
    q.addEventListener("input", function () {
      arcState.q = q.value;
      qc.classList.toggle("show", !!q.value);
      renderArc();
    });
    qc.addEventListener("click", function () {
      q.value = ""; arcState.q = ""; qc.classList.remove("show"); q.focus(); renderArc();
    });

    var lead = $("#archive-lead");
    if (lead) lead.textContent = "8개 호 " + A.total + "건의 소개·뉴스·인터뷰·정보를 한 번에 볼 수 있습니다.";
  }

  /* ---------------- info ---------------- */
  function dueState(due) {
    if (!due) return { label: "진행 중", cls: "" };
    var d = new Date(due.length <= 10 ? due + "T23:59:59" : due);
    var diff = d - new Date();
    if (diff < 0) return { label: "마감", cls: "closed" };
    var dd = new Date(d); dd.setHours(0, 0, 0, 0);
    var days = Math.round((dd - TODAY) / 86400000);
    if (days === 0) return { label: "오늘 마감", cls: "soon" };
    if (days <= 7) return { label: "D-" + days, cls: "soon" };
    return { label: "D-" + days, cls: "soon-2" };
  }

  var infoState = { kind: "전체" };
  function renderInfo() {
    var list = $("#info-list");
    list.innerHTML = "";
    var items = S.info.slice();
    // open items by due asc, then no-deadline, then closed by due desc
    var nowMs = Date.now();
    function dueMs(it) {
      if (!it.due) return null;
      return new Date(it.due.length <= 10 ? it.due + "T23:59:59" : it.due).getTime();
    }
    items.sort(function (a, b) {
      var ad = dueMs(a), bd = dueMs(b);
      var ao = ad === null ? 1 : (ad < nowMs ? 2 : 0);
      var bo = bd === null ? 1 : (bd < nowMs ? 2 : 0);
      if (ao !== bo) return ao - bo;
      if (ao === 2) return bd - ad;
      if (ad === null || bd === null) return ad === null ? 1 : -1;
      return ad - bd;
    });
    var shown = items.filter(function (it) { return infoState.kind === "전체" || it.kind === infoState.kind; });
    if (!shown.length) { list.appendChild(el("div", "empty", "해당하는 정보가 없습니다.")); return; }
    shown.forEach(function (it) {
      var st = dueState(it.due);
      var row = el("article", "info-item");
      row.innerHTML =
        '<div class="info-date"><b' + (it.due ? "" : ' class="loose"') + ">" + (it.due ? md(it.due) : "상시") + "</b>" +
        '<span class="dday ' + st.cls + '">' + st.label + "</span></div>" +
        '<div class="info-body"><h3>' + esc(it.title) + "</h3>" +
        '<div class="meta"><span class="kind">' + esc(it.kind) + "</span><span>" + esc(it.org) + "</span><span>" + esc(it.period) + "</span><span data-cmt></span></div>" +
        "<p>" + esc(it.desc) + "</p></div>" +
        '<a class="info-go" href="' + esc(it.url) + '" target="_blank" rel="noopener">자세히 <svg width="13" height="13" aria-hidden="true"><use href="#i-ext"/></svg></a>';
      cmt(row, it.slug, it.title, it.image);
      list.appendChild(row);
    });
  }

  function renderInfoFilters() {
    var box = $("#info-filters");
    if (!box) return;
    box.innerHTML = "";
    var kinds = ["전체"];
    S.info.forEach(function (it) { if (kinds.indexOf(it.kind) < 0) kinds.push(it.kind); });
    if (kinds.indexOf(infoState.kind) < 0) infoState.kind = "전체";
    kinds.forEach(function (k) {
      var b = el("button", "fchip");
      b.type = "button";
      b.setAttribute("aria-pressed", k === infoState.kind ? "true" : "false");
      var n = k === "전체" ? S.info.length : S.info.filter(function (i) { return i.kind === k; }).length;
      b.innerHTML = esc(k) + "<i>" + n + "</i>";
      b.addEventListener("click", function () {
        infoState.kind = k;
        [].forEach.call(box.children, function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        renderInfo();
      });
      box.appendChild(b);
    });
  }
  renderInfoFilters();
  renderInfo();

  /* ---------------- board data ---------------- */
  var SRC_NOTE = "구글 시트";
  var board = S.workshops.map(function (w) {
    return {
      name: w.name, craft: w.craft, region: w.region, address: w.address,
      oneday: w.oneday, desc: w.desc, url: w.url, lat: w.lat, lng: w.lng,
      kind: w.kind || "공방 등록", note: w.note || "", live: false
    };
  });
  var liveCount = 0;

  var REGION_KEYS = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원", "충청북도": "충북",
    "충청남도": "충남", "전북특별자치도": "전북", "전라북도": "전북", "전라남도": "전남",
    "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주", "제주도": "제주"
  };
  function normRegion(r) {
    r = String(r || "").trim();
    if (REGION_KEYS[r]) return REGION_KEYS[r];
    for (var k in REGION_KEYS) if (r.indexOf(k.slice(0, 2)) === 0) return REGION_KEYS[k];
    return r.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
  }

  var boardState = { q: "", region: "", craft: "", oneday: false };

  function publishedBoard() {
    return board.filter(function (b) { return b.region || b.name; });
  }

  /* ---------------- map ---------------- */
  var K = window.KOREA;
  var mapBuilt = false;
  var regionCounts = {};

  function xy(lat, lng) {
    var p = K.proj;
    return [p.pad + (lng - p.lonMin) * p.cosMid * p.k, p.pad + (p.latMax - lat) * p.k];
  }
  function provinceCenter(name) {
    for (var i = 0; i < K.provinces.length; i++) {
      if (K.provinces[i].name === name) return K.provinces[i].c;
    }
    return null;
  }

  function buildMap() {
    if (mapBuilt) return;
    mapBuilt = true;
    var svg = $("#korea-map");
    svg.setAttribute("viewBox", "0 0 " + K.w + " " + K.h);
    var gP = $("#map-provinces"), gL = $("#map-labels");
    var labelSkip = { "세종": 1, "인천": 1, "대전": 1, "광주": 1, "대구": 1, "울산": 1 };
    // labels are dropped where a workshop pin sits, so names do not collide
    var pinPts = board.map(function (b) {
      return (b.lat && b.lng) ? xy(b.lat, b.lng) : provinceCenter(b.region);
    }).filter(Boolean);
    function crowded(c) {
      return pinPts.some(function (p) { return Math.hypot(p[0] - c[0], p[1] - c[1]) < 30; });
    }
    K.provinces.forEach(function (p) {
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", p.d);
      path.setAttribute("class", "prov");
      path.dataset.name = p.name;
      var ttl = document.createElementNS(NS, "title");
      ttl.textContent = p.name;
      path.appendChild(ttl);
      path.addEventListener("click", function () {
        setRegion(boardState.region === p.name ? "" : p.name, true);
      });
      gP.appendChild(path);

      if (!labelSkip[p.name] && !crowded(p.c)) {
        var t = document.createElementNS(NS, "text");
        t.setAttribute("x", p.c[0]);
        t.setAttribute("y", p.c[1] + (p.name === "서울" ? -12 : 3));
        t.setAttribute("class", "plabel");
        t.dataset.name = p.name;
        t.textContent = p.name;
        gL.appendChild(t);
      }
    });
    renderPins();
  }

  function renderPins() {
    var g = $("#map-pins");
    g.innerHTML = "";
    var regionSeen = {};
    board.forEach(function (b) {
      var pos = (b.lat && b.lng) ? xy(b.lat, b.lng) : provinceCenter(b.region);
      if (!pos) return;
      if (!(b.lat && b.lng)) {
        regionSeen[b.region] = (regionSeen[b.region] || 0) + 1;
        pos = [pos[0] + (regionSeen[b.region] - 1) * 7, pos[1] + (regionSeen[b.region] - 1) * 5];
      }
      b._pos = pos;
      var grp = document.createElementNS(NS, "g");
      grp.setAttribute("class", "pin" + (b.lat && b.lng ? "" : " region"));
      grp.dataset.region = b.region;
      grp.dataset.name = b.name;
      grp.setAttribute("transform", "translate(" + pos[0].toFixed(1) + "," + pos[1].toFixed(1) + ")");
      var halo = document.createElementNS(NS, "circle");
      halo.setAttribute("r", "15"); halo.setAttribute("class", "halo");
      var core = document.createElementNS(NS, "circle");
      core.setAttribute("r", "7"); core.setAttribute("class", "core");
      var ttl = document.createElementNS(NS, "title");
      ttl.textContent = b.name + " · " + b.region + (b.lat && b.lng ? "" : " (지역 중심)");
      grp.appendChild(ttl); grp.appendChild(halo); grp.appendChild(core);
      if (b.lat && b.lng) {
        var t = document.createElementNS(NS, "text");
        var anchor = pos[0] > K.w - 120 ? "end" : "start";
        t.style.textAnchor = anchor;
        t.setAttribute("x", anchor === "end" ? "-13" : "13");
        t.setAttribute("y", "3.5");
        t.textContent = b.name.replace(/\s*\(.*$/, "");
        grp.appendChild(t);
      }
      grp.addEventListener("click", function (e) {
        e.stopPropagation();
        setRegion(b.region, false);
        boardState.q = b.name;
        $("#q").value = b.name;
        $("#q-clear").classList.add("show");
        renderBoard();
        var card = $('#board-grid .bcard[data-name="' + b.name.replace(/"/g, '\\"') + '"]');
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.classList.add("flash");
          setTimeout(function () { card.classList.remove("flash"); }, 1800);
        }
      });
      g.appendChild(grp);
    });
    paintMap();
  }

  function paintMap() {
    var sel = boardState.region;
    [].forEach.call(document.querySelectorAll("#korea-map .prov"), function (p) {
      var isOn = sel && p.dataset.name === sel;
      p.classList.toggle("on", !!isOn);
      p.classList.toggle("has-shop", !sel && board.some(function (b) { return b.region === p.dataset.name; }));
    });
    [].forEach.call(document.querySelectorAll("#korea-map .plabel"), function (t) {
      t.classList.toggle("on", !!sel && t.dataset.name === sel);
    });
    [].forEach.call(document.querySelectorAll("#korea-map .pin"), function (p) {
      p.classList.toggle("active", !!sel && p.dataset.region === sel);
    });
  }

  function renderRegions() {
    var box = $("#region-bars");
    box.innerHTML = "";
    regionCounts = {};
    board.forEach(function (b) { regionCounts[b.region] = (regionCounts[b.region] || 0) + 1; });
    var entries = Object.keys(regionCounts).map(function (k) { return [k, regionCounts[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    var totaln = board.length || 1;
    entries.forEach(function (e) {
      var b = el("button", "rbar");
      b.type = "button";
      b.dataset.region = e[0];
      b.setAttribute("aria-pressed", boardState.region === e[0] ? "true" : "false");
      b.innerHTML = "<span>" + esc(e[0]) + '</span><span class="track"><i style="width:' +
        Math.max(10, Math.round(e[1] / totaln * 100)) + '%"></i></span><b>' + e[1] + "</b>";
      b.addEventListener("click", function () {
        setRegion(boardState.region === e[0] ? "" : e[0], false);
      });
      box.appendChild(b);
    });
    if (!entries.length) box.appendChild(el("div", "empty", "아직 등록된 공방이 없습니다."));
    renderRegionStats();
  }

  function renderRegionStats() {
    var box = $("#region-stats");
    if (!box) return;
    var oneday = board.filter(function (b) { return /^(예|가능|운영)/.test(String(b.oneday || "")); }).length;
    var crafts = {};
    board.forEach(function (b) { if (b.craft) crafts[b.craft] = 1; });
    var regions = Object.keys(regionCounts).length;
    box.innerHTML =
      "<div><b>" + board.length + "<i>곳</i></b><span>등록 공방</span></div>" +
      "<div><b>" + oneday + "<i>곳</i></b><span>원데이 가능</span></div>" +
      "<div><b>" + Object.keys(crafts).length + "<i>개</i></b><span>분야 · " + regions + "개 지역</span></div>";
  }

  function setRegion(r, syncMap) {
    boardState.region = r || "";
    var sel = $("#f-region");
    if (sel) sel.value = boardState.region;
    [].forEach.call(document.querySelectorAll("#region-bars .rbar"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.region === boardState.region ? "true" : "false");
    });
    paintMap();
    renderBoard();
  }

  /* ---------------- board ---------------- */
  function fillSelects() {
    var regions = {}, crafts = {};
    board.forEach(function (b) { if (b.region) regions[b.region] = 1; if (b.craft) crafts[b.craft] = 1; });
    var rSel = $("#f-region"), cSel = $("#f-craft");
    var rCur = boardState.region, cCur = boardState.craft;
    rSel.length = 1; cSel.length = 1;
    Object.keys(regions).sort().forEach(function (r) {
      var o = document.createElement("option"); o.value = r; o.textContent = r; rSel.appendChild(o);
    });
    Object.keys(crafts).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; cSel.appendChild(o);
    });
    rSel.value = rCur; cSel.value = cCur;
  }

  function matches(b) {
    var q = boardState.q.trim().toLowerCase();
    if (boardState.region && b.region !== boardState.region) return false;
    if (boardState.craft && b.craft !== boardState.craft) return false;
    if (boardState.oneday && !/^(예|가능|운영)/.test(String(b.oneday || ""))) return false;
    if (!q) return true;
    var hay = [b.name, b.region, b.craft, b.address, b.desc, b.kind, b.oneday].join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function renderBoard() {
    var grid = $("#board-grid");
    grid.innerHTML = "";
    var rows = board.filter(matches);
    $("#board-count").innerHTML = "총 <b>" + rows.length + "</b>곳" +
      (rows.length !== board.length ? " / 전체 " + board.length + "곳" : "");
    if (!rows.length) {
      grid.appendChild(el("div", "empty", "조건에 맞는 공방이 없습니다. 검색어나 필터를 바꿔 보세요."));
      return;
    }
    rows.forEach(function (b) {
      var card = el("article", "bcard");
      card.dataset.name = b.name;
      var coords = (b.lat && b.lng)
        ? b.lat.toFixed(4) + ", " + b.lng.toFixed(4)
        : "지역 중심 표시";
      card.innerHTML =
        '<div class="bcard-top"><div><span class="kind">' + esc(b.kind) + "</span>" +
        "<h3>" + esc(b.name) + "</h3></div>" +
        '<span class="chip oneday">원데이 ' + esc(b.oneday || "협의") + "</span></div>" +
        '<div class="chips"><span class="chip">' + esc(b.craft) + '</span><span class="chip region">' + esc(b.region) + "</span></div>" +
        '<p class="addr"><svg width="14" height="14" aria-hidden="true"><use href="#i-pin"/></svg><span>' + esc(b.address) + "</span></p>" +
        "<p>" + esc(b.desc) + "</p>" +
        '<div class="bcard-foot"><span data-cmt></span><a href="' + esc(b.url) + '" target="_blank" rel="noopener">자료 보기 <svg width="12" height="12" aria-hidden="true"><use href="#i-ext"/></svg></a>' +
        '<span class="coords">' + esc(coords) + "</span></div>";
      if (window.CRAFT_AUTH) window.CRAFT_AUTH.attachBookmark(card, b.name);
      cmt(card, "workshop:" + b.name, b.name);
      grid.appendChild(card);
    });
  }

  /* ---------------- live sheet ---------------- */
  function parseGviz(text) {
    var a = text.indexOf("{"), b = text.lastIndexOf("}");
    var json = JSON.parse(text.slice(a, b + 1));
    var cols = json.table.cols.map(function (c) { return c.label; });
    var idx = function (label) { return cols.indexOf(label); };
    var map = {
      kind: idx("구분"), name: idx("공방명 / 기관명"), craft: idx("분야"), region: idx("지역(시·도)"),
      address: idx("상세 주소"), oneday: idx("원데이클래스 운영 여부"),
      url: idx("홈페이지 / 인스타그램 / 연락처 링크"), desc: idx("한 줄 소개 및 상세 내용"),
      status: idx("승인상태")
    };
    return json.table.rows.map(function (r) {
      var cell = function (i) {
        if (i < 0) return "";
        var c = r.c[i];
        if (!c) return "";
        var v = c.f != null && typeof c.v === "string" && c.v.indexOf("Date(") === 0 ? c.f : c.v;
        return v == null ? "" : String(v).trim();
      };
      return {
        kind: cell(map.kind) || "공방 등록", name: cell(map.name), craft: cell(map.craft),
        region: normRegion(cell(map.region)), address: cell(map.address),
        oneday: cell(map.oneday), url: cell(map.url), desc: cell(map.desc),
        status: cell(map.status)
      };
    });
  }

  function mergeRows(rows) {
    var approved = rows.filter(function (r) {
      var s = r.status.replace(/\s/g, "");
      return r.name && (s === "승인" || s === "승인됨" || s === "O" || s === "○" || s === "yes");
    });
    var pending = rows.filter(function (r) { return r.name && approved.indexOf(r) < 0; }).length;
    liveCount = approved.length;
    approved.forEach(function (r) {
      var dup = board.some(function (b) { return normal(b.name) === normal(r.name); });
      if (dup) return;
      board.push({
        name: r.name, craft: r.craft || "기타", region: r.region || "기타",
        address: r.address, oneday: r.oneday || "협의", desc: r.desc,
        url: r.url || L.sheet, lat: null, lng: null, kind: r.kind, note: "시트 등록", live: true
      });
    });
    board.sort(function (a, b) {
      if (a.lat && !b.lat) return -1;
      if (!a.lat && b.lat) return 1;
      return a.name.localeCompare(b.name, "ko");
    });
    return pending;
  }

  function setStatus(mode, text) {
    var box = $("#sheet-status");
    box.classList.remove("live", "off");
    if (mode) box.classList.add(mode);
    $("#sheet-status-text").innerHTML = text;
  }

  function loadSheet() {
    if (!window.fetch) { setStatus("off", "브라우저가 시트 연동을 지원하지 않아 저장된 목록을 표시합니다."); return; }
    setStatus("", "등록 게시판을 불러오는 중…");
    var url = "https://docs.google.com/spreadsheets/d/" + L.sheetId + "/gviz/tq?tqx=out:json";
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (t) { return parseGviz(t); })
      .then(function (rows) {
        var pending = mergeRows(rows);
        setStatus("live", "구글 시트 연동 · 승인 " + liveCount + "곳" +
          (pending ? " · 검토 중 " + pending + "곳" : "") +
          " · <a href='#' id='reload'>다시 불러오기</a>");
        var rl = $("#reload");
        if (rl) rl.addEventListener("click", function (e) { e.preventDefault(); loadSheet(); });
        fillSelects(); renderRegions(); renderPins(); renderBoard();
      })
      .catch(function () {
        setStatus("off", "시트에 연결하지 못해 저장된 목록을 표시합니다(" + board.length + "곳) · <a href='#' id='reload'>다시 시도</a>");
        var rl = $("#reload");
        if (rl) rl.addEventListener("click", function (e) { e.preventDefault(); loadSheet(); });
        fillSelects(); renderRegions(); renderBoard();
      });
  }

  /* ---------------- board controls ---------------- */
  var q = $("#q");
  q.addEventListener("input", function () {
    boardState.q = q.value;
    $("#q-clear").classList.toggle("show", !!q.value);
    renderBoard();
  });
  $("#q-clear").addEventListener("click", function () {
    q.value = ""; boardState.q = ""; $("#q-clear").classList.remove("show"); q.focus(); renderBoard();
  });
  $("#f-region").addEventListener("change", function (e) { setRegion(e.target.value, false); });
  $("#f-craft").addEventListener("change", function (e) {
    boardState.craft = e.target.value; renderBoard();
  });
  $("#f-oneday").addEventListener("click", function (e) {
    boardState.oneday = !boardState.oneday;
    e.currentTarget.setAttribute("aria-pressed", boardState.oneday ? "true" : "false");
    renderBoard();
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-map]");
    if (!t) return;
    e.preventDefault();
    var name = t.getAttribute("data-map");
    location.hash = "#/map";
    setTimeout(function () {
      boardState.q = name; $("#q").value = name; $("#q-clear").classList.add("show");
      boardState.region = ""; renderBoard();
      var card = $('#board-grid .bcard[data-name="' + name.replace(/"/g, '\\"') + '"]');
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("flash");
        setTimeout(function () { card.classList.remove("flash"); }, 1800);
      }
    }, 60);
  });

  /* ---------------- routing ---------------- */
  var VIEWS = ["home", "workshops", "news", "interview", "archive", "info", "map"];
  var TITLES = {
    home: "전국공방 — 우리 동네 공방의 이번 주 소식",
    workshops: "공방 소개 — 전국공방",
    news: "공방 뉴스 — 전국공방",
    interview: "작가 인터뷰 — 전국공방",
    archive: "아카이브 (2024–2026) 151건 — 전국공방",
    info: "지원·공모 정보 — 전국공방",
    map: "전국 공방 지도 & 등록 게시판 — 전국공방"
  };
  function route(scroll) {
    var v = (location.hash || "#/home").replace(/^#\/?/, "") || "home";
    if (VIEWS.indexOf(v) < 0) v = "home";
    VIEWS.forEach(function (name) {
      var view = document.getElementById("view-" + name);
      if (!view) return;
      var on = name === v;
      view.hidden = !on;
      if (on) {
        view.classList.remove("fade-in");
        void view.offsetWidth;
        view.classList.add("fade-in");
      }
    });
    [].forEach.call(document.querySelectorAll(".tabs .tab"), function (t) {
      t.setAttribute("aria-selected", t.dataset.view === v ? "true" : "false");
    });
    document.title = TITLES[v] || TITLES.home;
    if (v === "map") { buildMap(); }
    if (scroll !== false) window.scrollTo({ top: 0, behavior: "auto" });
  }
  window.addEventListener("hashchange", function () { route(true); });
  [].forEach.call(document.querySelectorAll(".tabs .tab"), function (t) {
    t.addEventListener("click", function () {
      var v = t.dataset.view;
      if (("#/" + v) === location.hash) { route(true); return; }
      location.hash = "#/" + v;
    });
  });

  /* ---------------- init ---------------- */
  fillSelects();
  renderRegions();
  renderBoard();
  loadSheet();
  initArc();
  route(false);

  /* ---------------- 관리자 CMS(cms.js) 가 글·문구를 받아온 뒤 다시 그리기 ---------------- */
  function refreshAll() {
    recomputeCounts();
    renderHeroMeta();
    renderCorners();
    renderStats();
    renderIntro();
    renderNews();
    renderInterviews();
    renderInfoFilters();
    renderInfo();
    renderBoard();
    if (window.CRAFT_CMS) window.CRAFT_CMS.recount();
  }
  window.CRAFT_APP = { refresh: refreshAll };
})();
