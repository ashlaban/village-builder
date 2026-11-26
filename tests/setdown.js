// A load on its way home (VB-581) is carried in or lies where it was: a hand told to move while it carries one brings the load in first
// and then goes; a hand released standing in its own field sets the load back with the stooks; at its death on the road, or its household
// dissolving, the load lies where it stood (VB-611, sim/lying) until another hand fetches it and carries it home; one left lying rots at
// the autumn frost; a lying load is saved and loaded with its field.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const Lying = VB['sim/lying'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous');
// the loads put down on the road: not the timber of a wood felled for a field, which lies at its site meanwhile (VB-1525)
const ours = () => (st.lying || []).filter((x) => x.kind !== 'leftTimber' && x.kind !== 'leftCart'); // and a cart left with it
const live = st.households.filter((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 1 && h.members.length >= 2);
const hh = live[0], other = live[1];
const f = st.farmsteads[hh.farmstead], fd = f.fields[0];
const sheaves = () => hh.unthreshed.reduce((x, n) => x + n, 0);
const hand = () => st.agents[hh.members.find((id) => st.pawns[id].alive && st.pawns[id].age >= 14)];
let n_ = 0;
while (Math.floor(st.t + 1e-9) % 24 !== 8) Sim.advance(st, 0.1); // within the working day
function carrier(a) {
  fd.stage = 'stooks'; fd.held = 30; fd.sown = 0;
  A.release(st, a);
  A.placeAtHome(st, a); // out of its leg
  const j = J.post(st, 'haul:setdown' + a.id + st.t + (n_++), 'haul', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
  j.claims.push(a.id); a.job = j; a.phase = 'back'; a.inside = false;
  KINDS.haul.ops.pitch.run(st, j, null, j.site, a, 10); a.carry = 'sheaf'; // VB-1812: the stooks pitched (the work leg of its goal)
  return j;
}
// 1. told to move to another household, on the road with the load: the load is not in the barn until the hand arrives with it
{
  const a = hand(), id = a.id, b0 = sheaves();
  carrier(a);
  const n = a.load, held = fd.held;
  st.pawns[id].household = other.id; // as moveTo has it
  VB['sim/journeys'].moved(st, a, hh, other);
  assert.strictEqual(sheaves(), b0, 'the load was booked at the barn from the road');
  assert(a.moving && a.phase === 'back' && a.load === n && fd.held === held, 'the hand is not still carrying its load');
  A.arrived(st, a); // home with the load
  assert.strictEqual(sheaves(), b0 + n, 'the load did not arrive with the hand');
  assert(!a.moving && a.load === 0 && a.job === null, 'the hand is not free after the delivery');
  assert(a.phase === 'home' || a.phase === null || a.phase === 'journey', 'the hand does not go to its new home');
  st.pawns[id].household = hh.id;
  A.release(st, a);
}
// 2. released standing in the field: the load goes back with the stooks
{
  const a = hand(), b0 = sheaves();
  carrier(a);
  a.x = st.w.hx[fd.tile]; a.y = st.w.hy[fd.tile];
  A.release(st, a);
  assert.strictEqual(sheaves(), b0, 'a load set down in the field is in the barn');
  assert.strictEqual(fd.held, 30); assert.strictEqual(fd.stage, 'stooks');
  assert(a.load === 0 && a.carry === null && a.phase === null);
}
// 3. its death on the road: the load lies where the hand fell, and is in the barn only once another hand has fetched it and carried it home
const onRoad = (a) => {
  a.x = st.w.hx[fd.tile] + 400; a.y = st.w.hy[fd.tile];
  fd.stage = 'stubble'; fd.held = 0; // the last load of the field: nothing else to haul
};
const fetchJob = () => {
  let j = null;
  Lying.fetchWork(st, hh, f, null, (key, site, extra, k, owner) => (j = J.post(st, key, k, owner, site, extra)));
  return j;
};
{
  const grown = hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 14);
  assert(grown.length >= 2, 'the household has no second hand');
  const a = st.agents[grown.find((id) => id !== hh.holder) ?? grown[1]], b0 = sheaves();
  carrier(a);
  const n = a.load;
  onRoad(a);
  const at = VB['sim/pose'].tileAt(st, a.x, a.y);
  VB['sim/lifecycle'].killPawn(st, a.id, 'illness'); // it dies on the road (stillAtDeath)
  assert.strictEqual(sheaves(), b0, 'the load was booked at the barn from the road');
  assert(ours().length === 1, 'no load lies where the hand fell');
  const l = ours()[0];
  assert.deepStrictEqual([l.kind, l.n, l.tile, l.owner.type, l.owner.id, l.of.field === fd], ['haul', n, at, 'household', hh.id, true]);
  assert.deepStrictEqual(checkState(st), [], 'the state with a load lying breaks an invariant');
  // no fetching is posted for it (VB-1812): the stray method of the household's next sheaves' goal carries it home before the stooks
  let posted = null;
  Lying.fetchWork(st, hh, f, null, (key, site, extra, k) => (posted = k), (k) => !!KINDS[Lying.fetchKey(k)]); // as sim/kinds asks
  assert.strictEqual(posted, null, 'a fetch kind is posted for a load a goal carries');
  fd.stage = 'stooks'; fd.held = 30;
  const j = J.post(st, 'haul:stray', 'haul', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
  const b = st.agents[grown.find((id) => id !== a.id)];
  A.release(st, b);
  A.placeAtHome(st, b);
  A.start(st, b, j);
  let carried = false;
  for (let k = 0; k < 400 && sheaves() === b0; k++) {
    if (b.job === j && b.load === n && !ours().some((x) => x.id === l.id)) carried = true;
    Sim.advance(st, 0.1);
  }
  assert(carried, 'nobody carried the load from where it lay');
  assert.strictEqual(sheaves(), b0 + n, 'the fetched load did not reach the barn');
  assert(!ours().some((x) => x.id === l.id), 'the load still lies after it was fetched');
  assert.deepStrictEqual(checkState(st), [], 'the state after the fetch breaks an invariant');
}
// 4. its household dissolving: the load lies where the hand stood (sim/heirs' extinct stops the work first)
{
  const a = hand(), b0 = sheaves();
  carrier(a);
  onRoad(a);
  A.stopWorkFor(st, hh, f);
  assert.strictEqual(sheaves(), b0, 'the load was booked at the barn from the road');
  assert(ours().length === 1 && ours()[0].n > 0 && a.load === 0 && a.job === null);
  // saved and loaded: the load lies on, with its field
  const w2 = (() => { const it2 = G.generate(7, { cols: 120, rows: 85 }); let r2; while (!(r2 = it2.next()).done); return r2.value; })();
  const back = Sim.load(w2, JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(back.lying.find((x) => x.kind === 'haul').of.field, back.farmsteads[f.id].fields[0], 'the loaded load lost its field');
  assert.deepStrictEqual(checkState(back), []);
  // an older save, with none: none lies
  const old = JSON.parse(JSON.stringify(Sim.save(st)));
  delete old.state.lying; delete old.state.lyingSeq;
  assert(!Sim.load(w2, old).lying);
  // 5. left lying, it rots at the autumn frost, and the frost is told
  const n0 = st.record.length;
  Lying.frost(st);
  VB['sim/carts'].cartsFrost(st); // as the clock's frost: a cart left standing with a felled wood's timber goes with it (VB-1525)
  assert(!st.lying, 'a load still lies after the frost');
  assert(st.record.slice(n0).some((e) => e && e.kind === 'frost'), 'the frost on a lying load is not told');
  assert.strictEqual(sheaves(), b0);
}
// 6. the well's stone (sim/green): a carrier killed on the way to the green; the stone lies there, is carried on by the stray method of
// the next goal for it and reaches the well
{
  const Stores = VB['sim/stores'], v = st.villages[f.village], step = { kind: 'well', place: v.center, hours: 1, brought: 0 };
  Stores.put(st, hh, 'stone/granite', 3, 'clear');
  const stone0 = Stores.heldOf(hh, 'stone');
  const grown = hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 14);
  const a = st.agents[grown[0]];
  A.release(st, a);
  A.placeAtHome(st, a);
  const own = { type: 'village', id: v.id };
  const j = J.post(st, 'wellstone:setdown', 'wellstone', own, f.house, { village: v.id, step, from: hh.id, dest: v.center });
  j.claims.push(a.id); a.job = j; a.phase = 'back'; a.inside = false;
  KINDS.wellstone.ops.take.run(st, j, null, j.site, a, 1); // VB-1812: the stone taken up (the work leg of its goal)
  assert.strictEqual(a.load, 1);
  assert(a.load === 1 && Stores.heldOf(hh, 'stone') === stone0 - 1, 'the stone taken up is not in hand');
  a.carry = 'basket';
  a.x = st.w.hx[f.house] + 300; a.y = st.w.hy[f.house];
  const at = VB['sim/pose'].tileAt(st, a.x, a.y);
  VB['sim/lifecycle'].killPawn(st, a.id, 'illness');
  assert.strictEqual(step.brought, 0, 'the stone reached the well from the road');
  const l = (st.lying || []).find((x) => x.kind === 'wellstone');
  // the village's stone lies as the village's (title moves at once, design.md section 1; VB-1812 revision), not the hand's household's
  assert(l && l.n === 1 && l.tile === at && l.owner.type === 'village' && l.owner.id === v.id, 'the stone does not lie where its carrier fell, as the village\'s');
  const D = VB['sim/doing'], hhGoal = { kind: 'wellstone', at: f.house, owner: hh.id, amount: 0, job: { ...j, owner: { type: 'household', id: hh.id } } };
  assert.strictEqual(D.VIEW.stray(st, hhGoal, 'wellstone', st.w.hx[f.house], st.w.hy[f.house]), null, 'a household\'s goal takes up the village\'s stone');
  // no fetching is posted (VB-1812): the stray method of the next goal for the well's stone carries it there first
  let fk = null;
  Lying.fetchWork(st, v, v, null, (key, site, extra, k) => (fk = k), (k) => !!KINDS[Lying.fetchKey(k)]);
  assert.strictEqual(fk, null, 'a fetch kind is posted for the stone a goal carries');
  const fj = J.post(st, 'wellstone:stray', 'wellstone', own, f.house, { village: v.id, step, from: hh.id, dest: v.center });
  const villagers = st.households.filter((h) => !h.dissolved && h.id !== hh.id && st.farmsteads[h.farmstead].village === v.id)
    .flatMap((h) => h.members).filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18);
  const c = st.agents[villagers[0] ?? grown[1]]; // a hand of another household: the village's stone is any villager's to carry
  A.release(st, c);
  A.placeAtHome(st, c);
  A.start(st, c, fj);
  for (let k = 0; k < 600 && step.brought === 0; k++) Sim.advance(st, 0.1);
  assert.strictEqual(step.brought, 1, 'the fetched stone did not reach the well');
  assert(!ours().length, 'the stone still lies after it was fetched');
  assert.deepStrictEqual(checkState(st), []);
}
// 7. a load of sheaves fetched after its field was sown anew keeps its crop
{
  const of = { field: { crop: 'rye', stage: 'growing' }, crop: 'barley', bin: 5, src: fd.tile };
  let seen = null;
  const K = { ...KINDS.haul, deliver: (st_, j) => (seen = [j.field.crop, j.field.bin, j.site]) };
  Lying.fetchKind('haul', K).deliver(st, { ...of }, hh, f, {});
  assert.deepStrictEqual(seen, ['barley', 5, fd.tile], 'a fetched load takes the crop the field has now');
}
console.log('setdown ok');
