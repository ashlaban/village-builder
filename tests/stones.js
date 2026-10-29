// Stones on meadow tiles: seeding, hills fall-off, fields start clear.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('STONES FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
for (const seed of [7, 42]) {
  const w = world(seed), again = world(seed);
  check(Buffer.compare(Buffer.from(w.stones), Buffer.from(again.stones)) === 0, `seed ${seed}: stones differ between generations`);
  // steps to the nearest hills tile
  const dist = new Int16Array(w.N).fill(99), q = [];
  for (let i = 0; i < w.N; i++) if (w.biome[i] === G.B.HILLS) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) for (let d = 0; d < 6; d++) { const j = w.nb[q[h] * 6 + d]; if (j >= 0 && dist[j] > dist[q[h]] + 1) { dist[j] = dist[q[h]] + 1; q.push(j); } }
  const near = [], far = [];
  for (let i = 0; i < w.N; i++) {
    if (w.biome[i] !== G.B.MEADOW) { check(w.stones[i] === 0, `seed ${seed}: tile ${i} is not meadow but has stones`); continue; }
    check(w.stones[i] >= 30, `seed ${seed}: meadow tile ${i} has ${w.stones[i]} stones`);
    if (dist[i] === 1) near.push(w.stones[i]); else if (dist[i] > 2) far.push(w.stones[i]);
  }
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  check(near.length > 20 && far.length > 20 && avg(near) > avg(far) + 40, `seed ${seed}: next to hills ${avg(near).toFixed(0)} vs far ${avg(far).toFixed(0)}`);
  for (const scenario of ['founders', 'heirs']) {
    const st = Sim.seed(world(seed), seed, scenario);
    for (const f of st.farmsteads) for (const fd of f.fields) check(st.w.stones[fd.tile] === 0, `seed ${seed} ${scenario}: field tile ${fd.tile} has stones`);
  }
}
if (failed) process.exit(1);
console.log('stones ok');
