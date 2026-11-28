// @suite integration
// Moving to new land (VB-146, VB-147): a waiting adult of a crowded village leaves with a sibling who follows and founds a village of one
// farm within SETTLE.hours along a trail (VB-786), in a booth until the cottage is built; the household sows its first field. A village with room founds
// nothing, and a party without provisions stays. With a small village nearby that has room, the settler joins it instead. On the small
// islands of tests/lib/probe.js since VB-856 (heirs at seed 13, the 48 by 34 island's first seed whose crowded village founds; on the default
// island it was seed 7).
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/settle'];
const { bfs } = VB['sim/hex'], { walkable } = VB['sim/walking'], { SETTLE, SPEED } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SETTLE FAIL:', m); } };
const { scenario } = require('./lib/probe.js');
// The heirs scenario at seed 13: a waiting adult of village A with an unmarried adult sibling who also waits. Natural deaths off.
function setUp() {
  const st = scenario('heirs', 13); st.naturalDeaths = false;
  const inA = (p) => p.alive && p.age >= 18 && p.age <= 45 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null;
  const m = st.pawns.find((p) => inA(p) && Sim.siblingsOf(st, p.id).some((q) => inA(st.pawns[q])));
  const sib = m && Sim.siblingsOf(st, m.id).map((q) => st.pawns[q]).find(inA);
  return { st, v: st.villages[0], m, sib };
}
// No room left near village v: every tile within 6 steps is taken (and the villages' woods reckoned again, VB-326, as a tile built on is).
const fill = (st, v) => {
  for (const [t] of bfs(st.w, v.center, 6, () => true).dist) st.used.add(t);
  for (const u of st.villages) VB['sim/territory'].reckonWood(st, u);
};
const roll = (st, f) => { const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } }; // every chance comes up

// Spatial occupancy is the union of radius searches, including overlaps, duplicate marks and map edges.
// Ownership/claims exclude sites but do not create a building's separation radius.
{
  const { tinyWorld } = require('./lib/tiny.js'), assert = require('assert');
  const w = tinyWorld(Array(12).fill('.'.repeat(16)));
  const marks = [0, 1, 17, 18, w.N - 1], owned = 100, claimed = 105, used = 110;
  const state = { w, used: new Set([used]), owner: new Int32Array(w.N), claims: new Map([[claimed, []]]),
    villages: [{ center: 0, plots: [{ tiles: [{ tile: 1, kind: 'house' }, { tile: 17, kind: 'field' }] }] }],
    farmsteads: [{ house: 0, fields: [{ tile: 1 }, { tile: 18 }], household: 0 }],
    plans: { projects: { household: new Map([[0, [{ steps: [{ place: w.N - 1 }], open: 0 }]]]), village: new Map(), pawn: new Map(), heirPlots: [] } } }; // its project (VB-123)
  state.owner[owned] = 1;
  const use = S.landInUse(state), expected = new Set();
  for (const t of marks) for (const [j] of bfs(w, t, SETTLE.apart - 1, () => true).dist) expected.add(j);
  assert.deepStrictEqual(use.near, expected, 'overlapping radius searches must have identical membership');
  assert.deepStrictEqual(use.taken, new Set([used, owned, claimed, ...marks]));
  state.villages = []; state.farmsteads = [];
  assert.strictEqual(S.landInUse(state).near.size, 0, 'unbuilt owned/claimed land has no separation radius');
}

