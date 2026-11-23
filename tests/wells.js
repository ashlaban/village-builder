// VB-1553: wells are dug. On drawn maps (tests/lib/tiny.js): a well's hours and stone are by the depth of its tile, one rule for a
// household's and a village's (2 m: 24 hours and 2 loads; 10 m: 56 and 6); a household inland gathers the lining's stone, digs by its
// house and then fetches in the drawing alone; a household beside a brook does not dig; no well is begun on ground with none, and the
// verb says why not; a village's green lies where the water is reckoned shallowest, its well's step by the depth, and a green whose
// ground has no well is laid out without one; village.well is the well's tile, and a save with the boolean loads.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Water = VB['sim/water'],
  Wells = VB['sim/wells'],
  Green = VB['sim/green'],
  Stores = VB['sim/stores'],
  Projects = VB['sim/projects'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { FRESH, NO_WELL, wellHours, wellStone, bandStone, bandHours } = VB['world/water'];
const { DAY } = VB['sim/rules'];
const { issue } = VB['sim/commands'];
const { WATER, tripHours } = Water;
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('WELLS FAIL:', m);
  }
};
const near = (x, y, e = 0.01) => Math.abs(x - y) <= e;
const meadow = (cols, rows) => Array.from({ length: rows }, () => '.'.repeat(cols));
const brook = (w, i) => {
  w.river[i] = 1;
  w.fresh[i] = FRESH.BROOK;
};
// ---- 1. the one rule of a well's cost ----
check(wellHours(2) === 24 && wellStone(2) === 2, `a well in 2 m of ground: 24 hours and 2 loads (${wellHours(2)}, ${wellStone(2)})`);
check(wellHours(10) === 56 && wellStone(10) === 6, `in 10 m: 56 hours and 6 loads (${wellHours(10)}, ${wellStone(10)})`);
check(wellStone(1) === 2 && wellStone(4) === 3 && wellStone(20) === 11, 'shallow 2 or 3 loads, the deepest 11');
check([0, 1, 2].map(bandStone).join() === '3,6,11', 'the stone set aside is the band\'s most');

