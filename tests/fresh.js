// Fresh land (VB-149): a field broken on ground never farmed (w.dev 0) starts with soil SOIL.fresh, above manure's cap, and yields more at
// its first harvest; each crop wears it as any field, so without manure both it and an old field reach the floor after 9 crops; manure
// never lowers it. A plot's field broken on fresh ground keeps it when its farmstead is made.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, F = VB['sim/fields'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FRESH FAIL:', m); } };
const world = (seed, size = [120, 85]) => { const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (doy, hour = 8) => ({ doy, day: doy, season: Math.floor(doy / 12), sday: doy % 12, hour });
const S = Sim.SOIL, near = (a, b) => Math.abs(a - b) < 1e-9;
const st = Sim.seed(world(7), 7, 'populous'), w = st.w;
const f = st.farmsteads.find((x) => x.household !== null), hh = st.households[f.household];
// two free farmable tiles near the farm: one never farmed, one farmed before (an old field's ground)
const free = [];
for (const [t] of VB['sim/hex'].bfs(w, f.house, 8, VB['sim/routes'].walkable(w)).dist) {
  if (VB['sim/rules'].farmable(w, t) && !st.used.has(t) && st.owner[t] === 0 && !w.dev[t]) free.push(t);
}
check(free.length >= 2, 'two free tiles near the farm');
const [freshTile, oldTile] = free; w.dev[oldTile] = 1;
const breakOn = (tile) => { f.project = { tile, stage: 'break', hours: 0 }; F.finishBreak(st, f); return f.fields[f.fields.length - 1]; };
const fresh = breakOn(freshTile), old = breakOn(oldTile);
check(near(fresh.soil, S.fresh) && near(old.soil, S.start), `soil on fresh ground ${fresh.soil}, on old ground ${old.soil}`);
check(w.dev[freshTile] === 1, 'the fresh tile is farmed now');
// the first harvest: the fresh field yields more, in proportion to its soil
const reap = Sim.KINDS.reap.done, ratio = (fd) => fd.held / (st.ECON.fieldYield * fd.fert * st.weather);
let rf = 0, ro = 0;
for (let k = 0; k < 9; k++) {
  for (const fd of [fresh, old]) { fd.stage = 'ripe'; fd.weedMiss = 0; reap(st, { field: fd }, hh, cal(30)); }
  if (k === 0) { rf = ratio(fresh); ro = ratio(old); }
}
check(ratio(fresh) > 0 && rf > 1.2 * ro, `the first harvest of fresh ground (${rf.toFixed(2)}) beats old ground (${ro.toFixed(2)})`);
check(near(fresh.soil, S.floor) && near(old.soil, S.floor), `both at the floor after 9 crops (${fresh.soil.toFixed(3)}, ${old.soil.toFixed(3)})`);
// manure is not carted to a field above the cap, and never lowers its soil
fresh.soil = 1.3; fresh.stage = 'stubble'; hh.manure = 10;
for (const q of f.fields) if (q !== fresh) q.soil = S.cap;
check(F.manureWanted(f, hh, cal(2)) === null, 'no manure for a field above the cap');
F.manureDone(st, fresh, hh, 2);
check(near(fresh.soil, 1.3), `manure lowered a fresh field's soil to ${fresh.soil}`);
// a plot's field broken on fresh ground keeps its soil when the cottage makes the farmstead
const X = VB['sim/expansion'], v = st.villages[0];
const ids = st.pawns.filter((p) => p.alive && p.age >= 18 && Sim.settlementIdOf(st, p) === v.id && !Sim.isHolder(st, p.id)).map((p) => p.id);
st.demand = ids.slice(0, 1);
X.startPlots(st);
const plot = v.plots[v.plots.length - 1];
if (!plot) check(false, 'a plot is started');
else {
  const ftr = plot.tiles.find((t) => t.kind === 'field'), wasFresh = !w.dev[ftr.tile];
  for (const tr of plot.tiles) while (tr.i < tr.steps.length) X.finishStep(st, { plot, tr });
  check(ftr.fresh === wasFresh, `the plot's field remembers fresh ground (${ftr.fresh})`);
  for (let i = 0; i < 3; i++) X.finishStep(st, { plot, cottage: true });
  const g = st.farmsteads[plot.farmstead];
  check(g && near(g.fields[0].soil, wasFresh ? S.fresh : S.start), `the plot farm's field soil ${g && g.fields[0].soil}`);
}
if (failed) process.exit(1);
console.log(`fresh ok: first harvest on fresh ground ${rf.toFixed(2)} of a full yield, on old ground ${ro.toFixed(2)}; both at the floor after 9 crops`);
