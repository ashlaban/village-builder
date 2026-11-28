// @suite fast
// The moving round concludes offers (VB-692; docs/plans/VB-682.md, sections 2 and 5), on a constructed state (tests/lib/tiny.js): whose
// yes a move needs (moveWhy) in each case, and the move verb refusing a minor's service; the round's days, the order of the bases in a
// village's step, an offer about a pawn's future held as pawn.ask; a refusal on day 1 answered anew on day 2; a lapse after day 3.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, SEASON_DAYS, ASK } = VB['sim/rules'], { SOCIAL } = VB['sim/ties'];
const { moveWhy } = VB['sim/wishes'];
const { BASES } = VB['sim/offers'];
const { roundPhase, ROUND_STEPS } = VB['sim/round'];
const { VILLAGE_STEPS } = VB['sim/occasions'];
const { remember, opinionOf } = VB['sim/relations'];
const { issue } = VB['sim/commands'];
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
// Two villages: village 0 holds households 0 (holder 0, daughters 2 to 5) and 1 (holder 6, children 8 to 10); village 1 household 2.
// The children are aged as each case needs: 2 (21), 4 (20), 5 (19), 8 (a man of 22), 10 (a man of 20); 9 young. The steps below are
// run as a later day of the round (d 1), so that the first day's choosers stay out of the scene: only the offers made here are answered.
function world() {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2, sizes: [6, 5] }, { at: [11, 2], farms: 1, sizes: [4] }], { seed: 982 });
  const aged = (id, years) => {
    st.pawns[id].born = st.t - years * YEAR - DAY;
    st.pawns[id].age = years;
  };
  aged(2, 21);
  aged(4, 20);
  aged(5, 19);
  aged(10, 20);
  aged(8, 22);
  for (const h of st.households) h.grain.barley += 5000;
  VB['sim/heirs'].refreshRoles(st); // the roles read the ages
  return st;
}
const keys = (w) => (typeof w === 'string' ? w : w.map((a) => `${a.key} ${a.by}`).join(', '));

// 1. Whose yes a move needs (moveWhy; plan, section 5)
{
  const st = world();
  assert.strictEqual(R.spokesmanOf(st, 10), 6, 'the scene: a son of the house, spoken for by its holder');
  // an adult leaves for service, or new land, without leave: its own yes, and the receiving head's
  assert.strictEqual(keys(moveWhy(st, 10, 0, 'service')), 'self 10, head 0', 'service: the pawn and the head it comes to');
  assert.strictEqual(keys(moveWhy(st, 10, null, 'settle')), 'self 10', 'new land: the pawn alone');
  // a marriage asks the head left too, as spokesman
  assert.strictEqual(keys(moveWhy(st, 10, 0, 'marriage')), 'self 10, head 0, left 6', 'a marriage: the head left speaks');
  // one who speaks for itself is not asked twice
  assert.strictEqual(keys(moveWhy(st, 6, 0, 'marriage')), 'self 6, head 0', 'a holder speaks for himself');
  // one under 18 needs the head it leaves, and goes into service only with the grown pawn who keeps it
  assert.strictEqual(keys(moveWhy(st, 9, 0, 'guardian')), 'self 9, head 0, left 6', 'a minor: the head left');
  assert.strictEqual(typeof moveWhy(st, 9, 0, 'service'), 'string', 'a minor does not go into service alone');
  // one whose keepers no longer live with it (a dissolved household's child, placed by sim/heirs' extinct) is placed in service
  const { father, mother } = st.pawns[9];
  st.pawns[9].father = st.pawns[9].mother = null;
  assert.strictEqual(keys(moveWhy(st, 9, 0, 'service')), 'self 9, head 0, left 6', 'a minor with no keeper at home is placed');
  Object.assign(st.pawns[9], { father, mother });
  assert.strictEqual(keys(moveWhy(st, 9, 0, 'care')), 'head 0', 'under a care offer its kin answer for it');
  const why = issue(st, { actor: 9, verb: 'move', target: 0, args: { reason: 'service' }, source: 'round' });
  assert.ok(typeof why === 'string' && st.pawns[9].household === 1, `the move verb reads it: ${why}`);
  assert.strictEqual(issue(st, { actor: 10, verb: 'move', target: 0, args: { reason: 'service' }, source: 'round' }), true);
}

