// @sys sim/water: the walk to fresh water as a field of the map (w.freshWalk): the hours on foot over pathless ground from each land tile to
// the nearest source that is not marsh, searched once from the land as generated; and each farm's source (farmstead.water): where its
// household draws its water, of what class and how long the walk, found by one search outward from the house (VB-1582); the wells the
// map starts with and a well's entry on the map (w.fresh); and a site's water before a house stands there (siteFetch, siteWater: VB-1583;
// plotFetch, a plot's site in a village: VB-1596); and the day's fetch by the people it is for (dayFetch: the trips by hand and with a
// cart and their hours), the one reckoning the panel, the well's test and the site search read (VB-1604)
VB['sim/water'] = (() => {
  const { minHeap } = VB['gen/rivers'];
  const { good, FRESH, FRESHES, WELL, NO_WELL, BANDS, band, bandHours, bandMid, sourceNear } = VB['world/water'];
  const { SPEED, TRAVEL, YEAR, YEAR_DAYS, WORK, SETTLE } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const yearOf = (t) => Math.floor(t / YEAR);
  const { TERRAIN, slopeFactor, stepCost, through } = VB['sim/walking'];
  const { on } = VB['sim/events'];
  // @tunable WATER: the fetch (design.md, Water by the site; Proposed, Kim's starting values of 23 November). search: the hours one way
  // beyond which a farm has no water in reach; marshShy: a household draws at a marsh only when no good source lies within this much
  // further walk one way; draw: the hours of drawing a trip's water with a yoke of two buckets. The fetch grows with the household
  // (VB-1586): hand, the people a trip by hand covers for a day; child, those a child under childUnder covers, with its one bucket;
  // cart, those a trip with a cart's barrel covers; fill, the hours of filling the barrel.
  const WATER = { search: 8, marshShy: 0.5, draw: 0.1, hand: 6, child: 3, childUnder: 12, cart: 18, fill: 0.3 };

  // What tile i costs to cross with no path, no field and no house on it: its biome's cost (sim/walking TERRAIN), a river's tile only at
  // a crossing, as a ford. It reads the generated fields alone, so the walk is the same whatever has been built or worn since.
  const bare = (w, i) =>
    w.water[i] ? Infinity : w.river[i] ? (w.crossing[i] ? TERRAIN.ford : Infinity) : (TERRAIN[w.biome[i]] ?? 1);
  // The walk in hours of every land tile to the nearest source of good water (design.md, Water by the site, The walk to water, as a
  // field): one search outward from every source at once. A river's tile is drawn at where it runs (0); a lake at its bank, half a step
  // of the bank's ground from the water; a step costs what sim/walking's stepCost does on bare ground (the mean of its two tiles, a closed
  // end as meadow, times the slope), at SPEED tiles of meadow an hour. Infinity on water and where no source can be walked to (an islet).
  // Wells and worn ways are not in it: it is what a pawn would guess from the land; a farm's real walk is its route's (VB-1582).
  function walks(w) {
    const { N, nb } = w,
      walk = new Float32Array(N).fill(Infinity),
      done = new Uint8Array(N),
      heap = minHeap(walk),
      open = (i) => {
        const c = bare(w, i);
        return c < Infinity ? c : 1;
      };
    for (let i = 0; i < N; i++) {
      if (!good(w, i)) continue;
      if (!w.water[i]) {
        walk[i] = 0;
        heap.push(i);
        continue;
      }
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || w.water[j] || good(w, j)) continue;
        const c = Math.fround((1 + open(j)) / 2 / SPEED);
        if (c < walk[j]) {
          walk[j] = c;
          heap.push(j);
        }
      }
    }
    while (heap.size) {
      const i = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      VB.count.waterSettled++;
      if (walk[i] > 0 && bare(w, i) === Infinity) continue; // a tile nobody crosses is walked to, not through
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || done[j] || w.water[j]) continue;
        const c = Math.fround(walk[i] + (((open(i) + open(j)) / 2) * slopeFactor(w, i, j)) / SPEED);
        if (c < walk[j]) {
          walk[j] = c;
          heap.push(j);
        }
      }
    }
    return walk;
  }
  // Lay the walk on a world that has none: called where a world enters a state (sim/scenarios makeState, sim/saves load before the
  // saved fields are put back), when its land is still as generated. Never recomputed: natural sources do not move.
  function layWalk(w) {
    // @state w.freshWalk: Float32Array per tile; hours on foot over pathless ground to the nearest source of fresh water that is not
    //   marsh (w.fresh), 0 on a river's tile, Infinity on water and where none can be walked to; laid once from the land as generated,
    //   not saved (a load lays it again on its freshly generated world); the tile card and the Water overlay read it (VB-1581)
    if (!w.freshWalk && w.fresh) w.freshWalk = walks(w);
  }
  // ---- a farm's source (VB-1582; design.md, Water by the site, A farm's source) ----
  const running = (c) => c === FRESH.BROOK || c === FRESH.STREAM || c === FRESH.RIVER;
  // What a household of the farm with its house on `house`, of village v, may draw standing on tile i, a code of FRESH or 0: at a well
  // that is its own (on its house's tile) or its village's (v.well, its tile), at running water on the water's own tile, at a lake from
  // its bank, at marsh on it or at its edge. Good water before marsh where a tile has both.
  function drawnAt(w, i, house, v) {
    const c = w.fresh[i];
    if (c === FRESH.WELL) {
      if (i === house || (!!v && v.well === i)) return c;
    } else if (running(c)) return c;
    let cls = c === FRESH.MARSH ? c : 0;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j < 0) continue;
      if (w.fresh[j] === FRESH.LAKE) return FRESH.LAKE;
      if (w.fresh[j] === FRESH.MARSH) cls = FRESH.MARSH;
    }
    return cls;
  }
  VB.counter(
    'sourceSettled',
    "Tiles settled by the searches for a farm's source of water: one a farm on its first morning, at a well's finishing in its village " +
      'and once a year on its planning day, each stopping at the first source (sim/water; VB-1582)',
  );
  // The source of a house on tile `house` in village v: {tile, cls, walk}, the tile its household stands on to draw (-1: none in reach),
  // the source's class (w.fresh's code) and the walk one way in hours. One search outward from the house over the ground as it is walked
  // now (sim/walking stepCost: the worn ways and the ground's cost), which stops at the first tile the household may draw at; bounded at
  // WATER.search hours. Marsh is a last resort: the first marsh found is kept and the search goes on WATER.marshShy hours further for
  // good water. A river's tile away from its fords is walked to, never through, as a route's end is. The tiles settled are counted
  // (sourceSettled): tens beside water, hundreds inland.
  function source(w, house, v) {
    const { N, nb } = w,
      g = new Float32Array(N).fill(Infinity),
      done = new Uint8Array(N),
      heap = minHeap(g);
    let bound = WATER.search * SPEED,
      marsh = -1;
    g[house] = 0;
    heap.push(house);
    while (heap.size) {
      const i = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      VB.count.sourceSettled++;
      if (g[i] > bound) break;
      const cls = drawnAt(w, i, house, v);
      if (cls && cls !== FRESH.MARSH) return { tile: i, cls, walk: Math.round((g[i] / SPEED) * 1000) / 1000 };
      if (cls && marsh < 0) {
        marsh = i;
        bound = Math.min(bound, g[i] + WATER.marshShy * SPEED);
      }
      if (i !== house && !through(w, i)) continue;
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || done[j] || w.water[j] || !(through(w, j) || running(w.fresh[j]))) continue;
        const c = Math.fround(g[i] + stepCost(w, i, j));
        if (c > bound || c >= g[j]) continue;
        g[j] = c;
        heap.push(j);
      }
    }
    return marsh < 0
      ? { tile: -1, cls: FRESH.NONE, walk: 0 }
      : { tile: marsh, cls: FRESH.MARSH, walk: Math.round((g[marsh] / SPEED) * 1000) / 1000 };
  }
  // Farm f's source is found: at its founding (its first morning: sourceOf), when a well is finished in its village (wellDug) and once
  // a year on its household's planning day, since paths wear in and grow over.
  function find(st, f) {
    // @state farmstead.water: {tile, cls, walk, year}: where the farm's household draws its water: the tile it stands on to draw (a
    //   source's own tile, or a lake's bank or a marsh's edge; -1 when none lies within WATER.search hours), the source's class (w.fresh's
    //   code; 0 with none), the walk one way in hours as the ground was when it was found, and the year it was found in; absent until
    //   the farm's first morning (sim/water find, VB-1582)
    f.water = { ...source(st.w, f.house, st.villages[f.village]), year: yearOf(st.t) };
    return f.water;
  }
  const sourceOf = (st, f) => f.water || find(st, f);
  // ---- the day's fetch (VB-1604; design.md, Water by the site, The fetch grows with the household, The daily cost at a site) ----
  // The hours of one trip by hand to a source `walk` hours off: out with empty buckets, the drawing, home laden (TRAVEL.pace.back).
  const tripHours = (walk) => walk * (1 + 1 / TRAVEL.pace.back) + WATER.draw;
  // A cart's trip: the walk both ways at the pace of a cart of `kind` ('hand' or 'ox'), and the barrel's filling.
  const cartHours = (walk, kind) => (2 * walk) / TRAVEL.pace[kind] + WATER.fill;
  // The day's fetch of `people` at a source `walk` hours off, with a cart of kind `cart` to take or none (null): {hand, cart, hours},
  // the trips by hand and with the cart and their hours together. The one reckoning (the panel, the well's test, the site search; and
  // the choice a trip makes, sim/chores, asks it of those still without water as the trip sets out): a trip by hand covers WATER.hand
  // people and a cart's barrel WATER.cart; trip by trip the cart goes for those still uncovered where they are more than one trip by
  // hand covers and it is the cheaper in hours than the trips by hand its barrel saves (Above the first). One trip at the least.
  function dayFetch(walk, people, cart = null) {
    const by = tripHours(walk),
      barrel = cart ? cartHours(walk, cart) : Infinity;
    let hand = 0,
      carts = 0;
    for (let need = Math.max(1, people); need > 0;)
      if (need > WATER.hand && barrel < Math.ceil(Math.min(need, WATER.cart) / WATER.hand) * by) {
        carts++;
        need -= WATER.cart;
      } else {
        hand++;
        need -= WATER.hand;
      }
    return { hand, cart: carts, hours: carts ? hand * by + carts * barrel : hand * by };
  }
  // The people of household hh at home: those its water is for. With nobody at home it is fetched for one, as it was before the fetch
  // grew: who comes home that day finds the trip posted (the due-queue asks no more once a kind posts nothing).
  const atHome = (st, hh) => {
    let n = 0;
    for (const id of hh.members) if (st.pawns[id].died === null && st.agents[id].away === undefined) n++;
    return Math.max(1, n);
  };
  // The cart a household reckons its water with: its hand cart, the faster with the same barrel, else its ox cart (sim/chores'
  // barrelCart, less what the day decides: whether the cart is in and the team free); null with none.
  const cartOf = (hh) =>
    hh.carts.some((c) => c.kind === 'hand') ? 'hand' : hh.carts.some((c) => c.kind === 'ox') ? 'ox' : null;
  // Farm f's water as the page tells it and its head weighs it (sim/wells): its household's day's fetch as it is made. {people (at
  // home, whom it is for), kind (the cart reckoned with, or null)} and, with no source in reach, {none: true, search}; else {name (the
  // source's), poor, walk, hand, cart (the trips), hours (theirs together), byHand (the hours with no cart)}.
  function waterOf(st, f) {
    const s = sourceOf(st, f),
      hh = f.household === null ? null : st.households[f.household],
      people = hh ? atHome(st, hh) : 1,
      kind = hh ? cartOf(hh) : null;
    if (s.tile < 0) return { none: true, search: WATER.search, people, kind };
    return {
      name: FRESHES[s.cls].name,
      poor: !!FRESHES[s.cls].poor,
      walk: s.walk,
      people,
      kind,
      ...dayFetch(s.walk, people, kind),
      byHand: dayFetch(s.walk, people).hours,
    };
  }
  // ---- a site's water, before a house stands there (VB-1583; design.md, Water by the site, The site's access, shown before placing) ----
  // A site is weighed by hand alone (dayFetch with no cart: one trip for each WATER.hand of the people): who settles brings no hand
  // cart (design.md, Carts, At the start).
  // The daily hours a well of its own would cost a house on tile i: the drawing at the door, and the digging at the middle of the
  // ground's band (the head's estimate: never the depth) spread over WELL.payYears; Infinity where no well can be dug.
  const ownWell = (w, i, people) =>
    w.waterDepth[i] < NO_WELL
      ? dayFetch(0, people).hours + bandMid(band(w.waterDepth[i])) / (WELL.payYears * YEAR_DAYS)
      : Infinity;
  // The daily fetch of a house on tile i with no source and no well: as far as a farm searches, which no site is refused for.
  const noWater = (people) => dayFetch(WATER.search, people).hours;
  // The daily fetch in hours the site search weighs for `people` settling on tile i, in a village of their own: the least of the walk
  // to fresh water as the land shows it (w.freshWalk) and a well of the site's own. Array reads, nothing searched (a candidate of
  // sim/settle, at most a searching village's reach a round).
  const siteFetch = (w, i, people) =>
    Math.min(
      w.freshWalk[i] < WATER.search ? dayFetch(w.freshWalk[i], people).hours : Infinity,
      ownWell(w, i, people),
      noWater(people),
    );
  // The village a house on tile i would join: the one whose centre is the nearest within SETTLE.centreApart steps, as close farms are
  // one village in play (sim/byhand farmAt); null where it would be a village of its own.
  function joins(st, i) {
    let v = null,
      vd = SETTLE.centreApart;
    for (const u of st.villages) {
      const d = hexSteps(st.w, u.center, i);
      if (d < vd) {
        vd = d;
        v = u;
      }
    }
    return v;
  }
  // The daily fetch in hours of a house on each tile of `tiles` (a Map or Set of the walkable tiles round the green: sim/expansion
  // findSite's reach) for `people` joining village v on a plot (VB-1596): a Map by tile of the least of what the round's search weighs
  // (siteFetch: fresh water by the land's walk, a well of the site's own) and the walk to the village's well, where it has one. The
  // walks to the well are one search outward from the green over the ground as it is walked now, shared by all the tiles and kept
  // within them (sourceSettled: at most the tiles given), a step costed as it is walked towards the well.
  function plotFetch(w, v, tiles, people) {
    const out = new Map();
    for (const t of tiles.keys()) out.set(t, siteFetch(w, t, people));
    if (v.well === null || w.fresh[v.well] !== FRESH.WELL) return out;
    const g = new Float32Array(w.N).fill(Infinity),
      done = new Uint8Array(w.N),
      heap = minHeap(g);
    g[v.center] = 0;
    heap.push(v.center);
    while (heap.size) {
      const i = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      VB.count.sourceSettled++;
      if (out.has(i)) out.set(i, Math.min(out.get(i), dayFetch(g[i] / SPEED, people).hours));
      if (i !== v.center && !through(w, i)) continue;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j < 0 || done[j] || !tiles.has(j)) continue;
        const c = Math.fround(g[i] + stepCost(w, j, i));
        if (c < g[j]) {
          g[j] = c;
          heap.push(j);
        }
      }
    }
    return out;
  }
  // A site's water as its leader would reckon it before placing the house on tile i, for `people` (design.md, In the leader's choice):
  // {people, trips, hours, share, by, source, village, well}. people: for whom it is reckoned (one trip's by default, as the tile card
  // asks), and trips: those they make a day, by hand alone (who settles brings no cart); hours: the daily fetch, the least of what
  // follows; share: of one hand's working day;
  // by: which it is ('source', 'village', 'well', or 'none': no water in reach and no well in the ground, when hours is the farthest
  // fetch a farm makes); source: {name, walk, hours}, the nearest good water by the land's walk (w.freshWalk; null beyond
  // WATER.search); village: {name, walk, hours}, the well of the village v the site would join (joins, unless given; null where it
  // has none nearer than other water), by one search outward from the site over the ground as it is walked now; well: {band, name,
  // range ([least, most] hours of digging), dig (the estimate, the band's middle), hours (a day, the digging spread over
  // WELL.payYears)}, null where none can be dug. An estimate, never the depth: the band is all a pawn knows before it digs.
  function siteWater(st, i, people = WATER.hand, v = joins(st, i)) {
    const w = st.w,
      fetch = (walk) => dayFetch(walk, people).hours,
      opts = [];
    let walk = w.freshWalk[i] < WATER.search ? w.freshWalk[i] : Infinity,
      village = null;
    if (v && v.well !== null) {
      const s = source(w, i, v);
      if (s.cls === FRESH.WELL) village = { name: v.name, walk: s.walk, hours: fetch(s.walk) };
      else if (s.tile >= 0 && s.cls !== FRESH.MARSH) walk = Math.min(walk, s.walk); // good water nearer than the green, as walked now
    }
    const near = walk < Infinity ? sourceNear(w, i) : -1,
      src = near < 0 ? null : { name: FRESHES[w.fresh[near]].name, walk, hours: fetch(walk) },
      k = band(w.waterDepth[i]),
      well =
        w.waterDepth[i] < NO_WELL
          ? {
              band: BANDS[k].key,
              name: BANDS[k].name,
              range: bandHours(k),
              dig: bandMid(k),
              hours: ownWell(w, i, people),
            }
          : null;
    if (src) opts.push(['source', src.hours]);
    if (village) opts.push(['village', village.hours]);
    if (well) opts.push(['well', well.hours]);
    opts.sort((a, b) => a[1] - b[1]);
    const [by, hours] = opts[0] || ['none', noWater(people)];
    return {
      people,
      trips: dayFetch(0, people).hand,
      hours,
      share: hours / (WORK[1] - WORK[0]),
      by,
      source: src,
      village,
      well,
    };
  }
  // A well stands on `tile` from now: a source on the map, and the farms it changes find their sources again: those of village v (its
  // own well, sim/green), or farm f alone (a household's, at its house: sim/wells), each with a source found.
  function wellDug(st, tile, v, f = null) {
    st.w.fresh[tile] = FRESH.WELL;
    if (v) for (const id of v.farmsteads) if (st.farmsteads[id].water) find(st, st.farmsteads[id]);
    if (f && f.water) find(st, f);
  }
  // A save from before the well was a tile (VB-1584): a village's well was a boolean, the well on its green, which is its centre.
  function wellsLoaded(st) {
    for (const v of st.villages) if (typeof v.well !== 'number') v.well = v.well === true ? v.center : null;
  }
  // The wells a run starts with (design.md, At the start), on a world as generated: a village that starts with its green has its well on
  // the green's tile; where the farms have stood for years (`stood`: not the founders' landing nor the lone settler's), a farm more than
  // WELL.startWalk hours from any source has a well on its house's tile, where its ground has one. A world seeded again starts from
  // its natural sources.
  function startWells(w, villages, farmsteads, stood) {
    for (let i = 0; i < w.N; i++) if (w.fresh[i] === FRESH.WELL) w.fresh[i] = FRESH.NONE;
    for (const v of villages) if (v.well !== null) w.fresh[v.well] = FRESH.WELL;
    if (!stood) return;
    for (const f of farmsteads) {
      if (f.household === null || w.fresh[f.house] !== FRESH.NONE || !(w.waterDepth[f.house] < NO_WELL)) continue;
      const s = source(w, f.house, villages[f.village]);
      if (s.tile < 0 || s.walk > WELL.startWalk) w.fresh[f.house] = FRESH.WELL;
    }
  }
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (f && f.water && f.water.year !== yearOf(st.t)) find(st, f);
  });
  return {
    WATER,
    layWalk,
    source,
    find,
    sourceOf,
    dayFetch,
    atHome,
    waterOf,
    siteFetch,
    plotFetch,
    siteWater,
    wellDug,
    wellsLoaded,
    startWells,
  };
})();
