// @suite integration
// Who waits to marry, and why (VB-633; tools/waiting.js): on a constructed village, one pawn under each cause in turn (hungry, nobody
// free, kin, no home, the score, the means, free to marry), checked against the round's own bar (sim/matching matchBar) where it has one;
// the census and the year's facts change nothing, and the report's year is the plain run's; and the growth probes of the bands
// (tests/lib/bands.js) on a hand-made list of samples: growth by phase and its split at the year land grows scarce, the year of 1,000 found
// and worked out, the swing between decades, the age at first marriage, the never-married share and the waiting shares.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, MT = VB['sim/matching'], R = VB['sim/records'];
const { YEAR, MARRIAGE } = VB['sim/rules'];
const W = require('../tools/waiting.js'), B = require('./lib/bands.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'F'.repeat(18) : i === 11 ? '~'.repeat(18) : '.'.repeat(18)));
const hash = (st) => sha(canon(kept(st)));
const made = new Map();
const world = (seed) => { // a copy of the village of a seed, made once
  if (!made.has(seed)) {
    const st = tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed });
    for (const h of st.households) h.grain.barley += 5e4; // the homes afford a marriage, but where a case takes the means away
    made.set(seed, st);
  }
  const { w, ...rest } = made.get(seed);
  return { ...structuredClone(rest), w };
};
const pool = (st) => st.living.map((id) => st.pawns[id]).filter((p) => W.inPool(VB, st, p));
// leaves only `keep` in the pool: the others of it are retired, which takes them out of the census and changes nothing else it reads
const isolate = (st, keep) => { for (const p of pool(st)) if (!keep.includes(p.id)) p.retired = true; };
const youngAt = (st, p, years) => { p.born = st.t - years * YEAR - 1; };
const starve = (st, h) => { const hh = st.households[h]; hh.grain = { barley: 0 }; hh.meals = 0; hh.unthreshed = []; hh.larder = []; };
// a pair of the pool (man, woman) on a village of seeds 1..40 for which `make(st, m, f)` holds after it changed the state as it needs;
// the state, made afresh, with the pair isolated
function find(name, make) {
  for (let seed = 1; seed <= 40; seed++) {
    const ids = pool(world(seed)).map((p) => p.id);
    for (const a of ids) for (const b of ids) {
      const st = world(seed), m = st.pawns[a], f = st.pawns[b];
      if (m.sex !== 'm' || f.sex !== 'f') continue;
      if (make(st, m, f)) { isolate(st, [a, b]); return { st, m: a, f: b, seed }; }
    }
  }
  assert.fail(`the scene: a pair for ${name}`);
}
const bar = (st, c) => MT.matchBar(st, c.m, c.f).why || null;
const counted = (st, id) => W.census(VB, st).causeOf[id];
const rules = (st) => MT.matchRules(st);
// free to marry: nothing bars the pair, by the census and by the round's bar
const free = find('free', (st, m, f) => W.pairOutcome(VB, st, m, f, rules(st)) === 6);
assert.strictEqual(bar(free.st, free), null, 'free: the round\'s bar agrees');
{
  const h0 = hash(free.st), c = W.census(VB, free.st);
  assert.strictEqual(c.causeOf[free.m], 'free'); assert.strictEqual(c.causeOf[free.f], 'free');
  assert.deepStrictEqual([c.n, c.counts.free], [2, 2], 'two counted, both free');
  W.yearFacts(VB, free.st, 0, free.st.t, 0);
  assert.strictEqual(hash(free.st), h0, 'the census and the year\'s facts change nothing');
}
{ // too hungry: the man at the bar's hunger, and so the woman, whose only match he is
  const { st, m, f } = find('free', (s, a, b) => W.pairOutcome(VB, s, a, b, rules(s)) === 6);
  st.pawns[m].hunger = 0.6;
  assert.ok(/too hungry/.test(bar(st, { m, f })), 'hungry: the round\'s bar agrees');
  assert.strictEqual(counted(st, m), 'hungry'); assert.strictEqual(counted(st, f), 'hungry');
}
{ // nobody free: the woman alone in the pool
  const { st, f } = free; isolate(st, [f]);
  assert.strictEqual(counted(st, f), 'none');
  const c = W.census(VB, st);
  assert.strictEqual(c.n, 1, 'one counted');
}
{ // too close kin
  const c = find('kin', (st, m, f) => /too close kin/.test(MT.matchBar(st, m.id, f.id).why || ''));
  assert.strictEqual(counted(c.st, c.m), 'kin'); assert.strictEqual(counted(c.st, c.f), 'kin');
}
{ // no home: neither has a place under the custom "with whoever holds land"
  const c = find('home', (st, m, f) => /no home/.test(MT.matchBar(st, m.id, f.id).why || ''));
  assert.strictEqual(counted(c.st, c.m), 'home'); assert.strictEqual(counted(c.st, c.f), 'home');
}
{ // the score: a free pair made 26 years apart (a woman of the least age, a man of 44)
  const c = find('score', (st, m, f) => {
    if (W.pairOutcome(VB, st, m, f, rules(st)) !== 6) return false;
    youngAt(st, f, MARRIAGE.womenFrom); youngAt(st, m, 44);
    return W.pairOutcome(VB, st, m, f, rules(st)) === 4;
  });
  assert.ok(/ill matched/.test(bar(c.st, c)), `score: the round's bar agrees (${bar(c.st, c)})`);
  assert.strictEqual(counted(c.st, c.m), 'score'); assert.strictEqual(counted(c.st, c.f), 'score');
}
{ // the means: a free pair whose home is emptied of food
  const c = find('means', (st, m, f) => {
    if (W.pairOutcome(VB, st, m, f, rules(st)) !== 6) return false;
    starve(st, rules(st).homeFor(m, f, R.practice(st, R.settlementIdOf(st, m))));
    return W.pairOutcome(VB, st, m, f, rules(st)) === 5;
  });
  assert.ok(/home holds .* years of food it needs/.test(bar(c.st, c)), `means: the round's bar agrees (${bar(c.st, c)})`);
  assert.strictEqual(counted(c.st, c.m), 'means'); assert.strictEqual(counted(c.st, c.f), 'means');
}
{ // the best outcome over the others: a woman free with one man and kin to another is free
  const st = world(free.seed);
  const all = W.census(VB, st);
  assert.strictEqual(all.n, pool(st).length);
  assert.strictEqual(Object.values(all.counts).reduce((a, b) => a + b, 0), all.n, 'each counted once');
  for (const p of pool(st)) {
    const best = Math.max(...pool(st).filter((q) => q.sex !== p.sex).map((q) => W.pairOutcome(VB, st, p, q, rules(st))));
    assert.strictEqual(all.causeOf[p.id], W.CAUSES[best], `pawn ${p.id}: the best over the others`);
  }
}
{ // the report: a year cut at the round's day is the plain run's year; its census and facts are filled
  const fresh = () => tinyState(tinyWorld(rows), [{ at: [8, 6], farms: 4, sizes: [9, 9, 9, 9] }], { seed: 3 }); // made afresh: a copy shares no caches
  const a = fresh(), b = fresh(), rep = W.report(VB, a);
  rep.advanceYear(); Sim.advance(b, YEAR);
  assert.strictEqual(hash(a), hash(b), 'the report changes the run');
  const out = rep.result();
  assert.strictEqual(out.years.length, 1); assert.strictEqual(out.periods[0].years, '1-1');
  assert.ok(out.periods[0].counted > 0 && out.years[0].living === a.living.length, 'the year is counted');
}
{ // the year's facts: a first marriage by age and sex, a remarriage and a founder left out; who reached 45 and never married
  const st = { t: 10 * YEAR, record: [{ kind: 'putOff', n: 2 }, { kind: 'married' }], living: [], liveHouseholds: [], demand: [], households: [],
    pawns: [
      { id: 0, sex: 'f', born: -12 * YEAR, founder: false, alive: true, died: null }, // first married at 20
      { id: 1, sex: 'm', born: -15 * YEAR, founder: false, alive: true, died: null }, // first married at 23
      { id: 2, sex: 'f', born: -30 * YEAR, founder: false, alive: true, died: null }, // seeded married: left out
      { id: 3, sex: 'm', born: -40 * YEAR, founder: true, alive: true, died: null }, // a founder: left out
      { id: 4, sex: 'f', born: -36 * YEAR, founder: false, alive: true, died: null }, // reaches 45 in year 9, never married
      { id: 5, sex: 'm', born: -36 * YEAR, founder: false, alive: false, died: -YEAR }, // died before 45: not counted
    ],
    unions: [{ a: 3, b: 2, start: -5 * YEAR }, { a: 1, b: 0, start: 8 * YEAR }] };
  const f = W.yearFacts(VB, st, 8 * YEAR - 1, 10 * YEAR, 0);
  assert.deepStrictEqual(f.ages, { f: [1, 20], m: [1, 23] }, 'first marriages by sex, the founder and the seeded left out');
  assert.deepStrictEqual([f.marriages, f.putOff, f.reached45, f.neverMarried], [1, 2, 1, 1], 'one reached 45 unmarried; one died before it');
  st.unions.push({ a: 3, b: 4, start: 9 * YEAR - 1 });
  const g = W.yearFacts(VB, st, 8.5 * YEAR, 10 * YEAR, 1);
  assert.deepStrictEqual([g.reached45, g.neverMarried, g.putOff, g.marriages], [1, 0, 0, 1], 'married just before 45: not never married');
}
// ---- the probes, on a hand-made list of samples ----
const facts = (o = {}) => ({ ages: { f: [0, 0], m: [0, 0] }, reached45: 0, neverMarried: 0, adults: 100, landWait: 0, ...o });
const counts = (o = {}) => ({ counts: Object.fromEntries(W.CAUSES.map((c) => [c, o[c] || 0])), n: W.CAUSES.reduce((a, c) => a + (o[c] || 0), 0) });
// 40 years: 10% growth for 10 years, then none for 10, then 5%; land scarce from year 20 on; 1,000 passed in year 26
const living = [300];
for (let y = 1; y <= 40; y++) living.push(Math.round(300 * (y <= 10 ? 1.1 ** y : y <= 20 ? 1.1 ** 10 : 1.1 ** 10 * 1.05 ** (y - 20))));
const samples = living.map((n, y) => ({ year: y, living: n, marriages: y ? 10 : 0,
  facts: y ? facts({ landWait: y >= 20 ? 15 : 5, ages: { f: [2, 2 * (y < 20 ? 20 : 24)], m: [1, 25] }, reached45: y % 2,
    neverMarried: y % 4 === 1 ? 1 : 0 }) : null,
  waiting: y ? counts({ none: 2, kin: 1, free: 1 }) : null }));
