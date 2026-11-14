// Incremental root-distance maintenance: compare every partial repair with an independent scan-based Dijkstra oracle.
const assert = require('assert'), vb = require('../src/load.js');
const { tinyWorld } = require('./lib/tiny.js');
const { Costs, TreePool, Solver, IndexedHeap } = require('../tools/lib/village-trees.js');
const R = vb['sim/routes'], rules = vb['sim/rules'], { hexSteps } = vb['sim/hex'];
const make = (rows, cap = 256, grow = 1) => {
  const w = tinyWorld(rows); w.dev = new Uint8Array(w.N); w.worn = new Uint8Array(w.N); w.he.fill(0.2);
  const costs = new Costs(w, R), pool = new TreePool(costs, { repair: true, cap, grow });
  return { w, costs, pool, solver: new Solver(costs, hexSteps, rules) };
};
const less = (a, t, b, u) => a < b || (a === b && t < u);
function oracle(w, root) {
  const g = new Float64Array(w.N).fill(Infinity), time = g.slice(), shut = new Uint8Array(w.N);
  g[root] = time[root] = 0;
  for (let n = 0; n < w.N; n++) {
    let i = -1;
    for (let j = 0; j < w.N; j++) if (!shut[j] && g[j] < Infinity && (i < 0 || less(g[j], time[j], g[i], time[i]))) i = j;
    if (i < 0) break; shut[i] = 1;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d]; if (j < 0 || shut[j] || R.tileCost(w, j) === Infinity) continue;
      const ng = g[i] + R.stepCost(w, i, j, true), nt = time[i] + R.stepCost(w, i, j);
      if (less(ng, nt, g[j], time[j])) { g[j] = ng; time[j] = nt; }
    }
  }
  return { g, time };
}
let states = 0, queries = 0;
function check(x, tree) {
  const { w } = x, exact = oracle(w, tree.root), radius = tree.peek()?.k ?? tree.maxSettled;
  assert(tree.heap.size <= tree.nodes.size, 'at most one queue entry per discovered record');
  assert(tree.nodes.size <= tree.cap + 6);
  for (let i = 0; i < w.N; i++) if (R.tileCost(w, i) < Infinity) {
    const a = tree.potential(i, radius), b = Math.min(exact.g[i], radius);
    assert(Math.abs(a - b) < 1e-8, `partial potential at ${i}: ${a} vs ${b}, radius ${radius}`);
    if (tree.known(i)) {
      const r = tree.nodes.get(i);
      assert(Math.abs(r.g - exact.g[i]) < 1e-8);
      assert(Math.abs(r.t - exact.time[i]) < 1e-8, 'certificate also preserves physical tie-break');
      if (i !== tree.root) {
        const p = tree.nodes.get(r.parent); assert(p && x.costs.open(r.parent), 'certified parent is traversable');
        const e = x.costs.edge(i, r.parent);
        assert(Math.abs(r.g - p.g - e.cost) < 1e-8 && Math.abs(r.t - p.t - e.time) < 1e-8, 'parent matches both distance labels');
      }
    }
  }
  for (const goal of [w.N - 1, Math.floor(w.N / 2)]) {
    const h = tree.heuristic(goal);
    for (let i = 0; i < w.N; i++) if (x.costs.open(i)) for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j >= 0 && x.costs.open(j)) assert(h(i) <= x.costs.edge(i, j).cost + h(j) + 1e-8, 'consistent during unfinished repair');
    }
    for (const from of [0, Math.floor(w.N / 3), w.N - 1]) {
      const actual = x.solver.route(from, goal, tree), native = R.findRoute(w, from, goal, Infinity);
      assert.strictEqual(!!actual, !!native);
      if (actual) {
        assert(Math.abs(actual.cost - R.routeCost(w, native, true)) < 1e-8);
        assert(Math.abs(actual.time - R.routeCost(w, native)) < 1e-8);
      }
      queries++;
    }
  }
  states++;
}

// Indexed queue handles priority increases, decreases and removals without stale entries.
const heap = new IndexedHeap();
for (let i = 0; i < 30; i++) heap.push({ i, k: 30 - i, t: 0, b: 0 });
for (let i = 0; i < 30; i++) heap.push({ i, k: (i * 17) % 31, t: 0, b: 0 });
for (let i = 0; i < 30; i += 3) heap.remove(i);
let last = -Infinity;
while (heap.size) { const q = heap.pop(); assert(q.k >= last); last = q.k; }
assert.strictEqual(heap.positions.size, 0);

