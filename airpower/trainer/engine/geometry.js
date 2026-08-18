import { distance, normalizeFacing, hexCenter } from './hex.js';

// Phase 1: 사격 기하. 9장(기총·로켓)과 14/15/17장(미사일)이 공유한다.
// 여기서 나오는 값은 전부 "규칙이 표를 찾을 때 쓰는 정수"다 — 소수는 내보내지 않는다.

/**
 * 사격 사거리 (Rule 9.1, 9.3).
 * 수평 헥스 거리에 고도차를 더한다. 고도 2레벨 = 1헥스로 환산(내림).
 */
export function rangeTo(from, to) {
  const dz = Math.abs(from.alt - to.alt);
  return distance(from.hex, to.hex) + Math.floor(dz / 2);
}

/**
 * 두 기체 사이의 실제 방위(0-11, 30도 단위). from에서 to를 바라보는 방향.
 * facing 0 = 화면상 위(-y)이고 시계방향으로 증가한다(hexCenter/facingRotation 규약).
 * 같은 헥스면 방위가 없으므로 null.
 */
export function bearing(from, to) {
  // hexSize는 비율만 쓰므로 아무 값이나 무방하다.
  const a = hexCenter(from.hex, 1);
  const b = hexCenter(to.hex, 1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return null;

  // atan2(dx, -dy): -y축이 0, 시계방향 증가.
  const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
  return normalizeFacing(Math.round(deg / 30));
}

/** 0/30/…/180 버킷으로. 표 조회는 항상 절대 각도로 한다. */
function toDegrees(steps) {
  const s = Math.abs(steps) > 6 ? 12 - Math.abs(steps) : Math.abs(steps);
  return s * 30;
}

/**
 * 편각 (Angle-Off, Rule 9.1).
 * 표적의 기수 대비, 사격자가 표적의 어느 쪽에 있는지. 0 = 정후방 꼬리물기.
 * Deflection Table 조회에 쓴다.
 */
export function angleOff(shooter, target) {
  const b = bearing(target, shooter);
  if (b === null) return 0;   // 동일 헥스: 편각 없음
  // 표적 기수의 정반대(꼬리) 방향에 사격자가 있으면 0도.
  const tail = normalizeFacing(target.facing + 6);
  return toDegrees(b - tail);
}

/**
 * 편각이 Line인지 Arc인지 (Damage rule-db §1).
 * 0°/180°만 Line/Arc가 갈린다. 사격자가 표적 기수축과 정확히 같은 방위선 위에
 * 있으면 Line, 헥스사이드 방위면 Arc다. 12방위 중 짝수만 헥스 중심 방향이므로
 * bearing의 홀짝으로 판정한다.
 */
export function angleOffIsLine(shooter, target) {
  const b = bearing(target, shooter);
  if (b === null) return false;
  return b % 2 === 0;
}

/**
 * 사격자 기준 표적이 놓인 arc (Rule 15.1 탐색기 사각, 17.x 레이더 각).
 * 0 = 정면. 60이면 "전방 60도 이내"류 판정에 그대로 비교한다.
 */
export function arcOf(shooter, target) {
  const b = bearing(shooter, target);
  if (b === null) return 0;
  return toDegrees(b - shooter.facing);
}

/** 표적이 사격자의 후방 몇 도 안에 있는지. IRM 후방 사각 판정용. */
export function rearArcOf(shooter, target) {
  const b = bearing(shooter, target);
  if (b === null) return 0;
  return toDegrees(b - normalizeFacing(shooter.facing + 6));
}
