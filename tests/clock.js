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

// 2. The clock's arithmetic alone over 60 years, by whole steps of several sizes and by frame-sized parts (as the page asks): every hour
// begins exactly once, in order, on the pass that ends its first step, where st.t is that hour exactly; the hour read from the count never
// disagrees with the hour of st.t.
const YEARS = 60;
for (const sizes of [[YEAR], [0.1], [1, 0.7, 0.3, 2.5], [0.0731, 0.016, 0.05]]) {
  const st = { tick: 6 * TICKS, tickPart: 0, t: 6 }, end = 6 + YEARS * YEAR;
  let hour = 6, hours = 0, steps = 0;
  const each = (s, part, ends) => {
    if (ends) steps++;
    if (ends && s.tick % TICKS === 0) {
      hour++; hours++;
      if (s.tick / TICKS !== hour || s.t !== hour) assert.fail(`sizes ${sizes}: hour ${hour} began at tick ${s.tick}, t ${s.t}`);
    }
    if (Math.floor(s.t) !== Math.floor(s.tick / TICKS)) assert.fail(`sizes ${sizes}: t ${s.t} is in another hour than tick ${s.tick}`);
  };
  for (let i = 0; st.tick < end * TICKS; i++) ticking(st, sizes[i % sizes.length], each);
  assert(hours >= YEARS * YEAR && hours === Math.floor(st.tick / TICKS) - 6, `sizes ${sizes}: ${hours} hours begun in ${YEARS} years`);
  assert.strictEqual(steps, st.tick - 6 * TICKS, `sizes ${sizes}: every step ended once`);
}
console.log(`clock ok: populous 7 tiny, 2 years, one state by chunks of ${hashes.map((h) => h.chunk).join(', ')} h (${hashes[0].living} living); `
  + `${YEARS} years of the clock's arithmetic, every hour on its step, by whole and frame-sized chunks`);
