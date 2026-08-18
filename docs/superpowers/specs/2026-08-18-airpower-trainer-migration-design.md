# Air Power Trainer 이전 및 GitHub Pages 배포 설계

날짜: 2026-08-18

## 배경

`air-power-trainer` 웹앱이 Obsidian vault 안(`/Users/daso/Obsidian/obsidian-repo/위키/보드게임/번역/data/air_power/`)에 있다.
이를 `ADC_list` 저장소(`konsent/adc`, GitHub Pages)로 옮겨 배포하고, 앞으로 이쪽을 정본으로 삼는다.

단순 복사로는 배포가 동작하지 않는다. 원인은 아래 진단 절에 정리한다.

## 진단: 단순 복사가 실패하는 이유

1. **Jekyll이 켜져 있다.** Pages 설정이 `build_type: "legacy"`(Jekyll)인데 저장소에 `.nojekyll`이 없다.
   Jekyll은 `_` 시작 경로를 무시하고 특수문자 파일명 처리에서 문제를 일으킨다.

2. **에셋 파일명에 공백·`+`·`.`이 있는데 URL 인코딩이 없다.**
   `ui/hexmap.js`가 `` `./assets/${AIRCRAFT_COUNTERS[id]}` ``로 이미지를 참조하는데,
   값이 `F-4F+ I.C.E. Phantom II.jpg` 같은 형태다.
   로컬 `python3 -m http.server`는 통과시키지만 Pages CDN에서는 `+`가 스페이스로 디코딩되어 404가 난다.

3. **macOS는 대소문자를 무시하지만 Pages 서버는 구분한다.**
   `'MIG-29'` → `'MiG-29 Fulcrum A.jpg'`처럼 키와 파일명의 대소문자가 다른 항목이 많아,
   이전 중 한 글자만 어긋나도 로컬에서는 멀쩡하고 배포에서만 깨진다.

4. **`ruleset/`·`scenario/`는 앱이 읽지 않는다.** 코드에 `fetch`도 동적 `import`도 없다.
   순수 참고용 `.md` 문서다.

## 결정

### 파일 배치

```
airpower/
├── index.html          새 shell (탭 + 분할)
├── adc.html            기존 index.html을 이동 (ADC 뷰어)
├── adc/                기존 유지
├── trainer/            air-power-trainer에서 복사
│   ├── index.html
│   ├── data/ engine/ rules/ ui/
│   └── assets/         파일명 슬러그화
├── ruleset/            .md 3개 (참조용, 웹 비노출)
└── scenario/           .md 3개 (참조용, 웹 비노출)
```

- 폴더명은 `air-power-trainer` → `trainer`. URL이 `airpower/air-power-trainer/`가 되면 중복이라 줄인다.
- `test/`, `package.json`, `README.md`는 제외한다. 배포에 불필요하고 원본에 남아 있다.
- `ruleset/`·`scenario/`는 저장소에 파일로만 둔다. 개선 작업 시 경로로 참조하는 용도이며 웹 UI에 노출하지 않는다.

### 에셋 슬러그화 (Approach A)

`assets/` 33개 전부를 공백·`+`·대문자 없는 이름으로 rename하고
`ui/hexmap.js`의 `AIRCRAFT_COUNTERS` 9개 항목을 새 이름에 맞춘다.

```
'F-4F+ I.C.E. Phantom II.jpg'  →  f-4f-ice-phantom-ii.jpg
'MiG-29 Fulcrum A.jpg'         →  mig-29-fulcrum-a.jpg
'Su-17 Fittter.jpg'            →  su-17-fitter.jpg        (오타 정리)
```

매핑에 걸린 9개만 옮기지 않고 33개 전부 옮긴다. 총 132KB이고, 나중에 기체를 추가할 때 원본을 다시 뒤질 일이 없어진다.

원본과 파일명이 갈라지지만, 앞으로 `ADC_list` 쪽이 정본이므로 문제되지 않는다.

### `.nojekyll`

저장소 루트에 빈 파일로 추가한다. Pages가 legacy(Jekyll) 빌드이므로 필수다.

### 탭 shell

`eots/index.html` 패턴을 따르되 세 번째 모드를 더한다.

```
[← Back]  AIR SUPERIORITY   [트레이너] [ADC] [나란히]
```

- **트레이너**(기본) / **ADC**: iframe 두 개를 겹쳐 두고 `hidden`으로 전환.
- **나란히**: 좌우 50:50 분할. 분할 시 두 iframe 모두 표시하고 `position:absolute` 대신 flex 레이아웃으로 전환한다.
- 모바일(≤760px)에서는 "나란히" 버튼을 숨긴다. 화면이 좁아 의미가 없다.
- 상태는 `location.hash`에 저장한다 (`#trainer`, `#adc`, `#split`). 새로고침·뒤로가기에도 유지된다.

**중요 — `display:none` 금지.** `eots/index.html`의 주석에 기록된 함정이다.
숨긴 iframe을 `display:none`이나 화면 밖 이동으로 처리하면 내부 앱의 `100vh` 레이아웃이
0 또는 잘못된 값으로 굳어 빈 화면이 된다. 크기·위치는 유지한 채 `opacity`와 `z-index`로만 전환한다.
트레이너가 `100vh` 기반 고정 레이아웃(`body { height:100vh; overflow:hidden }`)이라 특히 중요하다.

색상은 현재 `airpower/index.html`의 테마를 이어받는다 (`#d94a3a` 레드, `#1e3a52` 스카이블루 계열).

### 메인 index.html

`href="airpower/index.html"` 그대로 둔다. 새 shell이 그 자리에 들어가므로 카드 동작이 자연스럽게 바뀐다.

## 검증

1. 로컬 `python3 -m http.server`로 세 모드(트레이너/ADC/나란히) 확인.
2. 트레이너 카운터 이미지 9종이 실제로 로드되는지 확인 (404 없음).
3. 커밋·푸시 후 `https://konsent.github.io/adc/airpower/`에서 재확인.

## 범위 밖

- `test/` 이전 및 CI 워크플로 구성. 원본에 남아 있고, 필요해지면 별도로 다룬다.
- `ruleset/`·`scenario/`의 웹 노출.
- 트레이너 앱 자체의 기능 개선.
