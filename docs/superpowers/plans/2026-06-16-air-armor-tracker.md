# Air & Armor 포인트 트래커 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Air & Armor 보드게임의 NATO/WP 포인트 트랙(RP, CP, Offmap CP/RP, SAM Strength, CSP, VP)을 클릭/버튼으로 조작하고 localStorage에 저장하는 단일 페이지 웹 앱을 만든다.

**Architecture:** 순수 HTML/CSS/JS (빌드 도구 없음, 기존 `air_armor/index.html`과 동일한 방식). 데이터 정의(`tracker-data.js`)와 렌더링/상태 로직(`tracker.js`)을 분리하고, `tracker.html`이 둘을 로드한다. 상태는 하나의 JSON 객체로 관리하며 변경마다 `localStorage`에 직렬화한다.

**Tech Stack:** Vanilla JS (ES6), CSS 변수(기존 `index.html`의 냉전 테마 팔레트 재사용), localStorage. 서버/빌드 없음.

---

## File Structure

- Create: `air_armor/tracker.html` — 페이지 마크업 + `<style>` (기존 index.html의 CSS 변수 팔레트 재사용) + 진영별 패널 컨테이너
- Create: `air_armor/tracker-data.js` — NATO/WP 진영의 HQ, 트랙, CSP, VP, SAM 정의를 담은 순수 데이터 상수 (no DOM, no logic)
- Create: `air_armor/tracker.js` — 상태 관리(localStorage 로드/저장), DOM 렌더링, 클릭/버튼 핸들러
- Modify: `air_armor/index.html:894` — 헤더에 트래커 페이지로 가는 링크 추가
- Test: `air_armor/tracker.test.html` — 브라우저에서 직접 여는 수동 테스트 하네스 (assert 결과를 화면에 출력하는 간단한 자체 테스트 러너, 별도 테스트 프레임워크 의존성 없음)

## Scope Check

이 기능은 단일 서브시스템(포인트 트래커 하나)이라 분리할 필요 없음.

---

### Task 1: 데이터 모델 정의 (`tracker-data.js`)

**Files:**
- Create: `air_armor/tracker-data.js`

- [ ] **Step 1: 파일 작성**

```javascript
// air_armor/tracker-data.js
const TRACKER_DATA = {
  nato: {
    label: 'NATO',
    hqs: [
      { id: 'us_3rd_inf', name: '3rd Inf Div', nation: 'us', rpMax: 2, cpMax: 2 },
      { id: 'wg_12th_pz', name: '12th Pz Div', nation: 'wg', rpMax: 2, cpMax: 2 },
      { id: 'ca_4cmbg', name: '4CMBG', nation: 'ca', rpMax: 2, cpMax: 2 },
      { id: 'wg_54hsb', name: '54Hsb', nation: 'wg', rpMax: 2, cpMax: 2 },
      { id: 'wg_26ll', name: '26LL', nation: 'wg', rpMax: 2, cpMax: 2 }
    ],
    offmap: { cpMax: 2, rpMax: 2, label: 'VII Corps' },
    nations: [
      { id: 'us', label: 'US' },
      { id: 'wg', label: '서독' },
      { id: 'ca', label: '캐나다' }
    ],
    csTypes: ['mine', 'adm', 'gasPersistent', 'gasNonPersistent', 'airPoint', 'bridge'],
    samMax: 4
  },
  wp: {
    label: 'WP (바르샤바 조약군)',
    hqs: [],
    offmap: { cpMax: 3, rpMax: 2, label: '8th Guards Army' },
    nations: [
      { id: 'wp', label: 'WP' }
    ],
    csTypes: ['mine', 'adm', 'gasPersistent', 'gasNonPersistent', 'airPoint', 'bridge'],
    samMax: 4
  }
};

const CS_TYPE_LABELS = {
  mine: 'Mine',
  adm: 'ADM',
  gasPersistent: 'Gas (지속성)',
  gasNonPersistent: 'Gas (비지속성)',
  airPoint: 'Air Point',
  bridge: 'Bridge'
};
```

- [ ] **Step 2: 브라우저 콘솔에서 데이터 무결성 확인**

