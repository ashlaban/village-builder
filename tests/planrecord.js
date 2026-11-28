// @suite fast
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
// the season: its targets first, steps by the default author, then its routines in order, each serving its target or the template; a
// routine's task names its step, and its chain runs up to the target; the head's order keeps the steps, its author the head's verb; at
// the season's turn its steps are made again (the last folded), the fields' target carried; a store's target read by Steps.targetOf
{
  const S = plan.season, Se = VB['sim/seasonal'], c = Sim.cal(st.t);
  assert.deepStrictEqual(S.slice(0, 4).map((s) => s.what.target.store), ['wood', 'hay', 'seed', 'fields'], 'the targets come first');
  assert(S.every((s) => s.author === 'custom' && s.from <= c.day && s.by === c.day - c.sday + VB['sim/rules'].SEASON_DAYS - 1), 'by the custom, this season');
  assert.deepStrictEqual(Se.routinesOf(plan), Se.ROUTINES[c.season], "the routines in the template's order");
  const wood = S.find((s) => s.what.routine === 'wood'), other = S.find((s) => s.what.routine && s.what.routine !== 'wood' && !['hay', 'mow'].includes(s.what.routine));
  assert.deepStrictEqual(wood.why, { step: S[0].id, of: `household:${hh.id}` }, 'the wood routine serves the woodpile');
  assert.deepStrictEqual(other.why, { custom: 'template' });
  assert.strictEqual(Steps.targetOf(plan, 'wood'), S[0].what.target);
  assert.strictEqual(Steps.targetOf(plan, 'none'), null);
  const jw = VB['sim/jobs'].post(st, `wood:test:${hh.id}`, 'wood', { type: 'household', id: hh.id }, tile, { farm: f, chosen: true });
  assert.strictEqual(jw.step, wood.id, "a routine's task names the routine");
  assert.deepStrictEqual(Sim.why(st, jw).map((s) => s.id), [wood.id, S[0].id], 'its chain runs up to the target');
  const turned = [...Se.routinesOf(plan)].reverse(), ids = new Set(S.map((s) => s.id));
  Se.setOrder(st, hh.id, turned);
  assert.deepStrictEqual(Se.routinesOf(plan), turned);
  assert(plan.season.every((s) => ids.has(s.id)) && plan.season.filter((s) => s.what.routine).every((s) => s.author === 'pawn'), "the head's order keeps the steps");
  assert.strictEqual(Sim.headView(st, hh.id).orderBy, 'head');
  const F = Steps.targetOf(plan, 'fields'), was = { level: F.level, workable: F.workable }, first = S[0].id;
  Se.seasonal(st, plan, Sim.cal(st.t + VB['sim/rules'].SEASON_DAYS * DAY));
  const F2 = Steps.targetOf(plan, 'fields');
  assert(plan.season[0].id > first && F2 !== F && F2.level === was.level && F2.workable === was.workable, 'the season made again, the fields carried');
  assert(plan.season.every((s) => s.author === 'custom'), "the template's order again");
  assert.deepStrictEqual(require('./lib/invariants.js').checkState(st).filter((x) => x.startsWith('plans')).filter((x) => !/not in the current season/.test(x)), [], 'the record holds');
}
// VB-1826: a season step's hours left by its head's estimate: a wood target below its level has lo <= mid <= hi, more than 0; met, 0
{
  const hh2 = st.households.find((h) => !h.dissolved && st.plans.households.get(h.id).head);
  const pl = st.plans.households.get(hh2.id),
    W = Steps.targetOf(pl, "wood");
  const c = VB['sim/rules'].cal(st.t);
  const left = () => pl.season.find((s) => s.what.target && s.what.target.store === 'wood').left;
  W.seasons[c.season] = hh2.wood + 5 * st.ECON.woodPerTrip;
  VB["sim/plans"].reviewed(st, pl, c);
  const l = left();
  assert(l.lo <= l.mid && l.mid <= l.hi && l.mid > 0, 'a wood target below its level has hours left');
  W.seasons[c.season] = 0;
  VB["sim/plans"].reviewed(st, pl, c);
  assert.strictEqual(left().mid, 0, 'one met has none');
  // VB-1867: seed and a made good below their level have hours left too
  const S = Steps.targetOf(pl, 'seed'),
    leftOf = (store) => pl.season.find((x) => x.what.target && x.what.target.store === store).left;
  S.level = (hh2.grain.barley || 0) + 50;
  VB['sim/plans'].reviewed(st, pl, c);
  let ls = leftOf('seed');
  assert(ls.lo <= ls.mid && ls.mid <= ls.hi && ls.mid > 0, 'a seed target below its level has hours left');
  pl.chosen = Object.assign(pl.chosen || { goods: {} }, {});
  pl.chosen.goods = Object.assign(pl.chosen.goods || {}, { ale: VB['sim/targets'].MADE.get('ale').held(st, hh2) + 3 });
  VB['sim/plans'].reviewed(st, pl, c);
  ls = leftOf('ale');
  assert(ls.lo <= ls.mid && ls.mid <= ls.hi && ls.mid > 0, 'a made good below its level has hours left');
}
console.log('planrecord ok');
