// @sys sim/walking: terrain and slope costs, tile passability and cached reach by walking steps
VB['sim/walking'] = (() => {
  const { TERRAIN, SLOPE, PATHS } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];

  // ---- walking costs: a step costs the mean of the two tiles' costs and the slope between them, so a route costs the same both ways ----
  // Cost of walking across tile i, relative to meadow; Infinity where nobody walks (water, snowfields, a river away from its fords and
  // bridges, VB-112) and a house (w.dev 3): a walk starts or ends at a house and goes round the others, so the ways bend round
  // buildings (VB-402). Greens, fields and meadows cost 1. A worn tile is walked faster by its stage (VB-110), a field or meadow too,
  // and its wear takes away a share of what its ground costs above meadow (PATHS.clear, VB-439; not at a ford or on a bridge);
  // the green (w.dev 2) wears no path.
  function tileCost(w, i) {
    if (w.water[i]) return Infinity;
    if (w.dev && w.dev[i]) return w.dev[i] === 3 ? Infinity : w.dev[i] === 1 && w.worn ? 1 / PATHS.speed[w.worn[i]] : 1;
    const c =
        w.river && w.river[i]
          ? w.crossing[i] === 1
            ? TERRAIN.ford
            : w.crossing[i] === 2
              ? TERRAIN.bridge
              : Infinity
          : 0,
      s = w.worn ? w.worn[i] : 0;
    if (c) return c / PATHS.speed[s];
    return (1 + ((TERRAIN[w.biome[i]] ?? 1) - 1) * (1 - PATHS.clear[s])) / PATHS.speed[s];
  }
  // Land a pawn can stand on: what is in walking reach counts steps over it, a house too (the reach searches of sim/hex end at houses).
  const passable = (w, i) => i >= 0 && (tileCost(w, i) < Infinity || (!!w.dev && w.dev[i] === 3));
  // Land a route may cross: passable, and not a house.
  const through = (w, i) => i >= 0 && tileCost(w, i) < Infinity;
  // The rule for breadth-first searches of what is in walking reach (sim/hex bfs): passable tiles only.
  const walkable = (w) => (j) => passable(w, j);
  // The tiles within `steps` walking steps of `from`, in the order the breadth-first search finds them (sim/hex bfs under `walkable`,
  // `from` first): what a house's ground searches scan for the nearest tile that will do (sim/fish, sim/forage, sim/deer), asked for
  // many times a day and the same each time. Where a pawn can stand is the generated world's (not water, not a river away from its
  // crossings, not snow; a house can be stood on), which play does not change, so a list is searched once and kept beside the world's
  // own data: never in `st`, never saved, the same after a load. Should a tile's standing change after all, invalidateReach sees it
  // and the lists are searched again. One list a house and reach asked for, of at most 3 * steps * (steps + 1) + 1 tiles.
  const REACH = new WeakMap(); // lint-allow: closure derived from the world alone, as sim/fish's lakeSize; holds nothing of a run
  function reachTiles(w, from, steps) {
    let r = REACH.get(w);
    if (!r) REACH.set(w, (r = { lists: new Map(), stood: null }));
    const key = from * 256 + steps;
    let list = r.lists.get(key);
    if (!list) {
      if (!r.stood) {
        r.stood = new Uint8Array(w.N);
        for (let i = 0; i < w.N; i++) r.stood[i] = passable(w, i) ? 1 : 0;
      }
      list = Int32Array.from(bfs(w, from, steps, walkable(w)).dist.keys());
      r.lists.set(key, list);
    }
    return list;
  }
  // What the slope of the step between a and b multiplies its cost by: Tobler's hiking function made symmetric around the flat (VB-438),
  // exp(SLOPE.tobler |S|) for the slope S = SLOPE.grade times the elevation between them, up or down alike (so the way back costs what
  // the way there does), at most SLOPE.max; 1 on the level. Water lies at sea level; a worn path does not flatten a slope.
  const slopeFactor = (w, a, b) => {
    if (!w.he) return 1;
    const ha = w.he[a],
      hb = w.he[b],
      rise = Math.abs((ha > 0 ? ha : 0) - (hb > 0 ? hb : 0));
    if (rise === 0) return 1;
    const f = Math.exp(SLOPE.tobler * SLOPE.grade * rise);
    return f < SLOPE.max ? f : SLOPE.max;
  };
  // Cost of the step between neighbouring tiles a and b: the mean of their costs times the slope's factor; a closed end (where a
  // route starts or ends) counts as meadow.
  const stepCost = (w, a, b) => {
    const ca = tileCost(w, a),
      cb = tileCost(w, b);
    return (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) * slopeFactor(w, a, b);
  };

  function invalidateReach(w, tile) {
    const r = REACH.get(w),
      stands = passable(w, tile) ? 1 : 0;
    if (r && r.stood && r.stood[tile] !== stands) {
      r.stood[tile] = stands;
      r.lists.clear();
    }
  }
  return { tileCost, passable, through, walkable, reachTiles, slopeFactor, stepCost, invalidateReach };
})();
