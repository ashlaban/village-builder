// VB-1661: what the screen says of the stores and the building counts on nothing the player has not planned. On small constructed
// states: (1) one reckoning of the fire, Sim.fireView's `short` the supply outlook's fuel; (2) a household planned by hand counts an
// intake still to be worked only when a task of the plan covers it (firewood, hay, harvest), and says what it left out; every other
// household is reckoned as before; (3) Sim.farmView's building reports no stone work the head opened by its own rule while held off;
// (4) a firewood task with timber home is not left waiting days for the household's next review.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { DAY, YEAR, TICKS, cal } = VB['sim/rules'];
const { reckon } = VB['sim/outlook'];
const Stores = VB['sim/stores'],
  H = VB['sim/herds'],
  M = VB['sim/meadows'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  probe = require('./lib/probe.js'),
  { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const handStart = (seed = 7) => {
  const st = Sim.seed(tinyWorld(rows), seed, 'solo', null, { hand: true });
  st.naturalDeaths = false;
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 }), true);
  return st;
};

// 1 and 2 (fuel). A hand start's first morning: the outlook leaves out the head's own cutting, and the fire's read agrees with it.
{
  const st = handStart();
  Sim.advance(st, 8);
  const O = Sim.supplyOutlook(st, 0),
    fire = Sim.fireView(st, st.player.pawn);
  assert.notStrictEqual(O.fuel.state, 'safe', `the pile alone does not last the year by hand: ${JSON.stringify(O.fuel)}`);
  assert.deepStrictEqual(O.fuel.parts.intakes, [], 'no firewood counted with no task for it');
  assert.deepStrictEqual(
    O.fuel.parts.left.map((x) => [x.good, x.what]),
    [['fuel', 'cutting']],
    'the cutting left out, for want of a task',
  );
  assert.strictEqual(fire.short, true, 'the fire reads short');
  assert.deepStrictEqual([fire.state, fire.lasts, fire.season], [O.fuel.state, O.fuel.with, O.fuel.season], 'one reckoning');
  // planned: two trips felled and the cutting; their loads counted, the fell no longer left out
  const f = st.farmsteads[0],
    v = st.villages[f.village],
    tile = v.wood.find((t) => st.w.trees[t] >= 3);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { fell: tile, n: 2 }), true);
  let L = Sim.supplyOutlook(st, 0).fuel.parts.left;
  assert(L.some((x) => x.what === 'fell' && x.tile === tile), `the fell's loads left out with no firewood task: ${JSON.stringify(L)}`);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { firewood: f.house }), true);
  const P = Sim.supplyOutlook(st, 0);
  L = P.fuel.parts.left;
  assert(!L.some((x) => x.what === 'fell'), 'with a firewood task, the fell is counted');
  assert.strictEqual(P.fuel.parts.intakes[0].n, 2 * st.ECON.woodPerTrip, 'two loads counted');
  assert(P.fuel.with > O.fuel.with, `it lasts longer: ${O.fuel.with} to ${P.fuel.with}`);
  assert.strictEqual(Sim.fireView(st, st.player.pawn).short, P.fuel.state !== 'safe', 'still one reckoning');
  // left to its head (automatic on): its cutting counted, nothing left out, and the read the same reckoning
  Sim.setAuto(st, st.player.pawn, true);
  const A = Sim.supplyOutlook(st, 0);
  assert.strictEqual(A.fuel.parts.left, undefined, 'nothing left out for a household left to its head');
}

