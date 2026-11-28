// @suite fast
// Breaking forest to a field (VB-1525; Kim, 23 Nov): a household with only forest in reach makes its field there, felling and grubbing it
// before the clearing and the breaking, as a plot's tile is; every tree on it lies at the site as timber and comes home to the woodpile by
// the hands' walks (sim/lying's leftTimber); the field records its ground, a wood's fertility and fresh soil.
const VB = require('../src/load.js'), { B } = VB['world/biomes'], Sim = VB.sim;
const FieldPlans = VB['sim/fieldplans'], { GROUND, SOIL, farmable, openGround } = VB['sim/crops'];
const { FELL_HOURS, GRUB_HOURS } = VB['sim/forest'], { ECON } = VB['sim/rules'], Stores = VB['sim/stores'];
const { bfs } = VB['sim/hex'], { walkable } = VB['sim/walking'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FOREST FIELD FAIL:', m); } };
const rows = Array.from({ length: 14 }, () => '..........');
const st = tinyState(tinyWorld(rows), [{ at: [5, 7], farms: 1, sizes: [4] }], { seed: 5 }), w = st.w;
const f = st.farmsteads[0], hh = st.households[f.household];
// every free tile in reach of the house becomes forest: the farm's own fields, its house and the green stay as they are
const keep = new Set([f.house, ...f.fields.map((fd) => fd.tile), ...st.villages.map((v) => v.center)]);
for (const [t] of bfs(w, f.house, 6, walkable(w)).dist)
  if (!keep.has(t) && !st.used.has(t) && w.biome[t] === B.MEADOW) {
    w.biome[t] = B.FOREST;
    w.trees[t] = w.treesMax[t] = 20;
    w.stones[t] = 0;
  }
check(GROUND[B.FOREST].fert === 0.9 && GROUND[B.PINE].fert === 0.6, 'forest 0.9, pine 0.6');
const tile = FieldPlans.pickField(st, f, hh);
check(tile >= 0 && w.biome[tile] === B.FOREST, `the head picks a forest tile (${tile}, biome ${w.biome[tile]})`);
check(farmable(w, tile) && !openGround(w, tile), 'a wood is farmable, not open ground');
const plan = FieldPlans.beginField(st, f, hh, tile);
check(plan && plan.ground === 'forest', 'the plan records forest');
check(plan && plan.steps.map((s) => s.kind).join(' ') === 'fell grub clear break', `steps: ${plan && plan.steps.map((s) => s.kind)}`);
check(plan && plan.steps[0].hours === FELL_HOURS && plan.steps[1].hours === GRUB_HOURS, 'felling and grubbing as a plot\'s');
check(plan && plan.steps[2].hours === FieldPlans.clearHours(st, tile) && plan.steps[2].hours === 10, `clearing with no trees in it: ${plan && plan.steps[2].hours}`);
VB['sim/projectplans'].makeProject(st, 'household', hh.id, plan);
// the timber brought home: what reaches the woodpile for 'timber'
let timber = 0;
const put = Stores.put;
Stores.put = (s, h, good, n, why, ...rest) => {
  if (h === hh && good === 'wood' && why === 'timber') timber += n;
  return put(s, h, good, n, why, ...rest);
};
// the steps as they open, hour by hour
const kinds = [], own = () => VB['sim/projects'].projectsOf(st, 'household', hh.id).find((p) => p.what === 'field');
let fd = null;
for (let h = 0; h < 24 * 40 && !(fd && !st.lying); h++) {
  const p = own(), k = p ? p.steps[p.open].kind : null;
  if (k && kinds[kinds.length - 1] !== k) kinds.push(k);
  Sim.advance(st, 1);
  fd = f.fields.find((x) => x.tile === tile) || null;
}
Stores.put = put;
check(kinds.join(' ') === 'fell grub clear break', `the steps done in order: ${kinds.join(' ')}`);
check(fd !== null, 'the field is made');
if (fd) {
  check(fd.ground === 'forest' && fd.fert === 0.9 * (VB['sim/crops'].byRiver(w, tile) ? 1.2 : 1), `ground ${fd.ground}, fert ${fd.fert}`);
  check(fd.soil === SOIL.fresh, `fresh soil: ${fd.soil}`);
}
check(w.biome[tile] === B.MEADOW && w.trees[tile] === 0 && w.treesMax[tile] === 0, 'the tile is meadow, its trees gone');
check(timber === 20 * ECON.woodPerTrip, `the wood carried home: ${timber} of ${20 * ECON.woodPerTrip}`);
check(!st.lying, 'nothing left lying');
const bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
console.log(`  steps ${kinds.join(', ')}; timber home ${timber}; field ${fd ? `${fd.ground} ${fd.fert}` : 'none'}`);
if (failed) process.exit(1);
console.log('forest-field ok');
