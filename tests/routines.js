// VB-257: the village's routines. The village's standing plan holds this year's routines (at most four, each known), set by the yearly
// meeting through its verb from the village work available (the fence's stretches the first); a routine chosen is a source of tasks for
// the village's adults on the `villager` basis, one not chosen posts nothing; a meeting that does not decide (no quorum, a tie) leaves it
// to its culture's practice, `nothing` (the default, every generated culture's) or `asLastYear`, told as a notable event of the village.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { setClock } = require('./lib/clock.js');
const Plans = VB['sim/plans'], L = VB['sim/meetings'], Culture = VB.culture, Customs = VB['sim/customs'], { issue } = VB['sim/commands'];
const { refreshJobs } = VB['sim/jobs'], { eligible } = VB['sim/eligibility'], { DAY, WORK, cal } = VB['sim/rules'];
const { villageOf } = VB['sim/records'];
const { checkState } = require('./lib/invariants.js');
const world7 = require('./lib/probe.js').island(7); // the small island, generated once (VB-862: the full map took 2 s)
const fresh = () => Sim.seed(world7, 7, 'founders');
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
  assert.deepStrictEqual(Object.keys(Customs.PRACTICES), ['noDecision', 'alderman', 'riteDays', 'spinning', 'lots']);
  assert.ok(st.cenv.cultures.every((c) => c.practices.noDecision === 'nothing'), 'each culture holds nothing');
  assert.strictEqual(Customs.practiceOf({}, 'noDecision'), 'nothing', 'a culture of an older save reads the base');
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
  assert.strictEqual(VB['sim/routines'].rankRoutines(five), null, 'a tie at the cut');
  assert.deepStrictEqual(VB['sim/routines'].rankRoutines([[1, 'a'], [3, 'b'], [2, 'c'], [5, 'd'], [4, 'e']]), ['d', 'e', 'b', 'c']);
  assert.deepStrictEqual(VB['sim/routines'].rankRoutines([[0, 'fence']]), ['fence'], 'one routine is always chosen');
  assert.strictEqual(VB['sim/routines'].MAX_ROUTINES, 4);
}
{ // the verb checks the list: known routines, once, at most four, and how they were set
  const { st, v, plan } = setUp(), before = JSON.stringify(plan.routines);
  for (const [args, why] of [[{ routines: ['well'], by: 'meeting' }, /no routine well/], [{ routines: ['fence', 'fence'], by: 'meeting' }, /twice/],
    [{ routines: Array(5).fill('fence'), by: 'meeting' }, /at most 4/], [{ routines: ['fence'], by: 'player' }, /cannot be set/]]) {
    const res = issue(st, { actor: { settlement: v.id }, verb: 'routines', args, source: 'debug' });
    assert.ok(typeof res === 'string' && why.test(res), `${JSON.stringify(args)}: ${res}`);
  }
  assert.strictEqual(issue(st, { actor: { settlement: 999 }, verb: 'routines', args: { routines: [], by: 'meeting' }, source: 'debug' }).includes('no settlement'), true);
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
    if (p.routines.includes('commons')) assert.ok(VB['sim/green'].houses(st, x).length >= VB['sim/commons'].COMMONS.minFarms);
  }
  const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
  assert.deepStrictEqual([...back.plans.villages.values()].map((p) => p.routines), [...st.plans.villages.values()].map((p) => p.routines));
  assert.deepStrictEqual(checkState(st).filter((x) => /plans|cultures/.test(x)), [], 'invariants');
}
{ // VB-1768: a village's routines as levies, laid in lots by its custom of lots
  const { tinyWorld, tinyState } = require('./lib/tiny.js');
  const Levies = VB['sim/levies'], Ob = VB['sim/obligations'], { OUTER } = VB['sim/days'], { SEASON_DAYS } = VB['sim/rules'];
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 4, sizes: [6, 6, 6, 1] }], { seed: 4 });
  const v = st.villages[0], plan = Plans.planOf(st, 'village', v.id), s = st.cenv.settlements[v.id];
  assert.strictEqual(Customs.PRACTICES.lots.base, 'fields');
  assert.deepStrictEqual(Customs.PRACTICES.lots.opts.map((o) => o[0]), ['fields', 'adults', 'equal']);
  assert.ok(Customs.PRACTICES.lots.malleability > 0, 'a practice with its malleability');
  assert.strictEqual(Customs.practiceOf(st.cenv.cultures[s.culture], 'lots'), 'fields', 'by fields, the default');
  // the split: whole days by the largest remainder, summing to D; ties in turn by household id against the year
  const sum = (lots) => lots.reduce((n, l) => n + l[1], 0), N = v.farmsteads.length, y = cal(st.t).year;
  for (const rule of ['fields', 'adults', 'equal']) {
    const [lots, rest] = Levies.split(st, v.id, 5, rule);
    assert.strictEqual(sum(lots) + rest, 5, `${rule}: the lots sum to D`);
    assert.strictEqual(rest, 0);
  }
  const [one] = Levies.split(st, v.id, 1, 'equal'), first = [...Array(N).keys()].sort((a, b) => ((a + y) % N) - ((b + y) % N))[0];
  assert.deepStrictEqual(one, [[first, 1]], 'a tie goes by the household id against the year');
  const adults = Levies.split(st, v.id, 6, 'adults')[0], lone = st.households[3];
  assert.ok((adults.find((l) => l[0] === lone.id) || [0, 0])[1] < (adults.find((l) => l[0] === 0) || [0, 0])[1], 'by adults, the small owe less');
  // room: at most OUTER.lotMax a household a season, the days past it to the others, what none can take left
  const [capped, left] = Levies.split(st, v.id, 50, 'equal', () => OUTER.lotMax);
  assert.ok(capped.every((l) => l[1] === OUTER.lotMax) && left === 50 - N * OUTER.lotMax, 'capped, the rest left');
  const [over] = Levies.split(st, v.id, 6, 'equal', (id) => (id === 0 ? 0 : OUTER.lotMax));
  assert.ok(!over.some((l) => l[0] === 0) && sum(over) === 6, 'a household with no room: its days to the others');
  const f0 = st.farmsteads[v.farmsteads[0]], had = f0.fields;
  f0.fields = []; // lint-allow: owner a test's scene: a household with no fields
  assert.ok(!Levies.split(st, v.id, 5, 'fields')[0].some((l) => l[0] === f0.household), 'by fields, one with none owes none');
  assert.ok(Levies.split(st, v.id, 5, 'equal')[0].some((l) => l[0] === f0.household), 'equal, it owes its share');
  f0.fields = had; // lint-allow: owner the scene undone

  // the routine set by the meeting, a step of the village's year; its alderman lays its season's lots at his review
  VB['sim/routines'].setRoutines(st, v.id, ['fence'], 'meeting');
  VB['sim/membership'].setAlderman(st, v, st.households[0].holder);
  const step = VB['sim/routines'].stepOf(plan, 'fence');
  assert.deepStrictEqual([step.author, step.why], ['custom', { custom: 'meeting' }], 'the routine a step of the year, the meeting its why');
  for (const x of v.fence) x.cond = 0.2;
  review(st, 1); // posts the fence's tasks
  review(st, 2); // the season's lots, sized from them
  const lots = st.obligations.filter((o) => o.source === 'routine'), end = SEASON_DAYS - 1;
  assert.ok(lots.length > 0, 'lots laid');
  for (const o of lots) {
    assert.deepStrictEqual([o.kind, o.debtor.kind, o.creditor, o.enforcer, o.window], ['days', 'household', { kind: 'village', id: v.id },
      { kind: 'village', id: v.id }, [2, end]], JSON.stringify(o));
    assert.deepStrictEqual([o.terms.names, o.terms.substitute, o.terms.commute, o.terms.carry], ['levied', true, null, false], 'its terms');
    assert.ok(o.owes.days <= OUTER.lotMax);
    assert.deepStrictEqual(o.why, { step: step.id, of: `village:${v.id}` }, "each levied day's why, its routine");
  }
  assert.deepStrictEqual(plan.lotsOf, ['fence']);
  const once = lots.length;
  review(st, 3);
  assert.strictEqual(st.obligations.filter((o) => o.source === 'routine').length, once, 'laid once a season');
  // the routines set again mid-season (the meeting's day, here by asLastYear): the routine keeps its step, so its lots' why still reach it
  VB['sim/routines'].setRoutines(st, v.id, ['fence'], 'asLastYear');
  const again = VB['sim/steps'].find(st, plan, lots[0].why.step);
  assert.ok(again && again.what.routine === 'fence' && again.id === step.id, 'the step of the why found after the re-set');
  assert.deepStrictEqual(again.why, { custom: 'asLastYear' }, 'its why the new decision');
  // the work done: the days left released
  for (const x of v.fence) x.cond = 1;
  review(st, 4); review(st, 5);
  assert.ok(lots.every((o) => !Ob.isLive(o)), `the work done, its lots released: ${lots.map((o) => o.status)}`);
  // the next season: lots laid again, and the work left at its end told at the meeting and weighed
  for (const x of v.fence) x.cond = 0.2;
  review(st, SEASON_DAYS); review(st, SEASON_DAYS + 1);
  assert.ok(st.obligations.some((o) => o.source === 'routine' && o.window[0] >= SEASON_DAYS), 'laid again in the next season');
  review(st, 2 * SEASON_DAYS);
  assert.ok(plan.routineLeft && plan.routineLeft.days.fence > 0, `the work left kept: ${JSON.stringify(plan.routineLeft)}`);
  const voices = Sim.membersOf(st, v.id).filter((p) => Sim.voiceOf(st, p, s) > 0);
  L.routinesMeeting(st, s, green(st, v, voices.map((p) => p.id)));
  const told = st.record.find((e) => typeof e === 'object' && e.kind === 'workLeft' && /work left undone/.test(e.text));
  assert.ok(told && told.text.includes(`${plan.routineLeft.days.fence} day`) && /fence/i.test(told.text), told && told.text);
  assert.ok(plan.routines.includes('fence'), 'the fence chosen again');
  { // the work left weighs in the choice: a routine ranked last comes first with many days of it left
    const R = VB['sim/routines'], base = R.chooseRoutines(st, v), was = plan.routineLeft;
    assert.ok(base && base.length > 1, `routines to rank: ${base}`);
    const k = base[base.length - 1];
    plan.routineLeft = { by: plan.routinesBy + plan.routinesYear, days: { [k]: 1000 } }; // lint-allow: owner a test's scene
    assert.strictEqual(R.chooseRoutines(st, v)[0], k, `${k} weighed by its work left`);
    plan.routineLeft = { by: 'another setting', days: { [k]: 1000 } }; // lint-allow: owner a test's scene: left under routines set before
    assert.deepStrictEqual(R.chooseRoutines(st, v), base, 'work left under other routines not weighed');
    plan.routineLeft = was; // lint-allow: owner the scene undone
  }
  assert.deepStrictEqual(checkState(st).filter((x) => /plans|obligation|levy/.test(x)), [], 'invariants');
}
console.log('routines ok: founded, chosen by the meeting, posted on the villager basis; no quorum with nothing and asLastYear; ties; the verb\'s refusals; the routines\' lots laid, released and their work left told');
