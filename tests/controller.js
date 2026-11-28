// @suite fast
// A controller per pawn (VB-1745; docs/plans/four-scales/README.md, section 4, the path's step 2): an empty controller on every pawn
// (automatic on, nothing queued) runs to the same state as none, but for the controller records; two pawns with automatic behaviour off
// at once are both left alone by the planner; any pawn's queue runs, from the index of the queues that hold a command; the verbs refuse
// what is not the pawn's; a death ends the controller; a save keeps them.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { QUEUE_MAX, controlOf } = VB['sim/controller'];
const { issue } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours = 0) => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  if (hours) Sim.advance(st, hours);
  return st;
};
const hash = (st) => sha(canon(kept(st)));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const own = (st, id, verb, args) => issue(st, { actor: id, verb, target: null, args, source: 'pawn' });
const unctl = (st) => {
  for (const p of st.pawns) delete p.control;
  delete st.controlled;
  delete st.queued;
};

// 1. An empty controller on every living pawn changes nothing: ten days hash as the run with none, once the records are taken out.
{
  const plain = make(), ctl = make();
  for (const id of ctl.living) assert.strictEqual(own(ctl, id, 'auto', { on: true }), true);
  assert.deepStrictEqual(ctl.controlled, [...ctl.living].sort((x, y) => x - y), 'every living pawn has one');
  assert.deepStrictEqual(ctl.queued, [], 'and nothing is queued');
  for (const st of [plain, ctl]) Sim.advance(st, 10 * Sim.DAY);
  sound(ctl, 'an empty controller on every pawn');
  unctl(ctl);
  assert.strictEqual(hash(ctl), hash(plain), 'an empty controller on every pawn changes nothing in ten days');
}

// 2. Two pawns with automatic behaviour off at once, neither played: the planner leaves both alone through a working day, while their
// household's others work; each is given a walk queued, and both walks run from the index.
{
  const st = make(4.5),
    hh = st.households[0],
    [a, b] = hh.members.filter((id) => st.pawns[id].alive).slice(0, 2);
  for (const id of [a, b]) {
    VB['sim/agents'].release(st, st.agents[id]);
    assert.strictEqual(own(st, id, 'auto', { on: false }), true);
  }
  assert.strictEqual(st.player, null, 'no pawn is played');
  let took = 0, others = 0;
  for (let n = 0; n < 80; n++) {
    Sim.advance(st, 0.1);
    for (const id of [a, b]) if (st.agents[id].job) took++;
    others += hh.members.filter((id) => id !== a && id !== b && st.agents[id] && st.agents[id].job).length;
  }
  assert.strictEqual(took, 0, 'neither takes work of the planner');
  assert.ok(others > 0, 'the others of the household work as before');
  sound(st, 'two with automatic off');
  const to = st.villages[0].center;
  for (const id of [a, b]) assert.strictEqual(own(st, id, 'queue', { cmd: { verb: 'walkTo', target: to } }), true);
  assert.deepStrictEqual(st.queued, [a, b].sort((x, y) => x - y), 'both queues in the index');
  assert.strictEqual(controlOf(st, a).queue[0].source, 'pawn', 'the command keeps who queued it');
  Sim.advance(st, 0.1);
  for (const id of [a, b]) assert.ok(controlOf(st, id).queue[0].begun !== null && st.agents[id].path, `pawn ${id} walks as queued`);
  for (let n = 0; n < 100 && st.queued.length; n++) Sim.advance(st, 0.1);
  assert.deepStrictEqual(st.queued, [], 'the walks done, the index is empty');
  for (const id of [a, b]) assert.ok(!controlOf(st, id).queue.length && !controlOf(st, id).auto, 'the switch stays off');
  sound(st, 'two queues run');
  // a save keeps the controllers and the index
  const back = Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.strictEqual(canon(back.pawns[a].control), canon(st.pawns[a].control), 'a controller comes back as saved');
  assert.deepStrictEqual(back.controlled, st.controlled);
  for (const s of [st, back]) Sim.advance(s, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
}

// 3. The verbs: the pawn's own, and checked; a death ends the controller and takes it out of the index.
{
  const st = make(4.5), id = st.households[0].holder;
  assert.ok(/on or off/.test(own(st, id, 'auto', { on: 'yes' })), 'auto takes a boolean');
  assert.ok(/no verb fly/.test(own(st, id, 'queue', { cmd: { verb: 'fly' } })), 'an unknown verb is not queued');
  assert.ok(/no verb queue/.test(own(st, id, 'queue', { cmd: { verb: 'queue' } })), 'nor a controller verb');
  assert.ok(/no verb skip/.test(own(st, id, 'queue', { cmd: { verb: 'skip', args: { hours: 1 } } })), 'nor the world\'s');
  assert.ok(/no command 0/.test(own(st, id, 'unqueue', { i: 0 })), 'an empty queue has nothing to take off');
  assert.strictEqual(st.pawns[id].control, undefined, 'refusals make no controller');
  for (let n = 0; n < QUEUE_MAX; n++) assert.strictEqual(own(st, id, 'queue', { cmd: { verb: 'idle', args: { until: st.t + 1 } } }), true);
  assert.ok(/full/.test(own(st, id, 'queue', { cmd: { verb: 'goHome' } })), 'the queue holds QUEUE_MAX');
  assert.strictEqual(own(st, id, 'unqueue', { i: QUEUE_MAX - 1 }), true);
  assert.strictEqual(controlOf(st, id).queue.length, QUEUE_MAX - 1);
  sound(st, 'a queue filled');
  VB['sim/lifecycle'].killPawn(st, id);
  assert.ok(st.pawns[id].control === undefined && !st.controlled.includes(id) && !st.queued.includes(id), 'ended at its death');
  assert.ok(/not a living pawn/.test(String(own(st, id, 'auto', { on: false }))), 'a dead pawn has no controller to switch');
  sound(st, 'its pawn dead');
  // played, a pawn's controller starts fresh, and the player's leaving ends it (VB-1745 review, F2)
  const b = st.households[0].members.find((m) => st.pawns[m].alive && m !== id);
  own(st, b, 'auto', { on: false });
  own(st, b, 'queue', { cmd: { verb: 'goHome' } });
  assert.strictEqual(Sim.inhabit(st, b), true);
  assert.deepStrictEqual(st.pawns[b].control, { auto: true, queue: [], refused: null }, 'inhabited, its controller starts fresh');
  assert.strictEqual(Sim.setAuto(st, st.player.pawn, false), true);
  assert.strictEqual(Sim.uninhabit(st), true);
  assert.strictEqual(st.pawns[b].control, undefined, 'left, its controller ends: its own logic again');
  // the played pawn dead (F4): no controller, so the switch reads on and cannot be set until the player goes on as another
  Sim.inhabit(st, b);
  Sim.setAuto(st, st.player.pawn, false);
  VB['sim/lifecycle'].killPawn(st, b);
  assert.strictEqual(st.player.pawn, b, 'the player keeps its dead pawn');
  assert.ok(controlOf(st, b).auto && !controlOf(st, b).queue.length, 'its switch reads on, nothing queued');
  assert.ok(/not a living pawn/.test(String(Sim.setAuto(st, st.player.pawn, true))), 'the switch of a dead pawn is refused');
  sound(st, 'the played pawn dead');
}
console.log(`controller ok: an empty controller on every pawn changes nothing in 10 days; two with automatic off left alone and their `
  + `queues run from the index; refusals make no controller; ended at a death; saved and loaded`);
