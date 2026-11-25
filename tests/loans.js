// Grain loans (VB-312): a household help has gone round for and still short of the harvest borrows, in whole sacks, from the household
// of its village with most to spare; the grain is set aside as the borrower's and fetched, and an obligation is booked (a quarter more by
// default, as lent by the practice), not goodwill; a lender refuses enmity, and a household with no field and a loan unpaid; at the end of
// autumn the debtor repays from its grain above its floor, carried back; unpaid, overdue and due at the next harvest; then defaulted.
// On the small island of tests/lib/probe.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const { setClock } = require('./lib/clock.js'), Customs = VB['sim/customs'];
const setPractice = (st, v, c) => { for (const [k, o] of Object.entries(c)) st.cenv.settlements[v].practice[Customs.IDX[k]] = Customs.optIndex(k, o); };
const { borrow, lack, spareOf, LOAN, harvestAfter } = VB['sim/loans'], { seasonOf } = VB['sim/help'];
const { seedReserve, floorOf } = VB['sim/hunger'], Obligations = VB['sim/obligations'], Stores = VB['sim/stores'];
const { balance } = VB['sim/relations'];
const fresh = () => {
  const st = Sim.seed(island(7), 7, 'founders');
  for (const hh of st.households) VB['sim/projectplans'].dropAll(st, 'household', hh.id);
  for (const hh of st.households) { hh.grain = { barley: seedReserve(st, hh) }; hh.meals = 0; }
  for (const v of st.villages) v.grain = { barley: 0 };
  return st;
};
const settle = (st) => { for (let s = 0; s < 6 * 48 && st.away.some((j) => j.why === 'fetch' || j.why === 'haul'); s++) Sim.advance(st, 0.5); };
const loansOf = (st) => (st.obligations || []).filter((o) => o.kind === 'loan');
// two households of one village: a borrower and the others, the one with most to spare first
const pair = (st) => {
  const a = st.households.find((h) => !h.dissolved && h.holder !== null);
  const v = st.farmsteads[a.farmstead].village;
  const others = st.households.filter((h) => h !== a && !h.dissolved && h.holder !== null && st.farmsteads[h.farmstead].village === v);
  assert(others.length >= 2, 'setup: two others in the village');
  return { a, b: others[0], c: others[1], v };
};
const rich = (st, hh, n) => { hh.grain = { barley: floorOf(st, hh) + spareNeed(st, hh) + n }; };
const spareNeed = (st, hh) => VB['sim/help'].askDaysAt(st) * VB['sim/hunger'].dailyNeed(st, hh);

