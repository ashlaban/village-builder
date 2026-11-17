// A boat's project given up (VB-645): the timber carried to its shore lies there (sim/lying, VB-611), not gone with the plan: on the
// household's woodpile once fetched home, or rotted at the autumn frost with an event, as other loads left lying.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Plans = VB['sim/plans'], Lying = VB['sim/lying'], { KINDS } = VB['sim/kinds'];
const { TRAVEL } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const make = () => {
  const st = Sim.seed(r.value, 7, 'populous');
  const hh = st.households.find((h) => !h.dissolved && h.farmstead !== null && !st.plans.projects.household.has(h.id));
  const f = st.farmsteads[hh.farmstead], shore = st.farmsteads.find((x) => x.house !== f.house).house;
  const plan = Plans.makeProject(st, 'household', hh.id, { what: 'boat', water: 0, steps: [{ kind: 'boat', place: shore, hours: 20, wood: 0, timber: 12 }] });
  plan.steps[0].wood = 9; // three loads carried to the shore
  return { st, hh, shore, plan };
};
assert(KINDS.fetchLeftTimber && KINDS.fetchLeftTimber.fetch === 'leftTimber', 'a fetch kind for timber left lying');
{ // given up: the timber lies at the shore, and the plan is gone
  const { st, hh, shore, plan } = make();
  const wood = hh.wood;
  Plans.drop(st, plan);
  assert.strictEqual(hh.wood, wood, 'the timber is not at the house');
  assert(st.lying && st.lying.length === 1, 'one load lies');
  const l = st.lying[0];
  assert(l.kind === 'leftTimber' && l.tile === shore && l.owner.id === hh.id, "it lies at the shore, its household's");
  assert.strictEqual(l.n, (9 / st.ECON.woodPerTrip) * TRAVEL.load, 'the wood carried, in loads');
  assert(!checkState(st).length, 'invariants hold');
  // fetched: taken up and delivered home as firewood
  const had = l.n, n = Lying.take(st, l.id, l.n);
  assert.strictEqual(n, had);
  assert(!st.lying, 'the list empties');
  KINDS.fetchLeftTimber.deliver(st, {}, hh, st.farmsteads[hh.farmstead], { load: n });
  assert(Math.abs(hh.wood - wood - 9) < 1e-6, `${hh.wood - wood} of wood home`);
}
{ // not fetched: the frost rots it, with an event
  const { st, plan } = make();
  Plans.drop(st, plan);
  const n0 = st.record.length;
  Lying.frost(st);
  assert(!st.lying, 'rotted: none lies');
  assert(st.record.slice(n0).some((e) => e && e.kind === 'frost'), 'the frost on the timber is told');
}
console.log("leftwood ok: a dropped boat's timber lies at its shore, is fetched home, or rots at the frost");
