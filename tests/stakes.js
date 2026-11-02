// Stakes (VB-158, sim/stakes) on tiny worlds: a field or meadow project stakes its tile instead of owning it; work renews the stake and
// breaking the ground makes it the household's; an unworked stake lapses and ends its project; a household that dissolves drops its stakes;
// a household with no free tile may contest a weakened stake, and the village's Disputed claims custom settles it.
const VB = require('../src/load.js'), Sim = VB.sim, CL = VB['sim/claims'], T = VB['sim/territory'], S = VB['sim/stakes'], F = VB['sim/fields'];
const R = VB['sim/relations'], { KINDS } = VB['sim/kinds'], J = VB['sim/jobs'], A = VB['sim/agents'];
const { CLAIMS, YEAR, DAY, cal, SOCIAL } = VB['sim/rules'], { setOwner } = VB['sim/ownership'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('STAKES FAIL:', m); } };
const ok = (st, label) => { const bad = checkState(st); check(!bad.length, `${label}: invariants: ${bad.slice(0, 2).join('; ')}`); };
const H = (id) => ({ type: 'household', id });
const map = Array.from({ length: 12 }, () => '.'.repeat(20));
// One village of three farms at 10:00 on the first day: household 0 (8 people) and 2 (6) want a fourth field, household 1 (3) does not.
function scene(dispute = 'first') {
  const st = tinyState(tinyWorld(map), [{ at: [9, 6], farms: 3, sizes: [8, 3, 6] }], { seed: 4, customs: { dispute } });
  st.t += 10;
  const hh = st.households, f = hh.map((h) => st.farmsteads[h.farmstead]);
  return { st, hh, f };
}
const events = (st, from, re) => st.events.slice(0, st.events.length - from).filter((e) => re.test(e.text));
const out = [];

// ---- a stake: claimed, not owned; nobody else takes it in; work renews it; breaking the ground makes it the household's ----
{
  const { st, hh, f } = scene();
  check(F.fieldsWanted(st, hh[0]) > f[0].fields.length, 'household 0 wants another field');
  const owner0 = (t) => st.owner[t];
  F.startProject(st, f[0], hh[0]);
  const t = f[0].project && f[0].project.tile, c = CL.claimOf(st, t, H(0)), was = owner0(t);
  check(c && c.state === 'unrealised' && c.why === 'field', `the project stakes its tile (${c && c.state}, ${c && c.why})`);
  check(st.owner[t] !== 1, 'the staked tile is not the household\'s yet');
  check(!T.freeFor(st, t, f[0].village), 'a staked tile is free for nobody else');
  for (let k = 0; k < 40 && f[2].fields.length < 8; k++) { // household 2 makes fields until it would want the staked one: it never takes it
    F.startProject(st, f[2], hh[2]);
    check(!f[2].project || f[2].project.tile !== t, 'another household does not take in the staked tile');
    if (!f[2].project) break;
    F.finishClear(st, f[2], hh[2]); F.finishBreak(st, f[2]);
  }
  ok(st, 'staked');
  st.t += YEAR;
  KINDS.clear.worked(st, { site: t, owner: H(0) });
  check(CL.strength(st, c) === 1, 'an hour of work renews the stake');
  F.finishClear(st, f[0], hh[0]);
  check(CL.claimOf(st, t, H(0)) && st.owner[t] === was, 'cleared: still a stake');
  F.finishBreak(st, f[0]);
  check(st.owner[t] === 1 && !CL.claimsOn(st, t).length && f[0].fields.some((fd) => fd.tile === t), 'broken: a field, the household\'s own, the stake gone');
  ok(st, 'broken');
  out.push('a stake is owned land once broken');
}

// ---- lapse: three years unworked, the stake lapses and the project ends ----
{
  const { st, hh, f } = scene();
  F.startProject(st, f[0], hh[0]);
  const t = f[0].project.tile, n = st.events.length;
  st.t += CLAIMS.years * YEAR - DAY;
  S.lapsedStakes(st, CL.lapseClaims(st));
  check(f[0].project && CL.claimOf(st, t, H(0)), 'still staked a day before 3 years');
  st.t += DAY;
  S.lapsedStakes(st, CL.lapseClaims(st));
  check(!f[0].project && !st.claims.has(t), 'lapsed after 3 years unworked: the project ends');
  check(events(st, n, /gives up its stake/).length === 1, 'the log tells it');
  check(T.freeFor(st, t, f[0].village), 'the tile is free again');
  ok(st, 'lapsed');
  out.push('lapses after 3 years');
}

// ---- dissolution: a household that dies out drops its stakes ----
{
  const { st, hh, f } = scene();
  F.startProject(st, f[0], hh[0]);
  const t = f[0].project.tile, was = st.owner[t];
  VB['sim/heirs'].extinct(st, hh[0]);
  check(!f[0].project && !CL.claimsOn(st, t).some((c) => c.by.type === 'household'), 'a dissolved household\'s stake is dropped');
  check(st.owner[t] === was, `the staked tile keeps its owner (${was}), not passing with the farm (${st.owner[t]})`);
  ok(st, 'dissolved');
}

