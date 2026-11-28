// @suite fast
// Dress (VB-363, sim/dress): worn out in DRESS.years in closed form; mended from the household's cloth on its planning day (a child's
// length lasts twice as long); in rags the cold costs DRESS.cold times and standing DRESS.shame.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js');
const D = VB['sim/dress'], { DRESS } = D, Stores = VB['sim/stores'], { YEAR } = VB['sim/rules'];
const st = Sim.seed(island(8), 8, 'populous');
const hh = st.households[st.liveHouseholds.find((id) => st.households[id].farmstead !== null)];
const p = st.pawns[hh.members.find((m) => st.pawns[m].alive && st.pawns[m].role !== 'child')];
const first = st.pawns.filter((q) => q.alive).every((q) => q.dress.worth >= 0.3 && q.dress.worth <= 1);
assert(first, 'the first people start at 0.3 to 1');
p.dress = { worth: 1, at: st.t, grade: 1 };
assert.strictEqual(D.worth(st, p), 1);
st.t += DRESS.years * YEAR;
assert(Math.abs(D.worth(st, p)) < 1e-9 && D.rags(st, p), 'worn to nothing after DRESS.years');
// mending: nothing without cloth, a length with it; the new dress is new
hh.cloth = [0, 0, 0, 0, 0];
assert.strictEqual(D.mend(st, p, hh), false);
hh.cloth = [0, 2, 0, 0, 0];
assert.strictEqual(D.mend(st, p, hh), true);
assert.strictEqual(Stores.heldOf(hh, 'cloth'), 1);
assert(D.worth(st, p) === 1 && !D.rags(st, p));
assert(hh.ledger.some((e) => e.kind === 'dress' && e.good === 'cloth' && e.n === -1), 'through the ledger');
assert.strictEqual(D.mend(st, p, hh), false, 'sound dress is not mended');
// a child's length lasts twice as long
p.role = 'child';
p.dress = { worth: 0, at: st.t, grade: 1 };
assert.strictEqual(D.mend(st, p, hh), true);
st.t += (DRESS.years * YEAR) / 2 + 1;
assert(Math.abs(D.worth(st, p) - 0.75) < 1e-3, 'a child has its dress the longer');
// a person made after the start has no sound dress from nowhere (nothing appears): worn until its household mends it
{
  const R = { pawns: [], living: [], rand: () => 0.5, pickGiven: () => 'A', pickFather: () => 'B', t: 100 };
  const id = VB['sim/records'].person(R, { sex: 'f', age: 0 });
  assert.strictEqual(R.pawns[id].dress.worth, 0, 'a person made later has no dress but what its household gives');
}
console.log('dress ok');
