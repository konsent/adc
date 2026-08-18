# Air Power Trainer 이전 및 Pages 배포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian vault 안의 `air-power-trainer` 웹앱을 `ADC_list` 저장소로 옮겨 GitHub Pages에서 동작시키고, `airpower/`에 트레이너·ADC를 오가는 탭 shell을 붙인다.

**Architecture:** 빌드 없는 정적 ES 모듈 앱이다. 파일을 복사하고, Pages에서 404를 내는 에셋 파일명을 슬러그화하고, Jekyll을 끄고, iframe 두 개를 겹친 shell을 새로 쓴다. 번들러도 CI도 추가하지 않는다.

**Tech Stack:** 순수 ES 모듈 + SVG, 의존성 없음. GitHub Pages(legacy/Jekyll 빌드). 검증은 `python3 -m http.server`와 브라우저.

**Spec:** `docs/superpowers/specs/2026-08-18-airpower-trainer-migration-design.md`

## Global Constraints

- 저장소 루트: `/Users/daso/1/1영상/브이컬러링/ADC_list` (git repo, remote `konsent/adc`, 브랜치 `main`)
- 원본 경로: `/Users/daso/Obsidian/obsidian-repo/위키/보드게임/번역/data/air_power`
- 배포 URL: `https://konsent.github.io/adc/airpower/`
- 원본(`obsidian-repo`)은 **읽기 전용**으로 다룬다. 원본 파일을 수정하거나 삭제하지 않는다.
- 저장소에 다른 세션의 미커밋 변경이 있을 수 있다. `git add`는 항상 경로를 명시하고 `-A`/`-a`를 쓰지 않는다.
- `.DS_Store`는 복사하지 않는다 (`.gitignore`에 이미 있지만 복사 단계에서 제외한다).
- 에셋 슬러그 규칙: 소문자화 → `+`와 `.` 제거 → 영숫자 아닌 연속 문자를 `-` 하나로 → 앞뒤 `-` 제거.
- 커밋 메시지는 한국어, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: 트레이너·문서 파일 복사

원본에서 배포에 필요한 것만 가져온다. 이 시점에는 아직 동작하지 않는다 (에셋 파일명이 그대로라 Pages에서 깨진다). Task 2가 그것을 고친다.

**Files:**
- Create: `airpower/trainer/` (원본 `air-power-trainer/`에서 `index.html`, `data/`, `engine/`, `rules/`, `ui/`, `assets/`)
- Create: `airpower/ruleset/` (`.md` 4개)
- Create: `airpower/scenario/` (`.md` 3개)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `airpower/trainer/ui/hexmap.js` (Task 2가 수정), `airpower/trainer/assets/` 33개 파일 (Task 2가 rename), `airpower/trainer/index.html` (Task 3의 shell이 iframe으로 로드)

- [ ] **Step 1: 복사 실행**

`test/`, `package.json`, `README.md`는 배포에 불필요하므로 제외한다. `--exclude`로 `.DS_Store`를 막는다.

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
SRC="/Users/daso/Obsidian/obsidian-repo/위키/보드게임/번역/data/air_power"

mkdir -p airpower/trainer
rsync -a --exclude='.DS_Store' \
  "$SRC/air-power-trainer/index.html" \
  "$SRC/air-power-trainer/data" \
  "$SRC/air-power-trainer/engine" \
  "$SRC/air-power-trainer/rules" \
  "$SRC/air-power-trainer/ui" \
  "$SRC/air-power-trainer/assets" \
  airpower/trainer/

rsync -a --exclude='.DS_Store' "$SRC/ruleset" "$SRC/scenario" airpower/
```

- [ ] **Step 2: 복사 결과 확인**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
find airpower/trainer -type f | wc -l          # 기대: 47 (js 13 + html 1 + assets 33)
ls airpower/trainer                             # 기대: assets data engine index.html rules ui
ls airpower/ruleset airpower/scenario           # 기대: .md 4개 / .md 3개
find airpower -name '.DS_Store' | wc -l         # 기대: 0
find airpower/trainer -name 'test' -o -name 'package.json' -o -name 'README.md' | wc -l  # 기대: 0
```

