// SVG 헥스 맵 렌더링 (실제 Air Power 보드와 같은 flat-top, axial 좌표)

import { boardHexOf, facingRotation, sideNeighbor, hexCenter } from '../engine/hex.js';
import { SPOH_COUNTERS } from '../data/spoh-aircraft.js';

export { hexCenter };

const SQRT3 = Math.sqrt(3);
const NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
let counterClipNumber = 0;
const AIRCRAFT_COUNTERS = {
  'F-19A': 'f-19-stealth-fighter.jpg',
  'F-15C': 'f-15c-eagle.jpg',
  'F-4E': 'f-4e-phantom-ii.jpg',
  'F-4F': 'f-4f-phantom-ii.jpg',
  'JA-37': 'ja-37-viggen.jpg',
  'MIG-21MF': 'mig-21mf-fishbed-j.jpg',
  'MIG-31': 'mig-31a-foxhound.jpg',
  'SU-17': 'su-17-fittter.jpg',
  'MIG-29': 'mig-29-fulcrum-a.jpg',
  'F-14A': 'f-14a-tomcat.jpg',
  'F-14D': 'f-14d-super-tomcat.jpg',
  ...SPOH_COUNTERS,
};

function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * 60 * i;
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function layer(svg, name) {
  let g = svg.querySelector(`g[data-layer="${name}"]`);
  if (!g) {
    g = document.createElementNS(NS, 'g');
    g.dataset.layer = name;
    svg.appendChild(g);
  }
  return g;
}

export function clearLayer(svg, name) {
  const g = svg.querySelector(`g[data-layer="${name}"]`);
  if (g) g.textContent = '';
}

/** 고정 반경의 전체 헥스 필드를 그린다. */
export function renderMap(svg, { radius = 24, hexSize = 32, cells: suppliedCells = null, backgrounds = [] } = {}) {
  const g = layer(svg, 'grid');
  g.textContent = '';

  const cells = suppliedCells ?? (() => {
    const generated = [];
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        generated.push({ q, r });
      }
    }
    return generated;
  })();

  // Speed of Heat GIFs have no printed coordinates. Put each original tile
  // beneath the SVG hexes so the grid remains selectable and readable.
  for (const background of backgrounds) {
    const first = hexCenter({ q: background.minQ, r: background.minR }, hexSize);
    const image = document.createElementNS(NS, 'image');
    image.setAttribute('href', `./assets/${background.image}`);
    image.setAttributeNS(XLINK_NS, 'xlink:href', `./assets/${background.image}`);
    image.setAttribute('x', first.x - hexSize);
    image.setAttribute('y', first.y - SQRT3 * hexSize / 2);
    image.setAttribute('width', 1.5 * hexSize * 20 + hexSize / 2);
    image.setAttribute('height', SQRT3 * hexSize * 15);
    image.setAttribute('preserveAspectRatio', 'none');
    g.appendChild(image);
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cells) {
    const { x, y } = hexCenter(c, hexSize);
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', hexPoints(x, y, hexSize));
    poly.setAttribute('class', backgrounds.length ? 'hex background-hex' : 'hex');
    poly.dataset.q = c.q;
    poly.dataset.r = c.r;
    g.appendChild(poly);

    // Map A 보드 번호: 내부 axial r은 행 번호가 아니다. flat-top axial을
    // offset 열/행으로 변환하면 실제 행 차이는 r + floor(q / 2)다.
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', x); label.setAttribute('y', y + 3);
    label.setAttribute('class', backgrounds.length ? 'hex-label background-label' : 'hex-label');
    label.textContent = backgrounds.length ? c.boardHex : c.map ? `${c.map}${c.boardHex}` : boardHexOf(c);
    g.appendChild(label);

    minX = Math.min(minX, x - hexSize); maxX = Math.max(maxX, x + hexSize);
    minY = Math.min(minY, y - hexSize); maxY = Math.max(maxY, y + hexSize);
  }

  const padding = hexSize * 0.5;
  return {
    cells,
    viewBox: { x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
  };
}

