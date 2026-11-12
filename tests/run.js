// Explicit tiers, bounded subprocesses, one browser lane. See docs/testing.md.
const path = require('path'), { FAST, INTEGRATION, EXTENDED } = require('./suites.js');
const { positive, workers, isBrowser, run, stopAll } = require('./lib/runner.js');
const { parse } = require('./lib/targets.js');
const root = path.join(__dirname, '..');
let interrupted = false;
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(signal, () => {
  interrupted = true; process.exitCode = code; stopAll();
});
async function main() {
  const suite = process.argv[2], verbose = process.argv.includes('--verbose');
  const list = process.argv.includes('--list') || process.stdout.isTTY;
  const suites = { test: FAST, integration: INTEGRATION, verify: [...FAST, ...INTEGRATION], extended: EXTENDED };
  const cmds = suites[suite];
  if (!cmds || process.argv.slice(3).some((a) => !['--verbose', '--list'].includes(a)))
    throw new Error('usage: node tests/run.js test|integration|verify|extended [--list] [--verbose]');
  const jobs = workers(process.env.VB_TEST_JOBS);
  const timeoutMs = positive(process.env.VB_TEST_TIMEOUT_MS, suite === 'test' ? 120000 : 900000, 'VB_TEST_TIMEOUT_MS');
  const browsers = cmds.filter(isBrowser), queue = cmds.filter((c) => !isBrowser(c));
  // Browser startup is expensive; serialize all browser scripts, including future browser-* additions.
  const chains = browsers.length ? [browsers] : [];
  const started = Date.now(), results = [], targets = [];
  async function check(cmd) {
    const r = await run(cmd, { cwd: root, timeoutMs }); results.push(r); targets.push(...parse(r.output));
    const name = cmd.slice(1).join(' '), seconds = (r.ms / 1000).toFixed(1);
    const why = r.timedOut ? `timeout after ${timeoutMs} ms` : r.error?.message || r.signal || `exit ${r.code}`;
    if (!r.ok) console.log(`FAIL ${name} (${seconds} s; ${why})\n${r.output.trim()}`);
    else if (verbose) console.log(`ok   ${name} (${seconds} s)\n${r.output.trim()}`);
    else if (list) console.log(`ok   ${name} (${seconds} s): ${r.output.trim().split('\n').pop().slice(0, 120)}`);
  }
  if (suite === 'extended') {
    await check(['node', 'tools/fixtures.js', 'make-missing', 'small-y5', 'small-y40']);
    if (!results.at(-1).ok) { process.exitCode = 1; return; }
    results.length = 0; // prerequisite, not an inventoried test
  }
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length + chains.length) }, async () => {
    while (chains.length) for (const cmd of chains.shift()) { if (interrupted) break; await check(cmd); }
    while (!interrupted && queue.length) await check(queue.shift());
  }));
  const failed = results.filter((r) => !r.ok), outs = targets.filter((t) => t.status === 'out');
  console.log('slowest: ' + [...results].sort((a, b) => b.ms - a.ms).slice(0, 5)
    .map((r) => `${r.cmd.slice(1).join(' ')} ${(r.ms / 1000).toFixed(1)}s`).join('; '));
  console.log(`${suite}: ${results.length - failed.length}/${cmds.length} passed, ${failed.length} failed in `
    + `${((Date.now() - started) / 1000).toFixed(1)} s; ${outs.length} targets out (advisory)`);
  if (failed.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
