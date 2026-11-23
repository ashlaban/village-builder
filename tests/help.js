// Food help: a household above its buffer gives, one below does not; kin are asked before the village store; a household asks once a
// season, for food until the next harvest (VB-222), by its head's offer at its plan's review (VB-691); stores fill from surpluses. On the small island of tests/lib/probe.js (VB-856; the
// default island before).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { island } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const { setClock, moveClock } = require('./lib/clock.js');
const { askFood, fillStores, surplus, askDaysAt, seasonOf } = VB['sim/help'], { dailyNeed, seedReserve } = VB['sim/hunger'], { HELP } = VB['sim/rules'];
const fresh = () => {
  const st = Sim.seed(island(7), 7, 'founders');
  for (const hh of st.households) VB['sim/projectplans'].dropAll(st, 'household', hh.id);
  for (const hh of st.households) { hh.grain = { barley: seedReserve(st, hh) }; hh.meals = 0; }
  // the store gives through its alderman (VB-673): the holder of the village's last farm
  for (const v of st.villages) { const f = st.farmsteads[v.farmsteads[v.farmsteads.length - 1]]; if (f && f.household !== null) VB['sim/membership'].setAlderman(st, v, st.households[f.household].holder); }
  return st;
};
// VB-691: every hungry household's head asks, as at its plan's review (sim/help askFood)
const shareFood = (st) => { for (const id of st.liveHouseholds) askFood(st, st.households[id]); };
// VB-461: a gift from another farmstead or the village store is set aside at the ask and fetched; run the day's fetches to their end
const settle = (st) => { for (let s = 0; s < 6 * 48 && st.away.some((j) => j.why === 'fetch'); s++) Sim.advance(st, 0.5); assert(!st.away.some((j) => j.why === 'fetch'), 'the fetches are over'); };
const bufferOf = (st, id) => VB['sim/traits'].bufferOf(st, id); // VB-520: the floor and the holder's reserve, by its generosity
{ const st = Sim.seed(island(7), 7, 'populous'); for (const p of st.pawns) { const b = bufferOf(st, p.id); assert(b >= HELP.floorDays && b <= HELP.floorDays + 40, 'buffer 20..60 days by generosity'); } }
{ // a household above its buffer gives to a hungry kin household; one below its buffer does not
  const st = fresh(), [a, b, c] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  st.pawns[a.members[0]].father = b.members[0]; // b holds a parent of a member of a
  const buf = (hh) => bufferOf(st, hh.holder) * dailyNeed(st, hh);
  b.grain = { barley: seedReserve(st, b) + buf(b) + 500 }; c.grain = { barley: seedReserve(st, c) + buf(c) / 2 }; v.grain = { barley: 0 };
  const bs = surplus(st, b); assert(Math.abs(bs - 500) < 1e-6, 'surplus is grain above buffer and seed reserve');
  assert.strictEqual(surplus(st, c), 0, 'below its buffer there is no surplus');
  const g0 = Sim.grainOf(a), c0 = Sim.grainOf(c), want = askDaysAt(st) * dailyNeed(st, a) - 0;
  shareFood(st);
  const given = Math.min(want, bs);
  assert.strictEqual(Sim.grainOf(a), g0, 'the gift has not come in yet: it lies at the giver\'s');
  assert(Math.abs(Sim.grainOf(b) - (seedReserve(st, b) + buf(b) + 500 - given)) < 1e-6, 'set aside at once: the giver lost what the taker is given');
  assert(st.away.some((j) => j.why === 'fetch' && st.pawns[j.pawn].household === a.id), 'a member of the asking household goes for it');
  settle(st);
  const came = a.ledger.filter((e) => e.kind === 'gift' && e.n > 0 && e.from !== undefined).reduce((t, e) => t + e.n, 0); // the household eats as it comes in
  assert(Math.abs(came - given) < 1e-6, `kin gave ${came}, expected ${given}`);
  assert.strictEqual(Sim.grainOf(c), c0, 'a household below its buffer does not give');
  assert(a.ledger.some((e) => e.kind === 'gift' && e.n > 0) && b.ledger.some((e) => e.kind === 'gift' && e.n < 0), 'gift in both ledgers');
  assert(st.pawns[b.holder].ties.get(a.holder) >= HELP.tieGain, 'the gift raises the tie between the holders');
}
{ // kin are asked before the village store; the store covers the rest
  const st = fresh(), [a, b] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  for (const hh of st.households) hh.grain = { barley: hh === a || hh === b ? 0 : seedReserve(st, hh) + 1e4 };
  st.pawns[a.members[0]].father = b.members[0];
  const need = dailyNeed(st, a), buf = bufferOf(st, b.holder) * dailyNeed(st, b);
  b.grain = { barley: buf + 2 * need }; v.grain = { barley: 1000 };
  // VB-691: the head asked gives what its floor and allowance allow (its opinion and mood among the allowance's terms)
  const gives = VB['sim/exchange'].assessGift(st, { from: b, to: a, n: 0, source: 'ask' }).allowance;
  assert(gives > 0 && gives < askDaysAt(st) * need, 'setup: kin can give some, not all');
  shareFood(st); settle(st);
  const came = a.ledger.filter((e) => e.kind === 'gift' && e.n > 0 && e.from !== undefined).reduce((t, e) => t + e.n, 0);
  assert(Math.abs(came - askDaysAt(st) * need) < 1e-6, 'asked food until the harvest in all, and it came in');
  assert(Math.abs(Sim.grainOf(b) - (buf + 2 * need - gives)) < 1e-6, 'kin gave all their allowance first');
  assert(Math.abs(Sim.grainOf(v) - (1000 - (askDaysAt(st) * need - gives))) < 1e-6, 'the village store covered the rest');
}
{ // the amount: until the next harvest (the start of autumn), at least a season's; in autumn a season's
  const st = fresh(), at = (doy) => { setClock(st, doy * Sim.DAY); return askDaysAt(st); };
  assert.deepStrictEqual([at(0), at(11), at(23), at(24), at(35), at(36), at(47)], [24, 13, 12, 12, 12, 36, 25], 'days asked by date');
}
{ // at most once a season: short again in the same season, a household waits for the next
  const st = fresh(), [a, b] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  for (const hh of st.households) hh.grain = { barley: hh === a ? 0 : seedReserve(st, hh) };
  v.grain = { barley: 1e5 };
  shareFood(st); settle(st); const first = Sim.grainOf(a); assert(first > 0, 'the store gave');
  a.grain = { barley: 0 }; shareFood(st); assert.strictEqual(Sim.grainOf(a), 0, 'no second ask in the season');
  moveClock(st, 12 * Sim.DAY); shareFood(st); settle(st); assert(Sim.grainOf(a) > 0, 'asks again next season');
}
{ // an ask that brought nothing is not the season's ask (VB-391): a lone household asks again the next day, and once something came, no more
  const st = fresh(), [a] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  for (const hh of st.households) hh.grain = { barley: hh === a ? 0 : seedReserve(st, hh) }; // no kin has a surplus
  v.grain = { barley: 0 };
  const log0 = a.ledger.length;
  shareFood(st); assert.strictEqual(a.askedIn, undefined, 'nothing moved: not the season\'s ask'); assert.strictEqual(a.ledger.length, log0, 'nothing booked');
  moveClock(st, Sim.DAY); shareFood(st); assert.strictEqual(a.askedIn, undefined, 'still nothing, and asks the day after');
  v.grain = { barley: 1e5 }; moveClock(st, Sim.DAY); shareFood(st); settle(st);
  assert(Sim.grainOf(a) > 0, 'the store filled later in the season: asked again and was given'); assert.strictEqual(a.askedIn, seasonOf(st.t), 'that ask counts');
  a.grain = { barley: 0 }; moveClock(st, Sim.DAY); shareFood(st); assert.strictEqual(Sim.grainOf(a), 0, 'no second ask once one brought something');
}
{ // stores fill at the moving round from surpluses only
  const st = fresh(), a = st.households[0], v = st.villages[st.farmsteads[a.farmstead].village];
  v.grain = { barley: 0 }; for (const hh of st.households) hh.grain = { barley: seedReserve(st, hh) };
  a.grain.barley += bufferOf(st, a.holder) * dailyNeed(st, a) + 400;
  for (const hh of st.households) hh.askedIn = seasonOf(st.t); // the hungry have asked this season: none asks the filled store (VB-691)
  fillStores(st); // carried to the green a load a trip (VB-849): the store holds it when the hauls are over
  for (let s = 0; s < 6 * 48 && st.away.some((j) => j.why === 'haul'); s++) Sim.advance(st, 0.5);
  assert(!st.away.some((j) => j.why === 'haul'), 'the hauls are over');
  assert(Math.abs(Sim.grainOf(v) - 100) < 1e-6, `store holds ${Sim.grainOf(v)}, expected 25% of 400`);
}
{ // a run keeps every invariant: two years, through two moving rounds (seven and a half years of 360 days before VB-856; the long runs
  // of tests/invariants.js check every invariant at night)
  const st = Sim.seed(island(7), 7, 'founders'); for (let y = 0; y < 2; y++) Sim.advance(st, Sim.YEAR);
  assert(st.villages.every((v) => Sim.grainOf(v) >= 0 && Number.isFinite(Sim.grainOf(v))), 'village stores stay non-negative');
  assert.deepStrictEqual(checkState(st), [], 'the invariants hold');
}
console.log('help ok');
