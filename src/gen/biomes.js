// @sys gen/biomes: land cover thresholds (the biomes' codes and names are world/biomes', their pigments draw/pigments')
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
  return { COVER };
})();
