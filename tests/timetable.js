// The timetable and the head's verbs on the day (VB-477; design.md section 7, The timetable): a household's day as a view, each member's
// list laid end to end with its walks, each task a range by the viewer's estimate, worked out when asked and writing nothing; the head
// reorders a member's list, gives a task to another member and calls a member off, each checked, the change standing until the day is
// next allotted. On the small constructed state of tests/day.js: three farms on open ground, spring day 0.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { issue } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
st.makeFields = false;
Sim.advance(st, 4.5);
const dayOf = (id) => st.plans.households.get(id).day;
// a household with two grown members with tasks, and its head
const hh = st.households.find((h) => !h.dissolved && h.holder !== null && h.members.filter((m) => (dayOf(h.id).lists[m] || []).length > 1).length >= 2);
assert.ok(hh, 'a household with two members at work');
const head = hh.holder, [m1, m2] = hh.members.filter((m) => dayOf(hh.id).lists[m].length > 1);

// 1. The view: one row a living member; entries end to end, each walk then its range; lo <= mid <= hi; progress exact; nothing written.
{
  const before = canon(st);
  const T = Sim.timetable(st, hh);
  assert.strictEqual(canon(st), before, 'the timetable writes nothing');
  assert.strictEqual(T.viewer, st.plans.households.get(hh.id).head.pawn, 'by default the head reckons it');
  assert.strictEqual(T.edited, null, 'no change by the head yet');
  assert.deepStrictEqual(T.members.map((r) => r.id).sort(), hh.members.filter((m) => st.pawns[m].died === null).sort(), 'a row a living member');
  for (const r of T.members) {
    let end = { lo: 0, mid: 0, hi: 0 };
    for (const e of r.entries) {
      assert.ok(e.lo <= e.mid + 1e-9 && e.mid <= e.hi + 1e-9, `${e.key}: lo <= mid <= hi`);
      assert.ok(e.walk >= 0 && e.done >= 0 && e.done <= 1, `${e.key}: a walk and its share done`);
      for (const k of ['lo', 'mid', 'hi']) {
        assert.ok(Math.abs(e.start[k] - (end[k] + e.walk)) < 1e-9, `${e.key}: begins after the last, and its walk (${k})`);
        assert.ok(Math.abs(e.end[k] - (e.start[k] + e[k])) < 1e-9, `${e.key}: ends after its hours (${k})`);
      }
      end = e.end;
    }
    const keys = r.entries.map((e) => e.key).concat(r.rest);
    assert.ok(keys.every((k) => dayOf(hh.id).lists[r.id].includes(k)), `pawn ${r.id}: every entry is of its list`);
  }
  // another pawn's estimate: the same tasks, by its own judgement
  const other = hh.members.find((m) => m !== head && st.pawns[m].died === null);
  const O = Sim.timetable(st, hh, other);
  assert.strictEqual(O.viewer, other);
  assert.deepStrictEqual(O.members.map((r) => r.entries.map((e) => e.key)), T.members.map((r) => r.entries.map((e) => e.key)), 'the same lists');
}

// 1b. The view writes no saved state (review F1): the route cache stays as it was, and the save is the same, after the timetable and the
// costs are read for every member of every household.
{
  const before = JSON.stringify(Sim.save(st)), keys = [...st.pathCache.keys()].join();
  for (const h of st.households) if (!h.dissolved) {
    Sim.timetable(st, h);
    for (const m of h.members) if (st.pawns[m].died === null) { Sim.callCost(st, m); if (Sim.taskLeft) Sim.taskLeft(st, m); }
  }
  assert.strictEqual([...st.pathCache.keys()].join(), keys, 'the route cache is not written by a view');
  assert.strictEqual(JSON.stringify(Sim.save(st)), before, 'the save is the same after the view');
}

