const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const fail = (m) => { failed++; console.error('REGRESSION:', m); };
for (const seed of [7, 12]) {
  const it = G.generate(seed); let r; while (!(r = it.next()).done); const w = r.value;
  const st = Sim.seed(w, seed, 'founders'); st.naturalDeaths = false;
  const t0 = Date.now();
  for (let year = 1; year <= 3; year++) {
    const from = st.t; Sim.advance(st, Sim.YEAR);
    if (!st.households.some((h) => h.ledger.some((e) => e.kind === 'harvest' && e.t >= from))) fail(`seed ${seed}: no household brought in a harvest in year ${year}`);
  }
  for (const h of st.households) for (const k of ['grain', 'wood']) if (!(h[k] >= 0)) fail(`seed ${seed}: household ${h.id} ${k} is ${h[k]}`);
  console.log(`founders seed ${seed}: 3 years in ${Date.now() - t0} ms | ${st.households.map((h) => `${st.farmsteads[h.farmstead].name} grain ${Math.round(h.grain)} hungry ${h.hungryDays}`).join(' | ')} | marriages ${st.unions.length} | demand ${st.demand.length}`);
  console.log('   roles:', st.pawns.map((p) => `${p.given} ${p.role}`).join(', '));
  console.log('   meeting log:', st.meetingLog.slice(0, 3).map((e) => `y${e.year} ${e.text}`).join(' | '));
}
if (failed) process.exit(1);
