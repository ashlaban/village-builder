// Prepare all late fixtures once, run extended correctness checks, then advisory measurements (on Sundays also the bands' weekly runs).
// The measurements are taken whether or not the checks pass, so a red night still has its numbers (Kim, 18 November); a failed check
// fails the run at its end. Failing to prepare the fixtures stops it, since the bench needs them; out-of-range measurements stay advisory.
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
  const failed = !checks.ok && `extended checks failed: ${checks.error?.message || checks.signal || checks.code}`;
  if (failed) console.error(`nightly: ${failed}; the measurements are taken all the same`);
  await require('./bench.js').runBench();
  await require('./bands.js').main(['--if-new']);
  // VB-633: the bands' weekly runs on the medium map (tests/lib/bands.js, WEEKLY), on Sundays
  const weekly = require('../tests/lib/bands.js').WEEKLY;
  if (new Date().getUTCDay() === 0 && weekly.length) await require('./bands.js').main(['--runs', weekly.join(',')]);
  console.log('nightly: measurements in docs/bench; targets are advisory');
  if (failed) throw new Error(failed);
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });
