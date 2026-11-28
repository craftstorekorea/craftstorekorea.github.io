/* ===== SBPress v10.17 · 접수 자동 일감 · 알림 문구 템플릿 (assets/automation.js)
   /admin → 알림·자동화 탭의 두 카드가 이 모듈을 씁니다.
   · 접수 자동 일감 — public.automation_intake_rules (관리자 RLS)
       예약·폼이 접수되면 DB 트리거(38_v1017)가 이 규칙대로 issues 에 일감을 만들고 알립니다.
       여기서는 규칙만 만들고 고칩니다 — 실제 생성은 접수 순간 서버가 합니다.
   · 알림 문구 템플릿 — public.notify_templates
       인앱 알림 제목·본문과 외부 웹훅 문구. {name} 같은 자리는 서버(notify_render)가 채웁니다.
   의존: assets/auth.js (CRAFT_AUTH) 또는 assets/admin.js (CRAFT_ADMIN) 의 토큰.
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";

  var EVENTS = ["form.submitted", "reservation.submitted", "esign.signed",
                "approval.completed", "approval.rejected"];
  /* 문구 칸 이름 → 화면 id (message_ko 는 #ntf-tpl-msg-ko 입니다) */
  var TFIELDS = {
    title_ko: "#ntf-tpl-title-ko", title_en: "#ntf-tpl-title-en",
    body_ko: "#ntf-tpl-body-ko", body_en: "#ntf-tpl-body-en",
    message_ko: "#ntf-tpl-msg-ko", message_en: "#ntf-tpl-msg-en"
  };

  var T = {
    "au.needAdmin": "관리자로 로그인해야 접수 규칙과 문구를 관리할 수 있습니다.",
    "au.loading": "불러오는 중…",
    "au.errLoad": "불러오지 못했습니다:",
    "au.notReady": "표가 아직 없습니다. supabase/38_v1017_auto_links.sql 을 실행하면 이 카드가 켜집니다.",
    "au.none": "아직 만든 규칙이 없습니다.",
    "au.saved": "저장했습니다.",
    "au.deleted": "규칙을 지웠습니다.",
    "au.errSave": "저장하지 못했습니다:",
    "au.needProject": "대상 프로젝트를 골라 주세요.",
    "au.confirmDelete": "이 접수 규칙을 지울까요?",
    "au.on": "켜짐", "au.off": "꺼짐",
    "au.edit": "고치기", "au.delete": "삭제",
    "au.srcForm": "폼 접수", "au.srcReservation": "예약 접수",
    "au.allForms": "모든 폼",
    "au.noAssignee": "지정 안 함",
    "au.tplSaved": "문구를 저장했습니다.",
    "au.tplDefault": "기본 문구를 채웠습니다. 저장을 눌러 반영하세요.",
    "au.tplMissing": "이 사건의 문구가 아직 없습니다. 기본 문구를 채워 저장하세요.",
    "au.pri.low": "낮음", "au.pri.normal": "보통", "au.pri.high": "높음", "au.pri.urgent": "긴급"
  };
  function I(key, vars) {
    var s = T[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", String(vars[k])); });
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function token() {
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.token) return window.CRAFT_AUTH.token();
    if (window.CRAFT_ADMIN && window.CRAFT_ADMIN.token) return window.CRAFT_ADMIN.token();
    return null;
  }
  function rest(path, method, body, prefer) {
    var t = token();
    if (!API || !t) return Promise.reject(Object.assign(new Error("no_session"), { status: 0 }));
    var headers = { apikey: KEY, Authorization: "Bearer " + t, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    return fetch(API + "/rest/v1/" + path, {
      method: method || "GET", headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint || data.details)) || ("HTTP " + r.status));
          err.status = r.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function missing(err) {
    return err && (err.status === 404 || /does not exist|schema cache|relation/i.test(String(err.message || "")));
  }
  function msg(id, text, kind) {
    var box = $(id);
    if (!box) return;
    box.textContent = text || "";
    box.className = "cms-toast" + (kind ? " is-" + kind : "");
    box.hidden = !text;
  }
  function val(sel) { var n = $(sel); return n ? String(n.value || "").trim() : ""; }
  function checked(sel) { var n = $(sel); return !!(n && n.checked); }
  function setVal(sel, v) { var n = $(sel); if (n) n.value = v == null ? "" : String(v); }
  function setChecked(sel, v) { var n = $(sel); if (n) n.checked = !!v; }

  var S = {
    rules: [], projects: [], people: [], templates: {},
    editingRule: null, event: EVENTS[0], loaded: false, bound: false
  };

  /* ---------------- 공통 목록 (프로젝트 · 사람) ---------------- */
  function loadLookups() {
    if (!token()) return Promise.resolve();
    return Promise.all([
      rest("projects?select=id,key,name,status&order=name.asc").catch(function () { return []; }),
      rest("profiles?select=id,nickname,email&order=email.asc&limit=500").catch(function () { return []; })
    ]).then(function (out) {
      S.projects = (out[0] || []).filter(function (p) { return p && p.id; });
      S.people = (out[1] || []).filter(function (p) { return p && p.id; });
      paintLookups();
    });
  }

  function paintLookups() {
    var proj = $("#ntf-rule-project");
    if (proj) {
      proj.innerHTML = '<option value="">— 프로젝트 —</option>' + S.projects.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc((p.key ? "[" + p.key + "] " : "") + (p.name || p.id)) + "</option>";
      }).join("");
    }
    var who = $("#ntf-rule-assignee");
    if (who) {
      who.innerHTML = '<option value="">' + esc(I("au.noAssignee")) + "</option>" + S.people.map(function (p) {
        var name = p.nickname || (p.email ? String(p.email).split("@")[0] : p.id);
        return '<option value="' + esc(p.id) + '">' + esc(name) + (p.email ? " · " + esc(p.email) : "") + "</option>";
      }).join("");
    }
  }
  function personName(id) {
    var p = S.people.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) return "";
    return p.nickname || (p.email ? String(p.email).split("@")[0] : "");
  }
  function projectName(id) {
    var p = S.projects.filter(function (x) { return String(x.id) === String(id); })[0];
    return p ? ((p.key ? "[" + p.key + "] " : "") + (p.name || "")) : "";
  }

  /* ---------------- 접수 자동 일감 ---------------- */
  function loadRules() {
    var state = $("#ntf-intake-state");
    if (!token()) { if (state) state.textContent = "–"; return; }
    if (state) state.textContent = I("au.loading");
    rest("automation_intake_rules?select=*&order=created_at.desc&limit=50")
      .then(function (rows) {
        S.rules = Array.isArray(rows) ? rows : [];
        var miss = $("#ntf-intake-missing");
        if (miss) miss.hidden = true;
        if (state) state.textContent = S.rules.length ? (S.rules.length + "개") : "없음";
        renderRules();
      })
      .catch(function (err) {
        S.rules = [];
        if (missing(err)) {
          var miss = $("#ntf-intake-missing");
          if (miss) miss.hidden = false;
          if (state) state.textContent = "없음";
          renderRules();
          return;
        }
        if (state) state.textContent = "–";
        msg("#ntf-rule-msg", I("au.errLoad") + " " + (err.message || ""), "err");
      });
  }

  function srcLabel(r) {
    if (r.source === "reservation") return I("au.srcReservation");
    var k = r.form_kind ? (r.form_kind === "submit" ? "제보·등록" : r.form_kind) : I("au.allForms");
    return I("au.srcForm") + " · " + k;
  }

  function renderRules() {
    var body = $("#ntf-rule-table tbody");
    if (!body) return;
    if (!S.rules.length) {
      body.innerHTML = '<tr><td colspan="7" class="wh-empty">' + esc(I("au.none")) + "</td></tr>";
      return;
    }
    body.innerHTML = S.rules.map(function (r) {
      return "<tr data-rule=\"" + esc(r.id) + "\">" +
        "<td>" + esc(srcLabel(r)) + "</td>" +
        "<td>" + esc(projectName(r.project_id) || "–") + "</td>" +
        "<td>" + esc(personName(r.assignee_id) || I("au.noAssignee")) + "</td>" +
        "<td>" + esc(I("au.pri." + (r.priority || "normal"))) + "</td>" +
        "<td class=\"wh-url\" title=\"" + esc(r.title_template) + "\">" + esc(r.title_template) + "</td>" +
        "<td>" + (r.is_active
          ? '<span class="panel-tag is-on">' + esc(I("au.on")) + "</span>"
          : '<span class="panel-tag is-off">' + esc(I("au.off")) + "</span>") + "</td>" +
        '<td class="wh-act">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-rule-edit="' + esc(r.id) + '">' + esc(I("au.edit")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm danger" data-rule-del="' + esc(r.id) + '">' + esc(I("au.delete")) + "</button>" +
        "</td></tr>";
    }).join("");
  }

  function fillRuleForm(r) {
    S.editingRule = r ? r.id : null;
    var isForm = r ? r.source === "form" : false;
    setVal("#ntf-rule-source", r ? r.source : "reservation");
    setVal("#ntf-rule-kind", r ? (r.form_kind || "") : "submit");
    setVal("#ntf-rule-project", r ? r.project_id : "");
    setVal("#ntf-rule-assignee", r ? (r.assignee_id || "") : "");
    setVal("#ntf-rule-priority", r ? r.priority : "normal");
    setVal("#ntf-rule-tracker", r ? r.tracker : "task");
    setVal("#ntf-rule-days", r && r.due_days != null ? r.due_days : "");
    setChecked("#ntf-rule-notify", r ? r.notify !== false : true);
    setChecked("#ntf-rule-active", r ? r.is_active !== false : true);
    setVal("#ntf-rule-title", r ? r.title_template : "[접수] {name}");
    setVal("#ntf-rule-desc", r ? r.desc_template : "");
    paintKindWrap(r ? r.source : "reservation");
    if (isForm) { /* 폼 종류 칸을 켭니다 */ }
  }

  function paintKindWrap(source) {
    var wrap = $("#ntf-rule-kind-wrap");
    if (!wrap) return;
    var form = String(source || val("#ntf-rule-source")) === "form";
    wrap.style.opacity = form ? "1" : "0.45";
    var sel = $("#ntf-rule-kind");
    if (sel) sel.disabled = !form;
  }

  function saveRule() {
    if (!token()) { msg("#ntf-rule-msg", I("au.needAdmin"), "err"); return; }
    var project = val("#ntf-rule-project");
    if (!project) { msg("#ntf-rule-msg", I("au.needProject"), "err"); return; }
    var source = val("#ntf-rule-source") === "form" ? "form" : "reservation";
    var days = val("#ntf-rule-days");
    var payload = {
      site_key: "default",
      source: source,
      form_kind: source === "form" ? val("#ntf-rule-kind") : "",
      project_id: project,
      assignee_id: val("#ntf-rule-assignee") || null,
      priority: val("#ntf-rule-priority") || "normal",
      tracker: val("#ntf-rule-tracker") || "task",
      title_template: val("#ntf-rule-title") || "[접수] {name}",
      desc_template: val("#ntf-rule-desc"),
      due_days: days === "" ? null : Math.max(0, Math.min(365, parseInt(days, 10) || 0)),
      notify: checked("#ntf-rule-notify"),
      is_active: checked("#ntf-rule-active")
    };
    var btn = $("#ntf-rule-save");
    if (btn) btn.disabled = true;
    var sameKind = "&form_kind=eq." + encodeURIComponent(payload.form_kind);
    var offOthers = function (extra) {
      if (!payload.is_active) return Promise.resolve();
      return rest("automation_intake_rules?source=eq." + encodeURIComponent(source) + sameKind + extra,
                  "PATCH", { is_active: false });
    };
    var q;
    if (S.editingRule) {
      // 같은 접수 종류에 켜진 규칙은 하나만 — 나머지는 먼저 끕니다.
      q = offOthers("&id=neq." + encodeURIComponent(S.editingRule)).then(function () {
        return rest("automation_intake_rules?id=eq." + encodeURIComponent(S.editingRule), "PATCH", payload);
      });
    } else {
      q = offOthers("").then(function () {
        return rest("automation_intake_rules", "POST", payload);
      });
    }
    q.then(function () {
      if (btn) btn.disabled = false;
      msg("#ntf-rule-msg", I("au.saved"), "ok");
      S.editingRule = null;
      loadRules();
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      msg("#ntf-rule-msg", I("au.errSave") + " " + (err.message || ""), "err");
    });
  }

  function deleteRule(id) {
    var r = S.rules.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!r) return;
    if (!window.confirm(I("au.confirmDelete"))) return;
    rest("automation_intake_rules?id=eq." + encodeURIComponent(id), "DELETE")
      .then(function () { msg("#ntf-rule-msg", I("au.deleted"), "ok"); loadRules(); })
      .catch(function (err) { msg("#ntf-rule-msg", I("au.errSave") + " " + (err.message || ""), "err"); });
  }

  /* ---------------- 알림 문구 템플릿 ---------------- */
  var DEFAULTS = {
    "form.submitted": {
      title_ko: "폼 접수 · {name}", body_ko: "{page} 에서 접수했습니다. ({email})",
      title_en: "Form received · {name}", body_en: "Submitted on {page}. ({email})",
      message_ko: "📥 새 폼 접수 — {name} ({email}) · {page}",
      message_en: "📥 New form — {name} ({email}) · {page}"
    },
    "reservation.submitted": {
      title_ko: "예약 접수 · {name}", body_ko: "{date} {time} · 접수번호 {code}",
      title_en: "Reservation · {name}", body_en: "{date} {time} · {code}",
      message_ko: "📅 새 예약 접수 — {date} {time} · {name} ({code})",
      message_en: "📅 New reservation — {date} {time} · {name} ({code})"
    },
    "esign.signed": {
      title_ko: "전자서명 완료 · {title}", body_ko: "{signer} 님이 서명했습니다. {link_note}",
      title_en: "E-signature complete · {title}", body_en: "Signed by {signer}. {link_note}",
      message_ko: "✍️ 전자서명 완료 — {title} · 서명자 {signer} {link_note}",
      message_en: "✍️ E-signature complete — {title} · signed by {signer} {link_note}"
    },
    "approval.completed": {
      title_ko: "결재 승인 · {title}", body_ko: "{doc_no} 가 최종 승인되었습니다.",
      title_en: "Approval granted · {title}", body_en: "{doc_no} was fully approved.",
      message_ko: "✅ 결재 승인 — {doc_no} {title}", message_en: "✅ Approved — {doc_no} {title}"
    },
    "approval.rejected": {
      title_ko: "결재 반려 · {title}", body_ko: "{doc_no} 가 반려되었습니다. {reason}",
      title_en: "Approval rejected · {title}", body_en: "{doc_no} was rejected. {reason}",
      message_ko: "⛔ 결재 반려 — {doc_no} {title} {reason}",
      message_en: "⛔ Rejected — {doc_no} {title} {reason}"
    }
  };

  function loadTemplates() {
    var state = $("#ntf-tpl-state");
    if (!token()) { if (state) state.textContent = "–"; return; }
    if (state) state.textContent = I("au.loading");
    rest("notify_templates?select=*&order=event.asc")
      .then(function (rows) {
        S.templates = {};
        (rows || []).forEach(function (r) { if (r && r.event) S.templates[r.event] = r; });
        var miss = $("#ntf-tpl-missing");
        if (miss) miss.hidden = true;
        if (state) state.textContent = Object.keys(S.templates).length + "개";
        fillTemplateForm(S.event);
      })
      .catch(function (err) {
        if (missing(err)) {
          var miss = $("#ntf-tpl-missing");
          if (miss) miss.hidden = false;
          if (state) state.textContent = "없음";
          fillTemplateForm(S.event);
          return;
        }
        if (state) state.textContent = "–";
        msg("#ntf-tpl-msg", I("au.errLoad") + " " + (err.message || ""), "err");
      });
  }

  function fillTemplateForm(event) {
    S.event = EVENTS.indexOf(event) >= 0 ? event : EVENTS[0];
    var t = S.templates[S.event];
    Object.keys(TFIELDS).forEach(function (k) {
      setVal(TFIELDS[k], t ? (t[k] || "") : "");
    });
    setChecked("#ntf-tpl-active", t ? t.is_active !== false : true);
  }

  function saveTemplate() {
    if (!token()) { msg("#ntf-tpl-msg", I("au.needAdmin"), "err"); return; }
    var payload = {
      event: S.event,
      title_ko: val(TFIELDS.title_ko),
      body_ko: val(TFIELDS.body_ko),
      title_en: val(TFIELDS.title_en),
      body_en: val(TFIELDS.body_en),
      message_ko: val(TFIELDS.message_ko),
      message_en: val(TFIELDS.message_en),
      is_active: checked("#ntf-tpl-active")
    };
    var btn = $("#ntf-tpl-save");
    if (btn) btn.disabled = true;
    rest("notify_templates?on_conflict=event", "POST", payload, "resolution=merge-duplicates,return=representation")
      .then(function () {
        if (btn) btn.disabled = false;
        msg("#ntf-tpl-msg", I("au.tplSaved"), "ok");
        loadTemplates();
      }).catch(function (err) {
        if (btn) btn.disabled = false;
        msg("#ntf-tpl-msg", I("au.errSave") + " " + (err.message || ""), "err");
      });
  }

  function fillDefaults() {
    var d = DEFAULTS[S.event];
    if (!d) { msg("#ntf-tpl-msg", I("au.tplMissing"), "err"); return; }
    Object.keys(TFIELDS).forEach(function (k) {
      setVal(TFIELDS[k], d[k] || "");
    });
    setChecked("#ntf-tpl-active", true);
    msg("#ntf-tpl-msg", I("au.tplDefault"), "ok");
  }

  /* ---------------- 연결 ---------------- */
  function wire() {
    if (S.bound) return;
    S.bound = true;
    var save = $("#ntf-rule-save");
    if (save) save.addEventListener("click", saveRule);
    var reset = $("#ntf-rule-reset");
    if (reset) reset.addEventListener("click", function () {
      fillRuleForm(null);
      msg("#ntf-rule-msg", "", "");
    });
    var src = $("#ntf-rule-source");
    if (src) src.addEventListener("change", function () { paintKindWrap(src.value); });
    var tsave = $("#ntf-tpl-save");
    if (tsave) tsave.addEventListener("click", saveTemplate);
    var tdef = $("#ntf-tpl-default");
    if (tdef) tdef.addEventListener("click", fillDefaults);
    var tev = $("#ntf-tpl-event");
    if (tev) tev.addEventListener("change", function () { fillTemplateForm(tev.value); });

    document.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("[data-rule-edit],[data-rule-del]") : null;
      if (!el) return;
      var edit = el.getAttribute("data-rule-edit");
      if (edit) {
        var r = S.rules.filter(function (x) { return String(x.id) === String(edit); })[0];
        if (r) {
          fillRuleForm(r);
          msg("#ntf-rule-msg", "", "");
          var box = $("#ntf-intake-group");
          if (box && box.scrollIntoView) box.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        return;
      }
      var del = el.getAttribute("data-rule-del");
      if (del) deleteRule(del);
    });
  }

  function load() {
    wire();
    if (!token()) {
      msg("#ntf-rule-msg", I("au.needAdmin"), "err");
      return;
    }
    if (!S.loaded) { S.loaded = true; loadLookups(); }
    loadRules();
    loadTemplates();
  }

  window.CRAFT_AUTOMATION = {
    load: load,
    loadRules: loadRules,
    loadTemplates: loadTemplates,
    fillDefaults: fillDefaults,
    status: function () { return { rules: S.rules.length, templates: Object.keys(S.templates).length }; }
  };

  wire();
})();
