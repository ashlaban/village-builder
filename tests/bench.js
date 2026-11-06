// Diagnostic reporting needs stable math and failure handling; never assert machine timing.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const B = require('../tools/bench.js');
assert.strictEqual(B.median([5, 1, 4, 2, 3]), 3);
assert.strictEqual(B.median([4, 1, 3, 2]), 2.5);
const stats = B.stepStats(Array.from({ length: 100 }, (_, i) => ({ hour: i / 10, ms: i + 1 })));
assert.strictEqual(stats.p99Ms, 99);
assert.strictEqual(stats.longestMs, 100);
assert.deepStrictEqual(stats.longest.map((s) => s.hour), [9.9, 9.8, 9.7, 9.6, 9.5]);
function run(ms, cpu = 'test CPU') {
  const f = { msPerDay: ms, msPerPawnDay: ms / 10, systems: [{ system: 'trees', msPerDay: ms / 2 }],
    micro: { routeUs: ms, routeNsPerExpanded: ms, ruleNs: ms } };
  return { schema: 1, cpu: { model: cpu, cores: 4 }, date: '2026-11-05', commit: 'test', node: 'test',
    fixtures: { 'medium-y5': f, 'medium-y60': { ...f, msPerPawnDay: ms / 8 } } };
}
const history = [80, 90, 100, 110, 120].map((n) => run(n));
assert.strictEqual(B.flags(run(119.99), history).length, 0);
const flags = B.flags(run(120), history);
assert(flags.some((f) => f.key === 'medium-y5.msPerDay' && f.median === 100));
assert.deepStrictEqual(flags[0].previous, [80, 90, 100, 110, 120]);
assert.strictEqual(B.flags(run(200, 'another CPU'), history).length, 0);
assert.strictEqual(B.flags(run(200), history.slice(1)).length, 0);
assert.strictEqual(B.flags(run(120), [...history, run(999, 'another CPU')]).length, flags.length);
assert.strictEqual(B.flags(run(120), [run(999), ...history]).length, flags.length);
const failed = { ...run(200), fixtures: { 'medium-y5': { error: 'offline' }, 'medium-y60': { error: 'offline' } } };
assert.deepStrictEqual(B.flags(failed, history), []);
const table = B.budget(run(100));
assert(table.includes('| Longest 6-minute step (ms) | 60 |'));
assert(table.includes('| Moving round, one call (ms) | 60 step limit |'));
assert(table.includes('| Meetings, one call (ms) | 60 step limit |'));
assert(table.includes('| Cost per living pawn-day / year 5 | ≤1.25× | 1.000 | 1.250 |'));
assert(table.includes('| trees (ms/day) |  | 50.000 | 50.000 |'));
assert(B.budget(failed).includes('unavailable'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-bench-'));
try {
  const file = path.join(dir, 'history.jsonl');
  assert.deepStrictEqual(B.readHistory(file), []);
  fs.writeFileSync(file, JSON.stringify(run(1)) + '\npartial JSON\n' + JSON.stringify(run(2)) + '\n');
  assert.deepStrictEqual(B.readHistory(file).map((r) => r.fixtures['medium-y5'].msPerDay), [1, 2]);
  for (const tail of ['', '\n', '\n{"schema":']) {
    fs.writeFileSync(file, JSON.stringify(run(1)) + tail);
    B.appendHistory(file, run(2));
    B.appendHistory(file, run(3));
    assert.deepStrictEqual(B.readHistory(file).map((r) => r.fixtures['medium-y5'].msPerDay), [1, 2, 3]);
    assert(fs.readFileSync(file, 'utf8').endsWith('\n'));
  }
  const fresh = path.join(dir, 'fresh.jsonl');
  B.appendHistory(fresh, run(4));
  assert.strictEqual(B.readHistory(fresh).length, 1);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
// Exercise the complete measurement on a reduced fixture, and the missing-fixture IPC path.
const child = spawnSync(process.execPath, ['-e', `
  const {fork} = require('child_process');
  const F = require.resolve('./tests/lib/fixtures.js');
  const fs = require('fs'), os = require('os'), path = require('path');
  const assert = require('assert');
  const B = require('./tools/bench.js'), fixtures = require(F);
  const perf = require('./tools/perf.js');
  let st;
  fixtures.loadFixture = () => {
    const ns = globalThis.VB, it = ns.gen.generate(7, {cols:120,rows:85});
    let r; while (!(r=it.next()).done);
    st = ns.sim.seed(r.value,7,'populous');
    return {st, stamp:{commit:'reduced-test'}, stale:true};
  };
  fixtures.spec = () => ({cols:120,rows:85});
  const result = B.measure('medium-y5');
  assert.strictEqual(result.days,30);
  assert.strictEqual(result.micro.routeSearches,1000);
  assert.strictEqual(result.micro.ruleCalls,1000000);
  assert(result.pawnDays>0 && result.systems.length>=10 && result.longest.length===5);
  for (const key of ['msPerDay','msPerPawnDay','saveTotalMs','loadTotalMs','jsonMB','gzipMB']) assert(result[key]>0);
  const before = JSON.stringify(st.rng);
  B.microbench(globalThis.VB,st);
  assert.strictEqual(JSON.stringify(st.rng),before,'microbench consumes simulation randomness');
  perf.reset();
  assert(perf.result(0,1).systems.every(row => row.ms===0 && row.calls===0),'profile reset leaks previous measurements');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-bench-missing-'));
  const preload = path.join(dir, 'preload.js');
  fs.writeFileSync(preload, 'require(' + JSON.stringify(F) + ').loadFixture = () => null;');
  const p = fork('./tools/bench.js', ['--fixture', 'medium-y5'], {execArgv:['--require',preload]});
  let received = false;
  p.on('message', data => { received = true; if (!data.error) process.exitCode = 1; });
  p.on('exit', code => { fs.rmSync(dir, {recursive:true,force:true}); if (code !== 0 || !received) process.exitCode = 1; });
`], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.strictEqual(child.status, 0, child.stderr);
console.log('bench: percentiles, same-CPU five-run flags, generated budget, history recovery and missing fixtures pass');
