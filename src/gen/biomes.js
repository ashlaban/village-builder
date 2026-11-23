// @sys gen/biomes: land cover thresholds and tile pigments (the biomes' codes and names are world/biomes')
VB['gen/biomes'] = (() => {
  // ---- land cover: which biome a land tile gets, from its height rank p (0 the lowest land tile, 1 the highest) and its moisture m
  // (0 dry to 1 wet, a little wetter on the coast and drier with height). Read in this order, the first that holds:
  //   snow, mountain: p above these; shore: a coast tile with p below it is sandy shore, or marsh where m is above shoreMarsh;
  //   upland: p above it is hills, or pine forest where m is above uplandPine;
  //   then the lowland by moisture: heath below `heath`, meadow below `meadow`, broadleaf forest below `forest`, and wetter than that
  //   pine forest, or marsh where p is below marshLow and m above marshWet.
  // So the lowland's shares move with three numbers: lowering `heath` and `meadow` gives their land to the broadleaf forest. These
  // values give, on medium at seeds 7, 11 and 42, 27%, 17% and 19% of the land to forest and pine, 21 to 25% to meadow and 15 to 25%
  // to heath (`node tools/cover.js` prints the shares). ----
  const COVER = {
    snow: 0.975,
    mountain: 0.9,
    shore: 0.16,
    shoreMarsh: 0.76,
    upland: 0.76,
    uplandPine: 0.5,
    heath: 0.3,
    meadow: 0.54,
    forest: 0.7,
    marshLow: 0.22,
    marshWet: 0.8,
  };
  // Land colours are the earth pigments of a painted vault (yellow ochre, green earth, red oxide, limewash), from c to c2 by the macro
  // tint; shade: how strongly the light of the relief tells on the biome.
  const PIGMENTS = [
    {},
    {},
    {},
    {},
    { c: [234, 212, 156], c2: [226, 198, 138], shade: 0.4 },
    { c: [156, 182, 108], c2: [178, 188, 110], shade: 0.6 },
    { c: [200, 180, 124], c2: [192, 160, 124], shade: 0.6 },
    { c: [118, 154, 92], c2: [132, 160, 92], shade: 0.7 },
    { c: [96, 134, 98], c2: [106, 138, 94], shade: 0.95 },
    { c: [150, 168, 122], c2: [160, 170, 118], shade: 0.4 },
    { c: [200, 190, 130], c2: [206, 182, 132], shade: 1.1 },
    { c: [196, 184, 166], c2: [184, 170, 156], shade: 1.1 },
    { c: [240, 236, 222], c2: [228, 226, 216], shade: 1.1 },
  ];
  return { COVER, PIGMENTS };
})();
