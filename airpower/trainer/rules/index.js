// 규칙 레지스트리.
// 각 모듈은 { id, name, tier, lesson, check(state, action) } 를 default export 한다.
// check는 순수 함수여야 하며 위반 배열을 반환한다(없으면 []).

import pitchTransition from './pitch-transition.js';
import turning from './turning.js';
import climbDive from './climb-dive.js';
import energy from './energy.js';
import powerSetting from './power-setting.js';
import verticalFlight from './vertical-flight.js';
import damageEffects from './damage-effects.js';

export const RULES = [
  turning,
  pitchTransition,
  climbDive,
  energy,
  powerSetting,
  verticalFlight,
  damageEffects,
];

export function rulesFor(lesson, tier = null) {
  return RULES
    .filter(r => r.lesson <= lesson)
    .filter(r => tier === null || r.tier === tier)
    .map(r => r.id);
}
