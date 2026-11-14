// Compare the active effort policy with an earlier routes module on real generated scenarios, without rendering.
// usage: node tools/path-effort-probe.js [--baseline FILE] [--seeds 7,42] [--years 2] [--map tiny|small]
// Runs founders and populous, reports population/hunger, path-wear hashes, route work and same-world effort/time comparisons.
// --baseline loads that routes module before its callers, so generation and the entire simulation use the baseline policy.
// The comparison sampler uses no simulation randomness and does not populate the journey cache. Timings are diagnostic only.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
const opt = (key, fallback) => { const i = args.indexOf('--' + key); return i < 0 ? fallback : args[i + 1]; };
const baseline = opt('baseline', null), seeds = opt('seeds', '7,42').split(',').map(Number), years = +opt('years', 2);
const map = opt('map', 'tiny'), sizes = { tiny: [120, 85], small: [180, 130] };
if (!sizes[map] || !Number.isFinite(years) || years < 0 || seeds.some(x => !Number.isInteger(x))) throw new Error('bad probe arguments');
const routeFile = path.join(root, 'src/sim/routes.js'), js = require.extensions['.js'];
if (baseline) require.extensions['.js'] = (mod, file) => file === routeFile
  ? mod._compile(fs.readFileSync(baseline, 'utf8'), file) : js(mod, file);
let VB;
try { VB = require('../src/load.js'); } finally { require.extensions['.js'] = js; }
const R = VB['sim/routes'];
let policy = R;
if (baseline) {
  vm.runInThisContext(fs.readFileSync(routeFile, 'utf8'), { filename: routeFile });
  policy = VB['sim/routes']; VB['sim/routes'] = R;
}
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function network(w) {
  const stages = [0, 0, 0, 0];
  for (let i = 0; i < w.N; i++) if (!w.water[i]) stages[w.worn[i]]++;
  return { stages, stagesHash: hash(Array.from(w.worn)), wearHash: hash(Array.from(w.wear)) };
}
function sample(st) {
  const w = st.w, pairs = [];
  for (const f of st.farmsteads.slice(0, 30)) {
    for (const field of f.fields) pairs.push([f.house, field.tile]);
    const v = st.villages[f.village];
    pairs.push([f.house, v.center]);
    if (v.wood.length) pairs.push([f.house, v.wood[(f.id * 7) % v.wood.length]]);
  }
  const report = { pairs: 0, changed: 0, lowerChoice: 0, longerWalk: 0, timeBefore: 0, timeAfter: 0, choiceBefore: 0, choiceAfter: 0 };
  for (const [from, to] of pairs) {
    const a = policy.findRoute(w, from, to, Infinity, false), b = policy.findRoute(w, from, to, Infinity);
    if (!a || !b) continue;
    const ta = policy.routeCost(w, a), tb = policy.routeCost(w, b), ca = policy.routeCost(w, a, true), cb = policy.routeCost(w, b, true);
    report.pairs++;
    if (a.join(',') !== b.join(',')) report.changed++;
    if (cb < ca - 1e-8) report.lowerChoice++;
    if (tb > ta + 1e-8) report.longerWalk++;
    report.timeBefore += ta; report.timeAfter += tb; report.choiceBefore += ca; report.choiceAfter += cb;
  }
  return report;
}
const results = [];
for (const scenario of ['founders', 'populous']) for (const seed of seeds) {
  const it = VB.gen.generate(seed, { cols: sizes[map][0], rows: sizes[map][1] });
  let next; while (!(next = it.next()).done) {}
  const st = VB.sim.seed(next.value, seed, scenario), initial = network(st.w), living = () => st.pawns.filter(p => p.alive).length;
  const startPopulation = living(), comparison = sample(st);
  VB.resetCounts();
  let hungryPawnDays = 0, pawnDays = 0;
  const start = performance.now();
  for (let day = 0; day < years * VB.sim.YEAR_DAYS; day++) {
    VB.sim.advance(st, VB.sim.DAY);
    for (const p of st.pawns) if (p.alive) { pawnDays++; if (p.hunger > 0) hungryPawnDays++; }
  }
  const work = { ...VB.count }, households = st.households.map(h => ({ id: h.id, members: h.members.length,
    grain: h.grain, wood: h.wood, hunger: h.members.reduce((n, id) => n + st.pawns[id].hunger, 0) }));
  results.push({ scenario, seed, map, years, startPopulation, endPopulation: living(),
    households: st.households.length, hungryPawnDays, pawnDays, routeFallbacks: st.routeFallbacks,
    initial, final: network(st.w), comparison, work, householdOutcomes: households, ms: +(performance.now() - start).toFixed(2) });
}
console.log(JSON.stringify({ baseline: baseline || 'active', results }, null, 2));
