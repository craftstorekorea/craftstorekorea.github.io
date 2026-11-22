/* ===== 전국공방 · 본문 형식 렌더 (assets/body-format.js) =====
   글·페이지 본문을 형식(text · markdown · html)에 맞춰 안전한 HTML 로 바꿉니다.
   - markdown : 제목·굵게·기울임·목록·인용·코드·링크·이미지를 지원하는 작은 변환기
   - html     : 화이트리스트로 걸러 낸 뒤(스크립트·이벤트 속성·javascript: 주소 제거) 화면에 넣습니다
   - text     : 줄바꿈 그대로(<br>) — 예전 글과 똑같이 보입니다
   DOMParser 로 만든 문서는 스크립트를 실행하지 않고 이미지도 불러오지 않습니다(안전).
   의존 없음. 공개 사이트(app.js)와 관리자 미리보기(admin.js)가 함께 씁니다.
*/
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 화이트리스트 ---------------- */
  var ALLOWED = {
    P: [], BR: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [], DEL: [], INS: [], MARK: [],
    H1: [], H2: [], H3: [], H4: [], H5: [], H6: [],
    A: ["href", "title"], UL: [], OL: ["start"], LI: [], BLOCKQUOTE: [], CODE: [], PRE: [],
    IMG: ["src", "alt", "title", "width", "height"],
    HR: [], FIGURE: [], FIGCAPTION: [], SPAN: [], DIV: [], SUP: [], SUB: [], SMALL: [],
    TABLE: [], THEAD: [], TBODY: [], TFOOT: [], TR: [], TD: ["colspan", "rowspan"], TH: ["colspan", "rowspan"]
  };
  /* 통째로 버리는 태그(안의 글자까지) */
  var DROP = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1,
    TEXTAREA: 1, SELECT: 1, OPTION: 1, SVG: 1, MATH: 1, LINK: 1, META: 1, BASE: 1,
    VIDEO: 1, AUDIO: 1, CANVAS: 1, NOSCRIPT: 1, TEMPLATE: 1
  };

  function safeUrl(raw, kind) {
    var u = String(raw == null ? "" : raw).replace(/[\u0000-\u0020]+/g, "").trim();
    if (!u) return "";
    var low = u.toLowerCase();
    if (low.indexOf("javascript:") === 0 || low.indexOf("vbscript:") === 0 || low.indexOf("data:text/html") === 0) return "";
    if (kind === "img") {
      return /^(https?:)?\/\//i.test(u) || /^[./\w-]/.test(u) ? u : "";
    }
    if (/^(https?:|mailto:|tel:)/i.test(u) || /^[#/?]/.test(u) || /^[\w.-]+(\/|$)/.test(u)) return u;
    return "";
  }

  function cleanNode(node) {
    if (node.nodeType === 3) {                       // 글자
      return esc(node.nodeValue).replace(/\n/g, " ");
    }
    if (node.nodeType !== 1) return "";              // 주석 등

    var tag = node.tagName.toUpperCase();
    if (DROP[tag]) return "";

    var kids = "";
    for (var i = 0; i < node.childNodes.length; i++) kids += cleanNode(node.childNodes[i]);

    if (!ALLOWED.hasOwnProperty(tag)) return kids;   // 모르는 태그는 내용만 남김

    if (tag === "IMG") {
      var src = safeUrl(node.getAttribute("src"), "img");
      if (!src) return "";
      var alt = esc(node.getAttribute("alt") || "");
      var title = node.getAttribute("title");
      return '<img src="' + esc(src) + '" alt="' + alt + '"' +
        (title ? ' title="' + esc(title) + '"' : "") + ' loading="lazy" decoding="async">';
    }

    var attrs = "";
    var allow = ALLOWED[tag];
    for (var a = 0; a < allow.length; a++) {
      var name = allow[a];
      var val = node.getAttribute(name);
      if (val == null || val === "") continue;
      if (name === "href") {
        val = safeUrl(val, "link");
        if (!val) continue;
      }
      if (name === "colspan" || name === "rowspan" || name === "start" || name === "width" || name === "height") {
        if (!/^\d{1,4}$/.test(String(val).trim())) continue;
      }
      attrs += " " + name + '="' + esc(val) + '"';
    }
    if (tag === "A") {
      var href = node.getAttribute("href") || "";
      if (/^https?:/i.test(href)) attrs += ' target="_blank" rel="noopener noreferrer"';
    }
    return "<" + tag.toLowerCase() + attrs + ">" + kids + "</" + tag.toLowerCase() + ">";
  }

  function sanitize(html) {
    var src = String(html == null ? "" : html);
    if (!src.trim()) return "";
    var doc;
    try {
      doc = new DOMParser().parseFromString("<!doctype html><body>" + src + "</body>", "text/html");
    } catch (e) {
      return esc(src).replace(/\n/g, "<br>");
    }
    var body = doc.body, out = "";
    for (var i = 0; i < body.childNodes.length; i++) out += cleanNode(body.childNodes[i]);
    return out;
  }

  /* ---------------- markdown (작은 변환기) ---------------- */
  function inline(s) {
    var t = esc(s);

    // `코드`
    t = t.replace(/`([^`\n]+)`/g, function (m, code) { return "<code>" + code + "</code>"; });
    // ![대체글](주소 "제목")
    t = t.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g, function (m, alt, url, title) {
      var u = safeUrl(url, "img");
      if (!u) return esc(alt);
      return '<img src="' + esc(u) + '" alt="' + alt + '"' + (title ? ' title="' + esc(title) + '"' : "") + ">";
    });
    // [글자](주소)
    t = t.replace(/\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g, function (m, label, url) {
      var u = safeUrl(url, "link");
      if (!u) return label;
      var ext = /^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return '<a href="' + esc(u) + '"' + ext + ">" + label + "</a>";
    });
    // **굵게** · *기울임* · ~~취소선~~
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return t;
  }

  function mdToHtml(md) {
    var lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
    var out = [], i = 0;

    function isBlank(s) { return !String(s || "").trim(); }

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i++; continue; }

      // ``` 코드 블록
      var fence = /^\s*```\s*([A-Za-z0-9+-]*)\s*$/.exec(line);
      if (fence) {
        i++;
        var buf = [];
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;  // 닫는 ```
        out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
        continue;
      }

      // 제목
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        out.push("<h" + h[1].length + ">" + inline(h[2]) + "</h" + h[1].length + ">");
        i++;
        continue;
      }

      // 가로줄
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { out.push("<hr>"); i++; continue; }

      // 인용
      if (/^\s*>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push("<blockquote>" + mdToHtml(q.join("\n")) + "</blockquote>");
        continue;
      }

      // 목록 (순서 있는/없는)
      var ul = /^\s*[-*+]\s+(.*)$/;
      var ol = /^\s*\d+[.)]\s+(.*)$/;
      if (ul.test(line) || ol.test(line)) {
        var ordered = ol.test(line);
        var items = [];
        while (i < lines.length) {
          var m = (ordered ? ol : ul).exec(lines[i]);
          if (!m) break;
          var text = m[1];
          i++;
          // 이어지는 들여쓴 줄은 같은 항목에 붙입니다.
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !ul.test(lines[i]) && !ol.test(lines[i])) {
            text += " " + lines[i].trim();
            i++;
          }
          items.push("<li>" + inline(text) + "</li>");
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
        continue;
      }

      // 문단 (빈 줄까지)
      var para = [];
      while (i < lines.length && !isBlank(lines[i]) &&
             !/^\s*```/.test(lines[i]) && !/^(#{1,6})\s+/.test(lines[i]) &&
             !/^\s*>/.test(lines[i]) && !ul.test(lines[i]) && !ol.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push("<p>" + para.map(inline).join("<br>") + "</p>");
    }
    return out.join("\n");
  }

  function textToHtml(text) {
    return esc(String(text == null ? "" : text)).replace(/\n/g, "<br>");
  }

  function normalize(format) {
    var f = String(format == null ? "" : format).toLowerCase();
    return (f === "markdown" || f === "html") ? f : "text";
  }

  function render(text, format) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return "";
    var f = normalize(format);
    if (f === "markdown") return sanitize(mdToHtml(raw));
    if (f === "html") return sanitize(raw);
    return textToHtml(raw);
  }

  window.CRAFT_BODY = {
    render: render,
    sanitize: sanitize,
    markdown: mdToHtml,
    text: textToHtml,
    normalize: normalize,
    label: function (f) {
      return { text: "일반 텍스트", markdown: "마크다운", html: "HTML" }[normalize(f)];
    }
  };
})();
