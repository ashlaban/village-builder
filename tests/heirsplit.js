// @suite fast
// VB-034: land split between heirs, on a constructed farm of 4 fields and 3 grown children (tests/lib/tiny.js). At the handover under
// "split" the heir keeps 2 fields and each sibling owns 1 (sim/ownership's titles, basis `inherited`), worked by the old household for
// half their harvest (the obligation `rent`, paid at the moving round), and the village begins a house by each; the house built, its
// household holds the field as its farm's; a sibling who dies first gives its field back to the farm. The weighting and the parts' floor
// are checked on sim/heirland apportion.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState, setPractice } = require('./lib/tiny.js');
const { checkState, checkCaches } = require('./lib/invariants.js');
const O = VB['sim/ownership'],
  L = VB['sim/heirland'],
  Ob = VB['sim/obligations'],
  Stores = VB['sim/stores'];
const { emit } = VB['sim/events'],
  { newField } = VB['sim/fieldrec'],
  { hexSteps } = VB['sim/hex'];
const { killPawn } = VB['sim/lifecycle'],
  { finishCottage } = VB['sim/cottage'],
  { projectsOf } = VB['sim/projects'];
const { DAY, YEAR, SHARES } = VB['sim/rules'];
const clean = (st, when) => assert.deepStrictEqual([...checkState(st), ...checkCaches(st)], [], `${when}: invariants`);

// the parts: in proportion to the weights by the largest remainders, the heir (first) keeps one at least, a part of none gets no land
assert.deepStrictEqual(
  L.apportion(4, [
    [0, 2],
    [1, 2],
    [2, 2],
  ]),
  [2, 1, 1],
  'three equal heirs of 4 fields',
);
assert.deepStrictEqual(
  L.apportion(4, [
    [0, 2],
    [1, 2],
    [2, 1],
  ]),
  [2, 1, 1],
  "a daughter's half: her 0.8 rounds up first",
);
assert.deepStrictEqual(
  L.apportion(5, [
    [0, 2],
    [1, 1],
    [2, 1],
  ]),
  [3, 1, 1],
  'a son and two daughters at half: 2.5, 1.25, 1.25',
);
assert.deepStrictEqual(
  L.apportion(2, [
    [0, 1],
    [1, 2],
    [2, 2],
  ]),
  [1, 1, 0],
  'the farm keeps a field: taken from a sibling',
);

const st = tinyState(tinyWorld(Array.from({ length: 12 }, () => '................')), [{ at: [7, 6], farms: 2 }], {
  seed: 7,
});
for (const s of st.cenv.settlements) setPractice(st, s.id, { heirCount: 'split', daughterShare: 'equal' });
const f = st.farmsteads[0],
  hh = st.households[f.household],
  v = st.villages[f.village];
// a fourth field, the free open tile nearest the house beyond its yard
const free = [...Array(st.w.N).keys()]
  .filter((t) => !st.used.has(t) && hexSteps(st.w, f.house, t) >= 2 && VB['sim/crops'].openGround(st.w, t))
  .sort((a, b) => hexSteps(st.w, f.house, a) - hexSteps(st.w, f.house, b) || a - b)[0];
st.used.add(free);
f.fields.push(newField(st.w, f.fields.length, free));
O.setOwner(st, free, { type: 'household', id: hh.id });
assert.strictEqual(f.fields.length, 4, 'a farm of 4 fields');
// three grown children: the son 4 the heir, the daughters 3 and 5; the youngest, 2, is not of this family
killPawn(st, 2);
for (const [id, y] of [
  [4, 24],
  [5, 22],
  [3, 20],
]) {
  st.pawns[id].born = st.t - y * YEAR - DAY;
  st.pawns[id].age = y;
}
Stores.put(st, hh, 'grain', 3000, 'harvest', { barley: 3000 });
clean(st, 'constructed');
const heir = 4,
  sibs = [3, 5];
