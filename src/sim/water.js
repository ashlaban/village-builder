// @sys sim/water: the walk to fresh water as a field of the map (w.freshWalk): the hours on foot over pathless ground from each land tile to
// the nearest source that is not marsh, searched once from the land as generated
VB['sim/water'] = (() => {
  const { minHeap } = VB['gen/rivers'];
  const { good } = VB['world/water'];
  const { SPEED } = VB['sim/rules'];
  const { TERRAIN, slopeFactor } = VB['sim/walking'];

  // What tile i costs to cross with no path, no field and no house on it: its biome's cost (sim/walking TERRAIN), a river's tile only at
  // a crossing, as a ford. It reads the generated fields alone, so the walk is the same whatever has been built or worn since.
  const bare = (w, i) =>
    w.water[i] ? Infinity : w.river[i] ? (w.crossing[i] ? TERRAIN.ford : Infinity) : (TERRAIN[w.biome[i]] ?? 1);
  // The walk in hours of every land tile to the nearest source of good water (design.md, Water by the site, The walk to water, as a
  // field): one search outward from every source at once. A river's tile is drawn at where it runs (0); a lake at its bank, half a step
  // of the bank's ground from the water; a step costs what sim/walking's stepCost does on bare ground (the mean of its two tiles, a closed
  // end as meadow, times the slope), at SPEED tiles of meadow an hour. Infinity on water and where no source can be walked to (an islet).
  // Wells and worn ways are not in it: it is what a pawn would guess from the land; a farm's real walk is its route's (VB-1551).
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
    //   not saved (a load lays it again on its freshly generated world); the tile card and the Water overlay read it (VB-1550)
    if (!w.freshWalk && w.fresh) w.freshWalk = walks(w);
  }
  return { walks, layWalk };
})();
