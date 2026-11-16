// The food-flow account (tools/foodflow.js): one village's year closes pool by pool, every pool's links balance (a Sankey's nodes), the
// harvest by crop is the ledger's, the wrappers come off at the year's end, and the run is the same with or without it.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, G = VB.gen, Stores = VB['sim/stores'], { sha, canon } = require('./lib/canon.js');
const Flow = require('../tools/foodflow.js');
const world = () => { const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; }; // a run changes its world
const hash = (st) => sha(Object.keys(st).sort().map((k) => `${k}:${canon(st[k])}`).join('\n'));
const sheaf = Stores.sheaf, put = Stores.put;

// 1. the first year with the account and without it: the same state; the stores' functions are the module's again
const plain = Sim.seed(world(), 7, 'founders'); Sim.advance(plain, Sim.YEAR - plain.t);
const st = Sim.seed(world(), 7, 'founders'), first = Flow(VB, st, {});
first.advanceYear();
assert.strictEqual(st.t, Sim.YEAR, 'the account runs to the year\'s end');
assert.strictEqual(hash(st), hash(plain), 'the account changes the run');
assert(Stores.sheaf === sheaf && Stores.put === put, 'the wrappers are removed at the year\'s end');

// 2. the second year: each pool closes, each pool node's links balance, and the harvest by crop is the ledger's harvest
const f = Flow(VB, st, {});
f.advanceYear();
const r = f.result(), sum = (l) => l.reduce((s, x) => s + x.value, 0);
assert(r.village.households[0] > 0 && r.year === 2, `a village and the year: ${JSON.stringify(r.village)}, year ${r.year}`);
for (const [p, x] of Object.entries(r.pools)) assert(Math.abs(x.unexplained) <= 0.01 * Math.max(1, x.in), `${p}: ${x.unexplained} of ${x.in} unexplained`);
for (const n of r.nodes.filter((n) => n.pool)) {
  const into = sum(r.links.filter((l) => l.target === n.name)), out = sum(r.links.filter((l) => l.source === n.name));
  assert(Math.abs(into - out) <= 0.1 * r.links.length, `${n.name}: ${into} in, ${out} out`);
}
const crops = sum(r.links.filter((l) => l.kind === 'harvest' && l.target === 'Grain & flour'));
assert(crops > 0 && Math.abs(crops - r.raw['grain|harvest']) < 1, `harvest by crop ${crops}, in the ledger ${r.raw['grain|harvest']}`);
assert(r.links.every((l) => l.value > 0 && l.source !== l.target), 'links are flows between two nodes');
assert(r.need > 0 && r.fed > 0.8 * r.need && r.fed < 1.05 * r.need, `fed ${r.fed} against need ${r.need}`);
for (const k of ['Seed', 'Eaten', 'Rotted']) assert(r.nodes.some((n) => n.name === k), `an outlet ${k}`);
console.log(`foodflow ok: ${r.village.name}, year ${r.year}: ${r.links.length} links, produced ${Math.round(r.produced)}, fed ${Math.round(r.fed)} of ${Math.round(r.need)}`);
