// Populous Villages and the shared generators: population by map size, village size bands, two generations, the generator hook.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, L = VB['sim/layout'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('POPULOUS FAIL:', m); } };
const SIZES = { tiny: [120, 85, 130, 170], small: [180, 130, 320, 380], medium: [280, 200, 800, 950], large: [380, 270, 800, 950] };
const world = (seed, cols, rows) => { const it = G.generate(seed, { cols, rows }); let r; while (!(r = it.next()).done); return r.value; };
const band = (n) => (n >= 2 && n <= 5 ? 'small' : n >= 6 && n <= 10 ? 'medium' : n >= 12 && n <= 16 ? 'large' : 'other');
// mean and spread of drawSize, from 20,000 seeded draws: a map's mean household size lies within 3 standard errors of that mean
// (on a Tiny map of about 20 households, about 6.2 +- 1.0; on Medium, of about 130, +- 0.4)
const draws = Array.from({ length: 20000 }, ((r) => () => VB['sim/people'].drawSize(r))(G.mulberry32(1)));
const MU = draws.reduce((a, b) => a + b, 0) / draws.length, SD = Math.sqrt(draws.reduce((a, b) => a + (b - MU) ** 2, 0) / draws.length);

for (const [name, [cols, rows, lo, hi]] of Object.entries(SIZES)) for (const seed of [7, 42]) {
  const w = world(seed, cols, rows), st = Sim.seed(w, seed, 'populous'), tag = `${name} seed ${seed}`;
  const alive = st.pawns.filter((p) => p.alive).length;
  check(alive >= lo && alive <= hi, `${tag}: population ${alive} outside ${lo}-${hi}`);
  check(st.farmsteads.every((f) => f.village !== null), `${tag}: a lone farm`);
  const sizes = st.households.map((h) => h.members.length);
  check(Math.min(...sizes) >= 4 && Math.max(...sizes) <= 9, `${tag}: household sizes ${Math.min(...sizes)}-${Math.max(...sizes)}`);
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  check(Math.abs(mean - MU) < (3 * SD) / Math.sqrt(sizes.length), `${tag}: mean household size ${mean.toFixed(2)} of ${sizes.length}, drawn about ${MU.toFixed(2)}`);
  for (const p of st.pawns) {
    const parents = [p.father, p.mother].filter((x) => x !== null);
    check(parents.every((x) => st.pawns[x].father === null && st.pawns[x].mother === null), `${tag}: ${p.given} has grandparents on record`);
  }
  const bands = new Set(st.villages.map((v) => band(v.farmsteads.length)));
  if (name === 'medium' || name === 'large') for (const b of ['small', 'medium', 'large']) check(bands.has(b), `${tag}: no ${b} village (sizes ${st.villages.map((v) => v.farmsteads.length)})`);
  check(st.cenv.settlements.length === st.villages.length, `${tag}: villages without a meeting`);
  const again = Sim.seed(world(seed, cols, rows), seed, 'populous');
  check(again.pawns.length === st.pawns.length && again.farmsteads.map((f) => f.house).join() === st.farmsteads.map((f) => f.house).join(), `${tag}: not deterministic`);
}

// the one generator: a field added to its output appears in every scenario
L.farmHooks.push((w, f) => { f.fields.push({ id: f.fields.length, tile: -1, stage: 'stubble', sown: null, reaped: null, held: 0, fert: 1, marker: true }); });
try {
  for (const scenario of ['founders', 'heirs', 'populous']) {
    const st = Sim.seed(world(7, 280, 200), 7, scenario);
    check(st.farmsteads.length > 0 && st.farmsteads.every((f) => f.fields.some((fd) => fd.marker)), `${scenario}: hook field missing from a farm`);
  }
} finally { L.farmHooks.length = 0; }
if (failed) process.exit(1);
console.log('populous ok');
