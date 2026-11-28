// @suite fast
// Peas (VB-349; design.md, Crops and rotations, The first crops). A field forced to peas on a tiny farm at seed 7, run by the simulation:
// hoed, sown from the household's peas in spring days 1-10, ripe 18 days on, pulled (10 hours a normal crop) and threshed (10) into peas, 60 rations a
// field at soil 1, the soil mended 0.04 to at most 1.0 (a manured field keeps its soil); a pea left to the frost is lost as barley is.
// Then the pot: barley and peas are two sources and go 10% further; peas alone are one source; peas held for seed are not cooked.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { FOODS, ECON, DAY, YEAR_DAYS, cal } = VB['sim/rules'], { CROPS, ROTATIONS } = VB['sim/crops'];
const { KINDS } = VB['sim/kinds'];
const { fieldsFrost } = VB['sim/fields'];
const Stores = VB['sim/stores'], Pot = VB['sim/pot'];
const { setClock } = require('./lib/clock.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));

// ---- the table ----
const P = CROPS.peas;
assert(P.yield === 60 && P.seed === 20 && P.ripe === 18 && P.gain === 0.04 && P.wear === 0 && P.weeds === 2, 'the row of peas');
assert.deepStrictEqual(P.sow, [0, 0, 9]);
assert.deepStrictEqual(P.hours, { plow: 20, sow: 2, weed: 5, reap: 10, thresh: 10 });
assert(FOODS.pulses.worth === 1 && FOODS.pulses.keeps === null && FOODS.pulses.source === 'pulses' && !FOODS.pulses.raw, 'pulses');

// ---- a field of peas, run by the simulation ----
const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
const f = st.farmsteads[0], hh = st.households[f.household], fd = f.fields[0];
// the farm and its village hold barley and peas by turns (VB-350), the field followed at peas and the others staggered after it
st.villages[f.village].rotation = 'peas';
f.fields.forEach((q, i) => Object.assign(q, { rotation: 'peas', step: (i + 1) % 2, crop: ROTATIONS.peas.courses[(i + 1) % 2] }));
fd.soil = 0.9;
fd.stage = 'stubble'; // to be hoed first
// the seed for each field at peas (VB-1758): whichever is hoed first is sown first, and the field followed may come after another
Stores.put(st, hh, Stores.grainGood('peas'), P.seed * f.fields.filter((q) => q.crop === 'peas').length + 5, 'start');
Stores.put(st, hh, Stores.grainGood('barley'), 300, 'start'); // fed meanwhile: a hungry household eats its seed
const hours = {};
let seen = null, max = 0;
for (let d = 0; d < YEAR_DAYS && !(fd.stage === 'stubble' && fd.reaped !== null); d++) {
  for (let h = 0; h < DAY; h++) {
    Sim.advance(st, 1);
    for (const j of st.jobs.values()) if (j.field === fd) hours[j.kind] = j.hours ?? KINDS[j.kind].hours;
  }
  if (fd.sown !== null) seen = { sown: fd.sown, reaped: fd.reaped, held: fd.held || (seen && seen.held) };
  max = Math.max(max, Stores.grainOf(hh, 'peas'));
  if (d > 0) assert.deepStrictEqual(checkState(st), [], `invariants on day ${d}`);
}
assert(seen && seen.reaped !== null, 'the peas are sown and reaped');
const s = cal(seen.sown * DAY);
assert(s.year === 1 && s.season === 0 && s.sday <= 9, `sown in spring days 1-10: ${JSON.stringify(s)}`);
assert(seen.reaped - seen.sown >= P.ripe && seen.reaped - seen.sown < P.ripe + 8, `ripe after ${P.ripe} days, reaped ${seen.reaped - seen.sown} on`);
assert(seen.held > 0.7 * P.yield && seen.held < 1.3 * P.yield, `a harvest of about 60 rations: ${seen.held}`);
assert(max >= seen.held - 1, `threshed into peas: at most ${max} held, ${seen.held} reaped`);
assert.equal(hours.plow, 20, 'hoeing 20');
assert.equal(hours.sow, 2, 'sowing 2');
assert.equal(hours.weed, 5, 'weeding 5 (two rounds)');
// pulling: 10 hours for a normal crop of 60, by the crop that stood (VB-475): within the reaping's own draw (0.9 to 1.1) of what it gave
assert(Math.abs(hours.reap - (10 * seen.held) / 60) <= 0.12 * ((10 * seen.held) / 60) + 0.5, `pulling 10 by the crop: ${hours.reap}, ${seen.held} reaped`);
assert(near(fd.soil, 0.94), `the soil mended 0.04: ${fd.soil}`);

// ---- the soil: to at most 1.0, never lowering a manured field ----
const st2 = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
const f2 = st2.farmsteads[0], hh2 = st2.households[f2.household], g = f2.fields[0], j = { farm: f2, field: g };
for (const [soil, after] of [[0.8, 0.84], [0.98, 1], [1, 1], [1.12, 1.12]]) {
  Object.assign(g, { crop: 'peas', stage: 'ripe', sown: 0, soil, held: 0 });
  setClock(st2, 40 * DAY);
  KINDS.reap.done(st2, j, hh2, cal(st2.t));
  assert(near(g.soil, after), `peas on soil ${soil}: ${g.soil}, not ${after}`);
}
// the frost wears peas in the stook away, as it does barley (VB-2001: a share a day, gone under the quantum)
Object.assign(g, { crop: 'peas', stage: 'stooks', sown: 0, held: 17 });
fieldsFrost(st2);
assert(g.stage === 'stooks' && g.held === 17, 'the frost leaves the stooks standing');
VB['sim/fields'].stooksDecay(st2, 2);
assert(g.stage === 'stubble' && g.held === 0, 'peas left in the field are lost to the frost');

// ---- the pot: barley and peas are two sources ----
const home = (grain) => {
  const s2 = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 }), h = s2.households[s2.farmsteads[0].household];
  VB['sim/projectplans'].dropAll(s2, 'household', h.id);
  for (const fld of s2.farmsteads[0].fields) fld.stage = 'growing'; // no seed to hold back
  h.larder = []; h.meals = 0; h.grain = grain;
  return { s: s2, h };
};
{
  const { s: s3, h } = home({ barley: 500, peas: 500 });
  const need = 10;
  assert.equal(Pot.pot(s3, h, need), 2, 'barley and peas count two sources');
  assert(near(h.meals, need), `meals ${h.meals}`);
  const eatenPeas = 500 - Stores.grainOf(h, 'peas'), eatenBarley = 500 - Stores.grainOf(h, 'barley');
  // 10 meals at the factor 0.9: 9 rations of food, peas at 1 a unit, barley unground at 1 / unground
  assert(near(eatenPeas + eatenBarley / ECON.unground, 0.9 * need, 1e-6), `10% less food: ${eatenPeas} peas, ${eatenBarley} barley`);
  assert(eatenPeas > 0 && eatenBarley > 0, 'both are eaten');
}
{
  const { s: s3, h } = home({ barley: 0, peas: 500 });
  assert.equal(Pot.pot(s3, h, 10), 1, 'peas alone are one source');
  assert(near(500 - Stores.grainOf(h, 'peas'), 10), 'a ration a unit');
}
{
  const { s: s3, h } = home({ barley: 500, peas: 500 });
  Stores.reserve(s3, h, s3.plans.households.get(h.id), Stores.grainGood('peas'), 500, 'field');
  assert.equal(Pot.pot(s3, h, 10), 1, 'peas held for seed are not cooked while barley serves');
  assert.equal(Stores.grainOf(h, 'peas'), 500);
}
console.log('peas ok: the row, a forced field through the year, the soil, the frost, and the pot of barley and peas');
