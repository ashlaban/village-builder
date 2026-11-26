// Skip to the next event that concerns the played pawn (VB-234): Sim.skipFrom marks where a skip begins and Sim.skipStop, asked after each
// step, says when it has reached a stop and why. It stops on a birth, marriage or death in the pawn's household or line, on a farm's
// event and a change of custom in its village but not elsewhere, on hunger come to its household, on a refused command, on an empty
// queue with the automatic behaviour off, and at the latest on the eve of the moving round. Asking writes nothing: a skipped run is the
// run played. A skip begun where the last one stopped goes on with its cursor (VB-1108).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, R = VB['sim/records'], N = VB['sim/notable'], { YEAR, DAY, SEASON_DAYS, cal } = VB['sim/rules'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const make = () => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 4 });
const hash = (st) => sha(canon(kept(st)));
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

// 3b. A move between homes (VB-1109): into, out of or within the played household stops it; another household's does not.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  const from = Sim.skipFrom(st), a = st.households[0], b = st.households[3];
  const kid = a.members.find((m) => m !== HOLDER && m !== WIFE), far = b.members[2], far2 = st.households[2].members[2];
  const at = (hh) => ({ household: hh.id, farm: hh.farmstead });
  const kinds = [
    ['moved', { pawn: kid, ...at(a) }, 'a child goes to kin who hold its farm in trust'],
    ['moved', { pawn: far, other: HOLDER, ...at(b) }, 'a pawn comes to help the played one'],
    ['moved', { pawn: HOLDER, ...at(a) }, 'a ward comes back and the trust ends'],
    ['service', { pawn: far, ...at(a) }, 'a servant joins'],
    ['service', { pawn: kid, ...at(b) }, 'a child goes into service'],
    ['joined', { pawn: far, reason: 'orphaned', ...at(a) }, 'a child joins'],
  ];
  for (const [kind, f, why] of kinds) {
    R.log(st, 'x', { kind, ...f, village: 0 });
    assert.strictEqual((Sim.skipStop(st, from) || {}).why, 'farm', why);
    R.log(st, 'x', { kind, pawn: far2, ...at(st.households[2]), village: 0 });
    assert.strictEqual(Sim.skipStop(st, from), null, `${kind} of another household passes`);
  }
  R.log(st, 'x', { kind: 'joined', pawn: far, reason: 'care', ...at(a), village: 0 });
  assert.strictEqual(Sim.skipStop(st, from), null, 'a joined told by the trust log is no second stop');
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
// 6. A gathering that concerns the played pawn stops the skip as it begins (VB-1031), not when the record tells it, at its end: the funeral
// ale of its wife, once; one that was on when the skip began does not; another household's does not; asking writes nothing to the state.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  Sim.killPawn(st, WIFE, 'illness');
  const o = st.occasions.find((x) => x.kind === 'funeral' && x.for.includes(WIFE));
  assert.ok(o && o.start > st.t, 'a funeral ale is called');
  const { stop } = skip(st, 3 * DAY);
  assert.ok(stop && stop.why === 'occasion' && /funeral ale/.test(stop.text) && stop.spot.x === o.x && stop.spot.y === o.y, JSON.stringify(stop));
  assert.ok(st.t >= o.start && st.t < o.start + 0.11 && st.t < o.end, `as it begins (${st.t} of ${o.start} to ${o.end})`);
  const before = hash(st), seen = [];
  assert.strictEqual(Sim.gatherings(st, HOLDER, seen).length, 1); assert.strictEqual(Sim.gatherings(st, HOLDER, seen).length, 0, 'told once');
  assert.deepStrictEqual(seen, st.occasions.filter((x) => st.t >= x.start).map((x) => x.id), 'the list is the caller\'s');
  assert.strictEqual(hash(st), before, 'asking writes nothing');
  const again = skip(st, 0.3);
  assert.ok(!again.stop || again.stop.why !== 'occasion', 'one on when the skip began does not stop it');
  const other = st.pawns.find((q) => q.alive && q.household !== st.pawns[HOLDER].household && Sim.kinDegree(st, HOLDER, q.id) === null
    && !o.asked.some((a) => a.id === q.id) && !o.come.includes(q.id));
  if (other) assert.strictEqual(Sim.gatherings(st, other.id, []).filter((g) => g.id === o.id).length, 0, 'not one who is no kin and not asked');
}
// 7. A skip goes on where the last one stopped (VB-1108): two events of one step that both stop it (the played pawn's wedding, and a farm
// taken over by its son the same hour) stop it twice, in the record's order; what the record gains while the game stands is passed; and
// once the game has run at a speed, or another pawn is played, the next skip begins at the record's end. Asking writes nothing.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  const son = st.households[0].members.find((m) => m !== HOLDER && m !== WIFE), vid = R.settlementIdOf(st, st.pawns[HOLDER]);
  const first = Sim.skipFrom(st);
  Sim.advance(st, 0.1);
  assert.strictEqual(Sim.skipStop(st, first), null, 'nothing yet');
  const twoEvents = () => {
    R.log(st, 'The played pawn marries.', { kind: 'married', pawn: HOLDER, other: st.households[3].members[2] });
    R.log(st, 'A death far away.', { kind: 'custom', village: vid + 7 });
    R.log(st, 'Its son takes over a farm.', { kind: 'inherited', pawn: son, household: 3 });
  };
  twoEvents();
  const h0 = hash(st), one = Sim.skipStop(st, first);
  assert.strictEqual(hash(st), h0, 'a stop writes nothing');
  assert.ok(one && one.why === 'family' && one.ev.kind === 'married', JSON.stringify(one));
  assert.strictEqual(Sim.skipStop(st, Sim.skipFrom(st)), null, 'a skip begun at the record\'s end loses the second (the defect)');
  R.log(st, 'The player leaves a farm while the game stands.', { kind: 'empty', village: vid }); // its own act: seen, not told again
  const next = Sim.skipFrom(st, first);
  assert.ok(next !== first && next.t === st.t && next.eve === N.roundEve(st.t));
  const two = Sim.skipStop(st, next);
  assert.ok(two && two.why === 'farm' && two.ev.kind === 'inherited' && two.ev.pawn === son, JSON.stringify(two));
  assert.ok(st.record.indexOf(one.ev) < st.record.indexOf(two.ev), 'in the record\'s order');
  assert.strictEqual(Sim.skipStop(st, next), null, 'each once, and what was written while the game stood is passed');
  assert.strictEqual(next.n, st.record.length);
  const third = Sim.skipFrom(st, next);
  assert.strictEqual(Sim.skipStop(st, third), null, 'nothing is told twice by a third skip');
  R.log(st, 'A custom changed here.', { kind: 'custom', village: vid });
  assert.strictEqual(Sim.skipStop(st, third).why, 'custom', 'and it reads on');
  // the game runs at a speed between two skips: what passed is not read back
  twoEvents();
  assert.strictEqual(Sim.skipStop(st, third).ev.kind, 'married');
  Sim.advance(st, 0.1);
  const later = Sim.skipFrom(st, third);
  assert.ok(later.n === st.record.length && later.pass === null && later.t === st.t, 'a skip after a step run at a speed begins at the record\'s end');
  const got = Sim.skipStop(st, later);
  assert.ok(!got || !got.ev || got.ev.kind !== 'inherited', 'the takeover that passed at a speed is not read back');
  // another pawn played: its skip does not go on with the first one's cursor
  twoEvents();
  assert.strictEqual(Sim.skipStop(st, later).ev.kind, 'married');
  Sim.inhabit(st, WIFE);
  const hers = Sim.skipFrom(st, later);
  assert.ok(hers.pawn === WIFE && hers.n === st.record.length && hers.pass === null);
  const h1 = hash(st); Sim.skipFrom(st, hers); Sim.skipStop(st, hers); assert.strictEqual(hash(st), h1, 'asking writes nothing');
}
// 8. A refusal in the step that stopped a skip (VB-1135): a death in the household and a refused command in one step stop two skips, the
// death first, the refusal by the next, once; a command refused while the game stands, which the page showed, stops none. Asking writes
// nothing.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  const from = Sim.skipFrom(st);
  Sim.advance(st, 0.1);
  assert.strictEqual(Sim.skipStop(st, from), null, 'nothing yet');
  Sim.queue(st, { actor: HOLDER, verb: 'work', target: 'no-such-job' });
  Sim.killPawn(st, WIFE, 'illness');
  Sim.advance(st, 0.1);
  assert.ok(Sim.controlOf(st, st.player.pawn).refused && Sim.controlOf(st, st.player.pawn).refused.t >= from.t, 'refused in the step');
  const h0 = hash(st), one = Sim.skipStop(st, from);
  assert.ok(one && one.why === 'family' && one.ev.kind === 'died', JSON.stringify(one));
  const next = Sim.skipFrom(st, from), two = Sim.skipStop(st, next);
  assert.ok(two && two.why === 'refused' && /work/.test(two.text), JSON.stringify(two));
  assert.strictEqual(hash(st), h0, 'asking writes nothing');
  const third = Sim.skipFrom(st, next), three = Sim.skipStop(st, third);
  assert.ok(!three || three.why !== 'refused', 'told once');
  // refused while the game stands, between two skips: the page showed it
  Sim.controlOf(st, st.player.pawn).refused = { verb: 'work', why: 'there is no job another-missing-job', t: st.t }; // lint-allow: owner as playerStep writes it
  const stood = Sim.skipFrom(st, third);
  const r = Sim.skipStop(st, stood);
  assert.ok(!r || r.why !== 'refused', `a refusal made while the game stood does not stop the next skip: ${JSON.stringify(r)}`);
}
console.log('skip ok: it ends by the eve of the moving round; a skipped run is the run played; family, farm and custom events of its own village, '
  + 'hunger come to the household, a refused command, an empty queue and a gathering as it begins stop it; two stops of one step are told in turn, by the next skip');

