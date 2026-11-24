/* ===== SBPress v10.5 · 플러그인 마켓 탐색기 (assets/market.js) =====
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

   이 파일은 첫 화면에 넣지 않습니다. 공개 사이트는 #/market 에 들어갈 때(app.js 의
   LAZY_ROUTES), 관리자 화면은 플러그인 탭을 처음 열 때 admin.js 가 SBP.loadScript 로
   받아옵니다 — 300KB 첫 화면 예산을 지키기 위해서입니다.

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
      sandboxMode: "샌드박스 모드"
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
      sandboxMode: "Sandbox mode"
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
    "read:block-data": { ko: "관리자가 입력한 블록 값을 읽습니다.", en: "Reads the block values the admin entered." }
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
        sandbox_mode: (String(item.sandbox_mode || "") === "standard") ? "standard" : "strict"
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
    if (mode === "latest") {
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
      "<h3>" + esc(d.name) + " " + badge + (upd ? " " + upd : "") + " " + src + (sri ? " " + sri : "") + "</h3>" +
      '<p class="plug-desc">' + esc(d.desc) + "</p>" +
      '<div class="plug-meta mkt-meta">' +
        '<span class="plug-tag ver">v' + esc(p.version) + "</span>" +
        (d.author ? '<span class="mkt-author">' + esc(d.author) + "</span>" : "") +
        (d.category ? '<span class="plug-tag cat">' + esc(d.category) + "</span>" : "") +
        tags + (grant ? " " + grant : "") +
      "</div>" +
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
        (p.updated ? "<div><dt>" + esc(tr(lang, "updated")) + "</dt><dd>" + esc(p.updated) + "</dd></div>" : "") +
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
      trustSec +
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
    try { fn(id, btn, after, consent); } catch (e) { after(e && e.message ? e.message : String(e)); }
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
  var CNS = { el: null, inst: null, id: "", mode: "install", perms: [], next: null, lastFocus: null };

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
      var inst = CNS.inst, next = CNS.next, p = CNS.inst && byId(CNS.inst, CNS.id);
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
    CNS.inst = null; CNS.id = ""; CNS.next = null; CNS.perms = [];
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
    host.innerHTML =
      (inst.mode === "admin" && inst.markets ? marketPanelHtml(inst) : "") +
      (inst.mode === "admin" ? updBarHtml(inst) : "") +
      '<div class="mkt-bar">' +
        '<label class="mkt-search"><span class="sr-only">' + esc(tr(lang, "searchAria")) + "</span>" +
          '<input type="search" class="mkt-q" placeholder="' + esc(tr(lang, "search")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(tr(lang, "searchAria")) + '">' +
        "</label>" +
        '<label class="mkt-sortwrap"><span class="mkt-sortlabel">' + esc(tr(lang, "sort")) + "</span>" +
          '<select class="mkt-sort" aria-label="' + esc(tr(lang, "sortAria")) + '">' +
            '<option value="recommend">' + esc(tr(lang, "sortRecommend")) + "</option>" +
            '<option value="latest">' + esc(tr(lang, "sortLatest")) + "</option>" +
            '<option value="name">' + esc(tr(lang, "sortName")) + "</option>" +
          "</select></label>" +
      "</div>" +
      '<div class="mkt-chipset">' +
        ((facetValues(inst).markets.length > 1)
          ? '<div class="mkt-chips" data-group="market">' + chipRow(inst, "market", tr(lang, "fMarket"), facetValues(inst).markets, inst.state.market) + "</div>"
          : "") +
        '<div class="mkt-chips" data-group="category">' + chipRow(inst, "category", tr(lang, "fCategory"), facetValues(inst).cats, inst.state.cat) + "</div>" +
        '<div class="mkt-chips" data-group="hook">' + chipRow(inst, "hook", tr(lang, "fHook"), facetValues(inst).hooks, inst.state.hook) + "</div>" +
        '<div class="mkt-chips" data-group="tag">' + chipRow(inst, "tag", tr(lang, "fTag"), facetValues(inst).tags, inst.state.tag) + "</div>" +
      "</div>" +
      '<p class="mkt-count" role="status" aria-live="polite"></p>' +
      '<p class="mkt-empty" hidden>' + esc(tr(lang, "empty")) + "</p>" +
      '<p class="mkt-flash' + (FLASH.kind ? " " + esc(FLASH.kind) : "") + '" id="mkt-flash" role="status" aria-live="polite">' +
        esc(FLASH.text) + "</p>";
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
        var chip = e.target.closest ? e.target.closest("[data-mkt-category],[data-mkt-hook],[data-mkt-tag],[data-mkt-market]") : null;
        if (!chip) return;
        if (chip.hasAttribute("data-mkt-category")) inst2.state.cat = chip.getAttribute("data-mkt-category");
        else if (chip.hasAttribute("data-mkt-hook")) inst2.state.hook = chip.getAttribute("data-mkt-hook");
        else if (chip.hasAttribute("data-mkt-market")) inst2.state.market = chip.getAttribute("data-mkt-market");
        else inst2.state.tag = chip.getAttribute("data-mkt-tag");
        paintTools(inst2);
        render(inst2);
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
      if (Array.isArray(opts.markets)) {
        prev.markets = opts.markets;
        prev.marketCount = opts.markets.length;
      }
      if (opts.tools) prev.tools = opts.tools;
      prev.tools.__mktInst = prev;
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
        : { q: "", cat: "", hook: "", tag: "", market: "", sort: "recommend", url: opts.url || "/plugins-market.json" }
    };
    if (inst.state.market === undefined) inst.state.market = "";
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
    __v: 104,
    version: "10.4.0",
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
