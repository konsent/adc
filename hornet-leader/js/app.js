// Hornet Leader Campaign Log App

let gameData = null;
let targetData = null;
let campaign = null;

const RANKS = ['Newbie', 'Green', 'Average', 'Skilled', 'Veteran', 'Ace'];
const RANK_CLASSES = {
    Newbie: 'rank-newbie', Green: 'rank-green', Average: 'rank-average',
    Skilled: 'rank-skilled', Veteran: 'rank-veteran', Ace: 'rank-ace'
};

// ─── Base Game Scenarios (filter out expansions) ───
const BASE_SCENARIOS = [
    'Libya 1984',
    'WWIII North Atlantic 1980',
    'Israel Defense',
    'Syria 2004',
    'Taiwan Defense 2008',
    'North Korea 2011',
    'Iran 2014',
];

function isBaseScenario(name) {
    // After loadGameData, use _isBase tag; during tagging, match by name
    return BASE_SCENARIOS.some(s => name.startsWith(s));
}

function isBase(campaign) {
    return campaign._isBase;
}

// ─── Data Loading ───

async function loadGameData() {
    const [resp, tResp] = await Promise.all([
        fetch('../hl.json'),
        fetch('../hl_target.json')
    ]);
    gameData = await resp.json();
    targetData = await tResp.json();
    // Tag base scenarios before renaming
    gameData.Campaigns.forEach(c => {
        c._isBase = isBaseScenario(c.Name);
    });
    // Fix scenario name: WWIII 1980 → 1986
    gameData.Campaigns.forEach(c => {
        if (c.Name.startsWith('WWIII North Atlantic 1980')) {
            c.Name = c.Name.replace('1980', '1986');
        }
    });
    initSetupScreen();
    loadSavedCampaignList();
}

// ─── Setup Screen ───

// Parse campaign name into region and force
function parseCampaign(c) {
    const match = c.Name.match(/^(.+?)\s*\((USN|USMC)\)(.*)$/);
    if (match) {
        const region = match[1].trim();
        const force = match[2];
        const suffix = match[3].trim();
        return { region: suffix ? `${region} ${suffix}` : region, force };
    }
    return { region: c.Name, force: '' };
}

function initSetupScreen() {
    // Collect unique difficulties
    const diffSel = document.getElementById('difficulty-select');
    const baseCampaigns = gameData.Campaigns.filter(c => isBase(c));
    const difficulties = [...new Map(
        baseCampaigns.map(c => [c.DifficultyDescription, c.Difficulty])
    )];
    diffSel.innerHTML = '<option value="">-- 선택 --</option>';
    difficulties.sort((a, b) => a[1] - b[1]).forEach(([desc]) => {
        const o = document.createElement('option');
        o.value = desc;
        o.textContent = desc;
        diffSel.appendChild(o);
    });

    // Default to "Standard" if available
    const standardOpt = [...diffSel.options].find(o => o.value === 'Standard');
    if (standardOpt) {
        diffSel.value = 'Standard';
    }

    diffSel.addEventListener('change', onDifficultyChange);
    document.getElementById('region-select').addEventListener('change', onRegionChange);
    document.getElementById('force-select').addEventListener('change', onForceChange);

    // Trigger change to populate regions if default was set
    if (diffSel.value) {
        onDifficultyChange.call(diffSel);
    }
}

function hideFrom(startLevel) {
    const ids = ['scenario-info', 'length-group', 'length-info', 'difficulty-rules-group', 'campaign-options-group', 'aircraft-group'];
    ids.forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('generate-group').classList.add('hidden');
    document.getElementById('manual-panel').classList.add('hidden');
    if (startLevel <= 1) {
        const r = document.getElementById('region-select');
        r.innerHTML = '<option value="">-- 선택 --</option>';
        r.disabled = true;
    }
    if (startLevel <= 2) {
        const f = document.getElementById('force-select');
        f.innerHTML = '<option value="">-- 선택 --</option>';
        f.disabled = true;
    }
}

function onDifficultyChange() {
    hideFrom(1);
    const diff = this.value;
    if (!diff) return;

    const filtered = gameData.Campaigns.filter(c => c.DifficultyDescription === diff && isBase(c));
    const regions = [...new Set(filtered.map(c => parseCampaign(c).region))];

    const regionSel = document.getElementById('region-select');
    regionSel.innerHTML = '<option value="">-- 선택 --</option>';
    regions.sort().forEach(r => {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = r;
        regionSel.appendChild(o);
    });
    regionSel.disabled = false;
}

function onRegionChange() {
    hideFrom(2);
    const diff = document.getElementById('difficulty-select').value;
    const region = this.value;
    if (!region) return;

    const filtered = gameData.Campaigns.filter(c =>
        c.DifficultyDescription === diff && parseCampaign(c).region === region && isBase(c)
    );
    const forces = [...new Set(filtered.map(c => parseCampaign(c).force).filter(Boolean))];

    const forceSel = document.getElementById('force-select');
    forceSel.innerHTML = '<option value="">-- 선택 --</option>';

    if (forces.length === 0) {
        // No force distinction — auto-select
        forceSel.disabled = true;
        if (filtered.length === 1) {
            showScenarioDetails(filtered[0]);
        }
    } else {
        forces.forEach(f => {
            const o = document.createElement('option');
            o.value = f;
            o.textContent = f;
            forceSel.appendChild(o);
        });
        forceSel.disabled = false;
    }
}

function onForceChange() {
    hideFrom(3);

    const diff = document.getElementById('difficulty-select').value;
    const region = document.getElementById('region-select').value;
    const force = this.value;
    if (!force) return;

    const found = gameData.Campaigns.find(c =>
        isBase(c) &&
        c.DifficultyDescription === diff &&
        parseCampaign(c).region === region &&
        parseCampaign(c).force === force
    );
    if (found) showScenarioDetails(found);
}

function showScenarioDetails(sc) {
    const scenarioIdx = gameData.Campaigns.indexOf(sc);

    const infoDiv = document.getElementById('scenario-info');
    infoDiv.classList.remove('hidden');
    infoDiv.innerHTML = `
        <strong>${sc.Name}</strong>
        <span class="sc-meta">연도: ${sc.Year} | 난이도: ${sc.DifficultyDescription}</span>
        <div class="sc-tag-group">
            <span class="sc-tag-label">기체</span>
            <div class="sc-tags">${sc.AvailableAircraft.map(a => `<span class="sc-tag sc-tag-ac">${a}</span>`).join('')}</div>
        </div>
        <div class="sc-tag-group">
            <span class="sc-tag-label">특수 무장</span>
            <div class="sc-tags">${sc.SpecialWeapons.map(w => `<span class="sc-tag sc-tag-wp">${w}</span>`).join('')}</div>
        </div>
    `;

    const lengthSel = document.getElementById('length-select');
    lengthSel.innerHTML = '<option value="">-- 기간 선택 --</option>';
    sc.CampaignOptions.forEach((opt, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${opt.LengthDescription} (${opt.Timespan})`;
        lengthSel.appendChild(o);
    });
    document.getElementById('length-group').classList.remove('hidden');
    document.getElementById('length-info').classList.add('hidden');
    document.getElementById('aircraft-group').classList.add('hidden');
    document.getElementById('generate-group').classList.add('hidden');
    document.getElementById('manual-panel').classList.add('hidden');

    // Store selected scenario index
    lengthSel.dataset.scenarioIdx = scenarioIdx;

    lengthSel.onchange = function() {
        if (this.value === '') {
            hideFrom(3);
            document.getElementById('length-group').classList.remove('hidden');
            return;
        }
        const lengthIdx = parseInt(this.value);
        const opt = sc.CampaignOptions[lengthIdx];
        const lengthInfo = document.getElementById('length-info');
        lengthInfo.classList.remove('hidden');
        lengthInfo.innerHTML = `
            <strong>${opt.LengthDescription}</strong> - ${opt.Timespan}<br>
            SO 포인트: ${opt.SOPoints}<br>
            비행대 구성: ${opt.SquadronMakeup.map(r => `${r.RankDescription} ${r.Count}명`).join(', ')}
        `;

        populateAircraftOptions(sc, lengthIdx);
        populateDifficultyRules();
        document.getElementById('difficulty-rules-group').classList.remove('hidden');
        document.getElementById('campaign-options-group').classList.remove('hidden');
        document.getElementById('aircraft-group').classList.remove('hidden');
        document.getElementById('generate-group').classList.remove('hidden');

        // Flying More/Less SO cost label
        const fmlLabel = document.getElementById('flying-more-less-label');
        const fmlCost = FLYING_MORE_LESS_SO_COST[lengthIdx] || 3;
        fmlLabel.textContent = `기체 수 변경 (±1) — 표적당 기체를 1대 더/덜 투입 가능 [-${fmlCost} SO]`;
        document.getElementById('flying-more-less').checked = false;

        // USMC options (Large Deck Marine inside campaign-options-group)
        const ldmOption = document.getElementById('large-deck-marine-option');
        const ldmCheckbox = document.getElementById('large-deck-marine');
        if (isUSMC(sc)) {
            ldmOption.style.display = '';
            ldmCheckbox.checked = false;
            ldmCheckbox.onchange = () => {
                if (ldmCheckbox.checked) {
                    const usnMatch = getMatchingUSNCampaign(sc);
                    if (usnMatch) {
                        populateAircraftOptions(usnMatch, lengthIdx);
                    }
                } else {
                    populateAircraftOptions(sc, lengthIdx);
                }
            };
        } else {
            ldmOption.style.display = 'none';
            ldmCheckbox.checked = false;
        }
    };
}

function getMatchingUSNCampaign(usmcScenario) {
    const { region } = parseCampaign(usmcScenario);
    return gameData.Campaigns.find(c => {
        const p = parseCampaign(c);
        return p.region === region && p.force === 'USN' && c.DifficultyDescription === usmcScenario.DifficultyDescription;
    });
}

function populateAircraftOptions(scenario, lengthIdx) {
    const container = document.getElementById('aircraft-options');
    container.innerHTML = '';

    const tbl = document.createElement('table');
    tbl.className = 'aircraft-table';
    scenario.AvailableAircraft.forEach(designation => {
        const acType = gameData.AircraftTypes.find(a => a.Designation === designation);
        const pilotCount = gameData.Pilots.filter(p => p.Aircraft === designation && !EXPANSION_PILOTS.has(p.Name)).length;
        if (pilotCount === 0) return; // skip aircraft with no base-game pilots
        const soCost = getAircraftSOCost(designation, lengthIdx);

        const soHtml = formatSOCost(soCost);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ac-check"><input type="checkbox" value="${designation}" checked></td>
            <td class="ac-designation">${designation}</td>
            <td class="ac-name">${acType ? acType.Name : ''}</td>
            <td class="ac-pilots">${pilotCount}명</td>
            <td class="ac-so">${soHtml}</td>
        `;
        tbl.appendChild(tr);
    });
    container.appendChild(tbl);

    // Click row to toggle checkbox
    tbl.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            const cb = tr.querySelector('input[type="checkbox"]');
            cb.checked = !cb.checked;
        });
    });
}

function getSelectedAircraft() {
    const checkboxes = document.querySelectorAll('#aircraft-options input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach(cb => {
        if (cb.checked) selected.push(cb.value);
    });
    return selected;
}

// ─── Difficulty Rules ───

const PLAYER_LEVELS = [
    { id: 'ace',     label: 'Ace (에이스)',     slots: 3, type: 'disadvantage' },
    { id: 'veteran', label: 'Veteran (베테랑)', slots: 2, type: 'disadvantage' },
    { id: 'skilled', label: 'Skilled (숙련)',   slots: 1, type: 'disadvantage' },
    { id: 'average', label: 'Average (평균)',   slots: 0, type: 'none' },
    { id: 'green',   label: 'Green (그린)',     slots: 1, type: 'advantage' },
    { id: 'newbie',  label: 'Newbie (뉴비)',    slots: 2, type: 'advantage' },
];

const DISADVANTAGES = [
    { id: 'extraStress',    label: '추가 스트레스',     desc: '미션 비행 시 모든 조종사 스트레스 +1', auto: true },
    { id: 'improvedEnemies', label: '강화된 적군',      desc: '적 공격 주사위 +1 (수동 적용)', auto: false },
    { id: 'extraEnemies',   label: '추가 적군 배치',    desc: '중앙 구역 사이트+밴딧 각 1 추가 (수동 적용)', auto: false },
    { id: 'reducedSOs',     label: 'SO 감소',          desc: 'Short -6 / Medium -15 / Long -24 SO', auto: true },
];

const ADVANTAGES = [
    { id: 'lessStress',       label: '스트레스 감소',     desc: '미션 비행 시 받는 스트레스 -1', auto: true },
    { id: 'downgradedEnemies', label: '약화된 적군',      desc: '적 공격 주사위 -1 (수동 적용)', auto: false },
    { id: 'fewerEnemies',     label: '적군 배치 감소',    desc: '중앙 구역 사이트+밴딧 각 1 제거 (수동 적용)', auto: false },
    { id: 'increasedSOs',     label: 'SO 증가',          desc: 'Short +6 / Medium +15 / Long +24 SO', auto: true },
];

const SO_ADJUST = [6, 15, 24]; // by length index

function populateDifficultyRules() {
    const area = document.getElementById('difficulty-rules-area');
    area.innerHTML = '';

    // Level select
    const levelRow = document.createElement('div');
    levelRow.className = 'diff-level-row';
    levelRow.innerHTML = `
        <span class="diff-level-label">플레이어 난이도</span>
        <select id="player-level-select" class="diff-level-select">
            ${PLAYER_LEVELS.map(l => `<option value="${l.id}" ${l.id === 'average' ? 'selected' : ''}>${l.label}</option>`).join('')}
        </select>
    `;
    area.appendChild(levelRow);

    // Rules box container
    const boxWrap = document.createElement('div');
    boxWrap.id = 'diff-rules-wrap';
    area.appendChild(boxWrap);

    document.getElementById('player-level-select').addEventListener('change', renderDifficultyCheckboxes);
    renderDifficultyCheckboxes();
}

function renderDifficultyCheckboxes() {
    const wrap = document.getElementById('diff-rules-wrap');
    wrap.innerHTML = '';

    const levelId = document.getElementById('player-level-select').value;
    const level = PLAYER_LEVELS.find(l => l.id === levelId);
    if (!level || level.type === 'none') return;

    const rules = level.type === 'disadvantage' ? DISADVANTAGES : ADVANTAGES;
    const maxSlots = level.slots;
    const typeLabel = level.type === 'disadvantage' ? `불이익 ${maxSlots}개 선택` : `이득 ${maxSlots}개 선택`;

    const box = document.createElement('div');
    box.className = 'diff-rules-box';
    box.innerHTML = `<div class="diff-rules-box-title">${typeLabel}</div>`;

    const list = document.createElement('div');
    list.className = 'diff-rules-list';

    rules.forEach(rule => {
        const item = document.createElement('label');
        item.className = 'diff-rule-item';
        item.innerHTML = `
            <input type="checkbox" value="${rule.id}" class="diff-rule-cb" data-ruletype="${level.type}">
            <span class="diff-rule-name">${rule.label}</span>
            <span class="diff-rule-desc">— ${rule.desc}</span>
        `;
        list.appendChild(item);
    });

    box.appendChild(list);
    wrap.appendChild(box);

    // Enforce max selections
    list.querySelectorAll('.diff-rule-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = list.querySelectorAll('.diff-rule-cb:checked').length;
            list.querySelectorAll('.diff-rule-cb:not(:checked)').forEach(uncb => {
                uncb.disabled = checked >= maxSlots;
                uncb.closest('.diff-rule-item').classList.toggle('disabled', checked >= maxSlots);
            });
        });
    });
}

function getSelectedDifficultyRules() {
    const levelId = document.getElementById('player-level-select').value;
    const level = PLAYER_LEVELS.find(l => l.id === levelId);
    const rules = {
        level: levelId,
        extraStress: false,
        improvedEnemies: false,
        extraEnemies: false,
        reducedSOs: false,
        lessStress: false,
        downgradedEnemies: false,
        fewerEnemies: false,
        increasedSOs: false,
    };
    if (!level || level.type === 'none') return rules;

    document.querySelectorAll('.diff-rule-cb:checked').forEach(cb => {
        rules[cb.value] = true;
    });
    return rules;
}

// ─── SO Helpers ───

function formatSOCost(cost, mode = 'html') {
    if (cost === 0) return '';
    if (mode === 'label') {
        return cost > 0 ? ` [-${cost} SO]` : ` [+${Math.abs(cost)} SO]`;
    }
    return cost > 0
        ? `<span class="aircraft-so-cost so-pay">-${cost}</span>`
        : `<span class="aircraft-so-cost so-gain">+${Math.abs(cost)}</span>`;
}

// Get aircraft SO cost for a given campaign length index (0=short,1=medium,2=long)
function getAircraftSOCost(aircraftDesignation, lengthIdx) {
    const acType = gameData.AircraftTypes.find(a => a.Designation === aircraftDesignation);
    if (!acType || !acType.Cost) return 0;
    const costs = acType.Cost.split(',').map(Number);
    return costs[lengthIdx] || 0;
}

// ─── Squadron Generation ───

// Expansion pilots excluded from the app
const EXPANSION_PILOTS = new Set([
    'Artoo', 'Nomad',                           // The Cthulhu Conflict
    'Taco', 'Tooth', 'Nerve',                   // Expansion #1 - F/A-18C
    'Bell', 'Spy', 'Harp',                      // Expansion #1 - OV-10
    'Maestro', 'Sticky', 'Coffee',              // Expansion #1 - F-14
    'Axe', 'Lizgar', 'Bat', 'Trident', 'Thumper' // Expansion #1 - Elite
]);

