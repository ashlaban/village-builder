// The site search on the forested island (VB-786): a crowded village ringed by forest finds a wooded site within SETTLE.hours along a
// trail (a wooded tile with no path at a path's cost) and none beyond; no site lies within SETTLE.centreApart - 1 hex steps of a centre;
// the settlers fell and grub the house tile before the cottage's foundation and their first field before it is cleared and broken, and the
// field broken there is fresh land. On a tiny world (tests/lib/tiny.js): a meadow clearing in a forest.
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/settle'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { SETTLE, SPEED, SOIL } = { ...VB['sim/rules'], ...VB['sim/crops'] }, { hexSteps, bfs } = VB['sim/hex'], { B } = VB['world/biomes'];
const Projects = VB['sim/projects'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FOREST SITES FAIL:', m); } };
const roll = (st, f) => { const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } };
// 80 by 34: a clearing of meadow 9 tiles across round the village, broadleaf beyond to the east and pine to the west; sea at the rims.
const COLS = 80, ROWS = 34, cc = 40, cr = 17;
const rows = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) =>
  r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '~' : Math.hypot(c - cc, (r - cr) * 0.87) < 5 ? '.' : c < cc ? 'P' : 'F').join(''));
const make = () => {
  const st = tinyState(tinyWorld(rows), [{ at: [cc, cr], farms: 3 }], { seed: 3 });
  st.naturalDeaths = false;
  return st;
};
const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
// 1. The reach is hours along a trail: every tile in it within SETTLE.hours, and the search bounded there.
{
  const st = make(), v = st.villages[0], w = st.w, reach = S.reachOf(st, v);
  const far = [...reach.values()].reduce((a, c) => Math.max(a, c), 0) / SPEED;
  check(far <= SETTLE.hours + 1e-9, `the reach ends at ${SETTLE.hours} hours (${far.toFixed(2)})`);
  // along a trail a pine tile costs 1.36 a step against 3 pathless: the reach runs about 35 steps into the pine, not 16
  const west = [...reach.keys()].filter((t) => w.biome[t] === B.PINE && w.hy[t] === w.hy[v.center]).map((t) => hexSteps(w, v.center, t));
  check(Math.max(...west) >= 25, `the trail runs ${Math.max(...west)} steps into the pine`);
  const use = S.landInUse(st), cands = S.candidates(st, v, use, reach);
  check(cands.length > 0 && cands.every(([t, h]) => wooded(w, t) && h <= SETTLE.hours), `every site is wooded and within ${SETTLE.hours} hours (${cands.length})`);
  // 2. The room is a distance: a tile 11 hex steps from the centre is refused, one of 12 along the same row (each passing the tile thinning) taken
  const thin = (t) => (t * 31) % 3 === 0, on = new Set(cands.map(([t]) => t));
  const at = (d) => [...reach.keys()].find((t) => thin(t) && hexSteps(w, v.center, t) === d && wooded(w, t) && !use.near.has(t) && !use.taken.has(t));
  const t11 = at(11), t12 = at(12);
  check(t11 !== undefined && !on.has(t11), `a site 11 hex steps from the centre is refused (${t11})`);
  check(t12 !== undefined && on.has(t12), `a site 12 hex steps away is a candidate (${t12})`);
  check(cands.every(([t]) => hexSteps(w, v.center, t) >= SETTLE.centreApart), 'no candidate nearer than SETTLE.centreApart');
}
// 3. Crowded: a settler founds on the forest, its first field and house felled and grubbed, the field fresh land.
{
  const st = make(), v = st.villages[0], w = st.w;
  for (const [t] of bfs(w, v.center, 6, () => true).dist) st.used.add(t);
  for (const u of st.villages) VB['sim/territory'].reckonWood(st, u);
  const m = st.pawns.find((p) => p.alive && p.age >= 18 && p.age <= 45 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null);
  check(!!m, 'an unmarried adult to lead');
  st.demand = [m.id]; m.landWait = 3; m.stake = 300;
  const n = st.villages.length, farms = st.farmsteads.length;
  roll(st, () => S.settleRound(st));
  // VB-787: the round stakes the site, its tiles cleared and its cottage built by the party before the move founds the village
  const site = st.sites[0];
  check(!!site && st.villages.length === n, `a site is staked in the forest, nothing founded yet (${st.sites.length})`);
  if (site) {
    const fieldTile = site.field, house = site.house, steps = (k) => site.plot.places.find((tr) => tr.kind === k).steps.join();
    check(wooded(w, house) && wooded(w, fieldTile), 'the house and the first field stand on wooded tiles');
    check(steps('field') === 'fell,grub,clear,break', `the field is felled, grubbed, cleared and broken (${steps('field')})`);
    check(steps('house') === 'fell,grub,clear', `the house tile is felled and grubbed before the foundation (${steps('house')})`);
    check(st.record.some((e) => e.kind === 'siteStaked' && /hours' walk away along a trail/.test(e.text)), 'the log tells the hours along the trail');
    let bad = checkState(st); check(!bad.length, `invariants at the stake: ${bad.slice(0, 3).join('; ')}`);
    let grubbed = null, broken = null, built = null, f = null, hours = 0;
    for (let d = 0; d < 2 * Sim.YEAR_DAYS && (broken === null || built === null); d++) {
      Sim.advance(st, 24);
      if (grubbed === null && w.biome[house] === B.MEADOW) grubbed = d;
      if (built === null && !st.sites.includes(site)) {
        built = d;
        f = st.farmsteads[farms];
        hours = VB['sim/villagehours'].hoursBetween(st, v.id, f.village);
      }
      if (broken === null && f && f.fields.length) {
        broken = d;
        const fd = f.fields.find((x) => x.tile === fieldTile);
        check(fd && fd.soil === SOIL.fresh && w.biome[fieldTile] === B.MEADOW, `the field broken on the forest is fresh land (${fd && fd.soil})`);
      }
    }
    check(grubbed !== null, 'the house tile is grubbed to meadow');
    check(built !== null && built > grubbed, `the cottage is built after (day ${built}, grubbed day ${grubbed})`);
    check(broken !== null, 'the first field is broken');
    bad = checkState(st); check(!bad.length, `invariants after two years: ${bad.slice(0, 3).join('; ')}`);
    if (!failed) console.log(`forestsites ok: a site ${hours.toFixed(1)} hours off in the wood; house grubbed day ${grubbed}, cottage day ${built}, field broken day ${broken}`);
  }
}
if (failed) process.exit(1);
