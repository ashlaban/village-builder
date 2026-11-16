// Who waits to marry, and why (VB-633; design.md, People, Marriage, nursing and growth; Balance loops and targets, The growth budget).
// node tools/sim.js --scenario founders --seed 7 --map small --years 50 --report waiting [--json]
// At the start of the moving round's day (autumn day 11, the night before its noon, after the meetings that may change a custom), every
// living pawn who is unmarried, not retired, of the least age to marry (MARRIAGE.womenFrom, menFrom) and under 45 is counted once,
// under the best outcome over every such pawn of the other sex, as the round's rules (sim/matching: matchRules, kinOk, matchScore, with
// the score's noise at its mean) would judge the pair, in this order, the worst first:
//   hungry  too hungry (either of the two at HUNGER.marryBelow or more)   none   nobody of the other sex free
//   kin     only kin too close for the custom                            home   no home for them under the residence custom
//   score   only matches the score refuses (the gap of their ages, their villages)
//   means   the home lacks the means (MARRIAGE.means years of food)     free   free to marry: a match the round's rules allow
// Summed by 20 years: those counted (pawn-rounds) and the share under each cause, the servants among them, the living, households and
// single-person households at the period's end; the mean age at first marriage by sex (founders and those seeded married left out);
// of those who reached 45 in the period (founders left out), the share never married by then; marriages a year per 1,000 living; the
// marriages the round put off for the means (its `putOff` events); the share of the adults of age (the least age to marry or over)
// waiting for land (st.demand) at the period's end; yearly growth over the period. It reads the state and changes nothing: a seed is the
// same run with or without it (tests/waiting.js).
// Used by tools/sim.js and tests/lib/bands.js: census(VB, st), yearFacts(VB, st, t0, t1, recordFrom), report(VB, st), CAUSES.
require('./help.js')(__filename);

const CAUSES = ['hungry', 'none', 'kin', 'home', 'score', 'means', 'free'];
const MAX_AGE = 45; // the census counts those under it, and the never-married share is read at it
// The hour of the census within a year: the start of autumn day 11, the day of the moving round (sim/clock CALENDAR).
const censusHour = (R) => (2 * R.SEASON_DAYS + 10) * R.DAY;

