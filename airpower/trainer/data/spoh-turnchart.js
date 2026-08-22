// Speed of Heat 통합 선회 차트. 출처: 사용자가 제공한 SPOH Turn Chart JSON.
// 값은 30도 선회에 필요한 HFP이며 60/90은 HFP 1회당 기수 변경 각도다.
export const SPOH_SPEED_COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 18];

// Turn Chart 주석: 희박한 공기에서는 모든 기동과 스냅턴에 준비 HFP를 더한다.
const MANEUVER_PREP = { HI: 1, VH: 2, EH: 3, UH: 4 };

const CHART = {
  LO: {
    EZ: [60, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20],
    TT: [90, 60, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14],
    HT: ['NA', 90, 60, 1, 2, 2, 3, 4, 6, 8, 10, 12],
    BT: ['NA', 'NA', 90, 60, 1, 1, 2, 3, 4, 6, 8, 10],
    ET: ['NA', 'NA', 'NA', 60, 60, 1, 1, 2, 3, 4, 6, 8],
  },
  MH: {
    EZ: [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 22],
    TT: [60, 1, 2, 3, 4, 6, 7, 8, 10, 12, 14, 18],
    HT: ['NA', 60, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14],
    BT: ['NA', 'NA', 60, 1, 2, 2, 3, 4, 6, 7, 10, 11],
    ET: ['NA', 'NA', 'NA', 60, 1, 1, 2, 2, 4, 5, 7, 9],
  },
  HI: {
    EZ: [2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24],
    TT: [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20],
    HT: ['NA', 1, 2, 3, 4, 5, 6, 8, 9, 10, 13, 16],
    BT: ['NA', 'NA', 1, 2, 3, 3, 4, 6, 7, 8, 10, 12],
    ET: ['NA', 'NA', 'NA', 1, 2, 2, 3, 4, 5, 6, 8, 10],
  },
  VH: {
    EZ: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
    TT: [1, 2, 4, 6, 8, 9, 10, 13, 15, 17, 20, 22],
    HT: ['NA', 'NA', 3, 4, 6, 7, 8, 10, 12, 14, 17, 20],
    BT: ['NA', 'NA', 'NA', 3, 4, 5, 6, 7, 9, 11, 14, 16],
    ET: ['NA', 'NA', 'NA', 'NA', 3, 4, 5, 6, 7, 8, 10, 12],
  },
  EH: {
    EZ: [3, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28],
    TT: ['NA', 4, 6, 8, 10, 12, 13, 14, 16, 18, 21, 24],
    HT: ['NA', 'NA', 4, 6, 7, 8, 10, 11, 13, 15, 18, 21],
    BT: ['NA', 'NA', 'NA', 4, 5, 6, 7, 8, 10, 12, 14, 18],
    ET: ['NA', 'NA', 'NA', 'NA', 4, 5, 6, 7, 9, 10, 12, 14],
  },
};

function speedColumn(speed) {
  if (speed <= 1) return 0;
  if (speed >= 18) return SPOH_SPEED_COLUMNS.length - 1;
  let index = 0;
  for (let i = 0; i < SPOH_SPEED_COLUMNS.length; i += 1) {
    if (SPOH_SPEED_COLUMNS[i] <= speed) index = i;
  }
  return index;
}

export function spohTurnCost(band, speed, rate) {
  const tableBand = band === 'ML' ? 'LO' : band === 'UH' ? 'EH' : band;
  const value = CHART[tableBand]?.[rate]?.[speedColumn(speed)];
  if (value === undefined || value === 'NA') return null;
  if (value === 60 || value === 90) return { degrees: value };
  // SPOH 표의 UH 주석: 모든 선회 요구 HFP에 +2를 더한다.
  return { fp: value + (MANEUVER_PREP[band] ?? 0) + (band === 'UH' ? 2 : 0) };
}

export function spohManeuverPrep(band) {
  return MANEUVER_PREP[band] ?? 0;
}

export { CHART as SPOH_TURN_CHART };
