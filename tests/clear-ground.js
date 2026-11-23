// Clearing by ground (VB-1492): a tile's clearing adds GROUND[biome].clear to the brush; the breaking is the same on any ground.
const VB = require('../src/load.js'), { B } = VB.gen;
const FieldPlans = VB['sim/fieldplans'], { GROUND } = VB['sim/crops'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? '..^^hhmm..' : '..........'));
const st = tinyState(tinyWorld(rows), [{ at: [5, 10], farms: 1, sizes: [4] }], { seed: 3 }), w = st.w;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('CLEAR FAIL:', m); } };
const at = (c, r) => { const t = tileAt(w, c, r); w.stones[t] = 0; w.trees[t] = 0; return t; };
const hills = at(2, 0), heath = at(4, 0), marsh = at(6, 0), meadow = at(0, 0);
check(w.biome[hills] === B.HILLS && w.biome[heath] === B.HEATH && w.biome[marsh] === B.MARSH, 'the ground is as drawn');
const B30 = FieldPlans.BREAK_HOURS;
check(FieldPlans.clearHours(st, hills) === 18 && FieldPlans.clearHours(st, hills) + B30 === 48, 'hills: 18 and 30');
check(FieldPlans.clearHours(st, heath) === 13 && FieldPlans.clearHours(st, heath) + B30 === 43, 'heath: 13 and 30');
check(FieldPlans.clearHours(st, meadow) === 10, 'meadow with no stones: 10');
check(FieldPlans.clearHours(st, marsh) === 10 && GROUND[B.MARSH].clear === 0, 'marsh: 10, left to draining');
if (failed) process.exit(1);
console.log('clear-ground ok');
