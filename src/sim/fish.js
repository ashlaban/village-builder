// @sys sim/fish: fish in rivers, lakes and the sea (VB-117): each river and small lake tile's stock, lowered by a catch and recovering in
// closed form, and a house's fishing ground: the nearest bank within reach whose water holds fish
VB['sim/fish'] = (() => {
  const { FISH, DAY } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { passable } = VB['sim/routes'];
  // Fresh stocks for a world: every water full; the settlement generator calls it, and a load of a save made before fishing.
  function initFish(w) {
    // @state w.fish: Float32Array per tile; a river or small lake tile's fish stock from 0 to 1 as of the day in w.fishDay, recovering
    //   FISH.recover a day, read in closed form (stock; Rules for cost, 3); 1 on every other tile (the sea and large lakes do not run down)
    // @state w.fishDay: Int32Array per tile; the game day the tile's w.fish was last set (0 for a tile never fished)
    w.fish = new Float32Array(w.N).fill(1);
    w.fishDay = new Int32Array(w.N);
  }
  // The size of the lake each lake tile lies in, in tiles (0 off lakes): from the generated world, which play never changes, so it is
  // worked out once a world and kept beside it, not saved.
  function lakeSizes(w) {
    if (w.lakeSize) return w.lakeSize;
    const size = new Int32Array(w.N),
      seen = new Uint8Array(w.N);
    for (let s = 0; s < w.N; s++) {
      if (!w.water[s] || w.ocean[s] || seen[s]) continue;
      const q = [s];
      seen[s] = 1;
      for (let h = 0; h < q.length; h++)
        for (let k = 0; k < 6; k++) {
          const j = w.nb[q[h] * 6 + k];
          if (j >= 0 && w.water[j] && !w.ocean[j] && !seen[j]) {
            seen[j] = 1;
            q.push(j);
          }
        }
      for (const i of q) size[i] = q.length;
    }
    w.lakeSize = size; // lint-allow: owner derived from the generated world, the same on every load; never saved
    return size;
  }
  // Water fish live in: a river tile, a lake or the sea.
  const isWater = (w, i) => i >= 0 && (w.water[i] === 1 || w.river[i] > 0);
  // Its stock runs down with fishing: a river tile, or a lake of fewer than FISH.bigLake tiles.
  const runsDown = (w, i) => w.river[i] > 0 || (w.water[i] === 1 && !w.ocean[i] && lakeSizes(w)[i] < FISH.bigLake);
  const today = (st) => Math.floor(st.t / DAY);
  // The stock of water tile i now, from 0 to 1.
  function stock(st, i) {
    const w = st.w;
    return runsDown(w, i) ? Math.min(1, w.fish[i] + FISH.recover * (today(st) - w.fishDay[i])) : 1;
  }
  // A trip's catch at water tile i, in rations: FISH.trip times its stock; the stock falls by FISH.take (not the sea's nor a large lake's).
  function landCatch(st, i) {
    const w = st.w,
      s = stock(st, i);
    if (runsDown(w, i)) {
      w.fish[i] = Math.max(0, s - FISH.take);
      w.fishDay[i] = today(st);
    }
    return FISH.trip * s;
  }
  // The fishing ground of a house: the nearest bank (walkable land, not a river, next to water) within FISH.reach walking steps whose
  // richest neighbouring water holds at least FISH.least; ties by the search's order. {shore, water}, or null.
  function ground(st, house) {
    const w = st.w,
      { dist } = bfs(w, house, FISH.reach, (j) => passable(w, j));
    VB.count.fishGround += dist.size;
    for (const t of dist.keys()) {
      if (w.river[t]) continue;
      let best = -1,
        top = FISH.least;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[t * 6 + k];
        if (!isWater(w, j)) continue;
        const s = stock(st, j);
        if (s >= top && (best < 0 || s > top)) {
          best = j;
          top = s;
        }
      }
      if (best >= 0) return { shore: t, water: best };
    }
    return null;
  }
  return { initFish, lakeSizes, isWater, runsDown, stock, landCatch, ground };
})();
