// Geology report: what lies in the ground of generated maps (gen/geology), island by island, to tune its chances.
// node tools/geology.js [--seeds 7,42] [--map small] [--least 60] [--islands]
//   --seeds    the map seeds, or A..B for a range (default 1..20)
//   --map      tiny, small, medium or large (default small)
//   --least    the fewest land tiles of an island that is counted (default 60)
//   --islands  also a line for each counted island: its size, bedrock and deposits (tiles, loads; + marks an endless source)
// Prints, for each kind of stone and deposit, the share of maps and of counted islands that have it, the kinds an island has (median and
// most), the islands that have every kind, and how alike two islands of one map are (the mean share of kinds they have in common).
require('./help.js')(__filename);
const VB = require('../src/load.js'), G = VB.gen, Geo = VB['gen/geology'], { landComponents } = VB['sim/hex'];
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const map = opt('map', 'small'), least = +opt('least', 60), each = args.includes('--islands');
const range = opt('seeds', '1..20'), m = range.match(/^(\d+)\.\.(\d+)$/);
const seeds = m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, k) => +m[1] + k) : range.split(',').map(Number);
if (!SIZES[map]) { console.error(`geology: no map "${map}"`); process.exit(1); }

const kinds = [...Geo.ROCKS.slice(1).map((r) => r.name), ...Geo.DEPOSITS.slice(1).map((d) => d.name)], NR = Geo.ROCKS.length - 1;
const onMaps = kinds.map(() => 0), onIsles = kinds.map(() => 0), counts = [];
let isles = 0, all = 0, pairs = 0, alike = 0;
for (const seed of seeds) {
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const w = r.value, comp = landComponents(w), per = new Map();
  for (let i = 0; i < w.N; i++) {
    if (w.water[i] || comp.size[comp.id[i]] < least) continue;
    let s = per.get(comp.id[i]);
    if (!s) per.set(comp.id[i], s = { land: comp.size[comp.id[i]], tiles: kinds.map(() => 0), loads: kinds.map(() => 0), endless: kinds.map(() => 0) });
    s.tiles[w.rock[i] - 1]++;
    if (w.deposit[i]) {
      const k = NR + w.deposit[i] - 1;
      s.tiles[k]++;
      if (w.depositLeft[i] === Geo.ENDLESS) s.endless[k]++; else s.loads[k] += w.depositLeft[i];
    }
  }
  const list = [...per.values()].sort((a, b) => b.land - a.land), mapHas = kinds.map(() => false);
  if (each) console.log(`seed ${seed}, ${w.name}:`);
  for (const s of list) {
    const has = s.tiles.map((n) => n > 0), n = has.filter(Boolean).length;
    isles++; counts.push(n); if (n === kinds.length) all++;
    has.forEach((h, k) => { if (h) { onIsles[k]++; mapHas[k] = true; } });
    s.has = has;
    if (each) {
      console.log(`  ${String(s.land).padStart(5)} tiles: ` + kinds.map((name, k) => (!has[k] ? null : k < NR ? `${name} ${s.tiles[k]}`
        : `${name} ${s.tiles[k]} (${s.loads[k]}${s.endless[k] ? '+' : ''})`)).filter(Boolean).join(', '));
    }
  }
  mapHas.forEach((h, k) => { if (h) onMaps[k]++; });
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    let both = 0, either = 0;
    for (let k = 0; k < kinds.length; k++) { if (list[a].has[k] && list[b].has[k]) both++; if (list[a].has[k] || list[b].has[k]) either++; }
    pairs++; alike += both / either;
  }
}
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-').padStart(5);
counts.sort((a, b) => a - b);
console.log(`${map} map, ${seeds.length} seeds, ${isles} islands of ${least} land tiles or more (${(isles / seeds.length).toFixed(1)} a map)`);
console.log(`${'kind'.padEnd(22)}${'maps'.padStart(5)}${'islands'.padStart(9)}`);
kinds.forEach((name, k) => console.log(`${name.padEnd(22)}${pct(onMaps[k], seeds.length)}${pct(onIsles[k], isles).padStart(9)}`));
console.log(`kinds on an island: median ${counts[counts.length >> 1]}, most ${counts[counts.length - 1]} of ${kinds.length}; islands with every kind: ${all}`);
console.log(`two islands of one map share ${pairs ? Math.round((100 * alike) / pairs) : '-'}% of their kinds (${pairs} pairs)`);
