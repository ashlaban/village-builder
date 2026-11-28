// @suite fast
// A gift is fetched (VB-461; AGENTS.md, the hard rule): help from another farmstead, or from the village store, changes owner where it
// lies and waits there until a member of the receiving household fetches it, TRAVEL.load a trip; it is the household's to eat as each load
// comes in. On the probe's small state, with the page closed.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const probe = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const Stores = VB['sim/stores'], { issue } = VB['sim/commands'], { killPawn } = VB['sim/lifecycle'];
const { DAY, TRAVEL } = VB['sim/rules'];
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const villageOf = (st, hh) => st.farmsteads[hh.farmstead].village;
const gifts = (hh) => hh.ledger.filter((e) => e.kind === 'gift' && e.n > 0 && e.from !== undefined).reduce((s, e) => s + e.n, 0);

// ---- from kin on another farmstead: set aside at once, fetched in loads of TRAVEL.load, each the household's as it comes in ----
{
  VB.resetCounts();
  const st = probe.state();
  to(st, 7);
  const [giver, rec] = st.households.filter((h) => villageOf(st, h) === 0);
  assert.notStrictEqual(giver.farmstead, rec.farmstead, 'two farmsteads');
  Stores.put(st, giver, 'grain', 400, 'harvest', { barley: 350, rye: 50 }); // grain enough that its allowance covers the gift whoever the two are (VB-1951 moved the probe's people)
  const g0 = Stores.grainOf(giver), got0 = gifts(rec), n = 2 * TRAVEL.load + 10;
  assert.strictEqual(issue(st, { actor: giver.holder, verb: 'give', target: rec.id, args: { good: 'grain', n }, source: 'help' }), true, 'the gift is agreed');
  assert.ok(Math.abs(g0 - Stores.grainOf(giver) - n) < 1e-9, 'it is the receiver\'s at once: set aside, out of the giver\'s store');
  assert.strictEqual(gifts(rec), got0, 'and has not come in yet');
  const j = st.away.find((x) => x.why === 'fetch');
  assert.ok(j && st.pawns[j.pawn].household === rec.id && j.gift.stops[0].left === n, 'a member of the receiving household goes for it');
  assert.strictEqual(j.to, st.farmsteads[giver.farmstead].house, 'to the giver\'s house, where it lies');
  assert.deepStrictEqual(checkState(st), [], 'invariants at the ask');
  // a second gift that day, from the village store, is a stop of the same journey
  const v = st.villages[0];
  Stores.put(st, v, 'grain', 20, 'harvest', { barley: 20 });
  VB['sim/membership'].setAlderman(st, v, giver.holder); // the store gives through its alderman (VB-673)
  assert.strictEqual(issue(st, { actor: giver.holder, verb: 'give', target: rec.id, args: { good: 'grain', n: 15, store: v.id }, source: 'help' }), true, 'the store gives');
  assert.strictEqual(st.away.filter((x) => x.why === 'fetch').length, 1, 'one fetcher for the day\'s gifts');
  assert.strictEqual(j.gift.stops[1].at, v.center, 'the store\'s grain lies on the green');
  const e0 = rec.ledger.length;
  for (let s = 0; s < 6 * 48 && st.away.length; s++) {
    Sim.advance(st, 0.5);
    if (st.away.length) assert.ok(j.gift === null || j.gift.held <= TRAVEL.load + 1e-9, 'he carries at most a load');
    assert.deepStrictEqual(checkState(st), [], 'invariants on the way, step ' + s);
  }
  const loads = rec.ledger.slice(e0).filter((e) => e.kind === 'gift' && e.n > 0 && e.from !== undefined);
  assert.ok(loads.every((e) => e.n <= TRAVEL.load + 1e-9), 'at most a load a trip');
  assert.strictEqual(st.away.length, 0, 'the fetch is over');
  assert.strictEqual(loads.length, 4, 'three loads from the kin and one from the store');
  assert.ok(Math.abs(gifts(rec) - got0 - n - 15) < 1e-6, 'all of it came in');
  assert.strictEqual(VB.count.giftUncarried, 0, 'none moved at once');
}