const probe = (id, s = samples) => B.judge(B.BANDS.find((b) => b.id === `${id}/populous`), 'report', s);
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a}, not ${b}`);
const g = (from, to, s = samples) => Math.pow(s[to].living / s[from].living, 1 / (to - from)) - 1;
near(probe('growth-phase-1-20').value, g(0, 20), 'growth over years 1-20');
near(probe('growth-phase-21-40').value, g(20, 40), 'growth over years 21-40');
near(probe('growth-phase-21-40', samples.slice(0, 31)).value, g(20, 30), 'cut at the run\'s end');
near(probe('land-scarce-year').value, 20, 'the first year a tenth wait for land');
near(probe('growth-phase-free').value, g(0, 19), 'growth before it');
near(probe('growth-phase-scarce').value, g(19, 40), 'growth from it on');
const few = samples.map((x) => (x.facts ? { ...x, facts: { ...x.facts, landWait: 0 } } : x));
assert.ok(Number.isNaN(probe('growth-phase-scarce', few).value) && Number.isNaN(probe('land-scarce-year', few).value),
  'never scarce: no year, no growth after');
near(probe('growth-phase-free', few).value, g(0, 40), 'never scarce: growth before it is the whole run\'s');
const small = samples.map((x) => (x.facts ? { ...x, facts: { ...x.facts, adults: 10, landWait: 5 } } : x));
assert.ok(Number.isNaN(probe('land-scarce-year', small).value), 'fewer than 20 adults of age are not read');
const placed = samples.map((x) => (x.year === 1 ? { ...x, facts: { ...x.facts, landWait: 50 } } : x));
near(probe('land-scarce-year', placed).value, 20, 'the first year, whose round sorts out the placed start, is not read');
const y1000 = probe('year-1000');
assert.strictEqual(y1000.value, living.findIndex((n) => n >= 1000)); assert.strictEqual(y1000.note, undefined, 'measured, no note');
const short = samples.slice(0, 21), worked = probe('year-1000', short);
near(worked.value, 20 + Math.log(1000 / short[20].living) / Math.log(1 + g(0, 20, short)), 'not reached: the years at the last 20 years\' rate');
assert.ok(/^arithmetic: /.test(worked.note), 'and marked as arithmetic');
const flat = short.map((x) => ({ ...x, living: 300 }));
assert.strictEqual(probe('year-1000', flat).value, Infinity, 'no growth: never');
assert.ok(/arithmetic/.test(probe('year-1000', flat).note));
near(probe('growth-swing').value, g(0, 10) - g(10, 20), 'the widest swing between decades');
assert.ok(Number.isNaN(probe('growth-swing', samples.slice(0, 15)).value), 'one decade: no swing');
near(probe('marry-age-f').value, (19 * 40 + 21 * 48) / 80, 'the women\'s mean age at first marriage');
near(probe('marry-age-m').value, 25, 'the men\'s');
near(probe('never-married').value, 10 / 20, 'never married by 45');
near(probe('marriages-per-1000').value, (1000 * 400) / living.slice(1).reduce((a, b) => a + b, 0), 'marriages a year per 1,000');
near(probe('waiting-none').value, 0.5, 'waiting: nobody free'); near(probe('waiting-kin').value, 0.25, 'waiting: kin');
near(probe('waiting-means').value, 0, 'waiting: the means');
assert.ok(B.BANDS.filter((b) => /^(growth-phase|year-1000|marry-age|never-married|waiting-|growth-swing)/.test(b.id)).every((b) => b.kind === 'described' &&
  !b.assert),
  'the new bands are described and never asserted');
for (const name of ['populous-medium', 'founders-medium']) {
  assert.ok(B.BANDS.some((b) => b.id === `year-1000/${name}`) && !B.BANDS.some((b) => b.id === `villages/${name}`), `${name}: the growth group only`);
}
console.log(`waiting ok: each cause in turn (${W.CAUSES.join(
  ', ')}), the census changes nothing, the report's year is the plain run's; the probes on hand-made samples`);
