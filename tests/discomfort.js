// @suite fast
// Discomfort steers the route search (VB-448; design.md, Worn paths, 4): with the weight on, a walker goes round to a bridge up to
// twice the time of wading a ford and no further, a laden walker and a cart mind bad footing more, and the walk takes its time alone;
// with the weight 0 (as it lands) every route is the quickest and every load class shares one cache entry.
const VB = require('../src/load.js'),
  { B } = VB['world/biomes'],
  { findRoute, routeCost, route } = VB['sim/routes'],
  { DISCOMFORT, choiceCost } = VB['sim/walking'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('DISCOMFORT FAIL:', m);
  }
};
const grid = (COLS, ROWS) => {
  const N = COLS * ROWS,
    nb = new Int32Array(N * 6).fill(-1);
  for (let i = 0; i < N; i++) {
    const c = i % COLS,
      r = (i / COLS) | 0,
      o = r & 1 ? 1 : 0;
    const cand = [[c - 1, r], [c + 1, r], [c - 1 + o, r - 1], [c + o, r - 1], [c - 1 + o, r + 1], [c + o, r + 1]];
    cand.forEach(([x, y], k) => {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) nb[i * 6 + k] = y * COLS + x;
    });
  }
  return {
    N,
    COLS,
    nb,
    water: new Uint8Array(N),
    biome: new Uint8Array(N).fill(B.MEADOW),
    river: new Uint8Array(N),
    crossing: new Uint8Array(N),
  };
};
const weight0 = DISCOMFORT.weight;
try {
  // A river down column 20, closed but at a ford on row 4 and a bridge d rows further down; the walk is from bank to bank at the ford.
  const COLS = 41,
    ROWS = 40,
    at = (c, r) => r * COLS + c,
    from = at(19, 4),
    to = at(21, 4);
  let bridged = 0,
    forded = 0;
  for (let d = 1; d <= 30; d++) {
    const w = grid(COLS, ROWS);
    for (let r = 0; r < ROWS; r++) w.river[at(20, r)] = 1;
    w.crossing[at(20, 4)] = 1;
    w.crossing[at(20, 4 + d)] = 2;
    DISCOMFORT.weight = 0;
    const quick = findRoute(w, from, to),
      wade = routeCost(w, quick);
    check(quick.includes(at(20, 4)), `d ${d}: at weight 0 the ford is taken, the quickest`);
    w.crossing[at(20, 4)] = 0;
    const round = routeCost(w, findRoute(w, from, to)),
      ratio = round / wade;
    w.crossing[at(20, 4)] = 1;
    DISCOMFORT.weight = 1;
    const p = findRoute(w, from, to),
      byBridge = p.includes(at(20, 4 + d));
    if (ratio <= 1.9) check(byBridge, `d ${d}: the way round takes ${ratio.toFixed(2)} times the wading, and the bridge is taken`);
    if (ratio >= 2.1) check(!byBridge, `d ${d}: the way round takes ${ratio.toFixed(2)} times the wading, and the ford is taken`);
    if (byBridge) bridged++;
    else forded++;
    check(Math.abs(routeCost(w, p) - (byBridge ? round : wade)) < 1e-9, `d ${d}: the walk takes the time of the route taken`);
  }
  check(bridged > 0 && forded > 0, `near bridges are taken, far ones are not (${bridged} and ${forded})`);

  // A wood of broadleaf forest five tiles thick down columns 20 to 24, with a meadow gap d rows down: the nearer the gap, the sooner a
  // walker goes round by it; an unladen walker goes through the wood where a laden one goes round sooner, and a cart sooner still. At
  // weight 0 the three take the same, quickest way.
  const first = [Infinity, Infinity, Infinity];
  for (let d = 1; d <= 25; d++) {
    const w = grid(COLS, ROWS),
      a = at(17, 4),
      b = at(26, 4),
      wooded = (p) => p.some((t) => w.biome[t] === B.FOREST);
    for (let r = 0; r < ROWS; r++) if (r !== 4 + d) for (let c = 20; c < 25; c++) w.biome[at(c, r)] = B.FOREST;
    DISCOMFORT.weight = 0;
    const quick = wooded(findRoute(w, a, b));
    for (let cls = 0; cls < 3; cls++) {
      DISCOMFORT.weight = 0;
      check(wooded(findRoute(w, a, b, undefined, cls)) === quick, `d ${d}: at weight 0 the load class changes nothing`);
      DISCOMFORT.weight = 1;
      if (wooded(findRoute(w, a, b, undefined, cls)) && first[cls] === Infinity) first[cls] = d;
    }
  }
  check(first[0] <= first[1] && first[1] <= first[2] && first[0] < first[2],
    `the farther the gap a walker still goes round by, the heavier its load (gaps from ${first.join(', ')} rows away are passed by)`);
  {
    const w = grid(COLS, ROWS);
    w.biome[at(5, 5)] = B.FOREST;
    DISCOMFORT.weight = 1;
    const c = [0, 1, 2].map((cls) => choiceCost(w, at(4, 5), at(5, 5), cls));
    check(c[0] < c[1] && c[1] < c[2], `a step into the wood is minded more with each load class (${c.map((x) => x.toFixed(2))})`);
  }

  // The cache: one entry for every class at weight 0; an entry a class while the weight is on.
  {
    const w = grid(COLS, ROWS),
      st = { w, pathCache: new Map(), routeFallbacks: 0, routeDirty: new Set() };
    DISCOMFORT.weight = 0;
    route(st, at(2, 2), at(30, 30), 0);
    route(st, at(2, 2), at(30, 30), 2);
    check(st.pathCache.size === 1, 'at weight 0 the classes share one cache entry');
    DISCOMFORT.weight = 1;
    route(st, at(2, 2), at(30, 30), 2);
    route(st, at(30, 30), at(2, 2), 2);
    check(st.pathCache.size === 3, 'with the weight on a cart has its own entry, and its way back is read from it');
  }
} finally {
  DISCOMFORT.weight = weight0;
}
if (failed) process.exit(1);
console.log('discomfort: ok (a bridge up to twice the time, the load classes, the cache by class)');
