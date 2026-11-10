// VB-196's acceptance measures, shared by current and baseline checkouts. No timing or probes in simulation code.
// usage: node tools/marriage-demography.js [SEED...] [--source DIR] [--reference FILE] [--make-reference] [--record]
// Runs populous small for 30 years at each seed (default 7 and 42; the gate uses 1 to 12), one per core, and prints a line of JSON each.
// Then prints three TARGET lines (marriages a year and first-marriage age within 5%, never-married share of women 45 to 54 within 2 points
// of the reference means; the noise is the standard error over the seeds); --record appends them to docs/bench/targets.jsonl.
//   --source DIR       measure another checkout (a baseline) instead of this one
//   --reference FILE   the means to compare with (default docs/bench/demography-reference.json)
//   --make-reference   write this run's means as the reference
require('./help.js')(__filename);
const path = require('path'), fs = require('fs'), os = require('os'), { fork } = require('child_process');
function summarize(st, from, yearHours) {
  const first = new Map(), during = st.unions.filter((u) => u.start >= from && u.start <= st.t);
  for (const u of st.unions) {
    if (u.start > st.t) continue;
    for (const id of [u.a, u.b]) if (!first.has(id) || u.start < first.get(id)) first.set(id, u.start);
  }
  const ages = [...first].filter(([, t]) => t >= from).map(([id, t]) => (t - st.pawns[id].born) / yearHours);
  const women = st.living.map((id) => st.pawns[id]).filter((p) => {
    const age = Math.floor((st.t - p.born) / yearHours);
    return p.sex === 'f' && age >= 45 && age <= 54;
  });
  const never = women.filter((p) => !first.has(p.id));
  return { marriagesPerYear: during.length / ((st.t - from) / yearHours),
    firstMarriageAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
    firstMarriages: ages.length, women45to54: women.length, neverMarried: never.length,
    neverShare: women.length ? never.length / women.length : null, neverMarriedIds: never.map((p) => p.id) };
}
// One seed: 30 populous years on the small map, the summary as an object.
function runSeed(root, seed) {
  const VB = require(path.join(root, 'src/load.js')), Sim = VB.sim;
  const it = VB.gen.generate(seed, { cols: 180, rows: 130 }); let r;
  while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, 'populous'), from = st.t;
  for (let y = 1; y <= 30; y++) {
    Sim.advance(st, Sim.YEAR);
    if (y % 5 === 0) console.error(`seed ${seed}: ${y}/30 years, ${st.living.length} living`);
  }
  return { seed, source: root, years: 30, ...summarize(st, from, Sim.YEAR) };
}
// The gate's three quantities, each as a target record (docs/gates.md, row 26; VB-265): the mean over the seeds against the reference
// (the means of an earlier run, written by --make-reference), within 5% (marriages a year, first-marriage age) or 2 points (never-married
// share); the noise is twice the standard error over the seeds, so a residual inside it is `noise`. Appended with --record.
const MEASURES = [['marriagesPerYear', 'marriages-per-year', 0.05, true, ' /yr'], ['firstMarriageAge', 'first-marriage-age', 0.05, true, ' yr'],
  ['neverShare', 'never-married', 0.02, false, '']];
const gitHead = () => { try { return require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname }).toString().trim(); } catch (e) { return 'unknown'; } };
function record(rows, refFile, make) {
  const { target } = require('../tests/lib/targets.js'), mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const stats = Object.fromEntries(MEASURES.map(([key]) => {
    const v = rows.map((r) => r[key]).filter(Number.isFinite), m = mean(v);
    return [key, { mean: m, se: v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1) / v.length) : 0, n: v.length, values: v }];
  }));
  if (make) {
    fs.mkdirSync(path.dirname(refFile), { recursive: true });
    fs.writeFileSync(refFile, JSON.stringify({ commit: gitHead(), seeds: rows.map((r) => r.seed),
      means: Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, s.mean])) }, null, 1) + '\n');
    console.error(`demography: reference written to ${refFile}`);
  }
  if (!fs.existsSync(refFile)) { console.error(`demography: no reference at ${refFile} (--make-reference writes one); no target records`); return; }
  const ref = JSON.parse(fs.readFileSync(refFile, 'utf8'));
  for (const [key, name, tol, relative, unit] of MEASURES) {
    const s = stats[key], base = ref.means[key], slack = relative ? base * tol : tol;
    target(`demography/${name}`, { where: `populous small, 30 years, seeds ${rows.map((r) => r.seed).join(',')}; reference ${String(ref.commit).slice(0, 7)}`,
      unit, dir: 'range', target: [base - slack, base + slack], measured: s.mean, noise: { kind: 'seeds', spread: 2 * s.se, n: s.n },
      extra: { se: s.se, values: s.values.map((x) => +x.toFixed(4)) } });
  }
}
async function main(args) {
  const at = args.indexOf('--source');
  const root = at < 0 ? path.join(__dirname, '..') : path.resolve(args.splice(at, 2)[1]);
  const rf = args.indexOf('--reference');
  const refFile = rf < 0 ? path.join(__dirname, '..', 'docs/bench/demography-reference.json') : path.resolve(args.splice(rf, 2)[1]);
  const nums = args.filter((a) => !a.startsWith('--')), seeds = nums.length ? nums.map(Number) : [7, 42];
  if (seeds.some((s) => !Number.isSafeInteger(s))) throw new Error('seeds must be integers');
  const queue = [...seeds], rows = [], lanes = Math.max(1, Math.min(os.cpus().length, seeds.length));
  await Promise.all(Array.from({ length: lanes }, async () => {
    while (queue.length) {
      const seed = queue.shift();
      const row = await new Promise((done) => {
        const p = fork(__filename, ['--child', root, String(seed)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        let got = null; p.on('message', (m) => { got = m; }); p.on('exit', () => done(got));
      });
      if (!row) throw new Error(`seed ${seed} failed`);
      rows.push(row); console.log(JSON.stringify(row));
    }
  }));
  rows.sort((a, b) => a.seed - b.seed);
  record(rows, refFile, args.includes('--make-reference'));
}
if (process.argv[2] === '--child') {
  const row = runSeed(process.argv[3], +process.argv[4]);
  process.send(row, () => process.disconnect());
} else if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.stack || e.message); process.exit(1); });
module.exports = { summarize };
