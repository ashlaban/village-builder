// usage: node tools/bench-paired.js [--before DIR] [--after DIR] [--runs N] [--fixture medium-ref] [--record]
// Paired, alternated bench runs (VB-265; VB-227's method, docs/gates.md section 2, Noise): the same fixture timed in `before` and in
// `after`, alternately (before, after, before, ...), N runs each (default 3), every run in a fresh process of that checkout's own
// `tools/bench.js --fixture`. Reports, for the mean ms a day, the longest and 99th percentile step, the cost per living pawn-day and
// each system's share of the whole step in its own run, the median and the range of each side, and calls the difference `noise` when
// the after median lies inside the range of the before runs, else `faster` or `slower`. Reported, never a pass or a fail; the machine's
// timings vary by a third between runs, so one run of each says nothing. Each line is a target record where the budget names one.
//   --before DIR   a checkout to measure as "before" (default: this one, so a run with no options shows the machine's own noise)
//   --after DIR    a checkout to measure as "after" (default: this one)
//   --runs N       runs of each side (default 3)
//   --fixture NAME medium-ref (default) or medium-y5; the fixture is read from each checkout's tests/fixtures/
//   --record       append the budget lines as target records to docs/bench/targets.jsonl (kind "paired": the before range as the noise)
// Takes minutes (a whole game year a run, 2 x N runs, one at a time): run nothing else meanwhile.
require('./help.js')(__filename);
const path = require('path'), { fork } = require('child_process');
const { median } = require('./bench.js'), { target } = require('../tests/lib/targets.js');

const run = (dir, fixture) => new Promise((resolve) => {
  const child = fork(path.join(dir, 'tools/bench.js'), ['--fixture', fixture], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  let result;
  child.on('message', (m) => { result = m; });
  child.on('error', (e) => resolve({ error: e.message }));
  child.on('exit', (code) => resolve(result || { error: `worker ended (${code})` }));
});
// The measures of one run: the lines, and each system's share of the whole step (percent) in the same run.
function measures(f) {
  const out = { msPerDay: f.msPerDay, longestMs: f.longestMs, p99Ms: f.p99Ms, msPerPawnDay: f.msPerPawnDay };
  for (const r of f.systems) out[`share ${r.system}`] = 100 * r.msPerDay / f.msPerDay;
  return out;
}
const range = (v) => [Math.min(...v), Math.max(...v)];
function compare(before, after) {
  const keys = Object.keys(before[0]), rows = [];
  for (const key of keys) {
    const b = before.map((m) => m[key]), a = after.map((m) => m[key]).filter(Number.isFinite);
    if (!b.every(Number.isFinite) || !a.length) continue;
    const bm = median(b), am = median(a), [lo, hi] = range(b), [alo, ahi] = range(a);
    rows.push({ key, before: bm, beforeRange: [lo, hi], after: am, afterRange: [alo, ahi], verdict: am >= lo && am <= hi ? 'noise' : am > hi ? 'slower' : 'faster' });
  }
  return rows;
}
async function main(args) {
  const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
  const here = path.join(__dirname, '..'), before = path.resolve(opt('before', here)), after = path.resolve(opt('after', here));
  const n = +opt('runs', 3), fixture = opt('fixture', 'medium-ref');
  const sides = { before: [], after: [] };
  for (let i = 0; i < n; i++) {
    for (const side of ['before', 'after']) {
      const t0 = Date.now(), f = await run(side === 'before' ? before : after, fixture);
      if (f.error) { console.log(`${side} ${i + 1}: UNAVAILABLE ${f.error.split('\n')[0]}`); continue; }
      sides[side].push(measures(f));
      console.log(`${side} ${i + 1}: ${f.msPerDay.toFixed(1)} ms/day, longest step ${f.longestMs.toFixed(1)} ms (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  }
  if (!sides.before.length || !sides.after.length) { console.log('bench-paired: a side has no run; nothing to compare'); return; }
  const rows = compare(sides.before, sides.after), f2 = (x) => x.toFixed(x < 10 ? 3 : 1);
  console.log(`\npaired, alternated, ${sides.before.length} and ${sides.after.length} runs at ${fixture} (before ${path.relative(here, before) || '.'}, after ${path.relative(here, after) || '.'})`);
  for (const r of rows) {
    console.log(`  ${r.key}: before ${f2(r.before)} (${f2(r.beforeRange[0])}..${f2(r.beforeRange[1])}), after ${f2(r.after)} (${f2(r.afterRange[0])}..${f2(r.afterRange[1])}): ${r.verdict}`);
  }
  // the budget's lines, as targets whose noise is the spread of the before runs
  const names = { msPerDay: 'mean', longestMs: 'longest-step' };
  for (const [key, limit] of [['msPerDay', 200], ['longestMs', 60]]) {
    const r = rows.find((x) => x.key === key);
    if (r) target(`bench-paired/${fixture}/${names[key]}`, { where: `${fixture}, ${sides.after.length} runs, alternated`, unit: ' ms', dir: 'max', target: limit, measured: r.after,
      noise: { kind: 'paired', spread: r.beforeRange[1] - r.beforeRange[0], n: sides.before.length }, extra: { before: r.before, beforeRange: r.beforeRange, afterRange: r.afterRange, verdict: r.verdict } });
  }
}
if (require.main === module) main(process.argv.slice(2)).catch((e) => console.error('bench-paired: UNAVAILABLE ' + (e.stack || e.message)));
module.exports = { compare, measures };
