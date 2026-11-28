// @suite fast
// VB-1663: the stone foundation, a property of the house (not a rung), and the barn, each built as one task of the played head's plan
// (sim/upgrade's chains foundation and outbuilding). With automatic behaviour off the head begins neither by itself; the refusals in the
// head's own words; the foundation's stone gathered and the house raised by the plan alone, outside the slack of the year (the
// plan says when: the task authored stands, the switch on or off, VB-1753); the barn's stages and timber, the timber at
// home first; Sim.farmView's foundation and outbuildings; a save and a load mid-chain go on the same. On a tiny village of three farms.
const assert = require('assert');
const { targets: TG, season: SP } = require('./lib/season.js');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { projectsOf } = VB['sim/projects'],
  { FOUNDATION, OUTBUILDINGS } = VB['sim/ladder'],
  { goalSteps: chainSteps } = VB['sim/kinds'],
  { BUILD, DAY } = VB['sim/rules'],
  Stores = VB['sim/stores'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const world = () => tinyWorld(rows, { stones: 200 });
// The village of three cottages on the ground, pawn 0's household's head played by hand; two days on, nothing begun by itself.
function village() {
  const st = tinyState(world(), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  Sim.inhabit(st, 0);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 }), true);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead];
  assert.strictEqual(hh.holder, 0, 'pawn 0 heads its household');
  for (const p of projectsOf(st, 'household', hh.id)) VB['sim/commands'].issue(st, { actor: 0, verb: 'dropProject', target: hh.id, args: { id: p.id }, source: 'player' });
  VB['sim/facilityrecords'].raze(st, f, 'barn'); // VB-1898: a seeded farm has its barn; this one is made without
  Sim.advance(st, 2 * DAY);
  assert(f.rung !== 'shelter' && f.grade === 'ground' && !VB['sim/facilityrecords'].standing(st, f, 'barn'), 'a cottage on the ground with no barn');
  return { st, hh, f };
}
// Runs until no task of `kind` is left in the plan (or `days` pass), noting each wait and each agenda kind laid.
function run(st, kind, days = 80) {
  const waits = new Set(),
    laid = new Set();
  let ends = 0;
  for (let i = 0; i < days * 240 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.some((t) => t.kind === kind); i++) {
    Sim.advance(st, 0.1);
    for (const t of Sim.planView(st, st.player.pawn).tasks) {
      // VB-1755: a chain whose last step another hand finished after the plan's housekeeping (the pawn at a daily task meanwhile)
      // reads "nothing is left" until the next step's housekeeping drops it: once, never longer
      if (t.waits && t.waits.why === 'refused' && /^nothing is left to do/.test(t.waits.text) && ++ends <= 1) continue;
      if (t.waits) waits.add(t.waits.why + (t.waits.kind ? `:${t.waits.kind}` : '') + (t.waits.why === 'refused' ? `:${t.waits.text}` : ''));
    }
    if (i % 10 === 0) for (const g of Sim.agenda(st, st.player.pawn).days.flat()) if (g.what === 'task') laid.add(g.kind);
  }
  return { waits, laid };
}

