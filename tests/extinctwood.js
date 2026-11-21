// VB-779: a household that dies out holding timber at a building step drops its plans while it still stands; the timber lies on the
// derelict farm's woodpile (Stores.close keeps the wood), booked, and nothing throws. On a tiny village.
const VB = require('../src/load.js'), Projects = VB['sim/projects'], { extinct } = VB['sim/heirs'], Carts = VB['sim/carts'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('EXTINCTWOOD FAIL:', m); } };
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 });
const hh = st.households[1], f = st.farmsteads[hh.farmstead];
for (let k = 0; k < Carts.CART.misses; k++) Carts.missed(st, hh);
Carts.cartsYear(st);
const plan = Projects.ownOf(st, hh.id), step = plan && plan.steps[plan.open];
check(plan && step && step.place === f.house, 'a cart is planned at the house');
step.wood = 7;
const before = hh.wood;
let err = null;
try { extinct(st, hh, 'a test'); } catch (e) { err = e; }
check(!err, `extinct throws: ${err && err.message}`);
check(hh.dissolved && !Projects.ownOf(st, hh.id), 'dissolved, its plan gone');
check(Math.abs(hh.wood - before - 7) < 1e-9, `the timber lies on the derelict farm's woodpile: ${before} to ${hh.wood}`);
const bad = checkState(st).filter((m) => !/role cache/.test(m)); // roles are refreshed at the next round
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
if (failed) process.exit(1);
console.log('extinctwood ok: a dying-out household leaves its step timber on the woodpile');
