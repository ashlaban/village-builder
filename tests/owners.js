// Villages and tile owners: every farm has a village, seeding gives the owners (houses, fields, meadows), an empty farm passes to its village.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('OWNERS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const same = (a, b) => (!a && !b) || (a && b && a.type === b.type && a.id === b.id);
function checkSeeding(st, label) {
  const own = (t) => Sim.ownerOf(st, t), houses = new Set(st.farmsteads.map((f) => f.house));
  const expected = new Map();
  for (const v of st.villages) {
    check(v.green === v.well && v.green === (v.farmsteads.length >= 2), `${label}: ${v.name} green/well ${v.green}/${v.well} with ${v.farmsteads.length} farms`);
    check(Object.keys(v).every((k) => !/lone|degenerate/i.test(k)), `${label}: ${v.name} has a lone flag`);
    if (v.commonsWood >= 0) expected.set(v.commonsWood, { type: 'village', id: v.id });
    if (!houses.has(v.center)) expected.set(v.center, { type: 'village', id: v.id });
  }
  for (const f of st.farmsteads) {
    check(f.village !== null && st.villages[f.village], `${label}: ${f.name} has no village`);
    const o = f.household === null ? { type: 'village', id: f.village } : { type: 'household', id: f.household };
    for (const t of [f.house, ...f.fields.map((fd) => fd.tile), ...f.meadows.map((m) => m.tile)]) expected.set(t, o); // hay meadows (VB-132)
    check(f.fence === null || f.fence === undefined, `${label}: ${f.name} has its own fence`);
  }
  for (let t = 0; t < st.w.N; t++) check(same(own(t), expected.get(t) || null), `${label}: tile ${t} owner ${JSON.stringify(own(t))}`);
  for (const v of st.villages) if (v.farmsteads.length === 1) {
    const f = st.farmsteads[v.farmsteads[0]];
    check(v.center === f.house && v.commonsWood === f.woodlot, `${label}: one-farm village ${v.name} centre or woods`);
    check(v.fence.length > 0 && v.fence.every((s) => s.owner.type === 'village' && s.owner.id === v.id), `${label}: ${v.name} fence owner`);
  }
  check(st.cenv.settlements.length === st.villages.length, `${label}: settlements and villages differ`);
}
for (const [scenario, seed] of [['founders', 7], ['founders', 42], ['heirs', 7], ['populous', 7]]) {
  const st = Sim.seed(world(seed), seed, scenario);
  checkSeeding(st, `${scenario} ${seed}`);
  if (scenario === 'founders') check(st.villages.some((v) => v.farmsteads.length === 1), 'founders: no one-farm village');
  // succession within a household leaves owners alone; extinction passes the farm to the village
  const hh = st.households.find((h) => !h.dissolved), f = st.farmsteads[hh.farmstead];
  const before = Sim.ownerOf(st, f.house);
  VB['sim/heirs'].transfer(st, hh, hh.members.find((m) => m !== hh.holder) ?? hh.holder, 'death');
  check(same(Sim.ownerOf(st, f.house), before), `${scenario}: transfer changed the owner`);
  VB['sim/heirs'].extinct(st, hh);
  for (const t of [f.house, ...f.fields.map((fd) => fd.tile), ...f.meadows.map((m) => m.tile)]) {
    check(same(Sim.ownerOf(st, t), { type: 'village', id: f.village }), `${scenario}: tile ${t} not handed to the village`);
  }
}
if (failed) process.exit(1);
console.log('owners ok');
