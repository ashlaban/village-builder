// @suite fast
// Decision points and the record of commands (VB-1757; design.md section 15, Decision points, The API by pawn and body;
// docs/plans/four-scales/README.md, 3.6): Sim.decisions lists the points open to a pawn's controller, each with its deadline, computed
// when asked and nothing stored; past a deadline the default author answers as with no controller; Sim.command records each command with
// its game time, and a run is replayed from a save and the commands recorded since it to the same state.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const L = VB['sim/lifecycle'],
  Steps = VB['sim/steps'];
const { WORK, DAY, TICKS } = VB['sim/rules'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours = 0) => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  if (hours) Sim.advance(st, hours);
  return st;
};
const hash = (st) => sha(canon(kept(st)));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const of = (list, point, body) =>
  list.filter((x) => x.point === point && (!body || (x.body && x.body.kind === body.kind && x.body.id === body.id)));

// 1. A head's points: the year's, the season's and the days-ahead reviews of its household, and the next allotment; the alderman's year.
// Asked, nothing is written; past each deadline the default author has answered, as with no controller.
{
  const st = make(4.5),
    hh = st.households[0],
    head = hh.holder,
    body = { kind: 'household', id: hh.id },
    plan = st.plans.households.get(hh.id);
  // the allotment is a point only where the day would change (VB-1884): a task struck from the day standing makes it so
  const day = plan.day.lists,
    would = VB['sim/day'].weighDay(st, hh, VB['sim/rules'].cal(st.t)).lists,
    who = Object.keys(would).find((id) => would[id].length);
  assert.ok(who, 'work to allot');
  day[who] = day[who].filter((t) => t !== would[who][0]);
  const before = hash(st),
    n0 = VB.count.pointOffer;
  const pts = Sim.decisions(st, head);
  assert.strictEqual(hash(st), before, 'asking writes nothing');
  assert.strictEqual(st.commanded, undefined, 'and records nothing');
  for (const k of ['year', 'season', 'ahead', 'allot']) assert.strictEqual(of(pts, k, body).length, 1, `a head's ${k} point`);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i - 1].deadline <= pts[i].deadline, 'by deadline');
  for (const x of pts) assert.ok(x.deadline >= st.t, `${x.point}'s deadline is ahead`);
  const year = of(pts, 'year', body)[0],
    m = VB['sim/meetings'].MEETING;
  const c = VB['sim/rules'].cal(year.deadline);
  assert.ok(c.season === m.season && c.sday === m.sday && c.hour === m.hour, "the year's: the meeting's agenda closing");
  assert.strictEqual(of(pts, 'ahead', body)[0].deadline, plan.nextReview, "the days ahead: its planning day");
  const allot = of(pts, 'allot', body)[0];
  assert.ok([WORK[0] - 1, 14].includes(VB['sim/rules'].cal(allot.deadline).hour), 'the allotment: the morning or 14:00');
  assert.strictEqual(VB.count.pointOffer - n0, st.offers.length, 'each open offer looked at once, a call');
  const ald = VB['sim/decisions'].agentOf(st, st.villages[0].id);
  // a member that is no head and plans nothing has none of these
  const member = hh.members.find((id) => id !== head && st.pawns[id].alive && id !== ald);
  assert.deepStrictEqual(
    Sim.decisions(st, member).filter((x) => x.point !== 'ask'),
    [],
    'a member with no plan and its controller automatic: no point',
  );
  // past the deadlines the default author answers: the plan reviewed on its day, the day allotted at its hour
  const ahead = of(pts, 'ahead', body)[0].deadline;
  Sim.advance(st, Math.ceil((Math.max(ahead, allot.deadline) - st.t) * TICKS) / TICKS + 0.1);
  assert.ok(plan.reviewed >= ahead, `reviewed at ${plan.reviewed}, its planning day ${ahead}`);
  assert.ok(plan.day.made >= allot.deadline, `the day allotted at ${plan.day.made}, the point's hour ${allot.deadline}`);
  const later = Sim.decisions(st, head);
  assert.ok(of(later, 'ahead', body)[0].deadline > ahead, 'the next planning day is the next point');
  assert.deepStrictEqual(Sim.decisions(st, 9999), [], 'no pawn, no point');
  sound(st, 'points asked');
}
// the alderman, once a meeting has chosen him: the year's review of his village, until the meeting's agenda closes
{
  const st = make(4.5),
    v = st.villages[0];
  VB['sim/meetings'].holdMeetings(st);
  const ald = VB['sim/decisions'].agentOf(st, v.id);
  assert.ok(ald !== null && ald !== undefined, 'the meeting chose an alderman');
  const year = of(Sim.decisions(st, ald), 'year', { kind: 'village', id: v.id });
  assert.ok(year.length === 1 && year[0].deadline === VB['sim/points'].meetingAfter(st.t), "the alderman's year, the meeting's");
  const other = st.living.find((id) => id !== ald);
  assert.strictEqual(of(Sim.decisions(st, other), 'year', { kind: 'village', id: v.id }).length, 0, 'no one else has it');
}

