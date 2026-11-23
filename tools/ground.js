// The ground report (VB-735), for `node tools/sim.js --report ground [--reach 12,30] [--seeds 3,7,11] [--json]`: by village, each rock (any tile of
// it, and a quarry tile of it: a biome of BUILD.quarryOn, VB-332, VB-733) and each deposit within the reaches (walking steps from the green, over passable tiles
// on the green's island: the search sim/dig and sim/building use), the rock under the green, and for a hidden ore whether the village has
// found it (st.finds). A summary line a kind counts villages (and maps, where several seeds are given); pairs: copper and tin, any iron.
// It reads the world and the run as they stand, at any year, and writes nothing. --seeds runs each named seed of the same scenario, map and
// years (the run's own seed first). Used by tools/sim.js: `require('./ground.js')` gives { report, others, print }.
require('./help.js')(__filename);
const REACH = [12, 30];
// the report of one run: { seed, villages: [{ village, name, green, in: { kind: [bool by reach] } }] }
function ofRun(VB, st, seed, reaches) {
  const w = st.w, Geo = VB['world/geology'], B = VB['world/biomes'].B, { bfs } = VB['sim/hex'], { walkable } = VB['sim/walking'];
  const rocks = Geo.ROCKS.slice(1).map((r) => r.key), deps = Geo.DEPOSITS.slice(1), far = Math.max(...reaches);
  const villages = [];
  for (const v of st.villages) {
    if (!v || !v.farmsteads || !v.farmsteads.length) continue;
    const { dist } = bfs(w, v.center, far, walkable(w)), found = st.finds.get(v.id) || [], into = {};
    const mark = (k, d) => { const a = (into[k] ||= reaches.map(() => false)); reaches.forEach((R, i) => { if (d <= R) a[i] = true; }); };
    for (const [t, d] of dist) {
      if (w.deposit[t]) {
        const dep = deps[w.deposit[t] - 1];
        mark(dep.key, d);
        if (dep.hidden && found.includes(w.vein[t])) mark('found:' + dep.key, d);
      }
      if (w.rock[t]) {
        const key = rocks[w.rock[t] - 1];
        mark('rock:' + key, d);
        const on = VB['sim/rules'].BUILD.quarryOn[w.biome[t]]; // where sim/building quarries, and which rocks (VB-733)
        if (on === null || (on !== undefined && on.includes(key))) mark('quarry:' + key, d);
      }
    }
    const has = (k, i) => !!(into[k] && into[k][i]);
    into['pair:copper+tin'] = reaches.map((_, i) => has('copper', i) && has('tin', i));
    into['pair:any iron'] = reaches.map((_, i) => has('iron', i) || has('bogIron', i));
    villages.push({ village: v.id, name: v.name, green: rocks[w.rock[v.center] - 1] || 'none', in: into });
  }
  return { seed, villages };
}
// the runs of the other seeds, seeded and advanced as the main one (years)
function others(VB, seeds, { scenario, size, years }) {
  const Sim = VB.sim, out = [];
  for (const s of seeds) {
    const it = VB.gen.generate(s, { cols: size[0], rows: size[1] });
    let r; while (!(r = it.next()).done);
    const st = Sim.seed(r.value, s, scenario);
    if (years > 0) Sim.advance(st, years * Sim.YEAR);
    out.push({ st, seed: s });
  }
  return out;
}
function report(VB, runs, reaches = REACH) {
  const per = runs.map((r) => ofRun(VB, r.st, r.seed, reaches));
  const kinds = [...new Set(per.flatMap((p) => p.villages.flatMap((v) => Object.keys(v.in))))].sort();
  const summary = kinds.map((k) => {
    const row = { kind: k };
    reaches.forEach((R, i) => {
      row['villages ' + R] = per.reduce((a, p) => a + p.villages.filter((v) => v.in[k] && v.in[k][i]).length, 0);
      if (per.length > 1) row['maps ' + R] = per.filter((p) => p.villages.some((v) => v.in[k] && v.in[k][i])).length;
    });
    return row;
  });
  const cell = (v, k) => (v.in[k] || reaches.map(() => false)).map((b) => (b ? 'y' : '-')).join('');
  const rows = per.flatMap((p) => p.villages.map((v) => ({ seed: p.seed, village: v.village, name: v.name, green: v.green,
    ...Object.fromEntries(kinds.map((k) => [k, cell(v, k)])) })));
  return { reaches, maps: per.length, villages: per.reduce((a, p) => a + p.villages.length, 0),
    green: per.flatMap((p) => p.villages).reduce((a, v) => ((a[v.green] = (a[v.green] || 0) + 1), a), {}), summary, rows };
}
function print(out) {
  console.log(`ground: ${out.villages} villages on ${out.maps} map${out.maps > 1 ? 's' : ''}; each kind by reach ${out.reaches.join(', ')} walking steps (y = in reach; found: = a hidden ore the village has found)`);
  for (const r of out.rows) {
    const { seed, village, name, green, ...kinds } = r, has = Object.entries(kinds).filter(([, c]) => c.includes('y'));
    console.log(`seed ${seed} village ${village} ${name} (green ${green}): ${has.map(([k, c]) => `${k} ${c}`).join(', ') || 'nothing'}`);
  }
  console.log('rock under the green:', JSON.stringify(out.green));
  console.log('summary, villages (and maps) with the kind in reach:'); console.table(out.summary);
}
module.exports = { report, others, print, REACH };
