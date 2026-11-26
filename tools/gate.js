// The gate (VB-1774; docs/plans/four-scales/README.md, 3.10): the six runs of a gated task, and the comparison with the task's before.
// node tools/gate.js [--json] [--out FILE] [--base FILE] [--jobs N]
//   Runs founders and populous, small map, seeds 7, 11 and 42, 10 years, N at a time (default: the cores, at most 6; `--jobs 1` one
//   by one). A line a run: the settlements at year 0 and at year 10 with their living (`id:living0>living10`), those extinct and why
//   (`hunger`, or the cause of the settlement's last deaths in the record), the tasks held over 48 hours without progress, the food
//   accounts' `unexplained` (the run's years' absolute sum, rations, tools/accounts.js), hungry household-days, deaths by hunger.
//   --json   the result as data on stdout (also what --out writes)
//   --out FILE   keep the result (the commit it was made at, its runs)
//   --base FILE  compare with a kept result: exit 1 when the gate fails, 0 when it holds. It fails when, in any run:
//     - a settlement is extinct by hunger that the base keeps alive;
//     - a settlement has collapsed: its living at year 10 are under half its living at year 0 AND under half the base run's at year 10
//       (a decline the base shares is not charged to the task; a settlement the base lacks is compared with its own year 0 only);
//     - more tasks are held over 48 hours without progress than in the base: a claimed task whose `done`, trips made (`made`) and
//       pile left (`left`) have not moved, whose rate is nil and none of whose hands walks with a load for it, over 48 hours, sampled
//       every 6 hours, each task counted once;
//     - `unexplained` is larger than the base's by more than 1 ration plus 0.1% of the run's food produced.
//   Hunger days and deaths by hunger are printed beside the base and never fail. The base is kept at docs/gate/base.json, the
//   result at the commit the tool landed on; the next task of the arch compares with it, and keeps its own for the one after
//   (`--out docs/gate/base.json`).
//   Internal: --run SCENARIO SEED prints one run's result (what the parent starts).
require('./help.js')(__filename);
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const SCENARIOS = ['founders', 'populous'], SEEDS = [7, 11, 42], YEARS = 10, HELD = 48, STEP = 6;
const HUNGER = new Set(['hunger', 'starvation']);

// The comparison of a result with its base, on data alone: the failures as lines, and the printed rows.
function compare(cur, base) {
  const fails = [], rows = [];
  for (const r of cur.runs) {
    const b = (base.runs || []).find((x) => x.scenario === r.scenario && x.seed === r.seed), name = `${r.scenario} ${r.seed}`;
    if (!b) { rows.push({ run: name, note: 'not in the base' }); continue; }
    for (const s of r.settlements) {
      const bs = b.settlements.find((x) => x.id === s.id);
      if (s.extinct && s.why === 'hunger' && bs && !bs.extinct) fails.push(`${name}: settlement ${s.id} extinct by hunger, alive in the base`);
      if (s.living0 > 0 && !s.extinct && s.living10 * 2 < s.living0 && (!bs || s.living10 * 2 < bs.living10))
        fails.push(`${name}: settlement ${s.id} collapsed (${s.living0} to ${s.living10}${bs ? `, base ${bs.living10}` : ''})`);
    }
    if (r.stuck > b.stuck) fails.push(`${name}: ${r.stuck} tasks held over ${HELD} hours, base ${b.stuck}`);
    if (r.unexplained > b.unexplained + 1 + 0.001 * r.produced) fails.push(`${name}: unexplained ${r.unexplained}, base ${b.unexplained}`);
    rows.push({ run: name, hungryDays: `${r.hungryDays} (base ${b.hungryDays})`, hungerDeaths: `${r.hungerDeaths} (base ${b.hungerDeaths})`, stuck: `${r.stuck} (base ${b.stuck})`, unexplained: `${r.unexplained} (base ${b.unexplained})` });
  }
  return { ok: !fails.length, fails, rows };
}

