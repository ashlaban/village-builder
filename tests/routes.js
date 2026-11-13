// Routes: cache keys never collide on a Large map, far targets are found, and the search takes the cheapest way by terrain (VB-096)
// and over worn paths (VB-110).
const VB = require('../src/load.js'), { B } = VB.gen, { route, findRoute, routeCost, refreshRoutes, costChanged } = VB['sim/routes'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('ROUTES FAIL:', m); } };
const grid = (COLS, ROWS) => {
  const N = COLS * ROWS, nb = new Int32Array(N * 6).fill(-1);
  for (let i = 0; i < N; i++) {
    const c = i % COLS, r = (i / COLS) | 0, o = (r & 1) ? 1 : 0;
    const cand = [[c - 1, r], [c + 1, r], [c - 1 + o, r - 1], [c + o, r - 1], [c - 1 + o, r + 1], [c + o, r + 1]];
    cand.forEach(([x, y], k) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) nb[i * 6 + k] = y * COLS + x; });
  }
  return { N, COLS, nb, water: new Uint8Array(N), biome: new Uint8Array(N).fill(B.MEADOW) };
};
{
  const COLS = 380, w = grid(COLS, 270), N = w.N;
  const st = { w, pathCache: new Map(), routeFallbacks: 0, routeDirty: new Set() };
  // (100029, 100030) and (100030, 30) share the old key from * 100000 + to; the second is too far to walk, so it falls back
  const p1 = route(st, 100029, 100030), p2 = route(st, 100030, 30);
  check(p1.length === 2 && p1[0] === 100029 && p1[1] === 100030, 'first pair gets its own path');
  check(p2.length === 1 && p2[0] === 30 && st.routeFallbacks === 1, 'second pair gets its own path, a counted fallback');
  st.routeFallbacks = 0;
  const far = route(st, 0, 100 + 100 * COLS);
  check(far.length > 60 && far[far.length - 1] === 100 + 100 * COLS && st.routeFallbacks === 0, 'a far target is found');
  const back = route(st, 100 + 100 * COLS, 0);
  check(back.length === far.length && back.every((t, k) => t === far[far.length - 1 - k]), 'the way back is the way there, reversed');
  w.water.fill(1); w.water[0] = 0;
  route(st, 0, N - 1);
  check(st.routeFallbacks === 1, 'unreachable target counts one fallback');
}
{
  // a hill ridge between two points: across it costs 2 a tile; round it is longer but cheaper once the ridge is wide enough
  const COLS = 30, w = grid(COLS, 30), at = (c, r) => r * COLS + c;
  for (let r = 11; r <= 17; r++) for (let c = 11; c <= 18; c++) w.biome[at(c, r)] = B.HILLS;
  const from = at(8, 14), to = at(21, 14), p = findRoute(w, from, to);
  const crossesHill = p.some((t) => w.biome[t] === B.HILLS), straight = 13;
  check(!!p && p[0] === from && p[p.length - 1] === to, 'a route is found');
  check(!crossesHill && p.length - 1 > straight, `the route goes round the hills (${p.length - 1} steps, cost ${routeCost(w, p)})`);
  // a narrow ridge is cheaper to cross than to go round
  w.biome.fill(B.MEADOW);
  for (let r = 0; r < 30; r++) w.biome[at(14, r)] = B.HILLS;
  const q = findRoute(w, from, to);
  check(q.some((t) => w.biome[t] === B.HILLS) && q.length - 1 === straight, 'a hill line with no way round is crossed straight');
  // snowfields are closed: a wall of snow with one gap is passed only through the gap
  w.biome.fill(B.MEADOW);
  for (let r = 0; r < 30; r++) if (r !== 25) w.biome[at(14, r)] = B.SNOW;
  const s = findRoute(w, from, to);
  check(s && !s.some((t) => w.biome[t] === B.SNOW) && s.includes(at(14, 25)), 'snowfields are never crossed; the gap is taken');
  w.biome[at(14, 25)] = B.SNOW;
  check(findRoute(w, from, to) === null, 'no route through a closed wall of snow');
  // a cached route through a tile whose cost changes is dropped at the end of the day; routes far from it stay
  w.biome.fill(B.MEADOW);
  const st = { w, pathCache: new Map(), routeFallbacks: 0, routeDirty: new Set() };
  const r1 = route(st, from, to), r2 = route(st, at(2, 2), at(4, 2));
  w.biome[r1[5]] = B.MARSH; costChanged(st, r1[5]); refreshRoutes(st);
  check(!st.pathCache.has(from * w.N + to) && st.pathCache.has(at(2, 2) * w.N + at(4, 2)), 'only the routes a changed tile may touch are dropped');
  check(route(st, from, to) !== r1 && r2 === route(st, at(2, 2), at(4, 2)), 'the dropped route is searched again');
}
{
  // slopes (Tobler's hiking function, symmetric; VB-438): a raised block of meadow between two points is walked round, though its ground
  // is as easy as the rest; the cost is the same up and down, the terrain's times a factor that grows with the rise and stops at the cap
  const { SLOPE, TERRAIN } = VB['sim/rules'], { stepCost, slopeFactor } = VB['sim/routes'];
  const COLS = 30, w = grid(COLS, 30), at = (c, r) => r * COLS + c;
  w.he = new Float32Array(w.N).fill(0.2);
  for (let r = 12; r <= 16; r++) for (let c = 11; c <= 18; c++) w.he[at(c, r)] = 0.5;
  const from = at(8, 14), to = at(21, 14), p = findRoute(w, from, to), flat = (q) => q.every((t) => w.he[t] < 0.3);
  check(!!p && flat(p) && p.length - 1 > 13, `the route goes round the raised ground (${p && p.length - 1} steps, cost ${p && routeCost(w, p).toFixed(2)})`);
  const back = findRoute(w, to, from);
  check(Math.abs(routeCost(w, back) - routeCost(w, p)) < 1e-9, 'the way back costs what the way there does');
  const a = at(10, 14), b = at(11, 14), rise = Math.abs(w.he[a] - w.he[b]);
  check(stepCost(w, a, b) === stepCost(w, b, a) && Math.abs(stepCost(w, a, b) - Math.min(SLOPE.max, Math.exp(SLOPE.tobler * SLOPE.grade * rise))) < 1e-9,
    `a step up costs what the step down does, the terrain times the slope's factor (${stepCost(w, a, b)})`);
  check(stepCost(w, at(2, 2), at(3, 2)) === 1 && stepCost(w, at(13, 14), at(14, 14)) === 1, 'level ground, low or high, costs the terrain alone');
  w.he[b] = 1; check(slopeFactor(w, a, b) === SLOPE.max, 'the steepest step costs the cap');
  w.he[b] = 0.5;
  // the factor multiplies the terrain: the same step over ground twice as hard to walk costs twice as much
  { const meadow = stepCost(w, a, b); w.biome[a] = w.biome[b] = B.HILLS;
    check(Math.abs(stepCost(w, a, b) - TERRAIN[B.HILLS] * meadow) < 1e-9, `a slope on hard ground costs in proportion (${stepCost(w, a, b)})`);
    w.biome[a] = w.biome[b] = B.MEADOW; }
  // the factor is convex in the rise, so the same climb in two steps costs less than in one: a ramp is cheaper than a cliff
  { const f = (r) => Math.min(SLOPE.max, Math.exp(SLOPE.tobler * SLOPE.grade * r)); check(2 * f(rise / 2) < 1 + f(rise), 'a ramp is cheaper than a cliff'); }
  // with slopes off the raised ground is crossed straight
  const grade = SLOPE.grade; SLOPE.grade = 0;
  const q = findRoute(w, from, to);
  SLOPE.grade = grade;
  check(q.length - 1 === 13 && !flat(q), 'with grade 0 the raised ground is crossed straight');
  // water at an end of a route lies at sea level, whatever its sea-floor depth
  w.he[at(0, 0)] = -0.8; w.he[at(1, 0)] = 0.1;
  check(Math.abs(slopeFactor(w, at(0, 0), at(1, 0)) - Math.exp(SLOPE.tobler * SLOPE.grade * 0.1)) < 1e-6, 'a sea floor counts as sea level');
}
{
  // two farms with a lane between them that bends round a meadow: the lane is taken when it is quicker than the straight way
  const COLS = 30, w = grid(COLS, 30), at = (c, r) => r * COLS + c;
  w.dev = new Uint8Array(w.N); w.worn = new Uint8Array(w.N);
  const from = at(5, 15), to = at(15, 15); w.dev[from] = w.dev[to] = 1;
  const lane = (up) => { // from `from` up `up` rows, along, and back down to `to`
    w.worn.fill(0);
    const tiles = [];
    for (let r = 15; r >= 15 - up; r--) tiles.push(at(5, r));
    for (let c = 6; c <= 15; c++) tiles.push(at(c, 15 - up));
    for (let r = 15 - up + 1; r <= 15; r++) tiles.push(at(15, r));
    for (const t of tiles) if (!w.dev[t]) w.worn[t] = 3;
    return new Set(tiles);
  };
  const onLane = (p, set) => p.slice(1, -1).every((t) => set.has(t));
  let set = lane(1), p = findRoute(w, from, to);
  check(onLane(p, set) && p.length - 1 > 10, `a lane one row off the straight way is taken (${p.length - 1} steps, cost ${routeCost(w, p).toFixed(2)})`);
  set = lane(4); p = findRoute(w, from, to);
  check(!onLane(p, set) && p.length - 1 === 10, `a lane four rows off is not (${p.length - 1} steps, cost ${routeCost(w, p).toFixed(2)})`);
  // trodden ground, paths and lanes are 5%, 15% and 30% quicker
  const c0 = VB['sim/routes'].tileCost(w, at(20, 20));
  w.worn[at(20, 20)] = 1; const c1 = VB['sim/routes'].tileCost(w, at(20, 20));
  w.worn[at(20, 20)] = 2; const c2 = VB['sim/routes'].tileCost(w, at(20, 20));
  check(Math.abs(c0 / c1 - 1.05) < 1e-9 && Math.abs(c0 / c2 - 1.15) < 1e-9, `stage speeds: ${c0 / c1}, ${c0 / c2}`);
}
// VB-198: use a tiny bound to exercise real hits, searches, saves and legacy trimming without a large fixture.
{
  const assert = require('assert'), { ROUTE } = VB['sim/rules'];
  const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
  const rows = Array(20).fill('.'.repeat(30)), w = tinyWorld(rows);
  const st = tinyState(w, [{ at: [10, 10], farms: 2, sizes: [6, 5] }], { seed: 7 });
  const key = (a, b) => a * w.N + b, keys = (s) => [...s.pathCache.keys()];
  const savedMax = ROUTE.cacheMax;
  assert.strictEqual(savedMax, 60000, 'the measured production cache bound is 60,000');
  try {
    ROUTE.cacheMax = 3;
    const first = route(st, 0, 1);
    route(st, 2, 3); route(st, 4, 5);
    assert.strictEqual(route(st, 0, 1), first, 'a direct hit returns the same path');
    assert.deepStrictEqual(keys(st), [key(2, 3), key(4, 5), key(0, 1)], 'a direct hit becomes most recent');
    const evictions = VB.count.routeEvict;
    route(st, 6, 7);
    assert.strictEqual(VB.count.routeEvict, evictions + 1, 'each eviction is counted at its owner');
    assert.deepStrictEqual(keys(st), [key(4, 5), key(0, 1), key(6, 7)], 'insertion evicts the least recent, not the most recent');
    const searches = VB.count.routeSearch;
    const reverse = route(st, 5, 4);
    assert.deepStrictEqual(reverse, [5, 4]);
    assert.strictEqual(VB.count.routeSearch, searches, 'a reverse hit does not search');
    assert.deepStrictEqual(keys(st), [key(6, 7), key(4, 5), key(5, 4)], 'reverse reuse touches its source as well as inserting its result');
    route(st, 2, 3);
    assert.strictEqual(VB.count.routeSearch, searches + 1, 'an evicted route can be searched again');
    assert.strictEqual(st.pathCache.size, ROUTE.cacheMax);
    assert.deepStrictEqual(checkState(st), [], 'a bounded cache passes the state invariant');

    const load = () => VB.sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(VB.sim.save(st))));
    const back = load();
    assert.deepStrictEqual([...back.pathCache], [...st.pathCache], 'save/load preserves paths and their LRU order');
    route(st, 8, 9); route(back, 8, 9);
    assert.deepStrictEqual([...back.pathCache], [...st.pathCache], 'the next eviction is identical after a save/load');
    // A pre-bound save's Map order is the only recency information available: retain its newest entries.
    st.pathCache.set(key(10, 11), [10, 11]);
    assert(checkState(st).some((m) => m.includes('pathCache')), 'an oversized legacy cache violates the bound');
    const legacy = load();
    assert.deepStrictEqual(keys(legacy), keys(st).slice(-ROUTE.cacheMax), 'loading trims a legacy cache oldest first');
    assert.deepStrictEqual(checkState(legacy), [], 'the bound holds immediately after loading a legacy save');
    // A failed reverse lookup must stay a counted search, rather than reversing a straight-walk fallback.
    st.pathCache.clear(); w.water.fill(1); w.water[0] = 0;
    assert.deepStrictEqual(route(st, 0, 15), [15]);
    const fallbacks = st.routeFallbacks, misses = VB.count.routeSearch;
    assert.deepStrictEqual(route(st, 15, 0), [0]);
    assert.strictEqual(st.routeFallbacks, fallbacks + 1);
    assert.strictEqual(VB.count.routeSearch, misses + 1);
  } finally { ROUTE.cacheMax = savedMax; }
}
if (failed) process.exit(1);
console.log('routes ok');
