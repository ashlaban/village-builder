// Legs foretold beside the stepping (VB-471): a walking pawn's place, a task's progress and its end, worked out with no stepping, agree
// with what the stepping does (docs/review-blocks.md, step 1). A small constructed state, run for days through its nights, meals and hands.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, A = VB['sim/agents'];
const { state } = require('./lib/probe.js');
const { KINDS } = VB['sim/kinds'], { DAY, TICKS } = VB['sim/rules'];
const st = state(), DAYS = Number(process.argv[2] || 12);
const n = { place: 0, placeBad: 0, tasks: 0, ended: 0, off: 0, doneBad: 0 }, worst = { place: 0, due: 0, done: 0 };
const seen = new Map(); // job -> {due, done, rate, left} as foretold at the step before
for (let k = 0; k < DAYS * DAY * TICKS; k++) {
  Sim.advance(st, 1 / TICKS);
  for (const id of st.living) {
    const a = st.agents[id];
    if (!a.path || a.phase === 'road' || a.work) continue;
    const [x, y] = A.placeOf(st, a), e = Math.hypot(x - a.x, y - a.y);
    n.place++;
    worst.place = Math.max(worst.place, e);
    if (e > 1e-6) n.placeBad++;
  }
  for (const [j, rec] of seen) {
    const hours = j.hours ?? KINDS[j.kind].hours;
    if (st.jobs.get(j.key) === j && j.done < hours - 1e-9 && j.done >= rec.done - 1e-9) continue; // still on
    seen.delete(j);
    if (!(rec.left <= rec.rate / TICKS + 1e-9) && !(j.done >= hours - 1e-9)) continue; // taken down unfinished
    n.ended++;
    const off = Math.abs(st.tick - rec.due);
    worst.due = Math.max(worst.due, off);
    if (off > 1) n.off++;
  }
  for (const j of st.jobs.values()) {
    if ((KINDS[j.kind].attention || 'full') !== 'full') continue;
    if (!j.cast || !j.claims.length) { seen.delete(j); continue; }
    const hours = j.hours ?? KINDS[j.kind].hours, due = A.dueOf(st, j);
    if (due === null || j.done >= hours) { seen.delete(j); continue; }
    if (!seen.has(j)) n.tasks++;
    seen.set(j, { due, done: j.done, rate: j.cast.rate, left: hours - j.done });
    const e = Math.abs(A.doneOf(st, j) - j.done);
    worst.done = Math.max(worst.done, e);
    if (e > j.cast.rate / TICKS + 1e-6) n.doneBad++; // a hand leaving mid-step is told after the hands before it
  }
}
console.log('legs:', JSON.stringify(n), JSON.stringify(worst));
assert(n.place > 100 && n.tasks > 20, 'the run walked and worked');
assert.strictEqual(n.placeBad, 0, 'placeOf agrees with a.x, a.y at every step');
assert.strictEqual(n.doneBad, 0, 'doneOf agrees with j.done');
assert.strictEqual(n.off, 0, 'every task ends within a step of what was foretold');
