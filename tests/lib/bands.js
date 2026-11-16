// The table of bands (VB-163; target-v2, section 6.2; Kim's decision 9): each band is a probe of a finished run with a range it should
// fall in. A band's `assert` is checked on a reduced scenario in the extended tier (tests/bands.js) and fails outside its range; its `report`
// is a full run, made nightly by tools/bands.js, printed as in or out and never failing. A slice's wrap-up adds its loops' bands here.
//   {id, probe, kind, report?: {lo, hi, afterYear, scenario, map, years, seeds}, assert?: {lo, hi, afterYear, setup, years, seeds}}
// Kinds: `balancing` is a target (reported with its residual), `watched` fails the reduced run when out, and `described` has no range:
// its value is printed and recorded, never judged. Only island-wide numbers are judged (Kim, 12 November; design.md, Balance loops and
// targets): hunger is an engine, so the measures of single households are described. Growth is judged over a scenario's seeds, not a
// seed at a time (GROWTH, below).
// `probe` names a function of PROBES, read from the yearly samples that runScenario takes during the run (sample, below); `setup` names
// a reduced scenario of SETUPS. `afterYear` is the probe's year: the probe looks at the years after it (or, for the villages, at it).
const VB = require('../../src/load.js'), G = VB.gen, Sim = VB.sim;
const { checkState } = require('./invariants.js');
const { DAY, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
const W = require('../../tools/waiting.js'); // who waits to marry, and why (VB-633)
const MAPS = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as tools/sim.js and the generation screen
// Reduced scenarios: a scenario on a map, nothing else changed yet; toy setups (a tinyState of tests/lib/tiny.js) may join them.
const SETUPS = { 'populous tiny': { scenario: 'populous', map: 'tiny' } };
// The full runs: populous small at four seeds (the late game's reference), founders small at sixteen (the early game's), heirs at two.
const FULL = {
  populous: { scenario: 'populous', map: 'small', years: 30, seeds: [3, 7, 11, 42] },
  // sixteen seeds: founders start at 10, so a seed shrinks by chance, and growth is judged over the seeds (GROWTH)
  founders: { scenario: 'founders', map: 'small', years: 50, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 42] },
  heirs: { scenario: 'heirs', map: 'small', years: 30, seeds: [7, 42] },
  // VB-633: the medium map, for the year 1,000 is reached (populous, measured) and the pace of a founders' island (arithmetic); only the
  // floors of the group `growth` (GROUPS, below) are reported on them. `weekly`: left out of the night's default, since a populous medium run
  // took 13 minutes of CPU (16 November, a shared machine), five times the rest of the bands; tools/nightly.js runs them on Sundays
  'populous-medium': { scenario: 'populous', map: 'medium', years: 30, seeds: [3, 7, 11, 42], groups: ['growth'], weekly: true },
  'founders-medium': { scenario: 'founders', map: 'medium', years: 50, seeds: [3, 7, 11, 42], groups: ['growth'], weekly: true },
};
const WEEKLY = Object.keys(FULL).filter((k) => FULL[k].weekly);
// The reduced run (VB-163): populous on the tiny map at four seeds for 8 years, about 11 s a seed.
const REDUCED = { setup: 'populous tiny', years: 8, seeds: [3, 7, 11, 42] };
// A household present on fewer days of a year than this is not judged on that year (one founded on the year's last day and hungry
// that day would be hungry on all its days).
const MIN_DAYS = SEASON_DAYS, HUNGRY_SHARE = 0.3;
const CENSUS = W.censusHour(VB['sim/rules']); // the hour of a year at which the marriage census is taken (VB-633)