`tracker-data.js`만 로드하는 임시 HTML이 아직 없으므로, Node로 문법 검증:

Run: `node --check air_armor/tracker-data.js`
Expected: 출력 없음 (문법 오류 없음)

- [ ] **Step 3: Commit**

```bash
git add air_armor/tracker-data.js
git commit -m "Add tracker data model for NATO/WP HQs, offmap tracks, CSP, SAM"
```

---

### Task 2: 상태 저장/로드 로직 (localStorage)

**Files:**
- Create: `air_armor/tracker.js`
- Test: `air_armor/tracker.test.html`

- [ ] **Step 1: 테스트 하네스 작성**

```html
<!-- air_armor/tracker.test.html -->
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Tracker Tests</title>
<style>
  body { font-family: monospace; background: #111; color: #ddd; padding: 20px; }
  .pass { color: #6a8e48; }
  .fail { color: #c0392b; font-weight: bold; }
</style>
</head>
<body>
<h1>Tracker Unit Tests</h1>
<div id="results"></div>

<script src="tracker-data.js"></script>
<script src="tracker.js"></script>
<script>
const results = document.getElementById('results');
let passCount = 0, failCount = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const line = document.createElement('div');
  line.className = ok ? 'pass' : 'fail';
  line.textContent = (ok ? 'PASS ' : 'FAIL ') + label +
    (ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  results.appendChild(line);
  ok ? passCount++ : failCount++;
}

// --- createDefaultState ---
const state = createDefaultState();
assertEqual(state.nato.hqs.us_3rd_inf.rp, 0, 'default RP is 0');
assertEqual(state.nato.hqs.us_3rd_inf.cp, 0, 'default CP is 0');
assertEqual(state.nato.offmap.cp, 0, 'default offmap CP is 0');
assertEqual(state.nato.cs.us.mine, 0, 'default CSP mine(us) is 0');
assertEqual(state.wp.offmap.rp, 0, 'default WP offmap RP is 0');
assertEqual(state.nato.sam, 1, 'default SAM strength is 1');
assertEqual(state.nato.vp, 0, 'default VP is 0');

// --- saveState / loadState round-trip ---
localStorage.removeItem('airArmorTrackerState');
state.nato.hqs.us_3rd_inf.rp = 2;
saveState(state);
const loaded = loadState();
assertEqual(loaded.nato.hqs.us_3rd_inf.rp, 2, 'loadState restores saved value');

// --- loadState with no prior save returns defaults ---
localStorage.removeItem('airArmorTrackerState');
const fresh = loadState();
assertEqual(fresh.nato.hqs.us_3rd_inf.rp, 0, 'loadState falls back to defaults when empty');

// --- clampCounter ---
assertEqual(clampCounter(-1), 0, 'clampCounter prevents negative');
assertEqual(clampCounter(5), 5, 'clampCounter allows positive');

// --- resetTurnTracks ---
localStorage.removeItem('airArmorTrackerState');
const s2 = createDefaultState();
s2.nato.hqs.us_3rd_inf.rp = 2;
s2.nato.hqs.us_3rd_inf.cp = 1;
s2.nato.offmap.cp = 1;
s2.wp.offmap.rp = 1;
s2.nato.cs.us.mine = 3;
s2.nato.vp = 2;
s2.nato.sam = 3;
resetTurnTracks(s2);
assertEqual(s2.nato.hqs.us_3rd_inf.rp, 0, 'reset zeroes HQ RP');
assertEqual(s2.nato.hqs.us_3rd_inf.cp, 0, 'reset zeroes HQ CP');
assertEqual(s2.nato.offmap.cp, 0, 'reset zeroes offmap CP');
assertEqual(s2.wp.offmap.rp, 0, 'reset zeroes WP offmap RP');
assertEqual(s2.nato.cs.us.mine, 3, 'reset leaves CSP untouched');
assertEqual(s2.nato.vp, 2, 'reset leaves VP untouched');
assertEqual(s2.nato.sam, 3, 'reset leaves SAM untouched');

document.title = `Tracker Tests — ${passCount} pass, ${failCount} fail`;
</script>
</body>
</html>
```

