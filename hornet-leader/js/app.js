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

    diffSel.addEventListener('change', onDifficultyChange);
    document.getElementById('region-select').addEventListener('change', onRegionChange);
    document.getElementById('force-select').addEventListener('change', onForceChange);
}

function hideFrom(startLevel) {
    const ids = ['scenario-info', 'length-group', 'length-info', 'difficulty-rules-group', 'aircraft-group'];
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
    const ids = ['scenario-info', 'length-group', 'length-info', 'difficulty-rules-group', 'aircraft-group'];
    ids.forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('generate-group').classList.add('hidden');
    document.getElementById('manual-panel').classList.add('hidden');

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
            document.getElementById('length-info').classList.add('hidden');
            document.getElementById('aircraft-group').classList.add('hidden');
            document.getElementById('generate-group').classList.add('hidden');
            document.getElementById('manual-panel').classList.add('hidden');
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
        document.getElementById('aircraft-group').classList.remove('hidden');
        document.getElementById('generate-group').classList.remove('hidden');
    };
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

        let soHtml = '';
        if (soCost > 0) {
            soHtml = `<span class="aircraft-so-cost so-pay">-${soCost}</span>`;
        } else if (soCost < 0) {
            soHtml = `<span class="aircraft-so-cost so-gain">+${Math.abs(soCost)}</span>`;
        }

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
                let soLabel = '';
                if (soCost > 0) soLabel = ` [-${soCost} SO]`;
                else if (soCost < 0) soLabel = ` [+${Math.abs(soCost)} SO]`;
                o.textContent = `${p.Name} (${p.Aircraft})${soLabel}`;
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
        if (totalCost > 0) {
            soInfo.innerHTML = `항공기 SO 비용: <span class="so-pay">-${totalCost} SO</span>`;
        } else if (totalCost < 0) {
            soInfo.innerHTML = `항공기 SO 보너스: <span class="so-gain">+${Math.abs(totalCost)} SO</span>`;
        } else {
            soInfo.innerHTML = '항공기 SO 보정: 없음';
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

    // Calculate aircraft SO cost (same rules as random generation)
    const aircraftSO = calcSquadronSOCost(squadron, lengthIdx);
    const daysMatch = option.Timespan.match(/(\d+)/);
    const totalDays = daysMatch ? parseInt(daysMatch[1]) : 3;
    const baseSO = option.SOPoints;
    let totalSO = baseSO - aircraftSO;

    if (diffRules.reducedSOs)  totalSO -= SO_ADJUST[lengthIdx] || 6;
    if (diffRules.increasedSOs) totalSO += SO_ADJUST[lengthIdx] || 6;

    const missions = [];
    for (let i = 0; i < totalDays; i++) {
        missions.push({
            day: i + 1,
            startSO: i === 0 ? totalSO : '',
            usedSO: '',
            targets: [{ targetNumber: '', dayNight: 'Day', vp: '', recon: '', intel: '', infra: '', baseStress: '', assignedPilots: [], result: '', resolved: false }],
            recoveryApplied: false,
            rnrApplied: false,
            downTime: false
        });
    }

    campaign = {
        scenarioIdx, lengthIdx,
        scenarioName: scenario.Name,
        lengthDesc: option.LengthDescription,
        timespan: option.Timespan,
        baseSO: baseSO,
        aircraftSO: aircraftSO,
        totalSO: totalSO,
        manualSquadron: true,
        squadron, missions,
        tracks: { recon: 0, intel: 0, infra: 0 },
        diffRules: diffRules || { level: 'average' },
        createdAt: new Date().toISOString()
    };

    openAssignPanels = new Set();
    assignStaging = {};
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

function getStatus(pilot) {
    if (!pilot.hasStats) return 'Okay';
    const pd = gameData.Pilots.find(p => p.Name === pilot.name);
    if (!pd || !pd.Stats || !pd.Stats[pilot.rank]) return 'Okay';
    const s = pd.Stats[pilot.rank];
    if (pilot.stress >= s.Okay[0] && pilot.stress <= s.Okay[1]) return 'Okay';
    if (pilot.stress >= s.Shaken[0] && pilot.stress <= s.Shaken[1]) return 'Shaken';
    return 'Unfit';
}

function getXpToPromote(pilot) {
    if (!pilot.hasStats) return null;
    const pd = gameData.Pilots.find(p => p.Name === pilot.name);
    if (!pd || !pd.Stats || !pd.Stats[pilot.rank]) return null;
    return pd.Stats[pilot.rank].XP;
}

function getMaxStress(pilot) {
    if (!pilot.hasStats) return '?';
    const pd = gameData.Pilots.find(p => p.Name === pilot.name);
    if (!pd || !pd.Stats || !pd.Stats[pilot.rank]) return '?';
    return pd.Stats[pilot.rank].Shaken[1];
}

function getNextRank(rank) {
    const idx = RANKS.indexOf(rank);
    if (idx < 0 || idx >= RANKS.length - 1) return null;
    return RANKS[idx + 1];
}

function updatePilotForRank(pilot, resetStress) {
    const pd = gameData.Pilots.find(p => p.Name === pilot.name);
    pilot.hasStats = !!(pd && pd.Stats);
    if (pd && pd.Stats && pd.Stats[pilot.rank]) {
        pilot.cooldown = pd.Stats[pilot.rank].Cooldown;
    }
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

const RANDOM_SO_BONUS = [6, 12, 18]; // Short / Medium / Long

function createCampaign(scenarioIdx, lengthIdx, selectedAircraft, diffRules) {
    const scenario = gameData.Campaigns[scenarioIdx];
    const option = scenario.CampaignOptions[lengthIdx];

    // Generate squadron, re-roll if SO goes below 0
    const baseSO = option.SOPoints;
    const randomBonus = RANDOM_SO_BONUS[lengthIdx] || 6;
    let squadron, aircraftSO, totalSO;
    const maxAttempts = 100;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        squadron = generateSquadron(scenario, option, selectedAircraft);
        aircraftSO = calcSquadronSOCost(squadron, lengthIdx);
        totalSO = baseSO - aircraftSO + randomBonus;
        if (diffRules.reducedSOs)  totalSO -= SO_ADJUST[lengthIdx] || 6;
        if (diffRules.increasedSOs) totalSO += SO_ADJUST[lengthIdx] || 6;
        if (totalSO >= 0) break;
    }

    const daysMatch = option.Timespan.match(/(\d+)/);
    const totalDays = daysMatch ? parseInt(daysMatch[1]) : 3;

    const missions = [];
    for (let i = 0; i < totalDays; i++) {
        missions.push({
            day: i + 1,
            startSO: i === 0 ? totalSO : '',
            usedSO: '',
            targets: [{ targetNumber: '', dayNight: 'Day', vp: '', recon: '', intel: '', infra: '', baseStress: '', assignedPilots: [], result: '', resolved: false }],
            recoveryApplied: false,
            rnrApplied: false,
            downTime: false
        });
    }

    campaign = {
        scenarioIdx, lengthIdx,
        scenarioName: scenario.Name,
        lengthDesc: option.LengthDescription,
        timespan: option.Timespan,
        baseSO: baseSO,
        aircraftSO: aircraftSO,
        totalSO: totalSO,
        squadron, missions,
        tracks: { recon: 0, intel: 0, infra: 0 },
        diffRules: diffRules || { level: 'average' },
        createdAt: new Date().toISOString()
    };
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
    });
    if (!c.diffRules) c.diffRules = { level: 'average' };
    return c;
}

