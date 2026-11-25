// Study C, step 1 (docs/mocks/plans/village/README.md): load curves. An observer of the real simulation, in the manner of
// docs/mocks/blocks/mock.js and tools/hours.js: it steps a run a 6-minute step at a time, reads st, and writes nothing to it.
// For each household and game day it records the adults' available working hours and how they were spent: on the household's own
// field work of a season (FIELD: plow, sow, reap, mow, rake, hay, haul), on vital kinds (KINDS[k].vital), on village work (a job whose
// owner is the village), on days owed (st.daysToday), on other work, idle; with its adults, fields and food outlook's state. Per
// village: its routines and each work day's turnout. Beside them the work counters dayPair and oppAsk a day (P15's baseline).
// node docs/mocks/plans/village/observe.js [--scenario populous] [--seed 7] [--map small] [--years 3] [--out FILE]
// Writes FILE (default docs/mocks/plans/village/out/curves-SCENARIO-SEED.json), the standalone model's input (model.js).
const path = require('path'), fs = require('fs'), root = path.join(__dirname, '../../../..');
const VB = require(path.join(root, 'src/load.js')), G = VB.gen, Sim = VB.sim;
const { KINDS } = VB['sim/kinds'], { TICKS, DAY } = VB['sim/rules'];
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200] };
const scenario = arg('scenario', 'populous'), seed = Number(arg('seed', 7)), map = arg('map', 'small'), years = Number(arg('years', 3));
const out = arg('out', path.join(__dirname, 'out', `curves-${scenario}-${seed}.json`));
const t0 = Date.now();
const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), STEP = 1 / TICKS, [W0, W1] = Sim.WORK;

const FIELD = new Set(['plow', 'sow', 'reap', 'mow', 'rake', 'hay', 'haul']);
const SOW = new Set(['plow', 'sow']);
const CAT = ['H', 'field', 'sow', 'vital', 'village', 'owed', 'other', 'idle', 'nightWork'];
const hhDays = {}; // household id -> {adults: [], fields: [], food: [], village, rows: [[CAT...] a day]}
const villages = {}; // village id -> {routines: [by year], workdays: [{day, what, turnout, hours, adults}], hours: [a day], byKind}
const ownerTypes = {}, villageKinds = {}, owedKinds = {};
const cnt0 = { ...VB.count }, counters = [];
const householdOfVillage = new Map();

function villageOf(hh) { const f = st.farmsteads[hh.farmstead]; return f && f.village !== undefined ? f.village : null; }
function rowOf(hh, d) {
  const h = (hhDays[hh.id] ||= { adults: [], fields: [], food: [], village: null, rows: [] });
  while (h.rows.length <= d) h.rows.push(CAT.map(() => 0));
  return h.rows[d];
}
const days = years * Sim.YEAR_DAYS, round = (x) => +x.toFixed(2);
let lastDay = -1, prevCount = { ...VB.count };
for (let k = 0; k < years * Sim.YEAR * TICKS; k++) {
  Sim.advance(st, STEP);
  const tt = st.t - STEP, c = Sim.cal(tt), d = Math.floor(tt / DAY), inWork = c.hour >= W0 && c.hour < W1;
  if (d !== lastDay) { // the day's first step: the households' state and the counters of the day before
    if (lastDay >= 0) { const row = {}; for (const key of ['dayPair', 'oppAsk', 'dayTake']) row[key] = (VB.count[key] || 0) - (prevCount[key] || 0); counters.push(row); }
    prevCount = { ...VB.count }; lastDay = d;
    for (const id of st.liveHouseholds) {
      const hh = st.households[id], row = rowOf(hh, d), h = hhDays[id];
      h.adults[d] = hh.members.filter((m) => { const p = st.pawns[m], a = Sim.age(st, p); return p.alive && a >= 14 && a < 60 && !p.retired; }).length;
      h.fields[d] = st.farmsteads[hh.farmstead] ? st.farmsteads[hh.farmstead].fields.length : 0;
      const pl = st.plans.households.get(id);
      const F = pl && pl.outlook && pl.outlook.food;
      h.food[d] = F ? [F.state, F.with, round(F.parts.store), F.parts.need.map(round), round(F.parts.intakes.reduce((s, x) => s + x.n, 0)), round(F.parts.spoilt || 0)] : null;
      if (h.village === null) h.village = villageOf(hh);
      void row;
    }
    for (const v of st.villages) {
      if (!v) continue;
      if (villages[v.id] && v.workday && v.workday.day === d - 1 && !villages[v.id].workdays.some((w) => w.day === d - 1)) {
        const hrs = Object.values(v.workday.hoursOf || {}); // yesterday's work day: its turnout
        villages[v.id].workdays.push({ day: d - 1, what: v.workday.what, turnout: hrs.filter((x) => x > 0).length, hours: +hrs.reduce((s, x) => s + x, 0).toFixed(1) });
      }
      const V = (villages[v.id] ||= { routines: {}, workdays: [], hours: [], byKind: {} });
      const pl = st.plans.villages.get(v.id);
      if (pl && pl.routines) V.routines[c.year] = [...pl.routines];
    }
  }
  for (const a of st.agents) {
    const p = st.pawns[a.id];
    if (!p.alive || p.household === null) continue;
    const hh = st.households[p.household];
    if (hh.dissolved) continue;
    const age = Sim.age(st, p);
    if (!(age >= 14 && age < 60 && !p.retired)) continue;
    const row = rowOf(hh, d), j = a.job;
    if (!inWork) { if (j) row[8] += STEP; continue; }
    row[0] += STEP;
    if (!j) { row[7] += STEP; continue; }
    const ot = j.owner ? j.owner.type : 'none';
    ownerTypes[ot] = (ownerTypes[ot] || 0) + STEP;
    const owed = st.daysToday && st.daysToday.day === d && st.daysToday.by && st.daysToday.by[a.id];
    if (owed) { row[5] += STEP; owedKinds[j.kind] = (owedKinds[j.kind] || 0) + STEP; }
    else if (ot === 'village') {
      row[4] += STEP; villageKinds[j.kind] = (villageKinds[j.kind] || 0) + STEP;
      const V = villages[j.owner.id]; if (V) { V.hours[d] = (V.hours[d] || 0) + STEP; V.byKind[j.kind] = (V.byKind[j.kind] || 0) + STEP; }
    } else if (KINDS[j.kind] && KINDS[j.kind].vital) row[3] += STEP;
    else if (FIELD.has(j.kind)) { row[1] += STEP; if (SOW.has(j.kind)) row[2] += STEP; }
    else row[6] += STEP;
  }
}
for (const h of Object.values(hhDays)) h.rows = h.rows.map((r) => r.map(round));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ scenario, seed, map, years, days, CAT, households: hhDays, villages, ownerTypes, villageKinds, owedKinds,
  counters, hash: Sim.hash ? Sim.hash(st) : null }));
console.log(`observed ${scenario} seed ${seed} ${map} ${years} y in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(root, out)}`);
console.log('owner types (adult hours):', JSON.stringify(Object.fromEntries(Object.entries(ownerTypes).map(([k, v]) => [k, Math.round(v)]))));
console.log('village kinds:', JSON.stringify(Object.fromEntries(Object.entries(villageKinds).map(([k, v]) => [k, Math.round(v)]))));
console.log('owed kinds:', JSON.stringify(Object.fromEntries(Object.entries(owedKinds).map(([k, v]) => [k, Math.round(v)]))));
for (const [id, V] of Object.entries(villages)) if (V.workdays.length) console.log('village', id, 'work days', JSON.stringify(V.workdays));
void cnt0; void householdOfVillage;
