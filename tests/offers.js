// Marriage offers (VB-293, VB-693; design.md, Marriage as a negotiation, The round as offers): a match is an offer a spokesman makes at
// an asking, kept in st.offers until the moving round, which the two who would marry and their spokesmen answer: each by its own
// judgement at the round, the played pawn whenever it likes before. Yes marries them in the offer's home and the handover follows; no
// leaves both unmarried, and a young pawn that refuses its head's match costs the head's opinion; silence is the pawn's own judgement at
// the round; a death lets it lapse; a save with an offer open plays on as the unbroken run.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, R = VB['sim/records'], L = VB['sim/lifecycle'], N = VB['sim/notable'];
const { opinionOf } = VB['sim/relations'];
const { canon, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const { island, scenario } = require('./lib/probe.js'), SEED = 9;
// every chance comes up (sim/rng's fix), for the round only
const roll = (st, f) => {
  const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } };
const told = (st, from, kind) => st.record.slice(from).filter((e) => typeof e === 'object' && !e.self && e.kind === kind);
// Populous on the small island (VB-854) at seed 9 (was 42 until VB-888 dropped the empty villages, and on the 120 by 85 island 54: the scene needs a bride who speaks for herself),
// natural deaths off, every household given the means to marry; `before(st)` runs first (to play a pawn). The year's askings are held
// now, due at noon today (askAll), and with `round` the moving round is run at once, which answers them.
const { askFor } = VB['sim/asking'];
const noonOf = (st) => Math.floor(st.t / Sim.DAY) * Sim.DAY + 12;
const askAll = (st) => roll(st, () => { for (const e of [...st.asking]) if (st.pawns[e.pawn].alive) askFor(st, e.pawn, noonOf(st)); });
function scene(before = () => {}, round = true) {
  const st = scenario('populous', SEED); st.naturalDeaths = false;
  for (const h of st.households) h.grain.barley += 5000;
  before(st);
  const mark = st.record.length;
  askAll(st);
  if (round) roll(st, () => Sim.movingRound(st));
  return { st, mark };
}
// The round with no player: its first marriage of a son of the house (his father speaks for him) and a woman who speaks for herself, and
// the farm passes to him at the marriage (the handover custom 'marriage'). The first such, not the round's first marriage: since the
// villages' order turns by the year (VB-280), which village asks first depends on the year, so the scene is found, not assumed.
const plain = scene(), start = scenario('populous', SEED);
const wed = told(plain.st, plain.mark, 'married').find((e) => R.spokesmanOf(start, e.other) === e.other
  && start.households[e.household].holder !== e.pawn && R.spokesmanOf(start, e.pawn) === start.households[e.household].holder);
assert.ok(wed, 'the scene: a marriage in the round with a bride who speaks for herself');
const man = wed.pawn, woman = wed.other, home = wed.household, head = start.households[home].holder;
assert.ok(man !== undefined && head !== man && plain.st.households[home].holder === man, 'the scene: a son marries and takes over the farm');
assert.deepStrictEqual(plain.st.offers, [], 'no player: every match asked is answered or lapsed by the round\'s end');
const play = (id) => (st) => { assert.strictEqual(Sim.inhabit(st, id), true); Sim.setAuto(st, id, false); }; // the player answers for it (VB-1776: on automatic, its pawn's judgement answers at once)

// 1. spokesmanOf: a son of the house is spoken for by its holder; a holder, and one who speaks for itself, by itself.
{
  const st = scenario('populous', SEED);
  assert.strictEqual(R.spokesmanOf(st, man), head, 'a son of the house: the holder speaks');
  assert.strictEqual(R.spokesmanOf(st, head), head, 'a holder speaks for itself');
  assert.strictEqual(R.spokesmanOf(st, woman), woman, 'the bride speaks for herself');
  const servant = st.pawns.find((p) => p.alive && p.servant);
  if (servant) assert.strictEqual(R.spokesmanOf(st, servant.id), servant.id, 'a servant speaks for itself');
}

