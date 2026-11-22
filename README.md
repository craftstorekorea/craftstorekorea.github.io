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
| 직접 만든 페이지 | `#/page/<slug>` — 제목·부제·본문·여러 이미지 + **hunmin 블록**(최신글·지도·구독/제보 폼·갤러리·텍스트)을 순서대로 조립 (관리자에서 생성) |
| 글 상세 | `#/post/<slug>` — 글 제목·요약·본문(마크다운·HTML 안전 렌더)·태그·댓글. 게시판 카드의 **글 보기** 로 들어갑니다 |
| 마이페이지 | `#/mypage` — 로그인한 회원의 닉네임(수정)·회원 등급·**내 찜 목록**(해제)·**내가 쓴 댓글**(글 링크). 헤더 사용자 메뉴에서 열립니다 |
| 직접 만든 게시판 | `#/board/<slug>` — 게시판별 페이지당 글 수·댓글 정책 (관리자에서 생성) |
| 업무 관리 | `#/tasks` — 로그인한 회원의 3칸 업무 보드(할 일·진행 중·완료). **로그아웃 상태에서는 메뉴에 나타나지 않고**, 주소로 들어가도 로그인 안내만 보입니다 |
| 통합 검색 (v2.1) | 헤더의 🔍 또는 `#/search?q=<검색어>` — 발행된 글(제목·요약·본문·태그·게시판)과 공개 페이지를 한 번에 찾고, 낱말을 띄어 쓰면 모두 들어간 글만 보여 줍니다. 결과는 그대로 링크로 공유할 수 있습니다 |

모든 게시판 목록(공방 소개·공방 뉴스·작가 인터뷰·지원·공모·직접 만든 게시판)은
게시판 설정의 **페이지당 글 수**만큼 보여 주고, 하단에 `이전 1 2 3 … 다음` 페이지 번호를 붙입니다.
`No. N` 번호는 페이지가 바뀌어도 이어집니다(2쪽 첫 글 = `No. 11`).

## 설정 파일 (SBPress v2.0)

사이트마다 다른 값은 **`sbpress.config.json` 한 파일**에 모여 있습니다. `assets/config.js` 가 다른 스크립트보다 먼저
이 파일을 읽어 `window.SBPRESS_CONFIG` 로 내주고, `auth-config.js`·`app.js`·`admin.js`·`cms.js`·`i18n.js`·`hunmin.js`·`plugins.js`
등이 그 값을 씁니다.

| 키 | 쓰이는 곳 |
|---|---|
| `siteName` · `siteTitle` · `tagline` · `description` | 문서 제목·OG·브랜드·기본 문구 |
| `siteUrl` | sitemap·rss·공유 주소(끝 `/` 없이) |
| `supabase.url` · `supabase.anonKey` | 로그인·DB (공개 키만, 보호는 RLS) |
| `ga4Id` | GA4 — **비우면 스크립트를 넣지 않습니다** |
| `providers` | 로그인 모달에 보일 수단(google·kakao·naver·email) |
| `defaultTheme` · `defaultLang` | 첫 화면 테마·언어(관리자 DB 값이 있으면 그 값 우선) |
| `features` | `map`·`tasks`·`mypage`·`plugins`·`comments`·`sheets` — false 면 탭·화면·요청 모두 끔 |
| `sheets` | 게시판 gviz 시트 ID·구독자 시트·등록 폼·뉴스레터 주소. `null` 이면 시트 화면 숨김 |
| `ownerEmail` | 관리자 화면 표시용(실제 권한은 DB `admin_users`) |
| `links` | 관리자 대시보드에 더할 바로가기 |

정적 페이지 생성기(`../build_static_seo.py`·`../build_feeds.py`)도 이 파일에서 Supabase 주소·사이트 주소·이름을 읽고,
CSP(`CSP_SITE`)를 그 Supabase 주소로 계산합니다. 주소를 바꾸면 `python3 ../build_static_seo.py --csp` 로
고정 페이지 CSP 를 다시 맞추세요.

> 같은 엔진을 다른 사이트로 복사할 때는 `craftstore_site/sbpress-template/`(범용 템플릿)과
> 그 안의 `init_sbpress.py` 를 씁니다. 설정·SQL·CSP·시작용 피드를 한 번에 만들어 줍니다.

## 파일

