// @sys draw/pigments [presentation]: the colours the map is painted in: each land biome's pigments and how the relief's light tells on it, the sea's
// bands and the lake's colour
VB['draw/pigments'] = (() => {
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
  const SEA = [
      [158, 190, 178],
      [118, 160, 162],
      [88, 132, 146],
      [68, 108, 130],
      [56, 90, 116],
    ],
    LAKE = [126, 164, 164];

  return { PIGMENTS, SEA, LAKE };
})();
