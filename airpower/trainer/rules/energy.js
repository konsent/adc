import { AIRCRAFT, bandOf, dragFor, powerValue, clampAccel } from '../data/aircraft.js';
import { isClimbing, isDiving } from '../engine/state.js';
import { damageLimits } from './damage-effects.js';

/** 상승 비행 타입별 레벨당 Decel (Rule 6.2) */
const CLIMB_DECEL = { SC: 0.5, ZC: 1.0, VC: 1.5 };

/** 지속 선회 추가 30도당 Decel (Rule 7.2) */
const BLEED_DECEL = { normal: 1.0, high: 1.5, low: 0.5 };

/** 이번 턴 고도 변화량 (VFP 기준). */
function altitudeDelta(state) {
  return state.fpSpent
    .filter(f => f.type === 'VFP')
    .reduce((sum, f) => sum + f.levels, 0);
}

/**
 * 턴 종료 가감속 정산. 플레이어 입력 채점의 정답이기도 하다.
 */
export function settle(state) {
  const ac = AIRCRAFT[state.aircraftId];
  const band = bandOf(state.alt);
  const accel = [];
  const decel = [];

  // ── Accel ──
  if (state.power === 'AB' || state.power === 'MIL') {
    // 피해 상태면 A/B·Mil 가속 포인트가 반감된다 (Damage Effects §3).
    const factor = damageLimits(state.damage).accelFactor;
    // ponytail: 고도 감쇠(§4)는 이미 기체별 power 밴드 표에 반영돼 있어 다시 곱하지 않는다.
    const v = clampAccel(ac, state.power, band, state.powerAccel) * factor;
    if (v > 0) accel.push({ label: `${state.power} 파워${factor < 1 ? ` (피해 ×${factor})` : ''}`, value: v });
  }
  if (state.accelCarry > 0) {
    accel.push({ label: 'Accel Carry 이월', value: state.accelCarry });
  }
  if (isDiving(state.flightType)) {
    const levels = altitudeDelta(state);
    if (levels > 0) accel.push({ label: `하강 ${levels}레벨`, value: levels * 1.0 });
  }

  // ── Decel ──
  if (state.power === 'Idle' || state.power === 'Spbr') {
    decel.push({ label: `${state.power} 파워`, value: powerValue(ac, state.power, band) });
  }
  if (state.decelCarry > 0) {
    decel.push({ label: 'Decel Carry 이월', value: state.decelCarry });
  }
  // 순항 속도 초과 페널티
  if ((state.power === 'Idle' || state.power === 'Norm') && state.speed > ac.cruise) {
    decel.push({ label: `순항 속도(${ac.cruise}) 초과`, value: 1.0 });
  }
  // 선회 드래그
  if (state.turnProgress && state.facingChanges > 0) {
    const d = dragFor(ac, state.turnProgress.rate, state.speed);
    if (d) decel.push({ label: `${state.turnProgress.rate} 선회 드래그`, value: d });
  }
  // 지속 선회 (2회 이상 회전 시 추가분마다)
  if (state.facingChanges >= 2) {
    const extra = state.facingChanges - 1;
    const per = BLEED_DECEL[ac.traits.bleedRate];
    decel.push({ label: `지속 선회 ${extra}회 추가`, value: extra * per });
  }
  // 상승 감속
  if (isClimbing(state.flightType)) {
    const levels = altitudeDelta(state);
    if (levels > 0) {
      const per = CLIMB_DECEL[state.flightType];
      decel.push({ label: `${state.flightType} 상승 ${levels}레벨`, value: levels * per });
    }
  }

  const totalAccel = accel.reduce((s, x) => s + x.value, 0);
  const totalDecel = decel.reduce((s, x) => s + x.value, 0);
  const net = totalAccel - totalDecel;

  // ── 속도 변화 ──
  const step = ac.traits.rapidAccel && net > 0 ? 1.5 : 2.0;
  let speedChange = 0;
  let newAccelCarry = 0;
  let newDecelCarry = 0;

  if (net > 0) {
    const steps = Math.floor(net / step);
    speedChange = steps * 0.5;
    newAccelCarry = Math.min(net - steps * step, 1.5);
  } else if (net < 0) {
    const steps = Math.floor(-net / 2.0);
    speedChange = -steps * 0.5;
    newDecelCarry = Math.min(-net - steps * 2.0, 1.5);
  }

  // ── MMVC 한계 (Rule 6.3) ──
  let newSpeed = state.speed + speedChange;
  const env = ac.velocity[band];
  const ceiling = isDiving(state.flightType) ? env.dive : env.max;
  if (ceiling !== null && newSpeed > ceiling) {
    newSpeed = ceiling;
    newAccelCarry = Math.min(newAccelCarry, 1.5);
  }

  return {
    accel, decel, totalAccel, totalDecel, net,
    speedChange: newSpeed - state.speed,
    newSpeed,
    accelCarry: newAccelCarry,
    decelCarry: newDecelCarry,
  };
}

/** 플레이어가 직접 입력한 정산값을 채점한다. */
export function gradeSettlement(state, input) {
  const correct = settle(state);
  const out = [];
  const near = (a, b) => Math.abs(a - b) < 0.001;

  if (!near(input.totalAccel, correct.totalAccel)) {
    out.push({
      rule: '6.2',
      severity: 'illegal',
      msg: `총 Accel을 ${input.totalAccel}로 입력했지만 정답은 ${correct.totalAccel}입니다.`,
      fix: '내역: ' + (correct.accel.map(x => `${x.label} +${x.value}`).join(', ') || '없음'),
      ref: 'Rule 6.2',
    });
  }
  if (!near(input.totalDecel, correct.totalDecel)) {
    out.push({
      rule: '6.2',
      severity: 'illegal',
      msg: `총 Decel을 ${input.totalDecel}로 입력했지만 정답은 ${correct.totalDecel}입니다.`,
      fix: '내역: ' + (correct.decel.map(x => `${x.label} -${x.value}`).join(', ') || '없음'),
      ref: 'Rule 6.2',
    });
  }
  if (!near(input.newSpeed, correct.newSpeed)) {
    out.push({
      rule: '6.2',
      severity: 'illegal',
      msg: `새 속도를 ${input.newSpeed}로 입력했지만 정답은 ${correct.newSpeed}입니다.`,
      fix: `순 가감속 ${correct.net.toFixed(1)} → 속도 변화 ${correct.speedChange.toFixed(1)}. `
         + '순 포인트 2.0마다 속도 0.5가 변합니다.',
      ref: 'Rule 6.2',
    });
  }
  return out;
}

export default {
  id: '6.2',
  name: '에너지 정산',
  tier: 'basic',
  lesson: 3,
  check() { return []; },   // 정산은 턴 종료 시 gradeSettlement로 채점한다
};
