// The clock counts whole 6-minute steps (VB-235): st.tick is its source of truth, so the same seed is the same run by any chunks of whole
// steps, and every hour's work runs in the step that reaches its hour, over decades, with no tolerance on a float.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, G = VB.gen, { sha, canon } = require('./lib/canon.js');
const { DAY, YEAR, TICKS } = VB['sim/rules'], { ticking } = VB['sim/clock'];
const { checkState } = require('./lib/invariants.js');

// 1. Populous, seed 7, tiny map, 2 years: the same state by chunks of a year, a day, an hour and 0.1 hours.
const world = () => { const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const hashes = [];
for (const chunk of [YEAR, DAY, 1, 0.1]) {
  const st = Sim.seed(world(), 7, 'populous'), t0 = st.t;
  for (let n = Math.round(2 * YEAR / chunk), k = 0; k < n; k++) Sim.advance(st, chunk);
  assert.strictEqual(st.tick, Math.round(t0 * TICKS) + 2 * YEAR * TICKS, `chunks of ${chunk} h: two years of whole steps`);
  assert.strictEqual(st.t, st.tick / TICKS, 'st.t is the count of steps in hours');
  assert.deepStrictEqual(checkState(st), [], `chunks of ${chunk} h: invariants`);
  const keys = Object.keys(st).filter((k) => k !== 'w').sort();
  hashes.push({ chunk, hash: sha(keys.map((k) => `${k}:${canon(st[k])}`).join('\n')), living: st.living.length });
}
for (const h of hashes.slice(1)) assert.strictEqual(h.hash, hashes[0].hash, `chunks of ${h.chunk} h give the run of chunks of a year`);

// 2. The clock's arithmetic alone over 60 years, by whole steps of several sizes: every hour begins exactly once, in order, on the step
// that reaches it, where st.t is that hour exactly; the hour read from the count never disagrees with the hour of st.t.
const YEARS = 60;
for (const sizes of [[YEAR], [0.1], [1, 0.7, 0.3, 2.5]]) {
  const st = { tick: 6 * TICKS, t: 6 }, end = 6 + YEARS * YEAR;
  let hour = 6, hours = 0, steps = 0;
  const each = (s) => {
    steps++;
    if (s.tick % TICKS === 0) {
      hour++; hours++;
      if (s.tick / TICKS !== hour || s.t !== hour) assert.fail(`sizes ${sizes}: hour ${hour} began at tick ${s.tick}, t ${s.t}`);
    }
    if (Math.floor(s.t) !== Math.floor(s.tick / TICKS)) assert.fail(`sizes ${sizes}: t ${s.t} is in another hour than tick ${s.tick}`);
  };
  for (let i = 0; st.tick < end * TICKS; i++) ticking(st, sizes[i % sizes.length], each);
  assert(hours >= YEARS * YEAR && hours === Math.floor(st.tick / TICKS) - 6, `sizes ${sizes}: ${hours} hours begun in ${YEARS} years`);
  assert.strictEqual(steps, st.tick - 6 * TICKS, `sizes ${sizes}: every step ended once`);
}
// 3. Whole steps only (VB-244): a part of a step, as a frame's worth, or a negative time is refused and leaves the state as it was.
for (const hours of [0.0731, 0.016, 0.05, 1.05, -0.1]) {
  const st = Sim.seed(world(), 7, 'populous'), before = sha(canon({ ...st, w: null }));
  assert.throws(() => Sim.advance(st, hours), /not a whole number of 6-minute steps/, `${hours} h is refused`);
  assert.strictEqual(sha(canon({ ...st, w: null })), before, `${hours} h refused leaves the state as it was`);
}
// 4. The calendar (VB-241): sim/clock's CALENDAR runs in the order recorded here, "cadence | place | owner | note". The order decides
// outcomes: an intended change of order, or a new entry, re-records ORDER (the failure prints the list as it is) and says so in the PR.
const { calendarRows, CALENDAR } = VB['sim/clock'];
const ORDER = [
  "hour | hour 6-21 | sim/relations | talk, and the hours at home",
  "hour |  | sim/agents | the dark ends: everyone indoors is by their door",
  "hour | hour 5-18 | sim/jobs | the review of the standing plans (sim/plans reviewHour)",
  "hour | hour 14-17 | sim/jobs | cooks called for the evening meal",
  "hour | hour 6-17 | sim/jobs | more urgent work interrupts a job (VB-107)",
  "hour | hour 18 | sim/agents | the work day ends: everyone free goes home",
  "day |  | sim/help | kin and the village give food to the short",
  "day |  | sim/hunger | meals, grain and ale spoil, the fire burns wood",
  "day |  | sim/stores | the village store spoils too",
  "day |  | sim/forest | trees grow",
  "day |  | sim/claims | unworked claims lapse, and the stakes and farm claims on them",
  "day |  | sim/paths | paths fade; a changed stage changes the cost of walking it",
  "day |  | sim/routes | cached routes refreshed",
  "day |  | sim/fields | crops grow, weeding falls due, untended fields go wild",
  "year | season 2, sday 11 | sim/fields | the autumn frost takes the crops still out",
  "day |  | sim/clock | empty farms decay, about 8% a year",
  "day |  | sim/clock | fences decay",
  "day |  | sim/herds | a new grazing spot for a herd whose old one was built on",
  "year | doy 2 | sim/herds | spring: the animals age, die, calve and lamb",
  "year |  | sim/meadows | the meadows are grass again",
  "year | season 2, sday 11 | sim/meadows | the autumn frost rots hay still lying",
  "day |  | sim/byre | food spoils, manure rots, the stalled herds eat their hay",
  "year | doy 31 | sim/byre | the autumn count: what goes to slaughter",
  "day |  | sim/lifecycle | ages, coming of age, orphans, the day's ties",
  "season |  | sim/relations | faded memories forgotten, ties to the dead dropped",
  "day |  | sim/lifecycle | the death rolls",
  "day |  | sim/births | births",
  "day |  | sim/lifecycle | marriage offers due close (VB-293)",
  "day |  | sim/service | the short of people taken in (VB-308)",
  "year | season 2, sday 9 | sim/occasions | the meeting's people called to the green (VB-126)",
  "year |  | sim/clock | the year begins: its weather",
  "year |  | sim/stores | ledgers of dissolved households expire",
  "year |  | sim/records | the record's fold of past years begins (VB-199)",
  "day |  | sim/records | the fold goes on, a slice a day (VB-199)",
  "step |  | sim/occasions | those asked set out, and occasions end (VB-126)",
  "step | tick 1-40 | sim/lifecycle | the night's culture, a settlement a step (VB-201)",
  "year | season 2, sday 9, hour 12, tick 0 | sim/lifecycle | the meetings, stage 0",
  "year | season 2, sday 9, hour 12, tick 1 | sim/lifecycle | the meetings, stage 1",
  "year | season 2, sday 9, hour 12, tick 2 | sim/lifecycle | the meetings, stage 2",
  "year | season 2, sday 9, hour 12, tick 3 | sim/lifecycle | the meetings, stage 3",
  "year | season 2, sday 10, hour 12, tick 0 | sim/lifecycle | the moving round, phase 0",
  "year | season 2, sday 10, hour 12, tick 1 | sim/lifecycle | the moving round, phase 1",
  "year | season 2, sday 10, hour 12, tick 2 | sim/lifecycle | the moving round, phase 2",
  "year | season 2, sday 10, hour 12, tick 3 | sim/lifecycle | the moving round, phase 3"
];
const rows = calendarRows(), now = rows.map((r) => [r.every, r.at, r.owner, r.note].join(' | '));
if (JSON.stringify(now) !== JSON.stringify(ORDER)) {
  assert.fail('the calendar is not in the recorded order; if the change is intended, ORDER in tests/clock.js becomes:\n'
    + now.map((x) => `  ${JSON.stringify(x)},`).join('\n'));
}
const modules = new Set(require('../src/manifest.json').map((f) => f.slice(0, -3)));
for (const r of rows) assert(modules.has(r.owner), `calendar: ${r.note}: its owner ${r.owner} is not a module of the manifest`);
assert(Object.isFrozen(CALENDAR) && CALENDAR.every((e) => Object.isFrozen(e)), 'the calendar is frozen');
// the plans' review hours are the calendar's (sim/plans reviewHour, which reviewAfter also reads)
const { reviewHour } = VB['sim/plans'], review = CALENDAR.find((e) => e.note.startsWith('the review of the standing plans'));
for (let h = 0; h < DAY; h++) assert.strictEqual(h >= review.at.hour[0] && h < review.at.hour[1], reviewHour(h), `review hour ${h}`);
console.log(`clock ok: populous 7 tiny, 2 years, one state by chunks of ${hashes.map((h) => h.chunk).join(', ')} h (${hashes[0].living} living); `
  + `${YEARS} years of the clock's arithmetic, every hour on its step; parts of a step refused; the calendar's ${rows.length} entries in order`);