// ─── Dashboard ───

function showDashboard() {
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    document.getElementById('campaign-title').textContent =
        `${campaign.scenarioName} - ${campaign.lengthDesc}`;
    // Hide reroll button for manually selected squadrons
    document.getElementById('reroll-btn').style.display = campaign.manualSquadron ? 'none' : '';
    renderAll();
}

function renderAll() {
    renderMissions();
    renderSquadron();
    renderSummary();
    updateBadges();
    renderTracks();
}

// ─── Squadron Rendering ───

function renderSquadron() {
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

function panelKey(dayIdx, tIdx) { return `${dayIdx}-${tIdx}`; }

function getTargetEntry(targetNumber) {
    if (!targetData || !targetNumber) return null;
    const num = String(targetNumber).replace(/^0+/, '');
    return targetData.find(d => d.cardNumber.replace(/^0+/, '') === num) || null;
}

function getTargetAircraftCount(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    return entry ? entry.aircraftCount : Infinity;
}

function getTargetCampaignDetails(targetNumber) {
    const entry = getTargetEntry(targetNumber);
    if (!entry || !entry.campaignDetails || !campaign) return null;
    const scenarioName = campaign.scenarioName || '';
    for (const key of Object.keys(entry.campaignDetails)) {
        if (scenarioName.includes(key)) return entry.campaignDetails[key];
    }
    return null;
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

function buildTargetNumberField(currentValue, dayIdx, tIdx) {
    const scenario = gameData.Campaigns[campaign.scenarioIdx];
    const targets = scenario.Targets;
    if (targets && targets.length > 0) {
        const destroyed = getDestroyedTargets();
        const options = targets.map(n => {
            const isDestroyed = destroyed.has(String(n)) && String(n) !== String(currentValue);
            return isDestroyed ? '' :
                `<option value="${n}"${String(n) === String(currentValue) ? ' selected' : ''}>${n}</option>`;
        }).join('');
        return `<select data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="targetNumber">
            <option value="">--</option>${options}</select>`;
    }
    return `<input type="text" value="${currentValue}" data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="targetNumber">`;
}

function renderMissions() {
    const container = document.getElementById('mission-days');
    container.innerHTML = '';

    campaign.missions.forEach((m, dayIdx) => {
        const allResolved = m.targets.every(t => t.resolved);
        const div = document.createElement('div');
        div.className = 'mission-day' + ((allResolved && m.recoveryApplied) || m.downTime ? ' resolved' : '');

        // Header
        const header = document.createElement('div');
        header.className = 'day-header';
        header.innerHTML = `
            <span class="day-num">${m.day}일차${m.downTime ? ' (Down Time)' : ''}</span>
            <div class="tgt-field"><span class="tgt-field-label">시작 SO</span>
                <input type="number" value="${m.startSO}" data-day="${dayIdx}" data-field="startSO" ${m.recoveryApplied || m.downTime ? 'readonly' : ''}></div>
            <div class="tgt-field"><span class="tgt-field-label">사용 SO</span>
                <input type="number" value="${m.usedSO}" data-day="${dayIdx}" data-field="usedSO" ${m.downTime ? 'readonly' : ''}></div>
            <div class="day-actions">
                ${!m.downTime ? `<button class="btn btn-small" data-day="${dayIdx}" data-action="add-target">+ 표적</button>` : ''}
                ${!m.downTime && !m.recoveryApplied && !allResolved ? `<button class="btn btn-small btn-downtime" data-day="${dayIdx}" data-action="down-time">Down Time</button>` : ''}
            </div>
        `;
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
            const key = panelKey(dayIdx, tIdx);
            const pilots = t.assignedPilots || [];

            // Target block wrapper
            const tBlock = document.createElement('div');
            tBlock.className = 'target-block' + (t.resolved ? ' target-resolved' : '');

            // Target header row
            const campDetail = getTargetCampaignDetails(t.targetNumber);
            const wpLabel = campDetail ? `<span class="wp-badge">WP ${campDetail.wp}</span>` : '';
            const row = document.createElement('div');
            row.className = 'target-row';
            row.innerHTML = `
                <span class="target-label">${tIdx === 0 ? '주 표적' : '부 표적'}</span>
                <div class="tgt-field"><span class="tgt-field-label">번호</span>${buildTargetNumberField(t.targetNumber, dayIdx, tIdx)}</div>
                <div class="tgt-field"><span class="tgt-field-label">시간</span><select data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="dayNight">
                    <option value="Day"${t.dayNight === 'Day' ? ' selected' : ''}>주간</option>
                    <option value="Night"${t.dayNight === 'Night' ? ' selected' : ''}>야간</option>
                </select></div>
                <div class="tgt-field"><span class="tgt-field-label">타겟ST</span><input type="number" value="${t.baseStress || ''}"
                    data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="baseStress"></div>
                <div class="tgt-field"><span class="tgt-field-label">VP</span><input type="number" value="${t.vp || ''}"
                    data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="vp" min="0"></div>
                <div class="tgt-field"><span class="tgt-field-label">Recon</span><input type="number" value="${t.recon || ''}"
                    data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="recon" min="0"></div>
                <div class="tgt-field"><span class="tgt-field-label">Intel</span><input type="number" value="${t.intel || ''}"
                    data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="intel" min="0"></div>
                <div class="tgt-field"><span class="tgt-field-label">Infra</span><input type="number" value="${t.infra || ''}"
                    data-day="${dayIdx}" data-tidx="${tIdx}" data-tfield="infra" min="0"></div>
                ${!t.resolved ? `<button class="btn btn-small" data-day="${dayIdx}" data-tidx="${tIdx}" data-action="toggle-assign">배치</button>` : ''}
                ${tIdx > 0 && !t.resolved ? `<button class="target-remove" data-day="${dayIdx}" data-tidx="${tIdx}">x</button>` : ''}
            `;
            tBlock.appendChild(row);

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
                        <span class="ap-aircraft">${pilot.aircraft}</span>
                        ${wpLabel}
                        <span class="ap-stress-section">
                            <span class="ap-stress-label">스트레스</span>
                            <span class="ap-stress-mission">
                                ${t.resolved ? `+${mStress}` : `
                                <button class="arrow-btn arrow-down ap-arrow" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="ms-down">&#9660;</button>
                                <span class="ap-ms-val">+${mStress}</span>
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
                const existingNonE2C = (t.assignedPilots || []).filter(ap => !isE2C(campaign.squadron[ap.pilotIdx])).length;
                const stagedNonE2C = [...staged].filter(pIdx => !isE2C(campaign.squadron[pIdx])).length;
                const nonE2CCount = existingNonE2C + stagedNonE2C;
                const limitReached = nonE2CCount >= acLimit;

                const panel = document.createElement('div');
                panel.className = 'assign-panel';
                if (acLimit !== Infinity) {
                    const limitInfo = document.createElement('div');
                    limitInfo.className = 'assign-limit-info';
                    limitInfo.textContent = `투입 가능: ${nonE2CCount} / ${acLimit} (E-2C 제외)`;
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
                    const sarDiv = document.createElement('div');
                    sarDiv.className = 'sar-pilot-panel';
                    sarDiv.innerHTML = `
                        <div class="sar-pilot-name">${pilot.name} (${pilot.aircraft})</div>
                        <div class="sar-fields">
                            <div class="tgt-field">
                                <span class="tgt-field-label">격추 위치</span>
                                <select class="sar-input" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-sarfield="location">
                                    <option value="0">표적 상공</option>
                                    <option value="2">진입 구간 (+2)</option>
                                    <option value="1">귀환 구간 (+1)</option>
                                </select>
                            </div>
                            <div class="tgt-field">
                                <span class="tgt-field-label">WP 페널티</span>
                                <input type="number" class="sar-input" value="0" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-sarfield="wpPenalty">
                            </div>
                            <div class="tgt-field">
                                <span class="tgt-field-label">AtG WP</span>
                                <input type="number" class="sar-input" value="0" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-sarfield="atgWp">
                            </div>
                            <button class="btn btn-small btn-primary" data-day="${dayIdx}" data-tidx="${tIdx}" data-apidx="${apIdx}" data-action="sar-roll">SAR 판정</button>
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

function onAddTarget(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    campaign.missions[dayIdx].targets.push({ targetNumber: '', dayNight: 'Day', vp: '', recon: '', intel: '', infra: '', baseStress: '', assignedPilots: [], result: '', resolved: false });
    renderMissions();
    autoSave();
}

function onRemoveTarget(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    campaign.missions[dayIdx].targets.splice(tIdx, 1);
    renderMissions();
    autoSave();
}

function onTargetFieldChange(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const t = campaign.missions[dayIdx].targets[tIdx];
    t[e.target.dataset.tfield] = e.target.value;

    // Auto-fill destroyedRewards and campaign details when target number changes
    if (e.target.dataset.tfield === 'targetNumber' && targetData) {
        const num = e.target.value.replace(/^0+/, '');
        const entry = targetData.find(d => d.cardNumber.replace(/^0+/, '') === num);
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
    let nonE2CCount = target.assignedPilots.filter(ap => !isE2C(campaign.squadron[ap.pilotIdx])).length;

    staged.forEach(pIdx => {
        if (target.assignedPilots.some(ap => ap.pilotIdx === pIdx)) return;
        const pilot = campaign.squadron[pIdx];
        if (!isE2C(pilot) && nonE2CCount >= acLimit) return;
        target.assignedPilots.push({ pilotIdx: pIdx, shotDown: false, missionStress: 0, missionXp: 0 });
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
            ap.missionStress = Math.max(0, (ap.missionStress || 0) - 1);
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

function onResolveTarget(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
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

    // 모든 파일럿: Cool + 2 만큼 스트레스 회복
    campaign.squadron.forEach(pilot => {
        if (pilot.shotDown) return;
        pilot.stress = Math.max(0, pilot.stress - (pilot.cooldown + 2));
    });

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

    // 전 파일럿 휴식: Cool + 2 스트레스 회복
    campaign.squadron.forEach(pilot => {
        if (pilot.shotDown) return;
        pilot.stress = Math.max(0, pilot.stress - (pilot.cooldown + 2));
    });

    // SO 이월
    const startSO = parseFloat(m.startSO) || 0;
    const usedSO = parseFloat(m.usedSO) || 0;
    const nextDayIdx = dayIdx + 1;
    if (nextDayIdx < campaign.missions.length) {
        campaign.missions[nextDayIdx].startSO = startSO - usedSO;
    }

    m.downTime = true;
    m.recoveryApplied = true;
    renderAll();
    autoSave();
}

// ─── SAR Logic ───

function onSarRoll(e) {
    const dayIdx = parseInt(e.target.dataset.day);
    const tIdx = parseInt(e.target.dataset.tidx);
    const apIdx = parseInt(e.target.dataset.apidx);
    const ap = campaign.missions[dayIdx].targets[tIdx].assignedPilots[apIdx];
    const pilot = campaign.squadron[ap.pilotIdx];

    // Read modifier inputs from the SAR panel
    const panel = e.target.closest('.sar-pilot-panel');
    const inputs = panel.querySelectorAll('.sar-input');
    let location = 0, wpPenalty = 0, atgWp = 0;
    inputs.forEach(inp => {
        const field = inp.dataset.sarfield;
        const val = parseInt(inp.value) || 0;
        if (field === 'location') location = val;
        else if (field === 'wpPenalty') wpPenalty = val;
        else if (field === 'atgWp') atgWp = val;
    });

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
    }

    // VP penalty for destroyed aircraft
    const shotDownCount = pilots.filter(ap => ap.shotDown).length;
    if (shotDownCount > 0) {
        // -1 VP per destroyed aircraft (tracked in campaign)
        campaign.vpPenalty = (campaign.vpPenalty || 0) + shotDownCount;
    }

    t.resolved = true;
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

    campaign.squadron.forEach((pilot, idx) => {
        if (assignedIndices.has(idx)) return;
        const status = getStatus(pilot);
        if (status === 'Unfit') return;
        pilot.stress = Math.max(0, pilot.stress - (pilot.cooldown + 2));
    });

    // SO carry-over to next day
    const startSO = parseFloat(m.startSO) || 0;
    const usedSO = parseFloat(m.usedSO) || 0;
    const remainingSO = startSO - usedSO;
    const nextDayIdx = dayIdx + 1;
    if (nextDayIdx < campaign.missions.length) {
        campaign.missions[nextDayIdx].startSO = remainingSO;
    }

    m.recoveryApplied = true;
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
            autoSave();
        };
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
    document.getElementById('so-display').title =
        `기본: ${campaign.baseSO || campaign.totalSO} | 기체: ${campaign.aircraftSO ? (campaign.aircraftSO > 0 ? '-' : '+') + Math.abs(campaign.aircraftSO) : '0'} | 사용: ${usedSO}`;

    // VP: sum of destroyed targets' VP - penalties
    let totalVP = 0;
    campaign.missions.forEach(m => {
        m.targets.forEach(t => {
            if (t.resolved && t.result === 'Destroyed') {
                const v = parseInt(t.vp) || 0;
                totalVP += v;
            }
        });
    });

    // Penalty: -1 VP per destroyed aircraft
    const vpPenalty = campaign.vpPenalty || 0;
    // Penalty: MIA pilots (-1/-2/-3 by campaign length)
    const miaPenaltyPerPilot = [1, 2, 3][campaign.lengthIdx] || 1;
    let miaCount = 0;
    campaign.squadron.forEach(p => { if (p.shotDown) miaCount++; });
    const miaPenalty = miaCount * miaPenaltyPerPilot;

    totalVP = Math.max(0, totalVP - vpPenalty - miaPenalty);
    document.getElementById('vp-display').textContent = `VP: ${totalVP}`;
    document.getElementById('vp-display').title =
        `표적 VP: ${totalVP + vpPenalty + miaPenalty} | 격추: -${vpPenalty} | MIA: -${miaPenalty}`;
}

// ─── Summary ───

function renderSummary() {
    if (!campaign) return;
    document.getElementById('summary-scenario').textContent = campaign.scenarioName;
    document.getElementById('summary-length').textContent =
        `${campaign.lengthDesc} (${campaign.timespan})`;

    let okay = 0, shaken = 0, unfit = 0;
    campaign.squadron.forEach(p => {
        if (p.shotDown) { unfit++; return; }
        const s = getStatus(p);
        if (s === 'Okay') okay++;
        else if (s === 'Shaken') shaken++;
        else unfit++;
    });
    document.getElementById('summary-okay').textContent = okay;
    document.getElementById('summary-shaken').textContent = shaken;
    document.getElementById('summary-unfit').textContent = unfit;

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
        openAssignPanels = new Set();
        assignStaging = {};
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
        createCampaign(parseInt(scenarioIdx), parseInt(lengthIdx), selectedAircraft, diffRules);
        openAssignPanels = new Set();
        assignStaging = {};
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
            let newTotalSO = campaign.baseSO - aircraftSO + randomBonus;
            if (dr.reducedSOs) newTotalSO -= SO_ADJUST[campaign.lengthIdx] || 6;
            if (dr.increasedSOs) newTotalSO += SO_ADJUST[campaign.lengthIdx] || 6;
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
