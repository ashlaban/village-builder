// @suite fast
// VB-1240: a small child moved to a new home within a day's walk does not walk there alone. On a tiny state: a child of 3 and a grown
// of 30 move to another household of the village; the grown fetches the child (the verb fetchChild) and they walk home together. A child
// moved first, before any grown of its new household, waits where it is; the first grown to join fetches it. A child of 3 fetches no one.
const assert = require('assert'),
  VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { issue } = VB['sim/commands'];
const { DAY, YEAR } = VB['sim/rules'],
  { placeOf, tileAt } = VB['sim/pose'];
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const tile = (st, id) => tileAt(st, ...placeOf(st, st.agents[id]));

function run(childFirst) {
  const st = tinyState(tinyWorld(Array(9).fill('.'.repeat(60)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [3, 1] }], {
    seed: 3,
  });
  const [A, B] = st.households;
  assert.strictEqual(A.members.length, 3, 'a household of three');
  const grown = A.holder,
    kid = A.members.find((id) => id !== grown),
    third = A.members.find((id) => id !== grown && id !== kid);
  // a test's writes: a grown of 30 and a child of 3; the third of 20 stays
  for (const [id, years] of [
    [grown, 30],
    [kid, 3],
    [third, 20],
  ]) {
    st.pawns[id].born = st.t - (years + 0.5) * YEAR;
    st.pawns[id].age = years;
  }
  to(st, 9); // the working day, both outdoors or in at their house
  const home = st.farmsteads[B.farmstead].house;
  const move = (id) => issue(st, { actor: id, verb: 'move', target: B.id, args: { reason: 'service' }, source: 'debug' });
  assert.match(String(issue(st, { actor: kid, verb: 'fetchChild', target: grown, source: 'debug' })), /under 7 fetches no one|not of/);
  if (childFirst) {
    for (const id of B.members) {
      st.pawns[id].born = st.t - 5.5 * YEAR; // a test's write: the household moved to has no grown of its own
      st.pawns[id].age = 5;
    }
    assert.strictEqual(move(kid), true);
    assert.strictEqual(st.agents[kid].awaits, -1, 'moved first, the child waits for a grown of its household');
    assert.strictEqual(move(grown), true);
  } else {
    assert.strictEqual(move(grown), true);
    assert.strictEqual(move(kid), true);
  }
  assert.ok(st.agents[grown].fetching, 'the grown fetches the child');
  let apart = 0;
  for (let h = 0; h < 12 && !(st.agents[kid].inside && tile(st, kid) === home); h++) {
    Sim.advance(st, 1);
    const [ax, ay] = placeOf(st, st.agents[kid]),
      [bx, by] = placeOf(st, st.agents[grown]);
    if (!st.agents[kid].inside && Math.hypot(ax - bx, ay - by) > 30) apart++;
  }
  assert.ok(st.agents[kid].inside && tile(st, kid) === home, 'the child is home');
  assert.strictEqual(apart, 0, 'the child walked with the grown');
  assert.strictEqual(st.agents[kid].awaits, undefined, 'the child awaits nobody once led');
  to(st, 20);
  assert.strictEqual(st.agents[grown].fetching, undefined, 'home, the fetch is over');
  checkState(st);
}
run(false);
run(true);
console.log('fetchchild: ok');
