// Exactness of the research accelerator, including partial trees and endpoint exceptions.
const assert = require('assert'), vb = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { Costs, TreePool, Solver } = require('../tools/lib/village-trees.js');
const R = vb['sim/routes'], rules = vb['sim/rules'], { hexSteps } = vb['sim/hex'];
const make = rows => {
  const w = tinyWorld(rows); w.dev = new Uint8Array(w.N); w.worn = new Uint8Array(w.N); w.he.fill(0.2);
  const costs = new Costs(w, R), pool = new TreePool(costs, { cap: 256, grow: 4 });
  return { w, costs, pool, solver: new Solver(costs, hexSteps, rules) };
};
let checked = 0;
function compare(x, from, to, tree, budget = Infinity) {
  const actual = x.solver.route(from, to, tree, budget), native = R.findRoute(x.w, from, to, budget);
  assert.strictEqual(!!actual, !!native);
  if (native) {
    assert(Math.abs(actual.cost - R.routeCost(x.w, native, true)) < 1e-8, `choice ${from}->${to}`);
    assert(Math.abs(actual.time - R.routeCost(x.w, native)) < 1e-8, `time ${from}->${to}`);
  }
  checked++; return actual;
}
const x = make(['....F.....', '...FFF....', '....~.....', '.F........', '.....F....', '..........']);
const tree = x.pool.get(0, 0);
x.pool.grow(tree, [59]);
assert.strictEqual(x.pool.stats.treeSettled, 4, 'growth is spread over requests');
assert(!tree.nodes.get(59)?.done);
// Paused frontier distances form a consistent truncated potential, even across unexplored land.
for (const goal of [0, 9, 25, 59]) {
  const h = tree.heuristic(goal);
  for (let i = 0; i < x.w.N; i++) if (x.costs.open(i)) for (let d = 0; d < 6; d++) {
    const j = x.w.nb[i * 6 + d];
    if (j >= 0 && x.costs.open(j)) assert(h(i) <= x.costs.edge(i, j).cost + h(j) + 1e-8);
  }
}
for (let k = 0; k < 18; k++) {
  x.pool.grow(tree, [59]);
  for (const [from, to] of [[9, 50], [1, 59], [59, 0], [40, 19]]) compare(x, from, to, tree);
}
const settled = tree.nodes.size, prior = x.pool.stats.treeSettled;
x.pool.grow(tree, [0]); assert.strictEqual(x.pool.stats.treeSettled, prior, 'near demand does not restart');
assert(settled > 4);
// Branch-to-branch journeys remain direct, even if the shared root is far away.
const open = make(Array(8).fill('.'.repeat(12))), full = open.pool.get(0, 0);
full.grow([95], 200);
const direct = compare(open, 91, 95, full);
assert(!direct.path.includes(0), 'arbitrary branches do not detour via the root');
assert.strictEqual(open.solver.stats.certified, 0, 'a different branch is not certified');
compare(open, 0, 95, full); assert.strictEqual(open.solver.stats.certified, 1, 'root journeys skip A*');
// Houses have several legal doorways, but cannot be transit vertices. Test all pairs around a multi-door house.
open.w.dev[52] = 3; open.pool.changed(52);
const houseTree = open.pool.get(0, 0); houseTree.grow([95], 200);
for (let i = 0; i < open.w.N; i += 3) { compare(open, i, 52, houseTree); compare(open, 52, i, houseTree); }
// A change beyond the explored frontier retains exact settled labels; later growth reads the new edge.
const far = make(Array(8).fill('F'.repeat(15))), local = far.pool.get(0, 0);
far.pool.grow(local, [119]);
assert(!local.touched.has(119)); far.w.worn[119] = 3; far.pool.changed(119);
assert.strictEqual(far.pool.get(0, 0), local, 'unrelated changes keep a valid partial tree');
local.grow([119], 500);
compare(far, 119, 0, local);
// Increases and decreases adjacent to settled tiles invalidate, including opening a previously blocked tile.
for (const value of [3, 0]) { far.w.worn[0] = value; far.pool.changed(0); assert(!far.pool.trees.has(0)); far.pool.get(0, 0).grow([119], 4); }
const blocked = make(['..~...', '..~...', '..~...']), island = blocked.pool.get(0, 0);
island.grow([17], 100); compare(blocked, 0, 17, island);
blocked.w.water[2] = 0; blocked.w.biome[2] = vb.gen.B.MEADOW; blocked.pool.changed(2);
assert(!blocked.pool.trees.has(0), 'opening a blocked neighbour invalidates');
compare(blocked, 0, 17, blocked.pool.get(0, 0));
// A finite cap leaves a sound frontier, rather than dropping unrelaxed neighbours.
const capPool = new TreePool(open.costs, { cap: 8, grow: 1000 }), capped = capPool.get(0, 0);
capPool.grow(capped, [95]); assert(capped.nodes.size <= 14);
compare(open, 91, 95, capped);
// Physical reach stays physical when preference chooses a slower low-effort path.
const speed = [...rules.PATHS.speed], clear = [...rules.PATHS.clear];
try {
  rules.PATHS.speed.fill(1); rules.PATHS.clear.fill(0);
  const wet = make(Array(16).fill('F'.repeat(30))), a = 8 * 30 + 5, b = 8 * 30 + 15;
  for (let c = 5; c <= 15; c++) wet.w.worn[7 * 30 + c] = 3;
  wet.w.worn[a] = wet.w.worn[b] = 3;
  const t = wet.pool.get(0, a); t.grow([b], 500);
  const fastest = R.routeCost(wet.w, R.findRoute(wet.w, a, b, Infinity, false));
  compare(wet, a, b, t, fastest); compare(wet, a, b, t, fastest - 0.01);
  assert(wet.solver.stats.fallbacks > 0);
} finally { rules.PATHS.speed.splice(0, speed.length, ...speed); rules.PATHS.clear.splice(0, clear.length, ...clear); }
// Live development must publish changes as well as forest and path stages; otherwise any persistent tree can go stale.
const state = tinyState(tinyWorld(Array(14).fill('.'.repeat(22))), [{ at: [7, 7], farms: 2 }]);
const field = 0, meadow = 1, farm = state.farmsteads[0], hh = state.households[farm.household];
state.routeDirty.clear(); vb['sim/fields'].broken(state, field, 0);
assert(state.routeDirty.has(field), 'breaking a field notifies routing');
vb['sim/meadows'].addMeadow(state, farm, hh, meadow);
assert(state.routeDirty.has(meadow), 'making a meadow notifies routing');
const tr = { tile: 2, kind: 'field', i: 0, steps: ['break'] };
const unfinished = { tile: 3, kind: 'field', i: 0, steps: ['break'] };
const plot = { holder: { id: 0 }, steps: [{ places: [tr, unfinished] }, {}, {}] };
vb['sim/expansion'].finishStep(state, { tr, plot });
assert(state.routeDirty.has(2), 'breaking a village plot notifies routing');
console.log(`village trees ok: ${checked} exact queries; partial growth, houses, mutation, islands, caps, physical fallback and development notifications`);
