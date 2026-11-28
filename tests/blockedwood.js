// @suite integration
// VB-1809: a wood goal that blocks (no trees standing, no timber at home) keeps its reason for the card and is not posted again at the same
// tile until a tree stands again. A tiny village with a bare wood.
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('BLOCKEDWOOD FAIL:', m); } };
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
const wood = st.villages[0].wood;
check(wood.length > 0, 'the village has a wood');
for (const t of wood) st.w.trees[t] = 0; // a bare wood
for (const id of st.liveHouseholds) st.households[id].wood = 0;
for (let d = 0; d < 6; d++) Sim.advance(st, Sim.DAY);
const blocked = st.liveHouseholds.map((id) => VB['sim/reasons'].blockedOf(st, id)).flat().filter((b) => b.kind === 'wood');
check(blocked.length > 0, 'a blocked wood task leaves its reason');
check(blocked.every((b) => b.why === 'no trees standing'), `the reason is the step's: ${blocked.map((b) => b.why)}`);
let hh = null, key = null;
for (const id of st.liveHouseholds) {
  const k = Object.keys(st.households[id].blocked || {})[0];
  if (k) { hh = st.households[id]; key = k; break; }
}
if (key) {
  check(!st.jobs.has(key), 'a blocked task is not posted again while the wood is bare');
  for (const t of wood) st.w.trees[t] = 30; // a tree stands again: the fact changed
  Sim.advance(st, Sim.DAY);
  check(!hh.blocked || !hh.blocked[key] || st.jobs.has(key), 'posted again once trees stand');
}
const bad = checkState(st).filter((m) => !/role cache/.test(m));
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
if (failed) process.exit(1);
console.log('blockedwood ok: a blocked wood goal says why and waits for a tree', blocked.length);
