import { generate } from '../engine/generate.js';
import { loadScenario } from '../data/scenarios.js';
import { createState, beginTurn, applyAction, endTurn } from '../engine/state.js?v=power-slider-1';
import { validate } from '../engine/validate.js?v=power-slider-1';
import { settle, gradeSettlement } from '../rules/energy.js';
import { AIRCRAFT, bandOf, accelRange, clampAccel } from '../data/aircraft.js';
import { turnCost } from '../data/turnchart.js';
import { distance, hexOfBoardHex, neighbor, boardHexOf, scenarioMapCells, isOnScenarioMap, exitEdgeOf } from '../engine/hex.js?v=map-exit-2';
import { hexCenter, renderMap, drawAircraft, drawHills, drawMarkers, drawGroundUnits, drawStart, drawWaypoints, drawPath, drawOpponentTrails, clearLayer } from './hexmap.js?v=briefing-hud-1';
import { canFire, resolveShot } from '../rules/gunnery.js';
import { applyDamage, rollDamage } from '../rules/damage.js';
import { gunOf } from '../data/weapons.js';
import { moveSolitaireOpponent } from '../engine/solitaire.js';
import { moveSpohRandomOpponent } from '../engine/spoh-random.js';
import { orderOfFlight, CATEGORY_LABEL } from '../engine/order-of-flight.js';
import { angleOff, rearArcOf } from '../engine/geometry.js';
import { resolveVisualSighting } from '../engine/sighting.js';
import { T5_STORES, canAttackGround, resolveAaa, resolveGroundAttack, vcAssault } from '../rules/ground-combat.js';
import { ARM_PROFILE, T6_STORES, canLaunchArm, passdown, radarReactivate, radarShutdown, resolveArm, samLockOn, samShot } from '../rules/sam-arm.js';

const HEX_SIZE = 34;
const svg = document.getElementById('svg');
const panel = document.getElementById('panel');
const aircraftHud = document.getElementById('aircraft-hud');
const violationPopup = document.getElementById('violation-popup');
const completionPopup = document.getElementById('completion-popup');
const briefingPopup = document.getElementById('briefing-popup');
const missionButton = document.getElementById('mission-button');

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
let t4Missiles = null;
let t4RadarLock = null;
let pendingDamage = null;
let trainingTurns = [];
let trainingEvents = [];
let trainingResult = null;
let t3ExitResult = null;
let sightedTargets = new Set();
let groundUnits = [];
let groundTargetIndex = 0;
let t5Stores = null;
let groundResult = null;
// T-6: 폭격기 그룹, ARM 발사 횟수, SAM 상호작용 로그.
let bombers = [];
let bomberScore = 0;
let armAttacksUsed = 0;
let samAlert = false;
let neutrals = [];
let markers = [];
let alertsCollapsed = false;

const BRIEFINGS = {
  'as-t1-recon-run': {
    story: '정찰 비행 훈련입니다. 지형 장애물을 피해 지정 비행 경로를 정확히 통과하며, 저고도 기동의 기본 감각을 익힙니다.',
    focus: ['언덕 중심을 통과하지 않고 인접 헥스로 우회합니다.', '언덕마다 직전과 반대 방향으로 돌아야 합니다.', '출발점으로 복귀해 훈련을 완료합니다.'],
  },
  'as-t2-check-ride': {
    story: '비행 검정 코스입니다. 여러 고도에 놓인 웨이포인트를 제한 턴 안에 통과하며, 상승·하강과 에너지 정산 능력을 점검합니다.',
    focus: ['웨이포인트의 요구 고도에 맞춰 순서대로 통과합니다.', '상승과 하강의 VFP 제약을 지킵니다.', '기준 8턴 안에 코스를 마칩니다.'],
  },
  'as-s1-border-clash': {
    story: '국경 인근에서 단독 MiG-21과 조우했습니다. 짧은 교전 시간 안에 적기를 격추해 국경을 지켜야 합니다.',
    focus: ['MiG-21의 회피 기동을 추적해 사격 위치를 만듭니다.', '6턴 종료 전 격추를 노립니다.', '적기의 맵 이탈을 허용하지 않습니다.'],
  },
  'as-s2-prelude-to-war': {
    story: '전쟁 직전의 긴장 속에서 JA-37 두 대가 접근하는 Su-17 편대를 저지합니다. 적기는 공격보다 이탈을 우선할 수 있습니다.',
    focus: ['아군 두 기체의 비행 순서와 사격 기회를 조율합니다.', 'Su-17이 맵을 탈출하기 전에 파괴합니다.', '적기의 비회피·회피 기동 전환을 관찰합니다.'],
  },
  'as-s3-wrath-of-islam': {
    story: 'MiG-31로 다수의 F-4E를 요격합니다. 적기는 남쪽 가장자리로 이탈하려 하며, 넓은 전장과 다양한 고도에서 우위를 만들어야 합니다.',
    focus: ['F-4E 네 대의 이탈 경로를 차단합니다.', '장거리 요격 뒤 유리한 편각과 고도차를 유지합니다.', '적기의 남쪽 맵 이탈 전에 격추합니다.'],
  },
  'spoh-t1-flight-school': {
    story: '텍사스 랜돌프 공군 기지의 새 제트기 전환 교육 과정에 들어온 젊은 공군 소위입니다. T-33 평가 비행에서 기본 기동을 정확히 해내야 다음 단계로 갈 수 있습니다.',
    focus: ['파일런 두 곳을 반대 방향으로 돌아 8자 기동을 완성합니다.', '2405에서 속도 3.0·NNW로 랑데부합니다.', '15턴 안에 끝내고 불필요한 Idle·급선회를 줄입니다.'],
  },
  'spoh-t2-gunnery-pattern': {
    story: 'T-33 평가를 통과한 뒤 에드워즈 공군 기지의 고급 훈련에 배정되었습니다. 일본 미사와의 F-86 비행대에 합류하기 전, 예인 배너를 안전하게 공격하는 F-84 사격 패턴을 익혀야 합니다.',
    focus: ['배너를 향한 사격 경로를 두 번 만듭니다.', '예인기를 피하고, 매 사격 뒤 퍼치(5809·고도 15)로 복귀합니다.', '10턴 이내에 패턴을 마무리합니다.'],
  },
  'spoh-t3-first-dogfight': {
    story: '일본의 F-86 부대에서 전환 훈련을 마친 직후 한국 전쟁이 격화되었습니다. 미그 앨리에서 두 명의 미숙한 중국군 MiG 조종사 뒤를 잡았지만, 편대장은 보이지 않고 연료도 넉넉하지 않습니다.',
    focus: ['MiG-15 한 대 이상을 실제로 격추합니다.', 'MiG의 무작위 기동과 기총 사격 기회를 경계합니다.', '격추 뒤 이탈을 선언해 귀환 연료 판정을 통과합니다.'],
  },
  'spoh-t4-missile-age': {
    story: '한국 전쟁 베테랑인 당신은 캘리포니아의 새 F-102A 델타 대거 요격 비행대에서 대위가 되었습니다. 공군 최초의 초음속 델타익 요격기와 팰컨 유도탄 전술을 실사격 시험으로 평가할 차례입니다.',
    focus: ['TU-95 표적 드론 3대가 목표에 폭탄을 투하하기 전에 파괴합니다.', 'AIM-4A는 레이더 락온, AIM-4B는 후방 적외선 사거리 조건을 맞춥니다.', '드론 #3의 채프·플레어와 후방 포탑을 고려해 두 F-102를 보존합니다.'],
  },
  'spoh-t5-palm-gate': {
    story: '제1항공특공대대에 자원한 당신은 베트남에서 포위된 미 육군 그린베레 전초기지를 지원합니다. 프로펠러 스카이레이더 두 대로 VC 보병과 AAA를 상대하는 첫 지상공격 임무입니다.',
    focus: ['그린베레 전초기지를 보존하고 VC 보병의 공격을 저지합니다.', '기총·주니 로켓·HE 폭탄·네이팜을 사거리와 조준 조건에 맞춰 사용합니다.', 'AAA 사거리와 6·12턴 VC 공격 전에 위협 지상군을 억제하거나 파괴합니다.'],
  },
  'spoh-t6-wild-weasel': {
    story: '1967년 북베트남. F-105G 와일드 위즐 2기로 SA-2 방공망에 먼저 뛰어들어 레이더를 침묵시키고, 게임-턴 4에 진입하는 F-105D 폭격기 4대가 북쪽으로 빠져나갈 길을 열어야 합니다.',
    focus: [
      'Rule 25: SA-2는 QRC 미탑재라 두 번째 락온 기회에만 사격합니다. TFF로 20헥스 밖을 저공 통과하면 MTI 없는 레이더에는 잡히지 않습니다.',
      'Rule 26: 슈라이크(14헥스)/스탠더드 ARM(24헥스)은 수평·하강 직선 비행에서만, 턴당 2발까지 발사합니다. 표적 레이더가 켜져 있어야 유도됩니다.',
      'Rule 26.4 TGL: 짝수 명중 + D 이상이면 레이더가 영구 파괴됩니다. 포대는 1d10≤6으로 긴급 셧다운/재가동을 시도합니다.',
      '북쪽 가장자리로 탈출한 F-105D 1대당 10점. 다른 가장자리로 나가면 격추로 간주합니다.',
    ],
  },
};

// Speed of Heat T-2 원문 해법의 게임-턴 종료 배너 위치표.
const T2_BANNER_POSITIONS = ['5506', '5604', '5902', '6202', '6503', '6705', '6708', '6611'];

function hexSize() {
  return scenario?.hexSize ?? HEX_SIZE;
}

function hillHex(hill) {
  return hexOfBoardHex(hill.boardHex);
}

function scenarioView() {
  const size = hexSize();
  const points = [scenario.start.hex, ...scenario.waypoints.map(w => w.hex), ...(scenario.hills ?? []).map(hillHex)]
    .map(hex => hexCenter(hex, size));
  const padding = size * 4;
  const minX = Math.min(...points.map(point => point.x)) - padding;
  const maxX = Math.max(...points.map(point => point.x)) + padding;
  const minY = Math.min(...points.map(point => point.y)) - padding;
  const maxY = Math.max(...points.map(point => point.y)) + padding;
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, size * 10),
    height: Math.max(maxY - minY, size * 10),
  };
}

