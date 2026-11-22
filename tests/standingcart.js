// A cart whose carrier dies on the road (VB-649) stands where he fell, with its load and the team that drew it, until a hand of its
// household has fetched it home; one nobody fetches is lost at the autumn frost, and named.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const Lying = VB['sim/lying'], Carts = VB['sim/carts'], { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous');
const hh = st.households.find((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 1 && h.members.length >= 3 && VB['sim/herds'].hasTeam(st, h));
assert(hh, 'a household with a team');
const f = st.farmsteads[hh.farmstead], fd = f.fields[0];
while (Math.floor(st.t + 1e-9) % 24 !== 8) Sim.advance(st, 0.1);
const grown = hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 14);
const a = st.agents[grown.find((id) => id !== hh.holder) ?? grown[1]];
fd.stage = 'stooks'; fd.held = 90; fd.sown = 0;
A.release(st, a); A.placeAtHome(st, a);
const j = J.post(st, 'haul:cart' + st.t, 'haul', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
j.claims.push(a.id); a.job = j; a.phase = 'back'; a.inside = false;
const cap = Carts.take(st, hh, a.id, true);
KINDS.haul.load(st, a, j, cap); a.carry = 'sheaf';
assert(Carts.oxOut(st, hh) && a.load > 30, 'a laden ox cart is out');
a.x = st.w.hx[fd.tile] + 400; a.y = st.w.hy[fd.tile]; fd.stage = 'stubble'; fd.held = 0;
const at = VB['sim/pose'].tileAt(st, a.x, a.y);
VB['sim/lifecycle'].killPawn(st, a.id, 'illness');
const cart = hh.carts.find((c) => c.kind === 'ox');
assert(cart && cart.at && cart.at.tile === at && cart.by === null, 'the cart stands where he fell');
assert(Carts.oxOut(st, hh), 'the team stands with it: not free at the farm');
assert(st.lying.some((l) => l.kind === 'leftCart') && st.lying.some((l) => l.kind === 'haul'), 'the cart and its load lie');
assert.deepStrictEqual(checkState(st), [], 'invariants hold with a cart standing');
// a hand goes for the cart: posted at its tile, and home it is free
let jc = null;
Lying.fetchWork(st, hh, f, null, (key, site, extra, k, owner) => { if (k === 'fetchLeftCart') jc = J.post(st, key, k, owner, site, extra); });
assert(jc && jc.site === at, 'the fetching is posted where the cart stands');
const l = st.lying.find((q) => q.kind === 'leftCart');
Lying.take(st, l.id, 1);
KINDS.fetchLeftCart.deliver(st, jc, hh, f, st.agents[hh.holder]);
assert(!cart.at && !Carts.oxOut(st, hh), 'home: the cart and team are free');
// not fetched: lost at the frost, named
cart.at = { tile: at, x: 0, y: 0, t: st.t }; cart.by = null;
Lying.leave(st, 'leftCart', 1, at, { type: 'household', id: hh.id }, { of: { cart: { kind: 'ox', built: cart.built } } });
const n0 = st.record.length, nc = hh.carts.length;
Lying.frost(st);
VB['sim/carts'].cartsFrost(st);
assert(hh.carts.length === nc - 1 && st.record.slice(n0).some((e) => e && e.kind === 'cartGone'), 'the cart is lost and named');
// released at its work (VB-993): a dung cart's pawn, away from the farm, leaves cart and team standing there
{
  const st2 = Sim.seed(r.value, 7, 'populous');
  const h2 = st2.households.find((h) => !h.dissolved && h.members.length >= 3 && VB['sim/herds'].hasTeam(st2, h));
  const f2 = st2.farmsteads[h2.farmstead];
  const p2 = st2.agents[h2.members.filter((id) => st2.pawns[id].alive && st2.pawns[id].age >= 14)[1]];
  A.release(st2, p2); A.placeAtHome(st2, p2);
  const j2 = J.post(st2, 'manure:cart' + st2.t, 'manure', { type: 'household', id: h2.id }, f2.fields[0].tile, { field: f2.fields[0], farm: f2 });
  j2.claims.push(p2.id); p2.job = j2; p2.phase = 'work'; p2.load = 0;
  assert(Carts.take(st2, h2, p2.id, true) > 0, 'a cart taken');
  p2.x = st2.w.hx[f2.fields[0].tile] + 400; p2.y = st2.w.hy[f2.fields[0].tile];
  A.release(st2, p2);
  const c2 = h2.carts.find((c) => c.at);
  assert(c2 && c2.by === null && Carts.oxOut(st2, h2) === (c2.kind === 'ox'), 'the cart stands where the pawn was');
  assert(st2.lying.some((l) => l.kind === 'leftCart'), 'a hand is to fetch it');
  assert.deepStrictEqual(checkState(st2), []);
}
console.log('standingcart ok');
