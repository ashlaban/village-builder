// Nobody is sent to a home over the sea (VB-436; design.md, Between villages, Over the sea): on two islands, the move verb refuses a home
// with no way by land and says why; the route check answers without counting a fallback; an orphaned farm with no household by land keeps
// its children (QUESTION_ARCHIVE.md, VB-329, question 2), while one with a household by land goes to it.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { tinyWorld, tinyState } = require('./lib/tiny.js');
const { issue } = VB['sim/commands'], { hasRoute } = VB['sim/routes'], { byLand } = VB['sim/villagehours'];
// two islands, a channel of sea between them: two farms on the west, one on the east
const row = '.'.repeat(16) + '~~~' + '.'.repeat(13);
const make = () => tinyState(tinyWorld(Array(20).fill(row)), [{ at: [7, 10], farms: 2, sizes: [6, 5] }, { at: [26, 10], farms: 1, sizes: [5] }], { seed: 4 });
const st = make();
const vOf = (h) => st.farmsteads[h.farmstead].village;
const [W1, W2] = st.households.filter((h) => vOf(h) === 0), E = st.households.find((h) => vOf(h) === 1);
assert(W1 && W2 && E && !byLand(st, 0, 1), 'two villages with no way by land between them');
// the route check: none over the sea, one by land, and no fallback counted for asking
const west = st.farmsteads[W1.farmstead].house, east = st.farmsteads[E.farmstead].house;
assert(!hasRoute(st, west, east) && hasRoute(st, west, st.farmsteads[W2.farmstead].house));
assert.strictEqual(st.routeFallbacks, 0, 'a question counted as a fallback walk');
// the move verb: a home over the sea is refused with its reason, and counted; one by land is not
const id = W1.members.find((m) => st.pawns[m].alive && st.pawns[m].household === W1.id), n = VB.count.moveNoRoute;
const why = issue(st, { actor: id, verb: 'move', target: E.id, args: { reason: 'care' }, source: 'help' });
assert(typeof why === 'string' && /no way by land/.test(why) && st.pawns[id].household === W1.id, `moved over the sea: ${why}`);
assert.strictEqual(VB.count.moveNoRoute, n + 1);
assert.strictEqual(issue(st, { actor: id, verb: 'move', target: W2.id, args: { reason: 'care' }, source: 'help' }), true);
// orphans: every member a child, and nobody waiting for land to come as guardian
const orphan = (s, hh) => { for (const m of hh.members) { s.pawns[m].age = 8; s.pawns[m].born = s.t - 8 * Sim.YEAR; } };
{
  const s = make(), e = s.households.find((h) => s.farmsteads[h.farmstead].village === 1);
  orphan(s, e); s.demand = [];
  VB['sim/service'].careForOrphans(s);
  assert(!e.dissolved && e.members.length > 0, 'the island farm with no household by land was emptied');
  assert(s.record.some((r) => r.kind === 'stayed' && r.pawn === e.holder), 'the stay is not on the record');
  assert(e.members.every((m) => s.pawns[m].household === e.id));
}
{
  const s = make(), w = s.households.find((h) => s.farmsteads[h.farmstead].village === 0);
  const kids = [...w.members];
  orphan(s, w); s.demand = [];
  VB['sim/service'].careForOrphans(s);
  assert(w.dissolved, 'the farm with a household by land did not empty');
  for (const m of kids) {
    const h = s.pawns[m].household;
    assert(h !== null && !s.households[h].dissolved && s.farmsteads[s.households[h].farmstead].village === 0, `child ${m} went over the sea`);
  }
}
console.log('over the sea ok: the move verb refuses a home with no way by land, the route check counts no fallback, island orphans stay');
