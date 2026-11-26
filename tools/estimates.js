// usage: node tools/estimates.js [--scenario populous] [--map small] [--seeds 3,7,11,42] [--years 30] [--honest Y] [--json]
// The head's estimate measured (VB-476; design.md section 7, The estimate): one process a seed, one per core. Printed:
//   - by thirds of the head's skill (sim/seasonal headSkill, read at each year's end): household-years, hungry household-days (the
//     households' hungryDays over the year) and crops lost to frost (the record's 'frost' events at a farm, of the field's kind: a crop
//     lost standing or in stooks), each a household-year;
//   - with sim/estimate loaded and --honest Y (default 5; 0 for none), over the first Y years: the honesty of the range. Each half hour every
//     full-attention task of a household with a head is read once when it is first worked (the head's estimate of its work then, at a
//     norm hand; only tasks of 4 hours or more), and the half hours each hand works it are counted; when it is done, its person-hours are set against the range the head's
//     estimate gave, read for the hands that worked it (sim/estimate's `span`). The share that ended inside, below and above, by thirds,
//     beside the share the range claims (ESTIMATE.claims), and by kind of task.
// It samples outside the simulation (Sim.advance and reads of st), adding no counter and writing nothing to st. Hourly sampling steps the
// clock in pieces, so the run differs in detail from a plain one.
require('./help.js')(__filename);
const os = require('os'), { fork } = require('child_process');
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);

function run({ scenario, map, seed, years, honest }) {
  const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { MAPS } = require('../tests/lib/bands.js');
  const { DAY, YEAR } = VB['sim/rules'], { headSkill } = VB['sim/seasonal'], E = VB['sim/estimate'];
  const it = G.generate(seed, { cols: MAPS[map][0], rows: MAPS[map][1] });
  let r;
  while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario);
  const STEP = 0.5, LEAST = 4; // sampled each half hour; tasks of 4 hours' work or more at their first reading
  const third = (s) => Math.min(2, Math.floor(s * 3));
  const by = [0, 1, 2].map(() => ({ years: 0, hungry: 0, frost: 0, tasks: 0, inside: 0, below: 0, above: 0 }));
  const seen = new Map(), kinds = {}; // job key -> {hh, third, est, hands: Map(id -> hours)}
  const sample = () => {
    for (const j of st.jobs.values()) {
      if (!j.claims || !j.claims.length || !j.owner || j.owner.type !== 'household') continue;
      let s = seen.get(j.key);
      if (!s || s.job !== j) {
        const hh = st.households[j.owner.id], plan = st.plans.households.get(hh.id);
        if (!plan || !plan.head || !E.attended(j) || !(E.workOf(st, plan.head.pawn, j) >= LEAST)) continue;
        s = { job: j, head: plan.head.pawn, third: third(headSkill(st, hh.id)), work: E.workOf(st, plan.head.pawn, j), hands: new Map() };
        seen.set(j.key, s);
      }
      for (const id of j.claims) if (st.agents[id].job === j && (st.agents[id].leg && st.agents[id].leg.kind === 'work')) s.hands.set(id, (s.hands.get(id) || 0) + STEP);
    }
    for (const [k, s] of seen) {
      if (st.jobs.get(k) === s.job) continue;
      seen.delete(k);
      const worked = [...s.hands.values()].reduce((a, b) => a + b, 0);
      if (!(worked >= 1) || !st.pawns[s.head].alive) continue; // a task dropped before work
      const span = E.span(st, s.head, s.job, s.work, s.hands), b = by[s.third];
      b.tasks++;
      const kd = kinds[s.job.kind] || (kinds[s.job.kind] = { tasks: 0, inside: 0, below: 0, above: 0 });
      kd.tasks++;
      const at = worked < span.lo ? 'below' : worked > span.hi ? 'above' : 'inside';
      b[at]++;
      kd[at]++;
    }
  };
  for (let y = 0; y < years; y++) {
    const days0 = new Map(st.households.map((h) => [h.id, h.hungryDays])), rec0 = st.record.length;
    if (E && y < honest) for (let h = 0; h < YEAR; h += STEP) { Sim.advance(st, STEP); sample(); }
    else Sim.advance(st, YEAR);
    const frost = new Map();
    for (let i = rec0; i < st.record.length; i++) {
      const e = st.record[i];
      if (e.kind === 'frost' && e.farm !== undefined && !/left lying/.test(e.text || '')) frost.set(e.farm, (frost.get(e.farm) || 0) + 1);
    }
    for (const id of st.liveHouseholds) {
      const hh = st.households[id], b = by[third(headSkill(st, id))];
      b.years++;
      b.hungry += hh.hungryDays - (days0.get(id) || 0);
      if (hh.farmstead !== null) b.frost += frost.get(hh.farmstead) || 0;
    }
  }
  return { seed, by, kinds, claims: E ? E.ESTIMATE.claims : null, day: DAY };
}