```
index.html                한 페이지, 탭 여러 개(해시 라우팅) + KO|EN 전환
sbpress.config.json       사이트 설정(v2.0) — 이름·주소·Supabase·GA4·기능 스위치 (assets/config.js 가 읽음)
admin.html                관리자 페이지 → 주소는 /admin (.html 없이)
privacy.html              개인정보처리방침 → /privacy
terms.html                이용약관 → /terms
admin/ · privacy/ · terms/  끝에 / 를 붙여 들어온 주소를 /admin · /privacy · /terms 로 넘기는 스텁
assets/styles.css         디자인 토큰과 전체 레이아웃
assets/config.js          sbpress.config.json 을 먼저 읽어 window.SBPRESS_CONFIG 로 노출 (브랜드·GA4 주입)
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
assets/hunmin.js          hunmin 블록 — 사이트 렌더(최신글·지도·폼·갤러리·텍스트) + 관리자 편집기
assets/body-format.js     본문 형식(text·markdown·html) 변환 + 화이트리스트 정화 — 공개 사이트·관리자 미리보기 공용
assets/editor.js          관리자 글·페이지 본문 툴바(굵게·기울임·제목·링크·목록·인용·이미지)·미리보기
assets/mypage.js          마이페이지 (#/mypage) — 내 정보·착·내가 쓴 댓글
assets/plugins.js         SBPress 플러그인 엔진 — 켜진 플러그인을 불러와 메뉴·카드·위젯·관리자 탭 훅을 겁니다
assets/plugins/*.js       기본 플러그인 4종 (읽기 시간 배지·맨 위로·추천 공방·데이터 내보내기)
plugins-market.json       플러그인 마켓 목록 (관리자에서 GitHub raw 주소로 바꿀 수 있습니다)
sitemap.xml | rss.xml     검색엔진·구독용 피드 (../build_static_seo.py 또는 ../build_feeds.py 가 생성)
post/<slug>/index.html    글 정적 SEO 페이지 (../build_static_seo.py)
p/<slug>/index.html       페이지 정적 SEO 페이지 (../build_static_seo.py)
```

> **왜 폴더가 아니라 루트 `.html` 파일인가** — GitHub Pages는 `/admin` 요청에 같은 이름의 파일
> (`admin.html`)을 폴더(`admin/index.html`)보다 먼저 돌려줍니다. 실제 페이지를 폴더에 두면
> `/admin` 은 루트 스텁이 열려 자기 자신으로 되돌아가는 고리가 됩니다. 그래서 실제 페이지는
> `admin.html`·`privacy.html`·`terms.html` 에 두고(주소는 `/admin`·`/privacy`·`/terms`),
> 폴더의 `index.html` 은 `/admin/` 처럼 끝에 `/` 를 붙여 들어온 주소만 받아 넘깁니다.

## v2.1 기능 (통합 검색·공유·접수함·백업·자동 SEO·KO/EN)

- **통합 검색** — `assets/app.js` 의 `#/search` 화면. `assets/cms.js` 의 `publicPosts()`·`publicPages()` 로 공개 자료만 색인합니다
  (휴지통·임시저장·예약 발행 제외). 제목·태그 일치를 더 높게 점수화하고, `<mark>` 로 검색어를 강조합니다.
- **글 공유** — `assets/share.js`. `[data-sbp-copy]`(링크 복사 · 토스트) · `[data-sbp-share]`(Web Share API, 없거나 실패하면 링크 복사).
  글 상세(`#/post/…`)와 정적 글 페이지(`post/<slug>/`)가 함께 씁니다. 정적 페이지 CSP 는 `script-src 'self'` 만 열어 `/assets/share.js` 만 허용합니다.
- **폼 접수함** — `/admin → 폼 접수함`. `public.form_submissions` 를 관리자 RLS 로 읽어 상태(새 접수·처리 중·완료)·관리 메모를 남기고 CSV 로 내려받습니다.
  `status`·`admin_note` 열이 없으면(마이그레이션 전) `is_handled`·`payload.__status`·`payload.__note` 로 같은 뜻을 남기고 화면에 안내합니다.
- **자동 임시저장** — 글·페이지 편집기를 4초마다, 입력이 멈추면 1.2초 뒤 `localStorage('sbp:draft:post:<id>')` 에 남깁니다.
  창이 닫혔다 다시 열면 ‘자동 저장된 임시본이 있습니다 · 복구 / 삭제’ 배너가 뜨고, 저장에 성공하면 초안을 지웁니다.
- **전체 백업/복원** — `/admin → 백업 · 복원`. `site_contents`·`pages`·`boards`·`posts` + `sbpress.config.json` 을 JSON 한 파일로 내려받고,
  복원은 파일을 먼저 검사(형식·행 모양·id/key)한 뒤 ‘덮어쓰는 것에 동의합니다’를 체크해야 실행됩니다(파일에 없는 자료는 지우지 않음).
- **자동 SEO 갱신** — `.github/workflows/sbpress-seo.yml` + `scripts/build_static_seo.py`·`scripts/build_feeds.py`.
  `main` 푸시(또는 수동 실행) 시 `post/`·`p/`·`sitemap.xml`·`rss.xml` 이 바뀌었을 때만 봇이 커밋합니다.
