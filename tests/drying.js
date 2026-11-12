// Dried fish and the fishing boat (VB-300): a village's reach to fishing water, tested again when it has a new farm; fishing for the drying
// rack from spring day 3 to summer day 6 while the household holds less dried fish than it wants (a quarter of its need over the 14 days
// without fresh fish, in whole lots of 10), one catch waiting at a time; the catch hung at the rack is dried fish in the larder, kept a
// year; out of the fishing season the cook puts dried fish in for a quarter of the meals; the boat: a project plan begun at spring day 3
// by a household by the sea or a large lake, its step waiting for 6 loads of timber felled in the village's wood, 20 hours of work,
// then twice the bank's catch from it. Founders at seed 7, a year and a half: dried fish made and eaten, boats built, invariants, a save.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Stores = VB['sim/stores'], D = VB['sim/drying'], Projects = VB['sim/projects'];
const { KINDS } = VB['sim/kinds'], { ROLES, FISH, DAY, YEAR_DAYS } = VB['sim/rules'], { dailyNeed, larderOf } = VB['sim/hunger'];
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
const want = Math.ceil(0.25 * need * (12 + FISH.from) / 10 - 1e-9) * 10;
check(D.wanted(st, hh) === want && want % 10 === 0 && want > 0, `wants ${D.wanted(st, hh)} rations of dried fish, not ${want}`);
check(posts(st, 'rackfish', hh, f, cal(0, 1)).length === 0 && posts(st, 'rackfish', hh, f, cal(1, 6)).length === 0
  && posts(st, 'rackfish', hh, f, cal(3, 3)).length === 0, 'no fishing for the rack before spring day 3, after summer day 6, in winter');
const p = posts(st, 'rackfish', hh, f, cal(0, 2));
check(p.length === 1 && p[0].boat === false && posts(st, 'rackfish', hh, f, cal(1, 5)).length === 1, 'one trip in the drying season, from the bank');
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

// --- the pot: a quarter of the meals out of the fishing season
const held = larderOf(hh, 'dried fish'), meals = hh.meals;
check(D.intoPot(st, hh, cal(1, 3), 8) === 0 && D.intoPot(st, hh, cal(0, 4), 8) === 0, 'no dried fish in the pot while fresh fish is had');
check(near(D.intoPot(st, hh, cal(3, 4), 8), 2) && near(larderOf(hh, 'dried fish'), held - 2) && near(hh.meals, meals + 2), 'in winter: 2 of 8 meals');
check(near(D.intoPot(st, hh, cal(0, 1), 4), 1), 'in spring under the ice: a quarter too');

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
