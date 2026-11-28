// @suite fast
// An arranged match is a spokesman's offer, and the side asked takes the best (VB-693; docs/plans/VB-682.md, section 4.1), on a
// constructed state (tests/lib/tiny.js), the fancy given so that nothing is drawn: the side asked answers the best offer it holds, the
// other lapses and is no slight; a spokesman who refuses a suit is remembered by the one who offered it (refusedSuit); one who courts
// another refuses the match made for it, and yields when it holds its spokesman dearer (marriedAgainst); a woman's side asks from the
// summer, and a woman who holds a farm from the first; nobody is asked by more than ASK.held, whichever side asks.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, SEASON_DAYS, ASK, MARRIAGE } = VB['sim/rules'], { SOCIAL } = VB['sim/ties'];
const { seedAsking } = VB['sim/wishes'];
const { askFor } = VB['sim/asking'];
const { movingRound } = VB['sim/round'];
const { issue } = VB['sim/commands'];
const { emit } = VB['sim/events'];
const { sideScore } = VB['sim/matching'];
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
// village 1, under an hour's walk away: household 2 (holder 11, his wife 12, daughter 13, son 14). Aged as each case needs.
function world(ages) {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
  for (const [id, years] of Object.entries(ages)) {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  }
  for (const h of st.households) h.grain.barley += 5000;
  VB['sim/heirs'].refreshRoles(st);
  seedAsking(st); // the ages were changed after the state was seeded
  return st;
}
const noon = (st) => Math.floor(st.t / DAY) * DAY + 12;
// The spokesman of the man offers the match, due at the round today, with the fancy given: true, or why not
const offer = (st, man, woman, home, fancy = 0.5) =>
  issue(st, {
    actor: R.spokesmanOf(st, man),
    verb: 'offer',
    target: R.spokesmanOf(st, woman),
    args: { basis: 'match', gives: { man, home }, wants: { woman }, due: noon(st), round: true, fancy },
    source: 'asking',
  });
const told = (st, from, kind) =>
  st.record.slice(from).filter((e) => typeof e === 'object' && !e.self && e.kind === kind);
const remembers = (st, a, b, kind) => Rel.reasonsOf(st, a, b).some((r) => r.label === SOCIAL.memories[kind].label);
const fond = (st, a, b, kinds = ['worked', 'ale']) => {
  VB['sim/ties'].raiseTie(st, a, b, 3);
  for (const k of kinds) for (let i = 0; i < 6; i++) Rel.remember(st, a, b, k);
};

// 1. Her side takes the better of two offers: the one her spokesman reads higher is answered first and marries her; the other lapses
// for her marriage, which is no slight: nobody remembers it.
{
  const st = world({ 2: 21, 8: 22, 14: 24 });
  assert.strictEqual(offer(st, 8, 2, 1), true);
  assert.strictEqual(offer(st, 14, 2, 2), true, 'she may be asked by a second');
  const [a, b] = st.offers;
  assert.ok(a.gives.man === 8 && b.gives.man === 14 && st.pawns[8].ask === a.id && st.pawns[14].ask === b.id, 'each asker holds his offer');
  const read = (o) => sideScore(st, st.pawns[o.gives.man], st.pawns[2], 0.5, 0, o.from);
  assert.ok(read(b) > read(a), `her father reads the second higher: ${read(a)} against ${read(b)}`);
  sound(st, 'two offers to one woman');
  const mark = st.record.length;
  movingRound(st);
  assert.strictEqual(R.spouseOf(st, 2), 14, 'she marries the better match, though it was asked second');
  const lapsed = told(st, mark, 'offerLapsed').filter((e) => e.pawn === 8 && e.other === 2);
  assert.ok(lapsed.length === 1 && /has married/.test(lapsed[0].text), 'the other offer lapses for her marriage');
  assert.ok(!told(st, mark, 'matchRefused').some((e) => e.pawn === 8 && e.other === 2), 'and is no refusal');
  assert.ok(!remembers(st, 6, 0, 'refusedSuit'), 'a better offer taken is no slight: his spokesman remembers nothing');
  sound(st, 'the better offer taken');
}

// 2. A spokesman refuses a suit: the asking spokesman's fancy carried the score, her father reads it at the fancy's mean, below the
// lowest score; the refusal is told with who refused and why, and the spokesman who asked remembers it (refusedSuit).
{
  const st = world({ 2: 21, 14: 39 });
  assert.strictEqual(offer(st, 14, 2, 2, 1), true);
  const o = st.offers[0],
    his = sideScore(st, st.pawns[14], st.pawns[2], o.fancy, 11, 0),
    hers = sideScore(st, st.pawns[14], st.pawns[2], 0.5, 0, 11);
  assert.ok(his >= MARRIAGE.minScore && hers < MARRIAGE.minScore, `the scene: ${his} for his side, ${hers} for hers`);
  const mark = st.record.length;
  movingRound(st);
  assert.notStrictEqual(R.spouseOf(st, 2), 14, 'her father refuses');
  const no = told(st, mark, 'matchRefused').find((e) => e.pawn === 14 && e.other === 2);
  assert.ok(no && no.by === 0 && no.reason === 'score', `told, with who and why: ${JSON.stringify(no)}`);
  for (const id of [14, 2])
    assert.ok(st.pawns[id].events.some((i) => st.record[i].kind === 'matchRefused'), `in the life of ${id}`);
  assert.ok(remembers(st, 11, 0, 'refusedSuit'), 'the spokesman who asked remembers the one who refused');
  assert.ok(!remembers(st, 0, 2, 'refusedMatch'), 'the daughter refused nothing');
  sound(st, 'a suit refused');
}