- [ ] **Step 2: 브라우저에서 테스트 실행 확인 (아직 실패해야 함)**

`air_armor/tracker.test.html`을 브라우저로 열기.
Expected: `tracker.js`가 없어서 콘솔 에러(`createDefaultState is not defined` 등) — 즉 FAIL

- [ ] **Step 3: `tracker.js` 최소 구현 작성**

```javascript
// air_armor/tracker.js
const STORAGE_KEY = 'airArmorTrackerState';

function createDefaultState() {
  const state = {};
  for (const factionId of Object.keys(TRACKER_DATA)) {
    const faction = TRACKER_DATA[factionId];
    const hqs = {};
    for (const hq of faction.hqs) {
      hqs[hq.id] = { rp: 0, cp: 0 };
    }
    const cs = {};
    for (const nation of faction.nations) {
      cs[nation.id] = {};
      for (const csType of faction.csTypes) {
        cs[nation.id][csType] = 0;
      }
    }
    state[factionId] = {
      hqs,
      offmap: { cp: 0, rp: 0 },
      cs,
      vp: 0,
      sam: 1
    };
  }
  return state;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return createDefaultState();
  }
}

function clampCounter(value) {
  return Math.max(0, value);
}

function resetTurnTracks(state) {
  for (const factionId of Object.keys(state)) {
    const faction = state[factionId];
    for (const hqId of Object.keys(faction.hqs)) {
      faction.hqs[hqId].rp = 0;
      faction.hqs[hqId].cp = 0;
    }
    faction.offmap.cp = 0;
    faction.offmap.rp = 0;
  }
}
```

- [ ] **Step 4: 브라우저에서 테스트 재실행, 전부 통과 확인**

`air_armor/tracker.test.html`을 새로고침.
Expected: 모든 줄이 `pass`(녹색), 타이틀이 `Tracker Tests — 14 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add air_armor/tracker.js air_armor/tracker.test.html
git commit -m "Add tracker state management with localStorage persistence"
```

---

### Task 3: 트랙 칸 클릭 위젯 렌더링 (RP/CP/Offmap/SAM)

**Files:**
- Modify: `air_armor/tracker.js`
- Modify: `air_armor/tracker.test.html`

- [ ] **Step 1: 실패하는 테스트 추가**

`air_armor/tracker.test.html`의 `</script>` 직전에 추가:

```javascript
// --- renderTrackCells ---
const container = document.createElement('div');
renderTrackCells(container, 2, 1, (newVal) => { container.dataset.clicked = newVal; });
assertEqual(container.querySelectorAll('.track-cell').length, 3, 'renderTrackCells creates max+1 cells');
assertEqual(container.querySelector('.track-cell.active').textContent, '1', 'active cell matches current value');
container.querySelectorAll('.track-cell')[2].click();
assertEqual(container.dataset.clicked, '2', 'clicking a cell invokes callback with that value');
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

`air_armor/tracker.test.html` 새로고침.
Expected: `renderTrackCells is not defined` 에러로 FAIL

- [ ] **Step 3: `renderTrackCells` 구현**

`air_armor/tracker.js` 끝에 추가:

```javascript
function renderTrackCells(container, maxValue, currentValue, onSelect) {
  container.innerHTML = '';
  container.classList.add('track-cells');
  for (let i = 0; i <= maxValue; i++) {
    const cell = document.createElement('button');
    cell.className = 'track-cell' + (i === currentValue ? ' active' : '');
    cell.textContent = String(i);
    cell.addEventListener('click', () => onSelect(i));
    container.appendChild(cell);
  }
}
```

- [ ] **Step 4: 테스트 재실행, 통과 확인**

Expected: 새 3개 테스트 모두 PASS (총 17 pass, 0 fail)

- [ ] **Step 5: Commit**

```bash
git add air_armor/tracker.js air_armor/tracker.test.html
git commit -m "Add click-to-select track cell widget renderer"
```

---

### Task 4: +/- 카운터 위젯 렌더링 (CSP/VP)

**Files:**
- Modify: `air_armor/tracker.js`
- Modify: `air_armor/tracker.test.html`

- [ ] **Step 1: 실패하는 테스트 추가**

`tracker.test.html`에 추가:

```javascript
// --- renderCounter ---
const counterEl = document.createElement('div');
let counterVal = 3;
renderCounter(counterEl, counterVal, (newVal) => { counterVal = newVal; renderCounter(counterEl, counterVal, arguments[2]); });
assertEqual(counterEl.querySelector('.counter-val').textContent, '3', 'renderCounter shows initial value');

