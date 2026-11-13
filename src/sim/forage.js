// @sys sim/forage: wild food in the woods and on the heath (VB-118): each forest and heath tile's stock of berries, mushrooms and nuts, full
// each spring and lowered by a trip, and a house's gathering ground: the nearest such tile within reach with something left
VB['sim/forage'] = (() => {
  const { FORAGE, YEAR_DAYS, DAY } = VB['sim/rules'],
    { B } = VB['gen'];
  const { bfs } = VB['sim/hex'];
  const { passable } = VB['sim/routes'];
  // Fresh stocks for a world: every tile full; the settlement generator calls it, and a load of a save made before gathering.
  function initForage(w) {
    // @state w.forage: Float32Array per tile; a forest or heath tile's stock of wild food from 0 to 1 as of the year in w.forageYear; it is
    //   full again each spring (stock: read in closed form, Rules for cost, 3), and 1 on every other tile
    // @state w.forageYear: Int16Array per tile; the game year (from 0, spring its first season) the tile's w.forage was last set (0 if never)
    w.forage = new Float32Array(w.N).fill(1);
    w.forageYear = new Int16Array(w.N);
  }
  // Ground where wild food grows: forest (broadleaf or pine) and heath.
  const wild = (w, i) => w.biome[i] === B.FOREST || w.biome[i] === B.PINE || w.biome[i] === B.HEATH;
  const year = (st) => Math.floor(st.t / DAY / YEAR_DAYS);
  // The stock of tile i now, from 0 to 1: what was left this year, or full in a new spring.
  const stock = (st, i) => (st.w.forageYear[i] === year(st) ? st.w.forage[i] : 1);
  // A trip's gathering at tile i, in rations: FORAGE.trip times its stock; the stock falls by FORAGE.take.
  function gather(st, i) {
    const w = st.w,
      s = stock(st, i);
    w.forage[i] = Math.max(0, s - FORAGE.take);
    w.forageYear[i] = year(st);
    return FORAGE.trip * s;
  }
  // The gathering ground of a house: the nearest forest or heath tile within FORAGE.reach walking steps with at least FORAGE.least left
  // (ties by the search's order), or -1.
  function ground(st, house) {
    const w = st.w,
      { dist } = bfs(w, house, FORAGE.reach, (j) => passable(w, j));
    VB.count.forageGround += dist.size;
    for (const t of dist.keys()) if (wild(w, t) && !w.dev[t] && stock(st, t) >= FORAGE.least - 1e-6) return t;
    return -1;
  }
  return { initForage, wild, stock, gather, ground };
})();
