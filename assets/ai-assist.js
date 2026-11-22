/* ===== SBPress v7.0 · AI 초안 · KO↔EN 번역 보조 (assets/ai-assist.js) =====
   /admin 글·페이지 편집기의 [AI 초안] · [KO→EN] · [EN→KO] 버튼.
   · 키는 Edge Function ai 의 시크릿에만 있습니다. 브라우저는 함수만 부릅니다.
   · 결과는 언제나 입력칸에 채우기만 합니다 — 자동 저장·자동 발행 금지(사람이 검토 후 저장).
   · 함수·키가 없으면(기본값 ai.provider=none) 안전 안내만 하고 아무 것도 바꾸지 않습니다.
   의존: assets/auth.js (CRAFT_AUTH.token)
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";

  /* 관리자 화면은 assets/admin-i18n.js 가 문구를 번역합니다 — 여기서는 한국어 기본 문구를 돌려줍니다. */
  var T = {
    "ai.working": "AI가 작성 중…",
    "ai.draftDone": "초안을 입력칸에 채웠습니다 — 검토 후 저장하세요.",
    "ai.translatedEn": "영문 번역을 English 칸에 채웠습니다 — 검토 후 저장하세요.",
    "ai.translatedKo": "한국어 번역을 본문 칸에 채웠습니다 — 검토 후 저장하세요.",
    "ai.empty": "AI 응답이 비어 있습니다.",
    "ai.notConfigured": "AI 보조가 설정되지 않았습니다. 관리자 [설정 · 연동]에서 사용 방식을 고르거나, 함수 시크릿 AI_API_KEY 를 넣어 주세요.",
    "ai.error": "AI 호출에 실패했습니다:",
    "ai.needTopic": "제목이나 요약을 먼저 적어 주세요.",
    "ai.needText": "번역할 본문이 비어 있습니다.",
    "ai.needEnglish": "English 칸이 비어 있습니다.",
    "ai.replaceConfirm": "기존 내용을 AI 결과로 바꿀까요?"
  };
  function I(key, vars) {
    var s = T[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", String(vars[k])); });
    return s;
  }
  function $(s) { return document.querySelector(s); }
  function token() {
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.token) return window.CRAFT_AUTH.token();
    if (window.CRAFT_ADMIN && window.CRAFT_ADMIN.token) return window.CRAFT_ADMIN.token();
    return null;
  }

  function msg(text, kind) {
    var box = $("#ai-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "cms-toast" + (kind ? " is-" + kind : "");
    box.hidden = !text;
  }

  function call(body) {
    var t = token();
    if (!API || !t) return Promise.reject(new Error("no_session"));
    return fetch(API + "/functions/v1/ai", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (r.status === 404) {
          var e404 = new Error("function_missing"); e404.status = 404; throw e404;
        }
        if (r.status === 501 || (data && data.error === "ai_not_configured")) {
          var e501 = new Error("ai_not_configured"); e501.status = 501; throw e501;
        }
        if (!r.ok || !data || data.ok === false) {
          var err = new Error((data && (data.message || data.error)) || ("HTTP " + r.status));
          err.status = r.status; throw err;
        }
        return data;
      });
    });
  }

  /* 채우기 — 기존 글이 있으면 지우지 않고 아래에 덧붙입니다(초안 · 번역 모두 사람이 검토). */
  function fill(field, text, mode) {
    if (!field) return false;
    var before = String(field.value || "");
    if (mode === "replace" && before.trim()) {
      if (!window.confirm(I("ai.replaceConfirm"))) return false;
      field.value = text;
    } else if (before.trim()) {
      field.value = before.replace(/\s+$/, "") + "\n\n" + text;
    } else {
      field.value = text;
    }
    try { field.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* noop */ }
    field.focus();
    return true;
  }

  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.setAttribute("data-busy", "1"); btn.disabled = true; }
    else { btn.removeAttribute("data-busy"); btn.disabled = false; }
  }

  function run(btn, body, field, mode, okKey) {
    busy(btn, true);
    msg(I("ai.working"));
    call(body).then(function (data) {
      busy(btn, false);
      var text = String(data.text || "").trim();
      if (!text) { msg(I("ai.empty"), "err"); return; }
      if (!fill(field, text, mode)) { msg("", ""); return; }
      msg(I(okKey), "ok");
    }).catch(function (err) {
      busy(btn, false);
      if (err.status === 404 || err.status === 501 || err.message === "ai_not_configured") {
        msg(I("ai.notConfigured"), "err");     // 안전 안내 — 입력칸은 그대로 둡니다.
        return;
      }
      msg(I("ai.error") + " " + (err.message || ""), "err");
    });
  }

  function bodyField() { return $("#pf-body"); }
  function enField() { return $("#pf-body_en"); }
  function titleField() { return $("#pf-title"); }

  function wire() {
    var draft = $("#pf-ai-draft");
    if (draft && !draft.getAttribute("data-wired")) {
      draft.setAttribute("data-wired", "1");
      draft.addEventListener("click", function () {
        var topic = (titleField() && titleField().value || "").trim()
          || (($("#pf-summary") || {}).value || "").trim();
        if (!topic) { msg(I("ai.needTopic"), "err"); return; }
        run(draft, { action: "draft", text: topic, lang: "ko", title: topic }, bodyField(), "append", "ai.draftDone");
      });
    }
    var toEn = $("#pf-ai-en");
    if (toEn && !toEn.getAttribute("data-wired")) {
      toEn.setAttribute("data-wired", "1");
      toEn.addEventListener("click", function () {
        var src = String((bodyField() || {}).value || "").trim();
        if (!src) { msg(I("ai.needText"), "err"); return; }
        run(toEn, { action: "translate", text: src, target: "en" }, enField(), "replace", "ai.translatedEn");
      });
    }
    var toKo = $("#pf-ai-ko");
    if (toKo && !toKo.getAttribute("data-wired")) {
      toKo.setAttribute("data-wired", "1");
      toKo.addEventListener("click", function () {
        var src = String((enField() || {}).value || "").trim();
        if (!src) { msg(I("ai.needEnglish"), "err"); return; }
        run(toKo, { action: "translate", text: src, target: "ko" }, bodyField(), "replace", "ai.translatedKo");
      });
    }
  }

  window.CRAFT_AI = {
    wire: wire,
    status: function () { return { wired: !!$("#pf-ai-draft"), hasToken: !!token() }; }
  };

  wire();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
})();
