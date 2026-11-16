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
// forever. A walk is a leg since VB-473, its hours worked out once as it begins: the same route (a first segment of a few smallest
// doubles, then one of cost 2.73), given to a pawn as a save of the walk in hand would hold it and loaded, has hours that rise, ends at its
// due step, and is walked to its end in whole steps.
{
  const it = G.generate(7); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, 7, 'founders'), a = st.agents[0], A = VB['sim/agents'], { SPEED, TICKS } = VB['sim/rules'];
  Sim.advance(st, 0.1);
  const budget = SPEED * st.w.HW * Number.MIN_VALUE; // as the stepping computed a step's budget of the smallest double
  A.release(st, a); A.standStill(st, a);
  a.x = 0; a.y = 0; a.carry = null; a.seg = 0; a.inside = false;
  a.path = [[0, 0], [budget - Number.MIN_VALUE, 0, 1, -1], [100, 0, 2.73, -1]];
  delete st.legDue; A.loaded(st); // the walk's leg is built from where the pawn is and its route
  const l = a.leg, t0 = Date.now();
  if (!l || l.kind !== 'walk' || l.h.length !== 2 || !(l.h[1] > l.h[0]) || l.end !== l.t + Math.max(1, Math.ceil(l.h[1] * TICKS - 1e-9)))
    fail(`the underflow route gives no walk leg ending at its hours (${JSON.stringify(l)})`);
  let steps = 0;
  while (a.leg === l && steps < 100) { Sim.advance(st, 1 / TICKS); steps++; }
  if (a.leg === l || st.tick !== l.end && a.path) fail(`the underflow walk did not end at its due step (${steps} steps, end ${l.end})`);
  if (Date.now() - t0 > 1000) fail(`the underflow walk took ${Date.now() - t0} ms`);
}
if (failed) process.exit(1);
