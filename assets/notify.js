/* ===== SBPress v5.0 · 인앱 알림함 (assets/notify.js) =====
   6-C 알림 — 헤더 🔔 + 미읽음 배지 + 드로어(목록·개별/전체 읽음·문서로 이동).
   · 데이터: public.notifications (본인·관리자 RLS). DB 트리거가 결재·일감·댓글·폼 접수를 넣습니다.
   · 새 알림: Supabase Realtime 구독(기본) + 60초 폴링 폴백. Realtime 을 못 쓰는 환경에서도 배지가 갱신됩니다.
   · SQL(17_v50)을 실행하지 않았으면 🔔 을 숨기고 콘솔 오류 없이 조용히 지나갑니다.
   · 마이페이지 수신 설정(#/mypage) — 종류별 on/off + 하루 1회 요약(daily_digest).
   의존: assets/i18n.js, assets/auth.js, assets/config.js
*/
(function () {
  "use strict";

  var CFG = window.CRAFT_SUPABASE || {};
  var API = CFG.url || "";
  var KEY = CFG.anonKey || "";
  var POLL_MS = 60000;

  function I(key, vars) {
    return window.CRAFT_I18N ? window.CRAFT_I18N.t(key, vars) : key;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

  function auth() { return window.CRAFT_AUTH || null; }
  function user() { return auth() && auth().user ? auth().user() : null; }
  function token() { return auth() && auth().token ? auth().token() : null; }

  var state = { list: [], unread: 0, missing: false, loaded: false, timer: null, channel: null, open: false };

  function rest(path, method, body, prefer) {
    var t = token();
    if (!API || !t) return Promise.reject(new Error("no_session"));
    var headers = { apikey: KEY, Authorization: "Bearer " + t, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    return fetch(API + "/rest/v1/" + path, {
      method: method || "GET", headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.hint)) || ("HTTP " + r.status));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------------- 배지 · 목록 ---------------- */
  function paintBadge() {
    var badge = $("#notify-badge");
    var area = $("#notify-area");
    if (!area) return;
    if (!user() || state.missing) { area.hidden = true; return; }
    area.hidden = false;
    if (!badge) return;
    if (state.unread > 0) {
      badge.hidden = false;
      badge.textContent = state.unread > 99 ? "99+" : String(state.unread);
      badge.setAttribute("aria-label", I("notify.unreadN", { n: state.unread }));
    } else {
      badge.hidden = true;
      badge.textContent = "0";
    }
    var bell = $("#notify-bell");
    if (bell) {
      bell.setAttribute("aria-label", state.unread ? I("notify.bellUnread", { n: state.unread }) : I("notify.bell"));
      bell.classList.toggle("has-unread", state.unread > 0);
    }
  }

  function label(kind) { return I("notify.kind." + kind); }
  function timeAgo(iso) {
    var t = Date.parse(String(iso || ""));
    if (!t) return "";
    var d = Math.max(0, Date.now() - t);
    var m = Math.floor(d / 60000);
    if (m < 1) return I("notify.now");
    if (m < 60) return I("notify.minAgo", { n: m });
    var h = Math.floor(m / 60);
    if (h < 24) return I("notify.hourAgo", { n: h });
    var dd = Math.floor(h / 24);
    if (dd < 7) return I("notify.dayAgo", { n: dd });
    var dt = new Date(t);
    return dt.getFullYear() + "." + ("0" + (dt.getMonth() + 1)).slice(-2) + "." + ("0" + dt.getDate()).slice(-2);
  }

  function paintDrawer() {
    var box = $("#notify-list");
    if (!box) return;
    var sum = $("#notify-sum");
    if (sum) sum.textContent = state.list.length ? I("notify.countN", { n: state.list.length, u: state.unread }) : "";
    if (state.missing) {
      box.innerHTML = '<div class="notify-empty"><b>' + esc(I("notify.missing.title")) + "</b><p>" +
        esc(I("notify.missing.desc")) + "</p><code>17_v50_drive_social_notify.sql</code></div>";
      return;
    }
    if (!state.list.length) {
      box.innerHTML = '<div class="notify-empty"><b>' + esc(I("notify.empty")) + "</b><p>" +
        esc(I("notify.emptyHint")) + "</p></div>";
      return;
    }
    box.innerHTML = state.list.map(function (n) {
      return '<article class="notify-row' + (n.is_read ? "" : " is-unread") + '" data-nid="' + esc(n.id) + '">' +
        '<span class="notify-dot" aria-hidden="true"></span>' +
        '<div class="notify-main"><div class="notify-row-head"><span class="notify-kind is-' + esc(n.kind) + '">' +
          esc(label(n.kind)) + "</span><time>" + esc(timeAgo(n.created_at)) + "</time></div>" +
          '<b class="notify-title">' + esc(n.title) + "</b>" +
          (n.body ? '<p class="notify-body">' + esc(n.body) + "</p>" : "") +
        "</div>" +
        (n.link ? '<span class="notify-go" aria-hidden="true">›</span>' : "") +
        "</article>";
    }).join("");
  }

  function openDrawer() {
    var dr = $("#notify-drawer");
    if (!dr) return;
    dr.hidden = false;
    state.open = true;
    document.body.classList.add("notify-open");
    var bell = $("#notify-bell");
    if (bell) bell.setAttribute("aria-expanded", "true");
    refresh();
    setTimeout(function () { var x = $("#notify-close"); if (x) x.focus(); }, 30);
  }
  function closeDrawer() {
    var dr = $("#notify-drawer");
    if (!dr) return;
    dr.hidden = true;
    state.open = false;
    document.body.classList.remove("notify-open");
    var bell = $("#notify-bell");
    if (bell) bell.setAttribute("aria-expanded", "false");
  }

  /* ---------------- 데이터 ---------------- */
  function load() {
    if (!user()) {
      state.list = []; state.unread = 0; state.missing = false; state.loaded = false;
      paintBadge(); paintDrawer();
      return Promise.resolve();
    }
    return rest("notifications?select=id,kind,title,body,link,is_read,created_at&order=created_at.desc&limit=30")
      .then(function (rows) {
        state.missing = false;
        state.list = Array.isArray(rows) ? rows : [];
        state.unread = state.list.filter(function (n) { return !n.is_read; }).length;
        state.loaded = true;
        /* 30건 밖의 미읽음도 배지에 반영 */
        return rest("notifications?select=id&is_read=eq.false", "GET", undefined, "count=exact")
          .then(function (more) {
            if (Array.isArray(more)) state.unread = Math.max(state.unread, more.length);
          })
          .catch(function () { /* 30건 기준으로 충분 */ });
      })
      .catch(function (e) {
        var msg = String((e && e.message) || "");
        if ((e && e.status === 404) || /does not exist|schema cache|relation/i.test(msg)) {
          state.missing = true;
          state.list = []; state.unread = 0;
        } else {
          state.missing = false;
        }
      })
      .then(function () { paintBadge(); paintDrawer(); stopRealtimeIfMissing(); });
  }

  function markRead(ids) {
    var body = { p_ids: ids && ids.length ? ids : null };
    return rest("rpc/mark_notifications_read", "POST", body)
      .catch(function () {
        /* RPC 가 없으면 직접 PATCH (RLS: 본인 것만) */
        var q = "notifications?is_read=eq.false";
        if (ids && ids.length) q += "&id=in.(" + ids.map(encodeURIComponent).join(",") + ")";
        return rest(q, "PATCH", { is_read: true }, "return=minimal");
      })
      .then(function () {
        state.list.forEach(function (n) {
          if (!ids || !ids.length || ids.indexOf(n.id) >= 0) n.is_read = true;
        });
        state.unread = state.list.filter(function (n) { return !n.is_read; }).length;
        paintBadge(); paintDrawer();
      });
  }

  function go(link) {
    if (!link) return;
    closeDrawer();
    var s = String(link);
    if (s.charAt(0) !== "#") {
      if (/^https?:/i.test(s)) { location.href = s; return; }
      location.hash = s.charAt(0) === "/" ? s : "#/" + s;
      return;
    }
    if (/^#\/approvals\?doc=/.test(s)) {
      var did = s.split("doc=")[1];
      location.hash = "#/approvals";
      setTimeout(function () {
        if (window.CRAFT_APPROVALS && window.CRAFT_APPROVALS.open) window.CRAFT_APPROVALS.open(decodeURIComponent(did));
      }, 500);
      return;
    }
    if (/^#\/tasks\?issue=/.test(s)) {
      var iid = s.split("issue=")[1];
      location.hash = "#/tasks";
      setTimeout(function () {
        if (window.CRAFT_TASKS && window.CRAFT_TASKS.openIssue) window.CRAFT_TASKS.openIssue(decodeURIComponent(iid));
      }, 600);
      return;
    }
    location.hash = s;
  }

  /* ---------------- Realtime · 폴링 ---------------- */
  function realtimeEnabled() {
    if (window.SBP && window.SBP.config && window.SBP.config.features &&
        window.SBP.config.features.realtime === false) return false;
    /* Realtime 은 wss(https) 에서만 씁니다. 로컬 http 검증·미리보기에서는 폴링만. */
    if (!/^https:\/\//i.test(String(API))) return false;
    return !!(window.supabase && window.supabase.createClient && API && KEY);
  }
  function stopRealtimeIfMissing() {
    if (!state.missing || !state.channel) return;
    try { state.channel.unsubscribe(); } catch (e) { /* noop */ }
    state.channel = null;
  }
  function startRealtime() {
    var u = user();
    if (!u || state.missing || state.channel || !realtimeEnabled()) return;
    try {
      var client = window.__sbNotifyClient;
      if (!client) {
        client = window.__sbNotifyClient = window.supabase.createClient(API, KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
      }
      state.channel = client.channel("sbpress-notify-" + u.id)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + u.id },
          function (payload) {
            if (payload && payload.new) {
              state.list.unshift(payload.new);
              state.list = state.list.slice(0, 30);
              state.unread += payload.new.is_read ? 0 : 1;
              paintBadge(); paintDrawer();
            } else { refresh(); }
          })
        .subscribe();
    } catch (e) {
      state.channel = null;         /* Realtime 이 막혀도 폴링이 받쳐 줍니다 */
    }
  }

  function refresh() {
    return load().then(function () {
      startRealtime();
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(function () {
        if (user()) refresh();
      }, POLL_MS);
    });
  }

  /* ---------------- 마이페이지 — 수신 설정 ---------------- */
  var KINDS = ["approval", "issue", "comment", "deadline", "recur", "form", "system"];

  function prefsHtml() {
    return '<section class="mp-card mp-notify" id="mp-notify">' +
      '<div class="mp-card-head"><h3>' + esc(I("notify.prefs.title")) + '</h3>' +
        '<span class="panel-tag" id="npref-state">' + esc(I("notify.prefs.loading")) + "</span></div>" +
      '<p class="mp-note">' + esc(I("notify.prefs.desc")) + "</p>" +
      '<div class="notify-prefs" id="npref-box">' +
        KINDS.map(function (k) {
          return '<label class="npref-row"><input type="checkbox" data-npref="' + k + '" checked> ' +
            '<span>' + esc(I("notify.kind." + k)) + '</span>' +
            '<em>' + esc(I("notify.prefs.kind." + k)) + "</em></label>";
        }).join("") +
        '<label class="npref-row"><input type="checkbox" id="npref-digest"> ' +
          '<span>' + esc(I("notify.prefs.digest")) + '</span><em>' + esc(I("notify.prefs.digestHint")) + "</em></label>" +
        '<div class="npref-foot"><button type="button" class="btn btn-primary btn-sm" id="npref-save">' +
          esc(I("notify.prefs.save")) + '</button><span class="mp-msg" id="npref-msg" role="status" aria-live="polite"></span></div>' +
      "</div></section>";
  }

  function mountPrefs(container) {
    var host = container || $("#mp-notify");
    if (!host) return;
    var u = user();
    if (!u) return;

    function setMsg(text, ok) {
      var el = $("#npref-msg");
      if (!el) return;
      el.textContent = text || "";
      el.className = "mp-msg" + (ok ? " ok" : "");
    }
    function fill(row) {
      var prefs = (row && row.prefs) || {};
      KINDS.forEach(function (k) {
        var cb = $('[data-npref="' + k + '"]', host);
        if (cb) cb.checked = prefs[k] !== false;
      });
      var d = $("#npref-digest", host);
      if (d) d.checked = !!(row && row.daily_digest);
    }

    rest("notification_prefs?select=prefs,daily_digest&user_id=eq." + encodeURIComponent(u.id))
      .then(function (rows) {
        var row = Array.isArray(rows) ? rows[0] : rows;
        fill(row || null);
        var st = $("#npref-state");
        if (st) st.textContent = row ? I("notify.prefs.on") : I("notify.prefs.defaultOn");
      })
      .catch(function (e) {
        var missing = (e && e.status === 404) || /does not exist|schema cache|relation/i.test(String(e && e.message));
        var st = $("#npref-state");
        if (st) st.textContent = missing ? I("notify.prefs.missing") : I("notify.prefs.error");
        if (missing) {
          var box = $("#npref-box", host);
          if (box) box.classList.add("is-disabled");
          $$("input,button", host).forEach(function (n) { n.disabled = true; });
        }
      });

    var save = $("#npref-save", host);
    if (save) save.addEventListener("click", function () {
      var prefs = {};
      KINDS.forEach(function (k) {
        var cb = $('[data-npref="' + k + '"]', host);
        prefs[k] = cb ? !!cb.checked : true;
      });
      var digest = $("#npref-digest", host);
      save.disabled = true;
      setMsg(I("notify.prefs.saving"));
      rest("notification_prefs?on_conflict=user_id", "POST", {
        user_id: u.id, prefs: prefs, daily_digest: !!(digest && digest.checked)
      }, "resolution=merge-duplicates,return=representation")
        .then(function () {
          save.disabled = false;
          setMsg(I("notify.prefs.saved"), true);
          var st = $("#npref-state");
          if (st) st.textContent = I("notify.prefs.on");
        })
        .catch(function (e) {
          save.disabled = false;
          setMsg(I("notify.prefs.saveFail") + " " + ((e && e.message) || ""));
        });
    });
  }

  /* ---------------- 뼈대 · 이벤트 ---------------- */
  function build() {
    if ($("#notify-drawer")) return;
    var dr = document.createElement("div");
    dr.id = "notify-drawer";
    dr.className = "notify-drawer";
    dr.hidden = true;
    dr.innerHTML =
      '<div class="notify-backdrop" data-notify-close="1"></div>' +
      '<aside class="notify-panel" role="dialog" aria-modal="true" aria-labelledby="notify-head">' +
        '<div class="notify-head"><h2 id="notify-head">' + esc(I("notify.title")) + "</h2>" +
          '<span class="notify-sum" id="notify-sum"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="notify-all">' + esc(I("notify.readAll")) + "</button>" +
          '<button type="button" class="notify-x" id="notify-close" data-notify-close="1" aria-label="' + esc(I("notify.close")) + '">×</button>' +
        "</div>" +
        '<div class="notify-list" id="notify-list"></div>' +
        '<div class="notify-foot"><a href="#/mypage" data-notify-close="1">' + esc(I("notify.prefsLink")) + "</a></div>" +
      "</aside>";
    document.body.appendChild(dr);

    dr.addEventListener("click", function (e) {
      if (e.target.closest("[data-notify-close]")) { closeDrawer(); return; }
      var row = e.target.closest(".notify-row");
      if (!row) return;
      var id = row.getAttribute("data-nid");
      var item = null;
      for (var i = 0; i < state.list.length; i++) if (state.list[i].id === id) item = state.list[i];
      if (!item) return;
      if (!item.is_read) {
        markRead([id]).then(function () { go(item.link); });
      } else {
        go(item.link);
      }
    });

    $("#notify-all").addEventListener("click", function () {
      if (!state.unread) return;
      markRead(null);
    });
    $("#notify-close").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) closeDrawer();
    });

    var bell = $("#notify-bell");
    if (bell) bell.addEventListener("click", function () { state.open ? closeDrawer() : openDrawer(); });
    paintBadge();
    paintDrawer();
  }

  function relabel() {
    var h = $("#notify-head"); if (h) h.textContent = I("notify.title");
    var all = $("#notify-all"); if (all) all.textContent = I("notify.readAll");
    var x = $("#notify-close"); if (x) x.setAttribute("aria-label", I("notify.close"));
    var foot = $(".notify-foot a"); if (foot) foot.textContent = I("notify.prefsLink");
    var bell = $("#notify-bell"); if (bell) bell.setAttribute("aria-label", I("notify.bell"));
  }

  function boot() {
    build();
    if (!API || !KEY) return;
    if (window.CRAFT_AUTH && window.CRAFT_AUTH.onChange) {
      window.CRAFT_AUTH.onChange(function () {
        if (user()) refresh();
        else {
          if (state.channel) { try { state.channel.unsubscribe(); } catch (e) { /* noop */ } state.channel = null; }
          load();
        }
      });
    } else {
      load();
    }
    if (window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
      window.CRAFT_I18N.onChange(function () {
        /* 언어가 바뀌면 드로어의 고정 문구만 제자리에서 바꿉니다(노드를 다시 만들면
           🔔 클릭 리스너가 겹쳐 열리자마자 닫히므로 만들지 않습니다). */
        relabel();
        paintBadge();
        paintDrawer();
      });
    }
  }

  window.CRAFT_NOTIFY = {
    boot: boot, refresh: refresh, open: openDrawer, close: closeDrawer,
    unread: function () { return state.unread; },
    list: function () { return state.list.slice(); },
    prefsHtml: prefsHtml, mountPrefs: mountPrefs,
    state: state
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
