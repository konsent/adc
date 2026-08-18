import { AIRCRAFT } from '../data/aircraft.js';
import { isClimbing, isDiving } from '../engine/state.js';

const LABEL = {
  LVL: '수평 비행(LVL)', SC: '지속 상승(SC)', ZC: '줌 상승(ZC)', VC: '수직 상승(VC)',
  SD: '급하강(SD)', UD: '무부하 하강(UD)', VD: '수직 하강(VD)',
};

export default {
  id: '5.5',
  name: '기수 피치 전환 제약',
  tier: 'basic',
  lesson: 2,

  check(state, action) {
    if (action.kind !== 'vfp') return [];

    const prev = state.prevFlightType;
    const now = state.flightType;
    const ac = AIRCRAFT[state.aircraftId];
    const hfpUsed = state.fpSpent.filter(f => f.type === 'HFP').length;

    // 동일 타입 유지 — 제약 없음
    const sameCategory =
      (prev === 'LVL' && now === 'LVL') ||
      (isClimbing(prev) && isClimbing(now)) ||
      (isDiving(prev) && isDiving(now));
    if (sameCategory) return [];

    // LVL → 상승/하강: 첫 1 FP는 반드시 HFP
    if (prev === 'LVL' && (isClimbing(now) || isDiving(now))) {
      if (hfpUsed < 1) {
        return [{
          rule: '5.5',
          severity: 'illegal',
          msg: `직전 턴 ${LABEL[prev]} → 이번 턴 ${LABEL[now]}. 첫 1 FP는 반드시 HFP여야 하는데 `
             + `HFP를 ${hfpUsed}개 쓴 상태에서 VFP를 사용했습니다.`,
          fix: 'HFP를 1개 먼저 소모한 뒤 VFP를 사용하세요.',
          ref: 'Rule 5.5',
        }];
      }
      return [];
    }

    // 상승 ↔ 하강 반전: 속도의 1/2(HPR은 1/3) 반내림만큼 HFP 선소모
    const reversing = (isClimbing(prev) && isDiving(now)) || (isDiving(prev) && isClimbing(now));
    if (reversing) {
      const divisor = ac.traits.hpr ? 3 : 2;
      const required = Math.floor(state.speed / divisor);
      if (hfpUsed < required) {
        return [{
          rule: '5.5',
          severity: 'illegal',
          msg: `직전 턴 ${LABEL[prev]} → 이번 턴 ${LABEL[now]}는 기수 반전입니다. `
             + `속도 ${state.speed.toFixed(1)}의 1/${divisor}인 ${required} HFP를 선소모해야 하는데 `
             + `${hfpUsed}개만 썼습니다.`,
          fix: `HFP를 ${required}개까지 채운 뒤 VFP를 사용하세요.`
             + (ac.traits.hpr ? '' : ` ${ac.title}는 HPR 기체가 아니므로 1/3 감면 대상이 아닙니다.`),
          ref: 'Rule 5.5',
        }];
      }
    }

    return [];
  },
};
