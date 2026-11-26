// VB-1660: the shelter (VB-1666: on the house tile) built up to a cottage as a task of the plan (chain `upgrade`, sim/upgrade). The refusals (a camp, a rung that does
// not follow, one not built yet, one planned or under way); from the raised shelter to the roof on by the plan alone, the head beginning
// the cottage by its own verb, with its waits and its days in the agenda; the timber held at home taken into the walls first, and no
// trip fetched for what it covers; Sim.farmView's next with the task's own check and `planned`; a save and a load mid-chain go on the
// same. On the tiny land of tests/camp.js.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { projectsOf } = VB['sim/projects'],
  { cottageOf, wallsOf } = VB['sim/cottageplan'],
  { RUNGS } = VB['sim/ladder'],
  { BUILD } = VB['sim/rules'],
  Stores = VB['sim/stores'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const add = (st, what, tile = st.farmsteads[0].house) => Sim.plan(st, st.player.pawn, 'add', { upgrade: tile, what });
// The played solo settler by hand, its shelter raised on the landing by the farmstead task.
function booth() {
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true });
  st.naturalDeaths = false;
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  assert.match(String(add(st, 'cottage')), /still a camp/, 'refused at the camp');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: st.farmsteads[0].house }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 }), true);
  for (let i = 0; i < 20 * 240 && st.pawns[st.player.pawn].control.plan.tasks.length; i++) Sim.advance(st, 0.1);
  assert.strictEqual(st.pawns[st.player.pawn].control.plan.last.which, 'raised');
  assert.deepStrictEqual(projectsOf(st, 'household', 0), [], 'no cottage begun by itself');
  return st;
}
// Runs until the upgrade task has left the plan (or `days` pass), noting each wait, each agenda kind and each timber trip posted.
function run(st, days = 40) {
  const waits = new Set(),
    laid = new Set();
  let trips = 0;
  for (let i = 0; i < days * 240 && st.pawns[st.player.pawn].control.plan.tasks.some((t) => t.kind === 'upgrade'); i++) {
    Sim.advance(st, 0.1);
    for (const t of Sim.planView(st, st.player.pawn).tasks) if (t.waits) waits.add(t.waits.why + (t.waits.kind ? `:${t.waits.kind}` : ''));
    if (i % 10 === 0) for (const g of Sim.agenda(st, st.player.pawn).days.flat()) if (g.what === 'task') laid.add(g.kind);
    if (st.jobs.has('timber:f0')) trips++;
  }
  return { waits, laid, trips };
}

