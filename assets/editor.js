/* ===== 전국공방 · 본문 편집기 (assets/editor.js) =====
   글·페이지 편집기의 본문(textarea)에 툴바·이미지 삽입·미리보기를 붙입니다.
   - 형식(select): text(일반) · markdown · html
   - 툴바: 굵게 · 기울임 · 제목 · 링크 · 목록 · 인용 · 이미지 삽입
   - 미리보기: assets/body-format.js 의 안전 렌더 결과를 그대로 보여 줍니다(공개 화면과 같은 모습).
   의존: assets/body-format.js (window.CRAFT_BODY)
   관리자(admin.js)가 글·페이지 편집기 두 곳에 mount() 합니다.
*/
(function () {
  "use strict";

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var BUTTONS = [
    { cmd: "bold", label: "굵게", icon: "<b>B</b>" },
    { cmd: "italic", label: "기울임", icon: "<i>I</i>" },
    { cmd: "heading", label: "제목", icon: "H" },
    { cmd: "link", label: "링크", icon: "🔗" },
    { cmd: "list", label: "목록", icon: "•≡" },
    { cmd: "quote", label: "인용", icon: "❝" },
    { cmd: "image", label: "이미지 삽입", icon: "🖼" }
  ];

  function body() { return window.CRAFT_BODY; }

  function mount(cfg) {
    if (!cfg || !cfg.textarea) return null;
    var ta = cfg.textarea;
    var fmtSel = cfg.format || null;
    var bar = cfg.toolbar || null;
    var prevBox = cfg.preview || null;
    var prevBtn = cfg.previewToggle || null;
    var msg = cfg.msg || null;
    var previewOn = false;

    function format() {
      return body() ? body().normalize(fmtSel ? fmtSel.value : "text") : "text";
    }

    function note(text) {
      if (!msg) return;
      msg.textContent = text || "";
      if (text) setTimeout(function () { if (msg.textContent === text) msg.textContent = ""; }, 2600);
    }

    function fire() {
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /* 선택 영역을 before + (선택 | placeholder) + after 로 감쌉니다. */
    function surround(before, after, placeholder) {
      var s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
      // 이미 감싸져 있으면 한 번 더 누를 때 풀어 줍니다(토글).
      if (s >= before.length && val.slice(s - before.length, s) === before &&
          val.slice(e, e + after.length) === after) {
        ta.setRangeText(val.slice(s, e), s - before.length, e + after.length, "end");
        ta.selectionStart = s - before.length;
        ta.selectionEnd = e - before.length;
        ta.focus();
        fire();
        refresh();
        return;
      }
      var sel = val.slice(s, e) || placeholder || "";
      ta.setRangeText(before + sel + after, s, e, "end");
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
      ta.focus();
      fire();
      refresh();
    }

    /* 커서가 있는 줄(또는 선택한 줄들) 앞에 접두어를 붙이거나 뗍니다. */
    function prefixLine(prefix, placeholder) {
      var val = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      var from = val.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
      var to = val.indexOf("\n", e);
      if (to < 0) to = val.length;
      var block = val.slice(from, to) || placeholder || "";
      var lines = block.split("\n").map(function (ln) {
        return ln.indexOf(prefix) === 0 ? ln.slice(prefix.length) : prefix + ln;
      });
      ta.setRangeText(lines.join("\n"), from, to, "end");
      ta.focus();
      fire();
      refresh();
    }

    function insertAtCaret(text) {
      var s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(text, s, e, "end");
      ta.focus();
      fire();
      refresh();
    }

    /* ---------- 명령 ---------- */
    function run(cmd) {
      if (!bar) return;
      var f = format();
      if (f === "text" && cmd !== "preview") {
        // 일반 텍스트에는 서식이 없어 마크다운으로 바꿔서 넣습니다.
        if (fmtSel) { fmtSel.value = "markdown"; fmtSel.dispatchEvent(new Event("change", { bubbles: true })); }
        f = "markdown";
        note("서식을 쓰려고 본문 형식을 마크다운으로 바꿨습니다.");
      }

      if (cmd === "bold") {
        return f === "html" ? surround("<strong>", "</strong>", "굵은 글자")
                            : surround("**", "**", "굵은 글자");
      }
      if (cmd === "italic") {
        return f === "html" ? surround("<em>", "</em>", "기울인 글자")
                            : surround("*", "*", "기울인 글자");
      }
      if (cmd === "heading") {
        if (f === "html") return surround("<h2>", "</h2>", "소제목");
        return prefixLine("## ", "소제목");
      }
      if (cmd === "list") {
        if (f === "html") return surround("<ul>\n  <li>", "</li>\n</ul>", "목록 항목");
        return prefixLine("- ", "목록 항목");
      }
      if (cmd === "quote") {
        if (f === "html") return surround("<blockquote>", "</blockquote>", "인용할 글");
        return prefixLine("> ", "인용할 글");
      }
      if (cmd === "link") {
        var url = "https://";
        var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || "링크 글자";
        if (f === "html") {
          return insertAtCaret('<a href="' + url + '">' + sel + "</a>");
        }
        return insertAtCaret("[" + sel + "](" + url + ")");
      }
      if (cmd === "image") return pickImage();
    }

    /* ---------- 이미지 삽입 ---------- */
    var fileInput = null;
    function pickImage() {
      if (!cfg.upload) {
        var u = window.prompt ? window.prompt("이미지 주소(URL)를 넣어 주세요.", "https://") : "";
        if (u && u.trim()) insertImage(u.trim(), "");
        return;
      }
      if (!fileInput) {
        fileInput = el("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.className = "sr-only";
        fileInput.setAttribute("data-editor-image", "1");
        document.body.appendChild(fileInput);
        fileInput.addEventListener("change", function () {
          var file = fileInput.files && fileInput.files[0];
          fileInput.value = "";
          if (!file) return;
          note("이미지를 올리는 중…");
          Promise.resolve(cfg.upload(file)).then(function (url) {
            if (!url) throw new Error("업로드 결과가 비어 있습니다.");
            insertImage(url, file.name.replace(/\.[^.]+$/, ""));
            note("이미지를 넣었습니다.");
          }).catch(function (e) {
            note("이미지 업로드 실패: " + ((e && e.message) || "알 수 없는 오류"));
          });
        });
      }
      fileInput.click();
    }

    function insertImage(url, alt) {
      var f = format();
      if (f === "text") {
        if (fmtSel) { fmtSel.value = "markdown"; fmtSel.dispatchEvent(new Event("change", { bubbles: true })); }
        f = "markdown";
      }
      var text = f === "html"
        ? '<img src="' + url + '" alt="' + String(alt || "").replace(/"/g, "&quot;") + '">'
        : "![" + String(alt || "이미지") + "](" + url + ")";
      insertAtCaret((ta.value && !/\n$/.test(ta.value.slice(0, ta.selectionStart)) ? "\n" : "") + text + "\n");
    }

    /* ---------- 미리보기 ---------- */
    function refresh() {
      if (!prevBox || !previewOn) return;
      var html = body() ? body().render(ta.value, format()) : "";
      prevBox.innerHTML = html || '<p class="ed-prev-empty">미리 볼 내용이 없습니다.</p>';
    }

    function togglePreview(force) {
      if (!prevBox) return;
      previewOn = force == null ? !previewOn : !!force;
      prevBox.hidden = !previewOn;
      if (prevBtn) {
        prevBtn.setAttribute("aria-pressed", previewOn ? "true" : "false");
        prevBtn.textContent = previewOn ? "미리보기 닫기" : "미리보기";
      }
      refresh();
    }

    /* ---------- 툴바 그리기 ---------- */
    if (bar) {
      bar.innerHTML = "";
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", "본문 서식");
      BUTTONS.forEach(function (b) {
        var btn = el("button", "ed-btn", b.icon);
        btn.type = "button";
        btn.setAttribute("data-cmd", b.cmd);
        btn.setAttribute("aria-label", b.label);
        btn.title = b.label;
        btn.addEventListener("click", function (e) { e.preventDefault(); run(b.cmd); });
        bar.appendChild(btn);
      });
      var sep = el("span", "ed-sep");
      sep.setAttribute("aria-hidden", "true");
      bar.appendChild(sep);
      var hint = el("span", "ed-hint", "서식을 누르면 본문 형식이 마크다운으로 바뀝니다.");
      bar.appendChild(hint);
    }

    if (prevBtn) prevBtn.addEventListener("click", function (e) { e.preventDefault(); togglePreview(); });
    if (fmtSel) fmtSel.addEventListener("change", function () { refresh(); });
    ta.addEventListener("input", function () { refresh(); });
    // Ctrl/Cmd + B · I
    ta.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = String(e.key || "").toLowerCase();
      if (k === "b") { e.preventDefault(); run("bold"); }
      if (k === "i") { e.preventDefault(); run("italic"); }
    });

    var api = {
      run: run,
      refresh: refresh,
      preview: function (on) { togglePreview(on); },
      format: format,
      reset: function () { if (prevBox) { prevBox.innerHTML = ""; } togglePreview(false); }
    };
    ta.__craftEditor = api;
    return api;
  }

  window.CRAFT_EDITOR = { mount: mount, buttons: BUTTONS };
})();
