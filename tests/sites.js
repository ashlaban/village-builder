// VB-787: settling in steps (design.md, Moving to new land, Settling in steps). On the heirs island of tests/lib/probe.js at seed 13,
// village A crowded: at the round its waiting adult stakes a site for itself and its sibling (nobody moves, no household or village is
// made), blazes the trail, the two clear its tiles and build its cottage from their old household, and they move when its roof is on,
// founding the household and the village then; a party whose home has no grain to spare sends no worker to lodge there; and a save taken
// at each step plays on as the unbroken run.
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/settle'], Sites = VB['sim/sites'];
const { bfs } = VB['sim/hex'], { checkState } = require('./lib/invariants.js');
const probe = require('./lib/probe.js'), { scenario } = probe;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SITES FAIL:', m); } };
const roll = (st, f) => { const rs = new Set(Object.values(st.rng)); rs.forEach((r) => { r.fix = 0; }); try { f(); } finally { rs.forEach((r) => { delete r.fix; }); } };
function setUp() {
  const st = scenario('heirs', 13); st.naturalDeaths = false;
  const inA = (p) => p.alive && p.age >= 18 && p.age <= 45 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null;
  const m = st.pawns.find((p) => inA(p) && Sim.siblingsOf(st, p.id).some((q) => inA(st.pawns[q])));
  const sib = Sim.siblingsOf(st, m.id).map((q) => st.pawns[q]).find(inA);
  const v = st.villages[0];
  for (const [t] of bfs(st.w, v.center, 6, () => true).dist) st.used.add(t);
  for (const u of st.villages) VB['sim/territory'].reckonWood(st, u);
  st.demand = [m.id, sib.id]; m.landWait = 2; sib.landWait = 2; m.stake = 300;
  roll(st, () => S.settleRound(st));
  return { st, v, m, sib, s: st.sites[0] };
}
const told = (st, kind) => st.record.some((e) => e.kind === kind);
// 1. the stake: a site, nobody moved, no household nor village made
const { st, m, sib, s } = setUp();
const villages = st.villages.length, households = st.households.length, home = m.household;
check(s && s.leader === m.id && s.party.all.includes(sib.id) && s.village === null, `a site is staked by the leader for the party (${JSON.stringify(s && s.party)})`);
check(st.villages.length === villages && m.household === home && sib.household === home, 'nobody moves, and no village is made');
check(told(st, 'siteStaked'), 'the stake is told');
check(st.claims.get(s.house).some((c) => c.by.type === 'pawn' && c.by.id === m.id), "the stake is the leader's");
let bad = checkState(st); check(!bad.length, `invariants at the stake: ${bad.slice(0, 3).join('; ')}`);
// 2. to the move, a save taken at each stage (staked, built, roofed) played on beside the unbroken run
const { canon } = require('./lib/canon.js');
const saves = {};
// a save at a stage, loaded into the island made again from its seed, plays three days as the unbroken run does
const playsOn = (stage) => {
  const text = JSON.stringify(Sim.save(st)), data = JSON.parse(text), back = Sim.load(probe.island(data.seed, data), data);
  const ahead = JSON.parse(text), run = Sim.load(probe.island(ahead.seed, ahead), ahead);
  Sim.advance(back, 72); Sim.advance(run, 72);
  for (const k of ['sites', 'households', 'away', 'booths', 'villages']) check(canon(back[k]) === canon(run[k]), `a save at ${stage}: ${k} as the unbroken run`);
};
let moved = null, lodged = 0;
saves[s.stage] = -1; // the save at the stake, before its trail is blazed
playsOn(s.stage);
for (let d = 0; d < 2 * Sim.YEAR_DAYS && moved === null; d++) {
  Sim.advance(st, 24);
  lodged = Math.max(lodged, st.away.filter((a) => a.why === 'site').length);
  if (st.sites.length && !saves[s.stage]) {
    saves[s.stage] = d;
    playsOn(s.stage);
  }
  if (!st.sites.length) moved = d;
  else check(m.household === home, 'the party lives at home until the move');
}
check(moved !== null, `the party moves (site at ${s.stage}, steps ${s.plot.places.map((t) => t.i)}, stage ${s.plot.open})`);
check(st.households.length === households + 1 && m.household !== home && st.households[m.household].holder === m.id, 'the household is founded at the move, the leader its head');
check(st.villages.length === villages + 1, 'the village is founded at the move');
const f = st.farmsteads[st.households[m.household].farmstead];
check(f && !f.booth && !f.shelter, 'its cottage stands: no booth, no shelter');
for (const k of ['siteRoofed', 'left']) check(told(st, k), `the ${k} is told`);
check(Object.values(s.hours).reduce((a, b) => a + b, 0) > 100, `the party worked at the site (${JSON.stringify(s.hours)})`);
bad = checkState(st); check(!bad.length, `invariants after the move: ${bad.slice(0, 3).join('; ')}`);
console.log(`  moved on day ${moved}; at most ${lodged} lodged; saves at ${Object.keys(saves).join(', ')}`);
// 3. a home with no grain to spare sends no worker to lodge
{
  const t = setUp();
  for (const id of t.s.party.all) t.st.pawns[id].stake = 0;
  for (const h of t.st.households) h.grain = { barley: 0 };
  let away = 0;
  for (let d = 0; d < 20; d++) {
    Sim.advance(t.st, 24);
    away += t.st.away.filter((a) => a.why === 'site').length;
  }
  check(away === 0, `nobody lodges from a home with nothing to spare (${away})`);
}
// 4. a leader who dies is followed by the party's next adult, the stake passing to it; with nobody left, the site is given up
{
  const t = setUp(), { killPawn } = VB['sim/lifecycle'];
  killPawn(t.st, t.m.id, 'killed');
  Sim.advance(t.st, 24);
  const s4 = t.st.sites[0];
  check(s4 && s4.leader === t.sib.id && !s4.party.all.includes(t.m.id), `the sibling leads the site (${s4 && s4.leader})`);
  check(told(t.st, 'siteLeader'), 'the new leader is told');
  check(s4 && t.st.claims.get(s4.house).some((c) => c.by.type === 'pawn' && c.by.id === t.sib.id), "the stake is the new leader's");
  let bad4 = checkState(t.st);
  check(!bad4.length, `invariants after the leader's death: ${bad4.slice(0, 3).join('; ')}`);
  killPawn(t.st, t.sib.id, 'killed');
  Sim.advance(t.st, 24);
  check(!t.st.sites.length && told(t.st, 'siteGivenUp'), 'with nobody left to lead, the site is given up');
  const left = t.st.claims.get(s4.house) || [];
  check(!left.some((c) => c.by.type === 'pawn'), 'its stake is dropped');
  bad4 = checkState(t.st);
  check(!bad4.length, `invariants after the site is given up: ${bad4.slice(0, 3).join('; ')}`);
}
// 5. a member who comes to hold a household (here the leader, heir to its parents) leaves the party and stays at its holding: the next
// adult leads, and the move takes no holder from its household (the gate's crash, populous 11: a head who moved left its house headless)
{
  const t = setUp(), { killPawn } = VB['sim/lifecycle'], home5 = t.st.households[t.m.household];
  for (const id of [home5.holder, Sim.spouseOf(t.st, home5.holder)]) if (id !== null) killPawn(t.st, id, 'killed');
  const heir = home5.holder;
  check(t.s.party.all.includes(heir) && Sim.isHolder(t.st, heir), `a member of the party is heir to the home (${heir})`);
  Sim.advance(t.st, 24);
  const s5 = t.st.sites[0];
  check(s5 && !s5.party.all.includes(heir) && s5.leader !== heir, `the heir leaves the party (${s5 && s5.party.all})`);
  for (let d = 0; d < 2 * Sim.YEAR_DAYS && t.st.sites.length; d++) Sim.advance(t.st, 24);
  check(home5.holder === heir && t.st.pawns[heir].household === home5.id, 'the heir stays the head of its household, living there');
  const bad5 = checkState(t.st);
  check(!bad5.length, `invariants after the heir stays: ${bad5.slice(0, 3).join('; ')}`);
}
if (failed) process.exit(1);
console.log('sites ok: staked at the round, built from home, founded at the move');
