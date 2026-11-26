// A member's voice (VB-1555; design.md section 7, A member's voice): a member asks its head for leave, an offer on the basis `leave`
// (sim/voice). On a constructed household: a head whose day gave the member a task with a deadline today says no, and the member
// remembers it; a head with a free day says yes by its opinion of the member, and no to one it thinks ill of; on a yes the day is allotted
// around the member, who leaves its task and spends the hours at its own time; a leave from an hour named begins at that hour; a pawn
// with a reason asks of its own accord after the morning's allotment, at most once in VOICE.days; the played member's Actions offer the
// ask with its head's likely answer.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');
const Voice = VB['sim/voice'],
  { VOICE } = Voice,
  Jobs = VB['sim/jobs'],
  { issue } = VB['sim/commands'],
  { opinionOf, remember } = VB['sim/relations'],
  { age } = VB['sim/records'],
  { planOf } = VB['sim/plans'],
  { DAY, WORK } = VB['sim/rules'];
const make = () => {
  const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))), [{ at: [8, 10], farms: 2, sizes: [5, 4] }], { seed: 4 });
  Sim.advance(st, 3); // 9:00 on the first day of spring
  const A = st.households[0],
    m = A.members.find((id) => id !== A.holder && age(st, st.pawns[id]) >= 16);
  assert.ok(Number.isInteger(m), 'household A has a grown member besides its head');
  st.pawns[A.holder].traits[VB['sim/traits'].IDX.diligence] = 0.5; // a head of middling diligence
  return { st, A, m };
};
const askOf = (st, from, to, wants) => issue(st, { actor: from, verb: 'offer', target: to, args: { basis: 'leave', wants }, source: 'planner' });
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);

// ---- a deadline today: no, and the member remembers it ----
{
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  const f = st.farmsteads[A.farmstead],
    j = Jobs.post(st, 'cook:test', 'cook', { type: 'household', id: A.id }, f.house, {}),
    day = planOf(st, 'household', A.id).day;
  day.lists[m].unshift(j.key); // the head's day made the member the meal's hand
  day.fits[m].unshift(null);
  day.hours[m].unshift(2);
  assert.strictEqual(Voice.wanted(st, A, m, Sim.cal(st.t)), j, "the head's day wants the member for the meal");
  assert.strictEqual(Voice.likely(st, m), false, 'its likely answer is no');
  const before = opinionOf(st, m, A.holder);
  assert.strictEqual(askOf(st, m, A.holder, { from: st.t, with: null }), true, 'the ask is made');
  assert.strictEqual(Voice.leaveOf(st, m), null, 'a head with a deadline today says no');
  assert.ok(opinionOf(st, m, A.holder) < before, 'the member remembers the refusal');
  assert.ok(!Voice.on(st, m), 'no leave');
  sound(st, 'a leave refused');
}

// ---- a free day: yes by opinion; the day allotted around the member, who spends the hours at its own time ----
{
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  assert.strictEqual(Voice.wanted(st, A, m, Sim.cal(st.t)), null, 'nothing with a deadline today or a window closing');
  assert.strictEqual(Voice.likely(st, m), true, 'a head of middling diligence and no ill will would say yes');
  assert.match(String(askOf(st, m, m, { from: st.t, with: null })), /not the head/, 'leave is asked of the head');
  assert.match(String(askOf(st, A.holder, A.holder, { from: st.t, with: null })), /not the head/, 'the head asks no one');
  assert.strictEqual(askOf(st, m, A.holder, { from: st.t - 2 * DAY + WORK[1] - 1, with: null }), true, 'from a past hour: from now');
  assert.ok(Voice.on(st, m), 'the member is on leave');
  const e = Voice.leaveOf(st, m);
  assert.strictEqual(e[1], Math.floor(st.t / DAY) * DAY + WORK[1], 'until the end of the working day');
  const a = st.agents[m];
  assert.ok(!a.job && a.idleUntil > st.t, 'it left its task and has the hours to itself');
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  const day = planOf(st, 'household', A.id).day;
  assert.deepStrictEqual(day.lists[m], [], 'the day is allotted around it');
  assert.ok(!(m in day.free), 'as around one away: it is not free to lend');
  assert.match(String(askOf(st, m, A.holder, { from: st.t, with: null })), /had leave today/, 'one leave a day');
  sound(st, 'a leave given');
  // the next day it is over
  Sim.advance(st, DAY);
  assert.ok(!Voice.on(st, m), 'a leave ends with its day');
  sound(st, 'a day after a leave');
}
{
  // a head that thinks ill of the member says no
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  for (const k of ['marriedAgainst', 'refusedMatch', 'claim', 'refusedUs', 'crop', 'hardBargain']) remember(st, A.holder, m, k);
  assert.ok(opinionOf(st, A.holder, m) <= -VOICE.base, 'the head thinks ill of the member');
  askOf(st, m, A.holder, { from: st.t, with: null });
  assert.strictEqual(Voice.leaveOf(st, m), null, 'a head that thinks ill of the member says no');
}
{
  // a leave from an hour named begins at that hour
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  const from = Math.floor(st.t / DAY) * DAY + VOICE.from;
  assert.strictEqual(askOf(st, m, A.holder, { from, with: null }), true);
  assert.ok(!Voice.on(st, m) && Voice.leaveOf(st, m)[2] === 0, 'not yet on leave');
  Sim.advance(st, from - st.t);
  assert.ok(Voice.on(st, m) && Voice.leaveOf(st, m)[2] === 1, 'on leave from its hour');
  const day = planOf(st, 'household', A.id).day;
  assert.deepStrictEqual(day.lists[m], [], "the afternoon's allotment goes around it");
  sound(st, 'a leave from an hour');
}

