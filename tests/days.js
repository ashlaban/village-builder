// Days owed (VB-462): an obligation of kind `days` is called by the creditor's holder for a day three or more days ahead, worked on the basis
// `owed` on the creditor's field (walking there and home), and booked to the field as others' hours; a household with its own harvest waiting
// or below its floor sends nobody and the day stays owed; at the year's end a debt's days stand and the keep's lapse, told once.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  { tinyWorld, tinyState } = require('./lib/tiny.js');
const { eligible } = VB['sim/eligibility'],
  Jobs = VB['sim/jobs'],
  O = VB['sim/obligations'],
  { issue } = VB['sim/commands'];
const { age } = VB['sim/records'],
  { DAY } = VB['sim/rules'],
  { MATCH } = VB['sim/roles'],
  { DAYS } = VB['sim/days'];
const { checkState } = require('./lib/invariants.js'),
  Days = VB['sim/days'];
const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))), [{ at: [8, 10], farms: 2, sizes: [4, 4] }], {
  seed: 4,
});
Sim.advance(st, 3);
const [A, B] = [st.households[0], st.households[1]],
  fA = st.farmsteads[A.farmstead],
  fB = st.farmsteads[B.farmstead];
const dropAll = (key) => {
  for (const j of [...(st.jobsBy.get(key) || [])]) {
    st.jobs.delete(j.key);
    st.jobsBy.get(key).delete(j);
  }
};
const quiet = () => {
  for (const h of [A, B]) {
    dropAll(`household:${h.id}`);
    h.waterDay = Sim.cal(st.t).day;
  }
  dropAll(`village:${fA.village}`);
};
const adults = (hh) => hh.members.filter((id) => st.pawns[id].alive && age(st, st.pawns[id]) >= MATCH.help.minAge);
const hand = adults(B)[0],
  today = () => Math.floor(st.t / DAY);
quiet();
const fd = fA.fields[0];
fd.stage = 'stubble';
const post = () => {
  const j = Jobs.post(st, `plow:f${fA.id}.${fd.id}`, 'plow', { type: 'household', id: A.id }, fd.tile, {
    field: fd,
    farm: fA,
  });
  j.hours = 60;
  return j;
};
let j = post();
A.grain = { barley: 4000 };
B.grain = { barley: 4000 };
const oid = O.create(st, {
  kind: 'days',
  debtor: { kind: 'household', id: B.id },
  creditor: { kind: 'household', id: A.id },
  owes: { days: 2 },
  source: 'debt',
});
const call = (args) => issue(st, { actor: A.holder, verb: 'callDays', target: oid, args, source: 'player' });
assert.ok(/at least 3 days ahead/.test(call({ day: today() + 1 })), 'a day is called three days ahead at least');
assert.ok(
  /only the holder/.test(issue(st, { actor: hand, verb: 'callDays', target: oid, args: {}, source: 'player' })),
  'only the creditor holder calls',
);
B.grain = { barley: 0 };
assert.ok(/floor/.test(call({})), 'a household below its floor sends nobody');
B.grain = { barley: 4000 };
const own = Jobs.post(st, `reap:f${fB.id}.0`, 'reap', { type: 'household', id: B.id }, fB.fields[0].tile, {
  field: fB.fields[0],
  farm: fB,
});
assert.ok(/harvest/.test(call({})), 'its own harvest waiting: nobody is called');
st.jobs.delete(own.key);
st.jobsBy.get(`household:${B.id}`).delete(own);
const D = today() + DAYS.notice;
assert.strictEqual(call({ day: D, pawn: hand }), true, 'a day is called');
assert.ok(/called for that day already/.test(call({ day: D })), 'one adult of a household a day');
assert.strictEqual(st.obligations[oid].called, 1);
assert.deepStrictEqual(
  checkState(st).filter((b) => /obligation|days/.test(b)),
  [],
);
// the hand is on duty only on the day, and takes tasks of the creditor's plan only
const p = st.pawns[hand];
assert.strictEqual(eligible(st, j, p), null, 'not before the day');
while (today() < D) {
  Sim.advance(st, 1);
  quiet();
  if (!st.jobs.has(j.key)) j = post();
}
Sim.advance(st, 0.2);
assert.strictEqual(st.daysToday.day, D);
assert.strictEqual(eligible(st, j, p), 'owed', "on duty: the creditor's tasks, on the basis owed");
const mine = Jobs.post(
  st,
  `plow:f${fB.id}.${fB.fields[0].id}`,
  'plow',
  { type: 'household', id: B.id },
  fB.fields[0].tile,
  { field: fB.fields[0], farm: fB },
);
assert.strictEqual(eligible(st, mine, p), null, "and not its own household's");
st.jobs.delete(mine.key);
st.jobsBy.get(`household:${B.id}`).delete(mine);
// the creditor's other tasks are held out of the way (its other field may come to be plowed as the timings move: VB-360), so the hand's
// one task of the creditor's is j
const others = () => {
  for (const q of [...(st.jobsBy.get(`household:${A.id}`) || [])])
    if (q !== j && q.kind === 'plow') {
      st.jobs.delete(q.key);
      st.jobsBy.get(`household:${A.id}`).delete(q);
    }
};
while (st.t < D * DAY + 12) {
  Sim.advance(st, 0.5);
  dropAll(`household:${B.id}`);
  others();
  B.waterDay = Sim.cal(st.t).day;
}
const a = st.agents[hand];
assert.ok(
  a.job === j && a.basis === 'owed',
  `at noon it works the creditor's field (job ${a.job && a.job.key}, ${a.basis})`,
);
assert.ok(a.job.site === fd.tile, "on the creditor's field");
while (st.t < D * DAY + 23) {
  Sim.advance(st, 0.5);
  dropAll(`household:${B.id}`);
  B.waterDay = Sim.cal(st.t).day;
}
const o = st.obligations[oid];
assert.ok(o.delivered > 0.3 && o.delivered <= 1 + 1e-9, `the day worked is delivered (${o.delivered})`);
assert.ok(
  fd.hoursOther >= o.delivered * DAYS.hours - 1e-6 && fd.hoursOwn > 0,
  `booked as others' hours (${fd.hoursOther}, ${fd.hoursOwn})`,
);
assert.ok(!a.job && st.daysToday.by[hand][1] <= DAYS.hours + 1e-9, "home at night, no more than the day's hours");
assert.ok(o.called >= 1, 'the call stands until the day is over (the planner may have called later days)');
Sim.advance(st, 3);
assert.ok(st.daysToday.day > D && o.called <= Math.ceil(O.left(o)), 'then it is over; what was not worked stays owed');
assert.ok(O.left(o) > 0 || o.status === 'met');
// a day called, and then its household's own harvest waiting that day: nobody comes, and the day stays owed
B.grain = { barley: 4000 };
const oid2 = O.create(st, {
  kind: 'days',
  debtor: { kind: 'household', id: B.id },
  creditor: { kind: 'household', id: A.id },
  owes: { days: 5 },
  source: 'debt',
});
const D2 = today() + DAYS.notice + 2,
  o2 = st.obligations[oid2];
