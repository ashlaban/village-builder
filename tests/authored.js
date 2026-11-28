// @suite integration
// An authored step and the default author (VB-1755; design.md section 7, Plans at four scales: Authors; A step at risk, and the
// take-back): the household's daily work goes before anything authored; the verb plan refuses a task that cannot be done by its `by`
// and dates an undated one; at the household's review a task its head's estimate says will not be done by its `by` is at risk, planned
// again once it would be, and taken back by the default author past its `by`, unless kept; the card says so. On a small constructed
// state: three farms on open ground, spring day 0.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Steps = VB['sim/steps'];
const { DAY, WORK } = VB['sim/rules'],
  { KINDS, dailyNow } = VB['sim/kinds'],
  { CHILD } = VB['sim/roles'],
  { age } = VB['sim/records'];
const { reasonLine } = VB['sim/reasons'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => {
  const s = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  s.naturalDeaths = false;
  Sim.advance(s, 3);
  return s;
};
const today = (s) => Math.floor(s.t / DAY);

// 1. The daily work before anything authored (Q12's second half): a household with about 30% of its members on their own plans, each
// authoring tasks of its household drawn at random, over six days: no daily task (the water, the meal, the fire) stands unmanned in the
// working hours longer than with nothing authored, and none is left at the end; no step is weighed at a review with nothing authored.
function arm(share, days, seed) {
  const s = make();
  s.makeFields = false;
  let r = seed >>> 0;
  const draw = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const hh = s.households[0],
    planners = share ? hh.members.filter((m) => age(s, s.pawns[m]) >= CHILD.from && draw() < share) : [];
  for (const id of planners) assert.strictEqual(Sim.setAuto(s, id, false), true);
  const r0 = VB.count.riskCheck,
    end = s.t + days * DAY;
  let unmanned = 0,
    authored = 0;
  while (s.t < end) {
    const h = s.t % DAY;
    if (Math.abs(h - WORK[0]) < 0.05)
      for (const id of planners) {
        const have = new Set((Steps.pawnPlan(s, id) || { tasks: [] }).tasks.map((g) => g.key)),
          js = [...(s.jobsBy.get('household:0') || [])].filter((j) => !KINDS[j.kind].daily && !have.has(j.key));
        while ((Steps.pawnPlan(s, id) || { tasks: [] }).tasks.length < 3 && js.length)
          if (Sim.plan(s, id, 'add', { key: js.splice(Math.floor(draw() * js.length), 1)[0].key }) === true) authored++;
      }
    Sim.advance(s, 0.1);
    if (h >= WORK[0] && h < WORK[1])
      for (const j of s.jobsBy.get('household:0') || []) if (dailyNow(s, j) && !j.claims.length) unmanned += 0.1;
  }
  const left = [...(s.jobsBy.get('household:0') || [])].filter(
    (j) => dailyNow(s, j) && j.posted !== undefined && j.posted < today(s) * DAY,
  );
  return { s, planners, authored, unmanned, left, risk: VB.count.riskCheck - r0 };
}
for (const seed of [1, 2, 3]) {
  const none = arm(0, 6, seed),
    some = arm(0.3, 6, seed);
  assert(
    some.planners.length && some.authored > 0,
    `seed ${seed}: some members author their steps (${some.planners}, ${some.authored} tasks)`,
  );
  assert(
    some.unmanned <= none.unmanned + 0.05,
    `seed ${seed}: no daily hour crowded out: ${some.unmanned.toFixed(1)} unmanned, ${none.unmanned.toFixed(1)} with nothing authored`,
  );
  assert.deepStrictEqual(
    some.left.map((j) => j.key),
    [],
    `seed ${seed}: no daily task left from an earlier day`,
  );
  assert.strictEqual(none.risk, 0, 'nothing authored: no step weighed at the review');
  checkState(some.s);
}

// 2. The verb plan's check and the default `by`; at risk at the review, planned again, and taken back past its `by`.
{
  const s = make();
  for (const p of s.pawns) if (p.id > 1 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0),
    review = () => VB['sim/plans'].reviewed(s, P, Sim.cal(s.t), 'store'),
    step = () => Steps.pawnPlan(s, 0).steps[0];
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  const no = Sim.plan(s, 0, 'add', { key: 'clear:f0', by: today(s) });
  assert(
    typeof no === 'string' && /cannot do job clear:f0 by day 0/.test(no),
    `a task that cannot be done by its by is refused: ${no}`,
  );
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'clear:f0' }), true);
  assert(Number.isInteger(step().by) && step().by >= today(s), `an undated task is given a by: ${step().by}`);
  assert.strictEqual(Sim.plan(s, 0, 'remove', { i: 0 }), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'plow:f0.0', by: 2 }), true);
  assert.strictEqual(Sim.plan(s, 0, 'sleep', { from: 9, until: 8 }), true); // its author sleeps through: the step will not be done
  const r0 = VB.count.riskCheck;
  review();
  assert(VB.count.riskCheck > r0, 'its step weighed at the review');
  assert.strictEqual(step().state, 'planned', 'in time: planned');
  Steps.dateTask(s, 0, 0, { by: today(s) }); // dated by hand past what the verb would take
  review();
  assert(
    step().state === 'at-risk' && step().risk.short > 0,
    `short of its by: at risk ${JSON.stringify(step().risk)}`,
  );
  Steps.dateTask(s, 0, 0, { by: 2 });
  review();
  assert(step().state === 'planned' && !step().risk, 'in time again: planned again');
  Steps.dateTask(s, 0, 0, { by: today(s) });
  review();
  const since = step().risk.since;
  let taken = null;
  for (let i = 0; i < 40 * 10 && !taken; i++) {
    Sim.advance(s, 0.1);
    taken = P.ahead.find((x) => x.tookBack);
    if (!taken)
      assert(Steps.pawnPlan(s, 0).steps.length === 1 && step().state === 'at-risk', 'at risk until it is taken back');
  }
  assert(taken, 'the default author takes it back');
  assert(
    today(s) > 0 && taken.tookBack.from === 0 && taken.tookBack.by === 0 && taken.tookBack.t > since,
    JSON.stringify(taken),
  );
  assert(
    taken.author === 'custom' && taken.state === 'open' && taken.by >= today(s),
    `the household's now: ${JSON.stringify(taken)}`,
  );
  assert.strictEqual(Steps.pawnPlan(s, 0).steps.length, 0, "and no longer its author's");
  assert(P.day.lists[1].includes('plow:f0.0'), 'given to a hand of the household');
  let line = null;
  for (let i = 0; i < 2 * 24 * 10 && !line; i++) {
    Sim.advance(s, 0.1);
    const j = s.jobs.get('plow:f0.0');
    if (j && j.claims.includes(1)) line = reasonLine(s, 1);
  }
  assert(
    line && /taken back from .* plan by the household's day: it would not be done by day 0/.test(line),
    `the card says so: ${line}`,
  );
  checkState(s);
}

