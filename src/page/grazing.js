// @sys page/grazing: the Grazing overlay: each grazed tile's pressure (w.graze, sim/grazing) banded from light to overgrazed, with a key
// ---- the Grazing overlay (sim/grazing): where the herds and the deer have grazed ----
// A tile is coloured by its grazing pressure now (sim/grazing grazeOf: w.graze against the year's scale), in cow-hours. The bands end
// where a rule reads the pressure: forest spread keeps land open from GRAZE.keepsOpen and thins its trees from GRAZE.thins (sim/spread),
// and a crowded pasture lowers the milk from HERD.herding.downAt, by `bite` for each downAt over (sim/grazing milkFactor), so the last
// band, overgrazed, starts at twice downAt. Land grazed less than GRAZING_LEAST is left as it is. The bands are measured at most twice
// a second while the overlay is on, and the tiles drawn again only when one's band has changed.
const GRAZING_COLOUR = [0xfcc5c0, 0xfa9fb5, 0xf768a1, 0xc51b8a, 0x7a0177]; // light to overgrazed (the RdPu ramp: apart from the grass)
const GRAZING_LEAST = 1,
  GRAZING_NONE = 255;
let grazingG = null,
  grazingOn = false,
  grazingFor = null,
  grazingAt = -1,
  grazingBand = null;
// The bands' lower edges in cow-hours, lightest first, each with what the rules do from it.
function grazingBands() {
  const { GRAZE } = VB['sim/spread'],
    H = VB['sim/rules'].HERD.herding;
  return [
    { at: GRAZING_LEAST, what: 'lightly grazed' },
    { at: GRAZE.keepsOpen, what: 'kept open: no trees spread onto it' },
    { at: GRAZE.thins, what: 'its trees thinned' },
    { at: H.downAt, what: 'crowded: the milk falls' },
    { at: 2 * H.downAt, what: `overgrazed: ${Math.round(H.bite * 100)}% less milk and more` },
  ];
}
function grazingMeasure(bands) {
  const { grazeOf } = VB['sim/grazing'],
    band = new Uint8Array(w.N).fill(GRAZING_NONE);
  for (let i = 0; i < w.N; i++) {
    if (!(w.graze[i] > 0)) continue;
    const g = grazeOf(st, i);
    let k = -1;
    while (k + 1 < bands.length && g >= bands[k + 1].at) k++;
    if (k >= 0) band[i] = k;
  }
  return band;
}
function drawGrazing() {
  if (!w || !st || !w.graze) return;
  if (!grazingG) {
    grazingG = new PIXI.Graphics();
    L.grazing.addChild(grazingG);
  }
  const bands = grazingBands(),
    band = grazingMeasure(bands);
  grazingAt = time;
  if (grazingFor === w && grazingBand && band.every((b, i) => b === grazingBand[i])) return;
  grazingFor = w;
  grazingBand = band;
  const g = grazingG,
    seen = bands.map(() => 0);
  g.clear();
  for (let k = 0; k < bands.length; k++) {
    for (let i = 0; i < w.N; i++)
      if (band[i] === k) {
        g.poly(hexPoly(i));
        seen[k]++;
      }
    if (seen[k]) g.fill({ color: GRAZING_COLOUR[k], alpha: 0.68 });
  }
  const row = (k) =>
    `<li><i class="rock" style="background:${hex6(GRAZING_COLOUR[k])}"></i>From ${bands[k].at} cow-hour${bands[k].at === 1 ? '' : 's'}: ${bands[k].what}</li>`;
  $('grazingKey').innerHTML =
    '<h2 class="menu-label">Grazing pressure</h2><ul>' +
    (bands.map((b, k) => (seen[k] ? row(k) : '')).join('') || '<li>Nothing grazed yet</li>') +
    '</ul><p>The herds and the deer this past year, halving each year. No colour: not grazed.</p>';
}
function setGrazing(on) {
  grazingOn = on;
  L.grazing.visible = on;
  if (on) drawGrazing();
}
// Each frame while the overlay is on: the pressure is measured again at most twice a second.
function refreshGrazing() {
  if (grazingOn && time - grazingAt >= 0.5) drawGrazing();
}
// A new world: the old one's grazing is wiped, and drawn anew if the overlay is on.
function resetGrazing() {
  grazingFor = null;
  grazingBand = null;
  if (grazingG) grazingG.clear();
  if (grazingOn) drawGrazing();
}
registerOverlay({
  id: 'grazing',
  name: 'Grazing pressure',
  icon: 'grazing',
  group: 'nature',
  set: setGrazing,
  refresh: refreshGrazing,
  reset: resetGrazing,
  layer: L.grazing,
  keyEl: $('grazingKey'),
});
