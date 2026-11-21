// VB-255 (design.md section 7, How a holder chooses: projects): a head with a surplus takes one project from a menu weighed by its values,
// and drops it when the surplus is gone a whole season; a barn halves what the farm loses to spoilage, of grain and of barn hay. On a tiny
// village.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const A = VB['sim/aims'], P = VB['sim/plans'], Projects = VB['sim/projects'], Stores = VB['sim/stores'], Traits = VB['sim/traits'];
const { spoilGrain } = VB['sim/hunger'], { spoilHay } = VB['sim/byre'], { issue } = VB['sim/commands'];
const { DAY, SEASON_DAYS, HERD, WORK, BUILD, cal } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFFFFFF' : '....................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [9, 8], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// a barn halves the grain lost to spoilage and the barn hay lost (BUILD.barn.loss)
{
  const st = make(), hh = st.households[0], f = st.farmsteads[hh.farmstead];
  Stores.put(st, hh, Stores.grainGood('barley'), 3000, 'harvest');
  hh.hay = 40;
  const lose = () => {
    const g = Stores.grainOf(hh), h = hh.hay;
    spoilGrain(st, hh);
    spoilHay(st, hh);
    const out = [g - Stores.grainOf(hh), h - hh.hay];
    Stores.put(st, hh, Stores.grainGood('barley'), out[0], 'harvest');
    hh.hay = h;
    return out;
  };
  const [g0, h0] = lose();
  assert.ok(g0 > 0 && h0 > 0, 'grain and hay spoil without a barn');
  f.barn = { built: st.t };
  const [g1, h1] = lose();
  assert.ok(near(g1, g0 * BUILD.barn.loss, 1e-6), `grain lost with a barn ${g1} is half of ${g0}`);
  assert.ok(near(h1, h0 * BUILD.barn.loss, 1e-9), `hay lost with a barn ${h1} is half of ${h0}`);
  assert.deepStrictEqual(checkState(st), [], 'invariants with a barn');
}

// the idle share of the last season, from the hours the household's hands worked (household.workHours, counted by sim/agents)
{
  const st = make();
  Sim.advance(st, 3 * DAY);
  const hh = st.households[0], c = cal(st.t), key = c.year * 4 + c.season;
  assert.ok(hh.workHours && hh.workHours[0] === key && hh.workHours[1] > 0, `the hands' work is counted: ${JSON.stringify(hh.workHours)}`);
  let hands = 0;
  for (const id of hh.members) { const p = st.pawns[id]; if (p.alive && !p.retired && p.age >= 14 && p.age < 60) hands++; }
  const full = hands * (WORK[1] - WORK[0]) * SEASON_DAYS;
  hh.workHours = [key, 5, full / 2]; // lint-allow: owner the test sets the count
  assert.ok(near(A.idleShare(st, hh, c), 0.5), 'half the last season idle');
  hh.workHours = [key - 1, full / 4, 0]; // lint-allow: owner the season turned with no work counted since
  assert.ok(near(A.idleShare(st, hh, c), 0.75), 'read across the season turn');
  hh.workHours = [key - 2, full, 0]; // lint-allow: owner
  assert.strictEqual(A.idleShare(st, hh, c), 1, 'no work counted last season');
}