{ // the loan: from the one with most to spare, in whole sacks, set aside and fetched; an obligation, no goodwill
  const st = fresh(), { a, b, c, v } = pair(st);
  rich(st, b, 37); rich(st, c, 500);
  assert(Math.abs(spareOf(st, c) - 500) < 1e-6, 'a lender spares its grain above its floor and its need to the harvest');
  a.askedIn = seasonOf(st.t); // help has gone round
  const want = lack(st, a), c0 = Stores.grainOf(c);
  assert(want >= LOAN.sack && want < 500, `setup: a lacks ${want}`);
  assert.strictEqual(borrow(st, a), true, 'it asks');
  const lent = Math.floor(want / LOAN.sack) * LOAN.sack;
  assert(Math.abs(c0 - Stores.grainOf(c) - lent) < 1e-6, `the most spare first, in whole sacks: ${c0 - Stores.grainOf(c)} of ${lent}`);
  assert.strictEqual(loansOf(st).length, 1, 'one loan: what is left under a sack is not asked of b');
  const o = loansOf(st)[0];
  assert.deepStrictEqual([o.debtor, o.creditor, o.enforcer, o.lent, o.owes.rations, o.status, o.missed],
    [{ kind: 'household', id: a.id }, { kind: 'household', id: c.id }, { kind: 'village', id: v }, lent, lent * 1.25, 'open', 0], 'a quarter more, by default');
  assert.strictEqual(o.due, harvestAfter(st.t), 'due when the harvest is threshed');
  assert.strictEqual(balance(st, c.holder, a.holder), 0, 'no goodwill is booked: the debt is explicit');
  assert(st.away.some((j) => j.why === 'fetch' && st.pawns[j.pawn].household === a.id), 'one of the borrower\'s fetches it');
  settle(st);
  assert(a.ledger.some((e) => e.kind === 'loan' && e.n > 0), 'it came in with the reason loan');
  assert(st.record.some((e) => e.kind === 'loan' && e.pawn === a.holder) && st.record.some((e) => e.kind === 'loan' && e.pawn === c.holder), 'both holders\' events');
  assert.strictEqual(borrow(st, a), false, 'once a season');
  assert.deepStrictEqual(checkState(st), [], 'invariants after the loan');

  // the repayment, at the end of autumn: from its grain above its floor, carried back; part, then overdue, then defaulted
  setClock(st, o.due);
  a.grain = { barley: floorOf(st, a) + 20.6 };
  Obligations.step(st);
  assert.deepStrictEqual([o.delivered, o.status, o.missed], [20, 'overdue', 1], 'paid in part from above its floor, and overdue');
  assert(Math.abs(Stores.grainOf(a) - floorOf(st, a) - 0.6) < 1e-6, 'its floor kept');
  assert.strictEqual(o.due, harvestAfter(st.t), 'due again at the next harvest');
  assert(st.obligationsDue.includes(o.id), 'in the due-queue again');
  settle(st);
  assert(c.ledger.some((e) => e.kind === 'loan' && e.n > 0), 'carried back to the lender');
  assert.deepStrictEqual(checkState(st), [], 'invariants overdue');
  setClock(st, o.due);
  a.grain = { barley: 0 };
  Obligations.step(st);
  assert.strictEqual(o.status, 'defaulted', 'unpaid after the second harvest: defaulted');
  assert(st.record.some((e) => e.kind === 'loanDefaulted' && e.pawn === a.holder), 'the default is told');
  Sim.advance(st, 0.1); // the work due over the days jumped is taken at the next step
  assert.deepStrictEqual(checkState(st), [], 'invariants defaulted');
}
{ // met at once; as lent under the practice; refusals
  const st = fresh(), { a, b, c, v } = pair(st);
  setPractice(st, v, { loans: 'asLent' });
  rich(st, c, 500); a.askedIn = seasonOf(st.t);
  borrow(st, a); settle(st);
  const o = loansOf(st)[0];
  assert.strictEqual(o.owes.rations, o.lent, 'as lent');
  setClock(st, o.due); a.grain = { barley: floorOf(st, a) + 1000 };
  Obligations.step(st); settle(st);
  assert.strictEqual(o.status, 'met', 'repaid in full');
  assert(st.record.some((e) => e.kind === 'loanRepaid' && e.pawn === a.holder), 'the repayment is told');
}
{ // the refusals, weighed directly
  const st = fresh(), { a, c } = pair(st), { refuses } = VB['sim/loans'];
  assert.strictEqual(refuses(st, c, c.holder, a), null, 'no reason to refuse');
  const f = st.farmsteads[a.farmstead], fields = f.fields;
  f.fields = [];
  assert.strictEqual(refuses(st, c, c.holder, a), null, 'no field, but no loan unpaid');
  f.fields = [0];
  Obligations.create(st, { kind: 'loan', debtor: { kind: 'household', id: a.id }, creditor: { kind: 'household', id: c.id }, owes: { rations: 10 }, lent: 10 });
  assert.strictEqual(refuses(st, c, c.holder, a), null, 'a field, and a loan unpaid');
  f.fields = [];
  assert.strictEqual(refuses(st, c, c.holder, a), 'no field, and a loan unpaid');
  f.fields = fields;
  const { remember, opinionOf } = VB['sim/relations'];
  for (let k = 0; k < 20 && opinionOf(st, c.holder, a.holder) >= LOAN.enmity; k++) for (const m of ['hardBargain', 'refusedUs']) remember(st, c.holder, a.holder, m);
  assert(opinionOf(st, c.holder, a.holder) < LOAN.enmity, 'setup: enmity');
  assert.strictEqual(refuses(st, c, c.holder, a), 'enmity', 'enmity refuses');
}
{ // help has not gone round: no ask this season and above what makes one ask, so no loan (review VB-312, F10)
  const st = fresh(), { a, c } = pair(st), { HELP } = VB['sim/rules'], need = VB['sim/hunger'].dailyNeed(st, a);
  rich(st, c, 500);
  a.grain = { barley: Stores.reserved(st, a, 'grain') + (HELP.askBelow + 2) * need };
  assert(lack(st, a) >= LOAN.sack && a.askedIn === undefined, 'setup: short of the harvest, not asked');
  assert.strictEqual(borrow(st, a), false, 'it does not borrow'); assert.strictEqual(loansOf(st).length, 0, 'no loan');
}
{ // a gift carried to it from beyond a day is grain on its way: it lacks less (F2)
  const st = fresh(), { a } = pair(st);
  const l0 = lack(st, a);
  st.away.push({ why: 'carry', pawn: -1, gift: { to: a.id, n: 30, parts: {} } });
  assert(Math.abs(l0 - lack(st, a) - 30) < 1e-9, `the carried 30 counted: ${l0} then ${lack(st, a)}`);
  st.away.pop();
}
{ // the lender is played and answers later: what it lends then is at most what is still lacking (F1)
  const st = fresh(), { a, c } = pair(st);
  rich(st, c, 900);
  st.player = { pawn: c.holder, queue: [], auto: true };
  a.askedIn = seasonOf(st.t);
  assert.strictEqual(borrow(st, a), true, 'it asks');
  const o = st.offers.find((x) => x.basis === 'loan' && x.to === c.holder);
  assert(o && loansOf(st).length === 0, 'the played lender is asked, and its answer waits');
  a.grain.barley += lack(st, a) - 25; // meanwhile it was given most of what it lacked
  const want = lack(st, a);
  assert.strictEqual(VB['sim/commands'].issue(st, { actor: c.holder, verb: 'answer', target: o.id, args: { yes: true }, source: 'player' }), true, 'the player says yes');
  const total = loansOf(st).reduce((s, x) => s + x.lent, 0);
  assert(total > 0 && total <= want + 1e-9, `lent ${total} against a lack of ${want}`);
}
{ // the played debtor, its pawn not planning for it, is not made to repay at the harvest: overdue (F3)
  const st = fresh(), { a, c } = pair(st);
  const id = Obligations.create(st, { kind: 'loan', debtor: { kind: 'household', id: a.id }, creditor: { kind: 'household', id: c.id }, owes: { rations: 20 }, lent: 16, enforcer: { kind: 'village', id: st.farmsteads[a.farmstead].village } }), o = st.obligations[id];
  st.player = { pawn: a.holder, queue: [], auto: false };
  setClock(st, o.due); a.grain = { barley: floorOf(st, a) + 100 };
  const g0 = Stores.grainOf(a);
  Obligations.step(st);
  assert.deepStrictEqual([o.delivered, o.status, Stores.grainOf(a)], [0, 'overdue', g0], 'nothing repaid without its choice; overdue');
}
// grain left lying (a loan's or a gift's) taken up and laid down again on the road keeps its crops (sim/lying lay; seed 3 crashed on it)
{
  const st = fresh(), a = st.households.find((h) => !h.dissolved && h.holder !== null), tile = st.farmsteads[a.farmstead].house;
  const l = VB['sim/lying'].lay(st, { load: 12 }, { owner: { type: 'household', id: a.id }, site: tile, parts: { barley: 9, rye: 3 } }, 'leftGrain', tile, 0, 0);
  assert.deepStrictEqual(l.of.parts, { barley: 9, rye: 3 }, 'laid down with its crops');
}
console.log('loans ok');
