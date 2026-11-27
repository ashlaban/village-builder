// A marriage's terms (VB-276; sim/terms), on a constructed state (tests/lib/tiny.js): the offer carries its terms {dowry, gift}, the
// defaults by the valuation; an unplayed spokesman's range; the asking side's own terms; the close leads and lays the dowry and books it
// as an advance, subtracted at the next division; the morning gift becomes the widow's and goes with her; the head's match for a member.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { DAY, YEAR, SEASON_DAYS, ASK } = VB['sim/rules'];
const { roundPhase } = VB['sim/round'];
const { VILLAGE_STEPS } = VB['sim/occasions'];
const { issue } = VB['sim/commands'];
const Terms = VB['sim/terms'],
  Stores = VB['sim/stores'],
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
// Village 0: household 0 (holder 0, daughters 2 to 5), household 1 (holder 6, children 8 to 10); village 1, household 2.
function world() {
  const st = tinyState(
    tinyWorld(map),
    [
      { at: [3, 5], farms: 2, sizes: [6, 5] },
      { at: [11, 2], farms: 1, sizes: [4] },
    ],
    { seed: 982 },
  );
  for (const [id, y] of [
    [2, 21],
    [4, 20],
    [5, 19],
    [8, 22],
    [10, 20],
  ]) {
    st.pawns[id].born = st.t - y * YEAR - DAY;
    st.pawns[id].age = y;
  }
  for (const h of st.households) h.grain.barley += 2000;
  // the custom fixed, so that every check below runs: her share is half a son's, and the farm is bought out (shares paid)
  const C = VB['sim/customs'];
  for (const [key, v] of [
    ['heirCount', 'buyout'],
    ['daughterShare', 'half'],
  ]) {
    const k = C.IDX[key];
    for (const s of st.cenv.settlements) s.practice[k] = C.DIMS[k].opts.findIndex((o) => o[0] === v);
  }
  VB['sim/heirs'].refreshRoles(st);
  return st;
}
const roundNoon = (st) => {
  const y = Math.floor(st.t / YEAR) * YEAR,
    t = y + (2 * SEASON_DAYS + ASK.day) * DAY + 12;
  return t > st.t ? t : t + YEAR;
};
const offer = (st, due, terms, actor = 6, target = 0) =>
  issue(st, {
    actor,
    verb: 'offer',
    target,
    args: {
      basis: 'match',
      gives: { man: 8, home: 1 },
      wants: { woman: 2 },
      due,
      round: true,
      ...(terms ? { terms } : {}),
    },
    source: 'player',
  });

// 1. The defaults: half her share of her house's movable worth, and the lesser of a cow's worth and a tenth of his house's
{
  const st = world();
  const n0 = VB.count.termsValued,
    d = Terms.defaults(st, 8, 2, 1);
  assert.strictEqual(VB.count.termsValued - n0, 2, 'one valuation of each of the two households');
  // half the share the division would pay her that day: sim/heirs transfer's own reckoning, on a copy
  const st2 = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st)))),
    before = st2.pawns[2].stake || 0;
  VB['sim/heirs'].transfer(st2, st2.households[0], 4, 'retirement');
  const due = (st2.pawns[2].stake || 0) - before;
  assert.ok(due > 0, `the division pays her a share (${due})`);
  assert.ok(Math.abs(d.dowry - due / 2) <= 1, `the dowry is half her share that day: ${d.dowry} of ${due}`);
  assert.strictEqual(
    d.gift,
    Math.round(Math.min(40, Terms.movableWorth(st, st.households[1]) / 10)),
    'the morning gift',
  );
  assert.ok(d.dowry > 0 && d.gift === 40, `both given here: ${JSON.stringify(d)}`);
  assert.strictEqual(Terms.defaults(st, 8, 2, 0).dowry, 0, 'no dowry where she stays at home');
}

// 2. The offer carries its terms; the side that asks sets its own; an unplayed spokesman says yes within half to twice the defaults
{
  const st = world(),
    due = roundNoon(st),
    d = Terms.defaults(st, 8, 2, 1);
  const n0 = VB.count.termsValued;
  assert.strictEqual(offer(st, due), true);
  assert.strictEqual(
    VB.count.termsValued - n0,
    2,
    'an offer values the two households once, not at its check and again at its run',
  );
  assert.deepStrictEqual(st.offers[0].terms, d, 'the defaults, valued once');
  assert.strictEqual(st.offers[0].set, undefined, "the asking side's own terms are not kept beside the terms");
  assert.strictEqual(st.offers[0].norms, undefined, 'no norms beside the defaults');
  assert.ok(Terms.fair(st.offers[0]), 'the defaults are fair');
  st.offers.length = 0;
  st.pawns[8].ask = null;
  assert.strictEqual(typeof offer(st, due, { dowry: 5 }), 'string', "the man's side sets only the morning gift");
  assert.strictEqual(offer(st, due, { gift: 70 }), true);
  const o = st.offers[0];
  assert.deepStrictEqual([o.terms.gift, o.norms.gift], [70, 40], 'its own gift, the defaults kept beside it');
  assert.ok(Terms.fair(o), 'within twice the default');
  o.terms.gift = 90;
  assert.ok(!Terms.fair(o), 'beyond twice it, no');
  o.terms.gift = 15;
  assert.ok(!Terms.fair(o), 'below half, no');
}

