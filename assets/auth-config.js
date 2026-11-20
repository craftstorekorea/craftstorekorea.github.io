/* 전국공방 · Supabase 연결 설정 (공개 값만 — anon key 는 브라우저 공개용 키입니다)
   Project Settings → API 에서 복사해 채웁니다. RLS 로 보호되므로 공개되어도 안전합니다. */
window.CRAFT_SUPABASE = {
  url: "",
  anonKey: "",
  // 네이버 로그인 브리지 (Supabase Edge Function) — 배포 후 주소를 넣습니다
  naverAuthUrl: ""
};
