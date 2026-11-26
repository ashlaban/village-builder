// A wish for a match that fails is told (VB-1113): the wished partner marries another (a personal event that stops a skip), and the
// round passes the wish by (told with the round's reason; the wish stands).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, MT = VB['sim/matching'], N = VB['sim/notable'], R = VB['sim/records'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 1 });
const man = st.living.map((i) => st.pawns[i]).find((p) => p.sex === 'm' && p.age >= 18 && R.spouseOf(st, p.id) === null);
const women = st.living.map((i) => st.pawns[i]).filter((p) => p.sex === 'f' && p.id !== man.id);
const other = st.living.map((i) => st.pawns[i]).find((p) => p.sex === 'm' && p.id !== man.id);
assert(man && women.length && other);
assert.strictEqual(Sim.inhabit(st, man.id), true);
const told = () => st.pawns[man.id].events.map((i) => st.record[i]).filter((e) => e.kind === 'wishLapsed');
const she = women[0];
assert.strictEqual(Sim.wish(st, st.player.pawn, 'match', she.id), true);
// the wished partner marries another: the wish is cleared, and the pawn told
VB['sim/player'].clearMatchWish(st, other.id, she.id);
assert.strictEqual(Sim.wishesOf(st, man.id).match, null, 'the wish is cleared');
assert.strictEqual(told().length, 1);
assert(/^Your wish for .* lapsed: she married /.test(told()[0].text), told()[0].text);
const from = { ...N.skipFrom(st, null), n: st.record.length - 1 };
assert.strictEqual(N.skipStop(st, from).why, 'wish', 'the skip stops on it');
// the round passes a wish by on its rules: a girl too young, told at the round, and the wish stands
const girl = women.find((p) => p.age < 14) || (() => { const g = women[1]; g.born = st.t - 8 * VB['sim/rules'].YEAR; return g; })();
assert.strictEqual(Sim.wish(st, st.player.pawn, 'match', girl.id), true);
const before = told().length;
MT.wishedMatches(st, [], 0, MT.matchRules(st), new Set());
assert.strictEqual(told().length, before + 1, 'the round tells the wish passed by');
assert(/^The round passed over your wish for .*: .*too young/.test(told().pop().text));
assert.strictEqual(Sim.wishesOf(st, man.id).match, girl.id, 'the wish stands');
console.log('wishlapse ok');