// Probes: (samples, afterYear) -> a number. samples[0] is the state at seeding, samples[y] at the end of year y.
const HUNGER = new Set(['hunger', 'starvation']);
const after = (samples, y) => samples.filter((s) => s.year > y);
// VB-633: yearly growth over the years `from` to `to` of the samples ((living at to / living at from)^(1 / years) - 1; NaN for no years)
const growthOver = (s, from, to) => {
  to = Math.min(to, s.length - 1);
  return to > from && s[from].living > 0 ? Math.pow(s[to].living / s[from].living, 1 / (to - from)) - 1 : NaN;
};
// the first year at whose end a tenth or more of the adults of age (the least age to marry or over) wait for land (st.demand), or null;
// a year with fewer than LAND_SCARCE_ADULTS of them is not read (a founders' servant waiting in year 1 is a tenth of ten)
const LAND_SCARCE = 0.1, LAND_SCARCE_ADULTS = 20;
const scarceYear = (s) => {
  const x = s.find((y) => y.year > 0 && y.facts && y.facts.adults >= LAND_SCARCE_ADULTS && y.facts.landWait / y.facts.adults >= LAND_SCARCE);
  return x ? x.year : null;
};
const sumOf = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
const ratioAfter = (s, y, num, den) => { const a = after(s, y).filter((x) => x.facts), n = sumOf(a, den); return n ? sumOf(a, num) / n : NaN; };
const PROBES = {
  // living at the end over living at the start
  populationRatio: (s) => s[s.length - 1].living / s[0].living,
  // yearly growth over the run: (end / start)^(1 / years) - 1 (-1 when all are dead)
  growth: (s) => Math.pow(s[s.length - 1].living / s[0].living, 1 / (s.length - 1)) - 1,
  // villages holding 3 or more households at year y that hold none at the end
  villagesEmptied: (s, y) => {
    const ref = s[Math.min(y, s.length - 1)].villages, end = s[s.length - 1].villages;
    return Object.keys(ref).filter((v) => ref[v] >= 3 && !end[v]).length;
  },
  // the share of deaths after year y caused by hunger, its added hazard or starvation (as sim/notable counts them; 0 when none died)
  hungerDeathShare: (s, y) => {
    let all = 0, hunger = 0;
    for (const x of after(s, y)) for (const [c, n] of Object.entries(x.deaths)) { all += n; if (HUNGER.has(c)) hunger += n; }
    return all ? hunger / all : 0;
  },
  // the share of household-years after y (a household present MIN_DAYS or more in the year) in which it was hungry on over HUNGRY_SHARE of its
  // days (Kim, 10 November, VB-270: the band reads the share of household-years, not the worst household, which grows with their number)
  hungryHouseholdShare: (s, y) => {
    let bad = 0, all = 0; for (const x of after(s, y)) { bad += x.hungryHouseholds; all += x.householdYears; }
    return all ? bad / all : 0;
  },
  // the highest share of its days that a household was hungry, over the years after y (households present MIN_DAYS or more), beside it
  worstHungryShare: (s, y) => Math.max(0, ...after(s, y).map((x) => x.worstHungry)),
  // cold household-days (VB-327: the day's fire lacked wood, sim/hunger warmHouse) over household-days, after year y
  coldHouseholdShare: (s, y) => {
    let cold = 0, all = 0; for (const x of after(s, y)) { cold += x.coldDays; all += x.householdDays; }
    return all ? cold / all : 0;
  },
  // the share of the matches made after year y that were refused (VB-275's opinion, VB-293's offers, as sim/lifecycle logs them): refusals
  // over refusals and marriages (0 when there were none). Opinion is rare enough that a match made at enmity is the exception.
  refusedMatchShare: (s, y) => {
    let no = 0, yes = 0; for (const x of after(s, y)) { no += x.refusedMatches; yes += x.marriages; }
    return no + yes ? no / (no + yes) : 0;
  },
  // invariant violations (tests/lib/invariants.js, checkState) over every year end
  invariantFailures: (s) => s.reduce((n, x) => n + x.invariants.length, 0),
  // ---- VB-633: the marriage valve and the pace of growth (design.md, The growth budget), described, never judged ----
  // yearly growth over years y + 1 to the band's toYear (cut at the run's end); NaN when the run ends at or before y
  growthSpan: (s, y, b) => growthOver(s, y, b.toYear),
  // the first year in which a tenth of the adults of age wait for land (scarceYear, above), NaN when none
  scarceYear: (s) => scarceYear(s) ?? NaN,
  // yearly growth over the years before it (the whole run when it never comes), and over it and the years after (NaN when it never comes)
  growthFree: (s) => { const y = scarceYear(s); return growthOver(s, 0, y === null ? s.length - 1 : y - 1); },
  growthScarce: (s) => { const y = scarceYear(s); return y === null ? NaN : growthOver(s, y - 1, s.length - 1); },
  // the first year with 1,000 living; where the run ends short of it, the year it would come at the last 20 years' growth (the whole
  // run's when shorter), as arithmetic and marked so (Infinity when that growth is not above 0)
  year1000: (s) => {
    const x = s.find((y) => y.year > 0 && y.living >= 1000);
    if (x) return x.year;
    const end = s.length - 1, from = Math.max(0, end - 20), g = growthOver(s, from, end), n = s[end].living;
    const pct = Number.isFinite(g) ? `${(100 * g).toFixed(2)}%` : '-';
    if (!(g > 0) || !n) return { value: Infinity, note: `arithmetic: not reached in ${end} years, and growth over years ${from + 1}-${end} is ${pct}` };
    const more = Math.log(1000 / n) / Math.log(1 + g);
    return { value: end + more, note: `arithmetic: ${n} living at year ${end}, at ${pct} a year (years ${from + 1}-${end}), ${more.toFixed(0)} years more` };
  },
  // the mean age at first marriage of women and of men after year y (founders and those seeded married left out); NaN when none married
  marryAgeF: (s, y) => ratioAfter(s, y, (x) => x.facts.ages.f[1], (x) => x.facts.ages.f[0]),
  marryAgeM: (s, y) => ratioAfter(s, y, (x) => x.facts.ages.m[1], (x) => x.facts.ages.m[0]),
  // of those who reached 45 after year y (founders left out), the share never married by then; NaN when nobody reached it
  neverMarried: (s, y) => ratioAfter(s, y, (x) => x.facts.neverMarried, (x) => x.facts.reached45),
  // marriages a year per 1,000 living (the living at each year's end), after year y
  marriageRate: (s, y) => ratioAfter(s, y, (x) => 1000 * x.marriages, (x) => x.living),
  // the share of the census (tools/waiting.js) under the band's cause, over the years after y; NaN when nobody was counted
  waitingShare: (s, y, b) => {
    const a = after(s, y).filter((x) => x.waiting), n = sumOf(a, (x) => x.waiting.n);
    return n ? sumOf(a, (x) => x.waiting.counts[b.cause]) / n : NaN;
  },
  // the widest difference in yearly growth between two whole decades of the run (design.md, The growth budget, The overshoot); NaN for
  // fewer than two
  growthSwing: (s) => {
    const g = []; for (let d = 0; d + 10 <= s.length - 1; d += 10) g.push(growthOver(s, d, d + 10));
    return g.length >= 2 && g.every(Number.isFinite) ? Math.max(...g) - Math.min(...g) : NaN;
  },
};