export function drawAircraft(svg, position, facing, hexSize, aircraftId, { layerName = 'aircraft', marker = null, status = null, clear = true, tooltip = '' } = {}) {
  const g = layer(svg, layerName);
  if (clear) g.textContent = '';
  // 헥스면 위 기체는 그 변을 공유하는 두 헥스(left/right)의 중점에 그린다.
  const onSide = position.kind === 'side' && position.left && position.right;
  const anchor = hexCenter(onSide ? position.left : position.hex, hexSize);
  const other = onSide
    ? hexCenter(position.right, hexSize)
    : position.kind === 'side' ? hexCenter(sideNeighbor(position), hexSize) : anchor;
  const x = (anchor.x + other.x) / 2;
  const y = (anchor.y + other.y) / 2;
  const size = hexSize * 1.35;
  const clipId = `counter-clip-${counterClipNumber += 1}`;
  const defs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', clipId);
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const roundedRect = document.createElementNS(NS, 'rect');
  roundedRect.setAttribute('x', -size / 2);
  roundedRect.setAttribute('y', -size / 2);
  roundedRect.setAttribute('width', size);
  roundedRect.setAttribute('height', size);
  roundedRect.setAttribute('rx', size * 0.18);
  clip.appendChild(roundedRect);
  defs.appendChild(clip);

  const counter = document.createElementNS(NS, 'g');
  counter.setAttribute('class', 'aircraft');
  // 카운터의 기수는 우측 상단 꼭지점(기본 위쪽 기준 +45도)이므로 보정한다.
  counter.setAttribute('transform', `translate(${x},${y}) rotate(${facingRotation(facing) - 45})`);
  if (tooltip) {
    const title = document.createElementNS(NS, 'title');
    title.textContent = tooltip;
    counter.appendChild(title);
  }
  const image = document.createElementNS(NS, 'image');
  const source = `./assets/${AIRCRAFT_COUNTERS[aircraftId]}`;
  image.setAttribute('href', source);
  // Safari를 포함한 SVG 구현에서 외부 이미지가 빠지지 않도록 두 속성을 함께 둔다.
  image.setAttributeNS(XLINK_NS, 'xlink:href', source);
  image.setAttribute('x', -size / 2);
  image.setAttribute('y', -size / 2);
  image.setAttribute('width', size);
  image.setAttribute('height', size);
  image.setAttribute('clip-path', `url(#${clipId})`);
  counter.appendChild(image);
  const frame = document.createElementNS(NS, 'rect');
  frame.setAttribute('x', -size / 2);
  frame.setAttribute('y', -size / 2);
  frame.setAttribute('width', size);
  frame.setAttribute('height', size);
  frame.setAttribute('rx', size * 0.18);
  frame.setAttribute('class', `counter-frame ${layerName === 'target' ? 'hostile' : layerName === 'neutral' ? 'neutral' : 'friendly'}`);
  counter.appendChild(frame);
  g.appendChild(defs);
  g.appendChild(counter);

  if (status) {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', x + size * 0.56); text.setAttribute('y', y - size * 0.4);
    text.setAttribute('class', 'aircraft-status');
    text.textContent = status;
    g.appendChild(text);
  }

  if (marker) {
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('cx', x); ring.setAttribute('cy', y);
    ring.setAttribute('r', size * 0.6);
    ring.setAttribute('class', 'target-ring');
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', x); label.setAttribute('y', y - size * 0.78);
    label.setAttribute('class', 'target-label');
    label.textContent = marker;
    g.appendChild(ring);
    g.appendChild(label);
  }
}

export function drawWaypoints(svg, waypoints, hexSize, currentIndex = 0) {
  const g = layer(svg, 'waypoints');
  g.textContent = '';
  waypoints.forEach((w, i) => {
    const { x, y } = hexCenter(w.hex, hexSize);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('r', hexSize * 0.55);
    c.setAttribute('class', i < currentIndex ? 'wp done' : i === currentIndex ? 'wp next' : 'wp');
    g.appendChild(c);

    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y + 4);
    t.setAttribute('class', 'wp-label');
    t.textContent = `${i + 1}·${w.alt}`;
    g.appendChild(t);
  });
}

/** 시나리오에 놓인 파일런·배너·퍼치처럼 이동하지 않는 원문 표식. */
export function drawMarkers(svg, markers, hexSize) {
  const g = layer(svg, 'markers');
  g.textContent = '';
  markers.forEach(marker => {
    const { x, y } = hexCenter(marker.hex, hexSize);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('r', hexSize * 0.5);
    c.setAttribute('class', 'marker');
    g.appendChild(c);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y + 4);
    t.setAttribute('class', 'marker-label');
    t.textContent = marker.label;
    g.appendChild(t);
  });
}