function generateSquadron(scenario, option, selectedAircraft) {
    const allowedAircraft = selectedAircraft || scenario.AvailableAircraft;
    const pilotPool = gameData.Pilots.filter(p =>
        allowedAircraft.includes(p.Aircraft) && !EXPANSION_PILOTS.has(p.Name));
    const squadron = [];
    const usedPilots = new Set();

    for (const rank of option.SquadronMakeup) {
        const rankName = rank.RankDescription;
        for (let i = 0; i < rank.Count; i++) {
            const available = pilotPool.filter(p => !usedPilots.has(p.Name));
            if (available.length === 0) break;
            const pilot = available[Math.floor(Math.random() * available.length)];
            usedPilots.add(pilot.Name);
            const hasStats = !!pilot.Stats;
            const rankStats = hasStats && pilot.Stats[rankName] ? pilot.Stats[rankName] : null;
            squadron.push({
                name: pilot.Name,
                aircraft: pilot.Aircraft,
                rank: rankName,
                stress: 0,
                xp: 0,
                cooldown: rankStats ? rankStats.Cooldown : 0,
                hasStats: hasStats
            });
        }
    }
    return squadron;
}

// ─── Manual Pilot Selection ───

function openManualPanel() {
    const lengthSel = document.getElementById('length-select');
    const scenarioIdx = parseInt(lengthSel.dataset.scenarioIdx);
    const lengthIdx = parseInt(lengthSel.value);
    const scenario = gameData.Campaigns[scenarioIdx];
    const option = scenario.CampaignOptions[lengthIdx];
    const selectedAircraft = getSelectedAircraft();
    if (selectedAircraft.length === 0) return;

    const pilotPool = gameData.Pilots.filter(p =>
        selectedAircraft.includes(p.Aircraft) && !EXPANSION_PILOTS.has(p.Name));

    const container = document.getElementById('manual-slots');
    container.innerHTML = '';
    // Remove previous SO info if exists
    const oldSoInfo = document.getElementById('manual-so-info');
    if (oldSoInfo) oldSoInfo.remove();

    let slotIndex = 0;
    option.SquadronMakeup.forEach(rank => {
        for (let i = 0; i < rank.Count; i++) {
            const row = document.createElement('div');
            row.className = 'manual-slot-row';
            const sel = document.createElement('select');
            sel.className = 'manual-pilot-select';
            sel.dataset.slotIndex = slotIndex;
            sel.dataset.rank = rank.RankDescription;
            sel.innerHTML = `<option value="">-- ${rank.RankDescription} #${i + 1} --</option>`;
            pilotPool.forEach(p => {
                const o = document.createElement('option');
                o.value = p.Name;
                const soCost = getAircraftSOCost(p.Aircraft, lengthIdx);
                o.textContent = `${p.Name} (${p.Aircraft})${formatSOCost(soCost, 'label')}`;
                o.dataset.aircraft = p.Aircraft;
                sel.appendChild(o);
            });
            const rankBadge = document.createElement('span');
            rankBadge.className = `manual-rank-badge ${RANK_CLASSES[rank.RankDescription] || ''}`;
            rankBadge.textContent = rank.RankDescription;
            row.appendChild(rankBadge);
            row.appendChild(sel);
            container.appendChild(row);
            slotIndex++;
        }
    });

    // SO cost display
    const soInfo = document.createElement('div');
    soInfo.id = 'manual-so-info';
    soInfo.className = 'manual-so-info';
    container.after(soInfo);

    // Enforce unique selection
    container.querySelectorAll('.manual-pilot-select').forEach(sel => {
        sel.addEventListener('change', () => updateManualSelections());
    });

    document.getElementById('manual-panel').classList.remove('hidden');
    document.getElementById('manual-confirm-btn').disabled = true;
    updateManualSelections(); // initial SO display
}

function updateManualSelections() {
    const selects = document.querySelectorAll('.manual-pilot-select');
    const lengthIdx = parseInt(document.getElementById('length-select').value);
    const chosen = new Set();
    selects.forEach(s => { if (s.value) chosen.add(s.value); });

    // Disable already-chosen pilots in other dropdowns
    selects.forEach(s => {
        Array.from(s.options).forEach(opt => {
            if (!opt.value) return;
            opt.disabled = opt.value !== s.value && chosen.has(opt.value);
        });
    });

    // Calculate and display SO cost
    let totalCost = 0;
    selects.forEach(sel => {
        if (!sel.value) return;
        const pd = gameData.Pilots.find(p => p.Name === sel.value);
        if (pd) totalCost += getAircraftSOCost(pd.Aircraft, lengthIdx);
    });

    const soInfo = document.getElementById('manual-so-info');
    if (soInfo) {
        if (totalCost === 0) {
            soInfo.innerHTML = '항공기 SO 보정: 없음';
        } else {
            const label = totalCost > 0 ? '비용' : '보너스';
            soInfo.innerHTML = `항공기 SO ${label}: <span class="${totalCost > 0 ? 'so-pay' : 'so-gain'}">${totalCost > 0 ? '-' : '+'}${Math.abs(totalCost)} SO</span>`;
        }
    }

    // Enable confirm only when all slots filled
    const allFilled = Array.from(selects).every(s => s.value !== '');
    document.getElementById('manual-confirm-btn').disabled = !allFilled;
}

function confirmManualSelection() {
    const lengthSel = document.getElementById('length-select');
    const scenarioIdx = parseInt(lengthSel.dataset.scenarioIdx);
    const lengthIdx = parseInt(lengthSel.value);
    const diffRules = getSelectedDifficultyRules();
    const scenario = gameData.Campaigns[scenarioIdx];
    const option = scenario.CampaignOptions[lengthIdx];

    const selects = document.querySelectorAll('.manual-pilot-select');
    const squadron = [];
    selects.forEach(sel => {
        const pilotName = sel.value;
        const rank = sel.dataset.rank;
        const pd = gameData.Pilots.find(p => p.Name === pilotName);
        if (!pd) return;
        const hasStats = !!pd.Stats;
        const rankStats = hasStats && pd.Stats[rank] ? pd.Stats[rank] : null;
        squadron.push({
            name: pd.Name,
            aircraft: pd.Aircraft,
            rank: rank,
            stress: 0,
            xp: 0,
            cooldown: rankStats ? rankStats.Cooldown : 0,
            hasStats: hasStats
        });
    });

    const largeDeckMarine = document.getElementById('large-deck-marine')?.checked || false;
    const flyingMoreLess = document.getElementById('flying-more-less')?.checked || false;
    campaign = buildCampaign(scenarioIdx, lengthIdx, squadron, diffRules, { extra: { manualSquadron: true, largeDeckMarine, flyingMoreLess } });

    resetAssignState();
    saveCampaign();
    showDashboard();
}

// Calculate total SO adjustment from aircraft costs (negative = gain, positive = pay)
function calcSquadronSOCost(squadron, lengthIdx) {
    let total = 0;
    squadron.forEach(p => {
        total += getAircraftSOCost(p.aircraft, lengthIdx);
    });
    return total;
}

// ─── Pilot Helpers ───

function getPilotRankStats(pilot) {
    if (!pilot.hasStats) return null;
    const pd = gameData.Pilots.find(p => p.Name === pilot.name);
    if (!pd || !pd.Stats || !pd.Stats[pilot.rank]) return null;
    return { pd, stats: pd.Stats[pilot.rank] };
}

function getStatus(pilot) {
    const rs = getPilotRankStats(pilot);
    if (!rs) return 'Okay';
    const s = rs.stats;
    if (pilot.stress >= s.Okay[0] && pilot.stress <= s.Okay[1]) return 'Okay';
    if (pilot.stress >= s.Shaken[0] && pilot.stress <= s.Shaken[1]) return 'Shaken';
    return 'Unfit';
}

function getXpToPromote(pilot) {
    const rs = getPilotRankStats(pilot);
    return rs ? rs.stats.XP : null;
}

function getMaxStress(pilot) {
    const rs = getPilotRankStats(pilot);
    return rs ? rs.stats.Shaken[1] : '?';
}

function getNextRank(rank) {
    const idx = RANKS.indexOf(rank);
    if (idx < 0 || idx >= RANKS.length - 1) return null;
    return RANKS[idx + 1];
}

function updatePilotForRank(pilot, resetStress) {
    const pd = gameData.Pilots.find(p => p.Name === pilot.name);
    pilot.hasStats = !!(pd && pd.Stats);
    const rs = getPilotRankStats(pilot);
    if (rs) pilot.cooldown = rs.stats.Cooldown;
    if (resetStress) {
        pilot.stress = 0;
        pilot.xp = 0;
    }
}

function promoteIfReady(pilot) {
    const xpNeeded = getXpToPromote(pilot);
    if (xpNeeded !== null && pilot.xp >= xpNeeded) {
        const nextRank = getNextRank(pilot.rank);
        if (nextRank) {
            pilot.rank = nextRank;
            updatePilotForRank(pilot, false);
            pilot.xp = 0;
        }
    }
}

function recoverPilots(filter) {
    campaign.squadron.forEach((pilot, idx) => {
        if (pilot.shotDown) return;
        if (filter && !filter(pilot, idx)) return;
        pilot.stress = Math.max(0, pilot.stress - (pilot.cooldown + 2));
    });
}

// Collect all assigned pilot indices across all targets in a day
function getDayDeployedSet(m) {
    const set = new Set();
    m.targets.forEach(t => {
        (t.assignedPilots || []).forEach(ap => set.add(ap.pilotIdx));
    });
    return set;
}

// Collect all assignedPilots across all targets in a day as flat array
function getDayAllAssigned(m) {
    const all = [];
    m.targets.forEach(t => {
        (t.assignedPilots || []).forEach(ap => all.push(ap));
    });
    return all;
}

// Check if any shot-down pilots in a day still need SAR
function hasPendingSAR(m) {
    return m.targets.some(t =>
        t.resolved && (t.assignedPilots || []).some(ap => ap.shotDown && ap.sarResult === '')
    );
}

// ─── Campaign State ───

function applySOAdjust(totalSO, diffRules, lengthIdx) {
    if (diffRules.reducedSOs)  totalSO -= SO_ADJUST[lengthIdx] || 6;
    if (diffRules.increasedSOs) totalSO += SO_ADJUST[lengthIdx] || 6;
    return totalSO;
}

function createEmptyTarget() {
    return { targetNumber: '', dayNight: 'Day', vp: '', recon: '', intel: '', infra: '', baseStress: '', assignedPilots: [], result: '', resolved: false };
}

function createTargetWithNumber(targetNumber, scenarioIdx) {
    const t = createEmptyTarget();
    t.targetNumber = String(targetNumber);
    const entry = getTargetEntry(targetNumber);
    if (entry && entry.destroyedRewards) {
        const r = entry.destroyedRewards;
        t.vp = r.vp || 0;
        t.recon = r.recon || 0;
        t.intel = r.intel || 0;
        t.infra = r.infra || 0;
    }
    // Band-based stress
    const scenario = gameData.Campaigns[scenarioIdx];
    const targets = scenario.Targets;
    if (targets && targets.length && typeof targets[0] === 'object' && targets[0].Band) {
        const num = String(targetNumber);
        for (const band of targets) {
            if (band.TargetNumbers.map(String).includes(num)) {
                t.baseStress = band.Stress;
                break;
            }
        }
    }
    return t;
}

function isUSMC(campaignOrName) {
    const name = typeof campaignOrName === 'string'
        ? campaignOrName
        : (campaignOrName.scenarioName || campaignOrName.Name || '');
    return name.includes('(USMC)');
}

const RANDOM_SO_BONUS = [6, 12, 18]; // Short / Medium / Long
const FLYING_MORE_LESS_SO_COST = [3, 6, 9]; // Short / Medium / Long

function buildCampaign(scenarioIdx, lengthIdx, squadron, diffRules, opts = {}) {
    const scenario = gameData.Campaigns[scenarioIdx];
    const option = scenario.CampaignOptions[lengthIdx];
    const aircraftSO = calcSquadronSOCost(squadron, lengthIdx);
    const baseSO = option.SOPoints;
    const rawSO = applySOAdjust(baseSO - aircraftSO + (opts.soBonus || 0), diffRules, lengthIdx);

    // Flying More/Less SO cost
    const flyingMoreLess = !!(opts.extra && opts.extra.flyingMoreLess);
    const fmlSOCost = flyingMoreLess ? (FLYING_MORE_LESS_SO_COST[lengthIdx] || 3) : 0;
    const totalSO = rawSO - fmlSOCost;

    const daysMatch = option.Timespan.match(/(\d+)/);
    const totalDays = daysMatch ? parseInt(daysMatch[1]) : 3;

    // startInPlay: pre-fill day 1 with starting targets
    const startInPlay = (scenario.SpecialRules && scenario.SpecialRules.startInPlay) || [];
    const day1Targets = startInPlay.length > 0
        ? startInPlay.map(n => createTargetWithNumber(n, scenarioIdx))
        : [createEmptyTarget()];

    const missions = [];
    for (let i = 0; i < totalDays; i++) {
        missions.push({
            day: i + 1,
            startSO: i === 0 ? totalSO : '',
            usedSO: '',
            targets: i === 0 ? day1Targets : [createEmptyTarget()],
            recoveryApplied: false,
            rnrApplied: false,
            downTime: false
        });
    }

    // Improvements start empty — cards become active when drawn but not destroyed
    const improvements = [];

    const soBonus = opts.soBonus || 0;

    return {
        scenarioIdx, lengthIdx,
        scenarioName: scenario.Name,
        lengthDesc: option.LengthDescription,
        timespan: option.Timespan,
        baseSO, aircraftSO, soBonus, totalSO,
        squadron, missions,
        tracks: { recon: 0, intel: 0, infra: 0 },
        improvements,
        diffRules: diffRules || { level: 'average' },
        isUSMC: parseCampaign(scenario).force === 'USMC',
        largeDeckMarine: false,
        flyingMoreLess: flyingMoreLess,
        vpAircraftBonus: 0,
        ...opts.extra,
        createdAt: new Date().toISOString()
    };
}

function createCampaign(scenarioIdx, lengthIdx, selectedAircraft, diffRules, extraOpts = {}) {
    const scenario = gameData.Campaigns[scenarioIdx];
    const option = scenario.CampaignOptions[lengthIdx];
    const randomBonus = RANDOM_SO_BONUS[lengthIdx] || 6;

    let bestSquadron;
    for (let attempt = 0; attempt < 100; attempt++) {
        bestSquadron = generateSquadron(scenario, option, selectedAircraft);
        const aircraftSO = calcSquadronSOCost(bestSquadron, lengthIdx);
        const totalSO = applySOAdjust(option.SOPoints - aircraftSO + randomBonus, diffRules, lengthIdx);
        if (totalSO >= 0) break;
    }

    campaign = buildCampaign(scenarioIdx, lengthIdx, bestSquadron, diffRules, { soBonus: randomBonus, extra: extraOpts });
    return campaign;
}

// Migrate old campaign format
function migrateCampaign(c) {
    c.missions.forEach(m => {
        // v1: flat targetNumber/dayNight fields
        if (!('targets' in m)) {
            m.targets = [{ targetNumber: m.targetNumber || '', dayNight: m.dayNight || 'Day', vp: '', assignedPilots: [] }];
            delete m.targetNumber;
            delete m.dayNight;
            delete m.targetStatus;
        }
        // v2: assignedPilots on mission level → move to first target
        if ('assignedPilots' in m && Array.isArray(m.assignedPilots)) {
            if (m.targets[0] && !m.targets[0].assignedPilots) {
                m.targets[0].assignedPilots = m.assignedPilots;
            }
            delete m.assignedPilots;
        }
        // v3: result/resolved on mission level → move to each target
        if ('result' in m && typeof m.result === 'string') {
            const oldResult = m.result;
            const oldResolved = m.resolved || false;
            m.targets.forEach(t => {
                if (!('result' in t)) t.result = oldResult;
                if (!('resolved' in t)) t.resolved = oldResolved;
            });
            delete m.result;
            delete m.resolved;
        }
        // Ensure all targets have required fields
        m.targets.forEach(t => {
            if (!t.assignedPilots) t.assignedPilots = [];
            if (!('result' in t)) t.result = '';
            if (!('resolved' in t)) t.resolved = false;
            if (!('baseStress' in t)) t.baseStress = '';
            if (!('recon' in t)) t.recon = '';
            if (!('intel' in t)) t.intel = '';
            if (!('infra' in t)) t.infra = '';
            t.assignedPilots.forEach(ap => {
                if (!('missionXp' in ap)) ap.missionXp = 0;
                if (ap.shotDown && !('sarResult' in ap)) ap.sarResult = '';
            });
        });
        if (!('recoveryApplied' in m)) m.recoveryApplied = false;
        if (!('rnrApplied' in m)) m.rnrApplied = false;
        if (!('downTime' in m)) m.downTime = false;
        if (!('collapsed' in m)) m.collapsed = false;
    });
    if (!c.diffRules) c.diffRules = { level: 'average' };
    if (!('isUSMC' in c)) c.isUSMC = (c.scenarioName || '').includes('(USMC)');
    if (!('largeDeckMarine' in c)) c.largeDeckMarine = false;
    if (!('flyingMoreLess' in c)) c.flyingMoreLess = false;
    if (!('vpAircraftBonus' in c)) c.vpAircraftBonus = 0;
    if (!c.improvements) c.improvements = [];
    return c;
}

// ─── Dashboard ───

