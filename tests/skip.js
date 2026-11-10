// Skip to the next event that concerns the played pawn (VB-234): Sim.skipFrom marks where a skip begins and Sim.skipStop, asked after each
// step, says when it has reached a stop and why. It stops on a birth, marriage or death in the pawn's household or line, on a farm's
// event and a change of custom in its village but not elsewhere, on hunger come to its household, on a refused command, on an empty
// queue with the automatic behaviour off, and at the latest on the eve of the moving round. Asking writes nothing: a skipped run is the
// run played.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, R = VB['sim/records'], N = VB['sim/notable'], { YEAR, DAY, SEASON_DAYS, cal } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha } = require('./lib/canon.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 4 });
const hash = (st) => { const { w, ...rest } = st; return sha(canon(rest)); };
// run ahead as the page does, a 6-minute step at a time, until a stop; at most `limit` game hours
function skip(st, limit = 2 * YEAR) {
  const from = Sim.skipFrom(st), t0 = st.t;
  let stop = Sim.skipStop(st, from);
  while (!stop && st.t - t0 < limit) { Sim.advance(st, 0.1); stop = Sim.skipStop(st, from); }
  return { stop, from, hours: st.t - t0 };
}
const HOLDER = 0, WIFE = 1;

// 1. No pawn played: nothing to skip to. The eve of the round is the start of work on the day before it, always ahead and within a year.
{
  const st = make();
  assert.strictEqual(Sim.skipFrom(st), null); assert.strictEqual(Sim.skipStop(st, { t: 0, n: 0 }).why, 'none');
  for (const t of [6, 100.5, 2 * YEAR - 1, N.roundEve(6), N.roundEve(6) + 0.1, 3 * YEAR + 6]) {
    const eve = N.roundEve(t), c = cal(eve);
    assert.ok(eve > t && eve - t <= YEAR, `the eve after ${t} is ${eve}`);
    assert.deepStrictEqual([c.season, c.sday, c.hour], [2, 9, 6], 'day 10 of autumn at 06:00, the day before the round');
  }
}

// 2. A skip always ends, at the eve of the moving round at the latest, and a skipped run is the run played: the same state, hash for hash.
{
  const skipped = make(), played = make();
  for (const st of [skipped, played]) Sim.inhabit(st, HOLDER);
  const stops = [];
  for (let n = 0; n < 60 && !stops.some((s) => s.why === 'round'); n++) {
    const before = skipped.t, { stop, from, hours } = skip(skipped);
    assert.ok(stop, 'the skip ended'); assert.ok(skipped.t <= from.eve + 0.11 && hours <= YEAR, `within a year, by the eve (${hours} h)`);
    assert.ok(Sim.SKIP[stop.why] && typeof stop.text === 'string' && stop.text.length > 0, JSON.stringify(stop));
    stops.push({ why: stop.why, t: skipped.t, text: stop.text });
    if (skipped.t === before) Sim.advance(skipped, 0.1); // a stop at once (two events in one step): the next skip goes on from there
    if (!skipped.pawns[HOLDER].alive) break;
  }
  const last = stops[stops.length - 1];
  assert.ok(last.why === 'round' || !skipped.pawns[HOLDER].alive, `the skips reach the eve of the round (${JSON.stringify(stops.map((s) => s.why))})`);
  if (last.why === 'round') {
    const c = cal(last.t);
    assert.ok(c.season === 2 && c.sday === 9 && Math.abs(c.hour - 6) < 0.11, `it stopped on the eve at the start of work (${JSON.stringify(c)})`);
  }
  Sim.advance(played, 0); while (played.t < skipped.t - 1e-9) Sim.advance(played, 0.1);
  assert.strictEqual(played.t, skipped.t); assert.strictEqual(hash(played), hash(skipped), 'skipping changes nothing in the run');
  console.log(`  ${stops.length} stops to the eve of the round: ${stops.map((s) => s.why).join(', ')}`);
}