const projects0 = projectsOf(st, 'village', v.id).length;
VB['sim/heirs'].transfer(st, hh, heir, 'retirement');
VB['sim/heirs'].refreshRoles(st);
clean(st, 'split');
// the heir's farm keeps 2 fields of its own; each sibling owns 1, which the old household works for half its harvest
const kept = f.fields.filter((fd) => !st.titles.has(fd.tile));
assert.strictEqual(kept.length, 2, 'the heir keeps 2 fields');
assert.strictEqual(f.fields.length, 4, 'the fields still lie with the farm that works them');
for (const q of sibs) {
  const own = O.holdingsOf(st, { type: 'pawn', id: q }, 'own');
  assert.strictEqual(own.length, 1, `sibling ${q} owns a field`);
  const t = st.titles.get(own[0]);
  assert.deepStrictEqual(t.owner, { type: 'pawn', id: q });
  assert.deepStrictEqual(t.user, { type: 'household', id: hh.id }, 'the old household keeps the use');
  assert.strictEqual(t.basis, 'inherited');
  assert.strictEqual(t.rent, 0.5, 'half the harvest');
  assert.strictEqual(st.owner[own[0]], hh.id + 1, 'worked by the old household');
}
assert.strictEqual(O.fieldsOwned(st, hh.id), 2, 'the share rule counts 2 fields the farm owns');
// a house is begun by each sibling's fields, the village's project
const plots = projectsOf(st, 'village', v.id).filter((p) => p.what === 'plot' && p.split);
assert.strictEqual(projectsOf(st, 'village', v.id).length - projects0, 2, 'two plots begun');
assert.deepStrictEqual(plots.map((p) => p.intended).sort(), [...sibs].sort());
for (const p of plots) {
  assert.strictEqual(p.steps[0].places.length, 1, 'a house only: no field to clear');
  for (const t of p.split)
    assert.ok(hexSteps(st.w, p.steps[0].places[0].tile, t) <= VB['sim/layout'].FIELD_REACH, 'the house by its field');
}
// the rent: sheaves from a sibling's field owe it half; paid at the round from the grain above the reserve, to its stake
const [p3] = plots.filter((p) => p.intended === 3),
  fd3 = f.fields.find((fd) => fd.tile === p3.split[0]);
emit(st, 'sheavesIn', { hh, field: fd3, n: 10 });
emit(st, 'sheavesIn', { hh, field: fd3, n: 6 });
emit(st, 'sheavesIn', { hh, field: kept[0], n: 10 }); // the heir's own: no rent
const rents = Ob.due(st, { kind: 'pawn', id: 3 }, 'creditor', 'rent');
assert.strictEqual(
  rents.reduce((s, o) => s + o.owes.rations, 0),
  8,
  'half of 16 sheaves',
);
assert.strictEqual(Ob.due(st, { kind: 'pawn', id: 5 }, 'creditor', 'rent').length, 0, 'none yet to the other');
const stake0 = st.pawns[3].stake || 0;
L.payRent(st);
assert.strictEqual((st.pawns[3].stake || 0) - stake0, 8, 'paid to the sibling, who has no household of its own');
assert.strictEqual(Ob.due(st, { kind: 'pawn', id: 3 }, 'creditor', 'rent').length, 0, 'met');
clean(st, 'rent paid');
// the house stands: sibling 3 moves in, its household holds the field as its farm's, the title ended
p3.to = 3;
for (const s of p3.steps) s.done = s.hours; // the clearing and the cottage's stages done
p3.open = p3.steps.length - 1;
const farms0 = st.farmsteads.length;
emit(st, 'sheavesIn', { hh, field: fd3, n: 40 }); // a rent owed when the house stands
finishCottage(st, p3);
assert.strictEqual(st.farmsteads.length, farms0 + 1, 'a farmstead founded');
const g = st.farmsteads[farms0],
  gh = st.households[g.household];