기대와 다르면 멈추고 원인을 찾는다.

- [ ] **Step 3: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add airpower/trainer airpower/ruleset airpower/scenario
git commit -m "feat: air-power-trainer와 규칙/시나리오 문서 이전

원본: obsidian-repo/위키/보드게임/번역/data/air_power
test/, package.json, README.md는 배포에 불필요하여 제외.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 에셋 슬러그화 및 매핑 수정

Pages에서 404가 나는 근본 원인을 고친다. 파일명의 공백·`+`·`.`이 CDN에서 깨지므로 전부 슬러그화하고, 이를 참조하는 매핑을 맞춘다.

**Files:**
- Modify: `airpower/trainer/assets/` 33개 전부 rename
- Modify: `airpower/trainer/ui/hexmap.js:11-21` (`AIRCRAFT_COUNTERS`)
- Create: `airpower/trainer/test-assets.mjs` (검증용, Step 4에서 삭제)

**Interfaces:**
- Consumes: Task 1의 `airpower/trainer/assets/`, `airpower/trainer/ui/hexmap.js`
- Produces: 슬러그 파일명으로 통일된 `assets/`. `AIRCRAFT_COUNTERS`의 값 9개가 전부 실재 파일과 일치한다.

**주의 — `AWACS.jpg`와 `AWACS_.jpg`는 슬러그가 `awacs.jpg`로 충돌한다.** MD5가 서로 다른 별개 파일이므로 (`135def95…` / `84bb477e…`) 자동 rename에 맡기면 하나가 조용히 사라진다. `AWACS_.jpg`는 `awacs-2.jpg`로 따로 지정한다. 두 파일 모두 현재 매핑에는 없어 앱 동작에는 영향이 없지만, 파일은 보존한다.

- [ ] **Step 1: 검증 스크립트를 먼저 쓴다 (실패하는 테스트)**

매핑의 9개 값이 실제 파일과 일치하는지, 그리고 남은 파일명에 Pages에서 문제되는 문자가 없는지 검사한다.

Create `airpower/trainer/test-assets.mjs`:

```javascript
// 에셋 파일명이 Pages에서 안전하고, 매핑이 실재 파일을 가리키는지 검사한다.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, 'assets');

// hexmap.js에서 AIRCRAFT_COUNTERS 리터럴만 떼어내 평가한다.
const source = readFileSync(join(here, 'ui/hexmap.js'), 'utf8');
const match = source.match(/const AIRCRAFT_COUNTERS = (\{[\s\S]*?\});/);
assert.ok(match, 'hexmap.js에서 AIRCRAFT_COUNTERS를 찾지 못했다');
const counters = eval(`(${match[1]})`);

const entries = Object.entries(counters);
assert.equal(entries.length, 9, `매핑 항목은 9개여야 한다 (실제 ${entries.length})`);

const problems = [];

for (const [id, filename] of entries) {
  if (!existsSync(join(assetsDir, filename))) {
    problems.push(`매핑 대상 없음: ${id} -> ${filename}`);
  }
}

for (const name of readdirSync(assetsDir)) {
  if (name === '.DS_Store') continue;
  // Pages CDN에서 문제되는 문자: 공백, +, 대문자, 그리고 확장자 앞 외의 점
  if (!/^[a-z0-9][a-z0-9-]*\.(jpg|gif)$/.test(name)) {
    problems.push(`안전하지 않은 파일명: ${name}`);
  }
}

const files = readdirSync(assetsDir).filter(n => n !== '.DS_Store');
assert.equal(files.length, 33, `에셋은 33개여야 한다 (실제 ${files.length}) — rename 중 덮어쓰기 의심`);

assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}\n`);
console.log(`OK: 에셋 ${files.length}개, 매핑 ${entries.length}개 모두 정상`);
```

- [ ] **Step 2: 실행해서 실패를 확인한다**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/airpower/trainer"
node test-assets.mjs
```

기대: FAIL. "안전하지 않은 파일명: AWACS.jpg" 등 33개 파일명 문제와, 매핑 9개의 "매핑 대상 없음"은 아직 나오지 않는다 (원본 파일명이 그대로라 존재하기 때문). 즉 파일명 문제만 먼저 터진다.

