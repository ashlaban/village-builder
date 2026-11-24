// VB-1547: a task of a kind a household lives by, once begun, is carried to its end though the work day ends (sim/kinds carriedOn), and
// the water may be begun after work, until MATCH.day.evening (sim/jobs eveningCall). On the probe island's solo settler: a clearing at work
// at 17:54 is let go at 18:00; water taken at 17:42 is still in hand after 18:00 and delivered; water not in at 19:00 (posted at 18:30, after
// the end of work's call) is fetched that evening; the wood of a cold house is lived by, of a warm one with a full pile not.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Jobs = VB['sim/jobs'];
const { scenario } = require('./lib/probe.js');
const { TICKS, DAY, WORK, cal } = VB['sim/rules'];
const { MATCH } = VB['sim/roles'];
const { KINDS, carriedOn } = VB['sim/kinds'];
const { issue } = VB['sim/commands'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('EVENING FAIL:', m);
  }
};
const st = scenario('solo', 7),
  hh = st.households[st.liveHouseholds[0]],
  id = hh.holder,
  a = st.agents[id],
  f = st.farmsteads[hh.farmstead];
// on to the step that ends at hour h of day d (the clock's count, sim/clock: the hour's work is that step's)
const until = (d, h) => {
  while (st.tick < Math.round((d * DAY + h) * TICKS)) Sim.advance(st, 1 / TICKS);
};
// the day's water fetched before dawn (a test's write), so that it is not posted in the day; then wanted again at hour h, posted as the
// due-queue posts it
const waterAt = (d, h) => {
  until(d, WORK[0] - 1.5);
  hh.waterDay = d;
  until(d, h);
  hh.waterDay = d - 1;
  const key = `water:h${hh.id}:${d}`;
  Jobs.post(st, key, 'water', { type: 'household', id: hh.id }, f.house, { farm: f });
  return key;
};
// the rule's declarations: water and cooking lived by, and the water alone begun in the evening
check(KINDS.water.vital === true && KINDS.cook.vital === true && !KINDS.reap.vital && !KINDS.clear.vital, 'the kinds lived by');
check(KINDS.water.evening && !KINDS.cook.evening, 'only the water is begun in the evening');
// the water's rule posts at the end of work's last ask (18:00) and not from the evening's hour
const posted = [],
  waterWas = hh.waterDay;
for (const hour of [WORK[1], MATCH.day.evening]) {
  hh.waterDay = -1;
  KINDS.water.available(st, hh, f, { hour, day: 0 }, (key) => posted.push([hour, key]));
}
hh.waterDay = waterWas; // the probe's own, so that the run below is the settler's as seeded (VB-1544)
check(posted.length === 1 && posted[0][0] === WORK[1], `the water posted at 18:00, not at 20:00 (${JSON.stringify(posted)})`);
// 1. day 3: the settler clears land at 17:54; at 18:00 the clearing, not lived by, is let go and he goes home
until(3, WORK[1] - 0.1);
const clearing = a.job;
check(clearing && clearing.kind === 'clear' && a.phase === 'work', `at 17:54 the settler clears (${clearing && clearing.kind})`);
until(3, WORK[1] + 0.1);
check(!a.job && (a.phase === 'home' || a.inside), `at 18:00 the clearing is let go (${a.job && a.job.kind}, ${a.phase})`);
// 2. day 16 (day 5 until VB-721 moved the settler's field to drier ground, day 10 until VB-1544 had him raise a booth first): water
// taken at 17:42 is still his after 18:00, and delivered that evening
const k10 = waterAt(16, 17.7);
check(issue(st, VB['sim/fit'].workCommand(id, k10, 'planner')) === true, 'the settler takes the water at 17:42');
until(16, WORK[1] - 0.1);
const before = a.phase,
  n = a.assigned.assignments; // the tasks it has taken: one let go at 18:00 and called again would count anew
until(16, WORK[1] + 0.1);
check(
  a.job && a.job.key === k10 && a.assigned.assignments === n,
  `after 18:00 the water begun (${before} at 17:54) is still in hand, never let go (${a.job && a.job.key})`,
);
until(16, MATCH.day.evening);
check(hh.waterDay === 16, `the water taken at 17:42 is in by 20:00 (waterDay ${hh.waterDay})`);
// 3. day 18 (day 12 until VB-1544): water wanted from 18:30, after the end of work's call; at 19:00 it is not in, and the evening's call sends the settler
const k12 = waterAt(18, WORK[1] + 0.5);
until(18, WORK[1] + 0.9);
check(hh.waterDay !== 18 && !a.job, `at 18:54 the water is not in (waterDay ${hh.waterDay}) and the settler is free`);
until(18, WORK[1] + 1.1);
check(a.job && a.job.key === k12, `at 19:00 the evening's call sends the settler for the water (${a.job && a.job.key})`);
until(18, MATCH.day.evening + 1);
check(hh.waterDay === 18, `the water not in at 19:00 is in that evening (waterDay ${hh.waterDay})`);
check(a.inside && !a.job, `and the settler, free, has gone in (inside ${a.inside})`);
// 4. day 20 (day 14 until VB-1544): none is begun from the evening's hour: water wanted at 20:30 stands unfetched
const k14 = waterAt(20, MATCH.day.evening + 0.5);
until(20, 23.5);
check(hh.waterDay !== 20 && !a.job && st.jobs.get(k14) && !st.jobs.get(k14).claims.length, 'water wanted at 20:30 is not begun');
// 5. the wood of a cold house is lived by; of a warm house with a full pile, not
const wood = { kind: 'wood', farm: f },
  was = [hh.cold, hh.wood];
hh.cold = 0.5;
const cold = carriedOn(st, wood);
hh.cold = 0;
hh.wood = 100;
const warm = carriedOn(st, wood);
[hh.cold, hh.wood] = was;
check(cold && !warm, `the wood lived by in a cold house (${cold}), not in a warm one with a full pile (${warm})`);
if (failed) process.exit(1);
console.log(
  `evening ok: the clearing let go at 18:00; water taken at 17:42 delivered; water not in at 19:00 fetched that evening (${cal(st.t).hour} h)`,
);