// A lone farm with a brook `steps` tiles east of its house, in ground `depth` metres to the water; the farm's starting well taken away.
const lone = (steps, depth) => {
  const lay = (ww) => tinyState(ww, [{ at: [8, 6], farms: 1, sizes: [4] }], { seed: 7 });
  const w = tinyWorld(meadow(30, 13), { stones: 200 }),
    house = lay(tinyWorld(meadow(30, 13))).farmsteads[0].house;
  brook(w, house + steps);
  w.waterDepth[house] = depth;
  const st = lay(w),
    hh = st.households[0],
    f = st.farmsteads[hh.farmstead];
  w.fresh[f.house] = FRESH.NONE; // a test's write: the farm starts with no well
  Water.find(st, f);
  return { st, w, hh, f };
};
const project = (st, hh, what = 'well') => issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args: { what }, source: 'player' });
const wellPlan = (st, hh) => Projects.projectsOf(st, 'household', hh.id).find((p) => p.what === 'well') || null;
// ---- 2. a household inland digs: the stone gathered, the well by the house in its depth's hours, the fetch the drawing alone ----
{
  const { st, w, hh, f } = lone(7, 2);
  check(near(f.water.walk, 0.875) && Wells.pays(st, f), `7 steps of meadow off, a well pays (${JSON.stringify(f.water)})`);
  check(Wells.stoneLacking(st, hh, f) === 3 && /loads of stone/.test(project(st, hh)), `with no stone on the heap the verb says so (${project(st, hh)})`);
  let begun = null,
    days = 0;
  for (; days < 60 && w.fresh[f.house] !== FRESH.WELL; days++) {
    Sim.advance(st, DAY);
    const p = wellPlan(st, hh);
    if (p && !begun) {
      begun = { day: days, step: { ...p.steps[0] }, reserved: p.reserved.stone, small: p.small };
      check(/under way/.test(project(st, hh)), `a well under way: no second (${project(st, hh)})`);
      const bad = checkState(st);
      check(!bad.length, `invariants while digging: ${bad.slice(0, 3).join('; ')}`);
    }
  }
  check(
    begun && begun.step.kind === 'housewell' && begun.step.place === f.house && begun.step.hours === 24 && begun.reserved === 3 && begun.small,
    `the head gathers 3 loads and begins a well of 24 hours on the house's tile (${JSON.stringify(begun)})`,
  );
  check(w.fresh[f.house] === FRESH.WELL && !wellPlan(st, hh), `water is struck within 60 days (${days})`);
  const took = hh.ledger.filter((x) => x.kind === 'build' && x.good === 'stone').reduce((n, x) => n - x.n, 0);
  check(took === 2, `the lining took 2 loads of the 3 set aside (${took}; ${JSON.stringify(hh.ledger.filter((x) => x.good === 'stone'))})`);
  check(f.water.tile === f.house && f.water.walk === 0 && near(tripHours(f.water.walk), 0.1), `its fetch falls to 0.1 hours a trip (${JSON.stringify(f.water)})`);
  check(near(Sim.waterOf(st, f).hours, WATER.draw), 'the page is told the same');
  check(!Wells.pays(st, f) && /has a well/.test(project(st, hh)), `one already: no second (${project(st, hh)})`);
  const bad = checkState(st);
  check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
}
// ---- 3. a household beside a brook does not dig ----
{
  const { st, w, hh, f } = lone(1, 2);
  check(near(f.water.walk, 0.125) && !Wells.pays(st, f) && Wells.stoneLacking(st, hh, f) === 0, `a step from the brook a shallow well does not pay (${JSON.stringify(f.water)})`);
  Stores.put(st, hh, 'stone/granite', 6, 'pick');
  Sim.advance(st, 16 * DAY);
  check(!wellPlan(st, hh) && w.fresh[f.house] === FRESH.NONE, 'and with stone on the heap its head begins none');
  check(project(st, hh) === true && wellPlan(st, hh), 'the played head may dig all the same');
}
// ---- 4. no well is begun on ground with none; nor beside a project under way ----
{
  const { st, hh, f } = lone(7, NO_WELL);
  Stores.put(st, hh, 'stone/granite', 12, 'pick');
  check(!Wells.pays(st, f) && Wells.stoneLacking(st, hh, f) === 0, 'no well in the ground: none pays');
  check(/no well in the ground/.test(project(st, hh)), `the verb says why not (${project(st, hh)})`);
  Sim.advance(st, 16 * DAY);
  check(!wellPlan(st, hh) && st.w.fresh[f.house] === FRESH.NONE, 'and none is begun');
}
{
  const { st, hh, f } = lone(7, 6);
  Stores.put(st, hh, 'stone/granite', 12, 'pick');
  check(project(st, hh, 'meadow') === true || project(st, hh, 'field') === true, 'a land project begun');
  check(/project under way/.test(project(st, hh)), `a project under way: no well (${project(st, hh)})`);
  check(Wells.stoneLacking(st, hh, f) === 0, 'and no stone is gathered for one');
}
// ---- 5. the village's well: the green where the water is reckoned shallowest, the well's step by the depth; none where the ground has none ----
{
  const w = tinyWorld(meadow(24, 12)),
    st = tinyState(w, [{ at: [10, 5], farms: 3 }], { seed: 7 }),
    v = st.villages[0];
  check(v.well === v.center && w.fresh[v.well] === FRESH.WELL, `the starting village's well is its tile, on the green (${v.well})`);
  // the village as one that has yet to lay out its green (a test's writes)
  w.fresh[v.well] = FRESH.NONE;
  v.green = false;
  v.well = null;
  for (let i = 0; i < w.N; i++) w.waterDepth[i] = 10; // middling everywhere
  const mid = Green.greenProject(st, v),
    t0 = mid.steps[0].place;
  check(
    mid.steps.length === 3 && mid.steps[1].kind === 'well' && mid.steps[1].hours === 56 && mid.steps[1].stone === 6,
    `a green in 10 m of ground: a well of 56 hours and 6 loads (${JSON.stringify(mid.steps[1])})`,
  );
  // a shallow tile further from the middle is taken before the middling middle
  for (let t = 0; t < w.N; t++) {
    if (t === t0) continue;
    w.waterDepth[t] = 2;
    if (Green.greenSite(st, v) === t) break;
    w.waterDepth[t] = 10;
  }
  const shallow = Green.greenProject(st, v);
  check(
    shallow.steps[0].place !== t0 && w.waterDepth[shallow.steps[0].place] === 2 && shallow.steps[1].hours === 24 && shallow.steps[1].stone === 2,
    `the green is laid where the water is shallowest: 24 hours and 2 loads (${JSON.stringify(shallow.steps[1])})`,
  );
  for (let i = 0; i < w.N; i++) w.waterDepth[i] = NO_WELL;
  const none = Green.greenProject(st, v);
  check(none.steps.length === 1 && none.steps[0].kind === 'green', `ground with no well: the green alone (${none.steps.map((s) => s.kind)})`);
  Green.KINDS.green.done(st, { village: v.id, site: none.steps[0].place, step: none.steps[0] }); // not its plan's step: nothing
  check(!v.green, 'a step that is not the plan\'s changes nothing');
}
// ---- 6. a save from before the well was a tile ----
{
  const old = { villages: [{ well: true, center: 41 }, { well: false, center: 7 }, { well: 12, center: 12 }, { well: null, center: 3 }] };
  Water.wellsLoaded(old);
  check(old.villages.map((v) => v.well).join() === '41,,12,', `the boolean becomes the green's tile, or none (${old.villages.map((v) => v.well)})`);
  const w = tinyWorld(meadow(24, 12)),
    st = tinyState(w, [{ at: [10, 5], farms: 3 }], { seed: 7 }),
    data = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(st.w, data);
  check(back.villages[0].well === st.villages[0].well && back.w.fresh[back.villages[0].well] === FRESH.WELL, 'a save keeps the well\'s tile and its source');
  check(bandHours(1).join() === '32,56', 'the band shown: middling, 32 to 56 hours');
}
if (failed) process.exit(1);
console.log('wells ok: the cost by the depth; a household inland gathers stone, digs and fetches at its door; none by a brook, none in ground with no well; the green by the water');