// 2. The played pawn is the man: his match is asked as any pawn's and open until the round; every answer is still to give.
const offered = () => {
  const s = scene(play(man), false), o = s.st.offers.find((x) => x.basis === 'match' && x.gives.man === man && x.wants.woman === woman);
  assert.ok(o && o.gives.home === home, `his match is open: ${JSON.stringify(s.st.offers)}`);
  return { ...s, o };
};
const round = (st) => roll(st, () => Sim.movingRound(st));
{
  const { st, mark, o } = offered();
  assert.deepStrictEqual(o.answers.map((a) => [a.key, a.by, a.yes]), [['man', man, null], ['manSide', head, null], ['woman', woman, null]]);
  assert.strictEqual(o.due, noonOf(st), 'due at the round');
  assert.ok(typeof o.fancy === 'number' && o.fancy >= 0 && o.fancy <= 1, 'the fancy drawn at the asking is kept on the offer');
  assert.strictEqual(R.spouseOf(st, man), null); assert.strictEqual(R.spouseOf(st, woman), null);
  assert.ok(told(st, mark, 'offered').some((e) => e.pawn === man && e.other === woman), 'the offer is told');
  for (const id of [man, woman]) assert.ok(Sim.recordOf(st, { pawn: id, life: true }).some((e) => e.kind === 'offered'), `in the life of ${id}`);
  sound(st, 'an offer open');
  // only a pawn with an answer still to give answers, once, and only an open offer (VB-690: the verb is any pawn's)
  const none = st.living.find((id) => !o.answers.some((a) => a.by === id));
  assert.ok(/no answer to give/.test(Sim.command(st, { actor: none, verb: 'answer', target: o.id, args: { yes: true }, source: 'player' })));
  assert.ok(/no open offer/.test(Sim.answer(st, st.player.pawn, st.offerSeq, true)));
  assert.ok(/cannot answer/.test(Sim.answer(st, st.player.pawn, o.id, 'yes')));
}

// 3. Yes is his answer; the others give theirs at the round, which marries them in the offer's home, and the handover follows as it would
// have, once the played heir says yes to it.
{
  const { st, o } = offered();
  assert.strictEqual(Sim.answer(st, st.player.pawn, o.id, true), true);
  assert.ok(st.offers.includes(o) && R.spouseOf(st, man) === null, 'the others answer at the round');
  round(st);
  assert.strictEqual(R.spouseOf(st, man), woman);
  assert.strictEqual(st.pawns[woman].household, home); assert.strictEqual(st.pawns[man].household, home);
  // the handover the marriage brings is the holder's offer, which the played heir answers (VB-692)
  const h = st.offers.find((x) => x.basis === 'handover');
  assert.ok(h && h.to === man && st.offers.length === 1, `the handover asks the played heir: ${JSON.stringify(st.offers)}`);
  sound(st, 'the handover offered');
  assert.strictEqual(Sim.answer(st, st.player.pawn, h.id, true), true);
  assert.strictEqual(st.households[home].holder, plain.st.households[home].holder, 'the farm passes to him as at the round');
  assert.deepStrictEqual(st.offers, []);
  sound(st, 'an offer accepted');
}

// 4. No closes it at once, leaves both unmarried and logs the refusal; the father, whose match it was, thinks less of his son by 0.2, as
// his honour feels it (VB-520).
{
  const { st, o } = offered(), was = opinionOf(st, head, man);
  assert.strictEqual(Sim.answer(st, st.player.pawn, o.id, false), true);
  assert.strictEqual(R.spouseOf(st, man), null); assert.strictEqual(R.spouseOf(st, woman), null);
  const ev = told(st, 0, 'matchRefused');
  assert.ok(ev.length === 1 && ev[0].pawn === man && ev[0].other === woman && ev[0].by === man && ev[0].text.startsWith(Sim.fullName(st.pawns[man])),
    'the refusal names who refused');
  for (const id of [man, woman]) assert.ok(Sim.recordOf(st, { pawn: id, life: true }).some((e) => e.kind === 'matchRefused'), `in the life of ${id}`);
  // a breach, felt by the head's honour (VB-520: TRAITS.acts.honour.breach, 0.5 to 1.5 times the memory's -0.2)
  const fall = 0.2 * VB['sim/traits'].act(st, head, 'honour', 'breach');
  assert.ok(Math.abs(opinionOf(st, head, man) - (was - fall)) < 1e-9, `the head's opinion falls by 0.2 times his honour's (${fall}; ${was} to ${opinionOf(st, head, man)})`);
  assert.strictEqual(st.households[home].holder, head, 'no marriage, no handover');
  assert.ok(!st.offers.includes(o));
  assert.ok(/no open offer/.test(Sim.answer(st, st.player.pawn, o.id, true)), 'a closed offer takes no answer');
  sound(st, 'an offer refused');
}

