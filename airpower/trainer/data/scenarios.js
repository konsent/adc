import { rulesFor } from '../rules/index.js';
import { hexOfBoardHex, hexOfScenarioMap, scenarioMapCells } from '../engine/hex.js';

// 출처: ../scenario/air_superiority_scenario.md, T-2 Check Ride (p.32).
// 원문 Map A 좌표는 시작 헥스 1021을 axial 원점으로 옮겨 현재 훈련 맵에 맞춘다.
const CHECK_RIDE = {
  id: 'as-t2-check-ride',
  title: 'T-2 Check Ride (비행 검정)',
  source: 'Air Superiority T-2, p.32',
  lesson: 4,
  aircraft: 'MIG-29',
  start: { hex: { q: 0, r: 0 }, facing: 0, alt: 15, speed: 6, flightType: 'LVL' },
  waypoints: [
    { hex: { q: 0, r: -4 }, alt: 22 }, // 원문 1017
    { hex: { q: 5, r: -4 }, alt: 10 }, // 원문 1517
    { hex: { q: 7, r: -6 }, alt: 16 }, // 원문 1715
    { hex: { q: 3, r: -8 }, alt: 8 },  // 원문 1313
    { hex: { q: 4, r: -12 }, alt: 15 }, // 원문 1409
  ],
  parTurns: 8,
  maxTurns: 8,
};

// 출처: ../scenario/air_superiority_scenario.md, T-1 Recon Run (p.32).
// 원문 삽화는 언덕의 좌/우를 교대로 지나도록 지시한다.
const RECON_RUN = {
  id: 'as-t1-recon-run',
  title: 'T-1 Recon Run (정찰 비행)',
  source: 'Air Superiority T-1, p.32',
  lesson: 1,
  aircraft: 'F-19A',
  // 보드 헥스는 CCRR(열·행) 표기다. 원본 번호에서 내부 좌표로 직접 변환한다.
  start: { hex: hexOfBoardHex('1223'), boardHex: '1223', facing: 0, alt: 1, speed: 6, flightType: 'LVL' },
  waypoints: [],
  hills: [
    { boardHex: '1016' },
    { boardHex: '1120' },
    { boardHex: '1212' },
    { boardHex: '1509' },
  ],
  parTurns: 7,
  maxTurns: 7,
};

const S1 = {
  id: 'as-s1-border-clash', title: 'S-1 Border Clash (국경 충돌)', source: 'Air Superiority S-1, p.32', lesson: 1,
  solitaire: true, maps: ['A'], aircraft: 'F-4F',
  opponentsFirst: true, maxTurns: 6,
  start: { hex: hexOfScenarioMap('A', '1020'), boardHex: 'A1020', facing: 0, alt: 12, speed: 6, flightType: 'LVL', configuration: 'CL', load: 0 },
  opponents: [{ aircraft: 'MIG-21MF', map: 'A', boardHex: '1016', facing: 0, alt: 10, speed: 5, configuration: 'CL', load: 0, movementMode: 'evasive' }],
  victory: '턴 6 종료 전 MiG-21MF를 파괴하십시오.',
};

