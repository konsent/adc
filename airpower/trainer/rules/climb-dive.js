import { AIRCRAFT, bandOf } from '../data/aircraft.js';
import { isClimbing, isDiving } from '../engine/state.js';
import { damageLimits } from './damage-effects.js';

const LABEL = {
  LVL: '수평 비행(LVL)', SC: '지속 상승(SC)', ZC: '줌 상승(ZC)', VC: '수직 상승(VC)',
  SD: '급하강(SD)', UD: '무부하 하강(UD)', VD: '수직 하강(VD)',
};

export default {
  id: '8.0',
  name: '상승·하강 비행',
  tier: 'basic',
  lesson: 2,

  check(state, action) {
    const ac = AIRCRAFT[state.aircraftId];
    const band = bandOf(state.alt);
    const ft = state.flightType;
    const out = [];

    // ── 수직 비행 진입 조건 ──
    if (action.kind === 'declare') {
      const type = action.flightType;
      if (type === 'VC' && !isClimbing(state.prevFlightType)
        && !(ac.traits.hpr && state.speed < 4)) {
        out.push({
          rule: '8.1.3',
          severity: 'illegal',
          msg: `${LABEL.VC}는 직전 턴에 상승 비행(SC/ZC/VC) 중일 때만 진입할 수 있습니다. 직전 턴은 ${LABEL[state.prevFlightType]}입니다.`,
          fix: 'SC 또는 ZC로 한 턴 상승한 뒤 VC를 선택하세요. HPR 기체가 속도 4.0 미만이면 예외입니다.',
          ref: 'Rule 8.1.3',
        });
      }
      if (type === 'VD' && !isDiving(state.prevFlightType)) {
        out.push({
          rule: '8.2.3',
          severity: 'illegal',
          msg: `${LABEL.VD}는 직전 턴에 하강 비행(SD/UD/VD) 중일 때만 진입할 수 있습니다. 직전 턴은 ${LABEL[state.prevFlightType]}입니다.`,
          fix: 'SD 또는 UD로 한 턴 하강한 뒤 VD를 선택하세요. Half-Roll and Dive 예외는 아직 구현하지 않았습니다.',
          ref: 'Rule 8.2.3',
        });
      }
      if (!action.turn) return out;
    }

    // ── 선회 선언에 대한 기동 제약 ──
    if (action.kind === 'declare' && action.turn) {
      const rate = action.turn.rate;
      const type = action.flightType;

      if (type === 'SC' && rate !== 'EZ') {
        out.push({
          rule: '8.1.2',
          severity: 'illegal',
          msg: `${LABEL.SC} 중에는 가장 완만한 EZ 선회만 가능한데 ${rate} 선회를 선언했습니다.`,
          fix: 'EZ 선회로 바꾸거나 줌 상승(ZC)으로 전환하세요.',
          ref: 'Rule 8.1.2',
        });
      }
      if (type === 'ZC' && rate === 'ET') {
        out.push({
          rule: '8.1.1',
          severity: 'illegal',
          msg: `${LABEL.ZC} 중에는 급격한 G 하중 때문에 ET 선회가 금지됩니다.`,
          fix: 'BT 이하의 선회율을 선택하세요.',
          ref: 'Rule 8.1.1',
        });
      }
      if (type === 'VC') {
        out.push({
          rule: '8.1.3',
          severity: 'illegal',
          msg: `${LABEL.VC} 중에는 공기역학 타면이 작동하지 않아 일반 선회를 할 수 없습니다.`,
          fix: 'Vertical Roll만 사용 가능합니다.',
          ref: 'Rule 8.1.3',
        });
      }
      if (type === 'VD') {
        out.push({
          rule: '8.2.3',
          severity: 'illegal',
          msg: `${LABEL.VD} 중에는 일반 선회가 원천적으로 불가능합니다.`,
          fix: 'Vertical Roll만 사용 가능합니다.',
          ref: 'Rule 8.2.3',
        });
      }
      if (type === 'UD') {
        out.push({
          rule: '8.2.2',
          severity: 'illegal',
          msg: `${LABEL.UD} 중에는 선회를 할 수 없습니다 (Slide 기동만 허용).`,
          fix: '급하강(SD)으로 바꾸면 선회를 자유롭게 병행할 수 있습니다.',
          ref: 'Rule 8.2.2',
        });
      }
      return out;
    }

    if (action.kind !== 'vfp') return out;

    // Rule 8.2.4 — LVL에서는 상승 VFP가 불가하다. HFP 1개 뒤 1레벨 자유 하강만 허용.
    if (ft === 'LVL') {
      const hfpUsed = state.fpSpent.filter(f => f.type === 'HFP').length;
      if (action.direction !== 'down' || action.levels !== 1 || hfpUsed < 1) {
        out.push({
          rule: '8.2.4',
          severity: 'illegal',
          msg: `수평 비행(LVL)에서는 상승할 수 없습니다. 자유 하강은 HFP ${hfpUsed ? '소모 후' : '1개를 먼저 소모한 후'} 1레벨만 가능합니다.`,
          fix: '상승하려면 SC/ZC/VC를 선언하세요. LVL을 유지하려면 HFP 1개 뒤 자유 하강 1레벨만 사용하세요.',
          ref: 'Rule 8.2.4',
        });
      }
      return out;
    }

    // ── VFP 비율 제한 (전체의 2/3) ──
    if (['SC', 'ZC', 'SD'].includes(ft)) {
      const maxVfp = Math.floor((state.fpBudget * 2) / 3);
      const used = state.fpSpent.filter(f => f.type === 'VFP').length;
      if (used >= maxVfp) {
        out.push({
          rule: '8.0',
          severity: 'illegal',
          msg: `${LABEL[ft]}에서 VFP는 전체 ${state.fpBudget} FP의 2/3인 ${maxVfp}개까지만 쓸 수 있는데 `
             + `이미 ${used}개를 사용했습니다.`,
          fix: `나머지는 HFP로 소모하세요. 최소 ${state.fpBudget - maxVfp} FP는 수평 전진이어야 합니다.`,
          ref: 'Rule 8.0',
        });
      }
    }

    // ── SC 선결 조건 ──
    if (ft === 'SC') {
      const required = ac.velocity[band].min + 1.0;
      if (state.speed < required) {
        out.push({
          rule: '8.1.2',
          severity: 'illegal',
          msg: `${LABEL.SC}는 시작 속도가 최소 속도보다 1.0 이상 빨라야 합니다. `
             + `${band} 밴드 최소 속도 ${ac.velocity[band].min.toFixed(1)} → 요구 ${required.toFixed(1)}, `
             + `현재 ${state.speed.toFixed(1)}.`,
          fix: '속도를 올리거나 줌 상승(ZC)을 사용하세요.',
          ref: 'Rule 8.1.2',
        });
      }
    }

    // ── ZC의 VFP당 획득 고도 ──
    if (ft === 'ZC') {
      // 피해 상태면 CCC가 감소한다 (Damage Effects §3).
      const factor = damageLimits(state.damage).climbFactor;
      const ccc = ac.climb[band] * factor;
      if (ccc <= 2.0 && action.levels > 1) {
        out.push({
          rule: '8.1.1',
          severity: 'illegal',
          msg: `${ac.title}의 ${band} 밴드 CCC는 ${ccc}${factor < 1 ? ` (피해 ×${factor})` : ''}입니다. CCC가 2.0 이하이면 `
             + `줌 상승은 VFP당 1레벨만 상승할 수 있는데 ${action.levels}레벨을 선택했습니다.`,
          fix: 'VFP당 1레벨씩 상승시키세요.',
          ref: 'Rule 8.1.1',
        });
      }
    }

    // ── UD 선결 조건 ──
    if (ft === 'UD' && state.prevFlightType !== 'LVL') {
      out.push({
        rule: '8.2.2',
        severity: 'illegal',
        msg: `${LABEL.UD}는 직전 턴이 수평 비행(LVL)일 때만 진입할 수 있는데 `
           + `직전 턴은 ${LABEL[state.prevFlightType]}였습니다.`,
        fix: '급하강(SD)을 사용하거나, 먼저 한 턴 수평 비행을 하세요.',
        ref: 'Rule 8.2.2',
      });
    }

    // ── VD의 VFP당 하강 레벨 (2~3) ──
    if (ft === 'VD' && action.levels < 2) {
      out.push({
        rule: '8.2.3',
        severity: 'illegal',
        msg: `${LABEL.VD}는 VFP 1개당 2레벨 또는 3레벨씩 하강해야 하는데 ${action.levels}레벨을 선택했습니다.`,
        fix: '2 또는 3레벨을 선택하세요.',
        ref: 'Rule 8.2.3',
      });
    }

    return out;
  },
};
