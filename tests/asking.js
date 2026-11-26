// The asking day (VB-823; docs/plans/VB-682.md, sections 2, 3 and 7), on a constructed state (tests/lib/tiny.js): the queue of askings
// (st.asking, sim/wishes) and each pawn's day by its id; no offer while one is open; the cap of ASK.held open matches on one woman, and of
// ASK.pool candidates weighed; an offer that lapses at the asker's next asking when the one asked has married another; the played
// pawn's match is asked as any pawn's; the invariants hold throughout.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, SEASON_DAYS, ASK } = VB['sim/rules'];
const { seek, seedAsking } = VB['sim/wishes'];
const { askFor, askMatch, dueRound } = VB['sim/asking'];
const { issue } = VB['sim/commands'];
const R = VB['sim/records'];
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const SEASON = SEASON_DAYS * DAY;
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
// Aged as each case needs: daughters 2 (21), 4 (20), 5 (19); sons 8 (22) and 10 (20); 9 young.
function world() {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 2 }, { at: [11, 2], farms: 1 }], { seed: 7 });
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
  VB['sim/heirs'].refreshRoles(st);
  seedAsking(st); // the ages were changed after the state was seeded
  return st;
}
const entry = (st, id) => st.asking.find((e) => e.pawn === id);
// The clock run on until just past time t (each asking due by then held by its entry of the calendar)
const until = (st, t) => VB.sim.advance(st, Math.ceil((t - st.t) * 10 + 1) / 10);
const onItsDay = (id, t) => Math.abs(((((t - ASK.hour) % SEASON) + SEASON) % SEASON) - (id % SEASON_DAYS) * DAY) < 1e-6;

// 1. The queue: one entry each who seeks or will, on its own day of the season at ASK.hour; a child's at the first after its 18th birthday
{
  const st = world();
  sound(st, 'seeded');
  for (const e of st.asking) assert.ok(onItsDay(e.pawn, e.t), `pawn ${e.pawn}: due ${e.t}, on its day`);
  for (const id of [2, 4, 5, 8, 10]) {
    const e = entry(st, id);
    assert.ok(e && e.t > st.t && e.t <= st.t + SEASON, `pawn ${id} seeks: within the season`);
  }
  const child = st.pawns[9],
    grown = child.born + 18 * YEAR;
  assert.ok(entry(st, 9).t >= grown && entry(st, 9).t < grown + SEASON, 'the child: at its coming of age');
  assert.ok(!entry(st, 0) && !entry(st, 6), 'the married holders seek nothing');
  // the asking day: taken from the head, and written for the next season
  const t8 = entry(st, 8).t;
  until(st, t8);
  assert.strictEqual(entry(st, 8).t, t8 + SEASON, 'asked, and due again a season on');
  assert.ok(st.asking[0].t > st.t, 'nothing due is left at the head');
  // a death drops the entry, and writes the widowed spouse's
  assert.ok(!entry(st, 1), 'the holder of household 0 is married');
  VB['sim/lifecycle'].killPawn(st, 0);
  assert.ok(!entry(st, 0) && entry(st, 1) && onItsDay(1, entry(st, 1).t), 'the widow seeks, on her own day');
  sound(st, 'after the askings and a death');
}

// 2. An asking makes the offer of its best open rung, due at the round; no second offer while it is open
{
  const st = world();
  st.rng.society.fix = 0.1;
  assert.strictEqual(askFor(st, 8), 'match', 'a man of age asks a match');
  const o = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(o && o.basis === 'match' && o.gives.man === 8 && o.round === true, 'his spokesman offered him');
  assert.strictEqual(o.due, dueRound(st), 'due at the moving round');
  assert.ok(o.answers.every((a) => a.yes === null), 'nobody answers before the round');
  delete st.rng.society.fix;
  sound(st, 'an offer made at an asking');
  const n = st.offers.length;
  assert.strictEqual(askFor(st, 8), 'held', 'holding an open offer, he asks nothing');
  assert.strictEqual(st.offers.length, n, 'no second offer');
}

