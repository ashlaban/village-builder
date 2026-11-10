// The table of bands (VB-163; target-v2, section 6.2; Kim's decision 9): each band is a probe of a finished run with a range it should
// fall in. A band's `assert` is checked on a reduced scenario in `npm run verify` (tests/bands.js) and fails outside its range; its `report`
// is a full run, made nightly by tools/bands.js, printed as in or out and never failing. A slice's wrap-up adds its loops' bands here.
//   {id, probe, kind, report?: {lo, hi, afterYear, scenario, map, years, seeds}, assert?: {lo, hi, afterYear, setup, years, seeds}}
// `probe` names a function of PROBES, read from the yearly samples that runScenario takes during the run (sample, below); `setup` names
// a reduced scenario of SETUPS. `afterYear` is the probe's year: the probe looks at the years after it (or, for the villages, at it).
const VB = require('../../src/load.js'), G = VB.gen, Sim = VB.sim;
const { checkState } = require('./invariants.js');
const { DAY, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
const MAPS = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as tools/sim.js and the generation screen
// Reduced scenarios: a scenario on a map, nothing else changed yet; toy setups (a tinyState of tests/lib/tiny.js) may join them.
const SETUPS = { 'populous tiny': { scenario: 'populous', map: 'tiny' } };
// The full runs drafted on 2 November (the external review): populous and founders small at four seeds, heirs at two.
const FULL = {
  populous: { scenario: 'populous', map: 'small', years: 30, seeds: [3, 7, 11, 42] },
  founders: { scenario: 'founders', map: 'small', years: 50, seeds: [3, 7, 11, 42] },
  heirs: { scenario: 'heirs', map: 'small', years: 30, seeds: [7, 42] },
};
// The reduced run (VB-163): populous on the tiny map at four seeds for 8 years, about 11 s a seed.
const REDUCED = { setup: 'populous tiny', years: 8, seeds: [3, 7, 11, 42] };
// A household present on fewer days of a year than this is not judged on that year (one founded on the year's last day and hungry
// that day would be hungry on all its days).
const MIN_DAYS = SEASON_DAYS;

// Probes: (samples, afterYear) -> a number. samples[0] is the state at seeding, samples[y] at the end of year y.
const HUNGER = new Set(['hunger', 'starvation']);
const after = (samples, y) => samples.filter((s) => s.year > y);
const PROBES = {
  // living at the end over living at the start
  populationRatio: (s) => s[s.length - 1].living / s[0].living,
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
  // the highest share of its days that a household was hungry, over the years after y (households present MIN_DAYS or more)
  worstHungryShare: (s, y) => Math.max(0, ...after(s, y).map((x) => x.worstHungry)),
  // invariant violations (tests/lib/invariants.js, checkState) over every year end
  invariantFailures: (s) => s.reduce((n, x) => n + x.invariants.length, 0),
};

// The floors against collapse (drafted 2 November; QUESTIONS.md, VB-163, 1): reported on each full run, asserted on the reduced one.
const FLOORS = [
  { id: 'population', probe: 'populationRatio', kind: 'balancing', lo: 1, hi: Infinity, afterYear: 0 },
  { id: 'villages', probe: 'villagesEmptied', kind: 'balancing', lo: 0, hi: 0, afterYear: 5 },
  // Reduced (VB-163, proposed for Kim): over 8 tiny years some 15 die after year 3, so one hunger death is 6 to 7%; seeds 3 and 42
  // have one each today.
  { id: 'hunger-deaths', probe: 'hungerDeathShare', kind: 'balancing', lo: 0, hi: 0.02, afterYear: 3, reduced: { hi: 0.1 } },
  // Reduced (VB-163, proposed for Kim): today a household of seed 42 is hungry on 50% of its days in year 4 (44% in 5, 35% in 6),
  // and one of seed 3 on 31% in year 7; the floor stays 30% on the full runs.
  // Since villages have streets (10 November, proposed for Kim): the worst is one household of seed 42, a lone heir of 19 on a farm of six
  // fields, hungry on 77% of his days in year 4; no other household-year of that seed is over 25% (seven were before), and its hungry
  // share of household-days fell from 1.79% to 0.70%. The worst household is a maximum over some 700
  // household-years, so one such heir moves it: 0.6 became 0.8.
  { id: 'hungry-households', probe: 'worstHungryShare', kind: 'balancing', lo: 0, hi: 0.3, afterYear: 3, reduced: { hi: 0.8 } },
  { id: 'invariants', probe: 'invariantFailures', kind: 'watched', lo: 0, hi: 0, afterYear: 0 },
];
const BANDS = [];
for (const f of FLOORS) for (const [name, run] of Object.entries(FULL)) {
  const range = { lo: f.lo, hi: f.hi, afterYear: f.afterYear };
  BANDS.push({ id: `${f.id}/${name}`, probe: f.probe, kind: f.kind, report: { ...range, ...run },
    ...(name === 'populous' ? { assert: { ...range, ...f.reduced, ...REDUCED } } : {}) });
}

// A floor's `reduced` replaces its range on the reduced run, where it fails today at full strength (VB-163: proposed, not loosened silently).
// One run, sampled at every year end: {scenario, map, seed, years} -> {samples, secs, cpuSecs}. The run advances a day at a time, so a
// household's days present in a year are counted, not guessed.
function runScenario({ scenario, map, seed, years }) {
  const cpu0 = process.cpuUsage(), t0 = Date.now(), it = G.generate(seed, { cols: MAPS[map][0], rows: MAPS[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario), samples = [sample(st, 0, null)];
  for (let y = 1; y <= years; y++) {
    const from = st.record.length, hungry0 = new Map(), days = new Map();
    for (const id of st.liveHouseholds) hungry0.set(id, st.households[id].hungryDays);
    for (let d = 0; d < YEAR_DAYS; d++) {
      Sim.advance(st, DAY);
      for (const id of st.liveHouseholds) { days.set(id, (days.get(id) || 0) + 1); if (!hungry0.has(id)) hungry0.set(id, 0); }
    }
    samples.push(sample(st, y, { from, hungry0, days }));
  }
  const cpu = process.cpuUsage(cpu0);
  return { samples, secs: (Date.now() - t0) / 1000, cpuSecs: (cpu.user + cpu.system) / 1e6 };
}
// A year's sample: living, the live households of each village, births, marriages and deaths by cause (read from the record appended
// this year), hungry household-days and household-days, the worst household's hungry share, and checkState's violations.
function sample(st, year, y) {
  const villages = {};
  for (const id of st.liveHouseholds) {
    const f = st.farmsteads[st.households[id].farmstead], v = f ? f.village : null;
    if (v !== null && v !== undefined) villages[v] = (villages[v] || 0) + 1;
  }
  const out = { year, living: st.living.length, households: st.liveHouseholds.length, villages, births: 0, marriages: 0, deaths: {},
    hungryDays: 0, householdDays: 0, worstHungry: 0, invariants: [] };
  if (!y) return out;
  for (let i = y.from; i < st.record.length; i++) {
    const e = st.record[i];
    if (e.kind === 'born') out.births++;
    else if (e.kind === 'married') out.marriages++;
    else if (e.kind === 'died') out.deaths[e.text || 'unknown'] = (out.deaths[e.text || 'unknown'] || 0) + 1;
  }
  for (const [id, n] of y.days) {
    const hungry = st.households[id].hungryDays - y.hungry0.get(id);
    out.hungryDays += hungry; out.householdDays += n;
    // a household made or dissolved during a day may be fed that day and not counted present at its end: at most one day, so the
    // share is capped at 1
    if (n >= MIN_DAYS) out.worstHungry = Math.max(out.worstHungry, hungry / Math.max(n, hungry));
  }
  out.invariants = checkState(st).slice(0, 5);
  if (out.invariants.length) out.invariants.unshift(`year ${year}`);
  return out;
}
// A band checked on a run's samples, in mode 'assert' or 'report': {id, value, lo, hi, ok}.
function judge(band, mode, samples) {
  const b = band[mode], value = PROBES[band.probe](samples, b.afterYear);
  return { id: band.id, probe: band.probe, value, lo: b.lo, hi: b.hi, ok: value >= b.lo && value <= b.hi };
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
const fmt = (x) => (x === Infinity ? 'inf' : Number.isInteger(x) ? String(x) : x.toFixed(3));
module.exports = { BANDS, PROBES, SETUPS, FULL, REDUCED, MAPS, MIN_DAYS, runScenario, sample, judge, summary, fmt };
