// Compiled costs: independent effort/time oracle, live terrain edits, cached relief and per-search work.
const assert = require('assert');
const VB = require('../src/load.js'), { tinyWorld } = require('./lib/tiny.js');
const R = VB['sim/routes'], { SLOPE } = VB['sim/rules'];
// Independent Dijkstra checks the preference minimum and the actual walking time accumulated along its route.
function reference(w, from, target) {
  const distance = Array(w.N).fill(Infinity), time = Array(w.N).fill(Infinity), done = new Set();
  distance[from] = time[from] = 0;
  for (;;) {
    let at = -1;
    for (let i = 0; i < w.N; i++) if (!done.has(i) && (at < 0 || distance[i] < distance[at] ||
      (distance[i] === distance[at] && time[i] < time[at]))) at = i;
    if (at < 0 || distance[at] === Infinity) return null;
    if (at === target) return { choice: distance[at], time: time[at] };
    done.add(at);
    for (let d = 0; d < 6; d++) {
      const next = w.nb[at * 6 + d];
      if (next < 0 || done.has(next) || (next !== target && !R.passable(w, next))) continue;
      if (next !== target && w.dev[next] === 3) continue;
      const score = distance[at] + R.stepCost(w, at, next, true), hours = time[at] + R.stepCost(w, at, next);
      if (score < distance[next] || (score === distance[next] && hours < time[next])) {
        distance[next] = score; time[next] = hours;
      }
    }
  }
}
const w = tinyWorld(Array(9).fill('.'.repeat(13)));
w.dev = new Uint8Array(w.N); w.worn = new Uint8Array(w.N);
const targets = [12, 52, 104, 116];
function compare(label) {
  const costs = R.reachCosts(w, 0, Infinity, targets);
  targets.forEach((to, k) => {
    const expected = reference(w, 0, to), path = R.findRoute(w, 0, to, Infinity);
    assert.strictEqual(path === null, expected === null, `${label}: reachability`);
    if (path) assert(Math.abs(R.routeCost(w, path, true) - expected.choice) < 1e-8, `${label}: A* effort cost`);
    if (expected === null) assert.strictEqual(costs[k], null);
    else assert(Math.abs(costs[k] - expected.time) < 1e-8, `${label}: physical reach cost`);
  });
}
compare('flat');
let state = 17;
for (let i = 0; i < w.N; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  w.he[i] = (state % 100) / 200;
  w.worn[i] = state % 4;
  if (i % 7 === 0) w.biome[i] = VB.gen.B.FOREST;
}
compare('rough');
VB.resetCounts();
R.findRoute(w, 0, 116, Infinity);
R.findRoute(w, 0, 116, Infinity);
assert.strictEqual(VB.count.routeSlopeEdge, 0, 'unchanged relief needs no slope recomputation');
assert(VB.count.routeCostTile > 0 && VB.count.routeCostTile <= w.N * 2, 'tile costs compile at most once per tile per search');
const edits = [
  () => { w.he[54] = 1; },
  () => { w.he = new Float32Array(w.N).fill(0.2); },
  () => { for (let i = 0; i < w.N; i += 5) w.worn[i] = 3; },
  () => { w.dev[52] = 3; w.dev[53] = 1; },
  () => { for (let i = 30; i < 37; i++) w.water[i] = 1; },
  () => { w.river = new Uint8Array(w.N); w.crossing = new Uint8Array(w.N); w.river[56] = 1; },
  () => { w.crossing[56] = 1; },
  () => { w.crossing[56] = 2; },
];
edits.forEach((edit, k) => { edit(); compare(`edit ${k}`); });
const grade = SLOPE.grade;
try { SLOPE.grade = 0; compare('slopes disabled'); }
finally { SLOPE.grade = grade; }
compare('slopes restored');
assert.deepStrictEqual(R.reachCosts(w, 0, 0, [0, 116]), [0, null], 'bounded query and zero-distance time');
assert.strictEqual(R.findRoute(w, 0, 116, 0), null, 'preference budget remains bounded');
assert(!Object.keys(w).some((key) => /walking|choice|slopes|costMark/.test(key)), 'compiler does not add saved world fields');
// Traffic itself does not dirty route caches: only a stage transition does.
const P = VB['sim/paths'], wearWorld = tinyWorld(['...']);
wearWorld.dev = new Uint8Array(wearWorld.N); P.initWear(wearWorld);
const wearState = { w: wearWorld, pathDirty: new Set(), routeDirty: new Set() };
const fade = () => P.fadeWear(wearState, (tile) => R.costChanged(wearState, tile));
P.tread(wearWorld, 1); fade();
assert.strictEqual(wearState.routeDirty.size, 0, 'a crossing without a stage change keeps cached routes');
P.tread(wearWorld, 1, 100); fade();
assert.deepStrictEqual([...wearState.routeDirty], [1], 'a new wear stage dirties its tile');
wearState.routeDirty.clear(); P.tread(wearWorld, 1); fade();
assert.strictEqual(wearState.routeDirty.size, 0, 'further crossings at the same stage do not dirty routes');
console.log('compiled routes ok: physical-cost oracle, terrain/relief/rule edits, hot slope reuse and bounded searches');