// 2. A leg's end with automatic behaviour off is a point at once, the queue first; a step at risk is its author's, until the next review.
{
  const st = make(4.5),
    hh = st.households[0],
    id = hh.members.find((m) => m !== hh.holder && st.pawns[m].alive);
  VB['sim/agents'].release(st, st.agents[id]);
  assert.strictEqual(Sim.setAuto(st, id, false), true);
  const leg = of(Sim.decisions(st, id), 'leg');
  assert.ok(leg.length === 1 && leg[0].deadline === st.t, 'its automatic behaviour off and nothing in hand: at once');
  assert.strictEqual(Sim.queue(st, id, { verb: 'goHome' }), true);
  assert.strictEqual(of(Sim.decisions(st, id), 'leg').length, 0, 'a command queued: none');
  // a task of its own plan at risk
  const j = [...st.jobs.values()].find((x) => VB['sim/eligibility'].eligible(st, x, st.pawns[id]));
  assert.ok(j, 'a job the pawn may take');
  assert.strictEqual(Sim.plan(st, id, 'add', { key: j.key }), true);
  const plan = st.plans.households.get(hh.id),
    s = Steps.pawnPlan(st, id).steps[0];
  assert.strictEqual(of(Sim.decisions(st, id), 'ahead', { kind: 'pawn', id })[0].deadline, plan.nextReview, 'its own days ahead');
  assert.strictEqual(of(Sim.decisions(st, id), 'risk').length, 0, 'no step at risk');
  Steps.atRisk(st, s, { short: 3, since: Math.floor(st.t) });
  const risk = of(Sim.decisions(st, id), 'risk');
  assert.ok(risk.length === 1 && risk[0].step === s.id && risk[0].deadline === plan.nextReview, 'at risk, until the next review');
  assert.strictEqual(st.commanded.length, 3, 'the three commands through the facades recorded');
  assert.deepStrictEqual(
    st.commanded.map((e) => e.cmd.verb),
    ['auto', 'queue', 'plan'],
    'each with its verb',
  );
  sound(st, 'a leg and a step at risk');
}

