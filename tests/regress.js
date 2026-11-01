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
// A walking budget that underflows (5e-324, seen at populous seed 42 in year 39) moved nothing and never shrank: moveAgent spun forever.
{
  const it = G.generate(7); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, 7, 'founders'), a = st.agents[0], A = VB['sim/agents'], { SPEED } = VB['sim/rules'];
  // a budget of a few smallest doubles; the first segment takes all but the last one, which a step of cost 2.73 cannot spend
  const dt = Number.MIN_VALUE, budget = SPEED * st.w.HW * dt; // a whole multiple of the smallest double, as moveAgent computes it
  a.x = 0; a.y = 0; a.carry = null; a.seg = 0;
  a.path = [[0, 0], [budget - Number.MIN_VALUE, 0, 1, -1], [100, 0, 2.73, -1]];
  const t0 = Date.now(); A.moveAgent(st, a, dt);
  if (!(budget > Number.MIN_VALUE) || a.seg !== 1) fail(`the underflow case was not set up (budget ${budget}, segment ${a.seg})`);
  if (Date.now() - t0 > 1000) fail(`a walker left with a budget of ${Number.MIN_VALUE} took ${Date.now() - t0} ms`);
}
if (failed) process.exit(1);
