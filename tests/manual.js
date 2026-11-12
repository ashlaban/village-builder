// The manual scenario (the archipelago editor's Settlement tool): places laid in their order, a village by the generator about a tile and a
// household on a very tile; households close to a village's centre are of that village, a far one is a village of its own; a place with no
// room names itself; a field, a meadow and a way are laid where they were placed; the state is sound and runs; and a world kept before seeding and put back seeds the same run again.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Cover = VB['gen/cover'], { SETTLE } = VB['sim/rules'], { hexSteps } = VB['sim/hex'];
const { checkState } = require('./lib/invariants.js');
const world = () => { const g = G.generate(42, { cols: 120, rows: 85 }); let r; while (!(r = g.next()).done); return r.value; };
const w = world(), probe = Sim.seed(world(), 42, 'populous'); // a populous run on the same land shows where villages and houses can stand
const centre = probe.villages[0].center, far = probe.villages.find((v) => hexSteps(w, v.center, centre) > 3 * SETTLE.centreApart);
assert(far, 'the test island has two villages well apart');
// free farmable tiles by distance from a tile, as the probe left them: house sites for households placed by hand
const sites = (from, lo, hi) => { const out = []; for (let i = 0; i < w.N; i++) { const d = hexSteps(w, from, i);
  if (d >= lo && d <= hi && VB['sim/rules'].farmable(w, i) && !w.river[i]) out.push(i); } return out; };
const kept = Cover.keep(w);
const tryPlaces = (places) => { Cover.restore(w, kept); try { return Sim.seed(w, 42, 'manual', places); } catch (e) { return e; } };

// a village of up to five farms, laid by the generator
let st = tryPlaces([{ village: centre, farms: 5 }]);
assert(!(st instanceof Error), `a village on a village site: ${st.message}`);
assert.strictEqual(st.scenario, 'manual'); assert.strictEqual(st.villages.length, 1); const laid = st.villages[0].farmsteads.length; assert(laid >= 3 && laid <= 5, `the generator lays the farms that fit: ${laid}`);
assert(st.villages[0].green && st.pawns.length >= 10 && st.households.every((h) => h.grain.barley > 0));
assert.deepStrictEqual(checkState(st), []);

// households on chosen tiles: one near the village joins it; two far ones, close to each other, are one village of their own
const place = (base, cands) => { for (const t of cands) { const s = tryPlaces([...base, { farm: t }]); if (!(s instanceof Error)) return t; } return -1; };
const base = [{ village: centre, farms: 5 }];
const near = place(base, sites(centre, 5, SETTLE.centreApart));
assert(near >= 0, 'a household finds a site near the village');
const a = place([...base, { farm: near }], sites(far.center, 0, 3));
assert(a >= 0, 'a household finds a site far from the village');
const b = place([...base, { farm: near }, { farm: a }], sites(a, 3, 6));
assert(b >= 0, 'a second household finds a site close to the first');
const places = [...base, { farm: near }, { farm: a }, { farm: b }];
st = tryPlaces(places);
const farmOn = (t) => st.farmsteads.find((f) => f.house === t);
assert(farmOn(near) && farmOn(a) && farmOn(b), 'each household stands on its very tile');
assert.strictEqual(farmOn(near).village, 0, 'a household close to a village is of that village');
assert.strictEqual(st.villages[0].farmsteads.length, laid + 1);
assert(farmOn(a).village !== 0 && farmOn(a).village === farmOn(b).village, 'two close households far from any village are one village');
assert.strictEqual(st.villages.length, 2); assert(!st.villages[1].green, 'a village of households placed by hand has no green');
assert(farmOn(a).fields.length >= 3 && st.households[farmOn(a).household].members.length >= 2);
assert.deepStrictEqual(checkState(st), []);

// a field and a meadow on chosen tiles are of the farm nearest; a way is worn where it was laid; far from any farm they find no room
const free = (from, lo, hi, ok) => sites(from, lo, hi).filter((t) => !st.used.has(t) && ok(t));
const withPlace = (p) => tryPlaces([...places, p]);
const fieldT = free(a, 2, 4, (t) => !(withPlace({ field: t }) instanceof Error))[0];
assert(fieldT !== undefined, 'a field finds a tile by the household');
const meadowT = free(a, 2, 5, (t) => t !== fieldT && !(tryPlaces([...places, { field: fieldT }, { meadow: t }]) instanceof Error))[0];
assert(meadowT !== undefined, 'a meadow finds a tile by the household');
const way = VB['sim/routes'].findRoute(w, near, a, 1e9);
assert(way && way.length > 5, 'a way is found over the unsettled land from one house to the other');
const all = [...places, { field: fieldT }, { meadow: meadowT }, { way, stage: 3 }];
st = tryPlaces(all);
assert(!(st instanceof Error), `fields, meadows and ways: ${st.message}`);
const owner = st.farmsteads.find((f) => f.fields.some((fd) => fd.tile === fieldT));
assert(owner && (owner.house === a || owner.house === b), 'the field is of a farm near it');
assert(st.farmsteads.some((f) => f.meadows.some((m) => m.tile === meadowT) && (f.house === a || f.house === b)), 'the meadow is of a farm near it');
const worn = way.filter((t) => st.w.worn[t] === 3).length;
assert(worn > way.length / 2 && way.every((t) => st.w.dev[t] || st.w.worn[t] === 3), `the way is a lane where nothing is built: ${worn} of ${way.length}`);
assert.deepStrictEqual(checkState(st), []);
Sim.advance(st, 24 * 20); // and the run goes on, sound; the world is put back by the next seeding
assert.deepStrictEqual(checkState(st), []);
const lonely = sites(a, 3 * SETTLE.centreApart, 9 * SETTLE.centreApart).find((t) => st.farmsteads.every((f) => hexSteps(w, f.house, t) > 8));
if (lonely !== undefined) for (const p of [{ field: lonely }, { meadow: lonely }]) assert.strictEqual(withPlace(p).place, places.length, 'no farm near enough');
assert(tryPlaces([{ way, stage: 3 }]) instanceof Error, 'a way alone is no settlement');
st = tryPlaces(places);

