// The player's plan (VB-1618; sim/playerplan, the feeder in sim/player's playerStep): its ops and their refusals; with automatic behaviour
// off, the routine seen to once a day in order, the tasks in their order, a command queued by hand first, sleep by the plan's hours, a
// task finished leaving the plan; a clearing of more than a day taken up again after a night slept; a save keeps the plan and goes on the
// same; with automatic behaviour on, the plan is kept and not followed. On the tiny village of tests/player.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { DAY } = VB['sim/rules'], { PLAN_MAX } = VB['sim/playerplan'];
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
const played = (st) => { Sim.inhabit(st, FARMER); Sim.setAuto(st, false); return st; };
const head = (st) => st.player.queue[0];

// 1. The ops and their refusals.
{
  const st = make();
  assert.match(String(Sim.plan(st, 'add', { key: 'clear:f0' })), /no pawn is played/);
  assert.strictEqual(Sim.planView(st), null);
  played(st);
  assert.deepStrictEqual(Sim.planView(st).tasks, [], 'no plan reads as empty');
  assert.strictEqual(st.player.plan, undefined, 'nothing is written until the player plans');
  assert.match(String(Sim.plan(st, 'add', { key: 'nothing' })), /no job nothing/);
  const other = [...st.jobs.values()].find((j) => j.owner.type === 'household' && j.owner.id !== 0 && j.kind === 'plow');
  assert.match(String(Sim.plan(st, 'add', { key: other.key })), /not the pawn's to take/, 'a neighbour\'s ploughing is not its to take');
  assert.strictEqual(Sim.plan(st, 'add', { key: 'clear:f0' }), true);
  assert.match(String(Sim.plan(st, 'add', { key: 'clear:f0' })), /already planned/);
  assert.strictEqual(Sim.plan(st, 'add', { key: 'plow:f0.1', at: 0 }), true, 'added at the head');
  assert.match(String(Sim.plan(st, 'add', { key: 'plow:f0.2', at: 5 })), /no place 5/);
  assert.strictEqual(Sim.plan(st, 'add', { key: 'plow:f0.2' }), true);
  assert.deepStrictEqual(st.player.plan.tasks.map((t) => t.key), ['plow:f0.1', 'clear:f0', 'plow:f0.2']);
  assert.deepStrictEqual(st.player.plan.tasks[1], { key: 'clear:f0', kind: 'clear', site: st.jobs.get('clear:f0').site });
  assert.strictEqual(Sim.plan(st, 'move', { from: 2, to: 0 }), true);
  assert.deepStrictEqual(st.player.plan.tasks.map((t) => t.key), ['plow:f0.2', 'plow:f0.1', 'clear:f0'], 'moved, the order kept');
  assert.match(String(Sim.plan(st, 'move', { from: 0, to: 3 })), /cannot move/);
  assert.match(String(Sim.plan(st, 'remove', { i: 3 })), /no task 3/);
  assert.strictEqual(Sim.plan(st, 'remove', { i: 1 }), true);
  assert.deepStrictEqual(st.player.plan.tasks.map((t) => t.key), ['plow:f0.2', 'clear:f0']);
  assert.match(String(Sim.plan(st, 'routine', { kinds: ['water', 'nap'] })), /no job kind nap/);
  assert.match(String(Sim.plan(st, 'routine', { kinds: ['water', 'water'] })), /twice/);
  assert.match(String(Sim.plan(st, 'routine', { kinds: 'water' })), /list of job kinds/);
  assert.strictEqual(Sim.plan(st, 'routine', { kinds: ['water', 'wood'] }), true);
  assert.match(String(Sim.plan(st, 'sleep', { from: 22, until: 22 })), /cannot sleep/);
  assert.match(String(Sim.plan(st, 'sleep', { from: 22, until: 24 })), /cannot sleep/);
  assert.strictEqual(Sim.plan(st, 'sleep', { from: 22, until: 6 }), true);
  assert.strictEqual(Sim.plan(st, 'sleep', null), true);
  assert.strictEqual(st.player.plan.sleep, null);
  assert.match(String(Sim.plan(st, 'nap', {})), /no plan op nap/);
  const full = st.player.plan.tasks.slice();
  while (st.player.plan.tasks.length < PLAN_MAX) st.player.plan.tasks.push({ key: `x${st.player.plan.tasks.length}`, kind: 'clear', site: -1 });
  assert.match(String(Sim.plan(st, 'add', { key: 'plow:f0.1' })), /plan is full/);
  st.player.plan.tasks = full;
  const v = Sim.planView(st);
  assert.deepStrictEqual(v.routine.map((r) => [r.kind, r.done]), [['water', false], ['wood', false]]);
  assert.ok(v.routine[1].open && v.tasks.every((t) => t.stands) && v.now === null && v.followed);
  sound(st, 'planned');
}

