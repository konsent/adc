import { rulesFor } from '../rules/index.js';
import { SPOH_MAPS, hexOfBoardHex, hexOfScenarioMap, scenarioMapCells, spohMapBackgrounds, spohMapCells } from '../engine/hex.js';

// 출처: ../scenario/air_superiority_scenario.md, T-2 Check Ride (p.32).
// 원문 Map A 좌표는 시작 헥스 1021을 axial 원점으로 옮겨 현재 훈련 맵에 맞춘다.
const CHECK_RIDE = {
  id: 'as-t2-check-ride',
  title: '[AS] T-2 Check Ride (비행 검정)',
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
  title: '[AS] T-1 Recon Run (정찰 비행)',
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
  id: 'as-s1-border-clash', title: '[AS] S-1 Border Clash (국경 충돌)', source: 'Air Superiority S-1, p.32', lesson: 1,
  solitaire: true, maps: ['A'], aircraft: 'F-4F',
  opponentsFirst: true, maxTurns: 6,
  start: { hex: hexOfScenarioMap('A', '1020'), boardHex: 'A1020', facing: 0, alt: 12, speed: 6, flightType: 'LVL', configuration: 'CL', load: 0 },
  opponents: [{ aircraft: 'MIG-21MF', map: 'A', boardHex: '1016', facing: 0, alt: 10, speed: 5, configuration: 'CL', load: 0, movementMode: 'evasive' }],
  victory: '턴 6 종료 전 MiG-21MF를 파괴하십시오.',
};

