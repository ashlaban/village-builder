// Births: invariants of the birth rules, and the report of 50-year founders runs by decade, read to judge the simulation's stability
// (reported, not asserted): births, deaths and population, and the deaths by cause that tests/health.js printed from the same runs.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const run = (seed) => {
  const st = Sim.seed(world(seed), seed, 'founders'), rows = [];
  let pawns = st.pawns.length;
  for (let dec = 1; dec <= 5; dec++) {
    Sim.advance(st, 10 * Sim.YEAR);
    const nb = st.pawns.length - pawns, nd = st.pawns.filter((p) => p.died !== null && p.died > st.t - 10 * Sim.YEAR).length;
    pawns = st.pawns.length;
    const by = {};
    for (const p of st.pawns) if (p.died !== null && p.died > st.t - 10 * Sim.YEAR) {
      const e = Sim.recordOf(st, { pawn: p.id, life: true }).find((x) => x.kind === 'died'), c = e ? e.cause : 'unknown'; by[c] = (by[c] || 0) + 1;
    }
    const causes = Object.entries(by).map(([k, n]) => `${k} ${n}`).join(', ');
    rows.push(`years ${dec * 10 - 9}-${dec * 10}: ${nb} births, ${nd} deaths${causes ? ` (${causes})` : ''}, ${st.pawns.filter((p) => p.alive).length} alive`);
  }
  return { st, rows };
};
for (const seed of [7, 42]) {
  const { st, rows } = run(seed);
  console.log(`founders, seed ${seed}:\n  ${rows.join('\n  ')}`);
  for (const p of st.pawns) {
    if (p.born < 0) continue; // on record before the start
    const m = st.pawns[p.mother], age = Math.floor((p.born - 36 * Sim.DAY - m.born) / Sim.YEAR); // at conception
    assert(age >= 15 && age < 50, `conception at age ${age}`);
    assert(st.unions.some((u) => u.a === p.father && u.b === p.mother && u.start <= p.born), `birth to an unmarried woman: ${Sim.fullName(m)}`);
    assert(p.father !== null && p.household !== null, 'a newborn has both parents and a household');
  }
  assert(st.agents.length === st.pawns.length, 'an agent for every pawn');
  if (seed === 7) {
    const again = run(7).st;
    assert.strictEqual(again.pawns.length, st.pawns.length, 'same seed, same births');
    assert.deepStrictEqual(again.pawns.map((p) => p.born), st.pawns.map((p) => p.born), 'same seed, same birth dates');
  }
}
console.log('births ok');
