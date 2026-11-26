// VB-1586: the fetch grows with the household. On a drawn map (tests/lib/tiny.js), a lone farm 7 steps of meadow from a brook (0.875
// hours one way): households of 1 and 6 make one trip by hand (1.95 h), of 7 one with a cart's barrel (2.49 h) or two by hand with no
// cart (3.89 h, and a miss the head counts), of 19 a cart's and one by hand (4.43 h); a cart trip wears the cart; at a well by the door
// nobody takes the cart (2 trips of 0.1 h for 12); with one of two trips made the meal is cooked and the day is dry by the part of the
// people not covered, who is one that can go for its own drink.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Water = VB['sim/water'],
  Thirst = VB['sim/thirst'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { FRESH } = VB['world/water'];
const { TICKS, DAY, YEAR, HUNGER, TRAVEL, SPEED, cal } = VB['sim/rules'];
const { KINDS } = VB['sim/kinds'];
const { CART } = VB['sim/carts'];
const { WATER } = Water;
const tripHours = (walk) => Water.dayFetch(walk, 1).hours; // one trip by hand
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('TRIPS FAIL:', m);
  }
};
const near = (x, y, e = 0.01) => Math.abs(x - y) <= e;
const meadow = (cols, rows) => Array.from({ length: rows }, () => '.'.repeat(cols));
const handCart = () => ({ kind: 'hand', cond: 1, built: 0, by: null });
// A lone farm of `n` people, its brook `steps` tiles east of the house (0: a well by the door), with the carts given.
const farm = (n, steps, carts) => {
  const lay = (ww) => tinyState(ww, [{ at: [8, 6], farms: 1, sizes: [n] }], { seed: 7 });
  const w = tinyWorld(meadow(30, 13));
  if (steps) {
    const i = lay(tinyWorld(meadow(30, 13))).farmsteads[0].house + steps;
    w.river[i] = 1;
    w.fresh[i] = FRESH.BROOK;
  }
  const st = lay(w),
    hh = st.households[0],
    f = st.farmsteads[hh.farmstead];
  w.fresh[f.house] = steps ? FRESH.NONE : FRESH.WELL; // a test's write: the well a farm that has stood far from water starts with
  hh.carts = carts; // a test's write
  // a test's write: nobody under 12, whose one bucket covers 3 (case 6), so that the trips counted are grown hands'
  for (const id of hh.members) if (st.pawns[id].born > st.t - 12.5 * YEAR) st.pawns[id].born = st.t - 12.5 * YEAR;
  return { st, hh, f };
};
// The second day of such a farm (the first counts as fetched): the loads brought, and the hours its people had the water in hand.
const fetchDay = (n, steps, carts) => {
  const { st, hh, f } = farm(n, steps, carts),
    trips = [],
    deliver = KINDS.water.deliver;
  let ticks = 0,
    pace = null;
  KINDS.water.deliver = (s, j, h, ff, a) => {
    trips.push({ cart: j.cart || null, cover: j.cover, pawn: a.id });
    return deliver(s, j, h, ff, a);
  };
  while (Math.floor(st.t / DAY) === 0) Sim.advance(st, 1 / TICKS);
  while (Math.floor(st.t / DAY) === 1) {
    Sim.advance(st, 1 / TICKS);
    for (const id of hh.members) {
      const a = st.agents[id];
      if (!a.job || a.job.kind !== 'water') continue;
      ticks++;
      if (a.job.cart && (a.job && a.path && !(a.load > 0)) && a.leg && a.leg.kind === 'walk') pace = a.leg.pace / (SPEED * st.w.HW);
    }
  }
  KINDS.water.deliver = deliver;
  return { st, hh, f, trips, hours: ticks / TICKS, pace, by: (k) => trips.filter((t) => (k === 'cart') === !!t.cart).length };
};
const W = 0.875, // 7 steps of meadow
  hand = tripHours(W), // 1.95
  cart = (2 * W) / TRAVEL.pace.hand + WATER.fill, // 2.49
  slack = 0.35; // the walk's rounding: the spots at each end, the steps of a tenth of an hour
