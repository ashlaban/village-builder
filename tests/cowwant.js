// A cow for a household with a meadow and none (VB-390): the want of its standing plan, met by a deal with a household of its village that
// spares one (booked as goodwill) or by a heifer from kin at a marriage (not booked); the animal moves only when a member has walked to the
// giver's byre and led it home (the kind `lead`). On the small deliberate village of tests/lib/probe.js; the state invariants hold.
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/herds'], X = VB['sim/exchange'], M = VB['sim/meadows'];
const { balance } = VB['sim/relations'], { checkState } = require('./lib/invariants.js'), { state } = require('./lib/probe.js');
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('COWWANT FAIL:', m); } };
const cowsOf = (st, hh) => H.herdsOf(st, hh).reduce((n, hd) => n + (hd.species === 'cattle' ? hd.head.length : 0), 0);
// household 2 of village 1 has no meadow and no cattle; household 3, its neighbour, keeps two cows and a bull
function setUp() {
  const st = state(), buyer = st.households[2], seller = st.households[3], f = st.farmsteads[buyer.farmstead];
  check(!X.cowWanted(st, buyer), 'no meadow: no cow wanted');
  M.addMeadow(st, f, buyer, M.chooseMeadow(st, f));
  seller.hay = 200; // enough to spare a cow and its winter's hay, and grain for an allowance over a cow's worth
  VB['sim/stores'].put(st, seller, VB['sim/stores'].grainGood('barley'), 100, 'harvest');
  return { st, buyer, seller, plan: st.plans.households.get(buyer.id) };
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
  check(plan.want.from === seller.id && plan.want.kind === 'cow' && plan.want.by === 'deal', `the deal: ${JSON.stringify(plan.want)}`);
  check(leadHome(st, buyer), 'the lead job was taken before the cow came');
  check(H.herdOf(st, buyer, 'cattle').head.map((h) => h.kind).join() === 'cow', 'the cow is home');
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
  const { st, buyer, seller, plan } = setUp();
  H.addHead(st, H.herdOf(st, seller, 'cattle'), 'f', st.t - 2 * Sim.YEAR, 'heifer');
  check(!X.startInLife(st, buyer, st.households[1]), 'a household of another village gives no heifer');
  check(X.startInLife(st, buyer, seller), 'the neighbour spares a heifer');
  check(plan.want.kind === 'heifer' && plan.want.by === 'kin', `start in life: ${JSON.stringify(plan.want)}`);
  check(leadHome(st, buyer), 'the lead job was taken before the heifer came');
  check(H.herdOf(st, buyer, 'cattle').head.some((h) => h.kind === 'heifer'), 'the heifer is home');
  check(balance(st, seller.holder, buyer.holder) <= 0, 'a start in life is not booked');
  check(!checkState(st).length, 'start in life: ' + checkState(st).slice(0, 3).join('; '));
}
{ // a first meadow (VB-428): two hands, no herd, no meadow: the land step starts one; one hand, or a meadow already: none
  const st = state(), hh = st.households[2], f = st.farmsteads[hh.farmstead];
  check(!hh.herds.length && !f.meadows.length, 'the probe household has no herd and no meadow');
  const p = M.startMeadow(st, f, hh);
  check(p && p.what === 'meadow', 'two hands, no herd, no meadow: a first meadow is started');
  const lone = state(), lh = lone.households[2];
  for (const id of lh.members) if (id !== lh.holder) lone.pawns[id].retired = true;
  check(!M.startMeadow(lone, lone.farmsteads[lh.farmstead], lh), 'one hand: no first meadow');
}

if (failed) process.exit(1);
console.log('cowwant ok');
