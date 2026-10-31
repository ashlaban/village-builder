// Hay meadows (VB-132): founders with animals make meadows by the end of summer of year 1, each on a valid tile within reach; generated
// (populous) farms with animals start with theirs; farms without animals make none; the state invariants hold.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, M = VB['sim/meadows'], { bfs } = VB['sim/hex'], { walkable } = VB['sim/routes'];
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
const lines = [];
for (const seed of [7, 42]) {
  const st = Sim.seed(world(seed), seed, 'founders');
  check(st.farmsteads.every((f) => !f.meadows.length), `founders ${seed}: a meadow at the start`);
  Sim.advance(st, 24 * Sim.SEASON_DAYS * 2); // to the end of summer of year 1
  for (const hh of st.households) {
    const f = st.farmsteads[hh.farmstead];
    if (hh.herds.length) check(f.meadows.length >= 1, `founders ${seed}: ${f.name} keeps animals but has no meadow by the end of summer`);
    else check(!f.meadows.length, `founders ${seed}: ${f.name} keeps no animals but made a meadow`);
    validMeadows(st, f, hh, `founders ${seed}`);
  }
  check(!checkState(st).length, `founders ${seed}: ` + checkState(st).slice(0, 3).join('; '));
  lines.push(`founders ${seed}: ` + st.households.map((hh) => `${st.farmsteads[hh.farmstead].meadows.length}/${Math.round(M.expectedHay(st.farmsteads[hh.farmstead]))}h`).join(' '));
}
const st = Sim.seed(world(7), 7, 'populous');
let withHerds = 0, covered = 0;
for (const hh of st.households) {
  const f = st.farmsteads[hh.farmstead];
  validMeadows(st, f, hh, 'populous 7');
  if (!hh.herds.length) { check(!f.meadows.length, `populous: ${f.name} keeps no animals but has meadows`); continue; }
  withHerds++; if (f.meadows.length) covered++;
}
check(covered === withHerds, `populous: ${withHerds - covered} of ${withHerds} farms with animals have no meadow`);
check(!checkState(st).length, 'populous: ' + checkState(st).slice(0, 3).join('; '));
if (failed) process.exit(1);
console.log(`meadows ok: ${lines.join('; ')}; populous 7 tiny: ${covered} farms with meadows`);
