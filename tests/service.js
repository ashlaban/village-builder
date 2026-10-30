// A farm that dies out: members without kin elsewhere go into service in their own village, else the nearest village.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { kinNear } = VB['sim/records'], { extinct } = VB['sim/heirs'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SERVICE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'heirs');
const vOf = (hh) => st.farmsteads[hh.farmstead].village;
const kinElsewhere = (hh, id) => kinNear(st, id).some((q) => st.pawns[q].alive && st.pawns[q].household !== null && st.pawns[q].household !== hh.id);
// Make the first household of a multi-farm village kinless, so that its members must go into service.
const hh = st.households.find((h) => st.households.filter((o) => vOf(o) === vOf(h)).length > 1);
const ids = [...hh.members];
for (const id of ids) for (const q of kinNear(st, id)) if (!ids.includes(q)) { st.pawns[q].alive = false; st.pawns[q].died = st.t; }
check(ids.every((id) => !kinElsewhere(hh, id)), 'setup: members still have kin elsewhere');
const village = vOf(hh), want = st.households.filter((h) => !h.dissolved && h.id !== hh.id && vOf(h) === village)
  .sort((a, b) => a.members.length - b.members.length || a.id - b.id)[0].id;
extinct(st, hh);
for (const id of ids) {
  const p = st.pawns[id]; if (!p.alive) continue;
  check(p.household === want, `${p.given} went to household ${p.household}, wanted ${want}`);
}
// The first to leave has no kin elsewhere and goes into service; the rest follow their kin (the first) there.
const first = st.pawns[ids.find((id) => st.pawns[id].alive)], farm = st.farmsteads[st.households[want].farmstead].name;
check(first.servant === true, `${first.given} is not a servant`);
check(first.events.some((e) => e.kind === 'service' && e.text.includes(farm)), `${first.given} has no service event naming ${farm}`);
// A one-farm village: the people go to the nearest village.
const st2 = Sim.seed(world(7), 7, 'heirs');
const lone = st2.households.find((h) => st2.households.filter((o) => st2.farmsteads[o.farmstead].village === st2.farmsteads[h.farmstead].village).length === 1);
if (lone) {
  const v = st2.farmsteads[lone.farmstead].village, ids2 = [...lone.members];
  for (const id of ids2) for (const q of kinNear(st2, id)) if (!ids2.includes(q)) { st2.pawns[q].alive = false; st2.pawns[q].died = st2.t; }
  extinct(st2, lone);
  const dest = ids2.map((id) => st2.pawns[id]).filter((p) => p.alive).map((p) => st2.farmsteads[st2.households[p.household].farmstead].village);
  check(dest.every((d) => d !== v), 'lone-farm members stayed');
  check(new Set(dest).size <= 1, 'lone-farm members split up');
}
if (failed) process.exit(1);
console.log('service ok');
