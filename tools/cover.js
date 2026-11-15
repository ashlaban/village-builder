// The land cover report: each biome's share of the land a generated island has, and of the land a pawn can walk on, by seed.
// node tools/cover.js [--map tiny|small|medium|large] [--seeds 7,42] [--json]
//   defaults: medium, seeds 7,11,42; generates each island (no simulation is seeded or run) and prints one row a biome: its share of the
//   land, in percent, for each seed and at the median seed, then the forest's share (broadleaf and pine together) and the open
//   lowland's (meadow, heath and sandy shore). The thresholds that set these shares are COVER in src/gen.js.
require('./help.js')(__filename);
const VB = require('../src/load.js'), G = VB.gen;
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const map = opt('map', 'medium'), seeds = String(opt('seeds', '7,11,42')).split(',').map(Number), json = process.argv.includes('--json');
const land = G.BIOMES.map((b, k) => k).filter((k) => !G.BIOMES[k].water), rows = {};
for (const seed of seeds) {
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
  let r; while (!(r = it.next()).done);
  const w = r.value, n = new Array(G.BIOMES.length).fill(0);
  let all = 0;
  for (let i = 0; i < w.N; i++) if (!G.BIOMES[w.biome[i]].water) { n[w.biome[i]]++; all++; }
  for (const k of land) (rows[G.BIOMES[k].key] ||= []).push(+(100 * n[k] / all).toFixed(1));
  (rows['forest and pine'] ||= []).push(+(100 * (n[G.B.FOREST] + n[G.B.PINE]) / all).toFixed(1));
  (rows['open lowland'] ||= []).push(+(100 * (n[G.B.MEADOW] + n[G.B.HEATH] + n[G.B.BEACH]) / all).toFixed(1));
  (rows['land tiles'] ||= []).push(all);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
if (json) console.log(JSON.stringify({ map, seeds, cover: G.COVER, shares: rows }));
else {
  console.log(`${map} map, share of the land in percent (COVER: heath ${G.COVER.heath}, meadow ${G.COVER.meadow}, forest ${G.COVER.forest})`);
  console.table(Object.fromEntries(Object.entries(rows).map(([k, a]) => [k, Object.fromEntries([...seeds.map((s, j) => ['seed ' + s, a[j]]), ['median', median(a)]])])));
}