// 1. A village with room is not crowded, and nobody leaves.
{
  const { st, v, m, sib } = setUp();
  if (!m || !sib) { console.error('SETTLE FAIL: no waiting siblings in the heirs scenario'); process.exit(1); }
  st.demand = [m.id, sib.id]; m.landWait = 2; m.stake = 300;
  const n = st.villages.length;
  roll(st, () => S.settleRound(st));
  check(v.crowded === 0 && st.villages.length === n && m.landWait === 0, `a village with room founds nothing (crowded ${v.crowded})`);
}
// 2. Crowded (village B lies beyond reach): the settler leaves with the sibling and founds a village within SETTLE.hours along a trail.
const { st, v, m, sib } = setUp();
fill(st, v);
st.demand = [m.id, sib.id]; m.landWait = 2; sib.landWait = 2; m.stake = 300;
const villages = st.villages.length, farms = st.farmsteads.length, households = st.households.length, oldHh = m.household;
roll(st, () => S.settleRound(st));
// VB-787: the round stakes the site; the party builds it from home and moves when its cottage has its roof
check(st.sites.length === 1 && st.villages.length === villages && m.household === oldHh, 'a site is staked, and nobody moves yet');
for (let d = 0; d < 2 * Sim.YEAR_DAYS && st.sites.length; d++) Sim.advance(st, 24);
check(st.villages.length === villages + 1, `a village is founded (${st.villages.length - villages})`);
const nv = st.villages[st.villages.length - 1], f = st.farmsteads[farms], hh = st.households[households];
check(nv && nv.founded && nv.founded.from === v.id && nv.founded.by === m.id, `founded from ${v.name} by the settler (${JSON.stringify(nv.founded)})`);
{ // by its founder or from its mother village (VB-400), one of the names the generators offer for the site
  const N = VB['sim/names'], nctx = { w: st.w, site: nv.center, founder: m, mother: v }, r = () => N.tileRand(nv.center, 1);
  check([...N.founder(nctx, r()), ...N.mother(nctx, r())].includes(nv.name), `named for the founder or the mother village (${nv.name})`);
}
const trail = VB['sim/routes'].trailReach(st.w, v.center, SETTLE.hours * SPEED).get(nv.center) / SPEED;
check(trail <= SETTLE.hours && VB['sim/hex'].hexSteps(st.w, v.center, nv.center) >= SETTLE.centreApart, `the new village is ${trail.toFixed(1)} hours away along a trail`);
check(f && f.village === nv.id && nv.farmsteads.length === 1 && nv.farmsteads[0] === f.id && f.rung !== 'shelter', 'one farm, its cottage built');
check(f.name === nv.name, `the farm bears the new village's name (${f.name}, ${nv.name})`);
check(f.fields.length === 1 || !!VB['sim/projects'].openOf(st, hh.id), 'the first field is broken, or the household\'s project plan');
check(hh && hh.holder === m.id && m.household === hh.id && sib.household === hh.id && hh.members.length === 2, 'settler and sibling live there');
check(sib.servant && ['farmhand', 'maid'].includes(sib.role) && m.role === 'farmer', `the sibling serves (${sib.role})`);
// the stake less a day's ration a head, eaten uncooked on the journey (VB-287, sim/agents setOut)
const journeyFood = hh.members.reduce((n, id) => n + (st.pawns[id].age >= 14 ? st.ECON.ration.adult : st.ECON.ration.child), 0) / st.ECON.uncooked;
// VB-675: it lies at the old home as the new household's, and the party bears it there a load at a time: nothing is in the new store yet
const oldHouse = st.farmsteads[st.households[oldHh].farmstead].house;
const bearing = () => st.away.filter((j) => j.why === 'fetch' && j.gift && j.gift.to === hh.id);
const lies = () => bearing().reduce((n, j) => n + j.gift.held + j.gift.stops.reduce((k, x) => k + x.left, 0), 0);
check(!m.stake, 'the stake is taken as provisions at the move');
check(!st.households[oldHh].members.includes(m.id), 'the settler left the old household');
check(st.demand.includes(sib.id) && !st.demand.includes(m.id), 'the sibling still wants land, the settler does not');
const s = st.cenv.settlements[nv.id];
check(s && s.id === nv.id && s.culture === st.cenv.settlements[v.id].culture && s.practice.join() === st.cenv.settlements[v.id].practice.join(),
  'the new settlement keeps the mother village\'s culture and practice');
check(Sim.recordOf(st, { pawn: m.id, life: true }).some((e) => e.kind === 'joined' && e.text.includes(nv.name)), 'a moved event names the new village');
check(!st.villages.some((u) => u !== nv && Math.min(...[u.center, ...u.farmsteads.map((id) => st.farmsteads[id].house)]
  .map((t) => VB['sim/hex'].hexSteps(st.w, t, nv.center))) < SETTLE.apart), 'apart from every other village');
