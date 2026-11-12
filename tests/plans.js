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
  assert.strictEqual(plan.targets.fields, F.fieldsWanted(st, hh), 'the first review writes the fields wanted');
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
  assert.strictEqual(posted.length, st.villages[f.village].wood.length ? 1 : 0, 'the plan\'s goal for the season is read');
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
  refreshJobs(st, cal(st.t), true);
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
  refreshJobs(st, cal(st.t), true); // every holder reviewed now
  for (const id of st.liveHouseholds) assert.strictEqual(Plans.planOf(st, 'household', id).reserved.grain, seedNeed(st, st.households[id]), 'stored at review');
}
// ---- VB-249: windows and the due-queue, planning days ----
{ // the due-queue opens the time-bound kinds at their hour, with no review: water from 5:00, cooking from 14:00
  const st = fresh('populous');
  const W = Plans.WINDOWED;
  assert.deepStrictEqual([...W].sort(), ['cook', 'fodder', 'haul', 'herd', 'milk', 'thresh', 'water'], 'the time-bound kinds');
  assert.strictEqual(st.plans.due.length, st.liveHouseholds.length * W.length, 'one entry per household and kind');
  for (const plan of st.plans.households.values()) plan.nextReview = 1e9;
  for (const plan of st.plans.villages.values()) plan.nextReview = 1e9;
  for (const f of st.farmsteads) for (const fd of f.fields) fd.stage = 'growing'; // no field due in the sowing window (VB-322)
  for (const j of [...st.jobs.values()]) VB['sim/agents'].dropJob(st, j);
  setClock(st, DAY + WORK[0] - 1);
  const reviews = VB.count.planReview;
  refreshJobs(st, cal(st.t));
  assert.strictEqual(VB.count.planReview, reviews, 'no plan was reviewed');
  const day = cal(st.t).day;
  for (const id of st.liveHouseholds) assert(st.jobs.has(`water:h${id}:${day}`), `household ${id} has its water posted at 5:00`);
  assert(![...st.jobs.values()].some((j) => j.kind === 'cook'), 'no cooking before 14:00');
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'queue invariants after a pop');
  // the water drawn: the next hour's ask takes the job down and the entry waits for tomorrow's 5:00
  const id0 = st.liveHouseholds[0], k = W.indexOf('water');
  st.households[id0].waterDay = day;
  setClock(st, DAY + WORK[0]); refreshJobs(st, cal(st.t));
  assert(!st.jobs.has(`water:h${id0}:${day}`), 'water drawn: its task taken down');
  assert.strictEqual(st.plans.due.find((e) => e[1] === id0 && e[2] === k)[0], 2 * DAY + WORK[0] - 1, 'asked again at tomorrow\'s 5:00');
  // a dissolved household's entries leave the queue with its plan
  Plans.dropPlan(st, 'household', id0);
  assert(!st.plans.due.some((e) => e[1] === id0), 'no entry of a dropped plan');
}
{ // planning days: the head's diligence sets the cadence, the id the day and the hour; a store crossing a target wakes one review a day
  const st = fresh('populous'), hh = st.households[0], plan = Plans.planOf(st, 'household', hh.id), head = st.pawns[hh.holder];
  for (const [d, cad] of [[0.1, 3], [0.5, 2], [0.9, 1]]) { head.diligence = d; assert.strictEqual(Plans.cadence(st, plan), cad, `diligence ${d}`); }
  head.diligence = 0.1;
  setClock(st, 3 * DAY + WORK[0]);
  Plans.reviewed(st, plan, cal(st.t));
  const next = plan.nextReview, nd = Math.floor(next / DAY), nh = next - nd * DAY;
  assert(next > st.t && (nd + hh.id) % 3 === 0 && nh >= WORK[0] - 1 && nh <= WORK[1], `the next planning day (${next})`);
  const c = cal(st.t);
  assert.strictEqual(Plans.reviewWhy(st, plan, Math.floor(st.t), c), null, 'not due again today');
  Stores.take(st, hh, 'grain', hh.grain, 'meal');
  assert(plan.dirty, 'the grain above the seed ran out: the plan is flagged');
  assert.strictEqual(Plans.reviewWhy(st, plan, Math.floor(st.t), c), 'store', 'a store woke a review');
  Plans.reviewed(st, plan, c, 'store');
  assert(!plan.dirty && plan.nextReview === next, 'the flag cleared, the planning day kept');
  Stores.put(st, hh, 'grain', 1000, 'gift');
  assert(plan.dirty && Plans.reviewWhy(st, plan, Math.floor(st.t), c) === null, 'at most one store review a day');
  const spring9 = cal(st.ECON.sowWindow[1] * DAY + WORK[0]);
  assert(Plans.closing(st, spring9) && !Plans.closing(st, cal(3 * DAY)), 'the sowing window\'s last day is a closing day');
}
{ // VB-322: fields due. A household of cadence 3 reviewed on its planning day is reviewed out of turn, at the first review hour, the day a
  // field ripens (and reaps it), and on a day of the sowing window while a field is hoed and not sown (and sows it); once that day
  const { SEASON_DAYS } = VB['sim/rules'], FIRST = WORK[0] - 1;
  const setup = (season, sday, stage) => {
    const st = fresh('populous'), hh = st.households.find((h) => h.farmstead !== null && h.holder !== null);
    const f = st.farmsteads[hh.farmstead], plan = Plans.planOf(st, 'household', hh.id);
    st.pawns[hh.holder].diligence = 0.1;
    assert.strictEqual(Plans.cadence(st, plan), 3, 'every third day');
    let D = season * SEASON_DAYS + sday;
    while ((D + hh.id) % 3) D++; // its planning day
    setClock(st, D * DAY + WORK[1]);
    Plans.reviewed(st, plan, cal(st.t));
    assert.strictEqual(Math.floor(plan.nextReview / DAY), D + 3, 'next planning day three days on');
    for (const fd of f.fields) { fd.stage = 'growing'; fd.sown = D - 5; }
    hh.grain = Math.max(hh.grain, 1000);
    return { st, hh, f, plan, D, fd: f.fields[0], stage };
  };
  const dueDay = ({ st, hh, f, plan, D, fd, stage }, kind) => {
    setClock(st, (D + 1) * DAY + FIRST);
    assert.strictEqual(Plans.reviewWhy(st, plan, Math.floor(st.t), cal(st.t)), null, 'nothing due: no review out of turn');
    fd.stage = stage;
    if (stage === 'ripe') fd.sown = D + 1 - st.ECON.ripeAfterDays;
    setClock(st, (D + 1) * DAY + FIRST + 1);
    assert.strictEqual(Plans.reviewWhy(st, plan, Math.floor(st.t), cal(st.t)), null, 'only at the first review hour');
    setClock(st, (D + 1) * DAY + FIRST);
    const reviews = VB.count.planReview, key = `${kind}:f${f.id}.${fd.id}`;
    assert.strictEqual(Plans.reviewWhy(st, plan, Math.floor(st.t), cal(st.t)), 'window', `a ${stage} field: reviewed out of turn`);
    refreshJobs(st, cal(st.t));
    assert(VB.count.planReview > reviews && plan.last === D + 1, 'reviewed at the first review hour');
    assert.strictEqual(Math.floor(plan.nextReview / DAY), D + 3, 'the planning day kept');
    assert(st.jobs.has(key), `${kind} posted the same day`);
    assert.strictEqual(Plans.reviewWhy(st, plan, Math.floor(st.t), cal(st.t)), null, 'once a day');
    for (let h = 0; h < 12 && fd.stage === stage; h++) Sim.advance(st, 1);
    assert.notStrictEqual(fd.stage, stage, `the field ${kind === 'reap' ? 'reaped' : 'sown'} that day (${fd.stage})`);
    assert(hh.members.length, 'the household stands');
  };
  dueDay(setup(1, 3, 'ripe'), 'reap'); // summer, no closing day
  dueDay(setup(0, 2, 'plowed'), 'sow'); // the sowing window
  { // outside the sowing window a hoed or stubble field is not due
    const s = setup(1, 3, 'stubble');
    setClock(s.st, (s.D + 1) * DAY + FIRST);
    s.fd.stage = 'stubble';
    assert.strictEqual(Plans.reviewWhy(s.st, s.plan, Math.floor(s.st.t), cal(s.st.t)), null, 'stubble in summer is not due');
  }
}
{ // a member without a task looks at the household's opportunities, once a household a day
  const st = fresh('populous'), hh = st.households[0], plan = Plans.planOf(st, 'household', hh.id), J = VB['sim/jobs'];
  const c = cal(st.t), a = st.agents[hh.members.find((m) => st.pawns[m].age >= 16)];
  assert.deepStrictEqual(J.lookForWork(st, [a], c), [a], 'it looks');
  assert.strictEqual(plan.looked, c.day);
  assert.deepStrictEqual(J.lookForWork(st, [a], c), [], 'not twice a day');
}
// ---- VB-252: the seasonal plan, from the culture's template of the year ----
{ // the template is rules of the registry, with today's values, the same for every culture
  const st = fresh(), Rules = VB['sim/registry'], ids = Rules.list().map((r) => r.rule);
  for (const id of ['order', 'wood', 'woodSecond', 'hayWinters', 'seed', 'perHand']) assert(ids.includes('year.' + id), 'rule year.' + id);
  const at = (id, culture, season, routine = '') => Rules.value(st, 'year.' + id, { culture, season, routine });
  for (const culture of [-1, 0, 1]) {
    assert.deepStrictEqual([0, 1, 2, 3].map((s) => at('wood', culture, s)), [st.ECON.woodTarget, st.ECON.woodWinter, st.ECON.woodWinter, st.ECON.woodTarget]);
    assert.strictEqual(at('hayWinters', culture, 0), 2);
    assert.strictEqual(at('seed', culture, 0), st.ECON.seedPerField);
    assert.strictEqual(at('perHand', culture, 0), VB['sim/rules'].FIELDS.perHand);
    assert(at('order', culture, 0, 'plow') < at('order', culture, 0, 'sow'), 'hoeing before sowing');
    assert.strictEqual(at('order', culture, 3, 'plow'), -1, 'no hoeing in winter');
  }
}
{ // one seasonal plan per household from the start, its steps the season's routines in order; the standing plan's targets copied from it
  const st = fresh('populous'), c = cal(st.t);
  assert.strictEqual(st.plans.seasons.size, st.liveHouseholds.length, 'one seasonal plan per household');
  for (const id of st.liveHouseholds) {
    const sp = Plans.seasonOf(st, id), T = Plans.planOf(st, 'household', id).targets;
    assert.strictEqual(sp.kind, 'season');
    assert.strictEqual(sp.season, c.season);
    assert.deepStrictEqual(sp.steps, Plans.ROUTINES[c.season], 'the season\'s routines in order');
    assert.strictEqual(T.seed, st.ECON.seedPerField);
    assert.strictEqual(T.perHand, VB['sim/rules'].FIELDS.perHand);
  }
  assert.notStrictEqual(Plans.seasonOf(st, st.liveHouseholds[0]).steps, Plans.seasonOf(st, st.liveHouseholds[1]).steps, 'each its own steps');
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'seasonal plan invariants');
}
{ // the review reads the plan, not the template: one household's changed target stands until the season turns, and no other's changes;
  // at its first review of a season the plan is made again from the template; the template is compiled once a season and culture
  const st = fresh('populous'), [a, b] = st.liveHouseholds, pa = Plans.planOf(st, 'household', a), pb = Plans.planOf(st, 'household', b);
  pa.targets.wood[1] = 99; pa.targets.perHand = 3; Plans.seasonOf(st, a).steps.reverse();
  setClock(st, DAY + WORK[0]);
  refreshJobs(st, cal(st.t), true);
  assert.strictEqual(pa.targets.wood[1], 99, 'the review reads the plan\'s target');
  assert.strictEqual(pa.targets.workable, F.fieldsWorkable(st, st.households[a], 3), 'the fields per hand read from the plan');
  assert.strictEqual(pb.targets.wood[1], st.ECON.woodWinter, 'no other household\'s plan changed');
  assert.strictEqual(Plans.seasonOf(st, a).steps[0], 'fish', 'its steps as changed (the season\'s last routine first)');
  const spring = cal(st.t);
  setClock(st, (spring.day - spring.sday + VB['sim/rules'].SEASON_DAYS) * DAY + WORK[0]); // the next season's first day
  const R = VB['sim/registry'], value = R.value;
  let reads = 0;
  R.value = (s, id, ctx) => { if (id.startsWith('year.')) reads++; return value(s, id, ctx); };
  refreshJobs(st, cal(st.t), true);
  R.value = value;
  const sp = Plans.seasonOf(st, a);
  assert.strictEqual(sp.season, (spring.season + 1) % 4, 'the next season\'s plan');
  assert.deepStrictEqual(sp.steps, Plans.ROUTINES[sp.season], 'its steps from the template');
  assert.strictEqual(pa.targets.wood[1], st.ECON.woodWinter, 'the targets copied from the template again');
  const cultures = new Set(st.liveHouseholds.map((id) => Plans.cultureOf(st, st.households[id])));
  assert.strictEqual(reads, cultures.size * (4 + 4 + new Set(Plans.ROUTINES.flat()).size), 'compiled once per culture');
  assert.deepStrictEqual(checkState(st).filter((x) => x.startsWith('plans')), [], 'seasonal plan invariants after the turn');
}
{ // a household's seasonal plan is dropped with it; a save made before seasonal plans gets them at load
  const st = fresh('populous'), id = st.liveHouseholds[0];
  Plans.dropPlan(st, 'household', id);
  assert(!st.plans.seasons.has(id), 'dropped with the standing plan');
  const st2 = fresh();
  delete st2.plans.seasons;
  for (const plan of st2.plans.households.values()) { delete plan.targets.seed; delete plan.targets.perHand; }
  Plans.fillPlans(st2);
  assert.deepStrictEqual(checkState(st2).filter((x) => x.startsWith('plans')), [], 'filled seasonal plans keep the invariants');
}
console.log('plans ok');
