// @sys world/biomes: the biomes' codes, keys, names and which are water, and the density stage of a tile's trees: what the generator lays,
// the simulation changes and the drawing shows
VB['world/biomes'] = (() => {
  // ---- Biomes ----
  const B = {
    DEEP: 0,
    SEA: 1,
    SHALLOW: 2,
    LAKE: 3,
    BEACH: 4,
    MEADOW: 5,
    HEATH: 6,
    FOREST: 7,
    PINE: 8,
    MARSH: 9,
    HILLS: 10,
    MOUNTAIN: 11,
    SNOW: 12,
  };
  // By code: key, the name the player reads, and water: 1 for the four kinds of water. Their pigments are draw/pigments'.
  const BIOMES = [
    { key: 'deep', name: 'Open sea', water: 1 },
    { key: 'sea', name: 'Sea', water: 1 },
    { key: 'shallow', name: 'Shallows', water: 1 },
    { key: 'lake', name: 'Lake', water: 1 },
    { key: 'beach', name: 'Sandy shore' },
    { key: 'meadow', name: 'Meadow' },
    { key: 'heath', name: 'Heath' },
    { key: 'forest', name: 'Broadleaf forest' },
    { key: 'pine', name: 'Pine forest' },
    { key: 'marsh', name: 'Marsh' },
    { key: 'hills', name: 'Hills' },
    { key: 'mountain', name: 'Mountains' },
    { key: 'snow', name: 'Snowfields' },
  ];

  // Density stage of a tile's trees: 4 (more than 75% of max left) down to 1 (25% or less), 0 when none are left.
  function treeStage(w, i) {
    const t = w.trees[i],
      m = w.treesMax[i];
    return t <= 0 || m === 0 ? 0 : t > 0.75 * m ? 4 : t > 0.5 * m ? 3 : t > 0.25 * m ? 2 : 1;
  }

  // A tile's biome changed (the editor's brush, a wood cleared or grown, a save loaded): the page recolours it (page/chunks).
  function setBiome(w, i, b) {
    w.biome[i] = b;
  }

  return { B, BIOMES, treeStage, setBiome };
})();
