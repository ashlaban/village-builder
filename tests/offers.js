// Marriage offers (VB-293; design.md, Marriage as a negotiation): each match of the moving round is an offer that the two who marry and
// their spokesmen answer. With no player every side says yes at once and nothing is stored (the golden file and the counters show the run
// unchanged). A match that waits for the played pawn's answer is kept in st.offers with its due time, the two held out of the round: yes
// marries them in the round's home and the handover follows; no leaves both unmarried, and a young pawn that refuses its head's match costs
// the head's opinion; silence is yes at the due time; a death lets it lapse; a save with an offer open plays on as the unbroken run.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], L = VB['sim/lifecycle'], N = VB['sim/notable'];
const { opinionOf } = VB['sim/relations'];
const { canon } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
// every chance comes up (sim/rng's fix), for the round only
const roll = (st, f) => {
  const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } };
const told = (st, from, kind) => st.record.slice(from).filter((e) => typeof e === 'object' && !e.self && e.kind === kind);
// Populous tiny at seed 54 (51 until the villages were laid out anew, VB-402: the scene needs a bride who speaks for herself), natural deaths off, every household given the means to marry; `before(st)` runs before the round (to play a pawn).
function scene(before = () => {}) {
  const st = Sim.seed(world(54), 54, 'populous'); st.naturalDeaths = false;
  for (const h of st.households) h.grain.barley += 5000;
  before(st);
  const mark = st.record.length;
  roll(st, () => Sim.movingRound(st));
  return { st, mark };
}
// The round with no player: its first marriage is a son of the house (his father speaks for him) and a woman who speaks for herself, and
// the farm passes to him at the marriage (the handover custom 'marriage').
const plain = scene(), wed = told(plain.st, plain.mark, 'married')[0];
const man = wed.pawn, woman = wed.other, home = wed.household, head = Sim.seed(world(54), 54, 'populous').households[home].holder;
assert.ok(man !== undefined && head !== man && plain.st.households[home].holder === man, 'the scene: a son marries and takes over the farm');
assert.deepStrictEqual(plain.st.offers, [], 'no player, no offer stored');
assert.strictEqual(plain.st.offerSeq, 0);
assert.strictEqual(told(plain.st, 0, 'offered').length, 0, 'matches answered at once write nothing new');
const play = (id) => (st) => { assert.strictEqual(Sim.inhabit(st, id), true); };

// 1. spokesmanOf: a son of the house is spoken for by its holder; a holder, and one who speaks for itself, by itself.
{
  const st = Sim.seed(world(54), 54, 'populous');
  assert.strictEqual(R.spokesmanOf(st, man), head, 'a son of the house: the holder speaks');
  assert.strictEqual(R.spokesmanOf(st, head), head, 'a holder speaks for itself');
  assert.strictEqual(R.spokesmanOf(st, woman), woman, 'the bride speaks for herself');
  const servant = st.pawns.find((p) => p.alive && p.servant);
  if (servant) assert.strictEqual(R.spokesmanOf(st, servant.id), servant.id, 'a servant speaks for itself');
}

