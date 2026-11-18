// Courting (VB-036; design.md, Traits, talk and stories: Courting; docs/plans/VB-682.md, sections 3 and 4.1), on a constructed state
// (tests/lib/tiny.js): the gate, each condition in turn; one at a time; the pair's own offer, made when the courtship starts, due at the
// round, answered before the round's matcher and married when all say yes; a couple without a place to live waits, and is matched with
// nobody else; a head's refusal leaves the memory, the couple courting, and one who holds that head ill asks for service at the next
// round; each ending; a match arranged for one who courts another; the played pawn; the invariants hold throughout.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, COURT, TICKS } = VB['sim/rules'];
// The clock set to time t
const at = (st, t) => {
  st.tick = Math.round(t * TICKS);
  st.t = st.tick / TICKS;
};
const { seedAsking } = VB['sim/wishes'];
const { askFor, askCourted, dueRound } = VB['sim/asking'];
const { barred, review, leavers } = VB['sim/courting'];
const { emit } = VB['sim/events'];
const { issue } = VB['sim/commands'];
const { movingRound } = VB['sim/round'];
const Rel = VB['sim/relations'],
  R = VB['sim/records'];
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
// Village 0: household 0 (holder 0, his wife 1, daughters 2 to 5) and household 1 (holder 6, his wife 7, sons 8 and 10, daughter 9);
// village 1: household 2. Aged: the heirs 2 (21) and 8 (22); 4 (20) and 10 (21), who are heirs to nothing; 9 (17); 5 (15).
function world(eve = false) {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
  const aged = (id, years) => {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  };
  aged(2, 21);
  aged(8, 22);
  aged(4, 20);
  aged(10, 21);
  aged(9, 17);
  aged(5, 15);
  for (const h of st.households) h.grain.barley += 5000;
  if (eve) at(st, dueRound(st) - DAY); // the eve of the moving round: a memory fades little in a day
  VB['sim/heirs'].refreshRoles(st);
  seedAsking(st); // the ages were changed after the state was seeded
  return st;
}
// a and b come to like each other (memories of work and ale together) and to know each other well
function fond(st, a, b) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    Rel.raiseTie(st, x, y, COURT.tie + 0.5);
    for (let i = 0; i < 6; i++) Rel.remember(st, x, y, 'worked');
    for (let i = 0; i < 4; i++) Rel.remember(st, x, y, 'ale');
  }
}
// a comes to hold b ill
const sour = (st, a, b) => {
  for (const kind of ['claim', 'border', 'crop']) for (let i = 0; i < 4; i++) Rel.remember(st, a, b, kind);
};
const goodTalk = (st, a, b) => emit(st, 'goodTalk', { a, b, oa: Rel.opinionOf(st, a, b), ob: Rel.opinionOf(st, b, a) });
const courting = (st, a, b) => st.pawns[a].courting === b && st.pawns[b].courting === a;
const kinds = (st, id) => st.pawns[id].events.map((i) => st.record[i].kind);
const last = (st, id, kind) => st.pawns[id].events.map((i) => st.record[i]).filter((e) => e.kind === kind).pop();

