// @suite integration
// Obligations (VB-310; target-v2, 4.4): every explicit claim has one owner, sim/obligations, with a due-queue and the parties' lists of
// their live ones, two caches rebuilt here from the records and compared. The heirs' shares are its first kind: owed by the farm, paid
// at the moving round from grain above the reserve (sim/cottage payOwed), by the sibling's id.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, O = VB['sim/obligations'], probe = require('./lib/probe.js');
const { YEAR, DAY, SHARES, cal, ASK } = VB['sim/rules'], { payOwed } = VB['sim/cottage'];
const { checkState } = require('./lib/invariants.js');
const sound = (st, when) => {
  const made = O.rebuilt(st);
  assert.deepStrictEqual(st.obligationsDue, made.due, `${when}: the due-queue is the running ones, by due then id`);
  assert.deepStrictEqual(st.obligationsBy, made.by, `${when}: the parties' lists are the live ones`);
  assert.deepStrictEqual(checkState(st).filter((b) => /obligation/.test(b)), [], `${when}: invariants`);
};
const H = (id) => ({ kind: 'household', id }), P = (id) => ({ kind: 'pawn', id });
const setGrain = (hh, n) => { hh.grain = { barley: n }; };

{ // the records, the caches and the operations
  const st = probe.state(), [a, b] = st.households.filter((h) => !h.dissolved);
  assert.strictEqual(st.obligations, undefined, 'absent until the first');
  assert.deepStrictEqual(O.due(st, H(a.id), 'debtor'), [], 'and nothing is due of anyone');
  assert.strictEqual(Sim.shareOwed(st, a.holder), 0);
  const x = O.create(st, { kind: 'share', debtor: H(a.id), creditor: P(b.holder), owes: { rations: 30 } });
  const y = O.create(st, { kind: 'share', debtor: H(a.id), creditor: P(b.members[1]), owes: { rations: 10 }, due: st.t + 5, every: null });
  const z = O.create(st, { kind: 'share', debtor: H(b.id), creditor: P(a.holder), owes: { rations: 8 } });
  assert.deepStrictEqual([x, y, z], [0, 1, 2], 'ids are indexes');
  const o = st.obligations[x], c = cal(o.due - 1);
  assert.deepStrictEqual({ ...o, due: 0 }, { id: 0, kind: 'share', debtor: H(a.id), creditor: P(b.holder), owes: { rations: 30 }, due: 0, every: YEAR,
    enforcer: null, status: 'open', delivered: 0, since: st.t }, 'the record');
  assert.ok(o.due > st.t && o.due - st.t <= YEAR && c.season === 2 && c.sday === ASK.day, `a share's term ends with the round's first day (${JSON.stringify(c)})`);
  assert.deepStrictEqual(st.obligationsDue, [1, 0, 2], 'the queue: by due, then id');
  assert.deepStrictEqual(O.due(st, H(a.id), 'debtor').map((q) => q.id), [0, 1]);
  assert.deepStrictEqual(O.due(st, P(b.holder)).map((q) => q.id), [0]);
  assert.strictEqual(O.owed(st, H(a.id), 'debtor'), 40);
  sound(st, 'made');
  // part, then whole: goods through sim/stores
  setGrain(a, 100); setGrain(b, 0);
  assert.strictEqual(O.fulfil(st, x, 12, { kind: 'share', pawn: b.holder }, { from: a, to: b, good: 'grain' }), null);
  assert.ok(o.status === 'part' && o.delivered === 12 && Sim.grainOf(a) === 88 && Sim.grainOf(b) === 12, 'a part delivered, the grain moved');
  assert.strictEqual(O.fulfil(st, x, 19, 'share'), 'more than is owed');
  sound(st, 'part');
  assert.strictEqual(O.fulfil(st, x, 18, 'share'), null, 'booked only: delivered another way');
  assert.ok(o.status === 'met' && Sim.grainOf(a) === 88 && !st.obligationsDue.includes(x) && !O.due(st, P(b.holder)).length, 'met: out of the queue and the lists');
  assert.strictEqual(O.fulfil(st, x, 1, 'share'), 'the obligation is closed');
  sound(st, 'met');
  // a single term ends: overdue, out of the queue, still its parties'
  const n0 = VB.count.obligationsDue;
  O.step(st);
  assert.strictEqual(VB.count.obligationsDue, n0, 'nothing due, nothing touched');
  st.t += 6;
  O.step(st);
  assert.ok(st.obligations[y].status === 'overdue' && VB.count.obligationsDue === n0 + 1 && O.due(st, H(a.id), 'debtor').length === 1, 'overdue');
  assert.deepStrictEqual(st.obligationsDue, [2]);
  sound(st, 'overdue');
  // a kind with terms goes on to its next
  const due = st.obligations[z].due;
  st.t = due;
  O.step(st);
  assert.ok(st.obligations[z].due === due + YEAR && st.obligations[z].status === 'open' && VB.count.obligationsDue === n0 + 2, 'the next term');
  sound(st, 'next term');
  // transfer to a successor, forgive, lapse: each told once
  const heir = a.members.find((id) => id !== a.holder), told = () => st.record.length;
  assert.strictEqual(O.transfer(st, z, { creditor: P(heir) }), null);
  assert.ok(O.due(st, P(heir)).length === 1 && !O.due(st, P(a.holder)).length, 'the successor is owed it');
  sound(st, 'transferred');
  let r = told();
  assert.strictEqual(O.forgive(st, z, heir), null);
  assert.ok(st.obligations[z].status === 'forgiven' && told() === r + 1 && /forgiven by/.test(st.record[r].text), 'forgiven, told once');
  r = told();
  assert.strictEqual(O.lapse(st, y, 'the one owed has died'), null);
  assert.ok(st.obligations[y].status === 'lapsed' && told() === r + 1 && /10 rations\) lapsed/.test(st.record[r].text), 'lapsed, told once');
  assert.strictEqual(O.forgive(st, y, heir), 'the obligation is closed');
  assert.deepStrictEqual([st.obligationsDue, st.obligationsBy], [[], { debtor: {}, creditor: {} }], 'nothing live is kept');
  assert.strictEqual(st.obligations.length, 3, 'the records stay');
  sound(st, 'closed');
}

