import { AIRCRAFT, bandOf, dragFor } from '../data/aircraft.js';
import { turnCost } from '../data/turnchart.js';
import { spohTurnCost } from '../data/spoh-turnchart.js';

/** 선회율별 최소 속도 가산치 (Rule 7.4) */
const MIN_SPEED_BONUS = { EZ: 0, TT: 0.5, HT: 1.0, BT: 1.5, ET: 2.0 };

const RATE_NAMES = { EZ: 'Easy', TT: 'Tactical', HT: 'Hard', BT: 'Break', ET: 'Emergency' };

export default {
  id: '7.1',
  name: '선회 메커니즘',
  tier: 'basic',
  lesson: 1,

  check(state, action) {
    if (action.kind !== 'declare' || !action.turn) return [];

    const ac = AIRCRAFT[state.aircraftId];
    const band = bandOf(state.alt);
    const { rate, dir } = action.turn;
    const out = [];

    // ADC Turn Drag Decel 표의 NA는 해당 설정에서 그 선회율을 쓸 수 없다는 뜻이다.
    if (dragFor(ac, rate, state.speed, state.configuration) === null) {
      out.push({
        rule: 'ADC Turn Drag Decel',
        severity: 'illegal',
        msg: `${ac.title}는 ${state.configuration} 설정에서 ${rate} 선회를 지원하지 않습니다(ADC Turn Drag Decel: NA).`,
        fix: '더 완만한 선회율을 선택하거나 기체 설정을 변경하세요.',
        ref: 'Aircraft Data Card',
      });
    }

    // Rule 7.4 — 최소 선회 속도
    const canard = ac.traits.canard ? 0.5 : 0;
    const required = ac.velocity[band].min + MIN_SPEED_BONUS[rate] - canard;
    if (state.speed < required) {
      out.push({
        rule: '7.4',
        severity: 'illegal',
        msg: `${RATE_NAMES[rate]}(${rate}) 선회는 최소 ${required.toFixed(1)} 속도가 필요한데 현재 속도는 ${state.speed.toFixed(1)}입니다. `
           + `${band} 밴드에서 ${ac.title}의 최소 속도는 ${ac.velocity[band].min.toFixed(1)}이고 ${rate}는 +${MIN_SPEED_BONUS[rate].toFixed(1)}을 요구합니다.`,
        fix: `속도를 ${required.toFixed(1)} 이상으로 올리거나 더 완만한 선회율을 선택하세요.`,
        ref: 'Rule 7.4',
      });
    }

    // Rule 7.1 — 차트상 사용 불가(NA)
    const cost = (ac.spoh ? spohTurnCost : turnCost)(band, state.speed, rate);
    if (cost === null) {
      out.push({
        rule: '7.1',
        severity: 'illegal',
        msg: `${band} 밴드 속도 ${state.speed.toFixed(1)}에서는 ${rate} 선회가 선회 차트에 NA로 표기되어 있습니다.`,
        fix: '더 완만한 선회율을 선택하거나 속도·고도를 바꾸세요.',
        ref: 'Rule 7.1 (통합 선회 차트)',
      });
    }

    // Rule 7.3 — 뱅크 각도 역전
    if (state.bank && state.bank !== dir) {
      const rollRate = ac.traits.rollRate;
      const needed = rollRate === 'high' ? 0 : rollRate === 'low' ? 2 : 1;
      if (needed > 0 && state.fpSpent.length < needed) {
        out.push({
          rule: '7.3',
          severity: 'illegal',
          msg: `직전 선회 방향이 ${state.bank === 'L' ? '좌' : '우'}선회였는데 `
             + `${dir === 'L' ? '좌' : '우'}선회를 선언했습니다. 뱅크를 반대로 넘기려면 FP 선소모가 필요합니다 `
             + `(현재 이번 턴 소모 FP: ${state.fpSpent.length}개).`,
          fix: `${needed} FP를 먼저 소모한 뒤 반대 선회를 시작하세요. 이 FP는 선회 요구 전진 거리에 합산되지 않습니다.`,
          ref: 'Rule 7.3',
        });
      }
    }

    return out;
  },
};
