// The village's wood (VB-326): a village of 10 households cuts its firewood in an area of 5 tiles a household, a tree a trip on a tile drawn
// evenly among those keeping more than a quarter of their trees; over 30 years at 11 trees a household a year no tile of it is cut bare and
// its standing trees level off. With WOOD.perHousehold forced to 1, tiles are cut bare, as when a village cut on one tile. On a tiny world,
// felling and regrowth only (sim/forest), the trips counted rather than walked.
const VB = require('../src/load.js'), F = VB['sim/forest'], { WOOD, YEAR_DAYS } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('WOOD FAIL:', m); } };
const TREES_A_YEAR = 11, HOUSEHOLDS = 10, YEARS = 30;
// meadow to the west, a mixed wood (broadleaf and pine, 60 and 80 trees) to the east
const rows = Array.from({ length: 22 }, (_, r) => [...Array(34)].map((_, c) => (c < 14 ? '.' : (c + r) % 2 ? 'F' : 'P')).join(''));
function run(perHousehold) {
  const keep = WOOD.perHousehold; WOOD.perHousehold = perHousehold;
  try {
    const st = tinyState(tinyWorld(rows), [{ at: [8, 11], farms: HOUSEHOLDS, sizes: Array(HOUSEHOLDS).fill(4) }], { seed: 3 }), v = st.villages[0], w = st.w;
    const first = v.wood.slice(), trees = () => v.wood.reduce((a, t) => a + w.trees[t], 0), byYear = [];
    let bare = 0, due = 0;
    for (let y = 0; y < YEARS; y++) {
      for (let d = 0; d < YEAR_DAYS; d++) {
        for (due += (TREES_A_YEAR * HOUSEHOLDS) / YEAR_DAYS; due >= 1; due--) {
          const t = F.drawWood(st, v); if (t < 0) break;
          F.fellTree(st, t); if (w.treesMax[t] === 0) bare++;
        }
        F.growTrees(st);
      }
      byYear.push(first.reduce((a, t) => a + w.trees[t], 0));
    }
    const bad = checkState(st);
    check(!bad.length, `invariants: ${bad.slice(0, 2).join('; ')}`);
    return { v, first, bare, byYear, trees: trees() };
  } finally { WOOD.perHousehold = keep; }
}
const full = run(WOOD.perHousehold);
check(full.first.length === WOOD.perHousehold * HOUSEHOLDS, `the wood of ${HOUSEHOLDS} households is ${full.first.length} tiles`);
check(full.bare === 0, `${full.bare} tiles of a full wood were cut bare`);
const [y20, y30] = [full.byYear[19], full.byYear[29]], start = full.first.length * 70;
check(Math.abs(y30 - y20) < 0.03 * start, `the standing trees do not level off: ${Math.round(y20)} at year 20, ${Math.round(y30)} at year 30`);
const one = run(1);
check(one.first.length === HOUSEHOLDS && one.bare > 0, `with one tile a household ${one.bare} tiles were cut bare`);
if (failed) process.exit(1);
console.log(`wood ok: ${HOUSEHOLDS} households, ${full.first.length} tiles, none cut bare in ${YEARS} years, standing trees ${Math.round(full.byYear[0])} `
  + `after a year, ${Math.round(y20)} at year 20, ${Math.round(y30)} at year 30; at one tile a household ${one.bare} cut bare`);
