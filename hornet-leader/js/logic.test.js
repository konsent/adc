import { describe, it, expect } from 'vitest';
import {
    RANKS, SO_ADJUST,
    parseCampaign, formatSOCost, applySOAdjust, createEmptyTarget,
    getNextRank, getPilotRankStats, getStatus, getXpToPromote, getMaxStress,
    recoverPilots
} from './logic.js';

// ─── Mock pilot data ───
const MOCK_PILOTS = [
    {
        Name: 'Viper',
        Aircraft: 'F/A-18C',
        Stats: {
            Average: { Okay: [0, 3], Shaken: [4, 6], XP: 4, Cooldown: 1 },
            Skilled: { Okay: [0, 4], Shaken: [5, 8], XP: 6, Cooldown: 2 },
        }
    },
    {
        Name: 'Goose',
        Aircraft: 'F-14A',
        Stats: {
            Green: { Okay: [0, 2], Shaken: [3, 5], XP: 3, Cooldown: 0 },
            Average: { Okay: [0, 3], Shaken: [4, 6], XP: 4, Cooldown: 1 },
        }
    },
    {
        Name: 'NoStats',
        Aircraft: 'E-2C',
    }
];

// ─── parseCampaign ───
describe('parseCampaign', () => {
    it('USN 캠페인을 region/force로 분리', () => {
        expect(parseCampaign({ Name: 'Libya 1984 (USN)' }))
            .toEqual({ region: 'Libya 1984', force: 'USN' });
    });

    it('USMC 캠페인을 분리', () => {
        expect(parseCampaign({ Name: 'Syria 2004 (USMC)' }))
            .toEqual({ region: 'Syria 2004', force: 'USMC' });
    });

    it('소속 뒤 접미사 처리', () => {
        expect(parseCampaign({ Name: 'Iran 2014 (USN) Extended' }))
            .toEqual({ region: 'Iran 2014 Extended', force: 'USN' });
    });

    it('소속 없는 캠페인은 전체를 region으로', () => {
        expect(parseCampaign({ Name: 'Israel Defense' }))
            .toEqual({ region: 'Israel Defense', force: '' });
    });
});

// ─── formatSOCost ───
describe('formatSOCost', () => {
    it('비용 0이면 빈 문자열', () => {
        expect(formatSOCost(0)).toBe('');
    });

    it('양수 비용 → HTML so-pay', () => {
        expect(formatSOCost(3)).toContain('so-pay');
        expect(formatSOCost(3)).toContain('-3');
    });

    it('음수 비용 → HTML so-gain', () => {
        expect(formatSOCost(-2)).toContain('so-gain');
        expect(formatSOCost(-2)).toContain('+2');
    });

    it('label 모드: 양수', () => {
        expect(formatSOCost(5, 'label')).toBe(' [-5 SO]');
    });

    it('label 모드: 음수', () => {
        expect(formatSOCost(-3, 'label')).toBe(' [+3 SO]');
    });

    it('label 모드: 0', () => {
        expect(formatSOCost(0, 'label')).toBe('');
    });
});

// ─── applySOAdjust ───
describe('applySOAdjust', () => {
    it('규칙 없으면 그대로 반환', () => {
        expect(applySOAdjust(100, {}, 0)).toBe(100);
    });

    it('reducedSOs → SO 감소 (short)', () => {
        expect(applySOAdjust(100, { reducedSOs: true }, 0)).toBe(94);  // 100 - 6
    });

    it('increasedSOs → SO 증가 (medium)', () => {
        expect(applySOAdjust(100, { increasedSOs: true }, 1)).toBe(115);  // 100 + 15
    });

    it('reducedSOs (long)', () => {
        expect(applySOAdjust(100, { reducedSOs: true }, 2)).toBe(76);  // 100 - 24
    });

    it('양쪽 동시 적용 → 상쇄', () => {
        expect(applySOAdjust(100, { reducedSOs: true, increasedSOs: true }, 0)).toBe(100);
    });
});

// ─── createEmptyTarget ───
describe('createEmptyTarget', () => {
    it('필수 필드 포함', () => {
        const t = createEmptyTarget();
        expect(t.targetNumber).toBe('');
        expect(t.dayNight).toBe('Day');
        expect(t.assignedPilots).toEqual([]);
        expect(t.resolved).toBe(false);
        expect(t.result).toBe('');
        expect(t.vp).toBe('');
        expect(t.recon).toBe('');
        expect(t.intel).toBe('');
        expect(t.infra).toBe('');
        expect(t.baseStress).toBe('');
    });

    it('매 호출마다 새 객체 반환', () => {
        const a = createEmptyTarget();
        const b = createEmptyTarget();
        expect(a).not.toBe(b);
        a.targetNumber = '42';
        expect(b.targetNumber).toBe('');
    });
});

// ─── getNextRank ───
describe('getNextRank', () => {
    it('Newbie → Green', () => expect(getNextRank('Newbie')).toBe('Green'));
    it('Green → Average', () => expect(getNextRank('Green')).toBe('Average'));
    it('Average → Skilled', () => expect(getNextRank('Average')).toBe('Skilled'));
    it('Skilled → Veteran', () => expect(getNextRank('Skilled')).toBe('Veteran'));
    it('Veteran → Ace', () => expect(getNextRank('Veteran')).toBe('Ace'));
    it('Ace → null (최고 랭크)', () => expect(getNextRank('Ace')).toBeNull());
    it('알 수 없는 랭크 → null', () => expect(getNextRank('Unknown')).toBeNull());
});

