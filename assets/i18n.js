/* ===== 전국공방 · 한국어 / English (assets/i18n.js) =====
   - 헤더의 KO | EN 스위치로 바뀝니다. 선택은 localStorage('craft-lang')에 남습니다.
   - 화면 문구는 [data-i18n] / [data-i18n-html] / [data-i18n-ph] / [data-i18n-aria] 로 표시합니다.
   - 메뉴 이름은 site_contents.Header 메뉴의 label_ko · label_en 을 씁니다(app.js).
   다른 스크립트는 window.CRAFT_I18N.t('key') 로 문구를 가져오고,
   새로 만든 화면은 CRAFT_I18N.apply(요소) 를 불러 주세요.
*/
(function () {
  "use strict";

  var KEY = "craft-lang";
  var SUPPORTED = ["ko", "en"];
  var SC = window.SBPRESS_CONFIG || {};
  function defaultLang() {
    var v = String(SC.defaultLang || "ko").toLowerCase();
    return SUPPORTED.indexOf(v) >= 0 ? v : "ko";
  }

  function readLang() {
    try {
      var v = String(localStorage.getItem(KEY) || "").toLowerCase();
      return SUPPORTED.indexOf(v) >= 0 ? v : defaultLang();
    } catch (e) { return defaultLang(); }
  }

  var lang = readLang();

  /* ---------- 사전 ---------- */
  var DICT = {
    ko: {
      "lang.ko": "KO", "lang.en": "EN", "lang.label": "메뉴 언어",
      "nav.tasks": "업무 관리",
      "cta.register": "공방 등록",
      "cta.register.full": "공방 등록 신청",

      "search.open": "검색",
      "search.open.aria": "통합 검색 열기",
      "search.label": "검색어",
      "search.eyebrow": "통합 검색",
      "search.title": "무엇을 찾으세요?",
      "search.ph": "글 제목·요약·본문·태그, 페이지 제목으로 찾기",
      "search.submit": "검색",
      "search.scope.all": "전체",
      "search.scope.post": "글",
      "search.scope.page": "페이지",
      "search.hint": "제목·요약·본문·태그·게시판 이름에서 한 번에 찾습니다. 낱말을 띄어 쓰면 모두 들어간 글만 보여 줍니다.",
      "share.copy": "링크 복사",
      "share.share": "공유하기",

      "post.views.title": "조회수",
      "post.en.fallback": "영문 없음",
      "post.en.fallback.title": "이 글에는 아직 영문 본문이 없어 한국어로 보입니다.",
      "post.read": "글 보기",
      "post.source": "원문",
      "post.interview": "인터뷰 읽기",
      "post.read.body": "본문 보기 →",
      "post.detail": "자세히",
      "page.eyebrow": "페이지",
      "hm.popular.eyebrow": "인기글",
      "hm.popular.title": "인기글",
      "hm.popular.all": "전체 글",
      "hm.popular.empty": "아직 조회수가 쌓인 글이 없습니다.",
      "hm.popular.note": "아직 조회수가 쌓이지 않아 최신 글 순서로 보여 줍니다.",

      "search.workshops": "공방 이름, 지역, 분야, 소개로 검색",
      "search.archive": "제목, 요약, 매체, 지역으로 검색",
      "search.tasks": "제목·담당·설명으로 검색",

      "pager.prev": "이전",
      "pager.next": "다음",
      "pager.page": "{n}페이지",
      "pager.range": "건 중 ",
      "pager.of": "건",

      "filter.all": "전체",
      "filter.allIssues": "전체 호",
      "filter.allCorners": "전체 코너",

      "board.count": "곳",
      "board.total": "전체",
      "board.empty": "조건에 맞는 공방이 없습니다. 검색어나 필터를 바꿔 보세요.",
      "boards.empty": "아직 이 게시판에 글이 없습니다.",

      "cmt.btn": "댓글",
      "cmt.title": "댓글",
      "cmt.open.aria": "댓글 보기",
      "cmt.n.aria": "댓글 {n}개 보기",
      "cmt.input.ph": "서로에게 도움이 되는 말을 남겨 주세요. (최대 1000자)",
      "cmt.submit": "댓글 등록",
      "cmt.sending": "등록하는 중…",
      "cmt.posted": "댓글을 남겼습니다.",
      "cmt.as": "{name} 님으로 남깁니다",
      "cmt.guest.head": "비회원으로 남기기",
      "cmt.guest.hint": "그림에 보이는 글자를 함께 적어 주세요.",
      "cmt.guest.name": "닉네임 (1~60자)",
      "cmt.guest.captcha": "그림에 보이는 글자 5자",
      "cmt.guest.refresh": "다른 글자",
      "cmt.guest.captcha.loading": "보안 문자를 불러오는 중…",
      "cmt.login.need": "댓글을 쓰려면 로그인이 필요합니다. {site} 회원은 누구나 남길 수 있어요.",
      "cmt.login.btn": "로그인하고 댓글 쓰기",
      "cmt.off": "이 게시판은 댓글이 비활성화되어 있습니다.",
      "cmt.empty.title": "아직 댓글이 없습니다.",
      "cmt.empty.desc": "첫 번째 이야기를 남겨 보세요.",
      "cmt.loading": "댓글을 불러오는 중…",
      "cmt.load.fail": "댓글을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.",
      "cmt.delete": "삭제",
      "cmt.reply": "답글",
      "cmt.me": "나",
      "cmt.guest.badge": "비회원",
      "cmt.confirm.del": "이 댓글을 삭제할까요? 삭제하면 되돌릴 수 없습니다.",

      "auth.eyebrow": "{tagline} 회원",
      "auth.signin.title": "로그인",
      "auth.signup.title": "회원가입",
      "auth.reset.title": "새 비밀번호 설정",
      "auth.signin.sub": "관심 공방을 찜해 두고, 다음에 다시 찾아보세요.",
      "auth.signup.sub": "이메일만 있으면 됩니다. 가입 후 바로 관심 공방을 찜할 수 있어요.",
      "auth.reset.sub": "새로 사용할 비밀번호를 입력해 주세요.",
      "auth.google": "구글로 계속하기",
      "auth.kakao": "카카오로 계속하기",
      "auth.naver": "네이버로 계속하기",
      "auth.or": "또는 이메일로",
      "auth.email": "이메일",
      "auth.nickname": "닉네임",
      "auth.optional": "(선택)",
      "auth.nick.ph": "게시판에 표시할 이름",
      "auth.password": "비밀번호",
      "auth.newPassword": "새 비밀번호",
      "auth.pass.ph": "6자 이상",
      "auth.submit.signin": "로그인",
      "auth.submit.signup": "회원가입",
      "auth.submit.reset": "비밀번호 변경",
      "auth.toggle.signin": "처음이신가요? <b>회원가입</b>",
      "auth.toggle.signup": "이미 회원이신가요? <b>로그인</b>",
      "auth.forgot": "비밀번호를 잊으셨나요?",
      "auth.terms": "가입하면 {site}의 이용 안내에 동의하는 것으로 봅니다. 이메일은 로그인과 공지 전달에만 씁니다.",
      "auth.menu.bookmarks": "관심 공방",
      "auth.menu.mypage": "마이페이지",
      "auth.menu.board": "공방 게시판",
      "auth.menu.tasks": "업무 관리",
      "auth.menu.signout": "로그아웃",
      "auth.login.btn": "로그인",
      "auth.login.aria": "로그인 또는 회원가입",
      "auth.processing": "처리 중…",

      "tasks.eyebrow": "업무 관리 · Tasks",
      "tasks.title": "로그인한 회원의 업무 보드",
      "tasks.desc": "할 일을 적고 상태를 옮기며 함께 봅니다. 로그인한 회원이면 누구나 쓰고, 관리자는 전체를 관리합니다.",
      "tasks.gate.title": "로그인 후 이용할 수 있는 업무 관리입니다",
      "tasks.gate.desc": "로그인하면 업무 보드가 열립니다. 회원이 아니어도 이메일만 있으면 바로 가입할 수 있습니다.",
      "tasks.gate.btn": "로그인",
      "tasks.grade.title": "업무 관리는 {grade} 이상만 이용할 수 있습니다",
      "tasks.grade.desc": "지금 등급은 {mine}입니다. 등급은 운영자가 관리자 화면에서 바꿀 수 있습니다.",
      "tasks.loading": "업무를 불러오는 중…",
      "tasks.load.fail": "업무를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.",
      "tasks.add": "새 업무",
      "tasks.edit": "수정",
      "tasks.delete": "삭제",
      "tasks.save": "저장",
      "tasks.cancel": "취소",
      "tasks.form.new": "새 업무",
      "tasks.form.edit": "업무 수정",
      "tasks.field.title": "제목 *",
      "tasks.field.desc": "설명",
      "tasks.field.status": "상태",
      "tasks.field.priority": "우선순위",
      "tasks.field.due": "마감일",
      "tasks.field.assignee": "담당",
      "tasks.ph.title": "무엇을 할지 한 줄로 적어 주세요",
      "tasks.ph.desc": "메모·참고 링크·확인할 내용 (선택)",
      "tasks.ph.assignee": "담당자 이름 (선택)",
      "tasks.status.todo": "할 일",
      "tasks.status.doing": "진행 중",
      "tasks.status.done": "완료",
      "tasks.priority.low": "낮음",
      "tasks.priority.normal": "보통",
      "tasks.priority.high": "높음",
      "tasks.col.todo": "할 일",
      "tasks.col.doing": "진행 중",
      "tasks.col.done": "완료",
      "tasks.empty.col": "이 칸에는 아직 업무가 없습니다.",
      "tasks.empty.all": "아직 등록된 업무가 없습니다. ‘새 업무’로 시작해 보세요.",
      "tasks.count": "{n}건",
      "tasks.total": "전체 {n}건",
      "tasks.due.none": "마감 없음",
      "tasks.due.today": "오늘 마감",
      "tasks.due.over": "{n}일 지남",
      "tasks.due.left": "D-{n}",
      "tasks.by": "작성",
      "tasks.confirm.del": "이 업무를 삭제할까요? 되돌릴 수 없습니다.",
      "tasks.saved": "저장했습니다.",
      "tasks.deleted": "삭제했습니다.",
      "tasks.fail": "저장하지 못했습니다: ",
      "tasks.login.needed": "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
      "tasks.move": "상태 바꾸기",
      "tasks.list.view": "목록",
      "tasks.filter.status": "상태",
      "tasks.selectGrade": "등급",

      "nav.approvals": "전자결재",
      "appr.eyebrow": "전자결재 · Approvals",
      "appr.title": "기안하고 결재합니다",
      "appr.desc": "양식을 골라 기안을 올리고, 1차·최종 결재자가 승인하거나 반려합니다. 결재선과 이력이 문서에 그대로 남습니다.",
      "appr.gate.title": "로그인 후 이용할 수 있는 전자결재입니다",
      "appr.gate.desc": "로그인하면 내 결재함이 열립니다. 회원이 아니어도 이메일만 있으면 바로 가입할 수 있습니다.",
      "appr.gate.btn": "로그인",
      "appr.new": "새 기안",
      "appr.q": "문서번호·제목·기안자로 찾기",
      "appr.loading": "결재함을 불러오는 중…",
      "appr.load.fail": "결재함을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요. ",
      "appr.msg.login": "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
      "appr.msg.fail": "처리하지 못했습니다: ",
      "appr.msg.notAllowed": "권한이 없습니다: ",
      "appr.msg.drafted": "임시저장했습니다. ‘내가 올린 기안’에서 상신할 수 있습니다.",
      "appr.msg.submitted": "결재를 올렸습니다. 1차 결재자에게 차례가 넘어갔습니다.",
      "appr.msg.approved": "승인했습니다.",
      "appr.msg.rejected": "반려했습니다. 기안자에게 사유가 전달됩니다.",
      "appr.msg.withdrawn": "기안을 회수했습니다.",
      "appr.notice.missing.title": "전자결재 표가 아직 만들어지지 않았습니다",
      "appr.notice.missing.desc": "Supabase SQL Editor 에서 아래 파일을 한 번 실행하면 결재함이 켜집니다(여러 번 실행해도 안전).",
      "appr.tab.inbox": "결재 대기",
      "appr.tab.mine": "내가 올린 기안",
      "appr.tab.done": "완료 · 반려함",
      "appr.tab.all": "전체(관리자)",
      "appr.empty.inbox": "지금 내가 결재할 기안이 없습니다.",
      "appr.empty.mine": "아직 올린 기안이 없습니다. ‘새 기안’으로 시작해 보세요.",
      "appr.empty.done": "완료·반려된 기안이 없습니다.",
      "appr.empty.all": "아직 결재 문서가 없습니다.",
      "appr.empty.missing": "결재 표가 없어 목록을 그릴 수 없습니다. 위 안내의 SQL 을 실행해 주세요.",
      "appr.total": "{n}건",
      "appr.by": "기안",
      "appr.waitFor": "{step} 대기",
      "appr.progress": "{done}/{total} 승인",
      "appr.turn.mine": "내 차례",
      "appr.step.n": "{n}차",
      "appr.badge.draft": "임시저장",
      "appr.badge.pending": "결재 중",
      "appr.badge.approved": "승인 완료",
      "appr.badge.rejected": "반려",
      "appr.badge.canceled": "회수",
      "appr.stepState.waiting": "대기 전",
      "appr.stepState.pending": "결재 대기",
      "appr.stepState.approved": "승인",
      "appr.stepState.rejected": "반려",
      "appr.meta.drafter": "기안자",
      "appr.meta.created": "작성일",
      "appr.meta.submitted": "상신일",
      "appr.meta.draft": "아직 상신 전",
      "appr.meta.status": "상태",
      "appr.meta.current": "현재 단계",
      "appr.meta.attach": "첨부 링크",
      "appr.detail.body": "본문",
      "appr.detail.line": "결재선",
      "appr.detail.logs": "이력",
      "appr.detail.noBody": "본문이 없습니다.",
      "appr.detail.noSteps": "결재선이 없습니다.",
      "appr.detail.noLogs": "아직 이력이 없습니다.",
      "appr.approve": "승인",
      "appr.reject": "반려",
      "appr.reject.ask": "반려 사유 (필수)",
      "appr.reject.ph": "무엇을 고쳐야 하는지 적어 주세요",
      "appr.reject.send": "반려하고 알리기",
      "appr.reject.need": "반려 사유를 적어 주세요.",
      "appr.withdraw": "회수",
      "appr.submit": "상신",
      "appr.close": "닫기",
      "appr.cancel": "취소",
      "appr.confirm.withdraw": "이 기안을 회수할까요? 아직 아무도 처리하지 않았을 때만 회수할 수 있습니다.",
      "appr.form.title": "기안 작성",
      "appr.form.form": "양식",
      "appr.form.titlefield": "제목 *",
      "appr.form.titlePh": "무엇을 결재받으려는지 한 줄로 적어 주세요",
      "appr.form.body": "내용",
      "appr.form.bodyPh": "배경·요청 사항·확인할 내용을 적어 주세요",
      "appr.form.attach": "첨부 링크",
      "appr.form.attachPh": "구글 드라이브·견적서 같은 링크 (선택)",
      "appr.form.approver1": "1차 결재자 *",
      "appr.form.approver2": "최종 결재자",
      "appr.form.none": "— 선택 안 함 —",
      "appr.form.draft": "임시저장",
      "appr.form.submit": "결재 상신",
      "appr.form.noFields": "이 양식은 제목·내용만 받습니다.",
      "appr.form.noneForms": "결재 양식이 없습니다. 관리자에게 양식 등록을 요청해 주세요.",
      "appr.form.needTitle": "제목을 입력해 주세요.",
      "appr.form.needApprover": "1차 결재자를 지정해 주세요.",
      "appr.log.create": "기안 작성",
      "appr.log.submit": "상신",
      "appr.log.approve": "승인",
      "appr.log.reject": "반려",
      "appr.log.withdraw": "회수",
      "appr.log.view": "열람",
      "appr.log.comment": "의견"
    },
    en: {
      "lang.ko": "KO", "lang.en": "EN", "lang.label": "Menu language",
      "nav.tasks": "Tasks",
      "cta.register": "Register",
      "cta.register.full": "Register a workshop",

      "search.open": "Search",
      "search.open.aria": "Open site search",
      "search.label": "Search word",
      "search.eyebrow": "Search",
      "search.title": "What are you looking for?",
      "search.ph": "Search titles, summaries, text, tags and page titles",
      "search.submit": "Search",
      "search.scope.all": "All",
      "search.scope.post": "Posts",
      "search.scope.page": "Pages",
      "search.hint": "Searches titles, summaries, text, tags and board names at once. Words separated by spaces must all appear.",
      "share.copy": "Copy link",
      "share.share": "Share",

      "post.views.title": "Views",
      "post.en.fallback": "No English version",
      "post.en.fallback.title": "This post has no English text yet, so the Korean version is shown.",
      "post.read": "Read",
      "post.source": "Source",
      "post.interview": "Read interview",
      "post.read.body": "Read the post →",
      "post.detail": "Details",
      "page.eyebrow": "Page",
      "hm.popular.eyebrow": "Popular",
      "hm.popular.title": "Popular posts",
      "hm.popular.all": "All posts",
      "hm.popular.empty": "No posts with views yet.",
      "hm.popular.note": "No views recorded yet — showing the newest posts.",

      "search.workshops": "Search by workshop name, region, craft or description",
      "search.archive": "Search titles, summaries, outlets or regions",
      "search.tasks": "Search title, assignee or description",

      "pager.prev": "Prev",
      "pager.next": "Next",
      "pager.page": "Page {n}",
      "pager.range": "of ",
      "pager.of": "",

      "filter.all": "All",
      "filter.allIssues": "All issues",
      "filter.allCorners": "All corners",

      "board.count": "workshops",
      "board.total": "total",
      "board.empty": "No workshops match. Try another keyword or filter.",
      "boards.empty": "No posts on this board yet.",

      "cmt.btn": "Comments",
      "cmt.title": "Comments",
      "cmt.open.aria": "View comments",
      "cmt.n.aria": "View {n} comments",
      "cmt.input.ph": "Leave a note that helps others. (up to 1,000 characters)",
      "cmt.submit": "Post comment",
      "cmt.sending": "Posting…",
      "cmt.posted": "Your comment is posted.",
      "cmt.as": "Posting as {name}",
      "cmt.guest.head": "Comment as a guest",
      "cmt.guest.hint": "Type the characters shown in the image.",
      "cmt.guest.name": "Nickname (1–60 characters)",
      "cmt.guest.captcha": "5 characters from the image",
      "cmt.guest.refresh": "New characters",
      "cmt.guest.captcha.loading": "Loading the security image…",
      "cmt.login.need": "Sign in to comment. Any member can join in.",
      "cmt.login.btn": "Sign in and comment",
      "cmt.off": "Comments are turned off on this board.",
      "cmt.empty.title": "No comments yet.",
      "cmt.empty.desc": "Be the first to leave a note.",
      "cmt.loading": "Loading comments…",
      "cmt.load.fail": "Could not load comments. Please reopen in a moment.",
      "cmt.delete": "Delete",
      "cmt.reply": "Reply",
      "cmt.me": "You",
      "cmt.guest.badge": "Guest",
      "cmt.confirm.del": "Delete this comment? This cannot be undone.",

      "auth.eyebrow": "Wooridongne workshop member",
      "auth.signin.title": "Sign in",
      "auth.signup.title": "Sign up",
      "auth.reset.title": "Set a new password",
      "auth.signin.sub": "Save workshops you like and come back to them later.",
      "auth.signup.sub": "All you need is an email. You can save workshops right after signing up.",
      "auth.reset.sub": "Enter the new password you want to use.",
      "auth.google": "Continue with Google",
      "auth.kakao": "Continue with Kakao",
      "auth.naver": "Continue with Naver",
      "auth.or": "or with email",
      "auth.email": "Email",
      "auth.nickname": "Nickname",
      "auth.optional": "(optional)",
      "auth.nick.ph": "Name shown on boards",
      "auth.password": "Password",
      "auth.newPassword": "New password",
      "auth.pass.ph": "6 characters or more",
      "auth.submit.signin": "Sign in",
      "auth.submit.signup": "Sign up",
      "auth.submit.reset": "Change password",
      "auth.toggle.signin": "New here? <b>Sign up</b>",
      "auth.toggle.signup": "Already a member? <b>Sign in</b>",
      "auth.forgot": "Forgot your password?",
      "auth.terms": "Signing up means you agree to the site terms. Your email is used only for sign-in and notices.",
      "auth.menu.bookmarks": "Saved workshops",
      "auth.menu.mypage": "My page",
      "auth.menu.board": "Workshop board",
      "auth.menu.tasks": "Tasks",
      "auth.menu.signout": "Sign out",
      "auth.login.btn": "Sign in",
      "auth.login.aria": "Sign in or sign up",
      "auth.processing": "Working…",

      "tasks.eyebrow": "Tasks",
      "tasks.title": "The team's work board",
      "tasks.desc": "Write what needs doing and move it along together. Every signed-in member can use it; the admin manages all tasks.",
      "tasks.gate.title": "Tasks are available after you sign in",
      "tasks.gate.desc": "Sign in to open the work board. If you are not a member yet, an email is all you need.",
      "tasks.gate.btn": "Sign in",
      "tasks.grade.title": "Tasks are available to {grade} and above",
      "tasks.grade.desc": "Your grade is {mine}. The operator can change it in the admin screen.",
      "tasks.loading": "Loading tasks…",
      "tasks.load.fail": "Could not load tasks. Please refresh in a moment.",
      "tasks.add": "New task",
      "tasks.edit": "Edit",
      "tasks.delete": "Delete",
      "tasks.save": "Save",
      "tasks.cancel": "Cancel",
      "tasks.form.new": "New task",
      "tasks.form.edit": "Edit task",
      "tasks.field.title": "Title *",
      "tasks.field.desc": "Description",
      "tasks.field.status": "Status",
      "tasks.field.priority": "Priority",
      "tasks.field.due": "Due date",
      "tasks.field.assignee": "Assignee",
      "tasks.ph.title": "One line on what to do",
      "tasks.ph.desc": "Notes, links, what to check (optional)",
      "tasks.ph.assignee": "Assignee name (optional)",
      "tasks.status.todo": "To do",
      "tasks.status.doing": "Doing",
      "tasks.status.done": "Done",
      "tasks.priority.low": "Low",
      "tasks.priority.normal": "Normal",
      "tasks.priority.high": "High",
      "tasks.col.todo": "To do",
      "tasks.col.doing": "Doing",
      "tasks.col.done": "Done",
      "tasks.empty.col": "Nothing here yet.",
      "tasks.empty.all": "No tasks yet. Start with ‘New task’.",
      "tasks.count": "{n}",
      "tasks.total": "{n} tasks",
      "tasks.due.none": "No due date",
      "tasks.due.today": "Due today",
      "tasks.due.over": "{n} days late",
      "tasks.due.left": "D-{n}",
      "tasks.by": "by",
      "tasks.confirm.del": "Delete this task? This cannot be undone.",
      "tasks.saved": "Saved.",
      "tasks.deleted": "Deleted.",
      "tasks.fail": "Could not save: ",
      "tasks.login.needed": "Your sign-in has expired. Please sign in again.",
      "tasks.move": "Change status",
      "tasks.list.view": "List",
      "tasks.filter.status": "Status",
      "tasks.selectGrade": "Grade",

      "nav.approvals": "Approvals",
      "appr.eyebrow": "Approvals",
      "appr.title": "Draft it, approve it",
      "appr.desc": "Pick a form, send a draft, and let the first and final approvers approve or reject it. The approval line and its history stay with the document.",
      "appr.gate.title": "Approvals are available after signing in",
      "appr.gate.desc": "Sign in to open your approval box. If you are not a member yet, an email address is all you need.",
      "appr.gate.btn": "Sign in",
      "appr.new": "New draft",
      "appr.q": "Search by document number, title or drafter",
      "appr.loading": "Loading your approval box…",
      "appr.load.fail": "Could not load the approval box. Please try again in a moment. ",
      "appr.msg.login": "Your sign-in has expired. Please sign in again.",
      "appr.msg.fail": "Could not process: ",
      "appr.msg.notAllowed": "Not allowed: ",
      "appr.msg.drafted": "Saved as a draft. Send it from “My drafts”.",
      "appr.msg.submitted": "Sent for approval. It is now with the first approver.",
      "appr.msg.approved": "Approved.",
      "appr.msg.rejected": "Rejected. The drafter will see your reason.",
      "appr.msg.withdrawn": "Draft withdrawn.",
      "appr.notice.missing.title": "The approval tables are not created yet",
      "appr.notice.missing.desc": "Run the file below once in the Supabase SQL Editor to turn the approval box on (safe to run again).",
      "appr.tab.inbox": "Waiting on me",
      "appr.tab.mine": "My drafts",
      "appr.tab.done": "Done · rejected",
      "appr.tab.all": "All (admin)",
      "appr.empty.inbox": "Nothing is waiting for your approval.",
      "appr.empty.mine": "You have not sent any draft yet. Start with ‘New draft’.",
      "appr.empty.done": "No approved or rejected documents yet.",
      "appr.empty.all": "No approval documents yet.",
      "appr.empty.missing": "The approval tables are missing, so no list can be drawn. Run the SQL above.",
      "appr.total": "{n}",
      "appr.by": "by",
      "appr.waitFor": "waiting at {step}",
      "appr.progress": "{done}/{total} approved",
      "appr.turn.mine": "Your turn",
      "appr.step.n": "Step {n}",
      "appr.badge.draft": "Draft",
      "appr.badge.pending": "In approval",
      "appr.badge.approved": "Approved",
      "appr.badge.rejected": "Rejected",
      "appr.badge.canceled": "Withdrawn",
      "appr.stepState.waiting": "Not yet",
      "appr.stepState.pending": "Waiting",
      "appr.stepState.approved": "Approved",
      "appr.stepState.rejected": "Rejected",
      "appr.meta.drafter": "Drafter",
      "appr.meta.created": "Created",
      "appr.meta.submitted": "Submitted",
      "appr.meta.draft": "Not submitted yet",
      "appr.meta.status": "Status",
      "appr.meta.current": "Current step",
      "appr.meta.attach": "Attachment link",
      "appr.detail.body": "Body",
      "appr.detail.line": "Approval line",
      "appr.detail.logs": "History",
      "appr.detail.noBody": "No body text.",
      "appr.detail.noSteps": "No approval line.",
      "appr.detail.noLogs": "No history yet.",
      "appr.approve": "Approve",
      "appr.reject": "Reject",
      "appr.reject.ask": "Reason for rejection (required)",
      "appr.reject.ph": "Say what needs to change",
      "appr.reject.send": "Reject",
      "appr.reject.need": "Please write a reason for rejection.",
      "appr.withdraw": "Withdraw",
      "appr.submit": "Send for approval",
      "appr.close": "Close",
      "appr.cancel": "Cancel",
      "appr.confirm.withdraw": "Withdraw this draft? You can only withdraw before anyone acts on it.",
      "appr.form.title": "New draft",
      "appr.form.form": "Form",
      "appr.form.titlefield": "Title *",
      "appr.form.titlePh": "One line on what needs approval",
      "appr.form.body": "Details",
      "appr.form.bodyPh": "Background, request, what to check",
      "appr.form.attach": "Attachment link",
      "appr.form.attachPh": "A Drive or quote link (optional)",
      "appr.form.approver1": "First approver *",
      "appr.form.approver2": "Final approver",
      "appr.form.none": "— None —",
      "appr.form.draft": "Save draft",
      "appr.form.submit": "Send for approval",
      "appr.form.noFields": "This form takes a title and details only.",
      "appr.form.noneForms": "No approval forms yet. Ask an admin to add one.",
      "appr.form.needTitle": "Please enter a title.",
      "appr.form.needApprover": "Please choose the first approver.",
      "appr.log.create": "Drafted",
      "appr.log.submit": "Submitted",
      "appr.log.approve": "Approved",
      "appr.log.reject": "Rejected",
      "appr.log.withdraw": "Withdrawn",
      "appr.log.view": "Viewed",
      "appr.log.comment": "Commented"
    }
  };

  function fill(text, vars) {
    var all = {
      site: (window.SBP && window.SBP.brandName) ? window.SBP.brandName() : (SC.siteName || ""),
      tagline: (window.SBP && window.SBP.tagline) ? (window.SBP.tagline() || window.SBP.brandName()) : (SC.tagline || SC.siteName || "")
    };
    if (vars) for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) all[k] = vars[k];
    return String(text).replace(/\{(\w+)\}/g, function (m, k) {
      return all[k] != null ? String(all[k]) : m;
    });
  }

  /* ---------- API ---------- */
  function t(key, vars) {
    var table = DICT[lang] || DICT.ko;
    var v = table[key];
    if (v == null) v = DICT.ko[key];
    if (v == null) v = key;
    return fill(v, vars);
  }

  function pickAttr(n, name) { return n.getAttribute(name); }

  /* 화면의 [data-i18n] 표시를 현재 언어로 채웁니다. */
  function apply(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    [].forEach.call(scope.querySelectorAll("[data-i18n]"), function (n) {
      var v = t(pickAttr(n, "data-i18n"));
      if (n.textContent !== v) n.textContent = v;
    });
    [].forEach.call(scope.querySelectorAll("[data-i18n-html]"), function (n) {
      n.innerHTML = t(pickAttr(n, "data-i18n-html"));
    });
    [].forEach.call(scope.querySelectorAll("[data-i18n-ph]"), function (n) {
      n.setAttribute("placeholder", t(pickAttr(n, "data-i18n-ph")));
    });
    [].forEach.call(scope.querySelectorAll("[data-i18n-aria]"), function (n) {
      n.setAttribute("aria-label", t(pickAttr(n, "data-i18n-aria")));
    });
    [].forEach.call(scope.querySelectorAll("[data-i18n-title]"), function (n) {
      n.setAttribute("title", t(pickAttr(n, "data-i18n-title")));
    });
  }

  function set(next) {
    var v = String(next || "").toLowerCase();
    if (SUPPORTED.indexOf(v) < 0 || v === lang) { syncSwitches(); return; }
    lang = v;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* 저장 실패는 무시 */ }
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "ko");
    apply(document);
    syncSwitches();
    try {
      document.dispatchEvent(new CustomEvent("craft:lang", { detail: { lang: lang } }));
    } catch (e) { /* 옛 브라우저 */ }
  }

  /* 헤더의 KO | EN 버튼 상태 */
  function syncSwitches() {
    [].forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("on", on);
    });
    var box = document.getElementById("lang-switch");
    if (box) box.setAttribute("aria-label", t("lang.label"));
  }

  function onChange(fn) {
    if (typeof fn !== "function") return;
    document.addEventListener("craft:lang", function () {
      try { fn(lang); } catch (e) { /* 한 곳이 실패해도 나머지는 그대로 */ }
    });
  }

  /* 헤더 스위치 연결 (index.html 의 #lang-switch) */
  function initSwitch() {
    var box = document.getElementById("lang-switch");
    if (!box || box.getAttribute("data-bound") === "1") return;
    box.setAttribute("data-bound", "1");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lang]");
      if (!b) return;
      e.preventDefault();
      set(b.getAttribute("data-lang"));
    });
    syncSwitches();
  }

  document.documentElement.setAttribute("lang", lang === "en" ? "en" : "ko");

  window.CRAFT_I18N = {
    lang: function () { return lang; },
    isEn: function () { return lang === "en"; },
    t: t,
    set: set,
    apply: apply,
    onChange: onChange,
    initSwitch: initSwitch,
    sync: syncSwitches,
    dict: DICT
  };

  function boot() {
    initSwitch();
    apply(document);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
