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
const quantity = (h) => h.grain + (h.rations || 0) + (h.unthreshed || []).reduce((n, x) => n + x, 0);
const isFood = (e) => !e.stake && ['grain', 'rations', 'sheaves'].includes(e.good);
let entries = 0;
for (const scenario of ['founders', 'populous']) {
  const it = VB.gen.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
  const state = Sim.seed(r.value, 7, scenario);
  for (let year = 0; year < 3; year++) {
    const t = state.t, before = new Map([...state.households, ...state.villages].map((h) => [h, quantity(h)]));
    Sim.advance(state, Sim.YEAR);
    for (const h of [...state.households, ...state.villages]) {
      const changes = h.ledger.filter((e) => e.t > t && isFood(e)), sum = changes.reduce((n, e) => n + e.n, 0);
      entries += changes.length;
      assert(Math.abs(quantity(h) - (before.get(h) || 0) - sum) <= 1e-6 * Math.max(1, changes.length),
        `${scenario} year ${year + 1} holder ${h.id}: change ${quantity(h) - (before.get(h) || 0)}, ledger ${sum}`);
    }
  }
}
console.log(`stores: errors, capped transfers, conversions and ${entries} annual food entries reconcile`);
