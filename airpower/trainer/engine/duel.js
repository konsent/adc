import { createState, beginTurn, applyAction, endTurn } from './state.js';
import { validate } from './validate.js';

// Phase 0: 다기체 상태.
// 기존 규칙 모듈 12개는 단일기 state를 받는다. 그 계약을 깨지 않으려고
// duel은 { jets, active } 봉투만 씌우고, 규칙에는 항상 활성 기체 하나만 넘긴다.
// ponytail: 2기 이상도 그냥 동작한다. 편대(같은 편 다수)는 필요해질 때.

/**
 * @param {Record<string, object>} jetSpecs createState 인자를 id별로
 * @param {string} active 시작 활성 기체 id
 */
export function createDuel(jetSpecs, active = Object.keys(jetSpecs)[0]) {
  if (!jetSpecs[active]) throw new Error(`활성 기체가 없다: ${active}`);
  const jets = {};
  for (const [id, spec] of Object.entries(jetSpecs)) jets[id] = createState(spec);
  return { jets, active };
}

/** 활성 기체의 단일기 state. 규칙·UI에 넘기는 값. */
export function activeJet(duel) {
  return duel.jets[duel.active];
}

/** 활성 기체 외 나머지. 사거리·편각 계산의 표적 후보(Phase 1). */
export function opponents(duel) {
  return Object.entries(duel.jets)
    .filter(([id]) => id !== duel.active)
    .map(([id, jet]) => ({ id, jet }));
}

/** 활성 기체만 fn으로 교체한다. 나머지 기체는 손대지 않는다. */
function mapActive(duel, fn) {
  return { ...duel, jets: { ...duel.jets, [duel.active]: fn(duel.jets[duel.active]) } };
}

export const beginJetTurn = (duel) => mapActive(duel, beginTurn);
export const applyJetAction = (duel, action) => mapActive(duel, s => applyAction(s, action));
export const endJetTurn = (duel) => mapActive(duel, endTurn);

/** 규칙 검증. 활성 기체만 검사한다 — 기존 규칙 시그니처 그대로. */
export function validateDuel(duel, action, options) {
  return validate(activeJet(duel), action, options);
}

/** 활성 기체를 바꾼다. 턴 순서 제어는 호출부(UI/시나리오)가 정한다. */
export function withActive(duel, id) {
  if (!duel.jets[id]) throw new Error(`알 수 없는 기체: ${id}`);
  return { ...duel, active: id };
}
