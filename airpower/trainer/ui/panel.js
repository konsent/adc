import { generate } from '../engine/generate.js';
import { loadScenario } from '../data/scenarios.js';
import { createState, beginTurn, applyAction, endTurn } from '../engine/state.js?v=power-slider-1';
import { validate } from '../engine/validate.js?v=power-slider-1';
import { settle, gradeSettlement } from '../rules/energy.js';
import { AIRCRAFT, bandOf, accelRange, clampAccel } from '../data/aircraft.js';
import { turnCost } from '../data/turnchart.js';
import { distance, hexOfBoardHex, neighbor, boardHexOf, scenarioMapCells, isOnScenarioMap, exitEdgeOf } from '../engine/hex.js?v=map-exit-2';
import { hexCenter, renderMap, drawAircraft, drawHills, drawStart, drawWaypoints, drawPath, drawOpponentTrails, clearLayer } from './hexmap.js?v=hexside-pair-1';
import { canFire, resolveShot } from '../rules/gunnery.js';
import { applyDamage, rollDamage } from '../rules/damage.js';
import { gunOf } from '../data/weapons.js';
import { moveSolitaireOpponent } from '../engine/solitaire.js';
import { orderOfFlight, CATEGORY_LABEL } from '../engine/order-of-flight.js';

const HEX_SIZE = 34;
const svg = document.getElementById('svg');
const panel = document.getElementById('panel');
const aircraftHud = document.getElementById('aircraft-hud');
const violationPopup = document.getElementById('violation-popup');
const completionPopup = document.getElementById('completion-popup');

let scenario, state, history, path, wpIndex, hillPasses, violations, hintOn = true, seed = 1;
let debugLog = [];
// 상대기별 이동 궤적(헥스 목록)과 사건 알림. 둘 다 undo가 되도록 history에 함께 싣는다.
let opponentTrails = [];
let notices = [];
// 언덕 판정은 checkHills 안에서 결정되므로, 그 사유를 act()의 로그 줄에 전달한다.
let hillTrace = null;
let profile = 'normal', scope = 'basic';
let settlementReport = null;
let completed = false;
// 원문 턴 제한을 넘겨 실패한 경우의 사유. null이면 아직 실패 아님.
let failed = null;
let scenarioMode = 'random';
let aircraftId = 'MIG-29';
let mapView = null;
let dragStart = null;
let combatTarget = null;
// 사격 표적으로 고른 상대기 인덱스. combatTarget은 opponents[targetIndex]의 별칭이다.
let targetIndex = 0;
let opponents = [];
// 플레이어가 조종하는 기체 전체(0번이 주기). state는 flight[activeIndex]의 별칭이다.
let flight = [];
let activeIndex = 0;
// 이번 턴에 이동을 마친 기체 인덱스와, 정산된 이동 순서.
let flightDone = [];
let flightOrder = [];
// 기체별 비행 경로와 사격 이력. activeIndex 전환 시 path/gunShots와 스왑된다.
let flightPaths = [];
let flightShots = [];
let gunShots = [];
let combatResult = null;
let pendingDamage = null;

function hillHex(hill) {
  return hexOfBoardHex(hill.boardHex);
}

function scenarioView() {
  const points = [scenario.start.hex, ...scenario.waypoints.map(w => w.hex), ...(scenario.hills ?? []).map(hillHex)]
    .map(hex => hexCenter(hex, HEX_SIZE));
  const padding = HEX_SIZE * 4;
  const minX = Math.min(...points.map(point => point.x)) - padding;
  const maxX = Math.max(...points.map(point => point.x)) + padding;
  const minY = Math.min(...points.map(point => point.y)) - padding;
  const maxY = Math.max(...points.map(point => point.y)) + padding;
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, HEX_SIZE * 10),
    height: Math.max(maxY - minY, HEX_SIZE * 10),
  };
}

function newScenario(lesson = scenario?.lesson ?? 1) {
  seed += 1;
  if (scenarioMode.startsWith('as-')) {
    scenario = loadScenario(scenarioMode, { scope });
  } else {
    const actualLesson = profile === 'altitude-cycle' ? Math.max(2, lesson) : lesson;
    scenario = generate({ lesson: actualLesson, aircraftId, seed, turns: 4, profile, scope });
  }
  state = beginTurn(createState({ aircraftId: scenario.aircraft, ...scenario.start }));
  state = { ...state, ammo: gunOf(state.aircraftId)?.ammo ?? null };
  // 셋업 직후의 상대 선공(opponentsFirst)도 기록해야 하므로 로그를 먼저 비운다.
  debugLog = [];
  notices = [];
  opponentTrails = [];
  if (scenario.solitaire) {
    setupOpponents();
    if (scenario.opponentsFirst) moveOpponents({ advanceTurn: false });
  }
  else {
    combatTarget = null;
    opponents = [];
    flight = [];
    flightOrder = [];
    flightDone = [];
    flightPaths = [];
    flightShots = [];
    activeIndex = 0;
    gunShots = [];
    combatResult = null;
    pendingDamage = null;
  }
  history = [];
  path = [{ kind: 'center', hex: { ...state.hex } }];
  if (flight.length) flightPaths[activeIndex] = path;
  wpIndex = 0;
  hillPasses = [];
  violations = [];
  hillTrace = null;
  settlementReport = null;
  completed = false;
  failed = null;
  // 새 시나리오는 시작점과 모든 체크포인트를 즉시 볼 수 있는 시야로 연다.
  mapView = scenario.maps ? null : scenarioView();
  redraw();
}

/** state(활성기)의 변경을 flight 배열에 되돌려 쓴다. act/fireGun 등이 state를 갈아끼운 뒤 호출. */
function syncActive() {
  if (flight.length) flight[activeIndex] = state;
}

/** 활성 기체를 index번으로 바꾼다. 현재 기체 상태를 먼저 저장한다. */
function selectAircraft(index) {
  if (index === activeIndex || !flight[index]) return;
  syncActive();
  activeIndex = index;
  state = flight[index];
  // 기체마다 경로·사격 이력이 다르므로 표시용 경로도 함께 바꾼다.
  path = flightPaths[index] ?? [{ kind: 'center', hex: { ...state.hex } }];
  gunShots = flightShots[index] ?? [];
  combatResult = null;
  pendingDamage = null;
  redraw();
}

function setupOpponents() {
  // 시나리오의 주기 + friendlies를 하나의 조종 가능한 편대로 합친다.
  flight = [state, ...(scenario.friendlies ?? []).map(unit => ({
    ...beginTurn(createState({ ...unit, aircraftId: unit.aircraft })), map: unit.map, boardHex: unit.boardHex,
    configuration: unit.configuration, load: unit.load,
    ammo: gunOf(unit.aircraft)?.ammo ?? null,
  }))];
  activeIndex = 0;
  flightPaths = flight.map(jet => [{ kind: 'center', hex: { ...jet.hex } }]);
  flightShots = flight.map(() => []);
  flightDone = [];
  opponents = scenario.opponents.map(unit => ({
    ...beginTurn(createState({ ...unit, aircraftId: unit.aircraft })),
    map: unit.map,
    boardHex: unit.boardHex,
    movementMode: unit.movementMode,
    configuration: unit.configuration,
    load: unit.load,
  }));
  targetIndex = 0;
  combatTarget = opponents[0] ?? null;
  gunShots = [];
  combatResult = null;
  pendingDamage = null;
  computeOrder();
}