- **관리자 KO/EN** — `assets/admin-i18n.js`. `/admin` 오른쪽 위 `KO | EN`(public 사이트와 같은 `localStorage('craft-lang')`).
  화면의 UI 문구만 바꾸고 글 제목·회원 별명 같은 자료는 그대로 둡니다. 번역은 `tools_gen_admin_i18n.py` 의 사전(약 520개)과 규칙으로 만듭니다.

## 관리자 CMS · 댓글

- 사이트의 **문구·이미지**(`site_contents`), **게시판 글**(`posts`), **회원 댓글**(`comments`)은 Supabase에 있습니다.
  `assets/cms.js` 가 페이지를 열 때 읽어 반영하고, Supabase에 연결하지 못하면 `data.js` 기본값으로 보입니다.
- `/admin` 탭: **페이지 텍스트·이미지**(문구 수정·이미지 업로드) · **헤더 · 푸터 · Head**(로고·브랜드 이름·메뉴 순서/숨김/외부링크 + 메뉴 한국어/영어 이름, 회원 등급 이름·업무 관리 최소 등급, 푸터 회사 정보·SNS, `<head>` 코드) ·
  **게시판 관리**(글 작성·수정·발행/숨김·삭제, 상단 고정(PIN)·예약 발행, 글 번호 `No. N`) · **업무 관리**(전체 업무 보기·상태 변경·삭제) ·
  **미디어 라이브러리**(`site-media` 전체 파일 목록·썸네일·URL 복사·삭제·업로드) · **댓글 관리**(숨김/공개·삭제). 이미지는 Storage `site-media` 버킷에 올라갑니다.
- **게시판 글 편집기 — 리치 에디터·임시저장**: 본문 위 툴바(굵게·기울임·제목·링크·목록·인용·**이미지 삽입**)와 **미리보기**,
  **본문 형식**(일반 텍스트·마크다운·HTML)이 있습니다. 이미지는 `site-media` 에 올라가고 본문에 바로 들어갑니다.
  
- **상태 — 발행 · 임시저장 · 숨김**: `임시저장` 글은 관리자만 보고 공개 사이트·피드에는 나오지 않습니다(RLS).
  글 목록에 상태 배지와 `임시저장` 필터가 있고, 본문 형식이 있으면 `MD`/`HTML` 표시가 붙습니다.
- **안전 렌더**: 공개 사이트는 마크다운을 HTML 로 바꾸고 화이트리스트로 걸러 냅니다(`<script>`·`onerror`·`javascript:`·`<iframe>` 제거).
  글 상세는 `#/post/<slug>` 이고, 카드의 `글 보기` 로 들어갑니다.
- **관리자 관리(하위 관리자)**: 대시보드 **관리자 관리** 에서 `admin_users` 이메일을 추가·삭제합니다.
  소유자 `craftstore.kr@gmail.com` 은 뺄 수 없고, 관리자 0명도 서버가 막습니다.
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
- **테마 프리셋**: 헤더 · 푸터 · Head 탭 맨 위 **테마 · 디자인** 의 카드 3장(매거진형 · 공방/쇼케이스형 · 기관 소개형).
  `site_contents.theme.preset` 에 저장되고 `<body data-theme="…">` 로 색·모서리·목록 레이아웃이 바뀝니다.
- **hunmin 블록**: 페이지 편집기에서 `[최신글]`·`[지도]`·`[구독/제보 폼]`·`[이미지 갤러리]`·`[텍스트·배너]` 를
  추가하고 ↑/↓ 로 순서를 바꿉니다. 최신글은 공개 글을 실시간으로, 폼은 `rpc submit_form` 으로 접수합니다
  (관리자 페이지 탭의 **hunmin 폼 접수** 에서 확인).
- **휴지통 · 수정 이력**: 글·페이지의 `삭제` 는 휴지통(`deleted_at`)으로 옮기고, `🗑 휴지통 보기` 에서 복구·영구 삭제합니다.
  저장할 때마다 직전 상태가 `revisions` 에 남아 편집기의 **수정 이력 → 이 버전으로 복원** 으로 되돌릴 수 있습니다(관리자 전용).
