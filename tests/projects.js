// Project plans (VB-123; design.md section 7, Holders and plans, Reservations): a holder's plan of steps in st.plans.projects, each step's task
// made when the one before is done, what its steps spend reserved in the holder's store, and the plan reviewed at once when its open step
// becomes impossible. The acceptance scenario of Test C (docs/architecture/stress-tests.md, section 5): a test-only project spends 40 loads
// of timber over three steps beside the household's year; a second project cannot reserve the same timber; with the timber taken mid-way
// the plan is reviewed and dropped, and nothing stays reserved. Also: a land project's steps, and a save made before project plans.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { setClock } = require('./lib/clock.js');
const { checkState } = require('./lib/invariants.js');
const Plans = VB['sim/plans'], Stores = VB['sim/stores'], F = VB['sim/fieldplans'];
const { KINDS } = VB['sim/kinds'], { DAY, WORK } = VB['sim/rules'], { ROLES } = VB['sim/roles'];
const { island, ROOMY } = require('./lib/probe.js'), world7 = island(7, ROOMY); // the roomy island (heirs needs its room), generated once (VB-862: the full map took 2 s)
const out = [];
const clean = (st, label) => { const bad = checkState(st); assert.deepStrictEqual(bad, [], `${label}: invariants`); };

// A test-only kind of work for a project's step (a barn's: two hands at the house, of the type `wood`); its task is the household's
// project's open step (sim/kinds' landProject posts it), and doing it opens the next step (sim/plans' advance), as the land kinds do.
KINDS.testbuild = { verb: 'Building', go: 'Going to build', name: 'Build', label: 'Build', anim: 'mallet', hours: 6, hands: 2, type: 'wood',
  project: true, done: (st, j) => {
    const plan = VB['sim/projects'].onProject(st, j);
    if (plan) VB['sim/projectplans'].advance(st, plan);
  } };
for (const role of Object.values(ROLES)) role.prio.testbuild = role.work.wood ?? 0;
const BARN = (f) => ({ what: 'barn', steps: [13, 13, 14].map((n) => ({ kind: 'testbuild', place: f.house, hours: 6, spends: { wood: n } })) });

// The heirs' first household with two fields or more, on spring day 1, in the sowing window, with no land project of its own and none to
// come (one project a household), and 100 loads of wood: 40 for the barn and 60 for the fire.
function scene() {
  const st = Sim.seed(world7, 7, 'heirs'), hh = st.households.find((h) => st.farmsteads[h.farmstead].fields.length >= 2), f = st.farmsteads[hh.farmstead];
  setClock(st, DAY + WORK[0]);
  st.makeFields = false; VB['sim/projectplans'].dropAll(st, 'household', hh.id);
  Stores.take(st, hh, 'wood', hh.wood, 'burn'); Stores.put(st, hh, 'wood', 100, 'firewood');
  return { st, hh, f };
}
const woodTaken = (hh) => hh.ledger.filter((e) => e.kind === 'build' && e.good === 'wood').reduce((s, e) => s - e.n, 0);

