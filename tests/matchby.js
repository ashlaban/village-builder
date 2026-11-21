// The custom `matchBy` (VB-826): whose voice counts in a match, on a constructed state of tests/suit.js's world. Consent (the default): the
// head of the house speaks for a son or daughter of it. Couple: each pawn of age speaks for itself, and a woman asks from the first day.
// Heads: a spokesman may offer for one who courts another, and the member's no is booked twice. Both who marry consent under every option.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState, setPractice } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR } = VB['sim/rules'];
const { seedAsking } = VB['sim/wishes'];
const { askFor } = VB['sim/asking'];
const { movingRound } = VB['sim/round'];
const { issue } = VB['sim/commands'];
const { emit } = VB['sim/events'];
const Rel = VB['sim/relations'], R = VB['sim/records'], Culture = VB.culture;
const map = ['..............', '...FF.........', '...FF.........', '..............', '..........FF..', '..............', '.........^^...', '..............', '~.............', '~~............'];
function world(option, ages) {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
  for (const s of st.cenv.settlements) setPractice(st, s.id, { matchBy: option });
  for (const [id, years] of Object.entries(ages)) {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  }
  for (const h of st.households) h.grain.barley += 5000;
  VB['sim/heirs'].refreshRoles(st);
  seedAsking(st);
  return st;
}
const noon = (st) => Math.floor(st.t / DAY) * DAY + 12;
const args = (st, man, woman, home) => ({ basis: 'match', gives: { man, home }, wants: { woman }, due: noon(st), round: true, fancy: 0.5 });
const offer = (st, man, woman, home) =>
  issue(st, { actor: R.spokesmanOf(st, man), verb: 'offer', target: R.spokesmanOf(st, woman), args: args(st, man, woman, home), source: 'asking' });
const fond = (st, a, b) => {
  VB['sim/ties'].raiseTie(st, a, b, 3);
  for (const k of ['worked', 'ale']) for (let i = 0; i < 6; i++) Rel.remember(st, a, b, k);
};
assert.deepStrictEqual(Culture.DIMS[Culture.IDX.matchBy].opts.map((o) => o[0]), ['heads', 'consent', 'couple']);
assert.strictEqual(Culture.fromArchetype('oldNordic')[Culture.IDX.matchBy], 1, 'consent by default');
// who speaks: her father under heads and consent, she herself under the couple
for (const [opt, who] of [['heads', 0], ['consent', 0], ['couple', 2]])
  assert.strictEqual(R.spokesmanOf(world(opt, { 2: 21 }), 2), who, `${opt}: her spokesman`);
{ // under the couple no spokesman is asked: a head's offer is no offer, the two's own is
  const st = world('couple', { 2: 21, 14: 24 });
  assert.notStrictEqual(issue(st, { actor: 11, verb: 'offer', target: 0, args: args(st, 14, 2, 2), source: 'asking' }), true);
  assert.strictEqual(offer(st, 14, 2, 2), true, 'the two offer for themselves');
  assert.deepStrictEqual(checkState(st), []);
}
{ // a woman asks from the first asking day under the couple, not under consent
  const asked = (opt) => askFor(world(opt, { 2: 21, 14: 24 }), 2);
  assert.strictEqual(asked('consent'), 'round', 'consent: she does not ask yet');
  assert.notStrictEqual(asked('couple'), 'round', 'couple: she asks');
}
// a woman who courts another: offered for under heads, not under consent; her no books the memory twice under heads
const refusal = (opt) => {
  const st = world(opt, { 2: 21, 10: 22, 14: 24 });
  for (const [x, y] of [[2, 10], [10, 2]]) fond(st, x, y);
  emit(st, 'goodTalk', { a: 2, b: 10, oa: Rel.opinionOf(st, 2, 10), ob: Rel.opinionOf(st, 10, 2) });
  assert.ok(st.pawns[2].courting === 10, 'the scene: she courts another');
  const before = Rel.opinionOf(st, 0, 2),
    made = offer(st, 14, 2, 2);
  if (made === true) {
    movingRound(st);
    assert.strictEqual(R.spouseOf(st, 2), null, `${opt}: her no stands`);
  }
  assert.deepStrictEqual(checkState(st), [], opt);
  return { made, drop: before - Rel.opinionOf(st, 0, 2) };
};
const c = refusal('consent'), h = refusal('heads');
assert.notStrictEqual(c.made, true, 'consent: no offer for one who courts another');
assert.strictEqual(h.made, true, 'heads: her father offers for her');
assert.ok(h.drop >= 0.35, `her no costs her father twice the memory: ${h.drop}`);
console.log('matchby ok');
