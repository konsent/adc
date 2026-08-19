import { bandOf } from '../data/aircraft.js';
import { turnCost } from '../data/turnchart.js';
import { neighbor, normalizeFacing, isHexFacing, forwardFromSide, sidePosition, centerPosition, enterSideForTurn } from './hex.js?v=hexside-pair-1';

const CLIMBING = new Set(['SC', 'ZC', 'VC']);
const DIVING = new Set(['SD', 'UD', 'VD']);

export function isClimbing(t) { return CLIMBING.has(t); }
export function isDiving(t) { return DIVING.has(t); }

export function createState({ aircraftId, hex, facing, alt, speed }) {
  return {
    aircraftId,
    hex: { ...hex },
    position: centerPosition(hex),
    facing: normalizeFacing(facing),
    alt,
    speed,
    flightType: 'LVL',
    prevFlightType: 'LVL',
    power: 'MIL',
    turnStartPower: 'MIL',
    // 선언한 Accel 값 (Rule 6.5). null이면 해당 출력의 최대치를 쓴다.
    powerAccel: null,
    bank: null,
    turnCarry: null,
    climbCarry: 0,
    halfFpCarry: 0,
    accelCarry: 0,
    decelCarry: 0,
    fpBudget: 0,
    fpSpent: [],
    turnProgress: null,
    facingChanges: 0,
    rollCount: 0,
    slideCount: 0,
    specialDecel: 0,
    turnNumber: 0,
  };
}

/** 새 턴 시작. FP 예산을 정하고 턴 단위 카운터를 리셋한다. */
export function beginTurn(state) {
  const lastVertical = isClimbing(state.flightType) ? '상승' : isDiving(state.flightType) ? '하강' : '수평';
  return {
    ...state,
    hex: { ...state.hex },
    position: clonePosition(state.position),
    prevFlightType: state.flightType,
    turnStartPower: state.power,
    fpBudget: Math.floor(state.speed),
    fpSpent: [],
    turnProgress: state.turnCarry
      ? { ...state.turnCarry }
      : null,
    facingChanges: 0,
    rollCount: 0,
    slideCount: 0,
    specialDecel: 0,
    lastVertical,
    turnNumber: state.turnNumber + 1,
  };
}

export function applyAction(state, action) {
  switch (action.kind) {
    case 'declare':
      return {
        ...state,
        hex: { ...state.hex },
        position: clonePosition(state.position),
        flightType: action.flightType,
        power: action.power,
        powerAccel: action.powerAccel ?? (action.power === state.power ? state.powerAccel : null),
        turnProgress: action.turn
          ? { rate: action.turn.rate, dir: action.turn.dir, fp: state.turnProgress?.fp ?? 0 }
          : null,
        // 선언만으로는 뱅크가 바뀌지 않는다. 실제 선회 완료 시 advanceTurn이 갱신한다.
        bank: state.bank,
      };

    case 'hfp': {
      const fromSide = state.position.kind === 'side';
      // Rule 3.4: 1 HFP = 1헥스 전진. 헥스면에 올라서는 것도 1헥스로 친다.
      // 짝수(헥스 중심) 기수는 중심 → 중심.
      // 홀수(헥스면) 기수는 중심 → 헥스면 → 맞은편 중심 → ... 으로 번갈아 간다.
      // 어느 쪽이든 매 HFP마다 반드시 한 걸음 나가므로 제자리에 머물지 않는다.
      //
      // facing+turnDirection으로 neighbor()를 부르면 안 된다. 홀수 방향의
      // 분수 좌표가 hex에 들어가 11.520 같은 값이 되고 거리 판정이 깨진다.
      // 기수는 advanceTurn이 이동 후에 꺾는다.
      const toSide = !fromSide && !isHexFacing(state.facing);
      const moved = fromSide
        ? forwardFromSide(state.position, state.facing)
        : toSide ? { ...state.hex } : neighbor(state.hex, state.facing);
      const position = toSide
        ? sidePosition(state.hex, state.facing)
        : centerPosition(moved);
      return advanceTurn({
        ...state,
        hex: moved,
        position,
        fpSpent: [...state.fpSpent, { type: 'HFP', hex: moved }],
      });
    }

    case 'vfp': {
      const dir = action.direction === 'down' || isDiving(state.flightType) ? -1 : 1;
      const alt = state.alt + dir * action.levels;
      return advanceTurn({
        ...state,
        hex: { ...state.hex },
        position: clonePosition(state.position),
        alt,
        fpSpent: [...state.fpSpent, { type: 'VFP', levels: action.levels, alt }],
      });
    }

    case 'slide': {
      const sideFacing = normalizeFacing(Math.round(state.facing / 2) * 2 + (action.dir === 'L' ? -2 : 2));
      let next = state;
      // Rule 13.2: 두 HFP를 곧게 준비 비행한 후 마지막 FP로 횡이동한다.
      for (let i = 0; i < 2; i += 1) next = applyAction(next, { kind: 'hfp' });
      const hex = neighbor(next.hex, sideFacing);
      return {
        ...next, hex, position: centerPosition(hex), slideCount: next.slideCount + 1,
        fpSpent: [...next.fpSpent, { type: 'SLIDE', hex }],
      };
    }

    case 'roll': {
      const prep = Math.floor(state.speed / 3);
      const cost = Math.ceil(action.cost ?? 1);
      const sideFacing = normalizeFacing(Math.round(state.facing / 2) * 2 + (action.dir === 'L' ? -2 : 2));
      let next = state;
      for (let i = 0; i < prep + cost - 1; i += 1) next = applyAction(next, { kind: 'hfp' });
      const hex = neighbor(next.hex, sideFacing);
      const rollCount = next.rollCount + 1;
      return {
        ...next, hex, position: centerPosition(hex),
        facing: action.type === 'lag' ? normalizeFacing(next.facing + (action.dir === 'L' ? 1 : -1)) : next.facing,
        rollCount, specialDecel: next.specialDecel + (action.decel ?? 0) + (rollCount > 1 ? 1 : 0),
        fpSpent: [...next.fpSpent, { type: 'ROLL', roll: action.type, hex }], turnProgress: null,
      };
    }

    case 'vr': {
      const rollCount = state.rollCount + 1;
      return {
        ...state, facing: normalizeFacing(action.facing), rollCount,
        specialDecel: state.specialDecel + (rollCount > 1 ? 1 : 0),
        fpSpent: [...state.fpSpent, { type: 'ROLL', roll: 'vr', hex: { ...state.hex } }], turnProgress: null,
      };
    }

    default:
      throw new Error(`알 수 없는 action: ${action.kind}`);
  }
}

