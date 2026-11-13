// Stores arithmetic, error handling and complete annual food reconciliation.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stores'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const st = tinyState(tinyWorld(Array(12).fill('.'.repeat(20))), [{ at: [8, 6], farms: 2 }], { seed: 7 });
const a = st.households[0], b = st.households[1], v = st.villages[0];
S.start(st, a, { barley: 10 }); S.start(st, b, {});
assert.strictEqual(S.move(st, a, b, 'grain', 20, 'gift'), 10);
assert.strictEqual(S.grainOf(a), 0); assert.strictEqual(S.grainOf(b), 10);
S.cook(st, b, 'grain', 4); assert.strictEqual(S.grainOf(b) + b.meals, 10);
S.sheaf(st, b, 8); S.thresh(st, b); assert.strictEqual(S.grainOf(b) + b.meals, 18);
for (const n of [-1, NaN, Infinity]) for (const op of ['put', 'take']) assert.throws(() => S[op](st, b, 'grain', n, 'gift'), /amount/);
assert.throws(() => S.move(st, b, { ...a, dissolved: true }, 'grain', 1, 'gift'), /dissolved/);
assert.strictEqual(S.grainOf(b), 14, 'invalid recipient must not debit sender');
assert.throws(() => S.put(st, v, 'meals', 1, 'gift'), /cannot hold/);
// VB-237: a holder is a household, a village or a pawn; an agent record, a farmstead and {} are refused and left unchanged.
for (const bad of [{ id: 0, x: 1, y: 1 }, { id: 0, tile: 1, household: 0 }, {}]) {
  const before = JSON.stringify(bad);
  for (const op of ['put', 'take']) assert.throws(() => S[op](st, bad, 'grain', 3, 'gift'), /not a holder/);
  assert.throws(() => S.move(st, bad, a, 'grain', 1, 'gift'), /not a holder/);
  assert.throws(() => S.move(st, a, bad, 'grain', 1, 'gift'), /not a holder/);
  assert.strictEqual(JSON.stringify(bad), before, 'a refused holder is unchanged');
}
assert.throws(() => S.put(st, b, 'grain/barley', 1, 'unknown'), /reason/);
// VB-204: routine kinds add to a yearly total per holder, kind and good; other kinds stay entries.
{
  const c = tinyState(tinyWorld(Array(12).fill('.'.repeat(20))), [{ at: [8, 6], farms: 1 }], { seed: 7 }), h = c.households[0];
  S.start(c, h, { barley: 50 }); const n0 = h.ledger.length;
  S.cook(c, h, 'grain', 4); S.cook(c, h, 'grain', 6); S.spoil(c, h, 1);
  assert.strictEqual(h.ledger.length, n0, 'routine movements write no entry');
  const y = S.yearNow(c), grain = h.totals.find((x) => x.kind === 'cooking' && x.good === 'grain');
  assert.deepStrictEqual(grain, { year: y, kind: 'cooking', good: 'grain', n: -10, count: 2 });
  assert.strictEqual(S.yearSum(h, 'cooking', y), 0, 'cooking moves grain into meals');
  assert.strictEqual(h.totals.length, 3, 'one total per kind and good');
  const { YEAR, TICKS } = VB['sim/rules'], { moveClock } = require('./lib/clock.js');
  assert.strictEqual(S.yearNow({ tick: YEAR * TICKS }), 2, 'midnight at the year\'s turn belongs to the new year, as cal(hour)');
  assert.strictEqual(S.yearNow({ tick: YEAR * TICKS - 1 }), 1, 'the year\'s last step belongs to it');
  moveClock(c, 4 * YEAR); S.cook(c, h, 'grain', 1); S.prune(c);
  assert(h.totals.every((x) => x.year === S.yearNow(c)), 'totals of years before the last three are pruned');
  assert.throws(() => S.close(c, h), /dissolved/);
  h.dissolved = true; S.close(c, h); assert(!h.ledger.length && !h.totals.length, 'a dissolved household\'s ledger is emptied');
}
const quantity = (h) => S.grainOf(h) + (h.meals || 0) + (h.unthreshed || []).reduce((n, x) => n + x, 0);
const isFood = (e) => !e.stake && ['grain', 'meals', 'sheaves'].includes(e.good);
// Every holder's food since the seed equals its entries plus its yearly totals, checked at noon on each new year's first day, away
// from the midnight work at the year's turn (VB-204). Nothing is pruned within three years; a dissolved household's ledger is emptied.
let entries = 0, totals = 0;
for (const scenario of ['founders', 'populous']) {
  const it = VB.gen.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
  const state = Sim.seed(r.value, 7, scenario), t = state.t;
  const before = new Map([...state.households, ...state.villages].map((h) => [h, quantity(h)]));
  for (let year = 1; year <= 3; year++) {
    Sim.advance(state, year * Sim.YEAR + 12 - state.t);
    for (const h of [...state.households, ...state.villages]) {
      if (h.dissolved) { assert(!h.ledger.length && !h.totals.length, `${scenario}: dissolved household ${h.id} keeps a ledger`); continue; }
      const changes = h.ledger.filter((e) => e.t > t && isFood(e)), folded = h.totals.filter(isFood);
      const sum = changes.reduce((n, e) => n + e.n, 0) + folded.reduce((n, x) => n + x.n, 0);
      if (year === 3) { entries += changes.length; totals += folded.reduce((n, x) => n + x.count, 0); }
      assert(Math.abs(quantity(h) - (before.get(h) || 0) - sum) <= 1e-6 * Math.max(1, changes.length + folded.length),
        `${scenario} to year ${year + 1} holder ${h.id}: change ${quantity(h) - (before.get(h) || 0)}, ledger ${sum}`);
    }
  }
}
// VB-347: grain is held by crop (tests/grain.js takes two crops); with barley alone the sum is the number itself, to the last bit.
{
  const c = tinyState(tinyWorld(Array(12).fill('.'.repeat(20))), [{ at: [8, 6], farms: 2 }], { seed: 7 }), h = c.households[0];
  const CROPS = VB['sim/rules'].CROPS; // the rows with seed: fallow is a course, not a crop (VB-348)
  assert.deepStrictEqual(S.CROP_LIST, Object.keys(CROPS).filter((c) => CROPS[c].seed > 0));
  assert.strictEqual(S.grainGood('barley'), 'grain/barley'); assert.throws(() => S.grainGood('wheat'), /unknown crop/);
  S.start(c, h, { barley: 0.1 + 0.2 }); assert.strictEqual(S.grainOf(h), 0.1 + 0.2, 'one crop: its number');
  S.take(c, h, 'grain', 0.1, 'meal'); assert.strictEqual(h.grain.barley, 0.1 + 0.2 - 0.1, 'one crop: the same subtraction as ever');
  S.takeSpare(c, h, 0.05, 'meal'); assert.strictEqual(h.grain.barley, 0.1 + 0.2 - 0.1 - 0.05, 'and from its spare grain');
  assert.throws(() => S.put(c, h, 'grain', 1, 'gift'), /by its crops/, 'grain is put by its crops');
  assert.throws(() => S.put(c, h, 'grain', 1, 'gift', { barley: 2 }), /by its crops/, 'the crops sum to what is put');
  assert.throws(() => S.start(c, h, 5), /by crop/, 'a start names its crops');
  assert.throws(() => S.start(c, h, { wheat: 5 }), /by crop/, 'only crops of the table');
  assert.throws(() => S.reserve(c, h, VB['sim/plans'].planOf(c, 'household', h.id), 'grain', 1, 'seed'), /by its crop/, 'a reservation names its crop');
  assert(h.ledger.every((e) => e.good !== 'grain/barley'), 'the ledger counts grain whatever its crop');
}
console.log(`stores: errors, capped transfers, conversions, yearly totals, grain by crop; ${entries} food entries and ${totals} movements in totals reconcile`);
