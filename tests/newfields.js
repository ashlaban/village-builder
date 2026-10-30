// New fields: founders start without fields, clear and break meadow tiles they own; heirs keep their fields.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('NEWFIELDS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
for (const seed of [7, 42]) {
  const w = world(seed), stones0 = w.stones.slice(), st = Sim.seed(w, seed, 'founders');
  for (const f of st.farmsteads) check(f.fields.length === 0, `seed ${seed}: ${f.name} starts with fields`);
  for (const hh of st.households) {
    const want = Sim.fieldsWanted ? Sim.fieldsWanted(st, hh) : 0, rations = hh.members.length * 48;
    check(hh.grain >= rations && want >= 2 && want <= 4, `seed ${seed}: household ${hh.id} grain ${hh.grain}, wants ${want}`);
  }
  Sim.advance(st, 24 * 20);
  for (const f of st.farmsteads) {
    check(f.fields.length >= 1, `seed ${seed}: ${f.name} has no field after 20 days`);
    for (const fd of f.fields) {
      check(w.stones[fd.tile] === 0 && w.dev[fd.tile] === 1, `seed ${seed}: field tile ${fd.tile} not cleared`);
      check(JSON.stringify(Sim.ownerOf(st, fd.tile)) === JSON.stringify({ type: 'household', id: f.household }), `seed ${seed}: field tile ${fd.tile} not owned`);
    }
  }
  check(st.households.some((h) => h.stone > 0) || st.farmsteads.some((f) => f.fields.some((fd) => stones0[fd.tile] >= 13)), `seed ${seed}: no stone gathered`);
}
const heirs = Sim.seed(world(7), 7, 'heirs');
check(heirs.farmsteads.every((f) => f.fields.length > 0), 'heirs: a farm lost its fields');
if (failed) process.exit(1);
console.log('newfields ok');
