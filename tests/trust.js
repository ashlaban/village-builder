// Held by kin when nobody can come (VB-309; design.md, Households short of people): a household of at most one grown member whose ask for
// food falls short, with no relative and no servant to come, goes to its nearest kin household, which holds the farm in trust: it works
// the fields as its own, the owner, holder and line unchanged, the house empty. The trust ends at the holder's marriage, a servant at the
// round, a ward's coming of age, the trustee's end, or the holder's death; an orphaned heir with no guardian is held for the same way.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], S = VB['sim/service'], H = VB['sim/help'];
const { seedReserve } = VB['sim/hunger'], { SERVICE, YEAR, cal } = VB['sim/rules'], { moveTo, extinct, refreshRoles } = VB['sim/heirs'];
const { trustOf, trustOfHolder, ownerOf } = VB['sim/ownership'], T = VB['sim/trust'], { refreshJobs } = VB['sim/jobs'];
const { issue } = VB['sim/commands'], { eligible } = VB['sim/eligibility'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TRUST FAIL:', m); } };
// one world, but a world of its own for a case that runs days (a run writes what is dug into its world)
const world = () => { const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; }, shared = world();
const fresh = (own = false) => { const st = Sim.seed(own ? world() : shared, 7, 'heirs'); st.naturalDeaths = false; return st; };
const vOf = (st, h) => st.farmsteads[h.farmstead].village;
const grown = (st, h) => h.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18);
const invariants = (st, when) => { const bad = checkState(st); check(!bad.length, `${when}: invariants: ${bad.slice(0, 3).join('; ')}`); };
// The case: a holder with 3 fields or more (A), alone, made the child of the holder of a household of its village (C) that keeps three grown
// members or more; nobody in st.demand, so no relative and no servant can come.
function loneCase(st) {
  for (const a of st.households) {
    if (a.dissolved || st.farmsteads[a.farmstead].fields.length < 3) continue;
    for (const c of st.households) {
      if (c === a || c.dissolved || vOf(st, c) !== vOf(st, a) || c.holder === null || grown(st, c).length < 3) continue;
      const h = st.pawns[a.holder], parent = st.pawns[c.holder];
      if (h.age < 18) continue;
      const away = st.households.find((x) => x !== a && x !== c && !x.dissolved);
      for (const id of a.members.filter((m) => m !== a.holder)) moveTo(st, id, away.id);
      h[parent.sex === 'm' ? 'father' : 'mother'] = parent.id; st.idx = null; // parents set by hand: the records' index is built again (VB-239)
      return { a, c, holder: h, f: st.farmsteads[a.farmstead] };
    }
  }
  return null;
}
const starve = (st) => { for (const hh of st.households) { if (!hh.dissolved) hh.grain = { barley: seedReserve(st, hh) }; hh.meals = 0; } for (const v of st.villages) v.grain = {}; };
// Takes the case into trust: the first short ask, with nobody in demand.
function intoTrust(own = false) {
  const st = fresh(own), c = loneCase(st);
  if (!c) { console.error('TRUST FAIL: no case of a lone holder with a parent at a farm of three grown'); process.exit(1); }
  starve(st); st.demand = [];
  const short = H.shareFood(st);
  check(short.includes(c.a.id), 'the lone holder is named short of people');
  S.takeIn(st, short);
  return { st, ...c, t: trustOf(st, c.a.id) };
}
let report = '';
// 1. Nobody can come: the holder goes to the parent's household, which holds the farm in trust and works its fields as its own.
{
  const { st, a, c, holder, f, t } = intoTrust(true);
  const owner0 = ownerOf(st, f.fields[0].tile), cond0 = VB['sim/rules'].houseCondition(st, f);
  check(t && t.trustee === c.id && t.ward === null && t.end === null, `a trust held by the parent's household (${JSON.stringify(t)})`);
  check(holder.household === c.id && a.members.length === 0, 'the holder lives with the trustee, the house stands empty');
  check(a.holder === holder.id && !a.dissolved && f.household === a.id && f.line === f.line, 'holder and household unchanged');
  check(ownerOf(st, f.fields[0].tile).id === a.id && owner0.id === a.id && f.fields.length >= 3, 'the owner unchanged');
  check(trustOfHolder(st, holder.id) === t, 'the holder is found by its trust');
  invariants(st, 'in trust');
  // a year on: the house kept its condition as an empty farm's, less its decay; the trustee posts the farm's field work as its own
  // about 65 days on, on the first day a round of field work stands open (VB-334: weeding rounds on days 6 and 15 of growth; the day the
  // farm was sown moves with its head's targets, VB-485)
  Sim.advance(st, 58 * Sim.DAY);
  let days = 58, jobs = [];
  for (; days < 75; days++) {
    Sim.advance(st, Sim.DAY);
    refreshJobs(st, cal(st.t), true);
    jobs = [...st.jobs.values()].filter((j) => j.farm === f);
    if (jobs.length) { days++; break; }
  }
  check(jobs.length > 0 && jobs.every((j) => j.owner.type === 'household' && j.owner.id === c.id), `the trustee's tasks on the farm (${jobs.map((j) => `${j.kind}:${j.owner.id}`).join(', ')})`);
  const worker = st.pawns[grown(st, c).find((id) => id !== holder.id)];
  check(jobs.length && eligible(st, jobs[0], worker) === 'member', 'a member of the trustee may take them, as a member');
  const cond = VB['sim/rules'].houseCondition(st, f);
  const decay = (0.08 * days) / VB['sim/rules'].YEAR_DAYS; // the clock's decay of an empty farm, 8% a year
  check(Math.abs(cond0 - decay - cond) < 0.005, `the empty house decays as an empty farm's (${cond0.toFixed(3)} to ${cond.toFixed(3)})`);
  invariants(st, 'sixty days on');
  report = `${R.fullName(holder)} held at ${st.farmsteads[c.farmstead].name}, ${jobs.length} tasks on ${f.name}`;
  // 2. The holder marries: the couple goes back.
  const wife = st.pawns.find((p) => p.alive && p.sex !== holder.sex && p.age >= 18 && p.age < 40 && R.spouseOf(st, p.id) === null && !R.isHolder(st, p.id)
    && p.household !== null && R.kinDegree(st, p.id, holder.id) > 2 && !st.herds.some((hd) => hd.herder === p.id)); // not a herder: the herd's keeper is set again at the next round (sim/grazing)
  // nobody marries over the sea (VB-436), and the fixture's other village is an island: one from there is placed by hand in the trustee's
  // household, at its door, as a test builds its case
  if (vOf(st, st.households[wife.household]) !== vOf(st, a)) {
    R.leaveHousehold(st, wife.id);
    R.joinHousehold(st, c, wife.id, false);
    const ag = st.agents[wife.id], door = st.farmsteads[c.farmstead].house;
    ag.path = null; ag.x = st.w.hx[door]; ag.y = st.w.hy[door];
    refreshRoles(st);
  }
  check(issue(st, { actor: holder.id, verb: 'marry', target: wife.id, args: { home: a.id }, source: 'test' }) === true, 'the marriage');
  refreshRoles(st); // as the round does after its marriages
  check(holder.household === a.id && wife.household === a.id && !trustOf(st, a.id) && t.why === 'married', `the couple lives on the farm, the trust ended (${t.why})`);
  check(![...st.jobs.values()].some((j) => j.farm === f && j.owner.id === c.id), "the trustee's tasks on the farm are taken down");
  invariants(st, 'after the marriage');
}
// 3. A servant at the moving round: the holder goes back, and the servant comes.
{
  const { st, a, c, holder, t } = intoTrust();
  const maid = st.pawns.find((p) => p.alive && p.household !== null && p.household !== c.id && st.households[p.household] !== a && S.unfit(st, p) === null
    && S.handsLeft(st, p) >= SERVICE.keepHands && vOf(st, st.households[p.household]) === vOf(st, a));
  check(!!maid, 'setup: one who would serve');
  st.demand = [maid.id];
  S.takeServants(st);
  check(holder.household === a.id && maid.household === a.id && maid.servant && t.why === 'servant', `back with a servant (${t.why})`);
  invariants(st, 'after the servant');
}
// 4. A save keeps the trust; then the holder dies: the trust ends, succession as today.
{
  const made = intoTrust(), back = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(made.st))));
  check(JSON.stringify(back.trusts) === JSON.stringify(made.st.trusts) && JSON.stringify(back.liveTrusts) === JSON.stringify(made.st.liveTrusts)
    && trustOf(back, made.a.id), 'a save and load keep the trust');
  invariants(back, 'loaded');
  const st = back, a = st.households[made.a.id], holder = st.pawns[made.holder.id], t = trustOf(st, a.id);
  Sim.killPawn(st, holder.id, 'illness');
  check(t.why === 'death' && !trustOf(st, a.id), `the trust ends at the holder's death (${t.why})`);
  invariants(st, 'after the death');
}
// 5. The trustee dies out: the holder goes back.
{
  const { st, a, c, holder, t } = intoTrust();
  extinct(st, c);
  refreshRoles(st); // as extinct's callers do
  check(t.why === 'trustee gone' && holder.household === a.id, `back when the trustee ends (${t.why})`);
  invariants(st, 'after the trustee');
}
// 6. An orphaned heir with no guardian: the kin who take the child hold the farm until it is 18 (Kim, 13 Nov), not an empty farm.
{
  const st = fresh(), c = loneCase(st);
  starve(st); st.demand = [];
  const child = st.pawns.find((p) => p.alive && p.age >= 8 && p.age < 16 && p.household !== null && p.household !== c.c.id && !R.isHolder(st, p.id));
  moveTo(st, child.id, c.a.id);
  moveTo(st, c.holder.id, c.c.id);
  c.a.holder = child.id; R.noteHolder(st, c.a); VB['sim/events'].emit(st, 'newHead', { household: c.a.id }); // the child holds the farm alone
  child.father = c.c.holder; child.mother = null; st.idx = null; // parents set by hand: the records' index is built again (VB-239)
  S.careForOrphans(st);
  const t = trustOf(st, c.a.id);
  check(t && t.ward === child.id && t.trustee === c.c.id && child.household === c.c.id && !c.a.dissolved, `the ward's farm held in trust (${JSON.stringify(t)})`);
  invariants(st, 'the ward held');
  child.born = st.t - 18 * YEAR - 1; child.age = 18;
  T.wardsOfAge(st);
  check(t.why === 'of age' && child.household === c.a.id, `the ward goes back at 18 (${t.why})`);
  invariants(st, 'the ward of age');
}
// 7. The trustee is itself put in trust (its people go to its own kin): the farm it held goes back to its holder first, as when a trustee
// dies out (VB-473 repair: the trust stayed with a trustee its holder no longer lived with).
{
  const { st, a, c, holder, t } = intoTrust();
  const d = st.households.find((x) => x !== a && x !== c && !x.dissolved && vOf(st, x) === vOf(st, c) && x.holder !== null && grown(st, x).length >= 2);
  check(!!d, 'setup: a kin household for the trustee');
  const ch = st.pawns[c.holder], dh = st.pawns[d.holder];
  ch[dh.sex === 'm' ? 'father' : 'mother'] = dh.id; // the trustee's holder is the child of d's
  st.idx = null; // and the records' index is built again (VB-239)
  check(T.trusteeFor(st, c) === d.id, `setup: d would hold the trustee's farm (${T.trusteeFor(st, c)})`);
  check(issue(st, { actor: c.holder, verb: 'goToKin', target: c.id, args: { why: 'test' }, source: 'test' }) === true, 'the trustee goes to kin');
  refreshRoles(st);
  const u = trustOf(st, c.id);
  check(u && u.trustee === d.id && ch.household === d.id, `the trustee's farm held by d (${JSON.stringify(u)})`);
  check(t.why === 'trustee gone' && t.end !== null && !trustOf(st, a.id) && holder.household === a.id, `the farm it held goes back to its holder (${t.why})`);
  invariants(st, 'the trustee in trust');
}
// VB-1224: nobody moves into a farm held in trust, and a household named short the day it went to kin takes nobody in (medium-ref: a
// servant came to an orphan's empty farm the day it went into trust)
{
  const { st, a, c, t } = intoTrust();
  const q = c.members.find((id) => id !== c.holder && st.pawns[id].alive && st.pawns[id].age >= 18);
  const r = issue(st, { actor: q, verb: 'move', target: a.id, args: { reason: 'service' }, source: 'test' });
  check(typeof r === 'string' && /held in trust/.test(r) && !a.members.length, `a move into the farm held in trust: ${r}`);
  st.demand = [q]; S.takeIn(st, [a.id]);
  check(!a.members.length && trustOf(st, a.id) === t, `taken in while held in trust: members ${a.members}`);
  invariants(st, 'nobody moves into a farm held in trust');
}
if (failed) process.exit(1);
console.log(`trust ok: ${report}`);
