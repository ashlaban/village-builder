// Salt (VB-700, sim/saltpan): boiled at a salt spring within 12 walking steps, a boiling of 10 hours by one hand giving 10 measures, its
// wood a tree of the spring's tile or a neighbour's, the salt carried home into the household's store through the ledger (reason
// 'saltboil'); a household with animals keeps a boiling's worth by default (its head's target); the spring does not run out. The salting
// (sim/byre) takes HERD.saltPerRation a ration of meat; the meat it has no salt for is smoked and keeps HERD.smokeDays, not a year.
// Populous at seed 8 on the small island of tests/lib/probe.js, a spring laid by hand beside a household's house.
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), Geo = VB['gen/geology'], S = VB['sim/saltpan'];
const trip = require('./lib/trip.js');
const { KINDS, ASK } = VB['sim/kinds'], { DAY, HERD, FOODS } = VB['sim/rules'], Byre = VB['sim/byre'], L = VB['sim/larder'];
const Targets = VB['sim/targets'], Goods = VB['sim/goods'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SALT FAIL:', m); } };
const { SALT } = S, { DEPOSIT, ENDLESS } = VB['world/geology'], SEED = 8;

// --- the kind, the good and the food
const K = KINDS.boilsalt;
check(K && K.type === 'upkeep' && K.hands === 1 && K.hours === SALT.hours && VB['sim/doing'].lookOf('boilsalt') && VB['sim/doing'].carriesTo('boilsalt') === 'store', 'boilsalt: upkeep, 1 hand, carried home');
check(ASK.farmAfterPlans.some((e) => e[0] === 'boilsalt'), 'boilsalt is asked at the farm');
const G = Goods.goodOf('salt');
check(G.class === 'wares' && G.unit === 'measure' && G.quantum === 10 && G.weight === 1 && G.perish === null && G.keeping, 'salt: a keeping good of the fair, a sack of 10 measures');
check(FOODS['smoked meat'].keeps === HERD.smokeDays && HERD.smokeDays < HERD.saltDays && FOODS['smoked meat'].source === 'meat', 'smoked meat keeps less than salt meat');

// --- a spring beside a household's house
const w = island(SEED), live0 = Sim.seed(w, SEED, 'populous');
const hh0 = live0.liveHouseholds.map((id) => live0.households[id]).find((h) => h.herds.length && h.farmstead !== null);
const f0 = live0.farmsteads[hh0.farmstead];
const { dist } = VB['sim/hex'].bfs(w, f0.house, 4, (j) => VB['sim/walking'].passable(w, j));
const spring = [...dist].find(([i, d]) => d >= 2 && !w.water[i] && live0.owner[i] === 0 && w.deposit[i] === DEPOSIT.NONE)?.[0] ??
  [...dist].find(([i, d]) => d >= 1 && !w.water[i] && w.deposit[i] === DEPOSIT.NONE)[0];
Geo.setDeposit(w, spring, DEPOSIT.SALT);
check(w.depositLeft[spring] === ENDLESS, 'a spring laid by hand does not run out');
w.trees[spring] = Math.max(w.trees[spring], 3);
const st = Sim.seed(w, SEED, 'populous'), hh = st.households[hh0.id], f = st.farmsteads[hh.farmstead];
const posts = () => { const out = []; K.available(st, hh, f, { season: 1 }, (key, site, extra) => out.push({ key, site, ...extra })); return out; };
check(Targets.target(st, hh, 'salt') === SALT.stock, `a household with animals keeps ${SALT.stock} measures by default`);
let p = posts();
check(p.length === 1 && p[0].site === spring && p[0].key === `boilsalt:h${hh.id}` && p[0].farm === f, `the job is at the spring: ${JSON.stringify(p.map((q) => q.site))}`);
check(p.length === 1 && (p[0].fuel === spring || w.nb.slice(spring * 6, spring * 6 + 6).includes(p[0].fuel)) && w.trees[p[0].fuel] > 0, 'its wood is by the spring');
const out = []; K.available(st, hh, f, { season: 3 }, (k) => out.push(k));
check(out.length === 0, 'no boiling in winter');
// the search is kept
VB.count.saltGround = 0; posts(); posts();
check(VB.count.saltGround === 0, `asked again, the household searched ${VB.count.saltGround} tiles`);
// a boiling carried home: the tree felled, the salt in the store through the ledger, the spring as it was
if (p.length) {
  const trees = w.trees[p[0].fuel], j = { kind: 'boilsalt', site: spring, fuel: p[0].fuel, farm: f, owner: { type: 'household', id: hh.id } };
  st.t += DAY; const got = trip(K, st, j, hh, f);
  check(got === SALT.yield && hh.salt === SALT.yield, `a boiling gives ${hh.salt} measures`);
  check(w.trees[p[0].fuel] < trees, 'the boiling burnt a tree');
  check(w.depositLeft[spring] === ENDLESS, 'the spring flows on');
  const e = hh.ledger[hh.ledger.length - 1];
  check(e.kind === 'saltboil' && e.good === 'salt' && e.n === SALT.yield, `through the ledger: ${JSON.stringify(e)}`);
  check(posts().length === 0, 'at its target the household posts no boiling');
  check(trip(K, st, j, hh, f) === SALT.yield && hh.salt === 2 * SALT.yield, 'a boiling carried home at the target is put still: the salt in hand is a good (VB-1748)');
}
// --- the need term: a measure short of the target is worth the good's worth a measure, a measure beyond it nothing
{ const Rules = VB['sim/registry'], need = (n) => Rules.value(st, 'need', { hh, good: G, n, kept: 0 }), was = hh.salt;
  hh.salt = SALT.stock - 2; check(Math.abs(need(1) - 2) < 1e-9 && Math.abs(need(5) - 4) < 1e-9, `short of the target: ${need(1)}, ${need(5)}`);
  hh.salt = SALT.stock; check(need(1) === 0, 'at the target a measure is worth nothing by need');
  check(VB['sim/fair'].FAIR.goods.includes('salt'), 'salt is a good of the fair');
  hh.salt = was; }
// --- the salting: by the salt held, HERD.saltPerRation a ration; the rest smoked
hh.larder = []; hh.salt = 3;
L.addFood(st, hh, 'meat', 50);
Byre.saltDone(st, hh);
const salted = L.larderOf(hh, 'salt meat'), smoked = L.larderOf(hh, 'smoked meat');
check(Math.abs(salted - 3 / HERD.saltPerRation) < 1e-9 && Math.abs(smoked - (50 - salted)) < 1e-9 && L.larderOf(hh, 'meat') === 0,
  `3 measures salt ${salted} of 50 rations, ${smoked} smoked`);
check(Math.abs(hh.salt) < 1e-9, `the salt is used up: ${hh.salt} left`);
const lot = hh.larder.find((l) => l.kind === 'smoked meat');
check(lot && Math.abs(lot.until - (st.t + HERD.smokeDays * DAY)) < 1e-6, 'smoked meat keeps smokeDays');
hh.larder = []; delete hh.salt; L.addFood(st, hh, 'meat', 10); Byre.saltDone(st, hh);
check(L.larderOf(hh, 'smoked meat') === 10 && L.larderOf(hh, 'salt meat') === 0, 'with no salt, all the meat is smoked');
{ const bad = checkState(st).filter((m) => /salt|smoked|larder|ledger/.test(m)); check(bad.length === 0, 'invariants: ' + bad.slice(0, 3).join('; ')); }
// a household with no spring in reach: nothing posted, searched once a year
const far = st.liveHouseholds.map((id) => st.households[id]).find((h) => {
  const g = st.farmsteads[h.farmstead]; return g && VB['sim/hex'].hexSteps(w, g.house, spring) > SALT.reach + 2;
});
if (far) {
  const g = st.farmsteads[far.farmstead], o = []; far.saltAt = undefined;
  K.available(st, far, g, { season: 1 }, (k) => o.push(k));
  check(o.length === 0 && far.saltAt && far.saltAt.tile === -1, 'no spring in reach: no job');
}
// --- half a year: the state keeps its invariants
Sim.advance(st, 0.5 * Sim.YEAR);
{ const bad = checkState(st); check(bad.length === 0, 'half a year: ' + bad.slice(0, 3).join('; ')); }
if (failed) { console.error(`saltpan: ${failed} failed`); process.exit(1); }
console.log(`saltpan ok: spring at ${spring}, ${hh.salt ?? 0} measures held after half a year by household ${hh.id}`);
