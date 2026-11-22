/* SBPress · Supabase 연결 설정 (하위 호환 shim)
   실제 값은 **sbpress.config.json · supabase** 에서 옵니다(assets/config.js 가 먼저 읽습니다).
   publishable/anon key 는 브라우저 공개 전제 키이며, 실제 보호는 Supabase RLS 가 담당합니다.
   service_role(비밀) 키는 이 파일에 절대 넣지 않습니다. */
(function () {
  "use strict";
  var cfg = window.SBPRESS_CONFIG || {};
  var sb = cfg.supabase || {};
  var prev = window.CRAFT_SUPABASE || {};
  window.CRAFT_SUPABASE = {
    url: sb.url || prev.url || "",
    anonKey: sb.anonKey || prev.anonKey || "",
    // 로그인 모달에 노출할 로그인 수단. 준비된 것만 넣습니다. (비우면 전부 노출)
    providers: Array.isArray(cfg.providers) ? cfg.providers : (prev.providers || ["google", "email"]),
    // 네이버 로그인 브리지 (Supabase Edge Function) — 배포 후 config 의 naverAuthUrl 에 넣습니다
    naverAuthUrl: cfg.naverAuthUrl || prev.naverAuthUrl || ""
  };
})();
