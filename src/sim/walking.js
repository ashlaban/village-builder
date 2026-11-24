// @sys sim/walking: terrain and slope costs, the ground by season compiled into one array a world (VB-808), the discomfort routes are
// chosen by, tile passability and cached reach by walking steps
VB['sim/walking'] = (() => {
  const { B } = VB['world/biomes'];
  const { YEAR_DAYS, WINTER } = VB['sim/rules'];
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
  // blaze: a trail cut through forest (VB-447; docs/plans/VB-445.md, sections 3 and 5): the work hours a wooded tile with no path takes
  // to blaze (`hours`: trees marked with an axe, brush cut, windfall cleared), and `again` where it is still trodden ground (a faded trail
  // blazed again); a blazed tile is set to a path's count (at[2]) and is from then on a worn way like any other.
  const PATHS = {
    at: [0, 50, 200, 800],
    keep: 0.85,
    halfLifeDays: YEAR_DAYS,
    speed: [1, 1.03, 1.1, 1.15],
    clear: [0, 0.25, 0.75, 0.8],
    wornYears: 3,
    trips: { field: 0.5, water: 2, stroll: 1, wood: 0.9 },
    blaze: { hours: 3, again: 1 },
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
  // Cost of walking across tile i, relative to meadow, on the ground of season `f` (GROUND's flags; 0 the summer's): the rule, which
  // tileCost reads compiled. Infinity where nobody walks (water, snowfields, a river away from its fords and
  // bridges, VB-112) and a house (w.dev 3): a walk starts or ends at a house and goes round the others, so the ways bend round
  // buildings (VB-402). Greens, fields and meadows cost 1. A worn tile is walked faster by its stage (VB-110), a field or meadow too,
  // and its wear takes away a share of what its ground costs above meadow (PATHS.clear, VB-439; not at a ford or on a bridge);
  // the green (w.dev 2) wears no path.
  // A field in crop, or a meadow in grass where the practice `passage` is `ways` (sim/passage, VB-816: w.shut 1), is closed like a house
  // but along a path or a lane worn over it (stage OPEN_WAY and up: the way between the strips).
  // The ground by season (VB-808; design.md, Climate and travel beyond walking, The ground by season; WINTER): ice that bears is crossed at
  // WINTER.ice whatever lies under it (a lake, every river tile, the sea near land); snow, and the soft ground of the thaw, multiply what a
  // tile with no lane trodden on it costs; frozen marsh is ground of WINTER.marsh in place of TERRAIN's.
  function groundCost(w, i, f) {
    if (f && onIce(w, i, f)) return WINTER.ice;
    if (w.water[i]) return Infinity;
    const s = w.worn ? w.worn[i] : 0;
    let c;
    if (w.dev && w.dev[i]) {
      if (w.dev[i] !== 1) c = w.dev[i] === 3 ? Infinity : 1;
      else if (w.shut && w.shut[i] === 1 && s < OPEN_WAY) c = Infinity;
      else c = w.worn ? 1 / PATHS.speed[s] : 1;
    } else if (w.river && w.river[i]) {
      const x = w.crossing[i] === 1 ? TERRAIN.ford : w.crossing[i] === 2 ? TERRAIN.bridge : Infinity;
      c = x / PATHS.speed[s];
    } else {
      const b = w.biome[i],
        t = f & GROUND.marsh && b === B.MARSH ? WINTER.marsh : (TERRAIN[b] ?? 1);
      c = (1 + (t - 1) * (1 - PATHS.clear[s])) / PATHS.speed[s];
    }
    // frozen marsh bears at WINTER.marsh with its snow (the criterion's 1.5 in frost), not again by the snow on it
    const frozen = f & GROUND.marsh && w.biome[i] === B.MARSH && !(w.dev && w.dev[i]) && !(w.river && w.river[i]);
    if (f & (GROUND.snow | GROUND.soft) && c < Infinity && s < LANE && !frozen)
      c *= f & GROUND.snow ? WINTER.snow : WINTER.soft;
    return c;
  }
  // Whether ice bears tile i on the ground of season f: lake water and every river tile once lake ice bears, the sea within WINTER.near
  // tiles of land once sound ice bears.
  function onIce(w, i, f) {
    if (w.water[i]) {
      if (w.ocean && w.ocean[i]) return !!(f & GROUND.sea) && seaNear(w)[i] === 1;
      return !!(f & GROUND.lake);
    }
    return !!(f & GROUND.lake) && !!w.river && w.river[i] > 0;
  }
  // The cost of crossing tile i on the ground as it stands: compiled (w.ground), or the summer's rule before the run has compiled it.
  function tileCost(w, i) {
    const g = w.ground;
    return g ? g.cost[i] : groundCost(w, i, 0);
  }

  // ---- the ground compiled (VB-808; Rules for cost 6: tileCost is read in the search's inner loop) ----
  // GROUND: the flags of a row's season: snow lies, the marsh is frozen, lake and river ice bears, sea ice bears near land, the thaw's soft
  // ground. Which date sets which is sim/climate's (its table of the ground); what each does to a tile is groundCost's.
  const GROUND = Object.freeze({ snow: 1, marsh: 2, lake: 4, sea: 8, soft: 16 });
  // @state w.ground: {cost, ice, season}: derived, never saved: cost[i] the cost of crossing tile i (groundCost on its row's season), ice[i] 1
  //   where ice bears it, season[r] row r's season (GROUND's flags). Compiled once a run (sim/climate layGround: at a run's first step and at
  //   a load), a tile again where its cost changed (sim/routes costChanged), a band's rows on a winter's date. Equal to the rule computed
  //   afresh (an invariant).
  function compileGround(w, rows) {
    // derived from the world and the season, rebuilt on load; never saved
    w.ground = { cost: new Float64Array(w.N), ice: new Uint8Array(w.N), season: Uint8Array.from(rows) }; // lint-allow: owner derived
    for (let i = 0; i < w.N; i++) recost(w, i);
    REACH.delete(w); // what stands may differ from the lists searched before (ice)
    return w.ground;
  }
  // fn() run on the ground of seasons `rows` (a row's GROUND flags) in place of the ground as it stands, which is put back after: the
  // ground of a normal winter, for the winter table of hours (sim/villagehours). Compiled afresh each call, so that nothing is kept aside.
  function withGround(w, rows, fn) {
    const was = w.ground;
    w.ground = { cost: new Float64Array(w.N), ice: new Uint8Array(w.N), season: Uint8Array.from(rows) }; // lint-allow: owner as compileGround's
    for (let i = 0; i < w.N; i++) recost(w, i);
    try {
      return fn();
    } finally {
      w.ground = was; // lint-allow: owner as compileGround's
    }
  }
  // A run seeded on a world: its ground is compiled again at the first step (a world may be seeded more than once).
  function dropGround(w) {
    w.ground = null; // lint-allow: owner derived, as compileGround's
    REACH.delete(w); // the lists a run before searched, perhaps over its ice
  }
  // Tile i's cost again, on its row's season: true if it changed.
  function recost(w, i) {
    const g = w.ground;
    if (!g) return false;
    const f = g.season[(i / w.COLS) | 0],
      c = groundCost(w, i, f),
      ice = f && onIce(w, i, f) ? 1 : 0,
      was = g.cost[i];
    g.cost[i] = c;
    g.ice[i] = ice;
    return was !== c;
  }
  // Rows lo to hi (inclusive) come to season f: their tiles are costed again; the tiles whose cost changed are counted.
  function setRows(w, lo, hi, f) {
    const g = w.ground;
    if (!g) return 0;
    let n = 0;
    for (let r = lo; r <= hi; r++) {
      if (g.season[r] === f) continue;
      g.season[r] = f;
      for (let i = r * w.COLS, e = i + w.COLS; i < e; i++) if (recost(w, i)) n++;
    }
    if (n) REACH.delete(w); // what stands may have changed (ice): the reach lists are searched again
    return n;
  }
  // The rule computed afresh for tile i, on its row's season as compiled (the invariant's).
  const ruleCost = (w, i) => groundCost(w, i, w.ground ? w.ground.season[(i / w.COLS) | 0] : 0);
  // Whether ice bears tile i now (a journey's night is not spent on it, sim/legs).
  const iced = (w, i) => !!w.ground && i >= 0 && w.ground.ice[i] === 1;
  // The sea tiles within WINTER.near steps of land (1) or not (0), by the world alone: kept beside it, never saved.
  const NEAR = new WeakMap(); // lint-allow: closure derived from the world alone, as REACH below; holds nothing of a run
  function seaNear(w) {
    let m = NEAR.get(w);
    if (m) return m;
    const d = new Uint8Array(w.N).fill(255);
    for (let i = 0; i < w.N; i++) if (!w.water[i]) d[i] = 0;
    for (let k = 1; k <= WINTER.near; k++)
      for (let i = 0; i < w.N; i++) {
        if (d[i] !== 255) continue;
        for (let n = 0; n < 6; n++) {
          const j = w.nb[i * 6 + n];
          if (j >= 0 && d[j] === k - 1) {
            d[i] = k;
            break;
          }
        }
      }
    m = new Uint8Array(w.N);
    for (let i = 0; i < w.N; i++) m[i] = w.water[i] && d[i] <= WINTER.near ? 1 : 0;
    NEAR.set(w, m);
    return m;
  }
  // Land a pawn can stand on: what is in walking reach counts steps over it, a house too (the reach searches of sim/hex end at houses),
  // and a closed field or meadow (VB-816: its holder works it; only crossing it is barred).
  const passable = (w, i) => i >= 0 && (tileCost(w, i) < Infinity || ended(w, i));
  // Land a route may cross: passable, and not a house or a closed field.
  const through = (w, i) => i >= 0 && tileCost(w, i) < Infinity;
  // A tile a route may end at but not cross: a house, or a field or meadow closed by passage (VB-816).
  const ended = (w, i) => !!w.dev && (w.dev[i] === 3 || (!!w.shut && w.shut[i] === 1));
  // The two tests of sim/hex cutsOff, on the ground as it stands (VB-402, VB-816): `shut`, no route crosses j; `end`, j is a place a
  // route must reach from an open tile beside it (a house, a closed field). A closed field counts as shut though a path or a lane
  // crosses it now: nobody else walks it while it is closed, and its way fades.
  const cutTests = (w) => ({
    shut: (j) => j < 0 || !through(w, j) || (!!w.shut && w.shut[j] === 1),
    end: (j) => j >= 0 && ended(w, j),
  });
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
  // Cost of the step between neighbouring tiles a and b: the mean of their costs times the slope's factor (none from ice to ice: VB-808);
  // a closed end (where a route starts or ends) counts as meadow.
  const stepCost = (w, a, b) => {
    const ca = tileCost(w, a),
      cb = tileCost(w, b);
    return (
      (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) *
      (iced(w, a) && iced(w, b) ? 1 : slopeFactor(w, a, b))
    );
  };

  // A tile's cost along a trail a party would blaze (VB-786; docs/plans/VB-445.md, section 2): a wooded tile with no path through it costs
  // what a path there would (PATHS.clear and speed at stage 2: broadleaf 1.59, pine 1.36), the trail the party cuts before it carries
  // anything; every other tile what it costs now (tileCost). A step along it is stepCost's, by these costs.
  const TRAIL = 2;
  // The worn stage from which a closed field is crossed along its way (VB-816): a path or a lane.
  const OPEN_WAY = 2;
  // The worn stage of a lane: trodden under snow, and firm in the thaw (VB-808).
  const LANE = 3;
  // Whether tile i is wood a trail is blazed through (VB-447): broadleaf or pine forest, not water, a river, developed ground or a path
  // already (open ground wears its own way). The one test, for the trail's cost here and its jobs (sim/trails).
  function unblazed(w, i) {
    const b = w.biome[i];
    return (
      (b === B.FOREST || b === B.PINE) &&
      !w.water[i] &&
      !(w.dev && w.dev[i]) &&
      !(w.river && w.river[i]) &&
      !(w.worn && w.worn[i] >= TRAIL)
    );
  }
  function trailCost(w, i) {
    if (!unblazed(w, i)) return tileCost(w, i);
    return (1 + (TERRAIN[w.biome[i]] - 1) * (1 - PATHS.clear[TRAIL])) / PATHS.speed[TRAIL];
  }
  const trailStep = (w, a, b) => {
    const ca = trailCost(w, a),
      cb = trailCost(w, b);
    return (
      (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) *
      (iced(w, a) && iced(w, b) ? 1 : slopeFactor(w, a, b))
    );
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
    GROUND,
    tileCost,
    compileGround,
    withGround,
    dropGround,
    recost,
    setRows,
    ruleCost,
    iced,
    passable,
    through,
    ended,
    cutTests,
    walkable,
    reachTiles,
    slopeFactor,
    stepCost,
    trailStep,
    unblazed,
    discomfort,
    choiceCost,
    invalidateReach,
  };
})();
