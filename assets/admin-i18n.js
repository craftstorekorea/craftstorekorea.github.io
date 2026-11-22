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
  "백업 파일": "Backup file"
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