// 7. Building news that asks nothing (VB-1101): a house raised onto stone, with no pawn, does not stop a skip; a settling that names one does.
{
  const st = make(); Sim.inhabit(st, HOLDER);
  const from = Sim.skipFrom(st), vid = R.settlementIdOf(st, st.pawns[HOLDER]), hid = st.households[0].id;
  R.log(st, 'The house is raised onto a stone foundation.', { kind: 'cottage', village: vid, household: hid });
  assert.strictEqual(Sim.skipStop(st, from), null, 'a house on stone is no stop');
  R.log(st, 'moves into the new farmstead', { kind: 'cottage', pawn: HOLDER, village: vid, household: hid });
  const stop = Sim.skipStop(st, from);
  assert.ok(stop && stop.why === 'farm', 'a settling still stops it');
  console.log('skip ok: a house raised onto stone asks nothing');
}

// A cause the played pawn takes up on its own (the culture's natural draw, forced) stops the skip, and the Agenda may lay it down in its
// first season with no wait (VB-1103); after that season, laying it down starts the wait as before.
{
  const C = VB['culture'], Customs = VB['sim/customs'], { issue } = VB['sim/commands'];
  const st = make();
  Sim.inhabit(st, HOLDER);
  while (st.t < (2 * SEASON_DAYS + 9) * DAY) Sim.advance(st, 6); // to the day before the meeting, with nothing forced
  const from = Sim.skipFrom(st);
  st.rng.culture.fix = 0.001; // every draw of the culture's stream: the pawn takes a cause up at the meeting
  let stop;
  for (let n = 0; n < 800 && !((stop = Sim.skipStop(st, from)) && stop.why === "cause"); n++) Sim.advance(st, 0.1);
  delete st.rng.culture.fix;
  assert.strictEqual(stop.why, 'cause', JSON.stringify(stop));
  assert.ok(/^.+ has taken up a cause: .+/.test(stop.text) && stop.ev.reason === 'natural', stop.text);
  assert.ok(Sim.SKIP.cause);
  const p = st.pawns[HOLDER];
  assert.ok(p.advocate && p.advocate.natural, 'a natural cause');
  delete st.rng.culture.fix;
  const dim = p.advocate.dim, other = (p.advocate.opt + 1) % Customs.NOPT[dim], args = { dim, option: other };
  assert.ok(/more before a new one/.test(issue(st, { actor: HOLDER, verb: 'argue', args, source: 'player' })), 'held: the wait');
  assert.strictEqual(issue(st, { actor: HOLDER, verb: 'dropCause', source: 'player' }), true);
  assert.strictEqual(p.causeSince, null, 'laid down in its season: no wait');
  assert.strictEqual(issue(st, { actor: HOLDER, verb: 'argue', args, source: 'player' }), true, 'another at once');
  // laid down after the season: the wait stays
  p.causeSince = st.cenv.t - 2 * C.P.causeGrace;
  assert.strictEqual(issue(st, { actor: HOLDER, verb: 'dropCause', source: 'player' }), true);
  assert.ok(/more before a new one/.test(issue(st, { actor: HOLDER, verb: 'argue', args, source: 'player' })), 'after the season: the wait');
  console.log('skip ok: a cause taken up on its own stops a skip; laid down in its season it starts no wait');
}

