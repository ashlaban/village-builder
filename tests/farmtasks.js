// VB-1635: the stone foundation, a property of the house (not a rung), and the barn, each built as one task of the played head's plan
// (sim/upgrade's chains foundation and outbuilding). With automatic behaviour off the head begins neither by itself; the refusals in the
// head's own words; the foundation's stone gathered and the house raised by the plan alone, outside the slack of the year (the played
// head's plan says when), and in the slack for a head left to its rule (the wait `opens`); the barn's stages and timber, the timber at
// home first; Sim.farmView's foundation and outbuildings; a save and a load mid-chain go on the same. On a tiny village of three farms.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { projectsOf } = VB['sim/projects'],
  { FOUNDATION, OUTBUILDINGS } = VB['sim/ladder'],
  { chainSteps } = VB['sim/planchains'],
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
  Sim.setAuto(st, false);
  assert.strictEqual(Sim.plan(st, 'sleep', { from: 21, until: 6 }), true);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead];
  assert.strictEqual(hh.holder, 0, 'pawn 0 heads its household');
  for (const p of projectsOf(st, 'household', hh.id)) VB['sim/commands'].issue(st, { actor: 0, verb: 'dropProject', target: hh.id, args: { id: p.id }, source: 'player' });
  Sim.advance(st, 2 * DAY);
  assert(!f.booth && f.grade === 'ground' && !f.barn, 'a cottage on the ground with no barn');
  return { st, hh, f };
}
// Runs until no task of `kind` is left in the plan (or `days` pass), noting each wait and each agenda kind laid.
function run(st, kind, days = 80) {
  const waits = new Set(),
    laid = new Set();
  for (let i = 0; i < days * 240 && st.player.plan.tasks.some((t) => t.kind === kind); i++) {
    Sim.advance(st, 0.1);
    for (const t of Sim.planView(st).tasks) if (t.waits) waits.add(t.waits.why + (t.waits.kind ? `:${t.waits.kind}` : '') + (t.waits.why === 'refused' ? `:${t.waits.text}` : ''));
    if (i % 10 === 0) for (const g of Sim.agenda(st).days.flat()) if (g.what === 'task') laid.add(g.kind);
  }
  return { waits, laid };
}

