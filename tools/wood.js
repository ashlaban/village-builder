// Wood supply report (VB-024): trees felled per year per village, and forest tiles cleared (felled to meadow) per 10 years.
// node tools/wood.js [--scenario founders|populous] [--seed 7] [--map medium] [--years 10]
// Counts by wrapping fellTree and clearTile at load time (as tools/perf.js does), so src/ is untouched and the run is the same as a plain one.
require('./help.js')(__filename);
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const scenario = opt('scenario', 'founders'), seed = +opt('seed', 7), map = opt('map', 'medium'), years = +opt('years', 10);
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const felled = [], cleared = []; let year = 0;
const root = path.join(__dirname, '..', 'src');
for (const f of JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))) {
  require(path.join(root, f));
  if (f === 'sim/forest.js') {
    const F = globalThis.VB['sim/forest'], fell = F.fellTree, clear = F.clearTile;
    F.fellTree = (st, tile) => {
      const v = globalThis.VB['sim/territory'].woodOf(st, tile), had = tile >= 0 && st.w.trees[tile] > 0; fell(st, tile);
      if (had && v) { const r = (felled[year] ||= {}); r[v.id] = (r[v.id] || 0) + 1; }
    };
    F.clearTile = (st, tile) => { clear(st, tile); cleared[year] = (cleared[year] || 0) + 1; };
  }
}
const VB = globalThis.VB, it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] });
let r; while (!(r = it.next()).done);
const st = VB.sim.seed(r.value, seed, scenario), Sim = VB.sim;
console.log(`${scenario} seed ${seed} ${map} map: trees felled per village per year, and forest tiles cleared`);
const perVillage = [];
for (year = 0; year < years; year++) {
  Sim.advance(st, Sim.YEAR);
  const vs = Object.values(felled[year] || {}), total = vs.reduce((a, b) => a + b, 0), n = st.villages.length;
  perVillage.push(total / n);
  console.log(`year ${String(year + 1).padStart(2)}: ${total} trees felled in ${vs.length} of ${n} villages (mean ${(total / n).toFixed(1)} a village), ${cleared[year] || 0} tiles cleared`);
}
const tiles = cleared.reduce((a, b) => a + b, 0);
console.log(`${years} years: ${tiles} forest tiles cleared (${(tiles * 10 / years).toFixed(1)} per 10 years, ${(tiles * 10 / years / st.villages.length).toFixed(2)} per village per 10 years); mean ${(perVillage.reduce((a, b) => a + b, 0) / years).toFixed(1)} trees per village a year`);
