// VB-1563: a route set aside at the day's emptying and taken back is the route a search finds then. On a constructed grid of mixed
// ground, tiles change cost day after day (ground and wear), the cache is emptied each day, and every route taken back from the routes
// set aside is held equal to a fresh search on the ground as it stands; some are taken back, some refused, and hasRoute takes them too.
const assert = require('assert');
const VB = require('../src/load.js'), { B } = VB['world/biomes'];
const { route, hasRoute, findRoute, refreshRoutes, costChanged, ROUTE } = VB['sim/routes'];
const COLS = 60, ROWS = 50, N = COLS * ROWS, nb = new Int32Array(N * 6).fill(-1);
for (let i = 0; i < N; i++) {
  const c = i % COLS, r = (i / COLS) | 0, o = r & 1 ? 1 : 0;
  const cand = [[c - 1, r], [c + 1, r], [c - 1 + o, r - 1], [c + o, r - 1], [c - 1 + o, r + 1], [c + o, r + 1]];
  cand.forEach(([x, y], k) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) nb[i * 6 + k] = y * COLS + x; });
}
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const KINDS = [B.MEADOW, B.MEADOW, B.HEATH, B.FOREST, B.PINE];
const hx = new Float64Array(N), hy = new Float64Array(N);
for (let i = 0; i < N; i++) { hx[i] = (i % COLS) + 0.5 * (((i / COLS) | 0) & 1); hy[i] = ((i / COLS) | 0) * 0.866; }
const w = { N, COLS, ROWS, nb, hx, hy, HW: 1, water: new Uint8Array(N), worn: new Uint8Array(N),
  biome: Uint8Array.from({ length: N }, () => KINDS[(rnd() * KINDS.length) | 0]) };
for (let i = 0; i < 60; i++) w.water[(rnd() * N) | 0] = 1; // a few ponds to go round
const st = { w, pathCache: new Map(), routeFallbacks: 0, routeDirty: new Set() };
// A pool of pairs walked day after day (a door and its fields), most of them short, a few across the grid.
const pick = () => { let t; do t = (rnd() * N) | 0; while (w.water[t]); return t; };
const pairs = [];
for (let i = 0; i < 80; i++) {
  const a = pick();
  let b = a;
  for (let s = 0, n = i % 10 ? 4 + ((rnd() * 8) | 0) : 40; s < n; s++) { const j = nb[b * 6 + ((rnd() * 6) | 0)]; if (j >= 0 && !w.water[j]) b = j; }
  if (b !== a) pairs.push([a, b]);
}
let taken = 0, asked = 0;
for (let day = 0; day < 40; day++) {
  for (let q = 0; q < 60; q++) {
    const [a, b] = pairs[(rnd() * pairs.length) | 0], searches = VB.count.routeSearch;
    const aside = !st.pathCache.has(a * N + b) && !st.pathCache.has(b * N + a) && !!st.routeKept?.routes.has(a * N + b);
    const p = q % 7 === 0 ? (hasRoute(st, a, b), st.pathCache.get(a * N + b) || st.pathCache.get(b * N + a).slice().reverse()) : route(st, a, b);
    asked++;
    if (aside && VB.count.routeSearch === searches) {
      taken++;
      assert.deepStrictEqual(p, findRoute(w, a, b), `day ${day}: a route taken back (${a} to ${b}) is the route a search finds`);
    }
    if (q === 30) for (let k = 0; k < 2; k++) { const t = pick(); w.worn[t] = (w.worn[t] + 1) % 4; costChanged(st, t); } // a change mid-day
  }
  for (let k = 0; k < 1 + ((rnd() * 4) | 0); k++) { // the day's changes: a wood felled or grown, a way worn
    const t = pick();
    if (rnd() < 0.5) w.biome[t] = KINDS[(rnd() * KINDS.length) | 0]; else w.worn[t] = (w.worn[t] + 1) % 4;
    costChanged(st, t);
  }
  refreshRoutes(st);
  assert.strictEqual(st.pathCache.size, 0, 'the cache is emptied each day a tile changed');
  assert.ok(st.routeKept.routes.size <= ROUTE.cacheMax && st.routeKept.log.length <= ROUTE.keepDays, 'what is set aside is bounded');
}
assert.ok(taken > asked / 10, `routes are taken back (${taken} of ${asked})`);
assert.ok(VB.count.routeSearch > 0, 'and routes touched are searched again');
// Derived, not saved: a save leaves out what is set aside and the costs (sim/saves DERIVED).
const { DERIVED } = VB['sim/saves'];
assert.ok('routeKept' in DERIVED && 'routeCosts' in DERIVED, 'the routes set aside are derived state');
console.log(`routekeep: ok (${taken} of ${asked} routes taken back, each the route a search finds)`);
