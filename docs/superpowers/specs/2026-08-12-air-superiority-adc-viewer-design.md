# Air Superiority ADC 뷰어 설계

날짜: 2026-08-12

## 목적

Air Superiority(GDW, 현대 제트 공중전)의 항공기 ADC 29장을 한 화면에서 골라 볼 수
있게 한다. 메인화면에 게임 카드를 추가하고, 카드를 누르면 좌측 기체 목록 · 우측
ADC 시트인 뷰어로 들어간다.

## 현재 상태

`airpower/adc/`에 이미 자산이 전부 있다.

- `page-01-*.html` ~ `page-29-*.html` — 29개 스텁. 각각 250바이트로,
  `window.ADC_PAGE=N`을 설정하고 `data.js`와 `app.js`를 불러온다.
- `assets/data.js` — 29개 기체 데이터 전부. `window.ADC_PAGES` 배열을 만들고
  push와 `Object.assign` 패치로 채운다.
- `assets/app.js` — `ADC_PAGES[ADC_PAGE]`를 읽어 `document.body`에 시트를 그린다.
- `assets/styles.css`, `hero-page-*.png` — 시트 스타일과 도판.
- `air-superiority_thumb.png` — 박스아트 썸네일.

각 페이지는 단독으로 열어도 완결된다.

### 파일명이 기체와 어긋나 있다

파일명을 라벨의 근거로 쓸 수 없다. `page-18-mirage-iiie.html`은 `ADC_PAGE=17`,
즉 실제 내용은 **BAC Lightning F6**이다. 그 뒤 Mirage 계열 파일명이 한 칸씩
밀려 있다. 정본은 `data.js`의 `title` 필드다.

## 설계

### 1. 뷰어 — `airpower/index.html` 단일 파일 신규

좌측 사이드바 + 우측 iframe 2단 레이아웃.

- 기존 29개 `page-*.html`은 **수정하지 않는다**. iframe의 `src`만 교체한다.
- `app.js` / `styles.css` / `data.js`도 수정하지 않는다. 새 렌더링 코드는 없다.
- 단독 열람 경로(`page-07-f14a-tomcat.html` 직접 열기)는 계속 동작한다.

### 2. 기체 목록은 런타임에 `data.js`에서 읽는다

뷰어가 `assets/data.js`를 `<script>`로 로드해 `window.ADC_PAGES`를 얻는다.

- 라벨: `ADC_PAGES[i].title`
- 링크 대상: 인덱스 `i`에 대응하는 `page-*.html` 파일명

인덱스 → 파일명 매핑은 뷰어 안에 파일명 배열 하나로 둔다. 파일명은 zero-padded
페이지 번호 순(`page-01` … `page-29`)으로 정렬된 순서가 곧 `ADC_PAGE` 0..28에
대응한다.

목록을 하드코딩하지 않는 이유는 두 가지다. 파일명이 기체와 어긋나 있어 파일명
기반 라벨은 전부 틀리고, `data.js`에 기체가 추가되면 목록이 자동으로 따라온다.

### 3. 진영 그룹

`data.js` 순서가 이미 진영별로 묶여 있으므로 인덱스 구간으로 자른다.

| 그룹 | 인덱스 | 기체 |
|---|---|---|
| US | 0–13 | F-4 계열 ~ F-19A Stealth Fighter |
| Europe | 14–20 | Saab F-35 Draken ~ Mirage 2000 |
| Soviet | 21–28 | Mig-23 Flogger G ~ SU-27 Flanker A |

### 4. 상태는 URL 해시로

`airpower/index.html#7` 형태로 현재 인덱스를 담는다. 새로고침해도 유지되고 특정
기체 링크를 공유할 수 있다. 해시가 없거나 범위를 벗어나면 인덱스 0으로 떨어진다.
`hashchange`로 브라우저 뒤로가기도 받는다.

### 5. 메인화면 카드

`index.html`의 `.container`에 Hornet Leader 다음으로 카드를 추가한다. 기존 카드
5개와 같은 마크업 구조를 따른다.

- href: `airpower/index.html`
- 썸네일: `airpower/adc/air-superiority_thumb.png`
- era: `Modern · Jet Air Combat`
- title: `Air Superiority`
- desc: `Modern Jet Air Combat — 현대 제트 공중전 ADC 뷰어`

테마는 sky blue + red accent. 기존 5개(CRT 그린 / 베트남 세피아 / 심해 네이비 /
사막 샌드 / 항모 틸)와 겹치지 않고, 붉은 로고에 하늘색 배경인 박스아트와 맞다.

### 6. 반응형

760px 이하에서 사이드바가 상단 가로 스크롤 칩 줄로 접히고 iframe이 남은 높이를
채운다. 브레이크포인트는 기존 `index.html`과 같은 760px을 쓴다.

## 범위에서 뺀 것

검색창, 즐겨찾기, 다크모드 토글, 인쇄 버튼. 29개는 진영 그룹만 있으면 눈으로
찾힌다. 필요해지면 그때 붙인다.

## 검증

`data.js`를 node로 로드해 다음을 확인한다.

1. `ADC_PAGES.length === 29`
2. 뷰어의 파일명 배열 길이가 29이고, 각 파일이 실제로 존재한다
3. 각 파일의 `window.ADC_PAGE=N`이 배열 인덱스와 일치한다 — 매핑이 어긋나면
   목록에서 고른 기체와 다른 시트가 뜬다. 파일명이 이미 어긋나 있으므로 이
   검사가 핵심이다.
