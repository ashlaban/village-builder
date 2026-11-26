// VB-1667: the farmstead placed anywhere reachable on foot. Placed off the landing, the house moves and nothing teleports: the grain (by
// crop, but for the head's back load), the firewood and the hay lie at the landing as loads to fetch, the carts stand there and the herds
// with them; the farmstead task drives the herds, fetches the carts and the loads, then fetches its timber and raises the shelter. A lone
// farm's village follows its house. Sim.moveCost reads what a tile costs. A move of 2 steps and of 10; the stocks conserved; the
// refusals; a save mid-move goes on the same. On a tiny land, open but for a strip of forest along its top.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { stepsTo } = VB['sim/hex'],
  { walkable, invalidateReach } = VB['sim/walking'],
  Stores = VB['sim/stores'],
  { TRAVEL, ECON } = VB['sim/rules'];
const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? 'F'.repeat(44) : '.'.repeat(44)));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const seed = (play = true) => {
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true });
  st.naturalDeaths = false;
  if (!play) return st;
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 });
  return st;
};
const stepsOf = (st, t) => stepsTo(st.w, st.farmsteads[0].house, t, st.w.N, walkable(st.w));
// A tile `n` walking steps from the landing that takes the farmstead.
const tileAt = (st, n) => {
  for (let t = 0; t < st.w.N; t++) if (stepsOf(st, t) === n && Sim.placeWhy(st, 'farmstead', t) === null) return t;
  return -1;
};
// What the household has, wherever it lies: grain, firewood, hay, carts and animals, at home, lying, standing at the landing.
const holdings = (st) => {
  const hh = st.households[0],
    lying = st.lying || [],
    sum = (k) => lying.filter((l) => l.kind === k).reduce((s, l) => s + l.n, 0),
    herds = st.herds.filter((h) => h.household === 0);
  return {
    grain: Stores.grainOf(hh) + sum('leftGrain'),
    wood: hh.wood + (sum('leftTimber') * ECON.woodPerTrip) / TRAVEL.load,
    hay: hh.hay + sum('hay') * TRAVEL.hay,
    carts: hh.carts.length,
    animals: herds.reduce((s, h) => s + (h.species === 'cattle' ? h.head.length : h.ewes + h.rams + h.lambs), 0),
  };
};
// Plans the farmstead at `t` and runs until the task has left (or `days`): `placed` is called once when the house has moved; the hours
// from placing to the roof raised, the hungry days, the kinds of the steps the view named and those the agenda laid.
function move(st, t, placed = () => {}, days = 60) {
  const hh = st.households[0],
    f = st.farmsteads[0];
  const cost = Sim.moveCost(st, t),
    MOVE = VB['sim/planchains'].MOVE_KINDS,
    a = st.agents[hh.holder];
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: t }), true);
  const seen = new Set(),
    laid = new Set();
  let at = null,
    reckoned = null,
    worked = 0,
    raised = null,
    hungry = 0,
    low = Infinity;
  for (let i = 0; i < days * 240 && st.pawns[st.player.pawn].control.plan.tasks.length; i++) {
    Sim.advance(st, 0.1);
    if (at === null && f.shelter) {
      at = st.t;
      hungry = hh.hungryDays || 0;
      reckoned = Sim.agenda(st, st.player.pawn).plan.find((e) => e.kind === 'farmstead').ends - st.t;
      placed(st);
    }
    if (raised === null && f.shelter && f.shelter.built !== null) raised = st.t;
    if (at !== null && raised === null) low = Math.min(low, Stores.grainOf(hh));
    if (a.job && MOVE.includes(a.job.kind)) worked += 0.1;
    for (const v of Sim.planView(st, st.player.pawn).tasks) seen.add(v.step);
    if (i % 20 === 0) for (const g of Sim.agenda(st, st.player.pawn).days.flat()) if (g.what === 'task') laid.add(g.kind);
  }
  return { raised, hours: raised - at, hungry: (hh.hungryDays || 0) - hungry, low, seen, laid, cost, reckoned, worked };
}