// Is p of the pool: alive, unmarried, not retired, of the least age to marry and under MAX_AGE.
function inPool(VB, st, p) {
  const { MARRIAGE } = VB['sim/rules'], { spouseOf, age } = VB['sim/records'];
  if (!p.alive || p.retired || spouseOf(st, p.id) !== null) return false;
  const a = age(st, p);
  return a >= (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom) && a < MAX_AGE;
}
// The outcome of a pair (pawns of the two sexes), as an index of CAUSES: hungry, kin, home, score, means or free (never none).
function pairOutcome(VB, st, a, b, rules) {
  const { MARRIAGE, HUNGER } = VB['sim/rules'], R = VB['sim/records'], M = VB['sim/matching'];
  if (!(a.hunger < HUNGER.marryBelow) || !(b.hunger < HUNGER.marryBelow)) return 0;
  const m = a.sex === 'm' ? a : b,
    f = m === a ? b : a,
    cu = R.practice(st, R.settlementIdOf(st, m));
  if (!M.kinOk(st, m.id, f.id, cu)) return 2;
  const home = rules.homeFor(m, f, cu);
  if (home === null) return 3;
  const widowed = R.wasWidowed(st, m.id) || R.wasWidowed(st, f.id);
  if (M.matchScore(st, { ...m, age: R.age(st, m) }, { ...f, age: R.age(st, f) }, 0.5, widowed) < MARRIAGE.minScore) return 4;
  return rules.affords(home) ? 6 : 5;
}
// The census now: {counts: {cause: n}, n, servants, pool: [pawn ids], causeOf: {id: cause}}.
function census(VB, st) {
  const rules = VB['sim/matching'].matchRules(st);
  const pool = st.living.map((id) => st.pawns[id]).filter((p) => inPool(VB, st, p));
  const counts = Object.fromEntries(CAUSES.map((c) => [c, 0])), causeOf = {};
  let servants = 0;
  for (const p of pool) {
    let best = 1; // none, unless a pawn of the other sex is in the pool
    let any = false;
    for (const q of pool) {
      if (q.sex === p.sex) continue;
      const o = pairOutcome(VB, st, p, q, rules);
      if (!any || o > best) best = o;
      any = true;
      if (best === 6) break;
    }
    counts[CAUSES[best]]++;
    causeOf[p.id] = CAUSES[best];
    if (p.servant) servants++;
  }
  return { counts, n: pool.length, servants, pool: pool.map((p) => p.id), causeOf };
}
// What a year (game hours t0 to t1, the record from index recordFrom) adds: first marriages by sex {f: [n, sum of ages], m}, those who
// reached MAX_AGE and those of them never married, the marriages, the marriages put off for the means, and at t1 the living, the
// households, the single-person ones, the pool and those of it waiting for land (st.demand).
function yearFacts(VB, st, t0, t1, recordFrom) {
  const { YEAR, MARRIAGE } = VB['sim/rules'],
    R = VB['sim/records'];
  const first = new Map();
  for (const u of st.unions) for (const id of [u.a, u.b]) if (!first.has(id) || u.start < first.get(id)) first.set(id, u.start);
  const ages = { f: [0, 0], m: [0, 0] };
  let marriages = 0;
  for (const u of st.unions) {
    if (!(u.start > t0 && u.start <= t1)) continue;
    marriages++;
    for (const id of [u.a, u.b]) {
      const p = st.pawns[id];
      if (p.founder || first.get(id) !== u.start) continue; // a founder, or a remarriage (seeded unions start at or before 0)
      ages[p.sex][0]++;
      ages[p.sex][1] += (u.start - p.born) / YEAR;
    }
  }
  let reached = 0,
    never = 0;
  for (const p of st.pawns) {
    const at = p.born + MAX_AGE * YEAR;
    if (p.founder || !(at > t0 && at <= t1) || (p.died !== null && p.died < at)) continue;
    reached++;
    if (!first.has(p.id) || first.get(p.id) > at) never++;
  }
  let putOff = 0;
  for (let i = recordFrom; i < st.record.length; i++) {
    const e = st.record[i];
    if (e && typeof e === 'object' && e.kind === 'putOff') putOff += e.n || 0;
  }
  const pool = st.living.filter((id) => inPool(VB, st, st.pawns[id]));
  const ofAge = (p) => R.age(st, p) >= (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom);
  const adults = st.living.filter((id) => ofAge(st.pawns[id]));
  return {
    ages,
    reached45: reached,
    neverMarried: never,
    marriages,
    putOff,
    living: st.living.length,
    households: st.liveHouseholds.length,
    single: st.liveHouseholds.filter((h) => st.households[h].members.length === 1).length,
    pool: pool.length,
    adults: adults.length,
    landWait: st.demand.filter((id) => st.pawns[id].alive && ofAge(st.pawns[id])).length,
  };
}
// Years summed by 20: rows of {years, ...} from yearly entries {year, start (living at its start), census, facts}.
function byPeriods(years, span = 20) {
  const rows = [];
  for (const y of years) {
    const k = Math.floor((y.year - 1) / span);
    let r = rows.find((x) => x.k === k);
    if (!r) {
      r = { k, from: y.year, to: y.year, start: y.start, counts: Object.fromEntries(CAUSES.map((c) => [c, 0])), n: 0, servants: 0,
        ages: { f: [0, 0], m: [0, 0] }, reached45: 0, neverMarried: 0, marriages: 0, putOff: 0, livingYears: 0 };
      rows.push(r);
    }
    r.to = y.year;
    if (y.census) {
      r.n += y.census.n;
      r.servants += y.census.servants;
      for (const c of CAUSES) r.counts[c] += y.census.counts[c];
    }
    const f = y.facts;
    for (const s of ['f', 'm']) for (const i of [0, 1]) r.ages[s][i] += f.ages[s][i];
    for (const key of ['reached45', 'neverMarried', 'marriages', 'putOff']) r[key] += f[key];
    r.livingYears += f.living;
    Object.assign(r, { living: f.living, households: f.households, single: f.single, adults: f.adults, landWait: f.landWait });
  }
  const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);
  return rows.map((r) => ({
    years: `${r.from}-${r.to}`,
    counted: r.n,
    ...Object.fromEntries(CAUSES.map((c) => [c, r3(r.n ? r.counts[c] / r.n : NaN)])),
    servants: r.servants,
    living: r.living,
    households: r.households,
    single: r.single,
    marryAgeF: r3(r.ages.f[1] / r.ages.f[0]),
    marryAgeM: r3(r.ages.m[1] / r.ages.m[0]),
    firstMarriages: r.ages.f[0] + r.ages.m[0],
    reached45: r.reached45,
    neverMarried: r3(r.neverMarried / r.reached45),
    marriagesPer1000: r3((1000 * r.marriages) / r.livingYears),
    putOff: r.putOff,
    landWaitShare: r3(r.landWait / r.adults),
    growth: r3(Math.pow(r.living / r.start, 1 / (r.to - r.from + 1)) - 1),
  }));
}
// For tools/sim.js: advanceYear() in place of Sim.advance(st, YEAR), the census at the round's day; result() the periods' rows and the
// years; print(out).
function report(VB, st) {
  const R = VB['sim/rules'], Sim = VB.sim, years = [];
  function advanceYear() {
    const t0 = st.t,
      from = st.record.length,
      start = st.living.length,
      at = Math.floor(t0 / R.YEAR) * R.YEAR + censusHour(R),
      eve = at >= t0 ? at : at + R.YEAR;
    let c = null;
    if (eve < t0 + R.YEAR) {
      if (eve > t0) Sim.advance(st, eve - t0);
      c = census(VB, st);
      Sim.advance(st, t0 + R.YEAR - st.t);
    } else Sim.advance(st, R.YEAR);
    years.push({ year: Math.round(st.t / R.YEAR), start, census: c, facts: yearFacts(VB, st, t0, st.t, from) });
  }
  const result = () =>
    ({ periods: byPeriods(years),
    years: years.map((y) => ({ year: y.year, ...(y.census ? y.census.counts : {}), counted: y.census ? y.census.n : 0, ...y.facts, ages: undefined })) });
  function print(out) {
    console.log(`who waits to marry, at the moving round's day, by 20 years (shares of those counted; ${CAUSES.join(', ')}):`);
    console.table(out.periods);
  }
  return { advanceYear, result, print };
}
module.exports = { CAUSES, MAX_AGE, censusHour, inPool, pairOutcome, census, yearFacts, byPeriods, report };
