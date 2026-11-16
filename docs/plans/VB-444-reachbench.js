// scratch (VB-444): the cost of a village's row of hours and of a long route, by the search's bound
const [root, map, seeds] = process.argv.slice(2);
const VB = require(root + '/src/load.js'), R = VB['sim/routes'];
const SIZES = { small: [180, 130], medium: [280, 200] };
const SPEED = Object.values(VB).find((m) => m && m.SPEED).SPEED;
const q = (a, p) => { a = [...a].sort((x, y) => x - y); return +a[Math.floor((a.length - 1) * p)].toFixed(2); };
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, 'populous'), w = st.w, cs = st.villages.map((v) => v.center), out = { map, seed, speed: SPEED, villages: cs.length };
  for (const reach of [200, 536, 800, Infinity]) {
    const ms = []; let found = 0;
    for (let rep = 0; rep < 3; rep++) for (const c of cs) { const t = process.hrtime.bigint(); const k = R.reachCosts(w, c, reach, cs); ms.push(Number(process.hrtime.bigint() - t) / 1e6); if (!rep) found += k.filter((x) => x !== null).length - 1; }
    out['row' + reach] = { median: q(ms, 0.5), most: q(ms, 1), table: +(ms.reduce((a, b) => a + b, 0) / 3).toFixed(1), pairs: found / 2 };
  }
  // routes between greens, by the game's own search: found or not, time, length
  for (const reach of [200, 536]) {
    const ms = [], len = []; let n = 0, ok = 0;
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) { const t = process.hrtime.bigint(); const p = R.findRoute(w, cs[a], cs[b], reach); ms.push(Number(process.hrtime.bigint() - t) / 1e6); n++; if (p) { ok++; len.push(p.length || (p.path && p.path.length) || 0); } }
    out['route' + reach] = { searches: n, found: ok, median: q(ms, 0.5), p90: q(ms, 0.9), most: q(ms, 1), longest: len.length ? Math.max(...len) : 0, medianLen: len.length ? q(len, 0.5) : 0 };
  }
  console.log(JSON.stringify(out));
}
