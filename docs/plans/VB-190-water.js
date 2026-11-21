// scratch (VB-190): what boats and ice make of an island's hours, at the journey scale (design.md, World and scale: 8 tiles an hour,
// the dear ground and the forested island of VB-444's plan, set here by hand since the code holds the earlier values).
// node docs/plans/VB-190-water.js ROOT map seed[,seed] [boatCost] [rivers]   (ROOT an absolute path)
// Research code, not game code: its own search over the grid, so that water and ice can be opened; counters, not times.
const [root, map, seeds, boatArg] = process.argv.slice(2); // then: rivers
const VB = require(root + '/src/load.js'), R = VB['sim/walking'] || VB['sim/routes'], RU = VB['sim/rules'], G = VB.gen;
const SIZES = { small: [180, 130], medium: [280, 200] };
const SPEED = 8, BOAT = +(boatArg || 0.35), PUT = 3, NEAR = 3, ICE = 1, FROZEN_MARSH = 1.5, LANDING_HOURS = 2;
const B = G.B;
Object.assign(RU.TERRAIN, { [B.HEATH]: 1.5, [B.PINE]: 3, [B.HILLS]: 3, [B.FOREST]: 4, [B.MARSH]: 5, [B.MOUNTAIN]: 6 });
if (G.COVER) Object.assign(G.COVER, { heath: 0.07, meadow: 0.2 });
const q = (a, p) => { a = [...a].sort((x, y) => x - y); const i = (a.length - 1) * p, lo = Math.floor(i); return a.length ? +(a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)).toFixed(1) : null; };
function heap() { const k = [], v = []; return { get size() { return k.length; },
  push(key, val) { let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; },
  pop() { const top = v[0], key = k.pop(), val = v.pop(), n = k.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= key) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = key; v[i] = val; } return top; } }; }
