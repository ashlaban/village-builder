// Journeys (VB-287; design.md, Between villages: A journey, Provisions and the season): a pawn whose new home lies in another village walks
// there, a leg a day from 6:00 to 18:00, sleeping where it stops, on food carried from the household it leaves; a move within a village is
// a walk to the new door, with no journey. On tiny states, with the page closed (Rules for cost, 7: the walk is the simulation's).
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), probe = require('./lib/probe.js');
const { checkState } = require('./lib/invariants.js'), { canon, sha } = require('./lib/canon.js');
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
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
// ---- the suitor's visit (VB-289): a man with no woman within a day's walk plans a visit at his village's round, sets out on his winter
// morning for the nearest village beyond it, stays a day as its guest and walks home; then he may choose a woman of that village, and of
// no other beyond a day's walk. Three villages in a row: B 12.7 hours from A, C 15.8 hours ----
{
  const Rec = VB['sim/records'], M = VB['sim/matching'], { YEAR, SEASON_DAYS, ASK } = VB['sim/rules'], { hoursBetween } = VB['sim/routes'];
  const world3 = () => tinyWorld(Array(9).fill('.'.repeat(210)), { seed: 7 });
  const three = () => {
    const s = tinyState(world3(),
      [{ at: [6, 4], farms: 1, sizes: [5] }, { at: [156, 4], farms: 1, sizes: [5] }, { at: [196, 4], farms: 1, sizes: [5] }], { seed: 7 });
    // an unmarried child of each house, made a grown man of A and a grown woman of B and of C
    const grown = (hh, sex, years) => {
      const id = hh.members.find((k) => k !== hh.holder && Rec.spouseOf(s, k) === null), p = s.pawns[id];
      p.sex = sex; p.born = s.t - (years + 0.5) * YEAR; p.age = years;
      return id;
    };
    const ids = [grown(s.households[0], 'm', 25), grown(s.households[1], 'f', 22), grown(s.households[2], 'f', 22)];
    VB['sim/wishes'].seedAsking(s);
    refreshRoles(s);
    return [s, ...ids];
  };
  const fed = (s) => { for (const p of s.pawns) { p.hunger = 0; p.hungerLog = []; } };
  const roundDay = (2 * SEASON_DAYS + ASK.day) * DAY, off = (s) => s.record.filter((e) => e && e.kind === 'visitOff');
  const [s, man, w1, w2] = three(), A = s.households[0], p = s.pawns[man], a = s.agents[man];
  const hAB = hoursBetween(s, 0, 1), hAC = hoursBetween(s, 0, 2);
  assert.ok(hAB > TRAVEL.dayWalk && hAC > hAB && hAC < Infinity, `B ${hAB} and C ${hAC} hours from A: both beyond a day's walk, B the nearer`);
  Stores.put(s, A, 'grain', 3000, 'harvest', { barley: 3000 }); // the means to marry, and the visit's food above them
  const visit = (v) => VB['sim/commands'].issue(s, { actor: man, verb: 'visit', target: v, source: 'player' });
  assert.ok(/planned from the moving round/.test(visit(1)), 'in spring no visit is planned: ' + visit(1));
  Sim.advance(s, roundDay + 11 - s.t);
  fed(s);
  assert.ok(/day's walk/.test(M.matchBar(s, man, w1).why), 'before the visit a woman of B is beyond his choosing: ' + M.matchBar(s, man, w1).why);
  assert.ok(!M.poolFor(s, 0).includes(w1), "and not in his village's pool");
  Sim.advance(s, 10); // the round's first day
  const due = roundDay + (ASK.day < SEASON_DAYS ? SEASON_DAYS - ASK.day : 0) * DAY + (A.id % 6) * DAY + WORK[0];
  assert.deepStrictEqual(s.visits.filter((e) => e.pawn === man), [{ pawn: man, village: 1, due, household: A.id }], 'at the round he plans a visit to B, the nearest: ' + JSON.stringify(s.visits));
  assert.strictEqual(off(s).length, 0, 'and nothing keeps him home');
  assert.ok(/planned a visit already/.test(visit(2)), 'one visit a year: ' + visit(2));
  assert.deepStrictEqual(checkState(s), [], 'invariants with a visit planned');
  const planned = JSON.parse(JSON.stringify(Sim.save(s)));
  Sim.advance(s, due - 1 - s.t);
  fed(s);
  const g0 = Stores.grainOf(A), days = 2 * Math.ceil(hAB / TRAVEL.dayWalk) + TRAVEL.stay;
  Sim.advance(s, 1.2);
  const j = s.away.find((x) => x.pawn === man);
  assert.ok(j && j.why === 'visit' && j.village === 1 && j.to === s.villages[1].center && !j.back, 'at 6:00 of his winter day he sets out for the green of B');
  assert.ok(!s.visits.some((e) => e.pawn === man), 'the plan is taken from the queue');
  assert.ok(Math.abs(j.food - days) < 1e-9 && days === 5, `a ration a day away, ${days} days: ${j.food}`);
  assert.ok(Math.abs(g0 - Stores.grainOf(A) - days / s.ECON.uncooked) < 1e-6, "from his household's grain");
  assert.strictEqual(a.phase, 'journey', 'he walks');
  let onRoad = null, guest = 0, t0 = s.t, home = null, hosted = null;
  for (let k = 0; k < 8 * 4 && s.away.length; k++) {
    Sim.advance(s, DAY / 4);
    assert.deepStrictEqual(checkState(s), [], 'invariants on the visit, step ' + k);
    const x = s.away.find((y) => y.pawn === man);
    if (!x) { home = s.t; break; }
    if (x.host !== undefined && hosted === null) hosted = { ...x };
    if (!x.back && onRoad === null && a.phase === 'road') onRoad = JSON.parse(JSON.stringify(Sim.save(s)));
    if (x.back && a.phase === 'road' && tileAt(s, a.x, a.y) !== undefined && Math.hypot(a.x - s.w.hx[s.villages[1].center], a.y - s.w.hy[s.villages[1].center]) < 4 * s.w.R) guest++;
  }
  assert.deepStrictEqual(p.visited, { village: 1, year: M.roundYear(s.t) }, 'on arrival the visit is his: ' + JSON.stringify(p.visited));
  const kinds = p.events.map((k) => s.record[k]).filter((e) => e.t >= due).map((e) => e.kind);
  assert.deepStrictEqual(kinds.filter((k) => ['setOut', 'visited', 'arrived'].includes(k)), ['setOut', 'visited', 'arrived'], 'setOut, visited and arrived in his record: ' + kinds);
  assert.ok(s.record.some((e) => e && e.kind === 'visited' && e.pawn === man && e.village === 1 && !e.self), 'the visit names the village');
  // VB-1151: at B he asks the house of the woman he came for, whose head says yes: he sleeps under its roof, at its door
  assert.ok(hosted && hosted.host === s.pawns[w1].household && hosted.roof === 'house' && hosted.bed === s.farmsteads[s.households[hosted.host].farmstead].house, 'his bed is the house of the woman he came for: ' + JSON.stringify(hosted));
  assert.ok(!s.away.some((x) => x.pawn === man && x.host !== undefined), 'and the bed is his no more when he is home');
  assert.ok(guest >= 4, `he stays a day at the green of B, its guest (${guest} quarter days there)`);
  assert.ok(home !== null && home - t0 > (days - 2) * DAY && home - t0 < days * DAY, `home again within ${days} days: ${(home - t0) / DAY}`);
  const pm = s.pawns[man];
  assert.ok(M.courts(s, pm, s.pawns[w1], 0, 1), 'now he may choose a woman of B');
  assert.ok(!M.courts(s, pm, s.pawns[w2], 0, 2), 'and none of C, beyond a day\'s walk and not visited');
  assert.ok(M.poolFor(s, 0).includes(w1) && !M.poolFor(s, 0).includes(w2), "his village's pool holds B's people, not C's");
  assert.ok(/visit already|this winter's visit/.test(visit(2)), 'no second visit this winter: ' + visit(2));
  // a save during the visit plays as the unbroken run
  assert.ok(onRoad, 'a save was made on the road');
  // each load gets a world of its own: they share none, as a plot's `fresh` mark reads the ground's `dev` the run before it changes it (VB-1150)
  const one = Sim.load(world3(), JSON.parse(JSON.stringify(onRoad))), two = Sim.load(world3(), JSON.parse(JSON.stringify(Sim.save(Sim.load(world3(), JSON.parse(JSON.stringify(onRoad)))))));
  assert.ok(one.away.some((x) => x.why === 'visit' && !x.back), 'the save holds the visit');
  for (const x of [one, two]) Sim.advance(x, 6 * DAY);
  for (const k of ['away', 'pawns', 'households', 'visits', 'agents']) assert.strictEqual(canon(one[k]), canon(two[k]), `continued ${k}`);
  assert.strictEqual(canon(one.agents[man]), canon(two.agents[man]), 'continued: the visitor');
  assert.deepStrictEqual(one.pawns[man].visited, p.visited, 'the loaded run makes the same visit');
  assert.ok(!one.away.some((x) => x.pawn === man), 'and comes home');
  // VB-1151: a head who thinks ill of him will not have him: he sleeps at the green, as before
  {
    const q = Sim.load(s.w, planned), R = VB['sim/relations'], head = q.households[1].holder;
    for (const k of ['claim', 'border', 'refusedMatch', 'claim', 'border', 'refusedMatch']) R.remember(q, head, man, k);
    assert.ok(R.opinionOf(q, head, man) < 0, 'the head of B thinks ill of him: ' + R.opinionOf(q, head, man));
    let arrived = false, hostSeen = false;
    for (let k = 0; k < 8 * 4 && (!arrived || q.away.some((x) => x.pawn === man)); k++) {
      Sim.advance(q, DAY / 4);
      if (!planned || q.t < due) continue;
      const x = q.away.find((y) => y.pawn === man);
      if (x && x.guest) { arrived = true; if (x.host !== undefined || x.roof !== 'none' || x.bed !== null) hostSeen = true; }
      assert.deepStrictEqual(checkState(q), [], 'invariants on the refused visit, step ' + k);
    }
    assert.ok(arrived && !hostSeen, 'refused, he sleeps at the green: guest ' + arrived + ', hosted ' + hostSeen);
  }
  // a household that can no longer spare the food on his winter morning keeps him home, and the log says so
  {
    const q = Sim.load(s.w, planned), hh = q.households[0];
    assert.strictEqual(q.visits.filter((e) => e.pawn === man).length, 1, 'the save holds the plan');
    Stores.take(q, hh, 'grain', Stores.grainOf(hh) - 150, 'spoilage'); // fed for now, and short of its means
    Sim.advance(q, due + 1 - q.t);
    assert.ok(!q.away.some((x) => x.why === 'visit') && !q.visits.some((e) => e.pawn === man) && !q.pawns[man].visited, 'short of its means he does not set out');
    assert.ok(off(q).length === 1 && off(q)[0].pawn === man && /cannot spare the food for a visit/.test(Sim.villageLog(q, 200).map((e) => e.text || e).join('\n')), 'and the log says why');
  }
  // a household short of its means at the round plans none, and logs it once
  {
    const [q, m2] = three();
    Sim.advance(q, roundDay + 11 - q.t);
    fed(q);
    Sim.advance(q, 10);
    assert.ok(!q.visits.some((e) => e.pawn === m2) && off(q).filter((e) => e.pawn === m2).length === 1, 'short of the means, he stays home: ' + JSON.stringify(off(q)));
  }
  // ---- the player's journey (VB-292): the played pawn plans a visit by the same verb, at the same cost and season; its opportunities
  // list the villages it might visit, nearest first; a head may plan one for a son or daughter it speaks for ----
  const visitsOf = (q, id) => Sim.opportunities(q, id).filter((o) => o.verb === 'visit');
  const walked = (q, id, dueAt) => { // to its winter morning, and on until it is home again
    Sim.advance(q, dueAt - 1 - q.t); fed(q); Sim.advance(q, 1.2);
    const state = Sim.visitState(q, id);
    for (let k = 0; k < 12 * 4 && q.away.some((x) => x.pawn === id); k++) { Sim.advance(q, DAY / 4); assert.deepStrictEqual(checkState(q), [], 'invariants on the played visit, step ' + k); }
    return state;
  };
  {
    // a played man: he chooses C, the farther village, before his village's round would have sent him to B
    const [q, m2, v1, v2] = three(), hh = q.households[0];
    Stores.put(q, hh, 'grain', 3000, 'harvest', { barley: 3000 });
    assert.strictEqual(Sim.inhabit(q, m2), true);
    const spring = visitsOf(q, m2);
    assert.deepStrictEqual(spring.map((o) => o.target), [1, 2], 'his opportunities list B and C, the nearest first: ' + JSON.stringify(spring));
    assert.ok(spring.every((o) => o.when === 'winter' && o.visit.who === m2 && o.visit.name === null && /planned from the moving round/.test(o.why)), 'each barred in spring, with the reason');
    assert.ok(spring[0].visit.days === 5 && spring[0].visit.rations === 5 && spring[0].visit.place === q.villages[1].name, 'B: 5 days, 5 rations: ' + JSON.stringify(spring[0].visit));
    assert.ok(/planned from the moving round/.test(Sim.orderVisit(q, m2, 2)), 'a visit ordered in spring is refused, and says why');
    assert.ok(/does not speak for/.test(Sim.orderVisit(q, v1, 0)), 'the player orders no visit for one its pawn does not speak for');
    Sim.advance(q, roundDay + 11 - q.t);
    fed(q);
    assert.ok(visitsOf(q, m2).every((o) => o.why === null), 'from the round on he may plan either');
    assert.strictEqual(Sim.visitState(q, m2), null, 'no visit yet');
    const n0 = hash(q);
    visitsOf(q, m2); Sim.visitState(q, m2);
    assert.strictEqual(hash(q), n0, 'asking changes nothing');
    assert.strictEqual(Sim.orderVisit(q, m2, 2), true, 'the played man plans a visit to C');
    const plan = Sim.visitState(q, m2);
    assert.ok(plan.state === 'planned' && plan.village === 2 && q.visits.filter((e) => e.pawn === m2).length === 1, 'planned, as the round would store it: ' + JSON.stringify(q.visits));
    assert.ok(visitsOf(q, m2).every((o) => /planned a visit already/.test(o.why)), 'and no second');
    Sim.advance(q, 10); // his village's round: it plans no other
    assert.deepStrictEqual(q.visits.filter((e) => e.pawn === m2).map((e) => e.village), [2], 'the round leaves his plan as it is');
    const g0 = Stores.grainOf(hh), out = walked(q, m2, plan.due), days = 2 * Math.ceil(hAC / TRAVEL.dayWalk) + TRAVEL.stay;
    assert.ok(out && out.state === 'away' && out.village === 2 && out.daysLeft === days, `under way, ${days} days left by his pack: ` + JSON.stringify(out));
    assert.ok(g0 - Stores.grainOf(hh) >= days / q.ECON.uncooked - 1e-6, "at the same cost: a ration a day from his household's grain");
    assert.deepStrictEqual(q.pawns[m2].visited, { village: 2, year: M.roundYear(q.t) }, 'the visit is his');
    assert.strictEqual(Sim.visitState(q, m2), null, 'and he is home');
    assert.ok(M.poolFor(q, 0).includes(v2), "his village's pool holds C's women, not B's");
    assert.ok(M.courts(q, q.pawns[m2], q.pawns[v2], 0, 2), 'and he may choose a woman of C');
  }
  {
    // a played woman of B visits A: the round's men choose, so she is in the pool of A's men, and no other woman of her village is
    const [q, m2, v1, v2] = three(), hh = q.households[1];
    Stores.put(q, hh, 'grain', 3000, 'harvest', { barley: 3000 });
    assert.strictEqual(Sim.inhabit(q, v1), true);
    Sim.advance(q, roundDay + 11 - q.t);
    fed(q);
    const opps = visitsOf(q, v1);
    assert.ok(opps.length === 1 && opps[0].target === 0 && opps[0].why === null, 'her opportunities list A, where a man she could marry lives: ' + JSON.stringify(opps));
    assert.ok(!M.poolFor(q, 0).includes(v1), "before her visit she is not in the pool of A's men");
    assert.strictEqual(Sim.orderVisit(q, v1, 0), true, 'the played woman plans a visit to A');
    walked(q, v1, Sim.visitState(q, v1).due);
    assert.deepStrictEqual(q.pawns[v1].visited, { village: 0, year: M.roundYear(q.t) }, 'the visit is hers');
    const pool = M.poolFor(q, 0);
    assert.ok(pool.includes(v1) && pool.filter((id) => id === v1).length === 1, "after it she is in the pool of A's men, once");
    assert.ok(!pool.includes(v2), 'a woman of C is not there');
    assert.ok(M.courts(q, q.pawns[m2], q.pawns[v1], 0, 1), 'and a man of A may choose her');
    assert.strictEqual(M.matchBar(q, m2, v1).why === null || !/day's walk/.test(M.matchBar(q, m2, v1).why), true, "the day's walk no longer bars the match");
  }
  {
    // a played head plans the visit of a daughter of the house, whom it speaks for: her own act, listed under her name
    const [q, , v1] = three(), hh = q.households[1], head = hh.holder;
    Stores.put(q, hh, 'grain', 3000, 'harvest', { barley: 3000 });
    Sim.inhabit(q, head);
    Sim.advance(q, roundDay + 11 - q.t);
    fed(q);
    assert.strictEqual(Rec.spokesmanOf(q, v1), head, 'the head speaks for her');
    const hers = visitsOf(q, head).filter((o) => o.visit.who === v1);
    assert.ok(hers.length === 1 && hers[0].target === 0 && hers[0].visit.name === Rec.fullName(q.pawns[v1]) && hers[0].why === null, "the head's opportunities list her visit, by her name: " + JSON.stringify(hers));
    assert.strictEqual(Sim.orderVisit(q, v1, 0), true, 'the head plans it');
    assert.deepStrictEqual(q.visits.map((e) => [e.pawn, e.village]), [[v1, 0]], 'the plan is hers');
  }
  {
    // an unplayed head sends a daughter of the house at the round, by the verb `sendVisit`, as a man would go himself; one who speaks for no one is refused
    const [q, , v1] = three(), hh = q.households[1], head = hh.holder;
    Stores.put(q, hh, 'grain', 3000, 'harvest', { barley: 3000 });
    assert.ok(/does not speak for/.test(VB['sim/commands'].issue(q, { actor: v1, verb: 'sendVisit', target: head, args: { village: 0 }, source: 'pawn' })), 'a daughter sends no one');
    assert.ok(q.player === null || q.player === undefined || q.player.pawn !== head, 'no player');
    Sim.advance(q, roundDay + 11 - q.t);
    fed(q); Sim.advance(q, 10);
    assert.ok(q.visits.some((e) => e.pawn === v1 && e.village === 0), 'the head sent the daughter, unplayed: ' + JSON.stringify(q.visits));
  }
}
console.log(`journeys: a walk home within a village; a bride across ${Math.round(hours)} hours in ${stops + 1} legs, provisioned for ${days} days; save, death and hunger on the road; a suitor's visit, there and back; the played pawn's visit, a man's, a woman's and a daughter's by the head`);
