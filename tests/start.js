// The start's island (VB-340): the showcase island of the menu (DEMO, page/loader) re-seeded with each built scenario. Heirs asks for less
// land on a small map (seedHeirs, sim/scenarios), so it fits that island; DEMO.start lists the seeds of DEMO.seeds where all three fit.
// `--people` also checks the start's people at each map size (START_PEOPLE, page/start) against Sim.seed at the seeds of DEMO.seeds (verify).
const fs = require('fs'), path = require('path');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const src = (f) => fs.readFileSync(path.join(__dirname, '../src/page', f), 'utf8');
const literal = (text, name) => { const m = text.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});\\n`)); if (!m) throw new Error(`${name} not found`); return Function(`return ${m[1]}`)(); };
const DEMO = literal(src('loader.js'), 'DEMO'), PEOPLE = literal(src('start.js'), 'START_PEOPLE');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('START FAIL:', m); } };
const world = (seed, cols, rows) => { const it = G.generate(seed, { cols, rows }); let r; while (!(r = it.next()).done); return r.value; };
const SCENARIOS = ['founders', 'heirs', 'populous'];
const living = (st) => st.pawns.filter((p) => p.alive).length;
const fits = [], heirsAt = [];
for (const seed of DEMO.seeds) {
  const ok = SCENARIOS.every((sc) => {
    try { const st = Sim.seed(world(seed, DEMO.cols, DEMO.rows), seed, sc); if (sc === 'heirs') heirsAt.push(seed); return living(st) > 0; } catch (e) { return false; }
  });
  if (ok) fits.push(seed);
}
check(heirsAt.length >= 8, `heirs seeds on the ${DEMO.cols} by ${DEMO.rows} showcase at only ${heirsAt.join(', ')} of ${DEMO.seeds.join(', ')}`);
check(fits.join() === DEMO.start.join(), `all three scenarios fit the showcase at ${fits.join(', ')}; DEMO.start is ${DEMO.start.join(', ')}`);
check(DEMO.start.every((s) => DEMO.seeds.includes(s)), 'DEMO.start has a seed DEMO.seeds lacks');
console.log(`showcase ${DEMO.cols} by ${DEMO.rows}: heirs at ${heirsAt.length} of ${DEMO.seeds.length} seeds; all three at ${fits.join(', ')}`);
if (process.argv.includes('--people')) {
  const SIZES = { t: [120, 85], s: [180, 130], m: [280, 200], l: [380, 270] };
  for (const [size, [cols, rows]] of Object.entries(SIZES)) for (const sc of SCENARIOS) {
    const n = DEMO.seeds.map((seed) => living(Sim.seed(world(seed, cols, rows), seed, sc)));
    const got = [Math.min(...n), Math.max(...n)], want = PEOPLE[sc][size];
    check(got.join() === want.join(), `${sc} on ${size}: ${got.join(' to ')} living at the seeds of DEMO.seeds; START_PEOPLE says ${want.join(' to ')}`);
    if (sc === 'populous') console.log(`populous on ${size}: ${got.join(' to ')}`);
  }
}
if (failed) process.exit(1);
console.log('start ok');
