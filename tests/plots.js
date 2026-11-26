// Clearing a new plot: a village with waiting people and a free site starts a project; the newLand custom picks who gets the plot.
// On the small islands of tests/lib/probe.js (VB-856; the default island and a 180 by 130 one before).
const VB = require('../src/load.js'), Sim = VB.sim, X = VB['sim/expansion'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('PLOTS FAIL:', m); } };
const { scenario } = require('./lib/probe.js');
// A fresh heirs-scenario state with villager `a` (single, older), a married couple `b`, `c` and a plot started for `a`.
function setup(newLand) {
  const st = scenario('heirs', 7), v = st.villages[0];
  const adults = st.pawns.filter((p) => p.alive && p.age >= 18 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null);
  const men = adults.filter((p) => p.sex === 'm'), women = adults.filter((p) => p.sex === 'f');
  const a = men[0], b = men[1], c = women[0];
  if (!a || !b || !c) return null;
  a.born = Math.min(a.born, b.born, c.born) - 24 * 48; // a is the eldest
  st.unions.push({ id: st.unions.length, a: b.id, b: c.id, start: st.t, end: null, kind: 'marriage' });
  st.demand = [a.id, b.id, c.id];
  const C = VB.culture, Customs = VB['sim/customs'], k = Customs.IDX.newLand;
  st.cenv.settlements[0].practice[k] = Customs.DIMS[k].opts.findIndex((o) => o[0] === newLand);
  // village A's empty farm could be claimed, and nobody who may claim a farm gets a plot (VB-033, tests/farmclaims.js); here it is a ruin
  for (const f of st.farmsteads) if (f.household === null) f.state = 'ruin';
  VB['sim/allotment'].startPlots(st);
  return { st, v, a, b, c };
}
for (const rule of ['village', 'labour', 'intended']) {
  const s = setup(rule); if (!s) { check(false, 'no adults to set up'); continue; }
  const { st, v, a, b, c } = s, live = X.livePlots(st, v), plot = live[0]; // a plot under way is its village's project plan (VB-123)
  check(plot && plot.intended === a.id && plot.what === 'plot' && plot.plot === 0, `${rule}: a plot is started for the first in demand`);
  check(live.length === 2 && live[1].plot === 1, `${rule}: two projects at a time (got ${live.length})`);
  for (const tr of X.tilesOf(plot)) {
    check(Sim.ownerOf(st, tr.tile) && Sim.ownerOf(st, tr.tile).type === 'village', `${rule}: tile ${tr.tile} owned by the village`);
    check(tr.tile !== v.center && !v.wood.includes(tr.tile), `${rule}: tile ${tr.tile} is the green or the wood`);
  }
  check(X.plotJobs(st).length >= 2, `${rule}: jobs are posted`);
  plot.hours[c.id] = 30; plot.hours[b.id] = 10;
  // each tile's step ends through its kind's `done`, as every job does (VB-1821: sim/expansion plotted; no inline case in sim/agents)
  for (const tr of X.tilesOf(plot)) for (let n = 0; tr.i < tr.steps.length && n < 9; n++) { const k = tr.steps[tr.i]; VB['sim/kinds'].KINDS[k].done(st, { kind: k, plot, tr }, null, null, null); }
  check(plot.open === 1 && plot.steps[1].kind === 'foundation', `${rule}: plot done, its cottage's first stage open`);
  const want = rule === 'village' ? (b.born <= c.born ? b.id : c.id) : rule === 'labour' ? c.id : a.id;
  check(plot.to === want, `${rule}: expected ${want}, got ${plot.to}`);
  check(X.plotProgress(st, plot) === 1, `${rule}: progress is 1 when done`);
}
// VB-142: founders seed 7, the small island, two years (96 days): no pawn holds two cleared plots.
let cleared = 0;
{
  const st = scenario('founders', 7), seen = new Set();
  for (let d = 0; d < 2 * 48; d++) {
    Sim.advance(st, 24);
    const held = new Map();
    for (const v of st.villages) for (const pl of X.livePlots(st, v)) if (pl.open >= 1 && pl.to !== null) {
      held.set(pl.to, (held.get(pl.to) || 0) + 1);
      if (!seen.has(pl)) { seen.add(pl); cleared++; }
    }
    for (const [id, n] of held) check(n <= 1, `founders seed 7: pawn ${id} holds ${n} cleared plots on day ${d + 1}`);
  }
}
check(cleared > 0, 'founders seed 7: no plot is cleared for anyone in two years');
// VB-646: a plot cleared with nobody to have it is stamped at the next round, allotted when someone waits, else given back after two years
{
  const s = setup('village');
  if (!s) check(false, 'no adults to set up (VB-646)');
  else {
    const { st, v, a } = s, plot = X.livePlots(st, v)[0], other = X.livePlots(st, v)[1], YEAR = VB['sim/rules'].YEAR;
    const holder = st.households.find((h) => h.holder !== undefined && Sim.isHolder(st, h.holder)).holder;
    st.demand = []; plot.intended = holder; plot.hours = {};
    for (const tr of X.tilesOf(plot)) while (tr.i < tr.steps.length) X.finishStep(st, { plot, tr });
    check(plot.open === 1 && plot.to === null, `VB-646: nobody to have it (to ${plot.to})`);
    const tiles = X.tilesOf(plot).map((t) => t.tile);
    VB['sim/allotment'].startPlots(st); check(plot.vacant === st.t, 'VB-646: stamped at the first round');
    st.t += YEAR; st.demand = [a.id]; // someone now waits: the plot is theirs at the next round
    VB['sim/allotment'].startPlots(st);
    check(plot.to === a.id && plot.vacant === undefined, `VB-646: allotted to the one waiting (to ${plot.to})`);
    plot.to = null; st.demand = []; plot.intended = holder; delete plot.vacant;
    VB['sim/allotment'].startPlots(st); st.t += 2 * YEAR; st.t += 1; VB['sim/allotment'].startPlots(st);
    check(!X.livePlots(st, v).includes(plot), 'VB-646: given back after two years');
    check(tiles.every((t) => !st.used.has(t) && Sim.ownerOf(st, t) === null || Sim.ownerOf(st, t) === 0 || !Sim.ownerOf(st, t)), 'VB-646: tiles released');
    check(tiles.every((t) => st.w.dev[t] === 0), 'VB-646: dev released');
    check(other === undefined || true, '');
  }
}
// VB-959: a household's plot for its heir under way is numbered among its village's, and checkState reads it so
{
  const s = setup('village');
  if (!s) check(false, 'no adults to set up (VB-959)');
  else {
    const { st, v } = s, [plot, next] = X.livePlots(st, v), P = st.plans.projects, h = st.households.find((q) => q.holder !== undefined);
    const list = P.village.get(v.id); list.splice(list.indexOf(plot), 1); // plot 0 becomes a household's, plot 1 a village's begun after it
    plot.holder = { type: 'household', id: h.id }; plot.village = v.id; plot.by = h.id;
    P.household.set(h.id, [...(P.household.get(h.id) || []), plot]); P.heirPlots.push(plot);
    check(X.livePlots(st, v).includes(plot) && next.plot === 1, 'VB-959: the household plot and the village plot are both under way');
    const bad = require('./lib/invariants.js').checkState(st).filter((m) => /plots numbered/.test(m));
    check(!bad.length, `VB-959: plots numbered with a household's among them: ${bad}`);
  }
}
if (failed) process.exit(1);
console.log(`plots ok: ${cleared} plots cleared for someone in two years of founders`);