// One run, in this process: the accounts report steps the years; Sim.advance is wrapped to sample the held tasks.
function run(scenario, seed) {
  const accounts = require('./accounts.js'), VB = accounts.load(), G = VB.gen, Sim = VB.sim;
  const it = G.generate(seed, { cols: 180, rows: 130 });
  let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario, null, {}), Rec = VB['sim/records'];
  const living = () => { const m = new Map(st.villages.map((v) => [v.id, 0])); for (const id of st.living) { const v = Rec.settlementIdOf(st, st.pawns[id]); if (v !== null) m.set(v, (m.get(v) || 0) + 1); } return m; };
  const l0 = living(), hungry0 = st.households.reduce((s, h) => s + h.hungryDays, 0), seen = new Map(), stuck = new Set(); let nextSample = st.t;
  const adv = Sim.advance;
  Sim.advance = (s, dt) => {
    adv(s, dt);
    if (s.t < nextSample) return;
    nextSample = s.t + STEP;
    for (const j of s.jobs.values()) {
      const e = seen.get(j), mark = `${j.done}|${j.made}|${j.left}`;
      // progress: its work done, its trips made or what still lies (VB-1749's trips, sim/lying's j.left), or a hand of it walking with a
      // load for it (a trip of many hours, a far woodlot's or a pile's, whose work leg the samples miss; VB-1812)
      if (!j.claims.length || j.rate > 0 || j.claims.some((id) => { const a = s.agents[id]; return a && a.job && a.job.key === j.key && a.carry && a.path; })) { seen.delete(j); continue; }
      if (!e || e.mark !== mark) seen.set(j, { mark, since: s.t });
      else if (s.t - e.since >= HELD) stuck.add(j.id);
    }
    for (const j of seen.keys()) if (s.jobs.get(j.key) !== j) seen.delete(j);
  };
  const acc = accounts.report(VB, st);
  for (let y = 0; y < YEARS; y++) acc.advanceYear();
  Sim.advance = adv;
  const out = acc.result(), l1 = living();
  let unexplained = 0, produced = 0;
  for (const y of out.years) { unexplained += Math.abs(y.food.all.unexplained); produced += y.food.all.produced; }
  const caused = new Map(), deathOf = new Map(); // pawn -> cause; settlement -> causes of its last deaths, latest first
  for (const e of st.record) if (e && e.kind === 'died') caused.set(e.pawn, e.cause || 'unknown');
  for (const p of st.pawns.filter((q) => !q.alive && q.household !== null).sort((a, b) => b.died - a.died)) {
    const v = Rec.settlementIdOf(st, p), a = deathOf.get(v) || deathOf.set(v, []).get(v);
    if (a.length < 5) a.push(caused.get(p.id) || 'unknown');
  }
  const settlements = [...l0.keys()].filter((id) => l0.get(id) > 0 || (l1.get(id) || 0) > 0).map((id) => {
    const a = l0.get(id) || 0, b = l1.get(id) || 0, causes = deathOf.get(id) || [], hung = causes.filter((c) => HUNGER.has(c)).length;
    return { id, name: st.villages[id].name || String(id), living0: a, living10: b, extinct: a > 0 && b === 0,
      why: a > 0 && b === 0 ? (causes.length && hung * 2 >= causes.length ? 'hunger' : causes[0] || 'unknown') : null };
  });
  let hungerDeaths = 0;
  for (const c of caused.values()) if (HUNGER.has(c)) hungerDeaths++;
  return { scenario, seed, settlements, stuck: stuck.size, unexplained: Math.round(unexplained), produced: Math.round(produced),
    hungryDays: st.households.reduce((s, h) => s + h.hungryDays, 0) - hungry0, hungerDeaths };
}

const line = (r) => `${r.scenario.padEnd(8)} ${String(r.seed).padStart(2)}  settlements ${r.settlements.length}  ` +
  r.settlements.map((s) => `${s.id}:${s.living0}>${s.living10}${s.extinct ? ' EXTINCT(' + s.why + ')' : ''}`).join(' ') +
  `  stuck ${r.stuck}  unexplained ${r.unexplained}  hungry-days ${r.hungryDays}  hunger-deaths ${r.hungerDeaths}`;

function main() {
  const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  if (args[0] === '--run') { process.stdout.write(JSON.stringify(run(args[1], +args[2]))); return; }
  const jobs = +(opt('jobs') || Math.min(6, os.cpus().length)), todo = SCENARIOS.flatMap((s) => SEEDS.map((n) => [s, n])), runs = [];
  const t0 = Date.now(); let next = 0, bad = 0;
  const worker = async () => {
    while (next < todo.length) {
      const [s, n] = todo[next++];
      const out = await new Promise((res) => {
        const c = cp.spawn(process.execPath, [__filename, '--run', s, String(n)], { stdio: ['ignore', 'pipe', 'inherit'] }); let b = '';
        c.stdout.on('data', (d) => (b += d)); c.on('close', (code) => res(code === 0 ? JSON.parse(b) : null));
      });
      if (!out) { bad++; console.error(`run ${s} ${n} failed`); } else runs.push(out);
    }
  };
  Promise.all(Array.from({ length: Math.max(1, jobs) }, worker)).then(() => {
    if (bad) process.exit(2);
    const at = (r) => todo.findIndex((t) => t[0] === r.scenario && t[1] === r.seed);
    runs.sort((a, b) => at(a) - at(b));
    let commit = ''; try { commit = cp.execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }).toString().trim(); } catch (e) { /* no git */ }
    const res = { commit, years: YEARS, wallSeconds: Math.round((Date.now() - t0) / 1000), runs };
    if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(res, null, 1) + '\n');
    if (args.includes('--json')) console.log(JSON.stringify(res, null, 1)); else { for (const r of runs) console.log(line(r)); console.log(`wall ${res.wallSeconds} s, ${jobs} at a time`); }
    if (opt('base')) {
      const c = compare(res, JSON.parse(fs.readFileSync(opt('base'), 'utf8')));
      if (!args.includes('--json')) { console.table(c.rows); console.log(c.ok ? 'gate: holds' : 'gate: FAILS\n' + c.fails.join('\n')); }
      process.exit(c.ok ? 0 : 1);
    }
  });
}
if (require.main === module) main(); else module.exports = { compare, run };
