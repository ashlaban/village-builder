// @sys world/water: fresh water on the map: the codes and names of a tile's source (w.fresh), the well's bands by the depth to the ground's
// water (w.waterDepth) with the hours a well of each takes, and the nearest source down the walk to water (w.freshWalk)
// design.md, Goods and the farming year, Water by the site (VB-1543; laid by VB-1581). gen/water lays the class and the depth, sim/water
// the walk. Nothing here is a rule of the fetch: these are the map's names and its one reading of a depth.
VB['world/water'] = (() => {
  // A tile's source of fresh water, w.fresh's codes: none (the sea and the shallows are salt), a lake, running water by its flow
  // (world/rivers), marsh, of poor water, and a dug well (the wells a run starts with, sim/water; a village's, sim/green, and a household's, sim/wells).
  const FRESH = { NONE: 0, LAKE: 1, BROOK: 2, STREAM: 3, RIVER: 4, MARSH: 5, WELL: 6 };
  // By code: key, and the name the player reads after "Fresh water:".
  const FRESHES = [
    { key: 'none', name: '' },
    { key: 'lake', name: 'a lake' },
    { key: 'brook', name: 'a brook' },
    { key: 'stream', name: 'a stream' },
    { key: 'river', name: 'a river' },
    { key: 'marsh', name: 'marsh', poor: true },
    { key: 'well', name: 'a well' },
  ];
  // @tunable WELL: wells by the depth to the ground's water: shallow to `shallow` metres, middling to `middling`, deep to `deepest`, beyond
  // which no well is dug (w.waterDepth holds NO_WELL there); a well's hours are `flat` (the curb and the sweep) and `perMetre` down to
  // the water, from `least` metres, the shallowest a well is; startWalk: a farm that has stood for years further than this, in hours one way, from
  // any source starts with a well of its own (sim/water, VB-1582). Proposed, design.md, Water by the site, Wells (Kim, 23 November: starting
  // values). payYears: the years of fetching a well's hours are spread over where a site's water is weighed (sim/water siteWater, VB-1583), and
  // within which a household's well must pay (sim/wells, VB-1584).
  const WELL = { shallow: 4, middling: 10, deepest: 20, flat: 16, perMetre: 4, least: 1, startWalk: 0.5, payYears: 2 };
  // w.waterDepth where no well can be dug: mountain, snowfield, water, and ground whose water lies deeper than WELL.deepest.
  const NO_WELL = Infinity;
  const BANDS = [
    { key: 'shallow', name: 'shallow', to: WELL.shallow },
    { key: 'middling', name: 'middling', to: WELL.middling },
    { key: 'deep', name: 'deep', to: WELL.deepest },
    { key: 'none', name: 'no well', to: Infinity },
  ];
  // The band of a depth in metres, an index into BANDS: 0 shallow, 1 middling, 2 deep, 3 no well. What is shown of a depth is its band,
  // the pawn's estimate, never the metres (design.md, What is shown).
  const band = (depth) => (depth <= WELL.shallow ? 0 : depth <= WELL.middling ? 1 : depth <= WELL.deepest ? 2 : 3);
  // The hours of digging and lining a well of `depth` metres, and the loads of stone its lining takes: one, and one more for every 2 m
  // begun. The one rule of a well's cost, a household's (sim/wells) and a village's (sim/green): 2 m is 24 hours and 2 loads, 10 m 56 and 6.
  const wellHours = (depth) => WELL.flat + WELL.perMetre * depth;
  const wellStone = (depth) => 1 + Math.ceil(depth / 2);
  // The range of hours of a well in band k, [least, most], or null for no well.
  const bandHours = (k) =>
    k > 2 ? null : [wellHours(k ? BANDS[k - 1].to : WELL.least), wellHours(BANDS[k].to)].map(Math.round);
  // The hours of a well at the middle of band k, the head's estimate before it digs (design.md, Wells): 26, 44 and 76.
  const bandMid = (k) => wellHours(((k ? BANDS[k - 1].to : WELL.least) + BANDS[k].to) / 2);
  // The most stone a well in band k may take, its deepest's: what is set aside before the digging, since the depth is met only in it
  // (3, 6 and 11 loads).
  const bandStone = (k) => wellStone(BANDS[k].to);
  // Whether tile i is a source of good water: any but marsh.
  const good = (w, i) => w.fresh[i] !== FRESH.NONE && w.fresh[i] !== FRESH.MARSH;
  // The source the walk to water of tile i leads to: the tile itself where it is a source of good water, else down w.freshWalk from
  // neighbour to neighbour to the tile where the walk ends, a river's own tile or the lake beside a bank; -1 where there is none to walk
  // to (an islet) or the walk is not laid. For the tile card: a few steps, never a search.
  function sourceNear(w, i) {
    if (!w.fresh) return -1;
    if (good(w, i)) return i;
    if (!w.freshWalk || !(w.freshWalk[i] < Infinity)) return -1;
    for (let at = i, n = 0; n < w.N; n++) {
      let best = -1;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[at * 6 + k];
        if (j < 0) continue;
        if (good(w, j)) return j;
        if (w.freshWalk[j] < w.freshWalk[at] && (best < 0 || w.freshWalk[j] < w.freshWalk[best])) best = j;
      }
      if (best < 0) return -1;
      at = best;
    }
    return -1;
  }
  return {
    FRESH,
    FRESHES,
    WELL,
    NO_WELL,
    BANDS,
    band,
    bandHours,
    bandMid,
    bandStone,
    wellHours,
    wellStone,
    good,
    sourceNear,
  };
})();
