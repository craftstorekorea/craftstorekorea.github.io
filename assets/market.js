/* ===== SBPress v10.0 · 플러그인 마켓 탐색기 (assets/market.js) =====
   관리자(/admin · 플러그인 · 마켓)와 공개 화면(#/market)이 함께 쓰는 마켓 화면입니다.

   · 실시간 검색 — 이름·설명·태그·작성자 (한국어·영어 이름 모두)
   · 필터 칩 — 카테고리 · 훅(menu/card/widget/admin-tab/css) · 태그
   · 정렬 — 추천순(order) · 최신 업데이트(updated) · 이름순
   · 카드를 누르면 상세 모달 — 미리보기 그림 · 버전 · 작성자 · 최소 SBPress 버전 ·
     필요 권한 설명 · 변경 이력(changelog) · 설치/켜기/끄기/업데이트/제거(관리자만)

   이 파일은 첫 화면에 넣지 않습니다. 공개 사이트는 #/market 에 들어갈 때(app.js 의
   LAZY_ROUTES), 관리자 화면은 플러그인 탭을 처음 열 때 admin.js 가 SBP.loadScript 로
   받아옵니다 — 300KB 첫 화면 예산을 지키기 위해서입니다.

   보안: 화면에 넣는 모든 값은 esc() 로 이스케이프하고, 인라인 이벤트·eval 을 쓰지 않습니다(CSP).
   설치·제거 같은 쓰기는 이 파일이 하지 않습니다. 관리자 화면이 넘겨준 콜백에 맡깁니다. */