// The round's first day at noon, from the state's time: the due time of an offer made for the round
const roundNoon = (st, d = 0) => {
  const y = Math.floor(st.t / YEAR) * YEAR,
    t = y + (2 * SEASON_DAYS + ASK.day + d) * DAY + 12;
  return t > st.t ? t : t + YEAR;
};
// Every village's step of day d, at time `now` (each village once, as the clock runs them from noon)
const steps = (st, d, now, to = VILLAGE_STEPS) => {
  for (let n = 0; n < to; n++) roundPhase(st, n, d, now);
};
// 2. The round lasts ASK.passes days; a village's step answers the offers due to its people in the order handover, match, land, party,
// place, each held by its subject as pawn.ask until it closes.
{
  assert.strictEqual(ASK.passes, 3, 'three days');
  const rows = VB['sim/clock'].calendarRows().filter((r) => r.owner === 'sim/round');
  assert.deepStrictEqual(
    rows.map((r) => r.at),
    [0, 1, 2].map((d) => `season 2, sday ${ASK.day + d}, hour 12, tick 0-${ROUND_STEPS - 1}`),
    'the clock shows the three days',
  );
  const st = world(),
    due = roundNoon(st, 1),
    made = [];
  const offer = (actor, target, args) => {
    const r = issue(st, { actor, verb: 'offer', target, args: { ...args, due, round: true }, source: 'round' });
    assert.strictEqual(r, true, `${args.basis}: ${r}`);
    made.push(args.basis);
  };
  // made in another order than the step's
  offer(6, 2, { basis: 'place', gives: { household: 1 } });
  offer(5, 4, { basis: 'party', gives: { from: 0, all: [5, 4], followers: [4], house: 0, field: 1 } });
  // land is asked of the one who speaks for the village: its eldest holder
  const speaker = [0, 6].sort((a, b) => st.pawns[a].born - st.pawns[b].born || a - b)[0];
  offer(10, speaker, { basis: 'land', wants: { plot: 0 } });
  const again = issue(st, {
    actor: 0,
    verb: 'offer',
    target: 10,
    args: { basis: 'place', gives: { household: 0 }, due, round: true },
    source: 'round',
  });
  assert.ok(typeof again === 'string' && /open offer about its future/.test(again), `one open offer about its future a pawn: ${again}`);
  offer(6, 0, { basis: 'match', gives: { man: 8, home: 1 }, wants: { woman: 4 } });
  st.pawns[3].born = st.t - 25 * YEAR;
  st.pawns[3].age = 25;
  VB['sim/heirs'].refreshRoles(st);
  offer(0, 3, { basis: 'handover', gives: { household: 0, reason: 'retirement' } });
  for (const o of st.offers) {
    if (!BASES[o.basis].subject) continue; // a handover is nobody's ask (VB-824)
    const s = BASES[o.basis].subject(st, o);
    assert.strictEqual(st.pawns[s].ask, o.id, `${o.basis}: its subject holds it`);
  }
  sound(st, 'the offers made');
  // the order they are answered in: each basis's judgement told, its yes doing nothing here
  const order = [],
    saved = {};
  for (const b of ASK.order) {
    saved[b] = { weigh: BASES[b].weigh, settle: BASES[b].settle };
    BASES[b].weigh = (s, o, a) => {
      if (!order.includes(o.basis)) order.push(o.basis);
      return true;
    };
    BASES[b].settle = () => true;
  }
  try {
    const n0 = VB.count.offersAnswered;
    steps(st, 1, due - 1);
    assert.strictEqual(st.offers.length, 5, 'nothing is answered before it is due');
    steps(st, 1, due);
    assert.deepStrictEqual(order, ['handover', 'match', 'land', 'party', 'place'], 'the order of the bases in a step');
    assert.strictEqual(VB.count.offersAnswered - n0, 5, 'one answer an open offer (offersAnswered)');
    assert.strictEqual(st.offers.length, 0);
    assert.ok([2, 3, 5, 8, 10].every((id) => st.pawns[id].ask === null || st.pawns[id].ask === undefined), 'the asks are let go');
  } finally {
    for (const b of Object.keys(saved)) Object.assign(BASES[b], saved[b]);
  }
}

