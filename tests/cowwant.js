// A cow for a household with a meadow and none (VB-390): the want of its standing plan, met by a deal with a household of its village that
// spares one (booked as goodwill) or by a heifer from kin at a marriage (not booked); the animal moves only when a member has walked to the
// giver's byre and led it home (the kind `lead`). On the small deliberate village of tests/lib/probe.js; the state invariants hold.
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/herds'], X = VB['sim/exchange'], M = VB['sim/meadows'];
const { balance } = VB['sim/relations'], { checkState } = require('./lib/invariants.js'), { state } = require('./lib/probe.js');
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('COWWANT FAIL:', m); } };
const cowsOf = (st, hh) => H.herdsOf(st, hh).reduce((n, hd) => n + (hd.species === 'cattle' ? hd.head.length : 0), 0);
// a household with no meadow and no cattle, and a neighbour of its village that keeps two cows or more and the bull, as the probe's seeding
// gives them (VB-100: the herds drawn at seeding moved with the customs' draws; household 2 and 3 were the pair before)
function pair(st) {
  const villageOf = (hh) => st.farmsteads[hh.farmstead].village;
  for (const b of st.households) {
    if (st.farmsteads[b.farmstead].meadows.length || cowsOf(st, b)) continue;
    const s = st.households.find((h) => h !== b && villageOf(h) === villageOf(b) && cowsOf(st, h) >= 2 &&
      H.herdOf(st, h, 'cattle').head.some((x) => x.kind === 'bull'));
    if (s) return [b, s, st.households.find((h) => villageOf(h) !== villageOf(b))];
  }
  throw new Error('cowwant: the probe has no household without cattle beside one with a bull');
}
function setUp() {
  const st = state(), [buyer, seller, away] = pair(st), f = st.farmsteads[buyer.farmstead];
  check(!X.cowWanted(st, buyer), 'no meadow: no cow wanted');
  M.addMeadow(st, f, buyer, M.chooseMeadow(st, f));
  seller.hay = 200; // enough to spare a cow and its winter's hay, and grain for an allowance over a cow's worth
  VB['sim/stores'].put(st, seller, VB['sim/stores'].grainGood('barley'), 100, 'harvest');
  return { st, buyer, seller, away, plan: st.plans.households.get(buyer.id) };
}
// lead the want home: advance past the stall (spring day 5) hour by hour until the buyer has cattle; the lead job is seen claimed first
function leadHome(st, buyer) {
  let claimed = false;
  for (let h = 0; h < 24 * 20 && !cowsOf(st, buyer); h++) {
    for (const j of st.jobs.values()) if (j.kind === 'lead' && j.owner.id === buyer.id && j.claims.length) claimed = true;
    Sim.advance(st, 1);
  }
  return claimed;
}

{ // a deal: the want, its giver, the cow led home, its worth booked as goodwill, the want met
  const { st, buyer, seller, plan } = setUp();
  check(X.cowWanted(st, buyer), 'two hands and a meadow, no cattle: a cow wanted');
  X.reviewWant(st, plan, buyer, 'store');
  check(plan.want && plan.want.from === null, `a review out of turn makes the want but seeks no deal: ${JSON.stringify(plan.want)}`);
  X.reviewWant(st, plan, buyer, 'day');
  // the seller spares a cow, or its heifer where it keeps one (the probe's seller keeps one since VB-100's draws)
  const kind = H.herdOf(st, seller, 'cattle').head.some((h) => h.kind === 'heifer') ? 'heifer' : 'cow';
  check(plan.want.from === seller.id && plan.want.kind === kind && plan.want.by === 'deal', `the deal: ${JSON.stringify(plan.want)}`);
  check(leadHome(st, buyer), 'the lead job was taken before the cow came');
  check(H.herdOf(st, buyer, 'cattle').head.map((h) => h.kind).join() === kind, `the ${kind} is home`);
  check(H.herdOf(st, seller, 'cattle').head.some((h) => h.kind === 'cow'), 'the seller keeps a cow');
  check(!plan.want, 'the want is met');
  check(balance(st, seller.holder, buyer.holder) > 0, 'the cow is booked as goodwill the buyer owes');
  check(!checkState(st).length, 'deal: ' + checkState(st).slice(0, 3).join('; '));
}
{ // a seller that cannot spare: no deal; a lone hand: no want
  const { st, buyer, seller, plan } = setUp();
  seller.hay = 0;
  X.reviewWant(st, plan, buyer, 'day');
  check(plan.want && plan.want.from === null, `no hay to spare: the want stays open (${JSON.stringify(plan.want)})`);
  seller.hay = 200;
  VB['sim/stores'].take(st, seller, VB['sim/stores'].grainGood('barley'), 100, 'harvest');
  X.reviewWant(st, plan, buyer, 'day');
  check(plan.want && plan.want.from === null, `an allowance under a cow's worth: no deal (${JSON.stringify(plan.want)})`);
  for (const id of buyer.members) if (id !== buyer.holder) st.pawns[id].retired = true;
  X.reviewWant(st, plan, buyer, 'day');
  check(!plan.want, 'one hand: the want is dropped');
}
{ // a marriage: kin's heifer as a start in life, not booked
  const { st, buyer, seller, away, plan } = setUp();
  H.addHead(st, H.herdOf(st, seller, 'cattle'), 'f', st.t - 2 * Sim.YEAR, 'heifer');
  check(!X.startInLife(st, buyer, away), 'a household of another village gives no heifer');
  check(X.startInLife(st, buyer, seller), 'the neighbour spares a heifer');
  check(plan.want.kind === 'heifer' && plan.want.by === 'kin', `start in life: ${JSON.stringify(plan.want)}`);
  check(leadHome(st, buyer), 'the lead job was taken before the heifer came');
  check(H.herdOf(st, buyer, 'cattle').head.some((h) => h.kind === 'heifer'), 'the heifer is home');
  check(balance(st, seller.holder, buyer.holder) <= 0, 'a start in life is not booked');
  check(!checkState(st).length, 'start in life: ' + checkState(st).slice(0, 3).join('; '));
}

if (failed) process.exit(1);
console.log('cowwant ok');
