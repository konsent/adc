import assert from 'node:assert/strict';
import { vcAssault } from '../rules/ground-combat.js';

const gb = { id: 'gb', hex: { q: 0, r: 0 }, defense: 1, fragile: true };
const at = (extra = {}) => ({ hex: { q: 1, r: 0 }, ...extra });
const far = { hex: { q: 9, r: 9 } };

// 참고 3: 인접 유닛만 참가한다.
assert.equal(vcAssault([at(), at(), far], gb, 5).attackers, 2);

// 참고 3: 억제된 유닛도 참가한다(제외되지 않는다).
assert.equal(vcAssault([at({ suppressed: true }), at()], gb, 5).attackers, 2);

// 참고 3: 억제 1건당 +1, "D" 명중 1건당 +1.
assert.equal(vcAssault([at({ suppressed: true, hits: 2 }), at()], gb, 5).drm, 3);

// "+1"은 공격자에게 불리해야 한다: 페널티가 클수록 판정 점수가 높아진다.
const clean = vcAssault([at(), at(), at()], gb, 4);
const hurt = vcAssault([at({ suppressed: true }), at(), at()], gb, 4);
assert.equal(hurt.score, clean.score + 1);
assert.equal(clean.ratio, hurt.ratio); // 억제되어도 비율 열은 그대로

// 파괴된 유닛은 참가하지 않는다.
assert.equal(vcAssault([at({ killed: true }), at()], gb, 5).attackers, 1);

console.log('vc-assault: ok');
