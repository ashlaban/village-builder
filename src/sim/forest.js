// @sys sim/forest: felling, regrowth and clearing of forest tiles
VB['sim/forest'] = (() => {
  const { B, treeStage, setBiome } = VB['gen'];
  const { YEAR_DAYS, WOOD } = VB['sim/rules'];
  const { next } = VB['sim/rng'];
  const { costChanged } = VB['sim/routes'];
  const { woodTaken } = VB['sim/territory'];
  const REGROW_YEARS = 30; // a partly felled tile regains its trees, linearly, in this many game years

  function stageChanged(st, tile, was) {
    if (treeStage(st.w, tile) !== was) st.treeDirty.add(tile);
  }

  // A tile with no trees left becomes meadow for good (until forest spread, VB-091); a village whose wood held it reckons its wood again
  // (sim/territory).
  function clearTile(st, tile) {
    const w = st.w;
    w.trees[tile] = 0;
    w.treesMax[tile] = 0;
    st.regrow.delete(tile);
    setBiome(w, tile, B.MEADOW);
    st.treeDirty.add(tile);
    st.biomeDirty.add(tile);
    costChanged(st, tile);
    woodTaken(st, tile);
  }

  // The tile a firewood trip of village v cuts on (VB-326), drawn when its job is posted from the stream rng.forest: evenly among the tiles
  // of the village's wood that keep more than WOOD.thin of their trees, else among those with any; -1 when it has none.
  function drawWood(st, v) {
    const w = st.w,
      wood = v.wood,
      thick = (t) => w.trees[t] > WOOD.thin * w.treesMax[t];
    let n = 0;
    for (const t of wood) if (thick(t)) n++;
    const any = n === 0;
    if (any) for (const t of wood) if (w.trees[t] > 0) n++;
    if (!n) return -1;
    let k = Math.floor(next(st.rng.forest) * n);
    for (const t of wood)
      if (any ? w.trees[t] > 0 : thick(t)) {
        if (k === 0) return t;
        k--;
      }
    return -1;
  }

  // A completed firewood trip fells one tree on its tile.
  function fellTree(st, tile) {
    const w = st.w;
    if (tile < 0 || w.trees[tile] <= 0) return;
    const was = treeStage(w, tile);
    w.trees[tile] = Math.max(0, w.trees[tile] - 1);
    if (w.trees[tile] <= 0) {
      clearTile(st, tile);
      return;
    }
    st.regrow.add(tile);
    stageChanged(st, tile, was);
  }

  // Once a game day: tiles with some trees but fewer than their maximum grow back.
  function growTrees(st) {
    const w = st.w;
    for (const tile of st.regrow) {
      const max = w.treesMax[tile],
        was = treeStage(w, tile);
      w.trees[tile] = Math.min(max, w.trees[tile] + max / (REGROW_YEARS * YEAR_DAYS));
      if (w.trees[tile] >= max) st.regrow.delete(tile);
      stageChanged(st, tile, was);
    }
  }
  return { fellTree, drawWood, growTrees, clearTile };
})();