// the creditor has work for another hand (VB-476: its hands are allotted by its head's estimate, and its fields may be worked down by now)
if (!st.jobs.has(j.key)) j = post();
j.hours = Math.max(j.hours ?? 0, (j.done || 0) + 100);
assert.strictEqual(
  issue(st, { actor: A.holder, verb: 'callDays', target: oid2, args: { day: D2, pawn: hand }, source: 'player' }),
  true,
);
const f0 = fB.fields[0],
  was = [f0.stage, f0.crop];
f0.stage = 'ripe';
f0.crop = 'barley';
const reap = Jobs.post(st, `reap:f${fB.id}.0`, 'reap', { type: 'household', id: B.id }, fB.fields[0].tile, {
  field: fB.fields[0],
  farm: fB,
});
reap.hours = 1000;
const repost = () => {
  if (!st.jobs.has(reap.key)) {
    st.jobs.set(reap.key, reap);
    st.jobsBy.get(`household:${B.id}`).add(reap);
  }
};
while (today() < D2) {
  Sim.advance(st, 0.1);
  repost();
  A.grain = B.grain = { barley: 4000 };
  for (const h of [A, B]) h.waterDay = Sim.cal(st.t).day;
}
Sim.advance(st, 0.2);
assert.strictEqual(st.daysToday.day, D2);
repost();
assert.ok(!st.daysToday.by[hand], 'its own harvest waiting: not called away');
assert.ok(O.left(o2) === 5 && o2.called === 0, 'the day stays owed, and is no longer called');
st.jobs.delete(reap.key);
st.jobsBy.get(`household:${B.id}`).delete(reap);
[f0.stage, f0.crop] = was;
// a term's end: a debt's days stand, the keep's lapse, told once
const mk = (source) =>
  O.create(st, {
    kind: 'days',
    debtor: { kind: 'household', id: B.id },
    creditor: { kind: 'household', id: A.id },
    owes: { days: 4 },
    source,
    due: st.t + 2,
  });
const debt = mk('debt'),
  keep = mk('keep');
