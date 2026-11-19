// The custom `stocking` (VB-711): the autumn count's margin is the village's option, HERD.margins[option]. Six cows and hay for four cows'
// winter (84 units): to the hay keeps 3 (3 × 21 × 1.1 = 69.3), keep the herd keeps 5 (5 × 21 × 0.8 = 84). A bad winter (hay for 60% of the
// stall days of the kept five) gives the herd lean days and, past starveDays, a head lost a day; the village store lends no fodder.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/herds'], Y = VB['sim/byre'], Culture = VB.culture;
const { setPractice, tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const cal = (doy, day = doy) => ({ doy, day, season: Math.floor(doy / 12), sday: doy % 12, hour: 0 });
const cows = (st, hh) => H.herdOf(st, hh, 'cattle').head.filter((h) => h.kind === 'cow').length;
assert.deepStrictEqual(Culture.DIMS[Culture.IDX.stocking].opts.map((o) => o[0]), ['hay', 'herd']);
assert.strictEqual(Culture.fromArchetype('oldNordic')[Culture.IDX.stocking], 0, 'to the hay by default');
assert.deepStrictEqual(Sim.HERD.margins, { hay: 1.1, herd: 0.8 });
// household 3: six cows (4 years old) and nothing else
const SEED = 9; // the herds drawn at seeding move with every custom added (VB-711, VB-826, VB-463)
function scene(option, hay) {
  const st = tinyState(tinyWorld(Array(18).fill('.'.repeat(28)), { seed: SEED }), [{ at: [7, 9], farms: 2, sizes: [6, 5] }, { at: [21, 9], farms: 2, sizes: [5, 4] }], { seed: SEED, herds: true }), hh = st.households[3], herd = H.herdOf(st, hh, 'cattle');
  herd.head = [];
  for (let k = 0; k < 6; k++) H.addHead(st, herd, 'f', st.t - 4 * Sim.YEAR, 'cow');
  for (const hd of H.herdsOf(st, hh)) if (hd.species === 'sheep') hd.ewes = hd.rams = hd.lambs = 0;
  setPractice(st, st.farmsteads[hh.farmstead].village, { stocking: option });
  hh.hay = hay;
  for (const m of st.farmsteads[hh.farmstead].meadows) m.held = 0;
  return { st, hh };
}
for (const [option, kept] of [['hay', 3], ['herd', 5]]) {
  const { st, hh } = scene(option, 84);
  Y.autumnCount(st, hh);
  const gone = H.herdOf(st, hh, 'cattle').cull.length;
  assert.strictEqual(6 - gone, kept, `${option}: kept ${6 - gone}, wanted ${kept}`);
}
{ // a bad winter under keep the herd: the five kept have hay for 60% of the stall days
  const { st, hh } = scene('herd', 84);
  Y.autumnCount(st, hh);
  const herd = H.herdOf(st, hh, 'cattle');
  for (const e of herd.cull.splice(0)) herd.head.splice(herd.head.findIndex((h) => h.id === e.head), 1);
  assert.strictEqual(cows(st, hh), 5);
  hh.hay = Math.round(0.6 * 5 * Sim.HERD.stallDays);
  const store = JSON.stringify(st.villages ? st.villages.map((v) => v.store) : null), before = cows(st, hh);
  for (let d = Sim.HERD.stall[0]; d < Sim.HERD.stall[0] + 14; d++) Y.byreDay(st, cal(d % 48, d));
  assert.ok(herd.lean > 0, 'the herd had lean days');
  assert.ok(cows(st, hh) < before || herd.cull.length, 'past starveDays a head is lost or slaughtered');
  assert.strictEqual(hh.hay, 0, 'the hay is gone');
  assert.strictEqual(JSON.stringify(st.villages ? st.villages.map((v) => v.store) : null), store, 'no fodder from the village store');
  assert.deepStrictEqual(checkState(st).slice(0, 3), []);
}
console.log('stocking ok');
