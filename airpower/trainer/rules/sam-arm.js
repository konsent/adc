// 제25장 지대공 미사일(SAM) + 제26장 대레이더 미사일(ARM).
// T-6 와일드 위즐에 필요한 범위만 구현한다. 전체 유도 방식 중 T-6에 등장하는
// SA-2(CG 지령 유도)와 AGM-45/AGM-78 ARM만 다룬다.
import { distance } from '../engine/hex.js';

const d10 = () => 1 + Math.floor(Math.random() * 10);

/** T-6 F-105G 적재량: 스테이션 1·5 주니, 2 슈라이크, 4 표준 ARM, 3 삼중랙 750lb 3발. */
export const T6_STORES = { gun: Infinity, rocket: 2, bomb: 3, shrike: 1, standard: 1 };

export const ARM_PROFILE = {
  shrike: { label: 'AGM-45 슈라이크', range: 14, rating: 4, seeker: 'plain', selfDefense: false },
  standard: { label: 'AGM-78 스탠더드 ARM', range: 24, rating: 6, seeker: 'memory', selfDefense: false },
};

/**
 * Rule 25.1 EWR Passdown. CCU 4헥스 이내의 포대만 -3 DRM을 받는다.
 * T-6에는 CCU가 없으므로 호출부가 ccuLinked를 넘긴다.
 */
export function passdown(roll = d10(), ccuLinked = false) {
  const success = ccuLinked && roll <= 7;
  return { success, roll, drm: success ? -3 : 0 };
}

/**
 * Rule 25.2/25.3 TTR 락온. 레이더가 꺼져 있거나 최소 고도 미만이면 원천 차단된다.
 * TFF 적기는 MTI 탑재 레이더만, 그것도 20헥스 이내에서만 잡는다.
 */
export function samLockOn(battery, aircraft, { roll = d10(), passdownDrm = 0, opportunity = 2 } = {}) {
  if (battery.killed) return { locked: false, reason: '포대가 파괴되었습니다.' };
  if (battery.radarOff) return { locked: false, reason: '레이더가 셧다운 상태입니다.' };
  if (battery.radarDisabled) return { locked: false, reason: '레이더가 ARM으로 영구 파괴되었습니다.' };
  if (battery.suppressed) return { locked: false, reason: '포대가 억제되어 락온이 해제됩니다.' };
  // Rule 25.2 QRC: 일반 고정식 포대는 두 번째 기회에만 사격할 수 있다.
  if (!battery.qrc && opportunity === 1) return { locked: false, reason: 'QRC 미탑재 포대는 두 번째 락온 기회에만 사격합니다.' };
  if (battery.ready <= 0) return { locked: false, reason: '즉응탄이 소진되었습니다.' };
  const range = distance(battery.hex, aircraft.hex);
  if (range > battery.range) return { locked: false, reason: `사거리 ${battery.range}헥스를 벗어났습니다.`, range };
  if (aircraft.tff && !battery.mti) return { locked: false, reason: 'TFF 침투 기체는 MTI 미탑재 레이더로 탐지할 수 없습니다.', range };
  if (aircraft.tff && range > 20) return { locked: false, reason: 'TFF 기체는 20헥스 이내에서만 탐지됩니다.', range };
  if (!aircraft.tff && aircraft.alt < battery.minAlt) return { locked: false, reason: `최소 고도 ${battery.minAlt} 미만은 락온할 수 없습니다.`, range };
  // Rule 25.0: TFF 표적 타격 시 미사일 명중 롤에 +N 패널티(T+N 표기).
  const tffPenalty = aircraft.tff ? (battery.tffPenalty ?? 0) : 0;
  const score = roll + passdownDrm + (aircraft.chaffActive ? 2 : 0);
  const locked = score <= battery.lock;
  return { locked, roll, score, target: battery.lock, range, tffPenalty, reason: locked ? null : '락온 판정 실패.' };
}