// households built by hand: a couple; an empty farm peopled one by one, its first adult the holder; a servant added to a family; an empty
// farm and a ruin with no one; a green and well for the village of households placed by hand
const built = [...base, { farm: near }, { farm: a, fill: 'couple' }, { farm: b, fill: 'empty' }, { pawn: b, sex: 'f', age: 40 }, { pawn: b, sex: 'm', age: 12 },
  { pawn: near, sex: 'm', age: 17, servant: true }];
st = tryPlaces(built);
assert(!(st instanceof Error), `households built by hand: ${st.message}`);
const hhOf = (t) => st.households[farmOn(t).household], ages = (t) => hhOf(t).members.map((id) => st.pawns[id].age).sort((x, y) => x - y);
assert.strictEqual(hhOf(a).members.length, 2, 'a couple'); assert(st.unions.some((u) => hhOf(a).members.includes(u.a) && hhOf(a).members.includes(u.b)));
assert.deepStrictEqual(ages(b), [12, 40]); assert.strictEqual(st.pawns[hhOf(b).holder].age, 40, 'the first adult placed holds the farm');
assert(hhOf(near).members.some((id) => st.pawns[id].servant && st.pawns[id].age === 17), 'a servant joins the family');
assert.deepStrictEqual(checkState(st), []);
Sim.advance(st, 24 * 30); assert.deepStrictEqual(checkState(st), []);
const greenT = sites(a, 1, 3).find((t) => !(tryPlaces([...base, { farm: a, fill: 'couple' }, { farm: b, fill: 'empty' }, { green: t }]) instanceof Error));
assert(greenT !== undefined, 'a green finds a tile by the households');
st = tryPlaces([...base, { farm: a, fill: 'couple' }, { farm: b, fill: 'empty' }, { green: greenT }]);
const vb = st.villages[farmOn(a).village];
assert(vb.green && vb.well && vb.center === greenT, 'the green is the village\'s centre, with its well');
assert(farmOn(b).household === null && farmOn(b).state === 'derelict' && farmOn(b).emptySince < 0, 'a farm with no one stands empty');
assert.deepStrictEqual(checkState(st), []);
Sim.advance(st, 24 * 30); assert.deepStrictEqual(checkState(st), []);
st = tryPlaces([...base, { farm: a, fill: 'ruin' }]);
assert(farmOn(a).state === 'ruin' && farmOn(a).condition < 0.2 && farmOn(a).household === null, 'a ruin');
assert.deepStrictEqual(checkState(st), []);
for (const [bad, k] of [[[...base, { farm: a, fill: 'empty' }, { pawn: a, sex: 'm', age: 9 }], 2], [[...base, { pawn: a, sex: 'm', age: 30 }], 1],
  [[...base, { farm: a, fill: 'ruin' }, { pawn: a, sex: 'm', age: 30 }], 2], [[...base, { green: centre }], 1]]) {
  const e = tryPlaces(bad); assert(e instanceof Error && e.place === k, `refused, place ${k}: ${e.message || 'seeded'}`);
}
st = tryPlaces([{ farm: a, fill: 'empty' }]); // houses with no one are a run too, for the editor to show: Play waits for someone
assert(!(st instanceof Error) && st.households.length === 0 && st.farmsteads.length === 1); assert.deepStrictEqual(checkState(st), []);
st = tryPlaces(places);

// no room: the place says which it is; nothing placed is refused
const sea = w.water.indexOf(1);
for (const [bad, k] of [[[...places, { farm: sea }], 4], [[{ village: sea, farms: 3 }], 0], [[...places, { farm: near }], 4]]) {
  const e = tryPlaces(bad); assert(e instanceof Error && e.place === k, `no room is reported for place ${k}: ${e.message || 'seeded'}`);
}
assert(tryPlaces([]) instanceof Error);

// a world put back seeds the same run; and that run goes on, sound
const one = JSON.stringify(Sim.save(tryPlaces(places))), two = JSON.stringify(Sim.save(tryPlaces(places)));
assert.strictEqual(one, two, 'a world kept and put back seeds the same run');
const fresh = world(); // and the same as on a world never seeded before
assert.strictEqual(JSON.stringify(Sim.save(Sim.seed(fresh, 42, 'manual', places))), one, 'a world put back is as a world raised anew');
st = tryPlaces(places);
Sim.advance(st, 24 * 40);
assert.deepStrictEqual(checkState(st), []);
console.log(`manual: a village of ${laid} and 3 households placed by hand, ${st.pawns.length} people in ${st.villages.length} villages; no room named; a world put back seeds the same run`);
