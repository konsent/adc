import { arcOf } from './geometry.js';
import { applyAction } from './state.js';
import { normalizeFacing } from './hex.js';

const NON_EVASIVE = {
  1: ['H'], 2: ['H'], 3: ['H'], 4: ['H'],
  5: ['H', 'D'], 6: ['H', 'D'],
  7: ['H', 'H', 'Z'], 8: ['H', 'H', 'Z'],
  9: ['H', 'H', 'SD'], 10: ['H', 'H', 'SD'],
};

const EVASIVE = {
  near: {
    1: ['R', 'HR', 'HR', 'H', 'HR', 'H'], 2: ['R', 'HR', 'HR', 'H', 'HR', 'H'],
    3: ['L', 'HL', 'HL', 'H', 'HL', 'HD'], 4: ['L', 'HL', 'HL', 'H', 'HL', 'HD'],
    5: ['R', 'C2', 'HR', 'H', 'C2R', 'H'], 6: ['R', 'C2', 'HR', 'H', 'C2R', 'H'],
    7: ['H', 'HL', 'C2L', 'H', 'HL', 'H'], 8: ['H', 'HL', 'C2L', 'H', 'HL', 'H'],
    9: ['R', 'H', 'HL', 'H', 'D2L', 'H'],
    10: ['HD', 'HD', 'HDR', 'H', 'HR', 'H'],
  },
  middle: {
    1: ['H', 'H', 'HL', 'H', 'HL', 'H'], 2: ['H', 'H', 'HL', 'H', 'HL', 'H'],
    3: ['H', 'HR', 'H', 'HR', 'H', 'H'], 4: ['H', 'HR', 'H', 'HR', 'H', 'H'],
    5: ['H', 'H', 'C', 'HL', 'C', 'CL'], 6: ['H', 'H', 'C', 'HL', 'C', 'CL'],
    7: ['R', 'H', 'D', 'H', 'DR', 'H'], 8: ['R', 'H', 'D', 'H', 'DR', 'H'],
    9: ['H', 'H', 'D2L', 'H', 'D', 'H'],
    10: ['L', 'H', 'H', 'D2L', 'H', 'H'],
  },
  rear: {
    1: ['H', 'H', 'H', 'HL', 'H', 'H'], 2: ['H', 'H', 'H', 'HL', 'H', 'H'],
    3: ['H', 'HR', 'H', 'H', 'H', 'H'], 4: ['H', 'HR', 'H', 'H', 'H', 'H'],
    5: ['H', 'H', 'HD', 'HD', 'HD', 'HD'], 6: ['H', 'H', 'HD', 'HD', 'HD', 'HD'],
    7: ['H', 'H', 'HR', 'H', 'H', 'HR'], 8: ['H', 'H', 'HR', 'H', 'H', 'HR'],
    9: ['H', 'H', 'HL', 'H', 'H', 'HL'],
    10: ['R', 'H', 'CR', 'H', 'CR', 'H'],
  },
};

export function evasiveArc(attacker, target) {
  const arc = arcOf(target, attacker);
  return arc <= 30 ? 'near' : arc <= 90 ? 'middle' : 'rear';
}

export function movementActions({ mode, die, attacker, target }) {
  if (!Number.isInteger(die) || die < 1 || die > 10) throw new Error(`주사위는 1~10이어야 합니다: ${die}`);
  if (mode === 'non-evasive') return NON_EVASIVE[die];
  if (mode === 'evasive') return EVASIVE[evasiveArc(attacker, target)][die];
  throw new Error(`알 수 없는 솔리테어 이동 모드: ${mode}`);
}

function movementPoints(mode, die, attacker, target, speed) {
  const tokens = movementActions({ mode, die, attacker, target });
  if (mode === 'evasive') return tokens.slice(0, Math.floor(speed));
  if (die <= 4) return Array(Math.floor(speed)).fill('H');
  if (die <= 6) return [...Array(Math.max(0, Math.floor(speed) - 1)).fill('H'), 'D'];
  // The vertical segment consumes one third of the aircraft's FP budget; its
  // altitude effect is resolved once at the maximum permitted amount.
  return [...Array(Math.ceil(speed * 2 / 3)).fill('H'), tokens.at(-1)];
}

function applyToken(state, token, { crippled, maxClimb }) {
  let next = state;
  for (const symbol of token.match(/SD|C2|D2|[HCLRDZ]/g) ?? []) {
    if (symbol === 'R' || symbol === 'L') next = { ...next, facing: normalizeFacing(next.facing + (symbol === 'R' ? 1 : -1)) };
    if (symbol === 'H') next = applyAction(next, { kind: 'hfp' });
    if (symbol === 'C' && !crippled) next = { ...next, alt: next.alt + 1 };
    if (symbol === 'C2' && !crippled) next = { ...next, alt: next.alt + 2 };
    if (symbol === 'D') next = { ...next, alt: Math.max(1, next.alt - 1) };
    if (symbol === 'D2') next = { ...next, alt: Math.max(1, next.alt - 2) };
    if (symbol === 'Z') next = { ...next, alt: next.alt + maxClimb };
    if (symbol === 'SD') next = { ...next, alt: Math.max(1, next.alt - maxClimb) };
  }
  return next;
}

/** Resolve one source-table movement turn without mutating either aircraft. */
export function moveSolitaireOpponent(target, { attacker, die, maxClimb = 0 }) {
  const mode = target.movementMode;
  const damage = target.damage ?? 'none';
  const speedLoss = damage === 'C' ? 2 : damage === 'H' ? 1 : 0;
  // Damage persists, but its FP penalty is applied only when the damage level
  // changes; do not subtract it again on every later solitaire turn.
  const previousLoss = target.damageSpeedPenalty ?? 0;
  const speed = Math.max(0, target.speed + previousLoss - speedLoss);
  const actions = movementPoints(mode, die, attacker, target, speed);
  let next = { ...target, hex: { ...target.hex }, position: { ...target.position }, speed, damageSpeedPenalty: speedLoss };
  for (const token of actions) next = applyToken(next, token, { crippled: damage === 'C', maxClimb });
  if (mode === 'evasive' && die === 5 && evasiveArc(attacker, target) === 'near') next = { ...next, speed: Math.max(0, next.speed - 1) };
  if (mode === 'evasive' && die === 5 && evasiveArc(attacker, target) === 'rear') next = { ...next, speed: Math.min(6, next.speed + 1) };
  if (mode === 'evasive' && die === 10 && evasiveArc(attacker, target) === 'rear') next = { ...next, speed: Math.max(0, next.speed - 1) };
  return { state: next, actions };
}

/** S-2 targets permanently become evasive after the stated detection trigger. */
export function updateMovementMode(target, { missileFired = false, visuallySighted = false } = {}) {
  if (target.movementMode !== 'non-evasive' || (!missileFired && !visuallySighted)) return target;
  return { ...target, movementMode: 'evasive' };
}
