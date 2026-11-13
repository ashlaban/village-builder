// @sys sim/forest: felling, regrowth and clearing of forest tiles
VB['sim/forest'] = (() => {
  const { B, treeStage, setBiome } = VB['gen'];
  const { YEAR_DAYS, WOOD } = VB['sim/rules'];
  const { next } = VB['sim/rng'];
  const { costChanged } = VB['sim/routes'];
  const { woodTaken } = VB['sim/territory'];
  const { emit } = VB['sim/events'];
  const REGROW_YEARS = 30; // a partly felled tile regains its trees, linearly, in this many game years
  // Hours to fell a wooded tile's trees and to grub out its stumps (VB-031; also thick scrub cleared, sim/spread).
  const FELL_HOURS = 10,
    GRUB_HOURS = 6;
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;

  function stageChanged(st, tile, was) {
    if (treeStage(st.w, tile) !== was) st.treeDirty.add(tile);
  }

  // A tile with no trees left becomes meadow, for good unless the forest spreads back into it (sim/spread, which hears cutBare); a village
  // whose wood held it reckons its wood again (sim/territory).
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
    emit(st, 'cutBare', { tile });
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

  // A completed firewood trip fells one tree on its tile: a forest tile grows it back (st.regrow), scrub as the front grows (sim/spread).
  function fellTree(st, tile) {
    const w = st.w;
    if (tile < 0 || w.trees[tile] <= 0) return;
    const was = treeStage(w, tile);
    w.trees[tile] = Math.max(0, w.trees[tile] - 1);
    if (w.trees[tile] <= 0) {
      clearTile(st, tile);
      return;
    }
    if (wooded(w, tile)) st.regrow.add(tile);
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
  return { FELL_HOURS, GRUB_HOURS, fellTree, drawWood, growTrees, clearTile };
})();