- [ ] **Step 3: rename과 매핑 수정을 함께 적용한다**

rename을 먼저 하면 매핑이 깨지고, 매핑을 먼저 고치면 파일이 없다. 한 단계에서 둘 다 바꾼다.

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/airpower/trainer/assets"

# AWACS_ 는 슬러그가 AWACS와 충돌하므로 먼저 따로 처리한다.
git mv "AWACS_.jpg" "awacs-2.jpg"

for f in *; do
  [ "$f" = ".DS_Store" ] && continue
  case "$f" in *[A-Z]*|*" "*|*"+"*) ;; *) continue ;; esac
  ext="${f##*.}"; base="${f%.*}"
  slug=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/[+.]//g' -e 's/[^a-z0-9]\{1,\}/-/g' -e 's/^-//' -e 's/-$//')
  [ -e "$slug.$ext" ] && { echo "충돌: $f -> $slug.$ext"; exit 1; }
  git mv "$f" "$slug.$ext"
done
```

그다음 `ui/hexmap.js:11-21`의 `AIRCRAFT_COUNTERS`를 아래로 교체한다. `Su-17 Fittter.jpg`의 `Fittter` 오타는 슬러그에도 그대로 남는다(`su-17-fittter.jpg`) — 파일명과 매핑이 일치하기만 하면 되므로 오타는 건드리지 않는다.

```javascript
const AIRCRAFT_COUNTERS = {
  'F-19A': 'f-19-stealth-fighter.jpg',
  'F-15C': 'f-15c-eagle.jpg',
  'F-4E': 'f-4e-phantom-ii.jpg',
  'F-4F': 'f-4f-phantom-ii.jpg',
  'JA-37': 'ja-37-viggen.jpg',
  'MIG-21MF': 'mig-21mf-fishbed-j.jpg',
  'MIG-31': 'mig-31a-foxhound.jpg',
  'SU-17': 'su-17-fittter.jpg',
  'MIG-29': 'mig-29-fulcrum-a.jpg',
};
```

- [ ] **Step 4: 검증하고 스크립트를 지운다**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list/airpower/trainer"
node test-assets.mjs
```

기대: `OK: 에셋 33개, 매핑 9개 모두 정상`

통과하면 스크립트를 지운다. 일회성 마이그레이션 검사라 저장소에 남길 이유가 없다 (앱에는 테스트 러너가 없고, `test/`도 이전하지 않았다).

```bash
rm test-assets.mjs
```

- [ ] **Step 5: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add airpower/trainer/assets airpower/trainer/ui/hexmap.js
git commit -m "fix: 에셋 파일명 슬러그화로 Pages 404 해결

파일명의 공백/+/대문자가 Pages CDN에서 404를 냈다.
특히 'F-4F+ I.C.E. Phantom II.jpg'의 +가 스페이스로 디코딩됐다.
AWACS_.jpg는 AWACS.jpg와 슬러그가 충돌해 awacs-2.jpg로 분리했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 탭 shell 작성

기존 ADC 화면을 `adc.html`로 옮기고, 그 자리에 트레이너/ADC/나란히를 오가는 shell을 놓는다.

**Files:**
- Rename: `airpower/index.html` → `airpower/adc.html`
- Create: `airpower/index.html` (새 shell)

**Interfaces:**
- Consumes: Task 2까지 완성된 `airpower/trainer/index.html`, 그리고 이동된 `airpower/adc.html`
- Produces: `airpower/index.html` — 루트 `index.html:421`의 `href="airpower/index.html"`이 이미 여기를 가리키므로 메인 페이지 수정은 불필요하다.

**주의 — 숨긴 iframe에 `display:none`을 쓰지 않는다.** `eots/index.html:96-104`에 기록된 함정이다. 숨긴 iframe을 `display:none`이나 화면 밖으로 옮기면 내부 앱의 `100vh` 레이아웃이 0으로 굳어 다시 보일 때 빈 화면이 된다. 트레이너가 `body { height:100vh; overflow:hidden }` 기반이라 특히 위험하다. 크기·위치는 유지하고 `opacity`/`z-index`로만 전환한다.

