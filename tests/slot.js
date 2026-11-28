// @suite fast
// VB-1558: a task the due-queue opens in the day is slotted into the household's day as it stands (sim/day slotIn; design.md section 7,
// The day's work), not the whole day weighed anew. On the small constructed state of tests/lib/probe.js (two villages, cattle kept):
// 1. a task slotted lands where the allotment would have put it when nothing else changed: the same lists and fits, and its members
//    alone weighed;
// 2. the milking, opened at 6:00 by the due-queue, reaches a member's list, and every list otherwise stands as the morning made it;
// 3. a meal (a deadline today) slotted goes first in its hand's list and calls the hand from its work;
// 4. a task slotted for the member best fit for it, with no hours left, goes to the next fit, and to the first as a further task;
// 5. a task slotted takes the hours of a member's lesser task, as the allotment would: that task goes on among the rest.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Jobs = VB['sim/jobs'],
  Day = VB['sim/day'];
const { state } = require('./lib/probe.js');
const { DAY, WORK } = VB['sim/rules'];
const { canon } = require('./lib/canon.js');
const { checkState } = require('./lib/invariants.js');

const dayOf = (st, id) => st.plans.households.get(id).day;
const till = (st, hour) => Sim.advance(st, hour - st.t);
const copy = (st) => Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
// a household of several members with a day, its farm's house a site
const pick = (st) =>
  st.households.find(
    (h) =>
      !h.dissolved &&
      h.farmstead !== null &&
      h.members.filter((m) => st.pawns[m].died === null && Sim.age(st, st.pawns[m]) >= 16).length >= 2 &&
      dayOf(st, h.id),
  );
const owner = (hh) => ({ type: 'household', id: hh.id });
// the household's members let go of their tasks and its tasks taken down but a grinding, so that its members have hours left in the day
// (where hours bind, the slot leaves the tasks given before as they were, as the head knew them in the morning; the allotment weighs all)
const thin = (st, hh) => {
  const A = VB['sim/agents'];
  for (const m of hh.members) if (st.agents[m].job) A.release(st, st.agents[m]);
  for (const j of [...(st.jobsBy.get(`household:${hh.id}`) || [])]) A.dropJob(st, j);
  const f = st.farmsteads[hh.farmstead];
  Jobs.post(st, 'grind:test:base', 'grind', owner(hh), f.house, { farm: f });
};
const without = (lists, key) =>
  Object.fromEntries(Object.entries(lists).map(([id, l]) => [id, l.filter((k) => k !== key)]));

