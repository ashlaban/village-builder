// Throwaway measure for the plan VB-702 (not game code): how many villages of a populous start have each rock and deposit within walking
// reach of their green. node docs/plans/VB-702-reach.js [--map small] [--seeds 3,7,11,42,15] [--reach 12,30]
// A village "has" a kind when a tile of it lies within R walking steps (bfs over passable tiles, as sim/dig and sim/building search) of
// its green (village.center); "isle" counts every tile joined to the green by land, whatever the distance. Rocks are counted two ways:
// any tile of the rock in reach (rock:), and a quarry tile of it (quarry: hills or mountain, VB-332's quarry). Hidden ores count whether
// found or not. greenRock: the bedrock under the green, which today's quern reads.
const VB = require('../../src/load.js'), G = VB.gen, Sim = VB.sim, Geo = VB['gen/geology'];
const { bfs } = VB['sim/hex'], { walkable } = VB['sim/routes'];
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SIZES = { small: [180, 130], medium: [280, 200] };
const map = opt('map', 'small'), seeds = opt('seeds', '3,7,11,42,15').split(',').map(Number);
const reaches = opt('reach', '12,30').split(',').map(Number);
const B = G.B;
const rocks = Geo.ROCKS.slice(1).map((r) => r.key), deps = Geo.DEPOSITS.slice(1).map((d) => d.key);
const cols = [...reaches.map(String), 'isle'];
const tally = {};
const add = (k, c) => { (tally[k] ||= {}); tally[k][c] = (tally[k][c] || 0) + 1; };
let villages = 0; const perSeed = [], mapHas = {};
for (const seed of seeds) {
  const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  const w = r.value, st = Sim.seed(w, seed, 'populous');
  const live = st.villages.filter((v) => v && v.farmsteads && v.farmsteads.length);
  perSeed.push(`${seed}: ${live.length}`);
  for (const v of live) {
    villages++;
    add('greenRock:' + Geo.ROCKS[w.rock[v.center]].key, 'green');
    const far = [...reaches, 1e4];
    const { dist } = bfs(w, v.center, 1e4, walkable(w));
    far.forEach((R, k) => {
      const c = cols[k], seen = new Set();
      for (const [t, d] of dist) {
        if (d > R) continue;
        if (w.deposit[t]) seen.add('dep:' + deps[w.deposit[t] - 1]);
        if (w.rock[t]) {
          seen.add('rock:' + rocks[w.rock[t] - 1]);
          if (w.biome[t] === B.HILLS || w.biome[t] === B.MOUNTAIN) seen.add('quarry:' + rocks[w.rock[t] - 1]);
        }
      }
      if (seen.has('dep:copper') && seen.has('dep:tin')) seen.add('both:copper+tin');
      if (seen.has('dep:iron') || seen.has('dep:bogIron')) seen.add('any:iron');
      for (const s of seen) add(s, c);
      if (R === 30) for (const s of seen) if (s.startsWith('dep:')) (mapHas[s] ||= new Set()).add(seed);
    });
  }
}
// maps (seeds) on which some village has the kind within 30 steps: copper and tin on one map means a bronze pair can exist by land or sea
const mapLine = Object.keys(mapHas).sort().map((k) => `${k.slice(4)} ${mapHas[k].size}`).join(', ');
const pair = seeds.filter((s) => mapHas['dep:copper']?.has(s) && mapHas['dep:tin']?.has(s)).length;
console.log(`maps of ${seeds.length} with a village within 30 steps of: ${mapLine}; of both copper and tin: ${pair}`);
console.log(`populous ${map}, seeds ${seeds.join(',')}: ${villages} villages (${perSeed.join('; ')}); reach in walking steps, isle = joined by land`);
console.log('kind'.padEnd(24) + ['green', ...cols].map((c) => c.padStart(7)).join(''));
for (const k of Object.keys(tally).sort()) console.log(k.padEnd(24) + ['green', ...cols].map((c) => String(tally[k][c] || 0).padStart(7)).join(''));
