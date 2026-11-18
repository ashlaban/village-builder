// Journeys (VB-287; design.md, Between villages: A journey, Provisions and the season): a pawn whose new home lies in another village walks
// there, a leg a day from 6:00 to 18:00, sleeping where it stops, on food carried from the household it leaves; a move within a village is
// a walk to the new door, with no journey. On tiny states, with the page closed (Rules for cost, 7: the walk is the simulation's).
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), probe = require('./lib/probe.js');
const { checkState } = require('./lib/invariants.js'), { canon } = require('./lib/canon.js');
const { moveTo: move, refreshRoles } = VB['sim/heirs'], moveTo = (st, id, hh) => { move(st, id, hh); refreshRoles(st); }, { killPawn } = VB['sim/lifecycle'], { feedHousehold } = VB['sim/hunger'];
const { homeSpot, tileAt } = VB['sim/agents'], Stores = VB['sim/stores'];
const { DAY, WORK, TRAVEL } = VB['sim/rules'];
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY); // to the next h:00
const adultOf = (st, hh) => hh.members.find((id) => id !== hh.holder && st.pawns[id].age >= 14 && st.pawns[id].age < 60);
const villageOf = (st, hh) => st.farmsteads[hh.farmstead].village;

// ---- within a village: the pawn walks to the new door, and no journey is opened ----
{
  const st = probe.state();
  to(st, 10);
  const [h0, h1] = st.households.filter((h) => villageOf(st, h) === 0);
  const id = adultOf(st, h0), a = st.agents[id], [x0, y0] = [a.x, a.y];
  moveTo(st, id, h1.id);
  assert.strictEqual(st.away.length, 0, 'a move within a village opens no journey');
  assert.strictEqual(st.pawns[id].household, h1.id, 'the household changes at the act');
  assert.ok(a.x === x0 && a.y === y0 && a.phase === 'home' && a.path, 'the pawn is where it was, and walks home');
  Sim.advance(st, 3);
  const [x, y] = homeSpot(st, a);
  assert.ok(Math.hypot(a.x - x, a.y - y) < 1e-6 || a.phase !== 'home', 'it has reached the new door, or gone on to work');
  assert.deepStrictEqual(checkState(st), [], 'invariants after a move within a village');
}

// ---- between two villages a long day's walk apart (166 tiles of meadow, about 14 hours): a bride walks, in two legs ----
const W = 180, far = () => tinyState(tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 7 }),
  [{ at: [6, 4], farms: 1, sizes: [5] }, { at: [W - 8, 4], farms: 1, sizes: [5] }], { seed: 7 });
const st = far(), home = st.households[0], left = st.households[1];
const bride = left.members.find((id) => id !== left.holder && st.pawns[id].sex === 'f' && st.pawns[id].age >= 14);
assert.ok(bride !== undefined, 'a bride in the far village');
to(st, 15);
Stores.put(st, left, 'grain', 50, 'harvest', { barley: 50 });
const a = st.agents[bride], grain0 = Stores.grainOf(left);
moveTo(st, bride, home.id);
const j = st.away[0], hours = VB['sim/routes'].hoursBetween(st, 1, 0), days = Math.ceil(hours / TRAVEL.dayWalk);
assert.ok(hours > TRAVEL.dayWalk && Number.isFinite(hours), `the villages lie ${hours} hours apart`);
assert.ok(j && j.pawn === bride && j.to === st.farmsteads[home.farmstead].house && st.away.length === 1, 'one journey to her new home');
assert.strictEqual(a.phase, 'journey', 'at 15:00 she sets out at once');
assert.ok(Math.abs(j.food - days) < 1e-9, `provisions for ${days} days: ${j.food}`);
assert.ok(Math.abs(grain0 - Stores.grainOf(left) - days / st.ECON.uncooked) < 1e-9, 'taken from the household she leaves');
assert.ok(left.ledger.some((e) => e.kind === 'away' && e.pawn === bride), "a store movement with the reason 'away'");
assert.ok(st.pawns[bride].events.some((k) => st.record[k].kind === 'setOut'), 'setOut in her record');
const route = new Set(a.path.map((p) => p[3]).filter((t) => t >= 0));
route.add(tileAt(st, a.path[0][0], a.path[0][1]));
let stops = 0;
const save = { at: null };
for (let d = 0; d <= days + 1 && st.away.length; d++) {
  to(st, WORK[1]);
  if (!st.away.length) break;
  stops++;
  assert.strictEqual(a.phase, 'road', `at 18:00 on day ${d} she has stopped`);
  assert.ok(!a.inside && route.has(tileAt(st, a.x, a.y)), `at 18:00 on day ${d} she is on the route, outdoors`);
  const x = a.x, y = a.y;
  Sim.advance(st, 1);
  assert.ok(a.x === x && a.y === y, 'she sleeps where she stopped');
  if (save.at === null) save.at = JSON.parse(JSON.stringify(Sim.save(st)));
  // at midnight she eats from what she carries, and her new household's meal leaves her out
  to(st, 0);
  home.meals = 0;
  Stores.put(st, home, 'meals', 40, 'cooking');
  const others = home.members.filter((id) => id !== bride).reduce((s, id) => s + (st.pawns[id].age >= 14 ? 1 : 0.5), 0);
  feedHousehold(st, home);
  assert.ok(Math.abs(40 - home.meals - others) < 1e-9, `the household's meal is the others' (${40 - home.meals} of ${others})`);
  assert.strictEqual(st.pawns[bride].hungerLog[st.pawns[bride].hungerLog.length - 1], 0, 'she ate her ration from her provisions');
  to(st, WORK[0]);
  Sim.advance(st, 0.2);
  if (st.away.length) assert.strictEqual(a.phase, 'journey', 'at 6:00 her next leg starts');
}
assert.ok(stops >= 1 && stops <= days, `${stops} nights on the road, at most ${days}`);
to(st, WORK[1]);
assert.strictEqual(st.away.length, 0, 'she has arrived');
assert.ok(st.pawns[bride].events.some((k) => st.record[k].kind === 'arrived'), 'arrived in her record');
assert.deepStrictEqual(checkState(st), [], 'invariants after the journey');