// 2. The verbs: only the head changes the day; each refuses with its reason and changes nothing.
{
  const before = canon(dayOf(hh.id));
  const notHead = hh.members.find((m) => m !== head && st.pawns[m].died === null);
  assert.match(String(issue(st, { actor: notHead, verb: 'dayOrder', target: hh.id, args: { member: m1, from: 0, to: 1 }, source: 'player' })), /not the head/);
  assert.match(String(issue(st, { actor: head, verb: 'dayOrder', target: hh.id, args: { member: m1, from: 0, to: 99 }, source: 'player' })), /no place/);
  assert.match(String(issue(st, { actor: head, verb: 'dayGive', target: hh.id, args: { key: 'nothing', from: m1, to: m2 }, source: 'player' })), /not in pawn/);
  assert.match(String(issue(st, { actor: head, verb: 'dayCall', target: hh.id, args: { member: 999 }, source: 'player' })), /not a living member/);
  assert.strictEqual(canon(dayOf(hh.id)), before, 'a refused change changes nothing');
}

// 3. dayOrder: the entry moves with its fit and hours; the day says the head changed it.
{
  const d = dayOf(hh.id), l = d.lists[m1].slice(), f = d.fits[m1].slice(), h = d.hours[m1].slice();
  assert.strictEqual(issue(st, { actor: head, verb: 'dayOrder', target: hh.id, args: { member: m1, from: 0, to: 1 }, source: 'player' }), true);
  assert.deepStrictEqual(d.lists[m1], [l[1], l[0], ...l.slice(2)], 'the first two swapped');
  assert.deepStrictEqual(d.fits[m1], [f[1], f[0], ...f.slice(2)], 'their fits with them');
  assert.deepStrictEqual(d.hours[m1], [h[1], h[0], ...h.slice(2)], 'their hours with them');
  assert.deepStrictEqual(d.edited, { t: st.t, by: head }, 'the day says the head changed it');
  assert.deepStrictEqual(Sim.timetable(st, hh).edited, d.edited, 'and the timetable says so');
}

// 4. dayGive: a task of m1's list that m2 does not hold goes to m2, with its hours; the free hours follow.
{
  const d = dayOf(hh.id), given = (id, k) => { const i = d.lists[id].indexOf(k); return i >= 0 && (d.fits[id][i] === null || d.fits[id][i] > 0); };
  let a = null, b = null, j = null;
  for (const x of hh.members) for (const y of hh.members) for (const k of d.lists[x] || [])
    if (!j && x !== y && d.lists[y] && d.lists[y].length && given(x, k) && !given(y, k) && st.jobs.get(k) && VB['sim/eligibility'].eligible(st, st.jobs.get(k), st.pawns[y])) [a, b, j] = [x, y, k];
  assert.ok(j, 'a task another member may take');
  {
    const i = d.lists[a].indexOf(j), h = d.hours[a][i], f1 = d.free[a], f2 = d.free[b];
    assert.strictEqual(issue(st, { actor: head, verb: 'dayGive', target: hh.id, args: { key: j, from: a, to: b }, source: 'player' }), true);
    assert.ok(!d.lists[a].includes(j) && given(b, j), 'the task moved, given to the taker');
    assert.strictEqual(d.lists[b].filter((k) => k === j).length, 1, 'once in its list');
    assert.strictEqual(d.lists[b].length, d.fits[b].length);
    assert.strictEqual(d.hours[b].length, d.lists[b].length, 'lists, fits and hours stay beside each other');
    if (a in d.free) assert.ok(Math.abs(d.free[a] - (f1 + h)) < 1e-9, 'the giver gets its hours back');
    if (b in d.free) assert.ok(Math.abs(d.free[b] - Math.max(0, f2 - h)) < 1e-9, 'the taker gives them');
    assert.match(String(issue(st, { actor: head, verb: 'dayGive', target: hh.id, args: { key: j, from: b, to: b }, source: 'player' })), /another member/);
    assert.match(String(issue(st, { actor: head, verb: 'dayGive', target: hh.id, args: { key: j, from: a, to: b }, source: 'player' })), /not in pawn/);
  }
}

