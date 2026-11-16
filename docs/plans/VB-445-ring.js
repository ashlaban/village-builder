// scratch (VB-445): the sites a village can find in the ring of 10 to 30 steps, on meadow and on forest, by steps and by hours
// node VB-445-ring.js ROOT scenario map seed[,seed]   (ROOT: this checkout, or a scratch copy of it at the journey scale)
const [root, scenario, map, seeds] = process.argv.slice(2);
const VB = require(root + '/src/load.js'), R = VB['sim/routes'], RU = VB['sim/rules'], S = VB['sim/settle'], H = VB['sim/hex'], B = VB.gen.B;
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200] };
const q = (a, p) => { a = [...a].sort((x, y) => x - y); const i = (a.length - 1) * p, lo = Math.floor(i); return a.length ? +(a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)).toFixed(1) : null; };
const { SETTLE, SPEED, farmable } = RU;
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, scenario), w = st.w, use = S.landInUse(st), walk = R.walkable(w);
  const centres = st.villages.map((v) => v.center);
  const wooded = (t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  const free = (t) => !use.taken.has(t) && !use.near.has(t);
  let withSite = 0; const mead = [], wood = [], woodRoom = [], hM = [], hW = [], inM = [], inW = [], stepsSite = [], hoursSite = [];
  for (const v of st.villages) {
    const reach = S.reachOf(st, v), cands = S.candidates(st, v, use, reach), site = S.newSite(st, v, use, cands);
    const mt = [], wt = [];
    for (const [t, d] of reach) {
      if (d < SETTLE.reach[0] || d > SETTLE.reach[1] || !free(t) || w.river[t]) continue;
      if (centres.some((c) => H.hexSteps(w, c, t) < SETTLE.centreApart)) continue;
      if (w.biome[t] === B.MEADOW && farmable(w, t)) mt.push(t);
      else if (wooded(t)) {
        let room = 0; for (const [j, dj] of H.bfs(w, t, 4, walk).dist) if (dj >= 1 && free(j) && (farmable(w, j) || wooded(j))) room++;
        if (room >= 9) wt.push(t);
      }
    }
    const cm = R.reachCosts(w, v.center, Infinity, mt), cw = R.reachCosts(w, v.center, Infinity, wt);
    const hm = cm.filter((c) => c != null).map((c) => c / SPEED), hw = cw.filter((c) => c != null).map((c) => c / SPEED);
    mead.push(mt.length); wood.push(wt.length); hM.push(...hm); hW.push(...hw);
    inM.push(hm.filter((h) => h <= 3.75).length); inW.push(hw.filter((h) => h <= 3.75).length);
    if (site) { withSite++; stepsSite.push(site.steps); hoursSite.push(R.reachCosts(w, v.center, Infinity, [site.house])[0] / SPEED); }
  }
  console.log(JSON.stringify({ scenario, map, seed, speed: SPEED, villages: st.villages.length, withSiteToday: withSite,
    siteSteps: q(stepsSite, 0.5), siteHours: [q(hoursSite, 0.5), q(hoursSite, 1)],
    meadowTiles: [q(mead, 0), q(mead, 0.5), q(mead, 1)], villagesNoMeadow: mead.filter((x) => !x).length,
    woodedTiles: [q(wood, 0), q(wood, 0.5), q(wood, 1)], villagesNoWood: wood.filter((x) => !x).length,
    hoursMeadow: [q(hM, 0.5), q(hM, 0.9), q(hM, 1)], hoursWooded: [q(hW, 0.5), q(hW, 0.9), q(hW, 1)],
    meadowWithin3h45: [q(inM, 0), q(inM, 0.5)], woodedWithin3h45: [q(inW, 0), q(inW, 0.5)], villagesNoWoodWithin: inW.filter((x) => !x).length }));
}
