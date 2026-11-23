// @sys gen/biomes: biome identifiers, land cover thresholds and tile pigments
VB['gen/biomes'] = (() => {
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
  // ---- land cover: which biome a land tile gets, from its height rank p (0 the lowest land tile, 1 the highest) and its moisture m
  // (0 dry to 1 wet, a little wetter on the coast and drier with height). Read in this order, the first that holds:
  //   snow, mountain: p above these; shore: a coast tile with p below it is sandy shore, or marsh where m is above shoreMarsh;
  //   upland: p above it is hills, or pine forest where m is above uplandPine;
  //   then the lowland by moisture: heath below `heath`, meadow below `meadow`, broadleaf forest below `forest`, and wetter than that
  //   pine forest, or marsh where p is below marshLow and m above marshWet.
  // So the lowland's shares move with three numbers: lowering `heath` and `meadow` gives their land to the broadleaf forest. The island
  // is forested (design.md, The journey scale; Kim, 15 Nov: about half the land; VB-444's plan, section 4; VB-780): heath 0.07 and meadow
  // 0.2 (they were 0.3 and 0.54) give 48 to 58% of the land to forest and pine over ten islands (52% at the median), 5 to 9% to meadow
  // and 3 to 6% to heath (`node tools/cover.js` prints the shares). ----
  const COVER = {
    snow: 0.975,
    mountain: 0.9,
    shore: 0.16,
    shoreMarsh: 0.76,
    upland: 0.76,
    uplandPine: 0.5,
    heath: 0.07,
    meadow: 0.2,
    forest: 0.7,
    marshLow: 0.22,
    marshWet: 0.8,
  };
  // Land colours are the earth pigments of a painted vault (yellow ochre, green earth, red oxide, limewash), from c to c2 by the macro
  // tint; shade: how strongly the light of the relief tells on the biome.
  const BIOMES = [
    { key: 'deep', name: 'Open sea', water: 1 },
    { key: 'sea', name: 'Sea', water: 1 },
    { key: 'shallow', name: 'Shallows', water: 1 },
    { key: 'lake', name: 'Lake', water: 1 },
    { key: 'beach', name: 'Sandy shore', c: [234, 212, 156], c2: [226, 198, 138], shade: 0.4 },
    { key: 'meadow', name: 'Meadow', c: [156, 182, 108], c2: [178, 188, 110], shade: 0.6 },
    { key: 'heath', name: 'Heath', c: [200, 180, 124], c2: [192, 160, 124], shade: 0.6 },
    { key: 'forest', name: 'Broadleaf forest', c: [118, 154, 92], c2: [132, 160, 92], shade: 0.7 },
    { key: 'pine', name: 'Pine forest', c: [96, 134, 98], c2: [106, 138, 94], shade: 0.95 },
    { key: 'marsh', name: 'Marsh', c: [150, 168, 122], c2: [160, 170, 118], shade: 0.4 },
    { key: 'hills', name: 'Hills', c: [200, 190, 130], c2: [206, 182, 132], shade: 1.1 },
    { key: 'mountain', name: 'Mountains', c: [196, 184, 166], c2: [184, 170, 156], shade: 1.1 },
    { key: 'snow', name: 'Snowfields', c: [240, 236, 222], c2: [228, 226, 216], shade: 1.1 },
  ];
  // Changes a tile's biome and its baked base colour (the same formula as in generate).
  function setBiome(w, i, b) {
    const bi = BIOMES[b];
    w.biome[i] = b;
    const mc = Math.max(0, Math.min(1, w.csample(w.macro, w.hx[i], w.hy[i]))),
      t = 1 + (w.hrnd[i] - 0.5) * 0.03;
    w.tr[i] = (bi.c[0] + (bi.c2[0] - bi.c[0]) * mc) * t;
    w.tg[i] = (bi.c[1] + (bi.c2[1] - bi.c[1]) * mc) * t;
    w.tb[i] = (bi.c[2] + (bi.c2[2] - bi.c[2]) * mc) * t;
  }

  return { B, COVER, BIOMES, setBiome };
})();
