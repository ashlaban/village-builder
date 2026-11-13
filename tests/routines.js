// VB-257: the village's routines. The village's standing plan holds this year's routines (at most four, each known), set by the yearly
// meeting through its verb from the village work available (the fence's stretches the first); a routine chosen is a source of tasks for
// the village's adults on the `villager` basis, one not chosen posts nothing; a meeting that does not decide (no quorum, a tie) leaves it
// to its culture's practice, `nothing` (the default, every generated culture's) or `asLastYear`, told as a notable event of the village.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { setClock } = require('./lib/clock.js');
const Plans = VB['sim/plans'], L = VB['sim/lifecycle'], Culture = VB.culture, { issue } = VB['sim/commands'];
const { refreshJobs } = VB['sim/jobs'], { eligible } = VB['sim/eligibility'], { DAY, WORK, cal } = VB['sim/rules'];
const { villageOf } = VB['sim/records'];
const { checkState } = require('./lib/invariants.js');
const it = G.generate(7); let r; while (!(r = it.next()).done);
const fresh = () => Sim.seed(r.value, 7, 'founders');
const vmends = (st, vid) => [...st.jobs.values()].filter((j) => j.kind === 'mend' && j.owner.type === 'village' && j.owner.id === vid);
const failures = (st) => st.record.filter((e) => typeof e === 'object' && e.kind === 'meetingFailed');
// a village with a fence and people with a voice, its stretches worn below mending
function setUp() {
  const st = fresh(), v = st.villages.find((x) => x.fence.length && Sim.membersOf(st, x.id).length), s = st.cenv.settlements[v.id];
  for (const x of v.fence) x.cond = 0.2;
  return { st, v, s, plan: Plans.planOf(st, 'village', v.id), voices: Sim.membersOf(st, v.id).filter((p) => Sim.voiceOf(st, p, s) > 0) };
}
// the village's review now (every holder), the tasks it posts
function review(st, day) { setClock(st, day * DAY + WORK[0]); refreshJobs(st, cal(st.t), true); }
// a meeting on the green that those in `ids` came to
function green(st, v, ids) {
  const o = { id: 9999, kind: 'meeting', village: v.id, come: [...ids] };
  for (const id of ids) st.agents[id].occasion = o.id;
  return o;
}

