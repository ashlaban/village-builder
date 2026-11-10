// The growth arithmetic and its report (docs/gates.md rows 16, 17, 19): a ratio over the line is a residual, reported and never failing.
const assert = require('assert');
const { report, growth, LIMITS, NAMES } = require('./lib/cost.js');
const values = Object.fromEntries(NAMES.map((k) => [k, 1]));

// Captures the TARGET lines a report prints.
function reported(kind, v) {
  const log = console.log, lines = [];
  console.log = (s) => lines.push(s);
  try { return { recs: report(kind, v), lines }; } finally { console.log = log; }
}

const ok = reported('scaling', values);
assert.strictEqual(ok.recs.length, NAMES.length, 'every counter is reported');
assert(ok.recs.every((r) => r.status === 'in' && r.residual === 0 && r.target === LIMITS.scaling));
assert(ok.lines.every((l) => l.startsWith('TARGET scaling.')));

// Over the line: out, with the residual; nothing throws and the other counters are unaffected.
const over = reported('scaling', { ...values, roundPairs: 2, routeSearch: 1.16 });
const by = Object.fromEntries(over.recs.map((r) => [r.name, r]));
assert.strictEqual(by['scaling.roundPairs'].status, 'out');
assert.strictEqual(by['scaling.roundPairs'].residual, 0.85);
assert.strictEqual(by['scaling.routeSearch'].residual, 0.01);
assert.strictEqual(over.recs.filter((r) => r.status === 'out').length, 2);
assert(over.lines.some((l) => /^TARGET scaling.roundPairs 2 1.15 \+0.85 out$/.test(l)), over.lines.join('\n'));

// History uses its own line; a non-finite value is out, not a throw.
const hist = reported('history', { ...values, walkStep: 1.25, walkDaily: 1.26, walkTies: Infinity, heirRank: NaN });
const h = Object.fromEntries(hist.recs.map((r) => [r.name, r.status]));
assert.deepStrictEqual([h['history.walkStep'], h['history.walkDaily'], h['history.walkTies'], h['history.heirRank']], ['in', 'out', 'out', 'out']);

// Coverage and unknown kinds stay hard.
const incomplete = { ...values }; delete incomplete.walkStep;
assert.throws(() => report('scaling', incomplete), /every counter/);
assert.throws(() => report('nope', values), /unknown cost check/);

// The growth arithmetic.
const a = { work: values, living: 10, pawnDays: 300 };
const linear = { work: Object.fromEntries(NAMES.map((k) => [k, 2])), living: 20, pawnDays: 600 };
assert.deepStrictEqual(growth(a, linear, true), values, 'linear population scaling has exponent one');
assert.deepStrictEqual(growth(a, linear), values, 'linear work has flat cost per pawn-day');
const quadratic = { ...linear, work: { ...linear.work, roundPairs: 4 } };
assert.strictEqual(growth(a, quadratic, true).roundPairs, 2);
assert.strictEqual(growth(a, quadratic).roundPairs, 2);
const zero = { ...a, work: { ...values, routeSearch: 0 } };
assert.strictEqual(growth(zero, { ...linear, work: { ...linear.work, routeSearch: 0 } }, true).routeSearch, 0);
assert.strictEqual(growth(zero, linear).routeSearch, Infinity, 'new work with no denominator is out, never passes');
assert.throws(() => growth(a, a, true), /increase/);
console.log('cost rules: linear/quadratic growth, zero work, complete coverage, and residuals reported without failing pass');