// 5. No answer: at the round the man answers as he would unplayed, and they marry, the handover following.
{
  const { st, o } = offered();
  Sim.advance(st, 3);
  assert.ok(st.offers.includes(o), 'open until the round');
  round(st);
  assert.ok(st.offers.every((x) => x.basis === 'handover' && x.to === man), 'the match is closed; the handover asks the played heir (VB-692)');
  assert.strictEqual(R.spouseOf(st, man), woman, 'married at the round');
  Sim.setAuto(st, man, true); // his own logic again: his household's asks of leave answered at once (VB-1776), the handover left open
  Sim.advance(st, 8 * Sim.DAY);
  assert.deepStrictEqual(st.offers, []);
  assert.strictEqual(st.pawns[woman].household, home); assert.strictEqual(st.households[home].holder, man, 'and the handover follows, unanswered, at its due time');
  sound(st, 'an offer closed at the round');
}

// 6. The player as head: a son's match is asked as any, and waits for the head's answer with the others'.
{
  const { st } = scene(play(head), false), o = st.offers.find((x) => x.basis === 'match' && x.gives.man === man && x.wants.woman === woman);
  assert.ok(o && o.answers.some((a) => a.key === 'manSide' && a.by === head && a.yes === null), 'the son\'s match waits for the head');
  const was = opinionOf(st, head, man);
  assert.strictEqual(Sim.answer(st, st.player.pawn, o.id, false), true);
  assert.strictEqual(opinionOf(st, head, man), was, 'refusing as a spokesman is remembered by no one');
  assert.strictEqual(R.spouseOf(st, man), null);
}

// 7. The man dies with the offer open: at the round it lapses, and says why.
{
  const { st, mark } = offered();
  Sim.killPawn(st, man, 'illness');
  round(st);
  const ev = told(st, mark, 'offerLapsed').filter((e) => e.pawn === man);
  assert.ok(ev.length >= 1 && ev.every((e) => /has died/.test(e.text)), `each offer he was in lapses: ${ev.map((e) => e.text)}`);
  assert.notStrictEqual(R.spouseOf(st, woman), man);
  sound(st, 'an offer lapsed');
}

// 8. A save made with an offer open loads and plays on as the unbroken run.
{
  const { st, o } = offered(), text = JSON.stringify(Sim.save(st));
  const back = Sim.load(island(SEED), JSON.parse(text));
  assert.ok(back.offers.some((x) => x.id === o.id && x.fancy === o.fancy), 'the open offer is saved, with its fancy');
  for (const s of [st, back]) { Sim.advance(s, 3); round(s); Sim.advance(s, 2 * Sim.DAY); }
  const bad = [...new Set([...Object.keys(kept(st)), ...Object.keys(kept(back))])].filter((k) => k !== 'w' && canon(st[k]) !== canon(back[k]));
  assert.deepStrictEqual(bad, [], 'the loaded run plays as the unbroken one');
  assert.strictEqual(R.spouseOf(back, man), woman);
}

// 9. A skip stops on an offer that waits for the played pawn's answer, but not on one open when it began.
{
  const st = scenario('populous', SEED); st.naturalDeaths = false;
  for (const h of st.households) h.grain.barley += 5000;
  Sim.inhabit(st, man);
  Sim.setAuto(st, man, false); // the player answers for it (VB-1776: on automatic, its pawn's judgement answers at once)
  const from = Sim.skipFrom(st);
  assert.strictEqual(from.offer, st.offerSeq);
  askAll(st);
  let stop; while ((stop = Sim.skipStop(st, from)) && stop.why !== 'offer' && stop.why !== 'round');
  assert.ok(stop && stop.why === 'offer' && N.SKIP.offer, `the skip stops on the offer: ${JSON.stringify(stop)}`);
  const later = Sim.skipFrom(st);
  assert.ok(later.offer > st.offers.find((x) => x.gives && x.gives.man === man).id, 'the open offer is noted');
  stop = Sim.skipStop(st, later);
  assert.ok(!stop || stop.why !== 'offer', 'an offer open at the start does not stop the skip');
}
console.log(`offers ok: a match asked is open until the round; the played man's yes, no and silence (the handover`
  + ' following); the head answers for a son; refusing a head\'s match costs 0.2 of its opinion, times its honour\'s; a death lapses it; saved and loaded; a skip stops on it');