// 1. The gate: each condition in turn bars it; a good talk of two it allows starts the courtship, a life event of both
{
  const st = world();
  assert.strictEqual(barred(st, 8, 2), 'they do not like each other enough', 'strangers do not court');
  goodTalk(st, 8, 2);
  assert.ok(!courting(st, 8, 2), 'a good talk of two who do not yet like each other starts nothing');
  fond(st, 8, 2);
  assert.ok(Rel.opinionOf(st, 8, 2) >= COURT.opinion && Rel.opinionOf(st, 2, 8) >= COURT.opinion, 'the two like each other');
  assert.strictEqual(barred(st, 8, 2), null, 'two who like and know each other may court');
  assert.strictEqual(barred(st, 8, 2, 0.39, 0.9), 'they do not like each other enough', 'his opinion under COURT.opinion');
  assert.strictEqual(barred(st, 8, 2, 0.9, 0.39), 'they do not like each other enough', 'hers under it');
  st.pawns[2].ties.delete(8);
  assert.strictEqual(barred(st, 8, 2, 0.9, 0.9), 'they do not know each other well enough', 'her tie under COURT.tie');
  fond(st, 8, 2);
  fond(st, 8, 10);
  assert.strictEqual(barred(st, 8, 10), 'two of one sex do not court');
  fond(st, 8, 5);
  assert.strictEqual(barred(st, 8, 5), 'one of them is too young', 'she is 15');
  fond(st, 8, 9);
  assert.strictEqual(barred(st, 8, 9), 'too close kin for the custom of the village', 'his sister');
  fond(st, 8, 1);
  assert.strictEqual(barred(st, 8, 1), 'one of them is married');
  fond(st, 10, 9);
  assert.strictEqual(barred(st, 10, 9), 'too close kin for the custom of the village');
  sound(st, 'before any courtship');
  goodTalk(st, 2, 8);
  assert.ok(courting(st, 8, 2), 'they court');
  assert.deepStrictEqual(st.courtships, [8], 'the couple is indexed by its man');
  assert.strictEqual(st.pawns[8].courtingSince, st.t);
  for (const [id, other] of [
    [8, 2],
    [2, 8],
  ]) {
    const e = last(st, id, 'courting');
    assert.ok(e && e.other === other && e.village === 0, `a life event of ${id}`);
  }
  // one at a time
  fond(st, 8, 4);
  assert.strictEqual(barred(st, 8, 4), 'one of them courts already');
  goodTalk(st, 8, 4);
  assert.ok(courting(st, 8, 2) && st.pawns[4].courting == null, 'he courts one at a time');
  assert.strictEqual(VB['sim/wishes'].wishOf(st, 8, 'match'), 2, 'his match rung is the one he courts');
  sound(st, 'courting');
}

// 2. The pair's own offer: made when the courtship starts, due at the round, from him to her; answered there before the matcher
//    chooses, and they marry when all say yes; married, they court no more
{
  const st = world(true);
  fond(st, 8, 2);
  goodTalk(st, 8, 2);
  const o = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(o && o.basis === 'match' && o.courted === true && o.round === true, 'their offer is open');
  assert.deepStrictEqual([o.from, o.to, o.gives.man, o.wants.woman, o.due], [8, 2, 8, 2, dueRound(st)], 'from him to her, due at the round');
  assert.deepStrictEqual(o.answers.map((a) => a.key).sort(), ['man', 'manSide', 'woman', 'womanSide'], 'the two and their spokesmen answer');
  assert.strictEqual(askCourted(st, 2), 'held', 'no second offer while it is open');
  assert.strictEqual(askFor(st, 8), 'held');
  sound(st, 'the offer open');
  at(st, dueRound(st));
  movingRound(st);
  assert.strictEqual(R.spouseOf(st, 8), 2, 'they marry at the round');
  assert.ok(st.pawns[8].courting === null && st.pawns[2].courting === null && st.courtships.length === 0, 'married, they court no more');
  assert.ok(!kinds(st, 8).includes('courtingEnded'), 'the marriage is the event');
  sound(st, 'married');
}

// 3. A couple without a place to live waits, courting: no offer, and no spokesman's offer gives either to another
{
  const st = world(true);
  fond(st, 10, 4);
  goodTalk(st, 10, 4);
  assert.ok(courting(st, 10, 4), 'they court');
  assert.strictEqual(st.pawns[10].ask == null && askCourted(st, 10), 'wait', 'neither has a farm to live on: they wait');
  assert.strictEqual(askFor(st, 4) !== 'match' && st.offers.length, 0, 'her asking makes no offer either');
  // an arranged match is not made for one who courts
  const bar = VB['sim/matching'].matchBar(st, 8, 4);
  assert.ok(/is courting another/.test(bar.why), `the bar names it: ${bar.why}`);
  at(st, dueRound(st));
  movingRound(st);
  assert.ok(courting(st, 10, 4), 'they still court after the round');
  assert.ok(R.spouseOf(st, 10) === null && R.spouseOf(st, 4) === null, 'and neither was given to another');
  assert.strictEqual(R.spouseOf(st, 8), 2, 'while the two with places were matched');
  // a couple under the age to marry waits too
  const st2 = world();
  fond(st2, 8, 5);
  st2.pawns[5].born = st2.t - 17 * YEAR - DAY;
  st2.pawns[5].age = 17;
  goodTalk(st2, 8, 5);
  assert.ok(courting(st2, 8, 5), 'they court at 17');
  assert.strictEqual(askCourted(st2, 8), 'wait', 'and wait for the age to marry');
  sound(st2, 'courting under age');
  sound(st, 'waiting');
}

