// Random streams (VB-072): a stream gives mulberry32's sequence and survives a JSON copy; each system has its own, so extra draws in one
// leave the others' next values unchanged.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/rng'];

const a = R.fromState(12345), m = G.mulberry32(12345);
for (let i = 0; i < 1000; i++) assert.strictEqual(R.next(a), m(), `draw ${i} differs from mulberry32`);
const copy = JSON.parse(JSON.stringify(a));
for (let i = 0; i < 100; i++) assert.strictEqual(R.next(copy), R.next(a), 'a JSON copy continues identically');
const f = R.fromState(1); f.fix = 0;
assert.strictEqual(R.next(f), 0); assert.strictEqual(f.s, 1, 'a fixed stream does not advance');

const run = (extra) => {
  const st = require('./lib/probe.js').state();
  assert.deepStrictEqual(Object.keys(st.rng).sort(), [...R.SYSTEMS].sort(), 'one stream per system after seeding');

  for (let i = 0; i < extra; i++) R.next(st.rng.work);
  return { births: [0, 1, 2].map(() => R.next(st.rng.births)), deaths: [0, 1, 2].map(() => R.next(st.rng.deaths)), work: R.next(st.rng.work) };
};
const plain = run(0), more = run(1000);
assert.deepStrictEqual(more.births, plain.births, 'births stream untouched by draws on work');
assert.deepStrictEqual(more.deaths, plain.deaths, 'deaths stream untouched by draws on work');
assert.notStrictEqual(more.work, plain.work, 'the work stream did advance');
const names = R.SYSTEMS.map((k) => R.makeStream(7, k).s);
assert.strictEqual(new Set(names).size, names.length, 'systems start from different states');
console.log(`rng ok: mulberry32's sequence, JSON copies continue, fix holds; tiny village: 1,000 draws on work leave births ${plain.births.map((x) => x.toFixed(3)).join(' ')} and deaths unchanged`);