// to the first review after the autumn count, with a household set to a surplus: stores well over 1.5 years, its targets met, idle
function surplusState() {
  const st = make();
  const c0 = cal(st.t);
  Sim.advance(st, ((HERD.countDay + 1 - c0.doy + 48) % 48) * DAY);
  const hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = st.plans.households.get(hh.id), c = cal(st.t);
  for (const p of [...Projects.projectsOf(st, 'household', hh.id)]) P.drop(st, p);
  Stores.put(st, hh, Stores.grainGood('barley'), 5000, 'harvest');
  Stores.put(st, hh, 'wood', 200, 'firewood');
  hh.hay = plan.targets.hayWinters * VB['sim/herds'].winterNeed(st, hh) + 5;
  plan.targets.fields = f.fields.length; // lint-allow: owner the test meets the fields' target
  plan.targets.workable = f.fields.length + 2; // lint-allow: owner and gives hands for more
  hh.workHours = [c.year * 4 + c.season, 0, 0]; // lint-allow: owner idle all the last season
  delete plan.aim; // lint-allow: owner no look at the surplus yet
  return { st, hh, f, plan, c };
}
{
  const { st, hh, f, plan, c } = surplusState();
  const s = A.surplusOf(st, plan, hh, f, c);
  assert.deepStrictEqual(s, { met: true, food: true, idle: true, all: true }, 'a surplus');
  const ambition = 0.6;
  st.pawns[hh.holder].traits[Traits.IDX.ambition] = ambition; // lint-allow: owner the test sets the head's lean
  const menu = A.menu(st, plan, hh, f), by = Object.fromEntries(menu.map((o) => [o.what, o]));
  assert.ok(by.field && by.claim && by.barn, `field, claim and barn open: ${menu.map((o) => o.what)}`);
  assert.ok(near(by.field.weight, 1 + ambition) && near(by.claim.weight, 1 + ambition), 'the field and the claim lean by ambition');
  assert.strictEqual(by.barn.weight, 1, 'the barn leans by nothing');
  // one draw from the stream plans over the weights: at its least the first option, at its most the last
  st.rng.plans.fix = 0;
  assert.strictEqual(A.choose(st, menu).what, menu[0].what);
  st.rng.plans.fix = 0.999999;
  assert.strictEqual(A.choose(st, menu).what, menu[menu.length - 1].what);
  const total = menu.reduce((a, o) => a + o.weight, 0);
  st.rng.plans.fix = (menu[0].weight + 1e-6) / total;
  assert.strictEqual(A.choose(st, menu).what, menu[1].what, 'the second once the draw passes the first weight');
  delete st.rng.plans.fix;
  // the review takes the project the draw names (the barn: the draw at its most), and tells it
  st.rng.plans.fix = 0.999999;
  const n = st.record.length;
  P.reviewed(st, plan, c);
  delete st.rng.plans.fix;
  const p = Projects.projectOf(st, 'household', hh.id);
  assert.ok(p && p.what === 'barn', 'the head takes the barn');
  assert.deepStrictEqual(p.steps.map((x) => x.kind), ['barnbase', 'barnwalls', 'barnroof']);
  assert.strictEqual(p.steps[1].timber, BUILD.barn.timber, 'its walls wait for their timber');
  assert.ok(plan.aim.project === p.id && plan.aim.what === 'barn' && plan.aim.year === c.year && plan.aim.surplus);
  const told = st.record.slice(n).find((e) => typeof e === 'object' && e.kind === 'projectTaken' && !e.self);
  assert.ok(told && told.pawn === hh.holder && told.household === hh.id && told.farm === f.id, 'taking it is told of the head and household');
  assert.ok(st.pawns[hh.holder].events.some((at) => st.record[at].kind === 'projectTaken'), "and is in the head's own events");
  assert.deepStrictEqual(checkState(st), [], 'invariants with a project taken');
  // at most once a year: a second review takes nothing more
  P.reviewed(st, plan, c);
  assert.strictEqual(Projects.projectsOf(st, 'household', hh.id).length, 1, 'one project at a time');
  // built: the three stages done, the walls once their timber lies there; the farm has its barn, and its finish is told
  const K = VB['sim/kinds'].KINDS;
  for (const kind of ['barnbase', 'barnwalls', 'barnroof']) {
    const s0 = p.steps[p.open];
    assert.strictEqual(s0.kind, kind);
    if (s0.timber) s0.wood = s0.timber; // lint-allow: owner the timber carried to the site
    K[kind].done(st, { kind, site: f.house, farm: f, owner: { type: 'household', id: hh.id } }, st.households[1]); // ended by a neighbour's hand
  }
  assert.ok(f.barn && f.barn.built === st.t, 'the barn stands');
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, 'the project is finished');
  assert.ok(st.record.some((e) => typeof e === 'object' && e.kind === 'projectDone' && e.pawn === hh.holder && e.household === hh.id));
  assert.ok(plan.aim.project === null && plan.aim.again, 'the head looks again at its next review');
  assert.deepStrictEqual(checkState(st), [], 'invariants with a barn built');
  assert.ok(issue(st, { actor: hh.holder, verb: 'barn', target: hh.id, args: {}, source: 'pawn' }) !== true, 'one barn a farm');
}

// dropped, with its reservations released, once the surplus has been gone a whole season
{
  const { st, hh, f, plan, c } = surplusState();
  st.rng.plans.fix = 0; // the first option: a field, which holds its seed
  P.reviewed(st, plan, c);
  delete st.rng.plans.fix;
  const p = Projects.projectOf(st, 'household', hh.id);
  assert.ok(p && p.what === 'field', 'the head takes a field');
  Stores.take(st, hh, Stores.grainGood('barley'), Stores.grainOf(hh) - 1, 'harvest'); // the store gone
  P.reviewed(st, plan, c);
  assert.strictEqual(plan.aim.shortSince, st.t, 'the shortfall is noted');
  assert.ok(Projects.projectOf(st, 'household', hh.id), 'kept while it is short less than a season');
  plan.aim.shortSince = st.t - SEASON_DAYS * DAY; // lint-allow: owner a season since
  const n = st.record.length;
  P.reviewed(st, plan, c);
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, 'dropped');
  assert.deepStrictEqual(Object.keys(p.reserved), [], 'its reservations released');
  assert.strictEqual((st.claims.get(p.steps[0].place) || []).filter((x) => x.by.type === 'household' && x.by.id === hh.id).length, 0, 'its stake dropped');
  assert.ok(st.record.slice(n).some((e) => typeof e === 'object' && e.kind === 'projectDropped' && e.pawn === hh.holder));
  assert.strictEqual(plan.aim.project, null);
  assert.deepStrictEqual(checkState(st), [], 'invariants after the drop');
}

