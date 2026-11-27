// Seed in hunger and on the move (VB-352): the hungry household eats the crop with most seed first and each crop's last field's seed last;
// a start in life and settlers' provisions take a field's seed of each crop first.
const assert = require('assert'), VB = require('../src/load.js');
const { CROPS } = VB['sim/crops'];
const Stores = VB['sim/stores'];
const { feedHousehold } = VB['sim/hunger'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const st = tinyState(w, [{ at: [8, 8], farms: 2 }], { seed: 1 }); // seed 1 since VB-1951 moved the draws
const hh = st.households[st.farmsteads[0].household];
const B = CROPS.barley.seed, R = CROPS.rye.seed;
const put = (b, r) => { hh.grain = { barley: b, rye: r }; };
// the order of eating: barley (most seed) down to its last field first, then rye's surplus, then the last fields
put(3 * B, R + 5);
const into = {};
Stores.take(st, hh, 'grain', 2 * B, 'seedMeal', into, 'seedLast');
assert.deepStrictEqual([hh.grain.barley, hh.grain.rye], [B, R + 5], 'the most-held crop gives its surplus first');
Stores.take(st, hh, 'grain', 5, 'seedMeal', into, 'seedLast');
assert.deepStrictEqual([hh.grain.barley, hh.grain.rye], [B, R], 'then the other crop\'s surplus, each keeps a field');
Stores.take(st, hh, 'grain', 1, 'seedMeal', into, 'seedLast');
assert(hh.grain.barley + hh.grain.rye === B + R - 1 && hh.grain.barley >= B - 1 && hh.grain.rye === R || hh.grain.rye === R - 1, 'then the last fields');
// a household starved step by step keeps a field's seed of each crop until the last
put(2 * B, 2 * R);
const kept = [];
for (let d = 0; d < 400 && Sim_grain() > 0; d++) {
  hh.meals = 0; hh.flour = 0; hh.fresh = []; hh.larder = [];
  feedHousehold(st, hh);
  if (Sim_grain() > 0 && Sim_grain() >= B + R - 1e-9) kept.push([hh.grain.barley || 0, hh.grain.rye || 0]);
}
function Sim_grain() { return Stores.grainOf(hh); }
assert(kept.length > 0 && kept.every(([b, r]) => b >= B - 1e-6 && r >= R - 1e-6 || b + r < B + R), 'a field\'s seed of each crop until the last');
// a start in life: a field's seed of each crop, then the rest in proportion
put(20 * B, 4 * R);
const got = {};
Stores.take(st, hh, 'grain', B + R, 'provisions', got, 'seedFirst');
assert(Math.abs(got.barley - B) < 1e-9 && Math.abs(got.rye - R) < 1e-9, 'a field of each crop: ' + JSON.stringify(got));
console.log('seedorder ok');
