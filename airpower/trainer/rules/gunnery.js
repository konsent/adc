import { rangeTo, angleOff, angleOffIsLine, rearArcOf } from '../engine/geometry.js';
import { gunOf, deflectionDrm, GUNSIGHT_DRM, DAMAGE_DRM, PILOT_DRM } from '../data/weapons.js';
import { damageLimits } from './damage-effects.js';

// Phase 2: Rule 9.1 공대공 기총.
// 이동 규칙 12개와 달리 사격은 두 기체를 본다. 그래서 rules/index.js 레지스트리에는
// 넣지 않고, duel 쪽에서 명시적으로 부른다. check(state, action) 계약을 억지로
// 맞추면 상대 기체를 action에 숨겨 넣어야 해서 오히려 지저분해진다.
// ponytail: 다중 기관포(내장+포드) 동시 사격은 훈련 기체에 포드가 없어서 뺐다.

const CLIMBING = ['SC', 'ZC', 'VC'];
const DIVING = ['SD', 'VD'];

/** 이번 턴 사격 이후 몇 FP를 더 갔는지. Rule 9.1: 사격 사이 최소 1 FP. */
function fpSince(shooter, shots) {
  const last = shots.length ? shots[shots.length - 1].fpIndex : -1;
  return shooter.fpSpent.length - last;
}

/**
 * ET 회복 판정 (Rule 9.1).
 * 이번 턴 속도의 1/2(반내림)만큼을 ET 미만으로 전진했으면 ET 페널티가 풀린다.
 */
function recoveredFromEt(shooter) {
  const need = Math.floor(shooter.speed / 2);
  const rate = shooter.turnProgress?.rate ?? 'EZ';
  if (rate === 'ET') return false;
  // 현재 ET가 아니고, 완만하게 간 FP가 요구치 이상이면 회복.
  return shooter.fpSpent.length >= need;
}

/**
 * 사격 가능 여부 (Rule 9.1 사격 제한 조건).
 * @returns 위반 배열. 비어 있으면 쏠 수 있다.
 */
export function canFire(shooter, target, { shots = [], maxTurnRate = null, spotted = true } = {}) {
  const gun = gunOf(shooter.aircraftId);
  const out = [];
  const v = (msg, fix) => out.push({ rule: '9.1', severity: 'error', msg, fix, ref: 'Rule 9.1' });

  // ADC에 기총 항목이 없으면 그 기체는 기총이 없는 기체다.
  if (!gun) {
    v('이 기체는 기관포가 없다.', '미사일이나 로켓을 쓴다.');
    return out;
  }
  if (!spotted) v('시각 탐지되지 않은 표적에는 사격할 수 없다.', '먼저 표적을 탐지한다.');

  // Crippled 기체는 공격 자체가 불가 (Damage Effects §3).
  if (!damageLimits(shooter.damage).canAttack) {
    v(`${shooter.damage} 피해 상태에서는 공격할 수 없다.`, '교전을 이탈한다.');
  }

  // ammo가 ADC에서 아직 안 읽힌(null) 경우는 탄약 제한을 걸지 않는다.
  const ammo = shooter.ammo ?? gun.ammo;
  if (ammo !== null && ammo <= 0) v('탄약이 없다.', '탄약을 보급받는다.');

  const range = rangeTo(shooter, target);
  if (range > 2) v(`사거리 ${range}헥스는 기총 최대 2헥스를 넘는다.`, '2헥스 이내로 접근한다.');

  // 3차원 각도 한계
  const dz = target.alt - shooter.alt;
  if (CLIMBING.includes(shooter.flightType) && dz < 0) {
    v('상승 중에는 자기보다 낮은 표적을 쏠 수 없다.', '수평 비행으로 전환한다.');
  }
  if (DIVING.includes(shooter.flightType) && dz > 0) {
    v('하강 중에는 자기보다 높은 표적을 쏠 수 없다.', '수평 비행으로 전환한다.');
  }
  if (shooter.flightType === 'LVL') {
    const sameHex = shooter.hex.q === target.hex.q && shooter.hex.r === target.hex.r;
    if (sameHex && dz !== 0) v('수평 비행 중 동일 헥스 사격은 같은 고도에서만 가능하다.', '고도를 맞춘다.');
    if (!sameHex && Math.abs(dz) > 1) v('수평 비행 중 다른 헥스 사격은 고도차 1레벨까지다.', '고도차를 줄인다.');
  }

  // 선회율 — ET는 회복 전까지 사격 자체가 불가
  const rate = maxTurnRate ?? shooter.turnProgress?.rate ?? 'EZ';
  if (rate === 'ET' && !recoveredFromEt(shooter)) {
    v('ET 선회 중이거나 직후에는 사격할 수 없다.', `속도의 1/2(${Math.floor(shooter.speed / 2)} FP)을 ET 미만으로 비행한다.`);
  }

  // 턴당 2회, 사이에 최소 1 FP
  if (shots.length >= 2) v('한 턴에 기총은 2회까지다.', '다음 턴에 쏜다.');
  else if (shots.length && fpSince(shooter, shots) < 1) {
    v('사격 사이에 최소 1 FP를 이동해야 한다.', '1 FP 전진 후 쏜다.');
  }

  // Rule 9.1: 롤 직후 FP에서는 사격 불가
  const lastFp = shooter.fpSpent[shooter.fpSpent.length - 1];
  if (lastFp?.type === 'ROLL') v('롤 기동 직후 FP에서는 사격할 수 없다.', '1 FP 더 비행한 뒤 쏜다.');

  return out;
}

