// @sys gen/biomes: land cover thresholds (the biomes' codes and names are world/biomes', their pigments draw/pigments')
VB['gen/biomes'] = (() => {
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
  return { COVER };
})();
