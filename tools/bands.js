// usage: node tools/bands.js [--runs populous,founders,heirs] [--years N] [--if-new] [--out FILE]
// The full runs of the bands (VB-163; tests/lib/bands.js, Kim's decision 9): every band's `report` run, in parallel, one per core.
// Prints each report band as in or out (a described band, such as a household's hunger, only its value), growth over each reference
// scenario's seeds against its targets (a shrinking median is named a COLLAPSE), and per run the population at years 1, 10, 20, 30
// (and 50), births, marriages, deaths by cause and the share of hungry household-days; appends the whole to docs/bench/bands.jsonl.
// Reported, never asserted: the tool never fails (a run that throws is printed and recorded as an error).
//   (no argument)  populous small, seeds 3, 7, 11, 42, 30 years; founders small, sixteen seeds, 50 years; heirs small, seeds 7 and
//                  42, 30 years (FULL in tests/lib/bands.js)
//   --runs LIST    only these of the full runs (the names of FULL in tests/lib/bands.js)
//   --years N      every run cut to N years, for a quick look (recorded with the cut)
//   --if-new       does nothing when the history already holds a full run at HEAD (tools/nightly.js)
//   --out FILE     the history to append to (default docs/bench/bands.jsonl)
//   --record       also appends the target records to docs/bench/targets.jsonl (tests/lib/targets.js)
require('./help.js')(__filename);
const fs = require('fs'), os = require('os'), path = require('path'), { fork } = require('child_process');
const root = path.join(__dirname, '..'), B = require('../tests/lib/bands.js'), { target } = require('../tests/lib/targets.js');
const HISTORY = path.join(root, 'docs/bench/bands.jsonl');
const git = (a) => { try { return require('child_process').execFileSync('git', a, { cwd: root }).toString().trim(); } catch (e) { return 'unknown'; } };

