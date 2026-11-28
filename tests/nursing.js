// @suite integration
// VB-632 (design.md, People, Marriage, nursing and growth: Nursing): a nursing child's death ends the nursing; its life does not shorten it,
// and the term stays 48 days. On a tiny village, the daily step called by hand with chances forced by `fix`.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { dailyBirths } = VB['sim/births'], { DAY } = VB['sim/rules'], { BIRTH } = VB['sim/births'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
  const hh = st.households[0], m = hh.members.map((id) => st.pawns[id]).find((p) => p.sex === 'f' && Sim.spouseOf(st, p.id) !== null);
  assert.ok(m, 'a married woman');
  m.age = 25; m.hunger = 0; m.pregnantUntil = st.t; m.pregnantBy = Sim.spouseOf(st, m.id);
  st.rng.births.fix = 0.99; // no childbed death
  const n = st.pawns.length;
  dailyBirths(st);
  assert.strictEqual(st.pawns.length, n + 1, 'a child is born');
  assert.strictEqual(m.nursling, n, 'she nurses the child');
  assert.ok(near(m.nursingUntil - st.t, BIRTH.nursingDays * DAY), 'for the fixed term');
  return { st, m, child: st.pawns[n] };
};
const near = (a, b) => Math.abs(a - b) < 1e-6;
const day = (st) => { st.t += DAY; dailyBirths(st); };
const conceives = (st, m) => { st.rng.births.fix = 0; dailyBirths(st); st.rng.births.fix = 0.99; const c = m.pregnantUntil !== null; m.pregnantUntil = null; m.pregnantBy = null; return c; };

{ // the infant dies on day 5: she may conceive on day 6
  const { st: s2, m: m2, child: c2 } = make();
  for (let d = 1; d <= 5; d++) day(s2);
  c2.alive = false;
  s2.t += DAY; s2.rng.births.fix = 0; dailyBirths(s2);
  assert.notStrictEqual(m2.pregnantUntil, null, 'conceives on day 6');
  assert.strictEqual(m2.nursling, null, 'no longer nursing');
  assert.strictEqual(m2.nursingUntil, null);
}
{ // the infant lives: no conception until day 48
  const { st, m } = make();
  for (let d = 1; d < 48; d++) { st.t += DAY; st.rng.births.fix = 0; dailyBirths(st); assert.strictEqual(m.pregnantUntil, null, `no conception on day ${d}`); }
  assert.strictEqual(m.nursling !== null, true);
  st.t += DAY; st.rng.births.fix = 0; dailyBirths(st);
  assert.notStrictEqual(m.pregnantUntil, null, 'conceives on day 48');
  assert.strictEqual(m.nursling, null, 'the term out clears the child');
}
{ // a death after the term changes nothing
  const { st, m, child } = make();
  for (let d = 1; d <= 49; d++) day(st);
  assert.strictEqual(m.nursling, null);
  child.alive = false;
  assert.ok(conceives(st, m), 'free all the same');
}
{ // the mother dies in childbirth: nothing dangles
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
  const m = st.households[0].members.map((id) => st.pawns[id]).find((p) => p.sex === 'f' && Sim.spouseOf(st, p.id) !== null);
  m.age = 25; m.pregnantUntil = st.t; m.pregnantBy = Sim.spouseOf(st, m.id);
  st.rng.births.fix = 0; // a boy, and she dies
  dailyBirths(st);
  assert.strictEqual(m.alive, false, 'she died');
  assert.strictEqual(m.nursling, null);
  assert.strictEqual(m.nursingUntil, null);
  st.rng.births.fix = undefined;
  assert.deepStrictEqual(checkState(st), []);
}
{ // invariants hold with a nursing mother; an old save's pawn without the field nurses to term
  const { st, m } = make();
  st.rng.births.fix = undefined;
  assert.deepStrictEqual(checkState(st), []);
  delete m.nursling; // an old save: loaded as null
  m.nursling = null;
  st.t += 10 * DAY; st.rng.births.fix = 0; dailyBirths(st);
  assert.strictEqual(m.pregnantUntil, null, 'still nursing to term');
}
console.log('nursing ok');
