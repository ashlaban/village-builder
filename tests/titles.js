// VB-311: own and use held apart. A field is split off a farm and its own passes to a neighbour, the farm's household keeping its use: the
// field is still worked by its user (st.owner, the job board), ownerOf and holdingsOf answer both ways, the land counted (claims holdings,
// the share rule) follows own, a save keeps the title, and ending it makes the field one holder's again. A constructed state.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState, checkCaches } = require('./lib/invariants.js');
const O = VB['sim/ownership'], { holdings } = VB['sim/claims'], { estateWorth } = VB['sim/terms'], { refreshJobs } = VB['sim/jobs'];
const { cal } = VB['sim/rules'];
const st = tinyState(tinyWorld(Array.from({ length: 10 }, () => '..............')), [{ at: [6, 5], farms: 2 }], { seed: 7 });
const clean = (when) => {
  const bad = [...checkState(st), ...checkCaches(st)];
  assert.deepStrictEqual(bad, [], `${when}: invariants`);
};
const v = st.villages[0],
  [fa, fb] = v.farmsteads.map((id) => st.farmsteads[id]),
  A = { type: 'household', id: fa.household },
  B = { type: 'household', id: fb.household };
assert.ok(fa.fields.length >= 2, 'farm A has fields to spare');
const fd = fa.fields[0],
  tile = fd.tile;
clean('seeded');
// before: own and use are one, and nothing is titled
assert.deepStrictEqual(O.ownerOf(st, tile), A);
assert.deepStrictEqual(O.holdingsOf(st, A, 'own'), [fa.house]);
assert.deepStrictEqual(O.holdingsOf(st, A, 'use'), [fa.house]);
const worth0 = { a: estateWorth(st, st.households[A.id]), b: estateWorth(st, st.households[B.id]) },
  land0 = holdings(st);
// split, then own to the neighbour
st.landDirty = new Set();
assert.strictEqual(O.split(st, fa, fd, 'test'), tile, 'a split field is a holding named by its tile');
O.transfer(st, tile, 'own', B, 'ruling', 'test');
assert.ok(st.landDirty.has(tile), 'the change is marked for the Land overlay');
assert.strictEqual(st.owner[tile], A.id + 1, 'st.owner is still the user');
assert.deepStrictEqual(O.ownerOf(st, tile), B, 'the owner is the neighbour');
assert.deepStrictEqual(O.holdingsOf(st, B, 'own'), [fb.house, tile]);
assert.deepStrictEqual(O.holdingsOf(st, B, 'use'), [fb.house]);
assert.deepStrictEqual(O.holdingsOf(st, A, 'own'), [fa.house]);
assert.deepStrictEqual(O.holdingsOf(st, A, 'use'), [fa.house, tile]);
assert.ok(fa.fields.includes(fd), 'the field record stays with the farm that works it');
clean('titled');
// the land counted follows own
const land1 = holdings(st);
assert.strictEqual(land1.households.get(A.id).fields, land0.households.get(A.id).fields - 1, 'A counts a field less');
assert.strictEqual(land1.households.get(B.id).fields, land0.households.get(B.id).fields + 1, 'B counts a field more');
const per = VB['sim/rules'].SHARES.perField;
assert.ok(Math.abs(estateWorth(st, st.households[A.id]) - (worth0.a - per)) < 1e-9, 'the share rule counts own: A less a field');
assert.ok(Math.abs(estateWorth(st, st.households[B.id]) - (worth0.b + per)) < 1e-9, 'B a field more');
// a save keeps the title
const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual(O.ownerOf(back, tile), B, 'a loaded run keeps the title');
assert.deepStrictEqual([...back.titles.keys()], [tile]);
// the field's work still goes to its user: the jobs posted on it over the year, on the loaded copy, are A's
const bfd = back.farmsteads[fa.id].fields[0];
for (let d = 0; d < 400 && ![...back.jobs.values()].some((j) => j.field === bfd); d++) {
  back.t += Sim.DAY;
  refreshJobs(back, cal(back.t));
}
const jobs = [...back.jobs.values()].filter((j) => j.field === bfd);
assert.ok(jobs.length > 0, 'the field has work in its year');
for (const j of jobs) assert.deepStrictEqual({ ...j.owner }, A, `job ${j.key} is its user's`);
// a grant of use: the tenant works it (st.owner), the owner unchanged
O.grant(st, tile, 'use', B, 0.25, 'test');
assert.strictEqual(st.owner[tile], B.id + 1, 'the grantee works the field');
assert.deepStrictEqual(O.holdingsOf(st, B, 'use'), [fb.house, tile]);
clean('granted');
O.grant(st, tile, 'use', A, 0.25, 'test');
// the end: one holder again, the farm's
assert.strictEqual(O.end(st, tile, 'test'), true);
assert.strictEqual(st.titles.size, 0);
assert.deepStrictEqual(O.ownerOf(st, tile), A, "ended: the field is its farm household's again");
assert.strictEqual(st.owner[tile], A.id + 1);
assert.deepStrictEqual(O.holdingsOf(st, A, 'own'), [fa.house]);
assert.deepStrictEqual(O.holdingsOf(st, B, 'own'), [fb.house]);
assert.strictEqual(O.end(st, tile, 'test'), false, 'nothing left to end');
clean('ended');
// a farm's own passes whole: its fields with it
O.transfer(st, fa.house, 'own', { type: 'village', id: v.id }, 'ruling', 'test');
assert.deepStrictEqual(O.ownerOf(st, tile), { type: 'village', id: v.id }, 'a farm title covers its fields');
assert.strictEqual(estateWorth(st, st.households[A.id]), Math.max(0, worth0.a - fa.fields.length * per), 'A owns no field');
clean('farm titled');
O.end(st, fa.house, 'test');
clean('farm ended');
console.log('titles: ok');
