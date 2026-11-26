/* ===== 전국공방 · 업무 관리 (assets/tasks.js) =====
   - #/tasks 화면. 로그아웃 상태에서는 로그인 안내만 보입니다(헤더 메뉴에서도 숨김).
   - 로그인한 회원이면 누구나 업무를 읽고 쓰고 옮길 수 있습니다.
     (서버 RLS: public.tasks — anon 접근 불가, 최소 등급은 site_contents.tasks.min_grade)
   - 모든 요청은 로그인 세션 토큰으로 보냅니다. anon 키로는 tasks 에 닿지 않습니다.
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

  /* ---------------- 세션 토큰 ---------------- */
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
  function me() {
    return (window.CRAFT_AUTH && window.CRAFT_AUTH.user) ? window.CRAFT_AUTH.user() : null;
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

  function rpc(name, body) { return request("rpc/" + name, { method: "POST", body: body || {} }); }
  function myId() { var u = me(); return u ? u.id : null; }

  /* ---------------- 설정 읽기 ---------------- */
  function minGrade() {
    var n = 1;
    try {
      var c = window.CRAFT_CMS && window.CRAFT_CMS.contents ? window.CRAFT_CMS.contents() : null;
      var row = c && c["tasks.min_grade"];
      var v = row && row.value != null ? parseInt(String(row.value).trim(), 10) : NaN;
      if (v >= 1 && v <= 3) n = v;
    } catch (e) { /* 기본 1 */ }
    return n;
  }
  function myGrade() {
    var p = window.CRAFT_AUTH && window.CRAFT_AUTH.profile ? window.CRAFT_AUTH.profile() : null;
    var n = p && p.member_grade != null ? parseInt(p.member_grade, 10) : 0;
    return isNaN(n) ? 0 : n;
  }
  function gradeName(n) {
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.gradeName) return window.CRAFT_AUTH.gradeName(n);
    return String(n);
  }

  /* ---------------- 상태 ---------------- */
  var state = {
    rows: [],
    filter: "all",        // all | todo | doing | done
    q: "",
    editing: null,
    loading: false,
    error: "",
    booted: false
  };
  var STATUSES = ["todo", "doing", "done"];
  var PRIOS = ["low", "normal", "high"];

  function todayKST() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  }
  function dayNumber(ymd) {
    var p = String(ymd).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
  }
  function dueInfo(due) {
    if (!due) return "";
    var d = String(due).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
    var diff = dayNumber(d) - dayNumber(todayKST());
    if (diff === 0) return I("tasks.due.today");
    if (diff < 0) return I("tasks.due.over", { n: -diff });
    return I("tasks.due.left", { n: diff });
  }
  function dueClass(due) {
    if (!due) return "";
    var d = String(due).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
    var diff = dayNumber(d) - dayNumber(todayKST());
    if (diff < 0) return " is-over";
    if (diff <= 3) return " is-soon";
    return "";
  }

  /* ---------------- 게이트 ---------------- */
  function paintGate() {
    var gate = $("#tasks-gate"), app = $("#tasks-app"), head = $("#tasks-head");
    if (!gate || !app) return;
    var ok = signedIn();
    var need = minGrade();
    var mine = myGrade();
    if (head) head.hidden = !ok;
    if (!ok) {
      gate.hidden = false;
      app.hidden = true;
      gate.innerHTML =
        '<div class="tasks-gate-card">' +
          '<span class="tasks-gate-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2.4"/><path d="M8 10V7.6a4 4 0 0 1 8 0V10"/></svg>' +
          "</span>" +
          "<h3>" + esc(I("tasks.gate.title")) + "</h3>" +
          "<p>" + esc(I("tasks.gate.desc")) + "</p>" +
          '<button type="button" class="btn btn-primary btn-sm" id="tasks-login">' + esc(I("tasks.gate.btn")) + "</button>" +
        "</div>";
      var btn = $("#tasks-login");
      if (btn) btn.addEventListener("click", function () {
        if (window.CRAFT_AUTH) window.CRAFT_AUTH.openLogin();
      });
      return;
    }
    if (mine > 0 && mine < need) {
      gate.hidden = false;
      app.hidden = true;
      gate.innerHTML =
        '<div class="tasks-gate-card">' +
          '<span class="tasks-gate-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 20 7v5.4c0 4.3-3.4 7.2-8 8.1-4.6-.9-8-3.8-8-8.1V7z"/><path d="M9 12.2l2.1 2.1 4-4"/></svg>' +
          "</span>" +
          "<h3>" + esc(I("tasks.grade.title", { grade: gradeName(need) })) + "</h3>" +
          "<p>" + esc(I("tasks.grade.desc", { mine: gradeName(mine) })) + "</p>" +
        "</div>";
      return;
    }
    gate.hidden = true;
    app.hidden = false;
  }

  /* ---------------- 목록 ---------------- */
  function load() {
    if (!signedIn()) { paintGate(); return Promise.resolve(); }
    var app = $("#tasks-app");
    if (!app) return Promise.resolve();
    state.loading = true;
    var list = $("#task-board");
    if (list && !state.rows.length) list.innerHTML = '<p class="panel-msg">' + esc(I("tasks.loading")) + "</p>";
    return request("tasks?select=*&order=due_date.asc,created_at.desc&limit=500").then(function (r) {
      state.loading = false;
      if (!r.ok) {
        state.rows = [];
        state.error = String((r.data && r.data.message) || r.text || ("HTTP " + r.status));
        paintBoard();
        var msg = $("#tasks-msg");
        if (msg) {
          msg.textContent = (r.status === 401 || r.status === 403)
            ? I("tasks.login.needed")
            : I("tasks.load.fail");
          msg.className = "tasks-msg err";
        }
        return;
      }
      state.error = "";
      state.rows = Array.isArray(r.data) ? r.data : [];
      paintBoard();
      paintCounts();
    });
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return state.rows.filter(function (t) {
      if (state.filter !== "all" && t.status !== state.filter) return false;
      if (!q) return true;
      return [t.title, t.description, t.assignee, t.author_name].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }

  function taskCard(t) {
    var due = dueInfo(t.due_date);
    var mine = me();
    var isMine = mine && t.user_id === mine.id;
    var opts = STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (t.status === s ? " selected" : "") + ">" + esc(I("tasks.status." + s)) + "</option>";
    }).join("");
    return '<article class="task-card' + (t.status === "done" ? " is-done" : "") + '" data-id="' + esc(t.id) + '">' +
      '<div class="task-card-top">' +
        '<span class="prio prio-' + esc(t.priority) + '">' + esc(I("tasks.priority." + t.priority)) + "</span>" +
        (due ? '<span class="task-due' + dueClass(t.due_date) + '">' + esc(due) + "</span>" : '<span class="task-due is-none">' + esc(I("tasks.due.none")) + "</span>") +
      "</div>" +
      "<h4 class=\"task-title\">" + esc(t.title) + "</h4>" +
      (t.description ? '<p class="task-desc">' + esc(t.description) + "</p>" : "") +
      '<div class="task-meta">' +
        (t.assignee ? "<span><b>" + esc(t.assignee) + "</b></span>" : "") +
        '<span class="task-author">' + esc(I("tasks.by")) + " " + esc(t.author_name || "") + "</span>" +
      "</div>" +
      '<div class="task-foot">' +
        '<label class="task-status"><span class="sr-only">' + esc(I("tasks.move")) + "</span>" +
          '<select class="task-move" aria-label="' + esc(I("tasks.move")) + '">' + opts + "</select></label>" +
        '<span class="task-btns">' +
          '<button type="button" class="mini task-edit">' + esc(I("tasks.edit")) + "</button>" +
          '<button type="button" class="mini task-del">' + esc(I("tasks.delete")) + "</button>" +
        "</span>" +
      "</div>" +
    "</article>";
  }

  function paintBoard() {
    var board = $("#task-board");
    if (!board) return;
    var rows = visibleRows();
    var noneAtAll = state.rows.length === 0;
    board.innerHTML = STATUSES.map(function (s) {
      var list = rows.filter(function (t) { return t.status === s; });
      var empty = (noneAtAll && s === "todo") ? I("tasks.empty.all") : I("tasks.empty.col");
      return '<section class="task-col" data-status="' + s + '">' +
        '<header class="task-col-head"><h3>' + esc(I("tasks.col." + s)) + '</h3><span class="n">' + list.length + "</span></header>" +
        '<div class="task-list">' +
          (list.length ? list.map(taskCard).join("") : '<p class="task-empty">' + esc(empty) + "</p>") +
        "</div></section>";
    }).join("");
    bindCards();
  }

  function paintCounts() {
    var sum = $("#tasks-sum");
    if (sum) sum.textContent = I("tasks.total", { n: state.rows.length });
    var counts = {};
    STATUSES.forEach(function (s) {
      counts[s] = state.rows.filter(function (t) { return t.status === s; }).length;
      var el = document.querySelector('.task-col[data-status="' + s + '"] .n');
      if (el) el.textContent = String(counts[s]);
    });
    paintFilters();
  }

  function paintFilters() {
    var box = $("#tasks-filters");
    if (!box) return;
    var tabs = [{ k: "all", label: I("filter.all") }].concat(STATUSES.map(function (s) {
      return { k: s, label: I("tasks.status." + s) };
    }));
    box.innerHTML = tabs.map(function (t) {
      var n = t.k === "all" ? state.rows.length : state.rows.filter(function (x) { return x.status === t.k; }).length;
      return '<button type="button" class="fchip" data-filter="' + t.k + '" aria-pressed="' +
        (state.filter === t.k ? "true" : "false") + '">' + esc(t.label) + "<i>" + n + "</i></button>";
    }).join("");
    [].forEach.call(box.querySelectorAll("[data-filter]"), function (b) {
      b.addEventListener("click", function () {
        state.filter = b.getAttribute("data-filter");
        paintFilters();
        paintBoard();
      });
    });
    var add = $("#tasks-add");
    if (add) add.textContent = "+ " + I("tasks.add");
  }

  function bindCards() {
    var board = $("#task-board");
    if (!board) return;
    [].forEach.call(board.querySelectorAll(".task-card"), function (card) {
      var id = card.getAttribute("data-id");
      var sel = card.querySelector(".task-move");
      if (sel) sel.addEventListener("change", function () {
        setStatus(id, sel.value);
      });
      var ed = card.querySelector(".task-edit");
      if (ed) ed.addEventListener("click", function () { openForm(find(id)); });
      var del = card.querySelector(".task-del");
      if (del) del.addEventListener("click", function () { remove(id); });
    });
  }

  function find(id) {
    for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) return state.rows[i];
    return null;
  }

  function setMsg(text, kind) {
    var el = $("#tasks-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "tasks-msg" + (kind ? " " + kind : "");
  }

  /* ---------------- 쓰기 ---------------- */
  function setStatus(id, status) {
    if (!signedIn()) { setMsg(I("tasks.login.needed"), "err"); return; }
    setMsg("");
    request("tasks?id=eq." + encodeURIComponent(id), {
      method: "PATCH", prefer: "return=representation", body: { status: status }
    }).then(function (r) {
      if (!r.ok) {
        setMsg(/row-level security|permission|401|403/i.test(r.text) ? I("tasks.login.needed") : I("tasks.fail") + shortErr(r), "err");
        load();
        return;
      }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (row) {
        for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === row.id) state.rows[i] = row;
      }
      paintBoard();
      paintCounts();
      setMsg(I("tasks.saved"), "ok");
    }).catch(function () { setMsg(I("tasks.fail") + "network", "err"); });
  }

  function remove(id) {
    if (!window.confirm(I("tasks.confirm.del"))) return;
    request("tasks?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" }).then(function (r) {
      if (!r.ok) { setMsg(I("tasks.fail") + shortErr(r), "err"); return; }
      state.rows = state.rows.filter(function (t) { return t.id !== id; });
      if (state.editing && state.editing.id === id) closeForm();
      paintBoard();
      paintCounts();
      setMsg(I("tasks.deleted"), "ok");
    });
  }

  function shortErr(r) {
    var m = (r && r.data && r.data.message) || (r && r.text) || "";
    return String(m).slice(0, 160);
  }

  /* ---------------- 입력 폼 ---------------- */
  function openForm(task) {
    var form = $("#tasks-form");
    if (!form) return;
    state.editing = task || null;
    $("#tasks-form-title").textContent = I(task ? "tasks.form.edit" : "tasks.form.new");
    $("#task-title").value = task ? task.title : "";
    $("#task-desc").value = task ? (task.description || "") : "";
    $("#task-status").value = task ? task.status : "todo";
    $("#task-priority").value = task ? task.priority : "normal";
    $("#task-due").value = task && task.due_date ? String(task.due_date).slice(0, 10) : "";
    $("#task-assignee").value = task ? (task.assignee || "") : "";
    $("#tasks-form-del").hidden = !task;
    form.hidden = false;
    setMsg("");
    setTimeout(function () { var f = $("#task-title"); if (f) f.focus(); }, 30);
  }
  function closeForm() {
    var form = $("#tasks-form");
    if (form) form.hidden = true;
    state.editing = null;
  }

  function saveForm(e) {
    if (e) e.preventDefault();
    var title = ($("#task-title").value || "").trim();
    if (!title) { setMsg(I("tasks.field.title"), "err"); $("#task-title").focus(); return; }
    var body = {
      title: title,
      description: ($("#task-desc").value || "").trim() || null,
      status: $("#task-status").value,
      priority: $("#task-priority").value,
      due_date: $("#task-due").value || null,
      assignee: ($("#task-assignee").value || "").trim() || null
    };
    var btn = $("#tasks-form-save");
    if (btn) { btn.disabled = true; btn.textContent = I("tasks.save") + "…"; }
    var req = state.editing
      ? request("tasks?id=eq." + encodeURIComponent(state.editing.id), { method: "PATCH", prefer: "return=representation", body: body })
      : request("tasks", { method: "POST", prefer: "return=representation", body: body });
    req.then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = I("tasks.save"); }
      if (!r.ok) {
        setMsg(/row-level security|permission|401|403/i.test(r.text) ? I("tasks.login.needed") : I("tasks.fail") + shortErr(r), "err");
        return;
      }
      closeForm();
      setMsg(I("tasks.saved"), "ok");
      load();
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = I("tasks.save"); }
      setMsg(I("tasks.fail") + "network", "err");
    });
  }

  /* ---------------- 화면 뼈대 ---------------- */
  function build() {
    var app = $("#tasks-app");
    if (!app || app.getAttribute("data-built") === "1") return;
    app.setAttribute("data-built", "1");
    app.innerHTML =
      '<div class="tasks-bar">' +
        '<div class="tasks-filters" id="tasks-filters" role="group"></div>' +
        '<div class="tasks-search"><label class="search">' +
          '<svg width="16" height="16" aria-hidden="true"><use href="#i-search"/></svg>' +
          '<input type="search" id="tasks-q" data-i18n-ph="search.tasks" autocomplete="off">' +
        "</label></div>" +
        '<button type="button" class="btn btn-primary btn-sm" id="tasks-add"></button>' +
      "</div>" +
      '<form class="tasks-form" id="tasks-form" hidden novalidate>' +
        '<div class="tasks-form-head"><h3 id="tasks-form-title"></h3>' +
          '<button type="button" class="tasks-x" id="tasks-form-x" aria-label="close">×</button></div>' +
        '<div class="tasks-form-grid">' +
          '<label class="cms-field tasks-f-wide" style="display:flex;flex-direction:column;gap:6px">' +
            '<span data-i18n="tasks.field.title"></span>' +
            '<input id="task-title" maxlength="200" data-i18n-ph="tasks.ph.title"></label>' +
          '<label class="tasks-f"><span data-i18n="tasks.field.status"></span>' +
            '<select id="task-status">' +
              '<option value="todo" data-i18n="tasks.status.todo"></option>' +
              '<option value="doing" data-i18n="tasks.status.doing"></option>' +
              '<option value="done" data-i18n="tasks.status.done"></option>' +
            "</select></label>" +
          '<label class="tasks-f"><span data-i18n="tasks.field.priority"></span>' +
            '<select id="task-priority">' +
              '<option value="low" data-i18n="tasks.priority.low"></option>' +
              '<option value="normal" data-i18n="tasks.priority.normal"></option>' +
              '<option value="high" data-i18n="tasks.priority.high"></option>' +
            "</select></label>" +
          '<label class="tasks-f"><span data-i18n="tasks.field.due"></span>' +
            '<input id="task-due" type="date"></label>' +
          '<label class="tasks-f"><span data-i18n="tasks.field.assignee"></span>' +
            '<input id="task-assignee" maxlength="60" data-i18n-ph="tasks.ph.assignee"></label>' +
          '<label class="tasks-f tasks-f-wide"><span data-i18n="tasks.field.desc"></span>' +
            '<textarea id="task-desc" rows="2" data-i18n-ph="tasks.ph.desc"></textarea></label>' +
        "</div>" +
        '<div class="tasks-form-foot">' +
          '<button type="button" class="mini danger" id="tasks-form-del" hidden data-i18n="tasks.delete"></button>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="tasks-form-cancel" data-i18n="tasks.cancel"></button>' +
          '<button type="submit" class="btn btn-primary btn-sm" id="tasks-form-save" data-i18n="tasks.save"></button>' +
        "</div>" +
      "</form>" +
      '<p class="tasks-msg" id="tasks-msg" role="status" aria-live="polite"></p>' +
      '<div class="task-board" id="task-board"></div>';

    $("#tasks-add").addEventListener("click", function () { openForm(null); });
    $("#tasks-form").addEventListener("submit", saveForm);
    $("#tasks-form-cancel").addEventListener("click", closeForm);
    $("#tasks-form-x").addEventListener("click", closeForm);
    $("#tasks-form-del").addEventListener("click", function () {
      if (state.editing) remove(state.editing.id);
    });
    var q = $("#tasks-q");
    if (q) q.addEventListener("input", function () {
      state.q = q.value;
      paintBoard();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#tasks-form").hidden) closeForm();
    });
    if (window.CRAFT_I18N) window.CRAFT_I18N.apply(app);
  }

  /* ==================================================================
     SBPress v4.1 — 레드마인형 업무관리 (projects · issues · 간트 · 캘린더 · 결재 연동)
     ================================================================== */
  var RM = {
    mode: null, built: false, booted: false, loading: false, missing: false, probing: false,
    projects: [], project: null, members: [], people: [], org: [], showArchived: false,
    issues: [], comments: {}, relations: {}, approvals: {}, checklist: {},
    view: "list", q: "", fAssignee: "", fStatus: "", fPriority: "", fFrom: "", fTo: "",
    cal: "", sel: {}, detail: null, projEditing: null, error: ""
  };
  var RM_TRACKERS = ["task", "bug", "feature", "support"];
  var RM_PRIOS = ["low", "normal", "high", "urgent"];
  var RM_STATUSES = ["new", "in_progress", "resolved", "feedback", "closed", "hold"];
  var RM_ROLES = ["manager", "member", "viewer"];
  var RM_DAY = 24;   // 간트 하루 폭(px)

  function rmI(k, v) { return I("rm." + k, v); }
  function rmProbe() {
    return request("projects?select=id&limit=1").then(function (r) {
      RM.missing = !r.ok && (r.status === 404 || r.status === 400);
      return r.ok;
    }).catch(function () { RM.missing = true; return false; });
  }
  function rmMe() { return myId(); }
  function rmName(id) {
    for (var i = 0; i < RM.people.length; i++) if (RM.people[i].id === id) return RM.people[i].name || "";
    return "";
  }
  function rmProject() {
    if (!RM.project) return null;
    for (var i = 0; i < RM.projects.length; i++) if (RM.projects[i].id === RM.project) return RM.projects[i];
    return null;
  }
  function rmRole() {
    if (!RM.project) return null;
    var uid = rmMe();
    var p = rmProject();
    if (p && p.owner_id === uid) return "manager";
    for (var i = 0; i < RM.members.length; i++) {
      var m = RM.members[i];
      if (m.project_id === RM.project && m.user_id === uid) return m.role || "member";
    }
    return null;
  }
  function rmIsAdminTask() { return !!state.rmAdmin; }
  function rmCanEdit() {
    var r = rmRole();
    return (r === "manager") || rmIsAdminTask();
  }
  function rmCanWrite() {
    var r = rmRole();
    return r === "manager" || r === "member" || rmIsAdminTask();
  }
  function rmCanEditIssue(it) {
    if (rmCanEdit()) return true;
    if (rmRole() !== "member") return false;
    var uid = rmMe();
    return it && (it.assignee_id === uid || it.author_id === uid);
  }

  /* ------- v10.12 — 담당 고르기: 프로젝트 멤버 · 조직도 · 전체 회원 ------- */
  function rmIsMember(uid) {
    if (!uid) return false;
    for (var i = 0; i < RM.members.length; i++) if (RM.members[i].user_id === uid) return true;
    return false;
  }
  function rmAssigneeGroups() {
    var seen = {}, groups = [];
    function push(label, rows) {
      var items = [];
      rows.forEach(function (r) {
        if (!r || !r.id || seen[r.id]) return;
        seen[r.id] = 1;
        items.push({ id: r.id, name: r.name || r.id, sub: r.sub || "" });
      });
      if (items.length) groups.push({ label: label, items: items });
    }
    push(rmI("gMember"), RM.members.map(function (m) {
      return { id: m.user_id, name: rmName(m.user_id), sub: rmI("role." + (m.role || "member")) };
    }));
    push(rmI("gOrg"), (RM.org || []).map(function (o) {
      return { id: o.user_id, name: o.name || o.email || o.user_id,
               sub: [o.dept, o.title].filter(Boolean).join(" · ") };
    }));
    push(rmI("gAll"), RM.people.map(function (p) { return { id: p.id, name: p.name || p.id }; }));
    return groups;
  }
  function rmAssigneeOptions(cur, emptyLabel) {
    var groups = rmAssigneeGroups();
    var has = false;
    var html = '<option value="">' + esc(emptyLabel || rmI("assigneeNone")) + "</option>";
    groups.forEach(function (g) {
      html += '<optgroup label="' + esc(g.label) + '">' + g.items.map(function (x) {
        if (String(cur || "") === String(x.id)) has = true;
        return '<option value="' + esc(x.id) + '"' + (String(cur || "") === String(x.id) ? " selected" : "") + ">" +
          esc(x.name) + (x.sub ? " · " + esc(x.sub) : "") + "</option>";
      }).join("") + "</optgroup>";
    });
    /* 명단에 없는 담당(프로필 없는 계정)도 그대로 보여 줍니다. */
    if (cur && !has) html += '<option value="' + esc(cur) + '" selected>' + esc(cur) + "</option>";
    return html;
  }
  /* 멤버가 아닌 담당을 고르면 프로젝트 멤버로 더해 줍니다(매니저·관리자만 가능). */
  function rmEnsureMember(projectId, uid) {
    if (!projectId || !uid || rmIsMember(uid) || !rmCanEdit()) return Promise.resolve(false);
    return request("project_members", { method: "POST", prefer: "return=representation",
      body: { project_id: projectId, user_id: uid, role: "member" } }).then(function (r) {
      if (!r.ok) return false;
      return rmLoadMembers().then(function () {
        rmFillSelects();
        rmMsg(rmI("asgAdded"), "ok");
        return true;
      });
    }).catch(function () { return false; });
  }

  function rmMsg(text, kind) {
    var el = $("#rm-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "tasks-msg" + (kind ? " " + kind : "");
  }
  function rmErr(r) {
    var m = (r && r.data && r.data.message) || (r && r.text) || "";
    return /row-level security|permission|42501|401|403/i.test(String(m)) ? rmI("noPerm") : rmI("fail") + String(m).slice(0, 160);
  }
  function ymd(d) { return d ? String(d).slice(0, 10) : ""; }
  function addDays(ymdStr, n) {
    var p = String(ymdStr).split("-");
    var t = Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000;
    var d = new Date(t);
    var z = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1) + "-" + z(d.getUTCDate());
  }
  function monthOf(ymdStr) { return String(ymdStr || todayKST()).slice(0, 7); }
  function monthShift(ym, n) {
    var p = String(ym).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1 + n, 1));
    var z = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1);
  }
  function weekStart(ymdStr) {
    var p = String(ymdStr).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var w = d.getUTCDay();  // 0=일
    return addDays(ymdStr, -((w + 6) % 7));  // 월요일 시작
  }

  /* 폼을 열 때 첫 칸에 초점을 줍니다 — 단, 사용자가 이미 다른 칸에 입력 중이면 건드리지 않습니다. */
  function rmFocusIfIdle(sel, formSel) {
    setTimeout(function () {
      var el = $(sel), form = formSel ? $(formSel) : null;
      if (!el || !form) return;
      var a = document.activeElement;
      if (a && a !== document.body && form.contains(a) && a !== el) return;
      if (a && a !== document.body && !form.contains(a)) return;
      try { el.focus(); } catch (e) { /* noop */ }
    }, 40);
  }

  /* ------- 화면 뼈대 ------- */
  function rmBuild() {
    var app = $("#tasks-app");
    if (!app) return;
    RM.built = true;
    app.setAttribute("data-built", "rm");
    app.innerHTML =
      '<div class="rm-bar">' +
        '<label class="rm-project-pick"><span class="sr-only">' + esc(rmI("project")) + "</span>" +
          '<select id="rm-project"></select></label>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-project-new">' + esc(rmI("projectNew")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-project-edit">' + esc(rmI("projectEdit")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-arch-toggle" aria-pressed="false" hidden></button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-members">' + esc(rmI("members")) + "</button>" +
        '<span class="spacer"></span>' +
        '<div class="rm-views" role="group">' +
          '<button type="button" class="fchip" data-rview="list" aria-pressed="true">' + esc(rmI("view.list")) + "</button>" +
          '<button type="button" class="fchip" data-rview="gantt" aria-pressed="false">' + esc(rmI("view.gantt")) + "</button>" +
          '<button type="button" class="fchip" data-rview="calendar" aria-pressed="false">' + esc(rmI("view.calendar")) + "</button>" +
        "</div>" +
        '<button type="button" class="btn btn-primary btn-sm" id="rm-new">+ ' + esc(rmI("new")) + "</button>" +
      "</div>" +
      '<div class="rm-notice" id="rm-notice" hidden></div>' +
      '<div class="rm-filters">' +
        '<select id="rm-f-assignee" class="rm-sel"></select>' +
        '<select id="rm-f-status" class="rm-sel"></select>' +
        '<select id="rm-f-priority" class="rm-sel"></select>' +
        '<input type="date" id="rm-f-from" class="rm-sel" aria-label="' + esc(rmI("from")) + '">' +
        '<span class="rm-tilde">~</span>' +
        '<input type="date" id="rm-f-to" class="rm-sel" aria-label="' + esc(rmI("to")) + '">' +
        '<label class="search rm-search"><svg width="15" height="15" aria-hidden="true"><use href="#i-search"/></svg>' +
          '<input type="search" id="rm-q" placeholder="' + esc(rmI("qPh")) + '" aria-label="' + esc(rmI("qPh")) + '" autocomplete="off"></label>' +
        '<span class="rm-count" id="rm-count"></span>' +
      "</div>" +
      '<div class="rm-bulk" id="rm-bulk" hidden>' +
        '<span>' + esc(rmI("selected")) + ' <b id="rm-sel-count">0</b></span>' +
        '<select id="rm-bulk-status" class="rm-sel"></select>' +
        '<select id="rm-bulk-assignee" class="rm-sel"></select>' +
        '<button type="button" class="btn btn-primary btn-sm" id="rm-bulk-apply">' + esc(rmI("apply")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-bulk-clear">' + esc(rmI("clear")) + "</button>" +
      "</div>" +
      '<p class="tasks-msg" id="rm-msg" role="status" aria-live="polite"></p>' +
      '<div class="rm-panel" id="rm-list"></div>' +
      '<div class="rm-panel" id="rm-gantt" hidden></div>' +
      '<div class="rm-panel" id="rm-calendar" hidden></div>' +
      '<div class="rm-modal" id="rm-modal" hidden role="dialog" aria-modal="true">' +
        '<div class="rm-modal-card"><div class="rm-modal-body" id="rm-detail"></div></div>' +
      "</div>" +
      '<form class="rm-form" id="rm-form" hidden novalidate>' +
        '<div class="rm-form-head"><h3 id="rm-form-title"></h3>' +
          '<button type="button" class="tasks-x" id="rm-form-x" aria-label="close">×</button></div>' +
        '<div class="rm-form-grid">' +
          '<label class="rm-f rm-f-wide"><span>' + esc(rmI("subject")) + '</span><input id="rm-subject" maxlength="200"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("tracker")) + "</span><select id=\"rm-tracker\"></select></label>" +
          '<label class="rm-f"><span>' + esc(rmI("priority")) + "</span><select id=\"rm-priority\"></select></label>" +
          '<label class="rm-f"><span>' + esc(rmI("status")) + "</span><select id=\"rm-status\"></select></label>" +
          '<label class="rm-f"><span>' + esc(rmI("assignee")) + "</span><select id=\"rm-assignee\"></select></label>" +
          '<label class="rm-f"><span>' + esc(rmI("parent")) + "</span><select id=\"rm-parent\"></select></label>" +
          '<label class="rm-f"><span>' + esc(rmI("starts")) + '</span><input type="date" id="rm-starts"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("due")) + '</span><input type="date" id="rm-due"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("estimate")) + '</span><input type="number" step="0.5" id="rm-est"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("spent")) + '</span><input type="number" step="0.5" id="rm-spent"></label>' +
          '<label class="rm-f rm-f-wide"><span>' + esc(rmI("description")) + '</span><textarea id="rm-desc" rows="3"></textarea></label>' +
        "</div>" +
        '<div class="rm-form-foot"><span class="spacer"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="rm-form-cancel">' + esc(rmI("cancel")) + "</button>" +
          '<button type="submit" class="btn btn-primary btn-sm" id="rm-form-save">' + esc(rmI("save")) + "</button>" +
        "</div>" +
      "</form>" +
      '<form class="rm-form" id="rm-project-form" hidden novalidate>' +
        '<div class="rm-form-head"><h3 id="rm-project-form-title">' + esc(rmI("projectNew")) + "</h3>" +
          '<button type="button" class="tasks-x" id="rm-project-x" aria-label="close">×</button></div>' +
        '<div class="rm-form-grid">' +
          '<label class="rm-f"><span>' + esc(rmI("key")) + '</span><input id="rm-p-key" maxlength="16" placeholder="SBP"></label>' +
          '<label class="rm-f rm-f-wide"><span>' + esc(rmI("name")) + '</span><input id="rm-p-name" maxlength="120"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("starts")) + '</span><input type="date" id="rm-p-starts"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("due")) + '</span><input type="date" id="rm-p-ends"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("projectStatus")) + '</span><select id="rm-p-status"></select></label>' +
          '<label class="rm-f rm-f-wide"><span>' + esc(rmI("description")) + '</span><textarea id="rm-p-desc" rows="2"></textarea></label>' +
        "</div>" +
        '<div class="rm-form-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm danger" id="rm-project-del" hidden>' + esc(rmI("projectDelete")) + "</button>" +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="rm-project-cancel">' + esc(rmI("cancel")) + "</button>" +
          '<button type="submit" class="btn btn-primary btn-sm" id="rm-project-save">' + esc(rmI("create")) + "</button>" +
        "</div>" +
      "</form>" +
      '<div class="rm-modal" id="rm-del-modal" hidden role="dialog" aria-modal="true">' +
        '<div class="rm-modal-card"><div class="rm-modal-body" id="rm-del-body"></div></div>' +
      "</div>" +
      '<div class="rm-modal" id="rm-members-modal" hidden role="dialog" aria-modal="true">' +
        '<div class="rm-modal-card"><div class="rm-modal-body" id="rm-members-body"></div></div>' +
      "</div>";

    $("#rm-project").addEventListener("change", function () {
      RM.project = $("#rm-project").value || null;
      RM.sel = {};
      rmLoad();
    });
    $("#rm-project-new").addEventListener("click", function () { rmOpenProjectForm(false); });
    $("#rm-project-edit").addEventListener("click", function () { rmOpenProjectForm(true); });
    $("#rm-arch-toggle").addEventListener("click", function () {
      RM.showArchived = !RM.showArchived;
      rmFillSelects();
      rmRender();
    });
    $("#rm-project-del").addEventListener("click", rmOpenProjectDelete);
    $("#rm-project-x").addEventListener("click", function () { $("#rm-project-form").hidden = true; });
    $("#rm-project-cancel").addEventListener("click", function () { $("#rm-project-form").hidden = true; });
    $("#rm-project-form").addEventListener("submit", rmSaveProject);
    $("#rm-members").addEventListener("click", rmOpenMembers);
    $("#rm-new").addEventListener("click", function () { rmOpenForm(null); });
    $("#rm-form-x").addEventListener("click", function () { $("#rm-form").hidden = true; });
    $("#rm-form-cancel").addEventListener("click", function () { $("#rm-form").hidden = true; });
    $("#rm-form").addEventListener("submit", rmSaveForm);
    [].forEach.call($$("[data-rview]"), function (b) {
      b.addEventListener("click", function () {
        RM.view = b.getAttribute("data-rview");
        [].forEach.call($$("[data-rview]"), function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        rmRender();
      });
    });
    [["#rm-f-assignee", "fAssignee"], ["#rm-f-status", "fStatus"], ["#rm-f-priority", "fPriority"],
     ["#rm-f-from", "fFrom"], ["#rm-f-to", "fTo"]].forEach(function (pair) {
      var el = $(pair[0]);
      if (el) el.addEventListener("change", function () { RM[pair[1]] = el.value; rmRender(); });
    });
    var q = $("#rm-q");
    if (q) q.addEventListener("input", function () { RM.q = q.value; rmRender(); });
    $("#rm-bulk-apply").addEventListener("click", rmbulkApply);
    $("#rm-bulk-clear").addEventListener("click", function () { RM.sel = {}; rmRender(); });
    $("#rm-modal").addEventListener("click", function (e) {
      if (e.target && e.target.id === "rm-modal") { $("#rm-modal").hidden = true; RM.detail = null; }
    });
    $("#rm-members-modal").addEventListener("click", function (e) {
      if (e.target && e.target.id === "rm-members-modal") $("#rm-members-modal").hidden = true;
    });
    $("#rm-del-modal").addEventListener("click", function (e) {
      if (e.target && e.target.id === "rm-del-modal") $("#rm-del-modal").hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#rm-modal").hidden) { $("#rm-modal").hidden = true; RM.detail = null; }
      else if (!$("#rm-members-modal").hidden) $("#rm-members-modal").hidden = true;
      else if (!$("#rm-del-modal").hidden) $("#rm-del-modal").hidden = true;
      else if (!$("#rm-form").hidden) $("#rm-form").hidden = true;
      else if (!$("#rm-project-form").hidden) $("#rm-project-form").hidden = true;
    });
  }

  function rmFillSelects() {
    var pj = $("#rm-project");
    if (pj) {
      /* 보관한 프로젝트는 기본으로 숨기고, 지금 보고 있는 프로젝트만 예외로 남깁니다. */
      var list = RM.projects.filter(function (p) {
        return RM.showArchived || p.status !== "archived" || p.id === RM.project;
      });
      pj.innerHTML = list.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.key + " · " + p.name) +
          (p.status === "archived" ? " (" + esc(rmI("archived")) + ")" : "") + "</option>";
      }).join("") || '<option value="">' + esc(rmI("noProject")) + "</option>";
      if (RM.project) pj.value = RM.project;
    }
    var at = $("#rm-arch-toggle");
    if (at) {
      var nArch = RM.projects.filter(function (p) { return p.status === "archived"; }).length;
      at.hidden = !nArch;
      at.textContent = (RM.showArchived ? rmI("hideArchived") : rmI("showArchived")) + " " + nArch;
      at.setAttribute("aria-pressed", RM.showArchived ? "true" : "false");
    }
    var opt = function (v, label) { return '<option value="' + esc(v) + '">' + esc(label) + "</option>"; };
    var fa = $("#rm-f-assignee");
    if (fa) {
      fa.innerHTML = opt("", rmI("allAssignee")) +
        RM.members.map(function (m) { return opt(m.user_id, rmName(m.user_id) || m.user_id); }).join("") +
        RM.people.filter(function (p) { return !RM.members.some(function (m) { return m.user_id === p.id; }); })
          .map(function (p) { return opt(p.id, p.name); }).join("");
      fa.value = RM.fAssignee || "";
    }
    var fs = $("#rm-f-status");
    if (fs) fs.innerHTML = opt("", rmI("allStatus")) + RM_STATUSES.map(function (s) { return opt(s, rmI("st." + s)); }).join("");
    var fp = $("#rm-f-priority");
    if (fp) fp.innerHTML = opt("", rmI("allPriority")) + RM_PRIOS.map(function (p) { return opt(p, rmI("prio." + p)); }).join("");
    var bs = $("#rm-bulk-status");
    if (bs) bs.innerHTML = RM_STATUSES.map(function (s) { return opt(s, rmI("st." + s)); }).join("");
    var ba = $("#rm-bulk-assignee");
    if (ba) ba.innerHTML = opt("", rmI("assigneeNone")) +
      RM.members.map(function (m) { return opt(m.user_id, rmName(m.user_id) || m.user_id); }).join("") +
      RM.people.filter(function (p) { return !rmIsMember(p.id); })
        .map(function (p) { return opt(p.id, p.name || p.id); }).join("");
  }

  /* ------- 읽기 ------- */
  function rmLoadProjects() {
    return request("projects?select=*&order=created_at.asc").then(function (r) {
      if (!r.ok) { RM.missing = true; return r; }
      RM.projects = Array.isArray(r.data) ? r.data : [];
      if (!RM.project || !RM.projects.some(function (p) { return p.id === RM.project; })) {
        var firstOpen = RM.projects.filter(function (p) { return p.status !== "archived"; })[0];
        RM.project = firstOpen ? firstOpen.id : (RM.projects[0] ? RM.projects[0].id : null);
      }
      return r;
    });
  }
  function rmLoadMembers() {
    if (!RM.project) { RM.members = []; return Promise.resolve(); }
    return request("project_members?select=*&project_id=eq." + encodeURIComponent(RM.project)).then(function (r) {
      RM.members = (r.ok && Array.isArray(r.data)) ? r.data : [];
      return r;
    });
  }
  /* 조직도(org_roles) — v10.1 표가 없으면 비워 둡니다(담당 고르기는 전체 회원으로 계속 동작). */
  function rmLoadOrg() {
    /* active 여과는 화면에서 합니다(모의 서버·구버전 표와 무관하게 같은 결과). */
    return request("org_roles?select=user_id,name,dept,title,active&order=sort_order.asc").then(function (r) {
      RM.org = (r.ok && Array.isArray(r.data)) ? r.data.filter(function (o) {
        return !!(o && o.user_id) && o.active !== false;
      }) : [];
      return r;
    }).catch(function () { RM.org = []; });
  }
  function rmLoadIssues() {
    if (!RM.project) { RM.issues = []; return Promise.resolve(); }
    return request("issues?select=*&project_id=eq." + encodeURIComponent(RM.project) +
                   "&order=issue_no.asc&limit=500").then(function (r) {
      if (!r.ok) {
        RM.issues = [];
        if (r.status === 404 || r.status === 400) RM.missing = true;
        rmMsg(rmErr(r), "err");
        return r;
      }
      RM.issues = Array.isArray(r.data) ? r.data : [];
      return r;
    });
  }
  function rp() { return rpc("approval_people"); }
  function rmIsAdminNow() {
    return rpc("is_admin").catch(function () { return { ok: false, data: false }; });
  }

  function rmLoad() {
    if (!signedIn()) return Promise.resolve();
    RM.loading = true;
    rmMsg("");
    return Promise.all([rp(), rmLoadMembers(), rmLoadOrg(), rmIsAdminNow()]).then(function (res) {
      var r = res[0];
      RM.people = (r.ok && Array.isArray(r.data)) ? r.data : [];
      /* v10.12 — 관리자 여부를 기다린 뒤에 그립니다(권한 버튼이 잠깐 숨는 경합 제거). */
      state.rmAdmin = !!(res[3] && res[3].ok && res[3].data === true);
      return rmLoadIssues();
    }).then(function () {
      RM.loading = false;
      rmFillSelects();
      rmRender();
    });
  }

  function rmShow() {
    rmBuild();
    return Promise.all([rp()]).then(function () {
      return rmLoadProjects();
    }).then(function () {
      rmFillSelects();
      if (RM.missing) {
        var n = $("#rm-notice");
        if (n) {
          n.hidden = false;
          n.innerHTML = "<strong>" + esc(rmI("missing.title")) + "</strong><span>" + esc(rmI("missing.desc")) +
            "</span><code>supabase/16_v41_approvals_redmine.sql</code>";
        }
      }
      return rmLoad();
    }).then(function () {
      var m = /issue=([^&]+)/.exec(String(location.hash || ""));
      if (m && RM.issues.some(function (x) { return x.id === decodeURIComponent(m[1]); })) {
        rmOpenIssue(decodeURIComponent(m[1]));
      }
    });
  }

  function rmVisible() {
    var q = RM.q.trim().toLowerCase();
    return RM.issues.filter(function (it) {
      if (RM.fAssignee && it.assignee_id !== RM.fAssignee) return false;
      if (RM.fStatus && it.status !== RM.fStatus) return false;
      if (RM.fPriority && it.priority !== RM.fPriority) return false;
      if (RM.fFrom && (!it.due_on || ymd(it.due_on) < RM.fFrom)) return false;
      if (RM.fTo && (!it.starts_on || ymd(it.starts_on) > RM.fTo)) return false;
      if (q) {
        var hay = ["#" + it.issue_no, it.subject, it.description, rmName(it.assignee_id)].join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function rmChildren(parentId) {
    return RM.issues.filter(function (i) { return i.parent_id === parentId; })
      .sort(function (a, b) { return (a.issue_no || 0) - (b.issue_no || 0); });
  }
  function rmTree(rows) {
    var byId = {};
    rows.forEach(function (i) { byId[i.id] = i; });
    var out = [];
    function depthOf(it, guard) {
      var d = 0, p = it.parent_id;
      while (p && byId[p] && d < 4 && !guard[p]) { d++; p = byId[p].parent_id; }
      return d;
    }
    function push(it, depth) {
      out.push({ it: it, depth: depth });
      rmChildren(it.id).forEach(function (c) {
        if (rows.some(function (r) { return r.id === c.id; })) push(c, Math.min(depth + 1, 3));
      });
    }
    rows.filter(function (i) { return !i.parent_id || !byId[i.parent_id]; })
      .sort(function (a, b) { return (a.issue_no || 0) - (b.issue_no || 0); })
      .forEach(function (i) { push(i, 0); });
    rows.forEach(function (i) {
      if (!out.some(function (o) { return o.it.id === i.id; })) out.push({ it: i, depth: Math.min(depthOf(i, {}), 3) });
    });
    return out;
  }

  function rmPill(kind, v) {
    return '<span class="rm-pill is-' + esc(kind) + "-" + esc(v) + '">' + esc(rmI(kind + "." + v)) + "</span>";
  }

  function rmProgOptions(cur) {
    var steps = [0, 25, 50, 75, 100];
    cur = Number(cur) || 0;
    if (steps.indexOf(cur) < 0) steps.push(cur);
    steps.sort(function (a, b) { return a - b; });
    return steps.map(function (n) {
      return '<option value="' + n + '"' + (n === cur ? " selected" : "") + ">" + n + "%</option>";
    }).join("");
  }

  function rmRow(it, depth) {
    var selected = !!RM.sel[it.id];
    var late = it.due_on && ymd(it.due_on) < todayKST() && !["closed", "resolved"].includes(it.status);
    var canEdit = rmCanEditIssue(it);
    /* v10.12 — 목록에서 바로 상태·진행률을 바꿉니다(권한이 있으면 고르는 칸, 없으면 배지·막대). */
    var stCell = canEdit
      ? '<select class="rm-st-in" data-id="' + esc(it.id) + '" aria-label="' + esc(rmI("status")) + '">' +
          RM_STATUSES.map(function (s) {
            return '<option value="' + s + '"' + (it.status === s ? " selected" : "") + ">" + esc(rmI("st." + s)) + "</option>";
          }).join("") + "</select>"
      : rmPill("st", it.status);
    var progCell = canEdit
      ? '<select class="rm-prog-in" data-id="' + esc(it.id) + '" aria-label="' + esc(rmI("progress")) + '">' +
          rmProgOptions(it.progress) + "</select>"
      : '<span class="rm-prog"><i style="width:' + (Number(it.progress) || 0) + '%"></i></span>';
    return '<div class="rm-row' + (selected ? " is-sel" : "") + (late ? " is-late" : "") + '" data-id="' + esc(it.id) + '"' +
      ' style="--depth:' + (depth || 0) + '" tabindex="0">' +
      '<label class="rm-check"><input type="checkbox" class="rm-sel-box"' + (selected ? " checked" : "") + ' ' +
        (rmCanWrite() ? "" : "disabled ") + 'aria-label="' + esc(rmI("selectIssue")) + '"></label>' +
      '<span class="rm-no">#' + esc(it.issue_no) + "</span>" +
      '<span class="rm-twisty' + (rmChildren(it.id).length ? " has-kids" : "") + '">' + (depth ? "↳" : "") + "</span>" +
      '<span class="rm-subject">' + esc(it.subject) + "</span>" +
      rmPill("tracker", it.tracker) + rmPill("prio", it.priority) + stCell + progCell +
      '<span class="rm-assignee">' + esc(rmName(it.assignee_id) || "—") + "</span>" +
      '<span class="rm-due' + (late ? " is-late" : "") + '">' + esc(ymd(it.due_on) || "—") + "</span>" +
      "</div>";
  }

  function rmRender() {
    var list = $("#rm-list"), gantt = $("#rm-gantt"), cal = $("#rm-calendar");
    if (!list) return;
    list.hidden = RM.view !== "list";
    if (gantt) gantt.hidden = RM.view !== "gantt";
    if (cal) cal.hidden = RM.view !== "calendar";
    var rows = rmVisible();
    var cnt = $("#rm-count");
    if (cnt) cnt.textContent = rmI("count", { n: rows.length, total: RM.issues.length });
    if (!RM.project) {
      list.innerHTML = '<p class="rm-empty">' + esc(rmI("empty.project")) + "</p>";
      if (gantt) gantt.innerHTML = "";
      if (cal) cal.innerHTML = "";
      return;
    }
    if (RM.view === "list") {
      list.innerHTML = rows.length ? rmTree(rows).map(function (x) { return rmRow(x.it, x.depth); }).join("")
        : '<p class="rm-empty">' + esc(rmI("empty.issues")) + "</p>";
      rmBindRows();
    } else if (RM.view === "gantt") {
      rmGantt(rows);
    } else {
      rmCalendar(rows);
    }
    var bulk = $("#rm-bulk");
    var n = Object.keys(RM.sel).filter(function (k) { return RM.sel[k]; }).length;
    if (bulk) bulk.hidden = !n;
    var sc = $("#rm-sel-count");
    if (sc) sc.textContent = String(n);
    var nb = $("#rm-new");
    if (nb) nb.hidden = !rmCanWrite();
    var mb = $("#rm-members");
    if (mb) mb.hidden = !rmCanEdit();
    var pn = $("#rm-project-new");
    if (pn) pn.hidden = !(rmIsAdminTask() || ((window.CRAFT_AUTH && window.CRAFT_AUTH.profile && window.CRAFT_AUTH.profile() || {}).member_grade >= 2));
    var pe = $("#rm-project-edit");
    if (pe) pe.hidden = !rmCanEdit();
  }

  function rmBindRows() {
    [].forEach.call($$("#rm-list .rm-row"), function (row) {
      var id = row.getAttribute("data-id");
      row.addEventListener("click", function (e) {
        if (e.target && e.target.closest(".rm-check,select,input,button")) return;
        rmOpenIssue(id);
      });
      row.addEventListener("keydown", function (e) {
        if (e.target && e.target.closest("select,input,button")) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rmOpenIssue(id); }
      });
      var st = row.querySelector(".rm-st-in");
      if (st) {
        st.addEventListener("click", function (e) { e.stopPropagation(); });
        st.addEventListener("change", function () { rmInlinePatch(id, { status: st.value }); });
      }
      var pg = row.querySelector(".rm-prog-in");
      if (pg) {
        pg.addEventListener("click", function (e) { e.stopPropagation(); });
        pg.addEventListener("change", function () { rmInlinePatch(id, { progress: Number(pg.value) || 0 }); });
      }
      var box = row.querySelector(".rm-sel-box");
      if (box) box.addEventListener("change", function () {
        RM.sel[id] = box.checked;
        row.classList.toggle("is-sel", box.checked);
        var n = Object.keys(RM.sel).filter(function (k) { return RM.sel[k]; }).length;
        var bulk = $("#rm-bulk");
        if (bulk) bulk.hidden = !n;
        var sc = $("#rm-sel-count");
        if (sc) sc.textContent = String(n);
      });
    });
  }

  /* v10.12 — 목록 인라인 변경(상태·진행률). 완료로 바꾸면 진행률 100, 100%면 해결로 올립니다. */
  function rmInlinePatch(id, patch) {
    var it = rmFind(id);
    if (!it) return;
    if (patch.status === "closed") patch.progress = 100;
    if (patch.progress != null && patch.progress >= 100 && !patch.status &&
        ["new", "in_progress"].indexOf(it.status) >= 0) patch.status = "resolved";
    request("issues?id=eq." + encodeURIComponent(id), {
      method: "PATCH", prefer: "return=representation", body: patch
    }).then(function (r) {
      if (!r.ok) { rmMsg(rmErr(r), "err"); rmRender(); return; }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (row) for (var i = 0; i < RM.issues.length; i++) if (RM.issues[i].id === row.id) RM.issues[i] = row;
      rmMsg(rmI("saved"), "ok");
      rmRender();
    }).catch(function () { rmMsg(rmI("fail"), "err"); rmRender(); });
  }

  /* ------- 간트차트 (외부 라이브러리 0) ------- */
  function rmGantt(rows) {
    var box = $("#rm-gantt");
    if (!box) return;
    var dated = rows.filter(function (i) { return i.starts_on || i.due_on; });
    if (!dated.length) {
      box.innerHTML = '<p class="rm-empty">' + esc(rmI("empty.gantt")) + "</p>";
      return;
    }
    var min = null, max = null;
    dated.forEach(function (i) {
      var s = ymd(i.starts_on) || ymd(i.due_on), e = ymd(i.due_on) || ymd(i.starts_on);
      if (!min || s < min) min = s;
      if (!max || e > max) max = e;
    });
    var today = todayKST();
    if (today < min) min = today;
    if (today > max) max = today;
    min = weekStart(min);
    var days = Math.max(14, Math.round((dayNumber(max) - dayNumber(min)) + 1));
    days = Math.ceil(days / 7) * 7;
    var width = days * RM_DAY;
    var weeks = Math.ceil(days / 7);

    var months = [];
    for (var k = 0; k < days; k += 7) {
      var d = addDays(min, k);
      var label = d.slice(0, 7);
      if (!months.length || months[months.length - 1].label !== label) {
        months.push({ label: label, days: 7 });
      } else {
        months[months.length - 1].days += 7;
      }
    }

    var html = '<div class="rm-gantt">' +
      '<div class="rm-gantt-head">' +
        '<div class="rm-gantt-name">' + esc(rmI("issue")) + "</div>" +
        '<div class="rm-gantt-scale" style="width:' + width + 'px">' +
          '<div class="rm-gantt-months">' + months.map(function (m) {
            return '<span style="width:' + (m.days * RM_DAY) + 'px">' + esc(m.label) + "</span>";
          }).join("") + "</div>" +
          '<div class="rm-gantt-weeks">' + Array.apply(null, { length: weeks }).map(function (_, w) {
            return '<span style="width:' + (7 * RM_DAY) + 'px">' + esc(rmI("week", { n: w + 1 })) + "</span>";
          }).join("") + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="rm-gantt-body">' + dated.map(function (it) {
        var s = ymd(it.starts_on) || ymd(it.due_on);
        var e = ymd(it.due_on) || ymd(it.starts_on);
        if (e < s) { var t = s; s = e; e = t; }
        var left = (dayNumber(s) - dayNumber(min)) * RM_DAY;
        var w = Math.max(RM_DAY, (dayNumber(e) - dayNumber(s) + 1) * RM_DAY);
        var late = e < today && !["closed", "resolved"].includes(it.status);
        return '<div class="rm-gantt-row" data-id="' + esc(it.id) + '">' +
          '<div class="rm-gantt-name"><span class="rm-no">#' + esc(it.issue_no) + "</span> " +
            '<span class="rm-gantt-subject">' + esc(it.subject) + "</span></div>" +
          '<div class="rm-gantt-track" style="width:' + width + 'px">' +
            '<div class="rm-gantt-bar' + (late ? " is-late" : "") + '" data-id="' + esc(it.id) + '"' +
              ' data-starts="' + esc(s) + '" data-due="' + esc(e) + '"' +
              ' style="left:' + left + 'px;width:' + w + 'px" tabindex="0"' +
              (rmCanEditIssue(it) ? "" : ' aria-readonly="true"') + ">" +
              '<span class="rm-gantt-grip is-start"></span>' +
              '<span class="rm-gantt-label">' + esc(it.subject) + "</span>" +
              '<span class="rm-gantt-grip is-end"></span>' +
            "</div>" +
          "</div></div>";
      }).join("") + "</div>" +
      '<div class="rm-gantt-today" style="left:calc(var(--name-w) + ' +
        ((dayNumber(today) - dayNumber(min)) * RM_DAY) + 'px)"></div>' +
      "</div>";
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll(".rm-gantt-row"), function (row) {
      var name = row.querySelector(".rm-gantt-name");
      if (name) name.addEventListener("click", function () { rmOpenIssue(row.getAttribute("data-id")); });
    });
    [].forEach.call(box.querySelectorAll(".rm-gantt-bar"), function (bar) {
      rmBindDrag(bar, min);
    });
  }

  function rmBindDrag(bar, min) {
    var canEdit = bar.getAttribute("aria-readonly") !== "true";
    bar.addEventListener("pointerdown", function (e) {
      if (!canEdit) return;
      var rect = bar.getBoundingClientRect();
      var mode = "move";
      if (e.clientX - rect.left < 8) mode = "start";
      else if (rect.right - e.clientX < 8) mode = "end";
      var s0 = bar.getAttribute("data-starts"), d0 = bar.getAttribute("data-due");
      var x0 = e.clientX, moved = 0;
      bar.setPointerCapture && bar.setPointerCapture(e.pointerId);
      bar.classList.add("is-drag");
      function move(ev) {
        var delta = Math.round((ev.clientX - x0) / RM_DAY);
        if (delta === moved) return;
        moved = delta;
        var s = s0, d = d0;
        if (mode === "move") { s = addDays(s0, delta); d = addDays(d0, delta); }
        else if (mode === "start") { s = addDays(s0, delta); if (s > d) s = d; }
        else { d = addDays(d0, delta); if (d < s) d = s; }
        var left = (dayNumber(s) - dayNumber(min)) * RM_DAY;
        var w = Math.max(RM_DAY, (dayNumber(d) - dayNumber(s) + 1) * RM_DAY);
        bar.style.left = left + "px";
        bar.style.width = w + "px";
        bar.setAttribute("data-preview-starts", s);
        bar.setAttribute("data-preview-due", d);
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        bar.classList.remove("is-drag");
        var s = bar.getAttribute("data-preview-starts") || s0;
        var d = bar.getAttribute("data-preview-due") || d0;
        if (s === s0 && d === d0) return;
        var id = bar.getAttribute("data-id");
        request("issues?id=eq." + encodeURIComponent(id), {
          method: "PATCH", prefer: "return=representation", body: { starts_on: s, due_on: d }
        }).then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); rmLoad(); return; }
          var row = Array.isArray(r.data) ? r.data[0] : r.data;
          if (row) {
            for (var i = 0; i < RM.issues.length; i++) if (RM.issues[i].id === row.id) RM.issues[i] = row;
          }
          rmMsg(rmI("moved", { no: "#" + (bar.closest(".rm-gantt-row").querySelector(".rm-no").textContent || "").replace("#", ""), s: s, d: d }), "ok");
          rmRender();
        }).catch(function () { rmMsg(rmI("fail"), "err"); });
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      e.preventDefault();
    });
    bar.addEventListener("keydown", function (e) {
      if (!canEdit) return;
      var delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!delta) return;
      e.preventDefault();
      var s = addDays(bar.getAttribute("data-starts"), delta);
      var d = addDays(bar.getAttribute("data-due"), delta);
      request("issues?id=eq." + encodeURIComponent(bar.getAttribute("data-id")), {
        method: "PATCH", prefer: "return=representation", body: { starts_on: s, due_on: d }
      }).then(function () { rmLoad(); });
    });
  }

  /* ------- 캘린더 (due_on 월간) ------- */
  function rmCalendar(rows) {
    var box = $("#rm-calendar");
    if (!box) return;
    if (!RM.cal) RM.cal = monthOf(todayKST());
    var first = RM.cal + "-01";
    var start = weekStart(first);
    var cells = 42;
    var today = todayKST();
    var html = '<div class="rm-cal-head">' +
      '<button type="button" class="btn btn-ghost btn-sm" id="rm-cal-prev">‹</button>' +
      "<h3>" + esc(RM.cal.replace("-", ". ")) + "</h3>" +
      '<button type="button" class="btn btn-ghost btn-sm" id="rm-cal-next">›</button>' +
      '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-sm" id="rm-cal-today">' + esc(rmI("today")) + "</button></div>" +
      '<div class="rm-cal-grid">' +
      [1, 2, 3, 4, 5, 6, 0].map(function (w) { return '<div class="rm-cal-w">' + esc(rmI("dow." + w)) + "</div>"; }).join("") +
      Array.apply(null, { length: cells }).map(function (_, n) {
        var day = addDays(start, n);
        var inMonth = day.slice(0, 7) === RM.cal;
        var items = rows.filter(function (i) { return ymd(i.due_on) === day; });
        return '<div class="rm-cal-cell' + (inMonth ? "" : " is-out") + (day === today ? " is-today" : "") + '" data-day="' + day + '">' +
          '<span class="rm-cal-num">' + esc(day.slice(8)) + "</span>" +
          items.map(function (i) {
            return '<button type="button" class="rm-cal-item is-' + esc(i.priority) + '" data-id="' + esc(i.id) + '">' +
              "#" + esc(i.issue_no) + " " + esc(i.subject) + "</button>";
          }).join("") +
          "</div>";
      }).join("") + "</div>";
    box.innerHTML = html;
    $("#rm-cal-prev").addEventListener("click", function () { RM.cal = monthShift(RM.cal, -1); rmRender(); });
    $("#rm-cal-next").addEventListener("click", function () { RM.cal = monthShift(RM.cal, 1); rmRender(); });
    $("#rm-cal-today").addEventListener("click", function () { RM.cal = monthOf(todayKST()); rmRender(); });
    [].forEach.call(box.querySelectorAll(".rm-cal-item"), function (b) {
      b.addEventListener("click", function () { rmOpenIssue(b.getAttribute("data-id")); });
    });
  }

  /* ------- 일감 상세 ------- */
  function rmFind(id) {
    for (var i = 0; i < RM.issues.length; i++) if (RM.issues[i].id === id) return RM.issues[i];
    return null;
  }
  function rmOpenIssue(id) {
    var it = rmFind(id);
    if (!it) return;
    RM.detail = it;
    var modal = $("#rm-modal");
    if (!modal) return;
    modal.hidden = false;
    var body = $("#rm-detail");
    body.innerHTML = '<p class="rm-empty">' + esc(rmI("loading")) + "</p>";
    /* v10.12 — 댓글·관계·결재·확인목록을 한꾸번에 받아 상세를 그립니다. */
    return Promise.all([
      request("issue_comments?select=*&issue_id=eq." + encodeURIComponent(id) + "&order=created_at.asc"),
      request("issue_relations?select=*&or=(from_id.eq." + encodeURIComponent(id) +
              ",to_id.eq." + encodeURIComponent(id) + ")"),
      request("issue_approvals?select=*&issue_id=eq." + encodeURIComponent(id)),
      request("issue_checklist?select=*&issue_id=eq." + encodeURIComponent(id) + "&order=sort_order.asc")
    ]).then(function (res) {
      RM.comments[id] = (res[0].ok && Array.isArray(res[0].data)) ? res[0].data : [];
      RM.relations[id] = (res[1].ok && Array.isArray(res[1].data)) ? res[1].data : [];
      RM.checklist[id] = (res[3].ok && Array.isArray(res[3].data)) ? res[3].data : [];
      var links = (res[2].ok && Array.isArray(res[2].data)) ? res[2].data : [];
      RM.approvals[id] = links;
      var ids = links.map(function (l) { return l.doc_id; });
      if (!ids.length) return { ok: true, data: [] };
      return request("approval_docs?select=id,doc_no,title,status&id=in.(" + ids.map(encodeURIComponent).join(",") + ")");
    }).then(function (rd) {
      var docs = (rd && rd.ok && Array.isArray(rd.data)) ? rd.data : [];
      rmPaintDetail(it, docs);
    }).catch(function () { rmPaintDetail(it, []); });
  }

  function rmPaintDetail(it, docs) {
    var body = $("#rm-detail");
    if (!body) return;
    var canEdit = rmCanEditIssue(it);
    var editable = canEdit ? "" : " disabled";
    var sel = function (options, cur, id, disabled) {
      return '<select id="' + id + '"' + (disabled ? " disabled" : "") + ">" + options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(cur || "") === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
      }).join("") + "</select>";
    };
    var approved = docs.some(function (d) { return d.status === "approved"; });
    var pendingDoc = docs.some(function (d) { return d.status === "pending"; });
    var kids = rmChildren(it.id);
    var rels = RM.relations[it.id] || [];
    var cms = RM.comments[it.id] || [];
    var targets = RM.issues.filter(function (x) { return x.id !== it.id; });
    body.innerHTML =
      '<div class="rm-d-head">' +
        '<div><span class="rm-no">#' + esc(it.issue_no) + "</span> " +
        rmPill("tracker", it.tracker) + rmPill("prio", it.priority) + rmPill("st", it.status) +
        (approved ? '<span class="rm-badge is-ok">' + esc(rmI("approved")) + "</span>"
                  : pendingDoc ? '<span class="rm-badge is-wait">' + esc(rmI("approving")) + "</span>" : "") +
        "</div>" +
        '<button type="button" class="tasks-x" id="rm-d-close" aria-label="close">×</button>' +
      "</div>" +
      "<h2>" + esc(it.subject) + "</h2>" +
      '<div class="rm-d-grid">' +
        '<label class="rm-f"><span>' + esc(rmI("status")) + "</span>" +
          sel(RM_STATUSES.map(function (s) { return [s, rmI("st." + s)]; }), it.status, "rm-d-status", !canEdit) + "</label>" +
        '<label class="rm-f"><span>' + esc(rmI("priority")) + "</span>" +
          sel(RM_PRIOS.map(function (p) { return [p, rmI("prio." + p)]; }), it.priority, "rm-d-priority", !canEdit) + "</label>" +
        '<label class="rm-f"><span>' + esc(rmI("assignee")) + "</span>" +
          '<select id="rm-d-assignee"' + (canEdit ? "" : " disabled") + ">" +
            rmAssigneeOptions(it.assignee_id) + "</select></label>" +
        '<label class="rm-f"><span>' + esc(rmI("progress")) + ' <b id="rm-d-pv">' + rmProgressPct(it) + "%</b></span>" +
          '<input type="range" min="0" max="100" step="5" id="rm-d-progress" value="' + rmProgressPct(it) + '"' +
            (rmChecklistOf(it.id).length ? " disabled" : editable) + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("starts")) + '</span><input type="date" id="rm-d-starts" value="' + esc(ymd(it.starts_on)) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("due")) + '</span><input type="date" id="rm-d-due" value="' + esc(ymd(it.due_on)) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("estimate")) + '</span><input type="number" step="0.5" id="rm-d-est" value="' + esc(it.estimated_hours == null ? "" : it.estimated_hours) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("spent")) + '</span><input type="number" step="0.5" id="rm-d-spent" value="' + esc(it.spent_hours == null ? "" : it.spent_hours) + '"' + editable + "></label>" +
      "</div>" +
      '<p class="rm-note" id="rm-d-asg-note"' + (it.assignee_id && !rmIsMember(it.assignee_id) ? "" : " hidden") + ">" +
        esc(rmI("asgGuest")) + "</p>" +
      '<div class="rm-d-desc">' + (it.description ? "<p>" + esc(it.description) + "</p>" : "") +
        "<p class=\"rm-d-meta\">" + esc(rmI("author")) + ": " + esc(rmName(it.author_id)) + " · " + esc(ymd(it.created_at)) + "</p></div>" +
      '<div class="rm-d-cl" id="rm-d-cl-box">' + rmChecklistHtml(it) + "</div>" +
      '<div class="rm-d-attach" id="rm-d-attach-box">' +
        '<div class="rm-d-attach-head"><span>' + esc(rmI("attach")) + '</span>' +
          (canEdit ? '<span class="rm-d-attach-hint">' + esc(rmI("attachHint")) + "</span>" : "") + "</div>" +
        '<div class="drive-chips" id="rm-d-attach-chips">' + rmAttachChips(it) + "</div>" +
        (canEdit ? '<input id="rm-d-attach" type="url" class="drive-input" placeholder="' + esc(rmI("attachPh")) + '">' : "") +
      "</div>" +
      '<div class="rm-d-actions">' +
        (canEdit ? '<button type="button" class="btn btn-primary btn-sm" id="rm-d-save">' + esc(rmI("save")) + "</button>" +
          '<button type="button" class="btn btn-ghost btn-sm danger" id="rm-d-del">' + esc(rmI("delete")) + "</button>" : "") +
        '<span class="spacer"></span>' +
        (rmCanWrite() ? '<button type="button" class="btn btn-ghost btn-sm" id="rm-d-draft">' + esc(rmI("draft")) + "</button>" : "") +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-d-close2">' + esc(rmI("close")) + "</button>" +
      "</div>" +
      (docs.length ? '<h3 class="rm-h3">' + esc(rmI("approvals")) + "</h3>" + docs.map(function (d) {
        return '<p class="rm-doc"><b>' + esc(d.doc_no || "") + "</b> " + esc(d.title || "") +
          ' <span class="pill st-' + esc(d.status) + '">' + esc(rmDocStatus(d.status)) + "</span></p>";
      }).join("") : "") +
      '<h3 class="rm-h3">' + esc(rmI("children")) + " (" + kids.length + ")</h3>" +
      (kids.length ? '<ul class="rm-kids">' + kids.map(function (k) {
        return '<li><button type="button" class="rowlink rm-kid" data-id="' + esc(k.id) + '">#' + esc(k.issue_no) + " " +
          esc(k.subject) + "</button> " + rmPill("st", k.status) + "</li>";
      }).join("") + "</ul>" : '<p class="rm-empty sm">' + esc(rmI("noChildren")) + "</p>") +
      (rmCanWrite() ? '<div class="rm-inline"><input type="text" id="rm-child-subject" maxlength="200" placeholder="' +
        esc(rmI("childPh")) + '"><button type="button" class="btn btn-ghost btn-sm" id="rm-child-add">' +
        esc(rmI("addChild")) + "</button></div>" : "") +
      '<h3 class="rm-h3">' + esc(rmI("relations")) + "</h3>" +
      (rels.length ? '<ul class="rm-rels">' + rels.map(function (r) {
        var otherId = r.from_id === it.id ? r.to_id : r.from_id;
        var other = rmFind(otherId);
        return "<li>" + esc(rmI("rel." + r.kind)) + " <span>" +
          (other ? "#" + esc(other.issue_no) + " " + esc(other.subject) : otherId) + "</span>" +
          (rmCanEdit() ? ' <button type="button" class="mini rm-rel-del" data-id="' + esc(r.id) + '">×</button>' : "") +
          "</li>";
      }).join("") + "</ul>" : '<p class="rm-empty sm">' + esc(rmI("noRelations")) + "</p>") +
      (rmCanWrite() && targets.length ? '<div class="rm-inline">' +
        '<select id="rm-rel-kind">' + ["relates", "blocks", "precedes", "duplicates"].map(function (k) {
          return '<option value="' + k + '">' + esc(rmI("rel." + k)) + "</option>";
        }).join("") + "</select>" +
        '<select id="rm-rel-target">' + targets.map(function (t) {
          return '<option value="' + esc(t.id) + '">#' + esc(t.issue_no) + " " + esc(t.subject) + "</option>";
        }).join("") + "</select>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-rel-add">' + esc(rmI("addRelation")) + "</button></div>" : "") +
      '<h3 class="rm-h3">' + esc(rmI("comments")) + "</h3>" +
      (cms.length ? '<ul class="rm-comments">' + cms.map(function (c) {
        return "<li><b>" + esc(c.author_name || "") + "</b> <span>" + esc(String(c.created_at || "").slice(0, 16).replace("T", " ")) +
          "</span><p>" + esc(c.body) + "</p></li>";
      }).join("") + "</ul>" : '<p class="rm-empty sm">' + esc(rmI("noComments")) + "</p>") +
      (rmCanWrite() ? '<div class="rm-comment-add"><textarea id="rm-comment" rows="2" maxlength="4000" placeholder="' +
        esc(rmI("commentPh")) + '"></textarea><button type="button" class="btn btn-primary btn-sm" id="rm-comment-add">' +
        esc(rmI("addComment")) + "</button></div>" : "");

    rmPaintDetailBind(it);
    var close = function () { $("#rm-modal").hidden = true; RM.detail = null; };
    $("#rm-d-close").addEventListener("click", close);
    $("#rm-d-close2").addEventListener("click", close);
    var pv = $("#rm-d-progress");
    if (pv) pv.addEventListener("input", function () {
      $("#rm-d-pv").textContent = pv.value + "%";
      if (Number(pv.value) >= 100 && $("#rm-d-status") && !$("#rm-d-status").disabled) $("#rm-d-status").value = "resolved";
    });
    var sv = $("#rm-d-save");
    if (sv) sv.addEventListener("click", function () { rmSaveDetail(it); });
    var del = $("#rm-d-del");
    if (del) del.addEventListener("click", function () {
      if (!window.confirm(rmI("confirmDel"))) return;
      request("issues?id=eq." + encodeURIComponent(it.id), { method: "DELETE", prefer: "return=minimal" }).then(function (r) {
        if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
        $("#rm-modal").hidden = true;
        rmLoad(); rmMsg(rmI("deleted"), "ok");
      });
    });
    var draft = $("#rm-d-draft");
    if (draft) draft.addEventListener("click", function () { rmDraft(it); });
    [].forEach.call(body.querySelectorAll(".rm-kid"), function (b) {
      b.addEventListener("click", function () { rmOpenIssue(b.getAttribute("data-id")); });
    });
    var ca = $("#rm-child-add");
    if (ca) ca.addEventListener("click", function () {
      var t = ($("#rm-child-subject").value || "").trim();
      if (!t) { $("#rm-child-subject").focus(); return; }
      rpc("issue_create", { p_project_id: it.project_id, p_subject: t, p_parent_id: it.id,
                            p_assignee_id: it.assignee_id, p_tracker: it.tracker, p_priority: "normal" })
        .then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
          rmMsg(rmI("added"), "ok");
          rmLoad().then(function () { rmOpenIssue(it.id); rmMsg(rmI("added"), "ok"); });
        });
    });
    var ra2 = $("#rm-rel-add");
    if (ra2) ra2.addEventListener("click", function () {
      var kind = $("#rm-rel-kind").value, to = $("#rm-rel-target").value;
      if (!to) return;
      request("issue_relations", { method: "POST", prefer: "return=representation",
        body: { from_id: it.id, to_id: to, kind: kind, created_by: rmMe() } }).then(function (r) {
        if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
        rmOpenIssue(it.id); rmMsg(rmI("added"), "ok");
      });
    });
    [].forEach.call(body.querySelectorAll(".rm-rel-del"), function (b) {
      b.addEventListener("click", function () {
        request("issue_relations?id=eq." + encodeURIComponent(b.getAttribute("data-id")),
                { method: "DELETE", prefer: "return=minimal" }).then(function () { rmOpenIssue(it.id); });
      });
    });
    var cm = $("#rm-comment-add");
    if (cm) cm.addEventListener("click", function () {
      var t = ($("#rm-comment").value || "").trim();
      if (!t) { $("#rm-comment").focus(); return; }
      request("issue_comments", { method: "POST", prefer: "return=representation",
        body: { issue_id: it.id, author_id: rmMe(), author_name: rmActorName(), body: t } }).then(function (r) {
        if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
        rmOpenIssue(it.id);
      });
    });
  }
  function rmPaintDetailBind(it) {
    var canEdit = rmCanEditIssue(it);
    rmBindAttach(it, canEdit);
    rmBindAttachRemove(it);
    rmBindChecklist(it);
    var asg = $("#rm-d-assignee"), note = $("#rm-d-asg-note");
    if (asg && note) asg.addEventListener("change", function () {
      note.hidden = !(asg.value && !rmIsMember(asg.value));
    });
  }

  function rmDocStatus(st) {
    var map = { draft: "appr.badge.draft", pending: "appr.badge.pending", approved: "appr.badge.approved",
                rejected: "appr.badge.rejected", canceled: "appr.badge.canceled" };
    return I(map[st] || "appr.badge.pending");
  }

  function rmActorName() {
    var p = window.CRAFT_AUTH && window.CRAFT_AUTH.profile ? window.CRAFT_AUTH.profile() : null;
    if (p && (p.nickname || p.name)) return p.nickname || p.name;
    var m = window.CRAFT_AUTH && window.CRAFT_AUTH.user ? window.CRAFT_AUTH.user() : null;
    if (m && m.user_metadata && m.user_metadata.full_name) return m.user_metadata.full_name;
    return String(m && m.email || "").split("@")[0];
  }

  function rmAttachList(it) {
    if (window.SBP_DRIVE && window.SBP_DRIVE.fromFields && it) {
      return window.SBP_DRIVE.fromFields({ attachments: it.attachments });
    }
    return [];
  }
  function rmAttachChips(it) {
    var list = rmAttachList(it);
    if (!list.length) return '<span class="rm-empty sm">' + esc(rmI("noAttach")) + "</span>";
    var removable = rmCanEditIssue(it);
    if (window.SBP_DRIVE && window.SBP_DRIVE.chip) {
      return list.map(function (a) { return window.SBP_DRIVE.chip(a, { removable: removable }); }).join("");
    }
    return list.map(function (a) {
      return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.name || a.url) + "</a>";
    }).join("");
  }
  /* 침의 × — 그 침반만 배열에서 빼고 바로 저장합니다(v10.12 — 여러 장 유지). */
  function rmBindAttachRemove(it) {
    var box = $("#rm-d-attach-chips");
    if (!box) return;
    [].forEach.call(box.querySelectorAll(".drive-chip"), function (chip, idx) {
      var x = chip.querySelector("[data-drive-remove]");
      if (!x) return;
      x.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var list = rmAttachList(it).slice();
        if (!list[idx]) return;
        list.splice(idx, 1);
        request("issues?id=eq." + encodeURIComponent(it.id), {
          method: "PATCH", prefer: "return=representation", body: { attachments: list }
        }).then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
          var row = Array.isArray(r.data) ? r.data[0] : r.data;
          if (row) {
            it.attachments = row.attachments;
            for (var i = 0; i < RM.issues.length; i++) if (RM.issues[i].id === row.id) RM.issues[i] = row;
          } else { it.attachments = list; }
          box.innerHTML = rmAttachChips(it);
          rmBindAttachRemove(it);
          rmMsg(rmI("attachRemoved"), "ok");
        }).catch(function () { rmMsg(rmI("fail"), "err"); });
      });
    });
  }
  function rmBindAttach(it, canEdit) {
    if (!canEdit) return;
    var inp = $("#rm-d-attach");
    if (!inp || !window.SBP_DRIVE || !window.SBP_DRIVE.enhance) return;
    RM.attach = null;
    window.SBP_DRIVE.enhance(inp, {
      placeholderKey: "drive.ph",
      value: "",
      onChange: function (att) { RM.attach = att; }
    });
  }

  function rmSaveDetail(it) {
    var body = {
      status: $("#rm-d-status").value,
      priority: $("#rm-d-priority").value,
      assignee_id: $("#rm-d-assignee").value || null,
      progress: Number($("#rm-d-progress").value) || 0,
      starts_on: $("#rm-d-starts").value || null,
      due_on: $("#rm-d-due").value || null,
      estimated_hours: $("#rm-d-est").value ? Number($("#rm-d-est").value) : null,
      spent_hours: $("#rm-d-spent").value ? Number($("#rm-d-spent").value) : null
    };
    /* 드라이브 첨부 — 입력칸에 링크를 붙였거나 Picker 로 골랐으면 저장 */
    var att = (window.SBP_DRIVE && window.SBP_DRIVE.parse) ? window.SBP_DRIVE.parse($("#rm-d-attach") ? $("#rm-d-attach").value : "") : null;
    if (RM.attach && RM.attach.fileId) att = RM.attach;
    /* v10.12 — 여러 장을 배열로 쌓습니다(기존 첨부는 그대로). */
    var list = rmAttachList(it).slice();
    if (att && att.fileId && !list.some(function (a) { return a && a.fileId === att.fileId; })) list.push(att);
    body.attachments = list;
    /* 체크리스트가 있으면 진행률은 체크리스트가 정합니다 — 저장할 때 덮어쓰지 않습니다. */
    if (rmChecklistOf(it.id).length) delete body.progress;
    /* v10.12 — 상태 전이 정리: 완료면 진행률 100, 100%면 해결로 올립니다. */
    if (body.status === "closed") {
      body.progress = 100;
      if (!it.closed_at) body.closed_at = new Date().toISOString();
    } else if (body.progress >= 100 && ["new", "in_progress"].indexOf(body.status) >= 0) {
      body.status = "resolved";
    }
    request("issues?id=eq." + encodeURIComponent(it.id), {
      method: "PATCH", prefer: "return=representation", body: body
    }).then(function (r) {
      if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (row) for (var i = 0; i < RM.issues.length; i++) if (RM.issues[i].id === row.id) RM.issues[i] = row;
      rmMsg(rmI("saved"), "ok");
      $("#rm-modal").hidden = true;
      rmRender();
      if (body.assignee_id && !rmIsMember(body.assignee_id)) rmEnsureMember(it.project_id, body.assignee_id);
    }).catch(function () { rmMsg(rmI("fail"), "err"); });
  }

  /* ------- v10.12 — 확인목록(체크리스트) + 진행률 ------- */
  function rmChecklistOf(id) {
    return (RM.checklist[id] || []).slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }
  function rmProgressPct(it) {
    var items = rmChecklistOf(it.id);
    if (!items.length) return Number(it.progress) || 0;
    var done = items.filter(function (c) { return c.done; }).length;
    return Math.round(done * 100 / items.length);
  }
  function rmChecklistHtml(it) {
    var items = rmChecklistOf(it.id);
    var done = items.filter(function (c) { return c.done; }).length;
    var pct = items.length ? Math.round(done * 100 / items.length) : (Number(it.progress) || 0);
    var canWrite = rmCanWrite();
    return '<h3 class="rm-h3">' + esc(rmI("checklist")) +
        ' <span class="rm-cl-n">' + esc(rmI("clDone", { done: done, total: items.length })) + "</span></h3>" +
      '<div class="rm-cl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i><span>' + pct + "%</span></div>" +
      (items.length
        ? '<ul class="rm-cl-list">' + items.map(function (c) {
            return '<li class="' + (c.done ? "is-done" : "") + '">' +
              '<label><input type="checkbox" class="rm-cl-box" data-cl="' + esc(c.id) + '"' +
                (c.done ? " checked" : "") + (canWrite ? "" : " disabled") + "> <span>" + esc(c.text) + "</span></label>" +
              (rmCanEdit() ? '<button type="button" class="mini rm-cl-del" data-cl="' + esc(c.id) +
                '" aria-label="' + esc(rmI("delete")) + '">×</button>' : "") +
              "</li>";
          }).join("") + "</ul>"
        : '<p class="rm-empty sm">' + esc(rmI("clEmpty")) + "</p>") +
      (canWrite ? '<div class="rm-inline rm-cl-add"><input type="text" id="rm-cl-text" maxlength="300" placeholder="' +
        esc(rmI("clAddPh")) + '"><button type="button" class="btn btn-ghost btn-sm" id="rm-cl-add">' +
        esc(rmI("clAdd")) + "</button></div>" : "");
  }
  function rmPaintChecklistBox(it) {
    var box = $("#rm-d-cl-box");
    if (!box) return;
    box.innerHTML = rmChecklistHtml(it);
    rmBindChecklist(it);
  }
  function rmReloadChecklist(it) {
    return request("issue_checklist?select=*&issue_id=eq." + encodeURIComponent(it.id) + "&order=sort_order.asc")
      .then(function (r) {
        RM.checklist[it.id] = (r.ok && Array.isArray(r.data)) ? r.data : [];
        rmPaintChecklistBox(it);
        return r;
      });
  }
  function rmBindChecklist(it) {
    var box = $("#rm-d-cl-box");
    if (!box) return;
    [].forEach.call(box.querySelectorAll(".rm-cl-box"), function (b) {
      b.addEventListener("change", function () {
        rpc("checklist_toggle", { p_id: b.getAttribute("data-cl"), p_done: !!b.checked }).then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); rmReloadChecklist(it); return; }
          var d = r.data || {};
          for (var i = 0; i < (RM.checklist[it.id] || []).length; i++) {
            var c = RM.checklist[it.id][i];
            if (c.id === b.getAttribute("data-cl")) c.done = !!b.checked;
          }
          if (d.progress != null) it.progress = d.progress;
          rmPaintChecklistBox(it);
          rmRender();
        }).catch(function () { rmMsg(rmI("fail"), "err"); });
      });
    });
    [].forEach.call(box.querySelectorAll(".rm-cl-del"), function (b) {
      b.addEventListener("click", function () {
        rpc("checklist_remove", { p_id: b.getAttribute("data-cl") }).then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
          if (r.data && r.data.progress != null) it.progress = r.data.progress;
          rmReloadChecklist(it);
          rmRender();
        });
      });
    });
    var add = $("#rm-cl-add"), inp = $("#rm-cl-text");
    if (add && inp) {
      var doAdd = function () {
        var t = (inp.value || "").trim();
        if (!t) { inp.focus(); return; }
        add.disabled = true;
        rpc("checklist_add", { p_issue_id: it.id, p_text: t }).then(function (r) {
          add.disabled = false;
          if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
          if (r.data && r.data.progress != null) it.progress = r.data.progress;
          rmReloadChecklist(it).then(function () { rmMsg(rmI("added"), "ok"); });
          rmRender();
        }).catch(function () { add.disabled = false; rmMsg(rmI("fail"), "err"); });
      };
      add.addEventListener("click", doAdd);
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); doAdd(); }
      });
    }
  }
  /* ------- 일감 만들기 / 고치기 ------- */
  function rmOpts(list, kind) {
    return list.map(function (v) { return '<option value="' + esc(v) + '">' + esc(rmI(kind + "." + v)) + "</option>"; }).join("");
  }
  function rmOpenForm(it) {
    if (!rmCanWrite()) { rmMsg(rmI("noPerm"), "err"); return; }
    var form = $("#rm-form");
    if (!form) return;
    RM.editing = it || null;
    if (!RM.project) { rmMsg(rmI("empty.project"), "err"); return; }
    $("#rm-form-title").textContent = it ? rmI("edit") + " #" + it.issue_no : rmI("new");
    $("#rm-tracker").innerHTML = rmOpts(RM_TRACKERS, "tracker");
    $("#rm-priority").innerHTML = rmOpts(RM_PRIOS, "prio");
    $("#rm-status").innerHTML = rmOpts(RM_STATUSES, "st");
    $("#rm-assignee").innerHTML = rmAssigneeOptions(it ? it.assignee_id : "");
    $("#rm-parent").innerHTML = '<option value="">' + esc(rmI("noParent")) + "</option>" +
      RM.issues.filter(function (x) { return !it || x.id !== it.id; }).map(function (x) {
        return '<option value="' + esc(x.id) + '">#' + esc(x.issue_no) + " " + esc(x.subject) + "</option>";
      }).join("");
    $("#rm-subject").value = it ? it.subject : "";
    $("#rm-desc").value = it ? (it.description || "") : "";
    $("#rm-tracker").value = it ? it.tracker : "task";
    $("#rm-priority").value = it ? it.priority : "normal";
    $("#rm-status").value = it ? it.status : "new";
    $("#rm-assignee").value = it ? (it.assignee_id || "") : "";
    $("#rm-parent").value = it ? (it.parent_id || "") : "";
    $("#rm-starts").value = it ? ymd(it.starts_on) : "";
    $("#rm-due").value = it ? ymd(it.due_on) : "";
    $("#rm-est").value = it && it.estimated_hours != null ? it.estimated_hours : "";
    $("#rm-spent").value = it && it.spent_hours != null ? it.spent_hours : "";
    form.hidden = false;
    rmMsg("");
    rmFocusIfIdle("#rm-subject", "#rm-form");
  }
  function rmSaveForm(e) {
    if (e) e.preventDefault();
    var subject = ($("#rm-subject").value || "").trim();
    if (!subject) { rmMsg(rmI("needSubject"), "err"); $("#rm-subject").focus(); return; }
    var body = {
      subject: subject,
      description: ($("#rm-desc").value || "").trim(),
      tracker: $("#rm-tracker").value,
      priority: $("#rm-priority").value,
      status: $("#rm-status").value,
      assignee_id: $("#rm-assignee").value || null,
      parent_id: $("#rm-parent").value || null,
      starts_on: $("#rm-starts").value || null,
      due_on: $("#rm-due").value || null,
      estimated_hours: $("#rm-est").value ? Number($("#rm-est").value) : null,
      spent_hours: $("#rm-spent").value ? Number($("#rm-spent").value) : null
    };
    var btn = $("#rm-form-save");
    if (btn) btn.disabled = true;
    var req;
    if (RM.editing) {
      req = request("issues?id=eq." + encodeURIComponent(RM.editing.id),
                    { method: "PATCH", prefer: "return=representation", body: body });
    } else {
      req = rpc("issue_create", {
        p_project_id: RM.project, p_subject: body.subject, p_description: body.description,
        p_tracker: body.tracker, p_priority: body.priority, p_status: body.status,
        p_parent_id: body.parent_id, p_assignee_id: body.assignee_id,
        p_starts_on: body.starts_on, p_due_on: body.due_on,
        p_estimated_hours: body.estimated_hours, p_spent_hours: body.spent_hours
      });
    }
    req.then(function (r) {
      if (btn) btn.disabled = false;
      if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
      $("#rm-form").hidden = true;
      RM.editing = null;
      rmMsg(rmI("saved"), "ok");
      if (body.assignee_id && !rmIsMember(body.assignee_id)) rmEnsureMember(RM.project, body.assignee_id);
      rmLoad();
    }).catch(function () { if (btn) btn.disabled = false; rmMsg(rmI("fail"), "err"); });
  }

  function rmbulkApply() {
    var ids = Object.keys(RM.sel).filter(function (k) { return RM.sel[k]; });
    if (!ids.length) return;
    var body = {};
    if ($("#rm-bulk-status").value) body.status = $("#rm-bulk-status").value;
    if ($("#rm-bulk-assignee").value) body.assignee_id = $("#rm-bulk-assignee").value;
    if (!Object.keys(body).length) return;
    Promise.all(ids.map(function (id) {
      return request("issues?id=eq." + encodeURIComponent(id),
                     { method: "PATCH", prefer: "return=representation", body: body });
    })).then(function (rows) {
      var bad = rows.filter(function (r) { return !r.ok; });
      if (bad.length) rmMsg(rmErr(bad[0]), "err");
      else rmMsg(rmI("bulkDone", { n: ids.length }), "ok");
      RM.sel = {};
      rmLoad();
    });
  }

  /* ------- 프로젝트 · 멤버 ------- */
  function rmOpenProjectForm(edit) {
    var f = $("#rm-project-form");
    if (!f) return;
    var p = edit ? rmProject() : null;
    if (edit) {
      if (!p) return;
      if (!rmCanEdit()) { rmMsg(rmI("noPerm"), "err"); return; }
    }
    RM.projEditing = p;
    $("#rm-project-form-title").textContent = p ? rmI("projectEdit") : rmI("projectNew");
    $("#rm-p-key").value = p ? p.key : "";
    $("#rm-p-name").value = p ? p.name : "";
    $("#rm-p-desc").value = p ? (p.description || "") : "";
    $("#rm-p-starts").value = p ? ymd(p.starts_on) : todayKST();
    $("#rm-p-ends").value = p ? ymd(p.ends_on) : "";
    var st = $("#rm-p-status");
    if (st) {
      st.innerHTML = '<option value="active">' + esc(rmI("pst.active")) + "</option>" +
        '<option value="archived">' + esc(rmI("pst.archived")) + "</option>";
      st.value = p ? (p.status || "active") : "active";
      st.disabled = !p;
    }
    var sv = $("#rm-project-save");
    if (sv) sv.textContent = p ? rmI("save") : rmI("create");
    var del = $("#rm-project-del");
    if (del) del.hidden = !p;
    f.hidden = false;
    rmMsg("");
    rmFocusIfIdle("#rm-p-key", "#rm-project-form");
  }
  function rmSaveProject(e) {
    if (e) e.preventDefault();
    var key = ($("#rm-p-key").value || "").trim().toUpperCase();
    var name = ($("#rm-p-name").value || "").trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,15}$/.test(key)) { rmMsg(rmI("needKey"), "err"); $("#rm-p-key").focus(); return; }
    if (!name) { rmMsg(rmI("needName"), "err"); $("#rm-p-name").focus(); return; }
    var uid = rmMe();
    var pst = $("#rm-p-status") && !$("#rm-p-status").disabled ? $("#rm-p-status").value : "active";
    var body = {
      key: key, name: name, description: ($("#rm-p-desc").value || "").trim(),
      starts_on: $("#rm-p-starts").value || null, ends_on: $("#rm-p-ends").value || null
    };
    var editing = RM.projEditing;
    if (editing) {
      body.status = pst;
      request("projects?id=eq." + encodeURIComponent(editing.id),
              { method: "PATCH", prefer: "return=representation", body: body }).then(function (r) {
        if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
        $("#rm-project-form").hidden = true;
        RM.projEditing = null;
        return rmLoadProjects().then(function () {
          /* 보관으로 바꾸면 목록에서 빠지므로 지금 프로젝트를 새로 고릅니다. */
          var cur = rmProject();
          if (!cur || (cur.status === "archived" && !RM.showArchived)) {
            var first = RM.projects.filter(function (p) { return p.status !== "archived"; })[0];
            if (first) RM.project = first.id;
          }
          rmFillSelects();
          return rmLoad();
        }).then(function () {
          rmMsg(pst === "archived" ? rmI("projectArchived") : rmI("projectSaved"), "ok");
        });
      }).catch(function () { rmMsg(rmI("fail"), "err"); });
      return;
    }
    body.status = "active";
    body.owner_id = uid;
    request("projects", { method: "POST", prefer: "return=representation", body: body }).then(function (r) {
      if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (!row || !row.id) { rmMsg(rmI("fail"), "err"); return; }
      return request("project_members", { method: "POST", prefer: "return=representation",
        body: { project_id: row.id, user_id: uid, role: "manager" } }).then(function (m) {
        if (!m.ok) rmMsg(rmErr(m), "err");
        RM.project = row.id;
        $("#rm-project-form").hidden = true;
        RM.projEditing = null;
        return rmLoadProjects().then(function () { rmFillSelects(); return rmLoad(); }).then(function () {
          /* v10.11 — rmLoad() 가 시작할 때 rmMsg("") 로 지우므로 성공 안내는 목록을 그린 뒤에 띄웁니다. */
          rmMsg(rmI("projectCreated"), "ok");
        });
      });
    });
  }

  /* 프로젝트 삭제 — 키를 정확히 입력해야 단추가 열립니다(일감·체크리스트·댓글까지 cascade). */
  function rmOpenProjectDelete() {
    var p = rmProject();
    if (!p) return;
    if (!rmCanEdit()) { rmMsg(rmI("noPerm"), "err"); return; }
    var modal = $("#rm-del-modal");
    if (!modal) return;
    modal.hidden = false;
    var n = RM.issues.length;
    $("#rm-del-body").innerHTML =
      '<div class="rm-d-head"><div><h3>' + esc(rmI("projectDelete")) + "</h3>" +
        '<p class="rm-d-meta">' + esc(p.key + " · " + p.name) + "</p></div>" +
        '<button type="button" class="tasks-x" id="rm-del-x" aria-label="close">×</button></div>' +
      '<p class="rm-d-warn">' + esc(rmI("delWarn", { n: n })) + "</p>" +
      '<label class="rm-f"><span>' + esc(rmI("delKeyPh", { key: p.key })) +
        '</span><input id="rm-del-key" autocomplete="off" spellcheck="false"></label>' +
      '<div class="rm-d-actions"><span class="spacer"></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="rm-del-cancel">' + esc(rmI("cancel")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm danger" id="rm-del-go" disabled>' +
          esc(rmI("projectDelete")) + "</button></div>";
    var close = function () { modal.hidden = true; };
    $("#rm-del-x").addEventListener("click", close);
    $("#rm-del-cancel").addEventListener("click", close);
    var inp = $("#rm-del-key"), go = $("#rm-del-go");
    inp.addEventListener("input", function () {
      go.disabled = (inp.value || "").trim().toUpperCase() !== String(p.key || "").toUpperCase();
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !go.disabled) { e.preventDefault(); go.click(); }
    });
    go.addEventListener("click", function () {
      go.disabled = true;
      request("projects?id=eq." + encodeURIComponent(p.id), { method: "DELETE", prefer: "return=minimal" })
        .then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); go.disabled = false; return; }
          modal.hidden = true;
          $("#rm-project-form").hidden = true;
          RM.projEditing = null;
          RM.project = null;
          RM.issues = [];
          RM.checklist = {};
          return rmLoadProjects().then(function () {
            var first = RM.projects.filter(function (x) { return x.status !== "archived"; })[0];
            RM.project = first ? first.id : (RM.projects[0] ? RM.projects[0].id : null);
            rmFillSelects();
            return rmLoad();
          }).then(function () { rmMsg(rmI("projectDeleted"), "ok"); });
        }).catch(function () { rmMsg(rmI("fail"), "err"); go.disabled = false; });
    });
    setTimeout(function () { inp.focus(); }, 40);
  }

  function rmOpenMembers() {
    if (!RM.project) return;
    if (!rmCanEdit()) { rmMsg(rmI("noPerm"), "err"); return; }
    var modal = $("#rm-members-modal");
    modal.hidden = false;
    var body = $("#rm-members-body");
    var p = rmProject();
    body.innerHTML =
      '<div class="rm-d-head"><div><h3>' + esc(rmI("members")) + "</h3>" +
        '<p class="rm-d-meta">' + esc(p ? p.key + " · " + p.name : "") + "</p></div>" +
        '<button type="button" class="tasks-x" id="rm-m-close" aria-label="close">×</button></div>' +
      '<div id="rm-m-list">' + (RM.members.length ? RM.members.map(function (m) {
        return '<div class="rm-m-row" data-uid="' + esc(m.user_id) + '"><span>' + esc(rmName(m.user_id) || m.user_id) + "</span>" +
          '<select class="rm-sel rm-m-role">' + RM_ROLES.map(function (r) {
            return '<option value="' + r + '"' + (m.role === r ? " selected" : "") + ">" + esc(rmI("role." + r)) + "</option>";
          }).join("") + "</select>" +
          '<button type="button" class="mini danger rm-m-del">' + esc(rmI("remove")) + "</button></div>";
      }).join("") : '<p class="rm-empty sm">' + esc(rmI("noMembers")) + "</p>") + "</div>" +
      '<div class="rm-inline"><select id="rm-m-add">' +
        '<option value="">' + esc(rmI("addMember")) + "</option>" +
        RM.people.filter(function (x) { return !RM.members.some(function (m) { return m.user_id === x.id; }); })
          .map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + "</option>"; }).join("") +
      '</select><select id="rm-m-role-new" class="rm-sel">' + RM_ROLES.map(function (r) {
        return '<option value="' + r + '">' + esc(rmI("role." + r)) + "</option>";
      }).join("") + '</select><button type="button" class="btn btn-primary btn-sm" id="rm-m-add-btn">' +
        esc(rmI("add")) + "</button></div>";

    $("#rm-m-close").addEventListener("click", function () { modal.hidden = true; });
    [].forEach.call(body.querySelectorAll(".rm-m-role"), function (s) {
      s.addEventListener("change", function () {
        var row = s.closest(".rm-m-row");
        request("project_members?project_id=eq." + encodeURIComponent(RM.project) +
                "&user_id=eq." + encodeURIComponent(row.getAttribute("data-uid")),
                { method: "PATCH", prefer: "return=representation", body: { role: s.value } }).then(function (r) {
          if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
          for (var i = 0; i < RM.members.length; i++) if (RM.members[i].user_id === row.getAttribute("data-uid")) RM.members[i].role = s.value;
          rmMsg(rmI("saved"), "ok");
        });
      });
    });
    [].forEach.call(body.querySelectorAll(".rm-m-del"), function (b) {
      b.addEventListener("click", function () {
        var row = b.closest(".rm-m-row");
        request("project_members?project_id=eq." + encodeURIComponent(RM.project) +
                "&user_id=eq." + encodeURIComponent(row.getAttribute("data-uid")),
                { method: "DELETE", prefer: "return=minimal" }).then(function () {
          RM.members = RM.members.filter(function (m) { return m.user_id !== row.getAttribute("data-uid"); });
          rmOpenMembers();
        });
      });
    });
    var ab = $("#rm-m-add-btn");
    if (ab) ab.addEventListener("click", function () {
      var uid = $("#rm-m-add").value;
      if (!uid) return;
      request("project_members", { method: "POST", prefer: "return=representation",
        body: { project_id: RM.project, user_id: uid, role: $("#rm-m-role-new").value } }).then(function (r) {
        if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
        rmLoad().then(function () { rmOpenMembers(); });
      });
    });
  }

  /* ------- 일감 → 기안 올리기 ------- */
  function rmDraft(it) {
    var no = "#" + it.issue_no;
    var title = "[" + (rmProject() ? rmProject().key : "") + " " + no + "] " + it.subject;
    var lines = [];
    lines.push(rmI("draftLine", { no: no, subject: it.subject }));
    if (it.description) lines.push("", it.description);
    var p = {
      title: title.slice(0, 190),
      body: lines.join("\n"),
      issue_id: it.id,
      issue_title: no + " " + it.subject,
      form_code: "general"
    };
    window.CRAFT_TASK_PREFILL = p;
    try { sessionStorage.setItem("sbpress.appr.prefill", JSON.stringify(p)); } catch (e) {}
    $("#rm-modal").hidden = true;
    if (location.hash === "#/approvals") {
      if (window.CRAFT_APPROVALS) window.CRAFT_APPROVALS.show();
    } else {
      location.hash = "#/approvals";
    }
    rmMsg(rmI("draftSent"), "ok");
  }

  /* ---------------- 바깥에서 부르는 함수 ---------------- */
  function legacyShow() {
    build();
    paintGate();
    if (signedIn() && myGrade() >= minGrade()) load();
    else if (signedIn()) paintGate();
  }

  function show() {
    build();
    paintGate();
    if (!signedIn()) return;
    if (myGrade() < minGrade()) { paintGate(); return; }
    if (RM.mode === null) {
      if (RM.probing) return;
      RM.probing = true;
      rmProbe().then(function (useRm) {
        RM.probing = false;
        RM.mode = useRm;
        if (useRm) rmShow(); else legacyShow();
      }).catch(function () { RM.probing = false; });
      return;
    }
    if (RM.mode) rmShow(); else legacyShow();
  }

  function refresh() {
    build();
    if (window.CRAFT_I18N) window.CRAFT_I18N.apply($("#view-tasks") || document);
    var head = $("#tasks-head");
    if (head) {
      var eb = $("#tasks-eyebrow"), ti = $("#tasks-title"), de = $("#tasks-desc");
      if (eb) eb.textContent = I("tasks.eyebrow");
      if (ti) ti.textContent = I("tasks.title");
      if (de) de.textContent = I("tasks.desc");
    }
    paintGate();
    if (!signedIn() || myGrade() < minGrade()) return;
    if (RM.mode) {
      if (RM.built) {
        rmFillSelects();
        rmRender();
      }
    } else if (RM.mode === false) {
      paintFilters();
      paintBoard();
      paintCounts();
    }
  }

  function boot() {
    if (state.booted) return;
    if (window.SBP && window.SBP.feature && !window.SBP.feature("tasks")) return;
    state.booted = true;
    build();
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
      window.CRAFT_AUTH.onChange(function () {
        paintGate();
        if (!signedIn()) { state.rows = []; paintBoard(); paintCounts(); return; }
        if (myGrade() < minGrade()) { paintGate(); return; }
        /* v10.11 — #/tasks 로 바로 들어오거나 새로고침하면 세션 복원 전에 show() 가 돌아
           RM.mode 가 null 로 남았습니다. 복원(onChange) 시점에 모드 판별부터 다시 시작합니다. */
        if (RM.mode === null) { show(); return; }
        if (RM.mode) { if (RM.built) rmShow(); else show(); }
        else load();
      });
    }
    if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
      window.CRAFT_I18N.onChange(function () { refresh(); });
    }
  }

  window.CRAFT_TASKS = {
    show: show, refresh: refresh, reload: function () { return RM.mode ? rmLoad() : load(); },
    signedIn: signedIn, state: RM, legacyState: state,
    /* 간트 막대 이동을 시험·키보드에서 부를 수 있게 열어 둡니다. */
    moveBar: function (id, days) {
      var it = rmFind(id);
      if (!it) return Promise.resolve(null);
      return request("issues?id=eq." + encodeURIComponent(id), {
        method: "PATCH", prefer: "return=representation",
        body: { starts_on: addDays(ymd(it.starts_on || it.due_on), days),
                due_on: addDays(ymd(it.due_on || it.starts_on), days) }
      }).then(function (r) { if (r.ok) return rmLoad(); return r; });
    },
    openIssue: rmOpenIssue, mode: function () { return RM.mode; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
