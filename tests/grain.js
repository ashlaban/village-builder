// Grain held by crop (VB-347): a household's and a village's grain in subtypes, moved only through sim/stores. The table holds barley alone,
// so this test loads the modules with a second crop, rye (barley's numbers), added to CROPS before sim/stores reads it; a run of the game
// never sees it. Takes fall on each crop in proportion to what is held, a crop's take on that crop, gifts and moves keep the proportion,
// the cook and the meal take unreserved grain whatever its crop, spoiling falls on each crop, and an old save's grain loads as barley.
const assert = require('assert'), fs = require('fs'), path = require('path');
for (const f of JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'manifest.json'), 'utf8'))) {
  require('../src/' + f);
  if (f === 'sim/rules.js') { const { CROPS } = globalThis.VB['sim/rules']; CROPS.rye = { ...CROPS.barley }; }
}
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stores'], { CROPS } = VB['sim/rules'], { issue } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const near = (x, y, what) => assert(Math.abs(x - y) < 1e-9, `${what}: ${x}, expected ${y}`);
const st = tinyState(tinyWorld(Array(12).fill('.'.repeat(20))), [{ at: [8, 6], farms: 3 }], { seed: 7 });
const [a, b, c] = st.households, v = st.villages[0];
assert.deepStrictEqual(S.CROP_LIST, ['barley', 'rye']);
for (const h of st.households) S.start(st, h, {});

// the sum, one crop, a crop's take, a take of any crop
S.start(st, a, { barley: 30, rye: 10 }); near(S.grainOf(a), 40, 'the sum of the crops'); near(S.grainOf(a, 'rye'), 10, 'one crop');
S.spoil(st, a, 8); near(a.grain.barley, 24, 'barley spoils by its share'); near(a.grain.rye, 8, 'rye by its share');
near(a.spoilt, 8, 'the loss counted');
S.take(st, a, S.grainGood('rye'), 3, 'seed'); near(a.grain.rye, 5, 'seed from its own crop'); near(a.grain.barley, 24, 'the other untouched');
near(S.take(st, a, S.grainGood('rye'), 9, 'seed'), 5, 'a crop gives what it holds'); assert.strictEqual(a.grain.rye, 0, 'and none below 0');
S.put(st, a, S.grainGood('rye'), 5, 'thresh'); near(S.grainOf(a), 29, 'put into its crop');
// moves keep the giver's proportion: a share, the village's filling and its gift, a pawn's stake (of no crop: barley)
S.move(st, a, b, 'grain', 29 / 2, 'gift'); near(b.grain.barley, 12, 'a move in the proportion held'); near(b.grain.rye, 2.5, 'of each crop');
near(S.grainOf(a) + S.grainOf(b), 29, 'nothing made or lost');
S.move(st, b, v, 'grain', 14.5, { kind: 'gift', to: 'the village store' }); near(v.grain.rye, 2.5, 'the village store keeps the crops');
const p = st.pawns[c.members[0]];
S.move(st, a, p, 'grain', 2.9, 'share'); near(p.stake, 2.9, 'a stake is one number');
S.move(st, p, c, 'grain', 2.9, 'provisions'); near(c.grain.barley, 2.9, 'a stake goes in as barley'); assert(!c.grain.rye, 'and no rye');
const into = {}; S.take(st, a, 'grain', 2.9, 'provisions', into); near(into.barley + into.rye, 2.9, 'a take tells its crops');
near(into.rye / (into.barley + into.rye), 5 / 29, 'in the proportion held');
// a gift through the verb (the giver's take first, then the receiver's put of the same crops)
S.start(st, a, { barley: 300, rye: 100 }); S.start(st, b, {});
assert.strictEqual(issue(st, { actor: a.holder, verb: 'give', target: b.id, args: { good: 'grain', n: 40 }, source: 'player' }), true, 'the gift is given');
near(b.grain.barley, 30, 'the receiver gets barley'); near(b.grain.rye, 10, 'and rye, as the giver holds them');
near(S.grainOf(a), 360, 'the giver gave 40');
assert(b.ledger.some((e) => e.kind === 'gift' && e.good === 'grain' && Math.abs(e.n - 40) < 1e-9), 'the ledger counts grain whatever its crop');
// the village spoils each crop by its share
const g0 = { ...v.grain }; S.villageDay(st); near(v.grain.rye / v.grain.barley, g0.rye / g0.barley, 'the village store spoils each crop alike');
// the seed reserved by crop: a field under rye reserves rye; the cook and the meal take unreserved grain whatever its crop
const f = st.farmsteads[a.farmstead], plan = VB['sim/plans'].planOf(st, 'household', a.id);
for (const fd of f.fields) { fd.stage = 'harvested'; } f.fields[0].stage = 'stubble'; f.fields[0].crop = 'rye';
S.reserve(st, a, plan, S.grainGood('rye'), 0, 'seed');
const seed = VB['sim/hunger'].seedPer(st, a), held = () =>
  S.reserved(st, a, 'grain') - S.reserved(st, a, S.grainGood('barley')) - S.reserved(st, a, S.grainGood('rye'));
near(S.reserved(st, a, S.grainGood('rye')), seed, 'the rye field\'s seed is rye\'s');
near(S.reserved(st, a, S.grainGood('barley')), 0, 'barley holds no seed for it'); near(held(), 0, 'the sum is the crops\'');
S.start(st, a, { barley: 10, rye: seed });
S.cook(st, a, 'grain', 6); near(a.grain.barley, 4, 'the cook takes the free crop'); near(a.grain.rye, seed, 'and leaves the seed');
S.takeSpare(st, a, 6, 'meal'); near(a.grain.barley, 0, 'the meal\'s spare grain is the free crop'); near(a.grain.rye, seed - 2, 'then what there is');
VB['sim/stores'].release(st, a, plan, S.grainGood('rye'), 'seed'); f.fields[0].crop = 'barley';
// invariants: no crop below 0, the sum is what the readers see
const { checkState } = require('./lib/invariants.js');
const grainErr = checkState(st).filter((e) => /grain/.test(e)); assert.deepStrictEqual(grainErr, [], 'grain invariants');
// an old save: grain one number and reserved as 'grain' loads as barley
const it = VB.gen.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const old = Sim.seed(r.value, 7, 'founders'), n0 = old.households.map((h) => S.grainOf(h));
for (const h of [...old.households, ...old.villages]) h.grain = S.grainOf(h);
for (const pl of old.plans.households.values()) {
  pl.reserved.grain = pl.reserved['grain/barley']; pl.reasons.grain = pl.reasons['grain/barley']; delete pl.reserved['grain/barley'];
    delete pl.reasons['grain/barley'];
}
const data = JSON.parse(JSON.stringify(Sim.save(old)));
const it2 = VB.gen.generate(7, { cols: 120, rows: 85 }); while (!(r = it2.next()).done);
const back = Sim.load(r.value, data);
assert.deepStrictEqual(back.households.map((h) => h.grain), n0.map((n) => ({ barley: n })), 'an old save\'s grain loads as barley');
assert(back.villages.every((x) => x.grain.barley === 0 && Object.keys(x.grain).length === 1), 'and a village\'s');
assert([...back.plans.households.values()].every((pl) => pl.reasons['grain/barley'] === 'seed' && !('grain' in pl.reasons)), 'its seed reserved as barley');
console.log('grain: held by crop; takes, spoiling, moves, gifts, stakes, the cook and the meal by crop; an old save\'s grain loads as barley');