// ---- of its own accord: after the morning's allotment, with someone to visit, at most once in VOICE.days ----
{
  const { st, A, m } = make();
  const B = st.households[1],
    q = B.holder,
    p = st.pawns[m];
  p.bands.set(q, 1); // a close friend on the other farm of the village
  const morning = () => {
    VB['sim/day'].allot(st, A, Sim.cal(st.t));
    const day = planOf(st, 'household', A.id).day;
    if (!day.lists[m].length) day.lists[m].push('anything'), day.fits[m].push(1), day.hours[m].push(1); // the day gave it work
    const n = VB.count.leaveAsked;
    Voice.hour(st, { hour: WORK[0] - 1 });
    return VB.count.leaveAsked - n;
  };
  const today = Math.floor(st.t / DAY);
  p.sat = today - VOICE.days + 1;
  assert.strictEqual(morning(), 0, 'one who visited within VOICE.days does not ask');
  p.sat = today - VOICE.days;
  assert.strictEqual(morning(), 1, 'one who has not visited for VOICE.days asks');
  assert.strictEqual(p.voiced, today, 'and notes the day');
  const e = Voice.leaveOf(st, m);
  if (e) assert.strictEqual(e[3], q, 'the leave is for the visit to its friend');
  assert.strictEqual(morning(), 0, 'it asks at most once in VOICE.days');
  p.voiced = today - VOICE.days + 1;
  assert.strictEqual(morning(), 0, 'not within VOICE.days of its last ask');
  p.bands.delete(q);
  p.voiced = today - VOICE.days;
  assert.strictEqual(morning(), 0, 'one with no one to visit has no reason to ask');
  sound(st, 'own asks');
}

// ---- the played member's Actions: the ask, with its head's likely answer ----
{
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  Sim.inhabit(st, m);
  const o = Sim.opportunities(st, m).find((x) => x.verb === 'offer' && x.leave);
  assert.ok(o, 'the played member may ask leave');
  assert.strictEqual(o.target, A.holder, 'of its head');
  assert.strictEqual(o.leave.likely, true, "with its head's likely answer");
  assert.strictEqual(o.why, null);
}
// ---- the played head is asked, and answers by the verb, its pawn's judgement shown as advice ----
{
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  Sim.inhabit(st, A.holder);
  Sim.setAuto(st, st.player.pawn, false); // the player answers for itself
  assert.strictEqual(askOf(st, m, A.holder, { from: st.t, with: null }), true);
  const o = Sim.opportunities(st, A.holder).find((x) => x.when === 'offer' && x.offer.basis === 'leave');
  assert.ok(o, 'the played head is asked');
  assert.strictEqual(o.offer.advice, true, "its pawn's judgement: yes");
  assert.strictEqual(Voice.leaveOf(st, m), null, 'nothing given before it answers');
  assert.strictEqual(issue(st, { actor: A.holder, verb: 'answer', target: o.target, args: { yes: true }, source: 'player' }), true);
  assert.ok(Voice.on(st, m), 'its yes gives the leave');
  sound(st, 'the played head answered');
}
console.log('voice ok: leave asked of the head, answered by its day and its opinion, taken around the day');
