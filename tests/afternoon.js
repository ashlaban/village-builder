// VB-1546: the household's day is allotted again in the afternoon (MATCH.day.afternoon, 14:00), when water's urgency rises above
// cooking's: a lone settler at work past midday, the water wanted from 13:00 at his farm's source (VB-1582), is not called from his work
// by its posting; the day allotted again at 14:00 has the water first, and he leaves his work for it. On the probe island's solo settler.
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
  D = 4; // a day the settler works from the morning to past 14:00 (day 3 until VB-721 moved the settler's field to drier ground, day 5 until VB-1666 put the shelter on the house tile)
// on to the step that ends at hour h of day D (the clock's count, sim/clock: the hour's work is that step's)
const until = (h) => {
  while (st.tick < Math.round((D * DAY + h) * TICKS)) Sim.advance(st, 1 / TICKS);
};
const listOf = () => Plans.planOf(st, 'household', hh.id).day.lists[id];
// the day's water already fetched (a test's write), so that the morning's list is made without it; posted again at 13:00, when its
// urgency is at its midday level, below the clearing the settler is at
until(4.5);
hh.waterDay = D;
until(13);
hh.waterDay = D - 1;
const key = `water:h${hh.id}:${D}`;
Jobs.post(st, key, 'water', { type: 'household', id: hh.id }, VB['sim/water'].sourceOf(st, f).tile, { farm: f });
until(13.5);
const busy = a.job;
check(busy && a.phase === 'work' && busy.key !== key, `at 13:30 the settler works (${busy && busy.kind}, ${a.phase})`);
check(st.jobs.get(key) && !st.jobs.get(key).claims.length, 'at 13:30 the water stands unfetched');
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
