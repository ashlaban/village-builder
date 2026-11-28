// @suite integration
// Store views (VB-092): on the heirs scenario at day 0, Sim.storesOf for "village A, owns" has a row for each of A's households and a
// total row equal to their sums, the village's own store as a row of its own, and household rows that read as the household panel's
// values (page/cards storesTab: Sim.grainOf, Sim.seedReserve, hh.flour, hh.meals, the sheaves, Sim.larderOf, hh.wood, hh.peat).
const VB = require('../src/load.js'), Sim = VB.sim;
const { scenario } = require('./lib/probe.js'), assert = require('assert');
const st = scenario('heirs'), A = 0;
const S = Sim.storesOf(st, { level: 'village', ids: [A], dim: 'owns' });
const hhA = st.households.filter((h) => !h.dissolved && st.farmsteads[h.farmstead].village === A).map((h) => h.id);
assert.deepStrictEqual(S.rows.map((r) => r.id), hhA, "a row for each of village A's households");
const near = (a, b, what) => assert(Math.abs(a - b) < 1e-9, `${what}: ${a} against ${b}`);
for (const c of S.columns) near(S.total[c.key], S.rows.reduce((s, r) => s + r[c.key], 0), `the total of ${c.key}`);
near(S.total.need, S.rows.reduce((s, r) => s + r.need, 0), 'the total need');
assert(S.total.grain > 0, 'village A holds grain');
for (const r of S.rows) {
  const hh = st.households[r.id], n = (x) => Math.round(x || 0);
  // the household panel's numbers, as its Stores tab rounds them
  const panel = {
    grain: n(Sim.grainOf(hh)),
    seed: n(Sim.seedReserve(st, hh)),
    flour: n(hh.flour),
    meals: n(hh.meals),
    sheaves: n(hh.unthreshed.reduce((s, x) => s + x, 0)),
    'dried fish': n(Sim.larderOf(hh, 'dried fish')),
    wood: n(hh.wood),
    peat: n(hh.peat),
  };
  for (const [k, v] of Object.entries(panel)) assert.strictEqual(n(r[k]), v, `household ${r.id}: ${k}`);
  assert(r.need > 0, `household ${r.id} has people to feed`);
}
assert.strictEqual(S.villages.length, 1, 'the village store is a row of its own');
const V = S.villages[0];
assert.strictEqual(V.id, A);
near(V.grain, Sim.grainOf(st.villages[A]), "the village's grain");
near(V.need, S.total.need, "the village's grain in days of its households' food");
assert.strictEqual(V.wood, null, 'a village holds no firewood');
// a household scope: one row, no village row
const H = Sim.storesOf(st, { level: 'household', ids: [hhA[0]], dim: 'owns' });
assert.deepStrictEqual([H.rows.length, H.villages.length], [1, 0], 'a household scope: its row alone');
assert.deepStrictEqual(H.rows[0], S.rows[0], 'the same row in either scope');
console.log(`storeview: village A, ${S.rows.length} households, totals equal their sums; ${S.columns.length} columns`);
