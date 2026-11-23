// @sys sim/walking: terrain and slope costs, the discomfort routes are chosen by, tile passability and cached reach by walking steps
VB['sim/walking'] = (() => {
  const { B } = VB['gen'];
  const { YEAR_DAYS } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  // @tunable TERRAIN: walking: the cost of crossing a tile by its biome, relative to meadow; a pawn walks at SPEED / cost
  // Houses and fields cost 1 whatever the biome under them; water and snowfields are closed, and so is a river but at a ford or bridge.
  // Each kind of ground has its own cost (Kim, 13 Nov; VB-439): sand and heather slow a walker a little, open pine wood and rough hill
  // ground three times as long as meadow, a thick broadleaf wood with no way through it four times, marsh and bare rock longer. Rough
  // ground is dear (Kim, 15 Nov; the journey scale, VB-444's plan, section 5; VB-780): the costs above heath were doubled from 1.6, 1.8,
  // 2, 2.5 and 3.5, so a path through the wood (PATHS.clear) is half again as slow as meadow, and two and a half times as fast as the
  // pathless wood beside it: where a way goes decides the journey. What a worn way takes off these is PATHS.clear.
  const TERRAIN = {
    [B.MEADOW]: 1,
    [B.BEACH]: 1.15,
    [B.HEATH]: 1.5,
    [B.PINE]: 3,
    [B.HILLS]: 3,
    [B.FOREST]: 4,
    [B.MARSH]: 5,
    [B.MOUNTAIN]: 6,
    [B.SNOW]: Infinity,
    ford: 2,
    bridge: 1,
  };
  // @tunable SLOPE: slopes: a step between two tiles is slowed by its slope, up or down alike, whatever its terrain (VB-438)
  // Tobler's hiking function (Tobler 1993: 6 exp(-3.5 |S + 0.05|) km an hour at slope S, rise over run), made symmetric around the
  // flat: a walker's speed falls by exp(-tobler |S|), so a step's cost is its terrain's times exp(tobler |S|).
  // tobler: the function's exponent; grade: the slope S of a step whose two tiles differ by one unit of elevation (w.he, 0 to 1 over
  // the land): the heightmap is far steeper than ground is (read as 1,400 m of relief over tiles of 150 m, grade would be 9.3 and the
  // median step a slope of 0.3), so grade was set where the median step cost what it did before, then raised from 1.5 to 2 (Kim,
  // 13 Nov; VB-439); max: the cap on the factor, where Tobler's 6 km an hour has fallen to 1, which bounds the dearest step (the
  // route cache's refresh needs one).
  // Walkable neighbours differ by 0.03 to 0.04 at the median, 0.08 to 0.12 at the 90th percentile, 0.16 to 0.24 at the 99th and 0.4
  // to 0.5 at the most (small and medium, seeds 7 and 42): factors of about 1.3, 2.0, 4.1 and the cap (from a difference of 0.26). grade 0 switches slopes off.
  const SLOPE = { tobler: 3.5, grade: 2, max: 6 };
  // @tunable PATHS: worn paths (sim/paths): a tile's crossings, halving every halfLifeDays, make it trodden ground, a path or a lane at `at`;
  // a stage is lost only below `keep` of its threshold; speed: how much faster a pawn walks there, by stage (VB-110)
  // clear: the share of the ground's cost above meadow that the wear takes away, by stage (VB-439): a tile costs
  // (1 + (TERRAIN - 1) (1 - clear)) / speed. A road is a path or a lane (stages 2 and 3): cleared and firm, it is walked almost alike
  // through any ground, so a road through thick forest (1.14 a path, 1.04 a lane) is a little slower than open meadow (1), which is a
  // little slower than a road over meadow (0.91, 0.87); trodden ground (stage 1) is only a little easier than none (forest 1.72).
  // A generated village (but the founders') starts with `wornYears` of its daily trips worn in (VB-114): `trips` per farm and day, there
  // and back, to each field, to the well (water) and to the green on an idle stroll, and to the village's wood; set so a new village has the paths a
  // played one has after two years (populous Tiny, seeds 7 and 11: 14 and 18 path tiles worn in, 14 to 21 and 13 to 19 played).
  const PATHS = {
    at: [0, 50, 200, 800],
    keep: 0.85,
    halfLifeDays: YEAR_DAYS,
    speed: [1, 1.03, 1.1, 1.15],
    clear: [0, 0.25, 0.75, 0.8],
    wornYears: 3,
    trips: { field: 0.5, water: 2, stroll: 1, wood: 0.9 },
  };

  // @tunable DISCOMFORT: what a walker minds though it costs little time (VB-448; design.md, Worn paths, 4, and docs/path-effort.md): an
  // allowance a tile, the share of a step's time a walker would give to be spared it, which steers the route search alone (sim/routes);
  // the walk takes its time (tileCost), and tires no one. A step is chosen by its time × (1 + weight × load[class] × the mean of its two
  // tiles' allowances). footing: uneven or overgrown ground by its kind, as energy runs above time on it (de Gruchy, Caswell and Edwards:
  // grass 1.1, light brush 1.2, heavy brush 1.5, bog 1.8 against hard ground), taken away by wear as PATHS.clear takes the ground's cost
  // (use gives footing); a field, a meadow, the green and a house are firm. wet: what wear does not drain, marsh and the ford: the ford's
  // is set so that from bank to bank over open meadow a walker goes round to a bridge up to twice the time of wading and no further, at
  // weight 1 (Kim, 16 Nov: a dry crossing is worth up to twice the time round); a bridge is dry and firm. load, by class (0 unladen, 1 a
  // load on the back, 2 with a cart; Kim, 16 Nov): a laden walker minds bad footing and wet more, a cart most.
  // weight: one for everyone until slice 7 (Kim, 16 Nov); 0 switches discomfort off, and routes are the quickest; it lands at 0 for
  // Kim's tuning run to switch on (docs/tuning.md).
  const DISCOMFORT = {
    weight: 0,
    footing: {
      [B.MEADOW]: 0.1,
      [B.BEACH]: 0.4,
      [B.HEATH]: 0.2,
      [B.PINE]: 0.2,
      [B.HILLS]: 0.3,
      [B.FOREST]: 0.5,
      [B.MARSH]: 0.3,
      [B.MOUNTAIN]: 0.5,
    },
    wet: { [B.MARSH]: 0.6 },
    ford: 2.3,
    bridge: 0,
    load: [1, 1.5, 2.5],
  };

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

  // A tile's cost along a trail a party would blaze (VB-786; docs/plans/VB-445.md, section 2): a wooded tile with no path through it costs
  // what a path there would (PATHS.clear and speed at stage 2: broadleaf 1.59, pine 1.36), the trail the party cuts before it carries
  // anything; every other tile what it costs now (tileCost). A step along it is stepCost's, by these costs.
  const TRAIL = 2;
  function trailCost(w, i) {
    const b = w.biome[i];
    if (
      (b !== B.FOREST && b !== B.PINE) ||
      w.water[i] ||
      (w.dev && w.dev[i]) ||
      (w.river && w.river[i]) ||
      (w.worn && w.worn[i] >= TRAIL)
    )
      return tileCost(w, i);
    return (1 + (TERRAIN[b] - 1) * (1 - PATHS.clear[TRAIL])) / PATHS.speed[TRAIL];
  }
  const trailStep = (w, a, b) => {
    const ca = trailCost(w, a),
      cb = trailCost(w, b);
    return (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) * slopeFactor(w, a, b);
  };

  // The discomfort of tile i (DISCOMFORT): its footing, less what its wear has cleared, and its wet; 0 where it is firm (a field, a
  // meadow, the green, a house, a bridge) or closed. Read by the route search only when DISCOMFORT.weight is not 0.
  function discomfort(w, i) {
    if (w.water[i] || (w.dev && w.dev[i])) return 0;
    if (w.river && w.river[i]) return w.crossing[i] === 1 ? DISCOMFORT.ford : DISCOMFORT.bridge;
    const b = w.biome[i],
      s = w.worn ? w.worn[i] : 0;
    return (DISCOMFORT.footing[b] ?? 0) * (1 - PATHS.clear[s]) + (DISCOMFORT.wet[b] ?? 0);
  }
  // What a step from a to b costs a walker of load class `cls` to choose (sim/routes): its time (stepCost) weighed by the mean of its
  // tiles' discomfort; its time alone when the weight is 0.
  function choiceCost(w, a, b, cls = 0) {
    const t = stepCost(w, a, b),
      k = DISCOMFORT.weight * DISCOMFORT.load[cls];
    return k ? t * (1 + (k * (discomfort(w, a) + discomfort(w, b))) / 2) : t;
  }

  function invalidateReach(w, tile) {
    const r = REACH.get(w),
      stands = passable(w, tile) ? 1 : 0;
    if (r && r.stood && r.stood[tile] !== stands) {
      r.stood[tile] = stands;
      r.lists.clear();
    }
  }
  return {
    TERRAIN,
    SLOPE,
    PATHS,
    DISCOMFORT,
    tileCost,
    passable,
    through,
    walkable,
    reachTiles,
    slopeFactor,
    stepCost,
    trailStep,
    discomfort,
    choiceCost,
    invalidateReach,
  };
})();
