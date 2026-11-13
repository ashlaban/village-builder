// @sys sim/spread: forest spread into open land (VB-091): the front of open tiles beside woodland, where scrub grows to forest unless
// farming, work or grazing keeps the land open; the hours scrub adds to clearing
VB['sim/spread'] = (() => {
  const G = VB['gen'],
    { B, treeStage, setBiome } = G;
  const { fullTrees } = VB['gen/cover'];
  const { DAY, YEAR_DAYS, GRAZE } = VB['sim/rules'];
  const { costChanged } = VB['sim/routes'];
  const { FELL_HOURS, GRUB_HOURS } = VB['sim/forest'];
  const { yearScale } = VB['sim/grazing'];
  const Projects = VB['sim/projects'];
  const { on } = VB['sim/events'];
  // design.md, Land and ecology, Forest spread (Decided; rates Agreed, Kim, 30 Oct; QUESTION_ARCHIVE.md, VB-091): open land next to forest,
  // or to scrub at half cover or more, gains trees as regrowth does, full cover in `years` game years (a quarter, scrub, in about 8); at full
  // cover it is forest. Grazing at or above GRAZE.thins takes trees off at `thin` of that rate. Work on a tile keeps it open `tendedDays`
  // game days. Land is scrub from `scrub` of full cover (an empty farm's field is then 'scrub', sim/fields). Clearing scrub below `half`
  // cover adds `scrubHours` to the clearing; at half or more it is felled and grubbed as forest.
  const SPREAD = { years: 30, thin: 0.2, scrub: 0.25, half: 0.5, tendedDays: YEAR_DAYS, scrubHours: 10 };
  const RATE = 1 / (SPREAD.years * YEAR_DAYS); // of full cover, a game day
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // Open land the forest may take: meadow or heath (an empty farm's field lies on it), not water, a green or a house.
  const open = (w, t) => (w.biome[t] === B.MEADOW || w.biome[t] === B.HEATH) && !w.water[t] && w.dev[t] < 2;
  // Scrub at half cover or more: it seeds its neighbours, is cut for firewood (sim/territory), and is felled and grubbed when cleared.
  const thick = (w, t) => !wooded(w, t) && w.treesMax[t] > 0 && w.trees[t] >= SPREAD.half * w.treesMax[t];
  // Whether a neighbour of t seeds it: a forest tile, or thick scrub.
  function seeded(w, t) {
    for (let d = 0; d < 6; d++) {
      const j = w.nb[t * 6 + d];
      if (j >= 0 && (wooded(w, j) || thick(w, j))) return true;
    }
    return false;
  }
  // The forest t grows into: pine where most of its forest neighbours are pine, else broadleaf.
  function kindAt(w, t) {
    let pine = 0,
      broad = 0;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[t * 6 + d];
      if (j < 0) continue;
      if (w.biome[j] === B.PINE) pine++;
      else if (w.biome[j] === B.FOREST) broad++;
    }
    return pine > broad ? B.PINE : B.FOREST;
  }
  // @state st.front: Set of tile indexes; the open tiles the forest may take (open land beside forest or thick scrub, and every scrub
  //   tile), visited once a game day (spreadForest); a tile that no longer qualifies is dropped when visited. Made at seed and at the load
  //   of an older save (initFront); joined by a tile cut bare (the event cutBare of sim/forest) and by the open neighbours of a tile that
  //   becomes thick scrub or forest. Written here only.
  // @state w.tended: Int32Array per tile; the game day of the last work on the tile (a clearing step, a field or meadow made, a field
  //   reclaimed) plus 1, 0 for none; work keeps a tile open SPREAD.tendedDays. Written here only (tended).
  // A field a scenario lays out gone to scrub (a ruin's) has the trees of scrub, a quarter of full cover.
  function initFront(st) {
    const w = st.w;
    if (!w.tended) w.tended = new Int32Array(w.N);
    for (const f of st.farmsteads)
      for (const fd of f.fields)
        if (fd.stage === 'scrub' && open(w, fd.tile) && w.treesMax[fd.tile] === 0) {
          w.treesMax[fd.tile] = fullTrees(G, w.seed, fd.tile, kindAt(w, fd.tile));
          w.trees[fd.tile] = SPREAD.scrub * w.treesMax[fd.tile];
        }
    st.front = new Set();
    for (let t = 0; t < w.N; t++) if (open(w, t) && (w.trees[t] > 0 || seeded(w, t))) st.front.add(t);
  }
  on('cutBare', (st, e) => {
    if (st.front && open(st.w, e.tile) && seeded(st.w, e.tile)) st.front.add(e.tile);
  });
  // Work on tile t today keeps it open (a clearing step, a field or meadow made, a field reclaimed).
  function tended(st, t) {
    st.w.tended[t] = Math.floor(st.t / DAY) + 1;
  }
  // The hours the trees on tile t add to clearing it: none without trees, SPREAD.scrubHours for scrub below half cover, a felling and a
  // grubbing for thick scrub or forest (as forest, VB-031; a plot fells and grubs as steps of their own, before its clearing).
  const scrubHours = (st, t) => {
    const w = st.w;
    if (!(w.trees[t] > 0)) return 0;
    return wooded(w, t) || thick(w, t) ? FELL_HOURS + GRUB_HOURS : SPREAD.scrubHours;
  };
  // Tile t is cleared of its scrub (a clearing step done, a field reclaimed): its trees are gone, and it is tended today. A field of an
  // empty farm that went to forest is meadow again.
  function clearScrub(st, t) {
    const w = st.w;
    tended(st, t);
    if (!(w.trees[t] > 0) && !wooded(w, t)) return;
    if (wooded(w, t)) {
      setBiome(w, t, B.MEADOW);
      st.biomeDirty.add(t);
      st.regrow.delete(t);
      costChanged(st, t);
    }
    w.trees[t] = 0;
    w.treesMax[t] = 0;
    st.treeDirty.add(t);
    st.visualDirty = true;
  }
  // Whether farming or work keeps tile t open today: work within SPREAD.tendedDays; a household's field (in use, or its to reclaim), its
  // meadow mown within the year, or other land it uses; an empty farm's field or meadow under restoration (`restoring`, made on first need).
  function kept(st, t, day, ctx) {
    const w = st.w;
    if (w.tended[t] && day - (w.tended[t] - 1) < SPREAD.tendedDays) return true;
    if (!st.used.has(t)) return false;
    const n = st.owner[t];
    if (n > 0) {
      const hh = st.households[n - 1];
      if (hh.dissolved || hh.farmstead === null || hh.farmstead === undefined) return true;
      const f = st.farmsteads[hh.farmstead];
      for (const fd of f.fields) if (fd.tile === t) return true;
      for (const m of f.meadows || []) if (m.tile === t) return m.mown !== null && day - m.mown < YEAR_DAYS;
      return true;
    }
    if (ctx.restoring === null) {
      ctx.restoring = new Set();
      Projects.forEach(st, (plan) => {
        if (plan.farm === undefined || plan.farm === null) return;
        const f = st.farmsteads[plan.farm];
        for (const fd of f.fields) ctx.restoring.add(fd.tile);
        for (const m of f.meadows || []) ctx.restoring.add(m.tile);
      });
    }
    return ctx.restoring.has(t);
  }
  // The trees of front tile t set to n (0 to its full cover); a tile that becomes thick scrub opens the front to its neighbours (`join`).
  function setTrees(st, t, n, join) {
    const w = st.w,
      was = treeStage(w, t),
      wasThick = thick(w, t);
    w.trees[t] = Math.max(0, Math.min(w.treesMax[t], n));
    if (!wasThick && thick(w, t)) join.push(t);
    if (treeStage(w, t) !== was) st.treeDirty.add(t);
  }
  // Front tile t reaches full cover: it is forest (broadleaf, or pine by its neighbours), its trees at full cover as generated forest's.
  function becomeForest(st, t, join) {
    const w = st.w,
      b = kindAt(w, t);
    setBiome(w, t, b);
    w.treesMax[t] = fullTrees(G, w.seed, t, b);
    w.trees[t] = w.treesMax[t];
    st.front.delete(t);
    st.treeDirty.add(t);
    st.biomeDirty.add(t);
    costChanged(st, t);
    join.push(t);
  }
  // Once a game day: each tile of the front gains trees, or is kept open, or is thinned by grazing; one that no longer qualifies leaves it.
  function spreadForest(st) {
    const w = st.w,
      front = st.front,
      day = Math.floor(st.t / DAY),
      ctx = { restoring: null },
      join = [],
      scale = yearScale(st); // the pressure now is w.graze over the year's scale (sim/grazing, grazeOf), taken once for the pass
    for (const t of front) {
      VB.count.frontTile++;
      if (!open(w, t) || !(w.trees[t] > 0 || seeded(w, t))) {
        front.delete(t);
        continue;
      }
      const g = w.graze[t] / scale;
      if (g >= GRAZE.thins) {
        if (w.trees[t] > 0) setTrees(st, t, w.trees[t] - w.treesMax[t] * RATE * SPREAD.thin, join);
        continue;
      }
      if (g >= GRAZE.keepsOpen || kept(st, t, day, ctx)) continue;
      if (w.treesMax[t] === 0) w.treesMax[t] = fullTrees(G, w.seed, t, kindAt(w, t));
      const n = w.trees[t] + w.treesMax[t] * RATE;
      if (n >= w.treesMax[t]) becomeForest(st, t, join);
      else setTrees(st, t, n, join);
    }
    // the open neighbours of new thick scrub and new forest join the front, to be visited from tomorrow
    for (const t of join)
      for (let d = 0; d < 6; d++) {
        const j = w.nb[t * 6 + d];
        if (j >= 0 && open(w, j)) front.add(j);
      }
  }
  return { SPREAD, initFront, spreadForest, tended, scrubHours, clearScrub, thick };
})();
