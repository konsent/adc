import { AIRCRAFT, bandOf } from '../data/aircraft.js';
import { turnCost } from '../data/turnchart.js';
import { createState, beginTurn, applyAction, endTurn } from './state.js';
import { validate } from './validate.js';
import { rulesFor } from '../rules/index.js';

/** mulberry32 — 시드 기반 재현 가능 난수 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** 레슨별로 허용되는 비행 타입 */
function allowedFlightTypes(lesson) {
  if (lesson === 1) return ['LVL'];
  if (lesson === 2) return ['LVL', 'SC', 'ZC', 'SD'];
  return ['LVL', 'SC', 'ZC', 'SD'];
}

/**
 * 한 턴을 합법적으로 비행한다.
 * 매 선택마다 validate()로 검사해 위반 없는 행동만 고른다.
 */
function flyOneTurn(state, rng, lesson, { activeRules, flightType = null } = {}) {
  const vOpts = { activeRules, lesson };
  let s = beginTurn(state);

  // ── 선언 ──
  const types = allowedFlightTypes(lesson);
  const rates = ['EZ', 'TT', 'HT', 'BT'];

  // 위반 없는 선언 조합을 찾는다 (최대 20회 시도, 실패 시 무선회 LVL)
  let declared = null;
  for (let i = 0; i < 20 && !declared; i++) {
    const ft = flightType ?? (lesson === 1 ? 'LVL' : pick(rng, types));
    const wantTurn = rng() < 0.6;
    const cand = {
      kind: 'declare',
      flightType: ft,
      power: 'MIL',
      turn: wantTurn ? { rate: pick(rng, rates), dir: rng() < 0.5 ? 'L' : 'R' } : null,
    };
    if (validate(s, cand, vOpts).length === 0) declared = cand;
  }
  if (!declared) {
    declared = { kind: 'declare', flightType: 'LVL', power: 'MIL', turn: null };
  }
  s = applyAction(s, declared);

  // ── FP 소모 ──
  for (let i = 0; i < s.fpBudget; i++) {
    const wantVfp = lesson >= 2 && s.flightType !== 'LVL' && rng() < 0.5;
    const candidates = wantVfp
      ? [{ kind: 'vfp', levels: 1 }, { kind: 'hfp' }]
      : [{ kind: 'hfp' }, { kind: 'vfp', levels: 1 }];

    let applied = false;
    for (const c of candidates) {
      if (validate(s, c, vOpts).length === 0) {
        s = applyAction(s, c);
        applied = true;
        break;
      }
    }
    // 어느 것도 합법이 아니면 위반을 감수하고 전진한다(생성기는 par 경로를
    // 만드는 것이 목적이므로 멈추지 않는다).
    if (!applied) s = applyAction(s, { kind: 'hfp' });
  }

  return endTurn(s);
}

/**
 * 합법 경로를 시뮬레이션한 뒤 웨이포인트를 역산한다.
 */
export function generate({ lesson = 1, aircraftId = 'MIG-29', seed = 1, turns = 4, profile = 'normal', scope = 'basic' } = {}) {
  const rng = makeRng(seed);
  const ac = AIRCRAFT[aircraftId];

  // 시작 상태 — 엔벨로프 안에서 고르되 레슨 1~2는 ML 밴드로 고정
  const alt = lesson === 1 ? 15 : 10 + Math.floor(rng() * 10);
  const band = bandOf(alt);
  const env = ac.velocity[band];
  const speedChoices = [4, 5, 6].filter(v => v >= env.min && v <= env.max);
  const speed = speedChoices.length ? pick(rng, speedChoices) : env.min;

  const start = {
    // 맵 원점에서 시작한다. ui/hexmap.js의 그리드가 축 원점 중심이므로
    // 여기를 벗어난 좌표로 시작하면 기체와 웨이포인트가 화면 밖에 그려진다.
    hex: { q: 0, r: 0 },
    facing: 2 * Math.floor(rng() * 6),   // 짝수만
    alt,
    speed,
    flightType: 'LVL',
  };

  const activeRules = rulesFor(lesson, scope === 'basic' ? 'basic' : null);
  const cycle = ['SC', 'SD', 'SC', 'SD'];

  // 경로 시뮬레이션. altitude-cycle은 상승과 하강을 번갈아 강제한다.
  let s = createState({ aircraftId, ...start, advancedRules: scope === 'all' });
  const snapshots = [];
  for (let t = 0; t < turns; t++) {
    const flightType = profile === 'altitude-cycle' ? cycle[t % cycle.length] : null;
    s = flyOneTurn(s, rng, lesson, { activeRules, flightType });
    snapshots.push({ hex: { ...s.hex }, alt: s.alt });
  }

  // 웨이포인트 추출 — 시작 헥스와 중복되지 않는 지점만
  const seen = new Set([`${start.hex.q},${start.hex.r}`]);
  const waypoints = [];
  for (const snap of snapshots) {
    const key = `${snap.hex.q},${snap.hex.r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    waypoints.push({ hex: snap.hex, alt: lesson === 1 ? start.alt : snap.alt });
  }

  // 최소 2개 보장 — 부족하면 마지막 지점을 밀어 넣는다
  if (waypoints.length < 2 && snapshots.length) {
    const last = snapshots[snapshots.length - 1];
    waypoints.push({ hex: last.hex, alt: lesson === 1 ? start.alt : last.alt });
  }

  const parTurns = Math.max(1, waypoints.length);

  return {
    id: `gen-${seed.toString(16)}`,
    lesson,
    aircraft: aircraftId,
    start,
    waypoints,
    parTurns,
    maxTurns: parTurns + 3,
    activeRules,
    profile,
    scope,
  };
}
