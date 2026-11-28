// @suite integration
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
  VB['sim/lying'].frost(st); VB['sim/lying'].decay(st, 48); // the autumn frost the jump passed over rots what lies (VB-1775: a felled tree's timber lies as a pile)
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
  VB.sim.inhabit(st, c.holder); VB.sim.setAuto(st, st.player.pawn, false); // its controller answers (VB-1745; VB-1776: on automatic, its judgement at once)
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
  VB.sim.inhabit(st, a.holder); VB.sim.setAuto(st, st.player.pawn, false); // its controller (VB-1745)
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
// a seed loan before sowing (VB-1973; Kim, 28 Nov): a household short of seed for its fields to be sown asks, in the season before the
// window, as a grain loan; what is lent is kept as seed (the meal does not eat it), sown first, freed at the window's close; repaid
// at the end of autumn as a grain loan is
{
  const { borrowSeed, seedShort, windowOf } = VB['sim/loans'], H = VB['sim/hunger'], { CROPS } = VB['sim/crops'], { DAY, YEAR } = VB['sim/rules'];
  const farms = () => { // populous: its households hold fields to be sown
    const st = Sim.seed(island(7), 7, 'populous');
    for (const hh of st.households) VB['sim/projectplans'].dropAll(st, 'household', hh.id);
    for (const hh of st.households) { hh.grain = { barley: seedReserve(st, hh) }; hh.meals = 0; }
    for (const v of st.villages) v.grain = { barley: 0 };
    setClock(st, windowOf(st.t, CROPS.barley.sow).from + YEAR + DAY); // the winter before the next spring sowing
    return st;
  };
  const st = farms(), { a, c } = pair(st), w = windowOf(st.t, CROPS.barley.sow);
  rich(st, c, 500);
  c.grain.rye = c.grain.barley; const take0 = Stores.take, lentOf = {}; // the lender holds as much rye as barley: the seed lent is the crop short (VB-2045)
  a.grain = { barley: 0 }; // it ate its seed in a failed year
  const short = seedShort(st, a);
  assert(short.n >= H.seedNeed(st, a, 'barley') - 1e-9 && short.n > 0 && short.until >= w.end, `setup: short ${JSON.stringify(short)}`);
  const r0 = Stores.reserved(st, a, 'grain');
  Stores.take = (st_, h, good, n, why, ...r) => { // what the lender gave for the loan, by good
    const got = take0(st_, h, good, n, why, ...r);
    if (why && why.kind === 'loan' && h === c) lentOf[good] = (lentOf[good] || 0) + got;
    return got;
  };
  assert.strictEqual(borrowSeed(st, a), true, 'it asks a seed loan');
  Stores.take = take0;
  assert.strictEqual(borrowSeed(st, a), false, 'once a season');
  const o = loansOf(st).find((x) => x.debtor.id === a.id), lent = Math.ceil(short.n / LOAN.sack - 1e-9) * LOAN.sack;
  assert(o && o.lent === lent && o.due === harvestAfter(st.t), `lent ${o && o.lent} of ${lent}, repaid at the end of autumn as a grain loan`);
  assert.deepStrictEqual(a.seedLent, { lent, sown: 0, until: short.until }, 'kept as seed for the sowing');
  settle(st);
  assert(Stores.grainOf(a) >= lent - 1e-6, `it came in: ${Stores.grainOf(a)} of ${lent}`);
  assert(lentOf['grain/barley'] >= Math.ceil(short.n) - 1e-6 && !lentOf['grain/rye'], `the lender gave barley, the crop short: ${JSON.stringify(lentOf)}`);
  assert.deepStrictEqual(checkState(st), [], 'invariants with a seed loan held');
  // the meal does not eat it: the household goes hungry, its seed whole
  a.grain = { barley: lent }; a.meals = 0; a.flour = 0; a.larder = []; a.fresh = []; // what help brought meanwhile eaten
  assert(lent <= Stores.reserved(st, a, 'grain') + 1e-9, 'setup: all of it seed');
  const g0 = Stores.grainOf(a), d0 = a.hungryDays;
  H.feedHousehold(st, a);
  assert(Stores.grainOf(a) >= Math.min(g0, lent) - 1e-6 && a.hungryDays === d0 + 1, `the lent seed is not eaten: ${g0} to ${Stores.grainOf(a)}`);
  assert.strictEqual(VB['sim/pot'].cookable(st, a, 10), Stores.grainOf(a) > lent + 1e-9, 'nor cooked');
  // sown first; at the window's close the rest is freed
  VB['sim/events'].emit(st, 'seedSown', { hh: a, n: CROPS.barley.seed }); // a field sown (sim/fieldwork)
  assert.strictEqual(a.seedLent.sown, Math.min(lent, CROPS.barley.seed), 'sown from the loan');
  setClock(st, a.seedLent.until);
  assert.strictEqual(VB['sim/pot'].cookable(st, a, 10), true, 'its window closed, it is grain the cook may reach');
  VB['sim/events'].emit(st, 'planReviewed', { plan: st.plans.households.get(a.id), c: VB['sim/rules'].cal(st.t), why: 'day' });
  assert.strictEqual(a.seedLent, undefined, 'freed at its review');
  assert(r0 > 0, 'setup: a reserved seed');
  // a household with its seed asks nothing
  const st2 = farms(), { a: b2 } = pair(st2);
  b2.grain = { barley: Stores.reserved(st2, b2, 'grain') + 50 };
  assert.strictEqual(seedShort(st2, b2).n, 0, 'nothing short');
  assert.strictEqual(borrowSeed(st2, b2), false, 'no seed loan');
}
console.log('loans ok');
