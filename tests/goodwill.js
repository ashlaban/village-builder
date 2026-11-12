// Goodwill (VB-217; design.md, The gift): a kin gift books its worth between the two holders, one signed balance {v, t} mirrored on both,
// read as v halved every GOODWILL.halfLife years since t (tunable from 2 to 20), so a large balance loses more than a small one and no step
// decays it; balances net, keep at most 32 counterparts, read as 0 once under a ration and are dropped when a pawn next books, pass half at
// a retirement, end at a death, and survive a save.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { moveClock } = require('./lib/clock.js');
const R = VB['sim/relations'], { issue } = VB['sim/commands'], { killPawn, retireHolder } = VB['sim/lifecycle'];
const { floorOf } = VB['sim/hunger'], { GOODWILL } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const w = r.value, st = Sim.seed(w, 7, 'populous');
const near = (x, y, what, tol = 1e-9) => assert(Math.abs(x - y) < tol, `${what}: ${x}, expected ${y}`);
// goodwill's invariants only: the decay checks move a clock by hand, which leaves age-based caches stale (tests/invariants.js checks all)
const ok = (s, what) => { const bad = checkState(s).filter((m) => m.includes('goodwill')); assert.deepStrictEqual(bad, [], `${what}: ${bad.slice(0, 3).join('; ')}`); };
const holders = st.households.filter((h) => !h.dissolved && h.holder !== null);
const [A, B] = holders, a = A.holder, b = B.holder;
const alive = (s) => s.pawns.filter((p) => p.alive).map((p) => p.id);

// a kin gift between two holders books its worth on both sides
A.grain = { barley: floorOf(st, A) + st.pawns[a].buffer * 100 + 500 };
assert.strictEqual(issue(st, { actor: a, verb: 'give', target: B.id, args: { good: 'grain', n: 40 }, source: 'help' }), true);
near(R.balance(st, a, b), 40, 'the giver is owed the gift'); near(R.balance(st, b, a), -40, 'the receiver owes it');
assert.deepStrictEqual(st.pawns[a].goodwill.get(b), { v: 40, t: st.t }); assert.deepStrictEqual(st.pawns[b].goodwill.get(a), { v: -40, t: st.t });
// a gift back nets against it, and a larger one turns it
R.book(st, b, a, 15); near(R.balance(st, a, b), 25, 'netted');
R.book(st, b, a, 35); near(R.balance(st, a, b), -10, 'turned');
ok(st, 'after gifts');

{ // decay when read, on a state of its own, whose clock is moved by hand
  const s = Sim.seed(w, 7, 'populous'), [x, y, z, u] = alive(s), half = GOODWILL.halfLife;
  for (const years of [2, 4, 20]) {
    GOODWILL.halfLife = years; R.book(s, x, y, 40);
    const before = s.pawns[x].goodwill.get(y);
    moveClock(s, years * Sim.YEAR); near(R.balance(s, x, y), 20, `halved in ${years} years`, 1e-9);
    assert.strictEqual(s.pawns[x].goodwill.get(y), before, 'reading writes nothing');
    R.addGoodwill(s, x, y, -R.balance(s, x, y)); assert(!s.pawns[x].goodwill.has(y), 'cancelled to nothing, dropped');
  }
  GOODWILL.halfLife = half;
  R.book(s, x, y, 100); R.book(s, x, z, 10); moveClock(s, Sim.YEAR);
  near((100 - R.balance(s, x, y)) / (10 - R.balance(s, x, z)), 10, 'a large balance loses more, in proportion');
  // under a ration it reads as 0 and is still stored, until x books again
  R.book(s, x, u, 1.5); moveClock(s, 4 * Sim.YEAR); // 1.5 halves to 0.75
  assert.strictEqual(R.balance(s, x, u), 0, 'forgotten reads as 0'); assert(s.pawns[x].goodwill.has(u), 'not yet dropped');
  assert(!R.goodwillOf(s, x).some((g) => g.other === u), 'not listed');
  R.book(s, x, y, 5); assert(!s.pawns[x].goodwill.has(u) && !s.pawns[u].goodwill.has(x), 'dropped, on both sides, when x booked');
  ok(s, 'after decay');
}

// at the cap, a new counterpart drops the smallest balance, on both sides
const others = st.pawns.filter((p) => p.alive && p.id !== a && p.id !== b).slice(0, GOODWILL.cap);
others.forEach((p, i) => R.book(st, a, p.id, 2 + i));
assert.strictEqual(st.pawns[a].goodwill.size, GOODWILL.cap, 'held at the cap');
assert(!st.pawns[a].goodwill.has(others[0].id) && !st.pawns[others[0].id].goodwill.has(a), 'the smallest went, on both sides');
assert(st.pawns[a].goodwill.has(b), 'a larger one stayed');
ok(st, 'at the cap');

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
near(R.balance(st, heir, other2), -10, 'and owes half of what was owed'); ok(st, 'after a retirement');

// a death ends the pawn's balances on both sides, and its map
killPawn(st, partner, 'killed');
assert.strictEqual(st.pawns[partner].goodwill, undefined, 'the dead keep no map');
assert(!st.pawns[heir].goodwill.has(partner) && !st.pawns[old].goodwill.has(partner));
ok(st, 'after a death');
console.log(`goodwill ok: booking, netting, decay when read halving in 2, 4 and 20 years, forgetting when touched, the cap of ${GOODWILL.cap}, `
  + 'a save, a retirement and a death');
