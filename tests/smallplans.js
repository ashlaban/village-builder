// Small constructions beside any other project (VB-1414; design.md section 7, Holders and plans, Kim 21 Nov 2026): a cart, a boat and a
// tar pit are begun and built beside a barn, in a booth as in a house, one of a making; each step is posted, each gets its own timber
// trips, each job ends its own plan, a plan dropped leaves the others, and the head's view names them all. On a tiny world, through the rules.
const VB = require('../src/load.js'), Projects = VB['sim/projects'], Plans = VB['sim/plans'], Bld = VB['sim/building'], X = VB['sim/expansion'];
const C = VB['sim/carts'], { KINDS } = VB['sim/kinds'], { issue } = VB['sim/commands'], { cal } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('SMALLPLANS FAIL:', m); } };
const sound = (m) => { const bad = checkState(st); check(!bad.length, `${m}: invariants: ${bad.slice(0, 3).join('; ')}`); };

const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 }), v = st.villages[0];
const f = st.farmsteads[v.farmsteads[0]], hh = st.households[f.household], shore = f.house + 2;
const mine = () => Projects.projectsOf(st, 'household', hh.id);
check(v.wood.length > 0, 'the village has a wood to fell timber in');

// a barn under way (a large project), then a cart begun by its starter beside it, and a boat beside both
const barn = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'barn', steps: Bld.barnSteps(f.house) });
barn.open = 1; // its walls, waiting for their timber
hh.cartMiss = C.CART.misses;
C.cartsYear(st);
const cart = mine().find((p) => p.what === 'cart');
check(!!cart && cart.small === true && Projects.ownOf(st, hh.id) === barn, 'a barn under way: the cart is begun beside it, small, and the barn stays the large project');
const boat = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'boat', small: true, water: 0, steps: [{ kind: 'boat', place: shore, hours: 20, wood: 0, timber: 6 }] });
check(mine().length === 3 && !Projects.mayBegin(st, hh, 'cart') && !Projects.mayBegin(st, hh, 'boat') && Projects.mayBegin(st, hh, 'tarpit'),
  'three plans at once; no second cart nor boat, a pit still possible');
hh.cartMiss = C.CART.misses;
C.cartsYear(st);
check(mine().filter((p) => p.what === 'cart').length === 1, 'the cart starter begins no second cart while one is built');
sound('barn, cart and boat');

// each plan's timber: a site of its own, under a key of its own, its trips posted
const sites = Projects.timberOf(st, f), keys = sites.map((n) => n.key);
check(sites.length === 3 && new Set(keys).size === 3 && sites.map((n) => n.site).join() === [barn, cart, boat].map((p) => p.steps[p.open]).join(),
  `every open step carrying timber is a site, each with its own key (${keys})`);
const trips = []; Bld.timberWork(st, null, null, cal(st.t), (key, site, extra) => trips.push({ key, extra }));
const tripsFor = (p) => trips.filter((t) => t.extra.timberFor === p.steps[p.open]);
check([barn, cart, boat].every((p) => tripsFor(p).length >= 1) && new Set(trips.map((t) => t.key)).size === trips.length,
  `trips for each (two at most), no key shared (${trips.map((t) => t.key)})`);

// posted: each step once its timber is in, under keys that do not meet
for (const p of [barn, cart, boat]) p.steps[p.open].wood = p.steps[p.open].timber;
const posts = []; Projects.landProject(st, hh, f, cal(st.t), (key, site, extra, kind) => posts.push({ key, site, kind }));
check(posts.map((p) => p.kind).join() === 'barnwalls,cart,boat' && new Set(posts.map((p) => p.key)).size === 3,
  `each plan's step posted, its own key (${posts.map((p) => p.key)})`);

// the head's view: the large project, and the small ones beside it
const V = Plans.headView(st, hh.id);
check(V.project && V.project.id === barn.id && V.small.map((q) => q.what).join() === 'cart,boat' && V.small[1].tile === shore,
  'headView: the barn as the project, the cart and the boat beside it');

// each job ends its own plan (planAt)
const job = (kind, site) => ({ kind, site, farm: f, owner: { type: 'household', id: hh.id } });
const carts = hh.carts.length;
KINDS.cart.done(st, job('cart', f.house), hh, cal(st.t));
check(hh.carts.length === carts + 1 && !mine().includes(cart) && barn.open === 1 && boat.open === 0, 'the cart built ends the cart\'s plan alone');
KINDS.barnwalls.done(st, job('barnwalls', f.house), hh, cal(st.t));
check(barn.open === 2 && mine().includes(boat) && boat.open === 0, 'the barn\'s walls end the barn\'s step alone');
sound('a cart built, the barn\'s walls up');

// a plan dropped leaves the others: the boat given up by its id, the barn stands; its timber lies at its shore
const r = issue(st, { actor: hh.holder, verb: 'dropProject', target: hh.id, args: { id: boat.id }, source: 'pawn' });
check(r === true && !mine().includes(boat) && Projects.ownOf(st, hh.id) === barn && barn.open === 2, `the boat dropped by its id, the barn stands (${r})`);
check(issue(st, { actor: hh.holder, verb: 'dropProject', target: hh.id, args: { id: boat.id }, source: 'pawn' }) !== true, 'a plan gone is not dropped twice');
const again = VB['sim/projectplans'].makeProject(st, 'household', hh.id, { what: 'tarpit', small: true, steps: [{ kind: 'tarpit', place: shore, hours: 10, wood: 0 }] });
check(issue(st, { actor: hh.holder, verb: 'dropProject', target: hh.id, args: {}, source: 'pawn' }) === true && !mine().includes(barn) && mine().includes(again),
  'with no id the large project is given up, the pit beside it stands');
sound('plans dropped');

// in a booth: a settler household's cottage under way, a cart begun beside it
const g = st.farmsteads[v.farmsteads[1]], gh = st.households[g.household];
g.booth = true;
const home = VB['sim/projectplans'].makeProject(st, 'household', gh.id, X.cottagePlan(g));
gh.cartMiss = C.CART.misses;
C.cartsYear(st);
const gcart = Projects.projectsOf(st, 'household', gh.id).find((p) => p.what === 'cart');
check(!!gcart && Projects.projectsOf(st, 'household', gh.id).includes(home) && Projects.ownOf(st, gh.id) === null,
  'in a booth with its cottage under way: a cart begun beside it, and neither is a large project');
sound('a cart in a booth');

// the head holding off projects: the cart is not begun either (VB-678's gap closed)
VB['sim/projectplans'].dropAll(st, 'household', gh.id);
const hp = st.plans.households.get(gh.id);
hp.chosen = { ...(hp.chosen || {}), project: 'none' };
gh.cartMiss = C.CART.misses;
C.cartsYear(st);
check(!Projects.projectsOf(st, 'household', gh.id).some((p) => p.what === 'cart'), 'a head holding off projects begins no cart');

// the invariants say the limit: a second plan of a making, a small mark on a large plan, a cart not marked small
const two = { ...again, id: again.id };
mine().push(two);
check(checkState(st).some((e) => /two tarpit plans/.test(e)), 'a second pit is caught');
mine().pop();
again.small = false;
check(checkState(st).some((e) => /not marked small/.test(e)), 'a pit not marked small is caught');
again.small = true;

if (failed) { console.error(`smallplans: ${failed} failed`); process.exit(1); }
console.log('smallplans ok');
