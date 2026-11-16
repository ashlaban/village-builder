// scratch (VB-444): the villages' hours without a bound, and the land within a day's walk of a green
// node geo.js ROOT scenario map seed[,seed]
const [root, scenario, map, seeds] = process.argv.slice(2);
const VB = require(root + '/src/load.js'), R = VB['sim/routes'], RU = VB['sim/rules'] || VB.rules;
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const q = (a, p) => { const i = (a.length - 1) * p, lo = Math.floor(i); return a.length ? +(a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)).toFixed(1) : null; };
const SPEED = (Object.values(VB).find((m) => m && m.SPEED) || {}).SPEED;
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, scenario), w = st.w;
  const land = []; for (let i = 0; i < w.nb.length / 6; i++) if (R.walkable ? R.walkable(w, i) : R.passable(w, i)) land.push(i);
  const centres = st.villages.map((v) => v.center), n = centres.length, best = new Float64Array(land.length).fill(Infinity);
  const idx = new Map(centres.map((c, k) => [c, k])), li = new Map(land.map((t, k) => [t, k]));
  const all = [], near = new Array(n).fill(Infinity); let sea = 0;
  for (let v = 0; v < n; v++) {
    const c = R.reachCosts(w, centres[v], Infinity, land);
    for (let k = 0; k < land.length; k++) if (c[k] != null && c[k] / SPEED < best[k]) best[k] = c[k] / SPEED;
    for (let u = 0; u < n; u++) { if (u === v) continue; const k = li.get(centres[u]), h = k === undefined || c[k] == null ? null : c[k] / SPEED;
      if (h === null) { if (u > v) sea++; continue; } near[v] = Math.min(near[v], h); if (u > v) all.push(h); }
  }
  all.sort((a, b) => a - b); const nn = near.filter((x) => x < Infinity).sort((a, b) => a - b);
  const within = (h) => all.filter((x) => x <= h).length, share = (h) => +(100 * best.filter((x) => x <= h).length / land.length).toFixed(0);
  console.log(JSON.stringify({ scenario, map, seed, speed: SPEED, pop: st.pawns.filter((p) => !p.dead && p.alive !== false).length, villages: n, byLand: all.length, overSea: sea,
    median: q(all, 0.5), q1: q(all, 0.25), q3: q(all, 0.75), most: q(all, 1), nearest: q(nn, 0.5), nearestMost: q(nn, 1),
    w6: within(6), w12: within(12), w24: within(24), over67: all.length - within(67), over200steps: all.filter((x) => x * SPEED > 200).length, land6: share(6), land12: share(12), land24: share(24) }));
}
