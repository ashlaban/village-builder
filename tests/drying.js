// Dried fish and the fishing boat (VB-300): a village's reach to fishing water, tested again when it has a new farm; fishing for the drying
// rack from spring day 3 to the end of autumn while the household holds less dried fish than it wants (the winter pot's fish share, 0.8,
// of its need over the 14 days without fresh fish, in whole lots of 10; VB-388), one catch waiting at a time; the catch hung at the rack
// is dried fish in the larder, kept a year; out of the fishing season the cook puts dried fish in the pot for up to 0.8 of it (sim/pot,
// VB-119); the catch for the pot beyond what the household eats before it spoils laid by the rack (VB-388); fishing for the pot waits
// while fresh fish covers 2 days (VB-388); the boat: a project plan begun at spring day 3
// by a household by the sea or a large lake, its step waiting for 6 loads of timber felled in the village's wood, 20 hours of work,
// then twice the bank's catch from it. Founders at seed 7, a year and a half: dried fish made and eaten, boats built, invariants, a save.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Stores = VB['sim/stores'], D = VB['sim/drying'], Projects = VB['sim/projects'];
const { KINDS } = VB['sim/kinds'], { ROLES, FISH, DAY, YEAR_DAYS } = VB['sim/rules'], { dailyNeed, larderOf, feedHousehold } = VB['sim/hunger'];
const { boatYear } = D, { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('DRYING FAIL:', m); } };
const world = (seed, size = [180, 130]) => { const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (season, sday, hour = 8) => ({ season, sday, doy: season * 12 + sday, day: season * 12 + sday, hour });
const near = (a, b) => Math.abs(a - b) < 1e-6;
const posts = (st, kind, hh, f, c) => { const out = []; KINDS[kind].available(st, hh, f, c, (key, site, extra) => out.push({ key, site, ...extra }), f); return out; };

// --- the kinds
check(KINDS.rackfish && KINDS.dry && KINDS.boat && KINDS.boat.project, 'the kinds rackfish, dry and boat (a project\'s step)');
check(KINDS.rackfish.type === 'foraging' && KINDS.rackfish.carry && near(KINDS.rackfish.urgency(), 0.5), 'fishing for the rack: carried home, at 0.5');
check(KINDS.dry.hours === 1 && near(KINDS.dry.urgency(), 1.6) && KINDS.boat.hours === 20, 'hanging 1 hour at 1.6; the boat 20 hours');
check(ROLES.wife.prio.rackfish === ROLES.wife.work.foraging, 'roles rank fishing for the rack as foraging');

const st = Sim.seed(world(7), 7, 'founders'), w = st.w;
// --- the village's reach: tested once, kept, tested again for a new farm
const v = st.villages.find((x) => D.villageFishes(st, x));
check(!!v && v.fishing && v.fishing.farms === v.farmsteads.length && v.fishing.near, 'a founders village at seed 7 is by fishing water');
v.fishing.near = false; // the cached answer is read until the village has a new farm
check(!D.villageFishes(st, v), 'the reach test is kept, not run again');
v.fishing.farms--; check(D.villageFishes(st, v) && v.fishing.farms === v.farmsteads.length, 'a new farm: tested again');
const inland = { farmsteads: [], fishing: undefined };
check(!D.villageFishes(st, inland), 'a village with no house near water cannot make dried fish');

// --- drying: the season, the want, one catch at a time, the hanging
const f = st.farmsteads.find((x) => x.household !== null && x.village === v.id && D.fishingPlace(st, st.households[x.household], x));
const hh = st.households[f.household], need = dailyNeed(st, hh);
const want = Math.ceil(0.8 * need * (12 + FISH.from) / 10 - 1e-9) * 10;
check(D.wanted(st, hh) === want && want % 10 === 0 && want > 0, `wants ${D.wanted(st, hh)} rations of dried fish, not ${want}`);
check(posts(st, 'rackfish', hh, f, cal(0, 1)).length === 0 && posts(st, 'rackfish', hh, f, cal(3, 0)).length === 0
  && posts(st, 'rackfish', hh, f, cal(3, 3)).length === 0, 'no fishing for the rack before spring day 3, in winter');
const p = posts(st, 'rackfish', hh, f, cal(0, 2));
check(p.length === 1 && p[0].boat === false && posts(st, 'rackfish', hh, f, cal(1, 6)).length === 1 && posts(st, 'rackfish', hh, f, cal(2, 11)).length === 1,
  'one trip in the drying season, to the end of autumn, from the bank');
st.t = 2 * DAY;
const j = { ...p[0], owner: { type: 'household', id: hh.id } }, s0 = VB['sim/fish'].stock(st, j.water);
KINDS.rackfish.deliver(st, j, hh, f);
check(near(hh.rack, 4 * s0), `the catch waits by the rack: ${hh.rack}, not ${4 * s0}`);
check(posts(st, 'rackfish', hh, f, cal(0, 2)).length === 0 && posts(st, 'dry', hh, f, cal(0, 2)).length === 1, 'a catch waits: hang it, fish no more');
const lots = hh.larder.length, caught = hh.rack;
KINDS.dry.done(st, { farm: f, owner: j.owner }, hh, cal(0, 2));
const lot = hh.larder[hh.larder.length - 1];
check(hh.rack === 0 && hh.larder.length === lots + 1 && lot.kind === 'dried fish' && near(lot.n, caught) && lot.until === st.t + YEAR_DAYS * DAY,
  'hung: dried fish in the larder, kept a year');
check(hh.totals.some((x) => x.kind === 'drying' && x.good === 'dried fish' && near(x.n, caught)), 'the year\'s total of fish dried');
hh.larder.push({ kind: 'dried fish', n: want, until: st.t + YEAR_DAYS * DAY });
check(posts(st, 'rackfish', hh, f, cal(0, 3)).length === 0, 'enough dried fish in store: no more trips');

// --- the pot (sim/pot, VB-119): dried fish out of the fishing season, 0.8 of a pot of 2 sources (VB-388), none while fresh fish makes 0.8
const Pot = VB['sim/pot'], pot = (doy, want) => {
  st.t = doy * DAY + 15; hh.meals = 0; hh.grain = { barley: 1000 }; const held = larderOf(hh, 'dried fish'), k = Pot.pot(st, hh, want);
  return { k, dried: held - larderOf(hh, 'dried fish'), meals: hh.meals };
};
let r1 = pot(1 * 12 + 3, 8);
check(r1.dried === 0 && r1.k === 1 && near(r1.meals, 8), 'no dried fish in the pot in the fishing season');
r1 = pot(3 * 12 + 4, 8);
check(r1.k === 2 && near(r1.dried, 0.8 * 0.9 * 8) && near(r1.meals, 8), `in winter: 0.8 of a pot of 2 sources (${r1.dried}, ${r1.k})`);
r1 = pot(0 * 12 + 1, 4);
check(r1.k === 2 && near(r1.dried, 0.8 * 0.9 * 4), 'in spring under the ice too');
st.t = (3 * 12 + 5) * DAY + 15; Pot.putFresh(st, hh, 'fish', 0.8 * 0.9 * 8, 'catch');
r1 = pot(3 * 12 + 5, 8);
check(r1.dried === 0 && r1.k === 2 && near(r1.meals, 8), 'fresh fish 0.8 of the pot: no dried fish');

// --- the catch for the pot (VB-388): fishing waits while fresh fish covers 2 days; a catch beyond what is eaten before it spoils goes to the rack
{
  const s3 = Sim.seed(world(7), 7, 'founders'), h3 = s3.households[hh.id], f3 = s3.farmsteads[h3.farmstead], n3 = dailyNeed(s3, h3);
  s3.t = (12 + 3) * DAY + 8; h3.fresh = []; h3.larder = []; h3.rack = 0;
  check(posts(s3, 'fish', h3, f3, cal(1, 3)).length >= 1, 'no fresh fish: fishing for the pot is posted');
  Pot.putFresh(s3, h3, 'fish', 2 * n3, 'catch');
  check(posts(s3, 'fish', h3, f3, cal(1, 3)).length === 0, 'two days of fresh fish held: no fishing for the pot');
  check(posts(s3, 'rackfish', h3, f3, cal(1, 3)).length === 1, 'fishing for the rack is not held by it');
  const g3 = D.fishingPlace(s3, h3, f3), j3 = { farm: f3, water: g3.water, boat: g3.boat, owner: { type: 'household', id: h3.id } };
  Pot.putFresh(s3, h3, 'fish', 4 * n3, 'catch'); // six days of need held, and a catch on top
  KINDS.fish.deliver(s3, j3, h3, f3);
  const fresh3 = Pot.freshHeld(s3, h3, 'fish'), total = fresh3 + h3.rack, room = D.wanted(s3, h3);
  check(h3.rack > 0 && near(h3.rack, Math.min(room, total - 3 * n3)) && near(fresh3, total - h3.rack),
    `beyond 3 days of need to the rack: ${h3.rack} by the rack, ${fresh3} fresh, ${room} wanted`);
  const racked = h3.rack;
  s3.t += 2; KINDS.dry.done(s3, { farm: f3, owner: j3.owner }, h3, cal(1, 3));
  check(h3.rack === 0 && near(larderOf(h3, 'dried fish'), racked), 'hung: dried fish');
  const spoilt = () => h3.totals.filter((x) => x.kind === 'spoilage' && x.good === 'fish').reduce((a, x) => a - x.n, 0), sp0 = spoilt();
  h3.grain = { barley: 0 }; h3.meals = 0;
  for (let d = 0; d < 5; d++) { Pot.cookMeal(s3, h3, n3); feedHousehold(s3, h3); s3.t += DAY; }
  Pot.settle(s3, h3);
  check(near(spoilt(), sp0) && near(Pot.freshHeld(s3, h3, 'fish'), 0), `what was kept fresh is eaten before it spoils (${spoilt() - sp0} spoilt)`);
  s3.t = (3 * 12 + 1) * DAY + 8; h3.fresh = []; Pot.putFresh(s3, h3, 'fish', 10 * n3, 'catch'); const r0 = h3.rack;
  D.potCatch(s3, { water: g3.water, boat: false }, h3);
  check(h3.rack === r0, 'out of the drying season nothing goes to the rack');
}

// --- the boat: begun by a household by the sea, its timber, its work, its catch
const st2 = Sim.seed(world(7), 7, 'founders');
st2.t = FISH.from * DAY;
boatYear(st2);
let plan = null, bf = null;
Projects.forEach(st2, (x) => { if (!plan && x.what === 'boat') plan = x; });
check(!!plan, 'a founders household at seed 7 begins a boat');
if (plan) {
  const bh = st2.households[plan.holder.id], step = plan.steps[0];
  bf = st2.farmsteads[bh.farmstead];
  check(step.kind === 'boat' && step.hours === 20 && step.timber === 6 && step.wood === 0 && w.ocean[plan.water] !== undefined
    && st2.w.water[plan.water] === 1 && !Projects.supplied(step), 'one step at the shore, 20 hours, waiting for 6 loads of timber');
  const asked = []; VB['sim/building'].timberWork(st2, null, null, cal(0, 2), (key, site, extra, kind, owner) => asked.push({ key, kind, extra, owner }));
  const mine = asked.filter((a) => a.extra.timberFor === step);
  check(mine.length === 2 && mine.every((a) => a.kind === 'timber' && a.owner.id === bh.id && a.extra.dest === step.place), 'two timber trips at a time');
  const before = []; KINDS.clear.available(st2, bh, bf, cal(0, 2), (key, site, extra, kind) => before.push(kind), bf);
  check(!before.includes('boat'), 'the boat\'s work waits for its timber');
  step.wood = 6;
  const after = []; KINDS.clear.available(st2, bh, bf, cal(0, 2), (key, site, extra, kind) => after.push({ kind, site }), bf);
  check(after.length === 1 && after[0].kind === 'boat' && after[0].site === step.place, 'with its timber in, the boat\'s work is posted');
  st2.t += DAY;
  KINDS.boat.done(st2, { site: step.place, farm: bf, owner: { type: 'household', id: bh.id } }, bh, cal(0, 3));
  check(bh.boat && bh.boat.tile === step.place && bh.boat.water === plan.water && bh.boat.house === bf.house
    && !Projects.projectOf(st2, 'household', bh.id), 'built: the household\'s boat, the plan finished');
  const g = D.fishingPlace(st2, bh, bf);
  check(g.boat && g.shore === bh.boat.tile, 'its fishing is from the boat');
  check(near(D.catchOf(st2, { water: g.water, boat: true }), 8), 'a trip in it brings 8 rations');
  const again = []; boatYear(st2); Projects.forEach(st2, (x) => { if (x.what === 'boat' && x.holder.id === bh.id) again.push(x); });
  check(!again.length, 'a household with a boat begins no other');
}

// --- a run: dried fish made and eaten, boats built, invariants, a save
const run = Sim.seed(world(7), 7, 'founders');
Sim.advance(run, YEAR_DAYS * DAY * 1.5);
let dried = 0, cooked = 0;
for (const h of run.households) for (const x of h.totals) {
  if (x.kind === 'drying' && x.good === 'dried fish') dried += x.n;
  if (x.kind === 'cooking' && x.good === 'dried fish') cooked -= x.n;
}
const boats = run.households.filter((h) => h.boat).length;
check(dried > 0 && cooked > 0 && boats > 0, `founders at seed 7, a year and a half: ${dried} dried, ${cooked} cooked, ${boats} boats`);
const bad = checkState(run); check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
const back = Sim.load(world(7), JSON.parse(JSON.stringify(Sim.save(run))));
check(back.households.every((h, i) => JSON.stringify(h.boat) === JSON.stringify(run.households[i].boat) && h.rack === run.households[i].rack),
  'a save keeps the boats and the racks');
if (failed) { console.error(`${failed} drying checks failed`); process.exit(1); }
console.log(`drying: ok (founders 7, 1.5 years: ${Math.round(dried)} rations dried, ${Math.round(cooked)} cooked, ${boats} boats)`);
