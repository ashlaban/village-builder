// Prepare all late fixtures once, run extended correctness checks, then advisory measurements.
// Failures to prepare or execute a check are failures; out-of-range measurements remain advisory.
require('./help.js')(__filename);
const F = require('../tests/lib/fixtures.js');
const { run, stopAll } = require('../tests/lib/runner.js');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { process.exitCode = 1; stopAll(); });
async function nightly() {
  const made = await run(['node', 'tools/fixtures.js', 'make-missing', ...Object.keys(F.FIXTURES)],
    { cwd: F.root, timeoutMs: 1800000 });
  console.log(made.output);
  if (!made.ok) throw new Error('fixture preparation failed');
  const checks = await run(['node', 'tests/run.js', 'extended', '--verbose'], { cwd: F.root, timeoutMs: 3600000 });
  console.log(checks.output);
  if (!checks.ok) throw new Error(`extended checks failed: ${checks.error?.message || checks.signal || checks.code}`);
  await require('./bench.js').runBench();
  await require('./bands.js').main(['--if-new']);
  console.log('nightly: measurements in docs/bench; targets are advisory');
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });
