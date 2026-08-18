import { angleOff, arcOf, rangeTo } from '../engine/geometry.js';
import { deflectionDrm, GUNSIGHT_DRM, PILOT_DRM, gunOf } from '../data/weapons.js';

// Rule 9.3 공대공 무유도 로켓.
// 로켓 명중표와 기체별 팩터는 현재 원본 데이터에 없으므로 rocket 프로필을 호출부가
// 명시적으로 준다. 추정 수치를 데이터 파일에 넣지 않는다.

const TURN_RANK = { EZ: 0, TT: 1, HT: 2, BT: 3, ET: 4 };

function violation(message, fix) {
  return { rule: '9.3', severity: 'error', msg: message, fix, ref: 'Rule 9.3' };
}

/** CCA 조건. 충족되면 명중 DRM -2를 준다. */
export function qualifiesForCca(shooter, {
  turnStartLockOn = false, maxTurnRate = 'EZ', maneuvered = false,
} = {}) {
  if (!turnStartLockOn) return false;
  if ((TURN_RANK[maxTurnRate] ?? TURN_RANK.ET) >= TURN_RANK.TT) return false;
  if (maneuvered) return false;
  const altitudeChange = shooter.fpSpent
    .filter(fp => fp.type === 'VFP')
    .reduce((total, fp) => total + fp.levels, 0);
  return altitudeChange <= 1;
}

/**
 * @param {{ factors: number, hit: number[], rating: number }} rocket
 * hit은 Air To Air Rocketry Table에서 팩터/사거리로 찾은 값이다.
 */
export function canRocketFire(shooter, target, {
  rocket = null, limitedRadarArc = null, gunShots = [], rocketShots = 0,
} = {}) {
  const out = [];
  if (!rocket || !Number.isFinite(rocket.factors) || rocket.factors <= 0) {
    return [violation('장착된 공대공 로켓 팩터가 없다.', '시나리오의 로켓 장착 수량을 지정한다.')];
  }
  if (limitedRadarArc === null) {
    return [violation('로켓의 제한 레이더 사각이 지정되지 않았다.', 'ADC의 제한 레이더 사각을 지정한다.')];
  }
  if (rangeTo(shooter, target) === 0) {
    out.push(violation('같은 헥스에서는 공대공 로켓을 발사할 수 없다.', '최소 1헥스 떨어진 뒤 발사한다.'));
  }
  if (rangeTo(shooter, target) > 4) {
    out.push(violation(`사거리 ${rangeTo(shooter, target)}헥스는 로켓 최대 4헥스를 넘는다.`, '4헥스 이내로 접근한다.'));
  }
  if (arcOf(shooter, target) > limitedRadarArc) {
    out.push(violation('표적이 제한 레이더 사각 밖에 있다.', '표적을 제한 레이더 사각 안에 둔다.'));
  }
  if (gunShots.length) {
    out.push(violation('같은 턴에 기관포와 공대공 로켓을 함께 쏠 수 없다.', '기관포 또는 로켓 중 하나만 선택한다.'));
  }
  if (rocketShots >= 1) {
    out.push(violation('공대공 로켓은 한 턴에 한 번만 일제사격할 수 있다.', '다음 턴에 발사한다.'));
  }
  return out;
}

/** Air To Air Rocketry Table의 명중 수치와 Rule 9.3 적용 DRM을 계산한다. */
export function rocketToHit(shooter, target, rocket, {
  maxTurnRate = 'EZ', pilot = 'average', ssgt = 0, radarRanging = 0,
  cca = false,
} = {}) {
  const range = rangeTo(shooter, target);
  if (!rocket?.hit || !Number.isFinite(rocket.hit[range])) {
    throw new Error(`로켓 ${rocket?.factors ?? '?'}팩터의 사거리 ${range} 명중표가 없다`);
  }
  if (!Number.isFinite(rocket.rating)) {
    throw new Error(`로켓 ${rocket.factors}팩터의 공격력이 없다`);
  }
  const targetGun = gunOf(target.aircraftId);
  const drms = [
    { label: '표적 크기', value: targetGun?.size ?? 0 },
    { label: '편각', value: deflectionDrm(angleOff(shooter, target)) },
    { label: '조준경', value: GUNSIGHT_DRM[maxTurnRate] ?? 0 },
    { label: '파일럿', value: PILOT_DRM[pilot] },
  ];
  if (ssgt) drms.push({ label: 'SSGT', value: ssgt });
  if (radarRanging) drms.push({ label: 'Radar Ranging', value: radarRanging });
  if (cca) drms.push({ label: 'CCA', value: -2 });

  const total = drms.reduce((sum, drm) => sum + drm.value, 0);
  return {
    range, base: rocket.hit[range], drms, total, target: rocket.hit[range] - total,
    factors: rocket.factors, rating: rocket.rating,
  };
}

/** 1d10 명중과 로켓의 고정 피해 보정(-2)을 함께 반환한다. */
export function resolveRocketShot(shooter, target, rocket, roll, options = {}) {
  const result = rocketToHit(shooter, target, rocket, options);
  const hit = roll <= result.target;
  return { ...result, roll, hit, rating: hit ? result.rating : 0, damageDrm: hit ? -2 : 0 };
}
