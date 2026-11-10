// The chronicle (VB-099): the record of events as the history of a farm, a pawn and a village, and as the village log. A farm's history
// follows the farm across households: every holder, handover, empty spell and claim since the start; the personal events stay with their pawn.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { record, log, personEvent, atFarm } = VB['sim/records'];
const { moveClock } = require('./lib/clock.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 7 });
const kindsOf = (list) => list.map((r) => r.ev.kind);
assert.strictEqual(st.events, undefined, 'the 40-line text log is no longer kept');

// at the start: each farm's history names its holder, and nothing was told in the village log yet
const hh = st.households[0], f = st.farmsteads[hh.farmstead], first = hh.holder;
let h = Sim.chronicle(st, { farm: f.id }, 'land');
assert.deepStrictEqual(kindsOf(h), ['holds']); assert.strictEqual(h[0].ev.pawn, first);
assert.strictEqual(h[0].text, `${Sim.fullName(st.pawns[first])} holds ${f.name}.`);
assert.deepStrictEqual(Sim.villageLog(st), [], 'the history from before the start is no line of the log');

// a handover: the holder dies and the heir takes over
Sim.advance(st, Sim.DAY);
Sim.killPawn(st, first, 'illness');
const heir = hh.holder;
assert.ok(heir !== null && heir !== first, 'the farm has an heir');
h = Sim.chronicle(st, { farm: f.id });
assert.deepStrictEqual(kindsOf(h).filter((k) => k === 'inherited' || k === 'died' || k === 'holds'), ['inherited', 'died', 'holds'], 'newest first');
const took = h.find((r) => r.ev.kind === 'inherited');
assert.ok(took.ev.pawn === heir && took.text.includes(Sim.fullName(st.pawns[heir])) && took.text.includes(f.name), took.text);
const log0 = Sim.villageLog(st);
assert.ok(log0.length >= 2 && log0[0].t >= log0[log0.length - 1].t, 'the log is newest first');
assert.ok(log0.some((e) => / died of illness, aged \d+\.$/.test(e.text)), 'a death is told with its cause');
assert.ok(log0.every((e) => e.text && e.ev && st.record.includes(e.ev)), 'every line is an event of the record');

// the farm stands empty for three years, is claimed, and its new holder moves in: told on the farm, whoever the household
const emptied = st.t; log(st, `${f.name} stands empty.`, { kind: 'empty', ...atFarm(f) });
moveClock(st, 3 * Sim.YEAR + Sim.DAY);
const other = st.households[1].holder;
log(st, `${Sim.fullName(st.pawns[other])} claims the empty farm ${f.name}.`, { kind: 'claim', pawn: other, ...atFarm(f) });
moveClock(st, Sim.DAY);
log(st, `${Sim.fullName(st.pawns[other])} moves into ${f.name}.`, { kind: 'moved', pawn: other, household: 1, farm: f.id, village: f.village });
personEvent(st, other, 'moved', `Moved to ${f.name}`, { household: 1, farm: f.id, village: f.village, kind: 'joined' });
personEvent(st, other, 'friend', 'Became friends with a neighbour', { other: heir });
h = Sim.chronicle(st, { farm: f.id }, 'land');
assert.deepStrictEqual(kindsOf(h), ['moved', 'claim', 'empty', 'inherited', 'holds'], 'every holder, handover, empty spell and claim since the start');
assert.strictEqual(h[2].note, 'Empty for 3 years'); assert.strictEqual(h[2].ev.t, emptied);
assert.ok(h.every((r) => r.ev.farm === f.id) && new Set(h.map((r) => r.ev.household)).size > 1, 'across households');
assert.ok(!kindsOf(Sim.chronicle(st, { farm: f.id })).some((k) => k === 'friend' || k === 'joined'), 'a farm\'s history has no personal events');
// while it stands empty the note counts to now
{
  const g = st.farmsteads[st.households[2].farmstead]; log(st, `${g.name} stands empty.`, { kind: 'empty', ...atFarm(g) });
  moveClock(st, Sim.YEAR + Sim.DAY);
  assert.strictEqual(Sim.chronicle(st, { farm: g.id }, 'land')[0].note, 'Empty since, 1 year');
}

// a pawn's history: its own events in its own words, its coming to a farm told once, and what it took part in as the other
const mine = Sim.chronicle(st, { pawn: other });
assert.deepStrictEqual(kindsOf(mine).slice(0, 3), ['friend', 'moved', 'claim'], 'joined is dropped beside the event that tells the move');
assert.strictEqual(kindsOf(mine)[mine.length - 1], 'born', 'back to its birth, before the start');
assert.ok(!kindsOf(Sim.chronicle(st, { pawn: heir })).includes('friend'), 'another\'s personal event is not in the history of the one it names');

// the filters, and the village's history
for (const [key, g] of Object.entries(Sim.CHRONICLE)) {
  assert.ok(g.label && Sim.chronicle(st, { village: 0 }, key).every((r) => g.kinds.includes(r.ev.kind)), `the filter ${key}`);
}
assert.ok(kindsOf(Sim.chronicle(st, { village: 0 }, 'life')).includes('died') && kindsOf(Sim.chronicle(st, { village: 0 }, 'land')).includes('claim'));
record(st, { kind: 'custom', village: 0, text: 'A new custom.' });
assert.deepStrictEqual(kindsOf(Sim.chronicle(st, { village: 0 }, 'custom')), ['custom']);

// the village log: the last n lines told to all, newest first
const all = Sim.villageLog(st, Infinity);
assert.ok(all.length < st.record.length && !all.some((e) => e.ev.kind === 'friend' || e.ev.kind === 'joined' || e.ev.kind === 'holds'));
for (let k = 0; k < 50; k++) log(st, `Line ${k}.`, { kind: 'year', n: k });
const last = Sim.villageLog(st);
assert.strictEqual(last.length, 40, 'its last 40 events'); assert.strictEqual(last[0].text, 'Line 49.'); assert.strictEqual(last[39].text, 'Line 10.');
assert.strictEqual(Sim.villageLog(st, 3).length, 3);
console.log(`chronicle ok: a farm's history across households (${kindsOf(h).join(', ')}; "${h[2].note}"), a pawn's and a village's, the filters, `
  + `and the village log as the record's last 40 lines`);
