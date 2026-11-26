/* ===== 전국공방 · 관리자 페이지 (/admin) =====
   - 로그인 게이트: Supabase 세션 + is_admin() RPC 로 관리자 판별
   - 관리자에게만: profiles / bookmarks 전체 조회(RLS 정책이 서버에서 막아 줌)
   - 회원 등급(1·2·3) 변경 — 서버의 등급 보호 트리거는 관리자만 통과시킵니다.
   - 구글 시트(등록·제보 DB)는 gviz 로 실시간 조회, data.js 의 마감 일정은 D-day 로 정렬
   의존: assets/supabase.js, assets/auth-config.js, assets/data.js, assets/archive.js
   주의: service_role 키나 비밀 값은 이 파일에 절대 넣지 않습니다. 공개(publishable) 키만 사용.
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var SC = window.SBPRESS_CONFIG || {};
  var SBP = window.SBP || null;
  function feature(name) {
    if (SBP && SBP.feature) return SBP.feature(name);
    return !SC.features || SC.features[name] !== false;
  }
  function brandName() { return (SBP && SBP.brandName) ? SBP.brandName() : (SC.siteName || "SBPress"); }
  var SH = (feature("sheets") && SC.sheets) || {};
  var CONFIGURED = !!(CFG.url && CFG.anonKey);
  var SHEET_ID = SH.boardId || "";
  var SHEET_URL = SH.boardUrl || (SHEET_ID ? "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit" : "");
  var SHEET_LABEL = SH.label || "등록·제보 DB";
  var PROJECT_REF = (function () {
    var m = /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(CFG.url || "");
    return m ? m[1] : "";
  })();
  var GA_ID = (SC.ga4Id || "");
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  var sb = null;
  var session = null;
  var isAdmin = false;
  /* v7.0 — 관리자 화면의 다른 모듈(웹훅·AI)이 같은 세션 토큰을 쓰도록 내어 줍니다(키는 노출되지 않습니다). */
  window.CRAFT_ADMIN = {
    token: function () { return session && session.access_token ? session.access_token : null; },
    user: function () { return session ? session.user : null; },
    isAdmin: function () { return !!isAdmin; }
  };
  var members = [];
  var bookmarks = [];
  var sheetRows = [];
  var booted = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) {
    if (n == null || isNaN(n)) return "–";
    return Number(n).toLocaleString("ko-KR");
  }
  function fmtDate(iso) {
    if (!iso) return "–";
    try {
      return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }).replace(/\s/g, "");
    } catch (e) { return "–"; }
  }
  function fmtWhen(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso), now = new Date();
      var diff = now - d;
      if (diff >= 0 && diff < 60 * 60000) return Math.max(1, Math.round(diff / 60000)) + "분 전";
      if (diff >= 0 && diff < 24 * 3600000) return Math.round(diff / 3600000) + "시간 전";
      if (diff >= 0 && diff < 7 * 24 * 3600000) return Math.round(diff / 86400000) + "일 전";
      return d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).replace(/\s/g, "");
    } catch (e) { return ""; }
  }
  function todayKST() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  }
  function dayNumber(ymd) {
    var p = String(ymd).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
  }
  function dday(due) {
    if (!due) return null;
    var d = String(due).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return dayNumber(d) - dayNumber(todayKST());
  }
  function providerLabel(p) {
    var k = String(p || "").toLowerCase();
    return ({ google: "구글", email: "이메일", kakao: "카카오", naver: "네이버", apple: "애플" })[k] || (p || "이메일");
  }
  function memberLabel(id) {
    var m = null;
    for (var i = 0; i < members.length; i++) if (members[i].id === id) { m = members[i]; break; }
    if (!m) return "알 수 없음";
    return m.nickname ? m.nickname + " (" + (m.email || "") + ")" : (m.email || m.id.slice(0, 8));
  }

  /* ---------------- 화면 상태 전환 ---------------- */
  function show(which) {
    ["state-loading", "state-gate", "state-dash"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = (id !== which);
    });
  }
  function setWho(text, showLogout) {
    var who = $("#admin-who"), out = $("#logout-btn");
    if (who) { who.textContent = text || ""; who.hidden = !text; }
    if (out) out.hidden = !showLogout;
  }
  function gateMsg(text, kind) {
    var el = $("#gate-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "gate-msg" + (kind === "ok" ? " ok" : "");
  }

  function renderGate(kind) {
    // kind: "anon" | "denied" | "error"
    show("state-gate");
    var account = $("#gate-account");
    if (kind === "denied" && session) {
      $("#gate-title").textContent = "관리자 권한이 필요합니다";
      $("#gate-desc").textContent = "로그인은 되었지만 이 계정에는 관리자 권한이 없습니다. 운영자 계정으로 다시 로그인해 주세요.";
      $("#gate-account-mail").textContent = session.user && session.user.email ? session.user.email : "(이메일 없음)";
      account.hidden = false;
      $("#google-btn-label").textContent = "운영자 계정으로 다시 로그인";
      setWho(session.user && session.user.email ? session.user.email : "", true);
    } else {
      $("#gate-title").textContent = "관리자 권한이 필요합니다";
      $("#gate-desc").textContent = brandName() + " 운영자 계정으로 로그인하면 회원·찜·등록 현황을 볼 수 있습니다.";
      account.hidden = true;
      $("#google-btn-label").textContent = "구글로 로그인";
      setWho("", false);
    }
    if (kind === "error") gateMsg("관리자 여부를 확인하지 못했습니다. 잠시 후 새로고침해 주세요.", "");
  }

  /* ---------------- 로그인 ---------------- */
  function oauth() {
    if (!sb) { gateMsg("Supabase 설정을 불러오지 못했습니다.", ""); return; }
    gateMsg("구글 로그인 화면으로 이동합니다…", "ok");
    var btn = $("#google-btn");
    if (btn) btn.disabled = true;
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname }
    }).then(function (r) {
      if (r && r.error) {
        gateMsg("구글 로그인을 시작하지 못했습니다: " + r.error.message, "");
        if (btn) btn.disabled = false;
      }
    });
  }

  function passwordLogin(e) {
    if (e) e.preventDefault();
    var email = ($("#pw-email").value || "").trim();
    var pass = $("#pw-pass").value || "";
    if (!email || !pass) { gateMsg("이메일과 비밀번호를 모두 입력해 주세요.", ""); return; }
    var b = $("#pw-submit");
    b.disabled = true; b.textContent = "로그인 중…";
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      b.disabled = false; b.textContent = "로그인";
      if (r.error) { gateMsg("로그인 실패: " + r.error.message, ""); return; }
      var pw = $("#pw-pass"); if (pw) pw.value = "";   // 비밀번호는 화면에 남기지 않습니다
      gateMsg("로그인했습니다. 권한을 확인합니다…", "ok");
      boot(true);
    });
  }

  function logout() {
    if (!sb) return;
    sb.auth.signOut().then(function () {
      session = null; isAdmin = false; members = []; bookmarks = [];
      setWho("", false);
      renderGate("anon");
    });
  }

  /* ---------------- 관리자 판별 + 데이터 ---------------- */
  function boot(force) {
    if (!CONFIGURED || !sb) {
      show("state-gate");
      $("#gate-desc").textContent = "Supabase 연결 설정이 없어 관리자 페이지를 사용할 수 없습니다.";
      $("#google-btn").disabled = true;
      return;
    }
    if (!force) show("state-loading");
    sb.auth.getSession().then(function (r) {
      session = (r && r.data && r.data.session) || null;
      if (!session) { renderGate("anon"); return; }
      return sb.rpc("is_admin").then(function (res) {
        if (res.error) { isAdmin = false; renderGate("error"); return; }
        isAdmin = res.data === true;
        if (!isAdmin) { renderGate("denied"); return; }
        setWho(session.user.email || "", true);
        show("state-dash");
        loadAll(force);
        /* /admin#sbp-export 처럼 들어오면 플러그인 탭을 바로 엽니다. */
        try { if (window.SBPress && window.SBPress.openFromHash) window.SBPress.openFromHash(); } catch (e) { /* noop */ }
      });
    }).catch(function () { renderGate("error"); });
  }

  function loadAll(force) {
    var stamp = $("#dash-stamp");
    if (stamp) stamp.textContent = "불러오는 중…";
    Promise.all([loadMembers(), loadBookmarks(), loadSheet(), loadPostIndex(), loadGrade(), loadTasksAdmin(), loadAdmins(), loadAudit(), loadInbox()]).then(function () {
      recount();
      renderMembers();
      renderPopular();
      renderDday();
      renderKpis();
      renderSheet();
      if (stamp) {
        stamp.textContent = "마지막 확인 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
      }
    });
  }

  /* 시트 행 ↔ 게시판 글 대조용 색인 (slug · 분류 · 정렬값만) */
  function loadPostIndex() {
    if (!sb) return Promise.resolve();
    return sb.from("posts").select("id,slug,category,title,sort_order,is_pinned,is_published,publish_at")
      .limit(1000).then(function (r) {
        if (!r.error) CMS.postIndex = r.data || [];
      });
  }

  /* ---------------- 하위 관리자 (public.admin_users) ---------------- */
  var OWNER_EMAIL = (SC.ownerEmail || "").trim();

  function loadAdmins() {
    if (!sb) return Promise.resolve();
    return sb.from("admin_users").select("email,note,added_at").order("added_at").then(function (r) {
      if (r.error) { cmsMsg("admin-msg", "관리자 목록을 불러오지 못했습니다: " + r.error.message, "err"); return; }
      CMS.admins = r.data || [];
      CMS.adminsLoaded = true;
      renderAdmins();
    });
  }

  function renderAdmins() {
    var body = $("#admin-table tbody");
    var tag = $("#admin-count");
    if (tag) tag.textContent = CMS.admins.length + "명";
    if (!body) return;
    if (!CMS.admins.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="4">관리자 목록을 불러오지 못했습니다.</td></tr>';
      return;
    }
    body.innerHTML = CMS.admins.map(function (a) {
      var owner = String(a.email || "").toLowerCase() === OWNER_EMAIL;
      return "<tr" + (owner ? ' class="owner-row"' : "") + ">" +
        '<td data-th="이메일">' + esc(a.email) +
          (owner ? ' <span class="badge b-owner">소유자</span>' : "") + "</td>" +
        '<td class="muted" data-th="메모">' + esc(a.note || "–") + "</td>" +
        '<td class="muted" data-th="추가일">' + esc(fmtDate(a.added_at)) + "</td>" +
        '<td class="row-actions">' +
          (owner
            ? '<span class="muted">뺄 수 없음</span>'
            : '<button type="button" class="rowlink danger admin-remove" data-email="' + esc(a.email) + '">관리자에서 빼기</button>') +
        "</td></tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".admin-remove"), function (b) {
      b.addEventListener("click", function () { removeAdmin(b.getAttribute("data-email")); });
    });
  }

  function addAdmin() {
    if (!sb) return;
    var email = ($("#new-admin-email").value || "").trim().toLowerCase();
    var note = ($("#new-admin-note").value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      cmsMsg("admin-msg", "관리자 이메일 형식을 확인해 주세요.", "err");
      $("#new-admin-email").focus();
      return;
    }
    if (CMS.admins.some(function (a) { return String(a.email).toLowerCase() === email; })) {
      cmsMsg("admin-msg", "이미 등록된 관리자입니다: " + email, "err");
      return;
    }
    var btn = $("#admin-add");
    if (btn) btn.disabled = true;
    cmsMsg("admin-msg", "추가하는 중…");
    sb.from("admin_users").insert({ email: email, note: note || null }).then(function (r) {
      if (btn) btn.disabled = false;
      if (r.error) { cmsMsg("admin-msg", "추가하지 못했습니다: " + r.error.message, "err"); return; }
      $("#new-admin-email").value = "";
      $("#new-admin-note").value = "";
      cmsMsg("admin-msg", "관리자를 추가했습니다: " + email + " — 이 계정으로 /admin 에 로그인할 수 있습니다.", "ok");
      loadAdmins();
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      cmsMsg("admin-msg", "추가하지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
    });
  }

  function removeAdmin(email) {
    if (!sb || !email) return;
    if (String(email).toLowerCase() === OWNER_EMAIL) {
      cmsMsg("admin-msg", "운영자(소유자) 계정은 관리자 목록에서 뺄 수 없습니다.", "err");
      return;
    }
    if (!window.confirm("‘" + email + "’ 계정을 관리자에서 뺄까요?\n이 계정으로는 더 이상 /admin 을 쓸 수 없습니다.")) return;
    cmsMsg("admin-msg", "빼는 중…");
    sb.from("admin_users").delete().eq("email", email).then(function (r) {
      if (r.error) { cmsMsg("admin-msg", "빼지 못했습니다: " + r.error.message, "err"); return; }
      cmsMsg("admin-msg", "관리자에서 뺐습니다: " + email, "ok");
      loadAdmins();
    });
  }

  /* ---------------- 보안 · 감사 로그 (public.audit_logs) ---------------- */
  var AUDIT_ACT = { insert: "추가", update: "수정", delete: "삭제" };
  var AUDIT_TBL = { posts: "게시글", pages: "페이지", boards: "게시판", plugins: "플러그인",
                    admin_users: "관리자", site_contents: "사이트 문구" };
  var cspViolations = 0;

  /* 이 화면에서 실제로 일어난 CSP 위반을 셉니다(브라우저가 막을 때마다 +1). */
  document.addEventListener("securitypolicyviolation", function () { cspViolations += 1; renderSecurity(); });

  function fmtStamp(iso) {
    if (!iso) return "–";
    try {
      return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
                                                    hour: "2-digit", minute: "2-digit", hour12: false }).replace(/\s+/g, " ");
    } catch (e) { return "–"; }
  }

  function cspMeta() {
    return document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  }

  function renderSecurity() {
    var meta = cspMeta();
    var csp = $("#sec-csp"), rls = $("#sec-rls"), rate = $("#sec-rate"), plug = $("#sec-plugin");
    function set(el, text, ok) {
      if (!el) return;
      el.textContent = text;
      var box = el.parentNode;
      if (box) { box.classList.toggle("is-ok", !!ok); box.classList.toggle("is-warn", !ok); }
    }
    if (csp) {
      if (!meta) set(csp, "없음 — meta 미적용", false);
      else set(csp, "켜짐 · 이 화면 위반 " + cspViolations + "건", cspViolations === 0);
    }
    if (rls) {
      set(rls, CMS.auditLoaded ? "적용 · 관리자만 조회(감사 로그 확인됨)" : "확인 중…", !!CMS.auditLoaded);
    }
    if (rate) {
      set(rate, "서버 적용 · 캡차 15회/분 · 비회원 댓글 5회/분 · 폼 5건/분", true);
    }
    if (plug) {
      var bad = plugRows.filter(function (p) { return !/^(https:\/\/|\/)/.test(String(p.script_url || "").trim()); });
      var skipped = 0;
      try { skipped = (window.SBPress && window.SBPress.notices ? window.SBPress.notices() : []).length; } catch (e) { skipped = 0; }
      set(plug, bad.length ? ("주의 · 잘못된 주소 " + bad.length + "개") :
        ("https/상대 경로만 · 관리자 화면 격리 " + (skipped ? "(건너뜀 " + skipped + ")" : "중")), bad.length === 0);
    }
  }

  function loadAudit() {
    var body = $("#audit-table tbody");
    renderSecurity();
    if (!sb || !body) return Promise.resolve();
    body.innerHTML = '<tr class="empty-row"><td colspan="5">불러오는 중…</td></tr>';
    return sb.from("audit_logs")
      .select("created_at,actor_email,action,target_table,target_id,detail")
      .order("created_at", { ascending: false }).limit(20)
      .then(function (r) {
        if (r.error) {
          body.innerHTML = '<tr class="empty-row"><td colspan="5">불러오지 못했습니다: ' + esc(r.error.message) + "</td></tr>";
          cmsMsg("audit-msg", "감사 로그를 읽지 못했습니다: " + r.error.message, "err");
          CMS.auditLoaded = false;
          renderSecurity();
          return;
        }
        CMS.auditLoaded = true;
        renderAudit(r.data || []);
        renderSecurity();
      });
  }

  function renderAudit(rows) {
    var body = $("#audit-table tbody");
    var tag = $("#audit-count");
    if (tag) tag.textContent = rows.length ? "최근 " + rows.length + "건" : "기록 없음";
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="5">아직 기록이 없습니다. 글·페이지·게시판·플러그인·관리자·사이트 문구를 바꾸면 여기에 남습니다.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (a) {
      var d = a.detail || {};
      var what = d.label ? String(d.label) : (a.target_id || "–");
      if (d.changed && d.changed.length) what += " · " + d.changed.slice(0, 3).join(", ") + (d.changed.length > 3 ? " 외" : "");
      return "<tr>" +
        '<td class="audit-when" data-th="시각">' + esc(fmtStamp(a.created_at)) + "</td>" +
        '<td class="audit-who muted" data-th="관리자" title="' + esc(a.actor_email || "") + '">' + esc(a.actor_email || "시스템") + "</td>" +
        '<td class="audit-act" data-th="동작"><span class="plug-badge b-' +
          (a.action === "delete" ? "custom" : a.action === "update" ? "market" : "builtin") + '">' +
          esc(AUDIT_ACT[a.action] || a.action) + "</span></td>" +
        '<td data-th="대상">' + esc(AUDIT_TBL[a.target_table] || a.target_table) + "</td>" +
        '<td data-th="항목" class="muted">' + esc(what) + "</td>" +
        "</tr>";
    }).join("");
  }

  function loadMembers() {
    var since = new Date(Date.now() - WEEK_MS).toISOString();
    return Promise.all([
      sb.from("profiles").select("id,email,nickname,provider,created_at,member_grade").order("created_at", { ascending: false }).limit(1000),
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since)
    ]).then(function (res) {
      var list = res[0], total = res[1], weekly = res[2];
      members = (list.data || []).slice();
      members.forEach(function (m) { m.bookmarkCount = 0; });
      memberStats = {
        total: total.count != null ? total.count : members.length,
        weekly: weekly.count != null ? weekly.count : 0,
        loaded: members.length,
        error: list.error ? (list.error.message || "조회 실패") : null
      };
    });
  }

  function recount() {
    var counts = Object.create(null);
    bookmarks.forEach(function (b) { counts[b.user_id] = (counts[b.user_id] || 0) + 1; });
    members.forEach(function (m) { m.bookmarkCount = counts[m.id] || 0; });
  }

  function loadBookmarks() {
    return Promise.all([
      sb.from("bookmarks").select("user_id,workshop_name,created_at").order("created_at", { ascending: false }).limit(1000),
      sb.from("bookmarks").select("id", { count: "exact", head: true })
    ]).then(function (res) {
      var list = res[0], total = res[1];
      bookmarks = (list.data || []).slice();
      var counts = Object.create(null), users = Object.create(null);
      bookmarks.forEach(function (b) {
        counts[b.user_id] = (counts[b.user_id] || 0) + 1;
        users[b.user_id] = 1;
      });
      members.forEach(function (m) { m.bookmarkCount = counts[m.id] || 0; });
      memberStats.users = Object.keys(users).length;
      bookmarkStats = {
        total: total.count != null ? total.count : bookmarks.length,
        loaded: bookmarks.length,
        error: list.error ? (list.error.message || "조회 실패") : null
      };
    });
  }

  var memberStats = { total: 0, weekly: 0, loaded: 0, users: 0, error: null };
  var bookmarkStats = { total: 0, loaded: 0, error: null };

  function loadSheet() {
    var note = $("#sheet-note");
    if (!feature("sheets") || !SHEET_ID) {
      var panel = $("#p-sheet");
      if (panel) panel.hidden = true;
      sheetRows = [];
      return Promise.resolve();
    }
    if (!window.fetch) { sheetRows = []; return Promise.resolve(); }
    if (note) note.textContent = SHEET_LABEL + " · 불러오는 중…";
    var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&_=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (t) { sheetRows = parseSheet(t); sheetError = null; })
      .catch(function (e) { sheetRows = []; sheetError = e && e.message ? e.message : "시트 조회 실패"; })
      .then(function () { renderSheet(); });
  }
  var sheetError = null;

  function parseSheet(text) {
    var a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b < a) return [];
    var json = JSON.parse(text.slice(a, b + 1));
    var cols = (json.table.cols || []).map(function (c) { return c.label; });
    var idx = function (label) { return cols.indexOf(label); };
    var map = {
      when: idx("타임스탬프"), kind: idx("구분"), name: idx("공방명 / 기관명"), craft: idx("분야"),
      region: idx("지역(시·도)"), address: idx("상세 주소"), oneday: idx("원데이클래스 운영 여부"),
      url: idx("홈페이지 / 인스타그램 / 연락처 링크"), desc: idx("한 줄 소개 및 상세 내용"), status: idx("승인상태")
    };
    return (json.table.rows || []).map(function (r, i) {
      var cell = function (k) {
        var j = map[k];
        if (j < 0) return "";
        var c = r.c && r.c[j];
        if (!c) return "";
        var v = (c.f != null && String(c.v).indexOf("Date(") === 0) ? c.f : c.v;
        return v == null ? "" : String(v).trim();
      };
      // 타임스탬프는 Date(2026,10,20,20,26,53) 형태로 오므로 짧은 표기(YYYY.MM.DD HH:MM)를 따로 만듭니다.
      var rawWhen = r.c && map.when >= 0 ? r.c[map.when] : null;
      var whenShort = "";
      if (rawWhen && typeof rawWhen.v === "string" && rawWhen.v.indexOf("Date(") === 0) {
        var p = rawWhen.v.slice(5, -1).split(",").map(Number);
        var pad = function (n) { return String(n).padStart(2, "0"); };
        whenShort = p[0] + "." + pad(p[1] + 1) + "." + pad(p[2]) + " " + pad(p[3]) + ":" + pad(p[4]);
      }
      return {
        row: i + 2, when: cell("when"), whenShort: whenShort || cell("when"), kind: cell("kind") || "공방 등록", name: cell("name"),
        craft: cell("craft"), region: cell("region"), address: cell("address"),
        oneday: cell("oneday"), url: cell("url"), desc: cell("desc"), status: cell("status")
      };
    }).filter(function (r) { return r.name; });
  }

  /* ---------------- KPI ---------------- */
  function renderKpis() {
    var contents = 0, weekly = 0;
    var S = window.SITE || {};
    ["workshops", "news", "interviews", "info"].forEach(function (k) {
      var n = (S[k] || []).length; contents += n; weekly += n;
    });
    var archive = (window.ARCHIVE && window.ARCHIVE.total) || 0;
    var approved = sheetRows.filter(function (r) { return r.status === "승인"; }).length;
    var waiting = sheetRows.length - approved;
    var soon = (S.info || []).filter(function (it) {
      var d = dday(it.due); return d != null && d >= 0 && d <= 7;
    }).length;

    $("#k-members").innerHTML = num(memberStats.total);
    $("#k-members-note").textContent = memberStats.error ? "조회 오류" :
      ("최근 7일 신규 +" + num(memberStats.weekly) + "명 · 찜한 회원 " + num(memberStats.users || 0) + "명");

    $("#k-bookmarks").innerHTML = num(bookmarkStats.total);
    $("#k-bookmarks-note").textContent = bookmarkStats.error ? "조회 오류" :
      ((memberStats.total ? (bookmarkStats.total / memberStats.total).toFixed(1) : "0") + "개/회원 · 최근 " + num(bookmarkStats.loaded) + "건 집계");

    $("#k-workshops").innerHTML = num(approved) + '<span class="unit">곳</span>';
    $("#k-workshops-note").textContent = sheetError ? "시트 연결 실패" : ("검토 대기 " + num(waiting) + "곳 · 시트 전체 " + num(sheetRows.length) + "행");

    $("#k-contents").innerHTML = num(contents + archive);
    $("#k-contents-note").textContent = "이번 주 " + num(weekly) + "건 + 아카이브 " + num(archive) + "건";

    $("#k-dday").innerHTML = num(soon) + '<span class="unit">건</span>';
    $("#k-dday-note").textContent = "7일 안에 마감 · " + todayKST();
  }

  /* ---------------- 회원 목록 ---------------- */
  /* ---------------- 회원 등급 ---------------- */
  var GRADE_DEFAULT = { 1: "일반회원", 2: "정회원", 3: "특별회원(VIP)" };
  var GRADE_NAMES = { 1: GRADE_DEFAULT[1], 2: GRADE_DEFAULT[2], 3: GRADE_DEFAULT[3] };
  function gradeName(n) {
    var g = (n >= 1 && n <= 3) ? n : 1;
    return GRADE_NAMES[g] || GRADE_DEFAULT[g];
  }
  function gradeOfRow(m) {
    var g = m && m.member_grade != null ? parseInt(m.member_grade, 10) : 1;
    return (g >= 1 && g <= 3) ? g : 1;
  }
  function gradeOptions(sel) {
    return [1, 2, 3].map(function (g) {
      return '<option value="' + g + '"' + (g === sel ? " selected" : "") + ">" +
        esc(tr(g + "단계") + " · " + tr(gradeName(g))) + "</option>";
    }).join("");
  }
  function setGrade(id, grade) {
    var m = null;
    for (var i = 0; i < members.length; i++) if (members[i].id === id) { m = members[i]; break; }
    if (!m) return;
    cmsMsg("member-msg", "등급을 바꾸는 중…");
    sb.from("profiles").update({ member_grade: grade }).eq("id", id).then(function (r) {
      if (r.error) {
        cmsMsg("member-msg", "등급을 바꾸지 못했습니다: " + r.error.message, "err");
        renderMembers();
        return;
      }
      m.member_grade = grade;
      renderMembers();
      cmsMsg("member-msg", (m.email || m.id.slice(0, 8)) + " 회원을 " + grade + "단계 · " + gradeName(grade) + "(으)로 바꿨습니다.", "ok");
    }).catch(function (e) {
      cmsMsg("member-msg", "등급을 바꾸지 못했습니다: " + (e.message || "알 수 없는 오류"), "err");
      renderMembers();
    });
  }

  function renderMembers() {
    var body = $("#member-table tbody");
    var note = $("#member-note");
    if (!body) return;
    if (memberStats.error) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">회원 목록을 불러오지 못했습니다: ' + esc(memberStats.error) + "</td></tr>";
      return;
    }
    if (note) {
      note.innerHTML = "Supabase <code>profiles</code> · 전체 " + num(memberStats.total) +
        "명" + (memberStats.loaded < memberStats.total ? " (최근 " + num(memberStats.loaded) + "명 표시)" : "") +
        " · 관리자 권한 조회(RLS) · 등급은 오른쪽 선택상자로 바로 바꿉니다";
    }
    var q = ($("#member-q").value || "").trim().toLowerCase();
    var rows = members.filter(function (m) {
      if (!q) return true;
      return (m.email || "").toLowerCase().indexOf(q) >= 0 || (m.nickname || "").toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">' + (members.length ? "검색 결과가 없습니다." : "아직 가입한 회원이 없습니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (m) {
      var isMe = session && session.user && m.id === session.user.id;
      var g = gradeOfRow(m);
      return "<tr>" +
        '<td class="ellip" data-th="이메일">' + esc(m.email || "–") + (isMe ? ' <span class="badge b-admin">나</span>' : "") + "</td>" +
        '<td data-th="닉네임">' + esc(m.nickname || "–") + "</td>" +
        '<td data-th="등급"><div class="grade-cell">' +
          '<span class="badge b-grade g' + g + '">' + esc(gradeName(g)) + "</span>" +
          '<select class="admin-select grade-select" data-id="' + esc(m.id) + '" aria-label="' + esc((m.email || "회원") + " 등급 변경") + '">' +
            gradeOptions(g) + "</select></div></td>" +
        '<td data-th="로그인"><span class="badge b-off">' + esc(providerLabel(m.provider)) + "</span></td>" +
        '<td class="muted" data-th="가입일">' + esc(fmtDate(m.created_at)) + "</td>" +
        '<td class="num" data-th="찜">' + num(m.bookmarkCount) + "</td>" +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".grade-select"), function (sel) {
      sel.addEventListener("change", function () {
        var g = parseInt(sel.value, 10);
        if (!(g >= 1 && g <= 3)) return;
        setGrade(sel.getAttribute("data-id"), g);
      });
    });
  }

  function downloadCsv() {
    var head = ["이메일", "닉네임", "등급", "로그인", "가입일", "찜"];
    var lines = [head.join(",")].concat(members.map(function (m) {
      var cells = [m.email || "", m.nickname || "", gradeName(gradeOfRow(m)), providerLabel(m.provider), fmtDate(m.created_at), m.bookmarkCount || 0];
      return cells.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }));
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = brandName() + "_회원목록_" + todayKST() + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------------- 인기 찜 ---------------- */
  function renderPopular() {
    var rankEl = $("#bm-rank"), recentEl = $("#bm-recent"), tag = $("#bm-total");
    if (bookmarkStats.error) {
      rankEl.innerHTML = '<li class="panel-msg error">찜 데이터를 불러오지 못했습니다.</li>';
      recentEl.innerHTML = "";
      if (tag) tag.textContent = "오류";
      return;
    }
    var byName = Object.create(null);
    bookmarks.forEach(function (b) {
      var k = b.workshop_name || "(이름 없음)";
      byName[k] = (byName[k] || 0) + 1;
    });
    var arr = Object.keys(byName).map(function (k) { return { name: k, n: byName[k] }; })
      .sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); });
    if (tag) tag.textContent = "찜 " + num(bookmarkStats.total) + "건 · 공방 " + num(arr.length) + "곳";
    var top = arr.slice(0, 8), max = top.length ? top[0].n : 1;
    rankEl.innerHTML = top.length ? top.map(function (r, i) {
      var w = Math.max(6, Math.round(r.n / max * 100));
      return '<li><span class="rn">' + (i + 1) + '</span><span class="rname">' + esc(r.name) + '</span>' +
        '<span class="rc">' + r.n + '</span><span class="rbar"><i style="width:' + w + '%"></i></span></li>';
    }).join("") : '<li class="panel-msg">아직 찜한 공방이 없습니다.</li>';

    var recent = bookmarks.slice(0, 10);
    recentEl.innerHTML = recent.length ? recent.map(function (b) {
      return '<li><span class="rw">' + esc(b.workshop_name || "–") + "</span>" +
        '<span class="rt">' + esc(fmtWhen(b.created_at)) + " · " + esc(memberLabel(b.user_id)) + "</span></li>";
    }).join("") : '<li class="panel-msg">최근 찜 기록이 없습니다.</li>';
  }

  /* ---------------- 구글 시트: 등록·제보 ---------------- */
  function renderSheet() {
    var body = $("#sheet-table tbody"), note = $("#sheet-note");
    if (sheetError) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">시트에 연결하지 못했습니다(' + esc(sheetError) + '). <a class="rowlink" href="' + SHEET_URL + '" target="_blank" rel="noopener">시트에서 직접 보기</a></td></tr>';
      if (note) note.textContent = SHEET_LABEL + " · 실시간 조회 실패";
      return;
    }
    var q = ($("#sheet-q").value || "").trim().toLowerCase();
    var st = $("#sheet-status").value;
    var rows = sheetRows.filter(function (r) {
      if (st === "승인" && r.status !== "승인") return false;
      if (st === "대기" && r.status === "승인") return false;
      if (!q) return true;
      return [r.name, r.region, r.craft, r.kind].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    if (note) {
      var ok = sheetRows.filter(function (r) { return r.status === "승인"; }).length;
      note.innerHTML = SHEET_LABEL + " · 전체 " + num(sheetRows.length) + "건 (승인 " + num(ok) +
        " · 대기 " + num(sheetRows.length - ok) + ") · 행을 누르면 시트에서 바로 엽니다";
    }
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">조건에 맞는 항목이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var cls = r.status === "승인" ? "b-ok" : (r.status ? "b-wait" : "b-off");
      var posted = postBySheetSlug(sheetSlug(r));
      var pubCell;
      if (posted) pubCell = '<span class="badge b-ok" title="' + esc(posted.title || "") + '">게시됨</span>';
      else if (r.status === "승인") pubCell = '<button type="button" class="rowlink sheet-pub" data-row="' + r.row + '">게시판에 게시</button>';
      else pubCell = '<span class="muted">승인 후 게시</span>';
      return "<tr>" +
        '<td data-th="상태"><span class="badge ' + cls + '">' + esc(r.status || "미지정") + "</span></td>" +
        '<td data-th="공방명">' + esc(r.name) + "</td>" +
        '<td class="muted" data-th="구분">' + esc(r.kind) + "</td>" +
        '<td data-th="분야">' + esc(r.craft || "–") + "</td>" +
        '<td data-th="지역">' + esc(r.region || "–") + "</td>" +
        '<td class="muted" data-th="접수">' + esc(r.whenShort || "–") + "</td>" +
        '<td data-th="게시">' + pubCell + "</td>" +
        '<td><a class="rowlink" href="' + SHEET_URL + '#gid=0&range=A' + r.row + '" target="_blank" rel="noopener" title="시트에서 이 행 열기">시트</a></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".sheet-pub"), function (b) {
      b.addEventListener("click", function () { publishFromSheet(+b.getAttribute("data-row")); });
    });
  }

  /* ---------------- 시트 → 게시판 원클릭 게시 ---------------- */
  function sheetSlug(r) {
    // 이름·지역으로 만드는 고정 slug — 같은 행을 두 번 게시해도 중복되지 않습니다.
    var key = String(r.name || "").trim() + "|" + String(r.region || "").trim();
    var h = 5381;
    for (var i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
    return "sheet-" + h.toString(36);
  }
  function postBySheetSlug(slug) {
    for (var i = 0; i < CMS.postIndex.length; i++) {
      if (CMS.postIndex[i].slug === slug) return CMS.postIndex[i];
    }
    return null;
  }
  function nextSheetSort() {
    var max = 0, n = 0;
    CMS.postIndex.forEach(function (p) {
      if (p.category !== "소개") return;
      n++;
      if ((p.sort_order || 0) > max) max = p.sort_order || 0;
    });
    return Math.max(max, n) + 1;
  }
  function publishFromSheet(rowNo) {
    var r = null;
    for (var i = 0; i < sheetRows.length; i++) if (sheetRows[i].row === rowNo) { r = sheetRows[i]; break; }
    if (!r) return;
    if (r.status !== "승인") { cmsMsg("sheet-msg", "승인된 항목만 게시할 수 있습니다.", "err"); return; }
    var slug = sheetSlug(r);
    var exist = postBySheetSlug(slug);
    if (exist) {
      cmsMsg("sheet-msg", "이미 게시판에 올라간 공방입니다: " + (exist.title || r.name), "");
      renderSheet();
      return;
    }
    var btn = document.querySelector('.sheet-pub[data-row="' + rowNo + '"]');
    if (btn) { btn.disabled = true; btn.textContent = "게시하는 중…"; }
    cmsMsg("sheet-msg", "게시하는 중…");
    var body = {
      slug: slug,
      category: "소개",
      title: r.name,
      summary: r.desc || null,
      body: r.address ? "주소: " + r.address : (r.desc || null),
      region: r.region || null,
      source_name: brandName() + " 등록 게시판",
      source_url: r.url || null,
      image_url: null,
      published_at: todayKST(),
      is_published: true,
      is_pinned: false,
      sort_order: nextSheetSort(),
      meta: { tag: r.kind || "공방", address: r.address || "", oneday: r.oneday || "" }
    };
    sb.from("posts").insert(body).then(function (res) {
      if (res.error) {
        var m = String(res.error.message || "");
        if (/duplicate|unique|23505/i.test(m)) {
          CMS.postIndex.push({ slug: slug, title: r.name, category: "소개", is_published: true, sort_order: body.sort_order });
          renderSheet();
          cmsMsg("sheet-msg", "이미 게시판에 올라간 공방입니다: " + r.name, "");
        } else {
          cmsMsg("sheet-msg", "게시하지 못했습니다: " + m, "err");
          renderSheet();
        }
        return;
      }
      CMS.postIndex.push({ slug: slug, title: r.name, category: "소개", is_published: true, sort_order: body.sort_order });
      CMS.loaded.posts = false;
      renderSheet();
      cmsMsg("sheet-msg", "‘" + r.name + "’을(를) 게시판 ‘소개’ 코너에 올렸습니다. 공개 사이트에 바로 반영됩니다.", "ok");
      if (typeof renderKpis === "function") renderKpis();
    }).catch(function (e) {
      cmsMsg("sheet-msg", "게시하지 못했습니다: " + (e.message || "알 수 없는 오류"), "err");
      renderSheet();
    });
  }

  /* ---------------- D-day ---------------- */
  function renderDday() {
    var list = $("#dday-list"), tag = $("#dday-tag");
    var S = window.SITE || {};
    var items = (S.info || []).map(function (it) {
      return { it: it, d: dday(it.due) };
    }).filter(function (x) { return x.d != null; })
      .sort(function (a, b) { return a.d - b.d; });

    var upcoming = items.filter(function (x) { return x.d >= 0; });
    var past = items.filter(function (x) { return x.d < 0 && x.d >= -7; }).sort(function (a, b) { return b.d - a.d; });
    var show = upcoming.concat(past).slice(0, 10);

    if (tag) tag.textContent = "진행 " + upcoming.length + "건 · 7일 내 " + upcoming.filter(function (x) { return x.d <= 7; }).length + "건";
    if (!show.length) { list.innerHTML = '<li class="panel-msg">마감일이 있는 항목이 없습니다.</li>'; return; }
    list.innerHTML = show.map(function (x) {
      var d = x.d, cls = d < 0 ? "d-gray" : (d <= 3 ? "d-red" : (d <= 7 ? "d-amber" : "d-gray"));
      var label = d < 0 ? "종료" : (d === 0 ? "오늘" : "D-" + d);
      var it = x.it;
      return '<li><span class="dday ' + cls + '">' + label + "</span>" +
        '<span class="dday-body"><a class="dday-title" href="' + esc(it.url || "#") + '" target="_blank" rel="noopener">' + esc(it.title) + "</a>" +
        '<span class="dday-meta">' + esc(it.org || "") + " · " + esc(it.period || it.due || "") + (it.kind ? " · " + esc(it.kind) : "") + "</span></span></li>";
    }).join("");
  }

  /* ---------------- 바로가기 ---------------- */
  function renderQuickLinks() {
    var links = [];
    if (GA_ID) links.push({ t: "Google Analytics 4", s: "방문·유입 통계 (" + GA_ID + ")", h: "https://analytics.google.com/analytics/web/" });
    if (PROJECT_REF) {
      links.push({ t: "Supabase 대시보드", s: PROJECT_REF + " · DB·Auth", h: "https://supabase.com/dashboard/project/" + PROJECT_REF });
      links.push({ t: "Supabase 회원(Auth Users)", s: "가입자 확인·계정 삭제", h: "https://supabase.com/dashboard/project/" + PROJECT_REF + "/auth/users" });
    }
    if (SHEET_URL) links.push({ t: SHEET_LABEL, s: "공방 등록·제보 승인 처리", h: SHEET_URL });
    if (SH.subscribersUrl) links.push({ t: SH.subscribersLabel || "뉴스레터_구독자DB", s: "구독자 명단(비공개)", h: SH.subscribersUrl });
    (Array.isArray(SC.links) ? SC.links : []).forEach(function (l) {
      if (l && l.h && l.t) links.push({ t: l.t, s: l.s || "", h: l.h });
    });
    $("#quick-links").innerHTML = links.map(function (l) {
      return '<li><a href="' + esc(l.h) + '" target="_blank" rel="noopener"><span>' + esc(l.t) +
        "<small>" + esc(l.s) + '</small></span><span class="qext">열기 ↗</span></a></li>';
    }).join("");
  }

  /* ============================================================
     관리자 CMS — 페이지 텍스트·이미지 / 게시판 관리 / 댓글 관리
     ============================================================ */
  var CMS = {
    tab: "dash",
    pages: [], posts: [], comments: [], media: [], postIndex: [],
    customPages: [], boardRows: [], editingPage: null, editingBoard: null, pageImages: [], pageBlocks: [],
    loaded: { pages: false, posts: false, comments: false, brand: false, media: false, boards: false, grade: false, tasks: false, approvals: false },
    editing: null, commentCounts: {}, brand: null,
    admins: [], adminsLoaded: false, auditLoaded: false
  };

  /* 본문 편집기(assets/editor.js) — 툴바·이미지 삽입·미리보기 */
  var postEditor = null, pageEditor = null;

  /* 게시판 slug ↔ posts.category 값 (기본 4개는 한글 분류) */
  var CAT_ALIAS = { intro: "소개", news: "뉴스", interview: "인터뷰", info: "정보" };
  function boardKeyOf(b) { return b ? (CAT_ALIAS[b.slug] || b.slug) : ""; }
  function boardNameFor(cat) {
    for (var i = 0; i < CMS.boardRows.length; i++) {
      if (boardKeyOf(CMS.boardRows[i]) === cat) return CMS.boardRows[i].name;
    }
    return cat;
  }
  function boardByKeyAdmin(key) {
    for (var i = 0; i < CMS.boardRows.length; i++) {
      if (boardKeyOf(CMS.boardRows[i]) === key) return CMS.boardRows[i];
    }
    return null;
  }

  function cmsMsg(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "cms-toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
  }

  function activateTab(name) {
    CMS.tab = name;
    [].forEach.call(document.querySelectorAll(".admin-tab"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false");
    });
    /* 플러그인이 추가한 탭(.tabpanel-sbp)까지 함께 감춥니다. */
    [].forEach.call(document.querySelectorAll("#state-dash .tabpanel"), function (p) {
      p.hidden = p.id !== "tab-" + name;
    });
    /* v8.0 — 통합 허브 · 복제 마법사 (assets/hub.js) */
    if (name === "hub" && window.CRAFT_HUB) window.CRAFT_HUB.load();
    /* v9.0 — 서명 · 동의서 (assets/esign.js) */
    if (name === "esign" && window.CRAFT_ESIGN) window.CRAFT_ESIGN.loadAdmin();
    if (name === "dash" && !CMS.adminsLoaded) loadAdmins();
    if (name === "dash") { loadAudit(); loadStats(); loadBudget(); loadTraffic(); loadDbUsage(); }
    if (name === "pages") { if (!CMS.loaded.pages) loadPages(); loadPageManager(); }
    if (name === "brand" && !CMS.loaded.brand) loadBrand();
    if (name === "brand") { loadGrade(); loadTheme(); }
    if (name === "posts") { if (!CMS.loaded.posts) loadPosts(); loadBoards(); }
    if (name === "tasks") loadTasksAdmin();
    if (name === "workpro") loadWorkPro();
    if (name === "approvals") loadApprovalsAdmin();
    if (name === "media") loadMedia();
    if (name === "comments" && !CMS.loaded.comments) loadComments();
    if (name === "subscribers") loadSubscribers();
    if (name === "inbox") loadInbox();
    if (name === "reserve") loadReservations();
    if (name === "backup") loadBackupCounts();
    if (name === "settings") {
      loadSettings();
      if (window.CRAFT_WEBHOOKS) window.CRAFT_WEBHOOKS.load();
      /* v8.0 — 도메인 연결 도우미 */
      if (window.CRAFT_HUB) window.CRAFT_HUB.loadDomain();
    }
    if (name === "plugins") loadPlugins();
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { /* noop */ }
  }

  /* ---------------- Storage 업로드 (+ WebP 압축 · 리사이즈) ----------------
     올리는 순간 브라우저에서 긴 변 1600px 로 줄이고 WebP(품질 82%)로 바꿉니다.
     · 사진이 많아도 Supabase 무료 Storage(1GB)를 아끼고 사이트가 가벼워집니다.
     · 미디어 라이브러리의 ‘원본 그대로 올리기’를 켜면 압축을 건너뜁니다.
     · SVG·GIF(움짤)는 브라우저가 다시 그릴 수 없어 그대로 올립니다. */
  var IMG_PREF_KEY = "sbp:img:original";
  var IMG_MAX = 1600;
  var IMG_QUALITY = 0.82;
  var imgSavedBytes = 0;
  var lastImgStat = null;

  function imgKeepOriginal() {
    try { return localStorage.getItem(IMG_PREF_KEY) === "1"; } catch (e) { return false; }
  }
  function imgSetKeepOriginal(on) {
    try { localStorage.setItem(IMG_PREF_KEY, on ? "1" : "0"); } catch (e) { /* noop */ }
    ["#img-original", "#pf-img-original"].forEach(function (sel) {
      var n = $(sel);
      if (n) n.checked = !!on;
    });
  }
  function imgCanOptimize(file) {
    if (!file || imgKeepOriginal()) return false;
    if (!/^image\/(jpeg|jpg|png|webp|bmp)$/i.test(String(file.type || ""))) return false;
    return !!(document.createElement("canvas").getContext && document.createElement("canvas").getContext("2d"));
  }
  function imgLoad(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file).catch(function () { return imgLoadTag(file); });
    }
    return imgLoadTag(file);
  }
  function imgLoadTag(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } res(im); };
      im.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } rej(new Error("이미지를 읽지 못했습니다.")); };
      im.src = url;
    });
  }
  function imgBaseName(name) {
    return String(name || "image").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 48) || "image";
  }
  /* → { file: 올릴 File, stat: {original,size,width,height,outW,outH,saved,optimized,type} | null } */
  function imgOptimize(file) {
    return imgLoad(file).then(function (img) {
      var w = img.width || img.naturalWidth || 0, h = img.height || img.naturalHeight || 0;
      if (!w || !h) return { file: file, stat: null };
      var scale = Math.min(1, IMG_MAX / Math.max(w, h));
      var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
      var cv = document.createElement("canvas");
      cv.width = tw; cv.height = th;
      var ctx = cv.getContext("2d");
      if (!ctx) return { file: file, stat: null };
      if (/image\/jpe?g/i.test(String(file.type || ""))) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, tw, th); }
      ctx.drawImage(img, 0, 0, tw, th);
      return new Promise(function (res) {
        if (!cv.toBlob) { res({ file: file, stat: null }); return; }
        cv.toBlob(function (blob) {
          if (!blob) { res({ file: file, stat: null }); return; }
          var smaller = blob.size < file.size;
          var out = smaller ? new File([blob], imgBaseName(file.name) + ".webp", { type: "image/webp", lastModified: Date.now() }) : file;
          res({
            file: out,
            stat: {
              original: file.size, size: out.size, width: w, height: h,
              outW: smaller ? tw : w, outH: smaller ? th : h,
              saved: Math.max(0, file.size - out.size), optimized: smaller,
              resized: smaller && scale < 1, type: out.type
            }
          });
        }, "image/webp", IMG_QUALITY);
      });
    }).catch(function () { return { file: file, stat: null }; });
  }
  function imgStatText(stat) {
    if (!stat) return "";
    if (!stat.optimized) {
      return "원본 그대로 올렸습니다 — WebP 로 바꿔도 더 작아지지 않았습니다(" + fmtBytes(stat.original) + ").";
    }
    var pct = Math.round((stat.saved / Math.max(1, stat.original)) * 100);
    return "WebP " + stat.outW + "×" + stat.outH + " · " + fmtBytes(stat.original) + " → " +
      fmtBytes(stat.size) + " (" + pct + "% 절감)";
  }
  function paintImgSaved() {
    var el = $("#img-saved");
    if (!el) return;
    el.textContent = imgSavedBytes > 0 ? "이번 방문 절감 " + fmtBytes(imgSavedBytes) : "";
  }
  function imgDone(msgSel, okText, stat) {
    if (stat) { lastImgStat = stat; imgSavedBytes += stat.saved; paintImgSaved(); }
    var el = msgSel ? (typeof msgSel === "string" ? $(msgSel) : msgSel) : null;
    if (!el) return;
    el.className = "cms-toast ok";
    el.innerHTML = (okText ? "<span>" + esc(okText) + "</span>" : "") +
      (stat ? '<span class="img-stat">' + esc(imgStatText(stat)) + "</span>" : "");
  }

  function uploadSiteImage(file, prefix, msgSel, okText) {
    if (!file) return Promise.reject(new Error("파일이 없습니다."));
    if (!/^image\//.test(file.type || "")) return Promise.reject(new Error("이미지 파일만 올릴 수 있습니다."));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("이미지는 5MB까지 올릴 수 있습니다."));
    var prep = imgCanOptimize(file) ? imgOptimize(file) : Promise.resolve({ file: file, stat: null });
    return prep.then(function (r) {
      var up = r.file;
      var ext = (String(up.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      var path = prefix + "-" + Date.now().toString(36) + "." + ext;
      return sb.storage.from("site-media").upload(path, up, { upsert: true, contentType: up.type }).then(function (res) {
        if (res.error) throw new Error(res.error.message || "업로드 실패");
        var pub = sb.storage.from("site-media").getPublicUrl(path);
        var url = (pub && pub.data && pub.data.publicUrl) || "";
        if (!url) throw new Error("공개 주소를 받지 못했습니다.");
        imgDone(msgSel, okText, r.stat);
        return url;
      });
    });
  }

  /* ---------------- 0. 미디어 라이브러리 (site-media 재귀 목록) ---------------- */
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return Math.round(n / 1024) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function publicMediaUrl(path) {
    var r = sb.storage.from("site-media").getPublicUrl(path);
    return (r && r.data && r.data.publicUrl) || "";
  }
  /* site-media 전체(폴더 포함) 목록 — 미디어 라이브러리와 v3.1 사용량·고아 이미지가 함께 씁니다. */
  function fetchMediaItems() {
    var items = [];
    function walk(prefix, depth) {
      return sb.storage.from("site-media").list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } })
        .then(function (res) {
          if (res.error) throw new Error(res.error.message || "목록 실패");
          var rows = res.data || [], folders = [];
          rows.forEach(function (f) {
            if (!f || !f.name) return;
            if (f.id) {
              var path = prefix ? prefix + "/" + f.name : f.name;
              items.push({
                path: path, name: f.name,
                size: (f.metadata && f.metadata.size) || 0,
                updated: f.updated_at || f.created_at || "",
                type: (f.metadata && f.metadata.mimetype) || "",
                folder: prefix || "(최상위)", url: publicMediaUrl(path)
              });
            } else { folders.push(f.name); }
          });
          var chain = Promise.resolve();
          folders.forEach(function (name) {
            chain = chain.then(function () {
              return depth < 5 ? walk(prefix ? prefix + "/" + name : name, depth + 1) : null;
            });
          });
          return chain;
        });
    }
    return walk("", 0).then(function () {
      items.sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); });
      return items;
    });
  }

  function loadMedia() {
    var box = $("#media-grid");
    if (!box || !sb) return Promise.resolve();
    box.innerHTML = '<p class="panel-msg">불러오는 중…</p>';
    cmsMsg("media-msg", "Storage site-media 를 읽는 중…");
    return fetchMediaItems().then(function (items) {
      CMS.media = items;
      CMS.loaded.media = true;
      fillMediaFolders();
      renderMedia();
      cmsMsg("media-msg", "");
      var stamp = $("#media-stamp");
      if (stamp) stamp.textContent = "파일 " + items.length + "개 · " +
        new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
    }).catch(function (e) {
      box.innerHTML = '<p class="panel-msg error">불러오지 못했습니다: ' + esc(e && e.message || "") + "</p>";
      cmsMsg("media-msg", "불러오지 못했습니다: " + (e && e.message || ""), "err");
    });
  }

  function fillMediaFolders() {
    var sel = $("#media-folder");
    if (!sel) return;
    var cur = sel.value, folders = {};
    CMS.media.forEach(function (m) { folders[m.folder] = 1; });
    var list = Object.keys(folders).sort();
    sel.innerHTML = '<option value="">폴더 전체</option>' + list.map(function (f) {
      return '<option value="' + esc(f) + '">' + esc(f) + "</option>";
    }).join("");
    if (cur && list.indexOf(cur) >= 0) sel.value = cur;
  }

  function renderMedia() {
    var box = $("#media-grid");
    if (!box) return;
    var q = ($("#media-q").value || "").trim().toLowerCase();
    var folder = $("#media-folder").value;
    var rows = CMS.media.filter(function (m) {
      if (folder && m.folder !== folder) return false;
      if (!q) return true;
      return (m.path + " " + m.type).toLowerCase().indexOf(q) >= 0;
    });
    var tag = $("#media-count");
    if (tag) tag.textContent = rows.length === CMS.media.length
      ? "전체 " + CMS.media.length + "개" : rows.length + " / " + CMS.media.length + "개";
    if (!rows.length) {
      box.innerHTML = '<p class="panel-msg">' + (CMS.media.length ? "조건에 맞는 파일이 없습니다." : "아직 올린 파일이 없습니다. ‘이미지 올리기’로 시작해 보세요.") + "</p>";
      return;
    }
    box.innerHTML = rows.map(function (m) {
      return '<figure class="media-card">' +
        '<a class="media-thumb" href="' + esc(m.url) + '" target="_blank" rel="noopener"><img src="' + esc(m.url) + '" alt="" loading="lazy"></a>' +
        "<figcaption><b title=\"" + esc(m.path) + "\">" + esc(m.name) + "</b>" +
        '<span class="media-meta">' + esc(m.folder) + " · " + esc(fmtBytes(m.size)) + " · " + esc(String(m.updated).slice(0, 10)) + "</span>" +
        '<span class="media-btns">' +
          '<button type="button" class="rowlink media-copy" data-url="' + esc(m.url) + '">URL 복사</button>' +
          '<button type="button" class="rowlink media-del" data-path="' + esc(m.path) + '">삭제</button>' +
        "</span></figcaption></figure>";
    }).join("");
    [].forEach.call(box.querySelectorAll(".media-copy"), function (b) {
      b.addEventListener("click", function () { copyMediaUrl(b.getAttribute("data-url"), b); });
    });
    [].forEach.call(box.querySelectorAll(".media-del"), function (b) {
      b.addEventListener("click", function () { deleteMedia(b.getAttribute("data-path")); });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta); res();
      } catch (e) { rej(e); }
    });
  }
  function copyMediaUrl(url, btn) {
    copyText(url).then(function () {
      cmsMsg("media-msg", "주소를 복사했습니다 — " + url, "ok");
      if (btn) {
        var t = btn.textContent;
        btn.textContent = "복사됨";
        setTimeout(function () { btn.textContent = t; }, 1600);
      }
    }).catch(function () {
      cmsMsg("media-msg", "복사하지 못했습니다. 이미지를 새 탭으로 열어 주소를 복사해 주세요: " + url, "err");
    });
  }
  function deleteMedia(path) {
    if (!path) return;
    if (!window.confirm("‘" + path + "’ 파일을 삭제할까요?\n이 파일을 쓰는 글·페이지의 이미지가 비어 보이게 됩니다. 되돌릴 수 없습니다.")) return;
    cmsMsg("media-msg", "삭제하는 중…");
    sb.storage.from("site-media").remove([path]).then(function (r) {
      if (r.error) { cmsMsg("media-msg", "삭제하지 못했습니다: " + (r.error.message || ""), "err"); return; }
      CMS.media = CMS.media.filter(function (m) { return m.path !== path; });
      fillMediaFolders();
      renderMedia();
      cmsMsg("media-msg", "파일을 삭제했습니다: " + path, "ok");
    }).catch(function (e) {
      cmsMsg("media-msg", "삭제하지 못했습니다: " + (e && e.message || ""), "err");
    });
  }

  /* ---------------- 1. 페이지 텍스트·이미지 ---------------- */
  function loadPages() {
    var box = $("#pages-list");
    if (!box) return Promise.resolve();
    box.innerHTML = '<p class="panel-msg">불러오는 중…</p>';
    return sb.from("site_contents").select("key,section,label,value,image_url").order("section").order("key")
      .then(function (res) {
        if (res.error) {
          box.innerHTML = '<p class="panel-msg error">불러오지 못했습니다: ' + esc(res.error.message) + "</p>";
          return;
        }
        CMS.pages = (res.data || []).map(function (r) { return { key: r.key, section: r.section || "기타", label: r.label || r.key, value: r.value || "", image_url: r.image_url || "", _v: r.value || "", _i: r.image_url || "" }; })
          .filter(function (p) { return p.section !== BRAND_SECTION && p.section !== GRADE_SECTION && p.section !== I18N_SECTION; });   // 헤더·푸터·head·회원 등급·영문 저장분은 전용 화면에서 다룹니다
        CMS.loaded.pages = true;
        renderPages();
        var note = $("#pages-note");
        if (note) note.innerHTML = "Supabase <code>site_contents</code> · " + CMS.pages.length + "개 항목 · 공개 읽기 / 관리자만 수정";
        var stamp = $("#pages-stamp");
        if (stamp) stamp.textContent = "불러옴 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
      });
  }

  var EXTRA_IMAGE_KEYS = { seo_og_image: 1, seo_favicon_url: 1 };
  function isImageSlot(p) { return /image_url$/.test(p.key) || !!EXTRA_IMAGE_KEYS[p.key]; }
  function isFlagKey(key) { return /_enabled$/.test(key); }
  function isDateKey(key) { return /_(start|end)_at$/.test(key); }

  /* 값 종류에 맞는 입력칸: 색상 고르기 · 켜기/끄기 · 날짜·시각 · 긴 글 */
  function pageControl(p, img) {
    var key = p.key, v = p.value == null ? "" : p.value;
    if (key === "theme_accent_color") {
      var hex = /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : "#C86D44";
      return '<div class="cms-color">' +
        '<input type="color" data-color="' + esc(key) + '" value="' + esc(hex) + '" aria-label="포인트 색상 선택">' +
        '<input class="admin-input" data-value="' + esc(key) + '" maxlength="7" value="' + esc(v) + '" placeholder="#C86D44" spellcheck="false">' +
        '</div><p class="cms-hint">사이트의 --accent · --accent-d · --accent-s 에 반영됩니다.</p>';
    }
    if (isFlagKey(key)) {
      var on = /^(1|true|yes|y|on)$/i.test(v.trim());
      return '<select class="admin-select" data-value="' + esc(key) + '">' +
        '<option value="1"' + (on ? " selected" : "") + '>켜기 (표시)</option>' +
        '<option value="0"' + (on ? "" : " selected") + '>끄기 (숨김)</option></select>';
    }
    if (isDateKey(key)) {
      var dt = String(v || "").replace(" ", "T").slice(0, 16);
      return '<input class="admin-input" type="datetime-local" data-value="' + esc(key) + '" value="' + esc(dt) + '">' +
        '<p class="cms-hint">한국 시간(Asia/Seoul) 기준 · 비우면 기간 제한 없음</p>';
    }
    if (img && v === "") return '<p class="cms-hint">이미지만 있는 항목입니다. 아래에서 이미지를 올려 주세요.</p>';
    return '<textarea class="cms-input" data-value="' + esc(key) + '" rows="' +
      (v.indexOf("\n") >= 0 || v.length > 70 ? 3 : 1) + '" spellcheck="false">' + esc(v) + "</textarea>";
  }

  function renderPages() {
    var box = $("#pages-list");
    if (!box) return;
    var groups = {}, order = [];
    var secOrder = { "SEO · 공유 · 테마": 0, "홈 상단": 1, "공지 배너": 2, "팝업": 3, "섹션 소개": 4, "이미지": 5, "푸터": 6 };
    CMS.pages.forEach(function (p) {
      if (!groups[p.section]) { groups[p.section] = []; order.push(p.section); }
      groups[p.section].push(p);
    });
    // 그룹 안에서는 화면에서 다루기 쉬운 순서로 놓습니다.
    var keyOrder = {
      seo_title: 0, seo_description: 1, seo_og_image: 2, seo_favicon_url: 3, theme_accent_color: 4,
      "notice.text": 0, "notice.link_label": 1, "notice.link_url": 2,
      banner_enabled: 3, banner_start_at: 4, banner_end_at: 5,
      popup_enabled: 0, popup_title: 1, popup_body: 2, popup_image_url: 3, popup_link: 4, popup_link_label: 5,
      popup_start_at: 6, popup_end_at: 7
    };
    order.forEach(function (sec) {
      groups[sec].sort(function (a, b) {
        var ao = keyOrder[a.key] != null ? keyOrder[a.key] : 99, bo = keyOrder[b.key] != null ? keyOrder[b.key] : 99;
        return ao - bo;
      });
    });
    order.sort(function (a, b) {
      var ao = secOrder[a] != null ? secOrder[a] : 9, bo = secOrder[b] != null ? secOrder[b] : 9;
      return ao - bo || a.localeCompare(b, "ko");
    });
    box.innerHTML = order.map(function (sec) {
      return '<section class="cms-group"><h2>' + esc(sec) + "</h2>" +
        groups[sec].map(function (p) {
          var img = isImageSlot(p);
          return '<div class="cms-row" data-key="' + esc(p.key) + '">' +
            '<div class="cms-row-head"><b>' + esc(p.label) + '</b><code>' + esc(p.key) + '</code>' +
            '<span class="cms-dirty" data-dirty="' + esc(p.key) + '" hidden>수정됨</span></div>' +
            (pageControl(p, img)) +
            (img
              ? '<div class="cms-img-row">' +
                '<div class="cms-img-preview" data-prev="' + esc(p.key) + '">' + (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="">' : "<span>이미지 없음</span>") + "</div>" +
                '<div class="cms-img-tools">' +
                '<input type="file" accept="image/*" class="sr-only cms-file" id="f-' + esc(p.key) + '" data-file="' + esc(p.key) + '">' +
                '<label for="f-' + esc(p.key) + '" class="btn btn-ghost btn-sm">이미지 올리기</label>' +
                '<input class="admin-input cms-url" data-url="' + esc(p.key) + '" placeholder="또는 이미지 주소(URL)" value="' + esc(p.image_url) + '">' +
                '</div></div>' +
                '<p class="cms-hint" data-imgmsg="' + esc(p.key) + '"></p>'
              : "") +
            "</div>";
        }).join("") + "</section>";
    }).join("");

    [].forEach.call(box.querySelectorAll("[data-value]"), function (ta) {
      function sync() {
        var p = pageByKey(ta.getAttribute("data-value"));
        if (!p) return;
        p._v = ta.value;
        markDirty(p.key, p._v !== p.value || p._i !== p.image_url);
      }
      ta.addEventListener("input", sync);
      ta.addEventListener("change", sync);
    });
    [].forEach.call(box.querySelectorAll("[data-color]"), function (col) {
      col.addEventListener("input", function () {
        var key = col.getAttribute("data-color");
        var text = box.querySelector('[data-value="' + key + '"]');
        if (text) text.value = col.value.toUpperCase();
        var p = pageByKey(key);
        if (!p) return;
        p._v = col.value.toUpperCase();
        markDirty(key, p._v !== p.value || p._i !== p.image_url);
      });
    });
    [].forEach.call(box.querySelectorAll("[data-url]"), function (inp) {
      inp.addEventListener("input", function () {
        var p = pageByKey(inp.getAttribute("data-url"));
        if (!p) return;
        p._i = inp.value.trim();
        paintPrev(p.key, p._i);
        markDirty(p.key, p._v !== p.value || p._i !== p.image_url);
      });
    });
    [].forEach.call(box.querySelectorAll("[data-file]"), function (f) {
      f.addEventListener("change", function () {
        var key = f.getAttribute("data-file");
        var p = pageByKey(key);
        var file = f.files && f.files[0];
        if (!p || !file) return;
        var msg = box.querySelector('[data-imgmsg="' + key + '"]');
        if (msg) msg.textContent = "올리는 중…";
        uploadSiteImage(file, "pages/" + key.replace(/[^a-z0-9._-]/gi, "-"), msg,
          "업로드 완료 — ‘변경 저장’을 누르면 사이트에 반영됩니다.").then(function (url) {
          p._i = url;
          var urlInput = box.querySelector('[data-url="' + key + '"]');
          if (urlInput) urlInput.value = url;
          paintPrev(key, url);
          markDirty(key, true);
        }).catch(function (e) {
          if (msg) msg.textContent = "업로드 실패: " + (e.message || "알 수 없는 오류");
        });
      });
    });
  }

  function pageByKey(key) {
    for (var i = 0; i < CMS.pages.length; i++) if (CMS.pages[i].key === key) return CMS.pages[i];
    return null;
  }
  function paintPrev(key, url) {
    var box = document.querySelector('[data-prev="' + key + '"]');
    if (!box) return;
    box.innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : "<span>이미지 없음</span>";
  }
  function markDirty(key, on) {
    var t = document.querySelector('[data-dirty="' + key + '"]');
    if (t) t.hidden = !on;
  }

  function savePages() {
    var changed = CMS.pages.filter(function (p) { return p._v !== p.value || p._i !== p.image_url; });
    if (!changed.length) { cmsMsg("pages-msg", "바뀐 내용이 없습니다."); return; }
    cmsMsg("pages-msg", "저장하는 중…");
    Promise.all(changed.map(function (p) {
      return sb.from("site_contents").update({ value: p._v, image_url: p._i || null }).eq("key", p.key).then(function (r) {
        if (r.error) throw new Error(p.key + ": " + r.error.message);
        return true;
      });
    })).then(function () {
      changed.forEach(function (p) { p.value = p._v; p.image_url = p._i; });
      renderPages();
      cmsMsg("pages-msg", changed.length + "개 항목을 저장했습니다. 사이트에 바로 반영됩니다.", "ok");
    }).catch(function (e) { cmsMsg("pages-msg", "저장 실패: " + (e.message || "권한을 확인해 주세요."), "err"); });
  }

  /* ---------------- 2. 게시판 관리 ---------------- */
  function loadPosts() {
    var body = $("#posts-table tbody");
    if (body) body.innerHTML = '<tr class="empty-row"><td colspan="9">불러오는 중…</td></tr>';
    return Promise.all([
      sb.from("posts").select("*").order("category").order("sort_order").limit(1000),
      sb.from("comments").select("post_key").limit(5000)
    ]).then(function (res) {
      var list = res[0], cmts = res[1];
      if (list.error) {
        if (body) body.innerHTML = '<tr class="empty-row"><td colspan="9">불러오지 못했습니다: ' + esc(list.error.message) + "</td></tr>";
        return;
      }
      CMS.posts = list.data || [];
      CMS.postEnCols = CMS.posts.length
        ? Object.prototype.hasOwnProperty.call(CMS.posts[0], "title_en") : CMS.postEnCols;
      CMS.commentCounts = {};
      (cmts.data || []).forEach(function (c) { CMS.commentCounts[c.post_key] = (CMS.commentCounts[c.post_key] || 0) + 1; });
      CMS.loaded.posts = true;
      renderPosts();
      if (CMS.boardRows.length) renderBoardTable();
      fillCommentPostFilter();
      paintCommentBadge();
      var stamp = $("#posts-stamp");
      if (stamp) stamp.textContent = "전체 " + CMS.posts.length + "건";
    });
  }

  function postNoMap() {
    var order = { "소개": 0, "뉴스": 1, "인터뷰": 2, "정보": 3 };
    var sorted = CMS.posts.slice().sort(function (a, b) {
      var ao = order[a.category] != null ? order[a.category] : 9, bo = order[b.category] != null ? order[b.category] : 9;
      if (ao !== bo) return ao - bo;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    var counts = {}, map = {};
    sorted.forEach(function (p) {
      counts[p.category] = (counts[p.category] || 0) + 1;
      map[p.slug || p.id] = counts[p.category];
    });
    return map;
  }

  function renderPosts() {
    var body = $("#posts-table tbody");
    if (!body) return;
    var q = ($("#posts-q").value || "").trim().toLowerCase();
    var cat = $("#posts-cat").value, st = $("#posts-state").value;
    var noMap = postNoMap();
    var rows = CMS.posts.slice().sort(function (a, b) {
      var order = { "소개": 0, "뉴스": 1, "인터뷰": 2, "정보": 3 };
      var ao = order[a.category] != null ? order[a.category] : 9, bo = order[b.category] != null ? order[b.category] : 9;
      if (ao !== bo) return ao - bo;
      return (a.sort_order || 0) - (b.sort_order || 0);
    }).filter(function (p) {
      if (trashPosts ? !p.deleted_at : !!p.deleted_at) return false;
      if (cat && p.category !== cat) return false;
      if (st === "pub" && (!p.is_published || p.status === "draft")) return false;
      if (st === "draft" && p.status !== "draft") return false;
      if (st === "hidden" && (p.is_published || p.status === "draft")) return false;
      if (!q) return true;
      return [p.title, p.source_name, p.region, p.slug, p.summary].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var tag = $("#posts-count");
    if (tag) tag.textContent = (trashPosts ? "휴지통 " : "") +
      (rows.length === CMS.posts.length ? "전체 " + CMS.posts.length + "건" : rows.length + " / " + CMS.posts.length + "건");
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="9">' +
        (trashPosts ? "휴지통이 비어 있습니다." : (CMS.posts.length ? "조건에 맞는 글이 없습니다." : "아직 글이 없습니다. ‘새 글 쓰기’로 시작해 보세요.")) + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (p) {
      var n = CMS.commentCounts[p.slug] || 0;
      var no = noMap[p.slug || p.id];
      var sched = isFuture(p.publish_at);
      var draft = p.status === "draft";
      var stateBadge = draft
        ? '<span class="badge b-wait">임시저장</span>'
        : '<span class="badge ' + (p.is_published ? "b-ok" : "b-off") + '">' + (p.is_published ? "발행" : "숨김") + "</span>";
      var flags = (p.is_pinned ? '<span class="pin-flag" title="상단 고정">📌</span>' : "") +
        (sched ? '<span class="badge b-wait" title="' + esc(String(p.publish_at).replace("T", " ").slice(0, 16)) + ' 공개">예약됨</span>' : "") +
        (p.body_format && p.body_format !== "text" ? '<span class="fmt-tag" title="본문 형식">' + esc(p.body_format === "html" ? "HTML" : "MD") + "</span>" : "");
      return "<tr>" +
        '<td class="num" data-th="No."><span class="post-no">No. ' + (no || "–") + "</span></td>" +
        '<td data-th="상태">' + stateBadge + flags + "</td>" +
        '<td data-th="분류">' + esc(boardNameFor(p.category)) + "</td>" +
        '<td class="ellip" data-th="제목" title="' + esc(p.title) + '">' + esc(p.title) + (p.image_url ? ' <span class="cms-img-dot" title="이미지 있음">IMG</span>' : "") + "</td>" +
        '<td class="muted" data-th="출처·지역">' + esc([p.source_name, p.region].filter(Boolean).join(" · ") || "–") + "</td>" +
        '<td class="muted" data-th="발행일">' + esc(p.published_at || "–") + "</td>" +
        '<td class="muted" data-th="마감">' + esc(p.deadline || "–") + "</td>" +
        '<td class="num" data-th="댓글">' + (n ? "<b>" + n + "</b>" : "0") + "</td>" +
        '<td class="row-actions">' + (p.deleted_at
          ? '<button type="button" class="rowlink row-restore" data-id="' + esc(p.id) + '">복구</button>' +
            '<button type="button" class="rowlink danger row-purge" data-id="' + esc(p.id) + '">영구 삭제</button>'
          : '<button type="button" class="rowlink cms-edit" data-id="' + esc(p.id) + '">수정</button>') +
        "</td></tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".cms-edit"), function (b) {
      b.addEventListener("click", function () { openPostEditor(b.getAttribute("data-id")); });
    });
    [].forEach.call(body.querySelectorAll(".row-restore"), function (b) {
      b.addEventListener("click", function () { restorePost(b.getAttribute("data-id")); });
    });
    [].forEach.call(body.querySelectorAll(".row-purge"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id");
        var p = CMS.posts.filter(function (x) { return x.id === id; })[0];
        purgePost(id, p ? p.title : "이 글");
      });
    });
  }

  function nextSortOrder(cat) {
    var max = 0;
    CMS.posts.forEach(function (p) { if (p.category === cat && (p.sort_order || 0) > max) max = p.sort_order || 0; });
    return max + 1;
  }

  function catPrefix(cat) {
    var known = ({ "소개": "intro", "뉴스": "news", "인터뷰": "interview", "정보": "info" })[cat];
    if (known) return known;
    return String(cat || "post").replace(/[^A-Za-z0-9._-]/g, "").toLowerCase() || "post";
  }

  function toLocalInput(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" +
      p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function toIso(local) {
    if (!local) return null;
    var d = new Date(local);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  function isFuture(iso) {
    if (!iso) return false;
    var d = new Date(iso);
    return !isNaN(d.getTime()) && d.getTime() > Date.now();
  }

  /* 글 편집기의 한국어/English 탭 — 영문 칸을 비우면 사이트 EN 모드에서도 한국어가 나갑니다. */
  function postEnRow(p) {
    var m = (p && p.meta && p.meta.en) || {};
    return {
      title: (p && p.title_en) || m.title || "",
      summary: (p && p.summary_en) || m.summary || "",
      body: (p && p.body_en) || m.body || "",
      format: (p && p.body_format_en) || m.body_format || ""
    };
  }
  function postLangPane(which) {
    var en = which === "en";
    ["#pf-title", "#pf-slug", "#pf-summary"].forEach(function (sel) {
      var n = $(sel), f = n && n.closest ? n.closest(".cms-field") : null;
      if (f) f.hidden = en;
    });
    var bodyField = $("#pf-body") && $("#pf-body").closest ? $("#pf-body").closest(".cms-field") : null;
    if (bodyField) bodyField.hidden = en;
    var pane = $("#pf-en");
    if (pane) pane.hidden = !en;
    [].forEach.call(document.querySelectorAll("#pf-langtabs [data-plang]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-plang") === (en ? "en" : "ko") ? "true" : "false");
    });
  }

  function openPostEditor(id) {
    var p = null;
    if (id) { for (var i = 0; i < CMS.posts.length; i++) if (CMS.posts[i].id === id) { p = CMS.posts[i]; break; } }
    CMS.editing = p;
    var m = p && p.meta ? p.meta : {};
    var en = postEnRow(p);
    $("#post-modal-title").textContent = p ? "글 수정" : "새 글";
    postLangPane("ko");
    $("#pf-title_en").value = en.title;
    $("#pf-summary_en").value = en.summary;
    $("#pf-body_en").value = en.body;
    if ($("#pf-body_format_en")) $("#pf-body_format_en").value = en.format;
    setCategoryValue(p ? p.category : "뉴스");
    $("#pf-state").value = p ? (p.status === "draft" ? "draft" : String(!!p.is_published)) : "true";
    $("#pf-title").value = p ? p.title : "";
    $("#pf-slug").value = p ? (p.slug || "") : "";
    $("#pf-summary").value = p ? (p.summary || "") : "";
    $("#pf-body").value = p ? (p.body || "") : "";
    if ($("#pf-body_format")) $("#pf-body_format").value = (window.CRAFT_BODY ? window.CRAFT_BODY.normalize(p && p.body_format) : "text");
    if (postEditor) postEditor.reset();
    $("#pf-region").value = p ? (p.region || "") : "";
    $("#pf-source_name").value = p ? (p.source_name || "") : "";
    $("#pf-source_url").value = p ? (p.source_url || "") : "";
    $("#pf-published_at").value = p && p.published_at ? String(p.published_at).slice(0, 10) : todayKST();
    $("#pf-deadline").value = p && p.deadline ? String(p.deadline).slice(0, 10) : "";
    $("#pf-sort_order").value = p ? (p.sort_order || 0) : nextSortOrder(p ? p.category : "뉴스");
    $("#pf-tag").value = m.tag || "";
    $("#pf-person").value = m.person || "";
    $("#pf-role").value = m.role || "";
    $("#pf-kind").value = m.kind || "";
    $("#pf-period").value = m.period || "";
    $("#pf-image_url").value = p ? (p.image_url || "") : "";
    if (pfAttach) pfAttach.set((p && Array.isArray(p.attachments) && p.attachments[0]) || null);
    if (p && p.id && !(Array.isArray(p.attachments) && p.attachments.length)) {
      /* 목록 select 에 attachments 가 없을 수 있어 한 번만 따로 읽습니다(없으면 조용히). */
      sb.from("posts").select("attachments").eq("id", p.id).then(function (r) {
        var row = r && !r.error && Array.isArray(r.data) ? r.data[0] : null;
        if (row && Array.isArray(row.attachments) && row.attachments[0] && pfAttach) pfAttach.set(row.attachments[0]);
      }).catch(function () { /* noop */ });
    }
    $("#pf-is_pinned").checked = !!(p && p.is_pinned);
    $("#pf-publish_at").value = p && p.publish_at ? toLocalInput(p.publish_at) : "";
    paintPublishHint();
    paintPostPreview(p ? p.image_url : "");
    $("#pf-img-msg").textContent = "";
    $("#pf-msg").textContent = "";
    $("#post-delete").hidden = !p;
    $("#post-history").hidden = !p;
    syncPostFields();
    $("#post-modal").hidden = false;
    document.body.classList.add("cms-lock");
    var key = draftKey("post", p ? (p.id || p.slug) : "new");
    showDraftBanner("post", key);
    var an = $("#pf-autosave");
    if (an) an.textContent = "";
    startAutosave("post", key);
    setTimeout(function () { $("#pf-title").focus(); }, 50);
  }

  function closePostEditor() {
    stopAutosave();
    $("#pf-draft").hidden = true;
    $("#post-modal").hidden = true;
    document.body.classList.remove("cms-lock");
    CMS.editing = null;
  }

  function syncPostFields() {
    var cat = $("#pf-category").value;
    $("#pf-extra-tag").hidden = !(cat === "뉴스" || cat === "소개");
    $("#pf-extra-iv").hidden = cat !== "인터뷰";
    $("#pf-extra-info").hidden = cat !== "정보";
  }

  function paintPostPreview(url) {
    var box = $("#pf-img-preview");
    if (!box) return;
    box.innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : "<span>이미지 없음</span>";
  }

  function paintPublishHint() {
    var el = $("#pf-publish-hint");
    var inp = $("#pf-publish_at");
    if (!el || !inp) return;
    var v = inp.value;
    if (!v) { el.textContent = "비워 두면 저장 즉시 공개됩니다(상태가 ‘발행’일 때)."; return; }
    var iso = toIso(v);
    el.textContent = isFuture(iso)
      ? "예약됨 — 이 시각 전까지 공개 사이트에는 보이지 않습니다. : " + v.replace("T", " ")
      : "이미 지난 시각이라 저장 즉시 공개됩니다. : " + v.replace("T", " ");
  }

  var pfAttach = null;

  function savePost(e) {
    if (e) e.preventDefault();
    var title = ($("#pf-title").value || "").trim();
    var cat = $("#pf-category").value;
    if (!title) { $("#pf-msg").textContent = "제목을 입력해 주세요."; $("#pf-title").focus(); return; }
    var prev = CMS.editing;
    var slug = ($("#pf-slug").value || "").trim() || (prev && prev.slug) || (catPrefix(cat) + "-" + Date.now().toString(36));
    var stateVal = $("#pf-state").value;
    var body = {
      slug: slug,
      category: cat,
      title: title,
      summary: ($("#pf-summary").value || "").trim() || null,
      body: ($("#pf-body").value || "").trim() || null,
      body_format: window.CRAFT_BODY ? window.CRAFT_BODY.normalize($("#pf-body_format") && $("#pf-body_format").value) : "text",
      status: stateVal === "draft" ? "draft" : "published",
      region: ($("#pf-region").value || "").trim() || null,
      source_name: ($("#pf-source_name").value || "").trim() || null,
      source_url: ($("#pf-source_url").value || "").trim() || null,
      image_url: ($("#pf-image_url").value || "").trim() || null,
      deadline: $("#pf-deadline").value || null,
      published_at: $("#pf-published_at").value || null,
      is_published: stateVal === "true",
      is_pinned: !!($("#pf-is_pinned") && $("#pf-is_pinned").checked),
      publish_at: toIso($("#pf-publish_at").value),
      sort_order: parseInt($("#pf-sort_order").value || "0", 10) || 0,
      meta: {},
      attachments: (function () {
        var v = ($("#pf-attach").value || "").trim();
        var att = (window.SBP_DRIVE && window.SBP_DRIVE.parse) ? window.SBP_DRIVE.parse(v) : null;
        return att && att.fileId ? [att] : [];
      })()
    };
    if (cat === "뉴스" || cat === "소개") body.meta.tag = ($("#pf-tag").value || "").trim();
    if (cat === "인터뷰") { body.meta.person = ($("#pf-person").value || "").trim(); body.meta.role = ($("#pf-role").value || "").trim(); }
    if (cat === "정보") { body.meta.kind = ($("#pf-kind").value || "").trim(); body.meta.period = ($("#pf-period").value || "").trim(); }

    /* 영문(KO/EN) — 열이 있으면 title_en…, 아직 없으면 meta.en 에 담습니다(사이트가 둘 다 읽습니다). */
    var en = {
      title: ($("#pf-title_en").value || "").trim(),
      summary: ($("#pf-summary_en").value || "").trim(),
      body: ($("#pf-body_en").value || "").trim(),
      body_format: ($("#pf-body_format_en") && $("#pf-body_format_en").value) || ""
    };
    if (CMS.postEnCols) {
      body.title_en = en.title || null;
      body.summary_en = en.summary || null;
      body.body_en = en.body || null;
      body.body_format_en = en.body_format || null;
    } else if (en.title || en.summary || en.body || en.body_format) {
      body.meta.en = { title: en.title, summary: en.summary, body: en.body, body_format: en.body_format };
    }

    var btn = $("#post-save");
    btn.disabled = true;
    $("#pf-msg").textContent = "저장하는 중…";
    function doSave(b) {
      return prev ? sb.from("posts").update(b).eq("id", prev.id) : sb.from("posts").insert(b);
    }
    /* 17_v50 을 아직 실행하지 않은 DB — attachments 열이 없다는 오류면 그 열만 빼고 다시 저장합니다. */
    doSave(body).then(function (r) {
      if (r && r.error && /attachments/i.test(r.error.message || "")) {
        var b2 = {};
        Object.keys(body).forEach(function (k) { if (k !== "attachments") b2[k] = body[k]; });
        return doSave(b2);
      }
      return r;
    }).then(function (r) {
      btn.disabled = false;
      if (r.error) {
        $("#pf-msg").textContent = "저장 실패: " + r.error.message;
        return;
      }
      draftDel(draftKey("post", prev ? (prev.id || prev.slug) : "new"));
      closePostEditor();
      CMS.loaded.posts = false;
      loadPosts().then(function () { cmsMsg("posts-msg", "글을 저장했습니다.", "ok"); });
      var msg = $("#posts-stamp");
      if (msg) msg.textContent = "저장됨 · 사이트에 반영";
    }).catch(function (err) {
      btn.disabled = false;
      $("#pf-msg").textContent = "저장 실패: " + (err.message || "알 수 없는 오류");
    });
  }

  function deletePost() {
    var p = CMS.editing;
    if (!p) return;
    if (!window.confirm("‘" + p.title + "’ 글을 휴지통으로 옮길까요?\n공개 사이트에서는 바로 사라지고, 게시판 관리의 ‘휴지통 보기’에서 복구할 수 있습니다.")) return;
    $("#pf-msg").textContent = "휴지통으로 옮기는 중…";
    sb.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", p.id).then(function (r) {
      if (r.error) { $("#pf-msg").textContent = "휴지통 이동 실패: " + r.error.message; return; }
      closePostEditor();
      CMS.loaded.posts = false;
      loadPosts().then(function () { cmsMsg("posts-msg", "글을 휴지통으로 옮겼습니다. ‘휴지통 보기’에서 복구할 수 있습니다.", "ok"); });
    });
  }

  /* ---------------- 휴지통 (게시판) ---------------- */
  var trashPosts = false;
  function togglePostsTrash() {
    trashPosts = !trashPosts;
    var btn = $("#posts-trash-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", trashPosts ? "true" : "false");
      btn.textContent = trashPosts ? "← 게시판으로" : "🗑 휴지통 보기";
    }
    renderPosts();
  }
  function restorePost(id) {
    sb.from("posts").update({ deleted_at: null }).eq("id", id).then(function (r) {
      if (r.error) { cmsMsg("posts-msg", "복구 실패: " + r.error.message, "err"); return; }
      loadPosts().then(function () { cmsMsg("posts-msg", "글을 복구했습니다. 공개 사이트에 다시 나타납니다.", "ok"); });
    });
  }
  function purgePost(id, title) {
    if (!window.confirm("‘" + title + "’ 글을 영구 삭제할까요?\n휴지통에서도 사라지며 되돌릴 수 없습니다.")) return;
    sb.from("posts").delete().eq("id", id).then(function (r) {
      if (r.error) { cmsMsg("posts-msg", "영구 삭제 실패: " + r.error.message, "err"); return; }
      loadPosts().then(function () { cmsMsg("posts-msg", "글을 영구 삭제했습니다.", "ok"); });
    });
  }

  /* ---------------- 3. 댓글 관리 ---------------- */
  function loadComments() {
    var body = $("#cmt-table tbody");
    if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오는 중…</td></tr>';
    if (!CMS.loaded.posts) {
      // 댓글이 달린 글의 제목을 보여주려면 글 목록이 먼저 필요합니다.
      sb.from("posts").select("id,slug,category,title,sort_order,is_published").order("sort_order").then(function (r) {
        if (!r.error) { CMS.posts = r.data || []; CMS.loaded.posts = true; }
        loadCommentsRows();
      });
      return Promise.resolve();
    }
    return loadCommentsRows();
  }

  function loadCommentsRows() {
    var body = $("#cmt-table tbody");
    return sb.from("comments").select("id,post_key,user_id,author_name,content,is_hidden,is_guest,created_at")
      .order("created_at", { ascending: false }).limit(500).then(function (res) {
        if (res.error) {
          if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오지 못했습니다: ' + esc(res.error.message) + "</td></tr>";
          return;
        }
        CMS.comments = res.data || [];
        CMS.loaded.comments = true;
        renderComments();
        fillCommentPostFilter();
        paintCommentBadge();
        var stamp = $("#cmt-stamp");
        if (stamp) stamp.textContent = "전체 " + CMS.comments.length + "건";
      });
  }

  function postTitleByKey(key) {
    if (!key) return "–";
    if (key.indexOf("workshop:") === 0) return "공방 · " + key.slice(9);
    for (var i = 0; i < CMS.posts.length; i++) if (CMS.posts[i].slug === key) return CMS.posts[i].title;
    return key;
  }

  function fillCommentPostFilter() {
    var sel = $("#cmt-post");
    if (!sel) return;
    var cur = sel.value;
    var keys = {};
    CMS.comments.forEach(function (c) { keys[c.post_key] = (keys[c.post_key] || 0) + 1; });
    var list = Object.keys(keys).sort();
    sel.innerHTML = '<option value="">글 전체</option>' + list.map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(postTitleByKey(k).slice(0, 40)) + " (" + keys[k] + ")</option>";
    }).join("");
    if (cur && list.indexOf(cur) >= 0) sel.value = cur;
  }

  function renderComments() {
    var body = $("#cmt-table tbody");
    if (!body) return;
    var q = ($("#cmt-q").value || "").trim().toLowerCase();
    var st = $("#cmt-state").value, pk = $("#cmt-post").value;
    var rows = CMS.comments.filter(function (c) {
      if (st === "open" && c.is_hidden) return false;
      if (st === "hidden" && !c.is_hidden) return false;
      if (pk && c.post_key !== pk) return false;
      if (!q) return true;
      return [c.content, c.author_name, postTitleByKey(c.post_key)].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var tag = $("#cmt-count");
    if (tag) tag.textContent = rows.length === CMS.comments.length ? "전체 " + CMS.comments.length + "건" : rows.length + " / " + CMS.comments.length + "건";
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">' + (CMS.comments.length ? "조건에 맞는 댓글이 없습니다." : "아직 댓글이 없습니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (c) {
      return "<tr" + (c.is_hidden ? ' class="is-hidden"' : "") + ">" +
        '<td data-th="상태"><span class="badge ' + (c.is_hidden ? "b-off" : "b-ok") + '">' + (c.is_hidden ? "숨김" : "공개") + "</span></td>" +
        '<td class="ellip" data-th="글" title="' + esc(postTitleByKey(c.post_key)) + '">' + esc(postTitleByKey(c.post_key)) + "</td>" +
        '<td data-th="작성자">' + esc(c.author_name) +
          (c.is_guest ? ' <span class="badge b-wait">비회원</span>' : "") + "</td>" +
        '<td class="cms-cmt-text" data-th="내용">' + esc(c.content) + "</td>" +
        '<td class="muted" data-th="작성 시각">' + esc(fmtWhen(c.created_at)) + "</td>" +
        '<td class="cms-actions"><button type="button" class="rowlink cms-hide" data-id="' + esc(c.id) + '" data-h="' + (c.is_hidden ? "0" : "1") + '">' + (c.is_hidden ? "공개" : "숨김") + "</button>" +
        '<button type="button" class="rowlink cms-del" data-id="' + esc(c.id) + '">삭제</button></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".cms-hide"), function (b) {
      b.addEventListener("click", function () { toggleComment(b.getAttribute("data-id"), b.getAttribute("data-h") === "1"); });
    });
    [].forEach.call(body.querySelectorAll(".cms-del"), function (b) {
      b.addEventListener("click", function () { deleteComment(b.getAttribute("data-id")); });
    });
  }

  function paintCommentBadge() {
    var el = $("#tab-cmt-count");
    if (!el) return;
    el.textContent = CMS.comments.length ? String(CMS.comments.length) : "";
  }

  function toggleComment(id, hide) {
    sb.from("comments").update({ is_hidden: hide }).eq("id", id).then(function (r) {
      if (r.error) { cmsMsg("cmt-msg", "바꾸지 못했습니다: " + r.error.message, "err"); return; }
      for (var i = 0; i < CMS.comments.length; i++) if (CMS.comments[i].id === id) CMS.comments[i].is_hidden = hide;
      renderComments();
      cmsMsg("cmt-msg", hide ? "댓글을 숨겼습니다. 사이트에서 보이지 않습니다." : "댓글을 다시 공개했습니다.", "ok");
    });
  }

  function deleteComment(id) {
    if (!window.confirm("이 댓글을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.")) return;
    sb.from("comments").delete().eq("id", id).then(function (r) {
      if (r.error) { cmsMsg("cmt-msg", "삭제하지 못했습니다: " + r.error.message, "err"); return; }
      CMS.comments = CMS.comments.filter(function (c) { return c.id !== id; });
      renderComments();
      fillCommentPostFilter();
      paintCommentBadge();
      cmsMsg("cmt-msg", "댓글을 삭제했습니다.", "ok");
    });
  }

  /* ============================================================
     5. 직접 만든 페이지 (public.pages) — 제목·부제·본문 + 여러 이미지
     ============================================================ */
  function loadPageManager() {
    if (!sb) return Promise.resolve();
    var body = $("#page-table tbody");
    if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오는 중…</td></tr>';
    return sb.from("pages").select("*").order("sort_order").order("slug").then(function (res) {
      if (res.error) {
        if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오지 못했습니다: ' + esc(res.error.message) + "</td></tr>";
        return;
      }
      CMS.customPages = res.data || [];
      CMS.pageEnCols = CMS.customPages.length
        ? Object.prototype.hasOwnProperty.call(CMS.customPages[0], "title_en") : CMS.pageEnCols;
      renderPageTable();
    });
  }

  function pageBySlugAdmin(slug) {
    for (var i = 0; i < CMS.customPages.length; i++) if (CMS.customPages[i].slug === slug) return CMS.customPages[i];
    return null;
  }
  function pageImgCount(p) { return (p && Array.isArray(p.images)) ? p.images.filter(function (im) { return im && im.url; }).length : 0; }

  function renderPageTable() {
    var body = $("#page-table tbody");
    if (!body) return;
    var rows = CMS.customPages.filter(function (p) { return trashPages ? !!p.deleted_at : !p.deleted_at; });
    var note = $("#page-trash-note");
    if (note) {
      var tCount = CMS.customPages.filter(function (p) { return !!p.deleted_at; }).length;
      note.textContent = trashPages
        ? (rows.length ? "휴지통 " + rows.length + "건 · 복구하거나 영구 삭제할 수 있습니다." : "휴지통이 비어 있습니다.")
        : (tCount ? "휴지통 " + tCount + "건" : "");
    }
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">' + (trashPages
        ? "휴지통이 비어 있습니다."
        : "아직 직접 만든 페이지가 없습니다. ‘+ 새 페이지’로 시작해 보세요.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (p) {
      return "<tr>" +
        '<td class="num" data-th="순서">' + (p.sort_order || 0) + "</td>" +
        '<td data-th="주소"><code>' + esc(p.slug) + "</code>" +
          (p.deleted_at ? "" : ' <a class="rowlink" href="/#/page/' + esc(encodeURIComponent(p.slug)) + '" target="_blank" rel="noopener">보기</a>') + "</td>" +
        '<td class="ellip" data-th="제목" title="' + esc(p.title) + '">' + esc(p.title) + "</td>" +
        '<td class="num" data-th="이미지">' + pageImgCount(p) + "</td>" +
        '<td data-th="상태">' + (p.deleted_at
          ? '<span class="badge b-off">휴지통</span>'
          : '<span class="badge ' + (p.is_published ? "b-ok" : "b-off") + '">' + (p.is_published ? "발행" : "숨김") + "</span>") + "</td>" +
        '<td class="row-actions">' + (p.deleted_at
          ? '<button type="button" class="rowlink page-restore" data-slug="' + esc(p.slug) + '">복구</button>' +
            '<button type="button" class="rowlink danger page-purge" data-slug="' + esc(p.slug) + '">영구 삭제</button>'
          : '<button type="button" class="rowlink page-edit" data-slug="' + esc(p.slug) + '">수정</button>') +
        "</td></tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".page-edit"), function (b) {
      b.addEventListener("click", function () { openPageEditor(b.getAttribute("data-slug")); });
    });
    [].forEach.call(body.querySelectorAll(".page-restore"), function (b) {
      b.addEventListener("click", function () { restorePage(b.getAttribute("data-slug")); });
    });
    [].forEach.call(body.querySelectorAll(".page-purge"), function (b) {
      b.addEventListener("click", function () {
        var slug = b.getAttribute("data-slug");
        var p = pageBySlugAdmin(slug);
        purgePage(slug, p ? p.title : slug);
      });
    });
  }

  /* ---------------- 휴지통 (페이지) ---------------- */
  var trashPages = false;
  function togglePagesTrash() {
    trashPages = !trashPages;
    var btn = $("#page-trash-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", trashPages ? "true" : "false");
      btn.textContent = trashPages ? "← 페이지 목록으로" : "🗑 휴지통 보기";
    }
    renderPageTable();
  }
  function restorePage(slug) {
    sb.from("pages").update({ deleted_at: null }).eq("slug", slug).then(function (r) {
      if (r.error) { cmsMsg("page-msg", "복구 실패: " + r.error.message, "err"); return; }
      loadPageManager().then(function () { cmsMsg("page-msg", "페이지를 복구했습니다: " + slug, "ok"); });
    });
  }
  function purgePage(slug, title) {
    if (!window.confirm("‘" + title + "’ 페이지를 영구 삭제할까요?\n휴지통에서도 사라지며 되돌릴 수 없습니다.")) return;
    sb.from("pages").delete().eq("slug", slug).then(function (r) {
      if (r.error) { cmsMsg("page-msg", "영구 삭제 실패: " + r.error.message, "err"); return; }
      loadPageManager().then(function () { cmsMsg("page-msg", "페이지를 영구 삭제했습니다: " + slug, "ok"); });
    });
  }

  function nextPageSort() {
    var max = 0;
    CMS.customPages.forEach(function (p) { if ((p.sort_order || 0) > max) max = p.sort_order || 0; });
    return max + 1;
  }

  /* 페이지 편집기의 한국어/English 탭 (KO/EN 본문) */
  function pageLangPane(which) {
    var en = which === "en";
    ["#pg-title", "#pg-subtitle"].forEach(function (sel) {
      var n = $(sel), f = n && n.closest ? n.closest(".cms-field") : null;
      if (f) f.hidden = en;
    });
    var bodyField = $("#pg-body") && $("#pg-body").closest ? $("#pg-body").closest(".cms-field") : null;
    if (bodyField) bodyField.hidden = en;
    [].forEach.call(document.querySelectorAll("#pg-langtabs [data-plang]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-plang") === (en ? "en" : "ko") ? "true" : "false");
    });
    var pane = $("#pg-en");
    if (pane) pane.hidden = !en;
  }
  function pageEnAdmin(p) {
    if (!p) return { title: "", subtitle: "", body: "", format: "" };
    var cached = (CMS.pageEnRows || {})[p.slug] || {};
    return {
      title: p.title_en || cached.title || "",
      subtitle: p.subtitle_en || cached.subtitle || "",
      body: p.body_en || cached.body || "",
      format: p.body_format_en || cached.format || ""
    };
  }
  function loadPageEnRow(slug, cb) {
    if (!slug) { cb(null); return; }
    sb.from("site_contents").select("key,value").eq("key", "page_en:" + slug).then(function (r) {
      var raw = (r.data && r.data[0] && r.data[0].value) || "";
      var o = {};
      try { o = JSON.parse(raw || "{}") || {}; } catch (e) { o = {}; }
      CMS.pageEnRows = CMS.pageEnRows || {};
      CMS.pageEnRows[slug] = o;
      cb(o);
    }, function () { cb(null); });
  }
  function savePageEn(slug, en) {
    var json = JSON.stringify({
      title: en.title || "", subtitle: en.subtitle || "", body: en.body || "", format: en.body_format || ""
    });
    return sb.from("site_contents").upsert({
      key: "page_en:" + slug, section: I18N_SECTION, label: "영문 본문 (" + slug + ")", value: json
    }, { onConflict: "key" });
  }

  function openPageEditor(slug) {
    var p = slug ? pageBySlugAdmin(slug) : null;
    CMS.editingPage = p;
    var en = pageEnAdmin(p);
    pageLangPane("ko");
    $("#pg-title_en").value = en.title;
    $("#pg-subtitle_en").value = en.subtitle;
    $("#pg-body_en").value = en.body;
    if ($("#pg-body_format_en")) $("#pg-body_format_en").value = en.format;
    if (p && !CMS.pageEnCols) loadPageEnRow(p.slug, function (row) {
      if (!row || !CMS.editingPage || CMS.editingPage.slug !== p.slug) return;
      $("#pg-title_en").value = row.title || "";
      $("#pg-subtitle_en").value = row.subtitle || "";
      $("#pg-body_en").value = row.body || "";
      if ($("#pg-body_format_en")) $("#pg-body_format_en").value = row.format || "";
    });
    CMS.pageImages = (p && Array.isArray(p.images) ? p.images : []).map(function (im) {
      return { url: (im && im.url) || "", caption: (im && im.caption) || "" };
    }).filter(function (im) { return im.url; });
    $("#page-modal-title").textContent = p ? "페이지 수정" : "새 페이지";
    $("#pg-slug").value = p ? p.slug : "";
    $("#pg-slug").disabled = !!p;
    $("#pg-title").value = p ? p.title : "";
    $("#pg-subtitle").value = p ? (p.subtitle || "") : "";
    $("#pg-body").value = p ? (p.body || "") : "";
    if ($("#pg-body_format")) $("#pg-body_format").value = (window.CRAFT_BODY ? window.CRAFT_BODY.normalize(p && p.body_format) : "text");
    if (pageEditor) pageEditor.reset();
    $("#pg-sort").value = p ? (p.sort_order || 0) : nextPageSort();
    $("#pg-published").checked = p ? !!p.is_published : true;
    $("#pg-url").value = "";
    $("#pg-img-msg").textContent = "";
    $("#pg-msg").textContent = "";
    $("#page-delete").hidden = !p;
    $("#page-history").hidden = !p;
    CMS.pageBlocks = (window.CRAFT_HUNMIN && window.CRAFT_HUNMIN.parseBlocks)
      ? window.CRAFT_HUNMIN.parseBlocks(p ? p.blocks : [])
      : [];
    renderPageImages();
    $("#page-modal").hidden = false;
    document.body.classList.add("cms-lock");
    mountHunmin();
    var pkey = draftKey("page", p ? p.slug : "new");
    showDraftBanner("page", pkey);
    var pan = $("#pg-autosave");
    if (pan) pan.textContent = "";
    startAutosave("page", pkey);
    setTimeout(function () { $("#pg-title").focus(); }, 50);
  }

  /* hunmin 블록 편집기 — 게시판 목록이 필요하므로 먼저 불러오고 그립니다. */
  function mountHunmin() {
    var box = $("#pg-blocks");
    if (!box || !window.CRAFT_HUNMIN) return;
    var draw = function () {
      window.CRAFT_HUNMIN.editor.mount(box, CMS.pageBlocks, {
        boards: CMS.boardRows,
        upload: function (file) { return uploadSiteImage(file, "pages/blocks"); },
        onChange: function (list) { CMS.pageBlocks = list; renderBlockPreview(); },
        preview: $("#pg-blocks-preview"),
        page: { images: CMS.pageImages }
      });
      renderBlockPreview();
    };
    if (!CMS.boardRows.length) {
      sb.from("boards").select("slug,name,sort_order").order("sort_order").then(function (r) {
        if (r.data && r.data.length) CMS.boardRows = r.data;
        draw();
      }, draw);
    } else draw();
  }

  /* 실시간 미리보기 — 편집 중인 블록을 공개 페이지와 같은 모양으로 그립니다. */
  function renderBlockPreview() {
    var box = $("#pg-blocks-preview");
    if (!box) return;
    if (window.CRAFT_HUNMIN && window.CRAFT_HUNMIN.render) {
      var drawn = window.CRAFT_HUNMIN.render(box, {
        images: CMS.pageImages || [],
        blocks: { v: 1, items: CMS.pageBlocks || [] }
      });
      var note = $("#pg-preview-note");
      if (note) note.textContent = drawn ? "" : "표시할 블록이 없습니다(숨김 블록은 미리보기에도 나오지 않습니다).";
    }
  }

  function closePageEditor() {
    stopAutosave();
    $("#pg-draft").hidden = true;
    $("#page-modal").hidden = true;
    document.body.classList.remove("cms-lock");
    CMS.editingPage = null;
    CMS.pageImages = [];
  }

  function renderPageImages() {
    var box = $("#pg-images");
    if (!box) return;
    if (!CMS.pageImages.length) {
      box.innerHTML = '<p class="cms-hint">아직 이미지가 없습니다. 아래에서 올리거나 주소를 넣어 추가하세요.</p>';
      return;
    }
    box.innerHTML = CMS.pageImages.map(function (im, i) {
      return '<div class="img-row" data-i="' + i + '">' +
        '<span class="img-thumb">' + (im.url ? '<img src="' + esc(im.url) + '" alt="">' : "<span>없음</span>") + "</span>" +
        '<input class="admin-input img-cap" data-cap="' + i + '" value="' + esc(im.caption) + '" placeholder="이미지 설명 (선택)" maxlength="160">' +
        '<span class="img-btns">' +
          '<button type="button" class="mini" data-move="-1" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="위로">↑</button>' +
          '<button type="button" class="mini" data-move="1" data-i="' + i + '"' + (i === CMS.pageImages.length - 1 ? " disabled" : "") + ' aria-label="아래로">↓</button>' +
          '<button type="button" class="mini img-del" data-del="' + i + '">삭제</button>' +
        "</span></div>";
    }).join("");
  }

  function syncPageCaptions() {
    [].forEach.call(document.querySelectorAll("#pg-images .img-cap"), function (el) {
      var i = +el.getAttribute("data-cap");
      if (CMS.pageImages[i]) CMS.pageImages[i].caption = (el.value || "").trim();
    });
  }

  function addPageImageUrl(url) {
    if (!url) return;
    CMS.pageImages.push({ url: url, caption: "" });
    renderPageImages();
  }

  function savePage(e) {
    if (e) e.preventDefault();
    var p = CMS.editingPage;
    var slug = (($("#pg-slug").value || "").trim() || (p ? p.slug : "")).toLowerCase();
    var title = ($("#pg-title").value || "").trim();
    if (!p && !/^[a-z0-9][a-z0-9._-]{0,59}$/.test(slug)) {
      $("#pg-msg").textContent = "주소(slug)는 영문 소문자·숫자·하이픈으로 1~60자 입력해 주세요. 예: about";
      $("#pg-slug").focus();
      return;
    }
    if (!title) { $("#pg-msg").textContent = "제목을 입력해 주세요."; $("#pg-title").focus(); return; }
    syncPageCaptions();
    var payload = {
      title: title,
      subtitle: ($("#pg-subtitle").value || "").trim() || null,
      body: ($("#pg-body").value || "").trim() || null,
      body_format: window.CRAFT_BODY ? window.CRAFT_BODY.normalize($("#pg-body_format") && $("#pg-body_format").value) : "text",
      images: CMS.pageImages.filter(function (im) { return im.url; }).map(function (im) {
        return { url: im.url, caption: (im.caption || "").trim() };
      }),
      blocks: (window.CRAFT_HUNMIN && window.CRAFT_HUNMIN.serialize)
        ? window.CRAFT_HUNMIN.serialize(CMS.pageBlocks) : { v: 1, items: [] },
      is_published: $("#pg-published").checked,
      sort_order: parseInt($("#pg-sort").value || "0", 10) || 0
    };

    /* 영문(KO/EN) — pages.title_en… 열이 있으면 그곳에, 아직 없으면 site_contents(page_en:<slug>) 에 담습니다. */
    var en = {
      title: ($("#pg-title_en").value || "").trim(),
      subtitle: ($("#pg-subtitle_en").value || "").trim(),
      body: ($("#pg-body_en").value || "").trim(),
      body_format: ($("#pg-body_format_en") && $("#pg-body_format_en").value) || ""
    };
    if (CMS.pageEnCols) {
      payload.title_en = en.title || null;
      payload.subtitle_en = en.subtitle || null;
      payload.body_en = en.body || null;
      payload.body_format_en = en.body_format || null;
    }
    var btn = $("#page-save");
    btn.disabled = true;
    $("#pg-msg").textContent = "저장하는 중…";
    var req = p
      ? sb.from("pages").update(payload).eq("slug", p.slug)
      : sb.from("pages").insert(Object.assign({ slug: slug }, payload));
    req.then(function (r) {
      btn.disabled = false;
      if (r.error) { $("#pg-msg").textContent = "저장 실패: " + r.error.message; return; }
      if (CMS.pageEnRows) delete CMS.pageEnRows[slug];
      if (!CMS.pageEnCols) {
        savePageEn(slug, en).then(function (r2) {
          if (r2 && r2.error) cmsMsg("page-msg", "영문 본문은 저장하지 못했습니다: " + r2.error.message, "err");
        });
      }
      draftDel(draftKey("page", p ? p.slug : "new"));
      closePageEditor();
      cmsMsg("page-msg", (p ? "페이지를 수정했습니다: " : "페이지를 만들었습니다: ") + slug +
        " · 사이트 #/page/" + slug + " 에 반영됩니다.", "ok");
      loadPageManager();
    }).catch(function (err) {
      btn.disabled = false;
      $("#pg-msg").textContent = "저장 실패: " + (err.message || "알 수 없는 오류");
    });
  }

  function deletePage() {
    var p = CMS.editingPage;
    if (!p) return;
    if (!window.confirm("‘" + p.title + "’ 페이지를 휴지통으로 옮길까요?\n공개 사이트에서는 바로 사라지고, ‘휴지통 보기’에서 복구할 수 있습니다.")) return;
    $("#pg-msg").textContent = "휴지통으로 옮기는 중…";
    sb.from("pages").update({ deleted_at: new Date().toISOString() }).eq("slug", p.slug).then(function (r) {
      if (r.error) { $("#pg-msg").textContent = "휴지통 이동 실패: " + r.error.message; return; }
      closePageEditor();
      cmsMsg("page-msg", "페이지를 휴지통으로 옮겼습니다. ‘휴지통 보기’에서 복구할 수 있습니다: " + p.slug, "ok");
      loadPageManager();
    });
  }

  /* ============================================================
     6. 게시판 설정 (public.boards)
     ============================================================ */
  var DEFAULT_BOARD_SLUGS = { intro: 1, news: 1, interview: 1, info: 1 };

  function loadBoards() {
    if (!sb) return Promise.resolve();
    return sb.from("boards").select("*").order("sort_order").order("slug").then(function (res) {
      if (res.error) { cmsMsg("board-msg", "게시판을 불러오지 못했습니다: " + res.error.message, "err"); return; }
      CMS.boardRows = res.data || [];
      CMS.loaded.boards = true;
      renderBoardTable();
      fillPostCategorySelect();
      loadDefaultPolicy();
    });
  }

  function loadDefaultPolicy() {
    if (!sb) return Promise.resolve();
    return sb.from("site_contents").select("value").eq("key", "comments.default_policy").then(function (r) {
      var v = (r && r.data && r.data[0]) ? String(r.data[0].value || "").trim() : "";
      var sel = $("#board-default-policy");
      if (sel && /^(all|member|off)$/.test(v)) sel.value = v;
    });
  }

  function saveDefaultPolicy() {
    var sel = $("#board-default-policy");
    if (!sel) return;
    var v = sel.value;
    cmsMsg("board-msg", "저장하는 중…");
    sb.from("site_contents").upsert({
      key: "comments.default_policy",
      section: "게시판 · 댓글",
      label: "기본 댓글 정책 (all = 누구나·비회원 캡차 / member = 로그인 회원만 / off = 비활성화)",
      value: v,
      image_url: null
    }, { onConflict: "key" }).then(function (r) {
      if (r.error) { cmsMsg("board-msg", "저장하지 못했습니다: " + r.error.message, "err"); return; }
      cmsMsg("board-msg", "기본 댓글 정책을 ‘" + policyLabel(v) + "’ 로 저장했습니다.", "ok");
    });
  }

  function policyLabel(v) {
    return ({ all: "누구나 (비회원은 캡차)", member: "로그인 회원만", off: "댓글 비활성화" })[v] || v;
  }

  function boardPostCount(b) {
    var key = boardKeyOf(b);
    return CMS.posts.filter(function (p) { return p.category === key; }).length;
  }

  function renderBoardTable() {
    var body = $("#board-table tbody");
    if (!body) return;
    if (!CMS.boardRows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">게시판 정보를 불러오지 못했습니다.</td></tr>';
      return;
    }
    body.innerHTML = CMS.boardRows.map(function (b) {
      return "<tr>" +
        '<td class="num" data-th="순서">' + (b.sort_order || 0) + "</td>" +
        '<td data-th="slug"><code>' + esc(b.slug) + "</code></td>" +
        '<td data-th="이름">' + esc(b.name) + '<span class="muted"> · ' + esc(b.description || "") + "</span></td>" +
        '<td class="num" data-th="페이지당">' + (b.per_page || 0) + "</td>" +
        '<td data-th="댓글 정책"><span class="badge ' + (b.comment_policy === "off" ? "b-off" : "b-ok") + '">' + esc(policyLabel(b.comment_policy)) + "</span></td>" +
        '<td class="num" data-th="글">' + boardPostCount(b) + "</td>" +
        '<td data-th="상태"><span class="badge ' + (b.is_active ? "b-ok" : "b-off") + '">' + (b.is_active ? "사용" : "숨김") + "</span></td>" +
        '<td><button type="button" class="rowlink board-edit" data-slug="' + esc(b.slug) + '">수정</button></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".board-edit"), function (btn) {
      btn.addEventListener("click", function () { openBoardEditor(btn.getAttribute("data-slug")); });
    });
  }

  function nextBoardSort() {
    var max = 0;
    CMS.boardRows.forEach(function (b) { if ((b.sort_order || 0) > max) max = b.sort_order || 0; });
    return max + 1;
  }

  function openBoardEditor(slug) {
    var b = null;
    for (var i = 0; i < CMS.boardRows.length; i++) if (CMS.boardRows[i].slug === slug) { b = CMS.boardRows[i]; break; }
    CMS.editingBoard = b;
    $("#board-modal-title").textContent = b ? "게시판 수정" : "새 게시판";
    $("#bd-slug").value = b ? b.slug : "";
    $("#bd-slug").disabled = !!b;
    $("#bd-name").value = b ? b.name : "";
    $("#bd-desc").value = b ? (b.description || "") : "";
    $("#bd-per").value = b ? b.per_page : 12;
    $("#bd-policy").value = b ? b.comment_policy : "member";
    $("#bd-sort").value = b ? (b.sort_order || 0) : nextBoardSort();
    $("#bd-active").checked = b ? !!b.is_active : true;
    $("#bd-msg").textContent = "";
    $("#board-delete").hidden = !b || !!DEFAULT_BOARD_SLUGS[b.slug];
    $("#board-modal").hidden = false;
    document.body.classList.add("cms-lock");
    setTimeout(function () { $("#bd-name").focus(); }, 50);
  }

  function closeBoardEditor() {
    $("#board-modal").hidden = true;
    document.body.classList.remove("cms-lock");
    CMS.editingBoard = null;
  }

  function saveBoard(e) {
    if (e) e.preventDefault();
    var b = CMS.editingBoard;
    var slug = (($("#bd-slug").value || "").trim() || (b ? b.slug : "")).toLowerCase();
    var name = ($("#bd-name").value || "").trim();
    var per = parseInt($("#bd-per").value || "12", 10);
    if (!b && !/^[a-z0-9][a-z0-9._-]{0,39}$/.test(slug)) {
      $("#bd-msg").textContent = "slug 는 영문 소문자·숫자·하이픈으로 1~40자 입력해 주세요. 예: notice";
      $("#bd-slug").focus();
      return;
    }
    if (!name) { $("#bd-msg").textContent = "게시판 이름을 입력해 주세요."; $("#bd-name").focus(); return; }
    if (!(per >= 1 && per <= 100)) { $("#bd-msg").textContent = "페이지당 글 수는 1~100 사이로 입력해 주세요."; $("#bd-per").focus(); return; }
    var payload = {
      name: name,
      description: ($("#bd-desc").value || "").trim() || null,
      per_page: per,
      comment_policy: $("#bd-policy").value,
      is_active: $("#bd-active").checked,
      sort_order: parseInt($("#bd-sort").value || "0", 10) || 0
    };
    var btn = $("#board-save");
    btn.disabled = true;
    $("#bd-msg").textContent = "저장하는 중…";
    var req = b
      ? sb.from("boards").update(payload).eq("slug", b.slug)
      : sb.from("boards").insert(Object.assign({ slug: slug }, payload));
    req.then(function (r) {
      btn.disabled = false;
      if (r.error) { $("#bd-msg").textContent = "저장 실패: " + r.error.message; return; }
      closeBoardEditor();
      cmsMsg("board-msg", (b ? "게시판을 수정했습니다: " : "게시판을 만들었습니다: ") + name +
        " · 사이트 #/board/" + slug + " 에 반영됩니다.", "ok");
      CMS.loaded.boards = false;
      loadBoards();
    }).catch(function (err) {
      btn.disabled = false;
      $("#bd-msg").textContent = "저장 실패: " + (err.message || "알 수 없는 오류");
    });
  }

  function deleteBoard() {
    var b = CMS.editingBoard;
    if (!b) return;
    if (DEFAULT_BOARD_SLUGS[b.slug]) { $("#bd-msg").textContent = "기본 4개 게시판은 삭제할 수 없습니다."; return; }
    var n = boardPostCount(b);
    if (n > 0) {
      $("#bd-msg").textContent = "이 게시판에 글이 " + n + "건 있어 삭제할 수 없습니다. 글을 다른 게시판으로 옮기거나 삭제한 뒤 다시 시도해 주세요.";
      return;
    }
    if (!window.confirm("‘" + b.name + "’ 게시판을 삭제할까요?\n되돌릴 수 없습니다.")) return;
    $("#bd-msg").textContent = "삭제하는 중…";
    sb.from("boards").delete().eq("slug", b.slug).then(function (r) {
      if (r.error) { $("#bd-msg").textContent = "삭제 실패: " + r.error.message; return; }
      closeBoardEditor();
      cmsMsg("board-msg", "게시판을 삭제했습니다: " + b.slug, "ok");
      CMS.loaded.boards = false;
      loadBoards();
    });
  }

  /* 글 편집기의 ‘분류’ 목록 = 게시판 목록 */
  function fillPostCategorySelect() {
    var sel = $("#pf-category");
    if (!sel || !CMS.boardRows.length) return;
    var cur = sel.value;
    sel.innerHTML = CMS.boardRows.map(function (b) {
      return '<option value="' + esc(boardKeyOf(b)) + '">' + esc(b.name) + (b.is_active ? "" : " (숨김)") + "</option>";
    }).join("");
    if (cur) setCategoryValue(cur);
  }

  function setCategoryValue(val) {
    var sel = $("#pf-category");
    if (!sel) return;
    var has = [].some.call(sel.options, function (o) { return o.value === val; });
    if (!has && val) {
      var o = document.createElement("option");
      o.value = val;
      o.textContent = val + " (게시판 없음)";
      sel.appendChild(o);
    }
    sel.value = val || (sel.options[0] ? sel.options[0].value : "");
  }

  /* =============================================================
     SBPress — 테마 프리셋 · 휴지통 · 수정 이력 · 피드 · 폼 접수
     ============================================================= */
  var THEME_PRESETS = [
    {
      key: "magazine", name: "매거진형", en: "Magazine",
      desc: "편집 그리드 · 또렷한 괘선 · 명조 제목",
      tags: ["괘선", "명조", "각진 모서리"]
    },
    {
      key: "craft", name: "공방/쇼케이스형", en: "Craft",
      desc: "따뜻한 작업실 카드 · 둥근 모서리 · 사진 강조",
      tags: ["카드", "둥글게", "따뜻한 색"]
    },
    {
      key: "org", name: "기관 소개형", en: "Organization",
      desc: "차분한 기관·협동조합형 · 구조적 카드 · 뚜렷한 위계",
      tags: ["구조", "차분한 색", "위계"]
    }
  ];
  var CMS_THEME = "magazine";

  function themeDef(key) {
    for (var i = 0; i < THEME_PRESETS.length; i++) if (THEME_PRESETS[i].key === key) return THEME_PRESETS[i];
    return THEME_PRESETS[0];
  }

  function renderThemePicks() {
    var box = $("#theme-picks");
    if (!box) return;
    box.innerHTML = THEME_PRESETS.map(function (t) {
      var on = t.key === CMS_THEME;
      return '<button type="button" class="theme-pick tp-' + t.key + '" data-theme="' + t.key + '" aria-pressed="' + on + '">' +
        '<span class="tp-thumb" aria-hidden="true">' +
          '<span class="tp-bar"></span>' +
          '<span class="tp-hero"></span>' +
          '<span class="tp-row"></span>' +
          '<span class="tp-row"></span>' +
          '<span class="tp-row short"></span>' +
        "</span>" +
        '<span class="tp-body">' +
          '<span class="tp-name">' + esc(t.name) + (on ? ' <em class="tp-on">사용 중</em>' : "") + "</span>" +
          '<span class="tp-desc">' + esc(t.desc) + "</span>" +
          '<span class="tp-tags">' + t.tags.map(function (x) { return "<i>" + esc(x) + "</i>"; }).join("") + "</span>" +
        "</span></button>";
    }).join("");
    [].forEach.call(box.querySelectorAll(".theme-pick"), function (b) {
      b.addEventListener("click", function () { setThemePreset(b.getAttribute("data-theme")); });
    });
    var now = $("#theme-now");
    if (now) now.innerHTML = "지금 적용 중: <b>" + esc(themeDef(CMS_THEME).name) + "</b> · 저장 위치 <code>site_contents.theme.preset</code>";
  }

  function loadTheme() {
    if (!sb) return Promise.resolve();
    return sb.from("site_contents").select("key,value").eq("key", "theme.preset").then(function (r) {
      if (r.error) { cmsMsg("theme-msg", "테마를 불러오지 못했습니다: " + r.error.message, "err"); return; }
      var row = (r.data || [])[0];
      var v = row ? String(row.value || "").trim() : "";
      CMS_THEME = /^(magazine|craft|org)$/.test(v) ? v : "magazine";
      renderThemePicks();
      loadThemeTokens();
    });
  }

  function setThemePreset(key) {
    if (!sb) return;
    var def = themeDef(key);
    if (key === CMS_THEME) { cmsMsg("theme-msg", "이미 ‘" + def.name + "’을 쓰고 있습니다.", "ok"); return; }
    cmsMsg("theme-msg", "‘" + def.name + "’ 저장 중…");
    sb.from("site_contents").upsert(
      { key: "theme.preset", section: "테마 · 디자인",
        label: "테마 프리셋 (magazine = 매거진형 / craft = 공방·쇼케이스형 / org = 기관 소개형)",
        value: key, image_url: null },
      { onConflict: "key" }
    ).then(function (r) {
      if (r.error) { cmsMsg("theme-msg", "저장 실패: " + r.error.message, "err"); return; }
      CMS_THEME = key;
      renderThemePicks();
      cmsMsg("theme-msg", "‘" + def.name + "’ 테마로 저장했습니다. 사이트를 새로 고치면 바로 그 모양으로 열립니다.", "ok");
    }).catch(function (e) {
      cmsMsg("theme-msg", "저장 실패: " + (e.message || "알 수 없는 오류"), "err");
    });
  }

  /* ---------------- v5.1 — 테마 토큰 (site_contents.theme.tokens) ----------------
     색·모서리·글꼴만 JSON 으로 담고 CSS 변수로 적용합니다. CSS 를 직접 넣지 않아 안전합니다. */
  var THEME_TOKENS = { accent: "#C86D44", bg: "#F7F5F2", ink: "#3E2F26", radius: 18, fontStack: "nanum" };
  var THEME_FONTS = {
    nanum: "Nanum Gothic", system: "시스템 글꼴", serif: "명조 계열", sans: "고딕 계열"
  };
  var THEME_FONT_CSS = {
    nanum: "'Nanum Gothic','나눔고딕',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    system: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif",
    serif: "Georgia,'Nanum Myeongjo','바탕',serif",
    sans: "'Helvetica Neue',Arial,'Malgun Gothic',sans-serif"
  };
  function hexOk(v) { return /^#[0-9a-f]{6}$/i.test(String(v || "").trim()); }
  /* v10.8 — 테마 마켓 토큰 — 기본 3색 외에 표면·선·보조 글자색까지 담습니다(v:2). */
  var TOKEN_EXTRA = ["surface", "bg2", "ink2", "ink3", "line", "line2", "accentDark", "accentSoft"];
  var TOKEN_PRESETS = { magazine: 1, craft: 1, org: 1 };
  function parseTokens(raw) {
    var out = { accent: THEME_TOKENS.accent, bg: THEME_TOKENS.bg, ink: THEME_TOKENS.ink,
      radius: THEME_TOKENS.radius, fontStack: THEME_TOKENS.fontStack, extras: {} };
    var v = raw;
    if (typeof raw === "string") {
      try { v = JSON.parse(raw); } catch (e) { v = null; }
    }
    if (!v || typeof v !== "object") return out;
    if (hexOk(v.accent)) out.accent = String(v.accent).toUpperCase();
    if (hexOk(v.bg)) out.bg = String(v.bg).toUpperCase();
    if (hexOk(v.ink)) out.ink = String(v.ink).toUpperCase();
    var r = parseInt(v.radius, 10);
    if (isFinite(r)) out.radius = Math.max(0, Math.min(32, r));
    if (v.fontStack && THEME_FONT_CSS[v.fontStack]) out.fontStack = v.fontStack;
    TOKEN_EXTRA.forEach(function (k) {
      if (hexOk(v[k])) out.extras[k] = String(v[k]).toUpperCase();
    });
    if (TOKEN_PRESETS[v.preset]) out.extras.preset = v.preset;
    return out;
  }
  function tokensJson(t) {
    var o = { v: 2, accent: t.accent, bg: t.bg, ink: t.ink, radius: t.radius, fontStack: t.fontStack };
    var ex = t.extras || {};
    TOKEN_EXTRA.concat(["preset"]).forEach(function (k) {
      if (ex[k]) o[k] = ex[k];
    });
    return JSON.stringify(o);
  }
  /* 토큰을 :root 변수로 — 색은 #RRGGBB, 모서리는 숫자, 글꼴은 정해진 이름만이라 CSS 주입이 될 수 없습니다. */
  function tokenRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function tokenShade(hex, f) {
    var rgb = tokenRgb(hex);
    if (!rgb) return "";
    return "#" + rgb.map(function (c) {
      var x = f < 0 ? c * (1 + f) : c + (255 - c) * f;
      x = Math.max(0, Math.min(255, Math.round(x)));
      return (x < 16 ? "0" : "") + x.toString(16);
    }).join("").toUpperCase();
  }
  function applyTokensToRoot(t) {
    var root = document.documentElement;
    var ex = t.extras || {};
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--accent-d", ex.accentDark || tokenShade(t.accent, -0.18));
    root.style.setProperty("--accent-s", ex.accentSoft || tokenShade(t.accent, 0.86));
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--bg-2", ex.bg2 || tokenShade(t.bg, -0.05));
    root.style.setProperty("--card", ex.surface || "#FFFDFB");
    root.style.setProperty("--ink", t.ink);
    root.style.setProperty("--ink-2", ex.ink2 || tokenShade(t.ink, 0.32));
    root.style.setProperty("--ink-3", ex.ink3 || tokenShade(t.ink, 0.45));
    if (ex.line) root.style.setProperty("--line", ex.line);
    if (ex.line2) root.style.setProperty("--line-2", ex.line2);
    else if (ex.line) root.style.setProperty("--line-2", tokenShade(ex.line, -0.12));
    root.style.setProperty("--r", t.radius + "px");
    root.style.setProperty("--r-s", Math.max(0, t.radius - 6) + "px");
    root.style.setProperty("--font-head", THEME_FONT_CSS[t.fontStack]);
    var rgb = tokenRgb(t.bg);
    if (rgb) {
      root.style.setProperty("--hero-rgb", rgb.join(","));
      root.style.setProperty("--header-bg", "rgba(" + rgb.join(",") + ",.82)");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t.accent);
    root.setAttribute("data-accent", t.accent);
  }
  function paintTokensPreview(t) {
    applyTokensToRoot(t);
    var json = $("#tt-json");
    if (json) json.textContent = tokensJson(t);
  }
  function fillTokenForm(t) {
    if ($("#tt-accent")) $("#tt-accent").value = t.accent;
    if ($("#tt-accent-hex")) $("#tt-accent-hex").value = t.accent;
    if ($("#tt-bg")) $("#tt-bg").value = t.bg;
    if ($("#tt-ink")) $("#tt-ink").value = t.ink;
    if ($("#tt-radius")) $("#tt-radius").value = t.radius;
    if ($("#tt-font")) $("#tt-font").value = t.fontStack;
    paintTokensPreview(t);
  }
  function readTokenForm() {
    return parseTokens({
      accent: $("#tt-accent-hex") ? $("#tt-accent-hex").value : "",
      bg: $("#tt-bg") ? $("#tt-bg").value : "",
      ink: $("#tt-ink") ? $("#tt-ink").value : "",
      radius: $("#tt-radius") ? $("#tt-radius").value : "",
      fontStack: $("#tt-font") ? $("#tt-font").value : ""
    });
  }
  function loadThemeTokens() {
    if (!sb) return Promise.resolve();
    return sb.from("site_contents").select("key,value").eq("key", "theme.tokens").then(function (r) {
      var row = (!r.error && r.data) ? r.data[0] : null;
      fillTokenForm(parseTokens(row ? row.value : ""));
      if (r.error) cmsMsg("tt-msg", "테마 토큰을 불러오지 못했습니다: " + r.error.message, "err");
    }, function () { fillTokenForm(parseTokens("")); });
  }
  function saveThemeTokens() {
    if (!sb) return;
    var t = readTokenForm();
    var badHex = [$("#tt-accent-hex"), $("#tt-bg"), $("#tt-ink")].filter(function (n) {
      return n && n.value && !hexOk(n.value);
    });
    if (badHex.length) {
      cmsMsg("tt-msg", "색은 #RRGGBB 6자리로 넣어 주세요(예: #C86D44).", "err");
      return;
    }
    var btn = $("#tt-save");
    if (btn) btn.disabled = true;
    sb.from("site_contents").upsert({
      key: "theme.tokens", section: "테마 · 디자인",
      label: "테마 토큰 (accent · bg · ink · radius · fontStack — CSS 직접 주입 없이 변수로 적용)",
      value: tokensJson(t), image_url: null
    }, { onConflict: "key" }).then(function (r) {
      if (btn) btn.disabled = false;
      if (r.error) { cmsMsg("tt-msg", "저장하지 못했습니다: " + r.error.message, "err"); return; }
      fillTokenForm(t);
      cmsMsg("tt-msg", "테마 토큰을 저장했습니다. 사이트를 새로 고치면 포인트 색·바탕·글자·모서리·글꼴이 바로 반영됩니다.", "ok");
    }, function (e) {
      if (btn) btn.disabled = false;
      cmsMsg("tt-msg", "저장하지 못했습니다: " + (e && e.message ? e.message : e), "err");
    });
  }
  function resetThemeTokens() {
    fillTokenForm(parseTokens(""));
    cmsMsg("tt-msg", "기본 토큰으로 되돌렸습니다. 저장을 눌러 사이트에 반영하세요.", "ok");
  }

  /* ---------------- 수정 이력 드로어 ---------------- */
  var revState = { type: "", id: "", rows: [] };

  function fmtRevTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function openHistory(type, id, title) {
    if (!sb || !id) return;
    revState = { type: type, id: id, rows: [] };
    $("#rev-drawer").hidden = false;
    document.body.classList.add("cms-lock");
    $("#rev-title").textContent = "수정 이력 · " + (type === "page" ? "페이지" : "글");
    $("#rev-sub").textContent = (title || id) + " — 저장할 때마다 직전 상태를 한 칸씩 남깁니다.";
    $("#rev-list").innerHTML = '<p class="rev-empty">불러오는 중…</p>';
    cmsMsg("rev-msg", "");
    sb.from("revisions").select("id,entity_type,entity_id,snapshot,note,created_at")
      .eq("entity_type", type).eq("entity_id", id)
      .order("created_at", { ascending: false }).limit(30)
      .then(function (r) {
        if (r.error) { $("#rev-list").innerHTML = '<p class="rev-empty">불러오지 못했습니다: ' + esc(r.error.message) + "</p>"; return; }
        revState.rows = r.data || [];
        renderRevisions();
      });
  }

  function renderRevisions() {
    var box = $("#rev-list");
    if (!box) return;
    if (!revState.rows.length) {
      box.innerHTML = '<p class="rev-empty">아직 수정 이력이 없습니다. 이 글을 한 번 저장하면 그 전 상태가 여기에 쌓입니다.</p>';
      return;
    }
    box.innerHTML = revState.rows.map(function (rv, i) {
      var sn = rv.snapshot || {};
      var label = rv.note || "수정";
      var extra = revState.type === "page"
        ? (sn.is_published ? "발행" : "숨김")
        : [sn.category, sn.is_published ? "발행" : "숨김"].filter(Boolean).join(" · ");
      return '<article class="rev-item">' +
        '<div class="rev-when"><b>' + esc(fmtRevTime(rv.created_at)) + "</b><span>" + esc(label) + "</span></div>" +
        '<div class="rev-what"><strong>' + esc(sn.title || "(제목 없음)") + "</strong><span>" + esc(extra) + "</span>" +
          (sn.subtitle ? "<em>" + esc(sn.subtitle) + "</em>" : "") +
        '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm rev-restore" data-i="' + i + '">이 버전으로 복원</button>' +
        "</article>";
    }).join("");
    [].forEach.call(box.querySelectorAll(".rev-restore"), function (b) {
      b.addEventListener("click", function () { restoreRevision(+b.getAttribute("data-i")); });
    });
  }

  function closeHistory() {
    $("#rev-drawer").hidden = true;
    document.body.classList.remove("cms-lock");
  }

  var POST_RESTORE_FIELDS = ["slug", "category", "title", "summary", "body", "body_format", "status", "region", "source_name",
    "source_url", "image_url", "deadline", "published_at", "is_published", "is_pinned", "publish_at",
    "sort_order", "meta"];
  var PAGE_RESTORE_FIELDS = ["title", "subtitle", "body", "body_format", "images", "blocks", "is_published", "sort_order"];

  function pick(obj, fields) {
    var out = {};
    fields.forEach(function (k) { if (obj && obj[k] !== undefined) out[k] = obj[k]; });
    return out;
  }

  function restoreRevision(i) {
    var rv = revState.rows[i];
    if (!rv) return;
    var sn = rv.snapshot || {};
    var when = fmtRevTime(rv.created_at);
    if (!window.confirm("이 버전(" + when + ")으로 되돌릴까요?\n지금 상태는 수정 이력에 한 칸 더 남으니 다시 되돌릴 수 있습니다.")) return;
    cmsMsg("rev-msg", "복원하는 중…");
    var req;
    if (revState.type === "page") {
      var body = pick(sn, PAGE_RESTORE_FIELDS);
      if (body.blocks && window.CRAFT_HUNMIN) body.blocks = window.CRAFT_HUNMIN.normalizeList(body.blocks);
      req = sb.from("pages").update(body).eq("slug", revState.id);
    } else {
      req = sb.from("posts").update(pick(sn, POST_RESTORE_FIELDS)).eq("slug", revState.id);
    }
    req.then(function (r) {
      if (r.error) { cmsMsg("rev-msg", "복원 실패: " + r.error.message, "err"); return; }
      cmsMsg("rev-msg", "이 버전으로 복원했습니다.", "ok");
      if (revState.type === "page") {
        loadPageManager();
        if (!$("#page-modal").hidden) closePageEditor();
      } else {
        CMS.loaded.posts = false;
        loadPosts();
        if (!$("#post-modal").hidden) closePostEditor();
      }
      setTimeout(closeHistory, 700);
    });
  }

  /* ---------------- sitemap.xml · rss.xml ---------------- */
  var FEED_BASE = String(SC.siteUrl || (location.origin && location.origin !== "null" ? location.origin : "")).replace(/\/+$/, "");

  function xesc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
    });
  }
  function rfc822(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toUTCString();
  }
  var CAT_BOARD = { "소개": "intro", "뉴스": "news", "인터뷰": "interview", "정보": "info" };

  function feedSource() {
    return Promise.all([
      sb.from("site_contents").select("key,value").in("key", ["seo_title", "seo_description"]),
      sb.from("boards").select("slug,name,description,is_active,sort_order").order("sort_order"),
      sb.from("pages").select("slug,title,updated_at,created_at,is_published").eq("is_published", true),
      sb.from("posts").select("slug,title,summary,category,published_at,updated_at,created_at,source_url,is_published,is_pinned,publish_at,sort_order,deleted_at")
        .eq("is_published", true).order("published_at", { ascending: false }).limit(80)
    ]).then(function (res) {
      var err = (res[0] && res[0].error) || (res[1] && res[1].error) || (res[2] && res[2].error) || (res[3] && res[3].error);
      if (err) throw new Error(err.message);
      var c = {};
      (res[0].data || []).forEach(function (r) { c[r.key] = r.value || ""; });
      var now = Date.now();
      var posts = (res[3].data || []).filter(function (p) {
        if (p.deleted_at) return false;
        if (p.publish_at && new Date(p.publish_at).getTime() > now) return false;
        return true;
      });
      return {
        title: c.seo_title || SC.siteTitle || (brandName() + " — 새 소식"),
        description: c.seo_description || "전국 방방곡곡 공방의 이번 주 소식",
        boards: (res[1].data || []).filter(function (b) { return b.is_active !== false; }),
        pages: res[2].data || [],
        posts: posts
      };
    });
  }

  function latestOf(posts, pages) {
    var latest = "";
    (posts || []).concat(pages || []).forEach(function (x) {
      var d = String(x.updated_at || x.published_at || x.created_at || "").slice(0, 10);
      if (d > latest) latest = d;
    });
    return latest || new Date().toISOString().slice(0, 10);
  }

  function buildSitemap(src) {
    var latest = latestOf(src.posts, src.pages);
    var urls = [
      { loc: FEED_BASE + "/", lastmod: latest, pri: "1.0", freq: "daily" },
      { loc: FEED_BASE + "/#/workshops", lastmod: latest, pri: "0.8", freq: "weekly" },
      { loc: FEED_BASE + "/#/news", lastmod: latest, pri: "0.9", freq: "daily" },
      { loc: FEED_BASE + "/#/interview", lastmod: latest, pri: "0.7", freq: "weekly" },
      { loc: FEED_BASE + "/#/info", lastmod: latest, pri: "0.7", freq: "weekly" },
      { loc: FEED_BASE + "/#/archive", lastmod: latest, pri: "0.6", freq: "monthly" },
      { loc: FEED_BASE + "/#/map", lastmod: latest, pri: "0.8", freq: "weekly" }
    ];
    src.boards.forEach(function (b) {
      var last = "";
      src.posts.forEach(function (p) {
        var key = CAT_BOARD[p.category] || p.category;
        if (key === b.slug && String(p.published_at).slice(0, 10) > last) last = String(p.published_at).slice(0, 10);
      });
      urls.push({ loc: FEED_BASE + "/#/board/" + b.slug, lastmod: last || latest, pri: "0.7", freq: "weekly" });
    });
    src.pages.forEach(function (p) {
      urls.push({
        loc: FEED_BASE + "/#/page/" + encodeURIComponent(p.slug),
        lastmod: String(p.updated_at || p.created_at || latest).slice(0, 10), pri: "0.6", freq: "monthly"
      });
    });
    urls.push({ loc: FEED_BASE + "/privacy", lastmod: "2026-11-21", pri: "0.2", freq: "yearly" });
    urls.push({ loc: FEED_BASE + "/terms", lastmod: "2026-11-21", pri: "0.2", freq: "yearly" });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(function (u) {
        return "  <url>\n    <loc>" + xesc(u.loc) + "</loc>\n    <lastmod>" + xesc(u.lastmod) +
          "</lastmod>\n    <changefreq>" + u.freq + "</changefreq>\n    <priority>" + u.pri + "</priority>\n  </url>";
      }).join("\n") + "\n</urlset>\n";
  }

  function buildRss(src) {
    var latest = latestOf(src.posts, src.pages);
    var items = src.posts.slice(0, 30).map(function (p) {
      var boardSlug = CAT_BOARD[p.category] || p.category;
      var link = /^https?:/i.test(p.source_url || "") ? p.source_url : FEED_BASE + "/#/board/" + boardSlug;
      return "    <item>\n      <title>" + xesc(p.title) + "</title>\n      <link>" + xesc(link) + "</link>\n" +
        '      <guid isPermaLink="false">' + xesc(FEED_BASE + "/#/post/" + (p.slug || p.title)) + "</guid>\n" +
        "      <pubDate>" + rfc822(p.published_at || p.created_at) + "</pubDate>\n" +
        "      <category>" + xesc(p.category) + "</category>\n" +
        "      <description>" + xesc(p.summary || p.title) + "</description>\n    </item>";
    }).join("\n");
    return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n' +
      "    <title>" + xesc(src.title) + "</title>\n    <link>" + xesc(FEED_BASE + "/") + "</link>\n" +
      "    <description>" + xesc(src.description) + "</description>\n    <language>ko-KR</language>\n" +
      "    <lastBuildDate>" + rfc822(latest) + "</lastBuildDate>\n" +
      '    <atom:link href="' + xesc(FEED_BASE + "/rss.xml") + '" rel="self" type="application/rss+xml"/>\n' +
      (items ? items + "\n" : "") + "  </channel>\n</rss>\n";
  }

  function showFeed(kind) {
    var pre = $("#feed-preview");
    if (!pre || !sb) return;
    cmsMsg("feed-msg", "만드는 중…");
    feedSource().then(function (src) {
      var xml = kind === "rss" ? buildRss(src) : buildSitemap(src);
      pre.textContent = xml;
      pre.hidden = false;
      var urls = (xml.match(/<loc>/g) || []).length;
      var items = (xml.match(/<item>/g) || []).length;
      cmsMsg("feed-msg", kind === "rss"
        ? "rss.xml · 글 " + items + "건"
        : "sitemap.xml · 주소 " + urls + "개", "ok");
    }).catch(function (e) {
      cmsMsg("feed-msg", "만들지 못했습니다: " + (e.message || "알 수 없는 오류"), "err");
    });
  }

  function downloadFeed(kind) {
    if (!sb) return;
    cmsMsg("feed-msg", "내려받는 중…");
    feedSource().then(function (src) {
      var xml = kind === "rss" ? buildRss(src) : buildSitemap(src);
      var blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = kind === "rss" ? "rss.xml" : "sitemap.xml";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      cmsMsg("feed-msg", (kind === "rss" ? "rss.xml" : "sitemap.xml") + " 내려받기를 시작했습니다. 사이트 폴더에 올리면 바로 열립니다.", "ok");
    }).catch(function (e) {
      cmsMsg("feed-msg", "내려받지 못했습니다: " + (e.message || "알 수 없는 오류"), "err");
    });
  }

  /* ==========================================================================
     v2.1 · 폼 접수함 (form_submissions — 문의·구독·제보 관리)
     --------------------------------------------------------------------------
     · DB 의 status · admin_note 열이 있으면 그대로 쓰고, 없으면 payload 안의
       __status · __note 와 is_handled 로 같은 뜻을 남깁니다(마이그레이션 전에도 동작).
     · 제출은 공개 RPC, 열람·수정·삭제는 관리자만 할 수 있습니다(RLS).
     ========================================================================== */
  var INBOX = {
    rows: [], cols: { status: false, note: false },
    kind: "all", status: "all", q: "", sel: null, loaded: false
  };
  var INBOX_STATUS = { new: "새 접수", in_progress: "처리 중", done: "완료" };
  var INBOX_BADGE = { new: "b-wait", in_progress: "b-warn", done: "b-ok" };

  /* 관리자 KO/EN 사전(assets/admin-i18n.js)이 있으면 그 자리에서 영어로 바꿔 넣습니다. */
  function tr(text) {
    var I = window.ADMIN_I18N;
    if (!I || !I.t || I.lang() !== "en") return text;
    return I.t(text);
  }

  function inboxStatusOf(r) {
    if (INBOX.cols.status && r.status) return String(r.status);
    var p = r.payload || {};
    if (p.__status) return String(p.__status);
    return r.is_handled ? "done" : "new";
  }
  function inboxNoteOf(r) {
    if (INBOX.cols.note) return String(r.admin_note || "");
    return String((r.payload || {}).__note || "");
  }
  function inboxKindLabel(kind) { return kind === "newsletter" ? "구독" : "등록·제보"; }
  function inboxPayloadText(r) {
    var p = r.payload || {};
    if (r.kind === "newsletter") {
      return [tr("뉴스레터 구독"), p.source, p.page].filter(Boolean).join(" · ") || tr("뉴스레터 구독");
    }
    return [p.title, p.region, p.craft, p.phone, p.desc].filter(Boolean).join(" · ") || "(내용 없음)";
  }
  function inboxMatch(r) {
    if (INBOX.kind !== "all" && r.kind !== INBOX.kind) return false;
    if (INBOX.status !== "all" && inboxStatusOf(r) !== INBOX.status) return false;
    if (!INBOX.q) return true;
    var hay = [r.name, r.email, inboxPayloadText(r), r.page_slug, inboxNoteOf(r)].join(" ").toLowerCase();
    return hay.indexOf(INBOX.q) >= 0;
  }

  function paintInboxKpis() {
    var n = { new: 0, in_progress: 0, done: 0, all: INBOX.rows.length };
    INBOX.rows.forEach(function (r) { var st = inboxStatusOf(r); if (n[st] == null) n[st] = 0; n[st]++; });
    var map = { "inbox-k-new": n["new"], "inbox-k-progress": n["in_progress"] || 0,
                "inbox-k-done": n["done"], "inbox-k-all": n.all };
    Object.keys(map).forEach(function (id) { var el = $("#" + id); if (el) el.textContent = map[id]; });
    var badge = $("#tab-inbox-count");
    if (badge) badge.textContent = n["new"] ? String(n["new"]) : "";
    var sub = $("#form-sub-count");
    if (sub) sub.textContent = n.all;
  }

  function renderInbox() {
    var body = $("#inbox-table tbody");
    if (!body) return;
    paintInboxKpis();
    var rows = INBOX.rows.filter(inboxMatch);
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">' +
        (INBOX.rows.length ? "조건에 맞는 접수가 없습니다." : "아직 접수된 내용이 없습니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var st = inboxStatusOf(r);
      var who = [r.name, r.email].filter(Boolean).join(" / ") || "–";
      var txt = inboxPayloadText(r);
      return "<tr>" +
        '<td class="muted" data-th="접수">' + esc(fmtRevTime(r.created_at)) + "</td>" +
        '<td data-th="종류"><span class="badge ' + (r.kind === "newsletter" ? "b-ok" : "b-wait") + '">' +
          esc(inboxKindLabel(r.kind)) + "</span></td>" +
        '<td data-th="이름·이메일">' + esc(who) + "</td>" +
        '<td class="ellip" data-th="내용" title="' + esc(txt) + '">' + esc(txt) + "</td>" +
        '<td data-th="상태"><span class="badge ' + (INBOX_BADGE[st] || "b-wait") + '">' +
          esc(INBOX_STATUS[st] || st) + "</span></td>" +
        '<td><button type="button" class="rowlink inbox-open" data-id="' + esc(r.id) + '">열기</button></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".inbox-open"), function (b) {
      b.addEventListener("click", function () { openInbox(b.getAttribute("data-id")); });
    });
  }

  function loadInbox(force) {
    var body = $("#inbox-table tbody");
    if (!sb) return Promise.resolve();
    if (INBOX.loaded && !force) { renderInbox(); return Promise.resolve(); }
    if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오는 중…</td></tr>';
    var full = "id,kind,email,name,payload,page_slug,is_handled,created_at,status,admin_note,handled_at";
    var base = "id,kind,email,name,payload,page_slug,is_handled,created_at";
    function q(sel) {
      return sb.from("form_submissions").select(sel).order("created_at", { ascending: false }).limit(200);
    }
    return q(full).then(function (r) {
      if (!r.error) { INBOX.cols = { status: true, note: true }; return r; }
      /* status · admin_note 열이 아직 없으면(마이그레이션 전) 기본 열만 읽습니다. */
      INBOX.cols = { status: false, note: false };
      return q(base);
    }).then(function (r) {
      if (r.error) {
        if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오지 못했습니다: ' + esc(r.error.message) + "</td></tr>";
        return;
      }
      INBOX.rows = r.data || [];
      INBOX.loaded = true;
      renderInbox();
      var note = $("#inbox-note");
      if (note) {
        note.innerHTML = INBOX.cols.status
          ? "Supabase <code>form_submissions</code> · 상태·관리 메모는 관리자만 읽고 쓸 수 있습니다."
          : "Supabase <code>form_submissions</code> · <b>status 열이 아직 없어</b> 처리 상태를 <code>is_handled</code>·<code>payload</code> 에 남깁니다. " +
            "정식 열을 쓰려면 <code>supabase/12_v21_enhancements.sql</code> 을 한 번 실행해 주세요.";
      }
      var stamp = $("#inbox-stamp");
      if (stamp) stamp.textContent = "마지막 확인 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
    });
  }

  function openInbox(id) {
    var r = null;
    for (var i = 0; i < INBOX.rows.length; i++) if (INBOX.rows[i].id === id) { r = INBOX.rows[i]; break; }
    if (!r) return;
    INBOX.sel = r;
    var p = r.payload || {};
    $("#inbox-modal-title").textContent = inboxKindLabel(r.kind) + " 접수";
    $("#inbox-detail-meta").innerHTML =
      '<span class="badge ' + (r.kind === "newsletter" ? "b-ok" : "b-wait") + '">' + esc(inboxKindLabel(r.kind)) + "</span>" +
      "<span>" + esc(fmtRevTime(r.created_at)) + "</span>" +
      (r.page_slug ? "<span>페이지 <code>" + esc(r.page_slug) + "</code></span>" : "") +
      (r.email ? '<a class="rowlink" href="mailto:' + esc(r.email) + '">메일 쓰기</a>' : "");
    var rows = [];
    function add(k, v) { if (v != null && String(v).trim() !== "") rows.push([k, String(v)]); }
    add("이름", r.name);
    add("이메일", r.email);
    Object.keys(p).forEach(function (k) {
      if (k === "__status" || k === "__note") return;
      var v = p[k];
      if (v == null || v === "") return;
      if (typeof v === "object") v = JSON.stringify(v);
      add(k, v);
    });
    $("#inbox-fields").innerHTML = rows.length
      ? rows.map(function (kv) {
          return "<dt>" + esc(kv[0]) + "</dt><dd>" + (/(url|link|링크)/i.test(kv[0])
            ? '<a class="rowlink" href="' + esc(kv[1]) + '" target="_blank" rel="noopener">' + esc(kv[1]) + "</a>"
            : esc(kv[1])) + "</dd>";
        }).join("")
      : "<dt>내용</dt><dd>(비어 있음)</dd>";
    $("#inbox-status-sel").value = inboxStatusOf(r);
    $("#inbox-note-input").value = inboxNoteOf(r);
    var hint = $("#inbox-status-hint");
    if (hint) hint.textContent = INBOX.cols.status
      ? "상태를 바꾸면 이 접수의 처리 상황이 함께 바뀝니다."
      : "status 열이 없어 is_handled(완료 여부)와 payload.__status 로 저장합니다.";
    cmsMsg("inbox-modal-msg", "");
    $("#inbox-modal").hidden = false;
    document.body.classList.add("cms-lock");
  }

  function closeInbox() {
    $("#inbox-modal").hidden = true;
    document.body.classList.remove("cms-lock");
    INBOX.sel = null;
  }

  function saveInbox() {
    var r = INBOX.sel;
    if (!r) return;
    var st = $("#inbox-status-sel").value;
    if (!INBOX_STATUS[st]) st = "new";
    var note = ($("#inbox-note-input").value || "").trim();
    var patch = { is_handled: st === "done" };
    if (INBOX.cols.status) {
      patch.status = st;
      patch.handled_at = st === "done" ? new Date().toISOString() : null;
    }
    if (INBOX.cols.note) patch.admin_note = note || null;
    if (!INBOX.cols.status || !INBOX.cols.note) {
      var merged = {};
      var src = r.payload || {};
      Object.keys(src).forEach(function (k) { merged[k] = src[k]; });
      if (!INBOX.cols.status) merged.__status = st;
      if (!INBOX.cols.note) merged.__note = note || "";
      patch.payload = merged;
    }
    $("#inbox-save").disabled = true;
    cmsMsg("inbox-modal-msg", "저장하는 중…");
    sb.from("form_submissions").update(patch).eq("id", r.id).then(function (res) {
      $("#inbox-save").disabled = false;
      if (res.error) { cmsMsg("inbox-modal-msg", "저장 실패: " + res.error.message, "err"); return; }
      if (INBOX.cols.status) r.status = st;
      if (INBOX.cols.note) r.admin_note = note || null;
      r.is_handled = st === "done";
      if (!INBOX.cols.status || !INBOX.cols.note) r.payload = patch.payload;
      renderInbox();
      closeInbox();
      cmsMsg("inbox-msg", "접수 상태를 ‘" + INBOX_STATUS[st] + "’(으)로 저장했습니다.", "ok");
    }).catch(function (err) {
      $("#inbox-save").disabled = false;
      cmsMsg("inbox-modal-msg", "저장 실패: " + ((err && err.message) || "알 수 없는 오류"), "err");
    });
  }

  function deleteInbox() {
    var r = INBOX.sel;
    if (!r) return;
    if (!window.confirm("이 접수 내용을 지울까요? 되돌릴 수 없습니다.")) return;
    cmsMsg("inbox-modal-msg", "지우는 중…");
    sb.from("form_submissions").delete().eq("id", r.id).then(function (res) {
      if (res.error) { cmsMsg("inbox-modal-msg", "삭제 실패: " + res.error.message, "err"); return; }
      INBOX.rows = INBOX.rows.filter(function (x) { return x.id !== r.id; });
      closeInbox();
      renderInbox();
      cmsMsg("inbox-msg", "접수 내용을 지웠습니다.", "ok");
    });
  }

  function downloadInboxCsv() {
    var rows = INBOX.rows.filter(inboxMatch);
    var head = ["접수", "종류", "이름", "이메일", "상태", "관리 메모", "페이지", "내용"];
    var lines = [head.join(",")].concat(rows.map(function (r) {
      var cells = [fmtRevTime(r.created_at), inboxKindLabel(r.kind), r.name || "", r.email || "",
                   INBOX_STATUS[inboxStatusOf(r)] || "", inboxNoteOf(r), r.page_slug || "", inboxPayloadText(r)];
      return cells.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }));
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = brandName() + "_폼접수_" + todayKST() + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    cmsMsg("inbox-msg", "접수 " + rows.length + "건을 CSV 로 내려받았습니다.", "ok");
  }

  /* ==========================================================================
     v2.1 · 전체 백업 / 복원
     --------------------------------------------------------------------------
     · 내보내기: site_contents · pages · boards · posts + sbpress.config.json
     · 복원: 파일을 먼저 검사(형식·행 모양·개수)하고, 확인을 체크해야 실행합니다.
       같은 id/key 는 upsert 로 덮어쓰고, 파일에 없는 자료는 지우지 않습니다.
     ========================================================================== */
  var BACKUP_FORMAT = "sbpress-backup";
  var BACKUP_TABLES = [
    { name: "site_contents", label: "사이트 문구", conflict: "key" },
    { name: "pages", label: "페이지", conflict: "id" },
    { name: "boards", label: "게시판", conflict: "id" },
    { name: "posts", label: "글", conflict: "id" }
  ];
  var BACKUP = { data: null, ok: false, report: [], warnings: [], counts: {} };

  function paintBackupCounts(c) {
    var map = { "bc-contents": c.site_contents, "bc-pages": c.pages, "bc-boards": c.boards, "bc-posts": c.posts };
    Object.keys(map).forEach(function (id) {
      var el = $("#" + id);
      if (el) el.textContent = (map[id] == null ? "–" : map[id]);
    });
    var cfgEl = $("#bc-config");
    if (cfgEl) cfgEl.textContent = (c.config === false ? "없음" : "포함");
  }

  function loadBackupCounts() {
    if (!sb) return Promise.resolve();
    var c = {};
    var jobs = BACKUP_TABLES.map(function (t) {
      return sb.from(t.name).select("*", { count: "exact", head: true }).then(function (r) {
        c[t.name] = (r && typeof r.count === "number") ? r.count : (r && !r.error ? "?" : "–");
      }, function () { c[t.name] = "–"; });
    });
    c.config = null;
    return Promise.all(jobs).then(function () {
      return fetch("/sbpress.config.json", { cache: "no-store" }).then(function (r) {
        c.config = !!r.ok;
      }).catch(function () { c.config = false; });
    }).then(function () {
      BACKUP.counts = c;
      paintBackupCounts(c);
      var stamp = $("#backup-stamp");
      if (stamp) stamp.textContent = "현황 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
    });
  }

  function downloadBlob(name, text, type) {
    var blob = new Blob([text], { type: type || "application/json;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function exportBackup() {
    if (!sb) return;
    var btn = $("#backup-export");
    if (btn) btn.disabled = true;
    cmsMsg("backup-export-msg", "자료를 모으는 중…");
    var jobs = BACKUP_TABLES.map(function (t) {
      return sb.from(t.name).select("*").limit(5000).then(function (r) {
        return { name: t.name, rows: r.error ? null : (r.data || []), error: r.error ? r.error.message : "" };
      }, function (e) {
        return { name: t.name, rows: null, error: (e && e.message) || "요청 실패" };
      });
    });
    var cfgJob = fetch("/sbpress.config.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    Promise.all(jobs.concat([cfgJob])).then(function (res) {
      if (btn) btn.disabled = false;
      var cfg = res.pop();
      var out = {
        format: BACKUP_FORMAT, version: "2.1", site: brandName(), siteUrl: (SC.siteUrl || ""),
        exportedAt: new Date().toISOString(), counts: {}, config: cfg, tables: {}
      };
      var bad = [];
      res.forEach(function (r) {
        if (r.error) bad.push(r.name + " (" + r.error + ")");
        out.tables[r.name] = r.rows || [];
        out.counts[r.name] = (r.rows || []).length;
      });
      var name = "sbpress-backup-" + todayKST() + ".json";
      downloadBlob(name, JSON.stringify(out, null, 1));
      var total = Object.keys(out.counts).reduce(function (a, k) { return a + out.counts[k]; }, 0);
      cmsMsg("backup-export-msg", bad.length
        ? "일부를 담지 못했습니다: " + bad.join(", ")
        : "백업 " + name + " — " + total + "건을 내려받았습니다.", bad.length ? "err" : "ok");
    });
  }

  function clearBackupPick() {
    BACKUP = { data: null, ok: false, report: [], warnings: [], counts: BACKUP.counts };
    var f = $("#backup-file");
    if (f) f.value = "";
    var nm = $("#backup-file-name");
    if (nm) nm.textContent = "선택한 파일 없음";
    var box = $("#backup-report");
    if (box) { box.hidden = true; box.innerHTML = ""; }
    var wrap = $("#backup-confirm-wrap");
    if (wrap) wrap.hidden = true;
    var chk = $("#backup-confirm");
    if (chk) chk.checked = false;
    var run = $("#backup-restore");
    if (run) run.disabled = true;
    cmsMsg("backup-msg", "");
  }

  function inspectBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data = null, why = "";
      try { data = JSON.parse(String(reader.result || "")); } catch (e) { why = "JSON 파일이 아닙니다."; }
      if (!why && (!data || typeof data !== "object")) why = "내용이 비어 있습니다.";
      if (!why && data.format !== BACKUP_FORMAT) why = "SBPress 백업 파일이 아닙니다(format 값 확인).";
      if (!why && (!data.tables || typeof data.tables !== "object")) why = "tables 가 없습니다.";
      var report = [], warnings = [], total = 0;
      if (!why) {
        BACKUP_TABLES.forEach(function (t) {
          var rows = data.tables[t.name];
          if (!Array.isArray(rows)) { warnings.push(t.label + " — 배열이 아니라 건너뜁니다"); return; }
          var good = rows.filter(function (r) { return r && typeof r === "object" && !Array.isArray(r) && r[t.conflict]; });
          var skip = rows.length - good.length;
          if (skip) warnings.push(t.label + " — " + skip + "행은 " + t.conflict + " 가 없어 건너뜁니다");
          report.push({ name: t.name, label: t.label, conflict: t.conflict, count: good.length, skip: skip, rows: good });
          total += good.length;
        });
        if (!total) why = "가져올 자료가 없습니다.";
      }
      var nm = $("#backup-file-name");
      if (nm) nm.textContent = file.name + " · " + Math.round(file.size / 1024) + "KB";
      var box = $("#backup-report");
      if (why) {
        BACKUP = { data: null, ok: false, report: [], warnings: [], counts: BACKUP.counts };
        if (box) {
          box.hidden = false;
          box.innerHTML = '<p class="backup-bad">검사 결과: ' + esc(why) + "</p>";
        }
        var wrap0 = $("#backup-confirm-wrap");
        if (wrap0) wrap0.hidden = true;
        cmsMsg("backup-msg", "이 파일은 복원할 수 없습니다: " + why, "err");
        return;
      }
      BACKUP = { data: data, ok: true, report: report, warnings: warnings, counts: BACKUP.counts };
      var when = data.exportedAt ? fmtRevTime(data.exportedAt) : "?";
      var html = '<p class="backup-summary">' +
        (data.site ? "사이트 <b>" + esc(String(data.site)) + "</b> · " : "") +
        "내보낸 시각 <b>" + esc(when) + "</b> · 모두 <b>" + total + "</b>행</p>" +
        '<table class="admin-table backup-table"><thead><tr><th>자료</th><th class="num">행</th><th>기준 열</th></tr></thead><tbody>' +
        report.map(function (r2) {
          return "<tr><td>" + esc(r2.label) + " <code>" + esc(r2.name) + "</code></td>" +
            '<td class="num">' + r2.count + "</td><td class=\"muted\">" + esc(r2.conflict) + "</td></tr>";
        }).join("") + "</tbody></table>";
      if (warnings.length) html += '<ul class="backup-warn">' + warnings.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>";
      if (data.config) html += '<p class="cms-hint">설정 파일도 들어 있습니다(사이트 이름 · 주소 · 기능 스위치). 설정은 자동으로 바뀌지 않습니다.</p>';
      if (box) { box.hidden = false; box.innerHTML = html; }
      var wrap = $("#backup-confirm-wrap");
      if (wrap) wrap.hidden = false;
      var chk = $("#backup-confirm");
      if (chk) chk.checked = false;
      var run = $("#backup-restore");
      if (run) run.disabled = true;
      cmsMsg("backup-msg", "검사 통과 — 확인에 체크하면 복원할 수 있습니다.", "ok");
    };
    reader.onerror = function () { cmsMsg("backup-msg", "파일을 읽지 못했습니다.", "err"); };
    reader.readAsText(file, "utf-8");
  }

  function runBackupRestore() {
    if (!BACKUP.ok || !BACKUP.data) return;
    if (!$("#backup-confirm").checked) {
      cmsMsg("backup-msg", "‘덮어쓰는 것에 동의합니다’에 체크해 주세요.", "err");
      return;
    }
    if (!window.confirm("백업 파일의 자료로 기존 자료를 덮어쓸까요?\n같은 id·key 는 바뀌고, 파일에 없는 자료는 그대로 남습니다.")) return;
    var run = $("#backup-restore");
    if (run) run.disabled = true;
    cmsMsg("backup-msg", "복원하는 중…");
    var out = [];
    var chain = Promise.resolve();
    BACKUP.report.forEach(function (t) {
      chain = chain.then(function () {
        if (!t.rows.length) { out.push(t.label + " 0행"); return null; }
        var chunks = [], size = 100;
        for (var i = 0; i < t.rows.length; i += size) chunks.push(t.rows.slice(i, i + size));
        var sub = chunks.reduce(function (p, chunk) {
          return p.then(function () {
            return sb.from(t.name).upsert(chunk, { onConflict: t.conflict }).then(function (r) {
              if (r.error) throw new Error(t.label + ": " + r.error.message);
            });
          });
        }, Promise.resolve());
        return sub.then(function () { out.push(t.label + " " + t.rows.length + "행"); });
      });
    });
    chain.then(function () {
      cmsMsg("backup-msg", "복원 완료 — " + out.join(" · ") + ". 화면을 새로 고치면 목록에 반영됩니다.", "ok");
      CMS.loaded.posts = false; CMS.loaded.pages = false; CMS.loaded.brand = false; CMS.loaded.comments = false;
      loadBackupCounts();
      if (INBOX.loaded) loadInbox(true);
      if (run) run.disabled = false;
    }).catch(function (e) {
      cmsMsg("backup-msg", "복원 중 멈췄습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
      if (run) run.disabled = false;
    });
  }

  /* ==========================================================================
     v2.1 · 에디터 자동 임시저장 (localStorage)
     --------------------------------------------------------------------------
     · 글·페이지 편집기가 열려 있는 동안 4초마다, 그리고 입력이 멈추면 1.2초 뒤에
       초안을 localStorage 에 남깁니다. 창이 갑자기 닫혀도 다시 열 때 복구할 수 있습니다.
     · 저장에 성공하면 그 초안은 지웁니다.
     ========================================================================== */
  var DRAFT_PREFIX = "sbp:draft:";
  var draftTimer = 0, draftDebounce = 0, draftLast = "", draftKeyNow = "";

  function draftKey(kind, id) { return DRAFT_PREFIX + kind + ":" + (id || "new"); }
  function draftSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ v: 1, at: new Date().toISOString(), data: data })); return true; }
    catch (e) { return false; }
  }
  function draftGet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && o.data) ? o : null;
    } catch (e) { return null; }
  }
  function draftDel(key) { try { if (key) localStorage.removeItem(key); } catch (e) { /* noop */ } }

  function readPostDraft() {
    function v(sel) { var n = $(sel); return n ? n.value : ""; }
    return {
      category: v("#pf-category"), state: v("#pf-state"), title: v("#pf-title"), slug: v("#pf-slug"),
      summary: v("#pf-summary"), body: v("#pf-body"), body_format: v("#pf-body_format"),
      region: v("#pf-region"), source_name: v("#pf-source_name"), source_url: v("#pf-source_url"),
      published_at: v("#pf-published_at"), deadline: v("#pf-deadline"), sort_order: v("#pf-sort_order"),
      tag: v("#pf-tag"), person: v("#pf-person"), role: v("#pf-role"), kind: v("#pf-kind"),
      period: v("#pf-period"), image_url: v("#pf-image_url"),
      title_en: v("#pf-title_en"), summary_en: v("#pf-summary_en"), body_en: v("#pf-body_en"),
      body_format_en: v("#pf-body_format_en"),
      is_pinned: !!($("#pf-is-pinned") && $("#pf-is-pinned").checked), publish_at: v("#pf-publish_at")
    };
  }

  function applyPostDraft(d) {
    if (!d) return;
    function set(sel, val) { var n = $(sel); if (n && val != null) n.value = val; }
    set("#pf-category", d.category); setCategoryValue(d.category || "뉴스");
    set("#pf-state", d.state); set("#pf-title", d.title); set("#pf-slug", d.slug);
    set("#pf-summary", d.summary); set("#pf-body", d.body); set("#pf-body_format", d.body_format);
    set("#pf-region", d.region); set("#pf-source_name", d.source_name); set("#pf-source_url", d.source_url);
    set("#pf-published_at", d.published_at); set("#pf-deadline", d.deadline);
    set("#pf-sort_order", d.sort_order); set("#pf-tag", d.tag); set("#pf-person", d.person);
    set("#pf-role", d.role); set("#pf-kind", d.kind); set("#pf-period", d.period);
    set("#pf-image_url", d.image_url); set("#pf-publish_at", d.publish_at);
    set("#pf-title_en", d.title_en); set("#pf-summary_en", d.summary_en);
    set("#pf-body_en", d.body_en); set("#pf-body_format_en", d.body_format_en);
    var pin = $("#pf-is-pinned");
    if (pin) pin.checked = !!d.is_pinned;
    syncPostFields();
    paintPostPreview(d.image_url || "");
    paintPublishHint();
    if (postEditor) postEditor.refresh();
  }

  function readPageDraft() {
    function v(sel) { var n = $(sel); return n ? n.value : ""; }
    return {
      slug: v("#pg-slug"), title: v("#pg-title"), subtitle: v("#pg-subtitle"), body: v("#pg-body"),
      body_format: v("#pg-body_format"), sort_order: v("#pg-sort"),
      title_en: v("#pg-title_en"), subtitle_en: v("#pg-subtitle_en"), body_en: v("#pg-body_en"),
      body_format_en: v("#pg-body_format_en"),
      is_published: !!($("#pg-published") && $("#pg-published").checked),
      images: (CMS.pageImages || []).slice(),
      blocks: (CMS.pageBlocks || []).slice()
    };
  }

  function applyPageDraft(d) {
    if (!d) return;
    function set(sel, val) { var n = $(sel); if (n && val != null) n.value = val; }
    set("#pg-title", d.title); set("#pg-subtitle", d.subtitle); set("#pg-body", d.body);
    set("#pg-body_format", d.body_format); set("#pg-sort", d.sort_order);
    set("#pg-title_en", d.title_en); set("#pg-subtitle_en", d.subtitle_en);
    set("#pg-body_en", d.body_en); set("#pg-body_format_en", d.body_format_en);
    var pub = $("#pg-published");
    if (pub) pub.checked = d.is_published !== false;
    CMS.pageImages = (d.images || []).slice();
    renderPageImages();
    if (Array.isArray(d.blocks)) {
      CMS.pageBlocks = d.blocks;
      mountHunmin();
    }
    if (pageEditor) pageEditor.refresh();
  }

  function paintAutosaveNote(kind) {
    var el = $(kind === "post" ? "#pf-autosave" : "#pg-autosave");
    if (!el) return;
    el.textContent = "자동 저장됨 " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  function autosaveOnce(kind) {
    var key = draftKeyNow;
    if (!key) return false;
    var data, modal = $(kind === "post" ? "#post-modal" : "#page-modal");
    if (!modal || modal.hidden) return false;
    data = kind === "post" ? readPostDraft() : readPageDraft();
    var sig = JSON.stringify(data);
    if (sig === draftLast) return false;
    /* 아직 아무것도 쓰지 않은 새 글·페이지는 초안으로 남기지 않습니다. */
    if (!String(data.title || "").trim() && !String(data.body || "").trim()) return false;
    draftLast = sig;
    if (!draftSet(key, data)) return false;
    paintAutosaveNote(kind);
    return true;
  }

  function startAutosave(kind, key) {
    stopAutosave();
    draftKeyNow = key;
    draftLast = "";
    draftTimer = setInterval(function () { autosaveOnce(kind); }, 4000);
    var form = $(kind === "post" ? "#post-form" : "#page-form");
    if (form) {
      form.addEventListener("input", function () {
        clearTimeout(draftDebounce);
        draftDebounce = setTimeout(function () { autosaveOnce(kind); }, 1200);
      });
      form.addEventListener("change", function () {
        clearTimeout(draftDebounce);
        draftDebounce = setTimeout(function () { autosaveOnce(kind); }, 600);
      });
    }
  }

  function stopAutosave() {
    if (draftTimer) { clearInterval(draftTimer); draftTimer = 0; }
    if (draftDebounce) { clearTimeout(draftDebounce); draftDebounce = 0; }
    draftKeyNow = "";
  }

  function showDraftBanner(kind, key) {
    var box = $(kind === "post" ? "#pf-draft" : "#pg-draft");
    var txt = $(kind === "post" ? "#pf-draft-text" : "#pg-draft-text");
    if (!box) return;
    var d = draftGet(key);
    if (!d) { box.hidden = true; return; }
    var label = (d.data && (d.data.title || d.data.slug)) || "";
    txt.textContent = "자동 저장된 임시본이 있습니다" +
      (d.at ? " · " + fmtRevTime(d.at) : "") + (label ? " · " + label : "");
    box.hidden = false;
  }

  function wireDraftBanner(kind) {
    var restore = $(kind === "post" ? "#pf-draft-restore" : "#pg-draft-restore");
    var discard = $(kind === "post" ? "#pf-draft-discard" : "#pg-draft-discard");
    if (restore) restore.addEventListener("click", function () {
      var d = draftGet(draftKeyNow);
      if (!d) return;
      if (kind === "post") applyPostDraft(d.data); else applyPageDraft(d.data);
      var box = $(kind === "post" ? "#pf-draft" : "#pg-draft");
      if (box) box.hidden = true;
      cmsMsg(kind === "post" ? "pf-msg" : "pg-msg", "자동 저장된 임시본을 복구했습니다. 저장을 눌러야 반영됩니다.", "ok");
    });
    if (discard) discard.addEventListener("click", function () {
      if (!window.confirm("자동 저장된 임시본을 지울까요? 되돌릴 수 없습니다.")) return;
      draftDel(draftKeyNow);
      var box = $(kind === "post" ? "#pf-draft" : "#pg-draft");
      if (box) box.hidden = true;
    });
  }

  /* ---------------- v7.0 · 예약 · 설문 ---------------- */
  var RSV = { forms: [], form: null, slots: [], list: [], missing: false, loading: false };

  function rsvMsg(text, kind) {
    var box = document.getElementById("rsv-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "cms-toast" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    box.hidden = !text;
  }
  function rsvStamp() {
    var n = document.getElementById("rsv-admin-stamp");
    if (n) n.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  function rsvStatusLabel(s) {
    return { submitted: "접수", confirmed: "확정", completed: "완료", canceled: "취소" }[s] || s;
  }
  function rsvMissing(err) {
    return err && (err.code === "42P01" || err.code === "404" ||
      /does not exist|schema cache|find the table/i.test(String(err.message || "")));
  }

  function loadReservations() {
    if (!sb) return;
    if (RSV.loading) return;
    RSV.loading = true;
    sb.from("survey_forms").select("id,slug,kind,title,title_en,description,is_active,sort_order").order("sort_order", { ascending: true })
      .then(function (r) {
        RSV.loading = false;
        if (r.error) {
          if (rsvMissing(r.error)) { RSV.missing = true; showRsvMissing(); return; }
          rsvMsg("예약 양식을 읽지 못했습니다: " + r.error.message, "err");
          return;
        }
        RSV.missing = false;
        var miss = document.getElementById("rsv-missing");
        if (miss) miss.hidden = true;
        RSV.forms = r.data || [];
        if (!RSV.form || !RSV.forms.some(function (f) { return f.id === RSV.form.id; })) {
          RSV.form = RSV.forms[0] || null;
        }
        renderRsvForms();
        if (RSV.form) { fillRsvForm(); loadRsvSlots(); loadRsvList(); }
        else { renderRsvSlots(); renderRsvList(); }
        rsvStamp();
      });
  }

  function showRsvMissing() {
    var miss = document.getElementById("rsv-missing");
    if (miss) miss.hidden = false;
    var list = document.querySelector("#rsv-list tbody");
    if (list) list.innerHTML = '<tr><td colspan="6" class="wh-empty">예약 표가 아직 없습니다.</td></tr>';
    var slots = document.querySelector("#rsv-slots tbody");
    if (slots) slots.innerHTML = '<tr><td colspan="5" class="wh-empty">예약 표가 아직 없습니다.</td></tr>';
  }

  function renderRsvForms() {
    var sel = document.getElementById("rsv-admin-forms");
    if (!sel) return;
    sel.innerHTML = RSV.forms.length
      ? RSV.forms.map(function (f) {
          return '<option value="' + esc(f.id) + '"' + (RSV.form && f.id === RSV.form.id ? " selected" : "") + ">" +
            esc(f.title || f.slug) + (f.is_active ? "" : " (숨김)") + "</option>";
        }).join("")
      : '<option value="">양식 없음</option>';
  }

  function fillRsvForm() {
    var f = RSV.form || {};
    [ ["#rsv-form-slug", f.slug], ["#rsv-form-title", f.title], ["#rsv-form-title-en", f.title_en],
      ["#rsv-form-desc", f.description] ].forEach(function (p) {
      var el = document.querySelector(p[0]);
      if (el) el.value = p[1] == null ? "" : p[1];
    });
    var on = document.getElementById("rsv-form-active");
    if (on) on.checked = f.is_active !== false;
  }

  function loadRsvSlots() {
    if (!RSV.form) return;
    sb.from("reservation_slots")
      .select("id,slot_date,slot_time,capacity,is_open")
      .eq("form_id", RSV.form.id).order("slot_date", { ascending: true }).order("slot_time", { ascending: true })
      .then(function (r) {
        if (r.error) { if (!rsvMissing(r.error)) rsvMsg("슬롯을 읽지 못했습니다: " + r.error.message, "err"); RSV.slots = []; }
        else RSV.slots = r.data || [];
        renderRsvSlots();
      });
  }

  function renderRsvSlots() {
    var body = document.querySelector("#rsv-slots tbody");
    var count = document.getElementById("rsv-slot-count");
    if (count) count.textContent = RSV.slots.length + "개";
    if (!body) return;
    if (!RSV.slots.length) {
      body.innerHTML = '<tr><td colspan="5" class="wh-empty">아직 만든 슬롯이 없습니다.</td></tr>';
      return;
    }
    var taken = {};
    RSV.list.forEach(function (r) {
      if (r.status === "submitted" || r.status === "confirmed") taken[r.slot_id] = (taken[r.slot_id] || 0) + 1;
    });
    body.innerHTML = RSV.slots.map(function (s) {
      var used = taken[s.id] || 0;
      return "<tr data-slot-row=\"" + esc(s.id) + "\">" +
        "<td>" + esc(s.slot_date) + "</td>" +
        "<td>" + esc(s.slot_time || "종일") + "</td>" +
        "<td>" + used + " / " + esc(s.capacity) + "</td>" +
        "<td>" + (s.is_open ? '<span class="panel-tag is-on">열림</span>' : '<span class="panel-tag is-off">닫힘</span>') + "</td>" +
        "<td class=\"wh-act\">" +
        '<button type="button" class="btn btn-ghost btn-sm" data-rsv-slot-toggle="' + esc(s.id) + '">' + (s.is_open ? "닫기" : "열기") + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm danger" data-rsv-slot-del="' + esc(s.id) + '">삭제</button>' +
        "</td></tr>";
    }).join("");
  }

  function loadRsvList() {
    if (!RSV.form) return;
    sb.from("reservations")
      .select("id,code,slot_id,slot_date,slot_time,name,email,phone,memo,status,created_at")
      .eq("form_id", RSV.form.id).order("created_at", { ascending: false }).limit(200)
      .then(function (r) {
        if (r.error) {
          if (rsvMissing(r.error)) { showRsvMissing(); return; }
          rsvMsg("신청을 읽지 못했습니다: " + r.error.message, "err");
          RSV.list = [];
        } else RSV.list = r.data || [];
        renderRsvList();
        renderRsvSlots();
      });
  }

  function rsvFiltered() {
    var sel = document.getElementById("rsv-status-filter");
    var want = sel ? sel.value : "all";
    return RSV.list.filter(function (r) { return want === "all" || r.status === want; });
  }

  function renderRsvList() {
    var body = document.querySelector("#rsv-list tbody");
    var count = document.getElementById("rsv-count");
    var rows = rsvFiltered();
    if (count) count.textContent = rows.length + "건";
    var badge = document.getElementById("tab-rsv-count");
    if (badge) {
      var n = RSV.list.filter(function (r) { return r.status === "submitted"; }).length;
      badge.textContent = n ? String(n) : "";
    }
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="wh-empty">아직 들어온 신청이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var next = r.status === "submitted"
        ? '<button type="button" class="btn btn-primary btn-sm" data-rsv-act="confirmed" data-rsv-id="' + esc(r.id) + '">확정</button>' +
          '<button type="button" class="btn btn-ghost btn-sm danger" data-rsv-act="canceled" data-rsv-id="' + esc(r.id) + '">취소</button>'
        : r.status === "confirmed"
        ? '<button type="button" class="btn btn-primary btn-sm" data-rsv-act="completed" data-rsv-id="' + esc(r.id) + '">완료</button>' +
          '<button type="button" class="btn btn-ghost btn-sm danger" data-rsv-act="canceled" data-rsv-id="' + esc(r.id) + '">취소</button>'
        : '<button type="button" class="btn btn-ghost btn-sm" data-rsv-act="confirmed" data-rsv-id="' + esc(r.id) + '">되돌리기</button>';
      return "<tr><td><b>" + esc(r.code) + "</b></td>" +
        "<td>" + esc(r.name) + '<br><span class="wh-sub">' + esc(r.email) + (r.phone ? " · " + esc(r.phone) : "") + "</span></td>" +
        "<td>" + esc(r.slot_date || "-") + " " + esc(r.slot_time || "") + "</td>" +
        "<td><span class=\"wh-st " + (r.status === "canceled" ? "is-fail" : r.status === "completed" ? "is-ok" : "is-wait") + "\">" +
        esc(rsvStatusLabel(r.status)) + "</span></td>" +
        "<td>" + esc(fmtDate(r.created_at)) + "</td>" +
        '<td class="wh-act">' + next + "</td></tr>";
    }).join("");
  }

  function saveRsvForm() {
    var val = function (sel) { var n = document.querySelector(sel); return n ? String(n.value || "").trim() : ""; };
    var payload = {
      slug: val("#rsv-form-slug").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, ""),
      title: val("#rsv-form-title"),
      title_en: val("#rsv-form-title-en"),
      description: val("#rsv-form-desc"),
      is_active: !!(document.getElementById("rsv-form-active") || {}).checked,
      kind: "reservation",
      sort_order: 100
    };
    if (!payload.slug || !payload.title) { rsvMsg("주소 이름과 이름을 입력해 주세요.", "err"); return; }
    var btn = document.getElementById("rsv-form-save");
    if (btn) btn.disabled = true;
    var q = RSV.form
      ? sb.from("survey_forms").update(payload).eq("id", RSV.form.id)
      : sb.from("survey_forms").insert(payload);
    q.then(function (r) {
      if (btn) btn.disabled = false;
      if (r.error) {
        rsvMsg(rsvMissing(r.error) ? "예약 표가 아직 없습니다(19_v70 SQL 실행)." : "저장하지 못했습니다: " + r.error.message, "err");
        return;
      }
      rsvMsg("양식을 저장했습니다.", "ok");
      RSV.form = null;
      loadReservations();
    });
  }

  function newRsvForm() {
    RSV.form = null;
    fillRsvForm();
    var slug = document.getElementById("rsv-form-slug");
    if (slug) slug.focus();
    rsvMsg("새 양식의 주소 이름과 이름을 적고 ‘양식 저장’을 누르세요.");
  }

  function addRsvSlot() {
    if (!RSV.form) { rsvMsg("먼저 양식을 저장해 주세요.", "err"); return; }
    var date = (document.getElementById("rsv-slot-date") || {}).value || "";
    var time = (document.getElementById("rsv-slot-time") || {}).value || "";
    var cap = parseInt((document.getElementById("rsv-slot-cap") || {}).value || "1", 10);
    if (!date) { rsvMsg("날짜를 골라 주세요.", "err"); return; }
    if (!cap || cap < 1) cap = 1;
    sb.from("reservation_slots")
      .upsert({ form_id: RSV.form.id, slot_date: date, slot_time: time, capacity: cap, is_open: true },
        { onConflict: "form_id,slot_date,slot_time" })
      .then(function (r) {
        if (r.error) { rsvMsg("슬롯을 저장하지 못했습니다: " + r.error.message, "err"); return; }
        rsvMsg("슬롯을 추가했습니다.", "ok");
        loadRsvSlots();
      });
  }

  function setReservation(id, status) {
    sb.from("reservations").update({ status: status }).eq("id", id).then(function (r) {
      if (r.error) { rsvMsg("상태를 바꾸지 못했습니다: " + r.error.message, "err"); return; }
      rsvMsg("상태를 ‘" + rsvStatusLabel(status) + "’(으)로 바꿨습니다.", "ok");
      loadRsvList();
    });
  }

  function initRsvAdmin() {
    var sel = document.getElementById("rsv-admin-forms");
    if (sel) sel.addEventListener("change", function () {
      var id = sel.value;
      RSV.form = RSV.forms.filter(function (f) { return f.id === id; })[0] || null;
      fillRsvForm(); loadRsvSlots(); loadRsvList();
    });
    var save = document.getElementById("rsv-form-save");
    if (save) save.addEventListener("click", saveRsvForm);
    var nf = document.getElementById("rsv-form-new");
    if (nf) nf.addEventListener("click", newRsvForm);
    var add = document.getElementById("rsv-slot-add");
    if (add) add.addEventListener("click", addRsvSlot);
    var reload = document.getElementById("rsv-reload");
    if (reload) reload.addEventListener("click", loadReservations);
    var filter = document.getElementById("rsv-status-filter");
    if (filter) filter.addEventListener("change", renderRsvList);
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var act = t.closest("[data-rsv-act]");
      if (act) { setReservation(act.getAttribute("data-rsv-id"), act.getAttribute("data-rsv-act")); return; }
      var tog = t.closest("[data-rsv-slot-toggle]");
      if (tog) {
        var id = tog.getAttribute("data-rsv-slot-toggle");
        var s = RSV.slots.filter(function (x) { return x.id === id; })[0];
        if (!s) return;
        sb.from("reservation_slots").update({ is_open: !s.is_open }).eq("id", id).then(function () { loadRsvSlots(); });
        return;
      }
      var del = t.closest("[data-rsv-slot-del]");
      if (del) {
        if (!window.confirm("이 슬롯을 지울까요? 들어온 신청은 남습니다.")) return;
        sb.from("reservation_slots").delete().eq("id", del.getAttribute("data-rsv-slot-del"))
          .then(function () { loadRsvSlots(); });
      }
    });
  }

  /* ---------------- v5.0 · 설정 · 연동 ---------------- */
  var SETTING_GROUPS = {
    drive: [["drive.picker_api_key", "#set-drive-key", "Google Drive Picker API 키"],
            ["drive.picker_app_id", "#set-drive-app", "Google Drive Picker 앱 ID"],
            ["drive.folder_id", "#set-drive-folder", "SBPress 업로드 폴더 ID"]],
    social: [["social.kakao_rest_key", "#set-kakao-key", "카카오 REST API 키"],
             ["social.naver_client_id", "#set-naver-id", "네이버 로그인 Client ID"]],
    notify: [["notify.daily_cap", "#set-notify-cap", "알림 메일 1일 상한"],
             ["notify.from_email", "#set-notify-from", "알림 보내는 사람 주소"]],
    ai: [["ai.provider", "#set-ai-provider", "AI 보조 사용 방식"],
         ["ai.model", "#set-ai-model", "AI 모델 이름"]]
  };
  var settingsLoaded = false;

  function setBadge(id, text, ok) {
    var n = document.getElementById(id);
    if (!n) return;
    n.textContent = text;
    n.classList.toggle("is-on", !!ok);
    n.classList.toggle("is-off", !ok);
  }

  function loadSettings() {
    var keys = [];
    Object.keys(SETTING_GROUPS).forEach(function (g) {
      SETTING_GROUPS[g].forEach(function (row) { keys.push(row[0]); });
    });
    var cb = document.getElementById("set-social-cb");
    var u = (window.CRAFT_SUPABASE && window.CRAFT_SUPABASE.url) || "";
    if (cb) cb.textContent = u ? (u.replace(/\/+$/, "") + "/functions/v1/social-auth?provider=kakao") : "—";
    var stamp = document.getElementById("set-stamp");
    if (stamp) stamp.textContent = "불러오는 중…";
    sb.from("site_contents").select("key,value").in("key", keys).then(function (r) {
      if (r.error) { cmsMsg("set-msg", "설정을 읽지 못했습니다: " + r.error.message, "err"); return; }
      var map = {};
      (r.data || []).forEach(function (row) { map[row.key] = row.value || ""; });
      Object.keys(SETTING_GROUPS).forEach(function (g) {
        SETTING_GROUPS[g].forEach(function (row) {
          var el = document.querySelector(row[1]);
          if (el) el.value = map[row[0]] == null ? "" : map[row[0]];
        });
      });
      var driveOn = !!(map["drive.picker_api_key"] && map["drive.picker_app_id"]);
      setBadge("set-drive-state", driveOn ? "켜짐" : "키 없음", driveOn);
      var kakao = !!map["social.kakao_rest_key"], naver = !!map["social.naver_client_id"];
      setBadge("set-social-state",
        kakao && naver ? "카카오 · 네이버 켜짐" : kakao ? "카카오만 켜짐" : naver ? "네이버만 켜짐" : "키 없음",
        kakao || naver);
      setBadge("set-notify-state", map["notify.daily_cap"] ? "설정됨" : "기본값", !!map["notify.daily_cap"]);
      var ai = String(map["ai.provider"] || "none").toLowerCase();
      setBadge("ai-state", ai === "openai" ? "OpenAI" : ai === "compatible" ? "호환 API" : "사용 안 함",
        ai === "openai" || ai === "compatible");
      settingsLoaded = true;
      if (stamp) stamp.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    });
  }

  function saveSettings(group) {
    var rows = SETTING_GROUPS[group] || [];
    var payload = rows.map(function (row) {
      var el = document.querySelector(row[1]);
      return { key: row[0], value: el ? String(el.value || "").trim() : "", section: "연동 · 알림", label: row[2] };
    });
    var btn = document.getElementById("set-" + group + "-save");
    if (btn) btn.disabled = true;
    sb.from("site_contents").upsert(payload, { onConflict: "key" }).then(function (r) {
      if (btn) btn.disabled = false;
      if (r.error) { cmsMsg("set-msg", "저장하지 못했습니다: " + r.error.message, "err"); return; }
      cmsMsg("set-msg", "설정을 저장했습니다. 사이트를 새로고침하면 적용됩니다.", "ok");
      loadSettings();
    });
  }

  function initCms() {
    [].forEach.call(document.querySelectorAll(".admin-tab"), function (b) {
      b.addEventListener("click", function () { activateTab(b.getAttribute("data-tab")); });
    });

    /* --- 플러그인 · 마켓 --- */
    var auReload = $("#audit-reload");
    if (auReload) auReload.addEventListener("click", function () { CMS.auditLoaded = false; loadAudit(); });
    ["drive", "social", "notify", "ai"].forEach(function (g) {
      var b = document.getElementById("set-" + g + "-save");
      if (b) b.addEventListener("click", function () { saveSettings(g); });
    });
    var setReload = document.getElementById("set-reload");
    if (setReload) setReload.addEventListener("click", loadSettings);
    var plReload = $("#plugins-reload");
    if (plReload) plReload.addEventListener("click", function () { loadPlugins(); });
    var plInstall = $("#plug-install");
    if (plInstall) plInstall.addEventListener("click", installCustom);
    var plTest = $("#plug-test");
    if (plTest) plTest.addEventListener("click", testPluginUrl);
    var plSave = $("#plug-market-save");
    if (plSave) plSave.addEventListener("click", saveMarketUrl);
    var plMreload = $("#plug-market-reload");
    if (plMreload) plMreload.addEventListener("click", loadMarket);
    if (window.SBP_DRIVE && window.SBP_DRIVE.enhance && $("#pf-attach")) {
      pfAttach = window.SBP_DRIVE.enhance($("#pf-attach"), { placeholderKey: "drive.ph" });
    }
    var saveBtn = $("#pages-save");
    if (saveBtn) saveBtn.addEventListener("click", savePages);
    var reload = $("#pages-reload");
    if (reload) reload.addEventListener("click", function () { CMS.loaded.pages = false; loadPages(); });

    /* --- 헤더 · 푸터 · Head --- */
    var brandSave = $("#brand-save");
    if (brandSave) brandSave.addEventListener("click", saveBrand);
    var brandReload = $("#brand-reload");
    if (brandReload) brandReload.addEventListener("click", function () { CMS.loaded.brand = false; loadBrand(); });
    var logoFile = $("#logo-file");
    if (logoFile) logoFile.addEventListener("change", function () {
      var f = logoFile.files && logoFile.files[0];
      if (!f) return;
      $("#logo-msg").textContent = "올리는 중…";
      uploadSiteImage(f, "header/logo", "#logo-msg", "업로드 완료 — ‘변경 저장’을 누르면 사이트에 반영됩니다.").then(function (url) {
        $("#logo-url").value = url;
        paintLogo(url);
      }).catch(function (e) { $("#logo-msg").textContent = "업로드 실패: " + (e.message || "알 수 없는 오류"); });
    });
    var logoUrl = $("#logo-url");
    if (logoUrl) logoUrl.addEventListener("input", function () { paintLogo(logoUrl.value.trim()); });
    var logoClear = $("#logo-clear");
    if (logoClear) logoClear.addEventListener("click", function () {
      $("#logo-url").value = "";
      paintLogo("");
      $("#logo-msg").textContent = "기본 마크로 돌아갑니다 — ‘변경 저장’을 눌러 주세요.";
    });
    var headTa = $("#head-html");
    if (headTa) headTa.addEventListener("input", paintHeadCount);
    var menuAdd = $("#menu-add");
    if (menuAdd) menuAdd.addEventListener("click", function () {
      syncMenuModel();
      if (!CMS.brand) return;
      CMS.brand.menu.push({ label: "", label_ko: "", label_en: "", target: "home", note: "", visible: true });
      renderMenuRows();
      var rows = document.querySelectorAll("#menu-rows .menu-row");
      var last = rows[rows.length - 1];
      var inp = last && last.querySelector('[data-f="label_ko"]');
      if (inp) inp.focus();
    });
    var menuReset = $("#menu-reset");
    if (menuReset) menuReset.addEventListener("click", function () {
      if (!CMS.brand) return;
      if (!window.confirm("헤더 메뉴를 기본 7개 메뉴로 되돌릴까요? ‘변경 저장’을 눌러야 사이트에 반영됩니다.")) return;
      CMS.brand.menu = DEFAULT_MENU.map(normMenu);
      renderMenuRows();
    });
    var mrows = $("#menu-rows");
    if (mrows) mrows.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-move],button[data-del]");
      if (!btn) return;
      syncMenuModel();
      var row = btn.closest(".menu-row");
      var i = row ? +row.getAttribute("data-i") : -1;
      if (i < 0 || !CMS.brand) return;
      var list = CMS.brand.menu;
      if (btn.hasAttribute("data-del")) list.splice(i, 1);
      else {
        var j = i + (+btn.getAttribute("data-move"));
        if (j < 0 || j >= list.length) return;
        var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      }
      renderMenuRows();
    });

    /* --- 직접 만든 페이지 --- */
    var pageNew = $("#page-new");
    if (pageNew) pageNew.addEventListener("click", function () { openPageEditor(null); });
    ["#page-cancel", "#page-cancel-x"].forEach(function (sel) {
      var n = $(sel); if (n) n.addEventListener("click", closePageEditor);
    });
    var pageForm = $("#page-form");
    if (pageForm) pageForm.addEventListener("submit", savePage);
    var pageDel = $("#page-delete");
    if (pageDel) pageDel.addEventListener("click", deletePage);
    var pgImages = $("#pg-images");
    if (pgImages) {
      pgImages.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-move],button[data-del]");
        if (!btn) return;
        syncPageCaptions();
        var i = btn.hasAttribute("data-move") ? +btn.getAttribute("data-i") : +btn.getAttribute("data-del");
        if (btn.hasAttribute("data-del")) {
          CMS.pageImages.splice(i, 1);
        } else {
          var j = i + (+btn.getAttribute("data-move"));
          if (j < 0 || j >= CMS.pageImages.length) return;
          var tmp = CMS.pageImages[i]; CMS.pageImages[i] = CMS.pageImages[j]; CMS.pageImages[j] = tmp;
        }
        renderPageImages();
      });
      pgImages.addEventListener("input", function (e) {
        if (e.target.classList.contains("img-cap")) {
          var i = +e.target.getAttribute("data-cap");
          if (CMS.pageImages[i]) CMS.pageImages[i].caption = e.target.value;
        }
      });
    }
    var pgFile = $("#pg-file");
    if (pgFile) pgFile.addEventListener("change", function () {
      var files = [].slice.call(pgFile.files || []);
      if (!files.length) return;
      $("#pg-img-msg").textContent = files.length + "장 올리는 중…";
      var chain = Promise.resolve();
      files.forEach(function (f) {
        chain = chain.then(function () {
          return uploadSiteImage(f, "pages/new").then(function (url) { addPageImageUrl(url); });
        });
      });
      chain.then(function () {
        pgFile.value = "";
        imgDone("#pg-img-msg", files.length + "장을 올렸습니다. ‘저장’을 누르면 페이지에 반영됩니다.", null);
        var el = $("#pg-img-msg");
        if (el && lastImgStat) el.innerHTML += '<span class="img-stat">' + esc(imgStatText(lastImgStat)) + "</span>";
      }).catch(function (e) {
        pgFile.value = "";
        $("#pg-img-msg").textContent = "업로드 실패: " + (e.message || "알 수 없는 오류");
      });
    });
    var pgUrlAdd = $("#pg-url-add");
    if (pgUrlAdd) pgUrlAdd.addEventListener("click", function () {
      var v = ($("#pg-url").value || "").trim();
      if (!v) { $("#pg-url").focus(); return; }
      addPageImageUrl(v);
      $("#pg-url").value = "";
      $("#pg-img-msg").textContent = "이미지를 추가했습니다. ‘저장’을 누르면 페이지에 반영됩니다.";
    });

    /* --- 게시판 설정 --- */
    var boardNew = $("#board-new");
    if (boardNew) boardNew.addEventListener("click", function () { openBoardEditor(null); });
    ["#board-cancel", "#board-cancel-x"].forEach(function (sel) {
      var n = $(sel); if (n) n.addEventListener("click", closeBoardEditor);
    });
    var boardForm = $("#board-form");
    if (boardForm) boardForm.addEventListener("submit", saveBoard);
    var boardDel = $("#board-delete");
    if (boardDel) boardDel.addEventListener("click", deleteBoard);
    var policySave = $("#board-policy-save");
    if (policySave) policySave.addEventListener("click", saveDefaultPolicy);

    /* --- 회원 등급 · 업무 관리 설정 --- */
    var gradeSave = $("#grade-save");
    if (gradeSave) gradeSave.addEventListener("click", saveGrade);
    var tasksReload = $("#tasks-reload");
    if (tasksReload) tasksReload.addEventListener("click", loadTasksAdmin);
    var adminTq = $("#tasks-admin-q");
    if (adminTq) adminTq.addEventListener("input", renderTasksAdmin);
    var adminTs = $("#tasks-admin-status");
    if (adminTs) adminTs.addEventListener("change", renderTasksAdmin);

    /* --- v2.1: 폼 접수함 --- */
    var ibReload = $("#inbox-reload");
    if (ibReload) ibReload.addEventListener("click", function () { loadInbox(true); });
    var ibCsv = $("#inbox-csv");
    if (ibCsv) ibCsv.addEventListener("click", downloadInboxCsv);
    var ibKind = $("#inbox-kind");
    if (ibKind) ibKind.addEventListener("change", function () { INBOX.kind = ibKind.value; renderInbox(); });
    var ibStatus = $("#inbox-status");
    if (ibStatus) ibStatus.addEventListener("change", function () { INBOX.status = ibStatus.value; renderInbox(); });
    var ibQ = $("#inbox-q");
    if (ibQ) ibQ.addEventListener("input", function () { INBOX.q = (ibQ.value || "").trim().toLowerCase(); renderInbox(); });
    var ibKpis = $("#inbox-kpis");
    if (ibKpis) ibKpis.addEventListener("click", function (e) {
      var li = e.target.closest("[data-k]");
      if (!li) return;
      INBOX.status = li.getAttribute("data-k") || "all";
      if (ibStatus) ibStatus.value = INBOX.status;
      renderInbox();
    });
    [["#inbox-close", closeInbox], ["#inbox-close-x", closeInbox]].forEach(function (pair) {
      var b = $(pair[0]);
      if (b) b.addEventListener("click", pair[1]);
    });
    var inboxModal = $("#inbox-modal");
    if (inboxModal) inboxModal.addEventListener("click", function (e) {
      if (e.target === inboxModal) closeInbox();
    });
    var ibSave = $("#inbox-save");
    if (ibSave) ibSave.addEventListener("click", saveInbox);
    var ibDel = $("#inbox-del");
    if (ibDel) ibDel.addEventListener("click", deleteInbox);
    var fsGo = $("#form-sub-go");
    if (fsGo) fsGo.addEventListener("click", function () { activateTab("inbox"); });

    /* --- v2.1: 백업 · 복원 --- */
    var bkReload = $("#backup-reload");
    if (bkReload) bkReload.addEventListener("click", loadBackupCounts);
    var bkExport = $("#backup-export");
    if (bkExport) bkExport.addEventListener("click", exportBackup);
    var bkFile = $("#backup-file");
    if (bkFile) bkFile.addEventListener("change", function () {
      var f = bkFile.files && bkFile.files[0];
      if (f) inspectBackup(f);
    });
    var bkClear = $("#backup-clear");
    if (bkClear) bkClear.addEventListener("click", clearBackupPick);
    var bkConfirm = $("#backup-confirm");
    if (bkConfirm) bkConfirm.addEventListener("change", function () {
      var run = $("#backup-restore");
      if (run) run.disabled = !(bkConfirm.checked && BACKUP.ok);
    });
    var bkRun = $("#backup-restore");
    if (bkRun) bkRun.addEventListener("click", runBackupRestore);
    var bkCfg = $("#backup-config-dl");
    if (bkCfg) bkCfg.addEventListener("click", function () {
      if (!BACKUP.data || !BACKUP.data.config) {
        cmsMsg("backup-msg", "이 백업 파일에는 설정이 들어 있지 않습니다.", "err");
        return;
      }
      downloadBlob("sbpress.config.json", JSON.stringify(BACKUP.data.config, null, 2));
      cmsMsg("backup-msg", "sbpress.config.json 을 내려받았습니다. 저장소 루트에 올리면 반영됩니다.", "ok");
    });

    /* --- v2.1: 자동 임시저장 배너 --- */
    wireDraftBanner("post");
    wireDraftBanner("page");

    /* --- hunmin 폼 접수 · 검색엔진 피드 --- */
    var sv = $("#feed-sitemap-view");
    if (sv) sv.addEventListener("click", function () { showFeed("sitemap"); });
    var sd = $("#feed-sitemap-dl");
    if (sd) sd.addEventListener("click", function () { downloadFeed("sitemap"); });
    var rv = $("#feed-rss-view");
    if (rv) rv.addEventListener("click", function () { showFeed("rss"); });
    var rd = $("#feed-rss-dl");
    if (rd) rd.addEventListener("click", function () { downloadFeed("rss"); });

    /* --- 휴지통 · 수정 이력 --- */
    var ptt = $("#posts-trash-toggle");
    if (ptt) ptt.addEventListener("click", togglePostsTrash);
    var gtt = $("#page-trash-toggle");
    if (gtt) gtt.addEventListener("click", togglePagesTrash);
    var ph = $("#post-history");
    if (ph) ph.addEventListener("click", function () {
      if (CMS.editing) openHistory("post", CMS.editing.slug || CMS.editing.id, CMS.editing.title);
    });
    var gh = $("#page-history");
    if (gh) gh.addEventListener("click", function () {
      if (CMS.editingPage) openHistory("page", CMS.editingPage.slug, CMS.editingPage.title);
    });
    var revClose = $("#rev-close");
    if (revClose) revClose.addEventListener("click", closeHistory);
    var revBack = $("#rev-drawer");
    if (revBack) revBack.addEventListener("click", function (e) {
      if (e.target === revBack) closeHistory();
    });

    /* --- 테마 프리셋 · 테마 토큰 --- */
    renderThemePicks();
    if ($("#tt-save")) $("#tt-save").addEventListener("click", saveThemeTokens);
    if ($("#tt-reset")) $("#tt-reset").addEventListener("click", resetThemeTokens);
    if ($("#tt-accent")) $("#tt-accent").addEventListener("input", function () {
      if ($("#tt-accent-hex")) $("#tt-accent-hex").value = $("#tt-accent").value.toUpperCase();
      paintTokensPreview(readTokenForm());
    });
    ["tt-accent-hex", "tt-bg", "tt-ink", "tt-radius", "tt-font"].forEach(function (id) {
      var n = $("#" + id);
      if (n) n.addEventListener("input", function () { paintTokensPreview(readTokenForm()); });
      if (n) n.addEventListener("change", function () { paintTokensPreview(readTokenForm()); });
    });

    /* --- 본문 편집기 (툴바·이미지 삽입·미리보기) --- */
    if (window.CRAFT_EDITOR) {
      postEditor = window.CRAFT_EDITOR.mount({
        textarea: $("#pf-body"),
        toolbar: $("#pf-ed-toolbar"),
        format: $("#pf-body_format"),
        preview: $("#pf-preview"),
        previewToggle: $("#pf-preview-toggle"),
        msg: $("#pf-ed-msg"),
        upload: function (file) { return uploadSiteImage(file, "posts/inline"); }
      });
      pageEditor = window.CRAFT_EDITOR.mount({
        textarea: $("#pg-body"),
        toolbar: $("#pg-ed-toolbar"),
        format: $("#pg-body_format"),
        preview: $("#pg-preview"),
        previewToggle: $("#pg-preview-toggle"),
        msg: $("#pg-ed-msg"),
        upload: function (file) { return uploadSiteImage(file, "pages/inline"); }
      });
    }

    /* --- 하위 관리자 --- */
    var adminAdd = $("#admin-add");
    if (adminAdd) adminAdd.addEventListener("click", addAdmin);
    var adminEmail = $("#new-admin-email");
    if (adminEmail) adminEmail.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addAdmin(); }
    });

    /* --- 관리자 검색/필터 --- */
    var pq = $("#posts-q");
    if (pq) pq.addEventListener("input", renderPosts);
    ["#posts-cat", "#posts-state"].forEach(function (sel) {
      var n = $(sel); if (n) n.addEventListener("change", renderPosts);
    });
    var pn = $("#post-new");
    if (pn) pn.addEventListener("click", function () { openPostEditor(null); });
    var form = $("#post-form");
    if (form) form.addEventListener("submit", savePost);
    ["#post-cancel", "#post-cancel-x"].forEach(function (sel) {
      var n = $(sel); if (n) n.addEventListener("click", closePostEditor);
    });
    var del = $("#post-delete");
    if (del) del.addEventListener("click", deletePost);
    var cat = $("#pf-category");
    if (cat) cat.addEventListener("change", function () {
      syncPostFields();
      if (!CMS.editing) $("#pf-sort_order").value = nextSortOrder(cat.value);
    });
    var file = $("#pf-img-file");
    if (file) file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      $("#pf-img-msg").textContent = "올리는 중…";
      uploadSiteImage(f, "posts/" + catPrefix($("#pf-category").value), "#pf-img-msg",
        "업로드 완료 — ‘저장’을 누르면 글이 반영됩니다.").then(function (url) {
        $("#pf-image_url").value = url;
        paintPostPreview(url);
      }).catch(function (e) { $("#pf-img-msg").textContent = "업로드 실패: " + (e.message || "알 수 없는 오류"); });
    });
    var urlInput = $("#pf-image_url");
    if (urlInput) urlInput.addEventListener("change", function () { paintPostPreview(urlInput.value.trim()); });
    var clear = $("#pf-img-clear");
    if (clear) clear.addEventListener("click", function () { $("#pf-image_url").value = ""; paintPostPreview(""); });
    var pubAt = $("#pf-publish_at");
    if (pubAt) pubAt.addEventListener("input", paintPublishHint);
    var pinBox = $("#pf-is_pinned");
    if (pinBox) pinBox.addEventListener("change", function () {
      var hint = $("#pf-publish-hint");
      if (hint && !($("#pf-publish_at").value)) {
        hint.textContent = pinBox.checked
          ? "상단 고정 — 공개 목록 맨 앞에 📌 고정으로 표시됩니다."
          : "비워 두면 저장 즉시 공개됩니다(상태가 ‘발행’일 때).";
      }
    });

    /* --- 미디어 라이브러리 --- */
    var mediaFile = $("#media-file");
    if (mediaFile) mediaFile.addEventListener("change", function () {
      var f = mediaFile.files && mediaFile.files[0];
      if (!f) return;
      cmsMsg("media-msg", "올리는 중… (" + f.name + ")");
      uploadSiteImage(f, "library").then(function (url) {
        var stat = lastImgStat;
        mediaFile.value = "";
        Promise.resolve(loadMedia()).then(function () {
          imgDone("#media-msg", "업로드 완료 — " + url, stat);
        });
      }).catch(function (e) {
        cmsMsg("media-msg", "업로드 실패: " + (e.message || "알 수 없는 오류"), "err");
      });
    });
    var mediaReload = $("#media-reload");
    if (mediaReload) mediaReload.addEventListener("click", loadMedia);
    var mediaQ = $("#media-q");
    if (mediaQ) mediaQ.addEventListener("input", renderMedia);
    var mediaFolder = $("#media-folder");
    if (mediaFolder) mediaFolder.addEventListener("change", renderMedia);
    var cq = $("#cmt-q");
    if (cq) cq.addEventListener("input", renderComments);
    ["#cmt-state", "#cmt-post"].forEach(function (sel) {
      var n = $(sel); if (n) n.addEventListener("change", renderComments);
    });
    var cr = $("#cmt-reload");
    if (cr) cr.addEventListener("click", function () { CMS.loaded.comments = false; loadComments(); });
    /* v2.2 — 이미지 압축 설정 · KO/EN 탭 · 통계 · 구독자 · 뉴스레터 */
    wireV22();
    /* v3.1 — Supabase 사용량 게이지 · 고아 이미지 · 로그/접수 백업 후 정리 */
    wireV31();
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#rev-drawer").hidden) closeHistory();
      else if (!$("#post-modal").hidden) closePostEditor();
      else if (!$("#page-modal").hidden) closePageEditor();
      else if (!$("#board-modal").hidden) closeBoardEditor();
    });
    // 관리자는 로그인 직후 대시보드에서 전체 댓글 수를 볼 수 있게 미리 셉니다.
    if (sb) {
      sb.from("comments").select("id", { count: "exact", head: true }).then(function (r) {
        var el = $("#tab-cmt-count");
        var n = r && r.count != null ? r.count : null;
        if (el && n != null) el.textContent = n ? String(n) : "";
      });
    }
  }

  /* ---------------- 4. 헤더 · 푸터 · Head ---------------- */
  var BRAND_SECTION = "헤더 · 푸터 · Head";
  var GRADE_SECTION = "회원 등급";
  /* 영문 본문 임시 저장(page_en:<slug>)은 화면 문구 슬롯이 아니므로 목록에서 빠집니다. */
  var I18N_SECTION = "i18n";
  var VIEW_TARGETS = ["home", "workshops", "news", "interview", "archive", "info", "map", "tasks"];
  var DEFAULT_MENU = [
    { label: "홈", label_ko: "홈", label_en: "Home", target: "home", visible: true, note: "" },
    { label: "공방 소개", label_ko: "공방 소개", label_en: "Workshops", target: "workshops", visible: true, note: "" },
    { label: "공방 뉴스", label_ko: "공방 뉴스", label_en: "News", target: "news", visible: true, note: "" },
    { label: "작가 인터뷰", label_ko: "작가 인터뷰", label_en: "Interviews", target: "interview", visible: true, note: "" },
    { label: "아카이브", label_ko: "아카이브", label_en: "Archive", target: "archive", visible: true, note: "2024–2026" },
    { label: "지원·공모", label_ko: "지원·공모", label_en: "Grants & Info", target: "info", visible: true, note: "" },
    { label: "지도·게시판", label_ko: "지도·게시판", label_en: "Map", target: "map", visible: true, note: "" },
    { label: "업무 관리", label_ko: "업무 관리", label_en: "Tasks", target: "tasks", visible: true, note: "" }
  ];
  var MENU_EN_DEFAULT = {
    home: "Home", workshops: "Workshops", news: "News", interview: "Interviews",
    archive: "Archive", info: "Grants & Info", map: "Map", tasks: "Tasks"
  };
  var BRAND_FIELDS = [
    ["footer_company_name", "푸터 · 회사명", "#ft-company"],
    ["footer_ceo", "푸터 · 대표자", "#ft-ceo"],
    ["footer_biz_no", "푸터 · 사업자등록번호", "#ft-biz"],
    ["footer_address", "푸터 · 주소", "#ft-address"],
    ["footer_email", "푸터 · 이메일", "#ft-email"],
    ["footer_phone", "푸터 · 전화번호", "#ft-phone"],
    ["footer_copyright", "푸터 · 저작권 문구", "#ft-copy"],
    ["footer_sns_instagram", "SNS · 인스타그램 주소", "#sns-instagram"],
    ["footer_sns_youtube", "SNS · 유튜브 주소", "#sns-youtube"],
    ["footer_sns_blog", "SNS · 블로그 주소", "#sns-blog"],
    ["footer_sns_facebook", "SNS · 페이스북 주소", "#sns-facebook"],
    ["footer_sns_x", "SNS · X(트위터) 주소", "#sns-x"]
  ];
  var BRAND_KEYS = ["header_logo_url", "header_brand_text", "header_menu_items", "custom_head_html"].concat(
    BRAND_FIELDS.map(function (f) { return f[0]; }));

  function normMenu(it) {
    var target = String((it && it.target) || "");
    var ko = String((it && (it.label_ko || it.label)) || "");
    var en = String((it && it.label_en) || "").trim() || MENU_EN_DEFAULT[target] || "";
    return {
      label: ko,
      label_ko: ko,
      label_en: en,
      target: target,
      note: String((it && it.note) || ""),
      visible: !(it && it.visible === false)
    };
  }
  function parseMenu(raw) {
    if (raw) {
      try {
        var a = JSON.parse(raw);
        if (Array.isArray(a) && a.length) return a.map(normMenu);
      } catch (e) { /* 잘못된 JSON 은 기본값으로 */ }
    }
    return DEFAULT_MENU.map(normMenu);
  }

  function paintLogo(url) {
    var box = $("#logo-prev");
    if (!box) return;
    box.innerHTML = url
      ? '<img src="' + esc(url) + '" alt="로고 미리보기">'
      : '<span>기본 마크</span>';
  }

  function paintHeadCount() {
    var el = $("#head-count");
    var ta = $("#head-html");
    if (!el || !ta) return;
    var n = (ta.value || "").length;
    el.textContent = n ? n.toLocaleString("ko-KR") + "자 · 저장하면 사이트 <head> 에 들어갑니다." : "비어 있으면 아무것도 넣지 않습니다.";
  }

  function loadBrand() {
    if (!sb) return Promise.resolve();
    cmsMsg("brand-msg", "불러오는 중…");
    return sb.from("site_contents").select("key,value,image_url").in("key", BRAND_KEYS)
      .then(function (res) {
        if (res.error) { cmsMsg("brand-msg", "불러오지 못했습니다: " + res.error.message, "err"); return; }
        var map = {};
        (res.data || []).forEach(function (r) { map[r.key] = r; });
        var brandRow = map["header_brand_text"];
        var lines = String((brandRow && brandRow.value) || "").replace(/\r/g, "").split("\n");
        var fields = {};
        BRAND_FIELDS.forEach(function (f) { fields[f[0]] = (map[f[0]] && map[f[0]].value) || ""; });
        CMS.brand = {
          logo: (map["header_logo_url"] && map["header_logo_url"].image_url) || "",
          name: (lines[0] || "").trim(),
          sub: (lines[1] || "").trim(),
          menu: parseMenu(map["header_menu_items"] && map["header_menu_items"].value),
          head: (map["custom_head_html"] && map["custom_head_html"].value) || "",
          fields: fields
        };
        CMS.loaded.brand = true;
        renderBrand();
        cmsMsg("brand-msg", "");
        var note = $("#brand-note");
        if (note) note.innerHTML = "Supabase <code>site_contents</code> · 헤더·푸터·head " + BRAND_KEYS.length + "개 항목 · 공개 읽기 / 관리자만 수정";
        var stamp = $("#brand-stamp");
        if (stamp) stamp.textContent = "불러옴 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
      });
  }

  function renderBrand() {
    var B = CMS.brand;
    if (!B) return;
    var url = $("#logo-url");
    if (url) url.value = B.logo || "";
    paintLogo(B.logo || "");
    var nm = $("#brand-name"); if (nm) nm.value = B.name || "";
    var sub = $("#brand-sub"); if (sub) sub.value = B.sub || "";
    BRAND_FIELDS.forEach(function (f) {
      var n = $(f[2]);
      if (n) n.value = (B.fields && B.fields[f[0]]) || "";
    });
    var head = $("#head-html");
    if (head) head.value = B.head || "";
    paintHeadCount();
    renderMenuRows();
  }

  function renderMenuRows() {
    var box = $("#menu-rows");
    if (!box || !CMS.brand) return;
    var list = CMS.brand.menu || [];
    if (!list.length) {
      box.innerHTML = '<p class="cms-hint">메뉴가 없습니다. ‘+ 메뉴 추가’로 추가하세요.</p>';
      return;
    }
    box.innerHTML = list.map(function (it, i) {
      return '<div class="menu-row" data-i="' + i + '">' +
        '<span class="menu-idx" aria-hidden="true">' + (i + 1) + "</span>" +
        '<input class="admin-input menu-label" data-f="label_ko" value="' + esc(it.label_ko || it.label || '') + '" placeholder="메뉴 이름 (한국어)" aria-label="' + (i + 1) + '번째 메뉴 한국어 이름" maxlength="20">' +
        '<input class="admin-input menu-label-en" data-f="label_en" value="' + esc(it.label_en || '') + '" placeholder="Menu name (English)" aria-label="' + (i + 1) + '번째 메뉴 영어 이름" maxlength="30">' +
        '<input class="admin-input menu-target" data-f="target" value="' + esc(it.target) + '" placeholder="home 또는 https://" aria-label="' + (i + 1) + '번째 메뉴 연결 대상" maxlength="200">' +
        '<input class="admin-input menu-note" data-f="note" value="' + esc(it.note) + '" placeholder="작은 표기(선택)" aria-label="' + (i + 1) + '번째 메뉴 작은 표기" maxlength="20">' +
        '<label class="menu-vis"><input type="checkbox" data-f="visible"' + (it.visible !== false ? " checked" : "") + '><span>표시</span></label>' +
        '<span class="menu-btns">' +
          '<button type="button" class="mini" data-move="-1" aria-label="' + (i + 1) + '번째 메뉴 위로"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
          '<button type="button" class="mini" data-move="1" aria-label="' + (i + 1) + '번째 메뉴 아래로"' + (i === list.length - 1 ? " disabled" : "") + ">↓</button>" +
          '<button type="button" class="mini menu-del" data-del="1" aria-label="' + (i + 1) + '번째 메뉴 삭제">삭제</button>' +
        "</span></div>";
    }).join("");
  }

  /* 화면의 메뉴 줄을 모델에 반영합니다(검증 없이). */
  function syncMenuModel() {
    if (!CMS.brand) return;
    var rows = [].slice.call(document.querySelectorAll("#menu-rows .menu-row"));
    if (!rows.length) return;
    CMS.brand.menu = rows.map(function (row) {
      var ko = (row.querySelector('[data-f="label_ko"]').value || "").trim();
      var en = (row.querySelector('[data-f="label_en"]').value || "").trim();
      return {
        label: ko,
        label_ko: ko,
        label_en: en,
        target: (row.querySelector('[data-f="target"]').value || "").trim(),
        note: (row.querySelector('[data-f="note"]').value || "").trim(),
        visible: !!row.querySelector('[data-f="visible"]').checked
      };
    });
  }

  /* 화면에 입력된 값을 그대로 읽어 저장용 객체를 만듭니다. */
  function collectBrand() {
    var B = CMS.brand || {};
    var name = ($("#brand-name").value || "").trim();
    var sub = ($("#brand-sub").value || "").trim();
    var logo = ($("#logo-url").value || "").trim();
    var head = $("#head-html").value || "";
    var fields = {};
    BRAND_FIELDS.forEach(function (f) {
      var n = $(f[2]);
      fields[f[0]] = n ? (n.value || "").trim() : ((B.fields && B.fields[f[0]]) || "");
    });
    var menu = [];
    var rows = [].slice.call(document.querySelectorAll("#menu-rows .menu-row"));
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var label = (row.querySelector('[data-f="label_ko"]').value || "").trim();
      var labelEn = (row.querySelector('[data-f="label_en"]').value || "").trim();
      var target = (row.querySelector('[data-f="target"]').value || "").trim();
      var note = (row.querySelector('[data-f="note"]').value || "").trim();
      var visible = !!row.querySelector('[data-f="visible"]').checked;
      if (!label && !target && !labelEn) continue;            // 빈 줄은 무시
      if (!label) return { error: (i + 1) + "번째 줄에 한국어 메뉴 이름이 없습니다." };
      if (!target) target = "home";
      var isUrl = /^(https?:)?\/\//i.test(target) || /^mailto:/i.test(target);
      var view = target.replace(/^#\/?/, "").replace(/\/$/, "");
      var extra = /^page\/[A-Za-z0-9가-힣._-]+$/.test(view) || /^board\/[A-Za-z0-9가-힣._-]+$/.test(view);
      if (!isUrl && VIEW_TARGETS.indexOf(view) < 0 && !extra) {
        return { error: "‘" + label + "’ 의 연결 대상 \"" + target + "\" 을(를) 알 수 없습니다. " + VIEW_TARGETS.join(" · ") + " 또는 https:// 주소를 넣어 주세요." };
      }
      if (isUrl && target.indexOf("//") === 0) target = "https:" + target;
      menu.push({ label: label, label_ko: label, label_en: labelEn, target: isUrl ? target : view, note: note, visible: visible });
    }
    if (!menu.length) return { error: "메뉴를 최소 한 개는 남겨 주세요." };
    return { name: name, sub: sub, logo: logo, head: head, fields: fields, menu: menu };
  }

  function saveBrand() {
    if (!sb) return;
    var B = collectBrand();
    if (B.error) { cmsMsg("brand-msg", B.error, "err"); return; }
    var brandText = [B.name, B.sub].filter(function (s) { return s !== ""; }).join("\n");
    var rows = [
      { key: "header_logo_url", section: BRAND_SECTION, label: "헤더 로고 이미지 (비우면 기본 마크)", value: "", image_url: B.logo || null },
      { key: "header_brand_text", section: BRAND_SECTION, label: "헤더 브랜드 문구 (첫 줄 이름 / 둘째 줄 작은 글씨)", value: brandText, image_url: null },
      { key: "header_menu_items", section: BRAND_SECTION, label: "헤더 메뉴 (관리자 화면에서 편집)", value: JSON.stringify(B.menu), image_url: null },
      { key: "custom_head_html", section: BRAND_SECTION, label: "<head>에 넣을 코드 (meta · link · script · style)", value: B.head, image_url: null }
    ];
    BRAND_FIELDS.forEach(function (f) {
      rows.push({ key: f[0], section: BRAND_SECTION, label: f[1], value: B.fields[f[0]] || "", image_url: null });
    });
    cmsMsg("brand-msg", "저장하는 중…");
    Promise.all(rows.map(function (r) {
      return sb.from("site_contents").upsert(r, { onConflict: "key" }).then(function (res) {
        if (res.error) throw new Error(r.key + ": " + res.error.message);
        return true;
      });
    })).then(function () {
      CMS.brand = { logo: B.logo, name: B.name, sub: B.sub, menu: B.menu, head: B.head, fields: B.fields };
      cmsMsg("brand-msg", rows.length + "개 항목을 저장했습니다. 사이트를 새로 열면 반영됩니다.", "ok");
      var stamp = $("#brand-stamp");
      if (stamp) stamp.textContent = "저장 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
    }).catch(function (e) {
      cmsMsg("brand-msg", "저장 실패: " + (e.message || "권한을 확인해 주세요."), "err");
    });
  }

  /* ---------------- 7. 회원 등급 · 업무 관리 설정 ---------------- */
  function loadGrade() {
    if (!sb) return Promise.resolve();
    return sb.from("site_contents").select("key,value")
      .in("key", ["grade_1_name", "grade_2_name", "grade_3_name", "tasks.min_grade"])
      .then(function (r) {
        if (r.error) { cmsMsg("grade-msg", "불러오지 못했습니다: " + r.error.message, "err"); return; }
        var map = {};
        (r.data || []).forEach(function (x) { map[x.key] = x.value; });
        [1, 2, 3].forEach(function (g) {
          var v = String(map["grade_" + g + "_name"] || "").trim() || GRADE_DEFAULT[g];
          GRADE_NAMES[g] = v;
          var inp = $("#grade-" + g + "-name");
          if (inp) inp.value = v;
        });
        var mg = String(map["tasks.min_grade"] || "").trim();
        var sel = $("#tasks-min-grade");
        if (sel) sel.value = /^[123]$/.test(mg) ? mg : "1";
        CMS.loaded.grade = true;
        renderMembers();          // 배지 이름을 새 이름으로 다시 그림
      });
  }

  function saveGrade() {
    if (!sb) return;
    var name = function (g) {
      var el = $("#grade-" + g + "-name");
      return ((el && el.value) || "").trim() || GRADE_DEFAULT[g];
    };
    var sel = $("#tasks-min-grade");
    var minG = sel && /^[123]$/.test(sel.value) ? sel.value : "1";
    var rows = [
      { key: "grade_1_name", section: GRADE_SECTION, label: "1단계 이름 (일반회원)", value: name(1), image_url: null },
      { key: "grade_2_name", section: GRADE_SECTION, label: "2단계 이름 (정회원)", value: name(2), image_url: null },
      { key: "grade_3_name", section: GRADE_SECTION, label: "3단계 이름 (특별회원/VIP)", value: name(3), image_url: null },
      { key: "tasks.min_grade", section: GRADE_SECTION, label: "업무 관리 최소 등급 (1·2·3)", value: minG, image_url: null }
    ];
    cmsMsg("grade-msg", "저장하는 중…");
    Promise.all(rows.map(function (r) {
      return sb.from("site_contents").upsert(r, { onConflict: "key" }).then(function (res) {
        if (res.error) throw new Error(r.key + ": " + res.error.message);
        return true;
      });
    })).then(function () {
      GRADE_NAMES[1] = name(1); GRADE_NAMES[2] = name(2); GRADE_NAMES[3] = name(3);
      [1, 2, 3].forEach(function (g) { var inp = $("#grade-" + g + "-name"); if (inp) inp.value = GRADE_NAMES[g]; });
      renderMembers();
      cmsMsg("grade-msg", "등급 설정을 저장했습니다. 업무 관리는 " + gradeName(+minG) + " 이상만 열립니다.", "ok");
    }).catch(function (e) {
      cmsMsg("grade-msg", "저장 실패: " + (e.message || "권한을 확인해 주세요."), "err");
    });
  }

  /* ---------------- 8. 업무 관리 (public.tasks) ---------------- */
  var adminTasks = [];
  var TASK_STATUS = { todo: "할 일", doing: "진행 중", done: "완료" };
  var TASK_PRIO = { low: "낮음", normal: "보통", high: "높음" };

  /* ---------- v10.1 업무 · 결재 Pro (assets/work-pro.js — 탭을 처음 열 때 지연 로딩) ----------
     조직도·반복 업무·템플릿·조건부 결재선·결재–업무 연동·리포트는 work-pro.js 가 그리고,
     스타일(work-pro.css)도 그 파일이 처음 한 번만 받습니다(첫 화면 300KB 예산). */
  var workProPromise = null;

  function loadWorkPro() {
    if (window.CRAFT_WORKPRO) { window.CRAFT_WORKPRO.show(); return Promise.resolve(); }
    if (workProPromise) return workProPromise;
    workProPromise = new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        if (window.CRAFT_WORKPRO) window.CRAFT_WORKPRO.show();
        resolve(window.CRAFT_WORKPRO || null);
      }
      try {
        if (window.SBP && window.SBP.loadScript) window.SBP.loadScript("assets/work-pro.js").then(finish, finish);
        else finish();
      } catch (e) { finish(); }
      setTimeout(finish, 6000);
    });
    return workProPromise;
  }

  function loadTasksAdmin() {
    var body = $("#tasks-admin-table tbody");
    if (!sb || !body) return Promise.resolve();
    body.innerHTML = '<tr class="empty-row"><td colspan="8">불러오는 중…</td></tr>';
    return sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(500).then(function (r) {
      if (r.error) {
        body.innerHTML = '<tr class="empty-row"><td colspan="8">불러오지 못했습니다: ' + esc(r.error.message) + "</td></tr>";
        return;
      }
      adminTasks = r.data || [];
      CMS.loaded.tasks = true;
      renderTasksAdmin();
      var st = $("#tasks-stamp");
      if (st) st.textContent = "전체 " + adminTasks.length + "건";
      var tab = $("#tab-task-count");
      if (tab) tab.textContent = adminTasks.length ? String(adminTasks.length) : "";
    });
  }

  function renderTasksAdmin() {
    var body = $("#tasks-admin-table tbody");
    if (!body) return;
    var q = ($("#tasks-admin-q").value || "").trim().toLowerCase();
    var st = $("#tasks-admin-status").value;
    var rows = adminTasks.filter(function (t) {
      if (st && t.status !== st) return false;
      if (!q) return true;
      return [t.title, t.description, t.assignee, t.author_name].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var tag = $("#tasks-admin-count");
    if (tag) tag.textContent = rows.length === adminTasks.length ? "전체 " + adminTasks.length + "건" : rows.length + " / " + adminTasks.length + "건";
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">' + (adminTasks.length ? "조건에 맞는 업무가 없습니다." : "아직 등록된 업무가 없습니다. 사이트 #/tasks 에서 회원이 추가합니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (t) {
      var opts = Object.keys(TASK_STATUS).map(function (k) {
        return '<option value="' + k + '"' + (t.status === k ? " selected" : "") + ">" + TASK_STATUS[k] + "</option>";
      }).join("");
      return "<tr>" +
        '<td data-th="상태"><select class="admin-select task-status-sel" data-id="' + esc(t.id) + '" aria-label="상태 변경">' + opts + "</select></td>" +
        '<td class="ellip" data-th="제목" title="' + esc(t.title) + '">' + esc(t.title) +
          (t.description ? '<span class="muted">' + esc(String(t.description).slice(0, 60)) + "</span>" : "") + "</td>" +
        '<td data-th="우선순위"><span class="badge b-prio p-' + esc(t.priority) + '">' + esc(TASK_PRIO[t.priority] || t.priority) + "</span></td>" +
        '<td data-th="담당">' + esc(t.assignee || "–") + "</td>" +
        '<td class="muted" data-th="마감">' + esc(t.due_date ? String(t.due_date).slice(0, 10) : "–") + "</td>" +
        '<td class="muted" data-th="작성자">' + esc(t.author_name || "–") + "</td>" +
        '<td class="muted" data-th="수정">' + esc(fmtWhen(t.updated_at || t.created_at)) + "</td>" +
        '<td><button type="button" class="rowlink task-del" data-id="' + esc(t.id) + '">삭제</button></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".task-status-sel"), function (sel) {
      sel.addEventListener("change", function () {
        var id = sel.getAttribute("data-id");
        sb.from("tasks").update({ status: sel.value }).eq("id", id).then(function (r) {
          if (r.error) { cmsMsg("tasks-admin-msg", "바꾸지 못했습니다: " + r.error.message, "err"); return; }
          for (var i = 0; i < adminTasks.length; i++) if (adminTasks[i].id === id) adminTasks[i].status = sel.value;
          renderTasksAdmin();
          cmsMsg("tasks-admin-msg", "업무 상태를 ‘" + (TASK_STATUS[sel.value] || sel.value) + "’(으)로 바꿨습니다.", "ok");
        });
      });
    });
    [].forEach.call(body.querySelectorAll(".task-del"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id");
        var row = null;
        for (var i = 0; i < adminTasks.length; i++) if (adminTasks[i].id === id) row = adminTasks[i];
        if (!window.confirm("‘" + (row ? row.title : "업무") + "’를 삭제할까요?\n되돌릴 수 없습니다.")) return;
        sb.from("tasks").delete().eq("id", id).then(function (r) {
          if (r.error) { cmsMsg("tasks-admin-msg", "삭제하지 못했습니다: " + r.error.message, "err"); return; }
          adminTasks = adminTasks.filter(function (t) { return t.id !== id; });
          renderTasksAdmin();
          var tab = $("#tab-task-count");
          if (tab) tab.textContent = adminTasks.length ? String(adminTasks.length) : "";
          cmsMsg("tasks-admin-msg", "업무를 삭제했습니다.", "ok");
        });
      });
    });
  }

  /* ---------------- 9. 플러그인 · 마켓 (public.plugins) ---------------- */
  var PLUG_SRC = { builtin: "기본", market: "마켓", custom: "직접" };
  var plugRows = [];
  var plugMarket = { base: "", list: [] };
  var plugMarkets = [];                 // v10.4 — 구독 마켓 행
  var plugMarketUrl = "/plugins-market.json";
  var plugV105Missing = false;          // v10.5 — 26_v105 SQL 을 실행하지 않은 DB

  /* ---------- v10.5 — 권한 동의 · SHA-256 무결성 ---------- */
  var V105_COLUMNS = ["integrity", "granted_permissions", "consent_at", "sandbox_mode"];

  function v105ColumnsMissing(err) {
    var code = String((err && err.code) || "");
    var msg = String((err && err.message) || "");
    return (code === "42703" || code === "PGRST204")
      && /integrity|granted_permissions|consent_at|sandbox_mode/i.test(msg);
  }

  function stripKeys(obj, keys) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) { if (keys.indexOf(k) < 0) out[k] = obj[k]; });
    return out;
  }

  /* 동의·무결성을 설치 행에 적을 때 쓰는 칸만 골라냅니다. */
  function consentPayload(consent, item) {
    var out = {};
    if (!consent) return out;
    if (Array.isArray(consent.granted)) out.granted_permissions = consent.granted.slice(0, 12);
    var integ = String((consent && consent.integrity) || (item && item.integrity) || "").trim();
    if (/^sha256-[A-Za-z0-9+/=]{43,44}$/.test(integ)) out.integrity = integ;
    out.consent_at = new Date().toISOString();
    out.sandbox_mode = String((consent && consent.mode) || "strict") === "standard" ? "standard" : "strict";
    return out;
  }

  /* RPC plugin_consent — 동의·무결성을 audit_logs(plugin_consent · plugin_integrity) 까지 남깁니다.
     함수가 없는 DB 면 표에만 적고, 그 열도 없으면 안내만 합니다(설치는 그대로). */
  function recordConsent(id, consent, item, cb) {
    var done = typeof cb === "function" ? cb : function () {};
    if (!consent) { done(""); return; }
    var payload = consentPayload(consent, item);
    function writeRow(reason) {
      if (!sb) { done("Supabase 연결이 없습니다."); return; }
      if (!Object.keys(payload).length) { done(""); return; }
      sb.from("plugins").update(payload).eq("id", id).then(function (r) {
        if (r.error) {
          if (v105ColumnsMissing(r.error)) {
            plugV105Missing = true;
            done("26_v105 SQL 을 실행하면 권한 동의가 서버에 저장됩니다.");
            return;
          }
          done("권한 동의를 저장하지 못했습니다: " + r.error.message);
          return;
        }
        done(reason || "");
      });
    }
    if (!sb) { done("Supabase 연결이 없습니다."); return; }
    if (typeof sb.rpc !== "function") { writeRow(); return; }
    sb.rpc("plugin_consent", {
      p_id: id,
      p_permissions: payload.granted_permissions || [],
      p_integrity: payload.integrity || null,
      p_mode: payload.sandbox_mode || "strict"
    }).then(function (r) {
      if (!r.error) { done(""); return; }
      if (isMissingFn(r.error) || v105ColumnsMissing(r.error)) { writeRow(); return; }
      if (String(r.error.code) === "42501") { done("관리자 권한으로 로그인했는지 확인해 주세요."); return; }
      done("권한 동의를 기록하지 못했습니다: " + r.error.message);
    }, function (err) {
      writeRow((err && err.message) || "");
    });
  }

  /* 「무결성 다시 검사」 — 파일을 다시 해시해 결과를 남깁니다(market.js 가 결과를 넘겨 줍니다). */
  function recheckPlugin(id, rec, cb) {
    var done = typeof cb === "function" ? cb : function () {};
    var p = plugById(id), item = marketItem(id);
    var got = rec || {};
    var state = String(got.state || "");
    var computed = String(got.computed || "");
    var expected = String(got.expected || (item && item.integrity) || (p && p.integrity) || "");
    var ok = state === "ok";
    var text = ok ? "무결성 검사를 통과했습니다."
      : state === "bad" ? "무결성 검사에 실패했습니다 — 파일이 바뀌었을 수 있습니다."
      : "무결성을 확인할 수 없습니다(파일을 읽지 못함·브라우저 제한).";
    function after(msg, res) {
      if (p) {
        if (ok && computed && !p.integrity) p.integrity = computed;
        if (got.checkedAt) p.integrity_checked_at = got.checkedAt;
      }
      try { reloadEngine(); } catch (e) { /* noop */ }
      loadPlugins(false);
      plugMsg(text + (msg ? " " + msg : ""), ok ? "ok" : "err");
      done(ok ? "" : text, res || null);
    }
    if (!sb) { done("Supabase 연결이 없습니다."); return; }
    var value = computed || expected;
    if (typeof sb.rpc !== "function") {
      if (ok && computed && p && !p.integrity) {
        sb.from("plugins").update({ integrity: computed }).eq("id", id).then(function () { after(""); });
      } else after("");
      return;
    }
    sb.rpc("plugin_integrity_check", { p_id: id, p_integrity: value || null, p_ok: ok }).then(function (r) {
      if (!r.error) { after(""); return; }
      if (isMissingFn(r.error) || v105ColumnsMissing(r.error)) {
        if (ok && computed && p && !p.integrity) {
          sb.from("plugins").update({ integrity: computed }).eq("id", id).then(function (r2) {
            after(r2 && r2.error && v105ColumnsMissing(r2.error)
              ? "26_v105 SQL 을 실행하면 검사 결과가 서버에 남습니다." : "");
          });
          return;
        }
        after("26_v105 SQL 을 실행하면 검사 결과가 서버에 남습니다.");
        return;
      }
      after("검사 결과를 저장하지 못했습니다: " + r.error.message);
    }, function (err) { after((err && err.message) || ""); });
  }

  function plugMsg(text, kind) { cmsMsg("plugins-msg", text, kind); }

  /* v10.7 — 설치·켜짐 수를 plugin_stats 에 남깁니다(28_v107 · RPC·폴백은 market.js 가 맡습니다).
     통계는 화면을 막지 않습니다 — 실패해도 설치·제거는 그대로 끝납니다. */
  function countInstall(id, delta, activeDelta) {
    try {
      if (window.SBP_MARKET && window.SBP_MARKET.recordInstall) {
        window.SBP_MARKET.recordInstall(id, delta, activeDelta === undefined ? null : activeDelta, function (err) {
          if (err) plugMsg("설치 수를 서버에 남기지 못했습니다: " + err, "err");
        });
      }
    } catch (e) { /* noop */ }
  }

  function plugById(id) {
    for (var i = 0; i < plugRows.length; i++) if (plugRows[i].id === id) return plugRows[i];
    return null;
  }

  /* v10.3 — 버전 비교(1.2.0 > 1.1.0). 같으면 0, 앞이 크면 1, 뒤가 크면 -1. */
  function plugCmpVer(a, b) {
    function parts(v) {
      var out = [];
      String(v == null ? "" : v).replace(/^v/i, "").split(".").forEach(function (x) {
        var n = parseInt(String(x).replace(/[^0-9].*$/, ""), 10);
        out.push(isFinite(n) ? n : 0);
      });
      while (out.length < 3) out.push(0);
      return out;
    }
    var x = parts(a), y = parts(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) > (y[i] || 0)) return 1;
      if ((x[i] || 0) < (y[i] || 0)) return -1;
    }
    return 0;
  }

  /* 설치본의 지금 상태를 스냅샷으로 — 24_v103 SQL 이 없는 DB 에서 직접 갱신할 때
     서버 함수 plugin_version_snapshot 과 같은 칸을 만듭니다. */
  function pluginSnapshot(p) {
    return {
      version: String((p && p.version) || ""),
      script_url: String((p && p.script_url) || ""),
      manifest: (p && p.manifest && typeof p.manifest === "object") ? p.manifest : {},
      settings_schema: (p && Array.isArray(p.settings_schema)) ? p.settings_schema : [],
      settings: (p && p.settings && typeof p.settings === "object") ? p.settings : {},
      at: new Date().toISOString()
    };
  }

  function pluginHistory(p) {
    return (p && Array.isArray(p.version_history)) ? p.version_history.slice(0, 5) : [];
  }

  function versionColumnsMissing(err) {
    var code = String((err && err.code) || "");
    var msg = String((err && err.message) || "");
    return code === "42703" || code === "PGRST204"
      || /previous_version|previous_script_url|previous_manifest|previous_settings_schema|version_history/i.test(msg);
  }

  function loadPlugins(force) {
    var body = $("#plugin-table tbody");
    if (!sb || !body) return Promise.resolve();
    if (force !== false) body.innerHTML = '<tr class="empty-row"><td colspan="7">불러오는 중…</td></tr>';
    return sb.from("plugins").select("*").order("installed_at", { ascending: true }).then(function (r) {
      if (r.error) {
        body.innerHTML = '<tr class="empty-row"><td colspan="7">불러오지 못했습니다: ' + esc(r.error.message) + "</td></tr>";
        plugMsg("플러그인 목록을 읽지 못했습니다: " + r.error.message, "err");
        return;
      }
      plugRows = r.data || [];
      renderPlugins();
      return sb.from("site_contents").select("key,value").eq("key", "plugins.market_url").then(function (r2) {
        var row = r2 && !r2.error && r2.data && r2.data[0];
        if (row && row.value) plugMarketUrl = String(row.value);
        var inp = $("#plug-market-url");
        if (inp && !inp.value) inp.value = plugMarketUrl;
        renderPlugins();
        return loadMarket();
      });
    });
  }

  function renderPlugins() {
    var body = $("#plugin-table tbody");
    if (!body) return;
    var on = plugRows.filter(function (p) { return p.enabled; }).length;
    var stamp = $("#plugins-stamp");
    if (stamp) stamp.textContent = "설치 " + plugRows.length + "개 · 켜짐 " + on + "개";

    if (!plugRows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7">아직 설치된 플러그인이 없습니다. 아래 <b>플러그인 마켓</b>에서 한 번 눌러 설치해 보세요.</td></tr>';
      renderMarket();
      return;
    }
    body.innerHTML = plugRows.map(function (p) {
      var src = PLUG_SRC[p.source] || p.source || "마켓";
      var cls = PLUG_SRC[p.source] ? p.source : "market";
      var isolated = p.source === "custom";
      var man = (p.manifest && typeof p.manifest === "object") ? p.manifest : {};
      var hooks = Array.isArray(man.hooks) ? man.hooks : [];
      var perms = Array.isArray(man.permissions) ? man.permissions : [];
      var item = marketItem(p.id);
      var newer = !!(item && item.version && plugCmpVer(item.version, p.version || "") > 0);
      var pinned = !!p.pinned_version;
      var schema = pluginSchema(p);
      var prevVer = p.previous_version || (pluginHistory(p)[0] && pluginHistory(p)[0].version) || "";
      /* v10.5 — 무결성·권한 동의 배지 */
      var integ = String(p.integrity || "");
      var granted = Array.isArray(p.granted_permissions) ? p.granted_permissions : [];
      var sandboxed = String(p.sandbox_mode || "") === "standard" ? "표준" : "엄격";
      /* v10.10 — 유료 플러그인의 라이선스 확인 상태(마켓 화면이 기록한 값) */
      var lic = null;
      try { if (window.SBP_MARKET && window.SBP_MARKET.licenseState) lic = window.SBP_MARKET.licenseState(p.id); }
      catch (e) { lic = null; }
      var licLine = (lic && lic.required)
        ? '<i class="plug-tag lic' + (lic.ok ? "" : "-none") + '" title="' +
            esc(lic.ok ? "라이선스 확인됨 · " + String(lic.plan || "") + (lic.key ? " · " + lic.key : "")
                       : "유료 플러그인 — 설치할 때 마켓이 라이선스 키를 확인합니다") + '">' +
            (lic.ok ? "라이선스 " + esc(String(lic.plan || "")) : "라이선스 미확인") + "</i>"
        : "";
      var secLine = '<div class="plug-manifest">' +
        (integ ? '<i class="plug-tag sri" title="' + esc(integ) + '">SHA-256 검증</i>'
               : '<i class="plug-tag sri-bad" title="마켓 JSON 의 integrity 값이 없어 해시 검사를 하지 않습니다.">무결성 없음</i>') +
        (granted.length ? '<i class="plug-tag consent" title="' + esc(granted.join(", ")) + '">권한 ' + granted.length + "개 동의</i>"
                        : '<i class="plug-tag consent-none" title="권한 동의 기록이 없는 예전 설치본입니다. 업데이트하면 동의를 받습니다.">동의 기록 없음</i>') +
        '<i class="plug-tag" title="선언·동의한 권한 밖의 훅 호출을 막는 방식">샌드박스 ' + esc(sandboxed) + "</i>" +
        licLine +
      "</div>";
      return "<tr data-id=\"" + esc(p.id) + "\">" +
        '<td data-th="상태"><label class="plug-switch"><input type="checkbox" data-plug-toggle="' + esc(p.id) + '"' +
          (p.enabled ? " checked" : "") + ' aria-label="' + esc(p.name) + ' 켜기"><span class="plug-slider"></span><em>' +
          (p.enabled ? "켜짐" : "꺼짐") + "</em></label></td>" +
        '<td data-th="플러그인" class="plug-main"><b>' + esc(p.name) + '</b> <span class="muted plug-id">' + esc(p.id) + "</span>" +
          (isolated ? ' <span class="plug-tag" title="직접 올린 외부 JS 는 관리자 세션을 지키기 위해 이 화면에서 실행하지 않습니다.">관리자 화면 격리</span>' : "") +
          (p.description ? '<div class="muted plug-sub">' + esc(p.description) + "</div>" : "") +
          ((hooks.length || perms.length)
            ? '<div class="plug-manifest">' + hooks.map(function (h) { return '<i class="plug-tag">hook · ' + esc(h) + "</i>"; }).join("") +
              perms.map(function (x) { return '<i class="plug-tag perm">' + esc(x) + "</i>"; }).join("") + "</div>"
            : "") +
          secLine + "</td>" +
        '<td data-th="버전" class="muted"><span class="plug-ver">' + esc(p.version || "1.0.0") + "</span>" +
          (pinned ? ' <span class="plug-tag" title="고정된 버전 — 마켓 새 버전이 와도 바꾸지 않습니다.">고정 ' + esc(p.pinned_version) + "</span>" : "") +
          (newer && !pinned ? ' <span class="plug-tag upd" data-plug-updbadge="' + esc(p.id) + '" title="설치된 버전과 마켓 최신 버전">' +
            "업데이트 가능 (v" + esc(p.version) + " → v" + esc(item.version) + ")</span>" : "") +
          (newer && !pinned ? ' <button type="button" class="mini plug-upd" data-plug-update="' + esc(p.id) + '">업데이트</button>' : "") +
          (newer && pinned ? ' <span class="plug-tag" title="버전 고정을 풀어야 업데이트합니다.">업데이트하려면 고정 해제</span>' : "") +
          (prevVer ? ' <span class="plug-tag rb" title="이전 버전으로 되돌릴 수 있습니다.">롤백 v' + esc(prevVer) + "</span>" : "") +
          (schema.length ? ' <span class="plug-tag" title="설정할 수 있는 항목 수">설정 ' + schema.length + "</span>" : "") +
          '</td>' +
        '<td data-th="출처"><span class="plug-badge b-' + cls + '">' + esc(src) + "</span></td>" +
        '<td data-th="JS 주소"><span class="plug-src" title="' + esc(p.script_url) + '">' + esc(p.script_url) + "</span></td>" +
        '<td data-th="설치일" class="muted">' + esc(fmtDate(p.installed_at)) + "</td>" +
        '<td class="plug-act">' +
          (schema.length ? '<button type="button" class="rowlink plug-set" data-plug-settings="' + esc(p.id) + '">설정</button> ' : "") +
          (prevVer ? '<button type="button" class="rowlink plug-roll" data-plug-rollback="' + esc(p.id) + '">이전 버전으로 되돌리기</button> ' : "") +
          '<button type="button" class="rowlink plug-recheck" data-plug-recheck="' + esc(p.id) + '">무결성 다시 검사</button> ' +
          '<button type="button" class="rowlink plug-pin" data-plug-pin="' + esc(p.id) + '" aria-pressed="' + (pinned ? "true" : "false") + '">' +
            (pinned ? "고정 해제" : "버전 고정") + "</button> " +
          '<button type="button" class="rowlink plug-del" data-id="' + esc(p.id) + '">삭제</button></td>' +
        "</tr>";
    }).join("");

    [].forEach.call(body.querySelectorAll("[data-plug-toggle]"), function (cb) {
      cb.addEventListener("change", function () {
        setPluginEnabled(cb.getAttribute("data-plug-toggle"), cb.checked, cb);
      });
    });
    [].forEach.call(body.querySelectorAll(".plug-del"), function (b) {
      b.addEventListener("click", function () { deletePlugin(b.getAttribute("data-id")); });
    });
    [].forEach.call(body.querySelectorAll("[data-plug-pin]"), function (b) {
      b.addEventListener("click", function () { pinPlugin(b.getAttribute("data-plug-pin")); });
    });
    [].forEach.call(body.querySelectorAll("[data-plug-update]"), function (b) {
      b.addEventListener("click", function () { updatePlugin(b.getAttribute("data-plug-update"), b); });
    });
    [].forEach.call(body.querySelectorAll("[data-plug-rollback]"), function (b) {
      b.addEventListener("click", function () { openPluginRollback(b.getAttribute("data-plug-rollback")); });
    });
    [].forEach.call(body.querySelectorAll("[data-plug-settings]"), function (b) {
      b.addEventListener("click", function () { openPluginSettings(b.getAttribute("data-plug-settings")); });
    });
    [].forEach.call(body.querySelectorAll("[data-plug-recheck]"), function (b) {
      b.addEventListener("click", function () { runPluginRecheck(b.getAttribute("data-plug-recheck"), b); });
    });
    renderMarket();
  }

  /* ---------- v10.2 플러그인 설정 — 저장된 값·스키마 ----------
     스키마는 DB(settings_schema)에 있고, 예전에 설치한 행은 마켓 목록(plugins-market.json)의
     스키마를 씁니다. 화면은 그 스키마로 입력 폼을 자동으로 그립니다(assets/market.js). */
  /* 설치 목록의 「무결성 다시 검사」 — 엔진이 다시 해시하고, 결과를 서버에 남깁니다. */
  function runPluginRecheck(id, btn) {
    var p = plugById(id);
    if (!p) return;
    if (btn) { btn.disabled = true; }
    function finish() { if (btn) { btn.disabled = false; } }
    if (!window.SBPress || typeof window.SBPress.recheckIntegrity !== "function") {
      finish();
      plugMsg("플러그인 엔진을 불러오지 못해 검사하지 못했습니다. 새로고침해 주세요.", "err");
      return;
    }
    window.SBPress.recheckIntegrity(id, function (err, rec) {
      if (err) { finish(); plugMsg("무결성을 검사하지 못했습니다: " + err, "err"); return; }
      recheckPlugin(id, rec, function () { finish(); });
    });
  }

  function pluginSchema(p) {
    if (p && Array.isArray(p.settings_schema) && p.settings_schema.length) return p.settings_schema;
    var item = marketItem(p ? p.id : "");
    if (item && Array.isArray(item.settings_schema) && item.settings_schema.length) return item.settings_schema;
    return [];
  }

  function openPluginSettings(id) {
    var box = $("#plug-market");
    if (box && box.__sbpMarket) {
      try { window.SBP_MARKET.openSettings(id); } catch (e) { /* 아래에서 다시 시도 */ }
      return;
    }
    ensureMarketUi().then(function (UI) {
      if (!UI || !UI.openSettings) { plugMsg("설정 화면을 불러오지 못했습니다. 새로고침해 주세요.", "err"); return; }
      var host = $("#plug-market");
      var inst = host && host.__sbpMarket;
      if (inst) UI.openSettings(id);
      else plugMsg("플러그인 마켓을 먼저 불러와야 설정을 열 수 있습니다.", "err");
    });
  }

  function settingsErrorText(err) {
    var code = String((err && err.code) || "");
    var msg = String((err && err.message) || err || "");
    if (code === "42883" || code === "PGRST202" || /Could not find the function|does not exist/i.test(msg)) {
      return "Supabase 에 supabase/23_v102_plugin_settings.sql 을 실행한 뒤 다시 시도해 주세요.";
    }
    if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
      return "관리자 권한으로 로그인했는지 확인해 주세요.";
    }
    return msg || "알 수 없는 오류";
  }

  function isMissingFn(err) {
    var code = String((err && err.code) || "");
    var msg = String((err && err.message) || "");
    return code === "42883" || code === "PGRST202" || /Could not find the function/i.test(msg);
  }

  /* 설정 저장 — ① 23_v102 SQL 의 plugin_save_settings RPC(서버 검사) →
     ② 함수가 없는 예전 DB 면 표를 직접 갱신(RLS 가 관리자만 허용) → 셋 다 안 되면 안내. */
  function savePluginSettings(id, values, cb) {
    var p = plugById(id);
    var item = marketItem(id);
    var schema = pluginSchema(p);
    var done = function (err, saved) { if (typeof cb === "function") cb(err || null, saved || {}); };
    function reportSaved(saved) {
      if (p) p.settings = saved;
      plugMsg("‘" + (p ? p.name : id) + "’ 설정을 저장했습니다. 사이트에 바로 반영됩니다.", "ok");
      done(null, saved);
    }
    function fallback() {
      var patch = { settings: values || {} };
      if (schema.length && p && p.settings_schema !== undefined) patch.settings_schema = schema;
      sb.from("plugins").update(patch).eq("id", id).then(function (r) {
        if (r.error) {
          var text = settingsErrorText(r.error);
          plugMsg("설정을 저장하지 못했습니다: " + text, "err");
          done(text, null);
          return;
        }
        reportSaved(patch.settings);
      });
    }
    if (!sb) { var no = "Supabase 연결이 없습니다."; plugMsg(no, "err"); done(no, null); return; }
    if (typeof sb.rpc !== "function") { fallback(); return; }
    sb.rpc("plugin_save_settings", { p_id: id, p_settings: values || {} }).then(function (r) {
      if (r.error) {
        if (isMissingFn(r.error)) { fallback(); return; }
        var text = settingsErrorText(r.error);
        plugMsg("설정을 저장하지 못했습니다: " + text, "err");
        done(text, null);
        return;
      }
      var saved = (r.data && r.data.settings && typeof r.data.settings === "object") ? r.data.settings : (values || {});
      reportSaved(saved);
    });
  }

  function marketItem(id) {
    var list = plugMarket.list || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }

  /* 버전 고정 — 고정한 버전은 마켓의 새 버전으로 바꿀 수 없습니다. */
  function pinPlugin(id) {
    var p = plugById(id);
    if (!p || !sb) return;
    var on = !p.pinned_version;
    sb.from("plugins").update({ pinned_version: on ? (p.version || "1.0.0") : null }).eq("id", id).then(function (r) {
      if (r.error) { plugMsg("버전을 고정하지 못했습니다: " + r.error.message, "err"); return; }
      p.pinned_version = on ? (p.version || "1.0.0") : null;
      renderPlugins();
      plugMsg(on ? "‘" + p.name + "’ v" + p.pinned_version + " 을 고정했습니다. 마켓에 새 버전이 와도 바꾸지 않습니다."
                : "‘" + p.name + "’ 버전 고정을 풀었습니다.", "ok");
    });
  }

  /* 마켓 새 버전으로 업데이트 — 설치 때와 같은 검사(주소·코드)를 거칩니다.
     · ① 24_v103 SQL 의 plugin_update_from_market RPC — 지금 버전을 스냅샷에 보관합니다.
     · ② 함수가 없는 예전 DB 면 표를 직접 갱신하며 이력(version_history)을 화면에서 만듭니다.
     · ③ previous_*·version_history 열도 없는 DB 면 그 열만 빼고 갱신합니다(보관 없이, 롤백 불가). */
  function updatePlugin(id, btn, cb, consent) {
    var p = plugById(id), item = marketItem(id);
    var done = function (err, res) { if (typeof cb === "function") cb(err || null, res || null); };
    if (!p || !item) { done("플러그인을 찾지 못했습니다: " + id); return; }
    if (!sb) { done("Supabase 연결이 없습니다."); return; }
    if (p.pinned_version) {
      var pinText = "‘" + p.name + "’ 은 v" + p.pinned_version + " 으로 고정되어 있습니다. 고정을 풀고 다시 시도해 주세요.";
      plugMsg(pinText, "err");
      done(pinText);
      return;
    }
    var target = String(item.version || p.version || "1.0.0");
    if (plugCmpVer(target, p.version || "") <= 0) {
      plugMsg("‘" + p.name + "’ 은 이미 v" + (p.version || target) + " 입니다. 마켓에 더 새 버전이 없습니다.", "ok");
      done(null, { version: p.version || target, unchanged: true });
      return;
    }
    var url = marketAbs(item.script_url);
    var safe = (window.SBPress && window.SBPress.safeScriptUrl) ? window.SBPress.safeScriptUrl(url) : url;
    if (!safe) { done("이 플러그인의 주소가 https:// 또는 / 가 아니어서 업데이트하지 않았습니다."); return; }
    if (btn) { btn.disabled = true; btn.textContent = "업데이트하는 중…"; }
    verifyPluginFile(url, function (scan) {
      if (!scan.ok) {
        if (btn) { btn.disabled = false; btn.textContent = "업데이트"; }
        var bad = "위험한 코드가 있어 업데이트하지 않았습니다: " + scan.reasons.join(", ");
        plugMsg(bad, "err");
        done(bad);
        return;
      }
      var patch = {
        version: target, script_url: url,
        manifest: manifestPayload(item), description: item.description || p.description || null,
        author: item.author || p.author || null,
        settings_schema: settingsSchemaPayload(item)
      };
      /* v10.5 — 동의한 권한·무결성·샌드박스를 함께 적습니다. */
      var secPatch = consentPayload(consent, item);
      Object.keys(secPatch).forEach(function (k) { patch[k] = secPatch[k]; });
      var before = String(p.version || "");
      function settle(res, noHistory) {
        if (btn) { btn.disabled = false; btn.textContent = "업데이트"; }
        var v = (res && res.version) ? res.version : target;
        if (p) {
          p.version = v;
          p.script_url = url;
          p.manifest = patch.manifest;
          if (res && res.previous_version) p.previous_version = res.previous_version;
          if (res && Array.isArray(res.version_history)) p.version_history = res.version_history;
          if (consent) {
            if (Array.isArray(consent.granted)) p.granted_permissions = consent.granted.slice(0, 12);
            if (patch.integrity) p.integrity = patch.integrity;
            if (patch.consent_at) p.consent_at = patch.consent_at;
            if (patch.sandbox_mode) p.sandbox_mode = patch.sandbox_mode;
          }
        }
        if (consent) {
          recordConsent(id, consent, item, function (msg) {
            if (msg) plugMsg("동의 기록: " + msg, "err");
          });
        }
        reloadEngine();
        loadPlugins(false);
        plugMsg("‘" + p.name + "’ 을 v" + before + " 에서 v" + v + " 으로 업데이트했습니다." +
                (noHistory ? " (이전 버전 보관은 24_v103 SQL 을 실행하면 켜집니다)" : "") +
                " 사이트를 새로고침하면 반영됩니다.", "ok");
        done(null, res || { version: v });
      }
      function fail(err) {
        if (btn) { btn.disabled = false; btn.textContent = "업데이트"; }
        var text = settingsErrorText(err);
        plugMsg("업데이트하지 못했습니다: " + text, "err");
        done(text);
      }
      function fallback() {
        var snap = pluginSnapshot(p);
        var hist = [snap].concat(pluginHistory(p)).slice(0, 5);
        var full = {};
        Object.keys(patch).forEach(function (k) { full[k] = patch[k]; });
        full.previous_version = before || null;
        full.previous_script_url = p.script_url || null;
        full.previous_manifest = snap.manifest;
        full.previous_settings_schema = snap.settings_schema;
        full.version_history = hist;
        sb.from("plugins").update(full).eq("id", id).then(function (r) {
          if (!r.error) {
            settle({ version: target, previous_version: before, version_history: hist }, false);
            return;
          }
          if (versionColumnsMissing(r.error)) {
            /* ③ 버전 열이 아예 없는 DB — 보관 없이 업데이트만 합니다. */
            sb.from("plugins").update(stripKeys(patch, V105_COLUMNS)).eq("id", id).then(function (r2) {
              if (r2.error) { fail(r2.error); return; }
              p.previous_version = null;
              p.version_history = [];
              settle({ version: target }, true);
            });
            return;
          }
          /* v10.5 — 무결성·동의 열이 없는 DB 면 그 네 칸만 빼고 업데이트합니다. */
          if (v105ColumnsMissing(r.error)) {
            plugV105Missing = true;
            sb.from("plugins").update(stripKeys(full, V105_COLUMNS)).eq("id", id).then(function (r3) {
              if (r3.error) {
                if (versionColumnsMissing(r3.error)) {
                  sb.from("plugins").update(stripKeys(patch, V105_COLUMNS)).eq("id", id).then(function (r4) {
                    if (r4.error) { fail(r4.error); return; }
                    p.previous_version = null;
                    p.version_history = [];
                    settle({ version: target }, true);
                  });
                  return;
                }
                fail(r3.error);
                return;
              }
              settle({ version: target, previous_version: before, version_history: hist }, false);
            });
            return;
          }
          fail(r.error);
        });
      }
      var rpc = (typeof sb.rpc === "function")
        ? sb.rpc("plugin_update_from_market", {
            p_id: id, p_version: target, p_script_url: url,
            p_manifest: patch.manifest, p_settings_schema: patch.settings_schema
          })
        : Promise.resolve({ error: { code: "42883", message: "plugin_update_from_market 없음" } });
      rpc.then(function (r) {
        if (!r.error) {
          var res = (r.data && typeof r.data === "object") ? r.data : {};
          if (!res.version) res.version = target;
          if (!res.previous_version) res.previous_version = before;
          settle(res, false);
          return;
        }
        if (isMissingFn(r.error)) { fallback(); return; }
        fail(r.error);
      });
    });
  }

  /* 여러 플러그인을 차례로 업데이트합니다(마켓 상단 「전체 업데이트」). */
  function updateAllPlugins(ids, cb) {
    var list = (ids || []).slice();
    /* v10.5 — 새 권한이 생긴 플러그인은 한 번에 업데이트하지 않습니다(동의가 필요).
       카드에서 하나씩 「동의하고 업데이트」로 처리하도록 건너뛰고 알려 줍니다. */
    var skipped = [];
    list = list.filter(function (id) {
      var p = plugById(id), item = marketItem(id);
      if (!p || !item) return true;
      var man = (p.manifest && Array.isArray(p.manifest.permissions)) ? p.manifest.permissions : [];
      var perms = Array.isArray(item.permissions) ? item.permissions
        : ((item.manifest && Array.isArray(item.manifest.permissions)) ? item.manifest.permissions : []);
      var fresh = perms.filter(function (x) { return man.indexOf(x) < 0; });
      if (fresh.length) { skipped.push(id); return false; }
      return true;
    });
    var i = 0, okCount = 0, failed = 0;
    function step() {
      if (i >= list.length) {
        if (typeof cb === "function") cb(null, { updated: okCount, failed: failed, ids: list, skipped: skipped });
        return;
      }
      var id = list[i++];
      updatePlugin(id, null, function (err) {
        if (err) failed += 1; else okCount += 1;
        setTimeout(step, 150);
      });
    }
    if (!list.length) {
      if (typeof cb === "function") cb(null, { updated: 0, failed: 0, ids: [], skipped: skipped });
      return;
    }
    step();
  }

  /* 직전 스냅샷으로 되돌리기 — 확인 UI 는 마켓 상세 모달(market.js)이 그립니다. */
  function rollbackPlugin(id, cb) {
    var p = plugById(id);
    var done = function (err, res) { if (typeof cb === "function") cb(err || null, res || null); };
    if (!p) { done("플러그인을 찾지 못했습니다: " + id); return; }
    if (!sb) { done("Supabase 연결이 없습니다."); return; }
    var hist = pluginHistory(p);
    var prev = String(p.previous_version || (hist[0] && hist[0].version) || "");
    if (!prev) { done("되돌릴 이전 버전이 없습니다."); return; }
    var before = String(p.version || "");
    function settle(res) {
      var v = (res && res.version) ? res.version : prev;
      if (p) {
        p.version = v;
        if (res && res.script_url) p.script_url = res.script_url;
        if (res && Array.isArray(res.version_history)) {
          p.version_history = res.version_history;
          p.previous_version = (res.version_history[0] && res.version_history[0].version) || null;
        } else {
          p.version_history = hist.slice(1);
          p.previous_version = (hist[1] && hist[1].version) || null;
        }
      }
      reloadEngine();
      loadPlugins(false);
      plugMsg("‘" + p.name + "’ 을 v" + before + " 에서 v" + v + " 로 되돌렸습니다. 사이트를 새로고침하면 반영됩니다.", "ok");
      done(null, res || { version: v });
    }
    function fail(err) { done(settingsErrorText(err)); }
    function fallback() {
      var snap = hist[0] || {
        version: p.previous_version, script_url: p.previous_script_url,
        manifest: p.previous_manifest, settings_schema: p.previous_settings_schema,
        settings: p.settings
      };
      var rest = hist.slice(1);
      var head = rest[0] || {};
      var patch = {
        version: snap.version || prev,
        script_url: snap.script_url || p.script_url,
        manifest: snap.manifest || {},
        settings_schema: Array.isArray(snap.settings_schema) ? snap.settings_schema : [],
        version_history: rest,
        previous_version: head.version || null,
        previous_script_url: head.script_url || null,
        previous_manifest: head.manifest || null,
        previous_settings_schema: head.settings_schema || null
      };
      sb.from("plugins").update(patch).eq("id", id).then(function (r) {
        if (r.error) {
          if (versionColumnsMissing(r.error)) {
            done("이전 버전을 보관하지 않는 DB 입니다. Supabase 에 supabase/24_v103_plugin_versions.sql 을 실행한 뒤 다시 시도해 주세요.");
            return;
          }
          fail(r.error);
          return;
        }
        settle({ version: patch.version, script_url: patch.script_url, version_history: rest });
      });
    }
    var rpc = (typeof sb.rpc === "function")
      ? sb.rpc("plugin_rollback", { p_id: id })
      : Promise.resolve({ error: { code: "42883", message: "plugin_rollback 없음" } });
    rpc.then(function (r) {
      if (!r.error) {
        var res = (r.data && typeof r.data === "object") ? r.data : {};
        if (!res.version) res.version = prev;
        settle(res);
        return;
      }
      if (isMissingFn(r.error)) { fallback(); return; }
      fail(r.error);
    });
  }

  /* 설치 목록의 「이전 버전으로 되돌리기」 — 확인 UI 는 마켓 상세 모달에서 엽니다. */
  function openPluginRollback(id) {
    var box = $("#plug-market");
    if (box && box.__sbpMarket) {
      try { window.SBP_MARKET.openRollback(id); } catch (e) { /* 아래에서 다시 시도 */ }
      return;
    }
    ensureMarketUi().then(function (UI) {
      if (!UI || !UI.openRollback) {
        plugMsg("플러그인 마켓을 먼저 불러와야 이전 버전으로 되돌릴 수 있습니다.", "err");
        return;
      }
      UI.openRollback(id);
    });
  }

  /* 설치·업데이트 전에 파일을 받아 코드를 검사합니다(위험 코드·registerPlugin 확인). */
  function verifyPluginFile(url, cb) {
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      var scan = (window.SBPress && window.SBPress.scanSource)
        ? window.SBPress.scanSource(text) : { ok: true, reasons: [] };
      if (scan.ok && !/registerPlugin\s*\(/.test(text)) {
        scan = { ok: false, reasons: ["SBPress.registerPlugin 호출 없음"] };
      }
      cb(scan);
    }).catch(function (e) {
      cb({ ok: false, reasons: ["파일을 읽지 못했습니다: " + (e && e.message ? e.message : e)] });
    });
  }

  function manifestPayload(item) {
    var m = (item && item.manifest && typeof item.manifest === "object") ? item.manifest : {};
    /* v10.5 — 마켓 화면이 넘긴 항목은 normalize 를 거쳐 hooks·permissions 가 위층에 있습니다.
       (예전에는 item.manifest 만 보아 업데이트 때 권한이 빈 배열로 덮였습니다.) */
    var hooks = Array.isArray(m.hooks) ? m.hooks : (Array.isArray(item && item.hooks) ? item.hooks : []);
    var perms = Array.isArray(m.permissions) ? m.permissions
      : (Array.isArray(item && item.permissions) ? item.permissions : []);
    return {
      v: 1,
      name: (item && (item.name || item.id)) || "",
      version: (item && item.version) || "1.0.0",
      author: (item && item.author) || "",
      hooks: hooks.slice(0, 12),
      permissions: perms.slice(0, 12)
    };
  }

  /* v10.2 — 마켓 목록의 설정 스키마를 DB(settings_schema)에 옮겨 담습니다(서버가 다시 검사·정리). */
  function settingsSchemaPayload(item) {
    var list = (item && Array.isArray(item.settings_schema)) ? item.settings_schema : [];
    return list.filter(function (f) { return f && typeof f === "object" && f.key; }).slice(0, 40);
  }

  function setPluginEnabled(id, on, cb) {
    if (!sb) return;
    var label = cb ? cb.parentNode.querySelector("em") : null;
    sb.from("plugins").update({ enabled: !!on }).eq("id", id).then(function (r) {
      if (r.error) {
        if (cb) cb.checked = !on;
        plugMsg("바꾸지 못했습니다: " + r.error.message, "err");
        return;
      }
      var p = plugById(id);
      if (p) p.enabled = !!on;
      if (label) label.textContent = on ? "켜짐" : "꺼짐";
      /* 켠 플러그인은 이 관리자 화면에도 바로 불러와 탭·위젯을 붙입니다(끄기는 새로고침 후 반영). */
      if (on) reloadEngine();
      plugMsg("‘" + (p ? p.name : id) + "’를 " + (on ? "켰습니다" : "껐습니다") + ". 사이트를 새로고침하면 반영됩니다.", "ok");
      countInstall(id, 0, on ? 1 : -1);
      var stampOn = plugRows.filter(function (x) { return x.enabled; }).length;
      var stamp = $("#plugins-stamp");
      if (stamp) stamp.textContent = "설치 " + plugRows.length + "개 · 켜짐 " + stampOn + "개";
      renderMarket();
    });
  }

  /* 플러그인 엔진에 새 설치를 알려, 관리자 화면에도 탭·위젯이 바로 붙게 합니다. */
  function reloadEngine() {
    try { if (window.SBPress && window.SBPress.load) window.SBPress.load(true); } catch (e) { /* noop */ }
  }

  function deletePlugin(id) {
    var p = plugById(id);
    if (!window.confirm("‘" + (p ? p.name : id) + "’ 플러그인을 제거할까요?\n사이트에서도 바로 빠집니다.")) return;
    sb.from("plugins").delete().eq("id", id).then(function (r) {
      if (r.error) { plugMsg("제거하지 못했습니다: " + r.error.message, "err"); return; }
      plugRows = plugRows.filter(function (x) { return x.id !== id; });
      renderPlugins();
      countInstall(id, -1);
      plugMsg("‘" + (p ? p.name : id) + "’ 플러그인을 제거했습니다.", "ok");
    });
  }

  /* 플러그인 저장 — 없으면 넣고, 같은 ID가 있으면 갱신합니다.
     settings_schema 열이 없는 예전 DB(23_v102 미실행)면 그 열만 빼고 다시 시도합니다. */
  function savePluginRow(payload) {
    return sb.from("plugins").insert(payload).then(function (r) {
      if (!r.error) return r;
      var code = r.error.code || "";
      var msg = r.error.message || "";
      if (code === "23505" || /duplicate key|already exists/i.test(msg)) {
        return sb.from("plugins").update(payload).eq("id", payload.id);
      }
      /* v10.4 — market_id 열이 없는 DB(25_v104 미실행)면 그 열만 빼고 다시 시도합니다. */
      var noMarket = (code === "42703" || code === "PGRST204") && /market_id/i.test(msg) && "market_id" in payload;
      if (noMarket) {
        var p2 = {};
        Object.keys(payload).forEach(function (k) { if (k !== "market_id") p2[k] = payload[k]; });
        return savePluginRow(p2);
      }
      /* v10.5 — 무결성·권한 동의 열이 없는 DB(26_v105 미실행)면 그 네 칸만 빼고 다시 시도합니다. */
      if (v105ColumnsMissing(r.error) && V105_COLUMNS.some(function (k) { return k in payload; })) {
        plugV105Missing = true;
        return savePluginRow(stripKeys(payload, V105_COLUMNS));
      }
      if ((code === "42703" || code === "PGRST204" || /settings_schema/i.test(msg)) && "settings_schema" in payload) {
        var slim = {};
        Object.keys(payload).forEach(function (k) { if (k !== "settings_schema") slim[k] = payload[k]; });
        return sb.from("plugins").insert(slim).then(function (r2) {
          if (!r2.error) return r2;
          if ((r2.error.code === "23505" || /duplicate key|already exists/i.test(r2.error.message || ""))) {
            return sb.from("plugins").update(slim).eq("id", payload.id);
          }
          return r2;
        });
      }
      return r;
    });
  }

  function installCustom() {
    var id = ($("#plug-id").value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    var name = ($("#plug-name").value || "").trim();
    var url = ($("#plug-url").value || "").trim();
    var desc = ($("#plug-desc").value || "").trim();
    var note = $("#plug-form-msg");
    if (!id || !name || !url) { if (note) note.textContent = "ID·이름·JS URL 은 꼭 필요합니다."; return; }
    /* 보안(v1.3): https:// 또는 사이트 안 경로(/)만. http://·javascript:·data: 는 DB CHECK 가 최종 거부합니다. */
    if (!/^https:\/\//i.test(url) && url.charAt(0) !== "/") {
      if (note) note.textContent = /^http:\/\//i.test(url)
        ? "http:// 주소는 받지 않습니다. https:// 로 바꾸거나 사이트 안 경로(/assets/…)를 넣어 주세요."
        : "JS URL 은 https:// 주소나 사이트 안 경로(/assets/…)로 넣어 주세요(javascript:·data: 는 막힙니다).";
      return;
    }
    if (note) note.textContent = "설치하는 중…";
    verifyPluginFile(url, function (scan) {
      if (!scan.ok) {
        if (note) note.textContent = "설치하지 않았습니다 — " + scan.reasons.join(", ");
        plugMsg("위험한 코드가 있거나 플러그인 형식이 아니라서 설치하지 않았습니다: " + scan.reasons.join(", "), "err");
        return;
      }
      savePluginRow({
        id: id, name: name, version: "1.0.0", description: desc || null,
        script_url: url, source: "custom", enabled: true,
        manifest: { v: 1, name: name, version: "1.0.0", author: "", hooks: [], permissions: [] }
      }).then(function (r) {
        if (r && r.error) {
          if (note) note.textContent = "설치하지 못했습니다: " + r.error.message;
          return;
        }
        $("#plug-id").value = ""; $("#plug-name").value = ""; $("#plug-url").value = ""; $("#plug-desc").value = "";
        if (note) note.textContent = "설치하고 켰습니다: " + name + " — 사이트를 새로고침해 확인하세요.";
        plugMsg("‘" + name + "’ 플러그인을 설치했습니다.", "ok");
        reloadEngine();
        loadPlugins(false);
      });
    });
  }

  function testPluginUrl() {
    var url = ($("#plug-url").value || "").trim();
    var note = $("#plug-form-msg");
    if (!url) { if (note) note.textContent = "확인할 JS URL 을 먼저 넣어 주세요."; return; }
    if (note) note.textContent = "주소를 확인하는 중…";
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (t) {
      var okReg = /registerPlugin\s*\(/.test(t);
      if (note) note.textContent = okReg
        ? "플러그인 파일로 보입니다(" + Math.round(t.length / 1024) + "KB, SBPress.registerPlugin 호출 확인)."
        : "파일은 열리지만 SBPress.registerPlugin 호출이 보이지 않습니다. 설치해도 동작하지 않을 수 있습니다.";
    }).catch(function (e) {
      if (note) note.textContent = "주소를 브라우저에서 읽지 못했습니다: " + e.message + " (CORS·404 확인)";
    });
  }

  function marketAbs(url) {
    try {
      var u = new URL(url, new URL(plugMarketUrl, location.href).href);
      /* 사이트 안 주소는 경로만 남깁니다. http://… 로 굳으면 v1.3 규칙(https:// 또는 /)에 걸리고,
         주소를 바꿔도 플러그인이 따라 움직이지 않습니다. */
      if (u.origin === location.origin) return u.pathname + u.search + u.hash;
      return u.href;
    } catch (e) { return url; }
  }

  function loadMarket() {
    var box = $("#plug-market");
    if (!box) return Promise.resolve();
    box.innerHTML = '<p class="plug-empty">마켓 목록을 불러오는 중…</p>';
    var msg = $("#plug-market-msg");
    return loadMarketRows().then(function (rows) {
      plugMarkets = rows;
      if (msg) {
        msg.textContent = plugMarketRowsMissing
          ? "마켓 " + rows.length + "곳 · 이 브라우저에만 기억 — Supabase 에 supabase/25_v104_multimarket_blocks.sql 을 실행하면 서버에 저장됩니다"
          : "마켓 " + rows.length + "곳 · 켜짐 " + rows.filter(function (r) { return r.enabled !== false; }).length + "곳";
      }
      return Promise.all(rows.map(fetchMarketJson));
    }).then(function () {
      var merged = mergeMarketList();
      plugMarket = { base: marketAbs(plugMarketUrl), list: merged.plugins, meta: merged.meta,
                     markets: plugMarkets, duplicates: merged.duplicates };
      renderPlugins();
      renderMarket();
    }).catch(function (e) {
      plugMarket = { base: marketAbs(plugMarketUrl), list: [], meta: {}, markets: plugMarkets, duplicates: 0 };
      box.innerHTML = '<p class="plug-empty">마켓 목록을 불러오지 못했습니다: ' + esc(e && e.message ? e.message : e) + "</p>";
      if (msg) msg.textContent = "주소를 확인해 주세요: " + plugMarketUrl;
    });
  }

  /* ---------- v10.4 — 구독 마켓 (public.plugin_markets) ----------
     25_v104 SQL 을 실행하지 않은 DB 에서는 표가 없으므로(42P01)
     site_contents 의 기본 주소 + 브라우저 localStorage 만으로 동작합니다. */
  var plugMarketRowsMissing = false;
  var MARKET_LS = "sbpress-plugin-markets";
  var PLUG_MARKET_DEFAULT = { id: "official", name: "공식 마켓", url: "/plugins-market.json",
                              enabled: true, is_official: true };

  function marketUrlOk(u) {
    var s = String(u || "").trim();
    return /^https:\/\//i.test(s) || (s.charAt(0) === "/" && s.charAt(1) !== "/");
  }

  function localMarkets() {
    try {
      var raw = JSON.parse(localStorage.getItem(MARKET_LS) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (r) { return r && typeof r === "object" && marketUrlOk(r.url); })
        .map(function (r) {
          return { id: String(r.id || "").slice(0, 60), name: String(r.name || r.url).slice(0, 80),
                   url: String(r.url).slice(0, 500), enabled: r.enabled !== false, is_official: false };
        }).filter(function (r) { return /^[a-z0-9][a-z0-9._-]{0,59}$/.test(r.id); });
    } catch (e) { return []; }
  }

  function saveLocalMarkets(rows) {
    try {
      localStorage.setItem(MARKET_LS, JSON.stringify((rows || []).filter(function (r) { return !r.is_official; })
        .map(function (r) { return { id: r.id, name: r.name, url: r.url, enabled: r.enabled !== false }; })));
    } catch (e) { /* 저장소 차단 — 이 화면에만 적용 */ }
  }

  function tableMissing(err) {
    var code = String((err && err.code) || "");
    var msg = String((err && err.message) || "");
    return code === "42P01" || code === "PGRST205" || /plugin_markets/i.test(msg) && /does not exist|not find/i.test(msg);
  }

  function loadMarketRows() {
    plugMarketRowsMissing = false;
    if (!sb) return Promise.resolve([Object.assign({}, PLUG_MARKET_DEFAULT, { url: plugMarketUrl })]);
    return sb.from("plugin_markets").select("*").then(function (r) {
      if (r.error && tableMissing(r.error)) {
        plugMarketRowsMissing = true;
        var rows = [Object.assign({}, PLUG_MARKET_DEFAULT, { url: plugMarketUrl })];
        return rows.concat(localMarkets());
      }
      if (r.error) throw new Error(r.error.message || "plugin_markets");
      var rows = (r.data || []).map(function (m) {
        return { id: m.id, name: m.name, url: m.url, enabled: m.enabled !== false,
                 is_official: !!m.is_official, plugin_count: m.plugin_count,
                 last_synced_at: m.last_synced_at, last_error: m.last_error };
      });
      if (!rows.some(function (x) { return x.is_official; })) {
        rows.unshift(Object.assign({}, PLUG_MARKET_DEFAULT, { url: plugMarketUrl }));
      }
      /* 기본 마켓 주소 입력값과 공식 마켓 주소를 맞춥니다. */
      rows.forEach(function (m) {
        if (m.is_official && plugMarketUrl && m.url !== plugMarketUrl) m.url = plugMarketUrl;
      });
      return rows;
    });
  }

  function fetchMarketJson(row) {
    row._data = null;
    row._error = "";
    if (row.enabled === false) return Promise.resolve(row);
    if (!marketUrlOk(row.url)) { row._error = "주소는 https:// 또는 / 만 됩니다"; return Promise.resolve(row); }
    return fetch(row.url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.plugins) ? data.plugins : null);
      if (!list) { row._error = "plugins 목록이 없습니다"; return row; }
      row._data = window.SBP_MARKET
        ? window.SBP_MARKET.normalize(data, row.url, { id: row.id, name: row.name, official: !!row.is_official })
        : null;
      if (row._data) row._data.categories = row._data.categories || [];
      row.plugin_count = list.length;
      row.last_synced_at = new Date().toISOString();
      row.last_error = null;
      saveMarketMeta(row);
      return row;
    }).catch(function (e) {
      row._error = e && e.message ? e.message : String(e);
      row.last_error = row._error;
      saveMarketMeta(row);
      return row;
    });
  }

  function saveMarketMeta(row) {
    if (plugMarketRowsMissing || !sb || row._local || !row.id) return;
    sb.from("plugin_markets").update({
      plugin_count: row.plugin_count == null ? null : row.plugin_count,
      last_synced_at: row.last_synced_at || null,
      last_error: row.last_error || null
    }).eq("id", row.id).then(function () { /* 실패해도 화면은 그대로 */ });
  }

  function mergeMarketList() {
    var UI = window.SBP_MARKET;
    var sources = plugMarkets.filter(function (m) { return m.enabled !== false; }).map(function (m) {
      return { id: m.id, name: m.name, url: m.url, official: !!m.is_official, data: m._data, error: m._error };
    });
    var merged = UI && UI.mergeMarkets ? UI.mergeMarkets(sources)
      : { plugins: [], categories: [], duplicates: 0 };
    return {
      plugins: merged.plugins || [],
      duplicates: merged.duplicates || 0,
      meta: { name: "SBPress", sbpress: siteSbpress(), categories: merged.categories || [] }
    };
  }

  /* 마켓 JSON 의 sbpress(엔진 호환 판) — 공식 마켓 것을 먼저 씁니다. */
  function siteSbpress() {
    var v = "";
    plugMarkets.forEach(function (m) {
      if (v || !m._data) return;
      if (m.is_official) v = String(m._data.sbpress || "");
    });
    if (!v) {
      plugMarkets.forEach(function (m) {
        if (!v && m._data) v = String(m._data.sbpress || "");
      });
    }
    return v;
  }

  function marketIdNew() {
    return "mk" + Date.now().toString(36);
  }

  function addMarket(name, url, cb) {
    var done = cb || function () {};
    if (!marketUrlOk(url)) { done("마켓 주소는 https:// 또는 사이트 안 경로(/)여야 합니다."); return; }
    if (plugMarkets.some(function (m) { return m.url.toLowerCase() === url.toLowerCase(); })) {
      done("이미 구독한 마켓 주소입니다: " + url); return;
    }
    var row = { id: marketIdNew(), name: (name || url).slice(0, 80), url: url.slice(0, 500),
                enabled: true, is_official: false, _local: true };
    fetch(row.url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.plugins) ? data.plugins : null);
      if (!list) throw new Error("plugins 목록이 없습니다");
      row._data = window.SBP_MARKET
        ? window.SBP_MARKET.normalize(data, row.url, { id: row.id, name: row.name, official: false }) : null;
      row.plugin_count = list.length;
      row.last_synced_at = new Date().toISOString();
      if (plugMarketRowsMissing || !sb) { finish(); return; }
      sb.from("plugin_markets").insert({ id: row.id, name: row.name, url: row.url,
        enabled: true, is_official: false, plugin_count: row.plugin_count,
        last_synced_at: row.last_synced_at }).then(function (ins) {
        if (ins.error) {
          if (tableMissing(ins.error)) { plugMarketRowsMissing = true; finish(); return; }
          done("마켓을 추가하지 못했습니다: " + ins.error.message);
          return;
        }
        row._local = false;
        finish();
      });
      function finish() {
        plugMarkets.push(row);
        saveLocalMarkets(plugMarkets);
        done("", "마켓을 추가했습니다: " + row.name + (plugMarketRowsMissing ? " (이 브라우저에만 기억)" : ""));
        refreshMarketsUi();
      }
    }).catch(function (e) {
      done("마켓 목록을 읽지 못했습니다: " + (e && e.message ? e.message : e));
    });
  }

  function setMarketRow(id, patch, cb) {
    var done = cb || function () {};
    var row = null;
    plugMarkets.forEach(function (m) { if (m.id === id) row = m; });
    if (!row) { done("마켓을 찾지 못했습니다: " + id); return; }
    if (row.is_official) { done("공식 마켓은 바꿀 수 없습니다."); return; }
    Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
    if (plugMarketRowsMissing || !sb || row._local) {
      saveLocalMarkets(plugMarkets);
      done(""); refreshMarketsUi(); return;
    }
    sb.from("plugin_markets").update(patch).eq("id", id).then(function (r) {
      if (r.error) { done("바꾸지 못했습니다: " + r.error.message); return; }
      saveLocalMarkets(plugMarkets);
      done(""); refreshMarketsUi();
    });
  }

  function removeMarket(id, cb) {
    var done = cb || function () {};
    var row = null;
    plugMarkets.forEach(function (m) { if (m.id === id) row = m; });
    if (!row) { done("마켓을 찾지 못했습니다: " + id); return; }
    if (row.is_official) { done("공식 마켓은 삭제할 수 없습니다."); return; }
    if (!window.confirm("‘" + row.name + "’ 마켓을 삭제할까요?\n설치한 플러그인은 그대로 남습니다.")) { done(""); return; }
    function local() {
      plugMarkets = plugMarkets.filter(function (m) { return m.id !== id; });
      saveLocalMarkets(plugMarkets);
      done("", "마켓을 삭제했습니다: " + row.name);
      refreshMarketsUi();
    }
    if (plugMarketRowsMissing || !sb) { local(); return; }
    sb.from("plugin_markets").delete().eq("id", id).then(function (r) {
      if (r.error) { done("삭제하지 못했습니다: " + r.error.message); return; }
      local();
    });
  }

  function refreshMarketsUi() {
    var merged = mergeMarketList();
    plugMarket = { base: marketAbs(plugMarketUrl), list: merged.plugins, meta: merged.meta,
                   markets: plugMarkets, duplicates: merged.duplicates };
    renderPlugins();
    if (window.SBP_MARKET && window.SBP_MARKET.refreshMarkets) {
      window.SBP_MARKET.refreshMarkets(plugMarkets, merged.plugins, merged.meta.categories, merged.duplicates);
    } else {
      renderMarket();
    }
  }

  /* ---------- v10.0 마켓 탐색기 (assets/market.js — 플러그인 탭을 처음 열 때 지연 로딩) ----------
     검색·필터·정렬·상세 모달은 assets/market.js 가 그리고, 설치·켜기·업데이트·제거 같은
     쓰기는 이 파일의 함수(installFromMarket·setPluginEnabled·updatePlugin·deletePlugin)가 합니다. */
  var marketUiPromise = null;

  function ensureMarketUi() {
    if (window.SBP_MARKET) return Promise.resolve(window.SBP_MARKET);
    if (marketUiPromise) return marketUiPromise;
    marketUiPromise = new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve(window.SBP_MARKET || null);
      }
      try {
        if (window.SBP && window.SBP.loadScript) window.SBP.loadScript("assets/market.js").then(finish, finish);
        else finish();
      } catch (e) { finish(); }
      setTimeout(finish, 6000);
    });
    return marketUiPromise;
  }

  function marketToolsHost(box) {
    var host = $("#plug-market-tools");
    if (host) return host;
    host = document.createElement("div");
    host.className = "mkt-tools plug-market-tools";
    host.id = "plug-market-tools";
    box.parentNode.insertBefore(host, box);
    return host;
  }

  function renderMarket() {
    var box = $("#plug-market");
    if (!box) return;
    var list = plugMarket.list || [];
    var host = marketToolsHost(box);
    ensureMarketUi().then(function (UI) {
      if (!UI) {
        box.innerHTML = '<p class="plug-empty">마켓 화면(assets/market.js)을 불러오지 못했습니다. 새로고침해 주세요.</p>';
        return;
      }
      var meta = plugMarket.meta || {};
      var markets = plugMarket.markets || pluginMarketRows();
      UI.mount({
        root: box,
        tools: host,
        mode: "admin",
        items: list,
        markets: markets,
        duplicates: plugMarket.duplicates || 0,
        url: plugMarketUrl,
        categories: meta.categories || [],
        sbpress: meta.sbpress || "",
        name: meta.name || "",
        installed: plugById,
        onInstall: function (id, btn, cb, consent, license) { installFromMarket(id, btn, consent, cb, license); },
        onApplyTheme: function (theme, cb) { applyThemeFromMarket(theme, cb); },
        onApplyBundle: function (bundle, opts, progress, done) {
          applyBundleFromMarket(bundle, opts, progress, function (err, info) {
            renderMarket();
            done(err, info);
          });
        },
        onToggle: function (id) { var p = plugById(id); setPluginEnabled(id, !(p && p.enabled)); },
        onUpdate: function (id, btn, cb, consent) { updatePlugin(id, btn, cb, consent); },
        onUpdateAll: function (ids, cb) { updateAllPlugins(ids, cb); },
        onRollback: function (id, cb) { rollbackPlugin(id, cb); },
        onRecheck: function (id, rec, cb) { recheckPlugin(id, rec, cb); },
        onInstallSubmission: function (item, btn, consent) { installSubmission(item, btn, consent); },
        onRefresh: function () { loadPlugins(false); },
        onRemove: function (id) { deletePlugin(id); },
        onSaveSettings: function (id, values, cb) { savePluginSettings(id, values, cb); },
        onMarketAdd: function (name, url, cb) { addMarket(name, url, cb); },
        onMarketToggle: function (id) {
          var row = null;
          (plugMarket.markets || []).forEach(function (m) { if (m.id === id) row = m; });
          if (!row) return;
          if (row.is_official) { marketNote("공식 마켓은 끌 수 없습니다.", "err"); return; }
          setMarketRow(id, { enabled: !(row.enabled !== false) }, function (err) {
            if (err) { marketNote(err, "err"); return; }
            marketNote("‘" + row.name + "’ 마켓을 " + (row.enabled === false ? "껐습니다" : "켰습니다") + ".", "ok");
          });
        },
        onMarketSync: function (id, cb) {
          var row = null;
          (plugMarket.markets || []).forEach(function (m) { if (m.id === id) row = m; });
          if (!row) { if (cb) cb("마켓을 찾지 못했습니다."); return; }
          fetchMarketJson(row).then(function (r) {
            var merged = mergeMarketList();
            plugMarket.list = merged.plugins;
            plugMarket.meta = merged.meta;
            plugMarket.duplicates = merged.duplicates;
            renderPlugins();
            if (window.SBP_MARKET && window.SBP_MARKET.refreshMarkets) {
              window.SBP_MARKET.refreshMarkets(plugMarket.markets, merged.plugins, merged.meta.categories, merged.duplicates);
            }
            if (cb) {
              cb(r._error || "", r._error ? "‘" + r.name + "’ 마켓을 읽지 못했습니다: " + r._error
                : "‘" + r.name + "’ 마켓을 동기화했습니다 · 플러그인 " + (r.plugin_count || 0) + "개");
            }
          });
        },
        onMarketRemove: function (id, btn) {
          removeMarket(id, function (err, msg) {
            if (err) { marketNote(err, "err"); return; }
            if (msg) marketNote(msg, "ok");
          });
        }
      });
    });
  }

  function pluginMarketRows() {
    return (plugMarkets && plugMarkets.length) ? plugMarkets : [PLUG_MARKET_DEFAULT];
  }

  function marketNote(text, kind) {
    var msg = $("#plug-market-msg");
    if (msg) msg.textContent = text;
    try { if (window.SBP_MARKET) window.SBP_MARKET.setMarketMessage(text, kind); } catch (e) { /* noop */ }
  }

  function installFromMarket(id, btn, consent, cb, license) {
    var done = typeof cb === "function" ? cb : function () {};
    var item = null;
    (plugMarket.list || []).forEach(function (p) { if (p.id === id) item = p; });
    if (!item) { done("‘" + id + "’ 플러그인을 마켓 목록에서 찾지 못했습니다."); return; }
    if (btn) { btn.disabled = true; btn.textContent = "설치하는 중…"; }
    var url = marketAbs(item.script_url);
    verifyPluginFile(url, function (scan) {
      if (!scan.ok) {
        if (btn) { btn.disabled = false; btn.textContent = "설치 및 켜기"; }
        plugMsg("‘" + (item.name || item.id) + "’ 을 설치하지 않았습니다 — " + scan.reasons.join(", "), "err");
        done("‘" + (item.name || item.id) + "’ 설치를 막았습니다(" + scan.reasons.join(", ") + ").");
        return;
      }
      var payload = {
        id: item.id, name: item.name || item.id, version: item.version || "1.0.0",
        description: item.description || null, author: item.author || null,
        script_url: url, source: item.source || "market", enabled: true,
        manifest: manifestPayload(item), settings_schema: settingsSchemaPayload(item)
      };
      /* v10.4 — 어느 구독 마켓에서 설치했는지 남깁니다(공식 마켓이면 비웁니다). */
      if (item.marketId && !item.marketOfficial) payload.market_id = item.marketId;
      /* v10.5 — 관리자가 동의한 권한·무결성·샌드박스 모드를 함께 적습니다. */
      var extra = consentPayload(consent, item);
      Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
      savePluginRow(payload).then(function (r) {
        if (btn) { btn.disabled = false; btn.textContent = "설치 및 켜기"; }
        if (r && r.error) {
          plugMsg("설치하지 못했습니다: " + r.error.message, "err");
          done("‘" + (item.name || item.id) + "’ 설치 실패: " + r.error.message);
          return;
        }
        var doneMsg = "‘" + (item.name || item.id) + "’ 플러그인을 설치하고 켰습니다. 사이트를 새로고침해 확인하세요.";
        /* v10.10 — 유료 플러그인은 확인된 라이선스를 안내에 함께 적습니다(기록은 마켓 화면·audit_logs). */
        if (license && license.key) {
          doneMsg += " 라이선스 " + String(license.plan || "").toUpperCase() + " 확인됨(" + String(license.key) + ").";
        }
        plugMsg(doneMsg, "ok");
        recordConsent(id, consent, item, function (msg) {
          if (msg) plugMsg(doneMsg + " " + msg, "ok");
        });
        countInstall(item.id, 1);
        reloadEngine();
        loadPlugins(false);
        done("");
      });
    });
  }

  /* ==========================================================================
     v10.8 — 테마 마켓 · 업종별 번들 팩
     · 테마  — 프리셋 토큰을 site_contents 의 theme.tokens(theme.preset)에 저장하고 바로 적용합니다.
     · 번들  — 테마 → (v10.5 권한 동의를 거친) 플러그인 설치 → hunmin 홈 블록 프리셋 순서로 진행하고
              29_v108 의 apply_bundle_preset RPC 로 audit_logs 에 bundle_apply 를 남깁니다.
     ========================================================================== */
  function tokensFromMarket(theme) {
    var tk = (theme && theme.tokens) || {};
    function pick(a, b) { return tk[a] != null ? tk[a] : (b ? tk[b] : ""); }
    return parseTokens({
      accent: pick("--accent", "accent"), bg: pick("--bg", "bg"), ink: pick("--text", "ink"),
      radius: pick("--radius", "radius"), fontStack: pick("--font", "fontStack"),
      surface: pick("--surface", "surface"), bg2: pick("--bg-2", "bg2"),
      ink2: pick("--text-2", "ink2"), ink3: pick("--text-3", "ink3"),
      line: pick("--line", "line"), line2: pick("--line-2", "line2"),
      accentDark: pick("--accent-dark", "accentDark"), accentSoft: pick("--accent-soft", "accentSoft"),
      preset: pick("--preset", "preset")
    });
  }

  function applyThemeFromMarket(theme, cb) {
    var done = typeof cb === "function" ? cb : function () {};
    if (!sb) { done("Supabase 연결이 없습니다."); return; }
    var t = tokensFromMarket(theme);
    if (!hexOk(t.accent) || !hexOk(t.bg)) { done("테마 토큰이 올바르지 않습니다."); return; }
    sb.from("site_contents").upsert({
      key: "theme.tokens", section: "테마 · 디자인",
      label: "테마 토큰 (accent · bg · ink · radius · fontStack — CSS 직접 주입 없이 변수로 적용)",
      value: tokensJson(t), image_url: null
    }, { onConflict: "key" }).then(function (r) {
      if (r.error) { done("테마를 저장하지 못했습니다: " + r.error.message); return; }
      applyTokensToRoot(t);
      fillTokenForm(t);
      var preset = (t.extras && t.extras.preset) || "";
      if (!TOKEN_PRESETS[preset]) { done(""); return; }
      sb.from("site_contents").upsert({
        key: "theme.preset", section: "테마 · 디자인",
        label: "테마 프리셋 (magazine = 매거진형 / craft = 공방·쇼케이스형 / org = 기관 소개형)",
        value: preset, image_url: null
      }, { onConflict: "key" }).then(function (r2) {
        if (!r2.error) {
          CMS_THEME = preset;
          document.body.setAttribute("data-theme", preset);
          try { renderThemePicks(); } catch (e) { /* noop */ }
        }
        done("");
      }, function () { done(""); });
    }, function (e) {
      done("테마를 저장하지 못했습니다: " + (e && e.message ? e.message : e));
    });
  }

  /* 홈 블록 프리셋 — site_contents 의 home.blocks(hunmin JSON). 이전 구성은 브라우저에 백업합니다. */
  var HOME_BLOCK_LS = "sbpress-home-blocks-backup";
  function applyHomeBlocks(preset, cb) {
    var done = typeof cb === "function" ? cb : function () {};
    var raw = preset && Array.isArray(preset.items) ? preset.items : preset;
    var list = [];
    if (window.CRAFT_HUNMIN && window.CRAFT_HUNMIN.normalizeList) list = window.CRAFT_HUNMIN.normalizeList(raw || []);
    else if (Array.isArray(raw)) list = raw.slice();
    if (!list.length) { done("홈 블록 프리셋이 비어 있습니다."); return; }
    if (!sb) { done("Supabase 연결이 없습니다."); return; }
    var value = JSON.stringify({ v: 1, items: list });

    function save() {
      sb.from("site_contents").upsert({
        key: "home.blocks", section: "홈",
        label: "홈 블록 (hunmin) — 업종별 번들 팩 프리셋 · 비우면 기본 홈 구성",
        value: value, image_url: null
      }, { onConflict: "key" }).then(function (r) {
        if (r.error) { done("홈 블록을 저장하지 못했습니다: " + r.error.message); return; }
        try { reloadEngine(); } catch (e) { /* noop */ }
        done("", list.length);
      }, function (e) {
        done("홈 블록을 저장하지 못했습니다: " + (e && e.message ? e.message : e));
      });
    }
    sb.from("site_contents").select("key,value").eq("key", "home.blocks").then(function (r) {
      var row = (!r.error && r.data) ? r.data[0] : null;
      try { if (row && row.value) localStorage.setItem(HOME_BLOCK_LS, String(row.value)); } catch (e) { /* noop */ }
      save();
    }, function () { save(); });
  }

  function pluginItemsForBundle(bundle) {
    var out = [];
    (bundle.plugin_slugs || []).forEach(function (slug) {
      if (plugById(slug)) return;                       // 이미 설치됨 — 건너뜁니다
      var item = null;
      (plugMarket.list || []).forEach(function (p) { if (p.id === slug) item = p; });
      if (item) out.push(item);
    });
    return out;
  }

  /* 29_v108 을 실행하지 않은 DB — 적용 기록은 이 브라우저에 남겨 두고 화면이 안내합니다. */
  var BUNDLE_LS = "sbpress-bundle-applies";
  function localBundleApply(bundle, info, opts) {
    try {
      var list = JSON.parse(localStorage.getItem(BUNDLE_LS) || "[]");
      if (!Array.isArray(list)) list = [];
      list.unshift({ slug: bundle.slug, version: bundle.version || "",
        theme_slug: opts.theme ? (bundle.theme_slug || "") : "",
        plugin_count: info.plugins || 0,
        blocks: info.blocks == null ? 0 : info.blocks,
        at: new Date().toISOString() });
      localStorage.setItem(BUNDLE_LS, JSON.stringify(list.slice(0, 50)));
    } catch (e) { /* 저장소 차단 — 기록 없이 진행 */ }
    info.auditMissing = true;
    info.auditLocal = true;
  }
  function auditBundleApply(bundle, info, opts, next) {
    if (!sb || typeof sb.rpc !== "function") { localBundleApply(bundle, info, opts); next(); return; }
    sb.rpc("apply_bundle_preset", {
      p_bundle_slug: bundle.slug,
      p_apply_theme: !!opts.theme && !!bundle.theme_slug,
      p_plugin_count: info.plugins || 0
    }).then(function (r) {
      if (r.error) {
        if (isMissingFn(r.error) || /apply_bundle_preset/i.test(String(r.error.message || ""))) {
          localBundleApply(bundle, info, opts);
        }
      }
      next();
    }, function () { localBundleApply(bundle, info, opts); next(); });
  }

  function applyBundleFromMarket(bundle, opts, progress, done) {
    opts = opts || {};
    var step = typeof progress === "function" ? progress : function () {};
    var end = typeof done === "function" ? done : function () {};
    var info = { theme: "", plugins: 0, blocks: null, note: "", auditMissing: false };
    var queue = [];

    if (opts.theme && bundle.theme_slug) {
      queue.push(function (next) {
        step("bndStepTheme", {});
        var th = (window.SBP_MARKET && window.SBP_MARKET.themeBySlug)
          ? window.SBP_MARKET.themeBySlug(bundle.theme_slug) : null;
        if (!th) { next(); return; }
        applyThemeFromMarket(th, function (err) {
          if (!err) info.theme = (th.name || bundle.theme_slug);
          else info.note = (info.note ? info.note + " " : "") + err;
          next();
        });
      });
    }

    var items = pluginItemsForBundle(bundle);
    if (opts.plugins && items.length) {
      queue.push(function (next) {
        var i = 0;
        (function one() {
          if (i >= items.length) { next(); return; }
          var item = items[i];
          i += 1;
          step("bndStepPlugin", { i: i, n: items.length, name: item.name || item.id });
          var consent = {
            granted: Array.isArray(item.permissions) ? item.permissions.slice(0, 12) : [],
            integrity: item.integrity || "", mode: "strict"
          };
          installFromMarket(item.id, null, consent, function (err) {
            if (!err) info.plugins += 1;
            else info.note = (info.note ? info.note + " " : "") + err;
            one();
          });
        })();
      });
    }

    if (opts.blocks && bundle.blocks_preset) {
      queue.push(function (next) {
        step("bndStepBlocks", {});
        applyHomeBlocks(bundle.blocks_preset, function (err, n) {
          if (!err) info.blocks = n;
          else { info.blocks = 0; info.note = (info.note ? info.note + " " : "") + err; }
          next();
        });
      });
    }

    queue.push(function (next) { auditBundleApply(bundle, info, opts, next); });

    (function run(i) {
      if (i >= queue.length) { end("", info); return; }
      queue[i](function () { run(i + 1); });
    })(0);
  }

  /* v10.6 — 심사에서 승인된 제출을 바로 설치합니다.
     마켓 설치(installFromMarket)와 같은 검사·저장 경로를 지나고, 출처만 제출 건으로 남깁니다. */
  function installSubmission(item, btn, consent) {
    if (!item) return;
    if (btn) { btn.disabled = true; btn.textContent = "설치하는 중…"; }
    var url = marketAbs(item.script_url);
    verifyPluginFile(url, function (scan) {
      if (!scan.ok) {
        if (btn) { btn.disabled = false; btn.textContent = "바로 설치"; }
        plugMsg("‘" + (item.name || item.id) + "’ 을 설치하지 않았습니다 — " + scan.reasons.join(", "), "err");
        return;
      }
      var payload = {
        id: item.id, name: item.name || item.id, version: item.version || "1.0.0",
        description: item.description || null, author: item.author || null,
        script_url: url, source: "market", enabled: true,
        manifest: manifestPayload(item), settings_schema: settingsSchemaPayload(item)
      };
      var extra = consentPayload(consent, item);
      Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
      savePluginRow(payload).then(function (r) {
        if (btn) { btn.disabled = false; btn.textContent = "바로 설치"; }
        if (r && r.error) {
          plugMsg("설치하지 못했습니다: " + r.error.message, "err");
          return;
        }
        var doneMsg = "‘" + (item.name || item.id) + "’ 제출 플러그인을 승인 목록에서 설치하고 켰습니다. 사이트를 새로고침해 확인하세요.";
        plugMsg(doneMsg, "ok");
        recordConsent(item.id, consent, item, function (msg) {
          if (msg) plugMsg(doneMsg + " " + msg, "ok");
        });
        countInstall(item.id, 1);
        reloadEngine();
        loadPlugins(false);
      });
    });
  }

  function saveMarketUrl() {
    var v = ($("#plug-market-url").value || "").trim() || "/plugins-market.json";
    var msg = $("#plug-market-msg");
    if (!/^https?:\/\//i.test(v) && v.charAt(0) !== "/") { v = "/" + v; }
    plugMarketUrl = v;
    sb.from("site_contents").upsert({ key: "plugins.market_url", section: "플러그인 · 마켓", label: "플러그인 마켓 주소 (plugins.json)", value: v }, { onConflict: "key" })
      .then(function (r) {
        if (r.error) { if (msg) msg.textContent = "저장하지 못했습니다: " + r.error.message; return; }
        if (msg) msg.textContent = "공식 마켓 주소를 저장했습니다: " + v;
        /* v10.4 — 서버에 구독 마켓이 있으면 공식 마켓 주소도 함께 맞춥니다. */
        if (!plugMarketRowsMissing && sb) {
          sb.from("plugin_markets").update({ url: v }).eq("id", "official").then(function () {
            loadMarket();
          });
        } else loadMarket();
      });
  }

  /* ==========================================================================
     v3.1 — Supabase 500MB · 1GB 수명 관리
     --------------------------------------------------------------------------
     · 사용량 게이지: 서버 함수 get_db_usage_stats() 가 있으면 정확한 값과 남은 날,
       없으면 화면에서 표 행 수(HEAD count)·표본 JSON 크기·storage.list() 로 추정합니다.
     · 고아 이미지: site-media 전체 목록과 글·페이지·사이트 문구의 참조를 대조해
       어디에서도 쓰이지 않는 파일만 골라 냅니다(삭제 전 한 번 더 확인).
     · 로그·접수 정리: 기준일 이전 자료를 JSON 으로 먼저 내려받아야 정리 버튼이 열립니다.
     ========================================================================== */
  var DB_LIMIT = 524288000;    /* 500MB */
  var ST_LIMIT = 1073741824;   /* 1GB */
  var USAGE_TABLES = ["site_contents", "posts", "pages", "boards", "comments", "profiles",
    "bookmarks", "tasks", "revisions", "form_submissions", "newsletter_subscribers",
    "plugins", "admin_users", "audit_logs", "rate_limits", "captcha_challenges"];
  var USAGE = { loaded: false, inflight: null, source: "", data: null, tables: [] };
  var ORPHAN = { rows: [], scanned: false, at: "", busy: false };
  var CLEAN = { audit: { days: 90, at: "", count: 0 }, inbox: { days: 90, at: "", count: 0 } };

  function byteLen(s) {
    var text = String(s == null ? "" : s);
    try { return new TextEncoder().encode(text).length; } catch (e) { return text.length; }
  }
  function usagePct(used, limit) {
    var p = limit ? (Number(used || 0) / limit) * 100 : 0;
    if (p > 0 && p < 0.01) return "<0.01%";
    return (p >= 10 ? p.toFixed(1) : p.toFixed(2)) + "%";
  }
  function ddayText(days) {
    if (days == null || isNaN(days)) return "증가 속도 측정 전";
    if (Number(days) <= 0) return "한도에 닿았습니다";
    return "이 속도면 약 " + num(days) + "일 뒤 한도";
  }
  function paintUsageBar(key, used, limit) {
    var pct = limit ? Math.min(100, (Number(used || 0) / limit) * 100) : 0;
    var fill = $("#" + key + "-fill");
    if (fill) fill.style.width = (pct > 0 ? Math.max(1.5, pct) : 0) + "%";
    var bar = fill && fill.parentNode;
    if (bar && bar.classList) bar.className = "usage-bar" + (pct >= 90 ? " crit" : pct >= 70 ? " warn" : "");
    var lab = $("#" + key + "-pct");
    if (lab) lab.textContent = usagePct(used, limit);
  }
  function paintUsageTables(rows) {
    var body = $("#usage-table tbody");
    if (!body) return;
    rows = (rows || []).slice().sort(function (a, b) { return (b.bytes || 0) - (a.bytes || 0); });
    body.innerHTML = rows.length ? rows.map(function (t) {
      return "<tr><td><code>" + esc(t.name) + "</code></td>" +
        '<td class="num">' + esc(num(t.rows)) + "</td>" +
        '<td class="num">' + esc(t.bytes == null ? "–" : fmtBytes(t.bytes)) + (t.estimated ? " ~" : "") + "</td></tr>";
    }).join("") : '<tr class="empty-row"><td colspan="3">표를 읽지 못했습니다.</td></tr>';
  }

  function loadDbUsage(force) {
    if (!sb || !$("#p-dbusage")) return Promise.resolve();
    if (USAGE.inflight && !force) return USAGE.inflight;
    if (USAGE.loaded && !force) { renderDbUsage(); return Promise.resolve(); }
    cmsMsg("dbusage-msg", "사용량을 읽는 중…");
    function fromRpc() {
      return sb.rpc("get_db_usage_stats").then(function (res) {
        if (!res.error && res.data) return { source: "rpc", data: res.data };
        return fromEstimate((res.error && res.error.message) || "");
      }, function (err) {
        return fromEstimate((err && err.message) || "");
      });
    }
    function fromEstimate(errText) {
      return estimateUsage().then(function (est) { est.rpcError = errText; return est; });
    }
    USAGE.inflight = fromRpc().then(function (out) {
      USAGE.inflight = null;
      USAGE.source = out.source;
      USAGE.data = out.data;
      USAGE.tables = out.tables || (out.data && out.data.db && out.data.db.tables) || [];
      USAGE.loaded = true;
      renderDbUsage();
      var note = $("#dbusage-note");
      if (note) {
        note.textContent = out.source === "rpc"
          ? "서버 함수 get_db_usage_stats() 가 센 정확한 값입니다. 하루 한 번 스냅샷을 남겨 최근 4주 증가 속도와 남은 날을 계산합니다."
          : "서버 함수를 찾지 못해 화면에서 추정했습니다. 표 행 수와 표본 행의 JSON 크기, storage.list() 로 계산하므로 실제와 조금 다를 수 있습니다. supabase/14_v31_storage_lifecycle.sql 을 실행하면 정확한 값과 남은 날이 켜집니다.";
      }
      cmsMsg("dbusage-msg", "");
    }).catch(function (e) {
      USAGE.inflight = null;
      cmsMsg("dbusage-msg", "사용량을 읽지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
    });
    return USAGE.inflight;
  }

  function renderDbUsage() {
    var d = USAGE.data || {};
    var db = d.db || {}, st = d.storage || {};
    var dbBytes = Number(db.bytes || 0), stBytes = Number(st.bytes || 0);
    var g = d.growth || {};
    paintUsageBar("usage-db", dbBytes, DB_LIMIT);
    paintUsageBar("usage-st", stBytes, ST_LIMIT);
    var el;
    if ((el = $("#usage-db-bytes"))) el.textContent = fmtBytes(dbBytes);
    if ((el = $("#usage-st-bytes"))) el.textContent = fmtBytes(stBytes);
    if ((el = $("#usage-st-files"))) el.textContent = st.files == null ? "파일 수 확인 전" : ("파일 " + num(st.files) + "개");
    if ((el = $("#usage-db-dday"))) el.textContent = ddayText(g.dbDaysLeft);
    if ((el = $("#usage-st-dday"))) el.textContent = ddayText(g.storageDaysLeft);
    if ((el = $("#dbusage-stamp"))) {
      var time = new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
      el.textContent = (USAGE.source === "rpc" ? "정확" : "추정") + " · " + time;
    }
    paintUsageTables(USAGE.tables);
  }

  /* 서버 함수가 없을 때: 표 행 수(HEAD) + 표본 JSON 크기 + storage.list() 로 추정합니다. */
  function estimateUsage() {
    var tables = [];
    var chain = Promise.resolve();
    USAGE_TABLES.forEach(function (name) {
      chain = chain.then(function () {
        return sb.from(name).select("*", { count: "exact", head: true }).then(function (r) {
          if (r && r.error) return null;
          var rows = (r && r.count != null) ? r.count : null;
          if (rows === 0) { tables.push({ name: name, rows: 0, bytes: 0, estimated: true }); return null; }
          return sb.from(name).select("*").limit(12).then(function (s) {
            var sample = (s && s.data) || [];
            if (!sample.length) { tables.push({ name: name, rows: rows, bytes: 0, estimated: true }); return; }
            var per = byteLen(JSON.stringify(sample)) / sample.length;
            /* 행 본문 + 인덱스·페이지 여유를 1.35배로 봅니다(추정). */
            tables.push({ name: name, rows: rows, bytes: Math.round(per * (rows == null ? sample.length : rows) * 1.35), estimated: true });
          });
        });
      });
    });
    return chain.then(function () {
      var dbBytes = 0;
      tables.forEach(function (t) { dbBytes += Number(t.bytes || 0); });
      var out = {
        source: "estimate", tables: tables,
        data: { limits: { dbBytes: DB_LIMIT, storageBytes: ST_LIMIT },
          db: { bytes: dbBytes, percent: (dbBytes / DB_LIMIT) * 100, tables: tables },
          storage: null, growth: {} }
      };
      return fetchMediaItems().then(function (items) {
        var bytes = 0;
        items.forEach(function (m) { bytes += Number(m.size || 0); });
        out.data.storage = { bucket: "site-media", files: items.length, bytes: bytes, percent: (bytes / ST_LIMIT) * 100 };
        return out;
      }, function () { return out; });
    });
  }

  /* ---------------- 고아 이미지(미사용) 탐지 ---------------- */
  function collectStrings(v, out) {
    if (v == null) return;
    if (typeof v === "string") { if (v) out.push(v); return; }
    if (Object.prototype.toString.call(v) === "[object Array]") {
      v.forEach(function (x) { collectStrings(x, out); });
      return;
    }
    if (typeof v === "object") {
      Object.keys(v).forEach(function (k) { collectStrings(v[k], out); });
    }
  }
  function pageRows(table, keyCol, pageSize, maxPages) {
    var out = [], page = 0, capped = false;
    function step(from) {
      if (page >= maxPages) { capped = true; return Promise.resolve(out); }
      page++;
      return sb.from(table).select("*").order(keyCol, { ascending: true }).range(from, from + pageSize - 1)
        .then(function (r) {
          if (r.error) throw r.error;
          var rows = r.data || [];
          rows.forEach(function (x) { out.push(x); });
          if (rows.length < pageSize) return out;
          return step(from + pageSize);
        });
    }
    return step(0).then(function () { return { rows: out, capped: capped }; });
  }
  function collectReferenceText() {
    var parts = [], warnings = [], jobs = [];
    /* 참조를 빠뜨리면 쓰는 이미지를 고아로 잘못 지울 수 있어, 읽지 못한 표는 경고로 남깁니다. */
    [
      ["posts", "id", true], ["pages", "slug", true], ["site_contents", "key", true],
      ["boards", "id", false], ["comments", "id", false], ["tasks", "id", false],
      ["revisions", "id", false]
    ].forEach(function (job) {
      jobs.push(pageRows(job[0], job[1], 500, 40).then(function (res) {
        res.rows.forEach(function (row) { collectStrings(row, parts); });
        if (res.capped) warnings.push(job[0] + " (상한)");
      }, function (e) {
        if (job[2]) throw new Error(job[0] + ": " + ((e && e.message) || "읽지 못했습니다"));
        warnings.push(job[0] + ": " + ((e && e.message) || "읽지 못했습니다"));
      }));
    });
    return Promise.all(jobs).then(function () { return { text: parts.join("\n"), warnings: warnings }; });
  }
  function refForms(s) {
    var out = [], v = String(s == null ? "" : s);
    if (!v) return out;
    out.push(v);
    try { out.push(encodeURI(v)); } catch (e) { /* noop */ }
    try { out.push(encodeURIComponent(v)); } catch (e) { /* noop */ }
    try { var d = decodeURIComponent(v); if (d !== v) out.push(d); } catch (e) { /* noop */ }
    return out;
  }
  function isReferenced(m, text) {
    var keys = [];
    [m.path, m.url, m.name].forEach(function (v) { keys = keys.concat(refForms(v)); });
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] && text.indexOf(keys[i]) >= 0) return true;
    }
    return false;
  }
  function scanOrphanMedia() {
    if (!sb || ORPHAN.busy) return;
    ORPHAN.busy = true;
    var btn = $("#orphan-scan");
    if (btn) btn.disabled = true;
    cmsMsg("orphan-msg", "파일 목록과 참조를 모으는 중…");
    var items = [];
    fetchMediaItems().then(function (list) {
      items = list;
      CMS.media = list; CMS.loaded.media = true;
      fillMediaFolders(); renderMedia();
      return collectReferenceText();
    }).then(function (ref) {
      var rows = items.filter(function (m) { return !isReferenced(m, ref.text); }).map(function (m) {
        return { path: m.path, name: m.name, size: Number(m.size || 0), folder: m.folder, updated: m.updated, url: m.url };
      });
      ORPHAN.rows = rows;
      ORPHAN.scanned = true;
      ORPHAN.at = new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
      renderOrphans();
      cmsMsg("orphan-msg", ref.warnings.length
        ? ("일부 표를 읽지 못했습니다(참조를 놓칠 수 있음): " + ref.warnings.join(", "))
        : "", ref.warnings.length ? "err" : "");
    }).catch(function (e) {
      cmsMsg("orphan-msg", "고아 이미지를 찾지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
    }).then(function () {
      ORPHAN.busy = false;
      if (btn) btn.disabled = false;
    });
  }
  function orphanTotal() {
    var n = 0;
    ORPHAN.rows.forEach(function (m) { n += Number(m.size || 0); });
    return n;
  }
  function renderOrphans() {
    var box = $("#orphan-grid");
    if (!box) return;
    var sum = $("#orphan-sum");
    if (sum) {
      sum.textContent = !ORPHAN.scanned
        ? "아직 찾지 않았습니다. ‘고아 이미지 찾기’를 누르면 글·페이지·사이트 문구의 참조와 대조합니다."
        : (ORPHAN.rows.length
          ? ("고아 이미지 " + ORPHAN.rows.length + "개 · 회수 가능 " + fmtBytes(orphanTotal()) + " · " + ORPHAN.at)
          : "고아 이미지가 없습니다. 모든 파일이 글·페이지·사이트 문구에서 쓰이고 있습니다.");
    }
    var bar = $("#orphan-bar");
    if (bar) bar.hidden = !(ORPHAN.scanned && ORPHAN.rows.length);
    var all = $("#orphan-all");
    if (all) all.checked = false;
    if (!ORPHAN.rows.length) {
      box.innerHTML = ORPHAN.scanned ? '<p class="panel-msg">' + esc(sum && sum.textContent ? sum.textContent : "") + "</p>" : "";
      paintOrphanPicked();
      return;
    }
    box.innerHTML = ORPHAN.rows.map(function (m) {
      return '<figure class="orphan-card">' +
        '<label class="orphan-pick"><input type="checkbox" data-path="' + esc(m.path) + '" aria-label="' + esc(m.name) + '">' +
        '<img src="' + esc(m.url) + '" alt="" loading="lazy"></label>' +
        "<figcaption><b title=\"" + esc(m.path) + "\">" + esc(m.name) + "</b>" +
        '<span class="media-meta">' + esc(m.folder) + " · " + esc(fmtBytes(m.size)) + "</span></figcaption></figure>";
    }).join("");
    paintOrphanPicked();
  }
  function orphanPicked() {
    return [].filter.call(document.querySelectorAll("#orphan-grid input[data-path]"), function (b) { return b.checked; })
      .map(function (b) { return b.getAttribute("data-path"); });
  }
  function paintOrphanPicked() {
    var picked = orphanPicked(), bytes = 0;
    ORPHAN.rows.forEach(function (m) { if (picked.indexOf(m.path) >= 0) bytes += Number(m.size || 0); });
    var el = $("#orphan-sel");
    if (el) el.textContent = picked.length ? ("선택 " + picked.length + "개 · " + fmtBytes(bytes)) : "선택 없음";
    var all = $("#orphan-all");
    if (all) {
      var boxes = document.querySelectorAll("#orphan-grid input[data-path]");
      all.checked = boxes.length > 0 && picked.length === boxes.length;
    }
    var del = $("#orphan-del");
    if (del) del.disabled = !picked.length;
  }
  function deleteOrphans() {
    var picked = orphanPicked();
    if (!picked.length) return;
    var bytes = 0;
    ORPHAN.rows.forEach(function (m) { if (picked.indexOf(m.path) >= 0) bytes += Number(m.size || 0); });
    if (!window.confirm("고아 이미지 " + picked.length + "개(" + fmtBytes(bytes) + ")를 삭제할까요?\n글·페이지에서 쓰지 않는 파일만 골랐지만, 되돌릴 수 없습니다.")) return;
    var btn = $("#orphan-del");
    if (btn) btn.disabled = true;
    cmsMsg("orphan-msg", "삭제하는 중…");
    var done = 0;
    function chunk(list) {
      if (!list.length) return Promise.resolve();
      var part = list.slice(0, 100);
      return sb.storage.from("site-media").remove(part).then(function (r) {
        if (r.error) throw new Error(r.error.message || "삭제 실패");
        done += part.length;
        return chunk(list.slice(100));
      });
    }
    chunk(picked).then(function () {
      ORPHAN.rows = ORPHAN.rows.filter(function (m) { return picked.indexOf(m.path) < 0; });
      CMS.media = CMS.media.filter(function (m) { return picked.indexOf(m.path) < 0; });
      fillMediaFolders(); renderMedia(); renderOrphans();
      cmsMsg("orphan-msg", "고아 이미지 " + done + "개(" + fmtBytes(bytes) + ")를 삭제했습니다.", "ok");
      loadDbUsage(true);
    }).catch(function (e) {
      cmsMsg("orphan-msg", "삭제하지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
      paintOrphanPicked();
    });
    if (btn) btn.disabled = false;
  }

  /* ---------------- 오래된 감사 로그 · 완료 접수: JSON 백업 후 정리 ---------------- */
  function isoCutoff(days) { return new Date(Date.now() - days * 86400000).toISOString(); }
  function selectDays(id, def) {
    var el = $("#" + id);
    var n = parseInt(el && el.value, 10);
    return (n && n > 0) ? n : def;
  }
  function missingFn(err) {
    if (!err) return false;
    var code = String(err.code || ""), msg = String(err.message || "");
    return code === "42883" || code === "PGRST202" || /could not find the function|does not exist|schema cache/i.test(msg);
  }
  function paintClean(kind) {
    var st = CLEAN[kind];
    var days = kind === "audit" ? selectDays("audit-days", 90) : selectDays("inbox-days", 90);
    var tag = $("#" + kind + "-clean-state");
    var btn = $("#" + kind + "-purge");
    var ready = !!st.at && st.days === days && st.count > 0;
    if (tag) {
      tag.textContent = !st.at ? "백업 필요"
        : (st.days !== days ? "기준을 바꿈 — 다시 백업"
          : (st.count > 0 ? "백업 " + st.count + "건 · 정리 가능" : "지울 자료 없음"));
    }
    if (btn) btn.disabled = !ready;
  }
  function backupAudit() {
    var days = selectDays("audit-days", 90), cut = isoCutoff(days);
    var rows = [], page = 0, pageSize = 1000;
    cmsMsg("audit-clean-msg", "내려받을 로그를 모으는 중…");
    function step(from) {
      if (page >= 20) return Promise.resolve(rows);
      page++;
      return sb.from("audit_logs").select("created_at,actor_email,action,target_table,target_id,detail")
        .lt("created_at", cut).order("created_at", { ascending: false }).range(from, from + pageSize - 1)
        .then(function (r) {
          if (r.error) throw r.error;
          var got = r.data || [];
          got.forEach(function (x) { rows.push(x); });
          if (got.length < pageSize) return rows;
          return step(from + pageSize);
        });
    }
    step(0).then(function () {
      var payload = { format: "sbpress-audit-backup", version: "3.1", exportedAt: new Date().toISOString(),
        days: days, cutoff: cut, count: rows.length, rows: rows };
      downloadBlob("SBPress_감사로그_" + days + "일_" + todayKST() + ".json", JSON.stringify(payload, null, 2));
      CLEAN.audit = { days: days, at: new Date().toISOString(), count: rows.length };
      paintClean("audit");
      cmsMsg("audit-clean-msg", rows.length
        ? ("감사 로그 " + rows.length + "건을 JSON 으로 내려받았습니다. 이제 ‘정리’를 누를 수 있습니다.")
        : "기준일 이전 감사 로그가 없습니다.", "ok");
    }).catch(function (e) {
      cmsMsg("audit-clean-msg", "백업하지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
    });
  }
  function purgeAudit() {
    var days = selectDays("audit-days", 90);
    if (!CLEAN.audit.at || CLEAN.audit.days !== days) {
      cmsMsg("audit-clean-msg", "먼저 JSON 백업을 내려받아 주세요.", "err");
      return;
    }
    if (!window.confirm("기준(" + days + "일) 이전 감사 로그를 지울까요?\n먼저 내려받은 JSON 파일이 유일한 사본입니다. 되돌릴 수 없습니다.")) return;
    var cut = isoCutoff(days);
    cmsMsg("audit-clean-msg", "정리하는 중…");
    function finish(n, viaRpc) {
      CLEAN.audit = { days: days, at: "", count: 0 };
      CMS.auditLoaded = false;
      loadAudit();
      paintClean("audit");
      cmsMsg("audit-clean-msg", viaRpc
        ? ("감사 로그 " + n + "건을 정리했습니다. 정리 기록을 감사 로그에 남겼습니다.")
        : ("감사 로그 " + n + "건을 일반 삭제로 정리했습니다. 서버 함수가 없어 감사 로그에는 기록을 남기지 못했습니다."), "ok");
      loadDbUsage(true);
    }
    sb.rpc("purge_old_audit_logs", { p_days: days }).then(function (res) {
      if (!res.error) { finish((res.data && res.data.purged) || 0, true); return; }
      if (!missingFn(res.error)) throw res.error;
      return sb.from("audit_logs").delete().lt("created_at", cut).then(function (r) {
        if (r.error) {
          cmsMsg("audit-clean-msg", "서버 함수가 없어 감사 로그를 지우지 못했습니다(권한). supabase/14_v31_storage_lifecycle.sql 을 실행해 주세요.", "err");
          paintClean("audit");
          return;
        }
        finish((r.data || []).length, false);
      });
    }).catch(function (e) {
      cmsMsg("audit-clean-msg", "정리하지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
      paintClean("audit");
    });
  }
  function inboxDone(r) {
    return r.is_handled === true || String(r.status || "") === "done" || String((r.payload || {}).__status || "") === "done";
  }
  function backupInbox() {
    var days = selectDays("inbox-days", 90), cut = isoCutoff(days);
    cmsMsg("inbox-clean-msg", "내려받을 접수를 모으는 중…");
    sb.from("form_submissions").select("*").lt("created_at", cut)
      .order("created_at", { ascending: true }).limit(5000).then(function (r) {
        if (r.error) throw r.error;
        var rows = (r.data || []).filter(inboxDone);
        var payload = { format: "sbpress-submissions-backup", version: "3.1", exportedAt: new Date().toISOString(),
          days: days, cutoff: cut, count: rows.length, rows: rows };
        downloadBlob("SBPress_완료접수_" + days + "일_" + todayKST() + ".json", JSON.stringify(payload, null, 2));
        CLEAN.inbox = { days: days, at: new Date().toISOString(), count: rows.length };
        paintClean("inbox");
        cmsMsg("inbox-clean-msg", rows.length
          ? ("완료 접수 " + rows.length + "건을 JSON 으로 내려받았습니다. 이제 ‘정리’를 누를 수 있습니다.")
          : "기준일 이전에 처리 완료된 접수가 없습니다.", "ok");
      }).catch(function (e) {
        cmsMsg("inbox-clean-msg", "백업하지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
      });
  }
  function purgeInbox() {
    var days = selectDays("inbox-days", 90);
    if (!CLEAN.inbox.at || CLEAN.inbox.days !== days) {
      cmsMsg("inbox-clean-msg", "먼저 JSON 백업을 내려받아 주세요.", "err");
      return;
    }
    if (!window.confirm("기준(" + days + "일) 이전의 완료 접수를 지울까요?\n새 접수·처리 중인 접수는 그대로 두고, 먼저 내려받은 JSON 파일이 유일한 사본입니다.")) return;
    var cut = isoCutoff(days);
    cmsMsg("inbox-clean-msg", "정리하는 중…");
    function finish(n, viaRpc) {
      CLEAN.inbox = { days: days, at: "", count: 0 };
      loadInbox(true);
      paintClean("inbox");
      cmsMsg("inbox-clean-msg", viaRpc
        ? ("완료 접수 " + n + "건을 정리했습니다. 정리 기록을 감사 로그에 남겼습니다.")
        : ("완료 접수 " + n + "건을 일반 삭제로 정리했습니다. 서버 함수가 없어 감사 로그에는 기록을 남기지 못했습니다."), "ok");
      loadDbUsage(true);
    }
    sb.rpc("purge_handled_submissions", { p_days: days }).then(function (res) {
      if (!res.error) { finish((res.data && res.data.purged) || 0, true); return; }
      if (!missingFn(res.error)) throw res.error;
      return sb.from("form_submissions").select("*").lt("created_at", cut).limit(5000).then(function (r) {
        if (r.error) throw r.error;
        var ids = (r.data || []).filter(inboxDone).map(function (x) { return x.id; });
        var removed = 0;
        function chunk(list) {
          if (!list.length) { finish(removed, false); return Promise.resolve(); }
          var part = list.slice(0, 50);
          return sb.from("form_submissions").delete().in("id", part).then(function (d) {
            if (d.error) throw d.error;
            removed += part.length;
            return chunk(list.slice(50));
          });
        }
        return chunk(ids);
      });
    }).catch(function (e) {
      cmsMsg("inbox-clean-msg", "정리하지 못했습니다: " + ((e && e.message) || "알 수 없는 오류"), "err");
      paintClean("inbox");
    });
  }

  function wireV31() {
    var r = $("#dbusage-reload");
    if (r) r.addEventListener("click", function () { loadDbUsage(true); });
    var scan = $("#orphan-scan");
    if (scan) scan.addEventListener("click", scanOrphanMedia);
    var grid = $("#orphan-grid");
    if (grid) grid.addEventListener("change", paintOrphanPicked);
    var all = $("#orphan-all");
    if (all) all.addEventListener("change", function () {
      [].forEach.call(document.querySelectorAll("#orphan-grid input[data-path]"), function (b) { b.checked = all.checked; });
      paintOrphanPicked();
    });
    var del = $("#orphan-del");
    if (del) del.addEventListener("click", deleteOrphans);
    [["#audit-days", "audit"], ["#inbox-days", "inbox"]].forEach(function (pair) {
      var sel = $(pair[0]);
      if (sel) sel.addEventListener("change", function () { paintClean(pair[1]); });
    });
    var ab = $("#audit-backup");
    if (ab) ab.addEventListener("click", backupAudit);
    var ap = $("#audit-purge");
    if (ap) ap.addEventListener("click", purgeAudit);
    var ib = $("#inbox-backup");
    if (ib) ib.addEventListener("click", backupInbox);
    var ip = $("#inbox-purge");
    if (ip) ip.addEventListener("click", purgeInbox);
    paintClean("audit");
    paintClean("inbox");
  }

  /* ============================================================
     v4.0 — 결재 관리 (public.approval_forms · approval_docs · approval_steps · approval_logs)
     ============================================================ */
  var APPR = { forms: [], docs: [], steps: {}, logs: {}, rules: [], delegates: [], people: [],
               loaded: false, editing: null, doc: null, missingV41: false };
  var APPR_STATUS = { draft: "임시저장", pending: "결재 중", approved: "승인 완료", rejected: "반려", canceled: "회수" };
  var APPR_STEP = { waiting: "대기", pending: "결재 대기", approved: "승인", rejected: "반려" };
  var APPR_TYPES = { text: "텍스트", number: "숫자", date: "날짜", select: "선택", file: "파일 링크" };

  function apprMsg(text, kind) { cmsMsg("appr-admin-msg", text, kind); }

  function apprStamp(t) {
    var el = $("#appr-stamp");
    if (el) el.textContent = t || "";
  }

  function loadApprovalsAdmin(force) {
    if (APPR.loaded && !force) { renderApprForms(); renderApprDocs(); return Promise.resolve(); }
    apprMsg("");
    apprStamp("불러오는 중…");
    return Promise.all([
      sb.from("approval_forms").select("*").order("sort_order", { ascending: true }),
      sb.from("approval_docs").select("*").order("created_at", { ascending: false }).limit(500)
    ]).then(function (res) {
      var f = res[0], d = res[1];
      var err = f.error || d.error;
      if (err) {
        APPR.forms = []; APPR.docs = []; APPR.steps = {}; APPR.loaded = false;
        apprStamp("표 없음");
        apprMsg("결재 표를 읽지 못했습니다: " + (err.message || err) +
                " — supabase/15_v40_approvals.sql 을 SQL Editor 에서 한 번 실행해 주세요.", "err");
        renderApprForms(); renderApprDocs();
        return;
      }
      APPR.forms = f.data || [];
      APPR.docs = d.data || [];
      APPR.loaded = true;
      return sb.from("approval_steps").select("*").order("doc_id", { ascending: true }).order("step_order", { ascending: true }).limit(2000)
        .then(function (s) {
          var map = {};
          ((s && !s.error && s.data) || []).forEach(function (st) { (map[st.doc_id] = map[st.doc_id] || []).push(st); });
          APPR.steps = map;
          paintApprBadge();
          renderApprForms();
          renderApprDocs();
          return loadApprV41();
        }).then(function () {
          apprStamp("결재 " + APPR.docs.length + "건 · 양식 " + APPR.forms.length +
                    "개 · 전결 " + APPR.rules.length + " · 대결 " + APPR.delegates.length);
        });
    }).catch(function (e) {
      apprStamp("오류");
      apprMsg("결재 자료를 불러오지 못했습니다: " + (e && e.message ? e.message : e), "err");
    });
  }

  function paintApprBadge() {
    var n = APPR.docs.filter(function (d) { return d.status === "pending"; }).length;
    var el = $("#tab-appr-count");
    if (el) el.textContent = n ? String(n) : "";
  }

  function apprFormName(code) {
    for (var i = 0; i < APPR.forms.length; i++) if (APPR.forms[i].code === code) return APPR.forms[i].name;
    return code || "";
  }

  function renderApprForms() {
    var box = $("#appr-forms");
    if (!box) return;
    if (!APPR.forms.length) {
      box.innerHTML = '<p class="appr-empty">결재 양식이 없습니다. ‘양식 추가’로 첫 양식을 만들어 주세요.</p>';
      return;
    }
    box.innerHTML = APPR.forms.map(function (f) {
      var fields = Array.isArray(f.fields) ? f.fields : [];
      return '<article class="appr-form-card" data-id="' + esc(f.id) + '">' +
        '<h3>' + esc(f.name || f.code) + ' <span class="appr-form-code">' + esc(f.code) + '</span></h3>' +
        (f.description ? '<p class="appr-form-desc">' + esc(f.description) + '</p>' : "") +
        '<div class="appr-form-tags">' +
          '<span>' + (f.active === false ? "끔" : "켜짐") + '</span>' +
          '<span>추가 항목 ' + fields.length + '개</span>' +
          (f.name_en ? '<span>' + esc(f.name_en) + '</span>' : "") +
        '</div>' +
        (fields.length ? '<div class="appr-form-tags">' + fields.map(function (x) {
          return '<span>' + esc(x.label || x.key) + ' · ' + esc(APPR_TYPES[x.type] || x.type || "text") + '</span>';
        }).join("") + '</div>' : "") +
        '<div class="appr-form-foot"><button type="button" class="mini appr-form-edit">양식 수정</button></div>' +
      '</article>';
    }).join("");
    [].forEach.call(box.querySelectorAll(".appr-form-card"), function (card) {
      var f = null;
      for (var i = 0; i < APPR.forms.length; i++) if (APPR.forms[i].id === card.getAttribute("data-id")) f = APPR.forms[i];
      var b = card.querySelector(".appr-form-edit");
      if (b) b.addEventListener("click", function () { openApprForm(f); });
    });
  }

  function renderApprDocs() {
    var body = $("#appr-doc-table tbody");
    if (!body) return;
    var q = ($("#appr-admin-q") ? $("#appr-admin-q").value : "").trim().toLowerCase();
    var st = $("#appr-admin-status") ? $("#appr-admin-status").value : "";
    var rows = APPR.docs.filter(function (d) {
      if (st && d.status !== st) return false;
      if (!q) return true;
      return [d.doc_no, d.title, d.drafter_name, apprFormName(d.form_code)].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var tag = $("#appr-admin-count");
    if (tag) tag.textContent = rows.length + " / " + APPR.docs.length + "건";
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">' +
        (APPR.docs.length ? "조건에 맞는 결재 문서가 없습니다." : "아직 결재 문서가 없습니다. 사이트 #/approvals 에서 회원이 기안합니다.") +
        "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (d) {
      var list = APPR.steps[d.id] || [];
      var done = list.filter(function (s) { return s.status === "approved"; }).length;
      return '<tr data-id="' + esc(d.id) + '">' +
        '<td class="mono">' + esc(d.doc_no || "") + '</td>' +
        '<td>' + esc(apprFormName(d.form_code)) + '</td>' +
        '<td><b>' + esc(d.title || "") + '</b></td>' +
        '<td>' + esc(d.drafter_name || "") + '</td>' +
        '<td><span class="badge st-' + esc(d.status) + '">' + esc(APPR_STATUS[d.status] || d.status) + '</span></td>' +
        '<td>' + (d.status === "pending" ? (d.current_step || 1) + "차 · " + done + "/" + list.length + " 승인" : "–") + '</td>' +
        '<td class="muted">' + esc(d.submitted_at ? String(d.submitted_at).slice(0, 10) : "–") + '</td>' +
        '<td class="cms-actions"><button type="button" class="rowlink appr-doc-open">보기</button></td>' +
      '</tr>';
    }).join("");
    [].forEach.call(body.querySelectorAll(".appr-doc-open"), function (b) {
      b.addEventListener("click", function () {
        var tr = b.closest("tr");
        if (tr) openApprDoc(tr.getAttribute("data-id"));
      });
    });
  }

  function openApprForm(form) {
    var modal = $("#appr-form-modal");
    if (!modal) return;
    APPR.editing = form || null;
    $("#appr-form-modal-title").textContent = form ? "결재 양식 수정" : "새 결재 양식";
    $("#appr-f-code").value = form ? (form.code || "") : "";
    $("#appr-f-code").disabled = !!form;
    $("#appr-f-name").value = form ? (form.name || "") : "";
    $("#appr-f-name-en").value = form ? (form.name_en || "") : "";
    $("#appr-f-desc").value = form ? (form.description || "") : "";
    $("#appr-f-sort").value = form && form.sort_order != null ? form.sort_order : 100;
    $("#appr-f-active").checked = form ? form.active !== false : true;
    $("#appr-f-fields").value = form && Array.isArray(form.fields) && form.fields.length
      ? JSON.stringify(form.fields, null, 2) : "";
    $("#appr-f-del").hidden = !form;
    cmsMsg("appr-form-msg", "");
    if ($("#appr-f-check")) $("#appr-f-check").textContent = "";
    modal.hidden = false;
    document.body.classList.add("cms-lock");
  }

  function closeApprForm() {
    var modal = $("#appr-form-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("cms-lock");
    APPR.editing = null;
  }

  function parseApprFields() {
    var raw = ($("#appr-f-fields").value || "").trim();
    if (!raw) return [];
    var data;
    try { data = JSON.parse(raw); } catch (e) {
      throw new Error("추가 항목 JSON 의 형식이 맞지 않습니다: " + e.message);
    }
    if (!Array.isArray(data)) throw new Error("추가 항목은 JSON 배열([ ... ])이어야 합니다.");
    data.forEach(function (x, i) {
      if (!x || typeof x !== "object") throw new Error((i + 1) + "번째 항목이 객체가 아닙니다.");
      if (!x.key) throw new Error((i + 1) + "번째 항목에 key 가 없습니다.");
      if (!x.label) throw new Error((i + 1) + "번째 항목에 label 이 없습니다.");
      if (x.type && !APPR_TYPES[x.type]) throw new Error((i + 1) + "번째 type 은 text·number·date·select·file 중 하나여야 합니다.");
    });
    return data;
  }

  function saveApprForm() {
    var name = ($("#appr-f-name").value || "").trim();
    var code = ($("#appr-f-code").value || "").trim().toLowerCase();
    if (!name) { cmsMsg("appr-form-msg", "이름(한국어)을 입력해 주세요.", "err"); return; }
    if (!APPR.editing && !/^[a-z0-9][a-z0-9_-]{1,29}$/.test(code)) {
      cmsMsg("appr-form-msg", "양식 코드는 영문 소문자·숫자·- _ 로 2~30자입니다.", "err"); return;
    }
    var fields;
    try { fields = parseApprFields(); }
    catch (e) { cmsMsg("appr-form-msg", e.message, "err"); return; }
    var row = {
      code: APPR.editing ? APPR.editing.code : code,
      name: name,
      name_en: ($("#appr-f-name-en").value || "").trim(),
      description: ($("#appr-f-desc").value || "").trim(),
      fields: fields,
      active: $("#appr-f-active").checked,
      sort_order: parseInt($("#appr-f-sort").value, 10) || 100
    };
    var btn = $("#appr-form-save");
    if (btn) btn.disabled = true;
    var job = APPR.editing
      ? sb.from("approval_forms").update(row).eq("id", APPR.editing.id)
      : sb.from("approval_forms").insert(row);
    job.then(function (r) {
      if (btn) btn.disabled = false;
      if (r.error) {
        cmsMsg("appr-form-msg", (/row-level security|permission|401|403/i.test(r.error.message || "")
          ? "저장 권한이 없습니다(관리자만 양식을 고칠 수 있습니다). " : "저장하지 못했습니다: ") +
          (r.error.message || ""), "err");
        return;
      }
      closeApprForm();
      apprMsg(APPR.editing ? "결재 양식을 수정했습니다." : "결재 양식을 만들었습니다.", "ok");
      APPR.loaded = false;
      loadApprovalsAdmin(true);
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      cmsMsg("appr-form-msg", "저장하지 못했습니다: " + (e && e.message || e), "err");
    });
  }

  function deleteApprForm() {
    if (!APPR.editing) return;
    if (!window.confirm("‘" + (APPR.editing.name || APPR.editing.code) + "’ 양식을 삭제할까요?\n이미 만든 기안은 남고, 이 양식 이름만 비워집니다.")) return;
    sb.from("approval_forms").delete().eq("id", APPR.editing.id).then(function (r) {
      if (r.error) { cmsMsg("appr-form-msg", "삭제하지 못했습니다: " + (r.error.message || ""), "err"); return; }
      closeApprForm();
      apprMsg("결재 양식을 삭제했습니다.", "ok");
      APPR.loaded = false;
      loadApprovalsAdmin(true);
    });
  }

  function openApprDoc(id) {
    var doc = null;
    for (var i = 0; i < APPR.docs.length; i++) if (APPR.docs[i].id === id) doc = APPR.docs[i];
    if (!doc) return;
    APPR.doc = doc;
    var modal = $("#appr-doc-modal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("cms-lock");
    $("#appr-doc-modal-title").textContent = doc.doc_no || "결재 문서";
    $("#appr-doc-body").innerHTML = '<p class="cms-hint">이력을 불러오는 중…</p>';
    sb.from("approval_logs").select("*").eq("doc_id", id).order("created_at", { ascending: false }).limit(100)
      .then(function (r) {
        var logs = (r && !r.error && r.data) || [];
        paintApprDoc(doc, logs);
      });
  }

  function paintApprDoc(doc, logs) {
    var box = $("#appr-doc-body");
    if (!box) return;
    var steps = APPR.steps[doc.id] || [];
    var form = null;
    for (var i = 0; i < APPR.forms.length; i++) if (APPR.forms[i].code === doc.form_code) form = APPR.forms[i];
    var defs = (form && Array.isArray(form.fields)) ? form.fields : [];
    var vals = doc.fields || {};
    var rows = defs.filter(function (d) { return vals[d.key] != null && vals[d.key] !== ""; });
    var extra = Object.keys(vals).filter(function (k) {
      return k !== "attachment" && !defs.some(function (d) { return d.key === k; });
    });
    box.innerHTML = '<div class="appr-doc-detail">' +
      '<dl class="appr-doc-meta">' +
        '<div><dt>양식</dt><dd>' + esc(apprFormName(doc.form_code)) + '</dd></div>' +
        '<div><dt>기안자</dt><dd>' + esc(doc.drafter_name || "") + '</dd></div>' +
        '<div><dt>상태</dt><dd>' + esc(APPR_STATUS[doc.status] || doc.status) + '</dd></div>' +
        '<div><dt>현재 단계</dt><dd>' + (doc.status === "pending" ? (doc.current_step || 1) + "차" : "–") + '</dd></div>' +
        '<div><dt>작성일</dt><dd>' + esc(String(doc.created_at || "").slice(0, 10)) + '</dd></div>' +
        '<div><dt>상신일</dt><dd>' + esc(doc.submitted_at ? String(doc.submitted_at).slice(0, 16).replace("T", " ") : "–") + '</dd></div>' +
      '</dl>' +
      '<h2 style="font-size:1.05rem;letter-spacing:-.02em">' + esc(doc.title || "") + '</h2>' +
      (rows.length ? '<table class="appr-doc-fields"><tbody>' + rows.map(function (d) {
        return '<tr><th>' + esc(d.label || d.key) + '</th><td>' + esc(vals[d.key]) + '</td></tr>';
      }).join("") + '</tbody></table>' : "") +
      (extra.length ? '<table class="appr-doc-fields"><tbody>' + extra.map(function (k) {
        return '<tr><th>' + esc(k) + '</th><td>' + esc(vals[k]) + '</td></tr>';
      }).join("") + '</tbody></table>' : "") +
      (vals.attachment ? '<p class="cms-hint">첨부 링크: <a href="' + esc(vals.attachment) + '" class="rowlink" style="text-decoration:underline">' + esc(vals.attachment) + '</a></p>' : "") +
      '<h3>본문</h3><div class="appr-doc-text">' + (doc.body ? esc(doc.body) : '<span class="muted">본문이 없습니다.</span>') + '</div>' +
      '<h3>결재선</h3>' +
      (steps.length ? '<ul class="appr-step-list">' + steps.map(function (s) {
        return '<li><div class="row1"><b>' + s.step_order + '차</b><span>' + esc(s.approver_name || "") +
          '</span><span class="badge st-' + esc(s.status) + '">' + esc(APPR_STEP[s.status] || s.status) + '</span>' +
          (s.acted_at ? '<span class="when">' + esc(String(s.acted_at).slice(0, 16).replace("T", " ")) + '</span>' : "") +
          '</div>' + (s.comment ? '<p class="note">' + esc(s.comment) + '</p>' : "") + '</li>';
      }).join("") + '</ul>' : '<p class="cms-hint">결재선이 없습니다.</p>') +
      '<h3>이력</h3>' +
      (logs.length ? '<ul class="appr-log-list">' + logs.map(function (l) {
        return '<li><span class="t">' + esc(String(l.created_at || "").slice(0, 16).replace("T", " ")) +
          '</span><span class="a">' + esc(l.actor_name || "") + '</span><span>' + esc(APPR_LOG[l.action] || l.action) +
          '</span>' + (l.comment ? '<span>' + esc(l.comment) + '</span>' : "") + '</li>';
      }).join("") + '</ul>' : '<p class="cms-hint">아직 이력이 없습니다.</p>') +
      '<div class="cms-modal-foot"><a class="btn btn-ghost btn-sm" href="/#/approvals" target="_blank" rel="noopener">결재함에서 보기</a>' +
        '<span class="spacer"></span><button type="button" class="btn btn-primary btn-sm" id="appr-doc-close">닫기</button></div>' +
    '</div>';
    var close = $("#appr-doc-close");
    if (close) close.addEventListener("click", closeApprDoc);
  }

  var APPR_LOG = { create: "기안 작성", submit: "상신", approve: "승인", reject: "반려", withdraw: "회수", view: "열람", comment: "의견",
                   agree: "합의", delegate: "대결", task: "일감 상태 변경", print: "인쇄", export: "내보내기" };

  function closeApprDoc() {
    var modal = $("#appr-doc-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("cms-lock");
    APPR.doc = null;
  }

  /* ---------- v4.1 — 전결 규정 · 대결 ---------- */
  function loadApprV41() {
    return Promise.all([
      sb.from("profiles").select("id,nickname,email,member_grade").limit(500),
      sb.from("approval_rules").select("*").order("form_code", { ascending: true }),
      sb.from("approval_delegates").select("*").order("starts_on", { ascending: false })
    ]).then(function (res) {
      var p = res[0], r = res[1], d = res[2];
      APPR.people = (p && !p.error && p.data) ? p.data : [];
      if (r && !r.error) { APPR.rules = r.data || []; APPR.missingV41 = false; }
      else { APPR.rules = []; APPR.missingV41 = true; }
      APPR.delegates = (d && !d.error && d.data) ? d.data : [];
      apprPaintPickers();
      renderApprRules();
      renderApprDelegates();
    }).catch(function () { APPR.missingV41 = true; renderApprRules(); renderApprDelegates(); });
  }

  function apprPersonName(id) {
    for (var i = 0; i < APPR.people.length; i++) {
      var p = APPR.people[i];
      if (p.id === id) return p.nickname || String(p.email || "").split("@")[0];
    }
    return id || "";
  }

  function apprPaintPickers() {
    var form = $("#appr-rule-form");
    if (form) {
      form.innerHTML = APPR.forms.map(function (f) {
        return '<option value="' + esc(f.code) + '">' + esc(f.name || f.code) + "</option>";
      }).join("");
    }
    var opts = APPR.people.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.nickname || String(p.email || "").split("@")[0]) + "</option>";
    }).join("");
    ["#appr-rule-approver", "#appr-dg-original", "#appr-dg-delegate"].forEach(function (sel) {
      var el = $(sel);
      if (el) el.innerHTML = opts;
    });
    var st = $("#appr-dg-start");
    if (st && !st.value) st.value = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  }

  function renderApprRules() {
    var body = $("#appr-rule-table tbody");
    var cnt = $("#appr-rule-count");
    if (!body) return;
    if (cnt) cnt.textContent = APPR.missingV41 ? "표 없음" : APPR.rules.length + "건";
    if (APPR.missingV41) {
      body.innerHTML = '<tr><td colspan="6" class="cms-hint">전결·대결 표가 아직 없습니다 — <code>supabase/16_v41_approvals_redmine.sql</code> 을 SQL Editor 에서 한 번 실행해 주세요.</td></tr>';
      return;
    }
    if (!APPR.rules.length) {
      body.innerHTML = '<tr><td colspan="6" class="cms-hint">등록된 전결 규정이 없습니다. 위에서 양식·금액 상한·결재자를 골라 추가해 보세요.</td></tr>';
      return;
    }
    body.innerHTML = APPR.rules.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '">' +
        "<td>" + esc(apprFormName(r.form_code)) + "</td>" +
        "<td>" + esc(Number(r.max_amount || 0).toLocaleString("ko-KR")) + "원</td>" +
        "<td>" + esc(apprPersonName(r.approver_id)) + "</td>" +
        "<td>" + esc(r.note || "") + "</td>" +
        '<td><input type="checkbox" class="appr-rule-active"' + (r.active !== false ? " checked" : "") + "></td>" +
        '<td class="cms-actions"><button type="button" class="rowlink appr-rule-del">삭제</button></td></tr>';
    }).join("");
    [].forEach.call(body.querySelectorAll(".appr-rule-active"), function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.closest("tr").getAttribute("data-id");
        sb.from("approval_rules").update({ active: cb.checked }).eq("id", id).then(function (res) {
          if (res.error) { apprMsg("바꾸지 못했습니다: " + res.error.message, "err"); return; }
          apprMsg("전결 규정을 " + (cb.checked ? "켰" : "껐") + "습니다.", "ok");
          loadApprV41();
        });
      });
    });
    [].forEach.call(body.querySelectorAll(".appr-rule-del"), function (b) {
      b.addEventListener("click", function () {
        var id = b.closest("tr").getAttribute("data-id");
        sb.from("approval_rules").delete().eq("id", id).then(function (res) {
          if (res.error) { apprMsg("지우지 못했습니다: " + res.error.message, "err"); return; }
          apprMsg("전결 규정을 지웠습니다.", "ok");
          loadApprV41();
        });
      });
    });
  }

  function addApprRule() {
    var form = $("#appr-rule-form"), max = $("#appr-rule-max"), approver = $("#appr-rule-approver");
    if (!form || !form.value) { apprMsg("양식을 골라 주세요.", "err"); return; }
    var amount = max ? max.value.trim() : "";
    if (!amount || Number(amount) < 0) { apprMsg("금액 상한을 적어 주세요.", "err"); return; }
    if (!approver || !approver.value) { apprMsg("전결 결재자를 골라 주세요.", "err"); return; }
    sb.from("approval_rules").insert({
      form_code: form.value, max_amount: Number(amount), approver_id: approver.value,
      approver_name: apprPersonName(approver.value),
      note: ($("#appr-rule-note").value || "").trim(), active: true
    }).then(function (res) {
      if (res.error) { apprMsg("추가하지 못했습니다: " + res.error.message, "err"); return; }
      apprMsg("전결 규정을 추가했습니다.", "ok");
      if (max) max.value = "";
      loadApprV41();
    });
  }

  function renderApprDelegates() {
    var body = $("#appr-delegate-table tbody");
    var cnt = $("#appr-delegate-count");
    if (!body) return;
    if (cnt) cnt.textContent = APPR.delegates.length + "건";
    if (!APPR.delegates.length) {
      body.innerHTML = '<tr><td colspan="6" class="cms-hint">등록된 대결이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = APPR.delegates.map(function (d) {
      return '<tr data-id="' + esc(d.id) + '">' +
        "<td>" + esc(apprPersonName(d.original_id)) + "</td>" +
        "<td>" + esc(apprPersonName(d.delegate_id)) + "</td>" +
        "<td>" + esc((d.starts_on || "").slice(0, 10) + " ~ " + (d.ends_on ? String(d.ends_on).slice(0, 10) : "제한 없음")) + "</td>" +
        "<td>" + esc(d.note || "") + "</td>" +
        '<td><input type="checkbox" class="appr-dg-active"' + (d.active !== false ? " checked" : "") + "></td>" +
        '<td class="cms-actions"><button type="button" class="rowlink appr-dg-del">삭제</button></td></tr>';
    }).join("");
    [].forEach.call(body.querySelectorAll(".appr-dg-active"), function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.closest("tr").getAttribute("data-id");
        sb.from("approval_delegates").update({ active: cb.checked }).eq("id", id).then(function (res) {
          if (res.error) { apprMsg("바꾸지 못했습니다: " + res.error.message, "err"); return; }
          loadApprV41();
        });
      });
    });
    [].forEach.call(body.querySelectorAll(".appr-dg-del"), function (b) {
      b.addEventListener("click", function () {
        var id = b.closest("tr").getAttribute("data-id");
        sb.from("approval_delegates").delete().eq("id", id).then(function (res) {
          if (res.error) { apprMsg("지우지 못했습니다: " + res.error.message, "err"); return; }
          apprMsg("대결을 지웠습니다.", "ok");
          loadApprV41();
        });
      });
    });
  }

  function addApprDelegate() {
    var o = $("#appr-dg-original"), d = $("#appr-dg-delegate");
    if (!o || !d || !o.value || !d.value) { apprMsg("원 결재자와 대결자를 골라 주세요.", "err"); return; }
    if (o.value === d.value) { apprMsg("원 결재자와 대결자는 달라야 합니다.", "err"); return; }
    var start = ($("#appr-dg-start").value || "").trim();
    if (!start) { apprMsg("시작일을 골라 주세요.", "err"); return; }
    sb.from("approval_delegates").insert({
      original_id: o.value, delegate_id: d.value, starts_on: start,
      ends_on: ($("#appr-dg-end").value || "").trim() || null,
      note: ($("#appr-dg-note").value || "").trim(), active: true
    }).then(function (res) {
      if (res.error) { apprMsg("추가하지 못했습니다: " + res.error.message, "err"); return; }
      apprMsg("대결을 추가했습니다.", "ok");
      loadApprV41();
    });
  }

  function initApprovalsAdmin() {
    var reload = $("#appr-reload");
    if (reload) reload.addEventListener("click", function () { APPR.loaded = false; loadApprovalsAdmin(true); });
    var add = $("#appr-form-new");
    if (add) add.addEventListener("click", function () { openApprForm(null); });
    var save = $("#appr-form-save");
    if (save) save.addEventListener("click", saveApprForm);
    var del = $("#appr-f-del");
    if (del) del.addEventListener("click", deleteApprForm);
    ["#appr-form-close-x", "#appr-form-cancel"].forEach(function (sel) {
      var b = $(sel);
      if (b) b.addEventListener("click", closeApprForm);
    });
    var dx = $("#appr-doc-close-x");
    if (dx) dx.addEventListener("click", closeApprDoc);
    var q = $("#appr-admin-q");
    if (q) q.addEventListener("input", renderApprDocs);
    var st = $("#appr-admin-status");
    if (st) st.addEventListener("change", renderApprDocs);
    var fm = $("#appr-form-modal");
    if (fm) fm.addEventListener("click", function (e) { if (e.target === fm) closeApprForm(); });
    var dm = $("#appr-doc-modal");
    if (dm) dm.addEventListener("click", function (e) { if (e.target === dm) closeApprDoc(); });
    var ra = $("#appr-rule-add");
    if (ra) ra.addEventListener("click", addApprRule);
    var da = $("#appr-dg-add");
    if (da) da.addEventListener("click", addApprDelegate);
    var tf = $("#appr-f-fields");
    if (tf) tf.addEventListener("blur", function () {
      var el = $("#appr-f-check");
      if (!el) return;
      try {
        var f = parseApprFields();
        el.textContent = "항목 " + f.length + "개 · " + f.map(function (x) { return x.key; }).join(", ");
      } catch (err) { el.textContent = err.message; }
    });
  }

  /* ---------------- 시작 ---------------- */
  /* ============================================================
     6. v2.2 — 조회수 · 최근 7일 통계 / 구독자 · 뉴스레터 (13_v22_newsletter_stats_i18n.sql)
     ============================================================ */
  var SUB = { rows: [], mode: "table", loaded: false };
  var NL = { picked: {} };
  var STATS = { loaded: false };

  /* ---------------- v3.0: GitHub 1GB 용량 예산 ----------------
     assets/repo-budget.json 은 scripts/check_repo_budget.py 가 만듭니다.
     화면 숫자는 언어와 상관없게(%, MB, 개수) 그리고 이름표만 KO/EN 번역합니다. */
  var BUDGET = { loaded: false };

  function fmtBytes(n) {
    if (n == null || isNaN(n)) return "–";
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + " GB";
    if (n >= 1048576) return (n / 1048576).toFixed(2) + " MB";
    if (n >= 1024) return Math.round(n / 1024).toLocaleString("en-US") + " KB";
    return n + " B";
  }

  function num(n) {
    return (n == null || isNaN(n)) ? "–" : Number(n).toLocaleString("en-US");
  }

  function loadBudget(force) {
    var msg = $("#budget-msg");
    if (BUDGET.loaded && !force) return Promise.resolve();
    if (BUDGET.inflight) return BUDGET.inflight;
    if (msg) { msg.textContent = ""; msg.className = "cms-toast"; }
    BUDGET.inflight = fetch("/assets/repo-budget.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) { renderBudget(d); BUDGET.loaded = true; })
      .catch(function () {
        if (msg) cmsMsg("budget-msg", "용량 자료(assets/repo-budget.json)를 읽지 못했습니다. scripts/check_repo_budget.py 를 실행해 주세요.", "err");
      })
      .then(function () { BUDGET.inflight = null; });
    return BUDGET.inflight;
  }

  function renderBudget(d) {
    var u = d.usage || {}, p = d.post || {}, cap = d.capacity || {}, g = d.git || {};
    var pct = Number(u.percent || 0);
    var el;
    if ((el = $("#budget-percent"))) el.textContent = pct.toFixed(2) + "%";
    if ((el = $("#budget-fill"))) {
      el.style.width = Math.max(1.5, Math.min(100, pct)) + "%";
      var bar = el.parentNode;
      if (bar && bar.classList) bar.className = "budget-bar" + (pct >= 4 ? " warn" : "");
    }
    if ((el = $("#budget-tree"))) el.textContent = fmtBytes(u.treeBytes);
    if ((el = $("#budget-posts"))) el.textContent = num(p.count);
    if ((el = $("#budget-post-bytes"))) el.textContent = fmtBytes(p.bytes);
    if ((el = $("#budget-avg"))) el.textContent = fmtBytes(p.avgBytes);
    if ((el = $("#budget-capacity"))) el.textContent = "≈ " + num(cap.postsToBudget);
    if ((el = $("#budget-git-size"))) el.textContent = fmtBytes(u.gitBytes);
    if ((el = $("#budget-stamp"))) el.textContent = (d.commit || "–") + " · " + String(d.generatedAt || "").slice(5, 16).replace("T", " ");
  }

  /* ---------------- v6.0: 첫 화면 전송량 · 월 트래픽 ----------------
     assets/traffic-budget.json 은 scripts/measure_traffic.py 가 만듭니다(300KB 예산 · 월 100GB 대비 %). */
  var TRAFFIC = { loaded: false };

  function loadTraffic(force) {
    var msg = $("#traffic-msg");
    if (TRAFFIC.loaded && !force) return Promise.resolve();
    if (TRAFFIC.inflight) return TRAFFIC.inflight;
    if (msg) { msg.textContent = ""; msg.className = "cms-toast"; }
    TRAFFIC.inflight = fetch("/assets/traffic-budget.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) { renderTraffic(d); TRAFFIC.loaded = true; })
      .catch(function () {
        if (msg) cmsMsg("traffic-msg", "전송량 자료(assets/traffic-budget.json)를 읽지 못했습니다. scripts/measure_traffic.py 를 실행해 주세요.", "err");
      })
      .then(function () { TRAFFIC.inflight = null; });
    return TRAFFIC.inflight;
  }

  function renderTraffic(d) {
    var after = d.after || {}, before = d.before || {}, gate = d.gate || {}, m = d.monthly || {}, live = d.live || {};
    var el;
    var bytes = Number(after.totalBytes || 0);
    var pct = Number(gate.usedPercent || 0);
    if ((el = $("#traffic-first"))) el.textContent = fmtBytes(bytes);
    if ((el = $("#traffic-percent"))) el.textContent = pct.toFixed(1) + "%";
    if ((el = $("#traffic-fill"))) {
      el.style.width = Math.max(1.5, Math.min(100, pct)) + "%";
      var bar = el.parentNode;
      if (bar && bar.classList) bar.className = "budget-bar" + (pct >= 90 ? " warn" : "");
    }
    if ((el = $("#traffic-before"))) el.textContent = fmtBytes(before.totalBytes);
    if ((el = $("#traffic-reduction"))) {
      el.textContent = (d.reductionPercent == null) ? "–" : (d.reductionPercent.toFixed(1) + "% ↓");
    }
    if ((el = $("#traffic-monthly"))) {
      el.textContent = (m.gbPerMonth == null) ? "–" : (Number(m.gbPerMonth).toFixed(2) + " GB");
    }
    if ((el = $("#traffic-cap"))) {
      el.textContent = (m.percentOfCap == null) ? "–" : (Number(m.percentOfCap).toFixed(2) + "%");
    }
    if ((el = $("#traffic-live"))) {
      el.textContent = live && live.totalBytes ? fmtBytes(live.totalBytes) : "–";
    }
    if ((el = $("#traffic-stamp"))) el.textContent = "v" + String(d.version || "") + " · " + String(d.generatedAt || "").slice(5, 16).replace("T", " ");
    if (!gate.ok && $("#traffic-msg")) {
      cmsMsg("traffic-msg", "첫 화면 전송량이 300KB 예산을 넘었습니다 — 스크립트·이미지·폰트를 줄여 주세요.", "err");
    }
  }

  function kstYmd(d) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) {
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    }
  }
  function isoDaysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
  function mdLabel(ymd) { var b = String(ymd).split("-"); return b.length === 3 ? (Number(b[1]) + "/" + Number(b[2])) : ymd; }

  /* ---------------- 조회수 · 최근 7일 ---------------- */
  function topPostsJob() {
    var base = "id,slug,title,category,is_published,deleted_at";
    return sb.from("posts").select(base + ",view_count").order("view_count", { ascending: false }).limit(5)
      .then(function (r) {
        if (!r.error) return { rows: r.data || [], withViews: true };
        return sb.from("posts").select(base).order("published_at", { ascending: false }).limit(5)
          .then(function (r2) { return { rows: r2.data || [], withViews: false }; });
      });
  }

  function loadStats() {
    if (!sb) return Promise.resolve();
    var topEl = $("#top-posts"), chart = $("#week-chart"), sum = $("#week-sum"), note = $("#stats-note"), stamp = $("#stats-stamp");
    if (topEl && !STATS.loaded) topEl.innerHTML = '<li class="muted">불러오는 중…</li>';
    var since = isoDaysAgo(7);
    function soft(p) { return p.then(function (r) { return r; }, function (e) { return { error: e }; }); }
    return Promise.all([
      topPostsJob(),
      soft(sb.from("comments").select("created_at,is_hidden").gte("created_at", since).limit(5000)),
      soft(sb.from("form_submissions").select("created_at,kind").gte("created_at", since).limit(5000))
    ]).then(function (res) {
      var top = res[0] || { rows: [], withViews: false };
      var rows = (top.rows || []).filter(function (p) { return !p.deleted_at; });

      /* TOP 5 */
      if (topEl) {
        topEl.innerHTML = rows.length ? rows.map(function (p, i) {
          return '<li><span class="rn">' + (i + 1) + '</span>' +
            '<span class="rname" title="' + esc(p.title) + '">' + esc(p.title) + '</span>' +
            '<b class="rc">' + (p.view_count == null ? "–" : p.view_count) + '</b></li>';
        }).join("") : '<li class="muted">아직 조회수가 기록된 글이 없습니다.</li>';
      }

      /* 최근 7일 접수·댓글 */
      var days = [];
      for (var i = 6; i >= 0; i--) days.push(kstYmd(new Date(Date.now() - i * 86400000)));
      function byDay(list) {
        var m = {};
        (list || []).forEach(function (x) {
          var k = kstYmd(new Date(x.created_at));
          if (!k) return;
          m[k] = (m[k] || 0) + 1;
        });
        return m;
      }
      var subsRow = (res[2] && res[2].data) ? res[2].data : [];
      var cmtRow = ((res[1] && res[1].data) ? res[1].data : []).filter(function (c) { return !c.is_hidden; });
      var sMap = byDay(subsRow), cMap = byDay(cmtRow);
      var max = 1;
      days.forEach(function (d) { max = Math.max(max, sMap[d] || 0, cMap[d] || 0); });
      if (chart) {
        chart.innerHTML = '<div class="wk-legend"><span class="wk-k wk-s">접수</span><span class="wk-k wk-c">댓글</span></div>' +
          '<div class="wk-row">' + days.map(function (d) {
            var s = sMap[d] || 0, c = cMap[d] || 0;
            return '<div class="wk-day" title="' + esc(d) + ' · 접수 ' + s + '건 · 댓글 ' + c + '건">' +
              '<div class="wk-bars">' +
                '<i class="wk-b wk-s" style="height:' + Math.round((s / max) * 100) + '%"></i>' +
                '<i class="wk-b wk-c" style="height:' + Math.round((c / max) * 100) + '%"></i>' +
              "</div>" +
              '<span class="wk-lb">' + esc(mdLabel(d)) + "</span></div>";
          }).join("") + "</div>";
      }
      if (sum) {
        var sTotal = subsRow.length, cTotal = cmtRow.length;
        sum.textContent = "최근 7일 접수 " + sTotal + "건 · 댓글 " + cTotal + "건";
      }
      if (note) {
        note.textContent = top.withViews
          ? "글 조회수(increment_post_view)와 최근 7일 접수·댓글 흐름입니다. GA4 를 열지 않아도 여기서 바로 봅니다."
          : "posts.view_count 열이 아직 없어 조회수는 –로 보입니다. supabase/13_v22_newsletter_stats_i18n.sql 을 실행하면 쌓이기 시작합니다. 최근 7일 접수·댓글은 지금도 셉니다.";
      }
      if (stamp) stamp.textContent = "7일 · " + mdLabel(days[0]) + "~" + mdLabel(days[6]);
      STATS.loaded = true;
    });
  }

  /* ---------------- 구독자 ---------------- */
  function normSub(x) {
    return {
      email: String(x.email || "").toLowerCase().trim(),
      name: x.name || "",
      status: x.status === "unsubscribed" ? "unsubscribed" : "subscribed",
      source: x.source || (x.payload && x.payload.source) || "",
      page: x.page_slug || "",
      note: x.note || "",
      created_at: x.first_at || x.created_at || ""
    };
  }

  function subNote(fallback) {
    var el = $("#sub-note");
    if (!el) return;
    el.textContent = fallback
      ? "newsletter_subscribers 표가 아직 없어 form_submissions 의 구독 신청을 읽기 전용으로 보여 줍니다. supabase/13_v22_newsletter_stats_i18n.sql 을 실행하면 상태(구독 중·해지)를 직접 바꿀 수 있습니다."
      : "Supabase newsletter_subscribers · 관리자만 읽고 고칩니다. 해지로 바꿔도 명부에서 지우지 않습니다.";
  }

  function loadSubscribers(force) {
    if (!sb) return Promise.resolve();
    if (SUB.loaded && !force) { renderSubscribers(); ensureNewsletterPicks(); return Promise.resolve(); }
    var body = $("#sub-table tbody");
    if (body) body.innerHTML = '<tr class="empty-row"><td colspan="6">불러오는 중…</td></tr>';
    function soft(p) { return p.then(function (r) { return r; }, function (e) { return { error: e }; }); }
    return soft(sb.from("newsletter_subscribers").select("*").order("first_at", { ascending: false }).limit(2000))
      .then(function (r) {
        if (!r.error) {
          SUB.mode = "table";
          SUB.rows = (r.data || []).map(normSub).filter(function (x) { return x.email; });
          SUB.loaded = true;
          subNote(false);
          renderSubscribers();
          ensureNewsletterPicks();
          return;
        }
        return soft(sb.from("form_submissions").select("id,kind,email,name,payload,page_slug,created_at")
          .eq("kind", "newsletter").order("created_at", { ascending: false }).limit(2000)).then(function (r2) {
          SUB.mode = "form";
          var seen = {};
          SUB.rows = ((r2 && r2.data) || []).map(normSub).filter(function (x) {
            if (!x.email || seen[x.email]) return false;
            seen[x.email] = 1;
            return true;
          });
          SUB.loaded = true;
          subNote(true);
          renderSubscribers();
          ensureNewsletterPicks();
        });
      });
  }

  function renderSubscribers() {
    var body = $("#sub-table tbody");
    if (!body) return;
    var q = (($("#sub-q") || {}).value || "").trim().toLowerCase();
    var st = (($("#sub-status") || {}).value || "");
    var rows = SUB.rows.filter(function (x) {
      if (st && x.status !== st) return false;
      if (!q) return true;
      return (x.email + " " + x.name).toLowerCase().indexOf(q) >= 0;
    });
    var on = SUB.rows.filter(function (x) { return x.status === "subscribed"; }).length;
    var off = SUB.rows.length - on;
    var thisMonth = kstYmd(new Date()).slice(0, 7);
    var fresh = SUB.rows.filter(function (x) { return String(x.created_at).slice(0, 7) === thisMonth; }).length;
    if ($("#sub-k-on")) $("#sub-k-on").textContent = on;
    if ($("#sub-k-off")) $("#sub-k-off").textContent = off;
    if ($("#sub-k-new")) $("#sub-k-new").textContent = fresh;
    if ($("#sub-count")) $("#sub-count").textContent = rows.length === SUB.rows.length
      ? "전체 " + SUB.rows.length + "명" : rows.length + " / " + SUB.rows.length + "명";
    if ($("#sub-stamp")) $("#sub-stamp").textContent = "구독 중 " + on + "명 · " + (SUB.mode === "table" ? "명부" : "접수 기록");
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">' +
        (SUB.rows.length ? "조건에 맞는 구독자가 없습니다." : "아직 구독 신청이 없습니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (x) {
      var badge = x.status === "unsubscribed"
        ? '<span class="badge b-off">해지</span>' : '<span class="badge b-ok">구독 중</span>';
      var ctrl = SUB.mode === "table"
        ? '<select class="admin-select sub-status-sel" data-email="' + esc(x.email) + '" aria-label="구독 상태">' +
            '<option value="subscribed"' + (x.status === "subscribed" ? " selected" : "") + '>구독 중</option>' +
            '<option value="unsubscribed"' + (x.status === "unsubscribed" ? " selected" : "") + '>해지</option></select>'
        : "";
      return "<tr>" +
        '<td class="ellip" data-th="이메일"><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + "</a></td>" +
        '<td data-th="이름">' + esc(x.name || "–") + "</td>" +
        '<td data-th="상태">' + badge + "</td>" +
        '<td class="muted" data-th="경로">' + esc(x.source || "–") + (x.page ? " · " + esc(x.page) : "") + "</td>" +
        '<td class="muted" data-th="신청일">' + esc(String(x.created_at || "").slice(0, 10) || "–") + "</td>" +
        '<td class="row-actions">' + ctrl + "</td></tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".sub-status-sel"), function (sel) {
      sel.addEventListener("change", function () { setSubStatus(sel.getAttribute("data-email"), sel.value); });
    });
  }

  function setSubStatus(email, status) {
    var row = null;
    for (var i = 0; i < SUB.rows.length; i++) if (SUB.rows[i].email === email) row = SUB.rows[i];
    if (!row) return;
    var prev = row.status;
    row.status = status === "unsubscribed" ? "unsubscribed" : "subscribed";
    sb.from("newsletter_subscribers").update({ status: row.status, updated_at: new Date().toISOString() }).eq("email", email)
      .then(function (r) {
        if (r.error) {
          row.status = prev;
          renderSubscribers();
          cmsMsg("sub-msg", "구독 상태를 저장하지 못했습니다: " + r.error.message, "err");
          return;
        }
        renderSubscribers();
        cmsMsg("sub-msg", "구독 상태를 저장했습니다.", "ok");
      }, function (e) {
        row.status = prev;
        renderSubscribers();
        cmsMsg("sub-msg", "구독 상태를 저장하지 못했습니다: " + (e && e.message || "권한을 확인해 주세요."), "err");
      });
  }

  function downloadSubCsv() {
    var head = ["이메일", "이름", "상태", "신청 경로", "페이지", "신청일"];
    var lines = [head.join(",")].concat(SUB.rows.map(function (x) {
      return [x.email, x.name, x.status === "unsubscribed" ? "해지" : "구독 중", x.source, x.page,
        String(x.created_at || "").slice(0, 10)].map(function (c) {
        return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"';
      }).join(",");
    }));
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subscribers-" + kstYmd(new Date()) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    cmsMsg("sub-msg", "구독자 " + SUB.rows.length + "명을 CSV 로 내려받았습니다.", "ok");
  }

  /* ---------------- 뉴스레터 만들기 ---------------- */
  function nlPosts() {
    return (CMS.posts || []).filter(function (p) {
      return p && !p.deleted_at && p.is_published && p.status !== "draft" &&
        (!p.publish_at || new Date(p.publish_at).getTime() <= Date.now());
    }).sort(function (a, b) {
      var da = String(a.published_at || a.created_at || ""), db = String(b.published_at || b.created_at || "");
      if (da !== db) return da < db ? 1 : -1;
      return (b.sort_order || 0) - (a.sort_order || 0);
    });
  }

  function ensureNewsletterPicks() {
    var box = $("#nl-posts");
    if (!box) return;
    if (!CMS.loaded.posts) {
      box.innerHTML = '<li class="muted">글 목록을 불러오는 중…</li>';
      loadPosts().then(renderNewsletterPicks, renderNewsletterPicks);
      return;
    }
    renderNewsletterPicks();
  }

  function nlCount() {
    var n = Object.keys(NL.picked).length;
    var el = $("#nl-count");
    if (el) el.textContent = String(n);
    return n;
  }

  function renderNewsletterPicks() {
    var box = $("#nl-posts");
    if (!box) return;
    var rows = nlPosts();
    if (!rows.length) {
      box.innerHTML = '<li class="muted">발행한 글이 없습니다. ‘게시판 관리’에서 글을 먼저 발행해 주세요.</li>';
      nlCount();
      return;
    }
    box.innerHTML = rows.map(function (p) {
      var slug = p.slug || String(p.id);
      var checked = NL.picked[slug] ? " checked" : "";
      var views = p.view_count == null ? "" : "👁 " + p.view_count;
      return '<li><label class="nl-pick"><input type="checkbox" data-nl="' + esc(slug) + '"' + checked + '>' +
        '<span class="nl-pick-main"><b>' + esc(p.title || "") + '</b><span class="nl-pick-meta">' +
          esc([boardNameFor(p.category), String(p.published_at || "").slice(0, 10)].filter(Boolean).join(" · ")) +
        '</span></span><span class="nl-pick-views">' + esc(views) + "</span></label></li>";
    }).join("");
    [].forEach.call(box.querySelectorAll("[data-nl]"), function (cb) {
      cb.addEventListener("change", function () {
        var k = cb.getAttribute("data-nl");
        if (cb.checked) NL.picked[k] = true; else delete NL.picked[k];
        nlCount();
      });
    });
    nlCount();
  }

  function nlPickAll(mode) {
    NL.picked = {};
    var rows = nlPosts();
    if (mode === "all") rows.forEach(function (p) { NL.picked[p.slug || String(p.id)] = true; });
    else if (mode === "recent") rows.slice(0, 5).forEach(function (p) { NL.picked[p.slug || String(p.id)] = true; });
    renderNewsletterPicks();
  }

  function nlBaseUrl() {
    return String(SC.siteUrl || "").replace(/\/+$/, "") || (location.origin && location.origin !== "null" ? location.origin : "");
  }
  function nlPlain(s) {
    return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  function nlLink(slug) {
    return nlBaseUrl() + "/#/post/" + encodeURIComponent(slug);
  }
  function nlIsoDate() { return kstYmd(new Date()); }

  /* 메일 앱 호환: 표(table) 레이아웃 + 인라인 스타일만 사용합니다. */
  function nlBuild() {
    var subject = (($("#nl-subject") || {}).value || "").trim() || (brandName() + " 소식");
    var lead = (($("#nl-lead") || {}).value || "").trim();
    var foot = (($("#nl-foot") || {}).value || "").trim() || "구독을 해지하시려면 이 메일에 답장해 주세요.";
    var rows = nlPosts().filter(function (p) { return NL.picked[p.slug || String(p.id)]; });
    var items = rows.map(function (p) {
      var slug = p.slug || String(p.id);
      var link = nlLink(slug);
      var sum = nlPlain(p.summary || p.body || "");
      if (sum.length > 220) sum = sum.slice(0, 220).trim() + "…";
      var img = p.image_url
        ? '<td width="132" valign="top" style="padding:0 14px 0 0;"><a href="' + esc(link) + '" style="text-decoration:none;">' +
          '<img src="' + esc(p.image_url) + '" width="118" alt="" style="display:block;width:118px;max-width:118px;height:auto;border:0;border-radius:8px;"></a></td>'
        : "";
      return '<tr><td style="padding:18px 0;border-bottom:1px solid #e8e2da;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' + img +
        '<td valign="top">' +
          '<div style="font-size:12px;color:#a08b7c;letter-spacing:.04em;margin-bottom:4px;">' +
            esc([boardNameFor(p.category), String(p.published_at || "").slice(0, 10)].filter(Boolean).join(" · ")) + "</div>" +
          '<a href="' + esc(link) + '" style="color:#3E2F26;font-size:17px;line-height:1.35;font-weight:bold;text-decoration:none;">' +
            esc(p.title || "") + "</a>" +
          (sum ? '<div style="color:#6b5b50;font-size:14px;line-height:1.65;margin:8px 0 10px;">' + esc(sum) + "</div>" : '<div style="height:10px;"></div>') +
          '<a href="' + esc(link) + '" style="display:inline-block;background:#3E2F26;color:#ffffff;font-size:13px;' +
            'text-decoration:none;padding:9px 16px;border-radius:6px;">글 읽기 →</a>' +
        "</td></tr></table></td></tr>";
    }).join("");
    var base = nlBaseUrl();
    var html = [
      "<!DOCTYPE html>",
      '<html lang="ko"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      "<title>" + esc(subject) + "</title></head>",
      '<body style="margin:0;padding:0;background:#f4f1ec;">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1ec;"><tr><td align="center" style="padding:24px 12px;">',
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;">',
      '<tr><td style="padding:26px 28px 6px;">',
      '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#C86D44;font-weight:bold;">' + esc(brandName()) + "</div>",
      '<h1 style="margin:10px 0 0;font-size:23px;line-height:1.35;color:#3E2F26;">' + esc(subject) + "</h1>",
      (lead ? '<p style="margin:10px 0 0;font-size:14px;line-height:1.7;color:#6b5b50;">' + esc(lead) + "</p>" : ""),
      "</td></tr>",
      '<tr><td style="padding:6px 28px 0;">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + items + "</table>",
      "</td></tr>",
      '<tr><td style="padding:22px 28px 28px;">',
      '<p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#8a7768;">' + esc(foot) + "</p>",
      '<p style="margin:0;font-size:12px;line-height:1.7;color:#a08b7c;">' + esc(brandName()) +
        (base ? ' · <a href="' + esc(base) + '" style="color:#a08b7c;">' + esc(base.replace(/^https?:\/\//, "")) + "</a>" : "") +
        " · " + esc(nlIsoDate()) + "</p>",
      "</td></tr>",
      "</table></td></tr></table></body></html>"
    ].join("\n");
    return { html: html, count: rows.length, subject: subject, bytes: new Blob([html]).size };
  }

  function nlPreview() {
    var out = nlBuild();
    if (!out.count) { cmsMsg("nl-msg", "담을 글을 하나 이상 골라 주세요.", "err"); return null; }
    var box = $("#nl-preview");
    if (box) { box.innerHTML = out.html; box.hidden = false; }
    cmsMsg("nl-msg", "미리보기 — 글 " + out.count + "개 · HTML " + fmtBytes(out.bytes), "ok");
    return out;
  }

  function nlCopy() {
    var out = nlPreview();
    if (!out) return;
    copyText(out.html).then(function () {
      cmsMsg("nl-msg", "HTML 을 복사했습니다 — 메일 서비스의 HTML 편집기에 붙여 넣으세요.", "ok");
    }).catch(function () {
      cmsMsg("nl-msg", "복사하지 못했습니다. ‘HTML 내려받기’로 파일을 받아 주세요.", "err");
    });
  }

  function nlDownload() {
    var out = nlBuild();
    if (!out.count) { cmsMsg("nl-msg", "담을 글을 하나 이상 골라 주세요.", "err"); return; }
    downloadBlob("newsletter-" + nlIsoDate() + ".html", out.html, "text/html;charset=utf-8");
    cmsMsg("nl-msg", "뉴스레터 HTML 을 내려받았습니다 (글 " + out.count + "개 · " + fmtBytes(out.bytes) + ").", "ok");
  }

  function wireV22() {
    /* 이미지 압축 설정 — 미디어 탭과 글 편집기의 체크박스가 같은 값을 씁니다. */
    ["#img-original", "#pf-img-original"].forEach(function (sel) {
      var n = $(sel);
      if (!n) return;
      n.checked = imgKeepOriginal();
      n.addEventListener("change", function () { imgSetKeepOriginal(n.checked); });
    });

    /* KO / English 탭 */
    [].forEach.call(document.querySelectorAll("#pf-langtabs [data-plang]"), function (b) {
      b.addEventListener("click", function () { postLangPane(b.getAttribute("data-plang")); });
    });
    [].forEach.call(document.querySelectorAll("#pg-langtabs [data-plang]"), function (b) {
      b.addEventListener("click", function () { pageLangPane(b.getAttribute("data-plang")); });
    });

    /* 대시보드 통계 */
    var sr = $("#stats-reload");
    if (sr) sr.addEventListener("click", function () { STATS.loaded = false; loadStats(); });
    var br = $("#budget-reload");
    if (br) br.addEventListener("click", function () { loadBudget(true); });
    var tr = $("#traffic-reload");
    if (tr) tr.addEventListener("click", function () { loadTraffic(true); });

    /* 구독자 */
    var subReload = $("#sub-reload");
    if (subReload) subReload.addEventListener("click", function () { SUB.loaded = false; loadSubscribers(true); });
    var subQ = $("#sub-q");
    if (subQ) subQ.addEventListener("input", renderSubscribers);
    var subSt = $("#sub-status");
    if (subSt) subSt.addEventListener("change", renderSubscribers);
    var subCsv = $("#sub-csv");
    if (subCsv) subCsv.addEventListener("click", downloadSubCsv);

    /* 뉴스레터 */
    var nlAll = $("#nl-all");
    if (nlAll) nlAll.addEventListener("click", function () { nlPickAll("all"); });
    var nlNone = $("#nl-none");
    if (nlNone) nlNone.addEventListener("click", function () { nlPickAll("none"); });
    var nlRecent = $("#nl-recent");
    if (nlRecent) nlRecent.addEventListener("click", function () { nlPickAll("recent"); });
    var nlPrev = $("#nl-preview-go");
    if (nlPrev) nlPrev.addEventListener("click", nlPreview);
    var nlCp = $("#nl-copy");
    if (nlCp) nlCp.addEventListener("click", nlCopy);
    var nlDl = $("#nl-download");
    if (nlDl) nlDl.addEventListener("click", nlDownload);
  }

  function start() {
    if (booted) return;
    booted = true;

    /* 기능 스위치 — sbpress.config.json features */
    [
      ["tasks", "tasks"], ["comments", "comments"], ["plugins", "plugins"]
    ].forEach(function (pair) {
      if (feature(pair[0])) return;
      [].forEach.call(document.querySelectorAll('[data-tab="' + pair[1] + '"]'), function (b) { b.hidden = true; });
      var view = document.getElementById("tab-" + pair[1]);
      if (view) view.hidden = true;
    });
    if (!feature("sheets")) {
      var sheetPanel = $("#p-sheet");
      if (sheetPanel) sheetPanel.hidden = true;
    } else {
      var sheetOpen = $("#sheet-open");
      if (sheetOpen && SHEET_URL) sheetOpen.href = SHEET_URL;
      var sheetNote = $("#sheet-note");
      if (sheetNote) sheetNote.textContent = SHEET_LABEL + " · 구글 시트 실시간 조회";
      var sheetHref = $("#sheet-open");
      if (sheetHref && !SHEET_URL) sheetHref.hidden = true;
    }

    if (CONFIGURED && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(CFG.url, CFG.anonKey);
    }

    $("#google-btn").addEventListener("click", oauth);
    $("#pw-form").addEventListener("submit", passwordLogin);
    var outBtn = $("#logout-btn");
    if (outBtn) outBtn.addEventListener("click", logout);
    var reload = $("#reload-btn");
    if (reload) reload.addEventListener("click", function () { boot(true); });
    var csv = $("#member-csv");
    if (csv) csv.addEventListener("click", downloadCsv);
    var mq = $("#member-q");
    if (mq) mq.addEventListener("input", renderMembers);
    var sq = $("#sheet-q");
    if (sq) sq.addEventListener("input", renderSheet);
    var ss = $("#sheet-status");
    if (ss) ss.addEventListener("change", renderSheet);

    renderQuickLinks();
    initCms();
    initRsvAdmin();
    initApprovalsAdmin();

    if (sb) {
      sb.auth.onAuthStateChange(function (evt, s) {
        if (evt === "SIGNED_OUT") {
          session = null; isAdmin = false;
          setWho("", false);
          renderGate("anon");
        }
      });
    }
    boot(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
