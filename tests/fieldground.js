// VB-1490: a field records its ground: the biome its tile had when its project began (sim/fieldrec's newField).
const VB = require('../src/load.js'), G = VB.gen;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FIELDGROUND FAIL:', m); } };
const map = Array.from({ length: 10 }, () => '..............');
map[4] = '.....^........';
map[5] = '.....m........';
const w = tinyWorld(map), st = tinyState(w, [{ at: [3, 2], farms: 1 }], { seed: 7 });
const { newField } = VB['sim/fieldrec'], { fieldProject } = VB['sim/fieldplans'], { broken } = VB['sim/newground'];
const hill = tileAt(w, 5, 4), marsh = tileAt(w, 5, 5), grass = tileAt(w, 6, 4);
const h = newField(w, 0, hill), m = newField(w, 1, marsh), g = newField(w, 2, grass);
check(h.ground === 'hills' && h.fert === 0.7, `hill: ${h.ground} ${h.fert}`);
check(m.ground === 'marsh' && m.fert === 0.5, `marsh: ${m.ground} ${m.fert}`);
check(g.ground === 'meadow' && g.fert === 1, `meadow: ${g.ground} ${g.fert}`);
// the plan carries the ground of the project's start, though the tile is meadow by the time it is broken
const hh = st.households[0], plan = fieldProject(st, hh, hill);
check(plan.ground === 'hills', `plan ground ${plan.ground}`);
G.setBiome(w, hill, G.B.MEADOW);
const fd = broken(st, hill, 9, plan.ground);
check(fd.ground === 'hills' && fd.fert === 1, `broken after clearing: ${fd.ground} ${fd.fert}`);
st.farmsteads[0].fields.push(fd);
check(!checkState(st).some((b) => /ground/.test(b)), `ground invariant: ${checkState(st).join('; ')}`);
// an older save: no ground, read at load from the tile's biome
delete fd.ground; VB['sim/fieldrec'].grounded(st);
check(fd.ground === 'meadow', `older field: ${fd.ground}`);
if (failed) process.exit(1);
console.log('fieldground ok');