// ---- a save made with a pawn on the road loads and plays as the unbroken run ----
{
  const a1 = Sim.load(st.w, JSON.parse(JSON.stringify(save.at))), b1 = Sim.load(st.w, JSON.parse(JSON.stringify(save.at)));
  const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(b1))));
  assert.strictEqual(a1.away.length, 1, 'the save holds the open journey');
  for (const s of [a1, back]) Sim.advance(s, 1.5 * DAY);
  for (const k of ['away', 'agents', 'pawns', 'households']) assert.strictEqual(canon(a1[k]), canon(back[k]), `continued ${k}`);
  assert.strictEqual(a1.away.length, 0, 'the loaded run arrives too');
}

// ---- a death on the road drops the journey; nothing to give: she walks unprovisioned, and hungry ----
{
  const s = far(), hh = s.households[0], from = s.households[1];
  const id = adultOf(s, from);
  to(s, 20);
  for (const h of [hh, from]) Stores.take(s, h, 'grain', Stores.grainOf(h), 'spoilage');
  moveTo(s, id, hh.id);
  assert.ok(s.away.length === 1 && s.away[0].food === 0 && s.agents[id].phase === 'road', 'at 20:00 she waits for 6:00, unprovisioned');
  to(s, 0);
  assert.strictEqual(s.pawns[id].hungerLog[s.pawns[id].hungerLog.length - 1], 1, 'with nothing carried, she goes hungry');
  to(s, 10);
  assert.strictEqual(s.agents[id].phase, 'journey', 'she walks from 6:00');
  killPawn(s, id, 'killed');
  assert.strictEqual(s.away.length, 0, 'the journey is dropped at her death');
  const died = s.record.find((e) => e && e.kind === 'died' && e.pawn === id);
  assert.ok(died && Number.isInteger(died.tile), 'the died event names where she fell');
  assert.deepStrictEqual(checkState(s), [], 'invariants after a death on the road');
}
// ---- the household a pawn joins gives nothing until she is there (VB-676; no teleporting) ----
{
  const s = far(), hh = s.households[0], from = s.households[1];
  const id = adultOf(s, from);
  to(s, 10);
  Stores.take(s, from, 'grain', Stores.grainOf(from), 'spoilage');
  Stores.put(s, hh, 'grain', 80, 'harvest', { barley: 80 });
  const g0 = Stores.grainOf(hh);
  moveTo(s, id, hh.id);
  assert.strictEqual(s.away[0].food, 0, 'nothing carried: the old store was empty');
  assert.strictEqual(Stores.grainOf(hh), g0, 'the store she joins gave nothing');
}
// ---- a child born to a mother on the road is born where she is, and walks on to the same home (VB-425; no teleporting) ----
{
  const s = far(), hh = s.households[0], from = s.households[1];
  const mid = from.members.find((id) => id !== from.holder && s.pawns[id].sex === 'f' && s.pawns[id].age >= 14);
  const dad = hh.members.find((id) => s.pawns[id].sex === 'm' && s.pawns[id].age >= 14);
  to(s, 10);
  moveTo(s, mid, hh.id);
  Sim.advance(s, 2);
  const m = s.agents[mid], [mx, my] = VB['sim/agents'].placeOf(s, m); // a walker's place, from its leg (VB-473)
  assert.ok(m.phase === 'journey' && Math.hypot(mx - homeSpot(s, m)[0], my - homeSpot(s, m)[1]) > 200, 'the mother is far from home');
  const p = s.pawns[mid], n = s.pawns.length;
  p.pregnantUntil = s.t; p.pregnantBy = dad;
  s.rng.births.fix = 0.99;
  VB['sim/births'].dailyBirths(s); delete s.rng.births.fix;
  assert.strictEqual(s.pawns.length, n + 1, 'a child is born');
  const c = s.agents[n];
  assert.ok(Math.hypot(c.x - mx, c.y - my) < 1e-6 && !c.inside, 'the child is at the mother\'s tile, outdoors, not at home');
  assert.ok(s.away.some((j) => j.pawn === n && j.to === s.farmsteads[hh.farmstead].house), 'it travels to the home');
  assert.deepStrictEqual(checkState(s), [], 'invariants after a birth on the road');
  for (let d = 0; d < 3 && s.away.length; d++) Sim.advance(s, DAY);
  assert.ok(!s.away.some((j) => j.pawn === n), 'the child arrives too');
  assert.ok(Math.hypot(c.x - homeSpot(s, c)[0], c.y - homeSpot(s, c)[1]) < 60, 'and is at its home village');
}

