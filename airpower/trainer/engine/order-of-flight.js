import { AIRCRAFT, bandOf } from '../data/aircraft.js';
import { distance, hexCenter } from './hex.js';

/**
 * 우위 범주 (Rule 12.2). 낮은 번호가 먼저 기동한다.
 * 상태 플래그는 시나리오/미사일 엔진이 부여한다. 해당 시스템이 없는 시나리오에서는
 * 기존처럼 4~6번 전술 위치만으로 정렬된다.
 */
export const CATEGORY = {
  DEPARTED: 1, STALLED: 2, ENGAGED: 3, DISADVANTAGED: 4,
  NONADVANTAGED: 5, ADVANTAGED: 6, UNSPOTTED: 7, UNDETECTED: 8,
};

export const CATEGORY_LABEL = {
  1: 'Departed(조종 불능)', 2: 'Stalled(스톨)', 3: 'Engaged(회피)',
  4: 'Disadvantaged(불리)', 5: 'Nonadvantaged(등가)', 6: 'Advantaged(유리)',
  7: 'Unspotted(미포착)', 8: 'Undetected(미탐지)',
};

/** a가 b의 후방 사각(150~180도)을 9헥스·고도차 이내에서 물고 있는가 (Rule 12.2). */
export function isOnTail(a, b) {
  if (distance(a.hex, b.hex) > 9) return false;
  if (Math.abs(a.alt - b.alt) > 9) return false;
  return sixOClock(a, b);
}

/** b 기준으로 a가 b의 6시 방향(후방 150~180도)에 있는지. */
function sixOClock(a, b) {
  // 맵과 같은 좌표계를 쓴다 (flat-top, facing 0 = 위쪽 -y, 시계 방향).
  const pa = hexCenter(a.hex);
  const pb = hexCenter(b.hex);
  const v = { x: pa.x - pb.x, y: pa.y - pb.y };
  const len = Math.hypot(v.x, v.y);
  if (!len) return false;
  const noseAngle = b.facing * 30 * Math.PI / 180;
  const nose = { x: Math.sin(noseAngle), y: -Math.cos(noseAngle) };
  // 기수 반대쪽 150~180도 = cos <= -cos(30도)
  return (nose.x * v.x + nose.y * v.y) / len <= -Math.cos(Math.PI / 6);
}

/** 스톨 여부: 시작 속도가 기체 최소 속도 미만 (Rule 12.2 범주 2). */
function isStalled(jet) {
  const min = AIRCRAFT[jet.aircraftId]?.velocity[bandOf(jet.alt)]?.min;
  return min !== undefined && jet.speed < min;
}

/**
 * 한 기체의 우위 범주를 정한다. foes는 반대편 기체 목록.
 * 격추(K)된 기체는 null을 돌려주어 순서에서 빠진다.
 */
export function categorize(jet, foes) {
  if (jet.damage === 'K') return null;
  if (jet.departed) return CATEGORY.DEPARTED;
  if (isStalled(jet)) return CATEGORY.STALLED;
  if (jet.engaged) return CATEGORY.ENGAGED;
  const live = foes.filter(f => f.damage !== 'K');
  if (jet.radarDetectedByEnemy === false) return CATEGORY.UNDETECTED;
  if (jet.sightedByEnemy === false) return CATEGORY.UNSPOTTED;
  const hunted = live.some(f => isOnTail(f, jet));
  const hunting = live.some(f => isOnTail(jet, f));
  if (hunted && !hunting) return CATEGORY.DISADVANTAGED;
  if (hunting && !hunted) return CATEGORY.ADVANTAGED;
  return CATEGORY.NONADVANTAGED;
}

/**
 * 이동 순서를 정산한다 (Rule 12.2 → 12.1).
 * units: [{ id, side, jet }] 형태. roll(id)은 주도권용 1d10을 돌려주는 함수.
 * 범주가 낮을수록, 같은 범주면 주도권이 낮을수록 먼저 움직인다.
 */
export function orderOfFlight(units, roll) {
  const bySide = { player: [], opponent: [] };
  units.forEach(u => bySide[u.side]?.push(u.jet));
  return units
    .map(u => {
      const foes = u.side === 'player' ? bySide.opponent : bySide.player;
      return { ...u, category: categorize(u.jet, foes), initiative: roll(u.id) };
    })
    .filter(u => u.category !== null)
    .sort((a, b) => a.category - b.category || a.initiative - b.initiative
      || String(a.id).localeCompare(String(b.id)));
}
