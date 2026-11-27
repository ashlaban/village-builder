// VB-1810: the cart a load goes home on (sheaves, hay, timber) is taken at the house as its hand sets out, and walked out at the cart's
// pace (sim/methods' cart step, fetched at the house); a hand that sets out with none free while one would pay carries on its back, and
// the head counts a miss (sim/doing cartMissed); a load the back holds, or a kind with no load home on a fetched cart, counts none.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const Methods = VB['sim/methods'], { TRAVEL, SPEED } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
for (const k of ['haul', 'hay', 'wood', 'firewood']) assert(Methods.says(KINDS[k], 'miss'), `${k}: its load goes home on a cart`);
for (const k of ['manure', 'leftHay', 'water']) assert(!Methods.says(KINDS[k], 'miss'), `${k}: no load home on a fetched cart`);
// A household's grown hand, at home at 8:00, set out for the haul of its first field's stooks (`held` rations), with the carts given.
function setOut(carts, held) {
  const st = Sim.seed(r.value, 7, 'populous');
  const hh = st.households.find((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 1 && h.members.length >= 3);
  const f = st.farmsteads[hh.farmstead], fd = f.fields[0];
  while (Math.floor(st.t + 1e-9) % 24 !== 8) Sim.advance(st, 0.1);
  const a = st.agents[hh.members.find((id) => id !== hh.holder && st.pawns[id].alive && st.pawns[id].age >= 14)];
  hh.carts = carts; // a test's write
  fd.stage = 'stooks'; fd.held = held; fd.sown = 0; // a test's write: the stooks stand
  A.release(st, a); A.placeAtHome(st, a);
  const miss0 = hh.cartMiss;
  const j = J.post(st, 'haul:out' + st.t, 'haul', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
  A.start(st, a, j);
  // the walk out, unladen: its pace, and the cart's holder
  let pace = null, by = null;
  for (let k = 0; k < 200 && a.job === j && !(a.load > 0); k++) {
    if (a.path && a.leg && a.leg.kind === 'walk' && pace === null) {
      pace = a.leg.pace / (SPEED * st.w.HW);
      by = hh.carts.length ? hh.carts[0].by : null;
    }
    Sim.advance(st, 0.1);
  }
  assert.deepStrictEqual(checkState(st).filter((m) => /cart/i.test(m)), [], 'invariants of the carts');
  return { st, hh, a, pace, by, missed: hh.cartMiss - miss0, load: a.load };
}
const hand = () => ({ kind: 'hand', cond: 1, built: 0, by: null });
{
  const o = setOut([hand()], 90);
  assert(o.by === o.a.id, `the cart is taken at the house as the hand sets out (${o.by})`);
  assert(Math.abs(o.pace - TRAVEL.pace.hand) < 1e-9, `it walks out at the cart's pace (${o.pace})`);
  assert(o.missed === 0, `a cart free: no miss (${o.missed})`);
  assert(o.load > TRAVEL.load, `the stooks pitched on the cart (${o.load})`);
}
{
  const o = setOut([], 90);
  assert(o.pace === 1, `no cart: it walks out unladen (${o.pace})`);
  assert(o.missed === 1, `no cart free while more waits: the head counts a miss (${o.missed})`);
  assert(o.load > 0 && o.load <= TRAVEL.load, `the load on the back (${o.load})`);
}
{
  const o = setOut([], TRAVEL.load);
  assert(o.missed === 0, `a load the back holds: no miss (${o.missed})`);
}
console.log('cartout ok: the cart taken at the house and walked out at its pace; a miss counted for one wanted and none free');
