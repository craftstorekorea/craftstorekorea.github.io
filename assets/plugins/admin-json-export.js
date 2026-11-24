/* SBPress 플러그인 · 데이터 내보내기 (admin-json-export)
   /admin 에「데이터 내보내기」탭을 추가해 게시글·페이지를 JSON 파일로 내려받습니다.
   (addAdminTab + addMenuItem 훅) — 관리자로 로그인했을 때만 메뉴에 나타납니다.
   ※ 읽기만 합니다. 내보낸 파일은 브라우저에서 바로 만들어지고 서버에 남지 않습니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  window.SBPress.registerPlugin({
    id: "admin-json-export",
    name: "데이터 내보내기",
    version: "1.0.1",
    manifest: { v: 1, hooks: ["admin-tab", "menu", "css"],
      permissions: ["read:admin-lists", "nav:menu", "css:inject"] },
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "관리자 화면에 게시글·페이지를 JSON으로 내려받는 탭을 추가합니다.",
    setup: function (ctx) {
      var CFG = window.CRAFT_SUPABASE || {};

      function token() {
        try {
          var ref = String(CFG.url || "").replace(/^https?:\/\//, "").split(".")[0];
          var raw = JSON.parse(localStorage.getItem("sb-" + ref + "-auth-token") || "{}");
          return raw.access_token || (raw.currentSession && raw.currentSession.access_token) || CFG.anonKey;
        } catch (e) { return CFG.anonKey; }
      }

      function fetchTable(table, select, order) {
        var url = CFG.url + "/rest/v1/" + table + "?select=" + encodeURIComponent(select || "*") +
          "&order=" + encodeURIComponent(order || "slug.asc");
        return fetch(url, { headers: { apikey: CFG.anonKey, Authorization: "Bearer " + token() } })
          .then(function (r) {
            if (!r.ok) throw new Error(table + " HTTP " + r.status);
            return r.json();
          });
      }

      function stamp() {
        var d = new Date();
        function p(n) { return (n < 10 ? "0" : "") + n; }
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
      }

      function save(name, rows) {
        var payload = { site: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"), exported_at: new Date().toISOString(), table: name, count: rows.length, rows: rows };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "jeongukgongbang-" + name + "-" + stamp() + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode && a.parentNode.removeChild(a); }, 1500);
        return a.download;
      }

      ctx.addCss([
        ".sbp-exp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:14px}",
        ".sbp-exp-card{border:1px solid var(--line,rgba(62,47,38,.14));border-radius:14px;background:#fff;padding:16px 18px}",
        ".sbp-exp-card h3{margin:0 0 4px;font-size:16px}",
        ".sbp-exp-card p{margin:0 0 12px;font-size:12.5px;line-height:1.6;color:#6d6159}",
        ".sbp-exp-card .sbp-exp-n{font:800 22px/1 'Nanum Gothic',sans-serif;color:#C86D44;margin-right:6px}",
        ".sbp-exp-card .sbp-exp-actions{display:flex;gap:8px;flex-wrap:wrap}",
        ".sbp-exp-log{margin-top:14px;font-size:12.5px;color:#6d6159;min-height:18px}"
      ].join(""));

      ctx.addMenuItem({
        id: "admin-json-export",
        label_ko: "데이터 내보내기",
        label_en: "Export data",
        href: "/admin#sbp-export",
        adminOnly: true
      });

      ctx.addAdminTab({
        id: "export",
        label: "데이터 내보내기",
        render: function (box, c) {
          box.innerHTML =
            '<div class="dash-head"><div><h1>데이터 내보내기</h1>' +
            '<p class="dash-sub">게시글·페이지를 JSON 파일로 내려받습니다. 사이트 화면에는 영향이 없고, 서버에도 파일이 남지 않습니다.</p></div></div>' +
            '<div class="sbp-exp-grid">' +
              '<section class="sbp-exp-card"><h3>게시글 <span class="sbp-exp-n" id="sbp-exp-post-n">–</span>건</h3>' +
                '<p>제목·분류·요약·본문·출처·발행일까지 <code>posts</code> 표 전체를 담습니다.</p>' +
                '<div class="sbp-exp-actions"><button type="button" class="btn btn-primary btn-sm" id="sbp-exp-post">게시글 JSON 내려받기</button></div></section>' +
              '<section class="sbp-exp-card"><h3>페이지 <span class="sbp-exp-n" id="sbp-exp-page-n">–</span>건</h3>' +
                '<p>직접 만든 페이지와 hunmin 블록 설정을 <code>pages</code> 표 그대로 담습니다.</p>' +
                '<div class="sbp-exp-actions"><button type="button" class="btn btn-primary btn-sm" id="sbp-exp-page">페이지 JSON 내려받기</button></div></section>' +
            '</div>' +
            '<p class="sbp-exp-log" id="sbp-exp-log" role="status" aria-live="polite"></p>';

          var log = box.querySelector("#sbp-exp-log");
          var data = { posts: null, pages: null };

          function load(table, nEl) {
            return fetchTable(table, table === "posts"
              ? "id,slug,category,title,summary,body,region,source_name,source_url,published_at,deadline,image_url,is_pinned,is_published,publish_at,sort_order,created_at,updated_at"
              : "slug,title,subtitle,body,images,blocks,is_published,sort_order,created_at,updated_at",
              table === "posts" ? "id.asc" : "sort_order.asc")
              .then(function (rows) {
                data[table] = rows;
                var n = box.querySelector(nEl);
                if (n) n.textContent = rows.length.toLocaleString("ko-KR");
              })
              .catch(function (e) { if (log) log.textContent = "불러오지 못했습니다: " + e.message; });
          }

          load("posts", "#sbp-exp-post-n");
          load("pages", "#sbp-exp-page-n");

          function wire(btnSel, table) {
            var btn = box.querySelector(btnSel);
            if (!btn) return;
            btn.addEventListener("click", function () {
              btn.disabled = true;
              if (log) log.textContent = "JSON을 만드는 중…";
              var ready = data[table] ? Promise.resolve(data[table]) : fetchTable(table, null, table === "posts" ? "id.asc" : "sort_order.asc");
              ready.then(function (rows) {
                var name = save(table, rows);
                if (log) log.textContent = name + " 내려받기를 시작했습니다(" + rows.length + "건).";
              }).catch(function (e) {
                if (log) log.textContent = "내려받지 못했습니다: " + e.message;
              }).then(function () { btn.disabled = false; });
            });
          }
          wire("#sbp-exp-post", "posts");
          wire("#sbp-exp-page", "pages");
        }
      });
    }
  });
})();