/** Ground counters are deliberately square like the supplied SPOH counters. */
export function drawGroundUnits(svg, units, hexSize) {
  const g = layer(svg, 'ground');
  g.textContent = '';
  units.forEach(unit => {
    const { x, y } = hexCenter(unit.hex, hexSize);
    const size = hexSize * 0.9;
    const clipId = `ground-clip-${counterClipNumber += 1}`;
    const defs = document.createElementNS(NS, 'defs');
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', clipId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const roundedRect = document.createElementNS(NS, 'rect');
    roundedRect.setAttribute('x', x - size / 2); roundedRect.setAttribute('y', y - size / 2);
    roundedRect.setAttribute('width', size); roundedRect.setAttribute('height', size); roundedRect.setAttribute('rx', size * 0.18);
    clip.appendChild(roundedRect); defs.appendChild(clip); g.appendChild(defs);
    const image = document.createElementNS(NS, 'image');
    const source = `./assets/spoh/${unit.image ?? (unit.type === 'aaa' ? 'AAABarrageFire.gif' : unit.side === 'friendly' ? 'InfantryBack.gif' : 'InfantryBackT.gif')}`;
    image.setAttribute('href', source); image.setAttributeNS(XLINK_NS, 'xlink:href', source);
    image.setAttribute('x', x - size / 2); image.setAttribute('y', y - size / 2); image.setAttribute('width', size); image.setAttribute('height', size);
    image.setAttribute('clip-path', `url(#${clipId})`);
    image.setAttribute('opacity', unit.killed ? '0.2' : '1');
    const title = document.createElementNS(NS, 'title');
    // 레이더 상태는 SEAD 판단의 핵심이므로 툴팁에 함께 싣는다.
    const radar = !unit.radar ? '' : unit.radarDisabled ? '\n레이더: ARM으로 파괴됨' : unit.radarOff ? '\n레이더: 셧다운' : '\n레이더: 가동 중';
    title.textContent = `${unit.label}\n${unit.killed ? '파괴됨' : unit.suppressed ? '억제됨' : '정상'} · 피해 ${unit.hits ?? 0}`
      + `${radar}${unit.ready !== undefined ? `\n즉응탄 ${unit.ready}` : ''}`;
    image.appendChild(title); g.appendChild(image);
    const frame = document.createElementNS(NS, 'rect');
    frame.setAttribute('x', x - size / 2); frame.setAttribute('y', y - size / 2);
    frame.setAttribute('width', size); frame.setAttribute('height', size); frame.setAttribute('rx', size * 0.18);
    frame.setAttribute('class', 'ground-counter-frame');
    g.appendChild(frame);
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', x); label.setAttribute('y', y + size * 0.72); label.setAttribute('class', 'marker-label');
    const radarMark = unit.radar ? (unit.radarDisabled ? ' ⌀' : unit.radarOff ? ' ○' : ' ◉') : '';
    label.textContent = `${unit.label}${unit.killed ? ' X' : unit.suppressed ? ' S' : ''}${radarMark}`; g.appendChild(label);
  });
}

export function drawHills(svg, hills, hexSize, passed = []) {
  const g = layer(svg, 'hills');
  g.textContent = '';
  hills.forEach((hill, i) => {
    const { x, y } = hexCenter(hill.hex, hexSize);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('r', hexSize * 0.42);
    c.setAttribute('class', passed[i] ? 'hill passed' : 'hill');
    g.appendChild(c);

    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y + 4);
    t.setAttribute('class', 'hill-label');
    t.textContent = hill.label;
    g.appendChild(t);
  });
}

export function drawStart(svg, start, hexSize, label = 'START') {
  const g = layer(svg, 'start');
  g.textContent = '';
  const { x, y } = hexCenter(start, hexSize);
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', x); c.setAttribute('cy', y);
  c.setAttribute('r', hexSize * 0.62);
  c.setAttribute('class', 'start');
  g.appendChild(c);

  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y + hexSize * 0.88);
  t.setAttribute('class', 'start-label');
  t.textContent = label;
  g.appendChild(t);
}

export function drawPath(svg, hexes, hexSize) {
  const g = layer(svg, 'path');
  g.textContent = '';
  if (hexes.length < 2) return;
  const d = hexes.map((position, i) => {
    const onSide = position.kind === 'side' && position.left && position.right;
    const anchor = hexCenter(onSide ? position.left : position.hex, hexSize);
    const other = onSide
      ? hexCenter(position.right, hexSize)
      : position.kind === 'side' ? hexCenter(sideNeighbor(position), hexSize) : anchor;
    const x = (anchor.x + other.x) / 2;
    const y = (anchor.y + other.y) / 2;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('class', 'flightpath');
  g.appendChild(p);
}

/**
 * 상대기 이동 궤적. 턴마다 남는 헥스 중심 목록이라 drawPath의 헥스사이드 보간이
 * 필요 없다. 궤적마다 끝점에 턴 번호를 찍어 어느 턴 이동인지 읽히게 한다.
 */
export function drawOpponentTrails(svg, trails, hexSize) {
  const g = layer(svg, 'opponent-trail');
  g.textContent = '';
  for (const trail of trails) {
    if (trail.length < 2) continue;
    const points = trail.map(step => hexCenter(step.hex, hexSize));
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' '));
    p.setAttribute('class', 'opponent-trail');
    g.appendChild(p);
    for (let i = 1; i < points.length; i += 1) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', points[i].x);
      dot.setAttribute('cy', points[i].y);
      dot.setAttribute('r', 3);
      dot.setAttribute('class', 'opponent-trail-dot');
      const title = document.createElementNS(NS, 'title');
      title.textContent = `턴 ${trail[i].turn} · ${trail[i].boardHex ?? ''} · 고도 ${trail[i].alt} · 속도 ${trail[i].speed.toFixed(1)}`;
      dot.appendChild(title);
      g.appendChild(dot);
    }
  }
}
