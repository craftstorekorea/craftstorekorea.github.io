/* SBPress 플러그인 · 팀 백업 스냅샷 (team-backup-restore)  v1.0.0
   /admin 에「백업 · 팀」탭을 더해 설치된 플러그인 설정을 JSON 스냅샷으로 내려받습니다.
   (addAdminTab + addMenuItem 훅) — 읽기만 하며, 파일은 브라우저에서 만들어집니다.
   유료 플러그인입니다(plan: team · 라이선스 필요). 설치할 때 마켓이 라이선스 키를 확인합니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  window.SBPress.registerPlugin({
    id: "team-backup-restore",
    name: "팀 백업 스냅샷",
    version: "1.0.0",
    manifest: { v: 1, hooks: ["admin-tab", "menu", "css"],
      permissions: ["read:admin", "ui:admin", "nav:menu", "css:inject"] },
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "관리자 화면에서 설치된 플러그인과 설정을 JSON 스냅샷으로 내려받습니다.",
    license: { required: true, plan: "team" },
    setup: function (ctx) {
      var CFG = window.CRAFT_SUPABASE || {};

      ctx.addCss([
        ".sbp-snap-note{margin:0 0 12px;font-size:12.5px;color:var(--muted,#7a6f66)}",
        ".sbp-snap-acts{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}",
        ".sbp-snap-table{width:100%;border-collapse:collapse;font-size:13px}",
        ".sbp-snap-table th,.sbp-snap-table td{padding:8px 10px;border-bottom:1px solid var(--line,rgba(62,47,38,.12));text-align:left}",
        ".sbp-snap-table th{font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#7a6f66)}",
        ".sbp-snap-msg{margin:10px 0 0;font-size:12.5px}"
      ].join(""));

      function token() {
        try {
          var ref = String(CFG.url || "").replace(/^https?:\/\//, "").split(".")[0];
          var raw = JSON.parse(localStorage.getItem("sb-" + ref + "-auth-token") || "{}");
          return raw.access_token || (raw.currentSession && raw.currentSession.access_token) || CFG.anonKey;
        } catch (e) { return CFG.anonKey; }
      }

      function readPlugins() {
        if (!CFG.url) return Promise.resolve([]);
        return fetch(CFG.url + "/rest/v1/plugins?select=id,name,version,enabled,source,settings,installed_at&order=id.asc", {
          headers: { apikey: CFG.anonKey, Authorization: "Bearer " + token() }, cache: "no-store"
        }).then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) { return Array.isArray(rows) ? rows : []; })
          .catch(function () { return []; });
      }

      function snapshot(rows) {
        return {
          kind: "sbpress-plugin-snapshot",
          v: 1,
          generatedAt: new Date().toISOString(),
          site: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : ""),
          count: rows.length,
          plugins: rows.map(function (r) {
            return { id: r.id, name: r.name, version: r.version, enabled: r.enabled === true,
                     source: r.source || "", settings: r.settings || {} };
          })
        };
      }

      function download(text, name) {
        var blob = new Blob([text], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1200);
      }

      ctx.addMenuItem({
        id: "team-backup", label_ko: "백업 · 팀", label_en: "Backup · team",
        href: "/admin#sbp-team-backup", adminOnly: true
      });

      ctx.addAdminTab({
        id: "team-backup",
        label: "백업 · 팀",
        render: function (panel, c) {
          panel.innerHTML = "";
          var h = document.createElement("h2");
          h.textContent = "팀 백업 스냅샷";
          var note = document.createElement("p");
          note.className = "sbp-snap-note";
          note.textContent = "설치된 플러그인과 설정을 JSON 파일로 내려받습니다. 비밀 키·회원 정보는 담지 않습니다.";
          var acts = document.createElement("div");
          acts.className = "sbp-snap-acts";
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-primary btn-sm";
          btn.textContent = "스냅샷 내려받기";
          var reload = document.createElement("button");
          reload.type = "button";
          reload.className = "btn btn-ghost btn-sm";
          reload.textContent = "새로고침";
          acts.appendChild(btn);
          acts.appendChild(reload);

          var wrap = document.createElement("div");
          wrap.className = "sbp-snap-body";
          var msg = document.createElement("p");
          msg.className = "sbp-snap-msg";
          msg.setAttribute("role", "status");
          msg.textContent = "목록을 읽는 중…";

          panel.appendChild(h);
          panel.appendChild(note);
          panel.appendChild(acts);
          panel.appendChild(wrap);
          panel.appendChild(msg);

          var rows = [];
          function paintRows() {
            wrap.innerHTML = "";
            if (!rows.length) {
              msg.textContent = "설치된 플러그인이 없습니다.";
              return;
            }
            var table = document.createElement("table");
            table.className = "sbp-snap-table";
            var head = document.createElement("tr");
            ["플러그인", "버전", "상태", "설정"].forEach(function (t) {
              var th = document.createElement("th");
              th.textContent = t;
              head.appendChild(th);
            });
            table.appendChild(head);
            rows.forEach(function (r) {
              var tr = document.createElement("tr");
              var a = document.createElement("td");
              a.textContent = String(r.name || r.id);
              var b = document.createElement("td");
              b.textContent = "v" + String(r.version || "");
              var c2 = document.createElement("td");
              c2.textContent = r.enabled === true ? "켜짐" : "꺼짐";
              var d = document.createElement("td");
              var keys = (r.settings && typeof r.settings === "object") ? Object.keys(r.settings) : [];
              d.textContent = keys.length ? keys.join(", ") : "—";
              tr.appendChild(a);
              tr.appendChild(b);
              tr.appendChild(c2);
              tr.appendChild(d);
              table.appendChild(tr);
            });
            wrap.appendChild(table);
            msg.textContent = rows.length + "개 플러그인을 읽었습니다.";
          }

          function load() {
            msg.textContent = "목록을 읽는 중…";
            readPlugins().then(function (list) {
              rows = list;
              paintRows();
            });
          }

          btn.addEventListener("click", function () {
            if (!rows.length) { msg.textContent = "먼저 목록을 읽어 주세요."; return; }
            download(JSON.stringify(snapshot(rows), null, 2), "sbpress-plugins-snapshot.json");
            msg.textContent = "스냅샷을 내려받았습니다.";
          });
          reload.addEventListener("click", load);

          load();
        }
      });
    }
  });
})();
