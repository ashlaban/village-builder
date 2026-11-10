// Targets: a check that is a target, not a gate, reports through target(name, {where, unit, dir, target, measured, noise}).
// It prints `TARGET name measured target residual status` (docs/gates.md, section 2) and returns the record; it never throws for a value
// out and never sets an exit code (tests/run.js sums the lines). dir is max, min or range (target is then [lo, hi]); the residual is how
// far past the target, positive is worse, 0 when in; noise is {kind: exact|seeds|runs|paired, spread, n}, and a residual up to its spread
// is `noise`, not `out`. With --record or VB_TARGETS_RECORD=1 the record is appended to docs/bench/targets.jsonl (VB_TARGETS_FILE
// overrides the file) with commit, dirty, date and machine, as tools/bands.js appends to bands.jsonl.
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const file = () => process.env.VB_TARGETS_FILE || path.join(root, 'docs/bench/targets.jsonl');
const recording = () => process.argv.includes('--record') || process.env.VB_TARGETS_RECORD === '1';
const git = (a) => { try { return execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return 'unknown'; } };
const num = (x) => (Number.isFinite(x) ? +x.toPrecision(4) : x);
let ctx = null;
const context = () => ctx || (ctx = { commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '',
  machine: `${os.cpus()[0]?.model || 'unknown'} x${os.cpus().length}` });

function residualOf(dir, goal, measured) {
  if (!Number.isFinite(measured)) return Infinity;
  if (dir === 'max') return Math.max(0, measured - goal);
  if (dir === 'min') return Math.max(0, goal - measured);
  if (dir === 'range') return Math.max(0, goal[0] - measured, measured - goal[1]);
  return Infinity; // an unknown dir is reported as out, not thrown
}
function target(name, { where = '', unit = '', dir = 'max', target: goal, measured, noise = { kind: 'exact', spread: 0, n: 1 } }) {
  const residual = residualOf(dir, goal, measured);
  const status = residual <= 0 ? 'in' : residual <= (noise.spread || 0) ? 'noise' : 'out';
  const rec = { name, where, unit, dir, target: goal, measured: num(measured), residual: num(residual), noise, status };
  console.log(`TARGET ${name} ${rec.measured}${unit} ${Array.isArray(goal) ? goal.join('..') : goal}${unit} ${residual > 0 ? '+' : ''}${rec.residual} ${status}`);
  if (recording()) {
    const out = file();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.appendFileSync(out, JSON.stringify({ ...rec, ...context(), date: new Date().toISOString() }) + '\n');
  }
  return rec;
}
// The TARGET lines of some output, parsed: [{name, residual, status}] (the runner sums the out ones).
function parse(text) {
  return text.split('\n').filter((l) => l.startsWith('TARGET ')).map((l) => {
    const p = l.trim().split(/\s+/);
    return { name: p[1], residual: Number(p[p.length - 2]), status: p[p.length - 1] };
  });
}
module.exports = { target, parse, residualOf };