let bad = checkState(st); check(!bad.length, `invariants after founding: ${bad.slice(0, 3).join('; ')}`);
// the booth becomes a cottage and the first field is sown within two years
let built = null, sown = null, came = null, borne = null;
for (let d = 0; d < 2 * Sim.YEAR_DAYS && (sown === null || built === null || borne === null); d++) {
  Sim.advance(st, 24);
  if (came === null && Sim.grainOf(hh) > 0) came = d;
  if (borne === null && !bearing().length) borne = d;
  if (built === null && f.rung !== 'shelter') built = d;
  if (sown === null && f.fields.some((fd) => fd.stage !== 'stubble' && fd.stage !== 'plowed')) sown = d;
}
check(came !== null && borne !== null && hh.ledger.some((e) => e.good === 'grain' && e.n > 0 && e.kind === 'provisions'),
  `the grain comes in as it is borne (the first on day ${came}, all by day ${borne})`);
check(built !== null, `the cottage is built (booth ${JSON.stringify(f.rung === 'shelter')})`);
check(sown !== null, `the first field is sown (fields ${f.fields.map((fd) => fd.stage).join(',') || 'none'}, project ${VB['sim/projects'].openOf(st, f.household)?.kind})`);
bad = checkState(st); check(!bad.length, `invariants after two years: ${bad.slice(0, 3).join('; ')}`);
// 3. No provisions: nobody moves.
{
  const t = setUp(); fill(t.st, t.v);
  t.st.demand = [t.m.id]; t.m.landWait = 3; t.m.stake = 0;
  for (const h of t.st.households) h.grain = { barley: 0 };
  const n = t.st.villages.length;
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.villages.length === n && t.st.sites.length === 1 && !VB['sim/settle'].provisions(t.st, t.st.sites[0].party.all), 'a party without provisions stakes its site, and its move waits for them (VB-787)');
}
// 3b. A home that took in a spouse at this round gives no provisions (VB-330); the next round it gives, and one that did not marry gives as before.
{
  const t = setUp(), hh = t.st.households[t.m.household], party = [t.m.id];
  t.m.stake = 0; hh.grain = { barley: 4000 };
  check(S.provisions(t.st, party) !== null, 'a home that did not marry gives its grain');
  const bride = t.st.pawns.find((p) => p.alive && p.household !== hh.id && Sim.spouseOf(t.st, p.id) === null && p.age >= 18);
  t.st.unions.push({ id: t.st.unions.length, a: t.sib.id, b: bride.id, start: t.st.t - (t.st.t % 24), end: null, kind: 'marriage' });
  check(S.provisions(t.st, party) === null, 'a home that took in a spouse at this round, on an earlier step of its day, gives nothing');
  t.st.t += 30 * 24; // the next round
  check(S.provisions(t.st, party) !== null, 'the next round it gives');
}
// 4. Founders (at foundersSeed): a lone farm lies within reach from the crowded village. With room there, `smallVillage` offers it (VB-147), and
// a plot there is asked of its alderman on the asking day (VB-697; tests/farmclaims.js), not joined unasked: the round founds. With an adult
// of its own waiting for land, or no room, it is passed over.
let joined = '';
// The founders' two unmarried young are 16 to 19 and live on either farm by the seed's draw, so the first seed is taken where one of age
// lives in the village (seed 7 had one until the villages were laid out anew, VB-402). Since VB-786 the lone farm is joined within
// SETTLE.join hours by the villages' table and a site found within SETTLE.hours along a trail: the probe island is rough, and of seeds 1
// to 80 these are the ones where both hold (at seed 7 the lone farm lies 10.3 hours off and no site lies within 6 hours).
const grown = (st) => st.pawns.find((p) => p.alive && p.age >= 18 && p.age <= 45 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id)
  && Sim.spouseOf(st, p.id) === null);
