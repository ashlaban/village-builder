// VB-1602: nobody leaves a small child alone. On a tiny state: a household of two adults and a child of 3; the first adult lodges away,
// the second is refused with the reason (the last one at home with a child under 7), is no gift's carrier, and the child is not alone
// at the day's end; with the first home again the second may go.
const assert = require('assert'),
  VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { issue } = VB['sim/commands'],
  Stores = VB['sim/stores'];
const { DAY, YEAR } = VB['sim/rules'],
  { carrierOf } = VB['sim/exchange'],
  { age, mindsWhy } = VB['sim/records'];
const minds = (s, id) => mindsWhy(s, id) !== null;
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const st = tinyState(tinyWorld(Array(9).fill('.'.repeat(60)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [3, 4] }], { seed: 3 });
const hh = st.households[0],
  f = st.farmsteads[hh.farmstead];
assert.strictEqual(hh.members.length, 3, 'a household of three');
const [x, y] = [hh.holder, hh.members.find((id) => id !== hh.holder)],
  kid = hh.members.find((id) => id !== x && id !== y);
// a test's writes: two adults of 30 and a child of 3
for (const [id, years] of [
  [x, 30],
  [y, 30],
  [kid, 3],
]) {
  st.pawns[id].born = st.t - (years + 0.5) * YEAR;
  st.pawns[id].age = years;
}
assert.ok(age(st, st.pawns[kid]) === 3 && age(st, st.pawns[x]) === 30, 'two adults and a child of 3');
const alone = () =>
  !hh.members.some((id) => st.pawns[id].alive && st.agents[id].away === undefined && age(st, st.pawns[id]) >= 7) &&
  hh.members.some((id) => st.pawns[id].alive && st.agents[id].away === undefined && age(st, st.pawns[id]) < 7);
to(st, 5); // indoors, at their house: a lodge packs from its door
Stores.put(st, hh, 'grain', 60, 'harvest', { barley: 60 });
const site = tileAt(st.w, (f.house % st.w.COLS) + 24, Math.floor(f.house / st.w.COLS));
const lodge = (id) => issue(st, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days: 3 }, source: 'player' });
assert.ok(!minds(st, x) && !minds(st, y) && !minds(st, kid), 'with two adults at home neither minds the child alone');
assert.ok(carrierOf(st, hh) >= 0, 'one of them may carry a gift');
assert.strictEqual(lodge(x), true, 'the first adult lodges away');
assert.ok(st.agents[x].away !== undefined, 'its stay is open');
assert.ok(minds(st, y), 'the second is the last one at home with the child');
const why = lodge(y);
assert.ok(typeof why === 'string' && /child under 7/.test(why), `and is refused, and the reason names the child: ${why}`);
assert.strictEqual(carrierOf(st, hh), -1, 'nor does it carry a gift away');
assert.ok(st.agents[y].away === undefined, 'no stay is opened for it');
to(st, 1);
assert.ok(!alone(), "the child is not alone at the day's end");
assert.deepStrictEqual(checkState(st), [], 'invariants');
// the child grown to 7 needs no minding: the second may go
st.pawns[kid].born = st.t - 7.5 * YEAR; // a test's write
st.pawns[kid].age = 7;
assert.ok(!minds(st, y), 'a child of 7 is not minded');
to(st, 5);
assert.strictEqual(lodge(y), true, 'and the second adult may lodge away');
console.log('minding ok');
