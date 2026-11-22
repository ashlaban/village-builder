// Food balance of farms (VB-048, the balance review): per household and game year, rations made by source (grain net of seed, milk drunk
// fresh, butter, meat) against what its members need, grouped by household size, by cattle and by the year's weather.
// node tools/balance.js --scenario founders|heirs|populous --seeds 3,7,11,42 --map small --years 30 [--from 3] [--json]
//   --map probe|tiny|small|medium|large (probe: the 36 by 26 island of tests/lib/probe.js)
//   --from Y: count years from Y on (the first years of a scenario are settling in); --json prints the household-years as well.
//   --rye: every village given rye and farming in three courses from the start (the test switch of VB-350, sim/scenarios giveRye).
// Grain is also reported by crop (barley, rye, peas: the harvest of each, net of the seed its fields took; VB-350).
// Beside `node tools/sim.js --report accounts` (VB-403, tools/accounts.js): this counts a household's own produce from grain (net of
// seed), milk, butter and meat, and leaves fish and gathered food out, so its food over need is lower (1.05 to 1.52 on the review's runs
// against 1.64 to 1.86 with them); the accounts count all food produced, fish and gathered food and the common fields' harvest too,
// gross of seed (seed is an outlet), and close the year's account from the stores' movements and stocks.
require('./help.js')(__filename);
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, H = VB['sim/herds'], F = VB['sim/hunger'], Stores = VB['sim/stores'];
const { CROPS } = VB['sim/rules'];
const SIZES = { probe: [36, 26], tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // probe: as tools/sim.js
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scenario = opt('scenario', 'founders'), seeds = opt('seeds', '7').split(',').map(Number), map = opt('map', 'small');
const years = +opt('years', 10), from = +opt('from', 2), json = args.includes('--json'), rye = args.includes('--rye');
const SOURCES = ['grain', 'milk', 'butter', 'meat'], GRAINS = Stores.CROP_LIST;
const rows = []; // one per household and year
// The head's remembered yield (VB-767, sim/yields): rations booked by source since the run began (the ring's years and the open tally)
const Y = VB['sim/yields'];
const booked = (hh, k) => (hh.yields ? hh.yields.ring[k].reduce((s, n) => s + n, 0) + hh.yields.tally[k] : 0);

function cattleOf(st, hh) { return H.herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'cattle' ? hd.head.length : 0), 0); }
function sheepOf(st, hh) { return H.herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'sheep' ? hd.ewes + hd.rams + hd.lambs : 0), 0); }
function run(seed) {
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario, null, { rye }), E = st.ECON;
  for (let y = 1; y <= years; y++) {
    const t0 = (y - 1) * Sim.YEAR + 1, t1 = y * Sim.YEAR + 1;
    if (st.t < t0) Sim.advance(st, t0 - st.t);
    const weather = st.weather, before = new Map(st.households.map((h) => [h.id, { hungry: h.hungryDays, grain: Stores.grainOf(h) + h.meals,
      cattle: cattleOf(st, h), sheep: sheepOf(st, h), mem: { fields: booked(h, 'fields'), animals: booked(h, 'animals') } }]));
    Sim.advance(st, t1 - st.t);
    if (y < from) continue;
    for (const hh of st.households) {
      if (hh.dissolved || !before.has(hh.id)) continue;
      const b = before.get(hh.id), f = st.farmsteads[hh.farmstead], made = Object.fromEntries(SOURCES.map((k) => [k, 0]));
      let gifts = 0;
      const crops = Object.fromEntries(GRAINS.map((k) => [k, 0]));
      for (const e of hh.ledger) {
        if (e.t < t0 || e.t >= t1) continue;
        if (e.kind === 'harvest') { // a field's loads are entries; the seed was sown from the store; its crop, barley unless named (VB-350)
          const k = e.crop || 'barley', net = e.n - (e.first ? CROPS[k].seed : 0);
          made.grain += net;
          crops[k] += net;
        }
        else if (e.kind in made) made[e.kind] += e.n;
        else if (e.kind === 'gift') gifts += e.n;
      }
      // milk and butter are routine movements, summed per calendar year (VB-204); game year y runs from t0 to t1
      for (const k of ['milk', 'butter']) made[k] += Stores.yearSum(hh, k, y);
      const size = F.dailyNeed(st, hh), need = size * Sim.YEAR_DAYS, total = SOURCES.reduce((s, k) => s + made[k], 0);
      const soil = f.fields.length ? f.fields.reduce((s, q) => s + q.soil, 0) / f.fields.length : null;
      const mem = { fields: +(booked(hh, 'fields') - b.mem.fields).toFixed(1), animals: +(booked(hh, 'animals') - b.mem.animals).toFixed(1) };
      rows.push({ seed, mem, year: y, household: hh.id, weather: +weather.toFixed(3), size, members: hh.members.length, fields: f.fields.length,
        meadows: f.meadows.length, cattle: b.cattle, sheep: b.sheep, soil: soil === null ? null : +soil.toFixed(3),
        ...Object.fromEntries(SOURCES.map((k) => [k, +made[k].toFixed(1)])), ...Object.fromEntries(GRAINS.map((k) => [k, +crops[k].toFixed(1)])),
        fallow: f.fields.filter((q) => CROPS[q.crop].fallow).length, total: +total.toFixed(1), need, gifts: +gifts.toFixed(1),
        hungryDays: hh.hungryDays - b.hungry, store: Math.round(Stores.grainOf(hh) + hh.meals), storeChange: Math.round(Stores.grainOf(hh) + hh.meals - b.grain) });
    }
  }
  return st;
}
for (const s of seeds) run(s);

