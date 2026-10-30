// Rivers (VB-111): courses, catchment and sources; nothing built on a river; watered fields; village sites near rivers; decorations clear.
// Fords (VB-112): deterministic, each joins two banks, one on every course of 5 land tiles or more; routes cross rivers only at fords.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Rv = VB['gen/rivers'];
const { RIVER, FERTILITY, fertility, byRiver } = VB['sim/rules'], { findRoute, passable } = VB['sim/routes'], { siteScore } = VB['sim/layout'], { bfs, land, landComponents } = VB['sim/hex'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('RIVERS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const SOURCES = [G.B.HILLS, G.B.MOUNTAIN, G.B.MARSH];
let lakeCourses = 0, watered = 0, fords = 0, crossed = 0;
for (const seed of [7, 42]) {
  const w = world(seed), again = world(seed);
  check(Buffer.compare(Buffer.from(w.river.buffer), Buffer.from(again.river.buffer)) === 0, `seed ${seed}: river differs between generations`);
  check(Buffer.compare(Buffer.from(w.riverTo.buffer), Buffer.from(again.riverTo.buffer)) === 0, `seed ${seed}: riverTo differs between generations`);
  const up = new Int32Array(w.N);
  for (let i = 0; i < w.N; i++) if (w.riverTo[i] >= 0) up[w.riverTo[i]]++;
  const comp = landComponents(w), sources = [];
  for (let i = 0; i < w.N; i++) {
    const to = w.riverTo[i];
    if (w.river[i]) check(!w.water[i] && to >= 0, `seed ${seed}: river tile ${i} is water or has no course`);
    if (to < 0) continue;
    check(w.nb.slice(i * 6, i * 6 + 6).includes(to), `seed ${seed}: tile ${i} drains to ${to}, not a neighbour`);
    if (w.water[i]) { check(w.biome[i] === G.B.LAKE, `seed ${seed}: course through sea tile ${i}`); lakeCourses++; continue; }
    // every course runs on, without a loop, to the sea
    let j = i, n = 0;
    while (j >= 0 && !w.ocean[j] && n++ < w.N) j = w.riverTo[j];
    check(j >= 0 && w.ocean[j], `seed ${seed}: the course from tile ${i} does not reach the sea`);
    if (!w.water[to]) check(w.river[to] >= w.river[i], `seed ${seed}: catchment falls from ${w.river[i]} to ${w.river[to]} at tile ${to}`);
    if (!up[i]) { sources.push(i); check(SOURCES.includes(w.biome[i]), `seed ${seed}: river rises at tile ${i} in biome ${w.biome[i]}`); }
  }
  check(sources.length >= 10, `seed ${seed}: only ${sources.length} river sources`);
  const perIsland = new Map();
  for (const s of sources) perIsland.set(comp.id[s], (perIsland.get(comp.id[s]) || 0) + 1);
  for (const [c, n] of perIsland) check(n <= Math.round(comp.size[c] / Rv.RIVERS.perTiles), `seed ${seed}: island of ${comp.size[c]} tiles has ${n} sources`);
  for (const s of sources) {
    const { dist } = bfs(w, s, Rv.RIVERS.spacing - 1, () => true);
    check(!sources.some((o) => o !== s && dist.has(o)), `seed ${seed}: source ${s} has another within ${Rv.RIVERS.spacing - 1} steps`);
  }
  // fords: the same every time; each joins two banks; every reach of 5 land tiles or more (from a source or a confluence down to the
  // next confluence, a lake or the sea) has one
  check(Buffer.compare(Buffer.from(w.crossing.buffer), Buffer.from(again.crossing.buffer)) === 0, `seed ${seed}: fords differ between generations`);
  const walked = new Uint8Array(w.N);
  for (let i = 0; i < w.N; i++) if (w.crossing[i]) {
    fords++;
    check(w.river[i] && !w.water[i] && w.crossing[i] === 1, `seed ${seed}: crossing ${w.crossing[i]} at tile ${i}, river ${w.river[i]}`);
    const dry = [0, 1, 2, 3, 4, 5].map((k) => { const j = w.nb[i * 6 + k]; return j >= 0 && !w.water[j] && !w.river[j]; });
    check(dry.filter((d, k) => d && !dry[(k + 5) % 6]).length >= 2, `seed ${seed}: ford ${i} does not join two banks`);
  }
  for (let s = 0; s < w.N; s++) {
    if (!w.river[s] || w.water[s] || (up[s] === 1 && !w.water[w.nb.slice(s * 6, s * 6 + 6).find((j) => j >= 0 && w.riverTo[j] === s)])) continue;
    const reach = [];
    for (let i = s; i >= 0 && w.river[i] && !w.water[i] && (i === s || up[i] < 2) && !walked[i]; i = w.riverTo[i]) { walked[i] = 1; reach.push(i); }
    check(reach.length < 5 || reach.some((i) => w.crossing[i]), `seed ${seed}: a reach of ${reach.length} tiles from ${s} has no ford`);
  }
  // routes between the banks of a ford step on no river tile but a ford
  for (let i = 0, n = 0; i < w.N && n < 40; i++) {
    if (!w.crossing[i]) continue;
    const banks = w.nb.slice(i * 6, i * 6 + 6).filter((j) => j >= 0 && passable(w, j) && !w.river[j]);
    const a = banks[0], b = banks.find((j) => !w.nb.slice(a * 6, a * 6 + 6).includes(j) && j !== a);
    if (b === undefined) continue;
    const p = findRoute(w, a, b);
    check(p && p.every((t) => !w.river[t] || w.crossing[t]), `seed ${seed}: the route between the banks of ford ${i} wades the river elsewhere`);
    if (p && p.some((t) => w.crossing[t])) crossed++;
    n++;
  }
  // a site 1 to 3 steps over land from a river scores RIVER.site[steps] higher than it would without that term
  let site = -1, steps = 0;
  for (let i = 0; i < w.N && site < 0; i++) {
    if (w.biome[i] !== G.B.MEADOW || w.river[i] || siteScore(w, i) < 0) continue;
    for (const [j, d] of bfs(w, i, 3, land(w)).dist) if (w.river[j] && (site < 0 || d < steps)) { site = i; steps = d; }
  }
  const keep = RIVER.site.slice(), withRiver = siteScore(w, site);
  RIVER.site.fill(0); const without = siteScore(w, site); keep.forEach((x, k) => { RIVER.site[k] = x; });
  check(site >= 0 && RIVER.site[steps] > 0 && Math.abs(withRiver - without - RIVER.site[steps]) < 1e-9,
    `seed ${seed}: site ${site}, ${steps} steps from a river, gains ${withRiver - without}`);
  // decorations: an item in the middle of a river line goes, one well away from any river stays
  const t = sources[0], b = Rv.lines(w, t)[0][5], far = w.river.findIndex((x, i) => !x && !w.water[i] && !byRiver(w, i));
  const items = [{ t: 'stone', x: b[0], y: b[1] }, { t: 'stone', x: w.hx[far], y: w.hy[far] }];
  check(Rv.thin(w, items, G.hexLocator(w)).length === 1 && items[0].x === w.hx[far], `seed ${seed}: thin keeps ${items.length} items`);
  // nothing built on a river; fields carry their watered fertility, also after a year of making new fields
  for (const scenario of ['founders', 'heirs']) {
    const st = Sim.seed(world(seed), seed, scenario);
    Sim.advance(st, Sim.YEAR);
    for (const v of st.villages) check(!st.w.river[v.center], `seed ${seed} ${scenario}: village ${v.name} has its green on a river`);
    for (const f of st.farmsteads) {
      check(!st.w.river[f.house], `seed ${seed} ${scenario}: ${f.name} stands on a river`);
      for (const fd of f.fields) {
        check(!st.w.river[fd.tile], `seed ${seed} ${scenario}: a field of ${f.name} lies on a river`);
        const base = FERTILITY[st.w.biome[fd.tile]], wet = byRiver(st.w, fd.tile);
        check(Math.abs(fd.fert - fertility(st.w, fd.tile)) < 1e-9 && Math.abs(fd.fert - base * (wet ? 1 + RIVER.irrigation : 1)) < 1e-9,
          `seed ${seed} ${scenario}: a field of ${f.name} has fertility ${fd.fert}, by the river ${wet}`);
        if (wet) { watered++; check(fd.fert > base, `seed ${seed} ${scenario}: a watered field of ${f.name} is no more fertile (${fd.fert})`); }
      }
    }
  }
}
check(lakeCourses > 0, 'no river runs through a lake at seeds 7 and 42');
check(watered > 0, 'no field is watered by a river at seeds 7 and 42');
check(crossed > 20, `only ${crossed} routes between the banks of a ford take a ford`);
if (failed) process.exit(1);
console.log(`rivers ok: ${lakeCourses} lake tiles on courses, ${watered} watered fields, ${fords} fords, ${crossed} crossings`);