// 4. A refusal: her father holds his father an enemy and says no; each of the two remembers that head, they keep courting, he asks no
//    other; at the next round the one who holds that head ill asks for service, whatever the hands at home
{
  const st = world(true);
  fond(st, 8, 2);
  goodTalk(st, 8, 2);
  sour(st, 0, 6);
  assert.ok(Rel.opinionOf(st, 0, 6) <= VB['sim/rules'].SOCIAL.enemy, 'her father holds his an enemy');
  at(st, dueRound(st));
  const before = Rel.opinionOf(st, 8, 0);
  st.rng.society.fix = 0.99;
  movingRound(st);
  delete st.rng.society.fix;
  assert.ok(R.spouseOf(st, 8) === null && courting(st, 8, 2), 'refused, they keep courting');
  for (const id of [8, 2]) {
    assert.ok(st.pawns[id].rel.get(0).mem.refusedCourting, `${id} remembers the head who refused`);
    assert.strictEqual(st.pawns[id].courtRefused.by, 0);
  }
  assert.ok(Rel.opinionOf(st, 8, 0) < before, 'and thinks the less of him');
  assert.ok(st.pawns[8].ask == null && !st.offers.some((o) => o.basis === 'match'), 'he asks no other');
  assert.deepStrictEqual(leavers(st), [], 'nobody leaves at the round of the refusal');
  assert.strictEqual(st.pawns[8].courtRefused.by, 0, 'it is the next round that reads it');
  sound(st, 'refused');
  for (const id of [8, 2]) st.pawns[id].courtRefused.t -= YEAR - 3 * DAY; // a year on: the refusal was at the round before
  assert.ok(Rel.opinionOf(st, 8, 0) < COURT.leaveBelow, 'he holds her father ill');
  assert.ok(Rel.opinionOf(st, 2, 0) >= COURT.leaveBelow, 'she does not: he is her father');
  assert.deepStrictEqual(leavers(st), [8], 'he would leave for service, she stays');
  assert.ok(st.pawns[8].courtRefused === null && st.pawns[2].courtRefused === null, 'read once');
  // the round's act for service takes him, though his home has no hands to spare: household 2 is short of hands
  const short = st.households[2];
  for (const id of [...short.members]) if (id !== short.holder) st.pawns[id].age = Math.min(st.pawns[id].age, 10);
  st.pawns[short.holder].retired = false;
  VB['sim/service'].serveWhereShort(st, {});
  assert.strictEqual(st.pawns[8].household, 1, 'by the hands alone he stays');
  VB['sim/service'].serveWhereShort(st, { leavers: [8] });
  if (st.pawns[8].household === 2) {
    assert.ok(st.pawns[8].servant, 'in service in the other village');
    assert.ok(kinds(st, 8).includes('leftRefused'), 'a life event');
    assert.ok(courting(st, 8, 2), 'and still courting');
  } else assert.fail('the one refused found no place though household 2 is short');
  sound(st, 'left for service');
}

