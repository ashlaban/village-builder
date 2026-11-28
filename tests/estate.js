// @suite fast
// A household that dies out leaves its barn and woodpile where they lie (VB-1175, from VB-650; AGENTS.md, the hard rule): its grain and its
// wood in whole trips lie at its house for the household its herds go to, which fetches them with its own hands; with no such household the
// grain is the village's and the wood rots at the frost, named. A tiny world: one village of two farms, the second emptied by hand.
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/heirs'], S = VB['sim/stores'], L = VB['sim/lying'];
const { ECON, TRAVEL, DAY } = VB['sim/rules'], { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('ESTATE FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const scene = () => {
  const st = tinyState(tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20))), [{ at: [8, 5], farms: 2, sizes: [8, 8] }], { seed: 3 });
  const hh = st.households[st.farmsteads[st.villages[0].farmsteads[1]].household], f = st.farmsteads[hh.farmstead];
  S.put(st, hh, 'wood', 3 * ECON.woodPerTrip + 1, 'plot'); // whole trips and a load over
  return { st, hh, f, grain: S.grainOf(hh), wood: hh.wood };
};
const out = [];

// ---- its people go to the other farm: the grain and the three trips of wood lie at the house as that household's ----
{
  const { st, hh, f, grain, wood } = scene();
  check(grain > 1, `the scene: a barn with grain (${grain})`);
  H.extinct(st, hh);
  const heir = st.households.find((h) => !h.dissolved && h.members.length && h.id !== hh.id);
  const lying = st.lying || [], g = lying.find((l) => l.kind === 'leftGrain'), w = lying.find((l) => l.kind === 'leftTimber');
  check(hh.dissolved && S.grainOf(hh) === 0, `the dead household holds no grain (${S.grainOf(hh)})`);
  check(g && near(g.n, grain) && g.tile === f.house && g.owner.type === 'household' && g.owner.id === heir.id,
    `its grain lies at its house for the heir: ${JSON.stringify(g)}`);
  check(g && near(Object.values(g.of.parts).reduce((a, b) => a + b, 0), grain), 'by crop as it was');
  const trips = Math.floor(wood / ECON.woodPerTrip);
  check(w && near(w.n, trips * TRAVEL.load) && w.owner.id === heir.id && near(hh.wood, wood % ECON.woodPerTrip),
    `its wood lies in whole trips, the load over stays: ${JSON.stringify(w)}, ${hh.wood}`);
  Sim.refreshRoles(st); const bad = checkState(st); check(!bad.length, `invariants after: ${bad.slice(0, 2).join('; ')}`);
  // its hands fetch it: the lying loads shrink and the heir's barn and woodpile take them in
  const g0 = S.grainOf(heir), w0 = heir.wood;
  Sim.advance(st, 6 * DAY);
  const left = (st.lying || []).filter((l) => l.kind === 'leftGrain' || l.kind === 'leftTimber').reduce((n, l) => n + l.n, 0);
  check(left < grain + trips * TRAVEL.load, `fetched within six days: ${left} still lies`);
  check(heir.wood > w0 - 1e-9 || S.grainOf(heir) > g0, 'and taken into the heir\'s store');
  out.push(`${grain.toFixed(1)} rations and ${trips} trips of wood laid for household ${heir.id}, ${left.toFixed(1)} left lying after six days`);
}

// ---- nobody goes anywhere (by hand: the members are taken off first): the grain is the village's, the wood the frost's ----
{
  const { st, hh, f, grain } = scene();
  for (const id of [...hh.members]) { const p = st.pawns[id]; p.alive = false; p.died = st.t; }
  H.extinct(st, hh);
  const g = (st.lying || []).find((l) => l.kind === 'leftGrain'), w = (st.lying || []).find((l) => l.kind === 'leftTimber');
  check(g && near(g.n, grain) && g.owner.type === 'village' && g.owner.id === f.village, `with no heir the grain is the village's: ${JSON.stringify(g)}`);
  check(w && w.owner.type === 'household' && w.owner.id === hh.id, `and the wood lies the dead household's: ${JSON.stringify(w)}`);
  const was = st.record.length;
  L.frost(st);
  check(!st.lying, 'the frost takes what lies');
  const said = st.record.slice(was).filter((e) => e.kind === 'frost').map((e) => e.text);
  check(said.some((t) => /whose household is gone/.test(t)) && said.length === 2, `the frost names both: ${said.join(' | ')}`);
  out.push('with no heir: grain the village\'s, wood for the frost');
}

if (failed) process.exit(1);
console.log('estate ok: ' + out.join('; '));
