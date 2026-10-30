// Routes: cache keys never collide on a Large map, far targets are found, and the search takes the cheapest way by terrain (VB-096).
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
if (failed) process.exit(1);
console.log('routes ok');
