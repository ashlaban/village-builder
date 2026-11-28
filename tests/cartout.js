// @suite fast
// VB-1810: the cart a load goes home on (sheaves, hay, timber) is taken at the house as its hand sets out, and walked out at the cart's
// pace (sim/methods' cart step, fetched at the house); a load made or taken up on the back by a hand that has no cart while more waits is
// a miss the head counts (sim/doing wanted), one a load: the last load, which the back holds, counts none.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'];
const { TRAVEL, SPEED } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
// A household's grown hand, at home at 8:00, set out for a task of `kind` (`what` gives its site and extra, and the stooks, cocks or
// trees it stands on), with the carts given; run until the task is done (or `hours`): the walk out's pace and the cart's holder, the
// loads it took up on the back, and the misses counted.
function run(kind, carts, what, hours = 72) {
  const st = Sim.seed(r.value, 7, 'populous');
  const hh = st.households.find((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 1 && h.members.length >= 3);
  const f = st.farmsteads[hh.farmstead];
  while (Math.floor(st.t + 1e-9) % 24 !== 8) Sim.advance(st, 0.1);
  const a = st.agents[hh.members.find((id) => id !== hh.holder && st.pawns[id].alive && st.pawns[id].age >= 14)];
  hh.carts = carts; // a test's write
  const [site, extra] = what(st, hh, f);
  A.release(st, a); A.placeAtHome(st, a);
  const miss0 = hh.cartMiss;
  const j = J.post(st, `${kind}:out` + st.t, kind, { type: 'household', id: hh.id }, site, extra);
  A.start(st, a, j);
  let pace = null, by = null, back = 0, was = 0;
  for (let k = 0; k < hours * 10 && st.jobs.get(j.key) === j; k++) {
    if (a.job === j && a.path && a.leg && a.leg.kind === 'walk' && !(a.load > 0) && pace === null) {
      pace = a.leg.pace / (SPEED * st.w.HW);
      by = hh.carts.length ? hh.carts[0].by : null;
    }
    Sim.advance(st, 0.1);
    if (a.job === j && a.load > 0 && !(was > 0) && !hh.carts.some((c) => c.by === a.id)) back++;
    was = a.job === j ? a.load : 0;
  }
  assert.deepStrictEqual(checkState(st).filter((m) => /cart/i.test(m)), [], `${kind}: invariants of the carts`);
  return { a, pace, by, back, missed: hh.cartMiss - miss0 };
}
const hand = () => ({ kind: 'hand', cond: 1, built: 0, by: null });
const stooks = (held) => (st, hh, f) => {
  const fd = f.fields[0];
  fd.stage = 'stooks'; fd.held = held; fd.sown = 0; fd.crop = 'rye'; // a test's write: the stooks stand
  return [fd.tile, { field: fd, farm: f, crop: 'rye' }];
};
const cocks = (held) => (st, hh, f) => {
  const fd = f.fields[0], m = { tile: fd.tile, stage: 'mown', held }; // a test's meadow, its hay raked into cocks
  return [fd.tile, { meadow: m, farm: f }];
};
const trees = (loads) => (st, hh, f) => [st.villages[f.village].wood[0], { farm: f, chosen: false, amount: (hh.wood || 0) + (hh.timber || 0) + loads * st.ECON.woodPerTrip }];
{
  const o = run('haul', [hand()], stooks(90), 3);
  assert(o.by === o.a.id, `the cart is taken at the house as the hand sets out (${o.by})`);
  assert(Math.abs(o.pace - TRAVEL.pace.hand) < 1e-9, `it walks out at the cart's pace (${o.pace})`);
  assert(o.missed === 0 && o.back === 0, `a cart free: no load on the back, no miss (${o.back}, ${o.missed})`);
}
{
  const o = run('haul', [], stooks(6 * TRAVEL.load));
  assert(o.pace === 1, `no cart: it walks out unladen (${o.pace})`);
  assert(o.back === 6, `six loads on the back (${o.back})`);
  assert(o.missed === 5, `each but the last taken while more waited: five misses (${o.missed})`);
}
{
  const o = run('haul', [], stooks(TRAVEL.load));
  assert(o.back === 1 && o.missed === 0, `a load the back holds: no miss (${o.back}, ${o.missed})`);
}
{
  const o = run('hay', [], cocks(3 * TRAVEL.load * TRAVEL.hay));
  assert(o.back === 3 && o.missed === 2, `hay: three loads on the back, two misses (${o.back}, ${o.missed})`);
}
{
  const o = run('wood', [], trees(3));
  assert(o.back >= 1 && o.missed >= 1 && o.missed <= o.back, `timber: ${o.back} loads on the back while more was wanted, a miss each (${o.missed})`);
}
console.log('cartout ok: the cart taken at the house and walked out at its pace; a miss for each load on the back while more waited');
