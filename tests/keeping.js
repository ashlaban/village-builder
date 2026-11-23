// One keeping rule a good (VB-683): each stored good is lost by its row of sim/goods' keeping, alike in every store that holds it. Grain
// by tiers of a year's need (a household's), the village's store flat at ECON.villageStoreTier; hay by tiers of its herds' winter; the
// larder's lots and the fresh batches by their food's days; the larder's takes, losses and salting in the ledger as the grain's are.
const VB = require('../src/load.js'), Sim = VB.sim, Goods = VB['sim/goods'];
const { FOODS, ECON, HERD, DAY, YEAR_DAYS } = VB['sim/rules'];
const { addFood } = VB['sim/larder'], { feedHousehold } = VB['sim/hunger'], Byre = VB['sim/byre'];
const { moveClock } = require('./lib/clock.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('KEEPING FAIL:', m); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const { island, ROOMY } = require('./lib/probe.js'), world7 = island(7, ROOMY);
const daily = (s) => 1 - Math.pow(1 - s, 1 / YEAR_DAYS);

// --- the table: every food, the hay, the ale and the stores that never spoil have a row
for (const id of [...Object.keys(FOODS).filter((f) => FOODS[f].held !== 'grain'), 'grain', 'hay', 'ale', 'meals', 'flour', 'rack', 'stake'])
  check(!!Goods.keepingOf(id), `${id}: a keeping row`);
for (const id of ['meals', 'flour', 'rack', 'stake']) check(typeof Goods.keepingOf(id).never === 'string', `${id}: never lost, the reason told`);
for (const id of Object.keys(FOODS)) if (FOODS[id].keeps !== null) check(Goods.keepsDays(id) === FOODS[id].keeps, `${id}: its FOODS days`);
check(Goods.goodOf('butter').perish.keepsDays === FOODS.butter.keeps && Goods.goodOf('grain').perish.tiers === true, "the goods' perish is the row");

// --- the tiers: a household's grain by its year of need, the village's flat at its tier, hay by winters
{
  const st = Sim.seed(world7, 7, 'founders'), L = ECON.storeLoss, year = 300;
  check(near(Goods.dayLoss(st, 'grain', 200, year), 200 * daily(L[0])), 'under a year held: the first tier');
  check(near(Goods.dayLoss(st, 'grain', 800, year), 300 * daily(L[0]) + 300 * daily(L[1]) + 200 * daily(L[2])), 'three tiers');
  check(near(Goods.dayLoss(st, 'grain', 800, Infinity, ECON.villageStoreTier), 800 * daily(0.2)), 'the village store: a fifth a year, flat');
  check(Goods.dayLoss(st, 'grain', 0, year) === 0, 'nothing held, nothing lost');
  check(near(Goods.dayLoss(st, 'hay', 500, 200), 200 * daily(HERD.hayLoss[0]) + 200 * daily(HERD.hayLoss[1]) + 100 * daily(HERD.hayLoss[2])), 'hay');
}

// --- the larder: a lot spoils on its food's day, its loss in the ledger; what is eaten from it and what is salted is booked too
{
  const st = Sim.seed(world7, 7, 'founders'), hh = st.households[0];
  hh.larder = [];
  const sum = (kind, good) => hh.totals.filter((x) => x.kind === kind && x.good === good).reduce((s, x) => s + x.n, 0);
  addFood(st, hh, 'milk', 5);
  check(hh.larder[0].until === st.t + FOODS.milk.keeps * DAY, 'a lot spoils by its food’s days');
  moveClock(st, (FOODS.milk.keeps + 1) * DAY);
  const milk0 = sum('spoilage', 'milk');
  Byre.byreDay(st, Sim.cal(st.t));
  check(hh.larder.length === 0 && near(sum('spoilage', 'milk') - milk0, -5), `the spoilt milk booked (${sum('spoilage', 'milk') - milk0})`);
  addFood(st, hh, 'meat', 4);
  hh.salt = 4 * Sim.HERD.saltPerRation; // the salt for 4 rations (VB-700)
  Byre.saltDone(st, hh);
  check(near(sum('salting', 'meat'), -4) && near(sum('salting', 'salt meat'), 4), 'salting: out of meat, into salt meat');
  check(hh.larder.length === 1 && hh.larder[0].kind === 'salt meat' && hh.larder[0].until === st.t + FOODS['salt meat'].keeps * DAY, 'salt meat keeps');
  hh.meals = 0; hh.fresh = []; hh.flour = 0; hh.grain = {}; // nothing else to eat: the salt meat is eaten
  const eaten0 = sum('meal', 'salt meat');
  feedHousehold(st, hh);
  const eaten = eaten0 - sum('meal', 'salt meat');
  check(eaten > 0 && near(eaten, 4 - (hh.larder[0] ? hh.larder[0].n : 0)), `eaten from the larder, booked as a meal (${eaten})`);
  const bad = checkState(st);
  check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
}

if (failed) { console.error(`keeping: ${failed} failed`); process.exit(1); }
console.log('keeping: ok');
