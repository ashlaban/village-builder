// @suite integration
// The head's day (VB-466; design.md section 7, The day's work): each morning and at 14:00 a household's head allots its members' day: for
// each living member an ordered list of task keys, best fit first, a further hand on a task counting for less, without a random draw; a
// task that arrives in the day is slotted into the lists as they stand, and a holder lost has its tasks slotted to the others (VB-1758);
// a pawn takes the first task of its list it can; the day is saved with the plan. On a small constructed state: three farms on open
// ground, spring day 0, at 10:30.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, Jobs = VB['sim/jobs'], { KINDS } = VB['sim/kinds'], { WORK } = VB['sim/rules'], { CHILD } = VB['sim/roles'];
const { age } = VB['sim/records'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours) => { const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 }); st.makeFields = false; Sim.advance(st, hours); return st; };
const hash = (st) => sha(canon(kept(st)));
const dayOf = (st, id) => st.plans.households.get(id).day;
const kindOf = (st, key) => st.jobs.get(key) && st.jobs.get(key).kind;

// 1. Every household has its day by the morning: a list for each living member, empty for a child under 7; each key once.
const st = make(4.5), hh = st.households[0], c = Sim.cal(st.t);
for (const id of st.liveHouseholds) {
  const day = dayOf(st, id), h = st.households[id];
  assert.ok(day && Number.isInteger(day.made) && day.made >= WORK[0] - 1, `household ${id} has its day`);
  assert.deepStrictEqual(Object.keys(day.lists).map(Number).sort((a, b) => a - b), h.members.filter((m) => st.pawns[m].alive).sort((a, b) => a - b),
    `household ${id}: a list for each living member`);
  for (const m of h.members) {
    const list = day.lists[m];
    assert.strictEqual(new Set(list).size, list.length, `pawn ${m}: each task once`);
    if (age(st, st.pawns[m]) < CHILD.from) assert.strictEqual(list.length, 0, `pawn ${m}, under ${CHILD.from}: no tasks`);
  }
}

// 1b. VB-1760: allotted now, what the head gave each member no task in (free) is within its capacity: a levied member's levy left today,
// the head pair's working hours of the horizon.
{
  VB['sim/day'].allot(st, hh, c);
  const day = dayOf(st, hh.id);
  for (const m of Object.keys(day.free).map(Number))
    assert.ok(day.free[m] >= 0 && day.free[m] <= VB['sim/levies'].capacity(st, hh, st.pawns[m], c) + 1e-9, `pawn ${m}: its free hours within its capacity`);
}

// 2. Allotting draws no random number and is the same twice.
{
  const rng = canon(st.rng);
  VB['sim/day'].allot(st, hh, c);
  const before = canon(dayOf(st, 0).lists);
  VB['sim/day'].allot(st, hh, c);
  assert.strictEqual(canon(st.rng), rng, 'no random draw');
  assert.strictEqual(canon(dayOf(st, 0).lists), before, 'the same day twice');
}

// 3. Best fit first, and the hands spread: the farmer's first task is a field's, the best fit of all is first in its member's list; the hoeing is
// given to more than one field; no one's list leaves out a task it may take (work beats idling).
{
  const lists = dayOf(st, 0).lists, role = (r) => hh.members.find((m) => st.pawns[m].role === r);
  const farmer = role('farmer');
  assert.strictEqual(kindOf(st, lists[farmer][0]), 'plow', 'the farmer hoes first');
  // the best fit of all, member and task, is that member's first task
  let best = null;
  for (const m of hh.members) for (const j of VB['sim/fit'].jobsFor(st, st.pawns[m])) {
    if (age(st, st.pawns[m]) < CHILD.from || !VB['sim/eligibility'].eligible(st, j, st.pawns[m]) || j.done >= (j.hours ?? KINDS[j.kind].hours)) continue;
    const s = VB['sim/fit'].score(st, st.pawns[m], j, c);
    if (s !== null && (!best || s > best[0])) best = [s, m, j.key];
  }
  assert.ok(best && lists[best[1]][0] === best[2], `the best fit comes first: pawn ${best && best[1]} on ${best && best[2]}`);
  const firstFields = new Set(hh.members.map((m) => lists[m][0]).filter((k) => kindOf(st, k) === 'plow'));
  assert.ok(firstFields.size >= 2, `the hands are spread over the fields to hoe (${[...firstFields]})`);
  const mine = [...st.jobs.values()].filter((j) => j.owner.type === 'household' && j.owner.id === 0);
  for (const j of mine) {
    const s = VB['sim/fit'].score(st, st.pawns[farmer], j, c);
    if (s !== null && s > 0 && j.done < (j.hours ?? KINDS[j.kind].hours)) assert.ok(lists[farmer].includes(j.key), `the farmer's list holds ${j.key}`);
  }
}

