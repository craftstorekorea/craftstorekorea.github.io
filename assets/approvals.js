/* ===== SBPress v4.0 · 내부 전자결재 (assets/approvals.js) =====
   - #/approvals 화면. 로그아웃 상태에서는 로그인 안내만 보입니다(헤더 메뉴에서도 숨김).
   - 기안 작성(양식 선택 · 제목/본문/양식별 항목/첨부 링크 · 1차/최종 결재선) → 상신
   - 결재함 탭: 결재 대기(내 차례) · 내가 올린 기안 · 완료·반려함 · 전체(관리자)
   - 결재 처리: 지금 차례인 결재자만 승인/반려(사유 필수). 회수는 기안자가 아무도 처리하지 않았을 때만.
   - 자료: public.approval_forms / approval_docs / approval_steps / approval_logs
     쓰기는 서버 함수(RPC)만 — approval_create · approval_submit · approval_act · approval_withdraw
   - SQL 미실행이면 "결재 표가 아직 없습니다 + 실행 안내" 만 보이고 화면은 깨지지 않습니다.
   의존: assets/i18n.js, assets/auth.js(세션·프로필)
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

  /* ---------------- 세션 ---------------- */
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
  function myId() { var u = me(); return u ? u.id : null; }
  function isAdmin() { return !!state.isAdmin; }

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

  /* ---------------- 상태 ---------------- */
  var state = {
    forms: [],
    people: [],
    docs: [],
    steps: {},
    logs: {},
    tab: "inbox",
    q: "",
    doc: null,
    composing: false,
    loading: false,
    missing: false,
    isAdmin: false,
    booted: false,
    built: false
  };

  var STATUSES = ["draft", "pending", "approved", "rejected", "canceled"];
  var DONE_STATES = ["approved", "rejected", "canceled"];
  function statusKey(s) { return "appr.badge." + (STATUSES.indexOf(s) >= 0 ? s : "pending"); }
  function stepKey(s) { return "appr.stepState." + (s || "waiting"); }

  function shortErr(r) {
    var m = (r && r.data && r.data.message) || (r && r.text) || "";
    return String(m).slice(0, 200);
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return fmtDate(iso) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------------- 게이트 ---------------- */
  function paintGate() {
    var gate = $("#appr-gate"), app = $("#appr-app"), head = $("#appr-head");
    if (!gate || !app) return;
    var ok = signedIn();
    if (head) head.hidden = !ok;
    if (!ok) {
      gate.hidden = false;
      app.hidden = true;
      gate.innerHTML =
        '<div class="appr-gate-card">' +
          '<span class="appr-gate-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2.4"/><path d="M8 10V7.6a4 4 0 0 1 8 0V10"/></svg>' +
          "</span>" +
          "<h3>" + esc(I("appr.gate.title")) + "</h3>" +
          "<p>" + esc(I("appr.gate.desc")) + "</p>" +
          '<button type="button" class="btn btn-primary btn-sm" id="appr-login">' + esc(I("appr.gate.btn")) + "</button>" +
        "</div>";
      var btn = $("#appr-login");
      if (btn) btn.addEventListener("click", function () {
        if (window.CRAFT_AUTH) window.CRAFT_AUTH.openLogin();
      });
      return;
    }
    gate.hidden = true;
    app.hidden = false;
  }

  function setMsg(text, kind) {
    var el = $("#appr-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "appr-msg" + (kind ? " " + kind : "");
  }

  function paintNotice() {
    var box = $("#appr-notice");
    if (!box) return;
    if (!state.missing) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML =
      '<strong>' + esc(I("appr.notice.missing.title")) + "</strong>" +
      "<span>" + esc(I("appr.notice.missing.desc")) + "</span>" +
      '<code>supabase/15_v40_approvals.sql</code>';
  }

  /* ---------------- 읽기 ---------------- */
  function loadForms() {
    return request("approval_forms?select=*&order=sort_order.asc,code.asc").then(function (r) {
      if (!r.ok) { state.missing = (r.status === 404 || r.status === 400); state.forms = []; return r; }
      state.forms = Array.isArray(r.data) ? r.data.filter(function (f) { return f.active !== false; }) : [];
      state.missing = false;
      return r;
    });
  }
  function loadPeople() {
    return rpc("approval_people").then(function (r) {
      state.people = (r.ok && Array.isArray(r.data)) ? r.data : [];
      return r;
    });
  }
  function loadDocs() {
    state.loading = true;
    return request("approval_docs?select=*&order=created_at.desc&limit=200").then(function (r) {
      state.loading = false;
      if (!r.ok) {
        state.docs = [];
        if (r.status === 404 || r.status === 400) state.missing = true;
        paintNotice();
        paintList();
        setMsg((r.status === 401 || r.status === 403) ? I("appr.msg.login") : I("appr.load.fail") + shortErr(r), "err");
        return r;
      }
      state.docs = Array.isArray(r.data) ? r.data : [];
      return loadSteps().then(function () { return r; });
    });
  }
  function loadSteps() {
    return request("approval_steps?select=*&order=doc_id.asc,step_order.asc&limit=2000").then(function (r) {
      var map = {};
      if (r.ok && Array.isArray(r.data)) {
        r.data.forEach(function (s) {
          (map[s.doc_id] = map[s.doc_id] || []).push(s);
        });
      }
      state.steps = map;
      paintList();
      return r;
    });
  }
  function loadLogs(docId) {
    return request("approval_logs?select=*&doc_id=eq." + encodeURIComponent(docId) +
                   "&order=created_at.desc&limit=100").then(function (r) {
      state.logs[docId] = (r.ok && Array.isArray(r.data)) ? r.data : [];
      return r;
    });
  }

  /* ---------------- 목록 ---------------- */
  function stepsOf(doc) { return state.steps[doc.id] || []; }
  function myTurn(doc) {
    if (!doc || doc.status !== "pending") return null;
    var uid = myId();
    if (!uid) return null;
    var list = stepsOf(doc);
    for (var i = 0; i < list.length; i++) {
      if (list[i].step_order === doc.current_step && list[i].approver_id === uid && list[i].status === "pending") return list[i];
    }
    return null;
  }
  function isMine(doc) { return !!doc && doc.drafter_id === myId(); }
  function acted(doc) {
    return stepsOf(doc).some(function (s) { return s.status === "approved" || s.status === "rejected"; });
  }
  function isApprover(doc) {
    var uid = myId();
    return stepsOf(doc).some(function (s) { return s.approver_id === uid; });
  }

  function visibleDocs() {
    var uid = myId();
    var q = state.q.trim().toLowerCase();
    return state.docs.filter(function (d) {
      var mine = d.drafter_id === uid;
      var mineTurn = !!myTurn(d);
      if (state.tab === "inbox" && !mineTurn) return false;
      if (state.tab === "mine" && !mine) return false;
      if (state.tab === "done" && (DONE_STATES.indexOf(d.status) < 0 || !(mine || isApprover(d)))) return false;
      if (state.tab === "all" && !isAdmin()) return false;
      if (q && [d.doc_no, d.title, d.drafter_name, formName(d, false)].join(" ").toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function formOf(doc) {
    if (!doc) return null;
    for (var i = 0; i < state.forms.length; i++) if (state.forms[i].id === doc.form_id) return state.forms[i];
    for (var j = 0; j < state.forms.length; j++) if (state.forms[j].code === doc.form_code) return state.forms[j];
    return null;
  }
  function formName(doc, en) {
    var f = formOf(doc);
    if (f) return (en === false ? f.name : (isEn() ? (f.name_en || f.name) : f.name)) || f.code;
    return doc.form_code || "";
  }
  function isEn() {
    return !!(window.CRAFT_I18N && window.CRAFT_I18N.lang && window.CRAFT_I18N.lang() === "en");
  }

  function nextLabel(doc) {
    var list = stepsOf(doc);
    for (var i = 0; i < list.length; i++) {
      if (list[i].step_order === doc.current_step) return I("appr.step.n", { n: list[i].step_order });
    }
    return I("appr.step.n", { n: doc.current_step || 1 });
  }

  function card(doc) {
    var turn = myTurn(doc);
    var list = stepsOf(doc);
    var done = list.filter(function (s) { return s.status === "approved"; }).length;
    return '<article class="appr-card' + (turn ? " is-turn" : "") + '" data-id="' + esc(doc.id) + '" tabindex="0">' +
      '<div class="appr-card-top">' +
        '<span class="appr-no">' + esc(doc.doc_no || "") + "</span>" +
        '<span class="appr-form-badge">' + esc(formName(doc, false)) + "</span>" +
        '<span class="pill st-' + esc(doc.status) + '">' + esc(I(statusKey(doc.status))) + "</span>" +
      "</div>" +
      '<h3 class="appr-card-title">' + esc(doc.title || "") + "</h3>" +
      '<div class="appr-card-meta">' +
        "<span>" + esc(I("appr.by")) + " <b>" + esc(doc.drafter_name || "") + "</b></span>" +
        "<span>" + esc(fmtDate(doc.submitted_at || doc.created_at)) + "</span>" +
        (doc.status === "pending" ? "<span class=\"appr-turn\">" + esc(I("appr.waitFor", { step: nextLabel(doc) })) + "</span>" : "") +
        (doc.status === "pending" ? "<span class=\"appr-progress\">" + esc(I("appr.progress", { done: done, total: list.length })) + "</span>" : "") +
        (turn ? "<span class=\"appr-turn-mine\">" + esc(I("appr.turn.mine")) + "</span>" : "") +
      "</div>" +
    "</article>";
  }

  function paintList() {
    var box = $("#appr-list");
    if (!box) return;
    var rows = visibleDocs();
    var emptyKey = "appr.empty." + state.tab;
    if (state.loading && !state.docs.length) {
      box.innerHTML = '<p class="appr-empty">' + esc(I("appr.loading")) + "</p>";
      return;
    }
    box.innerHTML = rows.length ? rows.map(card).join("") :
      '<p class="appr-empty">' + esc(I(state.missing ? "appr.empty.missing" : emptyKey)) + "</p>";
    [].forEach.call(box.querySelectorAll(".appr-card"), function (el) {
      var open = function () { openDoc(el.getAttribute("data-id")); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    paintCounts();
  }

  function counts() {
    var uid = myId();
    return {
      inbox: state.docs.filter(function (d) { return !!myTurn(d); }).length,
      mine: state.docs.filter(function (d) { return d.drafter_id === uid; }).length,
      done: state.docs.filter(function (d) {
        return DONE_STATES.indexOf(d.status) >= 0 && (d.drafter_id === uid || isApprover(d));
      }).length,
      all: state.docs.length
    };
  }

  function paintTabs() {
    var box = $("#appr-tabs");
    if (!box) return;
    var n = counts();
    var tabs = [
      { k: "inbox", label: I("appr.tab.inbox") },
      { k: "mine", label: I("appr.tab.mine") },
      { k: "done", label: I("appr.tab.done") }
    ];
    if (isAdmin()) tabs.push({ k: "all", label: I("appr.tab.all") });
    if (tabs.every(function (t) { return t.k !== state.tab; })) state.tab = "inbox";
    box.innerHTML = tabs.map(function (t) {
      return '<button type="button" class="fchip" data-tab="' + t.k + '" aria-pressed="' +
        (state.tab === t.k ? "true" : "false") + '">' + esc(t.label) + "<i>" + (n[t.k] || 0) + "</i></button>";
    }).join("");
    [].forEach.call(box.querySelectorAll("[data-tab]"), function (b) {
      b.addEventListener("click", function () {
        state.tab = b.getAttribute("data-tab");
        paintTabs();
        paintList();
      });
    });
  }
  function paintCounts() {
    var sum = $("#appr-sum");
    if (sum) sum.textContent = I("appr.total", { n: visibleDocs().length });
  }

  /* ---------------- 상세 ---------------- */
  function fieldRows(doc) {
    var f = formOf(doc);
    var defs = (f && Array.isArray(f.fields)) ? f.fields : [];
    var vals = doc.fields || {};
    var out = [];
    defs.forEach(function (d) {
      var v = vals[d.key];
      if (v === undefined || v === null || v === "") return;
      out.push({ label: isEn() ? (d.label_en || d.label) : (d.label || d.key), value: v, type: d.type });
    });
    Object.keys(vals).forEach(function (k) {
      if (k === "attachment") return;
      if (defs.some(function (d) { return d.key === k; })) return;
      if (vals[k] === undefined || vals[k] === null || vals[k] === "") return;
      out.push({ label: k, value: vals[k] });
    });
    return out;
  }

  function stepLine(doc) {
    var list = stepsOf(doc);
    if (!list.length) return '<p class="appr-empty sm">' + esc(I("appr.detail.noSteps")) + "</p>";
    return '<ol class="appr-line">' + list.map(function (s) {
      return '<li class="appr-step is-' + esc(s.status) + '">' +
        '<span class="appr-step-dot" aria-hidden="true"></span>' +
        '<div class="appr-step-body">' +
          '<div class="appr-step-head">' +
            "<b>" + esc(I("appr.step.n", { n: s.step_order })) + "</b>" +
            "<span>" + esc(s.approver_name || "") + "</span>" +
            '<span class="pill st-' + esc(s.status) + '">' + esc(I(stepKey(s.status))) + "</span>" +
          "</div>" +
          (s.acted_at ? '<p class="appr-step-when">' + esc(fmtTime(s.acted_at)) + "</p>" : "") +
          (s.comment ? '<p class="appr-step-note">' + esc(s.comment) + "</p>" : "") +
        "</div></li>";
    }).join("") + "</ol>";
  }

  function logLine(l) {
    return "<li>" +
      '<span class="appr-log-t">' + esc(fmtTime(l.created_at)) + "</span>" +
      '<span class="appr-log-a">' + esc(l.actor_name || "") + "</span>" +
      '<span class="appr-log-x">' + esc(I("appr.log." + l.action)) + "</span>" +
      (l.comment ? '<span class="appr-log-c">' + esc(l.comment) + "</span>" : "") +
      "</li>";
  }

  function paintDoc() {
    var doc = state.doc;
    var box = $("#appr-modal");
    if (!box || !doc) return;
    var turn = myTurn(doc);
    var canWithdraw = isMine(doc) && (doc.status === "draft" || (doc.status === "pending" && !acted(doc)));
    var rows = fieldRows(doc);
    var attach = (doc.fields || {}).attachment || "";
    var logs = state.logs[doc.id] || [];
    box.hidden = false;
    box.querySelector(".appr-modal-body").innerHTML =
      '<div class="appr-doc-head">' +
        '<div><span class="appr-no">' + esc(doc.doc_no || "") + "</span>" +
        '<span class="appr-form-badge">' + esc(formName(doc, false)) + "</span>" +
        '<span class="pill st-' + esc(doc.status) + '">' + esc(I(statusKey(doc.status))) + "</span></div>" +
        '<button type="button" class="appr-x" id="appr-close" aria-label="' + esc(I("appr.close")) + '">×</button>' +
      "</div>" +
      "<h2>" + esc(doc.title || "") + "</h2>" +
      '<dl class="appr-meta">' +
        "<div><dt>" + esc(I("appr.meta.drafter")) + "</dt><dd>" + esc(doc.drafter_name || "") + "</dd></div>" +
        "<div><dt>" + esc(I("appr.meta.created")) + "</dt><dd>" + esc(fmtDate(doc.created_at)) + "</dd></div>" +
        "<div><dt>" + esc(I("appr.meta.submitted")) + "</dt><dd>" + esc(doc.submitted_at ? fmtTime(doc.submitted_at) : I("appr.meta.draft")) + "</dd></div>" +
        "<div><dt>" + esc(I("appr.meta.status")) + "</dt><dd>" + esc(I(statusKey(doc.status))) + "</dd></div>" +
        "<div><dt>" + esc(I("appr.meta.current")) + "</dt><dd>" +
          (doc.status === "pending" ? esc(I("appr.step.n", { n: doc.current_step || 1 })) :
           doc.status === "draft" ? esc(I("appr.meta.draft")) :
           esc(I(statusKey(doc.status)))) + "</dd></div>" +
      "</dl>" +
      (rows.length ? '<table class="appr-fields"><tbody>' + rows.map(function (r) {
        return "<tr><th>" + esc(r.label) + "</th><td>" + esc(r.value) + "</td></tr>";
      }).join("") + "</tbody></table>" : "") +
      (attach ? '<p class="appr-attach">' + esc(I("appr.meta.attach")) + ": " +
        (/^https?:\/\//i.test(attach) ? '<a href="' + esc(attach) + '" target="_blank" rel="noopener">' + esc(attach) + "</a>" : esc(attach)) + "</p>" : "") +
      '<h3 class="appr-h3">' + esc(I("appr.detail.body")) + "</h3>" +
      '<div class="appr-body">' + (doc.body ? esc(doc.body) : '<span class="muted">' + esc(I("appr.detail.noBody")) + "</span>") + "</div>" +
      '<h3 class="appr-h3">' + esc(I("appr.detail.line")) + "</h3>" +
      stepLine(doc) +
      '<h3 class="appr-h3">' + esc(I("appr.detail.logs")) + "</h3>" +
      (logs.length ? '<ul class="appr-logs">' + logs.map(logLine).join("") + "</ul>"
                   : '<p class="appr-empty sm">' + esc(I("appr.detail.noLogs")) + "</p>") +
      '<div class="appr-actions">' +
        (turn ? '<button type="button" class="btn btn-primary btn-sm" id="appr-approve">' + esc(I("appr.approve")) + "</button>" +
                '<button type="button" class="btn btn-ghost btn-sm danger" id="appr-reject">' + esc(I("appr.reject")) + "</button>" : "") +
        (doc.status === "draft" && isMine(doc) ? '<button type="button" class="btn btn-primary btn-sm" id="appr-submit-draft">' + esc(I("appr.submit")) + "</button>" : "") +
        (canWithdraw ? '<button type="button" class="btn btn-ghost btn-sm" id="appr-withdraw">' + esc(I("appr.withdraw")) + "</button>" : "") +
        '<button type="button" class="btn btn-ghost btn-sm" id="appr-close-2">' + esc(I("appr.close")) + "</button>" +
      "</div>" +
      '<div class="appr-reject-box" id="appr-reject-box" hidden>' +
        '<label for="appr-reject-note">' + esc(I("appr.reject.ask")) + "</label>" +
        '<textarea id="appr-reject-note" rows="2" placeholder="' + esc(I("appr.reject.ph")) + '"></textarea>' +
        '<div class="appr-reject-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="appr-reject-cancel">' + esc(I("appr.cancel")) + "</button>" +
          '<button type="button" class="btn btn-primary btn-sm danger" id="appr-reject-send">' + esc(I("appr.reject.send")) + "</button>" +
        "</div>" +
      "</div>";

    var close = function () { box.hidden = true; state.doc = null; };
    $("#appr-close").addEventListener("click", close);
    $("#appr-close-2").addEventListener("click", close);
    var ap = $("#appr-approve");
    if (ap) ap.addEventListener("click", function () { act("approve", null); });
    var rj = $("#appr-reject");
    if (rj) rj.addEventListener("click", function () {
      var rb = $("#appr-reject-box");
      rb.hidden = !rb.hidden;
      var ta = $("#appr-reject-note");
      if (ta) ta.focus();
    });
    var rc = $("#appr-reject-cancel");
    if (rc) rc.addEventListener("click", function () { $("#appr-reject-box").hidden = true; });
    var rs = $("#appr-reject-send");
    if (rs) rs.addEventListener("click", function () {
      var ta = $("#appr-reject-note");
      var note = (ta.value || "").trim();
      if (!note) { setMsg(I("appr.reject.need"), "err"); ta.focus(); return; }
      act("reject", note);
    });
    var sd = $("#appr-submit-draft");
    if (sd) sd.addEventListener("click", function () {
      busy(function () { return rpc("approval_submit", { p_doc_id: doc.id }); }, "appr.msg.submitted");
    });
    var wd = $("#appr-withdraw");
    if (wd) wd.addEventListener("click", function () {
      if (!window.confirm(I("appr.confirm.withdraw"))) return;
      busy(function () { return rpc("approval_withdraw", { p_doc_id: doc.id }); }, "appr.msg.withdrawn");
    });
  }

  function busy(fn, okKey) {
    setMsg("");
    fn().then(function (r) {
      if (!r.ok) {
        setMsg(/permission|row-level|42501|권한|결재자/i.test(r.text) ? I("appr.msg.notAllowed") + shortErr(r)
                                                                       : I("appr.msg.fail") + shortErr(r), "err");
        return;
      }
      setMsg(I(okKey), "ok");
      var id = state.doc && state.doc.id;
      return refreshAll().then(function () {
        if (id) {
          var keep = state.docs.filter(function (d) { return d.id === id; })[0];
          if (keep) return openDoc(id, true);
        }
      });
    }).catch(function () { setMsg(I("appr.msg.fail") + "network", "err"); });
  }

  function act(action, note) {
    var doc = state.doc;
    if (!doc) return;
    busy(function () {
      return rpc("approval_act", { p_doc_id: doc.id, p_action: action, p_comment: note });
    }, action === "approve" ? "appr.msg.approved" : "appr.msg.rejected");
  }

  function openDoc(id, quiet) {
    var doc = null;
    for (var i = 0; i < state.docs.length; i++) if (state.docs[i].id === id) { doc = state.docs[i]; break; }
    if (!doc) {
      return request("approval_docs?select=*&id=eq." + encodeURIComponent(id)).then(function (r) {
        if (!r.ok || !Array.isArray(r.data) || !r.data.length) { setMsg(I("appr.load.fail"), "err"); return; }
        state.docs.unshift(r.data[0]);
        return openDoc(id, quiet);
      });
    }
    state.doc = doc;
    var ready = loadLogs(doc.id);
    if (!stepsOf(doc).length) ready = ready.then(function () { return loadSteps(); });
    return ready.then(function () {
      paintDoc();
      if (!quiet) rpc("approval_touch_view", { p_doc_id: doc.id }).catch(function () {});
    });
  }

  /* ---------------- 기안 작성 ---------------- */
  function peopleOptions(selected) {
    var opts = ['<option value="">' + esc(I("appr.form.none")) + "</option>"];
    state.people.forEach(function (p) {
      if (!p || !p.id) return;
      if (p.id === myId()) return;   // 기안자 본인은 결재선에서 뺍니다.
      opts.push('<option value="' + esc(p.id) + '"' + (selected === p.id ? " selected" : "") + ">" +
        esc(p.name || "") + "</option>");
    });
    return opts.join("");
  }

  function fieldInput(def) {
    var id = "af-" + def.key;
    var label = '<span class="appr-f-label">' + esc(isEn() ? (def.label_en || def.label) : (def.label || def.key)) +
      (def.required ? " *" : "") + "</span>";
    var ph = def.placeholder ? ' placeholder="' + esc(def.placeholder) + '"' : "";
    var input;
    if (def.type === "number") input = '<input type="number" step="any" id="' + esc(id) + '" data-akey="' + esc(def.key) + '"' + ph + ">";
    else if (def.type === "date") input = '<input type="date" id="' + esc(id) + '" data-akey="' + esc(def.key) + '">';
    else if (def.type === "select") {
      var opts = ['<option value="">—</option>'].concat((def.options || []).map(function (o) {
        return '<option value="' + esc(o) + '">' + esc(o) + "</option>";
      }));
      input = '<select id="' + esc(id) + '" data-akey="' + esc(def.key) + '">' + opts.join("") + "</select>";
    } else if (def.type === "file") input = '<input type="url" id="' + esc(id) + '" data-akey="' + esc(def.key) + '"' + ph + ">";
    else input = '<input type="text" id="' + esc(id) + '" data-akey="' + esc(def.key) + '"' + ph + ">";
    return '<label class="appr-f' + (def.type === "file" ? " appr-f-wide" : "") + '">' + label + input + "</label>";
  }

  function paintFields() {
    var box = $("#appr-fields");
    if (!box) return;
    var sel = $("#appr-form-select");
    var form = null;
    for (var i = 0; i < state.forms.length; i++) if (state.forms[i].id === sel.value) form = state.forms[i];
    var defs = (form && Array.isArray(form.fields)) ? form.fields : [];
    box.innerHTML = defs.length ? defs.map(fieldInput).join("") :
      '<p class="appr-hint">' + esc(I("appr.form.noFields")) + "</p>";
  }

  function openCompose() {
    var form = $("#appr-compose");
    if (!form) return;
    if (!state.forms.length) { setMsg(I("appr.form.noneForms"), "err"); return; }
    state.composing = true;
    form.hidden = false;
    $("#appr-form-select").innerHTML = state.forms.map(function (f) {
      return '<option value="' + esc(f.id) + '">' + esc(isEn() ? (f.name_en || f.name) : f.name) + "</option>";
    }).join("");
    $("#appr-doc-title").value = "";
    $("#appr-body").value = "";
    $("#appr-attach").value = "";
    $("#appr-approver-1").innerHTML = peopleOptions(null);
    $("#appr-approver-2").innerHTML = peopleOptions(null);
    paintFields();
    setMsg("");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () { var t = $("#appr-doc-title"); if (t) t.focus(); }, 40);
  }
  function closeCompose() {
    var form = $("#appr-compose");
    if (form) form.hidden = true;
    state.composing = false;
  }

  function collect() {
    var fields = {};
    [].forEach.call($$("#appr-fields [data-akey]"), function (el) {
      var v = String(el.value || "").trim();
      if (v !== "") fields[el.getAttribute("data-akey")] = el.value;
    });
    var attach = ($("#appr-attach").value || "").trim();
    if (attach) fields.attachment = attach;
    var a1 = $("#appr-approver-1").value;
    var a2 = $("#appr-approver-2").value;
    var approvers = [];
    if (a1) approvers.push(a1);
    if (a2 && a2 !== a1) approvers.push(a2);
    return {
      form_id: $("#appr-form-select").value,
      title: ($("#appr-doc-title").value || "").trim(),
      body: ($("#appr-body").value || "").trim(),
      fields: fields,
      approvers: approvers
    };
  }

  function submitCompose(send) {
    var d = collect();
    if (!d.title) { setMsg(I("appr.form.needTitle"), "err"); $("#appr-doc-title").focus(); return; }
    if (!d.approvers.length) { setMsg(I("appr.form.needApprover"), "err"); $("#appr-approver-1").focus(); return; }
    var btn = $("#appr-save");
    if (btn) btn.disabled = true;
    rpc("approval_create", {
      p_form_id: d.form_id, p_title: d.title, p_body: d.body,
      p_fields: d.fields, p_approvers: d.approvers, p_submit: !!send
    }).then(function (r) {
      if (btn) btn.disabled = false;
      if (!r.ok) { setMsg(I("appr.msg.fail") + shortErr(r), "err"); return; }
      closeCompose();
      setMsg(I(send ? "appr.msg.submitted" : "appr.msg.drafted"), "ok");
      state.tab = "mine";
      refreshAll().then(function () {
        var id = r.data && r.data.id;
        if (id) openDoc(id, true);
      });
    }).catch(function () {
      if (btn) btn.disabled = false;
      setMsg(I("appr.msg.fail") + "network", "err");
    });
  }

  /* ---------------- 새로고침 ---------------- */
  function refreshAll() {
    if (!signedIn()) { paintGate(); return Promise.resolve(); }
    return loadForms().then(function () {
      paintNotice();
      if (state.missing) { paintList(); paintTabs(); return; }
      return loadPeople().then(function () { return loadDocs(); });
    }).then(function () {
      paintTabs();
      paintList();
    });
  }

  /* ---------------- 뼈대 ---------------- */
  function build() {
    var app = $("#appr-app");
    if (!app || state.built) return;
    state.built = true;
    app.innerHTML =
      '<div class="appr-notice" id="appr-notice" hidden></div>' +
      '<div class="appr-bar">' +
        '<div class="appr-tabs" id="appr-tabs" role="group"></div>' +
        '<div class="appr-search"><label class="search">' +
          '<svg width="16" height="16" aria-hidden="true"><use href="#i-search"/></svg>' +
          '<input type="search" id="appr-q" data-i18n-ph="appr.q" autocomplete="off">' +
        "</label></div>" +
        '<button type="button" class="btn btn-primary btn-sm" id="appr-new" data-i18n="appr.new"></button>' +
      "</div>" +
      '<form class="appr-compose" id="appr-compose" hidden novalidate>' +
        '<div class="appr-compose-head"><h3 data-i18n="appr.form.title"></h3>' +
          '<button type="button" class="appr-x" id="appr-form-x" aria-label="close">×</button></div>' +
        '<div class="appr-compose-grid">' +
          '<label class="appr-f"><span class="appr-f-label" data-i18n="appr.form.form"></span>' +
            '<select id="appr-form-select"></select></label>' +
          '<label class="appr-f appr-f-wide"><span class="appr-f-label" data-i18n="appr.form.titlefield"></span>' +
            '<input id="appr-doc-title" maxlength="200" data-i18n-ph="appr.form.titlePh"></label>' +
          '<div class="appr-fieldset" id="appr-fields"></div>' +
          '<label class="appr-f appr-f-wide"><span class="appr-f-label" data-i18n="appr.form.attach"></span>' +
            '<input id="appr-attach" type="url" data-i18n-ph="appr.form.attachPh"></label>' +
          '<label class="appr-f appr-f-wide"><span class="appr-f-label" data-i18n="appr.form.body"></span>' +
            '<textarea id="appr-body" rows="4" data-i18n-ph="appr.form.bodyPh"></textarea></label>' +
          '<label class="appr-f"><span class="appr-f-label" data-i18n="appr.form.approver1"></span>' +
            '<select id="appr-approver-1"></select></label>' +
          '<label class="appr-f"><span class="appr-f-label" data-i18n="appr.form.approver2"></span>' +
            '<select id="appr-approver-2"></select></label>' +
        "</div>" +
        '<div class="appr-compose-foot">' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="appr-form-cancel" data-i18n="appr.cancel"></button>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="appr-draft" data-i18n="appr.form.draft"></button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="appr-save" data-i18n="appr.form.submit"></button>' +
        "</div>" +
      "</form>" +
      '<p class="appr-msg" id="appr-msg" role="status" aria-live="polite"></p>' +
      '<div class="appr-list" id="appr-list"></div>' +
      '<div class="appr-modal" id="appr-modal" hidden role="dialog" aria-modal="true">' +
        '<div class="appr-modal-card"><div class="appr-modal-body"></div></div>' +
      "</div>";

    $("#appr-new").addEventListener("click", openCompose);
    $("#appr-form-x").addEventListener("click", closeCompose);
    $("#appr-form-cancel").addEventListener("click", closeCompose);
    $("#appr-form-select").addEventListener("change", paintFields);
    $("#appr-draft").addEventListener("click", function () { submitCompose(false); });
    $("#appr-save").addEventListener("click", function () { submitCompose(true); });
    var q = $("#appr-q");
    if (q) q.addEventListener("input", function () { state.q = q.value; paintList(); });
    $("#appr-modal").addEventListener("click", function (e) {
      if (e.target && e.target.id === "appr-modal") { $("#appr-modal").hidden = true; state.doc = null; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#appr-modal").hidden) { $("#appr-modal").hidden = true; state.doc = null; }
      else if (!$("#appr-compose").hidden) closeCompose();
    });
    if (window.CRAFT_I18N) window.CRAFT_I18N.apply(app);
  }

  function refresh() {
    build();
    var head = $("#appr-head");
    if (head) {
      var eb = $("#appr-eyebrow"), ti = $("#appr-title"), de = $("#appr-desc");
      if (eb) eb.textContent = I("appr.eyebrow");
      if (ti) ti.textContent = I("appr.title");
      if (de) de.textContent = I("appr.desc");
    }
    paintGate();
    if (signedIn()) {
      paintTabs();
      paintList();
      if (state.doc) paintDoc();
      if (state.composing) { /* 언어가 바뀌면 입력값은 그대로 두고 라벨만 다시 그립니다 */ }
    }
  }

  function show() {
    build();
    paintGate();
    if (!signedIn()) return;
    refreshAll();
  }

  function boot() {
    if (state.booted) return;
    if (window.SBP && window.SBP.feature && !window.SBP.feature("approvals")) return;
    state.booted = true;
    build();
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
      window.CRAFT_AUTH.onChange(function () {
        paintGate();
        if (signedIn()) { refreshAll(); }
        else { state.docs = []; state.steps = {}; state.doc = null; paintList(); paintTabs(); }
      });
    }
    if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
      window.CRAFT_I18N.onChange(function () { refresh(); });
    }
    /* 관리자 여부 — 실패해도 화면은 그대로(전체 탭만 숨김) */
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
      window.CRAFT_AUTH.onChange(function () {
        if (!signedIn()) { state.isAdmin = false; return; }
        rpc("is_admin").then(function (r) {
          state.isAdmin = !!(r.ok && r.data === true);
          paintTabs();
          paintList();
        }).catch(function () { state.isAdmin = false; });
      });
    }
  }

  window.CRAFT_APPROVALS = {
    show: show, refresh: refresh, reload: function () { return refreshAll(); }, signedIn: signedIn
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