// ---- a fetcher who dies on his way out: what lies there is the giver's again ----
{
  const st = probe.state();
  to(st, 7);
  const [giver, rec] = st.households.filter((h) => villageOf(st, h) === 0);
  Stores.put(st, giver, 'grain', 300, 'harvest', { barley: 300 });
  const g0 = Stores.grainOf(giver);
  assert.strictEqual(issue(st, { actor: giver.holder, verb: 'give', target: rec.id, args: { good: 'grain', n: 20 }, source: 'help' }), true);
  const j = st.away.find((x) => x.why === 'fetch');
  killPawn(st, j.pawn);
  assert.strictEqual(st.away.length, 0, 'his journey ends');
  assert.ok(Math.abs(Stores.grainOf(giver) - g0) < 1e-9, 'the grain lies where it was, the giver\'s');
  assert.deepStrictEqual(checkState(st), [], 'invariants after a death');
}
// ---- a fetcher who dies on his way home with a load: it lies where he fell, the receiver's (VB-850) ----
{
  VB.resetCounts();
  const st = probe.state();
  to(st, 7);
  const [giver, rec] = st.households.filter((h) => villageOf(st, h) === 0);
  Stores.put(st, giver, 'grain', 400, 'harvest', { barley: 350, rye: 50 });
  const n = 3 * TRAVEL.load;
  issue(st, { actor: giver.holder, verb: 'give', target: rec.id, args: { good: 'grain', n }, source: 'help' });
  const j = st.away.find((x) => x.why === 'fetch');
  for (let s = 0; s < 6 * 48 && !(j.gift.held > 0); s++) Sim.advance(st, 0.5);
  assert.ok(j.gift.held > 0, 'he has a load on his back');
  const held = j.gift.held, g1 = Stores.grainOf(giver), pawn = j.pawn, still = j.gift.stops.reduce((a, x) => a + x.left, 0);
  assert.ok(still > 0, 'some still lies at the stop');
  killPawn(st, pawn);
  assert.ok(st.lying.length >= 1, 'a load lies where he fell (and his pack, VB-962)');
  const l = st.lying.find((x) => x.owner.type === 'household' && x.owner.id === rec.id);
  assert.ok(l.kind === 'leftGrain' && Math.abs(l.n - held) < 1e-9 && l.owner.type === 'household' && l.owner.id === rec.id, 'the receiver\'s, the size he carried');
  assert.ok(Math.abs(Object.values(l.of.parts).reduce((a, b) => a + b, 0) - held) < 1e-9, 'by crop');
  assert.ok(Math.abs(Stores.grainOf(giver) - g1 - still) < 1e-9, 'what lay at the stop is the giver\'s again');
  assert.deepStrictEqual(checkState(st), [], 'invariants after the death');
  // its owner's next hand fetches it
  const r0 = Stores.grainOf(rec);
  for (let s = 0; s < 3 * 48 && st.lying; s++) Sim.advance(st, 0.5);
  if (!st.lying) assert.ok(Stores.grainOf(rec) - r0 > held - 1e-6, 'fetched home to the receiver\'s store');
  assert.deepStrictEqual(checkState(st), [], 'invariants after the fetching');
}
console.log('fetch: a gift set aside at once and fetched a load a trip, a store\'s on the same journey; one left lying goes back');

// ---- the yearly filling is carried (VB-849): a household's quarter lies at its house and a member hauls it to the green ----
{
  VB.resetCounts();
  const st = probe.state();
  to(st, 7);
  const giver = st.households.find((h) => villageOf(st, h) === 0), v = st.villages[0];
  Stores.put(st, giver, 'grain', 400, 'harvest', { barley: 350, rye: 50 });
  const g0 = Stores.grainOf(giver), v0 = Stores.grainOf(v), n = 2 * TRAVEL.load + 10;
  assert.strictEqual(issue(st, { actor: giver.holder, verb: 'give', target: { village: 0 }, args: { good: 'grain', n }, source: 'help' }), true);
  assert.ok(g0 - Stores.grainOf(giver) > n - 1e-9, 'out of the giver\'s store (and his meals)');
  assert.strictEqual(Stores.grainOf(v), v0, 'not yet in the village\'s');
  const j = st.away.find((x) => x.why === 'haul');
  assert.ok(j && st.pawns[j.pawn].household === giver.id, 'a member of the giving household goes');
  for (let s = 0; s < 6 * 48 && st.away.length; s++) {
    Sim.advance(st, 0.5);
    assert.ok(j.gift === null || j.gift.held <= TRAVEL.load + 1e-9, 'at most a load');
    assert.deepStrictEqual(checkState(st), [], 'invariants on the way, step ' + s);
  }
  assert.strictEqual(st.away.length, 0, 'the haul is over');
  assert.ok(Stores.grainOf(v) - v0 > n - 1e-6, 'all of it came in');
  assert.strictEqual(VB.count.giftUncarried, 0, 'none moved at once');
  // no member who can go: the quarter stays at home
  for (const id of giver.members) st.agents[id].load = 1; // each carrying a load home (a test's write)
  assert.notStrictEqual(issue(st, { actor: giver.holder, verb: 'give', target: { village: 0 }, args: { good: 'grain', n: 5 }, source: 'help' }), true);
}
