// The supply outlook (VB-666; sim/outlook, Sim.supplyOutlook): how long food, fuel and hay last, in seasons from the start of the season we
// are in, on the probe's small village with its stores set by hand: a year's food and a month's; fuel that lasts the summer and not the
// winter; hay for half a winter with meadows still to mow; the outlook made at the review, made again when a harvest stacked wakes it,
// read as stale in a later season, kept by a save; what a household with no plan, no herds or no farm reads.
const VB = require('../src/load.js'), Sim = VB.sim;
const { DAY, YEAR, SEASON_DAYS, TICKS, HERD, FIELDS, CROPS, cal } = VB['sim/rules'];
const O = VB['sim/outlook'], { OUTLOOK, FRAME, reckon } = O;
const Stores = VB['sim/stores'], P = VB['sim/plans'], H = VB['sim/herds'], M = VB['sim/meadows'];
const { dailyNeed, seedPer } = VB['sim/hunger'];
const { hands } = VB['sim/targets'];
const { checkState } = require('./lib/invariants.js');
const probe = require('./lib/probe.js');
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('OUTLOOK FAIL:', m); } };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
const at = (st, t) => { st.tick = Math.round(t * TICKS); st.t = st.tick / TICKS; };
const empty = (hh) => { hh.grain = {}; hh.meals = 0; hh.flour = 0; hh.larder = []; hh.fresh = []; hh.unthreshed = []; hh.wood = 0; hh.peat = 0; hh.hay = 0; };

const st = probe.state(3);
st.naturalDeaths = false;
at(st, YEAR + 8); // year 1, spring, day 0 of the season, 08:00
const c = cal(st.t), [h0, h1] = st.villages[0].farmsteads.map((f) => st.households[st.farmsteads[f].household]);
const p0 = st.plans.households.get(h0.id), p1 = st.plans.households.get(h1.id), f0 = st.farmsteads[h0.farmstead];
for (const hh of [h0, h1]) empty(hh);
check(Sim.supplyOutlook(st, h0.id) === null, 'before the first review, no outlook');
check(Sim.supplyOutlook(st, 999) === null, 'no plan, no outlook');

// food: h0 holds a year's need and more above the seed, h1 a month's (a season of twelve days)
const D0 = dailyNeed(st, h0), D1 = dailyNeed(st, h1);
h0.grain = { barley: Stores.reserved(st, h0, 'grain') + D0 * SEASON_DAYS * 4 * 1.2 };
h1.grain = { barley: Stores.reserved(st, h1, 'grain') + D1 * SEASON_DAYS * 1.1 };
let o0 = reckon(st, h0, p0), o1 = reckon(st, h1, p1);
check(o0.food.own === FRAME && o0.food.state === 'safe' && o0.food.season === null, `a year's food lasts the frame: ${JSON.stringify(o0.food)}`);
check(o1.food.own > 1 && o1.food.own < 1.1, `a month's food lasts a season and a little, less what spoils: ${o1.food.own}`);
check(o1.food.season === 1 && o1.food.state === 'bad', `short badly in the summer, before the harvest: ${JSON.stringify(o1.food)}`);
check(near(o1.food.parts.need[0], D1 * SEASON_DAYS, 0.1) && o1.food.parts.spoilt > 0, `a season's need and the grain spoiling: ${JSON.stringify(o1.food.parts)}`);
// the crop expected: each stubble field sown in spring's window and in by autumn, FIELDS.expect of the yield less the seed taken back
const crop = o1.food.parts.intakes.find((x) => x.what === 'barley');
const fields1 = st.farmsteads[h1.farmstead].fields.filter((fd) => fd.stage === 'stubble').length;
check(crop && crop.season === Math.floor((CROPS.barley.sow[1] + CROPS.barley.ripe) / SEASON_DAYS) &&
  near(crop.n, fields1 * (FIELDS.expect * CROPS.barley.yield - seedPer(st, h1)), 0.1), `the crop expected ${JSON.stringify(crop)} of ${fields1} fields`);
check(o1.food.with === o1.food.own, `the crop to come does not reach the summer: ${o1.food.with}`);

// fuel: a pile that burns through spring, summer and autumn and half the winter, with no goal to cut towards
const use = st.ECON.woodUse, goal = p0.targets.wood.slice();
h0.wood = SEASON_DAYS * (use[0] + use[1] + use[2] + use[3] * 0.55);
p0.targets.wood = [0, 0, 0, 0];
o0 = reckon(st, h0, p0);
check(near(o0.fuel.own, 3.55) && o0.fuel.with === o0.fuel.own, `fuel lasts the summer and not the winter: ${JSON.stringify(o0.fuel)}`);
check(o0.fuel.state === 'short' && o0.fuel.season === 3, `short a little in the winter (half its need, at OUTLOOK.little ${OUTLOOK.little})`);
check(near(o0.fuel.parts.need[3], use[3] * SEASON_DAYS, 0.1) && near(o0.fuel.parts.need[1], use[1] * SEASON_DAYS, 0.1), 'a winter season costs several summers');
// the plan's goal brings wood in, at most the trips the hands allow in a season
h0.wood = 0;
p0.targets.wood = [1000, 1000, 1000, 1000];
const v0 = st.villages[0], trees = v0.wood;
check(reckon(st, h0, p0).fuel.parts.intakes.length === 0, 'no wood in the village, none cut');
v0.wood = [f0.house]; // a wood to cut in, for this reckoning
o0 = reckon(st, h0, p0);
v0.wood = trees;
const cap = hands(st, h0) * OUTLOOK.woodTrips * st.ECON.woodPerTrip, cut = o0.fuel.parts.intakes.find((x) => x.season === 0);
check(o0.fuel.own === 0 && cut && near(cut.n, cap, 0.1), `the season's cut bounded by the hands: ${JSON.stringify(cut)} against ${cap}`);
p0.targets.wood = goal;