const minusBtn = counterEl.querySelectorAll('button')[0];
const plusBtn = counterEl.querySelectorAll('button')[1];
assertEqual(minusBtn.textContent, '−', 'first button is minus');
assertEqual(plusBtn.textContent, '+', 'second button is plus');
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

Expected: `renderCounter is not defined` 에러로 FAIL

- [ ] **Step 3: `renderCounter` 구현**

`air_armor/tracker.js` 끝에 추가:

```javascript
function renderCounter(container, value, onChange) {
  container.innerHTML = '';
  container.classList.add('counter-ctrl');

  const minusBtn = document.createElement('button');
  minusBtn.className = 'counter-btn';
  minusBtn.textContent = '−';
  minusBtn.addEventListener('click', () => onChange(clampCounter(value - 1)));

  const valSpan = document.createElement('span');
  valSpan.className = 'counter-val';
  valSpan.textContent = String(value);

  const plusBtn = document.createElement('button');
  plusBtn.className = 'counter-btn';
  plusBtn.textContent = '+';
  plusBtn.addEventListener('click', () => onChange(value + 1));

  container.appendChild(minusBtn);
  container.appendChild(valSpan);
  container.appendChild(plusBtn);
}
```

- [ ] **Step 4: 테스트 재실행, 통과 확인**

Expected: 새 3개 테스트 모두 PASS (총 20 pass, 0 fail)

- [ ] **Step 5: Commit**

```bash
git add air_armor/tracker.js air_armor/tracker.test.html
git commit -m "Add increment/decrement counter widget renderer"
```

---

### Task 5: 진영 패널 전체 렌더링 + 상태 연결

**Files:**
- Modify: `air_armor/tracker.js`
- Modify: `air_armor/tracker.test.html`

- [ ] **Step 1: 실패하는 테스트 추가**

