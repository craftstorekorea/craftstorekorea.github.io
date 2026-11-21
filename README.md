# 전국공방 · 우리동네공방

전국 공방의 주간 소식을 모아 보여주는 정적 웹사이트입니다.
Google Sites 버전(`https://sites.google.com/view/craftstore-kr`)과 비교하기 위해
GitHub Pages로 배포합니다.

- **사이트 주소**: https://craftstorekorea.github.io/
- **소식 기준**: 2026-11-13 ~ 2026-11-20 (매주 금요일 갱신)
- **뉴스레터 원본**: https://page.stibee.com/archives/252109

## 구성

| 탭 | 내용 |
|---|---|
| 홈 | 대표 이미지, 이번 주 주요 소식, 네 코너(소개·뉴스·인터뷰·정보) |
| 공방 소개 | 등록·확인된 공방 카드, 공예 분야, 소개 코너 기사 |
| 공방 뉴스 | 이번 주 검증된 공방·공예 뉴스 원문 링크 |
| 작가 인터뷰 | 확인된 인터뷰 인용과 원문 링크 |
| 아카이브 (2024–2026) | 뉴스레터 아카이브 8개 호·4개 코너 151건, 호/코너 필터 + 키워드 검색 |
| 지원·공모 | 마감일 기준 정렬, 분야 필터, D-day 자동 계산 |
| 지도·게시판 | 시·도 SVG 지도 + 공개 시트 연동 검색·필터 게시판 |
| 직접 만든 페이지 | `#/page/<slug>` — 제목·부제·본문·여러 이미지 갤러리 (관리자에서 생성) |
| 직접 만든 게시판 | `#/board/<slug>` — 게시판별 페이지당 글 수·댓글 정책 (관리자에서 생성) |
| 업무 관리 | `#/tasks` — 로그인한 회원의 3칸 업무 보드(할 일·진행 중·완료). **로그아웃 상태에서는 메뉴에 나타나지 않고**, 주소로 들어가도 로그인 안내만 보입니다 |

모든 게시판 목록(공방 소개·공방 뉴스·작가 인터뷰·지원·공모·직접 만든 게시판)은
게시판 설정의 **페이지당 글 수**만큼 보여 주고, 하단에 `이전 1 2 3 … 다음` 페이지 번호를 붙입니다.
`No. N` 번호는 페이지가 바뀌어도 이어집니다(2쪽 첫 글 = `No. 11`).

## 파일

```
index.html                한 페이지, 탭 여러 개(해시 라우팅) + KO|EN 전환
admin/index.html          관리자 페이지 → 주소는 /admin (.html 없이)
privacy/index.html        개인정보처리방침 → /privacy
terms/index.html          이용약관 → /terms
admin.html|privacy.html|terms.html   위 주소로 넘기는 얇은 리다이렉트 스텁(옛 링크용)
assets/styles.css         디자인 토큰과 전체 레이아웃
assets/app.js             렌더링·검색·필터·지도
assets/data.js            이번 주 소식·공방·정보 데이터 (여기만 고치면 됩니다)
assets/archive.js         뉴스레터 아카이브 2024–2026 (8개 호, 151건) 데이터
assets/korea-paths.js     시·도 경계 SVG 좌표 (KOSTAT 2013 단순화 데이터)
assets/hero-*.webp|jpg    대표 이미지
assets/admin.js           관리자 로직(Supabase 세션·is_admin·시트/D-day 집계 + CMS·게시판·댓글 관리)
assets/admin.css          관리자 화면 전용 레이아웃(모바일 카드형 표 포함)
assets/cms.js             Supabase 문구·글 불러오기, 댓글 버튼·드로어
assets/i18n.js            한국어/영어 사전과 KO|EN 스위치 (localStorage 'craft-lang')
assets/tasks.js           업무 관리 화면 (#/tasks) — 로그인·등급 게이트, 보드 CRUD
```

## 관리자 CMS · 댓글

- 사이트의 **문구·이미지**(`site_contents`), **게시판 글**(`posts`), **회원 댓글**(`comments`)은 Supabase에 있습니다.
  `assets/cms.js` 가 페이지를 열 때 읽어 반영하고, Supabase에 연결하지 못하면 `data.js` 기본값으로 보입니다.
