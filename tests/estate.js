// @suite fast
// A household that dies out leaves its barn and woodpile where they lie (VB-1175, from VB-650; AGENTS.md, the hard rule): its grain and its
// wood in whole trips lie at its house for the household its herds go to, which fetches them with its own hands; with no such household the
// grain is the village's and the wood rots at the frost, named. Every other good of its stores (VB-1697) lies at the house as its estate,
// and passes with the farm to the household founded there, which owns each where it lies; with none, the frost takes it, named.
// A tiny world: one village of two farms, the second emptied by hand.
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/heirs'], S = VB['sim/stores'], L = VB['sim/lying'], M = VB['sim/membership'];
const { ECON, TRAVEL, DAY } = VB['sim/rules'], { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('ESTATE FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
// a good of each store (VB-1175's line from VB-650): stone, flour, peat, tar, hides, salt, iron, clay, ore, the rack, and the rest
const GOODS = [['timber', 2], ['stone/granite', 3], ['flour', 4], ['peat', 5], ['tar', 2], ['hide', 3], ['salt', 1.5], ['iron', 0.7],
  ['clay', 2], ['bogOre', 1], ['fish', 8], ['wool', 3], ['yarn', 2], ['cloth', 1]];
// what a closed record's field holds of a good (the stores refuse a dissolved holder)
const rawOf = (hh, good) => good === 'stone/granite' ? hh.stone.granite : good === 'cloth' ? (hh.cloth || []).reduce((a, b) => a + b, 0)
  : hh[{ hide: 'hides', fish: 'rack' }[good] || good];
const scene = () => {
  const st = tinyState(tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20))), [{ at: [8, 5], farms: 2, sizes: [8, 8] }], { seed: 3 });
  const hh = st.households[st.farmsteads[st.villages[0].farmsteads[1]].household], f = st.farmsteads[hh.farmstead];
  S.put(st, hh, 'wood', 3 * ECON.woodPerTrip + 1, 'plot'); // whole trips and a load over
  for (const [good, n] of GOODS) S.put(st, hh, good, n, good === 'cloth' ? { kind: 'plot', grade: 2 } : 'plot');
  hh.larder.push({ kind: 'dried fish', n: 6, until: st.t + 40 * DAY });
  hh.ale.push({ n: 2, until: st.t + 10 * DAY });
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
  check(w && near(w.n, trips * TRAVEL.load) && w.owner.id === heir.id && hh.wood === 0,
    `its wood lies in whole trips, the load over with the estate: ${JSON.stringify(w)}, ${hh.wood}`);
  // the rest lies at its house as its estate, its own, and is out of its closed record
  const e = lying.find((l) => l.kind === 'estate');
  check(e && e.tile === f.house && e.owner.type === 'household' && e.owner.id === hh.id, `its estate lies at its house: ${JSON.stringify(e)}`);
  for (const [good, n] of GOODS) {
    check(!(rawOf(hh, good) > 0), `the closed record holds no ${good} (${rawOf(hh, good)})`);
    check(e && near(good === 'cloth' ? e.of.goods.cloth[2] : e.of.goods[good], n), `the estate holds its ${good}`);
  }
  check(e && near(e.of.goods.wood, wood % ECON.woodPerTrip) && e.of.goods.larder.length === 1 && e.of.goods.ale[0].n === 2 && !hh.larder.length && !hh.ale.length,
    `and the wood over a trip, the larder and the ale: ${JSON.stringify(e && e.of.goods)}`);
  Sim.refreshRoles(st); const bad = checkState(st); check(!bad.length, `invariants after: ${bad.slice(0, 2).join('; ')}`);
  // its hands fetch it: the lying loads shrink and the heir's barn and woodpile take them in
  const g0 = S.grainOf(heir), w0 = heir.wood;
  Sim.advance(st, 6 * DAY);
  const left = (st.lying || []).filter((l) => l.kind === 'leftGrain' || l.kind === 'leftTimber').reduce((n, l) => n + l.n, 0);
  check(left < grain + trips * TRAVEL.load, `fetched within six days: ${left} still lies`);
  check(heir.wood > w0 - 1e-9 || S.grainOf(heir) > g0, 'and taken into the heir\'s store');
  out.push(`${grain.toFixed(1)} rations and ${trips} trips of wood laid for household ${heir.id}, ${left.toFixed(1)} left lying after six days`);
  // a pawn of the heir's founds a household on the empty farm: the estate passes with it, each good where it lies
  const by = heir.members.map((id) => st.pawns[id]).find((p) => p.alive && p.id !== heir.holder), was = st.record.length;
  const nh = M.foundHousehold(st, f, [by.id], by.id, { grain: {} });
  check(!(st.lying || []).some((l) => l.kind === 'estate'), 'the estate is taken up');
  for (const [good, n] of GOODS) check(near(S.heldOf(nh, good), n), `the new household holds the ${good} (${S.heldOf(nh, good)} of ${n})`);
  check(near(S.heldOf(nh, 'stone/granite'), 3) && nh.cloth[2] === 1, 'stone by its rock, cloth by its grade');
  check(nh.larder.some((l) => l.kind === 'dried fish' && near(l.n, 6)) && S.aleOf(st, nh) === 2, 'the larder and the ale');
  check(st.record.slice(was).some((r) => r.kind === 'estate' && r.farm === f.id), 'told on the record');
  VB['sim/claims'].clearClaims(st, f.house); // the birthright spent, as a restoration's move-in does (sim/farmclaims moveIn)
  Sim.refreshRoles(st); const bad2 = checkState(st); check(!bad2.length, `invariants after the founding: ${bad2.slice(0, 2).join('; ')}`);
  out.push(`the estate's ${GOODS.length + 3} goods passed to household ${nh.id} with the farm`);
}

