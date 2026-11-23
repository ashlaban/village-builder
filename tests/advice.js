// The retired's voice (VB-1316; design.md, Inheritance, The retired; docs/plans/VB-1122.md, section 3), on a constructed state
// (tests/lib/tiny.js): a retired member offers its head one of the head's verbs as an offer of basis `advice`; the head takes it when its
// opinion of the adviser times the adviser's standing over the village's mean reaches ADVICE.heed, and then issues the verb itself; a no
// books nothing. Only the retired advise, only the head of their household, only a verb whose check holds for the head. Under "Who makes
// a match" by the heads a retired grandparent wishes a match for a grandchild, which the head asks; under "the couple" it has no say.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR } = VB['sim/rules'];
const { refreshRoles } = VB['sim/heirs'];
const { remember } = VB['sim/relations'];
const { issue } = VB['sim/commands'];
const { ADVICE, weightOf, targetAdvice, matchAdvice, advise } = VB['sim/advice'];
const { askingIn, enqueue } = VB['sim/wishes'];
const R = VB['sim/records'];
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const map = [
  '..............',
  '...FF.........',
  '...FF.........',
  '..............',
  '..........FF..',
  '..............',
  '.........^^...',
  '..............',
  '~.............',
  '~~............',
];
// tests/handover.js's world: village 0, household 0 (holder 0 of 62, his wife 1, their daughters 2 to 5, of 30, 27, 24 and 21) and
// household 1 (holder 6, his wife 7, their children 8 to 10); village 1: household 2. Holder 0 has handed the farm on to his daughter 2
// and is retired on it.
function world(customs = {}, herds = false) {
  const st = tinyState(
    tinyWorld(map),
    [
      { at: [3, 5], farms: 2 },
      { at: [11, 2], farms: 1 },
    ],
    { seed: 7, herds, customs: { widow: 'keep', handover: 'age60', ...customs } },
  );
  const aged = (id, years) => {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  };
  [62, 60, 30, 27, 24, 21].forEach((y, id) => aged(id, y));
  aged(8, 22);
  for (const h of st.households) h.grain.barley += 5000;
  refreshRoles(st);
  const r = issue(st, {
    actor: 0,
    verb: 'offer',
    target: 2,
    args: { basis: 'handover', gives: { household: 0, reason: 'retirement' } },
    source: 'pawn',
  });
  assert.strictEqual(r, true, `the scene's handover: ${r}`);
  assert.ok(st.households[0].holder === 2 && st.pawns[0].retired, 'the scene: 0 is retired, his daughter 2 holds the farm');
  return st;
}
// The head's opinion of the adviser pushed by memories, until the advice's weight lies on the side asked
function lean(st, head, adviser, yes) {
  for (let i = 0; i < 20 && weightOf(st, head, adviser) >= ADVICE.heed !== yes; i++)
    remember(st, head, adviser, yes ? 'ale' : 'claim');
  assert.strictEqual(weightOf(st, head, adviser) >= ADVICE.heed, yes, `the scene: the head ${yes ? 'heeds' : 'does not heed'}`);
}
const advice = (st, actor, target, gives, source = 'pawn') =>
  issue(st, { actor, verb: 'offer', target, args: { basis: 'advice', gives }, source });
const told = (st, kind, pawn) => st.record.filter((e) => e.kind === kind && e.pawn === pawn);
const hay = (st) => st.plans.households.get(0).chosen;