// 2 (food and hay). Two cows and two meadows to mow, a field standing: counted by hand only with a hay or harvest task; another
// household reckoned as before.
{
  const st = probe.state();
  st.naturalDeaths = false;
  st.tick = Math.round((YEAR + 6 * DAY + 8) * TICKS);
  st.t = st.tick / TICKS;
  const [h0, h1] = st.villages[0].farmsteads.map((f) => st.households[st.farmsteads[f].household]),
    p0 = st.plans.households.get(h0.id),
    p1 = st.plans.households.get(h1.id),
    f0 = st.farmsteads[h0.farmstead];
  h0.hay = 0;
  const herd = H.makeHerd(st, h0, 'cattle');
  for (let k = 0; k < 2; k++) H.addHead(st, herd, 'f', st.t - 5 * YEAR, 'cow');
  for (let k = 0; k < 2; k++) M.addMeadow(st, f0, h0, M.chooseMeadow(st, f0));
  const fd = f0.fields[0];
  Object.assign(fd, { stage: 'growing', sown: cal(st.t).day - 5 });
  const auto0 = reckon(st, h0, p0),
    other = JSON.stringify(reckon(st, h1, p1));
  assert(auto0.hay.parts.intakes.some((x) => x.what === 'meadows'), 'left to its head, the meadows are counted');
  assert(auto0.food.parts.intakes.length > 0, 'and the field');
  Sim.inhabit(st, h0.holder);
  Sim.setAuto(st, st.player.pawn, false);
  const by = reckon(st, h0, p0);
  assert.deepStrictEqual(by.hay.parts.intakes, [], 'by hand, no hay counted with no hay task');
  assert.deepStrictEqual(
    by.hay.parts.left.map((x) => [x.what, x.tile]),
    f0.meadows.map((m) => ['meadow', m.tile]),
    'each meadow to mow left out',
  );
  assert(by.food.parts.left.some((x) => x.what === 'harvest' && x.tile === fd.tile), 'the standing field left out');
  assert.strictEqual(by.food.parts.store, auto0.food.parts.store, 'what is held counted as before');
  assert.strictEqual(JSON.stringify(reckon(st, h1, p1)), other, 'another household reckoned as before');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { hay: f0.meadows[0].tile }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { harvest: fd.tile }), true);
  const planned = reckon(st, h0, p0);
  assert(planned.hay.parts.intakes.some((x) => x.what === 'meadows'), 'the meadow with a hay task counted');
  assert.deepStrictEqual(
    planned.hay.parts.left.map((x) => x.tile),
    f0.meadows.slice(1).map((m) => m.tile),
    'the other meadows still left out',
  );
  assert(!planned.food.parts.left.some((x) => x.tile === fd.tile && x === planned.food.parts.left[0]), 'the standing crop not left out');
  const first = planned.food.parts.intakes.find((x) => x.what === fd.crop);
  assert(first && first.n > 0, `the standing crop counted with its harvest task: ${JSON.stringify(planned.food.parts)}`);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(Sim.supplyOutlook(st, h0.id).hay.parts)), JSON.parse(JSON.stringify(planned.hay.parts)), 'read when asked');
}

// 3. A cottage on the ground: its head opens a stone step by its own rule; held off by the player, none, and farmView builds nothing.
{
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead],
    plan = st.plans.households.get(hh.id);
  assert(!f.booth && f.grade === 'ground' && plan.build, 'the head means to raise its house onto stone');
  assert.strictEqual(Sim.farmView(st, f.id).building.what, 'foundation');
  Sim.inhabit(st, 0);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Sim.farmView(st, f.id).building, null, 'by hand, no stone work reported, before the next review');
  Sim.advance(st, 2 * DAY);
  assert.strictEqual(plan.build, null, 'and none opened at a review');
  assert(![...st.jobs.values()].some((j) => j.owner.type === 'household' && j.owner.id === hh.id && ['pick', 'quarry', 'raise'].includes(j.kind)), 'no stone job');
  Sim.setAuto(st, st.player.pawn, true);
  Sim.advance(st, 2 * DAY);
  assert(plan.build, 'left to its head, the step opens again');
  sound(st, 'held off and back');
}

// 4. A hand start: fell two trips and cut them. The cutting is posted by the next review hour after the timber is home, not at the
// household's planning day (before VB-1661: 34 hours at seed 7, 35 at seed 9).
for (const seed of [7, 9]) {
  const st = handStart(seed);
  const hh = st.households[0],
    f = st.farmsteads[0],
    v = st.villages[f.village],
    tile = v.wood.find((t) => st.w.trees[t] >= 3);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { fell: tile, n: 2 }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { firewood: f.house }), true);
  let home = null,
    at = null;
  for (let i = 0; i < 8 * 240 && at === null; i++) {
    Sim.advance(st, 0.1);
    if (home === null && hh.timber > 0) home = st.t;
    if (home !== null && st.jobs.has(`firewood:h${hh.id}`)) at = st.t;
  }
  assert(home !== null && at !== null, `seed ${seed}: timber home and its cutting posted`);
  assert(at - home <= 12, `seed ${seed}: the cutting posted ${(at - home).toFixed(1)} hours after the timber came home`);
  sound(st, 'the cutting asked for');
}
console.log('handplan ok: one reckoning of the fire; by hand, the outlook counts what the plan covers and says what it left out; no stone work by the head\'s own rule while held off; the cutting asked for at once');
