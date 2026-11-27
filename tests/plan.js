// A pawn's plan (VB-1646; steps of its plan record since VB-1754, sim/steps; the feeder in sim/controller's queueStep): its ops and their refusals; with automatic behaviour
// off, the routine seen to once a day in order, the tasks in their order, a command queued by hand first, sleep by the plan's hours, a
// task finished leaving the plan; a clearing of more than a day taken up again after a night slept; a save keeps the plan and goes on the
// same; with automatic behaviour on, the plan is kept and not followed. On the tiny village of tests/player.js.
const assert = require('assert');
const { targets: TG, season: SP } = require('./lib/season.js');
const VB = require('../src/load.js'), Sim = VB.sim, { DAY } = VB['sim/rules'], { PLAN_MAX } = VB['sim/controller'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours = 3) => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  if (hours) Sim.advance(st, hours);
  return st;
};
const hour = (st) => Sim.cal(st.t).hour;
const until = (st, h) => { while (Math.abs(hour(st) - h) > 1e-6) Sim.advance(st, 0.1); };
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const FARMER = 0;
const played = (st) => { Sim.inhabit(st, FARMER); Sim.setAuto(st, st.player.pawn, false); return st; };
const head = (st) => Sim.controlOf(st, st.player.pawn).queue[0];

// 1. The ops and their refusals.
{
  const st = make();
  assert.match(String(Sim.plan(st, -1, 'add', { key: 'clear:f0' })), /there is no pawn -1/);
  assert.strictEqual(Sim.planView(st, -1), null, 'no view of no pawn');
  played(st);
  assert.deepStrictEqual(Sim.planView(st, st.player.pawn).tasks, [], 'no plan reads as empty');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn), null, 'nothing is written until the player plans');
  assert(!st.plans.pawns.has(st.player.pawn), 'no plan record of the pawn before it plans (VB-1754)');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { key: 'nothing' })), /no job nothing/);
  const other = [...st.jobs.values()].find((j) => j.owner.type === 'household' && j.owner.id !== 0 && j.kind === 'plow');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { key: other.key })), /not the pawn's to take/, 'a neighbour\'s ploughing is not its to take');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { key: 'clear:f0' }), true);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { key: 'clear:f0' })), /already planned/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { key: 'plow:f0.1', at: 0 }), true, 'added at the head');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { key: 'plow:f0.2', at: 5 })), /no place 5/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { key: 'plow:f0.2' }), true);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.map((t) => t.key), ['plow:f0.1', 'clear:f0', 'plow:f0.2']);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks[1], { key: 'clear:f0', kind: 'clear', site: st.jobs.get('clear:f0').site });
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'move', { from: 2, to: 0 }), true);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.map((t) => t.key), ['plow:f0.2', 'plow:f0.1', 'clear:f0'], 'moved, the order kept');
  assert.match(String(Sim.plan(st, st.player.pawn, 'move', { from: 0, to: 3 })), /cannot move/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'remove', { i: 3 })), /no task 3/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'remove', { i: 1 }), true);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.map((t) => t.key), ['plow:f0.2', 'clear:f0']);
  assert.match(String(Sim.plan(st, st.player.pawn, 'routine', { kinds: ['water', 'nap'] })), /no job kind nap/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'routine', { kinds: ['water', 'water'] })), /twice/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'routine', { kinds: 'water' })), /list of job kinds/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'routine', { kinds: ['water', 'wood'] }), true);
  assert.match(String(Sim.plan(st, st.player.pawn, 'sleep', { from: 22, until: 22 })), /cannot sleep/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'sleep', { from: 22, until: 24 })), /cannot sleep/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 22, until: 6 }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', null), true);
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).sleep, null);
  assert.match(String(Sim.plan(st, st.player.pawn, 'nap', {})), /no plan op nap/);
  const n0 = VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length;
  for (let n = n0; n < PLAN_MAX; n++) VB['sim/steps'].addTask(st, st.player.pawn, { key: `x${n}`, kind: 'clear', site: -1 }, n, {});
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { key: 'plow:f0.1' })), /plan is full/);
  for (let n = PLAN_MAX - 1; n >= n0; n--) VB['sim/steps'].dropTask(st, st.player.pawn, n, null);
  const v = Sim.planView(st, st.player.pawn);
  assert.deepStrictEqual(v.routine.map((r) => [r.kind, r.done]), [['water', false], ['wood', false]]);
  assert.ok(v.routine[1].open && v.tasks.every((t) => t.stands) && v.now === null && v.followed);
  sound(st, 'planned');
}

