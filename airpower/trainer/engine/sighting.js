import { rangeTo } from './geometry.js';
import { crewDrm } from '../rules/crew.js';

// ADC 시정 수치가 아직 정규화되지 않은 카드는 기본값 7을 쓴다. 카드별 수치가
// 추가되면 visibility 속성만 넣으면 된다.
export function visibilityOf(unit) {
  return unit.visibility ?? 7;
}

export function canVisuallySight(observer, target) {
  return rangeTo(observer, target) <= visibilityOf(target) * 4;
}

/** Rule 11.1: 패드락은 자동 유지, 그 밖의 표적은 1d10 <= Visibility로 판정. */
export function resolveVisualSighting(observer, target, { padlocked = false, roll = null } = {}) {
  const range = rangeTo(observer, target);
  if (padlocked) return { sighted: true, padlocked: true, range, reason: 'padlock' };
  const maximum = visibilityOf(target) * 4;
  if (range > maximum) return { sighted: false, padlocked: false, range, maximum, reason: 'out-of-range' };
  if (!Number.isInteger(roll) || roll < 1 || roll > 10) throw new Error(`주사위는 1~10이어야 합니다: ${roll}`);
  const drm = crewDrm(observer, 'sighting') + (observer.eyesight === 'Excellent' ? -1 : observer.eyesight === 'Poor' ? 1 : 0);
  const score = roll + drm;
  return { sighted: score <= visibilityOf(target), padlocked: score <= visibilityOf(target), range, maximum, roll, drm, score };
}
