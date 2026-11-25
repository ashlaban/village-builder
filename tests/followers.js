// Followers (VB-708): a pawn looks to the lord of its weightiest bond (goodwill owed above PATRON.above days of its household's need, or
// service), keeps him while the bond holds, and its household follows; the tie breaks when the bond ends or the lord refuses it in need;
// a cycle is refused; standing gains by followers and their own at a discount; a death frees the followers; the tie survives a save.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const R = VB['sim/relations'], F = VB['sim/followers'], { emit } = VB['sim/events'];
const { dailyNeed } = VB['sim/hunger'], { killPawn } = VB['sim/lifecycle'], { standingParts } = VB['sim/society'];
const { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const w = r.value, st = Sim.seed(w, 7, 'populous');
const ok = (s, what) => { const bad = checkState(s).filter((m) => /looksTo|followers/.test(m)); assert.deepStrictEqual(bad, [], `${what}: ${bad.slice(0, 3).join('; ')}`); };
const village = (h) => st.farmsteads[h.farmstead].village;
const holders = st.households.filter((h) => !h.dissolved && h.holder !== null);
const v0 = village(holders[0]), same = holders.filter((h) => village(h) === v0);
assert(same.length >= 4, 'four holders in one village');
const [A, B, C, D] = same, a = A.holder, b = B.holder, c = C.holder, d = D.holder;
const owes = (from, to, days) => R.book(st, to, from, days * F.PATRON.above * dailyNeed(st, st.pawns[from].household !== null ? st.households[st.pawns[from].household] : A));
const P = (id) => st.pawns[id];

// a debt above the mark makes a tie: b looks to a, and the members of b's household follow him (a servant would look to its master)
owes(b, a, 1.5);
assert.deepStrictEqual(F.bondTo(st, b, a).kind, 'patron');
F.review(st, a);
assert.strictEqual(P(b).looksTo, a, 'the debtor looks to its creditor');
for (const m of B.members) if (m !== b && P(m).alive && !P(m).servant) assert.strictEqual(P(m).looksTo, a, `member ${m} follows its head`);
assert(st.record.some((e) => e.kind === 'follower' && e.reason === 'patron' && e.pawn === b && e.other === a), 'the tie begun is told');
ok(st, 'a tie begun');
// standing: a's gains by its follower, by the bond's weight
const term = F.followerTerm(st, a);
assert(Math.abs(term - F.PATRON.standing * F.bondTo(st, b, a).w) < 1e-9, `the term is the bond's weight: ${term}`);
assert(standingParts(st, P(a)).some(([l]) => l === 'Followers'), 'standing shows its followers');

// it does not change lord while the bond holds, though it owes c more
owes(b, c, 3);
F.review(st, c);
assert.strictEqual(P(b).looksTo, a, 'no change of lord while the bond holds');

// a pyramid: a looks to d; d's standing counts b at the discount; then a cycle (d owing b) is refused
owes(a, d, 1.5);
F.review(st, d);
assert.strictEqual(P(a).looksTo, d, 'a lord may himself look to another');
assert(F.followerTerm(st, d) > F.PATRON.standing * F.bondTo(st, a, d).w + 1e-9, 'a lord of lords stands higher');
assert.strictEqual(F.depthOf(st, b), 2, 'b is two deep');
owes(d, b, 2);
F.review(st, b);
assert.notStrictEqual(P(d).looksTo, b, 'a cycle is refused');
ok(st, 'a pyramid');

// a lord who refuses his follower in need fails him: the tie breaks, a breach remembered, told with why
emit(st, 'askRefused', { asker: a, by: d });
assert.strictEqual(P(a).looksTo, null, 'the tie breaks');
assert(P(a).rel.get(d) && P(a).rel.get(d).mem.failedUs, 'the follower remembers a breach');
assert(st.record.some((e) => e.kind === 'follower' && e.reason === 'failed' && e.pawn === a), 'the tie ended is told, with why');
// the debt met: b pays a back; at a's next review the tie ends, and b's household with it; b then takes c, its weightiest
R.book(st, b, a, R.balance(st, a, b) + 1);
F.review(st, a);
assert.strictEqual(P(b).looksTo, null, 'the tie to a ended');
F.review(st, c);
assert.strictEqual(P(b).looksTo, c, 'at c\'s review b looks to c, its weightiest bond');
assert(st.record.some((e) => e.kind === 'follower' && e.reason === 'met' && e.pawn === b), 'ended: the debt met');
ok(st, 'ties ended');

// a death frees the followers; a save keeps the ties and the index is rebuilt
const s2 = Sim.load(w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.strictEqual(s2.pawns[b].looksTo, c, 'the tie survives a save');
assert.deepStrictEqual([...F.index(s2).get(c)].sort(), [...F.index(st).get(c)].sort(), 'the index rebuilt');
killPawn(st, c, 'killed');
assert.strictEqual(P(b).looksTo, null, 'the lord died');
ok(st, 'after a death');

// the allowance: a lord's duty and a follower's yes weigh with the tie
owes(b, a, 1.5);
F.review(st, a);
const ctx = (giver, receiver) => ({ giver, receiver, from: st.households[P(giver).household], to: st.households[P(receiver).household] });
const Rules = VB['sim/registry'], term2 = (g, rcv) => Rules.explain(st, 'allowance', ctx(g, rcv)).parts.find((p) => p.key === 'patron');
const l = P(b).looksTo; // a, or a lord b owes more
assert(l !== null && F.bondTo(st, b, l), 'b looks to the lord of its weightiest bond');
assert(term2(l, b) && term2(l, b).factor > 0, "the lord's duty");
assert(term2(b, l) && term2(b, l).factor > 0, "the follower's yes");
// VB-708 review F2: a lord who failed his follower is not looked to again at his next review while the breach is remembered
{
  owes(b, a, 2); F.review(st, a);
  const l = P(b).looksTo;
  assert(l !== null, 'b has a lord');
  emit(st, 'askRefused', { asker: b, by: l });
  F.review(st, l);
  assert.notStrictEqual(P(b).looksTo, l, 'the lord who failed it is not taken again');
  ok(st, 'after a failure');
}
// F1: the village's store refused by its alderman, who is the asker's lord, is not the lord's own refusal
{
  const E = same.find((h) => ![a, b, c, d].includes(h.holder) && P(h.holder).alive) || same[4];
  const e = E.holder, lord = d;
  owes(e, lord, 2); F.review(st, lord);
  assert.strictEqual(P(e).looksTo, lord, 'e looks to d');
  const Stores = VB['sim/stores'];
  st.villages[v0].alderman = lord;
  const o = { basis: 'ask', from: e, to: lord, parties: { from: { household: E.id }, to: { village: v0 } }, wants: { good: 'grain', n: 40, store: v0 }, answers: [{ key: 'to', by: lord, yes: false }] };
  const store = st.villages[v0];
  store.grain = Object.assign({}, store.grain, { [Object.keys(A.grain)[0] || 'barley']: 500 }); // grain the alderman could give
  assert(Stores.grainOf(store) - Stores.reserved(st, store, 'grain') > 10, 'the store has grain to give');
  VB['sim/offers'].BASES.ask.refused(st, o, o.answers[0]);
  assert.strictEqual(P(e).looksTo, lord, 'a refusal of the village store keeps the tie');
  assert(!(P(e).rel.get(lord) && P(e).rel.get(lord).mem.failedUs), 'and is no breach');
  // F3: the debt met outside a review ends the tie at once, with why
  R.book(st, e, lord, -R.balance(st, e, lord) + 1);
  assert.strictEqual(P(e).looksTo, null, 'the debt met ends the tie at once');
  assert(st.record.some((x) => x.kind === 'follower' && x.reason === 'met' && x.pawn === e && x.t === st.t), 'told: met');
  // F4: a follower's death is told as its tie's end, and its household's members who followed it go quietly, not as faded or met
  owes(e, lord, 2); F.review(st, lord);
  const members = E.members.filter((m) => m !== e && P(m).looksTo === lord && !F.bondTo(st, m, lord));
  const n0 = st.record.length;
  killPawn(st, e, 'killed');
  const after = st.record.slice(n0).filter((x) => x.kind === 'follower');
  assert(after.some((x) => x.pawn === e && x.reason === 'gone'), "the follower's death ends its tie, told");
  for (const m of members) assert.strictEqual(P(m).looksTo, null, `member ${m} goes with its head`);
  F.review(st, lord);
  assert(!st.record.slice(n0).some((x) => x.kind === 'follower' && members.includes(x.pawn) && ['faded', 'met'].includes(x.reason)), 'no faded or met for the members');
  ok(st, 'after the revision checks');
}
console.log('followers ok: a tie by debt, followed by its household, kept, a pyramid, a cycle refused, failed, met, saved, ended at a death');