// 1. Who may advise whom, on what: the retired, their own head, the head's verbs under their checks
{
  const st = world();
  const t = { verb: 'target', args: { store: 'hay', n: 1 } };
  assert.ok(/is not retired/.test(advice(st, 3, 2, t)), 'a member who is not retired does not advise');
  assert.ok(/does not live with the head/.test(advice(st, 0, 6, t)), 'nor another household’s head');
  assert.ok(/one advises the head on/.test(advice(st, 0, 2, { verb: 'marry', args: {} })), 'only the head’s verbs');
  assert.ok(/hay must be from/.test(advice(st, 0, 2, { verb: 'target', args: { store: 'hay', n: 9 } })), 'under their checks');
  sound(st, 'advice refused at its check');
}
// 2. The head takes advice by opinion and standing, and carries it out itself; a no books nothing
{
  const st = world();
  lean(st, 2, 0, false);
  const mem = st.pawns[0].rel.get(2) ? JSON.stringify(st.pawns[0].rel.get(2).mem) : null;
  assert.strictEqual(advice(st, 0, 2, { verb: 'target', args: { store: 'hay', n: 1.5 } }), true);
  assert.ok(!hay(st) || hay(st).hay === null, 'a head who thinks little of the adviser does not take it');
  assert.strictEqual(told(st, 'offerRefused', 2).length, 1, 'the no is told');
  assert.strictEqual(st.pawns[0].rel.get(2) ? JSON.stringify(st.pawns[0].rel.get(2).mem) : null, mem, 'and nobody remembers it');
  lean(st, 2, 0, true);
  assert.strictEqual(advice(st, 0, 2, { verb: 'target', args: { store: 'hay', n: 1.5 } }), true);
  assert.strictEqual(hay(st).hay, 1.5, 'a head who thinks well of the adviser takes it: the target is the head’s');
  assert.strictEqual(told(st, 'advice', 2).length, 1, 'and it is told');
  assert.strictEqual(st.offers.length, 0, 'answered at once, nothing is kept');
  sound(st, 'advice taken and refused');
}
// 3. The played head answers in its own time; the played adviser is not advised for
{
  const st = world();
  Sim.inhabit(st, 2);
  lean(st, 2, 0, false);
  assert.strictEqual(advice(st, 0, 2, { verb: 'target', args: { store: 'hay', n: 1.5 } }), true);
  assert.strictEqual(st.offers.length, 1, 'the played head’s answer is waited for');
  const o = st.offers[0];
  assert.strictEqual(issue(st, { actor: 2, verb: 'answer', target: o.id, args: { yes: true }, source: 'player' }), true);
  assert.strictEqual(hay(st).hay, 1.5, 'its yes carries it out, whatever its pawn’s own judgement');
  sound(st, 'the played head');
}
// 4. The unplayed retired's own advice: the custom's hay where the head's departs from it by more than ADVICE.gap
{
  const st = world({}, true);
  const plan = st.plans.households.get(0);
  VB['sim/herds'].makeHerd(st, st.households[0], 'cattle'); // the scene: a household with a herd to feed
  plan.targets.hayWinters = 0.1;
  const t = targetAdvice(st, st.households[0]);
  assert.ok(t && t.store === 'hay' && t.n > 0.1, `the old one advises the custom's hay: ${JSON.stringify(t)}`);
  lean(st, 2, 0, true);
  advise(st, st.pawns[0], st.households[0]);
  assert.strictEqual(hay(st).hay, t.n, 'and the head takes it');
  assert.strictEqual(st.pawns[0].advisedIn, Math.floor(st.t / YEAR), 'once a year');
  assert.strictEqual(targetAdvice(st, st.households[0]), null, 'the plan now agrees with the custom: nothing to advise');
  sound(st, 'the unplayed retired advises');
}
// 5. A grandchild's match: under the heads, the grandparent's wish is carried to the head, who asks it; under the couple, no say
function matchScene(matchBy) {
  const st = world({ matchBy });
  // pawn 5 (21) a daughter of 2: the retired 0's grandchild, of age, in his house
  st.pawns[5].mother = 2; // lint-allow: owner a test's scene: a grandchild
  st.pawns[5].father = null; // lint-allow: owner a test's scene
  st.idx = null; // lint-allow: owner the index of kin built afresh for the scene
  const man = [8, 9, 10].find((id) => st.pawns[id].sex === 'm' && st.pawns[id].age >= 18);
  return { st, man };
}
{
  const { st, man } = matchScene('heads');
  assert.ok(man !== undefined, 'the scene: a man of age in the other household');
  {
    if (!askingIn(st, 0).some((e) => e.pawn === man)) enqueue(st, man, st.t);
    for (let i = 0; i < 6; i++) remember(st, 0, man, 'ale');
    const m = matchAdvice(st, st.pawns[0], st.pawns[5], st.households[0]);
    assert.deepStrictEqual(m, { pawn: 5, partner: man }, 'the grandparent wishes the match with the one it thinks best of');
    lean(st, 2, 0, true);
    assert.strictEqual(advice(st, 0, 2, { verb: 'match', args: m }), true);
    const o = st.offers.find((x) => x.basis === 'match');
    assert.ok(o && o.gives.man === man && o.wants.woman === 5, 'the head asks the match');
    assert.strictEqual(o.from, 2, 'the head makes the offer, as the grandchild’s spokesman');
    sound(st, 'a grandchild’s match');
  }
  const c = matchScene('couple');
  if (c.man !== undefined)
    assert.ok(
      /leaves the match to the couple/.test(advice(c.st, 0, 2, { verb: 'match', args: { pawn: 5, partner: c.man } })),
      'under the couple the grandparent has no say',
    );
  assert.ok(R.spokesmanOf(st, 5) === 2, 'the head speaks for the grandchild');
}
console.log(
  'advice ok: only the retired advise their own head on its verbs; taken by opinion and standing, carried out by the head, a no ' +
    'books nothing; the played head answers; the unplayed retired advises the custom’s hay; a grandchild’s match carried to the head',
);
