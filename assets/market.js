/* ===== SBPress v10.7 · 플러그인 마켓 탐색기 (assets/market.js) =====
   관리자(/admin · 플러그인 · 마켓)와 공개 화면(#/market)이 함께 쓰는 마켓 화면입니다.

   · v10.5 권한 동의 · 무결성 — 설치·업데이트 전에 「권한을 확인해 주세요」 모달로
     요청 권한(위험도·영역 설명)·SRI 무결성(sha256-… 유무)·샌드박스 모드를 보여 주고,
     동의한 권한만 설치/업데이트에 넘깁니다. 카드·상세에 「SHA-256 검증됨」·「권한 N개 동의」·
     「무결성 오류 차단」 배지와 「무결성 다시 검사」 버튼을 둡니다.
   · v10.3 버전 비교 — 설치된 버전과 마켓 최신 버전을 숫자 세 칸(1.2.0)으로 비교해
     「업데이트 가능 (vX → vY)」 배지 · 상단 「업데이트 가능 N개 · 전체 업데이트」 바 ·
     상세 모달의 「업데이트」 · 「이전 버전으로 되돌리기(롤백)」 확인 UI 를 그립니다.
   · 실시간 검색 — 이름·설명·태그·작성자 (한국어·영어 이름 모두)
   · 필터 칩 — 카테고리 · 훅(menu/card/widget/admin-tab/css) · 태그
   · 정렬 — 추천순(order) · 최신 업데이트(updated) · 이름순
   · 카드를 누르면 상세 모달 — 미리보기 그림 · 버전 · 작성자 · 최소 SBPress 버전 ·
     필요 권한 설명 · 변경 이력(changelog) · 설치/켜기/끄기/업데이트/제거(관리자만)

   · v10.6 제출 · 심사 — 「플러그인 제출」 모달(이름·슬러그·버전·요약·작성자·스크립트 URL·
     카테고리·훅·권한)이 자동 사전 점검(HTTPS · 정적 코드 검사 · SHA-256)을 거쳐
     plugin_submissions 에 들어가고, 관리자 마켓의 「제출 · 심사 큐」에서 승인/반려(사유)합니다.
     승인된 항목은 v10.5 동의 모달로 바로 설치하거나 마켓 JSON 으로 복사·내보냅니다.
     (supabase/27_v106_plugin_submissions.sql · 표가 없으면 이 브라우저에만 저장)

   · v10.7 별점 · 리뷰 · 설치 통계 — 카드와 상세 모달에 평균 별점(★ 4.5 · 리뷰 3건) ·
     설치 수 · 호환성 배지(SBPress 10.7 호환 / 미검증 / 주의)를 보여 주고, 정렬에
     「평점 높은순」·「인기(설치)순」을 더합니다. 상세 모달에는 1~5 별점 리뷰 목록과
     작성·수정 폼(로그인 회원)이 있고, 관리자는 리뷰를 숨기거나 복원합니다.
     관리자 「호환성 리포트」는 설치·마켓 플러그인을 min/max SBPress 버전 · 훅 API
     (blocksApi·securityApi) · 최근 실행 오류와 견주고 「전체 호환성 재검사」로 결과를 남깁니다.
     (supabase/28_v107_plugin_reviews_stats.sql · 표가 없으면 이 브라우저에만 저장)

   이 파일은 첫 화면에 넣지 않습니다. 공개 사이트는 #/market 에 들어갈 때(app.js 의
   LAZY_ROUTES), 관리자 화면은 플러그인 탭을 처음 열 때 admin.js 가 SBP.loadScript 로
   받아옵니다 — 300KB 첫 화면 예산을 지키기 위해서입니다.

   v10.9 — 관리자 마켓에 「스튜디오」 서브탭. 이 탭을 처음 열 때만 assets/studio.js ·
   assets/studio.css 를 따로 받아옵니다(노코드 플러그인 스튜디오 · 초안은 supabase/30_v109).

   v10.10 — 유료/라이선스 키 & 중앙 마켓 허브
   · 마켓 필터에 「전체 / 무료 / 유료·라이선스」 가격 칩, 카드·상세에 가격 배지와
     플랜(pro · team · enterprise)을 더합니다.
   · 유료 플러그인(license_required)은 설치 전에 「라이선스 키 확인」 모달에서
     SBP-XXXX-XXXX-XXXX-XXXX 를 확인하고(verify_plugin_license RPC), 통과하면
     v10.5 권한 동의 모달로 이어서 설치합니다. 잘못된 형식·없는 키·만료·한도 초과는
     그 자리에서 막고 이유를 보여 줍니다.
   · 관리자 「라이선스 · 허브」 서브탭 — 중앙 마켓 허브 대시보드(연결 마켓·플러그인·테마·
     번들·승인 대기·활성 라이선스 수, hub-manifest.json 복사/내려받기)와 라이선스 발급·
     관리(원클릭 키 발급·복사·폐기/되살리기)를 한 화면에 둡니다. (supabase/31_v1010)

   보안: 화면에 넣는 모든 값은 esc() 로 이스케이프하고, 인라인 이벤트·eval 을 쓰지 않습니다(CSP).
   설치·제거 같은 쓰기는 이 파일이 하지 않습니다. 관리자 화면이 넘겨준 콜백에 맡깁니다. */
(function () {
  "use strict";

  if (window.SBP_MARKET && window.SBP_MARKET.__v === 10) return;

  var seq = 0;
  var INSTANCES = [];
  var HOOK_ORDER = ["menu", "card", "widget", "admin-tab", "css", "settings", "block"];

  /* ---------------- 문구 (KO · EN) ---------------- */
  var L = {
    ko: {
      eyebrow: "플러그인 마켓 · MARKET",
      title: "SBPress 플러그인 마켓",
      lead: "SBPress 사이트에 기능을 더하는 플러그인 목록입니다. 이름·태그로 찾고, 카드를 눌러 미리보기·필요 권한·변경 이력을 확인하세요. 설치는 관리자 화면에서만 할 수 있습니다.",
      search: "이름·설명·태그·작성자 검색",
      searchAria: "마켓 검색",
      sort: "정렬",
      sortAria: "정렬 방식",
      sortRecommend: "추천순",
      sortLatest: "최신 업데이트",
      sortName: "이름순",
      fCategory: "카테고리",
      fHook: "훅",
      fTag: "태그",
      all: "전체",
      count: "{m}개 표시 · 전체 {n}개",
      empty: "조건에 맞는 플러그인이 없습니다. 검색어나 필터를 바꿔 보세요.",
      emptyMarket: "마켓에 표시할 플러그인이 없습니다. 마켓 주소를 확인해 주세요.",
      loading: "마켓 목록을 불러오는 중…",
      failed: "마켓 목록을 불러오지 못했습니다: ",
      retry: "다시 시도",
      detail: "상세 보기",
      detailShort: "상세",
      detailsOf: "{name} 상세 보기",
      close: "닫기",
      version: "버전",
      author: "작성자",
      updated: "업데이트",
      /* v10.3 — 버전 비교 · 업데이트 · 롤백 */
      updAvail: "업데이트 가능 (v{x} → v{y})",
      updNow: "업데이트 가능",
      updBar: "업데이트 가능 {n}개",
      updBarNote: "설치된 플러그인 중 마켓 최신 버전보다 낮은 것이 있습니다.",
      updAll: "전체 업데이트",
      updAllBusy: "업데이트하는 중… ({i}/{n})",
      updAllDone: "{n}개를 업데이트했습니다.",
      updAllFailed: "{n}개를 업데이트하지 못했습니다.",
      updAllSkipped: "{n}개는 새 권한이 있어 건너뛰었습니다. 카드에서 「동의하고 업데이트」로 처리해 주세요.",
      updateNow: "업데이트",
      updating: "업데이트하는 중…",
      updatedDone: "v{v} 으로 업데이트했습니다.",
      updateFailed: "업데이트하지 못했습니다: ",
      latestTag: "최신",
      olderTag: "설치본이 더 새로움 (v{x})",
      changesTitle: "이번 업데이트의 변경 이력",
      changesNone: "v{v} 이후로 기록된 변경 내용이 없습니다.",
      historyTitle: "버전 이력",
      historyEmpty: "보관된 이전 버전이 없습니다.",
      historyLeft: "보관된 이전 버전 {n}개",
      rollback: "이전 버전으로 되돌리기",
      rollbackShort: "되돌리기",
      rollbackTitle: "이전 버전으로 되돌리기(롤백)",
      rollbackLead: "‘{name}’ 을 지금 v{cur} 에서 v{prev} 로 되돌립니다. 플러그인 코드·매니페스트·설정 스키마가 함께 돌아갑니다.",
      rollbackKeep: "글·사진·설정 값은 그대로 두고 플러그인만 되돌립니다.",
      rollbackGo: "v{prev} 로 되돌리기",
      rollbackCancel: "취소",
      rollbackBusy: "되돌리는 중…",
      rollbackDone: "v{prev} 으로 되돌렸습니다.",
      rollbackFailed: "되돌리지 못했습니다: ",
      rollbackNone: "되돌릴 이전 버전이 없습니다.",
      pinnedNote: "버전 고정(v{v}) — 고정을 풀어야 업데이트할 수 있습니다.",
      pinnedTag: "버전 고정됨",
      needSqlVersions: "Supabase 에 supabase/24_v103_plugin_versions.sql 을 실행하면 이전 버전을 보관하고 롤백할 수 있습니다. 지금은 보관 없이 업데이트합니다.",
      versionHint: "버전은 1.2.0 처럼 숫자 세 칸으로 비교합니다.",
      minVersion: "최소 SBPress",
      currentVersion: "현재 {v}",
      compatOk: "호환",
      compatNo: "v{v} 이상 필요",
      category: "카테고리",
      hooks: "훅",
      tags: "태그",
      permissions: "필요 권한",
      noPermissions: "특별한 권한을 요청하지 않습니다.",
      changelog: "변경 이력",
      noChangelog: "기록된 변경 이력이 없습니다.",
      shots: "미리보기",
      noShot: "미리보기 그림이 없습니다.",
      install: "설치 및 켜기",
      installing: "설치하는 중…",
      turnOn: "켜기",
      turnOff: "끄기",
      update: "v{v} 으로 업데이트",
      remove: "제거",
      installedOn: "설치됨 · 켜짐",
      installedOff: "설치됨 · 꺼짐",
      adminOnly: "설치·켜기·제거는 관리자 화면에서만 할 수 있습니다.",
      goAdmin: "관리자에서 관리",
      unknownPerm: "이 플러그인이 요청한 권한입니다.",
      screenshotAlt: "{name} 미리보기",
      /* v10.2 — 플러그인 설정 */
      settings: "설정",
      settingsOf: "{name} 설정",
      settingsLead: "이 플러그인의 동작을 바꿉니다. 저장하면 사이트와 이 화면에 바로 적용됩니다.",
      settingsAdminOnly: "설정은 관리자 화면에서만 바꿀 수 있습니다.",
      save: "저장",
      saving: "저장하는 중…",
      saved: "저장했습니다. 사이트에 바로 적용됩니다.",
      saveFailed: "저장하지 못했습니다: ",
      restore: "기본값으로 복원",
      restoring: "기본값으로 되돌리는 중…",
      restored: "기본값으로 되돌렸습니다.",
      restoreConfirm: "이 플러그인의 설정을 모두 기본값으로 되돌릴까요?",
      noChanges: "바뀐 값이 없습니다.",
      defaultTag: "기본값",
      colorClear: "테마 색",
      needSql: "설정을 저장하지 못했습니다. Supabase 에 supabase/23_v102_plugin_settings.sql 을 실행한 뒤 다시 시도해 주세요.",
      noSchema: "이 플러그인은 바꿀 설정이 없습니다.",
      invalidNumber: "숫자로 넣어 주세요: ",
      outOfRange: "범위를 벗어난 값은 가까운 값으로 맞춥니다: ",
      enabledNote: "꺼진 플러그인은 켜야 사이트에 적용됩니다.",
      fieldCheck: "값을 다시 확인해 주세요: ",
      on: "켜짐",
      off: "꺼짐",
      /* v10.4 — 멀티 마켓 구독 · 커스텀 블록 */
      fMarket: "마켓",
      allMarkets: "모든 마켓",
      srcOfficial: "공식",
      srcMarket: "구독",
      marketOfficialName: "공식 마켓",
      srcBadge: "{name}",
      marketPanel: "구독 마켓 관리",
      marketPanelNote: "여러 마켓의 plugins.json 을 모아 한 목록으로 보여줍니다. 주소는 https:// 또는 사이트 안 경로(/)만 됩니다. 공식 마켓은 끄거나 지울 수 없습니다.",
      marketAddName: "마켓 이름",
      marketAddUrl: "마켓 JSON 주소",
      marketAdd: "마켓 추가",
      marketAddBusy: "확인하는 중…",
      marketOfficial: "공식",
      marketToggleOn: "끄기",
      marketToggleOff: "켜기",
      marketSync: "동기화",
      marketSyncBusy: "동기화 중…",
      marketRemove: "삭제",
      marketRemoveConfirm: "‘{name}’ 마켓을 삭제할까요? 설치한 플러그인은 그대로 남습니다.",
      marketCannotRemoveOfficial: "공식 마켓은 삭제할 수 없습니다.",
      marketCannotToggleOfficial: "공식 마켓은 끌 수 없습니다.",
      marketCount: "플러그인 {n}개",
      marketSyncAt: "마지막 동기화 {t}",
      marketNever: "아직 동기화하지 않음",
      marketError: "읽지 못함: ",
      marketEmpty: "구독한 마켓이 없습니다.",
      marketAdded: "마켓을 추가했습니다: {name}",
      marketRemoved: "마켓을 삭제했습니다: {name}",
      marketToggled: "‘{name}’ 마켓을 {state}습니다.",
      marketSynced: "‘{name}’ 마켓을 동기화했습니다 · 플러그인 {n}개",
      marketNeedSql: "Supabase 에 supabase/25_v104_multimarket_blocks.sql 을 실행하면 구독 마켓이 서버에 저장됩니다. 지금은 이 브라우저에만 기억합니다.",
      marketBadUrl: "마켓 주소는 https:// 또는 사이트 안 경로(/)여야 합니다.",
      marketBadSchema: "마켓 JSON 에서 플러그인 목록(plugins)을 찾지 못했습니다: ",
      marketDupNote: "다른 마켓과 ID가 겹치는 플러그인 {n}개는 앞선 마켓(공식 우선) 것을 씁니다.",
      pluginBadge: "플러그인 블록",
      /* v10.5 — 권한 동의 · SHA-256 무결성 · 샌드박스 */
      trustTitle: "보안 · 무결성",
      integrity: "무결성",
      integrityOk: "SHA-256 검증됨",
      integrityOkShort: "SHA-256",
      integrityNone: "무결성 값 없음",
      integrityBad: "무결성 오류 차단",
      integrityUnchecked: "무결성 확인 못함",
      integrityChecking: "무결성 확인 중…",
      integrityRecheck: "무결성 다시 검사",
      integrityRechecking: "다시 검사하는 중…",
      integrityRechecked: "무결성을 다시 검사했습니다 — 파일이 그대로입니다.",
      integrityMismatch: "무결성 검사에 실패했습니다 — 파일이 바뀌었을 수 있어 실행·설치를 막았습니다.",
      integrityBlocked: "무결성 오류가 있어 설치할 수 없습니다. 「무결성 다시 검사」로 확인해 주세요.",
      integrityNeedSql: "Supabase 에 supabase/26_v105_plugin_security.sql 을 실행하면 무결성·권한 동의가 서버에 저장됩니다. 지금은 이 브라우저에만 기억합니다.",
      integrityHint: "마켓 JSON 의 sha256-… 값과 내려받은 파일 바이트를 브라우저에서 다시 해시해 비교합니다.",
      consentTitle: "권한을 확인해 주세요",
      consentTitleNew: "새 권한을 확인해 주세요",
      consentTitleUpdate: "권한을 확인하고 업데이트",
      consentLead: "‘{name}’ 플러그인이 아래 권한을 요청합니다. 동의한 권한 밖의 기능(훅)은 실행되지 않습니다.",
      consentLeadNew: "‘{name}’ 의 새 버전이 아래 권한을 더 요청합니다. 동의해야 업데이트할 수 있습니다.",
      consentLeadNone: "‘{name}’ 은 특별한 권한을 요청하지 않습니다. 무결성만 확인하고 설치합니다.",
      consentAgree: "동의하고 설치",
      consentAgreeUpdate: "동의하고 업데이트",
      consentCancel: "취소",
      consentPerms: "요청 권한 {n}개",
      consentPermsOne: "요청 권한 {n}개",
      consentNewPerms: "새 권한 {n}개",
      consentNewPermsOne: "새 권한 {n}개",
      consentRisk: "위험도",
      consentNew: "새 권한",
      consentIntegrity: "무결성(SHA-256)",
      consentIntegrityNone: "값 없음 — 코드 검사만 합니다.",
      consentSandbox: "샌드박스",
      consentSandboxStrict: "엄격 — 선언·동의한 권한만 실행",
      consentSandboxStandard: "표준 — 선언한 권한만 실행",
      consentNote: "동의 기록과 무결성은 audit_logs(plugin_consent · plugin_integrity)에 남습니다.",
      consentDone: "권한에 동의하고 설치했습니다.",
      consentDoneUpdate: "권한에 동의하고 업데이트했습니다.",
      consentNeedSql: "Supabase 에 supabase/26_v105_plugin_security.sql 을 실행하면 동의 기록이 서버에 남습니다. 지금은 설치본에만 적었습니다.",
      grantedTag: "권한 {n}개 동의",
      grantedTagOne: "권한 {n}개 동의",
      grantedNone: "권한 동의 기록 없음",
      riskHigh: "높음",
      riskMid: "보통",
      riskLow: "낮음",
      areaRead: "읽기",
      areaUi: "화면",
      areaAdmin: "관리자",
      areaCss: "스타일",
      areaNav: "메뉴",
      areaOther: "기타",
      installedIntegrity: "설치본 무결성",
      sandboxMode: "샌드박스 모드",
      /* v10.6 — 플러그인 제출 · 자동 사전 점검 · 심사 큐 */
      subOpen: "플러그인 제출",
      subTitle: "플러그인 제출",
      subLead: "만든 플러그인을 마켓에 올려 달라고 요청합니다. 제출하면 자동 사전 점검(HTTPS·정적 코드 검사·SHA-256)을 거쳐 관리자 심사 큐에 들어갑니다.",
      subGate: "제출하려면 로그인이 필요합니다.",
      subGateLink: "로그인",
      subName: "이름",
      subSlug: "슬러그",
      subSlugHint: "영문 소문자·숫자·- _ . (플러그인 ID 로 씁니다)",
      subVersion: "버전",
      subSummary: "요약",
      subAuthor: "작성자",
      subEmail: "이메일(선택)",
      subUrl: "스크립트 URL",
      subUrlHint: "https:// 또는 사이트 안 경로(/)",
      subCategory: "카테고리",
      subHooks: "훅",
      subPerms: "요청 권한",
      subPermsHint: "다른 권한 이름은 쉼표로 이어 적습니다.",
      subCheck: "사전 점검만",
      subCheckRun: "점검 중…",
      subSubmit: "점검 후 제출",
      subSubmitting: "제출 중…",
      subCancel: "취소",
      subNeedName: "이름을 2자 이상 적어 주세요.",
      subNeedSlug: "슬러그는 영문 소문자·숫자·- _ . 로 2~60자입니다.",
      subNeedVersion: "버전은 1.0.0 처럼 숫자 세 칸으로 적어 주세요.",
      subNeedUrl: "스크립트 URL 은 https:// 또는 / 로 시작해야 합니다.",
      subNeedEmail: "이메일 주소 형식을 확인해 주세요.",
      subNeedLogin: "로그인 후 제출할 수 있습니다.",
      subDone: "제출했습니다. 관리자 심사 뒤 마켓에 올라갑니다.",
      subDoneLocal: "27_v106 SQL 을 실행하기 전이라 이 브라우저에만 저장했습니다. SQL 실행 뒤 다시 제출해 주세요.",
      subFail: "제출하지 못했습니다: ",
      subNeedSql: "supabase/27_v106_plugin_submissions.sql 을 실행하면 제출·심사를 서버에 저장합니다.",
      subCheckTitle: "자동 사전 점검",
      checkHttps: "HTTPS 주소",
      checkHttpsOk: "예",
      checkHttpsNo: "아니요",
      checkScan: "정적 코드 검사",
      checkScanClean: "위험한 호출 없음",
      checkScanWarn: "확인 필요 {n}건",
      checkScanNone: "파일을 읽지 못해 검사하지 못했습니다",
      checkSha: "SHA-256",
      checkShaNone: "계산하지 못함",
      checkShaCors: "외부 URL — 관리자 수동/로딩 시 검증",
      checkBytes: "크기",
      checkCors: "외부 주소라 브라우저에서 읽지 못했습니다(CORS). 관리자가 설치할 때 다시 검증합니다.",
      checkNoCrypto: "이 브라우저에서는 해시를 계산할 수 없습니다(HTTPS 필요).",
      finding1: "낮음",
      finding2: "중간",
      finding3: "높음",
      queueTitle: "제출 · 심사 큐",
      queueNote: "제출된 플러그인을 승인하면 마켓 항목으로 내보내고 바로 설치할 수 있습니다. 심사 결과는 audit_logs 에 plugin_submission_review 로 남습니다.",
      queueFilterPending: "대기",
      queueFilterApproved: "승인",
      queueFilterRejected: "반려",
      queueEmpty: "이 상태의 제출이 없습니다.",
      queueLoad: "불러오는 중…",
      queueMissing: "27_v106 SQL 을 실행하기 전입니다. 지금은 이 브라우저에서 제출한 것만 보입니다.",
      queueLocalBadge: "이 브라우저",
      queueBy: "제출",
      queueReviewed: "심사",
      queueApprove: "승인",
      queueReject: "반려",
      queueRejectGo: "반려 확정",
      queueRejectNote: "반려 사유(필수)",
      queueInstall: "바로 설치",
      queueCopy: "마켓 JSON 복사",
      queueExport: "JSON 내보내기",
      queueCopied: "마켓 JSON 항목을 복사했습니다.",
      queueCopiedFail: "복사하지 못했습니다 — 내보내기를 써 주세요.",
      queueApproved: "승인했습니다.",
      queueRejected: "반려했습니다.",
      queueRefresh: "새로고침",
      queueNeedNote: "반려 사유를 적어 주세요.",
      queueBad: "파일 해시가 제출 때와 다릅니다 — 설치를 막았습니다.",
      queueNeedSql: "27_v106 SQL 실행 전에는 서버 심사를 할 수 없습니다.",
      subPermNone: "요청 권한 없음",
      subIntegrity: "제출 시 무결성",
      subHooksNone: "선언한 훅 없음",
      subLocalNote: "이 브라우저에 저장됨",
      subDetailTitle: "제출 내용",
      scanEval: "동적 코드 실행(eval 호출)",
      scanNewFunction: "동적 코드 생성(Function 생성자)",
      scanCookie: "document.cookie 접근",
      scanScriptTag: "<script> 삽입",
      scanDocWrite: "문서 직접 쓰기(write 호출)",
      scanHttp: "http:// 주소",
      scanInnerHtml: "innerHTML 대입",
      scanStorage: "localStorage 사용",
      scanExternal: "외부 주소로 요청",
      /* v10.7 — 별점 · 리뷰 · 설치 통계 · 호환성 리포트 */
      ratingLabel: "평점",
      installsLabel: "설치",
      reviewsCount: "리뷰 {n}건",
      reviewOne: "리뷰 1건",
      noReviewsYet: "아직 리뷰 없음",
      installsCount: "설치 {n}",
      installsTitle: "마켓에서 설치한 수입니다.",
      ratingTitle: "공개 리뷰의 평균 별점입니다.",
      activeCount: "켜짐 {n}",
      sortRating: "평점 높은순",
      sortInstalls: "인기(설치)순",
      compatBadgeOk: "SBPress {v} 호환",
      compatWarn: "주의",
      compatUnverified: "미검증",
      compatBadgeTitle: "SBPress {v} 기준 호환성",
      compatMin: "최소",
      compatMax: "최대",
      compatVerifiedShort: "검증 v{v}",
      compatNotVerified: "재검사 전",
      compatLabel: "호환성",
      compatTitle: "호환성 리포트",
      compatLead: "설치된 플러그인과 마켓 플러그인을 현재 코어(v{v})와 견줍니다 — 최소·최대 SBPress 버전, 훅 API(blocksApi·securityApi), 최근 실행 오류를 한 목록으로 봅니다.",
      compatRun: "전체 호환성 재검사",
      compatRunning: "재검사하는 중…",
      compatSummary: "{n}개 검사 · 호환 {ok} · 주의 {warn} · 미검증 {unv} (코어 v{v})",
      compatDone: "{n}개를 재검사했습니다 — 호환 {ok} · 주의 {warn} · 미검증 {unv}.",
      compatSaveFailed: "서버에 {n}개를 저장하지 못했습니다.",
      compatNeedSql: "Supabase 에 supabase/28_v107_plugin_reviews_stats.sql 을 실행하면 재검사 결과가 서버에 남습니다. 지금은 이 브라우저에만 저장했습니다.",
      compatEmpty: "검사할 플러그인이 없습니다.",
      compatHooksShort: "훅 API",
      compatHooksOk: "선언한 요구 없음",
      compatHooksBad: "{a} {have}/{need}",
      compatVerified: "검증 버전 v{v}",
      compatErrors: "최근 오류 {n}건",
      compatFailed: "실행 실패로 꺼짐",
      compatMarketOnly: "마켓만",
      compatOk: "호환",
      reviewTitle: "리뷰",
      reviewWriteTitle: "리뷰 쓰기",
      reviewEditTitle: "내 리뷰 수정",
      reviewRating: "별점",
      reviewRateAria: "{n}점 주기",
      reviewTitleLabel: "제목 (선택)",
      reviewBodyLabel: "내용",
      reviewSave: "리뷰 저장",
      reviewUpdate: "리뷰 수정",
      reviewSaving: "저장하는 중…",
      reviewSaved: "리뷰를 저장했습니다.",
      reviewSavedLocal: "28_v107 SQL 을 실행하기 전이라 이 브라우저에만 저장했습니다.",
      reviewSaveFail: "리뷰를 저장하지 못했습니다: ",
      reviewLoadFail: "리뷰를 불러오지 못했습니다: ",
      reviewLoading: "리뷰를 불러오는 중…",
      reviewEmpty: "아직 리뷰가 없습니다. 첫 리뷰를 남겨 보세요.",
      reviewGate: "리뷰를 쓰려면 로그인이 필요합니다.",
      reviewGateLink: "로그인",
      reviewNeedLogin: "로그인 후 리뷰를 쓸 수 있습니다.",
      reviewNeedRating: "별점을 골라 주세요.",
      reviewNeedBody: "내용을 10자 이상 적어 주세요.",
      reviewMine: "내 리뷰",
      reviewHiddenBadge: "숨김",
      reviewHide: "숨기기",
      reviewRestore: "복원",
      reviewDelete: "삭제",
      reviewDeleteConfirm: "이 리뷰를 삭제할까요?",
      reviewHiddenDone: "리뷰를 숨겼습니다. 평균 별점에서 빠집니다.",
      reviewShownDone: "리뷰를 다시 공개했습니다.",
      reviewEdited: "수정됨",
      reviewNeedSql: "supabase/28_v107_plugin_reviews_stats.sql 을 실행하면 리뷰·통계가 서버에 저장됩니다. 지금은 이 브라우저에만 저장합니다.",
      statsLoadFail: "설치·평점 통계를 불러오지 못했습니다: ",
      statsNeedSql: "28_v107 SQL 을 실행하기 전이라 설치·평점 통계는 이 브라우저에만 쌓입니다.",
      installRecordFail: "설치 수를 서버에 남기지 못했습니다: ",
      /* v10.8 — theme market & industry bundle packs */
      tabsAria: "마켓 종류",
      tabPlugins: "플러그인",
      tabThemes: "테마 마켓",
      tabBundles: "업종별 번들 팩",
      tabStudio: "스튜디오",
      studioLoadFailed: "스튜디오 화면(assets/studio.js)을 불러오지 못했습니다. 새로고침해 주세요.",
      fIndustry: "업종",
      themesLead: "색·모서리·글꼴을 한 번에 바꾸는 테마입니다. 「미리보기」는 이 브라우저에만 잠시 보여 주고, 「테마 적용」은 관리자가 사이트 설정(테마 토큰)에 저장해 방문자 화면에도 바로 반영합니다.",
      bundlesLead: "업종별로 테마·플러그인·홈 블록 구성을 묶었습니다. 「번들 일괄 적용」에서 적용할 항목을 고르면 테마 저장과 플러그인 설치(권한 동의 포함), 홈 블록 프리셋 적용을 한 번에 합니다.",
      themesEmpty: "조건에 맞는 테마가 없습니다. 업종 필터를 바꿔 보세요.",
      bundlesEmpty: "조건에 맞는 번들이 없습니다. 업종 필터를 바꿔 보세요.",
      catNeedSql: "29_v108 SQL 을 실행하면 테마·번들 목록을 서버에서도 읽고 적용 기록을 남깁니다. 지금은 정적 목록(themes-market.json · bundles-market.json)으로 동작합니다.",
      fromDb: "서버",
      preview: "미리보기",
      previewStop: "미리보기 종료",
      previewing: "‘{name}’ 미리보기 중",
      previewNote: "이 브라우저에만 보이는 임시 모습입니다.",
      themeApply: "테마 적용",
      themeApplying: "적용하는 중…",
      themeApplied: "‘{name}’ 테마를 저장하고 바로 적용했습니다.",
      themeApplyFail: "테마를 적용하지 못했습니다: ",
      applyAdminOnly: "적용은 관리자 화면에서만 할 수 있습니다.",
      radiusShort: "모서리 {n}px",
      bundleTheme: "테마",
      bundlePlugins: "플러그인",
      bundleBlocks: "홈 블록",
      bundleNoTheme: "테마 없음",
      bundleApply: "번들 일괄 적용",
      bundleView: "구성 보기",
      bundleViewNote: "구성만 보는 화면입니다. 적용은 관리자 화면에서 할 수 있습니다.",
      bundleModalTitle: "‘{name}’ 일괄 적용",
      bndTheme: "테마 적용",
      bndPlugins: "플러그인 설치",
      bndPluginsNote: "설치 예정 {n}개 · 포함 {t}개",
      bndInstalled: "설치됨",
      bndWillInstall: "설치 예정",
      bndPermsHead: "설치할 플러그인이 요청하는 권한",
      bndPermsNote: "설치할 때 이 권한을 한 번에 확인합니다. 권한 동의와 무결성 검사는 v10.5 방식 그대로입니다.",
      bndBlocks: "홈 블록 프리셋",
      bndBlocksNote: "블록 {n}개",
      bndBlocksHint: "지금 홈 블록(site_contents 의 home.blocks)을 이 구성으로 바꿉니다. 이전 구성은 이 브라우저에 백업합니다.",
      bndNoPerms: "설치할 플러그인이 없습니다.",
      bndGo: "적용하기",
      bndRunning: "적용하는 중…",
      bndStepTheme: "테마를 저장하는 중…",
      bndStepPlugin: "플러그인을 설치하는 중… ({i}/{n}) {name}",
      bndStepBlocks: "홈 블록 프리셋을 적용하는 중…",
      bndDone: "번들을 적용했습니다 — {list}",
      bndDoneTheme: "테마 ‘{name}’",
      bndDonePlugins: "플러그인 {n}개 설치",
      bndDoneBlocks: "홈 블록 {n}개",
      bndFail: "번들을 적용하지 못했습니다: ",
      bndFlash: "‘{name}’ 번들을 적용했습니다.",
      bndPickOne: "적용할 항목을 하나 이상 골라 주세요.",
      bndAdminOnly: "번들 적용은 관리자 화면에서만 할 수 있습니다.",
      /* v10.10 — 유료 · 라이선스 · 중앙 마켓 허브 */
      fPrice: "가격",
      priceFree: "무료",
      pricePaid: "유료",
      priceFreeTag: "무료",
      licTag: "라이선스",
      priceLabel: "가격",
      planLabel: "플랜",
      licStateLabel: "라이선스",
      licStateNone: "아직 확인하지 않았습니다",
      licStateOk: "확인됨 · {plan}",
      licOpen: "라이선스 키 입력",
      licChange: "라이선스 키 다시 입력",
      licTitle: "라이선스 키 확인",
      licLead: "‘{name}’ 은(는) 유료 플러그인입니다. 발급받은 라이선스 키를 확인한 뒤 권한 동의로 이어집니다.",
      licKeyLabel: "라이선스 키",
      licKeyPh: "SBP-XXXX-XXXX-XXXX-XXXX",
      licVerify: "키 확인",
      licChecking: "확인하는 중…",
      licCancel: "취소",
      licBadFormat: "라이선스 키 형식이 올바르지 않습니다(SBP-XXXX-XXXX-XXXX-XXXX).",
      licOk: "라이선스를 확인했습니다 · {plan}",
      licFail: "라이선스를 확인하지 못했습니다: ",
      licNeedKey: "라이선스 키를 입력해 주세요.",
      licSite: "사이트",
      licUsed: "사용 {n}/{m}곳",
      licExpires: "만료",
      licNoExpire: "무기한",
      licNote: "키는 설치하는 사이트에서만 확인되고, 확인 기록은 audit_logs 에 남습니다. 목록은 관리자만 볼 수 있습니다.",
      licLocalOk: "서버 없이 이 브라우저에서 확인했습니다. 31_v1010 SQL 을 실행하면 서버에 남습니다.",
      /* 라이선스 · 허브 서브탭 */
      tabLicenses: "라이선스 · 허브",
      hubTitle: "라이선스 · 중앙 마켓 허브",
      hubNote: "연결한 마켓과 이 사이트의 플러그인·테마·번들을 한눈에 보고, hub-manifest.json 을 내보내 다른 SBPress 사이트가 그대로 구독하게 합니다. 라이선스 키는 여기서 발급하고 폐기합니다.",
      hubMarkets: "연결된 마켓",
      hubPlugins: "플러그인",
      hubThemes: "테마",
      hubBundles: "번들",
      hubPending: "승인 대기",
      hubActive: "활성 라이선스",
      hubCopy: "허브 JSON 복사",
      hubDownload: "hub-manifest.json 내려받기",
      hubRefresh: "새로고침",
      hubCopied: "hub-manifest.json 을 클립보드에 복사했습니다.",
      hubCopyFail: "복사하지 못했습니다. 「내려받기」를 써 주세요.",
      hubDownloaded: "hub-manifest.json 을 내려받았습니다.",
      hubVersion: "SBPress",
      licIssueTitle: "라이선스 발급",
      licIssueNote: "플러그인과 플랜, 소유자, 최대 사이트 수, 만료일을 정하고 키를 발급합니다. 발급 기록은 audit_logs(license_issue)에 남습니다.",
      licSlug: "플러그인",
      licPlan: "플랜",
      licHolder: "소유자",
      licHolderPh: "이름 또는 단체",
      licEmail: "소유자 이메일",
      licSites: "최대 사이트 수",
      licExpiresLabel: "만료일",
      licIssue: "키 발급",
      licIssuing: "발급하는 중…",
      licIssued: "키를 발급했습니다: {key}",
      licIssueFail: "키를 발급하지 못했습니다: ",
      licListTitle: "발급한 라이선스",
      licListEmpty: "아직 발급한 라이선스가 없습니다.",
      licRefresh: "목록 새로고침",
      licLoading: "라이선스를 불러오는 중…",
      licCopy: "키 복사",
      licCopied: "라이선스 키를 복사했습니다.",
      licRevoke: "폐기",
      licRestore: "되살리기",
      licStatusActive: "활성",
      licStatusExpired: "만료",
      licStatusRevoked: "폐기",
      licChanged: "‘{key}’ 상태를 {status} 로 바꿨습니다.",
      licChangeFail: "상태를 바꾸지 못했습니다: ",
      licNeedSql: "31_v1010 SQL 을 실행하면 라이선스가 서버(plugin_licenses)에 남습니다. 지금은 이 브라우저에만 기억합니다.",
      licLocalOnly: "이 브라우저에만 저장됨",
      licPlanFree: "무료",
      licNoPlugin: "발급할 플러그인이 없습니다 — 마켓 목록을 먼저 불러와 주세요."
    },
    en: {
      eyebrow: "PLUGIN MARKET",
      title: "SBPress plugin market",
      lead: "Plugins that add features to an SBPress site. Search by name or tag, then open a card for screenshots, required permissions and release notes. Installing is available in the admin screen only.",
      search: "Search name, description, tag or author",
      searchAria: "Search the market",
      sort: "Sort",
      sortAria: "Sort order",
      sortRecommend: "Recommended",
      sortLatest: "Recently updated",
      sortName: "Name",
      fCategory: "Category",
      fHook: "Hook",
      fTag: "Tag",
      all: "All",
      count: "{m} shown · {n} in total",
      empty: "No plugin matches these filters. Try another search or filter.",
      emptyMarket: "The market has no plugins yet. Check the market address.",
      loading: "Loading the market…",
      failed: "Could not load the market: ",
      retry: "Try again",
      detail: "View details",
      detailShort: "Details",
      detailsOf: "View details of {name}",
      close: "Close",
      version: "Version",
      author: "Author",
      updated: "Updated",
      /* v10.3 — version compare, update, rollback */
      updAvail: "Update available (v{x} → v{y})",
      updNow: "Update available",
      updBar: "{n} update available",
      updBarNote: "Installed plugins below the latest market version are listed here.",
      updAll: "Update all",
      updAllBusy: "Updating… ({i}/{n})",
      updAllDone: "Updated {n} plugins.",
      updAllFailed: "Could not update {n} plugins.",
      updAllSkipped: "{n} plugins were skipped because they ask for new permissions. Use “Agree and update” on each card.",
      updateNow: "Update",
      updating: "Updating…",
      updatedDone: "Updated to v{v}.",
      updateFailed: "Could not update: ",
      latestTag: "Latest",
      olderTag: "Installed copy is newer (v{x})",
      changesTitle: "What this update changes",
      changesNone: "No release notes are recorded after v{v}.",
      historyTitle: "Version history",
      historyEmpty: "No earlier version is kept yet.",
      historyLeft: "{n} earlier versions kept",
      rollback: "Roll back to the previous version",
      rollbackShort: "Roll back",
      rollbackTitle: "Roll back to the previous version",
      rollbackLead: "Rolls “{name}” back from v{cur} to v{prev}, together with its code, manifest and settings schema.",
      rollbackKeep: "Posts, photos and saved settings stay as they are; only the plugin rolls back.",
      rollbackGo: "Roll back to v{prev}",
      rollbackCancel: "Cancel",
      rollbackBusy: "Rolling back…",
      rollbackDone: "Rolled back to v{prev}.",
      rollbackFailed: "Could not roll back: ",
      rollbackNone: "No earlier version to roll back to.",
      pinnedNote: "Version pinned (v{v}) — unpin it to update.",
      pinnedTag: "Pinned",
      needSqlVersions: "Run supabase/24_v103_plugin_versions.sql in Supabase to keep earlier versions and roll back. For now the update is applied without a snapshot.",
      versionHint: "Versions compare as three numbers, such as 1.2.0.",
      minVersion: "Minimum SBPress",
      currentVersion: "current {v}",
      compatOk: "Compatible",
      compatNo: "Needs v{v}+",
      category: "Category",
      hooks: "Hooks",
      tags: "Tags",
      permissions: "Permissions",
      noPermissions: "This plugin requests no special permissions.",
      changelog: "Release notes",
      noChangelog: "No release notes recorded.",
      shots: "Preview",
      noShot: "No preview image.",
      install: "Install and enable",
      installing: "Installing…",
      turnOn: "Turn on",
      turnOff: "Turn off",
      update: "Update to v{v}",
      remove: "Remove",
      installedOn: "Installed · on",
      installedOff: "Installed · off",
      adminOnly: "Installing, turning on and removing can be done in the admin screen only.",
      goAdmin: "Manage in admin",
      unknownPerm: "A permission this plugin asks for.",
      screenshotAlt: "{name} preview",
      /* v10.2 — plugin settings */
      settings: "Settings",
      settingsOf: "Settings for {name}",
      settingsLead: "Change how this plugin behaves. Saving applies it to the site and this screen right away.",
      settingsAdminOnly: "Settings can be changed in the admin screen only.",
      save: "Save",
      saving: "Saving…",
      saved: "Saved. Applied to the site right away.",
      saveFailed: "Could not save: ",
      restore: "Restore defaults",
      restoring: "Restoring defaults…",
      restored: "Restored the defaults.",
      restoreConfirm: "Reset every setting of this plugin to its default?",
      noChanges: "Nothing has changed.",
      defaultTag: "default",
      colorClear: "Theme color",
      needSql: "Could not save. Run supabase/23_v102_plugin_settings.sql in Supabase, then try again.",
      noSchema: "This plugin has no settings to change.",
      invalidNumber: "Enter a number: ",
      outOfRange: "An out-of-range value is moved to the nearest allowed value: ",
      enabledNote: "A plugin that is off is applied to the site only after you turn it on.",
      fieldCheck: "Check this value again: ",
      on: "On",
      off: "Off",
      /* v10.4 — subscribed markets · custom blocks */
      fMarket: "Market",
      allMarkets: "All markets",
      srcOfficial: "Official",
      srcMarket: "Subscribed",
      marketOfficialName: "Official market",
      srcBadge: "{name}",
      marketPanel: "Subscribed markets",
      marketPanelNote: "Collects the plugins.json of several markets into one list. Addresses must start with https:// or be a site path (/). The official market cannot be turned off or deleted.",
      marketAddName: "Market name",
      marketAddUrl: "Market JSON address",
      marketAdd: "Add market",
      marketAddBusy: "Checking…",
      marketOfficial: "Official",
      marketToggleOn: "Turn off",
      marketToggleOff: "Turn on",
      marketSync: "Sync",
      marketSyncBusy: "Syncing…",
      marketRemove: "Delete",
      marketRemoveConfirm: "Delete the “{name}” market? Plugins already installed stay.",
      marketCannotRemoveOfficial: "The official market cannot be deleted.",
      marketCannotToggleOfficial: "The official market cannot be turned off.",
      marketCount: "{n} plugins",
      marketSyncAt: "Last synced {t}",
      marketNever: "Not synced yet",
      marketError: "Could not read: ",
      marketEmpty: "No markets subscribed.",
      marketAdded: "Added the market: {name}",
      marketRemoved: "Deleted the market: {name}",
      marketToggled: "“{name}” market turned {state}.",
      marketSynced: "Synced “{name}” · {n} plugins",
      marketNeedSql: "Run supabase/25_v104_multimarket_blocks.sql in Supabase to store subscribed markets on the server. For now they are remembered in this browser only.",
      marketBadUrl: "A market address must start with https:// or be a site path (/).",
      marketBadSchema: "No plugin list (plugins) found in the market JSON: ",
      marketDupNote: "{n} plugins share an ID with another market; the earlier market (official first) is used.",
      pluginBadge: "Plugin block",
      /* v10.5 — permission consent · SHA-256 integrity · sandbox */
      trustTitle: "Security · integrity",
      integrity: "Integrity",
      integrityOk: "SHA-256 verified",
      integrityOkShort: "SHA-256",
      integrityNone: "No integrity value",
      integrityBad: "Blocked — integrity error",
      integrityUnchecked: "Integrity not checked",
      integrityChecking: "Checking integrity…",
      integrityRecheck: "Check integrity again",
      integrityRechecking: "Checking again…",
      integrityRechecked: "Integrity checked again — the file is unchanged.",
      integrityMismatch: "The integrity check failed — the file may have changed, so it was not run or installed.",
      integrityBlocked: "This plugin cannot be installed until the integrity check passes. Use “Check integrity again”.",
      integrityNeedSql: "Run supabase/26_v105_plugin_security.sql in Supabase to store integrity and consent on the server. For now they are remembered in this browser only.",
      integrityHint: "Re-hashes the downloaded file bytes in the browser and compares them with the sha256-… value in the market JSON.",
      consentTitle: "Review the permissions",
      consentTitleNew: "Review the new permissions",
      consentTitleUpdate: "Review permissions and update",
      consentLead: "“{name}” asks for the permissions below. Hooks outside the permissions you agree to are not run.",
      consentLeadNew: "The new version of “{name}” asks for the additional permissions below. Agree to continue the update.",
      consentLeadNone: "“{name}” asks for no special permissions. Only its integrity is checked before installing.",
      consentAgree: "Agree and install",
      consentAgreeUpdate: "Agree and update",
      consentCancel: "Cancel",
      consentPerms: "{n} permissions requested",
      consentPermsOne: "{n} permission requested",
      consentNewPerms: "{n} new permissions",
      consentNewPermsOne: "{n} new permission",
      consentRisk: "Risk",
      consentNew: "New",
      consentIntegrity: "Integrity (SHA-256)",
      consentIntegrityNone: "No value — code scan only.",
      consentSandbox: "Sandbox",
      consentSandboxStrict: "Strict — only declared, agreed permissions run",
      consentSandboxStandard: "Standard — only declared permissions run",
      consentNote: "Consent and integrity are recorded in audit_logs (plugin_consent · plugin_integrity).",
      consentDone: "Agreed to the permissions and installed.",
      consentDoneUpdate: "Agreed to the permissions and updated.",
      consentNeedSql: "Run supabase/26_v105_plugin_security.sql in Supabase to record consent on the server. For now it was written to the installed row only.",
      grantedTag: "{n} permissions agreed",
      grantedTagOne: "{n} permission agreed",
      grantedNone: "No consent recorded",
      riskHigh: "High",
      riskMid: "Medium",
      riskLow: "Low",
      areaRead: "Reading",
      areaUi: "Interface",
      areaAdmin: "Admin",
      areaCss: "Styles",
      areaNav: "Menu",
      areaOther: "Other",
      installedIntegrity: "Installed integrity",
      sandboxMode: "Sandbox mode",
      /* v10.6 — plugin submission · auto pre-check · review queue */
      subOpen: "Submit a plugin",
      subTitle: "Submit a plugin",
      subLead: "Ask for your plugin to be listed in the market. Submitting runs an automatic pre-check (HTTPS, static code scan, SHA-256) and puts it in the admin review queue.",
      subGate: "Sign in to submit a plugin.",
      subGateLink: "Sign in",
      subName: "Name",
      subSlug: "Slug",
      subSlugHint: "lowercase letters, digits, - _ . (used as the plugin ID)",
      subVersion: "Version",
      subSummary: "Summary",
      subAuthor: "Author",
      subEmail: "Email (optional)",
      subUrl: "Script URL",
      subUrlHint: "https:// or a site path (/)",
      subCategory: "Category",
      subHooks: "Hooks",
      subPerms: "Requested permissions",
      subPermsHint: "Add other permission names separated by commas.",
      subCheck: "Pre-check only",
      subCheckRun: "Checking…",
      subSubmit: "Pre-check and submit",
      subSubmitting: "Submitting…",
      subCancel: "Cancel",
      subNeedName: "Enter a name of at least 2 characters.",
      subNeedSlug: "The slug is 2-60 lowercase letters, digits or - _ .",
      subNeedVersion: "Write the version as three numbers, such as 1.0.0.",
      subNeedUrl: "The script URL must start with https:// or /.",
      subNeedEmail: "Check the email address format.",
      subNeedLogin: "Sign in before submitting.",
      subDone: "Submitted. It goes into the market after an admin review.",
      subDoneLocal: "Saved in this browser only — run the 27_v106 SQL, then submit again to store it on the server.",
      subFail: "Could not submit: ",
      subNeedSql: "Run supabase/27_v106_plugin_submissions.sql to store submissions and reviews on the server.",
      subCheckTitle: "Automatic pre-check",
      checkHttps: "HTTPS address",
      checkHttpsOk: "Yes",
      checkHttpsNo: "No",
      checkScan: "Static code scan",
      checkScanClean: "No risky calls found",
      checkScanWarn: "{n} to review",
      checkScanNone: "Not run — the file could not be read",
      checkSha: "SHA-256",
      checkShaNone: "Not computed",
      checkShaCors: "External URL — verified manually or when loaded",
      checkBytes: "Size",
      checkCors: "An external address could not be read in the browser (CORS). The admin re-checks it at install time.",
      checkNoCrypto: "This browser cannot compute a hash (HTTPS is required).",
      finding1: "Low",
      finding2: "Medium",
      finding3: "High",
      queueTitle: "Submissions · review queue",
      queueNote: "Approve a submission to export it as a market item and install it right away. Every review is recorded in audit_logs as plugin_submission_review.",
      queueFilterPending: "Pending",
      queueFilterApproved: "Approved",
      queueFilterRejected: "Rejected",
      queueEmpty: "No submissions in this state.",
      queueLoad: "Loading…",
      queueMissing: "The 27_v106 SQL has not been run yet. Only what this browser submitted is shown.",
      queueLocalBadge: "This browser",
      queueBy: "Submitted by",
      queueReviewed: "Reviewed",
      queueApprove: "Approve",
      queueReject: "Reject",
      queueRejectGo: "Confirm rejection",
      queueRejectNote: "Reason for rejection (required)",
      queueInstall: "Install now",
      queueCopy: "Copy market JSON",
      queueExport: "Export JSON",
      queueCopied: "Copied the market JSON item.",
      queueCopiedFail: "Could not copy — use Export JSON instead.",
      queueApproved: "Approved.",
      queueRejected: "Rejected.",
      queueRefresh: "Refresh",
      queueNeedNote: "Write a reason for the rejection.",
      queueBad: "The file hash differs from the submission — the install is blocked.",
      queueNeedSql: "Reviews need the 27_v106 SQL on the server.",
      subPermNone: "No permissions requested",
      subIntegrity: "Integrity at submission",
      subHooksNone: "No hooks declared",
      subLocalNote: "Saved in this browser",
      subDetailTitle: "Submission",
      scanEval: "dynamic code execution (eval call)",
      scanNewFunction: "dynamic code (Function constructor)",
      scanCookie: "document.cookie access",
      scanScriptTag: "<script> injection",
      scanDocWrite: "direct document write call",
      scanHttp: "http:// address",
      scanInnerHtml: "innerHTML assignment",
      scanStorage: "localStorage use",
      scanExternal: "fetch to another host",
      /* v10.7 — ratings, reviews, install stats, compatibility report */
      ratingLabel: "Rating",
      installsLabel: "Installs",
      reviewsCount: "{n} reviews",
      reviewOne: "1 review",
      noReviewsYet: "No reviews yet",
      installsCount: "{n} installs",
      installsTitle: "How many times this plugin was installed from the market.",
      ratingTitle: "Average rating of published reviews.",
      activeCount: "{n} on",
      sortRating: "Highest rated",
      sortInstalls: "Most installed",
      compatBadgeOk: "SBPress {v} compatible",
      compatWarn: "Check",
      compatUnverified: "Not verified",
      compatBadgeTitle: "Compatibility with SBPress {v}",
      compatMin: "min",
      compatMax: "max",
      compatVerifiedShort: "verified v{v}",
      compatNotVerified: "not re-checked",
      compatLabel: "Compatibility",
      compatTitle: "Compatibility report",
      compatLead: "Checks installed and market plugins against the current core (v{v}) — minimum and maximum SBPress version, hook APIs (blocksApi, securityApi) and recent runtime errors in one list.",
      compatRun: "Re-check all compatibility",
      compatRunning: "Re-checking…",
      compatSummary: "{n} checked · {ok} compatible · {warn} to check · {unv} not verified (core v{v})",
      compatDone: "Re-checked {n} plugins — {ok} compatible · {warn} to check · {unv} not verified.",
      compatSaveFailed: "Could not save {n} results on the server.",
      compatNeedSql: "Run supabase/28_v107_plugin_reviews_stats.sql in Supabase to store the results on the server. For now they are kept in this browser only.",
      compatEmpty: "No plugins to check.",
      compatHooksShort: "Hook API",
      compatHooksOk: "no requirement declared",
      compatHooksBad: "{a} {have}/{need}",
      compatVerified: "Verified version v{v}",
      compatErrors: "{n} recent errors",
      compatFailed: "turned off after a failure",
      compatMarketOnly: "market only",
      compatOk: "Compatible",
      reviewTitle: "Reviews",
      reviewWriteTitle: "Write a review",
      reviewEditTitle: "Edit my review",
      reviewRating: "Rating",
      reviewRateAria: "Give {n} stars",
      reviewTitleLabel: "Title (optional)",
      reviewBodyLabel: "Review",
      reviewSave: "Save review",
      reviewUpdate: "Update review",
      reviewSaving: "Saving…",
      reviewSaved: "Your review was saved.",
      reviewSavedLocal: "The 28_v107 SQL has not been run yet, so the review was saved in this browser only.",
      reviewSaveFail: "Could not save the review: ",
      reviewLoadFail: "Could not load reviews: ",
      reviewLoading: "Loading reviews…",
      reviewEmpty: "No reviews yet. Be the first to write one.",
      reviewGate: "Sign in to write a review.",
      reviewGateLink: "Sign in",
      reviewNeedLogin: "Sign in before writing a review.",
      reviewNeedRating: "Choose a star rating.",
      reviewNeedBody: "Write at least 10 characters.",
      reviewMine: "My review",
      reviewHiddenBadge: "Hidden",
      reviewHide: "Hide",
      reviewRestore: "Restore",
      reviewDelete: "Delete",
      reviewDeleteConfirm: "Delete this review?",
      reviewHiddenDone: "Review hidden. It is left out of the average rating.",
      reviewShownDone: "Review published again.",
      reviewEdited: "edited",
      reviewNeedSql: "Run supabase/28_v107_plugin_reviews_stats.sql to store reviews and stats on the server. For now they are kept in this browser only.",
      statsLoadFail: "Could not load install and rating stats: ",
      statsNeedSql: "The 28_v107 SQL has not been run, so install and rating stats are kept in this browser only.",
      installRecordFail: "Could not record the install count: ",
      /* v10.8 — theme market & industry bundle packs */
      tabsAria: "Market sections",
      tabPlugins: "Plugins",
      tabThemes: "Theme market",
      tabBundles: "Bundle packs",
      tabStudio: "Studio",
      studioLoadFailed: "Could not load the studio (assets/studio.js). Please reload.",
      fIndustry: "Industry",
      themesLead: "Themes that change colours, corners and type at once. “Preview” shows them in this browser only; “Apply theme” saves them to the site's theme tokens so visitors see them too.",
      bundlesLead: "Industry packs that group a theme, plugins and a home block layout. In “Apply bundle” pick what to apply and the site saves the theme, installs the plugins (with permission consent) and applies the home block preset in one step.",
      themesEmpty: "No theme matches. Try another industry.",
      bundlesEmpty: "No bundle matches. Try another industry.",
      catNeedSql: "Run 29_v108 SQL to read the theme and bundle lists from the server and record applies. For now the static lists (themes-market.json · bundles-market.json) are used.",
      fromDb: "Server",
      preview: "Preview",
      previewStop: "End preview",
      previewing: "Previewing “{name}”",
      previewNote: "Shown in this browser only.",
      themeApply: "Apply theme",
      themeApplying: "Applying…",
      themeApplied: "Saved and applied the “{name}” theme.",
      themeApplyFail: "Could not apply the theme: ",
      applyAdminOnly: "Only an admin can apply a theme.",
      radiusShort: "corners {n}px",
      bundleTheme: "Theme",
      bundlePlugins: "Plugins",
      bundleBlocks: "Home blocks",
      bundleNoTheme: "No theme",
      bundleApply: "Apply bundle",
      bundleView: "See contents",
      bundleViewNote: "This is a read-only view. Applying needs an admin.",
      bundleModalTitle: "Apply “{name}”",
      bndTheme: "Apply theme",
      bndPlugins: "Install plugins",
      bndPluginsNote: "{n} to install · {t} in the pack",
      bndInstalled: "Installed",
      bndWillInstall: "Will install",
      bndPermsHead: "Permissions the plugins ask for",
      bndPermsNote: "These permissions are reviewed once at install. Consent and integrity checks work exactly as in v10.5.",
      bndBlocks: "Home block preset",
      bndBlocksNote: "{n} blocks",
      bndBlocksHint: "Replaces the current home blocks (home.blocks in site_contents) with this layout. The previous layout is backed up in this browser.",
      bndNoPerms: "No plugin to install.",
      bndGo: "Apply",
      bndRunning: "Applying…",
      bndStepTheme: "Saving the theme…",
      bndStepPlugin: "Installing plugins… ({i}/{n}) {name}",
      bndStepBlocks: "Applying the home block preset…",
      bndDone: "Bundle applied — {list}",
      bndDoneTheme: "theme “{name}”",
      bndDonePlugins: "{n} plugins installed",
      bndDoneBlocks: "{n} home blocks",
      bndFail: "Could not apply the bundle: ",
      bndFlash: "Applied the “{name}” bundle.",
      bndPickOne: "Choose at least one item to apply.",
      bndAdminOnly: "Only an admin can apply a bundle.",
      /* v10.10 — paid · license · central market hub */
      fPrice: "Price",
      priceFree: "Free",
      pricePaid: "Paid",
      priceFreeTag: "Free",
      licTag: "License",
      priceLabel: "Price",
      planLabel: "Plan",
      licStateLabel: "License",
      licStateNone: "Not verified yet",
      licStateOk: "Verified · {plan}",
      licOpen: "Enter license key",
      licChange: "Enter another license key",
      licTitle: "Verify license key",
      licLead: "“{name}” is a paid plugin. Verify the license key you were issued, then the permission consent follows.",
      licKeyLabel: "License key",
      licKeyPh: "SBP-XXXX-XXXX-XXXX-XXXX",
      licVerify: "Verify key",
      licChecking: "Verifying…",
      licCancel: "Cancel",
      licBadFormat: "That is not a valid license key (SBP-XXXX-XXXX-XXXX-XXXX).",
      licOk: "License verified · {plan}",
      licFail: "Could not verify the license: ",
      licNeedKey: "Enter a license key.",
      licSite: "Site",
      licUsed: "{n}/{m} sites used",
      licExpires: "Expires",
      licNoExpire: "No expiry",
      licNote: "The key is checked on the site that installs the plugin and the check is written to audit_logs. Only an admin can see the list.",
      licLocalOk: "Verified in this browser without a server. Run 31_v1010 SQL to keep it on the server.",
      tabLicenses: "License · hub",
      hubTitle: "Licenses · central market hub",
      hubNote: "See the markets you subscribe to and this site's plugins, themes and bundles at a glance, then export hub-manifest.json so another SBPress site can subscribe to the same set. Issue and revoke license keys here.",
      hubMarkets: "Markets",
      hubPlugins: "Plugins",
      hubThemes: "Themes",
      hubBundles: "Bundles",
      hubPending: "Pending review",
      hubActive: "Active licenses",
      hubCopy: "Copy hub JSON",
      hubDownload: "Download hub-manifest.json",
      hubRefresh: "Refresh",
      hubCopied: "hub-manifest.json copied to the clipboard.",
      hubCopyFail: "Could not copy. Use “Download” instead.",
      hubDownloaded: "hub-manifest.json downloaded.",
      hubVersion: "SBPress",
      licIssueTitle: "Issue a license",
      licIssueNote: "Choose the plugin, plan, holder, site limit and expiry, then issue the key. The issue is recorded in audit_logs (license_issue).",
      licSlug: "Plugin",
      licPlan: "Plan",
      licHolder: "Holder",
      licHolderPh: "Name or organisation",
      licEmail: "Holder email",
      licSites: "Max sites",
      licExpiresLabel: "Expires on",
      licIssue: "Issue key",
      licIssuing: "Issuing…",
      licIssued: "Key issued: {key}",
      licIssueFail: "Could not issue the key: ",
      licListTitle: "Issued licenses",
      licListEmpty: "No license has been issued yet.",
      licRefresh: "Reload list",
      licLoading: "Loading licenses…",
      licCopy: "Copy key",
      licCopied: "License key copied.",
      licRevoke: "Revoke",
      licRestore: "Restore",
      licStatusActive: "Active",
      licStatusExpired: "Expired",
      licStatusRevoked: "Revoked",
      licChanged: "“{key}” is now {status}.",
      licChangeFail: "Could not change the status: ",
      licNeedSql: "Run 31_v1010 SQL to keep licenses on the server (plugin_licenses). Until then they stay in this browser only.",
      licLocalOnly: "Saved in this browser only",
      licPlanFree: "Free",
      licNoPlugin: "No plugin to issue a license for — load the market list first."
    }
  };

  /* 자주 쓰는 권한 설명 — 플러그인이 처음 보이는 이름이면 아래 문장으로 풀어 씁니다. */
  var PERM = {
    "read:card-text": { ko: "카드의 제목·글자 수를 읽습니다.", en: "Reads card titles and character counts." },
    "read:posts": { ko: "게시글 목록을 읽습니다(공개된 글만).", en: "Reads the post list (published posts only)." },
    "read:admin-lists": { ko: "관리자 목록(글·페이지)을 읽습니다.", en: "Reads the admin lists of posts and pages." },
    "ui:floating": { ko: "화면 위에 떠 있는 버튼을 그립니다.", en: "Draws a button floating over the page." },
    "ui:home-top": { ko: "홈 맨 위에 배너 영역을 그립니다.", en: "Draws a banner area at the top of home." },
    "css:inject": { ko: "사이트에 스타일(CSS)을 더합니다.", en: "Adds style rules (CSS) to the site." },
    "nav:menu": { ko: "헤더 메뉴에 항목을 더합니다.", en: "Adds an item to the header menu." },
    "ui:block": { ko: "hunmin 페이지에 블록을 그립니다.", en: "Draws a block on hunmin pages." },
    "read:block-data": { ko: "관리자가 입력한 블록 값을 읽습니다.", en: "Reads the block values the admin entered." },
    "ui:home-bottom": { ko: "홈 아래에 패널을 그립니다.", en: "Draws a panel at the bottom of home." },
    "read:admin": { ko: "관리자 화면의 목록을 읽습니다.", en: "Reads admin lists." },
    "ui:admin": { ko: "관리자 화면에 탭을 더합니다.", en: "Adds a tab to the admin screen." }
  };

  var CAT_FALLBACK = {
    content: { ko: "콘텐츠 꾸미기", en: "Content" },
    navigation: { ko: "내비게이션", en: "Navigation" },
    widget: { ko: "위젯·홈", en: "Widgets & home" },
    admin: { ko: "관리자 도구", en: "Admin tools" },
    accessibility: { ko: "읽기·접근성", en: "Reading & accessibility" }
  };

  /* ---------------- 작은 도우미 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function currentLang() {
    try {
      if (window.ADMIN_I18N && window.ADMIN_I18N.lang) return window.ADMIN_I18N.lang() === "en" ? "en" : "ko";
    } catch (e) { /* noop */ }
    try {
      if (window.CRAFT_I18N && window.CRAFT_I18N.isEn) return window.CRAFT_I18N.isEn() ? "en" : "ko";
    } catch (e) { /* noop */ }
    try { return String(localStorage.getItem("craft-lang") || "").toLowerCase() === "en" ? "en" : "ko"; }
    catch (e) { return "ko"; }
  }

  function tr(lang, key, vars) {
    var s = (L[lang] && L[lang][key] != null) ? L[lang][key] : (L.ko[key] != null ? L.ko[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function abs(src, base) {
    var s = String(src == null ? "" : src).trim();
    if (!s) return "";
    try {
      var u = new URL(s, new URL(String(base || location.href), location.href));
      if (u.origin === location.origin) return u.pathname + u.search + u.hash;
      return u.href;
    } catch (e) { return s; }
  }

  function verNum(v) {
    var p = String(v == null ? "" : v).replace(/^v/i, "").split(".");
    return (parseInt(p[0], 10) || 0) * 10000 + (parseInt(p[1], 10) || 0) * 100 + (parseInt(p[2], 10) || 0);
  }

  /* v10.3 — 버전 비교 유틸. "1.2.0" 처럼 숫자를 점으로 나눈 버전을 칸별로 비교합니다.
     1.2.0 > 1.1.0, 1.10.0 > 1.9.9, 2.0 > 1.9.9 (빠진 칸은 0). 앞의 v 는 무시합니다.
     같은 번호면 0, a 가 크면 1, b 가 크면 -1 을 돌려줍니다. */
  function verParts(v) {
    var raw = String(v == null ? "" : v).replace(/^v/i, "").trim();
    if (!raw) return [0, 0, 0];
    var out = [];
    raw.split(".").forEach(function (x) {
      var n = parseInt(String(x).replace(/[^0-9].*$/, ""), 10);
      out.push(isFinite(n) ? n : 0);
    });
    while (out.length < 3) out.push(0);
    return out.slice(0, 4);
  }

  function cmpVer(a, b) {
    var x = verParts(a), y = verParts(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var p = x[i] || 0, q = y[i] || 0;
      if (p > q) return 1;
      if (p < q) return -1;
    }
    return 0;
  }

  function vtag(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    return /^v/i.test(s) ? s : "v" + s;
  }

  /* 설치된 행과 마켓 항목의 버전을 견줍니다. 설치하지 않았으면 null. */
  function updInfo(inst, p) {
    var row = installedRow(inst, p ? p.id : "");
    if (!row) return null;
    var cur = String(row.version == null ? "" : row.version).trim();
    var next = String(p && p.version != null ? p.version : "").trim();
    var c = cmpVer(next, cur);
    var hist = Array.isArray(row.version_history) ? row.version_history : [];
    var prev = String(row.previous_version == null ? "" : row.previous_version).trim();
    if (!prev && hist.length && hist[0] && hist[0].version) prev = String(hist[0].version);
    return {
      cur: cur, next: next, cmp: c, newer: c > 0, older: c < 0, same: c === 0,
      prev: prev, history: hist, pinned: String(row.pinned_version || ""),
      canRollback: !!prev
    };
  }

  /* 업데이트가 필요한 설치본(켜짐·꺼짐 모두) — 고정된 버전은 빼고 셉니다. */
  function updIds(inst) {
    var out = [];
    (inst.data && inst.data.plugins || []).forEach(function (p) {
      var u = updInfo(inst, p);
      if (u && u.newer && !u.pinned) out.push(p.id);
    });
    return out;
  }

  /* 설치된 버전 뒤에 나온 변경 이력만 골라 봅니다. */
  function changesSince(p, cur) {
    return (p.changelog || []).filter(function (c) {
      if (!c || !c.version) return false;
      return cmpVer(c.version, cur) > 0;
    });
  }

  function updBadge(inst, p, short) {
    var u = updInfo(inst, p);
    if (!u) return "";
    /* 버전을 고정한 설치는 「업데이트 가능」이 아니라 「고정」으로 보여 줍니다(고정을 풀어야 바뀝니다). */
    if (u.pinned) {
      return '<span class="mkt-pin" title="' + esc(tr(inst.lang, "pinnedNote", { v: u.pinned })) + '">' +
        esc("v" + u.pinned + " · " + tr(inst.lang, "pinnedTag")) + "</span>";
    }
    if (u.newer) {
      var text = short ? tr(inst.lang, "updNow") : tr(inst.lang, "updAvail", { x: u.cur, y: u.next });
      return '<span class="mkt-upd" data-mkt-upd-badge="' + esc(p.id) + '" title="' +
        esc(tr(inst.lang, "updAvail", { x: u.cur, y: u.next })) + '">' + esc(text) + "</span>";
    }
    return "";
  }

  function dateText(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    return s.slice(0, 10);
  }

  function byId(inst, id) {
    var list = (inst.data && inst.data.plugins) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------------- 데이터 정규화 ---------------- */
  /* v10.2 — 설정 입력 스키마 한 항목을 정리합니다(서버의 plugin_settings_schema_clean 과 같은 규칙). */
  function normField(x) {
    if (!x || typeof x !== "object") return null;
    var key = String(x.key || "").trim().slice(0, 40);
    if (!/^[a-z][a-z0-9_]*$/.test(key)) return null;
    var t = String(x.type || "text").toLowerCase();
    if (["number", "text", "boolean", "select", "color"].indexOf(t) < 0) t = "text";
    var opts = (Array.isArray(x.options) ? x.options : []).map(function (o) {
      if (!o || typeof o !== "object" || o.value == null) return null;
      return {
        value: String(o.value).slice(0, 40),
        label_ko: String(o.label_ko || o.label || o.value).slice(0, 80),
        label_en: String(o.label_en || o.label || o.value).slice(0, 80)
      };
    }).filter(Boolean).slice(0, 20);
    return {
      key: key, type: t,
      label_ko: String(x.label_ko || x.label || key).slice(0, 80),
      label_en: String(x.label_en || x.label || x.label_ko || key).slice(0, 80),
      help_ko: String(x.help_ko || "").slice(0, 200),
      help_en: String(x.help_en || "").slice(0, 200),
      placeholder_ko: String(x.placeholder_ko || "").slice(0, 80),
      placeholder_en: String(x.placeholder_en || "").slice(0, 80),
      default: x.default !== undefined ? x.default : (t === "number" ? 0 : t === "boolean" ? false : ""),
      min: typeof x.min === "number" ? x.min : null,
      max: typeof x.max === "number" ? x.max : null,
      step: typeof x.step === "number" && x.step > 0 ? x.step : null,
      maxlength: typeof x.maxlength === "number" ? Math.max(1, Math.min(2000, x.maxlength)) : 200,
      options: opts,
      sensitive: x.sensitive === true
    };
  }

  function normShot(x, lang) {
    if (x == null) return null;
    if (typeof x === "string") return { src: x, alt: "", alt_en: "" };
    return {
      src: String(x.src || x.url || x.href || ""),
      alt: String(x.alt || ""),
      alt_en: String(x.alt_en || x.altEn || x.alt || "")
    };
  }

  function normalize(data, marketUrl, meta) {
    var isArr = Array.isArray(data);
    var list = isArr ? data : (data && Array.isArray(data.plugins) ? data.plugins : []);
    var out = {
      name: (!isArr && data && data.name) || "SBPress",
      sbpress: (!isArr && data && String(data.sbpress || "")) || "",
      market: meta || null,
      categories: [],
      plugins: []
    };
    var rawCats = (!isArr && data && Array.isArray(data.categories)) ? data.categories : [];
    rawCats.forEach(function (c) {
      if (c == null) return;
      if (typeof c === "string") out.categories.push({ id: c, ko: c, en: c });
      else out.categories.push({
        id: String(c.id || c.key || ""),
        ko: String(c.ko || c.name || c.id || ""),
        en: String(c.en || c.name_en || c.name || c.id || "")
      });
    });
    list.forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var id = String(item.id || "").trim().slice(0, 60);
      if (!id) return;
      var m = (item.manifest && typeof item.manifest === "object") ? item.manifest : {};
      var hooks = Array.isArray(m.hooks) ? m.hooks.slice() : (Array.isArray(item.hooks) ? item.hooks.slice() : []);
      hooks = hooks.map(function (h) { return String(h || "").trim(); }).filter(Boolean).slice(0, 12);
      var perms = Array.isArray(m.permissions) ? m.permissions.slice()
        : (Array.isArray(item.permissions) ? item.permissions.slice() : []);
      perms = perms.map(function (x) { return String(x || "").trim(); }).filter(Boolean).slice(0, 12);
      var tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
      var tagsEn = Array.isArray(item.tags_en) ? item.tags_en.map(String) : [];
      var shots = (Array.isArray(item.screenshots) ? item.screenshots : [])
        .map(function (x) { return normShot(x); }).filter(function (x) { return x && x.src; });
      var log = (Array.isArray(item.changelog) ? item.changelog : []).map(function (c) {
        if (c == null) return null;
        if (typeof c === "string") return { version: "", date: "", notes: c, notes_en: c };
        return {
          version: String(c.version || ""),
          date: dateText(c.date || c.updated),
          notes: String(c.notes || c.note || c.text || ""),
          notes_en: String(c.notes_en || c.notesEn || c.notes || c.note || c.text || "")
        };
      }).filter(Boolean);
      out.plugins.push({
        id: id,
        name: String(item.name || id),
        name_en: String(item.name_en || item.nameEn || ""),
        version: String(item.version || (m.version) || "1.0.0"),
        description: String(item.description || ""),
        description_en: String(item.description_en || item.descriptionEn || ""),
        author: String(item.author || m.author || ""),
        author_en: String(item.author_en || item.authorEn || ""),
        category: String(item.category || ""),
        order: Number(item.order || 0) || 100,
        updated: dateText(item.updated || item.updated_at),
        min_sbpress_version: String(item.min_sbpress_version || item.minVersion || ""),
        /* v10.7 — 최대 버전·훅 API 요구·통계(마켓 JSON 이 미리 알려 줄 수 있습니다). */
        max_sbpress_version: String(item.max_sbpress_version || item.maxVersion || ""),
        requires: (function (r) {
          if (!r || typeof r !== "object") return {};
          var out = {};
          ["blocksApi", "securityApi", "settingsApi", "versionsApi", "api"].forEach(function (k) {
            var n = Number(r[k] || 0);
            if (n > 0) out[k] = n;
          });
          return out;
        })(item.requires || (m && m.requires)),
        stats: (function (st) {
          if (!st || typeof st !== "object") return null;
          return {
            install_count: Number(st.install_count || 0) || 0,
            active_count: Number(st.active_count || 0) || 0,
            avg_rating: Number(st.avg_rating || 0) || 0,
            review_count: Number(st.review_count || 0) || 0,
            last_verified_version: st.last_verified_version == null ? "" : String(st.last_verified_version),
            compat_ok: st.compat_ok === true ? true : (st.compat_ok === false ? false : null),
            compat_note: String(st.compat_note || "")
          };
        })(item.stats),
        script_url: String(item.script_url || ""),
        source: String(item.source || ""),
        tags: tags,
        tags_en: tagsEn,
        screenshots: shots,
        settings_schema: (Array.isArray(item.settings_schema) ? item.settings_schema : [])
          .map(normField).filter(Boolean).slice(0, 40),
        changelog: log,
        hooks: hooks,
        permissions: perms,
        marketUrl: marketUrl || "",
        marketId: (meta && meta.id) || "",
        marketName: (meta && meta.name) || "",
        marketOfficial: !!(meta && meta.official),
        integrity: String(item.integrity || (item.sri || "") || ""),
        sandbox_mode: (String(item.sandbox_mode || "") === "standard") ? "standard" : "strict",
        /* v10.10 — 유료 · 라이선스 */
        pricing: (String(item.pricing || "") === "paid") ? "paid" : "free",
        license_required: item.license_required === true || String(item.pricing || "") === "paid",
        plan_type: (function (pl) {
          pl = String(pl || "").toLowerCase();
          return ["free", "pro", "team", "enterprise"].indexOf(pl) >= 0 ? pl : "pro";
        })(item.plan_type || (item.license && item.license.plan) || "pro"),
        price_label: String(item.price_label || ""),
        price_label_en: String(item.price_label_en || item.priceLabelEn || "")
      });
    });
    /* 카테고리 목록에 없는 분류도 빠뜨리지 않습니다. */
    out.plugins.forEach(function (p) {
      if (!p.category) return;
      var has = out.categories.some(function (c) { return c.id === p.category; });
      if (!has) {
        var fb = CAT_FALLBACK[p.category];
        out.categories.push({ id: p.category, ko: fb ? fb.ko : p.category, en: fb ? fb.en : p.category });
      }
    });
    return out;
  }

  /* v10.4 — 여러 구독 마켓의 플러그인을 한 목록으로 합칩니다.
     같은 ID가 여러 마켓에 있으면 공식 마켓을 먼저 보고, 그다음 준 순서대로 첫 것을 남깁니다.
     (설치·업데이트는 플러그인 ID 로 하므로, 중복을 두 번 보여 주지 않는 것이 안전합니다.) */
  function mergeMarkets(sources) {
    var list = (sources || []).slice();
    list.sort(function (a, b) {
      if (!!b.official !== !!a.official) return b.official ? 1 : -1;
      return 0;
    });
    var seen = {}, out = [], dup = 0, cats = [], catSeen = {};
    list.forEach(function (s) {
      ((s.data && s.data.plugins) || []).forEach(function (p) {
        if (!p || !p.id) return;
        if (seen[p.id]) { dup += 1; return; }
        seen[p.id] = 1;
        out.push(p);
      });
      ((s.data && s.data.categories) || []).forEach(function (c) {
        if (!c || catSeen[c.id]) return;
        catSeen[c.id] = 1;
        cats.push(c);
      });
    });
    return { plugins: out, categories: cats, duplicates: dup, sources: (sources || []) };
  }

  function marketLabel(inst, id) {
    var hit = null;
    (inst.markets || []).forEach(function (m) { if (m.id === id) hit = m; });
    if (hit) return hit.is_official ? tr(inst.lang, "marketOfficialName") : hit.name;
    var p = null;
    (inst.data && inst.data.plugins || []).forEach(function (x) { if (x.marketId === id) p = x; });
    return p ? (p.marketName || id) : id;
  }

  function catLabel(inst, id) {    var lang = inst.lang;
    var hit = null;
    (inst.data.categories || []).forEach(function (c) { if (c.id === id) hit = c; });
    if (!hit) return id;
    return lang === "en" ? (hit.en || hit.ko || id) : (hit.ko || hit.en || id);
  }

  function disp(inst, p) {
    var en = inst.lang === "en";
    return {
      name: (en && p.name_en) ? p.name_en : p.name,
      desc: (en && p.description_en) ? p.description_en : p.description,
      author: (en && p.author_en) ? p.author_en : p.author,
      category: p.category ? catLabel(inst, p.category) : "",
      tags: (en && p.tags_en && p.tags_en.length) ? p.tags_en : p.tags,
      hook: function (h) { return hookLabel(h, inst.lang); }
    };
  }

  function hookLabel(h, lang) {
    var M = {
      menu: { ko: "메뉴", en: "Menu" }, card: { ko: "카드", en: "Card" }, widget: { ko: "위젯", en: "Widget" },
      "admin-tab": { ko: "관리자 탭", en: "Admin tab" }, css: { ko: "CSS", en: "CSS" },
      settings: { ko: "설정", en: "Settings" }, block: { ko: "블록", en: "Block" }
    };
    var x = M[h];
    if (!x) return h;
    return lang === "en" ? x.en : x.ko;
  }

  function permText(perm, lang) {
    var p = PERM[perm];
    if (!p) return tr(lang, "unknownPerm");
    return lang === "en" ? p.en : p.ko;
  }

  /* ---------------- v10.5 — 권한 위험도 · 무결성 상태 ----------------
     위험도: 관리자·쓰기 권한은 높음, 화면·메뉴는 보통, 읽기·스타일은 낮음.
     무결성: 마켓 JSON 의 integrity 와 내려받은 바이트를 다시 해시해 비교합니다. */
  function permRisk(p) {
    var s = String(p || "");
    if (s.indexOf("read:admin") === 0 || s.indexOf("ui:admin") === 0
        || s.indexOf("write:") === 0 || s.indexOf("data:write") === 0) return 3;
    if (s.indexOf("ui:") === 0 || s.indexOf("nav:") === 0) return 2;
    return 1;
  }

  function permArea(inst, p) {
    var s = String(p || "");
    var key = s.indexOf("read:") === 0 ? "areaRead"
      : s.indexOf("css:") === 0 ? "areaCss"
      : s.indexOf("nav:") === 0 ? "areaNav"
      : s.indexOf("ui:") === 0 ? "areaUi"
      : s.indexOf("admin") >= 0 ? "areaAdmin" : "areaOther";
    return tr(inst.lang, key);
  }

  function riskLabel(inst, n) {
    return tr(inst.lang, n >= 3 ? "riskHigh" : n === 2 ? "riskMid" : "riskLow");
  }

  /* 플러그인 엔진이 매긴 설치본 상태(무결성·동의 권한·막힌 훅). */
  function engineStatus(inst, id) {
    try {
      if (window.SBPress && window.SBPress.status) {
        var st = window.SBPress.status();
        for (var i = 0; i < (st.plugins || []).length; i++) {
          if (st.plugins[i] && st.plugins[i].id === id) return st.plugins[i];
        }
      }
    } catch (e) { /* noop */ }
    return null;
  }

  /* 마켓이 직접 검사한 상태(inst.verify) + 엔진 상태. state: idle · checking · ok · bad · none · unchecked */
  function verifyOf(inst, p) {
    var st = engineStatus(inst, p.id);
    if (st && st.integrity && st.integrity.state === "bad") return { state: "bad", source: "engine" };
    var v = (inst.verify || {})[p.id];
    if (v && v.state) return v;
    if (st && st.integrity && st.integrity.state === "ok") return { state: "ok", source: "engine" };
    if (!p.integrity) return { state: "none", source: "market" };
    return { state: "idle", source: "market" };
  }

  function integrityBadge(inst, p, short) {
    var lang = inst.lang;
    var v = verifyOf(inst, p);
    var state = v.state || "idle";
    var title = tr(lang, "integrityHint");
    if (state === "bad") {
      return '<span class="mkt-sri is-bad" data-mkt-sri="' + esc(p.id) + '" title="' +
        esc(tr(lang, "integrityMismatch")) + '">' + esc(tr(lang, "integrityBad")) + "</span>";
    }
    if (state === "ok") {
      return '<span class="mkt-sri is-ok" data-mkt-sri="' + esc(p.id) + '" title="' +
        esc((p.integrity || "") + " · " + title) + '">' + esc(short ? tr(lang, "integrityOkShort") : tr(lang, "integrityOk")) + "</span>";
    }
    if (state === "checking") {
      return '<span class="mkt-sri is-busy" data-mkt-sri="' + esc(p.id) + '">' + esc(tr(lang, "integrityChecking")) + "</span>";
    }
    if (state === "unchecked") {
      return '<span class="mkt-sri is-warn" data-mkt-sri="' + esc(p.id) + '" title="' + esc(title) + '">' +
        esc(tr(lang, "integrityUnchecked")) + "</span>";
    }
    if (state === "none") {
      if (short) return "";
      return '<span class="mkt-sri is-none" data-mkt-sri="' + esc(p.id) + '" title="' + esc(title) + '">' +
        esc(tr(lang, "integrityNone")) + "</span>";
    }
    return short ? "" : '<span class="mkt-sri is-idle" data-mkt-sri="' + esc(p.id) + '">' + esc(tr(lang, "integrity")) + "</span>";
  }

  function grantedOf(inst, p) {
    var row = installedRow(inst, p.id);
    var list = (row && Array.isArray(row.granted_permissions)) ? row.granted_permissions : [];
    if (!list.length) {
      var st = engineStatus(inst, p.id);
      if (st && Array.isArray(st.granted_permissions)) list = st.granted_permissions;
    }
    return list;
  }

  function grantedBadge(inst, p) {
    if (!installedRow(inst, p.id)) return "";
    var list = grantedOf(inst, p);
    if (!list.length) {
      return '<span class="mkt-consent-badge is-none" data-mkt-grant="' + esc(p.id) + '" title="' +
        esc(tr(inst.lang, "grantedNone")) + '">' + esc(tr(inst.lang, "grantedNone")) + "</span>";
    }
    return '<span class="mkt-consent-badge" data-mkt-grant="' + esc(p.id) + '" title="' +
      esc(list.join(", ")) + '">' + esc(tr(inst.lang, "grantedTag", { n: list.length })) + "</span>";
  }

  /* 한 플러그인의 무결성을 다시 검사합니다. 결과를 inst.verify 에 남기고 다시 그립니다. */
  function verifyOne(inst, p) {
    if (!p || !p.integrity) {
      inst.verify[p.id] = { state: "none", checkedAt: new Date().toISOString() };
      return Promise.resolve(inst.verify[p.id]);
    }
    var cur = inst.verify[p.id];
    if (cur && cur.state === "checking") return Promise.resolve(cur);
    var S = window.SBPress;
    if (!S || typeof S.verifyIntegrity !== "function") {
      inst.verify[p.id] = { state: "unchecked", reason: "no-engine", checkedAt: new Date().toISOString() };
      return Promise.resolve(inst.verify[p.id]);
    }
    inst.verify[p.id] = { state: "checking" };
    return S.verifyIntegrity(p.script_url, p.integrity).then(function (v) {
      var rec = (v && v.checked)
        ? { state: (v.ok ? "ok" : "bad"), computed: v.computed || "", expected: v.expected || p.integrity,
            checkedAt: new Date().toISOString(), reason: v.mismatch ? "mismatch" : "" }
        : { state: "unchecked", checkedAt: new Date().toISOString(), reason: (v && v.reason) || "unknown" };
      inst.verify[p.id] = rec;
      return rec;
    }).catch(function (e) {
      inst.verify[p.id] = { state: "unchecked", reason: (e && e.message) || "error", checkedAt: new Date().toISOString() };
      return inst.verify[p.id];
    });
  }

  /* 아직 검사하지 않은 플러그인을 천천히(2개씩) 검사하고 화면을 다시 그립니다. */
  function scheduleVerify(inst) {
    var queue = (inst.data && inst.data.plugins || []).filter(function (p) {
      if (!p.integrity) return false;
      var v = verifyOf(inst, p);
      return v.state === "idle";
    }).slice(0, 12);
    if (!queue.length) return;
    var i = 0;
    inst.verifyRun = (inst.verifyRun || 0) + 1;
    var run = inst.verifyRun;
    function step() {
      if (run !== inst.verifyRun) return;              // 더 새 데이터로 다시 그렸으면 멈춥니다
      if (i >= queue.length) { try { render(inst); } catch (e) { /* noop */ } return; }
      var a = queue[i++], b = queue[i++];
      var jobs = [verifyOne(inst, a)];
      if (b) jobs.push(verifyOne(inst, b));
      Promise.all(jobs).then(step, step);
    }
    setTimeout(step, 220);
  }

  /* 설치·업데이트에 필요한 동의 — 새 권한·동의 기록 없음·업데이트를 가려냅니다. */
  function newPermsFor(inst, p, mode) {
    var row = installedRow(inst, p.id);
    var all = Array.isArray(p.permissions) ? p.permissions : [];
    if (mode !== "update" || !row) return all.slice();
    var man = (row.manifest && Array.isArray(row.manifest.permissions)) ? row.manifest.permissions : [];
    var granted = Array.isArray(row.granted_permissions) ? row.granted_permissions : [];
    /* 매니페스트에 없던 권한이 진짜 '새 권한'입니다. 동의 기록이 있는 설치본이면
       동의하지 않은 권한도 새 권한으로 봅니다. */
    return all.filter(function (x) {
      if (man.indexOf(x) < 0) return true;
      return granted.length > 0 && granted.indexOf(x) < 0;
    });
  }

  function consentNeeded(inst, p, mode) {
    var v = verifyOf(inst, p);
    if (v.state === "bad") return { ok: false, reason: "integrity" };
    var perms = Array.isArray(p.permissions) ? p.permissions : [];
    var row = installedRow(inst, p.id);
    if (mode === "update") {
      /* 새 권한이 생긴 업데이트만 모달로 확인합니다. 권한이 그대로면 조용히 진행하되,
         무결성·동의 기록은 함께 남깁니다(자동 동의 = 지금 매니페스트에 적힌 권한). */
      var fresh = newPermsFor(inst, p, "update");
      if (fresh.length) return { ok: false, reason: "new-permissions", perms: fresh };
      return { ok: true, auto: perms.length ? { granted: perms, integrity: p.integrity || "",
                                                mode: p.sandbox_mode || "strict", auto: true } : null };
    }
    return { ok: false, reason: perms.length ? "install" : "install-none", perms: perms };
  }

  function installedRow(inst, id) {
    try { return inst.installed ? (inst.installed(id) || null) : null; } catch (e) { return null; }
  }

  function hasSettings(p) {
    return !!(p && Array.isArray(p.settings_schema) && p.settings_schema.length);
  }

  /* 기본값(마켓 스키마) + DB 에 저장된 값 */
  function settingsOf(inst, p) {
    var out = {};
    (p.settings_schema || []).forEach(function (f) {
      if (f.default !== undefined) out[f.key] = f.default;
    });
    var row = installedRow(inst, p.id);
    var saved = (row && row.settings && typeof row.settings === "object") ? row.settings : {};
    (p.settings_schema || []).forEach(function (f) {
      if (saved[f.key] !== undefined) out[f.key] = saved[f.key];
    });
    return out;
  }

  /* ---------------- 필터 · 정렬 ---------------- */
  function matches(inst, p, st) {
    if (st.cat && p.category !== st.cat) return false;
    if (st.hook && p.hooks.indexOf(st.hook) < 0) return false;
    if (st.tag && p.tags.indexOf(st.tag) < 0) return false;
    if (st.market && p.marketId !== st.market) return false;
    /* v10.10 — 가격 칩(무료 / 유료·라이선스) */
    if (st.price === "free" && p.pricing === "paid") return false;
    if (st.price === "paid" && p.pricing !== "paid") return false;
    var q = String(st.q || "").trim().toLowerCase();
    if (!q) return true;
    var d = disp(inst, p);
    var hay = [p.id, p.name, p.name_en, p.description, p.description_en, p.author, p.author_en,
      p.tags.join(" "), p.tags_en.join(" "), p.hooks.join(" "), d.category].join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function sortList(inst, list, mode) {
    var arr = list.slice();
    var locale = inst.lang === "en" ? "en" : "ko";
    if (mode === "rating") {
      arr.sort(function (a, b) {
        var x = statsOf(inst, a), y = statsOf(inst, b);
        return (y.avg_rating - x.avg_rating) || (y.review_count - x.review_count) ||
          (a.order - b.order) || disp(inst, a).name.localeCompare(disp(inst, b).name, locale);
      });
    } else if (mode === "installs") {
      arr.sort(function (a, b) {
        var x = statsOf(inst, a), y = statsOf(inst, b);
        return (y.install_count - x.install_count) || (y.review_count - x.review_count) ||
          (a.order - b.order) || disp(inst, a).name.localeCompare(disp(inst, b).name, locale);
      });
    } else if (mode === "latest") {
      arr.sort(function (a, b) {
        var x = a.updated || "", y = b.updated || "";
        if (x !== y) return y.localeCompare(x);
        return (a.order - b.order) || disp(inst, a).name.localeCompare(disp(inst, b).name, locale);
      });
    } else if (mode === "name") {
      arr.sort(function (a, b) {
        return disp(inst, a).name.localeCompare(disp(inst, b).name, locale);
      });
    } else {
      arr.sort(function (a, b) {
        return (a.order - b.order) || String(b.updated || "").localeCompare(String(a.updated || ""));
      });
    }
    return arr;
  }

  function facetValues(inst) {
    var cats = [], hooks = [], tags = [], markets = [];
    (inst.data.plugins || []).forEach(function (p) {
      if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category);
      p.hooks.forEach(function (h) { if (hooks.indexOf(h) < 0) hooks.push(h); });
      p.tags.forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
      if (p.marketId && markets.indexOf(p.marketId) < 0) markets.push(p.marketId);
    });
    hooks.sort(function (a, b) {
      var ia = HOOK_ORDER.indexOf(a), ib = HOOK_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return { cats: cats, hooks: hooks, tags: tags, markets: markets };
  }

  /* ======================================================================
     v10.7 — 별점 · 리뷰 · 설치 통계 · 호환성
     ----------------------------------------------------------------------
     통계는 plugin_stats(서버) → 마켓 JSON 의 stats → 이 브라우저(localStorage)
     순서로 겹쳐 읽습니다. 28_v107 SQL 이 없으면 리뷰는 localStorage 에만 쌓고,
     평균·건수도 그 자리에서 다시 계산합니다. 쓰기는 모두 이 파일이 하지만,
     설치·제거 수는 관리자 화면(admin.js)이 recordInstall 로 알려 줍니다. */
  var STATS = { loaded: false, loading: false, tableMissing: false, map: {}, local: false, msg: "", msgKind: "" };
  var STATS_LS = "sbpress-plugin-stats";
  var REV_LS = "sbpress-plugin-reviews";
  var REV = { slug: "", inst: null, items: null, loading: false, tableMissing: false, mine: null,
              user: null, rating: 0, msg: "", msgKind: "", busy: false };
  var COMPAT = { busy: false, flash: null };

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function enc(s) { return encodeURIComponent(String(s == null ? "" : s)); }
  function mergeInto(dst, src) {
    Object.keys(src || {}).forEach(function (k) { dst[k] = src[k]; });
    return dst;
  }
  function readLS(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  /* 현재 코어 버전 — 마켓 JSON 의 sbpress(10.7) → 엔진 버전 순서. 10.7.0 은 10.7 로 줄입니다. */
  function coreVer(inst) {
    var v = String((inst && inst.data && inst.data.sbpress) || "");
    if (!v) { try { v = String((window.SBPress && window.SBPress.version) || ""); } catch (e) { v = ""; } }
    v = v.replace(/^v/i, "").trim();
    if (!v) return "10.7";
    var p = v.split(".");
    if (p.length === 3 && p[2] === "0") return p[0] + "." + p[1];
    return v;
  }
  function coreShort(v) { return String(v || "").split(".").slice(0, 2).join("."); }
  function apiVer(k) {
    var n = 0;
    try { n = Number((window.SBPress && window.SBPress[k]) || 0); } catch (e) { n = 0; }
    return n || ((k === "blocksApi" || k === "securityApi") ? 1 : 0);
  }
  function ratingText(n) { n = num(n); return n > 0 ? (Math.round(n * 10) / 10).toFixed(1) : "0.0"; }

  function statsOf(inst, p) {
    var id = (p && p.id) ? p.id : String(p || "");
    var base = (p && p.stats && typeof p.stats === "object") ? p.stats : {};
    var row = STATS.map[id] || {};
    var pick = function (k) { return row[k] != null ? row[k] : base[k]; };
    var ok = pick("compat_ok");
    var lv = pick("last_verified_version");
    return {
      install_count: Math.max(0, num(pick("install_count"))),
      active_count: Math.max(0, num(pick("active_count"))),
      avg_rating: Math.min(5, Math.max(0, num(pick("avg_rating")))),
      review_count: Math.max(0, num(pick("review_count"))),
      last_verified_version: lv == null ? "" : String(lv),
      compat_ok: ok === true ? true : (ok === false ? false : null),
      compat_note: String(pick("compat_note") || ""),
      updated_at: String(pick("updated_at") || "")
    };
  }

  function setLocalStats(id, patch) {
    var all = readLS(STATS_LS, {});
    if (!all || typeof all !== "object" || Array.isArray(all)) all = {};
    var cur = (all[id] && typeof all[id] === "object") ? all[id] : {};
    mergeInto(cur, patch || {});
    cur.updated_at = new Date().toISOString();
    all[id] = cur;
    writeLS(STATS_LS, all);
    STATS.map[id] = mergeInto({ plugin_slug: id }, cur);
    STATS.local = true;
    return STATS.map[id];
  }

  function applyLocalStats() {
    var all = readLS(STATS_LS, {});
    if (all && typeof all === "object" && !Array.isArray(all)) {
      Object.keys(all).forEach(function (id) {
        var row = all[id];
        if (row && typeof row === "object") {
          row.plugin_slug = id;
          STATS.map[id] = row;
        }
      });
    }
    STATS.local = true;
  }

  function repaintStats(inst, keepModal) {
    if (!inst) return;
    if (inst.tools) paintTools(inst);
    if (inst.data) render(inst);
    if (keepModal && MODAL.el && !MODAL.el.hidden && MODAL.inst === inst && MODAL.id) {
      openDetail(inst, MODAL.id, true);
    }
  }

  /* plugin_stats 를 한 번 읽어 둡니다. 표가 없으면(28_v107 이전) 이 브라우저 값으로 대신합니다. */
  function loadStats(inst, force) {
    if (!inst) return;
    if (STATS.loading) return;
    if (STATS.loaded && !force) return;
    STATS.loading = true;
    STATS.msg = ""; STATS.msgKind = "";
    function finish() {
      STATS.loading = false;
      STATS.loaded = true;
      repaintStats(inst, true);
    }
    if (!sbCfg().url) { STATS.tableMissing = true; applyLocalStats(); finish(); return; }
    sbRequest("/rest/v1/plugin_stats?select=*&limit=500", { token: sbToken() }).then(function (rows) {
      if (Array.isArray(rows)) {
        rows.forEach(function (r) { if (r && r.plugin_slug) STATS.map[r.plugin_slug] = r; });
      }
      STATS.tableMissing = false;
      STATS.local = false;
      finish();
    }, function (e) {
      STATS.tableMissing = missingTable(e);
      applyLocalStats();
      if (!STATS.tableMissing) { STATS.msg = tr(inst.lang, "statsLoadFail") + (e.message || e); STATS.msgKind = "err"; }
      finish();
    });
  }

  /* 설치·켜짐 수 — 관리자 화면이 설치/제거/켜기/끄기 뒤에 부릅니다.
     p_delta 는 설치 수, p_active_delta 는 켜짐 수(생략하면 같은 값)입니다. */
  function recordInstall(id, delta, activeDelta, cb) {
    if (!id) { if (cb) cb(null); return; }
    var inst = adminInst() || INSTANCES[0] || null;
    var d = delta === -1 ? -1 : (delta === 1 ? 1 : 0);
    var ad = (activeDelta === undefined || activeDelta === null) ? d
      : (activeDelta === -1 ? -1 : (activeDelta === 1 ? 1 : 0));
    var cur = statsOf(inst, { id: id });
    var next = setLocalStats(id, {
      install_count: Math.max(0, cur.install_count + d),
      active_count: Math.max(0, cur.active_count + ad),
      avg_rating: cur.avg_rating, review_count: cur.review_count,
      last_verified_version: cur.last_verified_version || null,
      compat_ok: cur.compat_ok, compat_note: cur.compat_note || null
    });
    function done(err) {
      repaintStats(inst, false);
      if (cb) cb(err || null);
    }
    if (!sbCfg().url || STATS.tableMissing) { done(null); return; }
    sbRequest("/rest/v1/rpc/record_plugin_install", {
      method: "POST", token: sbToken(),
      body: { p_slug: id, p_delta: d, p_active_delta: ad }
    }).then(function (res) {
      if (res && res.install_count != null) {
        STATS.map[id] = {
          plugin_slug: id, install_count: Math.max(0, num(res.install_count)),
          active_count: Math.max(0, num(res.active_count)),
          avg_rating: next.avg_rating, review_count: next.review_count,
          last_verified_version: next.last_verified_version,
          compat_ok: next.compat_ok, compat_note: next.compat_note,
          updated_at: res.updated_at || new Date().toISOString()
        };
      }
      done(null);
    }, function (e) {
      done((missingRpc(e) || missingTable(e)) ? null : ((e && e.message) || String(e)));
    });
  }

  /* ---------------- 호환성 ---------------- */
  function compatOf(inst, p) {
    var core = coreVer(inst);
    var min = String((p && p.min_sbpress_version) || "");
    var max = String((p && p.max_sbpress_version) || "");
    var st = statsOf(inst, p);
    var verOk = (!min || cmpVer(core, min) >= 0) && (!max || cmpVer(core, max) <= 0);
    var req = (p && p.requires && typeof p.requires === "object") ? p.requires : {};
    var hooksBad = [];
    ["blocksApi", "securityApi"].forEach(function (k) {
      var need = Number(req[k] || 0);
      if (need && apiVer(k) < need) hooksBad.push({ api: k, need: need, have: apiVer(k) });
    });
    var verified = st.last_verified_version ? (cmpVer(st.last_verified_version, core) >= 0) : false;
    var state = (!verOk || st.compat_ok === false || hooksBad.length) ? "warn"
      : (!min && !max && !verified && st.compat_ok === null) ? "unverified" : "ok";
    return { state: state, core: core, min: min, max: max, verOk: verOk, verified: verified,
             compatOk: st.compat_ok, note: st.compat_note, hooksBad: hooksBad, req: req, stats: st };
  }

  function compatBadge(inst, p, short) {
    var lang = inst.lang, c = compatOf(inst, p);
    var text = c.state === "warn" ? tr(lang, "compatWarn")
      : c.state === "unverified" ? tr(lang, "compatUnverified")
      : tr(lang, "compatBadgeOk", { v: coreShort(c.core) });
    var bits = [tr(lang, "compatBadgeTitle", { v: coreShort(c.core) })];
    if (c.min) bits.push(tr(lang, "compatMin") + " v" + c.min);
    if (c.max) bits.push(tr(lang, "compatMax") + " v" + c.max);
    bits.push(c.verified ? tr(lang, "compatVerifiedShort", { v: c.stats.last_verified_version })
                         : tr(lang, "compatNotVerified"));
    if (c.hooksBad.length) {
      bits.push(c.hooksBad.map(function (h) { return h.api + " " + h.need + ">" + h.have; }).join(", "));
    }
    if (c.note) bits.push(c.note);
    return '<span class="mkt-compat is-' + c.state + '" data-mkt-compat="' + esc(p.id) + '" title="' +
      esc(bits.join(" · ")) + '">' + esc(text) + "</span>";
  }

  function starBar(n) {
    var v = Math.max(0, Math.min(5, Math.round(num(n))));
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<i class="mkt-star' + (i <= v ? " on" : "") + '" aria-hidden="true">' + (i <= v ? "★" : "☆") + "</i>";
    }
    return '<span class="mkt-stars" aria-label="' + esc(v + " / 5") + '">' + out + "</span>";
  }

  function ratingChip(inst, p) {
    var st = statsOf(inst, p);
    if (!st.review_count) {
      return '<span class="mkt-rate-empty" data-mkt-rate-chip="' + esc(p.id) + '">' +
        esc(tr(inst.lang, "noReviewsYet")) + "</span>";
    }
    return '<span class="mkt-rate" data-mkt-rate-chip="' + esc(p.id) + '" title="' +
      esc(tr(inst.lang, "ratingTitle")) + '"><b>★ ' + esc(ratingText(st.avg_rating)) + "</b> " +
      '<span class="muted">' + esc(tr(inst.lang, st.review_count === 1 ? "reviewOne" : "reviewsCount", { n: st.review_count })) +
      "</span></span>";
  }

  function installChip(inst, p) {
    var st = statsOf(inst, p);
    return '<span class="mkt-installs" data-mkt-installs="' + esc(p.id) + '" title="' +
      esc(tr(inst.lang, "installsTitle")) + '">' + esc(tr(inst.lang, "installsCount", { n: st.install_count })) + "</span>";
  }

  /* ---------------- 리뷰 ---------------- */
  function readLocalReviews() {
    var all = readLS(REV_LS, []);
    return Array.isArray(all) ? all : [];
  }
  function writeLocalReviews(list) { return writeLS(REV_LS, (list || []).slice(0, 300)); }
  function localReviewsFor(slug) {
    return readLocalReviews().filter(function (r) { return r && r.plugin_slug === slug; });
  }
  function authorName(u) {
    var m = (u && u.user_metadata) || {};
    var n = m.full_name || m.name || m.nickname || "";
    if (!n && u && u.email) n = String(u.email).split("@")[0];
    return String(n || "").slice(0, 60);
  }
  function viewUser() { return SUB.userChecked ? SUB.user : null; }

  function loadReviews(inst, p, force) {
    if (!inst || !p) return;
    if (!force && REV.slug === p.id && REV.items && !REV.loading) { paintReviews(inst, p); return; }
    if (REV.loading && REV.slug === p.id && !force) { paintReviews(inst, p); return; }
    if (REV.slug !== p.id) { REV.msg = ""; REV.msgKind = ""; }
    REV.inst = inst;
    REV.slug = p.id;
    REV.items = null;
    REV.loading = true;
    REV.tableMissing = false;
    REV.mine = null;
    if (!force) REV.rating = 0;
    paintReviews(inst, p);
    function finish() {
      REV.loading = false;
      paintReviews(inst, p);
    }
    if (!sbCfg().url) {
      REV.tableMissing = true;
      REV.items = localReviewsFor(p.id);
      loadMine(inst, p, finish);
      return;
    }
    var admin = inst.mode === "admin";
    var path = admin
      ? "/rest/v1/plugin_reviews?select=*&plugin_slug=eq." + enc(p.id) + "&order=created_at.desc&limit=100"
      : "/rest/v1/plugin_reviews_public?select=*&plugin_slug=eq." + enc(p.id) + "&order=created_at.desc&limit=100";
    sbRequest(path, { token: sbToken() }).then(function (rows) {
      REV.tableMissing = false;
      REV.items = Array.isArray(rows) ? rows : [];
      loadMine(inst, p, finish);
    }, function (e) {
      if (missingTable(e)) {
        REV.tableMissing = true;
        REV.items = localReviewsFor(p.id);
        loadMine(inst, p, finish);
        return;
      }
      REV.items = [];
      REV.msg = tr(inst.lang, "reviewLoadFail") + ((e && e.message) || e);
      REV.msgKind = "err";
      finish();
    });
  }

  function loadMine(inst, p, done) {
    subUser(function (u) {
      REV.user = u || null;
      if (!u) { done(); return; }
      var mine = (REV.items || []).filter(function (r) {
        return r && String(r.user_id || "") === String(u.id);
      })[0] || null;
      if (mine) { REV.mine = mine; if (!REV.rating) REV.rating = num(mine.rating); done(); return; }
      if (REV.tableMissing) {
        var lo = localReviewsFor(p.id).filter(function (r) { return String(r.user_id || "") === String(u.id); })[0] || null;
        if (lo) { REV.mine = lo; if (!REV.rating) REV.rating = num(lo.rating); }
        done();
        return;
      }
      sbRequest("/rest/v1/plugin_reviews?select=*&plugin_slug=eq." + enc(p.id) +
                "&user_id=eq." + enc(u.id) + "&limit=1", { token: sbToken() }).then(function (rows) {
        REV.mine = (Array.isArray(rows) && rows[0]) || null;
        if (REV.mine && !REV.rating) REV.rating = num(REV.mine.rating);
      }, function () { REV.mine = null; }).then(done, done);
    });
  }

  function reviewHtml(inst, p, r) {
    var lang = inst.lang;
    var u = viewUser();
    var mine = !!(u && String(r.user_id || "") === String(u.id));
    var hidden = String(r.status || "") === "hidden";
    var acts = "";
    if (inst.mode === "admin") {
      acts += hidden
        ? '<button type="button" class="rowlink" data-mkt-rev-show="' + esc(r.id) + '">' + esc(tr(lang, "reviewRestore")) + "</button>"
        : '<button type="button" class="rowlink" data-mkt-rev-hide="' + esc(r.id) + '">' + esc(tr(lang, "reviewHide")) + "</button>";
      acts += '<button type="button" class="rowlink danger" data-mkt-rev-del="' + esc(r.id) + '">' + esc(tr(lang, "reviewDelete")) + "</button>";
    }
    return '<li class="mkt-rev' + (hidden ? " is-hidden" : "") + (mine ? " is-mine" : "") +
      '" data-rev-id="' + esc(r.id) + '">' +
      '<div class="mkt-revtop">' + starBar(r.rating) +
        (r.title ? "<b>" + esc(r.title) + "</b>" : "") +
        (mine ? '<span class="mkt-badge">' + esc(tr(lang, "reviewMine")) + "</span>" : "") +
        (hidden ? '<span class="mkt-badge warn">' + esc(tr(lang, "reviewHiddenBadge")) + "</span>" : "") +
      "</div>" +
      '<p class="mkt-revbody">' + esc(r.body || "") + "</p>" +
      '<p class="mkt-revmeta">' + esc(r.author_name || "—") + " · " + esc(dateText(r.created_at)) +
        (r.sbpress_version ? " · v" + esc(r.sbpress_version) : "") +
        (r.updated_at && dateText(r.updated_at) !== dateText(r.created_at) ? " · " + esc(tr(lang, "reviewEdited")) : "") +
      "</p>" +
      (acts ? '<div class="mkt-revacts">' + acts + "</div>" : "") +
      "</li>";
  }

  function reviewFormHtml(inst, p) {
    var lang = inst.lang;
    if (!viewUser()) {
      return '<div class="mkt-revgate" id="mkt-rev-gate">' + esc(tr(lang, "reviewGate")) +
        ' <a class="rowlink" href="#/sign">' + esc(tr(lang, "reviewGateLink")) + "</a></div>";
    }
    var mine = REV.mine || null;
    var rating = num(REV.rating) || (mine ? num(mine.rating) : 0);
    var stars = "";
    for (var i = 1; i <= 5; i++) {
      stars += '<button type="button" class="mkt-rateset' + (i <= rating ? " on" : "") +
        '" data-mkt-rate="' + i + '" aria-label="' + esc(tr(lang, "reviewRateAria", { n: i })) +
        '" aria-pressed="' + (i <= rating ? "true" : "false") + '">' + (i <= rating ? "★" : "☆") + "</button>";
    }
    return '<form class="mkt-revform" id="mkt-rev-form" novalidate>' +
      "<h4>" + esc(tr(lang, mine ? "reviewEditTitle" : "reviewWriteTitle")) + "</h4>" +
      '<div class="mkt-ratepick" role="group" aria-label="' + esc(tr(lang, "reviewRating")) + '">' +
        '<span class="mkt-sortlabel">' + esc(tr(lang, "reviewRating")) + "</span>" + stars + "</div>" +
      '<label class="cms-field"><span>' + esc(tr(lang, "reviewTitleLabel")) + "</span>" +
        '<input id="mkt-rev-title" maxlength="120" autocomplete="off" value="' + esc(mine ? (mine.title || "") : "") + '"></label>' +
      '<label class="cms-field"><span>' + esc(tr(lang, "reviewBodyLabel")) + "</span>" +
        '<textarea id="mkt-rev-body" rows="4" maxlength="4000">' + esc(mine ? (mine.body || "") : "") + "</textarea></label>" +
      '<div class="mkt-revform-acts">' +
        '<button type="button" class="btn btn-primary btn-sm" data-mkt-rev-save="' + esc(p.id) + '">' +
          esc(tr(lang, mine ? "reviewUpdate" : "reviewSave")) + "</button></div></form>";
  }

  function paintReviews(inst, p) {
    var box = MODAL.el ? MODAL.el.querySelector("#mkt-reviews") : null;
    if (!box) return;
    var lang = inst.lang;
    var st = statsOf(inst, p);
    var head = '<div class="mkt-revhead"><div class="mkt-revavg">' +
      '<b class="mkt-revscore">' + esc(ratingText(st.avg_rating)) + "</b>" + starBar(st.avg_rating) +
      '<span class="muted">' + esc(tr(lang, st.review_count === 1 ? "reviewOne" : "reviewsCount", { n: st.review_count })) +
      "</span></div>" + installChip(inst, p) + "</div>";
    var list;
    if (REV.loading) list = '<p class="mkt-note">' + esc(tr(lang, "reviewLoading")) + "</p>";
    else if (!(REV.items || []).length) list = '<p class="mkt-note mkt-rev-empty">' + esc(tr(lang, "reviewEmpty")) + "</p>";
    else list = '<ul class="mkt-revlist">' + REV.items.map(function (r) { return reviewHtml(inst, p, r); }).join("") + "</ul>";
    box.innerHTML = head +
      (REV.tableMissing ? '<p class="mkt-note mkt-warn" id="mkt-rev-missing">' + esc(tr(lang, "reviewNeedSql")) + "</p>" : "") +
      (REV.msg ? '<p class="mkt-rev-msg' + (REV.msgKind ? " " + esc(REV.msgKind) : "") +
        '" role="status" aria-live="polite">' + esc(REV.msg) + "</p>" : "") +
      list + reviewFormHtml(inst, p);
  }

  function revMsg(inst, text, kind) {
    REV.msg = text || "";
    REV.msgKind = kind || "";
    var p = byId(inst, REV.slug) || { id: REV.slug, stats: {} };
    paintReviews(inst, p);
  }

  function saveLocalReview(inst, p, row, done) {
    var list = readLocalReviews();
    var hit = null;
    list.forEach(function (r) {
      if (r && r.plugin_slug === row.plugin_slug && String(r.user_id || "") === String(row.user_id)) hit = r;
    });
    var now = new Date().toISOString();
    if (hit) {
      hit.rating = row.rating; hit.title = row.title; hit.body = row.body;
      hit.sbpress_version = row.sbpress_version; hit.status = "published"; hit.updated_at = now;
    } else {
      row.id = "local-" + Date.now();
      row.status = "published";
      row.created_at = now; row.updated_at = now;
      list.unshift(row);
      hit = row;
    }
    writeLocalReviews(list);
    REV.tableMissing = true;
    REV.mine = hit;
    recomputeLocalStats(p.id);
    done(true);
  }

  function recomputeLocalStats(slug) {
    var list = localReviewsFor(slug).filter(function (r) {
      return String(r.status || "published") === "published";
    });
    var sum = list.reduce(function (a, r) { return a + num(r.rating); }, 0);
    var cur = statsOf(REV.inst, { id: slug });
    setLocalStats(slug, {
      avg_rating: list.length ? Math.round((sum / list.length) * 100) / 100 : 0,
      review_count: list.length,
      install_count: cur.install_count, active_count: cur.active_count,
      last_verified_version: cur.last_verified_version || null,
      compat_ok: cur.compat_ok, compat_note: cur.compat_note || null
    });
  }

  function saveReview(inst, p, btn) {
    if (!inst || !p || REV.busy) return;
    var lang = inst.lang;
    var bodyEl = MODAL.el ? MODAL.el.querySelector("#mkt-rev-body") : null;
    var titleEl = MODAL.el ? MODAL.el.querySelector("#mkt-rev-title") : null;
    var rating = num(REV.rating);
    var body = bodyEl ? String(bodyEl.value || "").trim() : "";
    var title = titleEl ? String(titleEl.value || "").trim().slice(0, 120) : "";
    if (!rating) { revMsg(inst, tr(lang, "reviewNeedRating"), "err"); return; }
    if (body.length < 10) { revMsg(inst, tr(lang, "reviewNeedBody"), "err"); return; }
    subUser(function (u) {
      if (!u) { revMsg(inst, tr(lang, "reviewNeedLogin"), "err"); return; }
      REV.busy = true;
      if (btn) { btn.disabled = true; btn.textContent = tr(lang, "reviewSaving"); }
      var row = { plugin_slug: p.id, rating: rating, title: title || null, body: body,
                  sbpress_version: coreVer(inst), user_id: u.id,
                  author_name: authorName(u), status: "published" };
      function saved(local) {
        REV.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = tr(lang, REV.mine ? "reviewUpdate" : "reviewSave"); }
        REV.rating = rating;
        var box = sbCfg().url && !REV.tableMissing;
        loadStats(inst, box);
        REV.slug = "";
        loadReviews(inst, p, true);
        revMsg(inst, tr(lang, local ? "reviewSavedLocal" : "reviewSaved"), "ok");
      }
      function failed(e) {
        REV.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = tr(lang, REV.mine ? "reviewUpdate" : "reviewSave"); }
        if (missingTable(e)) { saveLocalReview(inst, p, row, saved); return; }
        if (e && (e.status === 401 || e.status === 403)) {
          revMsg(inst, tr(lang, "reviewNeedLogin") + " (" + ((e.message) || "") + ")", "err");
          return;
        }
        revMsg(inst, tr(lang, "reviewSaveFail") + ((e && e.message) || e), "err");
      }
      if (REV.tableMissing) { saveLocalReview(inst, p, row, saved); return; }
      if (REV.mine && REV.mine.id) {
        sbRequest("/rest/v1/plugin_reviews?id=eq." + enc(REV.mine.id), {
          method: "PATCH", token: sbToken(), prefer: "return=representation",
          body: { rating: row.rating, title: row.title, body: row.body, sbpress_version: row.sbpress_version }
        }).then(function () { saved(false); }, failed);
        return;
      }
      sbRequest("/rest/v1/plugin_reviews", {
        method: "POST", token: sbToken(), prefer: "return=representation", body: row
      }).then(function (data) {
        var got = (Array.isArray(data) && data[0]) || null;
        if (got) { REV.mine = got; }
        saved(false);
      }, failed);
    });
  }

  function moderateReview(inst, p, id, status, btn) {
    if (!inst || inst.mode !== "admin" || !id) return;
    var lang = inst.lang;
    if (btn) btn.disabled = true;
    function done(err) {
      if (btn) btn.disabled = false;
      if (err) { revMsg(inst, tr(lang, "reviewSaveFail") + err, "err"); return; }
      REV.items = null;
      REV.mine = null;
      loadStats(inst, true);
      loadReviews(inst, p, true);
      revMsg(inst, tr(lang, status === "hidden" ? "reviewHiddenDone" : "reviewShownDone"), "ok");
    }
    if (REV.tableMissing) {
      var list = readLocalReviews();
      list.forEach(function (r) { if (String(r.id) === String(id)) r.status = status; });
      writeLocalReviews(list);
      recomputeLocalStats(p.id);
      done(null);
      return;
    }
    sbRequest("/rest/v1/plugin_reviews?id=eq." + enc(id), {
      method: "PATCH", token: sbToken(), body: { status: status }
    }).then(function () { done(null); }, function (e) { done((e && e.message) || String(e)); });
  }

  function deleteReview(inst, p, id, btn) {
    if (!inst || inst.mode !== "admin" || !id) return;
    var lang = inst.lang;
    if (typeof window.confirm === "function" && !window.confirm(tr(lang, "reviewDeleteConfirm"))) return;
    if (btn) btn.disabled = true;
    function done(err) {
      if (btn) btn.disabled = false;
      if (err) { revMsg(inst, tr(lang, "reviewSaveFail") + err, "err"); return; }
      REV.items = null; REV.mine = null;
      loadStats(inst, true);
      loadReviews(inst, p, true);
    }
    if (REV.tableMissing) {
      writeLocalReviews(readLocalReviews().filter(function (r) { return String(r.id) !== String(id); }));
      recomputeLocalStats(p.id);
      done(null);
      return;
    }
    sbRequest("/rest/v1/plugin_reviews?id=eq." + enc(id), { method: "DELETE", token: sbToken() })
      .then(function () { done(null); }, function (e) { done((e && e.message) || String(e)); });
  }

  /* ---------------- 호환성 리포트 (관리자) ---------------- */
  function compatRow(inst, p, engRow) {
    var c = compatOf(inst, p);
    var eng = engRow || engineStatus(inst, p.id);
    var row = installedRow(inst, p.id);
    var errs = eng ? (eng.errors || []).length : 0;
    var failed = !!(eng && eng.disabled);
    var notices = 0;
    try {
      var st = (window.SBPress && window.SBPress.status) ? window.SBPress.status() : null;
      if (st && Array.isArray(st.notices)) {
        notices = st.notices.filter(function (n) { return n && n.plugin === p.id; }).length;
      }
    } catch (e) { notices = 0; }
    return {
      id: p.id,
      name: (function () { try { return disp(inst, p).name; } catch (e) { return p.id; } })(),
      version: String(p.version || ""),
      installed: !!row, enabled: !!(row && row.enabled),
      state: (failed || errs) ? "warn" : c.state,
      compat: c,
      errors: errs + notices,
      failed: failed
    };
  }

  function compatRows(inst) {
    var out = [], seen = {};
    (inst.data && inst.data.plugins || []).forEach(function (p) {
      if (!p || !p.id || seen[p.id]) return;
      seen[p.id] = 1;
      out.push(compatRow(inst, p));
    });
    var rows = [];
    try { rows = (window.SBPress && window.SBPress.status) ? (window.SBPress.status().plugins || []) : []; } catch (e) { rows = []; }
    rows.forEach(function (r) {
      if (!r || !r.id || seen[r.id]) return;
      seen[r.id] = 1;
      var m = r.manifest || {};
      /* 마켓에 없는 설치본은 영문 이름이 없습니다 — EN 화면에서는 ID 로 보여 줍니다. */
      out.push(compatRow(inst, {
        id: r.id, name: inst.lang === "en" ? r.id : (r.name || r.id), version: r.version || "",
        min_sbpress_version: String(m.min_sbpress_version || ""),
        max_sbpress_version: String(m.max_sbpress_version || ""),
        requires: (m.requires && typeof m.requires === "object") ? m.requires : {},
        stats: {}
      }, r));
    });
    return out;
  }

  function compatPanelHtml(inst) {
    var lang = inst.lang;
    var rows = compatRows(inst);
    var core = coreVer(inst);
    var nOk = 0, nWarn = 0, nUnv = 0;
    rows.forEach(function (r) {
      if (r.state === "warn") nWarn += 1;
      else if (r.state === "unverified") nUnv += 1;
      else nOk += 1;
    });
    var items = rows.map(function (r) {
      var c = r.compat;
      var stateText = r.state === "warn" ? tr(lang, "compatWarn")
        : r.state === "unverified" ? tr(lang, "compatUnverified") : tr(lang, "compatOk");
      var bits = [];
      bits.push((c.min ? tr(lang, "compatMin") + " v" + c.min : tr(lang, "compatMin") + " —") + " · " +
                (c.max ? tr(lang, "compatMax") + " v" + c.max : tr(lang, "compatMax") + " —"));
      var declared = Object.keys(c.req || {}).filter(function (k) {
        return k === "blocksApi" || k === "securityApi";
      });
      bits.push(tr(lang, "compatHooksShort") + " " + (c.hooksBad.length
        ? c.hooksBad.map(function (h) { return h.api + " " + h.have + "/" + h.need; }).join(", ")
        : (declared.length
            ? declared.map(function (k) { return k + " " + apiVer(k) + "/" + c.req[k]; }).join(", ")
            : tr(lang, "compatHooksOk"))));
      bits.push(c.stats.last_verified_version
        ? tr(lang, "compatVerifiedShort", { v: c.stats.last_verified_version })
        : tr(lang, "compatNotVerified"));
      if (r.errors) bits.push(tr(lang, "compatErrors", { n: r.errors }));
      if (r.failed) bits.push(tr(lang, "compatFailed"));
      return '<li class="mkt-compatrow is-' + r.state + '" data-compat-slug="' + esc(r.id) + '">' +
        '<div class="mkt-compatmain"><b>' + esc(r.name) + "</b> <code>v" + esc(r.version) + "</code> " +
          (r.installed
            ? '<span class="plug-badge ' + (r.enabled ? "b-on" : "b-off") + '">' +
              esc(tr(lang, r.enabled ? "installedOn" : "installedOff")) + "</span>"
            : '<span class="mkt-compat-market">' + esc(tr(lang, "compatMarketOnly")) + "</span>") +
          ' <span class="mkt-compat is-' + r.state + '">' + esc(stateText) + "</span></div>" +
        '<p class="mkt-compatmeta">' + esc(bits.join(" · ")) + "</p></li>";
    }).join("");
    var fl = COMPAT.flash || {};
    return '<section class="mkt-compatpanel" id="mkt-compat" aria-labelledby="mkt-compat-title">' +
      '<div class="mkt-compathead"><div><h3 id="mkt-compat-title">' + esc(tr(lang, "compatTitle")) + "</h3>" +
        '<p class="mkt-compatlead">' + esc(tr(lang, "compatLead", { v: core })) + "</p></div>" +
        '<div class="mkt-compatactions"><button type="button" class="btn btn-primary btn-sm" data-mkt-compat-run="1">' +
          esc(tr(lang, "compatRun")) + "</button></div></div>" +
      '<p class="mkt-compat-sum" id="mkt-compat-sum" role="status" aria-live="polite">' +
        esc(tr(lang, "compatSummary", { n: rows.length, ok: nOk, warn: nWarn, unv: nUnv, v: core })) + "</p>" +
      (rows.length ? '<ul class="mkt-compatlist">' + items + "</ul>"
                   : '<p class="mkt-note">' + esc(tr(lang, "compatEmpty")) + "</p>") +
      (STATS.tableMissing ? '<p class="mkt-note mkt-warn" id="mkt-compat-missing">' + esc(tr(lang, "compatNeedSql")) + "</p>" : "") +
      (fl.text ? '<p class="mkt-compat-msg' + (fl.kind ? " " + esc(fl.kind) : "") + '" role="status" aria-live="polite">' +
        esc(fl.text) + "</p>" : "") +
      "</section>";
  }

  function runCompatCheck(inst, btn) {
    if (!inst || inst.mode !== "admin" || COMPAT.busy) return;
    var lang = inst.lang;
    var core = coreVer(inst);
    var rows = compatRows(inst);
    COMPAT.busy = true;
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "compatRunning"); }
    var queue = rows.slice();
    var okCount = 0, warnCount = 0, unvCount = 0, failed = 0;
    function finish() {
      COMPAT.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = tr(lang, "compatRun"); }
      var msg = tr(lang, "compatDone", { n: rows.length, ok: okCount, warn: warnCount, unv: unvCount });
      if (failed) msg += " " + tr(lang, "compatSaveFailed", { n: failed });
      else if (STATS.tableMissing) msg += " " + tr(lang, "compatNeedSql");
      COMPAT.flash = { text: msg, kind: failed ? "err" : "ok" };
      repaintStats(inst, true);
      flash(inst, msg, failed ? "err" : "ok");
    }
    function step() {
      if (!queue.length) { finish(); return; }
      var r = queue.shift();
      var c = r.compat;
      var ok = r.state !== "warn";
      if (r.state === "warn") warnCount += 1;
      else if (r.state === "unverified") unvCount += 1;
      else okCount += 1;
      var note = "core " + core + (c.min ? " · min " + c.min : "") + (c.max ? " · max " + c.max : "") +
        " · hooks blocksApi " + apiVer("blocksApi") + " securityApi " + apiVer("securityApi") +
        (c.note ? " · " + c.note : "");
      setLocalStats(r.id, {
        last_verified_version: core, compat_ok: ok, compat_note: note.slice(0, 500),
        install_count: c.stats.install_count, active_count: c.stats.active_count,
        avg_rating: c.stats.avg_rating, review_count: c.stats.review_count
      });
      if (!sbCfg().url || STATS.tableMissing) { step(); return; }
      sbRequest("/rest/v1/rpc/update_plugin_compat", {
        method: "POST", token: sbToken(),
        body: { p_slug: r.id, p_version: core, p_ok: ok, p_note: note.slice(0, 500) }
      }).then(function () { step(); }, function (e) {
        if (!missingRpc(e) && !missingTable(e)) failed += 1;
        step();
      });
    }
    step();
  }

  /* ---------------- 화면 조각 ---------------- */
  function chipRow(inst, group, labelText, values, current) {
    var lang = inst.lang;
    var html = '<span class="mkt-chip-label">' + esc(labelText) + "</span>" +
      '<button type="button" class="mkt-chip' + (current ? "" : " on") + '" data-mkt-' + group + '="" ' +
      'aria-pressed="' + (current ? "false" : "true") + '">' + esc(tr(lang, group === "market" ? "allMarkets" : "all")) + "</button>";
    values.forEach(function (v) {
      var label = group === "category" ? catLabel(inst, v)
        : (group === "hook" ? hookLabel(v, lang) : (group === "market" ? marketLabel(inst, v) : tagLabel(inst, v)));
      var on = current === v;
      html += '<button type="button" class="mkt-chip' + (on ? " on" : "") + '" data-mkt-' + group + '="' +
        esc(v) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + "</button>";
    });
    return html;
  }

  function tagLabel(inst, tag) {
    if (inst.lang !== "en") return tag;
    var list = inst.data.plugins || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var k = p.tags.indexOf(tag);
      if (k >= 0 && p.tags_en[k]) return p.tags_en[k];
    }
    return tag;
  }

  function shotUrl(inst, shot) {
    return abs(shot.src, inst.url);
  }

  /* ---------------- v10.10 — 가격 · 라이선스 표시 ---------------- */
  function isPaid(p) {
    return !!(p && (p.pricing === "paid" || p.license_required === true));
  }

  function priceLabelOf(inst, p) {
    if (!isPaid(p)) return tr(inst.lang, "priceFree");
    var lbl = inst.lang === "en" ? (p.price_label_en || p.price_label) : (p.price_label || p.price_label_en);
    return String(lbl || "").trim() || tr(inst.lang, "pricePaid");
  }

  function planLabel(inst, plan) {
    var p = String(plan || "").toLowerCase();
    if (!p) return "";
    if (p === "free") return tr(inst.lang, "licPlanFree");
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  function priceBadge(inst, p, short) {
    if (!p) return "";
    if (!isPaid(p)) {
      return '<span class="mkt-price is-free" data-mkt-price-badge="' + esc(p.id) + '">' +
        esc(tr(inst.lang, "priceFreeTag")) + "</span>";
    }
    return '<span class="mkt-price is-paid" data-mkt-price-badge="' + esc(p.id) + '" title="' +
      esc(tr(inst.lang, "licTag") + " · " + planLabel(inst, p.plan_type)) + '">' +
      esc(short ? tr(inst.lang, "pricePaid") : priceLabelOf(inst, p)) +
      ' <i class="mkt-plan">' + esc(planLabel(inst, p.plan_type)) + "</i></span>";
  }

  function priceChipsHtml(inst) {
    var lang = inst.lang, cur = inst.state.price || "";
    function chip(val, label) {
      var on = cur === val;
      return '<button type="button" class="mkt-chip' + (on ? " on" : "") + '" data-mkt-price="' + esc(val) +
        '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + "</button>";
    }
    return '<span class="mkt-chip-label">' + esc(tr(lang, "fPrice")) + "</span>" +
      chip("", tr(lang, "all")) + chip("free", tr(lang, "priceFree")) + chip("paid", tr(lang, "pricePaid") + " · " + tr(lang, "licTag"));
  }

  function actionButtons(inst, p, place) {
    var lang = inst.lang;
    var row = installedRow(inst, p.id);
    var installed = !!row, on = !!(row && row.enabled);
    var u = updInfo(inst, p);
    var newer = !!(u && u.newer && !u.pinned);
    var attrs = ' data-mkt-place="' + esc(place) + '"';
    if (inst.mode !== "admin") {
      return '<button type="button" class="btn btn-ghost btn-sm" data-mkt-open="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "detail")) + "</button>";
    }
    if (!installed) {
      var bad = verifyOf(inst, p).state === "bad";
      return '<button type="button" class="btn btn-primary btn-sm"' + (bad ? " disabled" : "") +
        ' title="' + esc(bad ? tr(lang, "integrityBlocked") : "") + '" data-mplug-install="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "install")) + "</button>";
    }
    var html = '<button type="button" class="btn btn-ghost btn-sm" data-mplug-toggle="' + esc(p.id) + '"' + attrs + ">" +
      esc(tr(lang, on ? "turnOff" : "turnOn")) + "</button>";
    if (hasSettings(p)) {
      html += '<button type="button" class="btn btn-ghost btn-sm mkt-set-btn" data-mplug-settings="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "settings")) + "</button>";
    }
    if (newer) {
      html += '<button type="button" class="btn btn-primary btn-sm mkt-upd-btn" data-mplug-update="' + esc(p.id) + '"' + attrs +
        ' title="' + esc(tr(lang, "updAvail", { x: u.cur, y: u.next })) + '">' +
        esc(tr(lang, "updateNow")) + " v" + esc(u.next) + "</button>";
    }
    if (u && u.canRollback) {
      html += '<button type="button" class="btn btn-ghost btn-sm mkt-rb-btn" data-mplug-rollback="' + esc(p.id) + '"' + attrs +
        ' title="' + esc(tr(lang, "rollbackLead", { name: disp(inst, p).name, cur: u.cur, prev: u.prev })) + '">' +
        esc(tr(lang, place === "modal" ? "rollback" : "rollbackShort")) + "</button>";
    }
    html += '<button type="button" class="btn btn-ghost btn-sm danger" data-mplug-remove="' + esc(p.id) + '"' + attrs + ">" +
      esc(tr(lang, "remove")) + "</button>";
    if (place !== "modal") {
      html += '<button type="button" class="rowlink" data-mkt-open="' + esc(p.id) + '"' + attrs + ">" +
        esc(tr(lang, "detailShort")) + "</button>";
    }
    return html;
  }

  function cardHtml(inst, p) {
    var lang = inst.lang;
    var d = disp(inst, p);
    var row = installedRow(inst, p.id);
    var on = !!(row && row.enabled);
    var badge = row
      ? '<span class="plug-badge ' + (on ? "b-on" : "b-off") + '">' + esc(tr(lang, on ? "installedOn" : "installedOff")) + "</span>"
      : "";
    /* v10.4 — 어느 구독 마켓에서 온 플러그인인지 보여 줍니다. */
    var src = (p.marketName && (inst.marketCount || 0) > 1)
      ? '<span class="mkt-src' + (p.marketOfficial ? " is-official" : "") + '" data-mkt-card-src="' + esc(p.marketId) + '" title="' + esc(tr(lang, "srcBadge", { name: p.marketName })) + '">' +
        esc(p.marketOfficial ? tr(lang, "marketOfficialName") : p.marketName) + "</span>"
      : "";
    var upd = row ? updBadge(inst, p, false) : "";
    var sri = integrityBadge(inst, p, true);
    var grant = grantedBadge(inst, p);
    var price = priceBadge(inst, p, false);
    var shot = p.screenshots[0] || null;
    var thumb = shot
      ? '<img src="' + esc(shotUrl(inst, shot)) + '" alt="' + esc(lang === "en" ? (shot.alt_en || shot.alt || tr(lang, "screenshotAlt", { name: d.name })) : (shot.alt || tr(lang, "screenshotAlt", { name: d.name }))) + '" width="720" height="405" loading="lazy" decoding="async">'
      : '<span class="mkt-noshot">' + esc(tr(lang, "noShot")) + "</span>";
    /* 카테고리와 같은 이름의 태그는 한 번만 보여 줍니다. */
    var tags = d.tags.filter(function (t) { return t !== d.category; }).slice(0, 3).map(function (t) {
      return '<span class="plug-tag">' + esc(t) + "</span>";
    }).join("");
    return '<article class="plug-card mkt-card" data-market-id="' + esc(p.id) + '" data-mkt-card="' + esc(p.id) + '">' +
      '<div class="mkt-thumb">' + thumb + "</div>" +
      "<h3>" + esc(d.name) + " " + badge + (upd ? " " + upd : "") + " " + price + " " + src + (sri ? " " + sri : "") + "</h3>" +
      '<p class="plug-desc">' + esc(d.desc) + "</p>" +
      '<div class="plug-meta mkt-meta">' +
        '<span class="plug-tag ver">v' + esc(p.version) + "</span>" +
        (d.author ? '<span class="mkt-author">' + esc(d.author) + "</span>" : "") +
        (d.category ? '<span class="plug-tag cat">' + esc(d.category) + "</span>" : "") +
        tags + (grant ? " " + grant : "") +
      "</div>" +
      '<div class="mkt-statrow">' + ratingChip(inst, p) + installChip(inst, p) + compatBadge(inst, p, true) + "</div>" +
      '<div class="plug-actions mkt-actions">' + actionButtons(inst, p, "card") + "</div>" +
      "</article>";
  }

  /* ---------------- 상세 모달 ---------------- */
  var MODAL = { el: null, lastFocus: null, inst: null, id: "" };
  /* v10.3 — 롤백 확인 UI 상태(지금 확인 창을 열어 둔 플러그인)와 잠시 보이는 안내 문구 */
  var RB = { id: "", busy: false };
  var FLASH = { text: "", kind: "" };

  function ensureModal() {
    if (MODAL.el && document.body.contains(MODAL.el)) return MODAL.el;
    var el = document.createElement("div");
    el.className = "mkt-modal";
    el.id = "mkt-modal";
    el.hidden = true;
    el.innerHTML =
      '<div class="mkt-modal-backdrop" data-mkt-close="1"></div>' +
      '<div class="mkt-modal-card" role="dialog" aria-modal="true" aria-labelledby="mkt-modal-title">' +
        '<header class="mkt-modal-head">' +
          '<h2 id="mkt-modal-title"></h2>' +
          '<button type="button" class="mkt-modal-x" data-mkt-close="1" aria-label="' + esc(tr(currentLang(), "close")) + '">×</button>' +
        "</header>" +
        '<div class="mkt-modal-body" id="mkt-modal-body"></div>' +
        '<footer class="mkt-modal-foot" id="mkt-modal-foot"></footer>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      var closer = e.target.closest ? e.target.closest("[data-mkt-close]") : null;
      if (closer) { closeDetail(); return; }
      /* v10.7 — 별점 고르기 · 리뷰 저장 · 관리자 숨김/복원/삭제 */
      var revSave = e.target.closest ? e.target.closest("[data-mkt-rev-save]") : null;
      if (revSave && MODAL.inst) {
        saveReview(MODAL.inst, byId(MODAL.inst, revSave.getAttribute("data-mkt-rev-save")), revSave);
        return;
      }
      var rate = e.target.closest ? e.target.closest("[data-mkt-rate]") : null;
      if (rate && MODAL.inst) {
        REV.rating = num(rate.getAttribute("data-mkt-rate"));
        var rp = byId(MODAL.inst, REV.slug);
        if (rp) paintReviews(MODAL.inst, rp);
        return;
      }
      var revHide = e.target.closest ? e.target.closest("[data-mkt-rev-hide]") : null;
      if (revHide && MODAL.inst) {
        moderateReview(MODAL.inst, byId(MODAL.inst, REV.slug), revHide.getAttribute("data-mkt-rev-hide"), "hidden", revHide);
        return;
      }
      var revShow = e.target.closest ? e.target.closest("[data-mkt-rev-show]") : null;
      if (revShow && MODAL.inst) {
        moderateReview(MODAL.inst, byId(MODAL.inst, REV.slug), revShow.getAttribute("data-mkt-rev-show"), "published", revShow);
        return;
      }
      var revDel = e.target.closest ? e.target.closest("[data-mkt-rev-del]") : null;
      if (revDel && MODAL.inst) {
        deleteReview(MODAL.inst, byId(MODAL.inst, REV.slug), revDel.getAttribute("data-mkt-rev-del"), revDel);
        return;
      }
      var action = e.target.closest ? e.target.closest("[data-mplug-install],[data-mplug-toggle],[data-mplug-update],[data-mplug-rollback],[data-mplug-remove],[data-mplug-settings]") : null;
      if (action) {
        var inst = MODAL.inst;
        if (!inst) return;
        if (action.hasAttribute("data-mplug-settings")) openSettings(inst, action.getAttribute("data-mplug-settings"));
        else if (action.hasAttribute("data-mplug-install")) runAction(inst, "onInstall", action.getAttribute("data-mplug-install"), action, true);
        else if (action.hasAttribute("data-mplug-toggle")) runAction(inst, "onToggle", action.getAttribute("data-mplug-toggle"), action, true);
        else if (action.hasAttribute("data-mplug-update")) runAction(inst, "onUpdate", action.getAttribute("data-mplug-update"), action, true);
        else if (action.hasAttribute("data-mplug-rollback")) openRollback(inst, action.getAttribute("data-mplug-rollback"));
        else if (action.hasAttribute("data-mplug-remove")) runAction(inst, "onRemove", action.getAttribute("data-mplug-remove"), action, true);
      }
      var cancel = e.target.closest ? e.target.closest("[data-mkt-rb-cancel]") : null;
      if (cancel) {
        RB.id = "";
        if (MODAL.inst && MODAL.id) openDetail(MODAL.inst, MODAL.id, true);
        return;
      }
      var go = e.target.closest ? e.target.closest("[data-mkt-rb-go]") : null;
      if (go) { doRollback(MODAL.inst, go.getAttribute("data-mkt-rb-go"), go); return; }
      var rc = e.target.closest ? e.target.closest("[data-mkt-recheck]") : null;
      if (rc) { recheckIntegrity(MODAL.inst, rc.getAttribute("data-mkt-recheck"), rc); return; }
      /* v10.10 — 상세에서 라이선스 키를 (다시) 확인합니다. */
      var lo = e.target.closest ? e.target.closest("[data-mkt-lic-open]") : null;
      if (lo && MODAL.inst) {
        var lid = lo.getAttribute("data-mkt-lic-open");
        var lp = byId(MODAL.inst, lid);
        if (lp) openLicense(MODAL.inst, lp, function () {
          if (MODAL.el && !MODAL.el.hidden) openDetail(MODAL.inst, lid, true);
          if (MODAL.inst && MODAL.inst.data) { paintTools(MODAL.inst); render(MODAL.inst); }
        });
        return;
      }
    });
    document.addEventListener("keydown", function (e) {
      if (!MODAL.el || MODAL.el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeDetail(); }
    });
    MODAL.el = el;
    return el;
  }

  function openDetail(inst, id, keepFocus) {
    var p = byId(inst, id);
    if (!p) return;
    var el = ensureModal();
    MODAL.inst = inst;
    MODAL.id = id;
    MODAL.lastFocus = document.activeElement;
    var lang = inst.lang;
    var d = disp(inst, p);
    var row = installedRow(inst, p.id);
    var u = updInfo(inst, p);
    var cur = String((inst.data && inst.data.sbpress) || "");
    var minV = p.min_sbpress_version;
    var compat = !minV || !cur || verNum(minV) <= verNum(cur);
    var st = statsOf(inst, p);
    var cmp = compatOf(inst, p);
    el.querySelector("#mkt-modal-title").textContent = d.name;
    var shots = p.screenshots.length
      ? '<div class="mkt-shots">' + p.screenshots.map(function (s) {
          return '<figure class="mkt-shot"><img src="' + esc(shotUrl(inst, s)) + '" alt="' +
            esc(lang === "en" ? (s.alt_en || s.alt || tr(lang, "screenshotAlt", { name: d.name })) : (s.alt || tr(lang, "screenshotAlt", { name: d.name }))) +
            '" width="720" height="405" loading="lazy" decoding="async"></figure>';
        }).join("") + "</div>"
      : '<p class="mkt-note">' + esc(tr(lang, "noShot")) + "</p>";
    var facts =
      '<dl class="mkt-facts">' +
        "<div><dt>" + esc(tr(lang, "version")) + "</dt><dd><b>v" + esc(p.version) + "</b> " +
          (row ? '<span class="plug-badge ' + (row.enabled ? "b-on" : "b-off") + '">' +
            esc(tr(lang, row.enabled ? "installedOn" : "installedOff")) + "</span>" : "") +
          (u && u.newer ? " " + updBadge(inst, p, false) : "") +
          (u && u.older ? ' <span class="mkt-warn">' + esc(tr(lang, "olderTag", { x: u.cur })) + "</span>" : "") +
          (u && u.same && row ? ' <span class="mkt-ok">' + esc(tr(lang, "latestTag")) + "</span>" : "") +
          (u && u.pinned ? " " + updBadge(inst, p, true) : "") + "</dd></div>" +
        (d.author ? "<div><dt>" + esc(tr(lang, "author")) + "</dt><dd>" + esc(d.author) + "</dd></div>" : "") +
        "<div><dt>" + esc(tr(lang, "minVersion")) + "</dt><dd>v" + esc(minV || "1.0") + " " +
          (cur ? '<span class="muted">· ' + esc(tr(lang, "currentVersion", { v: "v" + cur })) + "</span>" : "") + " " +
          (compat ? '<span class="mkt-ok">' + esc(tr(lang, "compatOk")) + "</span>"
                  : '<span class="mkt-warn">' + esc(tr(lang, "compatNo", { v: minV })) + "</span>") + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "ratingLabel")) + "</dt><dd>" + starBar(st.avg_rating) + " <b>" +
          esc(ratingText(st.avg_rating)) + "</b> " + '<span class="muted">' +
          esc(tr(lang, st.review_count === 1 ? "reviewOne" : "reviewsCount", { n: st.review_count })) + "</span></dd></div>" +
        "<div><dt>" + esc(tr(lang, "installsLabel")) + "</dt><dd>" + esc(tr(lang, "installsCount", { n: st.install_count })) +
          (st.active_count ? ' <span class="muted">· ' + esc(tr(lang, "activeCount", { n: st.active_count })) + "</span>" : "") + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "compatLabel")) + "</dt><dd>" + compatBadge(inst, p, false) +
          (cmp.min ? ' <span class="muted">' + esc(tr(lang, "compatMin")) + " v" + esc(cmp.min) + "</span>" : "") +
          (cmp.max ? ' <span class="muted">· ' + esc(tr(lang, "compatMax")) + " v" + esc(cmp.max) + "</span>" : "") + "</dd></div>" +
        (p.updated ? "<div><dt>" + esc(tr(lang, "updated")) + "</dt><dd>" + esc(p.updated) + "</dd></div>" : "") +
        /* v10.10 — 가격 · 플랜 */
        "<div><dt>" + esc(tr(lang, "priceLabel")) + "</dt><dd>" + priceBadge(inst, p, false) +
          (isPaid(p) ? ' <span class="muted">' + esc(tr(lang, "planLabel")) + " " + esc(planLabel(inst, p.plan_type)) + "</span>" : "") + "</dd></div>" +
        (d.category ? "<div><dt>" + esc(tr(lang, "category")) + "</dt><dd>" + esc(d.category) + "</dd></div>" : "") +
        (p.hooks.length ? "<div><dt>" + esc(tr(lang, "hooks")) + "</dt><dd>" + p.hooks.map(function (h) {
          return '<i class="plug-tag hook">' + esc(hookLabel(h, lang)) + "</i>";
        }).join(" ") + "</dd></div>" : "") +
        (d.tags.length ? "<div><dt>" + esc(tr(lang, "tags")) + "</dt><dd>" + d.tags.map(function (t) {
          return '<i class="plug-tag">' + esc(t) + "</i>";
        }).join(" ") + "</dd></div>" : "") +
      "</dl>";
    var perms = p.permissions.length
      ? '<ul class="mkt-perms">' + p.permissions.map(function (x) {
          return "<li><code>" + esc(x) + "</code><span>" + esc(permText(x, lang)) + "</span></li>";
        }).join("") + "</ul>"
      : '<p class="mkt-note">' + esc(tr(lang, "noPermissions")) + "</p>";
    /* v10.5 — 무결성 · 권한 동의 · 샌드박스 */
    var grantedList = grantedOf(inst, p);
    var trustSec = '<section class="mkt-sec mkt-trust" id="mkt-trust"><h3>' + esc(tr(lang, "trustTitle")) + "</h3>" +
      '<dl class="mkt-facts">' +
        "<div><dt>" + esc(tr(lang, "consentIntegrity")) + "</dt><dd>" +
          integrityBadge(inst, p, false) + " " +
          (p.integrity ? '<code class="mkt-sri-code">' + esc(p.integrity.length > 30 ? p.integrity.slice(0, 30) + "…" : p.integrity) + "</code>" : "") +
        "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "permissions")) + "</dt><dd>" + grantedBadge(inst, p) + " " +
          (grantedList.length ? grantedList.map(function (x) { return '<i class="plug-tag">' + esc(x) + "</i>"; }).join(" ") : "") +
        "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "sandboxMode")) + "</dt><dd>" +
          esc(p.sandbox_mode === "standard" ? tr(lang, "consentSandboxStandard") : tr(lang, "consentSandboxStrict")) + "</dd></div>" +
      "</dl>" +
      '<p class="mkt-note">' + esc(tr(lang, "integrityHint")) + "</p>" +
      (inst.mode === "admin"
        ? '<div class="mkt-trust-actions"><button type="button" class="btn btn-ghost btn-sm" data-mkt-recheck="' + esc(p.id) + '">' +
          esc(tr(lang, "integrityRecheck")) + "</button></div>"
        : "") +
      "</section>";
    /* v10.10 — 유료 플러그인의 라이선스 상태 — 설치 전/후 모두 보여 줍니다. */
    var licSec = "";
    if (isPaid(p)) {
      var ls = licenseStateOf(inst, p);
      licSec = '<section class="mkt-sec mkt-licsec" id="mkt-licsec"><h3>' + esc(tr(lang, "licStateLabel")) + "</h3>" +
        '<p class="mkt-note mkt-lic-state">' + (ls.ok
          ? esc(tr(lang, "licStateOk", { plan: planLabel(inst, ls.plan) })) + ' · <code>' + esc(ls.key) + "</code>"
          : esc(tr(lang, "licStateNone"))) + "</p>" +
        (inst.mode === "admin"
          ? '<div class="mkt-licsec-acts"><button type="button" class="btn btn-ghost btn-sm" data-mkt-lic-open="' + esc(p.id) + '">' +
            esc(tr(lang, ls.ok ? "licChange" : "licOpen")) + "</button></div>"
          : "") +
        "</section>";
    }
    var log = p.changelog.length
      ? '<ol class="mkt-log">' + p.changelog.map(function (c) {
          return "<li>" + (c.version ? "<b>v" + esc(c.version) + "</b>" : "") +
            (c.date ? '<time datetime="' + esc(c.date) + '">' + esc(c.date) + "</time>" : "") +
            "<p>" + esc(lang === "en" ? (c.notes_en || c.notes) : c.notes) + "</p></li>";
        }).join("") + "</ol>"
      : '<p class="mkt-note">' + esc(tr(lang, "noChangelog")) + "</p>";
    /* v10.3 — 설치된 버전 뒤에 나온 변경만 따로 보여 줍니다(업데이트 전에 무엇이 바뀌는지). */
    var updSec = "";
    if (u && u.newer) {
      var since = changesSince(p, u.cur);
      updSec = '<section class="mkt-sec mkt-updsec" id="mkt-updsec"><h3>' + esc(tr(lang, "changesTitle")) + "</h3>" +
        '<p class="mkt-updnote">' + esc(tr(lang, "updAvail", { x: u.cur, y: u.next })) + "</p>" +
        (since.length
          ? '<ol class="mkt-log mkt-log-new">' + since.map(function (c) {
              return "<li>" + (c.version ? "<b>v" + esc(c.version) + "</b>" : "") +
                (c.date ? '<time datetime="' + esc(c.date) + '">' + esc(c.date) + "</time>" : "") +
                "<p>" + esc(lang === "en" ? (c.notes_en || c.notes) : c.notes) + "</p></li>";
            }).join("") + "</ol>"
          : '<p class="mkt-note">' + esc(tr(lang, "changesNone", { v: u.cur })) + "</p>") +
        "</section>";
    }
    /* v10.3 — 직전 스냅샷이 있으면 버전 이력과 롤백 확인 UI 를 보여 줍니다. */
    var rbSec = "";
    if (u && (u.canRollback || u.history.length)) {
      var hist = u.history.slice(0, 5).map(function (h) {
        if (!h || typeof h !== "object") return "";
        return "<li><b>v" + esc(h.version || "?") + "</b>" +
          (h.at ? '<time datetime="' + esc(dateText(h.at)) + '">' + esc(dateText(h.at)) + "</time>" : "") + "</li>";
      }).join("");
      rbSec = '<section class="mkt-sec mkt-rbsec" id="mkt-history"><h3>' + esc(tr(lang, "historyTitle")) + "</h3>" +
        (hist ? '<ol class="mkt-hist">' + hist + "</ol>"
              : '<p class="mkt-note">' + esc(tr(lang, "historyEmpty")) + "</p>");
      if (u.canRollback && RB.id === p.id && inst.mode === "admin") {
        rbSec += '<div class="mkt-rb" id="mkt-rollback">' +
          '<h4>' + esc(tr(lang, "rollbackTitle")) + "</h4>" +
          "<p>" + esc(tr(lang, "rollbackLead", { name: d.name, cur: u.cur, prev: u.prev })) + "</p>" +
          '<p class="mkt-note">' + esc(tr(lang, "rollbackKeep")) + "</p>" +
          (u.history.length ? '<p class="mkt-note">' + esc(tr(lang, "historyLeft", { n: u.history.length })) + "</p>" : "") +
          '<p class="mkt-rb-msg" id="mkt-rb-msg" role="status" aria-live="polite"></p>' +
          '<div class="mkt-rb-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-mkt-rb-cancel="1">' + esc(tr(lang, "rollbackCancel")) + "</button>" +
            '<button type="button" class="btn btn-primary btn-sm danger" data-mkt-rb-go="' + esc(p.id) + '">' +
              esc(tr(lang, "rollbackGo", { prev: u.prev })) + "</button>" +
          "</div></div>";
      }
      rbSec += "</section>";
    }
    el.querySelector("#mkt-modal-body").innerHTML =
      shots +
      (d.desc ? '<p class="mkt-desc-full">' + esc(d.desc) + "</p>" : "") +
      facts +
      licSec +
      trustSec +
      '<section class="mkt-sec mkt-revsec" id="mkt-revsec"><h3>' + esc(tr(lang, "reviewTitle")) +
        '</h3><div id="mkt-reviews"></div></section>' +
      updSec +
      rbSec +
      '<section class="mkt-sec"><h3>' + esc(tr(lang, "permissions")) + "</h3>" + perms + "</section>" +
      '<section class="mkt-sec"><h3>' + esc(tr(lang, "changelog")) + "</h3>" + log + "</section>";
    var foot = "";
    if (inst.mode === "admin") {
      foot = '<span class="mkt-foot-id muted">' + esc(p.id) + "</span>" + actionButtons(inst, p, "modal");
    } else {
      foot = '<p class="mkt-note">' + esc(tr(lang, "adminOnly")) + "</p>" +
        '<a class="btn btn-ghost btn-sm" href="/admin" rel="nofollow">' + esc(tr(lang, "goAdmin")) + "</a>";
    }
    el.querySelector("#mkt-modal-foot").innerHTML = foot;
    /* v10.7 — 리뷰 목록·작성 폼은 따로 채웁니다(불러오는 동안 나머지 화면은 그대로). */
    loadReviews(inst, p);
    el.querySelector(".mkt-modal-x").setAttribute("aria-label", tr(lang, "close"));
    var wasOpen = !el.hidden;
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    if (!(keepFocus && wasOpen)) {
      try { el.querySelector(".mkt-modal-x").focus(); } catch (e) { /* noop */ }
    }
  }

  function closeDetail() {
    if (!MODAL.el) return;
    RB.id = "";
    REV.slug = ""; REV.items = null; REV.mine = null; REV.msg = ""; REV.msgKind = ""; REV.rating = 0;
    MODAL.el.hidden = true;
    MODAL.el.querySelector("#mkt-modal-body").innerHTML = "";
    MODAL.el.querySelector("#mkt-modal-foot").innerHTML = "";
    MODAL.inst = null;
    MODAL.id = "";
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (MODAL.lastFocus && MODAL.lastFocus.focus) MODAL.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  /* ---------------- v10.3 — 업데이트 · 롤백 동작 ---------------- */
  /* 화면 위쪽에 잠시 남는 안내 — 다시 그려도 사라지지 않게 FLASH 에도 담아 둡니다. */
  function flash(inst, text, kind) {
    FLASH = { text: String(text || ""), kind: kind || "" };
    var box = inst && inst.tools ? inst.tools.querySelector("#mkt-flash") : null;
    if (!box) box = document.getElementById("mkt-flash");
    if (box) { box.textContent = FLASH.text; box.className = "mkt-flash" + (FLASH.kind ? " " + FLASH.kind : ""); }
  }

  function openRollback(inst, id) {
    var p = byId(inst, id);
    if (!p || inst.mode !== "admin") return;
    var u = updInfo(inst, p);
    if (!u || !u.canRollback) { flash(inst, tr(inst.lang, "rollbackNone"), "err"); return; }
    RB.id = id;
    openDetail(inst, id);
    var box = MODAL.el ? MODAL.el.querySelector("#mkt-rollback") : null;
    if (box && box.scrollIntoView) { try { box.scrollIntoView({ block: "center" }); } catch (e) { /* noop */ } }
  }

  function doRollback(inst, id, btn) {
    if (!inst || !id || typeof inst.onRollback !== "function" || RB.busy) return;
    var p = byId(inst, id);
    var u = p ? updInfo(inst, p) : null;
    var lang = inst.lang;
    var prev = u ? u.prev : "";
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "rollbackBusy"); }
    RB.busy = true;
    inst.onRollback(id, function (err, res) {
      RB.busy = false;
      var got = res && res.version ? String(res.version) : prev;
      if (err) {
        var msg = MODAL.el ? MODAL.el.querySelector("#mkt-rb-msg") : null;
        if (msg) { msg.textContent = tr(lang, "rollbackFailed") + err; msg.className = "mkt-rb-msg err"; }
        if (btn) { btn.disabled = false; btn.textContent = tr(lang, "rollbackGo", { prev: prev }); }
        return;
      }
      RB.id = "";
      closeDetail();
      flash(inst, tr(lang, "rollbackDone", { prev: got }), "ok");
    });
  }

  /* 상단 「전체 업데이트」 — 관리자 화면이 넘긴 onUpdateAll(목록) 로 차례차례 처리하고,
     그 콜백이 없으면 onUpdate 를 하나씩 부릅니다. */
  function runUpdateAll(inst, btn) {
    if (!inst || inst.mode !== "admin") return;
    var ids = updIds(inst);
    var lang = inst.lang;
    if (!ids.length) { flash(inst, tr(lang, "updAllDone", { n: 0 }), "ok"); return; }
    var total = ids.length, okCount = 0, failed = 0;
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "updAllBusy", { i: 1, n: total }); }
    function finish(err, res) {
      if (btn) { btn.disabled = false; btn.textContent = tr(lang, "updAll"); }
      var bad = err ? total : (res && res.failed) || 0;
      var skip = (res && res.skipped) ? res.skipped.length : 0;
      var good = (res && res.updated != null) ? res.updated : Math.max(0, total - bad);
      var text = bad ? tr(lang, "updAllFailed", { n: bad }) : tr(lang, "updAllDone", { n: good });
      if (skip) text += " " + tr(lang, "updAllSkipped", { n: skip });
      flash(inst, text, bad ? "err" : "ok");
      if (typeof inst.onRefresh === "function") { try { inst.onRefresh(); } catch (e) { /* noop */ } }
    }
    if (typeof inst.onUpdateAll === "function") {
      try { inst.onUpdateAll(ids, finish); } catch (e) { finish(e && e.message ? e.message : "error"); }
      return;
    }
    var i = 0;
    next();
    function next() {
      if (i >= ids.length) { finish(null, { updated: okCount, failed: failed }); return; }
      if (btn) btn.textContent = tr(lang, "updAllBusy", { i: i + 1, n: total });
      var id = ids[i++];
      if (typeof inst.onUpdate !== "function") { failed += 1; next(); return; }
      inst.onUpdate(id, null, function (err) {
        if (err) failed += 1; else okCount += 1;
        setTimeout(next, 120);
      });
    }
  }

  function runAction(inst, name, id, btn, inModal) {
    var fn = inst[name];
    if (typeof fn !== "function") return;
    if (name === "onInstall" || name === "onUpdate") {
      var p = byId(inst, id);
      var mode = name === "onUpdate" ? "update" : "install";
      /* v10.10 — 유료 플러그인은 설치 전에 라이선스 키를 먼저 확인합니다. */
      if (mode === "install" && p) {
        var lic = licenseStateOf(inst, p);
        if (lic.required && !lic.ok) {
          openLicense(inst, p, function () {
            runAction(inst, name, id, btn, inModal);
          });
          return;
        }
      }
      var need = p ? consentNeeded(inst, p, mode) : { ok: true };
      if (!need.ok) {
        if (need.reason === "integrity") { flash(inst, tr(inst.lang, "integrityBlocked"), "err"); return; }
        openConsent(inst, p, mode, need.perms || (p ? p.permissions : []), function (info) {
          runActionNow(inst, name, id, btn, inModal, info);
        });
        return;
      }
      runActionNow(inst, name, id, btn, inModal, need.auto || null);
      return;
    }
    runActionNow(inst, name, id, btn, inModal, null);
  }

  function runActionNow(inst, name, id, btn, inModal, consent) {
    var fn = inst[name];
    if (typeof fn !== "function") return;
    var lang = inst.lang;
    /* v10.10 — 확인된 라이선스를 설치 호출에 함께 넘깁니다(관리자 화면이 기록에 남깁니다). */
    var license = null;
    if (name === "onInstall") {
      var lp = byId(inst, id);
      var ls = lp ? licenseStateOf(inst, lp) : null;
      if (ls && ls.required && ls.ok) license = ls.info || { key: ls.key, plan: ls.plan };
    }
    if (btn && btn.tagName === "BUTTON") {
      btn.disabled = true;
      if (name === "onInstall" && !btn.getAttribute("data-busy")) {
        btn.setAttribute("data-busy", "1");
        btn.textContent = tr(lang, "installing");
      }
      if (name === "onUpdate") {
        btn.setAttribute("data-busy", "1");
        btn.textContent = tr(lang, "updating");
      }
    }
    /* v10.3 — 업데이트는 끝난 뒤 안내 문구를 남깁니다(관리자 화면이 결과를 콜백으로 돌려줍니다). */
    var after = function (err, res) {
      if (name !== "onUpdate") return;
      var v = (res && res.version) ? String(res.version).replace(/^v/i, "") : "";
      if (err) flash(inst, tr(lang, "updateFailed") + err, "err");
      else flash(inst, tr(lang, "updatedDone", { v: v }), "ok");
    };
    try { fn(id, btn, after, consent, license); } catch (e) { after(e && e.message ? e.message : String(e)); }
    /* 동의·설치 뒤에는 무결성·권한 배지를 새로 그립니다. */
    if (consent) {
      setTimeout(function () {
        try {
          if (inst.data) { paintTools(inst); render(inst); }
          if (MODAL.el && !MODAL.el.hidden && MODAL.id === id) openDetail(inst, id, true);
        } catch (e) { /* noop */ }
      }, 420);
    }
    /* 콜백이 화면을 다시 그리면 버튼도 새로 만들어집니다. 상세 모달이 열려 있으면 함께 갱신합니다. */
    if (inModal) {
      [80, 700, 1500].forEach(function (ms) {
        setTimeout(function () {
          if (MODAL.el && !MODAL.el.hidden && MODAL.inst === inst) openDetail(inst, id, true);
        }, ms);
      });
    }
  }

  /* ---------------- v10.5 — 권한 동의 모달 ---------------- */
  var CNS = { el: null, inst: null, id: "", mode: "install", perms: [], next: null, lastFocus: null, item: null };

  function ensureConsentModal() {
    if (CNS.el && document.body.contains(CNS.el)) return CNS.el;
    var el = document.createElement("div");
    el.className = "mkt-modal mkt-consent";
    el.id = "mkt-consent";
    el.hidden = true;
    el.innerHTML =
      '<div class="mkt-modal-backdrop" data-mkt-consent-cancel="1"></div>' +
      '<div class="mkt-modal-card mkt-consent-card" role="dialog" aria-modal="true" aria-labelledby="mkt-consent-title">' +
        '<header class="mkt-modal-head">' +
          '<h2 id="mkt-consent-title"></h2>' +
          '<button type="button" class="mkt-modal-x" data-mkt-consent-cancel="1" aria-label="">×</button>' +
        "</header>" +
        '<div class="mkt-modal-body" id="mkt-consent-body"></div>' +
        '<footer class="mkt-modal-foot" id="mkt-consent-foot"></footer>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-mkt-consent-cancel]")) { closeConsent(); return; }
      var go = e.target.closest ? e.target.closest("[data-mkt-consent-go]") : null;
      if (!go) return;
      var inst = CNS.inst, next = CNS.next;
      var p = CNS.item || (CNS.inst && byId(CNS.inst, CNS.id));
      var info = {
        granted: (CNS.perms || []).slice(),
        integrity: (p && p.integrity) || "",
        mode: (p && p.sandbox_mode) || "strict",
        accepted: true
      };
      if (inst) {
        inst.consented = inst.consented || {};
        inst.consented[CNS.id] = { at: new Date().toISOString(), granted: info.granted };
      }
      closeConsent();
      if (typeof next === "function") { try { next(info); } catch (e) { /* noop */ } }
    });
    document.addEventListener("keydown", function (e) {
      if (!CNS.el || CNS.el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeConsent(); }
    });
    CNS.el = el;
    return el;
  }

  function consentPermRow(inst, perm, isNew) {
    var risk = permRisk(perm);
    return '<li class="mkt-perm' + (risk >= 3 ? " is-high" : "") + (isNew ? " is-new" : "") + '">' +
      '<span class="mkt-risk r' + risk + '">' + esc(riskLabel(inst, risk)) + "</span>" +
      '<code>' + esc(perm) + "</code>" +
      '<span class="mkt-perm-desc">' + esc(permText(perm, inst.lang)) + "</span>" +
      '<span class="mkt-perm-area">' + esc(permArea(inst, perm)) + "</span>" +
      (isNew ? '<em class="mkt-new">' + esc(tr(inst.lang, "consentNew")) + "</em>" : "") +
      "</li>";
  }

  function openConsent(inst, p, mode, perms, next) {
    if (!p || inst.mode !== "admin") return;
    var el = ensureConsentModal();
    var lang = inst.lang;
    CNS.inst = inst; CNS.id = p.id; CNS.mode = mode; CNS.perms = (perms || []).slice(0, 12); CNS.next = next;
    /* v10.6 — 마켓 목록에 없는 제출 항목은 byId 로 찾지 못하므로 항목 자체를 기억합니다. */
    CNS.item = (p && p.__submission) ? p : null;
    CNS.lastFocus = document.activeElement;
    var d = disp(inst, p);
    var isUpdate = mode === "update";
    var fresh = (mode === "update") ? newPermsFor(inst, p, "update") : [];
    var title = !CNS.perms.length
      ? tr(lang, isUpdate ? "consentTitleUpdate" : "consentTitle")
      : (isUpdate && fresh.length ? tr(lang, "consentTitleNew") : tr(lang, isUpdate ? "consentTitleUpdate" : "consentTitle"));
    el.querySelector("#mkt-consent-title").textContent = title;
    el.querySelector(".mkt-modal-x").setAttribute("aria-label", tr(lang, "consentCancel"));
    var lead = !CNS.perms.length
      ? tr(lang, "consentLeadNone", { name: d.name })
      : (isUpdate && fresh.length ? tr(lang, "consentLeadNew", { name: d.name }) : tr(lang, "consentLead", { name: d.name }));
    var v = verifyOf(inst, p);
    var integrityText = p.integrity
      ? '<code>' + esc(p.integrity.length > 26 ? p.integrity.slice(0, 26) + "…" : p.integrity) + "</code> " + integrityBadge(inst, p, false)
      : '<span class="mkt-note">' + esc(tr(lang, "consentIntegrityNone")) + "</span>";
    var modeText = (p.sandbox_mode === "standard") ? tr(lang, "consentSandboxStandard") : tr(lang, "consentSandboxStrict");
    el.querySelector("#mkt-consent-body").innerHTML =
      '<p class="mkt-consent-lead">' + esc(lead) + "</p>" +
      '<section class="mkt-consent-sec">' +
        '<h3>' + esc(CNS.perms.length ? tr(lang, isUpdate && fresh.length ? "consentNewPerms" : (CNS.perms.length === 1 ? "consentPermsOne" : "consentPerms"), { n: CNS.perms.length })
                                      : tr(lang, "consentNoPerms")) + "</h3>" +
        (CNS.perms.length ? '<ul class="mkt-perm-list">' + CNS.perms.map(function (x) {
          return consentPermRow(inst, x, fresh.indexOf(x) >= 0);
        }).join("") + "</ul>" : "") +
      "</section>" +
      '<dl class="mkt-facts mkt-consent-facts">' +
        "<div><dt>" + esc(tr(lang, "consentIntegrity")) + "</dt><dd>" + integrityText + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "consentSandbox")) + "</dt><dd>" + esc(modeText) + "</dd></div>" +
      "</dl>" +
      '<p class="mkt-note mkt-consent-note">' + esc(tr(lang, "consentNote")) + "</p>" +
      (v.state === "bad" ? '<p class="mkt-note mkt-err">' + esc(tr(lang, "integrityMismatch")) + "</p>" : "");
    el.querySelector("#mkt-consent-foot").innerHTML =
      '<span class="mkt-foot-id muted">' + esc(p.id) + "</span>" +
      '<button type="button" class="btn btn-ghost btn-sm" data-mkt-consent-cancel="1">' + esc(tr(lang, "consentCancel")) + "</button>" +
      '<button type="button" class="btn btn-primary btn-sm" data-mkt-consent-go="' + esc(p.id) + '"' +
        (v.state === "bad" ? " disabled" : "") + ">" +
        esc(tr(lang, isUpdate ? "consentAgreeUpdate" : "consentAgree")) + "</button>";
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    try { el.querySelector("[data-mkt-consent-go]").focus(); } catch (e) { /* noop */ }
  }

  function closeConsent() {
    if (!CNS.el) return;
    CNS.el.hidden = true;
    CNS.el.querySelector("#mkt-consent-body").innerHTML = "";
    CNS.el.querySelector("#mkt-consent-foot").innerHTML = "";
    CNS.inst = null; CNS.id = ""; CNS.next = null; CNS.perms = []; CNS.item = null;
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (CNS.lastFocus && CNS.lastFocus.focus) CNS.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  /* 「무결성 다시 검사」 — 다시 해시해 보고, 관리자 화면에 결과를 남깁니다. */
  function recheckIntegrity(inst, id, btn) {
    var p = byId(inst, id);
    if (!p) return;
    var lang = inst.lang;
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "integrityRechecking"); }
    delete inst.verify[p.id];
    verifyOne(inst, p).then(function (rec) {
      if (btn) { btn.disabled = false; btn.textContent = tr(lang, "integrityRecheck"); }
      var state = (rec && rec.state) || "unchecked";
      flash(inst, state === "ok" ? tr(lang, "integrityRechecked")
        : (state === "bad" ? tr(lang, "integrityMismatch") : tr(lang, "integrityUnchecked")), state === "ok" ? "ok" : "err");
      if (typeof inst.onRecheck === "function") {
        try { inst.onRecheck(id, rec || {}, function () { /* 안내는 위 flash 로 충분 */ }); } catch (e) { /* noop */ }
      }
      if (inst.data) { try { render(inst); } catch (e) { /* noop */ } }
      if (MODAL.el && !MODAL.el.hidden && MODAL.id === id) openDetail(inst, id, true);
    });
  }


  /* ============================================================================
     v10.6 — 플러그인 제출 · 자동 사전 점검 · 심사(검토) 큐
     ----------------------------------------------------------------------------
     · #/market 상단과 /admin 마켓의 「플러그인 제출」 모달 — 이름·슬러그·버전·요약·
       작성자·스크립트 URL·카테고리·훅·권한을 받습니다.
     · 자동 사전 점검 — URL 형식(https:// 또는 /), 파일을 읽어 SHA-256(crypto.subtle)을
       계산해 integrity 로 적고, eval·Function 생성자·document.cookie·script 태그 같은 위험한
       호출을 정적 검사합니다. CORS 로 읽지 못하는 외부 URL 은 "관리자 수동/로딩 시 검증"으로
       남기고 정상 진행합니다.
     · 저장 — supabase/27_v106_plugin_submissions.sql 을 실행했으면 plugin_submissions 표에,
       아직이면 이 브라우저(localStorage)에 저장하고 안내합니다(콘솔·CSP 오류 0).
     · 심사 큐(관리자) — 대기·승인·반려 필터와 건수 배지, 자동 점검 카드, 승인/반려(사유),
       승인된 항목의 「바로 설치」(v10.5 동의 모달) · 「마켓 JSON 복사/내보내기」.
     · 쓰기는 이 화면이 직접 REST 로 합니다(제출=회원 토큰, 심사=관리자 RPC).
       설치는 관리자 화면(admin.js)에 맡깁니다 — DB 쓰기 규칙이 한 곳에 모이게.
     ========================================================================== */
  var SUB_LS = "sbpress-plugin-submissions";
  var SUB = {
    el: null, inst: null, items: null, loaded: false, loading: false, tableMissing: false,
    filter: "pending", msg: "", msgKind: "", reject: "", busy: false,
    user: null, userChecked: false, verify: {}, lastCheck: null, lastUrl: "", lastFocus: null
  };

  /* ---------------- REST 도우미 (공개 화면의 cms.js 와 같은 방식) ---------------- */
  function sbCfg() {
    var C = window.CRAFT_SUPABASE || {};
    return { url: String(C.url || "").replace(/\/+$/, ""), key: String(C.anonKey || "") };
  }
  function sbRef() {
    return String(sbCfg().url || "").replace(/^https?:\/\//, "").split(".")[0];
  }
  /* 로그인 세션은 auth.js 와 같은 저장소(sb-<ref>-auth-token)를 읽습니다. */
  function sbToken() {
    try {
      var raw = localStorage.getItem("sb-" + sbRef() + "-auth-token");
      if (!raw) return "";
      var o = JSON.parse(raw);
      if (o && o.access_token) return String(o.access_token);
      if (o && o.currentSession && o.currentSession.access_token) return String(o.currentSession.access_token);
      return "";
    } catch (e) { return ""; }
  }
  function sbRequest(path, opts) {
    var c = sbCfg();
    if (!c.url || !c.key) return Promise.reject(new Error("supabase-missing"));
    opts = opts || {};
    var headers = { apikey: c.key, Accept: "application/json" };
    if (opts.body != null) headers["Content-Type"] = "application/json";
    var tok = opts.token != null ? opts.token : sbToken();
    headers.Authorization = "Bearer " + (tok || c.key);
    if (opts.prefer) headers.Prefer = opts.prefer;
    return fetch(c.url + path, {
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
  function missingRpc(e) {
    var code = String((e && e.code) || ""), m = String((e && e.message) || "");
    return code === "42883" || code === "PGRST202" || /Could not find the function|function .* does not exist/i.test(m);
  }

  /* 31_v1010 이 없을 때만 폴백합니다 — RPC 가 “라이선스를 찾지 못했습니다”(P0002) 같은
     404 를 돌려주는 경우는 표가 없는 것이 아닙니다. */
  function licRpcMissing(e) {
    if (!e) return false;
    if (String(e.code || "") === "P0002") return false;
    return missingRpc(e) || missingTable(e);
  }

  function subUser(cb) {
    if (SUB.userChecked) { cb(SUB.user); return; }
    var tok = sbToken();
    if (!tok) { SUB.userChecked = true; SUB.user = null; cb(null); return; }
    sbRequest("/auth/v1/user", { token: tok }).then(function (u) {
      SUB.user = (u && u.id && u.id !== "anon") ? u : null;
    }, function () { SUB.user = null; }).then(function () {
      SUB.userChecked = true;
      cb(SUB.user);
    });
  }

  /* ---------------- 자동 사전 점검 ---------------- */
  /* 정적 코드 검사 규칙 — 수준 1(참고) · 2(주의) · 3(위험). */
  var SCAN_RULES = [
    { id: "eval", re: /(^|[^\w$.])eval\s*\(/, level: 3 },
    { id: "new-function", re: /new\s+Function\s*\(/, level: 3 },
    { id: "cookie", re: /document\s*\.\s*cookie/, level: 3 },
    { id: "script-tag", re: /<\s*script/i, level: 3 },
    { id: "document-write", re: /document\s*\.\s*write\s*\(/, level: 2 },
    { id: "http", re: /http:\/\//i, level: 2 },
    { id: "innerhtml", re: /\.innerHTML\s*=/, level: 1 },
    { id: "storage", re: /localStorage/, level: 1 },
    { id: "external-fetch", re: /fetch\s*\(\s*["']https?:\/\//, level: 1 }
  ];
  var SCAN_KEY = {
    "eval": "scanEval", "new-function": "scanNewFunction", "cookie": "scanCookie",
    "script-tag": "scanScriptTag", "document-write": "scanDocWrite", "http": "scanHttp",
    "innerhtml": "scanInnerHtml", "storage": "scanStorage", "external-fetch": "scanExternal"
  };
  function scanLabel(lang, id) { return tr(lang, SCAN_KEY[id] || "checkScan"); }
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }
  function b64FromBytes(bytes) {
    var out = "", i, chunk;
    for (i = 0; i < bytes.length; i += 0x8000) {
      chunk = bytes.subarray ? bytes.subarray(i, i + 0x8000) : bytes.slice(i, i + 0x8000);
      out += String.fromCharCode.apply(null, chunk);
    }
    return btoa(out);
  }
  function sriOf(buf) {
    var cr = window.crypto || null;
    var subtle = cr ? (cr.subtle || cr.webkitSubtle) : null;
    if (!subtle || !subtle.digest) return Promise.reject(new Error("no-crypto"));
    return subtle.digest("SHA-256", buf).then(function (d) {
      return "sha256-" + b64FromBytes(new Uint8Array(d));
    });
  }
  /* URL 을 읽어 해시·정적 검사 결과를 돌려줍니다. 읽지 못하면(CORS·404) 그 사실만 남기고
     제출은 그대로 진행합니다(관리자가 설치할 때 엔진이 다시 검증). */
  function autoCheck(url) {
    var rep = { checked_at: new Date().toISOString(), url: String(url || ""), https: false,
                same_origin: false, fetched: false, cors: false, bytes: 0, integrity: "",
                findings: [], level: 0, note: "" };
    var u;
    try { u = new URL(String(url || ""), location.href); } catch (e) { rep.note = "bad-url"; return Promise.resolve(rep); }
    rep.same_origin = (u.origin === location.origin);
    rep.https = /^https:$/i.test(u.protocol);
    if (!rep.https && !rep.same_origin) { rep.note = "scheme"; return Promise.resolve(rep); }
    return fetch(u.href, { cache: "no-store", credentials: "omit", mode: "cors" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      rep.fetched = true; rep.cors = true; rep.bytes = buf.byteLength;
      var text = "";
      try { text = new TextDecoder("utf-8").decode(buf); } catch (e) { text = ""; }
      rep.findings = SCAN_RULES.filter(function (r) { return r.re.test(text); })
        .map(function (r) { return { id: r.id, level: r.level }; });
      rep.level = rep.findings.reduce(function (m, f) { return Math.max(m, f.level); }, 0);
      return sriOf(buf).then(function (v) { rep.integrity = v; return rep; },
        function () { rep.note = "no-crypto"; return rep; });
    }).catch(function () {
      rep.cors = false; rep.fetched = false; rep.note = "cors";
      return rep;
    });
  }

  /* ---------------- 제출 모달 ---------------- */
  function subMsg(inst, text, kind) {
    var el = SUB.el || document.getElementById("mkt-submit");
    var box = el ? el.querySelector("#mkt-sub-msg") : null;
    if (box) {
      box.textContent = text || "";
      box.className = "mkt-sub-msg" + (kind ? " " + kind : "");
    }
  }

  function subCategoryOptions(inst, cur) {
    var cats = (inst && inst.data && Array.isArray(inst.data.categories)) ? inst.data.categories : [];
    if (!cats.length) {
      cats = Object.keys(CAT_FALLBACK).map(function (k) {
        return { id: k, ko: CAT_FALLBACK[k].ko, en: CAT_FALLBACK[k].en };
      });
    }
    return cats.map(function (c) {
      var label = inst && inst.lang === "en" ? (c.en || c.ko || c.id) : (c.ko || c.en || c.id);
      return '<option value="' + esc(c.id) + '"' + (c.id === cur ? " selected" : "") + ">" + esc(label) + "</option>";
    }).join("");
  }

  function ensureSubmitModal() {
    if (SUB.el && document.body.contains(SUB.el)) return SUB.el;
    var el = document.createElement("div");
    el.className = "mkt-modal mkt-sub-modal";
    el.id = "mkt-submit";
    el.hidden = true;
    el.innerHTML =
      '<div class="mkt-modal-backdrop" data-mkt-sub-cancel="1"></div>' +
      '<div class="mkt-modal-card mkt-sub-card" role="dialog" aria-modal="true" aria-labelledby="mkt-sub-title">' +
        '<header class="mkt-modal-head">' +
          '<h2 id="mkt-sub-title"></h2>' +
          '<button type="button" class="mkt-modal-x" data-mkt-sub-cancel="1" aria-label="">×</button>' +
        "</header>" +
        '<div class="mkt-modal-body" id="mkt-sub-body"></div>' +
        '<footer class="mkt-modal-foot">' +
          '<span class="mkt-foot-id muted" id="mkt-sub-foot"></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-sub-cancel="1" data-mkt-sub-cancel-label="1"></button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-sub-checkonly="1"></button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-mkt-sub-go="1"></button>' +
        "</footer>" +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest("[data-mkt-sub-cancel]")) { closeSubmit(); return; }
      if (e.target.closest("[data-mkt-sub-checkonly]")) { runSubmit(SUB.inst, "check"); return; }
      if (e.target.closest("[data-mkt-sub-go]")) { runSubmit(SUB.inst, "submit"); return; }
    });
    el.addEventListener("input", function (e) {
      var t = e.target;
      if (!t || t.id !== "mkt-sub-name") return;
      var slugEl = el.querySelector("#mkt-sub-slug");
      if (!slugEl || slugEl.value.trim()) return;
      var guess = String(t.value || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      if (/^[a-z0-9]/.test(guess)) slugEl.value = guess;
    });
    document.addEventListener("keydown", function (e) {
      if (!SUB.el || SUB.el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeSubmit(); }
    });
    SUB.el = el;
    return el;
  }

  function paintSubmit(inst) {
    var el = ensureSubmitModal();
    var lang = inst ? inst.lang : currentLang();
    el.querySelector("#mkt-sub-title").textContent = tr(lang, "subTitle");
    el.querySelector(".mkt-modal-x").setAttribute("aria-label", tr(lang, "subCancel"));
    var cancel = el.querySelector("[data-mkt-sub-cancel-label]");
    if (cancel) cancel.textContent = tr(lang, "subCancel");
    var chk = el.querySelector("[data-mkt-sub-checkonly]");
    if (chk) { chk.textContent = tr(lang, "subCheck"); chk.disabled = false; }
    var go = el.querySelector("[data-mkt-sub-go]");
    if (go) { go.textContent = tr(lang, "subSubmit"); go.disabled = false; }
    el.querySelector("#mkt-sub-foot").textContent = "v10.6";
    el.querySelector("#mkt-sub-body").innerHTML =
      '<p class="mkt-sub-lead">' + esc(tr(lang, "subLead")) + "</p>" +
      '<p class="mkt-sub-gate" id="mkt-sub-gate" hidden>' + esc(tr(lang, "subGate")) +
        ' <a class="rowlink" href="#/sign">' + esc(tr(lang, "subGateLink")) + "</a></p>" +
      '<div class="mkt-sub-form">' +
        '<label class="cms-field"><span>' + esc(tr(lang, "subName")) + " *</span>" +
          '<input id="mkt-sub-name" maxlength="80" autocomplete="off"></label>' +
        '<label class="cms-field"><span>' + esc(tr(lang, "subSlug")) + " *</span>" +
          '<input id="mkt-sub-slug" maxlength="60" spellcheck="false" autocomplete="off" placeholder="my-plugin">' +
          '<em class="mkt-hint">' + esc(tr(lang, "subSlugHint")) + "</em></label>" +
        '<label class="cms-field"><span>' + esc(tr(lang, "subVersion")) + " *</span>" +
          '<input id="mkt-sub-version" maxlength="24" spellcheck="false" value="1.0.0"></label>' +
        '<label class="cms-field"><span>' + esc(tr(lang, "subCategory")) + "</span>" +
          '<select id="mkt-sub-cat" class="admin-input">' + subCategoryOptions(inst, "") + "</select></label>" +
        '<label class="cms-field mkt-sub-wide"><span>' + esc(tr(lang, "subSummary")) + "</span>" +
          '<input id="mkt-sub-summary" maxlength="500"></label>' +
        '<label class="cms-field"><span>' + esc(tr(lang, "subAuthor")) + "</span>" +
          '<input id="mkt-sub-author" maxlength="80" autocomplete="off"></label>' +
        '<label class="cms-field"><span>' + esc(tr(lang, "subEmail")) + "</span>" +
          '<input id="mkt-sub-email" type="email" maxlength="160" autocomplete="off"></label>' +
        '<label class="cms-field mkt-sub-wide"><span>' + esc(tr(lang, "subUrl")) + " *</span>" +
          '<input id="mkt-sub-url" maxlength="500" spellcheck="false" placeholder="https://cdn.jsdelivr.net/gh/.../plugin.js">' +
          '<em class="mkt-hint">' + esc(tr(lang, "subUrlHint")) + "</em></label>" +
      "</div>" +
      '<fieldset class="mkt-sub-group"><legend>' + esc(tr(lang, "subHooks")) + "</legend>" +
        HOOK_ORDER.map(function (h) {
          return '<label class="mkt-chk"><input type="checkbox" name="mkt-sub-hook" value="' + esc(h) + '"><span>' +
            esc(hookLabel(h, lang)) + "</span></label>";
        }).join("") + "</fieldset>" +
      '<fieldset class="mkt-sub-group"><legend>' + esc(tr(lang, "subPerms")) + "</legend>" +
        Object.keys(PERM).map(function (p) {
          return '<label class="mkt-chk"><input type="checkbox" name="mkt-sub-perm" value="' + esc(p) + '"><span><code>' +
            esc(p) + "</code></span></label>";
        }).join("") +
        '<label class="mkt-sub-extra"><span>' + esc(tr(lang, "subPermsHint")) + "</span>" +
          '<input id="mkt-sub-perm-extra" maxlength="200" spellcheck="false" placeholder="read:posts, css:inject"></label>' +
      "</fieldset>" +
      '<div id="mkt-sub-check"></div>' +
      '<p class="mkt-sub-msg" id="mkt-sub-msg" role="status" aria-live="polite"></p>';
    return el;
  }

  function openSubmit(inst) {
    if (!inst) return;
    SUB.inst = inst;
    SUB.lastFocus = document.activeElement;
    SUB.lastCheck = null;
    SUB.lastUrl = "";
    SUB.busy = false;
    var el = paintSubmit(inst);
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    var gate = el.querySelector("#mkt-sub-gate");
    if (gate) gate.hidden = true;
    subUser(function (u) {
      var g = el.querySelector("#mkt-sub-gate");
      if (g) g.hidden = !!u;
    });
    try { el.querySelector("#mkt-sub-name").focus(); } catch (e) { /* noop */ }
  }

  function closeSubmit() {
    if (!SUB.el) return;
    SUB.el.hidden = true;
    var body = SUB.el.querySelector("#mkt-sub-body");
    if (body) body.innerHTML = "";
    SUB.inst = null; SUB.busy = false; SUB.lastCheck = null; SUB.lastUrl = "";
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (SUB.lastFocus && SUB.lastFocus.focus) SUB.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  function subFields(el) {
    function val(id) { var n = el.querySelector("#" + id); return n ? String(n.value || "").trim() : ""; }
    var hooks = [], perms = [];
    [].forEach.call(el.querySelectorAll('input[name="mkt-sub-hook"]:checked'), function (n) { hooks.push(n.value); });
    [].forEach.call(el.querySelectorAll('input[name="mkt-sub-perm"]:checked'), function (n) { perms.push(n.value); });
    val("mkt-sub-perm-extra").split(",").forEach(function (x) {
      var p = String(x || "").trim().toLowerCase();
      if (p && perms.indexOf(p) < 0) perms.push(p);
    });
    return {
      name: val("mkt-sub-name"), slug: val("mkt-sub-slug").toLowerCase(), version: val("mkt-sub-version"),
      summary: val("mkt-sub-summary"), author_name: val("mkt-sub-author"),
      author_email: val("mkt-sub-email"), script_url: val("mkt-sub-url"), category: val("mkt-sub-cat"),
      hooks: hooks.slice(0, 12), permissions: perms.slice(0, 12)
    };
  }

  function subValidate(inst, f) {
    var lang = (inst && inst.lang) || currentLang();
    if (f.name.length < 2 || f.name.length > 80) return tr(lang, "subNeedName");
    if (!/^[a-z0-9][a-z0-9._-]{1,59}$/.test(f.slug)) return tr(lang, "subNeedSlug");
    if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(f.version)) return tr(lang, "subNeedVersion");
    if (!/^(https:\/\/|\/)/i.test(f.script_url)) return tr(lang, "subNeedUrl");
    if (f.author_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.author_email)) return tr(lang, "subNeedEmail");
    return "";
  }

  function checkCardHtml(inst, rep) {
    var lang = (inst && inst.lang) || currentLang();
    var scan = (rep.findings && rep.findings.length)
      ? '<ul class="mkt-scan-list">' + rep.findings.map(function (f) {
          return '<li class="lv' + f.level + '">' + esc(scanLabel(lang, f.id)) +
            " <em>" + esc(tr(lang, "finding" + f.level)) + "</em></li>";
        }).join("") + "</ul>"
      : '<span class="mkt-ok">' + esc(rep.fetched ? tr(lang, "checkScanClean") : tr(lang, "checkScanNone")) + "</span>";
    var sha = rep.integrity
      ? '<code class="mkt-sha">' + esc(rep.integrity) + "</code>"
      : '<span class="mkt-warn">' + esc(rep.note === "cors" ? tr(lang, "checkShaCors")
          : (rep.note === "no-crypto" ? tr(lang, "checkNoCrypto") : tr(lang, "checkShaNone"))) + "</span>";
    return '<section class="mkt-sub-report" id="mkt-sub-report">' +
      "<h3>" + esc(tr(lang, "subCheckTitle")) + "</h3>" +
      '<dl class="mkt-facts">' +
        "<div><dt>" + esc(tr(lang, "checkHttps")) + '</dt><dd class="' +
          (rep.https || rep.same_origin ? "ok" : "warn") + '">' +
          esc(rep.https || rep.same_origin ? tr(lang, "checkHttpsOk") : tr(lang, "checkHttpsNo")) + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "checkScan")) + "</dt><dd>" + scan + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "checkSha")) + "</dt><dd>" + sha + "</dd></div>" +
        (rep.bytes ? "<div><dt>" + esc(tr(lang, "checkBytes")) + "</dt><dd>" + esc(fmtBytes(rep.bytes)) + "</dd></div>" : "") +
      "</dl>" +
      (rep.note === "cors" ? '<p class="mkt-note">' + esc(tr(lang, "checkCors")) + "</p>" : "") +
      "</section>";
  }

  function runSubmit(inst, mode) {
    if (!inst || SUB.busy) return;
    var el = ensureSubmitModal();
    var lang = inst.lang;
    var f = subFields(el);
    var bad = subValidate(inst, f);
    if (bad) { subMsg(inst, bad, "err"); return; }
    var go = el.querySelector("[data-mkt-sub-go]");
    var chk = el.querySelector("[data-mkt-sub-checkonly]");
    SUB.busy = true;
    if (go) { go.disabled = true; go.textContent = tr(lang, "subCheckRun"); }
    if (chk) chk.disabled = true;
    subMsg(inst, tr(lang, "subCheckRun"), "");
    var run = (SUB.lastCheck && SUB.lastUrl === f.script_url && mode === "submit")
      ? Promise.resolve(SUB.lastCheck) : autoCheck(f.script_url);
    run.then(function (rep) {
      SUB.lastCheck = rep;
      SUB.lastUrl = f.script_url;
      var host = el.querySelector("#mkt-sub-check");
      if (host) host.innerHTML = checkCardHtml(inst, rep);
      SUB.busy = false;
      if (go) { go.disabled = false; go.textContent = tr(lang, "subSubmit"); }
      if (chk) chk.disabled = false;
      if (mode === "check") { subMsg(inst, "", ""); return; }
      saveSubmission(inst, f, rep, go);
    });
  }

  function readLocalSubs() {
    try {
      var a = JSON.parse(localStorage.getItem(SUB_LS) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function addLocalSub(row) {
    try {
      var a = readLocalSubs();
      a.unshift(row);
      localStorage.setItem(SUB_LS, JSON.stringify(a.slice(0, 50)));
      return true;
    } catch (e) { return false; }
  }

  function saveSubmission(inst, f, rep, btn) {
    var lang = inst.lang;
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "subSubmitting"); }
    SUB.userChecked = false;
    subUser(function (u) {
      if (!u) {
        if (btn) { btn.disabled = false; btn.textContent = tr(lang, "subSubmit"); }
        subMsg(inst, tr(lang, "subNeedLogin"), "err");
        var gate = SUB.el ? SUB.el.querySelector("#mkt-sub-gate") : null;
        if (gate) gate.hidden = false;
        return;
      }
      var row = {
        slug: f.slug, name: f.name, version: f.version, summary: f.summary || null,
        author_name: f.author_name || null, author_email: f.author_email || null,
        script_url: f.script_url, integrity: rep.integrity || null, category: f.category || null,
        hooks: f.hooks, permissions: f.permissions, settings_schema: [],
        status: "pending", submitted_by: u.id,
        auto_check_report: {
          checked_at: rep.checked_at, url: rep.url, https: rep.https, same_origin: rep.same_origin,
          fetched: rep.fetched, cors: rep.cors, bytes: rep.bytes,
          integrity: rep.integrity || null, findings: rep.findings || [], level: rep.level || 0,
          note: rep.note || ""
        }
      };
      sbRequest("/rest/v1/plugin_submissions", {
        method: "POST", token: sbToken(), body: row, prefer: "return=representation"
      }).then(function (data) {
        var saved = (data && data[0]) || row;
        if (btn) { btn.disabled = false; btn.textContent = tr(lang, "subSubmit"); }
        var done = tr(lang, "subDone");
        closeSubmit();
        flash(inst, done, "ok");
        if (inst.mode === "admin") {
          SUB.loaded = false;
          loadSubmissions(inst);
        }
        return saved;
      }, function (e) {
        if (btn) { btn.disabled = false; btn.textContent = tr(lang, "subSubmit"); }
        if (missingTable(e)) {
          row.id = "local-" + Date.now();
          row.__local = true;
          row.created_at = new Date().toISOString();
          addLocalSub(row);
          var msg = tr(lang, "subDoneLocal");
          closeSubmit();
          flash(inst, msg, "ok");
          if (inst.mode === "admin") { SUB.loaded = false; loadSubmissions(inst); }
          return;
        }
        if (e.status === 401 || e.status === 403) {
          subMsg(inst, tr(lang, "subNeedLogin") + " (" + (e.message || "") + ")", "err");
          return;
        }
        subMsg(inst, tr(lang, "subFail") + (e.message || e), "err");
      });
    });
  }

  /* ---------------- 심사 큐 (관리자) ---------------- */
  function subList() { return Array.isArray(SUB.items) ? SUB.items : []; }
  function subById(id) {
    var out = null;
    subList().forEach(function (s) { if (String(s.id) === String(id)) out = s; });
    return out;
  }
  function subStatus(s) {
    var st = String((s && s.status) || "pending");
    return (st === "approved" || st === "rejected") ? st : "pending";
  }
  function subCount(st) {
    return subList().filter(function (s) { return subStatus(s) === st; }).length;
  }
  function subStateKey(st) {
    return st === "approved" ? "queueFilterApproved" : (st === "rejected" ? "queueFilterRejected" : "queueFilterPending");
  }
  function subQueueMsg(inst, text, kind) {
    SUB.msg = text || "";
    SUB.msgKind = kind || "";
    if (SUB.inst || inst) paintTools(SUB.inst || inst);
  }

  function loadSubmissions(inst, force) {
    if (!inst) return;
    if (SUB.loading) return;
    if (SUB.loaded && !force) return;
    SUB.inst = inst;
    SUB.loading = true;
    if (force) { SUB.loaded = false; SUB.items = null; }
    paintTools(inst);
    function finish() {
      SUB.loading = false;
      SUB.loaded = true;
      if (SUB.inst) paintTools(SUB.inst);
      verifyQueue(inst);
    }
    if (!sbCfg().url) {
      SUB.tableMissing = true;
      SUB.items = readLocalSubs();
      finish();
      return;
    }
    sbRequest("/rest/v1/plugin_submissions?select=*&order=created_at.desc&limit=200", { token: sbToken() })
      .then(function (rows) {
        SUB.tableMissing = false;
        SUB.items = Array.isArray(rows) ? rows : [];
        finish();
      }, function (e) {
        SUB.tableMissing = missingTable(e);
        SUB.items = readLocalSubs();
        SUB.msg = SUB.tableMissing ? "" : (tr(inst.lang, "subFail") + (e.message || e));
        SUB.msgKind = SUB.tableMissing ? "" : "err";
        finish();
      });
  }

  /* 승인된 제출의 파일을 지금 다시 해시해, 제출 때와 다르면 설치를 막습니다. */
  function verifyQueue(inst) {
    var S = window.SBPress;
    var list = subList().filter(function (s) {
      return subStatus(s) === "approved" && s.integrity && !SUB.verify[s.id];
    }).slice(0, 8);
    list.forEach(function (s) {
      if (!S || typeof S.verifyIntegrity !== "function") { SUB.verify[s.id] = { state: "unchecked" }; return; }
      SUB.verify[s.id] = { state: "checking" };
      S.verifyIntegrity(s.script_url, s.integrity).then(function (r) {
        SUB.verify[s.id] = { state: (r && r.ok) ? "ok" : "bad", computed: (r && r.computed) || "" };
      }, function () {
        SUB.verify[s.id] = { state: "unchecked" };
      }).then(function () {
        if (SUB.inst) paintTools(SUB.inst);
      });
    });
  }

  function subCardHtml(inst, s) {
    var lang = inst.lang;
    var st = subStatus(s);
    var auto = s.auto_check_report || {};
    var hooks = Array.isArray(s.hooks) ? s.hooks : [];
    var perms = Array.isArray(s.permissions) ? s.permissions : [];
    var ver = SUB.verify[s.id] || {};
    var chips = (hooks.length
      ? hooks.map(function (h) { return '<span class="plug-tag hook">' + esc(h) + "</span>"; }).join("")
      : '<span class="mkt-note">' + esc(tr(lang, "subHooksNone")) + "</span>") +
      perms.map(function (p) { return '<span class="plug-tag perm">' + esc(p) + "</span>"; }).join("");
    var scan = (auto.findings && auto.findings.length)
      ? auto.findings.map(function (f) {
          return '<span class="mkt-scan lv' + (f.level || 1) + '">' + esc(scanLabel(lang, f.id)) + "</span>";
        }).join(" ")
      : '<span class="mkt-ok">' + esc(auto.fetched ? tr(lang, "checkScanClean") : tr(lang, "checkScanNone")) + "</span>";
    var sha = s.integrity
      ? '<code class="mkt-sha">' + esc(String(s.integrity)) + "</code>" +
        (ver.state === "bad" ? ' <span class="plug-tag sri-bad">' + esc(tr(lang, "queueBad")) + "</span>" : "")
      : '<span class="mkt-warn">' + esc(auto.cors === false ? tr(lang, "checkShaCors") : tr(lang, "checkShaNone")) + "</span>";
    var acts = [];
    if (st !== "approved") {
      acts.push('<button type="button" class="btn btn-primary btn-sm" data-mkt-sub-approve="' + esc(s.id) + '">' +
        esc(tr(lang, "queueApprove")) + "</button>");
    }
    if (st !== "rejected") {
      acts.push('<button type="button" class="btn btn-ghost btn-sm danger" data-mkt-sub-reject="' + esc(s.id) + '">' +
        esc(tr(lang, "queueReject")) + "</button>");
    }
    if (st === "approved") {
      acts.push('<button type="button" class="btn btn-primary btn-sm" data-mkt-sub-install="' + esc(s.id) + '"' +
        (ver.state === "bad" ? " disabled" : "") + ' title="' + esc(ver.state === "bad" ? tr(lang, "queueBad") : "") + '">' +
        esc(tr(lang, "queueInstall")) + "</button>");
      acts.push('<button type="button" class="btn btn-ghost btn-sm" data-mkt-sub-copy="' + esc(s.id) + '">' +
        esc(tr(lang, "queueCopy")) + "</button>");
      acts.push('<button type="button" class="btn btn-ghost btn-sm" data-mkt-sub-export="' + esc(s.id) + '">' +
        esc(tr(lang, "queueExport")) + "</button>");
    }
    return '<article class="mkt-subcard is-' + st + '" data-sub-id="' + esc(s.id) + '" data-sub-status="' + st + '">' +
      '<header class="mkt-subcard-head">' +
        "<h4>" + esc(s.name || s.slug) + ' <span class="plug-tag ver">v' + esc(s.version) + "</span> " +
          '<span class="mkt-substate is-' + st + '">' + esc(tr(lang, subStateKey(st))) + "</span>" +
          (s.__local ? ' <span class="mkt-substate is-local">' + esc(tr(lang, "queueLocalBadge")) + "</span>" : "") +
        "</h4>" +
        '<p class="mkt-subcard-meta"><code>' + esc(s.slug) + "</code> · " + esc(s.category || "—") +
          " · " + esc(dateText(s.created_at)) + "</p>" +
      "</header>" +
      (s.summary ? '<p class="mkt-subcard-sum">' + esc(s.summary) + "</p>" : "") +
      '<p class="mkt-subcard-who">' + esc(tr(lang, "queueBy")) + " " + esc(s.author_name || "—") +
        (s.author_email ? " &lt;" + esc(s.author_email) + "&gt;" : "") + "</p>" +
      '<div class="mkt-subcard-chips">' + chips + "</div>" +
      '<dl class="mkt-facts mkt-subcard-check">' +
        "<div><dt>" + esc(tr(lang, "checkHttps")) + '</dt><dd class="' +
          (auto.https || auto.same_origin ? "ok" : "warn") + '">' +
          esc(auto.https || auto.same_origin ? tr(lang, "checkHttpsOk") : tr(lang, "checkHttpsNo")) + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "checkScan")) + "</dt><dd>" + scan + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "checkSha")) + "</dt><dd>" + sha + "</dd></div>" +
        (auto.bytes ? "<div><dt>" + esc(tr(lang, "checkBytes")) + "</dt><dd>" + esc(fmtBytes(auto.bytes)) + "</dd></div>" : "") +
      "</dl>" +
      '<p class="mkt-subcard-url"><code>' + esc(s.script_url) + "</code></p>" +
      (s.review_note ? '<p class="mkt-subnote">' + esc(s.review_note) + "</p>" : "") +
      (s.reviewed_at ? '<p class="mkt-subnote muted">' + esc(tr(lang, "queueReviewed")) + " " + esc(dateText(s.reviewed_at)) + "</p>" : "") +
      '<div class="mkt-subcard-acts">' + acts.join("") + "</div>" +
      (SUB.reject === String(s.id)
        ? '<div class="mkt-sub-rejectbox">' +
            '<textarea class="admin-input" id="mkt-sub-note-' + esc(s.id) + '" rows="2" maxlength="1000" placeholder="' +
              esc(tr(lang, "queueRejectNote")) + '"></textarea>' +
            '<button type="button" class="btn btn-ghost btn-sm danger" data-mkt-sub-reject-go="' + esc(s.id) + '">' +
              esc(tr(lang, "queueRejectGo")) + "</button>" +
          "</div>"
        : "") +
      "</article>";
  }

  function submissionPanelHtml(inst) {
    var lang = inst.lang;
    var filters = ["pending", "approved", "rejected"];
    var rows = subList().filter(function (s) { return subStatus(s) === SUB.filter; });
    var head = '<div class="mkt-subpanel-head">' +
      '<div><h3 id="mkt-subqueue-title">' + esc(tr(lang, "queueTitle")) + "</h3>" +
      '<p class="mkt-subpanel-note">' + esc(tr(lang, "queueNote")) + "</p></div>" +
      '<div class="mkt-subpanel-acts">' +
        '<button type="button" class="btn btn-primary btn-sm" data-mkt-sub-open="1">' + esc(tr(lang, "subOpen")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-mkt-sub-refresh="1">' + esc(tr(lang, "queueRefresh")) + "</button>" +
      "</div></div>";
    return '<section class="mkt-subpanel" id="mkt-subqueue" aria-labelledby="mkt-subqueue-title">' +
      head +
      '<div class="mkt-subs" role="tablist">' + filters.map(function (f) {
        return '<button type="button" class="mkt-subtab' + (SUB.filter === f ? " is-on" : "") +
          '" role="tab" aria-selected="' + (SUB.filter === f ? "true" : "false") + '" data-mkt-sub-filter="' + f + '">' +
          esc(tr(lang, subStateKey(f))) + ' <b class="mkt-subcount">' + subCount(f) + "</b></button>";
      }).join("") + "</div>" +
      '<p class="mkt-submsg' + (SUB.msgKind ? " " + esc(SUB.msgKind) : "") + '" id="mkt-submsg" role="status" aria-live="polite">' +
        esc(SUB.msg || "") + "</p>" +
      (SUB.tableMissing
        ? '<p class="mkt-note mkt-warn" id="mkt-sub-missing">' + esc(tr(lang, "queueMissing")) + " " + esc(tr(lang, "subNeedSql")) + "</p>"
        : "") +
      (SUB.loading
        ? '<p class="mkt-note">' + esc(tr(lang, "queueLoad")) + "</p>"
        : (rows.length
            ? '<div class="mkt-sublist">' + rows.map(function (s) { return subCardHtml(inst, s); }).join("") + "</div>"
            : '<p class="mkt-note mkt-sub-empty">' + esc(tr(lang, "queueEmpty")) + "</p>")) +
      "</section>";
  }

  function applyReview(inst, id, status, note, res) {
    var s = subById(id);
    if (s) {
      s.status = status;
      s.review_note = note || (res && res.review_note) || null;
      s.reviewed_at = (res && res.reviewed_at) || new Date().toISOString();
      if (res && res.reviewed_by) s.reviewed_by = res.reviewed_by;
    }
    SUB.reject = "";
    SUB.msg = tr(inst.lang, status === "rejected" ? "queueRejected" : "queueApproved");
    SUB.msgKind = "ok";
    if (SUB.inst) paintTools(SUB.inst);
  }

  function reviewSubmission(inst, id, status, note, btn) {
    if (!sbCfg().url) { subQueueMsg(inst, tr(inst.lang, "queueNeedSql"), "err"); return; }
    if (btn) btn.disabled = true;
    sbRequest("/rest/v1/rpc/review_plugin_submission", {
      method: "POST", token: sbToken(),
      body: { p_id: id, p_status: status, p_note: note || null }
    }).then(function (res) {
      if (btn) btn.disabled = false;
      applyReview(inst, id, status, note, res);
    }, function (e) {
      if (btn) btn.disabled = false;
      if (!missingRpc(e) && !missingTable(e)) {
        subQueueMsg(inst, tr(inst.lang, "subFail") + (e.message || e), "err");
        return;
      }
      /* RPC 가 없는 DB(27_v106 이전) — 관리자 RLS 로 직접 갱신합니다. */
      sbRequest("/rest/v1/plugin_submissions?id=eq." + encodeURIComponent(id), {
        method: "PATCH", token: sbToken(),
        body: { status: status, review_note: note || null, reviewed_at: new Date().toISOString() },
        prefer: "return=representation"
      }).then(function (rows) {
        applyReview(inst, id, status, note, (rows && rows[0]) || null);
      }, function (e2) {
        subQueueMsg(inst, missingTable(e2) ? tr(inst.lang, "queueNeedSql")
          : (tr(inst.lang, "subFail") + (e2.message || e2)), "err");
      });
    });
  }

  function approveSubmission(inst, id, btn) { reviewSubmission(inst, id, "approved", "", btn); }

  function subMarketItem(s) {
    var day = String(s.reviewed_at || s.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    var item = {
      id: s.slug, name: s.name || s.slug, version: s.version,
      description: s.summary || "", author: s.author_name || "",
      category: s.category || "content", order: 50, updated: day,
      min_sbpress_version: "10.7", script_url: s.script_url, source: "market",
      hooks: Array.isArray(s.hooks) ? s.hooks : [],
      permissions: Array.isArray(s.permissions) ? s.permissions : [],
      tags: [], screenshots: [],
      settings_schema: Array.isArray(s.settings_schema) ? s.settings_schema : [],
      changelog: [{ version: s.version, date: day, notes: s.summary || "" }]
    };
    if (s.integrity) item.integrity = s.integrity;
    item.sandbox_mode = "strict";
    return item;
  }
  function subJsonText(s) { return JSON.stringify(subMarketItem(s), null, 2); }

  function itemFromSubmission(s) {
    var it = subMarketItem(s);
    it.sandbox_mode = "strict";
    /* 동의 모달이 마켓 목록 대신 이 항목을 그대로 쓰도록 표시합니다. */
    it.__submission = true;
    return it;
  }

  function copyText(text, cb) {
    function fallback() {
      var ok = false;
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        ok = !!(document.execCommand && document.execCommand("copy"));
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
      cb(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { cb(true); }, fallback);
    } else fallback();
  }

  function downloadJson(name, text) {
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (e) { /* noop */ }
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 800);
      return true;
    } catch (e) { return false; }
  }

  /* 승인된 제출을 v10.5 동의 모달로 넘겨 바로 설치합니다. */
  function installSubmission(inst, id, btn) {
    var s = subById(id);
    if (!s) return;
    var ver = SUB.verify[s.id] || {};
    if (ver.state === "bad") { subQueueMsg(inst, tr(inst.lang, "queueBad"), "err"); return; }
    var item = itemFromSubmission(s);
    if (ver.state === "ok") inst.verify[item.id] = { state: "ok", computed: ver.computed || "" };
    openConsent(inst, item, "install", item.permissions, function (info) {
      if (typeof inst.onInstallSubmission === "function") {
        inst.onInstallSubmission(item, btn, info);
      } else {
        flash(inst, tr(inst.lang, "queueNeedSql"), "err");
      }
    });
  }

  /* ---------------- 설정 모달 (v10.2) ---------------- */
  var SET = { el: null, inst: null, id: "", lastFocus: null };

  function ensureSettingsModal() {
    if (SET.el && document.body.contains(SET.el)) return SET.el;
    var el = document.createElement("div");
    el.className = "mkt-modal mkt-set-modal";
    el.id = "mkt-settings";
    el.hidden = true;
    el.innerHTML =
      '<div class="mkt-modal-backdrop" data-mkt-set-close="1"></div>' +
      '<div class="mkt-modal-card mkt-set-card" role="dialog" aria-modal="true" aria-labelledby="mkt-set-title">' +
        '<header class="mkt-modal-head">' +
          '<h2 id="mkt-set-title"></h2>' +
          '<button type="button" class="mkt-modal-x" data-mkt-set-close="1" aria-label="">×</button>' +
        "</header>" +
        '<div class="mkt-modal-body" id="mkt-set-body"></div>' +
        '<footer class="mkt-modal-foot" id="mkt-set-foot"></footer>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-mkt-set-close]")) { closeSettings(); return; }
      var clear = e.target.closest ? e.target.closest("[data-mkt-clear]") : null;
      if (clear) {
        var key = clear.getAttribute("data-mkt-clear");
        var inp = el.querySelector('[data-set-field="' + key + '"]');
        if (inp) { inp.setAttribute("data-empty", "1"); inp.value = "#c86d44"; }
        var code = el.querySelector('[data-set-value="' + key + '"]');
        if (code) code.textContent = tr(SET.inst ? SET.inst.lang : "ko", "colorClear");
        return;
      }
      var color = e.target.closest ? e.target.closest('input[type="color"][data-set-field]') : null;
      if (color) color.setAttribute("data-empty", "0");
    });
    el.addEventListener("input", function (e) {
      var inp = e.target;
      if (!inp || !inp.getAttribute) return;
      if (inp.type === "color") {
        inp.setAttribute("data-empty", "0");
        var code = el.querySelector('[data-set-value="' + inp.getAttribute("data-set-field") + '"]');
        if (code) code.textContent = String(inp.value || "").toLowerCase();
      }
      if (inp.type === "checkbox") {
        var lab = inp.closest ? inp.closest(".mkt-switch") : null;
        var em = lab ? lab.querySelector("em") : null;
        if (em) em.textContent = inp.checked ? tr(SET.inst ? SET.inst.lang : "ko", "on") : tr(SET.inst ? SET.inst.lang : "ko", "off");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (!SET.el || SET.el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeSettings(); }
    });
    SET.el = el;
    return el;
  }

  function fieldHtml(inst, f, val) {
    var lang = inst.lang;
    var label = lang === "en" ? f.label_en : f.label_ko;
    var help = lang === "en" ? f.help_en : f.help_ko;
    var ph = lang === "en" ? f.placeholder_en : f.placeholder_ko;
    var id = "mkt-set-" + f.key;
    var input = "";
    var extra = "";
    if (f.type === "boolean") {
      var on = val === true;
      input = '<label class="mkt-switch"><input type="checkbox" id="' + id + '" data-set-field="' + esc(f.key) + '"' +
        (on ? " checked" : "") + '><span class="mkt-switch-box" aria-hidden="true"></span>' +
        "<em>" + esc(tr(lang, on ? "on" : "off")) + "</em></label>";
    } else if (f.type === "select") {
      input = '<select id="' + id + '" data-set-field="' + esc(f.key) + '">' +
        (f.options || []).map(function (o) {
          var ol = lang === "en" ? (o.label_en || o.label_ko) : (o.label_ko || o.label_en);
          return '<option value="' + esc(o.value) + '"' + (String(val) === String(o.value) ? " selected" : "") + ">" + esc(ol) + "</option>";
        }).join("") + "</select>";
    } else if (f.type === "color") {
      var cur = /^#[0-9a-fA-F]{6}$/.test(String(val || "")) ? String(val).toLowerCase() : "";
      input = '<span class="mkt-color">' +
        '<input type="color" id="' + id + '" data-set-field="' + esc(f.key) + '" data-empty="' + (cur ? "0" : "1") + '" value="' + esc(cur || "#c86d44") + '">' +
        '<code data-set-value="' + esc(f.key) + '">' + esc(cur || tr(lang, "colorClear")) + "</code>" +
        '<button type="button" class="rowlink" data-mkt-clear="' + esc(f.key) + '">' + esc(tr(lang, "colorClear")) + "</button>" +
        "</span>";
    } else if (f.type === "number") {
      var n = (val === null || val === undefined || val === "") ? "" : String(val);
      input = '<input type="number" id="' + id + '" data-set-field="' + esc(f.key) + '" value="' + esc(n) + '"' +
        (f.min != null ? ' min="' + esc(f.min) + '"' : "") + (f.max != null ? ' max="' + esc(f.max) + '"' : "") +
        (f.step != null ? ' step="' + esc(f.step) + '"' : "") + ' inputmode="numeric">';
    } else {
      input = '<input type="text" id="' + id + '" data-set-field="' + esc(f.key) + '" value="' + esc(val == null ? "" : val) + '"' +
        ' maxlength="' + esc(f.maxlength || 200) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">";
    }
    var defTxt = "";
    if (f.type === "boolean") defTxt = tr(lang, f.default === true ? "on" : "off");
    else if (f.default !== undefined && f.default !== "" && f.default !== null) defTxt = String(f.default);
    if (defTxt) {
      extra = '<span class="mkt-def">' + esc(tr(lang, "defaultTag")) + " " + esc(defTxt) + "</span>";
    }
    return '<div class="mkt-field mkt-field-' + esc(f.type) + '" data-key="' + esc(f.key) + '">' +
      '<label class="mkt-field-label" for="' + id + '">' + esc(label) + extra + "</label>" +
      '<div class="mkt-field-input">' + input + "</div>" +
      (help ? '<p class="mkt-field-help">' + esc(help) + "</p>" : "") +
      "</div>";
  }

  function paintSettingsBody(inst, p) {
    var el = SET.el;
    if (!el) return;
    var lang = inst.lang;
    var d = disp(inst, p);
    el.querySelector("#mkt-set-title").textContent = tr(lang, "settingsOf", { name: d.name });
    el.querySelector(".mkt-modal-x").setAttribute("aria-label", tr(lang, "close"));
    var row = installedRow(inst, p.id);
    var body = el.querySelector("#mkt-set-body");
    var foot = el.querySelector("#mkt-set-foot");
    if (!row) {
      body.innerHTML = '<p class="mkt-note">' + esc(tr(lang, "adminOnly")) + "</p>";
      foot.innerHTML = "";
      return;
    }
    if (!hasSettings(p)) {
      body.innerHTML = '<p class="mkt-note">' + esc(tr(lang, "noSchema")) + "</p>";
      foot.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" data-mkt-set-close="1">' + esc(tr(lang, "close")) + "</button>";
      return;
    }
    body.innerHTML =
      '<p class="mkt-set-lead">' + esc(tr(lang, "settingsLead")) + "</p>" +
      (row.enabled ? "" : '<p class="mkt-note mkt-warn">' + esc(tr(lang, "enabledNote")) + "</p>") +
      '<div class="mkt-form" id="mkt-set-form">' +
        (p.settings_schema || []).map(function (f) { return fieldHtml(inst, f, settingsOf(inst, p)[f.key]); }).join("") +
      "</div>" +
      '<p class="mkt-set-msg" id="mkt-set-msg" role="status" aria-live="polite"></p>';
    if (!inst.onSaveSettings) {
      foot.innerHTML = '<p class="mkt-note">' + esc(tr(lang, "settingsAdminOnly")) + "</p>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-mkt-set-close="1">' + esc(tr(lang, "close")) + "</button>";
      return;
    }
    foot.innerHTML =
      '<button type="button" class="btn btn-ghost btn-sm" data-mkt-set-restore="' + esc(p.id) + '">' + esc(tr(lang, "restore")) + "</button>" +
      '<span class="spacer"></span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-mkt-set-close="1">' + esc(tr(lang, "close")) + "</button>" +
      '<button type="button" class="btn btn-primary btn-sm" data-mkt-set-save="' + esc(p.id) + '">' + esc(tr(lang, "save")) + "</button>";
    var saveBtn = foot.querySelector("[data-mkt-set-save]");
    var restoreBtn = foot.querySelector("[data-mkt-set-restore]");
    if (saveBtn) saveBtn.addEventListener("click", function () { saveSettings(inst, p, saveBtn); });
    if (restoreBtn) restoreBtn.addEventListener("click", function () { restoreSettings(inst, p, restoreBtn); });
  }

  function collectSettings(p) {
    var out = {};
    var el = SET.el;
    if (!el) return out;
    (p.settings_schema || []).forEach(function (f) {
      var inp = el.querySelector('[data-set-field="' + f.key + '"]');
      if (!inp) return;
      if (f.type === "boolean") { out[f.key] = !!inp.checked; return; }
      if (f.type === "color") {
        if (inp.getAttribute("data-empty") === "1") return;      // 테마 색 그대로
        out[f.key] = String(inp.value || "").toLowerCase();
        return;
      }
      if (f.type === "number") {
        var raw = String(inp.value || "").trim();
        if (raw === "") return;
        var n = Number(raw);
        if (!isFinite(n)) return;
        if (f.min != null) n = Math.max(n, f.min);
        if (f.max != null) n = Math.min(n, f.max);
        out[f.key] = n;
        return;
      }
      if (f.type === "select") { out[f.key] = String(inp.value || ""); return; }
      var t = String(inp.value || "").slice(0, f.maxlength || 200);
      if (t !== "") out[f.key] = t;                 // 빈 글자는 기본값과 같습니다
    });
    return out;
  }

  function afterSettingsSaved(inst, p, saved) {
    var row = installedRow(inst, p.id);
    if (row && saved && typeof saved === "object") row.settings = saved;
    if (window.SBPress && window.SBPress.applySettings) {
      try { window.SBPress.applySettings(p.id, saved || {}, { silent: false }); } catch (e) { /* noop */ }
    }
    try { paintSettingsBody(inst, p); } catch (e) { /* noop */ }
    try { if (inst.data) { render(inst); } } catch (e) { /* noop */ }
  }

  function saveSettings(inst, p, btn) {
    var lang = inst.lang;
    var msg = SET.el ? SET.el.querySelector("#mkt-set-msg") : null;
    if (!inst.onSaveSettings) return;
    var values = collectSettings(p);
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "saving"); }
    if (msg) { msg.textContent = tr(lang, "saving"); msg.className = "mkt-set-msg"; }
    inst.onSaveSettings(p.id, values, function (err, saved) {
      if (btn) { btn.disabled = false; btn.textContent = tr(lang, "save"); }
      if (err) {
        if (msg) { msg.textContent = tr(lang, "saveFailed") + err; msg.className = "mkt-set-msg err"; }
        return;
      }
      afterSettingsSaved(inst, p, saved);
      var m2 = SET.el ? SET.el.querySelector("#mkt-set-msg") : null;
      if (m2) { m2.textContent = tr(lang, "saved"); m2.className = "mkt-set-msg ok"; }
    });
  }

  function restoreSettings(inst, p, btn) {
    var lang = inst.lang;
    if (!inst.onSaveSettings) return;
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "restoring"); }
    inst.onSaveSettings(p.id, {}, function (err, saved) {
      if (btn) { btn.disabled = false; btn.textContent = tr(lang, "restore"); }
      var msg = SET.el ? SET.el.querySelector("#mkt-set-msg") : null;
      if (err) {
        if (msg) { msg.textContent = tr(lang, "saveFailed") + err; msg.className = "mkt-set-msg err"; }
        return;
      }
      afterSettingsSaved(inst, p, saved || {});
      var m2 = SET.el ? SET.el.querySelector("#mkt-set-msg") : null;
      if (m2) { m2.textContent = tr(lang, "restored"); m2.className = "mkt-set-msg ok"; }
    });
  }

  function openSettings(inst, id) {
    var p = byId(inst, id);
    if (!p) return;
    var el = ensureSettingsModal();
    SET.inst = inst;
    SET.id = id;
    SET.lastFocus = document.activeElement;
    paintSettingsBody(inst, p);
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    try { el.querySelector(".mkt-modal-x").focus(); } catch (e) { /* noop */ }
  }

  function closeSettings() {
    if (!SET.el) return;
    SET.el.hidden = true;
    SET.el.querySelector("#mkt-set-body").innerHTML = "";
    SET.el.querySelector("#mkt-set-foot").innerHTML = "";
    SET.inst = null;
    SET.id = "";
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (SET.lastFocus && SET.lastFocus.focus) SET.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  /* ============================================================================
     v10.8 — 테마 마켓 · 업종별 번들 팩
     ----------------------------------------------------------------------------
     · 카탈로그는 정적 JSON(themes-market.json · bundles-market.json)에서 읽습니다.
       29_v108 SQL 을 실행한 DB 가 있으면 theme_presets · plugin_bundles 행을 겹쳐 읽습니다.
     · 테마 = CSS 변수 토큰만. 「미리보기」는 이 브라우저의 :root 변수만 잠시 바꾸고,
       「테마 적용」은 관리자 화면에서만 site_contents 의 테마 토큰으로 저장합니다.
     · 번들 = 테마 + 플러그인 + hunmin 홈 블록 프리셋. 「번들 일괄 적용」은 항목을 골라
       테마 적용 · (v10.5 권한 동의를 거친) 플러그인 설치 · 홈 블록 프리셋 순서로 진행합니다.
     ============================================================================ */
  /* v10.9 — 「스튜디오」는 관리자 화면에만 있습니다(공개 마켓은 3탭). */
  var TABS = [["plugins", "tabPlugins"], ["themes", "tabThemes"], ["bundles", "tabBundles"],
              ["studio", "tabStudio", "admin"], ["licenses", "tabLicenses", "admin"]];
  var CATALOG = {
    themes: { url: "/themes-market.json", items: null, industries: [], loading: false, error: "", tableMissing: false, inst: null, loaded: false },
    bundles: { url: "/bundles-market.json", items: null, industries: [], loading: false, error: "", tableMissing: false, inst: null, loaded: false }
  };
  var PREVIEW = { slug: "", saved: null, inst: null };
  var THEME_VARS = ["--bg", "--bg-2", "--card", "--ink", "--ink-2", "--ink-3", "--line", "--line-2",
    "--accent", "--accent-d", "--accent-s", "--r", "--r-s", "--font-head", "--hero-rgb", "--header-bg"];
  var FONT_CSS = {
    nanum: "'SBP Nanum','Nanum Gothic','나눔고딕',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    system: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif",
    serif: "Georgia,'Nanum Myeongjo','바탕',serif",
    sans: "'Helvetica Neue',Arial,'Malgun Gothic',sans-serif"
  };
  var PRESET_KEYS = { magazine: 1, craft: 1, org: 1 };

  function hex6(v) {
    var s = String(v == null ? "" : v).trim();
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : "";
  }
  function pxNum(v, min, max, dflt) {
    var n = parseInt(String(v == null ? "" : v).replace(/[^0-9-]/g, ""), 10);
    if (!isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, n));
  }
  function tokOf(t, a, b) { return t && (t[a] != null ? t[a] : (b ? t[b] : null)); }

  /* 테마 JSON 의 CSS 변수 맵 → SBPress 토큰(검사한 값만) */
  function themeTokens(theme) {
    var t = (theme && theme.tokens) || {};
    var out = {};
    var map = {
      bg: ["--bg", "bg"], bg2: ["--bg-2", "bg2"], surface: ["--surface", "surface"],
      ink: ["--text", "ink"], ink2: ["--text-2", "ink2"], ink3: ["--text-3", "ink3"],
      line: ["--line", "line"], line2: ["--line-2", "line2"],
      accent: ["--accent", "accent"], accentDark: ["--accent-dark", "accentDark"],
      accentSoft: ["--accent-soft", "accentSoft"]
    };
    Object.keys(map).forEach(function (k) {
      var v = hex6(tokOf(t, map[k][0], map[k][1]));
      if (v) out[k] = v;
    });
    out.radius = pxNum(tokOf(t, "--radius", "radius"), 0, 32, 18);
    var f = String(tokOf(t, "--font", "fontStack") || tokOf(t, "font", "") || "nanum");
    out.fontStack = FONT_CSS[f] ? f : "nanum";
    var pre = String(tokOf(t, "--preset", "preset") || "");
    out.preset = PRESET_KEYS[pre] ? pre : "";
    return out;
  }

  function dim(hex, f) {   /* f<0 어둡게, f>0 흰색 쪽으로 */
    var m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "";
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function mix(c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))); }
    var v = [mix(r), mix(g), mix(b)].map(function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
    return "#" + v.toUpperCase();
  }
  function rgba(hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "";
    var n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* 토큰을 지금 화면의 :root 에 적용(미리보기 · 적용 직후 공통) */
  function paintThemeVars(t) {
    var root = document.documentElement;
    function set(k, v) { if (v) root.style.setProperty(k, v); }
    if (t.bg) {
      set("--bg", t.bg);
      set("--bg-2", t.bg2 || dim(t.bg, -0.05));
      set("--hero-rgb", (function () {
        var m = /^#([0-9a-f]{6})$/i.exec(t.bg);
        if (!m) return "";
        var n = parseInt(m[1], 16);
        return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
      })());
      set("--header-bg", rgba(t.bg, 0.82));
    } else if (t.bg2) set("--bg-2", t.bg2);
    if (t.surface) set("--card", t.surface);
    if (t.ink) {
      set("--ink", t.ink);
      set("--ink-2", t.ink2 || dim(t.ink, 0.32));
      set("--ink-3", t.ink3 || dim(t.ink, 0.45));
    }
    if (t.line) set("--line", t.line);
    if (t.line2) set("--line-2", t.line2);
    else if (t.line) set("--line-2", dim(t.line, -0.12));
    if (t.accent) {
      set("--accent", t.accent);
      set("--accent-s", t.accentSoft || dim(t.accent, 0.86));
      root.setAttribute("data-accent", t.accent);
    }
    set("--accent-d", t.accentDark || (t.accent ? dim(t.accent, -0.18) : ""));
    if (t.radius != null) {
      set("--r", t.radius + "px");
      set("--r-s", Math.max(0, t.radius - 6) + "px");
    }
    if (t.fontStack && FONT_CSS[t.fontStack]) set("--font-head", FONT_CSS[t.fontStack]);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && t.accent) meta.setAttribute("content", t.accent);
  }

  function cat(kind) { return CATALOG[kind === "bundles" ? "bundles" : "themes"]; }

  function themeBySlug(slug) {
    var list = cat("themes").items || [];
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }
  function bundleBySlug(slug) {
    var list = cat("bundles").items || [];
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }
  function indLabel(inst, kind, id) {
    if (!id) return tr(inst.lang, "all");
    var list = cat(kind).industries || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return inst.lang === "en" ? (list[i].en || list[i].ko) : list[i].ko;
    }
    return id;
  }
  function themeName(inst, theme) {
    if (!theme) return "";
    return inst.lang === "en" ? (theme.name_en || theme.name) : theme.name;
  }
  function bundleName(inst, b) {
    if (!b) return "";
    return inst.lang === "en" ? (b.name_en || b.name) : b.name;
  }
  function themeSummary(inst, th) {
    if (!th) return "";
    return inst.lang === "en" ? (th.summary_en || th.summary || "") : (th.summary || "");
  }
  function bundleSummary(inst, b) {
    if (!b) return "";
    return inst.lang === "en" ? (b.summary_en || b.summary || "") : (b.summary || "");
  }

  function normalizeTheme(x) {
    if (!x || typeof x !== "object") return null;
    var slug = String(x.slug || "").trim();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug)) return null;
    var colors = Array.isArray(x.preview_colors)
      ? x.preview_colors.map(hex6).filter(Boolean).slice(0, 5) : [];
    return {
      slug: slug,
      name: String(x.name || slug).slice(0, 60),
      name_en: x.name_en ? String(x.name_en).slice(0, 80) : "",
      industry: String(x.industry || "general").slice(0, 20),
      summary: x.summary ? String(x.summary).slice(0, 300) : "",
      summary_en: x.summary_en ? String(x.summary_en).slice(0, 400) : "",
      tokens: (x.tokens && typeof x.tokens === "object") ? x.tokens : {},
      preview_colors: colors,
      version: String(x.version || "1.0.0").slice(0, 20),
      is_official: x.is_official !== false,
      __db: !!x.__db
    };
  }

  function normalizeBundle(x) {
    if (!x || typeof x !== "object") return null;
    var slug = String(x.slug || "").trim();
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug)) return null;
    var slugs = Array.isArray(x.plugin_slugs) ? x.plugin_slugs.filter(function (s) {
      return /^[a-z0-9][a-z0-9._-]{1,59}$/.test(String(s || ""));
    }).slice(0, 12) : [];
    var blocks = (x.blocks_preset && typeof x.blocks_preset === "object") ? x.blocks_preset : {};
    var items = (window.CRAFT_HUNMIN && window.CRAFT_HUNMIN.parseBlocks)
      ? window.CRAFT_HUNMIN.parseBlocks(blocks || [])
      : (Array.isArray(blocks.items) ? blocks.items : []);
    return {
      slug: slug,
      name: String(x.name || slug).slice(0, 80),
      name_en: x.name_en ? String(x.name_en).slice(0, 100) : "",
      industry: String(x.industry || "general").slice(0, 20),
      summary: x.summary ? String(x.summary).slice(0, 300) : "",
      summary_en: x.summary_en ? String(x.summary_en).slice(0, 400) : "",
      theme_slug: /^[a-z0-9][a-z0-9-]{1,39}$/.test(String(x.theme_slug || "")) ? x.theme_slug : "",
      plugin_slugs: slugs,
      blocks_preset: { v: 1, items: items },
      block_count: items.length,
      version: String(x.version || "1.0.0").slice(0, 20),
      __db: !!x.__db
    };
  }

  function indsOf(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) {
      var k = x.industry;
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(k);
    });
    return out;
  }

  function mergeDb(kind, rows) {
    var c = cat(kind);
    var cur = c.items || [];
    var bySlug = {};
    cur.forEach(function (x) { bySlug[x.slug] = x; });
    (rows || []).forEach(function (raw) {
      var row = Object.assign({}, raw, { __db: true });
      var x = kind === "bundles" ? normalizeBundle(row) : normalizeTheme(row);
      if (x) bySlug[x.slug] = x;
    });
    var items = Object.keys(bySlug).map(function (k) { return bySlug[k]; });
    items.sort(function (a, b) {
      if (!!b.is_official !== !!a.is_official) return b.is_official ? 1 : -1;
      return String(a.slug) < String(b.slug) ? -1 : 1;
    });
    c.items = items;
    c.inds = indsOf(items);
  }

  /* 카탈로그 읽기 — JSON 먼저, DB(29_v108) 가 있으면 겹쳐 읽기 */
  function loadCatalog(kind, inst, force) {
    var c = cat(kind);
    if (c.loading) return;
    if (c.loaded && !force) return;
    c.loading = true;
    if (inst) c.inst = inst;
    if (inst) paintTools(inst);
    function finish() {
      c.loading = false;
      c.loaded = true;
      if (c.inst) { paintTools(c.inst); render(c.inst); }
    }
    function fromDb() {
      if (!sbCfg().url) { c.tableMissing = true; finish(); return; }
      var table = kind === "bundles" ? "plugin_bundles" : "theme_presets";
      sbRequest("/rest/v1/" + table + "?select=*&order=created_at.asc&limit=200", { token: sbToken() })
        .then(function (rows) {
          c.tableMissing = false;
          mergeDb(kind, Array.isArray(rows) ? rows : []);
          finish();
        }, function (e) {
          c.tableMissing = missingTable(e);
          if (!c.tableMissing) c.error = String((e && e.message) || e);
          finish();
        });
    }
    if (typeof fetch !== "function") { c.error = "no fetch"; finish(); return; }
    fetch(c.url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        c.error = "";
        var list = (data && (kind === "bundles" ? data.bundles : data.themes)) || [];
        c.industries = Array.isArray(data && data.industries) ? data.industries.filter(function (x) {
          return x && /^[a-z]{1,20}$/.test(String(x.id || ""));
        }).slice(0, 12) : [];
        c.items = list.map(function (x) { return kind === "bundles" ? normalizeBundle(x) : normalizeTheme(x); })
          .filter(Boolean);
        c.inds = indsOf(c.items);
        fromDb();
      })
      .catch(function (e) {
        c.error = String((e && e.message) || e);
        c.items = c.items || [];
        finish();
      });
  }

  function catMissingHtml(inst, kind) {
    var c = cat(kind);
    if (!c.tableMissing) return "";
    return '<p class="mkt-note mkt-warn" id="mkt-cat-missing">' + esc(tr(inst.lang, "catNeedSql")) + "</p>";
  }

  /* ---------------- 탭 · 도구 영역 ---------------- */
  function tabsHtml(inst) {
    var lang = inst.lang;
    var cur = inst.tab || "plugins";
    return '<div class="mkt-tabs" role="tablist" aria-label="' + esc(tr(lang, "tabsAria")) + '">' +
      TABS.filter(function (t) { return t[2] !== "admin" || inst.mode === "admin"; }).map(function (t) {
        var on = cur === t[0];
        return '<button type="button" role="tab" class="mkt-tab' + (on ? " is-on" : "") + '"' +
          ' aria-selected="' + (on ? "true" : "false") + '" data-mkt-tab="' + t[0] + '">' +
          esc(tr(lang, t[1])) + "</button>";
      }).join("") + "</div>";
  }

  function indChipsHtml(inst, kind, cur) {
    var c = cat(kind);
    var inds = c.inds || [];
    if (!inds.length) return "";
    var lang = inst.lang;
    var head = '<button type="button" class="mkt-chip' + (!cur ? " on" : "") + '" data-mkt-ind="' +
      (kind === "bundles" ? "b" : "t") + '|">' + esc(tr(lang, "all")) + "</button>";
    return '<div class="mkt-chips" data-group="ind" role="group" aria-label="' + esc(tr(lang, "fIndustry")) + '">' +
      '<span class="mkt-chip-label">' + esc(tr(lang, "fIndustry")) + "</span>" + head +
      inds.map(function (id) {
        return '<button type="button" class="mkt-chip' + (cur === id ? " on" : "") + '" data-mkt-ind="' +
          (kind === "bundles" ? "b" : "t") + '|' + esc(id) + '">' + esc(indLabel(inst, kind, id)) + "</button>";
      }).join("") + "</div>";
  }

  function previewBarHtml(inst) {
    if (!PREVIEW.slug) return "";
    var th = themeBySlug(PREVIEW.slug);
    if (!th) return "";
    return '<div class="mkt-previewbar" id="mkt-previewbar" role="status">' +
      '<span class="mkt-preview-swatch" aria-hidden="true">' + swatchesHtml(th) + "</span>" +
      '<b>' + esc(tr(inst.lang, "previewing", { name: themeName(inst, th) })) + "</b>" +
      '<span class="muted">' + esc(tr(inst.lang, "previewNote")) + "</span>" +
      '<button type="button" class="btn btn-ghost btn-sm" data-mkt-theme-stop="1">' +
        esc(tr(inst.lang, "previewStop")) + "</button></div>";
  }

  function swatchesHtml(th) {
    var colors = (th && th.preview_colors) || [];
    return colors.slice(0, 5).map(function (c) {
      return '<i style="background:' + esc(c) + '"></i>';
    }).join("");
  }

  function themeToolsHtml(inst) {
    var lang = inst.lang;
    var list = filteredThemes(inst);
    return previewBarHtml(inst) +
      '<div class="mkt-chipset">' + indChipsHtml(inst, "themes", inst.indT) + "</div>" +
      '<p class="mkt-count" id="mkt-cat-count" role="status" aria-live="polite">' +
        esc(tr(lang, "count", { m: list.length, n: (cat("themes").items || []).length })) + "</p>" +
      '<p class="mkt-lead mkt-lead-sm">' + esc(tr(lang, "themesLead")) + "</p>" +
      catMissingHtml(inst, "themes") +
      '<p class="mkt-empty" id="mkt-cat-empty"' + (list.length ? " hidden" : "") + ">" +
        esc(tr(lang, cat("themes").loading ? "loading" : "themesEmpty")) + "</p>" +
      '<p class="mkt-flash' + (FLASH.kind ? " " + esc(FLASH.kind) : "") + '" id="mkt-flash" role="status" aria-live="polite">' +
        esc(FLASH.text) + "</p>";
  }

  function bundleToolsHtml(inst) {
    var lang = inst.lang;
    var list = filteredBundles(inst);
    return '<div class="mkt-chipset">' + indChipsHtml(inst, "bundles", inst.indB) + "</div>" +
      '<p class="mkt-count" id="mkt-cat-count" role="status" aria-live="polite">' +
        esc(tr(lang, "count", { m: list.length, n: (cat("bundles").items || []).length })) + "</p>" +
      '<p class="mkt-lead mkt-lead-sm">' + esc(tr(lang, "bundlesLead")) + "</p>" +
      catMissingHtml(inst, "bundles") +
      '<p class="mkt-empty" id="mkt-cat-empty"' + (list.length ? " hidden" : "") + ">" +
        esc(tr(lang, cat("bundles").loading ? "loading" : "bundlesEmpty")) + "</p>" +
      '<p class="mkt-flash' + (FLASH.kind ? " " + esc(FLASH.kind) : "") + '" id="mkt-flash" role="status" aria-live="polite">' +
        esc(FLASH.text) + "</p>";
  }

  function filteredThemes(inst) {
    var ind = inst.indT || "";
    return (cat("themes").items || []).filter(function (t) { return !ind || t.industry === ind; });
  }
  function filteredBundles(inst) {
    var ind = inst.indB || "";
    return (cat("bundles").items || []).filter(function (b) { return !ind || b.industry === ind; });
  }

  /* ---------------- 테마 카드 ---------------- */
  function themeCardHtml(inst, th) {
    var lang = inst.lang;
    var t = themeTokens(th);
    var isAdmin = inst.mode === "admin";
    var on = PREVIEW.slug === th.slug;
    return '<article class="mkt-theme' + (on ? " is-previewing" : "") + '" data-theme-slug="' + esc(th.slug) +
      '" data-industry="' + esc(th.industry) + '">' +
      '<div class="mkt-swatch" aria-hidden="true">' + swatchesHtml(th) + "</div>" +
      '<header class="mkt-theme-head"><h3>' + esc(themeName(inst, th)) +
        ' <span class="plug-tag ind">' + esc(indLabel(inst, "themes", th.industry)) + "</span>" +
        (th.__db ? ' <span class="plug-tag db">' + esc(tr(lang, "fromDb")) + "</span>" : "") + "</h3>" +

      "</header>" +
      '<p class="mkt-theme-sum">' + esc(themeSummary(inst, th)) + "</p>" +
      '<p class="mkt-theme-tokens">' +
        '<span><i style="background:' + esc(t.bg || "#FFFFFF") + '"></i>' + esc(t.bg || "—") + "</span>" +
        '<span><i style="background:' + esc(t.accent || "#000000") + '"></i>' + esc(t.accent || "—") + "</span>" +
        '<span>' + esc(tr(lang, "radiusShort", { n: t.radius })) + "</span>" +
      "</p>" +
      '<div class="mkt-actions mkt-theme-acts">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-mkt-theme-preview="' + esc(th.slug) + '">' +
          esc(tr(lang, on ? "previewStop" : "preview")) + "</button>" +
        (isAdmin
          ? '<button type="button" class="btn btn-primary btn-sm" data-mkt-theme-apply="' + esc(th.slug) + '">' +
              esc(tr(lang, "themeApply")) + "</button>"
          : '<span class="mkt-note mkt-inline">' + esc(tr(lang, "applyAdminOnly")) + "</span>") +
      "</div></article>";
  }

  function renderThemes(inst) {
    var list = filteredThemes(inst);
    inst.root.innerHTML = list.map(function (th) { return themeCardHtml(inst, th); }).join("");
    var count = inst.tools ? inst.tools.querySelector("#mkt-cat-count") : null;
    if (count) count.textContent = tr(inst.lang, "count", { m: list.length, n: (cat("themes").items || []).length });
    var empty = inst.tools ? inst.tools.querySelector("#mkt-cat-empty") : null;
    if (empty) empty.hidden = list.length > 0;
  }

  /* ---------------- 번들 카드 ---------------- */
  function pluginName(inst, slug) {
    var p = inst && inst.data ? byId(inst, slug) : null;
    if (p) return disp(inst, p).name || slug;
    var c = cat("bundles").pluginNames || {};
    return c[slug] || slug;
  }

  function bundleCardHtml(inst, b) {
    var lang = inst.lang;
    var th = themeBySlug(b.theme_slug);
    var isAdmin = inst.mode === "admin";
    var plugins = b.plugin_slugs.map(function (s) {
      var p = inst.data ? byId(inst, s) : null;
      var done = !!(p && inst.installed && inst.installed(s));
      return '<span class="plug-tag' + (done ? " is-on" : "") + '">' + esc(pluginName(inst, s)) +
        (done ? " ✓" : "") + "</span>";
    }).join("");
    var blocks = (b.blocks_preset.items || []).map(function (it) {
      return '<span class="mkt-blockchip">' + esc(blockLabel(lang, it.type)) + "</span>";
    }).join("");
    return '<article class="mkt-bundle" data-bundle-slug="' + esc(b.slug) + '" data-industry="' + esc(b.industry) + '">' +
      '<header class="mkt-bundle-head"><h3>' + esc(bundleName(inst, b)) +
        ' <span class="plug-tag ind">' + esc(indLabel(inst, "bundles", b.industry)) + "</span>" +
        (b.__db ? ' <span class="plug-tag db">' + esc(tr(lang, "fromDb")) + "</span>" : "") + "</h3>" +

      "</header>" +
      '<p class="mkt-theme-sum">' + esc(bundleSummary(inst, b)) + "</p>" +
      '<dl class="mkt-bundle-facts">' +
        "<div><dt>" + esc(tr(lang, "bundleTheme")) + "</dt><dd>" +
          (th ? '<span class="mkt-mini-swatch" aria-hidden="true">' + swatchesHtml(th) + "</span>" +
            esc(themeName(inst, th)) : esc(tr(lang, "bundleNoTheme"))) + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "bundlePlugins")) + "</dt><dd>" + (plugins || "—") + "</dd></div>" +
        "<div><dt>" + esc(tr(lang, "bundleBlocks")) + "</dt><dd>" +
          (blocks || "—") + "</dd></div>" +
      "</dl>" +
      '<div class="mkt-actions">' +
        '<button type="button" class="btn ' + (isAdmin ? "btn-primary" : "btn-ghost") + ' btn-sm" data-mkt-bundle-open="' +
          esc(b.slug) + '">' + esc(tr(lang, isAdmin ? "bundleApply" : "bundleView")) + "</button>" +
      "</div></article>";
  }

  function blockLabel(lang, type) {
    var map = {
      ko: { latest: "최신글", popular: "인기글", map: "지도", form: "구독/제보 폼", gallery: "갤러리",
            text: "텍스트·배너", table: "표", cta: "버튼/CTA", embed: "임베드" },
      en: { latest: "Latest posts", popular: "Popular", map: "Map", form: "Subscribe form", gallery: "Gallery",
            text: "Text banner", table: "Table", cta: "Call to action", embed: "Embed" }
    };
    var d = (lang === "en" ? map.en : map.ko)[type];
    if (d) return d;
    return String(type || "").replace(/^sbp:[^:]+:/, "");
  }

  function renderBundles(inst) {
    if (cat("themes").loaded || !cat("themes").loading) loadCatalog("themes", inst, false);
    var list = filteredBundles(inst);
    inst.root.innerHTML = list.map(function (b) { return bundleCardHtml(inst, b); }).join("");
    var count = inst.tools ? inst.tools.querySelector("#mkt-cat-count") : null;
    if (count) count.textContent = tr(inst.lang, "count", { m: list.length, n: (cat("bundles").items || []).length });
    var empty = inst.tools ? inst.tools.querySelector("#mkt-cat-empty") : null;
    if (empty) empty.hidden = list.length > 0;
  }

  /* ---------------- 미리보기 ---------------- */
  function startPreview(inst, slug) {
    var th = themeBySlug(slug);
    if (!th) return;
    if (!PREVIEW.saved) {
      PREVIEW.saved = {
        style: document.documentElement.getAttribute("style") || "",
        preset: document.body.getAttribute("data-theme") || "",
        accent: document.documentElement.getAttribute("data-accent") || ""
      };
    }
    PREVIEW.slug = slug;
    PREVIEW.inst = inst;
    paintThemeVars(themeTokens(th));
    if (themeTokens(th).preset) document.body.setAttribute("data-theme", themeTokens(th).preset);
    paintTools(inst);
    render(inst);
  }

  function stopPreview(inst, quiet) {
    if (PREVIEW.saved) {
      document.documentElement.setAttribute("style", PREVIEW.saved.style);
      if (PREVIEW.saved.preset) document.body.setAttribute("data-theme", PREVIEW.saved.preset);
      else document.body.removeAttribute("data-theme");
      if (PREVIEW.saved.accent) document.documentElement.setAttribute("data-accent", PREVIEW.saved.accent);
      else document.documentElement.removeAttribute("data-accent");
    }
    PREVIEW.saved = null;
    PREVIEW.slug = "";
    var target = inst || PREVIEW.inst;
    PREVIEW.inst = null;
    if (target && !quiet) { paintTools(target); render(target); }
  }

  function applyTheme(inst, slug, btn) {
    var th = themeBySlug(slug);
    if (!th) return;
    if (inst.mode !== "admin" || typeof inst.onApplyTheme !== "function") {
      flash(inst, tr(inst.lang, "applyAdminOnly"), "err");
      return;
    }
    if (btn) { btn.disabled = true; }
    var old = btn ? btn.textContent : "";
    if (btn) btn.textContent = tr(inst.lang, "themeApplying");
    inst.onApplyTheme(th, function (err, msg) {
      if (btn) { btn.disabled = false; btn.textContent = old; }
      if (err) { flash(inst, tr(inst.lang, "themeApplyFail") + err, "err"); return; }
      /* 저장했으니 미리보기는 그대로 두되 되돌리기 정보만 지웁니다(이미 적용됨). */
      PREVIEW.saved = null;
      PREVIEW.slug = slug;
      flash(inst, msg || tr(inst.lang, "themeApplied", { name: themeName(inst, th) }), "ok");
      paintTools(inst);
      render(inst);
    });
  }

  /* ---------------- 번들 일괄 적용 모달 ---------------- */
  var BND = { el: null, inst: null, slug: "", busy: false, lastFocus: null, msg: "", kind: "" };

  function bundlePluginRows(inst, b) {
    return b.plugin_slugs.map(function (s) {
      var p = inst.data ? byId(inst, s) : null;
      var d = p ? disp(inst, p) : null;
      var done = !!(p && inst.installed && inst.installed(s));
      var perms = p ? (p.permissions || []) : [];
      return {
        slug: s, name: d ? d.name : pluginName(inst, s), installed: done,
        version: p ? p.version : "", perms: perms, item: p || null
      };
    });
  }

  function permsOf(rows) {
    var seen = {}, out = [];
    rows.forEach(function (r) {
      if (r.installed) return;
      r.perms.forEach(function (p) {
        var k = String(p || "");
        if (!k || seen[k]) return;
        seen[k] = 1;
        out.push(k);
      });
    });
    return out;
  }

  function bundleModalHtml(inst, b) {
    var lang = inst.lang;
    var th = themeBySlug(b.theme_slug);
    var rows = bundlePluginRows(inst, b);
    var need = rows.filter(function (r) { return !r.installed; });
    var perms = permsOf(rows);
    var isAdmin = inst.mode === "admin";
    var blocks = (b.blocks_preset.items || []).map(function (it) {
      /* 블록 제목은 사이트 내용(한국어)이라 영어 화면에서는 종류만 보여 줍니다. */
      return '<li><b>' + esc(blockLabel(lang, it.type)) + "</b>" +
        (lang !== "en" && it.props && it.props.title
          ? " · " + esc(String(it.props.title).slice(0, 60)) : "") + "</li>";
    }).join("");
    var permList = perms.length
      ? perms.map(function (p) {
          return "<li><code>" + esc(p) + "</code> " + esc(permText(p, lang)) + "</li>";
        }).join("")
      : '<li class="muted">' + esc(tr(lang, "bundleNoPerms")) + "</li>";
    return '<div class="mkt-modal-backdrop" data-mkt-bnd-close="1"></div>' +
      '<div class="mkt-modal-card mkt-bnd-card" role="dialog" aria-modal="true" aria-labelledby="mkt-bnd-title">' +
        '<header class="mkt-modal-head"><div><h2 id="mkt-bnd-title">' + esc(tr(lang, "bundleModalTitle", { name: bundleName(inst, b) })) + "</h2>" +
          '<p class="mkt-bnd-lead">' + esc(bundleSummary(inst, b)) + "</p></div>" +
          '<button type="button" class="mkt-modal-x" data-mkt-bnd-close="1" aria-label="' + esc(tr(lang, "close")) + '">×</button>' +
        "</header>" +
        '<div class="mkt-modal-body">' +
          '<ul class="mkt-bnd-steps">' +
            '<li class="mkt-bnd-step"><label class="mkt-bnd-check"><input type="checkbox" data-bnd-opt="theme"' +
              (isAdmin && th ? " checked" : " disabled") + ">" +
              '<span class="mkt-bnd-check-main"><b>' + esc(tr(lang, "bndTheme")) + "</b> " +
              (th ? esc(themeName(inst, th)) + ' <span class="mkt-mini-swatch" aria-hidden="true">' +
                swatchesHtml(th) + "</span>" : esc(tr(lang, "bundleNoTheme"))) + "</span></label></li>" +
            '<li class="mkt-bnd-step"><label class="mkt-bnd-check"><input type="checkbox" data-bnd-opt="plugins"' +
              (isAdmin && need.length ? " checked" : " disabled") + ">" +
              '<span class="mkt-bnd-check-main"><b>' + esc(tr(lang, "bndPlugins")) + "</b> " +
              esc(tr(lang, "bndPluginsNote", { n: need.length, t: rows.length })) + "</span></label>" +
              '<ul class="mkt-bnd-plugins">' + rows.map(function (r) {
                return "<li" + (r.installed ? ' class="is-on"' : "") + "><span>" + esc(r.name) +
                  (r.version ? ' <span class="plug-tag ver">v' + esc(r.version) + "</span>" : "") + "</span>" +
                  '<span class="mkt-bnd-state">' + esc(tr(lang, r.installed ? "bndInstalled" : "bndWillInstall")) + "</span></li>";
              }).join("") + "</ul>" +
              '<div class="mkt-bnd-perms"><p class="mkt-bnd-perms-head">' + esc(tr(lang, "bndPermsHead")) + "</p>" +
                '<ul class="mkt-perms">' + permList + "</ul>" +
                '<p class="mkt-hint">' + esc(tr(lang, "bndPermsNote")) + "</p></div>" +
            "</li>" +
            '<li class="mkt-bnd-step"><label class="mkt-bnd-check"><input type="checkbox" data-bnd-opt="blocks"' +
              (isAdmin && blocks ? " checked" : " disabled") + ">" +
              '<span class="mkt-bnd-check-main"><b>' + esc(tr(lang, "bndBlocks")) + "</b> " +
              esc(tr(lang, "bndBlocksNote", { n: (b.blocks_preset.items || []).length })) + "</span></label>" +
              '<ul class="mkt-bnd-blocks">' + (blocks || '<li class="muted">—</li>') + "</ul>" +
              '<p class="mkt-hint">' + esc(tr(lang, "bndBlocksHint")) + "</p></li>" +
          "</ul>" +
          '<p class="mkt-bnd-msg' + (BND.kind ? " " + esc(BND.kind) : "") + '" id="mkt-bnd-msg" role="status" aria-live="polite">' +
            esc(BND.msg || (isAdmin ? "" : tr(lang, "bundleViewNote"))) + "</p>" +
        "</div>" +
        '<footer class="mkt-modal-foot">' +
          '<span class="mkt-foot-id">' + esc(b.slug) + (b.version ? " · v" + esc(b.version) : "") + "</span>" +
          (isAdmin
            ? '<button type="button" class="btn btn-primary btn-sm" data-mkt-bnd-go="1">' + esc(tr(lang, "bndGo")) + "</button>"
            : "") +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-bnd-close="1">' + esc(tr(lang, "close")) + "</button>" +
        "</footer>" +
      "</div>";
  }

  function ensureBundleModal() {
    if (BND.el && document.body.contains(BND.el)) return BND.el;
    var el = document.createElement("div");
    el.className = "mkt-modal mkt-bnd-modal";
    el.id = "mkt-bundle";
    el.hidden = true;
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-mkt-bnd-close]")) { closeBundle(); return; }
      var go = e.target.closest ? e.target.closest("[data-mkt-bnd-go]") : null;
      if (go) { runBundle(go); return; }
    });
    document.addEventListener("keydown", function (e) {
      if (!BND.el || BND.el.hidden) return;
      if (e.key === "Escape") closeBundle();
    });
    BND.el = el;
    return el;
  }

  function openBundle(inst, slug) {
    var b = bundleBySlug(slug);
    if (!b) return;
    var el = ensureBundleModal();
    BND.inst = inst;
    BND.slug = slug;
    BND.msg = "";
    BND.kind = "";
    BND.busy = false;
    BND.lastFocus = document.activeElement;
    el.innerHTML = bundleModalHtml(inst, b);
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    try { el.querySelector(".mkt-modal-x").focus(); } catch (e) { /* noop */ }
  }

  function closeBundle() {
    if (!BND.el) return;
    if (BND.busy) return;
    BND.el.hidden = true;
    BND.el.innerHTML = "";
    BND.slug = "";
    BND.inst = null;
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (BND.lastFocus && BND.lastFocus.focus) BND.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  function bndMsg(text, kind) {
    var box = BND.el ? BND.el.querySelector("#mkt-bnd-msg") : null;
    BND.msg = text || "";
    BND.kind = kind || "";
    if (box) {
      box.textContent = BND.msg;
      box.className = "mkt-bnd-msg" + (kind ? " " + kind : "");
    }
  }

  function runBundle(btn) {
    var inst = BND.inst;
    var b = bundleBySlug(BND.slug);
    if (!inst || !b || BND.busy) return;
    var el = BND.el;
    function opt(k) {
      var n = el ? el.querySelector('[data-bnd-opt="' + k + '"]') : null;
      return !!(n && n.checked && !n.disabled);
    }
    var opts = { theme: opt("theme"), plugins: opt("plugins"), blocks: opt("blocks") };
    if (!opts.theme && !opts.plugins && !opts.blocks) {
      bndMsg(tr(inst.lang, "bndPickOne"), "err");
      return;
    }
    if (typeof inst.onApplyBundle !== "function") {
      bndMsg(tr(inst.lang, "bndAdminOnly"), "err");
      return;
    }
    BND.busy = true;
    if (btn) btn.disabled = true;
    if (el) {
      [].forEach.call(el.querySelectorAll("[data-bnd-opt]"), function (n) { n.disabled = true; });
    }
    bndMsg(tr(inst.lang, "bndRunning"), "");
    inst.onApplyBundle(b, opts, function (key, vars) {
      /* 진행 알림 — 실패해도 멈추지 않고 끝까지 진행합니다(각 단계가 결과를 모읍니다). */
      bndMsg(tr(inst.lang, key || "bndRunning", vars || {}), "");
    }, function (err, info) {
      BND.busy = false;
      if (btn) btn.disabled = false;
      if (el) [].forEach.call(el.querySelectorAll("[data-bnd-opt]"), function (n) {
        n.disabled = n.getAttribute("data-bnd-opt") === "plugins" && n.getAttribute("data-disable") === "1";
      });
      info = info || {};
      if (err && !info.partial) {
        bndMsg(tr(inst.lang, "bndFail") + err, "err");
        return;
      }
      var parts = [];
      if (info.theme) parts.push(tr(inst.lang, "bndDoneTheme", { name: info.theme }));
      if (info.plugins != null) parts.push(tr(inst.lang, "bndDonePlugins", { n: info.plugins }));
      if (info.blocks != null) parts.push(tr(inst.lang, "bndDoneBlocks", { n: info.blocks }));
      bndMsg(tr(inst.lang, "bndDone", { list: parts.join(" · ") }) +
        (info.note ? " " + info.note : "") +
        (info.auditMissing ? " " + tr(inst.lang, "catNeedSql") : ""), "ok");
      flash(inst, tr(inst.lang, "bndFlash", { name: bundleName(inst, b) }) + " " + parts.join(" · "), "ok");
      paintTools(inst);
      render(inst);
    });
  }

  /* ---------------- 탭 전환·카드 클릭 위임 ---------------- */
  function tabsDelegation(host) {
    if (host.getAttribute("data-mkt-cattabs-bound")) return;
    host.setAttribute("data-mkt-cattabs-bound", "1");
    host.addEventListener("click", function (e) {
      var inst2 = host.__mktInst;
      if (!inst2 || !e.target.closest) return;
      var tab = e.target.closest("[data-mkt-tab]");
      if (tab) {
        var v = tab.getAttribute("data-mkt-tab");
        inst2.tab = (v === "themes" || v === "bundles" ||
                   ((v === "studio" || v === "licenses") && inst2.mode === "admin")) ? v : "plugins";
        if (inst2.tab === "themes" || inst2.tab === "bundles") loadCatalog(inst2.tab, inst2, false);
        paintTools(inst2);
        render(inst2);
        return;
      }
      var chip = e.target.closest("[data-mkt-ind]");
      if (chip) {
        var raw = String(chip.getAttribute("data-mkt-ind") || "");
        var bits = raw.split("|");
        if (bits[0] === "b") inst2.indB = bits[1] || "";
        else inst2.indT = bits[1] || "";
        paintTools(inst2);
        render(inst2);
        return;
      }
      var pv = e.target.closest("[data-mkt-theme-preview]");
      if (pv) { startPreview(inst2, pv.getAttribute("data-mkt-theme-preview")); return; }
      var ap = e.target.closest("[data-mkt-theme-apply]");
      if (ap) { applyTheme(inst2, ap.getAttribute("data-mkt-theme-apply"), ap); return; }
      var stop = e.target.closest("[data-mkt-theme-stop]");
      if (stop) { stopPreview(inst2); return; }
      var open = e.target.closest("[data-mkt-bundle-open]");
      if (open) { openBundle(inst2, open.getAttribute("data-mkt-bundle-open")); return; }
    });
  }

  function catalogDelegation(root) {
    if (root.getAttribute("data-mkt-cat-bound")) return;
    root.setAttribute("data-mkt-cat-bound", "1");
    root.addEventListener("click", function (e) {
      var inst2 = root.__sbpMarket;
      if (!inst2 || !e.target.closest) return;
      var card = e.target.closest(".mkt-theme, .mkt-bundle");
      if (!card) return;
      var pv = e.target.closest("[data-mkt-theme-preview]");
      if (pv) { startPreview(inst2, pv.getAttribute("data-mkt-theme-preview")); return; }
      var ap = e.target.closest("[data-mkt-theme-apply]");
      if (ap) { applyTheme(inst2, ap.getAttribute("data-mkt-theme-apply"), ap); return; }
      var bd = e.target.closest("[data-mkt-bundle-open]");
      if (bd) { openBundle(inst2, bd.getAttribute("data-mkt-bundle-open")); return; }
      if (card.classList.contains("mkt-theme")) {
        var slug = card.getAttribute("data-theme-slug");
        if (slug === PREVIEW.slug) stopPreview(inst2);
        else startPreview(inst2, slug);
      }
    });
  }

  /* ======================================================================
     v10.10 — 유료 라이선스 · 중앙 마켓 허브
     ----------------------------------------------------------------------
     라이선스는 plugin_licenses(31_v1010)에 있고 anon 은 읽지 못합니다(관리자 전용).
     화면은 verify_plugin_license RPC 로 키만 확인하고, 목록은 관리자 화면에서만 읽습니다.
     31_v1010 을 실행하지 않은 사이트는 발급·확인을 이 브라우저(localStorage:
     sbpress-licenses)에만 남기고 “31_v1010 SQL 을 실행하면 서버에 남습니다” 로 안내합니다. */
  var LIC = { rows: null, loading: false, tableMissing: false, loaded: false, msg: "", msgKind: "",
              busy: false, verified: {}, origin: "", local: false };
  var LIC_LS = "sbpress-licenses";
  var LIC_KEY_RE = /^SBP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  function licLocal() {
    var v = readLS(LIC_LS, null);
    if (!v || typeof v !== "object") v = {};
    if (!Array.isArray(v.rows)) v.rows = [];
    if (!v.verified || typeof v.verified !== "object") v.verified = {};
    return v;
  }

  function licStore(mutate) {
    var v = licLocal();
    if (mutate) { try { mutate(v); } catch (e) { /* noop */ } }
    writeLS(LIC_LS, v);
    if (v.verified) LIC.verified = v.verified;
    if (Array.isArray(v.rows) && LIC.tableMissing) LIC.rows = v.rows;
    return v;
  }

  function licSiteOrigin() {
    try { return String(location.origin || "").replace(/\/+$/, ""); } catch (e) { return ""; }
  }

  function licKeyRandom() {
    var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var arr = new Uint8Array(16), i;
    try { window.crypto.getRandomValues(arr); }
    catch (e) { for (i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256); }
    var out = "SBP";
    for (var g = 0; g < 4; g++) {
      var s = "";
      for (i = 0; i < 4; i++) s += A.charAt(arr[g * 4 + i] % 36);
      out += "-" + s;
    }
    return out;
  }

  /* 이 플러그인의 라이선스 상태 — 확인된 키가 있으면 ok 입니다. */
  function licenseStateOf(inst, p) {
    var id = p && p.id ? String(p.id) : "";
    var need = !!(p && (p.license_required === true || p.pricing === "paid"));
    var v = (LIC.verified && LIC.verified[id]) || (licLocal().verified || {})[id] || null;
    if (!need) return { required: false, ok: true, plan: "", key: "", info: null };
    var ok = !!(v && v.key && (!v.expires_at || Date.parse(v.expires_at) > Date.now()));
    return { required: true, ok: ok, plan: (v && v.plan) || p.plan_type || "pro",
             key: ok ? v.key : "", info: ok ? v : null, at: (v && v.at) || "" };
  }

  function licRemember(inst, slug, info) {
    LIC.verified = LIC.verified || {};
    LIC.verified[slug] = info;
    inst.licensed = inst.licensed || {};
    inst.licensed[slug] = info;
    licStore(function (v) { v.verified[slug] = info; });
  }

  function licStatusText(inst, s) {
    var k = String(s || "").toLowerCase();
    return tr(inst.lang, k === "revoked" ? "licStatusRevoked" : (k === "expired" ? "licStatusExpired" : "licStatusActive"));
  }

  function licStatusClass(s) {
    var k = String(s || "").toLowerCase();
    return k === "revoked" ? "is-revoked" : (k === "expired" ? "is-expired" : "is-active");
  }

  /* ---------------- 목록 읽기 ---------------- */
  function loadLicenses(inst, force) {
    if (LIC.loading) return;
    if (LIC.loaded && !force) return;
    LIC.loading = true;
    LIC.inst = inst;
    var local = licLocal();
    if (!sbCfg().url) {
      LIC.loading = false;
      LIC.loaded = true;
      LIC.tableMissing = true;
      LIC.local = true;
      LIC.rows = local.rows.slice();
      if (inst && inst.tab === "licenses") paintTools(inst);
      return;
    }
    sbRequest("/rest/v1/plugin_licenses?select=*&order=created_at.desc")
      .then(function (rows) {
        LIC.loading = false;
        LIC.loaded = true;
        LIC.tableMissing = false;
        LIC.local = false;
        LIC.rows = Array.isArray(rows) ? rows.map(function (r) {
          return { id: r.id, license_key: String(r.license_key || ""), plugin_slug: r.plugin_slug,
                   plan_type: r.plan_type, status: r.status, holder_name: r.holder_name,
                   holder_email: r.holder_email, max_sites: Number(r.max_sites || 1),
                   activated_sites: Array.isArray(r.activated_sites) ? r.activated_sites : [],
                   expires_at: r.expires_at, created_at: r.created_at };
        }) : [];
        licStore(function (v) { v.rows = LIC.rows.slice(0, 200); });
        if (inst && inst.tab === "licenses") paintTools(inst);
      }, function (e) {
        LIC.loading = false;
        LIC.loaded = true;
        if (missingTable(e) || missingRpc(e)) {
          LIC.tableMissing = true;
          LIC.local = true;
          LIC.rows = local.rows.slice();
        } else {
          LIC.msg = tr((inst && inst.lang) || "ko", "licFail") + (e && e.message ? e.message : e) + " 31_v1010";
          LIC.msgKind = "err";
          LIC.rows = [];
        }
        if (inst && inst.tab === "licenses") paintTools(inst);
      });
  }

  /* ---------------- 키 확인(설치하는 사이트) ---------------- */
  function licVerify(inst, p, key, cb) {
    var done = typeof cb === "function" ? cb : function () {};
    var lang = inst.lang;
    var k = String(key || "").trim().toUpperCase();
    if (!k) { done(tr(lang, "licNeedKey")); return; }
    if (!LIC_KEY_RE.test(k)) { done(tr(lang, "licBadFormat")); return; }
    var slug = String(p.id || "").trim().toLowerCase();
    var origin = licSiteOrigin();

    function accept(info, local) {
      licRemember(inst, slug, { key: k, plan: info.plan_type || p.plan_type || "pro",
        at: new Date().toISOString(), expires_at: info.expires_at || null, local: !!local,
        used_sites: info.used_sites, max_sites: info.max_sites });
      done(null, info);
    }

    function localCheck() {
      var rows = licLocal().rows || [];
      var row = null;
      for (var i = 0; i < rows.length; i++) if (String(rows[i].license_key || "").toUpperCase() === k) row = rows[i];
      if (!row) { done(tr(lang, "licFail") + "not-found"); return; }
      if (String(row.plugin_slug || "") !== slug) { done(tr(lang, "licFail") + "plugin-mismatch"); return; }
      if (String(row.status || "active") === "revoked") { done(tr(lang, "licFail") + "revoked"); return; }
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) { done(tr(lang, "licFail") + "expired"); return; }
      var sites = Array.isArray(row.activated_sites) ? row.activated_sites.slice() : [];
      var max = Number(row.max_sites || 1) || 1;
      if (origin && sites.indexOf(origin) < 0) {
        if (sites.length >= max) { done(tr(lang, "licFail") + "site-limit"); return; }
        sites.push(origin);
        licStore(function (v) {
          (v.rows || []).forEach(function (r) {
            if (String(r.license_key || "").toUpperCase() === k) { r.activated_sites = sites; r.status = "active"; }
          });
        });
      }
      accept({ ok: true, local: true, plugin_slug: slug, plan_type: row.plan_type,
               status: "active", max_sites: max, used_sites: sites.length, expires_at: row.expires_at || null }, true);
    }

    if (!sbCfg().url) { localCheck(); return; }
    sbRequest("/rest/v1/rpc/verify_plugin_license", {
      method: "POST", body: { p_slug: slug, p_key: k, p_site_origin: origin }
    }).then(function (res) {
      if (!res || res.ok !== true) { done(tr(lang, "licFail") + "verify"); return; }
      accept(res, false);
    }, function (e) {
      if (licRpcMissing(e)) { localCheck(); return; }
      var m = String((e && e.message) || "");
      done(tr(lang, "licFail") + m);
    });
  }

  /* ---------------- 라이선스 키 모달 ---------------- */
  var LICM = { el: null, inst: null, id: "", next: null, lastFocus: null };

  function ensureLicenseModal() {
    if (LICM.el && document.body.contains(LICM.el)) return LICM.el;
    var el = document.createElement("div");
    el.className = "mkt-modal mkt-license";
    el.id = "mkt-license";
    el.hidden = true;
    el.innerHTML =
      '<div class="mkt-modal-backdrop" data-mkt-licc-cancel="1"></div>' +
      '<div class="mkt-modal-card" role="dialog" aria-modal="true" aria-labelledby="mkt-license-title">' +
        '<header class="mkt-modal-head"><h2 id="mkt-license-title"></h2>' +
          '<button type="button" class="mkt-modal-x" data-mkt-licc-cancel="1" aria-label="">×</button></header>' +
        '<div class="mkt-modal-body">' +
          '<p class="mkt-consent-lead" id="mkt-license-lead"></p>' +
          '<label class="mkt-lic-field"><span id="mkt-license-lab"></span>' +
            '<input type="text" id="mkt-lic-key" class="admin-input" maxlength="24" spellcheck="false"' +
            ' autocomplete="off" placeholder="SBP-XXXX-XXXX-XXXX-XXXX" aria-label="SBP-XXXX-XXXX-XXXX-XXXX"></label>' +
          '<p class="mkt-note mkt-license-note" id="mkt-license-note"></p>' +
          '<p class="mkt-lic-msg" id="mkt-license-msg" role="status" aria-live="polite"></p>' +
        '</div>' +
        '<footer class="mkt-modal-foot">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-licc-cancel="1" id="mkt-license-cancel"></button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-mkt-licc-go="1" id="mkt-license-go"></button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-mkt-licc-cancel]")) { closeLicense(); return; }
      var go = e.target.closest ? e.target.closest("[data-mkt-licc-go]") : null;
      if (!go) return;
      var inst = LICM.inst, p = inst ? byId(inst, LICM.id) : null;
      if (!inst || !p) { closeLicense(); return; }
      var input = el.querySelector("#mkt-lic-key");
      var msg = el.querySelector("#mkt-license-msg");
      var key = input ? input.value : "";
      go.disabled = true;
      go.textContent = tr(inst.lang, "licChecking");
      licVerify(inst, p, key, function (err, info) {
        go.disabled = false;
        go.textContent = tr(inst.lang, "licVerify");
        if (err) { if (msg) { msg.textContent = err; msg.className = "mkt-lic-msg err"; } return; }
        if (msg) { msg.textContent = tr(inst.lang, "licOk", { plan: planLabel(inst, info.plan_type) }); msg.className = "mkt-lic-msg ok"; }
        var next = LICM.next;
        setTimeout(function () {
          closeLicense();
          if (typeof next === "function") { try { next(info); } catch (e2) { /* noop */ } }
        }, 420);
      });
    });
    el.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var t = e.target;
      if (!t || t.id !== "mkt-lic-key") return;
      e.preventDefault();
      var go = el.querySelector("[data-mkt-licc-go]");
      if (go) go.click();
    });
    document.addEventListener("keydown", function (e) {
      if (!LICM.el || LICM.el.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeLicense(); }
    });
    LICM.el = el;
    return el;
  }

  function openLicense(inst, p, next) {
    if (!p || inst.mode !== "admin") return;
    var el = ensureLicenseModal();
    var lang = inst.lang, d = disp(inst, p);
    LICM.inst = inst; LICM.id = p.id; LICM.next = next || null; LICM.lastFocus = document.activeElement;
    el.querySelector("#mkt-license-title").textContent = tr(lang, "licTitle");
    el.querySelector("#mkt-license-lead").textContent = tr(lang, "licLead", { name: d.name });
    el.querySelector("#mkt-license-lab").textContent = tr(lang, "licKeyLabel");
    el.querySelector("#mkt-license-note").textContent = tr(lang, "licNote") +
      " " + tr(lang, "planLabel") + ": " + planLabel(inst, p.plan_type) + " · " + priceLabelOf(inst, p);
    el.querySelector("#mkt-license-cancel").textContent = tr(lang, "licCancel");
    el.querySelector("#mkt-license-go").textContent = tr(lang, "licVerify");
    el.querySelector(".mkt-modal-x").setAttribute("aria-label", tr(lang, "close"));
    var msg = el.querySelector("#mkt-license-msg");
    msg.textContent = ""; msg.className = "mkt-lic-msg";
    var input = el.querySelector("#mkt-lic-key");
    input.value = (licenseStateOf(inst, p).key || "");
    input.placeholder = tr(lang, "licKeyPh");
    input.setAttribute("aria-label", tr(lang, "licKeyLabel"));
    el.hidden = false;
    document.documentElement.classList.add("mkt-modal-open");
    try { input.focus(); } catch (e) { /* noop */ }
  }

  function closeLicense() {
    if (!LICM.el) return;
    LICM.el.hidden = true;
    LICM.inst = null; LICM.id = ""; LICM.next = null;
    document.documentElement.classList.remove("mkt-modal-open");
    try { if (LICM.lastFocus && LICM.lastFocus.focus) LICM.lastFocus.focus(); } catch (e) { /* noop */ }
  }

  /* ---------------- 발급 · 폐기 ---------------- */
  function licIssueFields(inst) {
    var box = inst.tools && inst.tools.querySelector("#mkt-licenses");
    if (!box) return null;
    function val(id) { var n = box.querySelector("#" + id); return n ? String(n.value || "").trim() : ""; }
    var sites = parseInt(val("mkt-lic-sites"), 10);
    var exp = val("mkt-lic-expires");
    return {
      slug: val("mkt-lic-slug"), plan: val("mkt-lic-plan") || "pro",
      name: val("mkt-lic-name").slice(0, 80), email: val("mkt-lic-email").slice(0, 160),
      sites: isFinite(sites) ? Math.max(1, Math.min(500, sites)) : 1,
      expires: exp ? (exp.length === 10 ? exp + "T23:59:59Z" : exp) : null
    };
  }

  function licIssueLocal(f) {
    var rows = licLocal().rows || [];
    var key = licKeyRandom();
    var row = { id: "local-" + Date.now().toString(36), license_key: key, plugin_slug: f.slug,
      plan_type: f.plan, status: "active", holder_name: f.name || null, holder_email: f.email || null,
      max_sites: f.sites, activated_sites: [], expires_at: f.expires, created_at: new Date().toISOString(),
      local: true };
    rows.unshift(row);
    licStore(function (v) { v.rows = rows.slice(0, 200); });
    LIC.tableMissing = true;
    LIC.local = true;
    LIC.rows = rows.slice(0, 200);
    return row;
  }

  function issueLicense(inst, btn) {
    var lang = inst.lang;
    var f = licIssueFields(inst);
    if (!f) return;
    var msg = inst.tools && inst.tools.querySelector("#mkt-lic-msg");
    function say(text, kind) {
      LIC.msg = text; LIC.msgKind = kind || "";
      if (!msg) { paintTools(inst); return; }
      msg.textContent = text;
      msg.className = "mkt-lic-msg" + (kind ? " " + kind : "");
    }
    if (!f.slug) { say(tr(lang, "licNoPlugin"), "err"); return; }
    var old = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = tr(lang, "licIssuing"); }
    function after(err, row) {
      if (btn) { btn.disabled = false; btn.textContent = old || tr(lang, "licIssue"); }
      if (err) { say(tr(lang, "licIssueFail") + err, "err"); return; }
      say(tr(lang, "licIssued", { key: row.license_key }), "ok");
      paintTools(inst);
    }
    if (!sbCfg().url) { after(null, licIssueLocal(f)); return; }
    sbRequest("/rest/v1/rpc/issue_plugin_license", { method: "POST", body: {
      p_slug: f.slug, p_plan: f.plan, p_holder_name: f.name || null, p_holder_email: f.email || null,
      p_max_sites: f.sites, p_expires_at: f.expires
    } }).then(function (res) {
      if (!res || !res.license_key) { after("issue"); return; }
      LIC.loaded = false;
      var row = { id: res.id, license_key: res.license_key, plugin_slug: res.plugin_slug || f.slug,
        plan_type: res.plan_type || f.plan, status: res.status || "active", holder_name: f.name || null,
        holder_email: f.email || null, max_sites: Number(res.max_sites || f.sites),
        activated_sites: [], expires_at: res.expires_at || f.expires, created_at: new Date().toISOString() };
      LIC.rows = [row].concat(LIC.rows || []);
      licStore(function (v) { v.rows = (LIC.rows || []).slice(0, 200); });
      after(null, row);
    }, function (e) {
      if (licRpcMissing(e)) { after(null, licIssueLocal(f)); return; }
      after(String((e && e.message) || ""));
    });
  }

  function revokeLicense(inst, id, next, btn) {
    var lang = inst.lang;
    var rows = LIC.rows || [];
    var row = null;
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) row = rows[i];
    if (!row) return;
    var want = String(next || (String(row.status) === "revoked" ? "active" : "revoked"));
    function msg(text, kind) {
      LIC.msg = text; LIC.msgKind = kind || "";
      var box = inst.tools && inst.tools.querySelector("#mkt-lic-msg");
      if (box) { box.textContent = text; box.className = "mkt-lic-msg" + (kind ? " " + kind : ""); }
    }
    function apply() {
      row.status = want;
      licStore(function (v) {
        (v.rows || []).forEach(function (r) { if (String(r.id) === String(id)) r.status = want; });
      });
      msg(tr(lang, "licChanged", { key: row.license_key, status: licStatusText(inst, want) }), "ok");
      paintTools(inst);
    }
    if (!sbCfg().url || String(id).indexOf("local-") === 0) { apply(); return; }
    if (btn) btn.disabled = true;
    sbRequest("/rest/v1/rpc/revoke_plugin_license", { method: "POST", body: { p_id: id, p_status: want } })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res || res.ok !== true) { msg(tr(lang, "licChangeFail") + "revoke", "err"); return; }
        apply();
      }, function (e) {
        if (btn) btn.disabled = false;
        if (licRpcMissing(e)) { apply(); return; }
        msg(tr(lang, "licChangeFail") + String((e && e.message) || ""), "err");
      });
  }

  /* ---------------- 중앙 마켓 허브 ---------------- */
  function hubStats(inst) {
    var markets = (inst && inst.markets) || [];
    var plugins = (inst && inst.data && inst.data.plugins) || [];
    var themes = (cat("themes").items || []);
    var bundles = (cat("bundles").items || []);
    var pending = subList().filter(function (s) { return subStatus(s) === "pending"; }).length;
    var licenses = LIC.rows || [];
    var active = licenses.filter(function (r) { return String(r.status || "active") === "active"; }).length;
    return { markets: markets.length, plugins: plugins.length, themes: themes.length,
             bundles: bundles.length, pending: pending, licenses: licenses.length, active: active,
             paid: plugins.filter(isPaid).length };
  }

  function hubManifest(inst) {
    var st = hubStats(inst);
    var list = (inst && inst.data && inst.data.plugins) || [];
    return {
      kind: "sbpress-hub-manifest",
      v: 1,
      generatedAt: new Date().toISOString(),
      sbpress: (inst && inst.data && inst.data.sbpress) || "",
      site: (inst && inst.meta && inst.meta.name) || "",
      markets: ((inst && inst.markets) || []).map(function (m) {
        return { id: m.id, name: m.name, url: m.url, official: !!m.is_official, enabled: m.enabled !== false };
      }),
      plugins: list.map(function (p) {
        return { id: p.id, name: p.name, version: p.version, pricing: p.pricing,
                 plan_type: isPaid(p) ? p.plan_type : "", license_required: !!p.license_required,
                 category: p.category, integrity: p.integrity };
      }),
      themes: (cat("themes").items || []).map(function (t) { return t.slug; }),
      bundles: (cat("bundles").items || []).map(function (b) { return b.slug; }),
      licenses: { total: st.licenses, active: st.active },
      counts: { markets: st.markets, plugins: st.plugins, themes: st.themes, bundles: st.bundles,
                pending: st.pending, paid: st.paid }
    };
  }

  function hubManifestText(inst) { return JSON.stringify(hubManifest(inst), null, 2); }

  function licRowHtml(inst, r) {
    var lang = inst.lang;
    var status = String(r.status || "active");
    var sites = Array.isArray(r.activated_sites) ? r.activated_sites : [];
    var max = Number(r.max_sites || 1) || 1;
    var id = String(r.id || "");
    var next = status === "revoked" ? "active" : "revoked";
    var exp = r.expires_at ? String(r.expires_at).slice(0, 10) : tr(lang, "licNoExpire");
    return '<li class="mkt-lic-row" data-mkt-lic-id="' + esc(id) + '">' +
      '<div class="mkt-lic-main">' +
        '<code class="mkt-lic-key" id="mkt-lic-key-' + esc(id) + '">' + esc(r.license_key) + "</code>" +
        '<span class="mkt-lic-badges">' +
          '<span class="mkt-plan">' + esc(planLabel(inst, r.plan_type)) + "</span>" +
          '<span class="mkt-lic-status ' + esc(licStatusClass(status)) + '">' + esc(licStatusText(inst, status)) + "</span>" +
          (r.local ? '<span class="mkt-lic-local">' + esc(tr(lang, "licLocalOnly")) + "</span>" : "") +
        "</span>" +
        '<span class="mkt-lic-meta">' +
          '<span data-no-i18n>' + esc(String(r.plugin_slug || "")) +
            (r.holder_name ? " · " + esc(r.holder_name) : "") +
            (r.holder_email ? " · " + esc(r.holder_email) : "") + "</span>" +
          " · " + esc(tr(lang, "licUsed", { n: sites.length, m: max })) +
          " · " + esc(tr(lang, "licExpires")) + " " + esc(exp) + "</span>" +
      "</div>" +
      '<div class="mkt-lic-acts">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-mkt-lic-copy="' + esc(id) + '">' + esc(tr(lang, "licCopy")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm' + (next === "revoked" ? " danger" : "") + '"' +
          ' data-mkt-lic-toggle="' + esc(id) + '" data-mkt-lic-next="' + esc(next) + '">' +
          esc(tr(lang, next === "revoked" ? "licRevoke" : "licRestore")) + "</button>" +
      "</div></li>";
  }

  function licenseToolsHtml(inst) {
    var lang = inst.lang;
    var st = hubStats(inst);
    var plugins = (inst.data && inst.data.plugins) || [];
    var paid = plugins.filter(isPaid);
    var opts = (paid.length ? paid : plugins);
    var rows = LIC.rows || [];
    function card(key, label, n) {
      return '<div class="mkt-hub-card" data-mkt-hub="' + esc(key) + '"><b id="mkt-hub-' + esc(key) + '">' + esc(String(n)) +
        "</b><span>" + esc(label) + "</span></div>";
    }
    return '<section class="mkt-licenses" id="mkt-licenses" aria-labelledby="mkt-lic-title">' +
      '<div class="mkt-licenses-head"><div><h3 id="mkt-lic-title">' + esc(tr(lang, "hubTitle")) + "</h3>" +
        '<p class="mkt-licenses-note">' + esc(tr(lang, "hubNote")) + "</p></div>" +
        '<div class="mkt-licenses-acts">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-lic-refresh="1">' + esc(tr(lang, "licRefresh")) + "</button>" +
        "</div></div>" +
      '<div class="mkt-hub-cards">' +
        card("markets", tr(lang, "hubMarkets"), st.markets) +
        card("plugins", tr(lang, "hubPlugins"), st.plugins) +
        card("themes", tr(lang, "hubThemes"), st.themes) +
        card("bundles", tr(lang, "hubBundles"), st.bundles) +
        card("pending", tr(lang, "hubPending"), st.pending) +
        card("active", tr(lang, "hubActive"), st.active) +
      "</div>" +
      '<div class="mkt-hub-acts">' +
        '<button type="button" class="btn btn-primary btn-sm" data-mkt-hub-copy="1">' + esc(tr(lang, "hubCopy")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-mkt-hub-download="1">' + esc(tr(lang, "hubDownload")) + "</button>" +
        '<span class="muted mkt-hub-version">' + esc(tr(lang, "hubVersion")) + " " + esc((inst.data && inst.data.sbpress) || "") + "</span>" +
      "</div>" +
      '<p class="mkt-lic-msg' + (LIC.msgKind ? " " + esc(LIC.msgKind) : "") + '" id="mkt-lic-msg" role="status" aria-live="polite">' + esc(LIC.msg || "") + "</p>" +
      (LIC.tableMissing ? '<p class="mkt-note mkt-warn" id="mkt-lic-missing">' + esc(tr(lang, "licNeedSql")) + "</p>" : "") +
      '<div class="mkt-lic-grid">' +
        '<section class="mkt-lic-issue" id="mkt-lic-issue">' +
          '<h4>' + esc(tr(lang, "licIssueTitle")) + "</h4>" +
          '<p class="mkt-note">' + esc(tr(lang, "licIssueNote")) + "</p>" +
          '<label class="mkt-lic-f"><span>' + esc(tr(lang, "licSlug")) + '</span>' +
            '<select class="admin-input" id="mkt-lic-slug" aria-label="' + esc(tr(lang, "licSlug")) + '">' +
              (opts.length ? opts.map(function (p) {
                return '<option value="' + esc(p.id) + '">' + esc(disp(inst, p).name) + " (" + esc(p.id) + ")</option>";
              }).join("") : '<option value="">' + esc(tr(lang, "licNoPlugin")) + "</option>") +
            "</select></label>" +
          '<label class="mkt-lic-f"><span>' + esc(tr(lang, "licPlan")) + '</span>' +
            '<select class="admin-input" id="mkt-lic-plan" aria-label="' + esc(tr(lang, "licPlan")) + '">' +
              ["pro", "team", "enterprise", "free"].map(function (pl) {
                return '<option value="' + esc(pl) + '"' + (pl === "pro" ? " selected" : "") + ">" + esc(planLabel(inst, pl)) + "</option>";
              }).join("") + "</select></label>" +
          '<label class="mkt-lic-f"><span>' + esc(tr(lang, "licHolder")) + '</span>' +
            '<input class="admin-input" id="mkt-lic-name" maxlength="80" placeholder="' + esc(tr(lang, "licHolderPh")) + '" aria-label="' + esc(tr(lang, "licHolder")) + '"></label>' +
          '<label class="mkt-lic-f"><span>' + esc(tr(lang, "licEmail")) + '</span>' +
            '<input class="admin-input" id="mkt-lic-email" type="email" maxlength="160" spellcheck="false" aria-label="' + esc(tr(lang, "licEmail")) + '"></label>' +
          '<label class="mkt-lic-f"><span>' + esc(tr(lang, "licSites")) + '</span>' +
            '<input class="admin-input" id="mkt-lic-sites" type="number" min="1" max="500" step="1" value="1" aria-label="' + esc(tr(lang, "licSites")) + '"></label>' +
          '<label class="mkt-lic-f"><span>' + esc(tr(lang, "licExpiresLabel")) + '</span>' +
            '<input class="admin-input" id="mkt-lic-expires" type="date" aria-label="' + esc(tr(lang, "licExpiresLabel")) + '"></label>' +
          '<div class="mkt-lic-issue-act"><button type="button" class="btn btn-primary btn-sm" data-mkt-lic-issue="1">' + esc(tr(lang, "licIssue")) + "</button></div>" +
        "</section>" +
        '<section class="mkt-lic-list" id="mkt-lic-list">' +
          '<h4>' + esc(tr(lang, "licListTitle")) + "</h4>" +
          (LIC.loading ? '<p class="mkt-note">' + esc(tr(lang, "licLoading")) + "</p>" :
            (rows.length ? '<ul class="mkt-lic-rows">' + rows.map(function (r) { return licRowHtml(inst, r); }).join("") + "</ul>"
                         : '<p class="mkt-note mkt-lic-empty">' + esc(tr(lang, "licListEmpty")) + "</p>")) +
        "</section>" +
      "</div></section>";
  }

  /* ---------------- 라이선스 · 허브 화면 버튼 (한 번만 위임) ---------------- */
  function licRowById(id) {
    var rows = LIC.rows || [];
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
    return null;
  }

  function licDelegation(host) {
    if (!host || host.getAttribute("data-mkt-lic-bound")) return;
    host.setAttribute("data-mkt-lic-bound", "1");
    host.addEventListener("click", function (e) {
      var inst = host.__mktInst;
      if (!inst || !e.target.closest) return;
      var lang = inst.lang;
      var box = host.querySelector("#mkt-lic-msg");
      function say(text, kind) {
        LIC.msg = text; LIC.msgKind = kind || "";
        if (box) { box.textContent = text; box.className = "mkt-lic-msg" + (kind ? " " + kind : ""); }
      }
      var ref = e.target.closest("[data-mkt-lic-refresh]");
      if (ref) { loadLicenses(inst, true); return; }
      var cp = e.target.closest("[data-mkt-hub-copy]");
      if (cp) {
        copyText(hubManifestText(inst), function (ok) {
          say(tr(lang, ok ? "hubCopied" : "hubCopyFail"), ok ? "ok" : "err");
        });
        return;
      }
      var dl = e.target.closest("[data-mkt-hub-download]");
      if (dl) {
        downloadJson("hub-manifest.json", hubManifestText(inst));
        say(tr(lang, "hubDownloaded"), "ok");
        return;
      }
      var is = e.target.closest("[data-mkt-lic-issue]");
      if (is) { issueLicense(inst, is); return; }
      var cpy = e.target.closest("[data-mkt-lic-copy]");
      if (cpy) {
        var row = licRowById(cpy.getAttribute("data-mkt-lic-copy"));
        if (!row) return;
        copyText(String(row.license_key || ""), function (ok) {
          say(tr(lang, ok ? "licCopied" : "hubCopyFail"), ok ? "ok" : "err");
        });
        return;
      }
      var tg = e.target.closest("[data-mkt-lic-toggle]");
      if (tg) {
        revokeLicense(inst, tg.getAttribute("data-mkt-lic-toggle"),
          tg.getAttribute("data-mkt-lic-next") || "revoked", tg);
        return;
      }
    });
  }

  /* ---------------- 인스턴스 ---------------- */
  /* 마켓 화면 전용 CSS 는 이 화면에 들어갈 때 한 번만 받습니다(첫 화면 300KB 예산). */
  function ensureStyles() {
    if (document.getElementById("mkt-style")) return;
    var l = document.createElement("link");
    l.id = "mkt-style";
    l.rel = "stylesheet";
    l.href = "assets/market.css";
    document.head.appendChild(l);
  }

  function ensureToolsHost(root) {
    var host = root.previousElementSibling;
    if (host && host.getAttribute && host.getAttribute("data-mkt-tools") === "1") return host;
    host = document.createElement("div");
    host.className = "mkt-tools";
    host.setAttribute("data-mkt-tools", "1");
    if (root.parentNode) root.parentNode.insertBefore(host, root);
    return host;
  }

  function setBusy(inst, on) {
    if (!inst.tools) return;
    inst.tools.setAttribute("aria-busy", on ? "true" : "false");
  }

  /* ---------------- v10.4 — 구독 마켓 패널 ---------------- */
  function marketMsg(inst, text, kind) {
    inst.marketFlash = { text: text || "", kind: kind || "" };
    var box = inst.tools && inst.tools.querySelector("#mkt-market-msg");
    if (box) {
      box.textContent = text || "";
      box.className = "mkt-market-msg" + (kind ? " " + kind : "");
    }
  }

  function marketPanelHtml(inst) {
    var lang = inst.lang;
    var rows = inst.markets || [];
    if (!rows.length) return '<div class="mkt-markets" id="mkt-markets"><p class="mkt-market-empty">' + esc(tr(lang, "marketEmpty")) + "</p></div>";
    var items = rows.map(function (m) {
      var bits = [];
      if (m.plugin_count != null) bits.push(tr(lang, "marketCount", { n: m.plugin_count }));
      if (m.last_synced_at) bits.push(tr(lang, "marketSyncAt", { t: dateText(m.last_synced_at) }));
      else bits.push(tr(lang, "marketNever"));
      if (m.error) bits.push(tr(lang, "marketError") + m.error);
      var off = m.is_official ? " disabled" : "";
      return '<li class="mkt-market' + (m.enabled === false ? " is-off" : "") + (m.is_official ? " is-official" : "") + '" data-mkt-market-row="' + esc(m.id) + '">' +
        '<div class="mkt-market-main"><span class="mkt-market-name">' + esc(m.is_official ? tr(lang, "marketOfficialName") : m.name) +
          (m.is_official ? ' <span class="mkt-official">' + esc(tr(lang, "marketOfficial")) + "</span>" : "") +
          (m.enabled === false ? ' <span class="mkt-off">' + esc(tr(lang, "off")) + "</span>" : "") + "</span>" +
          '<code class="mkt-market-url">' + esc(m.url) + "</code>" +
          '<span class="mkt-market-meta">' + esc(bits.join(" · ")) + "</span></div>" +
        '<div class="mkt-market-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-market-toggle="' + esc(m.id) + '"' + off +
            (m.is_official ? ' title="' + esc(tr(lang, "marketCannotToggleOfficial")) + '"' : "") + ">" +
            esc(tr(lang, m.enabled === false ? "marketToggleOff" : "marketToggleOn")) + "</button>" +
          '<button type="button" class="btn btn-ghost btn-sm" data-mkt-market-sync="' + esc(m.id) + '">' + esc(tr(lang, "marketSync")) + "</button>" +
          '<button type="button" class="btn btn-ghost btn-sm danger" data-mkt-market-remove="' + esc(m.id) + '"' + off +
            (m.is_official ? ' title="' + esc(tr(lang, "marketCannotRemoveOfficial")) + '"' : "") + ">" +
            esc(tr(lang, "marketRemove")) + "</button>" +
        "</div></li>";
    }).join("");
    var fl = inst.marketFlash || {};
    return '<section class="mkt-markets" id="mkt-markets" aria-labelledby="mkt-markets-title">' +
      '<div class="mkt-markets-head"><h3 id="mkt-markets-title">' + esc(tr(lang, "marketPanel")) + "</h3>" +
        '<p class="mkt-markets-note">' + esc(tr(lang, "marketPanelNote")) + "</p></div>" +
      '<ul class="mkt-market-list">' + items + "</ul>" +
      '<div class="mkt-market-add">' +
        '<input class="admin-input mkt-market-name-input" id="mkt-market-name" maxlength="80" placeholder="' + esc(tr(lang, "marketAddName")) + '" aria-label="' + esc(tr(lang, "marketAddName")) + '">' +
        '<input class="admin-input mkt-market-url-input" id="mkt-market-url" maxlength="500" spellcheck="false" placeholder="' + esc(tr(lang, "marketAddUrl")) + '" aria-label="' + esc(tr(lang, "marketAddUrl")) + '">' +
        '<button type="button" class="btn btn-primary btn-sm" data-mkt-market-add="1">' + esc(tr(lang, "marketAdd")) + "</button>" +
      "</div>" +
      '<p class="mkt-market-msg' + (fl.kind ? " " + esc(fl.kind) : "") + '" id="mkt-market-msg" role="status" aria-live="polite">' + esc(fl.text || "") + "</p>" +
      "</section>";
  }

  function paintTools(inst) {
    var host = inst.tools;
    if (!host) return;
    var lang = inst.lang;
    var q = inst.state.q;
    /* v10.6 — 관리자 마켓을 열면 제출·심사 큐를 한 번 불러옵니다. */
    if (inst.mode === "admin" && !SUB.loaded && !SUB.loading) {
      setTimeout(function () { loadSubmissions(inst); }, 0);
    }
    /* v10.7 — 설치·평점 통계도 한 번 읽어 둡니다(없으면 이 브라우저 값). */
    if (!STATS.loaded && !STATS.loading) {
      setTimeout(function () { loadStats(inst); }, 0);
    }
    /* v10.10 — 「라이선스 · 허브」 탭은 허브 숫자를 위해 카탈로그·제출·라이선스를 한 번 읽습니다. */
    if (inst.mode === "admin" && inst.tab === "licenses") {
      setTimeout(function () {
        if (!cat("themes").loaded) loadCatalog("themes", inst, false);
        if (!cat("bundles").loaded) loadCatalog("bundles", inst, false);
        loadLicenses(inst, false);
      }, 0);
    }
    var pluginBody =
      (inst.mode === "admin" ? submissionPanelHtml(inst) : "") +
      (inst.mode === "admin" ? compatPanelHtml(inst) : "") +
      (inst.mode === "admin" && inst.markets ? marketPanelHtml(inst) : "") +
      (inst.mode === "admin" ? updBarHtml(inst) : "") +
      (inst.mode === "admin" ? "" :
        '<div class="mkt-subbar"><button type="button" class="btn btn-ghost btn-sm" data-mkt-sub-open="1">+ ' +
        esc(tr(lang, "subOpen")) + "</button></div>") +
      '<div class="mkt-bar">' +
        '<label class="mkt-search"><span class="sr-only">' + esc(tr(lang, "searchAria")) + "</span>" +
          '<input type="search" class="mkt-q" placeholder="' + esc(tr(lang, "search")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(tr(lang, "searchAria")) + '">' +
        "</label>" +
        '<label class="mkt-sortwrap"><span class="mkt-sortlabel">' + esc(tr(lang, "sort")) + "</span>" +
          '<select class="mkt-sort" aria-label="' + esc(tr(lang, "sortAria")) + '">' +
            '<option value="recommend">' + esc(tr(lang, "sortRecommend")) + "</option>" +
            '<option value="latest">' + esc(tr(lang, "sortLatest")) + "</option>" +
            '<option value="rating">' + esc(tr(lang, "sortRating")) + "</option>" +
            '<option value="installs">' + esc(tr(lang, "sortInstalls")) + "</option>" +
            '<option value="name">' + esc(tr(lang, "sortName")) + "</option>" +
          "</select></label>" +
      "</div>" +
      '<div class="mkt-chipset">' +
        ((facetValues(inst).markets.length > 1)
          ? '<div class="mkt-chips" data-group="market">' + chipRow(inst, "market", tr(lang, "fMarket"), facetValues(inst).markets, inst.state.market) + "</div>"
          : "") +
        /* v10.10 — 전체 / 무료 / 유료·라이선스 */
        '<div class="mkt-chips" data-group="price">' + priceChipsHtml(inst) + "</div>" +
        '<div class="mkt-chips" data-group="category">' + chipRow(inst, "category", tr(lang, "fCategory"), facetValues(inst).cats, inst.state.cat) + "</div>" +
        '<div class="mkt-chips" data-group="hook">' + chipRow(inst, "hook", tr(lang, "fHook"), facetValues(inst).hooks, inst.state.hook) + "</div>" +
        '<div class="mkt-chips" data-group="tag">' + chipRow(inst, "tag", tr(lang, "fTag"), facetValues(inst).tags, inst.state.tag) + "</div>" +
      "</div>" +
      '<p class="mkt-count" role="status" aria-live="polite"></p>' +
      '<p class="mkt-empty" hidden>' + esc(tr(lang, "empty")) + "</p>" +
      '<p class="mkt-flash' + (FLASH.kind ? " " + esc(FLASH.kind) : "") + '" id="mkt-flash" role="status" aria-live="polite">' +
        esc(FLASH.text) + "</p>";
    /* v10.8 — 서브탭(플러그인 · 테마 마켓 · 업종별 번들 팩) */
    var tab = inst.tab || "plugins";
    var body = tab === "themes" ? themeToolsHtml(inst)
      : tab === "bundles" ? bundleToolsHtml(inst)
      : tab === "licenses" ? licenseToolsHtml(inst)
      : tab === "studio" ? '<div class="studio-wrap" id="studio-host"></div>' : pluginBody;
    host.innerHTML = tabsHtml(inst) + body;
    if (tab === "studio") {
      /* v10.9 — studio.js·studio.css 는 이 탭에 처음 들어갈 때만 받아옵니다. */
      tabsDelegation(host);
      ensureStudio(inst);
      setBusy(inst, false);
      return;
    }
    if (tab === "licenses") {
      /* v10.10 — 라이선스 · 허브는 자체 위임으로 그립니다. */
      tabsDelegation(host);
      licDelegation(host);
      if (!LIC.loaded && !LIC.loading) loadLicenses(inst, false);
      setBusy(inst, false);
      return;
    }
    if (tab !== "plugins") {
      /* 테마·번들 탭은 카드만 그립니다(플러그인 검색·칩은 쓰지 않음). */
      if (typeof tabsDelegation === "function") tabsDelegation(host);
      setBusy(inst, false);
      return;
    }
    var all = host.querySelector("[data-mkt-updall]");
    if (all) all.addEventListener("click", function () { runUpdateAll(inst, all); });
    var input = host.querySelector(".mkt-q");
    if (input) {
      input.value = q;
      input.addEventListener("input", function () {
        inst.state.q = input.value;
        render(inst);
      });
    }
    var sel = host.querySelector(".mkt-sort");
    if (sel) {
      sel.value = inst.state.sort;
      sel.addEventListener("change", function () {
        inst.state.sort = sel.value || "recommend";
        render(inst);
      });
    }
    /* 필터 칩은 한 번만 위임해 둡니다(다시 그려도 리스너가 쌓이지 않게). */
    if (!host.getAttribute("data-mkt-chips-bound")) {
      host.setAttribute("data-mkt-chips-bound", "1");
      host.addEventListener("click", function (e) {
        var inst2 = host.__mktInst;
        if (!inst2) return;
        var chip = e.target.closest ? e.target.closest("[data-mkt-category],[data-mkt-hook],[data-mkt-tag],[data-mkt-market],[data-mkt-price]") : null;
        if (!chip) return;
        if (chip.hasAttribute("data-mkt-category")) inst2.state.cat = chip.getAttribute("data-mkt-category");
        else if (chip.hasAttribute("data-mkt-hook")) inst2.state.hook = chip.getAttribute("data-mkt-hook");
        else if (chip.hasAttribute("data-mkt-market")) inst2.state.market = chip.getAttribute("data-mkt-market");
        else if (chip.hasAttribute("data-mkt-price")) inst2.state.price = chip.getAttribute("data-mkt-price");
        else inst2.state.tag = chip.getAttribute("data-mkt-tag");
        paintTools(inst2);
        render(inst2);
      });
    }
    /* v10.6 — 제출·심사 큐 버튼도 한 번만 위임합니다(다시 그려도 리스너가 쌓이지 않게). */
    if (!host.getAttribute("data-mkt-sub-bound")) {
      host.setAttribute("data-mkt-sub-bound", "1");
      host.addEventListener("click", function (e) {
        var inst2 = host.__mktInst;
        if (!inst2 || !e.target.closest) return;
        var t = e.target.closest("[data-mkt-sub-open],[data-mkt-sub-filter],[data-mkt-sub-refresh]," +
          "[data-mkt-sub-approve],[data-mkt-sub-reject],[data-mkt-sub-reject-go]," +
          "[data-mkt-sub-install],[data-mkt-sub-copy],[data-mkt-sub-export]");
        if (!t) return;
        if (t.hasAttribute("data-mkt-sub-open")) { openSubmit(inst2); return; }
        if (t.hasAttribute("data-mkt-sub-refresh")) { loadSubmissions(inst2, true); return; }
        if (t.hasAttribute("data-mkt-sub-filter")) {
          SUB.filter = t.getAttribute("data-mkt-sub-filter") || "pending";
          SUB.reject = "";
          paintTools(inst2);
          return;
        }
        if (t.hasAttribute("data-mkt-sub-approve")) { approveSubmission(inst2, t.getAttribute("data-mkt-sub-approve"), t); return; }
        if (t.hasAttribute("data-mkt-sub-reject")) {
          SUB.reject = t.getAttribute("data-mkt-sub-reject");
          paintTools(inst2);
          var box = host.querySelector("#mkt-sub-note-" + SUB.reject);
          if (box) box.focus();
          return;
        }
        if (t.hasAttribute("data-mkt-sub-reject-go")) {
          var id = t.getAttribute("data-mkt-sub-reject-go");
          var noteEl = host.querySelector("#mkt-sub-note-" + id);
          var note = noteEl ? String(noteEl.value || "").trim() : "";
          if (!note) { subQueueMsg(inst2, tr(inst2.lang, "queueNeedNote"), "err"); return; }
          reviewSubmission(inst2, id, "rejected", note, t);
          return;
        }
        if (t.hasAttribute("data-mkt-sub-install")) { installSubmission(inst2, t.getAttribute("data-mkt-sub-install"), t); return; }
        var row = subById(t.getAttribute("data-mkt-sub-copy") || t.getAttribute("data-mkt-sub-export") || "");
        if (!row) return;
        if (t.hasAttribute("data-mkt-sub-copy")) {
          copyText(subJsonText(row), function (ok) {
            subQueueMsg(inst2, tr(inst2.lang, ok ? "queueCopied" : "queueCopiedFail"), ok ? "ok" : "err");
          });
          return;
        }
        downloadJson("plugin-" + String(row.slug || "plugin") + ".json", subJsonText(row));
        subQueueMsg(inst2, tr(inst2.lang, "queueCopied"), "ok");
      });
    }
    /* v10.7 — 「전체 호환성 재검사」 버튼도 한 번만 위임합니다. */
    if (!host.getAttribute("data-mkt-compat-bound")) {
      host.setAttribute("data-mkt-compat-bound", "1");
      host.addEventListener("click", function (e) {
        var inst2 = host.__mktInst;
        if (!inst2 || !e.target.closest) return;
        var t = e.target.closest("[data-mkt-compat-run]");
        if (!t) return;
        runCompatCheck(inst2, t);
      });
    }
    /* v10.4 — 구독 마켓 추가·켜기/끄기·동기화·삭제 버튼도 한 번만 위임합니다. */
    if (!host.getAttribute("data-mkt-markets-bound")) {
      host.setAttribute("data-mkt-markets-bound", "1");
      host.addEventListener("click", function (e) {
        var inst2 = host.__mktInst;
        if (!inst2 || !e.target.closest) return;
        var t = e.target.closest("[data-mkt-market-add],[data-mkt-market-toggle],[data-mkt-market-sync],[data-mkt-market-remove]");
        if (!t) return;
        if (t.hasAttribute("data-mkt-market-add")) {
          var nameEl = host.querySelector("#mkt-market-name");
          var urlEl = host.querySelector("#mkt-market-url");
          var name = (nameEl && nameEl.value || "").trim().slice(0, 80);
          var url = (urlEl && urlEl.value || "").trim().slice(0, 500);
          if (!url) { if (urlEl) urlEl.focus(); return; }
          if (!/^https:\/\//i.test(url) && url.charAt(0) !== "/") {
            marketMsg(inst2, tr(inst2.lang, "marketBadUrl"), "err");
            return;
          }
          if (typeof inst2.onMarketAdd === "function") {
            t.disabled = true;
            var old = t.textContent;
            t.textContent = tr(inst2.lang, "marketAddBusy");
            inst2.onMarketAdd(name, url, function (err, msg) {
              t.disabled = false;
              t.textContent = old;
              if (err) { marketMsg(inst2, err, "err"); return; }
              if (nameEl) nameEl.value = "";
              if (urlEl) urlEl.value = "";
              marketMsg(inst2, msg || tr(inst2.lang, "marketAdded", { name: name || url }), "ok");
            });
          }
          return;
        }
        var id = t.getAttribute("data-mkt-market-toggle") || t.getAttribute("data-mkt-market-sync") || t.getAttribute("data-mkt-market-remove");
        if (!id) return;
        if (t.hasAttribute("data-mkt-market-toggle")) {
          if (typeof inst2.onMarketToggle === "function") inst2.onMarketToggle(id, t);
          return;
        }
        if (t.hasAttribute("data-mkt-market-sync")) {
          if (typeof inst2.onMarketSync === "function") {
            var prev = t.textContent;
            t.disabled = true;
            t.textContent = tr(inst2.lang, "marketSyncBusy");
            inst2.onMarketSync(id, function (err, msg) {
              t.disabled = false;
              t.textContent = prev;
              if (err) marketMsg(inst2, err, "err");
              else if (msg) marketMsg(inst2, msg, "ok");
            });
          }
          return;
        }
        if (typeof inst2.onMarketRemove === "function") inst2.onMarketRemove(id, t);
      });
    }
    /* v10.8 — 서브탭 · 업종 칩 · 테마 미리보기/적용 · 번들 적용 버튼도 한 번만 위임합니다. */
    tabsDelegation(host);
  }

  /* v10.3 — 업데이트가 필요한 플러그인이 있으면 맨 위에 바를 그립니다(관리자 화면만). */
  function updBarHtml(inst) {
    var ids = updIds(inst);
    if (!ids.length) return "";
    var lang = inst.lang;
    return '<div class="mkt-updbar" id="mkt-updbar" role="status">' +
      '<span class="mkt-updbar-text"><b>' + esc(tr(lang, "updBar", { n: ids.length })) + "</b> " +
        '<span class="muted">' + esc(tr(lang, "updBarNote")) + "</span></span>" +
      '<button type="button" class="btn btn-primary btn-sm" data-mkt-updall="' + esc(ids.join(",")) + '">' +
        esc(tr(lang, "updAll")) + "</button>" +
      "</div>";
  }

  function paintHeader(inst, page) {
    if (!page) return;
    var lang = inst.lang;
    var e = page.querySelector("[data-mkt-head='eyebrow']");
    var t = page.querySelector("[data-mkt-head='title']");
    var l = page.querySelector("[data-mkt-head='lead']");
    if (e) e.textContent = tr(lang, "eyebrow");
    if (t) t.textContent = tr(lang, "title");
    if (l) l.textContent = tr(lang, "lead");
  }

  function render(inst) {
    var tab = inst.tab || "plugins";
    if (tab === "studio") { inst.root.innerHTML = ""; setBusy(inst, false); return; }
    if (tab === "licenses") { inst.root.innerHTML = ""; setBusy(inst, false); return; }
    if (tab === "themes") { renderThemes(inst); setBusy(inst, false); return; }
    if (tab === "bundles") { renderBundles(inst); setBusy(inst, false); return; }
    if (!inst.data) return;
    var list = (inst.data.plugins || []).filter(function (p) { return matches(inst, p, inst.state); });
    list = sortList(inst, list, inst.state.sort);
    inst.root.innerHTML = list.map(function (p) { return cardHtml(inst, p); }).join("");
    var count = inst.tools ? inst.tools.querySelector(".mkt-count") : null;
    if (count) {
      count.textContent = tr(inst.lang, "count", { m: list.length, n: (inst.data.plugins || []).length });
    }
    var empty = inst.tools ? inst.tools.querySelector(".mkt-empty") : null;
    if (empty) empty.hidden = list.length > 0;
    setBusy(inst, false);
    try { scheduleVerify(inst); } catch (e) { /* noop */ }
  }

  function needMessage(inst, text, retry) {
    if (!inst.tools) return;
    inst.tools.innerHTML = '<p class="mkt-note mkt-error">' + esc(text) +
      (retry ? ' <button type="button" class="rowlink mkt-retry">' + esc(tr(inst.lang, "retry")) + "</button>" : "") + "</p>";
    if (retry) {
      var b = inst.tools.querySelector(".mkt-retry");
      if (b) b.addEventListener("click", function () { load(inst); });
    }
    inst.root.innerHTML = "";
  }

  function load(inst) {
    if (typeof fetch !== "function") { needMessage(inst, tr(inst.lang, "failed") + " fetch 없음", false); return; }
    setBusy(inst, true);
    if (inst.tools) inst.tools.innerHTML = '<p class="mkt-note">' + esc(tr(inst.lang, "loading")) + "</p>";
    fetch(inst.url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        inst.data = normalize(data, inst.url);
        inst.meta = data;
        if (!inst.data.plugins.length) {
          needMessage(inst, tr(inst.lang, "emptyMarket"), false);
          return;
        }
        paintTools(inst);
        render(inst);
      })
      .catch(function (e) {
        needMessage(inst, tr(inst.lang, "failed") + (e && e.message ? e.message : ""), true);
      });
  }

  /* mount 에 넘어온 목록이 이미 normalize 를 거친 것인지 — 관리자 화면은 마켓을 합친 뒤 넘깁니다. */
  function dataFrom(opts, url) {
    var items = opts.items || [];
    var pre = items.length > 0 && (items[0].marketUrl !== undefined || items[0].marketId !== undefined);
    if (pre) {
      return { name: opts.name || "SBPress", sbpress: opts.sbpress || "", market: null,
               categories: (opts.categories || []).slice(), plugins: items.slice() };
    }
    return normalize({ name: opts.name || "SBPress", sbpress: opts.sbpress || "",
      categories: opts.categories || [], plugins: items }, url);
  }

  /* ---------------- v10.9 — 스튜디오 지연 로딩 ----------------
     studio.js · studio.css 는 첫 화면에도, 마켓 탭 진입에도 넣지 않습니다.
     관리자가 「스튜디오」 탭을 처음 열 때 이 함수가 한 번만 받아옵니다. */
  var STUDIO_PROMISE = null;

  function ensureStudioStyles() {
    if (document.getElementById("studio-style")) return;
    var l = document.createElement("link");
    l.id = "studio-style";
    l.rel = "stylesheet";
    l.href = "assets/studio.css";
    document.head.appendChild(l);
  }

  function mountStudio(inst) {
    if (!window.SBP_STUDIO || !inst || !inst.tools) return;
    var host = inst.tools.querySelector("#studio-host");
    if (!host) return;
    try {
      window.SBP_STUDIO.mount(host, {
        lang: inst.lang,
        onInstalled: function () {
          try { if (typeof inst.onRefresh === "function") inst.onRefresh(); } catch (e) { /* noop */ }
        }
      });
    } catch (e) {
      host.innerHTML = '<p class="mkt-note mkt-error">' + esc(String(e && e.message ? e.message : e)) + "</p>";
    }
  }

  function ensureStudio(inst) {
    ensureStudioStyles();
    if (window.SBP_STUDIO) { mountStudio(inst); return Promise.resolve(window.SBP_STUDIO); }
    if (!STUDIO_PROMISE) {
      STUDIO_PROMISE = new Promise(function (resolve) {
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          resolve(window.SBP_STUDIO || null);
        }
        try {
          if (window.SBP && window.SBP.loadScript) window.SBP.loadScript("assets/studio.js").then(finish, finish);
          else finish();
        } catch (e) { finish(); }
        setTimeout(finish, 8000);
      });
    }
    return STUDIO_PROMISE.then(function (S) {
      if (S) mountStudio(inst);
      else if (inst && inst.tools) {
        var host = inst.tools.querySelector("#studio-host");
        if (host) host.innerHTML = '<p class="mkt-note mkt-error">' +
          esc(tr(inst.lang, "studioLoadFailed")) + "</p>";
      }
      return S;
    });
  }

  function mount(opts) {
    opts = opts || {};
    var root = opts.root;
    if (!root) return null;
    ensureStyles();
    /* 같은 칸에 다시 mount 하면 앞서 만든 인스턴스를 그대로 씁니다(리스너·필터 상태 유지). */
    if (root.__sbpMarket) {
      var prev = root.__sbpMarket;
      prev.mode = opts.mode === "admin" ? "admin" : prev.mode;
      prev.url = opts.url || prev.url;
      prev.page = opts.page || prev.page;
      prev.installed = opts.installed || prev.installed;
      prev.onInstall = opts.onInstall || prev.onInstall;
      prev.onToggle = opts.onToggle || prev.onToggle;
      prev.onUpdate = opts.onUpdate || prev.onUpdate;
      prev.onUpdateAll = opts.onUpdateAll || prev.onUpdateAll;
      prev.onRollback = opts.onRollback || prev.onRollback;
      prev.onRefresh = opts.onRefresh || prev.onRefresh;
      prev.onRemove = opts.onRemove || prev.onRemove;
      prev.onSaveSettings = opts.onSaveSettings || prev.onSaveSettings;
      prev.onMarketAdd = opts.onMarketAdd || prev.onMarketAdd;
      prev.onMarketToggle = opts.onMarketToggle || prev.onMarketToggle;
      prev.onMarketSync = opts.onMarketSync || prev.onMarketSync;
      prev.onMarketRemove = opts.onMarketRemove || prev.onMarketRemove;
      prev.onRecheck = opts.onRecheck || prev.onRecheck;
      prev.onConsent = opts.onConsent || prev.onConsent;
      prev.onInstallSubmission = opts.onInstallSubmission || prev.onInstallSubmission;
      prev.onApplyTheme = opts.onApplyTheme || prev.onApplyTheme;
      prev.onApplyBundle = opts.onApplyBundle || prev.onApplyBundle;
      if (Array.isArray(opts.markets)) {
        prev.markets = opts.markets;
        prev.marketCount = opts.markets.length;
      }
      if (opts.tools) prev.tools = opts.tools;
      prev.tools.__mktInst = prev;
      if (opts.tab) prev.tab = opts.tab;
      if (opts.page) { prev.page = opts.page; paintHeader(prev, prev.page); }
      if (Array.isArray(opts.items)) {
        prev.data = dataFrom(opts, prev.url);
        if (!prev.data.plugins.length && !(prev.markets && prev.markets.length)) needMessage(prev, tr(prev.lang, "emptyMarket"), false);
        else { paintTools(prev); render(prev); }
      }
      return prev;
    }
    seq += 1;
    var inst = {
      id: opts.id || ("mkt" + seq),
      root: root,
      tools: opts.tools || ensureToolsHost(root),
      page: opts.page || null,
      mode: opts.mode === "admin" ? "admin" : "public",
      tab: "plugins",
      indT: "",
      indB: "",
      url: opts.url || "/plugins-market.json",
      lang: opts.lang || currentLang(),
      installed: opts.installed || null,
      onInstall: opts.onInstall || null,
      onToggle: opts.onToggle || null,
      onUpdate: opts.onUpdate || null,
      onUpdateAll: opts.onUpdateAll || null,
      onRollback: opts.onRollback || null,
      onRefresh: opts.onRefresh || null,
      onRemove: opts.onRemove || null,
      onSaveSettings: opts.onSaveSettings || null,
      onMarketAdd: opts.onMarketAdd || null,
      onMarketToggle: opts.onMarketToggle || null,
      onMarketSync: opts.onMarketSync || null,
      onMarketRemove: opts.onMarketRemove || null,
      onRecheck: opts.onRecheck || null,
      onConsent: opts.onConsent || null,
      onInstallSubmission: opts.onInstallSubmission || null,
      onApplyTheme: opts.onApplyTheme || null,
      onApplyBundle: opts.onApplyBundle || null,
      verify: {},
      verifyRun: 0,
      consented: {},
      markets: Array.isArray(opts.markets) ? opts.markets : null,
      marketCount: Array.isArray(opts.markets) ? opts.markets.length : 0,
      marketFlash: null,
      duplicates: Number(opts.duplicates || 0) || 0,
      data: null,
      meta: null,
      state: (root.__mktState && root.__mktState.url === (opts.url || "/plugins-market.json"))
        ? root.__mktState
        : { q: "", cat: "", hook: "", tag: "", market: "", price: "", sort: "recommend", url: opts.url || "/plugins-market.json" }
    };
    if (inst.state.market === undefined) inst.state.market = "";
    if (inst.state.price === undefined) inst.state.price = "";
    root.__mktState = inst.state;
    root.__sbpMarket = inst;
    root.classList.add("mkt-grid");
    if (inst.tools) inst.tools.__mktInst = inst;
    if (opts.page) paintHeader(inst, opts.page);
    INSTANCES.push(inst);
    if (Array.isArray(opts.items)) {
      inst.data = dataFrom(opts, inst.url);
      if (!inst.data.plugins.length && !(inst.markets && inst.markets.length)) needMessage(inst, tr(inst.lang, "emptyMarket"), false);
      else { paintTools(inst); render(inst); }
    } else {
      load(inst);
    }
    /* 카드 클릭 · 카드 안의 버튼 → 상세/설치 */
    if (!root.getAttribute("data-mkt-bound")) {
      root.setAttribute("data-mkt-bound", "1");
      root.addEventListener("click", function (e) {
        var inst2 = root.__sbpMarket;
        if (!inst2) return;
        var btn = e.target.closest ? e.target.closest("[data-mplug-install],[data-mplug-toggle],[data-mplug-update],[data-mplug-rollback],[data-mplug-remove],[data-mplug-settings]") : null;
        if (btn) {
          if (btn.hasAttribute("data-mplug-settings")) { openSettings(inst2, btn.getAttribute("data-mplug-settings")); return; }
          if (btn.hasAttribute("data-mplug-install")) runAction(inst2, "onInstall", btn.getAttribute("data-mplug-install"), btn, false);
          else if (btn.hasAttribute("data-mplug-toggle")) runAction(inst2, "onToggle", btn.getAttribute("data-mplug-toggle"), btn, false);
          else if (btn.hasAttribute("data-mplug-update")) runAction(inst2, "onUpdate", btn.getAttribute("data-mplug-update"), btn, false);
          else if (btn.hasAttribute("data-mplug-rollback")) openRollback(inst2, btn.getAttribute("data-mplug-rollback"));
          else runAction(inst2, "onRemove", btn.getAttribute("data-mplug-remove"), btn, false);
          return;
        }
        var opener = e.target.closest ? e.target.closest("[data-mkt-open]") : null;
        if (opener) { openDetail(inst2, opener.getAttribute("data-mkt-open")); return; }
        var rc = e.target.closest ? e.target.closest("[data-mkt-recheck]") : null;
        if (rc) { recheckIntegrity(inst2, rc.getAttribute("data-mkt-recheck"), rc); return; }
        var card = e.target.closest ? e.target.closest(".mkt-card") : null;
        if (card) openDetail(inst2, card.getAttribute("data-market-id"));
      });
      catalogDelegation(root);
      root.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var card = e.target.closest ? e.target.closest(".mkt-card") : null;
        if (!card || (e.target.closest && e.target.closest("button"))) return;
        e.preventDefault();
        openDetail(root.__sbpMarket, card.getAttribute("data-market-id"));
      });
    }
    return inst;
  }

  function update(inst) {
    if (!inst) return;
    inst.lang = currentLang();
    if (inst.page) paintHeader(inst, inst.page);
    if (inst.data) { paintTools(inst); render(inst); }
    else load(inst);
    if (MODAL.el && !MODAL.el.hidden && MODAL.inst === inst && MODAL.id) openDetail(inst, MODAL.id);
  }

  /* 언어가 바뀌면 열려 있는 마켓 화면을 다시 그립니다(관리자 KO/EN · 공개 KO/EN 공통). */
  document.addEventListener("craft:lang", function () {
    INSTANCES.slice().forEach(function (inst) {
      if (!inst.root || !document.body.contains(inst.root)) return;
      try { update(inst); } catch (e) { /* 한 화면이 실패해도 나머지는 그대로 */ }
    });
  });

  /* ---------------- 공개 화면 (#/market) ---------------- */
  var PUBLIC = { mounted: false };

  /* 화면 껍데기는 이 파일이 만듭니다(#/sign 과 같은 방식) — index.html 첫 로드를 가볍게. */
  function ensurePublicView() {
    var v = document.getElementById("view-market");
    if (v) return v;
    var main = document.getElementById("main");
    if (!main) return null;
    v = document.createElement("div");
    v.className = "view";
    v.id = "view-market";
    v.setAttribute("role", "tabpanel");
    v.hidden = true;
    v.innerHTML = '<section class="section"><div class="wrap" id="market-page"></div></section>';
    var mypage = document.getElementById("view-mypage");
    if (mypage && mypage.parentNode === main) main.insertBefore(v, mypage);
    else main.appendChild(v);
    return v;
  }

  function showPublic() {
    ensureStyles();
    var S = window.SBP || {};
    if (S.feature && !S.feature("plugins")) return;     // 이 사이트에서 플러그인을 쓰지 않으면 열지 않습니다
    var page = document.getElementById("market-page");
    if (!page) {
      var view = ensurePublicView();
      if (view) view.hidden = false;          // 방금 만든 화면은 라우터가 이미 지나갔으니 직접 엽니다
      page = view ? view.querySelector("#market-page") : null;
    }
    if (!page) return;
    var inst = page.querySelector("#mkt-public-grid");
    if (!inst) {
      page.innerHTML =
        '<p class="eyebrow" data-mkt-head="eyebrow"></p>' +
        '<h1 class="page-title" data-mkt-head="title"></h1>' +
        '<p class="mkt-lead" data-mkt-head="lead"></p>' +
        '<div class="mkt-tools" data-mkt-tools="1" id="mkt-public-tools"></div>' +
        '<div class="mkt-grid" id="mkt-public-grid"></div>';
      inst = page.querySelector("#mkt-public-grid");
      PUBLIC.mounted = true;
      mount({
        root: inst,
        tools: page.querySelector("#mkt-public-tools"),
        page: page,
        mode: "public",
        url: "/plugins-market.json"
      });
      return;
    }
    var existing = inst.__sbpMarket;
    if (existing) update(existing);
    else {
      mount({
        root: inst,
        tools: page.querySelector("#mkt-public-tools") || undefined,
        page: page,
        mode: "public",
        url: "/plugins-market.json"
      });
    }
  }

  window.SBP_MARKET = {
    __v: 110,
    version: "10.10.0",
    mount: mount,
    update: update,
    normalize: normalize,
    mergeMarkets: mergeMarkets,
    openDetail: openDetail,
    /* 화면 밖(시험·다른 스크립트)에서 아이디로 상세를 엽니다. */
    openDetailById: function (id) {
      var box = document.getElementById("plug-market");
      var inst = box && box.__sbpMarket;
      if (inst) openDetail(inst, id);
    },
    closeDetail: closeDetail,
    openSettings: function (id) {
      var box = document.getElementById("plug-market");
      var inst = box && box.__sbpMarket;
      if (inst) openSettings(inst, id);
    },
    openRollback: function (id) {
      var box = document.getElementById("plug-market");
      var inst = box && box.__sbpMarket;
      if (inst) openRollback(inst, id);
    },
    settingsOf: settingsOf,
    compareVersions: cmpVer,
    versionState: function (id) {
      var box = document.getElementById("plug-market");
      var inst = box && box.__sbpMarket;
      if (!inst) return null;
      var p = byId(inst, id);
      return p ? updInfo(inst, p) : null;
    },
    currentLang: currentLang,
    /* v10.4 — 구독 마켓 목록·합친 플러그인 목록을 새로 그립니다(관리자 화면). */
    refreshMarkets: function (markets, items, categories, duplicates) {
      var inst = adminInst();
      if (!inst) return false;
      if (Array.isArray(markets)) { inst.markets = markets; inst.marketCount = markets.length; }
      inst.duplicates = Number(duplicates || 0) || 0;
      if (Array.isArray(items)) {
        inst.data = dataFrom({ name: (inst.meta && inst.meta.name) || "SBPress",
          sbpress: (inst.meta && inst.meta.sbpress) || "",
          categories: categories || [], items: items }, inst.url);
      }
      paintTools(inst);
      render(inst);
      return true;
    },
    setMarketMessage: function (text, kind) {
      var inst = adminInst();
      if (!inst) return false;
      marketMsg(inst, text, kind);
      return true;
    },
    marketRows: function () {
      var inst = adminInst();
      return inst ? (inst.markets || []) : [];
    },
    /* v10.6 — 플러그인 제출 · 사전 점검 · 심사 큐(시험·다른 화면에서 쓰는 표면) */
    openSubmit: function () {
      var inst = adminInst() || INSTANCES[0];
      if (!inst) return false;
      openSubmit(inst);
      return true;
    },
    submissions: function () { return subList(); },
    reloadSubmissions: function () {
      var inst = adminInst();
      if (!inst) return false;
      loadSubmissions(inst, true);
      return true;
    },
    reviewSubmission: reviewSubmission,
    submissionApproved: function (id) {
      var s = subById(id);
      return s ? subStatus(s) === "approved" : false;
    },
    submissionJson: function (id) {
      var s = subById(id);
      return s ? subJsonText(s) : "";
    },
    autoCheck: autoCheck,
    sha256Integrity: function (text) {
      var bytes = new TextEncoder().encode(String(text || ""));
      return sriOf(bytes.buffer);
    },
    submissionsTableMissing: function () { return !!SUB.tableMissing; },
    /* v10.7 — 별점 · 리뷰 · 설치 통계 · 호환성(시험·다른 화면에서 쓰는 표면) */
    recordInstall: recordInstall,
    statsFor: function (id) {
      var inst = adminInst() || INSTANCES[0] || null;
      return statsOf(inst, { id: id });
    },
    compatFor: function (id) {
      var inst = adminInst() || INSTANCES[0] || null;
      var p = inst ? byId(inst, id) : null;
      return p ? compatOf(inst, p) : null;
    },
    compatRows: function () {
      var inst = adminInst();
      return inst ? compatRows(inst) : [];
    },
    runCompatCheck: function () {
      var inst = adminInst();
      if (!inst) return false;
      runCompatCheck(inst, inst.tools ? inst.tools.querySelector("[data-mkt-compat-run]") : null);
      return true;
    },
    reviews: function () { return (REV.items || []).slice(); },
    reloadReviews: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      var p = inst ? byId(inst, REV.slug) : null;
      if (!inst || !p) return false;
      loadReviews(inst, p, true);
      return true;
    },
    statsTableMissing: function () { return !!STATS.tableMissing; },
    reviewsTableMissing: function () { return !!REV.tableMissing; },
    /* v10.8 — 테마 마켓 · 업종별 번들 팩(시험·다른 화면에서 쓰는 표면) */
    themes: function () { return (cat("themes").items || []).slice(); },
    bundles: function () { return (cat("bundles").items || []).slice(); },
    themeBySlug: themeBySlug,
    bundleBySlug: bundleBySlug,
    themeTokens: themeTokens,
    loadCatalog: function (kind) {
      var inst = adminInst() || INSTANCES[0] || null;
      loadCatalog(kind === "bundles" ? "bundles" : "themes", inst, true);
      return true;
    },
    showTab: function (tab) {
      var inst = adminInst() || INSTANCES[0] || null;
      if (!inst) return false;
      inst.tab = (tab === "themes" || tab === "bundles" ||
                  ((tab === "studio" || tab === "licenses") && inst.mode === "admin")) ? tab : "plugins";
      if (inst.tab === "themes" || inst.tab === "bundles") loadCatalog(inst.tab, inst, false);
      paintTools(inst);
      render(inst);
      return true;
    },
    currentTab: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      return inst ? (inst.tab || "plugins") : "";
    },
    previewTheme: function (slug) {
      var inst = adminInst() || INSTANCES[0] || null;
      if (!inst) return false;
      startPreview(inst, slug);
      return PREVIEW.slug === slug;
    },
    stopPreview: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      if (!inst) return false;
      stopPreview(inst);
      return true;
    },
    previewing: function () { return PREVIEW.slug; },
    openBundle: function (slug) {
      var inst = adminInst() || INSTANCES[0] || null;
      if (!inst) return false;
      openBundle(inst, slug);
      return true;
    },
    closeBundle: closeBundle,
    bundlePluginRows: function (slug) {
      var inst = adminInst() || INSTANCES[0] || null;
      var b = bundleBySlug(slug);
      return (inst && b) ? bundlePluginRows(inst, b) : [];
    },
    catalogTableMissing: function (kind) { return !!cat(kind).tableMissing; },
    appliedTheme: function () {
      var raw = (window.CRAFT_CMS && window.CRAFT_CMS.contents) ? window.CRAFT_CMS.contents()["theme.tokens"] : null;
      return raw ? String(raw.value || "") : "";
    },
    /* v10.10 — 유료 · 라이선스 · 중앙 마켓 허브(시험·다른 화면에서 쓰는 표면) */
    licenses: function () { return (LIC.rows || []).slice(); },
    licensesLocal: licLocal,
    licensesTableMissing: function () { return !!LIC.tableMissing; },
    reloadLicenses: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      if (!inst) return false;
      loadLicenses(inst, true);
      return true;
    },
    licenseState: function (id) {
      var inst = adminInst() || INSTANCES[0] || null;
      var p = inst ? byId(inst, id) : null;
      return p ? licenseStateOf(inst, p) : null;
    },
    openLicense: function (id) {
      var inst = adminInst() || INSTANCES[0] || null;
      var p = inst ? byId(inst, id) : null;
      if (!p) return false;
      openLicense(inst, p, null);
      return true;
    },
    verifyLicense: function (id, key) {
      var inst = adminInst() || INSTANCES[0] || null;
      var p = inst ? byId(inst, id) : null;
      if (!p) return Promise.reject(new Error("no-plugin"));
      return new Promise(function (resolve, reject) {
        licVerify(inst, p, key, function (err, info) {
          if (err) reject(new Error(err)); else resolve(info);
        });
      });
    },
    hubManifest: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      return inst ? hubManifest(inst) : null;
    },
    hubJson: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      return inst ? hubManifestText(inst) : "";
    },
    hubStats: function () {
      var inst = adminInst() || INSTANCES[0] || null;
      return inst ? hubStats(inst) : null;
    }
  };

  function adminInst() {
    var box = document.getElementById("plug-market");
    return (box && box.__sbpMarket) || null;
  }

  window.CRAFT_MARKET = {
    show: showPublic,
    open: function (id) {
      var grid = document.getElementById("mkt-public-grid");
      if (grid && grid.__sbpMarket) openDetail(grid.__sbpMarket, id);
    }
  };
})();
