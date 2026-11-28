// @suite integration
// Faith (VB-707): a debtor who refuses an ask of grain it owes the asker the worth of, and could have met above its floor, breaks faith:
// its standing falls for some years, the creditor remembers it, the record tells it, the played pawn is warned; one who cannot, or who
// owes less, breaks nothing.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const R = VB['sim/relations'], Offers = VB['sim/offers'], { standingParts } = VB['sim/society'];
const { floorOf } = VB['sim/hunger'], T = VB['sim/traits'];
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous');
const village = (h) => st.farmsteads[h.farmstead].village;
const holders = st.households.filter((h) => !h.dissolved && h.holder !== null);
const same = holders.filter((h) => village(h) === village(holders[0]));
const [A, D] = same, a = A.holder, d = D.holder, P = (id) => st.pawns[id];
const ask = (n) => ({ basis: 'ask', from: a, to: d, parties: { from: { household: A.id }, to: { household: D.id } }, wants: { good: 'grain', n }, answers: [{ key: 'to', by: d, yes: null }] });
const crop = Object.keys(D.grain)[0] || 'barley';
D.grain = Object.assign({}, D.grain, { [crop]: floorOf(st, D) + 500 }); // plenty above its floor
const term = () => (standingParts(st, P(d)).find(([l]) => l === 'Broke faith') || [0, 0])[1];
const stand = () => standingParts(st, P(d)).reduce((s, x) => s + x[1], 0);

// owes nothing: a no is no breach
const o = ask(30), before = VB.count.faithBroken;
assert.strictEqual(Offers.warning(st, o, d), null, 'no warning without a debt');
Offers.BASES.ask.refused(st, o, o.answers[0]);
assert.strictEqual(VB.count.faithBroken, before, 'no debt, no breach');

// owes less than the ask's worth
R.book(st, a, d, 10);
Offers.BASES.ask.refused(st, o, o.answers[0]);
assert.strictEqual(VB.count.faithBroken, before, 'a smaller debt, no breach');

// owes the worth and holds it above its floor: a breach
R.book(st, a, d, 40);
const s0 = stand();
assert(Offers.warning(st, o, d), 'the played pawn is told');
P(d).traits.fill(0.5); P(d).traits[T.IDX.honour] = 0.1;
assert.strictEqual(Offers.keepsFaith(st, d), false, 'a dishonourable pawn does not weigh the breach');
P(d).traits[T.IDX.honour] = 0.9;
assert.strictEqual(Offers.keepsFaith(st, d), true, 'an honourable one does');
Offers.BASES.ask.refused(st, o, o.answers[0]);
assert.strictEqual(VB.count.faithBroken, before + 1, 'a breach counted');
assert(P(a).rel.get(d).mem.brokeFaith, 'the creditor remembers');
assert(st.record.some((e) => e.kind === 'faithBroken' && e.pawn === d && e.other === a), 'the record tells it');
const s1 = stand();
assert(s1 < s0 && standingParts(st, P(d)).some(([l]) => l === 'Broke faith'), 'standing falls');
const t0 = st.t, t1 = term();
st.t += 12 * VB['sim/rules'].YEAR; // years on, it is nearly forgotten
assert(Math.abs(term()) < Math.abs(t1) / 4, `the term fades: ${term()} from ${t1}`);

// one that could not meet it is no breach
st.t = t0;
D.grain = Object.assign({}, D.grain, { [crop]: Math.max(0, floorOf(st, D) - 1) });
const n1 = VB.count.faithBroken;
Offers.BASES.ask.refused(st, ask(30), o.answers[0]);
assert.strictEqual(VB.count.faithBroken, n1, 'below its floor, an honest cannot');
console.log('faith ok');
