// Standing duties (VB-1540; design.md section 7, Standing duties): the head's day remembers. The types of work of the tasks the morning's
// allotment gives a member are its duties (plan.day.duties.held); at the next allotment its fit for a task of such a type counts
// MATCH.keep times, so it does today what it did yesterday unless something changed; a duty no task of the morning answers lapses; a
// much more urgent task still takes the member; the head's verb `duty` sets one, which stands until lifted, the member leaves or the head
// changes. On a small constructed state: three farms on open ground, the hour before work of the second day; household 0's two sons (the
// same role, the same bed, so the same fit) and two tasks of different types made to fit them equally and before all else.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, Jobs = VB['sim/jobs'], { KINDS } = VB['sim/kinds'], { WORK, DAY } = VB['sim/rules'], { ROLES, MATCH } = VB['sim/roles'];
const { issue } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
st.makeFields = false;
Sim.advance(st, DAY + (WORK[0] - 1) - Sim.cal(st.t).hour);
const c = Sim.cal(st.t), hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = st.plans.households.get(0);
assert.strictEqual(c.hour, WORK[0] - 1, 'the hour before work');
const [a, b] = hh.members.filter((m) => st.pawns[m].role === 'son');
assert.ok(a < b && st.pawns[a].age >= 14 && st.pawns[b].age >= 14, 'two grown sons');

// 0. The morning the run made wrote the duties: of today, of the head, types of work for members given tasks; and the card's view reads them.
{
  const D = plan.day.duties;
  assert.ok(D && D.day === Math.floor(st.t / DAY) && D.head === hh.holder, 'the duties are of this morning and this head');
  assert.ok(Object.keys(D.held).length > 0 && Object.values(D.held).every((l) => l.every((t) => Object.values(ROLES).some((r) => t in r.work))), 'types of work');
  assert.deepStrictEqual(Jobs.dutiesOf(st, a), D.held[a].map((type) => ({ type, set: false })), 'the view: what the morning gave');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
}

// two tasks of the household, each more than a day's work for one: the hoeing of a field (tilling) and the reaping of another (harvest)
const post = (kind, fd) => { const j = Jobs.post(st, `${kind}:duty${fd.id}`, kind, { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f }); j.hours = 60; return j; };
const X = post('plow', f.fields[0]), Y = post('reap', f.fields[1]);
const TX = KINDS.plow.type, TY = KINDS.reap.type;
assert.ok(TX !== TY, 'of different types');
// a son's rank for a kind such that its fit is `fit` (the fit is the rank times the urgency, less the walk)
const p = st.pawns[a], score = (j) => Jobs.score(st, p, j, c);
function fitOf(j, fit) {
  const P = ROLES.son.prio;
  P[j.kind] = 10; const s1 = score(j);
  P[j.kind] = 20; const s2 = score(j), u = (s2 - s1) / 10;
  P[j.kind] = (fit + 10 * u - s1) / u;
  assert.ok(Math.abs(score(j) - fit) < 1e-6 && Math.abs(Jobs.score(st, st.pawns[b], j, c) - fit) < 1e-6, `${j.kind} fits both sons at ${fit}`);
}
// the factor is the design's proposed 1.25 here, whatever the tunable stands at (1 until the tuning run: no memory)
const prio0 = { ...ROLES.son.prio }, shipped = MATCH.keep, keep0 = 1.25;
MATCH.keep = keep0;
// the morning, with the duties as given: the day's first allotment at this hour writes them, so they are made yesterday's
const morning = (held, set = plan.day.duties.set) => {
  plan.day.duties = { day: -1, head: plan.day.duties.head, held, set };
  Jobs.allot(st, hh, c);
  return plan.day;
};
const first = (day, id) => st.jobs.get(day.lists[id][0]);
assert.ok(keep0 > 1 && keep0 < MATCH.switchRatio, 'keep is above 1 and under the switch ratio');
fitOf(X, 100);
fitOf(Y, 100);

