// A hand released mid-haul (VB-581; a move, a wedding at the round, an occasion, an order, a household dissolving) does not book its
// load at the barn from the road: the load is set down, lying with the stooks for the next hand, and reaches the barn only carried.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous');
const hh = st.households.find((h) => !h.dissolved && st.farmsteads[h.farmstead].fields.length >= 1 && h.members.length >= 2);
const f = st.farmsteads[hh.farmstead], fd = f.fields[0];
fd.stage = 'stooks'; fd.held = 30; fd.sown = 0;
const a = st.agents[hh.members.find((id) => st.pawns[id].alive && st.pawns[id].age >= 14)];
A.release(st, a);
const j = J.post(st, 'haul:setdown', 'haul', { type: 'household', id: hh.id }, fd.tile, { field: fd, farm: f });
j.claims.push(a.id); a.job = j; a.phase = 'back'; a.inside = false; a.path = null;
const n = KINDS.haul.load(st, a, j, 10); a.carry = 'sheaf';
assert(n > 0 && fd.held === 30 - n);
const barn = JSON.stringify(hh.unthreshed);
A.release(st, a);
assert.strictEqual(JSON.stringify(hh.unthreshed), barn, 'the load is in the barn though its carrier never walked it there');
assert.strictEqual(fd.held, 30, 'the load is not set down with the stooks');
assert.strictEqual(fd.stage, 'stooks');
assert(a.load === 0 && a.carry === null && a.phase === null);
// the whole field in one load: set down, it is a field to haul again
fd.held = 5; KINDS.haul.load(st, a, j, 1e9); assert.strictEqual(fd.stage, 'stubble');
a.job = j; a.phase = 'back'; j.claims.push(a.id); A.release(st, a);
assert.strictEqual(fd.stage, 'stooks'); assert.strictEqual(fd.held, 5);
console.log('setdown ok');