// 10. Opinion in the negotiation (VB-275): the score, the young's no and the spokesmen's no, with opinions set through relations' remember.
// Enmity: two kinds of memory that together pass SOCIAL.enemy (claim -0.45 and border -0.3 at most).
{
  const { MARRIAGE } = VB['sim/rules'], { SOCIAL } = VB['sim/ties'], { remember } = VB['sim/relations'], { matchScore } = VB['sim/matching'];
  const hate = (st, a, b) => {
    remember(st, a, b, 'claim'); remember(st, a, b, 'claim'); remember(st, a, b, 'claim'); remember(st, a, b, 'border'); remember(st, a, b, 'border');
    remember(st, a, b, 'border'); assert.ok(opinionOf(st, a, b) <= SOCIAL.enemy, `${a} is an enemy of ${b}: ${opinionOf(st, a, b)}`); };
  const asked = (st, from) => told(st, from, 'matchRefused');
  // (a) liking moves matchScore by the mean of the two opinions.
  {
    const st = scenario('populous', SEED), M = st.pawns[man], F = st.pawns[woman];
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
  // The match of the scene, offered by the man's spokesman with the fancy at its mean and due at the round, and the round run.
  const matched = (before) => {
    const st = scenario('populous', SEED); st.naturalDeaths = false;
    for (const h of st.households) h.grain.barley += 5000;
    before(st);
    const mark = st.record.length;
    assert.strictEqual(Sim.command(st, { actor: head, verb: 'offer', target: woman, source: 'asking',
      args: { basis: 'match', gives: { man, home }, wants: { woman }, due: noonOf(st), round: true, fancy: 0.5 } }), true);
    round(st);
    return { st, mark };
  };
  // (b) an unplayed young pawn at enmity or below answers no at the round, and its spokesman's opinion of him falls (refusedMatch).
  {
    let was;
    const { st, mark } = matched((s) => { hate(s, man, woman); was = opinionOf(s, head, man); });
    assert.notStrictEqual(R.spouseOf(st, man), woman, 'the young man at enmity does not marry her');
    const no = asked(st, mark).find((e) => e.pawn === man && e.other === woman);
    assert.ok(no && no.by === man && no.reason === 'enmity', `the refusal is told: ${asked(st, mark).map((e) => e.text)}`);
    assert.ok(no.text.startsWith(Sim.fullName(st.pawns[man])), 'by the one at enmity');
    assert.ok(opinionOf(st, head, man) < was - 0.15, `the spokesman's opinion falls by refusedMatch: ${was} to ${opinionOf(st, head, man)}`);
    sound(st, 'a young pawn refused');
  }
  // (c) a spokesman weighs the other side's spokesman in the score as he reads it, MARRIAGE.headsLiking a point of his opinion (VB-693):
  // enmity alone no longer says no for him.
  {
    const { sideScore } = VB['sim/matching'];
    const st = scenario('populous', SEED), M = st.pawns[man], F = st.pawns[woman], read = () => sideScore(st, M, F, 0.5, head, woman);
    const s0 = read(), o0 = opinionOf(st, head, woman);
    hate(st, head, woman);
    assert.ok(Math.abs(read() - (s0 + MARRIAGE.headsLiking * (opinionOf(st, head, woman) - o0))) < 1e-9, 'the score as he reads it falls by half a point a point');
    assert.strictEqual(sideScore(st, M, F, 0.5, woman, woman), matchScore(st, { ...M, age: R.age(st, M) }, { ...F, age: R.age(st, F) }, 0.5, false),
      'one who speaks for both adds nothing');
    const { st: s2 } = matched((s) => hate(s, head, woman));
    assert.strictEqual(R.spouseOf(s2, man), woman, 'a father at enmity with the bride still makes a match that reaches the lowest score');
  }
  // control: the same scene with only mild dislike (above the line) marries.
  {
    const { st } = matched((s) => { remember(s, man, woman, 'claim'); assert.ok(opinionOf(s, man, woman) > SOCIAL.enemy); });
    assert.strictEqual(R.spouseOf(st, man), woman, 'dislike above the line still says yes');
  }
}
console.log('offers ok: opinion in the answers: the young\'s no at enmity, the spokesmen\'s liking in the score');
