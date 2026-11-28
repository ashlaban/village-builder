// @suite fast
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
// VB-1027: a move between farms is one event, told on both: the farm left tells the leaving, the farm come to the coming
{
  moveClock(st, Sim.DAY); // another hour than the claim's moving in, which would tell the coming in its place
  const g = st.farmsteads[st.households[2].farmstead], who = st.households[2].members.find((m) => m !== st.households[2].holder) ?? st.households[2].holder;
  personEvent(st, who, 'moved', `Moved to ${f.name}`, { household: 1, farm: f.id, village: f.village, kind: 'joined', reason: 'found', fromFarm: g.id });
  const name = Sim.fullName(st.pawns[who]), left = Sim.chronicle(st, { farm: g.id }), came = Sim.chronicle(st, { farm: f.id }, 'land');
  assert.ok(left.some((r) => r.text === `${name} left ${g.name} for the new farmstead ${f.name}.`), 'the farm left tells who left it, and for where');
  assert.ok(came.some((r) => r.text === `${name} came to ${f.name} from ${g.name}.`), 'the farm come to tells who came, and from where');
  assert.strictEqual(st.record.filter((e) => e.kind === 'joined' && e.pawn === who).length, 1, 'one event of the record, read from either end');
  assert.ok(!Sim.chronicle(st, { village: f.village }).some((r) => r.ev.kind === 'joined'), 'the village\'s history does not tell it');
}
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
// VB-1117: a father's History holds his children's births and their deaths, as the mother's does (read from the child's father)
{
  const fa = st.pawns[first], mo = st.pawns.find((q) => q.id !== first && q.sex !== fa.sex);
  const kid = (given) => {
    const id = st.pawns.length;
    st.pawns.push({ ...fa, id, given, father: first, mother: mo.id, events: [], alive: true, age: 0 });
    record(st, { kind: 'born', pawn: id, other: mo.id, text: given + ' was born.', t: st.t, village: 0 });
    return id;
  };
  const lines = () => Sim.chronicle(st, { pawn: first }, 'life').filter((r) => st.pawns[r.ev.pawn].father === first);
  const was = lines().length; // children seeded before
  const a = kid('Ann');
  kid('Bea');
  assert.strictEqual(lines().length - was, 2, "two births in the father's history");
  record(st, { kind: 'died', pawn: a, text: 'killed', t: st.t, village: 0 });
  assert.strictEqual(lines().length - was, 3, "a child's death is his too");
}

console.log(`chronicle ok: a farm's history across households (${kindsOf(h).join(', ')}; "${h[2].note}"), a pawn's and a village's, the filters, `
  + `and the village log as the record's last 40 lines`);

// VB-1102: a year's routine events fold into one line, opening to the events it holds; the record is unchanged
{
  const pw = st.households[0].holder, fm = st.farmsteads[st.households[0].farmstead];
  const y0 = Math.floor(st.t / Sim.YEAR) + 1;
  st.t = y0 * Sim.YEAR; const before = st.record.length;
  personEvent(st, pw, 'born', 'A child', { kind: 'born', pawn: pw, farm: fm.id, village: fm.village });
  const nb = st.record.length;
  for (let d = 1; d <= 10; d++) { st.t = y0 * Sim.YEAR + (d + 5) * Sim.DAY; personEvent(st, pw, 'helped', `Helped at ${fm.name}`, { farm: fm.id, household: 0, village: fm.village }); }
  const raw = Sim.chronicle(st, { pawn: pw }), lines = Sim.chronicle(st, { pawn: pw }, null, 50);
  const mine = lines.filter((r) => Math.floor(r.ev.t / Sim.YEAR) === y0);
  assert.strictEqual(mine.length, 2, mine.map((r) => r.text).join(' | '));
  assert.ok(mine[0].fold && mine[0].fold.length === 10 && /^Helped at .*: 10 days\.$/.test(mine[0].text), mine[0].text);
  assert.ok(mine[1].ev.t < mine[0].ev.t && !mine[1].fold, 'the birth, earlier, follows the fold in a newest-first list');
  assert.strictEqual(raw.filter((r) => r.ev.kind === 'helped').length, 10, 'unfolded without a limit');
  assert.strictEqual(st.record.length, nb + 10, 'the fold adds nothing to the record');
}
