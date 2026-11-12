// VB-192: exact work on two tiny villages, normalized by living pawn-days.
const assert = require('assert'), fs = require('fs'), path = require('path');
const VB = require('../src/load.js'), { tinyWorld, tinyState } = require('./lib/tiny.js'), Sim = VB.sim;
const { target } = require('./lib/targets.js'), { livingPawnDays } = require('../tools/counts.js');
const st = tinyState(tinyWorld(Array(24).fill('.'.repeat(40))),
  [{ at: [8, 12], farms: 3, sizes: [6, 5, 4] }, { at: [30, 12], farms: 3, sizes: [6, 5, 4] }], { seed: 7, herds: true });
assert.strictEqual(st.villages.length, 2);
VB.resetCounts();
const from = st.t;
for (let d = 0; d < 30; d++) {
  Sim.advance(st, Sim.DAY);
}
const rankBeforeRound = VB.count.heirRank;
Sim.movingRound(st);
const roundRank = VB.count.heirRank - rankBeforeRound, pawnDays = livingPawnDays(st, from, st.t, Sim.DAY);
assert(roundRank > 0, 'round must compute heir rankings');
const values = Object.fromEntries(Object.keys(VB.COUNTERS).map((k) => [k, VB.count[k] / pawnDays]));
values.roundRank = roundRank / pawnDays;
assert(Object.entries(VB.count).every(([k, v]) => Number.isFinite(v)
  && (k === 'routeEvict' || k === 'recordFold' || k === 'reachSettled' ? v === 0 : k === 'occasionAsked' || k === 'takeInWeighed' || k === 'labourWeighed' || k === 'boatAsk' ? v >= 0 : v > 0)),
  'fixture must exercise every counter except eviction (the tiny cache fits; routes.js exercises eviction), the fold of the record '
  + '(at the year\'s turn; record.js exercises it) and the guests of occasions (a marriage, a death or the meeting; occasions.js exercises it)'
  + ' and the take-in search (a household short of people whose ask fell short; takenin.js exercises it)'
  + ' and the search for a household short of labour (labour.js exercises it) and the walking hours between villages (autumn; villagehours.js)'
  + ' and the boats asked for (the tiny map has no water; drying.js exercises it)');
const file = path.join(__dirname, 'counters.json');
if (process.argv.includes('--update')) fs.writeFileSync(file, JSON.stringify(values, null, 2) + '\n');
const base = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.deepStrictEqual(Object.keys(base).sort(), Object.keys(values).sort());
// Each counter against its baseline is a target (VB-264): one-sided, over +10% is out; a fall is re-recorded with `--update`.
let out = 0;
for (const [k, value] of Object.entries(values)) {
  const t = target(`counters/${k}`, { where: 'tiny probe', unit: '/pawn-day', dir: 'max', target: base[k] * 1.1, measured: value });
  if (t.status === 'out') out++;
}
const saved = JSON.stringify(Sim.save(st));
VB.resetCounts();
assert.deepStrictEqual(Object.values(VB.count), Object.keys(VB.COUNTERS).map(() => 0));
assert.strictEqual(JSON.stringify(Sim.save(st)), saved, 'counts must stay out of saves');
// Indirect ranking paths must increment the same counter, with no optional tally argument.
VB['sim/heirs'].countDemand(st);
assert(VB.count.heirRank > 0, 'countDemand rankings must be counted');
VB.resetCounts();
VB['sim/heirs'].ownFirstOf(st);
assert(VB.count.heirRank >= st.liveHouseholds.length, 'nested ownFirstOf rankings must be counted');
// A second tiny fixture exercises many pair comparisons without advancing into hunger first.
const probe = tinyState(tinyWorld(Array(30).fill('.'.repeat(50))),
  [{ at: [10, 15], farms: 3, sizes: [7, 7, 7] }, { at: [38, 15], farms: 3, sizes: [7, 7, 7] }], { seed: 7 });
VB.resetCounts(); Sim.movingRound(probe);
const probePairs = VB.count.roundPairs;
assert(probePairs >= 30, 'round probe must exercise at least 30 candidate pairs');
// A same-tile request does no A* work; a nontrivial route starts a search.
const routeWorld = tinyWorld(['...']); VB.resetCounts();
assert.deepStrictEqual(VB['sim/routes'].findRoute(routeWorld, 1, 1), [1]);
assert.strictEqual(VB.count.routeSearch, 0);
assert.strictEqual(VB.count.routeExpand, 0);
VB['sim/routes'].findRoute(routeWorld, 0, 2);
assert.strictEqual(VB.count.routeSearch, 1);
assert(VB.count.routeExpand > 0);
// Births, partial days, deaths at hour zero, and a measurement resumed from a loaded time.
const lifetimes = { t: 48, pawns: [{ born: -48, died: null }, { born: 12, died: null },
  { born: -48, died: 0 }, { born: 0, died: 12 }, { born: 60, died: null }, { born: 12, died: 36 }] };
assert.strictEqual(livingPawnDays(lifetimes, 0), 5);
assert.strictEqual(livingPawnDays(lifetimes, 24), 2.5);
assert.strictEqual(livingPawnDays(lifetimes, 0, 0), 0);
console.log(`counters ok: ${Object.keys(values).length} counters, 30 days, two villages, ${pawnDays.toFixed(0)} living pawn-days; ${probePairs}-pair round probe; ${out} counters out against baseline`);