/** 살아있는 표적 중 첫 번째로 표적을 옮긴다. 전멸이면 null. */
function retarget() {
  if (opponents[targetIndex]?.damage === 'K' || !opponents[targetIndex]) {
    const next = opponents.findIndex(o => o.damage !== 'K');
    targetIndex = next >= 0 ? next : 0;
  }
  combatTarget = opponents[targetIndex] ?? null;
}

/**
 * 이번 턴의 이동 순서를 Rule 12.2(우위 범주) → 12.1(주도권)로 정산한다.
 * 상대기는 순서상 자리만 차지하고, 실제 이동은 기존 솔리테어 자동 이동이 처리한다.
 */
function computeOrder() {
  const units = [
    ...flight.map((jet, index) => ({ id: `P${index}`, side: 'player', jet, index })),
    ...opponents.map((jet, index) => ({ id: `O${index}`, side: 'opponent', jet, index })),
  ];
  const rolls = new Map(units.map(u => [u.id, 1 + Math.floor(Math.random() * 10)]));
  flightOrder = orderOfFlight(units, id => rolls.get(id));
}

function moveOpponents({ advanceTurn = true } = {}) {
  opponents = opponents.map((opponent, index) => {
    const aircraft = AIRCRAFT[opponent.aircraftId];
    const maxClimb = aircraft.climb[bandOf(opponent.alt)] ?? 0;
    const die = 1 + Math.floor(Math.random() * 10);
    const { state: moved, actions } = moveSolitaireOpponent(opponent, { attacker: state, die, maxClimb });
    const capped = { ...moved, speed: Math.min(moved.speed, aircraft.velocity[bandOf(moved.alt)]?.max ?? moved.speed) };
    const next = advanceTurn ? beginTurn(endTurn(capped)) : capped;

    const from = boardHexOf(opponent.hex);
    const to = boardHexOf(next.hex);
    const label = `${aircraft?.title ?? next.aircraftId}(상대 ${index + 1})`;
    const detail = `${from} → ${to} · 고도 ${opponent.alt}→${next.alt} · 속도 ${opponent.speed.toFixed(1)}→${next.speed.toFixed(1)}`
      + ` · 기수 ${FACING_NAMES[next.facing]} · ${next.movementMode ?? '-'} 모드 (주사위 ${die})`;

    (opponentTrails[index] ??= [{ hex: { ...opponent.hex }, boardHex: from, turn: opponent.turnNumber, alt: opponent.alt, speed: opponent.speed }])
      .push({ hex: { ...next.hex }, boardHex: to, turn: next.turnNumber, alt: next.alt, speed: next.speed });

    notices.push({ kind: 'move', turn: state.turnNumber, msg: `${label} 이동: ${detail}` });
    debugLog.push({
      seq: debugLog.length + 1,
      turn: state.turnNumber,
      action: `상대기 이동 — ${label}`,
      before: snapshot(opponent),
      after: snapshot(next),
      violations: [],
      hillPasses: [],
      note: `${detail}${actions?.length ? ` · 지시 ${actions.map(a => a.kind ?? a).join(', ')}` : ''}`,
    });
    return next;
  });
  retarget();
  checkKills();
  checkMapExit();
}

/**
 * 맵 밖으로 나간 기체를 처리한다.
 * ponytail: 원문 룰셋에 맵 가장자리 규정이 없어 기본은 "이탈 = 격추"다.
 * escapeEdge가 있는 시나리오(S-3)는 그 방향으로 나간 상대기만 탈출 성공으로 본다.
 */
function checkMapExit() {
  const maps = scenario.maps;
  if (!maps?.length) return;

  flight.forEach((jet, index) => {
    if (jet.damage === 'K' || isOnScenarioMap(jet.hex, maps)) return;
    flight[index] = { ...jet, damage: 'K' };
    if (index === activeIndex) state = flight[index];
    const label = AIRCRAFT[jet.aircraftId]?.title ?? jet.aircraftId;
    failed = `${label}(아군 ${index + 1})이 맵을 벗어났습니다 (${boardHexOf(jet.hex)}) — 격추 처리.`;
    logExit(`맵 이탈 — ${label}`, jet, failed);
  });

  opponents = opponents.map((opponent, index) => {
    if (opponent.damage === 'K') return opponent;
    const edge = exitEdgeOf(opponent.hex, maps);
    if (!edge) return opponent;
    const label = AIRCRAFT[opponent.aircraftId]?.title ?? opponent.aircraftId;
    // 지정된 탈출 가장자리로 나가야 상대의 목표 달성이다. 다른 방향은 이탈 = 격추.
    const escaped = scenario.escapeEdge ? edge === scenario.escapeEdge : !!scenario.exitIsEscape;
    const msg = escaped
      ? `${label}(상대 ${index + 1})이 ${EDGE_NAMES[edge]} 가장자리로 탈출했습니다 (${boardHexOf(opponent.hex)}) — 저지 실패.`
      : `${label}(상대 ${index + 1})이 ${EDGE_NAMES[edge]} 가장자리를 벗어났습니다 (${boardHexOf(opponent.hex)}) — 격추 처리.`;
    if (escaped) failed = msg;
    logExit(`맵 이탈 — ${label}`, opponent, msg);
    return { ...opponent, damage: 'K', killLogged: true, escaped };
  });

  retarget();
  if (opponents.length && opponents.every(o => o.damage === 'K') && !failed) completed = true;
}

const EDGE_NAMES = { north: '북쪽', south: '남쪽', east: '동쪽', west: '서쪽' };

function logExit(action, jet, msg) {
  notices.push({ kind: 'kill', turn: state.turnNumber, msg });
  debugLog.push({
    seq: debugLog.length + 1, turn: state.turnNumber, action,
    before: snapshot(jet), after: snapshot(jet), violations: [], hillPasses: [], note: msg,
  });
}

/** 격추(K) 상태가 새로 생긴 상대기를 알림·로그로 남긴다. */
function checkKills() {
  opponents.forEach((opponent, index) => {
    if (opponent.damage !== 'K' || opponent.killLogged) return;
    opponents[index] = { ...opponent, killLogged: true };
    const label = AIRCRAFT[opponent.aircraftId]?.title ?? opponent.aircraftId;
    const msg = `${label}(상대 ${index + 1}) 격추! ${boardHexOf(opponent.hex)} · 턴 ${state.turnNumber}`;
    notices.push({ kind: 'kill', turn: state.turnNumber, msg });
    debugLog.push({
      seq: debugLog.length + 1,
      turn: state.turnNumber,
      action: `격추 — ${label}`,
      before: snapshot(opponent),
      after: snapshot(opponent),
      violations: [],
      hillPasses: [],
      note: msg,
    });
  });
  retarget();
  // 솔리테어 시나리오는 적기 전멸이 곧 승리 조건이다 (S-1/S-2/S-3 공통).
  if (opponents.length && opponents.every(o => o.damage === 'K')) completed = true;
}

/**
 * 원문 턴 제한 초과 판정. S-1은 "게임-턴 6 종료 전까지 격추,
 * 게임-턴 7까지 살아남으면 MIG가 국경을 넘어 도주" 규정이다.
 */
