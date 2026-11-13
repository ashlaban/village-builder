// @sys page/reach: the Reach overlay: land banded by one-way walking hours from the selected tile, with contours and a key
// ---- the Reach overlay (sim/routes): how far a walk is from one place ----
// The land is coloured by the walking time from an origin, by the costs the pawns walk by (terrain, slope, worn paths, fords and
// bridges; unladen, one way). A band ends at an hour the rules compare a walk against, read from the rules so that it follows their
// tuning; a dark line runs where one band meets the next. Land further than the route search goes is grey, land with no way to it
// by land is left as it is. The origin is the tile last selected by a click (a house or a green as well); it is measured again
// every REACH_EVERY seconds, since paths wear and bridges are built, and drawn again only when a tile's band has changed. The lines
// are a drawing of their own, made again when the zoom halves or doubles, so that they stay at least REACH_LINE pixels wide.
const REACH_COLOUR = [0xf0f921, 0xfdb42f, 0xed7953, 0xcc4778, 0x9c179e, 0x5c01a6, 0x0d0887]; // near to far (the plasma ramp)
const REACH_BEYOND = 0x5a5a5a,
  REACH_NONE = 255,
  REACH_EVERY = 2,
  REACH_LINE = 2;
let reachG = null,
  reachLines = null,
  reachZoom = 0,
  reachOn = false,
  reachFrom = -1,
  reachFor = null,
  reachAt = -1,
  reachBand = null,
  reachCost = [];
// The bands' far edges in walking hours, nearest first, each with what the rules or the design hold at it.
function reachBands() {
  const R = VB['sim/rules'],
    raw = [
      [0.25, ''],
      [0.5, ''],
      [1, 'about the next village'],
      [R.BUILD.stoneWalk, 'stone for a house'],
      [R.CLAIMS.farmHours, 'there and back in a day'],
      [R.TRAVEL.dayWalk, "a day's walk"],
      [R.ROUTE.reach / R.SPEED, 'as far as routes go'],
    ].sort((a, b) => a[0] - b[0]),
    out = [];
  for (const [h, what] of raw) {
    const last = out[out.length - 1];
    if (last && h - last.h < 1e-9) last.what = [last.what, what].filter(Boolean).join(', ');
    else out.push({ h, what });
  }
  return out;
}
const reachTime = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${+h.toFixed(1)} h`);
// The band of every tile from `from`: its index in `bands`, bands.length beyond the last edge, REACH_NONE with no way by land.
function reachMeasure(from, bands) {
  const Routes = VB['sim/routes'],
    speed = VB['sim/rules'].SPEED,
    targets = [],
    band = new Uint8Array(w.N).fill(REACH_NONE);
  for (let i = 0; i < w.N; i++) if (Routes.passable(w, i)) targets.push(i);
  reachCost = Routes.reachCosts(w, from, Infinity, targets, reachCost);
  for (let t = 0; t < targets.length; t++) {
    const c = reachCost[t];
    if (c === null) continue;
    let k = 0;
    while (k < bands.length && c / speed > bands[k].h) k++;
    band[targets[t]] = k;
  }
  return band;
}
function reachKey(bands, seen) {
  const row = (colour, text) => `<li><i class="rock" style="background:${hex6(colour)}"></i>${text}</li>`;
  if (reachFrom < 0) {
    $('reachKey').innerHTML = '<h2 class="menu-label">Walking time</h2><p>Click a tile on land to measure from it.</p>';
    return;
  }
  $('reachKey').innerHTML =
    `<h2 class="menu-label">Walking time from tile ${reachFrom % w.COLS}, ${(reachFrom / w.COLS) | 0}</h2><ul>` +
    bands
      .map((b, k) => (seen[k] ? row(REACH_COLOUR[k], `Within ${reachTime(b.h)}${b.what ? `: ${b.what}` : ''}`) : ''))
      .join('') +
    (seen[bands.length] ? row(REACH_BEYOND, 'Further, by land') : '') +
    '</ul><p>One way, on foot. No colour: no way by land.</p>';
}
function drawReach() {
  if (!w) return;
  if (!reachG) {
    reachG = new PIXI.Graphics();
    reachLines = new PIXI.Graphics();
    L.reach.addChild(reachG, reachLines);
  }
  const bands = reachBands().slice(0, REACH_COLOUR.length),
    from = reachFrom >= 0 && reachFrom < w.N ? reachFrom : -1,
    band = from >= 0 ? reachMeasure(from, bands) : null;
  reachAt = time;
  if (band && reachFor === w && reachBand && band.every((b, i) => b === reachBand[i])) return;
  const g = reachG,
    seen = bands.map(() => 0).concat(0);
  g.clear();
  reachLines.clear();
  reachFor = w;
  reachBand = band;
  if (!band) {
    reachFrom = -1;
    reachKey(bands, seen);
    return;
  }
  for (let k = 0; k <= bands.length; k++) {
    for (let i = 0; i < w.N; i++)
      if (band[i] === k) {
        g.poly(hexPoly(i));
        seen[k]++;
      }
    if (seen[k]) g.fill({ color: k < bands.length ? REACH_COLOUR[k] : REACH_BEYOND, alpha: 0.62 });
  }
  drawReachLines();
  reachKey(bands, seen);
}
// The contours: each edge between a tile and a neighbour of a further band, drawn once, from the nearer side; and a ring at the origin.
const reachZoomStep = () => Math.round(Math.log2(cam.z));
function drawReachLines() {
  const g = reachLines,
    band = reachBand,
    from = reachFrom,
    px = Math.max(w.R * 0.2, REACH_LINE / cam.z);
  g.clear();
  reachZoom = reachZoomStep();
  if (!band) return;
  let lines = 0;
  for (let i = 0; i < w.N; i++) {
    if (band[i] === REACH_NONE) continue;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0 || band[j] === REACH_NONE || band[j] <= band[i]) continue;
      edge(g, i, d);
      lines++;
    }
  }
  if (lines) g.stroke({ width: px, color: 0x1a0c2a, alpha: 0.9, cap: 'round' });
  g.circle(w.hx[from], w.hy[from], w.R * 0.75).stroke({ width: px * 1.6, color: 0x1a0c2a });
  g.circle(w.hx[from], w.hy[from], w.R * 0.75).stroke({ width: px * 0.7, color: 0xffffff });
}
// The tile a click selected, if a walk can start there: land, a house or a green; a selected person keeps the origin as it is.
function reachPick() {
  return selectionPinned && selPawn < 0 && sel >= 0 && sel < w.N && VB['sim/routes'].passable(w, sel) ? sel : -1;
}
function setReach(on) {
  reachOn = on;
  L.reach.visible = on;
  $('reachKey').hidden = !on;
  if (!on || !w) return;
  const pick = reachPick();
  if (pick >= 0) reachFrom = pick;
  reachBand = null;
  drawReach();
}
// Each frame while the overlay is on: a newly selected tile is measured from at once, the same one again every REACH_EVERY seconds.
function refreshReach() {
  if (!reachOn || !w) return;
  const pick = reachPick();
  if (pick >= 0 && pick !== reachFrom) {
    reachFrom = pick;
    drawReach();
  } else if (reachFrom >= 0 && time - reachAt >= REACH_EVERY) drawReach();
  if (reachBand && reachZoomStep() !== reachZoom) drawReachLines();
}
// A new world: the old one's reach is wiped, and its origin forgotten.
function resetReach() {
  reachFrom = -1;
  reachBand = null;
  reachFor = null;
  if (reachG) {
    reachG.clear();
    reachLines.clear();
  }
  if (reachOn) drawReach();
}
