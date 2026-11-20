/* 전국공방 · Supabase 연결 설정 (공개 값만 — publishable/anon key 는 브라우저 공개용 키입니다)
   Project Settings → API Keys 에서 복사해 채웁니다. RLS 로 보호되므로 공개되어도 안전합니다. */
window.CRAFT_SUPABASE = {
  url: "https://haaikrynfrrwcpyuvrrr.supabase.co",
  anonKey: "sb_publishable_h_LulYLMWm80M6ZfqMdc9w_jncYNhDe",
  // 로그인 모달에 노출할 로그인 수단. 준비된 것만 넣습니다. (비우면 전부 노출)
  // 구글·카카오를 연결하면 ["google", "kakao", "email"] 처럼 추가하세요.
  providers: ["email"],
  // 네이버 로그인 브리지 (Supabase Edge Function) — 배포 후 주소를 넣습니다
  naverAuthUrl: ""
};