// VB-1112: a cause run past P.causeEvery gives one event with the support it had, stops the skip of its pawn, and is kept as lastCause.
{
  const C = VB['culture'], Customs = VB['sim/customs'], { issue } = VB['sim/commands'];
  const st = make();
  Sim.inhabit(st, HOLDER);
  const p = st.pawns[HOLDER], dim = 0, opt = (st.cenv.settlements[0].practice[dim] + 1) % Customs.NOPT[dim];
  assert.strictEqual(issue(st, { actor: HOLDER, verb: 'argue', args: { dim, option: opt }, source: 'player' }), true);
  // its term cut to a year and a half, so that it lapses at the second meeting, not the sixth (VB-862: the run took 6 of the script's 9 s)
  p.advocate.until = st.cenv.t + 1.5;
  const evs = () => st.record.filter((e) => e.kind === 'cause' && e.pawn === HOLDER && e.reason === 'lapsed');
  const from = Sim.skipFrom(st);
  while (!evs().length && st.t < 8 * YEAR) Sim.advance(st, 6);
  const e = evs();
  assert.strictEqual(e.length, 1, 'one event: ' + e.length);
  const lc = p.lastCause;
  assert.ok(lc && lc.how === 'lapsed' && lc.dim === dim && lc.opt === opt && lc.sup !== null, JSON.stringify(lc));
  assert.ok(new RegExp(`has lapsed after \\d+ years?; at the last meeting it had ${Math.round(lc.sup * 100)}% against \\d+% for .+, and needed ${Math.round(lc.need * 100)}%\\.$`).test(e[0].text), e[0].text);
  let stop;
  for (let n = 0; n < 500 && !((stop = Sim.skipStop(st, from)) && stop.why === 'cause'); n++);
  assert.ok(stop && stop.why === 'cause' && /has lapsed/.test(stop.text), JSON.stringify(stop));
  assert.strictEqual(p.advocate, null);
  console.log('skip ok: a cause that lapses is told with its last vote');
}

