// Sleep for the played pawn (VB-1643; sim/sleep, sim/player): the hours it owes rise awake and fall asleep; the verb `sleep` sends it home
// until its hour, and the queue goes on after it; a night worked is felt in mood by SLEEP.mood; health is touched only once a whole night
// or more is owed; a save keeps the hours owed. On the tiny village of tests/player.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { WORK, TICKS } = VB['sim/rules'];
const { SLEEP, AWAKE, tiredMood, tiredHealth } = VB['sim/sleep'], Mood = VB['sim/mood'], { ate, rationOf } = VB['sim/hunger'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = (hours = 0) => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  if (hours) Sim.advance(st, hours);
  return st;
};
const hour = (st) => Sim.cal(st.t).hour;
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const near = (x, y, what) => assert.ok(Math.abs(x - y) < 1e-6, `${what}: ${x} against ${y}`);
const until = (st, h) => { while (Math.abs(hour(st) - h) > 1e-6) Sim.advance(st, 0.1); };
const FARMER = 0;

// 1. The hours owed rise awake and fall asleep: at work in the day, each hour owes AWAKE; indoors at home at night, each pays one.
{
  const st = make(1), a = st.agents[FARMER];
  Sim.inhabit(st, FARMER);
  assert.deepStrictEqual(Sim.sleepOf(st), { owed: 0, asleep: false, mood: 0, health: 0 });
  VB['sim/player'].playerStep(st); VB['sim/player'].playerStep(st);
  assert.strictEqual(st.player.sleep.owed, 0, 'reckoned once a step, however often the queue is stepped');
  Sim.advance(st, 1);
  const at9 = st.player.sleep.owed;
  near(at9, AWAKE, 'an hour awake owes need / (24 - need)');
  near(AWAKE, 0.5, 'need 8: half an hour');
  until(st, WORK[1] - 1);
  assert.ok(!a.inside && st.player.sleep.owed > at9, 'awake through the day, more is owed');
  until(st, 21);
  assert.ok(a.inside && st.player.sleep.asleep, 'home at dark, it sleeps');
  const at21 = st.player.sleep.owed;
  Sim.advance(st, 1);
  near(st.player.sleep.owed, Math.max(0, at21 - 1), 'an hour asleep pays one');
  until(st, 5);
  assert.strictEqual(st.player.sleep.owed, 0, 'a night pays an ordinary day off, never under 0');
  assert.strictEqual(Mood.of(st, FARMER).mods.some((m) => m.key === 'tired'), false, 'an ordinary day is not tiring');
  sound(st, 'an ordinary day and night');
}

// 2. The verb: at work in the morning, sleep for two hours leaves the job, goes home and sleeps; refused with its reasons; sleep until
// the start of work, at night, then a walk: the walk begins when the sleep ends.
{
  const st = make(3), a = st.agents[FARMER];
  Sim.inhabit(st, FARMER);
  assert.ok(a.job, 'the farmer works');
  st.player.sleep.owed = 10;
  assert.strictEqual(Sim.queue(st, { actor: FARMER, verb: 'sleep', args: { hours: 2 } }), true);
  Sim.advance(st, 0.1);
  assert.ok(!a.job && st.player.queue[0].begun !== null, 'it leaves the job in hand');
  let steps = 0;
  while (a.path && steps++ < 100) Sim.advance(st, 0.1);
  Sim.advance(st, 0.1);
  assert.ok(st.player.sleep.asleep && st.player.queue.length === 1, 'home, it sleeps under the verb');
  const was = st.player.sleep.owed;
  Sim.advance(st, 0.5);
  near(st.player.sleep.owed, was - 0.5, 'asleep in the day, it pays');
  until(st, Sim.cal(st.player.queue[0].ref.until).hour);
  Sim.advance(st, 0.1);
  assert.ok(!st.player.queue.length, 'the sleep ends at its time');
  for (const [args, why] of [[{ hours: 0 }, /cannot sleep/], [{ until: 24 }, /no hour/]]) {
    Sim.queue(st, { actor: FARMER, verb: 'sleep', args });
    Sim.advance(st, 0.1);
    assert.ok(st.player.refused && st.player.refused.verb === 'sleep' && why.test(st.player.refused.why), `refused: ${JSON.stringify(st.player.refused)}`);
  }
  const homeless = st.pawns.find((p) => p.alive && p.household === null);
  if (homeless) assert.ok(/no place to sleep/.test(VB['sim/commands'].issue(st, { actor: homeless.id, verb: 'sleep', source: 'player' })));
  // at 22, sleep (until the start of work by default), then walk to the green: the walk is begun at 6
  until(st, 22);
  Sim.setAuto(st, false);
  Sim.queue(st, { actor: FARMER, verb: 'sleep' });
  Sim.queue(st, { actor: FARMER, verb: 'walkTo', target: st.villages[0].center });
  Sim.advance(st, 0.1);
  const u = st.player.queue[0].ref.until;
  near(u % Sim.DAY, WORK[0], 'until the start of work');
  until(st, WORK[0] - 0.1);
  assert.ok(st.player.queue[0].verb === 'sleep' && a.inside && !a.path, 'asleep until its hour');
  Sim.advance(st, 0.2);
  assert.ok(st.player.queue[0].verb === 'walkTo' && st.player.queue[0].begun === u && !a.inside, 'then the queue goes on');
  sound(st, 'the verb');
}

