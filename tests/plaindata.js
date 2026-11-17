// The simulation state is plain data (VB-073): no function anywhere in st (st.w, the world, aside), after seeding each scenario and after a
// year (half a year of heirs and populous, through the summer), so a save (VB-074) can write it whole. On the small islands of
// tests/lib/probe.js (VB-856; a year each on the default island and 120 by 85 before; tests/saves.js loads a save of each scenario too).
const VB = require('../src/load.js'), Sim = VB.sim, { scenario: seeded } = require('./lib/probe.js');
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
const out = [];
for (const scenario of ['founders', 'heirs', 'populous']) {
  const st = seeded(scenario, 7);
  for (const when of ['seeded', 'later']) {
    if (when === 'later') Sim.advance(st, scenario === 'founders' ? Sim.YEAR : Sim.YEAR / 2);
    const fns = functionsIn(st);
    if (fns.length) { failed++; console.error(`PLAINDATA FAIL: ${scenario}, ${when}: functions at ${fns.join(', ')}`); }
  }
  out.push(`${scenario} ${st.pawns.length} pawns`);
}
if (failed) process.exit(1);
console.log(`plaindata ok: no function in st after seeding and after a year or half (${out.join(', ')})`);