function checkTimeout() {
  if (completed || failed || !scenario.maxTurns) return;
  if (state.turnNumber <= scenario.maxTurns) return;
  const alive = opponents.filter(o => o.damage !== 'K');
  if (!alive.length) return;
  const labels = alive.map(o => AIRCRAFT[o.aircraftId]?.title ?? o.aircraftId).join(', ');
  failed = `${scenario.maxTurns}턴 안에 격추하지 못했습니다. ${labels} 이탈 — 임무 실패.`;
  notices.push({ kind: 'kill', turn: state.turnNumber, msg: failed });
  debugLog.push({
    seq: debugLog.length + 1,
    turn: state.turnNumber,
    action: '임무 실패 — 턴 제한 초과',
    before: snapshot(state),
    after: snapshot(state),
    violations: [],
    hillPasses: [],
    note: failed,
  });
}

function applyMapView() {
  svg.setAttribute('viewBox', `${mapView.x} ${mapView.y} ${mapView.width} ${mapView.height}`);
}

function zoomMap(factor) {
  const width = mapView.width * factor;
  const height = mapView.height * factor;
  mapView = {
    x: mapView.x + (mapView.width - width) / 2,
    y: mapView.y + (mapView.height - height) / 2,
    width,
    height,
  };
  applyMapView();
}

function redraw() {
  const map = renderMap(svg, { radius: 24, hexSize: HEX_SIZE, cells: scenario.mapCells ?? null });
  if (!mapView) mapView = map.viewBox;
  applyMapView();
  drawWaypoints(svg, scenario.waypoints, HEX_SIZE, wpIndex);
  // 우회 순서는 자유이므로 통과 표시는 인덱스가 아니라 언덕 번호로 맞춘다.
  drawHills(svg, (scenario.hills ?? []).map(hill => ({ hex: hillHex(hill), label: hill.boardHex })), HEX_SIZE,
    (scenario.hills ?? []).map(hill => hillPasses.some(pass => pass.label === hill.boardHex)));
  if (scenario.hills) drawStart(svg, scenario.start.hex, HEX_SIZE, 'START 1223');
  drawPath(svg, path, HEX_SIZE);
  drawOpponentTrails(svg, opponentTrails, HEX_SIZE);
  // 활성기를 뺀 나머지 편대원. 활성기는 아래에서 따로 그린다.
  const wingmen = flight.map((jet, index) => ({ jet, index })).filter(w => w.index !== activeIndex);
  if (wingmen.length) wingmen.forEach(({ jet, index }, drawn) => drawAircraft(svg, jet.position, jet.facing, HEX_SIZE, jet.aircraftId, { layerName: 'friendly', marker: `아군 ${index + 1}${flightDone.includes(index) ? ' ✓' : ''}`, clear: drawn === 0, tooltip: aircraftTooltip(jet) }));
  else clearLayer(svg, 'friendly');
  if (opponents.length) opponents.forEach((opponent, index) => drawAircraft(svg, opponent.position, opponent.facing, HEX_SIZE, opponent.aircraftId, { layerName: 'target', marker: `OPPONENT ${index + 1}`, clear: index === 0, tooltip: aircraftTooltip(opponent) }));
  else clearLayer(svg, 'target');
  drawAircraft(svg, state.position, state.facing, HEX_SIZE, state.aircraftId, { tooltip: aircraftTooltip(state) });
  renderAircraftHud();
  renderPanel();
  renderViolationPopup();
  renderCompletionPopup();
}

function aircraftTooltip(jet) {
  const aircraft = AIRCRAFT[jet.aircraftId];
  const facing = ['N', 'NNE', 'NE', 'ENE', 'SE', 'ESE', 'S', 'SSW', 'SW', 'WSW', 'NW', 'WNW'][jet.facing];
  return [
    aircraft?.title ?? jet.aircraftId,
    `속도 ${jet.speed.toFixed(1)} · 고도 ${jet.alt} · 기수 ${facing}`,
    `피해 ${jet.damage ?? 'none'}${jet.movementMode ? ` · ${jet.movementMode}` : ''}`,
  ].join('\n');
}

function renderAircraftHud() {
  const aircraft = AIRCRAFT[state.aircraftId];
  const facing = ['N', 'NNE', 'NE', 'ENE', 'SE', 'ESE', 'S', 'SSW', 'SW', 'WSW', 'NW', 'WNW'][state.facing];
  aircraftHud.innerHTML = `
    <div class="hud-title">${aircraft.title}</div>
    <div class="hud-stats">속도 <b>${state.speed.toFixed(1)}</b> · 고도 <b>${state.alt}</b> · 기수 <b>${facing}</b></div>
    <div class="hud-stats">${state.flightType} · FP <b>${state.fpSpent.length}/${state.fpBudget}</b> · 턴 <b>${state.turnNumber}</b></div>
    ${combatTarget ? `<div class="hud-stats">표적 ${AIRCRAFT[combatTarget.aircraftId].title} · 피해 <b>${combatTarget.damage ?? 'none'}</b></div>` : ''}`;
}

document.getElementById('zoom-in').onclick = () => zoomMap(0.75);
document.getElementById('zoom-out').onclick = () => zoomMap(1 / 0.75);
document.getElementById('zoom-reset').onclick = () => {
  mapView = renderMap(svg, { radius: 24, hexSize: HEX_SIZE, cells: scenario.maps ? scenarioMapCells(scenario.maps) : null }).viewBox;
  applyMapView();
};

svg.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  dragStart = { x: event.clientX, y: event.clientY, view: { ...mapView } };
  svg.setPointerCapture(event.pointerId);
  svg.classList.add('dragging');
});

svg.addEventListener('pointermove', event => {
  if (!dragStart) return;
  const rect = svg.getBoundingClientRect();
  mapView = {
    ...dragStart.view,
    x: dragStart.view.x - (event.clientX - dragStart.x) * dragStart.view.width / rect.width,
    y: dragStart.view.y - (event.clientY - dragStart.y) * dragStart.view.height / rect.height,
  };
  applyMapView();
});

function endMapDrag(event) {
  if (!dragStart) return;
  dragStart = null;
  svg.classList.remove('dragging');
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
}

svg.addEventListener('pointerup', endMapDrag);
svg.addEventListener('pointercancel', endMapDrag);

function checkWaypoint() {
  if (scenario.hills) return;
  const wp = scenario.waypoints[wpIndex];
  if (!wp) return;
  if (wp.hex.q === state.hex.q && wp.hex.r === state.hex.r) {
    const tol = scenario.lesson >= 3 ? 1 : 0;
    if (Math.abs(state.alt - wp.alt) <= tol) {
      wpIndex += 1;
      if (wpIndex >= scenario.waypoints.length) completed = true;
    }
  }
}

function hillDirection(hill, from, to) {
  const directions = [0, 2, 4, 6, 8, 10];
  const indexOf = hex => directions.findIndex(facing => {
    const adjacent = neighbor(hill, facing);
    return adjacent.q === hex.q && adjacent.r === hex.r;
  });
  const fromIndex = indexOf(from);
  const toIndex = indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return null;
  const delta = (toIndex - fromIndex + 6) % 6;
  if (delta === 1) return 'clockwise';
  if (delta === 5) return 'counterclockwise';
  return null;
}

