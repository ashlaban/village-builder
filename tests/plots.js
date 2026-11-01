// Clearing a new plot: a village with waiting people and a free site starts a project; the newLand custom picks who gets the plot.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, X = VB['sim/expansion'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('PLOTS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
// A fresh heirs-scenario state with villager `a` (single, older), a married couple `b`, `c` and a plot started for `a`.
function setup(newLand) {
  const st = Sim.seed(world(7), 7, 'heirs'), v = st.villages[0];
  const adults = st.pawns.filter((p) => p.alive && p.age >= 18 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null);
  const men = adults.filter((p) => p.sex === 'm'), women = adults.filter((p) => p.sex === 'f');
  const a = men[0], b = men[1], c = women[0];
  if (!a || !b || !c) return null;
  a.born = Math.min(a.born, b.born, c.born) - 24 * 48; // a is the eldest
  st.unions.push({ id: st.unions.length, a: b.id, b: c.id, start: st.t, end: null, kind: 'marriage' });
  st.demand = [a.id, b.id, c.id];
  const C = VB.culture, k = C.IDX.newLand;
  st.cenv.settlements[0].practice[k] = C.DIMS[k].opts.findIndex((o) => o[0] === newLand);
  X.startPlots(st);
  return { st, v, a, b, c };
}
for (const rule of ['village', 'labour', 'intended']) {
  const s = setup(rule); if (!s) { check(false, 'no adults to set up'); continue; }
  const { st, v, a, b, c } = s, plot = v.plots[0];
  check(plot && plot.intended === a.id, `${rule}: a plot is started for the first in demand`);
  check(v.plots.length === 2, `${rule}: two projects at a time (got ${v.plots.length})`);
  for (const tr of plot.tiles) {
    check(Sim.ownerOf(st, tr.tile) && Sim.ownerOf(st, tr.tile).type === 'village', `${rule}: tile ${tr.tile} owned by the village`);
    check(tr.tile !== v.center && tr.tile !== v.commonsWood, `${rule}: tile ${tr.tile} is the green or the woods`);
  }
  check(X.plotJobs(st).length >= 2, `${rule}: jobs are posted`);
  plot.hours[c.id] = 30; plot.hours[b.id] = 10;
  for (const tr of plot.tiles) while (tr.i < tr.steps.length) X.finishStep(st, { plot, tr });
  check(plot.done, `${rule}: plot done`);
  const want = rule === 'village' ? (b.born <= c.born ? b.id : c.id) : rule === 'labour' ? c.id : a.id;
  check(plot.holder === want, `${rule}: expected ${want}, got ${plot.holder}`);
  check(X.plotProgress(st, plot) === 1, `${rule}: progress is 1 when done`);
}
if (failed) process.exit(1);
console.log('plots ok');
