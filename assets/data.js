/* 전국공방 — 사이트 데이터 (2026-11-21 기준, 2026-11-13 ~ 11-20 검증 소식 + 11-20 구글 알리미 신규 20건) */
window.SITE = {
  updated: "2026-11-21",
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
  keywords: ["비저블 멘딩", "로에베 공예상", "달항아리", "당근 유료일정", "재생가죽", "공예 9조 시장", "나전·누비", "목공"],

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
        tag: "뉴스",
        title: "로에베 재단 공예상 최고상에 도예가 박종진",
        meta: "매일경제 · 11-17",
        url: "https://www.mk.co.kr/news/culture/12211192"
      },
      {
        tag: "인터뷰",
        title: "1평 수선 공방에서 로레알·유니클로까지, 지민주 재니들 대표",
        meta: "한국경제 · 11-20",
        url: "https://www.hankyung.com/article/2026111982391"
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

  /* 소개 코너 기사 — 이번 주 새로 조명된 공방·공간 */
  intro: [
    {
      title: "시흥 ‘손과 숨의 방’ 도예공방, 우수 봉사자 66명에 하루를 선물",
      source: "시흥저널", date: "2026-11-19",
      desc: "시흥시자원봉사센터가 11/13·14·17 사흘간 ‘2026 볼런티어 겨울 패키지’를 열었습니다. 61세 이상 우수 봉사자와 명예의 전당 등재자 66명이 연성로 도예공방 ‘손과 숨의 방’에서 흙을 만졌습니다.",
      url: "https://www.shjn.co.kr/news/articleView.html?idxno=90230",
      region: "경기", tag: "공방"
    },
    {
      title: "김천 봉산면 주민자치 목공방 ‘뚝딱 뚝딱, 봉산 행복한 목공방’",
      source: "경북도민일보", date: "2026-11-16",
      desc: "11/13 거산서각에서 첫 강좌를 열고 생활 소품과 소가구 만들기를 시작했습니다. 안전교육부터 차근차근, 주민이 직접 운영하는 목공방입니다.",
      url: "https://www.hidomin.com/news/articleView.html?idxno=729615",
      region: "경북", tag: "공방"
    },
    {
      title: "도봉구 공방 3곳 대표가 강사로 — 덕성여대 공예교육, 제작품 30점 기부",
      source: "아시아타임즈", date: "2026-11-17",
      desc: "4년째 이어온 지역사회 공유배움터 프로그램. 올해 가죽·리본·라탄공예 5회에 30명이 참여했고, 강사는 도봉구에서 공방을 운영하는 최주경(공방비록)·구성진(민트에이)·정은주(토토얀공방) 대표입니다. 만든 작품은 지역 가정에 전달했습니다.",
      url: "https://www.asiatime.co.kr/article/20261117500128",
      region: "서울", tag: "공방"
    },
    {
      title: "고창 혜윰공방, 모암마을에 주민과 함께 만든 보자기 그늘막",
      source: "새전북신문", date: "2026-11-19",
      desc: "고창문화관광재단 ‘터치유’ 사업의 ‘마음보따리’. 김유진·이은주·최민희가 6회 워크숍으로 주민과 보자기를 이어 만든 공동 그늘막을 모암마을회관 앞 공터에 세웠습니다.",
      url: "https://sjbnews.com/news/news.php?number=892433&year=2026",
      region: "전북", tag: "공방"
    },
    {
      title: "부천 상2동 예술마켓, 거리에서 동네 가게로",
      source: "부천포커스", date: "2026-11-19",
      desc: "10월 매주 토요일 상2동 카페거리에서 도예·패브릭·액세서리·가죽공예·디퓨저 마켓을 열고, 상시 ‘예술상점’으로 이어갔습니다. 부천예술투어 스탬프 거점이며 투어는 11/30까지입니다.",
      url: "https://www.efocus.co.kr/news/articleView.html?idxno=57504",
      region: "경기", tag: "마켓"
    },
    {
      title: "안성시·중앙대, 청소년 공예창작 진로캠프 — 학생 3명당 지도자 1명",
      source: "경기남부저널", date: "2026-11-19",
      desc: "11/18 중앙대 다빈치캠퍼스에서 안성초 4학년이 목공예를 실습했습니다. 문화도시 조성사업과 지역 인재양성체계를 잇는 ‘밀착형 공방 수업’입니다.",
      url: "http://www.gnjn.co.kr/news/articleViewAmp.html?idxno=133081",
      region: "경기", tag: "교육"
    },
    {
      title: "부산진구 20개 공방 연합 전시 《모두의 작업실》",
      source: "부산진구청", date: "2026-11-19",
      desc: "동천문화홀에서 11/19~12/2. 시민 체험 재료비는 1,000~2,000원입니다.",
      url: "https://www.busanjin.go.kr/lll/board/view.busanjin?boardId=BBS_0000010&dataSid=3981784&menuCd=DOM_000000206001000000",
      region: "부산", tag: "전시"
    },
    {
      title: "횡성목재문화체험장, 11/24~12/18 시범운영",
      source: "연합뉴스", date: "2026-11-19",
      desc: "목공 11종을 무료로 체험. 화~금 하루 2회, 전화 예약(033-342-7150)으로 신청합니다.",
      url: "https://www.yna.co.kr/view/AKR20261119052000062",
      region: "강원", tag: "체험"
    },
    {
      title: "망미동 골목 네 칸의 캠퍼스 — 가죽공방 본",
      source: "부산진", date: "2026-11-16",
      desc: "사회복지사 출신 서경원 대표가 원데이클래스, 청각장애인 수업, 업사이클링을 함께 운영합니다.",
      url: "https://busanzine.com/8937",
      region: "부산", tag: "공방"
    },
    {
      title: "동두천 두두리공방 승경란 작가, 국가무형유산 ‘입사장’ 보유자 인정",
      source: "경기일보", date: "2026-11-13",
      desc: "보산동 디자인아트빌리지의 체험·플리마켓과 지역 축제를 연계할 계획입니다.",
      url: "https://www.kyeonggi.com/article/20261113580143",
      region: "경기", tag: "사람"
    }
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
      title: "로에베 재단 공예상 최고상에 도예가 박종진 — 이어지는 한국 공예의 세계 무대 수상",
      source: "매일경제", date: "2026-11-17",
      desc: "종이 수천 장에 흙물을 입혀 겹겹이 구운 ‘Strata of Illusion’으로 2026 로에베 재단 공예상 최고상을 받았습니다. 2022년 정다혜 이후 두 번째 한국인 최고상이며, 2024년에는 김희찬이 특별상을 받았습니다.",
      url: "https://www.mk.co.kr/news/culture/12211192",
      region: "전국", tag: "업계"
    },
    {
      title: "59억 원에 낙찰된 조선 달항아리 — K-공예, 글로벌 아트로 도약할까",
      source: "매일경제", date: "2026-11-18",
      desc: "2026년 3월 뉴욕 크리스티에서 318만 6,000달러(약 47억 7,000만 원)에, 2023년에는 456만 달러(약 59억 4,000만 원)에 팔렸습니다. 박물관 문화상품 브랜드 뮷즈 매출은 2021년 65.9억 원에서 2025년 413.4억 원으로 커졌습니다.",
      url: "https://www.mk.co.kr/news/culture/12212382",
      region: "전국", tag: "업계"
    },
    {
      title: "당근, 원데이 클래스·유료 레슨 ‘유료일정’ 수도권 오픈",
      source: "전자신문", date: "2026-11-16",
      desc: "모임 개설부터 참가비 결제·환불·정산까지 당근 안에서 처리합니다. 내년 6월 30일까지 모임장 이용료가 15%에서 10%로, 참가비 1만 원 이하 일정은 3.3%가 적용됩니다. 공방 원데이클래스의 새 판로입니다.",
      url: "https://www.etnews.com/20261116000088",
      region: "서울", tag: "플랫폼"
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
      title: "아이디어스 ‘아주큰 세일’, 12/1까지 16일간 핸드메이드 기획전",
      source: "디스커버리뉴스", date: "2026-11-16",
      desc: "식품·패션·주얼리·홈리빙·뷰티 전 카테고리를 한자리에 모아 일자별 타임딜과 대표 작가 기획전을 엽니다. d+ 멤버십과도 연계합니다.",
      url: "https://www.discoverynews.kr/news/articleView.html?idxno=1106926",
      region: "전국", tag: "기획전"
    },
    {
      title: "커피박·사과박 재생가죽으로 매출 10배 — 평택 브라운스킨",
      source: "소셜임팩트뉴스", date: "2026-11-18",
      desc: "가죽 부산물과 농식품 부산물을 섞은 재생가죽으로 500g·3만 5,000원 안전화 ‘DOIM’을 만듭니다. 매출은 2023년 9,100만 원에서 2025년 8억 7,600만 원으로, 외부 투자 없이 3년 연속 흑자입니다.",
      url: "https://www.socialimpactnews.net/news/articleView.html?idxno=7915",
      region: "경기", tag: "업계"
    },
    {
      title: "르코르뷔지에·라이트가 사랑한 모로코 수공예 — ‘조용한 럭셔리’의 힘",
      source: "한국경제", date: "2026-11-19",
      desc: "베니 러그·젤리지·젤라바가 르코르뷔지에, 라이트, 이브 생로랑, 디올을 거쳐 현대 럭셔리로 이어지는 흐름. 해외 수공예 사례 참고용입니다.",
      url: "https://www.hankyung.com/article/2026111980951",
      region: "해외", tag: "업계"
    },
    {
      title: "지역공예 다시 ‘붐’ — 이천·부여·통영, 장인의 도시가 깨어난다",
      source: "매일경제", date: "2026-11-18",
      desc: "이천도자기축제는 방문 106만 명·판매 37.9억 원, 공방 323곳이 참여했습니다. 부여 123사비공예마을 ‘공예 런케이션’은 조기 마감, 통영메이드는 12월 공예트렌드페어에 섭니다.",
      url: "https://www.mk.co.kr/news/culture/12212639",
      region: "전국", tag: "지역"
    },
    {
      title: "로컬바이브 2026, ‘로컬 공예’ 브랜드 11곳 코엑스 집결",
      source: "에이빙", date: "2026-11-19",
      desc: "11/20~22 코엑스 C홀, 입장 1만 원. 망미장·린보워크샵·소목반 등 지역 공예 브랜드가 참가합니다.",
      url: "https://kr.aving.net/news/articleView.html?idxno=1817192",
      region: "서울", tag: "페어"
    },
    {
      title: "서바이스, 김영원 디자이너가 장인 직조와 재생 나일론으로 만든 액세서리",
      source: "한국섬유신문", date: "2026-11-16",
      desc: "런던 브랜드 단슬렁 창업자 김영원의 새 액세서리 브랜드 CERBISE. 리사이클 나일론 ‘C-Nylon’과 장인 직조 라피아 ‘Artisan’ 컬렉션을 장인 커뮤니티 지원단체 네스트(Nest)와 함께 만들었습니다.",
      url: "https://www.ktnews.com/news/articleView.html?idxno=150222",
      region: "해외", tag: "브랜드"
    },
    {
      title: "소더비 ‘인간의 손길’, 위커와 시계·주얼리를 한자리에 (취리히 11/23~28)",
      source: "하입비스트", date: "2026-11-14",
      desc: "에르메스 미니 켈리 피크닉(위커), 모건 미드서머 쿠페, 찰스 프로드샴 시계, 무사이에프 주얼리까지. 경매사의 특별전 ‘The Human Touch’가 손으로 만든 것의 가치를 모읍니다.",
      url: "https://hypebeast.kr/2026/11/sothebys-the-human-touch-exhibition-info",
      region: "해외", tag: "전시"
    },
    {
      title: "공방 3곳만 남은 울산 삼호철새마을 공예거리, 입점 지원 종료",
      source: "울산일보", date: "2026-11-16",
      desc: "2022년 말 도시재생으로 조성한 150m 공예거리. 2024~2025년 예산 8,200만 원을 넣었지만 신규 유입 없이 올해로 지원이 일몰됩니다. 공방거리 정책의 반면 사례입니다.",
      url: "http://www.ulsanilbo.co.kr/news/articleView.html?idxno=122063",
      region: "울산", tag: "지역"
    },
    {
      title: "울주군, 옛 영남요업 가마 살려 옹기 관광복합문화공간 조성",
      source: "울산신문", date: "2026-11-16",
      desc: "189.6억 규모 기본계획 보고. 외고산 옹기마을 장인 협업공방과 레지던시를 담았습니다.",
      url: "https://www.ulsanpress.net/news/articleView.html?idxno=586974",
      region: "울산", tag: "지역"
    },
    {
      title: "경기광주 자활센터, 자활사업 30주년 박람회서 수공예·업사이클 생산품 선보여",
      source: "교차로저널", date: "2026-11-17",
      desc: "11/17 일산 킨텍스에서 열린 박람회(200개 부스·8,000여 명 참석)에 ‘반희담’ 수공예 사업단과 ‘다시, 봄’ 업사이클링 공방 사업단이 홍보·판매 부스를 열었습니다.",
      url: "https://www.kocus.com/news/articleView.html?idxno=442658",
      region: "경기", tag: "지역"
    },
    {
      title: "‘금손하우스’, 공예작가 작업 과정 소개부터 공방 예약까지",
      source: "고시위크", date: "2026-11-18",
      desc: "작가의 작업 과정을 보여주고 공방 예약으로 연결하는 공예 플랫폼입니다.",
      url: "https://www.gosiweek.com/article/1065601386235226",
      region: "전국", tag: "플랫폼"
    },
    {
      title: "구미 금리단길 청년 120명, 공방 9곳에서 원데이 체험",
      source: "경북일보", date: "2026-11-15",
      desc: "‘Hi 구미청년’ 프로그램으로 청년과 지역 공방을 연결합니다.",
      url: "https://www.kyongbuk.co.kr/news/articleView.html?idxno=4090834",
      region: "경북", tag: "지역"
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
    }
  ],

  /* 작가 인터뷰 */
  interviews: [
    {
      person: "지민주", role: "재니들 대표",
      title: "1평 수선 공방에서 로레알·유니클로까지 — ‘비저블 멘딩’",
      quote: "해진 옷만 꿰매는 게 아니라 사람 사이의 틈도 메우는 거죠.",
      desc: "공연기획 20년을 접고 2024년 1평 남짓한 공방으로 창업했습니다. 낡은 흔적을 숨기지 않고 드러내는 ‘비저블 멘딩’으로 로레알·유니클로·무인양품과 협업하고, 유니클로 명동점 수선 워크숍은 60명 모집에 500명 넘게 신청했습니다.",
      source: "한국경제", date: "2026-11-20",
      url: "https://www.hankyung.com/article/2026111982391"
    },
    {
      person: "이정은", role: "전통공예 브랜드 ‘채율’ 대표",
      title: "“한국적 아름다움은 따뜻한 럭셔리”",
      quote: "한국적인 아름다움은 단순히 물성이나 색감에서 나오는 것이 아니라 그 안에 담긴 정서에서 비롯된다.",
      desc: "2008년 창업해 칠보·나전·옻칠·자개로 가구와 함, 식기를 만듭니다. 11/12 교보문고 드림홀 북토크에서 18년의 기록을 담은 저서 『채율하다』를 놓고 “전통이 지금의 생활 속에서 사용되고 사랑받아야 다음 세대에도 이어질 수 있다”고 말했습니다.",
      source: "에너지경제신문", date: "2026-11-14",
      url: "https://www.ekn.kr/web/view.php?key=20261114025369493"
    },
    {
      person: "김한뫼", role: "모이 워치(MOI Watch) 대표",
      title: "사라지는 시계 수리공, 서울의 작은 공방이 다음 세대를 키웁니다",
      quote: "시계를 잘 고치려면 먼저 시계를 망쳐 봐야 하고, 실패를 두려워하지 말아야 한다.",
      desc: "2009년부터 성인 수강생을 가르쳐 2016년 아카데미를 열었습니다. 국내에서 정기적으로 시계 수리를 가르치는 곳은 자기 공방 포함 두 곳뿐, 한 번에 1~3명씩 3개월 단위로 가르치고 숙련까지 10년이 걸린다고 말합니다.",
      source: "캐어유뉴스", date: "2026-11-19",
      url: "https://www.careyounews.org/news/articleView.html?idxno=12567"
    },
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
