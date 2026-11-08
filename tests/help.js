// Food help: a household above its buffer gives, one below does not; kin are asked before the village store; a household asks once a
// season, for food until the next harvest (VB-222); stores fill from surpluses.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { shareFood, fillStores, surplus, askDaysAt } = VB['sim/help'], { dailyNeed, seedReserve } = VB['sim/hunger'], { HELP } = VB['sim/rules'];
const it = G.generate(7); let r; while (!(r = it.next()).done);
const fresh = () => {
  const st = Sim.seed(r.value, 7, 'founders');
  for (const f of st.farmsteads) if (f.project) f.project = null;
  for (const hh of st.households) { hh.grain = seedReserve(st, hh); hh.rations = 0; }
  return st;
};
for (const p of Sim.seed(r.value, 7, 'populous').pawns) assert(p.buffer >= HELP.bufferDays[0] && p.buffer <= HELP.bufferDays[1], 'buffer drawn from 20..60 days');
{ // a household above its buffer gives to a hungry kin household; one below its buffer does not
  const st = fresh(), [a, b, c] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  st.pawns[a.members[0]].father = b.members[0]; // b holds a parent of a member of a
  const buf = (hh) => st.pawns[hh.holder].buffer * dailyNeed(st, hh);
  b.grain = seedReserve(st, b) + buf(b) + 500; c.grain = seedReserve(st, c) + buf(c) / 2; v.grain = 0;
  const bs = surplus(st, b); assert(Math.abs(bs - 500) < 1e-6, 'surplus is grain above buffer and seed reserve');
  assert.strictEqual(surplus(st, c), 0, 'below its buffer there is no surplus');
  const g0 = a.grain, c0 = c.grain, want = askDaysAt(st) * dailyNeed(st, a) - 0;
  shareFood(st);
  assert(Math.abs(a.grain - g0 - Math.min(want, bs)) < 1e-6, `kin gave ${a.grain - g0}, expected ${Math.min(want, bs)}`);
  assert(Math.abs(b.grain - (seedReserve(st, b) + buf(b) + 500 - (a.grain - g0))) < 1e-6, 'giver lost what the taker got');
  assert.strictEqual(c.grain, c0, 'a household below its buffer does not give');
  assert(a.ledger.some((e) => e.kind === 'gift' && e.n > 0) && b.ledger.some((e) => e.kind === 'gift' && e.n < 0), 'gift in both ledgers');
  assert(st.pawns[b.holder].ties.get(a.holder) >= HELP.tieGain, 'the gift raises the tie between the holders');
}
{ // kin are asked before the village store; the store covers the rest
  const st = fresh(), [a, b] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  for (const hh of st.households) hh.grain = hh === a || hh === b ? 0 : seedReserve(st, hh) + 1e4;
  st.pawns[a.members[0]].father = b.members[0];
  const need = dailyNeed(st, a), buf = st.pawns[b.holder].buffer * dailyNeed(st, b);
  b.grain = buf + 2 * need; v.grain = 1000;
  shareFood(st);
  assert(Math.abs(a.grain - askDaysAt(st) * need) < 1e-6, 'asked food until the harvest in all');
  assert(Math.abs(b.grain - buf) < 1e-6, 'kin gave all their surplus first');
  assert(Math.abs(v.grain - (1000 - (askDaysAt(st) * need - 2 * need))) < 1e-6, 'the village store covered the rest');
}
{ // the amount: until the next harvest (the start of autumn), at least a season's; in autumn a season's
  const st = fresh(), at = (doy) => { st.t = doy * Sim.DAY; return askDaysAt(st); };
  assert.deepStrictEqual([at(0), at(11), at(23), at(24), at(35), at(36), at(47)], [24, 13, 12, 12, 12, 36, 25], 'days asked by date');
}
{ // at most once a season: short again in the same season, a household waits for the next
  const st = fresh(), [a, b] = st.households, v = st.villages[st.farmsteads[a.farmstead].village];
  for (const hh of st.households) hh.grain = hh === a ? 0 : seedReserve(st, hh);
  v.grain = 1e5;
  shareFood(st); const first = a.grain; assert(first > 0, 'the store gave');
  a.grain = 0; shareFood(st); assert.strictEqual(a.grain, 0, 'no second ask in the season');
  st.t += 12 * Sim.DAY; shareFood(st); assert(a.grain > 0, 'asks again next season');
}
{ // stores fill at the moving round from surpluses only
  const st = fresh(), a = st.households[0], v = st.villages[st.farmsteads[a.farmstead].village];
  v.grain = 0; for (const hh of st.households) hh.grain = seedReserve(st, hh);
  a.grain += st.pawns[a.holder].buffer * dailyNeed(st, a) + 400;
  fillStores(st);
  assert(Math.abs(v.grain - 100) < 1e-6, `store holds ${v.grain}, expected 25% of 400`);
}
{ // a long run keeps every invariant
  const st = Sim.seed(r.value, 7, 'founders'); for (let y = 0; y < 3; y++) Sim.advance(st, 24 * 360);
  assert(st.villages.every((v) => v.grain >= 0 && Number.isFinite(v.grain)), 'village stores stay non-negative');
}
console.log('help ok');
