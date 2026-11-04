// Claims on empty farms (VB-033, sim/farmclaims) on a tiny world: the hours to restore a farm by its condition; the old family's birthright
// when a farm empties, and its lapse; who may claim an empty farm, and in what order, under each option of the "Claims on empty farms" custom.
const VB = require('../src/load.js'), Sim = VB.sim, FC = VB['sim/farmclaims'], CL = VB['sim/claims'], H = VB['sim/heirs'];
const { CLAIMS, YEAR } = VB['sim/rules'], { setPractice, tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FARMCLAIMS FAIL:', m); } };
// Fixtures jump time and call low-level acts directly; finish the coordinator's role refresh before checking a completed state.
const ok = (st, label) => { Sim.refreshRoles(st); const bad = checkState(st); check(!bad.length, `${label}: invariants: ${bad.slice(0, 2).join('; ')}`); };
const out = [];

// ---- restoration hours: straight lines through 0 h at 100%, 20 h at 40%, 60 h at 15% and 120 h at 0% (Kim, 30 Oct) ----
{
  const want = [[1, 0], [0.9, 10 / 3], [0.4, 20], [0.3, 36], [0.15, 60], [0, 120]];
  for (const [c, h] of want) check(Math.abs(FC.restoreHours(c) - h) < 1e-9, `restoreHours(${c}) = ${FC.restoreHours(c)}, wanted ${h}`);
  out.push('restoration 3.3 h at 90%, 36 h at 30%');
}

// A row of three villages: A (3 farms) and B (2 farms) 11 steps apart, C (1 farm) 33 steps from A. B's second farm (household 4) empties.
// Its last holder's grown children are the old family: Gunhild 19 (married to Jöns 20 of B's other farm), Olof 21, and Brita 23, gone to
// serve in A. B's other villagers: Kerstin 23 and Cecilia 26. Gunnar of A, made 30; Per of C, out of reach. Ids as the tiny world draws them.
function scene(rule) {
  const map = Array.from({ length: 10 }, () => '.'.repeat(44));
  const st = tinyState(tinyWorld(map), [{ at: [5, 5], farms: 3, sizes: [8, 8, 8] }, { at: [16, 5], farms: 2, sizes: [8, 8] }, { at: [38, 5], farms: 1, sizes: [8] }],
    { seed: 4 });
  const P = (given, age, v) => {
    const p = st.pawns.find((q) => q.alive && q.given === given && q.age === age && VB['sim/records'].settlementIdOf(st, q) === v);
    if (!p) throw new Error(`no ${given} ${age} in village ${v}`);
    return p.id;
  };
  const who = { gunhild: P('Gunhild', 19, 1), olof: P('Olof', 21, 1), brita: P('Brita', 23, 1), jons: P('Jöns', 20, 1), kerstin: P('Kerstin', 23, 1),
    cecilia: P('Cecilia', 26, 1), gunnar: P('Gunnar', 19, 0), per: P('Per', 22, 2) };
  const empty = st.households[4], f = st.farmsteads[empty.farmstead], last = empty.holder;
  H.extinct(st, empty);
  const B0 = st.farmsteads[st.villages[1].farmsteads[0]].household, A0 = st.farmsteads[st.villages[0].farmsteads[0]].household;
  for (const id of [who.gunhild, who.olof]) if (st.pawns[id].household !== B0) H.moveTo(st, id, B0);
  H.moveTo(st, who.brita, A0);
  st.unions.push({ id: st.unions.length, a: who.jons, b: who.gunhild, start: st.t, end: null, kind: 'marriage' });
  st.pawns[who.gunnar].born -= 11 * YEAR; st.pawns[who.gunnar].age = 30;
  if (rule) setPractice(st, 1, { claims: rule });
  st.demand = Object.values(who).concat(st.households[B0].holder); // a holder among them, who may not claim
  return { st, f, last, who };
}
const names = (st, ids) => ids.map((id) => st.pawns[id].given).join(', ');

// ---- the birthright: the last holder's family holds a realised claim on the house for 20 years ----
{
  const { st, f, last } = scene('kin');
  const c = FC.birthrightOn(st, f);
  check(c && c.state === 'realised' && c.by.type === 'pawn' && c.by.id === last && c.until === st.t + CLAIMS.birthrightYears * YEAR,
    `a birthright by the last holder until 20 years on: ${JSON.stringify(c)}`);
  check(f.state === 'derelict' && FC.claimable(f), 'the empty farm may be claimed');
  ok(st, 'birthright');
  st.t += CLAIMS.birthrightYears * YEAR - 1; CL.lapseClaims(st);
  check(FC.birthrightOn(st, f), 'still standing just before 20 years');
  st.t += 1; CL.lapseClaims(st);
  check(!FC.birthrightOn(st, f), 'lapsed after 20 years');
  f.state = 'ruin';
  check(!FC.claimable(f), 'a ruin is left out of claims until the full rebuild');
  out.push('a birthright for 20 years');
}

// ---- the order under each custom ----
const orders = {};
for (const rule of ['kin', 'villagers', 'anyone', 'assembly']) {
  const { st, f, who } = scene(rule);
  if (rule === 'assembly') for (const p of Sim.membersOf(st, 1)) { p.ties.clear(); if (p.id !== who.olof) p.ties.set(who.olof, 1); }
  const list = FC.claimants(st, f);
  orders[rule] = names(st, list);
  const w = who, want = {
    // kin of the old family first (Brita from A too), the married one first; then B's villagers, oldest first; not Gunnar or Per
    kin: [w.gunhild, w.brita, w.olof, w.cecilia, w.kerstin],
    // B's villagers (the couple first, as Jöns, the older), then those of a village within reach (Brita in A, Gunnar of A), oldest first
    villagers: [w.jons, w.cecilia, w.kerstin, w.olof, w.gunnar, w.brita],
    // anyone within reach: the couple, then by age (Brita a few months older than Kerstin)
    anyone: [w.jons, w.gunnar, w.cecilia, w.brita, w.kerstin, w.olof],
    // the meeting: its own villagers, Olof with its voices behind him first
    assembly: [w.olof, w.jons, w.cecilia, w.kerstin],
  }[rule];
  check(names(st, list) === names(st, want), `${rule}: ${names(st, list)}; wanted ${names(st, want)}`);
  ok(st, rule);
}
// once the birthright lapses, `kin` puts no family first: the farm is open to the villagers
{
  const { st, f, who } = scene('kin');
  st.t += CLAIMS.birthrightYears * YEAR; CL.lapseClaims(st);
  const list = FC.claimants(st, f);
  check(names(st, list) === names(st, [who.jons, who.cecilia, who.kerstin, who.olof]), `kin, lapsed: ${names(st, list)}`);
}
out.push(`orders: ${Object.entries(orders).map(([k, v]) => `${k} ${v}`).join('; ')}`);

// ---- the claim: at the moving round the first claimant takes the farm, mends it and moves in ----
const J = VB['sim/jobs'], X = VB['sim/expansion'], { KINDS } = VB['sim/kinds'], { cal, SEASON_DAYS, DAY } = VB['sim/rules'];
const P = (id) => ({ type: 'pawn', id });
{
  const { st, f, who } = scene('kin');
  const holder = st.demand[st.demand.length - 1];
  check(FC.claimableFarm(st, who.gunhild) === f && FC.claimableFarm(st, holder) === null && FC.claimableFarm(st, who.per) === null,
    'claimableFarm: the farm for a claimant, none for a holder or for one out of reach');
  f.condition = 0.3; f.fields[0].stage = 'fallow'; f.fields[1].stage = 'scrub';
  const n = st.events.length;
  FC.claimFarms(st);
  const c = CL.claimOf(st, f.house, P(who.gunhild));
  check(f.claim && f.claim.by === who.gunhild && Math.abs(f.claim.hours - 36) < 1e-9 && c && c.why === 'farm' && c.state === 'unrealised',
    `Gunhild claims the farm, 36 hours to mend at 30% (${JSON.stringify(f.claim)})`);
  check(!st.demand.includes(who.gunhild) && !st.demand.includes(who.jons), 'the claimant and her husband no longer wait for land');
  check(st.events.slice(0, st.events.length - n).some((e) => /claims the empty farm .* birthright/.test(e.text)), 'the log tells the claim, by birthright');
  check(FC.claimableFarm(st, who.olof) === null && !VB['sim/heirs'].wantsOut(st, st.pawns[who.gunhild]), 'a claimed farm is claimable no more');
  ok(st, 'claimed');
  // the restoration job: the claimant's household's, at 9 for the couple and 5 for grown housemates
  st.t += 10; J.refreshJobs(st, cal(st.t));
  const hid = st.pawns[who.gunhild].household, job = st.jobs.get(`restore:f${f.id}.h${hid}`);
  check(job && job.owner.type === 'household' && job.owner.id === hid && job.hours === f.claim.hours, 'a restoration job owned by the claimant\'s household');
  const FCp = (id) => FC.claimPrio(st, st.pawns[id], job);
  check(FCp(who.gunhild) === CLAIMS.claimantPrio && FCp(who.jons) === CLAIMS.claimantPrio && FCp(who.kerstin) === CLAIMS.helperPrio,
    `priorities: claimant ${FCp(who.gunhild)}, spouse ${FCp(who.jons)}, housemate ${FCp(who.kerstin)}`);
  // progress is kept: worked 20 hours, then the claimant moves house; the job goes on from there under the new household
  job.done = 20; st.t += 1; J.refreshJobs(st, cal(st.t));
  check(f.claim.done === 20, 'hours done are kept on the claim');
  const A0 = st.farmsteads[st.villages[0].farmsteads[1]].household;
  for (const id of [who.gunhild, who.jons]) H.moveTo(st, id, A0);
  st.t += 1; J.refreshJobs(st, cal(st.t));
  const job2 = st.jobs.get(`restore:f${f.id}.h${A0}`);
  check(job2 && job2.done === 20 && !st.jobs.has(`restore:f${f.id}.h${hid}`), 'moved house: the job goes on at 20 hours, the old one is gone');
  st.t += YEAR; KINDS.restore.worked(st, job2);
  check(CL.strength(st, CL.claimOf(st, f.house, P(who.gunhild))) === 1, 'work on the farm renews the claim');
  // the roof mended: they move in, their old household able to spare their start
  st.households[A0].grain = 2000;
  const before = st.households.length;
  KINDS.restore.done(st, job2);
  const hh = st.households[f.household];
  check(st.households.length === before + 1 && hh && hh.holder === who.gunhild && hh.members.includes(who.jons) && f.state === 'occupied' && !f.claim,
    `moved in: a new household (${hh && hh.members})`);
  check([f.house, ...f.fields.map((fd) => fd.tile)].every((t) => st.owner[t] === hh.id + 1) && !CL.claimsOn(st, f.house).length,
    'house and fields are theirs; the claim and the birthright are spent');
  const need = Math.ceil(CLAIMS.farmFood * 2 * st.ECON.ration.adult) + f.fields.length * st.ECON.seedPerField;
  check(hh.grain === need && hh.rations > 0 && hh.wood === st.ECON.startWood, `stores: ${hh.grain} grain of ${need}, ${hh.rations} rations, ${hh.wood} wood`);
  // the fields gone to grass and scrub are cleared again by the new household
  J.refreshJobs(st, cal(st.t));
  const r0 = st.jobs.get(`reclaim:f${f.id}.${f.fields[0].id}`), r1 = st.jobs.get(`reclaim:f${f.id}.${f.fields[1].id}`);
  check(r0 && r0.hours === 10 && r1 && r1.hours === 20 && r0.owner.id === hh.id, 'clearing jobs: 10 hours for grass, 20 for scrub');
  KINDS.reclaim.done(st, r0);
  check(f.fields[0].stage === 'stubble', 'a cleared field is in stubble again');
  ok(st, 'moved in');
  out.push(`claimed and mended: ${hh.grain} rations to start`);
}
// ---- a claim ends: the claimant dies; or nobody works it for 3 years ----
{
  const { st, f, who } = scene('kin');
  FC.claimFarms(st);
  VB['sim/lifecycle'].killPawn(st, who.gunhild, 'illness');
  st.t += 10; J.refreshJobs(st, cal(st.t));
  check(!f.claim && !CL.claimsOn(st, f.house).some((c) => c.why === 'farm') && FC.claimable(f), 'the claim dies with the claimant; the farm is claimable again');
  ok(st, 'died');
  FC.claimFarms(st);
  check(f.claim && f.claim.by === who.brita, `the next claimant takes it (${f.claim && st.pawns[f.claim.by].given})`);
  st.t += CLAIMS.years * YEAR; FC.lapsedFarmClaims(st, CL.lapseClaims(st));
  check(!f.claim && FC.claimable(f), 'a claim unworked for 3 years lapses');
  ok(st, 'lapsed');
}
// ---- the last holder, landless again, claims the farm: their birthright becomes their claim ----
{
  const { st, f, last } = scene('kin');
  st.demand = [last];
  FC.claimFarms(st);
  const c = CL.claimOf(st, f.house, P(last));
  check(f.claim && f.claim.by === last && c && c.why === 'farm' && c.state === 'unrealised' && c.until === null,
    `the last holder's birthright becomes their claim (${JSON.stringify(c)})`);
  ok(st, 'own birthright');
}
// ---- no plot for those who may claim a farm ----
{
  const { st, who } = scene('kin');
  st.demand = [who.olof, who.cecilia];
  X.startPlots(st);
  check(!st.villages[1].plots.length, 'nobody who may claim an empty farm gets a plot');
}
// ---- in play: the moving round gives the farm to a claimant, who mends it and moves in within days ----
{
  const { st, f } = scene('kin');
  f.condition = 0.5;
  st.t = Math.floor(st.t / YEAR) * YEAR + (2 * SEASON_DAYS + 10) * DAY + 11; // the hour before the moving round
  const n = st.events.length;
  for (let d = 0; d < 4 && f.household === null; d++) Sim.advance(st, DAY);
  const lines = st.events.slice(0, st.events.length - n).map((e) => e.text);
  check(f.household !== null && lines.some((t) => /claims the empty farm/.test(t)) && lines.some((t) => /moves into/.test(t)),
    `claimed and moved in within 4 days: ${lines.filter((t) => /claim|moves into/.test(t)).join(' | ')}`);
  ok(st, 'in play');
}
if (failed) process.exit(1);
console.log(`farmclaims ok: ${out.join('; ')}`);
