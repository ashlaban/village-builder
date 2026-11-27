// Q12 measured (VB-1843; docs/plans/four-scales/README.md, section 4 Q12; design.md section 7, Plans at four scales: Authors): the
// windows missed by the default author against those missed with five heads on their own plans, whose scripted controller levels its
// own load. The same run twice, from the same seed:
//   default   as the game stands: nothing authored, every household's day the default author's;
//   levelled  the first five households (by id) with a head: each morning at the start of the working hours their heads are put on their
//             own plans (Sim.setAuto off; a head that succeeds one is put on its own when it is first met), and the controller takes the
//             five households' open tasks by key, in key order (none of a daily kind, sim/kinds `daily`: the default author's; none
//             already on a head's plan), and gives each, through Sim.plan's `add`, to the head it is eligible for whose authored hours
//             (the hours left of the tasks by key on its plan) are fewest, while those are under a working day; the verb's refusals
//             are taken as they come (counted by reason) and the task left to the default author.
// A window missed: a task by key of a windowed kind (hoeing and sowing by its crop's sowing window, reaping and carrying in by the frost
// the head expects, mowing by the end of haymaking: sim/agenda deadlineOf) still open past its deadline, or gone undone within the hour
// its deadline shut; or, in the levelled run, an authored task still open past its `by`. Each task counted once a year (its key and the
// year). Sampled each game hour, from outside the simulation: the tool reads st.jobs, the plans and the households, and writes nothing to
// a record (the levelled run's commands are the controller's, as any controller's are). Counted for the five households and for all.
// node tools/levelled.js [--scenario populous] [--map small] [--seed 7] [--years 2] [--heads 5] [--order key|deadline] [--detail] [--json]
//   prints for each run the windows missed (the five, all), by kind, the tasks authored and refused, and the difference levelled - default;
//   --order deadline: the controller takes the windowed tasks first, by their deadlines, then the rest by key (a variant, for the
//   residual's cause: Q12's controller takes them by key);
//   --detail lists the five households' missed tasks (key@year, why, authored, its hands when missed)
require('./help.js')(__filename);
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const scenario = opt('scenario', 'populous'),
  map = opt('map', 'small'),
  seed = +opt('seed', 7),
  years = +opt('years', 2),
  heads = +opt('heads', 5),
  order = opt('order', 'key'),
  json = args.includes('--json');
