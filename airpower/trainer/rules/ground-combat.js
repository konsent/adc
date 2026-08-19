import { distance } from '../engine/hex.js';

export const T5_STORES = { gun: Infinity, rocket: 2, bomb: 6, napalm: 3 };

export function groundResult(fas, defense, roll, drm = 0) {
  const ratio = Math.max(1, Math.floor(fas / defense));
  const score = roll - drm;
  const threshold = ratio >= 6 ? [8, 6, 4, 2] : ratio >= 3 ? [6, 4, 2, 1] : ratio >= 2 ? [4, 2, 1, 1] : [2, 1, 1, 1];
  const result = score <= threshold[3] ? 'K' : score <= threshold[2] ? '2D' : score <= threshold[1] ? 'D' : score <= threshold[0] ? 'S' : '-';
  return { ratio, result, score };
}

export function applyGroundResult(unit, result) {
  if (unit.killed || result === '-') return { ...unit };
  if (result === 'K') return { ...unit, killed: true, suppressed: false };
  const hits = (unit.hits ?? 0) + (result === '2D' ? 2 : result === 'D' ? 1 : 0);
  return { ...unit, hits, suppressed: true, killed: hits >= (unit.fragile ? 2 : 3) };
}

export function attackProfile(kind) {
  return { gun: { fas: 4, range: 4, label: '기총' }, rocket: { fas: 6, range: 9, label: '주니 로켓' }, bomb: { fas: 4, range: 6, label: '500lb HE 폭탄' }, napalm: { fas: 5, range: 3, label: '750lb 네이팜' } }[kind];
}

export function canAttackGround(shooter, target, kind, { aimedFp = 0 } = {}) {
  const weapon = attackProfile(kind);
  if (!weapon) return '알 수 없는 공대지 무장입니다.';
  if (target.killed) return '파괴된 지상 유닛은 공격할 수 없습니다.';
  if (shooter.tff && kind === 'gun') return 'TFF 중 기총 소사는 지원하지 않습니다. TFF를 이탈하거나 로켓/레이다운 폭격을 사용하십시오.';
  if (shooter.tff && kind === 'rocket' && shooter.alt !== target.elevation) return 'TFF 로켓은 표적과 같은 지형 표고에서만 쏠 수 있습니다.';
  if (shooter.flightType !== 'LVL' && !['SD', 'UD'].includes(shooter.flightType) && !shooter.tff) return '공대지 공격은 수평 또는 하강 비행에서만 가능합니다.';
  if (distance(shooter.hex, target.hex) > weapon.range) return `${weapon.label} 사거리(${weapon.range}헥스)를 벗어났습니다.`;
  if (aimedFp < 1) return '공대지 공격 전 최소 1 FP의 직선 조준 비행이 필요합니다.';
  if (kind === 'gun' && shooter.alt - target.elevation > 1 && !['SD', 'UD'].includes(shooter.flightType)) return '수평 기총 소사는 표적보다 고도 1레벨 이내여야 합니다.';
  if (kind === 'napalm' && shooter.alt > 1 && !shooter.tff) return '네이팜은 고도 1 초과 시 명중 페널티가 큽니다. 저고도로 진입하십시오.';
  return null;
}

export function resolveGroundAttack(shooter, target, kind, roll, options = {}) {
  const weapon = attackProfile(kind);
  let fas = weapon.fas;
  let drm = options.aimedFp >= Math.floor(shooter.speed / 3) * 2 ? -2 : options.aimedFp >= Math.floor(shooter.speed / 3) ? -1 : 0;
  if (shooter.tff && kind === 'rocket') drm += 2;
  if (kind === 'napalm') drm += Math.max(0, shooter.alt - 1);
  if (kind === 'bomb' || kind === 'napalm') fas = Math.ceil(fas * 2 / 3);
  const combat = groundResult(fas, target.defense, roll, drm);
  return { ...combat, fas, drm, weapon: weapon.label, unit: applyGroundResult(target, combat.result) };
}

export function resolveAaa(aaa, aircraft, roll) {
  if (aaa.killed || aaa.suppressed || aaa.outOfAmmo || distance(aaa.hex, aircraft.hex) > aaa.range) return null;
  const target = aaa.hit + (aircraft.tff ? -1 : 0) + (aircraft.damage && aircraft.damage !== 'none' ? 1 : 0);
  return { hit: roll <= target, target, rating: aaa.rating, roll };
}

export function vcAssault(vcUnits, greenBeret, roll) {
  const attackers = vcUnits.filter(unit => !unit.killed && !unit.suppressed && distance(unit.hex, greenBeret.hex) === 1);
  const drm = attackers.reduce((sum, unit) => sum + (unit.hits ?? 0), 0);
  const combat = groundResult(attackers.length, greenBeret.defense, roll, drm);
  return { attackers: attackers.length, drm, ...combat, unit: applyGroundResult(greenBeret, combat.result) };
}
