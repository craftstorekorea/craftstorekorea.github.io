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
    mode: null, built: false, booted: false, loading: false, missing: false,
    projects: [], project: null, members: [], people: [],
    issues: [], comments: {}, relations: {}, approvals: {},
    view: "list", q: "", fAssignee: "", fStatus: "", fPriority: "", fFrom: "", fTo: "",
    cal: "", sel: {}, detail: null, error: ""
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
        '<div class="rm-form-head"><h3>' + esc(rmI("projectNew")) + "</h3>" +
          '<button type="button" class="tasks-x" id="rm-project-x" aria-label="close">×</button></div>' +
        '<div class="rm-form-grid">' +
          '<label class="rm-f"><span>' + esc(rmI("key")) + '</span><input id="rm-p-key" maxlength="16" placeholder="SBP"></label>' +
          '<label class="rm-f rm-f-wide"><span>' + esc(rmI("name")) + '</span><input id="rm-p-name" maxlength="120"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("starts")) + '</span><input type="date" id="rm-p-starts"></label>' +
          '<label class="rm-f"><span>' + esc(rmI("due")) + '</span><input type="date" id="rm-p-ends"></label>' +
          '<label class="rm-f rm-f-wide"><span>' + esc(rmI("description")) + '</span><textarea id="rm-p-desc" rows="2"></textarea></label>' +
        "</div>" +
        '<div class="rm-form-foot"><span class="spacer"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="rm-project-cancel">' + esc(rmI("cancel")) + "</button>" +
          '<button type="submit" class="btn btn-primary btn-sm" id="rm-project-save">' + esc(rmI("create")) + "</button>" +
        "</div>" +
      "</form>" +
      '<div class="rm-modal" id="rm-members-modal" hidden role="dialog" aria-modal="true">' +
        '<div class="rm-modal-card"><div class="rm-modal-body" id="rm-members-body"></div></div>' +
      "</div>";

    $("#rm-project").addEventListener("change", function () {
      RM.project = $("#rm-project").value || null;
      RM.sel = {};
      rmLoad();
    });
    $("#rm-project-new").addEventListener("click", rmOpenProjectForm);
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
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#rm-modal").hidden) { $("#rm-modal").hidden = true; RM.detail = null; }
      else if (!$("#rm-members-modal").hidden) $("#rm-members-modal").hidden = true;
      else if (!$("#rm-form").hidden) $("#rm-form").hidden = true;
      else if (!$("#rm-project-form").hidden) $("#rm-project-form").hidden = true;
    });
  }

  function rmFillSelects() {
    var pj = $("#rm-project");
    if (pj) {
      pj.innerHTML = RM.projects.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.key + " · " + p.name) + "</option>";
      }).join("") || '<option value="">' + esc(rmI("noProject")) + "</option>";
      if (RM.project) pj.value = RM.project;
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
      RM.members.map(function (m) { return opt(m.user_id, rmName(m.user_id) || m.user_id); }).join("");
  }

  /* ------- 읽기 ------- */
  function rmLoadProjects() {
    return request("projects?select=*&order=created_at.asc").then(function (r) {
      if (!r.ok) { RM.missing = true; return r; }
      RM.projects = Array.isArray(r.data) ? r.data : [];
      if (!RM.project || !RM.projects.some(function (p) { return p.id === RM.project; })) {
        RM.project = RM.projects.length ? RM.projects[0].id : null;
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

  function rmLoad() {
    if (!signedIn()) return Promise.resolve();
    RM.loading = true;
    rmMsg("");
    return Promise.all([rp(), rmLoadMembers()]).then(function (res) {
      var r = res[0];
      RM.people = (r.ok && Array.isArray(r.data)) ? r.data : [];
      rpc("is_admin").then(function (x) { state.rmAdmin = !!(x.ok && x.data === true); }).catch(function () {});
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

  function rmRow(it, depth) {
    var selected = !!RM.sel[it.id];
    var late = it.due_on && ymd(it.due_on) < todayKST() && !["closed", "resolved"].includes(it.status);
    return '<div class="rm-row' + (selected ? " is-sel" : "") + (late ? " is-late" : "") + '" data-id="' + esc(it.id) + '"' +
      ' style="--depth:' + (depth || 0) + '" tabindex="0">' +
      '<label class="rm-check"><input type="checkbox" class="rm-sel-box"' + (selected ? " checked" : "") + ' ' +
        (rmCanWrite() ? "" : "disabled ") + 'aria-label="' + esc(rmI("selectIssue")) + '"></label>' +
      '<span class="rm-no">#' + esc(it.issue_no) + "</span>" +
      '<span class="rm-twisty' + (rmChildren(it.id).length ? " has-kids" : "") + '">' + (depth ? "↳" : "") + "</span>" +
      '<span class="rm-subject">' + esc(it.subject) + "</span>" +
      rmPill("tracker", it.tracker) + rmPill("prio", it.priority) + rmPill("st", it.status) +
      '<span class="rm-prog"><i style="width:' + (Number(it.progress) || 0) + '%"></i></span>' +
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
  }

  function rmBindRows() {
    [].forEach.call($$("#rm-list .rm-row"), function (row) {
      var id = row.getAttribute("data-id");
      row.addEventListener("click", function (e) {
        if (e.target && e.target.closest(".rm-check")) return;
        rmOpenIssue(id);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rmOpenIssue(id); }
      });
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
    request("issue_comments?select=*&issue_id=eq." + encodeURIComponent(id) + "&order=created_at.asc").then(function (rc) {
      RM.comments[id] = (rc.ok && Array.isArray(rc.data)) ? rc.data : [];
      return request("issue_relations?select=*&or=(from_id.eq." + encodeURIComponent(id) +
                     ",to_id.eq." + encodeURIComponent(id) + ")");
    }).then(function (rr) {
      RM.relations[id] = (rr.ok && Array.isArray(rr.data)) ? rr.data : [];
      return request("issue_approvals?select=*&issue_id=eq." + encodeURIComponent(id));
    }).then(function (ra) {
      var links = (ra.ok && Array.isArray(ra.data)) ? ra.data : [];
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
          sel([["", rmI("assigneeNone")]].concat(RM.members.map(function (m) { return [m.user_id, rmName(m.user_id)]; })),
              it.assignee_id, "rm-d-assignee", !canEdit) + "</label>" +
        '<label class="rm-f"><span>' + esc(rmI("progress")) + ' <b id="rm-d-pv">' + (Number(it.progress) || 0) + "%</b></span>" +
          '<input type="range" min="0" max="100" step="5" id="rm-d-progress" value="' + (Number(it.progress) || 0) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("starts")) + '</span><input type="date" id="rm-d-starts" value="' + esc(ymd(it.starts_on)) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("due")) + '</span><input type="date" id="rm-d-due" value="' + esc(ymd(it.due_on)) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("estimate")) + '</span><input type="number" step="0.5" id="rm-d-est" value="' + esc(it.estimated_hours == null ? "" : it.estimated_hours) + '"' + editable + "></label>" +
        '<label class="rm-f"><span>' + esc(rmI("spent")) + '</span><input type="number" step="0.5" id="rm-d-spent" value="' + esc(it.spent_hours == null ? "" : it.spent_hours) + '"' + editable + "></label>" +
      "</div>" +
      '<div class="rm-d-desc">' + (it.description ? "<p>" + esc(it.description) + "</p>" : "") +
        "<p class=\"rm-d-meta\">" + esc(rmI("author")) + ": " + esc(rmName(it.author_id)) + " · " + esc(ymd(it.created_at)) + "</p></div>" +
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
    if (body.status === "closed") body.closed_at = new Date().toISOString();
    request("issues?id=eq." + encodeURIComponent(it.id), {
      method: "PATCH", prefer: "return=representation", body: body
    }).then(function (r) {
      if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (row) for (var i = 0; i < RM.issues.length; i++) if (RM.issues[i].id === row.id) RM.issues[i] = row;
      rmMsg(rmI("saved"), "ok");
      $("#rm-modal").hidden = true;
      rmRender();
    }).catch(function () { rmMsg(rmI("fail"), "err"); });
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
    $("#rm-assignee").innerHTML = '<option value="">' + esc(rmI("assigneeNone")) + "</option>" +
      RM.members.map(function (m) {
        return '<option value="' + esc(m.user_id) + '">' + esc(rmName(m.user_id) || m.user_id) + "</option>";
      }).join("");
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
    setTimeout(function () { var f = $("#rm-subject"); if (f) f.focus(); }, 30);
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
  function rmOpenProjectForm() {
    var f = $("#rm-project-form");
    if (!f) return;
    $("#rm-p-key").value = "";
    $("#rm-p-name").value = "";
    $("#rm-p-desc").value = "";
    $("#rm-p-starts").value = todayKST();
    $("#rm-p-ends").value = "";
    f.hidden = false;
    setTimeout(function () { var x = $("#rm-p-key"); if (x) x.focus(); }, 30);
  }
  function rmSaveProject(e) {
    if (e) e.preventDefault();
    var key = ($("#rm-p-key").value || "").trim().toUpperCase();
    var name = ($("#rm-p-name").value || "").trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,15}$/.test(key)) { rmMsg(rmI("needKey"), "err"); $("#rm-p-key").focus(); return; }
    if (!name) { rmMsg(rmI("needName"), "err"); $("#rm-p-name").focus(); return; }
    var uid = rmMe();
    request("projects", { method: "POST", prefer: "return=representation", body: {
      key: key, name: name, description: ($("#rm-p-desc").value || "").trim(),
      status: "active", owner_id: uid,
      starts_on: $("#rm-p-starts").value || null, ends_on: $("#rm-p-ends").value || null
    } }).then(function (r) {
      if (!r.ok) { rmMsg(rmErr(r), "err"); return; }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (!row || !row.id) { rmMsg(rmI("fail"), "err"); return; }
      return request("project_members", { method: "POST", prefer: "return=representation",
        body: { project_id: row.id, user_id: uid, role: "manager" } }).then(function (m) {
        if (!m.ok) rmMsg(rmErr(m), "err");
        RM.project = row.id;
        $("#rm-project-form").hidden = true;
        rmMsg(rmI("projectCreated"), "ok");
        return rmLoadProjects().then(function () { rmFillSelects(); return rmLoad(); });
      });
    });
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
      rmProbe().then(function (useRm) {
        RM.mode = useRm;
        if (useRm) rmShow(); else legacyShow();
      });
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
        if (!signedIn()) { state.rows = []; paintBoard(); paintCounts(); }
        else if (RM.mode !== null) {
          if (RM.mode) { if (RM.built) rmShow(); }
          else if (myGrade() >= minGrade()) load();
        }
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
