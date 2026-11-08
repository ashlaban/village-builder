// Verify present late-game states, including stale golden hashes. Offline absence is a reported skip.
const assert = require('assert'), F = require('./lib/fixtures.js'), { checkState } = require('./lib/invariants.js');
const VB = require('../src/load.js'), Sim = VB.sim, { compareRankings } = require('./lib/heir-rankings.js');
let loaded = 0;
for (const name of Object.keys(F.FIXTURES)) {
  const fixture = F.loadFixture(name);
  if (!fixture) continue;
  // Check the optimized multi-source occupancy against independent per-mark radius searches on late worlds.
  const st = fixture.st, { bfs } = VB['sim/hex'], { SETTLE } = VB['sim/rules'];
  const expected = { taken: new Set(st.used), near: new Set() }, marks = VB['sim/fields'].builtTiles(st);
  for (let t = 0; t < st.w.N; t++) if (st.owner[t] !== 0 || st.claims.has(t)) expected.taken.add(t);
  for (const f of st.farmsteads) { for (const fd of f.fields) marks.add(fd.tile); if (f.project) marks.add(f.project.tile); }
  for (const v of st.villages) for (const p of v.plots) for (const tr of p.tiles) marks.add(tr.tile);
  for (const t of marks) {
    expected.taken.add(t);
    for (const [j] of bfs(st.w, t, SETTLE.apart - 1, () => true).dist) expected.near.add(j);
  }
  assert.deepStrictEqual(VB['sim/settle'].landInUse(st), expected, `${name}: occupancy changed`);
  // VB-224: on a late state, every ranking that asks only its candidates' line farms matches the full list.
  const ranks = compareRankings(VB, st);
  assert.deepStrictEqual(ranks.bad, [], `${name}: ${ranks.bad.slice(0, 4).join('; ')}`);
  assert(ranks.claimed > 0, `${name}: no ranking depended on another farm's claim`);
  Sim.advance(st, Sim.DAY);
  const bad = checkState(fixture.st);
  assert.deepStrictEqual(bad, [], `${name}: ${bad.slice(0, 8).join('; ')}`);
  console.log(`${name}: loaded${fixture.stale ? ' (stale)' : ''}; ${ranks.checked} rankings by line match the full list (a claim mattered in`
    + ` ${ranks.claimed}); advanced one day; invariants pass`); loaded++;
}
const total = Object.keys(F.FIXTURES).length;
console.log(`fixtures: ${loaded}/${total} saves checked; ${total - loaded} missing`);
