// Goodwill (VB-217; design.md, The gift): a kin gift books its worth between the two holders, one signed number mirrored on both; it decays
// toward zero by a step each season, halving in GOODWILL.halfLife years (tunable from 2 to 20), large balances losing more than small;
// balances net against each other, keep at most 32 counterparts, pass half at a retirement, end at a death, are forgotten under a ration,
// and survive a save.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const R = VB['sim/relations'], { issue } = VB['sim/commands'], { killPawn, retireHolder } = VB['sim/lifecycle'];
const { floorOf } = VB['sim/hunger'], { GOODWILL } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const w = r.value, st = Sim.seed(w, 7, 'populous');
const near = (x, y, what, tol = 1e-9) => assert(Math.abs(x - y) < tol, `${what}: ${x}, expected ${y}`);
const ok = (what) => { const bad = checkState(st).filter((m) => m.includes('goodwill')); assert.deepStrictEqual(bad, [], `${what}: ${bad.slice(0, 3).join('; ')}`); };
const season = (p) => R.decayGoodwill(st, st.pawns[p]); // one season's step for the pairs where p has the lower id
const holders = st.households.filter((h) => !h.dissolved && h.holder !== null);
const [A, B] = holders, a = Math.min(A.holder, B.holder), b = Math.max(A.holder, B.holder), giver = A.holder === a ? A : B;

// a kin gift between two holders books its worth on both sides
giver.grain = floorOf(st, giver) + st.pawns[a].buffer * 100 + 500;
assert.strictEqual(issue(st, { actor: a, verb: 'give', target: (giver === A ? B : A).id, args: { good: 'grain', n: 40 }, source: 'help' }), true);
near(R.balance(st, a, b), 40, 'the giver is owed the gift'); near(R.balance(st, b, a), -40, 'the receiver owes it');
ok('after a gift');

// it decays toward zero by a step each season, halving in the half-life; a large balance loses more than a small one
const half = GOODWILL.halfLife;
for (const years of [2, 4, 20]) {
  GOODWILL.halfLife = years; R.addGoodwill(st, a, b, 40 - R.balance(st, a, b)); // back to 40
  for (let s = 0; s < 4 * years; s++) season(a);
  near(R.balance(st, a, b), 20, `halved in ${years} years`, 1e-6);
}
GOODWILL.halfLife = half; R.addGoodwill(st, a, b, 100 - R.balance(st, a, b));
const c = st.pawns.find((p) => p.alive && p.id > b).id; R.book(st, a, c, 10);
season(a);
const lost100 = 100 - R.balance(st, a, b), lost10 = 10 - R.balance(st, a, c);
near(lost100 / lost10, 10, 'loss proportional to size'); near(R.balance(st, c, a), -R.balance(st, a, c), 'the mirror decays with it');
// a gift back nets against it, and may turn it
R.book(st, b, a, 30); near(R.balance(st, a, b), 100 - lost100 - 30, 'netted');
R.book(st, b, a, 200); assert(R.balance(st, a, b) < 0 && R.balance(st, b, a) > 0, 'turned');
ok('after decay and netting');

// at the cap, a new counterpart drops the smallest balance, on both sides
const others = st.pawns.filter((p) => p.alive && p.id !== a && p.id !== b && p.id !== c).slice(0, GOODWILL.cap);
others.forEach((p, i) => R.book(st, a, p.id, 2 + i));
assert.strictEqual(st.pawns[a].goodwill.size, GOODWILL.cap, 'held at the cap');
assert(!st.pawns[a].goodwill.has(others[0].id) && !st.pawns[others[0].id].goodwill.has(a), 'the smallest went, on both sides');
assert(st.pawns[a].goodwill.has(b), 'a larger one stayed');
ok('at the cap');

// the seasonal step forgets a balance that decays under a ration
const [x, y] = [others[5].id, others[6].id].sort((m, n) => m - n); R.book(st, x, y, 1.02);
season(x); assert(!st.pawns[x].goodwill.has(y) && !st.pawns[y].goodwill.has(x), 'under a ration, forgotten');
ok('after the seasonal step');

// a save keeps the balances
const back = Sim.load(w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual([...back.pawns[a].goodwill], [...st.pawns[a].goodwill], 'saved and loaded');

// a retirement passes half of the old holder's balances to the new holder; the old holder keeps half
const H = holders.find((h) => h !== A && h !== B && VB['sim/heirs'].heirRanking(st, h).length);
const outside = others.filter((p) => p.household !== H.id && st.pawns[p.id].alive); // not the heir, nor its housemates
const old = H.holder, partner = outside[10].id, other2 = outside[11].id;
R.book(st, old, partner, 60); R.book(st, other2, old, 20);
assert(retireHolder(st, H.id), 'retired'); const heir = H.holder; assert.notStrictEqual(heir, old);
near(R.balance(st, old, partner), 30, 'the retired holder keeps half'); near(R.balance(st, heir, partner), 30, 'the heir is owed half');
near(R.balance(st, heir, other2), -10, 'and owes half of what was owed'); ok('after a retirement');

// a death ends the pawn's balances on both sides, and its map
killPawn(st, partner, 'killed');
assert.strictEqual(st.pawns[partner].goodwill, undefined, 'the dead keep no map');
assert(!st.pawns[heir].goodwill.has(partner) && !st.pawns[old].goodwill.has(partner));
ok('after a death');
console.log(`goodwill ok: booking, a seasonal decay halving in 2, 4 and 20 years, netting, the cap of ${GOODWILL.cap}, forgetting, a save, `
  + 'a retirement and a death');