const n0 = st.record.length;
Sim.advance(st, 3);
assert.strictEqual(st.obligations[debt].status, 'overdue', "a debt's days stand");
assert.strictEqual(st.obligations[keep].status, 'lapsed', "the keep's days lapse");
assert.strictEqual(st.record.slice(n0).filter((e) => /lapsed/.test(e.text || '')).length, 1, 'told once');
assert.deepStrictEqual(
  checkState(st).filter((b) => /obligation|days/.test(b)),
  [],
);
// hours booked while the creditor's load is on the road: it is brought in before the pawn goes home (VB-1548)
{
  const Days = VB['sim/days'],
    ag = st.agents[hand],
    was = [ag.job, ag.load, st.daysToday];
  st.daysToday = { day: today(), by: { [hand]: [oid, DAYS.hours, 0] } };
  const e = st.daysToday.by[hand];
  ag.job = j;
  ag.load = 1;
  Days.step(st);
  assert.strictEqual(e[2], 0, 'a load on the road: no goHome yet');
  ag.load = 0;
  ag.job = null;
  Days.step(st);
  assert.strictEqual(e[2], 1, 'the load delivered: the hand goes home');
  [ag.job, ag.load, st.daysToday] = was;
}
console.log(
  "days ok: a day called, worked on the creditor's field as others' hours, home at night; a keep lapses, a debt stands",
);
// VB-1813: an owed hand whose hours are booked while it is cut at a creditor's trip (a basket of stone picked: the load made, carried to the
// creditor's store by the methods) and on a wood haul (the load in hand set in the creditor's store) sets the load in the store, then walks home
// (sim/agents dayGiven, onward); the store is the creditor's, never the debtor's
{
  const { tinyWorld, tinyState } = require('./lib/tiny.js'),
    Agents = VB['sim/agents'],
    Stores = VB['sim/stores'],
    { cal } = VB['sim/rules'];
  const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' : '.'.repeat(36)));
  const mkst = () => {
    const s = tinyState(tinyWorld(rows), [{ at: [8, 8], farms: 2, sizes: [4, 4] }], { seed: 4 });
    s.naturalDeaths = false;
    Sim.advance(s, 3);
    while (cal(s.t).hour < 8) Sim.advance(s, 0.25);
    return s;
  };
  for (const kind of ['gather', 'wood']) {
    const s = mkst(),
      [CA, CB] = [s.households[0], s.households[1]],
      fa = s.farmsteads[CA.farmstead],
      ob = O.create(s, {
        kind: 'days',
        debtor: { kind: 'household', id: CB.id },
        creditor: { kind: 'household', id: CA.id },
        owes: { days: 2 },
        source: 'debt',
      });
    const h = CB.members.find((m) => s.pawns[m].alive && age(s, s.pawns[m]) >= MATCH.help.minAge),
      ag = s.agents[h];
    const site = s.villages[fa.village].wood[0];
    assert.ok(site >= 0, `${kind}: a site`);
    const jj = Jobs.post(s, `${kind}:test`, kind, { type: 'household', id: CA.id }, site, { farm: fa });
    const mark = (x) => {
      s.daysToday = { day: Math.floor(s.t / DAY), by: { [h]: [ob, x, 0] } };
    };
    mark(0);
    VB['sim/agents'].release(s, ag);
    ag.basis = 'owed';
    Agents.start(s, ag, jj);
    const held = (hh) =>
        kind === 'gather' ? hh.fresh.reduce((x, b) => x + b.qty, 0) : Stores.heldOf(hh, 'timber') + (hh.wood || 0),
      stone = () => held(CA),
      mine = () => held(CB),
      was = [stone(), mine()];
    let n = 0;
    if (kind === 'gather') {
      while (!(ag.leg && ag.leg.kind === 'work') && n++ < 400) Sim.advance(s, 0.1);
      for (let i = 0; i < 5; i++) Sim.advance(s, 0.1); // half an hour of its two hours worked
    } else while (!(ag.load > 0) && n++ < 600) Sim.advance(s, 0.1);
    assert.ok(
      n < 400 && ag.job === jj && (kind === 'wood' || ag.leg.kind === 'work'),
      `${kind}: the hand is at the trip (${n}, ${ag.job && ag.job.key})`,
    );
    const hours = DAYS.hours;
    mark(hours);
    if (kind === 'gather') Days.step(s);
    let i = 0;
    for (; i < 25 && (ag.job || !ag.inside); i++) Sim.advance(s, 0.1); // well within the hours it would take to work on
    assert.ok(
      !ag.job && ag.inside && !(ag.load > 0),
      `${kind}: the load set down, the hand home (${ag.job && ag.job.key}, ${ag.load}, inside ${ag.inside})`,
    );
    assert.ok(
      stone() > was[0] && mine() === was[1],
      `${kind}: the load is in the creditor's store (${was[0]} to ${stone()}; its own ${mine()})`,
    );
  }
}
