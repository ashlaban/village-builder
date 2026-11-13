// VB-058: the village green and well, built by the village. A one-farm village has neither and never starts them, even with the routine
// forced; a village that gains a second occupied farm may choose the work at its meeting (VB-257), and its review makes it a project plan
// of the village (VB-123): the green's tile, free and passable between the farms, nearest their mean position, becomes the village's; the
// green is cleared, six loads of stone are carried to it from the households' heaps, the well is dug and lined, the sweep raised, all as a
// village duty (farmhand and son 6, farmer 5, the women 3); then v.green and v.well are set, the centre is the green, and water is drawn there.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { setClock } = require('./lib/clock.js');
const Plans = VB['sim/plans'], Green = VB['sim/green'], X = VB['sim/expansion'], Stores = VB['sim/stores'], S = VB['sim/settle'];
const { hexSteps } = VB['sim/hex'], { issue } = VB['sim/commands'], { refreshJobs } = VB['sim/jobs'], { ROLES, BUILD, DAY, WORK, YEAR, cal } = VB['sim/rules'];
const map = [
  '......................',
  '..FFF.............FF..',
  '..FFF.............FF..',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '..FF..............FF..',
  '..FF..............FF..',
  '......................',
  '......................',
];
const st = tinyState(tinyWorld(map), [{ at: [6, 5], farms: 1 }, { at: [16, 5], farms: 2, sizes: [7, 7] }], { seed: 7 });
const v = st.villages[0], plan = Plans.planOf(st, 'village', v.id);
const greens = () => st.record.filter((e) => typeof e === 'object' && e.kind === 'green' && e.village === v.id);
const review = () => {
  setClock(st, Math.floor(st.t / DAY + 1) * DAY + WORK[0]);
  refreshJobs(st, cal(st.t), true);
};
const bad = () => checkState(st).filter((x) => /villages|plans/.test(x));

// the duty's ranks, as Kim accepted them (30 Oct): below the farm's own work; none for the retired and children
assert.deepStrictEqual(Object.fromEntries(Object.entries(ROLES).map(([r, R]) => [r, R.prio.well])),
  { farmer: 5, wife: 3, farmhand: 6, maid: 3, son: 6, daughter: 3, retired: 0, child: 0 });
assert.ok(st.villages[1].well && st.villages[1].green, 'a village laid out with two farms has its green and well from the start');

{ // a one-farm village: no green, no well, the work not offered to its meeting, and nothing begun even with the routine forced
  assert.ok(!v.green && !v.well && v.farmsteads.length === 1);
  assert.ok(!Plans.VILLAGE_ROUTINES.green.available(st, v), 'not available');
  assert.ok(!(Plans.chooseRoutines(st, v) || []).includes('green'), 'not chosen');
  Plans.setRoutines(st, v.id, ['green'], 'meeting');
  review();
  Sim.advance(st, YEAR / 2);
  assert.ok(!Green.greenOf(st, v) && !greens().length && !v.well, 'a one-farm village never starts the project');
  Plans.setRoutines(st, v.id, [], 'meeting');
}

// a settler of the other village joins it: its second occupied farm
const home = st.villages[1], settler = Sim.membersOf(st, home.id).find((p) => p.age >= 18 && !Sim.isHolder(st, p.id));
st.households[settler.household].grain.barley += 2000; // a family that can spare the provisions
const site = X.findSite(st, v);
assert.ok(site, 'room to settle beside the lone farm');
const party = { all: [settler.id], followers: [] };
assert.strictEqual(issue(st, { actor: settler.id, verb: 'leave', args: { from: home.id, village: v.id, party, house: site.house, field: site.field }, source: 'round' }), true);
const joined = st.t, oldCentre = v.center;
assert.strictEqual(Green.houses(st, v).length, 2, 'two occupied farms');
assert.ok(Plans.VILLAGE_ROUTINES.green.available(st, v) && Plans.chooseRoutines(st, v).includes('green'), 'the meeting may choose it');
assert.ok(!Green.greenOf(st, v), 'nothing is built before the meeting chooses it');
// stone in the heaps, as clearing leaves it (sim/fields): the well's six loads, and more
for (const id of v.farmsteads) Stores.put(st, st.households[st.farmsteads[id].household], 'stone', 4, 'clear');
const heaps = () => v.farmsteads.reduce((n, id) => n + st.households[st.farmsteads[id].household].stone, 0), before = heaps();

