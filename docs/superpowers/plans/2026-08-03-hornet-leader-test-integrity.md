# Hornet Leader 테스트 신뢰 회복 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `js/logic.js`를 런타임에 실제로 로드되는 유일한 정본으로 만들어 43개 테스트가 실제 동작 코드를 검증하게 하고, 데이터 손실 버그 4건을 수정한다.

**Architecture:** `index.html`을 ES 모듈로 전환하고 `app.js`가 `logic.js`를 import하도록 바꾼다. `app.js`에 중복 정의된 12개 함수를 삭제하고, 전역(`gameData`, `campaign`)에 의존하던 5개 함수의 호출부 23곳에 인자를 명시적으로 넘긴다. 모듈 스코프는 전역이 아니므로 인라인 `onclick`이 참조하는 함수 4개는 `window`에 노출한다.

**Tech Stack:** 순수 JavaScript (프레임워크 없음), ES 모듈, vitest 4.x

## Global Constraints

- 대상 디렉토리는 `hornet-leader/`. 다른 형제 앱(`downtown/`, `redstorm/`, `air_armor/`, `legacy/`)은 건드리지 않는다.
- `app.js` 구조 분리(렌더링/규칙/영속화)는 이번 범위 밖이다. 안전망 확보가 목적이다.
- git 히스토리는 재작성하지 않는다.
- 테스트 실행 명령은 `npm test` (= `vitest run`). 작업 디렉토리는 `hornet-leader/`.
- 커밋 메시지는 한국어로 작성하고 다음 트레일러로 끝낸다:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 중복 제거(Task 2~4)와 버그 수정(Task 5)은 커밋을 분리한다. 회귀 시 독립적으로 되돌릴 수 있어야 한다.

---

### Task 1: vitest 재설치 및 node_modules 추적 해제

현재 `npm test`는 권한 오류로, `node node_modules/vitest/vitest.mjs run`은 `dist/` 부재로 실패한다. 이후 모든 Task가 테스트 실행에 의존하므로 가장 먼저 복구한다. `node_modules`가 git에 커밋되어 있어(추적 파일 387개 중 371개, 약 37MB) 재설치 시 거대한 diff가 생기므로, 추적 해제를 같은 Task에서 처리한다.

**Files:**
- Modify: `.gitignore` (저장소 루트)
- Delete from index: `hornet-leader/node_modules/` (파일 자체는 유지)

**Interfaces:**
- Consumes: 없음
- Produces: 동작하는 `npm test` 명령. 이후 모든 Task가 이에 의존한다.

- [ ] **Step 1: node_modules를 git 추적에서 해제**

`.gitignore`(저장소 루트)에 다음 줄을 추가한다. 기존 내용은 유지한다:

```
node_modules/
```

그리고 인덱스에서만 제거한다 (`--cached`이므로 디스크의 파일은 남는다):

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git rm -r --cached hornet-leader/node_modules --quiet
```

- [ ] **Step 2: 추적 해제 확인**

```bash
git -C "/Users/daso/1/1영상/브이컬러링/ADC_list" ls-files hornet-leader | wc -l
```

Expected: `16` (기존 387에서 node_modules 371개가 빠진 수)

- [ ] **Step 3: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: node_modules를 git 추적에서 해제

추적 파일 387개 중 371개가 node_modules였다.
히스토리는 재작성하지 않으므로 저장소 용량 자체는 줄지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: vitest 재설치**

기존 설치가 손상되어 있으므로 지우고 다시 받는다. **이 단계는 네트워크를 사용한다.**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 5: 테스트가 실행되는지 확인**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
npm test
```

Expected: 43개 테스트 전부 PASS.

이 시점의 통과는 아직 **사본**을 검증한 결과다. Task 2~4를 마쳐야 실제 코드를 검증하게 된다.

- [ ] **Step 6: package-lock.json 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add hornet-leader/package-lock.json
git commit -m "$(cat <<'EOF'
chore: 손상된 vitest 설치 복구

dist/ 디렉토리가 없어 테스트를 실행할 수 없었다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: logic.js를 app.js의 실제 동작에 맞춰 정정

두 사본이 갈라진 부분을 먼저 해소한다. **실제 동작하는 `app.js` 쪽이 정답**이므로 `logic.js`를 거기에 맞춘다. 이 Task를 먼저 해야 Task 3에서 import로 바꿔도 동작이 변하지 않는다.