function checkHills(previousHex) {
  hillTrace = null;
  if (!scenario.hills) return;

  // 각 언덕까지의 거리를 남겨, 통과로 인정되지 않은 이유를 로그에서 바로 본다.
  const near = scenario.hills.map(hill => {
    const hex = hillHex(hill);
    return {
      label: hill.boardHex,
      done: hillPasses.some(pass => pass.label === hill.boardHex),
      prevDist: distance(previousHex, hex),
      curDist: distance(state.hex, hex),
    };
  });

  // 언덕 중심 통과는 어느 언덕이든 즉시 위반이다.
  const entered = scenario.hills.find(hill => {
    const hex = hillHex(hill);
    return state.hex.q === hex.q && state.hex.r === hex.r;
  });
  if (entered) {
    hillTrace = { verdict: `언덕 ${entered.boardHex} 중심 진입 — 위반`, near };
    violations.push({ rule: 'T-1', turn: state.turnNumber, actionKind: 'hfp', msg: `언덕 ${entered.boardHex} 중심을 통과했습니다.`, fix: '언덕의 인접 헥스를 통해 좌우로 우회하세요.' });
    return;
  }

  // 배열 순서가 아니라 실제로 옆을 지난 언덕을 인정한다. 시나리오의 언덕 순서는
  // 출발점(1223)에서 가까운 순이 아니라서, 고정 인덱스로 기다리면 정상 우회해도
  // 완료 처리가 되지 않았다.
  const hill = scenario.hills.find(candidate => {
    if (hillPasses.some(pass => pass.label === candidate.boardHex)) return false;
    const hex = hillHex(candidate);
    return distance(previousHex, hex) === 1 && distance(state.hex, hex) === 1;
  });
  if (!hill) {
    hillTrace = { verdict: '인접(거리 1) 연속 통과 조건을 만족하는 언덕 없음', near };
  } else {
    const direction = hillDirection(hillHex(hill), previousHex, state.hex);
    if (!direction) {
      hillTrace = { verdict: `언덕 ${hill.boardHex} 옆이지만 인접 링을 따라 한 칸 이동이 아님 — 미인정`, near };
    } else {
      const previous = hillPasses.at(-1);
      if (previous && previous.direction === direction) {
        hillTrace = { verdict: `언덕 ${hill.boardHex} ${direction} — 직전과 같은 방향, 위반`, near };
        violations.push({ rule: 'T-1', turn: state.turnNumber, actionKind: 'hfp', msg: `언덕 ${hill.boardHex} 우회 방향이 직전 언덕과 같습니다.`, fix: '각 언덕은 직전 언덕과 반대 방향으로 우회하세요.' });
        return;
      }
      hillPasses.push({ label: hill.boardHex, direction, passed: true });
      hillTrace = { verdict: `언덕 ${hill.boardHex} ${direction} 우회 인정 (${hillPasses.length}/${scenario.hills.length})`, near };
    }
  }

  if (hillPasses.length === scenario.hills.length
    && state.hex.q === scenario.start.hex.q && state.hex.r === scenario.start.hex.r) {
    completed = !violations.some(violation => violation.rule === 'T-1');
  }
}

const FACING_NAMES = ['N', 'NNE', 'NE', 'ENE', 'SE', 'ESE', 'S', 'SSW', 'SW', 'WSW', 'NW', 'WNW'];

function describeAction(action) {
  if (action.kind === 'hfp') return 'HFP 전진';
  if (action.kind === 'vfp') return `VFP ${action.levels}레벨`;
  if (action.kind === 'declare') {
    const turn = action.turn ? `선회 ${action.turn.rate}/${action.turn.dir === 'L' ? '좌' : '우'}` : '선회 해제';
    return `선언 ${action.flightType}/${action.power} · ${turn}`;
  }
  return action.kind;
}

function snapshot(s) {
  const turnProgress = s.turnProgress
    ? `${s.turnProgress.rate}/${s.turnProgress.dir === 'L' ? '좌' : '우'} ${s.turnProgress.fp}FP`
    : '없음';
  return {
    boardHex: boardHexOf(s.hex),
    hex: `${s.hex.q},${s.hex.r}`,
    position: s.position.kind === 'side'
      ? `헥스사이드 ${boardHexOf(s.position.left)}/${boardHexOf(s.position.right)}`
      : '헥스 중심',
    facing: `${s.facing} (${FACING_NAMES[s.facing]})`,
    speed: s.speed.toFixed(1),
    alt: s.alt,
    flightType: s.flightType,
    turnProgress,
    fp: `${s.fpSpent.length}/${s.fpBudget}`,
  };
}

function logAction(action, before, newViolations) {
  debugLog.push({
    seq: debugLog.length + 1,
    turn: before.turnNumber,
    action: describeAction(action),
    before: snapshot(before),
    after: snapshot(state),
    hill: hillTrace,
    violations: newViolations.map(v => `[${v.rule}] ${v.msg}`),
    hillPasses: hillPasses.map(pass => `${pass.label}:${pass.direction}`),
  });
}

function act(action) {
  const before = state;
  const violationsBefore = violations.length;
  history.push({ state, path: [...path], wpIndex, hillPasses: [...hillPasses], violations: [...violations], completed, failed, debugLog: [...debugLog], notices: [...notices], opponentTrails: opponentTrails.map(t => [...t]), combatTarget, targetIndex, opponents, gunShots: [...gunShots], combatResult, pendingDamage, flight: [...flight], activeIndex, flightPaths: flightPaths.map(p => [...p]), flightShots: flightShots.map(s => [...s]), flightOrder });
  settlementReport = null;
  const found = validate(state, action, { activeRules: scenario.activeRules, lesson: scenario.lesson });
  // 선회율/비행 타입 선언은 같은 턴에 바꿔 선택할 수 있다. 새 선언은 이전 선언의
  // 경고를 해소하므로, 해당 턴의 선언 경고만 새 판정으로 교체한다.
  const retained = action.kind === 'declare'
    ? violations.filter(v => !(v.turn === state.turnNumber && v.actionKind === 'declare'))
    : violations;
  violations = [...retained, ...found.map(v => ({ ...v, turn: state.turnNumber, actionKind: action.kind }))];
  state = applyAction(state, action);
  hillTrace = null;
  if (action.kind === 'hfp') {
    path.push(state.position.kind === 'side'
      ? JSON.parse(JSON.stringify(state.position))
      : { kind: 'center', hex: { ...state.hex } });
    checkHills(history.at(-1).state.hex);
  }
  checkWaypoint();
  syncActive();
  if (flight.length) flightPaths[activeIndex] = path;
  checkMapExit();
  logAction(action, before, violations.slice(violationsBefore));
  redraw();
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  ({ state, wpIndex, hillPasses, completed } = prev);
  failed = prev.failed ?? null;
  path = prev.path;
  violations = prev.violations;
  debugLog = prev.debugLog;
  notices = prev.notices ?? [];
  opponentTrails = prev.opponentTrails ?? [];
  combatTarget = prev.combatTarget;
  targetIndex = prev.targetIndex ?? 0;
  opponents = prev.opponents;
  flight = prev.flight ?? [];
  activeIndex = prev.activeIndex ?? 0;
  flightPaths = prev.flightPaths ?? [];
  flightShots = prev.flightShots ?? [];
  flightOrder = prev.flightOrder ?? [];
  gunShots = prev.gunShots;
  combatResult = prev.combatResult;
  pendingDamage = prev.pendingDamage;
  redraw();
}

