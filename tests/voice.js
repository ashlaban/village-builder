// @suite integration
// A member's voice (VB-1555; design.md section 7, A member's voice): a member asks its head for leave, the verb ask (VB-1756), an offer on the basis `leave`
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
    m = A.members.find((id) => VB['sim/levies'].rowOf(st, A, st.pawns[id]) !== null && age(st, st.pawns[id]) >= 12);
  assert.ok(Number.isInteger(m), 'household A has a levied member besides the head pair');
  st.pawns[A.holder].traits[VB['sim/traits'].IDX.diligence] = 0.5; // a head of middling diligence
  return { st, A, m };
};
const askOf = (st, from, to, wants) => issue(st, { actor: from, verb: 'ask', target: to, args: { basis: 'leave', wants }, source: 'pawn' });
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
  assert.match(String(issue(st, { actor: m, verb: 'offer', target: A.holder, args: { basis: 'leave', wants: { from: st.t, with: null } }, source: 'pawn' })), /asked, by the verb ask/, 'leave is asked by the verb ask, never offered (VB-1756)');
  assert.match(String(askOf(st, A.holder, A.holder, { from: st.t, with: null })), /not the head/, 'the head asks no one');
  assert.strictEqual(askOf(st, m, A.holder, { from: st.t - 2 * DAY + WORK[1] - 1, with: null }), true, 'from a past hour: from now');
  assert.ok(Voice.on(st, m), 'the member is on leave');
  const e = Voice.leaveOf(st, m);
  assert.strictEqual(e.until, Math.floor(st.t / DAY) * DAY + WORK[1], 'until the end of the working day');
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
  assert.ok(!Voice.on(st, m) && !Voice.leaveOf(st, m).begun, 'not yet on leave');
  Sim.advance(st, from - st.t);
  assert.ok(Voice.on(st, m) && Voice.leaveOf(st, m).begun, 'on leave from its hour');
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
  if (e) assert.strictEqual(e.with, q, 'the leave is for the visit to its friend');
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
  const o = Sim.opportunities(st, m).find((x) => x.verb === 'ask' && x.leave);
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
const { twins } = require('./lib/twins.js');
// VB-1776: on automatic with nothing queued, the played head asked for leave answers by its pawn's judgement at once, as unplayed
{
  const { A, m } = make();
  const [a] = twins(() => {
    const s = make().st;
    VB['sim/day'].allot(s, s.households[A.id], Sim.cal(s.t));
    return s;
  }, A.holder, (st) => Voice.ask(st, m, st.t), 'the head asked for leave');
  assert.strictEqual(a.offers.filter((o) => o.basis === 'leave').length, 0, 'answered at once');
  const [b] = twins(() => make().st, A.holder, (st) => Sim.advance(st, 2 * DAY), 'two days of its members asking');
  sound(b, 'two days asked');
}
// ---- VB-1763: grant, ask and answer on the levy (design.md, The levy and own hours: Grant and ask; Leave, and a stay away) ----
const Levies = VB['sim/levies'],
  Grants = VB['sim/grants'],
  { balance } = VB['sim/relations'],
  { SEASON_DAYS, YEAR, GOODWILL } = VB['sim/rules'];
{
  // the verb grant, checked by position: the head on a member; a standing grant lowers the levy in force, books goodwill to the head
  const { st, A, m } = make();
  const grantOf = (actor, target, args) => issue(st, { actor, verb: 'grant', target, args, source: 'pawn' });
  const spouse = A.members.find((id) => id !== A.holder && Levies.rowOf(st, A, st.pawns[id]) === null && age(st, st.pawns[id]) >= 18);
  assert.match(String(grantOf(m, m, { hours: 2 })), /not the head/, 'a member grants nothing');
  if (Number.isInteger(spouse)) assert.match(String(grantOf(A.holder, spouse, { hours: 2 })), /owes its household no hours/, 'the head pair owes nothing to grant');
  assert.match(String(grantOf(A.holder, m, { hours: 2, season: Grants.seasonKey(Sim.cal(st.t)) + 2 })), /this season or the next/);
  const was = Levies.levyOf(st, m),
    hands = Grants.handsOf(st, st.pawns[m]),
    owed = balance(st, A.holder, m);
  const review = () => VB['sim/events'].emit(st, 'planReviewed', { plan: planOf(st, 'household', A.id), c: Sim.cal(st.t) });
  review(); // the budget, reckoned at the plan's reviews
  const total0 = planOf(st, 'household', A.id).budget.total;
  assert.strictEqual(grantOf(A.holder, m, { hours: 2 }), true, 'the head grants a standing lighter levy');
  assert.ok(Math.abs(Levies.levyOf(st, m) - (was - 2 * hands)) < 1e-9, 'the levy in force falls by the hours granted');
  const days = SEASON_DAYS - Sim.cal(st.t).sday;
  assert.ok(Math.abs(balance(st, A.holder, m) - owed - 2 * days * hands * GOODWILL.hour) < 1e-6, 'goodwill to the head, the worth of the hours granted');
  assert.match(String(grantOf(A.holder, m, { hours: 1 })), /has a grant for that season/, 'one a season');
  const levied = Levies.levyOf(st, m);
  assert.match(String(grantOf(A.holder, m, { hours: 1, season: Grants.seasonKey(Sim.cal(st.t)) + 1 })), /standing grant in force/,
    'a standing grant is not withdrawn within its season by one of the next');
  assert.ok(Math.abs(Levies.levyOf(st, m) - levied) < 1e-9 && planOf(st, 'household', A.id).grants.season[m][1] === 2, 'the grant stays');
  review();
  assert.ok(Math.abs(planOf(st, 'household', A.id).budget.total - (total0 - 2 * days * hands)) < 1e-6, 'the labour budget counts the grant out');
  // a dated grant of several whole days: the member is on leave and owes nothing those days, booked out of the budget
  const today = Math.floor(st.t / DAY);
  assert.match(String(grantOf(A.holder, m, { day: today + 1, days: 2, from: (today + 1) * DAY + 3 })), /whole days/);
  assert.strictEqual(grantOf(A.holder, m, { day: today + 1, days: 2 }), true, 'leave of two whole days ahead');
  assert.strictEqual(Levies.levyOf(st, m, today + 1), 0, 'no levy on a day of leave');
  assert.strictEqual(Levies.levyOf(st, m, today + 2), 0);
  assert.match(String(grantOf(A.holder, m, { day: today + 2 })), /has leave on day/, 'no overlapping leave');
  assert.ok(!Voice.on(st, m), 'not on leave today');
  Sim.advance(st, DAY);
  assert.ok(Voice.on(st, m) && Voice.leaveOf(st, m).days === 2, 'on leave the next day');
  assert.deepStrictEqual(planOf(st, 'household', A.id).day.lists[m] || [], [], 'the allotment goes around it');
  assert.strictEqual(st.leaves, undefined, 'st.leaves is gone');
  sound(st, 'grants');
}
{
  // an ask of leave answered yes is the head's dated grant on the household's plan
  const { st, A, m } = make();
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  assert.strictEqual(askOf(st, m, A.holder, { from: st.t, with: null }), true);
  const G = planOf(st, 'household', A.id).grants;
  assert.ok(G && G.dated.length === 1 && G.dated[0][0] === m, 'a dated grant on the plan');
  // leave of several days ahead, for a stay away of its own
  const today = Math.floor(st.t / DAY);
  assert.strictEqual(askOf(st, m, A.holder, { from: (today + 3) * DAY, days: 3, with: null }), true);
  assert.strictEqual(G.dated.length, 2, 'three days of leave granted');
  assert.strictEqual(Levies.levyOf(st, m, today + 5), 0);
}
{
  // the ask of a lighter levy: at the season's turn by one that took levy hours the season before; no when the budget less the hours
  // would not fit, and the member remembers it; else by the head's leaning
  const { st, A, m } = make();
  const plan = planOf(st, 'household', A.id),
    c = Sim.cal(st.t),
    key = Grants.seasonKey(c);
  plan.tally = { at: key - 1, of: { [m]: [0, 3, 0] }, year: { at: Math.floor((key - 1) / 4), of: {} } };
  assert.ok(Levies.tallyOf(st, A, c).before[m][1] > 0, 'it took levy hours the season before');
  const ask = (x) => issue(st, { actor: m, verb: 'ask', target: A.holder, args: { basis: 'lighter', wants: { hours: x } }, source: 'pawn' });
  const steps = plan.season || (plan.season = []);
  steps.push({ id: -1, by: c.day - c.sday + SEASON_DAYS - 1, left: { mid: 1e6 } }); // a season that would not fit
  assert.strictEqual(Levies.fitsLess(st, A, m, 0, c), false);
  const before = opinionOf(st, m, A.holder),
    n = VB.count.lighterAsked;
  Voice.lighter(st, A, c);
  assert.strictEqual(VB.count.lighterAsked - n, 1, 'it asks of its own accord at the turn');
  assert.ok(!plan.grants || !plan.grants.season[m], 'no: the budget less the hours would not fit');
  assert.ok(opinionOf(st, m, A.holder) < before, 'a no is a memory of the member');
  steps.pop();
  assert.ok(Levies.fitsLess(st, A, m, 1, c), 'its own season fits with the hours off');
  {
    // a game week short though the season's total covers it: no, by fit's weekly comparison (one reckoning of the season's fit)
    VB['sim/events'].emit(st, 'planReviewed', { plan, c });
    const B = plan.budget,
      wk = Math.floor(c.sday / (SEASON_DAYS / 3));
    const due = (plan.season || []).reduce((a, s) => a + (s.left && s.left.mid > 0 ? s.left.mid : 0), 0);
    steps.push({ id: -2, by: c.day, left: { mid: B.weeks[wk] + 1 } });
    assert.ok(wk < 2 && due + B.weeks[wk] + 1 < B.total, 'the season total would cover it (the case is a short week only)');
    assert.strictEqual(Levies.fitsLess(st, A, m, 0, c), false, 'short in this game week: it does not fit');
    steps.pop();
  }
  const k = A.members.filter((id) => id !== m && id !== A.holder);
  for (const id of k) assert.ok(!Levies.tallyOf(st, A, c).before[id], 'the others took none, and do not ask');
  assert.strictEqual(ask(1), true);
  assert.ok(plan.grants && plan.grants.season[m] && plan.grants.season[m][1] === 1, 'yes: a standing grant of an hour a day');
  sound(st, 'a lighter levy');
}
{
  // the played head is asked a lighter levy: a decision point to answer
  const { st, A, m } = make();
  Sim.inhabit(st, A.holder);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Voice.askLighter(st, m, 1), true);
  assert.ok(Sim.decisions(st, A.holder).some((x) => x.point === 'ask' && x.basis === 'lighter'), 'an ask of a lighter levy to answer');
  assert.ok(Sim.decisions(st, A.holder).every((x) => x.point !== 'ask' || x.basis !== 'leave'));
  assert.strictEqual(askOf(st, m, A.holder, { from: st.t, with: null }), true);
  assert.ok(Sim.decisions(st, A.holder).some((x) => x.point === 'ask' && x.basis === 'leave'), 'an ask of leave to answer');
}
{
  // a servant's contract renewed writes its free day at its term, the moving round's whole day, on its household's plan
  const { st, A, m } = make();
  const p = st.pawns[m];
  p.servant = true;
  p.servedSince = st.t - YEAR;
  VB['sim/service'].oweWages(st);
  const G = planOf(st, 'household', A.id).grants;
  assert.ok(G && G.dated.some((g) => g[0] === m && g[2] === 1 && g[1] === g[3] / DAY), 'a whole day granted');
  const g = G.dated.find((x) => x[0] === m);
  assert.strictEqual(Sim.cal(g[1] * DAY + 8).season, 2, 'in autumn');
  assert.strictEqual(Sim.cal(g[1] * DAY + 8).sday, VB['sim/rules'].ASK.day, "on the moving round's day");
  assert.strictEqual(Levies.levyOf(st, m, g[1]), 0, 'it owes nothing that day');
}
console.log('voice ok: leave asked of the head, answered by its day and its opinion, taken around the day; the head grants a lighter levy or leave, asked or not, and a servant its free day');