// 2. Followed: the routine first, in order, each kind once a day; then the tasks in order; a finished task leaves the plan; sleep by
// the plan's hours, and the routine again the next morning.
{
  const st = played(make());
  Sim.plan(st, 'routine', { kinds: ['water', 'wood'] });
  Sim.plan(st, 'add', { key: 'clear:f0' });
  Sim.plan(st, 'sleep', { from: 22, until: 6 });
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
  assert.ok(st.player.plan.tasks.length === 0, 'the cleared task leaves the plan (a fresh clearing may be posted under its key since)');
  assert.deepStrictEqual([st.player.plan.last.key, st.player.plan.last.kind], ['clear:f0', 'clear']);
  const sleeps = begun.filter((b) => b[1] === 'sleep');
  assert.ok(sleeps.length >= 1 && sleeps.every((b) => b[3] >= 22), `sleep at the plan's hour: ${JSON.stringify(sleeps)}`);
  assert.ok(begun.every((b) => b[1] !== 'routine' || (b[3] >= 6 && b[3] < 22)), 'no work in the sleeping hours');
  sound(st, 'followed');
}

// 3. A command queued by hand goes first: the plan's work gives way, stays planned and is taken up after it; and with automatic behaviour
// on the plan is kept and not followed.
{
  const st = played(make());
  Sim.plan(st, 'add', { key: 'clear:f0' });
  Sim.advance(st, 0.1);
  assert.strictEqual(head(st).plan.from, 'task');
  Sim.queue(st, { actor: FARMER, verb: 'walkTo', target: st.villages[0].center });
  Sim.advance(st, 0.1);
  assert.ok(st.player.queue.length === 1 && !head(st).plan && head(st).verb === 'walkTo', 'the hand command goes first');
  assert.strictEqual(Sim.planView(st).next, null, 'the plan waits for it');
  assert.deepStrictEqual(st.player.plan.tasks.map((t) => t.key), ['clear:f0'], 'the task stays planned');
  let n = 0;
  while (st.player.queue.length && !head(st).plan && n++ < 200) Sim.advance(st, 0.1);
  Sim.advance(st, 0.1);
  assert.ok(head(st).plan && head(st).plan.key === 'clear:f0', 'the task is taken up again after it');
  Sim.setAuto(st, true);
  Sim.advance(st, 2);
  assert.ok(st.player.queue.every((c) => c.begun !== null || !c.plan), 'with automatic behaviour on nothing more is fed');
  assert.strictEqual(st.player.plan.tasks.length + (st.jobs.has('clear:f0') ? 0 : 1), 1, 'the plan is kept');
  sound(st, 'hand first');
}

