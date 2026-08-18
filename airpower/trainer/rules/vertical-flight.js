// 수직 비행의 HFP/VFP 비율. 고급 규칙 범위에서만 적용한다.

const LABEL = { VC: '수직 상승(VC)', VD: '수직 하강(VD)' };

export default {
  id: '8.vertical',
  name: '수직 비행 FP 비율',
  tier: 'advanced',
  lesson: 4,

  check(state, action) {
    const type = state.flightType;
    if (!LABEL[type] || !['hfp', 'vfp'].includes(action.kind)) return [];

    const hfpUsed = state.fpSpent.filter(fp => fp.type === 'HFP').length;
    const required = Math.floor(state.fpBudget / 3);
    const firstVerticalTurn = state.prevFlightType !== type;

    if (firstVerticalTurn && action.kind === 'vfp' && hfpUsed < required) {
      return [{
        rule: '8.vertical', severity: 'illegal',
        msg: `${LABEL[type]} 첫 턴은 전체 ${state.fpBudget} FP 중 정확히 ${required}개를 HFP로 먼저 써야 합니다. 현재 ${hfpUsed}개입니다.`,
        fix: `HFP를 ${required}개까지 먼저 소모한 뒤 VFP를 사용하세요.`, ref: 'Rule 8.1.3 / 8.2.3',
      }];
    }
    if (action.kind === 'hfp' && hfpUsed >= required) {
      const word = firstVerticalTurn ? '정확히' : '최대';
      return [{
        rule: '8.vertical', severity: 'illegal',
        msg: `${LABEL[type]}에서 HFP는 이번 턴 ${word} ${required}개까지만 사용할 수 있습니다.`,
        fix: '남은 FP는 VFP로 사용하세요.', ref: 'Rule 8.1.3 / 8.2.3',
      }];
    }
    return [];
  },
};
