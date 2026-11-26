/* ============================================================================
   SBPress v10.0 · Service Worker (PWA)
   ----------------------------------------------------------------------------
   · 정적 자산(CSS·JS·아이콘·폰트)  → 캐시 우선 (버전 키가 바뀌면 새로 받습니다)
   · 문서·콘텐츠(/, #/…, post/<slug>/) → 네트워크 우선 + 캐시 폴백 (오프라인이면 캐시)
   · /admin · 인증(auth) 요청        → 절대 캐시하지 않음 (항상 네트워크)
   · 최근 본 글: 페이지가 보내는 {type:"remember-post", url} 로 정적 글 주소를 담아 둡니다.
     (본문 자체는 assets/app.js 가 localStorage 에 남기고 #/offline 에서 읽습니다.)
   ============================================================================ */
"use strict";

var VERSION = "v10.12.1";
var CORE = "sbpress-core-" + VERSION;
var ASSETS = "sbpress-assets-" + VERSION;
var CONTENT = "sbpress-content-" + VERSION;
var SHELL = "/";

/* 첫 화면에 쓰는 것만 미리 담습니다(HTML·CSS·첫 로드 JS·아이콘·매니페스트). */
var PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/assets/styles.css",
  "/assets/config.js",
  "/assets/auth-config.js",
  "/assets/i18n.js",
  "/assets/auth.js",
  "/assets/data.js",
  "/assets/cms.js",
  "/assets/body-format.js",
  "/assets/share.js",
  "/assets/app.js",
  "/assets/notify.js",
  "/assets/plugins.js",
  "/assets/pwa.js",
  "/assets/fonts/nanum-gothic-400.woff2",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

/* 절대 캐시하지 않는 경로 — 관리자 화면과 인증 요청은 항상 최신이어야 합니다. */
var NEVER_CACHE = [
  /^\/admin(?:\.html)?(?:\/|$)/i,
  /^\/auth\//i,
  /^\/login(?:\/|$)/i,
  /^\/logout(?:\/|$)/i,
  /\/auth\/v1\//i,
  /^\/rest\/v1\/(?:rpc\/)?(?:admin|audit|approvals)/i
];

var ASSET_RE = /\.(?:css|js|mjs|png|jpe?g|webp|avif|svg|woff2?|ttf|ico|webmanifest)$/i;

self.addEventListener("install", function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(CORE);
    await Promise.all(PRECACHE.map(async function (url) {
      try {
        var res = await fetch(url, { credentials: "same-origin" });
        if (res && (res.ok || res.type === "opaque")) await cache.put(url, res);
      } catch (e) { /* 한 파일이 실패해도 설치는 계속합니다 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var keep = { CORE: 1, ASSETS: 1, CONTENT: 1 };
    var names = await caches.keys();
    await Promise.all(names.map(function (name) {
      var ours = name.indexOf("sbpress-") === 0;
      var current = name === CORE || name === ASSETS || name === CONTENT;
      return (ours && !current) ? caches.delete(name) : Promise.resolve(false);
    }));
    await self.clients.claim();
    void keep;
  })());
});

async function cacheFirst(request) {
  var cache = await caches.open(ASSETS);
  var hit = await cache.match(request, { ignoreSearch: true });
  var net = fetch(request).then(function (res) {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(function () { return null; });
  if (hit) {
    net.catch(function () {});
    return hit;
  }
  var res = await net;
  if (res) return res;
  return Response.error();
}

async function networkFirst(request, cacheName) {
  var cache = await caches.open(cacheName);
  try {
    var res = await fetch(request);
    if (res && res.ok && res.type !== "opaque") await cache.put(request, res.clone());
    return res;
  } catch (e) {
    var hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    /* 오프라인 첫 방문이라도 앱 껍데기(/)가 캐시에 있으면 열어 줍니다. */
    var shell = await caches.match(SHELL);
    if (shell) return shell;
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>오프라인</title>" +
      "<p style=\"font-family:sans-serif;padding:24px\">오프라인입니다. 연결이 돌아오면 새로고침해 주세요.</p>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;           // Supabase·GA4·외부 폰트는 손대지 않습니다

  var path = url.pathname;
  for (var i = 0; i < NEVER_CACHE.length; i++) {
    if (NEVER_CACHE[i].test(path)) return;                    // /admin · 인증 — 항상 네트워크
  }
  if (req.headers.get("authorization")) return;               // 인증 헤더가 붙은 요청도 캐시 제외

  var isDoc = req.mode === "navigate" || req.destination === "document";
  if (isDoc) { event.respondWith(networkFirst(req, CONTENT)); return; }
  if (path === "/" || path === "/index.html") { event.respondWith(networkFirst(req, CORE)); return; }
  if (ASSET_RE.test(path)) { event.respondWith(cacheFirst(req)); return; }
  event.respondWith(networkFirst(req, CONTENT));
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "remember-post" && data.url) {
    var path = new URL(data.url, self.location.origin).pathname;
    event.waitUntil((async function () {
      var cache = await caches.open(CONTENT);
      try {
        var res = await fetch(path, { credentials: "same-origin" });
        if (res && res.ok) await cache.put(path, res.clone());
      } catch (e) { /* 오프라인일 수 있습니다 */ }
    })());
  }
  if (data.type === "skip-waiting") self.skipWaiting();
});
