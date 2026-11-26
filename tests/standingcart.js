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
KINDS.haul.ops.pitch.run(st, j, null, j.site, a, cap); a.carry = 'sheaf'; // VB-1812: the stooks pitched (the work leg of its goal)
assert(Carts.oxOut(st, hh) && a.load > 30, 'a laden ox cart is out');
a.x = st.w.hx[fd.tile] + 400; a.y = st.w.hy[fd.tile]; fd.stage = 'stubble'; fd.held = 0;
const at = VB['sim/pose'].tileAt(st, a.x, a.y);
VB['sim/lifecycle'].killPawn(st, a.id, 'illness');
const cart = hh.carts.find((c) => c.kind === 'ox');
assert(cart && cart.at && cart.at.tile === at && cart.by === null, 'the cart stands where he fell');
assert(Carts.oxOut(st, hh), 'the team stands with it: not free at the farm');
assert(st.lying.some((l) => l.kind === 'leftCart') && st.lying.some((l) => l.kind === 'haul'), 'the cart and its load lie');
assert.deepStrictEqual(checkState(st), [], 'invariants hold with a cart standing');
// a hand goes for the cart: the household's goal for it (VB-1814, no fetch kind) is posted at its tile; its hand takes it up and leads
// it home, where it is free with its team
let jc = null;
Lying.bringWork(st, hh, f, null, (key, site, extra, k, owner) => { if (k === 'leftCart') jc = J.post(st, key, k, owner, site, extra); });
assert(jc && jc.site === at && !KINDS.fetchLeftCart, 'its goal is posted where the cart stands');
const b = st.agents[grown.find((id) => id !== a.id && st.pawns[id].alive)];
A.release(st, b); A.placeAtHome(st, b); A.start(st, b, jc);
let led = false;
for (let k = 0; k < 1500 && cart.at; k++) {
  Sim.advance(st, 0.1);
  if (b.job === jc && b.load > 0 && cart.at) {
    led = true;
    if (k % 20 === 0) assert.deepStrictEqual(checkState(st), [], 'invariants, the cart led home');
  }
}
assert(led && !cart.at && !Carts.oxOut(st, hh), 'home: the cart and team are free');
assert(!st.lying || !st.lying.some((q) => q.kind === 'leftCart'), 'no cart lies');
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
// released at its goal's site (VB-993): the goal's next hand takes the cart up where it stands (VB-1814), not a hand sent for it
{
  const st3 = Sim.seed(r.value, 7, 'populous'), D = VB['sim/doing'];
  const h3 = st3.households.find((h) => !h.dissolved && h.members.filter((id) => st3.pawns[id].age >= 14).length >= 2 && VB['sim/herds'].hasTeam(st3, h));
  const f3 = st3.farmsteads[h3.farmstead], fd3 = f3.fields[0];
  const [p3, q3] = h3.members.filter((id) => st3.pawns[id].alive && st3.pawns[id].age >= 14).map((id) => st3.agents[id]);
  A.release(st3, p3); A.placeAtHome(st3, p3);
  const j3 = J.post(st3, 'manure:site' + st3.t, 'manure', { type: 'household', id: h3.id }, fd3.tile, { field: fd3, farm: f3 });
  j3.claims.push(p3.id); p3.job = j3; p3.phase = 'work'; p3.load = 0;
  assert(Carts.take(st3, h3, p3.id, true) > 0, 'a cart taken');
  for (const c of h3.carts) if (!c.by && !c.at) c.by = -1; // the household's other carts busy: the one at the site is the only one free
  p3.x = st3.w.hx[fd3.tile]; p3.y = st3.w.hy[fd3.tile];
  A.release(st3, p3);
  const c3 = h3.carts.find((c) => c.at);
  assert(c3 && c3.at.tile === fd3.tile && c3.by === null, 'the cart stands at the site');
  // the next hand: the cart is free to it, at the site; taken up there, out with it, and no lying cart is left for a hand to fetch
  A.release(st3, q3); A.placeAtHome(st3, q3);
  j3.claims.push(q3.id); q3.job = j3; q3.phase = null;
  const g3 = D.goalOf(st3, q3);
  assert(D.VIEW.free(st3, g3, q3, 'cart') && D.VIEW.place(st3, g3, q3, 'cart') === fd3.tile, 'the cart at the site is free to the next hand, there');
  const s3 = D.ask(st3, q3);
  assert(s3 && s3.prim === 'fetch' && D.placeOf(st3, q3, s3) === fd3.tile, `its first step fetches the cart at the site: ${s3 && s3.prim}`);
  q3.x = st3.w.hx[fd3.tile]; q3.y = st3.w.hy[fd3.tile];
  assert(D.takeCart(st3, q3) > 0 && c3.by === q3.id && !c3.at, 'taken up where it stands');
  assert(!(st3.lying || []).some((l) => l.kind === 'leftCart'), 'no lying cart is left for a hand to fetch');
  for (const c of h3.carts) if (c.by === -1) c.by = null;
}
console.log('standingcart ok');
