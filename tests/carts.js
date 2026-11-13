// Carts (sim/carts; the distance review, Kim, 12 Nov): hand carts and ox carts as a household's items. A load is 30 rations on the back, 90
// on a hand cart and 300 on an ox cart, which needs the team free; a cart is out while its pawn is at the job it took it for; each
// trip wears it, it is mended below half and gone at nothing; the head counts the loads that found no cart and has one built at the
// winter's start, as a project at the house that waits for its timber; hay goes by the load, firewood by the loads cut and stacked,
// and dung is carted faster. On a tiny village under a forest.
const VB = require('../src/load.js'), Sim = VB.sim, C = VB['sim/carts'], Projects = VB['sim/projects'], M = VB['sim/meadows'];
const { KINDS } = VB['sim/kinds'], { TRAVEL } = VB['sim/rules'], { CART } = C;
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('CARTS FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
const hh = st.households[0], f = st.farmsteads[hh.farmstead], [p, q] = hh.members.map((id) => st.agents[id]);
const cart = (kind, cond = 1) => ({ kind, cond, built: st.t, by: null });
const busy = (a, load) => { a.job = { key: 'test', kind: 'haul', claims: [a.id] }; a.phase = 'back'; a.load = load; };
const idle = (a) => { a.job = null; a.phase = null; a.load = 0; };

// --- the numbers
check(TRAVEL.load === 30 && TRAVEL.hand === 90 && TRAVEL.cart === 300, 'loads of 30, 90 and 300 rations');
check(TRAVEL.pace.back === 0.9 && TRAVEL.pace.hand === 0.8 && TRAVEL.pace.ox === 0.6, 'a laden pawn walks at 0.9, 0.8 and 0.6');
check(Array.isArray(hh.carts) && hh.cartMiss === 0, 'a household keeps its carts and its count of misses');
check(KINDS.cart && KINDS.cart.project && KINDS.mendcart && KINDS.manure.carted && KINDS.hay.load && KINDS.wood.stack, 'the kinds');

// --- taking a cart: the best one free; the ox cart only with the team
hh.carts = [];
check(C.take(st, hh, p.id, true) === TRAVEL.load, 'no cart: the load goes on the back');
hh.carts = [cart('hand'), cart('ox')];
check(C.take(st, hh, p.id, false) === TRAVEL.hand && hh.carts[0].by === p.id, 'the team away: the hand cart');
busy(p, 90);
check(C.take(st, hh, q.id, false) === TRAVEL.load, 'the hand cart out and no team: the back');
check(C.take(st, hh, q.id, true) === TRAVEL.cart && hh.carts[1].by === q.id, 'the team free: the ox cart');
busy(q, 300);
check(C.oxOut(st, hh) && near(C.pace(st, p), 0.8) && near(C.pace(st, q), 0.6), 'the ox cart is out; each walks at its cart\'s pace');
check(C.holds(st, hh, p.id) === TRAVEL.hand && C.holds(st, hh, q.id) === TRAVEL.cart, 'what each one\'s cart holds');
// a pawn that drops its job leaves its cart free
idle(q);
check(!C.oxOut(st, hh) && C.holds(st, hh, q.id) === 0, 'a cart whose pawn has no job is free again');
// --- home: the cart wears; mended below half; gone at nothing
C.home(st, hh, p.id); idle(p);
check(near(hh.carts[0].cond, 1 - CART.wear) && hh.carts[0].by === null, 'a trip wears the cart, and it is free');
const c0 = { season: 1, sday: 3, doy: 15, day: 15, hour: 9 }, posted = [];
const post = (key) => posted.push(key);
KINDS.mendcart.available(st, hh, f, c0, post);
check(posted.length === 0, 'a sound cart is not mended');
hh.carts[0].cond = CART.mendAt - 0.1; KINDS.mendcart.available(st, hh, f, c0, post);
check(posted.length === 1 && /^mendcart:/.test(posted[0]), 'a cart below half is mended');
KINDS.mendcart.done(st, { farm: f }, hh);
check(hh.carts[0].cond === 1, 'mended, it is sound');
hh.carts[0].cond = CART.wear / 2; C.take(st, hh, p.id, false); busy(p, 90);
const before = st.record.length; C.home(st, hh, p.id); idle(p);
check(hh.carts.length === 1 && hh.carts[0].kind === 'ox' && st.record.slice(before).some((e) => e.kind === 'cartGone'), 'a cart worn out is gone, and told');

// --- the head's count: at CART.misses a cart is built, as a project that waits for its timber
hh.carts = [];
for (let k = 0; k < CART.misses - 1; k++) C.missed(st, hh);
C.cartsYear(st);
check(hh.cartMiss === 0 && !Projects.projectOf(st, 'household', hh.id), 'fewer misses than it takes: no cart, and the count starts again');
for (let k = 0; k < CART.misses; k++) C.missed(st, hh);
C.cartsYear(st);
const plan = Projects.projectOf(st, 'household', hh.id), step = plan && Projects.openStep(plan);
check(plan && plan.what === 'cart' && plan.cart === 'hand' && step.kind === 'cart' && step.place === f.house && step.timber === CART.timber.hand
  && step.hours === CART.hours.hand, `a hand cart is begun at the house: ${JSON.stringify(plan && plan.what)}`);
check(!Projects.supplied(step), 'it waits for its timber');
step.wood = step.timber;
KINDS.cart.done(st, { farm: f, site: f.house }, hh);
check(hh.carts.length === 1 && hh.carts[0].kind === 'hand' && hh.carts[0].cond === 1 && !Projects.projectOf(st, 'household', hh.id),
  'built, the cart is the household\'s and the plan is done');

// --- hay by the load: 6 units on the back, 18 on a hand cart, the meadow aftermath with its last hay
{
  const m = { stage: 'mown', held: 30 };
  check(near(M.hayLoad(m, TRAVEL.load), TRAVEL.load) && near(m.held, 24) && m.stage === 'mown', 'a back load is 6 of the meadow\'s 30');
  check(near(M.hayLoad(m, TRAVEL.hand), TRAVEL.hand) && near(m.held, 6), 'a hand cart\'s is 18');
  check(near(M.hayLoad(m, TRAVEL.cart), 30) && m.held === 0 && m.stage === 'aftermath', 'the last load takes what is left, and the meadow is aftermath');
  check(KINDS.hay.again({ meadow: { held: 3 } }) && !KINDS.hay.again({ meadow: { held: 0 } }) && KINDS.hay.reload === CART.reload, 'more loads while hay lies');
}
// --- firewood: a load for each trip's cutting stacked on the cart
{
  const v = st.villages[0], w0 = hh.wood, j = { site: v.wood[0], farm: f };
  KINDS.wood.deliver(st, j, hh, f, { load: 0 });
  check(near(hh.wood - w0, st.ECON.woodPerTrip), 'a back load of firewood');
  KINDS.wood.deliver(st, j, hh, f, { load: 3 * TRAVEL.load });
  check(near(hh.wood - w0, 4 * st.ECON.woodPerTrip), 'three loads on a cart are three trips\' wood');
}
// --- dung: carted faster with a cart
hh.carts = []; idle(p);
check(C.carting(st, hh, p.id, false) === 1, 'no cart: at the plain rate');
hh.carts = [cart('hand')]; p.job = { key: 'test', kind: 'manure', claims: [p.id] }; p.phase = 'work'; // at the work, as sim/agents asks
check(C.carting(st, hh, p.id, false) === CART.manure.hand && hh.carts[0].by === p.id, 'a hand cart: faster, and the cart is taken');
idle(p); C.leave(st, hh, p.id);
check(hh.carts[0].by === null, 'left, it is free');

// --- the state keeps its invariants, and a run with carts too
Sim.refreshRoles(st);
const bad = checkState(st); check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
hh.carts[0].cond = 2; check(checkState(st).some((e) => /cart/.test(e)), 'a cart of condition 2 is caught');
hh.carts[0].cond = 1;
{
  const s = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4, herds: true });
  for (const h of s.households) h.carts.push({ kind: 'hand', cond: 1, built: s.t, by: null });
  Sim.advance(s, 40 * Sim.DAY);
  const b2 = checkState(s); check(!b2.length, 'after 40 days: ' + b2.slice(0, 3).join('; '));
  check(s.households.some((h) => h.carts.some((c) => c.cond < 1)), 'in 40 days a cart has been out');
}
if (failed) process.exit(1);
console.log('carts ok: loads and paces, the best free cart, wear, mending and the end, the head\'s count and the cart built, hay, firewood and dung');
