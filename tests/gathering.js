// VB-294: the gathering. At its autumn meeting each village ranks the hosts it would walk to by effective hours (the walk between the greens,
// its own 0, less for kin and last year's gathering, plus or less by the pull between the villages) and offers to host when it would go to its
// own; once all have met, each goes to one gathering that stands: three villages or more with the host among them, lodged by the host's
// farms, the smallest that does not stand put out of the running first. The choice is the meeting's verb; the district is read from it.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const Gt = VB['sim/gathering'], { issue } = VB['sim/commands'], { GATHERING, YEAR, DAY, SEASON_DAYS, cal } = VB['sim/rules'];
const { hoursBetween } = VB['sim/routes'], { membersOf } = VB['sim/records'], Green = VB['sim/green'];

// six villages of two farms on open meadow: five in a row about two hours apart, and one far off at the east end
const XS = [4, 30, 56, 82, 108, 290];
const make = () => tinyState(tinyWorld(Array(12).fill('.'.repeat(296)), { seed: 7 }), XS.map((x) => ({ at: [x, 5], farms: 2, sizes: [5, 4] })), { seed: 7 });
const roomy = (f) => { const was = GATHERING.lodge; GATHERING.lodge = 100; try { f(); } finally { GATHERING.lodge = was; } };
const meet = (st, quorum = true) => { for (const v of st.villages) Gt.chooseGathering(st, st.cenv.settlements[v.id], quorum, membersOf(st, v.id)); };
const choice = (st, vid, prefs, hosting = prefs[0] === vid) =>
  issue(st, { actor: { settlement: vid }, verb: 'gathering', args: { hosting, prefs, by: 'meeting' }, source: 'meeting' });
const gatherIssues = (st) => checkState(st).filter((x) => /gathering/.test(x));

