// Measure cold and warm A* cost compilation on a fixed mixed-terrain world; optionally load a baseline routes module.
// usage: node tools/route-costs.js [--base FILE]
// Reports timings (diagnostic), heap removals, tile/slope compilation, route checksum and cache-refresh work.
// The checksum and heap removals must match for a behaviour-preserving optimization. No baselines are rewritten.
require('./help.js')(__filename);
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const VB = require('../src/load.js'), { tinyWorld } = require('../tests/lib/tiny.js');
const base = process.argv.indexOf('--base');
if (base >= 0) vm.runInThisContext(fs.readFileSync(process.argv[base + 1], 'utf8'), { filename: process.argv[base + 1] });
const R = VB['sim/routes'], w = tinyWorld(Array(40).fill('.'.repeat(56)));
w.dev = new Uint8Array(w.N); w.worn = new Uint8Array(w.N);
let seed = 7;
const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < w.N; i++) {
  w.he[i] = 0.2 + 0.04 * Math.sin(i / 17) + 0.03 * Math.cos(i / 56);
  w.worn[i] = rand() % 4;
  if (rand() % 5 === 0) w.biome[i] = VB.gen.B.FOREST;
}
const pairs = Array.from({ length: 200 }, () => [rand() % w.N, rand() % w.N]);
function measure(repeats) {
  const hash = crypto.createHash('sha256');
  VB.resetCounts();
  const start = performance.now();
  for (let r = 0; r < repeats; r++) for (const [from, to] of pairs) {
    const path = R.findRoute(w, from, to, Infinity);
    if (!path) throw new Error('connected world has no route');
    hash.update(path.join(',') + ';');
  }
  return { searches: repeats * pairs.length, ms: +(performance.now() - start).toFixed(2),
    expanded: VB.count.routeExpand, compiledTiles: VB.count.routeCostTile, compiledSlopeEdges: VB.count.routeSlopeEdge,
    checksum: hash.digest('hex') };
}
const cold = measure(1), warm = Array.from({ length: 3 }, () => measure(1));
const st = { w, pathCache: new Map(), routeDirty: new Set(), routeFallbacks: 0 };
for (const [from, to] of pairs) R.route(st, from, to);
const tile = pairs[0][0]; w.worn[tile] = (w.worn[tile] + 1) % 4;
VB.resetCounts();
R.costChanged(st, tile);
const start = performance.now(); R.refreshRoutes(st);
const refresh = { ms: +(performance.now() - start).toFixed(2), tested: VB.count.routeRefresh, retained: st.pathCache.size };
console.log(JSON.stringify({ cold, warm, refresh }, null, 2));