const S2 = {
  id: 'as-s2-prelude-to-war', title: 'S-2 Prelude to War (전쟁의 서곡)', source: 'Air Superiority S-2, pp.32-33', lesson: 1,
  solitaire: true, maps: ['A', 'B'], aircraft: 'JA-37',
  start: { hex: hexOfScenarioMap('A', '0901'), boardHex: 'A0901', facing: 0, alt: 10, speed: 6, flightType: 'LVL', configuration: 'CL', load: 4, stores: ['2 AIM-9P', '2 AIM-9L'] },
  friendlies: [{ aircraft: 'JA-37', map: 'A', boardHex: '1101', facing: 0, alt: 10, speed: 6, configuration: 'CL', load: 4, stores: ['2 AIM-9P', '2 AIM-9L'] }],
  opponents: [
    { aircraft: 'SU-17', map: 'B', boardHex: '0904', facing: 6, alt: 6, speed: 6, configuration: 'DT', load: null, movementMode: 'non-evasive' },
    { aircraft: 'SU-17', map: 'B', boardHex: '0702', facing: 6, alt: 7, speed: 6, configuration: 'DT', load: null, movementMode: 'non-evasive' },
    { aircraft: 'SU-17', map: 'B', boardHex: '1103', facing: 6, alt: 10, speed: 6, configuration: 'DT', load: null, movementMode: 'non-evasive' },
    { aircraft: 'SU-17', map: 'B', boardHex: '1301', facing: 6, alt: 12, speed: 6, configuration: 'DT', load: null, movementMode: 'non-evasive' },
  ],
  // 승리 조건에 맵 탈출이 들어가므로, 상대기 이탈은 격추가 아니라 저지 실패다.
  exitIsEscape: true,
  victory: '모든 SU-17이 파괴되거나 맵을 탈출할 때까지.',
};

const S3 = {
  id: 'as-s3-wrath-of-islam', title: 'S-3 The Wrath of Islam! (이슬람의 분노)', source: 'Air Superiority S-3, p.33', lesson: 1,
  solitaire: true, maps: ['A', 'B', 'C', 'D'], aircraft: 'MIG-31',
  start: { hex: hexOfScenarioMap('A', '1025'), boardHex: 'A1025', facing: 0, alt: 10, speed: 6, flightType: 'LVL', configuration: 'DT', load: 15, stores: ['1-2 AA-8B each', '7-8 AA-10A', '3-6 AA-9'] },
  opponents: [
    { aircraft: 'F-4E', map: 'D', boardHex: '0909', facing: 6, alt: 1, speed: 8, configuration: 'CL', load: '?', movementMode: 'non-evasive' },
    { aircraft: 'F-4E', map: 'D', boardHex: '0603', facing: 6, alt: 15, speed: 9, configuration: 'CL', load: '?', movementMode: 'non-evasive' },
    { aircraft: 'F-4E', map: 'D', boardHex: '1506', facing: 6, alt: 8, speed: 9, configuration: 'CL', load: '?', movementMode: 'non-evasive' },
    { aircraft: 'F-4E', map: 'D', boardHex: '1202', facing: 6, alt: 28, speed: 11, configuration: 'CL', load: '?', movementMode: 'non-evasive' },
  ],
  // F-4E는 남쪽(Map A 25행 아래)으로 빠져나가면 승리. MiG-31이 그 전에 막아야 한다.
  exitIsEscape: true, escapeEdge: 'south',
  victory: '모든 F-4E가 맵 남쪽 가장자리로 탈출하기 전에 파괴하십시오.',
};

export const SCENARIOS = {
  'as-t1-recon-run': RECON_RUN,
  'as-t2-check-ride': CHECK_RIDE,
  'as-s1-border-clash': S1,
  'as-s2-prelude-to-war': S2,
  'as-s3-wrath-of-islam': S3,
};

export function loadScenario(id, { scope = 'basic' } = {}) {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`알 수 없는 지정 시나리오: ${id}`);
  return {
    ...scenario,
    start: { ...scenario.start, hex: { ...scenario.start.hex } },
    waypoints: (scenario.waypoints ?? []).map(w => ({ ...w, hex: { ...w.hex } })),
    hills: scenario.hills?.map(hill => ({ ...hill })),
    maps: scenario.maps ? [...scenario.maps] : undefined,
    mapCells: scenario.maps ? scenarioMapCells(scenario.maps) : undefined,
    friendlies: scenario.friendlies?.map(unit => ({ ...unit, hex: hexOfScenarioMap(unit.map, unit.boardHex) })),
    opponents: scenario.opponents?.map(unit => ({ ...unit, hex: hexOfScenarioMap(unit.map, unit.boardHex) })),
    activeRules: rulesFor(scenario.lesson, scope === 'basic' ? 'basic' : null),
    scope,
  };
}
