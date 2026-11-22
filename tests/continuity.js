// Compare current runs to each other, never to an approved historical fingerprint.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { world, state } = require('./lib/probe.js'), { canon, kept } = require('./lib/canon.js');
const { checkState } = require('./lib/invariants.js');
function plain(value, seen = new Set()) {
  assert.notStrictEqual(typeof value, 'function', 'simulation state must contain no functions');
  if (!value || typeof value !== 'object' || seen.has(value) || ArrayBuffer.isView(value)) return;
  seen.add(value);
  for (const child of value instanceof Map ? [...value].flat() : value instanceof Set ? value : Object.values(value)) plain(child, seen);
}
const a = state(), b = state();
for (let day = 0; day < 3; day++) {
  for (const s of [a, b]) Sim.advance(s, Sim.DAY);
  plain({ ...a, w: null });
  assert.deepStrictEqual(checkState(a), [], `day ${day + 1}: invariants`);
}
assert.strictEqual(canon(a), canon(b), 'same seed and inputs repeat exactly');
Sim.advance(a, 0.7); // mid-hour caches must also survive JSON
const loaded = Sim.load(world(), JSON.parse(JSON.stringify(Sim.save(a))));
for (const s of [a, loaded]) Sim.advance(s, Sim.DAY);
for (const k of new Set([...Object.keys(kept(a)), ...Object.keys(kept(loaded))])) {
  if (k !== 'w') assert.strictEqual(canon(a[k]), canon(loaded[k]), `continued state ${k}`);
}
for (const k of ['trees', 'treesMax', 'stones', 'biome', 'dev', 'wear', 'worn', 'tr', 'tg', 'tb'])
  assert.strictEqual(canon(a.w[k]), canon(loaded.w[k]), `continued world ${k}`);
assert.deepStrictEqual(checkState(loaded), [], 'loaded continuation invariants');
console.log('continuity: repeatability, daily invariants and JSON save/load continuation pass');
// VB-1191: a plot given up leaves a gap in a village's numbers, which is no fault; a number used twice is
{
  const s = state(), v = s.villages[0];
  v.plots.push({ id: 0, village: v.id, farmstead: 0, tiles: [] }, { id: 2, village: v.id, farmstead: 0, tiles: [] });
  assert(!checkState(s).some((m) => /plots numbered/.test(m)), 'a gap in plot numbers is allowed');
  v.plots.push({ id: 2, village: v.id, farmstead: 0, tiles: [] });
  assert(checkState(s).some((m) => /plots numbered/.test(m)), 'a number twice is caught');
}