// 3. Events: a death in the household stops it with its sentence; a custom or a farm's event stops it in the pawn's village only.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  const child = st.households[0].members.find((m) => m !== HOLDER && m !== WIFE), far = st.households[3].members[2];
  let from = Sim.skipFrom(st);
  assert.strictEqual(Sim.skipStop(st, from), null, 'nothing yet');
  const h0 = hash(st); Sim.skipStop(st, from); assert.strictEqual(hash(st), h0, 'asking writes nothing');
  Sim.killPawn(st, far, 'illness');
  assert.strictEqual(Sim.skipStop(st, from), null, 'a death on another farm, of no kin, does not stop it');
  Sim.killPawn(st, child, 'illness');
  const stop = Sim.skipStop(st, from);
  assert.ok(stop && stop.why === 'family' && stop.ev.pawn === child && stop.text.includes(Sim.fullName(st.pawns[child])), JSON.stringify(stop));
  assert.strictEqual(Sim.skipStop(st, from), null, 'an event stops it once');
  const vid = R.settlementIdOf(st, st.pawns[HOLDER]);
  R.log(st, 'A custom changed far away.', { kind: 'custom', village: vid + 7 });
  R.log(st, 'A farm was left empty far away.', { kind: 'empty', village: vid + 7, farm: 99, household: 99 });
  assert.strictEqual(Sim.skipStop(st, from), null, 'customs and farms of other villages pass');
  R.log(st, 'A custom changed here.', { kind: 'custom', village: vid });
  assert.strictEqual(Sim.skipStop(st, from).why, 'custom');
  R.log(st, 'A farm was left empty here.', { kind: 'empty', village: vid });
  assert.strictEqual(Sim.skipStop(st, from).why, 'farm');
  R.log(st, 'The farm passed on.', { kind: 'inherited', pawn: child, household: 0 });
  assert.strictEqual(Sim.skipStop(st, from).why, 'farm', 'a farm inherited in its household');
  // the played pawn's own death stops it, and the succession takes over
  from = Sim.skipFrom(st); Sim.killPawn(st, HOLDER, 'illness');
  assert.strictEqual(Sim.skipStop(st, from).why, 'family');
}

// 4. Hunger come to the household stops it once; a household hungry already does not stop the next skip.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  const hh = st.households[0], from = Sim.skipFrom(st);
  assert.ok(!from.hungry && Sim.skipStop(st, from) === null);
  hh.hungryDays++; // lint-allow: owner the test stands in for a short meal
  const stop = Sim.skipStop(st, from);
  assert.ok(stop.why === 'hunger' && stop.text.includes(st.farmsteads[hh.farmstead].name), JSON.stringify(stop));
  hh.hungryDays++; // lint-allow: owner as above
  assert.strictEqual(Sim.skipStop(st, from), null, 'the next short meal of the same skip does not stop it again');
  hh.hunger = 0.3; // lint-allow: owner as above
  const again = Sim.skipFrom(st); hh.hungryDays++; // lint-allow: owner as above
  assert.ok(again.hungry && Sim.skipStop(st, again) === null, 'a skip begun in hunger passes its short meals');
}

// 5. The player's own state: a refused command, and an empty queue with the automatic behaviour off.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  Sim.queue(st, { actor: HOLDER, verb: 'work', target: 'no-such-job' });
  const { stop, hours } = skip(st, DAY);
  assert.ok(stop && stop.why === 'refused' && /work/.test(stop.text) && hours <= 0.11, JSON.stringify(stop));
  assert.notStrictEqual(skip(st, 1).stop && skip(st, 1).stop.why, 'refused', 'an old refusal does not stop the next skip');
  Sim.setAuto(st, false);
  const idle = skip(st, DAY);
  assert.ok(idle.stop.why === 'idle' && idle.hours === 0, 'automatic off and nothing queued: it stops at once');
  Sim.queue(st, { actor: HOLDER, verb: 'idle', args: { until: st.t + 2 } });
  const waited = skip(st, DAY);
  assert.ok(waited.stop.why === 'idle' && waited.hours >= 1.9 && waited.hours <= 2.3, `and when the queue runs out (${waited.hours} h)`);
}
console.log('skip ok: it ends by the eve of the moving round; a skipped run is the run played; family, farm and custom events of its own village, '
  + 'hunger come to the household, a refused command and an empty queue stop it');
