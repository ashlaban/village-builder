// VB-460: the good-year gift: a holder above the feast's threshold gives unasked to a tie that is short, kin first, a load carried by one of
// its own; nothing under a sack; the grain is on the carrier's back and in neither store.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js');
const { goodYearGift, giveUnasked } = VB['sim/help'], { dailyNeed, seedReserve } = VB['sim/hunger'];
const { YEAR_DAYS, YEAR, TRAVEL } = VB['sim/rules'], { GIFT } = VB['sim/help'];
const fresh = () => {
  const st = Sim.seed(island(7), 7, 'founders');
  for (const hh of st.households) VB['sim/projectplans'].dropAll(st, 'household', hh.id);
  for (const hh of st.households) { hh.grain = { barley: seedReserve(st, hh) + 1e4 }; hh.meals = 0; }
  return st;
};
const set = (st, hh, x) => { hh.grain = { barley: seedReserve(st, hh) + x }; };
{ // nobody short: nobody given
  const st = fresh(), [a] = st.households;
  assert.strictEqual(goodYearGift(st, a), 'no one is short');
}
{ // one with no reserve gives a load; kin before a stronger tie that is not kin; the grain is on the carrier's back
  const st = fresh(), [a, b, c] = st.households;
  for (const hh of [b, c]) set(st, hh, 0);
  st.pawns[a.members[0]].father = b.members[0];
  const ties = st.pawns[a.holder].ties; ties.clear(); ties.set(c.holder, 0.9); ties.set(b.holder, 0.1);
  st.pawns[a.holder].tieT = st.t;
  const g = goodYearGift(st, a);
  assert.strictEqual(typeof g, 'object', 'a gift: ' + g);
  assert.strictEqual(g.to, b, 'kin before the stronger tie');
  assert(g.n >= GIFT.least && g.n <= TRAVEL.load + 1e-9, 'a load at most');
  const ga = Sim.grainOf(a), gb = Sim.grainOf(b);
  assert.strictEqual(giveUnasked(st, a), true);
  assert.strictEqual(a.giftedIn, Math.floor(st.t / YEAR));
  assert(Sim.grainOf(a) < ga - 1e-6 && Sim.grainOf(b) === gb, "out of the giver's store, not yet in the receiver's");
  const j = st.away.find((x) => st.pawns[x.pawn].household === a.id);
  assert(j, "one of the giver's own is on the road with it");
  for (let s = 0; s < 6 * 48 && st.away.includes(j); s++) Sim.advance(st, 0.5);
  assert(Sim.grainOf(b) > gb, 'it arrived');
}
{ // a receiver short by less than a sack is not worth the walk; one short by more is given what brings it to a year (at most a load)
  const st = fresh(), [a, b] = st.households;
  st.pawns[a.members[0]].father = b.members[0];
  const year = dailyNeed(st, b) * YEAR_DAYS;
  set(st, b, year - GIFT.least + 1);
  assert.strictEqual(goodYearGift(st, a), 'the allowance is under a sack');
  set(st, b, year - 15);
  const g = goodYearGift(st, a);
  assert(typeof g === 'object' && Math.abs(g.n - 15) < 1e-6, 'what brings it to a year');
  // the holder is under the feast's threshold: nothing
  a.grain = { barley: seedReserve(st, a) + 10 };
  assert(/threshold/.test(goodYearGift(st, a)), 'under the threshold');
}
{ // VB-1362: a gift between two households of one holder (a holder who moved, a guardian's two) arrives, and books no tie and no goodwill
  const st = fresh(), [a, b] = st.households, { receive } = VB['sim/exchange'], was = b.holder, h = a.holder;
  b.holder = h; // the scene: one pawn holds both
  const gb = Sim.grainOf(b), gw = st.pawns[h].goodwill ? st.pawns[h].goodwill.size : 0;
  receive(st, a, b, 20, 'a farm', { barley: 20 });
  assert(Math.abs(Sim.grainOf(b) - gb - 20) < 1e-9, 'the grain arrives');
  assert(!(st.pawns[h].goodwill && st.pawns[h].goodwill.has(h)) && (st.pawns[h].goodwill ? st.pawns[h].goodwill.size : 0) === gw, 'no goodwill with itself');
  assert(!st.pawns[h].ties.has(h), 'no tie with itself');
  b.holder = was;
}
console.log('gift ok');
