// VB-766: a household's crowding, the people within CROWD.steps of its house, and its death.hazard factor, on a constructed state
const assert = require('assert');
const VB = require('../src/load.js'), Cr = VB['sim/crowding'], { CROWD } = VB['sim/rules'];
const { tinyWorld, tileAt } = require('./lib/tiny.js');
const w = tinyWorld(Array.from({ length: 12 }, () => '.'.repeat(14)));
// the centre house, its six neighbours, and three of the ring beyond: every one within 2 steps of the centre
const c = tileAt(w, 6, 6), ring = [];
for (let d = 0; d < 6; d++) ring.push(w.nb[c * 6 + d]);
const outer = [w.nb[ring[0] * 6], w.nb[ring[2] * 6 + 2], w.nb[ring[4] * 6 + 4]];
const make = (houses, people) => {
  const st = { w, farmsteads: [], households: [], liveHouseholds: [] };
  houses.forEach((house, i) => {
    st.farmsteads.push({ id: i, house, household: i });
    st.households.push({ id: i, farmstead: i, members: Array.from({ length: people }, (_, k) => i * 100 + k), dissolved: false });
  });
  Cr.rebuild(st);
  return st;
};
const all = [c, ...ring, ...outer], close = (st) => assert.ok(Cr.fresh(st, 0) === st.crowdN[0], 'compiled equals fresh');
const ten = make(all, 5);
assert.strictEqual(ten.crowdN[0], 50);
assert.strictEqual(+ten.crowd[0].toFixed(2), 1.49, 'ten houses of five give 1.49');
close(ten);
const four = make(all.slice(0, 4), 5);
assert.strictEqual(four.crowd[0], 1, 'four give 1');
const many = make(all, 40);
assert.strictEqual(many.crowd[0], CROWD.max, 'the factor never passes the max');
// a house far off does not count; a house left lowers its neighbours' factor at once
const far = make([...all, tileAt(w, 0, 0)], 5);
assert.strictEqual(far.crowdN[0], 50, 'a far house is not within 2 steps');
const st = make(all, 5), before = st.crowd[0];
const left = st.households[9];
st.farmsteads[9].household = null;
left.dissolved = true;
Cr.moved(st, left, -left.members.length);
left.members = [];
Cr.ended(st, left);
assert.ok(st.crowd[0] < before && st.crowdN[0] === 45, 'a house left lowers its neighbours');
close(st);
// founded: a new household counts its neighbours and they count it
st.farmsteads.push({ id: 10, house: c, household: 10 });
const hh = { id: 10, farmstead: 10, members: [1000, 1001], dissolved: false };
st.households.push(hh);
Cr.founded(st, hh);
assert.strictEqual(st.crowdN[10], 47);
assert.strictEqual(st.crowdN[0], 47);
// explain names it
assert.ok(/crowded: 47 people within 2 steps/.test(Cr.note(st, { household: 0 })));
console.log('crowding ok');