```javascript
// --- renderFactionPanel ---
localStorage.removeItem('airArmorTrackerState');
const panelState = createDefaultState();
const panelEl = document.createElement('div');
renderFactionPanel(panelEl, 'nato', panelState, () => {});

assertEqual(panelEl.querySelectorAll('.hq-row').length, 5, 'renders one row per NATO HQ');
assertEqual(panelEl.querySelectorAll('.cs-item').length, 3 * 6, 'renders CSP item per nation x csType for NATO');
assertEqual(!!panelEl.querySelector('.offmap-row'), true, 'renders offmap row');
assertEqual(!!panelEl.querySelector('.sam-row'), true, 'renders SAM row');
assertEqual(!!panelEl.querySelector('.vp-row'), true, 'renders VP row');

const wpPanelEl = document.createElement('div');
renderFactionPanel(wpPanelEl, 'wp', panelState, () => {});
assertEqual(wpPanelEl.querySelectorAll('.hq-row').length, 0, 'WP has no HQ rows');
assertEqual(wpPanelEl.querySelectorAll('.cs-item').length, 1 * 6, 'WP CSP is single nation pool');
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

Expected: `renderFactionPanel is not defined` 에러로 FAIL

- [ ] **Step 3: `renderFactionPanel` 구현**

`air_armor/tracker.js` 끝에 추가:

```javascript
function renderFactionPanel(panelEl, factionId, state, onChange) {
  const faction = TRACKER_DATA[factionId];
  const factionState = state[factionId];
  panelEl.innerHTML = '';
  panelEl.classList.add('faction-panel', 'faction-' + factionId);

  const title = document.createElement('h2');
  title.textContent = faction.label;
  panelEl.appendChild(title);

  for (const hq of faction.hqs) {
    const row = document.createElement('div');
    row.className = 'hq-row';

    const name = document.createElement('span');
    name.className = 'hq-name';
    name.textContent = hq.name;
    row.appendChild(name);

    const rpWrap = document.createElement('div');
    rpWrap.className = 'track-wrap';
    rpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'RP' }));
    const rpCells = document.createElement('div');
    renderTrackCells(rpCells, hq.rpMax, factionState.hqs[hq.id].rp, (v) => {
      factionState.hqs[hq.id].rp = v;
      onChange();
    });
    rpWrap.appendChild(rpCells);
    row.appendChild(rpWrap);

    const cpWrap = document.createElement('div');
    cpWrap.className = 'track-wrap';
    cpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'CP' }));
    const cpCells = document.createElement('div');
    renderTrackCells(cpCells, hq.cpMax, factionState.hqs[hq.id].cp, (v) => {
      factionState.hqs[hq.id].cp = v;
      onChange();
    });
    cpWrap.appendChild(cpCells);
    row.appendChild(cpWrap);

    panelEl.appendChild(row);
  }

  const offmapRow = document.createElement('div');
  offmapRow.className = 'offmap-row';
  const offmapTitle = document.createElement('span');
  offmapTitle.className = 'hq-name';
  offmapTitle.textContent = faction.offmap.label + ' (Offmap)';
  offmapRow.appendChild(offmapTitle);

  const offmapCpWrap = document.createElement('div');
  offmapCpWrap.className = 'track-wrap';
  offmapCpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'CP' }));
  const offmapCpCells = document.createElement('div');
  renderTrackCells(offmapCpCells, faction.offmap.cpMax, factionState.offmap.cp, (v) => {
    factionState.offmap.cp = v;
    onChange();
  });
  offmapCpWrap.appendChild(offmapCpCells);
  offmapRow.appendChild(offmapCpWrap);

  const offmapRpWrap = document.createElement('div');
  offmapRpWrap.className = 'track-wrap';
  offmapRpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'RP' }));
  const offmapRpCells = document.createElement('div');
  renderTrackCells(offmapRpCells, faction.offmap.rpMax, factionState.offmap.rp, (v) => {
    factionState.offmap.rp = v;
    onChange();
  });
  offmapRpWrap.appendChild(offmapRpCells);
  offmapRow.appendChild(offmapRpWrap);

  panelEl.appendChild(offmapRow);

  const samRow = document.createElement('div');
  samRow.className = 'sam-row';
  samRow.appendChild(Object.assign(document.createElement('span'), { className: 'hq-name', textContent: 'SAM Strength' }));
  const samCells = document.createElement('div');
  renderTrackCells(samCells, faction.samMax, factionState.sam, (v) => {
    factionState.sam = v;
    onChange();
  });
  samRow.appendChild(samCells);
  panelEl.appendChild(samRow);

  const csSection = document.createElement('div');
  csSection.className = 'cs-section';
  for (const nation of faction.nations) {
    for (const csType of faction.csTypes) {
      const item = document.createElement('div');
      item.className = 'cs-item';
      item.appendChild(Object.assign(document.createElement('span'), {
        className: 'cs-label',
        textContent: CS_TYPE_LABELS[csType] + (faction.nations.length > 1 ? ` (${nation.label})` : '')
      }));
      const counterEl = document.createElement('div');
      renderCounter(counterEl, factionState.cs[nation.id][csType], (v) => {
        factionState.cs[nation.id][csType] = v;
        onChange();
      });
      item.appendChild(counterEl);
      csSection.appendChild(item);
    }
  }
  panelEl.appendChild(csSection);

  const vpRow = document.createElement('div');
  vpRow.className = 'vp-row';
  vpRow.appendChild(Object.assign(document.createElement('span'), { className: 'hq-name', textContent: 'VP' }));
  const vpCounterEl = document.createElement('div');
  renderCounter(vpCounterEl, factionState.vp, (v) => {
    factionState.vp = v;
    onChange();
  });
  vpRow.appendChild(vpCounterEl);
  panelEl.appendChild(vpRow);
}
```

- [ ] **Step 4: 테스트 재실행, 통과 확인**

Expected: 새 7개 테스트 모두 PASS (총 27 pass, 0 fail)

- [ ] **Step 5: Commit**

```bash
git add air_armor/tracker.js air_armor/tracker.test.html
git commit -m "Add full faction panel renderer wiring HQ, offmap, SAM, CSP, VP"
```

---

### Task 6: `tracker.html` 페이지 작성 (마크업 + 스타일 + 부트스트랩)

**Files:**
- Create: `air_armor/tracker.html`
- Modify: `air_armor/tracker.js` (재렌더링/리셋 버튼 연결 추가)

- [ ] **Step 1: `tracker.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AIR & ARMOR — Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;900&family=Share+Tech+Mono&family=Oswald:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg:       #2a2e26;
  --surface:  #343830;
  --surface2: #3c4038;
  --border:   #4e5445;
  --border2:  #606858;
  --text:     #d8dcc4;
  --text-dim: #8a9278;
  --nato:     #d4ae55;
  --wp:       #8b1a1a;
  --wp-bright:#c0392b;
  --green:    #6a8e48;
  --green-lt: #90b860;
  --mono: 'Noto Sans KR', 'Share Tech Mono', sans-serif;
  --title: 'Noto Sans KR', 'Oswald', sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--mono);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
