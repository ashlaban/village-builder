// @suite fast
// VB-1898: the storehouse and the barn (sim/storehouse, sim/building). Every farm that stands at seeding has both, a camp landed by hand
// neither, an older save's farms read as having a storehouse and the barn they had; the storehouse halves the grain lost, the barn the
// hay lost (and no longer the grain); the head's menu weighs each by what it would save, by the doing's own reckoning; the played head
// builds a storehouse as a task of its plan; the page draws each only where the farm has it. On a tiny village of three farms.
const assert = require('assert');
const fs = require('fs'),
  path = require('path');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');
const { OUTBUILDINGS } = VB['sim/ladder'],
  { goalSteps: chainSteps } = VB['sim/kinds'],
  { BUILD, YEAR_DAYS } = VB['sim/rules'],
  { spoilGrain, dailyNeed } = VB['sim/hunger'],
  grainLoss = (st, hh) => VB['sim/storehouse'].grainLoss(st, hh, dailyNeed(st, hh) * YEAR_DAYS),
  { spoilHay, hayLoss } = VB['sim/byre'],
  { menu } = VB['sim/aims'],
  Stores = VB['sim/stores'],
  Fac = VB['sim/facilityrecords'];
// VB-1911: the storehouse and the barn are facilities of the farm
const has = (st, f, k) => Fac.standing(st, f, k);
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const world = () => tinyWorld(rows, { stones: 200 });
const fresh = () => {
  const st = tinyState(world(), [{ at: [8, 7], farms: 3 }], { seed: 4, herds: true });
  st.naturalDeaths = false;
  return st;
};
const close = (a, b, what) => assert(Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} against ${b}`);

// ---- 1. at seeding, a camp, an older save ----
{
  const st = fresh();
  assert(
    st.farmsteads.every((f) => has(st, f, 'storehouse') && has(st, f, 'storehouse').built === st.t),
    'every farm at seeding has its storehouse',
  );
  assert(
    st.farmsteads.every((f) => has(st, f, 'barn') && has(st, f, 'barn').built === st.t),
    'and its barn',
  );
  const camp = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true });
  assert.strictEqual(has(camp, camp.farmsteads[0], 'storehouse'), null, 'a camp landed by hand has no storehouse');
  assert.strictEqual(has(camp, camp.farmsteads[0], 'barn'), null, 'nor a barn');
  sound(camp, 'camp');
  // saves from before VB-1911 (the outbuildings farmstead fields) and VB-1898 (no storehouse field)
  const older = (st, write) => {
    const saved = JSON.parse(JSON.stringify(Sim.save(st)));
    saved.state.facilities = [];
    saved.state.farmsteads.forEach(write);
    return saved;
  };
  const oldCamp = Sim.load(tinyWorld(rows), older(camp, (f) => (f.byre = null))); // a camp saved before VB-1898
  assert.strictEqual(has(oldCamp, oldCamp.farmsteads[0], 'storehouse'), null, 'an older save of a camp reads as having no storehouse');
  sound(oldCamp, 'older camp');
  Sim.advance(st, 3);
  const old = Sim.load(
    world(),
    older(st, (f, i) => {
      f.byre = { built: 1 };
      if (i === 0) f.barn = { built: 2 }; // a farm that had a barn then, the next none
    }),
  );
  const [a, b] = old.farmsteads;
  assert(
    old.farmsteads.every((f) => has(old, f, 'storehouse') && has(old, f, 'storehouse').built === old.t),
    'an older save reads as having its storehouses',
  );
  assert(has(old, a, 'barn') && has(old, a, 'barn').built === 2, 'the barn it had');
  assert.strictEqual(has(old, b, 'barn'), null, 'and none where it had none');
  assert(old.farmsteads.every((f) => !('barn' in f || 'byre' in f || 'storehouse' in f)), 'the fields taken out');
  sound(old, 'older save');
  const made = VB['sim/layout'].makeFarmstead(st.w, st.farmsteads.length, -1, [], null, new Set());
  assert(!('storehouse' in made), 'a farm made in play has no storehouse');
  const bare = st.farmsteads.find((f) => f.household !== null);
  Fac.raze(st, bare, 'storehouse');
  const back = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(has(back, back.farmsteads[bare.id], 'storehouse'), null, 'none after a save and a load');
}
// ---- 2. each halving: the storehouse the grain, the barn the hay ----
{
  const st = fresh();
  const hh = st.households.find((h) => h.herds.length),
    f = st.farmsteads[hh.farmstead];
  hh.grain = { barley: 2000 };
  hh.hay = 5000;
  const grainDay = grainLoss(st, hh),
    hayDay = hayLoss(st, hh);
  assert(grainDay > 0 && hayDay > 0, 'a large store loses some');
  const lose = () => {
    const g = Stores.grainOf(hh),
      h = hh.hay;
    spoilGrain(st, hh);
    spoilHay(st, hh);
    const out = [g - Stores.grainOf(hh), h - hh.hay];
    hh.grain = { barley: 2000 };
    hh.hay = h;
    return out;
  };
  close(lose()[0], grainDay * BUILD.storehouse.loss, 'with both: the grain at the storehouse loss');
  close(lose()[1], hayDay * BUILD.barn.loss, 'and the hay at the barn loss');
  Fac.raze(st, f, 'barn');
  const [g1, h1] = lose();
  close(g1, grainDay * BUILD.storehouse.loss, 'the barn gone: the grain as before');
  close(h1, hayDay, 'the hay whole');
  Fac.raze(st, f, 'storehouse');
  close(lose()[0], grainDay, 'the storehouse gone: the grain whole');
  sound(st, 'halvings');
}
// ---- 3. the head's menu: each by what it saves a year against its hours ----
{
  const st = fresh();
  const hh = st.households.find((h) => h.herds.length),
    f = st.farmsteads[hh.farmstead],
    plan = st.plans.households.get(hh.id);
  hh.grain = { barley: 2000 };
  hh.hay = 5000;
  const offered = (what) => menu(st, plan, hh, f).find((o) => o.what === what);
  assert(!offered('storehouse') && !offered('barn'), 'none offered where both stand');
  Fac.raze(st, f, 'storehouse');
  Fac.raze(st, f, 'barn');
  const sum = (a) => a.reduce((s, x) => s + x, 0),
    want = (day, B) => Math.min(2, (day * YEAR_DAYS * (1 - B.loss)) / sum(B.hours));
  close(
    offered('storehouse').weight,
    want(grainLoss(st, hh), BUILD.storehouse),
    'the storehouse by the grain it saves',
  );
  close(offered('barn').weight, want(hayLoss(st, hh), BUILD.barn), 'the barn by the hay it saves');
  hh.hay = 0;
  assert(!offered('barn'), 'no hay: no barn offered');
  assert(offered('storehouse'), 'the storehouse still');
}
// ---- 4. by the plan: the played head builds a storehouse ----
{
  const st = fresh();
  Sim.advance(st, 3);
  Sim.inhabit(st, 0);
  Sim.setAuto(st, st.player.pawn, false);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead];
  const viewOf = () => Sim.farmView(st, f.id, st.player.pawn).outbuildings;
  assert.deepStrictEqual(
    viewOf().map((o) => o.what),
    ['storehouse', 'barn', 'byre'],
    'the farm view lists both',
  );
  assert.match(
    String(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'storehouse' })),
    /has a storehouse/,
  );
  Fac.raze(st, f, 'storehouse');
  assert.deepStrictEqual(viewOf()[0], {
    what: 'storehouse',
    built: false,
    needs: OUTBUILDINGS.storehouse.needs,
    ok: true,
    why: null,
    planned: false,
    building: null,
  });
  assert.deepStrictEqual(OUTBUILDINGS.storehouse.needs, { timber: 20, stone: 0, hours: 60 });
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { outbuilding: f.house, what: 'storehouse' }), true);
  const steps = chainSteps(st, hh.id, 'outbuilding', f.house).steps;
  assert.deepStrictEqual(
    steps.map((y) => y.kind),
    ['timber', 'storewalls', 'storeroof'],
  );
  const P = VB['sim/steps'];
  for (let i = 0; i < 120 * 240 && P.pawnPlan(st, st.player.pawn).tasks.some((t) => t.kind === 'outbuilding'); i++)
    Sim.advance(st, 0.1);
  assert(has(st, f, 'storehouse') && has(st, f, 'storehouse').built <= st.t, 'the farm has its storehouse');
  sound(st, 'by the plan');
}
// ---- 5. the drawing rule (page/settlement yardOut): each only where the sim has it ----
{
  const src = fs.readFileSync(path.join(__dirname, '../src/page/settlement.js'), 'utf8');
  const grab = (name) => src.match(new RegExp(`^const ${name} = .*$`, 'm'))[0];
  const yardOut = new Function('Sim', 'st', `${grab('yardOut')}\nreturn yardOut;`)({ standing: (st, f, k) => f[k] || null }, null);
  assert.deepStrictEqual(yardOut({ barn: { built: 0 }, storehouse: { built: 0 } }), ['barn', 'harbre']);
  assert.deepStrictEqual(yardOut({ barn: null, storehouse: { built: 0 } }), ['harbre']);
  assert.deepStrictEqual(yardOut({}), [], 'a farm with neither draws neither');
  assert(!/\blada: \[/.test(src), 'no always-drawn lada');
}
console.log(
  'storehouse: both at seeding, neither on a camp, an older save; the grain halved by the storehouse, the hay by the barn; ' +
    'the menu by what each saves; by the plan; drawn only where the sim has it',
);
