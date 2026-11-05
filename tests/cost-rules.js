// The cost baseline must not hide a new regression, even when --update is requested.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { check, growth, NAMES } = require('./lib/cost.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-cost-')), file = path.join(dir, 'baseline.json');
const values = Object.fromEntries(NAMES.map((k) => [k, 1]));
const initial = { scaling: { roundPairs: 2 }, history: { walkDaily: 1.8 } };
const read = () => JSON.parse(fs.readFileSync(file, 'utf8')), print = () => {};
try {
  fs.writeFileSync(file, JSON.stringify(initial));
  const unchanged = fs.readFileSync(file, 'utf8'), lines = [];
  assert.throws(() => check('scaling', { ...values, roundPairs: 2.01 }, { file, update: true, print: (s) => lines.push(s) }), /cost regression/);
  assert.strictEqual(lines.length, NAMES.length, 'failures still report every counter');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), unchanged, 'failed update cannot write');
  assert.throws(() => check('scaling', { ...values, routeSearch: 1.16 }, { file, update: true, print }), /routeSearch/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), unchanged, 'cannot add an excess');
  check('scaling', { ...values, roundPairs: 1.9 }, { file, update: true, print });
  assert.deepStrictEqual(read(), { ...initial, scaling: { roundPairs: 1.9 } });
  check('scaling', values, { file, update: true, print });
  assert.deepStrictEqual(read(), { ...initial, scaling: {} }, 'a fixed counter leaves the baseline');
  const incomplete = { ...values }; delete incomplete.walkStep;
  assert.throws(() => check('scaling', incomplete, { file, print }), /every counter/);
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => check('history', { ...values, walkStep: bad }, { file, print }), /cost regression/);
  }
  const a = { work: values, living: 10, pawnDays: 300 };
  const linear = { work: Object.fromEntries(NAMES.map((k) => [k, 2])), living: 20, pawnDays: 600 };
  assert.deepStrictEqual(growth(a, linear, true), values, 'linear population scaling has exponent one');
  assert.deepStrictEqual(growth(a, linear), values, 'linear work has flat cost per pawn-day');
  const quadratic = { ...linear, work: { ...linear.work, roundPairs: 4 } };
  assert.strictEqual(growth(a, quadratic, true).roundPairs, 2);
  assert.strictEqual(growth(a, quadratic).roundPairs, 2);
  const zero = { ...a, work: { ...values, routeSearch: 0 } };
  assert.strictEqual(growth(zero, { ...linear, work: { ...linear.work, routeSearch: 0 } }, true).routeSearch, 0);
  assert.strictEqual(growth(zero, linear).routeSearch, Infinity);
  assert.throws(() => check('history', growth(zero, linear), { file, update: true, print }), /routeSearch/);
  assert.throws(() => growth(a, a, true), /increase/);
  console.log('cost rules: linear/quadratic growth, zero work, complete coverage, non-finite rejection and decreasing-only updates pass');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
