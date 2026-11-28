// Q5 of the four-scales plan (docs/plans/four-scales/README.md, section 4): do duties raise the share of member-days that begin with
// yesterday's type of work, without late or unmet work?
// node tools/q5.js [--scenario populous] [--seed 7] [--map small] [--years 2] [--json]
// Runs the scenario twice from the same seed: DUTIES, SWITCH.duties of sim/day on (VB-1771: the head's review gives each type of
// recurring work without a window to one member, who has the first place for it in the allotment); and NONE, the switch off (as shipped
// until Kim's answer: no rule gives a duty). Read, without changing the run:
//   continuity: at each day's first working hour, each living member whose list of the morning's allotment holds a task: whether the
//     type of work (KINDS' type) of its first task is the one of its first task the day before (the plan's figure: at least 72%);
//   windowed work: the first day a hand worked each task of a field kind with a window (plowing, sowing, reaping, hauling: sim/hands
//     windowEnd; and the hay: mowing, raking, the hay home), by its key and year; of the tasks begun in both runs, the share begun no
//     later with duties than without (the plan's figure: at least 95%);
//   vital hours unmet: at the evening's end (MATCH.day.evening), the work left of the open tasks of the kinds a household does each day
//     and lives by (`daily` and `vital`: the water, the meal), summed (the plan's figure: within 10% of NONE's).
// Besides: hungry household-days (households' hungryDays) and the duties' counters.
require('./help.js')(__filename);
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : d;
};
const SIZES = { probe: [36, 26], tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const scenario = opt('scenario', 'populous'),
  seed = +opt('seed', 7),
  map = opt('map', 'small'),
  years = +opt('years', 2);
if (!SIZES[map]) {
  console.error('q5: unknown map ' + map);
  process.exit(2);
}
const HAY = new Set(['mow', 'rake', 'hay']);

function run(VB, duties) {
  const Sim = VB.sim,
    D = VB['sim/day'],
    { KINDS } = VB['sim/kinds'],
    { WORK } = VB['sim/rules'],
    { MATCH } = VB['sim/roles'],
    { windowEnd } = VB['sim/hands'];
  const was = D.SWITCH.duties;
  D.SWITCH.duties = duties;
  try {
    const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
    let r;
    while (!(r = it.next()).done);
    const st = Sim.seed(r.value, seed, scenario, null, {});
    const prev = new Map(),
      begun = new Map(),
      evening = Math.round(MATCH.day.evening);
    let days = 0,
      same = 0,
      unmet = 0,
      lastDay = -1;
    const end = st.t + years * Sim.YEAR;
    while (st.t < end - 1e-9) {
      Sim.advance(st, 1);
      const c = Sim.cal(st.t);
      for (const a of st.agents) {
        const j = a && a.job;
        if (!j || !(HAY.has(j.kind) || windowEnd(st, j, c) !== null)) continue;
        const k = `${j.key}@${c.year}`;
        if (!begun.has(k)) begun.set(k, c.day);
      }
      if (c.hour === WORK[0] && c.day !== lastDay) {
        lastDay = c.day;
        for (const [, plan] of st.plans.households) {
          const lists = plan.day && plan.day.lists;
          if (!lists) continue;
          for (const id of Object.keys(lists)) {
            const p = st.pawns[+id];
            if (!p || p.died !== null) continue;
            let t = null;
            for (const key of lists[id]) {
              const j = st.jobs.get(key);
              if (j) {
                t = KINDS[j.kind].type;
                break;
              }
            }
            if (t === null) continue;
            if (prev.has(+id) && prev.get(+id)[0] === c.day - 1) {
              days++;
              if (prev.get(+id)[1] === t) same++;
            }
            prev.set(+id, [c.day, t]);
          }
        }
      }
      if (c.hour === evening)
        for (const j of st.jobs.values()) {
          const K = KINDS[j.kind];
          if (K.daily && K.vital === true) unmet += Math.max(0, D.hoursLeft(st, j));
        }
    }
    return {
      days,
      same,
      share: days ? same / days : null,
      begun,
      unmet,
      hungry: st.households.reduce((s, h) => s + h.hungryDays, 0),
      dutyFirst: VB.count.dutyFirst || 0,
      dutyRead: VB.count.dutyRead || 0,
    };
  } finally {
    D.SWITCH.duties = was;
  }
}
const fresh = () => {
  for (const k of Object.keys(require.cache)) if (/\/src\//.test(k)) delete require.cache[k];
  return require('../src/load.js');
};
const on = run(require('../src/load.js'), true),
  off = run(fresh(), false);
let both = 0,
  noLater = 0,
  earlier = 0;
for (const [k, d] of on.begun)
  if (off.begun.has(k)) {
    both++;
    if (d <= off.begun.get(k)) noLater++;
    if (d < off.begun.get(k)) earlier++;
  }
const out = {
  scenario,
  seed,
  map,
  years,
  continuity: { duties: on.share, none: off.share, days: on.days },
  windowed: { both, noLater, earlier, later: both - noLater, share: both ? noLater / both : null },
  unmet: { duties: on.unmet, none: off.unmet },
  hungry: { duties: on.hungry, none: off.hungry },
  counters: { dutyFirst: on.dutyFirst, dutyRead: on.dutyRead },
};
if (args.includes('--json')) {
  console.log(JSON.stringify(out));
  process.exit(0);
}
const pc = (x) => (x === null ? 'n/a' : (100 * x).toFixed(1) + '%');
console.log(`${scenario} seed ${seed} ${map} map, ${years} years: duties (VB-1771) against none`);
console.log(`  member-days beginning with yesterday's type: ${pc(on.share)} with duties, ${pc(off.share)} without (of ${on.days}; the plan's figure: 72% or more)`);
console.log(`  windowed tasks begun no later with duties: ${noLater} of ${both}, ${pc(out.windowed.share)} (95% or more); earlier ${earlier}, later ${both - noLater} (two runs that part from the first change of work differ both ways)`);
console.log(`  vital hours unmet at the evening's end: ${on.unmet.toFixed(0)} with duties, ${off.unmet.toFixed(0)} without (within 10%)`);
console.log(`  hungry household-days ${on.hungry} / ${off.hungry}; duties put first ${on.dutyFirst}, lists read ${on.dutyRead}`);