// One search from `from` over a grid given by cost(i) (Infinity closed) and extra(i, j) (a charge on a step, as putting out); returns
// the cost to every tile and the number settled.
function search(w, from, cost, extra, budget = Infinity) {
  const N = w.nb.length / 6, g = new Float64Array(N).fill(Infinity), shut = new Uint8Array(N), open = heap(); let settled = 0;
  g[from] = 0; open.push(0, from);
  while (open.size) { const i = open.pop(); if (shut[i]) continue; shut[i] = 1; settled++;
    const ci = i === from ? (cost(i) < Infinity ? cost(i) : 1) : cost(i);
    for (let d = 0; d < 6; d++) { const j = w.nb[i * 6 + d]; if (j < 0 || shut[j]) continue; const cj = cost(j); if (cj === Infinity) continue;
      const gj = g[i] + ((ci + cj) / 2) * (w.water[i] || w.water[j] ? 1 : R.slopeFactor(w, i, j)) + (extra ? extra(i, j) : 0);
      if (gj < g[j] && gj <= budget) { g[j] = gj; open.push(gj, j); } } }
  return { g, settled };
}
for (const seed of seeds.split(',').map(Number)) {
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, 'populous'), w = st.w, N = w.nb.length / 6;
  const cs = st.villages.map((v) => v.center), n = cs.length;
  const pop = st.villages.map((v) => v.farmsteads.reduce((a, f) => { const h = st.farmsteads[f].household; return a + (h === null || h === undefined ? 0 : st.households[h].members.length); }, 0));
  const RV = VB['gen/rivers'], bigRiver = (i) => !w.water[i] && w.river[i] && RV.kind(w, i) === 'River';
  // geometry
  let land = 0, coast = 0, lake = 0, river = 0, ford = 0, marsh = 0, sea3 = 0;
  for (let i = 0; i < N; i++) { if (!w.water[i]) { land++; if (w.river[i]) { river++; if (w.crossing[i] === 1) ford++; } if (w.biome[i] === B.MARSH) marsh++; }
    else if (!w.ocean[i]) lake++; else if (w.landDist[i] <= NEAR) sea3++; }
  const foot = (i) => R.tileCost ? R.tileCost(w, i) : landCost(i);
  function landCost(i) { if (w.water[i]) return Infinity; if (w.dev && w.dev[i]) return w.dev[i] === 3 ? Infinity : 1;
    if (w.river[i]) return w.crossing[i] === 1 ? RU.TERRAIN.ford : w.crossing[i] === 2 ? RU.TERRAIN.bridge : Infinity;
    const s = w.worn ? w.worn[i] : 0; return (1 + ((RU.TERRAIN[w.biome[i]] ?? 1) - 1) * (1 - RU.PATHS.clear[s])) / RU.PATHS.speed[s]; }
  const RIVERS = process.argv[6] === 'rivers'; // a boat also goes on a river (the widest kind), not past a ford without a portage
  const boatable = (i) => (w.water[i] ? (w.ocean[i] ? w.landDist[i] <= NEAR : true) : RIVERS && bigRiver(i));
  let riverBig = 0; for (let i = 0; i < N; i++) if (bigRiver(i)) riverBig++;
  const grids = {
    foot: { cost: landCost },
    boat: { cost: (i) => (boatable(i) ? BOAT : landCost(i)), extra: (i, j) => (!w.water[i] && w.water[j] ? PUT : 0) },
    lakeIce: { cost: (i) => (w.water[i] ? (w.ocean[i] ? Infinity : ICE) : w.river[i] ? ICE : w.biome[i] === B.MARSH && !(w.dev && w.dev[i]) ? Math.min(landCost(i), FROZEN_MARSH) : landCost(i)) },
    allIce: { cost: (i) => (w.water[i] ? (boatable(i) ? ICE : Infinity) : w.river[i] ? ICE : w.biome[i] === B.MARSH && !(w.dev && w.dev[i]) ? Math.min(landCost(i), FROZEN_MARSH) : landCost(i)) },
  };
  const out = { map, seed, villages: n, people: pop.reduce((a, b) => a + b, 0), land, lake, river, riverBig, ford, marsh, seaWithin3: sea3, boatCost: BOAT, rivers: RIVERS };
  const stats = (H, set, set24) => statsOf(H, set, set24);
  const tables = {};
  for (const [name, gr] of Object.entries(grids)) {
    const H = [], set = [], set24 = [];
    for (let v = 0; v < n; v++) { const s = search(w, cs[v], gr.cost, gr.extra); H.push(cs.map((c) => s.g[c] / SPEED)); set.push(s.settled);
      set24.push(search(w, cs[v], gr.cost, gr.extra, 24 * SPEED).settled); }
    tables[name] = H; out[name] = stats(H, set, set24);
  }
  function statsOf(H, set, set24) {
    const pairs = [], near = [], pot3 = [], pot6 = [], pot12 = []; let cut = 0, over67 = 0;
    for (let v = 0; v < n; v++) { let m = Infinity, p3 = pop[v], p6 = pop[v], p12 = pop[v];
      for (let u = 0; u < n; u++) { if (u === v) continue; const h = H[v][u]; if (h < m) m = h; if (h <= 3) p3 += pop[u]; if (h <= 6) p6 += pop[u]; if (h <= 12) p12 += pop[u];
        if (u > v) { if (h === Infinity) cut++; else { pairs.push(h); if (h > 67) over67++; } } }
      near.push(m); pot3.push(p3); pot6.push(p6); pot12.push(p12); }
    return { nearest: q(near.filter(isFinite), 0.5), nearestMost: q(near.filter(isFinite), 1), medianPair: q(pairs, 0.5), q3Pair: q(pairs, 0.75), farthest: q(pairs, 1), noRoute: cut, over67,
      w6: pairs.filter((h) => h <= 6).length, w12: pairs.filter((h) => h <= 12).length, w24: pairs.filter((h) => h <= 24).length,
      people3h: q(pot3, 0.5), people6h: q(pot6, 0.5), people12h: q(pot12, 0.5), people6hBest: q(pot6, 1), settledRow: q(set, 0.5), settledRowMost: q(set, 1), settledRow24h: q(set24, 0.5) };
  }
  // the landing estimate: a village's landing is the shore tile (land beside boatable water) cheapest by land from its green, within
  // LANDING_HOURS; by boat from landing to landing over water only; compared with the full search above
  const shore = (i) => { if (w.water[i] || (landCost(i) === Infinity && !bigRiver(i))) return false; if (RIVERS && bigRiver(i)) return true; for (let d = 0; d < 6; d++) { const j = w.nb[i * 6 + d]; if (j >= 0 && boatable(j)) return true; } return false; };
  const landing = [], toLanding = []; let waterSettled = [];
  for (let v = 0; v < n; v++) { const s = search(w, cs[v], landCost, null, LANDING_HOURS * SPEED); let best = -1;
    for (let i = 0; i < N; i++) if (s.g[i] < Infinity && shore(i) && (best < 0 || s.g[i] < s.g[best])) best = i;
    landing.push(best); toLanding.push(best < 0 ? Infinity : s.g[best] / SPEED); }
  const est = cs.map(() => new Array(n).fill(Infinity));
  for (let v = 0; v < n; v++) { if (landing[v] < 0) continue;
    const s = search(w, landing[v], (i) => (boatable(i) ? (w.water[i] ? BOAT : 0.5) : i === landing[v] || landing.includes(i) ? 1 : Infinity), null); waterSettled.push(s.settled);
    for (let u = 0; u < n; u++) if (u !== v && landing[u] >= 0 && s.g[landing[u]] < Infinity) est[v][u] = toLanding[v] + (PUT + s.g[landing[u]]) / SPEED + toLanding[u]; }
  const byBoat = cs.map((_, v) => cs.map((_, u) => (u === v ? 0 : Math.min(est[v][u], tables.foot[v][u]))));
  out.byLanding = statsOf(byBoat, waterSettled.length ? waterSettled : [0], [0]);
  let errs = [], better = 0, missed = 0, both = 0;
  for (let v = 0; v < n; v++) for (let u = v + 1; u < n; u++) { const full = tables.boat[v][u], e = Math.min(est[v][u], tables.foot[v][u]); if (full === Infinity) continue; both++;
    if (e === Infinity) missed++; else { errs.push(e / full); if (e < tables.foot[v][u] - 0.05) better++; } }
  out.landings = { with: landing.filter((x) => x >= 0).length, hoursMedian: q(toLanding.filter(isFinite), 0.5), within1h: toLanding.filter((h) => h <= 1).length,
    waterSettledRow: q(waterSettled, 0.5), waterSettledMost: q(waterSettled, 1), pairs: both, boatShorter: better, estimateMissed: missed, estOverFullMedian: q(errs, 0.5), estOverFullP90: q(errs, 0.9), estOverFullMost: q(errs, 1) };
  console.log(JSON.stringify(out));
}
