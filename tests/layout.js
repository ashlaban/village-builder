// Village layout (VB-109, VB-113): a farm's fields are one block within 4 walking steps of its house, next to no green; the
// houses of a village hang together with its green, through houses, yards and its fields; fields made in play keep the rules.
// Every rule on the small islands of tests/lib/probe.js (VB-856): populous at seeds 7 and 11 (at 42 the small island's crowded village
// stands apart from its green), heirs half a year, founders a year. --extended, at night: the default island, heirs three years and
// founders ten, the long run in which a lone farm's village gains its green in play (day 90 at seed 7, beside two fields: VB-887).
const VB = require('../src/load.js'), Sim = VB.sim, { bfs } = VB['sim/hex'], { walkable } = VB['sim/walking'];
const { findRoute } = VB['sim/routes'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('LAYOUT FAIL:', m); } };
const EXT = process.argv.includes('--extended'), { island, generate, scenario, ROOMY } = require('./lib/probe.js');
const nbs = (w, t) => Array.from(w.nb.slice(t * 6, t * 6 + 6)).filter((j) => j >= 0);
const connected = (w, tiles) => {
  const set = new Set(tiles), seen = new Set([tiles[0]]), q = [tiles[0]];
  for (let h = 0; h < q.length; h++) for (const j of nbs(w, q[h])) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
  return seen.size === set.size;
};
const built = (st) => new Set([...st.villages.map((v) => v.center), ...st.farmsteads.map((f) => f.house)]);
// every field of every farm: next to no green (a field may touch a house; Kim, 12 Nov); and, unless `loose`, one block within 4 walking steps of the house
function fieldRules(st, tag, loose = false) {
  const w = st.w, b = new Set(st.villages.filter((v) => v.green).map((v) => v.center));
  let blocks = 0;
  for (const f of st.farmsteads) {
    const tiles = f.fields.map((fd) => fd.tile);
    for (const t of tiles) check(!nbs(w, t).some((j) => b.has(j)), `${tag}: a field of ${f.name} (${t}) touches a green`);
    if (!tiles.length) continue;
    const one = connected(w, tiles); if (one) blocks++;
    if (loose) continue;
    check(one, `${tag}: the fields of ${f.name} are not one block`);
    const { dist } = bfs(w, f.house, 4, walkable(w));
    check(tiles.every((t) => dist.has(t)), `${tag}: a field of ${f.name} lies over 4 walking steps from the house`);
  }
  return blocks;
}
for (const seed of EXT ? [7, 42] : [7, 11]) {
  const st = EXT ? Sim.seed(generate(seed, {}), seed, 'populous') : scenario('populous', seed), w = st.w, tag = `populous seed ${seed}`;
  fieldRules(st, tag);
  for (const v of st.villages) {
    if (v.farmsteads.length < 2) continue;
    // the houses and the green, with the yards between them and the village's fields, are one group (a later house may stand
    // past the fields of the first farms; Kim, 12 Nov)
    const houses = v.farmsteads.map((id) => st.farmsteads[id].house), group = new Set([v.center, ...houses]);
    const fields = v.farmsteads.flatMap((id) => st.farmsteads[id].fields.map((fd) => fd.tile));
    for (const t of [...group]) for (const j of nbs(w, t)) if (!w.water[j]) group.add(j);
    for (const t of fields) group.add(t);
    const seen = new Set([v.center]), q = [v.center];
    for (let h = 0; h < q.length; h++) for (const j of nbs(w, q[h])) if (group.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
    check(houses.every((h) => seen.has(h)), `${tag}: the houses of ${v.name} do not hang together with its green`);
    // every farm reaches its green, fields and its village's wood (its nearest and farthest tile) on foot (VB-112)
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      for (const t of [v.center, v.wood[0] ?? -1, v.wood[v.wood.length - 1] ?? -1, ...f.fields.map((fd) => fd.tile)]) if (t >= 0) check(findRoute(w, f.house,
        t), `${tag}: ${f.name} cannot reach ${t}`);
    }
  }
}
// heirs keep the rules; founders make their fields in play, as one block where they can, never next to a green; plots too
const heirs = EXT ? Sim.seed(generate(7, {}), 7, 'heirs') : scenario('heirs', 7);
fieldRules(heirs, 'heirs seed 7');
Sim.advance(heirs, EXT ? 3 * Sim.YEAR : Sim.YEAR / 2);
fieldRules(heirs, `heirs seed 7 after ${EXT ? '3 years' : 'half a year'}`, true);
const X = VB['sim/expansion'];
for (const v of heirs.villages) for (const p of [...v.plots, ...X.livePlots(heirs, v)]) for (const tr of X.tilesOf(p)) if (tr.kind === 'field') {
  check(!nbs(heirs.w, tr.tile).some((j) => heirs.villages.some((v) => v.green && v.center === j)), `heirs: plot field ${tr.tile} touches a green`);
}
const founders = EXT ? Sim.seed(generate(7, {}), 7, 'founders') : scenario('founders', 7);
const YEARS = EXT ? 10 : 1;
Sim.advance(founders, YEARS * Sim.YEAR);
const withFields = founders.farmsteads.filter((f) => f.fields.length).length, blocks = fieldRules(founders, `founders seed 7 after ${YEARS} years`, true);
if (failed) process.exit(1);
console.log(`layout ok: founders seed 7 after ${YEARS} year${YEARS > 1 ? 's' : ''}, ${blocks} of ${withFields} farms have their fields in one block`);
