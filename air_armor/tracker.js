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