// 3. A kept step is never taken back, and the card warns of its risk while it lasts.
{
  const s = make();
  for (const p of s.pawns) if (p.id > 1 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0),
    step = () => Steps.pawnPlan(s, 0).steps[0];
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'plow:f0.0', by: 2 }), true);
  assert.strictEqual(Sim.plan(s, 0, 'keep', { i: 0 }), true);
  Steps.dateTask(s, 0, 0, { by: today(s) });
  VB['sim/plans'].reviewed(s, P, Sim.cal(s.t), 'store');
  assert(step().state === 'at-risk' && step().kept, 'kept, at risk');
  let line = null;
  for (let i = 0; i < 4 * 10 && !line; i++) {
    Sim.advance(s, 0.1);
    if (s.jobs.get('plow:f0.0').claims.includes(0)) line = reasonLine(s, 0);
  }
  assert(
    line && /\(kept to its plan, at risk: [\d.]+ hours short of done by day 0\)/.test(line),
    `the card warns: ${line}`,
  );
  const from = (Math.floor(s.t % DAY) + 1) % 24; // then its author sleeps through: the step will not be done
  assert.strictEqual(Sim.plan(s, 0, 'sleep', { from, until: (from + 23) % 24 }), true);
  const past = DAY + WORK[0] + 1; // past its by and the household's review of the next morning
  while (s.t < past && s.jobs.has('plow:f0.0')) {
    Sim.advance(s, 0.1);
    assert(!P.ahead.some((x) => x.tookBack), 'never taken back');
  }
  assert(s.jobs.has('plow:f0.0'), 'the task is not done by then');
  assert(
    Steps.pawnPlan(s, 0).steps.length === 1 && step().kept && step().state === 'at-risk',
    'still its own, at risk',
  );
  checkState(s);
}
// 4. A task at a tile (VB-1842): estimated from the steps its chain has left, so the verb dates it, refuses it past what fits, and the
// review finds it at risk and takes it back unless kept, as a task by key.
{
  const s = make();
  for (const p of s.pawns) if (p.id > 1 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0),
    site = s.jobs.get('clear:f0').site,
    review = () => VB['sim/plans'].reviewed(s, P, Sim.cal(s.t), 'store'),
    step = () => Steps.pawnPlan(s, 0).steps[0];
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  const no = Sim.plan(s, 0, 'add', { plant: site, by: today(s) });
  assert(
    typeof no === 'string' && /cannot do plant at \d+ by day 0/.test(no),
    `a task at a tile that cannot be done by its by is refused: ${no}`,
  );
  assert.strictEqual(Sim.plan(s, 0, 'add', { plant: site }), true);
  assert(Number.isInteger(step().by) && step().by >= today(s), `an undated task at a tile is given a by: ${step().by}`);
  const r0 = VB.count.riskCheck;
  Steps.dateTask(s, 0, 0, { by: today(s) });
  review();
  assert(VB.count.riskCheck > r0, 'its chain weighed at the review');
  assert(
    step().state === 'at-risk' && step().risk.short > 0,
    `short of its by: at risk ${JSON.stringify(step().risk)}`,
  );
  Steps.dateTask(s, 0, 0, { by: 20 });
  review();
  assert(step().state === 'planned' && !step().risk, 'in time again: planned again');
  Steps.dateTask(s, 0, 0, { by: today(s) });
  review();
  Steps.keepTask(s, 0, 0, true);
  review();
  assert(step().state === 'at-risk' && Steps.pawnPlan(s, 0).steps.length === 1, 'kept: never taken back');
  Steps.keepTask(s, 0, 0, false);
  s.t += DAY; // past its by, with the risk found at an earlier review
  step().risk.since -= 1;
  review();
  const taken = P.ahead.find((x) => x.tookBack);
  assert(
    taken && taken.author === 'custom' && Steps.pawnPlan(s, 0).steps.length === 0,
    'past its by and not kept: taken back',
  );
  checkState(s);
}
// 5. A solo hand (VB-1879): the only member is the played pawn on its own plan (auto off), so no hand of the household's day is left to
// take an at-risk step over: it stays on the pawn's plan, at risk, rather than leave for a plan no one works.
{
  const s = make();
  for (const p of s.pawns) if (p.id > 0 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0),
    site = s.jobs.get('clear:f0').site,
    step = () => Steps.pawnPlan(s, 0).steps[0];
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { plant: site }), true);
  Steps.dateTask(s, 0, 0, { by: today(s) });
  VB['sim/plans'].reviewed(s, P, Sim.cal(s.t), 'store');
  s.t += DAY;
  step().risk.since -= 1;
  VB['sim/plans'].reviewed(s, P, Sim.cal(s.t), 'store');
  assert(!P.ahead.some((x) => x.tookBack), 'a solo hand: nothing taken back to the household');
  assert(step() && step().state === 'at-risk', "the step stays on the pawn's plan, at risk");
  checkState(s);
}
// 6. The take-back is the next morning whatever the head's cadence (VB-1892): a household with a member on its own plan is reviewed at the
// first review hour of the day after the step's by, though its own next review is far off; taken back there, or, kept, it stays and warns.
for (const kept of [false, true]) {
  const s = make();
  for (const p of s.pawns) if (p.id > 1 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0),
    step = () => Steps.pawnPlan(s, 0).steps[0];
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'plow:f0.0', by: 2 }), true);
  if (kept) assert.strictEqual(Sim.plan(s, 0, 'keep', { i: 0 }), true);
  assert.strictEqual(Sim.plan(s, 0, 'sleep', { from: 9, until: 8 }), true);
  P.nextReview = 1e9; // a cadence that would not look for days
  const first = (d) => d * DAY + WORK[0] - 1;
  while (s.t < first(3) - 0.5) Sim.advance(s, 0.1);
  assert(Steps.pawnPlan(s, 0).steps.length === 1 && !P.ahead.some((x) => x.tookBack), 'still its own on the by day');
  const r0 = VB.count.riskCheck;
  while (s.t < first(3) + 0.3) Sim.advance(s, 0.1);
  assert(VB.count.riskCheck > r0, 'weighed at the first review past its by');
  if (kept)
    assert(
      Steps.pawnPlan(s, 0).steps.length === 1 && step().kept && !P.ahead.some((x) => x.tookBack),
      'kept: it stays',
    );
  else {
    const taken = P.ahead.find((x) => x.tookBack);
    assert(taken && Steps.pawnPlan(s, 0).steps.length === 0, 'taken back at that review');
    assert(
      Object.values(P.day.lists).some((l) => l.includes('plow:f0.0')),
      'slotted into the day',
    );
  }
  checkState(s);
}
// 7. A planner who falls ill (VB-1894): its two tasks by key go to the household's day within the hour, the cards saying why; with one
// kept, that one stays on its plan, at risk, with the reason.
for (const kept of [false, true]) {
  const s = make();
  for (const p of s.pawns) if (p.id > 1 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0);
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'plow:f0.0' }), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'clear:f0' }), true);
  if (kept) assert.strictEqual(Sim.plan(s, 0, 'keep', { i: 0 }), true);
  s.pawns[0].ill = { since: s.t };
  VB['sim/events'].emit(s, 'fellIll', { pawn: 0 });
  Sim.advance(s, 1);
  const taken = P.ahead.filter((x) => x.tookBack);
  assert.strictEqual(taken.length, kept ? 1 : 2, 'taken back');
  assert(
    taken.every((x) => x.tookBack.why === 'fell ill'),
    'the card says why',
  );
  for (const x of taken)
    assert(
      Object.values(P.day.lists).some((l) => l.includes(x.what.goal.key)),
      `${x.what.goal.key} in the day`,
    );
  if (kept) {
    const st = Steps.pawnPlan(s, 0).steps;
    assert(
      st.length === 1 && st[0].kept && st[0].state === 'at-risk' && st[0].risk.why === 'fell ill',
      'the kept step stays, at risk',
    );
  } else assert.strictEqual(Steps.pawnPlan(s, 0).steps.length, 0);
  checkState(s);
}
// 8. A planner who dies (VB-1894): its task by key is taken back with the reason, not dropped.
{
  const s = make();
  for (const p of s.pawns) if (p.id > 1 && p.alive) VB['sim/lifecycle'].killPawn(s, p.id);
  Sim.advance(s, 0.1);
  const P = s.plans.households.get(0);
  assert.strictEqual(Sim.setAuto(s, 0, false), true);
  assert.strictEqual(Sim.plan(s, 0, 'add', { key: 'plow:f0.0' }), true);
  VB['sim/lifecycle'].killPawn(s, 0);
  const taken = P.ahead.filter((x) => x.tookBack);
  assert(taken.length === 1 && taken[0].tookBack.why === 'died', 'taken back at a death');
}
console.log('authored: ok');