// 1. With no memory the order is the old one: equal fits fall to the task posted first, then the pawn of the lower id.
{
  const day = morning({});
  assert.ok(first(day, a) === X && first(day, b) === Y, 'afresh: the first son hoes, the second reaps');
  assert.strictEqual(day.duties.held[a][0], TX);
  assert.strictEqual(day.duties.held[b][0], TY);
  assert.strictEqual(day.duties.day, Math.floor(st.t / DAY), 'written by the morning');
}
// 2. The member who did a type yesterday gets it today; and so the day after. No random draw.
{
  const rng = canon(st.rng), n = [VB.count.dutyDay, VB.count.dutyKept];
  let day = morning({ [a]: [TY], [b]: [TX] });
  assert.ok(first(day, a) === Y && first(day, b) === X, 'yesterday the first son reaped: it reaps today');
  assert.deepStrictEqual([day.duties.held[a][0], day.duties.held[b][0]], [TY, TX], 'and holds it for tomorrow');
  assert.ok(VB.count.dutyDay - n[0] >= 2 && VB.count.dutyKept - n[1] >= 2, 'counted: member-days, and those of the same type as the day before');
  day = morning(day.duties.held);
  assert.ok(first(day, a) === Y && first(day, b) === X, 'and the day after');
  assert.strictEqual(canon(st.rng), rng, 'no random draw');
  // a later allotment of the day carries the morning's duties on and weighs by them
  const held = canon(day.duties.held);
  Jobs.allot(st, hh, c);
  assert.strictEqual(canon(plan.day.duties.held), held, 'the day\'s later allotments carry the morning\'s duties');
  assert.ok(first(plan.day, a) === Y, 'and keep to them');
}
// 3. With keep at 1 the order is as before, whatever was held.
{
  MATCH.keep = 1;
  const day = morning({ [a]: [TY], [b]: [TX] });
  assert.ok(first(day, a) === X && first(day, b) === Y, 'keep 1: the order of an allotment afresh');
  MATCH.keep = keep0;
}
// 4. A somewhat better fit does not take a member from its duty; a much more urgent task still does.
{
  fitOf(Y, 110);
  assert.ok(first(morning({}), a) === Y, 'afresh, the better fit comes first');
  assert.ok(first(morning({ [a]: [TX], [b]: [TY] }), a) === X, 'its duty holds against a fit a tenth better');
  fitOf(Y, 100 * MATCH.switchRatio + 10);
  assert.ok(first(morning({ [a]: [TX], [b]: [TY] }), a) === Y, 'a much more urgent task takes it');
  fitOf(Y, 100);
}
// 5. A duty no task of the morning answers lapses.
{
  Y.done = Y.hours; // the reaping is done: no task of its type is left this morning
  const day = morning({ [a]: [TY], [b]: [TX] });
  assert.ok(!Object.values(day.duties.held).some((l) => l.includes(TY)), 'nobody holds the harvest');
  assert.ok(!Jobs.dutiesOf(st, a).some((d) => d.type === TY), 'nor does the card name it');
  Y.done = 0;
}
// 6. The head's verb: refused with its reason; a set duty decides, survives a morning with no task of its type, is lifted, and goes when
// the head changes.
{
  const head = hh.holder, duty = (actor, args, target = hh.id) => issue(st, { actor, verb: 'duty', target, args, source: 'player' });
  const other = st.households[1].members[0];
  assert.match(duty(a, { pawn: a, type: TY, on: true }), /not the head/);
  assert.match(duty(head, { pawn: other, type: TY, on: true }), /not a member/);
  assert.match(duty(head, { pawn: a, type: 'sorcery', on: true }), /no type of work/);
  assert.match(duty(head, { pawn: a, type: TY }), /set .* or lifted/);
  assert.match(duty(head, { pawn: b, type: 'threshing', on: false }), /holds no duty/);
  morning({});
  assert.strictEqual(duty(head, { pawn: a, type: TY, on: true }), true, 'the head sets the first son to the harvest');
  assert.deepStrictEqual(plan.day.duties.set, { [a]: [TY] });
  assert.deepStrictEqual(Jobs.dutiesOf(st, a)[0], { type: TY, set: true }, 'the card names it first, as set');
  let day = morning({});
  assert.ok(first(day, a) === Y && first(day, b) === X, 'the set duty decides between equal fits');
  Y.done = Y.hours;
  day = morning(day.duties.held);
  assert.deepStrictEqual(day.duties.set, { [a]: [TY] }, 'a set duty survives a morning with no task of its type');
  assert.ok(!(day.duties.held[a] || []).includes(TY), 'which the morning did not give');
  Y.done = 0;
  assert.ok(first(morning({}), a) === Y, 'and holds when the task is back');
  // saved and loaded with the plan's day
  const back = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.plans.households.get(0).day.duties), canon(plan.day.duties), 'the duties come back as saved');
  assert.strictEqual(sha(canon(kept(back))), sha(canon(kept(st))), 'the loaded state is the saved one');
  assert.deepStrictEqual(checkState(st), [], 'invariants');
  // lifted: set or not, the member holds it no longer
  assert.strictEqual(duty(head, { pawn: a, type: TY, on: false }), true, 'the head lifts it');
  assert.ok(!plan.day.duties.set[a] && !(plan.day.duties.held[a] || []).includes(TY), 'lifted');
  assert.ok(first(morning({}), a) === X, 'the rule runs again');
  // the head changes: what the old head set goes
  assert.strictEqual(duty(head, { pawn: a, type: TY, on: true }), true);
  hh.holder = b;
  day = morning({});
  assert.deepStrictEqual(day.duties.set, {}, 'a set duty goes when the head changes');
  assert.strictEqual(day.duties.head, b);
  assert.ok(first(day, a) === X, 'and the rule runs');
  hh.holder = head;
  // the member leaves: its set duty goes with it
  assert.strictEqual(duty(head, { pawn: a, type: TY, on: true }), true);
  const members = hh.members;
  hh.members = members.filter((m) => m !== a);
  assert.deepStrictEqual(morning({}).duties.set, {}, 'a set duty goes when the member leaves');
  hh.members = members;
}
Object.assign(ROLES.son.prio, prio0);
MATCH.keep = shipped;
console.log('duties ok: the morning writes them; yesterday\'s type is kept; keep 1 is the old order; a much more urgent task takes the member; a duty with no task lapses; the verb sets and lifts, refused with its reason; a set duty outlasts a morning and goes with its head or member; saved');