{ // the practice is declared with the customs: every generated culture holds `nothing`
  const st = fresh();
  assert.deepStrictEqual(Object.keys(Culture.PRACTICES), ['noDecision']);
  assert.ok(st.cenv.cultures.every((c) => c.practices.noDecision === 'nothing'), 'each culture holds nothing');
  assert.strictEqual(Culture.practiceOf({}, 'noDecision'), 'nothing', 'a culture of an older save reads the base');
}
{ // at the start, the founders' routines: the fence where the village has one; then the fence's stretches post on the villager basis
  const { st, v, plan } = setUp();
  for (const x of st.villages) {
    const p = Plans.planOf(st, 'village', x.id);
    assert.deepStrictEqual(p.routines, x.fence.length ? ['fence'] : [], `village ${x.id}'s first routines`);
    assert.strictEqual(p.routinesBy, 'founded');
  }
  review(st, 1);
  const js = vmends(st, v.id);
  assert.strictEqual(js.length, v.fence.length, 'each worn stretch posts its mending');
  const adult = Sim.membersOf(st, v.id).find((p) => p.age >= 18);
  assert.strictEqual(villageOf(st, adult), v.id);
  assert.strictEqual(eligible(st, js[0], adult), 'villager', 'a villager may take it');
  assert.deepStrictEqual(checkState(st).filter((x) => /plans|cultures/.test(x)), [], 'invariants');
  assert.strictEqual(plan.routinesYear, cal(0).year, 'set in the first year');
}
{ // a meeting with a quorum decides: the fence, by the meeting
  const { st, v, s, plan, voices } = setUp();
  plan.routines = []; // lint-allow: owner the test starts from a year without village work
  L.routinesMeeting(st, s, green(st, v, voices.map((p) => p.id)));
  // the work days too (VB-120), which only a meeting sets; and a common field (VB-100): the village's store is empty at the start
  assert.deepStrictEqual(plan.routines, ['fence', 'workdays', 'commons']); assert.strictEqual(plan.routinesBy, 'meeting');
  assert.strictEqual(failures(st).length, 0);
  review(st, 1); assert.strictEqual(vmends(st, v.id).length, v.fence.length, 'the chosen routine posts');
}
{ // no quorum, practice `nothing`: no village work this year, the stretches post nothing, and the failure is notable in the village's log
  const { st, v, s, plan, voices } = setUp();
  review(st, 1); assert.ok(vmends(st, v.id).length, 'posted before');
  L.routinesMeeting(st, s, voices.length > 1 ? green(st, v, []) : undefined);
  assert.deepStrictEqual(plan.routines, []); assert.strictEqual(plan.routinesBy, 'nothing');
  review(st, 2); assert.strictEqual(vmends(st, v.id).length, 0, 'a routine not chosen posts nothing, and its tasks are taken down');
  const f = failures(st);
  assert.strictEqual(f.length, 1); assert.strictEqual(f[0].village, v.id);
  assert.ok(/did not decide/.test(f[0].text) && /fence goes unmended/.test(f[0].text), f[0].text);
  assert.deepStrictEqual(Sim.notable(st, f[0]), ['meeting'], 'notable');
  assert.ok(Sim.NOTABLE.meeting);
  assert.ok(Sim.villageLog(st).some((x) => x.ev === f[0]), 'a line of the village log');
  assert.ok(Sim.chronicle(st, { village: v.id }, 'custom').some((x) => x.ev === f[0]), 'in the village history');
  assert.deepStrictEqual(checkState(st).filter((x) => /plans|cultures/.test(x)), [], 'invariants');
}
{ // no quorum, practice `asLastYear`: last year's routines again
  const { st, v, s, plan } = setUp();
  st.cenv.cultures[s.culture].practices.noDecision = 'asLastYear';
  L.routinesMeeting(st, s, undefined);
  assert.deepStrictEqual(plan.routines, ['fence']); assert.strictEqual(plan.routinesBy, 'asLastYear');
  assert.ok(/keeps last year's work/.test(failures(st)[0].text), failures(st)[0].text);
  review(st, 1); assert.strictEqual(vmends(st, v.id).length, v.fence.length, 'last year\'s routine posts');
}
{ // a tie across the fourth place does not decide; otherwise the four most needed
  const five = [[3, 'a'], [3, 'b'], [3, 'c'], [2, 'd'], [2, 'e']];
  assert.strictEqual(Plans.rankRoutines(five), null, 'a tie at the cut');
  assert.deepStrictEqual(Plans.rankRoutines([[1, 'a'], [3, 'b'], [2, 'c'], [5, 'd'], [4, 'e']]), ['d', 'e', 'b', 'c']);
  assert.deepStrictEqual(Plans.rankRoutines([[0, 'fence']]), ['fence'], 'one routine is always chosen');
  assert.strictEqual(Plans.MAX_ROUTINES, 4);
}
{ // the verb checks the list: known routines, once, at most four, and how they were set
  const { st, v, plan } = setUp(), before = JSON.stringify(plan.routines);
  for (const [args, why] of [[{ routines: ['well'], by: 'meeting' }, /no routine well/], [{ routines: ['fence', 'fence'], by: 'meeting' }, /twice/],
    [{ routines: Array(5).fill('fence'), by: 'meeting' }, /at most 4/], [{ routines: ['fence'], by: 'player' }, /cannot be set/]]) {
    const res = issue(st, { actor: { settlement: v.id }, verb: 'routines', args, source: 'test' });
    assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(args)}: ${res}`);
  }
  assert.strictEqual(issue(st, { actor: { settlement: 999 }, verb: 'routines', args: { routines: [], by: 'meeting' }, source: 'test' }).includes('no settlement'), true);
  assert.strictEqual(JSON.stringify(plan.routines), before, 'refusals change nothing');
}
{ // a year of play: every meeting decides, the fence and the work days chosen where there is one (and a common field where it may); a save keeps the routines
  const st = fresh();
  Sim.advance(st, Sim.YEAR);
  for (const x of st.villages) {
    const p = Plans.planOf(st, 'village', x.id);
    if (!Sim.membersOf(st, x.id).length) continue;
    assert.strictEqual(p.routinesBy, 'meeting', `village ${x.id}'s meeting decided`);
    assert.deepStrictEqual([...p.routines].filter((r) => r !== 'commons').sort(), x.fence.length ? ['fence', 'workdays'] : []);
    // a common field (VB-100) only where the village has three farms or more
    if (p.routines.includes('commons')) assert.ok(VB['sim/green'].houses(st, x).length >= VB['sim/rules'].COMMONS.minFarms);
  }
  const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
  assert.deepStrictEqual([...back.plans.villages.values()].map((p) => p.routines), [...st.plans.villages.values()].map((p) => p.routines));
  assert.deepStrictEqual(checkState(st).filter((x) => /plans|cultures/.test(x)), [], 'invariants');
}
console.log('routines ok: founded, chosen by the meeting, posted on the villager basis; no quorum with nothing and asLastYear; ties; the verb\'s refusals');