// The bands of every full run, and of the reduced one. Growth and the population ratio are described a seed at a time and judged over the
// seeds (GROWTH); the hunger of households is described (Kim, 12 November).
const FLOORS = [
  { id: 'growth', probe: 'growth', kind: 'described', afterYear: 0 },
  { id: 'population', probe: 'populationRatio', kind: 'described', afterYear: 0 },
  { id: 'villages', probe: 'villagesEmptied', kind: 'balancing', lo: 0, hi: 0, afterYear: 5 },
  { id: 'hunger-deaths', probe: 'hungerDeathShare', kind: 'described', afterYear: 3 },
  { id: 'hungry-households', probe: 'hungryHouseholdShare', kind: 'described', afterYear: 3 },
  { id: 'worst-household', probe: 'worstHungryShare', kind: 'described', afterYear: 3 },
  // VB-327: cold household-days, reported in the full runs only, with no assert until Kim gives a target
  { id: 'cold-households', probe: 'coldHouseholdShare', kind: 'described', afterYear: 0, reportOnly: true },
  // slice 2 (a life): matches refused by opinion, or by a played pawn, stay a small part of the matches; a household is not left unmarried by them
  { id: 'refused-matches', probe: 'refusedMatchShare', kind: 'watched', lo: 0, hi: 0.2, afterYear: 3 },
  { id: 'invariants', probe: 'invariantFailures', kind: 'watched', lo: 0, hi: 0, afterYear: 0 },
  // VB-633: the marriage valve and the pace of growth, described in the full runs only, never asserted (design.md, The growth budget,
  // The band); the group `growth` is also what the medium runs report (FULL, groups)
  ...[[0, 20], [20, 40], [40, 60], [60, 80]].map(([a, z]) => (
    { id: `growth-phase-${a + 1}-${z}`, probe: 'growthSpan', kind: 'described', afterYear: a, toYear: z, reportOnly: true, group: 'growth' })),
  ...[['growth-phase-free', 'growthFree'], ['growth-phase-scarce', 'growthScarce'], ['land-scarce-year', 'scarceYear'], ['year-1000', 'year1000'],
    ['growth-swing', 'growthSwing'], ['marry-age-f', 'marryAgeF'], ['marry-age-m', 'marryAgeM'], ['never-married', 'neverMarried'],
    ['marriages-per-1000', 'marriageRate']].map(([id, probe]) => ({ id, probe, kind: 'described', afterYear: 0, reportOnly: true, group: 'growth' })),
  ...W.CAUSES.map((cause) => ({ id: `waiting-${cause}`, probe: 'waitingShare', kind: 'described', afterYear: 0, cause, reportOnly: true, group: 'growth' })),
];
// Growth, judged over a scenario's seeds (Kim, 12 November; AGENTS.md, Deciding without Kim, 2): the median seed grows at least `median`
// a year, at least `growing` of the seeds end above their start, and at most `halved` end below half of it. A median below 0 is a
// collapse. Founders and populous are held to it, and the reduced run; heirs is reported without a target.
const GROWTH = { median: 0.01, growing: 0.75, halved: 0.125, runs: ['founders', 'populous'] };
// The three growth targets of some seeds' population ratios (end over start) over `years`: [{id, dir, target, measured}], and whether
// it is a collapse.
function growthTargets(ratios, years) {
  const g = ratios.map((r) => Math.pow(r, 1 / years) - 1).sort((a, b) => a - b), n = g.length;
  const median = n % 2 ? g[(n - 1) / 2] : (g[n / 2 - 1] + g[n / 2]) / 2;
  return { collapse: median < 0, targets: [
    { id: 'growth-median', dir: 'min', target: GROWTH.median, measured: median },
    { id: 'growing-seeds', dir: 'min', target: GROWTH.growing, measured: ratios.filter((r) => r > 1).length / n },
    { id: 'halved-seeds', dir: 'max', target: GROWTH.halved, measured: ratios.filter((r) => r < 0.5).length / n }] };
}
const BANDS = [];
// The floors a run with `groups` reports: those of the group, and growth and the population ratio beside them (VB-633).
const GROUPS = { growth: new Set(['growth', 'population']) };
for (const f of FLOORS) for (const [name, { groups, weekly, ...run }] of Object.entries(FULL)) {
  if (groups && !groups.some((g) => f.group === g || GROUPS[g].has(f.id))) continue;
  if (f.afterYear > 0 && f.afterYear >= run.years) continue; // a span the run does not reach
  const range = { ...(f.kind === 'described' ? {} : { lo: f.lo, hi: f.hi }), afterYear: f.afterYear,
    ...(f.toYear !== undefined ? { toYear: f.toYear } : {}), ...(f.cause ? { cause: f.cause } : {}) };
  BANDS.push({ id: `${f.id}/${name}`, probe: f.probe, kind: f.kind, report: { ...range, ...run },
    ...(name === 'populous' && !f.reportOnly ? { assert: { ...range, ...REDUCED } } : {}) });
}

