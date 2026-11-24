/* SBPress 플러그인 · 맨 위로 버튼 (scroll-top)  v1.1.1
   오른쪽 아래에 떠 있는 '맨 위로' 버튼을 붙입니다. (addWidget 'floating' + CSS)
   설정(v10.2): threshold_px(나타나는 스크롤 위치) · position(왼쪽/오른쪽 아래)
   누르면 부드럽게 맨 위로 올라갑니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  var PREFS = { threshold: 400, position: "right" };

  function readPrefs(ctx) {
    var s = ctx.getSettings();
    var t = Number(s.threshold_px);
    PREFS.threshold = isFinite(t) && t >= 0 && t <= 3000 ? t : 400;
    PREFS.position = String(s.position || "right") === "left" ? "left" : "right";
    return PREFS;
  }

  function yNow() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function sync() {
    [].forEach.call(document.querySelectorAll(".sbp-top"), function (b) {
      b.classList.toggle("show", yNow() > PREFS.threshold);
    });
    var layer = document.getElementById("sbp-floating");
    if (layer) {
      layer.classList.toggle("is-left", PREFS.position === "left");
      layer.classList.toggle("is-right", PREFS.position !== "left");
    }
  }

  window.SBPress.registerPlugin({
    id: "scroll-top",
    name: "맨 위로 버튼",
    version: "1.1.1",
    manifest: { v: 1, hooks: ["widget", "css", "settings"], permissions: ["ui:floating", "css:inject"] },
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "긴 페이지·게시판에서 오른쪽 아래 '맨 위로' 버튼을 띄웁니다.",
    settings: { threshold_px: 400, position: "right" },
    setup: function (ctx) {
      ctx.addCss([
        "#sbp-floating{position:fixed;right:18px;bottom:18px;z-index:70;display:flex;flex-direction:column;gap:10px;align-items:flex-end;pointer-events:none}",
        "#sbp-floating.is-left{right:auto;left:18px;align-items:flex-start}",
        "#sbp-floating>*{pointer-events:auto}",
        ".sbp-top{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line,rgba(62,47,38,.18));",
        "background:var(--paper,#fff);color:var(--ink,#3e2f26);border-radius:999px;padding:10px 15px 10px 13px;",
        "font:800 13px/1 'Nanum Gothic',sans-serif;box-shadow:0 10px 24px rgba(62,47,38,.16);cursor:pointer;",
        "opacity:0;transform:translateY(10px);transition:opacity .18s ease,transform .18s ease}",
        ".sbp-top.show{opacity:1;transform:none}",
        ".sbp-top:hover{border-color:var(--accent,#C86D44);color:var(--accent,#C86D44)}",
        ".sbp-top svg{width:14px;height:14px}",
        "@media (max-width:640px){#sbp-floating{right:12px;bottom:12px}#sbp-floating.is-left{right:auto;left:12px}.sbp-top{padding:9px 13px 9px 11px;font-size:12px}}",
        "@media print{#sbp-floating{display:none!important}}"
      ].join(""));

      ctx.addWidget("floating", function (box) {
        readPrefs(ctx);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sbp-top";
        btn.setAttribute("aria-label", "맨 위로");
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5.5 11.5 6.5-6.5 6.5 6.5"/></svg><span>맨 위로</span>';
        btn.addEventListener("click", function () {
          try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
        });
        box.appendChild(btn);

        if (!window.__sbpScrollTopBound) {
          window.__sbpScrollTopBound = true;
          window.addEventListener("scroll", function () { sync(); }, { passive: true });
        }
        sync();
      });

      /* 설정을 저장하면 위치·기준을 바로 다시 적용합니다. */
      ctx.onSettingsChange(function () {
        readPrefs(ctx);
        sync();
      });
    }
  });
})();
