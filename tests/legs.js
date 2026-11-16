// Legs (VB-471, VB-472): a walking pawn's place worked out with no stepping agrees with what the stepping does; a task under work is a
// block (docs/review-blocks.md, steps 1 and 2): its progress is read in closed form between reckonings, and it ends at the step its last
// reckoning foretold, never later. A small constructed state, run for days through its nights, meals and hands.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, A = VB['sim/agents'];
const { state } = require('./lib/probe.js');
const { KINDS } = VB['sim/kinds'], { DAY, TICKS } = VB['sim/rules'];
const st = state(), DAYS = Number(process.argv[2] || 12);
const n = { place: 0, placeBad: 0, tasks: 0, ended: 0, overdue: 0, doneBad: 0, reckoned: 0 }, worst = { place: 0, done: 0 };
const seen = new Map(); // job -> {due, done, at} as reckoned at the step before
const hoursOf = (j) => j.hours ?? KINDS[j.kind].hours;
for (let k = 0; k < DAYS * DAY * TICKS; k++) {
  Sim.advance(st, 1 / TICKS);
  for (const id of st.living) {
    const a = st.agents[id];
    if (!a.path || a.phase === 'road') continue;
    const [x, y] = A.placeOf(st, a), e = Math.hypot(x - a.x, y - a.y);
    n.place++;
    worst.place = Math.max(worst.place, e);
    if (e > 1e-6) n.placeBad++;
  }
  // a task foretold to end at this step has ended (or been reckoned again, its end moved)
  for (const [j, rec] of seen) {
    if (rec.due > st.tick) continue;
    seen.delete(j);
    if (j.due === rec.due && st.jobs.get(j.key) === j && j.rate > 0) n.overdue++;
    else if (rec.due === st.tick) n.ended++;
  }
  for (const j of seen.keys()) if (!(j.rate > 0) || st.jobs.get(j.key) !== j) seen.delete(j); // its hands gone before its end
  for (const j of st.jobs.values()) {
    if ((KINDS[j.kind].attention || 'full') !== 'full' || !(j.rate > 0)) continue;
    const rec = seen.get(j);
    if (!rec) n.tasks++;
    else if (rec.at !== j.at) n.reckoned++;
    seen.set(j, { due: j.due, done: j.done, at: j.at });
    // the progress now is the last reckoning's, and the hours since at its rate, below the task's hours
    const want = Math.min(hoursOf(j), j.done + ((st.tick - j.at) / TICKS) * j.rate), e = Math.abs(A.doneOf(st, j) - want);
    worst.done = Math.max(worst.done, e);
    if (e > 1e-9 || !(A.doneOf(st, j) <= hoursOf(j))) n.doneBad++;
  }
}
console.log('legs:', JSON.stringify(n), JSON.stringify(worst));
assert(n.place > 100 && n.tasks > 20 && n.ended > 10 && n.reckoned > 5, 'the run walked and worked, and tasks were reckoned again');
assert.strictEqual(n.placeBad, 0, 'placeOf agrees with a.x, a.y at every step');
assert.strictEqual(n.doneBad, 0, 'doneOf is the closed form of the last reckoning');
assert.strictEqual(n.overdue, 0, 'no task is left past the step its reckoning foretold');
// a save from before VB-471 (no job.cast) with a task under work: loading reckons it from now and queues its end; the run ends by day,
// so a task is under work
{
  while (![...st.jobs.values()].some((x) => x.rate > 0 && (KINDS[x.kind].attention || 'full') === 'full')) Sim.advance(st, 1 / TICKS);
  const j = [...st.jobs.values()].find((x) => x.rate > 0 && (KINDS[x.kind].attention || 'full') === 'full');
  st.workDue.splice(st.workDue.indexOf(j), 1);
  delete j.at; delete j.rate; delete j.due;
  A.loaded(st);
  assert(j.rate > 0 && j.at === st.tick && st.workDue.includes(j), "an older save's task under work is reckoned and queued at load");
}
