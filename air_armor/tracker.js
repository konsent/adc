// air_armor/tracker.js
const STORAGE_KEY = 'airArmorTrackerState';

function createDefaultState() {
  const state = {};
  for (const factionId of Object.keys(TRACKER_DATA)) {
    const faction = TRACKER_DATA[factionId];
    const hqs = {};
    for (const hq of faction.hqs) {
      hqs[hq.id] = { rp: 0, cp: 0 };
    }
    const cs = {};
    for (const nation of faction.nations) {
      cs[nation.id] = {};
      for (const csType of faction.csTypes) {
        cs[nation.id][csType] = 0;
      }
    }
    state[factionId] = {
      hqs,
      offmap: { cp: 0, rp: 0 },
      cs,
      vp: 0,
      sam: 1
    };
  }
  return state;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return createDefaultState();
  }
}

function clampCounter(value) {
  return Math.max(0, value);
}

function resetTurnTracks(state) {
  for (const factionId of Object.keys(state)) {
    const faction = state[factionId];
    for (const hqId of Object.keys(faction.hqs)) {
      faction.hqs[hqId].rp = 0;
      faction.hqs[hqId].cp = 0;
    }
    faction.offmap.cp = 0;
    faction.offmap.rp = 0;
  }
}

function renderTrackCells(container, maxValue, currentValue, onSelect) {
  container.innerHTML = '';
  container.classList.add('track-cells');
  for (let i = 0; i <= maxValue; i++) {
    const cell = document.createElement('button');
    cell.className = 'track-cell' + (i === currentValue ? ' active' : '');
    cell.textContent = String(i);
    cell.addEventListener('click', () => onSelect(i));
    container.appendChild(cell);
  }
}

function renderCounter(container, value, onChange) {
  container.innerHTML = '';
  container.classList.add('counter-ctrl');

  const minusBtn = document.createElement('button');
  minusBtn.className = 'counter-btn';
  minusBtn.textContent = '−';
  minusBtn.addEventListener('click', () => onChange(clampCounter(value - 1)));

  const valSpan = document.createElement('span');
  valSpan.className = 'counter-val';
  valSpan.textContent = String(value);

  const plusBtn = document.createElement('button');
  plusBtn.className = 'counter-btn';
  plusBtn.textContent = '+';
  plusBtn.addEventListener('click', () => onChange(value + 1));

  container.appendChild(minusBtn);
  container.appendChild(valSpan);
  container.appendChild(plusBtn);
}

