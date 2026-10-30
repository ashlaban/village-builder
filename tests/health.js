// Health: hunger drains it, full meals restore it, 0 is death by starvation; low health raises the death risk and slows work.
// Then a report of deaths by cause per decade in 50-year founders runs (reported, not asserted).
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { feedHousehold, updateHealth } = VB['sim/hunger'], { deathRoll } = VB['sim/deaths'], { HEALTH, YEAR, YEAR_DAYS } = VB['sim/rules'], { stepWork } = VB['sim/agents'];
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const w7 = world(7), fresh = () => Sim.seed(w7, 7, 'founders');
const starve = (p, age, days) => { // hunger 1 every day; the day on which the pawn would die, or 0
  const st = fresh(); p.born = st.t - age * YEAR; p.health = 100; p.hunger = 1;
  for (let d = 1; d <= days; d++) { updateHealth(st, p, false); if (deathRoll(st, p) === 'starvation') return d; }
  return 0;
};
{
  const st = fresh(), p = st.pawns[0];
  assert.strictEqual(p.health, 100, 'health starts at 100');
  assert.strictEqual(starve(p, 30, 30), 25, 'an adult at h = 1 dies on day 25');
  assert.strictEqual(starve(p, 3, 40), 17, 'a child under 5 at h = 1 dies on day 17');
  assert.strictEqual(starve(p, 70, 40), 17, 'a pawn of 60 or more at h = 1 dies on day 17');
  p.born = st.t - 30 * YEAR; p.health = 100; p.hunger = 0.25; updateHealth(st, p, false);
  assert(Math.abs(100 - p.health - 0.25) < 1e-9, `h = 0.25 loses 0.25 a day, lost ${100 - p.health}`);
  p.health = 50; p.hunger = 0; updateHealth(st, p, true); assert.strictEqual(p.health, 53, 'a full meal restores 3');
  p.health = 99; updateHealth(st, p, true); assert.strictEqual(p.health, 100, 'health stops at 100');
  // meals feed it: a fed household restores health
  const hh = st.households[0], q = st.pawns[hh.members[0]]; q.health = 60; q.hunger = 0; q.hungerLog = []; hh.grain = 1e6;
  feedHousehold(st, hh); assert.strictEqual(q.health, 63, 'a full meal at the table restores 3');
}
// risk: below 50 the hazard is multiplied by 1 + (50 - health) / 25
{
  const rate = (health) => {
    let s = 4242, n = 0; const st = { t: 0, rand: () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) };
    for (let i = 0; i < 400000; i++) if (deathRoll(st, { born: -30 * YEAR, hunger: 0, health })) n++;
    return n;
  };
  const base = rate(100), low = rate(25), none = rate(1);
  assert(Math.abs(low / base - 2) < 0.4 && Math.abs(none / base - 2.96) < 0.6, `risk ratios ${(low / base).toFixed(2)} at 25 and ${(none / base).toFixed(2)} at 1`);
}
// work: progress per hour is multiplied by 1 - 0.3 (100 - health) / 100
for (const health of [100, 50, 0]) {
  const st = fresh(), a = st.agents[0]; st.pawns[0].hunger = 0; st.pawns[0].health = health;
  a.job = { kind: 'sow', done: 0 }; a.work = null; stepWork(st, a, 1);
  assert(Math.abs(a.job.done - (1 - HEALTH.slow * (100 - health) / 100)) < 1e-9, `work at health ${health}`);
}
// a starving household dies of starvation within a season
{
  const st = fresh(), hh = st.households[0], ids = hh.members.filter((m) => st.pawns[m].alive); hh.grain = 0;
  for (const f of st.farmsteads[hh.farmstead].fields) f.stage = 'growing';
  for (let d = 0; d < 36; d++) { st.t += 24; feedHousehold(st, hh); for (const m of ids) if (st.pawns[m].alive && deathRoll(st, st.pawns[m])) Sim.killPawn(st, m, 'starvation'); }
  assert(ids.every((m) => !st.pawns[m].alive), 'nobody survives 36 days without food');
}
for (const seed of [7, 42]) {
  const st = Sim.seed(world(seed), seed, 'founders'), rows = [];
  for (let dec = 1; dec <= 5; dec++) {
    Sim.advance(st, 10 * YEAR);
    const by = {}; for (const p of st.pawns) if (p.died !== null && p.died > st.t - 10 * YEAR) {
      const e = p.events.find((x) => x.kind === 'died'), c = e ? e.cause : 'unknown'; by[c] = (by[c] || 0) + 1;
    }
    rows.push(`years ${dec * 10 - 9}-${dec * 10}: ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(', ') || 'no deaths'}; ${st.pawns.filter((p) => p.alive).length} alive`);
  }
  console.log(`founders, seed ${seed}, deaths by cause:\n  ${rows.join('\n  ')}`);
}
console.log('health ok');
