/* ============================================================================
   SBPress v10.9 · 노코드 플러그인 스튜디오 (assets/studio.js)
   ----------------------------------------------------------------------------
   관리자(/admin) > 플러그인 · 마켓 > 「스튜디오」 서브탭에서만 동작합니다.
   이 파일과 studio.css 는 첫 화면(index.html)에 넣지 않고, 스튜디오 탭에 처음 들어갈 때
   market.js 가 SBP.loadScript / <link> 로 한 번만 받아옵니다(첫 화면 300KB 예산).

   하는 일
     · 프리셋 4종 — ① 공지 배너 위젯(widget) ② 카드 배지 데코레이터(card)
                    ③ 상단 메뉴 바로가기(menu) ④ 커스텀 안내 블록(block · ctx.addBlock)
     · 비주얼 폼 — 이름·슬러그·버전·요약·카테고리, 훅, 제목/본문/버튼 라벨/링크(https:// 또는 /),
                   배경·강조색(#RRGGBB)을 고치면 코드·해시·미리보기가 바로 바뀝니다.
     · 안전한 코드 생성 — 모든 문자열은 JSON.stringify 로 이스케이프하고, 링크·색은 형식을 검사하며
       eval · new Function · <script> · document.write · http:// · javascript: 를 입력 단계에서 막습니다.
       생성한 코드도 같은 정적 검사를 한 번 더 통과해야 저장·설치·제출할 수 있습니다.
     · SHA-256 — crypto.subtle.digest('SHA-256') 로 16진수 해시와 SRI(sha256-…)를 계산합니다.
     · 초안 — Supabase plugin_drafts(30_v109 SQL). 표가 없으면 이 브라우저(localStorage)에 저장하고
              "30_v109 SQL 을 실행하면 서버에도 남습니다" 로 안내합니다.
     · 내보내기 — .js 파일 다운로드 · plugins-market.json 항목 복사.
     · 내 사이트에 바로 설치 — v10.5 권한 동의(요청 권한·무결성·샌드박스)를 확인한 뒤
              plugins 표에 script_url="inline:base64:…" 로 저장합니다(플러그인 엔진이 실행 전에
              정적 검사 + SHA-256 대조 + 권한 샌드박스를 다시 합니다).
     · 마켓 제출 — v10.6 제출 모달(market.js)을 열어 값을 채워 둡니다.

   보안: 화면에 넣는 모든 값은 esc() 로 이스케이프하고, 인라인 이벤트·eval 을 쓰지 않습니다(CSP).
   ============================================================================ */
