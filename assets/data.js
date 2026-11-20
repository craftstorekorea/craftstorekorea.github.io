/* 전국공방 — 사이트 데이터 (2026-11-20 기준, 2026-11-13 ~ 11-20 검증 소식) */
window.SITE = {
  updated: "2026-11-20",
  weekFrom: "2026-11-13",
  weekTo: "2026-11-20",

  links: {
    register: "https://docs.google.com/forms/d/e/1FAIpQLSfsAqB6xnd8iNofTPrmpF6XKYlWrb_vMhYaYuEvMup3IS2oiw/viewform",
    newsletter: "https://page.stibee.com/archives/252109",
    instagram: "https://www.instagram.com/craftstore.kr",
    sites: "https://sites.google.com/view/craftstore-kr",
    sheet: "https://docs.google.com/spreadsheets/d/1OhA6nOWiBpbrQ01QcAJIoq_RT4iNk3JsgL6rKk8IAyY/edit",
    sheetId: "1OhA6nOWiBpbrQ01QcAJIoq_RT4iNk3JsgL6rKk8IAyY"
  },

  /* 이번 주 키워드 */
  keywords: ["은입사", "나전·누비", "옹기", "목공", "도예", "뜨개", "한지", "공예 9조 시장"],

  /* 네 코너 */
  corners: [
    {
      key: "workshops", label: "소개", en: "INTRO",
      desc: "새로 조명된 공방과 공예 공간, 지역의 작업실",
      icon: "home"
    },
    {
      key: "news", label: "뉴스", en: "NEWS",
      desc: "공예·핸드메이드 업계와 지역 공방 거리 소식",
      icon: "news"
    },
    {
      key: "interview", label: "인터뷰", en: "INTERVIEW",
      desc: "공방장과 공예 작가의 목소리",
      icon: "mic"
    },
    {
      key: "info", label: "정보", en: "GUIDE",
      desc: "공모·지원사업, 전시와 원데이클래스 일정",
      icon: "doc"
    }
  ],

  /* 이번 주 주요 소식 (홈) */
  featured: {
    main: {
      tag: "뉴스",
      title: "더현대 서울에서 만나는 전승 공예 230여 종",
      sub: "K-크래프트 하우스 팝업 · 11/21~29",
      desc: "국가유산청과 아이디어스가 함께 여는 무료 팝업. 전승 공예품 230여 종을 한자리에서 보고 살 수 있습니다. 예약 없이 방문할 수 있습니다.",
      meta: "연합뉴스 · 2026-11-19",
      url: "https://www.yna.co.kr/view/AKR20261119066700005"
    },
    side: [
      {
        tag: "소개",
        title: "동두천 두두리공방 승경란 작가, 국가무형유산 입사장 보유자 인정",
        meta: "경기일보 · 11-13",
        url: "https://www.kyeonggi.com/article/20261113580143"
      },
      {
        tag: "인터뷰",
        title: "김경배 공진원장 “공예는 쓰일 때 문화가 되고 산업이 된다”",
        meta: "매일경제 · 11-18",
        url: "https://www.mk.co.kr/news/culture/12212174"
      },
      {
        tag: "정보",
        title: "밀양 찻사발 전국공모전, 11/20~22 접수",
        meta: "뉴스경남 · 11-15",
        url: "https://www.newsgn.com/news/articleView.html?idxno=585538"
      }
    ]
  },

  /* 공방 소개 — 시트에 승인된 공방 (좌표는 카카오맵 주소 검색 기준) */
  workshops: [
    {
      name: "가죽공방 본", craft: "가죽공예", region: "부산",
      address: "부산 수영구 수영성로 38, 1층",
      oneday: "예",
      desc: "2017년 문을 연 가죽공방. 서경원 대표가 주문 제작과 원데이클래스, 청각장애인 대상 가죽공예 수업, 자투리 가죽 업사이클링을 함께 합니다.",
      note: "부산진 2026-11-16 보도",
      url: "https://busanzine.com/8937",
      lat: 35.170501, lng: 129.115757, kind: "공방 등록"
    },
    {
      name: "두두리공방", craft: "전통공예", region: "경기",
      address: "경기 동두천시 평화로 2539 디자인아트빌리지 (보산동 436-16)",
      oneday: "협의",
      desc: "승경란 작가의 은입사(입사장) 공방. 2026년 11월 국가무형유산 제78호 입사장 보유자로 인정받았습니다.",
      note: "경기일보 2026-11-13 보도",
      url: "https://www.kyeonggi.com/article/20261113580143",
      lat: 37.914319, lng: 127.057237, kind: "공방 등록"
    },
    {
      name: "횡성목재문화체험장", craft: "목공", region: "강원",
      address: "강원 횡성군 우천면 두래울문화길 93",
      oneday: "예",
      desc: "원목 도마 만들기 등 목공 11종을 운영하는 목재 문화 체험장. 11월 24일~12월 18일 1차 시범운영은 체험료·재료비가 무료입니다(화~금 하루 2회, 전화 예약 033-342-7150).",
      note: "연합뉴스 2026-11-19 보도",
      url: "https://www.yna.co.kr/view/AKR20261119052000062",
      lat: 37.474901, lng: 128.037184, kind: "원데이클래스·체험"
    },
    {
      name: "작공 (공주원도심작업실·공방조합)", craft: "도예·세라믹", region: "충남",
      address: "충남 공주시 제민2길 1-1 (고마크리에츠)",
      oneday: "협의",
      desc: "공주 원도심에서 작업실·공방을 운영하는 10개 공방과 4명의 작가가 모인 조합(조합장 정연희). 골목길 음악회, 작공 아트마켓, 한줄 동화전을 열고 있습니다.",
      note: "금강뉴스 2026-11-13 보도",
      url: "http://www.kknews.co.kr/news/articleView.html?idxno=109679",
      lat: 36.451481, lng: 127.121123, kind: "공방 등록"
    }
  ],

  /* 공예 분야 (등록 공방 기준) */
  categories: [
    { name: "가죽공예", count: 1, desc: "주문 제작 가죽 제품과 원데이 클래스, 자투리 가죽 업사이클링." },
    { name: "전통공예", count: 1, desc: "은입사(입사장)처럼 국가무형유산으로 이어지는 손기술." },
    { name: "목공", count: 1, desc: "원목 도마·소품 만들기부터 목재 문화 체험까지." },
    { name: "도예·세라믹", count: 1, desc: "흙을 빚어 굽는 작업실, 지역 공방 조합과 아트마켓." }
  ],

  /* 공방 뉴스 */
  news: [
    {
      title: "더현대 서울 'K-크래프트 하우스' 팝업, 11/21~29",
      source: "연합뉴스", date: "2026-11-19",
      desc: "국가유산청과 아이디어스가 협업해 전승 공예품 230여 종을 소개합니다. 무료·예약 없이 관람할 수 있습니다.",
      url: "https://www.yna.co.kr/view/AKR20261119066700005",
      region: "서울", tag: "팝업·전시"
    },
    {
      title: "‘공예 9조 시장’, 과제는 생산·유통",
      source: "매일경제", date: "2026-11-17",
      desc: "공진원 진단으로 1인 사업체 64%, 직접 판매 71.7%. 작가와 시장을 잇는 매니지먼트가 필요하다는 지적입니다.",
      url: "https://www.mk.co.kr/news/culture/12211468",
      region: "전국", tag: "업계"
    },
    {
      title: "통영메이드 팝업 ‘전통이 하이엔드가 되다’, 광장시장에서 11/21까지",
      source: "조선비즈", date: "2026-11-17",
      desc: "나전·누비 장인 8명과 디자이너 3명이 협업한 26종을 선보입니다. 365일장에서 열리는 마감 임박 소식입니다.",
      url: "https://biz.chosun.com/industry/business_info/2026/11/17/6IRYNRZCQVEEZCXQ6WJ4C6NJWY/",
      region: "서울", tag: "팝업·전시"
    },
    {
      title: "로컬바이브 2026, ‘로컬 공예’ 브랜드 11곳 코엑스 집결",
      source: "에이빙", date: "2026-11-19",
      desc: "11/20~22 코엑스 C홀, 입장 1만 원. 망미장·린보워크샵·소목반 등 지역 공예 브랜드가 참가합니다.",
      url: "https://kr.aving.net/news/articleView.html?idxno=1817192",
      region: "서울", tag: "페어"
    },
    {
      title: "울주군, 옛 영남요업 가마 살려 옹기 관광복합문화공간 조성",
      source: "울산신문", date: "2026-11-16",
      desc: "189.6억 규모 기본계획 보고. 외고산 옹기마을 장인 협업공방과 레지던시를 담았습니다.",
      url: "https://www.ulsanpress.net/news/articleView.html?idxno=586974",
      region: "울산", tag: "지역"
    },
    {
      title: "한국도자재단 출연금 감소 우려…지역 도예인 자립 지원으로 전환",
      source: "경기일보", date: "2026-11-13",
      desc: "대규모 페스티벌 중심에서 지역 도예인 자립을 돕는 방향으로 옮겨간다는 소식입니다.",
      url: "https://www.kyeonggi.com/article/20261113580451",
      region: "경기", tag: "정책"
    },
    {
      title: "공주 원도심 공방 10곳 ‘작공’ 조합 출범",
      source: "금강뉴스", date: "2026-11-13",
      desc: "11월 아트마켓과 한줄 동화전을 시작으로 골목길 음악회까지 엽니다.",
      url: "http://www.kknews.co.kr/news/articleView.html?idxno=109679",
      region: "충남", tag: "지역"
    },
    {
      title: "구미 금리단길 청년 120명, 공방 9곳에서 원데이 체험",
      source: "경북일보", date: "2026-11-15",
      desc: "‘Hi 구미청년’ 프로그램으로 청년과 지역 공방을 연결합니다.",
      url: "https://www.kyongbuk.co.kr/news/articleView.html?idxno=4090834",
      region: "경북", tag: "지역"
    },
    {
      title: "‘금손하우스’, 공예작가 작업 과정 소개부터 공방 예약까지",
      source: "고시위크", date: "2026-11-18",
      desc: "작가의 작업 과정을 보여주고 공방 예약으로 연결하는 공예 플랫폼입니다.",
      url: "https://www.gosiweek.com/article/1065601386235226",
      region: "전국", tag: "플랫폼"
    }
  ],

  /* 작가 인터뷰 */
  interviews: [
    {
      person: "김경배", role: "한국공예·디자인문화진흥원장",
      title: "“공예는 쓰일 때 문화가 되고 산업이 된다”",
      quote: "공예는 쓰일 때 문화가 되고, 산업이 된다.",
      desc: "1인 공방의 예술기업 도약, 지역 거점 클러스터, 국립공예관 설립까지 — 공진원이 그리는 다음 10년의 그림을 들려줍니다.",
      source: "매일경제", date: "2026-11-18",
      url: "https://www.mk.co.kr/news/culture/12212174"
    },
    {
      person: "홍성민", role: "양산 온가족 뜨개집 공방장",
      title: "25년을 이어온 뜨개집 “끈기가 제일 중요해요”",
      quote: "견디는 거죠. 끈기가 제일 중요해요.",
      desc: "양산에서 25년째 뜨개집을 지켜온 공방장이 말하는 오래 가게를 만드는 일.",
      source: "양산신문", date: "2026-11-18",
      url: "http://www.yangsanilbo.com/news/articleView.html?idxno=128858"
    }
  ],

  /* 지원·공모·전시·클래스 — 마감일 기준 정렬 (due 없으면 뒤로) */
  info: [
    {
      title: "2027 KCDF 공예·디자인 공모전시",
      org: "한국공예·디자인문화진흥원",
      period: "접수 마감 11/20 14:00",
      due: "2026-11-20T14:00",
      kind: "공모",
      desc: "인사동 KCDF갤러리 무료 대관 + 직접경비 500만~2,500만 원 지원.",
      url: "https://esellernews.kr/?id=149"
    },
    {
      title: "용인 ‘나도 금손’ 팝업 데이",
      org: "용인상상의숲 공생광장",
      period: "11/21 하루",
      due: "2026-11-21",
      kind: "체험",
      desc: "공예 꾸러미 20종을 만져보는 하루 팝업.",
      url: "http://www.gyinews.kr/news/articleView.html?idxno=68532"
    },
    {
      title: "2026 밀양 경남 찻사발·차우림이 전국공모전",
      org: "밀양 · 경남",
      period: "접수 11/20~22",
      due: "2026-11-22",
      kind: "공모",
      desc: "찻사발과 차우림이를 주제로 한 전국 공모전 접수.",
      url: "https://www.newsgn.com/news/articleView.html?idxno=585538"
    },
    {
      title: "이천 중리동 공방투어 ‘다시, 나의 봄날’",
      org: "커넥트이천",
      period: "11/23~29",
      due: "2026-11-29",
      kind: "체험",
      desc: "중리동 6개 공방을 잇는 투어 프로그램.",
      url: "https://www.connecticheon.com/ko-kr/articles/3779"
    },
    {
      title: "화성시 공예문화관 전통공예 특강",
      org: "화성시 공예문화관",
      period: "모집 11/24~12/4",
      due: "2026-12-04",
      kind: "교육",
      desc: "초경·닥종이·규방 특강, 수강료 무료.",
      url: "https://www.hscity.go.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=1019&q_bbscttSn=20261119174421719"
    },
    {
      title: "광주 동구 ‘명장·장인과 함께하는 원데이 클래스’",
      org: "광주 동구",
      period: "접수 11/18~27",
      due: "2026-11-27",
      kind: "체험",
      desc: "명장·장인에게 직접 배우는 무료 원데이 클래스.",
      url: "https://begin-up.com/announcements/AG_mun-gj-donggu_ljc3mp"
    },
    {
      title: "구미 신라불교초전지 핸드빌딩 원데이클래스",
      org: "신라불교초전지",
      period: "11/28",
      due: "2026-11-28",
      kind: "체험",
      desc: "체험비 1만 원, 핸드빌딩으로 그릇을 빚는 하루.",
      url: "http://www.gmuc.or.kr/silla/boardViewModel.do?ArticleId=16438&Category=226&mid=226"
    },
    {
      title: "K-핸드메이드페어 서울 2026",
      org: "코엑스 B홀",
      period: "12/17~20 · 사전예매 ~12/15",
      due: "2026-12-20",
      kind: "페어",
      desc: "사전예매 시 20% 할인. 핸드메이드 작가와 브랜드가 모이는 연말 페어.",
      url: "https://www.threads.com/@k_handmadefair"
    },
    {
      title: "《2026 찾아가는 공예 명작전》 광주 ‘공유자산’",
      org: "광주디자인진흥원",
      period: "11/20~12/26",
      due: "2026-12-26",
      kind: "전시",
      desc: "전통문화포털이 소개한 순회 전시, 관람 무료.",
      url: "https://www.kculture.or.kr/brd/board/399/L/menu/498?bbIdx=17225"
    },
    {
      title: "구리 갈매 아이&유거리 골목형상점가 무료 원데이클래스",
      org: "구리 갈매동",
      period: "~2027년 2월",
      due: ""
      , kind: "체험",
      desc: "골목형상점가에서 상시로 열리는 무료 원데이 클래스.",
      url: "https://www.gokorea.kr/news/articleView.html?idxno=886360"
    },
    {
      title: "순천 한옥글방 ‘손끝의 계절’ 전통공예 무료 체험",
      org: "순천 한옥글방",
      period: "11~12월",
      due: "",
      kind: "체험",
      desc: "한옥에서 만나는 전통공예 무료 체험 프로그램.",
      url: "https://www.suncheonnews.kr/articles/2026111486493"
    }
  ]
};