// One run, sampled at every year end: {scenario, map, seed, years} -> {samples, secs, cpuSecs}. The run advances a day at a time, so a
// household's days present in a year are counted, not guessed.
function runScenario({ scenario, map, seed, years }) {
  const cpu0 = process.cpuUsage(), t0 = Date.now(), it = G.generate(seed, { cols: MAPS[map][0], rows: MAPS[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario), samples = [sample(st, 0, null)];
  for (let y = 1; y <= years; y++) {
    const from = st.record.length, hungry0 = new Map(), days = new Map();
    let coldDays = 0;
    for (const id of st.liveHouseholds) hungry0.set(id, st.households[id].hungryDays);
    let waiting = null; const t0 = st.t;
    for (let d = 0; d < YEAR_DAYS; d++) {
      if (st.t === t0 + CENSUS) waiting = W.census(VB, st); // VB-633: at the start of the moving round's day
      Sim.advance(st, DAY);
      for (const id of st.liveHouseholds) {
        days.set(id, (days.get(id) || 0) + 1); if (!hungry0.has(id)) hungry0.set(id, 0);
        const log = st.households[id].coldLog; if (log.length && log[log.length - 1] > 0) coldDays++; // the day's fire lacked wood
      }
    }
    samples.push(sample(st, y, { from, hungry0, days, coldDays, waiting, t0 }));
  }
  const cpu = process.cpuUsage(cpu0);
  return { samples, secs: (Date.now() - t0) / 1000, cpuSecs: (cpu.user + cpu.system) / 1e6 };
}
// A year's sample: living, the live households of each village, births, marriages and deaths by cause (read from the record appended
// this year), hungry, cold (VB-327) and all household-days, the worst household's hungry share, the household-years judged and those over
// HUNGRY_SHARE, and checkState's violations.
function sample(st, year, y) {
  const villages = {};
  for (const id of st.liveHouseholds) {
    const f = st.farmsteads[st.households[id].farmstead], v = f ? f.village : null;
    if (v !== null && v !== undefined) villages[v] = (villages[v] || 0) + 1;
  }
  const out = { year, living: st.living.length, households: st.liveHouseholds.length, villages, births: 0, marriages: 0, refusedMatches: 0, deaths: {},
    hungryDays: 0, householdDays: 0, coldDays: y ? y.coldDays || 0 : 0, worstHungry: 0, hungryHouseholds: 0, householdYears: 0, invariants: [] };
  if (!y) return out;
  for (let i = y.from; i < st.record.length; i++) {
    const e = st.record[i]; if (typeof e !== 'object' || e.self) continue; // a folded slot, or a pawn's own telling (VB-199)
    if (e.kind === 'born') out.births++;
    else if (e.kind === 'married') out.marriages++;
    else if (e.kind === 'matchRefused') out.refusedMatches++;
    else if (e.kind === 'died') out.deaths[e.text || 'unknown'] = (out.deaths[e.text || 'unknown'] || 0) + 1;
  }
  for (const [id, n] of y.days) {
    const hungry = st.households[id].hungryDays - y.hungry0.get(id);
    out.hungryDays += hungry; out.householdDays += n;
    // a household made or dissolved during a day may be fed that day and not counted present at its end: at most one day, so the
    // share is capped at 1
    if (n >= MIN_DAYS) {
      const share = hungry / Math.max(n, hungry);
      out.worstHungry = Math.max(out.worstHungry, share); out.householdYears++; if (share > HUNGRY_SHARE) out.hungryHouseholds++;
    }
  }
  // VB-633: the census of who waits to marry (counts by cause, those counted, the servants among them) and the year's marriage facts
  out.waiting = y.waiting ? { counts: y.waiting.counts, n: y.waiting.n, servants: y.waiting.servants } : null;
  out.facts = W.yearFacts(VB, st, y.t0, st.t, y.from);
  out.invariants = checkState(st).slice(0, 5);
  if (out.invariants.length) out.invariants.unshift(`year ${year}`);
  return out;
}
// A band checked on a run's samples, in mode 'assert' or 'report': {id, kind, value, lo, hi, ok}. A described band has no range and is ok.
// A probe reads (samples, afterYear, the band's mode entry), and may give {value, note}: a value worked out, not measured, and how (VB-633).
function judge(band, mode, samples) {
  const b = band[mode], got = PROBES[band.probe](samples, b.afterYear, b), described = band.kind === 'described';
  const worked = got !== null && typeof got === 'object', value = worked ? got.value : got;
  return { id: band.id, probe: band.probe, kind: band.kind, value, ...(worked ? { note: got.note } : {}), lo: b.lo, hi: b.hi,
    ok: described || (value >= b.lo && value <= b.hi) };
}
// A run's summary for the reports: the population at the years asked, births, marriages, deaths by cause and the hungry share.
function summary(samples, at = [1, 10, 20, 30, 50]) {
  const deaths = {}, years = samples.slice(1);
  for (const s of years) for (const [c, n] of Object.entries(s.deaths)) deaths[c] = (deaths[c] || 0) + n;
  const sum = (k) => years.reduce((n, s) => n + s[k], 0), hd = sum('householdDays');
  return { start: samples[0].living, population: Object.fromEntries(at.filter((y) => y < samples.length).map((y) => [y, samples[y].living])),
    end: samples[samples.length - 1].living, births: sum('births'), marriages: sum('marriages'), deaths,
    hungryShare: hd ? sum('hungryDays') / hd : 0 };
}
const fmt = (x) => (Number.isNaN(x) ? 'none' : x === Infinity ? 'inf' : Number.isInteger(x) ? String(x) : x.toFixed(3));
module.exports = { BANDS, PROBES, SETUPS, FULL, WEEKLY, REDUCED, GROWTH, growthTargets, MAPS, MIN_DAYS, runScenario, sample, judge, summary, fmt };
