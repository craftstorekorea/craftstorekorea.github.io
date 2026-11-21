/* ===== 전국공방 · 관리자 페이지 (/admin.html) =====
   - 로그인 게이트: Supabase 세션 + is_admin() RPC 로 관리자 판별
   - 관리자에게만: profiles / bookmarks 전체 조회(RLS 정책이 서버에서 막아 줌)
   - 구글 시트(등록·제보 DB)는 gviz 로 실시간 조회, data.js 의 마감 일정은 D-day 로 정렬
   의존: assets/supabase.js, assets/auth-config.js, assets/data.js, assets/archive.js
   주의: service_role 키나 비밀 값은 이 파일에 절대 넣지 않습니다. 공개(publishable) 키만 사용.
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var CONFIGURED = !!(CFG.url && CFG.anonKey);
  var SHEET_ID = "1OhA6nOWiBpbrQ01QcAJIoq_RT4iNk3JsgL6rKk8IAyY";
  var SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  var sb = null;
  var session = null;
  var isAdmin = false;
  var members = [];
  var bookmarks = [];
  var sheetRows = [];
  var booted = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) {
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
      $("#gate-desc").textContent = "전국공방 운영자 계정으로 로그인하면 회원·찜·등록 현황을 볼 수 있습니다.";
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
      });
    }).catch(function () { renderGate("error"); });
  }

  function loadAll(force) {
    var stamp = $("#dash-stamp");
    if (stamp) stamp.textContent = "불러오는 중…";
    Promise.all([loadMembers(), loadBookmarks(), loadSheet(), loadPostIndex()]).then(function () {
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

  function loadMembers() {
    var since = new Date(Date.now() - WEEK_MS).toISOString();
    return Promise.all([
      sb.from("profiles").select("id,email,nickname,provider,created_at").order("created_at", { ascending: false }).limit(1000),
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
    if (!window.fetch) { sheetRows = []; return Promise.resolve(); }
    if (note) note.textContent = "전국공방_등록_및_게시판DB · 불러오는 중…";
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
  function renderMembers() {
    var body = $("#member-table tbody");
    var note = $("#member-note");
    if (memberStats.error) {
      body.innerHTML = '<tr class="empty-row"><td colspan="5">회원 목록을 불러오지 못했습니다: ' + esc(memberStats.error) + "</td></tr>";
      return;
    }
    if (note) {
      note.innerHTML = "Supabase <code>profiles</code> · 전체 " + num(memberStats.total) +
        "명" + (memberStats.loaded < memberStats.total ? " (최근 " + num(memberStats.loaded) + "명 표시)" : "") +
        " · 관리자 권한 조회(RLS)";
    }
    var q = ($("#member-q").value || "").trim().toLowerCase();
    var rows = members.filter(function (m) {
      if (!q) return true;
      return (m.email || "").toLowerCase().indexOf(q) >= 0 || (m.nickname || "").toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="5">' + (members.length ? "검색 결과가 없습니다." : "아직 가입한 회원이 없습니다.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (m) {
      var isMe = session && session.user && m.id === session.user.id;
      return "<tr>" +
        '<td class="ellip" data-th="이메일">' + esc(m.email || "–") + (isMe ? ' <span class="badge b-admin">나</span>' : "") + "</td>" +
        '<td data-th="닉네임">' + esc(m.nickname || "–") + "</td>" +
        '<td data-th="로그인"><span class="badge b-off">' + esc(providerLabel(m.provider)) + "</span></td>" +
        '<td class="muted" data-th="가입일">' + esc(fmtDate(m.created_at)) + "</td>" +
        '<td class="num" data-th="찜">' + num(m.bookmarkCount) + "</td>" +
        "</tr>";
    }).join("");
  }

  function downloadCsv() {
    var head = ["이메일", "닉네임", "로그인", "가입일", "찜"];
    var lines = [head.join(",")].concat(members.map(function (m) {
      var cells = [m.email || "", m.nickname || "", providerLabel(m.provider), fmtDate(m.created_at), m.bookmarkCount || 0];
      return cells.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }));
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "전국공방_회원목록_" + todayKST() + ".csv";
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
      if (note) note.textContent = "전국공방_등록_및_게시판DB · 실시간 조회 실패";
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
      note.innerHTML = "전국공방_등록_및_게시판DB · 전체 " + num(sheetRows.length) + "건 (승인 " + num(ok) +
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
      source_name: "전국공방 등록 게시판",
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
    var links = [
      { t: "Google Analytics 4", s: "방문·유입 통계 (G-L7820HKGET)", h: "https://analytics.google.com/analytics/web/" },
      { t: "Supabase 대시보드", s: "haaikrynfrrwcpyuvrrr · DB·Auth", h: "https://supabase.com/dashboard/project/haaikrynfrrwcpyuvrrr" },
      { t: "Supabase 회원(Auth Users)", s: "가입자 확인·계정 삭제", h: "https://supabase.com/dashboard/project/haaikrynfrrwcpyuvrrr/auth/users" },
      { t: "전국공방_등록_및_게시판DB", s: "공방 등록·제보 승인 처리", h: SHEET_URL },
      { t: "전국공방_뉴스레터_구독자DB", s: "구독자 명단(비공개)", h: "https://docs.google.com/spreadsheets/d/1YHYIK76FVPGFXZle2mR2geV4_G3IDhD12U6H8mBA8PY/edit" },
      { t: "Google Cloud Console", s: "OAuth 클라이언트·키 관리", h: "https://console.cloud.google.com/apis/credentials?project=craftstore-kr" },
      { t: "Google Sites (전국공방)", s: "sites.google.com/view/craftstore-kr", h: "https://sites.google.com/view/craftstore-kr" },
      { t: "공방 등록 신청서", s: "응답자 링크", h: "https://docs.google.com/forms/d/e/1FAIpQLSfsAqB6xnd8iNofTPrmpF6XKYlWrb_vMhYaYuEvMup3IS2oiw/viewform" },
      { t: "GitHub 저장소", s: "craftstorekorea.github.io", h: "https://github.com/craftstorekorea/craftstorekorea.github.io" }
    ];
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
    customPages: [], boardRows: [], editingPage: null, editingBoard: null, pageImages: [],
    loaded: { pages: false, posts: false, comments: false, brand: false, media: false, boards: false },
    editing: null, commentCounts: {}, brand: null
  };

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
    ["dash", "pages", "brand", "posts", "media", "comments"].forEach(function (t) {
      var p = document.getElementById("tab-" + t);
      if (p) p.hidden = (t !== name);
    });
    if (name === "pages") { if (!CMS.loaded.pages) loadPages(); loadPageManager(); }
    if (name === "brand" && !CMS.loaded.brand) loadBrand();
    if (name === "posts") { if (!CMS.loaded.posts) loadPosts(); loadBoards(); }
    if (name === "media") loadMedia();
    if (name === "comments" && !CMS.loaded.comments) loadComments();
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) { /* noop */ }
  }

  /* ---------------- Storage 업로드 ---------------- */
  function uploadSiteImage(file, prefix) {
    if (!file) return Promise.reject(new Error("파일이 없습니다."));
    if (!/^image\//.test(file.type || "")) return Promise.reject(new Error("이미지 파일만 올릴 수 있습니다."));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("이미지는 5MB까지 올릴 수 있습니다."));
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    var path = prefix + "-" + Date.now().toString(36) + "." + ext;
    return sb.storage.from("site-media").upload(path, file, { upsert: true, contentType: file.type }).then(function (r) {
      if (r.error) throw new Error(r.error.message || "업로드 실패");
      var pub = sb.storage.from("site-media").getPublicUrl(path);
      var url = (pub && pub.data && pub.data.publicUrl) || "";
      if (!url) throw new Error("공개 주소를 받지 못했습니다.");
      return url;
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
  function loadMedia() {
    var box = $("#media-grid");
    if (!box || !sb) return Promise.resolve();
    box.innerHTML = '<p class="panel-msg">불러오는 중…</p>';
    cmsMsg("media-msg", "Storage site-media 를 읽는 중…");
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
          .filter(function (p) { return p.section !== BRAND_SECTION; });   // 헤더·푸터·head 는 전용 탭에서 편집합니다
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
        uploadSiteImage(file, "pages/" + key.replace(/[^a-z0-9._-]/gi, "-")).then(function (url) {
          p._i = url;
          var urlInput = box.querySelector('[data-url="' + key + '"]');
          if (urlInput) urlInput.value = url;
          paintPrev(key, url);
          markDirty(key, true);
          if (msg) msg.textContent = "업로드 완료 — ‘변경 저장’을 누르면 사이트에 반영됩니다.";
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
      if (cat && p.category !== cat) return false;
      if (st === "pub" && !p.is_published) return false;
      if (st === "hidden" && p.is_published) return false;
      if (!q) return true;
      return [p.title, p.source_name, p.region, p.slug, p.summary].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var tag = $("#posts-count");
    if (tag) tag.textContent = rows.length === CMS.posts.length ? "전체 " + CMS.posts.length + "건" : rows.length + " / " + CMS.posts.length + "건";
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="9">' + (CMS.posts.length ? "조건에 맞는 글이 없습니다." : "아직 글이 없습니다. ‘새 글 쓰기’로 시작해 보세요.") + "</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (p) {
      var n = CMS.commentCounts[p.slug] || 0;
      var no = noMap[p.slug || p.id];
      var sched = isFuture(p.publish_at);
      var flags = (p.is_pinned ? '<span class="pin-flag" title="상단 고정">📌</span>' : "") +
        (sched ? '<span class="badge b-wait" title="' + esc(String(p.publish_at).replace("T", " ").slice(0, 16)) + ' 공개">예약됨</span>' : "");
      return "<tr>" +
        '<td class="num" data-th="No."><span class="post-no">No. ' + (no || "–") + "</span></td>" +
        '<td data-th="상태"><span class="badge ' + (p.is_published ? "b-ok" : "b-off") + '">' + (p.is_published ? "발행" : "숨김") + "</span>" + flags + "</td>" +
        '<td data-th="분류">' + esc(boardNameFor(p.category)) + "</td>" +
        '<td class="ellip" data-th="제목" title="' + esc(p.title) + '">' + esc(p.title) + (p.image_url ? ' <span class="cms-img-dot" title="이미지 있음">IMG</span>' : "") + "</td>" +
        '<td class="muted" data-th="출처·지역">' + esc([p.source_name, p.region].filter(Boolean).join(" · ") || "–") + "</td>" +
        '<td class="muted" data-th="발행일">' + esc(p.published_at || "–") + "</td>" +
        '<td class="muted" data-th="마감">' + esc(p.deadline || "–") + "</td>" +
        '<td class="num" data-th="댓글">' + (n ? "<b>" + n + "</b>" : "0") + "</td>" +
        '<td><button type="button" class="rowlink cms-edit" data-id="' + esc(p.id) + '">수정</button></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".cms-edit"), function (b) {
      b.addEventListener("click", function () { openPostEditor(b.getAttribute("data-id")); });
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

  function openPostEditor(id) {
    var p = null;
    if (id) { for (var i = 0; i < CMS.posts.length; i++) if (CMS.posts[i].id === id) { p = CMS.posts[i]; break; } }
    CMS.editing = p;
    var m = p && p.meta ? p.meta : {};
    $("#post-modal-title").textContent = p ? "글 수정" : "새 글";
    setCategoryValue(p ? p.category : "뉴스");
    $("#pf-state").value = p ? String(!!p.is_published) : "true";
    $("#pf-title").value = p ? p.title : "";
    $("#pf-slug").value = p ? (p.slug || "") : "";
    $("#pf-summary").value = p ? (p.summary || "") : "";
    $("#pf-body").value = p ? (p.body || "") : "";
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
    $("#pf-is_pinned").checked = !!(p && p.is_pinned);
    $("#pf-publish_at").value = p && p.publish_at ? toLocalInput(p.publish_at) : "";
    paintPublishHint();
    paintPostPreview(p ? p.image_url : "");
    $("#pf-img-msg").textContent = "";
    $("#pf-msg").textContent = "";
    $("#post-delete").hidden = !p;
    syncPostFields();
    $("#post-modal").hidden = false;
    document.body.classList.add("cms-lock");
    setTimeout(function () { $("#pf-title").focus(); }, 50);
  }

  function closePostEditor() {
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

  function savePost(e) {
    if (e) e.preventDefault();
    var title = ($("#pf-title").value || "").trim();
    var cat = $("#pf-category").value;
    if (!title) { $("#pf-msg").textContent = "제목을 입력해 주세요."; $("#pf-title").focus(); return; }
    var prev = CMS.editing;
    var slug = ($("#pf-slug").value || "").trim() || (prev && prev.slug) || (catPrefix(cat) + "-" + Date.now().toString(36));
    var body = {
      slug: slug,
      category: cat,
      title: title,
      summary: ($("#pf-summary").value || "").trim() || null,
      body: ($("#pf-body").value || "").trim() || null,
      region: ($("#pf-region").value || "").trim() || null,
      source_name: ($("#pf-source_name").value || "").trim() || null,
      source_url: ($("#pf-source_url").value || "").trim() || null,
      image_url: ($("#pf-image_url").value || "").trim() || null,
      deadline: $("#pf-deadline").value || null,
      published_at: $("#pf-published_at").value || null,
      is_published: $("#pf-state").value === "true",
      is_pinned: !!($("#pf-is_pinned") && $("#pf-is_pinned").checked),
      publish_at: toIso($("#pf-publish_at").value),
      sort_order: parseInt($("#pf-sort_order").value || "0", 10) || 0,
      meta: {}
    };
    if (cat === "뉴스" || cat === "소개") body.meta.tag = ($("#pf-tag").value || "").trim();
    if (cat === "인터뷰") { body.meta.person = ($("#pf-person").value || "").trim(); body.meta.role = ($("#pf-role").value || "").trim(); }
    if (cat === "정보") { body.meta.kind = ($("#pf-kind").value || "").trim(); body.meta.period = ($("#pf-period").value || "").trim(); }

    var btn = $("#post-save");
    btn.disabled = true;
    $("#pf-msg").textContent = "저장하는 중…";
    var req = prev ? sb.from("posts").update(body).eq("id", prev.id) : sb.from("posts").insert(body);
    req.then(function (r) {
      btn.disabled = false;
      if (r.error) {
        $("#pf-msg").textContent = "저장 실패: " + r.error.message;
        return;
      }
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
    if (!window.confirm("‘" + p.title + "’ 글을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.")) return;
    $("#pf-msg").textContent = "삭제하는 중…";
    sb.from("posts").delete().eq("id", p.id).then(function (r) {
      if (r.error) { $("#pf-msg").textContent = "삭제 실패: " + r.error.message; return; }
      closePostEditor();
      CMS.loaded.posts = false;
      loadPosts().then(function () { cmsMsg("posts-msg", "글을 삭제했습니다.", "ok"); });
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
    if (!CMS.customPages.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="6">아직 직접 만든 페이지가 없습니다. ‘+ 새 페이지’로 시작해 보세요.</td></tr>';
      return;
    }
    body.innerHTML = CMS.customPages.map(function (p) {
      return "<tr>" +
        '<td class="num" data-th="순서">' + (p.sort_order || 0) + "</td>" +
        '<td data-th="주소"><code>' + esc(p.slug) + "</code>" +
          ' <a class="rowlink" href="../index.html#/page/' + esc(encodeURIComponent(p.slug)) + '" target="_blank" rel="noopener">보기</a></td>' +
        '<td class="ellip" data-th="제목" title="' + esc(p.title) + '">' + esc(p.title) + "</td>" +
        '<td class="num" data-th="이미지">' + pageImgCount(p) + "</td>" +
        '<td data-th="상태"><span class="badge ' + (p.is_published ? "b-ok" : "b-off") + '">' + (p.is_published ? "발행" : "숨김") + "</span></td>" +
        '<td><button type="button" class="rowlink page-edit" data-slug="' + esc(p.slug) + '">수정</button></td>' +
        "</tr>";
    }).join("");
    [].forEach.call(body.querySelectorAll(".page-edit"), function (b) {
      b.addEventListener("click", function () { openPageEditor(b.getAttribute("data-slug")); });
    });
  }

  function nextPageSort() {
    var max = 0;
    CMS.customPages.forEach(function (p) { if ((p.sort_order || 0) > max) max = p.sort_order || 0; });
    return max + 1;
  }

  function openPageEditor(slug) {
    var p = slug ? pageBySlugAdmin(slug) : null;
    CMS.editingPage = p;
    CMS.pageImages = (p && Array.isArray(p.images) ? p.images : []).map(function (im) {
      return { url: (im && im.url) || "", caption: (im && im.caption) || "" };
    }).filter(function (im) { return im.url; });
    $("#page-modal-title").textContent = p ? "페이지 수정" : "새 페이지";
    $("#pg-slug").value = p ? p.slug : "";
    $("#pg-slug").disabled = !!p;
    $("#pg-title").value = p ? p.title : "";
    $("#pg-subtitle").value = p ? (p.subtitle || "") : "";
    $("#pg-body").value = p ? (p.body || "") : "";
    $("#pg-sort").value = p ? (p.sort_order || 0) : nextPageSort();
    $("#pg-published").checked = p ? !!p.is_published : true;
    $("#pg-url").value = "";
    $("#pg-img-msg").textContent = "";
    $("#pg-msg").textContent = "";
    $("#page-delete").hidden = !p;
    renderPageImages();
    $("#page-modal").hidden = false;
    document.body.classList.add("cms-lock");
    setTimeout(function () { $("#pg-title").focus(); }, 50);
  }

  function closePageEditor() {
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
      images: CMS.pageImages.filter(function (im) { return im.url; }).map(function (im) {
        return { url: im.url, caption: (im.caption || "").trim() };
      }),
      is_published: $("#pg-published").checked,
      sort_order: parseInt($("#pg-sort").value || "0", 10) || 0
    };
    var btn = $("#page-save");
    btn.disabled = true;
    $("#pg-msg").textContent = "저장하는 중…";
    var req = p
      ? sb.from("pages").update(payload).eq("slug", p.slug)
      : sb.from("pages").insert(Object.assign({ slug: slug }, payload));
    req.then(function (r) {
      btn.disabled = false;
      if (r.error) { $("#pg-msg").textContent = "저장 실패: " + r.error.message; return; }
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
    if (!window.confirm("‘" + p.title + "’ 페이지를 삭제할까요?\n이미지 파일은 미디어 라이브러리에 남습니다. 되돌릴 수 없습니다.")) return;
    $("#pg-msg").textContent = "삭제하는 중…";
    sb.from("pages").delete().eq("slug", p.slug).then(function (r) {
      if (r.error) { $("#pg-msg").textContent = "삭제 실패: " + r.error.message; return; }
      closePageEditor();
      cmsMsg("page-msg", "페이지를 삭제했습니다: " + p.slug, "ok");
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

  function initCms() {
    [].forEach.call(document.querySelectorAll(".admin-tab"), function (b) {
      b.addEventListener("click", function () { activateTab(b.getAttribute("data-tab")); });
    });
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
      uploadSiteImage(f, "header/logo").then(function (url) {
        $("#logo-url").value = url;
        paintLogo(url);
        $("#logo-msg").textContent = "업로드 완료 — ‘변경 저장’을 누르면 사이트에 반영됩니다.";
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
      CMS.brand.menu.push({ label: "", target: "home", note: "", visible: true });
      renderMenuRows();
      var rows = document.querySelectorAll("#menu-rows .menu-row");
      var last = rows[rows.length - 1];
      var inp = last && last.querySelector('[data-f="label"]');
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
        $("#pg-img-msg").textContent = files.length + "장을 올렸습니다. ‘저장’을 누르면 페이지에 반영됩니다.";
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
      uploadSiteImage(f, "posts/" + catPrefix($("#pf-category").value)).then(function (url) {
        $("#pf-image_url").value = url;
        paintPostPreview(url);
        $("#pf-img-msg").textContent = "업로드 완료 — ‘저장’을 누르면 글이 반영됩니다.";
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
        cmsMsg("media-msg", "업로드 완료 — " + url, "ok");
        mediaFile.value = "";
        loadMedia();
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
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#post-modal").hidden) closePostEditor();
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
  var VIEW_TARGETS = ["home", "workshops", "news", "interview", "archive", "info", "map"];
  var DEFAULT_MENU = [
    { label: "홈", target: "home", visible: true, note: "" },
    { label: "공방 소개", target: "workshops", visible: true, note: "" },
    { label: "공방 뉴스", target: "news", visible: true, note: "" },
    { label: "작가 인터뷰", target: "interview", visible: true, note: "" },
    { label: "아카이브", target: "archive", visible: true, note: "2024–2026" },
    { label: "지원·공모", target: "info", visible: true, note: "" },
    { label: "지도·게시판", target: "map", visible: true, note: "" }
  ];
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
    return {
      label: String((it && it.label) || ""),
      target: String((it && it.target) || ""),
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
        '<input class="admin-input menu-label" data-f="label" value="' + esc(it.label) + '" placeholder="메뉴 이름" aria-label="' + (i + 1) + '번째 메뉴 이름" maxlength="20">' +
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
      return {
        label: (row.querySelector('[data-f="label"]').value || "").trim(),
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
      var label = (row.querySelector('[data-f="label"]').value || "").trim();
      var target = (row.querySelector('[data-f="target"]').value || "").trim();
      var note = (row.querySelector('[data-f="note"]').value || "").trim();
      var visible = !!row.querySelector('[data-f="visible"]').checked;
      if (!label && !target) continue;                       // 빈 줄은 무시
      if (!label) return { error: (i + 1) + "번째 줄에 메뉴 이름이 없습니다." };
      if (!target) target = "home";
      var isUrl = /^(https?:)?\/\//i.test(target) || /^mailto:/i.test(target);
      var view = target.replace(/^#\/?/, "").replace(/\/$/, "");
      var extra = /^page\/[A-Za-z0-9가-힣._-]+$/.test(view) || /^board\/[A-Za-z0-9가-힣._-]+$/.test(view);
      if (!isUrl && VIEW_TARGETS.indexOf(view) < 0 && !extra) {
        return { error: "‘" + label + "’ 의 연결 대상 \"" + target + "\" 을(를) 알 수 없습니다. " + VIEW_TARGETS.join(" · ") + " 또는 https:// 주소를 넣어 주세요." };
      }
      if (isUrl && target.indexOf("//") === 0) target = "https:" + target;
      menu.push({ label: label, target: isUrl ? target : view, note: note, visible: visible });
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

  /* ---------------- 시작 ---------------- */
  function start() {
    if (booted) return;
    booted = true;

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