header {
  background: var(--surface);
  border-bottom: 2px solid var(--nato);
  padding: 8px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
header h1 {
  font-family: var(--title);
  font-size: 1.1rem;
  color: var(--nato);
  letter-spacing: 4px;
  font-weight: 700;
  text-transform: uppercase;
}
header a { color: var(--green-lt); text-decoration: none; font-size: 0.8rem; }
header a:hover { color: var(--nato); }
#reset-turn-btn {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text);
  font-family: var(--mono);
  padding: 6px 14px;
  cursor: pointer;
}
#reset-turn-btn:hover { border-color: var(--nato); color: var(--nato); }

main {
  display: flex;
  gap: 16px;
  padding: 16px;
}
.faction-panel {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 12px;
}
.faction-nato { border-top: 3px solid var(--nato); }
.faction-wp { border-top: 3px solid var(--wp); }
.faction-panel h2 { font-family: var(--title); margin-bottom: 10px; }
.faction-nato h2 { color: var(--nato); }
.faction-wp h2 { color: var(--wp-bright); }

.hq-row, .offmap-row, .sam-row, .vp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--surface2);
  flex-wrap: wrap;
}
.hq-name { min-width: 120px; font-weight: 600; }
.track-wrap { display: flex; align-items: center; gap: 6px; }
.track-wrap .label { font-size: 0.7rem; color: var(--text-dim); width: 22px; }

.track-cells { display: flex; gap: 3px; }
.track-cell {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text-dim);
  font-family: var(--mono);
  width: 24px;
  height: 24px;
  cursor: pointer;
}
.track-cell:hover { border-color: var(--nato); color: var(--nato); }
.track-cell.active { background: var(--nato); color: var(--bg); font-weight: 700; border-color: var(--nato); }
.faction-wp .track-cell.active { background: var(--wp-bright); color: #fff; border-color: var(--wp-bright); }

.cs-section { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.cs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--surface2);
  padding: 4px 8px;
  flex: 1 1 calc(50% - 8px);
  min-width: 200px;
}
.cs-label { font-size: 0.75rem; }

.counter-ctrl { display: flex; align-items: center; gap: 0; }
.counter-btn {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 0.8rem;
  width: 22px;
  height: 22px;
  cursor: pointer;
}
.counter-btn:hover { border-color: var(--nato); color: var(--nato); }
.counter-val {
  font-weight: 700;
  color: var(--nato);
  min-width: 28px;
  text-align: center;
  border-top: 1px solid var(--border2);
  border-bottom: 1px solid var(--border2);
  height: 22px;
  line-height: 22px;
}
.faction-wp .counter-val { color: var(--wp-bright); }
</style>
</head>
<body>

<header>
  <h1>▶ AIR &amp; ARMOR · TRACKER</h1>
  <div>
    <button id="reset-turn-btn">RP/CP/Offmap 리셋</button>
    <a href="index.html">◀ SOP로 돌아가기</a>
  </div>
