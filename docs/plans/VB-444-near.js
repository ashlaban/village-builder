// scratch (VB-444): each village's neighbours by the hour thresholds, and the match's village term
const [root, map, seeds] = process.argv.slice(2);
const VB = require(root + '/src/load.js'), R = VB['sim/routes'];
const SIZES = { small: [180, 130], medium: [280, 200] }, SPEED = Object.values(VB).find((m) => m && m.SPEED).SPEED;
const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a.length ? +a[Math.round((a.length - 1) * p)].toFixed(2) : null; };
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, 'populous'), cs = st.villages.map((v) => v.center), n = cs.length;
  const pop = st.villages.map((v, k) => st.pawns.filter((p) => !p.dead && st.households[p.household] && st.households[p.household].village === k).length);
  const n6 = [], n12 = [], n24 = [], n67 = [], w8 = [], w12 = [], w16 = [], ppl12 = [];
  for (let v = 0; v < n; v++) {
    const h = R.reachCosts(st.w, cs[v], Infinity, cs).map((c) => (c === null ? Infinity : c / SPEED)).filter((_, u) => u !== v);
    const hu = R.reachCosts(st.w, cs[v], Infinity, cs).map((c) => (c === null ? Infinity : c / SPEED));
    n6.push(h.filter((x) => x <= 6).length); n12.push(h.filter((x) => x <= 12).length); n24.push(h.filter((x) => x <= 24).length); n67.push(h.filter((x) => x <= 67).length);
    ppl12.push(hu.reduce((s, x, u) => s + (x <= 12 ? pop[u] : 0), 0));
    for (const [a, sc] of [[w8, 8], [w12, 12], [w16, 16]]) a.push(h.reduce((s, x) => s + Math.exp(-x / sc), 0));
  }
  const row = (a) => `${q(a, 0)}/${q(a, 0.5)}/${q(a, 1)}`;
  console.log(JSON.stringify({ map, seed, speed: SPEED, villages: n, popMedian: q(pop, 0.5), within6: row(n6), none6: n6.filter((x) => !x).length, within12: row(n12), none12: n12.filter((x) => !x).length, within24: row(n24), none24: n24.filter((x) => !x).length, within67: row(n67), people12: row(ppl12), w8: row(w8), w12: row(w12), w16: row(w16) }));
}
