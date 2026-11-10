// The player inhabits a pawn (VB-169): its queued commands go before the pawn's own logic, at the planner's four sites; left to itself the
// pawn does what any pawn would; with the automatic behaviour off it takes no work but still goes home at the end of work; a command
// refused when its turn comes is dropped with its reason; the player and its queue are saved with the run.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { WORK } = VB['sim/rules'], { QUEUE_MAX } = VB['sim/commands'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const { dropKind } = require('./lib/record.js');
// One village of three farms under a forest; household 0 is a farmer (pawn 0), his wife (1), a son and three daughters, all hoeing in spring.
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours = 0) => { const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 7 }); if (hours) Sim.advance(st, hours); return st; };
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
const hour = (st) => Sim.cal(st.t).hour;
const jobOf = (st, kind, hh = 0) => [...st.jobs.values()].find((j) => j.kind === kind && j.owner.type === 'household' && j.owner.id === hh);
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const FARMER = 0, WIFE = 1;

// 1. Inhabited, left to itself and given no command, the pawn is indistinguishable: five game days hash as the run with no player, once
// the player and the event that records it are taken out.
{
  const plain = make(), played = make();
  assert.strictEqual(plain.player, null, 'no one plays a new run');
  assert.strictEqual(Sim.inhabit(played, FARMER), true);
  assert.deepStrictEqual(played.player, {
    pawn: FARMER, auto: true, queue: [], refused: null, since: played.t, wishes: { out: null, claim: null, serve: null }, left: null });
  for (const st of [plain, played]) Sim.advance(st, 5 * Sim.DAY);
  sound(played, 'inhabited and left alone');
  const marks = (list) => list.filter((e) => e.kind === 'player');
  assert.strictEqual(marks(played.record).length, 1); assert.strictEqual(marks(Sim.recordOf(played, { pawn: FARMER, life: true })).length, 1);
  assert.strictEqual(marks(played.record)[0].text, 'Played by the player');
  dropKind(played, 'player');
  played.player = null;
  assert.strictEqual(hash(played), hash(plain), 'an inhabited pawn with no commands changes nothing in five days');
  assert.ok(typeof Sim.inhabit(plain, 9999) === 'string', 'only a living pawn is inhabited');
}

// 2. A queued work command is carried out before the planner's choice: nobody fetches firewood on this spring day, the farmer does when told.
{
  const plain = make(4.5), st = make(4.5);
  const wood = jobOf(st, 'wood'), a = st.agents[FARMER];
  assert.ok(wood && !wood.claims.length && a.job && a.job.kind === 'plow', 'the farmer hoes, and the firewood waits');
  Sim.advance(plain, 1); assert.strictEqual(jobOf(plain, 'wood').claims.length, 0, 'the planner leaves the firewood');
  Sim.inhabit(st, FARMER);
  assert.strictEqual(Sim.queue(st, { actor: FARMER, verb: 'work', target: wood.key }), true);
  assert.strictEqual(st.player.queue[0].source, 'player'); assert.strictEqual(st.player.queue[0].begun, null);
  Sim.advance(st, 0.1);
  assert.strictEqual(a.job, wood, 'the head of the queue is issued at the next step');
  assert.ok(st.player.queue.length === 1 && st.player.queue[0].begun !== null, 'and stays the head while its act lasts');
  sound(st, 'a command under way');
  // it lasts until the wood is home: the farmer is not given other work on the way
  let steps = 0;
  while (st.player.queue.length && steps++ < 100) {
    assert.ok(a.job === wood, `on the firewood until it is done (${a.job && a.job.kind})`); Sim.advance(st, 0.1); if (st.jobs.get(wood.key) !== wood) break; }
  Sim.advance(st, 0.3);
  assert.ok(steps < 100 && st.jobs.get(wood.key) !== wood && !st.player.queue.length, 'the firewood is brought home, and the command is done');
  assert.ok(a.job || a.phase === 'home' || a.inside, 'left to itself again, the pawn does as the others: more work, or home at the end of it');
}