{ // the shares at the moving round: by the sibling's id, from grain above the reserve, the same events
  const st = probe.state(), [a, b] = st.households.filter((h) => !h.dissolved);
  const [s1, s2] = b.members.slice().sort((x, y) => x - y), reserve = SHARES.reserveBase + a.members.length * SHARES.reservePerMember;
  O.oweShare(st, a, s2, 40);
  O.oweShare(st, a, s1, 50);
  O.oweShare(st, a, s1, 20); // a second handover of the farm: owed beside the first
  assert.strictEqual(Sim.shareOwed(st, s1), 70);
  setGrain(a, reserve + 60); setGrain(b, 0);
  const r = st.record.length;
  payOwed(st);
  assert.ok(Sim.shareOwed(st, s1) === 10 && Sim.shareOwed(st, s2) === 40, 'the lower id first, as far as the grain above the reserve goes');
  assert.ok(Sim.grainOf(a) === reserve && Sim.grainOf(b) === 60, 'to the sibling\'s household');
  assert.deepStrictEqual(st.obligations.map((o) => o.status), ['open', 'met', 'part'], 'the oldest of a sibling\'s shares first');
  assert.deepStrictEqual(st.record.slice(r).map((e) => [e.kind, e.pawn, e.text, e.n]), [['share', s1, 'Was paid 60 rations of the share owed, 10 still owed', 60]]);
  sound(st, 'paid in part');
  // the save keeps the records and the caches
  const back = Sim.load(probe.world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.deepStrictEqual([back.obligations, back.obligationsDue, back.obligationsBy], [st.obligations, st.obligationsDue, st.obligationsBy], 'saved and loaded');
  // the rest, at the next round
  setGrain(a, reserve + 100);
  payOwed(st);
  assert.ok(Sim.shareOwed(st, s1) === 0 && Sim.shareOwed(st, s2) === 0 && Sim.grainOf(b) === 110 && st.obligationsDue.length === 0, 'all met');
  // each farm owes its own and pays its own (VB-1155)
  O.oweShare(st, a, s1, 5);
  O.oweShare(st, b, s1, 7);
  assert.deepStrictEqual(O.due(st, P(s1)).map((o) => [o.debtor.id, O.left(o)]), [[a.id, 5], [b.id, 7]]);
  sound(st, 'each farm owes its own');
  { // a copy: two farms each pay their own; a farm taken over pays what it owed; an abandoned farm's shares lapse
    const t = Sim.load(probe.world(), JSON.parse(JSON.stringify(Sim.save(st)))), [ta, tb] = [t.households[a.id], t.households[b.id]];
    setGrain(ta, reserve + 5); setGrain(tb, SHARES.reserveBase + tb.members.length * SHARES.reservePerMember + 7);
    const before = Sim.grainOf(tb);
    payOwed(t);
    assert.ok(Sim.shareOwed(t, s1) === 0 && Sim.grainOf(ta) === reserve, 'each farm paid its own: ' + Sim.shareOwed(t, s1) + ' ' + (Sim.grainOf(tb) - before));
    O.oweShare(t, ta, s1, 9);
    ta.dissolved = true; // lint-allow: owner a constructed state: the debtor gone, its farm taken by another household
    const f = t.farmsteads[ta.farmstead], c = t.households.find((h) => !h.dissolved && h.id !== ta.id && h.id !== tb.id) || tb;
    f.household = c.id; // lint-allow: owner the farm taken over
    payOwed(t);
    assert.deepStrictEqual(O.due(t, P(s1)).map((o) => [o.debtor.id, O.left(o)]), [[c.id, 9]], 'a farm taken over owes what it owed');
    const e = c === tb ? t.households.find((h) => !h.dissolved && h.id !== c.id) : tb, g = t.farmsteads[e.farmstead];
    O.oweShare(t, e, s1, 3);
    e.dissolved = true; g.household = null; g.state = 'derelict'; // lint-allow: owner the farm abandoned
    payOwed(t);
    assert.deepStrictEqual(O.due(t, P(s1)).map((o) => o.debtor.id), [c.id], 'an abandoned farm\'s shares lapse');
    assert.strictEqual(t.obligations[t.obligations.length - 1].status, 'lapsed');
  }
  // what a dead sibling was owed lapses, told once
  st.pawns[s1].alive = false;
  const n = st.record.length;
  payOwed(st);
  payOwed(st);
  assert.ok(st.record.length === n + 2 && O.due(st, P(s1)).length === 0 && st.obligations.slice(-2).every((o) => o.status === 'lapsed'), 'lapsed at the round');
  sound(st, 'lapsed');
}

{ // a step: a comparison when nothing is due; the round's day ends a share's term, which goes on to the next year's
  const st = probe.state(), [a, b] = st.households.filter((h) => !h.dissolved);
  O.oweShare(st, a, b.holder, 1e6);
  const due = st.obligations[0].due, n0 = VB.count.obligationsDue;
  Sim.advance(st, 2 * DAY);
  assert.strictEqual(VB.count.obligationsDue, n0, 'two days, nothing due, nothing counted');
  st.t = due - 0.05;
  O.step(st);
  assert.strictEqual(VB.count.obligationsDue, n0);
  st.t = due;
  O.step(st);
  assert.ok(VB.count.obligationsDue === n0 + 1 && st.obligations[0].due === due + YEAR, 'the term ended: one touched');
  sound(st, 'a term on');
}
console.log('obligations ok');
