// The autumn meetings spread over steps (VB-206): four stages on the 6-minute steps from noon of autumn day 10, each once, in order, whatever the
// advance calls' sizes; a run saved between two stages goes on as the run that was never saved.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, G = VB.gen, { canon } = require('./lib/canon.js');
const { DAY, YEAR, SEASON_DAYS } = VB['sim/rules'], { MEETING_STAGES } = VB['sim/lifecycle'];
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'populous');
const day = Math.floor(st.t / YEAR) * YEAR + (2 * SEASON_DAYS + 9) * DAY; // autumn day 10 begins
Sim.advance(st, day + 11.5 - st.t);
const seen = [], sizes = [0.05, 0.37, 0.1, 0.02, 0.33];
for (let i = 0, end = day + 13; st.t < end - 1e-9; i++) {
  const before = st.lastMeeting; Sim.advance(st, Math.min(sizes[i % sizes.length], end - st.t));
  if (st.lastMeeting !== before) seen.push(st.lastMeeting - day);
}
assert.strictEqual(seen.length, 1, 'the customs run once');
assert(seen[0] >= 12.19 && seen[0] <= 12.31, `on the third step from noon (at ${seen[0]})`);
const saved = [];
for (const at of [12.05, 12.15, 12.25]) { // before the first stage's end, between stages
  const a = Sim.seed(world(7), 7, 'populous');
  Sim.advance(a, day + at - a.t);
  const data = JSON.parse(JSON.stringify(Sim.save(a))), b = Sim.load(world(data.seed), data);
  for (const run of [a, b]) Sim.advance(run, 1);
  const bad = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => k !== 'w' && canon(a[k]) !== canon(b[k]));
  assert.deepStrictEqual(bad, [], `saved at ${at}: the loaded run differs in ${bad.join(', ')}`);
  saved.push(at);
}
console.log(`spread ok: ${MEETING_STAGES} meeting stages on the steps from noon, customs once, saves at ${saved.join(', ')} go on unchanged`);
