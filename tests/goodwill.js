// Goodwill (VB-217; design.md, The gift): a kin gift books its worth between the two holders, mirrored; balances halve in 4 years, net
// against each other, keep at most 32 counterparts, pass half at a retirement, end at a death, are forgotten under a ration each season,
// and survive a save.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const R = VB['sim/relations'], { issue } = VB['sim/commands'], { killPawn, retireHolder } = VB['sim/lifecycle'];
const { floorOf } = VB['sim/hunger'], { GOODWILL } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const w = r.value, st = Sim.seed(w, 7, 'populous');
const near = (x, y, what) => assert(Math.abs(x - y) < 1e-9, `${what}: ${x}, expected ${y}`);
// goodwill's invariants only: the clock is moved by hand below, which leaves age-based caches stale (tests/invariants.js checks all of them)
const ok = (what) => { const bad = checkState(st).filter((m) => m.includes('goodwill')); assert.deepStrictEqual(bad, [], `${what}: ${bad.slice(0, 3).join('; ')}`); };
const holders = st.households.filter((h) => !h.dissolved && h.holder !== null);
const [A, B] = holders, a = A.holder, b = B.holder;

// a kin gift between two holders books its worth on both sides
A.grain = floorOf(st, A) + st.pawns[a].buffer * 100 + 500;
assert.strictEqual(issue(st, { actor: a, verb: 'give', target: B.id, args: { good: 'grain', n: 40 }, source: 'help' }), true);
near(R.balance(st, a, b), 40, 'the giver is owed the gift'); near(R.balance(st, b, a), -40, 'the receiver owes it');
assert.strictEqual(R.goodwillSince(st, a, b), st.t); assert.strictEqual(st.pawns[a].goodwill.get(b).why, 'help');
ok('after a gift');

// it halves in 4 years, read in closed form, with nothing written
const t0 = st.t; st.t += GOODWILL.halfLife;
near(R.balance(st, a, b), 20, 'halved in 4 years'); assert.strictEqual(st.pawns[a].goodwill.get(b).v, 40, 'reading writes nothing');
// a gift back nets against it; a larger one changes its sign and reopens it
R.book(st, b, a, 5, 'help'); near(R.balance(st, a, b), 15, 'netted'); assert.strictEqual(R.goodwillSince(st, a, b), t0, 'same sign, same age');
R.book(st, b, a, 25, 'help'); near(R.balance(st, a, b), -10, 'turned'); assert.strictEqual(R.goodwillSince(st, a, b), st.t, 'reopened');
ok('after netting');

// at the cap, a new counterpart drops the smallest balance, on both sides
const others = st.pawns.filter((p) => p.alive && p.id !== a && p.id !== b).slice(0, GOODWILL.cap);
others.forEach((p, i) => R.book(st, a, p.id, 2 + i, 'help')); // a's balances: b (-10) and 2, 3, ...; the 32nd counterpart pushes 2 out
assert.strictEqual(st.pawns[a].goodwill.size, GOODWILL.cap, 'held at the cap');
assert(!st.pawns[a].goodwill.has(others[0].id) && !st.pawns[others[0].id].goodwill.has(a), 'the smallest went, on both sides');
assert(st.pawns[a].goodwill.has(b), 'a larger one stayed');
ok('at the cap');

// the seasonal pass forgets a balance under a ration
R.book(st, others[5].id, others[6].id, 0.5, 'help');
VB['sim/relations'].fadeRelations(st);
assert(!st.pawns[others[5].id].goodwill.has(others[6].id), 'under a ration, forgotten');
ok('after the seasonal pass');

// a save keeps the balances
const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(w, data);
assert.deepStrictEqual([...back.pawns[a].goodwill], [...st.pawns[a].goodwill], 'saved and loaded');

// a retirement passes half of the old holder's balances to the new holder; the old holder keeps half
const H = holders.find((h) => h !== A && h !== B && VB['sim/heirs'].heirRanking(st, h).length);
const old = H.holder, partner = others[10].id, other2 = others[11].id;
R.book(st, old, partner, 60, 'help'); R.book(st, other2, old, 20, 'help');
assert(retireHolder(st, H.id), 'retired'); const heir = H.holder; assert.notStrictEqual(heir, old);
near(R.balance(st, old, partner), 30, 'the retired holder keeps half'); near(R.balance(st, heir, partner), 30, 'the heir is owed half');
near(R.balance(st, heir, other2), -10, 'and owes half of what was owed'); ok('after a retirement');

// a death ends the pawn's balances on both sides
killPawn(st, partner, 'killed');
assert.strictEqual(st.pawns[partner].goodwill, undefined, 'the dead keep no map'); assert(!st.pawns[heir].goodwill.has(partner) && !st.pawns[old].goodwill.has(partner));
ok('after a death');
console.log(`goodwill ok: booking, decay, netting, the cap of ${GOODWILL.cap}, the seasonal pass, a save, a retirement and a death`);
