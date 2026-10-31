// @sys sim/meadows: hay meadows as built land: a tile's worth as meadow, choosing one, the meadow project, and the meadows of generated farms
VB['sim/meadows'] = (() => {
  const { B } = VB['gen'];
  const { byRiver } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { log } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { nextTo } = VB['sim/layout'];
  const { winterNeed } = VB['sim/herds'];
  const { builtTiles } = VB['sim/fields'];
  // A meadow tile yields HAY × its site value a year in an ordinary year (VB-132): open meadow 1, marsh 0.8, heath 0.6, and 1.3 times that on
  // wet ground by a river or open water. A household with animals wants meadows for WANT × its winter's need, at most MAX; it looks for them
  // within REACH walking steps. Clearing takes CLEAR_HOURS and up to STONE_HOURS for the stones, down to KEEP_STONES of 255.
  const HAY = 30, WANT = 1.2, MAX = 6, START_MAX = 4, REACH = 6, CLEAR_HOURS = 4, STONE_HOURS = 10, KEEP_STONES = 80, STONES_PER_LOAD = 25;
  const SITE = { [B.MEADOW]: 1, [B.MARSH]: 0.8, [B.HEATH]: 0.6 };
  function wetBank(w, i) {
    if (byRiver(w, i)) return true;
    for (let k = 0; k < 6; k++) { const j = w.nb[i * 6 + k]; if (j >= 0 && w.water[j]) return true; }
    return false;
  }
  const meadowFert = (w, i) => (SITE[w.biome[i]] || 0) * (wetBank(w, i) ? 1.3 : 1);
  // Hay a farm's meadows give in an ordinary year, before raking and weather.
  const expectedHay = (f) => f.meadows.reduce((s, m) => s + HAY * m.fert, 0);
  // The best free tile for a hay meadow within REACH of the house, or -1: open meadow, marsh or heath, not a river or water tile, unowned
  // and unused, not next to a house or green; by site value, near, few stones, beside the farm's meadows, and away from its fields' block.
  function chooseMeadow(st, f) {
    const w = st.w, built = builtTiles(st), own = new Set(f.meadows.map((m) => m.tile)), fields = new Set(f.fields.map((fd) => fd.tile));
    let best = -1, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, walkable(w)).dist) {
      if (d < 1 || !SITE[w.biome[t]] || w.river[t] || w.water[t] || st.owner[t] !== 0 || st.used.has(t) || built.has(t) || nextTo(w, t, built)) continue;
      const s = meadowFert(w, t) - 0.06 * d - (0.3 * w.stones[t]) / 255 + (nextTo(w, t, own) ? 0.3 : 0) - (nextTo(w, t, fields) ? 0.5 : 0);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  const wantsMeadow = (st, f, hh) => hh.herds.length > 0 && f.meadows.length < MAX && expectedHay(f) < WANT * winterNeed(st, hh);
  // The tile becomes the household's meadow: owned, in use, developed (no path wears on it, the settlement layer draws it).
  function addMeadow(st, f, hh, tile) {
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.meadows.push({ id: f.meadows.length, tile, stage: 'grass', fert: meadowFert(st.w, tile), raked: false, mown: null, held: 0 });
    st.used.add(tile); st.w.dev[tile] = 1; st.biomeDirty.add(tile);
  }
  // A household with animals and no land project, short of meadow for its herds' winter, claims a tile and starts clearing it (founders).
  function startMeadow(st, f, hh) {
    if (f.project || !wantsMeadow(st, f, hh)) return;
    const tile = chooseMeadow(st, f);
    if (tile < 0) return;
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.project = { tile, stage: 'meadow', hours: CLEAR_HOURS + (STONE_HOURS * Math.max(0, st.w.stones[tile] - KEEP_STONES)) / (255 - KEEP_STONES) };
  }
  // Cleared: the worst stones go to the household's store and the tile is a meadow from now on.
  function finishMeadow(st, f, hh) {
    const w = st.w, tile = f.project.tile, gone = Math.max(0, w.stones[tile] - KEEP_STONES);
    hh.stone += Math.round(gone / STONES_PER_LOAD); w.stones[tile] -= gone;
    f.project = null;
    addMeadow(st, f, hh, tile);
    st.visualDirty = true;
    log(st, `${f.name} has made a new hay meadow.`);
  }
  // Generated farms (populous, heirs) have stood a while: each with animals has its meadows already, at most START_MAX.
  function placeMeadows(st) {
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead];
      while (f.meadows.length < START_MAX && wantsMeadow(st, f, hh)) {
        const tile = chooseMeadow(st, f);
        if (tile < 0) break;
        addMeadow(st, f, hh, tile);
      }
    }
  }
  return { HAY, meadowFert, expectedHay, chooseMeadow, wantsMeadow, addMeadow, startMeadow, finishMeadow, placeMeadows };
})();
