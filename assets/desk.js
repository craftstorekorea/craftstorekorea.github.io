/* ===== 전국공방 · 내 업무 홈 (assets/desk.js) =====
   SBPress v10.16 — #/desk
   - 로그인한 사용자가 한 화면에서 오늘 할 일을 봅니다.
     · 내 담당 일감(진행 중 · 오늘/이번 주 마감 · 지연)과 상태 빠른 변경
     · 내 결재 대기함(결재·합의 대기 문서) → 문서로 바로 이동
     · 오늘·이번 주 마감 타임라인
   - 읽기·쓰기는 모두 로그인 세션 토큰으로 보내고, 서버 RLS(issues · approval_steps)가
     담당자·결재자만 고칠 수 있게 막습니다. 이 화면은 그 결과를 보여 줄 뿐입니다.
   의존: assets/i18n.js, assets/auth.js(세션·프로필), assets/cms.js(site_contents)
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = CFG.url || "";
  var KEY = CFG.anonKey || "";

  function I(key, vars) {
    return window.CRAFT_I18N ? window.CRAFT_I18N.t(key, vars) : key;
  }
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
  function signedIn() {
    return !!(window.CRAFT_AUTH && window.CRAFT_AUTH.isSignedIn && window.CRAFT_AUTH.isSignedIn());
  }
  function myId() {
    var u = (window.CRAFT_AUTH && window.CRAFT_AUTH.user) ? window.CRAFT_AUTH.user() : null;
    return u ? u.id : null;
  }

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

  /* ---------------- 날짜 (한국 기준) ---------------- */
  function todayKST() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  }
  function ymd(v) { return v ? String(v).slice(0, 10) : ""; }
  function dayNumber(v) {
    var p = String(v).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
  }
  function addDays(v, n) {
    var d = new Date((dayNumber(v) + n) * 86400000);
    var z = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1) + "-" + z(d.getUTCDate());
  }
  function dowOf(v) { return new Date(dayNumber(v) * 86400000).getUTCDay(); }
  function shortDate(v) { return String(v).slice(5).replace("-", "."); }
  function whenLabel(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return ""; }
  }

  var OPEN_STATUSES = ["new", "in_progress", "feedback", "hold"];
  var ALL_STATUSES = ["new", "in_progress", "feedback", "hold", "resolved", "closed"];

  /* ---------------- 상태 ---------------- */
  var D = {
    built: false, loading: false, missing: false, error: "",
    me: null, issues: [], projects: {}, approvals: [], loaded: false
  };

  function myGradeOK() {
    return signedIn();
  }

  function deskMsg(text, kind) {
    var el = $("#desk-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "desk-msg" + (kind ? " " + kind : "");
  }

  /* ---------------- 뼈대 ---------------- */
  function build() {
    var app = $("#desk-app");
    if (!app || D.built) return;
    D.built = true;
    app.innerHTML =
      '<div class="desk-kpis" id="desk-kpis"></div>' +
      '<p class="desk-msg" id="desk-msg" role="status" aria-live="polite"></p>' +
      '<div class="desk-cols">' +
        '<section class="desk-card desk-issues" id="desk-issues-card" aria-labelledby="desk-issues-h">' +
          '<div class="desk-card-head">' +
            '<h3 id="desk-issues-h">' + esc(I("desk.issues.title")) + "</h3>" +
            '<span class="desk-tag" id="desk-issues-count"></span>' +
            '<a class="desk-more" href="#/tasks">' + esc(I("desk.toTasks")) + " ›</a>" +
          "</div>" +
          '<div id="desk-issues"></div>' +
        "</section>" +
        '<div class="desk-side">' +
          '<section class="desk-card" id="desk-appr-card" aria-labelledby="desk-appr-h">' +
            '<div class="desk-card-head">' +
              '<h3 id="desk-appr-h">' + esc(I("desk.appr.title")) + "</h3>" +
              '<span class="desk-tag" id="desk-appr-count"></span>' +
              '<a class="desk-more" href="#/approvals">' + esc(I("desk.toApprovals")) + " ›</a>" +
            "</div>" +
            '<div id="desk-appr"></div>' +
          "</section>" +
          '<section class="desk-card" id="desk-week-card" aria-labelledby="desk-week-h">' +
            '<div class="desk-card-head">' +
              '<h3 id="desk-week-h">' + esc(I("desk.timeline.title")) + "</h3>" +
              '<a class="desk-more" href="#/calendar">' + esc(I("desk.toCalendar")) + " ›</a>" +
            "</div>" +
            '<div id="desk-week"></div>' +
          "</section>" +
        "</div>" +
      "</div>";
  }

  /* ---------------- 게이트 ---------------- */
  function paintGate() {
    var gate = $("#desk-gate"), app = $("#desk-app"), head = $("#desk-head");
    if (!gate || !app) return;
    if (head) head.hidden = false;
    if (!signedIn()) {
      gate.hidden = false;
      app.hidden = true;
      gate.innerHTML =
        '<div class="tasks-gate-card">' +
          '<span class="tasks-gate-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2.4"/><path d="M8 10V7.6a4 4 0 0 1 8 0V10"/></svg>' +
          "</span>" +
          "<h3>" + esc(I("desk.gate.title")) + "</h3>" +
          "<p>" + esc(I("desk.gate.desc")) + "</p>" +
          '<button type="button" class="btn btn-primary btn-sm" id="desk-login">' + esc(I("desk.gate.btn")) + "</button>" +
        "</div>";
      var btn = $("#desk-login");
      if (btn) btn.addEventListener("click", function () {
        if (window.CRAFT_AUTH && window.CRAFT_AUTH.openLogin) window.CRAFT_AUTH.openLogin();
      });
      return;
    }
    gate.hidden = true;
    app.hidden = false;
    build();
  }

  /* ---------------- 불러오기 ---------------- */
  function load(force) {
    paintGate();
    if (!signedIn()) return Promise.resolve();
    if (D.loading) return Promise.resolve();
    if (D.loaded && !force) return Promise.resolve();
    var uid = myId();
    if (!uid) return Promise.resolve();
    D.loading = true;
    D.me = uid;
    var box = $("#desk-issues");
    if (box && !D.issues.length) box.innerHTML = '<p class="desk-empty">' + esc(I("desk.loading")) + "</p>";

    return Promise.all([
      request("issues?select=id,issue_no,subject,status,priority,progress,due_on,starts_on,project_id,assignee_id,author_id,updated_at,recurrence,next_run_at" +
        "&assignee_id=eq." + encodeURIComponent(uid) + "&order=due_on.asc&limit=300"),
      request("projects?select=id,key,name&order=key.asc&limit=200"),
      request("approval_steps?select=id,doc_id,step_order,kind,status,approver_id,created_at" +
        "&approver_id=eq." + encodeURIComponent(uid) + "&status=eq.pending&order=doc_id.asc&limit=100")
    ]).then(function (res) {
      var ir = res[0], pr = res[1], sr = res[2];
      D.missing = !ir.ok && (ir.status === 404 || ir.status === 400);
      if (D.missing) {
        D.loading = false;
        D.error = "issues";
        paintMissing();
        return;
      }
      if (!ir.ok) {
        D.loading = false;
        D.error = (ir.data && ir.data.message) || ("HTTP " + ir.status);
        deskMsg(I("desk.fail") + " " + String(D.error).slice(0, 120), "err");
        return;
      }
      D.error = "";
      D.issues = Array.isArray(ir.data) ? ir.data : [];
      D.projects = {};
      ((pr && pr.ok && pr.data) || []).forEach(function (p) { D.projects[p.id] = p; });
      var steps = (sr && sr.ok && Array.isArray(sr.data)) ? sr.data : [];
      var ids = [];
      steps.forEach(function (s) { if (s.doc_id && ids.indexOf(s.doc_id) < 0) ids.push(s.doc_id); });
      if (!ids.length) { D.approvals = []; return finishLoad(); }
      return request("approval_docs?select=id,doc_no,title,status,drafter_name,submitted_at,current_step,linked_task_id" +
        "&id=in.(" + ids.map(encodeURIComponent).join(",") + ")&limit=100").then(function (dr) {
        var docs = (dr && dr.ok && Array.isArray(dr.data)) ? dr.data : [];
        var byId = {};
        docs.forEach(function (d) { byId[d.id] = d; });
        D.approvals = steps.filter(function (s) {
          var doc = byId[s.doc_id];
          return doc && doc.status === "pending";
        }).map(function (s) {
          return { step: s, doc: byId[s.doc_id] };
        });
        finishLoad();
      }, function () { D.approvals = []; finishLoad(); });
    }).catch(function (e) {
      D.loading = false;
      deskMsg(I("desk.fail") + " " + (e && e.message ? e.message : e), "err");
    });
  }

  function finishLoad() {
    D.loading = false;
    D.loaded = true;
    paintKpis();
    paintIssues();
    paintApprovals();
    paintWeek();
  }

  function paintMissing() {
    var box = $("#desk-issues");
    if (box) {
      box.innerHTML = '<p class="desk-empty">' + esc(I("desk.missing")) +
        ' <code>supabase/16_v41_approvals_redmine.sql</code></p>';
    }
    var a = $("#desk-appr");
    if (a) a.innerHTML = "";
    var w = $("#desk-week");
    if (w) w.innerHTML = "";
    var k = $("#desk-kpis");
    if (k) k.innerHTML = "";
  }

  /* ---------------- KPI ---------------- */
  function buckets() {
    var today = todayKST();
    var weekEnd = addDays(today, 7 - dowOf(today) % 7);   /* 이번 주 일요일 */
    var b = { open: 0, today: 0, week: 0, late: 0, todayList: [], weekList: [], lateList: [] };
    D.issues.forEach(function (it) {
      var st = it.status || "new";
      var open = OPEN_STATUSES.indexOf(st) >= 0;
      if (open) b.open += 1;
      var due = ymd(it.due_on);
      if (!open || !due) return;
      if (due < today) { b.late += 1; b.lateList.push(it); return; }
      if (due === today) { b.today += 1; b.todayList.push(it); return; }
      if (due <= weekEnd) { b.week += 1; b.weekList.push(it); }
    });
    b.weekEnd = weekEnd;
    return b;
  }

  function paintKpis() {
    var box = $("#desk-kpis");
    if (!box) return;
    var b = buckets();
    var items = [
      { k: "open", label: I("desk.kpi.open"), n: b.open, note: I("desk.kpi.open.note") },
      { k: "today", label: I("desk.kpi.today"), n: b.today, note: b.today ? I("desk.kpi.today.note") : I("desk.kpi.today.none") },
      { k: "week", label: I("desk.kpi.week"), n: b.week, note: I("desk.kpi.week.note", { date: shortDate(b.weekEnd) }) },
      { k: "late", label: I("desk.kpi.late"), n: b.late, note: b.late ? I("desk.kpi.late.note") : I("desk.kpi.late.none") }
    ];
    box.innerHTML = items.map(function (x) {
      return '<article class="desk-kpi is-' + x.k + (x.n ? " has" : "") + '">' +
        '<p class="desk-kpi-label">' + esc(x.label) + "</p>" +
        '<p class="desk-kpi-n">' + x.n + "</p>" +
        '<p class="desk-kpi-note">' + esc(x.note) + "</p></article>";
    }).join("");
  }

  /* ---------------- 내 일감 ---------------- */
  function dueBadge(it) {
    var due = ymd(it.due_on);
    if (!due) return '<span class="desk-due is-none">' + esc(I("desk.noDue")) + "</span>";
    var diff = dayNumber(due) - dayNumber(todayKST());
    var cls = diff < 0 ? "is-late" : diff === 0 ? "is-today" : diff <= 3 ? "is-soon" : "";
    var label = diff === 0 ? I("desk.dueToday") : diff < 0 ? I("desk.dueOver", { n: -diff }) : I("desk.dueLeft", { n: diff });
    return '<span class="desk-due ' + cls + '" title="' + esc(due) + '">' + esc(label) + "</span>";
  }

  function statusSelect(it, disabled) {
    return '<select class="desk-st is-' + esc(it.status || "new") + '" data-desk-st="' + esc(it.id) + '"' +
      (disabled ? " disabled" : "") + ' aria-label="' + esc(I("rm.status")) + '">' +
      ALL_STATUSES.map(function (s) {
        return '<option value="' + s + '"' + ((it.status || "new") === s ? " selected" : "") + ">" +
          esc(I("rm.st." + s)) + "</option>";
      }).join("") + "</select>";
  }

  function paintIssues() {
    var box = $("#desk-issues");
    var cnt = $("#desk-issues-count");
    if (!box) return;
    var today = todayKST();
    var open = D.issues.filter(function (it) { return OPEN_STATUSES.indexOf(it.status || "new") >= 0; });
    open.sort(function (a, b) {
      var da = ymd(a.due_on) || "9999-99-99", db = ymd(b.due_on) || "9999-99-99";
      if (da !== db) return da < db ? -1 : 1;
      return (a.issue_no || 0) - (b.issue_no || 0);
    });
    if (cnt) cnt.textContent = I("desk.issues.count", { n: open.length });
    if (!open.length) {
      box.innerHTML = '<p class="desk-empty">' + esc(I("desk.issues.empty")) +
        '<br><a class="desk-empty-link" href="#/tasks">' + esc(I("desk.issues.emptyLink")) + "</a></p>";
      return;
    }
    var soon = open.slice(0, 12);
    box.innerHTML = '<ul class="desk-list">' + soon.map(function (it) {
      var p = D.projects[it.project_id];
      var late = ymd(it.due_on) && ymd(it.due_on) < today && OPEN_STATUSES.indexOf(it.status) >= 0;
      return '<li class="desk-item' + (late ? " is-late" : "") + '" data-desk-issue="' + esc(it.id) + '">' +
        '<div class="desk-item-main">' +
          '<span class="desk-no">#' + esc(it.issue_no) + "</span>" +
          (p ? '<span class="desk-proj">' + esc(p.key || p.name) + "</span>" : "") +
          '<a class="desk-subject" href="#/tasks?issue=' + encodeURIComponent(it.id) + '">' + esc(it.subject) + "</a>" +
        "</div>" +
        '<div class="desk-item-meta">' +
          dueBadge(it) +
          (it.progress != null ? '<span class="desk-prog" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, it.progress)) + '%"></i></span>' : "") +
          statusSelect(it, false) +
        "</div>" +
      "</li>";
    }).join("") + "</ul>" +
      (open.length > soon.length ? '<p class="desk-more-note">' + esc(I("desk.issues.more", { n: open.length - soon.length })) + "</p>" : "");
    $$("[data-desk-st]", box).forEach(function (sel) {
      sel.addEventListener("change", function () { changeStatus(sel); });
    });
  }

  function changeStatus(sel) {
    var id = sel.getAttribute("data-desk-st");
    var st = sel.value;
    sel.disabled = true;
    request("issues?id=eq." + encodeURIComponent(id), {
      method: "PATCH", prefer: "return=representation",
      body: { status: st }
    }).then(function (r) {
      sel.disabled = false;
      if (!r.ok) {
        deskMsg(I("desk.statusFail") + " " + String((r.data && r.data.message) || r.text || "").slice(0, 100), "err");
        return;
      }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      D.issues.forEach(function (it) { if (it.id === id && row) { it.status = row.status; it.progress = row.progress; } });
      deskMsg(I("desk.statusSaved", { no: "#" + (row && row.issue_no ? row.issue_no : "") , st: I("rm.st." + st) }), "ok");
      paintKpis();
      paintIssues();
      paintWeek();
    }).catch(function () {
      sel.disabled = false;
      deskMsg(I("desk.statusFail"), "err");
    });
  }

  /* ---------------- 결재 대기함 ---------------- */
  function paintApprovals() {
    var box = $("#desk-appr");
    var cnt = $("#desk-appr-count");
    if (!box) return;
    if (cnt) cnt.textContent = I("desk.appr.count", { n: D.approvals.length });
    if (!D.approvals.length) {
      box.innerHTML = '<p class="desk-empty">' + esc(I("desk.appr.empty")) + "</p>";
      return;
    }
    box.innerHTML = '<ul class="desk-list desk-appr-list">' + D.approvals.map(function (a) {
      var d = a.doc;
      var kindKey = a.step.kind === "agree" ? "desk.appr.kind.agree" : a.step.kind === "ref" ? "desk.appr.kind.ref" : "desk.appr.kind.approve";
      return '<li class="desk-appr-item">' +
        '<div class="desk-appr-top">' +
          '<span class="desk-kind is-' + esc(a.step.kind || "approve") + '">' + esc(I(kindKey)) + "</span>" +
          '<span class="desk-docno">' + esc(d.doc_no || "") + "</span>" +
        "</div>" +
        '<a class="desk-appr-title" href="#/approvals?doc=' + encodeURIComponent(d.id) + '">' + esc(d.title) + "</a>" +
        '<p class="desk-appr-meta">' + esc(d.drafter_name || "") +
          (d.submitted_at ? " · " + esc(whenLabel(d.submitted_at)) : "") + "</p>" +
        '<a class="btn btn-ghost btn-sm desk-appr-open" href="#/approvals?doc=' + encodeURIComponent(d.id) + '">' +
          esc(I("desk.appr.open")) + " ›</a>" +
      "</li>";
    }).join("") + "</ul>";
  }

  /* ---------------- 오늘·이번 주 타임라인 ---------------- */
  function paintWeek() {
    var box = $("#desk-week");
    if (!box) return;
    var today = todayKST();
    var b = buckets();
    var days = [];
    for (var n = 0; n < 7; n++) {
      var day = addDays(today, n);
      var items = D.issues.filter(function (it) {
        return ymd(it.due_on) === day && OPEN_STATUSES.indexOf(it.status || "new") >= 0;
      });
      days.push({ day: day, items: items });
    }
    var late = b.lateList.slice(0, 3);
    var html = "";
    if (late.length) {
      html += '<div class="desk-strip-row is-late"><span class="desk-strip-day">' + esc(I("desk.kpi.late")) + "</span>" +
        '<span class="desk-strip-items">' + late.map(function (it) {
          return '<a href="#/tasks?issue=' + encodeURIComponent(it.id) + '">#' + esc(it.issue_no) + " " + esc(it.subject) + "</a>";
        }).join("") + "</span></div>";
    }
    html += '<div class="desk-strip">' + days.map(function (d, i) {
      var isToday = d.day === today;
      return '<div class="desk-strip-col' + (isToday ? " is-today" : "") + '" data-day="' + d.day + '">' +
        '<span class="desk-strip-dow">' + esc(I("cal.dow." + (dowOf(d.day) === 0 ? 7 : dowOf(d.day)))) + "</span>" +
        '<span class="desk-strip-date">' + esc(shortDate(d.day)) + "</span>" +
        '<span class="desk-strip-n' + (d.items.length ? " has" : "") + '">' + d.items.length + "</span>" +
        '<span class="desk-strip-titles">' + d.items.slice(0, 2).map(function (it) {
          return '<a href="#/tasks?issue=' + encodeURIComponent(it.id) + '" title="' + esc(it.subject) + '">' +
            esc(it.subject) + "</a>";
        }).join("") + (d.items.length > 2 ? '<em>+' + (d.items.length - 2) + "</em>" : "") + "</span>" +
      "</div>";
    }).join("") + "</div>";
    if (!b.open) {
      html += '<p class="desk-empty">' + esc(I("desk.timeline.empty")) + "</p>";
    }
    box.innerHTML = html;
  }

  /* ---------------- 보이기 ---------------- */
  function show() {
    paintGate();
    if (!signedIn()) return;
    build();
    load(false);
  }

  function refresh() {
    if (!signedIn()) { paintGate(); return Promise.resolve(); }
    build();
    D.loaded = false;
    return load(true).then(function () {
      if (D.loaded) { paintKpis(); paintIssues(); paintApprovals(); paintWeek(); }
    });
  }

  /* 로그인·로그아웃으로 화면이 열려 있으면 다시 그립니다. */
  /* 언어를 바꾸면 카드 머리글·안내도 그 언어로 다시 그립니다(build 는 한 번만 그리므로 새로 그립니다). */
  if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
    window.CRAFT_I18N.onChange(function () {
      var app = $("#desk-app");
      D.built = false;
      if (app) app.innerHTML = "";
      D.loaded = false;
      if ((location.hash || "").indexOf("#/desk") === 0) show();
    });
  }

  if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
    window.CRAFT_AUTH.onChange(function () {
      /* 로그아웃이면 감춥니다. 로그인·프로필 도착이면 새로 받습니다.
         (받는 중인 요청이 있으면 show() 가 그대로 두고, 끝난 뒤 다시 그립니다) */
      if (!signedIn()) {
        D.loaded = false;
        D.issues = [];
        D.approvals = [];
        paintGate();
        return;
      }
      D.loaded = false;
      if ((location.hash || "").indexOf("#/desk") === 0) show();
    });
  }

  window.CRAFT_DESK = { show: show, refresh: refresh, signedIn: signedIn };
})();
