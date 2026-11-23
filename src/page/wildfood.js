// @sys page/wildfood: the Wild food overlay: the forage stock of forest and heath tiles and the fish stock of river and lake tiles, banded 0 to 1
// ---- the Wild food overlay (sim/forage, sim/fish): what is left to gather and to catch ----
// A forest or heath tile is tinted by its stock of berries, mushrooms and nuts (one ramp, RdPu, pale to dark); a river or lake tile gets a
// disc in its fish stock's colour (another ramp, Blues), so that a wooded river tile shows both. Each stock is read through its module's
// own reading of it today (sim/forage stock, sim/fish stock), never worked out here; the sea is not shown (it does not run down), nor
// any tile with neither. The first band ends at a trip's least (FORAGE.least, FISH.least), read from the rules. The bands are worked out
// again at most twice a second, and the tiles drawn again only when one has changed; a new world wipes them. bandFill: page/woodland.
const FORAGE_COLOUR = [0xfeebe2, 0xfbb4b9, 0xf768a1, 0xae017e], // empty to full (RdPu)
  FISH_COLOUR = [0xeff3ff, 0xbdd7e7, 0x6baed6, 0x2171b5]; // empty to full (Blues)
let wildG = null,
  wildOn = false,
  wildFor = null,
  wildAt = -1,
  wildBand = null; // the forage bands, then the fish bands, w.N each
const wildBandOf = (s, least) => (s < least - 1e-6 ? 0 : s < 0.5 ? 1 : s < 1 - 1e-6 ? 2 : 3);
const pct = (x) => `${Math.round(x * 100)}%`;
const wildRows = (least) => [
  `Too little for a trip: under ${pct(least)} of full`,
  `Low: ${pct(least)} to half`,
  'Some taken: over half',
  'Full',
];
function drawWildFood() {
  if (!w || !st || !w.forage || !w.fish) return;
  const Fo = VB['sim/forage'],
    Fi = VB['sim/fish'],
    fishLeast = VB['sim/rules'].FISH.least,
    N = w.N,
    band = new Uint8Array(2 * N).fill(BAND_NONE);
  for (let i = 0; i < N; i++) {
    if (Fo.wild(w, i)) band[i] = wildBandOf(Fo.stock(st, i), Fo.FORAGE.least);
    if (w.river[i] > 0 || (w.water[i] === 1 && !w.ocean[i])) band[N + i] = wildBandOf(Fi.stock(st, i), fishLeast);
  }
  wildAt = time;
  if (wildFor === w && wildBand && band.every((b, i) => b === wildBand[i])) return;
  if (!wildG) {
    wildG = new PIXI.Graphics();
    L.wildfood.addChild(wildG);
  }
  wildG.clear();
  wildFor = w;
  wildBand = band;
  const forage = bandFill(wildG, band.subarray(0, N), FORAGE_COLOUR, 0),
    fish = bandFill(wildG, band.subarray(N), FISH_COLOUR, 0.42),
    rows = (seen, colours, cls, least) =>
      wildRows(least)
        .map((t, k) => (seen[k] ? bandKeyRow(cls, colours[k], t) : ''))
        .join('') || '<li>None on this map</li>';
  $('wildfoodKey').innerHTML =
    '<h2 class="menu-label">Berries, mushrooms and nuts (woods, heath)</h2><ul>' +
    rows(forage, FORAGE_COLOUR, 'rock', Fo.FORAGE.least) +
    '</ul><h2 class="menu-label">Fish (rivers, lakes)</h2><ul>' +
    rows(fish, FISH_COLOUR, 'ore', fishLeast) +
    '</ul>';
}
function setWildFood(on) {
  wildOn = on;
  L.wildfood.visible = on;
  if (on) drawWildFood();
}
// Each frame while the overlay is on: a trip or a day's recovery is looked for at most twice a second.
function refreshWildFood() {
  if (wildOn && time - wildAt >= 0.5) drawWildFood();
}
function resetWildFood() {
  wildFor = null;
  wildBand = null;
  if (wildG) wildG.clear();
  if (wildOn) drawWildFood();
}
registerOverlay({
  id: 'wildfood',
  name: 'Wild food',
  icon: 'wildfood',
  group: 'nature',
  set: setWildFood,
  refresh: refreshWildFood,
  reset: resetWildFood,
  layer: L.wildfood,
  keyEl: $('wildfoodKey'),
});
