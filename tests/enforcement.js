// @suite fast
// A loan defaulted ends somewhere (VB-315; design.md, Loans, obligations and cases): its creditor's holder presses it, a case on the agenda
// of the debtor's village's meeting; heard and upheld, the debtor household owes a day of work for each 3 rations left (a levy of
// source `debt`), each day given booked against the loan; not upheld, the loan is extended a year and the creditor's holder remembers
// it; forgiven, its worth is booked as goodwill. On a tiny state: one village of three farms, a loan made by hand and run to default.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js'),
  { setClock } = require('./lib/clock.js');
const Obligations = VB['sim/obligations'],
  Enforcement = VB['sim/enforcement'];
const { issue } = VB['sim/commands'],
  { harvestAfter } = VB['sim/loans'],
  { membersOf } = VB['sim/records'],
  { balance } = VB['sim/relations'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));

// A state with a loan of 40 grain (50 owed) from household b to household a, defaulted
function defaulted() {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.makeFields = false;
  Sim.advance(st, 1);
  const [a, b] = st.households.filter((h) => !h.dissolved && h.holder !== null);
  const id = Obligations.create(st, {
    kind: 'loan',
    debtor: { kind: 'household', id: a.id },
    creditor: { kind: 'household', id: b.id },
    enforcer: { kind: 'village', id: st.farmsteads[a.farmstead].village },
    owes: { rations: 50 },
    lent: 40,
    due: harvestAfter(st.t),
  });
  const o = st.obligations[id];
  for (let k = 0; k < 2; k++) {
    setClock(st, o.due);
    a.grain = { barley: 0 };
    Obligations.step(st);
  }
  assert.strictEqual(o.status, 'defaulted', 'setup: the loan defaulted at its second harvest unpaid');
  return { st, a, b, o, v: st.farmsteads[a.farmstead].village };
}
const press = (st, by, o) => issue(st, { actor: by, verb: 'press', target: o.id, args: {}, source: 'planner' });
const levyOf = (st, o) => st.obligations.find((x) => x.kind === 'days' && x.debt === o.id && Obligations.isLive(x));
// hear the village's cases with CASE.base set to `base` (high: every voice upholds; low: none does)
function hearWith(st, v, base) {
  const was = Enforcement.CASE.base;
  Enforcement.CASE.base = base;
  try {
    return Enforcement.hear(st, st.cenv.settlements[v], membersOf(st, v));
  } finally {
    Enforcement.CASE.base = was;
  }
}

{ // pressed, heard, upheld: a levy of days laid, each day booked against the loan
  const { st, a, b, o, v } = defaulted();
  assert.notStrictEqual(press(st, a.holder, o), true, 'only the creditor\'s holder presses');
  assert.strictEqual(press(st, b.holder, o), true, 'the creditor\'s holder presses');
  assert.deepStrictEqual(st.cases.map((c) => c.loan), [o.id], 'a case on the agenda');
  assert.notStrictEqual(press(st, b.holder, o), true, 'one case a loan');
  assert.deepStrictEqual(checkState(st), [], 'invariants pressed');
  const lines = hearWith(st, v, 5);
  assert.strictEqual(lines.length, 1, 'one case heard');
  assert(/upheld/.test(lines[0]) && !/not upheld/.test(lines[0]), lines[0]);
  assert.deepStrictEqual(st.cases, [], 'heard and off the agenda');
  const x = levyOf(st, o);
  assert(x, 'a levy of days laid for the debt');
  assert.deepStrictEqual([x.source, x.owes.days, x.debtor, x.creditor], ['debt', Enforcement.daysFor(50), o.debtor, o.creditor]);
  assert.deepStrictEqual(checkState(st), [], 'invariants upheld');
  assert.strictEqual(Obligations.fulfil(st, x.id, 2, 'days worked'), null);
  assert.strictEqual(o.delivered, 6, 'two days worked: six rations off the loan');
  assert.deepStrictEqual(checkState(st), [], 'invariants with days worked');
  assert.strictEqual(Obligations.fulfil(st, o.id, Obligations.left(o), 'paid'), null, 'the rest paid in grain');
  assert.strictEqual(o.status, 'met');
  assert(!levyOf(st, o), 'the loan met: its days owed lapse');
  assert.deepStrictEqual(checkState(st), [], 'invariants paid');
}
{ // not upheld: extended a year, remembered
  const { st, a, b, o, v } = defaulted();
  assert.strictEqual(press(st, b.holder, o), true);
  const lines = hearWith(st, v, -5);
  assert(/not upheld/.test(lines[0]), lines[0]);
  assert.strictEqual(o.status, 'overdue', 'extended');
  assert(o.due > st.t, 'due again later');
  assert(!levyOf(st, o), 'no days laid');
  const r = st.pawns[b.holder].rel.get(a.holder);
  assert(r && r.mem.debtUnpaid, 'the creditor\'s holder remembers the debt left unpaid');
  assert.deepStrictEqual(checkState(st), [], 'invariants not upheld');
}
{ // forgiven: goodwill to the creditor's holder's credit
  const { st, a, b, o } = defaulted();
  const g0 = balance(st, b.holder, a.holder);
  assert.strictEqual(issue(st, { actor: b.holder, verb: 'forgive', target: o.id, args: {}, source: 'planner' }), true);
  assert.strictEqual(o.status, 'forgiven');
  assert(balance(st, b.holder, a.holder) > g0, 'its worth booked as goodwill');
  assert.deepStrictEqual(checkState(st), [], 'invariants forgiven');
}
{ // extended by the creditor: a year more
  const { st, b, o } = defaulted();
  assert.strictEqual(issue(st, { actor: b.holder, verb: 'extend', target: o.id, args: {}, source: 'planner' }), true);
  assert.strictEqual(o.status, 'overdue');
  assert.notStrictEqual(press(st, b.holder, o), true, 'no longer defaulted: nothing to press');
}
console.log('enforcement: ok');
