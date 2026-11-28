// @suite integration
// VB-631: the means to marry is a rule of the registry (marriage.means) and one formula, Sim.meansOf, serves the gate (affords), matchBar's
// reason and the pawn panel's words (marryBar): a home just under and just over, the exempt home, the explanation.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], Rules = VB['sim/registry'];
const { matchRules, matchBar, kinOk } = VB['sim/matching'], { MARRIAGE, YEAR_DAYS } = VB['sim/rules'];
const { dailyNeed } = VB['sim/hunger'];
const assert = require('assert');
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'populous');
st.naturalDeaths = false;
const adults = (x) => x.members.filter((i) => st.pawns[i].alive && st.pawns[i].age >= 18).length;
// 1. the rule: base MARRIAGE.means, no parts
const hh0 = st.households.find((x) => !x.dissolved);
const e = Rules.explain(st, 'marriage.means', hh0);
assert.strictEqual(e.base, MARRIAGE.means); assert.strictEqual(e.value, MARRIAGE.means); assert.deepStrictEqual(e.parts, []);
// 2. meansOf and affords agree over every household
let n = 0;
for (const x of st.households) {
  if (x.dissolved) continue;
  const m = Sim.meansOf(st, x.id);
  assert.strictEqual(matchRules(st).affords(x.id), m.exempt || m.held >= m.asked, `household ${x.id}`);
  n++;
}
// 3. just under and just over, in a home of two adults
const h = st.households.find((x) => !x.dissolved && adults(x) >= 2 && x.members.some((i) => st.pawns[i].sex === 'm' && st.pawns[i].age >= 20 && !st.pawns[i].servant && R.spouseOf(st, i) === null));
const set = (years) => { // meals so that the home holds `years` of food
  h.meals = 0;
  h.meals = (years - Sim.meansOf(st, h.id).held) * YEAR_DAYS * (dailyNeed(st, h) + st.ECON.ration.adult);
  return Sim.meansOf(st, h.id);
};
let m = set(MARRIAGE.means - 0.05);
assert(!m.exempt && m.held < m.asked && Math.abs(m.held - (MARRIAGE.means - 0.05)) < 1e-9);
assert(!matchRules(st).affords(h.id), 'just under: no');
m = set(MARRIAGE.means + 0.05);
assert(matchRules(st).affords(h.id), 'just over: yes');
// the words: a man of that home and a woman of his village; the reason names the numbers
const mm = st.pawns[h.members.find((i) => st.pawns[i].sex === 'm' && st.pawns[i].age >= 20 && !st.pawns[i].servant && R.spouseOf(st, i) === null)];
const v = R.settlementIdOf(st, mm);
const ff = st.pawns.find((p) => p.alive && p.sex === 'f' && p.age >= 18 && R.spouseOf(st, p.id) === null && p.household !== null && R.settlementIdOf(st, p) === v && kinOk(st, mm.id, p.id, R.practice(st, v)));
R.practice(st, v).residence = 'husband';
set(0.9);
const s = Sim.marryBar(st, mm.id);
assert(s && s.kind === 'short' && Math.abs(s.held - 0.9) < 1e-9 && s.asked === MARRIAGE.means, JSON.stringify(s));
if (ff) {
  const bar = matchBar(st, mm.id, ff.id, matchRules(st));
  assert(/their home holds 0\.9 of the 1\.5 years of food it needs/.test(bar.why || ''), bar.why);
}
set(2.1);
assert.strictEqual(Sim.marryBar(st, mm.id).kind, 'means');
// 4. the exempt home: fewer than two adults
const solo = st.households.find((x) => !x.dissolved && adults(x) < 2);
if (solo) { solo.meals = 0; assert(Sim.meansOf(st, solo.id).exempt); assert(matchRules(st).affords(solo.id)); }
console.log(`means ok: ${n} households agree` + (ff ? '' : ' (no woman for the reason)') + (solo ? '' : ' (no exempt home)'));
// the exempt home, made: all but one of a home's adults are children now
for (const i of h.members.slice(1)) st.pawns[i].age = 5;
st.pawns[h.members[0]].age = 30;
assert(Sim.meansOf(st, h.id).exempt && matchRules(st).affords(h.id), 'exempt');
