// Report calculations use explicit data; one CLI call checks wiring without simulating years.
const assert = require('assert'), { execFileSync } = require('child_process');
const st = { t: 0, households: [0, 1, 2, 3].map((id) => ({ id, farmstead: id, holder: id, members: [id], hungryDays: 0, grain: id * 100 })),
  farmsteads: Array.from({ length: 4 }, () => ({ fields: [{ sown: 1 }] })),
  pawns: [0, 1, 2, 3].map((id) => ({ id, age: 25, died: null, household: id })) };
let season = 0;
const Sim = { DAY: 24, SEASON_DAYS: 12, YEAR: 1152, grainOf: (h) => h.grain,
  settlementIdOf: () => 0, recordOf: () => [], advance: (s, hours) => {
    s.t += hours; s.households[0].hungryDays += [8, 9, 10, 11][season++];
  } };
const report = require('../tools/hunger.js')(Sim, st);
report.advanceYear();
const result = report.result();
assert.strictEqual(result.summary.hungryHouseholds, 1);
assert.deepStrictEqual(result.summary.grainQuartiles, { min: 0, q1: 100, median: 200, q3: 300, max: 300 });
const h = result.households[0];
assert.strictEqual(h.hungryDays, 38);
assert.deepStrictEqual([h.spring, h.summer, h.autumn, h.winter], [8, 9, 10, 11]);
assert.strictEqual(h.fields, 1); assert.strictEqual(h.sown, 1);
const rows = JSON.parse(execFileSync(process.execPath, ['tools/sim.js', '--report', 'calendar', '--json'],
  { cwd: require('path').join(__dirname, '..'), encoding: 'utf8', timeout: 10000 }));
assert(rows.length > 0 && rows.every((r) => r.owner && r.every));
console.log('reports: explicit hunger/season/quantile cases and CLI JSON wiring pass');
