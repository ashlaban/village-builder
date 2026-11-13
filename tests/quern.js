// The hand quern (VB-009, sim/quern; design.md, Milling at home and The quern): a household grinds grain to flour at home, 1 work hour for
// 4 grain on sandstone, a fifth slower on granite, while it holds grain above its seed reserve and less than 10 days of flour; the cook puts
// flour in the pot at 1:1 and grain unground at 1.25 a ration, so the same grain feeds a household about 25% longer with a quern; a quern
// wears out 20 years after it was made, read from when it was made; a new one is wanted 2 years before and hewn in winter (at once with
// none) from a load of the heap, where the village's ground is sandstone or granite; the start's households have one; the quern is a good.
const VB = require('../src/load.js'), Stores = VB['sim/stores'], Pot = VB['sim/pot'], Q = VB['sim/quern'];
const { YEAR, DAY, ECON, FOODS, ROLES } = VB['sim/rules'], { dailyNeed, feedHousehold, seedReserve } = VB['sim/hunger'];
const { KINDS, ASK } = VB['sim/kinds'], Culture = VB['culture'], { ROCK } = VB['gen/geology'];
const { state } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('QUERN FAIL:', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const { QUERN } = Q;

// --- the numbers, the kinds and the roles
check(QUERN.years === 20 && QUERN.renewYears === 2 && QUERN.granite === 0.8 && QUERN.perHour === 4 && QUERN.flourDays === 10 && QUERN.hewHours === 12,
  'a quern lasts 20 years, wanted 2 before; granite 0.8; 4 grain an hour; 10 days of flour; 12 hours to hew');
check(ECON.unground === 1.25 && near(FOODS.grain.worth, 0.8) && FOODS.flour.worth === 1 && FOODS.flour.source === 'grain', 'grain 1.25 a ration unground; flour 1:1, one source with grain');
check(KINDS.grind && KINDS.grind.inside && KINDS.grind.type === 'household' && KINDS.hewQuern && KINDS.hewQuern.hours === 12, 'the two kinds');
check(ASK.farmAfterPlans.some((e) => e[0] === 'grind') && ASK.farmAfterPlans.some((e) => e[0] === 'hewQuern'), 'both asked at the farm');
const pr = (role) => ROLES[role].prio.grind;
check(pr('wife') === 7 && pr('maid') === 7 && pr('daughter') === 6 && pr('retired') === 3 && pr('farmer') === 1 && pr('son') === 1 && pr('farmhand') === 1,
  'grinding: mistress and maid 7, daughter 6, retired 3, others 1');
check(Culture.norm('worth', 'quern') === 25 && Stores.GOODS.get('quern').class === 'wares', 'the quern is a good of 25 rations');

// --- a household of the start has a quern of granite (no ground layers here); the start's are of every age below 16 years
{
  const st = state(), live = st.households.filter((h) => !h.dissolved);
  check(live.every((h) => h.quern && h.quern.rock === 'granite' && h.flour === 0 && Q.quernOf(st, h)), 'each household of the start has a working quern, no flour');
  check(new Set(live.map((h) => h.quern.made)).size === live.length, 'of different ages');
  const bad = checkState(st);
  check(!bad.length, 'invariants at the start: ' + bad.slice(0, 3).join('; '));
}

// a household with its fields growing (no seed held back), no larder, fresh food or meals, and `grain` barley
function home(grain) {
  const st = state(), hh = st.households[0], f = st.farmsteads[hh.farmstead];
  for (const fd of f.fields) fd.stage = 'growing';
  VB['sim/plans'].dropAll(st, 'household', hh.id);
  hh.larder = []; hh.fresh = []; hh.meals = 0; hh.grain = { barley: grain }; hh.hungryDays = 0; hh.cookDay = -1;
  return { st, hh, f };
}
const posts = (st, hh, f, kind, c = { season: 0, sday: 3, day: 3, hour: 10 }) => {
  const out = [];
  KINDS[kind].available(st, hh, f, c, (key, site, extra) => out.push({ key, site, ...extra }));
  return out;
};

// --- grinding: posted while there is grain above the reserve and flour below 10 days; a job grinds 8 grain to 8 flour; slower on granite
{
  const { st, hh, f } = home(200), need = dailyNeed(st, hh);
  hh.quern.rock = 'sandstone';
  let p = posts(st, hh, f, 'grind');
  check(p.length === 1 && p[0].key === `grind:h${hh.id}` && p[0].site === f.house && p[0].hours === undefined, 'grind posted at the house, 2 hours on sandstone');
  hh.quern.rock = 'granite';
  p = posts(st, hh, f, 'grind');
  check(p.length === 1 && near(p[0].hours, QUERN.grindHours / 0.8), `on granite a fifth slower: ${p[0] && p[0].hours} hours`);
  KINDS.grind.done(st, {}, hh);
  check(near(hh.flour, 8) && near(Stores.grainOf(hh), 192), `a job: 8 grain to 8 flour (${hh.flour}, ${Stores.grainOf(hh)})`);
  const t = hh.totals.find((x) => x.kind === 'grind' && x.good === 'flour');
  check(t && near(t.n, 8), 'through the ledger, as a routine kind');
  hh.flour = QUERN.flourDays * need; // lint-allow: owner a test's store
  check(posts(st, hh, f, 'grind').length === 0, 'not with 10 days of flour');
  hh.flour = 0;
  hh.grain = { barley: 0 };
  check(posts(st, hh, f, 'grind').length === 0, 'not without grain above the reserve');
  hh.grain = { barley: 200 }; hh.quern = null;
  check(posts(st, hh, f, 'grind').length === 0, 'not without a quern');
}

// --- the same grain feeds a household about 25% longer with a quern than without
function days(quern) {
  const { st, hh } = home(300);
  if (!quern) hh.quern = null;
  let d = 0;
  for (; d < 400 && hh.hungryDays === 0; d++) {
    if (Q.quernOf(st, hh)) while (Q.flourWanted(st, hh)) if (!(Q.ground(st, hh) > 0)) break;
    Pot.cookMeal(st, hh, dailyNeed(st, hh));
    feedHousehold(st, hh);
    st.t += DAY;
  }
  return d;
}
{
  const withQ = days(true), without = days(false), ratio = withQ / without;
  check(ratio > 1.2 && ratio < 1.3, `300 grain: ${withQ} days with a quern, ${without} without (${ratio.toFixed(2)})`);
}

// --- the cook: flour first at 1:1, then grain unground
{
  const { st, hh } = home(100), need = dailyNeed(st, hh);
  Stores.put(st, hh, 'flour', need / 2, 'grind');
  Pot.cookMeal(st, hh, need);
  check(near(hh.meals, need) && near(hh.flour, 0) && near(Stores.grainOf(hh), 100 - (need / 2) * 1.25), `half flour, half grain: ${hh.meals} meals, ${Stores.grainOf(hh)} grain`);
  hh.meals = 0;
  Stores.put(st, hh, 'flour', need, 'grind');
  feedHousehold(st, hh); // no meals: flour eaten as grain is, uncooked
  check(hh.hungryDays === 0 && near(hh.flour, 0) && near(Stores.grainOf(hh), 100 - (need / 2) * 1.25 - (need / ECON.uncooked - need)),
    `no meals: flour first, then grain, at the uncooked rate (${hh.flour}, ${Stores.grainOf(hh)})`);
}

// --- wear and want: read from when it was made
{
  const { st, hh, f } = home(100);
  hh.quern = { rock: 'granite', made: st.t - 17 * YEAR }; // lint-allow: owner a test's quern
  check(Q.quernOf(st, hh) && !Q.wanted(st, hh) && near(Q.yearsLeft(st, hh), 3), '17 years old: works, not yet wanted, 3 years left');
  hh.quern.made = st.t - 18.5 * YEAR;
  check(Q.quernOf(st, hh) && Q.wanted(st, hh), '18.5 years old: works, and a new one is wanted');
  hh.stone = 1; // lint-allow: owner a test's heap
  check(posts(st, hh, f, 'hewQuern').length === 0, 'with a working quern, not hewn but in winter');
  check(posts(st, hh, f, 'hewQuern', { season: 3, sday: 2, day: 38, hour: 10 }).length === 1, 'hewn in winter');
  hh.quern.made = st.t - 20 * YEAR;
  check(!Q.quernOf(st, hh) && Q.yearsLeft(st, hh) === 0 && posts(st, hh, f, 'grind').length === 0, '20 years old: worn out, nothing ground');
  check(posts(st, hh, f, 'hewQuern').length === 1, 'none working: hewn at once');
  KINDS.hewQuern.done(st, {}, hh);
  check(hh.quern.made === st.t && hh.quern.rock === 'granite' && hh.stone === 0 && Q.quernOf(st, hh), 'hewn: a new granite quern, the load off the heap');
  check(hh.ledger.some((e) => e.kind === 'quern' && e.good === 'stone' && e.n === -1), 'the load through the ledger');
  hh.quern = null; hh.stone = 0;
  check(Q.wantsStone(st, hh) && posts(st, hh, f, 'hewQuern').length === 0, 'no load on the heap: not hewn, the stone wanted');
  // on limestone the quern cannot be hewn
  st.w.rock = new Uint8Array(st.w.N).fill(ROCK.LIMESTONE);
  hh.stone = 1;
  check(!Q.canHew(st, hh) && !Q.wantsStone(st, hh) && posts(st, hh, f, 'hewQuern').length === 0, 'on limestone: none hewn');
  st.w.rock.fill(ROCK.SANDSTONE);
  check(posts(st, hh, f, 'hewQuern').length === 1, 'on sandstone: hewn');
  KINDS.hewQuern.done(st, {}, hh);
  check(hh.quern.rock === 'sandstone', 'of sandstone');
  const bad = checkState(st);
  check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
}

// --- a few days run: households grind, cook flour, keep their invariants
{
  const st = state(), Sim = VB.sim;
  Sim.advance(st, 6 * DAY);
  const live = st.households.filter((h) => !h.dissolved);
  check(live.some((h) => h.flour > 0) && live.every((h) => h.hungryDays === 0), `6 days: flour ${live.map((h) => Math.round(h.flour)).join(', ')}, none hungry`);
  check(live.some((h) => h.totals.some((x) => x.kind === 'cooking' && x.good === 'flour')), 'flour cooked');
  const bad = checkState(st);
  check(!bad.length, 'invariants after 6 days: ' + bad.slice(0, 3).join('; '));
}
if (failed) { console.error(`quern: ${failed} failed`); process.exit(1); }
console.log('quern ok');
