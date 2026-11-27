// VB-1665: the byre as a building (sim/byrehouse). Every farm that stands at seeding has one, a camp landed by hand none, an older save's
// farms read as having theirs; a farm without one winters its animals in the open, the stall winter's lean HERD.openLean times as fast;
// the played head builds it as a task of its plan (the chain outbuilding), the timber at home first, a save and a load mid-chain going
// on the same; Sim.farmView lists it; a head left to its rule with animals and no byre builds one by itself. On a tiny village of three farms.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { projectsOf } = VB['sim/projects'],
  { OUTBUILDINGS } = VB['sim/ladder'],
  { goalSteps: chainSteps } = VB['sim/kinds'],
  { BUILD, HERD, DAY } = VB['sim/rules'],
  { herdsOf } = VB['sim/herds'],
  { byreDay } = VB['sim/byre'],
  Stores = VB['sim/stores'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const world = () => tinyWorld(rows, { stones: 200 });
const fresh = () => {
  const st = tinyState(world(), [{ at: [8, 7], farms: 3 }], { seed: 4, herds: true });
  st.naturalDeaths = false;
  return st;
};
// The farm of household hh made byre-less, as a settler's new farm is (a test's write: the farm stands without one).
const unbuild = (f) => (f.byre = null);

// ---- 1. at seeding, a camp, an older save ----
{
  const st = fresh();
  assert(st.farmsteads.every((f) => f.byre && f.byre.built === st.t), 'every farm at seeding has its byre');
  const camp = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true });
  assert.strictEqual(camp.farmsteads[0].byre, null, 'a camp landed by hand has none');
  sound(camp, 'camp');
  const solo = Sim.seed(tinyWorld(rows), 7, 'solo');
  assert(solo.farmsteads[0].byre, 'the solo start without hand begins as before');
  Sim.advance(st, 3);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const old = Sim.load(world(), saved);
  for (const f of old.farmsteads) delete f.byre; // as a save from before VB-1665 decodes
  VB['sim/byrehouse'].byresLoaded(old);
  assert(old.farmsteads.every((f) => f.byre && f.byre.built === old.t), 'an older save reads as having its byres');
  sound(old, 'older save');
  // a farm made in play (sim/layout makeFarmstead, as a new cottage's or a settler's) has none, and a save and a load keep it so (the
  // extended tier's tests/line.js found a loaded run giving such farms a byre: undefined read as an older save's)
  const made = VB['sim/layout'].makeFarmstead(st.w, st.farmsteads.length, -1, [], null, new Set());
  assert.strictEqual(made.byre, null, 'a farm made in play has no byre');
  const bare = st.farmsteads.find((f) => f.household !== null);
  unbuild(bare);
  const back = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(back.farmsteads[bare.id].byre, null, 'a farm with no byre has none after a save and a load');
}
// ---- 2. the stall winter in the open: the lean HERD.openLean times as fast, the rest the same ----
{
  const st = fresh();
  const withHerds = st.households.filter((h) => h.herds.length);
  assert(withHerds.length >= 2, 'two households with animals');
  const [a, b] = withHerds;
  unbuild(st.farmsteads[b.farmstead]);
  for (const hh of [a, b]) {
    hh.hay = 1e4;
    hh.fodderDay = -5; // not foddered yesterday: a lean day
    for (const herd of herdsOf(st, hh)) herd.lean = 0;
  }
  const hayA = a.hay,
    hayB = b.hay;
  byreDay(st, { doy: HERD.stall[0] + 2, day: 100 });
  for (const herd of herdsOf(st, a)) assert.strictEqual(herd.lean, 1, 'under a roof: a lean day counts one');
  for (const herd of herdsOf(st, b)) assert.strictEqual(herd.lean, HERD.openLean, 'in the open: openLean');
  assert(hayA - a.hay > 0 && hayB - b.hay > 0, 'both herds eat their hay');
  sound(st, 'lean');
}
// ---- 3. by the plan: the view, the refusals, the timber at home first, a save and a load mid-chain ----
{
  const st = fresh();
  Sim.advance(st, 3);
  Sim.inhabit(st, 0);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 }), true);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead];
  for (const p of projectsOf(st, 'household', hh.id))
    VB['sim/commands'].issue(st, { actor: 0, verb: 'dropProject', target: hh.id, args: { id: p.id }, source: 'player' });
  const byreOf = () => Sim.farmView(st, f.id, st.player && st.player.pawn).outbuildings.find((o) => o.what === 'byre');
  assert.deepStrictEqual(byreOf(), {
    what: 'byre',
    built: true,
    needs: { timber: BUILD.byre.timber, stone: 0, hours: 60 },
    ok: false,
    why: `${f.name} has a byre`,
    planned: false,
    building: null,
  });
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'byre' })), /has a byre/);
  unbuild(f);
  Sim.advance(st, 2 * DAY);
  assert(!projectsOf(st, 'household', hh.id).some((p) => p.what === 'byre'), 'by hand, not begun by itself');
  assert.deepStrictEqual(byreOf(), { what: 'byre', built: false, needs: OUTBUILDINGS.byre.needs, ok: true, why: null, planned: false, building: null });
  console.log(`  view: ${JSON.stringify(byreOf())}`);
  Stores.put(st, hh, 'timber', 6, 'felling');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'byre' }), true);
  assert.strictEqual(byreOf().planned, true);
  const before = chainSteps(st, hh.id, 'outbuilding', f.house).steps;
  assert.deepStrictEqual(before.map((y) => y.kind), ['timber', 'byrewalls', 'byreroof']);
  assert.strictEqual(before[0].n, Math.ceil((BUILD.byre.timber - (hh.timber || 0)) / st.ECON.woodPerTrip - 1e-9), 'trips for what home does not cover');
  for (let i = 0; i < 240 && !projectsOf(st, 'household', hh.id).some((p) => p.what === 'byre'); i++) Sim.advance(st, 0.1);
  const p = projectsOf(st, 'household', hh.id).find((q) => q.what === 'byre');
  assert(p, 'begun by the task');
  Sim.advance(st, 1); // the head's hour: the timber at home goes into the walls
  assert(p.steps[0].wood >= 6, `the walls took the timber at home: ${p.steps[0].wood}`);
  assert.strictEqual(byreOf().building.what, 'byre');
  Sim.advance(st, 2 * DAY);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(world(), saved),
    again = Sim.load(world(), saved);
  const run = (s) => {
    for (let i = 0; i < 80 * 240 && VB['sim/steps'].pawnPlan(s, s.player.pawn).tasks.some((t) => t.kind === 'outbuilding'); i++) Sim.advance(s, 0.1);
  };
  run(back);
  run(again);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  run(st);
  assert.strictEqual(hash(st), hash(back), 'as the run itself');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'built', JSON.stringify(VB['sim/steps'].pawnPlan(st, st.player.pawn).last));
  assert(f.byre && f.byre.built <= st.t, 'the farm has its byre');
  assert.strictEqual(byreOf().built, true);
  sound(back, 'loaded mid-chain');
}
// ---- 4. a head left to its rule: animals and no byre, it builds one by itself ----
{
  const st = fresh();
  const hh = st.households.find((h) => h.herds.length),
    f = st.farmsteads[hh.farmstead];
  unbuild(f);
  let begun = null;
  for (let i = 0; i < 60 * 24 && !f.byre; i++) {
    Sim.advance(st, 1);
    if (begun === null && projectsOf(st, 'household', hh.id).some((p) => p.what === 'byre')) begun = st.t;
  }
  assert(begun !== null, 'the head began a byre by itself');
  assert(f.byre, `built within sixty days (begun on day ${(begun / DAY).toFixed(1)})`);
  assert(st.farmsteads.filter((g) => g !== f && g.household !== null).every((g) => !projectsOf(st, 'household', g.household).some((p) => p.what === 'byre')), 'none where a byre stands');
  sound(st, 'own rule');
  console.log(`  own rule: begun on day ${(begun / DAY).toFixed(1)}, built on day ${(f.byre.built / DAY).toFixed(1)}`);
}
console.log('byrehouse: a byre at seeding, none on a camp, an older save reads as having one; the lean in the open; by the plan, the timber '
  + 'at home first, a save mid-chain the same; by the head\'s own rule');
