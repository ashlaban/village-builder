// The fixture cache (VB-272), on tiny stand-in saves in a scratch directory: no simulation run here (tests/fixtures.js loads real ones).
const assert = require('assert'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const F = require('./lib/fixtures.js'), { runYears, clean } = require('../tools/fixtures.js');
fs.mkdirSync(path.join(F.root, 'work'), { recursive: true });
const dir = fs.mkdtempSync(path.join(F.root, 'work/fixture-tools-')), notice = () => {};
// One run a map: each fixture falls due after its years, or (VB-202) at the first year's end with enough living, by its last year.
function years(defs, livingByYear) {
  const st = { year: 0, pawns: [] }, due = {}, Sim = { YEAR: 1, advance(s) {
    s.year++; s.pawns = Array.from({ length: livingByYear(s.year) }, () => ({ alive: true })).concat([{ alive: false }]);
  } };
  return { last: runYears(Sim, st, defs, (name, year) => { due[name] = year; }), due };
}
const ref = { living: 1000, maxYear: 60 };
assert.deepStrictEqual(years({ a: { year: 5 } }, () => 9999), { last: 5, due: { a: 5 } }, 'a fixed fixture runs its years whatever the living');
assert.deepStrictEqual(years({ a: { year: 5 }, b: { year: 40 } }, () => 1), { last: 40, due: { a: 5, b: 40 } }, 'one run saves both as it passes them');
assert.deepStrictEqual(years({ a: { year: 5 }, r: ref }, (y) => 900 + 10 * y), { last: 10, due: { a: 5, r: 10 } }, 'the first year with 1,000 living');
assert.deepStrictEqual(years({ a: { year: 5 }, r: ref }, () => 5000), { last: 5, due: { r: 1, a: 5 } }, 'a target met early does not end the run');
assert.strictEqual(years({ r: ref }, () => 999).last, 60, 'never reached: stops at the last year');
assert.strictEqual(F.spec('medium-ref').living, 1000);
assert(!Object.hasOwn(F.FIXTURES, 'medium-y60'), 'medium-y60 was dropped (Kim, 8 November)');
for (const map of ['small', 'medium']) {
  const sizes = new Set(Object.values(F.FIXTURES).filter((d) => d.map === map).map((d) => `${d.cols}x${d.rows}`));
  assert.strictEqual(sizes.size, 1, `the ${map} fixtures are saves of one run, on one map`);
}
// The key names the sources: 16 hex digits, the same at each reading, and the directory the files lie in.
const key = F.key();
assert(/^[a-f0-9]{16}$/.test(key) && key === F.key());
assert.strictEqual(path.dirname(F.files('small-y5', dir).save), path.join(dir, key));
const stampFor = (name, compressed, k = key) => {
  const def = F.spec(name), byLiving = def.living !== undefined;
  return { name, key: k, commit: 'test', format: F.format(), year: byLiving ? 14 : def.year,
    ...(byLiving ? { target: def.living, reached: true } : {}), living: byLiving ? def.living : 1, pawnRecords: 1, events: 0, minutes: 0,
    jsonBytes: 1, gzipBytes: compressed.length, saveHash: F.hash(compressed) };
};
const header = (def, more = {}) =>
  zlib.gzipSync(JSON.stringify({ format: F.format(), seed: F.SEED, scenario: F.SCENARIO, cols: def.cols, rows: def.rows, ...more }));
try {
  assert.throws(() => F.status('../golden'), /unknown fixture/);
  assert.strictEqual(F.status('small-y5', { dir }).status, 'missing');
  assert.strictEqual(F.loadFixture('small-y5', { dir, notice }), null, 'a missing fixture of another directory is not made');
  for (const [name, def] of Object.entries(F.FIXTURES)) { const z = header(def); F.writeFixture(name, z, stampFor(name, z), { dir }); }
  for (const name of Object.keys(F.FIXTURES)) assert.strictEqual(F.status(name, { dir }).status, 'made');
  assert.deepStrictEqual(fs.readdirSync(dir), [key], 'every fixture lies under the key');
  // A population fixture's stamp names its year within the limit, its target, and whether it reached it.
  const r = F.files('medium-ref', dir), refStamp = JSON.parse(fs.readFileSync(r.stamp));
  for (const bad of [{ year: 61 }, { year: 0 }, { target: 900 }, { reached: false }, { living: 999 }, { reached: undefined }, { key: 'short' }]) {
    fs.writeFileSync(r.stamp, JSON.stringify({ ...refStamp, ...bad }));
    assert.throws(() => F.status('medium-ref', { dir }), /invalid fixture stamp/, JSON.stringify(bad));
  }
  fs.writeFileSync(r.stamp, JSON.stringify({ ...refStamp, year: 60, living: 999, reached: false }));
  assert.strictEqual(F.status('medium-ref', { dir }).status, 'made', 'a target never reached is a valid stamp');
  // A stamp copied from another key, a damaged save and a save of another format or scenario are refused.
  const f = F.files('small-y5', dir), stamp = JSON.parse(fs.readFileSync(f.stamp)), original = fs.readFileSync(f.save);
  fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, key: '0'.repeat(16) }));
  assert.throws(() => F.status('small-y5', { dir }), /another key/);
  fs.writeFileSync(f.stamp, JSON.stringify(stamp));
  fs.writeFileSync(f.save, 'damaged');
  assert.throws(() => F.loadFixture('small-y5', { dir, notice }), /checksum/);
  for (const override of [{ format: F.format() + 1 }, { scenario: 'founders' }, { seed: 8 }]) {
    const wrong = header(F.spec('small-y5'), override);
    fs.writeFileSync(f.save, wrong);
    fs.writeFileSync(f.stamp, JSON.stringify({ ...stamp, saveHash: F.hash(wrong) }));
    assert.throws(() => F.loadFixture('small-y5', { dir, notice }), /remake the fixtures/, JSON.stringify(override));
  }
  fs.writeFileSync(f.save, original); fs.writeFileSync(f.stamp, JSON.stringify(stamp));
  // Other keys are other sources' fixtures: not seen by status, and cleaned oldest first; the current key always stays.
  const older = ['a', 'b', 'c'].map((c, i) => {
    const k = c.repeat(16), z = header(F.spec('small-y5'));
    F.writeFixture('small-y5', z, stampFor('small-y5', z, k), { dir });
    fs.utimesSync(path.join(dir, k), new Date(1e9 + i * 1e6), new Date(1e9 + i * 1e6));
    return k;
  });
  fs.writeFileSync(path.join(dir, 'small-y5.gz'), 'a save of before the keys');
  assert.deepStrictEqual(clean({ dir, keep: 3, notice }).sort(), [older[0], 'small-y5.gz'].sort());
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), [key, older[1], older[2]].sort());
  assert.deepStrictEqual(clean({ dir, keep: 1, notice }).sort(), [older[1], older[2]].sort());
  assert.deepStrictEqual(fs.readdirSync(dir), [key]);
  assert.strictEqual(F.status('small-y5', { dir }).status, 'made');
  console.log('fixture tools: one run a map, the key and its directory, stamps, damaged and mislabelled saves, and cleaning pass');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
