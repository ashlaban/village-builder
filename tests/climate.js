// Climate at generation (VB-342): the seed's wind, erosion, rain carried by the wind and moisture dealt out by it (src/gen/climate.js).
// The rules on small made-up grids: rain falls on the side of a ridge that faces the wind and little behind it; erosion lowers land, never
// moves the coast and never raises a cell above its neighbours' reach; moisture hands the old values out again in the order of wetness.
// On generated worlds: the same seed gives the same wind, rain, moisture and biomes; the wet land is the moist land.
const VB = require('../src/load.js'), G = VB.gen, C = VB['gen/climate'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('CLIMATE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const same = (a, b) => Buffer.compare(Buffer.from(a.buffer), Buffer.from(b.buffer)) === 0;
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

// 1. A ridge across the wind: an island from x = 20 to 60, its crest at 40, sea around it.
const CW = 81, CH = 24, ridge = new Float32Array(CW * CH);
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) ridge[y * CW + x] = x < 20 || x > 60 || y < 2 || y > CH - 3 ? -0.2 : 0.05 + 0.6 * (1 - Math.abs(x - 40) / 20);
const side = (rain, x0, x1) => { const v = []; for (let y = 6; y < CH - 6; y++) for (let x = x0; x < x1; x++) v.push(rain[y * CW + x]); return mean(v); };
const east = C.rainfall(ridge, CW, CH, [1, 0]), west = C.rainfall(ridge, CW, CH, [-1, 0]);
check(side(east, 22, 38) > 2 * side(east, 43, 59), `wind to the east: the west slope gets ${side(east, 22, 38).toFixed(4)}, the east ${side(east, 43, 59).toFixed(4)}`);
check(side(west, 43, 59) > 2 * side(west, 22, 38), 'wind to the west: the east slope is the wet one');
check(Math.abs(side(east, 22, 38) - side(west, 43, 59)) < 1e-6, 'the two winds mirror each other');
for (const dir of [[0.6, 0.8], [-0.8, 0.6], [0, -1], [0.7071, -0.7071]]) {
  const r = C.rainfall(ridge, CW, CH, dir);
  check(r.every((v) => v >= 0 && Number.isFinite(v)) && r.some((v) => v > 0), `rain is finite and falls for the wind ${dir}`);
}

// 2. Erosion: a cone with a notch. The coast stays, nothing rises above the peak, the land loses height, and it is the same every time.
const cone = () => { const z = new Float32Array(60 * 60); for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
  const d = Math.hypot(x - 30, y - 30); z[y * 60 + x] = d > 24 ? -0.1 : 0.02 + 0.8 * (1 - d / 24) + 0.03 * Math.sin(x * 1.7) * Math.cos(y * 1.3); } return z; };
const before = cone(), after = cone(), again = cone(); C.erode(after, 60, 60); C.erode(again, 60, 60);
check(before.every((v, k) => (v > 0) === (after[k] > 0)), 'erosion moves the coast');
check(Math.max(...after) <= Math.max(...before) && mean(Array.from(after).filter((v) => v > 0)) < mean(Array.from(before).filter((v) => v > 0)), 'erosion does not lower the land');
check(same(after, again), 'erosion differs between runs');
const dr = C.drainage(after, 60, 60); let climbs = 0;
for (const k of dr.order) if (dr.down[k] < 0) climbs++;
check(dr.order.length === after.filter((v) => v > 0).length && !climbs, 'not every land cell drains to water');

// 2b. Lakes: a low bowl with no way out ponds; the same bowl high in the hills, and a hollow of a few cells, stay land; the sea is not touched.
{ const bowl = (base, r) => { const z = new Float32Array(60 * 60); for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
    const d = Math.hypot(x - 30, y - 30); z[y * 60 + x] = d > 26 ? -0.1 : d < r ? base - 0.05 * (1 - d / r) : base + 0.02 + 0.001 * (26 - d); } return z; };
  const low = bowl(0.06, 8), high = bowl(0.4, 8), small = bowl(0.06, 2), seaBefore = low.filter((v) => v <= 0).length;
  const made = C.pond(low, 60, 60);
  check(made > 100 && low[30 * 60 + 30] < 0 && low[30 * 60 + 45] > 0, `a low bowl ponds (${made} cells), its rim stays land`);
  check(low.filter((v) => v <= 0).length === seaBefore + made, 'ponding touches the sea');
  check(C.pond(high, 60, 60) === 0, 'a bowl high in the hills is made a lake');
  check(C.pond(small, 60, 60) === 0, 'a hollow of a few cells is made a lake'); }

// 3. Moisture: the old values, in the order of wetness.
{ const tiles = [4, 1, 7, 2], wet = [0, 0.9, 0.1, 0, 0.5, 0, 0, 0.5], was = Float32Array.from([0, 0.2, 0.8, 0, 0.6, 0, 0, 0.4]), hm = Float32Array.from(was);
  C.moisture(tiles, wet, was, hm);
  check(Math.abs(hm[2] - 0.2) < 1e-6 && Math.abs(hm[4] - 0.4) < 1e-6 && Math.abs(hm[7] - 0.6) < 1e-6 && Math.abs(hm[1] - 0.8) < 1e-6, `moisture by wetness: ${Array.from(hm).join(' ')}`);
  check(hm[0] === 0 && hm[3] === 0, 'moisture is written off the listed tiles'); }

// 4. Generated worlds.
const winds = [];
for (const seed of [3, 7, 42]) {
  const w = world(seed), w2 = world(seed);
  check(w.wind[0] === w2.wind[0] && w.wind[1] === w2.wind[1] && same(w.rain, w2.rain) && same(w.hm, w2.hm) && same(w.biome, w2.biome) && same(w.elev, w2.elev),
    `seed ${seed}: the climate differs between generations`);
  check(Math.abs(Math.hypot(w.wind[0], w.wind[1]) - 1) < 1e-9, `seed ${seed}: the wind is not a unit vector`);
  winds.push(Math.atan2(w.wind[1], w.wind[0]));
  const land = []; let off = 0;
  for (let i = 0; i < w.N; i++) { if (!(w.rain[i] >= 0 && w.rain[i] <= 1) || (w.water[i] && w.rain[i] !== 0)) off++; if (!w.water[i]) land.push(i); }
  check(!off, `seed ${seed}: ${off} tiles with rain out of 0..1, or on water`);
  land.sort((a, b) => w.rain[a] - w.rain[b]);
  const q = land.length >> 2, dry = mean(land.slice(0, q).map((i) => w.hm[i])), wet = mean(land.slice(-q).map((i) => w.hm[i]));
  check(wet > dry + 0.15, `seed ${seed}: the wettest quarter of the land has moisture ${wet.toFixed(2)}, the driest ${dry.toFixed(2)}`);
}
check(new Set(winds.map((a) => a.toFixed(3))).size === winds.length, 'the seeds share a wind');
if (failed) process.exit(1);
console.log(`climate ok: a ridge is wet where it faces the wind (${(side(east, 22, 38) / side(east, 43, 59)).toFixed(1)} times its lee); erosion keeps the coast; ` +
  `moisture follows wetness; seeds 3, 7 and 42 repeat, winds at ${winds.map((a) => Math.round((a * 180) / Math.PI)).join(', ')} degrees`);