// 2. The played pawn is the man: his match waits, the woman is held (a later round the same day does not match her), and the answers are
// his (to give) and his father's (yes, unplayed).
const offered = () => {
  const s = scene(play(man)), o = s.st.offers[0];
  assert.ok(o && o.man === man && o.woman === woman && o.home === home, `an offer is stored: ${JSON.stringify(s.st.offers)}`);
  return { ...s, o };
};
{
  const { st, mark, o } = offered();
  assert.deepStrictEqual(o.answers, [{ key: 'man', by: man, yes: null }, { key: 'manSide', by: head, yes: true }, { key: 'woman', by: woman, yes: true }]);
  assert.strictEqual(o.due, o.made + 7 * Sim.DAY);
  assert.strictEqual(R.spouseOf(st, man), null); assert.strictEqual(R.spouseOf(st, woman), null, 'the woman is married to no one else in the round');
  assert.strictEqual(told(st, mark, 'offered').length, 1, 'the offer is told');
  for (const id of [man, woman]) assert.ok(Sim.recordOf(st, { pawn: id, life: true }).some((e) => e.kind === 'offered'), `in the life of ${id}`);
  sound(st, 'an offer open');
  roll(st, () => Sim.movingRound(st));
  assert.strictEqual(R.spouseOf(st, woman), null, 'a later round leaves the held woman alone');
  assert.strictEqual(st.offers.length, 1);
  // only the played pawn answers, once, and only an open offer
  assert.ok(/not the player's pawn/.test(Sim.command(st, { actor: head, verb: 'answer', target: o.id, args: { yes: true }, source: 'player' })));
  assert.ok(/no open offer/.test(Sim.answer(st, o.id + 1, true)));
  assert.ok(/cannot answer/.test(Sim.answer(st, o.id, 'yes')));
}

// 3. Yes marries them at once in the round's home, and the handover follows as it would have.
{
  const { st, o } = offered();
  assert.strictEqual(Sim.answer(st, o.id, true), true);
  assert.strictEqual(R.spouseOf(st, man), woman);
  assert.strictEqual(st.pawns[woman].household, home); assert.strictEqual(st.pawns[man].household, home);
  assert.strictEqual(st.households[home].holder, plain.st.households[home].holder, 'the farm passes to him as at the round');
  assert.deepStrictEqual(st.offers, []);
  sound(st, 'an offer accepted');
}

// 4. No leaves both unmarried and logs the refusal; the father, whose match it was, thinks less of his son by 0.2.
{
  const { st, o } = offered(), was = opinionOf(st, head, man);
  assert.strictEqual(Sim.answer(st, o.id, false), true);
  assert.strictEqual(R.spouseOf(st, man), null); assert.strictEqual(R.spouseOf(st, woman), null);
  const ev = told(st, 0, 'matchRefused');
  assert.ok(ev.length === 1 && ev[0].pawn === man && ev[0].other === woman && ev[0].text.startsWith(Sim.fullName(st.pawns[man])),
    'the refusal names who refused');
  assert.ok(Math.abs(opinionOf(st, head, man) - (was - 0.2)) < 1e-9, `the head's opinion falls by 0.2 (${was} to ${opinionOf(st, head, man)})`);
  assert.strictEqual(st.households[home].holder, head, 'no marriage, no handover');
  assert.deepStrictEqual(st.offers, []);
  assert.ok(/no open offer/.test(Sim.answer(st, o.id, true)), 'a closed offer takes no answer');
  sound(st, 'an offer refused');
}

// 5. No answer: at the due time the man answers as he would unplayed, and they marry, the handover following.
{
  const { st, o } = offered();
  Sim.advance(st, 6 * Sim.DAY);
  assert.strictEqual(st.offers.length, 1, 'open until its due time');
  Sim.advance(st, 2 * Sim.DAY);
  assert.deepStrictEqual(st.offers, []);
  assert.strictEqual(R.spouseOf(st, man), woman, 'married at the due time');
  assert.strictEqual(st.pawns[woman].household, home); assert.strictEqual(st.households[home].holder, man, 'and the handover follows');
  const m = told(st, 0, 'married').find((e) => e.pawn === man);
  assert.ok(m && m.t >= o.due && m.t < o.due + Sim.DAY, 'at the day\'s end after the due time');
  sound(st, 'an offer closed at its due time');
}

// 6. The player as head: a son's match waits for the head's answer, and the son's own answer is yes.
{
  const { st } = scene(play(head)), o = st.offers[0];
  assert.ok(o && o.man === man, 'the son\'s match waits for the head');
  assert.deepStrictEqual(o.answers.map((a) => [a.key, a.by, a.yes]), [['man', man, true], ['manSide', head, null], ['woman', woman, true]]);
  const was = opinionOf(st, head, man);
  assert.strictEqual(Sim.answer(st, o.id, false), true);
  assert.strictEqual(opinionOf(st, head, man), was, 'refusing as a spokesman is remembered by no one');
  assert.strictEqual(R.spouseOf(st, man), null);
}

// 7. The man dies with the offer open: at its due time it lapses, and says why.
{
  const { st } = offered();
  Sim.killPawn(st, man, 'illness');
  Sim.advance(st, 8 * Sim.DAY);
  assert.deepStrictEqual(st.offers, []);
  const ev = told(st, 0, 'offerLapsed');
  assert.ok(ev.length === 1 && /not a living pawn/.test(ev[0].text), `the offer lapses: ${ev.map((e) => e.text)}`);
  assert.strictEqual(R.spouseOf(st, woman), null);
  sound(st, 'an offer lapsed');
}

// 8. A save made with an offer open loads and plays on as the unbroken run.
{
  const { st } = offered(), text = JSON.stringify(Sim.save(st));
  Sim.advance(st, 8 * Sim.DAY);
  const back = Sim.load(world(54), JSON.parse(text));
  assert.strictEqual(back.offers.length, 1, 'the open offer is saved');
  Sim.advance(back, 8 * Sim.DAY);
  const bad = [...new Set([...Object.keys(st), ...Object.keys(back)])].filter((k) => k !== 'w' && canon(st[k]) !== canon(back[k]));
  assert.deepStrictEqual(bad, [], 'the loaded run plays as the unbroken one');
  assert.strictEqual(R.spouseOf(back, man), woman);
}

// 9. A skip stops on an offer that waits for the played pawn's answer, but not on one open when it began.
{
  const st = Sim.seed(world(54), 54, 'populous'); st.naturalDeaths = false;
  for (const h of st.households) h.grain.barley += 5000;
  Sim.inhabit(st, man);
  const from = Sim.skipFrom(st);
  assert.strictEqual(from.offer, st.offerSeq);
  roll(st, () => Sim.movingRound(st));
  let stop; while ((stop = Sim.skipStop(st, from)) && stop.why !== 'offer' && stop.why !== 'round');
  assert.ok(stop && stop.why === 'offer' && N.SKIP.offer, `the skip stops on the offer: ${JSON.stringify(stop)}`);
  const later = Sim.skipFrom(st);
  assert.strictEqual(later.offer, st.offers[0].id + 1, 'the open offer is noted');
  stop = Sim.skipStop(st, later);
  assert.ok(!stop || stop.why !== 'offer', 'an offer open at the start does not stop the skip');
}
console.log(`offers ok: no player stores none; a played man's match waits, holds the woman, and yes, no and silence close it (the handover`
  + ' following); the head answers for a son; refusing a head\'s match costs 0.2 of its opinion; a death lapses it; saved and loaded; a skip stops on it');

// 10. Opinion in the negotiation (VB-275): the score, the young's no and the spokesmen's no, with opinions set through relations' remember.
// Enmity: two kinds of memory that together pass SOCIAL.enemy (claim -0.45 and border -0.3 at most).
{
  const { SOCIAL, MARRIAGE } = VB['sim/rules'], { remember } = VB['sim/relations'], { matchScore } = VB['sim/matching'];
  const hate = (st, a, b) => {
    remember(st, a, b, 'claim'); remember(st, a, b, 'claim'); remember(st, a, b, 'claim'); remember(st, a, b, 'border'); remember(st, a, b, 'border');
    remember(st, a, b, 'border'); assert.ok(opinionOf(st, a, b) <= SOCIAL.enemy, `${a} is an enemy of ${b}: ${opinionOf(st, a, b)}`); };
  const asked = (st, from) => told(st, from, 'matchRefused');
  // (a) liking moves matchScore by the mean of the two opinions.
  {
    const st = Sim.seed(world(54), 54, 'populous'), M = st.pawns[man], F = st.pawns[woman];
    const score = () => matchScore(st, M, F, 0.5, false), rest = () => score() - MARRIAGE.liking * (opinionOf(st, man, woman) + opinionOf(st, woman, man)) / 2;
    const s0 = score(), r0 = rest();
    remember(st, man, woman, 'bull'); remember(st, man, woman, 'bull'); remember(st, woman, man, 'bull');
    const mean = (opinionOf(st, man, woman) + opinionOf(st, woman, man)) / 2;
    assert.ok(mean > 0.05, `the opinions are set: ${mean}`);
    assert.ok(Math.abs(score() - (s0 + MARRIAGE.liking * mean)) < 1e-9, 'liking moves the score by the mean of the two opinions');
    assert.ok(Math.abs(rest() - r0) < 1e-9, 'and by nothing else');
    hate(st, man, woman); // one-sided enmity: the mean falls by half of it
    assert.ok(Math.abs(rest() - r0) < 1e-9, 'a one-sided opinion counts half');
  }
  // (b) an unplayed young pawn at enmity or below answers no; the match closes at once and its spokesman's opinion of him falls (refusedMatch).
  {
    let was;
    const { st, mark } = scene((s) => { hate(s, man, woman); was = opinionOf(s, head, man); });
    assert.strictEqual(R.spouseOf(st, man), null, 'the young man at enmity does not marry her');
    assert.deepStrictEqual(st.offers, [], 'a no never waits');
    const no = asked(st, mark).find((e) => e.pawn === man && e.other === woman);
    assert.ok(no, `the refusal is told: ${asked(st, mark).map((e) => e.text)}`);
    assert.ok(no.text.startsWith(Sim.fullName ? Sim.fullName(st.pawns[man]) : ''), 'by the one at enmity');
    assert.ok(opinionOf(st, head, man) < was - 0.15, `the spokesman's opinion falls by refusedMatch: ${was} to ${opinionOf(st, head, man)}`);
    sound(st, 'a young pawn refused');
  }
  // (c) an unplayed spokesman at enmity with the other side's spokesman answers no; no one remembers it (no spokesman above him).
  {
    let was;
    const { st, mark } = scene((s) => { hate(s, head, woman); was = opinionOf(s, head, man); });
    assert.strictEqual(R.spouseOf(st, man), null, 'the father at enmity with the bride does not make the match');
    const no = asked(st, mark).find((e) => e.pawn === man && e.other === woman);
    assert.ok(no && no.text.startsWith(Sim.fullName(st.pawns[head])), `the father refuses: ${asked(st, mark).map((e) => e.text)}`);
    assert.ok(Math.abs(opinionOf(st, head, man) - was) < 1e-9, 'his opinion of his son is untouched');
    sound(st, 'a spokesman refused');
  }
  // control: the same scene with only mild dislike (above the line) marries as the plain round does.
  {
    const { st } = scene((s) => { remember(s, man, woman, 'claim'); assert.ok(opinionOf(s, man, woman) > SOCIAL.enemy); });
    assert.strictEqual(R.spouseOf(st, man), woman, 'dislike above the line still says yes');
  }
}
