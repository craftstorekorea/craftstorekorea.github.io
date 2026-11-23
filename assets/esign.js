/* ===== SBPress v9.0 · 전자서명 · 동의서 (assets/esign.js) =====
   #/sign?token=…  공개 서명 화면 — 로그인 없이 전용 링크로 들어와 동의 항목을 체크하고
                   손글씨(canvas)로 서명합니다. 서명이 끝나면 원문 SHA-256 해시·서명 시각·
                   서명 이미지가 들어간 인쇄/PDF 용지를 만듭니다.
   /admin → 서명 · 동의서  요청 만들기(제목·본문·필수 동의 항목·서명자·만료일) · 요청 목록 ·
                   상태 필터 · 완료 문서 상세(서명 이미지·해시·시각) · 인쇄/PDF · 요청 취소.

   지연 로딩 — index.html 은 이 파일을 첫 화면에 넣지 않습니다.
     #/sign 에 들어갈 때 assets/config.js 의 SBP.loadScript("assets/esign.js") 가 받습니다.
     /admin 은 관리자 화면이라 admin.html 이 직접 싣습니다(첫 화면 예산과 무관).

   의존: assets/config.js (window.CRAFT_SUPABASE · SBPRESS_CONFIG) · assets/i18n.js(공개 문구)
         /admin 에서는 assets/admin.js 의 window.CRAFT_ADMIN(token) · assets/admin-i18n.js
   주의: service_role 키나 비밀 값은 이 파일에 넣지 않습니다. 공개(anon) 키만 씁니다.
         토큰 원문은 저장하지 않습니다 — 서버에는 SHA-256 해시만 남고, 링크는 만들 때 한 번 보여 줍니다.
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";
  var SC = window.SBPRESS_CONFIG || {};

  /* 관리자 화면 문구 — assets/admin-i18n.js 가 번역합니다.
     (이 파일의 문구는 tools_gen_admin_i18n.py 의 PAIRS/RULES 에 들어 있습니다.) */
  var T = {
    "esg.needAdmin": "관리자로 로그인해야 서명 요청을 관리할 수 있습니다.",
    "esg.loading": "불러오는 중…",
    "esg.errLoad": "서명 요청을 읽지 못했습니다:",
    "esg.notReady": "서명 표가 아직 없습니다. supabase/21_v90_esign.sql 을 실행하면 이 화면이 켜집니다.",
    "esg.empty": "아직 만든 서명 요청이 없습니다. 위에서 첫 요청을 만들어 보세요.",
    "esg.noDetail": "목록에서 요청을 하나 고르세요.",
    "esg.needTitle": "제목을 적어 주세요.",
    "esg.needBody": "동의서 본문을 적어 주세요.",
    "esg.needCheck": "필수 동의 항목을 하나 이상 적어 주세요.",
    "esg.needSigner": "서명자 이름을 적어 주세요.",
    "esg.badEmail": "서명자 이메일 주소를 확인해 주세요.",
    "esg.created": "서명 요청을 만들었습니다. 아래 링크를 서명자에게 보내세요.",
    "esg.copied": "링크를 복사했습니다.",
    "esg.copyFail": "복사하지 못했습니다 — 링크를 직접 선택해 복사해 주세요.",
    "esg.linkOnce": "링크는 요청을 만들 때만 보입니다. 다시 필요하면 새 요청을 만들어 주세요.",
    "esg.cancelAsk": "이 서명 요청을 취소할까요? 링크는 더 이상 열리지 않습니다.",
    "esg.canceled": "요청을 취소했습니다.",
    "esg.needSign": "서명 기록을 읽지 못했습니다:",
    "esg.noSignature": "아직 서명하지 않았습니다.",
    "esg.status": "상태",
    "esg.pending": "대기",
    "esg.signed": "서명완료",
    "esg.expired": "만료",
    "esg.canceledStatus": "취소",
    "esg.all": "전체",
    "esg.title": "제목",
    "esg.signer": "서명자",
    "esg.expires": "만료일",
    "esg.createdAt": "요청일",
    "esg.view": "보기",
    "esg.noExpire": "만료 없음",
    "esg.copyLink": "링크 복사",
    "esg.print": "인쇄 / PDF",
    "esg.cancel": "요청 취소",
    "esg.hash": "원문 SHA-256",
    "esg.signedAt": "서명 시각",
    "esg.checks": "동의 항목",
    "esg.signature": "서명 이미지",
    "esg.notChecked": "체크하지 않음",
    "esg.check": "체크",
    "esg.count": "요청 {n}건",
    "esg.required": "필수",
    "esg.optional": "선택",
    "esg.addCheck": "동의 항목 추가",
    "esg.checkPh": "예: 개인정보 수집·이용에 동의합니다",
    "esg.build": "요청 만들기",
    "esg.buildNote": "만들면 서명자에게 보낼 전용 링크가 한 번 표시됩니다. 링크를 아는 사람은 로그인 없이 서명할 수 있습니다.",
    "esg.newTitle": "서명 요청 만들기",
    "esg.listTitle": "요청 목록",
    "esg.detailTitle": "요청 상세",
    "esg.body": "동의서 본문",
    "esg.madeLink": "서명 링크",
    "esg.needUserAgent": "브라우저 정보",
    "esg.checkCount": "{n}개 항목",
    "esg.filterAll": "전체",
    "esg.filterPending": "대기",
    "esg.filterSigned": "서명완료",
    "esg.filterExpired": "만료",
    "esg.filterCanceled": "취소",
    "esg.errSave": "저장하지 못했습니다:",
    "esg.remove": "삭제",
    "esg.emptyFilter": "이 상태의 요청이 없습니다."
  };
  function A(key, vars) {
    var s = T[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", String(vars[k])); });
    return s;
  }
  /* 공개 화면 문구(KO/EN) — #/sign 은 지연 로딩 화면이라 문구도 이 파일에 두어
     첫 화면 전송량(300KB 예산)에 보태지 않습니다. 언어는 assets/i18n.js 의 KO | EN 을 따릅니다. */
  var ES_I18N = {
    ko: {
      "es.eyebrow": "전자서명 · 동의서",
      "es.loading": "서명 요청을 확인하는 중…",
      "es.checklist": "동의 항목",
      "es.required": "필수",
      "es.signLabel": "손글씨 서명",
      "es.clear": "지우기",
      "es.padAria": "서명 패드",
      "es.signHint": "마우스나 손가락으로 서명해 주세요.",
      "es.name": "이름",
      "es.namePh": "서명하는 사람의 이름",
      "es.submit": "서명 제출",
      "es.sending": "서명을 보내는 중…",
      "es.doneTitle": "서명이 완료되었습니다",
      "es.doneHint": "이 화면을 인쇄하거나 PDF 로 저장해 두세요. 원문 해시와 서명 시각이 함께 남습니다.",
      "es.alreadyHint": "이 링크는 이미 서명이 끝났습니다. 같은 링크로 다시 서명할 수 없습니다.",
      "es.print": "인쇄 / PDF 저장",
      "es.backHome": "사이트로",
      "es.hash": "원문 SHA-256",
      "es.hashShort": "원문 해시",
      "es.signer": "서명자",
      "es.signedAt": "서명 시각",
      "es.expires": "만료일",
      "es.signature": "서명",
      "es.printDoc": "전자서명 · 동의서",
      "es.printFoot": "이 문서는 SBPress 전자서명으로 작성되었습니다. 원문 해시가 서명 시점의 문서와 같으면 위변조가 없습니다.",
      "es.invalid": "서명 링크가 올바르지 않습니다. 보낸 사람에게 새 링크를 요청해 주세요.",
      "es.expired": "서명 기한이 지났습니다. 보낸 사람에게 새 링크를 요청해 주세요.",
      "es.canceled": "이 서명 요청은 취소되었습니다.",
      "es.notReady": "아직 전자서명을 준비 중입니다. 관리자가 서명 표를 만들면 이 화면이 열립니다.",
      "es.err.check": "필수 동의 항목을 모두 체크해 주세요.",
      "es.err.name": "이름을 입력해 주세요.",
      "es.err.sign": "서명 패드에 서명해 주세요.",
      "es.err.generic": "서명을 마치지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "es.err.signed": "이미 서명이 끝난 문서입니다.",
      "es.err.expired": "서명 기한이 지났습니다.",
      "es.err.canceled": "취소된 요청입니다.",
      "es.err.token": "서명 링크가 올바르지 않습니다.",
      "es.err.load": "서명 요청을 읽지 못했습니다:"
    },
    en: {
      "es.eyebrow": "E-signature · consent",
      "es.loading": "Checking the signature request…",
      "es.checklist": "Consent items",
      "es.required": "required",
      "es.signLabel": "Handwritten signature",
      "es.clear": "Clear",
      "es.padAria": "Signature pad",
      "es.signHint": "Sign with your mouse or finger.",
      "es.name": "Name",
      "es.namePh": "Name of the signer",
      "es.submit": "Submit signature",
      "es.sending": "Sending your signature…",
      "es.doneTitle": "Signature complete",
      "es.doneHint": "Print this screen or save it as a PDF. The document hash and signing time are kept with it.",
      "es.alreadyHint": "This link has already been signed and cannot be signed again.",
      "es.print": "Print / save PDF",
      "es.backHome": "Back to site",
      "es.hash": "Document SHA-256",
      "es.hashShort": "Document hash",
      "es.signer": "Signer",
      "es.signedAt": "Signed at",
      "es.expires": "Expires",
      "es.signature": "Signature",
      "es.printDoc": "E-signature · consent",
      "es.printFoot": "This document was signed with SBPress e-signature. If the document hash matches the signed version, it has not been altered.",
      "es.invalid": "This signature link is not valid. Please ask the sender for a new link.",
      "es.expired": "This signature request has expired. Please ask the sender for a new link.",
      "es.canceled": "This signature request was canceled.",
      "es.notReady": "E-signature is being prepared. This screen opens once the admin installs the signature tables.",
      "es.err.check": "Please tick every required consent item.",
      "es.err.name": "Please enter your name.",
      "es.err.sign": "Please sign on the pad.",
      "es.err.generic": "We could not complete your signature. Please try again shortly.",
      "es.err.signed": "This document is already signed.",
      "es.err.expired": "This signature request has expired.",
      "es.err.canceled": "This request was canceled.",
      "es.err.token": "The signature link is not valid.",
      "es.err.load": "Could not read the signature request:"
    }
  };
  function I(key, vars) {
    var lang = (window.CRAFT_I18N && window.CRAFT_I18N.isEn && window.CRAFT_I18N.isEn()) ? "en" : "ko";
    var dict = ES_I18N[lang] || ES_I18N.ko;
    var s = dict[key] != null ? dict[key] : (ES_I18N.ko[key] != null ? ES_I18N.ko[key] : key);
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", String(vars[k])); });
    return s;
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isEn() { return !!(window.CRAFT_I18N && window.CRAFT_I18N.isEn && window.CRAFT_I18N.isEn()); }
  function adminToken() {
    if (window.CRAFT_ADMIN && window.CRAFT_ADMIN.token) return window.CRAFT_ADMIN.token();
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.token) return window.CRAFT_AUTH.token();
    return null;
  }
  function msg(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "cms-toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    el.hidden = !text;
  }

  /* ---------------- SHA-256 (crypto.subtle 우선, 없으면 JS 구현) ---------------- */
  function jsSha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), result = "", words = [], asciiBitLength = ascii.length * 8;
    var k = [], i, j;
    var isComposite = {};
    for (var candidate = 2; k.length < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        k.push((mathPow(candidate, 0.5) * maxWord) | 0);
      }
    }
    var hash = k.slice(0, 8), primeCounter = k.slice(0, 8);
    ascii = ascii.replace(/\r\n/g, "\n");
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return "";   /* ASCII 만 — 호출 쪽에서 UTF-8 바이트로 넘깁니다 */
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[ascii.length >> 2] |= 0x80 << ((3 - ascii.length) % 4) * 8;
    var wordsLen = words.length;
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;
    for (j = 0; j < wordsLen; j += 16) {
      var w = words.slice(j, j + 16), oldHash = hash.slice(0);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
            ) | 0
          );
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : "") + b.toString(16);
      }
    }
    return result;
  }
  function utf8Bytes(str) {
    if (window.TextEncoder) return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }
  function sha256Hex(text) {
    var s = String(text == null ? "" : text);
    var subtle = window.crypto && window.crypto.subtle;
    if (subtle && subtle.digest) {
      return subtle.digest("SHA-256", utf8Bytes(s)).then(function (buf) {
        var b = new Uint8Array(buf), out = "";
        for (var i = 0; i < b.length; i++) out += (b[i] < 16 ? "0" : "") + b[i].toString(16);
        return out;
      }, function () { return sha256Fallback(s); });
    }
    return Promise.resolve(sha256Fallback(s));
  }
  function sha256Fallback(s) {
    var bytes = utf8Bytes(s), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return jsSha256(bin);
  }

  /* ---------------- 토큰 · 정규화 · 해시 ---------------- */
  function newToken() {
    var bytes = new Uint8Array(24);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    var out = "";
    for (var j = 0; j < bytes.length; j++) out += (bytes[j] < 16 ? "0" : "") + bytes[j].toString(16);
    return out;
  }
  function normChecks(list) {
    return (list || []).map(function (it, i) {
      if (it == null) return null;
      if (typeof it === "string") return { id: "c" + (i + 1), label: String(it), required: true };
      var label = String(it.label == null ? "" : it.label);
      if (!label.trim()) return null;
      return { id: String(it.id || ("c" + (i + 1))), label: label, required: it.required !== false };
    }).filter(Boolean);
  }
  function canonicalText(title, body, checks) {
    return [String(title || "").trim(), String(body || "").trim(),
            normChecks(checks).map(function (c) {
              return (c.required ? "1" : "0") + ":" + c.id + ":" + c.label;
            }).join("\n")].join("\n");
  }
  function enNow() {
    /* 관리자 화면은 admin-i18n 의 언어를, 공개 화면은 i18n 의 언어를 따릅니다. */
    if (document.getElementById("tab-esign") && window.ADMIN_I18N && window.ADMIN_I18N.lang) {
      return window.ADMIN_I18N.lang() === "en";
    }
    return isEn();
  }
  function fmtTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(enNow() ? "en-GB" : "ko-KR",
        { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return String(iso); }
  }
  function fmtDate(iso) {
    if (!iso) return "";
    return String(iso).slice(0, 10);
  }

  /* ---------------- REST (공개 = anon 키 / 관리자 = 로그인 토큰) ---------------- */
  function request(path, opts) {
    if (!API) return Promise.reject(Object.assign(new Error("supabase_not_configured"), { status: 0 }));
    var o = opts || {};
    var headers = { apikey: KEY, Accept: "application/json" };
    if (o.token) headers.Authorization = "Bearer " + o.token;
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(API + "/rest/v1/" + path, {
      method: o.method || "GET", headers: headers, cache: "no-store",
      body: o.body === undefined ? undefined : JSON.stringify(o.body)
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint || data.details)) || ("HTTP " + r.status));
          err.status = r.status;
          err.code = data && data.code;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function rpc(name, args, token) {
    return request("rpc/" + name, { method: "POST", body: args || {}, token: token });
  }
  function aRest(path, method, body, token) {
    return request(path, { method: method || "GET", body: body, token: token });
  }
  function isMissing(err) {
    if (!err) return false;
    if (err.status === 404) return true;
    return /does not exist|find the (table|function)|schema cache|relation .* does not exist/i.test(String(err.message || ""));
  }
  function rpcError(err) {
    var m = String((err && err.message) || "");
    var r = /(INVALID_TOKEN|ALREADY_SIGNED|CANCELED|EXPIRED|CHECK_REQUIRED|BAD_SIGNATURE|BAD_NAME|BAD_CHECKED)/.exec(m);
    return r ? r[1] : "";
  }

  /* ============================================================================
     공개 서명 화면 (#/sign?token=…) — 마크업·스타일도 이 파일이 만듭니다.
     (첫 화면 300KB 예산을 지키려고 index.html 에는 #/sign 의 무엇도 두지 않습니다.)
     ============================================================================ */
  var VIEW_HTML =
    '<section class="section"><div class="wrap es-wrap">' +
      '<p class="eyebrow es-eyebrow"></p>' +
      '<h1 class="page-title" id="es-title"></h1>' +
      '<div class="es-card" id="es-card" hidden>' +
        '<p class="es-meta" id="es-meta"></p>' +
        '<div class="es-body" id="es-body"></div>' +
        '<div class="es-checks" id="es-checks" hidden></div>' +
        '<div class="es-signbox">' +
          '<div class="es-sign-head"><span class="es-signhead-label"></span>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="es-clear"></button></div>' +
          '<canvas id="es-canvas" class="es-canvas" width="600" height="200"></canvas>' +
          '<p class="es-hint"></p>' +
        '</div>' +
        '<label class="cms-field es-name"><span class="es-namelabel"></span>' +
          '<input id="es-name" type="text" maxlength="80" autocomplete="name"></label>' +
        '<div class="es-actions"><button type="button" class="btn btn-primary" id="es-submit"></button></div>' +
        '<p class="rsv-msg" id="es-msg" role="status" aria-live="polite" hidden></p>' +
      '</div>' +
      '<div class="es-done" id="es-done" hidden>' +
        '<p class="es-done-badge" id="es-done-title"></p>' +
        '<div class="es-done-meta" id="es-done-meta"></div>' +
        '<img class="es-done-img" id="es-done-img" alt="" hidden>' +
        '<p class="es-done-note" id="es-done-note"></p>' +
        '<div class="es-actions">' +
          '<button type="button" class="btn btn-primary" id="es-print"></button>' +
          '<a class="btn btn-ghost" id="es-back" href="#/"></a>' +
        '</div>' +
      '</div>' +
      '<p class="page-empty" id="es-state" hidden></p>' +
    '</div></section>';

  var ES_CSS =
    '.es-wrap{max-width:760px}' +
    '.es-card{margin-top:14px;padding:22px;border:1px solid var(--line);border-radius:var(--r);' +
      'background:var(--card);box-shadow:var(--shadow-s)}' +
    '.es-meta{margin:0 0 12px;font-size:.8rem;color:var(--ink-3);word-break:break-word}' +
    '.es-body{padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-s);' +
      'background:var(--bg-2);font-size:.94rem;line-height:1.78;word-break:break-word}' +
    '.es-checks{margin-top:16px;display:flex;flex-direction:column;gap:8px}' +
    '.es-checks[hidden]{display:none}' +
    '.es-checks-label{margin:0 0 2px;font-size:.82rem;font-weight:800;color:var(--ink-2)}' +
    '.es-check{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);' +
      'border-radius:10px;background:var(--bg);font-size:.9rem;cursor:pointer;line-height:1.6}' +
    '.es-check input{margin-top:3px;flex:none;width:16px;height:16px;accent-color:var(--accent-d)}' +
    '.es-req{flex:none;margin-left:auto;font-style:normal;font-size:.72rem;font-weight:800;' +
      'color:var(--accent-d);background:var(--accent-s);border-radius:999px;padding:2px 8px}' +
    '.es-signbox{margin-top:18px}' +
    '.es-sign-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;' +
      'font-size:.86rem;font-weight:800}' +
    '.es-canvas{display:block;width:100%;max-width:100%;height:200px;border:1px dashed var(--line-2);' +
      'border-radius:var(--r-s);background:#fff;touch-action:none;cursor:crosshair}' +
    '.es-hint{margin:6px 0 0;font-size:.76rem;color:var(--ink-3)}' +
    '.es-name{display:block;margin-top:14px}' +
    '.es-name>span{display:block;margin-bottom:6px;font-size:.84rem;font-weight:700;color:var(--ink-2)}' +
    '.es-name>input{display:block;width:100%;max-width:100%;font:inherit;font-size:.94rem;padding:9px 12px;' +
      'border:1px solid var(--line-2);border-radius:10px;background:#fff}' +
    '.es-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:18px}' +
    '.es-done{margin-top:14px;padding:22px;border:1px solid var(--line);border-radius:var(--r);' +
      'background:var(--card);box-shadow:var(--shadow-s)}' +
    '.es-done-badge{display:inline-block;margin:0 0 12px;padding:6px 14px;border-radius:999px;' +
      'background:#EAF7EE;color:#2C6B3F;font-size:.86rem;font-weight:800}' +
    '.es-done-meta{display:flex;flex-direction:column;gap:2px;margin-bottom:14px;font-size:.86rem}' +
    '.es-done-meta>div{display:flex;gap:12px;justify-content:space-between;padding:6px 0;' +
      'border-bottom:1px dashed var(--line)}' +
    '.es-done-meta span{color:var(--ink-3);flex:none}' +
    '.es-done-meta b{font-weight:700;word-break:break-all;text-align:right}' +
    '.es-done-meta .es-hash{font-size:.72rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}' +
    '.es-done-img{max-width:320px;width:100%;margin:0 0 12px;border:1px solid var(--line);' +
      'border-radius:10px;background:#fff}' +
    '.es-done-img[hidden]{display:none}' +
    '.es-done-note{margin:0;font-size:.82rem;color:var(--ink-2);line-height:1.7}' +
    '.es-print-sheet{display:none}' +
    '.es-print-sheet .es-print-head{border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:16px}' +
    '.es-print-sheet h1{font-size:1.4rem;margin:0 0 4px;line-height:1.35}' +
    '.es-print-sheet .es-print-sub{margin:0;font-size:.78rem;color:#555;letter-spacing:.06em}' +
    '.es-print-sheet .es-print-body{font-size:.92rem;line-height:1.75;white-space:pre-wrap;margin-bottom:16px}' +
    '.es-print-sheet .es-print-h2{font-size:.92rem;margin:0 0 6px}' +
    '.es-print-sheet .es-print-checks{margin:0 0 16px;padding-left:2px;font-size:.86rem;line-height:1.8;list-style:none}' +
    '.es-print-sheet .es-print-table{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:.8rem}' +
    '.es-print-sheet .es-print-table th,.es-print-sheet .es-print-table td{' +
      'border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}' +
    '.es-print-sheet .es-print-table th{width:120px;background:#f2f2f2;font-weight:700}' +
    '.es-print-sheet .es-print-hash{font-family:ui-monospace,Menlo,monospace;font-size:.68rem;word-break:break-all}' +
    '.es-print-sheet .es-print-sign{margin-top:8px}' +
    '.es-print-sheet .es-print-sign p{margin:0 0 6px;font-size:.78rem;color:#555}' +
    '.es-print-sheet .es-print-sign img{max-width:280px;border-bottom:1px solid #333;padding-bottom:4px}' +
    '.es-print-sheet .es-print-nosign{display:inline-block;min-width:200px;border-bottom:1px solid #333}' +
    '.es-print-sheet .es-print-foot{margin-top:22px;font-size:.7rem;color:#666;line-height:1.6}' +
    '@media print{body.is-es-printing>*{display:none !important}' +
      'body.is-es-printing #esign-print-sheet{display:block !important;position:absolute;left:0;top:0;' +
        'width:100%;margin:0;padding:0;background:#fff;color:#000}' +
      'body.is-es-printing{background:#fff}@page{margin:16mm}}';

  function injectStyles() {
    if (document.getElementById("es-style")) return;
    var st = document.createElement("style");
    st.id = "es-style";
    st.textContent = ES_CSS;
    document.head.appendChild(st);
  }

  function buildView() {
    if (document.getElementById("view-sign")) return;
    var main = document.getElementById("main");
    if (!main) return;
    var v = document.createElement("div");
    v.className = "view";
    v.id = "view-sign";
    v.setAttribute("role", "tabpanel");
    v.hidden = true;
    v.innerHTML = VIEW_HTML;
    var mypage = document.getElementById("view-mypage");
    if (mypage && mypage.parentNode === main) main.insertBefore(v, mypage);
    else main.appendChild(v);
    applyText();
  }

  function applyText() {
    var v = document.getElementById("view-sign");
    if (!v) return;
    function set(sel, txt) { var n = v.querySelector(sel); if (n) n.textContent = txt; }
    set(".es-eyebrow", I("es.eyebrow"));
    set(".es-signhead-label", I("es.signLabel"));
    set(".es-namelabel", I("es.name"));
    set(".es-hint", I("es.signHint"));
    set("#es-clear", I("es.clear"));
    set("#es-submit", I("es.submit"));
    set("#es-print", I("es.print"));
    set("#es-back", I("es.backHome"));
    var name = v.querySelector("#es-name");
    if (name) { name.setAttribute("placeholder", I("es.namePh")); name.setAttribute("aria-label", I("es.name")); }
    var cv = v.querySelector("#es-canvas");
    if (cv) cv.setAttribute("aria-label", I("es.padAria"));
    var img = v.querySelector("#es-done-img");
    if (img) img.setAttribute("alt", I("es.signature"));
  }

  /* ============================================================================
     공개 서명 화면 (#/sign?token=…)
     ============================================================================ */
  var PUB = { token: "", doc: null, drawn: false, busy: false, done: null };

  function hashToken() {
    var h = String(location.hash || "");
    var q = h.indexOf("?") >= 0 ? h.slice(h.indexOf("?") + 1) : "";
    var m = /(?:^|&)token=([^&]*)/.exec(q);
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return m[1]; }
  }

  function pubReset() {
    PUB.doc = null; PUB.drawn = false; PUB.busy = false; PUB.done = null;
    var card = $("#es-card"), done = $("#es-done"), state = $("#es-state");
    if (card) card.hidden = true;
    if (done) done.hidden = true;
    if (state) { state.hidden = true; state.textContent = ""; }
    msg("es-msg", "");
    var title = $("#es-title");
    if (title) title.textContent = I("es.loading");
  }
  function pubState(text) {
    var state = $("#es-state");
    if (!state) return;
    state.textContent = text || "";
    state.hidden = !text;
    var title = $("#es-title");
    if (title) title.textContent = I("es.eyebrow");
  }

  /* 손글씨 서명 패드 — 마우스·터치(pointer events) */
  function initPad() {
    var cv = $("#es-canvas");
    if (!cv) return;
    var box = cv.getBoundingClientRect() || { width: 0 };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(Math.round(box.width || 600), 280), h = 200;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.height = h + "px";
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#1c1a17";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    var drawing = false, last = null;
    function pos(e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (w / (r.width || w)), y: (e.clientY - r.top) * (h / (r.height || h)) };
    }
    function down(e) {
      if (PUB.busy) return;
      e.preventDefault();
      drawing = true;
      last = pos(e);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      ctx.beginPath();
      ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#1c1a17";
      ctx.fill();
      cv.setAttribute("data-drawn", "1");
      PUB.drawn = true;
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      PUB.drawn = true;
    }
    function up(e) {
      if (!drawing) return;
      drawing = false;
      try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", up);
    /* pointer events 가 없는 아주 오래된 브라우저 — 마우스·터치를 따로 받습니다. */
    if (!window.PointerEvent) {
      cv.addEventListener("mousedown", down);
      cv.addEventListener("mousemove", move);
      cv.addEventListener("mouseup", up);
      cv.addEventListener("touchstart", function (e) {
        if (e.touches[0]) down({ preventDefault: function () { e.preventDefault(); }, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, pointerId: 1 });
      });
      cv.addEventListener("touchmove", function (e) {
        if (e.touches[0]) move({ preventDefault: function () { e.preventDefault(); }, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      });
      cv.addEventListener("touchend", function () { PUB.drawn = true; });
    }
    clearPad();
  }
  function clearPad() {
    var cv = $("#es-canvas");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
    ctx.strokeStyle = "#1c1a17";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    PUB.drawn = false;
    cv.removeAttribute("data-drawn");
  }

  function renderPublicDoc(doc) {
    PUB.doc = doc;
    var card = $("#es-card");
    if (card) card.hidden = false;
    var title = $("#es-title");
    if (title) title.textContent = doc.title || "";
    var meta = $("#es-meta");
    if (meta) {
      var bits = [];
      if (doc.signer_name) bits.push(esc(doc.signer_name));
      if (doc.expires_at) bits.push(esc(I("es.expires")) + " " + esc(fmtDate(doc.expires_at)));
      if (doc.content_sha256) bits.push(esc(I("es.hashShort")) + " " + esc(String(doc.content_sha256).slice(0, 16)) + "…");
      meta.innerHTML = bits.join(" · ");
    }
    var body = $("#es-body");
    if (body) {
      var text = String(doc.body || "");
      body.innerHTML = text ? esc(text).replace(/\n/g, "<br>") : "";
    }
    var list = $("#es-checks");
    var checks = normChecks(doc.checklist);
    if (list) {
      list.innerHTML = checks.length
        ? '<p class="es-checks-label">' + esc(I("es.checklist")) + "</p>" + checks.map(function (c) {
            return '<label class="es-check"><input type="checkbox" value="' + esc(c.id) + '" data-es-check> ' +
              "<span>" + esc(c.label) + "</span>" +
              (c.required ? ' <em class="es-req">' + esc(I("es.required")) + "</em>" : "") + "</label>";
          }).join("")
        : "";
      list.hidden = !checks.length;
    }
    var name = $("#es-name");
    if (name && !name.value) name.value = doc.signer_name || "";
    initPad();
    var done = $("#es-done");
    if (done) done.hidden = true;
    var state = $("#es-state");
    if (state) state.hidden = true;
    msg("es-msg", "");
  }

  function collectedChecks() {
    return $$("#es-checks [data-es-check]").filter(function (n) { return n.checked; })
      .map(function (n) { return n.value; });
  }

  function submitSign() {
    if (PUB.busy || !PUB.doc) return;
    var checks = normChecks(PUB.doc.checklist);
    var picked = collectedChecks();
    var missing = checks.filter(function (c) { return c.required && picked.indexOf(c.id) < 0; });
    if (missing.length) { msg("es-msg", I("es.err.check"), "err"); return; }
    var nameEl = $("#es-name");
    var name = nameEl ? String(nameEl.value || "").trim() : "";
    if (!name) { msg("es-msg", I("es.err.name"), "err"); return; }
    var cv = $("#es-canvas");
    if (!PUB.drawn || !cv) { msg("es-msg", I("es.err.sign"), "err"); return; }
    var data = "";
    try { data = cv.toDataURL("image/png"); } catch (e) { data = ""; }
    if (!data || data.length < 100) { msg("es-msg", I("es.err.sign"), "err"); return; }

    PUB.busy = true;
    var btn = $("#es-submit");
    if (btn) { btn.disabled = true; btn.textContent = I("es.sending"); }
    msg("es-msg", I("es.sending"));
    rpc("submit_esign", { p_token: PUB.token, p_signer_name: name, p_checked: picked, p_signature_data: data })
      .then(function (res) {
        PUB.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = I("es.submit"); }
        if (!res || !res.ok) { msg("es-msg", I("es.err.generic"), "err"); return; }
        showDone({
          title: res.title || (PUB.doc && PUB.doc.title) || "",
          body: (PUB.doc && PUB.doc.body) || "",
          checklist: normChecks(res.checklist || (PUB.doc && PUB.doc.checklist)),
          checked: res.checked_items || picked,
          signer: res.signer_name || name,
          email: (PUB.doc && PUB.doc.signer_email) || "",
          hash: res.doc_sha256 || (PUB.doc && PUB.doc.content_sha256) || "",
          signedAt: res.signed_at || new Date().toISOString(),
          image: data,
          status: "signed"
        });
      }, function (err) {
        PUB.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = I("es.submit"); }
        if (isMissing(err)) { pubNotReady(); return; }
        var code = rpcError(err);
        if (code === "ALREADY_SIGNED") { msg("es-msg", I("es.err.signed"), "err"); pubReload(); return; }
        if (code === "EXPIRED") { msg("es-msg", I("es.err.expired"), "err"); pubReload(); return; }
        if (code === "CANCELED") { msg("es-msg", I("es.err.canceled"), "err"); return; }
        if (code === "CHECK_REQUIRED") { msg("es-msg", I("es.err.check"), "err"); return; }
        if (code === "BAD_NAME") { msg("es-msg", I("es.err.name"), "err"); return; }
        if (code === "BAD_SIGNATURE") { msg("es-msg", I("es.err.sign"), "err"); return; }
        if (code === "INVALID_TOKEN") { msg("es-msg", I("es.err.token"), "err"); return; }
        msg("es-msg", I("es.err.generic") + " " + String(err.message || ""), "err");
      });
  }

  function showDone(p) {
    PUB.done = p;
    var card = $("#es-card");
    if (card) card.hidden = true;
    var done = $("#es-done");
    if (done) done.hidden = false;
    var title = $("#es-title");
    if (title) title.textContent = p.title || "";
    var head = $("#es-done-title");
    if (head) head.textContent = I("es.doneTitle");
    var meta = $("#es-done-meta");
    if (meta) {
      meta.innerHTML =
        "<div><span>" + esc(I("es.signer")) + "</span><b>" + esc(p.signer) + "</b></div>" +
        "<div><span>" + esc(I("es.signedAt")) + "</span><b>" + esc(fmtTime(p.signedAt)) + "</b></div>" +
        '<div><span>' + esc(I("es.hash")) + '</span><b class="es-hash" id="es-done-hash">' + esc(p.hash) + "</b></div>";
    }
    var img = $("#es-done-img");
    if (img) {
      if (p.image) { img.src = p.image; img.hidden = false; } else { img.removeAttribute("src"); img.hidden = true; }
    }
    var note = $("#es-done-note");
    if (note) note.textContent = I("es.doneHint");
    var state = $("#es-state");
    if (state) state.hidden = true;
  }

  function pubNotReady() {
    pubReset();
    pubState(I("es.notReady"));
  }

  function pubReload() {
    loadToken(PUB.token, true);
  }

  function loadToken(token, quiet) {
    PUB.token = token;
    if (!token) { pubReset(); pubState(I("es.invalid")); return; }
    if (!quiet) {
      pubReset();
      var t = $("#es-title");
      if (t) t.textContent = I("es.loading");
    }
    rpc("get_esign_doc", { p_token: token }).then(function (res) {
      if (!res || !res.found) {
        var reason = res && res.reason;
        if (reason === "expired") { pubReset(); pubState(I("es.expired")); return; }
        if (reason === "canceled") { pubReset(); pubState(I("es.canceled")); return; }
        pubReset();
        pubState(I("es.invalid"));
        return;
      }
      if (res.status === "signed") {
        pubReset();
        showDone({
          title: res.title || "", body: res.body || "", checklist: normChecks(res.checklist),
          checked: [], signer: res.signer_name || "",
          hash: res.content_sha256 || "", signedAt: res.signed_at || "", image: ""
        });
        var note = $("#es-done-note");
        if (note) note.textContent = I("es.alreadyHint");
        return;
      }
      renderPublicDoc(res);
    }, function (err) {
      if (isMissing(err)) { pubNotReady(); return; }
      pubReset();
      pubState(I("es.err.load") + " " + String(err.message || ""));
    });
  }

  /* 인쇄/PDF 용지 — 화면 밖에 만들고 body 에 is-es-printing 을 붙여 그 부분만 인쇄합니다. */
  function printSheet(p) {
    var old = $("#esign-print-sheet");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var checks = normChecks(p.checklist);
    var picked = p.checked || [];
    var sheet = document.createElement("section");
    sheet.id = "esign-print-sheet";
    sheet.className = "es-print-sheet";
    sheet.setAttribute("aria-hidden", "true");
    sheet.innerHTML =
      '<header class="es-print-head"><h1>' + esc(p.title || "") + "</h1>" +
      '<p class="es-print-sub">' + esc(I("es.printDoc")) + "</p></header>" +
      '<div class="es-print-body">' + esc(String(p.body || "")).replace(/\n/g, "<br>") + "</div>" +
      (checks.length ? '<h2 class="es-print-h2">' + esc(I("es.checklist")) + "</h2>" +
        '<ul class="es-print-checks">' + checks.map(function (c) {
          var on = picked.length ? picked.indexOf(c.id) >= 0 : true;
          return "<li>" + (on ? "☑" : "☐") + " " + esc(c.label) +
            (c.required ? " (" + esc(I("es.required")) + ")" : "") + "</li>";
        }).join("") + "</ul>" : "") +
      '<table class="es-print-table"><tbody>' +
      "<tr><th>" + esc(I("es.signer")) + "</th><td>" + esc(p.signer || "") + "</td></tr>" +
      "<tr><th>" + esc(I("es.signedAt")) + "</th><td>" + esc(fmtTime(p.signedAt)) + "</td></tr>" +
      "<tr><th>" + esc(I("es.hash")) + '</th><td class="es-print-hash">' + esc(p.hash || "") + "</td></tr>" +
      "</tbody></table>" +
      '<div class="es-print-sign"><p>' + esc(I("es.signature")) + "</p>" +
      (p.image ? '<img src="' + p.image + '" alt="' + esc(I("es.signature")) + '">' : '<span class="es-print-nosign">—</span>') +
      "</div>" +
      '<p class="es-print-foot">' + esc(I("es.printFoot")) + "</p>";
    document.body.appendChild(sheet);
    document.body.classList.add("is-es-printing");
    try { window.print(); } catch (e) { /* 인쇄 창을 막은 브라우저 */ }
    setTimeout(function () { document.body.classList.remove("is-es-printing"); }, 900);
    return sheet;
  }

  function showSign() {
    applyText();
    var token = hashToken();
    if (token === PUB.token && (PUB.doc || PUB.done)) return;   // 같은 링크로 다시 그리지 않습니다.
    loadToken(token, false);
  }

  /* ============================================================================
     관리자 (/admin → 서명 · 동의서)
     ============================================================================ */
  var AD = { docs: [], signatures: {}, filter: "all", selected: "", tokens: {}, hasTable: true, loaded: false, busy: false };

  function effStatus(d) {
    if (d.status === "pending" && d.expires_at && new Date(d.expires_at).getTime() <= Date.now()) return "expired";
    return d.status || "pending";
  }
  function statusLabel(s) {
    return s === "signed" ? A("esg.signed") : s === "expired" ? A("esg.expired")
      : s === "canceled" ? A("esg.canceledStatus") : A("esg.pending");
  }
  function statusClass(s) {
    return "esg-badge is-" + (s === "signed" ? "signed" : s === "expired" ? "expired"
      : s === "canceled" ? "canceled" : "pending");
  }
  function siteBase() {
    var u = String(SC.siteUrl || "").replace(/\/+$/, "");
    if (u) return u;
    try { return location.origin + location.pathname.replace(/\/[^/]*$/, ""); } catch (e) { return ""; }
  }
  function signUrl(token) {
    return siteBase() + "/#/sign?token=" + encodeURIComponent(token);
  }

  function renderAdminList() {
    var body = $("#esg-table tbody");
    if (!body) return;
    var list = AD.docs.slice();
    if (AD.filter !== "all") list = list.filter(function (d) { return effStatus(d) === AD.filter; });
    var count = $("#esg-count");
    if (count) count.textContent = A("esg.count", { n: list.length });
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6" class="esg-empty">' +
        esc(AD.docs.length ? A("esg.emptyFilter") : A("esg.empty")) + "</td></tr>";
      return;
    }
    body.innerHTML = list.map(function (d) {
      var st = effStatus(d);
      return '<tr data-esg-row="' + esc(d.id) + '"' + (d.id === AD.selected ? ' class="is-selected"' : "") + ">" +
        '<td class="esg-t-title">' + esc(d.title || "") + "</td>" +
        "<td>" + esc(d.signer_name || "") + "</td>" +
        '<td><span class="' + statusClass(st) + '">' + esc(statusLabel(st)) + "</span></td>" +
        "<td>" + esc(d.expires_at ? fmtDate(d.expires_at) : A("esg.noExpire")) + "</td>" +
        "<td>" + esc(fmtDate(d.created_at)) + "</td>" +
        '<td><button type="button" class="rowlink" data-esg-view="' + esc(d.id) + '">' + esc(A("esg.view")) + "</button></td></tr>";
    }).join("");
  }

  function paintFilters() {
    $$("#esg-filters [data-esg-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-esg-filter") === AD.filter ? "true" : "false");
      b.className = "esg-filter" + (b.getAttribute("data-esg-filter") === AD.filter ? " on" : "");
    });
  }

  function loadAdmin(force) {
    if (!window.CRAFT_ADMIN || !adminToken()) {
      msg("esg-msg", A("esg.needAdmin"), "err");
      return;
    }
    if (AD.loaded && !force) { renderAdminList(); return; }
    msg("esg-msg", A("esg.loading"));
    aRest("esign_docs?select=*&order=created_at.desc&limit=200", "GET", undefined, adminToken())
      .then(function (rows) {
        AD.docs = Array.isArray(rows) ? rows : [];
        AD.hasTable = true;
        AD.loaded = true;
        var miss = $("#esg-missing");
        if (miss) miss.hidden = true;
        msg("esg-msg", "");
        paintFilters();
        renderAdminList();
        if (AD.selected) openDetail(AD.selected);
      }, function (err) {
        if (isMissing(err)) {
          AD.hasTable = false;
          AD.docs = [];
          var miss = $("#esg-missing");
          if (miss) miss.hidden = false;
          msg("esg-msg", "");
          renderAdminList();
          return;
        }
        msg("esg-msg", A("esg.errLoad") + " " + String(err.message || ""), "err");
      });
  }

  function addCheckRow(label, required) {
    var box = $("#esg-checks");
    if (!box) return;
    var row = document.createElement("div");
    row.className = "esg-check-row";
    row.innerHTML = '<input type="text" maxlength="120" class="esg-check-label" placeholder="' +
      esc(A("esg.checkPh")) + '" value="' + esc(label || "") + '">' +
      '<label class="esg-check-req"><input type="checkbox" class="esg-check-required"' +
      (required === false ? "" : " checked") + "> " + esc(A("esg.required")) + "</label>" +
      '<button type="button" class="btn btn-ghost btn-sm danger" data-esg-delcheck aria-label="' + esc(A("esg.remove")) + '">×</button>';
    box.appendChild(row);
  }

  function readChecks() {
    return $$("#esg-checks .esg-check-row").map(function (row, i) {
      var label = String(($(".esg-check-label", row) || {}).value || "").trim();
      if (!label) return null;
      var req = $(".esg-check-required", row);
      return { id: "c" + (i + 1), label: label, required: !req || req.checked };
    }).filter(Boolean);
  }

  function createDoc() {
    if (AD.busy) return;
    var title = String(($("#esg-f-title") || {}).value || "").trim();
    var body = String(($("#esg-f-body") || {}).value || "").trim();
    var signer = String(($("#esg-f-signer") || {}).value || "").trim();
    var email = String(($("#esg-f-email") || {}).value || "").trim().toLowerCase();
    var expires = String(($("#esg-f-expires") || {}).value || "").trim();
    var checks = readChecks();
    if (!title) { msg("esg-msg", A("esg.needTitle"), "err"); return; }
    if (!body) { msg("esg-msg", A("esg.needBody"), "err"); return; }
    if (!checks.length) { msg("esg-msg", A("esg.needCheck"), "err"); return; }
    if (!signer) { msg("esg-msg", A("esg.needSigner"), "err"); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg("esg-msg", A("esg.badEmail"), "err"); return; }

    AD.busy = true;
    var btn = $("#esg-create");
    if (btn) btn.disabled = true;
    msg("esg-msg", A("esg.loading"));
    var token = newToken();
    Promise.all([sha256Hex(token), sha256Hex(canonicalText(title, body, checks))])
      .then(function (hs) {
        var row = {
          title: title, body: body, checklist: checks,
          signer_name: signer, signer_email: email,
          token_hash: hs[0], content_sha256: hs[1],
          expires_at: expires ? new Date(expires + "T23:59:59+09:00").toISOString() : null,
          status: "pending", site_key: String(SC.siteKey || "default")
        };
        return aRest("esign_docs", "POST", row, adminToken()).then(function (res) {
          var saved = (Array.isArray(res) ? res[0] : res) || row;
          AD.tokens[saved.id || ""] = token;
          return { saved: saved, token: token };
        });
      })
      .then(function (out) {
        AD.busy = false;
        if (btn) btn.disabled = false;
        msg("esg-msg", A("esg.created"), "ok");
        var box = $("#esg-link");
        var input = $("#esg-link-url");
        if (input) input.value = signUrl(out.token);
        var hashEl = $("#esg-link-hash");
        if (hashEl) hashEl.textContent = out.saved.content_sha256 || "";
        if (box) box.hidden = false;
        AD.loaded = false;
        loadAdmin(true);
      }, function (err) {
        AD.busy = false;
        if (btn) btn.disabled = false;
        if (isMissing(err)) {
          var miss = $("#esg-missing");
          if (miss) miss.hidden = false;
          msg("esg-msg", A("esg.notReady"), "err");
          return;
        }
        msg("esg-msg", A("esg.errSave") + " " + String(err.message || ""), "err");
      });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch (e) { return Promise.resolve(false); }
  }

  function openDetail(id) {
    var d = AD.docs.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    AD.selected = id;
    renderAdminList();
    var panel = $("#p-esg-detail");
    if (panel) panel.hidden = false;
    var st = effStatus(d);
    var head = $("#esg-d-title");
    if (head) head.textContent = d.title || "";
    var meta = $("#esg-d-meta");
    if (meta) {
      meta.innerHTML = '<span class="' + statusClass(st) + '">' + esc(statusLabel(st)) + "</span>" +
        "<span>" + esc(d.signer_name || "") + (d.signer_email ? " · " + esc(d.signer_email) : "") + "</span>" +
        "<span>" + esc(A("esg.createdAt")) + " " + esc(fmtDate(d.created_at)) + "</span>" +
        "<span>" + esc(A("esg.expires")) + " " + esc(d.expires_at ? fmtDate(d.expires_at) : A("esg.noExpire")) + "</span>";
    }
    var bodyBox = $("#esg-d-body");
    if (bodyBox) bodyBox.innerHTML = esc(String(d.body || "")).replace(/\n/g, "<br>");
    var checksBox = $("#esg-d-checks");
    if (checksBox) {
      checksBox.innerHTML = normChecks(d.checklist).map(function (c) {
        return '<li data-esg-check="' + esc(c.id) + '"><span class="esg-mark">☐</span> ' + esc(c.label) +
          (c.required ? ' <em class="esg-req">' + esc(A("esg.required")) + "</em>" : "") + "</li>";
      }).join("");
    }
    var hashEl = $("#esg-d-hash");
    if (hashEl) hashEl.textContent = d.content_sha256 || "";
    var sigBox = $("#esg-d-sig");
    var sigMeta = $("#esg-d-sigmeta");
    if (sigBox) sigBox.hidden = true;
    if (sigMeta) sigMeta.textContent = A("esg.noSignature");
    if (st === "signed") {
      aRest("esign_signatures?select=*&doc_id=eq." + encodeURIComponent(d.id), "GET", undefined, adminToken())
        .then(function (rows) {
          var s = Array.isArray(rows) && rows[0];
          AD.signatures[d.id] = s || null;
          if (!s) return;
          if (sigMeta) {
            sigMeta.innerHTML = "<span>" + esc(s.signer_name || "") + "</span><span>" +
              esc(A("esg.signedAt")) + " " + esc(fmtTime(s.signed_at)) + "</span>";
          }
          if (sigBox && s.signature_data) {
            sigBox.src = s.signature_data;
            sigBox.hidden = false;
          }
          (normChecks(d.checklist) || []).forEach(function (c) {
            var li = $('#esg-d-checks li[data-esg-check="' + c.id + '"]');
            if (li && (s.checked_items || []).indexOf(c.id) >= 0) {
              var mark = $(".esg-mark", li);
              if (mark) mark.textContent = "☑";
            }
          });
          var dh = $("#esg-d-hash");
          if (dh && s.doc_sha256) dh.textContent = s.doc_sha256;
        }, function (err) {
          if (sigMeta) sigMeta.textContent = A("esg.needSign") + " " + String(err.message || "");
        });
    }
    var cancelBtn = $("#esg-d-cancel");
    if (cancelBtn) cancelBtn.hidden = st !== "pending";
    var copyBtn = $("#esg-d-copy");
    if (copyBtn) copyBtn.hidden = !AD.tokens[d.id];
    var tag = $("#esg-d-tag");
    if (tag) tag.textContent = AD.tokens[d.id] ? "" : A("esg.linkOnce");
    var panelTop = panel ? panel.getBoundingClientRect().top : 0;
    if (panel && panelTop < 0) panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function detailPayload() {
    var d = AD.docs.filter(function (x) { return x.id === AD.selected; })[0];
    if (!d) return null;
    var s = AD.signatures[d.id] || null;
    var picked = s && Array.isArray(s.checked_items) ? s.checked_items : [];
    return {
      title: d.title || "", body: d.body || "", checklist: normChecks(d.checklist),
      checked: picked, signer: (s && s.signer_name) || d.signer_name || "",
      hash: (s && s.doc_sha256) || d.content_sha256 || "",
      signedAt: (s && s.signed_at) || d.signed_at || "",
      image: (s && s.signature_data) || ""
    };
  }

  function cancelDoc() {
    var d = AD.docs.filter(function (x) { return x.id === AD.selected; })[0];
    if (!d) return;
    if (!window.confirm(A("esg.cancelAsk"))) return;
    aRest("esign_docs?id=eq." + encodeURIComponent(d.id), "PATCH",
      { status: "canceled", canceled_at: new Date().toISOString() }, adminToken())
      .then(function () {
        d.status = "canceled";
        msg("esg-msg", A("esg.canceled"), "ok");
        renderAdminList();
        openDetail(d.id);
      }, function (err) {
        msg("esg-msg", A("esg.errSave") + " " + String(err.message || ""), "err");
      });
  }

  function bindAdmin() {
    var box = $("#tab-esign");
    if (!box || box.getAttribute("data-esg-bound")) return;
    box.setAttribute("data-esg-bound", "1");
    box.addEventListener("click", function (e) {
      var t = e.target;
      var pick = t.closest && t.closest("[data-esg-filter]");
      if (pick) { AD.filter = pick.getAttribute("data-esg-filter"); paintFilters(); renderAdminList(); return; }
      var del = t.closest && t.closest("[data-esg-delcheck]");
      if (del) { var row = del.closest(".esg-check-row"); if (row && row.parentNode) row.parentNode.removeChild(row); return; }
      var view = t.closest && t.closest("[data-esg-view]");
      if (view) { openDetail(view.getAttribute("data-esg-view")); return; }
      if (t.id === "esg-addcheck") { addCheckRow(); return; }
      if (t.id === "esg-create") { createDoc(); return; }
      if (t.id === "esg-reload") { AD.loaded = false; loadAdmin(true); return; }
      if (t.id === "esg-link-copy") {
        var input = $("#esg-link-url");
        copyText(input ? input.value : "").then(function (ok) {
          msg("esg-msg", ok ? A("esg.copied") : A("esg.copyFail"), ok ? "ok" : "err");
        });
        return;
      }
      if (t.id === "esg-d-copy") {
        var tok = AD.tokens[AD.selected];
        if (!tok) { msg("esg-msg", A("esg.linkOnce"), "err"); return; }
        copyText(signUrl(tok)).then(function (ok) {
          msg("esg-msg", ok ? A("esg.copied") : A("esg.copyFail"), ok ? "ok" : "err");
        });
        return;
      }
      if (t.id === "esg-d-print") {
        var p = detailPayload();
        if (p) printSheet(p);
        return;
      }
      if (t.id === "esg-d-cancel") { cancelDoc(); return; }
    });
    if (!$("#esg-checks") || !$("#esg-checks").children.length) {
      addCheckRow("개인정보 수집·이용에 동의합니다");
      addCheckRow("위 내용을 확인하였으며 이에 동의합니다");
    }
  }

  /* ============================================================================
     공개 화면 이벤트 · 바깥에 내보내는 API
     ============================================================================ */
  function bindPublic() {
    var submit = $("#es-submit");
    if (submit && !submit.getAttribute("data-es-bound")) {
      submit.setAttribute("data-es-bound", "1");
      submit.addEventListener("click", submitSign);
    }
    var clear = $("#es-clear");
    if (clear && !clear.getAttribute("data-es-bound")) {
      clear.setAttribute("data-es-bound", "1");
      clear.addEventListener("click", function (e) { e.preventDefault(); clearPad(); });
    }
    var print = $("#es-print");
    if (print && !print.getAttribute("data-es-bound")) {
      print.setAttribute("data-es-bound", "1");
      print.addEventListener("click", function () {
        if (PUB.done) printSheet(PUB.done);
      });
    }
  }

  window.CRAFT_ESIGN = {
    showSign: function () { bindPublic(); showSign(); },
    loadAdmin: function () { bindAdmin(); loadAdmin(false); },
    printSheet: printSheet,
    /* 시험·다른 화면에서 쓰는 도우미 */
    hash: sha256Hex,
    canonical: canonicalText,
    pad: { clear: clearPad },
    state: function () {
      return { token: PUB.token, doc: PUB.doc, done: PUB.done, docs: AD.docs, filter: AD.filter,
               selected: AD.selected, tokens: Object.keys(AD.tokens), hasTable: AD.hasTable };
    }
  };

  /* KO | EN 을 바꾸면 공개 서명 화면의 문구를 그 자리에서 다시 그립니다.
     (동의 항목 글자는 서명 대상 문서의 내용이라 번역하지 않습니다.) */
  if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
    window.CRAFT_I18N.onChange(function () {
      var view = document.getElementById("view-sign");
      if (!view || view.hidden) return;
      applyText();
      if (PUB.done) { showDone(PUB.done); return; }
      if (PUB.doc) renderPublicDoc(PUB.doc);
    });
  }

  /* 공개 사이트면 #/sign 화면과 스타일을 이 파일이 만듭니다(첫 화면에는 아무것도 두지 않음). */
  injectStyles();
  if (document.getElementById("main") && !document.getElementById("tab-esign")) {
    buildView();
  }

  /* 관리자 화면이면 미리 한 번 묶어 둡니다(탭을 열 때 loadAdmin 이 그립니다). */
  if (document.getElementById("tab-esign")) bindAdmin();
})();