// 1. the slot and the allotment agree: the day allotted now, then a task posted and slotted, is the day allotted with it posted
{
  const st = state();
  till(st, DAY + 9); // the second day, 9:00
  thin(st, pick(st));
  const twin = copy(st),
    hh = pick(st),
    f = st.farmsteads[hh.farmstead],
    c = Sim.cal(st.t);
  Day.allot(st, hh, c);
  Day.allot(twin, twin.households[hh.id], c);
  assert.strictEqual(canon(dayOf(twin, hh.id)), canon(dayOf(st, hh.id)), 'the two states allot alike');
  assert.ok(
    Object.values(dayOf(st, hh.id).free).some((h) => h > 0),
    'a member has hours left',
  );
  const key = 'grind:test:slot';
  const j = Jobs.post(st, key, 'grind', owner(hh), f.house, { farm: f });
  VB.resetCounts();
  assert.strictEqual(Day.slotIn(st, hh, j, c), true, 'the grinding is slotted');
  const alive = hh.members.filter((m) => st.pawns[m].died === null).length;
  assert.ok(VB.count.dayPair <= alive, `the slot weighs the members alone (${VB.count.dayPair} pairs)`);
  assert.ok(
    Object.values(dayOf(st, hh.id).lists).some((l) => l.includes(key)),
    'the grinding is in a list',
  );
  Jobs.post(twin, key, 'grind', owner(hh), f.house, { farm: twin.farmsteads[f.id] });
  Day.allot(twin, twin.households[hh.id], c);
  const a = dayOf(st, hh.id),
    b = dayOf(twin, hh.id);
  assert.strictEqual(canon(a.lists), canon(b.lists), 'the lists are those the allotment makes');
  assert.strictEqual(canon(a.fits), canon(b.fits), 'and so are their fits');
  assert.strictEqual(canon(a.free), canon(b.free), 'and the hours left');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 2. the milking at its hour: slotted by the due-queue, the morning's lists otherwise unchanged and the day not made anew
{
  const st = state();
  till(st, DAY + WORK[0] - 0.5); // the second day, after the morning's allotment
  const holders = st.liveHouseholds.filter((id) => (st.herds || []).some((h) => h && h.household === id && h.cows > 0));
  const before = new Map(st.liveHouseholds.map((id) => [id, structuredClone(dayOf(st, id))]));
  VB.resetCounts();
  till(st, DAY + WORK[0] + 0.5); // past 6:00, when the milking opens
  let slotted = 0;
  for (const id of st.liveHouseholds) {
    const day = dayOf(st, id),
      was = before.get(id);
    if (day.made !== was.made) continue; // its day was allotted anew this hour by its own review
    const milk = [...(st.jobsBy.get(`household:${id}`) || [])].filter((j) => j.kind === 'milk').map((j) => j.key);
    let lists = day.lists;
    for (const k of milk) {
      if (Object.values(lists).some((l) => l.includes(k))) slotted++;
      lists = without(lists, k);
    }
    // the herding opens at 6:00 as well, and is slotted alike
    for (const j of st.jobsBy.get(`household:${id}`) || []) if (j.kind === 'herd') lists = without(lists, j.key);
    assert.strictEqual(canon(lists), canon(was.lists), `household ${id}: the lists stand as the morning made them`);
  }
  assert.ok(holders.length === 0 || slotted > 0, `the milking reaches a list (${slotted} slotted)`);
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// 3. the meal slotted: first in its hand's list, after the fetches alone, and the hand called to it from its work
{
  const st = state();
  till(st, DAY + 9);
  const hh = pick(st),
    fm = st.farmsteads[hh.farmstead];
  thin(st, hh);
  // a grinding for every member, so that each who may work is at work when the meal is posted
  for (const m of hh.members) Jobs.post(st, `grind:test:${m}`, 'grind', owner(hh), fm.house, { farm: fm });
  Day.allot(st, hh, Sim.cal(st.t));
  for (let n = 0; n < 20 && !hh.members.some((m) => (st.agents[m].leg && st.agents[m].leg.kind === 'work')); n++) Sim.advance(st, 0.1);
  const working = hh.members.filter((m) => (st.agents[m].leg && st.agents[m].leg.kind === 'work'));
  assert.ok(working.length > 0, 'members are at work');
  const f = st.farmsteads[hh.farmstead],
    c = Sim.cal(st.t),
    day = dayOf(st, hh.id);
  for (const m of Object.keys(day.free)) day.free[m] = Day.dayHours(); // hours left to each (a test's write: the grindings are short)
  const key = `cook:test:${hh.id}`,
    j = Jobs.post(st, key, 'cook', owner(hh), f.house, { farm: f });
  assert.strictEqual(Day.slotIn(st, hh, j, c), true, 'the meal is slotted');
  const hand = Object.keys(day.lists).find(
    (id) => day.lists[id].includes(key) && day.fits[id][day.lists[id].indexOf(key)] === null,
  );
  assert.ok(hand !== undefined, 'the meal heads a list');
  const list = day.lists[hand],
    i = list.indexOf(key);
  assert.ok(
    list.slice(0, i).every((k) => st.jobs.get(k) && VB['sim/kinds'].KINDS[st.jobs.get(k).kind].first),
    'after the fetches alone',
  );
  const a = st.agents[hand];
  assert.ok(working.includes(Number(hand)), `the meal's hand was at work (${hand}; at work ${working})`);
  assert.strictEqual(a.job, j, `its hand is called to it from its work (${a.job && a.job.key}, ${a.leg && a.leg.kind})`);
}

// 4. the best fit has no hours left: the task goes to the next fit, and on the first's list after its tasks given hands
{
  const st = state();
  till(st, DAY + 9);
  const hh = pick(st),
    f = st.farmsteads[hh.farmstead],
    c = Sim.cal(st.t);
  thin(st, hh);
  Day.allot(st, hh, c);
  const day = dayOf(st, hh.id);
  const twin = copy(st),
    key = 'grind:test:full',
    j = Jobs.post(twin, key, 'grind', owner(hh), f.house, { farm: twin.farmsteads[f.id] });
  assert.ok(Day.slotIn(twin, twin.households[hh.id], j, c), 'slotted');
  const td = dayOf(twin, hh.id),
    best = Object.keys(td.lists).find((id) => td.fits[id][td.lists[id].indexOf(key)] > 0);
  assert.ok(best !== undefined, 'the grinding is given a hand');
  // no hours left: none free, and none given to a task it would give up for this one
  day.free[best] = 0;
  day.hours[best] = day.hours[best].map(() => 0);
  const k = Jobs.post(st, key, 'grind', owner(hh), f.house, { farm: f });
  assert.ok(Day.slotIn(st, hh, k, c), 'slotted again');
  const at = (id) => day.lists[id].indexOf(key);
  assert.ok(
    day.fits[best][at(best)] < 0,
    `the best fit, with no hours, has it after its tasks given hands (${day.fits[best][at(best)]})`,
  );
  const next = Object.keys(day.lists).find((id) => id !== best && at(id) >= 0 && day.fits[id][at(id)] > 0);
  assert.ok(next !== undefined, 'another member is given it');
}
// 5. a member with no hours free takes the meal into its day from the hours of its lesser task, which goes on among the rest
{
  const st = state();
  till(st, DAY + 9);
  const hh = pick(st),
    f = st.farmsteads[hh.farmstead],
    c = Sim.cal(st.t);
  thin(st, hh);
  Day.allot(st, hh, c);
  const day = dayOf(st, hh.id),
    base = 'grind:test:base',
    worker = Object.keys(day.lists).find((id) => day.fits[id][day.lists[id].indexOf(base)] > 0);
  assert.ok(worker !== undefined, 'the grinding is given a hand');
  for (const id of Object.keys(day.free)) day.free[id] = 0; // nobody has hours free (a test's write)
  day.fits[worker][day.lists[worker].indexOf(base)] = 1e-6; // and the grinding a lesser fit than any meal's (a test's write)
  const total = (id) => day.hours[id].reduce((a, b) => a + b, 0),
    had = total(worker);
  const key = `cook:test:${hh.id}`,
    j = Jobs.post(st, key, 'cook', owner(hh), f.house, { farm: f });
  assert.strictEqual(Day.slotIn(st, hh, j, c), true, 'the meal is slotted');
  const hand = Object.keys(day.lists).find(
    (id) => day.lists[id].includes(key) && day.fits[id][day.lists[id].indexOf(key)] === null,
  );
  assert.strictEqual(hand, worker, 'its hand is the member the grinding was given');
  const at = day.lists[hand].indexOf(base),
    cook = day.hours[hand][day.lists[hand].indexOf(key)];
  assert.ok(cook > 0, `the meal is given hours (${cook})`);
  assert.ok(Math.abs(total(hand) - had) < 1e-9, `the hours of its day are those it had (${total(hand)}, ${had})`);
  assert.ok(
    day.hours[hand][at] < had || day.fits[hand][at] < 0,
    'the grinding gave its hours up, or goes on among the rest',
  );
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}
console.log(
  "slot ok: a task slotted lands as the allotment puts it; the milking slotted at 6:00, the lists otherwise standing; the meal heads its hand's list and calls it; no hours left, the next fit; a lesser task's hours taken",
);