// 4. A pawn takes the first task of its list that it can: an idle member, its first task full, takes the next.
{
  const s2 = make(4.5), a = s2.agents.find((x) => s2.pawns[x.id].household === 0 && x.job && (x.leg && x.leg.kind === 'work'));
  const list = dayOf(s2, 0).lists[a.id], had = a.job.key;
  VB['sim/agents'].release(s2, a);
  assert.strictEqual(a.job, null, 'its task let go');
  const got = VB['sim/day'].takeDay(s2, [a], Sim.cal(s2.t));
  assert.ok(got.has(a) && a.job && list.includes(a.job.key), `it takes a task of its list (${a.job && a.job.key}; it had ${had})`);
  const open = list.find((k) => s2.jobs.get(k) && (VB['sim/kinds'].isOpen(s2, s2.jobs.get(k)) || s2.jobs.get(k) === a.job));
  assert.strictEqual(a.job.key, open, 'the first that has room');
}

// 4b. A member the day left out and free again has its day allotted anew (VB-1597: the rule is fit's allotted).
{
  const s4 = make(4.5), m = s4.households[0].members.find((id) => s4.agents[id] && age(s4, s4.pawns[id]) >= CHILD.from);
  const day = dayOf(s4, 0), a = s4.agents[m];
  day.lists[m] = [];
  delete day.free[m];
  VB['sim/agents'].release(s4, a);
  assert.ok(VB['sim/fit'].allotted(s4, s4.pawns[m]), 'free again');
  VB['sim/day'].takeDay(s4, [a], Sim.cal(s4.t));
  assert.ok(dayOf(s4, 0).lists[m].length > 0, 'its day is allotted anew');
}

