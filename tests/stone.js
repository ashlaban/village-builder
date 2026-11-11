// Stone is used (VB-332): a house on the ground may be raised onto a stone foundation (12 loads from the heap, 40 hours, in the slack of
// early summer or winter), which lifts its prestige term (0.20 against 0.15 times the condition) and slows its wear (0.08 a year against 0.1);
// the stone is picked on a stony meadow tile (lowering it as clearing does) or quarried on hills, a load a trip, only while the household's
// plan holds its building step. On a tiny world, through the rules, not a run.
const VB = require('../src/load.js'), Bld = VB['sim/building'], Plans = VB['sim/plans'], K = VB['sim/kinds'].KINDS;
const { BUILD, HOUSE, YEAR, SEASON_DAYS, DAY, cal, houseTerm, houseCondition } = VB['sim/rules'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('STONE FAIL:', m); } };
// meadow, a stony strip of the village's outland to the east, hills beyond
const rows = Array.from({ length: 14 }, (_, r) => [...Array(26)].map((_, c) => (c >= 22 ? '^' : '.')).join(''));
const st = tinyState(tinyWorld(rows, { stones: 40 }), [{ at: [8, 7], farms: 2, sizes: [5, 4] }], { seed: 4 }), w = st.w, v = st.villages[0];
const hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = Plans.planOf(st, 'household', hh.id);
check(f.grade === 'ground' && st.farmsteads.every((x) => x.grade === 'ground'), 'generated farms stand on the ground');
// the building step: no stony tile and no hills within reach of the house but those beyond: quarrying, then picking once a tile is stony
f.project = null; plan.build = null;
let step = Bld.buildStep(st, plan, hh);
check(step && (step.kind === 'quarry' || step.kind === null), `with no stony meadow the stone is quarried, if hills are in reach (${JSON.stringify(step)})`);
const stony = VB['sim/territory'].outlandOf(st, v).find((t) => w.biome[t] === VB.gen.B.MEADOW);
w.stones[stony] = 200; plan.build = null;
step = Bld.buildStep(st, plan, hh);
check(step && step.kind === 'pick' && step.tile === stony, `a stony meadow of the outland is picked (${JSON.stringify(step)})`);
plan.build = step;
check(Bld.buildStep(st, plan, hh) === step, 'the step and its source are kept on the plan');
// the jobs: two trips at a time while the heap lacks the foundation's stone; none without the step
const asked = (c) => { const out = []; Bld.stoneWork(st, hh, f, c, (key, site, extra, kind) => out.push({ key, site, kind })); return out; };
const summer = cal(YEAR + SEASON_DAYS * DAY + 10), autumn = cal(YEAR + 2 * SEASON_DAYS * DAY + 10);
hh.stone = 0;
let jobs = asked(autumn);
check(jobs.length === 2 && jobs.every((j) => j.kind === 'pick' && j.site === stony), `two picking trips are posted (${jobs.length})`);
plan.build = null; check(asked(autumn).length === 0, 'no stone is wanted without a building step'); plan.build = step;
// a trip: a load on the heap, through the stores, and 25 stones off the tile
const j = { kind: 'pick', site: stony, farm: f };
K.pick.deliver(st, j, hh);
check(hh.stone === 1 && w.stones[stony] === 175 && hh.ledger.some((e) => e.kind === 'pick' && e.good === 'stone'), `a picked load (${hh.stone}, ${w.stones[stony]} stones left)`);
K.quarry.deliver(st, { kind: 'quarry', site: tileAt(w, 23, 7), farm: f }, hh);
check(hh.stone === 2 && w.stones[tileAt(w, 23, 7)] === 0, 'a quarried load; the hills are never exhausted');
w.stones[stony] = BUILD.keepStones;
check(Bld.buildStep(st, plan, hh).tile !== stony, 'a tile picked down to what a meadow keeps is left');
// the raising: only with the stone on the heap and in the slack
hh.stone = BUILD.foundationStone;
check(asked(autumn).length === 0, 'not raised in autumn');
jobs = asked(summer);
check(jobs.length === 1 && jobs[0].kind === 'raise' && jobs[0].site === f.house && K.raise.hours === BUILD.foundationHours, 'raised in early summer, 40 hours');
const before = houseTerm(st, f) / houseCondition(st, f);
K.raise.done(st, { kind: 'raise', farm: f });
check(f.grade === 'stone' && hh.stone === 0 && hh.ledger.some((e) => e.kind === 'foundation'), `raised: grade ${f.grade}, ${hh.stone} loads left`);
check(Math.abs(before - HOUSE.term) < 1e-9 && Math.abs(houseTerm(st, f) / houseCondition(st, f) - HOUSE.termStone) < 1e-9, 'the term is 0.20 on stone, 0.15 on the ground');
const c0 = houseCondition(st, f); st.t += YEAR;
check(Math.abs(c0 - houseCondition(st, f) - HOUSE.wearStone) < 1e-6, `the house wears ${(c0 - houseCondition(st, f)).toFixed(3)} a year on stone`);
st.t -= YEAR;
check(Bld.buildStep(st, plan, hh) === null, 'the step closes once the house is on stone');
const p = st.pawns[hh.holder], parts = VB.sim.prestigeParts(st, p);
check(parts.some(([l]) => l === 'A well-kept house on stone'), `the prestige parts name the grade (${parts.map((x) => x[0])})`);
const bad = checkState(st);
check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
if (failed) process.exit(1);
console.log(`stone ok: ${BUILD.foundationStone} loads and ${BUILD.foundationHours} hours raise a house onto stone; term ${HOUSE.termStone}, wear ${HOUSE.wearStone}; `
  + 'picked and quarried only for a building step');