// 3. Looking up (sim/jobs, lookUp): with the woodpile low the farmer leaves his field for the woods at the full hour; told to hoe, he stays.
{
  const low = (st) => { st.households[0].wood = 5; Sim.advance(st, 0.6); };
  const plain = make(4.5), st = make(4.5), a = st.agents[FARMER];
  low(plain); assert.strictEqual(plain.agents[FARMER].job.kind, 'wood', 'unplayed, the farmer leaves the field for the woods');
  const field = a.job;
  Sim.inhabit(st, FARMER); Sim.queue(st, { actor: FARMER, verb: 'work', target: field.key });
  Sim.advance(st, 0.3);
  assert.ok(a.job === field && a.phase === 'work' && hour(st) < 11, 'back at the hoeing before the hour');
  low(st);
  assert.ok(hour(st) > 11 && a.job === field, 'the player\'s command is not left for more urgent work');
}

// 4. The call to cook (sim/jobs, callCooks): the wife is called off the field at 14:00; on the player's command she stays, and the
// next cook is called.
{
  const hungry = (st) => { st.households[0].rations = 0; Sim.advance(st, 0.6); };
  const plain = make(7.5), st = make(7.5), a = st.agents[WIFE];
  hungry(plain); assert.strictEqual(plain.agents[WIFE].job.kind, 'cook', 'unplayed, the wife is called to cook');
  const field = a.job;
  Sim.inhabit(st, WIFE); Sim.queue(st, { actor: WIFE, verb: 'work', target: field.key });
  hungry(st);
  assert.strictEqual(a.job, field, 'the player\'s pawn is not called off to cook');
  const cook = jobOf(st, 'cook');
  assert.ok(cook && cook.claims.length === 1 && cook.claims[0] !== WIFE, 'another of the household is called');
}

// 5. With the automatic behaviour off the pawn takes no work in working hours, and still goes home at the end of work.
{
  const st = make(1), a = st.agents[FARMER], green = st.villages[0].center;
  Sim.inhabit(st, FARMER); assert.strictEqual(Sim.setAuto(st, false), true);
  Sim.queue(st, { actor: FARMER, verb: 'walkTo', target: green });
  while (hour(st) < WORK[1] - 0.2) { Sim.advance(st, 0.1); assert.strictEqual(a.job, null, `no job at ${hour(st).toFixed(1)}`); }
  assert.ok(!st.player.queue.length && !a.inside && !a.path, 'it walked to the green and stands there');
  assert.ok(st.agents.some((b) => b.job), 'while the others work');
  Sim.advance(st, 0.3);
  assert.strictEqual(a.phase, 'home', 'at the end of work it goes home');
  Sim.advance(st, 1); assert.ok(a.inside, 'and is indoors by dark');
  sound(st, 'the automatic behaviour off');
}

// 6. A walk under way at the end of work is carried out, not cut off; then the pawn goes home, as needs have it.
{
  const st = make(WORK[1] - 6 - 0.15), a = st.agents[FARMER], far = 11 * st.w.COLS + 1; // the far corner of the map
  Sim.inhabit(st, FARMER);
  Sim.queue(st, { actor: FARMER, verb: 'walkTo', target: far });
  Sim.advance(st, 0.3);
  assert.ok(hour(st) > WORK[1] && a.path && a.phase === null && st.player.queue.length === 1, 'still walking after the end of work');
  assert.ok(st.agents.every((b) => b === a || b.inside || b.phase === 'home' || b.phase === 'back'), 'while the others go home');
  let steps = 0;
  while (a.path && steps++ < 200) Sim.advance(st, 0.1);
  assert.ok(Math.hypot(a.x - st.w.hx[far], a.y - st.w.hy[far]) < 1, 'it arrives where it was sent');
  Sim.advance(st, 0.1);
  assert.ok(a.phase === 'home' && !st.player.queue.length, 'and then goes home');
}

