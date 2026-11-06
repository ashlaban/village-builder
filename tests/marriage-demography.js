// First marriages exclude pre-existing unions and remarriages, but include people who later die.
const assert = require('assert'), { summarize } = require('../tools/marriage-demography.js');
const st = { t: 60, living: [0, 1, 2, 3, 4], pawns: [
  { id: 0, sex: 'f', born: 10 }, { id: 1, sex: 'f', born: 15 }, { id: 2, sex: 'f', born: 5 },
  { id: 3, sex: 'f', born: 16 }, { id: 4, sex: 'm', born: 10 }, { id: 5, sex: 'm', born: 0 },
], unions: [
  { a: 0, b: 5, start: 35 }, { a: 0, b: 4, start: 55 }, { a: 2, b: 4, start: 45 },
] };
const out = summarize(st, 40, 1);
assert.strictEqual(out.marriagesPerYear, 2 / 20);
assert.strictEqual(out.firstMarriageAge, (45 - 5 + 45 - 10) / 2);
assert.strictEqual(out.firstMarriages, 2);
assert.strictEqual(out.women45to54, 2);
assert.strictEqual(out.neverMarried, 1);
assert.strictEqual(out.neverShare, 0.5);
assert.deepStrictEqual(out.neverMarriedIds, [1]);
// A first union during observation still contributes after the person dies; a remarriage does not add another first marriage.
assert.strictEqual(summarize(st, 30, 1).firstMarriages, 4);
assert.strictEqual(summarize(st, 30, 1).firstMarriageAge, (25 + 35 + 40 + 35) / 4);
assert.strictEqual(summarize({ ...st, living: [] }, 30, 1).neverShare, null);
console.log('marriage demography: first marriages, remarriages, deaths, age boundaries and empty cohorts pass');