check(near(hand, 1.947, 0.01) && near(cart, 2.4875, 0.001), `the design's table: by hand ${hand}, with a cart ${cart}`);
check(WATER.hand === 6 && WATER.child === 3 && WATER.cart === 18 && WATER.fill === 0.3, 'the thresholds as designed');
// ---- 1. households of 1 and 6: one trip by hand, a cart or none (one alone as its trip is posted and reckoned: tests/lib/tiny.js
// makes no household of one, so the others of a household of three are away) ----
{
  const { st, hh, f } = farm(3, 7, [handCart()]),
    posted = [];
  st.t = DAY + 12; // a test's clock: noon of the second day
  for (const id of hh.members) if (id !== hh.holder) st.agents[id].away = {}; // a test's write
  KINDS.water.available(st, hh, f, cal(st.t), (key) => posted.push(key));
  check(posted.length === 1, `one person alone at home: one trip posted (${posted})`);
  const j = { kind: 'water', owner: { type: 'household', id: hh.id }, site: f.water.tile, farm: f, claims: [] };
  check(KINDS.water.setOut(st, st.agents[hh.holder], j) === 0 && !j.cart && j.cover === WATER.hand, 'which it makes by hand, as six do');
  check(near(KINDS.water.trip(st, j) + KINDS.water.hours, hand, 1e-9), `in ${hand.toFixed(2)} hours`);
}
for (const n of [3, 6]) {
  const r = fetchDay(n, 7, [handCart()]);
  check(r.f.water.cls === FRESH.BROOK && near(r.f.water.walk, W), `${n}: the source is the brook, 7 steps off (${JSON.stringify(r.f.water)})`);
  check(r.trips.length === 1 && r.by('hand') === 1, `a household of ${n} makes one trip by hand (${JSON.stringify(r.trips)})`);
  check(Math.abs(r.hours - hand) <= slack, `a household of ${n} fetches in about ${hand.toFixed(2)} hours (${r.hours})`);
  check(r.hh.waterDay === 1 && r.hh.waterFor === WATER.hand && r.hh.carts[0].cond === 1, `${n}: the day's water covers ${r.hh.waterFor}; the cart stood`);
}
// ---- 2. a household of 7: one trip with the cart, out and home at its pace, and the cart wears; two by hand with none ----
{
  const r = fetchDay(7, 7, [handCart()]);
  check(r.hh.members.length === 7, `seven people (${r.hh.members.length})`);
  check(r.trips.length === 1 && r.by('cart') === 1 && r.trips[0].cover === WATER.cart, `a household of 7 makes one trip with the cart (${JSON.stringify(r.trips)})`);
  check(Math.abs(r.hours - cart) <= slack, `with the cart it fetches in about ${cart.toFixed(2)} hours (${r.hours})`);
  check(r.pace !== null && near(r.pace, TRAVEL.pace.hand, 1e-9), `it walks out at the cart's pace (${r.pace})`);
  check(near(r.hh.carts[0].cond, 1 - CART.wear, 1e-9) && r.hh.carts[0].by === null, `the trip wore the cart (${r.hh.carts[0].cond})`);
  check(r.hh.waterFor === WATER.cart && r.hh.cartMiss === 0, `the barrel covers ${r.hh.waterFor}`);
  const bad = checkState(r.st).filter((m) => /water|dry|cart/i.test(m));
  check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
  const none = fetchDay(7, 7, []);
  check(none.trips.length === 2 && none.by('hand') === 2, `with no cart a household of 7 makes two trips by hand (${JSON.stringify(none.trips)})`);
  check(Math.abs(none.hours - 2 * hand) <= 2 * slack, `by hand it fetches in about ${(2 * hand).toFixed(2)} hours (${none.hours})`);
  check(none.hh.cartMiss === 1 && none.hh.waterFor >= 7, `a load went on the back while more waited: the head counts it (${none.hh.cartMiss})`);
}
// ---- 3. a household of 19: a cart's trip and one by hand ----
{
  const r = fetchDay(19, 7, [handCart()]);
  check(r.hh.members.length === 19, `nineteen people (${r.hh.members.length})`);
  check(r.trips.length === 2 && r.by('cart') === 1 && r.by('hand') === 1, `a household of 19 makes a cart's trip and one by hand (${JSON.stringify(r.trips)})`);
  check(Math.abs(r.hours - cart - hand) <= 2 * slack, `it fetches in about ${(cart + hand).toFixed(2)} hours (${r.hours})`);
  check(r.hh.waterFor >= 19 && r.hh.dry === 0, `all 19 are covered (${r.hh.waterFor})`);
}
// ---- 4. a well by the door: the cart is not the cheaper, 12 people make two trips by hand of the drawing alone ----
{
  const r = fetchDay(12, 0, [handCart()]);
  check(r.f.water.tile === r.f.house && r.f.water.walk === 0, `the well by the door (${JSON.stringify(r.f.water)})`);
  check(r.trips.length === 2 && r.by('hand') === 2 && r.hh.carts[0].cond === 1, `12 at a well by the door: two trips by hand (${JSON.stringify(r.trips)})`);
  check(r.hours <= 2 * WATER.draw + 0.5, `in about ${2 * WATER.draw} hours (${r.hours})`);
}
// ---- 5. one of two trips made: the meal is cooked, and the day is dry by the part not covered ----
{
  const { st, hh, f } = farm(7, 7, []),
    mem = hh.members.map((id) => st.pawns[id]);
  st.t = DAY + 12; // a test's clock: noon of the second day
  const posted = [];
  KINDS.water.available(st, hh, f, cal(st.t), (key) => posted.push(key));
  check(posted.length === 2 && new Set(posted).size === 2, `seven people with no cart: two trips posted, each a job of its own (${posted})`);
  KINDS.water.deliver(st, { cover: WATER.hand }, hh, f, null);
  check(hh.waterDay === 1 && hh.waterFor === WATER.hand, `one load in: water for ${hh.waterFor}`);
  hh.wood = 50;
  hh.meals = 0;
  hh.cookDay = -1;
  check(VB['sim/chores'].cookWanted(st, hh, cal(st.t)), 'the household cooks once the first load is in');
  const health = mem.map((p) => (p.health = 50)); // a test's write
  st.t = 2 * DAY; // the day ends
  VB['sim/hunger'].feedHousehold(st, hh, 1);
  const dry = mem.filter((p) => Thirst.thirsty(st, p));
  check(near(hh.dryLog[hh.dryLog.length - 1], 1 / 7, 1e-9) && near(hh.dry, 1 / 7 / HUNGER.days, 1e-9), `the day is dry by a seventh (${hh.dryLog}, ${hh.dry})`);
  check(dry.length === 1 && Thirst.goes(st, dry[0]), `one of the seven had no drink, one that can go for its own (${dry.map((p) => p.id)})`);
  check(mem.filter((p, i) => p.health < health[i]).length === 1 && dry[0].health < 50, "and it alone lost the dry day's health");
  const bad = checkState(st).filter((m) => /water|dry/i.test(m));
  check(!bad.length, `invariants on a part-dry day: ${bad.slice(0, 3).join('; ')}`);
  hh.waterFor = 2.5; // a test's write
  check(checkState(st).some((m) => m.includes('waterFor')), 'the invariant sees a load that covers no whole number of people');
}
// ---- 5b. a cart's trip released on the way home (VB-1604: its hand dies on the road, its household dissolves): the barrel's water is
// spilt, no load lies (water has no fetch kind: the next asking of the jobs threw), and the cart stands where it was ----
{
  const { st, hh } = farm(7, 7, [handCart()]),
    A = VB['sim/agents'];
  let a = null;
  for (let k = 0; k < 2 * DAY * TICKS && !a; k++) {
    Sim.advance(st, 1 / TICKS);
    a = hh.members.map((id) => st.agents[id]).find((b) => b.job && b.job.kind === 'water' && b.job.cart && b.load > 0) || null;
  }
  check(a && a.load === TRAVEL.hand, `a hand on its way home with the barrel (${a && a.load})`);
  if (a) {
    A.release(st, a);
    A.placeAtHome(st, a);
    const lying = (st.lying || []).map((l) => l.kind);
    check(lying.join() === 'leftCart', `the water is spilt and the cart stands there (${lying})`);
    Sim.advance(st, DAY);
    const bad = checkState(st).filter((m) => /lying|cart/i.test(m));
    check(!bad.length, `invariants a day on: ${bad.slice(0, 3).join('; ')}`);
  }
}
// ---- 6. a child under 12 carries one bucket ----
{
  const { st, hh, f } = farm(4, 7, []),
    a = st.agents[hh.holder],
    p = st.pawns[hh.holder],
    j = { kind: 'water', owner: { type: 'household', id: hh.id }, site: Water.sourceOf(st, f).tile, farm: f, claims: [] };
  KINDS.water.setOut(st, a, j);
  check(j.cover === WATER.hand, `a grown hand's trip covers ${j.cover}`);
  p.born = st.t - 10 * YEAR; // a test's write: a child of 10
  KINDS.water.setOut(st, a, j);
  check(j.cover === WATER.child, `a child of 10 carries one bucket, for ${j.cover}`);
}
if (failed) process.exit(1);
console.log("trips ok: one trip by hand for 1 and 6, a cart's barrel for 7 (two by hand with none), a cart and a hand for 19; part-dry by the people uncovered");