// 3. An ask to answer: the one asked has a point until the offer falls due, when its judgement answers.
{
  const w = tinyWorld(Array(18).fill('.'.repeat(28)), { seed: 7 });
  const st = tinyState(w, [{ at: [7, 9], farms: 3, sizes: [7, 4, 3] }]);
  st.naturalDeaths = false;
  const HANS = 0,
    INGEBORG = 12;
  L.killPawn(st, 1, 'illness');
  L.killPawn(st, 11, 'illness');
  Sim.advance(st, DAY);
  const home = st.pawns[INGEBORG].household;
  assert.strictEqual(
    Sim.command(st, {
      actor: HANS,
      verb: 'offer',
      target: INGEBORG,
      source: 'asking',
      args: { basis: 'match', gives: { man: HANS, home }, wants: { woman: INGEBORG }, due: st.t + DAY },
    }),
    true,
  );
  const o = st.offers[0],
    n0 = VB.count.pointOffer,
    ask = of(Sim.decisions(st, INGEBORG), 'ask');
  assert.ok(st.offers.length >= 1 && VB.count.pointOffer - n0 === st.offers.length, 'each open offer looked at once, a call');
  assert.ok(ask.length === 1 && ask[0].offer === o.id && ask[0].deadline === Math.ceil(o.due / DAY) * DAY, 'the ask, until the day it falls due turns');
  for (const p of st.living) {
    const owes = o.answers.some((a) => a.by === p && a.yes === null);
    assert.strictEqual(of(Sim.decisions(st, p), 'ask').length, owes ? 1 : 0, `pawn ${p}: an ask only where it has an answer to give`);
  }
  Sim.advance(st, Math.round((ask[0].deadline - st.t) * TICKS) / TICKS);
  assert.ok(!st.offers.includes(o), 'past its deadline the judgement answered');
  assert.strictEqual(of(Sim.decisions(st, INGEBORG), 'ask').length, 0, 'and the point is gone');
  sound(st, 'an ask');
}

// 4. The replay: a scripted controller drives a pawn (its switch off, a walk or home at each leg's end, a refusal among them) and its
// head (a target), from a save; the save loaded and the commands recorded since it given again reach the same state, record and all.
{
  const st = make(4.5),
    hh = st.households[0],
    id = hh.members.find((m) => m !== hh.holder && st.pawns[m].alive);
  assert.strictEqual(Sim.command(st, { actor: id, verb: 'auto', args: { on: true }, source: 'player' }), true);
  Sim.advance(st, 2);
  const saved = JSON.parse(JSON.stringify(Sim.save(st))),
    from = st.commanded.length;
  assert.strictEqual(from, 1, 'one command before the save');
  VB['sim/agents'].release(st, st.agents[id]);
  Sim.setAuto(st, id, false);
  // the pawn released from its task by the test's hand (not a command, so not recorded): done again on the loaded save, at the same tick
  let walks = 0,
    refused = 0;
  for (let n = 0; n < 2 * 24 * TICKS; n++) {
    if (n === 30) assert.strictEqual(Sim.head(st, hh.holder, 'target', { store: 'wood', n: 5 }), true);
    if (n === 40) {
      assert.notStrictEqual(Sim.command(st, { actor: id, verb: 'walkTo', target: -5, source: 'player' }), true);
      refused++;
    }
    if (of(Sim.decisions(st, id), 'leg').length) {
      const to = walks % 2 ? null : st.villages[0].center;
      Sim.queue(st, id, to === null ? { verb: 'goHome' } : { verb: 'walkTo', target: to });
      walks++;
    }
    Sim.advance(st, 0.1);
  }
  assert.ok(walks >= 2, `the controller answered its legs' ends: ${walks}`);
  sound(st, 'a scripted controller');
  const entries = st.commanded.slice(from);
  assert.ok(entries.every((e, i) => !i || e.tick >= entries[i - 1].tick) && entries.length >= walks + 2, 'each with its time');
  const back = Sim.load(tinyWorld(rows), saved);
  VB['sim/agents'].release(back, back.agents[id]);
  Sim.replay(back, entries);
  Sim.advance(back, (st.tick - back.tick) / TICKS);
  assert.strictEqual(canon(back.commanded), canon(st.commanded), 'the record again the same');
  assert.strictEqual(hash(back), hash(st), 'the replay reaches the same state');
  assert.ok(refused === 1);
}

