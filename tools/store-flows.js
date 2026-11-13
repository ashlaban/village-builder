// The village store's yearly flows (VB-406): grain in (households' yearly filling, common fields' harvest), out (gifts to households,
// seed for the common fields), rotted (ECON.villageStoreLoss), the store at the year's end in years of its village's need, and what the
// giving households would have lost to their own rot. Candidate rules are tried by patching the run here; none is in the game.
// node tools/store-flows.js --scenario populous --seeds 3,7,11 --map small --years 50 [--rule NAME] [--json]
//   --rule: base (the game's), share10 (HELP.storeShare 0.1), rate5 (villageStoreLoss 0.05, a household's), target1 (fill only up to a
//   year of the village's need), target05 (up to half a year), target025 (a quarter), target05+share10 (both).
//   Prints a line per seed; --json prints the rows instead, a line a village-year, as the run goes.
require('./help.js')(__filename);
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Stores = VB['sim/stores'], Hunger = VB['sim/hunger'];
const Commands = VB['sim/commands'], { HELP, YEAR_DAYS } = VB['sim/rules'];
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scenario = opt('scenario', 'populous'), seeds = opt('seeds', '7').split(',').map(Number), map = opt('map', 'small');
const years = +opt('years', 10), rule = opt('rule', 'base'), json = args.includes('--json');
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
// the village's members' need for a year, in rations
const need = (st, v) => {
  let n = 0;
  for (const id of v.farmsteads) { const f = st.farmsteads[id]; if (f.household !== null) n += Hunger.dailyNeed(st, st.households[f.household]); }
  return n * YEAR_DAYS;
};
const tm = /target(\d+)/.exec(rule), target = tm ? +(tm[1][0] === '0' ? '0.' + tm[1].slice(1) : tm[1]) : null; // target05 is half a year
if (/share10/.test(rule)) HELP.storeShare = 0.1;
const issue = Commands.issue; // sim/help reads the command module at each call, so this cap reaches the yearly filling
if (target !== null) Commands.issue = (st, cmd) => {
  if (cmd.source === 'help' && cmd.target && cmd.target.village !== undefined) {
    const v = st.villages[cmd.target.village], room = Math.max(0, target * need(st, v) - Stores.grainOf(v));
    cmd = { ...cmd, args: { ...cmd.args, n: Math.min(cmd.args.n, room) } };
    if (cmd.args.n <= 1e-9) return false;
  }
  return issue(st, cmd);
};
const rows = [];
function run(seed) {
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario);
  if (/rate5/.test(rule)) st.ECON.villageStoreLoss = 0.05;
  let hungry0 = 0;
  for (let y = 1; y <= years; y++) {
    const t0 = (y - 1) * Sim.YEAR + 1, t1 = y * Sim.YEAR + 1;
    if (st.t < t0) Sim.advance(st, t0 - st.t);
    Sim.advance(st, t1 - st.t);
    const hungry = st.households.reduce((s, h) => s + h.hungryDays, 0);
    for (const v of st.villages) {
      const row = { seed, year: y, village: v.id, filled: 0, harvest: 0, given: 0, seed_: 0, rot: -Stores.yearSum(v, 'spoilage', y), takers: new Set() };
      for (const e of v.ledger || []) {
        if (e.t < t0 || e.t >= t1) continue;
        if (e.kind === 'gift') { if (e.n > 0) row.filled += e.n; else { row.given -= e.n; row.takers.add(e.to); } }
        else if (e.kind === 'harvest') row.harvest += e.n;
        else if (e.kind === 'seed') row.seed_ -= e.n;
      }
      row.takers = row.takers.size;
      row.store = Stores.grainOf(v); row.need = need(st, v); row.hungry = hungry - hungry0; // island-wide, the same in each village's row
      rows.push(row);
      if (json) console.log(JSON.stringify(row)); // a line a village-year, as the run goes, so a run cut short keeps its years
    }
    hungry0 = hungry;
  }
  return st;
}
const sts = seeds.map(run), E = sts[0].ECON;
const sum = (l, k) => l.reduce((s, r) => s + r[k], 0), f = (x, d = 0) => (+x).toFixed(d);
if (!json) {
  console.log(`${scenario} ${map} ${years} years, rule ${rule}; rations; home rot ${E.storeLoss[0]} (a year's need) to ${E.storeLoss[1]}; village store ${E.villageStoreLoss}`);
  console.log('seed villages filled commons total_in given takers/yr each seed rot rot%in end_store yrs_need hungry_days/yr home_rot(5%..20%)');
  for (const s of seeds) {
    const l = rows.filter((r) => r.seed === s), inn = sum(l, 'filled') + sum(l, 'harvest'), takers = sum(l, 'takers');
    const last = l.filter((r) => r.year === years), v0 = l[0] ? l[0].village : 0;
    console.log([s, new Set(l.map((r) => r.village)).size, f(sum(l, 'filled')), f(sum(l, 'harvest')), f(inn), f(sum(l, 'given')),
      f(takers / years, 1), f(sum(l, 'given') / Math.max(1, takers), 1), f(sum(l, 'seed_')), f(sum(l, 'rot')), f(100 * sum(l, 'rot') / Math.max(1, inn)) + '%',
      f(sum(last, 'store')), f(sum(last, 'store') / Math.max(1, sum(last, 'need')), 2), f(sum(l.filter((r) => r.village === v0), 'hungry') / years),
      `${f(sum(l, 'filled') * E.storeLoss[0])}..${f(sum(l, 'filled') * E.storeLoss[1])}`].join(' '));
  }
}