**Files:**
- Modify: `hornet-leader/js/logic.js:1-2` (잘못된 주석), `:36-38` (`createEmptyTarget`)
- Test: `hornet-leader/js/logic.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createEmptyTarget()` — `{ targetNumber, dayNight, vp, recon, intel, infra, baseStress, assignedPilots, result, resolved, achievedHits, jdamPaid }` 12개 필드를 가진 객체를 반환한다. Task 3에서 `app.js`가 이 함수를 import해 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`hornet-leader/js/logic.test.js`에서 `createEmptyTarget`을 다루는 기존 `describe` 블록을 찾는다. 없으면 파일 끝에 추가한다. 다음 테스트를 추가한다:

```js
describe('createEmptyTarget', () => {
    it('app.js가 사용하는 achievedHits와 jdamPaid 필드를 포함한다', () => {
        const t = createEmptyTarget();
        expect(t.achievedHits).toBe(0);
        expect(t.jdamPaid).toBe(false);
    });
});
```

`createEmptyTarget`이 파일 상단 import 목록에 없으면 추가한다.

- [ ] **Step 2: 실패 확인**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
npm test
```

Expected: FAIL — `expected undefined to be 0`. 두 사본이 갈라져 있다는 증거다.

- [ ] **Step 3: logic.js 수정**

`hornet-leader/js/logic.js`의 `createEmptyTarget`을 `app.js:870-872`와 동일하게 만든다:

```js
function createEmptyTarget() {
    return { targetNumber: '', dayNight: 'Day', vp: '', recon: '', intel: '', infra: '', baseStress: '', assignedPilots: [], result: '', resolved: false, achievedHits: 0, jdamPaid: false };
}
```

같은 파일 1-2행의 사실과 다른 주석을 교체한다. 기존:

```js
// Pure logic functions extracted from app.js for testability.
// These are also loaded by app.js at runtime (via globalThis).
```

새 내용:

```js
// 게임 규칙 순수 함수. app.js가 ES 모듈로 import하는 유일한 정본이다.
// 여기의 함수를 app.js에 다시 정의하지 말 것 — 사본이 갈라지면
// 테스트가 실행되지 않는 코드를 검증하게 된다.
```

- [ ] **Step 4: 통과 확인**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
npm test
```

Expected: 44개 테스트 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add hornet-leader/js/logic.js hornet-leader/js/logic.test.js
git commit -m "$(cat <<'EOF'
fix: logic.js의 createEmptyTarget을 app.js 동작에 맞춤

app.js는 achievedHits와 jdamPaid를 포함하나 logic.js 사본에는
없어, 테스트가 실제와 다른 객체를 검증하고 있었다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: ES 모듈 전환 및 전역 노출

`app.js`가 `logic.js`를 import하려면 모듈이어야 한다. 새 제약은 없다 — `app.js`는 이미 `fetch()`로 JSON 3개를 읽으므로 `file://`에서는 원래 동작하지 않았고 HTTP 서버가 이미 전제다.

**핵심 위험:** 모듈 스코프는 전역이 아니다. 인라인 `onclick`이 참조하는 함수 4개를 `window`에 노출하지 않으면 **조용히** 동작하지 않는다.

