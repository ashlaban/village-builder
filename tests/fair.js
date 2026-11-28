// @suite integration
// VB-302: the fair. At a gathering, each household's dealer carries its margin as a load (packed from the store through sim/stores, a back
// load less room for what it takes) and swaps it in whole quanta with the dealers it meets there: an offer on the basis `swap`, weighed by
// need and a deal's allowance (goodwill and opinion: near zero between strangers), settled by the verb `swap`, the residual in customary
// worth booked between the two who dealt. The fair's log line counts the deals, what changed hands, those that failed for want of change
// and the hard bargains; the dealers carry what they hold home, and the goods are conserved.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const Gt = VB['sim/gathering'], F = VB['sim/fair'], Stores = VB['sim/stores'], Rules = VB['sim/registry'], { issue } = VB['sim/commands'];
const { DAY, WORK, TRAVEL } = VB['sim/rules'], { balance } = VB['sim/relations'];
const issues = (st) => checkState(st).filter((x) => /fair|gathering|away/.test(x));

// four villages of two farms in a row, as tests/going.js: the grain villages (0 and 2) hold far beyond two years' need, the others little
// grain and tar and hides to spare
const XS = [4, 30, 56, 82];
const st = tinyState(tinyWorld(Array(12).fill('.'.repeat(110)), { seed: 7 }), XS.map((x) => ({ at: [x, 5], farms: 2, sizes: [6, 5] })), { seed: 7 });
const start = Gt.whenHeld(st, 0, 1)[0], end = start + 3 * DAY;
Sim.advance(st, start - 2 * DAY - st.t);
const hhOf = (v) => st.villages[v].farmsteads.map((f) => st.households[st.farmsteads[f].household]);
for (let v = 0; v < 4; v++)
  for (const hh of hhOf(v)) {
    Stores.put(st, hh, 'grain', v % 2 ? 60 : 900, { kind: 'harvest' }, { barley: v % 2 ? 60 : 900 });
    if (v % 2) {
      Stores.put(st, hh, 'tar', 3, { kind: 'harvest' });
      Stores.put(st, hh, 'hide', 2, { kind: 'harvest' });
    }
  }
const before = new Map(st.households.map((hh) => [hh.id, [Stores.grainOf(hh), hh.tar || 0, hh.hides || 0]]));

// the day before: each household's dealer has packed its margin, within a back load less a sack's room, through the stores
Sim.advance(st, start - DAY + WORK[0] + 13 - st.t);
assert.ok(st.fair && st.fair.loads.length >= 6, `${st.fair && st.fair.loads.length} dealers loaded`);
const dealers = st.fair.loads.slice();
const eve = JSON.stringify(Sim.save(st)); // VB-1776's twins, below
for (const id of dealers) {
  const l = st.pawns[id].load, hh = st.households[l.household];
  assert.strictEqual(st.pawns[id].household, hh.id, 'a dealer carries its own household\'s goods');
  assert.ok(hh.gathering.go[0] === id, 'the first goer deals');
  assert.ok(F.weight(l) <= TRAVEL.load - F.FAIR.room + 1e-9, `load ${F.weight(l)}`);
  const v = st.farmsteads[hh.farmstead].village;
  if (v % 2 === 0) assert.ok(F.held(l, 'grain') > 0 && !F.held(l, 'tar'), 'a grain village brings grain');
  else assert.ok(F.held(l, 'tar') > 0 && !F.held(l, 'grain'), 'a tar village brings tar, not the grain it needs');
  assert.ok((hh.ledger || []).some((e) => e.kind === 'fair' && e.n < 0), 'packed through the stores');
}
assert.deepStrictEqual(issues(st), []);

// the refusals: the verb settles only an offer; one's own household, one far away, a load beyond a back load
const [g0, t0] = [dealers.find((id) => F.held(st.pawns[id].load, 'grain') > 0), dealers.find((id) => F.held(st.pawns[id].load, 'tar') > 0)];
assert.match(String(issue(st, { actor: g0, verb: 'swap', target: t0, args: { gives: { good: 'grain', n: 1 }, wants: { good: 'tar', n: 1 } }, source: 'pawn' })), /settled from an offer/);
const far = st.agents[g0].occasion === null && st.agents[t0].occasion === null ? F.swapWhy(st, g0, t0, { good: 'grain', n: 1 }, { good: 'tar', n: 1 }) : null;
if (far !== null) assert.match(far, /not in one place|back load/);
// between strangers a deal's allowance is near zero; a gift's is the giver's grain above its floor
const ctx = { giver: g0, receiver: t0, from: st.households[st.pawns[g0].load.household], to: st.households[st.pawns[t0].load.household] };
const S1 = VB['sim/ties'].SOCIAL.standing, was = [st.pawns[g0].standing, st.pawns[t0].standing];
st.pawns[t0].standing = S1.base; // a stranger of a member's standing; above it, standing makes an opinion (VB-706)
assert.ok(Math.abs(Rules.value(st, 'dealAllowance', ctx)) < 1, `a deal's allowance between strangers: ${Rules.value(st, 'dealAllowance', ctx)}`);
assert.ok(Rules.value(st, 'allowance', ctx) > 100, "a gift's allowance is larger");
st.pawns[t0].standing = S1.base + 1; // a stranger of standing is thought well of, a swap with it is allowed more (VB-706)
assert.ok(Rules.value(st, 'dealAllowance', ctx) > 1, `standing allows a stranger more: ${Rules.value(st, 'dealAllowance', ctx)}`);
st.pawns[t0].standing = was[1];

