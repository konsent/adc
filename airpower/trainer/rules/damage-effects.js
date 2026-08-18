// Damage Effects (ruleset/air-power-damage-table-rule-db.md §3).
// 누적 피해가 기동을 어디까지 제한하는지. 값 자체는 damageLimits()가 단일 출처이고,
// check()는 그중 선언 단계에서 잡을 수 있는 것(선회율·AB 파워)만 위반으로 낸다.
// 가속/상승 반감은 energy.js·climb 계산이 damageLimits()를 직접 읽어 쓴다.

// 등급별 허용 최대 선회율. 배열 순서가 곧 완만→급격 순서다.
const RATES = ['EZ', 'TT', 'HT', 'BT', 'ET'];

const LIMITS = {
  none: { maxRate: 'ET', roll: true, slideOnly: false, ab: true, accelFactor: 1, climbFactor: 1, canAttack: true },
  // L/2L: BT·ET 선회 불가 → HT까지.
  L: { maxRate: 'HT', roll: true, slideOnly: false, ab: true, accelFactor: 1, climbFactor: 1, canAttack: true },
  // H: "HT 이상의 Turn 불가" → TT까지. 롤 불가, AB/MIL 가속 1/2, 상승 1/2.
  H: { maxRate: 'TT', roll: false, slideOnly: false, ab: true, accelFactor: 0.5, climbFactor: 0.5, canAttack: true },
  // C: EZ만, Slide만, AB 불가, MIL 가속 1/2, 상승 1/4, 공격 불가.
  C: { maxRate: 'EZ', roll: false, slideOnly: true, ab: false, accelFactor: 0.5, climbFactor: 0.25, canAttack: false },
  K: { maxRate: 'EZ', roll: false, slideOnly: true, ab: false, accelFactor: 0, climbFactor: 0, canAttack: false },
};

// 2L은 L과 같은 기동 제한을 받는다(사격 DRM만 다르다).
LIMITS['2L'] = LIMITS.L;

/** 현재 피해 등급의 기동 제한. 규칙·엔진이 공유하는 단일 출처. */
export function damageLimits(damage) {
  return LIMITS[damage ?? 'none'] ?? LIMITS.none;
}

/** rate가 허용 최대치를 넘는지. */
function rateExceeds(rate, maxRate) {
  return RATES.indexOf(rate) > RATES.indexOf(maxRate);
}

const RATE_NAMES = { EZ: 'Easy', TT: 'Tactical', HT: 'Hard', BT: 'Break', ET: 'Emergency' };

export default {
  id: '10.B',
  name: '피해 기동 제한',
  tier: 'basic',
  lesson: 1,

  check(state, action) {
    if (action.kind !== 'declare') return [];
    const damage = state.damage ?? 'none';
    if (damage === 'none') return [];

    const limits = damageLimits(damage);
    const out = [];

    if (action.turn && rateExceeds(action.turn.rate, limits.maxRate)) {
      out.push({
        rule: '10.B',
        severity: 'illegal',
        msg: `${damage} 피해 상태에서는 ${RATE_NAMES[action.turn.rate]}(${action.turn.rate}) 선회를 할 수 없습니다. `
           + `최대 ${RATE_NAMES[limits.maxRate]}(${limits.maxRate})까지만 가능합니다.`,
        fix: `${limits.maxRate} 이하의 선회율을 선언하세요.`,
        ref: 'Damage Effects §3',
      });
    }

    if (action.power === 'AB' && !limits.ab) {
      out.push({
        rule: '10.B',
        severity: 'illegal',
        msg: `${damage} 피해 상태에서는 A/B 파워를 사용할 수 없습니다.`,
        fix: 'MIL 이하의 출력을 선언하세요.',
        ref: 'Damage Effects §3',
      });
    }

    return out;
  },
};