- [ ] **Step 1: 기존 ADC 화면을 adc.html로 옮긴다**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git mv airpower/index.html airpower/adc.html
```

`adc.html` 내부의 상대경로는 손대지 않는다. 같은 디렉터리에 머무르므로 `adc/...`, `../assets/...`, `../index.html`이 모두 그대로 유효하다.

- [ ] **Step 2: 새 shell을 쓴다**

Create `airpower/index.html`:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Air Superiority — Trainer &amp; ADC</title>
  <link rel="icon" href="../assets/favicon_io/favicon.ico" type="image/x-icon">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Noto+Sans+KR:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body { height: 100%; }

    body {
      font-family: 'Noto Sans KR', sans-serif;
      display: flex;
      flex-direction: column;
      background-color: #0a1420;
      color: #ccc;
      overflow: hidden;
    }

    .topbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1rem;
      background: linear-gradient(180deg, #0e1c2a 0%, #0a1420 100%);
      border-bottom: 1px solid #1e3a52;
      flex: 0 0 auto;
    }

    .back {
      font-family: 'Oswald', sans-serif;
      font-size: 0.8rem;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #4a7a9a;
      text-decoration: none;
      padding: 0.45rem 0.8rem;
      border: 1px solid #1e3a52;
      border-radius: 6px;
      transition: color 0.2s ease, border-color 0.2s ease;
      white-space: nowrap;
    }
    .back:hover { color: #6ab0d8; border-color: #3d6a86; }

    .title {
      font-family: 'Oswald', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #d94a3a;
      margin-right: auto;
      padding-left: 0.4rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tabs { display: flex; gap: 0.4rem; }

    .tab {
      font-family: 'Noto Sans KR', sans-serif;
      font-size: 0.8rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      color: #8fa8ba;
      background: transparent;
      border: 1px solid #1e3a52;
      border-radius: 6px;
      padding: 0.45rem 0.9rem;
      cursor: pointer;
      transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
      white-space: nowrap;
    }
    .tab:hover { color: #cfe4f2; border-color: #3d6a86; }
    .tab[aria-selected="true"] {
      color: #f0d0cc;
      border-color: #d94a3a;
      background: rgba(217,74,58,0.12);
    }

    .panes { position: relative; flex: 1 1 auto; min-height: 0; }

    .panes iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
    }

    /* 두 iframe 모두 항상 실제 크기를 유지해야 한다. display:none이나 화면 밖 이동으로 숨기면
       내부 앱의 100vh 레이아웃이 0 또는 잘못된 값으로 굳어 빈 화면이 된다.
       크기·위치는 그대로 두고 겹쳐 쌓은 뒤 투명도로만 전환한다. */
    .panes iframe[hidden] {
      display: block;
      opacity: 0;
      z-index: 0;
      pointer-events: none;
    }
    .panes iframe:not([hidden]) { z-index: 1; }

    /* 분할 모드: 겹치기를 풀고 좌우로 나눈다. 같은 이유로 여기서도 iframe을 숨기지 않는다. */
    .panes.split iframe {
      width: 50%;
      opacity: 1;
      z-index: 1;
      pointer-events: auto;
    }
    .panes.split iframe:first-of-type { inset: 0 auto 0 0; border-right: 1px solid #1e3a52; }
    .panes.split iframe:last-of-type { inset: 0 0 0 50%; }

    @media (max-width: 760px) {
      .title { display: none; }
      .tabs { margin-left: auto; }
      .tab { padding: 0.45rem 0.6rem; font-size: 0.72rem; }
      /* 좁은 화면에서 좌우 분할은 쓸모가 없다. */
      .tab[data-tab="split"] { display: none; }
    }
  </style>
</head>
<body>

  <div class="topbar">
    <a class="back" href="../index.html">← Back</a>
    <div class="title">Air Superiority</div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-tab="trainer" aria-selected="true">트레이너</button>
      <button class="tab" role="tab" data-tab="adc" aria-selected="false">ADC</button>
      <button class="tab" role="tab" data-tab="split" aria-selected="false">나란히</button>
    </div>
  </div>

  <div class="panes" id="panes">
    <iframe id="pane-trainer" src="trainer/index.html" title="이동 훈련"></iframe>
    <iframe id="pane-adc" src="adc.html" title="Aircraft ADC" hidden></iframe>
  </div>

  <script>
    const tabs = document.querySelectorAll('.tab');
    const panes = document.getElementById('panes');
    const trainer = document.getElementById('pane-trainer');
    const adc = document.getElementById('pane-adc');

    function select(name) {
      if (name !== 'trainer' && name !== 'adc' && name !== 'split') name = 'trainer';

      // 좁은 화면에서는 분할 탭이 숨겨져 있으므로 트레이너로 되돌린다.
      if (name === 'split' && window.matchMedia('(max-width: 760px)').matches) name = 'trainer';

      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
      panes.classList.toggle('split', name === 'split');

      // 분할일 때는 둘 다 보여야 하므로 hidden을 모두 푼다.
      trainer.hidden = name === 'adc';
      adc.hidden = name === 'trainer';
    }

    tabs.forEach(t => t.addEventListener('click', () => {
      location.hash = t.dataset.tab;      // hashchange가 select 호출
    }));

    // 새로고침/뒤로가기에도 탭 유지
    addEventListener('hashchange', () => select(location.hash.slice(1)));
    select(location.hash.slice(1));
  </script>

</body>
</html>
```

