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
    Promise.all([loadMembers(), loadBookmarks(), loadSheet()]).then(function () {
      recount();
      renderMembers();
      renderPopular();
      renderDday();
      renderKpis();
      if (stamp) {
        stamp.textContent = "마지막 확인 " + new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
      }
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
      body.innerHTML = '<tr class="empty-row"><td colspan="7">시트에 연결하지 못했습니다(' + esc(sheetError) + '). <a class="rowlink" href="' + SHEET_URL + '" target="_blank" rel="noopener">시트에서 직접 보기</a></td></tr>';
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
      body.innerHTML = '<tr class="empty-row"><td colspan="7">조건에 맞는 항목이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var cls = r.status === "승인" ? "b-ok" : (r.status ? "b-wait" : "b-off");
      return "<tr>" +
        '<td data-th="상태"><span class="badge ' + cls + '">' + esc(r.status || "미지정") + "</span></td>" +
        '<td data-th="공방명">' + esc(r.name) + "</td>" +
        '<td class="muted" data-th="구분">' + esc(r.kind) + "</td>" +
        '<td data-th="분야">' + esc(r.craft || "–") + "</td>" +
        '<td data-th="지역">' + esc(r.region || "–") + "</td>" +
        '<td class="muted" data-th="접수">' + esc(r.whenShort || "–") + "</td>" +
        '<td><a class="rowlink" href="' + SHEET_URL + '#gid=0&range=A' + r.row + '" target="_blank" rel="noopener" title="시트에서 이 행 열기">시트</a></td>' +
        "</tr>";
    }).join("");
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