// ---- 1. by hand with no task: neither begun; the farm's view; the refusals ----
{
  const { st, hh, f } = village();
  Sim.advance(st, 20 * DAY);
  assert.strictEqual(st.plans.households.get(hh.id).build, null, 'no stone step opened by the head by itself');
  assert(!projectsOf(st, 'household', hh.id).some((p) => p.what === 'barn'), 'no barn begun by itself');
  let v = Sim.farmView(st, f.id, st.player && st.player.pawn);
  assert.strictEqual(v.rung, 'cottage');
  assert(!v.next.some((n) => n.what === 'stone'), 'the foundation is no rung');
  assert.deepStrictEqual(v.foundation, { grade: 'ground', needs: FOUNDATION.needs, ok: true, why: null, planned: false, building: null });
  assert.deepStrictEqual(v.outbuildings, [
    { what: 'storehouse', built: true, needs: OUTBUILDINGS.storehouse.needs, ok: false, why: `${f.name} has a storehouse`, planned: false, building: null },
    { what: 'barn', built: false, needs: OUTBUILDINGS.barn.needs, ok: true, why: null, planned: false, building: null },
    { what: 'byre', built: true, needs: OUTBUILDINGS.byre.needs, ok: false, why: `${f.name} has a byre`, planned: false, building: null },
  ]);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house + 1 })), /house is not at/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house })), /name the outbuilding/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'tower' })), /no outbuilding tower/);
  const other = st.farmsteads.find((g) => g.id !== f.id);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { foundation: other.house })), /house is not at/, "another's house");
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house }), true);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house })), /planned already/);
  v = Sim.farmView(st, f.id, st.player && st.player.pawn);
  assert.strictEqual(v.foundation.planned, true);
  assert.strictEqual(v.foundation.why, 'the stone foundation is planned already');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'barn' }), true);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'barn' })), /already planned/, 'one outbuilding task at a house');
  assert.strictEqual(Sim.farmView(st, f.id, st.player && st.player.pawn).outbuildings.find((o) => o.what === 'barn').planned, true);
  sound(st, 'refusals');
}
// ---- 2. the foundation by the plan alone: its stone, its raising outside the slack; the house keeps its grade ----
{
  const { st, hh, f } = village();
  const t0 = st.t;
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house }), true);
  const { waits, laid } = run(st, 'foundation');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'raised', JSON.stringify(VB['sim/steps'].pawnPlan(st, st.player.pawn).last));
  assert.strictEqual(f.grade, 'stone');
  assert.strictEqual(VB['sim/rules'].cal(st.t).season, 0, 'raised in spring, outside the slack: the plan says when');
  assert(st.t - t0 < 80 * DAY);
  assert(laid.has('raise') && (laid.has('pick') || laid.has('quarry')), `the agenda lays its steps: ${[...laid]}`);
  assert(![...waits].some((w) => w.startsWith('refused') && !w.endsWith('has no room')), `waits given: ${[...waits]}`);
  const v = Sim.farmView(st, f.id, st.player && st.player.pawn);
  assert.strictEqual(v.foundation.grade, 'stone');
  assert.strictEqual(v.foundation.why, `the house at ${f.name} stands on stone`);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house })), /stands on stone/);
  assert.strictEqual(v.rung, 'cottage', 'a cottage on stone');
  sound(st, 'raised');
  console.log(`  foundation: raised in ${((st.t - t0) / DAY).toFixed(1)} days; waits ${[...waits].join(', ')}; laid ${[...laid].join(', ')}`);
}
// ---- 3. the task authored stands, the switch on or off (VB-1753; it waited for the slack on automatic): the plan says when ----
{
  const { st, hh, f } = village();
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house }), true);
  Stores.put(st, hh, 'stone/granite', BUILD.foundationStone, 'pick');
  Sim.setAuto(st, st.player.pawn, true);
  const r = chainSteps(st, hh.id, 'foundation', f.house).steps;
  assert.deepStrictEqual(r.map((y) => y.kind), ['raise']);
  assert.strictEqual(r[0].from, -Infinity, 'on automatic, in spring, the authored raising does not wait for the slack');
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(chainSteps(st, hh.id, 'foundation', f.house).steps[0].from, -Infinity, 'by hand, the plan says when');
}
// ---- 4. the barn by the plan alone, the timber at home first; a save and a load mid-chain go on the same ----
{
  const { st, hh, f } = village();
  // `had`: what its wood task brought home in the two days (a firewood goal leaves the timber the barn's walls count on, VB-1808)
  const had = Stores.heldOf(hh, 'timber');
  Stores.put(st, hh, 'timber', 6, 'felling');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'barn' }), true);
  const before = chainSteps(st, hh.id, 'outbuilding', f.house).steps;
  assert.deepStrictEqual(before.map((y) => y.kind), ['barnbase', 'timber', 'barnwalls', 'barnroof']);
  assert.strictEqual(before[1].n, Math.ceil((BUILD.barn.timber - 6 - had) / st.ECON.woodPerTrip - 1e-9), 'trips for what home does not cover');
  for (let i = 0; i < 240 && !projectsOf(st, 'household', hh.id).some((p) => p.what === 'barn'); i++) Sim.advance(st, 0.1);
  const p = projectsOf(st, 'household', hh.id).find((q) => q.what === 'barn');
  assert(p, 'begun by the task');
  assert.strictEqual(Sim.farmView(st, f.id, st.player && st.player.pawn).outbuildings.find((o) => o.what === 'barn').building.what, 'barn');
  for (let i = 0; i < 40 * 240 && p.open === 0; i++) Sim.advance(st, 0.1);
  assert.strictEqual(p.steps[1].kind, 'barnwalls');
  assert(p.steps[1].wood >= 6, `the walls took the timber at home: ${p.steps[1].wood}`);
  assert.strictEqual(Stores.heldOf(hh, 'timber'), 0);
  Sim.advance(st, 10);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(world(), saved),
    again = Sim.load(world(), saved);
  run(back, 'outbuilding');
  run(again, 'outbuilding');
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  const { waits, laid } = run(st, 'outbuilding');
  assert.strictEqual(hash(st), hash(back), 'as the run itself');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'built', JSON.stringify(VB['sim/steps'].pawnPlan(st, st.player.pawn).last));
  assert(VB['sim/facilityrecords'].standing(st, f, 'barn'), 'the farm has its barn');
  assert(laid.has('barnwalls') && laid.has('barnroof'), `the agenda lays its steps: ${[...laid]}`);
  const v = Sim.farmView(st, f.id, st.player && st.player.pawn).outbuildings.find((o) => o.what === 'barn');
  assert.strictEqual(v.built, true);
  assert.strictEqual(v.why, `${f.name} has a barn`);
  sound(back, 'loaded mid-chain');
  console.log(`  barn: waits ${[...waits].join(', ')}; laid ${[...laid].join(', ')}`);
}
// ---- 5. VB-1668: a barn, a byre and the foundation planned at once, each under way beside the others and carried through in the plan's
// order; the refusals that remain (the same making twice); a save and a load with the three under way go on the same ----
{
  const { st, hh, f } = village();
  const { VERBS } = VB['sim/commands'],
    verb = (what) => VERBS.project.check(st, { actor: 0, verb: 'project', target: hh.id, args: { what }, source: 'player' });
  VB['sim/byrehouse'].noByre(st, f); // the farm without the byre the seed gives it
  Stores.put(st, hh, 'timber', BUILD.barn.timber + BUILD.byre.timber, 'felling');
  Stores.put(st, hh, 'stone/granite', BUILD.foundationStone, 'pick');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'barn' }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'byre' }), true, 'a byre beside the barn at the house');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house }), true, 'the foundation beside both');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'barn' })), /already planned/, 'one barn');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { foundation: f.house })), /planned already/, 'one foundation');
  let saved = null,
    all = false;
  const under = (s) => {
    const v = Sim.farmView(s, s.households[hh.id].farmstead === null ? f.id : s.households[hh.id].farmstead, s.player && s.player.pawn);
    return [v.outbuildings.find((o) => o.what === 'barn').building, v.outbuildings.find((o) => o.what === 'byre').building, v.foundation.building];
  };
  for (let i = 0; i < 120 * 240 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.some((t) => t.kind === 'outbuilding' || t.kind === 'foundation'); i++) {
    Sim.advance(st, 0.1);
    if (!saved && under(st).every((b) => b)) {
      all = true;
      const whys = Sim.farmView(st, f.id, st.player && st.player.pawn).outbuildings.map((o) => o.why).concat(Sim.farmView(st, f.id, st.player && st.player.pawn).foundation.why);
      assert(whys.every((w) => w === null || !/has a (?!barn|byre|stone foundation)\w+ under way/.test(w)), `no why names another making: ${whys}`);
      assert.match(String(verb('barn')), /has a barn under way/, 'a second barn refused');
      assert.match(String(verb('byre')), /has a byre under way/, 'a second byre refused');
      assert.deepStrictEqual(Sim.headView(st, hh.id).projects.map((p) => p.what).sort(), ['barn', 'byre'], 'headView().projects');
      saved = JSON.parse(JSON.stringify(Sim.save(st)));
    }
  }
  assert(all && saved, 'the barn, the byre and the foundation under way together');
  const has = (k) => !!VB['sim/facilityrecords'].standing(st, f, k);
  assert(has('barn') && has('byre') && f.grade === 'stone', `all three carried through: barn ${has('barn')}, byre ${has('byre')}, ${f.grade}`);
  sound(st, 'three side by side');
  const back = Sim.load(world(), saved),
    again = Sim.load(world(), saved);
  Sim.advance(back, 48);
  Sim.advance(again, 24);
  Sim.advance(again, 24);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  sound(back, 'three side by side, loaded');
  console.log(`  three side by side: done in ${(st.t / DAY).toFixed(0)} days`);
}
// ---- 6. VB-1668: an unplayed head's verb begins a field and a barn together (its own rule would not), both carried through ----
{
  const { st } = village();
  const hh = st.households.find((h) => !h.dissolved && h.holder !== null && h.holder !== 0 && h.farmstead !== null),
    f = st.farmsteads[hh.farmstead],
    act = (args) => VB['sim/commands'].issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args, source: 'pawn' });
  for (const p of projectsOf(st, 'household', hh.id)) act({ what: null }) && VB['sim/commands'].issue(st, { actor: hh.holder, verb: 'dropProject', target: hh.id, args: { id: p.id }, source: 'pawn' });
  VB['sim/facilityrecords'].raze(st, f, 'barn'); // VB-1898: a seeded farm has its barn; this one is made without
  const fields = f.fields.length;
  assert.strictEqual(act({ what: 'field' }), true, 'a field begun');
  assert.strictEqual(act({ what: 'barn' }), true, 'a barn begun beside it, by the verb');
  assert.match(String(act({ what: 'barn' })), /has a barn under way/, 'not a second barn');
  const tile = projectsOf(st, 'household', hh.id).find((p) => p.what === 'field').steps[0].place;
  assert.match(String(act({ what: 'meadow', tile })), /under way at/, 'one project a tile');
  sound(st, 'a field and a barn');
  const barn = () => !!VB['sim/facilityrecords'].standing(st, f, 'barn');
  for (let d = 0; d < 200 && !(barn() && f.fields.length > fields); d++) Sim.advance(st, DAY);
  assert(barn() && f.fields.length > fields, `both carried through: barn ${barn()}, fields ${fields} to ${f.fields.length}`);
}
console.log('farmtasks: by hand neither begun by itself; the refusals; the foundation by the plan, outside the slack, and the slack wait '
  + 'for a head left to its rule; the barn by the plan, the timber at home first; a save mid-chain the same; a barn, a byre and the '
  + 'foundation side by side; an unplayed head\'s field and barn by the verb');
