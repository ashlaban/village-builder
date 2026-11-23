// A field's site by its estimated yield (VB-1494; Kim, 23 Nov: no rule mandates the order of land use): the head takes the tile whose
// score (sim/fieldplans siteScore: grain a year for the hours a year it costs) is higher, whatever its ground.
const VB = require('../src/load.js'), { B } = VB.gen;
const FieldPlans = VB['sim/fieldplans'], { byRiver } = VB['sim/crops'], { bfs } = VB['sim/hex'], { walkable } = VB['sim/walking'];
const { nextTo } = VB['sim/layout'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const rows = Array.from({ length: 14 }, () => '..........');
const st = tinyState(tinyWorld(rows), [{ at: [5, 7], farms: 1, sizes: [3] }], { seed: 5 }), w = st.w;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FIELD SITE FAIL:', m); } };
const f = st.farmsteads[0], own = new Set(f.fields.map((fd) => fd.tile));
const bySteps = new Map();
for (const [t, d] of bfs(w, f.house, 4, walkable(w)).dist) {
  w.trees[t] = 0;
  if (d >= 1 && FieldPlans.chooseTile(st, f, (x) => x === t) === t && !nextTo(w, t, own) && !byRiver(w, t) && !w.dev[t]) {
    if (!bySteps.has(d)) bySteps.set(d, []);
    bySteps.get(d).push(t);
  }
}
const set = (t, biome, stones) => { w.biome[t] = biome; w.stones[t] = stones; };
const pick = (a, b) => FieldPlans.chooseTile(st, f, (t) => t === a || t === b);
// a far stony meadow against a near clean hill tile
const near = (bySteps.get(1) || [])[0], far = (bySteps.get(4) || bySteps.get(3) || [])[0];
check(near !== undefined && far !== undefined, 'the constructed farm has candidates near and far');
if (near !== undefined && far !== undefined) {
  set(near, B.HILLS, 0);
  set(far, B.MEADOW, 255);
  const dFar = bfs(w, f.house, 4, walkable(w)).dist.get(far), dNear = bfs(w, f.house, 4, walkable(w)).dist.get(near);
  const sNear = FieldPlans.siteScore(st, near, dNear), sFar = FieldPlans.siteScore(st, far, dFar);
  console.log(`  near clean hills (${dNear} step): ${sNear.toFixed(3)}; far stony meadow (${dFar} steps): ${sFar.toFixed(3)}`);
  check(pick(near, far) === (sNear > sFar ? near : far), 'the head takes the tile whose score is higher');
  check(sFar > sNear, 'far stony meadow (1) outscores near clean hills (0.7) at these terms');
}
// equal distance and stones: meadow (1) beats hills (0.7), and marsh (0.5) loses to both
const two = [...bySteps.values()].find((ts) => ts.length >= 2);
check(two !== undefined, 'two candidates at the same distance');
if (two) {
  const [a, b] = two, d = bfs(w, f.house, 4, walkable(w)).dist.get(a);
  set(a, B.HILLS, 40);
  set(b, B.MEADOW, 40);
  const sa = FieldPlans.siteScore(st, a, d), sb = FieldPlans.siteScore(st, b, d);
  console.log(`  at ${d} steps, stones 40: meadow ${sb.toFixed(3)}, hills ${sa.toFixed(3)}`);
  check(pick(a, b) === b && sb > sa, 'meadow beats hills at equal distance and stones');
  // fresh ground (never farmed, SOIL.fresh) beats ground farmed before at SOIL.start, all else equal
  set(a, B.MEADOW, 40);
  w.dev[a] = 1;
  check(pick(a, b) === b && FieldPlans.siteScore(st, a, d) < FieldPlans.siteScore(st, b, d), 'fresh ground beats ground farmed before');
  w.dev[a] = 0;
}
if (failed) process.exit(1);
console.log('field-site ok');