- `/admin` 탭: **페이지 텍스트·이미지**(문구 수정·이미지 업로드) · **헤더 · 푸터 · Head**(로고·브랜드 이름·메뉴 순서/숨김/외부링크 + 메뉴 한국어/영어 이름, 회원 등급 이름·업무 관리 최소 등급, 푸터 회사 정보·SNS, `<head>` 코드) ·
  **게시판 관리**(글 작성·수정·발행/숨김·삭제, 상단 고정(PIN)·예약 발행, 글 번호 `No. N`) · **업무 관리**(전체 업무 보기·상태 변경·삭제) ·
  **미디어 라이브러리**(`site-media` 전체 파일 목록·썸네일·URL 복사·삭제·업로드) · **댓글 관리**(숨김/공개·삭제). 이미지는 Storage `site-media` 버킷에 올라갑니다.
- **회원 등급**: 대시보드 회원 목록에 각 회원의 등급 배지와 1·2·3단계 선택상자가 있습니다. 등급을 바꾸면 Supabase에 바로 저장됩니다.
  회원은 스스로 등급을 올릴 수 없고(서버 트리거가 거부), 관리자만 바꿀 수 있습니다. 등급 이름(기본 일반회원·정회원·특별회원(VIP))은 헤더 · 푸터 · Head 탭에서 바꿉니다.
- **업무 관리**: 로그인한 회원은 사이트 `#/tasks` 에서 업무를 추가하고 상태(할 일·진행 중·완료)·우선순위·마감일·담당을 관리합니다.
  `site_contents.tasks.min_grade`(기본 1)로 최소 등급을 정할 수 있고, 서버 RLS(`public.tasks`)가 같은 규칙을 강제합니다. **anon(비로그인)은 테이블 접근 자체가 없습니다.**
- **한국어/영어**: 헤더 오른쪽 `KO | EN` 으로 메뉴·검색 안내·페이지 번호·댓글 드로어·로그인 창·업무 보드의 UI 문구가 바뀝니다(선택은 `localStorage`에 유지).
  메뉴 이름은 `header_menu_items` 의 `label_ko`·`label_en` 을 쓰고, 글·공방 소개 같은 콘텐츠는 원문(한국어) 그대로입니다.
- **SEO · 공유**: `seo_title`·`seo_description`·`seo_og_image`·`seo_favicon_url` 키로 문서 제목, `meta description`, `og:title`·`og:description`·`og:image`, 파비콘을 바꿉니다(카톡 공유 썸네일).
- **포인트 색상 · 기간제 배너/팝업**: `theme_accent_color`(사이트 `--accent` 계열), `banner_enabled`·`banner_start_at`·`banner_end_at`(공지 띠배너),
  `popup_enabled`·`popup_title`·`popup_body`·`popup_image_url`·`popup_link`·`popup_start_at`·`popup_end_at`(팝업, ‘오늘 하루 보지 않기’는 `localStorage`).
- **공방 제보 원클릭 게시**: 대시보드의 `전국공방_등록_및_게시판DB` 표에서 승인된 행의 **게시판에 게시**를 누르면 `posts`(`소개`)에 들어가고, 같은 공방은 `게시됨`으로 표시됩니다(결정적 slug `sheet-…`).
- 헤더·푸터·head 설정은 `site_contents` 의 `header_*` · `footer_*` · `custom_head_html` 키에 저장됩니다.
  `custom_head_html` 은 사이트를 열 때 `<head>` 로 주입되며(중복 태그는 건너뜀), 메뉴 항목은 `header_menu_items` JSON(관리자 화면에서 편집)입니다.
- 공개 게시판 카드(소개·뉴스·인터뷰·정보·아카이브)에는 `No. N` 순번 배지가 붙습니다.
- **직접 만든 페이지**: `/admin` → 페이지 텍스트·이미지 탭의 **직접 만든 페이지**에서 제목·부제·본문과
  여러 장의 이미지(설명 포함)를 만들고 순서를 바꾸거나 지웁니다. 헤더 · 푸터 · Head 탭의 메뉴에서
  연결 대상에 `page/<slug>` 를 넣으면 메뉴에 나타납니다.
- **게시판 설정**: 게시판 관리 탭의 **게시판 설정**에서 게시판을 추가하고 이름·설명·페이지당 글 수·
  댓글 정책·사용 여부를 정합니다. 글의 ‘분류’가 곧 게시판이며, 추가한 게시판은 `#/board/<slug>` 로 열립니다.
  기본 4개 게시판(`intro`·`news`·`interview`·`info`)은 사이트 고정 화면이라 삭제할 수 없습니다.