(function () {
  "use strict";

  if (window.SBP_MARKET && window.SBP_MARKET.__v === 10) return;

  var seq = 0;
  var INSTANCES = [];
  var HOOK_ORDER = ["menu", "card", "widget", "admin-tab", "css", "settings"];

  /* ---------------- 문구 (KO · EN) ---------------- */
  var L = {
    ko: {
      eyebrow: "플러그인 마켓 · MARKET",
      title: "SBPress 플러그인 마켓",
      lead: "SBPress 사이트에 기능을 더하는 플러그인 목록입니다. 이름·태그로 찾고, 카드를 눌러 미리보기·필요 권한·변경 이력을 확인하세요. 설치는 관리자 화면에서만 할 수 있습니다.",
      search: "이름·설명·태그·작성자 검색",
      searchAria: "마켓 검색",
      sort: "정렬",
      sortAria: "정렬 방식",
      sortRecommend: "추천순",
      sortLatest: "최신 업데이트",
      sortName: "이름순",
      fCategory: "카테고리",
      fHook: "훅",
      fTag: "태그",
      all: "전체",
      count: "{m}개 표시 · 전체 {n}개",
      empty: "조건에 맞는 플러그인이 없습니다. 검색어나 필터를 바꿔 보세요.",
      emptyMarket: "마켓에 표시할 플러그인이 없습니다. 마켓 주소를 확인해 주세요.",
      loading: "마켓 목록을 불러오는 중…",
      failed: "마켓 목록을 불러오지 못했습니다: ",
      retry: "다시 시도",
      detail: "상세 보기",
      detailShort: "상세",
      detailsOf: "{name} 상세 보기",
      close: "닫기",
      version: "버전",
      author: "작성자",
      updated: "업데이트",
      minVersion: "최소 SBPress",
      currentVersion: "현재 {v}",
      compatOk: "호환",
      compatNo: "v{v} 이상 필요",
      category: "카테고리",
      hooks: "훅",
      tags: "태그",
      permissions: "필요 권한",
      noPermissions: "특별한 권한을 요청하지 않습니다.",
      changelog: "변경 이력",
      noChangelog: "기록된 변경 이력이 없습니다.",
      shots: "미리보기",
      noShot: "미리보기 그림이 없습니다.",
      install: "설치 및 켜기",
      installing: "설치하는 중…",
      turnOn: "켜기",
      turnOff: "끄기",
      update: "v{v} 으로 업데이트",
      remove: "제거",
      installedOn: "설치됨 · 켜짐",
      installedOff: "설치됨 · 꺼짐",
      adminOnly: "설치·켜기·제거는 관리자 화면에서만 할 수 있습니다.",
      goAdmin: "관리자에서 관리",
      unknownPerm: "이 플러그인이 요청한 권한입니다.",
      screenshotAlt: "{name} 미리보기"
    },
    en: {
      eyebrow: "PLUGIN MARKET",
      title: "SBPress plugin market",
      lead: "Plugins that add features to an SBPress site. Search by name or tag, then open a card for screenshots, required permissions and release notes. Installing is available in the admin screen only.",
      search: "Search name, description, tag or author",
      searchAria: "Search the market",
      sort: "Sort",
      sortAria: "Sort order",
      sortRecommend: "Recommended",
      sortLatest: "Recently updated",
      sortName: "Name",
      fCategory: "Category",
      fHook: "Hook",
      fTag: "Tag",
      all: "All",
      count: "{m} shown · {n} in total",
      empty: "No plugin matches these filters. Try another search or filter.",
      emptyMarket: "The market has no plugins yet. Check the market address.",
      loading: "Loading the market…",
      failed: "Could not load the market: ",
      retry: "Try again",
      detail: "View details",
      detailShort: "Details",
      detailsOf: "View details of {name}",
      close: "Close",
      version: "Version",
      author: "Author",
      updated: "Updated",
      minVersion: "Minimum SBPress",
      currentVersion: "current {v}",
      compatOk: "Compatible",
      compatNo: "Needs v{v}+",
      category: "Category",
      hooks: "Hooks",
      tags: "Tags",
      permissions: "Permissions",
      noPermissions: "This plugin requests no special permissions.",
      changelog: "Release notes",
      noChangelog: "No release notes recorded.",
      shots: "Preview",
      noShot: "No preview image.",
      install: "Install and enable",
      installing: "Installing…",
      turnOn: "Turn on",
      turnOff: "Turn off",
      update: "Update to v{v}",
      remove: "Remove",
      installedOn: "Installed · on",
      installedOff: "Installed · off",
      adminOnly: "Installing, turning on and removing can be done in the admin screen only.",
      goAdmin: "Manage in admin",
      unknownPerm: "A permission this plugin asks for.",
      screenshotAlt: "{name} preview"
    }
  };

  /* 자주 쓰는 권한 설명 — 플러그인이 처음 보이는 이름이면 아래 문장으로 풀어 씁니다. */
  var PERM = {
    "read:card-text": { ko: "카드의 제목·글자 수를 읽습니다.", en: "Reads card titles and character counts." },
    "read:posts": { ko: "게시글 목록을 읽습니다(공개된 글만).", en: "Reads the post list (published posts only)." },
    "read:admin-lists": { ko: "관리자 목록(글·페이지)을 읽습니다.", en: "Reads the admin lists of posts and pages." },
    "ui:floating": { ko: "화면 위에 떠 있는 버튼을 그립니다.", en: "Draws a button floating over the page." },
    "ui:home-top": { ko: "홈 맨 위에 배너 영역을 그립니다.", en: "Draws a banner area at the top of home." },
    "css:inject": { ko: "사이트에 스타일(CSS)을 더합니다.", en: "Adds style rules (CSS) to the site." },
    "nav:menu": { ko: "헤더 메뉴에 항목을 더합니다.", en: "Adds an item to the header menu." }
  };

  var CAT_FALLBACK = {
    content: { ko: "콘텐츠 꾸미기", en: "Content" },
    navigation: { ko: "내비게이션", en: "Navigation" },
    widget: { ko: "위젯·홈", en: "Widgets & home" },
    admin: { ko: "관리자 도구", en: "Admin tools" },
    accessibility: { ko: "읽기·접근성", en: "Reading & accessibility" }
  };

  /* ---------------- 작은 도우미 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function currentLang() {
    try {
      if (window.ADMIN_I18N && window.ADMIN_I18N.lang) return window.ADMIN_I18N.lang() === "en" ? "en" : "ko";
    } catch (e) { /* noop */ }
    try {
      if (window.CRAFT_I18N && window.CRAFT_I18N.isEn) return window.CRAFT_I18N.isEn() ? "en" : "ko";
    } catch (e) { /* noop */ }
    try { return String(localStorage.getItem("craft-lang") || "").toLowerCase() === "en" ? "en" : "ko"; }
    catch (e) { return "ko"; }
  }

  function tr(lang, key, vars) {
    var s = (L[lang] && L[lang][key] != null) ? L[lang][key] : (L.ko[key] != null ? L.ko[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function abs(src, base) {
    var s = String(src == null ? "" : src).trim();
    if (!s) return "";
    try {
      var u = new URL(s, new URL(String(base || location.href), location.href));
      if (u.origin === location.origin) return u.pathname + u.search + u.hash;
      return u.href;
    } catch (e) { return s; }
  }

  function verNum(v) {
    var p = String(v == null ? "" : v).replace(/^v/i, "").split(".");
    return (parseInt(p[0], 10) || 0) * 10000 + (parseInt(p[1], 10) || 0) * 100 + (parseInt(p[2], 10) || 0);
  }

  function dateText(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    return s.slice(0, 10);
  }

  function byId(inst, id) {
    var list = (inst.data && inst.data.plugins) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------------- 데이터 정규화 ---------------- */
  function normShot(x, lang) {
    if (x == null) return null;
    if (typeof x === "string") return { src: x, alt: "", alt_en: "" };
    return {
      src: String(x.src || x.url || x.href || ""),
      alt: String(x.alt || ""),
      alt_en: String(x.alt_en || x.altEn || x.alt || "")
    };
  }

  function normalize(data, marketUrl) {
    var isArr = Array.isArray(data);
    var list = isArr ? data : (data && Array.isArray(data.plugins) ? data.plugins : []);
    var out = {
      name: (!isArr && data && data.name) || "SBPress",
      sbpress: (!isArr && data && String(data.sbpress || "")) || "",
      categories: [],
      plugins: []
    };
    var rawCats = (!isArr && data && Array.isArray(data.categories)) ? data.categories : [];
    rawCats.forEach(function (c) {
      if (c == null) return;
      if (typeof c === "string") out.categories.push({ id: c, ko: c, en: c });
      else out.categories.push({
        id: String(c.id || c.key || ""),
        ko: String(c.ko || c.name || c.id || ""),
        en: String(c.en || c.name_en || c.name || c.id || "")
      });
    });
    list.forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var id = String(item.id || "").trim().slice(0, 60);
      if (!id) return;
      var m = (item.manifest && typeof item.manifest === "object") ? item.manifest : {};
      var hooks = Array.isArray(m.hooks) ? m.hooks.slice() : (Array.isArray(item.hooks) ? item.hooks.slice() : []);
      hooks = hooks.map(function (h) { return String(h || "").trim(); }).filter(Boolean).slice(0, 12);
      var perms = Array.isArray(m.permissions) ? m.permissions.slice()
        : (Array.isArray(item.permissions) ? item.permissions.slice() : []);
      perms = perms.map(function (x) { return String(x || "").trim(); }).filter(Boolean).slice(0, 12);
      var tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
      var tagsEn = Array.isArray(item.tags_en) ? item.tags_en.map(String) : [];
      var shots = (Array.isArray(item.screenshots) ? item.screenshots : [])
        .map(function (x) { return normShot(x); }).filter(function (x) { return x && x.src; });
      var log = (Array.isArray(item.changelog) ? item.changelog : []).map(function (c) {
        if (c == null) return null;
        if (typeof c === "string") return { version: "", date: "", notes: c, notes_en: c };
        return {
          version: String(c.version || ""),
          date: dateText(c.date || c.updated),
          notes: String(c.notes || c.note || c.text || ""),
          notes_en: String(c.notes_en || c.notesEn || c.notes || c.note || c.text || "")
        };
      }).filter(Boolean);
      out.plugins.push({
        id: id,
        name: String(item.name || id),
        name_en: String(item.name_en || item.nameEn || ""),
        version: String(item.version || (m.version) || "1.0.0"),
        description: String(item.description || ""),
        description_en: String(item.description_en || item.descriptionEn || ""),
        author: String(item.author || m.author || ""),
        author_en: String(item.author_en || item.authorEn || ""),
        category: String(item.category || ""),
        order: Number(item.order || 0) || 100,
        updated: dateText(item.updated || item.updated_at),
        min_sbpress_version: String(item.min_sbpress_version || item.minVersion || ""),
        script_url: String(item.script_url || ""),
        source: String(item.source || ""),
        tags: tags,
        tags_en: tagsEn,
        screenshots: shots,
        changelog: log,
        hooks: hooks,
        permissions: perms,
        marketUrl: marketUrl || ""
      });
    });
    /* 카테고리 목록에 없는 분류도 빠뜨리지 않습니다. */
    out.plugins.forEach(function (p) {
      if (!p.category) return;
      var has = out.categories.some(function (c) { return c.id === p.category; });
      if (!has) {
        var fb = CAT_FALLBACK[p.category];
        out.categories.push({ id: p.category, ko: fb ? fb.ko : p.category, en: fb ? fb.en : p.category });
      }
    });
    return out;
  }

  function catLabel(inst, id) {
    var lang = inst.lang;
    var hit = null;
    (inst.data.categories || []).forEach(function (c) { if (c.id === id) hit = c; });
    if (!hit) return id;
    return lang === "en" ? (hit.en || hit.ko || id) : (hit.ko || hit.en || id);
  }

  function disp(inst, p) {
    var en = inst.lang === "en";
    return {
      name: (en && p.name_en) ? p.name_en : p.name,
      desc: (en && p.description_en) ? p.description_en : p.description,
      author: (en && p.author_en) ? p.author_en : p.author,
      category: p.category ? catLabel(inst, p.category) : "",
      tags: (en && p.tags_en && p.tags_en.length) ? p.tags_en : p.tags,
      hook: function (h) { return hookLabel(h, inst.lang); }
    };
  }

  function hookLabel(h, lang) {
    var M = {
      menu: { ko: "메뉴", en: "Menu" }, card: { ko: "카드", en: "Card" }, widget: { ko: "위젯", en: "Widget" },
      "admin-tab": { ko: "관리자 탭", en: "Admin tab" }, css: { ko: "CSS", en: "CSS" },
      settings: { ko: "설정", en: "Settings" }
    };
    var x = M[h];
    if (!x) return h;
    return lang === "en" ? x.en : x.ko;
  }

  function permText(perm, lang) {
    var p = PERM[perm];
    if (!p) return tr(lang, "unknownPerm");
    return lang === "en" ? p.en : p.ko;
  }

  function installedRow(inst, id) {
    try { return inst.installed ? (inst.installed(id) || null) : null; } catch (e) { return null; }
  }

  /* ---------------- 필터 · 정렬 ---------------- */
  function matches(inst, p, st) {
    if (st.cat && p.category !== st.cat) return false;
    if (st.hook && p.hooks.indexOf(st.hook) < 0) return false;
    if (st.tag && p.tags.indexOf(st.tag) < 0) return false;
    var q = String(st.q || "").trim().toLowerCase();
    if (!q) return true;
    var d = disp(inst, p);
    var hay = [p.id, p.name, p.name_en, p.description, p.description_en, p.author, p.author_en,
      p.tags.join(" "), p.tags_en.join(" "), p.hooks.join(" "), d.category].join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function sortList(inst, list, mode) {
    var arr = list.slice();
    var locale = inst.lang === "en" ? "en" : "ko";
    if (mode === "latest") {
      arr.sort(function (a, b) {
        var x = a.updated || "", y = b.updated || "";
        if (x !== y) return y.localeCompare(x);
        return (a.order - b.order) || disp(inst, a).name.localeCompare(disp(inst, b).name, locale);
      });
    } else if (mode === "name") {
      arr.sort(function (a, b) {
        return disp(inst, a).name.localeCompare(disp(inst, b).name, locale);
      });
    } else {
      arr.sort(function (a, b) {
        return (a.order - b.order) || String(b.updated || "").localeCompare(String(a.updated || ""));
      });
    }
    return arr;
  }

  function facetValues(inst) {
    var cats = [], hooks = [], tags = [];
    (inst.data.plugins || []).forEach(function (p) {
      if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category);
      p.hooks.forEach(function (h) { if (hooks.indexOf(h) < 0) hooks.push(h); });
      p.tags.forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
    });
    hooks.sort(function (a, b) {
      var ia = HOOK_ORDER.indexOf(a), ib = HOOK_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return { cats: cats, hooks: hooks, tags: tags };
  }

  /* ---------------- 화면 조각 ---------------- */
  function chipRow(inst, group, labelText, values, current) {
    var lang = inst.lang;
    var html = '<span class="mkt-chip-label">' + esc(labelText) + "</span>" +
      '<button type="button" class="mkt-chip' + (current ? "" : " on") + '" data-mkt-' + group + '="" ' +
      'aria-pressed="' + (current ? "false" : "true") + '">' + esc(tr(lang, "all")) + "</button>";
    values.forEach(function (v) {
      var label = group === "category" ? catLabel(inst, v)
        : (group === "hook" ? hookLabel(v, lang) : tagLabel(inst, v));
      var on = current === v;
      html += '<button type="button" class="mkt-chip' + (on ? " on" : "") + '" data-mkt-' + group + '="' +
        esc(v) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + "</button>";
    });
    return html;
  }

  function tagLabel(inst, tag) {
    if (inst.lang !== "en") return tag;
    var list = inst.data.plugins || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var k = p.tags.indexOf(tag);
      if (k >= 0 && p.tags_en[k]) return p.tags_en[k];
    }
    return tag;
  }

  function shotUrl(inst, shot) {
    return abs(shot.src, inst.url);
  }

  function actionButtons(inst, p, place) {
    var lang = inst.lang;
    var row = installedRow(inst, p.id);
    var installed = !!row, on = !!(row && row.enabled);
    var newer = !!(installed && p.version && String(p.version) !== String(row.version || ""));
    var attrs = ' data-mkt-place="' + esc(place) + '"';
    if (inst.mode !== "admin") {
      return '<button type="button" class="btn btn-ghost btn-sm" data-mkt-open="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "detail")) + "</button>";
    }
    if (!installed) {
      return '<button type="button" class="btn btn-primary btn-sm" data-mplug-install="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "install")) + "</button>";
    }
    var html = '<button type="button" class="btn btn-ghost btn-sm" data-mplug-toggle="' + esc(p.id) + '"' + attrs + ">" +
      esc(tr(lang, on ? "turnOff" : "turnOn")) + "</button>";
    if (newer) {
      html += '<button type="button" class="btn btn-ghost btn-sm" data-mplug-update="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "update", { v: p.version })) + "</button>";
    }
    html += '<button type="button" class="btn btn-ghost btn-sm danger" data-mplug-remove="' + esc(p.id) + '"' + attrs + ">" +
      esc(tr(lang, "remove")) + "</button>";
    if (place !== "modal") {
      html += '<button type="button" class="rowlink" data-mkt-open="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "detailShort")) + "</button>";
    }
    return html;
  }

  function cardHtml(inst, p) {
    var lang = inst.lang;
    var d = disp(inst, p);
    var row = installedRow(inst, p.id);
    var on = !!(row && row.enabled);
    var badge = row
      ? '<span class="plug-badge ' + (on ? "b-on" : "b-off") + '">' + esc(tr(lang, on ? "installedOn" : "installedOff")) + "</span>"
      : "";
    var shot = p.screenshots[0] || null;
    var thumb = shot
      ? '<img src="' + esc(shotUrl(inst, shot)) + '" alt="' + esc(lang === "en" ? (shot.alt_en || shot.alt || tr(lang, "screenshotAlt", { name: d.name })) : (shot.alt || tr(lang, "screenshotAlt", { name: d.name }))) + '" width="720" height="405" loading="lazy" decoding="async">'
      : '<span class="mkt-noshot">' + esc(tr(lang, "noShot")) + "</span>";
    /* 카테고리와 같은 이름의 태그는 한 번만 보여 줍니다. */
    var tags = d.tags.filter(function (t) { return t !== d.category; }).slice(0, 3).map(function (t) {
      return '<span class="plug-tag">' + esc(t) + "</span>";
    }).join("");
    return '<article class="plug-card mkt-card" data-market-id="' + esc(p.id) + '" data-mkt-card="' + esc(p.id) + '">' +
      '<div class="mkt-thumb">' + thumb + "</div>" +
      "<h3>" + esc(d.name) + " " + badge + "</h3>" +
      '<p class="plug-desc">' + esc(d.desc) + "</p>" +
      '<div class="plug-meta mkt-meta">' +
        '<span class="plug-tag ver">v' + esc(p.version) + "</span>" +
        (d.author ? '<span class="mkt-author">' + esc(d.author) + "</span>" : "") +
        (d.category ? '<span class="plug-tag cat">' + esc(d.category) + "</span>" : "") +
        tags +
      "</div>" +
      '<div class="plug-actions mkt-actions">' + actionButtons(inst, p, "card") + "</div>" +
      "</article>";
  }

  /* ---------------- 상세 모달 ---------------- */
  var MODAL = { el: null, lastFocus: null, inst: null, id: "" };

  function ensureModal() {
    if (MODAL.el && document.body.contains(MODAL.el)) return MODAL.el;
    var el = document.createElement("div");
    el.className = "mkt-modal";
    el.id = "mkt-modal";
    el.hidden = true;
    el.innerHTML =
      '<div class="mkt-modal-backdrop" data-mkt-close="1"></div>' +
      '<div class="mkt-modal-card" role="dialog" aria-modal="true" aria-labelledby="mkt-modal-title">' +
        '<header class="mkt-modal-head">' +
          '<h2 id="mkt-modal-title"></h2>' +
          '<button type="button" class="mkt-modal-x" data-mkt-close="1" aria-label="' + esc(tr(currentLang(), "close")) + '">×</button>' +
        "</header>" +
        '<div class="mkt-modal-body" id="mkt-modal-body"></div>' +
        '<footer class="mkt-modal-foot" id="mkt-modal-foot"></footer>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      var closer = e.target.closest ? e.target.closest("[data-mkt-close]") : null;
      if (closer) { closeDetail(); return; }
      var action = e.target.closest ? e.target.closest("[data-mplug-install],[data-mplug-toggle],[data-mplug-update],[data-mplug-remove]") : null;
      if (action) {
        var inst = MODAL.inst;
        if (!inst) return;
        if (action.hasAttribute("data-mplug-install")) runAction(inst, "onInstall", action.getAttribute("data-mplug-install"), action, true);
        else if (action.hasAttribute("data-mplug-toggle")) runAction(inst, "onToggle", action.getAttribute("data-mplug-toggle"), action, true);
        else if (action.hasAttribute("data-mplug-update")) runAction(inst, "onUpdate", action.getAttribute("data-mplug-update"), action, true);
        else if (action.hasAttribute("data-mplug-remove")) runAction(inst, "onRemove", action.getAttribute("data-mplug-remove"), action, true);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (!MODAL.el || MODAL.el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeDetail(); }
    });
    MODAL.el = el;
    return el;
  }

  function openDetail(inst, id, keepFocus) {
    var p = byId(inst, id);
    if (!p) return;
    var el = ensureModal();
    MODAL.inst = inst;
    MODAL.id = id;
    MODAL.lastFocus = document.activeElement;
    var lang = inst.lang;
    var d = disp(inst, p);
    var row = installedRow(inst, p.id);
    var cur = String((inst.data && inst.data.sbpress) || "");
    var minV = p.min_sbpress_version;
    var compat = !minV || !cur || verNum(minV) <= verNum(cur);
    el.querySelector("#mkt-modal-title").textContent = d.name;
    var shots = p.screenshots.length
      ? '<div class="mkt-shots">' + p.screenshots.map(function (s) {
          return '<figure class="mkt-shot"><img src="' + esc(shotUrl(inst, s)) + '" alt="' +
            esc(lang === "en" ? (s.alt_en || s.alt || tr(lang, "screenshotAlt", { name: d.name })) : (s.alt || tr(lang, "screenshotAlt", { name: d.name }))) +
            '" width="720" height="405" loading="lazy" decoding="async"></figure>';
        }).join("") + "</div>"
      : '<p class="mkt-note">' + esc(tr(lang, "noShot")) + "</p>";
    var facts =
      '<dl class="mkt-facts">' +
        "<div><dt>" + esc(tr(lang, "version")) + "</dt><dd><b>v" + esc(p.version) + "</b> " +
          (row ? '<span class="plug-badge ' + (row.enabled ? "b-on" : "b-off") + '">' +
            esc(tr(lang, row.enabled ? "installedOn" : "installedOff")) + "</span>" : "") + "</dd></div>" +
        (d.author ? "<div><dt>" + esc(tr(lang, "author")) + "</dt><dd>" + esc(d.author) + "</dd></div>" : "") +
        "<div><dt>" + esc(tr(lang, "minVersion")) + "</dt><dd>v" + esc(minV || "1.0") + " " +
          (cur ? '<span class="muted">· ' + esc(tr(lang, "currentVersion", { v: "v" + cur })) + "</span>" : "") + " " +
          (compat ? '<span class="mkt-ok">' + esc(tr(lang, "compatOk")) + "</span>"
                  : '<span class="mkt-warn">' + esc(tr(lang, "compatNo", { v: minV })) + "</span>") + "</dd></div>" +
        (p.updated ? "<div><dt>" + esc(tr(lang, "updated")) + "</dt><dd>" + esc(p.updated) + "</dd></div>" : "") +
        (d.category ? "<div><dt>" + esc(tr(lang, "category")) + "</dt><dd>" + esc(d.category) + "</dd></div>" : "") +
        (p.hooks.length ? "<div><dt>" + esc(tr(lang, "hooks")) + "</dt><dd>" + p.hooks.map(function (h) {
          return '<i class="plug-tag hook">' + esc(hookLabel(h, lang)) + "</i>";
        }).join(" ") + "</dd></div>" : "") +
        (d.tags.length ? "<div><dt>" + esc(tr(lang, "tags")) + "</dt><dd>" + d.tags.map(function (t) {
          return '<i class="plug-tag">' + esc(t) + "</i>";
        }).join(" ") + "</dd></div>" : "") +
      "</dl>";
    var perms = p.permissions.length
      ? '<ul class="mkt-perms">' + p.permissions.map(function (x) {
          return "<li><code>" + esc(x) + "</code><span>" + esc(permText(x, lang)) + "</span></li>";
        }).join("") + "</ul>"
      : '<p class="mkt-note">' + esc(tr(lang, "noPermissions")) + "</p>";
    var log = p.changelog.length
      ? '<ol class="mkt-log">' + p.changelog.map(function (c) {
          return "<li>" + (c.version ? "<b>v" + esc(c.version) + "</b>" : "") +
            (c.date ? '<time datetime="' + esc(c.date) + '">' + esc(c.date) + "</time>" : "") +
            "<p>" + esc(lang === "en" ? (c.notes_en || c.notes) : c.notes) + "</p></li>";
        }).join("") + "</ol>"
      : '<p class="mkt-note">' + esc(tr(lang, "noChangelog")) + "</p>";
    el.querySelector("#mkt-modal-body").innerHTML =
      shots +
      (d.desc ? '<p class="mkt-desc-full">' + esc(d.desc) + "</p>" : "") +
      facts +
      '<section class="mkt-sec"><h3>' + esc(tr(lang, "permissions")) + "</h3>" + perms + "</section>" +
      '<section class="mkt-sec"><h3>' + esc(tr(lang, "changelog")) + "</h3>" + log + "</section>";
    var foot = "";
    if (inst.mode === "admin") {
      foot = '<span class="mkt-foot-id muted">' + esc(p.id) + "</span>" + actionButtons(inst, p, "modal");
    } else {
      foot = '<p class="mkt-note">' + esc(tr(lang, "adminOnly")) + "</p>" +
        '<a class="btn btn-ghost btn-sm" href="/admin" rel="nofollow">' + esc(tr(lang, "goAdmin")) + "</a>";
    }
    el.querySelector("#mkt-modal-foot").innerHTML = foot;
    el.querySelector(".mkt-modal-x").setAttribute("aria-label", tr(lang, "close"));
    var wasOpen = !el.hidden;
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    if (!(keepFocus && wasOpen)) {
      try { el.querySelector(".mkt-modal-x").focus(); } catch (e) { /* noop */ }
    }
  }

  function closeDetail() {
    if (!MODAL.el) return;
    MODAL.el.hidden = true;
    MODAL.el.querySelector("#mkt-modal-body").innerHTML = "";
    MODAL.el.querySelector("#mkt-modal-foot").innerHTML = "";
    MODAL.inst = null;
    MODAL.id = "";
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (MODAL.lastFocus && MODAL.lastFocus.focus) MODAL.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  function runAction(inst, name, id, btn, inModal) {
    var fn = inst[name];
    if (typeof fn !== "function") return;
    if (btn && btn.tagName === "BUTTON") {
      btn.disabled = true;
      if (name === "onInstall" && !btn.getAttribute("data-busy")) {
        btn.setAttribute("data-busy", "1");
        btn.textContent = tr(inst.lang, "installing");
      }
    }
    try { fn(id, btn, inst); } catch (e) { /* 관리자 콜백 오류는 admin.js 가 알립니다 */ }
    /* 콜백이 화면을 다시 그리면 버튼도 새로 만들어집니다. 상세 모달이 열려 있으면 함께 갱신합니다. */
    if (inModal) {
      [80, 700].forEach(function (ms) {
        setTimeout(function () {
          if (MODAL.el && !MODAL.el.hidden && MODAL.inst === inst) openDetail(inst, id, true);
        }, ms);
      });
    }
  }

  /* ---------------- 인스턴스 ---------------- */
  /* 마켓 화면 전용 CSS 는 이 화면에 들어갈 때 한 번만 받습니다(첫 화면 300KB 예산). */
  function ensureStyles() {
    if (document.getElementById("mkt-style")) return;
    var l = document.createElement("link");
    l.id = "mkt-style";
    l.rel = "stylesheet";
    l.href = "assets/market.css";
    document.head.appendChild(l);
  }

  function ensureToolsHost(root) {
    var host = root.previousElementSibling;
    if (host && host.getAttribute && host.getAttribute("data-mkt-tools") === "1") return host;
    host = document.createElement("div");
    host.className = "mkt-tools";
    host.setAttribute("data-mkt-tools", "1");
    if (root.parentNode) root.parentNode.insertBefore(host, root);
    return host;
  }

  function setBusy(inst, on) {
    if (!inst.tools) return;
    inst.tools.setAttribute("aria-busy", on ? "true" : "false");
  }

  function paintTools(inst) {
    var host = inst.tools;
    if (!host) return;
    var lang = inst.lang;
    var q = inst.state.q;
    host.innerHTML =
      '<div class="mkt-bar">' +
        '<label class="mkt-search"><span class="sr-only">' + esc(tr(lang, "searchAria")) + "</span>" +
          '<input type="search" class="mkt-q" placeholder="' + esc(tr(lang, "search")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(tr(lang, "searchAria")) + '">' +
        "</label>" +
        '<label class="mkt-sortwrap"><span class="mkt-sortlabel">' + esc(tr(lang, "sort")) + "</span>" +
          '<select class="mkt-sort" aria-label="' + esc(tr(lang, "sortAria")) + '">' +
            '<option value="recommend">' + esc(tr(lang, "sortRecommend")) + "</option>" +
            '<option value="latest">' + esc(tr(lang, "sortLatest")) + "</option>" +
            '<option value="name">' + esc(tr(lang, "sortName")) + "</option>" +
          "</select></label>" +
      "</div>" +
      '<div class="mkt-chipset">' +
        '<div class="mkt-chips" data-group="category">' + chipRow(inst, "category", tr(lang, "fCategory"), facetValues(inst).cats, inst.state.cat) + "</div>" +
        '<div class="mkt-chips" data-group="hook">' + chipRow(inst, "hook", tr(lang, "fHook"), facetValues(inst).hooks, inst.state.hook) + "</div>" +
        '<div class="mkt-chips" data-group="tag">' + chipRow(inst, "tag", tr(lang, "fTag"), facetValues(inst).tags, inst.state.tag) + "</div>" +
      "</div>" +
      '<p class="mkt-count" role="status" aria-live="polite"></p>' +
      '<p class="mkt-empty" hidden>' + esc(tr(lang, "empty")) + "</p>";
    var input = host.querySelector(".mkt-q");
    if (input) {
      input.value = q;
      input.addEventListener("input", function () {
        inst.state.q = input.value;
        render(inst);
      });
    }
    var sel = host.querySelector(".mkt-sort");
    if (sel) {
      sel.value = inst.state.sort;
      sel.addEventListener("change", function () {
        inst.state.sort = sel.value || "recommend";
        render(inst);
      });
    }
    /* 필터 칩은 한 번만 위임해 둡니다(다시 그려도 리스너가 쌓이지 않게). */
    if (!host.getAttribute("data-mkt-chips-bound")) {
      host.setAttribute("data-mkt-chips-bound", "1");
      host.addEventListener("click", function (e) {
        var inst2 = host.__mktInst;
        if (!inst2) return;
        var chip = e.target.closest ? e.target.closest("[data-mkt-category],[data-mkt-hook],[data-mkt-tag]") : null;
        if (!chip) return;
        if (chip.hasAttribute("data-mkt-category")) inst2.state.cat = chip.getAttribute("data-mkt-category");
        else if (chip.hasAttribute("data-mkt-hook")) inst2.state.hook = chip.getAttribute("data-mkt-hook");
        else inst2.state.tag = chip.getAttribute("data-mkt-tag");
        paintTools(inst2);
        render(inst2);
      });
    }
  }

  function paintHeader(inst, page) {
    if (!page) return;
    var lang = inst.lang;
    var e = page.querySelector("[data-mkt-head='eyebrow']");
    var t = page.querySelector("[data-mkt-head='title']");
    var l = page.querySelector("[data-mkt-head='lead']");
    if (e) e.textContent = tr(lang, "eyebrow");
    if (t) t.textContent = tr(lang, "title");
    if (l) l.textContent = tr(lang, "lead");
  }

  function render(inst) {
    if (!inst.data) return;
    var list = (inst.data.plugins || []).filter(function (p) { return matches(inst, p, inst.state); });
    list = sortList(inst, list, inst.state.sort);
    inst.root.innerHTML = list.map(function (p) { return cardHtml(inst, p); }).join("");
    var count = inst.tools ? inst.tools.querySelector(".mkt-count") : null;
    if (count) {
      count.textContent = tr(inst.lang, "count", { m: list.length, n: (inst.data.plugins || []).length });
    }
    var empty = inst.tools ? inst.tools.querySelector(".mkt-empty") : null;
    if (empty) empty.hidden = list.length > 0;
    setBusy(inst, false);
  }

  function needMessage(inst, text, retry) {
    if (!inst.tools) return;
    inst.tools.innerHTML = '<p class="mkt-note mkt-error">' + esc(text) +
      (retry ? ' <button type="button" class="rowlink mkt-retry">' + esc(tr(inst.lang, "retry")) + "</button>" : "") + "</p>";
    if (retry) {
      var b = inst.tools.querySelector(".mkt-retry");
      if (b) b.addEventListener("click", function () { load(inst); });
    }
    inst.root.innerHTML = "";
  }

  function load(inst) {
    if (typeof fetch !== "function") { needMessage(inst, tr(inst.lang, "failed") + " fetch 없음", false); return; }
    setBusy(inst, true);
    if (inst.tools) inst.tools.innerHTML = '<p class="mkt-note">' + esc(tr(inst.lang, "loading")) + "</p>";
    fetch(inst.url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        inst.data = normalize(data, inst.url);
        inst.meta = data;
        if (!inst.data.plugins.length) {
          needMessage(inst, tr(inst.lang, "emptyMarket"), false);
          return;
        }
        paintTools(inst);
        render(inst);
      })
      .catch(function (e) {
        needMessage(inst, tr(inst.lang, "failed") + (e && e.message ? e.message : ""), true);
      });
  }

  function mount(opts) {
    opts = opts || {};
    var root = opts.root;
    if (!root) return null;
    ensureStyles();
    /* 같은 칸에 다시 mount 하면 앞서 만든 인스턴스를 그대로 씁니다(리스너·필터 상태 유지). */
    if (root.__sbpMarket) {
      var prev = root.__sbpMarket;
      prev.mode = opts.mode === "admin" ? "admin" : prev.mode;
      prev.url = opts.url || prev.url;
      prev.page = opts.page || prev.page;
      prev.installed = opts.installed || prev.installed;
      prev.onInstall = opts.onInstall || prev.onInstall;
      prev.onToggle = opts.onToggle || prev.onToggle;
      prev.onUpdate = opts.onUpdate || prev.onUpdate;
      prev.onRemove = opts.onRemove || prev.onRemove;
      if (opts.tools) prev.tools = opts.tools;
      prev.tools.__mktInst = prev;
      if (opts.page) { prev.page = opts.page; paintHeader(prev, prev.page); }
      if (Array.isArray(opts.items)) {
        prev.data = normalize({ name: opts.name || "SBPress", sbpress: opts.sbpress || "",
          categories: opts.categories || [], plugins: opts.items }, prev.url);
        if (!prev.data.plugins.length) needMessage(prev, tr(prev.lang, "emptyMarket"), false);
        else { paintTools(prev); render(prev); }
      }
      return prev;
    }
    seq += 1;
    var inst = {
      id: opts.id || ("mkt" + seq),
      root: root,
      tools: opts.tools || ensureToolsHost(root),
      page: opts.page || null,
      mode: opts.mode === "admin" ? "admin" : "public",
      url: opts.url || "/plugins-market.json",
      lang: opts.lang || currentLang(),
      installed: opts.installed || null,
      onInstall: opts.onInstall || null,
      onToggle: opts.onToggle || null,
      onUpdate: opts.onUpdate || null,
      onRemove: opts.onRemove || null,
      data: null,
      meta: null,
      state: (root.__mktState && root.__mktState.url === (opts.url || "/plugins-market.json"))
        ? root.__mktState
        : { q: "", cat: "", hook: "", tag: "", sort: "recommend", url: opts.url || "/plugins-market.json" }
    };
    root.__mktState = inst.state;
    root.__sbpMarket = inst;
    root.classList.add("mkt-grid");
    if (inst.tools) inst.tools.__mktInst = inst;
    if (opts.page) paintHeader(inst, opts.page);
    INSTANCES.push(inst);
    if (Array.isArray(opts.items)) {
      inst.data = normalize({ name: opts.name || "SBPress", sbpress: opts.sbpress || "", categories: opts.categories || [], plugins: opts.items }, inst.url);
      if (!inst.data.plugins.length) needMessage(inst, tr(inst.lang, "emptyMarket"), false);
      else { paintTools(inst); render(inst); }
    } else {
      load(inst);
    }
    /* 카드 클릭 · 카드 안의 버튼 → 상세/설치 */
    if (!root.getAttribute("data-mkt-bound")) {
      root.setAttribute("data-mkt-bound", "1");
      root.addEventListener("click", function (e) {
        var inst2 = root.__sbpMarket;
        if (!inst2) return;
        var btn = e.target.closest ? e.target.closest("[data-mplug-install],[data-mplug-toggle],[data-mplug-update],[data-mplug-remove]") : null;
        if (btn) {
          if (btn.hasAttribute("data-mplug-install")) runAction(inst2, "onInstall", btn.getAttribute("data-mplug-install"), btn, false);
          else if (btn.hasAttribute("data-mplug-toggle")) runAction(inst2, "onToggle", btn.getAttribute("data-mplug-toggle"), btn, false);
          else if (btn.hasAttribute("data-mplug-update")) runAction(inst2, "onUpdate", btn.getAttribute("data-mplug-update"), btn, false);
          else runAction(inst2, "onRemove", btn.getAttribute("data-mplug-remove"), btn, false);
          return;
        }
        var opener = e.target.closest ? e.target.closest("[data-mkt-open]") : null;
        if (opener) { openDetail(inst2, opener.getAttribute("data-mkt-open")); return; }
        var card = e.target.closest ? e.target.closest(".mkt-card") : null;
        if (card) openDetail(inst2, card.getAttribute("data-market-id"));
      });
      root.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var card = e.target.closest ? e.target.closest(".mkt-card") : null;
        if (!card || (e.target.closest && e.target.closest("button"))) return;
        e.preventDefault();
        openDetail(root.__sbpMarket, card.getAttribute("data-market-id"));
      });
    }
    return inst;
  }

  function update(inst) {
    if (!inst) return;
    inst.lang = currentLang();
    if (inst.page) paintHeader(inst, inst.page);
    if (inst.data) { paintTools(inst); render(inst); }
    else load(inst);
    if (MODAL.el && !MODAL.el.hidden && MODAL.inst === inst && MODAL.id) openDetail(inst, MODAL.id);
  }

  /* 언어가 바뀌면 열려 있는 마켓 화면을 다시 그립니다(관리자 KO/EN · 공개 KO/EN 공통). */
  document.addEventListener("craft:lang", function () {
    INSTANCES.slice().forEach(function (inst) {
      if (!inst.root || !document.body.contains(inst.root)) return;
      try { update(inst); } catch (e) { /* 한 화면이 실패해도 나머지는 그대로 */ }
    });
  });

  /* ---------------- 공개 화면 (#/market) ---------------- */
  var PUBLIC = { mounted: false };

  /* 화면 껍데기는 이 파일이 만듭니다(#/sign 과 같은 방식) — index.html 첫 로드를 가볍게. */
  function ensurePublicView() {
    var v = document.getElementById("view-market");
    if (v) return v;
    var main = document.getElementById("main");
    if (!main) return null;
    v = document.createElement("div");
    v.className = "view";
    v.id = "view-market";
    v.setAttribute("role", "tabpanel");
    v.hidden = true;
    v.innerHTML = '<section class="section"><div class="wrap" id="market-page"></div></section>';
    var mypage = document.getElementById("view-mypage");
    if (mypage && mypage.parentNode === main) main.insertBefore(v, mypage);
    else main.appendChild(v);
    return v;
  }

  function showPublic() {
    ensureStyles();
    var S = window.SBP || {};
    if (S.feature && !S.feature("plugins")) return;     // 이 사이트에서 플러그인을 쓰지 않으면 열지 않습니다
    if (S.brandName) document.title = tr(currentLang(), "title") + " — " + S.brandName();
    var page = document.getElementById("market-page");
    if (!page) {
      var view = ensurePublicView();
      if (view) view.hidden = false;          // 방금 만든 화면은 라우터가 이미 지나갔으니 직접 엽니다
      page = view ? view.querySelector("#market-page") : null;
    }
    if (!page) return;
    var inst = page.querySelector("#mkt-public-grid");
    if (!inst) {
      page.innerHTML =
        '<p class="eyebrow" data-mkt-head="eyebrow"></p>' +
        '<h1 class="page-title" data-mkt-head="title"></h1>' +
        '<p class="mkt-lead" data-mkt-head="lead"></p>' +
        '<div class="mkt-tools" data-mkt-tools="1" id="mkt-public-tools"></div>' +
        '<div class="mkt-grid" id="mkt-public-grid"></div>';
      inst = page.querySelector("#mkt-public-grid");
      PUBLIC.mounted = true;
      mount({
        root: inst,
        tools: page.querySelector("#mkt-public-tools"),
        page: page,
        mode: "public",
        url: "/plugins-market.json"
      });
      return;
    }
    var existing = inst.__sbpMarket;
    if (existing) update(existing);
    else {
      mount({
        root: inst,
        tools: page.querySelector("#mkt-public-tools") || undefined,
        page: page,
        mode: "public",
        url: "/plugins-market.json"
      });
    }
  }

  window.SBP_MARKET = {
    __v: 10,
    version: "1.0.0",
    mount: mount,
    update: update,
    normalize: normalize,
    openDetail: openDetail,
    closeDetail: closeDetail,
    currentLang: currentLang
  };

  window.CRAFT_MARKET = {
    show: showPublic,
    open: function (id) {
      var grid = document.getElementById("mkt-public-grid");
      if (grid && grid.__sbpMarket) openDetail(grid.__sbpMarket, id);
    }
  };
})();
