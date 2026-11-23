// @sys page/fertility: the Fertility overlay: each farmable tile banded by its fertility as a field (sim/crops), with a key of the bands
// ---- the Fertility overlay (sim/crops): how good a tile is as a field ----
// Each tile a field can be made on is tinted by `fertility(w, i)` of sim/crops, one band for each distinct value the map has; land no
// field can be made on is left as it is. The value is read from sim/crops, never copied: its biome's FERTILITY, more by RIVER.irrigation
// with a river beside it. The tint is a place on one ramp (viridis, poor to good) by the value's place between the poorest and the best
// a field can have under the rules, so that a band keeps its colour from one map to the next. Fertility changes only with the land (a
// new world, the editor), so the tiles' kinds are looked at at most twice a second and the overlay drawn again only when one changed.
const FERTILITY_RAMP = [0x440154, 0x46327e, 0x365c8d, 0x277f8e, 0x1fa187, 0x4ac16d, 0xa0da39, 0xfde725]; // poor to good (viridis)
let fertilityG = null,
  fertilityOn = false,
  fertilityFor = null,
  fertilityKind = null,
  fertilityAt = -1;
// A tile's kind as fertility sees it: its biome and whether a river waters it, or 255 where no field can be made.
function fertilityKinds() {
  const C = VB['sim/crops'],
    kind = new Uint8Array(w.N);
  for (let i = 0; i < w.N; i++) kind[i] = C.farmable(w, i) ? w.biome[i] * 2 + (C.byRiver(w, i) ? 1 : 0) : 255;
  return kind;
}
// The ramp's colour at t in 0..1, between its stops.
function fertilityColour(t) {
  const n = FERTILITY_RAMP.length - 1,
    x = Math.max(0, Math.min(1, t)) * n,
    k = Math.min(n - 1, Math.floor(x)),
    f = x - k,
    a = FERTILITY_RAMP[k],
    b = FERTILITY_RAMP[k + 1],
    mix = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f) << s;
  return mix(16) | mix(8) | mix(0);
}
const fertilityNumber = (v) => Math.round(v * 100); // as the plan's tile line gives it: open meadow is 100
function drawFertility() {
  if (!w) return;
  const kind = fertilityKinds();
  fertilityAt = time;
  if (fertilityFor === w && fertilityKind && kind.every((k, i) => k === fertilityKind[i])) return;
  if (!fertilityG) {
    fertilityG = new PIXI.Graphics();
    L.fertility.addChild(fertilityG);
  }
  const C = VB['sim/crops'],
    g = fertilityG,
    all = Object.values(C.FERTILITY),
    lo = Math.min(...all),
    hi = Math.max(...all) * (1 + C.RIVER.irrigation),
    bands = new Map(); // fertility -> {tiles, kinds}
  fertilityFor = w;
  fertilityKind = kind;
  g.clear();
  for (let i = 0; i < w.N; i++) {
    if (kind[i] === 255) continue;
    const v = C.fertility(w, i);
    let b = bands.get(v);
    if (!b) bands.set(v, (b = { tiles: [], kinds: new Set() }));
    b.tiles.push(i);
    b.kinds.add(kind[i]);
  }
  const order = [...bands.keys()].sort((a, b) => b - a),
    colour = (v) => fertilityColour(hi > lo ? (v - lo) / (hi - lo) : 1);
  for (const v of order) {
    for (const i of bands.get(v).tiles) g.poly(hexPoly(i));
    g.fill({ color: colour(v), alpha: 0.62 });
  }
  // the key: the bands present, best first, each with the biomes (and river) that give it
  const what = (k) => G.BIOMES[k >> 1].name + (k & 1 ? ' by a river' : ''),
    row = (v, k) =>
      `<li><i class="rock" style="background:${hex6(colour(v))}"></i>${fertilityNumber(v)}: ${[...bands.get(v).kinds]
        .sort((a, b) => a - b)
        .map(what)
        .join(
          ', ',
        )}${k === 0 && order.length > 1 ? ' (best)' : k === order.length - 1 && k > 0 ? ' (poorest)' : ''}</li>`,
    unfarmed = G.BIOMES.filter((b, k) => !b.water && C.FERTILITY[k] === undefined).map((b) => b.name);
  $('fertilityKey').innerHTML =
    '<h2 class="menu-label">Fertility as a field</h2>' +
    (order.length ? '<ul>' + order.map(row).join('') + '</ul>' : '<p>No land on this map can be farmed.</p>') +
    `<p>What a field yields, open meadow 100. A river beside a field adds ${Math.round(C.RIVER.irrigation * 100)}%.</p>` +
    `<p>No colour: no field can be made there (a river${unfarmed.length ? ', ' + unfarmed.join(', ').toLowerCase() : ''}).</p>`;
}
function setFertility(on) {
  fertilityOn = on;
  L.fertility.visible = on;
  if (on) drawFertility();
}
// Each frame while the overlay is on: an edited tile is looked for at most twice a second.
function refreshFertility() {
  if (fertilityOn && time - fertilityAt >= 0.5) drawFertility();
}
// A new world: the old one's fertility is wiped, and drawn anew if the overlay is on.
function resetFertility() {
  fertilityFor = null;
  fertilityKind = null;
  if (fertilityG) fertilityG.clear();
  if (fertilityOn) drawFertility();
}
registerOverlay({
  id: 'fertility',
  name: 'Fertility',
  icon: 'fertility',
  group: 'nature',
  set: setFertility,
  refresh: refreshFertility,
  reset: resetFertility,
  layer: L.fertility,
  keyEl: $('fertilityKey'),
});
