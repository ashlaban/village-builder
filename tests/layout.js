// Village layout (VB-109, VB-113): a farm's fields are one block within 4 walking steps of its house, next to no house or green; the
// houses of a village hang together with its green, through houses and yards; fields made in play keep the rules.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { bfs } = VB['sim/hex'], { walkable } = VB['sim/routes'];
const { findRoute } = VB['sim/routes'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('LAYOUT FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const nbs = (w, t) => Array.from(w.nb.slice(t * 6, t * 6 + 6)).filter((j) => j >= 0);
const connected = (w, tiles) => {
  const set = new Set(tiles), seen = new Set([tiles[0]]), q = [tiles[0]];
  for (let h = 0; h < q.length; h++) for (const j of nbs(w, q[h])) if (set.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
  return seen.size === set.size;
};
const built = (st) => new Set([...st.villages.map((v) => v.center), ...st.farmsteads.map((f) => f.house)]);
// every field of every farm: next to no house or green; and, unless `loose`, one block within 4 walking steps of the house
function fieldRules(st, tag, loose = false) {
  const w = st.w, b = built(st);
  let blocks = 0;
  for (const f of st.farmsteads) {
    const tiles = f.fields.map((fd) => fd.tile);
    for (const t of tiles) check(!nbs(w, t).some((j) => b.has(j)), `${tag}: a field of ${f.name} (${t}) touches a house or green`);
    if (!tiles.length) continue;
    const one = connected(w, tiles); if (one) blocks++;
    if (loose) continue;
    check(one, `${tag}: the fields of ${f.name} are not one block`);
    const { dist } = bfs(w, f.house, 4, walkable(w));
    check(tiles.every((t) => dist.has(t)), `${tag}: a field of ${f.name} lies over 4 walking steps from the house`);
  }
  return blocks;
}
for (const seed of [7, 42]) {
  const st = Sim.seed(world(seed), seed, 'populous'), w = st.w, tag = `populous seed ${seed}`;
  fieldRules(st, tag);
  for (const v of st.villages) {
    if (v.farmsteads.length < 2) continue;
    // the houses and the green, with the yards between them, are one group
    const houses = v.farmsteads.map((id) => st.farmsteads[id].house), group = new Set([v.center, ...houses]);
    for (const t of [...group]) for (const j of nbs(w, t)) if (!w.water[j]) group.add(j);
    const seen = new Set([v.center]), q = [v.center];
    for (let h = 0; h < q.length; h++) for (const j of nbs(w, q[h])) if (group.has(j) && !seen.has(j)) { seen.add(j); q.push(j); }
    check(houses.every((h) => seen.has(h)), `${tag}: the houses of ${v.name} do not hang together with its green`);
    // every farm reaches its green, fields and woodlot on foot (VB-112)
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      for (const t of [v.center, f.woodlot, ...f.fields.map((fd) => fd.tile)]) if (t >= 0) check(findRoute(w, f.house, t), `${tag}: ${f.name} cannot reach ${t}`);
    }
  }
}
// heirs keep the rules; founders make their fields in play, as one block where they can, never next to a house; plots too
const heirs = Sim.seed(world(7), 7, 'heirs');
fieldRules(heirs, 'heirs seed 7');
Sim.advance(heirs, 3 * Sim.YEAR);
fieldRules(heirs, 'heirs seed 7 after 3 years', true);
for (const v of heirs.villages) for (const p of v.plots) for (const tr of p.tiles) if (tr.kind === 'field') {
  check(!nbs(heirs.w, tr.tile).some((j) => built(heirs).has(j)), `heirs: plot field ${tr.tile} touches a house or green`);
}
const founders = Sim.seed(world(7), 7, 'founders');
Sim.advance(founders, 10 * Sim.YEAR);
const withFields = founders.farmsteads.filter((f) => f.fields.length).length, blocks = fieldRules(founders, 'founders seed 7 after 10 years', true);
if (failed) process.exit(1);
console.log(`layout ok: founders seed 7 after 10 years, ${blocks} of ${withFields} farms have their fields in one block`);