// no surplus, no project: a household whose hands were busy takes none
{
  const { st, hh, f, plan, c } = surplusState();
  let hands = 0;
  for (const id of hh.members) { const q = st.pawns[id]; if (q.alive && !q.retired && q.age >= 14 && q.age < 60) hands++; }
  hh.workHours = [c.year * 4 + c.season, 0, hands * (WORK[1] - WORK[0]) * SEASON_DAYS * 0.8]; // lint-allow: owner busy four fifths
  assert.strictEqual(A.surplusOf(st, plan, hh, f, c).idle, false);
  P.reviewed(st, plan, c);
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, 'no project without idle hands');
  assert.strictEqual(plan.aim.surplus, false);
}

// the heir's farm: its weight doubles with two or more ranked heirs, and leans by generosity; begun, it is the household's plot
{
  const { st, hh, f, plan } = surplusState();
  const [heir, ranked] = A.heirOf(st, hh);
  assert.ok(heir !== null && ranked >= 2, 'an adult heir at home past the first');
  {
    st.pawns[hh.holder].traits[Traits.IDX.generosity] = 0.5; // lint-allow: owner
    const o = A.menu(st, plan, hh, f).find((x) => x.what === 'heir');
    assert.ok(o, "the heir's farm is open");
    {
      assert.ok(near(o.weight, (ranked >= 2 ? 2 : 1) * 1.5), `the heir's farm weighs ${o.weight}`);
      assert.strictEqual(issue(st, { actor: hh.holder, verb: 'heirFarm', target: hh.id, args: { heir }, source: 'pawn' }), true);
      const p = Projects.projectOf(st, 'household', hh.id);
      assert.ok(p && p.what === 'plot' && p.by === hh.id && p.intended === heir && p.village === f.village, 'a plot of the household');
      assert.ok(VB['sim/expansion'].livePlots(st, st.villages[f.village]).includes(p), "among the village's plots under way");
      assert.deepStrictEqual(checkState(st), [], 'invariants with a plot for the heir');
      // its tasks are the plot's, posted as every plot's are, on tiles of the map (none of the household's land project's)
      Sim.advance(st, 2 * DAY);
      const jobs = [...st.jobs.values()];
      assert.ok(jobs.every((j) => Number.isInteger(j.site)), 'every task on a tile');
      assert.ok(jobs.some((j) => j.plot === p && j.owner.type === 'household' && j.owner.id === hh.id), "the plot's tasks are the household's");
      assert.deepStrictEqual(checkState(st), [], 'invariants as the plot is cleared');
    }
  }
}
// the heir's plot never stands with nobody to build it for: whatever befalls the heir, the plot passes to the village with its work
const X = VB['sim/expansion'], { killPawn } = VB['sim/lifecycle'];
function heirPlot(pick = null) {
  const o = surplusState(), { st, hh } = o;
  const heir = pick ? pick(st, hh) : A.heirOf(st, hh)[0];
  assert.strictEqual(issue(st, { actor: hh.holder, verb: 'heirFarm', target: hh.id, args: { heir }, source: 'pawn' }), true);
  const p = Projects.projectOf(st, 'household', hh.id);
  o.plan.aim = { year: o.c.year, surplus: true, again: false, project: p.id, what: 'heir', since: st.t, shortSince: null }; // lint-allow: owner the head's project
  return { ...o, heir, p, v: st.villages[o.f.village] };
}
// every tile's steps done but its last, then the last of each: the plot is cleared (sim/expansion's finishStep)
function clear(st, p) {
  for (const tr of p.steps[0].places) tr.i = tr.steps.length - 1;
  for (const tr of p.steps[0].places) X.finishStep(st, { plot: p, tr });
}
const passed = (st, hh, p, v) => {
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, "the household's project is over");
  assert.ok(Projects.projectsOf(st, 'village', v.id).includes(p) && p.by === undefined, "the plot is the village's now");
  assert.ok(!st.plans.projects.heirPlots.includes(p), "and out of the index of the households' plots");
  for (const tr of p.steps[0].places) assert.ok(st.used.has(tr.tile), "its tiles stay in use, as the plot's");
  assert.deepStrictEqual(checkState(st), [], 'invariants once it passed');
};
const roofOn = (st, hh, p) => {
  while (p.open < p.steps.length - 1) VB['sim/events'].emit(st, 'stepDone', { type: p.holder.type, id: p.holder.id, plan: p });
  p.steps[p.steps.length - 1].done = p.steps[p.steps.length - 1].hours; // lint-allow: owner the roof is on
  VB['sim/cottage'].finishCottage(st, p);
};
{ // the heir dies before the plot is cleared: cleared, it passes to the village, which allots it by its custom
  const { st, hh, heir, p, v, plan, c } = heirPlot();
  killPawn(st, heir, 'killed');
  clear(st, p);
  assert.ok(p.open >= 1, 'cleared');
  passed(st, hh, p, v);
  assert.ok(p.to === null || (p.to !== heir && st.pawns[p.to].alive), 'allotted to a living pawn, or to nobody');
  P.reviewed(st, plan, c);
  const q = Projects.projectOf(st, 'household', hh.id);
  assert.ok(plan.aim.project !== p.id && (q === null || (q !== p && plan.aim.project === q.id)), 'the head is free to take another project');
}
{ // the heir dies once it is cleared: as the roof goes on, the plot passes to the village
  const { st, hh, heir, p, v } = heirPlot();
  clear(st, p);
  assert.strictEqual(p.to, heir, 'cleared for the heir');
  killPawn(st, heir, 'killed');
  roofOn(st, hh, p);
  if (p.to === null) passed(st, hh, p, v); // nobody waiting: the cottage stands empty, the village's
  else assert.ok(st.pawns[p.to].alive && p.to !== heir, 'or another moved in');
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null);
}
{ // the heir marries onto another farm before the roof is on
  // the farm is for an adult of the household of the other sex than the next farm's holder (the verb takes any adult at home)
  const otherOf = (st, hh) => st.households.find((h) => !h.dissolved && h.id !== hh.id && h.holder !== null);
  const { st, hh, heir, p } = heirPlot((st, hh) => {
    const o = otherOf(st, hh), RS = VB['sim/records'];
    return hh.members.find((id) => id !== hh.holder && id !== RS.spouseOf(st, hh.holder) && st.pawns[id].age >= 18 &&
      st.pawns[id].sex !== st.pawns[o.holder].sex);
  });
  assert.ok(heir !== undefined, 'an adult of the other sex at home');
  clear(st, p);
  const other = otherOf(st, hh);
  const sp = VB['sim/records'].spouseOf(st, other.holder);
  if (sp !== null) killPawn(st, sp, 'killed');
  assert.strictEqual(issue(st, { actor: other.holder, verb: 'marry', target: heir, args: { home: other.id }, source: 'debug' }), true);
  roofOn(st, hh, p);
  assert.notStrictEqual(p.to, heir, 'not to the married heir');
  assert.strictEqual(Projects.projectOf(st, 'household', hh.id), null, "the household's project is over");
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}
{ // given up as the surplus is gone, the plot passes to the village, its heir still to have it
  const { st, hh, heir, p, v, plan, c } = heirPlot();
  clear(st, p);
  Stores.take(st, hh, Stores.grainGood('barley'), Stores.grainOf(hh) - 1, 'harvest');
  plan.aim.shortSince = st.t - SEASON_DAYS * DAY; // lint-allow: owner a season short
  P.reviewed(st, plan, c);
  passed(st, hh, p, v);
  assert.strictEqual(p.to, heir, 'the heir keeps it');
}
// a barn given up: the timber at its walls goes onto the farm's woodpile (one place: nothing carried, nothing lost)
{
  const { st, hh } = surplusState();
  assert.strictEqual(issue(st, { actor: hh.holder, verb: 'barn', target: hh.id, args: {}, source: 'pawn' }), true);
  const p = Projects.projectOf(st, 'household', hh.id);
  p.steps[1].wood = 21; // lint-allow: owner timber carried to the site
  const w0 = hh.wood;
  P.drop(st, p);
  assert.ok(near(hh.wood, w0 + 21), `the walls' timber on the woodpile: ${w0} -> ${hh.wood}`);
}
// VB-1224: the head's project dropped by another rule (a stake lapsed) ends its aim at once, with no review between (a farm held in trust)
{
  const { st, hh } = surplusState();
  assert.strictEqual(issue(st, { actor: hh.holder, verb: 'barn', target: hh.id, args: {}, source: 'pawn' }), true);
  const p = Projects.projectOf(st, 'household', hh.id), plan = st.plans.households.get(hh.id);
  plan.aim = { year: 0, surplus: true, again: false, project: p.id, what: 'barn', since: st.t, shortSince: null }; // lint-allow: owner the head's project
  P.drop(st, p);
  assert.ok(plan.aim.project === null && plan.aim.what === null && plan.aim.again, `the aim on a dropped plan: ${JSON.stringify(plan.aim)}`);
  assert.deepStrictEqual(checkState(st), [], 'invariants after the drop');
}
console.log("aims ok: surplus, menu, choice, barn and its halvings, drop after a season; the heir's plot passes to the village; timber kept");
