// Active effort policy: a detour can cost more time but less effort; wetness is not drained by trampling.
const assert = require('assert'), VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const R = VB['sim/routes'], { PATHS } = VB['sim/rules'];
const speeds = [...PATHS.speed], weight = PATHS.effort.weight;
const world = (ground = 'F') => {
  const w = tinyWorld(Array(16).fill(ground.repeat(30)));
  w.dev = new Uint8Array(w.N); w.worn = new Uint8Array(w.N); w.he.fill(0.2); w.hm.fill(0.5);
  return w;
};
const at = (x, y) => y * 30 + x, from = at(5, 8), to = at(15, 8);
function lane(w, up) {
  const tiles = new Set();
  for (let y = 8; y >= 8 - up; y--) tiles.add(at(5, y));
  for (let x = 5; x <= 15; x++) tiles.add(at(x, 8 - up));
  for (let y = 8 - up; y <= 8; y++) tiles.add(at(15, y));
  for (const i of tiles) w.worn[i] = 3;
  return tiles;
}
try {
  // Equalise actual movement speeds to isolate effort from the already existing stage speed bonuses.
  PATHS.speed.fill(1);
  const w = world(), main = lane(w, 1), fast = R.findRoute(w, from, to, Infinity, false), preferred = R.findRoute(w, from, to, Infinity);
  const fastTime = R.routeCost(w, fast), preferredTime = R.routeCost(w, preferred),
    fastChoice = R.routeCost(w, fast, true), preferredChoice = R.routeCost(w, preferred, true);
  assert(preferredTime > fastTime, 'preference accepts extra time at equal walking speed');
  assert(R.routeCost(w, preferred, true) < R.routeCost(w, fast, true), 'the detour has less effort-adjusted cost');
  assert(preferred.filter(i => main.has(i)).length > fast.filter(i => main.has(i)).length, 'the established path attracts the route');
  assert(Math.abs(R.reachCosts(w, from, Infinity, [to])[0] - preferredTime) < 1e-9, 'reach reports actual time, not preference points');
  VB.resetCounts();
  const bounded = R.findRoute(w, from, to, fastTime);
  assert.strictEqual(VB.count.routeBudgetFallback, 1, 'the extra budget search is measured');
  assert(Math.abs(R.routeCost(w, bounded) - fastTime) < 1e-9, 'a tight physical budget uses the fastest feasible route');
  assert(Math.abs(R.reachCosts(w, from, fastTime, [to])[0] - fastTime) < 1e-9, 'bounded reach still includes the destination');
  assert.strictEqual(R.findRoute(w, from, to, fastTime - 0.01), null, 'effort cannot create extra physical reach');
  const far = world(); lane(far, 6);
  assert.strictEqual(R.findRoute(far, from, to, Infinity).length, fast.length, 'a distant beaten path does not justify a large detour');
  // Stage progression changes choice independently of movement.
  const ratios = [];
  for (let stage = 0; stage < 4; stage++) {
    w.worn[at(25, 12)] = stage;
    assert.strictEqual(R.tileCost(w, at(25, 12)), 1.5);
    ratios.push(R.tileCost(w, at(25, 12), true) / R.tileCost(w, at(25, 12)));
  }
  assert(ratios.every((v, k) => k === 0 || v < ratios[k - 1]), 'trodden ground already reduces obstruction; later stages improve it');
  // Flat grass is close to a dirt path in measured energetic cost: no extra vegetation benefit is invented for it.
  const grass = world('.'), cost0 = R.tileCost(grass, 0, true);
  grass.worn[0] = 3;
  assert.strictEqual(R.tileCost(grass, 0, true), cost0);
  const dry = R.findRoute(grass, from, to, Infinity);
  for (let x = 6; x < 15; x++) { grass.hm[at(x, 8)] = 1; grass.worn[at(x, 8)] = 3; }
  const wet = R.findRoute(grass, from, to, Infinity);
  assert(R.routeCost(grass, wet) > R.routeCost(grass, dry), 'persistent wet ground encourages a longer dry route');
  assert(R.routeCost(grass, wet, true) < R.routeCost(grass, dry, true), 'the dry detour reduces effort');
  const wetTile = at(9, 8), wetCost = R.tileCost(grass, wetTile, true);
  grass.worn[wetTile] = 0;
  assert.strictEqual(R.tileCost(grass, wetTile, true), wetCost, 'trampling does not drain saturated ground');
  const sand = world(','), bog = world('m');
  for (const land of [sand, bog]) {
    const excess = R.tileCost(land, 0, true) / R.tileCost(land, 0);
    land.worn[0] = 3;
    assert.strictEqual(R.tileCost(land, 0, true) / R.tileCost(land, 0), excess, 'traffic cannot remove persistent soft substrate');
  }
  bog.river = new Uint8Array(bog.N); bog.crossing = new Uint8Array(bog.N);
  bog.river[0] = 1; bog.crossing[0] = 2; bog.hm[0] = 1;
  assert.strictEqual(R.tileCost(bog, 0, true), R.tileCost(bog, 0), 'an actual bridge has firm footing across a wet tile');
  // An off-route path improves effort only: cache invalidation must use preference, not just travel time.
  const changing = world(), st = { w: changing, pathCache: new Map(), routeDirty: new Set(), routeFallbacks: 0 };
  const old = R.route(st, from, to); const newLane = lane(changing, 1);
  for (const tile of newLane) R.costChanged(st, tile);
  R.refreshRoutes(st);
  const next = R.route(st, from, to);
  assert.notDeepStrictEqual(next, old, 'a newly attractive path outside the old route is discovered');
  assert(R.routeCost(changing, next, true) < R.routeCost(changing, old, true));
  PATHS.effort.weight = 0;
  assert.strictEqual(R.routeCost(w, R.findRoute(w, from, to, Infinity)), fastTime, 'zero weight is an explicit time-only diagnostic');
  console.log(JSON.stringify({ directWalkingCost: fastTime, pathWalkingCost: preferredTime,
    directChoice: fastChoice, pathChoice: preferredChoice, stageEffortFactors: ratios, wetDetourSteps: wet.length - dry.length }));
} finally { PATHS.speed.splice(0, PATHS.speed.length, ...speeds); PATHS.effort.weight = weight; }
// New saves retain policy caches; old time-only caches and village-hour tables are rebuilt immediately on load.
const rows = Array(18).fill('.'.repeat(30)), w = tinyWorld(rows);
const st = tinyState(w, [{ at: [7, 9], farms: 2 }, { at: [21, 9], farms: 2 }], { seed: 7 });
R.route(st, st.villages[0].center, st.villages[1].center);
const data = JSON.parse(JSON.stringify(VB.sim.save(st)));
const current = VB.sim.load(tinyWorld(rows), data);
assert.deepStrictEqual([...current.pathCache], [...st.pathCache], 'current-policy saves preserve their routes');
VB.sim.advance(st, 2 * VB.sim.DAY); VB.sim.advance(current, 2 * VB.sim.DAY);
assert.deepStrictEqual(VB.sim.save(current), VB.sim.save(st), 'active-policy continuation is identical after save/load');
delete data.routePolicy;
const legacy = VB.sim.load(tinyWorld(rows), data);
assert.strictEqual(legacy.pathCache.size, 0, 'legacy cached time-only routes are discarded');
const want = R.reachCosts(legacy.w, legacy.villages[0].center, VB['sim/rules'].ROUTE.reach, legacy.villages.map(v => v.center));
assert(Math.abs(legacy.villageHours[0][1] - want[1] / VB['sim/rules'].SPEED) < 1e-9, 'legacy village hours use the new chosen route');
console.log('effort routes ok: active detours, physical reach, moisture, stage changes and legacy migration');