// ---- 1. the refusals, and the farm's view before and after the task is planned ----
{
  const st = booth(),
    f = st.farmsteads[0];
  let v = Sim.farmView(st, 0, st.player && st.player.pawn);
  assert.deepStrictEqual(v.next, [
    { what: 'cottage', needs: RUNGS.cottage.needs, ok: true, why: null, planned: false },
  ]);
  assert.match(String(add(st, 'stone')), /no rung stone/, 'the foundation is no rung (VB-1663)');
  assert.match(String(add(st, 'tower')), /no rung tower/);
  assert.match(String(add(st)), /name the rung/);
  assert.match(String(add(st, 'cottage', f.house + 1)), /house is not at/);
  assert.strictEqual(add(st, 'cottage'), true);
  assert.match(String(add(st, 'cottage')), /already planned/, 'one at a time');
  v = Sim.farmView(st, 0, st.player && st.player.pawn);
  assert.deepStrictEqual(v.next, [
    { what: 'cottage', needs: RUNGS.cottage.needs, ok: false, why: 'the cottage is planned already', planned: true },
  ]);
  for (let i = 0; i < 240 && !cottageOf(st, 0); i++) Sim.advance(st, 0.1);
  assert(cottageOf(st, 0), 'begun by the task');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'remove', { i: 0 }), true);
  assert.match(String(add(st, 'cottage')), /cottage under way/, 'under way');
  assert.match(Sim.farmView(st, 0, st.player && st.player.pawn).next[0].why, /cottage under way/);
  assert.strictEqual(Sim.farmView(st, 0, st.player && st.player.pawn).next[0].planned, false);
  sound(st, 'refusals');
}
// ---- 2. from the booth to the roof by the plan alone, no timber at home: its trips fetched; a stone foundation 'not yet' ----
{
  const st = booth(),
    f = st.farmsteads[0],
    hh = st.households[0];
  assert.strictEqual(Stores.heldOf(hh, 'timber'), 0);
  assert.strictEqual(add(st, 'cottage'), true);
  // VB-1666: built up in place: the cottage's stages on the house tile itself, worked while the household lives in the shelter there
  for (let i = 0; i < 240 && !cottageOf(st, 0); i++) Sim.advance(st, 0.1);
  const p = cottageOf(st, 0);
  assert(p && p.steps.every((k) => k.place === f.house), 'the cottage on the shelter\'s tile');
  assert(f.shelter && f.shelter.built !== null && !VB['sim/building'].roofless(st, hh), 'under the shelter meanwhile');
  const { waits, laid, trips } = run(st);
  assert.deepStrictEqual(st.pawns[st.player.pawn].control.plan.tasks, [], 'the task has left');
  assert.strictEqual(st.pawns[st.player.pawn].control.plan.last.which, 'roof', JSON.stringify(st.pawns[st.player.pawn].control.plan.last));
  assert.strictEqual(f.booth, null, 'out of the shelter');
  assert.strictEqual(f.shelter, null, 'the shelter gone: the cottage stands in its place');
  assert.strictEqual(cottageOf(st, 0), null, 'the cottage plan finished');
  assert(trips > 0, 'timber trips fetched for the walls');
  assert(waits.has('sleep') && waits.has('unposted:walls'), `waits given: ${[...waits]}`);
  assert(['foundation', 'walls', 'roof'].every((k) => laid.has(k)), `the agenda lays its steps: ${[...laid]}`);
  const v = Sim.farmView(st, 0, st.player && st.player.pawn);
  assert.strictEqual(v.rung, 'cottage');
  assert.deepStrictEqual(
    v.next.map((n) => n.what),
    ['timber'],
    'the timber house follows the cottage (VB-1664; VB-1663: the foundation is no rung)',
  );
  assert.strictEqual(v.foundation.ok, true, 'the foundation may be planned');
  assert.match(String(add(st, 'stone')), /no rung stone/);
  assert.match(String(add(st, 'cottage')), /built from a shelter/, 'a cottage on a cottage');
  sound(st, 'the roof on');
}
// ---- 3. the timber at home taken first: what it covers fetched by no trip; what is left at home stays ----
{
  const st = booth(),
    hh = st.households[0];
  Stores.put(st, hh, 'timber', BUILD.timber + 6, 'felling');
  assert.strictEqual(add(st, 'cottage'), true);
  const steps = Sim.planView(st, st.player.pawn).tasks[0];
  assert.strictEqual(steps.step, 'foundation');
  for (let i = 0; i < 240 && !cottageOf(st, 0); i++) Sim.advance(st, 0.1);
  const p = cottageOf(st, 0);
  assert.strictEqual(wallsOf(p).wood, BUILD.timber, 'the walls hold their timber from home');
  assert.strictEqual(Stores.heldOf(hh, 'timber'), 6, 'the rest stays at home');
  const { trips } = run(st);
  assert.strictEqual(trips, 0, 'no trip fetched');
  assert.strictEqual(st.pawns[st.player.pawn].control.plan.last.which, 'roof');
  sound(st, 'timber from home');
}
// ---- 4. some at home: the walls take it, the trips fetch only the rest ----
{
  const st = booth(),
    hh = st.households[0];
  Stores.put(st, hh, 'timber', 6, 'felling');
  assert.strictEqual(add(st, 'cottage'), true);
  for (let i = 0; i < 240 && !cottageOf(st, 0); i++) Sim.advance(st, 0.1);
  assert.strictEqual(wallsOf(cottageOf(st, 0)).wood, 6);
  assert.strictEqual(Stores.heldOf(hh, 'timber'), 0);
  // a save and a load mid-chain go on the same
  Sim.advance(st, 30);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(tinyWorld(rows), saved),
    again = Sim.load(tinyWorld(rows), saved);
  run(back);
  run(again);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  run(st);
  assert.strictEqual(hash(st), hash(back), 'as the run itself');
  assert.strictEqual(back.pawns[back.player.pawn].control.plan.last.which, 'roof');
  assert.strictEqual(back.farmsteads[0].booth, null);
  sound(back, 'loaded mid-chain');
}
console.log('upgrade: the refusals; the booth to the cottage by the plan alone, its waits and agenda; the timber at home first; '
  + 'farmView next with the task check and planned; a save mid-chain the same');
