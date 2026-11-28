// @suite integration
// Foresight's hunger by household-years (VB-571; tools/foresight-hunger.js): a year advanced a day at a time is the plain run's year, and the
// household-years are read from it; the measures on hand-made household-years: the share hungry, the days a household-year, the share one
// household holds, the thirds by the head's skill (a household-year with a head on less than half its days left out of them), no thirds
// for a version with no head's skill; and the comparison of two runs seed by seed, outside twice its standard error or not.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { YEAR, YEAR_DAYS } = VB['sim/rules'];
const F = require('../tools/foresight-hunger.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const hash = (st) => sha(canon(kept(st)));

{ // the report: a year in days is the plain run's year; each standing household gives one household-year, headed on its days
  const fresh = () => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 3 });
  const a = fresh(), b = fresh(), rep = F.report(VB, a);
  rep.advanceYear();
  Sim.advance(b, YEAR);
  assert.strictEqual(hash(a), hash(b), 'the report changes the run');
  const out = rep.result(), first = new Set(b.households.slice(0, 4).map((h) => h.id));
  assert.strictEqual(out.living, a.living.length);
  assert.strictEqual(out.rows.length, a.households.length, 'one household-year a household, those founded in the year with them');
  assert.ok(out.rows.every((r) => r.year === 0 && r.on <= YEAR_DAYS), 'the days of the one year read');
  assert.ok(out.rows.filter((r) => first.has(r.household)).every((r) => r.on === YEAR_DAYS), 'every day of the year read');
  assert.ok(out.rows.some((r) => r.headed > 0 && r.skill > 0), 'the head and its skill read');
}
const hy = (household, days, skill, headed = 10) => ({ household, year: 0, days, on: 10, headed, skill: skill * headed });
const made = [hy(0, 0, 0.1), hy(1, 4, 0.2), hy(2, 0, 0.3), hy(3, 0, 0.5), hy(4, 2, 0.6), hy(5, 0, 0.7), hy(6, 0, 0.8), hy(7, 0, 0.85), hy(8, 6, 0.9), hy(9, 0, 0.4, 4)];
{ // the measures on hand-made household-years
  const rows = made;
  const m = F.measure(rows);
  assert.strictEqual(m.householdYears, 10);
  assert.strictEqual(m.hungryShare, 0.3);
  assert.strictEqual(m.daysPer, 1.2);
  assert.strictEqual(m.hungryDays, 12);
  assert.strictEqual(m.oneHousehold, 0.5);
  assert.deepStrictEqual(m.thirds.map((t) => t.n), [3, 3, 3], 'the household-year headed on 4 days of 10 left out of the thirds');
  assert.deepStrictEqual(m.thirds.map((t) => t.skill), [[0.1, 0.3], [0.5, 0.7], [0.8, 0.9]]);
  assert.deepStrictEqual(m.thirds.map((t) => t.hungryShare), [0.3333, 0.3333, 0.3333]);
  assert.deepStrictEqual(m.thirds.map((t) => t.daysPer), [1.3333, 0.6667, 2]);
  assert.strictEqual(F.measure(rows.map((r) => ({ ...r, headed: 0, skill: 0 }))).thirds, null, 'no head\'s skill, no thirds');
}
{ // the comparison: B less A seed by seed
  const seed = (s, share) => ({ seed: s, hungryShare: share, daysPer: share * 10, hungryDays: 1, thirds: null });
  const a = { seeds: [seed(1, 0.1), seed(2, 0.2), seed(3, 0.3)] }, far = { seeds: [seed(1, 0.2), seed(2, 0.31), seed(3, 0.39)] };
  const near = { seeds: [seed(1, 0.2), seed(2, 0.1), seed(3, 0.33)] };
  const c = F.compare(a, far);
  assert.strictEqual(c.hungryShare.seeds, 3);
  assert.ok(Math.abs(c.hungryShare.diff - 0.1) < 1e-9 && c.hungryShare.outside, 'a rise at every seed is outside the error');
  assert.ok(!F.compare(a, near).hungryShare.outside, 'a rise at some seeds and a fall at another is not');
  assert.ok(!('lowShare' in c), 'no thirds, no comparison of them');
  const s = F.summarise([{ seed: 1, living: 5, rows: made }, { seed: 2, living: 6, rows: made.slice(0, 5) }]);
  assert.strictEqual(s.seeds.length, 2);
  assert.strictEqual(s.spread.hungryShare.max, 0.4);
  assert.strictEqual(s.spread.hungryShare.min, 0.3);
}
console.log('foresight-hunger ok: a year in days is the plain year, household-years and their thirds, the comparison seed by seed');