// ─── getPilotRankStats ───
describe('getPilotRankStats', () => {
    it('hasStats=false → null', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: false };
        expect(getPilotRankStats(pilot, MOCK_PILOTS)).toBeNull();
    });

    it('유효한 파일럿 → stats 반환', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true };
        const rs = getPilotRankStats(pilot, MOCK_PILOTS);
        expect(rs).not.toBeNull();
        expect(rs.stats.XP).toBe(4);
        expect(rs.stats.Cooldown).toBe(1);
    });

    it('존재하지 않는 이름 → null', () => {
        const pilot = { name: 'Ghost', rank: 'Average', hasStats: true };
        expect(getPilotRankStats(pilot, MOCK_PILOTS)).toBeNull();
    });

    it('Stats 없는 파일럿 → null', () => {
        const pilot = { name: 'NoStats', rank: 'Average', hasStats: true };
        expect(getPilotRankStats(pilot, MOCK_PILOTS)).toBeNull();
    });

    it('해당 랭크 Stats 없으면 → null', () => {
        const pilot = { name: 'Viper', rank: 'Ace', hasStats: true };
        expect(getPilotRankStats(pilot, MOCK_PILOTS)).toBeNull();
    });
});

// ─── getStatus ───
describe('getStatus', () => {
    it('hasStats=false → Okay', () => {
        const pilot = { name: 'NoStats', rank: 'Average', hasStats: false, stress: 10 };
        expect(getStatus(pilot, MOCK_PILOTS)).toBe('Okay');
    });

    it('스트레스 0 → Okay', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true, stress: 0 };
        expect(getStatus(pilot, MOCK_PILOTS)).toBe('Okay');
    });

    it('Okay 범위 상한 → Okay', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true, stress: 3 };
        expect(getStatus(pilot, MOCK_PILOTS)).toBe('Okay');
    });

    it('Shaken 범위 하한 → Shaken', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true, stress: 4 };
        expect(getStatus(pilot, MOCK_PILOTS)).toBe('Shaken');
    });

    it('Shaken 범위 상한 → Shaken', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true, stress: 6 };
        expect(getStatus(pilot, MOCK_PILOTS)).toBe('Shaken');
    });

    it('Shaken 초과 → Unfit', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true, stress: 7 };
        expect(getStatus(pilot, MOCK_PILOTS)).toBe('Unfit');
    });
});

// ─── getXpToPromote ───
describe('getXpToPromote', () => {
    it('유효한 파일럿 → XP 값 반환', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true };
        expect(getXpToPromote(pilot, MOCK_PILOTS)).toBe(4);
    });

    it('Skilled 랭크 → 6', () => {
        const pilot = { name: 'Viper', rank: 'Skilled', hasStats: true };
        expect(getXpToPromote(pilot, MOCK_PILOTS)).toBe(6);
    });

    it('Stats 없으면 → null', () => {
        const pilot = { name: 'NoStats', rank: 'Average', hasStats: false };
        expect(getXpToPromote(pilot, MOCK_PILOTS)).toBeNull();
    });
});

// ─── getMaxStress ───
describe('getMaxStress', () => {
    it('유효한 파일럿 → Shaken 상한값', () => {
        const pilot = { name: 'Viper', rank: 'Average', hasStats: true };
        expect(getMaxStress(pilot, MOCK_PILOTS)).toBe(6);
    });

    it('Stats 없으면 → "?"', () => {
        const pilot = { name: 'NoStats', rank: 'Average', hasStats: false };
        expect(getMaxStress(pilot, MOCK_PILOTS)).toBe('?');
    });
});

// ─── recoverPilots ───
describe('recoverPilots', () => {
    function makeSquadron() {
        return [
            { name: 'A', stress: 5, cooldown: 1, shotDown: false },  // recovers: 5 - (1+2) = 2
            { name: 'B', stress: 3, cooldown: 2, shotDown: false },  // recovers: 3 - (2+2) = 0 (clamped)
            { name: 'C', stress: 4, cooldown: 0, shotDown: true },   // shotDown → skipped
            { name: 'D', stress: 1, cooldown: 0, shotDown: false },  // recovers: 1 - (0+2) = 0 (clamped)
        ];
    }

    it('shotDown 제외 전체 회복', () => {
        const sq = makeSquadron();
        recoverPilots(sq);
        expect(sq[0].stress).toBe(2);   // 5 - 3
        expect(sq[1].stress).toBe(0);   // max(0, 3 - 4)
        expect(sq[2].stress).toBe(4);   // shotDown, unchanged
        expect(sq[3].stress).toBe(0);   // max(0, 1 - 2)
    });

    it('filter로 특정 파일럿만 회복', () => {
        const sq = makeSquadron();
        const exclude = new Set([0]);   // index 0 제외
        recoverPilots(sq, (pilot, idx) => !exclude.has(idx));
        expect(sq[0].stress).toBe(5);   // filtered out
        expect(sq[1].stress).toBe(0);   // recovered
        expect(sq[2].stress).toBe(4);   // shotDown
        expect(sq[3].stress).toBe(0);   // recovered
    });

    it('스트레스가 0 미만으로 내려가지 않음', () => {
        const sq = [{ name: 'X', stress: 0, cooldown: 5, shotDown: false }];
        recoverPilots(sq);
        expect(sq[0].stress).toBe(0);
    });
});