// 2. Followed: the routine first, in order, each kind once a day; then the tasks in order; a finished task leaves the plan; sleep by
// the plan's hours, and the routine again the next morning.
{
  const st = played(make());
  Sim.plan(st, st.player.pawn, 'routine', { kinds: ['water', 'wood'] });
  Sim.plan(st, st.player.pawn, 'add', { key: 'clear:f0' });
  Sim.plan(st, st.player.pawn, 'sleep', { from: 22, until: 6 });
  const begun = [];
  let seen = null;
  for (let i = 0; i < 10 * 46; i++) {
    Sim.advance(st, 0.1);
    const c = head(st);
    if (c && c.plan && c.begun !== null && c !== seen) {
      seen = c;
      begun.push([Math.floor(st.t / DAY), c.plan.from, c.plan.kind, hour(st)]);
    }
  }
  const day = (d) => begun.filter((b) => b[0] === d && b[1] === 'routine').map((b) => b[2]);
  assert.deepStrictEqual(day(0), ['wood'], 'no water is posted on the first morning: wood, once');
  assert.deepStrictEqual(day(1), ['water', 'wood'], 'the next day: the routine once each, in order');
  const task = begun.find((b) => b[1] === 'task');
  assert.ok(task && task[0] === 0 && task[2] === 'clear', 'then the task');
  assert.ok(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length === 0, 'the cleared task leaves the plan (a fresh clearing may be posted under its key since)');
  assert.deepStrictEqual([VB['sim/steps'].pawnPlan(st, st.player.pawn).last.key, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.kind], ['clear:f0', 'clear']);
  const sleeps = begun.filter((b) => b[1] === 'sleep');
  assert.ok(sleeps.length >= 1 && sleeps.every((b) => b[3] >= 22), `sleep at the plan's hour: ${JSON.stringify(sleeps)}`);
  assert.ok(begun.every((b) => b[1] !== 'routine' || (b[3] >= 6 && b[3] < 22)), 'no work in the sleeping hours');
  sound(st, 'followed');
}

// 3. A command queued by hand goes first: the plan's work gives way, stays planned and is taken up after it; and with automatic behaviour
// on the plan is kept and not followed.
{
  const st = played(make());
  Sim.plan(st, st.player.pawn, 'add', { key: 'clear:f0' });
  Sim.advance(st, 0.1);
  assert.strictEqual(head(st).plan.from, 'task');
  Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'walkTo', target: st.villages[0].center });
  Sim.advance(st, 0.1);
  assert.ok(Sim.controlOf(st, st.player.pawn).queue.length === 1 && !head(st).plan && head(st).verb === 'walkTo', 'the hand command goes first');
  assert.strictEqual(Sim.planView(st, st.player.pawn).next, null, 'the plan waits for it');
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.map((t) => t.key), ['clear:f0'], 'the task stays planned');
  let n = 0;
  while (Sim.controlOf(st, st.player.pawn).queue.length && !head(st).plan && n++ < 200) Sim.advance(st, 0.1);
  Sim.advance(st, 0.1);
  assert.ok(head(st).plan && head(st).plan.key === 'clear:f0', 'the task is taken up again after it');
  Sim.setAuto(st, st.player.pawn, true);
  Sim.advance(st, 2);
  assert.ok(Sim.controlOf(st, st.player.pawn).queue.every((c) => c.begun !== null || !c.plan), 'with automatic behaviour on nothing more is fed');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length + (st.jobs.has('clear:f0') ? 0 : 1), 1, 'the plan is kept');
  sound(st, 'hand first');
}

// 4. Work ordered by hand is not broken off by the sleeping hours: a night worked; the plan's sleep follows once it ends.
{
  const st = played(make());
  // a clearing long enough to stand at 21 (VB-1758: the members slotted to it in the day would finish its 40 hours by the evening)
  st.jobs.get('clear:f0').hours = 400;
  Sim.plan(st, st.player.pawn, 'sleep', { from: 20, until: 6 });
  until(st, 19.5);
  Sim.controlOf(st, st.player.pawn).queue.length = 0;
  Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'work', target: 'clear:f0' });
  until(st, 21);
  assert.ok(head(st) && !head(st).plan && head(st).verb === 'work' && st.agents[FARMER].job, 'the hand-ordered work goes on at 21');
  Sim.unqueue(st, st.player.pawn, 0);
  Sim.advance(st, 0.2);
  assert.ok(head(st) && head(st).plan.from === 'sleep' && !st.agents[FARMER].job, 'then the plan sends it to sleep');
  sound(st, 'a night worked');
}

