// @suite integration
// Fresh land (VB-149): a field broken on ground never farmed (w.dev 0) starts with soil SOIL.fresh, above manure's cap, and yields more at
// its first harvest; each crop wears it as any field, so without manure both it and an old field reach the floor after 9 crops; manure
// never lowers it. A plot's field broken on fresh ground keeps it when its farmstead is made.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, F = VB['sim/fields'];
const { CROPS } = VB['sim/crops'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FRESH FAIL:', m); } };
const world = (seed, size = [120, 85]) => {
  const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (doy, hour = 8) => ({ doy, day: doy, season: Math.floor(doy / 12), sday: doy % 12, hour });
const S = Sim.SOIL, near = (a, b) => Math.abs(a - b) < 1e-9;
const st = Sim.seed(world(3), 3, 'populous'), w = st.w;
const f = st.farmsteads.find((x) => x.household !== null), hh = st.households[f.household];
// two free farmable tiles near the farm: one never farmed, one farmed before (an old field's ground)
const free = [];
for (const [t] of VB['sim/hex'].bfs(w, f.house, 8, VB['sim/walking'].walkable(w)).dist) {
  if (VB['sim/crops'].farmable(w, t) && !st.used.has(t) && st.owner[t] === 0 && !w.dev[t]) free.push(t);
}
check(free.length >= 2, 'two free tiles near the farm');
const [freshTile, oldTile] = free; w.dev[oldTile] = 1;
const breakOn = (tile) => {
  VB['sim/projectplans'].makeProject(st, 'household', f.household, { what: 'field', steps: [{ kind: 'break', place: tile, hours: 0, stake: 'field' }] });
  VB['sim/newground'].finishBreak(st, f, VB['sim/projects'].ownOf(st, f.household)); return f.fields[f.fields.length - 1];
};
const fresh = breakOn(freshTile), old = breakOn(oldTile);
// the scenario's rotation (VB-353) staggers the crops of a farm's fields, populous's among them: a field may bear a crop with another yield or
// fallow; the check is of soil wear, so both fields bear barley
for (const fd of [fresh, old]) { fd.crop = 'barley'; fd.step = 0; }
check(near(fresh.soil, S.fresh) && near(old.soil, S.start), `soil on fresh ground ${fresh.soil}, on old ground ${old.soil}`);
check(w.dev[freshTile] === 1, 'the fresh tile is farmed now');
// the first harvest: the fresh field yields more, in proportion to its soil
const reap = Sim.KINDS.reap.done, ratio = (fd) => fd.held / (CROPS.barley.yield * fd.fert * VB['sim/weather'].cropFactor(st, 'barley'));
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
{ const w = VB['sim/soil'].manureWanted(st, f, hh, cal(2)); check(w && w[2] === true, 'a field above the cap is wanted for surplus dung only'); }
VB['sim/soil'].manureDone(st, fresh, hh, 2);
check(near(fresh.soil, 1.3), `manure lowered a fresh field's soil to ${fresh.soil}`);
// a plot places no field (VB-1951; Kim, 27 Nov): its household breaks its fields as any head does, fresh ground's soil as above
const X = VB['sim/expansion'];
const landed = (id) => Sim.isHolder(st, id) || (Sim.spouseOf(st, id) !== null && Sim.isHolder(st, Sim.spouseOf(st, id))); // no plot for a holder's spouse
const landless = (u) => st.pawns.filter((p) => p.alive && p.age >= 18 && Sim.settlementIdOf(st, p) === u.id && !landed(p.id)).map((p) => p.id);
const v = st.villages.find((u) => landless(u).length) || st.villages[0], ids = landless(v); // the first village with an adult without land
st.demand = ids.slice(0, 1);
VB['sim/allotment'].startPlots(st);
const plot = X.livePlots(st, v).slice(-1)[0]; // its village's project plan (VB-123)
check(plot && !X.tilesOf(plot).some((t) => t.kind === 'field'), 'a plot is started, with no field');
if (failed) process.exit(1);
console.log(`fresh ok: first harvest on fresh ground ${rf.toFixed(2)} of a full yield, on old ground ${ro.toFixed(2)}; both at the floor after 9 crops`);
