import { SPOH_AIRCRAFT } from './spoh-aircraft.js';

// Air Power II ADC 정규화 데이터
// 출처: 프로젝트/보드게임-번역/aircraft-adc-redesign/html/assets/data.js
// 모든 값은 CL(clean) 로드 기준. 콤마 변형은 첫 값(저속/기본)을 사용.

const BANDS = ['LO', 'ML', 'MH', 'HI', 'VH', 'EH'];

/** 고도 레벨 → 밴드 이름. Rules DB 기준(LO 1-7). */
export function bandOf(alt) {
  if (alt <= 7) return 'LO';
  if (alt <= 16) return 'ML';
  if (alt <= 25) return 'MH';
  if (alt <= 35) return 'HI';
  if (alt <= 45) return 'VH';
  if (alt <= 60) return 'EH';
  return 'UH';
}

export const AIRCRAFT = {
  // ADC p.1. F-4F performance is distinct from the F-4E export variant below.
  'F-4F': {
    id: 'F-4F', title: 'F-4 F Phantom II', cruise: 5.5, climbSpeed: 4.5,
    power: { AB: [3.5, 2.5, 2], MIL: [2, 1.5, 1], Norm: [0, 0, 0], Idle: [0.5, 1, 1], Spbr: [0.5, 1, 1] },
    velocity: { LO: { min: 1.5, max: 8.5, dive: 10 }, ML: { min: 2, max: 9, dive: 11 }, MH: { min: 2, max: 10, dive: 12 }, HI: { min: 3, max: 11.5, dive: 13 }, VH: { min: 3, max: 12.5, dive: 14 }, EH: { min: 4, max: 14, dive: 15 } },
    climb: { LO: 6, ML: 6, MH: 5, HI: 4, VH: 2, EH: 1 },
    drag: { TT: 1, HT: 2, BT: 4, ET: 5 }, dragHighSpeed: { TT: 1, HT: 3, BT: 3, ET: 4 }, dragThreshold: 6,
    roll: { fp: 1, decel: 1 }, verticalRoll: { fp: 0, decel: 0 },
    traits: { hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'normal', slats: true, viff: false, highAoA: false, verified: true },
  },

  // ADC pp.16, 25, 28, and 24 respectively. Values are transcribed from data.js.
  'JA-37': {
    id: 'JA-37', title: 'Saab JA-37 Viggen', cruise: 5, climbSpeed: 4.5,
    power: { AB: [3.5, 2.5, 2], MIL: [1, 1, 1], Norm: [0, 0, 0], Idle: [0.5, 1, 1], Spbr: [0.5, 1, 1] },
    velocity: { LO: { min: 1.5, max: 8, dive: 9 }, ML: { min: 2, max: 9, dive: 10 }, MH: { min: 2.5, max: 10, dive: 13 }, HI: { min: 3, max: 12, dive: 14 }, VH: { min: 3.5, max: 13, dive: 14 }, EH: { min: 3.5, max: 13, dive: 14 } },
    climb: { LO: 6, ML: 6, MH: 5, HI: 4, VH: 2, EH: 1 }, drag: { TT: 1, HT: 2, BT: 3, ET: 4 }, dragHighSpeed: { TT: 1, HT: 2, BT: 3, ET: 4 }, dragThreshold: null,
    roll: { fp: 1, decel: 1 }, verticalRoll: { fp: 0, decel: 0 },
    traits: { hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'normal', slats: false, viff: false, highAoA: false, verified: true },
  },
  'MIG-21MF': {
    id: 'MIG-21MF', title: 'Mig-21MF Fishbed J', cruise: 6, climbSpeed: 4.5,
    power: { AB: [3.5, 2.5, 2.5], MIL: [1.5, 1, 1], Norm: [0, 0, 0], Idle: [0.5, 0.5, 1], Spbr: [0.5, 0.5, 1] },
    velocity: { LO: { min: 1.5, max: 7.5, dive: 9 }, ML: { min: 2, max: 8, dive: 10 }, MH: { min: 2.5, max: 9, dive: 12 }, HI: { min: 3, max: 10.5, dive: 13 }, VH: { min: 3.5, max: 12, dive: 13 }, EH: { min: 4, max: 13, dive: 13 } },
    climb: { LO: 4, ML: 4, MH: 3, HI: 2, VH: 1, EH: 1 }, drag: { TT: 1, HT: 2, BT: 4, ET: 4 }, dragHighSpeed: { TT: 1, HT: 2, BT: 4, ET: 4 }, dragThreshold: null,
    roll: { fp: 1, decel: 1 }, verticalRoll: { fp: 0, decel: 0 },
    traits: { hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'normal', slats: false, viff: false, highAoA: false, verified: true },
  },
  'SU-17': {
    id: 'SU-17', title: 'SU-17/22 Fitter H/J', cruise: 5, climbSpeed: 4.5,
    power: { AB: [3, 2.5, 2], MIL: [1.5, 1, 1], Norm: [0, 0, 0], Idle: [0.5, 0.5, 1], Spbr: [0.5, 1, 1] },
    velocity: { LO: { min: 2, max: 8, dive: 10 }, ML: { min: 2.5, max: 8.5, dive: 10 }, MH: { min: 2.5, max: 10, dive: 12 }, HI: { min: 3, max: 11, dive: 13 }, VH: { min: 3.5, max: 12, dive: 13 }, EH: { min: 4.5, max: 13.5, dive: 14 } },
    climb: { LO: 6, ML: 6, MH: 4, HI: 3, VH: 2, EH: 1 }, drag: { TT: 1, HT: 2, BT: 4, ET: null }, dragHighSpeed: { TT: 2, HT: 2, BT: 4, ET: null }, dragThreshold: null,
    roll: { fp: 1.5, decel: 1.5 }, verticalRoll: { fp: 0, decel: 0.5 },
    traits: { hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'normal', slats: false, viff: false, highAoA: false, verified: true },
  },
  'MIG-31': {
    id: 'MIG-31', title: 'Mig-31 Foxhound A', cruise: 6, climbSpeed: 5,
    power: { AB: [3.5, 3, 2.5], MIL: [2, 1.5, 1.5], Norm: [0, 0, 0], Idle: [0.5, 0.5, 1], Spbr: [0.5, 1, 1] },
    velocity: { LO: { min: 2, max: 8, dive: 9 }, ML: { min: 2.5, max: 9, dive: 10 }, MH: { min: 3, max: 10, dive: 12 }, HI: { min: 3.5, max: 12, dive: 14 }, VH: { min: 4, max: 14, dive: 14 }, EH: { min: 4.5, max: 16, dive: 15 } },
    climb: { LO: 7, ML: 6, MH: 5, HI: 4, VH: 3, EH: 2 }, drag: { TT: 2, HT: 3, BT: 4, ET: null }, dragHighSpeed: { TT: 2, HT: 3, BT: 4, ET: null }, dragThreshold: null,
    roll: { fp: 1, decel: 1 }, verticalRoll: { fp: 0, decel: 1 },
    traits: { hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false, canard: false, bleedRate: 'normal', slats: false, viff: false, highAoA: false, verified: true },
  },
  'F-19A': {
    id: 'F-19A',
    title: 'F-19A Stealth Fighter',
    cruise: 6.0,
    climbSpeed: 5.0,
    power: {
      AB: [5.0, 4.0, 3.5],
      MIL: [2.5, 2.0, 2.0],
      Norm: [0, 0, 0],
      Idle: [0.5, 0.5, 1.0],
      Spbr: [1.0, 1.0, 1.0],
    },
    velocity: {
      LO: { min: 2, max: 8, dive: 9 },
      ML: { min: 2.5, max: 8.5, dive: 10 },
      MH: { min: 2.5, max: 9, dive: 11 },
      HI: { min: 3, max: 10, dive: 12 },
      VH: { min: 3, max: 10.5, dive: 12 },
      EH: { min: 3.5, max: 11, dive: 12 },
    },
    climb: { LO: 8, ML: 7, MH: 6, HI: 5, VH: 4, EH: 2 },
    drag: { TT: 1, HT: 2, BT: 3, ET: 4 },
    dragHighSpeed: { TT: 1, HT: 2, BT: 3, ET: 4 },
    dragThreshold: null,
    roll: { fp: 1, decel: 1 },
    verticalRoll: { fp: 0, decel: 0 },
    traits: {
      hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: true, rapidPowerResponse: false,
      canard: false, bleedRate: 'normal', slats: false, viff: false,
      highAoA: false, verified: true,
    },
  },

  'MIG-29': {
    id: 'MIG-29',
    title: 'Mig-29 Fulcrum A',
    cruise: 6.0,
    climbSpeed: 5.0,
    // 밴드별 Accel/Decel. 인덱스: [LO/ML, MH/HI, VH/EH]
    power: {
      AB:   [5.5, 4.5, 4.0],
      MIL:  [3.0, 2.5, 2.0],
      Norm: [0, 0, 0],
      Idle: [0.5, 0.5, 1.0],    // Decel
      Spbr: [1.0, 1.0, 1.0],    // Decel
    },
    velocity: {
      LO: { min: 2,   max: 9,    dive: 10 },
      ML: { min: 2,   max: 10,   dive: 10 },
      MH: { min: 2.5, max: 12,   dive: 12 },
      HI: { min: 3,   max: 13,   dive: 14 },
      VH: { min: 3,   max: 14,   dive: 14 },
      EH: { min: 3.5, max: 15,   dive: 15 },
    },
    climb: { LO: 8, ML: 8, MH: 7, HI: 6, VH: 4, EH: 2 },
    drag:          { TT: 1, HT: 2, BT: 4, ET: 4 },
    dragHighSpeed: { TT: 1, HT: 2, BT: 4, ET: 4 },
    dragThreshold: null,
    roll: { fp: 1, decel: 1 },
    verticalRoll: { fp: 0, decel: 0 },
    traits: {
      hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false,
      canard: false, bleedRate: 'normal', slats: false, viff: false,
      highAoA: false,
      verified: false,   // note: "Smoke at MIL power." — 특성 근거 없음
    },
  },

  'F-15C': {
    id: 'F-15C',
    title: 'F-15C Eagle',
    cruise: 6.0,
    climbSpeed: 4.5,
    // 밴드별 Accel/Decel. 인덱스: [LO/ML, MH/HI, VH/EH]
    power: {
      AB:   [5.5, 4.5, 3.5],
      MIL:  [3.0, 2.5, 2.0],
      Norm: [0, 0, 0],
      Idle: [0.5, 0.5, 1.0],    // Decel
      Spbr: [1.0, 1.0, 1.0],    // Decel
    },
    velocity: {
      LO: { min: 2,   max: 9,  dive: 10 },
      ML: { min: 2,   max: 10, dive: 12 },
      MH: { min: 2,   max: 12, dive: 14 },
      HI: { min: 2.5, max: 13, dive: 15 },
      VH: { min: 3.5, max: 14, dive: 15 },
      EH: { min: 4,   max: 15, dive: 16 },
    },
    // 원본 콤마 변형("8,7" 등)은 근거 문서가 없어 첫 값만 사용
    climb: { LO: 8, ML: 8, MH: 6, HI: 6, VH: 4, EH: 2 },
    drag:          { TT: 1, HT: 2, BT: 3, ET: 4 },
    dragHighSpeed: { TT: 1, HT: 2, BT: 3, ET: 4 },
    dragThreshold: null,
    roll: { fp: 1, decel: 1 },
    verticalRoll: { fp: 0, decel: 0.5 },
    traits: {
      hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false,
      canard: false, bleedRate: 'normal', slats: false, viff: false,
      highAoA: false,
      verified: false,   // note: "See notes for FAST packs." — 특성 근거 없음
    },
  },

  // ADC pp.7-8. 가변익(swing wing): velocity/drag는 첫 번째(최대 전진익) 열 기준.
  // ponytail: 드래그는 저/중/고 3단이지만 스키마는 2단뿐 → 중속(4.0-7.0)을 기본,
  // 고속(7.5+)을 dragHighSpeed로. 저속(≤3.5) 할인은 미반영.
  'F-14A': {
    id: 'F-14A',
    title: 'F-14A Tomcat',
    cruise: 5.5,
    climbSpeed: 4.5,
    power: {
      AB:   [3.0, 2.5, 2.0],
      MIL:  [1.0, 1.0, 1.0],
      Norm: [0, 0, 0],
      Idle: [0.5, 0.5, 1.0],
      Spbr: [0.5, 0.5, 1.0],
    },
    velocity: {
      LO: { min: 1.5, max: 9,  dive: 10 },
      ML: { min: 1.5, max: 10, dive: 12 },
      MH: { min: 2,   max: 10, dive: 14 },
      HI: { min: 2.5, max: 12, dive: 14 },
      VH: { min: 3,   max: 13, dive: 15 },
      EH: { min: 3,   max: 15, dive: 15 },
    },
    climb: { LO: 8, ML: 6, MH: 6, HI: 5, VH: 3, EH: 2 },
    drag:          { TT: 1, HT: 2, BT: 4, ET: 4 },   // 속도 7.5 미만
    dragHighSpeed: { TT: 2, HT: 4, BT: 5, ET: 6 },   // 속도 7.5 이상
    dragThreshold: 7.5,
    roll: { fp: 1.5, decel: 1.5 },
    verticalRoll: { fp: 0, decel: 0.5 },
    traits: {
      hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false,
      canard: false, bleedRate: 'normal', slats: false, viff: false,
      highAoA: false,
      verified: false,   // note: "Computerized swing wing" — 특성 근거 없음
    },
  },

  'F-14D': {
    id: 'F-14D',
    title: 'F-14D Tomcat',
    cruise: 6.0,
    climbSpeed: 5.0,
    power: {
      AB:   [4.5, 4.0, 3.5],
      MIL:  [1.5, 1.5, 1.0],
      Norm: [0, 0, 0],
      Idle: [0.5, 0.5, 1.0],
      Spbr: [0.5, 0.5, 1.0],
    },
    velocity: {
      LO: { min: 1.5, max: 9,  dive: 10 },
      ML: { min: 1.5, max: 10, dive: 12 },
      MH: { min: 2,   max: 12, dive: 14 },
      HI: { min: 2.5, max: 14, dive: 15 },
      VH: { min: 3,   max: 15, dive: 15 },
      EH: { min: 3,   max: 15, dive: 16 },
    },
    climb: { LO: 8, ML: 7, MH: 6, HI: 5, VH: 3, EH: 2 },
    drag:          { TT: 1, HT: 2, BT: 4, ET: 4 },   // 속도 7.5 미만
    dragHighSpeed: { TT: 2, HT: 4, BT: 5, ET: 6 },   // 속도 7.5 이상
    dragThreshold: 7.5,
    roll: { fp: 1.5, decel: 1.5 },
    verticalRoll: { fp: 0, decel: 0.5 },
    traits: {
      hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false,
      canard: false, bleedRate: 'normal', slats: false, viff: false,
      highAoA: false,
      verified: false,   // note: "Computerized swing wing" — 특성 근거 없음
    },
  },

  'F-4E': {
    id: 'F-4E',
    title: 'F-4 E Phantom II',
    cruise: 5.5,
    climbSpeed: 4.5,
    // 밴드별 Accel/Decel. 인덱스: [LO/ML, MH/HI, VH/EH]
    power: {
      AB:   [3.0, 2.5, 2.0],
      MIL:  [1.5, 1.0, 1.0],
      Norm: [0, 0, 0],
      Idle: [0.5, 1.0, 1.0],    // Decel
      Spbr: [0.5, 1.0, 1.0],    // Decel
    },
    velocity: {
      LO: { min: 1.5, max: 8.5,  dive: 10 },
      ML: { min: 2,   max: 9,    dive: 11 },
      MH: { min: 2,   max: 10,   dive: 12 },
      HI: { min: 3,   max: 11.5, dive: 13 },
      VH: { min: 3,   max: 12.5, dive: 14 },
      EH: { min: 4,   max: 14,   dive: 15 },
    },
    climb: { LO: 6, ML: 5, MH: 4, HI: 4, VH: 2, EH: 1 },
    // note: "Slatted wing; if speed < 6.0 use lower drag."
    drag:          { TT: 1, HT: 2, BT: 3, ET: 4 },   // 속도 6.0 미만
    dragHighSpeed: { TT: 1, HT: 2, BT: 4, ET: 5 },   // 속도 6.0 이상
    dragThreshold: 6.0,
    roll: { fp: 1, decel: 1 },
    verticalRoll: { fp: 0, decel: 0 },
    traits: {
      hpr: false, rollRate: 'normal', ssm: 'normal', rapidAccel: false, rapidPowerResponse: false,
      canard: false, bleedRate: 'normal', slats: true, viff: false,
      highAoA: false,
      verified: true,   // note에 슬랫 명시
    },
  },
  ...SPOH_AIRCRAFT,
};