// 5. The cost of a call, then the call: its walk home and the load it leaves, named first; then the list is empty and it goes home.
{
  Sim.advance(st, 2);
  const d0 = dayOf(hh.id);
  const m = hh.members.find((id) => st.agents[id].job && !st.agents[id].inside && d0.lists[id]);
  assert.ok(m !== undefined, 'a member out at its task');
  const cost = Sim.callCost(st, m);
  assert.ok(cost && cost.walk >= 0 && cost.load >= 0, 'a walk home and a load');
  if (st.agents[m].job) assert.strictEqual(cost.task, st.agents[m].job.key, 'the task it leaves');
  assert.strictEqual(issue(st, { actor: head, verb: 'dayCall', target: hh.id, args: { member: m }, source: 'player' }), true);
  const d = dayOf(hh.id);
  assert.deepStrictEqual([d.lists[m], d.fits[m], d.hours[m]], [[], [], []], 'its list is emptied');
  assert.strictEqual(st.agents[m].job, null, 'it lets its task go');
  assert.ok(st.agents[m].inside || st.agents[m].path, 'it is home, or on its way');
  checkState(st);
  // a task posted now is not slotted to the member called off (review F2), and it takes none of its old ones
  const anyKey = Object.values(d.lists).flat().find((k) => st.jobs.get(k));
  if (anyKey) VB['sim/day'].slotIn(st, hh, st.jobs.get(anyKey), Sim.cal(st.t));
  assert.deepStrictEqual(d.lists[m], [], 'nothing slotted to one called off');
  assert.ok(d.off.includes(m), 'it is off until the day is next allotted');
  // the call stands until the day is next allotted: the member takes no task from it meanwhile
  Sim.advance(st, 0.5);
  if (dayOf(hh.id).edited) assert.deepStrictEqual(dayOf(hh.id).lists[m], [], 'no task given back before the next allotment');
  VB['sim/day'].allot(st, hh, Sim.cal(st.t));
  assert.strictEqual(dayOf(hh.id).edited, undefined, 'the next allotment writes the day whole');
}
// 6. The played head reaches the verbs through Sim.head.
{
  Sim.inhabit(st, head);
  assert.strictEqual(Sim.head(st, st.player.pawn, 'dayOrder', { member: m1, from: 0, to: 0 }), true);
}
// 7. Until my task ends: the cursor is the page's, its stops read only; it stops at the end or cut of the played pawn's task or leg, or at
// what concerns its household; the pawn's task on its card: its share done, exact, and the hours left by a viewer's estimate.
{
  const who = hh.members.find((m) => st.pawns[m].died === null && st.agents[m].job) ?? head;
  Sim.inhabit(st, who);
  const c = Sim.taskFrom(st);
  assert.strictEqual(c.pawn, who);
  const T = Sim.taskLeft(st, who, head);
  if (T) {
    assert.ok(T.done >= 0 && T.done <= 1, 'a share done');
    if (T.left) assert.ok(T.left.lo <= T.left.mid + 1e-9 && T.left.mid <= T.left.hi + 1e-9, 'a range');
  }
  let stop = null, steps = 0;
  while (!stop && steps < 480) {
    Sim.advance(st, 0.1);
    steps++;
    const before = canon(st);
    stop = Sim.taskStop(st, c);
    assert.strictEqual(canon(st), before, 'taskStop writes nothing to st');
  }
  assert.ok(stop, 'a stop within two days');
  assert.ok(['task', 'leg', 'day', 'help', 'store', 'household'].includes(stop.why), `a stop of its own: ${stop.why}`);
  assert.ok(typeof stop.text === 'string' && stop.text.length > 0);
  Sim.uninhabit(st);
  assert.strictEqual(Sim.taskFrom(st), null, 'no pawn played, no cursor');
}
console.log('timetable ok: the view laid end to end and read only; dayOrder, dayGive, dayCall checked and standing until the next allotment; until my task ends stops and writes nothing');
