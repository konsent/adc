import assert from 'node:assert';
import { samLockOn, samShot, canLaunchArm, resolveArm, radarShutdown, radarReactivate } from '../rules/sam-arm.js';
const sam = { hex:{q:0,r:0}, killed:false, radar:true, qrc:false, ready:6, range:30, minAlt:3, lock:6, hit:6, rating:8, mti:false };
const jet = { hex:{q:0,r:10}, alt:20, flightType:'LVL' };
// QRC 미탑재는 1번째 기회 거부
assert.equal(samLockOn(sam, jet, {opportunity:1}).locked, false);
// TFF는 MTI 없으면 탐지 불가
assert.equal(samLockOn(sam, {...jet, tff:true}, {opportunity:2}).reason.includes('MTI'), true);
// 최소고도 미만 거부
assert.equal(samLockOn(sam, {...jet, alt:2}, {opportunity:2}).locked, false);
// 락온 성공/실패는 주사위로
assert.equal(samLockOn(sam, jet, {roll:3, opportunity:2}).locked, true);
assert.equal(samLockOn(sam, jet, {roll:9, opportunity:2}).locked, false);
// jinking은 명중 목표를 낮춘다
assert.ok(samShot(sam, {jinking:true}).target < samShot(sam, {}).target);
// ARM: 레이더 꺼진 표적 불가, 사거리 초과 불가, 턴당 2발 상한
assert.ok(canLaunchArm(jet, {...sam, radarOff:true}, 'shrike', {}));
assert.ok(canLaunchArm({...jet, hex:{q:0,r:100}}, sam, 'shrike', {}));
assert.ok(canLaunchArm(jet, sam, 'shrike', {armAttacksUsed:2}));
assert.equal(canLaunchArm(jet, sam, 'shrike', {armAttacksUsed:1}), null);
// 선회 중 발사 불가
assert.ok(canLaunchArm({...jet, turnProgress:1}, sam, 'shrike', {}));
// TGL: 짝수 명중 + D 이상 → 레이더 영구 파괴 / 피해 상한 2D
const r = resolveArm(sam, 'shrike', {hitRoll:4, damageRoll:1, tglRoll:9});
assert.equal(r.result, '2D'); assert.equal(r.radarDisabled, true); assert.equal(r.unit.hits, 2);
// 홀수 명중은 TGL 없음
assert.equal(resolveArm(sam,'shrike',{hitRoll:3,damageRoll:1,tglRoll:1}).radarDisabled, false);
assert.equal(resolveArm(sam,'shrike',{hitRoll:9}).hit, false);
// 셧다운/재가동 1d10<=6
assert.equal(radarShutdown(sam, 6).success, true);
assert.equal(radarShutdown(sam, 7).success, false);
assert.equal(radarReactivate({...sam, radarOff:true}, 6).success, true);
assert.equal(radarShutdown({...sam, radarDisabled:true}), null);
console.log('T-6 SAM/ARM checks passed');
