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

## 파일

```
index.html                한 페이지, 6개 탭(해시 라우팅)
assets/styles.css         디자인 토큰과 전체 레이아웃
assets/app.js             렌더링·검색·필터·지도
assets/data.js            이번 주 소식·공방·정보 데이터 (여기만 고치면 됩니다)
assets/archive.js         뉴스레터 아카이브 2024–2026 (8개 호, 151건) 데이터
assets/korea-paths.js     시·도 경계 SVG 좌표 (KOSTAT 2013 단순화 데이터)
assets/hero-*.webp|jpg    대표 이미지
admin.html                관리자 페이지(로그인 게이트 + 회원·찜·등록 현황 대시보드, noindex)
assets/admin.js           관리자 로직(Supabase 세션·is_admin·시트/D-day 집계)
assets/admin.css          관리자 화면 전용 레이아웃(모바일 카드형 표 포함)
```

## 관리자 페이지

- 주소: https://craftstorekorea.github.io/admin.html (푸터 "더 보기 → 관리자")
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
