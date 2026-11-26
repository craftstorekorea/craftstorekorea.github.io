/* ===== SBPress v10.1 · 업무 · 결재 Pro (assets/work-pro.js) =====
   /admin → ‘업무·결재 Pro’ 탭. 여섯 가지 고도화를 한 화면에 모읍니다.
     1) 조직도 · 업무 분장표 + 담당자별 워크로드(진행·지연·임박)
     2) 반복 일감 설정 · 다음 일감 생성 + 마감 D-3/D-1/지연 배지
     3) 일감 템플릿 원클릭 생성 + 하위 체크리스트 → 진행률 자동 합산
     4) 조건부 결재선 추천 + 결재 대기함 일괄 승인/반려
     5) 기안에 일감 연결 → 최종 승인 시 일감 상태 자동 변경(감사 기록)
     6) 주간/월간 업무·결재 리포트(인쇄 · CSV)
   - 첫 화면(공개 / · /admin 초기 번들) 300KB 예산을 지키려고 이 파일과 work-pro.css 는
     탭을 처음 열 때만 받습니다(admin.js 의 loadWorkPro).
   - 자료: public.org_roles · issues(recurrence) · task_templates · issue_checklist ·
           approval_line_rules · approval_docs(linked_task_id) — supabase/22_v101_work_approval_pro.sql
   - 모든 사용자 입력값은 esc() 로 이스케이프합니다(인라인 핸들러 0 · unsafe-eval 0).
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = CFG.url || "";
  var KEY = CFG.anonKey || "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

  /* ---------------- 세션 · 요청 ---------------- */
  function token() {
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.token) {
      var t = window.CRAFT_AUTH.token();
      if (t) return t;
    }
    try {
      var ref = String(API).replace(/^https?:\/\//, "").split(".")[0];
      var raw = localStorage.getItem("sb-" + ref + "-auth-token");
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.access_token) return o.access_token;
      if (o && o.currentSession && o.currentSession.access_token) return o.currentSession.access_token;
    } catch (e) { /* noop */ }
    return null;
  }
  function me() {
    return (window.CRAFT_AUTH && window.CRAFT_AUTH.user) ? window.CRAFT_AUTH.user() : null;
  }
  function myId() { var u = me(); return u ? u.id : null; }

  function request(path, opts) {
    opts = opts || {};
    var tk = token();
    var headers = { apikey: KEY, "Content-Type": "application/json", Accept: "application/json" };
    if (tk) headers.Authorization = "Bearer " + tk;
    if (opts.prefer) headers.Prefer = opts.prefer;
    var init = { method: opts.method || "GET", headers: headers, cache: "no-store" };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
    return fetch(API + "/rest/v1/" + path, init).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        return { ok: r.ok, status: r.status, data: data, text: txt };
      });
    });
  }
  function rpc(name, body) { return request("rpc/" + name, { method: "POST", body: body || {} }); }

  /* ---------------- 날짜 · 숫자 ---------------- */
  function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); }
  function ymd(v) { return v ? String(v).slice(0, 10) : ""; }
  function dayNo(s) {
    var p = String(s).slice(0, 10).split("-");
    if (p.length !== 3) return NaN;
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
  }
  function addDays(s, n) {
    var t = dayNo(s) + n;
    var d = new Date(t);
    var z = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1) + "-" + z(d.getUTCDate());
  }
  function fmtDate(v) { return v ? ymd(v) : ""; }
  function fmtWhen(v) {
    if (!v) return "";
    var raw = String(v);
    var d = new Date(raw);
    if (!isNaN(d.getTime())) {
      try {
        /* v10.11 — 서버는 UTC(ISO)로 주므로 화면은 항상 KST(Asia/Seoul)로 맞춰 보입니다.
           (예전에는 문자열을 그대로 잘라 다음 실행이 9시간 이르게 보였습니다.) */
        var s = d.toLocaleString("sv-SE", {
          timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: false
        });
        if (s) return s.replace("T", " ");
      } catch (e) { /* 오래된 브라우저는 아래 문자열 처리로 */ }
    }
    return raw.slice(0, 16).replace("T", " ");
  }
  function fmtHours(h) {
    var n = Number(h || 0);
    if (!n) return "0";
    return n >= 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n * 10) / 10);
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return String(n == null ? "" : n);
    return v.toLocaleString("ko-KR");
  }
  function num(v) {
    var n = Number(v || 0);
    return isFinite(n) ? String(n) : "0";
  }

  var STATUS = {
    new: "신규", in_progress: "진행중", resolved: "해결", feedback: "피드백",
    closed: "완료", hold: "보류", draft: "임시저장", pending: "결재중",
    approved: "승인", rejected: "반려", canceled: "회수"
  };
  var DEADLINE = {
    overdue: { cls: "is-over", label: "지연" },
    today: { cls: "is-d1", label: "오늘 마감" },
    d1: { cls: "is-d1", label: "D-1" },
    d3: { cls: "is-d3", label: "D-3" },
    done: { cls: "is-done", label: "완료" },
    none: { cls: "", label: "마감 없음" },
    ok: { cls: "", label: "" }
  };
  var RECUR = { none: "반복 없음", weekly: "매주", monthly: "매월" };
  var TRACKER = { task: "업무", bug: "오류", feature: "기능", support: "지원" };
  var PRIO = { low: "낮음", normal: "보통", high: "높음", urgent: "긴급" };
  var SECTIONS = [
    { k: "org", label: "조직 · 업무 분장" },
    { k: "recur", label: "반복 업무 · 마감" },
    { k: "tmpl", label: "템플릿 · 체크리스트" },
    { k: "appr", label: "결재선 · 일괄 결재" },
    { k: "link", label: "결재 → 업무 연동" },
    { k: "report", label: "업무 · 결재 리포트" }
  ];

  /* ---------------- 상태 ---------------- */
  var S = {
    built: false, loaded: false, loading: false, missing: false, booted: false,
    sec: "org", period: "week",
    org: [], issues: [], people: [], projects: [], templates: [], checklist: [],
    rules: [], forms: [], docs: [], steps: [], audit: [], report: null,
    editRole: null, editTmpl: null, detailIssue: null, rec: null, sel: {},
    deadlineFilter: "", recurOnly: false, msg: ""
  };

  function msg(text, kind) {
    S.msg = text || "";
    var el = $("#wp-msg");
    if (!el) return;
    el.textContent = S.msg;
    el.className = "cms-toast wp-msg" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    el.hidden = !S.msg;
  }
  function fail(r) {
    var m = (r && r.data && (r.data.message || r.data.error_description)) || (r && r.text) || "";
    if (r && r.status === 404) return "표를 찾지 못했습니다 — supabase/22_v101_work_approval_pro.sql 을 먼저 실행해 주세요.";
    return "처리하지 못했습니다: " + String(m).slice(0, 200);
  }
  function nameOf(id) {
    if (!id) return "";
    for (var i = 0; i < S.people.length; i++) if (S.people[i].id === id) return S.people[i].name || "";
    return "";
  }
  function projOf(id) {
    for (var i = 0; i < S.projects.length; i++) if (S.projects[i].id === id) return S.projects[i];
    return null;
  }
  function formOf(code) {
    for (var i = 0; i < S.forms.length; i++) if (S.forms[i].code === code) return S.forms[i];
    return null;
  }
  function isEn() {
    return !!(window.ADMIN_I18N && window.ADMIN_I18N.lang && window.ADMIN_I18N.lang() === "en");
  }
  function formName(code) {
    var f = formOf(code);
    if (!f) return code || "";
    return (isEn() && f.name_en) ? f.name_en : (f.name || code);
  }
  function issueOf(id) {
    for (var i = 0; i < S.issues.length; i++) if (S.issues[i].id === id) return S.issues[i];
    return null;
  }
  function issueLabel(it) {
    if (!it) return "";
    var p = projOf(it.project_id);
    return (p ? p.key + " " : "") + "#" + num(it.issue_no) + " · " + (it.subject || "");
  }
  function checklistOf(issueId) {
    return S.checklist.filter(function (c) { return c.issue_id === issueId; });
  }
  function deadlineState(it) {
    if (!it) return "none";
    if (it.status === "resolved" || it.status === "closed") return "done";
    if (!it.due_on) return "none";
    var diff = dayNo(ymd(it.due_on)) - dayNo(today());
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff === 1) return "d1";
    if (diff <= 3) return "d3";
    return "ok";
  }
  function deadlineBadge(it) {
    var st = deadlineState(it);
    var d = DEADLINE[st] || DEADLINE.ok;
    if (!d.label) return "";
    var extra = "";
    if (st === "overdue") {
      var n = dayNo(today()) - dayNo(ymd(it.due_on));
      extra = " " + num(n);
    }
    return '<span class="wp-badge ' + d.cls + '">' + esc(d.label) + extra + "</span>";
  }
  function stepOf(doc) {
    return S.steps.filter(function (s) { return s.doc_id === doc.id && s.kind !== "ref"; })
      .sort(function (a, b) { return (a.step_order || 0) - (b.step_order || 0); });
  }
  function myTurn(doc) {
    if (!doc || doc.status !== "pending") return null;
    var uid = myId();
    var list = stepOf(doc).filter(function (s) { return s.status === "pending"; });
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.step_order !== doc.current_step) continue;
      if (s.approver_id === uid) return s;
    }
    /* 관리자는 결재자가 아니어도 대신 처리할 수 있습니다(서버 approval_act2 와 같은 규칙). */
    if (!isAdmin()) return null;
    for (var j = 0; j < list.length; j++) {
      if (list[j].step_order === doc.current_step) return list[j];
    }
    return null;
  }
  function isAdmin() { return !!S.isAdmin; }

  /* ==================================================================
     뼈대
     ================================================================== */
  function ensureStyles() {
    if (document.getElementById("wp-style")) return;
    var l = document.createElement("link");
    l.id = "wp-style";
    l.rel = "stylesheet";
    l.href = "assets/work-pro.css";
    document.head.appendChild(l);
  }

  function build() {
    var app = $("#workpro-app");
    if (!app || S.built) return;
    S.built = true;
    app.innerHTML =
      '<div class="wp-hero">' +
        '<div>' +
          '<p class="wp-eyebrow">업무 · 결재 고도화</p>' +
          '<h1>업무 · 결재 Pro</h1>' +
          '<p class="wp-sub">조직도와 업무 분장, 반복 업무, 템플릿과 체크리스트, 조건부 결재선과 일괄 결재, 결재–업무 자동 연동, 주간·월간 리포트를 한 화면에서 다룹니다.</p>' +
        "</div>" +
        '<div class="wp-hero-side">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="wp-reload">새로고침</button>' +
        "</div>" +
      "</div>" +
      '<p class="cms-hint wp-note">public.org_roles · task_templates · issue_checklist · approval_line_rules — 관리자만 읽고 씁니다(RLS). 결재–업무 연동 기록은 audit_logs 에 남습니다.</p>' +
      '<p class="cms-hint wp-missing" id="wp-missing" hidden>고도화 표가 아직 없습니다. <code>supabase/22_v101_work_approval_pro.sql</code> 을 SQL Editor 에서 실행하면 이 화면이 켜집니다.</p>' +
      '<p class="cms-toast wp-msg" id="wp-msg" role="status" aria-live="polite" hidden></p>' +
      '<div class="wp-nav" id="wp-nav" role="tablist">' +
        SECTIONS.map(function (s) {
          return '<button type="button" class="wp-navbtn" role="tab" data-wp-sec="' + s.k + '"' +
            ' aria-selected="' + (s.k === S.sec ? "true" : "false") + '">' + esc(s.label) + "</button>";
        }).join("") +
      "</div>" +
      SECTIONS.map(function (s) {
        return '<section class="wp-sec" id="wp-sec-' + s.k + '" role="tabpanel"' +
          (s.k === S.sec ? "" : " hidden") + "></section>";
      }).join("") +
      '<div class="cms-modal wp-modal" id="wp-modal" hidden role="dialog" aria-modal="true">' +
        '<div class="cms-modal-card"><div class="cms-modal-body" id="wp-modal-body"></div></div>' +
      "</div>";

    $("#wp-reload").addEventListener("click", function () { load(true); });

    $("#wp-nav").addEventListener("click", function (e) {
      var b = e.target.closest("[data-wp-sec]");
      if (!b) return;
      go(b.getAttribute("data-wp-sec"));
    });

    app.addEventListener("click", appClick);
    app.addEventListener("change", appChange);
    app.addEventListener("submit", appSubmit);
    $("#wp-modal").addEventListener("click", function (e) {
      if (e.target && e.target.id === "wp-modal") closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#wp-modal").hidden) closeModal();
    });
  }

  function go(sec) {
    if (sec !== S.sec) msg("");
    S.sec = sec;
    $$("#wp-nav [data-wp-sec]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-wp-sec") === sec ? "true" : "false");
    });
    SECTIONS.forEach(function (s) {
      var el = $("#wp-sec-" + s.k);
      if (el) el.hidden = s.k !== sec;
    });
    paint();
  }

  function closeModal() {
    var m = $("#wp-modal");
    if (m) m.hidden = true;
  }

  /* ==================================================================
     자료 읽기
     ================================================================== */
  function load(force) {
    if (S.loading) return Promise.resolve();
    if (S.loaded && !force) return Promise.resolve();
    S.loading = true;
    var probe = request("org_roles?select=id&limit=1");
    return probe.then(function (r) {
      S.missing = !r.ok && (r.status === 404 || r.status === 400);
      var miss = $("#wp-missing");
      if (miss) miss.hidden = !S.missing;
      if (S.missing) { S.loading = false; return null; }
      return Promise.all([
        rpc("org_workload"),
        request("issues?select=*&order=due_on.asc&limit=1000"),
        rpc("approval_people"),
        request("projects?select=*&order=created_at.asc"),
        request("task_templates?select=*&order=sort_order.asc,name.asc"),
        request("issue_checklist?select=*&order=sort_order.asc&limit=2000"),
        request("approval_line_rules?select=*&order=priority.desc,form_code.asc"),
        request("approval_forms?select=*&order=sort_order.asc"),
        request("approval_docs?select=*&order=created_at.desc&limit=500"),
        request("approval_steps?select=*&order=doc_id.asc,step_order.asc&limit=3000"),
        request("audit_logs?select=created_at,actor_email,action,target_table,target_id,detail&target_table=eq.issues&order=created_at.desc&limit=200"),
        rpc("is_admin")
      ]).then(function (res) {
        S.org = Array.isArray(res[0].data) ? res[0].data : [];
        S.issues = Array.isArray(res[1].data) ? res[1].data : [];
        S.people = Array.isArray(res[2].data) ? res[2].data : [];
        S.projects = Array.isArray(res[3].data) ? res[3].data : [];
        S.templates = Array.isArray(res[4].data) ? res[4].data : [];
        S.checklist = Array.isArray(res[5].data) ? res[5].data : [];
        S.rules = Array.isArray(res[6].data) ? res[6].data : [];
        S.forms = Array.isArray(res[7].data) ? res[7].data : [];
        S.docs = Array.isArray(res[8].data) ? res[8].data : [];
        S.steps = Array.isArray(res[9].data) ? res[9].data : [];
        S.audit = Array.isArray(res[10].data) ? res[10].data : [];
        S.isAdmin = !!(res[11] && res[11].data === true);
        S.loaded = true;
        S.loading = false;
        return loadReport();
      });
    }).catch(function (e) {
      S.loading = false;
      msg("자료를 읽지 못했습니다: " + (e && e.message ? e.message : e), "err");
    }).then(function () {
      S.loading = false;
      paint();
      return null;
    });
  }

  function loadReport() {
    return rpc("work_report", { p_period: S.period }).then(function (r) {
      S.report = (r.ok && r.data && typeof r.data === "object") ? r.data : null;
      return r;
    }).catch(function () { S.report = null; });
  }

  /* ==================================================================
     그리기
     ================================================================== */
  function paint() {
    if (!S.built) return;
    if (S.missing) {
      SECTIONS.forEach(function (s) {
        var el = $("#wp-sec-" + s.k);
        if (el && !el.hidden) el.innerHTML = '<p class="wp-empty">고도화 표가 아직 없습니다 — 위 안내의 SQL 을 실행해 주세요.</p>';
      });
      return;
    }
    if (!S.loaded) {
      SECTIONS.forEach(function (s) {
        var el = $("#wp-sec-" + s.k);
        if (el && !el.hidden) el.innerHTML = '<p class="wp-empty">불러오는 중…</p>';
      });
      return;
    }
    paintBadge();
    if (S.sec === "org") paintOrg();
    else if (S.sec === "recur") paintRecur();
    else if (S.sec === "tmpl") paintTmpl();
    else if (S.sec === "appr") paintAppr();
    else if (S.sec === "link") paintLink();
    else if (S.sec === "report") paintReport();
  }

  function paintBadge() {
    var n = S.docs.filter(function (d) { return !!myTurn(d); }).length;
    var b = $("#tab-wp-count");
    if (b) b.textContent = n ? String(n) : "";
  }

  /* ---------------- 1) 조직도 · 업무 분장 ---------------- */
  function paintOrg() {
    var box = $("#wp-sec-org");
    if (!box) return;
    var open = 0, over = 0, soon = 0;
    S.org.forEach(function (p) {
      open += Number(p.open_count || 0);
      over += Number(p.overdue_count || 0);
      soon += Number(p.due_soon_count || 0);
    });
    var org = S.org.slice().sort(function (a, b) {
      return String(a.dept || "").localeCompare(String(b.dept || ""), "ko") ||
             String(a.team || "").localeCompare(String(b.team || ""), "ko");
    });
    var depts = [];
    org.forEach(function (p) {
      var d = (p.dept || "").trim() || "부서 미지정";
      var t = (p.team || "").trim();
      var dEntry = null;
      for (var i = 0; i < depts.length; i++) if (depts[i].name === d) dEntry = depts[i];
      if (!dEntry) { dEntry = { name: d, teams: [], n: 0 }; depts.push(dEntry); }
      dEntry.n += 1;
      var tEntry = null;
      for (var j = 0; j < dEntry.teams.length; j++) if (dEntry.teams[j].name === t) tEntry = dEntry.teams[j];
      if (!tEntry) { tEntry = { name: t, people: [] }; dEntry.teams.push(tEntry); }
      tEntry.people.push(p);
    });

    box.innerHTML =
      '<div class="wp-kpis">' +
        kpi("인원", num(S.org.length), "조직도에 등록된 담당자") +
        kpi("진행 일감", num(open), "미완료 일감 합계") +
        kpi("지연", num(over), "마감이 지난 미완료") +
        kpi("D-3 임박", num(soon), "오늘부터 사흘 안") +
      "</div>" +
      '<div class="wp-split">' +
        '<section class="panel panel-wide wp-grow">' +
          '<div class="panel-head"><h2>업무 분장표</h2><span class="panel-tag">부서 · 팀 · 직책 · 담당 영역</span></div>' +
          '<p class="cms-hint">한 줄을 누르면 오른쪽 ‘담당자 추가·수정’에 값이 채워집니다. 진행·지연·임박은 일감에서 자동으로 셉니다.</p>' +
          (depts.length ? '<div class="wp-tree">' + depts.map(deptBlock).join("") + "</div>"
                        : '<p class="wp-empty">아직 조직도에 담당자가 없습니다. 오른쪽에서 첫 담당자를 추가해 주세요.</p>') +
        "</section>" +
        '<section class="panel wp-side">' +
          '<div class="panel-head"><h2 id="wp-org-form-title">담당자 추가</h2><span class="panel-tag">업무 분장</span></div>' +
          '<form id="wp-org-form" novalidate>' +
            '<input type="hidden" id="wp-org-id">' +
            '<label class="cms-field"><span>이름</span><input id="wp-org-name" maxlength="80" placeholder="예: 박일차"></label>' +
            '<label class="cms-field"><span>계정</span><select id="wp-org-user"></select></label>' +
            '<label class="cms-field"><span>이메일</span><input id="wp-org-email" type="email" maxlength="120" placeholder="name@example.com"></label>' +
            '<div class="cms-grid2">' +
              '<label class="cms-field"><span>부서</span><input id="wp-org-dept" maxlength="60" placeholder="예: 운영팀"></label>' +
              '<label class="cms-field"><span>팀</span><input id="wp-org-team" maxlength="60" placeholder="예: 결재·회계"></label>' +
              '<label class="cms-field"><span>직책</span><input id="wp-org-title" maxlength="60" placeholder="예: 팀장"></label>' +
              '<label class="cms-field"><span>순서</span><input id="wp-org-sort" type="number" min="0" max="999" value="0"></label>' +
            "</div>" +
            '<label class="cms-field"><span>담당 영역</span><input id="wp-org-area" maxlength="160" placeholder="예: 결재선 · 예산 집행"></label>' +
            '<label class="wp-check"><input type="checkbox" id="wp-org-active" checked> 사용 중</label>' +
            '<div class="wp-formfoot">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="org-reset">새로 입력</button>' +
              '<span class="spacer"></span>' +
              '<button type="submit" class="btn btn-primary btn-sm" id="wp-org-save">저장</button>' +
            "</div>" +
          "</form>" +
        "</section>" +
      "</div>";

    var sel = $("#wp-org-user");
    if (sel) {
      sel.innerHTML = '<option value="">— 계정 연결 안 함 —</option>' + S.people.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + "</option>";
      }).join("");
    }
    fillOrgForm(S.editRole);
  }

  function kpi(label, value, note) {
    return '<div class="wp-kpi"><p class="wp-kpi-label">' + esc(label) + "</p>" +
      '<p class="wp-kpi-value">' + esc(value) + "</p>" +
      '<p class="wp-kpi-note">' + esc(note) + "</p></div>";
  }

  function deptBlock(d) {
    return '<div class="wp-dept">' +
      '<p class="wp-dept-name">' + esc(d.name) + ' <span class="wp-dept-n">' + num(d.n) + "</span></p>" +
      d.teams.map(function (t) {
        return '<div class="wp-team">' +
          (t.name ? '<p class="wp-team-name">' + esc(t.name) + "</p>" : "") +
          t.people.map(personRow).join("") +
        "</div>";
      }).join("") +
    "</div>";
  }

  function personRow(p) {
    var over = Number(p.overdue_count || 0);
    return '<button type="button" class="wp-person" data-wp-act="org-edit" data-id="' + esc(p.role_id) + '">' +
      '<span class="wp-person-main"><b>' + esc(p.name || p.email || "이름 없음") + "</b>" +
        (p.title ? '<span class="wp-title">' + esc(p.title) + "</span>" : "") +
        (p.area ? '<span class="wp-area">' + esc(p.area) + "</span>" : "") +
      "</span>" +
      '<span class="wp-load">' +
        '<span class="wp-li">진행 <b>' + num(p.open_count) + "</b></span>" +
        '<span class="wp-li' + (over ? " is-over" : "") + '">지연 <b>' + num(p.overdue_count) + "</b></span>" +
        '<span class="wp-li">임박 <b>' + num(p.due_soon_count) + "</b></span>" +
      "</span>" +
    "</button>";
  }

  function fillOrgForm(role) {
    if (!$("#wp-org-form")) return;
    role = role || null;
    $("#wp-org-id").value = role ? role.id || "" : "";
    $("#wp-org-name").value = role ? (role.name || "") : "";
    $("#wp-org-email").value = role ? (role.email || "") : "";
    $("#wp-org-dept").value = role ? (role.dept || "") : "";
    $("#wp-org-team").value = role ? (role.team || "") : "";
    $("#wp-org-title").value = role ? (role.title || "") : "";
    $("#wp-org-area").value = role ? (role.area || "") : "";
    $("#wp-org-sort").value = role ? String(role.sort_order || 0) : "0";
    $("#wp-org-active").checked = role ? role.active !== false : true;
    var u = $("#wp-org-user");
    if (u) u.value = role && role.user_id ? role.user_id : "";
    var t = $("#wp-org-form-title");
    if (t) t.textContent = role ? "담당자 수정" : "담당자 추가";
    var del = $("#wp-org-del");
    if (role && !del) {
      var foot = $(".wp-formfoot", $("#wp-org-form"));
      if (foot) {
        var b = document.createElement("button");
        b.type = "button";
        b.id = "wp-org-del";
        b.className = "btn btn-ghost btn-sm danger";
        b.textContent = "삭제";
        b.addEventListener("click", function () { orgDelete(); });
        foot.insertBefore(b, foot.firstChild);
      }
    } else if (!role && del) {
      del.remove();
    }
  }

  function orgPick(id) {
    if (!id) return;
    request("org_roles?select=*&id=eq." + encodeURIComponent(id)).then(function (r) {
      var row = (r.ok && Array.isArray(r.data) && r.data[0]) ? r.data[0] : null;
      if (!row) row = S.org.filter(function (x) { return x.role_id === id; })[0] || null;
      if (row) { S.editRole = row; fillOrgForm(row); }
    });
  }

  function orgSave() {
    var rowId = $("#wp-org-id").value || "";
    var body = {
      user_id: $("#wp-org-user").value || null,
      email: ($("#wp-org-email").value || "").trim(),
      name: ($("#wp-org-name").value || "").trim(),
      dept: ($("#wp-org-dept").value || "").trim(),
      team: ($("#wp-org-team").value || "").trim(),
      title: ($("#wp-org-title").value || "").trim(),
      area: ($("#wp-org-area").value || "").trim(),
      sort_order: Number($("#wp-org-sort").value || 0) || 0,
      active: !!$("#wp-org-active").checked
    };
    if (!body.name && !body.email && !body.user_id) {
      msg("이름이나 이메일 중 하나는 적어 주세요.", "err");
      return;
    }
    var req = rowId
      ? request("org_roles?id=eq." + encodeURIComponent(rowId), { method: "PATCH", body: body, prefer: "return=representation" })
      : request("org_roles", { method: "POST", body: body, prefer: "return=representation" });
    req.then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      msg(rowId ? "담당자를 수정했습니다." : "담당자를 추가했습니다.", "ok");
      S.editRole = null;
      load(true);
    });
  }

  function orgDelete() {
    var rowId = $("#wp-org-id").value || "";
    if (!rowId) { msg("먼저 분장표에서 담당자를 골라 주세요.", "err"); return; }
    if (!window.confirm("이 담당자를 업무 분장표에서 지울까요? 일감은 그대로 남습니다.")) return;
    request("org_roles?id=eq." + encodeURIComponent(rowId), { method: "DELETE" }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      msg("담당자를 지웠습니다.", "ok");
      S.editRole = null;
      load(true);
    });
  }

  /* ---------------- 2) 반복 업무 · 마감 ---------------- */
  function paintRecur() {
    var box = $("#wp-sec-recur");
    if (!box) return;
    var rows = S.issues.filter(function (it) {
      if (S.recurOnly && !(it.recurrence && it.recurrence !== "none")) return false;
      if (S.deadlineFilter && deadlineState(it) !== S.deadlineFilter) return false;
      return true;
    }).sort(function (a, b) {
      var da = a.due_on ? ymd(a.due_on) : "9999-12-31";
      var db = b.due_on ? ymd(b.due_on) : "9999-12-31";
      return da < db ? -1 : da > db ? 1 : 0;
    });
    var recurring = S.issues.filter(function (it) { return it.recurrence && it.recurrence !== "none"; });
    var over = S.issues.filter(function (it) { return deadlineState(it) === "overdue"; }).length;
    var d1 = S.issues.filter(function (it) { return deadlineState(it) === "d1" || deadlineState(it) === "today"; }).length;
    var soon = S.issues.filter(function (it) { return deadlineState(it) === "d3"; }).length;

    box.innerHTML =
      '<div class="wp-kpis">' +
        kpi("반복 일감", num(recurring.length), "매주 · 매월 반복") +
        kpi("지연", num(over), "마감이 지난 일감") +
        kpi("D-1", num(d1), "오늘·내일 마감") +
        kpi("D-3", num(soon), "사흘 안 마감") +
      "</div>" +
      '<section class="panel panel-wide">' +
        '<div class="panel-head"><h2>반복 업무 · 마감</h2><span class="panel-tag">주간 · 월간</span></div>' +
        '<p class="cms-hint">줄의 ‘반복’을 바꾸면 바로 저장됩니다. ‘다음 일감 생성’은 제목·담당·체크리스트를 복사해 다음 회차 일감을 만들고 마감을 한 주기 미룹니다.</p>' +
        '<div class="wp-filters" role="group" aria-label="마감 필터">' +
          chip("", "전체", S.deadlineFilter === "" && !S.recurOnly, "deadline") +
          chip("overdue", "지연", S.deadlineFilter === "overdue", "deadline") +
          chip("today", "오늘 마감", S.deadlineFilter === "today", "deadline") +
          chip("d1", "D-1", S.deadlineFilter === "d1", "deadline") +
          chip("d3", "D-3", S.deadlineFilter === "d3", "deadline") +
          chip("recur", "반복만", S.recurOnly, "recur") +
        "</div>" +
        (rows.length ? '<div class="wp-tablewrap"><table class="admin-table wp-table"><thead><tr>' +
          "<th>일감</th><th>프로젝트</th><th>담당</th><th>마감</th><th>상태</th><th>반복</th><th>다음 실행</th><th></th>" +
          "</tr></thead><tbody>" + rows.map(recurRow).join("") + "</tbody></table></div>"
          : '<p class="wp-empty">조건에 맞는 일감이 없습니다.</p>') +
      "</section>";
  }

  function chip(value, label, on, kind) {
    var attr = kind === "recur" ? 'data-wp-act="recur-only"'
      : 'data-wp-act="deadline" data-value="' + esc(value) + '"';
    return '<button type="button" class="fchip' + (on ? " on" : "") + '" ' + attr +
      ' aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + "</button>";
  }

  function recurRow(it) {
    var d = DEADLINE[deadlineState(it)] || {};
    return "<tr" + (d.cls === "is-over" ? ' class="is-over"' : "") + ">" +
      '<td class="wp-cell-main"><b>' + esc(issueLabel(it)) + "</b>" +
        (it.recur_source_id ? ' <span class="wp-tag">반복</span>' : "") + "</td>" +
      "<td>" + esc((projOf(it.project_id) || {}).name || "") + "</td>" +
      "<td>" + esc(nameOf(it.assignee_id) || "—") + "</td>" +
      "<td>" + esc(ymd(it.due_on) || "—") + " " + deadlineBadge(it) + "</td>" +
      "<td>" + esc(STATUS[it.status] || it.status) + "</td>" +
      '<td><select class="wp-mini" data-wp-act="recur-set" data-id="' + esc(it.id) + '" aria-label="반복 규칙">' +
        Object.keys(RECUR).map(function (k) {
          return '<option value="' + k + '"' + ((it.recurrence || "none") === k ? " selected" : "") + ">" +
            esc(RECUR[k]) + "</option>";
        }).join("") + "</select></td>" +
      "<td>" + esc(fmtWhen(it.next_run_at) || "—") + "</td>" +
      '<td class="right">' + ((it.recurrence && it.recurrence !== "none")
        ? '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="recur-run" data-id="' + esc(it.id) + '">다음 일감 생성</button>'
        : "") + "</td>" +
    "</tr>";
  }

  function recurSet(id, value) {
    var body = { recurrence: value };
    if (value === "none") body.next_run_at = null;
    request("issues?id=eq." + encodeURIComponent(id), {
      method: "PATCH", prefer: "return=representation", body: body
    }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      var it = issueOf(id);
      if (it) {
        it.recurrence = value;
        if (value === "none") it.next_run_at = null;
      }
      msg("반복 규칙을 저장했습니다.", "ok");
      paintRecur();
    });
  }

  function recurRun(id) {
    msg("다음 일감을 만드는 중…");
    rpc("issue_recur_run", { p_issue_id: id }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      var d = r.data || {};
      msg("다음 일감을 만들었습니다 · " + (d.subject ? d.subject : "") + " (마감 " + fmtDate(d.due_on) + ")", "ok");
      load(true);
    });
  }

  /* ---------------- 3) 템플릿 · 체크리스트 ---------------- */
  function paintTmpl() {
    var box = $("#wp-sec-tmpl");
    if (!box) return;
    var detail = S.detailIssue ? issueOf(S.detailIssue) : null;
    box.innerHTML =
      '<div class="wp-split">' +
        '<section class="panel panel-wide wp-grow">' +
          '<div class="panel-head"><h2>일감 템플릿</h2>' +
            '<div class="panel-tools"><button type="button" class="btn btn-primary btn-sm" data-wp-act="tmpl-new">템플릿 만들기</button></div>' +
          "</div>" +
          '<p class="cms-hint">자주 쓰는 일감을 템플릿으로 저장해 두면, 누를 때 일감과 하위 체크리스트가 한 번에 만들어집니다.</p>' +
          (S.templates.length ? '<div class="wp-cards">' + S.templates.map(tmplCard).join("") + "</div>"
            : '<p class="wp-empty">아직 템플릿이 없습니다. ‘템플릿 만들기’로 첫 템플릿을 저장해 보세요.</p>') +
        "</section>" +
        '<section class="panel wp-side wp-grow">' +
          '<div class="panel-head"><h2>하위 체크리스트</h2><span class="panel-tag">진행률 자동 합산</span></div>' +
          '<label class="cms-field"><span>일감</span><select id="wp-cl-issue"></select></label>' +
          '<div id="wp-cl-box"></div>' +
        "</section>" +
      "</div>";

    var sel = $("#wp-cl-issue");
    if (sel) {
      var list = S.issues.slice(0, 300);
      sel.innerHTML = '<option value="">— 일감 선택 —</option>' + list.map(function (it) {
        return '<option value="' + esc(it.id) + '"' + (S.detailIssue === it.id ? " selected" : "") + ">" +
          esc(issueLabel(it)) + "</option>";
      }).join("");
    }
    paintChecklist(detail);
  }

  function tmplCard(t) {
    var items = (t.checklist || []).map(function (x) {
      return typeof x === "string" ? x : (x && x.text) || "";
    }).filter(Boolean);
    return '<article class="wp-card" data-template="' + esc(t.id) + '">' +
      '<header><h3>' + esc(t.name) + "</h3>" +
        '<span class="wp-tag">' + esc(RECUR[t.recurrence] || RECUR.none) + "</span>" +
        (t.active === false ? '<span class="wp-tag is-off">꺼짐</span>' : "") + "</header>" +
      '<p class="wp-card-sub">' + esc(t.subject || t.name) + "</p>" +
      '<p class="wp-card-meta"><span>' + esc(t.dept || "부서 공통") + "</span> · <span>" +
        esc(TRACKER[t.tracker] || t.tracker) + "</span> · <span>" +
        esc(PRIO[t.priority] || t.priority) + "</span> · <span>마감 " + num(t.due_days) + "</span></p>" +
      '<ul class="wp-card-list">' + items.map(function (x) {
        return "<li>" + esc(x) + "</li>";
      }).join("") + "</ul>" +
      '<div class="wp-card-foot">' +
        '<button type="button" class="btn btn-primary btn-sm" data-wp-act="tmpl-apply" data-id="' + esc(t.id) + '">일감 만들기</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="tmpl-edit" data-id="' + esc(t.id) + '">수정</button>' +
      "</div>" +
    "</article>";
  }

  function paintChecklist(detail) {
    var box = $("#wp-cl-box");
    if (!box) return;
    if (!detail) {
      box.innerHTML = '<p class="wp-empty">일감을 고르면 체크리스트와 진행률이 보입니다.</p>';
      return;
    }
    var items = checklistOf(detail.id).sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    var done = items.filter(function (c) { return c.done; }).length;
    var pct = Number(detail.progress || 0);
    if (items.length) pct = Math.round(done * 100 / items.length);
    box.innerHTML =
      '<div class="wp-cl-head">' +
        "<b>" + esc(detail.subject || "") + "</b>" +
        '<span class="wp-badge ' + (DEADLINE[deadlineState(detail)] || {}).cls + '">' +
          esc((DEADLINE[deadlineState(detail)] || {}).label || "") + "</span>" +
      "</div>" +
      '<div class="wp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i>' +
        '<span>' + num(pct) + "%</span>" +
      "</div>" +
      '<p class="cms-hint">완료 <b>' + num(done) + "</b> / 전체 <b>" + num(items.length) + "</b> — 체크하면 일감 진행률이 바로 바뀝니다.</p>" +
      (items.length ? '<ul class="wp-checks">' + items.map(function (c) {
        return '<li class="' + (c.done ? "is-done" : "") + '">' +
          '<label class="wp-check"><input type="checkbox" data-wp-act="cl-toggle" data-id="' + esc(c.id) + '"' +
            (c.done ? " checked" : "") + '> <span>' + esc(c.text) + "</span></label>" +
          '<button type="button" class="wp-x" data-wp-act="cl-del" data-id="' + esc(c.id) + '" aria-label="체크리스트 항목 삭제">×</button>' +
        "</li>";
      }).join("") + "</ul>" : '<p class="wp-empty">체크리스트 항목이 없습니다.</p>') +
      '<form class="wp-inline" id="wp-cl-add">' +
        '<input id="wp-cl-text" maxlength="300" placeholder="체크리스트 항목 추가" aria-label="체크리스트 항목">' +
        '<button type="submit" class="btn btn-ghost btn-sm">추가</button>' +
      "</form>";
  }

  function tmplForm(t) {
    var items = ((t && t.checklist) || []).map(function (x) {
      return typeof x === "string" ? x : (x && x.text) || "";
    }).filter(Boolean);
    var box = $("#wp-modal-body");
    box.innerHTML =
      '<div class="cms-modal-head"><h2 id="wp-modal-title">' + (t ? "템플릿 수정" : "템플릿 만들기") + "</h2>" +
        '<button type="button" class="cms-modal-x" data-wp-act="modal-close" aria-label="닫기">×</button></div>' +
      '<form id="wp-tmpl-form" novalidate>' +
        '<input type="hidden" id="wp-t-id" value="' + esc(t ? t.id : "") + '">' +
        '<label class="cms-field"><span>템플릿 이름</span><input id="wp-t-name" maxlength="120" value="' + esc(t ? t.name : "") + '" placeholder="예: 월간 결재 리포트 마감"></label>' +
        '<label class="cms-field"><span>일감 제목</span><input id="wp-t-subject" maxlength="200" value="' + esc(t ? t.subject : "") + '" placeholder="비우면 템플릿 이름을 씁니다"></label>' +
        '<label class="cms-field"><span>설명</span><textarea id="wp-t-desc" rows="2">' + esc(t ? t.description : "") + "</textarea></label>" +
        '<div class="cms-grid2">' +
          '<label class="cms-field"><span>종류</span><select id="wp-t-tracker">' +
            Object.keys(TRACKER).map(function (k) {
              return '<option value="' + k + '"' + (t && t.tracker === k ? " selected" : "") + ">" + esc(TRACKER[k]) + "</option>";
            }).join("") + "</select></label>" +
          '<label class="cms-field"><span>우선순위</span><select id="wp-t-priority">' +
            Object.keys(PRIO).map(function (k) {
              return '<option value="' + k + '"' + (t && t.priority === k ? " selected" : "") + ">" + esc(PRIO[k]) + "</option>";
            }).join("") + "</select></label>" +
          '<label class="cms-field"><span>부서</span><input id="wp-t-dept" maxlength="60" value="' + esc(t ? t.dept : "") + '"></label>' +
          '<label class="cms-field"><span>담당자</span><select id="wp-t-assignee"></select></label>' +
          '<label class="cms-field"><span>마감(일 뒤)</span><input id="wp-t-days" type="number" min="0" max="365" value="' + num(t ? (t.due_days == null ? 7 : t.due_days) : 7) + '"></label>' +
          '<label class="cms-field"><span>반복</span><select id="wp-t-recur">' +
            Object.keys(RECUR).map(function (k) {
              return '<option value="' + k + '"' + (t && t.recurrence === k ? " selected" : "") + ">" + esc(RECUR[k]) + "</option>";
            }).join("") + "</select></label>" +
        "</div>" +
        '<label class="cms-field"><span>체크리스트 <em>한 줄에 하나</em></span><textarea id="wp-t-checks" rows="5" placeholder="자료 모으기&#10;초안 작성&#10;결재 상신">' + esc(items.join("\n")) + "</textarea></label>" +
        '<div class="wp-formfoot">' +
          (t ? '<button type="button" class="btn btn-ghost btn-sm danger" data-wp-act="tmpl-del" data-id="' + esc(t.id) + '">삭제</button>' : "") +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="modal-close">취소</button>' +
          '<button type="submit" class="btn btn-primary btn-sm">저장</button>' +
        "</div>" +
      "</form>";
    var sel = $("#wp-t-assignee");
    if (sel) {
      sel.innerHTML = '<option value="">— 지정 안 함 —</option>' + S.people.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (t && t.assignee_id === p.id ? " selected" : "") + ">" +
          esc(p.name || p.id) + "</option>";
      }).join("");
    }
    $("#wp-modal").hidden = false;
  }

  function tmplSave() {
    var id = $("#wp-t-id").value || "";
    var lines = ($("#wp-t-checks").value || "").split("\n").map(function (x) { return x.trim(); })
      .filter(Boolean);
    var body = {
      name: ($("#wp-t-name").value || "").trim(),
      subject: ($("#wp-t-subject").value || "").trim(),
      description: ($("#wp-t-desc").value || "").trim(),
      tracker: $("#wp-t-tracker").value,
      priority: $("#wp-t-priority").value,
      dept: ($("#wp-t-dept").value || "").trim(),
      assignee_id: $("#wp-t-assignee").value || null,
      due_days: Number($("#wp-t-days").value || 7) || 0,
      recurrence: $("#wp-t-recur").value,
      checklist: lines
    };
    if (!body.name) { msg("템플릿 이름을 적어 주세요.", "err"); return; }
    var req = id
      ? request("task_templates?id=eq." + encodeURIComponent(id), { method: "PATCH", body: body, prefer: "return=representation" })
      : request("task_templates", { method: "POST", body: body, prefer: "return=representation" });
    req.then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      closeModal();
      msg(id ? "템플릿을 수정했습니다." : "템플릿을 저장했습니다.", "ok");
      load(true);
    });
  }

  function tmplDelete(id) {
    if (!window.confirm("이 템플릿을 지울까요? 이미 만들어진 일감은 그대로 남습니다.")) return;
    request("task_templates?id=eq." + encodeURIComponent(id), { method: "DELETE" }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      closeModal();
      msg("템플릿을 지웠습니다.", "ok");
      load(true);
    });
  }

  function tmplApply(id) {
    msg("템플릿으로 일감을 만드는 중…");
    rpc("template_apply", { p_template_id: id }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      var d = r.data || {};
      S.detailIssue = d.id || null;
      msg("일감을 만들었습니다 · " + (d.subject || "") + " · 체크리스트 " + num(d.checklist_total) + "개", "ok");
      load(true);
    });
  }

  function clAdd(issueId, text) {
    if (!issueId) { msg("먼저 일감을 골라 주세요.", "err"); return; }
    rpc("checklist_add", { p_issue_id: issueId, p_text: text }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      var it = issueOf(issueId);
      if (it && r.data && r.data.progress != null) it.progress = r.data.progress;
      msg("체크리스트 항목을 더했습니다.", "ok");
      load(true);
    });
  }

  function clToggle(id, done) {
    rpc("checklist_toggle", { p_id: id, p_done: !!done }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); paintTmpl(); return; }
      var d = r.data || {};
      var row = S.checklist.filter(function (c) { return c.id === id; })[0];
      if (row) { row.done = !!done; }
      var it = issueOf(row && row.issue_id);
      if (it && d.progress != null) it.progress = d.progress;
      paintTmpl();
    });
  }

  function clDelete(id) {
    rpc("checklist_remove", { p_id: id }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      var row = S.checklist.filter(function (c) { return c.id === id; })[0];
      var it = issueOf(row && row.issue_id);
      if (it && r.data && r.data.progress != null) it.progress = r.data.progress;
      S.checklist = S.checklist.filter(function (c) { return c.id !== id; });
      paintTmpl();
    });
  }

  /* ---------------- 4) 조건부 결재선 · 일괄 결재 ---------------- */
  function paintAppr() {
    var box = $("#wp-sec-appr");
    if (!box) return;
    var inbox = S.docs.filter(function (d) { return !!myTurn(d); });
    box.innerHTML =
      '<section class="panel panel-wide">' +
        '<div class="panel-head"><h2>조건부 결재선 규칙</h2><span class="panel-tag">양식 · 금액</span></div>' +
        '<p class="cms-hint">양식과 금액 구간에 맞는 결재선을 규칙으로 저장합니다. 기안할 때 ‘결재선 추천’을 누르면 이 규칙이 먼저 적용됩니다(전결 규정이 걸리면 전결이 우선).</p>' +
        (S.rules.length ? '<div class="wp-tablewrap"><table class="admin-table wp-table"><thead><tr>' +
          "<th>양식</th><th>금액 구간</th><th>결재선</th><th>비고</th><th>상태</th><th></th>" +
          "</tr></thead><tbody>" + S.rules.map(ruleRow).join("") + "</tbody></table></div>"
          : '<p class="wp-empty">아직 규칙이 없습니다. 아래에서 첫 규칙을 저장해 보세요.</p>') +
        '<form id="wp-rule-form" class="wp-grid-form" novalidate>' +
          '<input type="hidden" id="wp-r-id">' +
          '<label class="cms-field"><span>양식</span><select id="wp-r-form"></select></label>' +
          '<label class="cms-field"><span>최소 금액</span><input id="wp-r-min" type="number" min="0" step="1000" placeholder="0"></label>' +
          '<label class="cms-field"><span>최대 금액</span><input id="wp-r-max" type="number" min="0" step="1000" placeholder="비우면 상한 없음"></label>' +
          '<label class="cms-field"><span>1차 결재자</span><select id="wp-r-a1"></select></label>' +
          '<label class="cms-field"><span>최종 결재자</span><select id="wp-r-a2"></select></label>' +
          '<label class="cms-field"><span>우선순위</span><input id="wp-r-pri" type="number" value="0"></label>' +
          '<label class="cms-field wp-span2"><span>비고</span><input id="wp-r-note" maxlength="160" placeholder="예: 100만원 이상은 대표 승인"></label>' +
          '<div class="wp-formfoot wp-span2">' +
            '<label class="wp-check"><input type="checkbox" id="wp-r-active" checked> 사용</label>' +
            '<span class="spacer"></span>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="rule-reset">새로 입력</button>' +
            '<button type="submit" class="btn btn-primary btn-sm">규칙 저장</button>' +
          "</div>" +
        "</form>" +
      "</section>" +

      '<div class="wp-split">' +
        '<section class="panel panel-wide wp-grow">' +
          '<div class="panel-head"><h2>기안 · 결재선 추천</h2><span class="panel-tag">일감 연결</span></div>' +
          '<form id="wp-draft-form" novalidate>' +
            '<div class="cms-grid2">' +
              '<label class="cms-field"><span>양식</span><select id="wp-d-form"></select></label>' +
              '<label class="cms-field"><span>금액</span><input id="wp-d-amount" type="number" min="0" step="1000" placeholder="금액이 없으면 비워 두세요"></label>' +
            "</div>" +
            '<label class="cms-field"><span>제목</span><input id="wp-d-title" maxlength="200" placeholder="예: 11월 인쇄비 지출"></label>' +
            '<label class="cms-field"><span>본문</span><textarea id="wp-d-body" rows="3" placeholder="내용을 적어 주세요"></textarea></label>' +
            '<div class="wp-line">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="recommend">결재선 추천</button>' +
              '<span class="wp-rec" id="wp-d-rec-box">규칙에 맞는 결재선을 찾으면 여기에 표시됩니다.</span>' +
            "</div>" +
            '<div class="cms-grid2">' +
              '<label class="cms-field"><span>1차 결재자</span><select id="wp-d-a1"></select></label>' +
              '<label class="cms-field"><span>최종 결재자</span><select id="wp-d-a2"></select></label>' +
              '<label class="cms-field"><span>관련 일감</span><select id="wp-d-task"></select></label>' +
              '<label class="cms-field"><span>승인 시 일감 상태</span><select id="wp-d-target">' +
                ["resolved", "closed", "in_progress", "feedback", "hold"].map(function (k) {
                  return '<option value="' + k + '"' + (k === "resolved" ? " selected" : "") + ">" + esc(STATUS[k]) + "</option>";
                }).join("") + "</select></label>" +
            "</div>" +
            '<p class="cms-hint">관련 일감을 고르면 이 기안이 최종 승인되는 순간 그 일감의 상태가 위 값으로 바뀌고, 변경 사실이 audit_logs 에 남습니다.</p>' +
            '<div class="wp-formfoot"><span class="spacer"></span>' +
              '<button type="submit" class="btn btn-primary btn-sm" id="wp-d-submit">상신하기</button>' +
            "</div>" +
          "</form>" +
        "</section>" +
        '<section class="panel wp-side wp-grow">' +
          '<div class="panel-head"><h2>결재 대기함</h2><span class="dash-stamp" id="wp-inbox-n">' + num(inbox.length) + "</span></div>" +
          '<p class="cms-hint">처리할 기안을 골라 한 번에 승인하거나 반려합니다. 건별로 권한과 상태를 다시 확인합니다.</p>' +
          (inbox.length ? '<div class="wp-tablewrap"><table class="admin-table wp-table wp-inbox"><thead><tr>' +
            '<th><input type="checkbox" id="wp-all" aria-label="전체 선택"></th>' +
            "<th>문서</th><th>기안자</th><th>상신</th></tr></thead><tbody>" +
            inbox.map(inboxRow).join("") + "</tbody></table></div>"
            : '<p class="wp-empty">지금 처리할 기안이 없습니다.</p>') +
          '<form id="wp-batch-form" class="wp-inline">' +
            '<input id="wp-b-comment" maxlength="200" placeholder="반려 사유(반려할 때 필수)" aria-label="반려 사유">' +
            '<button type="submit" class="btn btn-primary btn-sm" data-wp-act="batch-approve">일괄 승인</button>' +
            '<button type="submit" class="btn btn-ghost btn-sm danger" data-wp-act="batch-reject">일괄 반려</button>' +
          "</form>" +
        "</section>" +
      "</div>";

    var opts = function (list, selected) {
      return '<option value="">— 선택 —</option>' + list.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (selected === p.id ? " selected" : "") + ">" +
          esc(p.name || p.id) + "</option>";
      }).join("");
    };
    ["#wp-r-a1", "#wp-r-a2", "#wp-d-a1", "#wp-d-a2"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.innerHTML = opts(S.people);
    });
    var rf = $("#wp-r-form");
    if (rf) {
      rf.innerHTML = '<option value="">모든 양식</option>' + S.forms.map(function (f) {
        return '<option value="' + esc(f.code) + '">' + esc(f.name || f.code) + "</option>";
      }).join("");
    }
    var df = $("#wp-d-form");
    if (df) {
      df.innerHTML = S.forms.map(function (f) {
        return '<option value="' + esc(f.id) + '" data-code="' + esc(f.code) + '">' +
          esc(f.name || f.code) + "</option>";
      }).join("");
    }
    var dt = $("#wp-d-task");
    if (dt) {
      dt.innerHTML = '<option value="">— 연결 안 함 —</option>' + S.issues.slice(0, 200).map(function (it) {
        return '<option value="' + esc(it.id) + '">' + esc(issueLabel(it)) + "</option>";
      }).join("");
    }
    S.sel = {};
  }

  function ruleRow(r) {
    var names = (r.steps || []).map(function (s) {
      return nameOf(s.approver_id) || s.approver_name || "";
    }).filter(Boolean);
    var range = (r.min_amount == null ? "0" : money(r.min_amount)) + " ~ " +
      (r.max_amount == null ? "상한 없음" : money(r.max_amount));
    return "<tr>" +
      "<td>" + esc(r.form_code ? (formName(r.form_code) || r.form_code) : "모든 양식") + "</td>" +
      "<td>" + esc(range) + "</td>" +
      "<td>" + esc(names.join(" → ") || "—") + "</td>" +
      "<td>" + esc(r.note || "") + "</td>" +
      '<td>' + (r.active === false ? '<span class="wp-tag is-off">꺼짐</span>' : '<span class="wp-tag">사용</span>') + "</td>" +
      '<td class="right">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="rule-edit" data-id="' + esc(r.id) + '">수정</button>' +
        '<button type="button" class="btn btn-ghost btn-sm danger" data-wp-act="rule-del" data-id="' + esc(r.id) + '">삭제</button>' +
      "</td>" +
    "</tr>";
  }

  function inboxRow(d) {
    return "<tr>" +
      '<td><input type="checkbox" class="wp-doc" data-id="' + esc(d.id) + '" aria-label="' + esc(d.doc_no || d.title) + '"></td>' +
      '<td class="wp-cell-main"><b>' + esc(d.doc_no || "") + "</b> " + esc(d.title || "") +
        '<span class="wp-card-meta">' + esc(formName(d.form_code)) + "</span></td>" +
      "<td>" + esc(d.drafter_name || nameOf(d.drafter_id) || "") + "</td>" +
      "<td>" + esc(fmtDate(d.submitted_at)) + "</td>" +
    "</tr>";
  }

  function ruleEdit(id) {
    var r = S.rules.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    $("#wp-r-id").value = r.id;
    $("#wp-r-form").value = r.form_code || "";
    $("#wp-r-min").value = r.min_amount == null ? "" : r.min_amount;
    $("#wp-r-max").value = r.max_amount == null ? "" : r.max_amount;
    $("#wp-r-pri").value = num(r.priority);
    $("#wp-r-note").value = r.note || "";
    $("#wp-r-active").checked = r.active !== false;
    var steps = (r.steps || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var apps = steps.filter(function (s) { return (s.kind || "approve") === "approve"; });
    if ($("#wp-r-a1")) $("#wp-r-a1").value = apps[0] ? apps[0].approver_id : "";
    if ($("#wp-r-a2")) $("#wp-r-a2").value = apps[1] ? apps[1].approver_id : "";
    msg("규칙을 불러왔습니다. 고친 뒤 ‘규칙 저장’을 눌러 주세요.");
  }

  function ruleSave() {
    var id = $("#wp-r-id").value || "";
    var steps = [];
    var a1 = $("#wp-r-a1").value, a2 = $("#wp-r-a2").value;
    if (a1) steps.push({ kind: "approve", order: 1, approver_id: a1 });
    if (a2) steps.push({ kind: "approve", order: 2, approver_id: a2 });
    if (!steps.length) { msg("결재자를 한 명 이상 골라 주세요.", "err"); return; }
    var body = {
      form_code: $("#wp-r-form").value || "",
      min_amount: $("#wp-r-min").value === "" ? null : Number($("#wp-r-min").value),
      max_amount: $("#wp-r-max").value === "" ? null : Number($("#wp-r-max").value),
      steps: steps,
      priority: Number($("#wp-r-pri").value || 0) || 0,
      note: ($("#wp-r-note").value || "").trim(),
      active: !!$("#wp-r-active").checked
    };
    var req = id
      ? request("approval_line_rules?id=eq." + encodeURIComponent(id), { method: "PATCH", body: body, prefer: "return=representation" })
      : request("approval_line_rules", { method: "POST", body: body, prefer: "return=representation" });
    req.then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      msg(id ? "규칙을 수정했습니다." : "규칙을 저장했습니다.", "ok");
      load(true);
    });
  }

  function ruleDelete(id) {
    if (!window.confirm("이 결재선 규칙을 지울까요?")) return;
    request("approval_line_rules?id=eq." + encodeURIComponent(id), { method: "DELETE" }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      msg("규칙을 지웠습니다.", "ok");
      load(true);
    });
  }

  function recommend() {
    var sel = $("#wp-d-form");
    var opt = sel && sel.options[sel.selectedIndex];
    var code = opt ? opt.getAttribute("data-code") : "";
    var amount = $("#wp-d-amount").value;
    rpc("approval_recommend", { p_form_code: code, p_amount: amount === "" ? null : Number(amount) })
      .then(function (r) {
        if (!r.ok) { msg(fail(r), "err"); return; }
        var d = r.data || {};
        var box = $("#wp-d-rec-box");
        if (!d.found) {
          if (box) box.textContent = "조건에 맞는 규칙이 없습니다. 결재자를 직접 골라 주세요.";
          S.rec = null;
          return;
        }
        S.rec = d;
        var steps = (d.steps || []).filter(function (s) { return (s.kind || "approve") === "approve"; });
        if (box) {
          box.innerHTML = '<span class="wp-tag">추천</span> ' + steps.map(function (s) {
            return esc(s.approver_name || nameOf(s.approver_id) || "");
          }).join(" → ") + (d.note ? ' <span class="wp-meta">' + esc(d.note) + "</span>" : "");
        }
        if (steps[0] && $("#wp-d-a1")) $("#wp-d-a1").value = steps[0].approver_id;
        if (steps[1] && $("#wp-d-a2")) $("#wp-d-a2").value = steps[1].approver_id;
        if (steps[0] && !$("#wp-d-a2").value) $("#wp-d-a2").value = "";
      });
  }

  function draftSubmit() {
    var sel = $("#wp-d-form");
    var formId = sel ? sel.value : "";
    var title = ($("#wp-d-title").value || "").trim();
    if (!formId) { msg("결재 양식을 골라 주세요.", "err"); return; }
    if (!title) { msg("제목을 적어 주세요.", "err"); return; }
    var a1 = $("#wp-d-a1").value, a2 = $("#wp-d-a2").value;
    var steps = [];
    if (a1) steps.push({ kind: "approve", order: 1, approver_id: a1 });
    if (a2 && a2 !== a1) steps.push({ kind: "approve", order: 2, approver_id: a2 });
    if (!steps.length) { msg("결재자를 골라 주세요.", "err"); return; }
    var amount = $("#wp-d-amount").value;
    var fields = {};
    if (amount !== "") fields.amount = amount;
    var taskId = $("#wp-d-task").value || null;
    msg("상신하는 중…");
    rpc("approval_create3", {
      p_form_id: formId, p_title: title, p_body: $("#wp-d-body").value || "",
      p_fields: fields, p_steps: steps, p_submit: true,
      p_linked_task_id: taskId, p_task_target_status: $("#wp-d-target").value || "resolved",
      p_use_rule: true
    }).then(function (r) {
      if (!r.ok) { msg(fail(r), "err"); return; }
      var d = r.data || {};
      msg("기안을 상신했습니다 · " + (d.doc_no || "") + (taskId ? " · 일감 연결" : ""), "ok");
      $("#wp-d-title").value = "";
      $("#wp-d-body").value = "";
      $("#wp-d-amount").value = "";
      load(true);
    });
  }

  function batch(action) {
    var ids = Object.keys(S.sel).filter(function (k) { return S.sel[k]; });
    if (!ids.length) { msg("처리할 기안을 골라 주세요.", "err"); return; }
    var comment = ($("#wp-b-comment").value || "").trim();
    if (action === "reject" && !comment) { msg("반려 사유를 적어 주세요.", "err"); return; }
    if (action === "reject" && !window.confirm("고른 기안 " + ids.length + "건을 반려할까요?")) return;
    msg("일괄 처리하는 중…");
    rpc("approval_batch_act", { p_doc_ids: ids, p_action: action, p_comment: comment || null })
      .then(function (r) {
        if (!r.ok) { msg(fail(r), "err"); return; }
        var d = r.data || {};
        var ok = Number(d.ok_count || 0), bad = Number(d.fail_count || 0);
        var line = action === "approve" ? "승인" : "반려";
        msg(line + " " + num(ok) + "건 · 실패 " + num(bad) + "건" +
            (bad && d.failed && d.failed[0] ? " — " + d.failed[0].error : ""),
            bad ? "err" : "ok");
        S.sel = {};
        load(true);
      });
  }

  /* ---------------- 5) 결재 → 업무 연동 ---------------- */
  function paintLink() {
    var box = $("#wp-sec-link");
    if (!box) return;
    var linked = S.docs.filter(function (d) { return !!d.linked_task_id; });
    var auto = S.audit.filter(function (a) {
      var d = a.detail || {};
      return d && (d.source === "approval_auto" || d.auto === true);
    });
    box.innerHTML =
      '<section class="panel panel-wide">' +
        '<div class="panel-head"><h2>결재 – 업무 자동 연동</h2><span class="panel-tag">최종 승인 → 일감 상태</span></div>' +
        '<p class="cms-hint">기안에 일감을 연결해 두면, 최종 승인되는 순간 그 일감의 상태가 약속한 값으로 바뀌고 감사 기록(audit_logs)이 남습니다. 반려·회수에는 아무 변화도 일어나지 않습니다.</p>' +
        (linked.length ? '<div class="wp-tablewrap"><table class="admin-table wp-table"><thead><tr>' +
          "<th>기안</th><th>상태</th><th>연결 일감</th><th>일감 현재</th><th>승인 시</th><th></th>" +
          "</tr></thead><tbody>" + linked.map(linkRow).join("") + "</tbody></table></div>"
          : '<p class="wp-empty">아직 일감이 연결된 기안이 없습니다. ‘결재선 · 일괄 결재’에서 기안할 때 관련 일감을 골라 보세요.</p>') +
      "</section>" +
      '<section class="panel panel-wide">' +
        '<div class="panel-head"><h2>자동 변경 기록</h2><span class="dash-stamp">' + num(auto.length) + "</span></div>" +
        '<p class="cms-hint">approval_auto 표시가 있는 감사 로그입니다. 누가 승인해 어느 일감이 어떻게 바뀌었는지 남습니다.</p>' +
        (auto.length ? '<ul class="wp-logs">' + auto.slice(0, 20).map(function (a) {
          var d = a.detail || {};
          var it = issueOf(a.target_id);
          return '<li><span class="wp-log-time">' + esc(fmtWhen(a.created_at)) + "</span>" +
            '<span class="wp-log-who">' + esc(a.actor_email || "시스템") + "</span>" +
            "<span>" + esc(it ? issueLabel(it) : (d.subject || a.target_id || "")) + "</span>" +
            '<span class="wp-log-move">' + esc(STATUS[d.from] || d.from || "") + " → " +
              esc(STATUS[d.to] || d.to || "") + "</span>" +
            (d.doc_no ? '<span class="wp-log-doc">' + esc(d.doc_no) + "</span>" : "") + "</li>";
        }).join("") + "</ul>" : '<p class="wp-empty">아직 자동 변경 기록이 없습니다.</p>') +
      "</section>";
  }

  function linkRow(doc) {
    var it = issueOf(doc.linked_task_id);
    var applied = doc.status === "approved";
    return "<tr>" +
      '<td class="wp-cell-main"><b>' + esc(doc.doc_no || "") + "</b> " + esc(doc.title || "") +
        '<span class="wp-card-meta">' + esc(formName(doc.form_code)) + "</span></td>" +
      "<td>" + esc(STATUS[doc.status] || doc.status) + "</td>" +
      "<td>" + esc(it ? issueLabel(it) : doc.linked_task_id) + "</td>" +
      "<td>" + esc(it ? (STATUS[it.status] || it.status) : "—") + "</td>" +
      "<td>" + esc(STATUS[doc.task_target_status] || doc.task_target_status || "") + "</td>" +
      "<td>" + (applied ? '<span class="wp-badge is-done">반영됨</span>' : '<span class="wp-badge">대기</span>') + "</td>" +
    "</tr>";
  }

  /* ---------------- 6) 리포트 ---------------- */
  function paintReport() {
    var box = $("#wp-sec-report");
    if (!box) return;
    var r = S.report;
    if (!r) {
      box.innerHTML = '<div class="wp-filters">' + periodChips() + "</div>" +
        '<p class="wp-empty">리포트를 불러오지 못했습니다. 새로고침을 눌러 주세요.</p>';
      return;
    }
    var t = r.tasks || {}, a = r.approvals || {}, pv = r.prev || {};
    var dept = r.by_dept || [], forms = r.by_form || [];
    box.innerHTML =
      '<div class="wp-filters wp-nonprint">' + periodChips() +
        '<span class="spacer"></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="report-refresh">새로고침</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="report-print">인쇄 / PDF</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-wp-act="report-csv">CSV 내려받기</button>' +
      "</div>" +
      '<section class="panel panel-wide wp-report" id="wp-report">' +
        '<div class="panel-head"><h2>' + (S.period === "month" ? "월간 업무 · 결재 리포트" : "주간 업무 · 결재 리포트") + "</h2>" +
          '<span class="dash-stamp">' + esc(fmtDate(r.from)) + " ~ " + esc(fmtDate(r.to)) + "</span></div>" +
        '<div class="wp-kpis">' +
          kpi("완료 일감", num(t.completed), "이전 기간 " + num(pv.completed)) +
          kpi("지연", num(t.overdue_open), "지금 기준 미완료") +
          kpi("평균 결재 시간", fmtHours(a.avg_hours), "시간 · 승인된 기안") +
          kpi("승인 / 반려", num(a.approved) + " / " + num(a.rejected), "상신 " + num(a.submitted)) +
        "</div>" +
        '<div class="wp-split">' +
          '<div class="wp-grow">' +
            '<p class="sub-h">부서별 일감</p>' +
            '<table class="admin-table wp-table"><thead><tr><th>부서</th><th>완료</th><th>미완료</th></tr></thead><tbody>' +
            (dept.length ? dept.map(function (d) {
              return "<tr><td>" + esc(d.dept || "") + "</td><td>" + num(d.done) + "</td><td>" + num(d.open) + "</td></tr>";
            }).join("") : '<tr><td colspan="3" class="wp-empty">자료가 없습니다.</td></tr>') +
            "</tbody></table>" +
          "</div>" +
          '<div class="wp-grow">' +
            '<p class="sub-h">양식별 결재</p>' +
            '<table class="admin-table wp-table"><thead><tr><th>양식</th><th>상신</th><th>승인</th><th>평균</th></tr></thead><tbody>' +
            (forms.length ? forms.map(function (f) {
              return "<tr><td>" + esc(formName(f.form_code) || f.form_code) + "</td><td>" + num(f.total) +
                "</td><td>" + num(f.approved) + "</td><td>" + fmtHours(f.avg_hours) + "</td></tr>";
            }).join("") : '<tr><td colspan="4" class="wp-empty">자료가 없습니다.</td></tr>') +
            "</tbody></table>" +
          "</div>" +
        "</div>" +
        '<p class="cms-hint">완료 일감은 resolved·closed 로 끝난 일감, 평균 결재 시간은 상신부터 최종 승인까지의 평균입니다. 이전 기간(' +
          esc(fmtDate(r.prev_from)) + " ~ " + esc(fmtDate(r.prev_to)) + ")과 비교합니다.</p>" +
      "</section>";
  }

  function periodChips() {
    return '<button type="button" class="fchip' + (S.period === "week" ? " on" : "") +
      '" data-wp-act="period" data-value="week" aria-pressed="' + (S.period === "week" ? "true" : "false") + '">주간</button>' +
      '<button type="button" class="fchip' + (S.period === "month" ? " on" : "") +
      '" data-wp-act="period" data-value="month" aria-pressed="' + (S.period === "month" ? "true" : "false") + '">월간</button>';
  }

  function reportCsv() {
    var r = S.report;
    if (!r) return;
    var rows = [["SBPress 업무 · 결재 리포트"], ["기간", fmtDate(r.from) + " ~ " + fmtDate(r.to)],
      ["구분", "값"], ["완료 일감", num((r.tasks || {}).completed)],
      ["지연(미완료)", num((r.tasks || {}).overdue_open)],
      ["진행 일감", num((r.tasks || {}).open)],
      ["상신", num((r.approvals || {}).submitted)],
      ["승인", num((r.approvals || {}).approved)],
      ["반려", num((r.approvals || {}).rejected)],
      ["평균 결재 시간(시간)", fmtHours((r.approvals || {}).avg_hours)], [],
      ["부서", "완료", "미완료"]];
    (r.by_dept || []).forEach(function (d) { rows.push([d.dept || "", num(d.done), num(d.open)]); });
    rows.push([], ["양식", "상신", "승인", "평균(시간)"]);
    (r.by_form || []).forEach(function (f) {
      rows.push([formName(f.form_code) || f.form_code, num(f.total), num(f.approved), fmtHours(f.avg_hours)]);
    });
    var csv = "\ufeff" + rows.map(function (line) {
      return line.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sbpress-work-report-" + fmtDate(r.to) + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    msg("리포트를 CSV 로 내려받았습니다.", "ok");
  }

  function printReport() {
    document.body.classList.add("wp-print-report");
    try { window.print(); } catch (e) { /* noop */ }
    setTimeout(function () { document.body.classList.remove("wp-print-report"); }, 1200);
  }

  /* ==================================================================
     이벤트
     ================================================================== */
  function appClick(e) {
    var t = e.target.closest("[data-wp-act]");
    if (!t) return;
    var act = t.getAttribute("data-wp-act");
    var id = t.getAttribute("data-id");

    if (act === "org-edit") { orgPick(id); return; }
    if (act === "org-reset") { S.editRole = null; fillOrgForm(null); return; }
    if (act === "recommend") { recommend(); return; }
    if (act === "rule-reset") {
      $("#wp-r-id").value = "";
      $("#wp-r-min").value = "";
      $("#wp-r-max").value = "";
      $("#wp-r-note").value = "";
      $("#wp-r-pri").value = "0";
      $("#wp-r-a1").value = "";
      $("#wp-r-a2").value = "";
      return;
    }
    if (act === "deadline") {
      var v = t.getAttribute("data-value");
      S.deadlineFilter = S.deadlineFilter === v ? "" : v;
      S.recurOnly = false;
      paintRecur(); return;
    }
    if (act === "recur-only") { S.recurOnly = !S.recurOnly; S.deadlineFilter = ""; paintRecur(); return; }
    if (act === "recur-run") { recurRun(id); return; }
    if (act === "tmpl-new") { tmplForm(null); return; }
    if (act === "tmpl-edit") {
      tmplForm(S.templates.filter(function (x) { return x.id === id; })[0] || null); return;
    }
    if (act === "tmpl-apply") { tmplApply(id); return; }
    if (act === "tmpl-del") { tmplDelete(id); return; }
    if (act === "cl-del") { clDelete(id); return; }
    if (act === "modal-close") { closeModal(); return; }
    if (act === "rule-edit") { ruleEdit(id); return; }
    if (act === "rule-del") { ruleDelete(id); return; }
    if (act === "batch-approve") { e.preventDefault(); batch("approve"); return; }
    if (act === "batch-reject") { e.preventDefault(); batch("reject"); return; }
    if (act === "period") { S.period = t.getAttribute("data-value"); loadReport().then(function () { paintReport(); }); return; }
    if (act === "report-refresh") { loadReport().then(function () { paintReport(); }); return; }
    if (act === "report-csv") { reportCsv(); return; }
    if (act === "report-print") { printReport(); return; }
  }

  function appChange(e) {
    var t = e.target;
    var act = t.getAttribute && t.getAttribute("data-wp-act");
    if (act === "recur-set") { recurSet(t.getAttribute("data-id"), t.value); return; }
    if (act === "cl-toggle") { clToggle(t.getAttribute("data-id"), t.checked); return; }
    if (t.id === "wp-cl-issue") {
      S.detailIssue = t.value || null;
      paintChecklist(S.detailIssue ? issueOf(S.detailIssue) : null);
      return;
    }
    if (t.id === "wp-all") {
      $$(".wp-doc").forEach(function (c) { c.checked = t.checked; S.sel[c.getAttribute("data-id")] = t.checked; });
      return;
    }
    if (t.classList && t.classList.contains("wp-doc")) {
      S.sel[t.getAttribute("data-id")] = t.checked;
    }
  }

  function appSubmit(e) {
    var f = e.target;
    if (!f || !f.id) return;
    if (f.id === "wp-org-form") { e.preventDefault(); orgSave(); return; }
    if (f.id === "wp-tmpl-form") { e.preventDefault(); tmplSave(); return; }
    if (f.id === "wp-cl-add") {
      e.preventDefault();
      var txt = ($("#wp-cl-text").value || "").trim();
      if (!txt) return;
      clAdd(S.detailIssue, txt);
      return;
    }
    if (f.id === "wp-rule-form") { e.preventDefault(); ruleSave(); return; }
    if (f.id === "wp-draft-form") { e.preventDefault(); draftSubmit(); return; }
    if (f.id === "wp-batch-form") { e.preventDefault(); return; }
  }

  /* ==================================================================
     바깥에 여는 창
     ================================================================== */
  function show(section) {
    ensureStyles();
    build();
    if (section) go(section);
    paint();
    load();
  }

  window.CRAFT_WORKPRO = {
    show: show,
    refresh: function () { return load(true); },
    state: S
  };
})();
