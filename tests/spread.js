// Work spread over steps (VB-201): the night's culture, a settlement a 6-minute step after midnight, and the moving round's phases on the
// steps from noon of autumn day 10. Each runs exactly once a day whatever the advance calls' sizes, and a run saved between two of them
// goes on as the run that was never saved.
const fs = require('fs'), path = require('path'), assert = require('assert');
const calls = [], YEAR_H = 48 * 24; // sim/rules is loaded below; checked against it there
// Wrap before sim/clock destructures them, as tools/perf.js does.
for (const f of JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8'))) {
  require('../src/' + f);
  const key = f.slice(0, -3), mod = globalThis.VB[key];
  if (key === 'culture') {
    const step = mod.settlementStep;
    mod.settlementStep = (env, hk, dt, rand, s) => { calls.push({ kind: 'culture', t: env.t * YEAR_H, s: s ? s.id : null }); return step(env, hk, dt, rand, s); };
  }
  if (key === 'sim/lifecycle') {
    const phase = mod.roundPhase;
    mod.roundPhase = (st, n) => { calls.push({ kind: 'round', t: st.t, n }); return phase(st, n); };
  }
}
const VB = globalThis.VB, Sim = VB.sim, G = VB.gen, { canon } = require('./lib/canon.js');
const { DAY, YEAR, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'], { NIGHT_STEPS, ROUND_PHASES } = VB['sim/lifecycle'];
const world = (seed, size) => { const it = G.generate(seed, size); let r; while (!(r = it.next()).done); return r.value; };
const TINY = { cols: 120, rows: 85 };
const st = Sim.seed(world(7, TINY), 7, 'populous');
assert.strictEqual(YEAR, YEAR_H);
// to the day before the round, then across it and the next night in uneven advances
const roundDay = 2 * SEASON_DAYS + 10, start = Math.floor(st.t / YEAR) * YEAR + (roundDay - 1) * DAY;
Sim.advance(st, start + 23 - st.t);
calls.length = 0;
const sizes = [0.05, 0.37, 1.3, 0.1, 0.02, 2.5, 0.1, 0.1, 0.33];
for (let i = 0, end = start + 3 * DAY; st.t < end - 1e-9; i++) Sim.advance(st, Math.min(sizes[i % sizes.length], end - st.t));
const round = calls.filter((c) => c.kind === 'round');
assert.deepStrictEqual(round.map((c) => c.n), [...Array(ROUND_PHASES).keys()], 'each phase of the round runs once, in order');
for (const c of round) {
  const at = c.t - (start + DAY);
  assert(at >= 12 + c.n * 0.1 && at < 12 + (c.n + 1) * 0.1 + 2.5, `phase ${c.n} runs on its step from noon, not before (at ${at} h)`);
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
for (const [label, at] of [['between the round\'s phases', start + DAY + 12.15], ['in the night\'s culture', start + 2 * DAY + 0.55]]) {
  const a = Sim.seed(world(7, TINY), 7, 'populous');
  Sim.advance(a, at - a.t);
  const data = JSON.parse(JSON.stringify(Sim.save(a))), b = Sim.load(world(data.seed, { cols: data.cols, rows: data.rows }), data);
  for (const run of [a, b]) for (let k = 0; k < 30; k++) Sim.advance(run, 0.1);
  const bad = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => k !== 'w' && canon(a[k]) !== canon(b[k]));
  assert.deepStrictEqual(bad, [], `saved ${label}: the loaded run differs in ${bad.join(', ')}`);
  saved.push(label);
}
console.log(`spread ok: ${ROUND_PHASES} round phases once each from noon, ${villages} settlements once a night in ${nights.length} nights, `
  + `saves ${saved.join(' and ')} go on unchanged (${YEAR_DAYS}-day year)`);
