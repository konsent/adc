// 헥스 좌표 연산. q/r는 Map A CCRR 표기의 열/행 차이다.
// facing 0-11 = 30도 단위 12방위. 짝수만 헥스 중심 방향, 홀수는 헥스사이드.

const BOARD_ORIGIN = { column: 12, row: 23 };

export function normalizeFacing(f) {
  return ((f % 12) + 12) % 12;
}

export function isHexFacing(f) {
  return normalizeFacing(f) % 2 === 0;
}

/** 내부 열/행 차이를 실제 Map A CCRR 표기로 변환한다. */
export function boardHexOf({ q, r }) {
  return `${String(BOARD_ORIGIN.column + q).padStart(2, '0')}${String(BOARD_ORIGIN.row + r).padStart(2, '0')}`;
}

/** 실제 Map A CCRR 표기를 내부 열/행 차이로 변환한다. */
export function hexOfBoardHex(boardHex) {
  return {
    q: Number(boardHex.slice(0, 2)) - BOARD_ORIGIN.column,
    r: Number(boardHex.slice(2, 4)) - BOARD_ORIGIN.row,
  };
}

// 솔리테어 시나리오의 A/B/C/D 맵은 같은 0101~1925 격자를 세로로 잇는다.
// A가 최하단이고 B/C/D는 각각 그 위 25행에 놓인다.
const MAP_ROW_OFFSET = { A: 0, B: -25, C: -50, D: -75 };

// Speed of Heat maps use a distinct printed coordinate system: six 20x15 tiles
// form a 3-column by 2-row sheet, numbered 1201 through 7130.
export const SPOH_MAPS = {
  'spoh-a1': { id: 'spoh-a1', label: 'A1', col: 12, row: 1, image: 'Carte-tSoH-A1-02.gif' },
  'spoh-a2': { id: 'spoh-a2', label: 'A2', col: 12, row: 16, image: 'Carte-tSoH-A2-02.gif' },
  'spoh-b1': { id: 'spoh-b1', label: 'B1', col: 32, row: 1, image: 'Carte-tSoH-B1-03.gif' },
  'spoh-b2': { id: 'spoh-b2', label: 'B2', col: 32, row: 16, image: 'Carte-tSoH-B2-01.gif' },
  'spoh-c1': { id: 'spoh-c1', label: 'C1', col: 52, row: 1, image: 'Carte-tSoH-C1-01.gif' },
  'spoh-c2': { id: 'spoh-c2', label: 'C2', col: 51, row: 16, image: 'Carte-tSoH-C2-01.gif' },
};

export function hexOfScenarioMap(map, boardHex) {
  const hex = hexOfBoardHex(boardHex);
  const offset = MAP_ROW_OFFSET[map];
  if (offset === undefined) throw new Error(`알 수 없는 시나리오 맵: ${map}`);
  return { q: hex.q, r: hex.r + offset };
}

/** 헥스가 시나리오 맵(0101~1925 타일) 안에 있는지. maps가 없으면 항상 참. */
export function isOnScenarioMap(hex, maps) {
  if (!maps?.length) return true;
  const column = BOARD_ORIGIN.column + hex.q;
  if (column < 1 || column > 19) return false;
  // ponytail: 맵마다 같은 25행 격자를 세로로 잇는 구조라 행 범위만 확인하면 된다.
  return maps.some(map => {
    const row = BOARD_ORIGIN.row + hex.r - MAP_ROW_OFFSET[map];
    return row >= 1 && row <= 25;
  });
}

/**
 * 맵을 벗어난 헥스가 어느 가장자리로 나갔는지. 맵 안이면 null.
 * 시나리오별 탈출 방향 판정에 쓴다 (예: S-3은 남쪽 탈출만 F-4E의 승리).
 */
export function exitEdgeOf(hex, maps) {
  if (isOnScenarioMap(hex, maps)) return null;
  const column = BOARD_ORIGIN.column + hex.q;
  if (column < 1) return 'west';
  if (column > 19) return 'east';
  // 세로로 이어붙인 맵 중 가장 남쪽(행 번호가 큰 쪽)과 가장 북쪽을 기준으로 판정한다.
  const rows = maps.map(map => BOARD_ORIGIN.row + hex.r - MAP_ROW_OFFSET[map]);
  return Math.min(...rows) > 25 ? 'south' : 'north';
}

/** 솔리테어 시나리오에 쓰는 직사각형 맵 타일의 실제 격자 셀. */
export function scenarioMapCells(maps) {
  return maps.flatMap(map => {
    const offset = MAP_ROW_OFFSET[map];
    if (offset === undefined) throw new Error(`알 수 없는 시나리오 맵: ${map}`);
    const cells = [];
    for (let column = 1; column <= 19; column += 1) {
      for (let row = 1; row <= 25; row += 1) {
        const boardHex = `${String(column).padStart(2, '0')}${String(row).padStart(2, '0')}`;
        const hex = hexOfScenarioMap(map, boardHex);
        cells.push({ ...hex, map, boardHex });
      }
    }
    return cells;
  });
}

/** Speed of Heat 인쇄 헥스(CCRR)와 GIF 배경을 함께 반환한다. */
export function spohMapCells(mapIds) {
  return mapIds.flatMap(id => {
    const map = SPOH_MAPS[id];
    if (!map) throw new Error(`알 수 없는 Speed of Heat 맵: ${id}`);
    const cells = [];
    for (let column = map.col; column < map.col + 20; column += 1) {
      for (let row = map.row; row < map.row + 15; row += 1) {
        const boardHex = `${String(column).padStart(2, '0')}${String(row).padStart(2, '0')}`;
        cells.push({ q: column - BOARD_ORIGIN.column, r: row - BOARD_ORIGIN.row, map: map.label, boardHex });
      }
    }
    return cells;
  });
}

