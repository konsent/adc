// Phase 2: 기총 제원과 사격 표 (Rule 9.1).
// 수치의 유일한 출처는 실제 ADC(aircraft-adc-redesign/html/assets/data.js)다.
// 추정치로 채우지 않는다. 못 읽은 항목은 null로 두고, 그 항목에 의존하는 계산만 막는다.
//   - GUNS에 없는 기체  → 기총 없음. canFire()가 사격을 막는다.
//   - hit이 null        → 기총은 있으나 ADC 사격표 미상. toHit()이 throw한다.
//   - ammo/size가 null  → 해당 제한/보정만 건너뛴다.
// ponytail: ADC 스캔이 늘면 여기에 항목만 추가한다.

/**
 * hit: 사거리 0/1/2 기준 명중 수치 (1d10 <= hit - DRM 이면 명중).
 * rating: A/A 파괴력 (Damage Table 입력).
 * ammo: 탄약 포인트. Full Shot 1점, Snap Shot 0.5점.
 * rr: Radar Ranging 등급 — RE(SSGT 필요) / CA(후방 90도 자동) / IG(전각도) / null(없음).
 * size: 표적으로 맞을 때의 크기 보정 (음수 = 크다 = 맞기 쉽다).
 *       ADC에서 Size는 텍스트가 아니라 이미지라 data.js에서 파싱할 수 없다.
 *       실제 카드를 보고 받은 값이다 — 대형기 6종만 -1, 나머지는 0.
 */
// data.js는 기총 정보를 두 군데에 나눠 담는다.
//   1. 레코드 안의 gun:[...]  — 종류/A_A/탄약/Radar Ranging
//   2. 파일 끝의 rollToHitValues 맵 — 사격표(0/1/2 사거리)
// 기총 자체가 없는 기체는 아예 GUNS에 넣지 않는다(F-4 K/M, F-4 S, F-104 S, SU-15).
// F-104 S는 gun:이 있지만 후기 패치가 지운다 → 기총 없음.
export const GUNS = {
  'F-4F': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: null, rr: 'RE', size: 0 },
  'F-4E': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: null, rr: 'RE', size: 0 },
  'F-4F-ICE': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: null, rr: 'CA', size: 0 },
  'F-14A': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: 3.5, rr: 'RE', size: -1 },
  'F-14D': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: 3.5, rr: 'CA', size: -1 },
  'F-15A': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: null, rr: 'CA', size: -1 },
  'F-15C': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: null, rr: 'CA', size: -1 },
  'F-16A': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: 2.5, rr: 'CA', size: 0 },
  'F-16C': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: 2.5, rr: 'CA', size: 0 },
  'FA-18A': { type: '20mm Vulcan', hit: [7, 5, 3], rating: 6, ammo: 2.5, rr: 'IG', size: 0 },
  'F-19A': { type: '20mm Vulcan', hit: [7, 6, 4], rating: 6, ammo: 2.5, rr: 'IG', size: 0 },
  'F-35-DRAKEN': { type: '2 x 30mm Aden', hit: [6, 3, 2], rating: 6, ammo: 2.5, rr: 'RE', size: 0 },
  'JA-37': { type: '2 x 30mm Aden', hit: [6, 3, 2], rating: 6, ammo: 2.5, rr: 'RE', size: 0 },
  'TORNADO-F3': { type: '1 x 27mm Mauser', hit: [6, 3, 1], rating: 5, ammo: 3.5, rr: 'CA', size: 0 },
  'MIRAGE-IIIE': { type: '2 x 30mm Aden', hit: [6, 3, 2], rating: 6, ammo: 2.5, rr: 'RE', size: 0 },
  'MIRAGE-F1E': { type: '2 x 30mm Defa', hit: [6, 3, 2], rating: 6, ammo: 2.5, rr: 'RE', size: 0 },
  'MIRAGE-2000': { type: '2 x 30mm Defa', hit: [6, 3, 2], rating: 6, ammo: 3.5, rr: 'RE', size: 0 },
  'MIRAGE-2000C': { type: '2 x 30mm Defa', hit: [6, 3, 2], rating: 6, ammo: 3.5, rr: 'CA', size: 0 },
  'MIG-23': { type: 'GSh twin 23mm', hit: [7, 4, 2], rating: 5, ammo: 3.5, rr: 'RE', size: 0 },
  'MIG-29': { type: '1 x 30mm', hit: [6, 4, 2], rating: 5, ammo: 3.5, rr: 'RE', size: 0 },
  'MIG-31': { type: 'GSh twin 23mm', hit: [7, 4, 2], rating: 5, ammo: 3.5, rr: 'RE', size: -1 },
  'MIG-21MF': { type: 'GSh twin 23mm', hit: [7, 4, 2], rating: 5, ammo: 2.5, rr: 'RE', size: 0 },
  'MIG-21BIS': { type: 'GSh twin 23mm', hit: [7, 4, 2], rating: 5, ammo: null, rr: 'RE', size: 0 },
  // Speed of Heat MiG-15 ADC: Two 23mm, One 37mm; Roll to Hit 0=4, 1=2, 2=1; AtA 5.
  'SPOH-MIG-15-FAGOT': { type: 'Two 23mm, One 37mm', hit: [4, 2, 1], rating: 5, ammo: 3, rr: null, size: 0 },
  // F-86F Sabre ADC (used as the T-3 F-86E performance and gun-data substitute).
  'SPOH-F-86F-SABRE': { type: 'Six .50 Cal M.G.', hit: [6, 3, 0], rating: 4, ammo: 7, rr: null, size: 0 },
  'SPOH-F-86E-SABRE': { type: 'Six .50 Cal M.G.', hit: [6, 3, 0], rating: 4, ammo: 7, rr: null, size: 0 },
  'SU-17': { type: '2 x 30mm', hit: [4, 2, 1], rating: 5, ammo: null, rr: 'RE', size: 0 },
  'SU-27': { type: '1 x 30mm', hit: [6, 4, 2], rating: 5, ammo: null, rr: 'RE', size: -1 },
};