// 5. The played pawn's order of a visit (Sim.orderVisit, the page's) goes through the door: ordered after a save, it is recorded, and the
// replay plans the same visit (VB-1757 review, F1: it was issued past the record, and the replayed round chose another village).
{
  const Rec = VB['sim/records'],
    { YEAR, SEASON_DAYS, ASK } = VB['sim/rules'];
  const world3 = () => tinyWorld(Array(9).fill('.'.repeat(210)), { seed: 7 });
  const s = tinyState(
    world3(),
    [
      { at: [6, 4], farms: 1, sizes: [5] },
      { at: [156, 4], farms: 1, sizes: [5] },
      { at: [196, 4], farms: 1, sizes: [5] },
    ],
    { seed: 7 },
  );
  const hh = s.households[0],
    man = hh.members.find((k) => k !== hh.holder && Rec.spouseOf(s, k) === null),
    p = s.pawns[man];
  p.sex = 'm';
  p.born = s.t - 25.5 * YEAR;
  p.age = 25;
  VB['sim/wishes'].seedAsking(s);
  VB['sim/heirs'].refreshRoles(s);
  VB['sim/stores'].put(s, hh, 'grain', 3000, 'harvest', { barley: 3000 });
  assert.strictEqual(Sim.inhabit(s, man), true);
  Sim.advance(s, (2 * SEASON_DAYS + ASK.day) * DAY + 11 - s.t);
  for (const q of s.pawns) {
    q.hunger = 0;
    q.hungerLog = [];
  }
  const saved = JSON.parse(JSON.stringify(Sim.save(s))),
    from = (s.commanded || []).length;
  assert.strictEqual(Sim.orderVisit(s, man, man, 2), true, 'a visit to the third village ordered');
  Sim.advance(s, 10);
  const entries = (s.commanded || []).slice(from);
  assert.deepStrictEqual(entries.map((e) => e.cmd.verb), ['visit'], 'the order recorded');
  const back = Sim.load(world3(), saved);
  Sim.replay(back, entries);
  Sim.advance(back, (s.tick - back.tick) / TICKS);
  const visits = (st) => st.visits.filter((e) => e.pawn === man).map((e) => e.village);
  assert.deepStrictEqual(visits(back), visits(s), 'the replay plans the same visit');
  assert.strictEqual(hash(back), hash(s), 'and reaches the same state');
}

console.log(
  "decisionpoints ok: a head's four points and the alderman's year, each answered by the default author past its deadline; a leg's end " +
    "at once, a step at risk until the review, an ask until due; a scripted controller's run and an ordered visit replayed from a save to the same state",
);

// 3. An allotment is a point only where the day the rule would allot puts work on a member the day standing does not (VB-1884; tasks
// done since drop out and change nothing): a day standing as the rule would make it: none, whatever the members; a task struck from the
// standing day: one.
{
  const st = make(4.5),
    hh = st.households[0],
    head = hh.holder,
    body = { kind: 'household', id: hh.id },
    c = VB['sim/rules'].cal(st.t),
    others = hh.members.filter((m) => m !== head && st.pawns[m].died === null);
  assert.ok(others.length >= 1, 'a household of more than the head');
  // the household of two: the head and one other, the rest away
  for (const m of others.slice(1)) st.agents[m].away = { until: st.t + 100 };
  VB['sim/day'].allot(st, hh, c);
  const n0 = VB.count.dayWould;
  assert.strictEqual(of(Sim.decisions(st, head), 'allot', body).length, 0, 'a household of two, its day as the rule would make it: none');
  assert.ok(VB.count.dayWould > n0, 'the day weighed, counted');
  const plan = st.plans.households.get(hh.id),
    lists = plan.day.lists,
    would = VB['sim/day'].weighDay(st, hh, c).lists,
    who = Object.keys(would).find((id) => would[id].length);
  assert.ok(who, 'a day with work in it');
  const struck = would[who][0];
  lists[who] = lists[who].filter((t) => t !== struck);
  assert.strictEqual(of(Sim.decisions(st, head), 'allot', body).length, 1, `${struck} struck from the standing day: an allotment point`);
  // the household of one: the other away too, the day allotted as the rule would
  st.agents[others[0]].away = { until: st.t + 100 };
  VB['sim/day'].allot(st, hh, c);
  const h1 = hash(st);
  assert.strictEqual(of(Sim.decisions(st, head), 'allot', body).length, 0, 'a household of one, its day as the rule would make it: none');
  assert.strictEqual(hash(st), h1, 'asking writes nothing');
  assert.ok(VB.count.dayWould > n0, 'the day weighed, counted');
}
