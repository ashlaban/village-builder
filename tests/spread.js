// Work spread over steps: the night's culture, a settlement a 6-minute step after midnight (VB-201); the autumn meetings on the steps from
// noon of autumn day 10, a village's a step, then the cultures' years and the land meeting (VB-206, VB-278); the moving round on the steps from noon of the next day, a village's round a step, then its three
// island-wide phases from 18:00 (VB-201, VB-277). Each runs exactly once whatever the advance calls' sizes, and a run saved between two of
// them goes on as the run that was never saved.
const assert = require('assert');
const calls = [], YEAR_H = 48 * 24; // sim/rules is loaded below; checked against it there
// Wrap before sim/clock destructures them, as tools/perf.js does.
const VB = require('./lib/load.js').loadModules({ wrap: {
  'sim/attitudes': {
    settlementStep: (step) => (env, hk, dt, rand, s) => { calls.push({ kind: 'culture', t: env.t * YEAR_H, s: s ? s.id : null }); return step(env, hk, dt, rand, s); },
  },
  'culture': {
    // the meetings (VB-278): a village's, a culture's year
    meeting: (meeting) => (env, hk, s) => { calls.push({ kind: 'meeting', t: env.t * YEAR_H, s: s.id }); return meeting(env, hk, s); },
    cultureYear: (year) => (env, hk, c) => { calls.push({ kind: 'cultureYear', t: env.t * YEAR_H, c: c.id }); return year(env, hk, c); },
  },
  'sim/territory': {
    landMeeting: (land) => (st) => { calls.push({ kind: 'land', t: st.t }); return land(st); },
  },
  'sim/round': {
    // a village's round is told by the counter of its walk of the living (VB-277), which only villageRound adds to
    roundPhase: (phase) => (st, n, d = 0) => {
      const walked = globalThis.VB.count.roundWalk, count = st.villages.length, r = phase(st, n, d);
      calls.push({ kind: 'round', t: st.t, tick: st.tick, n, d, count, villages: (globalThis.VB.count.roundWalk - walked) / st.living.length });
      return r;
    },
  },
} }), Sim = VB.sim, { canon, kept } = require('./lib/canon.js');
const { DAY, YEAR, YEAR_DAYS, SEASON_DAYS, TICKS, ASK } = VB['sim/rules'], { NIGHT_STEPS } = VB['sim/meetings'], { ROUND_STEPS } = VB['sim/round'];
// On the probe village alone since VB-853: the populous run on the tiny map (--extended) asserted the same rules, and was deleted.
const probe = require('./lib/probe.js'), seed = probe.state, restoreWorld = probe.world;
const st = seed();
assert.strictEqual(YEAR, YEAR_H);
// The saves below start from a copy of a run kept at the hour before their window, not from the seed each (VB-862: nine runs of a year or
// two took 4 of the script's 5 s): the state's plain data cloned and its world's arrays copied, as tests/lib/probe.js copies an island.
const copyRun = (s) => {
  const { w, ...rest } = s, data = structuredClone(rest), out = {};
  const ws = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, ArrayBuffer.isView(v) ? v.slice() : typeof v === 'function' || v === null || typeof v !== 'object' ? v : structuredClone(v)]));
  for (const k of Object.keys(s)) out[k] = k === 'w' ? ws : data[k];
  // the step's marks (sim/agents st.stepAt, a cache not saved and not enumerable) as the run has them: a copy without them would begin a
  // walk at the next step's calendar a step later than the run it copies (VB-475 found it: a journey set out at the moving round)
  if (s.stepAt) Object.defineProperty(out, 'stepAt', { value: { ...s.stepAt }, writable: true });
  return out;
};
const from = (base) => (at) => { Sim.advance(base, at - base.t); return copyRun(base); };
// to the day before the round, then across it and the next night in uneven advances
const roundDay = 2 * SEASON_DAYS + 10, start = Math.floor(st.t / YEAR) * YEAR + (roundDay - 1) * DAY;
Sim.advance(st, start + 23 - st.t);
const roundRun = from(copyRun(st));
calls.length = 0;
const sizes = [0.2, 0.4, 1.3, 0.1, 0.3, 2.5, 0.1, 0.1, 0.7]; // whole steps of uneven sizes (VB-244)
for (let i = 0, end = start + 3 * DAY; st.t < end - 1e-9; i++) Sim.advance(st, Math.min(sizes[i % sizes.length], end - st.t));
const days = calls.filter((c) => c.kind === 'round'), round = days.filter((c) => c.d === 0), roundVillages = round[0].count;
assert.strictEqual(ROUND_STEPS, 63, 'sixty steps for the villages, from noon to 18:00, then three phases');
// the round lasts ASK.passes days (VB-692): each day's steps once each, in order, from noon of autumn day 11 + d; the window above runs
// to the third day's midnight, so it holds the first two days, each in full
assert(ASK.passes >= 2, 'the round lasts more than a day');
for (const d of [0, 1]) {
  const day = days.filter((c) => c.d === d);
  assert.deepStrictEqual(day.map((c) => c.n), [...Array(ROUND_STEPS).keys()], `day ${d + 1}: each step of the round runs once, in order`);
  assert(day.every((c) => c.tick - (start + DAY + d * DAY) * TICKS === 12 * TICKS + c.n), `day ${d + 1} runs from noon`);
}
assert.deepStrictEqual(round.map((c) => c.n), [...Array(ROUND_STEPS).keys()], 'each step of the round runs once, in order');
for (const c of round) {
  const at = c.tick - (start + DAY) * TICKS; // in 6-minute steps since the round's midnight (sim/clock counts them, VB-235)
  assert(at === 12 * TICKS + c.n, `step ${c.n} runs on its step from noon (at step ${at} of the day)`);
  // the island has fewer than 60 villages: village k on step k, one a step; the phases from 18:00 hold none
  assert.strictEqual(c.villages, c.n < c.count ? 1 : 0, `step ${c.n} holds ${c.villages} villages' rounds`);
}
const nights = [start + DAY, start + 2 * DAY];
const villages = st.cenv.settlements.length;
assert(villages > 1 && villages < NIGHT_STEPS, 'the test needs a few settlements');
for (const night of nights) {
  const seen = calls.filter((c) => c.kind === 'culture' && c.t > night && c.t <= night + DAY / 2);
  const ids = seen.map((c) => c.s);
  // the night before the round may know fewer settlements than the round leaves (it can found one)
  const n = night === nights[nights.length - 1] ? st.cenv.settlements.length : ids.length - 1;
  assert.deepStrictEqual(ids, [null, ...st.cenv.settlements.slice(0, n).map((s) => s.id)], `each settlement drifts once a night, in order (${ids})`);
  assert(seen.every((c) => c.t - night < (NIGHT_STEPS + 3) * 0.1), 'all of it before the night is over');
}
// Saved between two phases of the round, and in the middle of the night: the loaded run matches the run that was never saved.
const saved = [];
assert(roundVillages === 2, 'the saves below fall between village 0 and village 1, and after the last village');
for (const [label, at] of [['between villages 0 and 1', start + DAY + 12], ['after the last village, before 18:00', start + DAY + 12.1],
  ['in the middle of the villages\' window', start + DAY + 15], ['between the round\'s phases', start + DAY + 18.1],
  ['in the night\'s culture', start + 2 * DAY + 0.5]]) {
  const a = roundRun(at);
  const data = JSON.parse(JSON.stringify(Sim.save(a))), b = Sim.load(restoreWorld(data), data);
  for (const run of [a, b]) for (let k = 0; k < 30; k++) Sim.advance(run, 0.1);
  const bad = [...new Set([...Object.keys(kept(a)), ...Object.keys(kept(b))])].filter((k) => k !== 'w' && canon(a[k]) !== canon(b[k]));
  assert.deepStrictEqual(bad, [], `saved ${label}: the loaded run differs in ${bad.join(', ')}`);
  saved.push(label);
}
// The meetings (VB-278): on autumn day 10, village k's meeting on step k from noon, each culture's year at 18:00 and the land meeting at
// 18:06, each once whatever the advances' sizes; saves between villages 0 and 1, in the middle of the window, after the last village and
// between the cultures' years and the land meeting go on as the unbroken run.
const mday = Math.floor(st.t / YEAR) * YEAR + (2 * SEASON_DAYS + 9) * DAY + YEAR; // next year's autumn day 10
const m = seed();
Sim.advance(m, mday + 11.5 - m.t);
const meetingRun = from(copyRun(m));
calls.length = 0;
const msizes = [0.2, 0.4, 0.1, 0.3, 0.7, 1.9];
for (let i = 0, end = mday + 19; m.t < end - 1e-9; i++) Sim.advance(m, Math.min(msizes[i % msizes.length], end - m.t));
const at = (c) => Math.round((c.t - mday - 12) * TICKS); // the step from noon it ran on
const met = calls.filter((c) => c.kind === 'meeting'), years = calls.filter((c) => c.kind === 'cultureYear'), lands = calls.filter((c) => c.kind === 'land');
const mvillages = m.cenv.settlements.length;
assert(m.villages.length === mvillages && mvillages <= 60, 'a village a step');
const myear = VB['sim/rules'].cal(mday + 12).year, first = myear % mvillages; // the order turns by the year (VB-280)
assert.deepStrictEqual(met.map((c) => c.s), [...Array(mvillages).keys()].map((j) => (j + first) % mvillages), 'each village meets once, in the order of id from year mod villages, wrapping');
met.forEach((c, j) => assert.strictEqual(at(c), j, `the ${j}th village (${c.s}) meets on step ${j} from noon (at ${at(c)})`));
assert.deepStrictEqual(years.map((c) => c.c), m.cenv.cultures.map((c) => c.id), "each culture's year once");
assert(years.every((c) => at(c) === 60), "the cultures' years at 18:00");
assert.strictEqual(lands.length, 1, 'the land meeting once');
assert.strictEqual(at(lands[0]), 61, 'the land meeting at 18:06');
assert.strictEqual(Math.round((m.lastMeeting - mday) * TICKS), 18 * TICKS, 'the meetings are done at 18:00');
for (const [label, at] of [['between villages 0 and 1', 12], ['after the last village', 12 + mvillages / TICKS],
  ["in the middle of the villages' window", 15], ['before the land meeting', 18]]) {
  const a = meetingRun(mday + at);
  const data = JSON.parse(JSON.stringify(Sim.save(a))), b = Sim.load(restoreWorld(data), data);
  for (const run of [a, b]) Sim.advance(run, 6.5);
  const bad = [...new Set([...Object.keys(kept(a)), ...Object.keys(kept(b))])].filter((k) => k !== 'w' && canon(a[k]) !== canon(b[k]));
  assert.deepStrictEqual(bad, [], `saved at the meetings, ${label}: the loaded run differs in ${bad.join(', ')}`);
  saved.push(`the meetings ${label}`);
}
console.log(`spread ok: ${mvillages} villages' meetings once each from noon, then the cultures' years and the land meeting; ${ROUND_STEPS} round steps once each from noon (${roundVillages} villages, then 3 phases), ${villages} settlements once a night in ${nights.length} nights, `
  + `saves ${saved.join(' and ')} go on unchanged (${YEAR_DAYS}-day year)`);