// 4. Work ordered by hand is not broken off by the sleeping hours: a night worked; the plan's sleep follows once it ends.
{
  const st = played(make());
  Sim.plan(st, 'sleep', { from: 20, until: 6 });
  until(st, 19.5);
  st.player.queue.length = 0;
  Sim.queue(st, { actor: FARMER, verb: 'work', target: 'clear:f0' });
  until(st, 21);
  assert.ok(head(st) && !head(st).plan && head(st).verb === 'work' && st.agents[FARMER].job, 'the hand-ordered work goes on at 21');
  Sim.unqueue(st, 0);
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
  Sim.plan(st, 'add', { key: 'clear:f0' });
  Sim.plan(st, 'sleep', { from: 22, until: 6 });
  until(st, 21.9);
  assert.ok(st.agents[FARMER].job === j && head(st).plan.from === 'task', 'at the clearing after the end of work');
  until(st, 23);
  assert.ok(!st.agents[FARMER].job && head(st).plan.from === 'sleep' && st.player.sleep.asleep, 'asleep by the plan\'s hours');
  const night = j.done;
  assert.ok(night > 0 && night < j.hours, `the clearing half done: ${night}`);
  until(st, 5.9);
  assert.strictEqual(j.done, night, 'the clearing keeps its progress over the night');
  until(st, 6);
  Sim.advance(st, 0.2);
  assert.ok(st.player.sleep.owed < 1, `the hours owed near zero in the morning: ${st.player.sleep.owed}`);
  assert.ok(head(st).plan.key === 'clear:f0' && st.agents[FARMER].job === j, 'the clearing taken up again in the morning');
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.strictEqual(canon(back.player.plan), canon(st.player.plan), 'the plan comes back as saved');
  Sim.advance(st, 20);
  Sim.advance(back, 20);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree');
  assert.ok(st.player.plan.tasks.length === 0 && st.player.plan.last.key === 'clear:f0' && st.player.plan.last.t < 2 * DAY, 'the clearing done on the second day');
  sound(st, 'over two days');
  sound(back, 'loaded');
}
// 6. VB-1621: a plant task, one field carried from its clearing to its sowing. Its refusals; on the project's tile, the clearing, the
// breaking, the hoeing and the sowing taken in that order with no further act of the player, the pawn going on to the next task while a
// step's job is not posted yet; on a field already broken, the hoeing and the sowing only; the task leaves once the field is sown; a save
// and a load go on the same; a window shut with the field unsown drops it.
{
  const PLANT = ['clear', 'break', 'plow', 'sow'];
  const st = played(make());
  const f = st.farmsteads[0], site = st.jobs.get('clear:f0').site, broken = f.fields[0].tile;
  assert.match(String(Sim.plan(st, 'add', { plant: 5 })), /no field of the household's nor a field project at 5/);
  const theirs = st.farmsteads[1].fields[0].tile;
  assert.match(String(Sim.plan(st, 'add', { plant: theirs })), /no field of the household's/, 'a neighbour\'s field is not its to plant');
  assert.strictEqual(Sim.plan(st, 'add', { plant: site }), true, 'the project\'s tile, its clearing posted');
  assert.match(String(Sim.plan(st, 'add', { plant: site })), /already planned/);
  assert.strictEqual(Sim.plan(st, 'add', { plant: broken }), true, 'a field broken, in stubble, in its window');
  assert.match(String(Sim.plan(st, 'add', { plant: broken, at: 3 })), /already planned/);
  assert.deepStrictEqual(st.player.plan.tasks[0], { plant: site, kind: 'plant', site });
  const v = Sim.planView(st).tasks;
  assert.deepStrictEqual(v.map((t) => [t.kind, t.plant, t.step, t.stands]), [['plant', site, 'clear', true], ['plant', broken, 'plow', true]]);
  const begun = [];
  let seen = null, saved = null, stood = false;
  for (let i = 0; i < 10 * 24 * 6 && st.player.plan.tasks.length; i++) {
    Sim.advance(st, 0.1);
    const c = head(st);
    if (c && c.plan && c.plan.from === 'task' && c.begun !== null && c !== seen) {
      seen = c;
      begun.push([c.plan.plant, c.plan.kind, c.plan.key]);
      if (c.plan.kind === 'break' && !saved) saved = JSON.parse(JSON.stringify(Sim.save(st)));
    }
    const t0 = Sim.planView(st).tasks.find((t) => t.plant === site);
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
  assert.strictEqual(st.player.plan.tasks.length, 0);
  assert.deepStrictEqual([st.player.plan.last.plant, st.player.plan.last.kind, st.player.plan.last.which], [site, 'plant', 'sown']);
  assert.match(String(Sim.plan(st, 'add', { plant: site })), /is sown/, 'a sown field is refused');
  sound(st, 'planted');
  // the run saved at the breaking goes on the same
  const back = Sim.load(tinyWorld(rows), saved), again = Sim.load(tinyWorld(rows), saved);
  assert(back.player.plan.tasks.some((t) => t.plant === site), 'the loaded plan keeps the plant task');
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
  assert.strictEqual(Sim.plan(st, 'add', { plant: fd.tile }), true);
  Stores.take(st, hh, Stores.grainGood('barley'), Stores.grainOf(hh, 'barley'), 'seed');
  for (let i = 0; i < 12 * 24 * 10 && st.player.plan.tasks.length; i++) Sim.advance(st, 0.1);
  assert.deepStrictEqual([st.player.plan.last.plant, st.player.plan.last.which], [fd.tile, 'closed'], 'its window shut, the field unsown');
  assert.match(String(Sim.plan(st, 'add', { plant: fd.tile })), /barley sowing is over/, 'refused once its window has shut');
  fd.crop = 'fallow';
  assert.match(String(Sim.plan(st, 'add', { plant: fd.tile })), /lies fallow/);
}
console.log('plan: ops and refusals; the routine once a day in order, the tasks in order, a finished task leaves; hand commands first; '
  + 'sleep by the plan\'s hours, a night worked by hand; a clearing over two days; saved and loaded; a plant task from clearing to '
  + 'sowing, shorter on a broken field, dropped when its window shuts');
