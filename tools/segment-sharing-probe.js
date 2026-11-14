// Research only: measure cached-route overlap and exact segment shortcuts on generated populous villages.
// usage: node tools/segment-sharing-probe.js [--map tiny|small|medium|large] [--seeds 7,42] [--years 2] [--queries 100]
// Records actual cache misses during play, then replays uncached OD pairs on the final frozen world. No simulation routing is replaced.
// Compares a common precompiled-grid A* with the same A* plus legal segment shortcuts; both retain all off-road grid edges.
// Timing excludes simulation, cost compilation and graph construction (reported separately). This is not an end-to-end speed claim.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
const opt = (key, fallback) => { const i = args.indexOf('--' + key); return i < 0 ? fallback : args[i + 1]; };
const map = opt('map', 'tiny'), sizes = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }, years = +opt('years', 2), limit = +opt('queries', 100);
const seeds = opt('seeds', '7,42').split(',').map(Number);
if (!sizes[map] || !(years >= 0) || !(limit > 0) || seeds.some(s => !Number.isInteger(s))) throw new Error('bad arguments');
let profile = null;
for (const file of JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'))) {
  require(path.join(root, 'src', file));
  if (file === 'sim/routes.js') {
    const r = globalThis.VB['sim/routes'], route = r.route, changed = r.costChanged;
    r.route = (st, from, to) => {
      const searches = globalThis.VB.count.routeSearch, started = performance.now(), result = route(st, from, to), elapsed = performance.now() - started;
      if (profile && profile.st === st) {
        profile.routeMs += elapsed;
        profile.calls++;
        if (globalThis.VB.count.routeSearch > searches) {
          profile.misses++;
          if (result.length > 1 && result[0] === from) {
            const key = from * st.w.N + to;
            profile.pairs.set(key, (profile.pairs.get(key) || 0) + 1);
          }
        }
      }
      return result;
    };
    r.costChanged = (st, tile) => { if (profile && profile.st === st) profile.dirty.add(tile); return changed(st, tile); };
    for (const name of ['findRoute', 'reachCosts', 'refreshRoutes', 'refreshHoursStep']) {
      const original = r[name];
      r[name] = (...args) => {
        const start = performance.now(), value = original(...args), elapsed = performance.now() - start;
        if (profile) profile.otherRoutingMs[name] += elapsed;
        return value;
      };
    }
  }
}
const VB = globalThis.VB, R = VB['sim/routes'], { hexSteps } = VB['sim/hex'], { ROUTE } = VB['sim/rules'];
const edgeKey = (n, a, b) => Math.min(a, b) * n + Math.max(a, b);
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
function analyse(st) {
  const w = st.w, n = w.N, through = i => R.tileCost(w, i) < Infinity;
  const paths = [], edges = new Map(), adjacency = new Map(), endpoints = new Set();
  let tileIds = 0, traversals = 0, skipped = 0;
  for (const [key, p] of st.pathCache) {
    const from = Math.floor(key / n);
    if (p.length < 2 || p[0] !== from || p.slice(1, -1).some(t => !through(t))) { skipped++; continue; }
    paths.push(p); tileIds += p.length;
    endpoints.add(p[0]); endpoints.add(p[p.length - 1]);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], k = edgeKey(n, a, b); traversals++;
      if (edges.has(k)) edges.get(k).uses++;
      else {
        edges.set(k, { a, b, uses: 1 });
        if (!adjacency.has(a)) adjacency.set(a, []); if (!adjacency.has(b)) adjacency.set(b, []);
        adjacency.get(a).push(b); adjacency.get(b).push(a);
      }
    }
  }
  // Closed tiles (houses) must remain terminals, even if two cached routes meet there: a shortcut must not cross a building.
  const nodes = new Set([...adjacency].filter(([i, neighbours]) => neighbours.length !== 2 || !through(i)).map(([i]) => i));
  const seen = new Set(), segments = [], edgeIndex = new Map();
  function chain(start, next) {
    const tiles = [start, next]; seen.add(edgeKey(n, start, next));
    while (!nodes.has(next)) {
      const neighbours = adjacency.get(next), previous = tiles[tiles.length - 2], following = neighbours[0] === previous ? neighbours[1] : neighbours[0];
      if (seen.has(edgeKey(n, next, following))) break;
      tiles.push(following); seen.add(edgeKey(n, next, following)); next = following;
    }
    const id = segments.length; segments.push(tiles);
    for (let j = 1; j < tiles.length; j++) edgeIndex.set(edgeKey(n, tiles[j - 1], tiles[j]), { id, offset: j - 1 });
  }
  const started = performance.now();
  for (const node of nodes) for (const next of adjacency.get(node)) if (!seen.has(edgeKey(n, node, next))) chain(node, next);
  // A degree-two cycle gets one explicit junction and a loop segment.
  for (const { a, b } of edges.values()) if (!seen.has(edgeKey(n, a, b))) { nodes.add(a); chain(a, b); }
  assert.strictEqual(seen.size, edges.size);
  let handles = 0;
  const tileSegments = new Map();
  for (let id = 0; id < segments.length; id++) for (const tile of segments[id]) {
    if (!tileSegments.has(tile)) tileSegments.set(tile, new Set()); tileSegments.get(tile).add(id);
  }
  for (const p of paths) {
    let last = null;
    for (let j = 1; j < p.length; j++) {
      const hit = edgeIndex.get(edgeKey(n, p[j - 1], p[j]));
      const tiles = segments[hit.id], direction = tiles[hit.offset] === p[j - 1] ? 1 : -1;
      const start = direction === 1 ? hit.offset : hit.offset + 1, end = start + direction;
      if (!last || last.id !== hit.id || last.end !== start || last.direction !== direction) handles++;
      last = { id: hit.id, end, direction };
    }
  }
  const maintenance = profile.days.map(tiles => {
    const touched = new Set(); for (const tile of tiles) for (const id of tileSegments.get(tile) || []) touched.add(id);
    return touched.size;
  });
  // Alternative: intern only repeated complete eight-tile chunks, even across graph junctions. Short paths remain flat.
  const candidates = new Map(), keyOf = tiles => { const a = tiles.join(','), b = [...tiles].reverse().join(','); return a < b ? a : b; };
  for (const p of paths) for (let i = 0; i + 8 <= p.length; i++) {
    const key = keyOf(p.slice(i, i + 8)); candidates.set(key, (candidates.get(key) || 0) + 1);
  }
  let allowed = new Set([...candidates].filter(([, count]) => count >= 3).map(([key]) => key)), tokens, chunkUses, passes = 0;
  for (;;) {
    tokens = 0; chunkUses = new Map(); passes++;
    for (const p of paths) for (let i = 0; i < p.length;) {
      const key = i + 8 <= p.length ? keyOf(p.slice(i, i + 8)) : null;
      tokens++;
      if (allowed.has(key)) { chunkUses.set(key, (chunkUses.get(key) || 0) + 1); i += 8; } else i++;
    }
    const keep = new Set([...chunkUses].filter(([, count]) => count >= 3).map(([key]) => key));
    if (keep.size === allowed.size) break;
    allowed = keep;
  }
  // Trie payload estimate includes tile+parent per node and one leaf reference per route, excluding map/index overhead.
  const trieNodes = reverse => {
    const roots = new Map(); let count = 0;
    for (const p of paths) {
      let node = roots;
      for (const tile of reverse ? [...p].reverse() : p) {
        if (!node.has(tile)) { node.set(tile, new Map()); count++; } node = node.get(tile);
      }
    }
    return count;
  };
  const prefixNodes = trieNodes(false), suffixNodes = trieNodes(true);
  let reverseDuplicatePairs = 0, reverseDuplicateTileIds = 0;
  for (const p of paths) {
    const a = p[0], b = p[p.length - 1];
    if (a < b) { const back = st.pathCache.get(b * n + a); if (back && back.length === p.length && back.every((x, i) => x === p[p.length - 1 - i])) { reverseDuplicatePairs++; reverseDuplicateTileIds += p.length; } }
  }
  const graphMs = performance.now() - started, poolTileIds = segments.reduce((sum, s) => sum + s.length, 0);
  return { paths, segments, adjacency, nodes, metrics: {
    cachedRoutes: st.pathCache.size, usableRoutes: paths.length, skipped, storedTileIds: tileIds,
    distinctEdges: edges.size, edgeTraversalsStored: traversals, edgeReuse: edges.size ? traversals / edges.size : 0,
    sharedEdgeTraversalFraction: traversals ? [...edges.values()].filter(e => e.uses > 1).reduce((sum, e) => sum + e.uses, 0) / traversals : 0,
    graphVertices: adjacency.size, junctions: nodes.size, segments: segments.length,
    medianRouteTiles: median(paths.map(p => p.length)), maxRouteTiles: Math.max(0, ...paths.map(p => p.length)),
    reverseDuplicatePairs, reverseDuplicateTileIds, prefixTrieNumericBytes: prefixNodes * 8 + paths.length * 4,
    suffixTrieNumericBytes: suffixNodes * 8 + paths.length * 4,
    repeatedEightTileChunks: allowed.size, chunkOccurrences: [...chunkUses.values()].reduce((a, b) => a + b, 0),
    selectiveChunkNumericBytes: tokens * 4 + allowed.size * 64, chunkSelectionPasses: passes,
    medianSegmentSteps: median(segments.map(s => s.length - 1)), maxSegmentSteps: Math.max(0, ...segments.map(s => s.length - 1)),
    shortcutSegments: segments.filter(s => s.length >= 4).length, handles, poolTileIds,
    flatUint32PayloadBytes: tileIds * 4,
    sharedNumericPayloadBytes: poolTileIds * 4 + handles * 12 + segments.length * 32,
    medianSegmentsTouchedPerDay: median(maintenance), maxSegmentsTouchedPerDay: Math.max(0, ...maintenance), graphMs,
  } };
}
// A shared control/experimental search implementation. All grid edges are always available; legal shortcut costs are their sums.
function compile(w, graph) {
  const started = performance.now(), time = new Float64Array(w.N * 6), choice = new Float64Array(w.N * 6), through = new Uint8Array(w.N);
  for (let i = 0; i < w.N; i++) {
    through[i] = R.tileCost(w, i) < Infinity;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d]; if (j < 0) continue;
      time[i * 6 + d] = R.stepCost(w, i, j); choice[i * 6 + d] = R.stepCost(w, i, j, true);
    }
  }
  const extra = new Map();
  for (const tiles of graph.segments) if (tiles.length >= 4) {
    let t = 0, c = 0;
    for (let k = 1; k < tiles.length; k++) { t += R.stepCost(w, tiles[k - 1], tiles[k]); c += R.stepCost(w, tiles[k - 1], tiles[k], true); }
    const a = tiles[0], b = tiles[tiles.length - 1];
    if (!extra.has(a)) extra.set(a, []); if (!extra.has(b)) extra.set(b, []);
    extra.get(a).push({ to: b, time: t, cost: c }); extra.get(b).push({ to: a, time: t, cost: c });
  }
  return { time, choice, through, extra, compileMs: performance.now() - started };
}
function search(w, costs, from, to, shortcuts) {
  const g = new Float64Array(w.N).fill(Infinity), t = new Float64Array(w.N).fill(Infinity), closed = new Uint8Array(w.N), heap = [];
  const lower = i => hexSteps(w, i, to) * ROUTE.minStep;
  const less = (a, b) => a.f < b.f || (a.f === b.f && (a.ft < b.ft || (a.ft === b.ft && a.at < b.at)));
  function push(value) {
    let i = heap.push(value) - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!less(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; }
  }
  function pop() {
    const first = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0; for (;;) {
      const l = i * 2 + 1, r = l + 1; let k = i;
      if (l < heap.length && less(heap[l], heap[k])) k = l;
      if (r < heap.length && less(heap[r], heap[k])) k = r;
      if (k === i) break; [heap[i], heap[k]] = [heap[k], heap[i]]; i = k;
    } }
    return first;
  }
  g[from] = t[from] = 0; push({ at: from, f: lower(from), ft: lower(from), g: 0, t: 0 });
  let expanded = 0, relaxed = 0, jumped = 0;
  while (heap.length) {
    const q = pop(), i = q.at;
    if (closed[i] || q.g !== g[i] || q.t !== t[i]) continue;
    closed[i] = 1; expanded++;
    if (i === to) return { cost: g[i], time: t[i], expanded, relaxed, jumped };
    const offer = (j, c, time) => {
      if (j < 0 || closed[j] || (j !== to && !costs.through[j])) return;
      relaxed++;
      const next = g[i] + c, nt = t[i] + time;
      if (next > g[j] || (next === g[j] && nt >= t[j])) return;
      g[j] = next; t[j] = nt; push({ at: j, f: next + lower(j), ft: nt + lower(j), g: next, t: nt });
    };
    for (let d = 0; d < 6; d++) offer(w.nb[i * 6 + d], costs.choice[i * 6 + d], costs.time[i * 6 + d]);
    if (shortcuts) for (const edge of costs.extra.get(i) || []) { jumped++; offer(edge.to, edge.cost, edge.time); }
  }
  return null;
}
const result = [];
for (const seed of seeds) {
  const it = VB.gen.generate(seed, { cols: sizes[map][0], rows: sizes[map][1] }); let next; while (!(next = it.next()).done) {}
  const st = VB.sim.seed(next.value, seed, 'populous');
  profile = { st, calls: 0, misses: 0, pairs: new Map(), dirty: new Set(), days: [], routeMs: 0,
    otherRoutingMs: { findRoute: 0, reachCosts: 0, refreshRoutes: 0, refreshHoursStep: 0 } };
  const simStart = performance.now();
  for (let d = 0; d < years * VB.sim.YEAR_DAYS; d++) { VB.sim.advance(st, VB.sim.DAY); profile.days.push(profile.dirty); profile.dirty = new Set(); }
  const simMs = performance.now() - simStart;
  const routing = { simulationMs: simMs, routeMs: profile.routeMs, otherRoutingMs: { ...profile.otherRoutingMs },
    percent: (profile.routeMs + Object.values(profile.otherRoutingMs).reduce((a, b) => a + b, 0)) * 100 / (simMs || 1) };
  const graph = analyse(st), compiled = compile(st.w, graph), pairs = [];
  const destination = new Map();
  for (const [key, count] of profile.pairs) {
    const a = Math.floor(key / st.w.N), b = key % st.w.N;
    destination.set(b, (destination.get(b) || 0) + count);
    const forward = st.pathCache.get(key), backward = st.pathCache.get(b * st.w.N + a);
    if (pairs.length < limit && !(forward && forward[0] === a) && !(backward && backward[0] === b)) pairs.push([a, b]);
  }
  // No cache misses on a zero-year run: report cache-pair replay explicitly instead.
  const source = pairs.length ? 'historical miss OD pairs absent from final cache' : 'cached pairs (no absent historical miss pairs)';
  if (!pairs.length) for (const p of graph.paths.slice(0, limit)) pairs.push([p[0], p[p.length - 1]]);
  let compared = 0, expandedGrid = 0, expandedShared = 0, relaxGrid = 0, relaxShared = 0, jumps = 0, timeTieDifferences = 0;
  const gridTimes = [], sharedTimes = [];
  for (let repetition = 0; repetition < 7; repetition++) {
    let control, shared, gridMs, sharedMs;
    const measure = shortcuts => { const start = performance.now(); const values = pairs.map(([a, b]) => search(st.w, compiled, a, b, shortcuts)); return { values, ms: performance.now() - start }; };
    if (repetition % 2 === 0) {
      const a = measure(false), b = measure(true); control = a.values; shared = b.values; gridMs = a.ms; sharedMs = b.ms;
    } else {
      const b = measure(true), a = measure(false); control = a.values; shared = b.values; gridMs = a.ms; sharedMs = b.ms;
    }
    if (repetition) { gridTimes.push(gridMs); sharedTimes.push(sharedMs); }
    if (repetition === 0) pairs.forEach(([a, b], k) => {
      const x = control[k], y = shared[k], native = R.findRoute(st.w, a, b, Infinity);
      assert.strictEqual(!!x, !!y); assert.strictEqual(!!x, !!native);
      if (!x) return;
      assert(Math.abs(x.cost - y.cost) < 1e-8, 'segment shortcut changed optimal preference cost');
      assert(Math.abs(x.cost - R.routeCost(st.w, native, true)) < 1e-8, 'control differs from native route choice');
      if (Math.abs(x.time - y.time) > 1e-8) timeTieDifferences++;
      compared++; expandedGrid += x.expanded; expandedShared += y.expanded; relaxGrid += x.relaxed; relaxShared += y.relaxed; jumps += y.jumped;
    });
  }
  const destCounts = [...destination.values()].sort((a, b) => b - a), totalMisses = destCounts.reduce((a, b) => a + b, 0);
  result.push({ seed, map, years, population: st.pawns.filter(p => p.alive).length, routeCalls: profile.calls, routeMisses: profile.misses,
    top4DestinationMissFraction: destCounts.slice(0, 4).reduce((a, b) => a + b, 0) / (totalMisses || 1),
    routing, graph: graph.metrics, experiment: { source, attempted: pairs.length, compared, expandedGrid, expandedShared, relaxGrid, relaxShared,
      shortcutEdgesConsidered: jumps, timeTieDifferences, precompileMs: compiled.compileMs,
      gridMedianMs: median(gridTimes), sharedMedianMs: median(sharedTimes), gridTimes, sharedTimes } });
  profile = null;
}
console.log(JSON.stringify({ researchOnly: true, result }, null, 2));
