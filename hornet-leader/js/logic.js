// Pure logic functions extracted from app.js for testability.
// These are also loaded by app.js at runtime (via globalThis).

const RANKS = ['Newbie', 'Green', 'Average', 'Skilled', 'Veteran', 'Ace'];

const SO_ADJUST = [6, 15, 24];

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

function formatSOCost(cost, mode = 'html') {
    if (cost === 0) return '';
    if (mode === 'label') {
        return cost > 0 ? ` [-${cost} SO]` : ` [+${Math.abs(cost)} SO]`;
    }
    return cost > 0
        ? `<span class="aircraft-so-cost so-pay">-${cost}</span>`
        : `<span class="aircraft-so-cost so-gain">+${Math.abs(cost)}</span>`;
}

function applySOAdjust(totalSO, diffRules, lengthIdx) {
    if (diffRules.reducedSOs)  totalSO -= SO_ADJUST[lengthIdx] || 6;
    if (diffRules.increasedSOs) totalSO += SO_ADJUST[lengthIdx] || 6;
    return totalSO;
}

function createEmptyTarget() {
    return { targetNumber: '', dayNight: 'Day', vp: '', recon: '', intel: '', infra: '', baseStress: '', assignedPilots: [], result: '', resolved: false };
}

function getNextRank(rank) {
    const idx = RANKS.indexOf(rank);
    if (idx < 0 || idx >= RANKS.length - 1) return null;
    return RANKS[idx + 1];
}

// getPilotRankStats requires gameData, so it takes a pilots array as parameter for testability
function getPilotRankStats(pilot, pilots) {
    if (!pilot.hasStats) return null;
    const pd = pilots.find(p => p.Name === pilot.name);
    if (!pd || !pd.Stats || !pd.Stats[pilot.rank]) return null;
    return { pd, stats: pd.Stats[pilot.rank] };
}

function getStatus(pilot, pilots) {
    const rs = getPilotRankStats(pilot, pilots);
    if (!rs) return 'Okay';
    const s = rs.stats;
    if (pilot.stress >= s.Okay[0] && pilot.stress <= s.Okay[1]) return 'Okay';
    if (pilot.stress >= s.Shaken[0] && pilot.stress <= s.Shaken[1]) return 'Shaken';
    return 'Unfit';
}

function getXpToPromote(pilot, pilots) {
    const rs = getPilotRankStats(pilot, pilots);
    return rs ? rs.stats.XP : null;
}

function getMaxStress(pilot, pilots) {
    const rs = getPilotRankStats(pilot, pilots);
    return rs ? rs.stats.Shaken[1] : '?';
}

function recoverPilots(squadron, filter) {
    squadron.forEach((pilot, idx) => {
        if (pilot.shotDown) return;
        if (filter && !filter(pilot, idx)) return;
        pilot.stress = Math.max(0, pilot.stress - (pilot.cooldown + 2));
    });
}

export {
    RANKS, SO_ADJUST,
    parseCampaign, formatSOCost, applySOAdjust, createEmptyTarget,
    getNextRank, getPilotRankStats, getStatus, getXpToPromote, getMaxStress,
    recoverPilots
};