if (process.env.VB_ESTIMATES_CHILD) {
  process.on('message', (m) => { process.send(run(m)); process.exit(0); });
} else {
  const scenario = opt('--scenario', 'populous'), map = opt('--map', 'small'), years = +opt('--years', 30), honest = +opt('--honest', 5);
  const seeds = opt('--seeds', '3,7,11,42').split(',').map(Number), out = [];
  let next = 0, live = 0;
  const go = () => {
    while (live < Math.max(1, os.cpus().length) && next < seeds.length) {
      const seed = seeds[next++], c = fork(__filename, [], { env: { ...process.env, VB_ESTIMATES_CHILD: '1' } });
      live++;
      c.on('message', (m) => out.push(m));
      c.on('exit', (code) => { live--; if (code) { console.error(`seed ${seed} failed`); process.exitCode = 1; } if (next < seeds.length) go(); else if (!live) report(); });
      c.send({ scenario, map, seed, years, honest });
    }
  };
  const report = () => {
    out.sort((a, b) => a.seed - b.seed);
    const sum = [0, 1, 2].map((t) => out.reduce((s, r) => { for (const k of Object.keys(r.by[t])) s[k] = (s[k] || 0) + r.by[t][k]; return s; }, {}));
    if (args.includes('--json')) return console.log(JSON.stringify({ scenario, map, years, seeds, runs: out, sum }, null, 1));
    console.log(`${scenario} ${map}, ${years} years, seeds ${seeds.join(', ')}`);
    console.log('third of skill  household-years  hungry days a hh-year  frost losses a hh-year  tasks  inside  below  above');
    const names = ['poor (0-1/3)', 'middling', 'good (2/3-1)'];
    sum.forEach((s, t) => {
      const pc = (x) => (s.tasks ? ((100 * x) / s.tasks).toFixed(0) + '%' : '-');
      console.log(`${names[t].padEnd(15)} ${String(s.years).padStart(15)}  ${(s.hungry / Math.max(1, s.years)).toFixed(2).padStart(21)}  ${(s.frost / Math.max(1, s.years)).toFixed(3).padStart(22)}  ${String(s.tasks).padStart(5)}  ${pc(s.inside).padStart(6)}  ${pc(s.below).padStart(5)}  ${pc(s.above).padStart(5)}`);
    });
    if (out[0].claims === null) return;
    console.log(`the range claims ${Math.round(out[0].claims * 100)}%; by kind of task (all heads):`);
    const kinds = {};
    for (const r of out) for (const [k, v] of Object.entries(r.kinds)) for (const [x, n] of Object.entries(v)) (kinds[k] ||= {})[x] = (kinds[k][x] || 0) + n;
    for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1].tasks - a[1].tasks))
      console.log(`  ${k.padEnd(12)} ${String(v.tasks).padStart(6)}  inside ${Math.round((100 * v.inside) / v.tasks)}%, below ${Math.round((100 * v.below) / v.tasks)}%, above ${Math.round((100 * v.above) / v.tasks)}%`);
  };
  go();
}
