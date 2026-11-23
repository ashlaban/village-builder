// @sys page/wear: the Wear overlay: the crossings on foot of each tile (w.wear, sim/paths) on a ramp, its stage (w.worn) told apart, with a key
// ---- the Wear overlay (sim/paths): where the village walks ----
// A tile is coloured by its crossings (w.wear, fading by half each game year). Three band edges are the stages' (PATHS.at, read by
// sim/paths stageOf): trodden ground, a path and a lane; one band under trodden ground shows the first tracks and one over the lane the
// busiest ways. A tile keeps its stage until its count falls well below the edge (PATHS.keep), so a tile is drawn in the band of its
// stage (w.worn) at the least: the colour of a stage is the stage. Land never crossed is left as it is. The bands are measured at most
// twice a second while the overlay is on, and the tiles drawn again only when one's band has changed.
const WEAR_COLOUR = [0xfde725, 0x7ad151, 0x22a884, 0x2a788e, 0x414487, 0x440154]; // few crossings to the busiest lane (viridis)
const WEAR_NONE = 255;
let wearG = null,
  wearOn = false,
  wearFor = null,
  wearAt = -1,
  wearBand = null;
// The bands' lower edges in crossings, fewest first; `stage` is the w.worn stage that begins there.
function wearBands() {
  const { at } = VB['sim/walking'].PATHS;
  return [
    { at: 1, what: 'a few' },
    { at: Math.round(at[1] / 4), what: 'a track' },
    { at: at[1], what: 'trodden ground', stage: 1 },
    { at: at[2], what: 'a path', stage: 2 },
    { at: at[3], what: 'a lane', stage: 3 },
    { at: 4 * at[3], what: 'a busy lane' },
  ];
}
// The crossings a day that keep a count at `n`, as it halves each game year (design.md, Worn paths, 2).
const wearPerDay = (n) => (n * Math.LN2) / VB['sim/walking'].PATHS.halfLifeDays;
function wearMeasure(bands) {
  const band = new Uint8Array(w.N).fill(WEAR_NONE),
    ofStage = [-1, ...[1, 2, 3].map((s) => bands.findIndex((b) => b.stage === s))];
  for (let i = 0; i < w.N; i++) {
    const n = w.wear[i];
    if (!(n > 0) && !w.worn[i]) continue;
    let k = -1;
    while (k + 1 < bands.length && n >= bands[k + 1].at) k++;
    k = Math.max(k, ofStage[w.worn[i]]);
    if (k >= 0) band[i] = k;
  }
  return band;
}
function drawWear() {
  if (!w || !w.wear) return;
  if (!wearG) {
    wearG = new PIXI.Graphics();
    L.wear.addChild(wearG);
  }
  const bands = wearBands(),
    band = wearMeasure(bands);
  wearAt = time;
  if (wearFor === w && wearBand && band.every((b, i) => b === wearBand[i])) return;
  wearFor = w;
  wearBand = band;
  const g = wearG,
    seen = bands.map(() => 0);
  g.clear();
  for (let k = 0; k < bands.length; k++) {
    for (let i = 0; i < w.N; i++)
      if (band[i] === k) {
        g.poly(hexPoly(i));
        seen[k]++;
      }
    if (seen[k]) g.fill({ color: WEAR_COLOUR[k], alpha: 0.7 });
  }
  const row = (b, k) => {
    const day = wearPerDay(b.at),
      kept = b.stage ? `, about ${day < 1.5 ? Math.round(day * 2) / 2 : Math.round(day)} a day kept up` : '';
    return (
      `<li><i class="rock" style="background:${hex6(WEAR_COLOUR[k])}"></i><span>` +
      `${b.stage ? `${b.what[0].toUpperCase() + b.what.slice(1)} from` : 'From'} ${b.at} crossing${b.at === 1 ? '' : 's'}` +
      `${b.stage ? kept : `: ${b.what}`}</span></li>`
    );
  };
  $('wearKey').innerHTML =
    '<h2 class="menu-label">Wear on foot</h2><ul>' +
    (bands.map((b, k) => (seen[k] ? row(b, k) : '')).join('') || '<li>No one has walked yet</li>') +
    '</ul><p>Crossings by people and their herds, halving each year. No colour: not crossed.</p>';
}
function setWear(on) {
  wearOn = on;
  L.wear.visible = on;
  if (on) drawWear();
}
// Each frame while the overlay is on: the wear is measured again at most twice a second.
function refreshWear() {
  if (wearOn && time - wearAt >= 0.5) drawWear();
}
// A new world: the old one's wear is wiped, and drawn anew if the overlay is on.
function resetWear() {
  wearFor = null;
  wearBand = null;
  if (wearG) wearG.clear();
  if (wearOn) drawWear();
}
registerOverlay({
  id: 'wear',
  name: 'Wear',
  icon: 'wear',
  group: 'ways',
  set: setWear,
  refresh: refreshWear,
  reset: resetWear,
  layer: L.wear,
  keyEl: $('wearKey'),
});
