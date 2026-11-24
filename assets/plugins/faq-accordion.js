/* SBPress 플러그인 · FAQ 아코디언 (faq-accordion)  v1.1.0
   hunmin 커스텀 블록(addBlock 훅)의 첫 기본 플러그인입니다. (v10.4)
   블록: sbp:faq-accordion:faq — 질문 | 답 을 한 줄씩 적으면 <details> 아코디언으로 그립니다.
   설정(v10.2): accent_color(강조색) · show_numbers(번호 표시)
   자바스크립트 없이 <details>/<summary> 만 씁니다(CSP 안전·키보드 접근성). */
(function () {
  "use strict";
  if (!window.SBPress) return;

  var DEFAULT_ITEMS = [
    "예약은 어떻게 하나요? | 홈의 예약 메뉴에서 날짜와 시간을 고르면 접수번호가 발급됩니다.",
    "공방에 직접 가도 되나요? | 네. 영업시간 안에 방문하시면 됩니다. 단체는 미리 연락해 주세요.",
    "재료비가 따로 있나요? | 클래스마다 다르며, 신청 화면에 재료비가 함께 표시됩니다."
  ].join("\n");

  function accent(v) {
    var c = String(v || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "";
  }

  /* "질문 | 답" 한 줄씩 → [{q, a}] (최대 30개). 답이 비어도 질문은 남깁니다. */
  function parseItems(text) {
    return String(text == null ? "" : text).split(/\r?\n/).map(function (line) {
      if (!line.trim()) return null;
      var i = line.indexOf("|");
      var q = (i < 0 ? line : line.slice(0, i)).trim().slice(0, 200);
      var a = (i < 0 ? "" : line.slice(i + 1)).trim().slice(0, 2000);
      return q ? { q: q, a: a } : null;
    }).filter(Boolean).slice(0, 30);
  }

  window.SBPress.registerPlugin({
    id: "faq-accordion",
    name: "FAQ 아코디언",
    name_en: "FAQ accordion",
    version: "1.1.0",
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "hunmin 블록으로 자주 묻는 질문 아카디언을 페이지에 놓습니다.",
    settings: { accent_color: "", show_numbers: true },
    manifest: { v: 1, hooks: ["block", "settings", "css"],
      permissions: ["ui:block", "read:block-data", "css:inject"] },
    settings_schema: [
      {
        key: "accent_color", type: "color",
        label_ko: "강조색", label_en: "Accent color", default: "",
        help_ko: "질문 앞 번호와 펼친 질문의 색입니다. 비우면 사이트 테마 색을 씁니다(#RRGGBB).",
        help_en: "Color of the question numbers and the opened question. Leave empty for the site theme color (#RRGGBB)."
      },
      {
        key: "show_numbers", type: "boolean",
        label_ko: "질문 번호 표시", label_en: "Show question numbers", default: true,
        help_ko: "끄면 번호 없이 질문만 보여 줍니다.",
        help_en: "Turn off to show questions without numbers."
      }
    ],
    setup: function (ctx) {
      ctx.addCss([
        ".sbp-faq{margin:22px 0;padding:0}",
        ".sbp-faq-head{margin:0 0 10px;font-size:1.12rem;font-weight:900;letter-spacing:-.01em;color:var(--ink,#3e2f26)}",
        ".sbp-faq-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}",
        ".sbp-faq-item{border:1px solid var(--line,rgba(62,47,38,.16));border-radius:12px;background:var(--card,#fff);overflow:hidden}",
        ".sbp-faq-item[open]{border-color:var(--sq-accent,var(--accent,#A8542F))}",
        ".sbp-faq-q{display:flex;gap:10px;align-items:baseline;padding:12px 14px;cursor:pointer;font-weight:800;",
        "font-size:.95rem;line-height:1.55;color:var(--ink,#3e2f26);list-style:none}",
        ".sbp-faq-q::-webkit-details-marker{display:none}",
        ".sbp-faq-q::after{content:'+';margin-left:auto;font-weight:900;color:var(--sq-accent,var(--muted,#7a6f66))}",
        ".sbp-faq-item[open] .sbp-faq-q::after{content:'-'}",
        ".sbp-faq-no{flex:none;font-weight:900;color:var(--sq-accent,var(--muted,#7a6f66))}",
        ".sbp-faq-a{margin:0;padding:0 14px 14px 14px;font-size:.9rem;line-height:1.75;color:var(--ink-2,#5b4c42);white-space:pre-wrap}",
        "@media (max-width:640px){.sbp-faq-q{font-size:.92rem;padding:11px 12px}.sbp-faq-a{padding:0 12px 12px}}"
      ].join(""));

      ctx.addBlock({
        id: "faq",
        name_ko: "FAQ 아코디언",
        name_en: "FAQ accordion",
        category: "content",
        fields: [
          {
            key: "title", type: "text",
            label_ko: "제목", label_en: "Title",
            default: "자주 묻는 질문", maxlength: 80,
            placeholder_ko: "자주 묻는 질문", placeholder_en: "Frequently asked questions"
          },
          {
            key: "items", type: "textarea",
            label_ko: "질문과 답", label_en: "Questions and answers",
            default: DEFAULT_ITEMS, maxlength: 4000, rows: 6,
            help_ko: "한 줄에 ‘질문 | 답’ 으로 적습니다. 답이 비어도 질문은 남습니다(최대 30개).",
            help_en: "Write one “question | answer” per line. A question stays even without an answer (up to 30)."
          },
          {
            key: "open_first", type: "boolean",
            label_ko: "첫 질문 펼치기", label_en: "Open the first question", default: true
          }
        ],
        defaultData: { title: "자주 묻는 질문", items: DEFAULT_ITEMS, open_first: true },
        render: function (data, blockCtx) {
          var s = (blockCtx && blockCtx.getSettings) ? blockCtx.getSettings() : {};
          var items = parseItems(data && data.items);
          if (!items.length) return null;
          var color = accent(s.accent_color);
          var numbers = s.show_numbers !== false;

          var sec = document.createElement("section");
          sec.className = "sbp-faq";
          if (color) sec.style.setProperty("--sq-accent", color);

          var title = String((data && data.title) || "").trim();
          if (title) {
            var h = document.createElement("h2");
            h.className = "sbp-faq-head";
            h.textContent = title;
            sec.appendChild(h);
          }
          var list = document.createElement("ul");
          list.className = "sbp-faq-list";
          items.forEach(function (it, i) {
            var li = document.createElement("li");
            var d = document.createElement("details");
            d.className = "sbp-faq-item";
            if (i === 0 && data.open_first === true) d.open = true;
            var sm = document.createElement("summary");
            sm.className = "sbp-faq-q";
            if (numbers) {
              var no = document.createElement("span");
              no.className = "sbp-faq-no";
              no.textContent = "Q" + (i + 1);
              sm.appendChild(no);
            }
            var q = document.createElement("span");
            q.textContent = it.q;
            sm.appendChild(q);
            d.appendChild(sm);
            if (it.a) {
              var p = document.createElement("p");
              p.className = "sbp-faq-a";
              p.textContent = it.a;
              d.appendChild(p);
            }
            li.appendChild(d);
            list.appendChild(li);
          });
          sec.appendChild(list);
          return sec;
        }
      });
    }
  });
})();