**Files:**
- Modify: `hornet-leader/index.html:301` (script 태그)
- Modify: `hornet-leader/js/app.js` (끝부분에 window 노출 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `window.loadCampaign`, `window.deleteCampaign`, `window.closeCampaignFailModal`, `window.closeEvadeModal` — 인라인 핸들러가 참조하는 4개 함수.

- [ ] **Step 1: script 태그를 모듈로 변경**

`hornet-leader/index.html:301`:

```html
    <script type="module" src="js/app.js"></script>
```

- [ ] **Step 2: 전역 노출 추가**

`hornet-leader/js/app.js` **맨 끝**에 다음을 추가한다. 함수 선언은 호이스팅되므로 파일 끝에서도 안전하다:

```js
// ─── 인라인 onclick 핸들러용 전역 노출 ───
// 모듈 스코프는 전역이 아니다. 아래 4개는 HTML/템플릿 문자열의
// onclick 속성에서 참조하므로 window에 명시적으로 붙여야 한다.
//   index.html:222 closeCampaignFailModal, index.html:296 closeEvadeModal
//   app.js loadSavedCampaignList() 템플릿의 loadCampaign, deleteCampaign
Object.assign(window, {
    loadCampaign,
    deleteCampaign,
    closeCampaignFailModal,
    closeEvadeModal,
});
```

- [ ] **Step 3: 브라우저에서 로딩 확인**

정적 서버를 띄운다 (`fetch` 때문에 `file://`은 불가):

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
python3 -m http.server 8765
```

브라우저에서 `http://localhost:8765/hornet-leader/index.html`을 연다.

Expected:
- 콘솔에 오류가 없다
- 난이도 드롭다운에 항목이 채워져 있다 (`loadGameData` → `initSetupScreen` 성공 증거)

콘솔에 `Cannot use import statement outside a module`이나 CORS 오류가 뜨면 Step 1이 반영되지 않은 것이다.

- [ ] **Step 4: 전역 노출 확인**

브라우저 콘솔에서:

```js
[window.loadCampaign, window.deleteCampaign, window.closeCampaignFailModal, window.closeEvadeModal].map(f => typeof f)
```

Expected: `['function', 'function', 'function', 'function']`

하나라도 `'undefined'`면 Step 2가 누락되었거나 해당 함수 이름이 틀렸다.

- [ ] **Step 5: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add hornet-leader/index.html hornet-leader/js/app.js
git commit -m "$(cat <<'EOF'
refactor: app.js를 ES 모듈로 전환

logic.js를 import하기 위한 준비. app.js는 이미 fetch를 쓰므로
HTTP 서버가 이미 전제였고 새 제약은 없다.

모듈 스코프는 전역이 아니므로 인라인 onclick이 참조하는
함수 4개를 window에 노출한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 중복 12개 제거 — logic.js를 유일한 정본으로

이 계획의 핵심이다. `app.js`의 중복 정의를 삭제하고 import로 대체하며, 전역에 의존하던 함수의 호출부에 인자를 넘긴다.

**Files:**
- Modify: `hornet-leader/js/app.js` — 상단에 import 추가, 12개 함수 정의 삭제, 호출부 23곳 수정
- Modify: `hornet-leader/js/logic.js` — `getBandStatus` export 확인 (이미 export됨)

**Interfaces:**
- Consumes (Task 2에서 정정된 `logic.js`):
  - `RANKS: string[]`, `SO_ADJUST: number[]`
  - `parseCampaign(c: {Name: string}) -> {region: string, force: string}`
  - `formatSOCost(cost: number, mode?: 'html'|'label') -> string`
  - `applySOAdjust(totalSO: number, diffRules: object, lengthIdx: number) -> number`
  - `createEmptyTarget() -> object`
  - `getNextRank(rank: string) -> string|null`
  - `getPilotRankStats(pilot, pilots) -> {pd, stats}|null`
  - `getStatus(pilot, pilots) -> 'Okay'|'Shaken'|'Unfit'`
  - `getXpToPromote(pilot, pilots) -> number|null`
  - `getMaxStress(pilot, pilots) -> number|'?'`
  - `recoverPilots(squadron, filter?) -> void`
  - `isUSMC(campaignOrName) -> boolean`
  - `getBandStatus(bands, destroyed: Set<string>) -> Array<{band, secured, destroyedCount, total, targetNumbers}>`
- Produces: 중복 없는 `app.js`.

- [ ] **Step 1: import 문 추가**

`hornet-leader/js/app.js` **맨 위**(`// Hornet Leader Campaign Log App` 주석 바로 아래)에 추가한다:

```js
import {
    RANKS, SO_ADJUST,
    parseCampaign, formatSOCost, applySOAdjust, createEmptyTarget,
    getNextRank, getPilotRankStats, getStatus, getXpToPromote, getMaxStress,
    recoverPilots, isUSMC, getBandStatus
} from './logic.js';
```

- [ ] **Step 2: 중복 정의 삭제**

`app.js`에서 아래 정의를 **전부 삭제**한다. 삭제 후 줄 번호가 밀리므로 **아래에서 위 순서로** 작업하거나, 매번 이름으로 다시 찾는다:

| 함수/상수 | 위치 (수정 전 기준) |
|---|---|
| `RANKS` 상수 | `app.js:8` |
| `SO_ADJUST` 상수 | `app.js:356` |
| `parseCampaign` | `app.js:57-66` |
| `formatSOCost` | `app.js:451-460` |
| `getPilotRankStats` | `app.js:663-668` |
| `getStatus` | `app.js:670-677` |
| `getXpToPromote` | `app.js:679-682` |
| `getMaxStress` | `app.js:684-687` |
| `getNextRank` | `app.js:689-693` |
| `recoverPilots` | `app.js:829-835` |
| `applySOAdjust` | `app.js:864-868` |
| `createEmptyTarget` | `app.js:870-872` |
| `isUSMC` | `app.js:904-909` |

`RANK_CLASSES`(app.js:9-12)는 `logic.js`에 없으므로 **삭제하지 않는다**.

Step 3~4의 `perl` 일괄 치환이 안전함은 확인했다 — 해당 4개 함수의 호출부 인자가 모두 단순 식별자(`pilot`, `p`, `simPilot` 등)라 정규식 `\(\w+\)`가 전부 매치한다.

- [ ] **Step 3: 인자가 필요한 호출부 수정 — getStatus (12곳)**

`getStatus(x)` → `getStatus(x, gameData.Pilots)`. 대상 줄 (수정 전 기준): 1362, 1502, 1706, 1773, 1853, 2571, 2707, 5220, 5235, 5603, 5613, 5620.

일괄 치환이 안전하다. 정의부를 이미 지웠으므로 남은 것은 전부 호출부다:

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
perl -pi -e 's/\bgetStatus\((\w+)\)/getStatus($1, gameData.Pilots)/g' js/app.js
```

치환 후 확인 — 12곳 전부 바뀌었고 인자 없는 호출이 남지 않아야 한다:

```bash
grep -c "getStatus(.*, gameData.Pilots)" js/app.js   # Expected: 12
grep -n "getStatus(\w*)" js/app.js                    # Expected: 출력 없음
```

- [ ] **Step 4: 나머지 호출부 수정 (11곳)**

`getXpToPromote` (2곳: 720, 1854), `getMaxStress` (2곳: 1855, 2712), `getPilotRankStats` (1곳: 698, `updatePilotForRank` 내부):

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
perl -pi -e 's/\bgetXpToPromote\((\w+)\)/getXpToPromote($1, gameData.Pilots)/g' js/app.js
perl -pi -e 's/\bgetMaxStress\((\w+)\)/getMaxStress($1, gameData.Pilots)/g' js/app.js
perl -pi -e 's/\bgetPilotRankStats\((\w+)\)/getPilotRankStats($1, gameData.Pilots)/g' js/app.js
```

`recoverPilots` 3곳은 첫 인자가 `campaign.squadron`이므로 수동으로 고친다:

- `app.js:5204` — `recoverPilots();` → `recoverPilots(campaign.squadron);`
- `app.js:5229` — `recoverPilots();` → `recoverPilots(campaign.squadron);`
- `app.js:5612` — 다음과 같이 바꾼다:

```js
    recoverPilots(campaign.squadron, (pilot, idx) =>
        !assignedIndices.has(idx) && getStatus(pilot, gameData.Pilots) !== 'Unfit'
    );
```

- [ ] **Step 5: getBandStatusForCampaign이 logic.js를 쓰도록 변경**

`app.js:2214`의 `getBandStatusForCampaign`은 `logic.js`의 `getBandStatus`와 동일한 로직을 인라인으로 갖고 있다. 다음으로 교체한다:

```js
function getBandStatusForCampaign() {
    const bands = getScenarioBands();
    if (!bands.length) return [];
    return getBandStatus(bands, getDestroyedTargets());
}
```

- [ ] **Step 6: 중복이 남지 않았는지 확인**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
for f in parseCampaign formatSOCost applySOAdjust createEmptyTarget getNextRank \
         getPilotRankStats getStatus getXpToPromote getMaxStress recoverPilots isUSMC; do
  printf "%-22s %s\n" "$f" "$(grep -c "^function $f(" js/app.js)"
done
```

Expected: 전부 `0`. 하나라도 `1`이면 Step 2에서 삭제가 누락된 것이다.

- [ ] **Step 7: 테스트 실행**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
npm test
```

Expected: 44개 전부 PASS.

**이 시점부터 테스트가 실제 실행되는 코드를 검증한다.** 이 계획의 목표가 달성되는 지점이다.

- [ ] **Step 8: 브라우저 수동 검증**

테스트만으로는 부족하다. 테스트는 DOM과 모듈 로딩을 거치지 않으므로, 이번 변경의 핵심 위험(런타임 초기화 실패, `gameData` 미초기화 시점의 호출)을 잡지 못한다.

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
python3 -m http.server 8765
```

`http://localhost:8765/hornet-leader/index.html`에서 다음을 순서대로 확인한다:

1. 난이도 → 시나리오 → 소속 선택. 드롭다운이 연쇄적으로 채워진다.
2. 캠페인 길이 선택 후 "랜덤 비행대" 클릭. 편대 테이블에 조종사가 표시되고 **상태 열이 채워진다** (`getStatus` 검증).
3. 표적 카드 뽑기. 카드가 표시된다.
4. "저장" 클릭.
5. "새 캠페인" → 저장 목록에서 "불러오기" 클릭. 대시보드가 복원된다 (`window.loadCampaign` 검증).
6. 저장 목록에서 "삭제" 클릭. 항목이 사라진다 (`window.deleteCampaign` 검증).
7. 전 과정에서 콘솔에 오류가 없다.

2번에서 상태 열이 비거나 `gameData is not defined`가 나면 Step 3의 치환이 누락된 것이다.

- [ ] **Step 9: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add hornet-leader/js/app.js
git commit -m "$(cat <<'EOF'
refactor: app.js의 중복 함수 12개 제거, logic.js를 정본으로

app.js가 logic.js의 함수 12개를 재정의하고 있어 43개 테스트가
런타임에 로드되지 않는 사본을 검증했다. 이제 app.js가 logic.js를
import하므로 테스트가 실제 동작 코드를 검증한다.

전역(gameData, campaign)에 의존하던 5개 함수는 순수 시그니처를
정본으로 삼고 호출부 23곳에 인자를 넘긴다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 데이터 손실 버그 3건 수정

Task 4와 독립적이므로 커밋을 분리한다.

**Files:**
- Modify: `hornet-leader/js/app.js:6056` (`localStorage.clear`)
- Modify: `hornet-leader/js/app.js:5896-5904`, `5920-5924`, `5953-5977` (`setItem` 예외 처리)
- Modify: `hornet-leader/js/app.js:37-51` (`loadGameData` 예외 처리)

**Interfaces:**
- Consumes: `STORAGE_KEY` (`app.js:5889`, 값 `'hornet_leader_campaigns'`)
- Produces: `persist(saved) -> boolean` — 저장 성공 시 `true`, 실패 시 사용자에게 알리고 `false`.

- [ ] **Step 1: localStorage.clear()를 removeItem으로 교체**

`app.js:6056`. 같은 origin의 형제 앱들이 각자 키를 쓰고 있어(`airArmorTrackerState`, `downtownGeneratorData`, `oobToAdcData`) `clear()`는 이들까지 삭제한다.

기존:

```js
            localStorage.clear();
```

교체:

```js
            localStorage.removeItem(STORAGE_KEY);
```

같은 블록의 `confirm()` 문구도 실제 동작에 맞춘다. 기존 문구는 "모든 저장된 캠페인 데이터를 삭제하고 완전히 초기화합니다"인데, 이제 이 앱의 데이터만 지우므로 그대로 두어도 사실과 어긋나지 않는다. 변경 불필요.

- [ ] **Step 2: 저장 실패 처리 헬퍼 추가**

`app.js`의 `STORAGE_KEY` 정의(`:5889`) 바로 아래에 추가한다:

```js
// 저장 실패(용량 초과, Safari 프라이빗 모드 등)는 조용히 넘어가면
// 사용자가 저장됐다고 믿게 되므로 반드시 알린다.
function persist(saved) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        return true;
    } catch (err) {
        alert('저장에 실패했습니다. 브라우저 저장 공간이 가득 찼거나 ' +
              '프라이빗 모드일 수 있습니다.\n\n' +
              'JSON 내보내기로 백업하세요.\n\n' + err.message);
        return false;
    }
}
```

- [ ] **Step 3: setItem 호출 3곳을 persist로 교체**

세 곳 모두 `localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));` 형태다:

- `app.js:5902` (`saveCampaign` 내부) → `persist(saved);`
- `app.js:5922` (`deleteCampaign` 내부) → `persist(saved);`
- `app.js:5969` (`importCampaignsJSON` 내부) → `persist(saved);`

`importCampaignsJSON`의 경우 저장 실패 시 "불러왔습니다" 알림이 뜨면 모순이므로, 성공했을 때만 알리도록 바꾼다. 기존:

```js
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
            loadSavedCampaignList();
            alert(`${added}개 캠페인을 불러왔습니다.`);
```

교체:

```js
            if (!persist(saved)) return;
            loadSavedCampaignList();
            alert(`${added}개 캠페인을 불러왔습니다.`);
```

- [ ] **Step 4: loadGameData 예외 처리**

`app.js:37-51`. 현재 실패 시 빈 화면만 나온다. `../assets/HL/output/armaments.json`은 앱 디렉토리 밖이라 단독 배포 시 특히 실패하기 쉽다.

기존 함수 본문을 다음으로 교체한다:

```js
async function loadGameData() {
    try {
        const [resp, tResp, aResp] = await Promise.all([
            fetch('hl.json'),
            fetch('hl_target.json'),
            fetch('../assets/HL/output/armaments.json')
        ]);
        for (const r of [resp, tResp, aResp]) {
            if (!r.ok) throw new Error(`${r.url} — HTTP ${r.status}`);
        }
        gameData = await resp.json();
        targetData = await tResp.json();
        armamentData = await aResp.json();
    } catch (err) {
        document.body.innerHTML =
            '<div style="padding:2rem;font-family:sans-serif;color:#c00">' +
            '<h2>데이터를 불러오지 못했습니다</h2>' +
            '<p>이 앱은 HTTP 서버에서 열어야 합니다 (file:// 불가).</p>' +
            '<p>또한 상위 디렉토리의 assets/HL/output/armaments.json이 필요합니다.</p>' +
            `<pre>${err.message}</pre></div>`;
        return;
    }
    // Tag base scenarios before renaming
    gameData.Campaigns.forEach(c => {
        c._isBase = isBaseScenario(c.Name);
    });
    initSetupScreen();
    loadSavedCampaignList();
}
```

`fetch`는 404에도 예외를 던지지 않으므로 `r.ok` 검사가 필요하다.

- [ ] **Step 5: 테스트 실행**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/hornet-leader"
npm test
```

Expected: 44개 전부 PASS. (이 Task는 `logic.js`를 건드리지 않으므로 회귀가 없어야 한다.)

- [ ] **Step 6: 저장 경로 수동 검증**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
python3 -m http.server 8765
```

`http://localhost:8765/hornet-leader/index.html`에서:

1. 캠페인 생성 → 저장 → 불러오기가 정상 동작한다.
2. **형제 앱 데이터 보존 확인.** 콘솔에서 표식을 심는다:
   ```js
   localStorage.setItem('downtownGeneratorData', 'CANARY');
   ```
   그 다음 설정 화면에서 "초기화" 버튼을 누르고 확인한다. 페이지가 리로드된 후 콘솔에서:
   ```js
   localStorage.getItem('downtownGeneratorData')
   ```
   Expected: `'CANARY'` — 여전히 살아 있어야 한다. `null`이면 Step 1이 반영되지 않은 것이다.
3. 캠페인 목록이 비워졌는지 확인한다 (이 앱 데이터는 정상적으로 지워져야 한다).

- [ ] **Step 7: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add hornet-leader/js/app.js
git commit -m "$(cat <<'EOF'
fix: 데이터 손실 버그 3건 수정

- localStorage.clear()가 같은 origin의 형제 앱(downtown, redstorm,
  air_armor) 저장 데이터까지 삭제했다. removeItem으로 교체.
- setItem 실패가 조용히 무시되어 사용자가 저장됐다고 믿을 수 있었다.
  persist() 헬퍼로 감싸고 실패 시 알린다.
- loadGameData가 실패하면 빈 화면만 나왔다. 원인을 화면에 표시한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## 완료 조건

- `npm test` — 44개 PASS, 그리고 이 테스트가 **실제 실행되는 코드**를 검증한다.
- `grep -c "^function getStatus(" hornet-leader/js/app.js` → `0` (중복 없음)
- 브라우저에서 캠페인 생성 → 표적 뽑기 → 저장 → 불러오기 → 삭제 전 과정에 콘솔 오류 없음
- "초기화" 후에도 형제 앱의 localStorage 키가 보존됨
- `git -C . ls-files hornet-leader | wc -l` → `16`
