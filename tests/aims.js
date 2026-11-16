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
    const s0 = Projects.openStep(p);
    assert.strictEqual(s0.kind, kind);
    if (s0.timber) s0.wood = s0.timber; // lint-allow: owner the timber carried to the site
    K[kind].done(st, { kind, site: f.house, farm: f }, hh);
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
    }
  }
}
console.log('aims ok: surplus, menu, choice, barn and its halvings, drop after a season');