function showDashboard() {
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    document.getElementById('campaign-title').textContent =
        `${campaign.scenarioName} - ${campaign.lengthDesc}${campaign.campaignFailed ? ' [캠페인 패배]' : ''}`;
    // Hide reroll button for manually selected squadrons or if any mission is resolved
    const anyResolved = campaign.missions.some(m => m.targets.some(t => t.resolved) || m.downTime);
    document.getElementById('reroll-btn').style.display = (campaign.manualSquadron || anyResolved) ? 'none' : '';
    renderAll();
}

function renderAll() {
    renderMissions();
    renderSquadron();
    renderSummary();
    updateBadges();
    renderTracks();
    renderImprovements();
}

// ─── Squadron Rendering ───

// ─── Carrier Board Slot Definitions (% coordinates) ───
const CARRIER_SLOTS = {
    // USMC marine (Band) slots
    marine1: { top: 24.5, left: 2.6, w: 5.5, h: 12.5 },
    marine2: { top: 17.0, left: 9.2, w: 5.5, h: 12.5 },
    marine3: { top: 12.0, left: 16.1, w: 5.5, h: 12.5 },
    marine4: { top: 11.5, left: 23.0, w: 5.5, h: 12.5 },
    marine5: { top: 11.5, left: 30.0, w: 5.5, h: 12.5 },
    hangar1: { top: 23.9, left: 43.8, w: 5.0, h: 11.0 },
    hangar2: { top: 23.9, left: 49.6, w: 5.0, h: 11.0 },
    hangar3: { top: 23.9, left: 55.5, w: 5.0, h: 11.0 },
    hangar4: { top: 23.9, left: 61.7, w: 5.0, h: 11.0 },
    hangar5: { top: 12.0, left: 68.0, w: 5.0, h: 11.0 },
    hangar6: { top: 23.9, left: 74.3, w: 5.0, h: 11.0 },
    deck1:  { top: 65.9, left: 9.8,  w: 5.0, h: 11.0 },
    deck2:  { top: 65.9, left: 17.1, w: 5.0, h: 11.0 },
    deck3:  { top: 65.9, left: 28.6, w: 5.0, h: 11.0 },
    deck4:  { top: 65.9, left: 34.6, w: 5.0, h: 11.0 },
    deck5:  { top: 65.9, left: 41.0, w: 5.0, h: 11.0 },
    deck6:  { top: 65.9, left: 47.0, w: 5.0, h: 11.0 },
    deck7:  { top: 65.9, left: 54.2, w: 5.0, h: 11.0 },
    deck8:  { top: 77.8, left: 64.5, w: 5.0, h: 11.0 },
    deck9:  { top: 39.5, left: 82.6, w: 5.0, h: 11.0 },
    deck10: { top: 65.9, left: 85.9, w: 5.0, h: 11.0 },
    deck11: { top: 51.0, left: 68.5, w: 5.0, h: 11.0 },
    // USN diamond slots (top vertex coordinates, rotated 45deg squares)
    diamond1: { topVertex: 44.4, leftVertex: 37.2, s: 5.5, diamond: true },
    diamond2: { topVertex: 57.2, leftVertex: 39.5, s: 5.5, diamond: true },
    diamond3: { topVertex: 50.6, leftVertex: 48.2, s: 5.5, diamond: true },
    diamond4: { topVertex: 65.2, leftVertex: 63.5, s: 5.5, diamond: true },
    diamond5: { topVertex: 73.8, leftVertex: 68.0, s: 5.5, diamond: true },
    // USN hangar (Shaken/Unfit) slots
    usn_hangar1: { top: 14.1, left: 38.8, w: 5.5, h: 5.5 },
    usn_hangar2: { top: 14.1, left: 48.4, w: 5.5, h: 5.5 },
    usn_hangar3: { top: 14.1, left: 58.1, w: 5.5, h: 5.5 },
    usn_hangar4: { top: 14.1, left: 67.8, w: 5.5, h: 5.5 },
    usn_hangar5: { top: 14.1, left: 77.5, w: 5.5, h: 5.5 },
    // USN normal deck slots
    usn_deck1: { top: 38.2, left: 43.8, w: 5.5, h: 5.5 },
    usn_deck2: { top: 38.2, left: 49.7, w: 5.5, h: 5.5 },
    usn_deck3: { top: 38.2, left: 56.0, w: 5.5, h: 5.5 },
    usn_deck4: { top: 38.2, left: 75.7, w: 5.5, h: 5.5 },
    usn_deck5: { top: 39.0, left: 81.6, w: 5.5, h: 5.5 },
    usn_deck6: { top: 76.1, left: 76.4, w: 5.5, h: 5.5 },
    usn_deck7: { top: 69.4, left: 84.2, w: 5.5, h: 5.5 },
    usn_deck8: { top: 69.4, left: 89.9, w: 5.5, h: 5.5 },
};

// ─── DEV: Carrier click coordinate helper (remove later) ───
(function() {
    const board = document.getElementById('carrier-board');
    if (!board) return;
    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:fixed;padding:4px 8px;background:rgba(0,0,0,0.85);color:#0f0;font:12px monospace;pointer-events:none;z-index:9999;display:none;border-radius:3px;';
    document.body.appendChild(tooltip);

    board.addEventListener('mousemove', e => {
        const img = board.querySelector('.carrier-img');
        const rect = img.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const yPct = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        tooltip.textContent = `top: ${yPct}%  left: ${xPct}%`;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY + 12) + 'px';
    });
    board.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    board.addEventListener('click', e => {
        const img = board.querySelector('.carrier-img');
        const rect = img.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const yPct = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        console.log(`{ top: ${yPct}, left: ${xPct} }`);
    });
})();

function renderCarrierMarkers() {
    const board = document.getElementById('carrier-board');
    if (!campaign) { board.style.display = 'none'; return; }
    board.style.display = '';

    // Set carrier image based on force
    const carrierImg = document.getElementById('carrier-img');
    carrierImg.src = campaign.isUSMC ? '../assets/HL/usmc_carrier.png' : '../assets/HL/usn_carrier.png';

    // Clear existing markers
    board.querySelectorAll('.carrier-marker').forEach(el => el.remove());

    // USMC: Place Band (active/secure) markers
    if (campaign.isUSMC) {
        const bandStatus = getBandStatusForCampaign();
        const marineKeys = ['marine1', 'marine2', 'marine3', 'marine4', 'marine5'];
        bandStatus.forEach((bs, i) => {
            const slot = CARRIER_SLOTS[marineKeys[i]];
            if (!slot) return;
            let imgSrc = null;
            if (bs.secured) {
                imgSrc = '../assets/HL/secure.png';
            } else if (i === 0 || bandStatus[i - 1].secured) {
                imgSrc = '../assets/HL/active.png';
            }
            if (!imgSrc) return;
            const marker = document.createElement('img');
            marker.className = 'carrier-marker';
            marker.src = imgSrc;
            marker.style.cssText = `position:absolute;top:${slot.top}%;left:${slot.left}%;width:${slot.w}%;height:${slot.h}%;`;
            board.appendChild(marker);
        });
    }

    // Aircraft to counter image mapping
    const AIRCRAFT_IMG = {
        'F/A-18C': 'f18.png', 'F/A-18E': 'f18.png', 'F/A-18F': 'f18.png',
        'F-14': 'f14.png', 'EA-6B': 'ea6b.png', 'EA-18G': 'ea6b.png',
        'E-2C': 'e2c.png', 'F-35A/C': 'f35.png', 'AV-8B': 'av8b.png',
        'A-6': 'a6.png', 'A-7': 'a7.png',
    };

    function placePilotMarker(pilot, slotKey) {
        const slot = CARRIER_SLOTS[slotKey];
        if (!slot) return;
        const status = getStatus(pilot);
        const imgFile = AIRCRAFT_IMG[pilot.aircraft];
        const el = document.createElement('div');
        el.className = 'carrier-marker carrier-pilot-marker' + (slot.diamond ? ' carrier-diamond' : '') + (campaign.isUSMC ? '' : ' carrier-usn');
        el.title = `${pilot.name} (${pilot.aircraft}) — ${status}`;
        if (imgFile) {
            el.style.backgroundImage = `url('../assets/HL/${imgFile}')`;
        }
        el.innerHTML = `<span class="cpm-name">${pilot.name}</span><span class="cpm-status cpm-${status.toLowerCase()}">${status}</span>`;
        if (slot.diamond) {
            const half = slot.s / 2;
            el.style.cssText += `position:absolute;top:${slot.topVertex + half}%;left:${slot.leftVertex - half}%;width:${slot.s}%;transform:rotate(45deg);`;
        } else {
            el.style.cssText += `position:absolute;top:${slot.top}%;left:${slot.left}%;width:${slot.w}%;`;
        }
        board.appendChild(el);
    }

    // Place Shaken/Unfit pilot counters in hangar slots
    const hangarKeys = campaign.isUSMC
        ? ['hangar1', 'hangar2', 'hangar3', 'hangar4', 'hangar5', 'hangar6']
        : ['usn_hangar1', 'usn_hangar2', 'usn_hangar3', 'usn_hangar4', 'usn_hangar5'];
    const shakenUnfit = campaign.squadron.filter(p =>
        !p.shotDown && (getStatus(p) === 'Shaken' || getStatus(p) === 'Unfit')
    );
    shakenUnfit.forEach((pilot, i) => {
        if (i >= hangarKeys.length) return;
        placePilotMarker(pilot, hangarKeys[i]);
    });

    // Place Okay pilot counters on deck slots (USMC vs USN)
    const deckKeys = campaign.isUSMC
        ? ['deck1','deck2','deck3','deck4','deck5','deck6','deck7','deck8','deck9','deck10','deck11']
        : ['usn_deck1','usn_deck2','usn_deck3','usn_deck4','usn_deck5','usn_deck6','usn_deck7','usn_deck8',
           'diamond1','diamond2','diamond3','diamond4','diamond5'];
    const okayPilots = campaign.squadron.filter(p =>
        !p.shotDown && getStatus(p) === 'Okay'
    );
    okayPilots.forEach((pilot, i) => {
        if (i >= deckKeys.length) return;
        placePilotMarker(pilot, deckKeys[i]);
    });
}