// ---- the player's command to a pawn on the road is refused with the reason (decided: refused, not held) ----
{
  const s = far(), hh = s.households[0], id = adultOf(s, s.households[1]);
  to(s, 10);
  moveTo(s, id, hh.id);
  for (const verb of ['walkTo', 'work', 'goHome', 'idle']) {
    const r = VB['sim/commands'].issue(s, { actor: id, verb, target: null, args: {}, source: 'player' });
    assert.ok(r && !r.ok && /on the road/.test(JSON.stringify(r)), `${verb} is refused: on the road`);
  }
}

// ---- a gift from kin further than a day's walk is carried (VB-291): taken at the start, booked at arrival, the carrier home ----
{
  const s = far(), rec = s.households[0], giv = s.households[1], id = adultOf(s, giv);
  to(s, 8);
  Stores.put(s, giv, 'grain', 200, 'harvest', { barley: 200 });
  const g0 = Stores.grainOf(giv), r0 = Stores.grainOf(rec);
  const r = VB['sim/commands'].issue(s, { actor: giv.holder, verb: 'give', target: rec.id, args: { good: 'grain', n: 25, carrier: id }, source: 'player' });
  assert.strictEqual(r, true, 'the gift is agreed: ' + JSON.stringify(r));
  const j = s.away.find((x) => x.pawn === id);
  assert.ok(j && j.why === 'carry' && j.gift.n === 25 && j.to === s.farmsteads[rec.farmstead].house, 'a carry journey to the receiver');
  assert.ok(g0 - Stores.grainOf(giv) >= 25 - 1e-9, 'the grain left the giver at the start');
  assert.strictEqual(Stores.grainOf(rec), r0, 'the receiver has not got it yet');
  assert.ok(Math.abs(j.food - 2 * Math.ceil(VB['sim/routes'].hoursBetween(s, 1, 0) / TRAVEL.dayWalk)) < 1e-9, 'provisions for there and back');
  assert.strictEqual(s.pawns[id].household, giv.id, 'the carrier stays his household\'s');
  let arrived = false;
  for (let d = 0; d < 8 && s.away.length; d++) {
    Sim.advance(s, DAY / 2);
    assert.deepStrictEqual(checkState(s), [], 'invariants on the carrier\'s way, step ' + d);
    if (!arrived && s.away[0] && s.away[0].back) {
      arrived = true;
      assert.ok(rec.ledger.some((e) => e.kind === 'gift' && e.from), 'the receiver books the gift when he arrives');
    }
  }
  assert.ok(arrived && !s.away.length, 'he delivered and walked home');
  assert.ok(s.pawns[id].events.some((k) => s.record[k].kind === 'arrived'), 'arrived in his record');
}
// ---- the player's gift is carried (VB-1111): the giver's store falls when the load is taken up, the receiver's rises when the carrier
// sets it down at its door, and not a step before; a back-load at most; nothing is carried within a farmstead ----
{
  const s = probe.state(), issue = VB['sim/commands'].issue;
  to(s, 8);
  const [giv, rec] = s.households.filter((h) => villageOf(s, h) === 0), id = giv.holder;
  Stores.put(s, giv, 'grain', 200, 'harvest', { barley: 200 });
  const gift = (n, carrier, target = rec.id) => ({ actor: giv.holder, verb: 'give', target, args: { good: 'grain', n, carrier }, source: 'player' });
  assert.strictEqual(Sim.giftCarriers(s, giv, rec.id)[0], id, 'the holder, the played pawn, is the first who may carry');
  assert.ok(Sim.giftCarriers(s, giv, rec.id).every((c) => s.pawns[c].household === giv.id && s.pawns[c].age >= 14 && s.pawns[c].age < 60), 'the carriers are its adults');
  assert.ok(/at most/.test(JSON.stringify(issue(s, gift(TRAVEL.load + 1, id)))), 'more than a back-load is not carried by one pawn');
  const g0 = Stores.grainOf(giv), r0 = Stores.grainOf(rec), count0 = VB.count.giftUncarried;
  assert.strictEqual(issue(s, gift(25, id)), true, 'the gift is agreed');
  const j = s.away.find((x) => x.pawn === id);
  assert.ok(j && j.why === 'carry' && j.gift.n === 25, 'the holder sets out with it');
  assert.ok(g0 - Stores.grainOf(giv) >= 25 - 1e-9, 'the giver\'s store falls as the load is taken up');
  assert.strictEqual(Stores.grainOf(rec), r0, 'and the receiver\'s has not risen');
  assert.strictEqual(Sim.giftCarriers(s, giv, rec.id).includes(id), false, 'on the road, he carries no second gift');
  const arrivedAt = () => s.pawns[id].events.some((k) => s.record[k].kind === 'arrived');
  let steps = 0;
  while (!arrivedAt() && steps < 20 * 10) {
    assert.strictEqual(Stores.grainOf(rec), r0, 'nothing reaches the receiver before the carrier does, step ' + steps);
    Sim.advance(s, 0.1);
    steps++;
    assert.deepStrictEqual(checkState(s), [], 'invariants on the way, step ' + steps);
  }
  assert.ok(arrivedAt() && steps > 0, 'he arrived, after a walk: ' + steps + ' steps');
  assert.ok(Math.abs(Stores.grainOf(rec) - r0 - 25) < 1e-9, 'the receiver\'s store rises by the load as it is set down');
  assert.strictEqual(VB.count.giftUncarried, count0, 'none moved at once');
  Sim.advance(s, DAY);
  assert.ok(!s.away.some((x) => x.pawn === id), 'and he is home again');
  // within one farmstead nothing is carried, and no one is named to carry
  const same = s.households.find((h) => h !== giv && h.farmstead === giv.farmstead && !h.dissolved);
  if (same) assert.deepStrictEqual(Sim.giftCarriers(s, giv, same.id), [], 'no carrier within a farmstead');
}
// ---- a carrier who dies on the road lays the gift down where he fell, the receiver's (VB-850) ----
{
  const s = far(), rec = s.households[0], giv = s.households[1], id = adultOf(s, giv);
  to(s, 8);
  Stores.put(s, giv, 'grain', 200, 'harvest', { barley: 200 });
  VB['sim/commands'].issue(s, { actor: giv.holder, verb: 'give', target: rec.id, args: { good: 'grain', n: 25, carrier: id }, source: 'player' });
  Sim.advance(s, 3);
  killPawn(s, id, 'killed');
  assert.strictEqual(s.away.length, 0, 'the journey ends');
  assert.ok(s.lying && s.lying.length >= 1, 'the gift lies where he fell (and his pack with it, VB-962: the giver\'s)');
  const l = s.lying.find((x) => x.owner.type === 'household' && x.owner.id === rec.id);
  assert.ok(l.kind === 'leftGrain' && Math.abs(l.n - 25) < 1e-9 && l.owner.type === 'household' && l.owner.id === rec.id, 'the receiver\'s, 25 of it');
  assert.deepStrictEqual(checkState(s), [], 'invariants after a carrier\'s death');
}
console.log(`journeys: a walk home within a village; a bride across ${Math.round(hours)} hours in ${stops + 1} legs, provisioned for ${days} days; save, death and hunger on the road`);