/** Rule 25.0 발사 및 명중. CG 유도는 120도 아크 유지가 전제된다. */
export function samShot(battery, aircraft, { roll = d10(), tffPenalty = 0 } = {}) {
  const target = battery.hit - (aircraft.jinking ? 2 : 0) - tffPenalty;
  return { hit: roll <= target, roll, target, rating: battery.rating };
}

/**
 * Rule 26.2 ARM 3단계 프로토콜. F-105G는 APR-38급 RHAW를 탑재해
 * 급강하 방위각 측정(Fix)을 면제받지만, 표적 레이더가 켜져 있어야 탐지된다.
 */
export function canLaunchArm(shooter, battery, kind, { armAttacksUsed = 0 } = {}) {
  const arm = ARM_PROFILE[kind];
  if (!arm) return '알 수 없는 ARM입니다.';
  if (battery.killed) return '파괴된 포대는 ARM 표적이 될 수 없습니다.';
  if (!battery.radar) return '해당 유닛은 레이더 전파원이 아닙니다.';
  if (battery.radarDisabled) return '표적 레이더가 이미 파괴되어 전파를 방출하지 않습니다.';
  if (battery.radarOff) return '표적 레이더가 셧다운 상태여서 전파를 탐지할 수 없습니다.';
  // Rule 26.1 Straight Shot: 모기는 수평 또는 하강 비행이어야 하며 선회가 없어야 한다.
  if (!['LVL', 'SD', 'UD', 'VD'].includes(shooter.flightType)) return 'ARM 직선 사격은 수평 또는 하강 비행에서만 가능합니다.';
  if (shooter.turnProgress) return 'ARM 발사 순간에는 선회 중이 아니어야 합니다.';
  const range = distance(shooter.hex, battery.hex);
  if (range > arm.range) return `${arm.label} 사거리(${arm.range}헥스)를 벗어났습니다.`;
  // Rule 26.2 3단계: 턴당 최대 2발.
  if (armAttacksUsed >= 2) return '턴당 ARM은 최대 2발까지 발사할 수 있습니다.';
  return null;
}

/**
 * Rule 26.4 TGL. ARM은 지형/위장 DRM을 적용하지 않고 순수 주사위로 정산한다.
 * 짝수 명중 + D 이상이면 레이더 영구 파괴, 짝수 + 억제면 1d10<=3 추가 판정.
 */
export function resolveArm(battery, kind, { hitRoll = d10(), damageRoll = d10(), tglRoll = d10() } = {}) {
  const arm = ARM_PROFILE[kind];
  const hit = hitRoll <= 7;
  if (!hit) return { arm: arm.label, hit: false, hitRoll, unit: { ...battery } };
  // Rule 26.4: 차량 계열 피해 상한은 2D.
  const result = damageRoll <= 2 ? '2D' : damageRoll <= 5 ? 'D' : 'S';
  const hits = (battery.hits ?? 0) + (result === '2D' ? 2 : result === 'D' ? 1 : 0);
  const killed = hits >= (battery.fragile ? 2 : 3);
  const even = hitRoll % 2 === 0;
  const radarDisabled = battery.radarDisabled
    || (even && (result === 'D' || result === '2D'))
    || (even && result === 'S' && tglRoll <= 3);
  return {
    arm: arm.label, hit: true, hitRoll, damageRoll, result, radarDisabled, tglRoll,
    unit: { ...battery, hits, killed, suppressed: !killed, radarDisabled, radarOff: radarDisabled ? false : battery.radarOff },
  };
}

/** Rule 26.5 긴급 셧다운 / 재가동. 둘 다 1d10 <= 6. */
export function radarShutdown(battery, roll = d10()) {
  if (!battery.radar || battery.radarDisabled || battery.radarOff) return null;
  const success = roll <= 6;
  return { success, roll, unit: success ? { ...battery, radarOff: true, locked: false } : { ...battery } };
}

export function radarReactivate(battery, roll = d10()) {
  if (!battery.radarOff || battery.radarDisabled) return null;
  const success = roll <= 6;
  return { success, roll, unit: success ? { ...battery, radarOff: false } : { ...battery } };
}