// hay: no herds, nothing needed
check(!h0.herds.length && o0.hay.state === 'none' && o0.hay.own === FRAME && o0.hay.seasons.join() === '3', `no herds: ${JSON.stringify(o0.hay)}`);
// two cows on h0, past the stall (spring day 6), hay for about half a winter and two meadows still to mow
at(st, YEAR + 6 * DAY + 8);
const herd = H.makeHerd(st, h0, 'cattle');
for (let k = 0; k < 2; k++) H.addHead(st, herd, 'f', st.t - 5 * YEAR, 'cow');
const W = H.winterNeed(st, h0);
h0.hay = 0.6 * W;
for (let k = 0; k < 2; k++) M.addMeadow(st, f0, h0, M.chooseMeadow(st, f0));
o0 = reckon(st, h0, p0);
check(W > 0 && o0.hay.own > 3 && o0.hay.own < 3.6, `hay for half a winter, less what spoils: ${JSON.stringify(o0.hay)}`);
const meadows = f0.meadows;
f0.meadows = [];
const bare = reckon(st, h0, p0).hay;
f0.meadows = meadows;
check(bare.with === o0.hay.own && bare.season === 3 && bare.state === (bare.with - 3 >= OUTLOOK.little ? 'short' : 'bad'), `without meadows, short in the winter: ${JSON.stringify(bare)}`);
const mow = o0.hay.parts.intakes.find((x) => x.what === 'meadows');
check(mow && mow.season === 1 && near(mow.n, Math.min(M.expectedHay(f0), p0.targets.hayWinters * W - h0.hay), 0.1), `the meadows mown in summer: ${JSON.stringify(mow)}`);
check(o0.hay.with === FRAME && o0.hay.state === 'safe', `with the meadows, the winter is covered: ${JSON.stringify(o0.hay)}`);

// no farm: the store alone, no crop and no wood cut
const away = reckon(st, { ...h0, farmstead: null }, p0);
check(!away.food.parts.intakes.length && !away.fuel.parts.intakes.length && !away.hay.parts.intakes.length, 'no farm, no intakes');

// the review keeps it in the plan; the page's read is a copy, the head's, and not stale in its season
P.reviewed(st, p0, cal(st.t));
let seen = Sim.supplyOutlook(st, h0.id);
check(p0.outlook && seen && !seen.stale && seen.head === p0.head.pawn && seen.day === cal(st.t).day, `made at the review: ${JSON.stringify(seen && { day: seen.day, head: seen.head })}`);
seen.food.own = -1;
check(p0.outlook.food.own !== -1, 'the read is a copy');
// a harvest stacked in an empty barn wakes the review, which makes the outlook again
h0.grain = { barley: Stores.reserved(st, h0, 'grain') };
P.reviewed(st, p0, cal(st.t));
const before = p0.outlook.food.parts.store;
at(st, YEAR + 7 * DAY + 7);
Stores.sheaf(st, h0, 100);
check(p0.dirty, 'the sheaves woke the plan');
Sim.advance(st, 3);
check(p0.outlook.day === 7 + 48 && near(p0.outlook.food.parts.store - before, 100, 2), `made again with the sheaves: ${before} → ${p0.outlook.food.parts.store}`);
// a save keeps it
const back = Sim.load(probe.world(), JSON.parse(JSON.stringify(Sim.save(st))));
check(JSON.stringify(back.plans.households.get(h0.id).outlook) === JSON.stringify(p0.outlook), 'a save keeps the outlook');
// the state's invariants, the outlook's among them, after the run's hours (before the clock is set by hand again)
const bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
// read in a later season it is stale, until the season's first review
at(st, YEAR + SEASON_DAYS * DAY + 6);
check(Sim.supplyOutlook(st, h0.id).stale, 'stale in the next season');
P.reviewed(st, p0, cal(st.t));
check(!Sim.supplyOutlook(st, h0.id).stale && p0.outlook.season === 1, 'made anew at its first review');
// the village store's outlook (VB-966): computed when asked, shaped as a household's, with its target, and whose estimate it is
{
  const v = st.villages[0], need = [h0, h1].reduce((n, hh) => n + dailyNeed(st, hh), 0), before = JSON.stringify(st.villages[0].grain);
  v.grain = { barley: need * SEASON_DAYS * 2 };
  const V = Sim.villageOutlook(st, 0, null);
  check(V.village && !V.stale && V.head !== null && st.pawns[V.head].alive, `the village's outlook names a living pawn: ${V.head}`);
  check(V.food.state !== 'safe' && V.food.own === V.food.with && V.food.own > 1.5 && V.food.own < 2, `two seasons of grain, a little spoiled: ${V.food.own}`);
  check(near(V.food.parts.target, need * 0.5 * VB['sim/rules'].YEAR_DAYS, 0.2), `the target is half a year's need: ${V.food.parts.target}`);
  check(V.fuel.state === 'none' && V.hay.state === 'none', 'a store holds no fuel or hay');
  check(JSON.stringify(Sim.villageOutlook(st, 0, h0.holder)) !== undefined && Sim.villageOutlook(st, 0, h1.holder).head === h1.holder, "the viewer's estimate when given");
  v.grain = JSON.parse(before);
}
if (failed) process.exit(1);
console.log('outlook ok: a year\'s food and a month\'s; fuel for the summer, not the winter; hay for half a winter and the meadows to mow; review, wake, save, stale');
