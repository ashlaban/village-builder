// Test runner: runs a suite's scripts in parallel, one per core, and prints each script's last line, or its full output if it fails.
// `node tests/run.js test` runs the cheap checks; `node tests/run.js verify` runs those and the long verification runs.
// `--verbose` prints every script's full output (the reported, not asserted, numbers of births.js and hunger.js, for example).
const { spawn } = require('child_process'), os = require('os'), path = require('path');
const root = path.join(__dirname, '..');
const TEST = [
  ['python3', 'build.py', '--check'], ['node', 'tests/lint.js'], ['node', 'tests/lintrules.js'], ['node', 'tests/deaths.js'], ['node', 'tests/backlog.js'], ['node', 'tests/regress.js'],
  ['node', 'tests/trees.js'], ['node', 'tests/stones.js'], ['node', 'tests/rivers.js'], ['node', 'tests/newfields.js'], ['node', 'tests/weeding.js'], ['node', 'tests/children.js'], ['node', 'tests/kinds.js'], ['node', 'tests/heirs.js'], ['node', 'tests/guardian.js'], ['node', 'tests/ownheir.js'], ['node', 'tests/owners.js'], ['node', 'tests/kinlimit.js'], ['node', 'tests/service.js'], ['node', 'tests/routes.js'], ['node', 'tests/paths.js'], ['node', 'tests/layout.js'], ['node', 'tests/tools.js'], ['node', 'tests/indexes.js'], ['node', 'tests/meals.js'], ['node', 'tests/plots.js'],
];
const VERIFY = [
  ...TEST, ['node', 'tests/golden.js'], ['node', 'tests/populous.js'], ['node', 'tests/births.js'], ['node', 'tests/hunger.js'], ['node', 'tests/health.js'], ['node', 'tests/invariants.js'],
  ['node', 'tests/smoke.js'],
];
const suite = process.argv[2], verbose = process.argv.includes('--verbose');
const cmds = { test: TEST, verify: VERIFY }[suite];
if (!cmds) { console.error('usage: node tests/run.js test|verify [--verbose]'); process.exit(2); }
// longest first, so the slow scripts do not start last
const SLOW = ['populous', 'smoke', 'golden', 'births', 'hunger', 'stones'];
const rank = (c) => { const k = SLOW.findIndex((s) => c.join(' ').includes(s)); return k < 0 ? SLOW.length : k; };
const queue = [...cmds].sort((a, b) => rank(a) - rank(b)), t0 = Date.now(), failed = [];
function run(cmd) {
  return new Promise((done) => {
    const t = Date.now(), p = spawn(cmd[0], cmd.slice(1), { cwd: root }); let out = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      const name = cmd.slice(1).join(' '), secs = ((Date.now() - t) / 1000).toFixed(1), lines = out.trim().split('\n');
      if (code) { failed.push(name); console.log(`FAIL ${name} (${secs} s)\n${out.trim()}\n`); }
      else console.log(verbose ? `ok   ${name} (${secs} s)\n${out.trim()}\n` : `ok   ${name} (${secs} s): ${lines[lines.length - 1].slice(0, 120)}`);
      done();
    });
  });
}
const lanes = Math.max(1, Math.min(os.cpus().length, queue.length));
Promise.all(Array.from({ length: lanes }, async () => { while (queue.length) await run(queue.shift()); })).then(() => {
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (failed.length) { console.log(`${suite}: ${failed.length} failed (${failed.join(', ')}) in ${secs} s`); process.exit(1); }
  console.log(`${suite}: ${cmds.length} scripts passed in ${secs} s`);
});
