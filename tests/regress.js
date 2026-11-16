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
  for (const h of st.households) for (const [k, n] of [['grain', Sim.grainOf(h)], ['wood', h.wood]]) if (!(n >= 0)) fail(`seed ${seed}: household ${h.id} ${k} is ${n}`);
  console.log(`founders seed ${seed}: 3 years in ${Date.now() - t0} ms | ${st.households.map((h) => `${st.farmsteads[h.farmstead].name} grain ${Math.round(Sim.grainOf(h))} hungry ${h.hungryDays}`).join(' | ')} | marriages ${st.unions.length} | demand ${st.demand.length}`);
  console.log('   roles:', st.pawns.map((p) => `${p.given} ${p.role}`).join(', '));
  console.log('   meeting log:', st.meetingLog.slice(0, 3).map((e) => `y${e.year} ${e.text}`).join(' | '));
}
// A walking budget that underflowed (5e-324, seen at populous seed 42 in year 39) moved nothing and never shrank: the stepping walker spun
// forever. A walk is a leg since VB-473: segments of a few smallest doubles give hours that rise, an end a whole step after its start, and
// a place along them found by halving.
{
  const it = G.generate(7); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, 7, 'founders'), a = st.agents[0], A = VB['sim/agents'];
  a.x = 0; a.y = 0; a.carry = null; a.seg = 0;
  a.path = [[0, 0], [Number.MIN_VALUE, 0, 1, -1], [2 * Number.MIN_VALUE, 0, 2.73, -1]];
  const t0 = Date.now(); A.walkTo(st, a, -1, 3 * Number.MIN_VALUE, 0);
  const l = a.leg;
  if (!l || l.kind !== 'walk' || l.end !== l.t + 1) fail(`a walk of a few smallest doubles does not end a step after it begins (${l && l.end}, ${l && l.t})`);
  const [x] = A.placeOf(st, a);
  if (!(x >= 0) || Date.now() - t0 > 1000) fail(`a walk of a few smallest doubles: place ${x} in ${Date.now() - t0} ms`);
}
if (failed) process.exit(1);
