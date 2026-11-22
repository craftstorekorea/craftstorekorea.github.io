/* ===== SBPress v5.0 · 구글 드라이브 파일 연동 (assets/drive.js) =====
   6-A 드라이브 연동 — Storage 1GB·업로드 50MB 제한을 구글 드라이브 15GB 로 우회합니다.

   두 갈래
     1) 링크 방식(키 없이 바로) — 드라이브 공유 링크를 붙이면 fileId 를 뽑아
        {provider:'drive', fileId, name, url, preview} 로 저장하고, 클릭하면 미리보기 모달을 엽니다.
        미리보기 주소: drive.google.com/file/d/<id>/preview  (문서·시트·슬라이드는 docs.google.com/…)
     2) Picker — 관리자 [설정 · 연동]에 API 키·앱 ID 가 있으면 'Google Drive에서 선택' 버튼이 동작합니다.
        구글 로그인 세션의 provider token 이 필요하므로, 없으면 다시 동의를 안내합니다.
     3) 자동 업로드 — drive-upload Edge Function 이 있으면 50MB 넘는 파일도 드라이브 폴더로 올립니다.
        함수·키가 없으면 조용히 링크 방식을 안내합니다.

   저장 모양(approval_docs.fields / issues.attachments / posts.attachments)
     {provider:'drive', fileId, name, url, preview, kind:'file'|'folder'|'doc'|'sheet'|'slide'|'form'}

   의존: assets/i18n.js, assets/auth.js(세션), assets/cms.js(site_contents)
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

  /* ---------------- 설정 키 ---------------- */
  var keyCache = null;
  var KEYS = ["drive.picker_api_key", "drive.picker_app_id", "drive.folder_id"];

  function contents() {
    var C = window.CRAFT_CMS;
    return (C && C.contents) ? C.contents() : {};
  }
  function readKeys() {
    if (keyCache) return keyCache;
    var map = contents();
    var out = {};
    var missing = [];
    KEYS.forEach(function (k) {
      var row = map[k];
      out[k] = row && row.value ? String(row.value).trim() : "";
      if (!out[k]) missing.push(k);
    });
    keyCache = out;
    if (missing.length && API) {
      /* CMS 가 아직 site_contents 를 읽기 전이면 한 번만 직접 읽습니다(공개 읽기). */
      fetch(API + "/rest/v1/site_contents?select=key,value&key=in.(" + missing.join(",") + ")", {
        headers: { apikey: KEY, Accept: "application/json" }, cache: "no-store"
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rows) {
        if (!Array.isArray(rows)) return;
        rows.forEach(function (r) { if (r && r.key) out[r.key] = String(r.value || "").trim(); });
      }).catch(function () { /* 없으면 링크 방식만 */ });
    }
    return out;
  }
  function pickerReady() {
    var k = readKeys();
    return !!(k["drive.picker_api_key"] && k["drive.picker_app_id"]);
  }

  /* ---------------- 링크 파싱 ---------------- */
  var PATTERNS = [
    { re: /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/, kind: "file" },
    { re: /drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]{10,})/, kind: "folder" },
    { re: /docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{10,})/, kind: "doc" },
    { re: /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})/, kind: "sheet" },
    { re: /docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]{10,})/, kind: "slide" },
    { re: /docs\.google\.com\/forms\/d\/([A-Za-z0-9_-]{10,})/, kind: "form" }
  ];

  function previewUrl(kind, id) {
    if (kind === "folder") return "https://drive.google.com/embeddedfolderview?id=" + id + "#list";
    if (kind === "doc") return "https://docs.google.com/document/d/" + id + "/preview";
    if (kind === "sheet") return "https://docs.google.com/spreadsheets/d/" + id + "/preview";
    if (kind === "slide") return "https://docs.google.com/presentation/d/" + id + "/preview";
    if (kind === "form") return "https://docs.google.com/forms/d/" + id + "/viewform?embedded=true";
    return "https://drive.google.com/file/d/" + id + "/preview";
  }
  function canonicalUrl(kind, id) {
    if (kind === "folder") return "https://drive.google.com/drive/folders/" + id;
    if (kind === "doc") return "https://docs.google.com/document/d/" + id + "/edit";
    if (kind === "sheet") return "https://docs.google.com/spreadsheets/d/" + id + "/edit";
    if (kind === "slide") return "https://docs.google.com/presentation/d/" + id + "/edit";
    if (kind === "form") return "https://docs.google.com/forms/d/" + id + "/viewform";
    return "https://drive.google.com/file/d/" + id + "/view";
  }

  /** 공유 링크 → {provider, fileId, name, url, preview, kind} (드라이브 링크가 아니면 null) */
  function parse(url) {
    var s = String(url == null ? "" : url).trim();
    if (!s) return null;
    var kind = "", id = "";
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = PATTERNS[i].re.exec(s);
      if (m) { kind = PATTERNS[i].kind; id = m[1]; break; }
    }
    if (!id) {
      var q = /[?&]id=([A-Za-z0-9_-]{10,})/.exec(s);
      if (q && /drive\.google\.com|docs\.google\.com/.test(s)) { id = q[1]; kind = "file"; }
    }
    if (!id) return null;
    var name = "";
    var nq = /[?&]name=([^&]+)/.exec(s);
    if (nq) { try { name = decodeURIComponent(nq[1].replace(/\+/g, " ")); } catch (e) { name = ""; } }
    if (!name) name = kind === "folder" ? I("drive.folder") : I("drive.file");
    return {
      provider: "drive", fileId: id, name: name, kind: kind,
      url: canonicalUrl(kind, id), preview: previewUrl(kind, id)
    };
  }

  /** 예전 문서의 attachment(문자열) · attachment_meta 도 함께 읽습니다. */
  function fromFields(fields) {
    var f = fields || {};
    if (Array.isArray(f.attachments) && f.attachments.length) return f.attachments.filter(Boolean);
    var meta = f.attachment_meta;
    if (meta && typeof meta === "object" && meta.fileId) return [meta];
    var url = f.attachment;
    if (typeof url === "string" && url) {
      var p = parse(url);
      if (p) return [p];
      return [{ provider: "link", url: url, name: url, preview: "" }];
    }
    return [];
  }

  function icon(kind) {
    return { folder: "📁", doc: "📄", sheet: "📊", slide: "🖼️", form: "📝" }[kind] || "📎";
  }

  /* ---------------- 칩 · 미리보기 ---------------- */
  function chipHtml(att, opts) {
    opts = opts || {};
    var a = att || {};
    var name = a.name || a.url || "";
    var cls = "drive-chip" + (opts.removable ? " has-x" : "");
    var label = '<span class="drive-chip-ic" aria-hidden="true">' + icon(a.kind) + "</span>" +
      '<span class="drive-chip-name">' + esc(name) + "</span>" +
      (a.provider === "drive" ? '<span class="drive-chip-tag">Drive</span>' : "");
    var body;
    if (a.provider === "drive" && a.fileId) {
      body = '<button type="button" class="drive-chip-main" data-drive-preview="' + esc(a.fileId) +
        '" data-drive-kind="' + esc(a.kind || "file") + '" data-drive-name="' + esc(name) + '" title="' +
        esc(I("drive.preview")) + '">' + label + "</button>";
    } else {
      body = '<a class="drive-chip-main" href="' + esc(a.url || "#") + '" target="_blank" rel="noopener">' + label + "</a>";
    }
    return '<span class="' + cls + '">' + body +
      (opts.removable ? '<button type="button" class="drive-chip-x" data-drive-remove="1" aria-label="' +
        esc(I("drive.remove")) + '">×</button>' : "") + "</span>";
  }

  function preview(att) {
    var a = typeof att === "string" ? parse(att) || { url: att } : (att || {});
    var src = a.preview || (a.fileId ? previewUrl(a.kind || "file", a.fileId) : "");
    var box = $("#drive-modal");
    if (!box) {
      box = document.createElement("div");
      box.id = "drive-modal";
      box.className = "drive-modal";
      box.hidden = true;
      box.innerHTML =
        '<div class="drive-backdrop" data-drive-close="1"></div>' +
        '<div class="drive-card" role="dialog" aria-modal="true" aria-labelledby="drive-title">' +
          '<div class="drive-head"><b id="drive-title"></b>' +
            '<a class="drive-open" id="drive-open" target="_blank" rel="noopener"></a>' +
            '<button type="button" class="drive-x" data-drive-close="1" aria-label="' + esc(I("drive.close")) + '">×</button>' +
          "</div>" +
          '<div class="drive-frame" id="drive-frame"></div>' +
        "</div>";
      document.body.appendChild(box);
      box.addEventListener("click", function (e) {
        if (e.target.closest("[data-drive-close]")) closePreview();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !box.hidden) closePreview();
      });
    }
    if (!src) return;
    $("#drive-title").textContent = a.name || I("drive.preview");
    var open = $("#drive-open");
    open.href = a.url || src;
    open.textContent = I("drive.openTab");
    $("#drive-frame").innerHTML =
      '<iframe src="' + esc(src) + '" title="' + esc(a.name || I("drive.preview")) +
      '" allow="autoplay; encrypted-media" referrerpolicy="no-referrer" loading="lazy"></iframe>' +
      '<p class="drive-note">' + esc(I("drive.previewNote")) + "</p>";
    box.hidden = false;
    document.body.classList.add("drive-open");
  }
  function closePreview() {
    var box = $("#drive-modal");
    if (!box) return;
    box.hidden = true;
    $("#drive-frame").innerHTML = "";
    document.body.classList.remove("drive-open");
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-drive-preview]");
    if (!b) return;
    e.preventDefault();
    var id = b.getAttribute("data-drive-preview");
    var kind = b.getAttribute("data-drive-kind") || "file";
    preview({ fileId: id, kind: kind, name: b.getAttribute("data-drive-name") || "",
              url: canonicalUrl(kind, id), preview: previewUrl(kind, id) });
  });

  /* ---------------- 입력칸 확장 ----------------
     opts: { value, name, removable, onChange(att|null), placeholderKey } */
  function enhance(input, opts) {
    if (!input || input.getAttribute("data-drive-ready") === "1") return null;
    opts = opts || {};
    input.setAttribute("data-drive-ready", "1");
    input.classList.add("drive-input");
    input.type = "url";
    input.placeholder = I(opts.placeholderKey || "drive.ph");

    var wrap = document.createElement("div");
    wrap.className = "drive-field";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var bar = document.createElement("div");
    bar.className = "drive-bar";
    bar.innerHTML =
      '<button type="button" class="btn btn-ghost btn-sm drive-pick" data-drive-pick="1">' +
        '<span aria-hidden="true">🔺</span> ' + esc(I("drive.pick")) + "</button>" +
      '<span class="drive-help">' + esc(I(pickerReady() ? "drive.pickHint" : "drive.pickHintOff")) + "</span>";
    var chipBox = document.createElement("div");
    chipBox.className = "drive-chips";
    wrap.appendChild(bar);
    wrap.appendChild(chipBox);

    var current = null;
    function set(att, fire) {
      current = att && att.fileId ? att : null;
      chipBox.innerHTML = current ? chipHtml(current, { removable: true }) : "";
      if (current) input.value = current.url;
      if (fire && typeof opts.onChange === "function") opts.onChange(current);
    }
    function fromValue() {
      var p = parse(input.value);
      set(p, true);
      return p;
    }

    input.addEventListener("input", function () { fromValue(); });
    input.addEventListener("change", function () { fromValue(); });
    input.addEventListener("blur", function () {
      var p = parse(input.value);
      if (p) { set(p, true); return; }
      if (!String(input.value || "").trim()) set(null, true);
    });

    wrap.addEventListener("click", function (e) {
      if (e.target.closest("[data-drive-remove]")) {
        input.value = "";
        set(null, true);
        input.focus();
        return;
      }
      if (!e.target.closest("[data-drive-pick]")) return;
      openPicker(function (att) {
        if (!att) return;
        set(att, true);
        input.value = att.url;
      });
    });

    if (opts.value) {
      var pv = typeof opts.value === "string" ? parse(opts.value) : opts.value;
      if (pv && pv.fileId) { set(pv, false); input.value = pv.url; }
      else if (typeof opts.value === "string" && opts.value && !opts.value.startsWith("{")) {
        input.value = opts.value;
      }
    }
    return { set: set, get: function () { return current; }, input: input, box: wrap };
  }

  /* ---------------- 구글 Picker ---------------- */
  function providerToken() {
    return (window.CRAFT_AUTH && window.CRAFT_AUTH.providerToken) ? window.CRAFT_AUTH.providerToken() : "";
  }

  function loadScript(src, cb) {
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error("load_failed")); };
    document.head.appendChild(s);
  }

  function openPicker(done) {
    done = typeof done === "function" ? done : function () {};
    var k = readKeys();
    if (!k["drive.picker_api_key"] || !k["drive.picker_app_id"]) {
      done(null);
      return notify(I("drive.needKeys"), "warn");
    }
    var token = providerToken();
    if (!token) {
      done(null);
      notify(I("drive.needConsent"), "warn");
      if (window.CRAFT_AUTH && window.CRAFT_AUTH.openLogin) {
        window.CRAFT_AUTH.openLogin(I("drive.needConsent"));
      }
      return;
    }
    function ready() {
      try {
        gapi.load("picker", function () {
          var view = new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
          var picker = new google.picker.PickerBuilder()
            .setAppId(k["drive.picker_app_id"])
            .setOAuthToken(token)
            .setDeveloperKey(k["drive.picker_api_key"])
            .addView(view)
            .setCallback(function (data) {
              if (data.action !== google.picker.Action.PICKED || !data.docs || !data.docs.length) return;
              var d = data.docs[0];
              var p = parse(d.url || "") || {};
              var att = {
                provider: "drive", fileId: d.id, name: d.name || p.name || "",
                kind: /folder/.test(d.mimeType || "") ? "folder" : (p.kind || "file"),
                url: d.url || canonicalUrl(p.kind || "file", d.id)
              };
              att.preview = previewUrl(att.kind, att.fileId);
              done(att);
            })
            .build();
          picker.setVisible(true);
        });
      } catch (e) { notify(I("drive.needKeys"), "warn"); }
    }
    if (window.gapi && window.gapi.load) return ready();
    loadScript("https://apis.google.com/js/api.js", function (err) {
      if (err || !window.gapi) { notify(I("drive.needKeys"), "warn"); return; }
      ready();
    });
  }

  /* ---------------- 자동 업로드 (drive-upload) ---------------- */
  function functionsBase() {
    return (window.SBP_FUNCTIONS_URL || (API ? API + "/functions/v1" : ""));
  }
  function upload(file, meta) {
    meta = meta || {};
    if (!file) return Promise.resolve({ ok: false, error: "file_required" });
    var base = functionsBase();
    var t = (window.CRAFT_AUTH && window.CRAFT_AUTH.token) ? window.CRAFT_AUTH.token() : "";
    if (!base || !t) return Promise.resolve({ ok: false, error: "not_signed_in" });
    var fd = new FormData();
    fd.append("file", file);
    fd.append("doc_kind", meta.doc_kind || "file");
    if (meta.doc_id) fd.append("doc_id", meta.doc_id);
    if (meta.doc_no) fd.append("doc_no", meta.doc_no);
    return fetch(base + "/drive-upload", {
      method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + t }, body: fd
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) return { ok: false, error: (data && (data.error || data.detail)) || ("HTTP " + r.status) };
        return { ok: true, att: {
          provider: "drive", fileId: data.fileId, name: data.name || file.name,
          url: data.url, preview: data.previewUrl, kind: "file"
        } };
      });
    }).catch(function (e) { return { ok: false, error: String((e && e.message) || e) }; });
  }

  /* ---------------- 동의 저장 (refresh token → Edge Function) ----------------
     구글 로그인 응답의 provider_refresh_token 은 한 번만 오므로, 그때 서버에 암호화해 둡니다.
     브라우저에는 저장하지 않습니다. 함수가 없으면 조용히 넘어갑니다. */
  function saveConsent(session) {
    var rt = session && session.provider_refresh_token;
    if (!rt) return Promise.resolve(false);
    var base = functionsBase();
    if (!base) return Promise.resolve(false);
    return fetch(base + "/drive-upload?action=token", {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refresh_token: rt,
        email: (session.user && session.user.email) || "",
        scopes: "https://www.googleapis.com/auth/drive.file"
      })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  /* ---------------- 작은 안내 ---------------- */
  function notify(text, kind) {
    var el = document.createElement("div");
    el.className = "drive-toast" + (kind ? " is-" + kind : "");
    el.setAttribute("role", "status");
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4200);
  }

  window.SBP_DRIVE = {
    parse: parse, fromFields: fromFields, chip: chipHtml, preview: preview, close: closePreview,
    enhance: enhance, picker: openPicker, pickerReady: pickerReady, keys: readKeys,
    upload: upload, saveConsent: saveConsent, notify: notify,
    canonicalUrl: canonicalUrl, previewUrl: previewUrl
  };
})();
