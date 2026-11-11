// VB-197: rule contracts, original death rolls, bounded heap use, and the registry's diagnostic CLI.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const cp = require('child_process'), os = require('os'), zlib = require('zlib');
const root = path.join(__dirname, '..');
// An isolated load permits small rules without changing the simulation registry.
const sandbox = { VB: { count: { ruleValue: 0 } } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/sim/registry.js'), 'utf8'), sandbox);
const R = sandbox.VB['sim/registry'];
const product = { id: 'product', owner: 'test', combine: 'product', base: () => 2 };
R.declare(product); product.base = () => 100; // declarations copy their inputs
const factor = { rule: 'product', key: 'a', source: 'test', label: 'A', range: [1, 4], tunables: ['a'], value: () => 3 };
R.contribute(factor); factor.value = () => 100; factor.range[0] = 99; factor.tunables.push('b');
R.contribute({ ...factor, key: 'neutral', range: [1, 1], value: () => 1 });
assert.strictEqual(R.value(null, 'product', null), 6);
assert.strictEqual(R.explain(null, 'product', null).value, 6);
assert.strictEqual(R.list()[0].contributions[0].range[0], 1);
assert.strictEqual(R.list()[0].contributions[0].tunables.length, 1);
assert(Object.isFrozen(R.list()) && Object.isFrozen(R.list()[0].contributions[0].range));
const sumBounds = [-2, 12];
R.declare({ id: 'sum', owner: 'test', combine: 'sum', base: () => 10, clamp: sumBounds });
sumBounds[1] = 100; // bounds are copied, and explanations must not expose the stored array
R.contribute({ ...factor, rule: 'sum', key: 'term', range: [-20, 20], value: (st, n) => n });
R.contribute({ ...factor, rule: 'sum', key: 'neutral', range: [0, 0], value: () => 0 });
for (const [term, result] of [[1, 11], [5, 12], [-20, -2]]) {
  const explanation = R.explain(null, 'sum', term);
  assert.strictEqual(R.value(null, 'sum', term), result);
  assert.strictEqual(explanation.value, result);
  assert.strictEqual(explanation.combine, 'sum');
  assert.strictEqual(explanation.unclamped, 10 + term);
  assert.deepStrictEqual(Array.from(explanation.clamp), [-2, 12]);
  explanation.clamp[1] = 100;
  assert.strictEqual(R.value(null, 'sum', 5), 12, 'explanations cannot mutate the stored clamp');
}
const productExplanation = R.explain(null, 'product', null);
assert.strictEqual(productExplanation.combine, 'product');
assert.strictEqual(productExplanation.unclamped, 6);
assert.strictEqual(productExplanation.clamp, null);
assert.deepStrictEqual(Array.from(R.list().find((r) => r.rule === 'sum').clamp), [-2, 12]);
// Diagnostics catch bad providers before they can silently poison a simulation rule.
R.declare({ id: 'checked-base', owner: 'test', combine: 'sum', base: (st, n) => n });
R.declare({ id: 'checked-factor', owner: 'test', combine: 'product', base: () => 1 });
R.contribute({ ...factor, rule: 'checked-factor', key: 'bad', range: [0, 2], value: (st, n) => n });
for (const n of [NaN, Infinity, -Infinity, undefined, null, '1']) {
  assert.throws(() => R.explain(null, 'checked-base', n), /checked-base.*base \(test\).*non-finite/);
  assert.throws(() => R.explain(null, 'checked-factor', n), /checked-factor.*bad \(test\).*non-finite/);
}
for (const n of [-1, 3]) assert.throws(() => R.explain(null, 'checked-factor', n), /checked-factor.*bad \(test\).*outside/);
for (const n of [0, 2]) assert.strictEqual(R.explain(null, 'checked-factor', n).value, n, 'range endpoints are valid');
for (const combine of ['sum', 'product']) {
  const id = 'overflow-' + combine;
  R.declare({ id, owner: 'test', combine, base: () => Number.MAX_VALUE, clamp: [0, 10] });
  R.contribute({ ...factor, rule: id, key: 'overflow', range: [0, Number.MAX_VALUE],
    value: () => combine === 'sum' ? Number.MAX_VALUE : 2 });
  assert.throws(() => R.explain(null, id, null), /combined value.*overflow.*non-finite/, 'clamps must not hide arithmetic overflow');
}
assert.throws(() => R.declare({ ...product, combine: 'min' }), /Invalid/);
assert.throws(() => R.declare(product), /Duplicate/);
assert.throws(() => R.contribute({ ...factor, range: [2, 1] }), /Invalid/);
assert.throws(() => R.contribute({ ...factor, range: [1, 4] }), /Duplicate/);
assert.throws(() => R.value(null, 'missing', null), /Unknown/);
// A contribution may come before its rule; a product rule's term needs a range, a sum rule's does not; a declared order names every key.
R.contribute({ ...factor, rule: 'early', key: 'second', range: [1, 2], value: () => 2 });
R.contribute({ ...factor, rule: 'early', key: 'first', range: [1, 2], value: () => 3 });
assert.throws(() => R.contribute({ ...factor, rule: 'early', key: 'second', range: [1, 2] }), /Duplicate/);
R.contribute({ ...factor, rule: 'early', key: 'bad', range: [1, 1], value: () => 1 });
R.declare({ id: 'early', owner: 'test', combine: 'product', base: () => 1, order: ['first', 'second', 'bad'] });
R.declare({ id: 'open', owner: 'test', combine: 'sum', base: () => 1, clamp: [0, Infinity] });
R.contribute({ ...factor, rule: 'open', key: 'free', range: undefined, value: () => 1e12 });
assert.strictEqual(R.explain(null, 'open', null).value, 1e12 + 1);
assert.throws(() => R.contribute({ ...factor, rule: 'open', key: 'x', range: [2, 1] }), /Invalid/);
assert.throws(() => R.declare({ id: 'norange', owner: 'test', combine: 'product', base: () => 1 }) || R.contribute({ ...factor, rule: 'norange', key: 'n', range: undefined }), /needs a range/);
R.contribute({ ...factor, rule: 'missing', key: 'orphan', range: [1, 4] });
assert.throws(() => R.seal(), /never declared: missing/, 'seal fails while a rule is missing');
R.declare({ id: 'missing', owner: 'test', combine: 'product', base: () => 1 });
R.seal(); R.seal();
assert.deepStrictEqual(Array.from(R.list().find((r) => r.rule === 'early').contributions.map((c) => c.key)), ['first', 'second', 'bad'], 'the declared order applies at seal');
{ // a declared order must name every contribution
  const box = { VB: { count: { ruleValue: 0 } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/sim/registry.js'), 'utf8'), box);
  const Q = box.VB['sim/registry'];
  Q.declare({ id: 'r', owner: 'test', combine: 'sum', base: () => 1, order: ['nope'] });
  Q.contribute({ ...factor, rule: 'r', key: 'k', range: undefined });
  assert.throws(() => Q.seal(), /order \[nope\]/);
}
{ // a rule that names causes refuses a factor that may fall below 1 (VB-207)
  const box = { VB: { count: { ruleValue: 0 } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/sim/registry.js'), 'utf8'), box);
  const Q = box.VB['sim/registry'];
  Q.declare({ id: 'r', owner: 'test', combine: 'product', base: () => 0.5, baseCause: () => 'base' });
  Q.contribute({ ...factor, rule: 'r', key: 'k', cause: 'c', range: [0.5, 2], value: () => 1 });
  assert.throws(() => Q.seal(), /may fall below 1/);
}
assert.throws(() => R.declare({ ...product, id: 'late' }), /load time/);
assert.throws(() => R.contribute(factor), /load time/);

const VB = require('../src/load.js'), Sim = VB.sim, Rules = VB['sim/registry'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const villages = Array.from({ length: 10 }, (_, i) => ({ at: [18 + (i % 5) * 36, 20 + Math.floor(i / 5) * 40],
  farms: 10, sizes: Array(10).fill(10) }));
const st = tinyState(tinyWorld(Array(85).fill('.'.repeat(200))), villages, { seed: 7 });
assert.strictEqual(st.scenario, 'populous');
assert.strictEqual(st.pawns.length, 1000, 'explain 1,000 distinct populous pawns');
assert.throws(() => Rules.declare({ ...product, id: 'late' }), /load time/);
assert.throws(() => Rules.contribute({ ...factor, rule: 'death.hazard' }), /load time/);
const { YEAR, YEAR_DAYS, hazard, HUNGER, HEALTH } = VB['sim/rules'];
const legacyValue = (s, p) => hazard((s.t - p.born) / YEAR) / YEAR_DAYS
  * (1 + HUNGER.k(Math.floor((s.t - p.born) / YEAR)) * p.hunger)
  * (p.health < HEALTH.riskBelow ? 1 + (HEALTH.riskBelow - p.health) / HEALTH.riskSlope : 1);
function legacyRoll(s, p) {
  const a = (s.t - p.born) / YEAR, base = hazard(a) / YEAR_DAYS, u = VB['sim/rng'].next(s.rng.deaths);
  if (p.health <= 0) return 'starvation';
  if (u >= legacyValue(s, p)) return null;
  return u >= base ? 'hunger' : a < 1 ? 'infancy' : a < 15 ? 'childhood' : a < 60 ? 'illness' : 'oldAge';
}
VB.resetCounts();
for (const p of st.pawns) {
  p.hunger = (p.id % 11) / 10; p.health = p.id % 101;
  const explanation = Rules.explain(st, 'death.hazard', p), value = Rules.value(st, 'death.hazard', p);
  assert.strictEqual(value, legacyValue(st, p), 'bit-identical original hazard');
  assert.strictEqual(explanation.value, value);
  assert.strictEqual(explanation.parts.reduce((n, c) => n * c.factor, explanation.base), value);
  assert.deepStrictEqual(explanation.parts.map((c) => c.cause), ['hunger', 'hunger']);
  const before = st.rng.deaths.s, expected = legacyRoll(st, p), after = st.rng.deaths.s;
  st.rng.deaths.s = before;
  assert.strictEqual(VB['sim/deaths'].deathRoll(st, p), expected);
  assert.strictEqual(st.rng.deaths.s, after, 'one draw even for starvation');
}
const calls = VB.count.ruleValue;
Rules.explain(st, 'death.hazard', st.pawns[0]);
assert.strictEqual(VB.count.ruleValue, calls, 'explanations are not hot-path reads');
// Boundary rolls include an exact base threshold, total hazard and a zero-health pawn.
for (const a of [0, 0.9999, 1, 4.9999, 5, 14.9999, 15, 59.9999, 60, 90]) {
  for (const health of [0, 1, 49.999, 50, 100]) for (const hunger of [0, 0.5, 1]) {
    const p = { born: -a * YEAR, health, hunger }, state = { t: 0, rng: { deaths: VB['sim/rng'].fromState(7) } };
    assert.strictEqual(Rules.value(state, 'death.hazard', p), legacyValue(state, p));
    for (const u of [0, hazard(a) / YEAR_DAYS, legacyValue(state, p), 0.99999]) {
      state.rng.deaths.fix = u;
      assert.strictEqual(VB['sim/deaths'].deathRoll(state, p), legacyRoll(state, p));
    }
  }
}
assert(global.gc, 'run registry.js with node --expose-gc');
// This checks retained memory only. GC can reclaim temporary allocations, so it does not measure allocation rate.
// The hot path and its helpers are also reviewed for per-call containers/closures; provider callbacks need the same discipline.
const p = st.pawns[1]; let sink = 0;
for (let i = 0; i < 100000; i++) sink += Rules.value(st, 'death.hazard', p);
global.gc();
const heap = process.memoryUsage().heapUsed, start = process.hrtime.bigint();
for (let i = 0; i < 1000000; i++) sink += Rules.value(st, 'death.hazard', p);
const ns = Number(process.hrtime.bigint() - start) / 1000000;
global.gc();
const growth = process.memoryUsage().heapUsed - heap;
assert(growth < 1000000, 'million value reads retain under 1 MB: ' + growth);
assert(Number.isFinite(sink));
// CLI accepts new runs and both plain/gzipped saves, and refuses an unknown pawn.
const invoke = (args) => cp.execFileSync(process.execPath, [path.join(root, 'tools/rules.js'), ...args], { encoding: 'utf8' });
const rows = JSON.parse(invoke(['--json']));
const row = (id) => rows.find((x) => x.rule === id);
assert.deepStrictEqual(row('death.hazard').contributions.map((c) => c.key), ['hunger', 'frailty']);
assert.deepStrictEqual(row('allowance').contributions.map((c) => c.key), ['slack', 'goodwill', 'opinion', 'reserve']); // VB-216, VB-217, VB-220
assert(invoke([]).includes('HEALTH.riskBelow'));
const cliExplanation = JSON.parse(invoke(['--explain', '0', '--json']));
assert.strictEqual(cliExplanation.pawn, 0);
assert.strictEqual(cliExplanation.combine, 'product');
assert.strictEqual(cliExplanation.unclamped, cliExplanation.value);
assert.strictEqual(cliExplanation.clamp, null);
const it = VB.gen.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const run = Sim.seed(r.value, 7, 'populous'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-rules-'));
try {
  const saved = JSON.stringify(Sim.save(run));
  for (const ext of ['.json', '.json.gz']) {
    const file = path.join(dir, 'save' + ext);
    fs.writeFileSync(file, ext.endsWith('.gz') ? zlib.gzipSync(saved) : saved);
    const result = JSON.parse(invoke(['--load', file, '--explain', '0', '--json']));
    assert.strictEqual(result.value, Rules.value(run, 'death.hazard', run.pawns[0]));
    assert.strictEqual(result.t, run.t);
  }
  const bad = cp.spawnSync(process.execPath, [path.join(root, 'tools/rules.js'), '--explain', '999999'], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 1); assert(bad.stderr.includes('Unknown pawn'));
  // Loading first also seals the registry in a fresh process.
  const child = cp.spawnSync(process.execPath, ['-e', `
    const loadedVB = require('./src/load.js'), fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.argv[1]));
    const it = loadedVB.gen.generate(data.seed, {cols:data.cols, rows:data.rows}); let r; while (!(r=it.next()).done);
    loadedVB.sim.load(r.value, data);
    require('assert').throws(() => loadedVB['sim/registry'].declare({}), /load time/);
  `, path.join(dir, 'save.json')], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(child.status, 0, child.stderr);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log(`registry: 1,000 pawns bit-identical; million reads ${(growth / 1024).toFixed(1)} KiB retained heap change, ${ns.toFixed(1)} ns/read; diagnostics/CLI ok`);