/**
 * FP를 하나 소모한 뒤 선회 진행도를 갱신한다.
 * 요구 FP를 채우면 기수를 30도(또는 60도) 꺾고 진행도를 리셋한다.
 */
function advanceTurn(state) {
  if (!state.turnProgress) return state;

  const cost = turnCost(bandOf(state.alt), state.speed, state.turnProgress.rate);
  if (!cost) return state;   // 사용 불가 선회율 — 규칙 검증이 별도로 잡는다

  const sign = state.turnProgress.dir === 'R' ? 1 : -1;
  const onSide = state.position.kind === 'side';

  if (cost.degrees === 60) {
    const facing = normalizeFacing(state.facing + sign * 2);
    const hex = onSide ? enterSideForTurn(state.position, state.turnProgress.dir) : state.hex;
    return {
      ...state,
      hex,
      facing,
      position: centerPosition(hex),
      facingChanges: state.facingChanges + 2,
      bank: state.turnProgress.dir,
      turnProgress: { ...state.turnProgress, fp: 0 },
    };
  }

  const fp = state.turnProgress.fp + 1;
  if (fp < cost.fp) {
    return { ...state, turnProgress: { ...state.turnProgress, fp } };
  }
  const facing = normalizeFacing(state.facing + sign);
  const hex = onSide ? enterSideForTurn(state.position, state.turnProgress.dir) : state.hex;
  return {
    ...state,
    hex,
    facing,
    // 헥스 중심 선회는 위치를 바꾸지 않는다. 헥스면 선회만 해당 방향 헥스로 들어간다.
    position: centerPosition(hex),
    facingChanges: state.facingChanges + 1,
    bank: state.turnProgress.dir,
    turnProgress: { ...state.turnProgress, fp: 0 },
  };
}

/** 위치를 깊게 복사한다. 헥스면은 left/right/to까지 함께 보존한다. */
function clonePosition(position) {
  if (position.kind !== 'side') return centerPosition(position.hex);
  const copy = { ...position, hex: { ...position.hex } };
  for (const key of ['left', 'right', 'to']) {
    if (position[key]) copy[key] = { ...position[key] };
  }
  return copy;
}

/** 턴 종료 시 미완 선회를 다음 턴으로 이월한다 (Rule 7.1 Turn Carry). */
export function endTurn(state) {
  const carry = state.turnProgress && state.turnProgress.fp > 0
    ? { ...state.turnProgress }
    : null;
  return {
    ...state,
    hex: { ...state.hex },
    position: clonePosition(state.position),
    turnCarry: carry,
  };
}