// 3. The close: the dowry from her house, laid and borne, booked as an advance; the gift booked to her. The next division subtracts
// the advance. The widow's gift is hers, and goes with her.
{
  const st = world(),
    t = { dowry: 300, gift: 40 },
    g0 = Stores.grainOf(st.households[0]),
    g1 = Stores.grainOf(st.households[1]);
  assert.strictEqual(issue(st, { actor: 8, verb: 'marry', target: 2, args: { home: 1 }, source: 'debug' }), true);
  Terms.settle(st, 8, 2, t, 0);
  const paid = g0 - Stores.grainOf(st.households[0]);
  assert.ok(paid > 0 && paid <= 300, `the dowry left her house: ${paid}`);
  assert.deepStrictEqual(st.pawns[2].advance, { household: 0, n: paid }, 'an advance on her share');
  assert.strictEqual(st.pawns[2].morningGift, 40, 'the morning gift is booked to her');
  assert.ok(
    Stores.grainOf(st.households[1]) <= g1 + 1e-9,
    'nothing teleported in: the grain lies at her old house, to be borne',
  );
  sound(st, 'after the close');
  // the division: daughters 2 and 5 weigh alike; 2's share is less by her advance
  const shares = {};
  const rec = VB['sim/heirs'];
  const g = (q) => st.pawns[q].stake || 0;
  const s0 = { 2: g(2), 5: g(5) };
  rec.transfer(st, st.households[0], 4, 'retirement');
  for (const q of [2, 5]) shares[q] = g(q) - s0[q];
  assert.ok(shares[5] > paid, `a share for her sister (${shares[5]})`);
  assert.ok(Math.abs(shares[5] - shares[2] - paid) <= 1, `less by the advance: ${JSON.stringify(shares)}`);
  assert.strictEqual(st.pawns[2].advance, undefined, 'the advance is spent');
  // widowed: her gift is hers, and goes with her when she moves
  VB['sim/lifecycle'].killPawn(st, 8, 'killed');
  assert.deepStrictEqual(
    st.pawns[2].dower,
    { household: 1, n: 40 },
    'the widow holds her gift, owed by the house she was widowed in',
  );
  assert.strictEqual(st.pawns[2].morningGift, undefined, 'no longer a gift booked');
  const h1 = Stores.grainOf(st.households[1]);
  assert.strictEqual(
    issue(st, { actor: 2, verb: 'move', target: 0, args: { reason: 'home' }, source: 'succession' }),
    true,
  );
  assert.strictEqual(st.pawns[2].household, 0, 'she moved home');
  assert.strictEqual(st.pawns[2].dower, undefined, 'she took it with her');
  assert.ok(Stores.grainOf(st.households[1]) < h1, 'from the house she left');
  sound(st, 'after the widow moved');
}

// 4. The head's match for a member: a wish as the pawn's own, with its terms, offered at the round by the head
{
  const st = world();
  assert.strictEqual(Sim.inhabit(st, 0), true);
  assert.strictEqual(
    typeof Sim.wish(st, st.player.pawn, 'match', 8, { for: 2, terms: { gift: 5 } }),
    'string',
    'her side gives the dowry',
  );
  assert.strictEqual(typeof Sim.wish(st, st.player.pawn, 'match', 8, { for: 6 }), 'string', 'only for one it speaks for');
  assert.strictEqual(Sim.wish(st, st.player.pawn, 'match', 8, { for: 2, terms: { dowry: 200 } }), true);
  assert.deepStrictEqual(
    st.pawns[0].proposal,
    { for: 2, partner: 8, terms: { dowry: 200 } },
    'on the pawn, as any pawn could hold',
  );
  assert.strictEqual(st.player.proposal, undefined, 'the player frame holds none');
  const now = roundNoon(st);
  for (let n = 0; n < VILLAGE_STEPS; n++) roundPhase(st, n, 0, now);
  const o = st.offers.find((x) => x.basis === 'match' && x.wants.woman === 2);
  assert.strictEqual(o, undefined, 'answered at once by the unplayed side');
  assert.strictEqual(R.spouseOf(st, 2), 8, 'married at the round');
  const adv = st.pawns[2].advance;
  assert.ok(
    adv && adv.household === 0 && adv.n > 0 && adv.n <= 200,
    `the dowry the head set, given: ${JSON.stringify(adv)}`,
  );
  assert.strictEqual(st.pawns[0].proposal, undefined, 'the proposal ends with the marriage');
  // an unplayed spokesman's proposal, written on the pawn, is offered the same way
  const st3 = world();
  st3.pawns[6].proposal = { for: 8, partner: 2, terms: null };
  const now3 = roundNoon(st3);
  for (let n = 0; n < VILLAGE_STEPS; n++) roundPhase(st3, n, 0, now3);
  assert.ok(
    R.spouseOf(st3, 8) === 2 || st3.offers.some((x) => x.basis === 'match' && x.from === 6 && x.gives.man === 8),
    "an unplayed head's match for his son is offered at the round",
  );
}
// 5. A widow's dower when her household dissolves: paid her from its grain before the estate is taken; no later household owes it;
// her death ends it
{
  const st = world();
  assert.strictEqual(issue(st, { actor: 8, verb: 'marry', target: 2, args: { home: 1 }, source: 'debug' }), true);
  Terms.settle(st, 8, 2, { dowry: 0, gift: 40 }, 0);
  VB['sim/lifecycle'].killPawn(st, 8, 'killed');
  assert.deepStrictEqual(st.pawns[2].dower, { household: 1, n: 40 });
  const hh = st.households[1],
    held = st.pawns[2].stake || 0;
  Terms.dissolving(st, hh);
  assert.strictEqual(st.pawns[2].dower, undefined, 'paid as the house breaks up');
  assert.strictEqual((st.pawns[2].stake || 0) - held, 40, 'into her own hands');
  st.pawns[2].dower = { household: 0, n: 10 };
  VB['sim/lifecycle'].killPawn(st, 2, 'killed');
  assert.strictEqual(st.pawns[2].dower, undefined, 'her death ends it');
  sound(st, 'after the dower');
}

console.log('terms ok');