// 7. A command is checked when its turn comes: one refused then is dropped with its reason, and the next is issued. The queue itself
// refuses a ninth command, an unknown verb and another pawn's command; a command can be taken off.
{
  const st = make(4.5), a = st.agents[FARMER];
  assert.ok(/no pawn is played/.test(Sim.queue(st, { actor: FARMER, verb: 'goHome' })), 'no queue without a pawn');
  Sim.inhabit(st, FARMER);
  assert.strictEqual(Sim.queue(st, { actor: FARMER, verb: 'work', target: 'no-such-job' }), true, 'not checked when queued');
  assert.strictEqual(Sim.queue(st, { actor: FARMER, verb: 'idle', args: { until: st.t + 1 } }), true);
  assert.strictEqual(Sim.queue(st, { actor: FARMER, verb: 'goHome' }), true);
  const at = st.t;
  Sim.advance(st, 0.1);
  assert.strictEqual(st.player.refused.verb, 'work'); assert.ok(/there is no job/.test(st.player.refused.why)); assert.ok(st.player.refused.t > at);
  assert.deepStrictEqual(st.player.queue.map((c) => c.verb), ['idle', 'goHome'], 'the refused command is dropped');
  assert.ok(st.player.queue[0].begun !== null && a.job === null, 'and the next is under way');
  sound(st, 'a refused command');
  assert.strictEqual(Sim.unqueue(st, 1), true); assert.deepStrictEqual(st.player.queue.map((c) => c.verb), ['idle']);
  assert.ok(typeof Sim.unqueue(st, 5) === 'string');
  Sim.advance(st, 0.5); assert.strictEqual(a.job, null, 'idling as told, in working hours');
  Sim.advance(st, 0.8); assert.ok(!st.player.queue.length && a.job, 'until its time is up');
  while (st.player.queue.length < QUEUE_MAX) assert.strictEqual(Sim.queue(st, { actor: FARMER, verb: 'goHome' }), true);
  assert.ok(/full/.test(Sim.queue(st, { actor: FARMER, verb: 'goHome' })), 'a ninth command is refused');
  Sim.unqueue(st, 0);
  assert.ok(/no verb fly/.test(Sim.queue(st, { actor: FARMER, verb: 'fly' })), 'an unknown verb is refused');
  assert.ok(/no verb skip/.test(Sim.queue(st, { actor: FARMER, verb: 'skip', args: { hours: 1 } })), 'time is not a pawn\'s to skip');
  assert.ok(/not the player's pawn/.test(Sim.queue(st, { actor: WIFE, verb: 'goHome' })), 'another pawn\'s command is refused');
  assert.strictEqual(st.player.queue.length, QUEUE_MAX - 1, 'refusals leave the queue as it was');
  // the player moves on: the pawn is its own again, and both are on record
  assert.strictEqual(Sim.inhabit(st, WIFE), true);
  assert.deepStrictEqual(Sim.recordOf(st, { pawn: FARMER, life: true }).filter((e) => e.kind === 'player').map((e) => e.text),
    ['Played by the player', 'No longer played by the player']);
  assert.strictEqual(Sim.uninhabit(st), true); assert.strictEqual(st.player, null);
  assert.ok(typeof Sim.uninhabit(st) === 'string');
}

// 8. A save keeps the player, its queue and the command under way; the loaded run goes on as the saved one does.
{
  const st = make(4.5);
  Sim.inhabit(st, FARMER); Sim.setAuto(st, false);
  Sim.queue(st, { actor: FARMER, verb: 'work', target: jobOf(st, 'wood').key });
  Sim.queue(st, { actor: FARMER, verb: 'walkTo', target: st.villages[0].center, args: { x: 300, y: 310 } });
  Sim.queue(st, { actor: FARMER, verb: 'work', target: 'no-such-job' });
  Sim.advance(st, 0.1);
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.strictEqual(canon(back.player), canon(st.player), 'the player comes back as saved');
  assert.strictEqual(back.agents[FARMER].job, back.jobs.get(st.player.queue[0].target), 'on the job its command names');
  for (const s of [st, back]) Sim.advance(s, Sim.DAY);
  assert.strictEqual(hash(back), hash(st), 'the loaded run and the saved one agree a day later');
  assert.ok(st.player.refused && !st.player.queue.length, 'the queue ran out, its last command refused');
  const old = Sim.save(st); delete old.state.player;
  assert.strictEqual(Sim.load(tinyWorld(rows), JSON.parse(JSON.stringify(old))).player, null, 'a save from before the player loads with none');
  sound(back, 'loaded');
}
console.log('player ok: an inhabited pawn left alone changes nothing in 5 days; queued work goes before the planner, looking up and the call to cook; '
  + 'automatic off takes no work and goes home; a walk outlasts the end of work; a refused command is dropped with its reason; saved and loaded');