// 3. Caps: a woman asked by ASK.held open matches is asked by no more (the next asker turns to his next best); at most ASK.pool
// candidates are weighed at one asking
{
  const st = world();
  const her = 2,
    fake = [];
  for (let k = 0; k < ASK.held; k++)
    fake.push({ id: 1000 + k, basis: 'match', gives: { man: -1, home: 0 }, wants: { woman: her }, answers: [] });
  st.offers.push(...fake); // the count of those asking her is all that is read
  const why = issue(st, {
    actor: 6,
    verb: 'offer',
    target: 0,
    args: { basis: 'match', gives: { man: 8, home: 1 }, wants: { woman: her }, due: dueRound(st), round: true },
    source: 'asking',
  });
  assert.ok(typeof why === 'string' && /asked by 5/.test(why), `a sixth is refused: ${why}`);
  const w0 = VB.count.asksWeighed;
  const r = askMatch(st, 8, dueRound(st));
  const o = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(r !== 'made' || o.wants.woman !== her, `he turns to another: ${r}`);
  assert.ok(VB.count.asksWeighed - w0 <= ASK.pool, 'at most ASK.pool weighed');
  // the rule: only her
  for (const x of fake) st.offers.splice(st.offers.indexOf(x), 1);
  if (o) VB['sim/offers'].conclude(st, o, 'the test');
  assert.strictEqual(askMatch(st, 8, dueRound(st), { only: her }), 'made', 'asked by fewer, she may be asked');
}

// 4. A lapse: the one asked marries another; the offer lapses at the asker's next asking, and he asks again on his day after
{
  const st = world();
  st.rng.society.fix = 0.1;
  assert.strictEqual(askFor(st, 8), 'match');
  const o = st.offers.find((x) => x.id === st.pawns[8].ask),
    her = o.wants.woman;
  delete st.rng.society.fix;
  assert.strictEqual(
    issue(st, { actor: 10, verb: 'marry', target: her, args: { home: 1 }, source: 'debug' }),
    true,
    'she marries his brother',
  );
  until(st, entry(st, 8).t);
  assert.ok(!st.offers.includes(o), 'his offer lapsed');
  assert.strictEqual(st.pawns[8].ask, null, 'his ask is cleared');
  assert.ok(entry(st, 8).t > st.t, 'he asks again on his next day');
  sound(st, 'after the lapse');
}

// 5. The played pawn: its match is asked as any pawn's (VB-693), by its spokesman or by itself, unless it wishes not this year
{
  const st = world();
  st.rng.society.fix = 0.1;
  assert.strictEqual(VB.sim.inhabit(st, 8), true);
  assert.strictEqual(st.player && st.player.pawn, 8, 'the player plays the son');
  const spoken = R.spokesmanOf(st, 8);
  assert.strictEqual(askFor(st, 8), 'match', `his match is asked, by pawn ${spoken}`);
  const mine = st.offers.find((x) => x.id === st.pawns[8].ask);
  assert.ok(mine.answers.every((a) => a.yes === null), 'and the player answers it, as the others, by the round');
  VB['sim/offers'].conclude(st, mine, 'the test');
  VB.sim.wish(st, st.player.pawn, 'match', false);
  assert.notStrictEqual(askFor(st, 8), 'match', 'not this year: no match is asked for him');
  VB.sim.wish(st, st.player.pawn, 'match', null);
  assert.strictEqual(VB.sim.inhabit(st, 6), true);
  assert.strictEqual(askFor(st, 8), 'match', 'his spokesman played: the match is asked, and the player answers for his side');
  delete st.rng.society.fix;
  sound(st, 'the played pawn');
}
console.log('asking: the queue and its days, an offer a seeker, the caps, a lapse, the played pawn');