function nextTurn() {
  const before = state;
  syncActive();
  const r = settle(state);
  settlementReport = r;
  // 편대 전체를 정산한다. 활성기는 settlementReport로 상세 표시하고, 나머지는 조용히 넘긴다.
  if (flight.length > 1) {
    flight = flight.map(jet => {
      const s = settle(jet);
      return beginTurn({ ...endTurn(jet), speed: s.newSpeed, accelCarry: s.accelCarry, decelCarry: s.decelCarry });
    });
    state = flight[activeIndex];
    flightPaths = flight.map(jet => [{ kind: 'center', hex: { ...jet.hex } }]);
    flightShots = flight.map(() => []);
    path = flightPaths[activeIndex];
    flightDone = [];
  } else {
    state = endTurn(state);
    state = beginTurn({ ...state, speed: r.newSpeed, accelCarry: r.accelCarry, decelCarry: r.decelCarry });
    syncActive();
    if (flight.length) { flightPaths[activeIndex] = path = [{ kind: 'center', hex: { ...state.hex } }]; }
  }
  if (opponents.length) moveOpponents();
  computeOrder();
  gunShots = [];
  combatResult = null;
  pendingDamage = null;
  hillTrace = null;
  logAction({ kind: 'endturn' }, before, []);
  debugLog.at(-1).action = `턴 종료 정산 · Accel ${r.totalAccel.toFixed(1)} / Decel ${r.totalDecel.toFixed(1)} / 순 ${r.net.toFixed(1)} → 속도 ${r.newSpeed.toFixed(1)}`;
  checkTimeout();
  redraw();
}

function settlementLines(items, sign) {
  return items.length
    ? items.map(item => `${item.label} ${sign}${item.value.toFixed(1)}`).join('<br>')
    : '없음';
}

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

function turnRequirement(rate) {
  const cost = turnCost(bandOf(state.alt), state.speed, rate);
  if (!cost) return '사용 불가';
  if (cost.degrees) return '최소 HFP 1회: 60도';
  return `30도 선회까지 최소 HFP ${cost.fp}회`;
}

function turnButtons() {
  return ['EZ', 'TT', 'HT', 'BT', 'ET'].map(rate => {
    const cost = turnCost(bandOf(state.alt), state.speed, rate);
    const active = state.turnProgress?.rate === rate;
    const progress = active && cost && !cost.degrees
      ? ` ${state.turnProgress.fp}/${cost.fp}`
      : '';
    return `<div class="turn-rate ${active ? 'active' : ''}">
      <span><b>${rate}</b><small>${turnRequirement(rate)}${progress}</small></span>
      <button class="turn-btn ${active && state.turnProgress.dir === 'L' ? 'selected' : ''}" data-rate="${rate}" data-dir="L">좌</button>
      <button class="turn-btn ${active && state.turnProgress.dir === 'R' ? 'selected' : ''}" data-rate="${rate}" data-dir="R">우</button>
    </div>`;
  }).join('');
}

function debugLogHtml() {
  if (!debugLog.length) return '<div class="turn-help">아직 기록 없음. HFP·선회·턴 종료를 실행하면 이동 헥스와 판정이 기록됩니다.</div>';
  // 최신 항목이 위로 오게 뒤집어, 방금 한 행동을 스크롤 없이 본다.
  return [...debugLog].reverse().map(entry => `
    <div class="debug-entry">
      <div class="debug-head">#${entry.seq} · 턴 ${entry.turn} · ${entry.action}</div>
      <div class="debug-line">위치 ${entry.before.boardHex} → <b>${entry.after.boardHex}</b> (${entry.after.position})</div>
      <div class="debug-line">기수 ${entry.before.facing} → ${entry.after.facing} · 선회 ${entry.before.turnProgress} → ${entry.after.turnProgress}</div>
      <div class="debug-line">속도 ${entry.before.speed} → ${entry.after.speed} · 고도 ${entry.before.alt} → ${entry.after.alt} · ${entry.after.flightType} · FP ${entry.after.fp}</div>
      ${entry.hill ? `<div class="debug-line hill">언덕: ${entry.hill.verdict}</div>
      <div class="debug-line dim">거리(이전→현재): ${entry.hill.near.map(n => `${n.label} ${n.prevDist}→${n.curDist}${n.done ? '✓' : ''}`).join(' · ')}</div>` : ''}
      ${entry.note ? `<div class="debug-line dim">${entry.note}</div>` : ''}
      ${entry.violations.length ? `<div class="debug-line bad">${entry.violations.join('<br>')}</div>` : ''}
    </div>`).join('');
}

function debugLogText() {
  const head = `# Air Power Trainer 디버그 로그
시나리오: ${scenario.title ?? scenarioMode} (${scenario.aircraft})
시작: ${scenario.start.boardHex ?? boardHexOf(scenario.start.hex)} · 기록 ${debugLog.length}건
언덕: ${(scenario.hills ?? []).map(h => h.boardHex).join(', ') || '없음'}
`;
  const body = debugLog.map(entry => [
    `#${entry.seq} 턴 ${entry.turn} · ${entry.action}`,
    `  위치     ${entry.before.boardHex} (${entry.before.hex}) -> ${entry.after.boardHex} (${entry.after.hex}) [${entry.after.position}]`,
    `  기수     ${entry.before.facing} -> ${entry.after.facing}`,
    `  선회     ${entry.before.turnProgress} -> ${entry.after.turnProgress}`,
    `  속도/고도 ${entry.before.speed}/${entry.before.alt} -> ${entry.after.speed}/${entry.after.alt} (${entry.after.flightType}, FP ${entry.after.fp})`,
    entry.hill ? `  언덕     ${entry.hill.verdict}` : null,
    entry.hill ? `  거리     ${entry.hill.near.map(n => `${n.label} ${n.prevDist}->${n.curDist}${n.done ? ' 통과' : ''}`).join(' | ')}` : null,
    entry.hillPasses.length ? `  통과목록 ${entry.hillPasses.join(', ')}` : null,
    entry.note ? `  비고     ${entry.note}` : null,
    ...entry.violations.map(v => `  위반     ${v}`),
  ].filter(Boolean).join('\n')).join('\n\n');
  return `${head}\n${body}\n`;
}

function noticesHtml() {
  // 최근 것이 위로. 상대기 이동·격추 같은 사건 알림은 위반과 같은 팝업에 함께 띄운다.
  if (!notices.length) return '';
  return [...notices].reverse().slice(0, 6).map(n => `<div class="notice ${n.kind}">
    <div class="r">턴 ${n.turn} · ${n.kind === 'kill' ? '격추' : '상대 이동'}</div>
    <div>${n.msg}</div>
  </div>`).join('');
}

function renderViolationPopup() {
  const notice = noticesHtml();
  if (!violations.length) {
    violationPopup.innerHTML = `<div class="violation-title">알림</div>${notice
      || '<div class="turn-help">현재 위반 없음. 위반·상대기 이동·격추가 발생하면 이곳에 표시됩니다.</div>'}`;
    return;
  }
  violationPopup.innerHTML = `
    <div class="violation-title">규칙 위반 ${violations.length}건</div>
    ${violations.map(v => `<div class="violation">
      <div class="r">[Rule ${v.rule}] 턴 ${v.turn}</div>
      <div>${v.msg}</div>
      <div class="fix">→ ${v.fix}</div>
    </div>`).join('')}
    ${notice}
    <div class="turn-help">위반 행동을 되돌리거나 새 시나리오를 시작할 때까지 표시됩니다.</div>`;
}