// ---- nobody goes anywhere (by hand: the members are taken off first): the grain is the village's, the wood the frost's ----
{
  const { st, hh, f, grain } = scene();
  for (const id of [...hh.members]) { const p = st.pawns[id]; p.alive = false; p.died = st.t; }
  H.extinct(st, hh);
  const g = (st.lying || []).find((l) => l.kind === 'leftGrain'), w = (st.lying || []).find((l) => l.kind === 'leftTimber');
  check(g && near(g.n, grain) && g.owner.type === 'village' && g.owner.id === f.village, `with no heir the grain is the village's: ${JSON.stringify(g)}`);
  check(w && w.owner.type === 'household' && w.owner.id === hh.id, `and the wood lies the dead household's: ${JSON.stringify(w)}`);
  check((st.lying || []).some((l) => l.kind === 'estate' && l.owner.id === hh.id), 'and its estate');
  const was = st.record.length;
  L.frost(st); L.decay(st, 1);
  const e = (st.lying || []).find((l) => l.kind === 'estate');
  check(e && near(e.of.goods.tar, 2 * 0.75) && near(e.of.goods['stone/granite'], 3 * 0.75) && !('iron' in e.of.goods) && near(e.n, L.estateSize(e.of.goods)),
    `a day's frost wears each good alike, in its own unit (the 0.7 of a bloom, under one, gone): ${JSON.stringify(e && e.of.goods)}`);
  L.decay(st, 47);
  check(!st.lying, 'the frost takes what lies');
  const said = st.record.slice(was).filter((e) => e.kind === 'frost').map((e) => e.text);
  check(said.some((t) => /whose household is gone/.test(t)) && said.length === 3, `the frost names all three: ${said.join(' | ')}`);
  out.push('with no heir: grain the village\'s, wood and the estate for the frost');
}

// ---- a small estate in unlike units (review VB-1697, F1): 6 blooms of iron and 3 lengths of cloth keep three quarters after a frost day,
// though their sum is under the lying quantum of rations ----
{
  const st = tinyState(tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20))), [{ at: [8, 5], farms: 2, sizes: [8, 8] }], { seed: 3 });
  const hh = st.households[st.farmsteads[st.villages[0].farmsteads[1]].household];
  for (const id of [...hh.members]) { const p = st.pawns[id]; p.alive = false; p.died = st.t; }
  for (const k of Object.keys(hh.grain)) hh.grain[k] = 0; hh.wood = 0; hh.meals = 0; hh.flour = 0; hh.larder = [];
  S.put(st, hh, 'iron', 6, 'plot'); S.put(st, hh, 'cloth', 3, { kind: 'plot', grade: 2 });
  H.extinct(st, hh);
  L.frost(st); L.decay(st, 1);
  const e = (st.lying || []).find((l) => l.kind === 'estate');
  check(e && near(e.of.goods.iron, 4.5) && near(e.of.goods.cloth[2], 2.25), `a small estate keeps its share: ${JSON.stringify(e && e.of.goods)}`);
  out.push('a small estate worn by its own goods\' units');
}

if (failed) process.exit(1);
console.log('estate ok: ' + out.join('; '));
