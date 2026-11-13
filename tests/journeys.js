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
  assert.strictEqual(st.journeys.length, 0, 'a move within a village opens no journey');
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
const j = st.journeys[0], hours = VB['sim/routes'].hoursBetween(st, 1, 0), days = Math.ceil(hours / TRAVEL.dayWalk);
assert.ok(hours > TRAVEL.dayWalk && Number.isFinite(hours), `the villages lie ${hours} hours apart`);
assert.ok(j && j.pawn === bride && j.to === st.farmsteads[home.farmstead].house && st.journeys.length === 1, 'one journey to her new home');
assert.strictEqual(a.phase, 'journey', 'at 15:00 she sets out at once');
assert.ok(Math.abs(j.food - days) < 1e-9, `provisions for ${days} days: ${j.food}`);
assert.ok(Math.abs(grain0 - Stores.grainOf(left) - days * st.ECON.rawGrain) < 1e-9, 'taken from the household she leaves');
assert.ok(left.ledger.some((e) => e.kind === 'journey' && e.pawn === bride), "a store movement with the reason 'journey'");
assert.ok(st.pawns[bride].events.some((k) => st.record[k].kind === 'setOut'), 'setOut in her record');
const route = new Set(a.path.map((p) => p[3]).filter((t) => t >= 0));
route.add(tileAt(st, a.path[0][0], a.path[0][1]));
let stops = 0;
const save = { at: null };
for (let d = 0; d <= days + 1 && st.journeys.length; d++) {
  to(st, WORK[1]);
  if (!st.journeys.length) break;
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
  if (st.journeys.length) assert.strictEqual(a.phase, 'journey', 'at 6:00 her next leg starts');
}
assert.ok(stops >= 1 && stops <= days, `${stops} nights on the road, at most ${days}`);
to(st, WORK[1]);
assert.strictEqual(st.journeys.length, 0, 'she has arrived');
assert.ok(st.pawns[bride].events.some((k) => st.record[k].kind === 'arrived'), 'arrived in her record');
assert.deepStrictEqual(checkState(st), [], 'invariants after the journey');

// ---- a save made with a pawn on the road loads and plays as the unbroken run ----
{
  const a1 = Sim.load(st.w, JSON.parse(JSON.stringify(save.at))), b1 = Sim.load(st.w, JSON.parse(JSON.stringify(save.at)));
  const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(b1))));
  assert.strictEqual(a1.journeys.length, 1, 'the save holds the open journey');
  for (const s of [a1, back]) Sim.advance(s, 1.5 * DAY);
  for (const k of ['journeys', 'agents', 'pawns', 'households']) assert.strictEqual(canon(a1[k]), canon(back[k]), `continued ${k}`);
  assert.strictEqual(a1.journeys.length, 0, 'the loaded run arrives too');
}

// ---- a death on the road drops the journey; nothing to give: she walks unprovisioned, and hungry ----
{
  const s = far(), hh = s.households[0], from = s.households[1];
  const id = adultOf(s, from);
  to(s, 20);
  for (const h of [hh, from]) Stores.take(s, h, 'grain', Stores.grainOf(h), 'spoilage');
  moveTo(s, id, hh.id);
  assert.ok(s.journeys.length === 1 && s.journeys[0].food === 0 && s.agents[id].phase === 'road', 'at 20:00 she waits for 6:00, unprovisioned');
  to(s, 0);
  assert.strictEqual(s.pawns[id].hungerLog[s.pawns[id].hungerLog.length - 1], 1, 'with nothing carried, she goes hungry');
  to(s, 10);
  assert.strictEqual(s.agents[id].phase, 'journey', 'she walks from 6:00');
  killPawn(s, id, 'killed');
  assert.strictEqual(s.journeys.length, 0, 'the journey is dropped at her death');
  const died = s.record.find((e) => e && e.kind === 'died' && e.pawn === id);
  assert.ok(died && Number.isInteger(died.tile), 'the died event names where she fell');
  assert.deepStrictEqual(checkState(s), [], 'invariants after a death on the road');
}
console.log(`journeys: a walk home within a village; a bride across ${Math.round(hours)} hours in ${stops + 1} legs, provisioned for ${days} days; save, death and hunger on the road`);