const x = make(['.F..FFF...', 'FFF...F...', '..F.~.....', 'F...F..FF.', '..FFFF....', '.....F....']);
const tree = x.pool.get(0, 0);
for (let i = 0; i < 65; i++) { x.pool.grow(tree, [59]); check(x, tree); }
// Multiple changes can arrive before any repair work: increased edges, cheaper non-parent edges, doors and new crossings.
for (const [tile, kind, value] of [[15, 'worn', 3], [15, 'worn', 0], [30, 'dev', 3], [30, 'dev', 0],
  [24, 'water', 0], [24, 'biome', vb.gen.B.MEADOW], [16, 'biome', vb.gen.B.MEADOW], [35, 'hm', 1], [35, 'hm', 0.5]]) {
  x.w[kind][tile] = value; x.pool.changed(tile);
  assert.strictEqual(x.pool.get(0, 0), tree, 'changed branches keep the tree');
  check(x, tree);
  for (let k = 0; k < 18; k++) { x.pool.grow(tree, [59]); check(x, tree); }
}
// Hundreds of pending updates remain bounded; every pending state still has a safe clipped potential.
for (let k = 0; k < 300; k++) {
  x.w.worn[15] = k % 2 ? 3 : 0; x.pool.changed(15);
  assert(tree.heap.size <= tree.nodes.size);
}
check(x, tree);
for (let k = 0; k < 80; k++) { x.pool.grow(tree, [59]); check(x, tree); }

// An isolated leaf increase repairs only that branch; unaffected labels/records survive.
const line = make(['............'], 128, 100), t = line.pool.get(0, 0);
line.pool.grow(t, [11]); const before = line.pool.stats.treeSettled, record = t.nodes.get(3);
line.w.biome[11] = vb.gen.B.FOREST; line.pool.changed(11); check(line, t); line.pool.grow(t, [11]);
assert.strictEqual(line.pool.get(0, 0), t); assert.strictEqual(t.nodes.get(3), record);
assert(line.pool.stats.treeSettled - before <= 3, 'one leaf does not rebuild the whole tree'); check(line, t);

// Opening previously unseen blocked land can join disconnected components; closing it can detach them again.
const islands = make(['..~...', '..~...', '..~...'], 256, 1), it = islands.pool.get(0, 0);
it.grow([17], 100); check(islands, it);
islands.w.water[2] = 0; islands.w.biome[2] = vb.gen.B.MEADOW; islands.pool.changed(2); check(islands, it);
for (let k = 0; k < 35; k++) { islands.pool.grow(it, [17]); check(islands, it); }
islands.w.water[2] = 1; islands.pool.changed(2); check(islands, it);
for (let k = 0; k < 35; k++) { islands.pool.grow(it, [17]); check(islands, it); }

// A hard record cap stops BEFORE partially relaxing a vertex. Repeated capped repair remains admissible.
const capped = make(Array(8).fill('.'.repeat(12)), 8, 100), ct = capped.pool.get(0, 0);
capped.pool.grow(ct, [95]); check(capped, ct);
capped.w.dev[1] = 3; capped.pool.changed(1);
for (let k = 0; k < 12; k++) { capped.pool.grow(ct, [95]); check(capped, ct); }
assert(ct.nodes.size <= 14); assert(capped.pool.stats.capStops > 0);
// A closed root is the explicit full-reset exception; reopening starts a safe fresh tree.
line.w.dev[0] = 3; line.pool.changed(0); assert.strictEqual(line.pool.get(0, 0), null);
line.w.dev[0] = 0; line.pool.changed(0); const fresh = line.pool.get(0, 0); assert.notStrictEqual(fresh, t); check(line, fresh);
// A decreased non-parent edge must be considered, even though the old chosen path did not use it.
const alternate = make(['.FFFFF.F', 'FF.FFFF.', '.FFFF.FF', 'FFF.FFFF', 'F.FFFFF.']), at = alternate.pool.get(0, 0);
at.grow([39], 1000); const old = oracle(alternate.w, 0); let shortcut = -1;
for (let i = 1; i < alternate.w.N && shortcut < 0; i++) if (alternate.w.biome[i] === vb.gen.B.FOREST) {
  alternate.w.biome[i] = vb.gen.B.MEADOW; const next = oracle(alternate.w, 0); alternate.w.biome[i] = vb.gen.B.FOREST;
  for (let d = 0; d < 6; d++) {
    const j = alternate.w.nb[i * 6 + d];
    if (j >= 0 && at.nodes.get(j)?.parent !== i && next.g[j] < old.g[j] - 1e-8) shortcut = i;
  }
}
assert(shortcut >= 0); alternate.w.biome[shortcut] = vb.gen.B.MEADOW; alternate.pool.changed(shortcut);
check(alternate, at);
for (let k = 0; k < 45; k++) { alternate.pool.grow(at, [39]); check(alternate, at); }
// A new opening at a completely full record cap is an explicit safe reset, not an ignored shortcut.
const limit = make(['.'.repeat(40), '~'.repeat(40)], 8, 100), lt = limit.pool.get(0, 0);
limit.pool.grow(lt, [39]); assert.strictEqual(lt.nodes.size, 14);
limit.w.water[40] = 0; limit.w.biome[40] = vb.gen.B.MEADOW; limit.pool.changed(40);
assert.strictEqual(limit.pool.stats.capResets, 1); assert.notStrictEqual(limit.pool.get(0, 0), lt);
check(limit, limit.pool.get(0, 0));
// Physical time is the secondary objective: repair it even when preference distance does not change at all.
const tieWorld = tinyWorld(['...', '...']), edges = new Map(), key = (a, b) => Math.min(a, b) * 6 + Math.max(a, b);
for (const [path, time] of [[[0, 1, 2, 5], 1], [[0, 3, 4, 5], 2]]) for (let k = 1; k < path.length; k++) edges.set(key(path[k - 1], path[k]), [9, time]);
const closed = new Set();
const tieCosts = new Costs(tieWorld, { tileCost: (w, i) => closed.has(i) ? Infinity : 1,
  stepCost: (w, a, b, prefer) => (edges.get(key(a, b)) || [100, 100])[prefer ? 0 : 1] });