// the first day at noon: the dealers stand on the green together and some have dealt
Sim.advance(st, start + 12 - st.t);
const day = st.occasions.find((o) => o.kind === 'gathering');
const here = dealers.filter((id) => st.agents[id].occasion === day.id);
assert.ok(here.length >= dealers.length * 0.6, `${here.length} of ${dealers.length} dealers on the green`);
assert.strictEqual(F.swapWhy(st, here[0], here[0], { good: 'grain', n: 1 }, { good: 'tar', n: 1 }) !== null, true);
assert.deepStrictEqual(issues(st), []);

// a swap offered to a played pawn that has not answered when the fair ends (VB-1598), on a copy of the run at the last day's close of
// dealing: when the host's dealer unpacks its load at home that night the offer lapses with it, and no deal is counted
{
  const c = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
  Sim.advance(c, start + 2 * DAY + F.FAIR.hours[1] - c.t);
  const villageOf = (id) => c.farmsteads[c.households[c.pawns[id].load.household].farmstead].village;
  const on = dealers.filter((id) => c.pawns[id].load && c.agents[id].occasion != null), swaps = () => c.offers.filter((o) => o.basis === 'swap');
  const to = on.find((id) => villageOf(id) === day.village);
  assert.ok(to !== undefined && swaps().length === 0, 'a dealer of the host is on the green, and no swap is open');
  Sim.inhabit(c, to);
  Sim.setAuto(c, to, false); // the player answers for it (VB-1776: on automatic, its pawn's judgement answers at once)
  let terms = null;
  for (const from of on)
    for (const g of F.FAIR.goods)
      for (const t of F.FAIR.goods) {
        const args = { basis: 'swap', gives: { good: g, n: 1 }, wants: { good: t, n: 1 } };
        if (!terms && issue(c, { actor: from, verb: 'offer', target: to, args, source: 'pawn' }) === true) terms = args;
      }
  const deals = c.fair.fairs[0].deals;
  assert.ok(terms && swaps().length === 1 && swaps()[0].to === to, 'the swap waits for the played pawn');
  assert.deepStrictEqual(checkState(c).filter((x) => /fair|offers\[/.test(x)), []);
  Sim.setAuto(c, to, true); // its own logic takes it home; the swap stays open, unanswered
  Sim.advance(c, end + 2 - c.t);
  assert.strictEqual(c.pawns[to].load, null, 'the fair is over: the dealer has unpacked');
  assert.deepStrictEqual(swaps(), [], 'no swap outlives its load');
  assert.strictEqual(c.fair.fairs[0].deals, deals, 'a lapsed swap is no deal');
  assert.ok(c.record.some((e) => e && e.kind === 'offerLapsed' && /^A swap of .* lapsed: the fair is over\.$/.test(e.text)), 'the lapse is told');
  assert.deepStrictEqual(checkState(c).filter((x) => /fair|offers\[/.test(x)), []);
}

// the played pawn proposes through the same verb, and its allowance does not bind it: it offers more than it gains, and the other
// takes it by its own need
const a = here.find((id) => F.held(st.pawns[id].load, 'grain') >= 20), b = here.find((id) => F.held(st.pawns[id].load, 'hide') >= 1 && st.pawns[id].load.household !== st.pawns[a].load.household);
if (a !== undefined && b !== undefined) {
  Sim.inhabit(st, a);
  // VB-303: what its swap dialog reads: both sides' goods in whole quanta at their customary worth, and the residual that would be booked
  const sides = Sim.fairSides(st, a), other = sides && sides.dealers.find((d) => d.id === b);
  assert.ok(sides && other && sides.mine.some((x) => x.good === 'grain' && x.n >= 2) && other.goods.some((x) => x.good === 'hide'), 'both sides shown');
  assert.ok(sides.dealers.every((d) => d.household !== st.pawns[a].load.household), 'not its own household');
  const shown = Sim.swapTerms(st, a, b, { good: 'grain', n: 2 }, { good: 'hide', n: 1 });
  assert.strictEqual(shown.why, null);
  assert.ok(shown.give > 0 && shown.get > 0, JSON.stringify(shown));
  const owedBefore = balance(st, a, b);
  assert.strictEqual(Sim.fairSides(st, st.pawns.find((q) => q.alive && !q.load).id), null, 'no load, no dialog');
  const terms = { basis: 'swap', gives: { good: 'grain', n: 2 }, wants: { good: 'hide', n: 1 } };
  assert.strictEqual(issue(st, { actor: a, verb: 'offer', target: b, args: terms, source: 'player' }), true);
  assert.ok(F.held(st.pawns[b].load, 'grain') >= 20, 'the other took the grain');
  assert.ok(balance(st, a, b) > 0, 'the residual is booked: the other owes the player');
  // F4 (review): the residual the dialog showed is what was booked, sign and all
  assert.ok(Math.abs(balance(st, a, b) - owedBefore - shown.residual) < 1e-6, `booked ${balance(st, a, b) - owedBefore}, shown ${shown.residual}`);
  assert.strictEqual(F.swapWarning(st, a, { good: 'grain', n: 1 }), null, 'a household far above its floor is not warned');
  Sim.uninhabit(st);
}

// after the last day: the fair is told, with its counts; two days on every dealer is home and its load in the store
Sim.advance(st, end + WORK[0] - st.t);
// the fair is told in the gathering's report (VB-303): it has no line of its own
assert.ok(!st.record.some((e) => e && e.kind === 'fair'), 'the fair is told once');
const line = st.record.find((e) => e && e.kind === 'gatheringHeld');
assert.ok(line, 'the fair is told');
const fair = st.fair.fairs.find((r) => r.year === 1);
assert.ok(fair.deals >= 3 && fair.proposals >= fair.deals, `deals ${fair.deals} of ${fair.proposals} proposals`);
assert.ok(fair.worth.grain > 0 && fair.worth.tar > 0, 'grain and tar changed hands');
assert.match(line.text, /deals? made.*failed for want of change.*hard/);
// VB-303: the gathering's report, in the log and the host's chronicle: who hosted, which villages came, cases and matches, the fair's deals
const told = st.record.find((e) => e && e.kind === 'gatheringHeld');
assert.ok(told, 'the gathering is reported');
assert.match(told.text, /^The gathering at .+ ends: hosted by .+, with .+; \d+ were there on its last day; at the fair \d+ came to deal, \d+ deals? made \(rations' worth: .*grain \d+.*\), \d+ failed for want of change, \d+ hard bargains?/);
assert.ok(!/border case|match/.test(told.text), 'no case or match is told until the gathering hears one (VB-297, VB-298)');
assert.ok(Sim.chronicle(st, { village: told.village }).some((r) => /hosted by/.test(r.text)), "in the host's chronicle");
assert.ok(st.record.filter((e) => e && e.kind === 'swap').length >= 2 * fair.deals - 2, 'each side records its deal');
assert.deepStrictEqual(issues(st), []);
Sim.advance(st, 2 * DAY);
assert.deepStrictEqual(st.fair.loads, [], 'every load is home');
for (const g in st.fair.goods) {
  const t = st.fair.goods[g];
  assert.ok(Math.abs(t.packed - t.home) < 1e-6 && t.lost === 0, `${g}: ${JSON.stringify(t)}`);
}
// the grain villages hold tar and hides now, which they had none of
let wares = 0;
for (const v of [0, 2]) for (const hh of hhOf(v)) wares += (hh.tar || 0) + (hh.hides || 0) - before.get(hh.id)[1] - before.get(hh.id)[2];
assert.ok(wares > 0, 'tar and hides went to the grain villages');
assert.deepStrictEqual(issues(st), []);
const { twins } = require('./lib/twins.js');
// VB-1776: on automatic with nothing queued, a played dealer deals through the fair's first day as the same dealer unplayed (its own
// proposals, and its answers at once: sim/fair dealHour, sim/offers make)
{
  const [a] = twins(() => Sim.load(st.w, JSON.parse(eve)), dealers[0], (c) => Sim.advance(c, start + F.FAIR.hours[1] - c.t), 'a fair day');
  assert.ok(a.fair.fairs[0].deals > 0, 'they dealt');
}
console.log(`fair: ok (${dealers.length} dealers, ${fair.deals} deals of ${fair.proposals} proposals, ${fair.noChange} for want of change, ${fair.hard} hard)`);