// ---- contests: household 2 finds no free tile; household 0 staked the best one and left it unworked ----
// staker 0's stake has been unworked for `idle` years; every other free tile is taken by household 1; ties: 'contestor' (the voices
// stand behind household 2's holder) or 'staker'
function contest(dispute, idle = 2, ties = 'contestor') {
  const { st, hh, f } = scene(dispute);
  const t = F.chooseTile(st, f[2]);
  S.stake(st, hh[0], t, 'field'); f[0].project = { tile: t, stage: 'clear', hours: F.clearHours(st, t) };
  CL.claimOf(st, t, H(0)).renewed = st.t - idle * YEAR;
  for (let u = 0; u < st.w.N; u++) {
    if (u !== t && !st.used.has(u) && u !== st.villages[0].center && (st.owner[u] === 0 || T.isOutland(st, u, 0))) setOwner(st, u, H(1));
  }
  check(F.chooseTile(st, f[2]) < 0, `${dispute}: no free tile for household 2`);
  // a member of household 0 is on its way to the project
  J.refreshJobs(st, cal(st.t));
  const job = st.jobs.get(`clear:f${f[0].id}`), worker = st.agents[hh[0].members.find((id) => st.pawns[id].age >= 18)];
  A.start(st, worker, job);
  const [a, b] = [hh[2].holder, hh[0].holder];
  for (const p of Sim.membersOf(st, 0)) {
    p.ties.delete(a); p.ties.delete(b);
    if (p.id !== a && p.id !== b) p.ties.set(ties === 'contestor' ? a : b, 1);
  }
  const before = R.opinionOf(st, b, a), n = st.events.length;
  F.startProject(st, f[2], hh[2]);
  const taken = !!f[2].project && f[2].project.tile === t;
  if (taken) {
    check(CL.claimOf(st, t, H(2)) && !CL.claimOf(st, t, H(0)) && !f[0].project, `${dispute}: household 2 stakes the tile, household 0's project ends`);
    check(Math.abs(R.opinionOf(st, b, a) - (before + SOCIAL.memories.claim.v)) < 1e-9, `${dispute}: the loser's holder remembers it (${R.opinionOf(st, b, a) - before})`);
    check(hh[0].grievance && hh[0].grievance.rules.includes('first'), `${dispute}: the loser leans to the rules that would have kept it (${hh[0].grievance && hh[0].grievance.rules})`);
    check(events(st, n, /takes the field .* staked and left unworked/).length === 1, `${dispute}: the log tells it`);
    J.refreshJobs(st, cal(st.t + 1));
    check(!st.jobs.has(`clear:f${f[0].id}`) && worker.job === null, `${dispute}: the loser's job is dropped, its worker freed`);
  } else {
    check(!f[2].project && f[0].project && CL.claimOf(st, t, H(0)) && !CL.claimOf(st, t, H(2)), `${dispute}: the stake stands`);
    check(R.opinionOf(st, b, a) === before && !events(st, n, /staked and left unworked/).length, `${dispute}: nothing to remember or tell`);
    check(st.jobs.get(`clear:f${f[0].id}`) === job && worker.job === job, `${dispute}: the staker's job stands`);
  }
  ok(st, `contest ${dispute}`);
  return taken;
}
const want = { first: false, kin: false, strongest: true, meeting: true };
for (const [rule, w] of Object.entries(want)) check(contest(rule) === w, `${rule}: the contest ${w ? 'takes' : 'leaves'} the stake`);
check(!contest('meeting', 2, 'staker'), 'meeting: the stake stands when the staker has the voices');
check(!contest('strongest', 1), `strongest: a stake worked a year ago (above ${CLAIMS.contestBelow}) cannot be contested`);
out.push('contests: first and kin keep the stake, strongest and the meeting take it');

// ---- in play: a tiny village for 40 days makes new fields from stakes, the invariants holding every day ----
{
  const { st, f } = scene();
  let staked = 0;
  const fields0 = f.map((x) => x.fields.length);
  for (let d = 0; d < 40; d++) {
    Sim.advance(st, DAY);
    for (const x of f) if (x.project) staked++;
    if (d % 5 === 4) ok(st, `day ${d + 1}`);
  }
  const made = f.reduce((s, x, k) => s + x.fields.length - fields0[k], 0);
  check(staked > 0 && made > 0, `projects staked (${staked} farm-days) and fields made (${made})`);
  check(f.every((x) => x.fields.every((fd) => st.owner[fd.tile] === x.household + 1)), 'every field made is its household\'s own');
  out.push(`in play: ${made} fields made from stakes in 40 days`);
}
if (failed) process.exit(1);
console.log(`stakes ok: ${out.join('; ')}`);
