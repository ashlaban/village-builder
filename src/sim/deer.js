// @sys sim/deer: roe deer (VB-139), the one wild grazer: a stock in each region with forest, growing towards a capacity set by its
// forest-edge tiles; their grazing at the edges, their browsing of crops through a broken fence, and hunting them in autumn and winter
VB['sim/deer'] = (() => {
  const { DEER, HERD, DAY, YEAR_DAYS } = VB['sim/rules'],
    { B } = VB['gen'];
  const { next: rnd } = VB['sim/rng'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { passable } = VB['sim/routes'];
  const { graze } = VB['sim/grazing'];
  const { trample } = VB['sim/fields'];
  const { addFood } = VB['sim/hunger'];
  const Stores = VB['sim/stores'];
  const { log, atFarm } = VB['sim/records'];
  // The deer live by the woods and graze the open land beside them (design.md, Animals: forest edges and meadows). A region's deer are one
  // stock, as fish are a water tile's (sim/fish): no deer is followed, and none walks from one region to another (they are counted where
  // they live; a region with no forest edge has none, and one that gains its first edge gains no deer until deer can move, later).
  // @state st.deer: {head[], since[], cap[], edges[][]}, one entry a region of w.regions: head the region's deer as of the game day in
  //   since, read in closed form as logistic growth towards cap at DEER.growth a year (stock; Rules for cost, 3); cap DEER.perEdge a forest-edge tile;
  //   edges the region's forest-edge tiles in tile order, the year's (recounted at the year's first step, recount). Written here only.
  const wooded = (w, i) => w.biome[i] === B.FOREST || w.biome[i] === B.PINE;
  // A forest-edge tile: a wood tile with open land (not wood, not water) beside it.
  function edgeTile(w, i) {
    if (!wooded(w, i)) return false;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j >= 0 && !w.water[j] && !wooded(w, j)) return true;
    }
    return false;
  }
  // A tile with a wood tile beside it.
  function byWood(w, i) {
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j >= 0 && wooded(w, j)) return true;
    }
    return false;
  }
  const today = (st) => Math.floor(st.t / DAY);
  // Region r's deer now: logistic growth from head towards cap since the day they were set, in years.
  function stock(st, r) {
    const D = st.deer,
      K = D.cap[r],
      n0 = D.head[r];
    if (!(K > 0) || !(n0 > 0)) return 0;
    return K / (1 + (K / n0 - 1) * Math.exp((-DEER.growth * (today(st) - D.since[r])) / YEAR_DAYS));
  }
  // Region r's deer against its capacity, from 0 to 1: how often they are met, in a crop or on a hunt.
  function density(st, r) {
    const K = st.deer.cap[r];
    return K > 0 ? Math.min(1, stock(st, r) / K) : 0;
  }
  // The forest edges counted again, once a year: a felled or cleared wood moves them, and the capacity with them; the deer of each region
  // are what they were, towards the new capacity (none where it has no edge left).
  function recount(st) {
    const w = st.w,
      D = st.deer,
      R = w.regions.length,
      found = Array.from({ length: R }, () => []);
    for (let i = 0; i < w.N; i++) if (edgeTile(w, i)) found[w.region[i]].push(i); // lint-allow: owner a list of this call's own
    for (let r = 0; r < R; r++) {
      const s = stock(st, r);
      D.cap[r] = found[r].length * DEER.perEdge;
      D.head[r] = D.cap[r] > 0 ? s : 0;
      D.since[r] = today(st);
    }
    D.edges = found;
  }
  // The deer of a new run (sim/scenarios) or of a save made before them (sim/saves): every region at its capacity, as wild woods are.
  function initDeer(st) {
    const R = st.w.regions.length;
    st.deer = { head: new Array(R).fill(0), since: new Array(R).fill(0), cap: new Array(R).fill(0), edges: [] };
    recount(st);
    for (let r = 0; r < R; r++) st.deer.head[r] = st.deer.cap[r];
  }
  // Each day the deer of a region graze DEER.graze cow-hours a deer over DEER.spots of its edge tiles, in turn through the year.
  function deerGraze(st, c) {
    const D = st.deer,
      S = DEER.spots;
    for (let r = 0; r < D.edges.length; r++) {
      const e = D.edges[r];
      if (!e.length) continue;
      const n = stock(st, r);
      if (!(n > 0)) continue;
      for (let k = 0; k < S; k++)
        graze(st, e[(((c.day * S + k) % e.length) + e.length) % e.length], (n * DEER.graze) / S);
    }
  }
  // A standing crop, sown and not yet reaped.
  const STANDING = ['sown', 'growing', 'ripe'];
  // In summer (sim/clock, CALENDAR): a standing crop beside a wood and beside a broken stretch of its village's fence (below
  // DEER.crop.below) is browsed with DEER.crop.chance times its region's deer against the capacity; it loses DEER.crop.loss of its yield
  // (sim/fields). Nobody is blamed: the deer are nobody's (the fence's keeper answers for cattle, sim/byre).
  function browseCrops(st) {
    const w = st.w;
    for (const v of st.villages) {
      const broken = v.fence.filter((s) => s.cond < DEER.crop.below);
      if (!broken.length) continue;
      for (const fid of v.farmsteads) {
        const g = st.farmsteads[fid];
        if (g.household === null) continue;
        for (const fd of g.fields) {
          VB.count.deerCrop++;
          if (!STANDING.includes(fd.stage) || !byWood(w, fd.tile)) continue;
          if (!broken.some((s) => s.edges.some((e) => hexSteps(w, e.tile, fd.tile) <= 1))) continue;
          const d = density(st, w.region[fd.tile]);
          if (!(d > 0) || rnd(st.rng.deer) >= DEER.crop.chance * d) continue;
          trample(fd, true);
          log(st, `Roe deer got into the crop at ${g.name} through a broken fence.`, {
            kind: 'deerInCrop',
            ...atFarm(g),
          });
        }
      }
    }
  }
  // ---- hunting ----
  // The hunting ground of a house: the nearest forest-edge tile within DEER.hunt.reach walking steps, not built on, whose region holds
  // DEER.hunt.least deer or more (ties by the search's order), or -1.
  function ground(st, house) {
    const w = st.w,
      { dist } = bfs(w, house, DEER.hunt.reach, (j) => passable(w, j));
    VB.count.deerGround += dist.size;
    for (const t of dist.keys()) if (edgeTile(w, t) && !w.dev[t] && stock(st, w.region[t]) >= DEER.hunt.least) return t;
    return -1;
  }
  // A hunt at tile `site` comes home: a kill with DEER.hunt.chance times the region's deer against its capacity (none below
  // DEER.hunt.least), one deer fewer and DEER.hunt.meat rations of fresh meat in the larder, to be salted as the slaughter's is (sim/byre).
  // The kills, 0 or 1.
  function hunt(st, hh, site) {
    const D = st.deer,
      r = st.w.region[site],
      s = stock(st, r);
    if (s < DEER.hunt.least || rnd(st.rng.deer) >= DEER.hunt.chance * Math.min(1, s / D.cap[r])) return 0;
    D.head[r] = s - 1;
    D.since[r] = today(st);
    addFood(st, hh, 'meat', DEER.hunt.meat, HERD.freshDays);
    Stores.record(st, hh, 'meat', DEER.hunt.meat, 'hunt');
    return 1;
  }
  // The job kind (sim/kinds registers it, with fishing's urgency by the household's spare food): in autumn and winter, a trip to the
  // house's hunting ground; foraging work for the men alone (ROLES' exceptions), from DEER.hunt.minAge. The pawn comes home with or
  // without a kill.
  const KIND = {
    verb: 'Hunting roe deer',
    go: 'Going hunting',
    back: 'Coming home from the hunt',
    name: 'Go hunting',
    label: 'Hunting',
    anim: null,
    hours: DEER.hunt.hours,
    hands: 1,
    type: 'foraging',
    minAge: DEER.hunt.minAge,
    carry: 'game',
    to: 'door',
    spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.5, st.w.hy[j.site] + a.oy * 0.4],
    deliver: (st, j, hh) => {
      hunt(st, hh, j.site);
    },
    // the key names the tile, so a ground whose region is hunted out is left for the next one at the following review
    available: (st, hh, f, c, post) => {
      if (c.season < 2) return;
      const t = ground(st, f.house);
      if (t >= 0) post(`hunt:h${hh.id}:${t}`, t, { farm: f });
    },
  };
  return { edgeTile, stock, density, recount, initDeer, deerGraze, browseCrops, ground, hunt, KIND };
})();