/** 현재 속도에 맞는 선회 드래그 값. null이면 해당 선회율 사용 불가. */
export function dragFor(aircraft, rate, speed) {
  const table = (aircraft.dragThreshold !== null && speed >= aircraft.dragThreshold)
    ? aircraft.dragHighSpeed
    : aircraft.drag;
  const v = table[rate];
  return v === undefined ? null : v;
}

const POWER_BAND_INDEX = { LO: 0, ML: 0, MH: 1, HI: 1, VH: 2, EH: 2, UH: 2 };

export function powerValue(aircraft, setting, band) {
  const row = aircraft.power[setting];
  if (!row) return 0;
  return row[POWER_BAND_INDEX[band]];
}

/**
 * 선택 가능한 Accel 범위 (Rule 6.5). 0.5 단위로 고를 수 있다.
 * MIL은 0.5 ~ 최대 Military, AB는 (최대 Military + 0.5) ~ 최대 AB.
 * Idle/Norm/Spbr는 가속이 없어 null.
 */
export function accelRange(aircraft, setting, band) {
  const mil = powerValue(aircraft, 'MIL', band);
  if (setting === 'MIL') return mil > 0 ? { min: 0.5, max: mil } : null;
  if (setting !== 'AB') return null;
  const ab = powerValue(aircraft, 'AB', band);
  if (!(ab > 0)) return null;
  // AB 최대가 MIL 최대 이하인 기체는 AB 값 하나만 고를 수 있다.
  return { min: Math.min(mil + 0.5, ab), max: ab };
}

/** 선택값을 해당 출력의 합법 범위(0.5 단위)로 맞춘다. 값이 없으면 최대 출력. */
export function clampAccel(aircraft, setting, band, value) {
  const range = accelRange(aircraft, setting, band);
  if (!range) return powerValue(aircraft, setting, band);
  if (!Number.isFinite(value)) return range.max;
  const snapped = Math.round(value * 2) / 2;
  return Math.min(range.max, Math.max(range.min, snapped));
}

export { BANDS };