function newScenario(lesson = scenario?.lesson ?? 1) {
  seed += 1;
  if (scenarioMode !== 'random') {
    scenario = loadScenario(scenarioMode, { scope });
    if (scenario.freeAircraft && AIRCRAFT[aircraftId]?.spoh) {
      scenario = { ...scenario, aircraft: aircraftId };
    }
  } else {
    const actualLesson = profile === 'altitude-cycle' ? Math.max(2, lesson) : lesson;
    scenario = generate({ lesson: actualLesson, aircraftId, seed, turns: 4, profile, scope });
  }
  const initialVelocity = AIRCRAFT[scenario.aircraft].velocity[bandOf(scenario.start.alt)];
  const initialSpeed = initialVelocity
    ? Math.min(initialVelocity.max, Math.max(initialVelocity.min, scenario.start.speed))
    : scenario.start.speed;
  state = beginTurn(createState({ aircraftId: scenario.aircraft, ...scenario.start, speed: initialSpeed, advancedRules: scope === 'all' }));
  state = { ...state, ammo: gunOf(state.aircraftId)?.ammo ?? null };
  // 셋업 직후의 상대 선공(opponentsFirst)도 기록해야 하므로 로그를 먼저 비운다.
  debugLog = [];
  notices = [];
  // T-4의 3발씩은 편대 전체가 아니라 각 F-102의 내부 무기창 적재량이다.
  t4Missiles = scenario.t4 ? [{ aim4a: 3, aim4b: 3 }, { aim4a: 3, aim4b: 3 }] : null;
  t4RadarLock = null;
  sightedTargets = new Set();
  groundUnits = scenario.groundUnits?.map(unit => ({ ...unit, hex: { ...unit.hex }, hits: 0, suppressed: false, killed: false })) ?? [];
  neutrals = scenario.neutrals?.map(unit => ({ ...unit, hex: { ...unit.hex } })) ?? [];
  markers = scenario.markers?.map(marker => ({ ...marker, hex: { ...marker.hex } })) ?? [];
  groundTargetIndex = 0;
  const storeTemplate = scenario.t6 ? T6_STORES : T5_STORES;
  t5Stores = scenario.t5 ? [{ ...storeTemplate }, ...(scenario.friendlies ?? []).map(() => ({ ...storeTemplate }))] : null;
  groundResult = null;
  bombers = [];
  bomberScore = 0;
  armAttacksUsed = 0;
  samAlert = false;
  opponentTrails = [];
  if (scenario.solitaire) {
    setupOpponents();
    if (scenario.opponentsFirst) moveOpponents({ advanceTurn: false });
    refreshVisualSighting();
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
  trainingTurns = [];
  trainingEvents = [];
  trainingResult = null;
  t3ExitResult = null;
  // 새 시나리오는 시작점과 모든 체크포인트를 즉시 볼 수 있는 시야로 연다.
  mapView = scenario.mapCells || scenario.maps ? null : scenarioView();
  moveT2Tug();
  showBriefing();
  redraw();
}

function showBriefing() {
  const briefing = BRIEFINGS[scenario.id];
  if (!briefing) { briefingPopup.hidden = true; return; }
  briefingPopup.querySelector('h2').textContent = scenario.title;
  briefingPopup.querySelector('p').innerHTML = `<b>배경</b><br>${briefing.story}<br><br><b>이번 시나리오 중점</b><br>${briefing.focus.map(item => `• ${item}`).join('<br>')}`;
  briefingPopup.hidden = false;
}

document.getElementById('briefing-close').onclick = () => { briefingPopup.hidden = true; };
missionButton.onclick = () => showMissionBriefing();

function showMissionBriefing() {
  const briefing = BRIEFINGS[scenario.id];
  const objective = scenario.victory ?? (scenario.hills ? '모든 언덕을 규정 방향으로 우회하고 출발점으로 복귀하십시오.' : scenario.waypoints?.length ? '모든 웨이포인트를 통과하십시오.' : '지정된 훈련 목표를 달성하십시오.');
  briefingPopup.querySelector('h2').textContent = `${scenario.title} · 임무 개요`;
  briefingPopup.querySelector('p').innerHTML = `<b>목적</b><br>${briefing?.story ?? scenario.source ?? '훈련 임무'}<br><br><b>승리 조건</b><br>${objective}<br><br><b>제한</b><br>${scenario.maxTurns ? `${scenario.maxTurns}턴 이내` : scenario.parTurns ? `기준 ${scenario.parTurns}턴` : '별도 턴 제한 없음'}${briefing?.focus?.length ? `<br><br><b>중점 사항</b><br>${briefing.focus.map(item => `• ${item}`).join('<br>')}` : ''}`;
  briefingPopup.hidden = false;
}

// ── ADC 모달 ────────────────────────────────────────────────────────────
// SPOH 기체는 ADC 카드에서 생성된다(data/spoh-aircraft.js). 그래서 카드 경로가
// AIRCRAFT[id].source에 'spoh_adc/파일.json'으로 이미 실려 있다. 손으로 표를
// 만들면 T-4의 F-102A·Tu-95M처럼 빠뜨리는 기체가 생기므로 source에서 읽는다.
//
// AS(Air Superiority) 계열은 source가 없다. 대신 이미지 기반 ADC(../adc/)에
// 전용 카드가 전부 있으므로 그쪽을 쓴다. 데이터 ADC로 대체하는 것보다 정확하다
// (F-19A·MIG-21MF·F-15C는 데이터 ADC에 아예 없거나 근사치뿐이다).
const ADC_AS_PAGE = {
  'F-4F': 'page-01-f4-f-phantom-ii',
  'F-4E': 'page-02-f4-e-phantom-ii',
  'JA-37': 'page-16-saab-ja37-viggen',
  'SU-17': 'page-28-su-17-22-fitter-hj',
  'MIG-31': 'page-24-mig-31-foxhound-a',
  'MIG-29': 'page-23-mig-29-fulcrum-a',
  'MIG-21MF': 'page-25-mig-21mf-fishbed-j',
  'F-14A': 'page-07-f14a-tomcat',
  'F-14D': 'page-08-f14d-tomcat',
  'F-15C': 'page-10-f15c-eagle',
  'F-19A': 'page-14-f19a-stealth-fighter',
};

/**
 * 기체 ID -> 모달에 띄울 ADC.
 * { url, approx } 형태이고 url이 없으면 표시할 카드가 없는 기체다.
 */
function adcCardOf(id) {
  const src = AIRCRAFT[id]?.source ?? '';
  // 'spoh_adc/F-102A_Delta_Dagger_ADC.json' 또는 뒤에 ' (F-84E 대체)'가 붙는다.
  const m = src.match(/spoh_adc\/(.+?)\.json/);
  if (m) {
    // 대체 카드는 source에 그렇게 적혀 있다. 그 사실을 그대로 알린다.
    const sub = src.match(/\(([^)]*대체)\)/);
    return {
      url: `../adc-data.html?embed=1#${m[1]}`,
      approx: sub ? m[1].replace(/_ADC(_v2)?$/, '').replace(/_/g, ' ') : null,
    };
  }
  const page = ADC_AS_PAGE[id];
  return page ? { url: `../adc/${page}.html`, approx: null } : { url: null, approx: null };
}

const adcButton = document.getElementById('adc-button');
const adcPopup = document.getElementById('adc-popup');
const adcTabs = document.getElementById('adc-tabs');
const adcFrame = document.getElementById('adc-frame');
const adcNote = document.getElementById('adc-note');

/** 현재 시나리오에 등장하는 기체를 역할과 함께 중복 없이 모은다. */
function scenarioAircraft() {
  if (!scenario) return [];
  const seen = new Map();
  const add = (id, role) => {
    if (!id || seen.has(id)) return;
    seen.set(id, { id, role, title: AIRCRAFT[id]?.title ?? id });
  };
  add(scenario.aircraft, '자기');
  for (const f of scenario.friendlies ?? []) add(f.aircraft, '아군');
  for (const o of scenario.opponents ?? []) add(o.aircraft, '적기');
  return [...seen.values()];
}

function showAdc(id) {
  const { url, approx } = adcCardOf(id);
  [...adcTabs.children].forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === id)));

  if (!url) {
    // ADC가 없는 기체는 빈 화면 대신 이유를 밝힌다.
    adcFrame.removeAttribute('src');
    adcFrame.srcdoc = '<body style="margin:0;display:grid;place-items:center;height:100vh;'
      + 'font:14px system-ui;color:#666;background:#fff">이 기체의 ADC 데이터가 없습니다.</body>';
    adcNote.hidden = true;
    return;
  }
  adcFrame.removeAttribute('srcdoc');
  // 데이터 ADC는 embed=1로 목록을 접고 #hash로 해당 기체만 펼친다.
  // AS 이미지 ADC는 페이지 하나가 곧 기체라 주소만 넣으면 된다.
  adcFrame.src = url;

  adcNote.hidden = !approx;
  if (approx) adcNote.textContent =
    `주의: 이 기체의 전용 ADC가 없어 ${approx} 카드를 대신 표시합니다. 수치가 다를 수 있습니다.`;
}

function openAdc() {
  const list = scenarioAircraft();
  adcTabs.replaceChildren();
  for (const { id, role, title } of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    b.setAttribute('role', 'tab');
    b.innerHTML = `${title}<span class="adc-role">${role}</span>`;
    b.onclick = () => showAdc(id);
    adcTabs.appendChild(b);
  }
  adcPopup.hidden = false;
  if (list.length) showAdc(list[0].id);
}

