# Hornet Leader — 테스트 신뢰 회복 및 버그 수정

작성일: 2026-08-03

## 배경

`hornet-leader/`는 보드게임 Hornet Leader의 솔리테어 플레이 헬퍼다. `js/app.js` 6104줄, `css/styles.css` 3278줄, 데이터 JSON 약 15000줄로 구성된다. 진급, 스트레스, SAR, 무장 선택, Improvement 카드, 밴드 진행 등 게임 규칙이 상세히 구현되어 있다.

검토 결과 기능은 완성도가 높으나, 테스트가 실제 코드를 검증하지 않는 상태이며 데이터 손실로 이어질 수 있는 버그가 있다.

## 문제

### 1. 테스트가 실행되지 않는 코드를 검증한다

`js/logic.js`는 12개 함수를 export하고 `js/logic.test.js`의 43개 테스트가 이를 검증한다. 그러나 `index.html`은 `js/app.js`만 로드하며, `app.js`는 같은 함수 12개를 자체적으로 재정의한다. `logic.js`는 런타임에 로드되지 않는다.

`logic.js` 헤더 주석은 "app.js가 globalThis를 통해 이 파일을 로드한다"고 기술하나 사실이 아니다.

두 사본은 이미 갈라졌다:

- `createEmptyTarget`: `app.js:870`은 `achievedHits: 0, jdamPaid: false`를 포함하나 `logic.js:37`은 없다.
- `getBandStatus`: `logic.js`에만 존재한다. `app.js`는 `getBandStatusForCampaign`(`app.js:2214`)에 동일 로직을 인라인으로 갖는다.

결과적으로 43개 테스트는 통과하지만 실제 동작을 보증하지 않는다.

### 2. `localStorage.clear()`가 다른 앱의 데이터를 삭제한다

`app.js:6056`의 "초기화" 버튼이 `localStorage.clear()`를 호출한다. 같은 origin의 형제 앱들이 각자 키를 사용한다:

- `air_armor/tracker.js` — `airArmorTrackerState`
- `downtown/downtown_suite.html` — `downtownGeneratorData`, `oobToAdcData`
- `redstorm/Redstorm_suite.html`

`clear()`는 이들을 모두 삭제한다.

### 3. 저장 실패가 조용히 무시된다

`autoSave()`가 42곳에서 호출되나 `localStorage.setItem`(`app.js:5902`, `5922`, `5969`)에 예외 처리가 없다. 용량 초과나 Safari 프라이빗 모드에서 예외가 발생하면 저장되지 않은 채 진행된다. 같은 저장소의 `downtown/downtown_suite.html:9378`은 이미 try/catch를 적용하고 있다.

### 4. 데이터 로딩에 예외 처리가 없다

`loadGameData()`(`app.js:37`)는 fetch 3개를 await하나 try/catch가 없다. 그중 `../assets/HL/output/armaments.json`은 앱 디렉토리 밖에 있다. 실패 시 빈 화면만 표시된다.

### 5. 테스트를 실행할 수 없다

`npm test`는 권한 오류, `node node_modules/vitest/vitest.mjs run`은 `dist/` 부재로 실패한다. vitest 설치가 손상되었다.

### 6. `node_modules`가 git에 커밋되어 있다

추적 파일 387개 중 371개가 `node_modules`이며 약 37MB다.

## 목표

테스트가 실제 실행되는 코드를 검증하게 만들고, 데이터 손실 경로를 차단한다.

구조 개선(`app.js` 분리)은 이번 범위가 아니다. 안전망을 먼저 확보한 뒤 별도로 다룬다.

## 설계

### 1. ES 모듈 전환

`index.html`의 스크립트 태그를 변경한다:

```html
<script type="module" src="js/app.js"></script>
```

새로운 제약은 없다. `app.js`가 이미 `fetch()`로 JSON을 읽으므로 `file://`에서는 원래 동작하지 않았고 HTTP 서버가 이미 전제 조건이다.

모듈 스코프는 전역이 아니므로, 인라인 이벤트 핸들러가 참조하는 함수 4개를 명시적으로 노출한다:

```js
Object.assign(window, { loadCampaign, deleteCampaign, closeCampaignFailModal, closeEvadeModal });
```

참조 위치:

- `index.html:222` — `onclick="closeCampaignFailModal()"`
- `index.html:296` — `onclick="closeEvadeModal()"`
- `app.js:5997` — 템플릿 문자열 내 `onclick="loadCampaign(...)"`
- `app.js:5998` — 템플릿 문자열 내 `onclick="deleteCampaign(...)"`

