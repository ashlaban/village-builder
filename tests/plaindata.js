// The simulation state is plain data (VB-073): no function anywhere in st (st.w, the world, aside), after seeding each scenario and after a
// year, so a save (VB-074) can write it whole.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0;
function functionsIn(root) {
  const found = [], seen = new Set(), stack = [[root, 'st']];
  while (stack.length && found.length < 10) {
    const [v, where] = stack.pop();
    if (typeof v === 'function') { found.push(where); continue; }
    if (v === null || typeof v !== 'object' || seen.has(v) || ArrayBuffer.isView(v)) continue;
    seen.add(v);
    if (v instanceof Map) { for (const [k, x] of v) { stack.push([k, `${where}<key>`]); stack.push([x, `${where}.get(${String(k).slice(0, 20)})`]); } continue; }
    if (v instanceof Set) { for (const x of v) stack.push([x, `${where}<item>`]); continue; }
    for (const k of Object.keys(v)) if (!(v === root && k === 'w')) stack.push([v[k], `${where}.${k}`]);
  }
  return found;
}
const world = (seed, cols, rows) => { const it = G.generate(seed, cols ? { cols, rows } : undefined); let r; while (!(r = it.next()).done); return r.value; };
const out = [];
for (const [scenario, map] of [['founders'], ['heirs'], ['populous', [120, 85]]]) {
  const st = Sim.seed(world(7, ...(map || [])), 7, scenario);
  for (const when of ['seeded', 'year 1']) {
    if (when === 'year 1') Sim.advance(st, Sim.YEAR);
    const fns = functionsIn(st);
    if (fns.length) { failed++; console.error(`PLAINDATA FAIL: ${scenario}, ${when}: functions at ${fns.join(', ')}`); }
  }
  out.push(`${scenario} ${st.pawns.length} pawns`);
}
if (failed) process.exit(1);
console.log(`plaindata ok: no function in st after seeding and after a year (${out.join(', ')})`);