const S2 = {
  id: 'as-s2-prelude-to-war', title: '[AS] S-2 Prelude to War (전쟁의 서곡)', source: 'Air Superiority S-2, pp.32-33', lesson: 1,
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
  id: 'as-s3-wrath-of-islam', title: '[AS] S-3 The Wrath of Islam! (이슬람의 분노)', source: 'Air Superiority S-3, p.33', lesson: 1,
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

function spohMapScenario(id, title, maps) {
  const cells = spohMapCells(maps);
  const center = cells[Math.floor(cells.length / 2)];
  return {
    id,
    title: `[SPOH] Map · ${title}`,
    source: 'Speed of Heat map set',
    lesson: 1,
    aircraft: 'SPOH-F4E',
    start: { hex: { q: center.q, r: center.r }, boardHex: center.boardHex, facing: 0, alt: 15, speed: 6, flightType: 'LVL' },
    waypoints: [],
    parTurns: 0,
    mapCells: cells,
    mapBackgrounds: spohMapBackgrounds(maps),
    hexSize: 37,
    freeAircraft: true,
  };
}

function spohTrainingScenario({ id, title, map, aircraft, start, markers, maxTurns, victory }) {
  return {
    id,
    title: `[SPOH] ${title}`,
    source: 'Speed of Heat, 1인용 훈련 시나리오',
    lesson: 1,
    aircraft,
    start: { hex: hexOfBoardHex(start.hex), boardHex: start.hex, facing: start.facing, alt: start.alt, speed: start.speed, flightType: 'LVL' },
    waypoints: [],
    markers: markers.map(marker => ({ ...marker, hex: hexOfBoardHex(marker.hex) })),
    parTurns: maxTurns,
    maxTurns,
    victory,
    mapCells: spohMapCells([map]),
    mapBackgrounds: spohMapBackgrounds([map]),
    hexSize: 37,
  };
}

// T-3's source layout places C2 immediately to the right of C1, rather than
// in the printed sheet's vertical arrangement. Preserve printed board labels
// while translating C2's rendered cells and background into that layout.
function spohT3Layout() {
  const c1 = spohMapCells(['spoh-c1']);
  const c2 = spohMapCells(['spoh-c2']).map(cell => ({ ...cell, q: cell.q + 21, r: cell.r - 15 }));
  const backgrounds = spohMapBackgrounds(['spoh-c1', 'spoh-c2']);
  backgrounds[1] = {
    ...backgrounds[1],
    minQ: backgrounds[1].minQ + 21,
    maxQ: backgrounds[1].maxQ + 21,
    minR: backgrounds[1].minR - 15,
    maxR: backgrounds[1].maxR - 15,
  };
  const c2Hex = boardHex => {
    const raw = hexOfBoardHex(boardHex);
    return { q: raw.q + 21, r: raw.r - 15 };
  };
  return { cells: [...c1, ...c2], backgrounds, c2Hex };
}

const SPOH_A1 = spohMapScenario('spoh-a1', 'A1', ['spoh-a1']);
const SPOH_A2 = spohMapScenario('spoh-a2', 'A2', ['spoh-a2']);
const SPOH_B1 = spohMapScenario('spoh-b1', 'B1', ['spoh-b1']);
const SPOH_B2 = spohMapScenario('spoh-b2', 'B2', ['spoh-b2']);
const SPOH_C1 = spohMapScenario('spoh-c1', 'C1', ['spoh-c1']);
const SPOH_C2 = spohMapScenario('spoh-c2', 'C2', ['spoh-c2']);
const SPOH_A = spohMapScenario('spoh-a', 'A1 + A2', ['spoh-a1', 'spoh-a2']);
const SPOH_B = spohMapScenario('spoh-b', 'B1 + B2', ['spoh-b1', 'spoh-b2']);
const SPOH_C = spohMapScenario('spoh-c', 'C1 + C2', ['spoh-c1', 'spoh-c2']);
const SPOH_T1 = spohTrainingScenario({
  id: 'spoh-t1-flight-school', title: 'T-1 항공 훈련 사령부', map: 'spoh-a1', aircraft: 'SPOH-P-80A-SHOOTING-STAR',
  start: { hex: '1507', facing: 6, alt: 1, speed: 4 }, maxTurns: 15,
  markers: [{ hex: '1708', label: '파일런 1' }, { hex: '2108', label: '파일런 2' }, { hex: '2405', label: '랑데부 목표' }],
  victory: '두 파일런을 8자 기동으로 우회한 뒤 2405에서 속도 3.0·NNW로 랑데부하십시오.',
});
SPOH_T1.training = 't1';
SPOH_T1.neutrals = [{
  aircraftId: 'SPOH-P-80A-SHOOTING-STAR',
  hex: hexOfBoardHex('1203'),
  facing: 6,
  label: 'T-33 랑데부',
}];
const SPOH_T2 = spohTrainingScenario({
  id: 'spoh-t2-gunnery-pattern', title: 'T-2 사격 패턴', map: 'spoh-c1', aircraft: 'SPOH-F-84E-THUNDERJET',
  start: { hex: '5809', facing: 0, alt: 15, speed: 4 }, maxTurns: 10,
  markers: [{ hex: '5508', label: 'T-33 예인기', kind: 'tug' }, { hex: '5509', label: '배너', kind: 'banner' }, { hex: '5809', label: '퍼치', kind: 'perch' }],
  victory: '배너 사격 경로를 두 번 통과하고 퍼치(5809·고도 15)로 복귀하십시오.',
});
SPOH_T2.training = 't2';
SPOH_T2.neutrals = [{
  aircraftId: 'SPOH-P-80A-SHOOTING-STAR',
  hex: hexOfBoardHex('5508'),
  facing: 0,
  alt: 12,
  speed: 3,
  label: 'T-33 예인기 · 고도 12 · 속도 3.0',
}];
const SPOH_T3_LAYOUT = spohT3Layout();
const SPOH_T3 = {
  id: 'spoh-t3-first-dogfight',
  title: '[SPOH] T-3 첫 공중전',
  source: 'Speed of Heat T-3, pp. 8-10',
  lesson: 1,
  solitaire: true,
  opponentsFirst: true,
  opponentMovement: 'spoh-random',
  requiredKills: 1,
  completeOnKills: false,
  exitIsEscape: true,
  opponentExitIsFailure: false,
  t3: true,
  maxTurns: 10,
  aircraft: 'SPOH-F-86E-SABRE',
  start: { hex: hexOfBoardHex('6914'), boardHex: '6914', facing: 2, alt: 20, speed: 6, flightType: 'LVL', configuration: 'CL', load: 0 },
  opponents: [
    { aircraft: 'SPOH-MIG-15-FAGOT', hex: SPOH_T3_LAYOUT.c2Hex('5127'), boardHex: '5127', facing: 0, alt: 18, speed: 5, configuration: 'CL', load: 0 },
    { aircraft: 'SPOH-MIG-15-FAGOT', hex: SPOH_T3_LAYOUT.c2Hex('5228'), boardHex: '5228', facing: 0, alt: 18, speed: 5, configuration: 'CL', load: 0 },
  ],
  victory: '10턴 안에 MiG-15 한 대 이상을 격추하고 생존하십시오.',
  mapCells: SPOH_T3_LAYOUT.cells,
  mapBackgrounds: SPOH_T3_LAYOUT.backgrounds,
  hexSize: 37,
};
function spohT4Layout() {
  const maps = [
    { id: 'spoh-a2', q: 0, r: -15 },
    { id: 'spoh-c1', q: -20, r: 0 },
    { id: 'spoh-b1', q: 20, r: 0 },
  ];
  const cells = maps.flatMap(layout => spohMapCells([layout.id]).map(cell => ({ ...cell, q: cell.q + layout.q, r: cell.r + layout.r })));
  const backgrounds = spohMapBackgrounds(maps.map(map => map.id)).map((background, index) => ({
    ...background,
    minQ: background.minQ + maps[index].q, maxQ: background.maxQ + maps[index].q,
    minR: background.minR + maps[index].r, maxR: background.maxR + maps[index].r,
  }));
  const hex = (map, boardHex) => {
    const layout = maps.find(item => item.id === map);
    const raw = hexOfBoardHex(boardHex);
    return { q: raw.q + layout.q, r: raw.r + layout.r };
  };
  return { cells, backgrounds, hex };
}
const SPOH_T4_LAYOUT = spohT4Layout();
const SPOH_T4 = {
  id: 'spoh-t4-missile-age', title: '[SPOH] T-4 미사일 시대', source: 'Speed of Heat T-4, 1956', lesson: 1,
  solitaire: true, opponentsFirst: true, t4: true, maxTurns: 15,
  aircraft: 'SPOH-F-102A-DELTA-DAGGER',
  start: { hex: SPOH_T4_LAYOUT.hex('spoh-a2', '2622'), boardHex: '2622', facing: 4, alt: 35, speed: 8, flightType: 'LVL', configuration: 'CL', load: 3 },
  friendlies: [{ aircraft: 'SPOH-F-102A-DELTA-DAGGER', hex: SPOH_T4_LAYOUT.hex('spoh-a2', '2522'), boardHex: '2522', facing: 4, alt: 35, speed: 8, configuration: 'CL', load: 3 }],
  opponents: [
    { aircraft: 'SPOH-TU-95M-BEAR-A', hex: SPOH_T4_LAYOUT.hex('spoh-b1', '3308'), boardHex: '3308', facing: 10, alt: 35, speed: 4, targetHex: SPOH_T4_LAYOUT.hex('spoh-a2', '1523'), targetLabel: '도시', movementMode: 't4-straight' },
    { aircraft: 'SPOH-TU-95M-BEAR-A', hex: SPOH_T4_LAYOUT.hex('spoh-b1', '4204'), boardHex: '4204', facing: 10, alt: 40, speed: 4, targetHex: SPOH_T4_LAYOUT.hex('spoh-a2', '2219'), targetLabel: '철도 조차장', movementMode: 't4-straight' },
    { aircraft: 'SPOH-TU-95M-BEAR-A', hex: SPOH_T4_LAYOUT.hex('spoh-b1', '4909'), boardHex: '4909', facing: 10, alt: 30, speed: 4, targetHex: SPOH_T4_LAYOUT.hex('spoh-a2', '2324'), targetLabel: '공군 기지', movementMode: 't4-straight', chaff: 4, flare: 4 },
  ],
  victory: '드론 3대를 목표 도달 전 파괴하십시오. F-102 두 대가 모두 제거되면 패배합니다.',
  mapCells: SPOH_T4_LAYOUT.cells, mapBackgrounds: SPOH_T4_LAYOUT.backgrounds, hexSize: 37,
};
const SPOH_T5 = {
  id: 'spoh-t5-palm-gate', title: '[SPOH] T-5 팜 게이트 작전!', source: 'Speed of Heat T-5, Vietnam 1964', lesson: 4,
  solitaire: true, t5: true, maxTurns: 15, aircraft: 'SPOH-A-1H-SKYRAIDER',
  // 참고 1: 폭탄 6 + 주니 2 + 네이팜 3 = 총 적재량 19.5, 무게 5,600.
  start: { hex: hexOfBoardHex('5211'), boardHex: '5211', facing: 4, alt: 5, speed: 2.5, flightType: 'LVL', configuration: 'DT', load: 19.5 },
  friendlies: [{ aircraft: 'SPOH-A-1H-SKYRAIDER', hex: hexOfBoardHex('5112'), boardHex: '5112', facing: 4, alt: 5, speed: 2.5, configuration: 'DT', load: 19.5 }],
  groundUnits: [
    // 참고 5: 그린베레는 세 배 가치(보병 2점 × 3 = 6점)로 집계한다.
    { id: 'gb', side: 'friendly', type: 'infantry', label: '그린베레', hex: hexOfBoardHex('6008'), defense: 1, fragile: true, elevation: 0, points: 6 },
    { id: 'vc1', side: 'vc', type: 'infantry', label: 'VC 보병 1', hex: hexOfBoardHex('5907'), defense: 1, fragile: true, elevation: 0, points: 2 },
    { id: 'vc2', side: 'vc', type: 'infantry', label: 'VC 보병 2', hex: hexOfBoardHex('5907'), defense: 1, fragile: true, elevation: 0, points: 2 },
    { id: 'vc3', side: 'vc', type: 'infantry', label: 'VC 보병 3', hex: hexOfBoardHex('6007'), defense: 1, fragile: true, elevation: 0, points: 2 },
    { id: 'vc4', side: 'vc', type: 'infantry', label: 'VC 보병 4', hex: hexOfBoardHex('6007'), defense: 1, fragile: true, elevation: 0, points: 2 },
    { id: 'zpu', side: 'vc', type: 'aaa', label: 'ZPU-1 14.5mm', image: 'ZPU-1Front.gif', hex: hexOfBoardHex('5807'), defense: 2, range: 5, hit: 3, rating: 1, elevation: 0, points: 3 },
    { id: 'zpu2', side: 'vc', type: 'aaa', label: 'ZPU-1 14.5mm', image: 'ZPU-1Front.gif', hex: hexOfBoardHex('6012'), defense: 2, range: 5, hit: 3, rating: 1, elevation: 0, points: 3 },
    { id: 'zu23', side: 'vc', type: 'aaa', label: 'ZU-23 23mm', image: 'ZU-23Front.gif', hex: hexOfBoardHex('6611'), defense: 2, range: 6, hit: 4, rating: 2, elevation: 0, points: 4 },
  ],
  victory: '15턴 동안 그린베레를 보존하고 VC를 저지하십시오. 그린베레 점수는 3배입니다.',
  mapCells: spohMapCells(['spoh-c1']), mapBackgrounds: spohMapBackgrounds(['spoh-c1']), hexSize: 37,
};

// T-6은 B1(북) / C1(중앙) / B2(남)을 세로로 이어 붙인다. 각 맵은 20열 15행.
// 인쇄 원점(col/row)이 맵마다 다르므로 오프셋은 손으로 적지 않고 SPOH_MAPS에서 역산한다.
function spohT6Layout() {
  const order = ['spoh-b1', 'spoh-c1', 'spoh-b2'];
  const maps = order.map((id, index) => ({
    id,
    q: SPOH_MAPS[order[0]].col - SPOH_MAPS[id].col,
    r: index * 15 - (SPOH_MAPS[id].row - SPOH_MAPS[order[0]].row),
  }));
  const cells = maps.flatMap(layout => spohMapCells([layout.id]).map(cell => ({ ...cell, q: cell.q + layout.q, r: cell.r + layout.r })));
  const backgrounds = spohMapBackgrounds(maps.map(map => map.id)).map((background, index) => ({
    ...background,
    minQ: background.minQ + maps[index].q, maxQ: background.maxQ + maps[index].q,
    minR: background.minR + maps[index].r, maxR: background.maxR + maps[index].r,
  }));
  const hex = (map, boardHex) => {
    const layout = maps.find(item => item.id === map);
    const raw = hexOfBoardHex(boardHex);
    return { q: raw.q + layout.q, r: raw.r + layout.r };
  };
  return { cells, backgrounds, hex, maps };
}
const SPOH_T6_LAYOUT = spohT6Layout();
const T6 = (map, boardHex) => SPOH_T6_LAYOUT.hex(map, boardHex);
const SPOH_T6 = {
  id: 'spoh-t6-wild-weasel', title: '[SPOH] T-6 와일드 위즐!', source: 'Speed of Heat T-6, North Vietnam 1967', lesson: 4,
  solitaire: true, t5: true, t6: true, maxTurns: 15, aircraft: 'SPOH-F-105G-WILD-WEASEL',
  start: { hex: T6('spoh-b2', '4030'), boardHex: '4030', facing: 0, alt: 20, speed: 6, flightType: 'LVL', configuration: 'DT', load: 18 },
  friendlies: [{ aircraft: 'SPOH-F-105G-WILD-WEASEL', hex: T6('spoh-b2', '4130'), boardHex: '4130', facing: 0, alt: 20, speed: 6, configuration: 'DT', load: 18 }],
  // 게임-턴 4 종료 시 진입하는 F-105D 폭격기 4대. 속도 5.0, 고도 10, 북쪽 직진.
  bombers: {
    entryTurn: 4, speed: 5, alt: 10, facing: 0, aircraft: 'SPOH-F-105D-THUNDERCHIEF',
    hexes: [
      { map: 'spoh-b2', boardHex: '3730' }, { map: 'spoh-b2', boardHex: '3830' },
      { map: 'spoh-b2', boardHex: '4129' }, { map: 'spoh-b2', boardHex: '4230' },
    ],
  },
  groundUnits: [
    { id: 'sa2a', side: 'vc', type: 'sam', label: 'SA-2B 발사 유닛 1', image: 'SA2Front.gif', hex: T6('spoh-b1', '4409'), boardHex: '4409',
      defense: 2, elevation: 0, radar: true, mti: false, qrc: false, volley: 3, ready: 6,
      range: 30, minAlt: 3, lock: 6, hit: 6, rating: 8, guidance: 'CG' },
    { id: 'sa2b', side: 'vc', type: 'sam', label: 'SA-2B 발사 유닛 2', image: 'SA2-CFront.gif', hex: T6('spoh-c1', '5506'), boardHex: '5506',
      defense: 2, elevation: 0, radar: true, mti: false, qrc: false, volley: 3, ready: 6,
      range: 30, minAlt: 3, lock: 6, hit: 6, rating: 8, guidance: 'CG' },
    { id: 's60', side: 'vc', type: 'aaa', label: 'S-60 57mm', image: 'S-60Front.gif', hex: T6('spoh-b1', '3907'), boardHex: '3907',
      defense: 2, elevation: 0, range: 12, hit: 4, rating: 4, radar: true, fcr: true },
    { id: 'zu23', side: 'vc', type: 'aaa', label: 'ZU-23 23mm', image: 'ZU-23Front.gif', hex: T6('spoh-b1', '4213'), boardHex: '4213',
      defense: 2, elevation: 0, range: 6, hit: 4, rating: 2 },
    { id: 'aaa37', side: 'vc', type: 'aaa', label: '37mm 대공포', image: 'M38Front.gif', hex: T6('spoh-c1', '6008'), boardHex: '6008',
      defense: 2, elevation: 0, range: 8, hit: 4, rating: 3 },
    { id: 'ks12', side: 'vc', type: 'aaa', label: 'KS-12 85mm', image: 'KS-12Front.gif', hex: T6('spoh-c1', '6612'), boardHex: '6612',
      defense: 2, elevation: 0, range: 18, hit: 5, rating: 5, radar: true, fcr: true },
  ],
  victory: '15턴 동안 SAM 방공망을 제압하고 F-105D 폭격기를 북쪽으로 통과시키십시오. 북쪽 탈출 폭격기 1대당 10점입니다.',
  mapCells: SPOH_T6_LAYOUT.cells, mapBackgrounds: SPOH_T6_LAYOUT.backgrounds, hexSize: 30,
};

export const SCENARIOS = {
  'as-t1-recon-run': RECON_RUN,
  'as-t2-check-ride': CHECK_RIDE,
  'as-s1-border-clash': S1,
  'as-s2-prelude-to-war': S2,
  'as-s3-wrath-of-islam': S3,
  'spoh-a1': SPOH_A1,
  'spoh-a2': SPOH_A2,
  'spoh-b1': SPOH_B1,
  'spoh-b2': SPOH_B2,
  'spoh-c1': SPOH_C1,
  'spoh-c2': SPOH_C2,
  'spoh-a': SPOH_A,
  'spoh-b': SPOH_B,
  'spoh-c': SPOH_C,
  'spoh-t1-flight-school': SPOH_T1,
  'spoh-t2-gunnery-pattern': SPOH_T2,
  'spoh-t3-first-dogfight': SPOH_T3,
  'spoh-t4-missile-age': SPOH_T4,
  'spoh-t5-palm-gate': SPOH_T5,
  'spoh-t6-wild-weasel': SPOH_T6,
};

export function loadScenario(id, { scope = 'basic' } = {}) {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`알 수 없는 지정 시나리오: ${id}`);
  return {
    ...scenario,
    start: { ...scenario.start, hex: { ...scenario.start.hex } },
    waypoints: (scenario.waypoints ?? []).map(w => ({ ...w, hex: { ...w.hex } })),
    hills: scenario.hills?.map(hill => ({ ...hill })),
    markers: scenario.markers?.map(marker => ({ ...marker, hex: { ...marker.hex } })),
    neutrals: scenario.neutrals?.map(unit => ({ ...unit, hex: { ...unit.hex } })),
    groundUnits: scenario.groundUnits?.map(unit => ({ ...unit, hex: { ...unit.hex } })),
    bombers: scenario.bombers ? { ...scenario.bombers, hexes: scenario.bombers.hexes.map(spot => ({ ...spot })) } : undefined,
    maps: scenario.maps ? [...scenario.maps] : undefined,
    mapCells: scenario.mapCells ?? (scenario.maps ? scenarioMapCells(scenario.maps) : undefined),
    mapBackgrounds: scenario.mapBackgrounds ? [...scenario.mapBackgrounds] : undefined,
    friendlies: scenario.friendlies?.map(unit => ({ ...unit, hex: unit.hex ? { ...unit.hex } : hexOfScenarioMap(unit.map, unit.boardHex) })),
    opponents: scenario.opponents?.map(unit => ({ ...unit, hex: unit.hex ? { ...unit.hex } : hexOfScenarioMap(unit.map, unit.boardHex) })),
    groundUnits: scenario.groundUnits?.map(unit => ({ ...unit, hex: { ...unit.hex } })),
    activeRules: rulesFor(scenario.lesson, scope === 'basic' ? 'basic' : null),
    scope,
  };
}
