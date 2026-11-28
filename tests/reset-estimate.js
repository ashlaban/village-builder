// @suite fast
// tools/lib/reset-estimate.js (VB-1615) on constructed runs: the context's curve from its series or a straight line; the cost of a run
// with no reset; a reset at the ceiling; a voluntary one only over T, from the 30th call, with 20 calls left, once; and the grid.
const assert = require('assert');
const E = require('../tools/lib/reset-estimate.js');

assert.deepStrictEqual(E.curve({ calls: 5, first: 100, peak: 500 }), [100, 200, 300, 400, 500], 'no series: a straight line from first to peak');
assert.deepStrictEqual(E.curve({ calls: 6, first: 100, peak: 900, series: [[5, 140]] }), [100, 110, 120, 130, 140, 140],
  'a series: its points, held after the last');
const flat = Array(10).fill(1000);
assert.strictEqual(E.simulate(flat, { H: 0, R: 0 }).cost, 10 * 100, 'no growth, no reset: 0.1 × the context a call');
const line = Array.from({ length: 50 }, (_, k) => 1000 + 100 * k);
// a call reads the context before it from the cache, and writes what it adds; the first call reads its prefix
const read = 0.1 * (line[0] + line.slice(0, 49).reduce((a, x) => a + x, 0));
assert.ok(Math.abs(E.simulate(line, { H: 0, R: 0 }).cost - (read + 1.25 * 100 * 49)) < 1e-6, 'growth is written once and read after');
const long = Array.from({ length: 250 }, (_, k) => 1000 + 10 * k), ceil = E.simulate(long, { H: 0, R: 0 });
assert.ok(ceil.resets === 2 && ceil.voluntary === 0, 'the ceiling resets every 120 calls of a run');
const at = (T, ctx) => E.simulate(ctx, { T, H: 500, R: 2 });
assert.ok(at(1500, line).voluntary === 1 && at(1e9, line).voluntary === 0, 'a voluntary reset only over T');
assert.ok(at(1000, line.slice(0, 40)).voluntary === 0, 'none with fewer than 20 calls left after the 30th');
assert.ok(at(1000, long).voluntary === 1, 'at most one voluntary reset a run');
assert.ok(at(1500, line).cost < E.simulate(line, { H: 500, R: 2 }).cost, 'a reset on a growing context, with a short handover, costs less');
const runs = E.runsOf([{ start: '2026-11-20T00:00Z', subagents: [{ start: '2026-11-20T01:00Z', calls: 50, first: 1000, peak: 5900, weighted: 1e5 }] },
  { start: '2026-11-10T00:00Z', calls: 9, context: { first: 1, peak: 2 }, weighted: 1 }, {
    start: '2026-11-21T00:00Z', calls: 1, context: { first: 1, peak: 1 } }],
Date.parse('2026-11-15'));
assert.strictEqual(runs.length, 2, 'sub-agents and sessions of their own, from --from on');
const e = E.estimate(runs, { Ts: [1500], Hs: [500], Rs: [2] });
assert.ok(e.runs === 1 && e.rows.length === 1 && e.rows[0].reset === 1 && e.rows[0].saved > 0 && e.rows[0].share === e.rows[0].saved / 1e5,
  'the grid: saved, its share, runs reset');
assert.ok(/upper bound/.test(E.report(e)), 'the report says it is an upper bound');
console.log('reset estimate: curves, the ceiling, the voluntary reset\'s guards and the grid');