- **댓글 권한 · 비회원 캡차**: 게시판마다 `all`(누구나) · `member`(로그인 회원만) · `off`(비활성화) 중 하나이고,
  게시판에 정하지 않은 곳은 `site_contents.comments.default_policy` 를 따릅니다.
  `all` 게시판에서 로그인하지 않은 방문자는 닉네임 + **그림 보안 문자(SVG)** 를 함께 적어 댓글을 남깁니다.
  정답은 서버(`captcha_challenges`, 10분 만료·1회용)에 해시로만 있고, 그림은 서버가 픽셀 사각형으로 그려
  응답에 정답 글자가 남지 않습니다. 확인·저장은 `submit_guest_comment()` RPC가 합니다.
- 모든 글·공방 카드에 `💬 댓글` 버튼이 붙습니다. 읽기는 누구나, 쓰기·본인 삭제는 로그인 회원(또는 캡차를 통과한 비회원),
  숨김·삭제 관리는 관리자 — 판단은 전부 Supabase RLS와 RPC가 합니다.
- 설정·검증 기록: `../supabase/07_cms.md` · `../supabase/08_grades_lang_tasks.md`, DB 파일 `../supabase/03_cms_comments.sql` · `../supabase/04_header_footer_head.sql` · `../supabase/05_cms_plus.sql` · `../supabase/06_pages_boards_captcha.sql` · `../supabase/07_grades_lang_tasks.sql`,
  테스트 `cd .. && CMS_TEST_MODE=user|admin|brand|plus|v2|v3|v3admin python3 cms_test.py`,
  서버 검증 `cd ../supabase && SUPABASE_MGMT_TOKEN=… python3 06_check.py` · `python3 07_check.py`.

## 관리자 페이지

- 주소: **https://craftstorekorea.github.io/admin** (푸터 "더 보기 → 관리자"). 예전 `/admin.html` 로 들어와도 새 주소로 넘어갑니다.
- 같은 방식으로 개인정보처리방침은 `/privacy`, 이용약관은 `/terms` 이고, 자산 경로는 `/assets/…` 로 통일했습니다(GitHub Pages 루트 도메인·로컬 `http.server` 모두 동작).
- `craftstore.kr@gmail.com` 계정으로 로그인하면 회원·찜·등록 현황이 보입니다.
- 관리자 판별과 데이터 접근은 Supabase RLS(`is_admin()` + `profiles_select_admin` / `bookmarks_select_admin`)가 서버에서 처리합니다.
  자세한 설정·검증 기록은 `../supabase/06_admin_page.md`.

## 게시판 데이터

- 공개 시트: `전국공방_등록_및_게시판DB`
  (`1OhA6nOWiBpbrQ01QcAJIoq_RT4iNk3JsgL6rKk8IAyY`)
- 페이지가 열릴 때 `gviz/tq?tqx=out:json`으로 읽어 **승인** 항목만 표시합니다.
- 시트에 연결하지 못하면 `data.js`에 들어 있는 확인된 목록을 그대로 보여줍니다.
- 좌표는 카카오맵 주소 검색으로 확인한 값이며, 좌표가 없는 항목은 시·도 중심에
  점선 없이 빈 점(지역 중심)으로 표시합니다.

## 갱신 방법

1. `assets/data.js`의 `news` / `interviews` / `info` 배열을 이번 주 자료로 교체
2. `updated`, `weekFrom`, `weekTo` 수정
3. 커밋 후 push (GitHub Pages가 자동 배포)

### 아카이브 갱신

- 원본: 구글 독스 `우리동네공방_뉴스레터_아카이브_정리_2024-2026`
  (`1GKTEYBFJAvM0vybZJ3w9p5ZAguBMkyzoy9etiaIyFtY`)
- 독스의 호 제목(①~⑧) · 코너(소개/뉴스/인터뷰/정보) · `•` 줄 항목을 그대로 옮겨
  `assets/archive.js`의 `issues`(호)와 `items`(기사)를 만듭니다. 항목 하나는
  제목 · 매체 · 알리미 수신일 · 한 줄 요약 · 원문 URL을 가집니다.
- 새 호를 추가할 때는 `issues`에 호를 넣고 `count`를 맞춘 뒤, 홈·아카이브의
  건수 문구(151건 등)를 함께 바꿉니다.
- 검증: `python3 check_archive.py` (카드 151건, 호·코너 필터, 검색, 콘솔 에러 0건)

## 등록

- 공방 등록 신청: https://docs.google.com/forms/d/e/1FAIpQLSfsAqB6xnd8iNofTPrmpF6XKYlWrb_vMhYaYuEvMup3IS2oiw/viewform
- 인스타그램: https://www.instagram.com/craftstore.kr
