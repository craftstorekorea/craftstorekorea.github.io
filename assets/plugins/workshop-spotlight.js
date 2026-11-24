/* SBPress 플러그인 · 추천 공방 스포트라이트 (workshop-spotlight)  v1.1.0
   홈 맨 위(home-top 존)에 '추천 공방 + 마감 임박' 하이라이트 배너를 띄웁니다.
   설정(v10.2): limit(보여 줄 마감·공방 수) · heading(배너 제목)
   (addWidget 훅) — data.js 의 info(마감일)·workshops 를 쓰고, 지도에 실시간으로
   실린 공방(window.CRAFT_APP.mapPlaces)도 후보에 넣습니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  window.SBPress.registerPlugin({
    id: "workshop-spotlight",
    name: "추천 공방 스포트라이트",
    version: "1.1.0",
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "홈 맨 위에 이번 주 추천 공방과 마감 임박 공모·체험을 모아 보여 줍니다.",
    settings: { limit: 2, heading: "" },
    setup: function (ctx) {
      ctx.addCss([
        ".sbp-zone[data-sbp-zone=\"home-top\"]{max-width:1200px;margin:22px auto 0;padding:0 28px}",
        "@media (max-width:900px){.sbp-zone[data-sbp-zone=\"home-top\"]{padding:0 18px;margin-top:16px}}",
        ".sbp-spot{display:grid;grid-template-columns:minmax(220px,.85fr) minmax(0,1.35fr);gap:22px;align-items:center;",
        "border:1px solid var(--line,rgba(62,47,38,.14));border-radius:18px;background:linear-gradient(135deg,rgba(200,109,68,.09),rgba(200,109,68,.02) 55%,var(--paper,#fff));",
        "padding:20px 24px;box-shadow:0 1px 0 rgba(62,47,38,.04)}",
        ".sbp-spot-eyebrow{margin:0 0 6px;font:800 11px/1 'Nanum Gothic',sans-serif;letter-spacing:.14em;color:var(--accent,#C86D44);text-transform:uppercase}",
        ".sbp-spot h2{margin:0 0 6px;font-size:23px;line-height:1.28;letter-spacing:-.02em}",
        ".sbp-spot h2 em{font-style:normal;color:var(--accent,#C86D44)}",
        ".sbp-spot-desc{margin:0;font-size:13px;line-height:1.6;color:var(--muted,#7a6f66)}",
        ".sbp-spot-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}",
        ".sbp-spot-list a{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 10px;align-items:center;",
        "padding:10px 12px;border:1px solid var(--line,rgba(62,47,38,.12));border-radius:12px;background:var(--paper,#fff);",
        "text-decoration:none;color:inherit;transition:border-color .15s ease,transform .15s ease}",
        ".sbp-spot-list a:hover{border-color:var(--accent,#C86D44);transform:translateY(-1px)}",
        ".sbp-spot-list b{font-size:14px;line-height:1.35;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".sbp-spot-list small{grid-column:2;font-size:12px;color:var(--muted,#7a6f66)}",
        ".sbp-spot-tag{grid-row:span 2;display:inline-flex;align-items:center;justify-content:center;min-width:52px;",
        "padding:5px 8px;border-radius:8px;background:rgba(200,109,68,.12);color:var(--accent,#C86D44);font:800 11px/1 'Nanum Gothic',sans-serif;white-space:nowrap}",
        ".sbp-spot-tag.soon{background:rgba(62,47,38,.08);color:var(--ink,#3e2f26)}",
        "@media (max-width:820px){.sbp-spot{grid-template-columns:1fr;gap:14px;padding:18px}.sbp-spot h2{font-size:20px}}"
      ].join(""));

      function dayNum(d) {
        var p = String(d || "").slice(0, 10).split("-");
        if (p.length !== 3) return null;
        return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
      }
      function todayNum() {
        var now = new Date();
        var kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 9 * 3600000);
        return Date.UTC(kst.getFullYear(), kst.getMonth(), kst.getDate()) / 86400000;
      }
      function dday(due) {
        var n = dayNum(due);
        if (n == null) return null;
        return n - todayNum();
      }
      function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }
      function limitOf(s) {
        var n = Number(s.limit);
        if (!isFinite(n)) return 2;
        return Math.max(1, Math.min(5, Math.round(n)));
      }

      ctx.addWidget("home-top", function (box) {
        var s = ctx.getSettings();
        var limit = limitOf(s);
        var heading = String(s.heading || "").trim();

        var S = window.SITE || {};
        var info = (S.info || []).map(function (it) {
          var d = dday(it.due);
          return { it: it, d: d };
        }).filter(function (x) { return x.d != null && x.d >= 0 && x.d <= 14; })
          .sort(function (a, b) { return a.d - b.d; })
          .slice(0, limit);

        var pool = (S.workshops || []).slice();
        try {
          if (window.CRAFT_APP && window.CRAFT_APP.mapPlaces) {
            window.CRAFT_APP.mapPlaces().forEach(function (w) {
              if (w && w.name && !pool.some(function (p) { return p.name === w.name; })) pool.push(w);
            });
          }
        } catch (e) { /* 지도 데이터가 없어도 동작 */ }
        var pick = null;
        if (pool.length) {
          var i = todayNum() % pool.length;
          pick = pool[i] || pool[0];
        }

        var rows = "";
        info.forEach(function (x) {
          var dd = x.d === 0 ? "D-DAY" : "D-" + x.d;
          rows += '<li><a href="#/info"><span class="sbp-spot-tag soon">' + dd + "</span><b>" + esc(x.it.title) +
            "</b><small>" + esc([x.it.org, x.it.period].filter(Boolean).join(" · ")) + "</small></a></li>";
        });
        if (pick) {
          rows += '<li><a href="#/workshops"><span class="sbp-spot-tag">추천 공방</span><b>' + esc(pick.name) +
            "</b><small>" + esc([pick.region, pick.craft, pick.oneday ? "원데이 " + pick.oneday : ""].filter(Boolean).join(" · ")) +
            "</small></a></li>";
        }
        if (!rows) return;   // 보여 줄 것이 없으면 위젯을 그리지 않습니다

        /* 제목을 설정에서 바꿀 수 있습니다 — 비우면 기본 문구. */
        var head = heading
          ? "<h2>" + esc(heading) + "</h2>"
          : "<h2>지금 볼 만한 <em>공방과 마감</em></h2>";
        box.innerHTML =
          '<section class="sbp-spot" aria-label="이번 주 추천 공방과 마감 임박">' +
            '<div><p class="sbp-spot-eyebrow">이번 주 스포트라이트</p>' +
              head +
              '<p class="sbp-spot-desc">등록 공방 중 한 곳과, 2주 안에 마감되는 공모·체험을 모았습니다. 카드를 누르면 바로 이동합니다.</p></div>' +
            '<ul class="sbp-spot-list">' + rows + "</ul>" +
          "</section>";
      });
    }
  });
})();