// ---- 1. the refusals and the read for the page ----
{
  const st = seed(),
    f = st.farmsteads[0],
    w = st.w,
    t = tileAt(st, 12);
  assert(t >= 0, 'a tile 12 steps off takes the farmstead: no step bound for the played head');
  const c = Sim.moveCost(st, t);
  assert.deepStrictEqual(Object.keys(c), ['steps', 'trips', 'hours', 'frost']);
  assert.strictEqual(c.steps, 12);
  assert(c.trips.cart > 0 && c.trips.back > c.trips.cart && c.hours > 0, JSON.stringify(c));
  assert.deepStrictEqual(Sim.moveCost(st, f.house), { steps: 0, trips: { cart: 0, back: 0 }, hours: 0, frost: false });
  assert(Sim.moveCost(st, tileAt(st, 2)).hours < c.hours, 'nearer is cheaper');
  assert.strictEqual(Sim.moveCost(st, -1), null);
  // an island: walled off by water all round, the walkable parts labelled again
  const isl = tileAt(st, 6),
    ring = [];
  for (let d = 0; d < 6; d++) if (w.nb[isl * 6 + d] >= 0) ring.push(w.nb[isl * 6 + d]);
  for (const u of ring) (w.water[u] = 1), invalidateReach(w, u);
  assert.match(String(Sim.placeWhy(st, 'farmstead', isl)), /not reachable on foot from the camp/);
  for (const u of ring) (w.water[u] = 0), invalidateReach(w, u);
  assert.strictEqual(Sim.placeWhy(st, 'farmstead', isl), null);
  sound(st, 'refusals');
  // unplayed, the head's own rule places on the landing, and nothing moves
  const own = seed(false),
    of = own.farmsteads[0],
    land = of.house;
  Sim.advance(own, 30);
  assert(of.shelter && of.house === land && !own.lying && !own.herdsAway, 'its own rule: the landing, nothing left');
}
// ---- 2. a move of 2 steps and of 12: nothing teleports, the stocks conserved, the village follows; the hours and hungry days ----
const report = [];
for (const n of [2, 10, 24]) {
  const st = seed(),
    hh = st.households[0],
    f = st.farmsteads[0],
    v = st.villages[f.village],
    land = f.house,
    t = tileAt(st, n),
    before = holdings(st);
  assert(t >= 0, `a tile ${n} steps off`);
  let first = null;
  const r = move(st, t, () => {
    assert.strictEqual(f.house, t, 'the house moved');
    const at = holdings(st);
    for (const k of Object.keys(before)) assert(Math.abs(at[k] - before[k]) < 1e-6, `${k} conserved: ${before[k]}, ${at[k]}`);
    assert(Math.abs(Stores.grainOf(hh) - Math.min(TRAVEL.load, before.grain)) < 1e-6, 'the head carries one back load of grain');
    assert.strictEqual(hh.wood, 0);
    assert.strictEqual(hh.hay, 0);
    const left = st.lying.filter((l) => l.tile === land).map((l) => l.kind);
    assert.deepStrictEqual(left.sort(), ['hay', 'leftCart', 'leftGrain', 'leftTimber'], 'the loads and the cart at the landing');
    assert(hh.carts.every((c) => c.at && c.at.tile === land && c.at.kept), 'the carts stand at the landing');
    assert.deepStrictEqual(hh.herds, []);
    assert(st.herdsAway.length && st.herdsAway.every((id) => st.herds[id].tile === land), 'the herds stand at the landing');
    assert.strictEqual(v.center, t, "the lone farm's village follows its house");
    sound(st, `moved ${n}`);
    first = Sim.planView(st, st.player.pawn).tasks[0];
  });
  assert.strictEqual(first.step, 'drove', `the first step: the herds driven (${JSON.stringify(first)})`);
  assert(r.raised !== null, `the shelter raised ${n} steps off`);
  assert.strictEqual(st.pawns[st.player.pawn].control.plan.last.which, 'raised');
  for (const k of ['drove', 'leftCart', 'leftGrain', 'leftHay', 'leftTimber', 'shelter'])
    assert(r.seen.has(k), `the view named ${k}: ${[...r.seen]}`);
  assert(!st.lying && !st.herdsAway, 'everything fetched');
  assert(hh.carts.every((c) => !c.at), 'the carts home');
  const after = holdings(st);
  assert.strictEqual(after.carts, before.carts);
  // VB-1670: what the page's callout and the agenda reckon is what the move takes, within a quarter: the work of the move's trips
  // (Sim.moveCost hours) against the pawn's hours on them, and the agenda's end of the task at placing against the roof raised
  const near = (x, y) => Math.abs(x - y) <= 0.25 * y;
  report.push(
    `${n} steps: reckoned ${r.cost.hours} h of work (run ${r.worked.toFixed(0)}), the roof at ${Math.round(r.reckoned)} h (run ${Math.round(r.hours)})`,
  );
  assert(near(r.cost.hours, r.worked), report[report.length - 1]);
  assert(near(r.reckoned, r.hours), report[report.length - 1]);
  report.push(`${n} steps: roof ${Math.round(r.hours)} h after placing, ${r.hungry} hungry days (grain at home at least ${Math.round(r.low)}, ${hh.members.length} members), laid ${[...r.laid]}`);
  sound(st, `raised ${n} off`);
}
// ---- 3. a save and a load in the middle of a move go on the same ----
{
  const st = seed(),
    f = st.farmsteads[0],
    t = tileAt(st, 4);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: t }), true);
  for (let i = 0; i < 2400 && !f.shelter; i++) Sim.advance(st, 0.1);
  Sim.advance(st, 6);
  assert(st.lying && st.lying.some((l) => l.of.moving), 'mid-move: loads still at the landing');
  const saved = JSON.parse(JSON.stringify(Sim.save(st))),
    back = Sim.load(tinyWorld(rows), saved),
    again = Sim.load(tinyWorld(rows), saved);
  const run = (s) => {
    for (let i = 0; i < 60 * 240 && s.pawns[s.player.pawn].control.plan.tasks.length; i++) Sim.advance(s, 0.1);
  };
  run(back);
  run(again);
  run(st);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  assert.strictEqual(hash(st), hash(back), 'as the run itself');
  assert.strictEqual(back.pawns[back.player.pawn].control.plan.last.which, 'raised');
  sound(back, 'moved, loaded');
}
// ---- 4. the frost: the loads left lying are lost, the carts and the herds kept ----
{
  const st = seed(),
    hh = st.households[0],
    f = st.farmsteads[0];
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: tileAt(st, 4) }), true);
  for (let i = 0; i < 2400 && !f.shelter; i++) Sim.advance(st, 0.1);
  st.pawns[st.player.pawn].control.plan.tasks.length = 0; // the move left undone, to the frost
  Sim.setAuto(st, st.player.pawn, false);
  const herds = st.herdsAway.length;
  VB['sim/lying'].frost(st);
  VB['sim/carts'].cartsFrost(st);
  VB['sim/droving'].frost(st);
  assert.deepStrictEqual(st.lying.map((l) => l.kind), hh.carts.map(() => 'leftCart'), 'only the carts\' loads kept');
  assert(hh.carts.length && hh.carts.every((c) => c.at && c.at.kept), 'the carts kept');
  assert.strictEqual(st.herdsAway.length, herds, 'the herds kept');
  sound(st, 'the frost');
}
console.log(`move: ${report.join('; ')}`);
