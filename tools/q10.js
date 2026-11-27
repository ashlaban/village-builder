// Q10 of the four-scales plan (docs/plans/four-scales/README.md, section 4): does the levied naming its own days save the household's work?
// node tools/q10.js [--scenario populous] [--seed 7] [--map small] [--years 3] [--json]
// Runs the scenario twice from the same seed: NAMED, the levied head naming its days three days ahead by its own rule (VB-1767, sim/levies
// nameDays: the day that displaces least of its windowed work); and CALENDAR, the days put on the calendar's days (SWITCH.calendar of
// sim/levies: the first days of the window after the notice, nobody's choice). On each day's first hour, each pawn seated on a day owed is
// read for the windowed hours of its household's own work that day displaces, as the head reckons them (sim/levies displaced: for each open
// task whose window is still open, the hours left past what the household's hands can do to the window's end, less that day's, at most a
// day), by the kind of the task. Printed: the days worked, the hours displaced in all and by kind, and the saving of NAMED against CALENDAR
// (the plan's Q10: at least 70%; under 40%, the calendar's days stay as the term). The sampling is read-only: a seed's run is the same as
// by tools/sim.js, save for the switch of the second run.
// Beside it, for reading a small or zero figure: the windowed tasks open on those days and the household's hands' hours a day.
require('./help.js')(__filename);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SIZES = { probe: [36, 26], tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const scenario = opt('scenario', 'populous'), seed = +opt('seed', 7), map = opt('map', 'small'), years = +opt('years', 3);
if (!SIZES[map]) { console.error('q10: unknown map ' + map); process.exit(2); }

function run(VB, calendar) {
  const Sim = VB.sim, L = VB['sim/levies'], { TICKS } = VB['sim/rules'];
  L.SWITCH.calendar = calendar;
  try {
    const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
    let r; while (!(r = it.next()).done);
    const st = Sim.seed(r.value, seed, scenario, null, {});
    const by = {}; let seated = 0, last = -1, total = 0, open = 0, openHours = 0, capHours = 0;
    const end = st.t + years * Sim.YEAR;
    while (st.t < end - 1e-9) {
      Sim.advance(st, 1);
      const d = st.daysToday;
      if (!d || d.day === last) continue;
      last = d.day;
      const c = Sim.cal(st.t);
      for (const id of Object.keys(d.by)) {
        const p = st.pawns[+id], hh = p && p.household !== null ? st.households[p.household] : null;
        if (!hh || hh.dissolved) continue;
        seated++;
        const x = {}, add = (k, v) => { x[k] = (x[k] || 0) + v; };
        for (const j of st.jobsBy.get(`household:${hh.id}`) || []) if (VB['sim/hands'].windowEnd(st, j, c) !== null) { open++; openHours += j.hours ?? 0; }
        capHours += L.capOf(st, hh, d.day);
        total += L.displaced(st, hh, c, d.day, L.capOf(st, hh, d.day), add);
        for (const [k, v] of Object.entries(x)) by[k] = (by[k] || 0) + v;
      }
    }
    return { seated, open, openHours, capHours, displaced: total, by, named: VB.count.daysNamed || 0 };
  } finally { L.SWITCH.calendar = false; }
}
const fresh = () => { for (const k of Object.keys(require.cache)) if (/\/src\//.test(k)) delete require.cache[k]; return require('../src/load.js'); };
const first = require("../src/load.js"), named = run(first, false), cal = run(fresh(), true);
const saving = cal.displaced > 0 ? 1 - named.displaced / cal.displaced : null;
if (args.includes('--json')) { console.log(JSON.stringify({ scenario, seed, map, years, named, calendar: cal, saving })); process.exit(0); }
console.log(`${scenario} seed ${seed} ${map} map, ${years} years: windowed hours of the household's own work the days owed displace`);
for (const [label, x] of [['named', named], ['calendar', cal]])
  console.log(`  ${label.padEnd(9)} ${x.seated} days worked, ${x.displaced.toFixed(1)} h displaced: ` + (Object.entries(x.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ') || 'none'));
for (const [label, x] of [['named', named], ['calendar', cal]])
  console.log(`  ${label.padEnd(9)} read on those days: ${x.open} windowed tasks open (${x.openHours.toFixed(0)} h of them), the household's hands ${(x.capHours / Math.max(1, x.seated)).toFixed(1)} h a day`);
console.log(saving === null ? '  no hours displaced on the calendar: no saving to read' : `  naming saves ${(saving * 100).toFixed(0)}% (the plan's figure: 70% or more; under 40%, the calendar's days stay)`);
