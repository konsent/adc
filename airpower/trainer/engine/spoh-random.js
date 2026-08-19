import { angleOff } from './geometry.js';
import { applyAction } from './state.js';
import { normalizeFacing } from './hex.js';

const MOVEMENT = {
  rear: {
    1: ['H', 'H', 'H', 'HL', 'H', 'H'], 2: ['H', 'H', 'H', 'HL', 'H', 'H'],
    3: ['H', 'H', 'H', 'HR', 'H', 'H'], 4: ['H', 'H', 'H', 'HR', 'H', 'H'],
    5: ['H', 'HD', 'HD', 'HL', 'H', 'H'], 6: ['H', 'HD', 'HD', 'HL', 'H', 'H'],
    7: ['H', 'DR', 'DD', 'H', 'H', 'H'], 8: ['H', 'DR', 'DD', 'H', 'H', 'H'],
    9: ['H', 'DDL', 'H', 'DD', 'H', 'H'], 10: ['H', 'DDR', 'H', 'DD', 'H', 'H'],
  },
  middle: {
    1: ['H', 'H', 'HL', 'H', 'HL', 'H'], 2: ['H', 'H', 'HL', 'H', 'HL', 'H'],
    3: ['H', 'H', 'HR', 'H', 'HR', 'H'], 4: ['H', 'H', 'HR', 'H', 'HR', 'H'],
    5: ['H', 'C', 'HL', 'CL', 'H', 'H'], 6: ['H', 'C', 'HL', 'CL', 'H', 'H'],
    7: ['H', 'DR', 'H', 'CR', 'H', 'H'], 8: ['H', 'DR', 'H', 'CR', 'H', 'H'],
    9: ['H', 'DD', 'DL', 'H', 'HL', 'H'], 10: ['H', 'DD', 'DR', 'H', 'HR', 'H'],
  },
  front: {
    1: ['H', 'HL', 'HL', 'H', 'HL', 'H'], 2: ['H', 'HL', 'HL', 'H', 'HL', 'H'],
    3: ['H', 'HR', 'HR', 'H', 'HR', 'H'], 4: ['H', 'HR', 'HR', 'H', 'HR', 'H'],
    5: ['H', 'HL', 'CL', 'H', 'H', 'HL'], 6: ['H', 'HL', 'CL', 'H', 'H', 'HL'],
    7: ['H', 'HR', 'CR', 'H', 'HR', 'H'], 8: ['H', 'HR', 'CR', 'H', 'HR', 'H'],
    9: ['H', 'HL', 'DD', 'DL', 'H', 'HL'], 10: ['H', 'HL', 'DD', 'DR', 'H', 'HR'],
  },
};

function column(attacker, target) {
  const angle = angleOff(attacker, target);
  return angle >= 150 ? 'rear' : angle >= 90 ? 'middle' : 'front';
}

function applyToken(state, token, damaged) {
  let next = state;
  for (const symbol of token.match(/[HCLRD]/g) ?? []) {
    if (symbol === 'H') next = applyAction(next, { kind: 'hfp' });
    if (symbol === 'L') next = { ...next, facing: normalizeFacing(next.facing - 1) };
    if (symbol === 'R') next = { ...next, facing: normalizeFacing(next.facing + 1) };
    if (symbol === 'C' && !damaged) next = { ...next, alt: next.alt + 1 };
    if (symbol === 'D') next = { ...next, alt: Math.max(1, next.alt - 1) };
  }
  return next;
}

/** Speed of Heat T-3 random-aircraft movement table (pp. 8-10). */
export function moveSpohRandomOpponent(target, { attacker, die }) {
  const damaged = target.damage && target.damage !== 'none';
  const actions = MOVEMENT[column(attacker, target)][die].slice(0, Math.max(0, Math.floor(target.speed) - (damaged ? 1 : 0)));
  let state = { ...target, hex: { ...target.hex }, position: { ...target.position } };
  for (const token of actions) state = applyToken(state, token, damaged);
  return { state, actions };
}