function renderCompletionPopup() {
  if (!completed && !failed) {
    completionPopup.textContent = '';
    completionPopup.classList.remove('failed');
    return;
  }
  completionPopup.classList.toggle('failed', !!failed && !completed);
  if (failed && !completed) {
    completionPopup.innerHTML = `
      <div class="completion-title">임무 실패</div>
      <div class="completion-detail">${failed}<br>${state.turnNumber}턴 · 규칙 위반 ${violations.length}건</div>
      <div class="turn-help">새 시나리오를 시작하면 이 알림이 사라집니다.</div>`;
    return;
  }
  const allKilled = opponents.length && opponents.every(o => o.damage === 'K');
  const overTurn = scenario.maxTurns && state.turnNumber > scenario.maxTurns;
  completionPopup.innerHTML = `
    <div class="completion-title">${allKilled ? '적기 전멸' : '모든 체크포인트 통과'}</div>
    <div class="completion-detail">${allKilled
      ? `적기 ${opponents.length}대를 모두 격추했습니다. ${state.turnNumber}턴`
        + (scenario.maxTurns ? `<br>원문 제한 ${scenario.maxTurns}턴 — ${overTurn ? '초과 (원문 기준 실패)' : '이내 달성'}` : '')
      : `${scenario.hills ? `${scenario.hills.length}개 언덕을 우회하고 출발점에 복귀` : `${scenario.waypoints.length}개 체크포인트 통과`}했습니다. ${state.turnNumber}턴`
    }<br>규칙 위반 ${violations.length}건</div>
    <div class="turn-help">새 시나리오를 시작하면 이 알림이 사라집니다.</div>`;
}

const FLIGHT_TYPES = [
  ['LVL', '수평 비행'],
  ['SC', '지속 상승'],
  ['ZC', '줌 상승'],
  ['VC', '수직 상승'],
  ['SD', '급하강'],
  ['UD', '무부하 하강'],
  ['VD', '수직 하강'],
];

function verticalHelp() {
  if (state.flightType === 'VC') return 'VC: 첫 수직 상승 턴은 HFP 정확히 1/3, 이후 턴은 HFP 최대 1/3입니다. 일반 선회는 불가합니다.';
  if (state.flightType === 'VD') return 'VD: 첫 수직 하강 턴은 HFP 정확히 1/3, 이후 턴은 HFP 최대 1/3입니다. VFP당 2~3레벨 하강, 일반 선회는 불가합니다.';
  return '';
}

/** MIL/AB일 때 Accel 값을 0.5 단위로 고르는 슬라이더 (Rule 6.5). */
function accelSlider() {
  const ac = AIRCRAFT[state.aircraftId];
  const band = bandOf(state.alt);
  const range = accelRange(ac, state.power, band);
  if (!range) return '';
  const value = clampAccel(ac, state.power, band, state.powerAccel);
  return `<div class="accel-row">
      <input type="range" id="power-accel" min="${range.min}" max="${range.max}" step="0.5" value="${value}">
      <output id="power-accel-out">${value.toFixed(1)}</output>
    </div>
    <div class="turn-help">${state.power} Accel ${range.min.toFixed(1)}~${range.max.toFixed(1)} (${band} 밴드) 중 선택</div>`;
}

function vfpAction(levels) {
  return {
    kind: 'vfp',
    levels,
    direction: state.flightType === 'LVL' || ['SD', 'UD', 'VD'].includes(state.flightType) ? 'down' : 'up',
  };
}

function vfpLabel(levels) {
  if (state.flightType === 'LVL') return levels === 1 ? 'VFP 자유 하강 1레벨' : 'LVL에서는 자유 하강 1레벨만 가능';
  return `VFP ${['SD', 'UD', 'VD'].includes(state.flightType) ? '하강' : '상승'} ${levels}레벨`;
}

function fireGun(snap) {
  const errors = canFire(state, combatTarget, { shots: gunShots });
  if (errors.length) {
    combatResult = { error: errors[0].msg };
    redraw();
    return;
  }
  const roll = 1 + Math.floor(Math.random() * 10);
  const result = resolveShot(state, combatTarget, roll, { snap });
  const ammo = state.ammo ?? gunOf(state.aircraftId)?.ammo;
  if (ammo !== null) state = { ...state, ammo: Math.max(0, ammo - result.ammo) };
  gunShots = [...gunShots, { fpIndex: state.fpSpent.length }];
  syncActive();
  if (flight.length) flightShots[activeIndex] = gunShots;
  combatResult = result;
  pendingDamage = result.hit ? result : null;
  // 명중하면 피해 주사위까지 한 번에 굴려 결과만 보여준다. applyCombatDamage가 redraw한다.
  if (pendingDamage) applyCombatDamage();
  else redraw();
}

function applyCombatDamage() {
  if (!pendingDamage) return;
  const roll = 1 + Math.floor(Math.random() * 10);
  // Snap Shot 명중은 Damage Table 한 등급 하향 = Attack Rating -1 (Rule 9.1).
  const rating = Math.max(1, pendingDamage.rating - (pendingDamage.downgrade ? 1 : 0));
  const { result, modified } = rollDamage(rating, roll, combatTarget);
  combatTarget = applyDamage(combatTarget, result);
  opponents = opponents.map((opponent, index) => index === targetIndex ? combatTarget : opponent);
  combatResult = {
    ...combatResult,
    damage: result, damageRoll: roll, damageModified: modified,
    targetDamage: combatTarget.damage,
  };
  pendingDamage = null;
  checkKills();
  redraw();
}

function combatHtml() {
  if (!combatTarget) return '';
  const gun = gunOf(state.aircraftId);
  const target = AIRCRAFT[combatTarget.aircraftId];
  const range = distance(state.hex, combatTarget.hex) + Math.floor(Math.abs(state.alt - combatTarget.alt) / 2);
  const report = combatResult?.error
    ? `<div class="turn-help">사격 불가: ${combatResult.error}</div>`
    : combatResult
      ? `<div class="turn-help">기총 ${combatResult.roll} / 목표 ${combatResult.target} → <b>${combatResult.hit ? '명중' : '빗나감'}</b>${combatResult.hit ? ` · 공격력 ${combatResult.rating}` : ''}${combatResult.damage ? ` · 피해 주사위 ${combatResult.damageRoll}→${combatResult.damageModified} · <b>${combatResult.damage}</b> → 표적 ${combatResult.targetDamage}` : ''}</div>`
      : '<div class="turn-help">명중하면 Damage Table을 자동으로 굴려 누적 피해에 반영합니다.</div>';
  return `<div class="row">
    <label>공대공 기총 · 표적 ${target.title}</label>
    ${opponents.length > 1 ? `<select id="target-select">
      ${opponents.map((o, index) => `<option value="${index}" ${index === targetIndex ? 'selected' : ''} ${o.damage === 'K' ? 'disabled' : ''}>상대 ${index + 1} · ${AIRCRAFT[o.aircraftId]?.title ?? o.aircraftId} · ${boardHexOf(o.hex)} · 고도 ${o.alt} · ${o.damage === 'K' ? '격추됨' : `피해 ${o.damage ?? 'none'}`}</option>`).join('')}
    </select>` : ''}
    <div class="combat">사거리 <b>${range}</b> · 표적 피해 <b>${combatTarget.damage ?? 'none'}</b> · 이번 턴 사격 <b>${gunShots.length}/2</b><br>
      ${gun ? `기관포 ${gun.type} · 탄약 ${state.ammo ?? '미상'}` : '이 기체는 기관포가 없습니다.'}
      <div class="debug-actions"><button id="fire-full">기총 정규 사격</button><button id="fire-snap">Snap Shot</button></div>
      ${report}
    </div>
  </div>`;
}

