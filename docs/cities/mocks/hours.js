// Throwaway measure for the town's mock (VB-189; not game code, no test reads it): the villages of real generated maps, their people and
// households, whether the sea is near, and the table of walking hours between their greens (st.villageHours, VB-286). Writes hours.json
// beside it, which emerge.js reads, so that the mock itself needs neither the game nor a run.
//   node docs/cities/mocks/hours.js            remakes hours.json (minutes: two of its runs go on 30 years)
// Each entry: { key, scenario, seed, map, year, villages: [{ id, households, people, adults, sea }], hours: [[h or null]] }.
// sea: a sea tile within 6 walking steps of the green (a harbour could stand there). Hours are on foot, unladen, as the table holds them.
const VB = require('../../../src/load.js'), G = VB.gen, Sim = VB.sim, fs = require('fs'), path = require('path');
const { bfs } = VB['sim/hex'], { walkable } = VB['sim/routes'];
const SIZES = { small: [180, 130], medium: [280, 200] };
const RUNS = [
  ['populous', 3, 'small', 0], ['populous', 7, 'small', 0], ['populous', 11, 'small', 0], ['populous', 42, 'small', 0],
  ['populous', 7, 'small', 30], ['populous', 42, 'small', 30],
  ['populous', 3, 'medium', 0], ['populous', 7, 'medium', 0], ['populous', 11, 'medium', 0], ['populous', 42, 'medium', 0],
];
const only = process.argv[2]; // a key's prefix, to try one run
const out = [];
for (const [scenario, seed, map, years] of RUNS) {
  if (only && !`${scenario}-${map}-${seed}-y${years}`.startsWith(only)) continue;
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, seed, scenario), w = st.w;
  for (let y = 0; y < years; y++) Sim.advance(st, Sim.YEAR);
  const year = Math.floor(st.t / Sim.YEAR);
  const hhOf = (v) => v.farmsteads.map((f) => st.farmsteads[f].household).filter((h) => h != null && !st.households[h].dissolved);
  const live = st.villages.filter((v) => v && hhOf(v).length);
  const rows = live.map((v) => {
    const hhs = hhOf(v);
    const ps = hhs.flatMap((h) => st.households[h].members.map((p) => st.pawns[p])).filter((p) => p && p.alive);
    const { dist } = bfs(w, v.center, 6, walkable(w));
    let sea = false;
    for (const [t] of dist) for (let k = 0; k < 6; k++) { const n = w.nb[t * 6 + k]; if (n >= 0 && w.water[n] && w.ocean[n]) sea = true; }
    const ages = ps.map((p) => Sim.age(st, p));
    return { id: v.id, households: hhs.length, people: ps.length, adults: ages.filter((a) => a >= 14 && a < 60).length, sea };
  });
  const hours = live.map((a) => live.map((b) => { const h = st.villageHours[a.id][b.id]; return h == null ? null : Math.round(h * 100) / 100; }));
  out.push({ key: `${scenario}-${map}-${seed}-y${year}`, scenario, seed, map, year, villages: rows, hours });
  console.log(out[out.length - 1].key, rows.length, 'villages', rows.reduce((s, v) => s + v.people, 0), 'people', rows.reduce((s, v) => s + v.households, 0), 'households', rows.filter((v) => v.sea).length, 'by the sea');
}
if (!only) fs.writeFileSync(path.join(__dirname, 'hours.json'), JSON.stringify(out) + '\n');