// ── Phase 3: 정밀 조준 보조 (Rule 9.4) ───────────────────────────────

/**
 * SSGT 지속 추적 조준 (Rule 9.4).
 * 표적의 후방 60도 이내 + 6헥스 이내에서 추적선을 따라 전진할 때 성립한다.
 * 추적 중 속도의 1/3(반내림) FP마다 -1, 최대 -2.
 *
 * trackedFp = 추적 조건을 유지한 채 전진한 FP 수. 표적이 방어 선제기동을 걸면
 * 호출부가 0으로 리셋한다(Rule 9.4 해제 조건).
 */
export function ssgtDrm(shooter, target, trackedFp = 0) {
  if (rangeTo(shooter, target) > 6) return 0;
  if (angleOff(shooter, target) > 60) return 0;

  const step = Math.floor(shooter.speed / 3);
  if (step < 1) return 0;
  // 0을 부호 반전하면 -0이 나와 UI에 "-0"으로 찍힌다.
  return 0 - Math.min(2, Math.floor(trackedFp / step)) || 0;
}

/** SSGT 조건이 이번 FP에 성립하는지. 호출부가 trackedFp를 셀 때 쓴다. */
export function ssgtTracking(shooter, target) {
  return rangeTo(shooter, target) <= 6 && angleOff(shooter, target) <= 60;
}

/**
 * 레이더 거리 측정 (Rule 9.4).
 * 등급별 발동 조건이 다르다. 락온이 있으면 자동 성공, 없으면 1d10 <= lockOn.
 * @returns { drm, grade, needsRoll, active }
 */
export function radarRangingDrm(shooter, target, {
  ssgtActive = false, lockedOn = false, roll = null, lockOnRating = null,
} = {}) {
  const gun = gunOf(shooter.aircraftId);
  const grade = gun?.rr ?? null;
  const none = { drm: 0, grade, needsRoll: false, active: false };
  if (!grade) return none;

  // 등급별 기하 조건
  const qualifies =
    grade === 'IG' ? true
    : grade === 'CA' ? rearArcOf(target, shooter) <= 90
    : /* RE */ ssgtActive;
  if (!qualifies) return none;

  // 락온이 없으면 판정 주사위가 필요하다.
  if (!lockedOn) {
    if (roll === null || lockOnRating === null) return { ...none, needsRoll: true };
    if (roll > lockOnRating) return { ...none, needsRoll: true };
  }
  return { drm: -1, grade, needsRoll: false, active: true };
}

/**
 * 명중 판정에 쓸 DRM 스택 (Rule 9.1).
 * 배열로 쌓아서 UI가 "왜 이 숫자인지" 그대로 보여줄 수 있게 한다.
 */
export function toHit(shooter, target, {
  snap = false, maxTurnRate = null, pilot = 'average', ssgt = 0, radarRanging = 0,
} = {}) {
  const gun = gunOf(shooter.aircraftId);
  const targetGun = gunOf(target.aircraftId);
  const range = rangeTo(shooter, target);
  if (!gun) throw new Error(`${shooter.aircraftId}는 기관포가 없다`);
  if (gun.hit === null) throw new Error(`${shooter.aircraftId}의 ADC 사격표가 아직 없다`);
  // rating이 없으면 명중해도 피해를 굴릴 수 없다. 0으로 넘기면 조용히 무피해가 된다.
  if (gun.rating === null) throw new Error(`${shooter.aircraftId}의 ADC 공격력(A/A)이 아직 없다`);
  const base = gun.hit[Math.min(range, 2)];

  const rate = maxTurnRate ?? shooter.turnProgress?.rate ?? 'EZ';
  const drms = [
    { label: '표적 크기', value: targetGun?.size ?? 0 },
    { label: '편각', value: deflectionDrm(angleOff(shooter, target), angleOffIsLine(shooter, target)) },
    { label: '조준경', value: GUNSIGHT_DRM[rate] ?? 0 },
    { label: '사격자 피해', value: DAMAGE_DRM[shooter.damage ?? 'none'] },
    { label: '파일럿', value: PILOT_DRM[pilot] },
  ];
  if (snap) drms.push({ label: 'Snap Shot', value: 1 });
  if (ssgt) drms.push({ label: 'SSGT', value: ssgt });
  if (radarRanging) drms.push({ label: 'Radar Ranging', value: radarRanging });

  // DRM은 난이도 페널티다. 명중 목표에서 빼야 어려워진다.
  const total = drms.reduce((s, d) => s + d.value, 0);
  return { base, range, drms, total, target: base - total, ammo: snap ? 0.5 : 1 };
}

/** 주사위를 받아 명중 여부를 낸다. roll은 1d10. */
export function resolveShot(shooter, target, roll, options = {}) {
  const t = toHit(shooter, target, options);
  const hit = roll <= t.target;
  const gun = gunOf(shooter.aircraftId);
  return {
    ...t, roll, hit,
    // Snap Shot 명중은 Damage Table 한 등급 하향 (Rule 9.1).
    rating: hit ? gun.rating : 0,
    downgrade: hit && options.snap,
  };
}
