// @suite integration
// VB-048: the band `own-food` (tests/lib/bands.js): a farm's own food over its need, island-wide, read as a ratio of sums, not a mean of
// per-household ratios (which an empty or small household inflates), and sampled from a real run's ledgers.
const assert = require('assert');
const B = require('./lib/bands.js');
const band = B.BANDS.find((b) => b.id === 'own-food/populous');
assert(band && band.kind === 'described', 'own-food is a described band');
// constructed samples: years 1 and 2 after year 0; 100 of 50 and 10 of 100 give 110 / 150, where a mean of ratios would give 1.05
const s = [{ year: 0 }, { year: 1, food: { made: 100, need: 50 } }, { year: 2, food: { made: 10, need: 100 } }];
assert.strictEqual(B.PROBES.ownFoodShare(s, 0), 110 / 150, 'a ratio of sums over the years after y');
assert.strictEqual(B.PROBES.ownFoodShare(s, 1), 0.1, 'only the years after y');
assert(Number.isNaN(B.PROBES.ownFoodShare(s, 2)), 'NaN with no need counted');
// a real run: the populous tiny island for 2 years; the second year has own food and need counted
const r = B.runScenario({ ...B.SETUPS['populous tiny'], seed: 7, years: 2 });
const y2 = r.samples[2].food;
assert(y2 && y2.need > 0 && y2.made > 0, `year 2 counts own food and need: ${JSON.stringify(y2)}`);
const v = B.PROBES.ownFoodShare(r.samples, 1);
assert(v > 0.3 && v < 5, `own food over need in a plausible range: ${v}`);
console.log(`ownfood: ok (populous tiny seed 7, year 2: ${y2.made.toFixed(0)} made of ${y2.need.toFixed(0)} needed, ${v.toFixed(2)})`);
