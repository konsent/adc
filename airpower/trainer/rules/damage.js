// Rule 10.A Damage Table + 10.2 누적 피해.
// 표가 L/2L/H/C/*를 내면 그 결과를 누적 장부에 전이한다.

import { vulnerabilityOf } from '../data/weapons.js';

// ruleset/air-power-damage-table-rule-db.md §2. 행 = 수정 주사위(0- ~ 10+),
// 열 = Attack Rating 1~10+. '*'는 격추이므로 장부에서는 'K'로 바꿔 쓴다.
const DAMAGE_TABLE = {
  '0-': ['*', '*', '*', '*', '*', '*', '*', '*', '*', '*'],
  1: ['C', 'C', '*', '*', '*', '*', '*', '*', '*', '*'],
  2: ['H', 'H', 'C', '*', '*', '*', '*', '*', '*', '*'],
  3: ['L', 'H', 'H', 'C', '*', '*', '*', '*', '*', '*'],
  4: ['L', 'L', 'H', 'H', 'C', 'C', '*', '*', '*', '*'],
  5: ['L', 'L', '2L', 'H', 'C', 'C', 'C', '*', '*', '*'],
  6: ['L', 'L', 'L', 'H', 'H', 'C', 'C', 'C', '*', '*'],
  7: ['-', 'L', 'L', 'L', 'H', 'H', 'C', 'C', 'C', '*'],
  8: ['-', '-', 'L', 'L', 'H', 'H', 'H', 'H', 'C', 'C'],
  9: ['-', '-', '-', 'L', 'L', '2L', 'H', 'H', 'C', 'C'],
  '10+': ['-', '-', '-', '-', 'L', 'L', '2L', 'H', 'H', 'C'],
};

/**
 * Damage Table 조회 (§2).
 * @param rating  Attack Rating. 10 이상은 10+ 열.
 * @param roll    1d10 원본.
 * @param target  표적 state — Vulnerability와 기존 피해 여부를 읽는다.
 * @param missile 미사일 명중이면 주사위 -2.
 * @returns { result: '-'|'L'|'2L'|'H'|'C'|'K', row, column, drms }
 */
export function rollDamage(rating, roll, target = {}, { missile = false } = {}) {
  const vulnerability = vulnerabilityOf(target.aircraftId);
  const drms = [{ label: 'Vulnerability', value: vulnerability }];
  if (missile) drms.push({ label: '미사일', value: -2 });

  const modified = roll + drms.reduce((s, d) => s + d.value, 0);
  const row = modified <= 0 ? '0-' : modified >= 10 ? '10+' : modified;

  // 이미 피해를 입은 표적은 Attack Rating을 오른쪽 1열로 민다.
  const damaged = (target.damage ?? 'none') !== 'none';
  const shifted = rating + (damaged ? 1 : 0);
  const column = Math.min(10, Math.max(1, shifted));

  const raw = DAMAGE_TABLE[row][column - 1];
  return { result: raw === '*' ? 'K' : raw, row, column, modified, drms };
}

const LEVELS = new Set(['none', 'L', 'H', 'C', 'K']);

export function createDamageLedger(level = 'none') {
  if (!LEVELS.has(level)) throw new Error(`알 수 없는 피해 등급: ${level}`);
  return {
    light: level === 'L' ? 1 : 0,
    heavy: level === 'H' ? 1 : 0,
    crippled: level === 'C',
    killed: level === 'K',
  };
}

export function damageLevel(ledger) {
  if (ledger.killed) return 'K';
  if (ledger.crippled) return 'C';
  if (ledger.heavy) return 'H';
  if (ledger.light) return 'L';
  return 'none';
}

function parseHit(hit) {
  const match = /^(\d+)?([LHCK])$/.exec(hit);
  if (!match) throw new Error(`알 수 없는 피해 결과: ${hit}`);
  const count = Number(match[1] ?? 1);
  if (count < 1) throw new Error(`피해 횟수는 1 이상이어야 한다: ${hit}`);
  return { count, level: match[2] };
}

function applyOne(ledger, level) {
  if (ledger.killed) return ledger;
  if (level === 'K') return { ...ledger, killed: true };

  // 이미 C라면 H/C 한 번 또는 L 3회(=H)가 파괴한다.
  if (ledger.crippled && (level === 'H' || level === 'C')) {
    return { ...ledger, killed: true };
  }
  if (level === 'C') return { ...ledger, crippled: true, heavy: 0 };
  if (level === 'H') {
    const heavy = ledger.heavy + 1;
    if (heavy >= 2) return { ...ledger, heavy: 0, crippled: true };
    return { ...ledger, heavy };
  }

  const light = ledger.light + 1;
  if (light < 3) return { ...ledger, light };
  // L 3회가 만든 H도 기존 H와 동일하게 누적한다.
  return applyOne({ ...ledger, light: light - 3 }, 'H');
}

/** L/H/C/K 또는 2L 같은 Damage Table 결과를 누적한다. */
export function applyDamageLedger(ledger, hit) {
  if (hit === '-') return { ...ledger };   // 표의 무피해 결과
  const { count, level } = parseHit(hit);
  let next = { ...ledger };
  for (let index = 0; index < count; index += 1) next = applyOne(next, level);
  return next;
}

/** 전투 기체 state에 누적 장부와 현재 최고 피해 등급을 불변으로 반영한다. */
export function applyDamage(state, hit) {
  const ledger = state.damageLedger ?? createDamageLedger(state.damage ?? 'none');
  const damageLedger = applyDamageLedger(ledger, hit);
  return { ...state, damageLedger, damage: damageLevel(damageLedger) };
}

// ── Progressive Damage (Advanced 10.C, rule-db §5) ────────────────
// 피해 상태 기체는 매 턴 종료 시 1d10을 굴려 악화 여부를 판정한다.
const PROGRESSIVE_THRESHOLD = { L: 2, '2L': 2, H: 3, C: 4 };
const PROGRESSIVE_NEXT = { L: 'H', '2L': 'H', H: 'C', C: 'K' };

/**
 * 진행성 피해 판정. 악화하면 그 등급을 추가 명중으로 누적한 새 state를,
 * 아니면 원래 state를 그대로 돌려준다.
 */
export function rollProgressive(state, roll) {
  const damage = state.damage ?? 'none';
  const threshold = PROGRESSIVE_THRESHOLD[damage];
  if (threshold === undefined || roll > threshold) {
    return { state, worsened: false, roll, threshold: threshold ?? null };
  }
  const next = PROGRESSIVE_NEXT[damage];
  return { state: applyDamage(state, next), worsened: true, roll, threshold };
}
