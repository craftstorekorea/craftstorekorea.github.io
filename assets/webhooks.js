/* ===== SBPress v7.0 · 웹훅 관리 · 전송 (assets/webhooks.js) =====
   /admin → 설정 · 연동 의 '웹훅' 카드가 이 모듈을 씁니다.
   · 웹훅 등록/삭제/켜기·끄기 — public.webhooks (관리자 RLS)
   · 전송 이력 — public.webhook_deliveries (최근 20건 · 성공/실패/재시도 횟수 · 응답 코드)
   · 시험 발송 — Edge Function webhook-dispatch 를 먼저 부르고, 함수가 없으면 같은 규칙
     (HMAC-SHA256 · 최초 1회 + 3회 재시도 · 지수 백오프)으로 브라우저에서 직접 시도합니다.
     실제 운영에서는 함수(서버)가 보냅니다 — 브라우저 직접 전송은 CORS 가 열린 대상에서만 됩니다.
   의존: assets/auth.js (CRAFT_AUTH.token) · assets/supabase.js 는 필요 없습니다.
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";
  var MAX_RETRIES = 3;
  var BASE_DELAY = 400;                 // 브라우저 시험 발송용(함수는 800ms)
  var EVENTS = ["form.submitted", "reservation.submitted", "reservation.confirmed",
                "esign.signed", "approval.completed", "approval.rejected", "issue.created"];
  var KINDS = ["slack", "discord", "custom", "google_sheet", "mail"];

  /* 관리자 화면은 assets/admin-i18n.js 가 문구를 번역합니다 — 여기서는 한국어 기본 문구를 돌려줍니다. */
  var T = {
    "wh.needAdmin": "관리자로 로그인해야 웹훅을 관리할 수 있습니다.",
    "wh.loading": "불러오는 중…",
    "wh.errLoad": "웹훅을 읽지 못했습니다:",
    "wh.notReady": "웹훅 표가 아직 없습니다. supabase/19_v70_reservations_webhooks_ai.sql 을 실행하면 이 카드가 켜집니다.",
    "wh.none": "등록된 웹훅이 없습니다.",
    "wh.on": "켜짐", "wh.off": "꺼짐",
    "wh.send": "시험 발송", "wh.disable": "끄기", "wh.enable": "켜기", "wh.delete": "삭제",
    "wh.noDelivery": "아직 전송 이력이 없습니다.",
    "wh.ok": "성공", "wh.pending": "대기", "wh.failed": "실패",
    "wh.attempts": "재시도 {n}회",
    "wh.errUrl": "대상 URL 은 https:// 로 시작해야 합니다(로컬 시험은 localhost 허용).",
    "wh.added": "웹훅을 등록했습니다.",
    "wh.errSave": "저장하지 못했습니다:",
    "wh.confirmDelete": "‘{name}’ 웹훅을 삭제할까요?",
    "wh.deleted": "웹훅을 삭제했습니다.",
    "wh.sending": "보내는 중…",
    "wh.sent": "시험 발송을 마쳤습니다(처리 {n}건).",
    "wh.sentBrowser": "브라우저에서 직접 보냈습니다(재시도 {n}회).",
    "wh.sentBrowserFail": "보내지 못했습니다(재시도 {n}회 · 응답 {code}). 이력에 실패로 남겼습니다.",
    "wh.errSend": "발송하지 못했습니다:",
    "wh.drained": "대기 {n}건을 처리했습니다.",
    "wh.needFunction": "webhook-dispatch 함수가 배포되지 않았습니다. 함수를 배포하면 서버가 대신 보냅니다.",
    "wh.kind.sheet": "구글 시트", "wh.kind.slack": "슬랙", "wh.kind.discord": "디스코드",
    "wh.kind.mail": "메일", "wh.kind.custom": "직접 URL",
    "wh.event.form": "폼 접수", "wh.event.approval": "결재 완료",
    "wh.event.approvalReject": "결재 반려", "wh.event.esign": "전자서명 완료",
    "wh.event.reservationNew": "예약 접수",
    "wh.event.issue": "일감 생성", "wh.event.reservation": "예약 확정",
    "wh.drainedBrowser": "브라우저에서 대기 {n}건을 처리했습니다(실패 {f}건).",
    "wh.nothing": "대기 중인 웹훅이 없습니다."
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

  function msg(text, kind) {
    var box = $("#wh-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "cms-toast" + (kind ? " is-" + kind : "");
    box.hidden = !text;
  }

  function fmtWhen(iso) {
    if (!iso) return "–";
    try {
      return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return String(iso); }
  }

  function kindLabel(k) {
    return { google_sheet: I("wh.kind.sheet"), slack: I("wh.kind.slack"), discord: I("wh.kind.discord"),
             mail: I("wh.kind.mail"), custom: I("wh.kind.custom") }[k] || k;
  }
  function eventLabel(e) {
    return { "form.submitted": I("wh.event.form"), "approval.completed": I("wh.event.approval"),
             "approval.rejected": I("wh.event.approvalReject"), "esign.signed": I("wh.event.esign"),
             "reservation.submitted": I("wh.event.reservationNew"),
             "issue.created": I("wh.event.issue"), "reservation.confirmed": I("wh.event.reservation") }[e] || e;
  }

  /* 슬랙·디스코드는 text/content 한 줄을 받습니다. DB 트리거가 넣은 message 를 씁니다. */
  function messageOf(payload) {
    var p = payload || {};
    var d = (p.data && typeof p.data === "object") ? p.data : p;
    if (d.message) return String(d.message);
    var bits = [p.event || "", d.title || d.subject || d.name || d.code || ""];
    return bits.filter(Boolean).join(" · ");
  }
  function bodyFor(hook, payload) {
    if (hook && hook.kind === "slack") return JSON.stringify({ text: messageOf(payload) });
    if (hook && hook.kind === "discord") return JSON.stringify({ content: messageOf(payload) });
    return JSON.stringify(payload || {});
  }

  /* ---------------- 목록 ---------------- */
  var cache = { hooks: [], deliveries: [] };

  function load() {
    var t = token();
    if (!API || !t) { msg(I("wh.needAdmin"), "err"); return; }
    if ($("#wh-stamp")) $("#wh-stamp").textContent = I("wh.loading");
    Promise.all([
      rest("webhooks?select=id,name,kind,url,event,secret,is_active,created_at&order=created_at.desc"),
      rest("webhook_deliveries?select=id,webhook_id,event,status,attempts,response_code,error,created_at,delivered_at&order=created_at.desc&limit=20")
    ]).then(function (out) {
      cache.hooks = out[0] || [];
      cache.deliveries = out[1] || [];
      render();
      if ($("#wh-stamp")) $("#wh-stamp").textContent = fmtWhen(new Date().toISOString());
      msg("", "");
    }).catch(function (err) {
      cache.hooks = []; cache.deliveries = [];
      if (err.status === 404 || /does not exist|schema cache/i.test(String(err.message || ""))) {
        renderMissing();
      } else {
        msg(I("wh.errLoad") + " " + (err.message || ""), "err");
      }
    });
  }

  function renderMissing() {
    var list = $("#wh-list");
    if (list) list.innerHTML = '<tr><td colspan="5" class="wh-empty">' + esc(I("wh.notReady")) + "</td></tr>";
    var dl = $("#wh-deliveries");
    if (dl) dl.innerHTML = '<tr><td colspan="5" class="wh-empty">' + esc(I("wh.notReady")) + "</td></tr>";
    var box = $("#wh-missing");
    if (box) box.hidden = false;
  }

  function render() {
    var list = $("#wh-list");
    if (list) {
      if (!cache.hooks.length) {
        list.innerHTML = '<tr><td colspan="5" class="wh-empty">' + esc(I("wh.none")) + "</td></tr>";
      } else {
        list.innerHTML = cache.hooks.map(function (h) {
          return "<tr data-hook=\"" + esc(h.id) + "\">" +
            "<td><b>" + esc(h.name || kindLabel(h.kind)) + "</b><br><span class=\"wh-sub\">" + esc(kindLabel(h.kind)) + "</span></td>" +
            "<td>" + esc(eventLabel(h.event)) + "</td>" +
            "<td class=\"wh-url\" title=\"" + esc(h.url) + "\">" + esc(h.url) + "</td>" +
            "<td>" + (h.is_active
              ? '<span class="panel-tag is-on">' + esc(I("wh.on")) + "</span>"
              : '<span class="panel-tag is-off">' + esc(I("wh.off")) + "</span>") + "</td>" +
            "<td class=\"wh-act\">" +
            '<button type="button" class="btn btn-ghost btn-sm" data-wh-test="' + esc(h.id) + '">' + esc(I("wh.send")) + "</button>" +
            '<button type="button" class="btn btn-ghost btn-sm" data-wh-toggle="' + esc(h.id) + '">' + esc(h.is_active ? I("wh.disable") : I("wh.enable")) + "</button>" +
            '<button type="button" class="btn btn-ghost btn-sm danger" data-wh-del="' + esc(h.id) + '">' + esc(I("wh.delete")) + "</button>" +
            "</td></tr>";
        }).join("");
      }
    }
    var dl = $("#wh-deliveries");
    if (dl) {
      if (!cache.deliveries.length) {
        dl.innerHTML = '<tr><td colspan="5" class="wh-empty">' + esc(I("wh.noDelivery")) + "</td></tr>";
      } else {
        var byId = {};
        cache.hooks.forEach(function (h) { byId[h.id] = h; });
        dl.innerHTML = cache.deliveries.map(function (d) {
          var hook = byId[d.webhook_id] || {};
          var st = d.status === "success" ? '<span class="wh-st is-ok">' + esc(I("wh.ok")) + "</span>"
            : d.status === "pending" ? '<span class="wh-st is-wait">' + esc(I("wh.pending")) + "</span>"
            : '<span class="wh-st is-fail">' + esc(I("wh.failed")) + "</span>";
          return "<tr>" +
            "<td>" + esc(fmtWhen(d.created_at)) + "</td>" +
            "<td>" + esc(hook.name || eventLabel(d.event)) + "</td>" +
            "<td>" + esc(eventLabel(d.event)) + "</td>" +
            "<td>" + st + " · " + esc(I("wh.attempts", { n: Number(d.attempts || 0) })) +
            (d.response_code ? " · HTTP " + esc(d.response_code) : "") + "</td>" +
            "<td>" + esc(d.error || d.status) + "</td>" +
            "</tr>";
        }).join("");
      }
    }
  }

  /* ---------------- 등록·삭제·켜기 ---------------- */
  function add() {
    var name = ($("#wh-name") || {}).value || "";
    var kind = ($("#wh-kind") || {}).value || "custom";
    var event = ($("#wh-event") || {}).value || EVENTS[0];
    var url = String(($("#wh-url") || {}).value || "").trim();
    var secret = ($("#wh-secret") || {}).value || "";
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url)) {
      msg(I("wh.errUrl"), "err"); return;
    }
    if (EVENTS.indexOf(event) < 0) event = EVENTS[0];
    var btn = $("#wh-add");
    if (btn) btn.disabled = true;
    rest("webhooks", "POST", {
      name: name.trim() || kindLabel(kind), kind: kind, event: event, url: url,
      secret: secret, is_active: true
    }, "return=representation").then(function () {
      if (btn) btn.disabled = false;
      ["#wh-name", "#wh-url", "#wh-secret"].forEach(function (sel) { var n = $(sel); if (n) n.value = ""; });
      msg(I("wh.added"), "ok");
      load();
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      msg(I("wh.errSave") + " " + (err.message || ""), "err");
    });
  }

  function toggle(id) {
    var h = cache.hooks.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!h) return;
    rest("webhooks?id=eq." + encodeURIComponent(id), "PATCH", { is_active: !h.is_active })
      .then(load).catch(function (e) { msg(I("wh.errSave") + " " + (e.message || ""), "err"); });
  }

  function remove(id) {
    var h = cache.hooks.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!h) return;
    if (!window.confirm(I("wh.confirmDelete", { name: h.name || h.url }))) return;
    rest("webhooks?id=eq." + encodeURIComponent(id), "DELETE")
      .then(function () { msg(I("wh.deleted"), "ok"); load(); })
      .catch(function (e) { msg(I("wh.errSave") + " " + (e.message || ""), "err"); });
  }

  /* ---------------- 전송 (시험 발송) ---------------- */
  function hmacHex(secret, body) {
    if (!secret) return Promise.resolve("");
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (k) { return crypto.subtle.sign("HMAC", k, enc.encode(body)); })
      .then(function (sig) {
        return Array.prototype.map.call(new Uint8Array(sig), function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
      });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* 브라우저 폴백 — 함수가 없을 때 같은 규칙으로 직접 보냅니다(테스트·CORS 허용 대상). */
  function deliverInBrowser(delivery, hook) {
    var body = bodyFor(hook, delivery.payload || {});
    var attempts = 0, lastCode = null, lastBody = "", lastError = "";
    function send() {
      return hmacHex(hook.secret || "", body).then(function (sig) {
        var headers = {
          "Content-Type": "application/json",
          "X-SBPress-Event": delivery.event,
          "X-SBPress-Delivery": delivery.id,
          "User-Agent": "SBPress-Webhook/7.0"
        };
        if (sig) headers["X-SBPress-Signature"] = "sha256=" + sig;
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 8000);
        return fetch(hook.url, { method: "POST", headers: headers, body: body, signal: ctrl.signal })
          .then(function (res) {
            lastCode = res.status;
            return res.text().then(function (t) { lastBody = String(t || "").slice(0, 500); return res.ok; });
          })
          .catch(function (e) { lastCode = null; lastError = e && e.message ? e.message : String(e); return false; })
          .finally(function () { clearTimeout(timer); });
      });
    }
    return send().then(function (ok) {
      function again() {
        if (ok || attempts >= MAX_RETRIES) return Promise.resolve(ok);
        attempts += 1;
        return sleep(BASE_DELAY * Math.pow(2, attempts - 1)).then(send).then(function (res) {
          ok = res;
          return again();
        });
      }
      return again().then(function (finalOk) {
        return rest("webhook_deliveries?id=eq." + encodeURIComponent(delivery.id), "PATCH", {
          status: finalOk ? "success" : "failed",
          attempts: attempts,
          response_code: lastCode,
          response_body: lastBody,
          error: finalOk ? "" : (lastError || (lastCode ? "HTTP " + lastCode : "fetch_failed")),
          delivered_at: new Date().toISOString()
        }).then(function () { return { ok: finalOk, attempts: attempts, response_code: lastCode }; });
      });
    });
  }

  function dispatchTest(id) {
    var h = cache.hooks.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!h) return;
    msg(I("wh.sending"));
    var payload = {
      event: h.event, test: true, site: location.origin,
      sent_at: new Date().toISOString(),
      data: { code: "SB-2026-0001", name: "SBPress test", email: "test@example.com",
              slot_date: new Date().toISOString().slice(0, 10), slot_time: "10:00" }
    };
    var t = token();
    fetch(API + "/functions/v1/webhook-dispatch", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ webhook_id: id, test: true, payload: payload.data })
    }).then(function (r) {
      if (r.status === 404 || r.status === 501 || r.status === 400) throw new Error("function_unavailable");
      return r.json().then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || ("HTTP " + r.status));
        if (!d || !Array.isArray(d.results)) throw new Error("function_unavailable");
        return d;
      });
    }).then(function (d) {
      msg(I("wh.sent", { n: (d.results || []).length }), "ok");
      load();
    }).catch(function () {
      // 함수가 없으면 브라우저에서 같은 규칙으로 시도합니다.
      rest("webhook_deliveries", "POST", { webhook_id: id, event: h.event, payload: payload }, "return=representation")
        .then(function (rows) {
          var row = (rows && rows[0]) || {};
          return deliverInBrowser(row, h).then(function (res) {
            msg(res.ok ? I("wh.sentBrowser", { n: res.attempts }) : I("wh.sentBrowserFail", { n: res.attempts, code: res.response_code || "–" }),
              res.ok ? "ok" : "err");
            load();
          });
        })
        .catch(function (e) { msg(I("wh.errSend") + " " + (e.message || ""), "err"); });
    });
  }

  /* 함수가 없을 때 브라우저가 대기 행을 직접 보냅니다(같은 규칙·같은 이력). */
  function drainInBrowser() {
    return rest("webhook_deliveries?select=id,webhook_id,event,payload&status=eq.pending&order=created_at.asc&limit=10")
      .then(function (rows) {
        if (!rows || !rows.length) return { n: 0, fail: 0 };
        return rest("webhooks?select=id,name,kind,url,secret,is_active").then(function (hooks) {
          var byId = {};
          (hooks || []).forEach(function (h) { byId[h.id] = h; });
          var n = 0, fail = 0;
          var chain = Promise.resolve();
          rows.forEach(function (row) {
            chain = chain.then(function () {
              var hook = byId[row.webhook_id];
              if (!hook || !hook.is_active) {
                fail += 1;
                return rest("webhook_deliveries?id=eq." + encodeURIComponent(row.id), "PATCH", {
                  status: "failed", error: "webhook_inactive_or_deleted",
                  delivered_at: new Date().toISOString()
                });
              }
              return deliverInBrowser(row, hook).then(function (res) {
                n += 1;
                if (!res.ok) fail += 1;
              }, function () { fail += 1; });
            });
          });
          return chain.then(function () { return { n: n, fail: fail }; });
        });
      });
  }

  function drain() {
    var t = token();
    msg(I("wh.sending"));
    fetch(API + "/functions/v1/webhook-dispatch", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ drain: true })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (out) {
        if (!out.ok) throw new Error((out.d && out.d.error) || "error");
        msg(I("wh.drained", { n: out.d.processed || 0 }), "ok");
        load();
      })
      .catch(function () {
        /* 함수 미배포 — 브라우저에서 같은 규칙으로 시도합니다. */
        drainInBrowser().then(function (res) {
          if (!res.n && !res.fail) { msg(I("wh.nothing"), "ok"); load(); return; }
          msg(I("wh.drainedBrowser", { n: res.n, f: res.fail }), res.fail ? "err" : "ok");
          load();
        }).catch(function () { msg(I("wh.needFunction"), "err"); });
      });
  }

  function wire() {
    var addBtn = $("#wh-add");
    if (addBtn && !addBtn.getAttribute("data-wired")) {
      addBtn.setAttribute("data-wired", "1");
      addBtn.addEventListener("click", add);
    }
    var reload = $("#wh-reload");
    if (reload && !reload.getAttribute("data-wired")) {
      reload.setAttribute("data-wired", "1");
      reload.addEventListener("click", load);
    }
    var drainBtn = $("#wh-drain");
    if (drainBtn && !drainBtn.getAttribute("data-wired")) {
      drainBtn.setAttribute("data-wired", "1");
      drainBtn.addEventListener("click", drain);
    }
    document.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target : null;
      if (!el) return;
      var test = el.closest("[data-wh-test]");
      if (test) { dispatchTest(test.getAttribute("data-wh-test")); return; }
      var tg = el.closest("[data-wh-toggle]");
      if (tg) { toggle(tg.getAttribute("data-wh-toggle")); return; }
      var del = el.closest("[data-wh-del]");
      if (del) { remove(del.getAttribute("data-wh-del")); }
    });
  }

  window.CRAFT_WEBHOOKS = {
    load: load,
    dispatchTest: dispatchTest,
    drain: drain,
    status: function () { return { hooks: cache.hooks.length, deliveries: cache.deliveries.length }; }
  };

  wire();
})();
