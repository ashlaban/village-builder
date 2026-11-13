// Independent cache corruption probes; long-run checks also run after every role refresh in tests/invariants.js.
const assert = require('assert'), { checkRoles, loadWithRoleChecks } = require('./lib/owner-caches.js');
const VB = loadWithRoleChecks(), { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(30))), [{ at: [10, 10], farms: 2, sizes: [6, 5] }], { seed: 5, herds: true });
assert.deepStrictEqual(checkState(st), []);
const hh = st.households[0], holder = st.pawns[hh.holder], farm = st.farmsteads[hh.farmstead];
holder.role = 'child';
assert(checkState(st).some((e) => e.includes('role cache')), 'wrong holder role must be detected before repair');
assert(checkRoles(st, VB).some((e) => e.includes('role cache')));
VB.sim.refreshRoles(st);
assert.deepStrictEqual(checkRoles(st, VB), []);
// A wrong but nonzero owner must fail for houses, fields and meadows.
assert(farm.fields.length > 0 && farm.meadows.length > 0);
for (const tile of [farm.house, farm.fields[0].tile, farm.meadows[0].tile]) {
  const old = st.owner[tile]; st.owner[tile] = 2;
  assert(checkState(st).some((e) => e.includes(`owner cache on tile ${tile}`)), 'wrong owner must be detected');
  st.owner[tile] = old;
}
holder.household = 1;
assert(checkState(st).some((e) => e.includes('household field')), 'pawn membership must match the member list');
holder.household = hh.id;
hh.members.push(st.households[1].holder);
assert(checkState(st).some((e) => e.includes('in households')), 'member lists must agree in both directions');
hh.members.pop();
// A birthday can leave a child role until the next social refresh. Check it strictly immediately after a refresh.
const child = st.pawns.find((p) => p.role === 'daughter'), born = child.born;
child.born = st.t - 14 * VB.sim.YEAR; child.age = 14; child.role = 'child';
assert.deepStrictEqual(checkState(st), []);
assert(checkRoles(st, VB).some((e) => e.includes('role cache')), 'strict check must reject stale roles at refresh boundaries');
VB.sim.refreshRoles(st);
assert.deepStrictEqual(checkRoles(st, VB), []);
child.born = st.t - 15 * VB.sim.YEAR; child.age = 15; child.role = 'child';
assert(checkState(st).some((e) => e.includes('role cache')), 'birthday allowance must be bounded');
child.born = born; child.age = VB.sim.age(st, child); VB.sim.refreshRoles(st);
assert.deepStrictEqual(checkState(st), []);
// The index of lines (VB-224): a farm's line written without noteLine must be detected, and noting it repairs the index.
const lineFarm = st.farmsteads[st.households[0].farmstead], oldLine = lineFarm.line;
lineFarm.line = st.households[0].members.find((m) => m !== st.households[0].holder);
assert(checkState(st).some((e) => e.includes('index of lines')), 'an unnoted line must be detected');
VB['sim/records'].noteLine(st, lineFarm);
assert.deepStrictEqual(checkState(st), []);
lineFarm.line = oldLine; VB['sim/records'].noteLine(st, lineFarm);
assert.deepStrictEqual(checkState(st), []);
console.log('owner caches ok: roles, exact tile owners, membership and line index corruption detected; strict checks after refresh');