(function () {
  "use strict";

  if (window.SBP_STUDIO && window.SBP_STUDIO.__v === 109) return;

  var LS_DRAFTS = "sbpress-studio-drafts";
  var LS_TAB = "sbpress-studio-tab";
  var MAX_CODE = 60000;

  /* ---------------- 문구 (KO · EN) ---------------- */
  var L = {
    ko: {
      eyebrow: "노코드 플러그인 스튜디오 · STUDIO",
      title: "플러그인을 조립해서 만듭니다",
      lead: "프리셋을 고르고 글자·색·링크만 바꾸면 안전한 SBPress 플러그인 코드가 바로 만들어집니다. 코드는 저장하기 전에 정적 보안 검사와 SHA-256 무결성 검사를 거치고, 초안으로 남기거나 내 사이트에 바로 설치하고 마켓에 제출할 수 있습니다.",
      presetTitle: "1. 프리셋 템플릿",
      presetHint: "만들 기능과 가장 가까운 것을 고르세요. 폼 값이 채워지고 코드가 바로 만들어집니다.",
      formTitle: "2. 비주얼 폼 빌더",
      formHint: "값을 고치면 오른쪽 코드·미리보기가 실시간으로 바뀝니다.",
      codeTitle: "3. 생성 코드 · 무결성",
      codeHint: "이 코드를 .js 파일로 내려받거나 마켓 항목으로 복사하세요.",
      previewTitle: "실시간 미리보기",
      previewHint: "사이트에 들어갔을 때의 모습(이 브라우저 안에서만)입니다.",
      fName: "이름",
      fSlug: "슬러그",
      fVersion: "버전",
      fSummary: "요약",
      fCategory: "카테고리",
      fHook: "훅",
      fTitle: "제목",
      fBody: "본문",
      fButton: "버튼 라벨",
      fLink: "링크",
      fBg: "배경색",
      fAccent: "강조색",
      phName: "공지 배너 위젯",
      phSlug: "notice-banner",
      phVersion: "1.0.0",
      phSummary: "무엇을 하는 플러그인인지 한 줄로",
      phTitle: "이번 주 새 소식",
      phBody: "공방 소식과 새 강좌를 홈에서 바로 확인하세요.",
      phButton: "자세히 보기",
      phLink: "/#/news",
      hintSlug: "영문 소문자·숫자·- 로 2~60자",
      hintLink: "https:// 또는 / 로 시작",
      hintColor: "#RRGGBB",
      catContent: "콘텐츠 꾸미기",
      catNavigation: "내비게이션",
      catWidget: "위젯·홈",
      catAdmin: "관리자 도구",
      catAccessibility: "읽기·접근성",
      hookWidget: "위젯 (홈 영역에 그리기)",
      hookCard: "카드 (글 카드 꾸미기)",
      hookMenu: "메뉴 (상단 메뉴 항목)",
      hookBlock: "블록 (페이지에 넣는 안내 블록)",
      presetWidget: "공지 배너 위젯",
      presetCard: "카드 배지 데코레이터",
      presetMenu: "상단 메뉴 바로가기",
      presetBlock: "커스텀 안내 블록",
      presetWidgetNote: "홈 맨 위에 공지 배너와 버튼을 그립니다.",
      presetCardNote: "글 카드마다 작은 배지를 붙입니다.",
      presetMenuNote: "헤더 메뉴에 바로가기를 더합니다.",
      presetBlockNote: "hunmin 페이지에 넣을 수 있는 안내 블록을 만듭니다.",
      hashLabel: "SHA-256",
      hashNone: "값을 올바르게 채우면 해시를 계산합니다.",
      scanOk: "정적 보안 검사 통과 — eval · new Function · <script> · http:// 없음",
      scanBad: "정적 보안 검사에서 막혔습니다",
      scanNone: "코드가 아직 만들어지지 않았습니다.",
      problems: "고칠 곳",
      permTitle: "요청 권한",
      actionsTitle: "4. 저장 · 내보내기 · 연동",
      save: "초안 저장",
      saveBusy: "저장하는 중…",
      saved: "초안을 저장했습니다.",
      savedLocal: "초안을 이 브라우저에 저장했습니다(30_v109 SQL 을 실행하면 서버에도 남습니다).",
      load: "불러오기",
      remove: "삭제",
      removed: "초안을 삭제했습니다.",
      download: "JS 파일 다운로드",
      copyJson: "마켓 JSON 복사",
      copied: "plugins-market.json 항목을 복사했습니다.",
      copyFail: "복사하지 못했습니다. 코드 상자를 직접 선택해 주세요.",
      install: "내 사이트에 바로 설치",
      submit: "마켓 제출 (v10.6)",
      submitOpened: "제출 모달을 열고 값을 채웠습니다. 스크립트 파일을 먼저 올려 두면 사전 점검이 통과합니다.",
      draftsTitle: "내 초안",
      draftsEmpty: "저장한 초안이 없습니다.",
      draftsLocal: "30_v109 SQL 을 실행하지 않아 초안이 이 브라우저에만 있습니다.",
      draftsServer: "서버(plugin_drafts)에 저장된 초안입니다.",
      draftMeta: "수정",
      needFix: "먼저 고칠 곳을 해결해 주세요.",
      needCode: "코드가 만들어지지 않아 진행할 수 없습니다.",
      consentTitle: "권한을 확인해 주세요",
      consentLead: "‘{name}’ 플러그인을 내 사이트에 설치합니다. 아래 권한과 무결성을 확인하고 동의해 주세요.",
      consentPerms: "요청 권한 {n}개",
      consentNoPerms: "요청하는 권한이 없습니다.",
      consentIntegrity: "무결성(SHA-256)",
      consentSandbox: "샌드박스",
      consentSandboxText: "엄격 — 선언·동의한 권한 밖의 훅은 실행하지 않습니다.",
      consentNote: "설치하면 plugins 표에 이 코드가 저장되고, 사이트 방문자 화면에서 실행됩니다. 코드를 고치면 다시 설치해 주세요.",
      consentAgree: "동의하고 설치",
      consentCancel: "취소",
      installBusy: "설치하는 중…",
      installed: "‘{name}’을(를) 설치했습니다. 사이트를 새로고침하면 방문자 화면에도 적용됩니다.",
      installFail: "설치하지 못했습니다: {msg}",
      required: "필수",
      optional: "선택",
      badgeHook: "훅 {h}",
      sheetTitle: "코드",
      jsonTitle: "plugins-market.json 항목",
      noTable: "plugin_drafts 표가 없습니다(30_v109 SQL 미실행).",
      loadFail: "초안을 불러오지 못했습니다: {msg}",
      saveFail: "초안을 저장하지 못했습니다: {msg}",
      deleteFail: "초안을 삭제하지 못했습니다: {msg}",
      pickDraft: "초안 고르기",
      presetApplied: "‘{name}’ 프리셋을 채웠습니다.",
      needName: "이름을 1~80자로 적어 주세요.",
      needSlug: "슬러그는 영문 소문자·숫자·- 로 2~60자여야 합니다.",
      needVersion: "버전은 1.0.0 처럼 세 칸으로 적어 주세요.",
      needLink: "링크는 https:// 또는 / 로 시작해야 합니다.",
      needColor: "색은 #RRGGBB 형식으로 적어 주세요.",
      badSummary: "요약은 300자까지입니다.",
      needTitle: "제목을 적어 주세요.",
      badChars: "‘<script>’ · ‘javascript:’ · ‘eval’ 같은 위험한 글자는 쓸 수 없습니다.",
      summaryLen: "{n}자",
      fileSaved: "파일을 내려받았습니다: {name}",
      installNote: "설치본은 plugins 표에 inline:base64 로 저장되고, 실행 전에 해시를 다시 겁니다.",
      emptyDraftList: "—",
      draftSavedAt: "저장",
      serverOk: "서버 연결",
      serverLocal: "이 브라우저"
    },
    en: {
      eyebrow: "No-code plugin studio · STUDIO",
      title: "Assemble a plugin",
      lead: "Pick a preset and change the words, colours and link — a safe SBPress plugin is generated instantly. Before saving it passes a static security check and a SHA-256 integrity check. Keep it as a draft, install it on your site, or submit it to the market.",
      presetTitle: "1. Preset template",
      presetHint: "Choose the closest match. The form is filled in and the code is generated.",
      formTitle: "2. Visual form builder",
      formHint: "Change a value and the code and preview update live.",
      codeTitle: "3. Generated code · integrity",
      codeHint: "Download this code as a .js file or copy it as a market entry.",
      previewTitle: "Live preview",
      previewHint: "How it looks on the site (inside this browser only).",
      fName: "Name",
      fSlug: "Slug",
      fVersion: "Version",
      fSummary: "Summary",
      fCategory: "Category",
      fHook: "Hook",
      fTitle: "Title",
      fBody: "Body",
      fButton: "Button label",
      fLink: "Link",
      fBg: "Background",
      fAccent: "Accent",
      phName: "Notice banner widget",
      phSlug: "notice-banner",
      phVersion: "1.0.0",
      phSummary: "One line about what it does",
      phTitle: "New this week",
      phBody: "See this week's workshop news and new classes on the home page.",
      phButton: "Read more",
      phLink: "/#/news",
      hintSlug: "Lowercase letters, digits and - (2–60)",
      hintLink: "Starts with https:// or /",
      hintColor: "#RRGGBB",
      catContent: "Content",
      catNavigation: "Navigation",
      catWidget: "Widgets & home",
      catAdmin: "Admin tools",
      catAccessibility: "Reading & accessibility",
      hookWidget: "Widget (draw on the home area)",
      hookCard: "Card (decorate post cards)",
      hookMenu: "Menu (header menu item)",
      hookBlock: "Block (info block for pages)",
      presetWidget: "Notice banner widget",
      presetCard: "Card badge decorator",
      presetMenu: "Header menu shortcut",
      presetBlock: "Custom info block",
      presetWidgetNote: "Draws a notice banner with a button at the top of home.",
      presetCardNote: "Adds a small badge to every post card.",
      presetMenuNote: "Adds a shortcut to the header menu.",
      presetBlockNote: "Creates an info block you can place on hunmin pages.",
      hashLabel: "SHA-256",
      hashNone: "Fill in valid values to compute the hash.",
      scanOk: "Static check passed — no eval · new Function · <script> · http://",
      scanBad: "Blocked by the static security check",
      scanNone: "No code generated yet.",
      problems: "To fix",
      permTitle: "Requested permissions",
      actionsTitle: "4. Save · export · connect",
      save: "Save draft",
      saveBusy: "Saving…",
      saved: "Draft saved.",
      savedLocal: "Draft saved in this browser (run the 30_v109 SQL to keep it on the server too).",
      load: "Load",
      remove: "Delete",
      removed: "Draft deleted.",
      download: "Download .js",
      copyJson: "Copy market JSON",
      copied: "Copied the plugins-market.json entry.",
      copyFail: "Could not copy. Select the code box and copy it manually.",
      install: "Install on my site",
      submit: "Submit to market (v10.6)",
      submitOpened: "Opened the submission modal with the values filled in. Upload the script file first so the auto check passes.",
      draftsTitle: "My drafts",
      draftsEmpty: "No saved drafts.",
      draftsLocal: "The 30_v109 SQL has not been run, so drafts live in this browser only.",
      draftsServer: "Drafts saved on the server (plugin_drafts).",
      draftMeta: "Edited",
      needFix: "Fix the items above first.",
      needCode: "No code was generated, so this cannot continue.",
      consentTitle: "Review the permissions",
      consentLead: "Installing ‘{name}’ on your site. Review the permissions and integrity below, then agree.",
      consentPerms: "{n} requested permissions",
      consentNoPerms: "No permissions requested.",
      consentIntegrity: "Integrity (SHA-256)",
      consentSandbox: "Sandbox",
      consentSandboxText: "Strict — hooks outside the declared and agreed permissions are not run.",
      consentNote: "Installing stores this code in the plugins table and runs it on visitor pages. Reinstall after editing the code.",
      consentAgree: "Agree and install",
      consentCancel: "Cancel",
      installBusy: "Installing…",
      installed: "Installed ‘{name}’. Reload the site to apply it to visitor pages.",
      installFail: "Could not install: {msg}",
      required: "required",
      optional: "optional",
      badgeHook: "hook {h}",
      sheetTitle: "Code",
      jsonTitle: "plugins-market.json entry",
      noTable: "The plugin_drafts table is missing (30_v109 SQL not run).",
      loadFail: "Could not load drafts: {msg}",
      saveFail: "Could not save the draft: {msg}",
      deleteFail: "Could not delete the draft: {msg}",
      pickDraft: "Pick a draft",
      presetApplied: "Filled the ‘{name}’ preset.",
      needName: "Enter a name of 1–80 characters.",
      needSlug: "The slug must be 2–60 lowercase letters, digits or -.",
      needVersion: "Use three parts, like 1.0.0.",
      needLink: "The link must start with https:// or /.",
      needColor: "Colours must be #RRGGBB.",
      badSummary: "The summary can be up to 300 characters.",
      needTitle: "Enter a title.",
      badChars: "‘<script>’, ‘javascript:’ and ‘eval’ cannot be used.",
      summaryLen: "{n} chars",
      fileSaved: "Downloaded: {name}",
      installNote: "The install is stored in the plugins table as inline:base64 and re-hashed before it runs.",
      emptyDraftList: "—",
      draftSavedAt: "saved",
      serverOk: "server",
      serverLocal: "this browser"
    }
  };

  var PERM_TEXT = {
    "ui:home-top": { ko: "홈 맨 위에 배너 영역을 그립니다.", en: "Draws a banner area at the top of home.", risk: "중간" },
    "ui:floating": { ko: "화면 위에 떠 있는 버튼을 그립니다.", en: "Draws a floating button over the page.", risk: "중간" },
    "read:card-text": { ko: "카드의 제목·글자 수를 읽습니다.", en: "Reads card titles and character counts.", risk: "낮음" },
    "nav:menu": { ko: "헤더 메뉴에 항목을 더합니다.", en: "Adds an item to the header menu.", risk: "낮음" },
    "ui:block": { ko: "hunmin 페이지에 블록을 그립니다.", en: "Draws a block on hunmin pages.", risk: "낮음" },
    "read:block-data": { ko: "관리자가 입력한 블록 값을 읽습니다.", en: "Reads the block values the admin entered.", risk: "낮음" },
    "css:inject": { ko: "사이트에 스타일(CSS)을 더합니다.", en: "Adds style rules (CSS) to the site.", risk: "중간" }
  };

  var PRESETS = [
    {
      id: "notice-banner", hook: "widget", category: "widget", icon: "📣",
      name: { ko: "공지 배너 위젯", en: "Notice banner widget" },
      summary: { ko: "홈 맨 위에 공지 배너와 링크 버튼을 그립니다.", en: "Draws a notice banner with a link button at the top of home." },
      slot: { ko: "presetWidget", en: "presetWidget" },
      note: { ko: "presetWidgetNote", en: "presetWidgetNote" },
      perms: ["ui:home-top"],
      fields: {
        title: { ko: "이번 주 새 소식", en: "New this week" },
        body: { ko: "공방 소식과 새 강좌를 홈에서 바로 확인하세요.", en: "See this week's workshop news and new classes on the home page." },
        button: { ko: "자세히 보기", en: "Read more" },
        link: { ko: "/#/news", en: "/#/news" },
        bg: { ko: "#FFF4E6", en: "#FFF4E6" },
        accent: { ko: "#B5762F", en: "#B5762F" }
      }
    },
    {
      id: "card-badge", hook: "card", category: "content", icon: "🏷️",
      name: { ko: "카드 배지 데코레이터", en: "Card badge decorator" },
      summary: { ko: "글 카드마다 작은 배지를 붙여 눈에 띄게 합니다.", en: "Adds a small badge to every post card so it stands out." },
      slot: { ko: "presetCard", en: "presetCard" },
      note: { ko: "presetCardNote", en: "presetCardNote" },
      perms: ["read:card-text"],
      fields: {
        title: { ko: "추천", en: "Featured" },
        body: { ko: "이번 주 추천 글", en: "Picked this week" },
        button: { ko: "", en: "" },
        link: { ko: "", en: "" },
        bg: { ko: "#F3EFE9", en: "#F3EFE9" },
        accent: { ko: "#7A5C3E", en: "#7A5C3E" }
      }
    },
    {
      id: "menu-shortcut", hook: "menu", category: "navigation", icon: "🔗",
      name: { ko: "상단 메뉴 바로가기", en: "Header menu shortcut" },
      summary: { ko: "헤더 메뉴에 자주 쓰는 바로가기를 더합니다.", en: "Adds a frequently used shortcut to the header menu." },
      slot: { ko: "presetMenu", en: "presetMenu" },
      note: { ko: "presetMenuNote", en: "presetMenuNote" },
      perms: ["nav:menu"],
      fields: {
        title: { ko: "이번 주 소식", en: "This week" },
        body: { ko: "메뉴에 보이는 이름입니다.", en: "The label shown in the menu." },
        button: { ko: "", en: "" },
        link: { ko: "/#/news", en: "/#/news" },
        bg: { ko: "#FFFFFF", en: "#FFFFFF" },
        accent: { ko: "#B5762F", en: "#B5762F" }
      }
    },
    {
      id: "info-block", hook: "block", category: "content", icon: "📄",
      name: { ko: "커스텀 안내 블록", en: "Custom info block" },
      summary: { ko: "hunmin 페이지에 넣을 수 있는 안내 블록을 만듭니다.", en: "Creates an info block you can place on hunmin pages." },
      slot: { ko: "presetBlock", en: "presetBlock" },
      note: { ko: "presetBlockNote", en: "presetBlockNote" },
      perms: ["ui:block", "read:block-data"],
      fields: {
        title: { ko: "이용 안내", en: "How to use" },
        body: { ko: "예약은 하루 전까지 받습니다. 궁금한 점은 문의해 주세요.", en: "Book at least a day ahead. Ask us if anything is unclear." },
        button: { ko: "문의하기", en: "Contact us" },
        link: { ko: "/#/contact", en: "/#/contact" },
        bg: { ko: "#F7F5F2", en: "#F7F5F2" },
        accent: { ko: "#3E2F26", en: "#3E2F26" }
      }
    }
  ];

  /* ---------------- 상태 ---------------- */
  var ST = {
    host: null, opts: null, lang: "ko",
    preset: "notice-banner", hook: "widget",
    fields: null,
    code: "", hash: "", sri: "", problems: [], scan: null,
    flash: null, busy: false, draftId: "", draftSource: "",
    drafts: null, draftsLoading: false, draftsMissing: false, draftsError: "",
    picked: "",
    consent: null, lastJson: "", hashSeq: 0
  };

  function blankFields() {
    return { name: "", slug: "", version: "1.0.0", summary: "", category: "widget",
             title: "", body: "", button: "", link: "", bg: "#FFF4E6", accent: "#B5762F" };
  }
  ST.fields = blankFields();

  /* ---------------- 작은 도우미 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function currentLang() {
    try {
      if (typeof window.CRAFT_LANG === "function") return window.CRAFT_LANG() === "en" ? "en" : "ko";
    } catch (e) { /* 아래로 */ }
    try { return String(localStorage.getItem("craft-lang") || "").toLowerCase() === "en" ? "en" : "ko"; } catch (e2) { return "ko"; }
  }
  function T(key, vars) {
    var dict = L[ST.lang] || L.ko;
    var s = dict[key];
    if (s == null) s = (L.ko[key] != null ? L.ko[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(String(vars[k])); });
    }
    return s;
  }
  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return PRESETS[0];
  }
  function cfg() { return window.CRAFT_SUPABASE || {}; }
  function token() {
    try {
      if (window.CRAFT_ADMIN && window.CRAFT_ADMIN.token && window.CRAFT_ADMIN.token()) return window.CRAFT_ADMIN.token();
    } catch (e) { /* 아래로 */ }
    try {
      var url = String(cfg().url || "").replace(/^https?:\/\//, "").split(".")[0];
      var raw = localStorage.getItem("sb-" + url + "-auth-token");
      var o = raw ? JSON.parse(raw) : null;
      if (o && o.access_token) return String(o.access_token);
      if (o && o.currentSession && o.currentSession.access_token) return String(o.currentSession.access_token);
    } catch (e2) { /* noop */ }
    return "";
  }
  function userId() {
    try {
      var u = window.CRAFT_ADMIN && window.CRAFT_ADMIN.user && window.CRAFT_ADMIN.user();
      return u && u.id ? String(u.id) : "";
    } catch (e) { return ""; }
  }
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || "")); }

  function sbRequest(path, opts) {
    var c = cfg();
    if (!c.url || !c.anonKey) return Promise.reject(new Error("supabase-missing"));
    opts = opts || {};
    var headers = { apikey: c.anonKey, Accept: "application/json" };
    if (opts.body != null) headers["Content-Type"] = "application/json";
    var tok = opts.token != null ? opts.token : token();
    headers.Authorization = "Bearer " + (tok || c.anonKey);
    if (opts.prefer) headers.Prefer = opts.prefer;
    return fetch(String(c.url).replace(/\/+$/, "") + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
        if (r.ok) return data;
        var msg = (data && (data.message || data.hint || data.error_description)) || ("HTTP " + r.status);
        var err = new Error(String(msg));
        err.status = r.status;
        err.code = (data && data.code) || "";
        return Promise.reject(err);
      });
    });
  }
  function missingTable(e) {
    if (!e) return false;
    var code = String(e.code || ""), m = String(e.message || "");
    return e.status === 404 || code === "42P01" || code === "PGRST205"
      || /does not exist|Could not find the table|schema cache|not find the table/i.test(m);
  }

  function readLS(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      var v = raw ? JSON.parse(raw) : fallback;
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  /* ---------------- 입력 검증 · 코드 생성 ---------------- */
  var BAD_TEXT = /<\s*\/?\s*script|javascript\s*:|(^|[^\w$.])(eval|new\s+Function)\s*\(/i;

  function hexColor(v, dflt) {
    var s = String(v || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : dflt;
  }
  function safeLink(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^https:\/\/[^\s<>"']+$/i.test(s)) return s;
    if (s.charAt(0) === "/" && s.charAt(1) !== "/" && !/\s/.test(s)) return s;
    return "";
  }

  /* 폼 값 → 문제 목록. problems 가 비어 있어야 코드를 만듭니다. */
  function validate(f) {
    var out = [];
    var name = String(f.name || "").trim();
    var slug = String(f.slug || "").trim().toLowerCase();
    f.slug = slug;
    if (!name || name.length > 80) out.push(T("needName"));
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) out.push(T("needSlug"));
    if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(String(f.version || "").trim())) out.push(T("needVersion"));
    if (String(f.summary || "").length > 300) out.push(T("badSummary"));
    if (!String(f.title || "").trim()) out.push(T("needTitle"));
    var link = String(f.link || "").trim();
    if (link && !safeLink(link)) out.push(T("needLink"));
    if (!/^#[0-9a-fA-F]{6}$/.test(String(f.bg || "").trim()) || !/^#[0-9a-fA-F]{6}$/.test(String(f.accent || "").trim())) {
      out.push(T("needColor"));
    }
    ["name", "summary", "title", "body", "button", "link"].forEach(function (k) {
      if (BAD_TEXT.test(String(f[k] == null ? "" : f[k]))) {
        var msg = T("badChars");
        if (out.indexOf(msg) < 0) out.push(msg);
      }
    });
    return out;
  }

  /* 모든 문자열은 JSON.stringify 로 넣습니다(따옴표·역슬래시·줄바꿈 안전). */
  function q(s) { return JSON.stringify(String(s == null ? "" : s)); }

  function permsFor(hook) {
    if (hook === "card") return ["read:card-text"];
    if (hook === "menu") return ["nav:menu"];
    if (hook === "block") return ["ui:block", "read:block-data"];
    return ["ui:home-top"];
  }

  function head(f) {
    return "/* SBPress Studio — " + String(f.name || "").replace(/\*\//g, "* /") + " v" + f.version + "\n" +
      "   " + String(f.summary || "").replace(/\*\//g, "* /") + "\n" +
      "   이 파일은 SBPress 노코드 스튜디오(v10.9)가 만들었습니다. SBPress.register 로 등록되고,\n" +
      "   선언한 권한 밖의 훅은 엔진 샌드박스가 실행하지 않습니다. */\n";
  }

  function dataLine(f) {
    return "      var D = { title: " + q(f.title) + ", body: " + q(f.body) + ", button: " + q(f.button) +
      ", link: " + q(safeLink(f.link)) + ", bg: " + q(hexColor(f.bg, "#FFF4E6")) +
      ", accent: " + q(hexColor(f.accent, "#B5762F")) + " };\n";
  }

  var HEX_FN = "      function hex(v, d) { return /^#[0-9a-fA-F]{6}$/.test(String(v || \"\")) ? v : d; }\n";

  function buildCode(f) {
    var hook = f.hook === "card" || f.hook === "menu" || f.hook === "block" ? f.hook : "widget";
    var perms = permsFor(hook);
    var man = "{ v: 1, name: " + q(f.name) + ", version: " + q(f.version) + ", hooks: [" + q(hook) + "], permissions: [" +
      perms.map(q).join(", ") + "] }";
    var top = head(f) +
      "(function () {\n" +
      "  \"use strict\";\n" +
      "  if (!window.SBPress || typeof window.SBPress.register !== \"function\") return;\n" +
      "  window.SBPress.register({\n" +
      "    id: " + q(f.slug) + ",\n" +
      "    name: " + q(f.name) + ",\n" +
      "    version: " + q(f.version) + ",\n" +
      "    description: " + q(f.summary) + ",\n" +
      "    manifest: " + man + ",\n" +
      "    setup: function (ctx) {\n" +
      dataLine(f) +
      HEX_FN;

    if (hook === "widget") {
      top +=
        "      function build() {\n" +
        "        var box = document.createElement(\"div\");\n" +
        "        box.className = \"sbps-banner\";\n" +
        "        box.setAttribute(\"style\", \"background:\" + hex(D.bg, \"#FFF4E6\") + \";border:1px solid rgba(62,47,38,.12);border-left:4px solid \" + hex(D.accent, \"#B5762F\") + \";border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap\");\n" +
        "        var h = document.createElement(\"strong\");\n" +
        "        h.textContent = D.title;\n" +
        "        h.setAttribute(\"style\", \"flex:1 1 220px;font-size:1rem\");\n" +
        "        box.appendChild(h);\n" +
        "        if (D.body) {\n" +
        "          var p = document.createElement(\"p\");\n" +
        "          p.textContent = D.body;\n" +
        "          p.setAttribute(\"style\", \"margin:0;flex:1 1 260px;color:#7a6f66;font-size:.86rem;line-height:1.6\");\n" +
        "          box.appendChild(p);\n" +
        "        }\n" +
        "        if (D.button && D.link) {\n" +
        "          var a = document.createElement(\"a\");\n" +
        "          a.href = D.link;\n" +
        "          a.textContent = D.button;\n" +
        "          a.setAttribute(\"style\", \"background:\" + hex(D.accent, \"#B5762F\") + \";color:#fff;border-radius:999px;padding:7px 14px;font-size:.82rem;font-weight:700;text-decoration:none\");\n" +
        "          box.appendChild(a);\n" +
        "        }\n" +
        "        return box;\n" +
        "      }\n" +
        "      ctx.addWidget(\"home-top\", function (holder) {\n" +
        "        if (!holder || !holder.appendChild) return;\n" +
        "        holder.appendChild(build());\n" +
        "      });\n";
    } else if (hook === "card") {
      top +=
        "      ctx.decorateCard(function (card) {\n" +
        "        if (!card || !D.title) return;\n" +
        "        var host = card.querySelector(\".bcard-top, .news-side, .ws-top\") || card;\n" +
        "        var badge = card.querySelector(\".sbps-badge\");\n" +
        "        if (!badge) {\n" +
        "          badge = document.createElement(\"span\");\n" +
        "          badge.className = \"sbps-badge\";\n" +
        "          host.appendChild(badge);\n" +
        "        }\n" +
        "        badge.textContent = D.title;\n" +
        "        if (D.body) badge.setAttribute(\"title\", D.body);\n" +
        "        badge.setAttribute(\"style\", \"display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:800;white-space:nowrap;background:\" + hex(D.bg, \"#F3EFE9\") + \";color:\" + hex(D.accent, \"#7A5C3E\") + \";border:1px solid \" + hex(D.accent, \"#7A5C3E\") + \"33\");\n" +
        "      });\n";
    } else if (hook === "menu") {
      top +=
        "      ctx.addMenuItem({\n" +
        "        id: " + q(f.slug) + ",\n" +
        "        label_ko: D.title,\n" +
        "        label_en: D.title,\n" +
        "        href: D.link || \"/#/home\"\n" +
        "      });\n";
    } else {
      top +=
        "      ctx.addBlock({\n" +
        "        id: \"info\",\n" +
        "        name_ko: D.title,\n" +
        "        name_en: D.title,\n" +
        "        category: \"content\",\n" +
        "        fields: [\n" +
        "          { key: \"title\", type: \"text\", label: \"제목\", default: D.title },\n" +
        "          { key: \"body\", type: \"textarea\", label: \"본문\", default: D.body }\n" +
        "        ],\n" +
        "        defaultData: { title: D.title, body: D.body },\n" +
        "        render: function (data) {\n" +
        "          var sec = document.createElement(\"section\");\n" +
        "          sec.className = \"sbps-block\";\n" +
        "          sec.setAttribute(\"style\", \"background:\" + hex(D.bg, \"#F7F5F2\") + \";border-left:4px solid \" + hex(D.accent, \"#3E2F26\") + \";border-radius:12px;padding:16px 18px\");\n" +
        "          var h = document.createElement(\"h2\");\n" +
        "          h.textContent = (data && data.title) || D.title;\n" +
        "          h.setAttribute(\"style\", \"margin:0 0 6px;font-size:1.05rem\");\n" +
        "          sec.appendChild(h);\n" +
        "          var p = document.createElement(\"p\");\n" +
        "          p.textContent = (data && data.body) || D.body;\n" +
        "          p.setAttribute(\"style\", \"margin:0;color:#7a6f66;line-height:1.7;font-size:.9rem\");\n" +
        "          sec.appendChild(p);\n" +
        "          if (D.button && D.link) {\n" +
        "            var a = document.createElement(\"a\");\n" +
        "            a.href = D.link;\n" +
        "            a.textContent = D.button;\n" +
        "            a.setAttribute(\"style\", \"display:inline-block;margin-top:10px;color:\" + hex(D.accent, \"#3E2F26\") + \";font-weight:700;font-size:.86rem\");\n" +
        "            sec.appendChild(a);\n" +
        "          }\n" +
        "          return sec;\n" +
        "        }\n" +
        "      });\n";
    }

    var tail = "    }\n  });\n})();\n";
    return top + tail;
  }

  /* 스튜디오 자체 정적 검사 — 엔진(plugins.js)의 UNSAFE 규칙과 같은 것 + 스튜디오 추가 규칙 */
  var SCAN = [
    { re: /(^|[^\w$.])eval\s*\(/, why: "eval" },
    { re: /new\s+Function\s*\(/, why: "new Function" },
    { re: /document\.write\s*\(/, why: "document.write" },
    { re: /(^|[^\w:])http:\/\//i, why: "http:// 주소" },
    { re: /<\s*script[\s>]/i, why: "<script> 삽입" },
    { re: /javascript\s*:/i, why: "javascript: 주소" },
    { re: /on(click|load|error|mouseover)\s*=/i, why: "인라인 이벤트" }
  ];

  function scanCode(code) {
    var reasons = [];
    for (var i = 0; i < SCAN.length; i++) if (SCAN[i].re.test(code)) reasons.push(SCAN[i].why);
    return { ok: reasons.length === 0, reasons: reasons };
  }

  function sha256Text(text) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle || typeof subtle.digest !== "function" || typeof TextEncoder !== "function") {
      return Promise.resolve(null);
    }
    var bytes = new TextEncoder().encode(String(text || ""));
    return subtle.digest("SHA-256", bytes).then(function (d) {
      var b = new Uint8Array(d), hex = "", bin = "";
      for (var i = 0; i < b.length; i++) {
        hex += ("0" + b[i].toString(16)).slice(-2);
        bin += String.fromCharCode(b[i]);
      }
      return { hex: hex, sri: "sha256-" + btoa(bin) };
    }).catch(function () { return null; });
  }

  /* ---------------- 마크업 ---------------- */
  function base64Utf8(text) {
    var bytes = new TextEncoder().encode(String(text || ""));
    var bin = "";
    for (var i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  }

  function fieldRow(label, inner, wide, hint) {
    return '<label class="studio-field' + (wide ? " is-wide" : "") + '"><span>' + esc(label) + "</span>" + inner +
      (hint ? '<em class="studio-hint">' + esc(hint) + "</em>" : "") + "</label>";
  }

  function presetCardsHtml() {
    return PRESETS.map(function (p) {
      var on = ST.preset === p.id;
      return '<button type="button" class="studio-preset' + (on ? " is-on" : "") + '" data-studio-preset="' + esc(p.id) + '"' +
        ' aria-pressed="' + (on ? "true" : "false") + '">' +
        '<span class="studio-preset-icon" aria-hidden="true">' + esc(p.icon) + "</span>" +
        '<span class="studio-preset-name">' + esc(p.name[ST.lang] || p.name.ko) + "</span>" +
        '<span class="studio-preset-hook">' + esc(T("badgeHook", { h: p.hook })) + "</span>" +
        '<span class="studio-preset-note">' + esc(T(p.note[ST.lang] || p.note.ko)) + "</span>" +
        "</button>";
    }).join("");
  }

  function catOptions(cur) {
    var cats = [["content", "catContent"], ["navigation", "catNavigation"], ["widget", "catWidget"],
                ["admin", "catAdmin"], ["accessibility", "catAccessibility"]];
    return cats.map(function (c) {
      return '<option value="' + c[0] + '"' + (cur === c[0] ? " selected" : "") + ">" + esc(T(c[1])) + "</option>";
    }).join("");
  }
  function hookOptions(cur) {
    var hooks = [["widget", "hookWidget"], ["card", "hookCard"], ["menu", "hookMenu"], ["block", "hookBlock"]];
    return hooks.map(function (c) {
      return '<option value="' + c[0] + '"' + (cur === c[0] ? " selected" : "") + ">" + esc(T(c[1])) + "</option>";
    }).join("");
  }

  function formHtml() {
    var f = ST.fields;
    return '<div class="studio-grid2">' +
      fieldRow(T("fName") + " *", '<input class="admin-input" data-f="name" maxlength="80" value="' + esc(f.name) + '" placeholder="' + esc(T("phName")) + '">') +
      fieldRow(T("fSlug") + " *", '<input class="admin-input" data-f="slug" maxlength="60" spellcheck="false" value="' + esc(f.slug) + '" placeholder="' + esc(T("phSlug")) + '">', false, T("hintSlug")) +
      fieldRow(T("fVersion") + " *", '<input class="admin-input" data-f="version" maxlength="24" spellcheck="false" value="' + esc(f.version) + '" placeholder="' + esc(T("phVersion")) + '">') +
      fieldRow(T("fCategory"), '<select class="admin-input" data-f="category">' + catOptions(f.category) + "</select>") +
      fieldRow(T("fSummary"), '<input class="admin-input" data-f="summary" maxlength="300" value="' + esc(f.summary) + '" placeholder="' + esc(T("phSummary")) + '">', true) +
      fieldRow(T("fHook"), '<select class="admin-input" data-f="hook">' + hookOptions(f.hook) + "</select>") +
      fieldRow(T("fTitle") + " *", '<input class="admin-input" data-f="title" maxlength="80" value="' + esc(f.title) + '" placeholder="' + esc(T("phTitle")) + '">', true) +
      fieldRow(T("fBody"), '<textarea class="admin-input" data-f="body" rows="3" maxlength="400" placeholder="' + esc(T("phBody")) + '">' + esc(f.body) + "</textarea>", true) +
      fieldRow(T("fButton"), '<input class="admin-input" data-f="button" maxlength="30" value="' + esc(f.button) + '" placeholder="' + esc(T("phButton")) + '">') +
      fieldRow(T("fLink"), '<input class="admin-input" data-f="link" maxlength="300" spellcheck="false" value="' + esc(f.link) + '" placeholder="' + esc(T("phLink")) + '">', false, T("hintLink")) +
      '<div class="studio-colors">' +
        fieldRow(T("fBg"), '<input type="color" class="studio-color" data-f="bg" value="' + esc(hexColor(f.bg, "#FFF4E6")) + '"><input class="admin-input studio-hex" data-f="bg" data-hex="1" maxlength="7" value="' + esc(f.bg) + '">') +
        fieldRow(T("fAccent"), '<input type="color" class="studio-color" data-f="accent" value="' + esc(hexColor(f.accent, "#B5762F")) + '"><input class="admin-input studio-hex" data-f="accent" data-hex="1" maxlength="7" value="' + esc(f.accent) + '">') +
      "</div>" +
      "</div>";
  }

  function previewHtml() {
    var f = ST.fields;
    var bg = hexColor(f.bg, "#FFF4E6"), ac = hexColor(f.accent, "#B5762F");
    var btn = (f.button && safeLink(f.link))
      ? '<span class="studio-pv-btn" style="background:' + esc(ac) + '">' + esc(f.button) + "</span>" : "";
    var body = f.hook === "card" || f.hook === "menu" ? "" : '<p class="studio-pv-body">' + esc(f.body) + "</p>";
    if (f.hook === "card") {
      return '<div class="studio-pv studio-pv-card" data-no-i18n><div class="studio-pv-line"></div>' +
        '<div class="studio-pv-line short"></div>' +
        '<span class="studio-pv-badge" style="background:' + esc(bg) + ";color:" + esc(ac) + ";border-color:" + esc(ac) + '33">' +
        esc(f.title) + "</span></div>";
    }
    if (f.hook === "menu") {
      return '<div class="studio-pv studio-pv-menu" data-no-i18n><span class="studio-pv-nav">' +
        esc(f.title) + '</span><span class="studio-pv-nav muted">' + esc(T("previewTitle")) + "</span></div>";
    }
    return '<div class="studio-pv" data-no-i18n style="background:' + esc(bg) + ";border-left:4px solid " + esc(ac) + '">' +
      "<strong>" + esc(f.title) + "</strong>" + body + btn + "</div>";
  }

  function permsHtml() {
    var perms = permsFor(ST.hook);
    return '<div class="studio-perms"><span class="studio-perms-label">' + esc(T("permTitle")) + "</span>" +
      perms.map(function (p) {
        var info = PERM_TEXT[p] || { ko: p, en: p };
        return '<code class="studio-perm">' + esc(p) + "</code>";
      }).join("") + "</div>";
  }

  function codeHtml() {
    return '<pre class="studio-code" id="studio-code" data-no-i18n tabindex="0">' + esc(ST.code || T("scanNone")) + "</pre>";
  }

  function hashHtml() {
    if (!ST.hash) return '<p class="studio-hash is-none" id="studio-hash">' + esc(T("hashNone")) + "</p>";
    return '<p class="studio-hash" id="studio-hash"><span class="studio-hash-label">' + esc(T("hashLabel")) + "</span>" +
      '<code id="studio-hash-hex" data-no-i18n>' + esc(ST.hash) + "</code>" +
      '<span class="studio-hash-sri" id="studio-hash-sri" data-no-i18n>' + esc(ST.sri) + "</span></p>";
  }

  function scanHtml() {
    if (!ST.code) return '<p class="studio-scan is-none" id="studio-scan">' + esc(T("scanNone")) + "</p>";
    if (ST.scan && ST.scan.ok) return '<p class="studio-scan is-ok" id="studio-scan">' + esc(T("scanOk")) + "</p>";
    var why = (ST.scan && ST.scan.reasons) || [];
    return '<p class="studio-scan is-bad" id="studio-scan">' + esc(T("scanBad")) + " — " + esc(why.join(", ")) + "</p>";
  }

  function problemsHtml() {
    if (!ST.problems.length) return '<ul class="studio-problems" id="studio-problems" hidden></ul>';
    return '<ul class="studio-problems" id="studio-problems"><li><b>' + esc(T("problems")) + "</b></li>" +
      ST.problems.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  }

  function draftsHtml() {
    if (ST.draftsMissing) {
      return '<p class="studio-note">' + esc(T("draftsLocal")) + "</p>";
    }
    if (ST.draftsLoading && !ST.drafts) return '<p class="studio-note">…</p>';
    var list = ST.drafts || [];
    if (!list.length) return '<p class="studio-note">' + esc(T("draftsEmpty")) + "</p>";
    return '<ul class="studio-drafts" data-no-i18n>' + list.map(function (d) {
      var when = String(d.updated_at || d.created_at || "").replace("T", " ").slice(0, 16);
      return '<li class="studio-draft' + (ST.draftId && d.id === ST.draftId ? " is-on" : "") + '">' +
        '<span class="studio-draft-name">' + esc(d.name || d.slug) + ' <em>v' + esc(d.version || "1.0.0") + "</em></span>" +
        '<span class="studio-draft-meta">' + esc(d.slug || "") + " · " + esc(when) + "</span>" +
        '<span class="studio-draft-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-studio-load="' + esc(d.id) + '">' + esc(T("load")) + "</button>" +
          '<button type="button" class="btn btn-ghost btn-sm danger" data-studio-del="' + esc(d.id) + '">' + esc(T("remove")) + "</button>" +
        "</span></li>";
    }).join("") + "</ul>";
  }

  function flashHtml() {
    var f = ST.flash;
    if (!f || !f.text) return '<p class="studio-flash" id="studio-flash" role="status" aria-live="polite"></p>';
    return '<p class="studio-flash ' + esc(f.kind || "ok") + '" id="studio-flash" role="status" aria-live="polite">' + esc(f.text) + "</p>";
  }

  function render() {
    var host = ST.host;
    if (!host) return;
    host.innerHTML =
      '<section class="studio" id="studio">' +
        '<header class="studio-head">' +
          '<p class="studio-eyebrow">' + esc(T("eyebrow")) + "</p>" +
          "<h2>" + esc(T("title")) + "</h2>" +
          '<p class="studio-lead">' + esc(T("lead")) + "</p>" +
        "</header>" +
        '<section class="studio-sec">' +
          "<h3>" + esc(T("presetTitle")) + "</h3>" +
          '<p class="studio-hint">' + esc(T("presetHint")) + "</p>" +
          '<div class="studio-presets">' + presetCardsHtml() + "</div>" +
        "</section>" +
        '<section class="studio-sec">' +
          "<h3>" + esc(T("formTitle")) + "</h3>" +
          '<p class="studio-hint">' + esc(T("formHint")) + "</p>" +
          '<div class="studio-form" id="studio-form">' + formHtml() + permsHtml() + problemsHtml() + "</div>" +
        "</section>" +
        '<section class="studio-sec studio-workspace">' +
          '<div class="studio-pane">' +
            "<h3>" + esc(T("previewTitle")) + "</h3>" +
            '<p class="studio-hint">' + esc(T("previewHint")) + "</p>" +
            '<div class="studio-pv-wrap" id="studio-preview">' + previewHtml() + "</div>" +
          "</div>" +
          '<div class="studio-pane">' +
            "<h3>" + esc(T("codeTitle")) + "</h3>" +
            '<p class="studio-hint">' + esc(T("codeHint")) + "</p>" +
            '<div id="studio-hash-wrap">' + hashHtml() + "</div>" +
            '<div id="studio-scan-wrap">' + scanHtml() + "</div>" +
            '<div id="studio-code-wrap">' + codeHtml() + "</div>" +
          "</div>" +
        "</section>" +
        '<section class="studio-sec">' +
          "<h3>" + esc(T("actionsTitle")) + "</h3>" +
          '<div class="studio-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-studio-save="1">' + esc(T("save")) + "</button>" +
            '<button type="button" class="btn btn-ghost btn-sm" data-studio-download="1">' + esc(T("download")) + "</button>" +
            '<button type="button" class="btn btn-ghost btn-sm" data-studio-copy="1">' + esc(T("copyJson")) + "</button>" +
            '<button type="button" class="btn btn-ghost btn-sm" data-studio-install="1">' + esc(T("install")) + "</button>" +
            '<button type="button" class="btn btn-ghost btn-sm" data-studio-submit="1">' + esc(T("submit")) + "</button>" +
          "</div>" +
          '<p class="studio-note">' + esc(T("installNote")) + "</p>" +
          flashHtml() +
        "</section>" +
        '<section class="studio-sec">' +
          '<div class="studio-drafts-head"><h3>' + esc(T("draftsTitle")) + "</h3>" +
            '<span class="studio-source">' + esc(ST.draftSource === "server" ? T("draftsServer") : (ST.draftsMissing ? T("serverLocal") : T("draftsServer"))) + "</span></div>" +
          '<div id="studio-drafts">' + draftsHtml() + "</div>" +
        "</section>" +
      "</section>";
    host.setAttribute("data-studio-ready", "1");
    /* 첫 진입에도 코드·해시·미리보기를 채웁니다. */
    update(true);
  }

  /* 폼 DOM → ST.fields 로 읽기 */
  function readForm() {
    var host = ST.host;
    if (!host) return ST.fields;
    var inputs = host.querySelectorAll("[data-f]");
    for (var i = 0; i < inputs.length; i++) {
      var k = inputs[i].getAttribute("data-f");
      if (!k) continue;
      var raw = String(inputs[i].value || "");
      if (inputs[i].type === "color") continue;   /* 고르개는 change 처리에서 옆 칸에 옮깁니다 */
      if (inputs[i].getAttribute("data-hex") === "1") {
        if (k === "bg" || k === "accent") ST.fields[k] = raw.trim();
        continue;
      }
      ST.fields[k] = raw;
    }
    ST.fields.hook = ST.fields.hook || ST.hook;
    ST.hook = ST.fields.hook;
    return ST.fields;
  }

  function syncColorInputs() {
    var host = ST.host;
    if (!host) return;
    ["bg", "accent"].forEach(function (k) {
      var picker = host.querySelector('input[type="color"][data-f="' + k + '"]');
      var good = hexColor(ST.fields[k], "");
      /* 고르개만 맞춥니다 — #RRGGBB 입력칸은 사용자가 치는 중일 수 있어 건드리지 않습니다. */
      if (picker && good) picker.value = good.toLowerCase();
    });
  }

  /* 코드·해시·검사·미리보기만 다시 그립니다(폼 포커스 유지). */
  function update(force) {
    var f = readForm();
    ST.problems = validate(f);
    ST.scan = null;
    if (!ST.problems.length) {
      var code = buildCode(f);
      ST.scan = scanCode(code);
      ST.code = ST.scan.ok ? code : "";
      if (!ST.scan.ok) ST.problems = ST.problems.concat(ST.scan.reasons.map(function (w) { return w; }));
    } else {
      ST.code = "";
    }
    if (ST.code.length > MAX_CODE) {
      ST.code = "";
      ST.problems.push(T("badSummary"));
    }
    paintProblems();
    paintPreview();
    paintCode();
    syncColorInputs();
    if (ST.code) {
      var seq = ++ST.hashSeq;
      sha256Text(ST.code).then(function (h) {
        if (seq !== ST.hashSeq) return;
        ST.hash = h ? h.hex : "";
        ST.sri = h ? h.sri : "";
        paintHash();
      });
    } else {
      ST.hash = ""; ST.sri = "";
      paintHash();
    }
    if (force) syncActions();
    syncActions();
  }

  function paintProblems() {
    var host = ST.host;
    var box = host && host.querySelector("#studio-problems");
    if (!box) return;
    if (!ST.problems.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = "<li><b>" + esc(T("problems")) + "</b></li>" +
      ST.problems.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("");
  }
  function paintPreview() {
    var host = ST.host;
    var box = host && host.querySelector("#studio-preview");
    if (box) box.innerHTML = previewHtml();
  }
  function paintCode() {
    var host = ST.host;
    var box = host && host.querySelector("#studio-code");
    if (box) box.textContent = ST.code || T("scanNone");
    var scan = host && host.querySelector("#studio-scan-wrap");
    if (scan) scan.innerHTML = scanHtml();
  }
  function paintHash() {
    var host = ST.host;
    var box = host && host.querySelector("#studio-hash-wrap");
    if (box) box.innerHTML = hashHtml();
  }
  function syncActions() {
    var host = ST.host;
    if (!host) return;
    var busy = !ST.code || !!ST.problems.length || ST.busy;
    ["save", "download", "copy", "install", "submit"].forEach(function (k) {
      var b = host.querySelector("[data-studio-" + k + "]");
      if (!b) return;
      /* 내보내기(다운로드·복사)는 해시가 없어도 코드만 있으면 됩니다. */
      b.disabled = (k === "download" || k === "copy") ? (!ST.code || ST.busy) : busy;
    });
  }

  function flash(text, kind) {
    ST.flash = { text: text || "", kind: kind || "ok" };
    var box = ST.host && ST.host.querySelector("#studio-flash");
    if (box) {
      box.textContent = ST.flash.text;
      box.className = "studio-flash" + (kind ? " " + kind : "");
    }
  }

  /* ---------------- 프리셋 ---------------- */
  function applyPreset(id) {
    var p = presetById(id);
    ST.preset = p.id;
    ST.hook = p.hook;
    ST.fields = {
      name: p.name[ST.lang] || p.name.ko,
      slug: suggestSlug(p.id, p.name[ST.lang] || p.name.ko),
      version: "1.0.0",
      summary: p.summary[ST.lang] || p.summary.ko,
      category: p.category,
      hook: p.hook,
      title: p.fields.title[ST.lang] || p.fields.title.ko,
      body: p.fields.body[ST.lang] || p.fields.body.ko,
      button: p.fields.button[ST.lang] || p.fields.button.ko,
      link: p.fields.link[ST.lang] || p.fields.link.ko,
      bg: p.fields.bg[ST.lang] || p.fields.bg.ko,
      accent: p.fields.accent[ST.lang] || p.fields.accent.ko
    };
    ST.draftId = "";
    render();
    flash(T("presetApplied", { name: p.name[ST.lang] || p.name.ko }), "ok");
  }
  function suggestSlug(id, name) {
    if (ST.lang === "en" && name) {
      var guess = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      if (/^[a-z0-9][a-z0-9-]{1,59}$/.test(guess)) return guess;
    }
    return id;
  }

  /* ---------------- 초안 ---------------- */
  function draftPayload() {
    return {
      slug: ST.fields.slug,
      name: ST.fields.name,
      version: ST.fields.version,
      summary: ST.fields.summary,
      category: ST.fields.category,
      blueprint: { preset: ST.preset, hook: ST.hook, fields: ST.fields, studio: "v10.9" },
      generated_code: ST.code,
      integrity: ST.sri || null,
      status: "draft"
    };
  }

  function localDrafts() { var l = readLS(LS_DRAFTS, []); return Array.isArray(l) ? l : []; }
  function saveLocalDraft() {
    var list = localDrafts();
    var id = ST.draftId || ("local-" + Date.now());
    var payload = draftPayload();
    payload.id = id;
    payload.updated_at = new Date().toISOString();
    payload.created_at = payload.created_at || payload.updated_at;
    var hit = false;
    list = list.map(function (d) {
      if (d.id !== id) return d;
      hit = true;
      return Object.assign({}, d, payload);
    });
    if (!hit) list.unshift(payload);
    writeLS(LS_DRAFTS, list.slice(0, 50));
    ST.draftId = id;
    ST.draftSource = "local";
    ST.drafts = list.slice(0, 50);
    paintDrafts();
  }

  function paintDrafts() {
    var host = ST.host;
    var box = host && host.querySelector("#studio-drafts");
    if (box) box.innerHTML = draftsHtml();
  }

  function saveDraft(btn) {
    if (!ST.code || ST.problems.length) { flash(T("needFix"), "err"); return; }
    ST.busy = true; syncActions();
    if (btn) { btn.disabled = true; btn.textContent = T("saveBusy"); }
    var payload = draftPayload();
    var uid = userId();
    if (isUuid(uid)) payload.author_id = uid;
    function done(err, local) {
      ST.busy = false;
      if (btn) btn.textContent = T("save");
      syncActions();
      if (err && !local) { flash(T("saveFail", { msg: err.message || err }), "err"); return; }
      if (local) {
        saveLocalDraft();
        flash(T("savedLocal"), "ok");
      } else {
        ST.draftSource = "server";
        flash(T("saved"), "ok");
        loadDrafts(true);
      }
    }
    if (ST.draftSource === "local" || ST.draftsMissing) { done(null, true); return; }
    if (ST.draftId) {
      sbRequest("/rest/v1/plugin_drafts?id=eq." + encodeURIComponent(ST.draftId), {
        method: "PATCH", body: payload, prefer: "return=representation"
      }).then(function () { done(null, false); }, function (e) {
        if (missingTable(e)) { ST.draftsMissing = true; done(null, true); return; }
        done(e, false);
      });
      return;
    }
    sbRequest("/rest/v1/plugin_drafts", { method: "POST", body: payload, prefer: "return=representation" })
      .then(function (rows) {
        var row = Array.isArray(rows) ? rows[0] : rows;
        if (row && row.id) ST.draftId = String(row.id);
        done(null, false);
      }, function (e) {
        if (missingTable(e)) { ST.draftsMissing = true; done(null, true); return; }
        /* 같은 슬러그 초안이 이미 있으면 그 행을 고칩니다(unique slug). */
        if (String(e.code || "") === "23505" || /duplicate key|unique/i.test(String(e.message || ""))) {
          sbRequest("/rest/v1/plugin_drafts?slug=eq." + encodeURIComponent(payload.slug) + "&select=id",
            { method: "GET" }).then(function (rows) {
            var row = Array.isArray(rows) ? rows[0] : rows;
            if (!row || !row.id) { done(e, false); return; }
            ST.draftId = String(row.id);
            return sbRequest("/rest/v1/plugin_drafts?id=eq." + encodeURIComponent(ST.draftId),
              { method: "PATCH", body: payload, prefer: "return=representation" }).then(function () { done(null, false); }, function (e2) { done(e2, false); });
          }, function (e2) { done(e2, false); });
          return;
        }
        done(e, false);
      });
  }

  function loadDrafts(force) {
    if (ST.draftsLoading) return;
    if (ST.drafts && !force && !ST.draftsMissing) return;
    ST.draftsLoading = true;
    sbRequest("/rest/v1/plugin_drafts?select=*&order=updated_at.desc&limit=50", { method: "GET" })
      .then(function (rows) {
        ST.draftsLoading = false;
        ST.draftsMissing = false;
        ST.drafts = Array.isArray(rows) ? rows : [];
        ST.draftSource = "server";
        paintDrafts();
      }, function (e) {
        ST.draftsLoading = false;
        if (missingTable(e)) {
          ST.draftsMissing = true;
          ST.drafts = localDrafts();
          ST.draftSource = "local";
        } else {
          ST.draftsError = e.message || String(e);
          ST.drafts = localDrafts();
          ST.draftSource = "local";
        }
        paintDrafts();
      });
  }

  function loadDraft(id) {
    var list = ST.drafts || [];
    var row = null;
    list.forEach(function (d) { if (String(d.id) === String(id)) row = d; });
    if (!row) { flash(T("loadFail", { msg: id }), "err"); return; }
    var bp = row.blueprint || {};
    var f = Object.assign(blankFields(), bp.fields || {});
    ST.fields = f;
    ST.preset = bp.preset || ST.preset;
    ST.hook = f.hook || bp.hook || "widget";
    ST.draftId = String(row.id);
    ST.draftSource = ST.draftsMissing ? "local" : "server";
    render();
    flash(T("saved"), "ok");
  }

  function deleteDraft(id, btn) {
    var isLocal = String(id).indexOf("local-") === 0 || ST.draftsMissing;
    if (btn) btn.disabled = true;
    function after(err) {
      if (btn) btn.disabled = false;
      if (err) { flash(T("deleteFail", { msg: err.message || err }), "err"); return; }
      if (String(ST.draftId) === String(id)) ST.draftId = "";
      flash(T("removed"), "ok");
      if (isLocal) {
        writeLS(LS_DRAFTS, localDrafts().filter(function (d) { return String(d.id) !== String(id); }));
        ST.drafts = localDrafts();
        paintDrafts();
      } else {
        loadDrafts(true);
      }
    }
    if (isLocal) { after(null); return; }
    sbRequest("/rest/v1/plugin_drafts?id=eq." + encodeURIComponent(id), { method: "DELETE" })
      .then(function () { after(null); }, function (e) {
        if (missingTable(e)) { ST.draftsMissing = true; after(null); return; }
        after(e);
      });
  }

  /* ---------------- 내보내기 ---------------- */
  function fileName() { return String(ST.fields.slug || "sbpress-plugin") + ".js"; }

  function downloadJs() {
    if (!ST.code) { flash(T("needCode"), "err"); return; }
    var name = fileName();
    try {
      var blob = new Blob([ST.code], { type: "text/javascript;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        try { URL.revokeObjectURL(url); } catch (e) { /* noop */ }
      }, 1500);
    } catch (e) {
      var a2 = document.createElement("a");
      a2.href = "data:text/javascript;charset=utf-8," + encodeURIComponent(ST.code);
      a2.download = name;
      document.body.appendChild(a2);
      a2.click();
      setTimeout(function () { if (a2.parentNode) a2.parentNode.removeChild(a2); }, 1500);
    }
    flash(T("fileSaved", { name: name }), "ok");
  }

  function marketItem() {
    var hook = ST.hook;
    return {
      id: ST.fields.slug,
      name: ST.fields.name,
      version: ST.fields.version,
      description: ST.fields.summary,
      author: "SBPress Studio",
      category: ST.fields.category,
      script_url: "/assets/plugins/" + ST.fields.slug + ".js",
      integrity: ST.sri || "",
      hooks: [hook],
      permissions: permsFor(hook),
      manifest: { v: 1, name: ST.fields.name, version: ST.fields.version, hooks: [hook], permissions: permsFor(hook) },
      min_sbpress_version: "10.9.0",
      max_sbpress_version: "10.9",
      updated: new Date().toISOString().slice(0, 10)
    };
  }

  function copyText(text, cb) {
    var done = typeof cb === "function" ? cb : function () {};
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
      return;
    }
    fallback();
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand && document.execCommand("copy");
        document.body.removeChild(ta);
        done(!!ok);
      } catch (e) { done(false); }
    }
  }

  function copyJson() {
    if (!ST.code) { flash(T("needCode"), "err"); return; }
    ST.lastJson = JSON.stringify(marketItem(), null, 2);
    copyText(ST.lastJson, function (ok) {
      flash(ok ? T("copied") : T("copyFail"), ok ? "ok" : "err");
    });
  }

  /* ---------------- 권한 동의 · 설치 ---------------- */
  function ensureConsent() {
    var el = document.getElementById("studio-consent");
    if (el && document.body.contains(el)) return el;
    el = document.createElement("div");
    el.className = "studio-modal";
    el.id = "studio-consent";
    el.hidden = true;
    el.innerHTML =
      '<div class="studio-modal-backdrop" data-studio-cancel="1"></div>' +
      '<div class="studio-modal-card" role="dialog" aria-modal="true" aria-labelledby="studio-consent-title">' +
        '<header class="studio-modal-head"><h2 id="studio-consent-title"></h2>' +
          '<button type="button" class="studio-modal-x" data-studio-cancel="1" aria-label="×">×</button></header>' +
        '<div class="studio-modal-body" id="studio-consent-body"></div>' +
        '<footer class="studio-modal-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-studio-cancel="1">' + esc(T("consentCancel")) + "</button>" +
          '<button type="button" class="btn btn-primary btn-sm" data-studio-consent-go="1">' + esc(T("consentAgree")) + "</button>" +
        "</footer>" +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest("[data-studio-cancel]")) { closeConsent(); return; }
      if (e.target.closest("[data-studio-consent-go]")) { doInstall(e.target.closest("[data-studio-consent-go]")); }
    });
    return el;
  }

  function openConsent() {
    var perms = permsFor(ST.hook);
    var el = ensureConsent();
    el.querySelector("#studio-consent-title").textContent = T("consentTitle");
    el.querySelector("#studio-consent-body").innerHTML =
      '<p class="studio-consent-lead">' + esc(T("consentLead", { name: ST.fields.name })) + "</p>" +
      "<h3>" + esc(perms.length ? T("consentPerms", { n: perms.length }) : T("consentNoPerms")) + "</h3>" +
      (perms.length ? '<ul class="studio-perm-list">' + perms.map(function (p) {
        var info = PERM_TEXT[p] || { ko: p, en: p };
        return '<li><code>' + esc(p) + "</code> " + esc(info[ST.lang] || info.ko) + "</li>";
      }).join("") + "</ul>" : "") +
      "<dl class=\"studio-facts\">" +
        "<div><dt>" + esc(T("consentIntegrity")) + "</dt><dd><code data-no-i18n>" + esc(ST.sri) + "</code></dd></div>" +
        "<div><dt>" + esc(T("consentSandbox")) + "</dt><dd>" + esc(T("consentSandboxText")) + "</dd></div>" +
      "</dl>" +
      '<p class="studio-note">' + esc(T("consentNote")) + "</p>" +
      '<p class="studio-flash" id="studio-consent-msg" role="status" aria-live="polite"></p>';
    el.hidden = false;
    document.documentElement.classList.add("studio-modal-open");
    try { el.querySelector("[data-studio-consent-go]").focus(); } catch (e) { /* noop */ }
  }

  function closeConsent() {
    var el = document.getElementById("studio-consent");
    if (!el) return;
    el.hidden = true;
    document.documentElement.classList.remove("studio-modal-open");
  }

  function pluginRow() {
    var perms = permsFor(ST.hook);
    return {
      id: ST.fields.slug,
      name: ST.fields.name,
      version: ST.fields.version,
      description: ST.fields.summary,
      author: "SBPress Studio",
      script_url: "inline:base64:" + base64Utf8(ST.code),
      source: "market",
      enabled: true,
      manifest: { v: 1, name: ST.fields.name, version: ST.fields.version, hooks: [ST.hook], permissions: perms, studio: true },
      integrity: ST.sri,
      granted_permissions: perms,
      consent_at: new Date().toISOString(),
      sandbox_mode: "strict"
    };
  }

  function doInstall(btn) {
    var el = document.getElementById("studio-consent");
    var msg = el && el.querySelector("#studio-consent-msg");
    if (btn) { btn.disabled = true; btn.textContent = T("installBusy"); }
    var row = pluginRow();
    function fail(err) {
      if (btn) { btn.disabled = false; btn.textContent = T("consentAgree"); }
      if (msg) { msg.textContent = T("installFail", { msg: (err && err.message) || err }); msg.className = "studio-flash err"; }
    }
    function ok() {
      if (btn) { btn.disabled = false; btn.textContent = T("consentAgree"); }
      closeConsent();
      flash(T("installed", { name: ST.fields.name }), "ok");
      if (ST.opts && typeof ST.opts.onInstalled === "function") {
        try { ST.opts.onInstalled(ST.fields.slug); } catch (e) { /* noop */ }
      }
    }
    /* 이미 같은 id 가 있으면 고칩니다(업데이트). */
    sbRequest("/rest/v1/plugins?id=eq." + encodeURIComponent(row.id) + "&select=id", { method: "GET" })
      .then(function (rows) {
        var has = Array.isArray(rows) && rows.length > 0;
        if (has) {
          return sbRequest("/rest/v1/plugins?id=eq." + encodeURIComponent(row.id),
            { method: "PATCH", body: row, prefer: "return=representation" });
        }
        return sbRequest("/rest/v1/plugins", { method: "POST", body: row, prefer: "return=representation" });
      })
      .then(function () { ok(); }, function (err) {
        /* v10.5 열이 없는 DB(26_v105 미실행)면 무결성·동의 칸을 빼고 다시 시도합니다. */
        var bare = Object.assign({}, row);
        delete bare.integrity; delete bare.granted_permissions; delete bare.consent_at; delete bare.sandbox_mode;
        sbRequest("/rest/v1/plugins?id=eq." + encodeURIComponent(row.id) + "&select=id", { method: "GET" })
          .then(function (rows) {
            if (Array.isArray(rows) && rows.length) {
              return sbRequest("/rest/v1/plugins?id=eq." + encodeURIComponent(row.id), { method: "PATCH", body: bare });
            }
            return sbRequest("/rest/v1/plugins", { method: "POST", body: bare });
          })
          .then(function () { ok(); }, function (e2) { fail(e2 || err); });
      });
  }

  /* ---------------- 마켓 제출 (v10.6 모달 자동 채우기) ---------------- */
  function submitToMarket() {
    if (!ST.code || ST.problems.length) { flash(T("needFix"), "err"); return; }
    var M = window.SBP_MARKET;
    if (!M || !M.openSubmit) { flash(T("needCode"), "err"); return; }
    M.openSubmit();
    var el = document.getElementById("mkt-submit");
    if (!el) { flash(T("needCode"), "err"); return; }
    function set(id, val) {
      var n = el.querySelector("#" + id);
      if (n) n.value = val;
    }
    var item = marketItem();
    set("mkt-sub-name", item.name);
    set("mkt-sub-slug", item.id);
    set("mkt-sub-version", item.version);
    set("mkt-sub-summary", item.description);
    set("mkt-sub-author", item.author);
    set("mkt-sub-url", item.script_url);
    var cat = el.querySelector("#mkt-sub-cat");
    if (cat) {
      var found = false;
      [].forEach.call(cat.options, function (o) { if (o.value === item.category) found = true; });
      if (!found) {
        var o2 = document.createElement("option");
        o2.value = item.category;
        o2.textContent = item.category;
        cat.appendChild(o2);
      }
      cat.value = item.category;
    }
    [].forEach.call(el.querySelectorAll('input[name="mkt-sub-hook"]'), function (n) {
      n.checked = n.value === ST.hook;
    });
    [].forEach.call(el.querySelectorAll('input[name="mkt-sub-perm"]'), function (n) {
      n.checked = item.permissions.indexOf(n.value) >= 0;
    });
    var extra = el.querySelector("#mkt-sub-perm-extra");
    if (extra) extra.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    flash(T("submitOpened"), "ok");
    /* 서버 초안이 있으면 상태를 published 로 바꾸고 audit_logs(studio_publish)에 남깁니다. */
    if (ST.draftId && !ST.draftsMissing && ST.draftSource === "server") {
      sbRequest("/rest/v1/rpc/publish_studio_draft", {
        method: "POST", body: { p_draft_id: ST.draftId, p_action: "publish" }
      }).then(function () { loadDrafts(true); }, function () { /* RPC 가 없으면 초안 상태만 그대로 */ });
    }
  }

  /* ---------------- 이벤트 ---------------- */
  var timer = 0;
  function scheduleUpdate() {
    clearTimeout(timer);
    timer = setTimeout(function () { update(); }, 120);
  }

  function bind(host) {
    if (host.getAttribute("data-studio-bound")) return;
    host.setAttribute("data-studio-bound", "1");
    host.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var pre = t.closest("[data-studio-preset]");
      if (pre) { applyPreset(pre.getAttribute("data-studio-preset")); return; }
      if (t.closest("[data-studio-save]")) { saveDraft(t.closest("[data-studio-save]")); return; }
      if (t.closest("[data-studio-download]")) { downloadJs(); return; }
      if (t.closest("[data-studio-copy]")) { copyJson(); return; }
      if (t.closest("[data-studio-install]")) {
        if (!ST.code || ST.problems.length) { flash(T("needFix"), "err"); return; }
        openConsent();
        return;
      }
      if (t.closest("[data-studio-submit]")) { submitToMarket(); return; }
      var ld = t.closest("[data-studio-load]");
      if (ld) { loadDraft(ld.getAttribute("data-studio-load")); return; }
      var del = t.closest("[data-studio-del]");
      if (del) { deleteDraft(del.getAttribute("data-studio-del"), del); return; }
    });
    host.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute("data-f")) { scheduleUpdate(); }
    });
    host.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.type === "color" && t.getAttribute("data-f")) {
        var key = t.getAttribute("data-f");
        ST.fields[key] = String(t.value || "").toUpperCase();
        var txt = host.querySelector('input[data-hex="1"][data-f="' + key + '"]');
        if (txt) txt.value = ST.fields[key];
        update(true);
        return;
      }
      if (t.getAttribute("data-f")) {
        readForm();
        /* 훅을 바꾸면 카테고리도 자연스럽게 맞춥니다(사용자가 고른 값은 유지). */
        update(true);
      }
    });
  }

  /* ---------------- 공개 표면 ---------------- */
  function mount(host, opts) {
    if (!host) return null;
    opts = opts || {};
    ST.host = host;
    ST.opts = opts;
    ST.lang = opts.lang || currentLang();
    if (!ST.fields.name) {
      /* 첫 진입 — 첫 프리셋으로 시작합니다. */
      var p = PRESETS[0];
      ST.fields = {
        name: p.name[ST.lang] || p.name.ko,
        slug: p.id,
        version: "1.0.0",
        summary: p.summary[ST.lang] || p.summary.ko,
        category: p.category,
        hook: p.hook,
        title: p.fields.title[ST.lang] || p.fields.title.ko,
        body: p.fields.body[ST.lang] || p.fields.body.ko,
        button: p.fields.button[ST.lang] || p.fields.button.ko,
        link: p.fields.link[ST.lang] || p.fields.link.ko,
        bg: p.fields.bg[ST.lang] || p.fields.bg.ko,
        accent: p.fields.accent[ST.lang] || p.fields.accent.ko
      };
      ST.preset = p.id;
      ST.hook = p.hook;
    }
    bind(host);
    render();
    loadDrafts(false);
    return ST;
  }

  function setLang(lang) {
    var next = lang === "en" ? "en" : "ko";
    if (next === ST.lang) return;
    /* 입력값은 그대로 두고 화면 문구만 바꿉니다. */
    ST.lang = next;
    if (ST.host && document.body.contains(ST.host)) render();
  }

  function blueprint() {
    return { preset: ST.preset, hook: ST.hook, fields: ST.fields };
  }

  /* 시험·다른 화면용 표면 */
  window.SBP_STUDIO = {
    __v: 109,
    version: "10.9.0",
    mount: mount,
    update: function () { if (ST.host) { render(); } },
    setLang: setLang,
    currentLang: function () { return ST.lang; },
    presets: function () {
      return PRESETS.map(function (p) { return { id: p.id, hook: p.hook, category: p.category }; });
    },
    presetById: presetById,
    applyPreset: function (id) {
      if (!ST.host) return false;
      applyPreset(id);
      return ST.preset === id;
    },
    fields: function () { return JSON.parse(JSON.stringify(ST.fields)); },
    setFields: function (patch) {
      if (!patch) return false;
      Object.keys(patch).forEach(function (k) { if (k in ST.fields) ST.fields[k] = String(patch[k]); });
      if (ST.host) render();
      return true;
    },
    buildCode: function (f) { return buildCode(Object.assign({}, ST.fields, f || {})); },
    code: function () { return ST.code; },
    hash: function () { return { hex: ST.hash, sri: ST.sri }; },
    scan: function () { return ST.scan; },
    problems: function () { return ST.problems.slice(); },
    validate: function (f) { return validate(Object.assign({}, ST.fields, f || {})); },
    scanSource: scanCode,
    save: function () { if (ST.host) saveDraft(null); },
    download: function () { if (ST.host) downloadJs(); },
    copyJson: function () { if (ST.host) copyJson(); },
    install: function () { if (ST.host && ST.code && !ST.problems.length) openConsent(); },
    consentOpen: function () { return !!(document.getElementById("studio-consent") && !document.getElementById("studio-consent").hidden); },
    submit: function () { if (ST.host) submitToMarket(); },
    drafts: function () { return (ST.drafts || []).slice(); },
    draftSource: function () { return ST.draftSource; },
    draftsMissing: function () { return ST.draftsMissing; },
    lastJson: function () { return ST.lastJson; },
    flush: function () { update(true); },
    state: ST
  };

  /* 관리자 언어 전환 — 화면 문구를 다시 그립니다. */
  document.addEventListener("craft:lang", function () {
    try { setLang(currentLang()); } catch (e) { /* noop */ }
  });
})();
