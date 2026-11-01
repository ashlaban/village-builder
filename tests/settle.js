// Moving to new land (VB-146, VB-147): a waiting adult of a crowded village leaves with a sibling who follows and founds a village of one
// farm 10 to 30 walking steps away, in a booth until the cottage is built; the household sows its first field. A village with room founds
// nothing, and a party without provisions stays. With a small village nearby that has room, the settler joins it instead.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, S = VB['sim/settle'];
const { bfs } = VB['sim/hex'], { walkable } = VB['sim/routes'], { SETTLE } = VB['sim/rules'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SETTLE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
// The heirs scenario at seed 7: a waiting adult of village A with an unmarried adult sibling who also waits. Natural deaths off.
function setUp() {
  const st = Sim.seed(world(7), 7, 'heirs'); st.naturalDeaths = false;
  const inA = (p) => p.alive && p.age >= 18 && p.age <= 45 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null;
  const m = st.pawns.find((p) => inA(p) && Sim.siblingsOf(st, p.id).some((q) => inA(st.pawns[q])));
  const sib = m && Sim.siblingsOf(st, m.id).map((q) => st.pawns[q]).find(inA);
  return { st, v: st.villages[0], m, sib };
}
// No room left near village v: every tile within 6 steps is taken.
const fill = (st, v) => { for (const [t] of bfs(st.w, v.center, 6, () => true).dist) st.used.add(t); };
const roll = (st, f) => { const r = st.rand; st.rand = () => 0; try { f(); } finally { st.rand = r; } }; // every chance comes up

// 1. A village with room is not crowded, and nobody leaves.
{
  const { st, v, m, sib } = setUp();
  if (!m || !sib) { console.error('SETTLE FAIL: no waiting siblings in the heirs scenario'); process.exit(1); }
  st.demand = [m.id, sib.id]; m.landWait = 2; m.stake = 300;
  const n = st.villages.length;
  roll(st, () => S.settleRound(st));
  check(v.crowded === 0 && st.villages.length === n && m.landWait === 0, `a village with room founds nothing (crowded ${v.crowded})`);
}
// 2. Crowded (village B lies beyond reach): the settler leaves with the sibling and founds a village 10 to 30 steps away.
const { st, v, m, sib } = setUp();
fill(st, v);
st.demand = [m.id, sib.id]; m.landWait = 2; sib.landWait = 2; m.stake = 300;
const villages = st.villages.length, farms = st.farmsteads.length, households = st.households.length, oldHh = m.household;
roll(st, () => S.settleRound(st));
check(st.villages.length === villages + 1, `a village is founded (${st.villages.length - villages})`);
const nv = st.villages[st.villages.length - 1], f = st.farmsteads[farms], hh = st.households[households];
check(nv && nv.founded && nv.founded.from === v.id && nv.founded.by === m.id, `founded from ${v.name} by the settler (${JSON.stringify(nv.founded)})`);
check(nv.name.startsWith(m.given.endsWith('s') ? m.given : m.given + 's'), `named for the founder (${nv.name})`);
const steps = bfs(st.w, v.center, SETTLE.reach[1], walkable(st.w)).dist.get(nv.center);
check(steps >= SETTLE.reach[0] && steps <= SETTLE.reach[1], `the new village is ${steps} walking steps away`);
check(f && f.village === nv.id && nv.farmsteads.length === 1 && nv.farmsteads[0] === f.id && f.booth && f.booth.i === 0, 'one farm, in a booth');
check(f.fields.length === 0 && f.project && f.project.stage === 'clear', 'the first field is the farm\'s project');
check(hh && hh.holder === m.id && m.household === hh.id && sib.household === hh.id && hh.members.length === 2, 'settler and sibling live there');
check(sib.servant && ['farmhand', 'maid'].includes(sib.role) && m.role === 'farmer', `the sibling serves (${sib.role})`);
check(hh.grain >= 300 && !m.stake, `the stake is the household's grain (${hh.grain})`);
check(!st.households[oldHh].members.includes(m.id), 'the settler left the old household');
check(st.demand.includes(sib.id) && !st.demand.includes(m.id), 'the sibling still wants land, the settler does not');
const s = st.cenv.settlements[nv.id];
check(s && s.id === nv.id && s.culture === st.cenv.settlements[v.id].culture && s.practice.join() === st.cenv.settlements[v.id].practice.join(),
  'the new settlement keeps the mother village\'s culture and practice');
check(m.events.some((e) => e.kind === 'moved' && e.text.includes(nv.name)), 'a moved event names the new village');
check(!st.villages.some((u) => u !== nv && Math.min(...[u.center, ...u.farmsteads.map((id) => st.farmsteads[id].house)]
  .map((t) => VB['sim/hex'].hexSteps(st.w, t, nv.center))) < SETTLE.apart), 'apart from every other village');
let bad = checkState(st); check(!bad.length, `invariants after founding: ${bad.slice(0, 3).join('; ')}`);
// the booth becomes a cottage and the first field is sown within two years
let built = null, sown = null;
for (let d = 0; d < 2 * Sim.YEAR_DAYS && (sown === null || built === null); d++) {
  Sim.advance(st, 24);
  if (built === null && !f.booth) built = d;
  if (sown === null && f.fields.some((fd) => fd.stage !== 'stubble' && fd.stage !== 'plowed')) sown = d;
}
check(built !== null, `the cottage is built (booth ${JSON.stringify(f.booth)})`);
check(sown !== null, `the first field is sown (fields ${f.fields.map((fd) => fd.stage).join(',') || 'none'}, project ${f.project && f.project.stage})`);
bad = checkState(st); check(!bad.length, `invariants after two years: ${bad.slice(0, 3).join('; ')}`);
// 3. No provisions: nobody moves.
{
  const t = setUp(); fill(t.st, t.v);
  t.st.demand = [t.m.id]; t.m.landWait = 3; t.m.stake = 0;
  for (const h of t.st.households) h.grain = 0;
  const n = t.st.villages.length;
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.villages.length === n && t.st.events.some((e) => /cannot spare the grain/.test(e.text)), 'a party without provisions stays');
}
// 4. Founders at seed 42: the lone farm Alsta lies 15 steps from the crowded village. With room there, a waiting adult joins it, building a
// booth, and founds nothing (VB-147); with an adult of its own waiting for land, or no room, it is passed over and the settler founds.
let joined = '';
const founders = () => {
  const st = Sim.seed(world(42), 42, 'founders'); st.naturalDeaths = false;
  const v = st.villages[0], lone = st.villages[1];
  const m = st.pawns.find((p) => p.alive && p.age >= 18 && p.age <= 45 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id)
    && Sim.spouseOf(st, p.id) === null);
  fill(st, v); st.demand = [m.id]; m.landWait = 3; m.stake = 300;
  return { st, v, lone, m };
};
{
  const t = founders(), n = t.st.villages.length, farms = t.lone.farmsteads.length, d = S.reachOf(t.st, t.v).get(t.lone.center);
  roll(t.st, () => S.settleRound(t.st));
  const g = t.st.farmsteads[t.lone.farmsteads[t.lone.farmsteads.length - 1]];
  check(d <= SETTLE.join, `the lone farm lies within ${SETTLE.join} steps (${d})`);
  check(t.st.villages.length === n && t.lone.farmsteads.length === farms + 1 && g.booth && t.st.households[g.household].holder === t.m.id,
    `the settler joins the lone farm's village (villages ${t.st.villages.length - n} new, its farms ${farms} -> ${t.lone.farmsteads.length})`);
  check(g.name === 'Nybygget' && t.st.events.some((e) => e.text.includes(`settles at ${g.name} in ${t.lone.name}`)), `the log says so (${g.name})`);
  bad = checkState(t.st); check(!bad.length, `invariants after joining: ${bad.slice(0, 3).join('; ')}`);
  joined = `; joined ${t.lone.name} ${d} steps away`;
}
{ // an adult of its own waits for land there: the settler founds
  const t = founders(), n = t.st.villages.length;
  const other = t.st.pawns.find((p) => p.alive && p.age >= 18 && p.id !== t.m.id && Sim.settlementIdOf(t.st, p) === 0 && !Sim.isHolder(t.st, p.id));
  VB['sim/heirs'].moveTo(t.st, other.id, t.st.farmsteads[t.lone.farmsteads[0]].household); t.st.demand.push(other.id);
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.villages.length === n + 1 && t.st.villages[n].founded.by === t.m.id, 'with its own adult waiting, the lone farm is passed over');
}
{ // no room at the lone farm either: the settler founds
  const t = founders(), n = t.st.villages.length; fill(t.st, t.lone);
  roll(t.st, () => S.settleRound(t.st));
  check(t.st.villages.length === n + 1 && t.st.villages[n].founded.by === t.m.id, 'with no room at the lone farm, the settler founds');
}
if (failed) process.exit(1);
console.log(`settle ok: ${m.given} founded ${nv.name} ${steps} steps from ${v.name}; cottage built on day ${built}, first field sown on day ${sown}${joined}`);