assert.strictEqual(gh.holder, 3, 'the sibling holds it');
{
  const old0 = Stores.grainOf(hh),
    new0 = Stores.grainOf(gh);
  L.payRent(st);
  assert.strictEqual(Stores.grainOf(gh), new0, 'no grain lands in the new barn uncarried (Nothing teleports)');
  assert.strictEqual(Stores.grainOf(hh), old0, 'nor leaves the old one');
  assert.strictEqual(
    Ob.due(st, { kind: 'pawn', id: 3 }, 'creditor', 'rent').reduce((s, o) => s + Ob.left(o), 0),
    20,
    'still owed',
  );
}
assert.deepStrictEqual(
  g.fields.map((fd) => fd.tile),
  p3.split,
  'its field is the new farm',
);
assert.strictEqual(g.fields[0].id, 0);
assert.ok(!st.titles.has(p3.split[0]), 'the title ended');
assert.deepStrictEqual(
  O.ownerOf(st, p3.split[0]),
  { type: 'household', id: gh.id },
  'owned and worked by the new household',
);
assert.strictEqual(st.owner[p3.split[0]], gh.id + 1);
assert.strictEqual(f.fields.length, 3, 'the old farm works 3 now');
assert.ok(
  st.villages[v.id].plots.some((p) => p.farmstead === g.id && p.split),
  'the plot recorded as on split land',
);
clean(st, 'moved in');
// a save keeps the heir's title; on the loaded copy, the farm standing empty gives the use of the field to the village, its owner kept
const tile5 = plots.find((p) => p.intended === 5).split[0],
  st2 = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st)))),
  t2 = st2.titles.get(tile5);
assert.deepStrictEqual(t2 && t2.owner, { type: 'pawn', id: 5 }, 'a loaded run keeps the title');
O.farmTo(st2, st2.farmsteads[f.id], { type: 'village', id: v.id });
assert.deepStrictEqual(t2.user, { type: 'village', id: v.id }, 'the farm emptied: the village holds the use');
assert.deepStrictEqual(O.ownerOf(st2, tile5), { type: 'pawn', id: 5 }, 'the heir still owns it');
// sibling 5 dies before its house: its field goes back to the farm, the rent owed it lapses, and its house stands empty when built
const [p5] = plots.filter((p) => p.intended === 5),
  fd5 = f.fields.find((fd) => fd.tile === p5.split[0]);
emit(st, 'sheavesIn', { hh, field: fd5, n: 4 });
assert.strictEqual(Ob.due(st, { kind: 'pawn', id: 5 }, 'creditor', 'rent').length, 1);
killPawn(st, 5);
assert.ok(!st.titles.has(fd5.tile), 'its title ended');
assert.deepStrictEqual(O.ownerOf(st, fd5.tile), { type: 'household', id: hh.id }, "the farm's again");
assert.strictEqual(Ob.due(st, { kind: 'pawn', id: 5 }, 'creditor', 'rent').length, 0, 'the rent lapsed');
assert.strictEqual(O.fieldsOwned(st, hh.id), 3);
clean(st, 'sibling died');
// under "buyout" no land is divided, and the share is paid in goods as before
const st3 = tinyState(tinyWorld(Array.from({ length: 12 }, () => '................')), [{ at: [7, 6], farms: 2 }], {
  seed: 7,
});
for (const s of st3.cenv.settlements) setPractice(st3, s.id, { heirCount: 'buyout' });
for (const [id, y] of [
  [4, 24],
  [5, 22],
]) {
  st3.pawns[id].born = st3.t - y * YEAR - DAY;
  st3.pawns[id].age = y;
}
const h3 = st3.households[st3.farmsteads[0].household];
Stores.put(st3, h3, 'grain', 3000, 'harvest', { barley: 3000 });
VB['sim/heirs'].transfer(st3, h3, 4, 'retirement');
assert.ok(!st3.titles || st3.titles.size === 0, 'buyout: no field split off');
assert.ok((st3.pawns[5].stake || 0) > SHARES.perField, 'buyout: the share in grain');
console.log('heirsplit: ok');