// 5. Each ending: the liking cooled (where the pair is touched), one married another, one died, the years ran out (but not with their
//    offer open)
{
  let st = world();
  fond(st, 10, 4);
  goodTalk(st, 10, 4);
  sour(st, 4, 10);
  assert.ok(st.pawns[10].courting === null && st.pawns[4].courting === null, 'her liking cooled: it ended where she was touched');
  assert.strictEqual(last(st, 10, 'courtingEnded').reason, 'cooled');
  assert.strictEqual(last(st, 4, 'courtingEnded').other, 10);
  assert.deepStrictEqual(st.courtships, []);
  sound(st, 'cooled');

  st = world();
  fond(st, 10, 4);
  goodTalk(st, 10, 4);
  assert.strictEqual(issue(st, { actor: 8, verb: 'marry', target: 4, args: { home: 1 }, source: 'round' }), true);
  assert.ok(st.pawns[10].courting === null && st.pawns[4].courting === null, 'she married another');
  assert.strictEqual(last(st, 10, 'courtingEnded').reason, 'married');
  sound(st, 'married another');

  st = world();
  fond(st, 10, 4);
  goodTalk(st, 10, 4);
  VB['sim/lifecycle'].killPawn(st, 10);
  assert.ok(st.pawns[4].courting === null && st.pawns[10].courting === null, 'he died');
  assert.strictEqual(last(st, 4, 'courtingEnded').reason, 'died');
  assert.ok(!kinds(st, 10).includes('courtingEnded'), 'no event of the dead');
  sound(st, 'died');

  st = world();
  fond(st, 10, 4);
  goodTalk(st, 10, 4);
  for (const id of [10, 4]) st.pawns[id].courtingSince = st.t - COURT.years * YEAR - DAY;
  review(st);
  assert.ok(st.pawns[10].courting === null, 'three years unmarried: it ends when the round reads the couple');
  assert.strictEqual(last(st, 10, 'courtingEnded').reason, 'years');
  sound(st, 'the years ran out');

  st = world();
  fond(st, 8, 2);
  goodTalk(st, 8, 2);
  for (const id of [8, 2]) st.pawns[id].courtingSince = st.t - COURT.years * YEAR - DAY;
  review(st);
  assert.ok(courting(st, 8, 2), 'with their offer open, the years do not end it');
  sound(st, 'old, and asked');
}

// 6. A match arranged before the courtship began: the one who courts says no to it, unless it holds its spokesman dearer than the one
//    it courts
{
  const st = world(true);
  const arranged = () =>
    issue(st, {
      actor: 6,
      verb: 'offer',
      target: 0,
      args: { basis: 'match', gives: { man: 8, home: 1 }, wants: { woman: 2 }, due: dueRound(st), round: true },
      source: 'asking',
    });
  assert.strictEqual(arranged(), true, 'his father offers him to the neighbour’s daughter');
  const o = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(o && !o.courted, 'an arranged match, open');
  fond(st, 8, 4);
  goodTalk(st, 8, 4);
  assert.ok(courting(st, 8, 4), 'meanwhile he comes to court her sister');
  const his = o.answers.find((a) => a.key === 'man');
  assert.strictEqual(VB['sim/offers'].BASES.match.weigh(st, o, his), false, 'he says no to the arranged match');
  for (let i = 0; i < 6; i++) Rel.remember(st, 8, 6, 'worked');
  for (let i = 0; i < 4; i++) Rel.remember(st, 8, 6, 'ale');
  for (let i = 0; i < 4; i++) Rel.remember(st, 8, 6, 'bull');
  assert.ok(Rel.opinionOf(st, 8, 6) > Rel.opinionOf(st, 8, 4), 'he holds his father dearer');
  assert.strictEqual(VB['sim/offers'].BASES.match.weigh(st, o, his), true, 'and yields');
  sound(st, 'arranged, and courting another');
}

// 7. The played pawn courts as any pawn does, and its own answer waits for the player until the round
{
  const st = world();
  assert.strictEqual(VB.sim.inhabit(st, 8), true);
  assert.strictEqual(st.player.pawn, 8);
  fond(st, 8, 2);
  goodTalk(st, 8, 2);
  assert.ok(courting(st, 8, 2), 'the played pawn courts');
  const o = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(o && o.answers.find((a) => a.key === 'man').yes === null, 'its answer is not given for it');
  assert.strictEqual(issue(st, { actor: 8, verb: 'answer', target: o.id, args: { yes: false }, source: 'player' }), true);
  assert.ok(R.spouseOf(st, 8) === null && courting(st, 8, 2), 'the player said no: they court on, unmarried');
  assert.ok(st.pawns[2].courtRefused == null, 'a no of one of the two is no head’s refusal');
  sound(st, 'played');
}
console.log('courting ok: the gate, one at a time, the offer and the marriage, the wait, the refusal and service, the endings, the played pawn');