export function spohMapBackgrounds(mapIds) {
  return mapIds.map(id => {
    const map = SPOH_MAPS[id];
    if (!map) throw new Error(`알 수 없는 Speed of Heat 맵: ${id}`);
    return {
      image: `spoh/${map.image}`,
      minQ: map.col - BOARD_ORIGIN.column,
      maxQ: map.col - BOARD_ORIGIN.column + 19,
      minR: map.row - BOARD_ORIGIN.row,
      maxR: map.row - BOARD_ORIGIN.row + 14,
    };
  });
}

/**
 * flat-top axial 좌표를 SVG 화면 좌표로 그릴 때의 기수 회전각.
 * facing 0의 HFP 벡터는 화면상 위쪽이므로 기본 기수와 각도가 일치한다.
 */
export function facingRotation(f) {
  return normalizeFacing(f) * 30;
}

/** 헥스 중심 또는 두 HFP 사이의 헥스사이드 위 기체 위치. */
export function centerPosition(hex) {
  return { kind: 'center', hex: { ...hex } };
}

/**
 * 헥스사이드는 인접한 두 헥스가 공유하는 변이다. 홀수 facing f로 hex에서
 * 1 HFP 나가면 neighbor(hex, f-1)과 neighbor(hex, f+1)이 공유하는 변에 선다.
 * left/right는 기수 기준 좌·우 헥스이며, 선회 시 그쪽으로 내려선다.
 *
 * to는 그 변을 정면으로 통과해 도달하는 헥스(= 다음 HFP의 도착지)다.
 */
export function sidePosition(hex, facing) {
  const f = normalizeFacing(facing);
  if (isHexFacing(f)) return centerPosition(hex);
  const left = neighbor(hex, f - 1);
  const right = neighbor(hex, f + 1);
  return {
    kind: 'side',
    hex: { ...hex },
    left,
    right,
    to: neighbor(left, f + 1),
  };
}

export function positionHex(position) {
  return position.hex;
}

export function sideNeighbor(position) {
  if (position.to) return { ...position.to };
  return neighbor(position.hex, position.edge);
}

/**
 * 헥스사이드에서 1 HFP. 기수가 그대로 홀수면 변을 정면으로 통과해 맞은편
 * 헥스 중심에 선다. 짝수로 꺾였으면 그 방향의 좌·우 헥스 중 하나로 내려선다.
 */
export function forwardFromSide(position, facing) {
  const f = normalizeFacing(facing);
  if (!isHexFacing(f)) return { ...position.to };
  // 짝수 기수는 변 양쪽 헥스 중 그 방향에 있는 쪽으로 나간다.
  const ahead = neighbor(position.hex, f);
  return sameHex(ahead, position.left) || sameHex(ahead, position.right)
    ? ahead
    : { ...position.to };
}

function sameHex(a, b) {
  return !!a && !!b && a.q === b.q && a.r === b.r;
}

/** 헥스면에서 선회하면 공용면 양쪽 중 선회 방향 쪽 헥스로 진입한다. */
export function enterSideForTurn(position, turnDir) {
  if (position.kind !== 'side') return { ...position.hex };
  const side = turnDir === 'R' ? position.right : position.left;
  return side ? { ...side } : sideNeighbor(position);
}

// Rule 3.4: HFP는 "1헥스(또는 헥스사이드) 앞으로 전진"한다.
// 홀수 facing은 두 짝수 방향의 중간 벡터이며, 중간 위치는 sidePosition으로
// 표현한다. 이 함수의 분수 결과는 그 도착 헥스를 계산할 때만 사용한다.
export function neighbor(hex, facing) {
  const f = normalizeFacing(facing);
  const oddColumn = Math.abs(hex.q) % 2 === 1;
  const dirs = oddColumn
    ? { 0: [0, -1], 2: [1, 0], 4: [1, 1], 6: [0, 1], 8: [-1, 1], 10: [-1, 0] }
    // 짝수 열의 남서(8)는 [-1, 0]이다. 홀수 열 값 [-1, 1]을 그대로 쓰면 그 방향만
    // 반 행 어긋나, 실제로 인접한 헥스가 distance()에서 2로 나온다.
    : { 0: [0, -1], 2: [1, -1], 4: [1, 0], 6: [0, 1], 8: [-1, 0], 10: [-1, -1] };
  const d = dirs[f];
  if (d) return { q: hex.q + d[0], r: hex.r + d[1] };

  const a = dirs[normalizeFacing(f - 1)];
  const b = dirs[normalizeFacing(f + 1)];
  return { q: hex.q + (a[0] + b[0]) / 2, r: hex.r + (a[1] + b[1]) / 2 };
}

const SQRT3 = Math.sqrt(3);

/**
 * flat-top axial → 평면 좌표. size는 비율만 쓰므로 기본 1이면 충분하다.
 * Map A: 행은 열과 독립으로 증가하고 홀수 열만 반 행 아래에 놓인다.
 */
export function hexCenter(hex, size = 1) {
  return {
    x: size * 1.5 * hex.q,
    y: size * SQRT3 * (hex.r + (Math.abs(hex.q) % 2) * 0.5),
  };
}

export function distance(a, b) {
  const cube = hex => {
    const z = hex.r - (hex.q - (Math.abs(hex.q) % 2)) / 2;
    return { x: hex.q, y: -hex.q - z, z };
  };
  const ac = cube(a), bc = cube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

/** from에서 to까지 최소 회전량. 음수=좌회전, 양수=우회전. 180도는 +6. */
export function turnDelta(from, to) {
  let d = normalizeFacing(to) - normalizeFacing(from);
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}
