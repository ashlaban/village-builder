// @suite fast
// The played pawn's sheet (VB-1118): what its last act yielded, what moved its levels, and who of its household ails, as kin see it.
// A tiny village of two farms by the sea; a member of household 0 is played, a fishing trip is queued, and when it ends the sheet names the
// catch; its health's fall is told with its causes; a member drawn to die falls ill, is shown ailing while its health falls, and dies when
// the course is run.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { DAY, ILLNESS } = VB['sim/rules'], { dayOfDeath } = VB['sim/deaths'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '...........~~~~~'));
const st = tinyState(tinyWorld(rows), [{ at: [7, 7], farms: 2 }], { seed: 4 });
const fishJob = () =>
  [...st.jobs.values()].find((j) => j.kind === 'fish' && j.owner.type === 'household' && j.owner.id === 0 && !j.claims.length);
let j = fishJob();
for (let h = 0; !j && h < 40 * 24; h++) { Sim.advance(st, 1); j = fishJob(); }
assert.ok(j, 'household 0 posts a fishing trip');
const hh = st.households[0], id = hh.members.find((m) => st.pawns[m].age >= 16 && st.agents[m].away === undefined);

// 1. a queued fishing trip ends, and the sheet names the catch
assert.strictEqual(Sim.inhabit(st, id), true);
assert.strictEqual(Sim.sheetNotes(st).yielded, null, 'no act yet');
assert.strictEqual(Sim.queue(st, st.player.pawn, { actor: id, verb: 'work', target: j.key }), true);
for (let s = 0; Sim.controlOf(st, st.player.pawn).queue.length && s < 24 * 10; s++) Sim.advance(st, 0.1);
assert.ok(!Sim.controlOf(st, st.player.pawn).queue.length, 'the trip is done');
const L = st.player.last;
assert.ok(L && L.kind === 'fish' && L.good === 'fish' && L.n > 0, `the catch is kept: ${JSON.stringify(L)}`);
const words = Sim.sheetNotes(st).yielded;
assert.ok(/^Fishing/.test(words) && words.includes(`${Math.round(L.n * 10) / 10} of fish`), `the sheet names the catch: ${words}`);
assert.deepStrictEqual(checkState(st), [], 'invariants after the trip');

// 2. what moved its levels: health's causes, the larger first; hunger; the household's food
Sim.advance(st, 2 * DAY);
assert.ok(st.player.days.length >= 2 && st.player.days.length <= VB['sim/player'].DAYS_KEPT, 'its last days are kept');
const day = (t, before, health, hunger, food, why) => ({ t, before, health, hunger, food, why: { hunger: 0, cold: 0, damp: 0, ill: 0, rest: 0, ...why } });
st.player.days = [day(st.t - DAY, 95, 90, 0.1, 20, { hunger: 1, cold: 4 }), day(st.t, 90, 85, 0.2, 15, { hunger: 2, cold: 3 })];
const moved = Sim.sheetNotes(st).moved;
assert.ok(/^Health fell 10 over 2 days: a cold house \(-7\), hunger \(-3\)/.test(moved[0]), moved[0]);
assert.ok(moved.some((m) => /^Hunger rose/.test(m)) && moved.some((m) => /food fell from 20 to 15 days/.test(m)), moved.join(' | '));

// 3. a death drawn by the roll comes as an illness: kin see the pawn ailing, its health falls, and it dies when the course is run
const kin = hh.members.find((m) => m !== id && st.pawns[m].alive), p = st.pawns[kin];
st.rng.deaths.fix = 0; // the day's roll comes up
assert.strictEqual(dayOfDeath(st, p), null, 'the draw does not kill at once');
delete st.rng.deaths.fix;
assert.ok(p.ill && p.ill.until - p.ill.from === ILLNESS.days[p.ill.cause] * DAY, `an illness of its cause's days: ${JSON.stringify(p.ill)}`);
assert.ok(Sim.sheetNotes(st).ailing.some((s) => s === `${p.given} is ailing.` || s === `${p.given} is gravely ill.`), Sim.sheetNotes(st).ailing.join(' | '));
assert.ok(!Sim.sheetNotes(st).ailing.some((s) => /%|chance|will die/.test(s)), 'what kin see is no probability');
assert.deepStrictEqual(checkState(st), [], 'invariants while ill');
const until = p.ill.until, cause = p.ill.cause, start = p.health;
let low = start;
for (let d = 0; p.alive && d < 60; d++) { Sim.advance(st, DAY / 4); if (p.alive) low = Math.min(low, p.health); }
assert.ok(!p.alive && p.died >= until && p.died < until + DAY, `dies when the course is run (${p.died}, due ${until})`);
assert.ok(low < start - ILLNESS.fall / 3, `its health showed the illness: ${start} to ${low}`);
const ev = st.record.filter((e) => e.kind === 'died' && e.pawn === kin);
assert.ok(ev.length === 1 && (ev[0].text === cause || ev[0].text === 'starvation'), `died of its illness: ${JSON.stringify(ev)}`);
assert.deepStrictEqual(checkState(st), [], 'invariants after the death');
console.log('sheet ok: a queued fishing trip ends and the sheet names the catch; what moved health, hunger and the store is told; a death drawn comes as an illness kin see before it kills');
