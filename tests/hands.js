// Several hands on one job (VB-102): a household of 3 adults with one stubble field in the sowing window hoes it with more than one
// pawn, each on its own row, in under 60% of the hours one hoer takes; a carried job whose work is done is not open to others.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { isOpen } = VB['sim/kinds'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HANDS FAIL:', m); } };
const it = G.generate(7); let r; while (!(r = it.next()).done);
const world = r.value;
// Heirs seed 7, Södergården: farmer, wife and their son of 29 stay; one field in stubble, the other two already sown.
function hoe(hands) {
  const keep = Sim.KINDS.plow.hands; Sim.KINDS.plow.hands = hands;
  try {
    const st = Sim.seed(world, 7, 'heirs'), hh = st.households[0], f = st.farmsteads[hh.farmstead], fd = f.fields[0];
    for (const id of hh.members.slice(3)) { const p = st.pawns[id]; p.died = st.t; p.alive = false; }
    hh.members = hh.members.slice(0, 3);
    for (const q of f.fields.slice(1)) { q.stage = 'sown'; q.sown = 0; }
    for (const m of f.meadows) m.raked = true; // no spring raking (VB-133) to take hands from the hoeing measured here
    for (const q of f.fields) q.soil = Sim.SOIL.cap; // nor manure to cart (VB-137): whether the heap holds a load moves with the random draws
    for (const hd of Sim.herdsOf(st, hh)) if (hd.head) hd.head = hd.head.filter((h) => h.kind !== 'ox'); // nor a team (VB-138), which speeds one hoer
    const t0 = st.t; let most = 0, rows = 0;
    while (fd.stage === 'stubble' && st.t < t0 + 4 * Sim.DAY) {
      Sim.advance(st, 0.5);
      const j = st.jobs.get(`plow:f${f.id}.${fd.id}`);
      if (!j) continue;
      most = Math.max(most, j.claims.length);
      const at = j.claims.map((id) => st.agents[id]).filter((a) => a.phase === 'work' && a.work);
      rows = Math.max(rows, new Set(at.map((a) => a.work.row)).size);
    }
    return { hours: st.t - t0, most, rows, done: fd.stage !== 'stubble' };
  } finally { Sim.KINDS.plow.hands = keep; }
}
const one = hoe(1), all = hoe(Infinity);
check(one.done && all.done, `the field was not hoed within 4 days (one hoer: ${one.done}, all hands: ${all.done})`);
check(one.most === 1, `with one hand the job had ${one.most} workers`);
check(all.most > 1, `with all hands only ${all.most} pawn hoed the field`);
check(all.rows === all.most || all.rows >= 2, `workers on the field share rows (${all.rows} rows for ${all.most} workers)`);
check(all.hours < 0.6 * one.hours, `all hands took ${all.hours} h, one hoer ${one.hours} h; wanted under 60%`);
// a carried job whose work is done waits for its carrier: it is not open, whatever its hands
check(!isOpen({ kind: 'haul', claims: [1], done: 0.7 }) && isOpen({ kind: 'haul', claims: [1], done: 0.3 }) && !isOpen({ kind: 'wood', claims: [1], done: 0 }),
  'open jobs: a finished haul or a taken firewood job counts as open, or a haul with work left does not');
console.log(`hands ok: one hoer ${one.hours.toFixed(1)} h, all hands ${all.hours.toFixed(1)} h with up to ${all.most} hoers on ${all.rows} rows`);
if (failed) process.exit(1);
