// @sys page/woodland: the Woodland overlay: each wooded tile banded by the trees standing as a share of its full cover, so that felling and regrowth show
// ---- the Woodland overlay (sim/forest): what is left of the woods ----
// A tile that can carry trees (w.treesMax above 0) is tinted by w.trees against w.treesMax, from bare to full cover, on one ramp (YlGn,
// pale to dark green); any other tile is left as it is. The bands are worked out again at most twice a second and the tiles drawn again
// only when a band has changed; a new world wipes them.
// bandFill and bandKeyRow are shared with page/wildfood: a band's tiles are filled in one batch, its count kept for the key.
const WOOD_COLOUR = [0xffffcc, 0xc2e699, 0x78c679, 0x31a354, 0x006837]; // bare to full (YlGn)
const WOOD_BANDS = [
  'Bare: no tree standing',
  'Thinned hard: under a third standing',
  'Thinned: a third to two thirds',
  'Nearly full: over two thirds',
  'Full cover',
];
const BAND_NONE = 255,
  BAND_ALPHA = 0.62;
let woodG = null,
  woodOn = false,
  woodFor = null,
  woodAt = -1,
  woodBand = null;
// Fill each tile whose band is k in colours[k] (a disc of `disc` tile radii, or the whole hex with none); the tiles counted by band.
function bandFill(g, band, colours, disc) {
  const seen = colours.map(() => 0);
  for (let k = 0; k < colours.length; k++) {
    for (let i = 0; i < band.length; i++)
      if (band[i] === k) {
        if (disc) g.circle(w.hx[i], w.hy[i], w.R * disc);
        else g.poly(hexPoly(i));
        seen[k]++;
      }
    if (seen[k])
      disc
        ? g.fill({ color: colours[k], alpha: 0.9 }).stroke({ width: w.R * 0.08, color: 0x10283c, alpha: 0.8 })
        : g.fill({ color: colours[k], alpha: BAND_ALPHA });
  }
  return seen;
}
const bandKeyRow = (cls, colour, text) => `<li><i class="${cls}" style="background:${hex6(colour)}"></i>${text}</li>`;
// The band of a tile's trees: 0 bare, 4 full, BAND_NONE where no tree grows.
function woodBandOf(i) {
  const max = w.treesMax[i];
  if (!(max > 0)) return BAND_NONE;
  const s = w.trees[i] / max;
  return s <= 0 ? 0 : s >= 1 ? 4 : s < 1 / 3 ? 1 : s < 2 / 3 ? 2 : 3;
}
function drawWoodland() {
  if (!w || !w.treesMax) return;
  const band = new Uint8Array(w.N);
  for (let i = 0; i < w.N; i++) band[i] = woodBandOf(i);
  woodAt = time;
  if (woodFor === w && woodBand && band.every((b, i) => b === woodBand[i])) return;
  if (!woodG) {
    woodG = new PIXI.Graphics();
    L.woodland.addChild(woodG);
  }
  woodG.clear();
  woodFor = w;
  woodBand = band;
  const seen = bandFill(woodG, band, WOOD_COLOUR, 0);
  $('woodlandKey').innerHTML =
    '<h2 class="menu-label">Trees standing, of full cover</h2><ul>' +
    (WOOD_BANDS.map((t, k) => (seen[k] ? bandKeyRow('rock', WOOD_COLOUR[k], t) : '')).join('') ||
      '<li>No woodland on this map</li>') +
    '</ul>';
}
function setWoodland(on) {
  woodOn = on;
  L.woodland.visible = on;
  if (on) drawWoodland();
}
// Each frame while the overlay is on: felling and regrowth are looked for at most twice a second.
function refreshWoodland() {
  if (woodOn && time - woodAt >= 0.5) drawWoodland();
}
function resetWoodland() {
  woodFor = null;
  woodBand = null;
  if (woodG) woodG.clear();
  if (woodOn) drawWoodland();
}
registerOverlay({
  id: 'woodland',
  name: 'Woodland',
  icon: 'woodland',
  group: 'nature',
  set: setWoodland,
  refresh: refreshWoodland,
  reset: resetWoodland,
  layer: L.woodland,
  keyEl: $('woodlandKey'),
});
