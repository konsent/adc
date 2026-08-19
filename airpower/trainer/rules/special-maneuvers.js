import { AIRCRAFT, bandOf } from '../data/aircraft.js';
import { damageLimits } from './damage-effects.js';

function violation(msg, fix) {
  return { rule: '13', severity: 'illegal', msg, fix, ref: 'Rules 13.1-13.4' };
}

export default {
  id: '13', name: '특수 기동', tier: 'basic', lesson: 1,
  check(state, action) {
    if (!['slide', 'roll', 'vr'].includes(action.kind)) return [];
    const ac = AIRCRAFT[state.aircraftId];
    const limits = damageLimits(state.damage);
    const out = [];
    if (action.kind === 'slide') {
      if (state.slideCount >= (state.speed > 9 ? 2 : 1)) out.push(violation('이번 턴의 Slide 횟수 한도를 넘었습니다.', '다음 턴에 Slide를 수행하세요.'));
      if (state.speed > 9 && state.slideCount && state.fpSpent.length < 4) out.push(violation('두 번째 Slide 전에는 4 HFP의 직진 비행이 필요합니다.', '4 HFP를 직진으로 소모하세요.'));
    }
    if (action.kind === 'roll') {
      if (!limits.roll) out.push(violation(`${state.damage} 피해 상태에서는 Roll을 할 수 없습니다.`, 'Slide만 사용하세요.'));
      if (state.fpSpent.length + Math.floor(state.speed / 3) + Math.ceil(ac.roll.fp) > state.fpBudget) out.push(violation('Roll 준비 HFP와 ADC Roll 비용이 남은 FP를 초과합니다.', '다음 턴 또는 더 높은 속도에서 시도하세요.'));
    }
    if (action.kind === 'vr') {
      const last = state.fpSpent.at(-1);
      const max = ac.traits.rollRate === 'low' ? 3 : 6;
      const delta = Math.min((action.facing - state.facing + 12) % 12, (state.facing - action.facing + 12) % 12);
      if (!last || last.type !== 'VFP' || !['VC', 'VD'].includes(state.flightType)) out.push(violation('VR은 VC/VD 중 VFP 직후에만 할 수 있습니다.', '수직 비행 VFP를 먼저 소모하세요.'));
      if (delta > max) out.push(violation(`이 기체의 VR 한계는 ${max * 30}도입니다.`, '허용 기수 범위 안에서 선택하세요.'));
    }
    if (bandOf(state.alt) === 'UH') out.push(violation('UH 밴드 특수기동은 아직 Departure 판정이 필요합니다.', 'EH 이하에서 수행하세요.'));
    return out;
  },
};
