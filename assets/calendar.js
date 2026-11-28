/* ===== 전국공방 · 통합 캘린더 (assets/calendar.js) =====
   SBPress v10.16 — #/calendar
   - 일감 마감일(issues.due_on) · 반복 일감(issues.next_run_at) · 예약(reservations.slot_date)을
     한 달력(월간 · 주간)에 유형별 색 배지로 그립니다.
   - PC 에서는 배지를 다른 날짜 칸으로 끌어 옮기면 곧바로 저장(PATCH issues).
     모바일·키보드에는 같은 일을 하는 길을 둡니다 — 배지를 눌러 날짜를 고르거나,
     초점을 두고 ←/→(하루) · Shift+←/→(한 주)로 옮깁니다.
   - 읽고 쓰는 권한은 서버 RLS 가 정합니다: 담당자·작성자·프로젝트 관리자만 마감일을 고칩니다.
   의존: assets/i18n.js, assets/auth.js(세션)
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

  /* ---------------- 날짜 ---------------- */
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
  function weekStart(v) { return addDays(v, -((dowOf(v) + 6) % 7)); }   /* 월요일 시작 */
  function monthStart(v) { return String(v).slice(0, 7) + "-01"; }
  function monthShift(v, n) {
    var p = String(v).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1 + n, 1));
    var z = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1);
  }
  function shortDate(v) { return String(v).slice(5).replace("-", "."); }
  function monthLabel(v) {
    var p = String(v).split("-");
    return I("cal.monthLabel", { y: p[0], m: +p[1] });
  }

  var C = {
    built: false, loading: false, error: "", loadedFor: "",
    view: "month", cursor: "", items: [], types: { issue: true, recur: true, rsv: true },
    drag: null, pop: null
  };

  function calMsg(text, kind) {
    var el = $("#cal-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "cal-msg" + (kind ? " " + kind : "");
  }

  /* ---------------- 뼈대 ---------------- */
  function build() {
    var app = $("#cal-app");
    if (!app || C.built) return;
    C.built = true;
    app.innerHTML =
      '<div class="cal-bar">' +
        '<div class="cal-nav">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="cal-prev" aria-label="' + esc(I("cal.prev")) + '">‹</button>' +
          '<h3 class="cal-title" id="cal-title">–</h3>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="cal-next" aria-label="' + esc(I("cal.next")) + '">›</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="cal-today">' + esc(I("cal.today")) + "</button>" +
        "</div>" +
        '<div class="cal-views" role="group" aria-label="' + esc(I("cal.view.label")) + '">' +
          '<button type="button" class="fchip" data-cal-view="month" aria-pressed="true">' + esc(I("cal.view.month")) + "</button>" +
          '<button type="button" class="fchip" data-cal-view="week" aria-pressed="false">' + esc(I("cal.view.week")) + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="cal-legend">' +
        '<button type="button" class="cal-key is-issue" data-cal-type="issue" aria-pressed="true">' + esc(I("cal.legend.issue")) + "</button>" +
        '<button type="button" class="cal-key is-recur" data-cal-type="recur" aria-pressed="true">' + esc(I("cal.legend.recur")) + "</button>" +
        '<button type="button" class="cal-key is-rsv" data-cal-type="rsv" aria-pressed="true">' + esc(I("cal.legend.rsv")) + "</button>" +
        '<span class="cal-hint" id="cal-hint">' + esc(I("cal.hint")) + "</span>" +
      "</div>" +
      '<p class="cal-msg" id="cal-msg" role="status" aria-live="polite"></p>' +
      '<div id="cal-grid" class="cal-grid-wrap"></div>' +
      '<div class="cal-pop" id="cal-pop" hidden role="dialog" aria-modal="false" aria-labelledby="cal-pop-title">' +
        '<h4 id="cal-pop-title">–</h4>' +
        '<label class="cal-pop-f"><span>' + esc(I("cal.pickDate")) + "</span>" +
          '<input type="date" id="cal-pop-date"></label>' +
        '<div class="cal-pop-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" id="cal-pop-save">' + esc(I("cal.save")) + "</button>" +
          '<button type="button" class="btn btn-ghost btn-sm" id="cal-pop-cancel">' + esc(I("cal.cancel")) + "</button>" +
        "</div>" +
        '<a class="cal-pop-open" id="cal-pop-open" href="#">' + esc(I("cal.openIssue")) + " ›</a>" +
      "</div>";
    bind();
  }

  function bind() {
    var prev = $("#cal-prev"), next = $("#cal-next"), today = $("#cal-today");
    if (prev) prev.addEventListener("click", function () { shift(-1); });
    if (next) next.addEventListener("click", function () { shift(1); });
    if (today) today.addEventListener("click", function () { C.cursor = ""; render(true); });
    $$("[data-cal-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        C.view = b.getAttribute("data-cal-view");
        $$("[data-cal-view]").forEach(function (x) {
          x.setAttribute("aria-pressed", x.getAttribute("data-cal-view") === C.view ? "true" : "false");
        });
        render(true);
      });
    });
    $$("[data-cal-type]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-cal-type");
        C.types[t] = !C.types[t];
        b.setAttribute("aria-pressed", C.types[t] ? "true" : "false");
        paint();
      });
    });
    var save = $("#cal-pop-save");
    if (save) save.addEventListener("click", popSave);
    var cancel = $("#cal-pop-cancel");
    if (cancel) cancel.addEventListener("click", closePop);
    var dateInput = $("#cal-pop-date");
    if (dateInput) dateInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); popSave(); }
      if (e.key === "Escape") { e.preventDefault(); closePop(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && C.pop) closePop();
    });
  }

  /* ---------------- 범위 · 불러오기 ---------------- */
  function range() {
    if (C.view === "week") {
      var s = weekStart(C.cursor || todayKST());
      return { start: s, end: addDays(s, 6) };
    }
    var first = monthStart(C.cursor || todayKST());
    var start = weekStart(first);
    return { start: start, end: addDays(start, 41) };
  }

  function load(force) {
    paintGate();
    if (!signedIn()) return Promise.resolve();
    var r = range();
    var key = r.start + "|" + r.end;
    if (C.loading) return Promise.resolve();
    if (!force && C.loadedFor === key) return Promise.resolve();
    C.loading = true;
    C.loadedFor = key;
    var grid = $("#cal-grid");
    if (grid && !C.items.length) grid.innerHTML = '<p class="desk-empty">' + esc(I("desk.loading")) + "</p>";
    return Promise.all([
      request("issues?select=id,issue_no,subject,status,priority,due_on,starts_on,assignee_id,project_id,recurrence,next_run_at" +
        "&due_on=gte." + r.start + "&due_on=lte." + r.end + "&order=due_on.asc&limit=500"),
      request("issues?select=id,issue_no,subject,status,priority,due_on,starts_on,assignee_id,project_id,recurrence,next_run_at" +
        "&recurrence=neq.none&limit=300"),
      request("reservations?select=id,code,slot_date,slot_time,name,status&slot_date=gte." + r.start +
        "&slot_date=lte." + r.end + "&order=slot_date.asc&limit=300")
    ]).then(function (res) {
      C.loading = false;
      var ir = res[0], rr = res[1], vr = res[2];
      if (!ir.ok && (ir.status === 404 || ir.status === 400)) {
        C.items = [];
        paintMissing();
        return;
      }
      var items = [];
      var seen = {};
      function pushIssue(it, kind, date) {
        if (!it || !it.id || !date) return;
        var k = it.id + "|" + kind + "|" + date;
        if (seen[k]) return;
        seen[k] = 1;
        items.push({
          kind: kind, id: it.id, date: date, no: it.issue_no, subject: it.subject,
          status: it.status, priority: it.priority, due: ymd(it.due_on), starts: ymd(it.starts_on)
        });
      }
      ((ir.ok && Array.isArray(ir.data)) ? ir.data : []).forEach(function (it) {
        pushIssue(it, "issue", ymd(it.due_on));
      });
      ((rr.ok && Array.isArray(rr.data)) ? rr.data : []).forEach(function (it) {
        var d = ymd(it.next_run_at);
        if (d && d >= r.start && d <= r.end) pushIssue(it, "recur", d);
      });
      ((vr && vr.ok && Array.isArray(vr.data)) ? vr.data : []).forEach(function (v) {
        var d = ymd(v.slot_date);
        if (!d) return;
        items.push({
          kind: "rsv", id: v.id, date: d, no: v.code || "",
          subject: [v.slot_time, v.name].filter(Boolean).join(" · ") || I("cal.legend.rsv"),
          status: v.status, priority: "normal"
        });
      });
      C.items = items;
      C.error = "";
      paint();
    }).catch(function (e) {
      C.loading = false;
      calMsg(I("cal.fail") + " " + (e && e.message ? e.message : e), "err");
    });
  }

  function paintMissing() {
    var grid = $("#cal-grid");
    if (grid) grid.innerHTML = '<p class="desk-empty">' + esc(I("desk.missing")) + "</p>";
  }
  function paintGate() {
    var gate = $("#cal-gate"), app = $("#cal-app"), head = $("#cal-head");
    if (!gate || !app) return;
    if (head) head.hidden = false;
    if (!signedIn()) {
      gate.hidden = false;
      app.hidden = true;
      gate.innerHTML =
        '<div class="tasks-gate-card">' +
          '<span class="tasks-gate-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>' +
          "</span>" +
          "<h3>" + esc(I("cal.gate.title")) + "</h3>" +
          "<p>" + esc(I("cal.gate.desc")) + "</p>" +
          '<button type="button" class="btn btn-primary btn-sm" id="cal-login">' + esc(I("desk.gate.btn")) + "</button>" +
        "</div>";
      var btn = $("#cal-login");
      if (btn) btn.addEventListener("click", function () {
        if (window.CRAFT_AUTH && window.CRAFT_AUTH.openLogin) window.CRAFT_AUTH.openLogin();
      });
      return;
    }
    gate.hidden = true;
    app.hidden = false;
    build();
  }

  /* ---------------- 그리기 ---------------- */
  function shift(n) {
    var base = C.cursor || todayKST();
    if (C.view === "week") C.cursor = addDays(weekStart(base), n * 7);
    else C.cursor = monthShift(monthStart(base), n) + "-01";
    render(true);
  }

  function render(force) {
    build();
    if (!signedIn()) { paintGate(); return; }
    var r = range();
    var title = $("#cal-title");
    if (title) {
      title.textContent = C.view === "week"
        ? I("cal.weekLabel", { a: shortDate(r.start), b: shortDate(r.end) })
        : monthLabel(monthStart(C.cursor || todayKST()));
    }
    load(force).then(function () { paint(); });
  }

  function visible(item) {
    return C.types[item.kind] !== false;
  }

  function chipHtml(item) {
    var cls = "cal-chip is-" + item.kind + (item.status === "closed" || item.status === "resolved" ? " is-done" : "");
    var label = item.kind === "rsv"
      ? item.subject
      : "#" + (item.no == null ? "" : item.no) + " " + (item.subject || "");
    var aria = item.kind === "rsv"
      ? I("cal.aria.rsv", { name: item.subject, date: item.date })
      : I("cal.aria.issue", { no: "#" + item.no, subject: item.subject, date: item.date });
    return '<button type="button" class="' + cls + '" data-cal-item="' + esc(item.id) + '" data-kind="' + esc(item.kind) +
      '" data-date="' + esc(item.date) + '" data-no="' + esc(item.no == null ? "" : item.no) +
      '" aria-label="' + esc(aria) + '">' + esc(label) + "</button>";
  }

  function paint() {
    var grid = $("#cal-grid");
    if (!grid || !signedIn()) return;
    if (!C.items.length && C.error) {
      grid.innerHTML = '<p class="desk-empty">' + esc(C.error) + "</p>";
      return;
    }
    var today = todayKST();
    var r = range();
    var html = "";
    var dows = [1, 2, 3, 4, 5, 6, 7].map(function (n) {
      return '<div class="cal-dow" role="columnheader">' + esc(I("cal.dow." + n)) + "</div>";
    }).join("");

    if (C.view === "week") {
      html = '<div class="cal-week" role="grid" aria-label="' + esc(I("cal.view.week")) + '">' +
        dows + Array.apply(null, { length: 7 }).map(function (_, n) {
          var day = addDays(r.start, n);
          var list = C.items.filter(function (it) { return it.date === day && visible(it); });
          return '<div class="cal-cell cal-week-cell' + (day === today ? " is-today" : "") + '" data-day="' + day +
            '" role="gridcell" tabindex="-1" aria-label="' + esc(I("cal.cell", { date: day, n: list.length })) + '">' +
            '<span class="cal-num">' + esc(shortDate(day)) + "</span>" +
            '<div class="cal-chips">' + list.map(chipHtml).join("") + "</div></div>";
        }).join("") + "</div>";
    } else {
      html = '<div class="cal-month" role="grid" aria-label="' + esc(I("cal.view.month")) + '">' + dows +
        Array.apply(null, { length: 42 }).map(function (_, n) {
          var day = addDays(r.start, n);
          var list = C.items.filter(function (it) { return it.date === day && visible(it); });
          var inMonth = day.slice(0, 7) === monthStart(C.cursor || todayKST()).slice(0, 7);
          return '<div class="cal-cell' + (inMonth ? "" : " is-out") + (day === today ? " is-today" : "") +
            '" data-day="' + day + '" role="gridcell" tabindex="-1" aria-label="' +
            esc(I("cal.cell", { date: day, n: list.length })) + '">' +
            '<span class="cal-num">' + esc(+(day.slice(8))) + "</span>" +
            '<div class="cal-chips">' + list.map(chipHtml).join("") + "</div></div>";
        }).join("") + "</div>";
    }
    grid.innerHTML = html;
    $$(".cal-chip", grid).forEach(bindChip);
  }

  /* ---------------- 배지: 끌기 · 키보드 · 날짜 고르기 ---------------- */
  function bindChip(chip) {
    var item = findItem(chip.getAttribute("data-cal-item"), chip.getAttribute("data-kind"), chip.getAttribute("data-date"));
    chip.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (item && item.kind !== "issue") return;   /* 예약·반복은 옮기지 않습니다 */
      C.drag = { chip: chip, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { chip.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      document.addEventListener("pointermove", onDragMove);
      document.addEventListener("pointerup", onDragUp);
    });
    chip.addEventListener("keydown", function (e) {
      if (!item || item.kind !== "issue") return;
      var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      move(item, addDays(item.date, n * (e.shiftKey ? 7 : 1)), chip);
    });
    chip.addEventListener("click", function (e) {
      if (C.drag && C.drag.moved) { e.preventDefault(); return; }
      if (!item) return;
      if (item.kind === "rsv") { openIssue(item); return; }
      openPop(item, chip);
    });
  }

  function findItem(id, kind, date) {
    for (var i = 0; i < C.items.length; i++) {
      var it = C.items[i];
      if (String(it.id) === String(id) && it.kind === kind && it.date === date) return it;
    }
    for (var j = 0; j < C.items.length; j++) {
      if (String(C.items[j].id) === String(id) && C.items[j].kind === kind) return C.items[j];
    }
    return null;
  }

  function onDragMove(e) {
    if (!C.drag) return;
    var dx = Math.abs(e.clientX - C.drag.x), dy = Math.abs(e.clientY - C.drag.y);
    if (!C.drag.moved && dx + dy < 8) return;
    C.drag.moved = true;
    C.drag.chip.classList.add("is-dragging");
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var cell = el && el.closest ? el.closest("[data-day]") : null;
    $$(".cal-cell").forEach(function (c) { c.classList.toggle("is-over", c === cell); });
    e.preventDefault();
  }

  function onDragUp(e) {
    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragUp);
    var d = C.drag;
    C.drag = null;
    if (!d) return;
    d.chip.classList.remove("is-dragging");
    $$(".cal-cell").forEach(function (c) { c.classList.remove("is-over"); });
    if (!d.moved) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var cell = el && el.closest ? el.closest("[data-day]") : null;
    if (!cell) return;
    var item = findItem(d.chip.getAttribute("data-cal-item"), "issue", d.chip.getAttribute("data-date"));
    if (!item) return;
    var day = cell.getAttribute("data-day");
    if (day === item.date) return;
    move(item, day, d.chip);
  }

  /* 날짜 고르기 — 모바일·키보드용. 배지를 누르면 열립니다. */
  function openPop(item, chip) {
    var pop = $("#cal-pop");
    if (!pop) return;
    C.pop = { item: item, chip: chip };
    var t = $("#cal-pop-title");
    if (t) t.textContent = "#" + (item.no == null ? "" : item.no) + " " + (item.subject || "");
    var d = $("#cal-pop-date");
    if (d) d.value = item.date;
    var open = $("#cal-pop-open");
    if (open) open.setAttribute("href", "#/tasks?issue=" + encodeURIComponent(item.id));
    pop.hidden = false;
    var rect = chip.getBoundingClientRect();
    pop.style.top = Math.max(8, rect.bottom + window.scrollY + 6) + "px";
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 268, rect.left + window.scrollX)) + "px";
    if (d) { try { d.focus(); } catch (e) { /* noop */ } }
  }

  function closePop() {
    var pop = $("#cal-pop");
    if (pop) pop.hidden = true;
    C.pop = null;
  }

  function popSave() {
    if (!C.pop) return;
    var d = $("#cal-pop-date");
    var day = d ? String(d.value || "") : "";
    var item = C.pop.item;
    closePop();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day === item.date) return;
    move(item, day, null);
  }

  function openIssue(item) {
    if (item.kind === "rsv") {
      location.hash = "#/lookup";
      return;
    }
    location.hash = "#/tasks?issue=" + encodeURIComponent(item.id);
  }

  /* ---------------- 저장 ---------------- */
  function move(item, day, chip) {
    if (!item || item.kind !== "issue") return;
    var body = { due_on: day };
    /* 기간이 있는 일감은 시작일도 같은 날수만큼 옮깁니다. */
    if (item.starts) {
      var delta = dayNumber(day) - dayNumber(item.date);
      body.starts_on = addDays(item.starts, delta);
    }
    if (chip) chip.classList.add("is-saving");
    request("issues?id=eq." + encodeURIComponent(item.id), {
      method: "PATCH", prefer: "return=representation", body: body
    }).then(function (r) {
      if (chip) chip.classList.remove("is-saving");
      if (!r.ok) {
        calMsg(I("cal.moveFail") + " " + String((r.data && r.data.message) || r.text || "").slice(0, 120), "err");
        return;
      }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;
      item.date = ymd((row && row.due_on) || day);
      item.due = item.date;
      if (row && row.starts_on) item.starts = ymd(row.starts_on);
      calMsg(I("cal.moved", { no: "#" + (item.no == null ? "" : item.no), date: item.date }), "ok");
      paint();
    }).catch(function () {
      if (chip) chip.classList.remove("is-saving");
      calMsg(I("cal.moveFail"), "err");
    });
  }

  /* ---------------- 보이기 ---------------- */
  function show() {
    paintGate();
    if (!signedIn()) return;
    build();
    if (!C.cursor) C.cursor = C.view === "week" ? todayKST() : monthStart(todayKST());
    render(false);
  }

  function refresh() {
    if (!signedIn()) { paintGate(); return Promise.resolve(); }
    build();
    C.loadedFor = "";
    return load(true);
  }

  /* 언어를 바꾸면 달력의 머리글·범례·안내도 그 언어로 다시 그립니다. */
  if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
    window.CRAFT_I18N.onChange(function () {
      var app = $("#cal-app");
      C.built = false;
      if (app) app.innerHTML = "";
      C.loadedFor = "";
      if ((location.hash || "").indexOf("#/calendar") === 0) { C.cursor = C.cursor || todayKST(); show(); }
    });
  }

  if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
    window.CRAFT_AUTH.onChange(function () {
      if (!signedIn()) {
        C.items = [];
        C.loadedFor = "";
        paintGate();
        return;
      }
      C.loadedFor = "";
      if ((location.hash || "").indexOf("#/calendar") === 0) show();
    });
  }

  window.CRAFT_CALENDAR = { show: show, refresh: function () { C.loadedFor = ""; return load(true); }, move: move };
})();
