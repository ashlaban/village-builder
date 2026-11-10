// The reduced scenarios of the bands (VB-163; tests/lib/bands.js): every band with an `assert` is checked on its reduced run, each seed in
// its own process, and a band outside its range fails with its id, the seed and the value. The full runs are tools/bands.js, nightly.
// `node tests/bands.js` runs them all; `--seed N` runs one seed and prints its samples as JSON (the child's half).
const { spawn } = require('child_process'), os = require('os'), path = require('path');
const B = require('./lib/bands.js'), { target } = require('./lib/targets.js');
const args = process.argv.slice(2), seedArg = args.indexOf('--seed');
// the runs the asserted bands ask for, one per setup, years and seed
const runs = new Map();
for (const band of B.BANDS) if (band.assert) for (const seed of band.assert.seeds) {
  const { setup, years } = band.assert, key = `${setup}|${years}|${seed}`;
  if (!runs.has(key)) runs.set(key, { setup, years, seed, bands: [] });
  runs.get(key).bands.push(band);
}
if (seedArg >= 0) {
  const seed = +args[seedArg + 1], setup = args[args.indexOf('--setup') + 1], years = +args[args.indexOf('--years') + 1];
  const r = B.runScenario({ ...B.SETUPS[setup], seed, years });
  process.stdout.write(JSON.stringify(r));
  return;
}
const child = (run) => new Promise((done) => {
  const p = spawn(process.execPath, [__filename, '--seed', run.seed, '--setup', run.setup, '--years', run.years], { cwd: path.join(__dirname, '..') });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => done(code ? { error: `exit ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}` } : JSON.parse(out)));
});
(async () => {
  const t0 = Date.now(), list = [...runs.values()], lanes = Math.max(1, Math.min(os.cpus().length, list.length)), queue = [...list];
  await Promise.all(Array.from({ length: lanes }, async () => { while (queue.length) { const run = queue.shift(); run.result = await child(run); } }));
  let failed = 0, out = 0, core = 0, wall = 0; const lines = [];
  for (const run of list) {
    const tag = `${run.setup} seed ${run.seed}, ${run.years} years`;
    if (run.result.error) { failed++; console.error(`BANDS FAIL: ${tag}: ${run.result.error}`); continue; }
    core += run.result.cpuSecs; wall += run.result.secs;
    const s = B.summary(run.result.samples), vals = [];
    for (const band of run.bands) {
      const j = B.judge(band, 'assert', run.result.samples);
      vals.push(`${band.id.split('/')[0]} ${B.fmt(j.value)}`);
      if (band.kind === 'watched') {
        if (!j.ok) { failed++; console.error(`BANDS FAIL: ${j.id} at ${tag}: ${B.fmt(j.value)} outside ${B.fmt(j.lo)}..${B.fmt(j.hi)}`); }
        if (!j.ok) console.error('  ' + run.result.samples.flatMap((x) => x.invariants).slice(0, 6).join('\n  '));
      } else {
        // a balance band is a target; the reduced run shows it at the full range, never failing (VB-264)
        const t = target(`bands/${band.id.split('/')[0]}/seed${run.seed}`, { where: tag, dir: 'range', target: [j.lo, j.hi], measured: j.value,
          noise: { kind: 'seeds', spread: 0, n: 1 } });
        if (t.status === 'out') out++;
      }
    }
    lines.push(`  seed ${run.seed}: ${s.start} -> ${s.end} living, ${s.births} births, ${s.marriages} marriages, deaths `
      + `${Object.entries(s.deaths).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}, hungry ${(100 * s.hungryShare).toFixed(2)}% of household-days;`
      + ` ${vals.join(', ')} (${run.result.secs.toFixed(1)} s, ${run.result.cpuSecs.toFixed(1)} s of CPU)`);
  }
  console.log(lines.join('\n'));
  if (failed) process.exit(1);
  console.log(`bands ok: ${runs.size} reduced runs, ${B.BANDS.filter((b) => b.assert).length} asserted bands (${out} targets out), ${wall.toFixed(1)} s of runs, `
    + `${core.toFixed(1)} s of CPU with V8's compiler and GC threads (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
})();
