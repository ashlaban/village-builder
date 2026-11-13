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

// Beyond reach (VB-421): a village whose reach holds no forest takes its wood beyond it, nearest first, up to WOOD.far steps; with none
// within WOOD.far it has none. A band of forest starts `gap` columns east of the green.
const { bfs } = VB['sim/hex'], { walkable } = VB['sim/routes'], { reckonWood } = VB['sim/territory'];
function beyond(gap) {
  const rows2 = Array.from({ length: 22 }, () => [...Array(60)].map((_, c) => (c < 6 + gap ? '.' : 'F')).join(''));
  const st = tinyState(tinyWorld(rows2), [{ at: [6, 11], farms: 4, sizes: [4, 4, 4, 4] }], { seed: 3 }), v = st.villages[0];
  const dist = bfs(st.w, v.center, 60, walkable(st.w)).dist, steps = reckonWood(st, v).map((t) => dist.get(t));
  return { v, steps };
}
{
  const { v, steps } = beyond(18);
  check(v.wood.length === WOOD.perHousehold * 4, `a village with forest only beyond reach has ${v.wood.length} tiles of wood`);
  check(steps.every((d) => d > WOOD.reach && d <= WOOD.far), `its wood lies beyond reach and within far: ${Math.min(...steps)} to ${Math.max(...steps)} steps`);
  check(steps.every((d, i) => i === 0 || d >= steps[i - 1]), 'nearest first');
  const none = beyond(WOOD.far + 6);
  check(none.v.wood.length === 0, `forest beyond WOOD.far: ${none.v.wood.length} tiles of wood`);
}
