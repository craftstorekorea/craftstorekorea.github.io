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

  /* ---------------- 바깥에서 부르는 함수 ---------------- */
  function show() {
    build();
    paintGate();
    if (signedIn() && myGrade() >= minGrade()) load();
    else if (signedIn()) paintGate();
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
    if (signedIn() && myGrade() >= minGrade()) {
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
        if (signedIn() && myGrade() >= minGrade()) load();
        else { state.rows = []; paintBoard(); paintCounts(); }
      });
    }
    if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
      window.CRAFT_I18N.onChange(function () { refresh(); });
    }
  }

  window.CRAFT_TASKS = { show: show, refresh: refresh, reload: load, signedIn: signedIn };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