const tiePool = new TreePool(tieCosts, { repair: true }), tieTree = tiePool.get(0, 0), tieSolver = new Solver(tieCosts, hexSteps, rules);
tiePool.grow(tieTree, [5]); assert.strictEqual(tieSolver.route(0, 5, tieTree).time, 3);
edges.set(key(1, 2), [9, 5]); tiePool.changed(1); tiePool.grow(tieTree, [5]);
assert.strictEqual(tieSolver.route(0, 5, tieTree).time, 6);
edges.set(key(1, 2), [9, 1]); tiePool.changed(1); tiePool.grow(tieTree, [5]);
assert.strictEqual(tieSolver.route(0, 5, tieTree).time, 3);
for (const [a, b] of [[0, 3], [3, 4], [4, 5]]) edges.set(key(a, b), [9, 1]);
tiePool.changed(3); tiePool.changed(4); tiePool.grow(tieTree, [5]);
closed.add(2); tiePool.changed(2); tiePool.grow(tieTree, [5]);
const replacement = tieSolver.route(0, 5, tieTree);
assert.strictEqual(replacement.time, 3); assert(!replacement.path.includes(2), 'equal-cost replacement parent replaces a closed doorway');
// A preferred detour may exceed the physical budget, before and after a path-stage repair.
const speeds = [...rules.PATHS.speed], clearing = [...rules.PATHS.clear];
try {
  rules.PATHS.speed.fill(1); rules.PATHS.clear.fill(0);
  const bounded = make(Array(16).fill('F'.repeat(30)), 1024, 64), a = 8 * 30 + 5, b = 8 * 30 + 15;
  for (let c = 5; c <= 15; c++) bounded.w.worn[7 * 30 + c] = 3;
  bounded.w.worn[a] = bounded.w.worn[b] = 3;
  const bt = bounded.pool.get(0, a); bounded.pool.grow(bt, [b]);
  const budget = R.routeCost(bounded.w, R.findRoute(bounded.w, a, b, Infinity, false));
  for (const stage of [3, 2]) {
    bounded.w.worn[7 * 30 + 10] = stage; bounded.pool.changed(7 * 30 + 10); bounded.pool.grow(bt, [b]);
    const actual = bounded.solver.route(a, b, bt, budget), native = R.findRoute(bounded.w, a, b, budget);
    assert(Math.abs(actual.time - budget) < 1e-8);
    assert(Math.abs(actual.cost - R.routeCost(bounded.w, native, true)) < 1e-8);
    assert.strictEqual(bounded.solver.route(a, b, bt, budget - 0.01), null);
  }
  assert(bounded.solver.stats.fallbacks > 0);
} finally { rules.PATHS.speed.splice(0, speeds.length, ...speeds); rules.PATHS.clear.splice(0, clearing.length, ...clearing); }
console.log(`incremental village trees ok: ${states} partial/changed states, ${queries} exact queries, local leaf repair and bounded queues`);