function renderSquadron() {
    renderCarrierMarkers();

    const tbody = document.getElementById('squadron-body');
    tbody.innerHTML = '';

    campaign.squadron.forEach((pilot, idx) => {
        const status = pilot.shotDown ? 'MIA' : getStatus(pilot);
        const xpNeeded = getXpToPromote(pilot);
        const maxStress = getMaxStress(pilot);
        const noStats = pilot.hasStats ? '' : ' no-stats';
        const tr = document.createElement('tr');

        if (pilot.shotDown || status === 'Unfit') tr.classList.add('pilot-unfit');

        tr.innerHTML = `
            <td class="pilot-name${noStats}">${pilot.name}</td>
            <td class="pilot-aircraft">${pilot.aircraft}</td>
            <td class="${RANK_CLASSES[pilot.rank] || ''} rank-cell" data-idx="${idx}">${pilot.rank}</td>
            <td class="status-${pilot.shotDown ? 'unfit' : status.toLowerCase()}">${status}</td>
            <td class="stress-cell">
                <div class="inline-control">
                    <button class="arrow-btn arrow-down" data-idx="${idx}" data-action="stress-down">&#9660;</button>
                    <span class="stress-val">${pilot.stress}</span><span class="stress-max">/${maxStress}</span>
                    <button class="arrow-btn arrow-up" data-idx="${idx}" data-action="stress-up">&#9650;</button>
                </div>
            </td>
            <td class="xp-cell">
                <div class="inline-control">
                    <button class="arrow-btn arrow-down" data-idx="${idx}" data-action="xp-down">&#9660;</button>
                    <div class="xp-bar-wrap">
                        <div class="xp-bar-track">
                            <div class="xp-bar-fill" style="width:${xpNeeded ? Math.min(100, (pilot.xp / xpNeeded) * 100) : 0}%"></div>
                        </div>
                        <span class="xp-bar-label">${pilot.xp}${xpNeeded !== null ? '/' + xpNeeded : ''}</span>
                    </div>
                    <button class="arrow-btn arrow-up" data-idx="${idx}" data-action="xp-up">&#9650;</button>
                </div>
            </td>
            <td class="cooldown-val">${pilot.cooldown}</td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.arrow-btn').forEach(btn =>
        btn.addEventListener('click', onArrowClick));
    tbody.querySelectorAll('.rank-cell').forEach(cell =>
        cell.addEventListener('click', () => cycleRank(parseInt(cell.dataset.idx))));
}

function onArrowClick(e) {
    const idx = parseInt(e.target.dataset.idx);
    const action = e.target.dataset.action;
    const pilot = campaign.squadron[idx];

    switch (action) {
        case 'stress-up':
            pilot.stress += 1;
            break;
        case 'stress-down':
            pilot.stress = Math.max(0, pilot.stress - 1);
            break;
        case 'xp-up':
            pilot.xp += 1;
            promoteIfReady(pilot);
            break;
        case 'xp-down':
            pilot.xp = Math.max(0, pilot.xp - 1);
            break;
    }
    renderAll();
    autoSave();
}

function cycleRank(idx) {
    const pilot = campaign.squadron[idx];
    const ci = RANKS.indexOf(pilot.rank);
    pilot.rank = RANKS[(ci + 1) % RANKS.length];
    updatePilotForRank(pilot, true);
    renderAll();
    autoSave();
}

// ─── Mission Day Rendering ───

// Track open assign panels and staging keyed by "dayIdx-tIdx"
let openAssignPanels = new Set();
let assignStaging = {};

function resetAssignState() {
    openAssignPanels = new Set();
    assignStaging = {};
}

// ─── Trait Tooltips ───
const TRAIT_TOOLTIPS = [
    { match: 'Bandit',        tip: '표적 지역 상공의 턴이 시작할 때마다, 지정된 수의 적기 카운터를 뽑아 중앙 구역에 배치합니다.' },
    { match: 'Dispersed',     tip: '각 AtG 카운터는 표적에 최대 1회의 명중만 가할 수 있습니다.' },
    { match: 'Fixed',         tip: 'JDAM 무장은 1999~2008 기간에는 고정 표적에만 공격할 수 있습니다.' },
    { match: 'Friendly Fire', tip: '표적 지역 상공에서 소모한 AtG 카운터 중 명중/제압에 실패한 카운터마다, 공격한 조종사에게 스트레스 1을 가합니다.' },
    { match: 'Hardened',      tip: 'AtG 카운터가 표적에 가한 명중에서 1을 뺍니다.' },
    { match: 'Improvement',   tip: '표적 카드를 뽑을 때 활성화됩니다. 파괴될 때까지 효과가 적용되며, 선택하지 않아도 카드를 버리지 않습니다. 파괴될 때까지 임무 선택에 계속 사용 가능합니다.' },
    { match: 'OVERKILL',      tip: '표적에 지정된 수의 명중을 가하면 적혀있는 보너스를 얻습니다.' },
    { match: 'Overkill',      tip: '표적에 지정된 수의 명중을 가하면 적혀있는 보너스를 얻습니다.' },
    { match: 'Objective',     tip: '지정된 카운터를 중앙 구역에 배치합니다. 표적을 파괴하려면 이 카운터들을 파괴해야 합니다. 중앙 구역의 다른 카운터들은 파괴할 필요 없습니다.' },
    { match: 'Penalty',       tip: '이 카드를 임무로 선택하고 표적을 파괴하지 못하면 적혀 있는 패널티를 받습니다. "캠페인 종료" 패널티 시 형편없는(Dismal) 평가로 캠페인이 종료됩니다.' },
    { match: 'Scramble',      tip: '이 카드를 한 장이라도 뽑으면 즉시 표적 카드 뽑기를 중단합니다. 이 카드를 그 날의 주요 임무로 반드시 선택해야 합니다.' },
    { match: 'Secondary',     tip: '주요 임무와 동시에 보조 임무를 수행할 수 있습니다. 한 조종사는 주요 또는 보조 중 하나만 수행 가능합니다. 주요 임무 해결 후 보조 표적의 사이트를 결정합니다.' },
    { match: 'Small',         tip: '표적에 대한 모든 AtG 주사위 굴림에서 1을 뺍니다.' },
    { match: 'Soft',          tip: '일부 무장은 취약 표적을 공격할 때 보너스를 받습니다.' },
    { match: 'Stress',        tip: '임무 종료 시, 임무를 수행한 각 조종사에게 적혀 있는 수치만큼 스트레스 포인트를 더하거나 뺍니다.' },
    { match: 'Vehicle',       tip: '일부 무장은 차량 표적을 공격할 때 보너스를 받습니다.' },
    { match: 'VP',            tip: '표적을 파괴하면, 일반 효과 외 적혀 있는 보너스를 받습니다.' },
];

function getTraitTooltip(trait) {
    const entry = TRAIT_TOOLTIPS.find(t => trait.includes(t.match));
    return entry ? entry.tip : '';
}

function panelKey(dayIdx, tIdx) { return `${dayIdx}-${tIdx}`; }

function getTargetEntry(targetNumber) {
    if (!targetData || !targetNumber) return null;
    const num = String(targetNumber).replace(/^0+/, '');
    return targetData.find(d => d.cardNumber.replace(/^0+/, '') === num) || null;
}

function getTargetAircraftCount(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    let count = entry ? entry.aircraftCount : Infinity;
    if (campaign && campaign.largeDeckMarine && count !== Infinity) {
        count = Math.max(1, count - 1);
    }
    return count;
}

function getTargetCampaignDetails(targetNumber) {
    if (!targetNumber || !campaign) return null;
    // First try band-based data from hl.json
    const bandInfo = getTargetBandInfo(targetNumber);
    // Then try per-card campaignDetails from hl_target.json
    const entry = getTargetEntry(targetNumber);
    const cardDetail = (() => {
        if (!entry || !entry.campaignDetails) return null;
        const scenarioName = campaign.scenarioName || '';
        for (const key of Object.keys(entry.campaignDetails)) {
            if (scenarioName.includes(key)) return entry.campaignDetails[key];
        }
        return null;
    })();
    if (!bandInfo && !cardDetail) return null;
    // Band info takes priority (scenario-specific), card detail as fallback
    return {
        wp: bandInfo ? bandInfo.WP : (cardDetail ? cardDetail.wp : null),
        baseStress: bandInfo ? bandInfo.Stress : (cardDetail ? cardDetail.baseStress : null),
        bonusXP: bandInfo ? (bandInfo.BonusXP || 0) : 0
    };
}

function getTargetBandInfo(targetNumber) {
    if (!campaign || !gameData) return null;
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    const targets = scenario.Targets;
    if (!targets || !targets.length || typeof targets[0] !== 'object' || !targets[0].Band) return null;
    const num = String(targetNumber);
    for (const band of targets) {
        if (band.TargetNumbers.map(String).includes(num)) return band;
    }
    return null;
}

function getInfraHitsModifier() {
    if (!campaign || !gameData) return 0;
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    if (!scenario || !scenario.Infra) return 0;
    const infraTrack = (campaign.tracks && campaign.tracks.infra) || 0;
    const infraArr = scenario.Infra;
    if (infraTrack >= infraArr.length) return infraArr[infraArr.length - 1];
    return infraArr[infraTrack];
}

function getTargetHits(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    if (!entry || !entry.hits) return null;
    const baseHits = parseInt(entry.hits) || 0;
    const modifier = getInfraHitsModifier();
    const impExtra = getImprovementExtraHits(targetNumber);
    return Math.max(1, baseHits + modifier + impExtra);
}

// ─── Improvement Effects ───

function getActiveImprovements() {
    if (!campaign || !campaign.improvements) return [];
    return campaign.improvements.filter(i => i.active);
}

function getImprovementWPPenalty() {
    return getActiveImprovements().filter(i =>
        /Increase the Weight Point penalty/i.test(i.text)
    ).length;
}

function getImprovementExtraHits(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    if (!entry) return 0;
    const name = (entry.targetName || '').toLowerCase();
    let extra = 0;
    getActiveImprovements().forEach(imp => {
        // "All Targets require 1 extra Hit to destroy"
        if (/All Targets require (\d+) extra Hit/i.test(imp.text)) {
            extra += parseInt(imp.text.match(/(\d+) extra Hit/i)[1]);
        }
        // "Tanks" and "Troops" require N extra hits
        if (/Tanks.*Troops.*require (\d+) extra hit/i.test(imp.text)) {
            if (name.includes('tank') || name.includes('troop')) {
                extra += parseInt(imp.text.match(/require (\d+) extra hit/i)[1]);
            }
        }
        // "Fleets" require an extra N Hits
        if (/Fleets.*require.*extra (\d+) Hit/i.test(imp.text)) {
            if (name.includes('fleet')) {
                extra += parseInt(imp.text.match(/extra (\d+) Hit/i)[1]);
            }
        }
    });
    return extra;
}

function applyDailyImprovementEffects() {
    if (!campaign || !campaign.improvements) return;
    const active = getActiveImprovements();
    active.forEach(imp => {
        const t = imp.text;
        // Move Infra counter 1 to the left
        if (/Move the Infra counter 1 to the left/i.test(t)) {
            campaign.tracks.infra = Math.max(0, campaign.tracks.infra - 1);
        }
        // Move Intel counter 1 to the left
        if (/Move the Intel counter 1 to the left/i.test(t)) {
            campaign.tracks.intel = Math.max(0, campaign.tracks.intel - 1);
        }
        // Move Recon counter 1 to the left
        if (/Move the Recon counter 1 to the left/i.test(t)) {
            campaign.tracks.recon = Math.max(0, campaign.tracks.recon - 1);
        }
        // Move any 1 Campaign counter 1 to the left (auto: pick lowest non-zero)
        if (/Move to any 1 Campaign counter 1 to the left/i.test(t)) {
            const types = ['recon', 'intel', 'infra'];
            // Pick the one with highest value to minimize harm
            const sorted = types.filter(k => campaign.tracks[k] > 0).sort((a, b) => campaign.tracks[b] - campaign.tracks[a]);
            if (sorted.length > 0) {
                campaign.tracks[sorted[0]] = Math.max(0, campaign.tracks[sorted[0]] - 1);
            }
        }
        // Lose 1 VP at end of each day
        if (/lose (\d+) VP/i.test(t)) {
            const vpLoss = parseInt(t.match(/lose (\d+) VP/i)[1]);
            campaign.vpPenalty = (campaign.vpPenalty || 0) + vpLoss;
        }
    });
}

function getSpecialRules() {
    if (!campaign || !gameData) return {};
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    return (scenario && scenario.SpecialRules) || {};
}

function getScenarioTargetNumbers() {
    if (!campaign || !gameData) return [];
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    const targets = scenario.Targets;
    if (!targets || !targets.length) return [];
    if (typeof targets[0] === 'object' && targets[0].Band) {
        return targets.flatMap(band => band.TargetNumbers);
    }
    return targets;
}

function getScenarioBands() {
    if (!campaign || !gameData) return [];
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    const targets = scenario.Targets;
    if (!targets || !targets.length) return [];
    if (typeof targets[0] === 'object' && targets[0].Band) {
        return targets.sort((a, b) => a.Band - b.Band);
    }
    return [];
}

function getBandStatusForCampaign() {
    const bands = getScenarioBands();
    if (!bands.length) return [];
    const destroyed = getDestroyedTargets();
    return bands.map(band => {
        const total = band.TargetNumbers.length;
        const destroyedCount = band.TargetNumbers.filter(n => destroyed.has(String(n))).length;
        const secured = destroyedCount >= Math.ceil(total / 2);
        return { band: band.Band, secured, destroyedCount, total, targetNumbers: band.TargetNumbers };
    });
}

function getUnlockedTargetNumbers() {
    if (!campaign || !campaign.isUSMC) return getScenarioTargetNumbers();
    const bandStatus = getBandStatusForCampaign();
    if (!bandStatus.length) return getScenarioTargetNumbers();

    const unlocked = [];
    for (let i = 0; i < bandStatus.length; i++) {
        if (i === 0) {
            // Band 1 is always unlocked
            unlocked.push(...bandStatus[i].targetNumbers);
        } else if (bandStatus[i - 1].secured) {
            // Unlock if previous band is secured
            unlocked.push(...bandStatus[i].targetNumbers);
        } else {
            break;
        }
    }
    return unlocked;
}

function isE2C(pilot) {
    return pilot && pilot.aircraft === 'E-2C';
}

function getDestroyedTargets() {
    const destroyed = new Set();
    if (!campaign) return destroyed;
    campaign.missions.forEach(m => {
        (m.targets || []).forEach(t => {
            if (t.resolved && t.result === 'Destroyed' && t.targetNumber) {
                destroyed.add(String(t.targetNumber));
            }
        });
    });
    return destroyed;
}

function getDayUsedTargets(dayIdx, excludeTIdx) {
    const used = new Set();
    if (!campaign) return used;
    const m = campaign.missions[dayIdx];
    if (!m) return used;
    m.targets.forEach((t, i) => {
        if (i !== excludeTIdx && t.targetNumber) {
            used.add(String(t.targetNumber));
        }
    });
    return used;
}

function buildTargetNumberField(currentValue, dayIdx, tIdx) {
    const targetNumbers = getUnlockedTargetNumbers();
    if (targetNumbers.length > 0) {
        const destroyed = getDestroyedTargets();
        const dayUsed = getDayUsedTargets(dayIdx, tIdx);
        const options = targetNumbers.map(n => {
            const ns = String(n);
            const isCurrent = ns === String(currentValue);
            if ((destroyed.has(ns) || dayUsed.has(ns)) && !isCurrent) return '';
            const bandLabel = campaign.isUSMC ? (() => { const bi = getTargetBandInfo(ns); return bi ? ` [${bi.Band}구간]` : ''; })() : '';
            return `<option value="${n}"${isCurrent ? ' selected' : ''}>${n}${bandLabel}</option>`;
        }).join('');
        return `<select data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="targetNumber">
            <option value="">--</option>${options}</select>`;
    }
    return `<input type="text" value="${currentValue}" data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="targetNumber">`;
}

function renderBandProgress() {
    const container = document.getElementById('mission-days');
    if (!campaign || !campaign.isUSMC) return;
    const bandStatus = getBandStatusForCampaign();
    if (!bandStatus.length) return;

    const div = document.createElement('div');
    div.className = 'band-progress';
    div.innerHTML = '<span class="band-progress-label">구역 진행</span>';
    bandStatus.forEach((bs, i) => {
        const isUnlocked = i === 0 || bandStatus[i - 1].secured;
        let statusClass, statusText;
        if (bs.secured) {
            statusClass = 'band-secured';
            statusText = '확보';
        } else if (isUnlocked) {
            statusClass = 'band-active';
            statusText = '작전중';
        } else {
            statusClass = 'band-locked';
            statusText = '잠김';
        }
        const badge = document.createElement('span');
        badge.className = `band-badge ${statusClass}`;
        const needed = Math.ceil(bs.total / 2);
        badge.innerHTML = `Band ${bs.band} <small>${bs.destroyedCount}/${bs.total}</small> <em>${statusText}</em>`;
        badge.title = `필요 파괴 수: ${needed} / ${bs.total}`;
        div.appendChild(badge);
    });
    container.appendChild(div);
}

function renderMissions() {
    const container = document.getElementById('mission-days');
    container.innerHTML = '';

    renderBandProgress();

    campaign.missions.forEach((m, dayIdx) => {
        const allResolved = m.targets.every(t => t.resolved);
        const isComplete = (allResolved && m.recoveryApplied) || m.downTime;
        const isCollapsed = m.collapsed && isComplete;
        const div = document.createElement('div');
        div.className = 'mission-day' + (isComplete ? ' resolved' : '') + (isCollapsed ? ' collapsed' : '');

        // Header
        const header = document.createElement('div');
        header.className = 'day-header';
        const rules = getSpecialRules();
        const freeSO = rules.freeSOPerDay || 0;
        header.innerHTML = `
            <span class="day-num">${m.day}일차${m.downTime ? ' (Down Time)' : ''}</span>
            <div class="tgt-field"><span class="tgt-field-label">시작 SO</span>
                <input type="number" value="${m.startSO}" data-day="${dayIdx}" data-field="startSO" ${m.recoveryApplied || m.downTime ? 'readonly' : ''}></div>
            <div class="tgt-field"><span class="tgt-field-label">사용 SO</span>
                <input type="number" value="${m.usedSO}" data-day="${dayIdx}" data-field="usedSO" ${m.downTime ? 'readonly' : ''}></div>
            ${freeSO ? `<span class="free-so-badge" title="매 작전일 특수 무장 ${freeSO} SO 무료">무료 SO ${freeSO}</span>` : ''}
            <div class="day-actions">
                ${!m.downTime && !allResolved ? `<button class="btn btn-small" data-day="${dayIdx}" data-action="add-target">표적 뽑기</button>` : ''}
                ${!m.downTime && !m.recoveryApplied && !allResolved ? `<button class="btn btn-small btn-downtime" data-day="${dayIdx}" data-action="down-time">Down Time</button>` : ''}
            </div>
            ${isComplete ? `<span class="day-collapse-indicator">${isCollapsed ? '▶ 펼치기' : '▼ 접기'}</span>` : ''}
        `;
        if (isComplete) {
            header.addEventListener('click', e => {
                if (e.target.closest('input, button, select')) return;
                m.collapsed = !m.collapsed;
                renderMissions();
                autoSave();
            });
        }
        div.appendChild(header);

        // Down Time: skip targets, show badge
        if (m.downTime) {
            const dtDiv = document.createElement('div');
            dtDiv.className = 'day-resolve';
            dtDiv.innerHTML = `<span class="day-resolved-badge">Down Time — 전체 휴식 (Recon/Intel/Infra -1)</span>`;
            div.appendChild(dtDiv);
            container.appendChild(div);
            return;
        }

        // All deployed pilots across all targets this day (for disable check)
        const dayDeployed = getDayDeployedSet(m);

        // Targets + their assigned pilots + per-target resolve
        const targetsDiv = document.createElement('div');
        targetsDiv.className = 'day-targets';

        m.targets.forEach((t, tIdx) => {
            // Hide target block if no target number selected yet
            if (!t.targetNumber) return;

            const key = panelKey(dayIdx, tIdx);
            const pilots = t.assignedPilots || [];

            // Target block wrapper
            const tBlock = document.createElement('div');
            tBlock.className = 'target-block' + (t.resolved ? ' target-resolved' : '');

            // ── Target Card Layout ──
            const campDetail = getTargetCampaignDetails(t.targetNumber);
            const wpPenalty = getImprovementWPPenalty();
            const effectiveWP = campDetail ? campDetail.wp - wpPenalty : null;
            const wpLabel = effectiveWP != null ? `<span class="wp-badge">WP ${effectiveWP}</span>` : '';
            const hits = getTargetHits(t.targetNumber);
            const targetEntry = getTargetEntry(t.targetNumber);
            const targetName = targetEntry ? targetEntry.targetName : '';

            // 1) Header bar: 주/부 표적 label + target name + number
            const header = document.createElement('div');
            header.className = 'tc-header';
            header.innerHTML = `
                <span class="tc-type">${tIdx === 0 ? '주 표적' : '부 표적'}</span>
                <span class="tc-title">#${t.targetNumber} ${targetName}</span>
                <span class="tc-header-actions">
                    ${!t.resolved ? `<button class="btn btn-small" data-day="${dayIdx}" data-tidx="${tIdx}" data-action="toggle-assign">투입</button>` : ''}
                    ${tIdx > 0 && !t.resolved ? `<button class="target-remove" data-day="${dayIdx}" data-tidx="${tIdx}">x</button>` : ''}
                </span>
            `;
            tBlock.appendChild(header);

            // 2) Traits row
            if (targetEntry && targetEntry.traits) {
                const traitsDiv = document.createElement('div');
                traitsDiv.className = 'tc-traits';
                targetEntry.traits.split(',').forEach(trait => {
                    const text = trait.trim();
                    const tip = getTraitTooltip(text);
                    const tag = document.createElement('span');
                    tag.className = 'target-trait-tag' + (tip ? ' has-tooltip' : '');
                    tag.textContent = text;
                    if (tip) tag.dataset.tooltip = tip;
                    traitsDiv.appendChild(tag);
                });
                tBlock.appendChild(traitsDiv);
            }

            // 3) Stats grid: Day/Night, Stress, WP, Hits
            const statsRow = document.createElement('div');
            statsRow.className = 'tc-stats';
            const isNight = t.dayNight === 'Night';
            const canNight = targetEntry && targetEntry.nighttimeMission === 'true';
            statsRow.innerHTML = `
                <div class="tc-daynight ${isNight ? 'night' : 'day'}${canNight ? '' : ' no-night'}" data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="dayNight">
                    ${isNight ? '야간 작전' : '주간 작전'}
                </div>
                <div class="tc-stat-box">
                    <span class="tc-stat-label">기본 ST</span>
                    <span class="tc-stat-value">${t.baseStress || '—'}</span>
                </div>
                <div class="tc-stat-box tc-stat-wp">
                    <span class="tc-stat-label">WP</span>
                    <span class="tc-stat-value">${effectiveWP != null ? effectiveWP : '—'}</span>
                </div>
                <div class="tc-stat-box tc-stat-hits">
                    <span class="tc-stat-label">명중</span>
                    <span class="tc-stat-value">${hits != null ? hits : '—'}</span>
                </div>
            `;
            tBlock.appendChild(statsRow);

            // 4) Reward boxes: VP, Recon, Intel, Infra
            const rewardRow = document.createElement('div');
            rewardRow.className = 'tc-rewards';
            rewardRow.innerHTML = `
                <div class="tc-reward-box tc-reward-vp">
                    <span class="tc-reward-label">VP</span>
                    <span class="tc-reward-value">${t.vp || 0}</span>
                </div>
                <div class="tc-reward-box tc-reward-recon">
                    <span class="tc-reward-label">Recon</span>
                    <span class="tc-reward-value">${t.recon || 0}</span>
                </div>
                <div class="tc-reward-box tc-reward-intel">
                    <span class="tc-reward-label">Intel</span>
                    <span class="tc-reward-value">${t.intel || 0}</span>
                </div>
                <div class="tc-reward-box tc-reward-infra">
                    <span class="tc-reward-label">Infra</span>
                    <span class="tc-reward-value">${t.infra || 0}</span>
                </div>
            `;
            tBlock.appendChild(rewardRow);

            // Assigned pilots for this target
            if (pilots.length > 0) {
                const pilotsDiv = document.createElement('div');
                pilotsDiv.className = 'target-pilots';
                pilots.forEach((ap, apIdx) => {
                    const pilot = campaign.squadron[ap.pilotIdx];
                    if (!pilot) return;
                    const mStress = ap.missionStress || 0;
                    const mXp = ap.missionXp || 0;
                    const prow = document.createElement('div');
                    prow.className = 'assigned-pilot-row' + (ap.shotDown ? ' shot-down' : '');
                    prow.innerHTML = `
                        <span class="ap-name">${pilot.name}</span>
                        <span class="ap-aircraft">${pilot.aircraft}</span>${campaign.isUSMC && pilot.aircraft === 'AV-8B' ? '<span class="noe-badge" title="Nap of the Earth: 저고도 비행 시 Damaged → Stress로 처리 (이벤트 제외)">NoE</span>' : ''}
                        ${wpLabel}
                        <span class="ap-stress-section">
                            <span class="ap-stress-label">스트레스</span>
                            <span class="ap-stress-mission">
                                ${t.resolved ? `${mStress >= 0 ? '+' : ''}${mStress}` : `
                                <button class="arrow-btn arrow-down ap-arrow" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="ms-down">&#9660;</button>
                                <span class="ap-ms-val">${mStress >= 0 ? '+' : ''}${mStress}</span>
                                <button class="arrow-btn arrow-up ap-arrow" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="ms-up">&#9650;</button>
                                `}
                            </span>
                        </span>
                        <span class="ap-xp-section">
                            <span class="ap-xp-label">경험치</span>
                            <span class="ap-xp-mission">
                                ${t.resolved ? `+${mXp}` : `
                                <button class="arrow-btn arrow-down ap-arrow" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="xp-down">&#9660;</button>
                                <span class="ap-xp-val">+${mXp}</span>
                                <button class="arrow-btn arrow-up ap-arrow" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="xp-up">&#9650;</button>
                                `}
                            </span>
                        </span>
                        <span class="ap-actions">
                            ${t.resolved ? '' : `
                            <button class="btn-shotdown${ap.shotDown ? ' active' : ''}"
                                data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}">격추</button>
                            `}
                        </span>
                    `;
                    pilotsDiv.appendChild(prow);
                });
                tBlock.appendChild(pilotsDiv);
            }

            // Assign panel for this target
            if (openAssignPanels.has(key)) {
                if (!assignStaging[key]) assignStaging[key] = new Set();
                const staged = assignStaging[key];

                // Aircraft count limit (E-2C exempt)
                const acLimit = getTargetAircraftCount(t.targetNumber);
                const fmlActive = campaign.flyingMoreLess && acLimit !== Infinity;
                const effectiveLimit = fmlActive ? acLimit + 1 : acLimit;
                const existingNonE2C = (t.assignedPilots || []).filter(ap => !isE2C(campaign.squadron[ap.pilotIdx])).length;
                const stagedNonE2C = [...staged].filter(pIdx => !isE2C(campaign.squadron[pIdx])).length;
                const nonE2CCount = existingNonE2C + stagedNonE2C;
                const limitReached = nonE2CCount >= effectiveLimit;

                const panel = document.createElement('div');
                panel.className = 'assign-panel';
                if (acLimit !== Infinity) {
                    const limitInfo = document.createElement('div');
                    limitInfo.className = 'assign-limit-info';
                    let limitText = `투입: ${nonE2CCount} / ${acLimit} (E-2C 제외)`;
                    if (fmlActive) {
                        if (nonE2CCount > acLimit) {
                            limitText += ` ⚠ 초과 투입 (VP -1)`;
                        } else if (nonE2CCount < acLimit) {
                            limitText += ` ★ 감소 투입 (파괴 시 VP +1)`;
                        }
                        limitText += ` [최대 ${effectiveLimit}]`;
                    }
                    limitInfo.textContent = limitText;
                    panel.appendChild(limitInfo);
                }
                const tbl = document.createElement('table');
                tbl.className = 'assign-table';
                tbl.innerHTML = `<thead><tr>
                    <th></th><th>콜사인</th><th>기체</th><th>숙련도</th><th>스트레스</th><th>상태</th>
                </tr></thead>`;
                const tbody2 = document.createElement('tbody');
                campaign.squadron.forEach((pilot, pIdx) => {
                    const status = pilot.shotDown ? 'MIA' : getStatus(pilot);
                    const isDisabled = status === 'Unfit' || pilot.shotDown;
                    const isDeployed = dayDeployed.has(pIdx);
                    const isStaged = staged.has(pIdx);
                    const maxStress = getMaxStress(pilot);
                    const isE2CPilot = isE2C(pilot);
                    const atLimit = limitReached && !isE2CPilot && !isStaged;
                    const canSelect = !isDeployed && !(isDisabled && !isStaged) && !atLimit;

                    const tr = document.createElement('tr');
                    if (isDeployed) tr.classList.add('assign-row-deployed');
                    else if (!canSelect) tr.classList.add('assign-row-disabled');
                    if (isStaged) tr.classList.add('assign-row-selected');

                    const statusClass = pilot.shotDown ? 'unfit' : status.toLowerCase();
                    tr.innerHTML = `
                        <td class="assign-check-cell">
                            <input type="checkbox" data-day="${dayIdx}" data-tidx="${tIdx}" data-pidx="${pIdx}"
                                ${isDeployed || isStaged ? 'checked' : ''} ${!canSelect ? 'disabled' : ''}>
                        </td>
                        <td class="pilot-name">${pilot.name}</td>
                        <td class="pilot-aircraft">${pilot.aircraft}</td>
                        <td class="${RANK_CLASSES[pilot.rank] || ''}">${pilot.rank}</td>
                        <td>${pilot.stress}/${maxStress}</td>
                        <td class="status-${statusClass}">${isDeployed ? '투입됨' : status}</td>
                    `;
                    // Row click toggles checkbox
                    tr.style.cursor = canSelect ? 'pointer' : 'default';
                    tr.addEventListener('click', e => {
                        if (e.target.tagName === 'INPUT') return; // let checkbox handle itself
                        const cb = tr.querySelector('input[type="checkbox"]');
                        if (cb && !cb.disabled) {
                            cb.checked = !cb.checked;
                            cb.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });

                    tbody2.appendChild(tr);
                });
                tbl.appendChild(tbody2);
                panel.appendChild(tbl);

                const btnRow = document.createElement('div');
                btnRow.className = 'assign-btn-row';
                btnRow.innerHTML = `
                    <button class="btn btn-small btn-primary" data-day="${dayIdx}" data-tidx="${tIdx}" data-action="confirm-assign">확인</button>
                    <button class="btn btn-small" data-day="${dayIdx}" data-tidx="${tIdx}" data-action="cancel-assign">취소</button>
                `;
                panel.appendChild(btnRow);
                tBlock.appendChild(panel);
            }

            // Per-target resolve area
            const resolveDiv = document.createElement('div');
            resolveDiv.className = 'target-resolve';
            if (t.resolved) {
                resolveDiv.innerHTML = `
                    <span class="result-btn selected" data-result="${t.result}">${getResultLabel(t.result)}</span>
                    <span class="day-resolved-badge">완료</span>
                `;
            } else {
                resolveDiv.innerHTML = `
                    <button class="result-btn${t.result === 'Destroyed' ? ' selected' : ''}"
                        data-day="${dayIdx}" data-tidx="${tIdx}" data-result="Destroyed">표적 파괴</button>
                    <button class="result-btn${t.result === 'Damaged' ? ' selected' : ''}"
                        data-day="${dayIdx}" data-tidx="${tIdx}" data-result="Damaged">표적 피해</button>
                    <button class="result-btn${t.result === 'Failed' ? ' selected' : ''}"
                        data-day="${dayIdx}" data-tidx="${tIdx}" data-result="Failed">타격 실패</button>
                    ${t.result ? `<button class="btn btn-small btn-primary resolve-btn" data-day="${dayIdx}" data-tidx="${tIdx}" data-action="resolve-target">작전 종료</button>` : ''}
                `;
            }
            tBlock.appendChild(resolveDiv);

            targetsDiv.appendChild(tBlock);
        });

        div.appendChild(targetsDiv);

        // SAR phase: show for resolved targets with pending SAR
        const pendingSAR = allResolved && hasPendingSAR(m);
        if (allResolved) {
            // Collect all shot-down pilots needing SAR
            const sarPilots = [];
            m.targets.forEach((t, tIdx) => {
                if (!t.resolved) return;
                (t.assignedPilots || []).forEach((ap, apIdx) => {
                    if (ap.shotDown && ap.sarResult === '') {
                        sarPilots.push({ ap, apIdx, tIdx, pilot: campaign.squadron[ap.pilotIdx] });
                    }
                });
            });

            // Show completed SAR results
            const sarDone = [];
            m.targets.forEach(t => {
                if (!t.resolved) return;
                (t.assignedPilots || []).forEach(ap => {
                    if (ap.shotDown && ap.sarResult && ap.sarResult !== '') {
                        sarDone.push({ sarResult: ap.sarResult, sarRoll: ap.sarRoll, sarFinal: ap.sarFinal, pilot: campaign.squadron[ap.pilotIdx] });
                    }
                });
            });

            if (sarPilots.length > 0 || sarDone.length > 0) {
                const sarSection = document.createElement('div');
                sarSection.className = 'sar-section';
                sarSection.innerHTML = '<div class="sar-title">SAR (수색 및 구조)</div>';

                // Completed SAR
                sarDone.forEach(({ sarResult, sarRoll, sarFinal, pilot }) => {
                    const label = getSarResultLabel(sarResult);
                    const d = document.createElement('div');
                    d.className = 'sar-done-row';
                    d.innerHTML = `<span class="ap-name">${pilot.name}</span> — <span class="sar-result-label sar-${sarResult}">${label}</span> (주사위: ${sarRoll}, 보정 후: ${sarFinal})`;
                    sarSection.appendChild(d);
                });

                // Pending SAR
                sarPilots.forEach(({ ap, apIdx, tIdx, pilot }) => {
                    // Auto-calculate WP penalty from target's band WP
                    const sarTarget = campaign.missions[dayIdx].targets[tIdx];
                    const sarCampDetail = getTargetCampaignDetails(sarTarget.targetNumber);
                    const sarWpPenalty = sarCampDetail ? Math.abs(sarCampDetail.wp) + getImprovementWPPenalty() : 0;

                    const sarDiv = document.createElement('div');
                    sarDiv.className = 'sar-pilot-panel';

                    // Location toggle state
                    const locOptions = [
                        { value: 0, label: '표적 상공', cls: 'loc-target' },
                        { value: 2, label: '진입 구간 (+2)', cls: 'loc-approach' },
                        { value: 1, label: '귀환 구간 (+1)', cls: 'loc-return' }
                    ];
                    const curLoc = ap._sarLocation || 0;
                    const locObj = locOptions.find(o => o.value === curLoc) || locOptions[0];

                    sarDiv.innerHTML = `
                        <div class="sar-pilot-name">${pilot.name} (${pilot.aircraft})</div>
                        <div class="sar-fields">
                            <div class="sar-box ${locObj.cls}" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-loc="${curLoc}" data-role="loc">
                                <span class="sar-box-label">격추 위치</span>
                                <span class="sar-box-value">${locObj.label}</span>
                            </div>
                            <div class="sar-box sar-box-wp">
                                <span class="sar-box-label">WP 페널티</span>
                                <span class="sar-box-value">-${sarWpPenalty}</span>
                            </div>
                            <div class="sar-box sar-box-atg">
                                <span class="sar-box-label" data-tooltip="구조 작업을 지원하기 위해 현재 임무 수행 중인 다른 기체가 가진 공대지(AtG) 무장을 버릴 수 있습니다. 소모한 무장의 WP 1점당 주사위 결과에 +1을 더합니다.">공대지 무장 투하</span>
                                <span class="sar-box-stepper">
                                    <button class="sar-step-btn" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-step="-1">&#9660;</button>
                                    <span class="sar-box-value sar-atg-val" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}">${ap._sarAtgWp || 0}</span>
                                    <button class="sar-step-btn" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-step="1">&#9650;</button>
                                </span>
                            </div>
                            <button class="btn btn-small btn-primary sar-roll-btn" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="sar-roll" data-wp-penalty="${sarWpPenalty}">SAR 판정</button>
                        </div>
                    `;
                    sarSection.appendChild(sarDiv);
                });

                div.appendChild(sarSection);
            }
        }

        // End-of-day recovery (only when all targets resolved AND all SAR done)
        if (allResolved && !pendingSAR && !m.recoveryApplied) {
            const recoveryDiv = document.createElement('div');
            recoveryDiv.className = 'day-resolve';
            recoveryDiv.innerHTML = `
                <span style="color:#999; font-size:0.82rem;">모든 작전 및 SAR 완료</span>
                <button class="btn btn-small btn-primary" data-day="${dayIdx}" data-action="apply-recovery">일과 종료 (회복 적용)</button>
                ${!m.rnrApplied ? `<button class="btn btn-small" data-day="${dayIdx}" data-action="apply-rnr" title="SO 9 지불 → 전 편대 Cool+2 스트레스 회복">우선 휴식 R&R (SO 9)</button>` : '<span style="color:#5cb85c; font-size:0.78rem;">R&R 적용됨</span>'}
            `;
            div.appendChild(recoveryDiv);
        } else if (allResolved && !pendingSAR && m.recoveryApplied) {
            const doneDiv = document.createElement('div');
            doneDiv.className = 'day-resolve';
            doneDiv.innerHTML = `<span class="day-resolved-badge">일과 완료</span>`;
            div.appendChild(doneDiv);
        }

        container.appendChild(div);
    });

    // Attach events
    attachMissionEvents(container);
}

function attachMissionEvents(container) {
    container.querySelectorAll('.day-header input').forEach(el =>
        el.addEventListener('change', onDayFieldChange));
    container.querySelectorAll('[data-action="add-target"]').forEach(el =>
        el.addEventListener('click', onAddTarget));
    container.querySelectorAll('[data-action="toggle-assign"]').forEach(el =>
        el.addEventListener('click', onToggleAssign));
    container.querySelectorAll('.target-remove').forEach(el =>
        el.addEventListener('click', onRemoveTarget));
    container.querySelectorAll('.day-targets input[data-tfield], .day-targets select[data-tfield]').forEach(el =>
        el.addEventListener('change', onTargetFieldChange));
    container.querySelectorAll('.tc-daynight').forEach(el =>
        el.addEventListener('click', onToggleDayNight));
    container.querySelectorAll('.assign-panel input[type="checkbox"]').forEach(el =>
        el.addEventListener('change', onStagePilot));
    container.querySelectorAll('[data-action="confirm-assign"]').forEach(el =>
        el.addEventListener('click', onConfirmAssign));
    container.querySelectorAll('[data-action="cancel-assign"]').forEach(el =>
        el.addEventListener('click', onCancelAssign));
    container.querySelectorAll('.btn-shotdown').forEach(el =>
        el.addEventListener('click', onToggleShotDown));
    container.querySelectorAll('.ap-arrow').forEach(el =>
        el.addEventListener('click', onMissionPilotArrow));
    container.querySelectorAll('.result-btn[data-day][data-tidx]').forEach(el => {
        if (!el.classList.contains('selected')) el.addEventListener('click', onSelectResult);
    });
    container.querySelectorAll('[data-action="resolve-target"]').forEach(el =>
        el.addEventListener('click', onResolveTarget));
    container.querySelectorAll('[data-action="apply-recovery"]').forEach(el =>
        el.addEventListener('click', onApplyRecovery));
    container.querySelectorAll('[data-action="apply-rnr"]').forEach(el =>
        el.addEventListener('click', onApplyRnR));
    container.querySelectorAll('[data-action="down-time"]').forEach(el =>
        el.addEventListener('click', onDownTime));
    container.querySelectorAll('[data-action="sar-roll"]').forEach(el =>
        el.addEventListener('click', onSarRoll));
    container.querySelectorAll('.sar-box[data-role="loc"]').forEach(el =>
        el.addEventListener('click', onToggleSarLocation));
    container.querySelectorAll('.sar-step-btn').forEach(el =>
        el.addEventListener('click', onSarAtgStep));
}

function getResultLabel(result) {
    switch (result) {
        case 'Destroyed': return '표적 파괴';
        case 'Damaged': return '표적 피해';
        case 'Failed': return '타격 실패';
        default: return result;
    }
}

function getSarResultLabel(result) {
    switch (result) {
        case 'quick': return '신속 회복 (스트레스 +3)';
        case 'fire': return '포화 속 구조 (스트레스 +5)';
        case 'mia': return '작전 중 실종 (MIA)';
        default: return result;
    }
}

// ─── Mission Event Handlers ───

function onDayFieldChange(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    campaign.missions[dayIdx][e.target.dataset.field] = e.target.value;
    updateBadges();
    autoSave();
}

// ─── Target Draw Modal ───

function getReconDrawCount() {
    if (!campaign || !gameData) return 3;
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    if (!scenario || !scenario.Recon) return 3;
    const reconTrack = (campaign.tracks && campaign.tracks.recon) || 0;
    const arr = scenario.Recon;
    if (reconTrack >= arr.length) return arr[arr.length - 1];
    return arr[reconTrack];
}

function getAvailableTargetPool(dayIdx) {
    const targetNumbers = getUnlockedTargetNumbers();
    const destroyed = getDestroyedTargets();
    const dayUsed = getDayUsedTargets(dayIdx, -1);
    return targetNumbers
        .map(String)
        .filter(n => !destroyed.has(n) && !dayUsed.has(n));
}

function openTargetDrawModal(dayIdx) {
    const drawCount = getReconDrawCount();
    const pool = getAvailableTargetPool(dayIdx);

    // Shuffle pool (Fisher-Yates)
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Draw cards sequentially, stop on Scramble
    const drawnCards = [];
    let scrambleIdx = -1;
    for (let i = 0; i < Math.min(drawCount, shuffled.length); i++) {
        const num = shuffled[i];
        const entry = getTargetEntry(num);
        drawnCards.push({ num, entry });
        if (entry && entry.traits && entry.traits.includes('Scramble')) {
            scrambleIdx = i;
            break;
        }
    }

    // Collect active improvement cards not in drawn cards and not destroyed/day-used
    const destroyed = getDestroyedTargets();
    const dayUsed = getDayUsedTargets(dayIdx, -1);
    const drawnNums = new Set(drawnCards.map(c => c.num));
    const impCards = (campaign.improvements || [])
        .filter(i => i.active && !drawnNums.has(i.cardNumber) && !destroyed.has(i.cardNumber) && !dayUsed.has(i.cardNumber))
        .map(i => ({ num: i.cardNumber, entry: getTargetEntry(i.cardNumber), isImprovement: true }));

    // State
    const state = {
        dayIdx,
        drawnCards,
        impCards,
        scrambleIdx,
        selectedPrimary: scrambleIdx >= 0 ? scrambleIdx : -1,
        selectedSecondary: -1,
        selectedPrimarySource: scrambleIdx >= 0 ? 'drawn' : null,
        selectedSecondarySource: null
    };

    renderDrawModal(state);
}

function renderDrawModal(state) {
    const overlay = document.getElementById('target-draw-modal');
    const container = document.getElementById('draw-cards-container');
    const actions = document.getElementById('draw-actions');
    const reconInfo = document.getElementById('draw-recon-info');

    const drawCount = getReconDrawCount();
    reconInfo.textContent = `Recon ${(campaign.tracks && campaign.tracks.recon) || 0} → ${drawCount}장 뽑기`;

    container.innerHTML = '';

    function isPrimary(source, idx) {
        return state.selectedPrimarySource === source && state.selectedPrimary === idx;
    }
    function isSecondarySelected(source, idx) {
        return state.selectedSecondarySource === source && state.selectedSecondary === idx;
    }

    function renderCard(card, idx, source) {
        const entry = card.entry;
        const traits = entry ? (entry.traits || '') : '';
        const traitList = traits.split(',').map(t => t.trim()).filter(Boolean);
        const isScramble = source === 'drawn' && state.scrambleIdx === idx;
        const isPri = isPrimary(source, idx);
        const isSec = isSecondarySelected(source, idx);
        const hasSecondary = traitList.includes('Secondary');
        const hits = getTargetHits(card.num);
        const bandInfo = getTargetBandInfo(card.num);
        const wpPen = getImprovementWPPenalty();

        const div = document.createElement('div');
        div.className = 'draw-card'
            + (isScramble ? ' scramble-forced' : '')
            + (isPri ? ' selected-primary' : '')
            + (isSec ? ' selected-secondary' : '');

        div.innerHTML = `
            <div class="draw-card-header">
                <span class="draw-card-num">#${card.num}</span>
                <span class="draw-card-name">${entry ? entry.targetName : '?'}</span>
                ${hits != null ? `<span class="draw-card-hits">Hits ${hits}</span>` : ''}
                ${bandInfo ? `<span class="wp-badge">WP ${bandInfo.WP - wpPen}</span>` : ''}
            </div>
            <div class="draw-card-detail">
                <span>기체: ${entry ? entry.aircraftCount : '?'}</span>
                <span>Sites: ${entry ? `접근 ${entry.sites.approach} / 중심 ${entry.sites.center}` : '?'}</span>
                <span>Bandits: ${entry ? `접근 ${entry.bandits.approach} / 중심 ${entry.bandits.center}` : '?'}</span>
                ${entry && entry.nighttimeMission === 'true' ? '<span style="color:#8090c0">야간 가능</span>' : ''}
            </div>
            <div class="draw-card-traits">
                ${traitList.map(t => `<span class="target-trait-tag">${t}</span>`).join('')}
            </div>
            ${entry && entry.improvement ? `<div class="draw-card-improvement">${entry.improvement}</div>` : ''}
            ${isScramble ? '<div class="draw-card-label scramble">SCRAMBLE — 이 표적을 반드시 주표적으로 선택</div>' : ''}
            ${isPri && !isScramble ? '<div class="draw-card-label primary">주 표적 선택됨</div>' : ''}
            ${isSec ? '<div class="draw-card-label secondary">부 표적 선택됨</div>' : ''}
        `;

        div.addEventListener('click', () => {
            if (isScramble) return;
            handleCardClick(state, source, idx, hasSecondary);
            renderDrawModal(state);
        });

        return div;
    }

    // Drawn cards
    state.drawnCards.forEach((card, idx) => {
        container.appendChild(renderCard(card, idx, 'drawn'));
    });

    if (state.scrambleIdx >= 0) {
        const remaining = getReconDrawCount() - state.drawnCards.length;
        if (remaining > 0) {
            const stopDiv = document.createElement('div');
            stopDiv.className = 'draw-card-stopped';
            stopDiv.textContent = `Scramble로 카드 뽑기 중단 (${remaining}장 남음)`;
            container.appendChild(stopDiv);
        }
    }

    // Improvement cards section
    if (state.impCards && state.impCards.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'draw-section-divider';
        divider.textContent = 'Improvement 카드 (미파괴)';
        container.appendChild(divider);

        state.impCards.forEach((card, idx) => {
            container.appendChild(renderCard(card, idx, 'imp'));
        });
    }

    // Actions
    actions.innerHTML = '';
    const hasPrimary = state.selectedPrimary >= 0 && state.selectedPrimarySource;
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-small btn-primary';
    confirmBtn.textContent = '확인';
    confirmBtn.disabled = !hasPrimary;
    confirmBtn.addEventListener('click', () => applyDrawSelection(state));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-small';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', closeDrawModal);

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    overlay.style.display = 'flex';
    document.getElementById('draw-modal-close').onclick = closeDrawModal;
}

function handleCardClick(state, source, idx, hasSecondary) {
    const isPri = state.selectedPrimarySource === source && state.selectedPrimary === idx;
    const isSec = state.selectedSecondarySource === source && state.selectedSecondary === idx;

    if (state.scrambleIdx >= 0) {
        // Scramble: primary is locked, only secondary from Secondary cards
        if (hasSecondary && !(source === 'drawn' && idx === state.scrambleIdx)) {
            if (isSec) {
                state.selectedSecondary = -1; state.selectedSecondarySource = null;
            } else {
                state.selectedSecondary = idx; state.selectedSecondarySource = source;
            }
        }
        return;
    }

    if (isPri) {
        // Deselect primary
        state.selectedPrimary = -1; state.selectedPrimarySource = null;
    } else if (!state.selectedPrimarySource) {
        // No primary yet → set primary
        state.selectedPrimary = idx; state.selectedPrimarySource = source;
    } else {
        // Primary exists → toggle secondary if Secondary keyword, else switch primary
        if (hasSecondary) {
            if (isSec) {
                state.selectedSecondary = -1; state.selectedSecondarySource = null;
            } else {
                state.selectedSecondary = idx; state.selectedSecondarySource = source;
            }
        } else {
            state.selectedPrimary = idx; state.selectedPrimarySource = source;
            if (state.selectedSecondarySource === source && state.selectedSecondary === idx) {
                state.selectedSecondary = -1; state.selectedSecondarySource = null;
            }
        }
    }
}

function applyDrawSelection(state) {
    const dayIdx = state.dayIdx;
    const m = campaign.missions[dayIdx];
    const cardList = { drawn: state.drawnCards, imp: state.impCards || [] };

    const primaryCard = cardList[state.selectedPrimarySource][state.selectedPrimary];

    // Set primary target
    const primaryTarget = m.targets[0];
    fillTargetFromCard(primaryTarget, primaryCard.num);

    // Set secondary target
    if (state.selectedSecondary >= 0 && state.selectedSecondarySource) {
        const secCard = cardList[state.selectedSecondarySource][state.selectedSecondary];
        if (m.targets.length < 2) {
            m.targets.push(createEmptyTarget());
        }
        fillTargetFromCard(m.targets[1], secCard.num);
    }

    // Register drawn improvement cards as active (if not already registered)
    const selectedNums = new Set([primaryCard.num]);
    if (state.selectedSecondary >= 0 && state.selectedSecondarySource) {
        selectedNums.add(cardList[state.selectedSecondarySource][state.selectedSecondary].num);
    }
    state.drawnCards.forEach(card => {
        const entry = card.entry;
        if (entry && entry.improvement) {
            const already = campaign.improvements.find(i => i.cardNumber === card.num);
            if (!already) {
                campaign.improvements.push({
                    cardNumber: card.num,
                    text: entry.improvement,
                    active: true
                });
            }
        }
    });

    closeDrawModal();
    renderMissions();
    updateBadges();
    autoSave();
}

function fillTargetFromCard(t, targetNumber) {
    t.targetNumber = String(targetNumber);
    const entry = getTargetEntry(targetNumber);
    if (entry && entry.destroyedRewards) {
        const r = entry.destroyedRewards;
        t.vp = r.vp || 0;
        t.recon = r.recon || 0;
        t.intel = r.intel || 0;
        t.infra = r.infra || 0;
    }
    const campDetail = getTargetCampaignDetails(targetNumber);
    if (campDetail) {
        t.baseStress = campDetail.baseStress;
    }
}

function closeDrawModal() {
    document.getElementById('target-draw-modal').style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', e => {
    if (e.target.id === 'target-draw-modal') closeDrawModal();
    if (e.target.id === 'campaign-fail-modal') closeCampaignFailModal();
    if (e.target.id === 'overkill-modal') closeOverkillModal();
    if (e.target.id === 'discard-imp-modal') closeDiscardImpModal();
});

// ─── Trait Tooltip (JS-based) ───
(function() {
    const tip = document.getElementById('trait-tooltip');
    document.addEventListener('mouseover', e => {
        const tag = e.target.closest('[data-tooltip]');
        if (!tag) return;
        tip.textContent = tag.dataset.tooltip;
        tip.style.display = 'block';
        const rect = tag.getBoundingClientRect();
        let left = rect.left;
        let top = rect.bottom + 6;
        // Prevent right overflow
        tip.style.left = '0'; tip.style.top = '0';
        const tipW = tip.offsetWidth;
        if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
        if (left < 4) left = 4;
        // Prevent bottom overflow — show above
        if (top + tip.offsetHeight > window.innerHeight - 8) top = rect.top - tip.offsetHeight - 6;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    });
    document.addEventListener('mouseout', e => {
        const tag = e.target.closest('[data-tooltip]');
        if (tag) tip.style.display = 'none';
    });
})();

// ─── Debriefing Modal ───

function showDebriefModal(dayIdx) {
    const m = campaign.missions[dayIdx];
    const overlay = document.getElementById('debrief-modal');
    const body = document.getElementById('debrief-modal-body');

    // Build target summaries
    let targetsHTML = '';
    let dayVP = 0;
    let destroyedCount = 0;
    let shotDownCount = 0;

    if (m.downTime) {
        targetsHTML = '<div class="debrief-pilots" style="text-align:center;padding:0.5rem">전체 휴식 — 작전 없음</div>';
    } else {
        m.targets.forEach((t, tIdx) => {
            if (!t.targetNumber) return;
            const entry = getTargetEntry(t.targetNumber);
            const targetName = entry ? entry.targetName : '?';
            const resultClass = t.result === 'Destroyed' ? 'destroyed' : t.result === 'Damaged' ? 'damaged' : 'failed';
            const resultLabel = t.result === 'Destroyed' ? '파괴 성공' : t.result === 'Damaged' ? '표적 피해' : '타격 실패';

            if (t.result === 'Destroyed') {
                dayVP += parseInt(t.vp) || 0;
                if (t.overkillVP) dayVP += t.overkillVP;
                destroyedCount++;
            }

            let pilotsHTML = '';
            (t.assignedPilots || []).forEach(ap => {
                const pilot = campaign.squadron[ap.pilotIdx];
                if (!pilot) return;
                if (ap.shotDown) {
                    shotDownCount++;
                    const sarLabel = ap.sarResult === 'quick' ? '신속 회복' : ap.sarResult === 'fire' ? '포화 속 구조' : ap.sarResult === 'mia' ? 'MIA' : 'SAR 대기';
                    pilotsHTML += `<div class="debrief-pilot-line shot-down">${pilot.name} (${pilot.aircraft}) — 격추 → ${sarLabel}</div>`;
                } else {
                    pilotsHTML += `<div class="debrief-pilot-line">${pilot.name} (${pilot.aircraft}) — 작전 수행</div>`;
                }
            });

            targetsHTML += `
                <div class="debrief-target">
                    <div class="debrief-target-header">
                        <span class="debrief-target-type">${tIdx === 0 ? '주 표적' : '부 표적'}</span>
                        <span class="debrief-target-name">#${t.targetNumber} ${targetName}</span>
                        <span class="debrief-result ${resultClass}">${resultLabel}</span>
                    </div>
                    <div class="debrief-pilots">${pilotsHTML}</div>
                </div>
            `;
        });
    }

    // Active improvements summary
    const activeImps = (campaign.improvements || []).filter(i => i.active);
    let impHTML = '';
    if (activeImps.length > 0) {
        impHTML = `
            <div class="debrief-imp-section">
                <div class="debrief-imp-title">Active Improvements (${activeImps.length})</div>
                ${activeImps.map(imp => {
                    const entry = getTargetEntry(imp.cardNumber);
                    return `<div class="debrief-imp-line"><span class="debrief-imp-num">#${imp.cardNumber}</span> ${entry ? entry.targetName : '?'} — <span class="debrief-imp-text">${imp.text}</span></div>`;
                }).join('')}
            </div>
        `;
    }

    body.innerHTML = `
        <div class="debrief-header">
            <h2>${m.day}일차 작전 완료</h2>
            <div class="debrief-sub">${m.downTime ? 'Down Time' : (t => t === 'Night' ? '야간 작전' : '주간 작전')(m.targets[0]?.dayNight || 'Day')}</div>
        </div>
        <div class="debrief-targets">${targetsHTML}</div>
        ${impHTML}
        <div class="debrief-summary">
            <div class="debrief-stat debrief-stat-vp">
                <div class="debrief-stat-label">금일 VP</div>
                <div class="debrief-stat-value">${dayVP}</div>
            </div>
            <div class="debrief-stat debrief-stat-destroyed">
                <div class="debrief-stat-label">파괴</div>
                <div class="debrief-stat-value">${destroyedCount}</div>
            </div>
            <div class="debrief-stat debrief-stat-shotdown">
                <div class="debrief-stat-label">격추</div>
                <div class="debrief-stat-value">${shotDownCount}</div>
            </div>
        </div>
        <div class="debrief-hint">아무 곳이나 클릭하면 닫힙니다</div>
    `;

    overlay.style.display = 'flex';

    // Close on any click → collapse the day
    const closeHandler = () => {
        overlay.style.display = 'none';
        overlay.removeEventListener('click', closeHandler);
        m.collapsed = true;
        renderAll();
        autoSave();
    };
    // Delay to prevent immediate close from the button click
    setTimeout(() => overlay.addEventListener('click', closeHandler), 100);
}

// ─── Overkill Modal ───

function showOverkillModal(dayIdx, tIdx, ok) {
    const overlay = document.getElementById('overkill-modal');
    const body = document.getElementById('overkill-modal-body');
    const infraMod = getInfraHitsModifier();
    const effectiveThreshold = Math.max(1, ok.threshold + infraMod);

    body.innerHTML = `
        <h3>Overkill 확인</h3>
        <p>공격 히트 합계가 <strong>${effectiveThreshold}</strong> 이상인가요?</p>
        <p class="overkill-bonus">달성 시 보너스: <strong>+${ok.bonusVP} VP</strong></p>
    `;

    const actions = document.getElementById('overkill-modal-actions');
    actions.innerHTML = '';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'btn btn-small btn-primary';
    yesBtn.textContent = `달성 (+${ok.bonusVP} VP)`;
    yesBtn.addEventListener('click', () => {
        campaign.missions[dayIdx].targets[tIdx].overkillVP = ok.bonusVP;
        closeOverkillModal();
        resolveTarget(dayIdx, tIdx);
    });

    const noBtn = document.createElement('button');
    noBtn.className = 'btn btn-small';
    noBtn.textContent = '미달성';
    noBtn.addEventListener('click', () => {
        closeOverkillModal();
        resolveTarget(dayIdx, tIdx);
    });

    actions.appendChild(noBtn);
    actions.appendChild(yesBtn);
    overlay.style.display = 'flex';
}

function closeOverkillModal() {
    document.getElementById('overkill-modal').style.display = 'none';
}

// ─── Discard Improvement Modal ───

function showDiscardImprovementModal(discardCount) {
    const overlay = document.getElementById('discard-imp-modal');
    const container = document.getElementById('discard-imp-cards');
    const actions = document.getElementById('discard-imp-actions');
    const info = document.getElementById('discard-imp-info');

    const activeImps = (campaign.improvements || []).filter(i => i.active);
    const maxSelect = Math.min(discardCount, activeImps.length);
    const selected = new Set();

    info.textContent = `${maxSelect}장의 Improvement 카드를 제거할 수 있습니다.`;

    function render() {
        container.innerHTML = '';
        activeImps.forEach((imp, idx) => {
            const entry = getTargetEntry(imp.cardNumber);
            const div = document.createElement('div');
            div.className = 'discard-imp-card' + (selected.has(idx) ? ' selected' : '');
            div.innerHTML = `
                <span class="discard-imp-num">#${imp.cardNumber}</span>
                <span class="discard-imp-name">${entry ? entry.targetName : '?'}</span>
                <span class="discard-imp-text">${imp.text}</span>
            `;
            div.addEventListener('click', () => {
                if (selected.has(idx)) {
                    selected.delete(idx);
                } else if (selected.size < maxSelect) {
                    selected.add(idx);
                }
                render();
            });
            container.appendChild(div);
        });

        actions.innerHTML = '';
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-small btn-primary';
        confirmBtn.textContent = `제거 (${selected.size}/${maxSelect})`;
        confirmBtn.addEventListener('click', () => {
            const activeArr = activeImps;
            selected.forEach(idx => { activeArr[idx].active = false; });
            closeDiscardImpModal();
            renderAll();
            autoSave();
        });

        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn btn-small';
        skipBtn.textContent = '건너뛰기';
        skipBtn.addEventListener('click', () => {
            closeDiscardImpModal();
        });

        actions.appendChild(skipBtn);
        actions.appendChild(confirmBtn);
    }

    render();
    overlay.style.display = 'flex';
}

function closeDiscardImpModal() {
    document.getElementById('discard-imp-modal').style.display = 'none';
}

// ─── Campaign Fail Modal ───

function showCampaignFailModal(failCount, maxFails, lengthKey) {
    const overlay = document.getElementById('campaign-fail-modal');
    const body = document.getElementById('fail-modal-body');
    body.innerHTML = `
        <div class="fail-modal-icon">&#9888;</div>
        <h3>캠페인 패배</h3>
        <p><strong>${lengthKey}</strong> 캠페인에서 <strong>${failCount}/${maxFails}</strong>번 표적 파괴에 실패하여 캠페인이 즉시 종료됩니다.</p>
        <p class="fail-modal-sub">더 이상 작전을 진행할 수 없습니다.</p>
    `;
    overlay.style.display = 'flex';
}

function closeCampaignFailModal() {
    document.getElementById('campaign-fail-modal').style.display = 'none';
}

function onAddTarget(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    openTargetDrawModal(dayIdx);
}

function onRemoveTarget(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    campaign.missions[dayIdx].targets.splice(tIdx, 1);
    renderMissions();
    autoSave();
}

function onToggleDayNight(e) {
    if (e.target.classList.contains('no-night')) return;
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const t = campaign.missions[dayIdx].targets[tIdx];
    t.dayNight = t.dayNight === 'Night' ? 'Day' : 'Night';
    renderMissions();
    autoSave();
}

function onTargetFieldChange(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const t = campaign.missions[dayIdx].targets[tIdx];
    t[e.target.dataset.tfield] = e.target.value;

    // Auto-fill destroyedRewards and campaign details when target number changes
    if (e.target.dataset.tfield === 'targetNumber') {
        const entry = getTargetEntry(e.target.value);
        if (entry && entry.destroyedRewards) {
            const r = entry.destroyedRewards;
            t.vp = r.vp || 0;
            t.recon = r.recon || 0;
            t.intel = r.intel || 0;
            t.infra = r.infra || 0;
        }
        const campDetail = getTargetCampaignDetails(e.target.value);
        if (campDetail) {
            t.baseStress = campDetail.baseStress;
        }
        // Update trait stress for already-assigned pilots
        const newTraitStress = parseTraitStress(e.target.value);
        (t.assignedPilots || []).forEach(ap => {
            ap.missionStress = newTraitStress;
        });
        renderMissions();
    }
    updateBadges();
    autoSave();
}

function onToggleAssign(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const key = panelKey(dayIdx, tIdx);
    if (openAssignPanels.has(key)) {
        openAssignPanels.delete(key);
        delete assignStaging[key];
    } else {
        openAssignPanels.add(key);
        assignStaging[key] = new Set();
    }
    renderMissions();
}

function onStagePilot(e) {
    const key = panelKey(e.target.dataset.day, e.target.dataset.tidx);
    const pIdx = parseInt(e.target.dataset.pidx);
    const staged = assignStaging[key];
    if (e.target.checked) staged.add(pIdx);
    else staged.delete(pIdx);
    renderMissions();
}

function onConfirmAssign(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const key = panelKey(dayIdx, tIdx);
    const target = campaign.missions[dayIdx].targets[tIdx];
    const staged = assignStaging[key] || new Set();

    const acLimit = getTargetAircraftCount(target.targetNumber);
    const fmlActive = campaign.flyingMoreLess && acLimit !== Infinity;
    const effectiveLimit = fmlActive ? acLimit + 1 : acLimit;
    let nonE2CCount = target.assignedPilots.filter(ap => !isE2C(campaign.squadron[ap.pilotIdx])).length;

    staged.forEach(pIdx => {
        if (target.assignedPilots.some(ap => ap.pilotIdx === pIdx)) return;
        const pilot = campaign.squadron[pIdx];
        if (!isE2C(pilot) && nonE2CCount >= effectiveLimit) return;
        const traitStress = parseTraitStress(target.targetNumber);
        target.assignedPilots.push({ pilotIdx: pIdx, shotDown: false, missionStress: traitStress, missionXp: 0 });
        if (!isE2C(pilot)) nonE2CCount++;
    });

    openAssignPanels.delete(key);
    delete assignStaging[key];
    renderMissions();
    autoSave();
}

function onCancelAssign(e) {
    const key = panelKey(e.target.dataset.day, e.target.dataset.tidx);
    openAssignPanels.delete(key);
    delete assignStaging[key];
    renderMissions();
}

function onToggleShotDown(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const apIdx = parseInt(e.target.dataset.apidx);
    const ap = campaign.missions[dayIdx].targets[tIdx].assignedPilots[apIdx];
    ap.shotDown = !ap.shotDown;
    renderMissions();
    autoSave();
}

function onMissionPilotArrow(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const apIdx = parseInt(e.target.dataset.apidx);
    const ap = campaign.missions[dayIdx].targets[tIdx].assignedPilots[apIdx];
    if (!ap) return;

    switch (e.target.dataset.action) {
        case 'ms-up':
            ap.missionStress = (ap.missionStress || 0) + 1;
            break;
        case 'ms-down':
            ap.missionStress = (ap.missionStress || 0) - 1;
            break;
        case 'xp-up':
            ap.missionXp = (ap.missionXp || 0) + 1;
            break;
        case 'xp-down':
            ap.missionXp = Math.max(0, (ap.missionXp || 0) - 1);
            break;
    }
    renderMissions();
    autoSave();
}

function onSelectResult(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    campaign.missions[dayIdx].targets[tIdx].result = e.target.dataset.result;
    renderMissions();
    autoSave();
}

function parseOverkill(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    if (!entry) return null;
    const baseHits = parseInt(entry.hits) || 0;

    // Format 1: "overkill" field like "+10 BONUS: +1VP"
    if (entry.overkill) {
        const m = entry.overkill.match(/\+(\d+)\s*BONUS.*?\+(\d+)\s*VP/i);
        if (m) return { threshold: baseHits + parseInt(m[1]), bonusVP: parseInt(m[2]) };
    }

    // Format 2: traits — many variants:
    //   "Overkill: 17+, gain 1VP"
    //   "OVERKILL 13+: Gain +1VP"
    //   "OVERKILL BONUS: 14+, Gain +1VP"
    //   "OVERKILL +14: Gain +1VP"
    //   "OVERKILL 18+: Gain +1 VP"
    //   "OVERKILL 10+: Gain +1 VP"
    if (entry.traits) {
        const t = entry.traits;
        // Extract threshold number and bonus VP from any OVERKILL variant
        const m = t.match(/OVERKILL[\s:]*(?:BONUS[\s:]*)?[+]?(\d+)\+?.*?(?:Gain\s*)?[+]?(\d+)\s*VP/i);
        if (m) return { threshold: parseInt(m[1]), bonusVP: parseInt(m[2]) };
    }
    return null;
}

function onResolveTarget(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const t = campaign.missions[dayIdx].targets[tIdx];

    // Check Overkill before resolving
    if (t.result === 'Destroyed') {
        const ok = parseOverkill(t.targetNumber);
        if (ok) {
            showOverkillModal(dayIdx, tIdx, ok);
            return;
        }
    }
    resolveTarget(dayIdx, tIdx);
}

function onApplyRecovery(e) {
    applyEndOfDayRecovery(parseInt(e.target.dataset.day));
}

function onApplyRnR(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const m = campaign.missions[dayIdx];
    if (m.rnrApplied) return;

    // SO 9 차감: DOM의 최신 입력값 반영 후 추가
    const inputEl = document.querySelector(`input[data-day="${dayIdx}"][data-field="usedSO"]`);
    const currentUsed = inputEl ? (parseFloat(inputEl.value) || 0) : (parseFloat(m.usedSO) || 0);
    m.usedSO = currentUsed + 9;

    recoverPilots();

    m.rnrApplied = true;
    renderAll();
    autoSave();
}

function onDownTime(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const m = campaign.missions[dayIdx];
    if (m.downTime || m.recoveryApplied) return;

    // 페널티: Recon, Intel, Infra 각 -1
    campaign.tracks.recon = Math.max(0, (campaign.tracks.recon || 0) - 1);
    campaign.tracks.intel = Math.max(0, (campaign.tracks.intel || 0) - 1);
    campaign.tracks.infra = Math.max(0, (campaign.tracks.infra || 0) - 1);

    recoverPilots();

    // SO 이월
    const startSO = parseFloat(m.startSO) || 0;
    const usedSO = parseFloat(m.usedSO) || 0;
    const nextDayIdx = dayIdx + 1;
    if (nextDayIdx < campaign.missions.length) {
        campaign.missions[nextDayIdx].startSO = startSO - usedSO;
    }

    m.downTime = true;
    m.recoveryApplied = true;

    // Apply daily improvement effects (track decay, VP loss)
    applyDailyImprovementEffects();

    showDebriefModal(dayIdx);

    renderAll();
    autoSave();
}

// ─── SAR Logic ───

function onSarAtgStep(e) {
    const btn = e.target;
    const dayIdx = parseInt(btn.dataset.day);
    const tIdx = parseInt(btn.dataset.tidx);
    const apIdx = parseInt(btn.dataset.apidx);
    const step = parseInt(btn.dataset.step);
    const ap = campaign.missions[dayIdx].targets[tIdx].assignedPilots[apIdx];
    ap._sarAtgWp = Math.max(0, (ap._sarAtgWp || 0) + step);
    renderMissions();
}

function onToggleSarLocation(e) {
    const box = e.target.closest('.sar-box[data-role="loc"]');
    if (!box) return;
    const dayIdx = parseInt(box.dataset.day);
    const tIdx = parseInt(box.dataset.tidx);
    const apIdx = parseInt(box.dataset.apidx);
    const ap = campaign.missions[dayIdx].targets[tIdx].assignedPilots[apIdx];
    const cycle = { 0: 2, 2: 1, 1: 0 };
    const cur = ap._sarLocation || 0;
    ap._sarLocation = cycle[cur] != null ? cycle[cur] : 0;
    renderMissions();
}

function onSarRoll(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const apIdx = parseInt(e.target.dataset.apidx);
    const ap = campaign.missions[dayIdx].targets[tIdx].assignedPilots[apIdx];
    const pilot = campaign.squadron[ap.pilotIdx];

    // Read modifiers
    const location = ap._sarLocation || 0;
    const wpPenalty = parseInt(e.target.dataset.wpPenalty) || 0;
    const atgWp = ap._sarAtgWp || 0;

    // Roll d10 (1-10)
    const roll = Math.floor(Math.random() * 10) + 1;
    const finalResult = roll + location - wpPenalty + atgWp;

    ap.sarRoll = roll;
    ap.sarFinal = finalResult;
    ap.sarModifiers = { location, wpPenalty, atgWp };

    if (finalResult >= 9) {
        // 신속 회복: stress +3, XP +1, 복귀
        ap.sarResult = 'quick';
        pilot.shotDown = false;
        pilot.stress += 3;
        pilot.xp += 1;
        promoteIfReady(pilot);
    } else if (finalResult >= 6) {
        // 포화 속 구조: stress +5, XP +1, 복귀
        ap.sarResult = 'fire';
        pilot.shotDown = false;
        pilot.stress += 5;
        pilot.xp += 1;
        promoteIfReady(pilot);
    } else {
        // 작전 중 실종: Unfit 유지
        ap.sarResult = 'mia';
        // pilot.shotDown stays true → MIA
    }

    renderAll();
    autoSave();
}

// ─── Resolve Logic ───

// Resolve a single target:
// Stress: each pilot gets (baseStress + individual missionStress - cooldown), min 0
// XP: all pilots (including shot down) get +1 XP base
//     + bonus +1 if Destroyed AND no shot down
//     + manual missionXp adjustment
function parseTraitStress(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    if (!entry || !entry.traits) return 0;
    const match = entry.traits.match(/Stress:\s*([+-]?\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function parseTargetBonus(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    if (!entry) return null;
    return { bonus: entry.bonus || null, penalty: entry.penalty || null };
}

function resolveTarget(dayIdx, tIdx) {
    const t = campaign.missions[dayIdx].targets[tIdx];
    if (t.resolved || !t.result) return;

    const pilots = t.assignedPilots || [];
    const baseStress = parseInt(t.baseStress) || 0;
    const hasShotDown = pilots.some(ap => ap.shotDown);

    // Difficulty stress modifier
    const dr = campaign.diffRules || {};
    let stressMod = 0;
    if (dr.extraStress) stressMod += 1;
    if (dr.lessStress) stressMod -= 1;

    // Band-level bonus XP (e.g. Band 5 of Libya 2011)
    const bandInfo = getTargetBandInfo(t.targetNumber);
    const bandBonusXP = bandInfo ? (bandInfo.BonusXP || 0) : 0;

    // Target card bonus/penalty
    const bp = parseTargetBonus(t.targetNumber);

    pilots.forEach(ap => {
        const pilot = campaign.squadron[ap.pilotIdx];

        if (ap.shotDown) {
            // Mark shot down — stress/XP handled by SAR
            pilot.shotDown = true;
            ap.sarResult = '';  // pending SAR
        } else {
            // 1. Stress: baseStress + individual stress + difficulty mod - cooldown (min 0)
            const stressGain = Math.max(0, baseStress + (ap.missionStress || 0) + stressMod - pilot.cooldown);
            pilot.stress += stressGain;

            // 2. XP: +1 base
            let xpGain = 1;
            if (t.result === 'Destroyed' && !hasShotDown) {
                xpGain += 1;
            }
            // Bonus XP from band (applied on destroy only)
            if (t.result === 'Destroyed') {
                xpGain += bandBonusXP;
            }
            // Bonus XP from target card (e.g. "Pilots gain +1 Experience Point.")
            if (t.result === 'Destroyed' && bp && bp.bonus) {
                const xpMatch = bp.bonus.match(/Pilots gain \+(\d+) Experience/i);
                if (xpMatch) xpGain += parseInt(xpMatch[1]);
            }
            xpGain += (ap.missionXp || 0);
            pilot.xp += xpGain;
            promoteIfReady(pilot);
        }
    });

    // Auto-apply tracks when target destroyed
    if (t.result === 'Destroyed') {
        const recon = parseInt(t.recon) || 0;
        const intel = parseInt(t.intel) || 0;
        const infra = parseInt(t.infra) || 0;
        campaign.tracks.recon = Math.max(0, (campaign.tracks.recon || 0) + recon);
        campaign.tracks.intel = Math.max(0, (campaign.tracks.intel || 0) + intel);
        campaign.tracks.infra = Math.max(0, (campaign.tracks.infra || 0) + infra);

        // Night mission bonus: aircraft count as SO
        if (t.dayNight === 'Night') {
            const nightEntry = getTargetEntry(t.targetNumber);
            if (nightEntry && nightEntry.aircraftCount) {
                campaign.totalSO += nightEntry.aircraftCount;
            }
        }

        // Bonus: SO points from target card
        if (bp && bp.bonus) {
            const soMatch = bp.bonus.match(/Gain (\d+) (?:SO )?Special Option Points/i);
            if (soMatch) {
                campaign.totalSO += parseInt(soMatch[1]);
                campaign.missions[dayIdx].startSO = '';  // recalc display
            }
        }

        // Penalty: Lose VP from target card
        if (bp && bp.penalty) {
            const vpMatch = bp.penalty.match(/Lose (\d+) VP/i);
            if (vpMatch) {
                campaign.vpPenalty = (campaign.vpPenalty || 0) + parseInt(vpMatch[1]);
            }
        }
    }

    // VP penalty for destroyed aircraft
    const shotDownCount = pilots.filter(ap => ap.shotDown).length;
    if (shotDownCount > 0) {
        // -1 VP per destroyed aircraft (tracked in campaign)
        campaign.vpPenalty = (campaign.vpPenalty || 0) + shotDownCount;
    }

    // Flying More/Less aircraft VP adjustment
    if (campaign.flyingMoreLess && t.targetNumber) {
        const baseAcLimit = getTargetAircraftCount(t.targetNumber);
        if (baseAcLimit !== Infinity) {
            const assignedNonE2C = pilots.filter(ap => !isE2C(campaign.squadron[ap.pilotIdx])).length;
            if (assignedNonE2C > baseAcLimit) {
                // 1대 초과 투입: VP -1 (결과 무관)
                campaign.vpPenalty = (campaign.vpPenalty || 0) + 1;
            } else if (assignedNonE2C < baseAcLimit && t.result === 'Destroyed') {
                // 1대 감소 투입 + 파괴 성공: VP +1
                campaign.vpAircraftBonus = (campaign.vpAircraftBonus || 0) + 1;
            }
        }
    }

    t.resolved = true;

    // Deactivate improvement if this target had one
    if (t.result === 'Destroyed' && campaign.improvements) {
        const imp = campaign.improvements.find(i => i.cardNumber === String(t.targetNumber) && i.active);
        if (imp) imp.active = false;
    }

    // Check failCondition (e.g. Israel Defense)
    const fcRules = getSpecialRules();
    if (fcRules.failCondition && fcRules.failCondition.maxUndestroyedByLength) {
        const lengthKey = campaign.lengthDesc;
        const maxFails = fcRules.failCondition.maxUndestroyedByLength[lengthKey];
        if (maxFails != null) {
            let failCount = 0;
            campaign.missions.forEach(m => {
                m.targets.forEach(tgt => {
                    if (tgt.resolved && tgt.result !== 'Destroyed' && tgt.targetNumber) failCount++;
                });
            });
            if (failCount >= maxFails) {
                campaign.campaignFailed = true;
                setTimeout(() => showCampaignFailModal(failCount, maxFails, lengthKey), 100);
            }
        }
    }

    // Check Discard Improvement bonus
    if (t.result === 'Destroyed' && bp && bp.bonus) {
        const discardMatch = bp.bonus.match(/Discard (\d+) Improvement/i);
        if (discardMatch) {
            const discardCount = parseInt(discardMatch[1]);
            const activeImps = (campaign.improvements || []).filter(i => i.active);
            if (activeImps.length > 0) {
                setTimeout(() => showDiscardImprovementModal(discardCount), 150);
            }
        }
    }

    renderAll();
    autoSave();
}

// End-of-day recovery: called once all targets in a day are resolved
// Participants: no additional recovery here (cooldown already applied per-target)
// Non-participants: Cool + 2 stress recovery
// SO carry-over: remaining SO → next day's startSO
function applyEndOfDayRecovery(dayIdx) {
    const m = campaign.missions[dayIdx];
    if (m.recoveryApplied) return;

    const assignedIndices = getDayDeployedSet(m);

    recoverPilots((pilot, idx) =>
        !assignedIndices.has(idx) && getStatus(pilot) !== 'Unfit'
    );

    // SO carry-over to next day
    const startSO = parseFloat(m.startSO) || 0;
    const usedSO = parseFloat(m.usedSO) || 0;
    const remainingSO = startSO - usedSO;
    const nextDayIdx = dayIdx + 1;
    if (nextDayIdx < campaign.missions.length) {
        campaign.missions[nextDayIdx].startSO = remainingSO;
    }

    // Apply daily improvement effects (track decay, VP loss)
    applyDailyImprovementEffects();

    m.recoveryApplied = true;

    // Show debriefing modal, then collapse day
    showDebriefModal(dayIdx);

    renderAll();
    autoSave();
}

// ─── Recon / Intel / Infra Tracks ───

function renderTracks() {
    if (!campaign) return;
    if (!campaign.tracks) campaign.tracks = { recon: 0, intel: 0, infra: 0 };
    if (!('vpPenalty' in campaign)) campaign.vpPenalty = 0;

    ['recon', 'intel', 'infra'].forEach(type => {
        const input = document.getElementById('track-' + type);
        input.value = campaign.tracks[type];
        input.onchange = () => {
            campaign.tracks[type] = Math.max(0, parseInt(input.value) || 0);
            input.value = campaign.tracks[type];
            if (type === 'infra') renderMissions();
            autoSave();
        };
    });
}

function renderImprovements() {
    const panel = document.getElementById('improvements-panel');
    const list = document.getElementById('improvements-list');
    if (!campaign || !campaign.improvements || !campaign.improvements.length) {
        panel.style.display = 'none';
        return;
    }
    const active = campaign.improvements.filter(i => i.active);
    if (!active.length) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = '';
    list.innerHTML = '';
    active.forEach(imp => {
        const entry = getTargetEntry(imp.cardNumber);
        const div = document.createElement('div');
        div.className = 'imp-item';
        div.innerHTML = `
            <span class="imp-item-num">#${imp.cardNumber}</span>
            <span class="imp-item-name">${entry ? entry.targetName : '?'}</span>
            <span class="imp-item-text">${imp.text}</span>
        `;
        list.appendChild(div);
    });
}

// ─── Badges ───

function updateBadges() {
    let usedSO = 0;
    campaign.missions.forEach(m => {
        const v = parseFloat(m.usedSO);
        if (!isNaN(v)) usedSO += v;
    });
    const remaining = campaign.totalSO - usedSO;
    document.getElementById('so-display').textContent = `SO: ${remaining}`;
    const fmlCostDisplay = campaign.flyingMoreLess ? FLYING_MORE_LESS_SO_COST[campaign.lengthIdx] || 0 : 0;
    const soBonusDisplay = campaign.soBonus || 0;
    document.getElementById('so-display').title =
        `기본: ${campaign.baseSO || campaign.totalSO}${soBonusDisplay ? ` | 랜덤보너스: +${soBonusDisplay}` : ''} | 기체: ${campaign.aircraftSO ? (campaign.aircraftSO > 0 ? '-' : '+') + Math.abs(campaign.aircraftSO) : '0'}${fmlCostDisplay ? ` | 기체수변경: -${fmlCostDisplay}` : ''} | 사용: ${usedSO}`;

    // VP: sum of destroyed targets' VP - penalties
    let totalVP = 0;
    let bonusVP = 0;
    let overkillVP = 0;
    const rules = getSpecialRules();
    const bonusVPSet = new Set((rules.bonusVPTargets || []).map(String));
    campaign.missions.forEach(m => {
        m.targets.forEach(t => {
            if (t.resolved && t.result === 'Destroyed') {
                const v = parseInt(t.vp) || 0;
                totalVP += v;
                if (bonusVPSet.has(String(t.targetNumber))) bonusVP += 1;
                if (t.overkillVP) overkillVP += t.overkillVP;
            }
        });
    });
    totalVP += bonusVP + overkillVP;

    // Flying More/Less bonus VP
    const fmlBonus = campaign.vpAircraftBonus || 0;
    totalVP += fmlBonus;

    // Penalty: -1 VP per destroyed aircraft
    const vpPenalty = campaign.vpPenalty || 0;
    // Penalty: MIA pilots (-1/-2/-3 by campaign length)
    const miaPenaltyPerPilot = [1, 2, 3][campaign.lengthIdx] || 1;
    let miaCount = 0;
    campaign.squadron.forEach(p => { if (p.shotDown) miaCount++; });
    const miaPenalty = miaCount * miaPenaltyPerPilot;

    totalVP = Math.max(0, totalVP - vpPenalty - miaPenalty);
    const vpTooltip = `표적 VP: ${totalVP + vpPenalty + miaPenalty - bonusVP - overkillVP - fmlBonus}${bonusVP ? ` | 보너스: +${bonusVP}` : ''}${overkillVP ? ` | Overkill: +${overkillVP}` : ''}${fmlBonus ? ` | 감소투입: +${fmlBonus}` : ''} | 격추: -${vpPenalty} | MIA: -${miaPenalty}`;

    // Update VP track box
    const vpTrack = document.getElementById('track-vp');
    if (vpTrack) {
        vpTrack.textContent = totalVP;
        vpTrack.title = vpTooltip;
    }
}

// ─── Summary ───

function renderSummary() {
    if (!campaign) return;
    document.getElementById('summary-scenario').textContent = campaign.scenarioName;
    document.getElementById('summary-length').textContent =
        `${campaign.lengthDesc} (${campaign.timespan})`;

    // Active difficulty rules badges
    const rulesDiv = document.getElementById('active-rules');
    rulesDiv.innerHTML = '';
    const dr = campaign.diffRules || {};
    if (dr.level && dr.level !== 'average') {
        const lvl = PLAYER_LEVELS.find(l => l.id === dr.level);
        if (lvl) {
            const b = document.createElement('span');
            b.className = 'rule-badge rule-badge-info';
            b.textContent = lvl.label;
            rulesDiv.appendChild(b);
        }
    }
    const allRules = [...DISADVANTAGES, ...ADVANTAGES];
    allRules.forEach(rule => {
        if (dr[rule.id]) {
            const isDisadv = DISADVANTAGES.some(d => d.id === rule.id);
            const b = document.createElement('span');
            b.className = 'rule-badge ' + (isDisadv ? 'rule-badge-disadvantage' : 'rule-badge-advantage');
            b.textContent = rule.label;
            b.title = rule.desc;
            rulesDiv.appendChild(b);
        }
    });
    if (campaign.isUSMC) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-info';
        b.textContent = 'USMC';
        b.title = '해병대 캠페인 — 점진적 타겟 덱';
        rulesDiv.appendChild(b);
    }
    if (campaign.largeDeckMarine) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-info';
        b.textContent = 'Large Deck';
        b.title = '대형 갑판 해군 기체 사용, 표적당 기체 수 -1';
        rulesDiv.appendChild(b);
    }
    if (campaign.flyingMoreLess) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-info';
        b.textContent = '기체 수 변경 (±1)';
        b.title = '표적당 기체 1대 초과 투입 시 VP-1, 1대 감소 투입 후 파괴 시 VP+1';
        rulesDiv.appendChild(b);
    }

    // Scenario special rules badges
    const sr = getSpecialRules();
    if (sr.freeSOPerDay) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-advantage';
        b.textContent = `무료 SO ${sr.freeSOPerDay}/일`;
        b.title = `매 작전일마다 특수 무장 ${sr.freeSOPerDay} SO 무료`;
        rulesDiv.appendChild(b);
    }
    if (sr.jdamCost) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-info';
        b.textContent = `JDAM ${sr.jdamCost} SO`;
        b.title = `JDAM SO 비용 = ${sr.jdamCost} SO` + (sr.jdamFixedOnly ? '. JDAM은 오직 Fixed 키워드 표적과 사이트에만 사용 가능' : '');
        rulesDiv.appendChild(b);
    }
    if (sr.harpoonFleetOnly) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-disadvantage';
        b.textContent = 'Harpoon: Fleet만';
        b.title = 'AGM-84 Harpoon은 Fleet 표적에만 사용 가능';
        rulesDiv.appendChild(b);
    }
    if (sr.bonusVPTargets && sr.bonusVPTargets.length) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-advantage';
        b.textContent = `보너스 VP 표적`;
        b.title = `${sr.bonusVPTargets.join(', ')}번 표적 파괴 시 VP +1 추가`;
        rulesDiv.appendChild(b);
    }
    if (sr.startInPlay && sr.startInPlay.length) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-info';
        b.textContent = `시작 표적: ${sr.startInPlay.join(', ')}`;
        b.title = `${sr.startInPlay.join(', ')}번 표적은 플레이 상태로 게임 시작`;
        rulesDiv.appendChild(b);
    }
    if (sr.failCondition) {
        const b = document.createElement('span');
        b.className = 'rule-badge rule-badge-disadvantage';
        b.textContent = '특수 패배조건';
        b.title = sr.failCondition.description;
        rulesDiv.appendChild(b);
    }
}

// ─── Save / Load ───

const STORAGE_KEY = 'hornet_leader_campaigns';

function getSavedCampaigns() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveCampaign() {
    if (!campaign) return;
    const saved = getSavedCampaigns();
    const existing = saved.findIndex(c => c.createdAt === campaign.createdAt);
    if (existing >= 0) saved[existing] = campaign;
    else saved.push(campaign);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    loadSavedCampaignList();
}

function autoSave() {
    if (campaign) saveCampaign();
}

function loadCampaign(createdAt) {
    const saved = getSavedCampaigns();
    const found = saved.find(c => c.createdAt === createdAt);
    if (found) {
        campaign = migrateCampaign(found);
        resetAssignState();
        showDashboard();
    }
}

function deleteCampaign(createdAt) {
    let saved = getSavedCampaigns().filter(c => c.createdAt !== createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    loadSavedCampaignList();
}

// ─── JSON Export / Import ───

function exportCampaignJSON(camp) {
    const json = JSON.stringify(camp, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (camp.scenarioName || 'campaign').replace(/[^a-zA-Z0-9가-힣]/g, '_');
    a.href = url;
    a.download = `hornet_leader_${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportAllCampaignsJSON() {
    const saved = getSavedCampaigns();
    if (saved.length === 0) { alert('저장된 캠페인이 없습니다.'); return; }
    const json = JSON.stringify(saved, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hornet_leader_all_campaigns.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importCampaignsJSON(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            const campaigns = Array.isArray(data) ? data : [data];
            const saved = getSavedCampaigns();
            let added = 0;
            campaigns.forEach(c => {
                if (!c.createdAt || !c.scenarioName) return;
                c = migrateCampaign(c);
                const idx = saved.findIndex(s => s.createdAt === c.createdAt);
                if (idx >= 0) saved[idx] = c;
                else saved.push(c);
                added++;
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
            loadSavedCampaignList();
            alert(`${added}개 캠페인을 불러왔습니다.`);
        } catch (err) {
            alert('JSON 파일을 읽을 수 없습니다: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function loadSavedCampaignList() {
    const saved = getSavedCampaigns();
    const container = document.getElementById('saved-list');
    if (saved.length === 0) {
        container.innerHTML = '<p style="color:#666; font-size:0.9rem;">저장된 캠페인이 없습니다.</p>';
        return;
    }
    container.innerHTML = '';
    saved.forEach(c => {
        const div = document.createElement('div');
        div.className = 'saved-item';
        const date = new Date(c.createdAt).toLocaleDateString();
        div.innerHTML = `
            <div class="saved-item-info">
                <div class="saved-item-name">${c.scenarioName}</div>
                <div class="saved-item-detail">${c.lengthDesc} (${c.timespan}) - ${date}</div>
            </div>
            <div class="saved-item-actions">
                <button class="btn btn-small btn-primary" onclick="loadCampaign('${c.createdAt}')">불러오기</button>
                <button class="btn btn-small btn-danger" onclick="deleteCampaign('${c.createdAt}')">삭제</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// ─── Event Listeners ───

document.addEventListener('DOMContentLoaded', () => {
    loadGameData();

    document.getElementById('generate-btn').addEventListener('click', () => {
        const lengthSel = document.getElementById('length-select');
        const scenarioIdx = lengthSel.dataset.scenarioIdx;
        const lengthIdx = lengthSel.value;
        if (!scenarioIdx || lengthIdx === '') return;
        const selectedAircraft = getSelectedAircraft();
        if (selectedAircraft.length === 0) return;
        const diffRules = getSelectedDifficultyRules();
        const largeDeckMarine = document.getElementById('large-deck-marine')?.checked || false;
        const flyingMoreLess = document.getElementById('flying-more-less')?.checked || false;
        createCampaign(parseInt(scenarioIdx), parseInt(lengthIdx), selectedAircraft, diffRules, { largeDeckMarine, flyingMoreLess });
        resetAssignState();
        saveCampaign();
        showDashboard();
    });

    document.getElementById('manual-select-btn').addEventListener('click', () => {
        const lengthSel = document.getElementById('length-select');
        if (!lengthSel.dataset.scenarioIdx || lengthSel.value === '') return;
        openManualPanel();
    });

    document.getElementById('manual-confirm-btn').addEventListener('click', confirmManualSelection);

    document.getElementById('manual-cancel-btn').addEventListener('click', () => {
        document.getElementById('manual-panel').classList.add('hidden');
    });

    document.getElementById('back-to-setup').addEventListener('click', () => {
        document.getElementById('dashboard-screen').classList.remove('active');
        document.getElementById('setup-screen').classList.add('active');
        loadSavedCampaignList();
    });

    document.getElementById('save-campaign').addEventListener('click', () => saveCampaign());

    document.getElementById('export-json-btn').addEventListener('click', () => {
        if (campaign) exportCampaignJSON(campaign);
    });

    document.getElementById('export-all-json-btn').addEventListener('click', exportAllCampaignsJSON);

    document.getElementById('full-reset-btn').addEventListener('click', () => {
        if (confirm('모든 저장된 캠페인 데이터를 삭제하고 완전히 초기화합니다. 계속하시겠습니까?')) {
            localStorage.clear();
            location.reload();
        }
    });

    document.getElementById('import-json-btn').addEventListener('click', () => {
        document.getElementById('import-json-input').click();
    });

    document.getElementById('import-json-input').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importCampaignsJSON(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.getElementById('reroll-btn').addEventListener('click', () => {
        if (!campaign) return;
        const scenario = gameData.Campaigns[campaign.scenarioIdx];
        const option = scenario.CampaignOptions[campaign.lengthIdx];
        const allowedAircraft = scenario.AvailableAircraft.filter(a => {
            const count = gameData.Pilots.filter(p => p.Aircraft === a && !EXPANSION_PILOTS.has(p.Name)).length;
            return count > 0;
        });
        const randomBonus = RANDOM_SO_BONUS[campaign.lengthIdx] || 6;
        const dr = campaign.diffRules || {};
        // Re-roll until SO >= 0
        for (let attempt = 0; attempt < 100; attempt++) {
            campaign.squadron = generateSquadron(scenario, option, allowedAircraft);
            const aircraftSO = calcSquadronSOCost(campaign.squadron, campaign.lengthIdx);
            campaign.aircraftSO = aircraftSO;
            const newTotalSO = applySOAdjust(campaign.baseSO - aircraftSO + randomBonus, dr, campaign.lengthIdx);
            campaign.totalSO = newTotalSO;
            if (newTotalSO >= 0) break;
        }
        campaign.missions[0].startSO = campaign.totalSO;
        renderAll();
        autoSave();
    });

    document.getElementById('toggle-aircraft').addEventListener('click', () => {
        const cbs = document.querySelectorAll('#aircraft-options input[type="checkbox"]');
        const allChecked = Array.from(cbs).every(cb => cb.checked);
        cbs.forEach(cb => cb.checked = !allChecked);
    });
});
