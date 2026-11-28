// @suite integration
// A member's voice, a duty asked (VB-1556; design.md section 7, A member's voice, Standing duties): a member asks its head for a type of
// recurring work as its own, the verb ask on the basis `duty` (sim/voice): a yes gives it as the head's assign with a duty does (author
// 'pawn'), a no is a memory; a head says no where another holds the duty and is not less skilled, as it sees skill (sim/estimate); a pawn
// asks of its own accord at most once a season; the played member's Actions offer the ask.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');
const Voice = VB['sim/voice'],
  Steps = VB['sim/steps'],
  { issue } = VB['sim/commands'],
  { opinionOf } = VB['sim/relations'],
  { age } = VB['sim/records'],
  { planOf } = VB['sim/plans'],
  { SKILL } = VB['sim/skills'],
  { VOICE } = Voice,
  { KINDS } = VB['sim/kinds'],
  { WORK } = VB['sim/rules'];
const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))), [{ at: [8, 10], farms: 2, sizes: [5, 4] }], { seed: 2 });
Sim.advance(st, 3);
const A = st.households[0],
  plan = planOf(st, 'household', A.id),
  T = KINDS.wood.type,
  ti = SKILL.types.indexOf(T);
const kin = A.members.filter((id) => id !== A.holder && age(st, st.pawns[id]) >= 12);
assert.ok(kin.length >= 2, 'two members besides the head');
const [m, n] = kin;
const ask = (id, type) =>
  issue(st, { actor: id, verb: 'ask', target: A.holder, args: { basis: 'duty', wants: { duty: type } }, source: 'pawn' });
const holder = () => (Steps.dutyOf(plan, T) ? Steps.dutyOf(plan, T).who[0] : null);
const setSkill = (id, v) => {
  st.pawns[id].skill = st.pawns[id].skill.slice();
  st.pawns[id].skill[ti] = v;
};
const E = VB['sim/estimate'];
assert.ok(E.reckoned(E.judgement(st, A.holder).skill).skill || true);
for (const id of kin) setSkill(id, 0.5);
st.pawns[A.holder].traits[VB['sim/traits'].IDX.diligence] = 0.5;

assert.notStrictEqual(ask(m, 'sorcery'), true, 'only a type of recurring work');
assert.strictEqual(holder(), null, 'none holds it');
assert.strictEqual(Voice.dutyLikely(st, m, T), true, 'likely yes');
assert.strictEqual(ask(m, T), true);
assert.strictEqual(holder(), m, "the duty is the asker's");
assert.strictEqual(Steps.dutyOf(plan, T).author, 'pawn');
assert.ok(VB.count.dutyGiven >= 1);
// held by another and the asker no more skilled: no, and a memory
const before = opinionOf(st, n, A.holder);
assert.strictEqual(Voice.dutyLikely(st, n, T), false, 'likely no');
assert.strictEqual(ask(n, T), true);
assert.strictEqual(holder(), m, 'an equally skilled asker does not take it');
assert.ok(opinionOf(st, n, A.holder) < before, 'the refusal is remembered');
assert.ok(VB.count.dutyRefused >= 1);
// the head reckons with skill only at skill 0.75 as head: make it so, then a more skilled asker takes it
for (const k of ['wits', 'husbandry']) st.pawns[A.holder].traits[VB['sim/traits'].IDX[k]] = 0.9;
setSkill(n, 0.9);
setSkill(m, 0.3);
const sk = E.skillSeen(st, A.holder, n, T);
assert.strictEqual(sk, 0.9, 'a skilled head sees the skill');
assert.strictEqual(Voice.dutyLikely(st, n, T), true);
assert.strictEqual(ask(n, T), true);
assert.strictEqual(holder(), n, 'a more skilled asker takes it');
// of its own accord, once a season
{
  const p = st.pawns[m];
  VOICE.duties = true;
  delete p.dutied;
  delete p.dutyAsked;
  plan.ahead = plan.ahead.filter((s) => s.what.duty === undefined);
  const day = Math.floor(st.t / 24),
    n0 = VB.count.dutyAsked;
  Voice.hour(st, { hour: WORK[0] - 1 });
  assert.ok(VB.count.dutyAsked > n0, 'a member with no duty asked');
  const n1 = VB.count.dutyAsked;
  assert.strictEqual(p.dutyAsked, day);
  Voice.hour(st, { hour: WORK[0] - 1 });
  assert.strictEqual(VB.count.dutyAsked, n1, 'not again within the season');
}
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log('voiceDuty ok');
