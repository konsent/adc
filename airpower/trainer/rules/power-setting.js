import { AIRCRAFT } from '../data/aircraft.js';

export default {
  id: '6.5',
  name: '엔진 출력 변화',
  tier: 'basic',
  lesson: 3,

  check(state, action) {
    if (action.kind !== 'declare' || action.power !== 'AB') return [];

    const from = state.turnStartPower;
    if (from !== 'Idle' || AIRCRAFT[state.aircraftId].traits.rapidPowerResponse) return [];

    return [{
      rule: '6.5 / 6.7',
      severity: 'warning',
      msg: '일반 기체가 턴 시작 Idle에서 AB로 직접 출력 상승했습니다. 이 상승은 안전하지 않으며 Flame-Out 판정이 필요합니다.',
      fix: '각 엔진마다 d10을 굴려 4 이하이면 Flame-Out입니다. 안전하게 하려면 Idle → MIL(또는 중간 출력)로 올리세요.',
      ref: 'Rules 6.5, 6.7',
    }];
  },
};
