// Illnesses that are survived (VB-1246; sim/deaths, dayOfDeath): a pawn falls ill at an incidence of its own above the death roll's draws;
// such a course passes and the pawn recovers, its health having fallen by ILLNESS.passing of the fall; a death drawn while it ails turns
// the course to one that kills, so the roll's deaths are as before; a pawn whose health gives out dies of the illness. On a constructed
// state (tests/lib/tiny.js), and over many draws on bare pawns.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { DAY, YEAR, YEAR_DAYS, ILLNESS, hazard } = VB['sim/rules'];
const { dayOfDeath } = VB['sim/deaths'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [7, 7], farms: 2 }], { seed: 4 });
for (const h of st.households) h.grain.barley += 2000;
const adult = (k) => st.pawns.filter((p) => p.alive && p.age >= 20 && p.age < 50)[k];
const sound = (what) => {
  const fix = st.rng.deaths.fix;
  delete st.rng.deaths.fix; // a fixed stream is a test's, never the state's
  assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
  if (fix !== undefined) st.rng.deaths.fix = fix;
};
const dayH = (a) => hazard(a) / YEAR_DAYS, // the roll's draw a day for a healthy pawn of age a (no hunger, no frailty)
  between = (p) => (dayH(p.age + 0.5) + ILLNESS.incidence.illness / YEAR_DAYS) / 2;

// 1. a course that passes: it starts on a draw above the roll's deaths, the health falls, and the pawn recovers at its end
{
  const p = adult(0);
  st.rng.deaths.fix = between(p);
  assert.strictEqual(dayOfDeath(st, p), null, 'nobody dies of the draw');
  assert.ok(p.ill && p.ill.passes === true && p.ill.cause === 'illness', `falls ill: ${JSON.stringify(p.ill)}`);
  assert.strictEqual(p.ill.until - p.ill.from, ILLNESS.days.illness * DAY, 'for its cause’s days');
  sound('ailing');
  st.rng.deaths.fix = 0.99; // no other draw comes up
  const start = p.health,
    until = p.ill.until;
  let low = start;
  for (let d = 0; d < ILLNESS.days.illness + 3; d++) {
    Sim.advance(st, DAY);
    low = Math.min(low, p.health);
  }
  assert.ok(p.alive && p.ill === undefined && st.t > until, 'it recovers when the course is run');
  assert.ok(low <= start - ILLNESS.passing * ILLNESS.fall * 0.6, `its health showed the illness: ${start} to ${low}`);
  assert.ok(low > start - ILLNESS.fall, 'less than a course that kills');
  sound('recovered');
}
// 2. a death drawn while it ails turns the course to one that kills: the roll's deaths are kept
{
  const p = adult(1);
  st.rng.deaths.fix = between(p);
  dayOfDeath(st, p);
  assert.ok(p.ill && p.ill.passes, 'the scene: a course that passes');
  st.rng.deaths.fix = 0; // the day's roll comes up
  assert.strictEqual(dayOfDeath(st, p), null, 'the draw does not kill at once');
  assert.ok(
    p.ill && p.ill.passes === undefined && p.ill.until >= st.t + ILLNESS.days.illness * DAY,
    JSON.stringify(p.ill),
  );
  st.rng.deaths.fix = 0.99;
  for (let d = 0; p.alive && d < ILLNESS.days.illness + 3; d++) Sim.advance(st, DAY);
  assert.ok(!p.alive, 'it dies when the course is run');
  sound('a course turned');
}
// 3. a pawn whose health gives out while it ails dies of the illness, unless it was hungry
{
  const p = adult(0);
  st.rng.deaths.fix = between(p);
  dayOfDeath(st, p);
  assert.ok(p.ill && p.ill.passes, 'the scene: a course that passes');
  p.health = 0;
  p.hunger = 0;
  st.rng.deaths.fix = 0.99;
  assert.strictEqual(dayOfDeath(st, p), 'illness', 'the illness took it');
  delete st.rng.deaths.fix;
}
// 4. over many draws on bare pawns: courses start at the incidence, and the roll's share of them kill
{
  const N = 400000,
    out = {};
  for (const [age, cause] of [
    [30, 'illness'],
    [8, 'childhood'],
    [75, 'oldAge'],
  ]) {
    let ill = 0,
      kills = 0;
    for (let i = 0; i < N; i++) {
      const p = { born: st.t - (age + 0.5) * YEAR, hunger: 0, health: 100 };
      dayOfDeath(st, p);
      if (p.ill) {
        ill++;
        if (!p.ill.passes) kills++;
      }
    }
    const q = Math.max(dayH(age + 0.5), ILLNESS.incidence[cause] / YEAR_DAYS);
    assert.ok(Math.abs(ill / N - q) < 4 * Math.sqrt(q / N), `${cause}: courses ${ill / N} a day, against ${q}`);
    assert.ok(
      Math.abs(kills / N - dayH(age + 0.5)) < 4 * Math.sqrt(dayH(age + 0.5) / N) + 1e-5,
      `${cause}: the roll's deaths stay its own (${kills / N} against ${dayH(age + 0.5)})`,
    );
    out[cause] = (kills / ill).toFixed(2);
  }
  console.log(`illness: share of courses that kill, by cause: ${JSON.stringify(out)}`);
}
console.log(
  'illness ok: a course that passes ails and recovers; a death drawn while it ails turns it to one that kills; a health that gives out ' +
    'dies of the illness; courses start at the incidence and the roll keeps its deaths',
);