// the green's tile: free and passable, nearest the farms' mean position among the open tiles near them
const tile = Green.greenSite(st, v), hs = Green.houses(st, v), w = st.w;
assert.ok(tile >= 0 && !w.water[tile] && !st.used.has(tile));
const mx = (w.hx[hs[0]] + w.hx[hs[1]]) / 2, my = (w.hy[hs[0]] + w.hy[hs[1]]) / 2, d = (t) => (w.hx[t] - mx) ** 2 + (w.hy[t] - my) ** 2;
for (let t = 0; t < w.N; t++) if (t !== tile && d(t) < d(tile) && !hs.includes(t))
  assert.ok(w.dev[t] || st.used.has(t) || w.water[t] || st.owner[t] > 0 || st.claims.has(t), `tile ${t}, nearer the farms' mean, is taken`);
assert.ok(hs.every((h) => hexSteps(w, h, tile) <= 2), 'between the farms');

// a year from the farm's joining: the meeting chooses the work and the village builds it
let seen = null;
while (!v.well && st.t < joined + YEAR) {
  Sim.advance(st, DAY);
  const p = Green.greenOf(st, v);
  if (p && !seen) {
    seen = p;
    assert.ok(plan.routines.includes('green'), 'begun as a routine of the meeting');
    assert.strictEqual(p.steps[0].place, tile, 'on the tile chosen');
    assert.strictEqual(st.owner[tile], -v.id - 1, 'the green is the village\'s');
    assert.deepStrictEqual(bad(), [], 'invariants while under way');
  }
}
assert.ok(v.well && v.green, `the green and well built within a year of the second farm (${((st.t - joined) / DAY).toFixed(0)} days)`);
assert.ok(seen, 'as a project plan of the village');
assert.strictEqual(v.center, tile, 'the green is the village\'s centre');
assert.notStrictEqual(v.center, oldCentre);
assert.strictEqual(st.owner[tile], -v.id - 1);
assert.strictEqual(w.dev[tile], 2, 'open ground that the ways cross');
assert.ok(!Green.greenOf(st, v), 'the plan is finished');
assert.strictEqual(before - heaps() >= BUILD.wellStone, true, 'the well took its stone from the heaps');
const taken = v.farmsteads.flatMap((id) => st.households[st.farmsteads[id].household].ledger).filter((x) => x.kind === 'well');
assert.strictEqual(taken.reduce((n, x) => n - x.n, 0), BUILD.wellStone, 'six loads, each through the stores with its own reason');
assert.strictEqual(greens().length, 2, 'begun and finished, in the village\'s log');
assert.ok(Sim.chronicle(st, { village: v.id }, 'land').some((x) => greens().includes(x.ev)), 'in the village\'s history');
assert.ok(!Plans.VILLAGE_ROUTINES.green.available(st, v), 'no more work once the well is dug');
// water is drawn at the well from now
review();
const water = [...st.jobs.values()].filter((j) => j.kind === 'water' && st.farmsteads[j.farm.id].village === v.id);
assert.ok(water.length && water.every((j) => j.site === tile), 'water is drawn at the well');
assert.deepStrictEqual(bad(), [], 'invariants');
// a save keeps it
const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.ok(back.villages[v.id].well && back.villages[v.id].center === tile);
console.log(`green ok: a one-farm village starts nothing; with a second farm its meeting chose the work and the green and well stood ${((st.t - joined) / DAY).toFixed(0)} days after it joined, taking ${BUILD.wellStone} loads of stone`);
