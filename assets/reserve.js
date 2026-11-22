/* ===== SBPress v7.0 · 예약 · 설문 신청(#/reserve) · 접수번호 조회(#/lookup) =====
   - 로그인 없이 동작합니다(anon 키 + SECURITY DEFINER RPC).
   - create_reservation / lookup_reservation / list_open_slots — 19_v70 SQL 의 함수를 부릅니다.
   - SQL 을 실행하지 않았으면 "아직 준비되지 않았습니다 + 실행할 SQL 안내"만 보여 주고
     콘솔 오류를 내지 않습니다(폴백).
   - 진행 상태: 접수(submitted) → 확정(confirmed) → 완료(completed) / 취소(canceled)
   의존: assets/config.js (window.CRAFT_SUPABASE) · assets/i18n.js
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";

  function I(key, vars) {
    return window.CRAFT_I18N ? window.CRAFT_I18N.t(key, vars) : key;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isEn() { return !!(window.CRAFT_I18N && window.CRAFT_I18N.isEn && window.CRAFT_I18N.isEn()); }
  function $(sel, root) { return (root || document).querySelector(sel); }

  var state = {
    forms: [], form: null, slots: [], slot: null,
    missing: false, loaded: false, busy: false, lastCode: ""
  };

  function rest(path) {
    if (!API || !KEY) return Promise.reject(Object.assign(new Error("supabase_not_configured"), { status: 0 }));
    return fetch(API + "/rest/v1/" + path, {
      headers: { apikey: KEY, Accept: "application/json" }, cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint || data.details)) || ("HTTP " + r.status));
          err.status = r.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function rpc(name, body) {
    if (!API || !KEY) return Promise.reject(Object.assign(new Error("supabase_not_configured"), { status: 0 }));
    return fetch(API + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint || data.details)) || ("HTTP " + r.status));
          err.status = r.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function isMissing(err) {
    if (!err) return false;
    if (err.status === 404) return true;
    return /does not exist|find the (table|function)|schema cache|relation .* does not exist/i.test(String(err.message || ""));
  }

  function msg(text, kind) {
    var box = $("#rsv-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "rsv-msg" + (kind ? " is-" + kind : "");
    box.hidden = !text;
  }
  function lkMsg(text, kind) {
    var box = $("#lk-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "rsv-msg" + (kind ? " is-" + kind : "");
    box.hidden = !text;
  }

  function errText(err) {
    var code = String((err && (err.message || "")) || "");
    var map = {
      SLOT_FULL: "rsv.err.full", DUPLICATE: "rsv.err.dup", BAD_EMAIL: "rsv.err.email",
      BAD_NAME: "rsv.err.name", SLOT_CLOSED: "rsv.err.closed", SLOT_PAST: "rsv.err.past",
      FORM_CLOSED: "rsv.err.formClosed", SLOT_REQUIRED: "rsv.err.slot"
    };
    for (var k in map) if (code.indexOf(k) >= 0) return I(map[k]);
    return I("rsv.err.generic");
  }

  function fmtDate(d) {
    if (!d) return "";
    try {
      var dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString(isEn() ? "en-US" : "ko-KR",
        { month: "short", day: "numeric", weekday: "short" });
    } catch (e) { return d; }
  }

  function formTitle(f) {
    if (!f) return "";
    return isEn() ? (f.title_en || f.title) : (f.title || f.title_en);
  }
  function formDesc(f) {
    if (!f) return "";
    return isEn() ? (f.description_en || f.description) : (f.description || f.description_en);
  }

  function showEmpty(kind) {
    var empty = $("#rsv-empty");
    var body = $("#rsv-body");
    var done = $("#rsv-done");
    if (body) body.hidden = true;
    if (done) done.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.textContent = kind === "missing" ? I("rsv.notReady") : I("rsv.noForm");
    }
  }

  /* ---------------- 신청 화면 ---------------- */
  function loadForms() {
    rest("survey_forms?select=id,slug,kind,title,title_en,description,description_en,fields,is_active,sort_order&is_active=eq.true&kind=eq.reservation&order=sort_order.asc")
      .then(function (rows) {
        state.loaded = true;
        state.missing = false;
        state.forms = (rows || []).filter(function (f) { return f && f.is_active !== false; });
        if (!state.forms.length) { showEmpty("none"); return; }
        state.form = state.forms[0];
        renderForms();
        loadSlots();
      })
      .catch(function (err) {
        state.loaded = true;
        if (isMissing(err)) { state.missing = true; showEmpty("missing"); return; }
        showEmpty("none");
        if (window.console && err && err.status === 0) console.info("[reserve]", I("rsv.notReady"));
      });
  }

  function renderForms() {
    var box = $("#rsv-forms");
    if (!box) return;
    if (state.forms.length <= 1) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = state.forms.map(function (f) {
      return '<button type="button" class="rsv-form' + (state.form && f.id === state.form.id ? " is-on" : "") +
        '" data-form="' + esc(f.id) + '">' + esc(formTitle(f)) + "</button>";
    }).join("");
  }

  function loadSlots() {
    var body = $("#rsv-body"), empty = $("#rsv-empty");
    if (!state.form) return;
    var desc = $("#rsv-desc");
    if (desc) { desc.textContent = formDesc(state.form); desc.hidden = !formDesc(state.form); }
    if (body) body.hidden = false;
    if (empty) empty.hidden = true;
    var dates = $("#rsv-dates"), times = $("#rsv-times");
    if (dates) dates.innerHTML = '<p class="rsv-loading">' + esc(I("rsv.loading")) + "</p>";
    if (times) times.innerHTML = "";
    rpc("list_open_slots", { p_form_slug: state.form.slug })
      .then(function (rows) {
        state.slots = (rows || []).map(function (s) {
          return {
            id: s.slot_id || s.id, date: s.slot_date || s.date,
            time: s.slot_time || s.time || "", capacity: Number(s.capacity || 1),
            taken: Number(s.taken || 0)
          };
        });
        state.slot = null;
        renderSlots();
        renderExtra();
      })
      .catch(function (err) {
        state.slots = [];
        if (isMissing(err)) { state.missing = true; showEmpty("missing"); return; }
        renderSlots();
      });
  }

  function dates() {
    var out = [], seen = {};
    state.slots.forEach(function (s) {
      if (!s.date || seen[s.date]) return;
      seen[s.date] = 1; out.push(s.date);
    });
    return out;
  }

  function renderSlots() {
    var datesBox = $("#rsv-dates"), timesBox = $("#rsv-times");
    if (!datesBox || !timesBox) return;
    var ds = dates();
    if (!ds.length) {
      datesBox.innerHTML = '<p class="rsv-empty-line">' + esc(I("rsv.noSlot")) + "</p>";
      timesBox.innerHTML = "";
      return;
    }
    if (!state.pickedDate || ds.indexOf(state.pickedDate) < 0) state.pickedDate = ds[0];
    datesBox.innerHTML = ds.map(function (d) {
      return '<button type="button" class="rsv-date' + (d === state.pickedDate ? " is-on" : "") +
        '" data-date="' + esc(d) + '">' + esc(fmtDate(d)) + "</button>";
    }).join("");
    var list = state.slots.filter(function (s) { return s.date === state.pickedDate; });
    timesBox.innerHTML = list.map(function (s) {
      var left = Math.max(0, s.capacity - s.taken);
      var full = left <= 0;
      return '<button type="button" class="rsv-time' + (state.slot && s.id === state.slot.id ? " is-on" : "") +
        (full ? " is-full" : "") + '" data-slot="' + esc(s.id) + '"' + (full ? " disabled" : "") + ">" +
        "<b>" + esc(s.time || I("rsv.allday")) + "</b>" +
        '<em>' + esc(I("rsv.left", { n: left, cap: s.capacity })) + "</em></button>";
    }).join("");
  }

  function renderExtra() {
    var box = $("#rsv-extra");
    if (!box) return;
    var fields = (state.form && Array.isArray(state.form.fields)) ? state.form.fields : [];
    box.innerHTML = fields.map(function (f) {
      if (!f || !f.key) return "";
      var label = esc(isEn() ? (f.label_en || f.label) : (f.label || f.label_en));
      var ph = esc(f.placeholder || "");
      var req = f.required ? " required" : "";
      var id = "rsv-x-" + String(f.key).replace(/[^A-Za-z0-9_-]/g, "");
      if (f.type === "select") {
        var opts = (f.options || []).map(function (o) {
          var v = typeof o === "string" ? o : (o && (o.value || o.label)) || "";
          var lab = typeof o === "string" ? o : (o && (isEn() ? (o.label_en || o.label) : (o.label || o.label_en))) || v;
          return '<option value="' + esc(v) + '">' + esc(lab) + "</option>";
        }).join("");
        return '<label class="cms-field rsv-field"><span>' + label + '</span>' +
          '<select data-answer="' + esc(f.key) + '"' + req + ">" + opts + "</select></label>";
      }
      if (f.type === "textarea") {
        return '<label class="cms-field rsv-field"><span>' + label + '</span>' +
          '<textarea data-answer="' + esc(f.key) + '" rows="3" placeholder="' + ph + '"' + req + "></textarea></label>";
      }
      var type = (f.type === "number" || f.type === "date" || f.type === "email" || f.type === "tel") ? f.type : "text";
      return '<label class="cms-field rsv-field"><span>' + label + '</span>' +
        '<input id="' + id + '" type="' + type + '" data-answer="' + esc(f.key) + '" placeholder="' + ph + '"' + req + "></label>";
    }).join("");
  }

  function submit() {
    if (state.busy) return;
    if (!state.form) return;
    if (!state.slot) { msg(I("rsv.err.slot"), "err"); return; }
    var name = ($("#rsv-name") && $("#rsv-name").value || "").trim();
    var email = ($("#rsv-email") && $("#rsv-email").value || "").trim();
    var phone = ($("#rsv-phone") && $("#rsv-phone").value || "").trim();
    var memo = ($("#rsv-memo") && $("#rsv-memo").value || "").trim();
    if (!name) { msg(I("rsv.err.name"), "err"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg(I("rsv.err.email"), "err"); return; }
    var answers = {};
    [].forEach.call(document.querySelectorAll("#rsv-extra [data-answer]"), function (n) {
      answers[n.getAttribute("data-answer")] = n.value;
    });

    var btn = $("#rsv-submit");
    state.busy = true;
    if (btn) { btn.disabled = true; btn.textContent = I("rsv.sending"); }
    msg("");
    rpc("create_reservation", {
      p_form_slug: state.form.slug, p_slot_id: state.slot.id,
      p_name: name, p_email: email, p_phone: phone, p_memo: memo, p_answers: answers
    }).then(function (res) {
      state.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = I("rsv.submit"); }
      if (!res || res.ok === false) { msg(I("rsv.err.generic"), "err"); return; }
      state.lastCode = res.code || "";
      showDone(res);
    }).catch(function (err) {
      state.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = I("rsv.submit"); }
      if (isMissing(err)) { state.missing = true; showEmpty("missing"); return; }
      msg(errText(err), "err");
    });
  }

  function showDone(res) {
    state.lastResult = res;
    var body = $("#rsv-body"), done = $("#rsv-done");
    if (body) body.hidden = true;
    if (done) done.hidden = false;
    var codeEl = $("#rsv-code"), meta = $("#rsv-done-meta"), link = $("#rsv-lookup-link");
    if (codeEl) codeEl.textContent = res.code || "";
    if (meta) {
      meta.textContent = I("rsv.doneMeta", {
        title: formTitle(state.form) || (isEn() ? res.title_en : res.title) || "",
        date: fmtDate(res.slot_date), time: res.slot_time || I("rsv.allday")
      });
    }
    if (link) link.href = "#/lookup?code=" + encodeURIComponent(res.code || "");
    try { localStorage.setItem("sbpress-last-reservation", JSON.stringify({ code: res.code, email: ($("#rsv-email") || {}).value || "" })); } catch (e) { /* noop */ }
  }

  function resetForm() {
    var body = $("#rsv-body"), done = $("#rsv-done");
    if (body) body.hidden = false;
    if (done) done.hidden = true;
    state.slot = null;
    loadSlots();
    msg("");
  }

  /* ---------------- 접수 조회 화면 ---------------- */
  var STATUS = ["submitted", "confirmed", "completed"];

  function statusIndex(s) { return STATUS.indexOf(String(s || "")); }

  function renderLookup(res, code) {
    var box = $("#lk-result"), empty = $("#lk-empty");
    if (!box) return;
    if (!res || res.found !== true) {
      state.lastLookup = null;
      box.hidden = true;
      if (empty) { empty.hidden = false; empty.textContent = I("lk.notFound"); }
      return;
    }
    state.lastLookup = res;
    state.lastLookupCode = code;
    if (empty) empty.hidden = true;
    box.hidden = false;
    var st = String(res.status || "submitted");
    var canceled = st === "canceled";
    var idx = statusIndex(st);
    var steps = STATUS.map(function (s, i) {
      var cls = "lk-step";
      if (canceled) cls += " is-off";
      else if (i < idx) cls += " is-done";
      else if (i === idx) cls += " is-now";
      return '<li class="' + cls + '"><span class="lk-dot" aria-hidden="true"></span>' +
        '<b>' + esc(I("lk.step." + s)) + "</b><em>" + esc(I("lk.step." + s + ".hint")) + "</em></li>";
    }).join("");
    var badge = canceled
      ? '<span class="lk-badge is-canceled">' + esc(I("lk.status.canceled")) + "</span>"
      : '<span class="lk-badge is-' + esc(st) + '">' + esc(I("lk.status." + st)) + "</span>";
    var title = isEn() ? (res.title_en || res.title) : (res.title || res.title_en);
    box.innerHTML =
      '<div class="lk-head"><div><p class="lk-code-label">' + esc(I("lk.codeLabel")) + "</p>" +
      '<p class="lk-code" id="lk-result-code">' + esc(res.code || code) + "</p></div>" + badge + "</div>" +
      '<p class="lk-title">' + esc(title || "") + "</p>" +
      '<p class="lk-slot">' + esc(I("lk.slotLine", {
        date: fmtDate(res.slot_date), time: res.slot_time || I("rsv.allday")
      })) + "</p>" +
      '<ol class="lk-steps" id="lk-steps">' + steps + "</ol>" +
      (res.admin_note ? '<p class="lk-note">' + esc(res.admin_note) + "</p>" : "") +
      '<p class="lk-help">' + esc(I("lk.help")) + "</p>";
  }

  function lookup(code, email) {
    var c = String(code || "").trim().toUpperCase();
    var e = String(email || "").trim();
    if (!c) { lkMsg(I("lk.needCode"), "err"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { lkMsg(I("lk.needEmail"), "err"); return; }
    var btn = $("#lk-submit");
    if (btn) btn.disabled = true;
    lkMsg(I("lk.searching"));
    rpc("lookup_reservation", { p_code: c, p_email: e })
      .then(function (res) {
        if (btn) btn.disabled = false;
        lkMsg("");
        renderLookup(res, c);
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        if (isMissing(err)) {
          var box = $("#lk-result");
          if (box) box.hidden = true;
          var empty = $("#lk-empty");
          if (empty) { empty.hidden = false; empty.textContent = I("rsv.notReady"); }
          lkMsg("");
          return;
        }
        lkMsg(errText(err), "err");
      });
  }

  function codeFromHash() {
    var h = String(location.hash || "");
    var m = /[?&]code=([^&]+)/.exec(h);
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return m[1]; }
  }

  /* ---------------- 화면 진입 ---------------- */
  function showReserve() {
    if (!state.loaded) { loadForms(); return; }
    if (state.missing) { showEmpty("missing"); return; }
    if (!state.forms.length) { showEmpty("none"); return; }
    var done = $("#rsv-done");
    if (done && !done.hidden) return;      // 방금 접수한 화면은 그대로 둡니다.
    if (state.slot) renderExtra();
  }

  function showLookup() {
    var code = codeFromHash();
    var input = $("#lk-code");
    if (code && input && !input.value) input.value = code;
    if (code) {
      var saved = "";
      try { saved = (JSON.parse(localStorage.getItem("sbpress-last-reservation") || "{}") || {}).email || ""; } catch (e) { saved = ""; }
      var email = $("#lk-email");
      if (email && !email.value && saved) email.value = saved;
      if (email && email.value) lookup(code, email.value);
    }
  }

  function wire() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var f = t.closest("[data-form]");
      if (f) {
        var id = f.getAttribute("data-form");
        state.form = state.forms.filter(function (x) { return String(x.id) === id; })[0] || state.form;
        var done = $("#rsv-done"); if (done) done.hidden = true;
        var body = $("#rsv-body"); if (body) body.hidden = false;
        renderForms(); loadSlots(); renderExtra(); return;
      }
      var d = t.closest("[data-date]");
      if (d) {
        state.pickedDate = d.getAttribute("data-date");
        state.slot = null;
        renderSlots(); return;
      }
      var s = t.closest("[data-slot]");
      if (s && !s.disabled) {
        var sid = s.getAttribute("data-slot");
        state.slot = state.slots.filter(function (x) { return String(x.id) === sid; })[0] || null;
        renderSlots(); return;
      }
      if (t.closest("#rsv-submit")) { submit(); return; }
      if (t.closest("#rsv-again")) { resetForm(); return; }
      if (t.closest("#lk-submit")) {
        lookup($("#lk-code") && $("#lk-code").value, $("#lk-email") && $("#lk-email").value);
        return;
      }
    });
    document.addEventListener("submit", function (e) {
      if (e.target && e.target.id === "lk-form") { e.preventDefault(); lookup($("#lk-code").value, $("#lk-email").value); }
      if (e.target && e.target.id === "rsv-form-el") { e.preventDefault(); submit(); }
    });
    if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
      window.CRAFT_I18N.onChange(function () {
        if (state.loaded && !state.missing) {
          renderForms(); renderSlots(); renderExtra();
        }
        if (state.lastLookup) renderLookup(state.lastLookup, state.lastLookupCode || "");
        if (state.lastResult && $("#rsv-done") && !$("#rsv-done").hidden) showDone(state.lastResult);
      });
    }
  }

  window.CRAFT_RESERVE = {
    showReserve: showReserve,
    showLookup: showLookup,
    reset: function () { state.loaded = false; loadForms(); },
    status: function () { return { forms: state.forms.length, missing: state.missing, lastCode: state.lastCode }; }
  };

  wire();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { if (/^#\/(reserve|lookup)/.test(location.hash)) showReserve(); });
  else if (/^#\/(reserve|lookup)/.test(location.hash)) showReserve();
})();