/**
 * Angle-Off 표 (ruleset/air-power-damage-table-rule-db.md §1).
 * 0°와 180°만 Line/Arc가 갈리고 나머지는 Arc 하나뿐이다.
 * 꼬리물기(0° Line)가 -2로 가장 쉽고, 정측면(90~150°)이 +4로 가장 어렵다.
 */
const DEFLECTION = { 0: 0, 30: 0, 60: 2, 90: 4, 120: 4, 150: 4, 180: 3 };
const DEFLECTION_LINE = { 0: -2, 180: 2 };

export function deflectionDrm(angle, isLine = false) {
  if (isLine && angle in DEFLECTION_LINE) return DEFLECTION_LINE[angle];
  const drm = DEFLECTION[angle];
  if (drm === undefined) throw new Error(`편각은 30도 단위여야 한다: ${angle}`);
  return drm;
}

/**
 * Vulnerability Rating (Damage Table §2). 표적이 될 때 피해 주사위에 더한다.
 * 양수 = 튼튼함(주사위가 커져 경미한 결과로), 음수 = 취약함.
 * 실제 ADC 카드에서 받은 값이다. 명시되지 않은 기체는 0.
 */
const VULNERABILITY = {
  'F-14A': 1, 'F-14D': 1, 'F-15A': 1, 'F-15C': 1, 'F-16A': 1, 'F-16C': 1, 'FA-18A': 1,
  'LIGHTNING': -1, 'MIG-23': -1, 'MIG-31': -1,
  'MIG-21MF': -2, 'MIG-21BIS': -2,
};

export function vulnerabilityOf(aircraftId) {
  return VULNERABILITY[aircraftId] ?? 0;
}

/** 조준경 페널티 (Rule 9.1). ET는 사격 자체가 불가하므로 여기 없다. */
export const GUNSIGHT_DRM = { EZ: 0, TT: 1, HT: 2, BT: 3 };

/**
 * 사격자 누적 피해 페널티 (Damage rule-db §1).
 * C는 §3에서 "공격 불가"라 표에 값이 없다 — canFire()가 막지만, 방어적으로 큰 값을 둔다.
 */
export const DAMAGE_DRM = { none: 0, L: 1, '2L': 2, H: 3, C: 99 };

/** 파일럿 숙련도 (Rule 9.1). */
export const PILOT_DRM = { veteran: -1, average: 0, green: 1 };

export function gunOf(aircraftId) {
  return GUNS[aircraftId] ?? null;
}