// ---- 1. by hand with no task: neither begun; the farm's view; the refusals ----
{
  const { st, hh, f } = village();
  Sim.advance(st, 20 * DAY);
  assert.strictEqual(st.plans.households.get(hh.id).build, null, 'no stone step opened by the head by itself');
  assert(!projectsOf(st, 'household', hh.id).some((p) => p.what === 'barn'), 'no barn begun by itself');
  let v = Sim.farmView(st, f.id);
  assert.strictEqual(v.rung, 'cottage');
  assert(!v.next.some((n) => n.what === 'stone'), 'the foundation is no rung');
  assert.deepStrictEqual(v.foundation, { grade: 'ground', needs: FOUNDATION.needs, ok: true, why: null, planned: false, building: null });
  assert.deepStrictEqual(v.outbuildings, [
    { what: 'barn', built: false, needs: OUTBUILDINGS.barn.needs, ok: true, why: null, planned: false, building: null },
    { what: 'byre', built: true, needs: OUTBUILDINGS.byre.needs, ok: false, why: `${f.name} has a byre`, planned: false, building: null },
  ]);
  assert.match(String(Sim.plan(st, 'add', { foundation: f.house + 1 })), /house is not at/);
  assert.match(String(Sim.plan(st, 'add', { outbuilding: f.house })), /name the outbuilding/);
  assert.match(String(Sim.plan(st, 'add', { outbuilding: f.house, what: 'tower' })), /no outbuilding tower/);
  const other = st.farmsteads.find((g) => g.id !== f.id);
  assert.match(String(Sim.plan(st, 'add', { foundation: other.house })), /house is not at/, "another's house");
  assert.strictEqual(Sim.plan(st, 'add', { foundation: f.house }), true);
  assert.match(String(Sim.plan(st, 'add', { foundation: f.house })), /planned already/);
  v = Sim.farmView(st, f.id);
  assert.strictEqual(v.foundation.planned, true);
  assert.strictEqual(v.foundation.why, 'the stone foundation is planned already');
  assert.strictEqual(Sim.plan(st, 'add', { outbuilding: f.house, what: 'barn' }), true);
  assert.match(String(Sim.plan(st, 'add', { outbuilding: f.house, what: 'barn' })), /already planned/, 'one outbuilding task at a house');
  assert.strictEqual(Sim.farmView(st, f.id).outbuildings[0].planned, true);
  sound(st, 'refusals');
}
// ---- 2. the foundation by the plan alone: its stone, its raising outside the slack; the house keeps its grade ----
{
  const { st, hh, f } = village();
  const t0 = st.t;
  assert.strictEqual(Sim.plan(st, 'add', { foundation: f.house }), true);
  const { waits, laid } = run(st, 'foundation');
  assert.strictEqual(st.player.plan.last.which, 'raised', JSON.stringify(st.player.plan.last));
  assert.strictEqual(f.grade, 'stone');
  assert.strictEqual(VB['sim/rules'].cal(st.t).season, 0, 'raised in spring, outside the slack: the plan says when');
  assert(st.t - t0 < 80 * DAY);
  assert(laid.has('raise') && (laid.has('pick') || laid.has('quarry')), `the agenda lays its steps: ${[...laid]}`);
  assert(![...waits].some((w) => w.startsWith('refused') && !w.endsWith('has no room')), `waits given: ${[...waits]}`);
  const v = Sim.farmView(st, f.id);
  assert.strictEqual(v.foundation.grade, 'stone');
  assert.strictEqual(v.foundation.why, `the house at ${f.name} stands on stone`);
  assert.match(String(Sim.plan(st, 'add', { foundation: f.house })), /stands on stone/);
  assert.strictEqual(v.rung, 'cottage', 'a cottage on stone');
  sound(st, 'raised');
  console.log(`  foundation: raised in ${((st.t - t0) / DAY).toFixed(1)} days; waits ${[...waits].join(', ')}; laid ${[...laid].join(', ')}`);
}
// ---- 3. a head left to its rule raises in the slack: the wait names it ----
{
  const { st, hh, f } = village();
  assert.strictEqual(Sim.plan(st, 'add', { foundation: f.house }), true);
  Stores.put(st, hh, 'stone/granite', BUILD.foundationStone, 'pick');
  Sim.setAuto(st, true);
  const r = chainSteps(st, hh.id, 'foundation', f.house).steps;
  assert.deepStrictEqual(r.map((y) => y.kind), ['raise']);
  assert(r[0].from > st.t && r[0].what === 'the slack of the year', 'in spring, the raising waits for the slack');
  Sim.setAuto(st, false);
  assert.strictEqual(chainSteps(st, hh.id, 'foundation', f.house).steps[0].from, -Infinity, 'by hand, the plan says when');
}
// ---- 4. the barn by the plan alone, the timber at home first; a save and a load mid-chain go on the same ----
{
  const { st, hh, f } = village();
  Stores.put(st, hh, 'timber', 6, 'felling');
  assert.strictEqual(Sim.plan(st, 'add', { outbuilding: f.house, what: 'barn' }), true);
  const before = chainSteps(st, hh.id, 'outbuilding', f.house).steps;
  assert.deepStrictEqual(before.map((y) => y.kind), ['barnbase', 'timber', 'barnwalls', 'barnroof']);
  assert.strictEqual(before[1].n, Math.ceil((BUILD.barn.timber - 6) / st.ECON.woodPerTrip - 1e-9), 'trips for what home does not cover');
  for (let i = 0; i < 240 && !projectsOf(st, 'household', hh.id).some((p) => p.what === 'barn'); i++) Sim.advance(st, 0.1);
  const p = projectsOf(st, 'household', hh.id).find((q) => q.what === 'barn');
  assert(p, 'begun by the task');
  assert.strictEqual(Sim.farmView(st, f.id).outbuildings[0].building.what, 'barn');
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
  assert.strictEqual(st.player.plan.last.which, 'built', JSON.stringify(st.player.plan.last));
  assert(f.barn, 'the farm has its barn');
  assert(laid.has('barnwalls') && laid.has('barnroof'), `the agenda lays its steps: ${[...laid]}`);
  const v = Sim.farmView(st, f.id).outbuildings[0];
  assert.strictEqual(v.built, true);
  assert.strictEqual(v.why, `${f.name} has a barn`);
  sound(back, 'loaded mid-chain');
  console.log(`  barn: waits ${[...waits].join(', ')}; laid ${[...laid].join(', ')}`);
}
console.log('farmtasks: by hand neither begun by itself; the refusals; the foundation by the plan, outside the slack, and the slack wait '
  + 'for a head left to its rule; the barn by the plan, the timber at home first; a save mid-chain the same');
