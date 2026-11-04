// VB-192: exact work on two tiny villages, normalized by living pawn-days.
const assert = require('assert'), fs = require('fs'), path = require('path');
const VB = require('../src/load.js'), { tinyWorld, tinyState } = require('./lib/tiny.js'), Sim = VB.sim;
const st = tinyState(tinyWorld(Array(24).fill('.'.repeat(40))),
  [{ at: [8, 12], farms: 3, sizes: [6, 5, 4] }, { at: [30, 12], farms: 3, sizes: [6, 5, 4] }], { seed: 7, herds: true });
assert.strictEqual(st.villages.length, 2);
VB.resetCounts();
let pawnDays = 0;
for (let d = 0; d < 30; d++) {
  pawnDays += st.pawns.filter((p) => p.alive).length;
  Sim.advance(st, Sim.DAY);
}
Sim.movingRound(st);
const values = Object.fromEntries(Object.keys(VB.COUNTERS).map((k) => [k, VB.count[k] / pawnDays]));
assert(Object.values(VB.count).every((v) => Number.isFinite(v) && v > 0), 'fixture must exercise every counter');
const file = path.join(__dirname, 'counters.json');
if (process.argv.includes('--update')) fs.writeFileSync(file, JSON.stringify(values, null, 2) + '\n');
const base = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.deepStrictEqual(Object.keys(base).sort(), Object.keys(values).sort());
for (const [k, value] of Object.entries(values)) {
  assert(Math.abs(value - base[k]) <= base[k] * 0.1, `${k}: ${value} per living pawn-day, baseline ${base[k]} (±10%)`);
}
const saved = JSON.stringify(Sim.save(st));
VB.resetCounts();
assert.deepStrictEqual(Object.values(VB.count), Object.keys(VB.COUNTERS).map(() => 0));
assert.strictEqual(JSON.stringify(Sim.save(st)), saved, 'counts must stay out of saves');
console.log(`counters ok: ${Object.keys(values).length} counters, 30 days, two villages, ${pawnDays} living pawn-days`);