const SIZES = { probe: [36, 26], tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
if (!SIZES[map]) throw new Error(`levelled: no map ${map}`);
if (!['key', 'deadline'].includes(order)) throw new Error('levelled: --order is key or deadline');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Steps = VB['sim/steps'];
const { DAY, YEAR, WORK, cal } = VB['sim/rules'],
  { KINDS } = VB['sim/kinds'],
  { eligible } = VB['sim/eligibility'],
  { deadlineOf } = VB['sim/agenda'];
const WINDOWED = new Set(['plow', 'sow', 'reap', 'haul', 'mow']),
  SPAN = WORK[1] - WORK[0];

function run(levelled) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
  let r;
  while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario, null, {});
  const five = st.households.filter((hh) => !hh.dissolved && headOf(st, hh) !== null).slice(0, heads).map((hh) => hh.id),
    mine = new Set(five);
  const seen = new Map(), // `${key}@${year}` -> {j, dl (the last deadline read, a game hour, or null), hh}
    missed = new Map(), // the same key -> {kind, hh, why}
    refused = {},
    own = new Set(),
    ever = new Set(); // the keys a head was given, through the verb

  let authored = 0;
  const miss = (k, j, why) => {
    if (!missed.has(k))
      missed.set(k, {
        kind: j.kind,
        hh: j.owner && j.owner.type === 'household' ? j.owner.id : null,
        why,
        authored: ever.has(j.key),
        hands: j.claims ? j.claims.length : 0,
      });
  };
  const loadOf = (id) => {
    const pp = Steps.pawnPlan(st, id);
    let h = 0;
    for (const g of pp ? pp.tasks : []) {
      const j = g.key !== undefined && st.jobs.get(g.key);
      if (j) h += Math.max(0, j.hours - (j.done || 0));
    }
    return h;
  };
  function control() {
    const hs = [];
    for (const id of five) {
      const hh = st.households[id],
        h = hh && !hh.dissolved ? headOf(st, hh) : null;
      if (h === null || !st.pawns[h].alive) continue;
      if (!own.has(h) && Sim.setAuto(st, h, false) === true) own.add(h);
      if (own.has(h)) hs.push(h);
    }
    if (!hs.length) return;
    const planned = new Set(),
      load = new Map();
    for (const h of hs) {
      for (const g of (Steps.pawnPlan(st, h) || { tasks: [] }).tasks) if (g.key !== undefined) planned.add(g.key);
      load.set(h, loadOf(h));
    }
    const open = [];
    for (const id of five)
      for (const j of st.jobsBy.get(`household:${id}`) || []) if (!KINDS[j.kind].daily && !planned.has(j.key)) open.push(j);
    const c = cal(st.t),
      due = (j) => {
        const d = order === 'deadline' && WINDOWED.has(j.kind) ? deadlineOf(st, j, c) : null;
        return d ? d.t : Infinity;
      };
    const at = new Map(open.map((j) => [j, due(j)]));
    open.sort((a, b) => at.get(a) - at.get(b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const j of open) {
      let best = null;
      for (const h of hs)
        if (load.get(h) < SPAN && eligible(st, j, st.pawns[h]) && (best === null || load.get(h) < load.get(best))) best = h;
      if (best === null) continue;
      const res = Sim.plan(st, best, 'add', { key: j.key });
      if (res === true) {
        authored++;
        ever.add(j.key);
        load.set(best, load.get(best) + Math.max(0, j.hours - (j.done || 0)));
      } else {
        const why = String(res).replace(/\d+(\.\d+)?/g, 'N');
        refused[why] = (refused[why] || 0) + 1;
      }
    }
  }
  function sample() {
    const y = Math.floor(st.t / YEAR),
      c = cal(st.t);
    for (const j of st.jobs.values()) {
      if (!WINDOWED.has(j.kind)) continue;
      const k = `${j.key}@${y}`;
      let s = seen.get(k);
      if (!s) seen.set(k, (s = { j, dl: null }));
      const d = deadlineOf(st, j, c);
      if (d) s.dl = d.t;
      if (s.dl !== null && st.t > s.dl) miss(k, j, 'window');
    }
    for (const [k, s] of seen) {
      if (st.jobs.get(s.j.key) === s.j) continue;
      if ((s.j.done || 0) < s.j.hours - 1e-6 && s.dl !== null && st.t >= s.dl - 1) miss(k, s.j, 'window');
      seen.delete(k);
    }
    if (!levelled) return;
    const today = Math.floor(st.t / DAY);
    for (const h of own) {
      const pp = Steps.pawnPlan(st, h);
      if (!pp) continue;
      pp.steps.forEach((s, i) => {
        const g = pp.tasks[i],
          j = g.key !== undefined && st.jobs.get(g.key);
        if (j && Number.isInteger(s.by) && today > s.by) miss(`${j.key}@${y}`, j, 'by');
      });
    }
  }
  const end = years * YEAR;
  while (st.t < end - 1e-6) {
    if (levelled && Math.round(st.t % DAY) === WORK[0]) control();
    Sim.advance(st, 1);
    sample();
  }
  const count = (only) => {
    const out = { all: 0, byKind: {}, by: 0, authored: 0 };
    for (const m of missed.values()) {
      if (only && !only.has(m.hh)) continue;
      out.all++;
      out.byKind[m.kind] = (out.byKind[m.kind] || 0) + 1;
      if (m.why === 'by') out.by++;
      if (m.authored) out.authored++;
    }
    return out;
  };
  const list = [...missed].filter(([, m]) => mine.has(m.hh)).map(([k, m]) => ({ key: k, ...m }));
  return { five, heads: [...own], five_missed: count(mine), all_missed: count(null), authored, refused, list };
}
function headOf(st, hh) {
  const plan = st.plans.households.get(hh.id),
    id = plan && plan.head ? plan.head.pawn : null;
  return Number.isInteger(id) && st.pawns[id] && st.pawns[id].alive ? id : null;
}

const base = run(false),
  lev = run(true);
const diff = (a, b) => ({ n: b - a, pct: a ? Math.round((1000 * (b - a)) / a) / 10 : null });
const out = {
  scenario,
  map,
  seed,
  years,
  default: base,
  levelled: lev,
  difference: { five: diff(base.five_missed.all, lev.five_missed.all), all: diff(base.all_missed.all, lev.all_missed.all) },
};
if (json) console.log(JSON.stringify(out, null, 1));
else {
  const line = (name, r) =>
    `${name.padEnd(9)} windows missed: the five ${r.five_missed.all} (${JSON.stringify(r.five_missed.byKind)}${r.five_missed.by ? `, ${r.five_missed.by} by their by` : ''}${r.five_missed.authored ? `; ${r.five_missed.authored} of them authored` : ''}), all ${r.all_missed.all} (${JSON.stringify(r.all_missed.byKind)})`;
  console.log(`${scenario} ${map} seed ${seed}, ${years} years, the controller by ${order}; the five households ${base.five.join(', ')}`);
  console.log(line('default', base));
  console.log(line('levelled', lev));
  if (args.includes('--detail'))
    for (const [name, r] of [['default', base], ['levelled', lev]])
      for (const m of r.list) console.log(`  ${name} ${m.key} ${m.why}${m.authored ? ' authored' : ''}, ${m.hands} hands`);
  console.log(`  authored ${lev.authored} tasks by ${lev.heads.length} heads; refused ${JSON.stringify(lev.refused)}`);
  const d = out.difference;
  console.log(
    `difference (levelled - default): the five ${d.five.n}${d.five.pct === null ? '' : ` (${d.five.pct}%)`}, all ${d.all.n}${d.all.pct === null ? '' : ` (${d.all.pct}%)`}`,
  );
}