function renderFactionPanel(panelEl, factionId, state, onChange) {
  const faction = TRACKER_DATA[factionId];
  const factionState = state[factionId];
  panelEl.innerHTML = '';
  panelEl.classList.add('faction-panel', 'faction-' + factionId);

  const title = document.createElement('h2');
  title.textContent = faction.label;
  panelEl.appendChild(title);

  if (faction.hqs.length > 0) {
    const hqBox = document.createElement('div');
    hqBox.className = 'group-box';

    for (const hq of faction.hqs) {
      const row = document.createElement('div');
      row.className = 'hq-row';

      const name = document.createElement('span');
      name.className = 'hq-name';
      name.textContent = hq.name;
      row.appendChild(name);

      const rpWrap = document.createElement('div');
      rpWrap.className = 'track-wrap';
      rpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'RP' }));
      const rpCells = document.createElement('div');
      renderTrackCells(rpCells, hq.rpMax, factionState.hqs[hq.id].rp, (v) => {
        factionState.hqs[hq.id].rp = v;
        onChange();
      });
      rpWrap.appendChild(rpCells);
      row.appendChild(rpWrap);

      const cpWrap = document.createElement('div');
      cpWrap.className = 'track-wrap';
      cpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'CP' }));
      const cpCells = document.createElement('div');
      renderTrackCells(cpCells, hq.cpMax, factionState.hqs[hq.id].cp, (v) => {
        factionState.hqs[hq.id].cp = v;
        onChange();
      });
      cpWrap.appendChild(cpCells);
      row.appendChild(cpWrap);

      hqBox.appendChild(row);
    }

    panelEl.appendChild(hqBox);
  }

  const offmapBox = document.createElement('div');
  offmapBox.className = 'group-box';

  const offmapRow = document.createElement('div');
  offmapRow.className = 'offmap-row';
  const offmapTitle = document.createElement('span');
  offmapTitle.className = 'hq-name';
  offmapTitle.textContent = faction.offmap.label + ' (Offmap)';
  offmapRow.appendChild(offmapTitle);

  const offmapCpWrap = document.createElement('div');
  offmapCpWrap.className = 'track-wrap';
  offmapCpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'CP' }));
  const offmapCpCells = document.createElement('div');
  renderTrackCells(offmapCpCells, faction.offmap.cpMax, factionState.offmap.cp, (v) => {
    factionState.offmap.cp = v;
    onChange();
  });
  offmapCpWrap.appendChild(offmapCpCells);
  offmapRow.appendChild(offmapCpWrap);

  const offmapRpWrap = document.createElement('div');
  offmapRpWrap.className = 'track-wrap';
  offmapRpWrap.appendChild(Object.assign(document.createElement('span'), { className: 'label', textContent: 'RP' }));
  const offmapRpCells = document.createElement('div');
  renderTrackCells(offmapRpCells, faction.offmap.rpMax, factionState.offmap.rp, (v) => {
    factionState.offmap.rp = v;
    onChange();
  });
  offmapRpWrap.appendChild(offmapRpCells);
  offmapRow.appendChild(offmapRpWrap);

  offmapBox.appendChild(offmapRow);

  const samRow = document.createElement('div');
  samRow.className = 'sam-row';
  samRow.appendChild(Object.assign(document.createElement('span'), { className: 'hq-name', textContent: 'SAM Strength' }));
  const samCells = document.createElement('div');
  renderTrackCells(samCells, faction.samMax, factionState.sam, (v) => {
    factionState.sam = v;
    onChange();
  });
  samRow.appendChild(samCells);
  offmapBox.appendChild(samRow);

  panelEl.appendChild(offmapBox);

  const csBox = document.createElement('div');
  csBox.className = 'group-box';
  const csSection = document.createElement('div');
  csSection.className = 'cs-section';
  for (const nation of faction.nations) {
    for (const csType of faction.csTypes) {
      const item = document.createElement('div');
      item.className = 'cs-item';
      item.appendChild(Object.assign(document.createElement('span'), {
        className: 'cs-label',
        textContent: CS_TYPE_LABELS[csType] + (faction.nations.length > 1 ? ` (${nation.label})` : '')
      }));
      const counterEl = document.createElement('div');
      renderCounter(counterEl, factionState.cs[nation.id][csType], (v) => {
        factionState.cs[nation.id][csType] = v;
        onChange();
      });
      item.appendChild(counterEl);
      csSection.appendChild(item);
    }
  }
  csBox.appendChild(csSection);
  panelEl.appendChild(csBox);

  const vpBox = document.createElement('div');
  vpBox.className = 'group-box';
  const vpRow = document.createElement('div');
  vpRow.className = 'vp-row';
  vpRow.appendChild(Object.assign(document.createElement('span'), { className: 'hq-name', textContent: 'VP' }));
  const vpCounterEl = document.createElement('div');
  renderCounter(vpCounterEl, factionState.vp, (v) => {
    factionState.vp = v;
    onChange();
  });
  vpRow.appendChild(vpCounterEl);
  vpBox.appendChild(vpRow);
  panelEl.appendChild(vpBox);
}

function initTrackerPage() {
  const state = loadState();

  function rerender() {
    saveState(state);
    renderFactionPanel(document.getElementById('panel-nato'), 'nato', state, rerender);
    renderFactionPanel(document.getElementById('panel-wp'), 'wp', state, rerender);
  }

  document.getElementById('reset-turn-btn').addEventListener('click', () => {
    resetTurnTracks(state);
    rerender();
  });

  rerender();
}
