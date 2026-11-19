// @sys page/look: a pawn's look: its colours and headgear from its `look` seed, and how its hair greys with age; the same on the map
// and in its portrait (VB-1030)
// ======== a pawn's look ========
// Clothing after medieval Swedish peasant dress: wool kirtles in undyed or plant-dyed colours, hose and turnshoes,
// hoods for men, a linen headcloth for married women and loose braided hair with a band for unmarried ones.
const DYES = [
  [240, 230, 204],
  [200, 150, 84],
  [186, 62, 44],
  [70, 100, 140],
  [222, 178, 70],
  [112, 140, 84],
  [150, 70, 60],
  [226, 196, 140],
];
const HOSE = [
  [120, 96, 72],
  [70, 96, 130],
  [150, 70, 52],
  [104, 124, 84],
  [190, 160, 110],
];
const SKINS = [
  [242, 208, 182],
  [232, 194, 164],
  [220, 180, 150],
];
const HAIRS = [
  [232, 206, 142],
  [206, 164, 100],
  [158, 112, 66],
  [110, 78, 52],
  [76, 58, 44],
];
const LINEN = [242, 238, 226];
const GREY = [218, 216, 210]; // hair gone grey (VB-1029)
const hex = (c, f = 1) =>
  ((Math.min(255, c[0] * f) << 16) | (Math.min(255, c[1] * f) << 8) | Math.min(255, c[2] * f)) >>> 0;
// A pawn's colours and headgear, from its `look` seed: the same on the map and in its portrait.
function lookOf(p) {
  const r = G.mulberry32(p.look),
    pick = (a) => a[(r() * a.length) | 0];
  return {
    cloth: pick(DYES),
    cloth2: pick(DYES),
    hose: pick(HOSE),
    skin: pick(SKINS),
    hair: pick(HAIRS),
    beard: p.sex === 'm' && r() < 0.6,
    hood: p.sex === 'm' && r() < 0.45,
    hoodCol: pick(DYES),
    greyFrom: 38 + r() * 14, // the age its hair begins to grey (drawn last: the picks before it stay as they were)
  };
}
// How a look has aged (VB-1029): hair greys in three steps of six years from the pawn's own age for it, to grey; a beard comes at 18.
// {grey (0 to 3), hair (the colour now), beard}: the same on the map and in the portrait.
const GREY_STEP = 6;
function agedLook(look, age) {
  const grey = age < look.greyFrom ? 0 : Math.min(3, 1 + Math.floor((age - look.greyFrom) / GREY_STEP)),
    f = grey / 3;
  return { grey, hair: look.hair.map((v, i) => Math.round(v + (GREY[i] - v) * f)), beard: look.beard && age >= 18 };
}