// 3. A refusal on day 1 answered anew on day 2, and a lapse after day 3. Man 10 is played: his match with woman 4, who hates him, is due
// on day 1 and refused at her village's step; that evening his side asks woman 5 (the player's offer: the round asks nothing anew for
// the played pawn with its automatic behaviour off), due day 2, and she says yes at her village's step on day 2. One asked on day 3's evening is still open when the
// round ends, and lapses.
const hate = (st, a, b) => {
  for (const k of ['claim', 'claim', 'claim', 'border', 'border', 'border']) remember(st, a, b, k);
  assert.ok(opinionOf(st, a, b) <= SOCIAL.enemy, `${a} is an enemy of ${b}`);
};
{
  const st = world();
  assert.strictEqual(Sim.inhabit(st, 10), true);
  Sim.setAuto(st, 10, false); // the player answers and asks for him (VB-1776: on automatic, his side asks anew as for any man)
  hate(st, 4, 10);
  const d1 = roundNoon(st, 0),
    ask = (woman, due) =>
      issue(st, {
        actor: 6,
        verb: 'offer',
        target: 0,
        args: { basis: 'match', gives: { man: 10, home: 1 }, wants: { woman }, due, round: true },
        source: 'player',
      });
  assert.strictEqual(ask(4, d1), true);
  const first = st.offers[0].id;
  assert.strictEqual(st.pawns[10].ask, first, 'the man holds his offer');
  steps(st, 1, d1); // day 1's steps, the answers alone
  assert.strictEqual(R.spouseOf(st, 10), null, 'refused on day 1');
  assert.ok(!st.offers.length && st.pawns[10].ask === null, 'the refused offer is closed, and his ask let go');
  assert.strictEqual(ask(5, d1 + DAY), true, 'that evening he makes his next offer, due the next day');
  steps(st, 1, d1 + DAY - 0.1);
  assert.strictEqual(R.spouseOf(st, 10), null, 'not answered before day 2');
  steps(st, 1, d1 + DAY);
  assert.strictEqual(R.spouseOf(st, 10), 5, 'answered anew on day 2, and married');
  sound(st, 'married on day 2');
}
// Unplayed, his side asks anew by itself that evening: the best of the others within reach, she who refused left out, due the next day.
{
  const st = world();
  hate(st, 4, 10);
  const d1 = roundNoon(st, 0);
  issue(st, {
    actor: 6,
    verb: 'offer',
    target: 0,
    args: { basis: 'match', gives: { man: 10, home: 1 }, wants: { woman: 4 }, due: d1, round: true },
    source: 'round',
  });
  steps(st, 1, d1);
  const next = st.offers.find((o) => o.basis === 'match' && o.gives.man === 10);
  assert.ok(next && next.wants.woman !== 4 && next.due === d1 + DAY && next.round, `asked anew, due the next day: ${JSON.stringify(next)}`);
  assert.strictEqual(st.pawns[10].ask, next.id);
  steps(st, 2, d1 + DAY);
  assert.strictEqual(R.spouseOf(st, 10), next.wants.woman, 'and answered on the next day');
  sound(st, 'asked anew and married');
}
{
  const st = world();
  const d3 = roundNoon(st, 2);
  assert.strictEqual(
    issue(st, {
      actor: 6,
      verb: 'offer',
      target: 0,
      args: { basis: 'match', gives: { man: 10, home: 1 }, wants: { woman: 4 }, due: d3 + DAY, round: true },
      source: 'player',
    }),
    true,
  );
  const mark = st.record.length;
  for (let n = 0; n < ROUND_STEPS; n++) roundPhase(st, n, ASK.passes - 1, d3);
  assert.strictEqual(st.offers.length, 0, 'what is open after the last day lapses');
  assert.ok(st.pawns[10].ask === null && R.spouseOf(st, 10) === null, 'unanswered, and his ask let go');
  assert.ok(
    st.record.slice(mark).some((e) => typeof e === 'object' && e.kind === 'offerLapsed'),
    'the lapse is told',
  );
  sound(st, 'after the round');
}
const { twins } = require('./lib/twins.js');
// VB-1776: on automatic with nothing queued, the played woman refuses the match as she would unplayed (her judgement at once, its
// reason read: sim/offers make, sim/marriage refusedMatch), and the played man, refused, has his side ask anew (sim/round askAgain)
for (const id of [4, 10]) {
  const [a] = twins(world, id, (st) => {
    hate(st, 4, 10);
    const d1 = roundNoon(st, 0);
    issue(st, {
      actor: 6,
      verb: 'offer',
      target: 0,
      args: { basis: 'match', gives: { man: 10, home: 1 }, wants: { woman: 4 }, due: d1, round: true },
      source: 'round',
    });
    steps(st, 1, d1);
  }, id === 4 ? 'the woman refuses' : 'the man refused');
  assert.strictEqual(R.spouseOf(a, 10), null, 'refused');
  if (id === 10) assert.ok(a.offers.some((o) => o.basis === 'match' && o.gives.man === 10 && o.wants.woman !== 4), 'his side asks anew');
}
console.log(
  'roundoffers ok: whose yes a move needs (the pawn, the head it comes to, the head left for a marriage or a minor; no minor in service ' +
    'alone); three days in the clock; a step answers handover, match, land, party, place in that order, once each, each held as its ' +
    "subject's ask; a refusal on day 1 answered anew on day 2; what is open after day 3 lapses",
);
