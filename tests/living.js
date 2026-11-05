// VB-195: mutation during live walks, independent corruption checks and format-1 cache rebuilding.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const make = () => tinyState(tinyWorld(Array(24).fill('.'.repeat(40))),
  [{ at: [10, 12], farms: 3, sizes: [6, 6, 6] }], { seed: 7 });
function compare(st) {
  assert.deepStrictEqual(st.living, st.pawns.filter((p) => p.alive).map((p) => p.id));
  assert.deepStrictEqual(st.liveHouseholds, st.households.filter((h) => !h.dissolved).map((h) => h.id));
}
const st = make(); compare(st);
for (const key of ['living', 'liveHouseholds']) {
  const saved = st[key].slice();
  for (const corrupt of [saved.slice(1), [...saved, saved[0]], saved.slice().reverse()]) {
    st[key] = corrupt;
    assert(checkState(st).some((e) => e.startsWith(key + ':')), key + ' corruption must be detected');
  }
  st[key] = saved;
}
// Rebuild missing and incorrect caches on load; old format-1 saves remain usable.
for (const corrupt of [false, true]) {
  const saved = Sim.save(st);
  if (corrupt) { saved.state.living = [999]; saved.state.liveHouseholds = [999]; }
  else { delete saved.state.living; delete saved.state.liveHouseholds; }
  const back = Sim.load(make().w, JSON.parse(JSON.stringify(saved)));
  compare(back); assert.deepStrictEqual(checkState(back), []);
}
// Two mothers giving birth in the same walk both die in childbed; neither the second mother nor a birth is skipped.
const mothers = st.pawns.filter((p) => p.sex === 'f' && Sim.spouseOf(st, p.id) !== null).slice(0, 2);
assert.strictEqual(mothers.length, 2);
for (const m of mothers) { m.pregnantUntil = st.t; m.pregnantBy = Sim.spouseOf(st, m.id); }
const n = st.pawns.length; st.rng.births.fix = 0;
VB['sim/births'].dailyBirths(st); delete st.rng.births.fix;
assert.strictEqual(st.pawns.length, n + 2);
assert(mothers.every((m) => !m.alive)); compare(st);
assert.deepStrictEqual(checkState(st), []);
VB.resetCounts(); Sim.advance(st, 0.1);
assert.strictEqual(VB.count.walkStep, st.living.length, 'a step counts living agents, excluding the dead records');
// The daily mortality walk may remove every current id, including adjacent ids, without skipping anyone.
const dying = make(); for (const p of dying.pawns) p.health = 0;
VB['sim/lifecycle'].dailyLife(dying, Sim.cal(dying.t));
assert.strictEqual(dying.living.length, 0); compare(dying);
// Orphan care dissolves adjacent households in the same walk. Historical records remain available.
const orphans = make();
for (const p of orphans.pawns) { p.age = 8; p.born = orphans.t - 8 * Sim.YEAR; }
orphans.demand = [];
VB['sim/service'].careForOrphans(orphans);
assert.strictEqual(orphans.liveHouseholds.length, 0); compare(orphans);
assert.strictEqual(orphans.households.length, 3);
console.log('living indexes ok: deaths, childbirth, adjacent dissolutions, corruption and old saves');