{ // the barn: reserved in full at once, a second project cannot have the same timber, and the steps are done one after another
  const { st, hh, f } = scene();
  const plan = VB['sim/projectplans'].makeProject(st, 'household', hh.id, BARN(f));
  assert(plan && plan.open === 0 && Stores.reserved(st, hh, 'wood') === 40, 'the plan reserves its 40 loads of timber');
  clean(st, 'made');
  const other = st.households[1];
  Stores.take(st, hh, 'wood', 50, 'burn'); // 50 left: 10 free
  assert.strictEqual(VB['sim/projectplans'].makeProject(st, 'household', hh.id, {
    what: 'shed', steps: [{ kind: 'testbuild', place: f.house, hours: 6, spends: { wood: 11 } }] }), null,
    'a second project cannot reserve the timber the first holds');
  assert(VB['sim/projects'].projectsOf(st, 'household', hh.id).length === 1 && Stores.reserved(st, hh, 'wood') === 40, 'and leaves nothing behind');
  assert(VB['sim/projectplans'].makeProject(st, 'household', other.id, {
    what: 'shed', steps: [{ kind: 'testbuild', place: f.house, hours: 6, spends: { wood: other.wood + 1 } }] })
    === null, 'nor beyond its own holder\'s stock');
  Stores.put(st, hh, 'wood', 50, 'firewood');
  // the household's year goes on beside it: steps open one after another, the fields are tilled, the household is fed, and the plan
  // takes no more hands than its task has (members keep to other work while it is open)
  const hungry0 = hh.hungryDays, opened = [0], worked = new Set();
  let other_work = 0, build_work = 0;
  for (let h = 0; h < 30 * 24 && VB['sim/projects'].ownOf(st, hh.id); h++) {
    Sim.advance(st, 1);
    const p = VB['sim/projects'].ownOf(st, hh.id);
    if (p && p.open !== opened[opened.length - 1]) opened.push(p.open);
    const kinds = hh.members.map((id) => st.agents[id].job && st.agents[id].job.kind).filter(Boolean);
    if (kinds.includes('testbuild')) { build_work++; if (kinds.some((k) => k !== 'testbuild')) other_work++; }
    for (const k of kinds) worked.add(k);
    if (h % 24 === 23) clean(st, `hour ${h + 1}`);
  }
  assert(!VB['sim/projects'].ownOf(st, hh.id), 'the barn is finished within 30 days');
  assert.deepStrictEqual(opened, [0, 1, 2], 'its steps opened in order, each when the one before was done');
  assert.strictEqual(woodTaken(hh), 40, 'its 40 loads were spent, step by step, through the stores');
  assert.strictEqual(Stores.reserved(st, hh, 'wood'), 0, 'and nothing stays reserved');
  assert(other_work > 0 && build_work > 0, `members worked at other things while the barn was built (${other_work} of ${build_work} hours)`);
  assert(['plow', 'sow'].some((k) => worked.has(k)) && ['water', 'cook'].some((k) => worked.has(k)),
    `the fields were tilled and the house kept meanwhile (${[...worked].join(', ')}; ${(st.t / DAY).toFixed(1)}; ${st.farmsteads[hh.farmstead].fields.map(
      (fd) => fd.stage)})`);
  assert(hh.hungryDays === hungry0, 'and the household went no hungry day');
  clean(st, 'finished');
  out.push(`the barn built in ${(st.t / DAY - 1).toFixed(1)} days, ${other_work} of ${build_work} building hours with members at other work`);
}
{ // the timber taken mid-way: the plan is reviewed at once and dropped, told, and nothing stays reserved
  const { st, hh, f } = scene();
  VB['sim/projectplans'].makeProject(st, 'household', hh.id, BARN(f));
  for (let h = 0; h < 30 * 24 && VB['sim/projects'].ownOf(st, hh.id).open < 1; h++) Sim.advance(st, 1);
  const plan = VB['sim/projects'].ownOf(st, hh.id), n = st.record.length;
  assert(plan && plan.open === 1 && Stores.reserved(st, hh, 'wood') === 27, 'the first step done: 27 loads still reserved');
  Stores.take(st, hh, 'wood', hh.wood - 20, 'burn');
  assert(!VB['sim/projects'].ownOf(st, hh.id), 'the plan is dropped at once when its timber is lost');
  assert.strictEqual(Stores.reserved(st, hh, 'wood'), 0, 'its reservation released');
  const told = st.record.slice(n).filter((e) => e.kind === 'projectDropped');
  assert(told.length === 1 && /gives up its new barn: its wood is gone/.test(told[0].text), `the drop is told (${told.map((e) => e.text)})`);
  clean(st, 'dropped');
  Sim.advance(st, 24);
  assert(![...st.jobs.values()].some((j) => j.kind === 'testbuild'), 'its task is taken down');
  out.push('the timber lost mid-way: reviewed, dropped, told, nothing reserved');
}
{ // a store change that leaves the step possible changes nothing; a right lost drops a land project (sim/stakes, rightLost)
  const { st, hh, f } = scene();
  const plan = VB['sim/projectplans'].makeProject(st, 'household', hh.id, BARN(f));
  Stores.take(st, hh, 'wood', 60, 'burn');
  assert(VB['sim/projects'].ownOf(st, hh.id) === plan && VB['sim/projectplans'].review(st, plan), 'the timber still there: the plan stands');
  VB['sim/projectplans'].dropAll(st, 'household', hh.id);
  const t = F.chooseTile(st, f);
  VB['sim/stakes'].stake(st, hh, t, 'field');
  const land = VB['sim/projectplans'].makeProject(st, 'household', hh.id, F.fieldProject(st, hh, t));
  assert(land.steps.map((s) => s.kind).join() === 'clear,break' && land.reasons['grain/barley'] === 'field', 'a field: clearing then breaking, its seed held');
  VB['sim/claims'].dropClaim(st, t, { type: 'household', id: hh.id });
  assert(!VB['sim/projectplans'].review(st, land) && !VB['sim/projects'].ownOf(st, hh.id), 'its stake lost, the land project is dropped at review');
  clean(st, 'stake lost');
  out.push('a right lost drops the plan; a store still covering it does not');
}
{ // a plot: one project plan of its village, its tiles cleared side by side in its first step, then the cottage's stages
  const X = VB['sim/expansion'], st = Sim.seed(world7, 7, 'heirs'), v = st.villages[0];
  st.demand = st.pawns.filter((p) => p.alive && p.age >= 18 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id)).map((p) => p.id).slice(0, 2);
  for (const f of st.farmsteads) if (f.household === null) f.state = 'ruin';
  VB['sim/allotment'].startPlots(st);
  const plan = X.livePlots(st, v)[0];
  assert(plan && plan.what === 'plot' && plan.steps.map((s) => s.kind).join() === 'clear,foundation,walls,roof' && plan.steps[0].places.length === 2,
    'a plot: its tiles\' clearing, then the cottage');
  assert.strictEqual(X.plotJobs(st).filter((j) => j[3].plot === plan).length, 2, 'one task a place, side by side');
  const tr = plan.steps[0].places[0]; X.finishStep(st, { plot: plan, tr });
  clean(st, 'plot under way');
  out.push('a plot is one plan of its village, its tiles cleared side by side');
}
console.log(`projects ok: ${out.join('; ')}`);
