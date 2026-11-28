// @suite fast
// VB-1693 (from VB-1602): a dependant's charge. On a tiny state: a household of two adults and a child of 3; the child is in the charge of
// a named living minder; the first adult lodges away; the second, the last keeper at home, weighs what its going costs the child and is
// no gift's carrier, so the child is not alone at the day's end; yet no verb refuses it (the player may lodge it away); and at the
// minder's death the charge passes at once to the other adult.
const assert = require('assert'),
  VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { issue } = VB['sim/commands'],
  Stores = VB['sim/stores'];
const { DAY, YEAR } = VB['sim/rules'],
  { carrierOf } = VB['sim/exchange'],
  { killPawn } = VB['sim/lifecycle'],
  { age, leaveCost, leaves, thirstLoss } = VB['sim/records'];
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const st = tinyState(tinyWorld(Array(9).fill('.'.repeat(60)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [3, 4] }], { seed: 1 }); // seed 1: a farmer, his wife and a small child (VB-1951 moved the draws)
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
VB['sim/records'].nameAll(st); // the test aged them after the seeding named the charges
const mother = st.pawns[kid].mother;
assert.ok([x, y].includes(st.pawns[kid].minder), `the child is in the charge of one of them: ${st.pawns[kid].minder}`);
if ([x, y].includes(mother)) assert.strictEqual(st.pawns[kid].minder, mother, 'by custom its mother');
const alone = () =>
  !hh.members.some((id) => st.pawns[id].alive && st.agents[id].away === undefined && age(st, st.pawns[id]) >= 7) &&
  hh.members.some((id) => st.pawns[id].alive && st.agents[id].away === undefined && age(st, st.pawns[id]) < 7);
to(st, 5); // indoors, at their house: a lodge packs from its door
Stores.put(st, hh, 'grain', 60, 'harvest', { barley: 60 });
const site = tileAt(st.w, (f.house % st.w.COLS) + 24, Math.floor(f.house / st.w.COLS));
const lodge = (id) => issue(st, { actor: id, verb: 'lodge', target: site, args: { why: 'work', days: 3 }, source: 'player' });
assert.ok(leaveCost(st, x) === 0 && leaveCost(st, y) === 0, "with two adults at home neither's going costs the child");
assert.ok(carrierOf(st, hh) >= 0, 'one of them may carry a gift');
assert.strictEqual(lodge(x), true, 'the first adult lodges away');
assert.ok(st.agents[x].away !== undefined, 'its stay is open');
const cost = leaveCost(st, y);
assert.strictEqual(cost, thirstLoss(st, st.pawns[kid]), "the second's going would cost the child its day's water: " + cost);
assert.ok(!leaves(st, y) && leaves(st, y, cost), 'it weighs that: it stays for a going that brings the child nothing, goes for more');
assert.strictEqual(carrierOf(st, hh), -1, 'so it carries no gift away');
to(st, 1);
assert.ok(!alone(), "the child is not alone at the day's end");
assert.deepStrictEqual(checkState(st), [], 'invariants');
// no verb's check refuses a minder for its charge alone: the player may lodge the second away too
to(st, 5);
assert.strictEqual(lodge(y), true, 'the second adult may lodge away: the verb does not forbid it');
// the minder dies: the charge passes at once to the other adult (Nothing is left to no one)
const m = st.pawns[kid].minder,
  other = m === x ? y : x;
killPawn(st, m, 'illness');
assert.strictEqual(st.pawns[kid].minder, other, 'at the minder\'s death the charge passes at once to the other adult');
assert.deepStrictEqual(checkState(st), [], 'invariants after the death');
console.log('minding ok');
