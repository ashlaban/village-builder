// @sys sim/landing [kernel]: a site read before anyone has settled (the solo start): its soil, water, wood and room, and the best sites of a land
VB['sim/landing'] = (() => {
  const { B, BIOMES } = VB['world/biomes'];
  const { fromState, drawer } = VB['sim/rng'];
  const { farmable, openGround, fertility } = VB['sim/crops'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  const { settlementGenerator, siteScore } = VB['sim/layout'];
  const { layWalk, siteFetch, dayFetch } = VB['sim/water'];
  const { FRESHES, BANDS, band, bandMid, sourceNear } = VB['world/water'];
  // @tunable LANDING: how a site is read for the settler who lands alone. soilSteps: the steps round the house its fields are looked
  // for in; fields: how many of the best tiles there are its soil; woodSteps: the steps a wood is counted within. Each of water, soil
  // and wood is banded 0 to 3, poor to fine, by the first row it meets, best first: water [hours of fetching a day for one, by a
  // natural source alone (true) or by the nearer of source and well, the most hours of digging the well may take]; soil [the least
  // mean fertility, the least open tiles]; wood [the most steps to the nearest, the least wooded tiles]. apart: the least steps
  // between two of the sites suggested; read: how many of the best-scored meadows are read for them.
  const LANDING = {
    soilSteps: 3,
    fields: 4,
    woodSteps: 6,
    water: [
      [0.6, true, 0],
      [0.7, false, 45],
      [1.5, false, Infinity],
    ],
    soil: [
      [0.95, 12],
      [0.9, 6],
      [0.7, 3],
    ],
    wood: [
      [2, 20],
      [3, 8],
      [Infinity, 1],
    ],
    apart: 10,
    read: 120,
  };
  const wooded = (w, i) => w.biome[i] === B.FOREST || w.biome[i] === B.PINE;
  // The band of a reading by its rows: 3 for the first met, down to 0 for none.
  const bandOf = (rows, meets) => 3 - (rows.findIndex(meets) + 1 || rows.length + 1) + 1;
  // The land as it lies before anyone lands: the walk to water is laid (sim/water), nothing else is touched.
  const lay = (w) => layWalk(w);
  // Why a farm cannot stand round tile i, or null: the village's own placing, tried on nothing (it writes no world before its finish).
  function why(w, i) {
    if (!(i >= 0) || w.water[i]) return 'That is water';
    if (w.river[i]) return 'A river runs here';
    if (w.biome[i] !== B.MEADOW)
      return `A house needs open meadow to stand on: this is ${BIOMES[w.biome[i]].name.toLowerCase()}`;
    const v = settlementGenerator(w, drawer(fromState(i + 1)), true).addVillage(i, 1);
    return v.farmsteads.length ? null : 'No room here for a house and its first fields';
  }
  // What the settler sees of tile i as a site: {ok, why; soil: {band, best: the mean fertility of the LANDING.fields best tiles a field
  // can be made on within soilSteps, open: how many of those tiles are open ground}; water: {band, hours: the day's fetch for one,
  // walk: hours one way, name: the source's, well: the band's name of a well there or null, dig: its hours, byWell: whether the
  // fetch reckoned is a well's, the source lying further, srcHours: the day's fetch at the source alone}; wood: {band, n: wooded tiles within
  // woodSteps, steps: to the nearest}; stars: the three bands' sum, 0 to 9}. check: whether a farm's room is tried (why).
  function read(w, i, check = true) {
    lay(w);
    const no = check ? why(w, i) : null,
      pass = walkable(w),
      ferts = [];
    let open = 0;
    for (const [j] of bfs(w, i, LANDING.soilSteps, pass).dist) {
      if (j === i || !farmable(w, j)) continue;
      ferts.push(fertility(w, j));
      if (openGround(w, j)) open++;
    }
    ferts.sort((a, b) => b - a);
    const top = ferts.slice(0, LANDING.fields),
      best = top.length ? top.reduce((a, b) => a + b, 0) / LANDING.fields : 0;
    let n = 0,
      steps = Infinity;
    for (const [j, d] of bfs(w, i, LANDING.woodSteps, pass).dist)
      if (wooded(w, j)) {
        n++;
        if (d < steps) steps = d;
      }
    const walk = w.freshWalk ? w.freshWalk[i] : Infinity,
      near = walk < Infinity ? sourceNear(w, i) : -1,
      k = w.waterDepth ? band(w.waterDepth[i]) : 3,
      hours = w.freshWalk ? siteFetch(w, i, 1) : Infinity,
      srcHours = walk < Infinity ? dayFetch(walk, 1).hours : Infinity,
      dig = k < 3 ? bandMid(k) : Infinity;
    const soil = { band: bandOf(LANDING.soil, ([f, o]) => best >= f && open >= o), best, open },
      water = {
        band: bandOf(LANDING.water, ([h, natural, d]) =>
          natural ? srcHours <= h : hours <= h && (srcHours <= h || dig <= d),
        ),
        hours,
        srcHours,
        walk,
        name: near >= 0 ? FRESHES[w.fresh[near]].name : null,
        well: k < 3 ? BANDS[k].name : null,
        dig: k < 3 ? dig : null,
        byWell: k < 3 && !(srcHours <= hours),
      },
      wood = { band: bandOf(LANDING.wood, ([d, m]) => steps <= d && n >= m), n, steps };
    return { tile: i, ok: no === null, why: no, soil, water, wood, stars: soil.band + water.band + wood.band };
  }
  // The n sites a newcomer is pointed to, no two within LANDING.apart steps: the best by the reading's stars among the meadows the
  // village's own search scores highest, and, so that the choice shows what differs, one of them by running water or a lake where
  // the land has such a site and the best have only wells. One pass over the meadows, then a reading of the best LANDING.read.
  function best(w, n = 3) {
    lay(w);
    const cand = [];
    for (let i = 0; i < w.N; i++) {
      if (w.biome[i] !== B.MEADOW || (i * 7919) % 5) continue;
      const s = siteScore(w, i);
      if (s > 0) cand.push([s, i]);
    }
    cand.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const reads = cand.slice(0, LANDING.read).map(([, i]) => read(w, i, false));
    reads.sort((a, b) => b.stars - a.stars || a.water.hours - b.water.hours || a.tile - b.tile);
    const out = [],
      take = (r) => {
        if (out.length >= n || out.some((o) => hexSteps(w, o.tile, r.tile) < LANDING.apart) || why(w, r.tile) !== null)
          return;
        out.push(r);
      };
    const stream = reads.find((r) => r.water.band === 3);
    for (const r of reads) {
      if (out.length === n - 1 && stream && out.every((o) => o.water.band < 3)) take(stream);
      take(r);
    }
    return out;
  }
  return { LANDING, lay, why, read, best };
})();