// the runs the report bands ask for, one per scenario, map, years and seed, each with its bands
function plan({ only = null, years = null } = {}) {
  const runs = new Map();
  for (const band of B.BANDS) {
    const r = band.report; if (!r) continue;
    const name = Object.keys(B.FULL).find((k) => B.FULL[k].scenario === r.scenario && B.FULL[k].map === r.map && B.FULL[k].years === r.years) || r.scenario;
    if (only && !only.includes(name)) continue;
    for (const seed of r.seeds) {
      const run = { name, scenario: r.scenario, map: r.map, years: years || r.years, seed }, key = JSON.stringify(run);
      if (!runs.has(key)) runs.set(key, { ...run, bands: [] });
      runs.get(key).bands.push(band.id);
    }
  }
  return [...runs.values()];
}
const child = (run) => new Promise((done) => {
  const p = fork(__filename, ['--child', JSON.stringify(run)], { cwd: root, silent: true });
  let got = null, err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('message', (m) => { got = m; });
  p.on('exit', (code) => done(got || { error: `exit ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}` }));
});
function judgeRun(run) {
  if (run.result.error) return [];
  return run.bands.map((id) => {
    const band = B.BANDS.find((b) => b.id === id);
    return B.judge(band, 'report', run.result.samples);
  });
}
const line = (run) => {
  if (run.result.error) return `${run.name} seed ${run.seed}: ERROR ${run.result.error}`;
  const s = run.summary;
  return `${run.name} ${run.map} seed ${run.seed}, ${run.years} years (${run.result.secs.toFixed(0)} s): living ${s.start} at the start, `
    + `${Object.entries(s.population).map(([y, n]) => `${n} at ${y}`).join(', ')}, ${s.end} at the end; ${s.births} births, ${s.marriages} marriages, `
    + `deaths ${Object.entries(s.deaths).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}; hungry ${(100 * s.hungryShare).toFixed(2)}% of household-days`;
};
async function main(args = process.argv.slice(2)) {
  const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
  const only = opt('runs', null) && opt('runs').split(','), years = opt('years', null) && +opt('years'), out = opt('out', HISTORY);
  const commit = git(['rev-parse', 'HEAD']);
  if (args.includes('--if-new') && fs.existsSync(out)
    && fs.readFileSync(out, 'utf8').split('\n').some((l) => {
      try { const r = JSON.parse(l); return r.commit === commit && !r.cut && !r.only; } catch (e) { return false; } })) {
    console.log(`bands: ${commit.slice(0, 7)} already has its full runs in ${path.relative(root, out)}`);
    return;
  }
  const runs = plan({ only, years }), t0 = Date.now(), queue = [...runs], lanes = Math.max(1, Math.min(os.cpus().length, runs.length));
  console.log(`bands: ${runs.length} runs, ${lanes} at a time`);
  await Promise.all(Array.from({ length: lanes }, async () => {
    while (queue.length) {
      const run = queue.shift(); run.result = await child(run);
      if (!run.result.error) run.summary = B.summary(run.result.samples);
      console.log(line(run));
    }
  }));
  const bands = runs.flatMap((run) => judgeRun(run).map((j) => ({ ...j, run: run.name, seed: run.seed })));
  console.log('\nbands (reported, never failing):');
  for (const j of bands) console.log(j.kind === 'described' ? `      ${j.id} seed ${j.seed}: ${B.fmt(j.value)} (described)`
    : `  ${j.ok ? 'in ' : 'OUT'} ${j.id} seed ${j.seed}: ${B.fmt(j.value)} (band ${B.fmt(j.lo)}..${B.fmt(j.hi)})`);
  const cpus = os.cpus(), entry = { schema: 1, date: new Date().toISOString(), commit, dirty: git(['status', '--porcelain']) !== '',
    node: process.version, cpu: { model: cpus[0]?.model || 'unknown', cores: cpus.length }, minutes: +((Date.now() - t0) / 60000).toFixed(1),
    ...(years ? { cut: years } : {}), ...(only ? { only } : {}),
    runs: runs.map((r) => ({ name: r.name, scenario: r.scenario, map: r.map, seed: r.seed, years: r.years,
      ...(r.result.error ? { error: r.result.error } : { secs: +r.result.secs.toFixed(1), ...r.summary }) })),
    bands: bands.map((j) => ({ id: j.id, seed: j.seed, value: Number.isFinite(j.value) ? +j.value.toFixed(4) : String(j.value),
      ...(j.kind === 'described' ? {} : { ok: j.ok }) })) };
  // target records (docs/gates.md, row 22; VB-265): one per band and run, the mean over the seeds against the band's range, its noise
  // the standard error over the seeds (a residual within twice that is `noise`), the seeds' own values kept in the record
  const groups = new Map();
  for (const j of bands) { const k = `${j.id.split('/')[0]}/${j.run}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(j); }
  for (const [k, js] of groups) {
    if (js[0].kind === 'described') continue; // no target: its values are in bands.jsonl
    const v = js.map((j) => j.value), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
    const se = n > 1 && v.every(Number.isFinite) ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) / n) : 0;
    target(`bands/${k}`, { where: `${js[0].run} ${runs.find((r) => r.name === js[0].run).map}, seeds ${js.map((j) => j.seed).join(',')}`, dir: 'range',
      target: [js[0].lo, js[0].hi], measured: mean, noise: { kind: 'seeds', spread: 2 * se, n }, extra: {
        se, seeds: v.map((x) => +x.toFixed(4)), inBand: js.filter((j) => j.ok).length } });
  }
  // growth over the seeds of each reference scenario (tests/lib/bands.js, GROWTH); a cut run is judged over its cut years
  for (const name of B.GROWTH.runs) {
    const rs = runs.filter((r) => r.name === name && !r.result.error); if (!rs.length) continue;
    const g = B.growthTargets(rs.map((r) => r.summary.end / r.summary.start), rs[0].years);
    for (const t of g.targets) target(`bands/${t.id}/${name}`, { where: `${name} ${rs[0].map}, ${rs[0].years} years, ${rs.length} seeds`, dir: t.dir,
      target: t.target, measured: t.measured, noise: { kind: 'seeds', spread: 0, n: rs.length } });
    if (g.collapse) console.log(`COLLAPSE: ${name}: the median seed shrinks`);
    entry.growth = { ...(entry.growth || {}), [name]: Object.fromEntries(g.targets.map((t) => [t.id, +t.measured.toFixed(4)])) };
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.appendFileSync(out, JSON.stringify(entry) + '\n');
  const judged = bands.filter((j) => j.kind !== 'described'), outs = judged.filter((j) => !j.ok).length;
  console.log(`bands: ${judged.length - outs} in, ${outs} out, ${runs.filter((r) => r.result.error).length} errors in ${entry.minutes} minutes;`
    + ` appended to ${path.relative(root, out)}`);
}
const argv = process.argv.slice(2);
if (argv[0] === '--child') {
  let msg; try { msg = B.runScenario(JSON.parse(argv[1])); } catch (e) { msg = { error: e.stack || e.message }; }
  process.send(msg, () => process.disconnect());
} else if (require.main === module) main().catch((e) => console.error('bands: UNAVAILABLE ' + (e.stack || e.message)));
module.exports = { plan, main };