// 5. The day is saved: a loaded run goes on as the saved one, and the state keeps its invariants.
{
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.strictEqual(canon(dayOf(back, 0)), canon(dayOf(st, 0)), 'the day comes back as saved');
  Sim.advance(st, Sim.DAY); Sim.advance(back, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 6. A village's review alone changes nobody's day (VB-1554); a task of the village posted at it is slotted into each household's day as
// it stands, its members alone weighed, and only a day whose slot finds no hand is allotted anew (VB-1758; design.md section 7, Plans at
// four scales, Replanning).
{
  const s3 = make(4.5), c3 = Sim.cal(s3.t), hour = Math.floor(s3.t), vp = s3.plans.villages.get(0);
  const made = () => s3.liveHouseholds.map((id) => dayOf(s3, id).made);
  Jobs.refreshJobs(s3, c3); // the hour's due-queue and reviews are behind it
  for (const id of s3.liveHouseholds) dayOf(s3, id).made = -1;
  assert.strictEqual((s3.jobsBy.get('village:0') || new Set()).size, 0, 'the village has no task');
  vp.nextReview = hour;
  VB.resetCounts();
  Jobs.refreshJobs(s3, c3);
  assert.strictEqual(VB.count.planReview, 1, 'the village is reviewed');
  assert.strictEqual(VB.count.dayPair, 0, 'and nobody is weighed');
  assert.deepStrictEqual(made(), s3.liveHouseholds.map(() => -1), 'no day allotted anew at a review that changes no task');
  for (const s of s3.villages[0].fence) s.cond = 0.2; // the fence is worn: the review posts its mending
  vp.nextReview = hour;
  VB.resetCounts();
  Jobs.refreshJobs(s3, c3);
  assert.ok(s3.jobsBy.get('village:0').size > 0, 'the village posts the mending');
  const whole = made().filter((m) => m === hour).length, slotted = s3.liveHouseholds.filter((id) => dayOf(s3, id).made === -1);
  assert.strictEqual(VB.count.dayAllot, whole, 'a day allotted anew only where the slot found no hand');
  assert.ok(slotted.length >= 2 && whole < s3.liveHouseholds.length, `the days slotted as they stand (${slotted.length} of ${s3.liveHouseholds.length})`);
  for (const id of slotted)
    assert.ok(Object.values(dayOf(s3, id).lists).some((l) => l.some((k) => k.startsWith('mend:'))), `household ${id}: the mending is in a list`);
  const members = (ids) => ids.reduce((n, id) => n + Object.keys(dayOf(s3, id).free).length, 0);
  assert.ok(VB.count.dayPair <= s3.jobsBy.get('village:0').size * members(s3.liveHouseholds) + 200 * whole, `the members weighed for the mending alone (${VB.count.dayPair} pairs)`);
}

// 7. A holder lost to its day (VB-1758; design.md section 7, Plans at four scales, Replanning): a reaper falls ill for three days at the
// reaping; it lets its task go and goes home, its list is emptied and its tasks are slotted to the others at once, no day weighed whole; no
// target lowered. Q7 (docs/plans/four-scales/README.md, section 4): the three days cost no more vital hours (a vital task of the
// household open and unmanned in a working hour) and no more of the reaping than the illness unannounced: its pawn sent home, its tasks
// waiting in its list for the next whole allotment (within 10%). The unannounced arm is a counterfactual under this allotment, in which an
// ill pawn is allotted nothing: before VB-1758 an ill pawn worked on through its illness.
{
  const { emit } = VB['sim/events'], { issue } = VB['sim/commands'], { doneOf } = VB['sim/work'], { isOpen } = VB['sim/kinds'];
  const vital = (s, j) => KINDS[j.kind].vital === true || (typeof KINDS[j.kind].vital === 'function' && KINDS[j.kind].vital(s, j));
  const reaping = (announced) => {
    const s = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
    s.makeFields = false;
    s.naturalDeaths = false;
    for (const fd of s.farmsteads[s.households[0].farmstead].fields) Object.assign(fd, { crop: 'barley', stage: 'ripe', sown: 0 });
    Sim.advance(s, 4.5);
    const mine = () => [...(s.jobsBy.get('household:0') || [])], reaps = () => mine().filter((j) => j.kind === 'reap');
    for (const j of reaps()) j.hours = 70; // a reaping of three days for the household's hands
    const id = s.households[0].members.find((m) => s.agents[m].job && s.agents[m].job.kind === 'reap');
    assert.ok(id !== undefined && reaps().length === 3, 'a member at the reaping');
    const day = dayOf(s, 0), held = day.lists[id].filter((k, i) => day.fits[id][i] === null || day.fits[id][i] > 0);
    const targets = canon(s.plans.households.get(0).targets), left = () => reaps().reduce((n, j) => n + j.hours - doneOf(s, j), 0);
    VB.resetCounts();
    s.pawns[id].ill = { cause: 'illness', from: s.t, until: s.t + 3 * Sim.DAY, passes: true };
    VB['sim/records'].nameAll(s); // a test's write: its charge named as falling ill names it (VB-1693)
    if (announced) emit(s, 'fellIll', { pawn: id });
    else issue(s, { actor: id, verb: 'goHome', source: 'planner' });
    const r = { id, held, at: { allots: VB.count.dayAllot, lost: VB.count.dayLost, list: [...dayOf(s, 0).lists[id]], job: s.agents[id].job }, unmet: 0 };
    r.others = held.filter((k) => s.households[0].members.some((m) => m !== id && dayOf(s, 0).lists[m].includes(k)));
    const r0 = left();
    for (let h = 0; h < 3 * Sim.DAY; h++) {
      Sim.advance(s, 1);
      const hr = Sim.cal(s.t).hour;
      if (hr >= WORK[0] && hr < WORK[1]) for (const j of mine()) if (vital(s, j) && !j.claims.length && isOpen(s, j)) r.unmet++;
      // in bed while ill (abed): no task and no pastime, inside but on its way home
      const ag = s.agents[id];
      if (s.pawns[id].ill && hr >= WORK[0] && hr < WORK[1] && (ag.job || ag.pastime || (!ag.inside && !ag.path))) r.up = (r.up || 0) + 1;
      if (r.done === undefined && !reaps().length) r.done = h + 1;
    }
    Object.assign(r, { reaped: r0 - left(), same: canon(s.plans.households.get(0).targets) === targets, ill: !!s.pawns[id].ill });
    assert.deepStrictEqual(checkState(s), [], 'invariants after the illness');
    return r;
  };
  const a = reaping(true), b = reaping(false);
  assert.ok(a.held.length > 0 && a.at.lost === a.held.length && a.at.allots === 0, `its ${a.held.length} tasks to the pool, no day allotted whole (${a.at.allots})`);
  assert.ok(a.at.list.length === 0 && a.at.job === null, 'its list emptied, its task let go');
  assert.ok(!a.up && !b.up, `the ill pawn keeps to bed in working hours (${a.up || 0} and ${b.up || 0} hours up)`);
  assert.deepStrictEqual(a.others, a.held, 'each of its tasks in another member\'s list');
  assert.ok(a.ill && a.same && b.same, 'no target lowered for the three days ill');
  assert.ok(a.done !== undefined && b.done !== undefined && a.done <= 1.1 * b.done, `the reaping in ${a.done} hours, ${b.done} unannounced`);
  assert.ok(a.unmet <= 1.1 * b.unmet, `Q7: ${a.unmet} vital hours unmet, ${b.unmet} unannounced`);
  console.log(`day, Q7: a reaper ill three days: the reaping done in ${a.done} hours (${b.done} under the whole allotment), vital hours unmet ${a.unmet} (${b.unmet})`);
}
// 8. The head's review re-weighs in place (VB-1854; design.md section 7, Plans at four scales, Replanning: the head's review rung): the
// woodpile emptied at 10:30, its crossing of the low mark wakes the head, and at the review out of turn the trip to the woods, made more
// urgent, moves ahead in its best member's list, slotted again (slotIn) as the lists stand: no day weighed whole.
{
  const s = make(4.5), c8 = Sim.cal(s.t), Stores = VB['sim/stores'], hh8 = s.households[0];
  Jobs.refreshJobs(s, c8); // the hour's due-queue and reviews are behind it
  const day = dayOf(s, 0), made = day.made, key = 'wood:h0';
  assert.ok(s.jobs.has(key), 'a trip to the woods stands');
  const at = (id) => dayOf(s, 0).lists[id].indexOf(key), fit = (id) => dayOf(s, 0).fits[id][at(id)];
  const before = Object.fromEntries(Object.keys(day.lists).map((id) => [id, [at(id), at(id) >= 0 ? fit(id) : null]]));
  Stores.take(s, hh8, 'wood', hh8.wood, 'burn');
  assert.ok(s.plans.households.get(0).dirty, 'the pile under its low mark wakes the head');
  VB.resetCounts();
  Jobs.refreshJobs(s, c8);
  assert.ok(VB.count.planReview >= 1 && s.plans.households.get(0).woke === c8.day, 'the household is reviewed for its store');
  assert.strictEqual(VB.count.dayAllot, 0, 'no day allotted whole');
  assert.strictEqual(dayOf(s, 0).made, made, 'the day as it stood');
  // VB-1771: the wood is a duty, so its holder keeps the first place for the trip: there it rises in place, at its more urgent fit
  const duty = VB['sim/steps'].dutyOf(s.plans.households.get(0), KINDS.wood.type), holder = duty && String(duty.who[0]);
  const moved = Object.keys(day.lists).filter((id) => at(id) >= 0 && fit(id) > 0 && (before[id][0] < 0 || at(id) < before[id][0] || (id === holder && fit(id) > before[id][1])));
  assert.ok(moved.length > 0, `the trip moved ahead in a list: ${JSON.stringify(before)} to ${JSON.stringify(Object.fromEntries(Object.keys(day.lists).map((id) => [id, [at(id), at(id) >= 0 ? fit(id) : null]])))}`);
  assert.ok(VB.count.dayRose >= 1, `the trip slotted again (${VB.count.dayRose})`);
  assert.deepStrictEqual(checkState(s), [], 'invariants after the review');
}
console.log('day ok: a day for every household, a list for each member; no random draw; best fit first and the hands spread; the first task with room is taken; saved and loaded; a village\'s review alone allots no day, its task slotted; a holder ill has its tasks slotted to the others; a review re-weighs in place what it made more urgent');
