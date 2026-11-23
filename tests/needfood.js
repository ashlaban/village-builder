// VB-1549: a household out of food seeks it before work whose payoff is months away (sim/hunger spareUrgency; MATCH.urgency need,
// needDays): with no spare food its holder's fit for fishing is above his fit for ploughing at its most pressing and for a low
// woodpile; with food in store, below; the urgency falls in a line with the days of food, with no step at needDays.
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { MATCH } = VB['sim/roles'];
const Jobs = VB['sim/jobs'],
  Stores = VB['sim/stores'],
  { spareDays, spareUrgency } = VB['sim/hunger'];
const { cal } = VB['sim/rules'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('NEEDFOOD FAIL:', m);
  }
};
const U = MATCH.urgency;
const st = tinyState(
  tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(14))),
  [{ at: [6, 5], farms: 4, sizes: [1, 2, 3, 4] }],
  { seed: 7 },
);
const hh = st.households.find((h) => h.members.some((m) => st.pawns[m].role === 'wife')),
  holder = st.pawns[hh.holder],
  f = st.farmsteads[hh.farmstead],
  own = { type: 'household', id: hh.id };
// fishing and ploughing at the house (no walk); ploughing at its most pressing, late in its window, is the plough's fit at
// urgency 1 + 11 / fieldPerDay, worked out from the farmer's rank as the score would (the window's day is the calendar's)
const fish = Jobs.post(st, `fish:h${hh.id}:test`, 'fish', own, f.house, { farm: f });
const fitOf = (j) => VB['sim/fit'].score(st, holder, j, cal(st.t), undefined, 0);
const plowRank = VB['sim/roles'].ROLES.farmer.ranks[0].plow,
  woodRank = VB['sim/roles'].ROLES.farmer.ranks[0].wood,
  plowTop = plowRank * (U.field + 11 / U.fieldPerDay),
  woodLow = woodRank * U.woodLowUrgency;
// a test's writes: the household's food emptied (grain, flour, meals, fresh food)
const empty = () => {
  const g = Stores.grainOf(hh);
  if (g > 0) Stores.take(st, hh, 'grain', g, 'meal');
  hh.flour = 0;
  hh.meals = 0;
  hh.fresh = [];
};
empty();
check(spareDays(st, hh) === 0, `no spare food (${spareDays(st, hh)} days)`);
check(Math.abs(spareUrgency(st, fish, U) - U.need) < 1e-9, `at none, fishing's urgency is the need's ${U.need}`);
check(fitOf(fish) > plowTop, `with no food, fishing ${fitOf(fish)} above ploughing at its most pressing ${plowTop}`);
check(fitOf(fish) > woodLow, `with no food, fishing ${fitOf(fish)} above a low woodpile ${woodLow}`);
// a line in the days of food: half the need at half needDays (the lean slope below it), the lean curve's from needDays on
const need = VB['sim/hunger'].dailyNeed(st, hh);
const at = (d) => {
  empty();
  if (d > 0) Stores.put(st, hh, 'flour', d * need, 'grind');
  return spareUrgency(st, fish, U);
};
const lean = (d) => U.fishLean - ((U.fishLean - U.fishCalm) * d) / U.fishCalmDays;
check(Math.abs(at(U.needDays / 2) - Math.max(lean(U.needDays / 2), U.need / 2)) < 1e-9, 'half the need at half needDays');
check(Math.abs(at(U.needDays) - lean(U.needDays)) < 1e-9, 'at needDays, the lean curve: no step');
// food in store: a season's need; fishing falls below the ploughing and the woodpile
at(30);
check(
  fitOf(fish) < plowRank * U.field && fitOf(fish) < woodLow,
  `with food in store, fishing ${fitOf(fish)} below ploughing ${plowRank * U.field} and the woodpile ${woodLow}`,
);
if (failed) process.exit(1);
console.log(
  `needfood ok: with no food the holder fishes (${(VB['sim/roles'].ROLES.farmer.ranks[0].fish * U.need).toFixed(1)}) before ploughing (${plowTop.toFixed(1)}); with food, after`,
);
