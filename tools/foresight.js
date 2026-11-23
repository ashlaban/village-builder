// Foresight's hunger, by a measure one household cannot swing (VB-571; backlog/VB-485.md, backlog/VB-254.md).
// node tools/foresight.js [--seeds 3,7,11,42,5,13,21,29] [--scenario populous] [--map small] [--years 30] [--jobs 4] [--root DIR]
//                         [--json] [--save FILE]
// node tools/foresight.js --compare A.json B.json [--json]
// node tools/sim.js --scenario populous --seed 7 --map small --years 30 --report foresight [--json]   (one seed)
// The hungry household-days of a run (the sum of `hungryDays`) move by a fifth to a half between versions that differ only in a head's
// targets, since one household's bad stretch is 15 to 30 days of them. This measures by household-years instead: a household-year is a
// household standing on some day of a year of the run, and one household is at most one of them a year (of some 3,000 on populous
// small over 30 years). For each seed: household-years; the share of them with any hunger (`hungryDays` rose on a day of that year);
// the hungry days per household-year; the hungry household-days of the old measure beside them, and the largest share of them one
// household holds. By the head's skill third: household-years whose household had a head on most days of the year, cut by the head's
// skill (its mean over the year's days, sim/seasonal's or sim/plans' headSkill) at the terciles of those of that seed, each third's
// share hungry and days per household-year. A version with no head's skill (before VB-254) gives no thirds. Over the seeds: the mean,
// the standard deviation and the least and greatest of each measure: the seeds' spread.
// --compare A.json B.json (two runs saved with --save, the same seeds): B less A seed by seed, the mean difference and its standard
// error (the sd of the differences over the root of the seeds), and whether the difference is outside twice that error.
// --root DIR runs the simulation of another checkout (a `git worktree` of an older commit), with this file's measure: the version's own
// load.js, generator and `Sim.seed`/`Sim.advance`; seeds run as child processes, --jobs at a time. It reads the state and changes
// nothing, but it advances the clock a day at a time, which a version before the clock's own steps were exact may run differently in
// detail from one advance of a year.
// Used by tools/sim.js: report(VB, st) gives { advanceYear, result }; summarise(rows), compare(a, b).
require('./help.js')(__filename);
const path = require('path');

// The skill of household id's head now, or null where it has no head or the version has no head's skill.
function skillReader(VB, st) {
  const mod = ['sim/seasonal', 'sim/plans'].map((k) => VB[k]).find((m) => m && typeof m.headSkill === 'function');
  if (!mod) return () => null;
  return (id) => {
    const plan = st.plans && st.plans.households && st.plans.households.get(id);
    return plan && plan.head ? mod.headSkill(st, id) : null;
  };
}

// The per-day reading of a run: advanceYear() in place of Sim.advance(st, YEAR), result() the seed's row.
function report(VB, st) {
  const Sim = VB.sim, skillOf = skillReader(VB, st), prev = new Map(), years = new Map(); // `${household} ${year}` -> its record
  for (const h of st.households) prev.set(h.id, h.hungryDays);
  function day() {
    const year = Math.floor(st.t / Sim.YEAR); // the year the day begins in
    Sim.advance(st, Sim.DAY);
    for (const h of st.households) {
      const was = prev.has(h.id) ? prev.get(h.id) : 0, d = h.hungryDays - was;
      prev.set(h.id, h.hungryDays);
      if (h.dissolved && d === 0) continue;
      const key = h.id + ' ' + year;
      let r = years.get(key);
      if (!r) years.set(key, (r = { household: h.id, year, days: 0, on: 0, headed: 0, skill: 0 }));
      r.days += d;
      r.on++;
      const s = skillOf(h.id);
      if (s !== null) { r.headed++; r.skill += s; }
    }
  }
  function advanceYear() { for (let i = 0; i < Sim.YEAR_DAYS; i++) day(); }
  function result() { return { living: st.pawns.filter((p) => p.alive).length, rows: [...years.values()] }; }
  return { advanceYear, result };
}

