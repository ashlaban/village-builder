// usage: node tools/crops.js [--runs populous,founders,heirs] [--years N] [--seeds 3,7] [--out FILE] [--load FILE] [--json]
// The crops' wrap-up measure (VB-356; design.md, Crops and rotations): the full runs of the bands (tests/lib/bands.js FULL), one process a
// run, one per core, each sampled at the start of summer (the fields sown with each crop: barley and peas sown in spring, rye standing from
// the autumn before) and at the year's end (each farm's harvest by crop from its ledger, its food by source, its hunger, the crops it holds).
// Printed, a scenario at a time (years from 3 on, the start settled):
//   - rations a household-year by source (grain by crop net of seed, milk, butter, meat, as tools/balance.js) against need (made over
//     need: the sum of the rations over the sum of the need, not a mean of each household's ratio, which small households swing);
//     household-years with any hungry day and with more than 30% of their days hungry (the bands' share)
//   - fields, fallow fields and soil a farm, by rotation; the share of farms by rotation at years 1, 10, 20, 30 (and 50)
//   - the crops held on the island and in each village (a field's seed or more in a store, or a field under the crop) at the start and
//     the end, the year a village first held a crop it did not start with, and any crop lost to the island
//   - the hedge: the correlation of the crops' yields a sown field, over the village-years with two sown fields or more of both; hungry
//     household-years of farms that sowed one crop against two or more, in the village-years that had both kinds
//   - frost: fields of each crop sown and not brought in (lost to frost or left standing)
//   --runs LIST   the full runs to make (default all three: populous small 4 seeds 30 years, founders small 16 seeds 50 years, heirs small
//                 2 seeds 30 years); --years N cuts every run to N years; --seeds LIST replaces each run's seeds
//   --out FILE    also writes the runs' samples as JSON (for further reading); --load FILE prints the report from such a file, running nothing
//   --json        the report as JSON
// It samples outside the simulation (Sim.advance and reads of st), adding no counter and writing nothing to st.
require('./help.js')(__filename);
const fs = require('fs'), os = require('os'), path = require('path'), { fork } = require('child_process');
const root = path.join(__dirname, '..');

// The crops held (VB-356): in each village, a field's seed or more in one of its households' stores or its own, or a field under the crop;
// on the island, the same; `any`, a crop of which some is held anywhere, even less than a field's seed (none of it: lost to the island).
// Read by tests/lib/bands.js (the band crops-lost) as by this tool.
function held(VB, st) {
  const { CROPS } = VB['sim/rules'], Stores = VB['sim/stores'], { underCrop } = VB['sim/rotations'];
  const SEEDED = Stores.CROP_LIST.filter((k) => CROPS[k].seed > 0), v = {}, island = new Set(), any = new Set();
  const add = (id, k) => { (v[id] || (v[id] = new Set())).add(k); island.add(k); any.add(k); };
  for (const id of st.liveHouseholds) {
    const hh = st.households[id], f = st.farmsteads[hh.farmstead];
    for (const k of SEEDED) if (Stores.grainOf(hh, k) > 0) any.add(k);
    if (!f || f.village === null || f.village === undefined) continue;
    for (const k of SEEDED) if (Stores.grainOf(hh, k) >= CROPS[k].seed || f.fields.some((fd) => fd.crop === k && underCrop(fd))) add(f.village, k);
  }
  for (const vl of st.villages) if (vl.grain) for (const k of SEEDED) {
    if ((vl.grain[k] || 0) >= CROPS[k].seed) add(vl.id, k); else if (vl.grain[k] > 0) any.add(k);
  }
  return { villages: Object.fromEntries(Object.entries(v).map(([k, s]) => [k, [...s].sort()])), island: [...island].sort(), any: [...any].sort() };
}

