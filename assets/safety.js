/* ===== SBPress v10.18 · 운영 안전망 · 백업 이력 · 이력 비교(Diff) (assets/safety.js) =====
   /admin → 백업 · 복원 의 '운영 안전망 · 서버 스냅샷 · 이력 비교' 카드가 이 모듈을 씁니다.

   · 헬스      — sbpress_health_ping : 표·행·Storage, 최근 자동 배치/백업, Free 플랜 7일 절전 안전 배지
   · 스냅샷    — sbpress_export_snapshot : 핵심 운영 데이터를 JSON 한 파일로 내려받고 backup_logs 이력 표시
   · 이력 비교 — 글·페이지 수정 이력(revisions) 과 일감 변경 이력(issue_histories) 두 버전을
                 필드·줄 단위로 색을 달리해 비교합니다.
   의존: assets/admin.js 의 window.CRAFT_ADMIN(token) · assets/config.js(window.CRAFT_SUPABASE)
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";

  var S = {
    bound: false,
    loaded: false,
    health: null,
    log: [],
    src: "doc",
    target: "",
    kind: "",
    versions: [],
    targets: { doc: null, issue: null }
  };

  /* ---------------- 공통 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function num(n) {
    if (n == null || n === "") return "–";
    var v = Number(n);
    return isNaN(v) ? String(n) : v.toLocaleString("ko-KR");
  }
  function bytesText(n) {
    var v = Number(n);
    if (!v || isNaN(v)) return "0 B";
    if (v < 1024) return v + " B";
    if (v < 1048576) return (v / 1024).toFixed(v < 10240 ? 1 : 0) + " KB";
    return (v / 1048576).toFixed(1) + " MB";
  }
  function token() {
    if (window.CRAFT_ADMIN && window.CRAFT_ADMIN.token) return window.CRAFT_ADMIN.token();
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.token) return window.CRAFT_AUTH.token();
    return null;
  }
  function rest(path, method, body) {
    var t = token();
    if (!API || !t) return Promise.reject(Object.assign(new Error("로그인이 필요합니다."), { status: 0 }));
    var headers = { apikey: KEY, Authorization: "Bearer " + t, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(API + "/rest/v1/" + path, {
      method: method || "GET", headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint || data.details)) || ("HTTP " + r.status));
          err.status = r.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function rpc(name, body) { return rest("rpc/" + name, "POST", body || {}); }
  function msg(text, kind) {
    var box = $("#sft-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "cms-toast" + (kind ? " is-" + kind : "");
    box.hidden = !text;
  }
  function fmtWhen(iso) {
    if (!iso) return "–";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }
  /* 서버가 준 idle_hours(경과 시간)로 'n시간 전'을 만듭니다 — 브라우저 시간대와 무관합니다. */
  function fmtWhenSec(iso) {
    if (!iso) return "–";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 19).replace("T", " ");
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }
  function ago(hours) {
    if (hours == null || hours === "" || isNaN(Number(hours))) return "기록 없음";
    var h = Number(hours);
    if (h < 0) h = 0;
    if (h < 1) return "방금";
    if (h < 24) return Math.round(h) + "시간 전";
    return Math.floor(h / 24) + "일 전";
  }

  /* ---------------- ① 헬스 ---------------- */
  function paintHealth(d) {
    S.health = d || {};
    var h = S.health;
    var pause = h.pause || {};
    var batch = h.batch || {};
    var backup = h.backup || {};
    var db = h.db || {};
    var store = h.storage || {};

    var badge = $("#sft-pause-badge");
    if (badge) {
      var safe = pause.safe === true;
      var left = pause.days_left;
      badge.textContent = (safe ? "절전 안전" : "절전 위험") + (left != null ? " · D-" + left : "");
      badge.className = "sft-badge " + (safe ? "is-ok" : "is-warn");
    }
    var set = function (id, text) { var el = $("#" + id); if (el) el.textContent = text; };
    set("sft-batch", ago(batch.idle_hours) + (batch.ok === false ? " · 실패" : ""));
    set("sft-last-backup", ago(backup.idle_hours) + (backup.row_count != null ? " · " + num(backup.row_count) + "행" : ""));
    set("sft-pause", pause.days_left != null ? "D-" + pause.days_left + " / 7일" : "–");
    set("sft-db", (db.tables != null ? num(db.tables) + "개 표 · " : "") + num(db.rows) + "행");
    set("sft-storage", num(store.files) + "개 · " + bytesText(store.bytes));
    set("sft-weekly", "월 09:00 KST · 90일 보관");
    var note = $("#sft-health-note");
    if (note) {
      note.textContent = h.pause && h.pause.safe
        ? "마지막 활동 " + (pause.last_activity || "기록 없음") + " · " + (pause.idle_hours != null ? num(pause.idle_hours) + "시간 지남" : "")
        : "7일 안에 DB 요청이 없으면 Free 플랜이 일시정지됩니다. 자동 배치·백업 상태를 확인해 주세요.";
    }
  }

  function refreshHealth() {
    if (!API || !token()) { paintHealth({}); return Promise.resolve(); }
    var note = $("#sft-health-note");
    if (note) note.textContent = "확인하는 중…";
    return rpc("sbpress_health_ping", {}).then(function (d) {
      paintHealth(d);
    }).catch(function (e) {
      var badge = $("#sft-pause-badge");
      if (badge) { badge.textContent = "확인 실패"; badge.className = "sft-badge is-warn"; }
      if (note) note.textContent = /42501|permission|권한/.test(String(e.message))
        ? "39_v1018_safety_backup.sql 을 실행하면 헬스 핑이 켜집니다." : "헬스를 읽지 못했습니다: " + e.message;
    });
  }

  /* ---------------- ② 스냅샷 · 백업 이력 ---------------- */
  var SOURCE_LABEL = {
    manual: "수동", admin: "관리자", "github-actions": "GitHub Actions", scheduled: "예약"
  };

  function paintLog(rows) {
    S.log = rows || [];
    var body = $("#sft-log");
    if (!body) return;
    if (!S.log.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">아직 백업 이력이 없습니다. 위의 ‘서버 스냅샷 내려받기’나 GitHub Actions 주간 백업이 실행되면 여기에 쌓입니다.</td></tr>';
      return;
    }
    body.innerHTML = S.log.map(function (r) {
      return "<tr>" +
        "<td>" + esc(fmtWhen(r.created_at)) + "</td>" +
        "<td>" + esc(SOURCE_LABEL[r.source] || r.source || "–") + "</td>" +
        '<td class="num">' + num(r.row_count) + "</td>" +
        '<td class="num">' + esc(bytesText(r.bytes)) + "</td>" +
        "<td>" + (r.ok === false ? '<span class="sft-dot is-warn"></span>실패' : '<span class="sft-dot is-ok"></span>완료') + "</td>" +
        '<td class="muted"><code>' + esc(r.checksum || "–") + "</code></td>" +
        "</tr>";
    }).join("");
  }

  function loadLog() {
    if (!API || !token()) return Promise.resolve();
    return rest("backup_logs?select=id,kind,source,ok,row_count,bytes,checksum,created_at&order=created_at.desc&limit=20")
      .then(function (rows) { paintLog(rows); })
      .catch(function (e) {
        var body = $("#sft-log");
        if (body) {
          body.innerHTML = '<tr class="empty-row"><td colspan="6">' +
            (/42501|permission|권한|does not exist|404/.test(String(e.message))
              ? "39_v1018_safety_backup.sql 을 실행하면 백업 이력이 켜집니다."
              : "이력을 읽지 못했습니다: " + esc(e.message)) + "</td></tr>";
        }
      });
  }

  function downloadSnapshot() {
    if (!API || !token()) { msg("관리자로 로그인해야 스냅샷을 내려받을 수 있습니다.", "err"); return; }
    var btn = $("#sft-download");
    if (btn) btn.disabled = true;
    msg("DB 에서 스냅샷을 만드는 중…");
    rpc("sbpress_export_snapshot", { p_source: "admin" }).then(function (d) {
      if (btn) btn.disabled = false;
      if (!d || !d.tables) { msg("스냅샷이 비어 있습니다.", "err"); return; }
      var now = new Date();
      var stamp = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2) +
        "-" + ("0" + now.getHours()).slice(-2) + ("0" + now.getMinutes()).slice(-2);
      var name = "sbpress-snapshot-" + stamp + ".json";
      var text = JSON.stringify(d, null, 1);
      var blob = new Blob([text], { type: "application/json;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      msg("스냅샷 " + name + " — " + num(d.row_count) + "행 · " + bytesText(d.bytes) + " 를 내려받았습니다.", "ok");
      var note = $("#sft-download-note");
      if (note) note.textContent = "마지막 스냅샷 " + (d.generated_at || "") + " · 체크섬 " + (d.checksum || "");
      loadLog();
      refreshHealth();
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      msg(/42501|permission|권한/.test(String(e.message))
        ? "스냅샷 함수가 없거나 권한이 없습니다. 39_v1018_safety_backup.sql 을 실행해 주세요."
        : "스냅샷을 만들지 못했습니다: " + e.message, "err");
    });
  }

  /* ---------------- ③ 이력 비교(Diff) ---------------- */
  var DOC_FIELDS = [
    ["title", "제목"], ["subtitle", "부제"], ["category", "분류"], ["summary", "요약"],
    ["body_format", "본문 형식"], ["status", "상태"], ["is_published", "발행"],
    ["slug", "주소(slug)"], ["images", "이미지"], ["blocks", "블록"], ["meta", "정보(meta)"], ["body", "본문"]
  ];
  var PAGE_FIELDS = [
    ["title", "제목"], ["subtitle", "부제"], ["is_published", "발행"], ["sort_order", "순서"],
    ["images", "이미지"], ["blocks", "블록"], ["body_format", "본문 형식"], ["body", "본문"]
  ];
  var ISSUE_FIELDS = [
    ["subject", "제목"], ["status", "상태"], ["progress", "진행률"], ["priority", "우선순위"],
    ["tracker", "유형"], ["assignee_id", "담당"], ["starts_on", "시작일"], ["due_on", "마감일"],
    ["estimated_hours", "예상 시간"], ["spent_hours", "실적 시간"], ["parent_id", "상위 일감"],
    ["description", "설명"]
  ];

  function valText(v) {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "boolean") return v ? "예" : "아니오";
    if (typeof v === "object") return JSON.stringify(v, null, 1);
    return String(v);
  }
  function shortVal(v) {
    var t = valText(v);
    if (t.length > 400) t = t.slice(0, 400) + " …";
    return t;
  }

  function fieldsFor(src, kind) {
    if (src === "issue") return ISSUE_FIELDS;
    return kind === "page" ? PAGE_FIELDS : DOC_FIELDS;
  }

  function compareFields(src, kind, a, b) {
    var list = fieldsFor(src, kind);
    var rows = [];
    list.forEach(function (pair) {
      var k = pair[0];
      var av = a ? a[k] : undefined;
      var bv = b ? b[k] : undefined;
      if (av === undefined && bv === undefined) return;
      var at = valText(av), bt = valText(bv);
      if (at === bt) return;
      var cls = !at ? "is-add" : !bt ? "is-del" : "is-mod";
      rows.push({ key: k, label: pair[1], a: av, b: bv, cls: cls });
    });
    return rows;
  }

  function splitLines(text) {
    return String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
  }

  function lcsOps(A, B) {
    var m = A.length, n = B.length;
    if (!m) return B.map(function (t, j) { return { t: "+", b: j, text: t }; });
    if (!n) return A.map(function (t, i) { return { t: "-", a: i, text: t }; });
    if (m * n > 900000) {
      return A.map(function (t, i) { return { t: "-", a: i, text: t }; })
        .concat(B.map(function (t, j) { return { t: "+", b: j, text: t }; }));
    }
    var W = n + 1;
    var dp = new Uint32Array((m + 1) * W);
    for (var i = m - 1; i >= 0; i--) {
      for (var j = n - 1; j >= 0; j--) {
        dp[i * W + j] = A[i] === B[j]
          ? dp[(i + 1) * W + j + 1] + 1
          : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      }
    }
    var out = [], x = 0, y = 0;
    while (x < m && y < n) {
      if (A[x] === B[y]) { out.push({ t: "=", a: x, b: y, text: A[x] }); x++; y++; }
      else if (dp[(x + 1) * W + y] >= dp[x * W + y + 1]) { out.push({ t: "-", a: x, text: A[x] }); x++; }
      else { out.push({ t: "+", b: y, text: B[y] }); y++; }
    }
    while (x < m) { out.push({ t: "-", a: x, text: A[x] }); x++; }
    while (y < n) { out.push({ t: "+", b: y, text: B[y] }); y++; }
    return out;
  }

  /* 앞뒤가 같은 줄은 잘라 내고 가운데만 비교합니다(긴 본문도 빠르게). */
  function diffLines(aText, bText) {
    var A = splitLines(aText), B = splitLines(bText);
    var p = 0;
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    var s = 0;
    while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
    var midA = A.slice(p, A.length - s), midB = B.slice(p, B.length - s);
    var ops = [];
    for (var i = 0; i < p; i++) ops.push({ t: "=", a: i, b: i, text: A[i] });
    lcsOps(midA, midB).forEach(function (o) {
      if (o.t === "=") { o.a += p; o.b += p; }
      else if (o.t === "-") { o.a += p; }
      else { o.b += p; }
      ops.push(o);
    });
    for (var k = 0; k < s; k++) ops.push({ t: "=", a: A.length - s + k, b: B.length - s + k, text: A[A.length - s + k] });
    return ops;
  }

  function paintLines(ops) {
    var changed = ops.map(function (o) { return o.t !== "="; });
    var keep = ops.map(function (o, i) {
      if (changed[i]) return true;
      for (var k = Math.max(0, i - 2); k <= Math.min(ops.length - 1, i + 2); k++) if (changed[k]) return true;
      return false;
    });
    var html = "", skipped = 0, shown = 0;
    function flush() {
      if (skipped) { html += '<div class="sft-same">… ' + skipped + '줄 같음</div>'; skipped = 0; }
    }
    ops.forEach(function (o, i) {
      if (shown > 3000) return;
      if (!keep[i]) { skipped++; return; }
      flush();
      var sign = o.t === "+" ? "+" : o.t === "-" ? "−" : " ";
      var lineNo = o.t === "+" ? o.b : o.a;
      html += '<div class="sft-line is-' + (o.t === "+" ? "add" : o.t === "-" ? "del" : "same") + '">' +
        '<span class="sft-gut">(' + (lineNo + 1) + ')</span><span class="sft-sign">' + sign + "</span>" +
        '<code>' + esc(o.text || " ") + "</code></div>";
      shown++;
    });
    flush();
    return html;
  }

  function paintDiff(src, kind, va, vb) {
    var rows = compareFields(src, kind, va.data, vb.data);
    var bodyA = va.data ? (src === "issue" ? va.data.description : va.data.body) : "";
    var bodyB = vb.data ? (src === "issue" ? vb.data.description : vb.data.body) : "";
    var ops = diffLines(bodyA, bodyB);
    var added = ops.filter(function (o) { return o.t === "+"; }).length;
    var removed = ops.filter(function (o) { return o.t === "-"; }).length;
    var changedBody = added + removed > 0;

    var box = $("#sft-diff");
    if (!box) return;
    var html = '<div class="sft-sum">' +
      '<span class="sft-kpi"><b>' + rows.length + "</b>개 필드 바뀜</span>" +
      (changedBody ? '<span class="sft-kpi is-add"><b>+' + added + "</b>줄 추가</span>" +
                     '<span class="sft-kpi is-del"><b>−' + removed + "</b>줄 삭제</span>" : '<span class="sft-kpi">본문 변화 없음</span>') +
      "</div>";

    if (!rows.length && !changedBody) {
      html += '<p class="rev-empty">두 버전이 같습니다 — 바뀐 필드나 줄이 없습니다.</p>';
      box.innerHTML = html;
      return;
    }

    if (rows.length) {
      html += '<h3 class="sft-h3">바뀐 필드</h3><table class="sft-fields"><thead><tr>' +
        "<th>필드</th><th>" + esc(va.label) + "</th><th>" + esc(vb.label) + "</th></tr></thead><tbody>" +
        rows.map(function (r) {
          return '<tr class="' + r.cls + '">' +
            "<td>" + esc(r.label) + "</td>" +
            '<td class="old"><div class="sft-val">' + (r.a == null || r.a === "" ? '<em>없음</em>' : esc(shortVal(r.a))) + "</div></td>" +
            '<td class="new"><div class="sft-val">' + (r.b == null || r.b === "" ? '<em>없음</em>' : esc(shortVal(r.b))) + "</div></td>" +
            "</tr>";
        }).join("") + "</tbody></table>";
    }

    if (changedBody) {
      html += '<h3 class="sft-h3">본문 줄 비교</h3><div class="sft-lines">' + paintLines(ops) + "</div>";
    }
    box.innerHTML = html;
  }

  function openDrawer(title, sub) {
    var dr = $("#sft-drawer");
    if (!dr) return;
    var t = $("#sft-drawer-title");
    if (t) t.textContent = title || "이력 비교";
    var s = $("#sft-drawer-sub");
    if (s) s.textContent = sub || "";
    dr.hidden = false;
    document.body.classList.add("cms-lock");
  }
  function closeDrawer() {
    var dr = $("#sft-drawer");
    if (dr) dr.hidden = true;
    document.body.classList.remove("cms-lock");
  }

  function fillSelect(sel, items, value) {
    if (!sel) return;
    sel.innerHTML = items.map(function (it, i) {
      return '<option value="' + i + '">' + esc(it.label) + "</option>";
    }).join("");
    sel.disabled = items.length < 2;
    if (value != null && items[value]) sel.value = String(value);
  }

  function paintVersions(preferA, preferB) {
    var A = $("#sft-a"), B = $("#sft-b"), btn = $("#sft-compare");
    var items = S.versions.map(function (v) { return { label: v.label }; });
    var a = preferA != null ? preferA : Math.min(1, items.length - 1);
    var b = preferB != null ? preferB : 0;
    fillSelect(A, items, a);
    fillSelect(B, items, b);
    if (btn) btn.disabled = items.length < 2;
    var note = $("#sft-diff-note");
    if (note) {
      note.textContent = items.length < 2
        ? "비교할 버전이 아직 하나뿐입니다. 문서를 한 번 더 저장하거나 일감을 바꾸면 이력이 쌓입니다."
        : "이전(" + S.versions[a].label + ") 과 이후(" + S.versions[b].label + ") 를 비교합니다.";
    }
  }

  function loadDocVersions(kind, slug) {
    var table = kind === "page" ? "pages" : "posts";
    return rest(table + "?select=*&slug=eq." + encodeURIComponent(slug) + "&limit=1")
      .then(function (rows) {
        var cur = (rows && rows[0]) || {};
        return rest("revisions?select=id,note,snapshot,created_at&entity_type=eq." + kind +
          "&entity_id=eq." + encodeURIComponent(slug) + "&order=created_at.desc&limit=30")
          .then(function (revs) {
            var list = [{
              id: "current", label: "지금 (현재 상태)", when: cur.updated_at,
              data: cur, raw: null
            }];
            (revs || []).forEach(function (r) {
              list.push({
                id: r.id, label: fmtWhen(r.created_at) + (r.note ? " · " + r.note : " · 저장 전"),
                when: r.created_at, data: r.snapshot || {}, raw: r
              });
            });
            S.versions = list;
            S.kind = kind;
            return list;
          });
      });
  }

  var ISSUE_LABEL = {
    subject: "제목", description: "설명", status: "상태", progress: "진행률", priority: "우선순위",
    tracker: "유형", assignee_id: "담당", starts_on: "시작일", due_on: "마감일",
    estimated_hours: "예상 시간", spent_hours: "실적 시간", parent_id: "상위 일감", closed_at: "종료"
  };

  function loadIssueVersions(id) {
    return rest("issues?select=*&id=eq." + encodeURIComponent(id) + "&limit=1").then(function (rows) {
      var cur = (rows && rows[0]) || {};
      return rest("issue_histories?select=id,action,changes,snapshot,actor_email,created_at&issue_id=eq." +
        encodeURIComponent(id) + "&order=created_at.desc&limit=30")
        .then(function (hist) {
          var list = [{ id: "current", label: "지금 (현재 상태)", when: cur.updated_at, data: cur, raw: null }];
          (hist || []).forEach(function (h) {
            var keys = Object.keys(h.changes || {});
            var what = h.action === "insert" ? "생성"
              : (keys.slice(0, 2).map(function (k) { return ISSUE_LABEL[k] || k; }).join("·") +
                 (keys.length > 2 ? " 외 " + (keys.length - 2) : ""));
            list.push({
              id: h.id,
              label: fmtWhenSec(h.created_at) + " · " + what,
              when: h.created_at, data: h.snapshot || {}, raw: h
            });
          });
          S.versions = list;
          S.kind = "";
          return list;
        });
    });
  }

  function targetValue() {
    var sel = $("#sft-target");
    return sel ? sel.value : "";
  }
  function splitTarget(v) {
    var i = String(v || "").indexOf(":");
    if (i < 0) return { kind: "", key: "" };
    return { kind: v.slice(0, i), key: decodeURIComponent(v.slice(i + 1)) };
  }

  function loadTargets(src) {
    if (src === "issue") {
      return rest("issues?select=id,issue_no,subject,status,updated_at&order=updated_at.desc&limit=100")
        .then(function (rows) {
          S.targets.issue = rows || [];
          return S.targets.issue;
        });
    }
    return Promise.all([
      rest("posts?select=slug,title,updated_at&order=updated_at.desc&limit=200"),
      rest("pages?select=slug,title,updated_at&order=updated_at.desc&limit=200")
    ]).then(function (res) {
      S.targets.doc = { posts: res[0] || [], pages: res[1] || [] };
      return S.targets.doc;
    });
  }

  function fillTargetSelect() {
    var sel = $("#sft-target");
    if (!sel) return;
    var html = "";
    if (S.src === "doc") {
      var d = S.targets.doc || { posts: [], pages: [] };
      if (d.posts.length) {
        html += '<optgroup label="글">' + d.posts.map(function (p) {
          return '<option value="post:' + esc(encodeURIComponent(p.slug)) + '">' + esc(p.title || p.slug) + "</option>";
        }).join("") + "</optgroup>";
      }
      if (d.pages.length) {
        html += '<optgroup label="페이지">' + d.pages.map(function (p) {
          return '<option value="page:' + esc(encodeURIComponent(p.slug)) + '">' + esc(p.title || p.slug) + "</option>";
        }).join("") + "</optgroup>";
      }
    } else {
      html = (S.targets.issue || []).map(function (it) {
        return '<option value="issue:' + esc(encodeURIComponent(it.id)) + '">#' + esc(it.issue_no) + " " + esc(it.subject) + "</option>";
      }).join("");
    }
    sel.innerHTML = html || '<option value="">이력이 있는 자료가 없습니다</option>';
  }

  function onTargetChange() {
    var v = targetValue();
    S.target = v;
    S.versions = [];
    fillSelect($("#sft-a"), [], 0);
    fillSelect($("#sft-b"), [], 0);
    var btn = $("#sft-compare");
    if (btn) btn.disabled = true;
    if (!v) return Promise.resolve();
    var t = splitTarget(v);
    var job = t.kind === "issue" ? loadIssueVersions(t.key) : loadDocVersions(t.kind, t.key);
    return job.then(function () {
      paintVersions();
    }).catch(function (e) {
      var note = $("#sft-diff-note");
      if (note) note.textContent = "이력을 읽지 못했습니다: " + e.message;
    });
  }

  function compareNow() {
    var A = $("#sft-a"), B = $("#sft-b");
    var ia = A ? Number(A.value) : 0, ib = B ? Number(B.value) : 0;
    var va = S.versions[ia], vb = S.versions[ib];
    if (!va || !vb) return;
    var label = S.src === "issue" ? "일감" : (S.kind === "page" ? "페이지" : "글");
    var t = splitTarget(S.target);
    openDrawer(label + " 이력 비교", (t.key || "") + " · " + va.label + " → " + vb.label);
    paintDiff(S.src, S.kind, va, vb);
  }

  /* 수정 이력 드로어의 ‘비교’ — 그 저장 직전 상태와 그 이전 상태를 비교합니다. */
  function openDocDiff(type, slug, revId) {
    S.src = "doc";
    var srcSel = $("#sft-src");
    if (srcSel) srcSel.value = "doc";
    return loadDocVersions(type, slug).then(function (list) {
      var idx = 0;
      for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(revId)) { idx = i; break; }
      var b = idx, a = Math.min(idx + 1, list.length - 1);
      paintVersions(a, b);
      var label = type === "page" ? "페이지" : "글";
      openDrawer(label + " 이력 비교", (slug || "") + " · " + list[a].label + " → " + list[b].label);
      paintDiff("doc", type, list[a], list[b]);
    }).catch(function (e) {
      openDrawer("이력 비교", "");
      var box = $("#sft-diff");
      if (box) box.innerHTML = '<p class="rev-empty">이력을 읽지 못했습니다: ' + esc(e.message) + "</p>";
    });
  }

  /* revId 를 주면 그 이력 직전 상태와 그 이력을 비교하고, 없으면 처음 상태와 지금을 비교합니다. */
  function openIssueDiff(id, revId) {
    S.src = "issue";
    var srcSel = $("#sft-src");
    if (srcSel) srcSel.value = "issue";
    return loadIssueVersions(id).then(function (list) {
      var b = 0, a = Math.max(0, list.length - 1);
      if (revId) {
        for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(revId)) { b = i; a = Math.min(i + 1, list.length - 1); break; }
      }
      paintVersions(a, b);
      var tv = "issue:" + encodeURIComponent(id);
      if (S.targets.issue) {
        fillTargetSelect();
        var ts = $("#sft-target");
        if (ts) ts.value = tv;
        S.target = tv;
      }
      openDrawer("일감 이력 비교", (id + " · " + list[a].label + " → " + list[b].label));
      paintDiff("issue", "", list[a], list[b]);
    }).catch(function (e) {
      openDrawer("일감 이력 비교", "");
      var box = $("#sft-diff");
      if (box) box.innerHTML = '<p class="rev-empty">이력을 읽지 못했습니다: ' + esc(e.message) + "</p>";
    });
  }

  /* #/tasks 상세의 ‘비교’가 여는 주소: /admin?tab=backup&diff=issue&id=… */
  function fromUrl() {
    var q;
    try { q = new URLSearchParams(window.location.search || ""); } catch (e) { return; }
    if (q.get("tab") !== "backup") return;
    var diff0 = q.get("diff");
    if (diff0 === "issue") S.src = "issue";
    var tab = $('.admin-tab[data-tab="backup"]');
    if (tab) tab.click();
    load();
    var diff = diff0;
    var id = q.get("id");
    var rev = q.get("rev") || "";
    if (diff === "issue" && id) {
      S.src = "issue";
      var issueSel = $("#sft-src");
      if (issueSel) issueSel.value = "issue";
      setTimeout(function () { openIssueDiff(id, rev); }, 500);
    } else if (diff === "doc" && id) {
      var parts = String(id).split(":");
      if (parts.length === 2) setTimeout(function () { openDocDiff(parts[0], parts[1], rev); }, 500);
    }
  }

  /* ---------------- 연결 ---------------- */
  function bind() {
    if (S.bound) return;
    S.bound = true;
    var reload = $("#sft-reload");
    if (reload) reload.addEventListener("click", function () { refreshHealth(); loadLog(); });
    var dl = $("#sft-download");
    if (dl) dl.addEventListener("click", downloadSnapshot);
    var src = $("#sft-src");
    if (src) src.addEventListener("change", function () {
      S.src = src.value;
      S.target = "";
      loadTargets(S.src).then(fillTargetSelect).then(onTargetChange).catch(function () {
        fillTargetSelect();
      });
    });
    var target = $("#sft-target");
    if (target) target.addEventListener("change", onTargetChange);
    var cmp = $("#sft-compare");
    if (cmp) cmp.addEventListener("click", compareNow);
    var close = $("#sft-drawer-close");
    if (close) close.addEventListener("click", closeDrawer);
    var dr = $("#sft-drawer");
    if (dr) dr.addEventListener("click", function (e) { if (e.target === dr) closeDrawer(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dr && !dr.hidden) closeDrawer();
    });
  }

  function load() {
    bind();
    if (!API || !token()) return;
    refreshHealth();
    loadLog();
    if (S.loaded) { if (S.targets[S.src] || S.targets.doc) fillTargetSelect(); return; }
    S.loaded = true;
    loadTargets(S.src).then(function () {
      fillTargetSelect();
      return onTargetChange();
    }).catch(function (e) {
      var note = $("#sft-diff-note");
      if (note) note.textContent = "문서 목록을 읽지 못했습니다: " + e.message;
    });
  }

  window.CRAFT_SAFETY = {
    load: load,
    refreshHealth: refreshHealth,
    download: downloadSnapshot,
    fromUrl: fromUrl,
    openDocDiff: function (type, slug, revId) {
      var tab = $('.admin-tab[data-tab="backup"]');
      if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
      return openDocDiff(type, slug, revId);
    },
    openIssueDiff: openIssueDiff,
    close: closeDrawer,
    diffLines: diffLines,
    compareFields: compareFields
  };
})();
