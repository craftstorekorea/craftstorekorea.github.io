/* ===== SBPress · 글 공유 (assets/share.js) =====
   글 상세·정적 글 페이지의 ‘링크 복사 / 공유하기’ 버튼을 한 곳에서 처리합니다.
   - [data-sbp-copy]  : data-sbp-copy 값(또는 현재 주소)을 클립보드로 복사하고 토스트로 알립니다.
   - [data-sbp-share] : Web Share API(navigator.share)로 공유하고, 없거나 실패하면 링크 복사로 대신합니다.
   - 복사는 navigator.clipboard → (권한·비보안 상황) textarea + execCommand 순서로 시도합니다.
   의존 없음. index.html · 정적 글 페이지(post/*, p/*)가 함께 불러 씁니다.
*/
(function () {
  "use strict";

  var toastEl = null;
  var toastTimer = 0;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function toast(text, kind) {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = el("div", "sbp-toast");
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text || "";
    toastEl.className = "sbp-toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.className = "sbp-toast";
    }, 2600);
  }

  function legacyCopy(text) {
    try {
      var ta = el("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* 클립보드에 넣습니다. 성공하면 true 로 끝나는 Promise. */
  function copy(text) {
    var value = String(text == null ? "" : text);
    if (!value) return Promise.resolve(false);
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).then(function () { return true; })
        .catch(function () { return legacyCopy(value); });
    }
    return Promise.resolve(legacyCopy(value));
  }

  function currentUrl(btn) {
    var v = btn && btn.getAttribute("data-sbp-copy");
    var w = btn && btn.getAttribute("data-share-url");
    return w || v || location.href;
  }

  function doCopy(btn) {
    var url = currentUrl(btn);
    return copy(url).then(function (ok) {
      if (ok) toast("링크를 복사했습니다.", "ok");
      else toast("링크를 복사하지 못했습니다. 주소창의 주소를 복사해 주세요.", "err");
      return ok;
    });
  }

  function doShare(btn) {
    var url = btn.getAttribute("data-share-url") || currentUrl(btn);
    var title = btn.getAttribute("data-share-title") || document.title || "";
    var text = btn.getAttribute("data-share-text") || "";
    if (navigator.share) {
      var payload = { title: title, url: url };
      if (text) payload.text = text;
      return navigator.share(payload).catch(function (e) {
        /* 사용자가 공유 창을 닫은 경우(AbortError)는 조용히 넘어갑니다. */
        if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) return false;
        return doCopy(btn);
      });
    }
    toast("이 브라우저는 공유 창을 지원하지 않아 링크를 복사했습니다.", "ok");
    return doCopy(btn);
  }

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-sbp-share],[data-sbp-copy]") : null;
    if (!t) return;
    e.preventDefault();
    if (t.hasAttribute("data-sbp-share")) doShare(t);
    else doCopy(t);
  });

  /* 다른 스크립트(app.js 등)가 같은 동작을 쓸 수 있게 열어 둡니다. */
  window.SBP_SHARE = {
    copy: copy,
    toast: toast,
    share: function (opts) {
      var fake = el("button");
      if (opts && opts.url) fake.setAttribute("data-share-url", opts.url);
      if (opts && opts.title) fake.setAttribute("data-share-title", opts.title);
      return doShare(fake);
    },
    copyUrl: function (url) {
      var fake = el("button");
      fake.setAttribute("data-sbp-copy", url || location.href);
      return doCopy(fake);
    }
  };
})();
