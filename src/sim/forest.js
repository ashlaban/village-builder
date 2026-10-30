// @sys sim/forest: felling, regrowth and clearing of forest tiles
VB['sim/forest'] = (() => {
  const { B, treeStage, setBiome } = VB['gen'];
  const { YEAR_DAYS } = VB['sim/rules'];
  const { nearestWood } = VB['sim/layout'];
  const REGROW_YEARS = 30; // a partly felled tile regains its trees, linearly, in this many game years

  function stageChanged(st, tile, was) { if (treeStage(st.w, tile) !== was) st.treeDirty.add(tile); }

  // A tile with no trees left becomes meadow for good; farms and villages that used it as a woodlot pick the nearest forest.
  function clearTile(st, tile) {
    const w = st.w;
    w.trees[tile] = 0; w.treesMax[tile] = 0; st.regrow.delete(tile);
    setBiome(w, tile, B.MEADOW);
    st.treeDirty.add(tile); st.biomeDirty.add(tile);
    for (const v of st.villages) if (v.commonsWood === tile) v.commonsWood = nearestWood(w, st.used, v.center);
    for (const f of st.farmsteads) {
      if (f.woodlot !== tile) continue;
      f.woodlot = st.villages[f.village].commonsWood;
    }
  }

  // A completed firewood trip fells one tree from the farm's woodlot.
  function fellTree(st, farm) {
    const w = st.w, tile = farm.woodlot;
    if (tile < 0 || w.trees[tile] <= 0) return;
    const was = treeStage(w, tile);
    w.trees[tile] = Math.max(0, w.trees[tile] - 1);
    if (w.trees[tile] <= 0) { clearTile(st, tile); return; }
    st.regrow.add(tile); stageChanged(st, tile, was);
  }

  // Once a game day: tiles with some trees but fewer than their maximum grow back.
  function growTrees(st) {
    const w = st.w;
    for (const tile of st.regrow) {
      const max = w.treesMax[tile], was = treeStage(w, tile);
      w.trees[tile] = Math.min(max, w.trees[tile] + max / (REGROW_YEARS * YEAR_DAYS));
      if (w.trees[tile] >= max) st.regrow.delete(tile);
      stageChanged(st, tile, was);
    }
  }
  return { fellTree, growTrees, clearTile };
})();
