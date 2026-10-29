// Trees per forest tile: seeding, felling, regrowth over 30 years, clearing to meadow, and the drawing stages.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, F = VB['sim/forest'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TREES FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const w1 = world(7), w2 = world(7);

// seeding: deterministic, 60 (broadleaf) or 80 (pine) +-20% on forest tiles, 0 elsewhere
check(Buffer.compare(Buffer.from(w1.trees.buffer), Buffer.from(w2.trees.buffer)) === 0, 'trees differ between two generations of seed 7');
let forest = 0;
for (let i = 0; i < w1.N; i++) {
  const b = w1.biome[i], base = b === G.B.PINE ? 80 : b === G.B.FOREST ? 60 : 0;
  if (!base) { check(w1.trees[i] === 0 && w1.treesMax[i] === 0, `tile ${i} is not forest but has trees`); continue; }
  forest++;
  if (w1.treesMax[i] < base * 0.8 - 1 || w1.treesMax[i] > base * 1.2 + 1 || w1.trees[i] !== w1.treesMax[i]) check(false, `tile ${i} has ${w1.trees[i]} of ${w1.treesMax[i]}, base ${base}`);
}
check(forest > 100, 'too few forest tiles');

// felling and clearing
const st = Sim.seed(w1, 7, 'founders'), farm = st.farmsteads[0], lot = farm.woodlot, max = w1.treesMax[lot], YEAR_DAYS = Sim.YEAR_DAYS;
check(max > 0 && w1.trees[lot] === max, 'woodlot is not a full forest tile');
F.fellTree(st, farm);
check(w1.trees[lot] === max - 1 && st.regrow.has(lot), 'one trip did not fell exactly one tree');

// regrowth: linear, from a single tree to full in 30 years, daily; a half-felled tile is full after 15 years
const other = st.farmsteads.find((f) => f.woodlot !== lot);
w1.trees[lot] = 1; let day = 0;
const grow = (days) => { for (let k = 0; k < days; k++, day++) F.growTrees(st); };
grow(15 * YEAR_DAYS); check(Math.abs(w1.trees[lot] - (1 + max / 2)) < 0.01, `after 15 years: ${w1.trees[lot]} trees, expected ${1 + max / 2}`);
grow(15 * YEAR_DAYS); check(w1.trees[lot] === max && !st.regrow.has(lot), `after 30 years: ${w1.trees[lot]} of ${max}`);
check(st.treeDirty.has(lot), 'density stage changes were not reported to the page');

// clearing: at 0 trees the tile is meadow, never regrows, and the woodlot moves to the nearest forest
w1.trees[lot] = 1; st.regrow.add(lot); st.treeDirty.clear();
const sharing = st.farmsteads.filter((f) => f.woodlot === lot);
F.fellTree(st, farm);
check(w1.biome[lot] === G.B.MEADOW && w1.trees[lot] === 0 && w1.treesMax[lot] === 0, 'tile did not become meadow at 0 trees');
check(!st.regrow.has(lot) && st.biomeDirty.has(lot), 'cleared tile still regrows or was not reported');
for (const f of sharing) check(f.woodlot !== lot && (f.woodlot < 0 || w1.trees[f.woodlot] > 0), 'woodlot did not move to a wooded tile');
const before = w1.trees[lot]; grow(30 * YEAR_DAYS); check(w1.trees[lot] === before && w1.biome[lot] === G.B.MEADOW, 'cleared tile regrew');
if (other) check(other.woodlot !== lot || sharing.includes(other), 'unrelated farm lost its woodlot');

// drawing: fewer trees at lower stages; a cleared tile has none
const stage = (t) => { w1.trees[tile] = t; return G.treeStage(w1, tile); };
let tile = -1; for (let i = 0; i < w1.N && tile < 0; i++) if (w1.biome[i] === G.B.FOREST && w1.treesMax[i] === 60) tile = i;
const m = w1.treesMax[tile];
check([m, 0.76 * m, 0.51 * m, 0.26 * m, 0.1 * m, 0].map(stage).join() === '4,4,3,2,1,0', 'stage thresholds');
const lv = G.LV[0], cx = Math.floor(w1.hx[tile] / lv.size), cy = Math.floor(w1.hy[tile] / lv.size);
const drawn = (t) => {
  w1.trees[tile] = t; let n = 0;
  const ctx = new Proxy({}, { get: (o, k) => (k === 'drawImage' ? () => n++ : () => {}), set: () => true });
  const S = { broad: Array(10).fill(1), pine: Array(8).fill(1), shrub: Array(4).fill(1) };
  G.decorateChunk(w1, ctx, 0, cx, cy, S); return n;
};
const d4 = drawn(m), d2 = drawn(0.4 * m), d1 = drawn(0.1 * m);
check(d4 > d2 && d2 > d1, `tree sprites do not thin out: ${d4}, ${d2}, ${d1}`);
if (failed) process.exit(1);
console.log('trees ok');
