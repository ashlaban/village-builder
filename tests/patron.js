// @suite integration
// Patronage (VB-464): a hungry household asks the richest of its village above the feast's threshold after near kin and before the store,
// and goodwill is booked between the two holders; a client (goodwill owed above PATRON.above days of its need, the tie of sim/followers)
// owes its patron's household PATRON.days days a year, source `patron`, which leave the balance as it was, and leans its voice to his side;
// a balance decayed under the mark gives neither. On the small island of tests/lib/probe.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const { setClock, moveClock } = require('./lib/clock.js');
const { askFood } = VB['sim/help'], { dailyNeed, seedReserve } = VB['sim/hunger'];
const R = VB['sim/relations'], F = VB['sim/followers'], O = VB['sim/obligations'], { kinHouseholds } = VB['sim/exchange'];
const { FEAST } = VB['sim/feast'], { hooks } = VB['sim/society'], Culture = VB['culture'];
const st = Sim.seed(island(7), 7, 'founders');
for (const hh of st.households) VB['sim/projectplans'].dropAll(st, 'household', hh.id);
setClock(st, (2 * Sim.SEASON_DAYS + 2) * Sim.DAY + 8); // autumn: after harvest
const keep = (hh) => FEAST.above * Sim.YEAR_DAYS * dailyNeed(st, hh);
const P = (id) => st.pawns[id], village = (h) => st.farmsteads[h.farmstead].village;
const live = st.households.filter((h) => !h.dissolved && h.holder !== null && P(h.holder).alive);
// B the hungry, A a household of its village and not its kin, whose holder is no kin of B's
const B = live.find((h) => live.some((g) => g !== h && village(g) === village(h) && !kinHouseholds(st, h).includes(g.id)));
const A = live.find((g) => g !== B && village(g) === village(B) && !kinHouseholds(st, B).includes(g.id));
assert(A && B, 'two households of one village, not kin');
const a = A.holder, b = B.holder;
for (const hh of st.households) { hh.grain = { barley: seedReserve(st, hh) + keep(hh) }; hh.borrowedIn = VB['sim/help'].seasonOf(st.t); }
for (const v of st.villages) v.grain = { barley: 0 };
const n = (m) => [...(st.obligations || [])].filter((o) => o.source === 'patron' && o.debtor.id === B.id && o.creditor.id === A.id).length;
const mark = () => F.PATRON.above * dailyNeed(st, B);

// help beyond kin: B, with nothing, asks A, the one of its village above the feast's threshold; A's holder is booked its credit
B.grain = { barley: 0 };
A.grain = { barley: seedReserve(st, A) + keep(A) + 3000 };
const a0 = Sim.grainOf(A), bal0 = R.balance(st, a, b);
askFood(st, B);
assert(Sim.grainOf(A) < a0 - 1, `the patron gave (${a0} to ${Sim.grainOf(A)})`);
assert(R.balance(st, a, b) > bal0 + 1, "goodwill booked to the patron's holder");
assert(st.away.some((j) => j.why === 'fetch' && P(j.pawn).household === B.id), 'carried as help is: fetched');

// the tie: a balance over the mark makes B a client of A: 2 days owed, source patron, and the balance stands as it was
R.book(st, a, b, 1.5 * mark() - R.balance(st, a, b));
const owed = R.balance(st, a, b);
F.review(st, a);
assert.strictEqual(P(b).looksTo, a, 'the client looks to its patron');
assert.strictEqual(n(), 1, 'days owed to the patron');
const o = st.obligations.find((x) => x.source === 'patron' && x.debtor.id === B.id);
assert.strictEqual(o.kind, 'days');
assert.strictEqual(o.owes.days, F.PATRON.days, '2 days');
assert(o.due > st.t && o.due - st.t <= Sim.YEAR, 'to the next autumn');
F.review(st, a);
assert.strictEqual(n(), 1, 'once a year, however many planning days');
O.fulfil(st, o.id, F.PATRON.days, 'days worked');
F.review(st, a);
assert.strictEqual(n(), 1, 'met, not owed again the same year');
assert(Math.abs(R.balance(st, a, b) - owed) < 1e-6, 'the days leave the balance as it was');
assert.deepStrictEqual(F.clientOf(st, B), { lord: a, days: F.PATRON.days }, "the client's panel");
assert.deepStrictEqual(F.clientsOf(st, A), [B.id], "the patron's panel");
// the lean: B's holder's voice goes PATRON.lean of the way to its patron's side at the meeting
const H = hooks(st);
assert.strictEqual(H.leanOf(P(b)), P(a), 'leans to the patron');
const att = (p, x) => { p.att = new Float32Array(p.att.length).fill(x); };
att(P(b), 0); att(P(a), 1);
const { S } = Culture.support(st.cenv, [P(b)], () => 1, H.leanOf, H.lean);
assert(Math.abs(S[0] - F.PATRON.lean) < 1e-6, `a lean of ${F.PATRON.lean} of its own weight (${S[0]})`);
assert.deepStrictEqual(checkState(st).filter((m) => /looksTo|followers|clientIn|obligation/.test(m)), []);

// decayed: years on, the balance has halved under the mark; at the patron's review the tie ends, with no days and no lean
moveClock(st, 3 * Sim.YEAR);
assert(-R.balance(st, b, a) < mark(), 'the balance decayed under the mark');
F.review(st, a);
assert.strictEqual(P(b).looksTo, null, 'the tie ended');
assert(st.record.some((e) => e.kind === 'follower' && e.reason === 'faded' && e.pawn === b), 'told: faded');
assert.strictEqual(n(), 1, 'no days owed');
assert.strictEqual(H.leanOf(P(b)), null, 'no lean');
assert.strictEqual(F.clientOf(st, B), null);
assert.deepStrictEqual(checkState(st).filter((m) => /looksTo|followers|clientIn|obligation/.test(m)), []);
console.log('patron ok: helped beyond kin, a client owes 2 days and leans, the days leave the balance, decayed gives neither');
