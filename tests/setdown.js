// A load on its way home (VB-581) is carried in or lies where it was: a hand told to move while it carries one brings the load in first
// and then goes; a hand released standing in its own field sets the load back with the stooks; at its death on the road the load is
// still put down in its barn (a teleport left for a task, "a load lies where its carrier fell").
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous');
const live = st.households.filter((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 1 && h.members.length >= 2);
const hh = live[0], other = live[1];
const f = st.farmsteads[hh.farmstead], fd = f.fields[0];
const sheaves = () => hh.unthreshed.reduce((x, n) => x + n, 0);
const hand = () => st.agents[hh.members.find((id) => st.pawns[id].alive && st.pawns[id].age >= 14)];
let n_ = 0;
function carrier(a) {
  fd.stage = 'stooks'; fd.held = 30; fd.sown = 0;
  A.release(st, a);
  const j = J.post(st, 'haul:setdown' + a.id + st.t + (n_++), 'haul', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
  j.claims.push(a.id); a.job = j; a.phase = 'back'; a.inside = false; a.path = null; a.leg = null;
  KINDS.haul.load(st, a, j, 10); a.carry = 'sheaf';
  return j;
}
// 1. told to move to another household, on the road with the load: the load is not in the barn until the hand arrives with it
{
  const a = hand(), id = a.id, b0 = sheaves();
  carrier(a);
  const n = a.load, held = fd.held;
  st.pawns[id].household = other.id; // as moveTo has it
  A.moved(st, a, hh, other);
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
// 3. its death on the road: the load is put down in its barn, as before (a teleport, noted for a task)
{
  const a = hand(), b0 = sheaves();
  carrier(a);
  const n = a.load;
  a.x = st.w.hx[fd.tile] + 400; a.y = st.w.hy[fd.tile];
  A.stillAtDeath(st, a);
  assert.strictEqual(sheaves(), b0 + n);
}
console.log('setdown ok');
