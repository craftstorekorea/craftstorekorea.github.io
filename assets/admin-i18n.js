/**
 * SBPress · 관리자 KO/EN 사전 (자동 생성 파일)
 *
 *  이 파일은 tools_gen_admin_i18n.py 가 만듭니다. 직접 고치면 다음 생성 때 덮어씁니다.
 *  문구를 바꾸려면 생성 스크립트의 PAIRS · RULES 를 고치고 다시 만드세요.
 */
/* ===== SBPress v2.1 · 관리자 페이지 KO/EN (assets/admin-i18n.js) =====
   /admin 의 모든 문구를 한국어 ↔ English 로 바꿉니다.
   - 이미 그려진 화면(정적 HTML)과 admin.js 가 나중에 그리는 표·모달·메시지까지
     MutationObserver 로 따라가며 바꿉니다.
   - 선택은 public 사이트와 같은 localStorage 키('craft-lang')에 남아 서로 연동됩니다.
   - 화면의 자료(글 제목·회원 별명 등 사이트 내용)는 건드리지 않습니다. UI 문구만 바꿉니다.
   - [data-sbp-brand] 처럼 사이트 이름이 들어가는 곳, 입력값(input/textarea/select)은 건너뜁니다.
*/
(function () {
  "use strict";

  var KEY = "craft-lang";
  var DICT = {
  "본문으로 바로가기": "Skip to content",
  "관리자": "Admin",
  "로그아웃": "Sign out",
  "사이트로": "View site",
  "세션을 확인하는 중…": "Checking your session…",
  "관리자 전용": "Admins only",
  "관리자 권한이 필요합니다": "Admin access required",
  "운영자 계정으로 로그인하면 회원·찜·등록 현황을 볼 수 있습니다.": "Sign in with the owner account to see members, bookmarks and registrations.",
  "지금 로그인한 계정": "Signed in as",
  "이 계정은 관리자가 아닙니다. 운영자 계정으로 다시 로그인해 주세요.": "This account is not an admin. Please sign in with the owner account.",
  "구글로 로그인": "Sign in with Google",
  "운영자 계정으로 다시 로그인": "Sign in with the owner account",
  "이메일로 로그인": "Sign in with email",
  "이메일": "Email",
  "비밀번호": "Password",
  "로그인": "Sign in",
  "관리자 계정:": "Admin account:",
  "이 페이지는 검색에 노출되지 않습니다(": "This page is not indexed (",
  "로그인했습니다. 권한을 확인합니다…": "Signed in. Checking permissions…",
  "로그인 중…": "Signing in…",
  "로그인 실패: ": "Sign-in failed: ",
  "이메일과 비밀번호를 모두 입력해 주세요.": "Enter both your email and password.",
  "대시보드": "Dashboard",
  "페이지 텍스트·이미지": "Page text · images",
  "헤더 · 푸터 · Head": "Header · footer · head",
  "게시판 관리": "Posts",
  "업무 관리": "Tasks",
  "미디어 라이브러리": "Media library",
  "댓글 관리": "Comments",
  "폼 접수함": "Form inbox",
  "백업 · 복원": "Backup · restore",
  "플러그인 · 마켓": "Plugins · market",
  "첫 화면 전송량 · 월 트래픽": "First-load payload · monthly traffic",
  "공개 첫 화면(/)이 내려받는 양을 300KB 예산과 GitHub Pages 월 100GB 한도에 견줍니다. scripts/measure_traffic.py 가 만든 assets/traffic-budget.json 을 읽습니다.": "Compares the payload of the public home page (/) with the 300KB budget and the 100GB monthly GitHub Pages cap. Reads assets/traffic-budget.json written by scripts/measure_traffic.py.",
  "첫 화면 전송량": "First-load transfer",
  "300KB 예산 대비": "Of the 300KB budget",
  "8단계 이전(v5.1)": "Before v6.0 (v5.1)",
  "감소율": "Reduction",
  "월 트래픽(3만 PV)": "Monthly (30k PV)",
  "월 100GB 대비": "Of 100GB per month",
  "브라우저 실측": "Measured in browser",
  "정적 자산은 gzip 전송량으로, 이미지·폰트는 원본 크기로 셉니다(첫 방문 1회 기준). 늘어나면 이미지·폰트·스크립트를 줄이세요.": "Static assets count as gzip transfer; images and fonts as raw size (one first visit). If it grows, trim images, fonts or scripts.",
  "전송량 자료(assets/traffic-budget.json)를 읽지 못했습니다. scripts/measure_traffic.py 를 실행해 주세요.": "Could not read assets/traffic-budget.json. Run scripts/measure_traffic.py.",
  "첫 화면 전송량이 300KB 예산을 넘었습니다 — 스크립트·이미지·폰트를 줄여 주세요.": "First-load transfer exceeds the 300KB budget — trim scripts, images or fonts.",
  "첫 화면 전송량이 300KB 예산을 넘었습니다": "First-load transfer exceeds the 300KB budget",
  "관리자 대시보드": "Admin dashboard",
  "회원·찜·등록 현황을 한 화면에서 봅니다.": "Members, bookmarks and registrations at a glance.",
  "새로고침": "Refresh",
  "총 회원 수": "Members",
  "총 찜 수": "Bookmarks",
  "등록 공방": "Workshops",
  "구글 시트 실시간": "Google Sheet, live",
  "발행 콘텐츠": "Published",
  "이번 주 + 아카이브": "This week + archive",
  "마감 임박": "Due soon",
  "7일 안에 마감": "Due within 7 days",
  "회원 목록": "Members",
  "· 관리자 권한으로 조회(RLS)": " · read with admin rights (RLS)",
  "닉네임": "Nickname",
  "등급": "Grade",
  "가입일": "Joined",
  "찜": "Saved",
  "인기 찜": "Most saved",
  "최근 찜": "Recent saves",
  "마감 임박 지원·공모": "Grants closing soon",
  "의 마감일 기준 자동 정렬": " sorted by deadline",
  "공방 제보·등록 현황": "Workshop submissions",
  "전체": "All",
  "승인": "Approved",
  "대기": "Pending",
  "시트 열기": "Open sheet",
  "상태": "Status",
  "공방명": "Workshop",
  "구분": "Type",
  "분야": "Craft",
  "지역": "Region",
  "접수": "Received",
  "게시": "Publish",
  "관리자 관리": "Admins",
  "관리자 추가": "Add admin",
  "메모": "Note",
  "추가일": "Added",
  "보안 · 감사 로그": "Security · audit log",
  "확인 중…": "Checking…",
  "요청 속도 제한": "Rate limit",
  "플러그인 주소": "Plugin URLs",
  "시각": "Time",
  "동작": "Action",
  "대상": "Target",
  "항목": "Field",
  "관리 바로가기": "Shortcuts",
  "GitHub 1GB 용량 예산": "GitHub 1 GB storage budget",
  "배포 트리·정적 글 HTML·assets 용량을 GitHub Pages 1GB 한도와 견줍니다. scripts/check_repo_budget.py 가 만든 assets/repo-budget.json 을 읽습니다.": "Compares the deploy tree, static post HTML and assets against the GitHub Pages 1 GB limit. Reads assets/repo-budget.json written by scripts/check_repo_budget.py.",
  "전체 사용률": "Used",
  "배포 트리": "Deploy tree",
  "정적 글": "Static posts",
  "정적 글 용량": "Post HTML size",
  "글당 평균": "Avg per post",
  "수용 가능 글": "Fits until budget",
  ".git 이력": ".git history",
  "정적 글 HTML 은 배포마다 다시 구워져 .git 이력이 빨리 늘어납니다. 한 달에 한 번 git gc --aggressive 로 압축하거나, 봇 커밋을 한 달 단위로 squash 하세요.": "Static post HTML is rebuilt on every deploy, so the .git history grows fast. Compact it once a month with git gc --aggressive, or squash bot commits monthly.",
  "용량 자료(assets/repo-budget.json)를 읽지 못했습니다. scripts/check_repo_budget.py 를 실행해 주세요.": "Could not read assets/repo-budget.json. Run scripts/check_repo_budget.py.",
  "홈·섹션의 제목과 문구, 대표 이미지를 바꿉니다. 저장하면 사이트에 바로 반영됩니다.": "Edit titles, copy and hero images. Saving applies to the site right away.",
  "되돌리기": "Revert",
  "변경 저장": "Save changes",
  "· 공개 읽기 / 관리자만 수정": " · public read / admin write",
  "직접 만든 페이지": "Custom pages",
  "+ 새 페이지": "+ New page",
  "순서": "Order",
  "주소(slug)": "Address (slug)",
  "제목": "Title",
  "이미지": "Images",
  "🗑 휴지통 보기": "🗑 Show trash",
  "검색엔진 · sitemap.xml / rss.xml": "Search engines · sitemap.xml / rss.xml",
  "sitemap.xml 미리보기": "Preview sitemap.xml",
  "sitemap.xml 내려받기": "Download sitemap.xml",
  "rss.xml 미리보기": "Preview rss.xml",
  "rss.xml 내려받기": "Download rss.xml",
  "hunmin 폼 접수": "hunmin form submissions",
  "페이지의": "Newsletter signups and workshop registrations that came through the",
  "[구독/제보 폼]": "[subscribe/report form]",
  "‘폼 접수함’ 탭": "Form inbox tab",
  "에서 상태·메모와 함께 관리합니다.": " above, with status and notes.",
  "폼 접수함 열기": "Open form inbox",
  "건 ·": "entries ·",
  "· 헤더·푸터·head 슬롯": " · header/footer/head slots",
  "테마 · 디자인": "Theme · design",
  "한 번 누르면 사이트 전체의 모양(여백·괘선·카드·제목 글꼴)이 바뀌고 바로 저장됩니다. 글·사진·메뉴는 그대로입니다.": "One click changes the whole look (spacing, rules, cards, heading font) and saves right away. Posts, photos and menus stay as they are.",
  "헤더 로고 · 이름": "Header logo · name",
  "기본 마크": "Default mark",
  "로고 이미지 올리기": "Upload logo image",
  "기본 마크로": "Default mark",
  "기본 마크로 돌아갑니다 — ‘변경 저장’을 눌러 주세요.": "Back to the default mark — press “Save changes”.",
  "브랜드 이름": "Brand name",
  "아래 작은 글씨": "Small line below",
  "선택": "optional",
  "회원 등급 · 업무 관리": "Member grades · tasks",
  "1단계 이름": "Grade 1 name",
  "2단계 이름": "Grade 2 name",
  "3단계 이름": "Grade 3 name",
  "업무 관리 최소 등급": "Minimum grade for tasks",
  "1단계부터 (로그인한 모든 회원)": "From grade 1 (any signed-in member)",
  "2단계부터 (정회원 이상)": "From grade 2 (full members)",
  "3단계만 (특별회원)": "Grade 3 only (special members)",
  "등급 설정 저장": "Save grade settings",
  "헤더 메뉴": "Header menu",
  "+ 메뉴 추가": "+ Add menu",
  "기본 메뉴로": "Default menu",
  "푸터 회사 정보": "Footer company details",
  "회사명 · 브랜드": "Company · brand",
  "대표자": "Representative",
  "사업자등록번호": "Business number",
  "전화번호": "Phone",
  "주소": "Address",
  "저작권 문구": "Copyright line",
  "비워 둔 항목은 사이트 푸터에 나오지 않습니다.": "Empty fields are left out of the site footer.",
  "푸터 SNS 링크": "Footer social links",
  "인스타그램": "Instagram",
  "유튜브": "YouTube",
  "블로그": "Blog",
  "페이스북": "Facebook",
  "X (트위터)": "X (Twitter)",
  "주소를 넣은 SNS만 아이콘과 함께 표시됩니다.": "Only social networks with a URL appear, with their icon.",
  "<head> 코드": "<head> code",
  "head 코드": "head code",
  "소개·뉴스·인터뷰·정보 글을 쓰고, 발행 여부를 정합니다. 댓글 수가 함께 보입니다.": "Write posts and decide what is published. Comment counts are shown too.",
  "새 글 쓰기": "Write a post",
  "분류 전체": "All categories",
  "소개": "Intro",
  "뉴스": "News",
  "인터뷰": "Interview",
  "정보": "Info",
  "상태 전체": "All statuses",
  "발행": "Published",
  "임시저장": "Draft",
  "숨김": "Hidden",
  "분류": "Category",
  "출처·지역": "Source · region",
  "발행일": "Date",
  "마감": "Deadline",
  "댓글": "Comments",
  "게시판 설정": "Board settings",
  "기본 댓글 정책": "Default comment policy",
  "누구나 (비회원은 캡차)": "Anyone (guests use a captcha)",
  "로그인 회원만": "Signed-in members only",
  "댓글 비활성화": "Comments off",
  "정책 저장": "Save policy",
  "+ 새 게시판": "+ New board",
  "이름": "Name",
  "페이지당": "Per page",
  "댓글 정책": "Comment policy",
  "글": "Posts",
  "할 일": "To do",
  "진행 중": "In progress",
  "완료": "Done",
  "우선순위": "Priority",
  "담당": "Assignee",
  "작성자": "Author",
  "수정": "Edit",
  "이미지 올리기": "Upload image",
  "폴더 전체": "All folders",
  "숨김 처리하면 사이트에서 보이지 않습니다. 삭제는 되돌릴 수 없습니다.": "Hidden media disappears from the site. Deleting cannot be undone.",
  "공개": "Public",
  "글 전체": "All posts",
  "내용": "Body",
  "작성 시각": "Written",
  "CSV 내려받기": "Download CSV",
  "새 접수": "New",
  "처리 중": "In progress",
  "접수 내역": "Submissions",
  "종류 전체": "All types",
  "구독": "Subscriptions",
  "등록·제보": "Registrations",
  "종류": "Type",
  "이름·이메일": "Name · email",
  "종류로 거르기": "Filter by type",
  "상태로 거르기": "Filter by status",
  "이름·이메일·내용 검색": "Search name, email or text",
  "접수 검색": "Search submissions",
  "접수 내용": "Submission",
  "처리 상태": "Status",
  "관리 메모": "Admin note",
  "관리자만 봅니다": "admins only",
  "닫기": "Close",
  "예: 11/25 답장 보냄": "e.g. Replied on 11/25",
  "메일 쓰기": "Send email",
  "열기": "Open",
  "삭제": "Delete",
  "뉴스레터 구독": "Newsletter subscription",
  "(내용 없음)": "(no content)",
  "상태를 바꾸면 이 접수의 처리 상황이 함께 바뀝니다.": "Changing the status updates how this submission is tracked.",
  "설정·페이지·게시판·글·사이트 문구를 JSON 한 파일로 내려받고, 그 파일로 되돌립니다.": "Download settings, pages, boards, posts and site text as one JSON file, then restore from it.",
  "현황 새로고침": "Refresh counts",
  "공개 저장소에 올리지 마세요": "do not upload it to a public repository",
  "전체 백업 내보내기": "Export full backup",
  "설정": "Settings",
  "사이트 문구": "Site text",
  "페이지": "Pages",
  "게시판": "Boards",
  "전체 백업 내려받기": "Download full backup",
  "백업 복원 (검증 후 가져오기)": "Restore (check first)",
  "먼저 검사": "check it first",
  "백업 파일 고르기": "Choose a backup file",
  "선택한 파일 없음": "No file selected",
  "확인": "Confirm",
  "위 내용으로 기존 자료를 덮어쓰는 것에 동의합니다.": "I agree to overwrite existing data with the contents above.",
  "복원 실행": "Run restore",
  "선택 취소": "Clear selection",
  "백업 안의 설정 파일 내려받기": "Download the settings file from the backup",
  "로 받아 저장소에 올려 주세요.": " and upload it to the repository.",
  "자료": "Data",
  "행": "rows",
  "기준 열": "Key column",
  "사이트·관리자에 기능을 더하는 브라우저 JS 플러그인을 설치하고 켜고 끕니다. 켜진 플러그인만 방문자의 브라우저에 내려갑니다.": "Install and toggle browser JS plugins that add features to the site and admin. Only enabled plugins reach visitors.",
  "켜진 플러그인만": "only enabled plugins",
  "설치된 플러그인": "Installed plugins",
  "토글을 끄면 사이트에서 빠집니다(방문자가 새로고침할 때).": "Turning one off removes it from the site (when visitors reload).",
  "기본": "built-in",
  "마켓": "market",
  "직접": "custom",
  "플러그인": "Plugin",
  "버전": "Version",
  "출처": "Source",
  "JS 주소": "JS URL",
  "설치일": "Installed",
  "외부 URL로 직접 설치": "Install from a URL",
  "보안 안내": "Security notes",
  "주소 확인": "Check URL",
  "설치하고 켜기": "Install and enable",
  "플러그인 마켓": "Plugin market",
  "주소 저장": "Save URL",
  "목록 새로고침": "Reload list",
  "내 플러그인": "My plugins",
  "관리자 화면에서는 실행하지 않습니다": "do not run in the admin screen",
  "새 글": "New post",
  "자동 저장된 임시본이 있습니다.": "An automatically saved draft is available.",
  "복구": "Restore",
  "분류 *": "Category *",
  "제목 *": "Title *",
  "슬러그": "Slug",
  "주소·댓글 키 — 비우면 자동": "address · comment key — auto if empty",
  "요약": "Summary",
  "본문": "Body",
  "본문 형식": "Body format",
  "일반 텍스트": "Plain text",
  "마크다운": "Markdown",
  "미리보기": "Preview",
  "미리보기 닫기": "Close preview",
  "출처 이름": "Source name",
  "원문·신청 링크": "Original · apply link",
  "마감일": "Deadline",
  "정렬 순서": "Sort order",
  "상단 고정(PIN)": "Pin to top",
  "공개 목록 맨 앞에 📌 고정으로 표시됩니다.": "Shown as 📌 pinned at the top of public lists.",
  "예약 발행 일시": "Scheduled publish",
  "비우면 바로 공개": "empty = publish now",
  "태그": "Tags",
  "인터뷰 인물": "Interviewee",
  "역할": "Role",
  "기간": "Period",
  "이미지 없음": "No image",
  "지우기": "Clear",
  "수정 이력": "Revisions",
  "휴지통으로": "Move to trash",
  "취소": "Cancel",
  "저장": "Save",
  "새 페이지": "New page",
  "주소(slug) *": "Address (slug) *",
  "부제": "Subtitle",
  "hunmin 블록": "hunmin blocks",
  "여러 장 · 위에서부터 순서대로": "several images · in order",
  "주소로 추가": "Add by URL",
  "끄면 사이트에서 보이지 않습니다.": "Turn off to hide it on the site.",
  "팅크": "x",
  "새 게시판": "New board",
  "주소에 쓰입니다": "used in the address",
  "게시판 위에 표시": "shown above the board",
  "페이지당 글 수": "Posts per page",
  "사용": "Enabled",
  "끄면 사이트 메뉴·게시판 이동에서 숨겨집니다.": "Turn off to hide it from the site menu and boards.",
  "· 관리자": " · Admin",
  "개인정보처리방침": "Privacy policy",
  "이용약관": "Terms of use",
  "관리자 메뉴": "Admin menu",
  "관리자 언어": "Admin language",
  "이메일·닉네임 검색": "Search email or nickname",
  "회원 검색": "Search members",
  "공방명·지역 검색": "Search workshop or region",
  "등록 검색": "Search registrations",
  "승인 상태 필터": "Approval filter",
  "새 관리자 이메일": "New admin email",
  "메모 (선택, 예: 편집 담당)": "Note (optional, e.g. editor)",
  "새 관리자 메모": "New admin note",
  "또는 이미지 주소(URL)": "or an image URL",
  "일반회원": "Member",
  "정회원": "Full member",
  "특별회원(VIP)": "VIP",
  "제목·출처·지역 검색": "Search title, source or region",
  "글 검색": "Search posts",
  "분류 필터": "Category filter",
  "상태 필터": "Status filter",
  "제목·담당·작성자 검색": "Search title, assignee or author",
  "업무 검색": "Search tasks",
  "파일 이름·폴더 검색": "Search file or folder",
  "미디어 검색": "Search media",
  "폴더 선택": "Choose a folder",
  "내용·작성자 검색": "Search text or author",
  "댓글 검색": "Search comments",
  "댓글 상태 필터": "Comment status filter",
  "글 필터": "Post filter",
  "무엇을 하는 플러그인인지": "What the plugin does",
  "공지사항": "Notice",
  "이름 *": "Name *",
  "https:// 또는 /": "https:// or /",
  "설명": "Description",
  "게시판 이름": "Board name",
  "(검색엔진용 주소 지도)과": " (an address map for search engines) and",
  "(관리자 세션 보호). 사이트 방문자 화면에서만 동작합니다.": " (to protect the admin session). They only run on the public site.",
  "(구독용 최신 글)을 그 자리에서 만듭니다. 내려받은 파일은 사이트 폴더에 올리면": " (latest posts for subscribers) right here. Upload the downloaded files to the site folder to open them at",
  ")로 담습니다.": ").",
  ")만 됩니다(": ") only (",
  ")에 이메일을 넣으면 그 계정도 /admin 을 쓸 수 있습니다. 소유자": ") — add an email to let that account use /admin. The owner",
  ")은 저장소의 정적 파일이라 여기서 자동으로 바뀌지 않습니다. 복원 후 필요하면": ") is a static file in the repository, so it does not change here. After restoring, if you need it,",
  "1·2·3단계 이름을 바꾸면 사이트 헤더·관리자 회원 목록·업무 관리 화면에 그대로 나옵니다. ‘업무 관리 최소 등급’을 2로 두면 정회원부터 업무 보드를 볼 수 있습니다(서버 RLS가 함께 막습니다).": "Renaming grades 1–3 updates the site header, the member list and the task board. With “Minimum grade for tasks” set to 2, full members and above can open the task board (RLS enforces it too).",
  "PNG·JPG·WebP·GIF 이미지 5MB까지. 비우면 사이트의 기본 마크(추상 선)가 나옵니다.": "PNG, JPG, WebP or GIF up to 5MB. Leave empty to show the default mark (an abstract line).",
  "Storage site-media 를 읽는 중…": "Reading the site-media bucket…",
  "Supabase 공개 데이터를 그대로 읽어 담습니다. 백업 파일에는 공개 키·설정이 들어 있으니": "Reads the public Supabase data as it is. The backup file contains the public key and settings, so",
  "home 또는 https://": "home or https://",
  "https/상대 경로만 · 관리자 화면 격리 중": "https or a same-site path only · admin screen isolated",
  "site-media 버킷": "site-media bucket",
  "slug 는 영문·숫자·하이픈을 권장합니다. 글을 쓰면 이 게시판이 ‘분류’로 저장됩니다.": "Slugs are best with letters, digits and hyphens. Posts in this board are stored under this category.",
  "· 공개(anon)는": " · public (anon) reads",
  "· 상태·관리 메모는 관리자만 읽고 쓸 수 있습니다.": " · only admins can read and write the status and notes.",
  "· 저장 위치": " · stored in",
  "· 주소는": " · URLs must be",
  "‘기본 댓글 정책’은 게시판을 따로 정하지 않은 곳(공방 카드 댓글 등)에 쓰입니다.": "The default comment policy applies where a board has no policy of its own (workshop cards, for example).",
  "↑ ↓ 로 순서를 바꾸고, 체크를 끄면 사이트에서 숨겨집니다. 왼쪽 칸은 한국어 이름, 오른쪽 칸은 영어 이름입니다(사이트 헤더의": "Use ↑ ↓ to reorder, and uncheck to hide a menu on the site. The left field is the Korean name, the right one the English name (switched on the site header by",
  "각진 모서리": "Sharp corners",
  "검색엔진 확인(Google Search Console·네이버 서치어드바이저), 폰트, 픽셀 등": "Search-engine verification (Google Search Console, Naver), fonts, pixels and more",
  "게시판을 추가하고 이름·설명·페이지당 글 수·댓글 정책을 바꿉니다. 추가한 게시판은 사이트": "Add boards and change their name, description, posts per page and comment policy. Added boards appear on the site",
  "공모·체험 등": "e.g. grant, class",
  "공방/쇼케이스형": "Workshop / showcase",
  "관리자 목록(": "Admins (",
  "관리자 화면에 게시글·페이지를 JSON으로 내려받는 탭을 추가합니다.": "Adds a tab to the admin screen that downloads posts and pages as JSON.",
  "관리자가 글·페이지·게시판·플러그인·관리자·사이트 문구를 바꾸면 서버 트리거가": "When an admin changes posts, pages, boards, plugins, admins or site text, a server trigger writes",
  "관리자에서 빼기": "Remove admin",
  "괘선": "Rules",
  "구조": "Structure",
  "굵게": "Bold",
  "글·공방 카드에「약 N분 · N자」배지를 붙여, 긴 글을 고르기 쉽게 합니다.": "Adds an “about N min · N chars” badge to post and workshop cards so long reads are easy to spot.",
  "기관 소개형": "Institution",
  "기록 없음": "No records",
  "기울임": "Italic",
  "내려받은 JSON 파일을 고르면": "When you choose a JSON file, SBPress",
  "내비게이션": "Navigation",
  "뉴스·소개": "News · intro",
  "뉴스·소개: 카드 설명 / 인터뷰: 인용문 / 정보: 한 줄 설명": "News · intro: card description / interview: quote / info: one-line summary",
  "뉴스레터 구독 · 홈 폼": "Newsletter subscription · home form",
  "는 덮어쓰고, 파일에 없는 자료는 지우지 않습니다.": " are overwritten; data that is not in the file is kept.",
  "는 서버 DB가 거부합니다). CSP 때문에 실제 실행은 사이트 자신·jsDelivr·Supabase Storage 주소만 됩니다. GitHub raw 파일은": " are rejected by the server). Because of CSP, only the site itself, jsDelivr and Supabase Storage URLs run. For GitHub raw files use",
  "데이터 내보내기": "Export data",
  "둥글게": "Round",
  "따뜻한 색": "Warm colour",
  "따뜻한 작업실 카드 · 둥근 모서리 · 사진 강조": "Warm workshop cards · round corners · photo-forward",
  "또는 사이트 안 경로(": "or a same-site path (",
  "로 연결하면 메뉴에도 나타납니다.": " to show it in the menu.",
  "로 연결합니다.": ".",
  "로 열립니다. 휴지통에 있는 글은 빠집니다.": ".",
  "로그인한 회원이 사이트": "Signed-in members use this task board from the site",
  "를 넣으면 새 창으로 열립니다.": " opens in a new window.",
  "링크": "Link",
  "마켓에 표시할 플러그인이 없습니다. 위 주소를 확인하거나 새로고침해 보세요.": "No plugins to show in the market. Check the URL above or reload the list.",
  "만 합니다. 무엇이 바뀌는지 확인한 뒤 ‘복원 실행’을 눌러야 반영됩니다. 같은": " only. Check what changes, then press “Run restore” to apply. Entries with the same",
  "매거진형": "Magazine",
  "맨 위로 버튼": "Back-to-top button",
  "메뉴 이름 (한국어)": "Menu name (Korean)",
  "메뉴는 로그인한 회원에게만 보입니다.": "The menu is only shown to signed-in members.",
  "명조": "Serif",
  "목록": "List",
  "목록을 불러옵니다. GitHub raw 주소를 넣으면 그 저장소가 곧 마켓이 됩니다.": ". A GitHub raw address turns that repository into the market.",
  "백업": "Backup",
  "버킷의 이미지를 폴더별로 모두 보여줍니다. 주소를 복사해 글·페이지 어디에나 붙여 넣을 수 있습니다.": "Shows every image in the bucket by folder. Copy a URL and paste it anywhere in a post or page.",
  "보기": "View",
  "본문 서식": "Body formatting",
  "본문 위에 순서대로 조립 — 최신글·지도·구독/제보 폼·갤러리·텍스트": "Assembled above the body in order — latest posts, map, subscribe/report form, gallery, text",
  "브랜드": "Brand",
  "블록으로 들어온 뉴스레터 구독·공방 등록·제보 내역은 상단": " blocks, newsletter signups and workshop submissions are managed in the",
  "블록으로 들어온 뉴스레터 구독·공방 등록·제보 내역입니다. 상태(새 접수 → 처리 중 → 완료)와 관리 메모를 남겨 처리 상황을 관리합니다.": " block. Track each one with a status (new → in progress → done) and an admin note.",
  "비어 있으면 아무것도 넣지 않습니다.": "Leave it empty to add nothing.",
  "사용 중": "In use",
  "사이트 상단 로고와 메뉴, 하단 회사 정보·SNS, <head>에 넣을 코드를 바꿉니다. 저장하면 사이트에 바로 반영됩니다.": "Edit the header logo and menu, footer company details and social links, and code for <head>. Saving applies to the site right away.",
  "서버 적용 · 캡차 15회/분 · 비회원 댓글 5회/분 · 폼 5건/분": "Enforced by the server · captcha 15/min · guest comments 5/min · forms 5/min",
  "서식·이미지로 꾸미거나 HTML·마크다운을 그대로 넣을 수 있습니다": "Format with the toolbar and images, or paste HTML / Markdown",
  "서식을 누르면 본문 형식이 마크다운으로 바뀝니다.": "Pressing a format switches the body to Markdown.",
  "설정 파일(": "The settings file (",
  "설치 및 켜기": "Install and enable",
  "수정됨": "Edited",
  "아래 주소에서": "SBPress loads the plugin list from the address below:",
  "아직 기록이 없습니다. 글·페이지·게시판·플러그인·관리자·사이트 문구를 바꾸면 여기에 남습니다.": "No records yet. Changing posts, pages, boards, plugins, admins or site text is logged here.",
  "아직 댓글이 없습니다.": "No comments yet.",
  "아직 등록된 업무가 없습니다. 사이트 #/tasks 에서 회원이 추가합니다.": "No tasks yet. Members add them at #/tasks on the site.",
  "아직 설치된 플러그인이 없습니다. 아래": "No plugins installed yet. Press",
  "아직 찜한 공방이 없습니다.": "No saved workshops yet.",
  "에 나타나며, 글의 ‘분류’에서 고를 수 있습니다. 기본 4개 게시판(공방 소개·공방 뉴스·작가 인터뷰·지원·공모)은 사이트의 고정 화면이라 삭제할 수 없습니다.": " and can be picked as a post category. The four default boards (intro, news, interview, info) are fixed site screens and cannot be deleted.",
  "에 올라갑니다. 설명을 비우면 사이트에서 설명 없이 사진만 나옵니다.": ". Leave the caption empty to show the photo without one.",
  "에 자동으로 남깁니다. 이 기록은 관리자만 읽을 수 있고 수정·삭제는 누구도 할 수 없습니다.": " automatically. Only admins can read it; nobody can edit or delete it.",
  "에서 바뀝니다). 연결 대상에": "). For the target, use",
  "에서 쓰는 업무 보드입니다. 관리자는 모든 업무를 보고 상태를 바꾸거나 삭제할 수 있습니다.": ". Admins see every task and can change its status or delete it.",
  "에서 한 번 눌러 설치해 보세요.": " below to install one.",
  "오늘": "Today",
  "오른쪽 아래에 '맨 위로' 버튼을 띄웁니다. 400px 이상 스크롤하면 나타납니다.": "Shows a “back to top” button at the bottom right after 400px of scrolling.",
  "와": "and",
  "은 마켓 목록에서 설치,": " is installed from the market,",
  "은 뺄 수 없고, 관리자는 최소 한 명이 남아야 합니다(서버가 막습니다).": " cannot be removed, and at least one admin must remain (enforced by the server).",
  "은 사이트에 함께 배포되는 플러그인,": " ships with the site,",
  "은 외부 URL로 설치한 플러그인입니다.": " was installed from an external URL.",
  "을 한 파일(": " into one file (",
  "이고, 아래 ‘헤더 · 푸터 · Head’ 탭의 메뉴에서": "; link it from the menu in the “Header · footer · head” tab as",
  "이미지 삽입": "Insert image",
  "이미지는": "Images are stored in",
  "인용": "Quote",
  "인터뷰: 설명 — 아래 서식·이미지로 꾸밀 수 있습니다": "Interview: description — format it with the toolbar below",
  "읽기": "Read",
  "읽기 시간 배지": "Reading-time badge",
  "읽습니다(RLS)": "(RLS)",
  "작은 표기(선택)": "Small note (optional)",
  "적용 · 관리자만 조회(감사 로그 확인됨)": "Applied · admin-only read (audit log verified)",
  "정보: 기관": "Info: organisation",
  "제목·부제·본문과 여러 장의 이미지를 가진 페이지를 만듭니다. 주소는": "Create a page with a title, subtitle, body and images. The address is",
  "조건에 맞는 항목이 없습니다.": "No matching items.",
  "조건에 맞는 접수가 없습니다.": "No submissions match.",
  "아직 접수된 내용이 없습니다.": "No submissions yet.",
  "종료": "Closed",
  "중 하나를 넣으면 사이트 안의 화면으로, 직접 만든 페이지·게시판은": " for a screen in the site; for a custom page or board use",
  "지금 공개 중인 게시판·페이지·글로": "Build sitemap.xml (an address map for search engines) and rss.xml (latest posts for subscribers) from the boards, pages and posts that are public right now.",
  "지금 사이트의": "Collects everything the site has now:",
  "지금 적용 중:": "Currently applied:",
  "차분한 기관·협동조합형 · 구조적 카드 · 뚜렷한 위계": "Calm institution · structured cards · clear hierarchy",
  "차분한 색": "Calm colour",
  "최근 찜 기록이 없습니다.": "No recent saves.",
  "추천 공방 스포트라이트": "Workshop spotlight",
  "카드": "Cards",
  "카드 꾸미기": "Card decoration",
  "켜짐 · 이 화면 위반 0건": "On · 0 violations on this screen",
  "태그를 그대로 붙여 넣으세요. 사이트를 열 때 자동으로 <head>에 들어가고, 이미 같은 태그가 있으면 중복해서 넣지 않습니다.": "Paste them as they are. They go into <head> automatically, and duplicates are skipped.",
  "테마": "Theme",
  "테스트": "Test",
  "편집 그리드 · 또렷한 괘선 · 명조 제목": "Editorial grid · crisp rules · serif headings",
  "포함": "Included",
  "표시": "Shown",
  "헤더": "Header",
  "형태로 넣어 주세요. 직접 올린 외부 플러그인은": " instead. Plugins installed from an external URL",
  "홈": "Home",
  "홈 맨 위에 이번 주 추천 공방과 마감 임박 공모·체험을 모은 배너를 보여 줍니다.": "Shows a banner at the top of the home page with this week's featured workshop and grants closing soon.",
  "히어로 제목": "Hero title",
  "아직 가입한 회원이 없습니다.": "No members yet.",
  "아직 등록된 공방이 없습니다.": "No workshops yet.",
  "위젯": "Widget",
  "(게시판 없음)": "(no board)",
  "곳": "workshops",
  "건": "items",
  "위계": "hierarchy",
  "아직 올린 파일이 없습니다. ‘이미지 올리기’로 시작해 보세요.": "No files yet. Start with “Upload image”.",
  "/plugins-market.json 또는 https://raw.githubusercontent.com/.../plugins.json": "/plugins-market.json or https://raw.githubusercontent.com/.../plugins.json",
  "접수 상태를 ‘": "Saved the status as ‘",
  "(으)로 저장했습니다.": "’.",
  "검사 결과: ": "Check result: ",
  "‘": "‘",
  "②": "②",
  "내보낸 시각": "exported",
  "사이트 ": "Site ",
  "모두 ": "",
  "내보내는 중…": "Exporting…",
  "자료를 모으는 중…": "Collecting data…",
  "(비어 있음)": "(empty)",
  "저장 실패: ": "Save failed: ",
  "저장하는 중…": "Saving…",
  "저장했습니다.": "Saved.",
  "불러오는 중…": "Loading…",
  "불러오지 못했습니다: ": "Could not load: ",
  "불러오지 못했습니다": "Could not load",
  "삭제 실패: ": "Delete failed: ",
  "삭제했습니다.": "Deleted.",
  "지우는 중…": "Deleting…",
  "복사했습니다.": "Copied.",
  "수정했습니다: ": "Updated: ",
  "만들었습니다: ": "Created: ",
  "저장했습니다 ": "Saved ",
  "(을)를 ": " ",
  "알 수 없는 오류": "unknown error",
  "이미지를 올리는 중…": "Uploading image…",
  "업로드 완료 — ‘변경 저장’을 누르면 사이트에 반영됩니다.": "Upload complete — press “Save changes” to publish.",
  "올리는 중…": "Uploading…",
  "장 올리는 중…": " images uploading…",
  "장을 올렸습니다. ‘저장’을 누르면 페이지에 반영됩니다.": " images uploaded. Press “Save” to publish.",
  "이미지를 추가했습니다. ‘저장’을 누르면 페이지에 반영됩니다.": "Image added. Press “Save” to publish.",
  "마지막 확인 ": "Last checked ",
  "현황 ": "Counts ",
  "저장됨 · 사이트에 반영": "Saved · live",
  "복원하는 중…": "Restoring…",
  "이 접수 내용을 지울까요? 되돌릴 수 없습니다.": "Delete this submission? This cannot be undone.",
  "자동 저장된 임시본을 복구했습니다. 저장을 눌러야 반영됩니다.": "Restored the auto-saved draft. Press Save to publish it.",
  "자동 저장된 임시본을 지울까요? 되돌릴 수 없습니다.": "Discard the auto-saved draft? This cannot be undone.",
  "자동 저장된 임시본이 있습니다": "Auto-saved draft available",
  "자동 저장됨 ": "Auto-saved ",
  "‘덮어쓰는 것에 동의합니다’에 체크해 주세요.": "Tick “I agree to overwrite” first.",
  "검사 통과 — 확인에 체크하면 복원할 수 있습니다.": "Check passed — tick Confirm to enable restore.",
  "파일을 읽지 못했습니다.": "Could not read the file.",
  "백업 파일": "Backup file",
  "구독자 · 뉴스레터": "Subscribers · newsletter",
  "뉴스레터 구독 신청을 한곳에서 보고, 발행한 글을 골라 메일로 보낼 HTML 뉴스레터를 만듭니다.": "See every newsletter signup in one place and build an email-ready HTML newsletter from published posts.",
  "구독자 목록": "Subscribers",
  "구독 폼으로 들어온 신청을 이메일 하나로 모읍니다. 해지로 바꿔도 명부에서 지우지 않고 표시만 바꿉니다.": "Signups from the form are grouped by email. Unsubscribing keeps the record and only changes the status.",
  "이메일·이름 검색": "Search email or name",
  "구독자 검색": "Search subscribers",
  "구독 중": "Subscribed",
  "해지": "Unsubscribed",
  "경로": "Source",
  "신청일": "Signed up",
  "이번 달 신규": "New this month",
  "뉴스레터 만들기": "Compose newsletter",
  "발행한 글을 고르면 메일 앱에서 잘 보이는": "Pick published posts that render well in mail apps to build",
  "뉴스레터로 조립합니다. 발송은 쓰시는 메일 서비스에 이 HTML 을 붙여 넣어 하세요(이 화면은 HTML 만 만듭니다).": " a newsletter. Send it from your own mail service — this screen only builds the HTML.",
  "인라인 스타일 HTML": "inline-styled HTML",
  "메일 제목 *": "Email subject *",
  "이번 주 공방 소식": "This week at the workshops",
  "머리 인사": "Opening line",
  "이번 주 공방 소식을 모았습니다.": "Here is this week's workshop news.",
  "맺음말": "Closing line",
  "구독을 해지하려면 이 메일에 답장해 주세요.": "To unsubscribe, reply to this email.",
  "담을 글": "Posts to include",
  "전체 선택": "Select all",
  "선택 해제": "Clear",
  "최근 5개": "Latest 5",
  "HTML 복사": "Copy HTML",
  "HTML 내려받기": "Download HTML",
  "Supabase newsletter_subscribers · 관리자만 읽고 고칩니다.": "Supabase newsletter_subscribers · admins only.",
  "Supabase newsletter_subscribers · 관리자만 읽고 고칩니다. 해지로 바꿔도 명부에서 지우지 않습니다.": "Supabase newsletter_subscribers · admins only. Unsubscribing keeps the record.",
  "newsletter_subscribers 표가 아직 없어 form_submissions 의 구독 신청을 읽기 전용으로 보여 줍니다. supabase/13_v22_newsletter_stats_i18n.sql 을 실행하면 상태(구독 중·해지)를 직접 바꿀 수 있습니다.": "The newsletter_subscribers table does not exist yet, so signups from form_submissions are shown read-only. Run supabase/13_v22_newsletter_stats_i18n.sql to change status here.",
  "조회수 · 최근 7일": "Views · last 7 days",
  "인기글 TOP 5": "Top 5 posts",
  "최근 7일 접수 · 댓글": "Last 7 days: submissions · comments",
  "글 조회수(increment_post_view)와 최근 7일 접수·댓글 흐름입니다. GA4 를 열지 않아도 여기서 바로 봅니다.": "Post views (increment_post_view) and the last 7 days of submissions and comments — no need to open GA4.",
  "posts.view_count 열이 아직 없어 조회수는 –로 보입니다. supabase/13_v22_newsletter_stats_i18n.sql 을 실행하면 쌓이기 시작합니다. 최근 7일 접수·댓글은 지금도 셉니다.": "The posts.view_count column is missing, so views show as –. Run supabase/13_v22_newsletter_stats_i18n.sql to start counting. Submissions and comments are counted now.",
  "아직 조회수가 기록된 글이 없습니다.": "No post views recorded yet.",
  "조건에 맞는 구독자가 없습니다.": "No subscriber matches these filters.",
  "아직 구독 신청이 없습니다.": "No newsletter signups yet.",
  "구독 상태를 저장했습니다.": "Subscriber status saved.",
  "구독 상태를 저장하지 못했습니다: ": "Could not save the subscriber status: ",
  "발행한 글이 없습니다. ‘게시판 관리’에서 글을 먼저 발행해 주세요.": "No published posts yet. Publish one in “Posts” first.",
  "글 목록을 불러오는 중…": "Loading posts…",
  "담을 글을 하나 이상 골라 주세요.": "Pick at least one post to include.",
  "HTML 을 복사했습니다 — 메일 서비스의 HTML 편집기에 붙여 넣으세요.": "HTML copied — paste it into the HTML editor of your mail service.",
  "복사하지 못했습니다. ‘HTML 내려받기’로 파일을 받아 주세요.": "Could not copy. Use “Download HTML” instead.",
  "영문 본문은 저장하지 못했습니다: ": "Could not save the English text: ",
  "업로드 완료 — ": "Upload complete — ",
  "글 본문 언어": "Post body language",
  "페이지 본문 언어": "Page body language",
  "한국어": "Korean",
  "English 칸을 비우면 사이트 EN 모드에서도 한국어 글이 그대로 나옵니다.": "Leave the English fields empty to keep showing the Korean post in EN mode.",
  "English 칸을 비우면 사이트 EN 모드에서도 한국어 문구가 그대로 나옵니다.": "Leave the English fields empty to keep showing the Korean text in EN mode.",
  "영문 제목 — 비우면 한국어 제목": "English title — empty shows the Korean title",
  "영문 요약 — 비우면 한국어 요약": "English summary — empty shows the Korean summary",
  "영문 본문 — 비우면 한국어 본문": "English body — empty shows the Korean body",
  "영문 부제 — 비우면 한국어 부제": "English subtitle — empty shows the Korean subtitle",
  "본문 형식(English)": "Body format (English)",
  "한국어와 같게": "Same as Korean",
  "영문 미리보기는 공개 사이트 EN 모드에서 확인하세요.": "Check the English preview on the public site in EN mode.",
  "hunmin 블록은 한국어 본문과 함께 모든 언어에 나옵니다.": "hunmin blocks appear in every language alongside the Korean body.",
  "원본 그대로 올리기": "Upload the original",
  "WebP 압축·리사이즈를 건너뜁니다": "skip WebP compression and resizing",
  "원본 그대로": "Original",
  "기본은 긴 변 1600px·WebP 품질 82% 로 줄여 올리고, 원본 대비 절감 용량을 보여 줍니다.": "By default images are resized to 1600px on the long edge at WebP quality 82%, and the saving against the original is shown.",
  "최신글·인기글·지도·구독/제보 폼·갤러리·텍스트": "latest · popular · map · form · gallery · text",
  "인기글": "Popular posts",
  "조회수가 많은 글을 위에서부터 모읍니다.": "Lists the posts with the most views first.",
  "전체 게시판": "All boards",
  "최신 소식": "Latest news",
  "Supabase 500MB · 1GB 사용량": "Supabase 500 MB · 1 GB usage",
  "무료 한도(DB 500MB · Storage 1GB) 대비 지금 쓴 양과 하루 증가 속도를 봅니다. 서버 함수를 실행하기 전에는 화면에서 추정합니다.": "Shows how much of the free limits (500 MB database · 1 GB storage) is used and how fast it grows per day. Before the server function is installed, the screen estimates the figures.",
  "DB 사용량": "Database usage",
  "Storage 사용량": "Storage usage",
  "증가 속도 측정 전": "Growth not measured yet",
  "표별 행 수 · 추정 용량": "Rows and size by table",
  "표": "Table",
  "용량": "Size",
  "사용량을 읽는 중…": "Reading usage…",
  "서버 함수 get_db_usage_stats() 가 센 정확한 값입니다. 하루 한 번 스냅샷을 남겨 최근 4주 증가 속도와 남은 날을 계산합니다.": "Exact figures from the get_db_usage_stats() server function. A daily snapshot gives the four-week growth rate and the days of headroom.",
  "서버 함수를 찾지 못해 화면에서 추정했습니다. 표 행 수와 표본 행의 JSON 크기, storage.list() 로 계산하므로 실제와 조금 다를 수 있습니다. supabase/14_v31_storage_lifecycle.sql 을 실행하면 정확한 값과 남은 날이 켜집니다.": "The server function was not found, so the screen estimated these figures from row counts, sample JSON size and storage.list(). Run supabase/14_v31_storage_lifecycle.sql for exact figures and days of headroom.",
  "사용량을 읽지 못했습니다: ": "Could not read usage: ",
  "정확": "exact",
  "추정": "estimate",
  "파일 수 확인 전": "File count pending",
  "표를 읽지 못했습니다.": "Could not read the tables.",
  "한도에 닿았습니다": "Limit reached",
  "고아 이미지(미사용) 정리": "Unused (orphan) images",
  "글·페이지·사이트 문구 어디에서도 쓰이지 않는 site-media 버킷 파일만 찾아 보여 줍니다. 지우면 되돌릴 수 없으니 목록을 확인한 뒤 지우세요.": "Finds only files in the site-media bucket that no post, page or site text uses. Deleting cannot be undone, so check the list first.",
  "고아 이미지 찾기": "Find unused images",
  "아직 찾지 않았습니다. ‘고아 이미지 찾기’를 누르면 글·페이지·사이트 문구의 참조와 대조합니다.": "Not scanned yet. Press “Find unused images” to compare against references in posts, pages and site text.",
  "모두 선택": "Select all",
  "선택 삭제": "Delete selected",
  "선택 없음": "Nothing selected",
  "파일 목록과 참조를 모으는 중…": "Collecting files and references…",
  "고아 이미지가 없습니다. 모든 파일이 글·페이지·사이트 문구에서 쓰이고 있습니다.": "No unused images. Every file is referenced by a post, page or site text.",
  "감사 로그 백업 · 정리": "Audit log backup · cleanup",
  "기준일 이전 로그를 먼저 JSON 파일로 내려받아 보관한 뒤에만 정리할 수 있습니다. 서버 함수를 실행한 사이트에서는 정리한 사실이 감사 로그에 한 줄 남습니다.": "Download the logs older than the cut-off as a JSON file first; cleanup unlocks only after that. Where the server function is installed, the cleanup itself is recorded in the audit log.",
  "감사 로그 보관 기준": "Audit log retention",
  "30일 이전": "Older than 30 days",
  "90일 이전": "Older than 90 days",
  "180일 이전": "Older than 180 days",
  "JSON 백업": "Back up JSON",
  "정리": "Clean up",
  "완료 접수 백업 · 정리": "Handled submissions backup · cleanup",
  "처리 완료된 접수 중 기준일이 지난 것만 JSON 으로 먼저 내려받은 뒤 지웁니다. 새 접수·처리 중인 접수는 지우지 않습니다.": "Only handled submissions older than the cut-off are downloaded as JSON and then deleted. New and in-progress submissions are kept.",
  "접수 보관 기준": "Submission retention",
  "백업 필요": "Backup needed",
  "기준을 바꿈 — 다시 백업": "Cut-off changed — back up again",
  "지울 자료 없음": "Nothing to delete",
  "내려받을 로그를 모으는 중…": "Collecting logs to download…",
  "내려받을 접수를 모으는 중…": "Collecting submissions to download…",
  "기준일 이전 감사 로그가 없습니다.": "No audit logs older than the cut-off.",
  "기준일 이전에 처리 완료된 접수가 없습니다.": "No handled submissions older than the cut-off.",
  "먼저 JSON 백업을 내려받아 주세요.": "Download the JSON backup first.",
  "정리하는 중…": "Cleaning up…",
  "서버 함수가 없어 감사 로그를 지우지 못했습니다(권한). supabase/14_v31_storage_lifecycle.sql 을 실행해 주세요.": "The server function is missing and the audit log cannot be deleted (permission). Run supabase/14_v31_storage_lifecycle.sql.",
  "추가": "Added",
  "게시글": "Post",
  "URL 복사": "Copy URL",
  "복사됨": "Copied",
  "결재 관리": "Approvals",
  "전자결재 양식과 기안을 관리합니다. 회원은 사이트": "Drafts and forms for the in-house approval flow. Members draft and approve at",
  "에서 기안하고 결재합니다.": "on the site.",
  "결재 양식": "Approval forms",
  "양식 추가": "Add form",
  "양식마다 추가 항목(텍스트·숫자·날짜·선택·파일 링크)을 정의하면 사이트의 기안 작성 화면이 그 정의로 입력칸을 그립니다.": "Extra fields (text, number, date, select, file link) defined on a form become the input boxes on the site's draft screen.",
  "끄기": "Off",
  "로 두면 새 기안에서 숨길 수 있습니다.": " hides the form from new drafts.",
  "결재 문서": "Approval documents",
  "문서번호·제목·기안자 검색": "Search document number, title or drafter",
  "결재 문서 검색": "Search approval documents",
  "결재 중": "In approval",
  "승인 완료": "Approved",
  "반려": "Rejected",
  "회수": "Withdrawn",
  "문서번호": "Document no.",
  "양식": "Form",
  "기안자": "Drafter",
  "기안": "Draft",
  "현재 단계": "Current step",
  "상신일": "Submitted",
  "양식 코드": "Form code",
  "영문·숫자 (예: purchase)": "letters and digits (e.g. purchase)",
  "이름 (한국어) *": "Name (Korean) *",
  "이름 (English)": "Name (English)",
  "추가 항목 (JSON 배열)": "Extra fields (JSON array)",
  "비우면 제목·내용만 받습니다": "leave empty to take a title and details only",
  "새 기안에서 쓰기 (끄면 숨김)": "Use for new drafts (turn off to hide)",
  "양식 삭제": "Delete form",
  "결재 대기": "Waiting",
  "파일 링크": "File link",
  "텍스트": "Text",
  "숫자": "Number",
  "날짜": "Date",
  "작성일": "Created",
  "결재선": "Approval line",
  "이력": "History",
  "본문이 없습니다.": "No body text.",
  "결재선이 없습니다.": "No approval line.",
  "아직 이력이 없습니다.": "No history yet.",
  "첨부 링크: ": "Attachment link: ",
  "첨부 링크": "Attachment link",
  "결재함에서 보기": "Open in approval box",
  "기안 작성": "Drafted",
  "상신": "Submitted",
  "열람": "Viewed",
  "의견": "Commented",
  "양식 수정": "Edit form",
  "표 없음": "No tables",
  "결재 양식이 없습니다. ‘양식 추가’로 첫 양식을 만들어 주세요.": "No approval forms yet. Use ‘Add form’ to create the first one.",
  "양식이 없습니다. ‘양식 추가’로 첫 양식을 만들어 주세요.": "No approval forms yet. Use ‘Add form’ to create the first one.",
  "끔": "Off",
  "켜짐": "On",
  "조건에 맞는 결재 문서가 없습니다.": "No approval documents match the filter.",
  "아직 결재 문서가 없습니다. 사이트": "No approval documents yet. Members draft at",
  "에서 회원이 기안합니다.": "on the site.",
  "결재 양식 수정": "Edit approval form",
  "새 결재 양식": "New approval form",
  "추가 항목은 JSON 배열([ ... ])이어야 합니다.": "Extra fields must be a JSON array ([ ... ]).",
  "이름(한국어)을 입력해 주세요.": "Enter the Korean name.",
  "양식 코드는 영문 소문자·숫자·- _ 로 2~30자입니다.": "The form code is 2–30 lowercase letters, digits, - or _.",
  "저장 권한이 없습니다(관리자만 양식을 고칠 수 있습니다). ": "No permission to save (only admins can change forms). ",
  "저장하지 못했습니다: ": "Could not save: ",
  "삭제하지 못했습니다: ": "Could not delete: ",
  "결재 양식을 수정했습니다.": "Approval form updated.",
  "결재 양식을 만들었습니다.": "Approval form created.",
  "결재 양식을 삭제했습니다.": "Approval form deleted.",
  "이력을 불러오는 중…": "Loading history…",
  "결재 표를 읽지 못했습니다: ": "Could not read the approval tables: ",
  "결재 자료를 불러오지 못했습니다: ": "Could not load approval data: ",
  "을 SQL Editor 에서 한 번 실행해 주세요.": "once in the SQL Editor.",
  "전결 규정": "Fast-track rules",
  "대결": "Delegation",
  "규정 추가": "Add rule",
  "대결 추가": "Add delegation",
  "금액 상한(원)": "Amount limit (KRW)",
  "메모 (예: 팀장 전결)": "Note (e.g. team lead fast-track)",
  "사유 (예: 휴가)": "Reason (e.g. leave)",
  "전결 결재자": "Fast-track approver",
  "원 결재자": "Original approver",
  "대결자": "Delegate",
  "금액 상한": "Amount limit",
  "양식의 금액 항목이 상한 이하이면 지정한 결재자 단독(": "If the form's amount is within the limit, the chosen approver closes it alone (",
  ")로 끝납니다. 예: 지출결의 300,000원 이하 → 팀장 전결.": "). E.g. expense up to 300,000 KRW → team lead fast-track.",
  "기간 중": "During the period, the ",
  "가 원 결재자를 대신해 승인·반려합니다. 이력에는 대결로 남고, 원 결재자 이름은 그대로 보입니다.": " approves or rejects for the original approver. History records the delegation and keeps the original name.",
  "등록된 전결 규정이 없습니다. 위에서 양식·금액 상한·결재자를 골라 추가해 보세요.": "No fast-track rules yet. Pick a form, amount limit and approver above to add one.",
  "등록된 대결이 없습니다.": "No delegations yet.",
  "전결·대결 표가 아직 없습니다 — ": "Fast-track and delegation tables are not installed — ",
  "전결 규정을 추가했습니다.": "Fast-track rule added.",
  "전결 규정을 켰습니다.": "Fast-track rule enabled.",
  "전결 규정을 껐습니다.": "Fast-track rule disabled.",
  "전결 규정을 지웠습니다.": "Fast-track rule deleted.",
  "대결을 추가했습니다.": "Delegation added.",
  "대결을 지웠습니다.": "Delegation deleted.",
  "양식을 골라 주세요.": "Choose a form.",
  "금액 상한을 적어 주세요.": "Enter an amount limit.",
  "전결 결재자를 골라 주세요.": "Choose the fast-track approver.",
  "원 결재자와 대결자를 골라 주세요.": "Choose the original approver and the delegate.",
  "원 결재자와 대결자는 달라야 합니다.": "The original approver and delegate must differ.",
  "시작일을 골라 주세요.": "Choose a start date.",
  "바꾸지 못했습니다: ": "Could not change it: ",
  "지우지 못했습니다: ": "Could not delete it: ",
  "추가하지 못했습니다: ": "Could not add it: ",
  "추가했습니다.": "Added.",
  "지웠습니다.": "Deleted.",
  "바꿨습니다.": "Changed.",
  "제한 없음": "no end date",
  "사유": "Reason",
  "전결": "fast-track",
  "설정 · 연동": "Settings · integrations",
  "구글 드라이브 첨부와 카카오·네이버 로그인, 알림 메일의 키를 넣습니다. 키를 넣으면 사이트가 바로 켜지고, 비우면 안전하게 안내만 합니다.": "Add keys for Google Drive attachments, Kakao/Naver sign-in and notification email. Filled keys turn the feature on; empty keys only show a safe notice.",
  "Supabase site_contents · 공개 읽기 / 관리자만 수정": "Supabase site_contents · public read / admin write",
  "여기에는 브라우저에 공개해도 되는 키만 넣습니다. Secret 은 Edge Function 시크릿에만 둡니다.": "Put only keys that are safe to expose in the browser here. Keep secrets in Edge Function secrets.",
  "구글 드라이브 첨부": "Google Drive attachments",
  "공유 링크 방식은 키 없이 바로 됩니다. 아래 키를 넣으면 Google Drive에서 선택(Picker)과 자동 업로드가 켜집니다.": "Share links work without any key. Adding the keys below turns on Pick from Drive and automatic upload.",
  "Picker API 키": "Picker API key",
  "GCP API 키": "GCP API key",
  "Picker 앱 ID": "Picker app ID",
  "GCP 프로젝트 번호": "GCP project number",
  "업로드 폴더 ID": "Upload folder ID",
  "비우면 자동 생성": "created if empty",
  "필요한 시크릿: GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · TOKEN_SECRET · 함수 drive-upload": "Secrets: GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · TOKEN_SECRET · function drive-upload",
  "카카오 · 네이버 로그인": "Kakao · Naver sign-in",
  "두 키 중 공개 키만 넣습니다. 로그인 중계는 함수 social-auth 가 하고, Secret 은 그 함수의 시크릿에만 둡니다.": "Add only the public key of each. The social-auth function relays sign-in; secrets stay in its settings.",
  "카카오 REST API 키": "Kakao REST API key",
  "네이버 Client ID": "Naver Client ID",
  "시크릿: KAKAO_REST_KEY · NAVER_CLIENT_ID · NAVER_CLIENT_SECRET · STATE_SECRET": "Secrets: KAKAO_REST_KEY · NAVER_CLIENT_ID · NAVER_CLIENT_SECRET · STATE_SECRET",
  "알림 메일": "Notification email",
  "인앱 알림은 SQL 만 실행하면 켜집니다. 메일은 함수 notify 가 하루 상한을 지켜 보냅니다.": "In-app notifications turn on with just the SQL. The notify function sends email within a daily cap.",
  "1일 상한(통/사용자)": "Daily cap (per user)",
  "기본 20": "default 20",
  "보내는 사람 주소": "Sender address",
  "시크릿: CRON_SECRET · RESEND_API_KEY 또는 NOTIFY_WEBHOOK · NOTIFY_FROM · 크론은 매시 함수 notify 호출": "Secrets: CRON_SECRET · RESEND_API_KEY or NOTIFY_WEBHOOK · NOTIFY_FROM · call notify hourly",
  "확인 중": "Checking",
  "키 없음": "No keys",
  "카카오 · 네이버 켜짐": "Kakao · Naver on",
  "카카오만 켜짐": "Kakao only",
  "네이버만 켜짐": "Naver only",
  "설정됨": "Configured",
  "기본값": "Defaults",
  "설정을 저장했습니다. 사이트를 새로고침하면 적용됩니다.": "Saved. Refresh the site to apply.",
  "설정을 읽지 못했습니다: ": "Could not read settings: ",
  "hunmin 블록 추가": "Add a hunmin block",
  "실행 취소": "Undo",
  "다시 실행": "Redo",
  "블록을 끌어(또는 ↑↓) 순서를 바꿉니다 · 실행 취소 20단계": "Drag a block (or use ↑↓) to reorder · undo up to 20 steps",
  "아직 hunmin 블록이 없습니다. 아래에서 골라 추가하면 페이지 본문 위에 순서대로 나타납니다.": "No hunmin blocks yet. Add one below; blocks appear above the page body in order.",
  "보이기": "Show",
  "잠금": "Lock",
  "풀기": "Unlock",
  "복제": "Duplicate",
  "최신글": "Latest posts",
  "지도": "Map",
  "구독/제보 폼": "Subscribe / report form",
  "이미지 갤러리": "Image gallery",
  "텍스트·배너": "Text · banner",
  "버튼/CTA": "Button / CTA",
  "임베드": "Embed",
  "게시판 글을 실시간으로 카드에 담습니다.": "Shows board posts as live cards.",
  "등록 공방의 전국 지도를 페이지에 놓습니다.": "Puts the national workshop map on the page.",
  "뉴스레터 구독 또는 공방 등록·제보를 받습니다.": "Takes newsletter signups or workshop registrations.",
  "페이지 사진이나 블록 사진을 설명과 함께 보여 줍니다.": "Shows page photos or block photos with captions.",
  "제목·본문·버튼을 한 덩어리로 강조합니다.": "Highlights a title, body and button together.",
  "머리글과 행을 가진 표를 넣습니다. 글자만 들어가 안전합니다.": "Adds a table with a header and rows. Text only, safe.",
  "큰 안내 띠와 버튼 하나로 행동을 이끕니다.": "Leads with a big band and one button.",
  "유튜브 영상이나 구글 드라이브 문서를 페이지에 놓습니다.": "Embeds a YouTube video or a Google Drive document.",
  "머리글": "Columns",
  "쉼표로 구분": "comma separated",
  "표 설명": "Table caption",
  "한 줄에 값 | 값": "one row per line: value | value",
  "유튜브 · 구글 드라이브/문서": "YouTube · Google Drive/Docs",
  "높이(px)": "Height (px)",
  "유튜브 영상(주소·공유 링크)과 구글 드라이브 파일·문서·시트·슬라이드·설문 주소만 미리보기로 바뀝니다. 그 밖의 주소는 저장되지 않습니다.": "Only YouTube links and Google Drive files, Docs, Sheets, Slides and Forms become previews. Other URLs are not kept.",
  "본문 위에 순서대로 조립 — 최신글·인기글·지도·구독/제보 폼·갤러리·텍스트·표·버튼/CTA·임베드(유튜브·드라이브)": "Assembled above the body in order — latest, popular, map, form, gallery, text, table, CTA, embed (YouTube/Drive)",
  "실시간 미리보기": "Live preview",
  "공개 페이지와 같은 모양 · 숨김 블록은 나오지 않습니다": "Same as the public page · hidden blocks are left out",
  "표시할 블록이 없습니다(숨김 블록은 미리보기에도 나오지 않습니다).": "No blocks to show (hidden blocks stay out of the preview too).",
  "위로": "Move up",
  "아래로": "Move down",
  "테마 토큰": "Theme tokens",
  "색·모서리·글꼴만 담습니다": "Colour, radius and font only",
  "v5.1 — 색·모서리·글꼴만 담습니다": "v5.1 — colour, radius and font only",
  "테마 토큰 (accent · bg · ink · radius · fontStack — CSS 직접 주입 없이 변수로 적용)": "Theme tokens (accent · bg · ink · radius · fontStack — applied as CSS variables, no direct CSS)",
  "CSS 를 직접 넣지 않고": "No CSS is injected;",
  "의 값만 CSS 변수로 적용합니다. 저장하면 공개 사이트(한국어·English)에 바로 반영됩니다.": " values are applied as CSS variables. Saving applies to the public site in Korean and English right away.",
  "포인트 색": "Accent colour",
  "포인트 색 고르기": "Pick the accent colour",
  "포인트 색 코드": "Accent colour code",
  "바탕 색": "Background colour",
  "글자 색": "Text colour",
  "모서리(px)": "Corner radius (px)",
  "모서리 둥글기": "Corner roundness",
  "글꼴": "Font",
  "나눔고딕 (기본)": "Nanum Gothic (default)",
  "시스템 글꼴": "System font",
  "명조 계열": "Serif",
  "고딕 계열": "Sans-serif",
  "토큰 저장": "Save tokens",
  "기본값으로": "Reset to defaults",
  "저장될 테마 토큰 JSON": "Theme token JSON to be saved",
  "테마 토큰을 저장했습니다. 사이트를 새로 고치면 포인트 색·바탕·글자·모서리·글꼴이 바로 반영됩니다.": "Theme tokens saved. Refresh the site to apply the accent, background, text, radius and font.",
  "테마 토큰을 불러오지 못했습니다: ": "Could not load theme tokens: ",
  "색은 #RRGGBB 6자리로 넣어 주세요(예: #C86D44).": "Enter colours as 6-digit #RRGGBB (e.g. #C86D44).",
  "기본 토큰으로 되돌렸습니다. 저장을 눌러 사이트에 반영하세요.": "Reset to the default tokens. Press save to apply them to the site.",
  "버전 고정": "Pin version",
  "고정 해제": "Unpin",
  "버전을 고정하지 못했습니다: ": "Could not pin the version: ",
  "위험한 코드가 있어 업데이트하지 않았습니다: ": "Not updated — unsafe code: ",
  "위험한 코드가 있어 설치하지 않았습니다: ": "Not installed — unsafe code: ",
  "위험한 코드가 있거나 플러그인 형식이 아니라서 설치하지 않았습니다: ": "Not installed — unsafe code or not a plugin: ",
  "이 플러그인의 주소가 https:// 또는 / 가 아니어서 업데이트하지 않았습니다.": "Not updated — the plugin URL is not https:// or a same-site path.",
  "고정된 버전 — 마켓 새 버전이 와도 바꾸지 않습니다.": "Pinned version — market updates do not change it.",
  "관리자 화면 격리": "Isolated in admin",
  "예약 · 설문": "Reservations",
  "예약 · 설문 신청": "Reservation",
  "신청 양식·날짜 슬롯·정원을 만들고, 들어온 신청을 확정 · 완료 · 취소로 관리합니다.": "Create forms, date slots and capacity, then confirm, complete or cancel incoming applications.",
  "예약 양식": "Reservation form",
  "신청 양식": "Application form",
  "새 양식": "New form",
  "주소 이름(slug)": "Slug",
  "영문·숫자·하이픈": "lowercase letters, digits, hyphen",
  "이름(한국어)": "Name (Korean)",
  "끄면 #/reserve 에서 이 양식이 보이지 않습니다.": "When off, this form is hidden from #/reserve.",
  "양식 저장": "Save form",
  "날짜 · 시간 슬롯": "Date · time slots",
  "날짜 · 시간": "Date · time",
  "글 편집기의 AI 초안 · KO→EN · EN→KO 버튼이 이 설정을 봅니다. 결과는 입력칸에만 채우고 자동 저장·자동 발행은 하지 않습니다.": "The AI draft · KO→EN · EN→KO buttons in the post editor use this setting. Results only fill the fields — never saved or published automatically.",
  "기본값은 사용 안 함입니다. 쓰려면 Supabase Edge Function ai 를 배포하고 시크릿 AI_API_KEY 를 넣은 뒤, site_contents 의 ai.provider 를 openai(호환 API면 compatible) 로 바꿉니다. 키가 없으면 편집기는 안전 안내만 냅니다.": "The default is Off. To use it, deploy the Supabase Edge Function ai, add the AI_API_KEY secret, then set site_contents ai.provider to openai (or compatible). Without a key the editor only shows a safe notice.",
  "이벤트가 생기면 등록한 주소로 JSON 을 보냅니다. 서명은 X-SBPress-Signature: sha256=…(HMAC-SHA256) 이고, 실패하면 3회까지 다시 시도한 뒤 실패로 남깁니다.": "Sends JSON to the registered URL when an event happens. The signature is X-SBPress-Signature: sha256=… (HMAC-SHA256); failures retry up to 3 times, then stay failed.",
  "시간": "Time",
  "비우면 종일": "blank = all day",
  "정원": "Capacity",
  "슬롯 추가": "Add slot",
  "신청": "Applied",
  "들어온 신청": "Applications",
  "확정": "Confirmed",
  "신청자": "Applicant",
  "접수번호": "Reference",
  "열림": "Open",
  "닫힘": "Closed",
  "종일": "All day",
  "양식을 저장했습니다.": "Form saved.",
  "슬롯을 추가했습니다.": "Slot added.",
  "먼저 양식을 저장해 주세요.": "Save the form first.",
  "날짜를 골라 주세요.": "Pick a date.",
  "주소 이름과 이름을 입력해 주세요.": "Enter the slug and the name.",
  "새 양식의 주소 이름과 이름을 적고 ‘양식 저장’을 누르세요.": "Type the slug and name of the new form, then press Save form.",
  "이 슬롯을 지울까요? 들어온 신청은 남습니다.": "Delete this slot? Applications stay.",
  "아직 만든 슬롯이 없습니다.": "No slots yet.",
  "아직 들어온 신청이 없습니다.": "No applications yet.",
  "예약 표가 아직 없습니다.": "Reservation tables are not installed yet.",
  "예약 표가 아직 없습니다(19_v70 SQL 실행).": "Reservation tables are not installed (run 19_v70 SQL).",
  "예약 표가 아직 없습니다. supabase/19_v70_reservations_webhooks_ai.sql 을 Supabase SQL Editor 에서 실행하면 이 화면이 켜집니다.": "Reservation tables are missing. Run supabase/19_v70_reservations_webhooks_ai.sql in the Supabase SQL Editor to enable this screen.",
  "Supabase survey_forms · reservation_slots · reservations — 관리자만 읽고 씁니다.": "Supabase survey_forms · reservation_slots · reservations — admins only.",
  "AI 보조 (초안 · KO↔EN 번역)": "AI assist (draft · KO↔EN)",
  "사용 안 함": "Off",
  "사용 방식": "Mode",
  "사용 안 함 (기본값)": "Off (default)",
  "호환 API": "Compatible API",
  "모델": "Model",
  "AI 보조": "AI assist",
  "AI 초안": "AI draft",
  "KO→EN 번역": "KO→EN",
  "EN→KO 번역": "EN→KO",
  "결과는 입력칸에만 채웁니다 — 검토 후 저장(자동 발행 없음)": "Fills the fields only — review, then save (never auto-publishes)",
  "웹훅 (구글 시트 · 슬랙 · 메일)": "Webhooks (Google Sheet · Slack · mail)",
  "웹훅": "Webhook",
  "대기 전송": "Send queued",
  "구글 시트 (Apps Script)": "Google Sheet (Apps Script)",
  "슬랙 Incoming Webhook": "Slack incoming webhook",
  "메일 중계": "Mail relay",
  "직접 URL": "Direct URL",
  "이벤트": "Event",
  "폼 접수 (form.submitted)": "Form submission (form.submitted)",
  "결재 완료 (approval.completed)": "Approval completed (approval.completed)",
  "일감 생성 (issue.created)": "Issue created (issue.created)",
  "예약 확정 (reservation.confirmed)": "Reservation confirmed (reservation.confirmed)",
  "대상 URL": "Target URL",
  "서명 키(secret)": "Signing secret",
  "선택 — X-SBPress-Signature": "optional — X-SBPress-Signature",
  "웹훅 등록": "Register webhook",
  "전송 이력": "Delivery log",
  "결과": "Result",
  "비고": "Detail",
  "성공": "Success",
  "실패": "Failed",
  "꺼짐": "Off",
  "시험 발송": "Send test",
  "보내기": "Send",
  "웹훅을 등록했습니다.": "Webhook registered.",
  "웹훅을 삭제했습니다.": "Webhook deleted.",
  "발송 중…": "Sending…",
  "이미 같은 조건의 웹훅이 있습니다.": "A webhook with the same settings already exists.",
  "대상 URL 은 https:// 로 시작해야 합니다(로컬 시험은 localhost 허용).": "The target URL must start with https:// (localhost is allowed for tests).",
  "웹훅 표가 아직 없습니다. supabase/19_v70_reservations_webhooks_ai.sql 을 실행하면 이 카드가 켜집니다.": "Webhook tables are missing. Run supabase/19_v70_reservations_webhooks_ai.sql to enable this card.",
  "이벤트가 생기면 등록한 주소로 JSON 을 보냅니다.": "Sends JSON to the registered URL when an event happens.",
  "재시도 횟수는 0~3회이고, 3회를 다 써도 실패하면 빨간 실패로 남습니다.": "Up to 3 retries; if all fail, it stays as a red Failed.",
  "최근 20건입니다.": "The latest 20.",
  "등록된 웹훅이 없습니다.": "No webhooks registered.",
  "아직 전송 이력이 없습니다.": "No deliveries yet.",
  "최근 20건입니다. 재시도 횟수는 0~3회이고, 3회를 다 써도 실패하면 빨간 실패로 남습니다.": "The latest 20. Up to 3 retries; after that it stays a red Failed.",
  "외부 AI API 는 무료가 아닙니다 — 무료 크레딧 범위 · 보유 키 · 사용 안 함 중에서 고르세요. 모델은 ai.model 에 적습니다(예: gpt-4o-mini).": "External AI APIs are not free — choose free credits, your own key, or off. Set the model in ai.model (for example gpt-4o-mini).",
  "관리자 [설정 · 연동]에서 사용 방식을 고르거나, 함수 시크릿 AI_API_KEY 를 넣어 주세요.": "Choose a mode in Admin → Settings, or add the AI_API_KEY function secret.",
  "AI 보조가 설정되지 않았습니다. 관리자 [설정 · 연동]에서 사용 방식을 고르거나, 함수 시크릿 AI_API_KEY 를 넣어 주세요.": "AI assist is not configured. Choose a mode in Admin → Settings, or add the AI_API_KEY function secret.",
  "AI 보조가 설정되지 않았습니다": "AI assist is not configured",
  "AI가 작성 중…": "AI is writing…",
  "AI가 번역 중…": "AI is translating…",
  "초안을 입력칸에 채웠습니다 — 검토 후 저장하세요.": "Draft placed in the field — review it, then save.",
  "영문 번역을 English 칸에 채웠습니다 — 검토 후 저장하세요.": "English translation placed in the English field — review, then save.",
  "한국어 번역을 본문 칸에 채웠습니다 — 검토 후 저장하세요.": "Korean translation placed in the body field — review, then save.",
  "제목이나 요약을 먼저 적어 주세요.": "Write a title or summary first.",
  "번역할 본문이 비어 있습니다.": "The body to translate is empty.",
  "English 칸이 비어 있습니다.": "The English field is empty.",
  "AI 응답이 비어 있습니다.": "The AI returned nothing.",
  "AI 호출에 실패했습니다: ": "AI request failed: ",
  "기존 내용을 AI 결과로 바꿀까요?": "Replace the existing text with the AI result?",
  "기존 글 아래에 덧붙입니다.": "Added below the existing text.",
  "AI 보조 설정": "AI assist settings",
  "외부 AI API 는 무료가 아닙니다": "External AI APIs are not free",
  "기본값은 사용 안 함입니다.": "The default is Off.",
  "통합 허브": "Site hub",
  "여러 SBPress 사이트의 최근 배포·저장소·DB 크기와 미처리 결재·예약을 한 화면에서 봅니다.": "Recent deploys, repo and DB size, and pending approvals and reservations for every SBPress site.",
  "사이트 추가": "Add site",
  "public.sites · site_members — 관리자만 읽고 씁니다(RLS).": "public.sites · site_members — admins only (RLS).",
  "사이트 표가 아직 없습니다.": "The site table is not installed yet.",
  "을 실행하면 이 화면이 켜집니다. 지금은 이 사이트만 보여 줍니다.": "to enable this screen. For now only this site is shown.",
  "허브에 등록된 사이트가 없어 지금 사이트 하나만 표시합니다. 아래 ‘사이트 추가’로 첫 사이트를 등록하세요.": "No site is registered in the hub, so only the current site is shown. Use “Add site” below to register the first one.",
  "사이트 추가 · 편집": "Add · edit site",
  "새 사이트": "New site",
  "사이트 키": "Site key",
  "영문 소문자·숫자·하이픈": "lowercase letters, digits, hyphens",
  "GitHub 저장소": "GitHub repository",
  "Supabase 프로젝트": "Supabase project",
  "GA4 측정 ID": "GA4 measurement ID",
  "운영": "Active",
  "일시정지": "Paused",
  "보관": "Archived",
  "새 사이트로": "Clear form",
  "이 사이트 지금 값 불러오기": "Load current values",
  "원클릭 복제 마법사": "One-click clone wizard",
  "10분 안에 새 사이트": "A new site in 10 minutes",
  "이름·도메인·포인트 색·게시판을 정하면 ① 설정 파일 ② 실행 명령 ③ 복제 후 체크리스트를 만들어 줍니다.": "Set the name, domain, accent colour and boards to get ① a config file ② run commands ③ a post-clone checklist.",
  "새 사이트 이름": "New site name",
  "도메인": "Domain",
  "비우면 GitHub Pages 주소": "blank for the GitHub Pages URL",
  "게시판 구성": "Board layout",
  "이름:페이지당 글 수": "name:posts per page",
  "설정 만들기": "Build config",
  "sbpress.config.json 내려받기": "Download sbpress.config.json",
  "명령 복사": "Copy commands",
  "① 설정 파일": "① Config file",
  "② 실행 명령": "② Run commands",
  "③ 복제 후 체크리스트": "③ Post-clone checklist",
  "도메인 연결 도우미": "Domain connect helper",
  "도메인을 입력하세요": "Enter a domain",
  "쓰려는 도메인을 넣으면 Cloudflare DNS 레코드(@ A 4개 · www CNAME)와 CNAME 파일, GitHub Pages · Supabase Auth · Google OAuth · sbpress.config.json 설정 목록을 만들어 줍니다.": "Enter the domain you want: Cloudflare DNS records (four @ A records · www CNAME), the CNAME file, and the GitHub Pages · Supabase Auth · Google OAuth · sbpress.config.json settings checklist are generated for you.",
  "쓰려는 도메인을 넣으면 Cloudflare DNS 레코드(@ A 4개 · www CNAME)와 CNAME 파일, GitHub Pages · Supabase Auth · Google OAuth ·": "Enter the domain you want: Cloudflare DNS records (four @ A records · www CNAME), the CNAME file, and the GitHub Pages · Supabase Auth · Google OAuth ·",
  "예: example.com": "e.g. example.com",
  "설정 목록을 만들어 줍니다.": "settings checklist are generated for you.",
  "www CNAME 대상": "target of the www CNAME",
  "레코드 만들기": "Build records",
  "DNS 전체 복사": "Copy all DNS",
  "CNAME 파일 내려받기": "Download CNAME file",
  "Cloudflare 열기 ↗": "Open Cloudflare ↗",
  "값": "Value",
  "프록시": "Proxy",
  "연결 체크리스트": "Connect checklist",
  "Cloudflare 레코드는 API 토큰 없이 대신 만들 수 없습니다. 아래 BIND 값을 Cloudflare DNS → Import records 에 붙여 넣거나 레코드를 하나씩 추가하세요.": "Cloudflare records cannot be created for you without an API token. Paste the BIND values below into Cloudflare DNS → Import records, or add the records one by one.",
  "BIND 값 복사": "Copy BIND values",
  "관리자로 로그인해야 통합 허브를 볼 수 있습니다.": "Sign in as an admin to see the site hub.",
  "사이트 목록을 읽지 못했습니다: ": "Could not read the site list: ",
  "지금 보고 있는 사이트입니다.": "this is the current site",
  "지금 값": "live",
  "편집": "Edit",
  "관리자 열기": "Open admin",
  "최근 배포": "Last deploy",
  "저장소": "Repo",
  "미처리 결재": "Pending approvals",
  "미처리 예약": "Pending reservations",
  "사이트를 저장했습니다.": "Site saved.",
  "사이트 키를 영문 소문자·숫자·하이픈으로 적어 주세요(41자 이내).": "Use lowercase letters, digits and hyphens for the site key (up to 41 characters).",
  "사이트 표가 아직 없습니다. supabase/20_v80_multisite_hub.sql 을 먼저 실행해 주세요.": "The site table is not installed yet. Run supabase/20_v80_multisite_hub.sql first.",
  "이 사이트의 지금 값을 저장했습니다.": "Saved the current values of this site.",
  "지금 값을 읽지 못했습니다: ": "Could not read the current values: ",
  "새 사이트 이름을 적어 주세요.": "Enter the new site name.",
  "게시판 구성을 ‘이름:페이지당 글 수’로 적어 주세요.": "Write the board layout as name:posts per page.",
  "설정·명령·체크리스트를 만들었습니다. 설정 파일을 내려받아 옮긴 뒤 명령을 실행하세요.": "Config, commands and checklist are ready. Download the config file, move it, then run the commands.",
  "(도메인 없음 — GitHub Pages 주소로 시작)": "(no domain — start with the GitHub Pages URL)",
  "복사하지 못했습니다 — 직접 선택해 복사해 주세요.": "Could not copy — select the text and copy it yourself.",
  "설정 파일을 내려받았습니다.": "Config file downloaded.",
  "도메인을 적고 ‘레코드 만들기’를 누르세요.": "Enter a domain and press Build records.",
  "CNAME 파일을 내려받았습니다.": "CNAME file downloaded.",
  "도메인을 먼저 입력해 주세요.": "Enter a domain first.",
  "도메인 모양을 확인해 주세요(예: example.com).": "Check the domain format (e.g. example.com).",
  "Cloudflare 열기": "Open Cloudflare",
  "TTL": "TTL",
  "DNS only": "DNS only",
  "복사": "Copy",
  "GitHub Pages → Custom domain": "GitHub Pages → Custom domain",
  "GitHub Pages → Enforce HTTPS": "GitHub Pages → Enforce HTTPS",
  "Enforce HTTPS 켜기": "Turn on Enforce HTTPS",
  "Supabase → Authentication → Site URL": "Supabase → Authentication → Site URL",
  "Supabase → Redirect URLs": "Supabase → Redirect URLs",
  "Google Cloud OAuth → 승인된 자바스크립트 원본": "Google Cloud OAuth → Authorised JavaScript origins",
  "Google Cloud OAuth → 승인된 리디렉션 URI": "Google Cloud OAuth → Authorised redirect URIs",
  "sbpress.config.json → siteUrl": "sbpress.config.json → siteUrl",
  "GA4 측정 ID 만들기 → sbpress.config.json ga4Id": "Create a GA4 measurement ID → sbpress.config.json ga4Id",
  "관리자 등록 — public.admin_users 에 소유자 이메일": "Register the admin — owner email in public.admin_users",
  "첫 글 발행 — /admin → 게시판 관리": "Publish the first post — /admin → Posts",
  "서명 · 동의서": "Sign · consent",
  "동의서를 만들고 전용 링크를 보내면, 서명자는 로그인 없이 동의 항목을 체크하고 손글씨로 서명합니다.": "Create a consent form and send its private link — the signer ticks the consent items and signs by hand, without signing in.",
  "public.esign_docs · esign_signatures — 관리자만 읽고 씁니다(RLS). 서명 기록은 추가만 됩니다.": "public.esign_docs · esign_signatures — admins only (RLS). Signature records can only be appended.",
  "서명 표가 아직 없습니다.": "The signature tables are not installed yet.",
  "서명 요청 만들기": "Create a signature request",
  "로그인 없이 서명": "Sign without an account",
  "만들면 서명자에게 보낼 전용 링크가 한 번 표시됩니다. 링크를 아는 사람은 로그인 없이 서명할 수 있습니다.": "On creation a private link for the signer is shown once. Anyone with the link can sign without signing in.",
  "서명자 이름": "Signer name",
  "서명자 이메일": "Signer email",
  "필수": "required",
  "선택 · 비우면 계속 열림": "optional · blank keeps it open",
  "예: 개인정보 수집·이용 동의서": "e.g. Consent to collection and use of personal data",
  "예: 홍길동": "e.g. Jane Doe",
  "만료일": "Expires",
  "동의서 본문": "Consent text",
  "동의 내용을 적어 주세요. 줄바꿈은 그대로 인쇄본에 들어갑니다.": "Write the consent text. Line breaks are kept in the printed copy.",
  "동의 항목": "Consent items",
  "필수 항목은 모두 체크해야 서명됩니다": "every required item must be ticked before signing",
  "동의 항목 추가": "Add consent item",
  "예: 개인정보 수집·이용에 동의합니다": "e.g. I agree to the collection and use of my personal data",
  "요청 만들기": "Create request",
  "서명 링크": "Signature link",
  "링크 복사": "Copy link",
  "원문 SHA-256:": "Document SHA-256:",
  "링크는 요청을 만들 때만 보입니다. 다시 필요하면 새 요청을 만들어 주세요.": "The link is shown only when the request is created. Create a new request if you need it again.",
  "요청 목록": "Requests",
  "서명완료": "Signed",
  "만료": "Expired",
  "요청일": "Requested",
  "요청 상세": "Request detail",
  "인쇄 / PDF": "Print / PDF",
  "요청 취소": "Cancel request",
  "서명 이미지": "Signature image",
  "관리자로 로그인해야 서명 요청을 관리할 수 있습니다.": "Sign in as an admin to manage signature requests.",
  "서명 요청을 읽지 못했습니다:": "Could not read the signature requests:",
  "서명 표가 아직 없습니다. supabase/21_v90_esign.sql 을 실행하면 이 화면이 켜집니다.": "The signature tables are not installed yet. Run supabase/21_v90_esign.sql to enable this screen.",
  "아직 만든 서명 요청이 없습니다. 위에서 첫 요청을 만들어 보세요.": "No signature request yet. Create the first one above.",
  "목록에서 요청을 하나 고르세요.": "Choose a request from the list.",
  "제목을 적어 주세요.": "Enter a title.",
  "동의서 본문을 적어 주세요.": "Enter the consent text.",
  "필수 동의 항목을 하나 이상 적어 주세요.": "Add at least one consent item.",
  "서명자 이름을 적어 주세요.": "Enter the signer's name.",
  "서명자 이메일 주소를 확인해 주세요.": "Check the signer's email address.",
  "서명 요청을 만들었습니다. 아래 링크를 서명자에게 보내세요.": "Signature request created. Send the link below to the signer.",
  "링크를 복사했습니다.": "Link copied.",
  "복사하지 못했습니다 — 링크를 직접 선택해 복사해 주세요.": "Could not copy — please select the link and copy it yourself.",
  "이 서명 요청을 취소할까요? 링크는 더 이상 열리지 않습니다.": "Cancel this signature request? The link will no longer open.",
  "요청을 취소했습니다.": "Request canceled.",
  "서명 기록을 읽지 못했습니다:": "Could not read the signature record:",
  "아직 서명하지 않았습니다.": "Not signed yet.",
  "서명자": "Signer",
  "만료 없음": "No expiry",
  "저장하지 못했습니다:": "Could not save:",
  "이 상태의 요청이 없습니다.": "No request has this status.",
  "아직 전자서명을 준비 중입니다. 관리자가 서명 표를 만들면 이 화면이 열립니다.": "E-signature is being prepared. This screen opens once the admin installs the signature tables.",
  "서명하는 사람의 이름": "Name of the signer",
  "손글씨 서명": "Handwritten signature",
  "마우스나 손가락으로 서명해 주세요.": "Sign with your mouse or finger.",
  "서명 제출": "Submit signature",
  "서명을 보내는 중…": "Sending your signature…",
  "서명 패드": "Signature pad",
  "서명이 완료되었습니다": "Signature complete",
  "이 화면을 인쇄하거나 PDF 로 저장해 두세요. 원문 해시와 서명 시각이 함께 남습니다.": "Print this screen or save it as a PDF. The document hash and signing time are kept with it.",
  "이 링크는 이미 서명이 끝났습니다. 같은 링크로 다시 서명할 수 없습니다.": "This link has already been signed and cannot be signed again.",
  "인쇄 / PDF 저장": "Print / save PDF",
  "원문 SHA-256": "Document SHA-256",
  "원문 해시": "Document hash",
  "서명 시각": "Signed at",
  "서명": "Signature",
  "이 문서는 SBPress 전자서명으로 작성되었습니다. 원문 해시가 서명 시점의 문서와 같으면 위변조가 없습니다.": "This document was signed with SBPress e-signature. If the document hash matches the signed version, it has not been altered.",
  "서명 링크가 올바르지 않습니다. 보낸 사람에게 새 링크를 요청해 주세요.": "This signature link is not valid. Please ask the sender for a new link.",
  "서명 기한이 지났습니다. 보낸 사람에게 새 링크를 요청해 주세요.": "This signature request has expired. Please ask the sender for a new link.",
  "이 서명 요청은 취소되었습니다.": "This signature request was canceled.",
  "필수 동의 항목을 모두 체크해 주세요.": "Please tick every required consent item.",
  "이름을 입력해 주세요.": "Please enter your name.",
  "서명 패드에 서명해 주세요.": "Please sign on the pad.",
  "서명을 마치지 못했습니다. 잠시 후 다시 시도해 주세요.": "We could not complete your signature. Please try again shortly.",
  "이미 서명이 끝난 문서입니다.": "This document is already signed.",
  "서명 기한이 지났습니다.": "This signature request has expired.",
  "취소된 요청입니다.": "This request was canceled.",
  "서명 링크가 올바르지 않습니다.": "The signature link is not valid.",
  "서명 요청을 확인하는 중…": "Checking the signature request…",
  "전자서명 · 동의서": "E-signature · consent",
  "전자서명": "E-signature",
  "마켓 화면(assets/market.js)을 불러오지 못했습니다. 새로고침해 주세요.": "Could not load the market view (assets/market.js). Please reload.",
  "이름·설명·태그·작성자 검색": "Search name, description, tag or author",
  "마켓 검색": "Search the market",
  "정렬 방식": "Sort order",
  "추천순": "Recommended",
  "최신 업데이트": "Recently updated",
  "이름순": "Name",
  "카테고리": "Category",
  "훅": "Hook",
  "상세 보기": "View details",
  "상세": "Details",
  "최소 SBPress": "Minimum SBPress",
  "필요 권한": "Permissions",
  "특별한 권한을 요청하지 않습니다.": "This plugin requests no special permissions.",
  "변경 이력": "Release notes",
  "기록된 변경 이력이 없습니다.": "No release notes recorded.",
  "미리보기 그림이 없습니다.": "No preview image.",
  "설치하는 중…": "Installing…",
  "켜기": "Turn on",
  "제거": "Remove",
  "설치됨 · 켜짐": "Installed · on",
  "설치됨 · 꺼짐": "Installed · off",
  "설치·켜기·제거는 관리자 화면에서만 할 수 있습니다.": "Installing, turning on and removing can be done in the admin screen only.",
  "관리자에서 관리": "Manage in admin",
  "조건에 맞는 플러그인이 없습니다. 검색어나 필터를 바꿔 보세요.": "No plugin matches these filters. Try another search or filter.",
  "마켓에 표시할 플러그인이 없습니다. 마켓 주소를 확인해 주세요.": "The market has no plugins yet. Check the market address.",
  "마켓 목록을 불러오는 중…": "Loading the market…",
  "다시 시도": "Try again",
  "호환": "Compatible",
  "플러그인 마켓 · MARKET": "PLUGIN MARKET",
  "SBPress 플러그인 마켓": "SBPress plugin market",
  "콘텐츠 꾸미기": "Content",
  "위젯·홈": "Widgets & home",
  "관리자 도구": "Admin tools",
  "읽기·접근성": "Reading & accessibility",
  "인쇄": "Print",
  "메뉴": "Menu",
  "검색": "Search",
  "업무 · 결재 Pro": "Work & approvals Pro",
  "업무 · 결재 고도화": "Work & approval upgrade",
  "조직 · 업무 분장": "Org & duties",
  "반복 업무 · 마감": "Recurring work & deadlines",
  "템플릿 · 체크리스트": "Templates & checklists",
  "결재선 · 일괄 결재": "Approval lines & batch",
  "결재 → 업무 연동": "Approval → task link",
  "업무 · 결재 리포트": "Work & approval report",
  "조직도와 업무 분장, 반복 업무, 템플릿과 체크리스트, 조건부 결재선과 일괄 결재, 결재–업무 자동 연동, 주간·월간 리포트를 한 화면에서 다룹니다.": "Org chart and duties, recurring work, templates and checklists, conditional approval lines and batch approval, automatic approval-to-task links, and weekly/monthly reports in one place.",
  "public.org_roles · task_templates · issue_checklist · approval_line_rules — 관리자만 읽고 씁니다(RLS). 결재–업무 연동 기록은 audit_logs 에 남습니다.": "public.org_roles · task_templates · issue_checklist · approval_line_rules — admin only (RLS). Approval-to-task changes are recorded in audit_logs.",
  "고도화 표가 아직 없습니다.": "The upgrade tables are not installed yet.",
  "을 SQL Editor 에서 실행하면 이 화면이 켜집니다.": "in the SQL Editor to turn this screen on.",
  "고도화 표가 아직 없습니다 — 위 안내의 SQL 을 실행해 주세요.": "The upgrade tables are not installed yet — run the SQL shown above.",
  "인원": "People",
  "조직도에 등록된 담당자": "People listed in the org chart",
  "진행 일감": "Open tasks",
  "미완료 일감 합계": "Unfinished tasks in total",
  "지연": "Overdue",
  "마감이 지난 미완료": "Unfinished past the deadline",
  "D-3 임박": "D-3 soon",
  "오늘부터 사흘 안": "Within three days",
  "업무 분장표": "Duty chart",
  "부서 · 팀 · 직책 · 담당 영역": "Department · team · title · area",
  "한 줄을 누르면 오른쪽 ‘담당자 추가·수정’에 값이 채워집니다. 진행·지연·임박은 일감에서 자동으로 셉니다.": "Pick a row to load it into the form on the right. Open, overdue and due-soon counts come from tasks automatically.",
  "아직 조직도에 담당자가 없습니다. 오른쪽에서 첫 담당자를 추가해 주세요.": "No one in the org chart yet. Add the first person on the right.",
  "담당자 추가": "Add person",
  "담당자 수정": "Edit person",
  "업무 분장": "Duties",
  "계정": "Account",
  "부서": "Department",
  "팀": "Team",
  "직책": "Title",
  "담당 영역": "Area",
  "새로 입력": "Clear",
  "— 계정 연결 안 함 —": "— No account —",
  "예: 박일차": "e.g. Alex Kim",
  "예: 운영팀": "e.g. Operations",
  "예: 결재·회계": "e.g. Approvals & finance",
  "예: 팀장": "e.g. Team lead",
  "예: 결재선 · 예산 집행": "e.g. Approval lines · budget",
  "진행": "In progress",
  "임박": "Due soon",
  "담당자를 추가했습니다.": "Person added.",
  "담당자를 수정했습니다.": "Person updated.",
  "담당자를 지웠습니다.": "Person deleted.",
  "이름이나 이메일 중 하나는 적어 주세요.": "Enter a name or an email.",
  "이 담당자를 업무 분장표에서 지울까요? 일감은 그대로 남습니다.": "Remove this person from the duty chart? Tasks stay as they are.",
  "먼저 분장표에서 담당자를 골라 주세요.": "Pick a person in the duty chart first.",
  "반복 일감": "Recurring tasks",
  "매주 · 매월 반복": "Weekly · monthly repeats",
  "마감이 지난 일감": "Tasks past their deadline",
  "D-1": "D-1",
  "오늘·내일 마감": "Due today or tomorrow",
  "D-3": "D-3",
  "사흘 안 마감": "Due within three days",
  "주간 · 월간": "Weekly · monthly",
  "줄의 ‘반복’을 바꾸면 바로 저장됩니다. ‘다음 일감 생성’은 제목·담당·체크리스트를 복사해 다음 회차 일감을 만들고 마감을 한 주기 미룹니다.": "Change “Repeat” on a row and it saves at once. “Create next task” copies the subject, assignee and checklist and moves the due date one cycle on.",
  "마감 필터": "Deadline filter",
  "오늘 마감": "Due today",
  "반복만": "Recurring only",
  "일감": "Task",
  "프로젝트": "Project",
  "반복": "Repeat",
  "다음 실행": "Next run",
  "다음 일감 생성": "Create next task",
  "반복 규칙": "Repeat rule",
  "반복 없음": "No repeat",
  "매주": "Weekly",
  "매월": "Monthly",
  "조건에 맞는 일감이 없습니다.": "No tasks match this filter.",
  "반복 규칙을 저장했습니다.": "Repeat rule saved.",
  "다음 일감을 만드는 중…": "Creating the next task…",
  "일감 템플릿": "Task templates",
  "템플릿 만들기": "New template",
  "자주 쓰는 일감을 템플릿으로 저장해 두면, 누를 때 일감과 하위 체크리스트가 한 번에 만들어집니다.": "Save a task you use often as a template; one click creates the task and its sub-checklist.",
  "아직 템플릿이 없습니다. ‘템플릿 만들기’로 첫 템플릿을 저장해 보세요.": "No templates yet. Create your first one with “New template”.",
  "하위 체크리스트": "Sub-checklist",
  "진행률 자동 합산": "Progress is summed automatically",
  "일감을 고르면 체크리스트와 진행률이 보입니다.": "Pick a task to see its checklist and progress.",
  "체크리스트 항목이 없습니다.": "No checklist items yet.",
  "체크리스트 항목 추가": "Add a checklist item",
  "항목 추가": "Add item",
  "체크리스트 항목": "Checklist item",
  "체크리스트 항목 삭제": "Delete checklist item",
  "일감 만들기": "Create task",
  "부서 공통": "All departments",
  "마감(일 뒤)": "Due in (days)",
  "일감 제목": "Task subject",
  "비우면 템플릿 이름을 씁니다": "Leave empty to use the template name",
  "템플릿 이름": "Template name",
  "예: 월간 결재 리포트 마감": "e.g. Monthly approval report deadline",
  "담당자": "Assignee",
  "체크리스트": "Checklist",
  "한 줄에 하나": "One per line",
  "자료 모으기&#10;초안 작성&#10;결재 상신": "Gather data&#10;Draft&#10;Submit for approval",
  "템플릿 수정": "Edit template",
  "템플릿 이름을 적어 주세요.": "Enter a template name.",
  "템플릿을 저장했습니다.": "Template saved.",
  "템플릿을 수정했습니다.": "Template updated.",
  "템플릿을 지웠습니다.": "Template deleted.",
  "이 템플릿을 지울까요? 이미 만들어진 일감은 그대로 남습니다.": "Delete this template? Tasks already created stay.",
  "템플릿으로 일감을 만드는 중…": "Creating a task from the template…",
  "체크리스트 항목을 더했습니다.": "Checklist item added.",
  "먼저 일감을 골라 주세요.": "Pick a task first.",
  "조건부 결재선 규칙": "Conditional approval-line rules",
  "양식 · 금액": "Form · amount",
  "양식과 금액 구간에 맞는 결재선을 규칙으로 저장합니다. 기안할 때 ‘결재선 추천’을 누르면 이 규칙이 먼저 적용됩니다(전결 규정이 걸리면 전결이 우선).": "Save approval lines for a form and amount range. “Recommend line” in a draft applies these rules first (a fast-track rule still wins).",
  "아직 규칙이 없습니다. 아래에서 첫 규칙을 저장해 보세요.": "No rules yet. Save the first one below.",
  "금액 구간": "Amount range",
  "최소 금액": "Min amount",
  "최대 금액": "Max amount",
  "비우면 상한 없음": "Empty = no limit",
  "1차 결재자": "First approver",
  "최종 결재자": "Final approver",
  "예: 100만원 이상은 대표 승인": "e.g. CEO approval from 1,000,000 KRW",
  "규칙 저장": "Save rule",
  "상한 없음": "No limit",
  "모든 양식": "All forms",
  "규칙을 저장했습니다.": "Rule saved.",
  "규칙을 수정했습니다.": "Rule updated.",
  "규칙을 지웠습니다.": "Rule deleted.",
  "규칙을 불러왔습니다. 고친 뒤 ‘규칙 저장’을 눌러 주세요.": "Rule loaded. Edit it, then press “Save rule”.",
  "결재자를 한 명 이상 골라 주세요.": "Pick at least one approver.",
  "이 결재선 규칙을 지울까요?": "Delete this approval-line rule?",
  "기안 · 결재선 추천": "Draft · recommended line",
  "일감 연결": "Task link",
  "금액": "Amount",
  "금액이 없으면 비워 두세요": "Leave empty when there is no amount",
  "예: 11월 인쇄비 지출": "e.g. November printing costs",
  "내용을 적어 주세요": "Write the details",
  "결재선 추천": "Recommend line",
  "규칙에 맞는 결재선을 찾으면 여기에 표시됩니다.": "A matching approval line will appear here.",
  "조건에 맞는 규칙이 없습니다. 결재자를 직접 골라 주세요.": "No matching rule. Pick the approvers yourself.",
  "추천": "Suggested",
  "관련 일감": "Related task",
  "— 연결 안 함 —": "— Not linked —",
  "— 일감 선택 —": "— Pick a task —",
  "— 지정 안 함 —": "— Unassigned —",
  "— 선택 —": "— Select —",
  "승인 시 일감 상태": "Task status on approval",
  "관련 일감을 고르면 이 기안이 최종 승인되는 순간 그 일감의 상태가 위 값으로 바뀌고, 변경 사실이 audit_logs 에 남습니다.": "Link a task and, the moment this draft is finally approved, that task moves to the status above and the change is written to audit_logs.",
  "상신하기": "Submit",
  "결재 대기함": "Approval inbox",
  "처리할 기안을 골라 한 번에 승인하거나 반려합니다. 건별로 권한과 상태를 다시 확인합니다.": "Pick drafts to approve or reject in one go. Each one is checked for permission and state again.",
  "문서": "Document",
  "지금 처리할 기안이 없습니다.": "No drafts waiting for you.",
  "반려 사유(반려할 때 필수)": "Rejection reason (required to reject)",
  "반려 사유": "Rejection reason",
  "일괄 승인": "Approve selected",
  "일괄 반려": "Reject selected",
  "결재 양식을 골라 주세요.": "Pick an approval form.",
  "결재자를 골라 주세요.": "Pick the approvers.",
  "처리할 기안을 골라 주세요.": "Pick the drafts to process.",
  "반려 사유를 적어 주세요.": "Enter a rejection reason.",
  "상신하는 중…": "Submitting…",
  "일괄 처리하는 중…": "Processing…",
  "기안을 상신했습니다 ·": "Draft submitted ·",
  " · 일감 연결": " · task linked",
  "결재 – 업무 자동 연동": "Approval – task automation",
  "최종 승인 → 일감 상태": "Final approval → task status",
  "기안에 일감을 연결해 두면, 최종 승인되는 순간 그 일감의 상태가 약속한 값으로 바뀌고 감사 기록(audit_logs)이 남습니다. 반려·회수에는 아무 변화도 일어나지 않습니다.": "When a draft is linked to a task, final approval moves that task to the agreed status and writes an audit_logs entry. Rejection or withdrawal changes nothing.",
  "아직 일감이 연결된 기안이 없습니다. ‘결재선 · 일괄 결재’에서 기안할 때 관련 일감을 골라 보세요.": "No draft is linked to a task yet. Choose a related task when drafting under “Approval lines & batch”.",
  "연결 일감": "Linked task",
  "일감 현재": "Task now",
  "승인 시": "On approval",
  "반영됨": "Applied",
  "자동 변경 기록": "Automatic change log",
  "approval_auto 표시가 있는 감사 로그입니다. 누가 승인해 어느 일감이 어떻게 바뀌었는지 남습니다.": "Audit entries marked approval_auto: who approved and which task changed, and how.",
  "아직 자동 변경 기록이 없습니다.": "No automatic changes yet.",
  "시스템": "System",
  "주간 업무 · 결재 리포트": "Weekly work & approval report",
  "월간 업무 · 결재 리포트": "Monthly work & approval report",
  "완료 일감": "Completed tasks",
  "이전 기간": "Previous period",
  "지금 기준 미완료": "Open now",
  "평균 결재 시간": "Average approval time",
  "시간 · 승인된 기안": "hours · approved drafts",
  "승인 / 반려": "Approved / rejected",
  "부서별 일감": "Tasks by department",
  "미완료": "Open",
  "양식별 결재": "Approvals by form",
  "평균": "Average",
  "평균(시간)": "Average (h)",
  "SBPress 업무 · 결재 리포트": "SBPress work & approval report",
  "지연(미완료)": "Overdue (open)",
  "평균 결재 시간(시간)": "Average approval time (h)",
  "자료가 없습니다.": "No data.",
  "리포트를 불러오지 못했습니다. 새로고침을 눌러 주세요.": "Could not load the report. Press Refresh.",
  "리포트를 CSV 로 내려받았습니다.": "Report downloaded as CSV.",
  "주간": "Weekly",
  "월간": "Monthly",
  "완료 일감은 resolved·closed 로 끝난 일감, 평균 결재 시간은 상신부터 최종 승인까지의 평균입니다. 이전 기간(": "Completed tasks are those ended as resolved or closed; average approval time runs from submission to final approval. Compared with the previous period (",
  ")과 비교합니다.": ")",
  "처리하지 못했습니다:": "Could not process:",
  "자료를 읽지 못했습니다:": "Could not load:",
  "표를 찾지 못했습니다 — supabase/22_v101_work_approval_pro.sql 을 먼저 실행해 주세요.": "Table not found — run supabase/22_v101_work_approval_pro.sql first.",
  "신규": "New",
  "진행중": "In progress",
  "해결": "Resolved",
  "피드백": "Feedback",
  "보류": "On hold",
  "결재중": "In approval",
  "업무": "Task",
  "오류": "Bug",
  "기능": "Feature",
  "지원": "Support",
  "낮음": "Low",
  "보통": "Normal",
  "높음": "High",
  "긴급": "Urgent",
  "부서 미지정": "No department",
  "이름 없음": "No name",
  "/ 전체": "/ total",
  "— 체크하면 일감 진행률이 바로 바뀝니다.": "— ticking recalculates the task progress at once."
};
  var RULES = ([
  [
    "자동 저장된 임시본이 있습니다 · ",
    "Auto-saved draft · "
  ],
  [
    " · 모두 (\\d+)행",
    " · \\1 rows in total"
  ],
  [
    "사이트 (.+?) · 내보낸 시각",
    "Site \\1 · exported"
  ],
  [
    "(\\d+)건을",
    "\\1 items "
  ],
  [
    "(\\d+)건",
    "\\1 items"
  ],
  [
    "(\\d+)장을",
    "\\1 images "
  ],
  [
    "(\\d+)장 올리는 중…",
    "Uploading \\1 images…"
  ],
  [
    "(\\d+)행은 ",
    "\\1 rows "
  ],
  [
    "(\\d+)행에 ",
    "\\1 rows "
  ],
  [
    "모두 (\\d+)행",
    "\\1 rows in total"
  ],
  [
    "백업 sbpress-backup-(\\d+-\\d+-\\d+)\\.json — (\\d+)건을 내려받았습니다\\.",
    "Backup sbpress-backup-\\1.json — \\2 items downloaded."
  ],
  [
    "백업 sbpress-backup-(\\d+-\\d+-\\d+)\\.json$",
    "Backup sbpress-backup-\\1.json"
  ],
  [
    "접수 (\\d+)건을 CSV 로 내려받았습니다\\.",
    "Downloaded \\1 submissions as CSV."
  ],
  [
    "‘(.+?)’\\(으\\)로 저장했습니다\\.",
    "Saved “\\1”."
  ],
  [
    "접수 상태를 ‘(.+?)’\\(으\\)로 저장했습니다\\.",
    "Saved the status as “\\1”."
  ],
  [
    "‘(.+?)’ 글을 휴지통으로 옮길까요\\?",
    "Move “\\1” to the trash?"
  ],
  [
    "‘(.+?)’ 글을 영구 삭제할까요\\?",
    "Delete “\\1” permanently?"
  ],
  [
    "글을 휴지통으로 옮겼습니다\\. ‘휴지통 보기’에서 복구할 수 있습니다\\.",
    "Moved the post to the trash. Restore it from “Show trash”."
  ],
  [
    "글을 복구했습니다\\. 공개 사이트에 다시 나타납니다\\.",
    "Post restored. It is back on the public site."
  ],
  [
    "글을 영구 삭제했습니다\\.",
    "Post deleted permanently."
  ],
  [
    "페이지를 수정했습니다: ",
    "Page updated: "
  ],
  [
    "페이지를 만들었습니다: ",
    "Page created: "
  ],
  [
    "글을 저장했습니다\\.",
    "Post saved."
  ],
  [
    "접수 내용을 지웠습니다\\.",
    "Submission deleted."
  ],
  [
    "결재 (\\d+) items · 양식 (\\d+)개 · 전결 (\\d+) · 대결 (\\d+)",
    "\\1 approvals · \\2 forms · \\3 fast-track · \\4 delegations"
  ],
  [
    "결재 (\\d+)건",
    "\\1 approvals"
  ],
  [
    "양식 (\\d+)개",
    "\\1 forms"
  ],
  [
    "전결 (\\d+)",
    "\\1 fast-track"
  ],
  [
    "대결 (\\d+)",
    "\\1 delegations"
  ],
  [
    "양식·금액 상한·결재자를",
    "form, amount limit and approver"
  ],
  [
    "^(\\d+)번째 블록을 (\\d+)번째로 옮겼습니다\\.$",
    "Moved block \\1 to position \\2."
  ],
  [
    "^(\\d+)번째 블록 끌어서 순서 바꾸기$",
    "Drag block \\1 to reorder"
  ],
  [
    "^(\\d+)번째 블록 (복제|숨김|잠금|위로|아래로|삭제)$",
    "Block \\1 \\2"
  ],
  [
    "^(\\d+)번째 블록 ",
    "Block \\1 "
  ],
  [
    "^실행 취소 — 남은 되돌리기 (\\d+)단계$",
    "Undo — \\1 steps left"
  ],
  [
    "^다시 실행 — 남은 다시 실행 (\\d+)단계$",
    "Redo — \\1 steps left"
  ],
  [
    "^을 v(.+?) 으로 업데이트했습니다\\.$",
    " updated to v\\1."
  ],
  [
    "^(\\d+) / 9$",
    "\\1 / 9"
  ],
  [
    "^(\\d+)번째 메뉴 삭제$",
    "Menu \\1 delete"
  ],
  [
    "^(\\d+)번째 메뉴 아래로$",
    "Menu \\1 move down"
  ],
  [
    "^(\\d+)번째 메뉴 위로$",
    "Menu \\1 move up"
  ],
  [
    "^(\\d+)번째 메뉴 연결 대상$",
    "Menu \\1 target"
  ],
  [
    "^(\\d+)번째 메뉴 영어 이름$",
    "Menu \\1 English name"
  ],
  [
    "^(\\d+)번째 메뉴 한국어 이름$",
    "Menu \\1 Korean name"
  ],
  [
    "^(\\d+)번째 메뉴 작은 표기$",
    "Menu \\1 small note"
  ],
  [
    "^(.+?) 등급 변경$",
    "Change grade for \\1"
  ],
  [
    "^(\\d)단계 · (.+)$",
    "Grade \\1 · \\2"
  ],
  [
    "^(.+) \\(게시판 없음\\)$",
    "\\1 (no board)"
  ],
  [
    "^(\\d)단계$",
    "Grade \\1"
  ],
  [
    "^(.+?) 홈$",
    "\\1 home"
  ],
  [
    "^(.+?) 운영자 계정으로 로그인하면 회원·찜·등록 현황을 볼 수 있습니다\\.$",
    "Sign in with the \\1 owner account to see members, bookmarks and registrations."
  ],
  [
    "^마지막 확인 (오전|오후) (\\d+):(\\d+)$",
    "Last checked \\2:\\3"
  ],
  [
    "^불러옴 (오전|오후) (\\d+):(\\d+)$",
    "Loaded \\2:\\3"
  ],
  [
    "^현황 (오전|오후) (\\d+):(\\d+)$",
    "Counts \\2:\\3"
  ],
  [
    "^파일 (\\d+)개 · (.*)$",
    "\\1 files · \\2"
  ],
  [
    "^전체 (\\d+)개$",
    "\\1 total"
  ],
  [
    "^7일 안에 마감 · (.+)$",
    "Due within 7 days · \\1"
  ],
  [
    "오후 (\\d+):(\\d+)",
    "\\1:\\2 PM"
  ],
  [
    "오전 (\\d+):(\\d+)",
    "\\1:\\2 AM"
  ],
  [
    "^(\\d+)건$",
    "\\1"
  ],
  [
    "^(\\d+)곳$",
    "\\1"
  ],
  [
    "^(\\d+)개$",
    "\\1"
  ],
  [
    "^(\\d+)명$",
    "\\1"
  ],
  [
    "^(\\d+[.]?\\d*)개/회원 · 최근 (\\d+)건 집계$",
    "\\1 per member · \\2 saves recently"
  ],
  [
    "^· (\\d+)개 항목 · 공개 읽기 \\/ 관리자만 수정$",
    " · \\1 fields · public read / admin write"
  ],
  [
    "^· 헤더·푸터·head (\\d+)개 항목 · 공개 읽기 \\/ 관리자만 수정$",
    " · \\1 header/footer/head fields · public read / admin write"
  ],
  [
    "^· 전체 (\\d+)명 · 관리자 권한 조회\\(RLS\\) · 등급은 오른쪽 선택상자로 바로 바꿉니다$",
    " · \\1 members · read with admin rights (RLS) · change a grade in the select box on the right"
  ],
  [
    "^검토 대기 (\\d+)곳 · 시트 전체 (\\d+)행$",
    "\\1 pending review · \\2 rows in the sheet"
  ],
  [
    "^설치 (\\d+)개 · 켜짐 (\\d+)개$",
    "\\1 installed · \\2 enabled"
  ],
  [
    "^마켓 목록 (\\d+)개 · (.+)$",
    "\\1 plugins in the market · \\2"
  ],
  [
    "^이번 주 (\\d+)건 \\+ 아카이브 (\\d+)건$",
    "\\1 this week + \\2 archived"
  ],
  [
    "^진행 (\\d+)건 · 7일 내 (\\d+)건$",
    "\\1 open · \\2 due in 7 days"
  ],
  [
    "^찜 (\\d+)건 · 공방 (\\d+)곳$",
    "\\1 saved · \\2 workshops"
  ],
  [
    "^최근 7일 신규 \\+(\\d+)명 · 찜한 회원 (\\d+)명$",
    "+\\1 new in 7 days · \\2 members saved"
  ],
  [
    "^전체 (\\d+)건$",
    "\\1 total"
  ],
  [
    "^(.+?) · 전체 (\\d+)건 \\(승인 (\\d+) · 대기 (\\d+)\\) · 행을 누르면 시트에서 바로 엽니다$",
    "\\1 · \\2 total (approved \\3 · pending \\4) · click a row to open it in the sheet"
  ],
  [
    "^불러오지 못했습니다: (.+)$",
    "Could not load: \\1"
  ],
  [
    "^(.+?) · 내보낸 시각 (.+)$",
    "\\1 · exported \\2"
  ],
  [
    "^사이트 (.+?) · 내보낸 시각 (.+)$",
    "Site \\1 · exported \\2"
  ],
  [
    "^(.+?) · 모두 (\\d+)행$",
    "\\1 · \\2 rows in total"
  ],
  [
    "^모두 (\\d+)행$",
    "\\2 rows in total"
  ],
  [
    "^최근 7일 접수 (\\d+)건 · 댓글 (\\d+)건$",
    "Last 7 days: \\1 submissions · \\2 comments"
  ],
  [
    "^7일 · (.+)$",
    "\\1"
  ],
  [
    "^구독 중 (\\d+)명 · 명부$",
    "\\1 subscribed · roster"
  ],
  [
    "^구독 중 (\\d+)명 · 접수 기록$",
    "\\1 subscribed · form records"
  ],
  [
    "^전체 (\\d+)명$",
    "\\1 subscribers"
  ],
  [
    "^(\\d+) / (\\d+)명$",
    "\\1 / \\2 subscribers"
  ],
  [
    "^구독자 (\\d+)명을 CSV 로 내려받았습니다\\.$",
    "Downloaded \\1 subscribers as CSV."
  ],
  [
    "^미리보기 — 글 (\\d+)개 · HTML (.+)$",
    "Preview — \\1 posts · HTML \\2"
  ],
  [
    "^뉴스레터 HTML 을 내려받았습니다 \\(글 (\\d+)개 · (.+)\\)\\.$",
    "Newsletter HTML downloaded (\\1 posts · \\2)."
  ],
  [
    "^원본 그대로 올렸습니다 — WebP 로 바꿔도 더 작아지지 않았습니다\\((.+?)\\)\\.$",
    "Kept the original — WebP would not be smaller (\\1)."
  ],
  [
    "^WebP (\\d+)×(\\d+) · (.+?) → (.+?) \\((\\d+)% 절감\\)$",
    "WebP \\1×\\2 · \\3 → \\4 (\\5% smaller)"
  ],
  [
    "^이번 방문 절감 (.+)$",
    "Saved \\1 this visit"
  ],
  [
    "^페이지를 수정했습니다: (.+?) · 사이트 (#\\/page\\/.+?) 에 반영됩니다\\.$",
    "Page updated: \\1 · live at \\2"
  ],
  [
    "^페이지를 만들었습니다: (.+?) · 사이트 (#\\/page\\/.+?) 에 반영됩니다\\.$",
    "Page created: \\1 · live at \\2"
  ],
  [
    "^파일 (\\d+)개$",
    "\\1 files"
  ],
  [
    "^최근 (\\d+)건$",
    "Last \\1"
  ],
  [
    "^이 속도면 약 (.+)일 뒤 한도$",
    "About \\1 days of headroom at this rate"
  ],
  [
    "^선택 (\\d+)개 · (.+)$",
    "\\1 selected · \\2"
  ],
  [
    "^백업 (\\d+)건 · 정리 가능$",
    "\\1 backed up · ready"
  ],
  [
    "^고아 이미지 (\\d+)개 · 회수 가능 (.+?) · (.+)$",
    "\\1 unused images · \\2 recoverable · \\3"
  ],
  [
    "^고아 이미지 (\\d+)개\\((.+?)\\)를 삭제할까요\\?[\\s\\S]*$",
    "Delete \\1 unused images (\\2)? The files cannot be restored."
  ],
  [
    "^고아 이미지 (\\d+)개\\((.+?)\\)를 삭제했습니다\\.$",
    "Deleted \\1 unused images (\\2)."
  ],
  [
    "^고아 이미지를 찾지 못했습니다: (.+)$",
    "Could not scan for unused images: \\1"
  ],
  [
    "^일부 표를 읽지 못했습니다\\(참조를 놓칠 수 있음\\): (.+)$",
    "Some tables could not be read, so references may be missing: \\1"
  ],
  [
    "^감사 로그 (\\d+)건을 JSON 으로 내려받았습니다\\. 이제 ‘정리’를 누를 수 있습니다\\.$",
    "Downloaded \\1 audit logs as JSON. You can press “Clean up” now."
  ],
  [
    "^감사 로그 (\\d+)건을 정리했습니다\\. 정리 기록을 감사 로그에 남겼습니다\\.$",
    "Removed \\1 audit logs. The cleanup was recorded in the audit log."
  ],
  [
    "^감사 로그 (\\d+)건을 일반 삭제로 정리했습니다\\. 서버 함수가 없어 감사 로그에는 기록을 남기지 못했습니다\\.$",
    "Removed \\1 audit logs with a direct delete. Without the server function the cleanup could not be recorded."
  ],
  [
    "^완료 접수 (\\d+)건을 JSON 으로 내려받았습니다\\. 이제 ‘정리’를 누를 수 있습니다\\.$",
    "Downloaded \\1 handled submissions as JSON. You can press “Clean up” now."
  ],
  [
    "^완료 접수 (\\d+)건을 정리했습니다\\. 정리 기록을 감사 로그에 남겼습니다\\.$",
    "Removed \\1 handled submissions. The cleanup was recorded in the audit log."
  ],
  [
    "^완료 접수 (\\d+)건을 일반 삭제로 정리했습니다\\. 서버 함수가 없어 감사 로그에는 기록을 남기지 못했습니다\\.$",
    "Removed \\1 handled submissions with a direct delete. Without the server function the cleanup could not be recorded."
  ],
  [
    "^백업하지 못했습니다: (.+)$",
    "Could not back up: \\1"
  ],
  [
    "^정리하지 못했습니다: (.+)$",
    "Could not clean up: \\1"
  ],
  [
    "^결재 (\\d+)건 · 양식 (\\d+)개$",
    "\\1 documents · \\2 forms"
  ],
  [
    "^추가 항목 (\\d+)개$",
    "\\1 fields"
  ],
  [
    "^(\\d+) / (\\d+)건$",
    "\\1 / \\2"
  ],
  [
    "^(\\d+)차 · (\\d+)/(\\d+) 승인$",
    "Step \\1 · \\2/\\3 approved"
  ],
  [
    "^(\\d+)차$",
    "Step \\1"
  ],
  [
    "^(\\d+)번째 항목이 객체가 아닙니다\\.$",
    "Entry \\1 is not an object."
  ],
  [
    "^(\\d+)번째 항목에 key 가 없습니다\\.$",
    "Entry \\1 has no key."
  ],
  [
    "^(\\d+)번째 항목에 label 이 없습니다\\.$",
    "Entry \\1 has no label."
  ],
  [
    "^(\\d+)번째 type 은 text·number·date·select·file 중 하나여야 합니다\\.$",
    "Entry \\1: type must be one of text, number, date, select, file."
  ],
  [
    "^추가 항목 JSON 의 형식이 맞지 않습니다: (.+)$",
    "The extra-fields JSON is not valid: \\1"
  ],
  [
    "^‘(.+?)’ 양식을 삭제할까요\\?[\\s\\S]*$",
    "Delete the “\\1” form? Existing drafts stay; only the form name is cleared."
  ],
  [
    "^결재 표를 읽지 못했습니다: (.+?) — supabase/15_v40_approvals\\.sql 을 SQL Editor 에서 한 번 실행해 주세요\\.$",
    "Could not read the approval tables: \\1 — run supabase/15_v40_approvals.sql once in the SQL Editor."
  ],
  [
    "^(\\d+)건$",
    "\\1"
  ],
  [
    "^(\\d+)개 · (\\d+)회$",
    "\\1 · \\2 retries"
  ],
  [
    "^(\\d+) / (\\d+)$",
    "\\1 / \\2"
  ],
  [
    "^재시도 (\\d+)회$",
    "\\1 retries"
  ],
  [
    "^재시도 (\\d+)회 · HTTP (\\d+)$",
    "\\1 retries · HTTP \\2"
  ],
  [
    "^처리 (\\d+)건$",
    "\\1 processed"
  ],
  [
    "^시험 발송을 마쳤습니다\\(처리 (\\d+)건\\)\\.$",
    "Test delivery finished (\\1 processed)."
  ],
  [
    "^브라우저에서 직접 보냈습니다\\(재시도 (\\d+)회\\)\\.$",
    "Sent from the browser (\\1 retries)."
  ],
  [
    "^보내지 못했습니다\\(재시도 (\\d+)회 · 응답 (.+?)\\)\\. 이력에 실패로 남겼습니다\\.$",
    "Could not deliver (\\1 retries · response \\2). Recorded as failed."
  ],
  [
    "^대기 (\\d+)건을 처리했습니다\\.$",
    "Processed \\1 queued deliveries."
  ],
  [
    "^‘(.+?)’ 웹훅을 삭제할까요\\?$",
    "Delete the “\\1” webhook?"
  ],
  [
    "^상태를 ‘(.+?)’\\(으\\)로 바꿨습니다\\.$",
    "Status changed to “\\1”."
  ],
  [
    "^예약 양식을 읽지 못했습니다: (.+)$",
    "Could not read reservation forms: \\1"
  ],
  [
    "^슬롯을 읽지 못했습니다: (.+)$",
    "Could not read slots: \\1"
  ],
  [
    "^신청을 읽지 못했습니다: (.+)$",
    "Could not read applications: \\1"
  ],
  [
    "^저장하지 못했습니다: (.+)$",
    "Could not save: \\1"
  ],
  [
    "^슬롯을 저장하지 못했습니다: (.+)$",
    "Could not save the slot: \\1"
  ],
  [
    "^상태를 바꾸지 못했습니다: (.+)$",
    "Could not change the status: \\1"
  ],
  [
    "^웹훅을 읽지 못했습니다: (.+)$",
    "Could not read webhooks: \\1"
  ],
  [
    "^저장하지 못했습니다: (.+)$",
    "Could not save: \\1"
  ],
  [
    "^AI 호출에 실패했습니다: (.+)$",
    "AI request failed: \\1"
  ],
  [
    "^삭제할까요\\?$",
    "Delete?"
  ],
  [
    "^(\\d+)분 전$",
    "\\1 min ago"
  ],
  [
    "^(\\d+)시간 전$",
    "\\1 h ago"
  ],
  [
    "^(\\d+)일 전$",
    "\\1 d ago"
  ],
  [
    "^지금 보고 있는 사이트입니다\\.$",
    "this is the current site"
  ],
  [
    "^레코드 (\\d+)개 · 체크리스트 (\\d+)단계$",
    "\\1 records · \\2 checklist steps"
  ],
  [
    "^이 사이트의 지금 값을 저장했습니다\\. \\((.+)\\)$",
    "Saved the current values of this site (\\1)."
  ],
  [
    "^DNS \\(Cloudflare\\) — @ A 4개 · www CNAME (.+)$",
    "DNS (Cloudflare) — 4 @ A records · www CNAME \\1"
  ],
  [
    "^@ A (.+) \\/ www CNAME (.+)$",
    "@ A \\1 / www CNAME \\2"
  ],
  [
    "^사이트 목록을 읽지 못했습니다: (.+)$",
    "Could not read the site list: \\1"
  ],
  [
    "^지금 값을 읽지 못했습니다: (.+)$",
    "Could not read the current values: \\1"
  ],
  [
    "^요청 (\\d+)건$",
    "\\1 requests"
  ],
  [
    "^요청일 (.+)$",
    "Requested \\1"
  ],
  [
    "^만료일 (.+)$",
    "Expires \\1"
  ],
  [
    "^서명 시각 (.+)$",
    "Signed at \\1"
  ],
  [
    "^서명 요청을 읽지 못했습니다: (.+)$",
    "Could not read the signature requests: \\1"
  ],
  [
    "^서명 기록을 읽지 못했습니다: (.+)$",
    "Could not read the signature record: \\1"
  ],
  [
    "^(\\d+)개 항목$",
    "\\1 items"
  ],
  [
    "^승인 (\\d+)건 · 실패 (\\d+)건",
    "Approved \\1 · failed \\2"
  ],
  [
    "^반려 (\\d+)건 · 실패 (\\d+)건",
    "Rejected \\1 · failed \\2"
  ],
  [
    "^다음 일감을 만들었습니다 · (.+?) \\(마감 (\\d{4}-\\d{2}-\\d{2})\\)$",
    "Created the next task · \\1 (due \\2)"
  ],
  [
    "^일감을 만들었습니다 · (.+?) · 체크리스트 (\\d+)개$",
    "Task created · \\1 · \\2 checklist items"
  ],
  [
    "^기안을 상신했습니다 · (.+?) · 일감 연결$",
    "Draft submitted · \\1 · task linked"
  ],
  [
    "^기안을 상신했습니다 · (.+)$",
    "Draft submitted · \\1"
  ],
  [
    "^처리하지 못했습니다: (.+)$",
    "Could not process: \\1"
  ],
  [
    "^자료를 읽지 못했습니다: (.+)$",
    "Could not load: \\1"
  ],
  [
    "^고른 기안 (\\d+)건을 반려할까요\\?$",
    "Reject the \\1 selected drafts?"
  ],
  [
    "^이전 기간 (\\d+)$",
    "Previous \\1"
  ],
  [
    "^마감 (\\d+)$",
    "Due in \\1"
  ],
  [
    "^D-(\\d+)$",
    "D-\\1"
  ]
]).map(function (r) {
    /* 파이썬 쪽 규칙은 \1 로 그룹을 가리킵니다 — JS replace 는 $1 을 씁니다. */
    return [new RegExp(r[0]), String(r[1]).replace(/\\(\d)/g, "$$$1")];
  }).sort(function (a, b) {
    /* 전체 문장(^…$) 규칙을 먼저 적용해야 ‘40건’ 같은 조각 규칙이 문장을 망가뜨리지 않습니다. */
    var aa = a[0].source.charAt(0) === "^" ? 0 : 1;
    var ab = b[0].source.charAt(0) === "^" ? 0 : 1;
    return aa - ab;
  });

  var lang = "ko";
  try { lang = String(localStorage.getItem(KEY) || "").toLowerCase() === "en" ? "en" : "ko"; } catch (e) { lang = "ko"; }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, INPUT: 1, SVG: 1 };
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  var origText = new WeakMap();       // 텍스트 노드 → 원래 한국어
  var origAttr = new WeakMap();       // 요소 → { attr: 원래 값 }
  var missing = {};                   // 번역이 없어 남은 문구(시험용)
  var busy = false, queued = 0;

  function hasKo(s) { return /[가-힣]/.test(s || ""); }

  function translate(text) {
    if (!hasKo(text)) return text;
    var pad = "";
    var core = String(text);
    var lead = /^\s*/.exec(core)[0];
    var tail = /\s*$/.exec(core)[0];
    core = core.slice(lead.length, core.length - tail.length);
    if (!core) return text;
    var hit = DICT[core];
    if (hit != null) { pad = lead; return lead + hit + tail; }
    var out = core;
    for (var i = 0; i < RULES.length; i++) {
      out = out.replace(RULES[i][0], RULES[i][1]);
    }
    if (out !== core && hasKo(out)) {
      /* ‘Grade 1 · 일반회원’ 처럼 조각이 남으면 ‘ · ’ 로 나눠 낱말 사전을 한 번 더 씁니다. */
      var parts = out.split(" · ");
      if (parts.length > 1) {
        var done = parts.map(function (part) {
          var key = part.trim();
          if (!hasKo(key)) return part;
          var hit2 = DICT[key];
          if (hit2 == null) return null;
          return part.replace(key, hit2);
        });
        if (done.indexOf(null) < 0) out = done.join(" · ");
      }
    }
    if (out === core) { missing[core] = (missing[core] || 0) + 1; return text; }
    if (hasKo(out)) missing[core] = (missing[core] || 0) + 1;
    return lead + out + tail;
  }

  function skipNode(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (SKIP_TAGS[p.tagName]) return true;
      if (p.hasAttribute && p.hasAttribute("data-sbp-brand")) return true;
      if (p.hasAttribute && p.hasAttribute("data-no-i18n")) return true;
      p = p.parentNode;
    }
    return false;
  }

  function doText(node, toEn) {
    if (!node || node.nodeType !== 3) return;
    if (skipNode(node)) return;
    if (toEn) {
      var cur = node.nodeValue;
      if (!hasKo(cur)) return;
      var next = translate(cur);
      if (next !== cur) {
        if (!origText.has(node)) origText.set(node, cur);
        node.nodeValue = next;
      }
    } else {
      var back = origText.get(node);
      if (back != null && back !== node.nodeValue) node.nodeValue = back;
    }
  }

  function doAttrs(el, toEn) {
    if (!el || el.nodeType !== 1) return;
    var store = origAttr.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute || !el.hasAttribute(a)) return;
      var cur = el.getAttribute(a) || "";
      if (!hasKo(cur)) return;
      if (toEn) {
        var next = translate(cur);
        if (next !== cur) {
          if (store[a] == null) store[a] = cur;
          el.setAttribute(a, next);
        }
      } else if (store[a] != null) {
        el.setAttribute(a, store[a]);
      }
    });
    origAttr.set(el, store);
  }

  function walk(root, toEn) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root, toEn); return; }
    if (root.nodeType !== 1) return;
    if (skipNode(root)) return;
    doAttrs(root, toEn);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) doText(n, toEn);
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      if (skipNode(els[i])) continue;
      doAttrs(els[i], toEn);
    }
  }

  function render() {
    if (busy) return;
    busy = true;
    try { walk(document.body, lang === "en"); } finally { busy = false; }
  }

  function queue() {
    if (queued) return;
    queued = setTimeout(function () { queued = 0; render(); }, 40);
  }

  function paintSwitch() {
    var box = document.getElementById("admin-lang");
    if (!box) return;
    [].forEach.call(box.querySelectorAll("[data-alang]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-alang") === lang ? "true" : "false");
      b.className = b.getAttribute("data-alang") === lang ? "on" : "";
    });
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "ko");
  }

  function title() {
    if (lang === "en") {
      var cur = document.title || "";
      if (cur.indexOf("Admin · ") !== 0) {
        var brand = cur.replace(/^관리자\s*·\s*/, "");
        document.title = "Admin · " + brand;
      }
    }
  }

  function set(next, quiet) {
    lang = String(next).toLowerCase() === "en" ? "en" : "ko";
    try { localStorage.setItem(KEY, lang); } catch (e) { /* noop */ }
    paintSwitch();
    render();
    title();
    if (!quiet) document.dispatchEvent(new CustomEvent("craft:lang", { detail: { lang: lang } }));
  }

  function init() {
    paintSwitch();
    render();
    title();
    var box = document.getElementById("admin-lang");
    if (box) {
      box.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-alang]");
        if (!b) return;
        e.preventDefault();
        set(b.getAttribute("data-alang"));
      });
    }
    try {
      new MutationObserver(function () { if (!busy) queue(); }).observe(document.body, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ATTRS
      });
    } catch (e) { /* 아주 오래된 브라우저 — 처음 그린 화면만 번역 */ }
  }

  window.ADMIN_I18N = {
    lang: function () { return lang; },
    set: set,
    t: translate,
    render: render,
    missing: function () { return Object.keys(missing).sort(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