- [ ] **Step 3: 로컬 서버를 띄우고 세 모드를 확인한다**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
python3 -m http.server 8765 > /dev/null 2>&1 &
echo $! > /tmp/airpower-server.pid
sleep 1
curl -s -o /dev/null -w '%{http_code} airpower/index.html\n' http://localhost:8765/airpower/index.html
curl -s -o /dev/null -w '%{http_code} airpower/adc.html\n' http://localhost:8765/airpower/adc.html
curl -s -o /dev/null -w '%{http_code} trainer/index.html\n' http://localhost:8765/airpower/trainer/index.html
curl -s -o /dev/null -w '%{http_code} trainer/ui/panel.js\n' http://localhost:8765/airpower/trainer/ui/panel.js
curl -s -o /dev/null -w '%{http_code} mig-29 counter\n' http://localhost:8765/airpower/trainer/assets/mig-29-fulcrum-a.jpg
```

기대: 전부 `200`.

그다음 브라우저로 `http://localhost:8765/airpower/`를 열어 눈으로 확인한다:
- 기본이 트레이너 탭이고 헥스 맵이 그려진다
- ADC 탭으로 전환하면 기체 목록과 뷰어가 뜬다
- 트레이너로 되돌아왔을 때 맵이 여전히 보인다 (빈 화면이면 `display:none` 함정에 빠진 것)
- 나란히 탭에서 좌우로 둘 다 보인다
- 새로고침해도 탭이 유지된다
- DevTools 콘솔과 Network에 404가 없다

- [ ] **Step 4: 서버를 정리한다**

```bash
kill "$(cat /tmp/airpower-server.pid)" && rm /tmp/airpower-server.pid
```

- [ ] **Step 5: 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git add airpower/index.html airpower/adc.html
git commit -m "feat: airpower에 트레이너/ADC 탭 shell 추가

기존 ADC 화면은 adc.html로 옮기고 index.html은 shell이 된다.
탭은 트레이너(기본)/ADC/나란히 3종, 상태는 hash에 저장한다.
숨긴 iframe은 display:none 대신 opacity로 전환한다 — 내부 앱의
100vh 레이아웃이 0으로 굳는 것을 피하기 위해서다(eots와 같은 이유).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Jekyll 끄고 배포 확인

Pages가 legacy(Jekyll) 빌드이므로 `.nojekyll` 없이는 정적 파일이 온전히 서빙된다는 보장이 없다.

**Files:**
- Create: `.nojekyll` (저장소 루트, 빈 파일)

**Interfaces:**
- Consumes: Task 1-3의 결과 전부
- Produces: 배포된 사이트. 이후 태스크 없음.

- [ ] **Step 1: .nojekyll 추가하고 커밋**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
touch .nojekyll
git add .nojekyll
git commit -m "chore: .nojekyll 추가

