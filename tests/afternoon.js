// VB-1546: the household's day is allotted again in the afternoon (MATCH.day.afternoon, 14:00), when water's urgency rises above
// cooking's: a lone settler clearing land through the late morning, the water standing below the clearing in his list, leaves the clearing
// for the water after 14:00, and the afternoon's list has the water first, for a free hand to take. On the probe island's solo settler.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Jobs = VB['sim/jobs'],
  Plans = VB['sim/plans'];
const { scenario } = require('./lib/probe.js');
const { TICKS, DAY, cal } = VB['sim/rules'];
const { MATCH } = VB['sim/roles'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('AFTERNOON FAIL:', m);
  }
};
const st = scenario('solo', 7),
  hh = st.households[st.liveHouseholds[0]],
  id = hh.holder,
  a = st.agents[id],
  f = st.farmsteads[hh.farmstead],
  D = 3; // a day the settler clears land from the morning to past 14:00
// on to the step that ends at hour h of day D (the clock's count, sim/clock: the hour's work is that step's)
const until = (h) => {
  while (st.tick < Math.round((D * DAY + h) * TICKS)) Sim.advance(st, 1 / TICKS);
};
const listOf = () => Plans.planOf(st, 'household', hh.id).day.lists[id];
// the day's water already fetched (a test's write), so that the morning's list is made without it; posted again at 10:00, when its
// urgency has fallen to its midday level, below the clearing the settler is at
until(4.5);
hh.waterDay = D;
until(10);
hh.waterDay = D - 1;
const key = `water:h${hh.id}:${D}`;
Jobs.post(st, key, 'water', { type: 'household', id: hh.id }, f.house, { farm: f });
// a task posted by the test's hand marks no day as changed (only a review's post does), and a village's review alone no longer allots
// its households anew (VB-1554): the head's day is allotted here, as the review that posted it would
Jobs.allot(st, hh, cal(st.t));
until(13.5);
const busy = a.job;
check(busy && a.phase === 'work' && busy.key !== key, `at 13:30 the settler works (${busy && busy.kind}, ${a.phase})`);
check(st.jobs.get(key) && !st.jobs.get(key).claims.length, 'at 13:30 the water stands unfetched');
const before = listOf();
check(
  before.includes(key) && before.indexOf(key) > before.indexOf(busy.key),
  `before 14:00 the water stands below the ${busy.kind} in his list (${before.indexOf(key)})`,
);
const c13 = cal(st.t),
  w13 = Jobs.score(st, st.pawns[id], st.jobs.get(key), c13, undefined, 1),
  b13 = Jobs.score(st, st.pawns[id], busy, c13, undefined, 1);
check(w13 < b13, `before 14:00 the water's fit ${w13} is below the ${busy.kind}'s ${b13}`);
const W = VB['sim/work'],
  left = (busy.hours ?? VB['sim/kinds'].KINDS[busy.kind].hours) - W.doneOf(st, busy);
check(left > 2, `the ${busy.kind} has hours to run past 14:00 (${left})`);
until(MATCH.day.afternoon + 0.1);
const made = Plans.planOf(st, 'household', hh.id).day.made;
check(
  made === D * DAY + MATCH.day.afternoon,
  `the day allotted again at ${MATCH.day.afternoon}:00 (made ${made % DAY})`,
);
check(listOf()[0] === key, `from 14:00 the water heads his list (${listOf()[0]})`);
check(
  a.job && a.job.key === key,
  `after 14:00 the settler has left the ${busy.kind} for the water (${a.job && a.job.kind})`,
);
if (failed) process.exit(1);
console.log(
  `afternoon ok: allotted again at 14:00, the settler leaves the ${busy.kind} for the water, which heads his list`,
);