adcButton.onclick = () => (adcPopup.hidden ? openAdc() : (adcPopup.hidden = true));
document.getElementById('adc-close').onclick = () => { adcPopup.hidden = true; };
// 바깥을 눌러도 닫힌다. 카드 안쪽 클릭은 통과시키지 않는다.
adcPopup.onclick = e => { if (e.target === adcPopup) adcPopup.hidden = true; };
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !adcPopup.hidden) adcPopup.hidden = true;
});

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
    ...beginTurn(createState({ ...unit, aircraftId: unit.aircraft, advancedRules: scope === 'all' })), map: unit.map, boardHex: unit.boardHex,
    configuration: unit.configuration, load: unit.load,
    ammo: gunOf(unit.aircraft)?.ammo ?? null,
  }))];
  activeIndex = 0;
  flightPaths = flight.map(jet => [{ kind: 'center', hex: { ...jet.hex } }]);
  flightShots = flight.map(() => []);
  flightDone = [];
  opponents = (scenario.opponents ?? []).map(unit => ({
    ...beginTurn(createState({ ...unit, aircraftId: unit.aircraft, advancedRules: scope === 'all' })),
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

/** Rule 11.1: 포착 성공은 편대가 공유하고 다음 턴부터 패드락으로 유지한다. */
function refreshVisualSighting() {
  if (!scenario.solitaire) return;
  opponents.forEach((opponent, index) => {
    if (opponent.damage === 'K' || sightedTargets.has(index)) return;
    const observer = flight.find(jet => jet.damage !== 'K');
    if (!observer) return;
    const result = resolveVisualSighting(observer, opponent, { roll: 1 + Math.floor(Math.random() * 10) });
    if (!result.sighted) return;
    sightedTargets.add(index);
    notices.push({ kind: 'info', turn: state.turnNumber, msg: `${AIRCRAFT[opponent.aircraftId]?.title ?? opponent.aircraftId}(상대 ${index + 1}) 시각 포착 성공 (주사위 ${result.roll}).` });
  });
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
    const die = 1 + Math.floor(Math.random() * 10);
    const result = opponent.movementMode === 't4-straight'
      ? { state: Array.from({ length: opponent.damage && opponent.damage !== 'none' ? 3 : 4 }).reduce(next => applyAction(next, { kind: 'hfp' }), opponent), actions: ['H', 'H', 'H', opponent.damage && opponent.damage !== 'none' ? '' : 'H'] }
      : scenario.opponentMovement === 'spoh-random'
      ? moveSpohRandomOpponent(opponent, { attacker: state, die })
      : moveSolitaireOpponent(opponent, { attacker: state, die, maxClimb: aircraft.climb[bandOf(opponent.alt)] ?? 0 });
    const { state: moved, actions } = result;
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
  resolveT3OpponentShots();
  resolveT4TurretFire();
  retarget();
  checkKills();
  checkMapExit();
  resolveT4Targets();
  refreshT4RadarLock();
}

/** T-2 원문: 예인기는 먼저 3헥스를 전진한 뒤 우측 30도 선회하고 배너는 후방을 따른다. */
function moveT2Tug() {
  if (scenario.training !== 't2') return;
  const index = neutrals.findIndex(unit => unit.label?.startsWith('T-33 예인기'));
  if (index < 0) return;
  const tug = neutrals[index];
  let hex = { ...tug.hex };
  const heading = Math.round(tug.facing / 2) * 2 % 12;
  for (let i = 0; i < 3; i += 1) hex = neighbor(hex, heading);
  const facing = (tug.facing + 1) % 12;
  neutrals[index] = { ...tug, hex, facing };
  const tugMarker = markers.find(marker => marker.kind === 'tug');
  const banner = markers.find(marker => marker.kind === 'banner');
  if (tugMarker) tugMarker.hex = { ...hex };
  if (banner) {
    const boardHex = T2_BANNER_POSITIONS[state.turnNumber - 1];
    // 원문 표가 있는 1~8턴은 표를 우선한다. 이후에는 예인기의 이동 직전 침로 후방을 따른다.
    banner.hex = boardHex ? hexOfBoardHex(boardHex) : neighbor(hex, (heading + 6) % 12);
  }
  notices.push({ kind: 'move', turn: state.turnNumber, msg: `T-33 예인기 이동: ${boardHexOf(tug.hex)} → ${boardHexOf(hex)} · 우측 30도 선회.` });
}

const d10 = () => 1 + Math.floor(Math.random() * 10);

/** 참고 2·3: 게임-턴 4 종료 시 F-105D 4대를 배치하고, 이후 매 턴 북쪽으로 직진시킨다. */
function moveT6Bombers(turn) {
  if (!scenario.bombers) return;
  const spec = scenario.bombers;
  if (turn === spec.entryTurn && !bombers.length) {
    bombers = spec.hexes.map((spot, index) => ({
      id: `bomber${index + 1}`, label: `F-105D #${index + 1}`, aircraftId: spec.aircraft,
      hex: hexOfScenarioMapT6(spot), facing: spec.facing, alt: spec.alt, speed: spec.speed,
      escaped: false, killed: false, evading: false,
    }));
    notices.push({ kind: 'move', turn, msg: `F-105D 폭격기 4대가 진입했습니다 (속도 ${spec.speed}, 고도 ${spec.alt}, 북쪽 직진).` });
    return;
  }
  bombers.forEach(bomber => {
    if (bomber.escaped || bomber.killed) return;
    // 참고 3: SAM 공격을 받는 중에는 무작위 이동, 아니면 북쪽 직진.
    const facing = bomber.evading ? [0, 2, 10][Math.floor(Math.random() * 3)] : 0;
    let hex = { ...bomber.hex };
    for (let step = 0; step < Math.round(bomber.speed); step += 1) hex = neighbor(hex, facing);
    bomber.hex = hex; bomber.facing = facing;
    // 참고 4: 북쪽 가장자리 탈출은 10점, 그 외 가장자리는 격추 처리.
    const edge = t6EdgeOf(hex);
    if (edge === 'north') { bomber.escaped = true; bomberScore += 10; notices.push({ kind: 'ok', turn, msg: `${bomber.label}가 북쪽 가장자리로 무사히 탈출했습니다. +10점.` }); }
    else if (edge) { bomber.killed = true; notices.push({ kind: 'kill', turn, msg: `${bomber.label}가 ${edge} 가장자리로 이탈해 격추 처리됩니다.` }); }
  });
}

function hexOfScenarioMapT6(spot) {
  const cell = scenario.mapCells?.find(item => item.boardHex === spot.boardHex);
  return cell ? { q: cell.q, r: cell.r } : hexOfBoardHex(spot.boardHex);
}

/** 플레이 영역 밖으로 나갔는지와 어느 가장자리인지 판정한다. */
function t6EdgeOf(hex) {
  const cells = scenario.mapCells ?? [];
  if (!cells.length) return null;
  const minQ = Math.min(...cells.map(c => c.q)); const maxQ = Math.max(...cells.map(c => c.q));
  const minR = Math.min(...cells.map(c => c.r)); const maxR = Math.max(...cells.map(c => c.r));
  if (hex.r < minR) return 'north';
  if (hex.r > maxR) return 'south';
  if (hex.q < minQ) return 'west';
  if (hex.q > maxQ) return 'east';
  return null;
}

/**
 * Rule 25.0 SAM 상호작용 단계. 참고 2: SAM은 항상 가장 가까운 시야 내 F-105에 락온한다.
 * 폭격기(F-105D)도 표적이 되며, 피격 대상이 되면 무작위 회피로 전환된다.
 */
function resolveT6SamPhase(turn) {
  if (!scenario.t6 || failed) return;
  // Rule 26.5: 셧다운한 레이더는 이 단계에서 재가동을 시도한다.
  groundUnits = groundUnits.map(unit => {
    const reactivation = unit.radarOff && !unit.killed ? radarReactivate(unit) : null;
    if (reactivation?.success) notices.push({ kind: 'move', turn, msg: `${unit.label} 레이더가 재가동했습니다 (주사위 ${reactivation.roll}).` });
    return reactivation ? reactivation.unit : unit;
  });

  const sams = groundUnits.filter(unit => unit.type === 'sam' && !unit.killed);
  for (const sam of sams) {
    const index = groundUnits.indexOf(sam);
    // 참고 2: 가장 가까운 F-105 (위즐 편대 + 폭격기 그룹) 순으로 표적을 고른다.
    const candidates = [
      ...flight.filter(jet => jet.damage !== 'K').map((jet, i) => ({ kind: 'weasel', jet, i, hex: jet.hex })),
      ...bombers.filter(b => !b.killed && !b.escaped).map(b => ({ kind: 'bomber', bomber: b, hex: b.hex })),
    ].sort((a, b) => distance(sam.hex, a.hex) - distance(sam.hex, b.hex));
    if (!candidates.length) continue;
    const pick = candidates[0];
    const aircraft = pick.kind === 'weasel' ? pick.jet : { ...pick.bomber, tff: false };
    // Rule 25.1: T-6에는 CCU가 없으므로 Passdown 보너스는 성립하지 않는다.
    const pass = passdown(d10(), false);
    // Rule 25.2 QRC: SA-2는 일반 사양이라 두 번째 락온 기회만 사용한다.
    const lock = samLockOn(sam, aircraft, { passdownDrm: pass.drm, opportunity: 2 });
    if (!lock.locked) {
      if (lock.reason && lock.range !== undefined) notices.push({ kind: 'move', turn, msg: `${sam.label} 락온 실패: ${lock.reason}` });
      continue;
    }
    groundUnits[index] = { ...sam, ready: sam.ready - 1 };
    samAlert = true;
    // 참고 3: 미사일이 명중하거나 빗나갈 때까지 폭격기는 무작위로 회피한다.
    if (pick.kind === 'bomber') pick.bomber.evading = true;
    const shot = samShot(sam, aircraft, { tffPenalty: lock.tffPenalty });
    if (!shot.hit) {
      // 참고 3: 빗나가면 회피를 끝내고 최단 방향으로 북쪽에 복귀한다.
      if (pick.kind === 'bomber') { pick.bomber.evading = false; pick.bomber.facing = 0; }
      notices.push({ kind: 'move', turn, msg: `${sam.label} 발사 → ${pick.kind === 'weasel' ? `F-105G #${pick.i + 1}` : pick.bomber.label}: 빗나감 (주사위 ${shot.roll}/목표 ${shot.target}). 폭격기는 북쪽으로 복귀합니다.` });
      continue;
    }
    if (pick.kind === 'bomber') {
      pick.bomber.killed = true;
      notices.push({ kind: 'kill', turn, msg: `${sam.label} 명중 → ${pick.bomber.label} 격추.` });
    } else {
      const damage = rollDamage(shot.rating, d10(), pick.jet, { missile: true }).result;
      flight[pick.i] = applyDamage(pick.jet, damage);
      if (pick.i === activeIndex) state = flight[pick.i];
      notices.push({ kind: 'kill', turn, msg: `${sam.label} 명중 → F-105G #${pick.i + 1} 피해 ${damage}.` });
    }
  }
  if (flight.every(jet => jet.damage === 'K')) failed = '와일드 위즐 편대가 전멸했습니다.';
}

/**
 * 참고 5: 파괴한 VC 유닛 점수에서 잃은 아군 점수를 뺀다. 그린베레는 세 배 가치라
 * 유닛 데이터에 이미 3배(6점)로 들어 있다. 그린베레가 전멸하면 미 공군은 승리할 수
 * 없고, 점수가 앞서야 겨우 무승부가 된다.
 */
function t5Score() {
  const sum = units => units.reduce((total, unit) => total + (unit.points ?? 0), 0);
  const usaf = sum(groundUnits.filter(unit => unit.side === 'vc' && unit.killed));
  const beretLost = groundUnits.some(unit => unit.id === 'gb' && unit.killed);
  const vc = sum(groundUnits.filter(unit => unit.side === 'friendly' && unit.killed));
  const net = usaf - vc;
  const verdict = beretLost
    ? (net > 0 ? '그린베레 전멸 — 최선은 무승부' : '그린베레 전멸 — 패배')
    : net > 0 ? '미 공군 우세' : net < 0 ? '베트콩 우세' : '호각';
  return { usaf, vc, net, verdict, beretLost };
}

function resolveT5GroundPhase(turn) {
  if (!scenario.t5 || failed) return;
  const activeAaa = groundUnits.filter(unit => unit.type === 'aaa' && !unit.killed && !unit.suppressed);
  for (const aaa of activeAaa) {
    const targets = flight.filter(jet => jet.damage !== 'K').sort((a, b) => distance(aaa.hex, a.hex) - distance(aaa.hex, b.hex));
    const target = targets[0];
    if (!target) continue;
    const result = resolveAaa(aaa, target, 1 + Math.floor(Math.random() * 10));
    if (!result) continue;
    if (result.hit) {
      const damage = rollDamage(result.rating, 1 + Math.floor(Math.random() * 10), target).result;
      const index = flight.indexOf(target);
      flight[index] = applyDamage(target, damage);
      if (index === activeIndex) state = flight[index];
      notices.push({ kind: 'kill', turn, msg: `${aaa.label} 조준 사격 명중 (목표 ${result.target}) · A-1 #${index + 1} 피해 ${damage}.` });
    } else notices.push({ kind: 'move', turn, msg: `${aaa.label}가 가장 가까운 A-1에 사격했으나 빗나갔습니다 (주사위 ${result.roll}/목표 ${result.target}).` });
  }
  if ([6, 12].includes(turn)) {
    const greenBeret = groundUnits.find(unit => unit.id === 'gb');
    const assault = vcAssault(groundUnits.filter(unit => unit.side === 'vc' && unit.type === 'infantry'), greenBeret, 1 + Math.floor(Math.random() * 10));
    groundUnits = groundUnits.map(unit => unit.id === 'gb' ? assault.unit : unit);
    notices.push({ kind: assault.unit.killed ? 'kill' : 'move', turn, msg: `VC 전초기지 공격: ${assault.attackers}:1 · DRM +${assault.drm} · ${assault.result}${assault.unit.killed ? ' — 그린베레 전멸.' : ''}` });
    // 참고 5: 전멸해도 점수가 앞서면 무승부까지는 가능하므로 현재 점수를 함께 알린다.
    if (assault.unit.killed) failed = `그린베레 전초기지가 전멸했습니다. 미 공군은 승리할 수 없습니다 (${t5Score().verdict}).`;
  }
  // Suppression lasts the current and following turn; clear only after that turn's ground phase.
  groundUnits = groundUnits.map(unit => unit.suppressed && unit.suppressedTurn < turn - 1 ? { ...unit, suppressed: false } : unit);
}

function checkT5Terrain(previous) {
  if (!scenario.t5 || state.damage === 'K') return;
  const elevation = scenario.terrain?.[boardHexOf(state.hex)] ?? 0;
  if (state.alt <= elevation) {
    state = { ...state, damage: 'K' }; syncActive(); failed = `지형 충돌: ${boardHexOf(state.hex)} 표고 ${elevation} 이하로 비행했습니다.`; return;
  }
  if (!state.tff) return;
  const previousElevation = scenario.terrain?.[boardHexOf(previous)] ?? 0;
  if (Math.abs(elevation - previousElevation) >= 2 || scenario.ridgelines?.includes(boardHexOf(state.hex))) {
    state = { ...state, damage: 'K' }; syncActive(); failed = 'TFF 지형 충돌: 급격한 표고 변화 또는 능선에 진입했습니다.';
  }
}

/** T-4 원문 5번: 드론 후방 90도·2헥스 안에서 턴을 마친 대거에 포탑 사격. */
function resolveT4TurretFire() {
  if (!scenario.t4 || failed) return;
  for (const opponent of opponents) {
    if (opponent.damage === 'K') continue;
    for (let index = 0; index < flight.length; index += 1) {
      const jet = flight[index];
      if (jet.damage === 'K' || distance(opponent.hex, jet.hex) > 2 || rearArcOf(opponent, jet) > 90) continue;
      const roll = 1 + Math.floor(Math.random() * 10);
      if (roll !== 1) {
        notices.push({ kind: 'move', turn: state.turnNumber, msg: `TU-95 후방 포탑이 F-102 #${index + 1}에 사격했으나 빗나갔습니다 (주사위 ${roll}).` });
        continue;
      }
      flight[index] = { ...jet, damage: 'K' };
      if (index === activeIndex) state = flight[index];
      notices.push({ kind: 'kill', turn: state.turnNumber, msg: `TU-95 후방 포탑 명중: F-102 #${index + 1} 제거 (주사위 1).` });
    }
  }
  if (flight.length && flight.every(jet => jet.damage === 'K')) failed = 'F-102 두 대가 모두 드론 방어 사격으로 제거되었습니다 — 임무 실패.';
}

function resolveT4Targets() {
  if (!scenario.t4) return;
  opponents = opponents.map((opponent, index) => {
    if (opponent.damage === 'K' || !opponent.targetHex || !sameHex(opponent.hex, opponent.targetHex)) return opponent;
    failed = `TU-95 드론 ${index + 1}이 ${opponent.targetLabel}에 폭탄을 투하했습니다 — 임무 실패.`;
    notices.push({ kind: 'kill', turn: state.turnNumber, msg: failed });
    return { ...opponent, damage: 'K', bombed: true };
  });
}

function refreshT4RadarLock() {
  if (!scenario.t4 || t4RadarLock === null) return;
  const target = opponents[t4RadarLock];
  const range = target && distance(state.hex, target.hex) + Math.floor(Math.abs(state.alt - target.alt) / 2);
  if (!target || target.damage === 'K' || range > 10) {
    t4RadarLock = null;
    notices.push({ kind: 'info', turn: state.turnNumber, msg: '레이더 락온이 해제되었습니다.' });
  }
}

/** T-3: MiG가 이동 후 합법적인 기총 위치에 있으면 한 번 사격한다. */
function resolveT3OpponentShots() {
  if (!scenario.t3 || state.damage === 'K') return;
  for (const opponent of opponents) {
    if (opponent.damage === 'K' || opponent.escaped) continue;
    if (canFire(opponent, state, { shots: [] }).length) continue;
    const shot = resolveShot(opponent, state, 1 + Math.floor(Math.random() * 10));
    if (!shot.hit) {
      notices.push({ kind: 'move', turn: state.turnNumber, msg: `${AIRCRAFT[opponent.aircraftId].title}의 기총 사격은 빗나갔습니다.` });
      continue;
    }
    const damageRoll = 1 + Math.floor(Math.random() * 10);
    const damage = rollDamage(shot.rating, damageRoll, state).result;
    state = applyDamage(state, damage);
    notices.push({ kind: 'kill', turn: state.turnNumber, msg: `${AIRCRAFT[opponent.aircraftId].title} 기총 명중: 피해 ${damage}` });
    if (state.damage === 'K') {
      failed = 'MiG-15 기총 사격에 격추되었습니다.';
      return;
    }
  }
}

function resolveT3Ambush(endedTurn) {
  if (!scenario.t3 || failed || completed || endedTurn < 6) return;
  const roll = 1 + Math.floor(Math.random() * 10);
  const modifier = -Math.max(0, endedTurn - 6);
  if (roll + modifier > 1) return;
  state = { ...state, damage: 'K' };
  failed = `제3 MiG 기습: 주사위 ${roll}${modifier ? ` ${modifier}` : ''} = ${roll + modifier} — 격추.`;
  notices.push({ kind: 'kill', turn: endedTurn, msg: failed });
}

function declareT3Exit() {
  if (!scenario.t3 || t3ExitResult || failed || completed) return;
  const endedTurns = debugLog.filter(entry => entry.action.startsWith('턴 종료')).length;
  if (!endedTurns || state.fpSpent.length) {
    notices.push({ kind: 'move', turn: state.turnNumber, msg: '이탈은 게임 턴 종료 직후에만 선언할 수 있습니다.' });
    redraw();
    return;
  }
  const destroyed = opponents.filter(opponent => opponent.damage === 'K' && !opponent.escaped).length;
  if (!destroyed) {
    failed = 'MiG-15를 한 대도 파괴하지 않고 이탈했습니다 — 임무 실패.';
    redraw();
    return;
  }
  const modifier = -Math.max(0, state.turnNumber - 6);
  const roll = 1 + Math.floor(Math.random() * 10);
  if (roll + modifier <= 1) {
    state = { ...state, damage: 'K' };
    failed = `귀환 연료 판정: 주사위 ${roll}${modifier ? ` ${modifier}` : ''} = ${roll + modifier} — flame-out.`;
    redraw();
    return;
  }
  t3ExitResult = `MiG-15 ${destroyed}대 파괴 후 이탈 성공. 귀환 연료 판정 ${roll}${modifier ? ` ${modifier}` : ''} = ${roll + modifier}.`;
  completed = true;
  redraw();
}

/**
 * 맵 밖으로 나간 기체를 처리한다.
 * ponytail: 원문 룰셋에 맵 가장자리 규정이 없어 기본은 "이탈 = 격추"다.
 * escapeEdge가 있는 시나리오(S-3)는 그 방향으로 나간 상대기만 탈출 성공으로 본다.
 */
function checkMapExit() {
  const maps = scenario.maps;
  const hasCells = !!scenario.mapCells?.length;
  if (!maps?.length && !hasCells) return;
  const isOnMap = hex => maps?.length
    ? isOnScenarioMap(hex, maps)
    : scenario.mapCells.some(cell => cell.q === hex.q && cell.r === hex.r);

  const playerJets = flight.length ? flight : [state];
  playerJets.forEach((jet, index) => {
    if (jet.damage === 'K' || isOnMap(jet.hex)) return;
    if (flight.length) flight[index] = { ...jet, damage: 'K' };
    if (!flight.length || index === activeIndex) state = { ...jet, damage: 'K' };
    const label = AIRCRAFT[jet.aircraftId]?.title ?? jet.aircraftId;
    failed = `${label}(아군 ${index + 1})이 맵을 벗어났습니다 (${boardHexOf(jet.hex)}) — 격추 처리.`;
    logExit(`맵 이탈 — ${label}`, jet, failed);
  });

  opponents = opponents.map((opponent, index) => {
    if (opponent.damage === 'K') return opponent;
    const edge = maps?.length ? exitEdgeOf(opponent.hex, maps) : (isOnMap(opponent.hex) ? null : 'outside');
    if (!edge) return opponent;
    const label = AIRCRAFT[opponent.aircraftId]?.title ?? opponent.aircraftId;
    // 지정된 탈출 가장자리로 나가야 상대의 목표 달성이다. 다른 방향은 이탈 = 격추.
    const escaped = scenario.escapeEdge ? edge === scenario.escapeEdge : !!scenario.exitIsEscape;
    const edgeLabel = EDGE_NAMES[edge] ?? '맵 외부';
    const msg = escaped
      ? `${label}(상대 ${index + 1})이 ${edgeLabel}로 탈출했습니다 (${boardHexOf(opponent.hex)}).`
      : `${label}(상대 ${index + 1})이 ${edgeLabel}를 벗어났습니다 (${boardHexOf(opponent.hex)}) — 격추 처리.`;
    if (escaped && scenario.opponentExitIsFailure !== false) failed = msg;
    logExit(`맵 이탈 — ${label}`, opponent, msg);
    return { ...opponent, damage: 'K', killLogged: true, escaped };
  });

  retarget();
  if (scenario.completeOnKills !== false && opponents.length && (scenario.requiredKills
    ? opponents.filter(o => o.damage === 'K').length >= scenario.requiredKills
    : opponents.every(o => o.damage === 'K')) && !failed) completed = true;
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
    if (opponent.damage !== 'K' || opponent.killLogged || opponent.escaped) return;
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
  if (scenario.completeOnKills !== false && opponents.length && (scenario.requiredKills
    ? opponents.filter(o => o.damage === 'K').length >= scenario.requiredKills
    : opponents.every(o => o.damage === 'K'))) completed = true;
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
  const size = hexSize();
  const map = renderMap(svg, { radius: 24, hexSize: size, cells: scenario.mapCells ?? null, backgrounds: scenario.mapBackgrounds ?? [] });
  if (!mapView) mapView = map.viewBox;
  applyMapView();
  drawWaypoints(svg, scenario.waypoints, size, wpIndex);
  drawMarkers(svg, markers, size);
  if (groundUnits.length) drawGroundUnits(svg, groundUnits, size);
  else clearLayer(svg, 'ground');
  // 우회 순서는 자유이므로 통과 표시는 인덱스가 아니라 언덕 번호로 맞춘다.
  drawHills(svg, (scenario.hills ?? []).map(hill => ({ hex: hillHex(hill), label: hill.boardHex })), size,
    (scenario.hills ?? []).map(hill => hillPasses.some(pass => pass.label === hill.boardHex)));
  if (scenario.hills) drawStart(svg, scenario.start.hex, size, 'START 1223');
  drawPath(svg, path, size);
  drawOpponentTrails(svg, opponentTrails, size);
  // 활성기를 뺀 나머지 편대원. 활성기는 아래에서 따로 그린다.
  const wingmen = flight.map((jet, index) => ({ jet, index })).filter(w => w.index !== activeIndex);
  if (wingmen.length) wingmen.forEach(({ jet, index }, drawn) => drawAircraft(svg, jet.position, jet.facing, size, jet.aircraftId, { layerName: 'friendly', marker: `아군 ${index + 1}${flightDone.includes(index) ? ' ✓' : ''}`, status: aircraftStatus(jet), clear: drawn === 0, tooltip: aircraftTooltip(jet) }));
  else clearLayer(svg, 'friendly');
  if (opponents.length) opponents.forEach((opponent, index) => drawAircraft(svg, opponent.position, opponent.facing, size, opponent.aircraftId, { layerName: 'target', marker: `OPPONENT ${index + 1}`, status: aircraftStatus(opponent), clear: index === 0, tooltip: aircraftTooltip(opponent) }));
  else clearLayer(svg, 'target');
  // T-6 폭격기 그룹도 플레이어가 조작하지 않으므로 중립 레이어를 함께 쓴다.
  const neutralDraw = [
    ...neutrals,
    ...bombers.filter(b => !b.killed && !b.escaped).map(b => ({ hex: b.hex, facing: b.facing, aircraftId: b.aircraftId, label: b.label, alt: b.alt, speed: b.speed })),
  ];
  if (neutralDraw.length) neutralDraw.forEach((unit, index) => drawAircraft(svg, { kind: 'center', hex: unit.hex }, unit.facing, size, unit.aircraftId, { layerName: 'neutral', marker: unit.label, clear: index === 0, tooltip: `${AIRCRAFT[unit.aircraftId]?.title ?? unit.aircraftId}\n중립 기체 · ${unit.label}${unit.alt ? `\n고도 ${unit.alt} · 속도 ${unit.speed.toFixed(1)}` : ''}` }));
  else clearLayer(svg, 'neutral');
  drawAircraft(svg, state.position, state.facing, size, state.aircraftId, { status: aircraftStatus(state), tooltip: aircraftTooltip(state) });
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

function aircraftStatus(jet) {
  return `고 ${jet.alt} · 속 ${jet.speed.toFixed(1)} · ${jet.lastVertical ?? '수평'}`;
}

function renderAircraftHud() {
  const aircraft = AIRCRAFT[state.aircraftId];
  const facing = ['N', 'NNE', 'NE', 'ENE', 'SE', 'ESE', 'S', 'SSW', 'SW', 'WSW', 'NW', 'WNW'][state.facing];
  aircraftHud.innerHTML = `
    <div class="hud-title">${aircraft.title}</div>
    <div class="hud-stats">속도 <b>${state.speed.toFixed(1)}</b> · 고도 <b>${state.alt}</b> · 기수 <b>${facing}</b></div>
    <div class="hud-stats">${state.flightType}${state.tff ? ' · TFF' : ''} · FP <b>${state.fpSpent.length}/${state.fpBudget}</b> · 턴 <b>${state.turnNumber}</b></div>
    ${combatTarget ? `<div class="hud-stats">표적 ${AIRCRAFT[combatTarget.aircraftId].title} · 피해 <b>${combatTarget.damage ?? 'none'}</b></div>` : ''}`;
}

document.getElementById('zoom-in').onclick = () => zoomMap(0.75);
document.getElementById('zoom-out').onclick = () => zoomMap(1 / 0.75);
document.getElementById('zoom-reset').onclick = () => {
  mapView = renderMap(svg, { radius: 24, hexSize: hexSize(), cells: scenario.mapCells ?? (scenario.maps ? scenarioMapCells(scenario.maps) : null), backgrounds: scenario.mapBackgrounds ?? [] }).viewBox;
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
  if (action.kind === 'slide') return `Slide ${action.dir === 'L' ? '좌' : '우'}`;
  if (action.kind === 'roll') return `${action.type === 'lag' ? 'Lag' : 'Displacement'} Roll ${action.dir === 'L' ? '좌' : '우'}`;
  if (action.kind === 'vr') return `Vertical Roll → ${FACING_NAMES[action.facing]}`;
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
  history.push({ state, path: [...path], wpIndex, hillPasses: [...hillPasses], violations: [...violations], completed, failed, debugLog: [...debugLog], notices: [...notices], opponentTrails: opponentTrails.map(t => [...t]), combatTarget, targetIndex, opponents, gunShots: [...gunShots], combatResult, pendingDamage, flight: [...flight], activeIndex, flightPaths: flightPaths.map(p => [...p]), flightShots: flightShots.map(s => [...s]), flightOrder, trainingTurns: trainingTurns.map(turn => ({ ...turn })), trainingEvents: [...trainingEvents], trainingResult, groundUnits: groundUnits.map(unit => ({ ...unit, hex: { ...unit.hex } })), groundTargetIndex, t5Stores: t5Stores?.map(stores => ({ ...stores })), groundResult, bombers: bombers.map(b => ({ ...b, hex: { ...b.hex } })), bomberScore, armAttacksUsed, samAlert });
  settlementReport = null;
  const found = validate(state, action, { activeRules: scenario.activeRules, lesson: scenario.lesson });
  // 선회율/비행 타입 선언은 같은 턴에 바꿔 선택할 수 있다. 새 선언은 이전 선언의
  // 경고를 해소하므로, 해당 턴의 선언 경고만 새 판정으로 교체한다.
  const retained = action.kind === 'declare'
    ? violations.filter(v => !(v.turn === state.turnNumber && v.actionKind === 'declare'))
    : violations;
  violations = [...retained, ...found.map(v => ({ ...v, turn: state.turnNumber, actionKind: action.kind }))];
  state = applyAction(state, action);
  recordTrainingAction(action, before);
  hillTrace = null;
  if (action.kind === 'hfp') {
    path.push(state.position.kind === 'side'
      ? JSON.parse(JSON.stringify(state.position))
      : { kind: 'center', hex: { ...state.hex } });
    checkHills(history.at(-1).state.hex);
    checkT5Terrain(history.at(-1).state.hex);
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
  trainingTurns = prev.trainingTurns ?? [];
  trainingEvents = prev.trainingEvents ?? [];
  trainingResult = prev.trainingResult ?? null;
  groundUnits = prev.groundUnits ?? groundUnits;
  bombers = prev.bombers ?? bombers;
  bomberScore = prev.bomberScore ?? bomberScore;
  armAttacksUsed = prev.armAttacksUsed ?? armAttacksUsed;
  samAlert = prev.samAlert ?? samAlert;
  groundTargetIndex = prev.groundTargetIndex ?? 0;
  t5Stores = prev.t5Stores ?? t5Stores;
  groundResult = prev.groundResult ?? null;
  gunShots = prev.gunShots;
  combatResult = prev.combatResult;
  pendingDamage = prev.pendingDamage;
  redraw();
}

function nextTurn() {
  const before = state;
  sealTrainingTurn(before);
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
  moveT2Tug();
  if (opponents.length) moveOpponents();
  resolveT5GroundPhase(before.turnNumber);
  moveT6Bombers(before.turnNumber);
  resolveT6SamPhase(before.turnNumber);
  armAttacksUsed = 0;
  refreshVisualSighting();
  computeOrder();
  gunShots = [];
  combatResult = null;
  pendingDamage = null;
  hillTrace = null;
  logAction({ kind: 'endturn' }, before, []);
  debugLog.at(-1).action = `턴 종료 정산 · Accel ${r.totalAccel.toFixed(1)} / Decel ${r.totalDecel.toFixed(1)} / 순 ${r.net.toFixed(1)} → 속도 ${r.newSpeed.toFixed(1)}`;
  checkTimeout();
  resolveT3Ambush(before.turnNumber);
  if (scenario.training && state.turnNumber > scenario.maxTurns) finishTraining();
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
  violationPopup.classList.toggle('collapsed', alertsCollapsed);
  if (!violations.length) {
    violationPopup.innerHTML = `<div class="violation-title">알림 <button class="notice-toggle">${alertsCollapsed ? '펼치기' : '접기'}</button></div>${notice
      || '<div class="turn-help">현재 위반 없음. 위반·상대기 이동·격추가 발생하면 이곳에 표시됩니다.</div>'}`;
    violationPopup.querySelector('.notice-toggle').onclick = () => { alertsCollapsed = !alertsCollapsed; redraw(); };
    return;
  }
  violationPopup.innerHTML = `
    <div class="violation-title">규칙 위반 ${violations.length}건 <button class="notice-toggle">${alertsCollapsed ? '펼치기' : '접기'}</button></div>
    ${violations.map(v => `<div class="violation">
      <div class="r">[Rule ${v.rule}] 턴 ${v.turn}</div>
      <div>${v.msg}</div>
      <div class="fix">→ ${v.fix}</div>
    </div>`).join('')}
    ${notice}
    <div class="turn-help">위반 행동을 되돌리거나 새 시나리오를 시작할 때까지 표시됩니다.</div>`;
  violationPopup.querySelector('.notice-toggle').onclick = () => { alertsCollapsed = !alertsCollapsed; redraw(); };
}

const TURN_RANK = { EZ: 0, TT: 1, HT: 2, BT: 3, ET: 4 };

function sameHex(a, b) {
  return a.q === b.q && a.r === b.r;
}

function trainingTurn(turn = state.turnNumber) {
  let entry = trainingTurns.find(item => item.turn === turn);
  if (!entry) {
    entry = { turn, maxRate: -1, idle: false, breakChanges: 0 };
    trainingTurns.push(entry);
  }
  return entry;
}

function recordTrainingAction(action, before) {
  if (!scenario.training) return;
  const turn = trainingTurn(before.turnNumber);
  if (action.kind === 'declare' && action.power === 'Idle') turn.idle = true;
  if (action.kind === 'hfp' && before.turnProgress) {
    turn.maxRate = Math.max(turn.maxRate, TURN_RANK[before.turnProgress.rate]);
    if (before.turnProgress.rate === 'BT') turn.breakChanges += Math.max(0, state.facingChanges - before.facingChanges);
  }
  if (scenario.training === 't2' && action.kind === 'hfp') {
    const tug = markers.find(marker => marker.kind === 'tug');
    const banner = markers.find(marker => marker.kind === 'banner');
    if (tug && sameHex(state.hex, tug.hex)) trainingEvents.push({ kind: 'tug-pass', turn: before.turnNumber });
    const shots = trainingEvents.filter(event => event.kind === 'shot').length;
    const perches = trainingEvents.filter(event => event.kind === 'perch').length;
    if (banner && sameHex(state.hex, banner.hex) && (shots === 0 || perches >= shots)) {
      trainingEvents.push({ kind: 'shot', turn: before.turnNumber, rate: trainingTurn().maxRate });
      notices.push({ kind: 'move', turn: before.turnNumber, msg: '배너 통과: 사격 경로를 자동 기록했습니다.' });
    }
  }
}

function sealTrainingTurn(turnState = state) {
  if (!scenario.training) return;
  const turn = trainingTurn(turnState.turnNumber);
  turn.idle ||= turnState.power === 'Idle';
  if (scenario.training === 't2') {
    const banner = markers.find(marker => marker.kind === 'banner');
    const tug = neutrals.find(unit => unit.label?.startsWith('T-33 예인기'));
    const already = trainingEvents.some(event => event.kind === 'perch' && event.turn === turnState.turnNumber);
    // 원문의 퍼치: 배너에서 3헥스, 고도 15, 예인기와 같은 기수 방향.
    if (!already && banner && tug && distance(turnState.hex, banner.hex) === 3 && turnState.alt === 15 && turnState.facing === tug.facing) {
      trainingEvents.push({ kind: 'perch', turn: turnState.turnNumber });
      notices.push({ kind: 'move', turn: turnState.turnNumber, msg: '퍼치 복귀를 자동 기록했습니다.' });
    }
  }
}

function gradeTraining(score, t1) {
  if (score >= 5) return t1 ? '훌륭해! 고급 훈련으로 갑니다.' : '훌륭해! 세이버를 즐기게!';
  if (score >= 2) return t1 ? '부족하지만 통과! 행운을 빕니다.' : '통과했지만, 세이버 조종 시 주의하게.';
  if (score >= 0) return t1 ? '추가 훈련 필요.' : '캔자스행을 다시 생각해 보았나?';
  return t1 ? '전투기 조종사로는 구제 불능.' : '괌에 가본 적 있나?';
}

function finishTraining() {
  if (!scenario.training || trainingResult) return;
  sealTrainingTurn();
  if (scenario.training === 't1') {
    const turns = trainingTurns.length;
    const fast = Math.max(0, scenario.maxTurns - turns);
    const tactical = trainingTurns.filter(turn => turn.maxRate <= TURN_RANK.TT).length;
    const idle = trainingTurns.filter(turn => turn.idle).length;
    const breaks = trainingTurns.reduce((sum, turn) => sum + turn.breakChanges, 0);
    const score = fast + tactical - idle - breaks;
    const rendezvous = scenario.markers.find(marker => marker.label === '랑데부 목표');
    const objectiveDone = rendezvous && sameHex(state.hex, rendezvous.hex) && state.speed === 3 && state.facing === 11;
    trainingResult = { score, passed: objectiveDone && score >= 2, grade: objectiveDone ? gradeTraining(score, true) : '랑데부 목표(2405·속도 3.0·NNW)를 달성하지 못했습니다.', lines: [`턴 ${turns}: 15턴 미만 +${fast}`, `TT 이하 최대 선회: +${tactical}`, `Idle 사용: -${idle}`, `BT 방향 전환: -${breaks}`] };
  } else {
    const shots = trainingEvents.filter(event => event.kind === 'shot' && event.rate < TURN_RANK.BT).length;
    const perches = trainingEvents.filter(event => event.kind === 'perch');
    const perchBonus = (perches[0]?.turn < 5 ? 1 : 0) + (perches[1]?.turn < 10 ? 1 : 0);
    const tugPasses = trainingEvents.filter(event => event.kind === 'tug-pass').length;
    const score = shots + perchBonus - tugPasses * 2;
    const objectiveDone = trainingEvents.filter(event => event.kind === 'shot').length >= 2 && perches.length >= 2;
    trainingResult = { score, passed: objectiveDone && score >= 2, grade: objectiveDone ? gradeTraining(score, false) : '사격 경로 2회와 퍼치 복귀 2회를 완료해야 합니다.', lines: [`BT 미만 사격 경로: +${shots}`, `퍼치 조기 복귀: +${perchBonus}`, `예인기 통과: -${tugPasses * 2}`] };
  }
  redraw();
}

function recordT2Shot() {
  const banner = markers.find(marker => marker.kind === 'banner');
  if (!banner || !sameHex(state.hex, banner.hex)) notices.push({ kind: 'move', turn: state.turnNumber, msg: '사격 경로는 배너 헥스에 있을 때만 기록할 수 있습니다.' });
  else {
    trainingEvents.push({ kind: 'shot', turn: state.turnNumber, rate: trainingTurn().maxRate });
    notices.push({ kind: 'move', turn: state.turnNumber, msg: '사격 경로 기록' });
  }
  redraw();
}

function recordT2Perch() {
  const perch = markers.find(marker => marker.kind === 'perch');
  if (!perch || !sameHex(state.hex, perch.hex) || state.alt !== 15) notices.push({ kind: 'move', turn: state.turnNumber, msg: '퍼치(5809·고도 15)에 있어야 복귀를 기록할 수 있습니다.' });
  else {
    trainingEvents.push({ kind: 'perch', turn: state.turnNumber });
    notices.push({ kind: 'move', turn: state.turnNumber, msg: '퍼치 복귀 기록' });
  }
  redraw();
}

function renderCompletionPopup() {
  if (t3ExitResult) {
    completionPopup.classList.remove('failed');
    completionPopup.innerHTML = `<div class="completion-title">임무 성공</div><div class="completion-detail">${t3ExitResult}</div>`;
    return;
  }
  if (trainingResult) {
    completionPopup.classList.remove('failed');
    completionPopup.innerHTML = `<div class="completion-title">훈련 결과 · ${trainingResult.passed ? '통과' : '추가 훈련 필요'}</div><div class="completion-detail"><b>${trainingResult.score >= 0 ? '+' : ''}${trainingResult.score}점</b><br>${trainingResult.grade}<br><br>${trainingResult.lines.join('<br>')}</div><div class="turn-help">새 시나리오를 시작하면 이 결과가 사라집니다.</div>`;
    return;
  }
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
  if (state.flightType === 'LVL') return 'VFP 자유 하강 1레벨';
  return `VFP ${['SD', 'UD', 'VD'].includes(state.flightType) ? '하강' : '상승'} ${levels}레벨`;
}

function fireGun(snap) {
  const errors = canFire(state, combatTarget, { shots: gunShots, spotted: sightedTargets.has(targetIndex) });
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

function fireGround(kind) {
  const target = groundUnits[groundTargetIndex];
  const stores = t5Stores?.[activeIndex];
  if (!target || !stores || !stores[kind]) return;
  const aimedFp = state.fpSpent.filter(fp => fp.type === 'HFP').length;
  const error = canAttackGround(state, target, kind, { aimedFp });
  if (error) { groundResult = { error }; redraw(); return; }
  const result = resolveGroundAttack(state, target, kind, 1 + Math.floor(Math.random() * 10), { aimedFp });
  if (stores[kind] !== Infinity) stores[kind] -= 1;
  groundUnits = groundUnits.map((unit, index) => index === groundTargetIndex
    ? { ...result.unit, suppressedTurn: result.unit.suppressed ? state.turnNumber : unit.suppressedTurn }
    : unit);
  groundResult = { ...result, target: groundUnits[groundTargetIndex] };
  notices.push({ kind: result.result === 'K' ? 'kill' : 'move', turn: state.turnNumber, msg: `${result.weapon} → ${target.label}: ${result.ratio}:1, DRM ${result.drm >= 0 ? '+' : ''}${result.drm}, ${result.result}.` });
  redraw();
}

/** Rule 26.2/26.4: ARM 발사는 턴의 공대지 공격 1회를 소모하고, 턴당 2발이 상한이다. */
function fireArm(kind) {
  const target = groundUnits[groundTargetIndex];
  const stores = t5Stores?.[activeIndex];
  if (!target || !stores || !stores[kind]) return;
  const error = canLaunchArm(state, target, kind, { armAttacksUsed });
  if (error) { groundResult = { error }; redraw(); return; }
  const result = resolveArm(target, kind);
  stores[kind] -= 1;
  armAttacksUsed += 1;
  groundUnits = groundUnits.map((unit, index) => index === groundTargetIndex
    ? { ...result.unit, suppressedTurn: result.unit.suppressed ? state.turnNumber : unit.suppressedTurn }
    : unit);
  groundResult = { ...result, weapon: result.arm, ratio: '-', fas: '-', target: groundUnits[groundTargetIndex] };
  notices.push({
    kind: result.radarDisabled ? 'kill' : 'move', turn: state.turnNumber,
    msg: result.hit
      ? `${result.arm} → ${target.label}: 명중(${result.hitRoll}) ${result.result}${result.radarDisabled ? ' · TGL 레이더 영구 파괴' : ''}.`
      : `${result.arm} → ${target.label}: 빗나감 (주사위 ${result.hitRoll}).`,
  });
  redraw();
}

/** Rule 26.5: ARM 경보를 받은 포대는 긴급 셧다운을 시도할 수 있다. */
function samShutdown() {
  const target = groundUnits[groundTargetIndex];
  const attempt = target ? radarShutdown(target) : null;
  if (!attempt) { groundResult = { error: '셧다운할 수 있는 레이더가 아닙니다.' }; redraw(); return; }
  groundUnits = groundUnits.map((unit, index) => index === groundTargetIndex ? attempt.unit : unit);
  notices.push({ kind: 'move', turn: state.turnNumber, msg: `${target.label} 긴급 셧다운 ${attempt.success ? '성공' : '실패'} (주사위 ${attempt.roll}).` });
  redraw();
}

function toggleTff() {
  if (!scenario.t5) return;
  if (!state.tff) {
    if (state.fpSpent.length || state.flightType !== 'LVL' || state.alt > 1) { groundResult = { error: 'TFF 진입은 턴 시작 수평 비행, 지상 1레벨 이하에서만 가능합니다.' }; redraw(); return; }
    state = { ...state, tff: true };
  } else state = { ...state, tff: false, alt: Math.max(1, state.alt) };
  syncActive(); redraw();
}

function groundCombatHtml() {
  if (!scenario.t5 || !groundUnits.length) return '';
  const target = groundUnits[groundTargetIndex] ?? groundUnits[0];
  const stores = t5Stores[activeIndex];
  const report = groundResult?.error ? `공격 불가: ${groundResult.error}` : groundResult ? `${groundResult.weapon} · FAS ${groundResult.fas} · ${groundResult.ratio}:1 · 주사위 결과 ${groundResult.result} → ${groundResult.target.label}` : '표적을 선택하고 공대지 무장을 사용하십시오. 조준에는 최소 1 HFP 직선 비행이 필요합니다.';
  // T-6은 네이팜 대신 ARM 두 종을 싣는다.
  const armRow = scenario.t6 ? `<div class="debug-actions"><button id="arm-shrike" ${stores.shrike ? '' : 'disabled'}>${ARM_PROFILE.shrike.label} (${stores.shrike})</button><button id="arm-standard" ${stores.standard ? '' : 'disabled'}>${ARM_PROFILE.standard.label} (${stores.standard})</button><button id="sam-shutdown">표적 레이더 셧다운 시도</button></div>` : '';
  const t6Status = scenario.t6 ? `<div class="turn-help">ARM 사용 ${armAttacksUsed}/2 · 폭격기 탈출 점수 ${bomberScore} · ${samAlert ? 'SAM 활동 감지됨' : 'SAM 조용함'}</div>` : '';
  const t5Status = scenario.t6 ? '' : (() => {
    const score = t5Score();
    return `<div class="turn-help">점수 ${score.net >= 0 ? '+' : ''}${score.net} (VC 격파 +${score.usaf} / 아군 손실 −${score.vc}) · ${score.verdict}</div>`;
  })();
  return `<div class="row"><label>공대지 공격 · ${scenario.t6 ? 'T-6 SEAD' : 'T-5'}</label>
    <select id="ground-target">${groundUnits.map((unit, index) => `<option value="${index}" ${index === groundTargetIndex ? 'selected' : ''} ${unit.killed ? 'disabled' : ''}>${unit.label} · ${boardHexOf(unit.hex)} · ${unit.killed ? '파괴' : unit.suppressed ? '억제' : `D ${unit.hits ?? 0}`}</option>`).join('')}</select>
    <div class="debug-actions"><button id="ground-gun">기총 (${stores.gun === Infinity ? '무제한' : stores.gun})</button><button id="ground-rocket" ${stores.rocket ? '' : 'disabled'}>로켓 (${stores.rocket})</button><button id="ground-bomb" ${stores.bomb ? '' : 'disabled'}>HE 폭탄 (${stores.bomb})</button>${scenario.t6 ? '' : `<button id="ground-napalm" ${stores.napalm ? '' : 'disabled'}>네이팜 (${stores.napalm})</button>`}</div>
    ${armRow}
    <div class="debug-actions"><button id="tff">${state.tff ? 'TFF 이탈' : 'TFF 진입'}</button></div><div class="turn-help">${report}</div>${t6Status}${t5Status}
  </div>`;
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
      ? combatResult.missile
        ? `<div class="turn-help">${combatResult.missile} 발사 ${combatResult.launchRoll} / 명중 ${combatResult.roll} (목표 ${combatResult.target}) → <b>${combatResult.decoyed ? '기만기로 유도 상실' : combatResult.hit ? '명중' : '빗나감'}</b>${combatResult.hit ? ` · 공격력 ${combatResult.rating} · 피해 <b>${combatResult.damage}</b> → 표적 ${combatResult.targetDamage}` : ''}</div>`
        : `<div class="turn-help">기총 ${combatResult.roll} / 목표 ${combatResult.target} → <b>${combatResult.hit ? '명중' : '빗나감'}</b>${combatResult.hit ? ` · 공격력 ${combatResult.rating}` : ''}${combatResult.damage ? ` · 피해 주사위 ${combatResult.damageRoll}→${combatResult.damageModified} · <b>${combatResult.damage}</b> → 표적 ${combatResult.targetDamage}` : ''}</div>`
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
        ${scenario.t4 ? `<div class="debug-actions"><button id="radar-lock">${t4RadarLock === targetIndex ? '레이더 락온 유지' : '레이더 락온'}</button><button id="launch-aim4a" ${t4Missiles[activeIndex].aim4a ? '' : 'disabled'}>AIM-4A RHM (${t4Missiles[activeIndex].aim4a})</button><button id="launch-aim4b" ${t4Missiles[activeIndex].aim4b ? '' : 'disabled'}>AIM-4B IRM (${t4Missiles[activeIndex].aim4b})</button></div><div class="turn-help">${t4RadarLock === targetIndex ? '레이더 락온 완료.' : 'AIM-4A는 락온과 전방/측방 사거리 봉투가 필요합니다.'} AIM-4B는 표적 후방 60도·사거리 2~12에서 발사합니다.</div>` : ''}
    </div>
  </div>`;
}

function launchT4Missile(type) {
  const target = opponents[targetIndex];
  const stores = t4Missiles[activeIndex];
  if (!target || target.damage === 'K' || !stores[type]) return;
  const range = distance(state.hex, target.hex) + Math.floor(Math.abs(state.alt - target.alt) / 2);
  const aspect = angleOff(state, target);
  const envelope = type === 'aim4a'
    ? aspect <= 60 ? [4, 15] : aspect <= 120 ? [6, 15] : [9, 18]
    : [2, 12];
  if (type === 'aim4b' && aspect > 60) { combatResult = { error: 'AIM-4B 초기 적외선 시커는 표적 후방 60도 안에서만 발사할 수 있습니다.' }; redraw(); return; }
  if (range < envelope[0] || range > envelope[1]) { combatResult = { error: `AIM-4${type === 'aim4a' ? 'A' : 'B'} 사거리 봉투는 ${envelope[0]}~${envelope[1]}헥스입니다.` }; redraw(); return; }
  if (type === 'aim4a' && t4RadarLock !== targetIndex) { combatResult = { error: 'AIM-4A는 발사 전 레이더 락온이 필요합니다.' }; redraw(); return; }
  const launchRoll = 1 + Math.floor(Math.random() * 10);
  if (launchRoll === 8) { combatResult = { error: `발사 주사위 ${launchRoll}: 오발. 미사일은 레일에 남아 다음 턴 재시도할 수 있습니다.` }; redraw(); return; }
  if (launchRoll > 7) { stores[type] -= 1; combatResult = { error: `발사 주사위 ${launchRoll}: 미사일 소실.` }; redraw(); return; }
  stores[type] -= 1;
  const countermeasure = type === 'aim4a' ? 'chaff' : 'flare';
  const protectedTarget = target[countermeasure] >= 2;
  if (protectedTarget) opponents[targetIndex] = { ...target, [countermeasure]: target[countermeasure] - 2 };
  const roll = 1 + Math.floor(Math.random() * 10);
  // AIM-4A/B MDT: Direct Hit 5, Attack Rating 6. 적절한 ECM은 명중 전 미사일을 제거한다.
  const hit = !protectedTarget && roll <= 5;
  combatResult = { launchRoll, roll, target: 5, hit, rating: 6, missile: type === 'aim4a' ? 'AIM-4A' : 'AIM-4B', decoyed: protectedTarget };
  if (hit) {
    const result = rollDamage(6, 1 + Math.floor(Math.random() * 10), opponents[targetIndex]);
    opponents[targetIndex] = applyDamage(opponents[targetIndex], result.result);
    combatTarget = opponents[targetIndex];
    combatResult.damage = result.result;
    combatResult.targetDamage = combatTarget.damage;
    checkKills();
  }
  redraw();
}

function lockT4Radar() {
  const target = opponents[targetIndex];
  if (!target || target.damage === 'K') return;
  const range = distance(state.hex, target.hex) + Math.floor(Math.abs(state.alt - target.alt) / 2);
  if (range > 10) { combatResult = { error: '레이더 락온 유효 사거리는 10헥스입니다.' }; redraw(); return; }
  t4RadarLock = targetIndex;
  combatResult = null;
  redraw();
}

function renderPanel() {
  const ac = AIRCRAFT[state.aircraftId];
  const used = state.fpSpent.length;
  const done = scenario.solitaire || scenario.hills ? completed : wpIndex >= scenario.waypoints.length;
  const progressLabel = scenario.solitaire
    ? `임무 목표 · ${scenario.victory ?? '적기를 격추하십시오.'}${scenario.maxTurns ? ` · 제한 ${scenario.maxTurns}턴` : ''}`
    : `${scenario.hills ? `언덕 우회 ${hillPasses.length}/${scenario.hills.length} · 교대 방향 · 출발점 복귀` : `웨이포인트 ${wpIndex}/${scenario.waypoints.length}`} · 기준 ${scenario.parTurns}턴`;
  const budgetSpent = used >= state.fpBudget;
  // Rule 8.2.4: LVL 자유 하강은 턴당 1회. 소진하면 버튼도 잠근다.
  const freeDiveUsed = state.flightType === 'LVL' && state.fpSpent.some(f => f.type === 'VFP');
  const settlementPreview = budgetSpent ? settle(state) : null;
  // 편대 전원이 FP를 소진해야 턴을 넘길 수 있다. 아직 남은 기체는 이름으로 알려준다.
  const pendingJets = flight
    .map((jet, index) => ({ jet, index }))
    .filter(({ jet }) => jet.fpSpent.length < jet.fpBudget);
  const flightReady = flight.length <= 1 || pendingJets.length === 0;
  const t3CanExit = scenario.t3 && !state.fpSpent.length && debugLog.some(entry => entry.action.startsWith('턴 종료'));

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
        <option value="as-t1-recon-run" ${scenarioMode === 'as-t1-recon-run' ? 'selected' : ''}>[AS] T-1: Recon Run</option>
          <option value="as-t2-check-ride" ${scenarioMode === 'as-t2-check-ride' ? 'selected' : ''}>[AS] T-2: Check Ride</option>
          <option value="as-s1-border-clash" ${scenarioMode === 'as-s1-border-clash' ? 'selected' : ''}>[AS] S-1: Border Clash</option>
           <option value="as-s2-prelude-to-war" ${scenarioMode === 'as-s2-prelude-to-war' ? 'selected' : ''}>[AS] S-2: Prelude to War</option>
           <option value="as-s3-wrath-of-islam" ${scenarioMode === 'as-s3-wrath-of-islam' ? 'selected' : ''}>[AS] S-3: The Wrath of Islam</option>
           <option value="spoh-t1-flight-school" ${scenarioMode === 'spoh-t1-flight-school' ? 'selected' : ''}>[SPOH] T-1: 항공 훈련 사령부</option>
           <option value="spoh-t2-gunnery-pattern" ${scenarioMode === 'spoh-t2-gunnery-pattern' ? 'selected' : ''}>[SPOH] T-2: 사격 패턴</option>
            <option value="spoh-t3-first-dogfight" ${scenarioMode === 'spoh-t3-first-dogfight' ? 'selected' : ''}>[SPOH] T-3: 첫 공중전</option>
             <option value="spoh-t4-missile-age" ${scenarioMode === 'spoh-t4-missile-age' ? 'selected' : ''}>[SPOH] T-4: 미사일 시대</option>
             <option value="spoh-t5-palm-gate" ${scenarioMode === 'spoh-t5-palm-gate' ? 'selected' : ''}>[SPOH] T-5: 팜 게이트 작전</option>
             <option value="spoh-t6-wild-weasel" ${scenarioMode === 'spoh-t6-wild-weasel' ? 'selected' : ''}>[SPOH] T-6: 와일드 위즐!</option>
      </select>
      ${scenario.source ? `<div class="turn-help">출처: ${scenario.source}${
        scenario.maxTurns ? ` · 원문 제한: ${scenario.maxTurns}턴 이내`
        : scenario.victory ? ` · 승리 조건: ${scenario.victory}` : ''}</div>` : ''}
    </div>
    ${scenarioMode === 'random' || scenario.freeAircraft ? `<div class="row">
      <label>항공기</label>
      <select id="aircraft">
        ${Object.values(AIRCRAFT).filter(aircraft => scenarioMode === 'random' || aircraft.spoh).map(aircraft => `<option value="${aircraft.id}" ${aircraft.id === state.aircraftId ? 'selected' : ''}>${aircraft.title}</option>`).join('')}
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
      <button id="vfp1" ${budgetSpent || freeDiveUsed ? 'disabled' : ''}>${vfpLabel(1)}</button>
    </div>
    ${state.flightType === 'LVL' ? '' : `<div class="row">
      <button id="vfp2" ${budgetSpent ? 'disabled' : ''}>${vfpLabel(2)}</button>
    </div>
    <div class="row">
      <button id="vfp3" ${budgetSpent ? 'disabled' : ''}>${vfpLabel(3)}</button>
    </div>`}
    <div class="row">
      <label>특수 기동 (Rule 13)</label>
      <div class="debug-actions"><button id="slide-l" ${budgetSpent ? 'disabled' : ''}>Slide 좌</button><button id="slide-r" ${budgetSpent ? 'disabled' : ''}>Slide 우</button></div>
      <div class="debug-actions"><button id="dr-l" ${budgetSpent ? 'disabled' : ''}>DR 좌</button><button id="dr-r" ${budgetSpent ? 'disabled' : ''}>DR 우</button></div>
      <div class="debug-actions"><button id="lr-l" ${budgetSpent ? 'disabled' : ''}>LR 좌</button><button id="lr-r" ${budgetSpent ? 'disabled' : ''}>LR 우</button></div>
      <div class="debug-actions"><button id="vr-l" ${budgetSpent ? 'disabled' : ''}>VR 90° 좌</button><button id="vr-r" ${budgetSpent ? 'disabled' : ''}>VR 90° 우</button></div>
      <div class="turn-help">Slide는 2 HFP 준비+횡이동, DR/LR은 속도의 1/3 준비+ADC 비용을 즉시 소모합니다. VR은 VC/VD의 VFP 직후에만 가능합니다.</div>
    </div>
    <div class="row"><button id="undo">되돌리기</button></div>
    ${combatHtml()}
    ${groundCombatHtml()}
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
    ${scenario.training ? `<div class="row">
      <label>훈련 채점</label>
      ${scenario.training === 't2' ? `<div class="debug-actions"><button id="t2-shot">배너 사격 경로 기록</button><button id="t2-perch">퍼치 복귀 기록</button></div><div class="turn-help">배너(5509)와 퍼치(5809·고도 15)에서 각각 기록합니다.</div>` : '<div class="turn-help">선회율·Idle·BT 방향 전환을 자동 집계합니다.</div>'}
      <button id="finish-training" ${trainingResult ? 'disabled' : ''}>훈련 종료 · 점수 계산</button>
    </div>` : ''}
    ${scenario.t3 ? `<div class="row"><button id="t3-exit" ${!t3CanExit || completed || failed ? 'disabled' : ''}>이탈 선언 · 귀환 판정</button><div class="turn-help">턴 종료 후, MiG-15 한 대 이상을 파괴한 뒤 이탈할 수 있습니다.</div></div>` : ''}

    <div class="row">
      <label>${progressLabel}</label>
      ${done ? `<div class="ok">완료 — ${state.turnNumber}턴${scenario.parTurns ? ` (기준 ${scenario.parTurns}턴)` : ''}, 위반 ${violations.length}건</div>` : ''}
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
  // 랜덤 및 Speed of Heat 맵에서는 항공기를 바꿀 수 있다.
  const aircraftSelect = panel.querySelector('#aircraft');
  if (aircraftSelect) aircraftSelect.onchange = e => { aircraftId = e.target.value; newScenario(+panel.querySelector('#lesson').value); };
  // 레슨은 랜덤 훈련의 난이도 선택이다. 지정 시나리오를 보고 있던 중 레슨을
  // 바꾸면 해당 맵을 재사용하지 않고 랜덤 훈련으로 명확하게 전환한다.
  panel.querySelector('#lesson').onchange = e => { scenarioMode = 'random'; newScenario(+e.target.value); };
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
  // LVL에서는 2/3레벨 버튼이 아예 렌더되지 않는다.
  [2, 3].forEach(levels => {
    const button = panel.querySelector(`#vfp${levels}`);
    if (button) button.onclick = () => act(vfpAction(levels));
  });
  const roll = (type, dir) => act({ kind: 'roll', type, dir, cost: Math.ceil(AIRCRAFT[state.aircraftId].roll.fp), decel: AIRCRAFT[state.aircraftId].roll.decel });
  panel.querySelector('#slide-l').onclick = () => act({ kind: 'slide', dir: 'L' });
  panel.querySelector('#slide-r').onclick = () => act({ kind: 'slide', dir: 'R' });
  panel.querySelector('#dr-l').onclick = () => roll('displacement', 'L');
  panel.querySelector('#dr-r').onclick = () => roll('displacement', 'R');
  panel.querySelector('#lr-l').onclick = () => roll('lag', 'L');
  panel.querySelector('#lr-r').onclick = () => roll('lag', 'R');
  panel.querySelector('#vr-l').onclick = () => act({ kind: 'vr', facing: state.facing - 3 });
  panel.querySelector('#vr-r').onclick = () => act({ kind: 'vr', facing: state.facing + 3 });
  panel.querySelector('#undo').onclick = undo;
  panel.querySelectorAll('.flight-btn').forEach(button => {
    button.onclick = () => selectAircraft(+button.dataset.jet);
  });
  const targetSelect = panel.querySelector('#target-select');
  if (targetSelect) targetSelect.onchange = e => {
    targetIndex = +e.target.value;
    t4RadarLock = null;
    combatTarget = opponents[targetIndex] ?? null;
    combatResult = null;
    pendingDamage = null;
    redraw();
  };
  const fireFull = panel.querySelector('#fire-full');
  const fireSnap = panel.querySelector('#fire-snap');
  if (fireFull) fireFull.onclick = () => fireGun(false);
  if (fireSnap) fireSnap.onclick = () => fireGun(true);
  const groundTarget = panel.querySelector('#ground-target');
  if (groundTarget) groundTarget.onchange = e => { groundTargetIndex = +e.target.value; groundResult = null; redraw(); };
  ['gun', 'rocket', 'bomb', 'napalm'].forEach(kind => { const button = panel.querySelector(`#ground-${kind}`); if (button) button.onclick = () => fireGround(kind); });
  ['shrike', 'standard'].forEach(kind => { const button = panel.querySelector(`#arm-${kind}`); if (button) button.onclick = () => fireArm(kind); });
  const shutdown = panel.querySelector('#sam-shutdown');
  if (shutdown) shutdown.onclick = samShutdown;
  const tff = panel.querySelector('#tff');
  if (tff) tff.onclick = toggleTff;
  const aim4a = panel.querySelector('#launch-aim4a');
  const aim4b = panel.querySelector('#launch-aim4b');
  if (aim4a) aim4a.onclick = () => launchT4Missile('aim4a');
  if (aim4b) aim4b.onclick = () => launchT4Missile('aim4b');
  const radarLock = panel.querySelector('#radar-lock');
  if (radarLock) radarLock.onclick = lockT4Radar;
  const next = panel.querySelector('#next');
  if (next) next.onclick = nextTurn;
  const finish = panel.querySelector('#finish-training');
  if (finish) finish.onclick = finishTraining;
  const t2Shot = panel.querySelector('#t2-shot');
  if (t2Shot) t2Shot.onclick = recordT2Shot;
  const t2Perch = panel.querySelector('#t2-perch');
  if (t2Perch) t2Perch.onclick = recordT2Perch;
  const t3Exit = panel.querySelector('#t3-exit');
  if (t3Exit) t3Exit.onclick = declareT3Exit;

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