// ---- one run, in a child ----
function run({ scenario, map, seed, years }) {
  const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, F = VB['sim/hunger'], Stores = VB['sim/stores'];
  const { CROPS, DAY, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'], { underCrop } = VB['sim/rotations'], { MAPS } = require('../tests/lib/bands.js');
  const SEEDED = Stores.CROP_LIST.filter((k) => CROPS[k].seed > 0);
  const it = G.generate(seed, { cols: MAPS[map][0], rows: MAPS[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario), crops = () => held(VB, st);
  const samples = [{ year: 0, crops: crops() }];
  for (let y = 1; y <= years; y++) {
    const t0 = (y - 1) * Sim.YEAR + 1, t1 = y * Sim.YEAR + 1;
    if (st.t < t0) Sim.advance(st, t0 - st.t);
    const before = new Map();
    for (const id of st.liveHouseholds) before.set(id, st.households[id].hungryDays);
    Sim.advance(st, SEASON_DAYS * DAY); // the start of summer: what each farm has sown
    const sown = new Map();
    for (const id of st.liveHouseholds) {
      const f = st.farmsteads[st.households[id].farmstead]; if (!f) continue;
      const n = {}; for (const fd of f.fields) if (CROPS[fd.crop].seed > 0 && underCrop(fd)) n[fd.crop] = (n[fd.crop] || 0) + 1;
      sown.set(id, n);
    }
    const from = st.record.length;
    Sim.advance(st, t1 - st.t);
    const frost = {};
    for (let i = from; i < st.record.length; i++) {
      const e = st.record[i]; if (typeof e !== 'object' || e.kind !== 'frost') continue;
      for (const k of SEEDED) if ((e.text || '').includes(k)) frost[k] = (frost[k] || 0) + 1; // farms a year that lost the crop
    }
    const rows = [];
    for (const id of st.liveHouseholds) {
      const hh = st.households[id], f = st.farmsteads[hh.farmstead];
      if (!f || !before.has(id) || !sown.has(id)) continue; // present the whole year
      const grain = {}, gross = {}, made = { milk: 0, butter: 0, meat: 0 };
      for (const e of hh.ledger) {
        if (e.t < t0 || e.t >= t1) continue;
        if (e.kind === 'harvest') { const k = e.crop || 'barley'; gross[k] = (gross[k] || 0) + e.n; grain[k] = (grain[k] || 0) + e.n - (e.first ? CROPS[k].seed : 0); }
        else if (e.kind === 'meat') made.meat += e.n;
      }
      for (const k of ['milk', 'butter']) made[k] += Stores.yearSum(hh, k, y);
      rows.push({ id, village: f.village, rotation: f.fields.length ? f.fields[0].rotation : null, fields: f.fields.length,
        fallow: f.fields.filter((q) => CROPS[q.crop].fallow).length,
        soil: f.fields.length ? +(f.fields.reduce((s, q) => s + q.soil, 0) / f.fields.length).toFixed(3) : null,
        sown: sown.get(id), gross, grain, ...made, need: F.dailyNeed(st, hh) * YEAR_DAYS, hungry: hh.hungryDays - before.get(id) });
    }
    samples.push({ year: y, rows, frost, crops: crops() });
  }
  return { scenario, map, seed, years, samples };
}
if (require.main === module && process.argv[2] === '--child') {
  const r = run(JSON.parse(process.argv[3]));
  process.send(r, () => process.exit(0));
  return;
}

// ---- the report ----
const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0), mean = (xs, f) => (xs.length ? sum(xs, f) / xs.length : NaN);
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
function corr(pairs) {
  const n = pairs.length; if (n < 3) return { n, r: null };
  const mx = mean(pairs, (p) => p[0]), my = mean(pairs, (p) => p[1]);
  let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return { n, r: sxx && syy ? r2(sxy / Math.sqrt(sxx * syy)) : null };
}
const FROM = 3, HUNGRY_SHARE = 0.3, YEAR_DAYS = 48, CROP = ['barley', 'rye', 'peas'];
function report(name, runs) {
  const hy = runs.flatMap((r) => r.samples.slice(1).filter((s) => s.year >= FROM).flatMap((s) => s.rows.map((x) => ({ ...x, seed: r.seed, year: s.year }))));
  const food = (x) => CROP.reduce((n, k) => n + (x.grain[k] || 0), 0) + x.milk + x.butter + x.meat;
  const hungry = (l) => ({ n: l.length, any: r2(100 * l.filter((x) => x.hungry > 0).length / l.length), over30: r2(100 * l.filter((x) => x.hungry > HUNGRY_SHARE * YEAR_DAYS).length / l.length), count: l.filter((x) => x.hungry > HUNGRY_SHARE * YEAR_DAYS).length, anyCount: l.filter((x) => x.hungry > 0).length });
  const rations = { householdYears: hy.length, ...Object.fromEntries(CROP.map((k) => [k, r2(mean(hy, (x) => x.grain[k] || 0))])),
    milk: r2(mean(hy, (x) => x.milk)), butter: r2(mean(hy, (x) => x.butter)), meat: r2(mean(hy, (x) => x.meat)), need: r2(mean(hy, (x) => x.need)),
    madeOverNeed: r2(sum(hy, food) / sum(hy, (x) => x.need)), hungry: hungry(hy) };
  const rot = {};
  for (const x of hy) { if (!x.rotation) continue; (rot[x.rotation] || (rot[x.rotation] = [])).push(x); }
  const byRotation = Object.fromEntries(Object.entries(rot).map(([k, l]) => [k, { farmYears: l.length, fields: r2(mean(l, (x) => x.fields)), fallow: r2(mean(l, (x) => x.fallow)),
    soil: r2(mean(l, (x) => x.soil)), madeOverNeed: r2(sum(l, food) / sum(l, (x) => x.need)), hungry: hungry(l) }]));
  const at = [1, 10, 20, 30, 50].filter((y) => y <= runs[0].years);
  const shareOverTime = Object.fromEntries(at.map((y) => {
    const l = runs.flatMap((r) => (r.samples[y] ? r.samples[y].rows : [])).filter((x) => x.rotation), c = {};
    for (const x of l) c[x.rotation] = (c[x.rotation] || 0) + 1;
    return [y, Object.fromEntries(Object.entries(c).sort().map(([k, n]) => [k, r2(n / l.length)]))];
  }));
  // crops held: start and end, the first year a village holds a crop it did not start with (villages present at the start), crops lost
  const spread = runs.map((r) => {
    const s0 = r.samples[0].crops, last = r.samples[r.samples.length - 1].crops, firsts = {};
    for (const v of Object.keys(s0.villages)) for (const k of CROP) {
      if (s0.villages[v].includes(k)) continue;
      const s = r.samples.find((x) => x.crops.villages[v] && x.crops.villages[v].includes(k));
      firsts[`${v}:${k}`] = s ? s.year : null;
    }
    const lost = s0.island.filter((k) => !last.any.includes(k)), lostSeed = s0.island.filter((k) => !last.island.includes(k));
    const villages = Object.keys(last.villages).length, oneCrop = Object.values(last.villages).filter((c) => c.length === 1).length;
    return { seed: r.seed, start: s0.villages, crossed: firsts, lost, lostSeed, villagesEnd: villages, barleyOnlyEnd: oneCrop };
  });
  // the hedge: a crop's yield a sown field (gross sheaves over the fields sown at the start of summer), a village-year with 2 fields of each
  const vy = new Map();
  for (const x of hy) {
    const k = `${x.seed}:${x.year}:${x.village}`; if (!vy.has(k)) vy.set(k, []); vy.get(k).push(x);
  }
  const yieldOf = (l, k) => { const n = sum(l, (x) => x.sown[k] || 0); return n >= 2 ? sum(l, (x) => x.gross[k] || 0) / n : null; };
  const pairs = { 'barley-rye': [], 'barley-peas': [], 'rye-peas': [] };
  for (const l of vy.values()) for (const p of Object.keys(pairs)) {
    const [a, b] = p.split('-'), ya = yieldOf(l, a), yb = yieldOf(l, b); if (ya !== null && yb !== null) pairs[p].push([ya, yb]);
  }
  const correlation = Object.fromEntries(Object.entries(pairs).map(([p, l]) => [p, corr(l)]));
  const nCrops = (x) => Object.keys(x.sown).filter((k) => x.sown[k] > 0).length;
  const one = [], two = [];
  for (const l of vy.values()) {
    const a = l.filter((x) => nCrops(x) === 1), b = l.filter((x) => nCrops(x) >= 2);
    if (a.length && b.length) { one.push(...a); two.push(...b); }
  }
  const hedge = { oneCrop: hungry(one), twoOrMore: hungry(two), allOneCrop: hungry(hy.filter((x) => nCrops(x) === 1)), allTwoOrMore: hungry(hy.filter((x) => nCrops(x) >= 2)) };
  const sownAll = Object.fromEntries(CROP.map((k) => [k, sum(hy, (x) => x.sown[k] || 0)]));
  const frostAll = Object.fromEntries(CROP.map((k) => [k, sum(runs, (r) => sum(r.samples.slice(1).filter((s) => s.year >= FROM), (s) => s.frost[k] || 0))]));
  const yields = Object.fromEntries(CROP.map((k) => [k, r2(sownAll[k] ? sum(hy, (x) => x.gross[k] || 0) / sownAll[k] : NaN)]));
  return { name, seeds: runs.map((r) => r.seed), years: runs[0].years, from: FROM, rations, byRotation, shareOverTime, spread, correlation, hedge,
    fieldsSown: sownAll, yieldSownField: yields, farmYearsWithFrostLoss: frostAll };
}
function print(rep) {
  console.log(`\n=== ${rep.name}: seeds ${rep.seeds.join(',')}, ${rep.years} years, years ${rep.from} on ===`);
  console.log('rations a household-year by source, against need:'); console.table([{ ...rep.rations, hungry: undefined }]);
  console.log('hungry household-years:', rep.rations.hungry);
  console.log('by rotation (farm-years):'); console.table(Object.fromEntries(Object.entries(rep.byRotation).map(([k, v]) => [k, { ...v, hungry: undefined, 'hungry any %': v.hungry.any, 'hungry >30% %': v.hungry.over30 }])));
  console.log('share of farms by rotation, by year:'); console.table(rep.shareOverTime);
  console.log('crops held, a seed at a time:');
  for (const s of rep.spread) console.log(`  seed ${s.seed}: start ${JSON.stringify(s.start)}; crossed (village:crop -> year) ${JSON.stringify(s.crossed)}; lost to the island ${s.lost.join(',') || 'none'} (below a field's seed: ${s.lostSeed.join(',') || 'none'}); villages at the end ${s.villagesEnd}, of barley alone ${s.barleyOnlyEnd}`);
  console.log('the hedge: correlation of yields a sown field, village-years:', JSON.stringify(rep.correlation));
  console.log('hungry household-years, one crop sown against two or more (same village-years; all):'); console.table(rep.hedge);
  console.log('fields sown', JSON.stringify(rep.fieldsSown), '; sheaves a sown field', JSON.stringify(rep.yieldSownField), '; farm-years with a frost loss', JSON.stringify(rep.farmYearsWithFrostLoss));
}
async function main(args = process.argv.slice(2)) {
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  let results;
  if (opt('load')) results = JSON.parse(fs.readFileSync(opt('load'), 'utf8'));
  else {
    const { FULL } = require('../tests/lib/bands.js'), names = (opt('runs', 'populous,founders,heirs')).split(','), years = opt('years') && +opt('years');
    const seeds = opt('seeds') && opt('seeds').split(',').map(Number);
    const todo = names.flatMap((n) => (seeds || FULL[n].seeds).map((seed) => ({ name: n, scenario: FULL[n].scenario, map: FULL[n].map, years: years || FULL[n].years, seed })));
    results = {}; let i = 0;
    const child = (job) => new Promise((done) => {
      const p = fork(__filename, ['--child', JSON.stringify(job)], { cwd: root, silent: true }); let got = null, err = '';
      p.stderr.on('data', (d) => { err += d; }); p.on('message', (m) => { got = m; });
      p.on('exit', (code) => done(got || { error: `exit ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}` }));
    });
    const worker = async () => { while (i < todo.length) { const job = todo[i++], r = await child(job); if (r.error) console.error(job.name, job.seed, r.error); else (results[job.name] || (results[job.name] = [])).push(r); } };
    await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, worker));
    for (const n of Object.keys(results)) results[n].sort((a, b) => a.seed - b.seed);
    if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(results));
  }
  const reps = Object.entries(results).map(([n, runs]) => report(n, runs));
  if (args.includes('--json')) console.log(JSON.stringify(reps, null, 1)); else reps.forEach(print);
}
module.exports = { held };
if (require.main === module) main();
