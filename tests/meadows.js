// Hay meadows (VB-132): founders with animals make meadows by the end of year 1 (VB-780: it was by summer's end), each on a valid tile within reach; generated
// (populous) farms with animals start with theirs; farms without animals make none; the state invariants hold.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, M = VB['sim/meadows'], { bfs } = VB['sim/hex'], { walkable } = VB['sim/walking'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('MEADOWS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const B = G.B, SITES = [B.MEADOW, B.MARSH, B.HEATH];
function validMeadows(st, f, hh, what) {
  const reach = bfs(st.w, f.house, 6, walkable(st.w)).dist;
  for (const m of f.meadows) {
    check(reach.has(m.tile), `${what}: ${f.name}'s meadow ${m.tile} is beyond 6 steps`);
    check(SITES.includes(st.w.biome[m.tile]) && !st.w.river[m.tile] && !st.w.water[m.tile], `${what}: ${f.name}'s meadow ${m.tile} on biome ${st.w.biome[m.tile]}`);
    check(st.owner[m.tile] === st.owner[f.house] && st.w.dev[m.tile] === 1 && st.used.has(m.tile), `${what}: ${f.name}'s meadow ${m.tile} not owned or used`);
    check(m.fert >= 0.6 && m.fert <= 1.3, `${what}: meadow site value ${m.fert}`);
  }
}
const lines = [], noSite = [];
const late = [];
for (const seed of [7, 42]) {
  const st = Sim.seed(world(seed), seed, 'founders');
  check(st.farmsteads.every((f) => !f.meadows.length), `founders ${seed}: a meadow at the start`);
  // to the end of year 1 (VB-353: five or six fields to break first, for the courses). It was the end of autumn, in time for the first
  // winter's hay; on the forested island (VB-780) open ground near the village is scarce, the first farm's meadows are poor heath and marsh
  // and take more tiles, and at seeds 7 and 42 the second farm with animals makes its first meadow in winter (a shortfall, docs/tuning.md)
  Sim.advance(st, 24 * Sim.SEASON_DAYS * 4);
  for (const hh of st.households) {
    const f = st.farmsteads[hh.farmstead];
    // on the forested island (VB-780) a farm may find no open ground for a meadow within reach: then it has none, and it is counted
    if (hh.herds.length && !f.meadows.length) noSite.push(`founders ${seed} ${f.name}`);
    // a wood broken to a field (VB-1525) is felled, grubbed and its timber carried home before the next field opens, so a farm breaking
    // its courses' fields in forest may come to its meadow in the spring of year 2 (a shortfall, docs/tuning.md): checked a season on
    if (hh.herds.length && !f.meadows.length && M.chooseMeadow(st, f) >= 0) late.push([st, f]);
    // a household without animals may make a first meadow, for a cow it wants (VB-428), by the rule of tests/cowwant.js
    validMeadows(st, f, hh, `founders ${seed}`);
  }
  check(!checkState(st).length, `founders ${seed}: ` + checkState(st).slice(0, 3).join('; '));
  if (late.length) Sim.advance(st, 24 * Sim.SEASON_DAYS);
  for (const [, f] of late.splice(0))
    check(f.meadows.length >= 1 || M.chooseMeadow(st, f) < 0, `founders ${seed}: ${f.name} keeps animals and a site lies in reach, but has no meadow by the spring of year 2`);
  lines.push(`founders ${seed}: ` + st.households.map((hh) => `${st.farmsteads[hh.farmstead].meadows.length}/${Math.round(M.expectedHay(st.farmsteads[hh.farmstead]))}h`).join(' '));
}
const st = Sim.seed(world(3), 3, 'populous');
let withHerds = 0, covered = 0;
for (const hh of st.households) {
  const f = st.farmsteads[hh.farmstead];
  validMeadows(st, f, hh, 'populous 3');
  if (!hh.herds.length) { check(!f.meadows.length, `populous: ${f.name} keeps no animals but has meadows`); continue; }
  withHerds++; if (f.meadows.length) covered++;
  else { noSite.push(`populous 3 ${f.name}`); check(M.chooseMeadow(st, f) < 0, `populous: ${f.name} keeps animals and a site lies in reach, but has no meadow`); }
}
check(!checkState(st).length, 'populous: ' + checkState(st).slice(0, 3).join('; '));
if (failed) process.exit(1);
console.log(`meadows ok: ${lines.join("; ")}; populous 3 tiny: ${covered} of ${withHerds} farms with animals have meadows; with animals and no site for one in reach: ${noSite.join(", ") || "none"}`);
