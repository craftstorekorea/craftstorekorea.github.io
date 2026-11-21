/* SBPress 플러그인 · 읽기 시간 배지 (reading-time)
   글·공방 카드에「약 N분 · N자」배지를 붙입니다. (decorateCard 훅)
   카드 글자 수를 500자/분으로 나눠 예상 읽기 시간을 계산합니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  window.SBPress.registerPlugin({
    id: "reading-time",
    name: "읽기 시간 배지",
    version: "1.0.0",
    author: "전국공방",
    description: "카드에 예상 읽기 시간과 글자 수를 붙여, 긴 글을 고르기 쉽게 합니다.",
    setup: function (ctx) {
      ctx.addCss([
        ".sbp-rt{display:inline-block;margin-left:8px;padding:2px 8px;",
        "border:1px solid var(--line,rgba(62,47,38,.16));border-radius:999px;background:var(--paper,#fff);",
        "font-size:11.5px;font-weight:700;letter-spacing:.01em;color:var(--muted,#7a6f66);white-space:nowrap;vertical-align:middle}",
        ".sbp-rt b{font-weight:800;color:var(--ink,#3e2f26)}",
        ".sbp-rt .sbp-rt-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.45}",
        ".news-side .sbp-rt,.bcard-top .sbp-rt{margin-left:0}",
        ".bcard-top .sbp-rt{align-self:center}",
        "@media (max-width:640px){.sbp-rt{font-size:11px;padding:2px 7px}}"
      ].join(""));

      ctx.decorateCard(function (card, post) {
        if (!card || !post) return;
        if (card.querySelector(".sbp-rt")) return;            // 이미 붙었으면 그대로
        var chars = Number(post.chars || 0);
        if (chars < 60) return;                               // 짧은 카드는 건너뜁니다
        var min = Math.max(1, Math.round(chars / 500));
        var badge = document.createElement("span");
        badge.className = "sbp-rt";
        badge.setAttribute("title", "글자 수 " + chars.toLocaleString("ko-KR") + "자 · 분당 500자 기준");
        badge.innerHTML = "약 <b>" + min + "</b>분 · " + chars.toLocaleString("ko-KR") + "자";
        var host = card.querySelector(".news-side, .ws-top, .bcard-top, .iv-top") || card;
        host.appendChild(badge);
      });
    }
  });
})();
