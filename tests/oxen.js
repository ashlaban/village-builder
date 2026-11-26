// Oxen at the plough (VB-138): a household with two oxen has a team; the first hand on its earliest hoeing or breaking job works at 2.5
// times, the others at their own rate; the team is in one field at a time; the pawn panel says "Ploughing with the oxen". Founders at seed 7:
// the oxen's farm breaks and hoes its fields in fewer hours than the farms without.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, H = VB['sim/herds'], A = VB['sim/agents'], J = VB['sim/jobs'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('OXEN FAIL:', m); } };
// the small island of tests/lib/probe.js (VB-862: a 120 by 85 and a 180 by 130 map took 1.5 s)
const world = (seed) => require('./lib/probe.js').island(seed);
const T = Sim.HERD.team;

// --- populous tiny at seed 7: a household with a team and one without, each hoeing a field by hand
const st = Sim.seed(world(7), 7, 'populous');
const live = st.households.filter((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 2);
const withT = live.find((h) => H.team(st, h)), without = live.find((h) => !H.team(st, h) && h.members.length >= 2);
check(withT && without, 'no household with a team and one without');
const ox = H.team(st, withT);
check(ox.length === T.oxen && ox.every((h) => h.kind === 'ox'), 'a team is not two oxen');
function hoe(hh, fieldIx, hands) {
  const f = st.farmsteads[hh.farmstead], fd = f.fields[fieldIx];
  const j = J.post(st, `plow:test${hh.id}.${fieldIx}`, 'plow', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
  const ags = hands.map((id) => st.agents[id]);
  // each arrives at the field (VB-472: the task's rate is reckoned as a hand joins)
  // (VB-1750: it stands at its spot on the field first: the task's next step is read from where it stands)
  const K = VB['sim/kinds'].KINDS.plow, spot = (a) => (K.spot ? K.spot(st, a, j) : [st.w.hx[j.site], st.w.hy[j.site]]);
  for (const a of ags) { A.release(st, a); j.claims.push(a.id); a.job = j; a.path = null; a.inside = false; VB['sim/legs'].putAt(st, a, ...spot(a)); A.arrived(st, a); }
  return { j, ags };
}
const rate = (a) => VB['sim/work'].rateOf(st, st.pawns[a.id]) * (a.pace ?? 1); // the hand's rate over its work leg: skill and mishap (VB-475)
const adults = (hh) => hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 14);
let { j, ags } = hoe(withT, 0, adults(withT).slice(0, 2));
check(VB['sim/work'].withOxen(st, ags[0]) && !VB['sim/work'].withOxen(st, ags[1]), 'the team is not with the first hand only');
const want = rate(ags[0]) * T.rate + rate(ags[1]);
check(Math.abs(j.rate - want) < 1e-9, `with oxen: ${j.rate.toFixed(4)} hours an hour, wanted ${want.toFixed(4)}`);
check(Sim.describe(st, ags[0].id) === 'Ploughing with the oxen' && Sim.describe(st, ags[1].id) === 'Hoeing a field', 'the pawn panel lines');
// a second field: the team stays in the first
const second = hoe(withT, 1, adults(withT).slice(2, 3));
if (second.ags.length) check(!VB['sim/work'].withOxen(st, second.ags[0]), 'the team in two fields at once');
// a household without a team hoes by hand
const other = hoe(without, 0, adults(without).slice(0, 1));
check(Math.abs(other.j.rate - rate(other.ags[0])) < 1e-9 && !VB['sim/work'].withOxen(st, other.ags[0]), 'oxen for a household without a team');
// the team goes to the field: the first job ends, the second job's first hand takes the oxen
for (const a of ags) A.release(st, a);
if (second.ags.length) check(VB['sim/work'].withOxen(st, second.ags[0]), 'the team does not move to the next field');
if (second.ags.length) check(Math.abs(second.j.rate - rate(second.ags[0]) * T.rate) < 1e-9, `the next field's rate ${second.j.rate} is not reckoned with the team`);
// VB-472: the first task's work done (not its hands let go), the next task takes the team at once, from that step
for (const q of [j, second.j]) { for (const id of [...q.claims]) A.release(st, st.agents[id]); A.dropJob(st, q); }
{
  const two = adults(withT).slice(0, 2), first = hoe(withT, 0, two.slice(0, 1)), next = hoe(withT, 1, two.slice(1, 2));
  check(first.j.id < next.j.id && VB['sim/work'].withOxen(st, first.ags[0]) && !VB['sim/work'].withOxen(st, next.ags[0]), 'the team is with the first task');
  check(Math.abs(next.j.rate - rate(next.ags[0])) < 1e-9, `the next task is rated with the team while the first holds it (${next.j.rate})`);
  first.j.done = first.j.hours ?? Sim.KINDS.plow.hours;
  A.complete(st, first.ags[0]);
  check(VB['sim/work'].withOxen(st, next.ags[0]) && Math.abs(next.j.rate - rate(next.ags[0]) * T.rate) < 1e-9,
    `the team is not handed on as the first task ends (rate ${next.j.rate}, wanted ${rate(next.ags[0]) * T.rate})`);
}

// --- founders at seed 7, small map, 2 years: tilling done per pawn-hour of breaking and hoeing, the oxen's farm against the others
const s2 = Sim.seed(world(7), 7, 'founders');
const hours = new Map(), work = new Map(), teamHH = s2.households.find((h) => H.team(s2, h));
for (let k = 0; k < 2 * Sim.YEAR * 10; k++) {
  const was = new Map(); for (const q of s2.jobs.values()) if (T.kinds.includes(q.kind)) was.set(q, q.done);
  Sim.advance(s2, 0.1);
  for (const [q, d] of was) work.set(q.owner.id, (work.get(q.owner.id) || 0) + q.done - d);
  for (const a of s2.agents) if (a.job && (a.leg && a.leg.kind === 'work') && T.kinds.includes(a.job.kind)) hours.set(a.job.owner.id, (hours.get(a.job.owner.id) || 0) + 0.1);
}
const per = (h) => (work.get(h.id) || 0) / Math.max(1e-9, hours.get(h.id) || 0); // work hours done per pawn-hour
const others = s2.households.filter((h) => h !== teamHH && hours.get(h.id));
// by hand a household works at most at its fastest hand's pace (VB-475: skill and no mishap), the team well above it
const byHand = VB['sim/skills'].paceOf(1, 0) + 0.01;
check(teamHH && per(teamHH) > 1.25 && others.every((h) => per(h) < byHand && per(h) < per(teamHH)), `rates ${s2.households.map((h) => `${h.id} ${per(h).toFixed(2)}`).join(', ')}`);
const field = Sim.KINDS.plow.hours;
console.log(`oxen ok: founders 7, 2 years, pawn-hours to hoe a ${field}-hour field: with the oxen ${(field / per(teamHH)).toFixed(1)}, ` +
  `by hand ${others.map((h) => (field / per(h)).toFixed(1)).join(', ')}`);
if (failed) process.exit(1);
