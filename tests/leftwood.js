// @suite integration
// A boat's project given up (VB-645): the timber carried to its shore lies there (sim/lying, VB-611), not gone with the plan: on the
// household's woodpile once fetched home, or rotted at the autumn frost with an event, as other loads left lying.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Plans = VB['sim/plans'], Lying = VB['sim/lying'], { KINDS } = VB['sim/kinds'];
const A = VB['sim/agents'], J = VB['sim/jobs'];
const { TRAVEL } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const make = () => {
  const st = Sim.seed(r.value, 7, 'populous');
  const hh = st.households.find((h) => !h.dissolved && h.farmstead !== null && !st.plans.projects.household.has(h.id));
  const f = st.farmsteads[hh.farmstead], shore = st.farmsteads.find((x) => x.house !== f.house).house;
  const plan = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'boat', small: true, water: 0, steps: [{ kind: 'boat', place: shore, hours: 20, wood: 0, timber: 12 }] });
  plan.steps[0].wood = 9; // three loads carried to the shore
  return { st, hh, shore, plan };
};
// VB-1814: no fetch kind; a goal of the household's, the stray method alone, brings it home
assert(!KINDS.fetchLeftTimber && KINDS.leftTimber && KINDS.leftTimber.strays.some((s) => s.good === 'leftTimber'), 'a goal of its own for timber left lying');
{ // given up: the timber lies at the shore, and the plan is gone
  const { st, hh, shore, plan } = make();
  const wood = hh.wood;
  VB['sim/projectplans'].drop(st, plan);
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
  VB['sim/doing'].said('leftTimber').deliver(st, {}, hh, st.farmsteads[hh.farmstead], { load: n });
  assert(Math.abs(hh.wood - wood - 9) < 1e-6, `${hh.wood - wood} of wood home`);
}
{ // fetched by its goal: posted at the shore, a hand of the household walks there, takes it up a load at a time and carries it home
  const { st, hh, shore, plan } = make();
  VB['sim/projectplans'].drop(st, plan);
  const f = st.farmsteads[hh.farmstead];
  let j = null;
  Lying.bringWork(st, hh, f, null, (key, site, extra, k, owner) => (j = J.post(st, key, k, owner, site, extra)));
  assert(j && j.kind === 'leftTimber' && j.site === shore, 'its goal is posted where it lies');
  const b = st.agents[hh.members.find((id) => st.pawns[id].alive && st.pawns[id].age >= 14)];
  A.release(st, b);
  A.placeAtHome(st, b);
  A.start(st, b, j);
  let carried = false;
  for (let k = 0; k < 1200 && (st.lying || []).some((l) => l.kind === 'leftTimber'); k++) {
    Sim.advance(st, 0.1);
    if (b.job === j && b.load > 0) carried = true;
  }
  assert(!(st.lying || []).some((l) => l.kind === 'leftTimber') && carried, 'its hand took the timber up');
  for (let k = 0; k < 600 && [...st.agents].some((a) => a.job && a.job.kind === 'leftTimber'); k++) Sim.advance(st, 0.1);
  assert(![...st.agents].some((a) => a.job && a.job.kind === 'leftTimber' && a.load > 0), 'and set it down at home');
  assert.deepStrictEqual(checkState(st), [], 'invariants, fetched by its goal');
}
{ // not fetched: the frost rots it, with an event
  const { st, plan } = make();
  VB['sim/projectplans'].drop(st, plan);
  const n0 = st.record.length;
  Lying.frost(st); Lying.decay(st, 48);
  assert(!st.lying, 'rotted: none lies');
  assert(st.record.slice(n0).some((e) => e && e.kind === 'frost'), 'the frost on the timber is told');
}
console.log("leftwood ok: a dropped boat's timber lies at its shore, is fetched home, or rots at the frost");
