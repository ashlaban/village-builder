// VB-1752: the plan record (design.md section 7, Plans at four scales: The plan record, How a step becomes work): every live household and
// village has one; a project plan is a year step of its holder's plan, its own steps under it, each with an id, an author, a state and a
// `why` that resolves; a posted task names the step that opened it; Sim.why gives the chain upward and Sim.plans the record, a copy.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { state } = require('./lib/probe.js');
const { DAY, WORK } = VB['sim/rules'];
const Steps = VB['sim/steps'];

const st = state();
Sim.advance(st, DAY + (WORK[0] + 2 - (st.t % DAY)));
// every live body has its record
for (const id of st.liveHouseholds) {
  const plan = st.plans.households.get(id);
  assert.deepStrictEqual(plan.body, { kind: 'household', id }, `household ${id}'s plan names its body`);
  assert(Array.isArray(plan.year) && Array.isArray(plan.ahead), `household ${id}'s plan has its lists`);
}
for (const v of st.villages) assert.deepStrictEqual(st.plans.villages.get(v.id).body, { kind: 'village', id: v.id });
// a project made for a household is a year step of its plan, its steps linked under it; done steps marked, the open one open
const hh = st.households.find((h) => !h.dissolved && h.farmstead !== null && st.farmsteads[h.farmstead].household === h.id),
  plan = st.plans.households.get(hh.id),
  f = st.farmsteads[hh.farmstead];
const tile = f.house; // a tile of the farm: the record does not check the land
const p = VB['sim/projectplans'].makeProject(st, 'household', hh.id, {
  what: 'test',
  steps: [
    { kind: 'clear', place: tile, hours: 6 },
    { kind: 'break', place: tile, hours: 4 },
  ],
});
const y = plan.year.find((s) => s.what.project === p.id);
assert(y && y.author === 'custom' && y.state === 'open' && y.why.custom === 'test', 'the project is a year step of its plan');
assert.deepStrictEqual(y.left, { lo: 10, mid: 10, hi: 10 }, 'its hours still to do are its steps');
assert(p.steps.every((s) => Number.isInteger(s.id) && s.why.step === y.id && s.why.of === `household:${hh.id}`), 'each step links up');
assert.deepStrictEqual(
  p.steps.map((s) => s.state),
  ['open', 'planned'],
);
// a task posted for its open step names that step, and its chain runs up to the project's custom
const j = VB['sim/jobs'].post(st, `clear:test:${hh.id}`, 'clear', { type: 'household', id: hh.id }, tile, {});
assert.strictEqual(j.step, p.steps[0].id, 'the task names the step that opened it');
const C = Sim.why(st, j);
assert.deepStrictEqual(
  C.map((s) => s.id),
  [p.steps[0].id, y.id],
  'the chain runs from the task up to its project',
);
assert.deepStrictEqual(C[1].why, { custom: 'test' });
assert.strictEqual(Steps.find(st, plan, p.steps[1].id), p.steps[1], 'a step is found by its id');
// the step done: it is marked, the next opened, the year step's hours fall; the last done, the year step leaves the list
VB['sim/projectplans'].advance(st, p);
assert.deepStrictEqual(
  p.steps.map((s) => s.state),
  ['done', 'open'],
);
assert.strictEqual(y.left.mid, 4);
VB['sim/projectplans'].advance(st, p);
assert(!plan.year.some((s) => s.what.project === p.id), 'a finished project leaves the live list');
// Sim.plans: the record, a copy, with its agent
const R = Sim.plans(st, { kind: 'household', id: hh.id });
assert.strictEqual(R.agent, hh.holder);
R.year.push('x');
assert(!plan.year.includes('x'), 'the record shown is a copy');
assert.strictEqual(Sim.plans(st, { kind: 'pawn', id: 0 }), null, 'a pawn that holds no step has no record');
console.log('planrecord ok');
