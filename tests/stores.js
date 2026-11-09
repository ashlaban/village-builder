// Stores arithmetic, error handling and complete annual food reconciliation.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stores'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const st = tinyState(tinyWorld(Array(12).fill('.'.repeat(20))), [{ at: [8, 6], farms: 2 }], { seed: 7 });
const a = st.households[0], b = st.households[1], v = st.villages[0];
S.start(st, a, 10); S.start(st, b, 0);
assert.strictEqual(S.move(st, a, b, 'grain', 20, 'gift'), 10);
assert.strictEqual(a.grain, 0); assert.strictEqual(b.grain, 10);
S.cook(st, b, 4); assert.strictEqual(b.grain + b.rations, 10);
S.sheaf(st, b, 8); S.thresh(st, b); assert.strictEqual(b.grain + b.rations, 18);
for (const n of [-1, NaN, Infinity]) for (const op of ['put', 'take']) assert.throws(() => S[op](st, b, 'grain', n, 'gift'), /amount/);
assert.throws(() => S.move(st, b, { ...a, dissolved: true }, 'grain', 1, 'gift'), /dissolved/);
assert.strictEqual(b.grain, 14, 'invalid recipient must not debit sender');
assert.throws(() => S.put(st, v, 'rations', 1, 'gift'), /cannot hold/);
assert.throws(() => S.put(st, b, 'grain', 1, 'unknown'), /reason/);
// VB-204: routine kinds add to a yearly total per holder, kind and good; other kinds stay entries.
{
  const c = tinyState(tinyWorld(Array(12).fill('.'.repeat(20))), [{ at: [8, 6], farms: 1 }], { seed: 7 }), h = c.households[0];
  S.start(c, h, 50); const n0 = h.ledger.length;
  S.cook(c, h, 4); S.cook(c, h, 6); S.spoil(c, h, 1);
  assert.strictEqual(h.ledger.length, n0, 'routine movements write no entry');
  const y = S.yearOf(c.t), grain = h.totals.find((x) => x.kind === 'cooking' && x.good === 'grain');
  assert.deepStrictEqual(grain, { year: y, kind: 'cooking', good: 'grain', n: -10, count: 2 });
  assert.strictEqual(S.yearSum(h, 'cooking', y), 0, 'cooking moves grain into rations');
  assert.strictEqual(h.totals.length, 3, 'one total per kind and good');
  assert.strictEqual(S.yearOf(VB['sim/rules'].YEAR - 1e-10), 2, 'midnight at the year\'s turn belongs to the new year, as cal(hour)');
  c.t += 4 * VB['sim/rules'].YEAR; S.cook(c, h, 1); S.prune(c);
  assert(h.totals.every((x) => x.year === S.yearOf(c.t)), 'totals of years before the last three are pruned');
  assert.throws(() => S.close(c, h), /dissolved/);
  h.dissolved = true; S.close(c, h); assert(!h.ledger.length && !h.totals.length, 'a dissolved household\'s ledger is emptied');
}
const quantity = (h) => h.grain + (h.rations || 0) + (h.unthreshed || []).reduce((n, x) => n + x, 0);
const isFood = (e) => !e.stake && ['grain', 'rations', 'sheaves'].includes(e.good);
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
console.log(`stores: errors, capped transfers, conversions, yearly totals; ${entries} food entries and ${totals} movements in totals reconcile`);
