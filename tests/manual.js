// The manual scenario (the archipelago editor's Settlement tool): places laid in their order, a village by the generator about a tile and a
// household on a very tile; households close to a village's centre are of that village, a far one is a village of its own; a place with no
// room names itself; the state is sound and runs; and a world kept before seeding and put back seeds the same run again.
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
assert(st.villages[0].green && st.pawns.length >= 10 && st.households.every((h) => h.grain > 0));
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
