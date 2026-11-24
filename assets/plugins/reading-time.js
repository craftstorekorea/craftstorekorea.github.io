/* SBPress 플러그인 · 읽기 시간 배지 (reading-time)  v1.2.0
   글·공방 카드에「약 N분 · N자」배지를 붙입니다. (decorateCard 훅)
   설정(v10.2): chars_per_min(분당 글자 수) · badge_color(배지 강조색) · show_char_count(글자 수 표시)
   카드 글자 수를 분당 글자 수로 나눠 예상 읽기 시간을 계산합니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  window.SBPress.registerPlugin({
    id: "reading-time",
    name: "읽기 시간 배지",
    version: "1.2.0",
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "카드에 예상 읽기 시간과 글자 수를 붙여, 긴 글을 고르기 쉽게 합니다.",
    settings: { chars_per_min: 500, badge_color: "", show_char_count: true },
    setup: function (ctx) {
      ctx.addCss([
        ".sbp-rt{display:inline-block;margin-left:8px;padding:2px 8px;",
        "border:1px solid var(--line,rgba(62,47,38,.16));border-radius:999px;background:var(--paper,#fff);",
        "font-size:11.5px;font-weight:700;letter-spacing:.01em;color:var(--muted,#7a6f66);white-space:nowrap;vertical-align:middle}",
        ".sbp-rt b{font-weight:800;color:var(--ink,#3e2f26)}",
        ".sbp-rt.is-tinted{border-color:currentColor}",
        ".sbp-rt .sbp-rt-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.45}",
        ".news-side .sbp-rt,.bcard-top .sbp-rt{margin-left:0}",
        ".bcard-top .sbp-rt{align-self:center}",
        "@media (max-width:640px){.sbp-rt{font-size:11px;padding:2px 7px}}"
      ].join(""));

      function perMin(s) {
        var n = Number(s.chars_per_min);
        return isFinite(n) && n >= 100 && n <= 2000 ? n : 500;
      }
      function colorOf(s) {
        var c = String(s.badge_color || "").trim();
        return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "";
      }

      /* 설정이 바뀌면 엔진이 카드를 다시 꾸밉니다 — 이 함수는 그릴 때마다 최신 설정을 읽습니다. */
      ctx.decorateCard(function (card, post) {
        if (!card || !post) return;
        var s = ctx.getSettings();
        var chars = Number(post.chars || 0);
        if (chars < 60) {                                      // 짧은 카드는 건너뜁니다
          var old = card.querySelector(".sbp-rt");
          if (old) old.parentNode.removeChild(old);
          return;
        }
        var min = Math.max(1, Math.round(chars / perMin(s)));
        var host = card.querySelector(".news-side, .ws-top, .bcard-top, .iv-top") || card;
        var badge = card.querySelector(".sbp-rt");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "sbp-rt";
          host.appendChild(badge);
        }
        var color = colorOf(s);
        badge.setAttribute("title", "글자 수 " + chars.toLocaleString("ko-KR") + "자 · 분당 " + perMin(s) + "자 기준");
        badge.classList.toggle("is-tinted", !!color);
        badge.style.color = color || "";
        var num = badge.querySelector("b");
        if (!num) {
          badge.innerHTML = "약 <b></b>분";
          num = badge.querySelector("b");
        }
        num.textContent = String(min);
        if (color) num.style.color = color;
        else num.style.color = "";
        var rest = badge.querySelector(".sbp-rt-count");
        if (s.show_char_count === false) {
          if (rest) rest.parentNode.removeChild(rest);
        } else {
          if (!rest) {
            rest = document.createElement("span");
            rest.className = "sbp-rt-count";
            badge.appendChild(rest);
          }
          rest.textContent = " · " + chars.toLocaleString("ko-KR") + "자";
        }
      });
    }
  });
})();
