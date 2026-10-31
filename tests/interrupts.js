// More urgent work interrupts a job (VB-107): at a full hour a son hoeing leaves the field for the woods when the woodpile drops under 8
// (firewood urgency 2.2), and the field keeps its progress; the farmer keeps hoeing (his firewood bid stays under 1.5 × his hoeing + 1);
// a job the pawn would finish within the hour is not left.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('INTERRUPTS FAIL:', m); } };
const it = G.generate(7); let r; while (!(r = it.next()).done);
const world = r.value;
// Heirs seed 7, Södergården (farmer, wife, a son of 29) on spring day 0. The scene starts at the first half hour at which the farmer and
// the son are both hoeing, so it does not depend on when they take their first jobs (that moves with every change to the random draws).
const hoeing = (a) => !!a.job && a.job.kind === 'plow' && a.phase === 'work';
function morning() {
  const st = Sim.seed(world, 7, 'heirs'), hh = st.households[0];
  for (const id of hh.members.slice(3)) { const p = st.pawns[id]; p.died = st.t; p.alive = false; }
  hh.members = hh.members.slice(0, 3);
  const [farmer, , son] = hh.members.map((id) => st.agents[id]);
  Sim.advance(st, Math.floor(st.t) + 0.5 - st.t);
  while (!(hoeing(farmer) && hoeing(son)) && st.t < 15) Sim.advance(st, 1);
  return { st, hh, farmer, son };
}
{
  const { st, hh, farmer, son } = morning();
  check(son.job && son.job.kind === 'plow' && son.phase === 'work', `the son is not hoeing by 15:00 (${son.job && son.job.kind}, ${son.phase})`);
  check(farmer.job && farmer.job.kind === 'plow' && farmer.phase === 'work', 'the farmer is not hoeing by 15:00');
  const field = son.job, done = field.done;
  hh.wood = 5;
  Sim.advance(st, 0.55); // past the full hour, when working pawns look up
  check(son.job && son.job.kind === 'wood', `the son did not leave the field for the woods (${son.job && son.job.kind})`);
  check(st.jobs.get(field.key) === field && field.done >= done && !field.claims.includes(son.id), 'the field job lost its place or progress');
  check(farmer.job && farmer.job.kind === 'plow', `the farmer left hoeing (${farmer.job && farmer.job.kind})`);
}
{
  const { st, hh, son } = morning(), field = son.job, hours = field.hours ?? Sim.KINDS.plow.hours;
  const n = field.claims.filter((id) => st.agents[id].phase === 'work').length;
  field.done = hours - 0.8 - 0.5 * n; // 0.8 h of work left at the full hour, under an hour at the son's rate (1)
  hh.wood = 5;
  Sim.advance(st, 0.55);
  check(son.job === field && field.done < hours, `the son left a field he would finish within the hour (${son.job && son.job.kind}, ${field.done} of ${hours})`);
}
console.log('interrupts ok');
if (failed) process.exit(1);