// VB-1114: help received twice in a year gives one stop, naming the giver and the amount, and one History line; the record keeps both
{
  const st = make();
  Sim.inhabit(st, HOLDER);
  const hid = st.pawns[HOLDER].household, fm = st.farmsteads[st.households[hid].farmstead];
  const give = (n, from) => R.personEvent(st, HOLDER, 'gift', `Received ${n} grain from ${from}`, { n, household: hid, farm: fm.id, village: fm.village });
  const from = Sim.skipFrom(st), before = st.record.length;
  st.t += 5 * DAY; give(12, 'Södergården');
  st.t += 5 * DAY; give(72, 'Södergården');
  st.t += 5 * DAY; give(5, 'Nygården');
  const stop = Sim.skipStop(st, from);
  assert.ok(stop && stop.why === 'help' && /12 grain from Södergården/.test(stop.text), JSON.stringify(stop));
  const again = Sim.skipStop(st, from);
  assert.ok(!again || again.why !== 'help', 'the second and third help of the year stop nothing');
  const y = Math.floor(st.t / YEAR), lines = Sim.chronicle(st, { pawn: HOLDER }, null, 50).filter((r) => Math.floor(r.ev.t / YEAR) === y && /^Received/.test(r.text));
  assert.strictEqual(lines.length, 1, lines.map((r) => r.text).join(' | '));
  assert.strictEqual(lines[0].text, 'Received 89 grain this year: 84 from Södergården and 5 from Nygården.');
  assert.strictEqual(lines[0].fold.length, 3);
  assert.strictEqual(st.record.length, before + 3, 'the record is unchanged by the fold');
  const k = Sim.villageSummary(st, fm.village).kin[hid];
  assert.ok(k && k.n === 89 && k.from[0][0] === 'Södergården', JSON.stringify(k));
  console.log('skip ok: help received twice in a year gives one stop and one History line');
}
