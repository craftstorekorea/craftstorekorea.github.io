/* SBPress 플러그인 · 콘텐츠 인사이트 팩 (pro-analytics-pack)  v1.0.0
   홈 아래에 「이번 주 콘텐츠 인사이트」 패널을 그립니다. (addWidget 훅)
   화면에 이미 그려진 카드의 종류·글자 수를 세어 요약만 보여 줍니다 —
   서버로 아무것도 보내지 않고, 개인 정보도 읽지 않습니다.
   유료 플러그인입니다(plan: pro · 라이선스 필요). 설치할 때 마켓이 라이선스 키를 확인합니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  window.SBPress.registerPlugin({
    id: "pro-analytics-pack",
    name: "콘텐츠 인사이트 팩",
    version: "1.0.0",
    manifest: { v: 1, hooks: ["widget", "css"], permissions: ["read:card-text", "ui:home-bottom", "css:inject"] },
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "홈 아래에 카드 종류·글자 수·예상 읽기 시간을 요약한 인사이트 패널을 더합니다.",
    license: { required: true, plan: "pro" },
    setup: function (ctx) {
      ctx.addCss([
        ".sbp-insight{margin:18px auto;max-width:1080px;padding:18px 20px;border:1px solid var(--line,rgba(62,47,38,.14));",
        "border-radius:var(--r,14px);background:var(--card,#fff);color:var(--ink,#3e2f26)}",
        ".sbp-insight h2{margin:0 0 4px;font-size:16px;letter-spacing:.01em}",
        ".sbp-insight .sbp-insight-lead{margin:0 0 12px;font-size:12.5px;color:var(--muted,#7a6f66)}",
        ".sbp-insight-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
        ".sbp-insight-cell{border:1px solid var(--line,rgba(62,47,38,.12));border-radius:10px;padding:10px 12px}",
        ".sbp-insight-cell b{display:block;font-size:19px;line-height:1.2}",
        ".sbp-insight-cell span{font-size:11.5px;color:var(--muted,#7a6f66)}",
        ".sbp-insight-tag{display:inline-block;margin:10px 6px 0 0;padding:2px 8px;border-radius:999px;",
        "border:1px solid var(--line,rgba(62,47,38,.16));font-size:11px;font-weight:700;color:var(--muted,#7a6f66)}",
        "@media (max-width:720px){.sbp-insight-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}"
      ].join(""));

      function cells() {
        var cards = [].slice.call(document.querySelectorAll("[data-sbp-card]"));
        var posts = 0, workshops = 0, chars = 0;
        cards.forEach(function (c) {
          var t = (c.getAttribute("data-sbp-type") || "").toLowerCase();
          if (t === "workshop" || c.classList.contains("bcard")) workshops += 1;
          else posts += 1;
          chars += (c.textContent || "").replace(/\s/g, "").length;
        });
        var min = Math.max(1, Math.round(chars / 500));
        return { cards: cards.length, posts: posts, workshops: workshops, chars: chars, min: min };
      }

      function paint(box) {
        var n = cells();
        box.innerHTML = "";
        var sec = document.createElement("section");
        sec.className = "sbp-insight";
        sec.setAttribute("aria-label", "콘텐츠 인사이트");

        var h = document.createElement("h2");
        h.textContent = "이번 주 콘텐츠 인사이트";
        var lead = document.createElement("p");
        lead.className = "sbp-insight-lead";
        lead.textContent = "지금 홈에 보이는 카드를 세어 요약했습니다. 서버로 보내는 자료는 없습니다.";
        sec.appendChild(h);
        sec.appendChild(lead);

        var grid = document.createElement("div");
        grid.className = "sbp-insight-grid";
        [["카드", n.cards], ["글", n.posts], ["공방", n.workshops], ["모두 읽으면", n.min + "분"]].forEach(function (row) {
          var cell = document.createElement("div");
          cell.className = "sbp-insight-cell";
          var b = document.createElement("b");
          b.textContent = String(row[1]);
          var s = document.createElement("span");
          s.textContent = row[0];
          cell.appendChild(b);
          cell.appendChild(s);
          grid.appendChild(cell);
        });
        sec.appendChild(grid);

        var tag = document.createElement("span");
        tag.className = "sbp-insight-tag";
        tag.textContent = "PRO · 분당 500자 기준";
        sec.appendChild(tag);
        box.appendChild(sec);
      }

      ctx.addWidget("home-bottom", function (box) {
        paint(box);
        /* 카드가 늦게 그려지는 화면(라우터)에서도 한 번 더 셉니다. */
        setTimeout(function () { try { paint(box); } catch (e) { /* noop */ } }, 900);
      });
    }
  });
})();