- **sitemap.xml · rss.xml**: 사이트 루트의 정적 파일. `cd .. && python3 build_static_seo.py` 로 정적 페이지와 함께 갱신하거나,
  `python3 build_feeds.py` 로 피드만 만들어도 됩니다(둘 다 정적 주소 `/post/<slug>/`·`/p/<slug>/` 를 넣습니다).
  관리자 페이지 탭의 **검색엔진** 에서 미리보기·내려받기 합니다.
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
- **대댓글(답글)**: 댓글의 `답글` 을 누르면 부모 댓글 아래에 들여쓰기로 달립니다(`comments.parent_id`).
  회원과 비회원(캡차) 모두 쓸 수 있고 **한 단계**만 허용합니다(답글에 다시 답글 금지 — 서버 트리거가 거부).
- 설정·검증 기록: `../supabase/07_cms.md` · `../supabase/08_grades_lang_tasks.md` · `../supabase/09_plugins_market.md` · `../supabase/10_v12_editor_community.md`, DB 파일 `../supabase/03_cms_comments.sql` · `../supabase/04_header_footer_head.sql` · `../supabase/05_cms_plus.sql` · `../supabase/06_pages_boards_captcha.sql` · `../supabase/07_grades_lang_tasks.sql` · `../supabase/08_themes_hunmin_trash_revisions.sql` · `../supabase/10_v12_editor_community.sql`,
  테스트 `cd .. && CMS_TEST_MODE=user|admin|brand|plus|v2|v3|v3admin|v4|plugins|v6|v7|v8 python3 cms_test.py`,
  정적 SEO `cd .. && python3 build_static_seo.py` (검사 `--check`, 비우기 `--clean`),
  서버 검증 `cd ../supabase && SUPABASE_MGMT_TOKEN=… python3 06_check.py` · `07_check.py` · `08_check.py` · `09_check.py` · `10_check.py`.

## 플러그인 · 마켓

- `/admin` → **플러그인 · 마켓** 탭에서 브라우저 JS 플러그인을 1클릭으로 설치하고 켜고 끕니다.
  켜진 플러그인만 방문자의 브라우저에 내려가고, 목록은 Supabase `public.plugins` 에 있습니다.
- 마켓 목록 주소는 `site_contents.plugins.market_url` (기본 `/plugins-market.json`).
  GitHub raw 의 `plugins.json` 주소를 넣으면 그 저장소가 곧 마켓이 됩니다.
- 플러그인이 쓰는 훅: `addMenuItem`(헤더 메뉴) · `decorateCard`(카드) · `addWidget`(위젯 존
  `home-top`·`home-bottom`·`board-top`·`footer-top`·`floating`) · `addAdminTab`(관리자 탭) · `addCss`.
  하나가 실패해도 사이트는 멈추지 않고, 실패 내역은 `SBPress.status()` 에 남습니다.
- 설정·검증 기록: `../supabase/09_plugins_market.md`, DB `../supabase/09_plugins_market.sql`,
  서버 검증 `cd ../supabase && python3 09_check.py`.
- **v1.3 보안**: 플러그인 주소는 `https://` 또는 사이트 안 경로(`/`)만 허용되고(`http://`·`javascript:`·`data:` 는 DB 와 화면 모두 거부),
  직접 올린 외부 플러그인(`source='custom'`)은 **관리자 화면에서 실행하지 않습니다**(관리자 세션 보호). 기본·마켓 플러그인은 그대로 동작합니다.
  같은 출처 마켓 주소는 `/assets/plugins/…` 처럼 경로로 저장됩니다.

## 보안 (v1.3)

- **CSP**: `index.html`·`admin.html`·`privacy.html`·`terms.html`·정적 글·페이지 모두에 `<meta http-equiv="Content-Security-Policy">` 가 있습니다.
  `'unsafe-eval'` 없음 · `object-src 'none'` · `base-uri 'self'`. 정책 문자열은 `../build_static_seo.py` 의 `CSP_SITE`/`CSP_STATIC` 한 곳에서 관리하고,
  `python3 build_static_seo.py --csp` 로 4개 고정 페이지를 맞춥니다.
- **관리자 감사 로그**: 글·페이지·게시판·플러그인·관리자·사이트 문구를 바꾸면 DB 트리거가 `public.audit_logs` 에 남깁니다(관리자만 조회).
  `/admin` 대시보드의 **보안 · 감사 로그** 패널에서 최근 20건과 보안 상태 요약을 봅니다.
- **요청 속도 제한**: 캐프 15회/분 · 비회원 댓글 5건/분 · 폼 5건/분(같은 접속 기준, DB `rate_limits`).
- 자세한 기록·운영 방법: `../supabase/11_v13_security.md`, DB `../supabase/11_v13_security.sql`, 서버 검증 `cd ../supabase && python3 11_check.py`.

## 관리자 페이지

- 주소: **https://craftstorekorea.github.io/admin** (푸터 "더 보기 → 관리자"). `.html` 을 붙인 `/admin.html` 로 들어와도 같은 관리자 페이지가 열립니다.
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
