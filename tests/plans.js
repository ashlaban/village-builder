// VB-248: the hidden plans made explicit. A household's standing plan holds its targets (the woodpile by season, hay in winters, the fields
// wanted), the land step with its seam for a tile the plan names, the year's herd count, and its reservation of seed in sim/stores.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { setClock } = require('./lib/clock.js');
const Stores = VB['sim/stores'], Plans = VB['sim/plans'], { seedNeed } = VB['sim/hunger'], F = VB['sim/fields'];
const { refreshJobs } = VB['sim/jobs'], { DAY, WORK, HERD, YEAR_DAYS, cal } = VB['sim/rules'];
const { checkState } = require('./lib/invariants.js');
const it = G.generate(7); let r; while (!(r = it.next()).done);
const fresh = (sc = 'founders') => Sim.seed(r.value, 7, sc);

{ // every household's plan has its targets and its seed reservation from the start; the reservation is the fields' need, read live
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = Plans.planOf(st, 'household', hh.id);
  assert.deepStrictEqual(plan.targets.wood, [st.ECON.woodTarget, st.ECON.woodWinter, st.ECON.woodWinter, st.ECON.woodTarget], 'wood by season');
  assert.strictEqual(plan.targets.hayWinters, 2, 'hay for two winters');
  assert.strictEqual(plan.targets.fields, F.fieldsWanted(st, hh), 'the fields wanted');
  assert.strictEqual(plan.reasons.grain, 'seed', 'the standing plan reserves seed');
  assert.strictEqual(Stores.reserved(st, hh, 'grain'), seedNeed(st, hh), 'reserved is the seed the fields need');
  assert.strictEqual(Sim.seedReserve(st, hh), seedNeed(st, hh), 'Sim.seedReserve reads the reservation');
  for (const fd of f.fields) fd.stage = 'sown';
  assert.strictEqual(Stores.reserved(st, hh, 'grain'), (f.project ? 1 : 0) * st.ECON.seedPerField, 'a field sown since the review counts at once');
  assert.strictEqual(Stores.reserved(st, st.villages[0], 'grain'), 0, 'a village reserves nothing');
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'plan invariants');
}
{ // the review writes the targets and the count of seed; reserve and release check their reason and plan
  const st = fresh(), hh = st.households[0], plan = Plans.planOf(st, 'household', hh.id);
  setClock(st, DAY + WORK[0]);
  plan.targets.fields = -5; plan.reserved.grain = -1;
  refreshJobs(st, cal(st.t));
  assert.strictEqual(plan.targets.fields, F.fieldsWanted(st, hh), 'the day\'s first work review writes the fields wanted');
  assert.strictEqual(plan.reserved.grain, seedNeed(st, hh), 'the review counts the seed reserved');
  assert.throws(() => Stores.reserve(st, hh, plan, 'grain', 1, 'barn'), /unknown reservation/, 'a reason it does not know');
  assert.throws(() => Stores.reserve(st, hh, Plans.planOf(st, 'household', st.households[1].id), 'grain', 1, 'seed'), /its holder's plan/,
    'a reservation on another holder\'s plan');
  assert.throws(() => Stores.reserve(st, hh, plan, 'grain', -1, 'seed'), /invalid amount/, 'a negative count');
  Stores.release(st, hh, plan, 'grain', 'seed');
  assert.strictEqual(Stores.reserved(st, hh, 'grain'), 0, 'released');
  assert.throws(() => Stores.release(st, hh, plan, 'grain', 'seed'), /no such reservation/, 'released twice');
}
{ // the plan's targets are what the rules read: a higher woodpile goal posts wood, more winters of hay want more
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = Plans.planOf(st, 'household', hh.id);
  const K = VB['sim/kinds'].KINDS, c = cal(st.t), posted = [];
  hh.wood = 1000; K.wood.available(st, hh, f, c, (key) => posted.push(key));
  assert.strictEqual(posted.length, 0, 'a full woodpile posts no wood');
  plan.targets.wood[c.season] = 2000; K.wood.available(st, hh, f, c, (key) => posted.push(key));
  assert.strictEqual(posted.length, f.woodlot >= 0 ? 1 : 0, 'the plan\'s goal for the season is read');
  const M = VB['sim/meadows'];
  if (M.hayWanted(st, f, hh) === false && hh.herds.length) { plan.targets.hayWinters = 1e9; assert(M.hayWanted(st, f, hh), 'hay winters read'); }
}
{ // the land step: the plan's target of fields, and a tile the plan names in place of the holder's choice
  const st = fresh(), hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = Plans.planOf(st, 'household', hh.id);
  f.project = null; plan.targets.fields = f.fields.length;
  Plans.landStep(st, plan, f, hh, F.builtTiles(st));
  assert(!f.project || f.project.stage === 'meadow', 'no new field when the plan has enough');
  f.project = null; plan.targets.fields = f.fields.length + 1;
  const chosen = F.chooseTile(st, f);
  assert(chosen >= 0, 'a tile to choose');
  const other = F.chooseTile(st, f, (t) => t !== chosen && VB['sim/territory'].freeFor(st, t, f.village));
  plan.tiles.field = other;
  Plans.landStep(st, plan, f, hh, F.builtTiles(st));
  assert(f.project && f.project.stage === 'clear' && f.project.tile === other, 'the plan\'s tile, not the holder\'s choice');
  assert.strictEqual(Stores.reserved(st, hh, 'grain'), seedNeed(st, hh), 'the project counts in the seed reserved');
}
{ // the plan records the year's herd count
  const st = fresh('heirs'), hh = st.households.find((h) => h.herds.length), plan = Plans.planOf(st, 'household', hh.id);
  setClock(st, ((HERD.countDay) * DAY) + WORK[0]);
  refreshJobs(st, cal(st.t));
  assert.strictEqual(plan.counted, 1, 'the count held this year');
}
{ // a save made before the targets and reservations gets them at load
  const st = fresh(), plan = Plans.planOf(st, 'household', st.households[0].id);
  delete plan.targets; delete plan.tiles; delete plan.counted; delete plan.reserved; delete plan.reasons;
  delete Plans.planOf(st, 'village', st.villages[0].id).reserved;
  Plans.fillPlans(st);
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'filled plans keep the invariants');
}
{ // a year of populous: the review's count of seed is the fields' need right after every review, and no plan invariant breaks
  const st = fresh('populous');
  Sim.advance(st, YEAR_DAYS * DAY / 4);
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'plan invariants after a season');
  setClock(st, Math.ceil(st.t / DAY) * DAY + WORK[0]);
  refreshJobs(st, cal(st.t));
  for (const id of st.liveHouseholds) assert.strictEqual(Plans.planOf(st, 'household', id).reserved.grain, seedNeed(st, st.households[id]), 'stored at review');
}
console.log('plans ok');