const round = (x, n = 4) => (Number.isFinite(x) ? +x.toFixed(n) : null);
// One seed's measures from its household-years.
function measure(rows) {
  const n = rows.length, hungry = rows.filter((r) => r.days > 0).length, days = rows.reduce((s, r) => s + r.days, 0);
  const byHouse = new Map();
  for (const r of rows) byHouse.set(r.household, (byHouse.get(r.household) || 0) + r.days);
  const most = Math.max(0, ...byHouse.values());
  const headed = rows.filter((r) => r.headed * 2 > r.on).map((r) => ({ ...r, s: r.skill / r.headed })).sort((a, b) => a.s - b.s);
  const thirds = headed.length >= 3
    ? [0, 1, 2].map((k) => {
        const part = headed.slice(Math.floor((k * headed.length) / 3), Math.floor(((k + 1) * headed.length) / 3));
        return { n: part.length, skill: [round(part[0].s, 3), round(part[part.length - 1].s, 3)],
          hungryShare: round(part.filter((r) => r.days > 0).length / part.length), daysPer: round(part.reduce((s, r) => s + r.days, 0) / part.length) };
      })
    : null;
  return { householdYears: n, hungryShare: round(hungry / Math.max(1, n)), daysPer: round(days / Math.max(1, n)), hungryDays: days,
    oneHousehold: round(days ? most / days : 0, 3), thirds };
}
const stats = (xs) => {
  const v = xs.filter((x) => x !== null && x !== undefined);
  if (!v.length) return null;
  const mean = v.reduce((s, x) => s + x, 0) / v.length, sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, v.length - 1));
  return { mean: round(mean), sd: round(sd), min: round(Math.min(...v)), max: round(Math.max(...v)) };
};
// The measures that are compared: name -> reader of a seed's measures.
const MEASURES = {
  hungryShare: (m) => m.hungryShare, daysPer: (m) => m.daysPer, hungryDays: (m) => m.hungryDays,
  lowShare: (m) => (m.thirds ? m.thirds[0].hungryShare : null), midShare: (m) => (m.thirds ? m.thirds[1].hungryShare : null),
  highShare: (m) => (m.thirds ? m.thirds[2].hungryShare : null), lowDaysPer: (m) => (m.thirds ? m.thirds[0].daysPer : null),
  highDaysPer: (m) => (m.thirds ? m.thirds[2].daysPer : null),
};
// Over the seeds: each seed's measures and the spread of each.
function summarise(seeds) {
  const per = seeds.map((s) => ({ seed: s.seed, living: s.living, ...measure(s.rows) }));
  return { seeds: per, spread: Object.fromEntries(Object.entries(MEASURES).map(([k, f]) => [k, stats(per.map(f))])) };
}
// B less A, seed by seed (the seeds both hold), for each measure.
function compare(a, b) {
  const out = {};
  for (const [k, f] of Object.entries(MEASURES)) {
    const d = [];
    for (const sb of b.seeds) {
      const sa = a.seeds.find((x) => x.seed === sb.seed), x = sa && f(sa), y = f(sb);
      if (sa && x !== null && y !== null) d.push(y - x);
    }
    const s = stats(d);
    if (!s) continue;
    const se = s.sd / Math.sqrt(d.length);
    out[k] = { seeds: d.length, a: stats(a.seeds.map(f)).mean, b: stats(b.seeds.map(f)).mean, diff: s.mean, se: round(se), outside: Math.abs(s.mean) > 2 * se };
  }
  return out;
}

const SIZES = { probe: [36, 26], tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as tools/sim.js
// One seed in this process, on the checkout `root`: its household-years.
function one(root, scenario, seed, map, years) {
  const VB = require(path.join(root, 'src/load.js')), it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
  let r;
  while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, seed, scenario), rep = report(VB, st);
  for (let y = 0; y < years; y++) rep.advanceYear();
  return { seed, ...rep.result() };
}

if (require.main === module) {
  const fs = require('fs'), { fork } = require('child_process'), args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, json = args.includes('--json');
  const root = path.resolve(opt('root', path.join(__dirname, '..'))), scenario = opt('scenario', 'populous'), map = opt('map', 'small');
  const years = +opt('years', 30);
  if (args.includes('--child')) {
    process.send(one(root, scenario, +opt('seed', 7), map, years));
    process.exit(0);
  }
  const print = (o) => console.log(JSON.stringify(o, null, json ? 1 : undefined));
  if (args.includes('--compare')) {
    const i = args.indexOf('--compare'), [a, b] = [args[i + 1], args[i + 2]].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    const c = compare(a, b);
    if (json) print(c);
    else {
      console.log(`B less A, seed by seed: A ${args[i + 1]}, B ${args[i + 2]}`);
      console.table(c);
    }
    process.exit(0);
  }
  const seeds = opt('seeds', '3,7,11,42,5,13,21,29').split(',').map(Number), jobs = +opt('jobs', 4), out = [], t0 = Date.now();
  let next = 0;
  const run = () => {
    if (next >= seeds.length) return Promise.resolve();
    const seed = seeds[next++];
    return new Promise((done, fail) => {
      const p = fork(__filename, ['--child', '--seed', String(seed), '--root', root, '--scenario', scenario, '--map', map, '--years', String(years)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      p.on('message', (m) => out.push(m));
      p.on('exit', (code) => (code ? fail(new Error(`seed ${seed} failed: ${code}`)) : done()));
    }).then(run);
  };
  Promise.all(Array.from({ length: Math.min(jobs, seeds.length) }, run)).then(() => {
    out.sort((a, b) => seeds.indexOf(a.seed) - seeds.indexOf(b.seed));
    const s = { root, scenario, map, years, minutes: round((Date.now() - t0) / 60000, 1), ...summarise(out) };
    if (opt('save', null)) fs.writeFileSync(opt('save'), JSON.stringify(s));
    if (json) return print(s);
    console.log(`${scenario} ${map}, ${years} years, seeds ${seeds.join(', ')}, from ${root} (${s.minutes} minutes)`);
    console.table(s.seeds.map((x) => ({ seed: x.seed, living: x.living, hhYears: x.householdYears, hungryShare: x.hungryShare, daysPer: x.daysPer, hungryDays: x.hungryDays,
      oneHousehold: x.oneHousehold, ...(x.thirds ? { low: `${x.thirds[0].hungryShare} / ${x.thirds[0].daysPer}`, mid: `${x.thirds[1].hungryShare} / ${x.thirds[1].daysPer}`, high: `${x.thirds[2].hungryShare} / ${x.thirds[2].daysPer}` } : {}) })));
    console.log('over the seeds (thirds: share of household-years hungry / hungry days a household-year):');
    console.table(s.spread);
  }, (e) => { console.error(e.message); process.exit(1); });
}

module.exports = { report, measure, summarise, compare, MEASURES };