const foundersSeed = [32, 35, 49, 73].find((seed) => grown(scenario('founders', seed)));
const founders = () => {
  const st = scenario('founders', foundersSeed); st.naturalDeaths = false;
  const v = st.villages[0], lone = st.villages[1], m = grown(st);
  fill(st, v); st.demand = [m.id]; m.landWait = 3; m.stake = 300;
  return { st, v, lone, m };
};
{
  const t = founders(), n = t.st.villages.length, d = VB['sim/villagehours'].hoursBetween(t.st, t.v.id, t.lone.id);
  const small = S.smallVillage(t.st, t.v, t.m, S.waitingByVillage(t.st));
  check(d <= SETTLE.join && small && small.village === t.lone, `the lone farm lies within ${SETTLE.join} hours (${d.toFixed(1)}) and is the small village offered`);
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.sites.length === 1 && t.st.sites[0].leader === t.m.id && t.st.sites[0].village === null && t.lone.farmsteads.length === 1, 'the round stakes a new village\'s site, and joins nobody unasked');
  bad = checkState(t.st); check(!bad.length, `invariants after founding: ${bad.slice(0, 3).join('; ')}`);
  joined = `; the lone village ${t.lone.name} ${d.toFixed(1)} hours away is offered, not joined`;
}
{ // an adult of its own waits for land there: the settler founds
  const t = founders(), n = t.st.villages.length;
  const other = t.st.pawns.find((p) => p.alive && p.age >= 18 && p.id !== t.m.id && Sim.settlementIdOf(t.st, p) === 0 && !Sim.isHolder(t.st, p.id));
  VB['sim/heirs'].moveTo(t.st, other.id, t.st.farmsteads[t.lone.farmsteads[0]].household); t.st.demand.push(other.id);
  check(S.smallVillage(t.st, t.v, t.m, S.waitingByVillage(t.st)) === null, 'with its own adult waiting, the lone farm is passed over');
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.sites.length === 1 && t.st.sites[0].leader === t.m.id && t.st.sites[0].village === null, 'and the settler stakes a new village\'s site');
}
{ // no room at the lone farm either: the settler founds
  const t = founders(), n = t.st.villages.length; fill(t.st, t.lone);
  check(S.smallVillage(t.st, t.v, t.m, S.waitingByVillage(t.st)) === null, 'with no room at the lone farm, it is passed over');
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.sites.length === 1 && t.st.sites[0].leader === t.m.id && t.st.sites[0].village === null, 'and the settler stakes a new village\'s site');
}
// 5. The wish to settle (VB-392, on VB-680's wishes): true passes the draws to lead and to follow, false never leads or follows, null
// draws as before; the round's other rules decide as for anyone. Every pawn holds it; the played pawn's is set by the wish verb.
{
  const Wi = VB['sim/wishes'];
  const never = (st, f) => { const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0.9999; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } };
  const scene = (wm, ws, how) => {
    const t = setUp(); fill(t.st, t.v);
    t.st.demand = [t.m.id, t.sib.id]; t.m.landWait = 2; t.sib.landWait = 2; t.m.stake = 300;
    if (wm !== null) Wi.setWish(t.st, t.m.id, 'settle', wm);
    if (ws !== null) Wi.setWish(t.st, t.sib.id, 'settle', ws);
    const n = t.st.villages.length;
    how(t.st, () => S.settleRound(t.st));
    const s = t.st.sites[0];
    return { led: !!s && s.leader === t.m.id && t.st.villages.length === n, followed: !!s && s.party.all.includes(t.sib.id), st: t.st };
  };
  let r = scene(null, null, never);
  check(!r.led, 'with no wish and the draws against it, nobody leaves');
  r = scene(true, null, never);
  check(r.led && !r.followed, `wishing to settle, the settler leads past the draw, and the sibling with no wish stays by its draw (${JSON.stringify(r)})`);
  r = scene(true, true, never);
  check(r.led && r.followed, 'and a sibling who wishes to settle follows past the draw');
  r = scene(false, null, roll);
  check(!r.led, 'wishing never to settle, the settler does not lead though every chance comes up');
  r = scene(null, false, roll);
  check(r.led && !r.followed, 'and a sibling who wishes never to settle does not follow');
  check(checkState(r.st).length === 0, `invariants after the wishes to settle: ${checkState(r.st).slice(0, 3)}`);
  // the played pawn's, by the wish verb: the same record
  const t = setUp(); Sim.inhabit(t.st, t.m.id);
  check(Sim.wish(t.st, t.st.player.pawn, 'settle', true) === true && Sim.wishesOf(t.st, t.m.id).settle === true && Wi.wishOf(t.st, t.m.id, 'settle') === true,
    'the player wishes its pawn to settle, on the pawn');
  check(typeof Sim.wish(t.st, t.st.player.pawn, 'settle', 3) === 'string', 'settle is null, true or false');
}
if (failed) process.exit(1);
console.log(`settle ok: ${m.given} founded ${nv.name} ${trail.toFixed(1)} hours along a trail from ${v.name}; cottage built on day ${built}, first field sown on day ${sown}${joined}`);
