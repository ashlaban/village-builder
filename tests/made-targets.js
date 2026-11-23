// VB-698: a target on every stored good a household makes. On a tiny world at seed 7 with herds: a review compiles the head's target on
// each made good to its household's need (clay and bog iron DIG.stock, ale BREW.stock, a working quern, the dried fish wanted, the
// barrels a pit's household keeps; no cap of their own on butter, salt meat and peat); the head's verb sets one within its bounds, at
// once, and its makers read it (digging, salting, hewing a quern); cleared, the need again; a save carries the choices.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { HERD, BREW, cal } = VB['sim/rules'], P = VB['sim/plans'], Targets = VB['sim/targets'];
const Dig = VB['sim/dig'], Drying = VB['sim/drying'], Quern = VB['sim/quern'];
const { byreJobs } = VB['sim/byre'], { addFood } = VB['sim/larder'];
const map = Array.from({ length: 12 }, () => '.'.repeat(20));
const st = tinyState(tinyWorld(map), [{ at: [9, 6], farms: 3, sizes: [8, 3, 6] }], { seed: 7, herds: true });
const hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = st.plans.households.get(hh.id);
const sound = (label) => { Sim.refreshRoles(st); assert.deepStrictEqual(checkState(st).slice(0, 3), [], `${label}: invariants`); };
P.reviewed(st, plan, cal(st.t));
const G = plan.targets.goods;

// the registry: the goods with a maker, each declared once by its maker
const goods = Targets.madeGoods().sort();
assert.deepStrictEqual(goods, ['ale', 'bogOre', 'butter', 'clay', 'dried fish', 'peat', 'quern', 'salt meat', 'tar'], 'the made goods');
// the default: the household's need, as its rule sets it
assert.deepStrictEqual(
  [G.clay, G.bogOre, G.ale, G.quern, G['dried fish'], G.tar, G.butter, G['salt meat'], G.peat],
  [Dig.DIG.stock, Dig.DIG.stock, BREW.stock, 1, Drying.wanted(st, hh), 1, Infinity, Infinity, Infinity],
  'a review compiles each target to its need');
for (const g of goods) assert.strictEqual(Targets.target(st, hh, g), G[g], `${g}: the makers read the compiled target`);
sound('compiled');

// the verb: within bounds, whole where counted whole
assert.strictEqual(Sim.inhabit(st, hh.holder), true);
const hands = Targets.hands(st, hh), spare = hands * Targets.TARGET.spareHours;
assert.deepStrictEqual(Targets.bounds(st, hh, 'clay'), [0, Dig.DIG.stock + Math.floor(spare / Dig.DIG.hours)], 'clay: the need and the spare hours');
assert.deepStrictEqual(Targets.bounds(st, hh, 'tar'), [0, 1], 'tar: only what it keeps, with no pit');
assert.deepStrictEqual(Targets.bounds(st, hh, 'quern'), [0, 1], 'a quern: none beyond its own');
let n = 0;
const refused = (got, re, label) => { assert.ok(typeof got === 'string' && re.test(got), `${label}: refused with ${JSON.stringify(got)}`); n++; };
refused(Sim.head(st, 'target', { store: 'tar', n: 2 }), /tar must be from 0 to 1/, 'a barrel beyond what it keeps with no pit');
refused(Sim.head(st, 'target', { store: 'clay', n: 1.5 }), /whole number/, 'half a load of clay');
refused(Sim.head(st, 'target', { store: 'clay', n: -1 }), /clay must be from 0/, 'below none');
refused(Sim.head(st, 'target', { store: 'quern', n: 2 }), /quern must be from 0 to 1/, 'a second quern');
assert.strictEqual(G.clay, Dig.DIG.stock, 'refusals change nothing');

// digging reads the target: clay beyond the stock it kept, and none at a target of 0
st.households[0].clay = Dig.DIG.stock; // lint-allow: owner a test sets the store
assert.ok(!Dig.wants(st, hh, 'clay'), 'at its stock it digs no more clay');
assert.strictEqual(Sim.head(st, 'target', { store: 'clay', n: Dig.DIG.stock + 2 }), true);
assert.ok(G.clay === Dig.DIG.stock + 2 && Dig.wants(st, hh, 'clay'), 'a target above it: it digs on, at once');
assert.strictEqual(Sim.head(st, 'target', { store: 'clay', n: 0 }), true);
st.households[0].clay = 0; // lint-allow: owner a test sets the store
assert.ok(!Dig.wants(st, hh, 'clay'), 'a target of none: it digs none');

// salting reads the target: fresh meat is salted while the salt meat is below it
addFood(st, hh, 'meat', 10, HERD.freshDays);
const salts = () => byreJobs(st, hh, cal(st.t)).some((j) => j[1] === 'salt');
assert.ok(salts(), 'fresh meat is salted, with no cap of its own');
assert.strictEqual(Sim.head(st, 'target', { store: 'salt meat', n: 0 }), true);
assert.ok(!salts(), 'none at a target of none');

// a quern: a target of none lets it wear out; the need again hews one where the ground gives its stone
st.households[0].quern = null; // lint-allow: owner a test wears the quern out
st.households[0].stone = 0; // lint-allow: owner a test empties the heap
assert.strictEqual(Quern.wantsStone(st, hh), Quern.canHew(st, hh), 'with none working, a stone for a quern where it can be hewn');
assert.strictEqual(Sim.head(st, 'target', { store: 'quern', n: 0 }), true);
assert.strictEqual(Quern.wantsStone(st, hh), false, 'none at a target of none');

// ale beyond its stock; the page's view of a good
assert.strictEqual(Sim.head(st, 'target', { store: 'ale', n: 3 }), true);
const V = Sim.headView(st, hh.id).goods;
assert.deepStrictEqual(V.ale, { held: 0, now: 3, custom: BREW.stock, chosen: 3, bounds: [0, BREW.stock + Math.floor(spare / BREW.hours)], unit: 'barrel', placed: 0 },
  'the page reads the held stock, the target, the custom\'s, the choice and the bounds');
assert.strictEqual(V.butter.now, Infinity, 'butter: all the milk gives');
sound('chosen');
{ // a save carries the choices and the compiled targets
  const st2 = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
  assert.deepStrictEqual(Sim.headView(st2, hh.id), Sim.headView(st, hh.id), 'a loaded run holds the head\'s targets on its goods');
}
// cleared: the need again, at once
assert.strictEqual(Sim.head(st, 'target', { store: 'ale', n: null }), true);
assert.strictEqual(G.ale, BREW.stock, 'cleared, the need again');
sound('cleared');
console.log(`made-targets ok: ${goods.length} made goods compiled to their need; ${n} refusals; clay, salt meat, a quern and ale set and read by their makers; a save holds them`);