// 3. A night worked: kept out all night by the player's commands (the command overrides dark), the pawn owes a night at dawn, and its
// mood falls by SLEEP.mood; one that went home at dark owes nothing.
{
  const worked = make(), slept = make(), far = 11 * worked.w.COLS + 1;
  for (const st of [worked, slept]) { Sim.inhabit(st, FARMER); Sim.advance(st, WORK[1] - 1 - hour(st)); }
  Sim.queue(worked, { actor: FARMER, verb: 'walkTo', target: far });
  Sim.queue(worked, { actor: FARMER, verb: 'idle', args: { until: worked.t + 13 } });
  for (const st of [worked, slept]) Sim.advance(st, 13);
  assert.ok(!worked.agents[FARMER].inside, 'out all night');
  const owed = worked.player.sleep.owed, mood = Mood.of(worked, FARMER).mods.find((m) => m.key === 'tired');
  assert.ok(Math.abs(owed - 24 * AWAKE) < 0.5, `a night lost: ${owed} owed, a day and a night's waking`);
  assert.ok(mood && mood.value === Math.round(tiredMood(owed)) && mood.value <= -5, `tired by the tunable: ${JSON.stringify(mood)}`);
  assert.strictEqual(Sim.sleepOf(worked).mood, mood.value, 'the page reads the same term');
  assert.strictEqual(slept.player.sleep.owed, 0, 'one that slept owes nothing');
  assert.strictEqual(Mood.of(slept, FARMER).mods.some((m) => m.key === 'tired'), false);
  // the allowance and the cap
  assert.strictEqual(tiredMood(SLEEP.mood.over), 0);
  assert.strictEqual(tiredMood(SLEEP.cap), SLEEP.mood.cap);
  sound(worked, 'a night worked');
}

// 4. Health: the day's reckoning takes nothing under a whole night owed, then SLEEP.health; the played pawn's day names it; others never.
{
  const st = make(1), p = st.pawns[FARMER], need = rationOf(st, p);
  Sim.inhabit(st, FARMER);
  const meal = (owed) => {
    st.player.sleep.owed = owed;
    p.health = 60; p.hunger = 0; p.hungerLog = p.hungerLog.map(() => 0);
    ate(st, p, need, need);
    return p.health;
  };
  const rested = meal(0);
  assert.strictEqual(meal(SLEEP.health.over - 0.1), rested, 'under a whole night owed, health is untouched');
  near(meal(12), rested - tiredHealth(12), 'a night and a day awake');
  near(tiredHealth(12), 1.5, 'SLEEP.health: 1.5 for 12 owed');
  const day = st.player.days[st.player.days.length - 1];
  near(day.why.tired, 1.5, "the day's why names lack of sleep");
  assert.ok(Sim.sleepOf(st).health === 1.5);
  const other = st.pawns.find((q) => q.alive && q.id !== FARMER && q.health < 100);
  if (other) {
    const h = other.health, keep = { ...other };
    ate(st, other, rationOf(st, other), rationOf(st, other));
    const moved = other.health - h;
    Object.assign(other, keep);
    st.player.sleep.owed = 0;
    ate(st, other, rationOf(st, other), rationOf(st, other));
    near(other.health - h, moved, "another pawn's health is not touched by the player's sleep");
  }
}

// 5. A save keeps the hours owed and whether it sleeps; a save made before VB-1643 loads with none owed.
{
  const st = make(1);
  Sim.inhabit(st, FARMER);
  Sim.advance(st, 3);
  const data = JSON.parse(JSON.stringify(Sim.save(st))), back = Sim.load(tinyWorld(rows), data);
  assert.strictEqual(canon(back.player.sleep), canon(st.player.sleep), 'saved and loaded');
  for (const s of [st, back]) Sim.advance(s, 1);
  near(back.player.sleep.owed, st.player.sleep.owed, 'and goes on alike');
  delete data.state.player.sleep;
  const old = Sim.load(tinyWorld(rows), data);
  Sim.advance(old, 0.1);
  near(old.player.sleep.owed, AWAKE / TICKS, 'an old save starts owing nothing');
  sound(back, 'loaded');
}
console.log('sleep ok: owed awake, paid asleep; the verb leaves the job, sleeps until its hour and the queue goes on; a night worked tires by SLEEP.mood; health past a whole night only; saved');
