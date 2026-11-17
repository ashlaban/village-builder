// scratch (VB-445): sites by hours from the green, at least 12 hex steps from every centre, within 3.75 and 6 hours by the ground's cost
// node VB-445-sites.js ROOT scenario map seed[,seed]   (ROOT: a scratch copy at the journey scale; with wooded tiles at a path's cost, a trail)
const [root, scenario, map, seeds] = process.argv.slice(2);
const VB = require(root + '/src/load.js'),
  R = VB['sim/routes'],
  RU = VB['sim/rules'],
  S = VB['sim/settle'],
  H = VB['sim/hex'],
  B = VB.gen.B;
const SIZES = { small: [180, 130], medium: [280, 200] };
const q = (a, p) => {
  a = [...a].sort((x, y) => x - y);
  const i = (a.length - 1) * p,
    lo = Math.floor(i);
  return a.length ? +(a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)).toFixed(1) : null;
};
const { SPEED, farmable } = RU;
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
  let r;
  while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, scenario),
    w = st.w,
    use = S.landInUse(st),
    walk = R.walkable(w);
  const wooded = (t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE,
    free = (t) => !use.taken.has(t) && !use.near.has(t);
  const out = { scenario, map, seed, villages: st.villages.length };
  const per = st.villages.map((v) => {
    const ts = [...H.bfs(w, v.center, 60, walk).dist.keys()].filter(
      (t) => free(t) && !w.river[t] && (wooded(t) || (w.biome[t] === B.MEADOW && farmable(w, t))),
    );
    const c = R.reachCosts(w, v.center, 6 * SPEED, ts);
    return ts.map((t, k) => [t, c[k] == null ? null : c[k] / SPEED]).filter(([, h]) => h !== null);
  });
  const nearest = new Map();
  for (const l of per) for (const [t, h] of l) if (!nearest.has(t) || h < nearest.get(t)) nearest.set(t, h);
  for (const top of [3.75, 6]) {
    const m = [],
      wd = [];
    for (const l of per) {
      let a = 0,
        b = 0;
      for (const [t, h] of l) {
        if (h > top || st.villages.some((u) => H.hexSteps(w, u.center, t) < 12)) continue;
        if (wooded(t)) {
          let room = 0;
          for (const [j, dj] of H.bfs(w, t, 4, walk).dist)
            if (dj >= 1 && free(j) && (farmable(w, j) || wooded(j))) room++;
          if (room >= 9) b++;
        } else a++;
      }
      m.push(a);
      wd.push(b);
    }
    out['h' + top] = {
      meadow: [q(m, 0), q(m, 0.5), q(m, 1)],
      wooded: [q(wd, 0), q(wd, 0.5), q(wd, 1)],
      noMeadow: m.filter((x) => !x).length,
      none: m.filter((x, i) => !x && !wd[i]).length,
    };
  }
  console.log(JSON.stringify(out));
}