</header>

<main>
  <div id="panel-nato"></div>
  <div id="panel-wp"></div>
</main>

<script src="tracker-data.js"></script>
<script src="tracker.js"></script>
<script>
  initTrackerPage();
</script>
</body>
</html>
```

- [ ] **Step 2: `initTrackerPage` 및 리셋 버튼 연결을 `tracker.js`에 추가**

`air_armor/tracker.js` 끝에 추가:

```javascript
function initTrackerPage() {
  const state = loadState();

  function rerender() {
    saveState(state);
    renderFactionPanel(document.getElementById('panel-nato'), 'nato', state, rerender);
    renderFactionPanel(document.getElementById('panel-wp'), 'wp', state, rerender);
  }

  document.getElementById('reset-turn-btn').addEventListener('click', () => {
    resetTurnTracks(state);
    rerender();
  });

  rerender();
}
```

- [ ] **Step 3: 브라우저에서 수동 확인**

`air_armor/tracker.html`을 브라우저로 열기.

체크리스트:
- NATO 패널(좌, 황색 강조)에 5개 HQ 행, Offmap 행, SAM 행, CSP 12개 항목(US/서독/캐나다 × 6종), VP 행이 보임
- WP 패널(우, 적색 강조)에 HQ 행 없음, Offmap 행, SAM 행, CSP 6개 항목, VP 행이 보임
- 트랙 칸 클릭 시 강조가 즉시 이동
- CSP/VP `+`/`−` 클릭 시 값 변화, `−`를 0에서 눌러도 음수로 안 내려감
- 새로고침 후 입력값 유지됨
- "RP/CP/Offmap 리셋" 클릭 시 RP/CP/Offmap만 0, CSP/VP/SAM은 유지됨

- [ ] **Step 4: Commit**

```bash
git add air_armor/tracker.html air_armor/tracker.js
git commit -m "Add tracker.html page wiring data, rendering, and reset button"
```

---

### Task 7: 메인 SOP 페이지에 트래커 진입 링크 추가

**Files:**
- Modify: `air_armor/index.html:894`

- [ ] **Step 1: 헤더에 링크 추가**

`air_armor/index.html` 894번째 줄 주변:

```html
<!-- 변경 전 -->
    <h1>▶ AIR &amp; ARMOR · SOP</h1>
    <div class="breadcrumb" id="breadcrumb"></div>

<!-- 변경 후 -->
    <h1>▶ AIR &amp; ARMOR · SOP</h1>
    <div class="breadcrumb" id="breadcrumb"></div>
    <a href="tracker.html" style="color: var(--green-lt); text-decoration: none; font-size: 0.7rem; margin-left: 12px;">▶ 포인트 트래커</a>
```

- [ ] **Step 2: 브라우저에서 확인**

`air_armor/index.html`을 열어 헤더에 "▶ 포인트 트래커" 링크가 보이는지, 클릭하면 `tracker.html`로 이동하는지 확인.

- [ ] **Step 3: Commit**

```bash
git add air_armor/index.html
git commit -m "Link tracker page from SOP viewer header"
```

---

## Self-Review Notes

- **Spec coverage:** RP/CP(HQ별, NATO만) ✅ Task 5 · Offmap CP/RP(양 진영) ✅ Task 5 · CSP 6종(Mine/ADM/Gas×2/AirPoint/Bridge, NATO 국적별·WP 단일) ✅ Task 1, 5 · VP ✅ Task 5 · SAM Strength ✅ Task 1, 5 · localStorage 영속성 ✅ Task 2 · 리셋 버튼(CSP/VP/SAM 제외) ✅ Task 2, 6 · 0 미만 방지 ✅ Task 2, 4 · 냉전 테마 계승 ✅ Task 6
- **Placeholder scan:** 전 단계 코드 완비, TBD 없음
- **Type consistency:** `state[factionId].hqs[hqId] = {rp, cp}`, `.offmap = {cp, rp}`, `.cs[nationId][csType] = number`, `.vp`, `.sam` — Task 2에서 정의한 구조를 Task 3~6에서 동일하게 사용함을 확인함