{ // the choice: each village ranks those within a day's walk that can host, its own first at 0 hours; the far one has only its own
  const st = make(), n = st.villages.length;
  assert.ok(st.villages.every((v) => v.green), 'every village has a green');
  const far = n - 1;
  assert.ok(hoursBetween(st, 0, 1) > GATHERING.homeHours && hoursBetween(st, 0, 1) < GATHERING.homeHours * 2, `0 to 1: ${hoursBetween(st, 0, 1)} hours`);
  assert.ok(hoursBetween(st, 4, far) > VB['sim/rules'].TRAVEL.dayWalk, 'the far village is beyond a day');
  VB.resetCounts();
  meet(st);
  assert.ok(VB.count.gatherChoice === n * n, `villages times hosts read: ${VB.count.gatherChoice}`);
  for (const v of st.villages) {
    const g = v.gathering;
    assert.strictEqual(g.prefs[0], v.id, `village ${v.id} first ranks its own`);
    assert.ok(g.hosting, 'and offers to host');
    assert.ok(g.prefs.every((h) => hoursBetween(st, v.id, h) <= VB['sim/rules'].TRAVEL.dayWalk));
  }
  assert.deepStrictEqual(st.villages[far].gathering.prefs, [far]);
  // the settling: the smallest gatherings go out of the running until those left have three villages each; the far village has none
  Gt.settleGatherings(st);
  const gs = Gt.gatherings(st);
  assert.ok(gs.length >= 1, 'a gathering stands');
  for (const g of gs) {
    assert.ok(g.villages.length >= GATHERING.least, `${g.host}'s has ${g.villages.length}`);
    assert.strictEqual(g.villages[0], g.host, 'the host goes to its own');
    assert.ok(Green.houses(st, st.villages[g.host]).length > 0, 'the host is inhabited');
  }
  assert.strictEqual(st.villages[far].gathering.host, null, 'a village a day from every host has none');
  assert.deepStrictEqual(gatherIssues(st), [], 'invariants');
  // the district is read from the choice, never stored apart
  const g0 = gs[0];
  assert.deepStrictEqual(Gt.district(st, g0.host), g0.villages);
  assert.ok(st.record.some((e) => typeof e === 'object' && e.kind === 'gathering' && e.village === g0.host), 'told at the host');
  // its date: winter days 1 to 3 of the year
  const [a, b] = Gt.whenHeld(st, g0.host, 1);
  assert.strictEqual(a, 3 * SEASON_DAYS * DAY); assert.strictEqual(b - a, 3 * DAY); assert.ok(b <= YEAR);
}
{ // a gathering of fewer than three is not held, and its villages go to their next host still in the running
  const st = make();
  choice(st, 0, [0, 2]); choice(st, 1, [0, 2]); // 0 hosts, with 1: two only
  choice(st, 2, [2, 0]); choice(st, 3, [2, 0]); choice(st, 4, [2]);
  roomy(() => Gt.settleGatherings(st));
  assert.deepStrictEqual(Gt.gatherings(st).map((g) => [g.host, g.villages]), [[2, [2, 0, 1, 3, 4]]]);
}
{ // lodging: a host lodges GATHERING.lodge guests a farm; a village beyond homeHours whose goers it cannot lodge goes to its next host
  const st = make();
  // host 2 has 2 farms; each village of two farms brings 6 goers, and every other village lies beyond homeHours: with 6 guests a farm the
  // host lodges two villages, the nearest (1 and 3), and 0 and 4, with no other host, have none
  assert.ok(hoursBetween(st, 1, 2) > GATHERING.homeHours && hoursBetween(st, 0, 2) > hoursBetween(st, 1, 2));
  const saved = GATHERING.lodge;
  GATHERING.lodge = 6;
  try {
    for (const v of [0, 1, 3, 4]) choice(st, v, [2]);
    choice(st, 2, [2]);
    Gt.settleGatherings(st);
    assert.deepStrictEqual(Gt.gatherings(st).map((g) => [g.host, g.villages]), [[2, [2, 1, 3]]]);
    assert.strictEqual(st.villages[0].gathering.host, null); assert.strictEqual(st.villages[4].gathering.host, null);
    // within homeHours, no bed is needed
    GATHERING.homeHours = 10;
    for (const v of [0, 1, 2, 3, 4]) choice(st, v, [2]);
    Gt.settleGatherings(st);
    assert.deepStrictEqual(Gt.gatherings(st).map((g) => g.villages), [[2, 0, 1, 3, 4]]);
  } finally { GATHERING.lodge = saved; GATHERING.homeHours = 2; }
}
{ // last year's gathering pulls: held there last winter, a host is an hour nearer; the verb checks the choice
  const st = make();
  meet(st); Gt.settleGatherings(st);
  const host = Gt.gatherings(st)[0].host, other = st.villages.find((v) => v.id !== host && hoursBetween(st, v.id, host) > 0 && v.gathering.host === host).id;
  st.t += YEAR; // a year on: last winter's
  const before = hoursBetween(st, other, host), r = Gt.rank(st, st.villages[other], membersOf(st, other)).find((x) => x[1] === host);
  assert.ok(r[0] <= before - GATHERING.held + 2 + 1e-9, `${r[0]} against a walk of ${before}`);
  assert.match(String(issue(st, { actor: { settlement: 0 }, verb: 'gathering', args: { hosting: true, prefs: [0, 5], by: 'meeting' }, source: 'meeting' })), /beyond a day/);
  assert.match(String(issue(st, { actor: { settlement: 0 }, verb: 'gathering', args: { hosting: true, prefs: [0, 0], by: 'meeting' }, source: 'meeting' })), /twice/);
  assert.strictEqual(cal(st.t).year, 2);
}
{ // no quorum: the culture's practice, `nothing` (no gathering this winter) or `asLastYear`
  const st = make();
  meet(st); const was = st.villages[1].gathering.prefs.slice();
  meet(st, false);
  assert.deepStrictEqual(st.villages[1].gathering.prefs, [], 'nothing');
  assert.strictEqual(st.villages[1].gathering.by, 'nothing');
  st.cenv.cultures[st.cenv.settlements[1].culture].practices.noDecision = 'asLastYear';
  choice(st, 1, was);
  Gt.chooseGathering(st, st.cenv.settlements[1], false, membersOf(st, 1));
  assert.deepStrictEqual(st.villages[1].gathering.prefs, was, 'last year again');
}
console.log('gathering: ok');
