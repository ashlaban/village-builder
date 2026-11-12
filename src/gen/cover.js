// @sys gen/cover: what a tile's cover holds, as the generator lays it and as the editor sets it by hand; a world's arrays kept and put back
VB['gen/cover'] = (() => {
  // K: what this module needs of gen, which loads after it: { mulberry32, B }, or the whole of VB['gen'].
  // A wood's trees at full cover: +-20% around 60 (broadleaf) or 80 (pine), by the seed and the tile; none on other ground.
  const fullTrees = (K, seed, i, b) => (b !== K.B.FOREST && b !== K.B.PINE ? 0
    : Math.round((b === K.B.PINE ? 80 : 60) * (0.8 + 0.4 * K.mulberry32((seed * 31 + i * 2654435761 + 0x7ee5) >>> 0)())));
  // A meadow tile's stones: at least 30; up to +100 more next to hills (hillDist: steps to the nearest, 9 if far), nothing beyond 2 tiles.
  function meadowStones(K, seed, i, macroAt, hillDist) {
    const mc = Math.max(0, Math.min(1, macroAt)), rn = K.mulberry32((seed * 31 + i * 2654435761 + 0x5707e) >>> 0)();
    const near = hillDist <= 2 ? Math.round((100 * (3 - hillDist)) / 2) : 0;
    return Math.min(255, 30 + Math.round((0.5 * mc + 0.5 * rn) * 60) + near);
  }
  // A land tile given another cover by hand (the editor; before a run is seeded on the world): its biome and colour, a wood's trees at
  // full cover and a meadow's stones, as generate lays them. Its height, rain and rivers stay; water, and a cover of water, are refused.
  function set(G, w, i, b) {
    if (w.water[i] || G.BIOMES[b].water) return false;
    G.setBiome(w, i, b);
    w.trees[i] = w.treesMax[i] = fullTrees(G, w.seed, i, b);
    let hd = 9;
    if (b === G.B.MEADOW) {
      for (let d = 0; d < 6 && hd > 1; d++) {
        const j = w.nb[i * 6 + d]; if (j < 0) continue;
        if (w.biome[j] === G.B.HILLS) hd = 1;
        else for (let e = 0; e < 6; e++) { const k = w.nb[j * 6 + e]; if (k >= 0 && w.biome[k] === G.B.HILLS) hd = 2; }
      }
    }
    w.stones[i] = b === G.B.MEADOW ? meadowStones(G, w.seed, i, w.csample(w.macro, w.hx[i], w.hy[i]), hd) : 0;
    return true;
  }
  // A world's tile and cell arrays as they are now, and the same world put back to them: the editor seeds a run on its world to show what is
  // placed, and takes the run away again before anything on the land changes. What a run adds to the world of its own (w.dev, the wear of
  // paths, fish, forage) is made anew by each seeding and is not kept.
  function keep(w) {
    const kept = {};
    for (const k of Object.keys(w)) if (ArrayBuffer.isView(w[k])) kept[k] = w[k].slice();
    return { arrays: kept, veinKind: w.veinKind.slice() };
  }
  function restore(w, kept) {
    for (const k of Object.keys(kept.arrays)) w[k].set(kept.arrays[k]);
    w.veinKind.length = 0; w.veinKind.push(...kept.veinKind);
  }
  return { fullTrees, meadowStones, set, keep, restore };
})();