// groups: mean of each measure over the household-years in the group
function group(key, label) {
  const g = new Map();
  for (const r of rows) { const k = key(r); if (k === null) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  const mean = (l, f) => l.reduce((s, r) => s + f(r), 0) / l.length;
  const out = [...g].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, l]) => ({
    [label]: k, 'household-years': l.length,
    ...Object.fromEntries(SOURCES.map((s) => [s, +mean(l, (r) => r[s]).toFixed(1)])),
    ...Object.fromEntries(GRAINS.map((s) => [s, +mean(l, (r) => r[s]).toFixed(1)])),
    made: +mean(l, (r) => r.total).toFixed(1), need: +mean(l, (r) => r.need).toFixed(1),
    'made/need': +mean(l, (r) => r.total / Math.max(1, r.need)).toFixed(2), 'from animals %': +(100 * mean(l, (r) => (r.total - r.grain) / Math.max(1, r.total))).toFixed(0),
    'hungry %': +(100 * l.filter((r) => r.hungryDays > 0).length / l.length).toFixed(0), 'hungry days': +mean(l, (r) => r.hungryDays).toFixed(1),
    store: Math.round(mean(l, (r) => r.store)), fields: +mean(l, (r) => r.fields).toFixed(1), fallow: +mean(l, (r) => r.fallow).toFixed(1), cattle: +mean(l, (r) => r.cattle).toFixed(1),
    soil: +mean(l.filter((r) => r.soil !== null), (r) => r.soil).toFixed(2),
  }));
  return out;
}
const sizeKey = (r) => Math.min(9, Math.round(r.size)), herdKey = (r) => (r.cattle === 0 ? '0' : r.cattle <= 2 ? '1-2' : r.cattle <= 4 ? '3-4' : '5+');
const weatherKey = (r) => (r.weather < 0.88 ? 'poor' : r.weather > 1.05 ? 'good' : 'ordinary');
const result = {
  scenario, seeds, map, years, from, householdYears: rows.length,
  bySize: group(sizeKey, 'size'), byCattle: group(herdKey, 'cattle'), byWeather: group(weatherKey, 'weather'),
  // the review's reference farm: about 6 adult-equivalents of need (5.5 to 6.5) on 3 fields, with cattle
  reference: group((r) => (r.size >= 5.5 && r.size <= 6.5 && r.fields === 3 && r.cattle > 0 ? weatherKey(r) : null), 'weather (size 6, 3 fields, cattle)'),
};
if (json) console.log(JSON.stringify({ ...result, rows }, null, 1));
else {
  console.log(`${scenario}, seeds ${seeds.join(',')}, ${map} map, years ${from}-${years}: ${rows.length} household-years (rations a year)`);
  for (const [name, t] of [['by household size (adult-equivalents of need)', result.bySize], ['by cattle wintered', result.byCattle],
    ['by the year\'s weather', result.byWeather], ['a household of about 6 on 3 fields with cattle, by weather', result.reference]]) {
    console.log('\n' + name); console.table(t);
  }
  // the heads' memory (sim/yields) against the ledger measured from outside: grain from fields net of seed, and milk, butter and meat
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0), n = Math.max(1, rows.length);
  console.log(`\nthe head's memory against the ledger, mean rations a household-year: fields ${(sum((r) => r.mem.fields) / n).toFixed(1)} against ${(sum((r) => r.grain) / n).toFixed(1)}; animals ${(sum((r) => r.mem.animals) / n).toFixed(1)} against ${(sum((r) => r.milk + r.butter + r.meat) / n).toFixed(1)}; largest gap ${Math.max(0, ...rows.map((r) => Math.max(Math.abs(r.mem.fields - r.grain), Math.abs(r.mem.animals - r.milk - r.butter - r.meat)))).toFixed(1)}`);
}