function renderPanel() {
  const ac = AIRCRAFT[state.aircraftId];
  const used = state.fpSpent.length;
  const done = scenario.hills ? completed : wpIndex >= scenario.waypoints.length;
  const budgetSpent = used >= state.fpBudget;
  const settlementPreview = budgetSpent ? settle(state) : null;
  // 편대 전원이 FP를 소진해야 턴을 넘길 수 있다. 아직 남은 기체는 이름으로 알려준다.
  const pendingJets = flight
    .map((jet, index) => ({ jet, index }))
    .filter(({ jet }) => jet.fpSpent.length < jet.fpBudget);
  const flightReady = flight.length <= 1 || pendingJets.length === 0;

  const fpBar = Array.from({ length: state.fpBudget }, (_, i) => {
    const f = state.fpSpent[i];
    const cls = !f ? '' : f.type === 'HFP' ? 'h' : 'v';
    return `<div class="fp ${cls}">${f ? (f.type === 'HFP' ? 'H' : 'V') : ''}</div>`;
  }).join('');

  panel.innerHTML = `
    <h1>${scenario.title ?? `레슨 ${scenario.lesson}`} · ${ac.title}</h1>
    <div class="row">
      <label>레슨</label>
      <select id="lesson">
        ${[
          '레슨 1 · 수평 기동과 선회',
          '레슨 2 · 상승/하강과 VFP',
          '레슨 3 · 에너지 관리와 정산',
          '레슨 4 · 수직 상승/하강',
        ].map((label, index) => `<option value="${index + 1}" ${index + 1 === scenario.lesson ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>
    <div class="row"><button id="new">새 시나리오</button></div>
    <div class="row">
      <label>시나리오 선택</label>
      <select id="scenario-mode">
        <option value="random" ${scenarioMode === 'random' ? 'selected' : ''}>랜덤 훈련 시나리오</option>
        <option value="as-t1-recon-run" ${scenarioMode === 'as-t1-recon-run' ? 'selected' : ''}>Air Superiority T-1: Recon Run</option>
         <option value="as-t2-check-ride" ${scenarioMode === 'as-t2-check-ride' ? 'selected' : ''}>Air Superiority T-2: Check Ride</option>
         <option value="as-s1-border-clash" ${scenarioMode === 'as-s1-border-clash' ? 'selected' : ''}>Air Superiority S-1: Border Clash</option>
         <option value="as-s2-prelude-to-war" ${scenarioMode === 'as-s2-prelude-to-war' ? 'selected' : ''}>Air Superiority S-2: Prelude to War</option>
         <option value="as-s3-wrath-of-islam" ${scenarioMode === 'as-s3-wrath-of-islam' ? 'selected' : ''}>Air Superiority S-3: The Wrath of Islam</option>
      </select>
      ${scenario.source ? `<div class="turn-help">출처: ${scenario.source}${
        scenario.maxTurns ? ` · 원문 제한: ${scenario.maxTurns}턴 이내`
        : scenario.victory ? ` · 승리 조건: ${scenario.victory}` : ''}</div>` : ''}
    </div>
    ${scenarioMode === 'random' ? `<div class="row">
      <label>항공기</label>
      <select id="aircraft">
        ${Object.values(AIRCRAFT).map(aircraft => `<option value="${aircraft.id}" ${aircraft.id === state.aircraftId ? 'selected' : ''}>${aircraft.title}</option>`).join('')}
      </select>
    </div>` : ''}
    ${flight.length > 1 ? `<div class="row">
      <label>조종 기체 (${activeIndex + 1}/${flight.length})</label>
      <div class="flight-list">${flight.map((jet, index) => {
        const done = jet.fpSpent.length >= jet.fpBudget;
        return `<button class="flight-btn ${index === activeIndex ? 'selected' : ''} ${done ? 'done' : ''}" data-jet="${index}">
          ${AIRCRAFT[jet.aircraftId]?.title ?? jet.aircraftId} #${index + 1}<small>${boardHexOf(jet.hex)} · 고도 ${jet.alt} · FP ${jet.fpSpent.length}/${jet.fpBudget}${done ? ' ✓' : ''}</small>
        </button>`;
      }).join('')}</div>
      <div class="turn-help">기체를 눌러 조종 대상을 바꿉니다. 모든 기체가 FP를 소진해야 턴을 종료할 수 있습니다.</div>
    </div>` : ''}
    ${flightOrder.length > 1 ? `<div class="row">
      <label>이번 턴 이동 순서 (Rule 12.2 → 12.1)</label>
      <div class="turn-help">${flightOrder.map((u, i) => {
        const name = AIRCRAFT[u.jet.aircraftId]?.title ?? u.jet.aircraftId;
        const who = u.side === 'player' ? `아군 ${u.index + 1}` : `상대 ${u.index + 1}`;
        return `${i + 1}. ${who} ${name} — ${CATEGORY_LABEL[u.category]} · 주도권 ${u.initiative}`;
      }).join('<br>')}</div>
      <div class="turn-help">불리한 범주가 먼저, 같은 범주면 주도권이 낮은 쪽이 먼저 움직입니다.</div>
    </div>` : ''}
    ${opponents.length ? `<div class="row"><div class="turn-help">상대 ${opponents.length}대는 원문 셋업과 회피 기동 표를 따라 자동 이동합니다. 턴 종료 시 각 상대의 주사위 이동이 적용됩니다.</div></div>` : ''}
    ${scenarioMode === 'random' ? `<div class="row">
      <label>시나리오 유형</label>
      <select id="profile">
        <option value="normal" ${profile === 'normal' ? 'selected' : ''}>일반 이동</option>
        <option value="altitude-cycle" ${profile === 'altitude-cycle' ? 'selected' : ''}>상승 ↔ 하강 반복</option>
      </select>
    </div>` : ''}
    <div class="row">
      <label><input type="checkbox" id="advanced" ${scope === 'all' ? 'checked' : ''} style="width:auto"> 고급 규칙 포함</label>
      <div class="turn-help">현재 고급 항목: 수직 상승/하강의 HFP·VFP 비율(8.1.3/8.2.3).</div>
    </div>
    <div class="row">
      <label><input type="checkbox" id="hint" ${hintOn?'checked':''} style="width:auto"> 힌트 (즉시 경고)</label>
    </div>

    <div class="row">
      <label>턴 ${state.turnNumber} · 속도 ${state.speed.toFixed(1)} · 고도 ${state.alt} · 예산 ${used}/${state.fpBudget}</label>
      <div class="fpbar">${fpBar}</div>
    </div>

    <div class="row">
      <label>비행 타입</label>
      <select id="ft">
        ${FLIGHT_TYPES.map(([id, label]) => `<option value="${id}" ${id===state.flightType?'selected':''}>${id} · ${label}</option>`).join('')}
      </select>
      <div class="turn-help">비행 타입을 고르면 즉시 적용되며 진행 중인 선회는 해제됩니다.</div>
      ${verticalHelp() ? `<div class="turn-help">${verticalHelp()}</div>` : ''}
    </div>
    <div class="row">
      <label>파워 설정</label>
      <select id="power">
        ${['AB', 'MIL', 'Norm', 'Idle', 'Spbr'].map(p => `<option value="${p}" ${p === state.power ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
      ${accelSlider()}
      <div class="turn-help">AB/MIL은 Accel, Idle/Spbr는 Decel을 만듭니다. 일반 기체의 Idle → AB 직접 상승은 Flame-Out 판정 대상입니다.</div>
    </div>
    <div class="row">
      <label>선회율 · 좌/우 방향</label>
      <div class="turn-list">${turnButtons()}</div>
      <div class="turn-help">버튼을 누르면 즉시 선회가 선언됩니다. 이후 HFP를 필요한 횟수만큼 소모하면 기수가 꺾입니다.</div>
    </div>

    <div class="row">
      <button id="hfp" ${budgetSpent?'disabled':''}>HFP 전진</button>
    </div>
    <div class="row">
      <button id="vfp1" ${budgetSpent?'disabled':''}>${vfpLabel(1)}</button>
    </div>
    <div class="row">
      <button id="vfp2" ${budgetSpent || state.flightType === 'LVL' ? 'disabled' : ''}>${vfpLabel(2)}</button>
    </div>
    <div class="row">
      <button id="vfp3" ${budgetSpent || state.flightType === 'LVL' ? 'disabled' : ''}>${vfpLabel(3)}</button>
    </div>
    <div class="row"><button id="undo">되돌리기</button></div>
    ${combatHtml()}
    ${settlementPreview ? `<div class="settlement-preview">
      <b>턴 종료 정산 예측</b><br>
      Accel ${settlementPreview.totalAccel.toFixed(1)} / Decel ${settlementPreview.totalDecel.toFixed(1)} / 순 ${settlementPreview.net.toFixed(1)}<br>
      다음 속도 ${state.speed.toFixed(1)} → <b>${settlementPreview.newSpeed.toFixed(1)}</b>
    </div><div class="row">
      <button id="next" ${flightReady ? '' : 'disabled'}>턴 종료 · 정산 적용</button>
      ${flightReady ? '' : `<div class="turn-help">아직 이동이 남은 기체: ${pendingJets.map(({ jet, index }) => `${AIRCRAFT[jet.aircraftId]?.title ?? jet.aircraftId} #${index + 1} (FP ${jet.fpSpent.length}/${jet.fpBudget})`).join(', ')}</div>`}
    </div>` : ''}
    ${settlementReport ? `<div class="settlement-report">
      <b>직전 턴 정산</b><br>
      <span>Accel</span><br>${settlementLines(settlementReport.accel, '+')}<br>
      <span>Decel</span><br>${settlementLines(settlementReport.decel, '-')}<br>
      순 ${settlementReport.net.toFixed(1)} → 속도 ${settlementReport.newSpeed.toFixed(1)}
    </div>` : ''}

    <div class="row">
      <label>${scenario.hills ? `언덕 우회 ${hillPasses.length}/${scenario.hills.length} · 교대 방향 · 출발점 복귀` : `웨이포인트 ${wpIndex}/${scenario.waypoints.length}`} · 기준 ${scenario.parTurns}턴</label>
      ${done ? `<div class="ok">완료 — ${state.turnNumber}턴 (기준 ${scenario.parTurns}턴), 위반 ${violations.length}건</div>` : ''}
    </div>

    <div class="row"><label>판정</label><div class="ok">${violations.length ? '우측 경고 팝업에서 위반 내용을 확인하세요.' : '규칙 위반 없음'}</div></div>

    <div class="row">
      <label>디버그 로그 (${debugLog.length}건)</label>
      <div class="debug-log">${debugLogHtml()}</div>
      <div class="debug-actions">
        <button id="log-copy">클립보드 복사</button>
        <button id="log-download">파일 저장</button>
        <button id="log-clear">비우기</button>
      </div>
    </div>
  `;

  panel.querySelector('#new').onclick = () => newScenario(+panel.querySelector('#lesson').value);
  panel.querySelector('#scenario-mode').onchange = e => { scenarioMode = e.target.value; newScenario(+panel.querySelector('#lesson').value); };
  // 지정 시나리오에서는 항공기·시나리오 유형 셀렉트가 렌더되지 않는다.
  const aircraftSelect = panel.querySelector('#aircraft');
  if (aircraftSelect) aircraftSelect.onchange = e => { aircraftId = e.target.value; newScenario(+panel.querySelector('#lesson').value); };
  panel.querySelector('#lesson').onchange = e => newScenario(+e.target.value);
  const profileSelect = panel.querySelector('#profile');
  if (profileSelect) profileSelect.onchange = e => { profile = e.target.value; newScenario(+panel.querySelector('#lesson').value); };
  panel.querySelector('#advanced').onchange = e => { scope = e.target.checked ? 'all' : 'basic'; newScenario(+panel.querySelector('#lesson').value); };
  panel.querySelector('#hint').onchange = e => { hintOn = e.target.checked; redraw(); };
  panel.querySelector('#ft').onchange = e => act({
    kind: 'declare',
    flightType: e.target.value,
    power: panel.querySelector('#power').value,
    turn: null,
  });
  panel.querySelector('#power').onchange = e => act({
    kind: 'declare',
    flightType: panel.querySelector('#ft').value,
    power: e.target.value,
    turn: state.turnProgress ? { rate: state.turnProgress.rate, dir: state.turnProgress.dir } : null,
  });
  const accelInput = panel.querySelector('#power-accel');
  if (accelInput) {
    // 드래그 중엔 숫자만 갱신하고, 놓을 때 한 번만 선언한다.
    accelInput.oninput = e => { panel.querySelector('#power-accel-out').textContent = (+e.target.value).toFixed(1); };
    accelInput.onchange = e => act({
      kind: 'declare',
      flightType: panel.querySelector('#ft').value,
      power: panel.querySelector('#power').value,
      powerAccel: +e.target.value,
      turn: state.turnProgress ? { rate: state.turnProgress.rate, dir: state.turnProgress.dir } : null,
    });
  }
  panel.querySelectorAll('.turn-btn').forEach(button => {
    button.onclick = () => {
      const sameTurn = state.turnProgress?.rate === button.dataset.rate
        && state.turnProgress?.dir === button.dataset.dir;
      act({
        kind: 'declare',
        flightType: panel.querySelector('#ft').value,
        power: panel.querySelector('#power').value,
        turn: sameTurn ? null : { rate: button.dataset.rate, dir: button.dataset.dir },
      });
    };
  });
  panel.querySelector('#hfp').onclick = () => act({ kind: 'hfp' });
  panel.querySelector('#vfp1').onclick = () => act(vfpAction(1));
  panel.querySelector('#vfp2').onclick = () => act(vfpAction(2));
  panel.querySelector('#vfp3').onclick = () => act(vfpAction(3));
  panel.querySelector('#undo').onclick = undo;
  panel.querySelectorAll('.flight-btn').forEach(button => {
    button.onclick = () => selectAircraft(+button.dataset.jet);
  });
  const targetSelect = panel.querySelector('#target-select');
  if (targetSelect) targetSelect.onchange = e => {
    targetIndex = +e.target.value;
    combatTarget = opponents[targetIndex] ?? null;
    combatResult = null;
    pendingDamage = null;
    redraw();
  };
  const fireFull = panel.querySelector('#fire-full');
  const fireSnap = panel.querySelector('#fire-snap');
  if (fireFull) fireFull.onclick = () => fireGun(false);
  if (fireSnap) fireSnap.onclick = () => fireGun(true);
  const next = panel.querySelector('#next');
  if (next) next.onclick = nextTurn;

  panel.querySelector('#log-copy').onclick = async event => {
    await navigator.clipboard.writeText(debugLogText());
    event.target.textContent = '복사됨';
    setTimeout(() => { event.target.textContent = '클립보드 복사'; }, 1200);
  };
  panel.querySelector('#log-download').onclick = () => {
    const url = URL.createObjectURL(new Blob([debugLogText()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `airpower-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  panel.querySelector('#log-clear').onclick = () => { debugLog = []; redraw(); };
}

newScenario(1);