Pages가 legacy(Jekyll) 빌드라 정적 파일이 그대로 서빙되도록 끈다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 2: 푸시**

```bash
cd "/Users/daso/1/1영상/브이컬러링/ADC_list"
git push origin main
```

- [ ] **Step 3: 빌드가 끝날 때까지 기다린 뒤 라이브 확인**

Pages 빌드는 보통 1-2분 걸린다. 상태를 폴링한다:

```bash
gh api repos/konsent/adc/pages/builds/latest --jq '.status, .error.message'
```

`built`가 될 때까지 기다린 뒤 (`errored`면 메시지를 읽고 멈춘다) 실제 URL을 검사한다:

```bash
BASE=https://konsent.github.io/adc/airpower
for p in / /adc.html /trainer/index.html /trainer/ui/panel.js /trainer/ui/hexmap.js /trainer/assets/mig-29-fulcrum-a.jpg /trainer/assets/f-4f-ice-phantom-ii.jpg; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"
done
```

기대: 전부 `200`. 특히 `f-4f-ice-phantom-ii.jpg`는 원래 `+`가 들어 있어 404가 나던 파일이라 이번 수정의 핵심 증거다.

- [ ] **Step 4: 브라우저로 최종 확인**

`https://konsent.github.io/adc/`에서 Air Superiority 카드를 클릭해 shell이 뜨는지, 세 탭이 모두 동작하는지, 트레이너 맵에 기체 카운터 이미지가 실제로 그려지는지 확인한다. 콘솔에 404가 없어야 한다.

---

## Self-Review

**1. Spec coverage**

| 스펙 요구사항 | 태스크 |
|---|---|
| 트레이너를 `airpower/trainer/`로 이전 | Task 1 |
| `test/`·`package.json`·`README.md` 제외 | Task 1 Step 1-2 |
| `ruleset/`·`scenario/` 파일만 복사, 웹 비노출 | Task 1 (shell에 링크 없음) |
| 에셋 33개 전부 슬러그화 | Task 2 Step 3 |
| `AIRCRAFT_COUNTERS` 9개 수정 | Task 2 Step 3 |
| `.nojekyll` 추가 | Task 4 Step 1 |
| 탭 shell (트레이너 기본/ADC/나란히) | Task 3 Step 2 |
| 기존 ADC → `adc.html` | Task 3 Step 1 |
| `display:none` 금지 | Task 3 Step 2 (CSS 주석 + Step 3 육안 확인) |
| 모바일에서 분할 숨김 | Task 3 Step 2 (미디어쿼리 + JS 폴백) |
| 메인 index.html 수정 불필요 | Task 3 Interfaces에 명시 |
| 로컬 검증 → 푸시 → 라이브 검증 | Task 3 Step 3, Task 4 Step 3-4 |

빠진 요구사항 없음.

**2. Placeholder scan**

"TBD"·"적절히 처리"·"Task N과 유사" 없음. 모든 코드 단계에 실제 코드가 들어 있다.

**3. Type consistency**

- `AIRCRAFT_COUNTERS` 값 9개(Task 2)와 Task 3·4의 검증 URL(`mig-29-fulcrum-a.jpg`, `f-4f-ice-phantom-ii.jpg`)이 슬러그 규칙상 일치한다.
- iframe id `pane-trainer`/`pane-adc`가 CSS·JS·HTML에서 일관된다.
- 탭 이름 `trainer`/`adc`/`split`이 `data-tab`, `select()`, hash에서 일치한다.
- Task 3의 `.panes.split iframe:first-of-type`가 트레이너, `:last-of-type`가 ADC로, HTML 순서와 맞는다.

**계획 중 발견해 반영한 사항 두 가지:**

1. `AWACS.jpg`와 `AWACS_.jpg`가 같은 슬러그로 충돌한다. MD5가 달라 별개 파일이므로 `awacs-2.jpg`로 분리했다. 순진한 rename 루프였다면 파일 하나가 조용히 사라졌을 것이다.
2. `Su-17 Fittter.jpg`의 오타는 고치지 않는다. 파일명과 매핑이 일치하기만 하면 되고, 스펙에 없는 변경을 끼워 넣을 이유가 없다.