// 5. A clearing of more than a day's hours, alone after the end of work: worked to the plan's bedtime, a night slept, taken up again in
// the morning without the player's doing, the hours owed back near zero; and a save and a load keep the plan and go on the same.
{
  const st = played(make());
  const j = st.jobs.get('clear:f0');
  j.hours = 40;
  Sim.plan(st, st.player.pawn, 'add', { key: 'clear:f0' });
  Sim.plan(st, st.player.pawn, 'sleep', { from: 22, until: 6 });
  until(st, 21.9);
  assert.ok(st.agents[FARMER].job === j && head(st).plan.from === 'task', 'at the clearing after the end of work');
  until(st, 23);
  assert.ok(!st.agents[FARMER].job && head(st).plan.from === 'sleep' && st.pawns[FARMER].sleep.asleep, 'asleep by the plan\'s hours');
  const night = j.done;
  assert.ok(night > 0 && night < j.hours, `the clearing half done: ${night}`);
  until(st, 5.9);
  assert.strictEqual(j.done, night, 'the clearing keeps its progress over the night');
  until(st, 6);
  Sim.advance(st, 0.2);
  assert.ok(st.pawns[FARMER].sleep.owed < 1, `the hours owed near zero in the morning: ${st.pawns[FARMER].sleep.owed}`);
  // VB-1755: a daily task the household's day leaves unmanned (the water) goes first; then the clearing
  for (let i = 0; i < 30 && head(st) && head(st).plan && head(st).plan.from === 'vital'; i++) Sim.advance(st, 0.1);
  assert.ok(head(st).plan.key === 'clear:f0' && st.agents[FARMER].job === j, 'the clearing taken up again in the morning');
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.strictEqual(canon(VB['sim/steps'].pawnPlan(back, back.player.pawn)), canon(VB['sim/steps'].pawnPlan(st, st.player.pawn)), 'the plan comes back as saved');
  Sim.advance(st, 20);
  Sim.advance(back, 20);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree');
  assert.ok(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length === 0 && VB['sim/steps'].pawnPlan(st, st.player.pawn).last.key === 'clear:f0' && VB['sim/steps'].pawnPlan(st, st.player.pawn).last.t < 2 * DAY, 'the clearing done on the second day');
  sound(st, 'over two days');
  sound(back, 'loaded');
}
// 6. VB-1649: a plant task, one field carried from its clearing to its sowing. Its refusals; on the project's tile, the clearing, the
// breaking, the hoeing and the sowing taken in that order with no further act of the player, the pawn going on to the next task while a
// step's job is not posted yet; on a field already broken, the hoeing and the sowing only; the task leaves once the field is sown; a save
// and a load go on the same; a window shut with the field unsown drops it.
{
  const PLANT = ['clear', 'break', 'plow', 'sow'];
  const st = played(make());
  const f = st.farmsteads[0], site = st.jobs.get('clear:f0').site, broken = f.fields[0].tile;
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: 5 })), /no field of the household's nor a field project at 5/);
  const theirs = st.farmsteads[1].fields[0].tile;
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: theirs })), /no field of the household's/, 'a neighbour\'s field is not its to plant');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: site }), true, 'the project\'s tile, its clearing posted');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: site })), /already planned/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: broken }), true, 'a field broken, in stubble, in its window');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: broken, at: 3 })), /already planned/);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks[0], { kind: 'plant', site });
  const v = Sim.planView(st, st.player.pawn).tasks;
  assert.deepStrictEqual(v.map((t) => [t.kind, t.site, t.step, t.stands]), [['plant', site, 'clear', true], ['plant', broken, 'plow', true]]);
  const begun = [];
  let seen = null, saved = null, stood = false;
  for (let i = 0; i < 10 * 24 * 6 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length; i++) {
    Sim.advance(st, 0.1);
    const c = head(st);
    if (c && c.plan && c.plan.from === 'task' && c.begun !== null && c !== seen) {
      seen = c;
      begun.push([c.plan.site, c.plan.kind, c.plan.key]);
      if (c.plan.kind === 'break' && !saved) saved = JSON.parse(JSON.stringify(Sim.save(st)));
    }
    const t0 = Sim.planView(st, st.player.pawn).tasks.find((t) => t.site === site);
    if (t0 && !t0.stands && t0.step === 'break') stood = true;
  }
  const at = (tile) => begun.filter((b) => b[0] === tile).map((b) => b[1]);
  const order = (ks) => ks.every((k, n) => !n || PLANT.indexOf(ks[n - 1]) <= PLANT.indexOf(k));
  assert(order(at(site)) && at(site)[0] === 'clear' && at(site).includes('break') && at(site).includes('sow'), `the steps at the project's tile in order: ${at(site)}`);
  assert(at(broken).length && order(at(broken)) && at(broken).every((k) => k === 'plow' || k === 'sow'), `the broken field: its hoeing and sowing only, ${at(broken)}`);
  assert(stood, 'between the clearing and the breaking the task stood, its next job not yet posted');
  assert(begun.findIndex((b) => b[0] === broken) < begun.findIndex((b) => b[1] === 'break'), 'the pawn went on to the next task meanwhile');
  const fd = f.fields.find((x) => x.tile === site);
  assert(fd && ['sown', 'growing'].includes(fd.stage), 'the new field is sown');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length, 0);
  assert.deepStrictEqual([VB['sim/steps'].pawnPlan(st, st.player.pawn).last.site, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.kind, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which], [site, 'plant', 'sown']);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: site })), /is sown/, 'a sown field is refused');
  sound(st, 'planted');
  // the run saved at the breaking goes on the same
  const back = Sim.load(tinyWorld(rows), saved), again = Sim.load(tinyWorld(rows), saved);
  assert(VB['sim/steps'].pawnPlan(back, back.player.pawn).tasks.some((t) => t.site === site), 'the loaded plan keeps the plant task');
  Sim.advance(back, 24);
  Sim.advance(again, 12);
  Sim.advance(again, 12);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  sound(back, 'planted, loaded');
}
{
  // a window shut with the field unsown (its household's seed gone: hoed, never sown): the task leaves, kept in `last`
  const st = played(make()), Stores = VB['sim/stores'], hh = st.households[0];
  const fd = st.farmsteads[0].fields[2];
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: fd.tile }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'keep', { i: 0 }), true); // kept: the default author does not take it back (VB-1842)
  Stores.take(st, hh, Stores.grainGood('barley'), Stores.grainOf(hh, 'barley'), 'seed');
  for (let i = 0; i < 12 * 24 * 10 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length; i++) Sim.advance(st, 0.1);
  assert.deepStrictEqual([VB['sim/steps'].pawnPlan(st, st.player.pawn).last.site, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which], [fd.tile, 'closed'], 'its window shut, the field unsown');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: fd.tile })), /barley sowing is over/, 'refused once its window has shut');
  fd.crop = 'fallow';
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: fd.tile })), /lies fallow/);
}
// 7. VB-1650: the chains hay and harvest, and a marked tile. With herds and meadows, the played farmer alone (the others' hands would do
// its tasks before it): the gaps of the sowing listed and one gone once planned; a hay task added in spring stands until the mowing is
// posted, then carries the meadow from its mowing to its hay home with no further act; a harvest task added in summer waits for the
// crop to ripen, then reaps it and brings the sheaves in; the refusals; a save and a load go on the same.
const alone = (opt) => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4, ...opt });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  for (const p of st.pawns) if (p.id !== FARMER && p.alive) VB['sim/lifecycle'].killPawn(st, p.id);
  Sim.advance(st, 0.1);
  return played(st);
};
const chainRun = (st, stop, steps = 40 * 24 * 10) => {
  const begun = [];
  let seen = null;
  for (let i = 0; i < steps && !stop(st); i++) {
    Sim.advance(st, 0.1);
    const c = head(st);
    if (c && c.plan && c.plan.from === 'task' && c.begun !== null && c !== seen) {
      seen = c;
      begun.push([c.plan.goal, c.plan.site, c.plan.kind]);
    }
  }
  return begun;
};
{
  const st = alone({ herds: true }), f = st.farmsteads[0], m = f.meadows[0], fd = f.fields[0];
  assert.strictEqual(st.households[0].holder, FARMER, 'the farmer is the head');
  const gaps = Sim.planGaps(st, st.player.pawn);
  assert(gaps.some((g) => g.goal === 'plant' && g.tile === fd.tile && /barley sowing/.test(g.deadline.what) && g.days >= 0), JSON.stringify(gaps));
  assert(gaps.every((g, n) => !n || gaps[n - 1].deadline.t <= g.deadline.t), 'by deadline');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: fd.tile }), true);
  assert(!Sim.planGaps(st, st.player.pawn).some((g) => g.tile === fd.tile), 'the field planned is no gap');
  // the refusals
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { hay: fd.tile })), /no meadow of the household's nor a meadow project at/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { harvest: m.tile })), /no field of the household's at/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { harvest: fd.tile })), /is not sown/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { harvest: st.farmsteads[1].fields[0].tile })), /no field of the household's/, 'a neighbour\'s field');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { hay: m.tile }), true, 'a hay task added before the haymaking');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'keep', { i: 1 }), true); // kept through the spring (VB-1842)
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { hay: m.tile, at: 0 })), /meadow at \d+ is already planned/);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks[1], { kind: 'hay', site: m.tile });
  const hv = Sim.planView(st, st.player.pawn).tasks[1];
  assert.deepStrictEqual([hv.kind, hv.site, hv.step, hv.stands], ['hay', m.tile, 'mow', false], 'it stands, its mowing not posted');
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const summer = (s) => Sim.cal(s.t).season >= 1;
  const sown = chainRun(st, summer);
  assert(sown.some((b) => b[0] === 'plant' && b[2] === 'sow') && SOWN(fd), `the field sown on the way: ${fd.stage}`);
  assert(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.some((t) => t.site === m.tile), 'the hay task stood through the spring');
  // the harvest task added in summer: it waits
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { harvest: fd.tile }), true);
  const rv = Sim.planView(st, st.player.pawn).tasks.find((t) => t.kind === 'harvest');
  assert.deepStrictEqual([rv.site, rv.step, rv.stands], [fd.tile, 'reap', false]);
  const hay = chainRun(st, (s) => !VB['sim/steps'].pawnPlan(s, s.player.pawn).tasks.some((t) => t.kind === 'hay'));
  const at = (b, k) => b.filter((x) => x[0] === k).map((x) => x[2]);
  assert(at(hay, 'hay')[0] === 'mow' && at(hay, 'hay').includes('hay') && at(hay, 'hay').every((k, n) => k === 'mow' ? !at(hay, 'hay').slice(0, n).includes('hay') : k === 'hay'), `mown, then its hay carried: ${at(hay, 'hay')}`);
  assert.strictEqual(m.stage, 'aftermath');
  assert.deepStrictEqual([VB['sim/steps'].pawnPlan(st, st.player.pawn).last.site, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.kind, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which], [m.tile, 'hay', 'home']);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { hay: m.tile })), /hay of the meadow at \d+ is in/);
  assert(!hay.some((b) => b[0] === 'harvest'), 'the harvest waited');
  sound(st, 'hay home');
  // the crop brought on to ripen in a few days (a constructed state: the year's draw would ripen it in autumn)
  fd.sown -= 12;
  const reaped = chainRun(st, (s) => !VB['sim/steps'].pawnPlan(s, s.player.pawn).tasks.some((t) => t.kind === 'harvest'));
  assert(at(reaped, 'harvest')[0] === 'reap' && at(reaped, 'harvest').includes('haul'), `reaped, then its sheaves carried: ${at(reaped, 'harvest')}`);
  assert.deepStrictEqual([VB['sim/steps'].pawnPlan(st, st.player.pawn).last.site, VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which], [fd.tile, 'in'], JSON.stringify(VB['sim/steps'].pawnPlan(st, st.player.pawn).last));
  assert.strictEqual(fd.stage, 'stubble');
  assert(st.households[0].unthreshed.length > 0, 'the sheaves in the barn');
  sound(st, 'harvest in');
  // the run saved in spring goes on the same
  const back = Sim.load(tinyWorld(rows), saved), again = Sim.load(tinyWorld(rows), saved);
  Sim.advance(back, 48);
  Sim.advance(again, 24);
  Sim.advance(again, 24);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  sound(back, 'chains, loaded');
}
function SOWN(fd) { return ['sown', 'growing'].includes(fd.stage); }
// A marked tile: the head names the tile of its next field (sim/plans' verb `tile`) while a field project is open; a plant task there is
// accepted for the head only, stands, and when the open project is done the feeder begins the new one through the head's verb `project`.
{
  const st = alone(), f = st.farmsteads[0], hh = st.households[0];
  st.jobs.get('clear:f0').hours = 8;
  const tile = VB['sim/fieldplans'].pickField(st, f, hh);
  assert(tile >= 0 && VB['sim/projects'].ownOf(st, 0), 'a field project open, and a tile for the next');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: -1 })), /no tile -1/, 'a tile under 0 refused (VB-1651)');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: st.farmsteads[1].house })), /no field of the household's nor a field project at \d+ \(/, 'a tile the head\'s verb refuses, with its reason');
  assert.strictEqual(Sim.command(st, { actor: FARMER, verb: 'tile', target: 0, args: { what: 'field', tile }, source: 'player' }), true);
  hh.holder = null;
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { plant: tile })), /pawn 0 is not the head of the household/, 'refused for one not the head');
  hh.holder = FARMER;
  const site = st.jobs.get('clear:f0').site;
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: site }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: tile }), true, 'the marked tile');
  const v = Sim.planView(st, st.player.pawn).tasks[1];
  assert.deepStrictEqual([v.site, v.step, v.stands], [tile, VB['sim/fieldplans'].fieldProject(st, hh, tile).steps[0].kind, false]);
  const begun = chainRun(st, () => VB['sim/projects'].projectsOf(st, 'household', 0).some((p) => p.what === 'field' && p.steps.some((s) => s.place === tile)), 10 * 24 * 10);
  const p = VB['sim/projects'].projectsOf(st, 'household', 0).find((q) => q.steps[q.open].place === tile);
  assert(p && p.side && VB['sim/projects'].ownOf(st, 0) !== p, 'the project at the marked tile begun beside the first (VB-1651)');
  Sim.advance(st, 0.2);
  assert(begun.some((b) => b[1] === site && b[2] === 'clear'), 'after the first task\'s clearing, not waiting for its project to end');
  assert(begun.some((b) => b[1] === tile && b[2] === 'project'), `begun by the feeder through the head's verb: ${JSON.stringify(begun)}`);
  assert(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.some((t) => t.site === tile) && Sim.planView(st, st.player.pawn).tasks.find((t) => t.site === tile).step === p.steps[p.open].kind, 'the task goes on with its project');
  assert.strictEqual(st.plans.households.get(0).tiles.field, -1, 'the mark used');
  sound(st, 'marked');
}
// 8. VB-1651: the stall. The played head's household has a field project open that no task covers, automatic behaviour off; plant tasks on
// two more tiles (no mark) and a hay task on a fourth: each begun beside the others (their jobs keyed apart, headView().projects), both
// fields sown and the hay home, the open project left as it was and nothing begun by the household's own rule; why each task waits on
// the way, and the agenda laying none before its reason allows; a save and a load go on the same. An unplayed head keeps the limit of one.
{
  const P = VB['sim/projects'], { VERBS } = VB['sim/commands'], WHYS = Object.keys(VB['sim/controller'].WAITS);
  const st = alone({ herds: true }), f = st.farmsteads[0], hh = st.households[0];
  const old = f.fields.map((fd) => [fd, fd.crop]);
  for (const fd of f.fields) fd.crop = 'fallow'; // the settler's hands till the new fields (sim/fieldwork underHands); put back below
  const first = P.ownOf(st, 0), site = first.steps[first.open].place;
  const may = (what, tile, source = 'player', actor = FARMER, target = 0) =>
    VERBS.project.check(st, { actor, verb: 'project', target, args: { what, tile }, source });
  const pick = (what, not) => {
    for (let t = 0; t < st.w.N; t++) if (!not.includes(t) && may(what, t) === null) return t;
    return -1;
  };
  const a = pick('field', [site]), b = pick('field', [site, a]), m = pick('meadow', [site, a, b]);
  assert(a >= 0 && b >= 0 && m >= 0, `tiles for two fields and a meadow beside the open project: ${[a, b, m]}`);
  assert.strictEqual(may('field', a, 'pawn'), null, 'the check refuses no second for the holder\'s own rule either (VB-1668)');
  assert.match(String(may('field', site)), /under way at/, 'one project a tile');
  // the head unplayed is not refused a second either (VB-1668): its land step keeps its prudence of one
  Sim.uninhabit(st);
  assert.strictEqual(may('field', a), null, 'an unplayed head\'s verb begins a second');
  played(st);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: a }), true, 'no mark needed');
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: b }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { hay: m }), true);
  let v = Sim.planView(st, st.player.pawn);
  assert.deepStrictEqual(v.tasks.map((t) => t.waits), [null, { why: 'before', i: 0 }, { why: 'before', i: 0 }]);
  assert.strictEqual(v.idle, null);
  // refused: the head's own check (the pawn no longer the head)
  hh.holder = null;
  v = Sim.planView(st, st.player.pawn);
  assert(v.tasks.every((t) => t.waits.why === 'refused' && /no field|no meadow/.test(t.waits.text)), JSON.stringify(v.tasks));
  assert.deepStrictEqual(v.idle, v.tasks[0].waits, 'the plan idle, for its first task\'s reason');
  assert(!Sim.agenda(st, st.player.pawn).days.flat().some((g) => g.what === 'task'), 'a refused task is not laid');
  hh.holder = FARMER;
  // routine: a kind seen to every day goes first
  const rk = [...st.jobsBy.get('household:0')].find((j) => VERBS.work.check(st, { actor: FARMER, verb: 'work', target: j.key, args: null, source: 'player' }) === null && !/clear/.test(j.kind));
  assert(rk, 'a routine kind to go first');
  {
    Sim.plan(st, st.player.pawn, 'routine', { kinds: [rk.kind] });
    assert.deepStrictEqual(Sim.planView(st, st.player.pawn).tasks[0].waits, { why: 'routine', kind: rk.kind });
    Sim.plan(st, st.player.pawn, 'routine', { kinds: [] });
  }
  // sleep: the sleeping hours
  const h = Math.floor(hour(st));
  Sim.plan(st, st.player.pawn, 'sleep', { from: h, until: (h + 2) % 24 });
  assert.deepStrictEqual(Sim.planView(st, st.player.pawn).tasks[1].waits, { why: 'sleep', until: (h + 2) % 24 });
  Sim.plan(st, st.player.pawn, 'sleep', null);
  // hand: a command queued by hand goes first, and holds the plan idle, named with the hour it was begun
  assert.strictEqual(Sim.queue(st, st.player.pawn, { actor: FARMER, verb: 'walkTo', target: st.villages[0].center }), true);
  v = Sim.planView(st, st.player.pawn);
  assert.deepStrictEqual(v.idle, { why: 'hand', verb: 'walkTo', target: st.villages[0].center, since: null });
  assert.deepStrictEqual(v.tasks[0].waits, v.idle);
  Sim.advance(st, 0.1);
  assert.strictEqual(Sim.planView(st, st.player.pawn).idle.since, Sim.controlOf(st, st.player.pawn).queue[0].begun);
  assert(Sim.controlOf(st, st.player.pawn).queue[0].begun !== null);
  assert.strictEqual(Sim.unqueue(st, st.player.pawn, 0), true);
  // the run: each begun in its turn beside the others
  const seen = new Set();
  const look = (s) => {
    for (const t of Sim.planView(s, s.player.pawn).tasks) if (t.waits) {
      assert(WHYS.includes(t.waits.why), `a reason of the closed list: ${t.waits.why}`);
      seen.add(t.waits.why);
      if (t.waits.why === 'opens') {
        assert(t.waits.t > s.t && typeof t.waits.what === 'string');
        assert(!Sim.agenda(s, s.player.pawn).days.flat().some((g) => g.what === 'task' && g.site === t.site && g.from < t.waits.t - 1e-6), 'laid no earlier than it opens');
      }
    }
    return false;
  };
  let saved = null,
    apart = 0; // the most land project jobs posted at once, each its own key (VB-1651: a side plan's carries its id)
  const begun = chainRun(st, (s) => {
    look(s);
    apart = Math.max(apart, [...s.jobs.values()].filter((j) => j.owner.type === 'household' && j.owner.id === 0 && P.onProject(s, j)).length);
    // begun beside the first; the fields, of its kinds, marked `side` (VB-1668: a plan of kinds of its own keeps its key)
    const beside = P.projectsOf(s, 'household', 0).filter((p) => p.id !== first.id && p.what !== 'cottage');
    if (!saved && beside.length === 3) {
      assert(beside.filter((p) => p.what === 'field').every((p) => p.side), 'the fields beside the first are keyed apart');
      const pv = Sim.headView(s, 0);
      assert.deepStrictEqual(pv.projects.map((p) => p.tile).sort(), [site, a, b, m].sort((x, y) => x - y), 'headView().projects');
      assert.deepStrictEqual(pv.project.id, first.id, 'project stays the first');
      saved = JSON.parse(JSON.stringify(Sim.save(s)));
    }
    return !VB['sim/steps'].pawnPlan(s, s.player.pawn).tasks.length;
  }, 60 * 24 * 10);
  assert(saved, 'the three begun side by side');
  assert(apart >= 3, 'several project steps posted at once, keyed apart: ' + apart);
  const on = (k, t) => begun.some((x) => x[1] === t && x[2] === k);
  assert(on('project', a) && on('project', b) && on('project', m), JSON.stringify(begun));
  assert(on('sow', a) && on('sow', b) && on('hay', m), `both fields sown and the hay home: ${JSON.stringify(begun)}`);
  const at = (t) => f.fields.find((x) => x.tile === t);
  assert(SOWN(at(a)) && SOWN(at(b)), 'both fields sown');
  assert.strictEqual(f.meadows.find((x) => x.tile === m).stage, 'aftermath');
  assert(['before', 'opens', 'unposted'].every((w) => seen.has(w)), [...seen].join());
  assert.deepStrictEqual(P.projectsOf(st, 'household', 0).filter((p) => p.what !== 'cottage').map((p) => p.id), [first.id], 'the open project left as it was, nothing begun by the household\'s own rule');
  for (const [fd, crop] of old) fd.crop = crop;
  sound(st, 'side by side');
  const back = Sim.load(tinyWorld(rows), saved), again = Sim.load(tinyWorld(rows), saved);
  Sim.advance(back, 48);
  Sim.advance(again, 24);
  Sim.advance(again, 24);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  for (const [fd, crop] of old) back.farmsteads[0].fields[fd.id].crop = crop;
  sound(back, 'side by side, loaded');
}
// 9. VB-1651: the solo start for a hand planner, with no field under way; without `hand` as before. With automatic behaviour off the
// played head's household begins no project by its own rule; on again, its land step does.
{
  const w = tinyWorld(rows), P = VB['sim/projects'];
  const st = Sim.seed(w, 7, 'solo', null, { hand: true });
  assert.deepStrictEqual(P.projectsOf(st, 'household', 0).map((p) => p.what), [], 'nothing under way, the cottage neither (VB-1655)');
  assert.deepStrictEqual(P.projectsOf(Sim.seed(tinyWorld(rows), 7, 'solo', null, {}), 'household', 0).map((p) => p.what), ['field', 'cottage']);
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  assert(P.heldOff(st, 0));
  Sim.advance(st, 72);
  assert(!P.ownOf(st, 0), 'no field begun by its own rule');
  Sim.setAuto(st, st.player.pawn, true);
  assert(!P.heldOff(st, 0));
}
// 10. VB-1652: an `unposted` task names the household's own rule that holds its job back: a plant task on a field beyond what its hands
// till shows the cap; a hay task with hay enough shows that; else the next review.
{
  const st = alone({ herds: true }), f = st.farmsteads[0], hh = st.households[0], { RULES } = VB['sim/controller'];
  const review = (s) => VB['sim/jobs'].refreshJobs(s, Sim.cal(s.t), true);
  const last = f.fields[f.fields.length - 1], m = f.meadows[0];
  for (const fd of f.fields) assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { plant: fd.tile }), true);
  const F = VB['sim/rules'].FIELDS, was = [F.perHand, F.oxenHands];
  F.perHand = 1; // the review writes the plan's targets.workable: a field a hand, fewer than its fields (a constructed state)
  F.oxenHands = 0;
  try { review(st); } finally { [F.perHand, F.oxenHands] = was; }
  const cap = TG(st.plans.households.get(0)).workable;
  assert(cap < f.fields.length, `the cap ${cap} below the fields`);
  const w = Sim.planView(st, st.player.pawn).tasks.find((t) => t.site === last.tile).waits;
  assert.deepStrictEqual([w.why, w.kind, w.rule], ['unposted', 'plow', 'hands'], JSON.stringify(w));
  assert.match(w.text, new RegExp(`hands till ${cap} fields?; the field at ${last.tile} is beyond them`));
  assert(RULES.includes(w.rule) && RULES.includes('review'), 'a rule of the closed list');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w)), w, 'plain data');
  while (VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length) Sim.plan(st, st.player.pawn, 'remove', { i: 0 });
  // the hay: in the haymaking, with the barn full
  Sim.advance(st, 300 - st.t);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { hay: m.tile }), true);
  hh.hay = 1e6;
  review(st);
  const h = Sim.planView(st, st.player.pawn).tasks[0].waits;
  assert.deepStrictEqual([h.why, h.kind, h.rule], ['unposted', 'mow', 'hay'], JSON.stringify(h));
  assert.match(h.text, /wants no more hay/);
  sound(st, 'the rules named');
}
// 11. VB-1746: an unplayed pawn's plan, driven through the keyed calls, as the played pawn's: on twin states, the farmer played in one and
// not in the other (no st.player there), the same routine, task and sleep, automatic behaviour off; the same commands begun, the same
// plan left, the same view.
{
  // VB-1754: the played pawn's through the facade Sim.plan, the unplayed one's through the verb `plan` itself, issued as any pawn issues
  // it (source 'pawn'): the same steps of the plan record
  const verb = (st, id, op, args) =>
    Sim.command(st, { actor: id, verb: 'plan', target: { kind: 'pawn', id }, args: { ...args, op }, source: 'pawn' });
  const ops = (st, id) => {
    const by = st.player ? Sim.plan : verb;
    assert.strictEqual(Sim.setAuto(st, id, false), true);
    assert.strictEqual(by(st, id, 'routine', { kinds: ['water', 'wood'] }), true);
    assert.strictEqual(by(st, id, 'add', { key: 'clear:f0' }), true);
    assert.strictEqual(by(st, id, 'sleep', { from: 22, until: 6 }), true);
  };
  const run = (st) => {
    const begun = [];
    let seen = null;
    for (let i = 0; i < 2 * 240; i++) {
      Sim.advance(st, 0.1);
      const c = Sim.controlOf(st, FARMER).queue[0];
      if (c && c.plan && c.begun !== null && c !== seen) {
        seen = c;
        begun.push([Math.floor(st.t / DAY), c.plan.from, c.plan.kind, Math.round(hour(st) * 10) / 10]);
      }
    }
    return begun;
  };
  const mine = make(), theirs = make();
  Sim.inhabit(mine, FARMER);
  ops(mine, mine.player.pawn);
  ops(theirs, FARMER);
  assert(!theirs.player && VB['sim/steps'].pawnPlan(theirs, FARMER), 'the unplayed pawn holds its plan, with no player');
  const rec = theirs.plans.pawns.get(FARMER);
  assert.deepStrictEqual(rec.ahead.map((s) => [Object.keys(s.what)[0], s.author]), [['routine', 'pawn'], ['routine', 'pawn'], ['sleep', 'pawn'], ['goal', 'pawn']], 'steps of its plan record, authored by the pawn');
  assert(!theirs.pawns[FARMER].control.plan, 'nothing of it on the controller');
  // checked by position: no pawn plans another's; a pawn that is not the head writes no step of its household's plan
  const other = theirs.pawns.findIndex((p, i) => i !== FARMER && p.alive);
  assert.match(String(Sim.command(theirs, { actor: other, verb: 'plan', target: { kind: 'pawn', id: FARMER }, args: { op: 'sleep' }, source: 'pawn' })), /plans its own plan only/);
  if (theirs.households[0].holder !== other)
    assert.match(String(Sim.command(theirs, { actor: other, verb: 'plan', target: { kind: 'household', id: 0 }, args: { op: 'target', store: 'wood', n: 1 }, source: 'pawn' })), /only its head changes its plan|no household/);
  assert.match(String(verb(theirs, FARMER, 'nap', {})), /no plan op nap/);
  // a dated task waits for its day, through the verb as through the facade
  const day = Math.floor(theirs.t / DAY) + 2;
  for (const [s, by] of [[theirs, verb], [mine, Sim.plan]]) {
    assert.match(String(by(s, FARMER, 'add', { key: 'plow:f0.1', from: day + 1, by: day })), /cannot be done by day/);
    assert.strictEqual(by(s, FARMER, 'add', { key: 'plow:f0.1', at: 0, from: day, by: day + 3 }), true);
    const w = Sim.waits(s, FARMER).tasks[0];
    assert.deepStrictEqual([w.why, w.t], ['opens', day * DAY], JSON.stringify(w));
    assert.strictEqual(by(s, FARMER, 'remove', { i: 0 }), true);
  }
  assert.deepStrictEqual(Sim.planView(theirs, FARMER), Sim.planView(mine, FARMER), 'the same view, planned');
  const a = run(mine), b = run(theirs);
  assert(b.some((x) => x[1] === 'routine') && b.some((x) => x[1] === 'task') && b.some((x) => x[1] === 'sleep'), `fed from each part: ${JSON.stringify(b)}`);
  assert.deepStrictEqual(b, a, 'the same commands begun from its plan');
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(theirs, FARMER), VB['sim/steps'].pawnPlan(mine, FARMER), 'the same plan left');
  assert.deepStrictEqual(Sim.planView(theirs, FARMER), Sim.planView(mine, FARMER), 'the same view, followed');
  assert.deepStrictEqual(Sim.waits(theirs, FARMER), Sim.waits(mine, FARMER), 'the same waits');
  sound(theirs, 'unplayed, planned');
  // a task at a tile no one has marked (VB-1651: the head's own verb begins its field there), the unplayed head's as the played one's:
  // kept, not dropped as gone at the next step (review of VB-1746, F1)
  const free = 38, twins = [make(), make()];
  Sim.inhabit(twins[0], FARMER);
  for (const s of twins) {
    assert.strictEqual(Sim.setAuto(s, FARMER, false), true);
    assert.strictEqual(s.plans.households.get(0).tiles?.field === free, false, 'the tile unmarked');
    assert.strictEqual(Sim.plan(s, FARMER, 'add', { plant: free }), true);
    Sim.advance(s, 0.2);
  }
  const [pm, pt] = twins.map((s) => VB['sim/steps'].pawnPlan(s, FARMER));
  assert.deepStrictEqual(pm.tasks.map((t) => t.site), [free], 'the played head keeps its task');
  assert.deepStrictEqual(pt, pm, 'the unplayed head keeps it as well');
  for (let i = 0; i < 40; i++) for (const s of twins) Sim.advance(s, 0.1);
  const [am, at] = twins.map((s) => VB['sim/steps'].pawnPlan(s, FARMER));
  assert(am && at, 'both still hold a plan record');
  assert.deepStrictEqual(at, am, 'and goes on with it the same');
  assert.deepStrictEqual(structuredClone(VB['sim/plans'].headView(twins[1], twins[1].pawns[FARMER].household ?? 0)), VB['sim/plans'].headView(twins[1], twins[1].pawns[FARMER].household ?? 0), 'the head\'s view is plain data');
  assert.deepStrictEqual(Sim.planView(twins[1], FARMER), Sim.planView(twins[0], FARMER), 'the same view of it');
}
console.log('plan: ops and refusals; the routine once a day in order, the tasks in order, a finished task leaves; hand commands first; '
  + 'sleep by the plan\'s hours, a night worked by hand; a clearing over two days; saved and loaded; a plant task from clearing to '
  + 'sowing, shorter on a broken field, dropped when its window shuts; a hay task from mowing to hay home, a harvest task from reaping '
  + 'to the sheaves in, the gaps; a marked tile\'s project begun by the head\'s verb; fields and a meadow begun side by side by the '
  + 'played head, why each task waits; the hand start; the household\'s rule that holds a step back; an unplayed pawn\'s plan as the played one\'s');
