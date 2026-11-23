/* ===== SBPress v8.0 · 통합 허브 · 복제 마법사 · 도메인 연결 도우미 (assets/hub.js) =====
   /admin → 통합 허브
     10-A  사이트별 상태 카드 — public.sites(관리자 RLS) 의 최근 배포 시각·저장소 크기·DB 크기·
           미처리 결재/예약을 보여 주고, 사이트를 추가·편집합니다.
           미처리 수는 화면에서 실제 표(approval_docs·reservations)를 다시 세어 ‘지금 값’으로 덮어 보여 줍니다.
           SQL(20_v80_multisite_hub.sql)을 아직 실행하지 않았으면 현재 사이트 기본 카드 + 안내로만 동작합니다(폴백).
     10-B  원클릭 복제 마법사 — 이름·도메인·포인트 색·게시판 구성을 넣으면
           ① sbpress.config.json 생성·내려받기 ② clone_site.py · gh repo create 실행 명령 복사
           ③ 복제 후 체크리스트(DNS·GA4·OAuth·관리자 등록·첫 글)를 만들어 줍니다.
   /admin → 설정 · 연동 → 도메인 연결 도우미
     도메인을 넣으면 Cloudflare DNS 레코드(@ A 4개 · www CNAME)와 CNAME 파일,
     GitHub Pages · Supabase Auth · Google OAuth · sbpress.config.json siteUrl 체크리스트를 만듭니다.
   의존: assets/admin.js 의 window.CRAFT_ADMIN(token) · assets/config.js 의 window.SBPRESS_CONFIG
   주의: service_role 키나 비밀 값은 이 파일에 절대 넣지 않습니다. 공개(anon) 키만 씁니다.
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";
  var SC = window.SBPRESS_CONFIG || {};
  var GH_IPS = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];

  /* 관리자 화면은 assets/admin-i18n.js 가 문구를 번역합니다 — 여기서는 한국어 기본 문구를 돌려줍니다.
     (이 파일의 문구는 모두 tools_gen_admin_i18n.py 의 PAIRS 에 들어 있습니다.) */
  var T = {
    "hub.needAdmin": "관리자로 로그인해야 통합 허브를 볼 수 있습니다.",
    "hub.loading": "불러오는 중…",
    "hub.errLoad": "사이트 목록을 읽지 못했습니다:",
    "hub.notReady": "사이트 표가 아직 없습니다. supabase/20_v80_multisite_hub.sql 을 실행하면 이 화면이 켜집니다.",
    "hub.empty": "아직 허브에 등록한 사이트가 없습니다. 지금 사이트를 등록하거나 아래에서 새 사이트를 추가하세요.",
    "hub.currentOnly": "지금 보고 있는 사이트입니다.",
    "hub.live": "지금 값",
    "hub.noCount": "–",
    "hub.active": "운영",
    "hub.paused": "일시정지",
    "hub.archived": "보관",
    "hub.edit": "편집",
    "hub.openAdmin": "관리자 열기",
    "hub.lastDeploy": "최근 배포",
    "hub.never": "기록 없음",
    "hub.repoSize": "저장소",
    "hub.dbSize": "DB",
    "hub.appr": "미처리 결재",
    "hub.rsv": "미처리 예약",
    "hub.repo": "GitHub",
    "hub.supabase": "Supabase",
    "hub.ga4": "GA4",
    "hub.saved": "사이트를 저장했습니다.",
    "hub.errSave": "저장하지 못했습니다:",
    "hub.needKey": "사이트 키를 영문 소문자·숫자·하이픈으로 적어 주세요(41자 이내).",
    "hub.needSql": "사이트 표가 아직 없습니다. supabase/20_v80_multisite_hub.sql 을 먼저 실행해 주세요.",
    "hub.editNew": "새 사이트",
    "hub.pulled": "이 사이트의 지금 값을 저장했습니다.",
    "hub.pullFail": "지금 값을 읽지 못했습니다:",
    "hub.cloneNeedName": "새 사이트 이름을 적어 주세요.",
    "hub.cloneNeedBoards": "게시판 구성을 ‘이름:페이지당 글 수’로 적어 주세요.",
    "hub.cloneReady": "설정·명령·체크리스트를 만들었습니다. 설정 파일을 내려받아 옮긴 뒤 명령을 실행하세요.",
    "hub.cloneDomain": "도메인",
    "hub.cloneNoDomain": "(도메인 없음 — GitHub Pages 주소로 시작)",
    "hub.cloneStep1": "① 설정 파일",
    "hub.cloneStep2": "② 실행 명령",
    "hub.cloneStep3": "③ 복제 후 체크리스트",
    "hub.copied": "복사했습니다.",
    "hub.copyFail": "복사하지 못했습니다 — 직접 선택해 복사해 주세요.",
    "hub.dl": "설정 파일을 내려받았습니다.",
    "hub.dnsTitle": "Cloudflare DNS 레코드",
    "hub.dnsNeed": "도메인을 적고 ‘레코드 만들기’를 누르세요.",
    "hub.dnsReady": "레코드 {n}개 · 체크리스트 {m}단계",
    "hub.dnsCopyAll": "DNS 전체 복사",
    "hub.dnsCopied": "DNS 레코드를 복사했습니다.",
    "hub.cnameDone": "CNAME 파일을 내려받았습니다.",
    "hub.cnameNeed": "도메인을 먼저 입력해 주세요.",
    "hub.badDomain": "도메인 모양을 확인해 주세요(예: example.com).",
    "hub.cf": "Cloudflare 열기",
    "hub.recordType": "종류",
    "hub.recordName": "이름",
    "hub.recordValue": "값",
    "hub.recordTtl": "TTL",
    "hub.recordProxy": "프록시",
    "hub.recordCopy": "복사",
    "hub.dnsOnly": "DNS only",
    "hub.bind": "Cloudflare ‘Import records’ 에 붙여 넣을 BIND 값",
    "hub.checklist": "연결 체크리스트",
    "hub.copy": "복사",
    "hub.step": "단계",
    "hub.domPage": "GitHub Pages → Custom domain",
    "hub.domHttps": "GitHub Pages → Enforce HTTPS",
    "hub.domSite": "Supabase → Authentication → Site URL",
    "hub.domRedirect": "Supabase → Redirect URLs",
    "hub.domOauth": "Google Cloud OAuth → 승인된 자바스크립트 원본",
    "hub.domOauthCb": "Google Cloud OAuth → 승인된 리디렉션 URI",
    "hub.domConfig": "sbpress.config.json → siteUrl",
    "hub.domApi": "Cloudflare API 로 한 번에",
    "hub.boardHint": "이름:페이지당 글 수"
  };
  function I(key, vars) {
    var s = T[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", String(vars[k])); });
    return s;
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function token() {
    if (window.CRAFT_ADMIN && window.CRAFT_ADMIN.token) return window.CRAFT_ADMIN.token();
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.token) return window.CRAFT_AUTH.token();
    return null;
  }
  function enc(v) { return encodeURIComponent(String(v == null ? "" : v)); }
  function msg(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "cms-toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    el.hidden = !text;
  }
  function fmtNum(n) {
    if (n == null || n === "" || isNaN(n)) return I("hub.noCount");
    return Number(n).toLocaleString("ko-KR");
  }
  function fmtKB(kb) {
    var n = Number(kb || 0);
    if (!n) return "–";
    if (n >= 1024) return (n / 1024).toFixed(1) + " MB";
    return Math.round(n) + " KB";
  }
  function fmtWhen(iso) {
    if (!iso) return I("hub.never");
    try {
      var d = new Date(iso), diff = new Date() - d;
      if (diff >= 0 && diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "분 전";
      if (diff >= 0 && diff < 86400000) return Math.round(diff / 3600000) + "시간 전";
      if (diff >= 0 && diff < 7 * 86400000) return Math.round(diff / 86400000) + "일 전";
      return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch (e) { return I("hub.never"); }
  }
  function hostOf(url) {
    return String(url || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
  function statusLabel(s) {
    return s === "paused" ? I("hub.paused") : s === "archived" ? I("hub.archived") : I("hub.active");
  }

  /* ---------------- Supabase REST (관리자 토큰) ---------------- */
  function rest(path, method, body, prefer) {
    var t = token();
    if (!API || !t) return Promise.reject(Object.assign(new Error("no_session"), { status: 0 }));
    var headers = { apikey: KEY, Authorization: "Bearer " + t, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    return fetch(API + "/rest/v1/" + path, {
      method: method || "GET", headers: headers, cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint || data.details)) || ("HTTP " + r.status));
          err.status = r.status; err.code = data && data.code;
          throw err;
        }
        return data;
      });
    });
  }
  function rpc(name, args) {
    return rest("rpc/" + name, "POST", args || {});
  }
  function countRows(table, filters) {
    var q = "select=id" + (filters ? "&" + filters : "");
    return rest(table + "?" + q).then(function (rows) {
      return Array.isArray(rows) ? rows.length : null;
    }, function () { return null; });
  }

  var HUB = { sites: [], hasTable: true, loaded: false, editing: "", domain: null };

  function currentKey() { return String(SC.siteKey || "default"); }

  /* ---------------- 10-A · 허브 카드 ---------------- */
  function livePending(site) {
    var k = site.site_key || "default";
    var suffix = "&site_key=eq." + enc(k);
    return Promise.all([
      countRows("approval_docs", "status=eq.pending" + suffix),
      countRows("reservations", "status=eq.submitted" + suffix)
    ]).then(function (r) {
      site._liveAppr = r[0];
      site._liveRsv = r[1];
      return site;
    });
  }

  function currentSiteCard() {
    var k = currentKey();
    return {
      site_key: k,
      name: SC.siteName || k,
      site_url: SC.siteUrl || "",
      github_repo: "",
      supabase_project: (function () {
        var m = /^https?:\/\/([a-z0-9-]+)\.supabase\./i.exec(CFG.url || "");
        return m ? m[1] : "";
      })(),
      ga4_id: SC.ga4Id || "",
      last_deployed_at: null,
      repo_kb: 0,
      db_mb: 0,
      pending_approvals: null,
      pending_reservations: null,
      status: "active",
      _current: true
    };
  }

  function renderCards() {
    var box = $("#hub-cards");
    if (!box) return;
    var list = HUB.sites.slice();
    var onlyCurrent = list.length === 0;
    if (onlyCurrent) list = [currentSiteCard()];
    box.innerHTML = list.map(function (s) {
      var key = s.site_key || "default";
      var isCur = key === currentKey();
      var name = s.name || (isCur ? (SC.siteName || key) : key);
      var url = s.site_url || (isCur ? (SC.siteUrl || "") : "");
      var appr = (s._liveAppr != null) ? s._liveAppr : s.pending_approvals;
      var rsv = (s._liveRsv != null) ? s._liveRsv : s.pending_reservations;
      var liveTag = (s._liveAppr != null || s._liveRsv != null)
        ? '<span class="hub-live">' + esc(I("hub.live")) + "</span>" : "";
      return '<article class="hub-card' + (isCur ? " is-current" : "") + '" data-hub-card="' + esc(key) + '">' +
        '<div class="hub-card-top"><h3 class="hub-name">' + esc(name) + "</h3>" +
        '<span class="hub-badge is-' + esc(s.status || "active") + '">' + esc(statusLabel(s.status)) + "</span></div>" +
        (url ? '<p class="hub-url"><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(hostOf(url) || url) + "</a>" +
          (isCur ? ' <span class="hub-cur">· ' + esc(I("hub.currentOnly")) + "</span>" : "") + "</p>"
          : '<p class="hub-url">' + esc(I("hub.cloneNoDomain")) + "</p>") +
        '<dl class="hub-meta">' +
        "<div><dt>" + esc(I("hub.lastDeploy")) + "</dt><dd>" + esc(fmtWhen(s.last_deployed_at)) + "</dd></div>" +
        "<div><dt>" + esc(I("hub.repoSize")) + "</dt><dd>" + esc(fmtKB(s.repo_kb)) + "</dd></div>" +
        "<div><dt>" + esc(I("hub.dbSize")) + "</dt><dd>" + esc(s.db_mb ? Number(s.db_mb).toFixed(1) + " MB" : "–") + "</dd></div>" +
        '<div><dt>' + esc(I("hub.appr")) + "</dt><dd>" + liveTag +
        (isCur ? '<button type="button" class="rowlink" data-hub-go="approvals">' + esc(fmtNum(appr)) + "</button>"
               : esc(fmtNum(appr))) + "</dd></div>" +
        '<div><dt>' + esc(I("hub.rsv")) + "</dt><dd>" +
        (isCur ? '<button type="button" class="rowlink" data-hub-go="reserve">' + esc(fmtNum(rsv)) + "</button>"
               : esc(fmtNum(rsv))) + "</dd></div>" +
        "</dl>" +
        '<p class="hub-tags">' +
        (s.github_repo ? "<span>" + esc(I("hub.repo")) + " " + esc(s.github_repo) + "</span>" : "") +
        (s.supabase_project ? "<span>" + esc(I("hub.supabase")) + " " + esc(s.supabase_project) + "</span>" : "") +
        (s.ga4_id ? "<span>" + esc(I("hub.ga4")) + " " + esc(s.ga4_id) + "</span>" : "") +
        "</p>" +
        '<div class="hub-card-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-hub-edit="' + esc(key) + '">' + esc(I("hub.edit")) + "</button>" +
        (url ? '<a class="btn btn-ghost btn-sm" href="' + esc(url.replace(/\/+$/, "")) + '/admin" target="_blank" rel="noopener">' +
               esc(I("hub.openAdmin")) + "</a>" : "") +
        "</div></article>";
    }).join("");
    var note = $("#hub-only-note");
    if (note) note.hidden = !onlyCurrent;
  }

  function fillForm(s) {
    var map = {
      "hub-f-key": s ? s.site_key : "",
      "hub-f-name": s ? s.name : "",
      "hub-f-url": s ? s.site_url : "",
      "hub-f-repo": s ? s.github_repo : "",
      "hub-f-sup": s ? s.supabase_project : "",
      "hub-f-ga4": s ? s.ga4_id : "",
      "hub-f-status": (s && s.status) || "active"
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = map[id] == null ? "" : map[id];
      if (id === "hub-f-key") el.readOnly = !!s;
    });
    var tag = $("#hub-edit-tag");
    if (tag) tag.textContent = s ? (s.name || s.site_key) : I("hub.editNew");
    HUB.editing = s ? (s.site_key || "") : "";
  }

  function load() {
    var stamp = $("#hub-stamp");
    if (stamp) stamp.textContent = I("hub.loading");
    if (!token()) { msg("hub-msg", I("hub.needAdmin"), "err"); return Promise.resolve(); }
    return rest("sites?select=*&order=sort_order.asc,site_key.asc").then(function (rows) {
      HUB.hasTable = true;
      HUB.sites = Array.isArray(rows) ? rows : [];
      var miss = $("#hub-missing");
      if (miss) miss.hidden = true;
      HUB.loaded = true;
      return Promise.all(HUB.sites.map(livePending)).then(function () {
        renderCards();
        if (stamp) stamp.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      });
    }).catch(function (e) {
      if (e && (e.status === 404 || e.code === "42P01" || e.status === 400)) {
        HUB.hasTable = false;
        HUB.sites = [];
        var miss = $("#hub-missing");
        if (miss) miss.hidden = false;
        return livePending(currentSiteCard()).then(renderCards).then(function () {
          if (stamp) stamp.textContent = "–";
        });
      }
      msg("hub-msg", I("hub.errLoad") + " " + (e.message || ""), "err");
    });
  }

  function saveSite() {
    var key = String(($("#hub-f-key") || {}).value || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(key)) { msg("hub-msg", I("hub.needKey"), "err"); return; }
    if (!HUB.hasTable) { msg("hub-msg", I("hub.needSql"), "err"); return; }
    var body = {
      site_key: key,
      name: (($("#hub-f-name") || {}).value || "").trim(),
      site_url: (($("#hub-f-url") || {}).value || "").trim(),
      github_repo: (($("#hub-f-repo") || {}).value || "").trim(),
      supabase_project: (($("#hub-f-sup") || {}).value || "").trim(),
      ga4_id: (($("#hub-f-ga4") || {}).value || "").trim(),
      status: (($("#hub-f-status") || {}).value || "active")
    };
    var btn = $("#hub-save");
    if (btn) btn.disabled = true;
    rest("sites?on_conflict=site_key", "POST", body, "resolution=merge-duplicates,return=representation")
      .then(function () {
        if (btn) btn.disabled = false;
        msg("hub-msg", I("hub.saved"), "ok");
        return load();
      }).catch(function (e) {
        if (btn) btn.disabled = false;
        msg("hub-msg", I("hub.errSave") + " " + (e.message || ""), "err");
      });
  }

  function pullCurrent() {
    var key = currentKey();
    var out = { repo_kb: null, db_mb: null, appr: null, rsv: null };
    var jobs = [];
    jobs.push(fetch("assets/repo-budget.json", { cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (j) {
        var b = j && j.usage && j.usage.totalBytes;
        if (b) out.repo_kb = Math.round(b / 1024);
      }).catch(function () { /* 없으면 건너뜁니다 */ }));
    jobs.push(rpc("get_db_usage_stats", {}).then(function (j) {
      var b = j && j.db && j.db.bytes;
      if (b) out.db_mb = Math.round((b / 1048576) * 10) / 10;
    }).catch(function () { /* 사용량 RPC 가 없으면 건너뜁니다 */ }));
    jobs.push(countRows("approval_docs", "status=eq.pending&site_key=eq." + enc(key))
      .then(function (n) { out.appr = n; }));
    jobs.push(countRows("reservations", "status=eq.submitted&site_key=eq." + enc(key))
      .then(function (n) { out.rsv = n; }));
    Promise.all(jobs).then(function () {
      var found = HUB.sites.filter(function (s) { return s.site_key === key; })[0];
      fillForm(found || currentSiteCard());
      msg("hub-msg", I("hub.pulled") + " (" + fmtKB(out.repo_kb) + " · " +
        (out.db_mb != null ? out.db_mb + " MB" : "–") + ")", "ok");
      // 카드 값도 바로 갱신하고, 표에 있는 사이트면 저장소·DB 크기를 그대로 적어 둡니다.
      var cur = HUB.sites.filter(function (s) { return s.site_key === key; })[0];
      if (cur) {
        cur.repo_kb = out.repo_kb != null ? out.repo_kb : cur.repo_kb;
        cur.db_mb = out.db_mb != null ? out.db_mb : cur.db_mb;
        cur._liveAppr = out.appr; cur._liveRsv = out.rsv;
        renderCards();
        if (HUB.hasTable) {
          var patch = {};
          if (out.repo_kb != null) patch.repo_kb = out.repo_kb;
          if (out.db_mb != null) patch.db_mb = out.db_mb;
          if (Object.keys(patch).length) {
            rest("sites?site_key=eq." + enc(key), "PATCH", patch).catch(function () { /* 표가 없으면 카드만 */ });
          }
        }
      }
    }).catch(function (e) {
      msg("hub-msg", I("hub.pullFail") + " " + (e.message || ""), "err");
    });
  }

  /* ---------------- 10-B · 복제 마법사 ---------------- */
  function boardsFromInput(text) {
    var out = [];
    String(text || "").split(",").forEach(function (item, i) {
      var raw = item.trim();
      if (!raw) return;
      var parts = raw.split(":");
      var name = (parts[0] || "").trim();
      var per = parseInt((parts[1] || "10"), 10);
      if (!name) return;
      if (!(per > 0)) per = 10;
      var alias = { "소개": "intro", "뉴스": "news", "인터뷰": "interview", "정보": "info" };
      var slug = alias[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("board-" + (i + 1));
      out.push({ slug: slug, name: name, per_page: Math.min(100, per), sort_order: out.length + 1 });
    });
    return out;
  }

  function cloneInput() {
    var name = (($("#hub-clone-name") || {}).value || "").trim();
    var domain = (($("#hub-clone-domain") || {}).value || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    var accent = (($("#hub-clone-accent") || {}).value || "").trim();
    var boards = boardsFromInput((($("#hub-clone-boards") || {}).value || ""));
    var repo = (($("#hub-clone-repo") || {}).value || "").trim();
    return { name: name, domain: domain, accent: accent, boards: boards, repo: repo };
  }

  function slugOf(domain, name) {
    if (domain) return domain.replace(/\./g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);
    var s = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return s ? s.slice(0, 40) : "new-site";
  }

  function buildCloneConfig(inp) {
    var siteUrl = inp.domain ? "https://" + inp.domain : "";
    var key = slugOf(inp.domain, inp.name);
    var repo = inp.repo || (inp.domain ? (inp.domain.split(".")[0] + "/" + inp.domain.replace(/\./g, "-")) : "");
    return {
      siteName: inp.name,
      siteTitle: inp.name + " — 새 소식과 기록",
      tagline: inp.name,
      description: inp.name + "의 소식을 모아 소개합니다.",
      siteUrl: siteUrl,
      siteKey: key,
      domain: inp.domain,
      githubRepo: repo,
      accent: inp.accent || "",
      boards: inp.boards,
      supabase: { url: "", anonKey: "" },
      ga4Id: "",
      providers: ["email"],
      defaultTheme: SC.defaultTheme || "magazine",
      defaultLang: "ko",
      features: { map: false, tasks: true, approvals: true, mypage: true, plugins: true, comments: true, sheets: false }
    };
  }

  function cloneCommands(cfg) {
    var repo = cfg.githubRepo || "OWNER/REPO";
    var dir = (cfg.domain || cfg.siteName || "my-site").toString().replace(/[^a-z0-9.-]+/gi, "-");
    return [
      "# 1) 새 사이트 패키지 만들기 (템플릿 폴더에서 — 설정 파일을 같은 곳에 둡니다)",
      "python3 clone_site.py --config ./sbpress.config.json --out ../" + dir,
      "",
      "#    템플릿 없이 init_sbpress.py 만 쓸 때",
      "python3 init_sbpress.py --config ./sbpress.config.json --target ../" + dir,
      "",
      "# 2) GitHub 저장소를 만들고 첫 푸시",
      "cd ../" + dir,
      "git init -b main",
      "git add . && git commit -m \"SBPress 새 사이트\"",
      "gh repo create " + repo + " --public --source=. --remote=origin --push",
      "",
      "# 3) Supabase SQL 실행 뒤 게시판 구성 적용",
      "#    supabase/boards.seed.sql 를 SQL Editor 에서 실행"
    ].join("\n");
  }

  function cloneChecklist(cfg) {
    var base = cfg.siteUrl || "https://" + (cfg.domain || "새-도메인");
    var sup = /^https?:\/\/([a-z0-9-]+)\.supabase\./i.exec(CFG.url || "");
    var supHost = sup ? sup[1] + ".supabase.co" : "YOUR-PROJECT.supabase.co";
    var ghHost = (cfg.githubRepo && cfg.githubRepo.indexOf("/") > 0)
      ? cfg.githubRepo.split("/")[0] + ".github.io" : "YOUR-ID.github.io";
    var items = [];
    if (cfg.domain) {
      items.push({ t: "DNS (Cloudflare) — @ A 4개 · www CNAME " + ghHost,
                   v: "@ A " + GH_IPS.join(" · ") + " / www CNAME " + ghHost });
    }
    items.push({ t: I("hub.domPage"), v: cfg.domain || "도메인" });
    items.push({ t: "GA4 측정 ID 만들기 → sbpress.config.json ga4Id", v: base });
    items.push({ t: I("hub.domSite"), v: base });
    items.push({ t: I("hub.domRedirect"), v: base + "/admin" });
    items.push({ t: I("hub.domOauth"), v: base });
    items.push({ t: I("hub.domOauthCb"), v: "https://" + supHost + "/auth/v1/callback" });
    items.push({ t: "관리자 등록 — public.admin_users 에 소유자 이메일", v: cfg.ownerEmail || SC.ownerEmail || "owner@example.com" });
    items.push({ t: "첫 글 발행 — /admin → 게시판 관리", v: base + "/admin" });
    return items;
  }

  var cloneState = { cfg: null };

  function buildClone() {
    var inp = cloneInput();
    if (!inp.name) { msg("hub-clone-msg", I("hub.cloneNeedName"), "err"); return; }
    if (!inp.boards.length) { msg("hub-clone-msg", I("hub.cloneNeedBoards"), "err"); return; }
    var cfg = buildCloneConfig(inp);
    cloneState.cfg = cfg;
    var out = $("#hub-clone-out");
    if (out) out.hidden = false;
    var pre = $("#hub-clone-json");
    if (pre) pre.textContent = JSON.stringify(cfg, null, 2);
    var cmd = $("#hub-clone-commands");
    if (cmd) cmd.textContent = cloneCommands(cfg);
    var list = $("#hub-clone-checks");
    if (list) {
      list.innerHTML = cloneChecklist(cfg).map(function (it) {
        return "<li><span>" + esc(it.t) + "</span><code>" + esc(it.v) + "</code></li>";
      }).join("");
    }
    var tag = $("#hub-clone-tag");
    if (tag) tag.textContent = (cfg.domain || I("hub.cloneNoDomain"));
    msg("hub-clone-msg", I("hub.cloneReady"), "ok");
  }

  function downloadBlob(name, text, type) {
    var blob = new Blob([text], { type: type || "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) { /* noop */ }
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 400);
  }

  function cloneDownload() {
    if (!cloneState.cfg) buildClone();
    if (!cloneState.cfg) return;
    downloadBlob("sbpress.config.json", JSON.stringify(cloneState.cfg, null, 2) + "\n");
    msg("hub-clone-msg", I("hub.dl"), "ok");
  }

  function copyText(text, okId) {
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.top = "-1000px";
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand && document.execCommand("copy");
        document.body.removeChild(ta);
        msg(okId || "hub-msg", ok ? I("hub.copied") : I("hub.copyFail"), ok ? "ok" : "err");
      } catch (e) {
        msg(okId || "hub-msg", I("hub.copyFail"), "err");
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        msg(okId || "hub-msg", I("hub.copied"), "ok");
      }).catch(fallback);
    } else fallback();
  }

  /* ---------------- 도메인 연결 도우미 ---------------- */
  function normDomain(text) {
    var d = String(text || "").trim().toLowerCase();
    if (!d) return "";
    d = d.replace(/^https?:\/\//, "").split("/")[0].split("?")[0].replace(/^www\./, "").replace(/\.$/, "");
    return d;
  }
  function validDomain(d) { return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d); }

  function ghPagesHost(repo) {
    var r = String(repo || "").trim();
    if (r.indexOf("/") > 0) return r.split("/")[0].toLowerCase() + ".github.io";
    return "YOUR-ID.github.io";
  }

  function domainRecords(domain, repo) {
    var rows = GH_IPS.map(function (ip) {
      return { type: "A", name: "@", value: ip, ttl: "Auto", proxy: "DNS only" };
    });
    rows.push({ type: "CNAME", name: "www", value: ghPagesHost(repo), ttl: "Auto", proxy: "DNS only" });
    return rows;
  }

  function domainChecklist(domain, repo) {
    var base = "https://" + domain;
    var sup = /^https?:\/\/([a-z0-9-]+)\.supabase\./i.exec(CFG.url || "");
    var supHost = sup ? sup[1] + ".supabase.co" : "YOUR-PROJECT.supabase.co";
    return [
      { t: I("hub.domPage"), v: domain, link: repo ? "https://github.com/" + repo + "/settings/pages" : "" },
      { t: I("hub.domHttps"), v: "Enforce HTTPS", link: repo ? "https://github.com/" + repo + "/settings/pages" : "" },
      { t: I("hub.domSite"), v: base, link: sup ? "https://supabase.com/dashboard/project/" + sup[1] + "/auth/url-configuration" : "" },
      { t: I("hub.domRedirect"), v: base + "/admin", link: "" },
      { t: I("hub.domOauth"), v: base, link: "https://console.cloud.google.com/apis/credentials" },
      { t: I("hub.domOauthCb"), v: "https://" + supHost + "/auth/v1/callback", link: "https://console.cloud.google.com/apis/credentials" },
      { t: I("hub.domConfig"), v: JSON.stringify({ siteUrl: base }), link: "" }
    ];
  }

  function bindText(domain, repo) {
    var lines = GH_IPS.map(function (ip) { return domain + ". 300 IN A " + ip; });
    lines.push("www." + domain + ". 300 IN CNAME " + ghPagesHost(repo) + ".");
    return lines.join("\n");
  }

  function paintDomain() {
    var d = normDomain((($("#dom-input") || {}).value || ""));
    var repo = (($("#dom-repo") || {}).value || "").trim();
    var state = $("#dom-state");
    var tbody = document.querySelector("#dom-records tbody");
    var list = $("#dom-checks");
    if (!d) {
      if (state) state.textContent = I("hub.dnsNeed");
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="panel-msg">' + esc(I("hub.dnsNeed")) + "</td></tr>";
      if (list) list.innerHTML = "";
      var api = $("#dom-api"); if (api) api.hidden = true;
      var apiBtn = $("#dom-api-copy"); if (apiBtn) apiBtn.hidden = true;
      HUB.domain = null;
      return;
    }
    if (!validDomain(d)) {
      if (state) state.textContent = I("hub.badDomain");
      msg("dom-msg", I("hub.badDomain"), "err");
      return;
    }
    var records = domainRecords(d, repo);
    var checks = domainChecklist(d, repo);
    HUB.domain = { domain: d, repo: repo, records: records, checks: checks };
    if (tbody) {
      tbody.innerHTML = records.map(function (r, i) {
        return "<tr><td>" + esc(r.type) + "</td><td>" + esc(r.name) + "</td><td><code>" + esc(r.value) +
          "</code></td><td>" + esc(r.ttl) + "</td><td>" + esc(I("hub.dnsOnly")) + "</td>" +
          '<td><button type="button" class="btn btn-ghost btn-sm" data-dom-copy="' + i + '">' + esc(I("hub.recordCopy")) + "</button></td></tr>";
      }).join("");
    }
    if (list) {
      list.innerHTML = checks.map(function (c) {
        return '<li><span>' + esc(c.t) + "</span><code>" + esc(c.v) + "</code>" +
          '<button type="button" class="btn btn-ghost btn-sm" data-dom-check="' + esc(c.v) + '">' + esc(I("hub.copy")) + "</button>" +
          (c.link ? ' <a class="rowlink" href="' + esc(c.link) + '" target="_blank" rel="noopener">↗</a>' : "") + "</li>";
      }).join("");
    }
    var api = $("#dom-api");
    if (api) { api.hidden = false; api.textContent = bindText(d, repo); }
    var apiBtn = $("#dom-api-copy");
    if (apiBtn) apiBtn.hidden = false;
    if (state) state.textContent = I("hub.dnsReady", { n: records.length, m: checks.length });
    try { localStorage.setItem("sbp:domain", d); } catch (e) { /* noop */ }
    msg("dom-msg", "", "");
  }

  function loadDomain() {
    var input = $("#dom-input"), repoEl = $("#dom-repo");
    if (!input) return;
    if (!input.value) {
      var saved = "";
      try { saved = localStorage.getItem("sbp:domain") || ""; } catch (e) { saved = ""; }
      var fromUrl = hostOf(SC.siteUrl || "");
      var looksDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(fromUrl);
      input.value = saved || (fromUrl && looksDomain && !/\.github\.io$/i.test(fromUrl) ? fromUrl : "");
    }
    if (repoEl && !repoEl.value) {
      var def = HUB.sites.filter(function (s) { return s.site_key === currentKey(); })[0];
      if (def && def.github_repo) repoEl.value = def.github_repo;
      else if (/\.github\.io$/i.test(hostOf(SC.siteUrl || ""))) {
        var h = hostOf(SC.siteUrl || "");
        repoEl.value = h.split(".")[0] + "/" + h;
      }
    }
    paintDomain();
  }

  /* ---------------- 이벤트 ---------------- */
  function bind() {
    var reload = $("#hub-reload");
    if (reload) reload.addEventListener("click", function () { load(); });
    var add = $("#hub-add");
    if (add) add.addEventListener("click", function () {
      fillForm(null);
      var f = $("#hub-f-key"); if (f) f.focus();
      var p = $("#p-hub-site"); if (p && p.scrollIntoView) p.scrollIntoView({ block: "start" });
    });
    var save = $("#hub-save");
    if (save) save.addEventListener("click", saveSite);
    var clear = $("#hub-clear");
    if (clear) clear.addEventListener("click", function () { fillForm(null); });
    var pull = $("#hub-pull");
    if (pull) pull.addEventListener("click", pullCurrent);
    var cards = $("#hub-cards");
    if (cards) cards.addEventListener("click", function (e) {
      var edit = e.target.closest("[data-hub-edit]");
      if (edit) {
        var key = edit.getAttribute("data-hub-edit");
        var site = HUB.sites.filter(function (s) { return s.site_key === key; })[0] || currentSiteCard();
        fillForm(site);
        var p = $("#p-hub-site"); if (p && p.scrollIntoView) p.scrollIntoView({ block: "start" });
        return;
      }
      var go = e.target.closest("[data-hub-go]");
      if (go) {
        var tab = go.getAttribute("data-hub-go");
        var btn = document.querySelector('.admin-tab[data-tab="' + tab + '"]');
        if (btn) btn.click();
      }
    });

    var build = $("#hub-clone-build");
    if (build) build.addEventListener("click", buildClone);
    var dl = $("#hub-clone-dl");
    if (dl) dl.addEventListener("click", cloneDownload);
    var cmdCopy = $("#hub-clone-cmd");
    if (cmdCopy) cmdCopy.addEventListener("click", function () {
      if (!cloneState.cfg) buildClone();
      var pre = $("#hub-clone-commands");
      if (pre) copyText(pre.textContent, "hub-clone-msg");
    });
    var copy2 = $("#hub-clone-copy");
    if (copy2) copy2.addEventListener("click", function () {
      var pre = $("#hub-clone-commands");
      if (pre) copyText(pre.textContent, "hub-clone-msg");
    });

    var domBuild = $("#dom-build");
    if (domBuild) domBuild.addEventListener("click", paintDomain);
    var domInput = $("#dom-input");
    if (domInput) domInput.addEventListener("change", paintDomain);
    var domRepo = $("#dom-repo");
    if (domRepo) domRepo.addEventListener("change", paintDomain);
    var domAll = $("#dom-copy-all");
    if (domAll) domAll.addEventListener("click", function () {
      if (!HUB.domain) paintDomain();
      if (!HUB.domain) { msg("dom-msg", I("hub.dnsNeed"), "err"); return; }
      var text = HUB.domain.records.map(function (r) {
        return r.type + " " + r.name + " " + r.value;
      }).join("\n");
      copyText(text, "dom-msg");
    });
    var domCname = $("#dom-cname");
    if (domCname) domCname.addEventListener("click", function () {
      if (!HUB.domain) paintDomain();
      if (!HUB.domain) { msg("dom-msg", I("hub.cnameNeed"), "err"); return; }
      downloadBlob("CNAME", HUB.domain.domain + "\n", "text/plain;charset=utf-8");
      msg("dom-msg", I("hub.cnameDone"), "ok");
    });
    var domApiBtn = $("#dom-api-copy");
    if (domApiBtn) domApiBtn.addEventListener("click", function () {
      var api = $("#dom-api");
      if (api) copyText(api.textContent, "dom-msg");
    });
    var domTbody = document.querySelector("#dom-records tbody");
    if (domTbody) domTbody.addEventListener("click", function (e) {
      var b = e.target.closest("[data-dom-copy]");
      if (!b || !HUB.domain) return;
      var r = HUB.domain.records[Number(b.getAttribute("data-dom-copy"))];
      if (r) copyText(r.value, "dom-msg");
    });
    var domChecks = $("#dom-checks");
    if (domChecks) domChecks.addEventListener("click", function (e) {
      var b = e.target.closest("[data-dom-check]");
      if (b) copyText(b.getAttribute("data-dom-check"), "dom-msg");
    });
    var cf = $("#dom-cf");
    if (cf) cf.href = "https://dash.cloudflare.com/";
  }

  window.CRAFT_HUB = {
    load: load,
    loadDomain: loadDomain,
    sites: function () { return HUB.sites; },
    ready: function () { return HUB.loaded; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