이 노출이 없으면 네 곳이 조용히 동작하지 않는다.

### 2. 중복 제거 — `logic.js`를 유일한 정본으로

`app.js`의 중복 정의 12개를 삭제하고 `logic.js`에서 import한다. `logic.js`의 순수 함수 시그니처를 정본으로 삼는다.

**시그니처가 다른 함수 (호출부 수정 필요, 총 23곳)**

| 함수 | 변경 | 호출부 |
|---|---|---|
| `getStatus(p)` | `getStatus(p, gameData.Pilots)` | 12곳 (app.js 1362, 1502, 1706, 1773, 1853, 2571, 2707, 5220, 5235, 5603, 5613, 5620) |
| `getPilotRankStats(p)` | `(p, gameData.Pilots)` | 4곳 (671, 680, 685, 698) |
| `getXpToPromote(p)` | `(p, gameData.Pilots)` | 2곳 (720, 1854) |
| `getMaxStress(p)` | `(p, gameData.Pilots)` | 2곳 (1855, 2712) |
| `recoverPilots(filter)` | `(campaign.squadron, filter)` | 3곳 (5204, 5229, 5612) |

**시그니처가 같은 함수 (삭제만, 호출부 변경 없음)**

`parseCampaign`, `formatSOCost`, `applySOAdjust`, `createEmptyTarget`, `getNextRank`, `isUSMC`, 그리고 상수 `RANKS`, `SO_ADJUST`.

**갈라진 부분 정리**

실제 동작하는 `app.js` 쪽이 정답이므로 `logic.js`를 이에 맞춘다:

- `logic.js`의 `createEmptyTarget`에 `achievedHits: 0, jdamPaid: false`를 추가한다.
- `app.js`의 `getBandStatusForCampaign`이 인라인 로직 대신 `logic.js`의 `getBandStatus(bands, destroyed)`를 호출하도록 변경한다.

`logic.js` 헤더의 잘못된 주석을 사실에 맞게 고친다.

### 3. 버그 수정

- `app.js:6056` — `localStorage.clear()`를 `localStorage.removeItem(STORAGE_KEY)`로 교체한다.
- `app.js:5902`, `5922`, `5969` — `setItem`을 try/catch로 감싸고, 실패 시 사용자에게 알린다. 조용한 실패는 사용자가 저장되었다고 믿게 만드는 데이터 손실 경로이므로 알림이 필요하다.
- `app.js:37` — `loadGameData()`를 try/catch로 감싸고 실패 시 화면에 메시지를 표시한다.
- vitest 재설치: `node_modules` 삭제 후 `npm install`.

### 4. `node_modules` 추적 해제

`.gitignore`에 `node_modules/`를 추가하고 `git rm -r --cached hornet-leader/node_modules`를 실행한다.

git 히스토리는 재작성하지 않는다. 저장소 용량 자체는 줄지 않으며, 이는 위험도가 다른 별개 작업이다.

## 커밋 분리

중복 제거(설계 1·2)와 버그 수정(설계 3)은 서로 독립적이므로 커밋을 분리한다. 중복 제거가 회귀를 일으킬 경우 버그 수정과 섞이지 않은 상태로 되돌릴 수 있어야 한다.

`node_modules` 추적 해제(설계 4)도 별도 커밋으로 둔다.

## 검증

**자동 검증** — 각 단계 후 `npm test`로 43개 테스트 통과를 확인한다.

**수동 검증** — 테스트만으로는 부족하다. 이번 변경의 핵심 위험은 모듈 전환에 따른 런타임 초기화 실패인데, 테스트는 DOM과 모듈 로딩을 거치지 않는다. 로컬 HTTP 서버로 앱을 띄우고 다음 경로를 직접 확인한다:

1. 캠페인 생성 (난이도/시나리오/소속 선택 → 랜덤 비행대)
2. 표적 카드 뽑기
3. 저장
4. 새 캠페인으로 나갔다가 불러오기
5. 브라우저 콘솔에 오류가 없을 것

특히 4번은 `loadCampaign`/`deleteCampaign`의 전역 노출을 검증하는 경로다.

## 범위 밖

- `app.js` 구조 분리 (렌더링/규칙/영속화). 안전망 확보 후 별도 작업.
- git 히스토리 재작성.
- CSS 정리, 접근성 개선.