// 3. One who courts another: a match made for her before the courtship began. She refuses it, and her father remembers; holding her
// father dearer than the one she courts, she yields, marries, and remembers him for it (marriedAgainst).
{
  const scene = (dearer) => {
    const st = world({ 2: 21, 10: 22, 14: 24 });
    assert.strictEqual(offer(st, 14, 2, 2), true);
    for (const [x, y] of [
      [2, 10],
      [10, 2],
    ])
      fond(st, x, y);
    if (dearer) fond(st, 2, 0, ['worked', 'ale', 'bull']);
    emit(st, 'goodTalk', { a: 2, b: 10, oa: Rel.opinionOf(st, 2, 10), ob: Rel.opinionOf(st, 10, 2) });
    assert.ok(st.pawns[2].courting === 10 && st.pawns[10].courting === 2, 'the scene: she courts another');
    assert.strictEqual(Rel.opinionOf(st, 2, 0) > Rel.opinionOf(st, 2, 10), dearer, 'the scene: whom she holds dearer');
    const mark = st.record.length;
    movingRound(st);
    return { st, mark };
  };
  {
    const { st, mark } = scene(false);
    assert.strictEqual(R.spouseOf(st, 2), null, 'courting another, she refuses');
    const no = told(st, mark, 'matchRefused').find((e) => e.pawn === 14 && e.other === 2);
    assert.ok(no && no.by === 2 && no.reason === 'courting', `told: ${JSON.stringify(no)}`);
    assert.ok(remembers(st, 0, 2, 'refusedMatch'), 'her father remembers the match she refused');
    assert.ok(!remembers(st, 11, 0, 'refusedSuit'), 'her spokesman refused nothing: no suit is remembered');
    assert.ok(st.pawns[2].courting === 10, 'and she courts on');
    sound(st, 'a courting member refused');
  }
  {
    const { st, mark } = scene(true);
    assert.strictEqual(R.spouseOf(st, 2), 14, 'holding her father dearer, she yields');
    assert.ok(remembers(st, 2, 0, 'marriedAgainst'), 'and remembers him for it');
    const ev = told(st, mark, 'marriedAgainst');
    assert.ok(ev.length === 1 && ev[0].pawn === 2 && ev[0].other === 14, 'the match against her wish is told');
    assert.ok(st.pawns[2].events.some((i) => st.record[i].kind === 'marriedAgainst'), 'and in her life');
    assert.ok(st.pawns[2].courting === null && st.pawns[10].courting === null, 'the courtship is over');
    sound(st, 'a courting member yielded');
  }
}

// 4. A woman's side asks from the summer; a woman who holds a farm and speaks for herself, from the first.
{
  const SEASON = SEASON_DAYS * DAY;
  const st = world({ 13: 20, 8: 23 });
  assert.notStrictEqual(askFor(st, 13), 'match', "in spring a daughter's side does not ask");
  assert.strictEqual(st.offers.length, 0);
  st.t += ASK.womenFrom * SEASON; // the same day of the summer (nothing is stepped: only the asking is read)
  assert.strictEqual(askFor(st, 13), 'match', 'in summer her father asks for her');
  const o = st.offers.find((x) => x.id === st.pawns[13].ask);
  assert.ok(o && o.asker === 'woman' && o.from === 11 && o.to === 6 && o.gives.man === 8 && o.wants.woman === 13, JSON.stringify(o));
  assert.ok(typeof o.fancy === 'number', 'the fancy drawn at the asking is kept');
  assert.notStrictEqual(askFor(st, 8), 'match', 'asked, he asks nobody himself');
  assert.strictEqual(st.offers.length, 1);
  // a widow who holds the farm asks in spring
  const w = world({ 8: 23 });
  VB['sim/lifecycle'].killPawn(w, 0);
  assert.ok(R.holdingOf(w, 1) !== null && R.spokesmanOf(w, 1) === 1, 'the scene: the widow holds the farm and speaks for herself');
  assert.strictEqual(askFor(w, 1), 'match', 'she asks from the first');
  assert.strictEqual(w.offers.find((x) => x.id === w.pawns[1].ask).asker, 'woman');
  sound(w, 'a widow asked');
}

// 5. The cap: one asked by ASK.held open matches is asked by no more, whichever side asks; and one who asks is asked by nobody.
{
  const st = world({ 2: 21, 8: 22, 13: 20, 14: 24 });
  const fake = [];
  for (let k = 0; k < ASK.held; k++)
    fake.push({ id: 1000 + k, basis: 'match', asker: 'woman', gives: { man: 8, home: 0 }, wants: { woman: -1 }, answers: [] });
  st.offers.push(...fake); // the count of those asking him is all that is read
  const ask = (from, to, man, woman, home) =>
    issue(st, {
      actor: from,
      verb: 'offer',
      target: to,
      args: { basis: 'match', gives: { man, home }, wants: { woman }, due: noon(st), round: true },
      source: 'asking',
    });
  let why = ask(11, 6, 8, 13, 1);
  assert.ok(typeof why === 'string' && /he is asked by 5/.test(why), `a sixth woman's side is refused: ${why}`);
  why = ask(6, 0, 8, 2, 1);
  assert.ok(typeof why === 'string' && /in an open offer/.test(why), `and he, asked, asks nobody: ${why}`);
  st.offers.length = 0;
  assert.strictEqual(ask(6, 0, 8, 2, 1), true, 'his side asks her');
  why = ask(11, 6, 8, 13, 1);
  assert.ok(typeof why === 'string' && /he is in an open offer/.test(why), `one who asks is asked by nobody: ${why}`);
  assert.strictEqual(ask(11, 0, 14, 2, 2), true, 'she is asked by a second');
  sound(st, 'the caps');
}
console.log("suit ok: the better of two offers; a suit refused and remembered; courting, refusing and yielding; a woman's side asks from the summer; the caps");
