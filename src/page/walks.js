// @sys page/walks: the Walks map mode (VB-2042): the walks set out on since it was switched on (sim/legs listenWalks), as a heat map finer than a tile
// ---- the Walks overlay: where the people actually walk ----
// While the mode is on, sim/legs gives each walk's points (the route's tiles as the pawn walks through them, its gate and its yard) to
// walkSeen, which draws the walk into a raster of the whole map: a cell a fifth of a hex's radius (a T world's whole map 6.4 MB),
// each cell counted once a walk. The counts halve each game year (PATHS.halfLifeDays), as wear does: a walk is added at the weight
// 2^(days since `base` / half-life) and read back at 2^-(days since `base` / half-life), so nothing is touched to fade it; `base` is moved up (every count scaled down) once the
// weights grow large. The raster is kept in chunks of WALK_CHUNK cells square, made only where a walk has passed, each with its canvas
// and sprite, so a world's memory is that of the land walked over, at most WALK_BYTES (a walk past it is not drawn where no chunk is left).
// Off, nothing is kept: the listener is cleared (sim/legs does one check of it) and the raster dropped, so switching it on starts afresh.
// A cell is the more opaque the more it is walked, so that the land under a few walks still shows. Drawn at most twice a second, the
// chunks a walk has touched since; all of them when the ramp's top or the fading has moved on.
const WALK_CHUNK = 64,
  WALK_BYTES = 8 << 20,
  WALK_CHUNK_BYTES = WALK_CHUNK * WALK_CHUNK * 8, // its counts (Float32) and its canvas (RGBA)
  WALK_STOPS = [
    [0, [40, 11, 84]],
    [0.25, [101, 21, 110]],
    [0.45, [178, 50, 90]],
    [0.65, [229, 92, 48]],
    [0.82, [248, 161, 28]],
    [1, [252, 255, 164]],
  ]; // inferno, as the mock's (docs/mocks/roads/heat.py), its darkest end left out so that one walk shows on dark land
let walksOn = false,
  walksAt = -1,
  walks = null; // { S, x0, y0, CW, CH, chunks, made, base, from, top, fade, n, seen, full }
// The colour of the ramp at t in 0..1, as [r, g, b].
function walkRamp(t) {
  for (let k = 1; k < WALK_STOPS.length; k++) {
    const [b, cb] = WALK_STOPS[k];
    if (t <= b || k === WALK_STOPS.length - 1) {
      const [a, ca] = WALK_STOPS[k - 1],
        u = Math.max(0, Math.min(1, (t - a) / (b - a)));
      return ca.map((c, i) => Math.round(c + (cb[i] - c) * u));
    }
  }
}
const walkDay = () => st.t / VB['sim/rules'].DAY;
// The weight a walk is added at today, against `base`.
const walkWeight = (r) => 2 ** ((walkDay() - r.base) / VB['sim/walking'].PATHS.halfLifeDays);
function walkRaster() {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < w.N; i++) {
    x0 = Math.min(x0, w.hx[i]);
    x1 = Math.max(x1, w.hx[i]);
    y0 = Math.min(y0, w.hy[i]);
    y1 = Math.max(y1, w.hy[i]);
  }
  const S = w.R / 5,
    side = WALK_CHUNK * S;
  x0 -= w.R;
  y0 -= w.R;
  const CW = Math.ceil((x1 + w.R - x0) / side),
    CH = Math.ceil((y1 + w.R - y0) / side);
  return {
    S,
    x0,
    y0,
    CW,
    CH,
    chunks: new Array(CW * CH).fill(null),
    made: 0,
    base: walkDay(),
    from: walkDay(),
    top: 10,
    fade: 1,
    n: 0,
    seen: new Set(),
    full: false,
  };
}
function walkChunk(r, k) {
  if (r.chunks[k]) return r.chunks[k];
  if ((r.made + 1) * WALK_CHUNK_BYTES > WALK_BYTES) return null;
  const canvas = makeCanvas(WALK_CHUNK, WALK_CHUNK),
    tex = texFrom(canvas, { scaleMode: 'nearest' }), // nearest: no seam where two chunks meet
    spr = new PIXI.Sprite(tex);
  spr.x = r.x0 + (k % r.CW) * WALK_CHUNK * r.S;
  spr.y = r.y0 + Math.floor(k / r.CW) * WALK_CHUNK * r.S;
  spr.scale.set(r.S);
  L.walks.addChild(spr);
  r.made++;
  return (r.chunks[k] = { n: new Float32Array(WALK_CHUNK * WALK_CHUNK), canvas, tex, spr, dirty: true });
}
// sim/legs' listener: one walk's points, each cell it passes counted once.
function walkSeen(pts) {
  const r = walks;
  if (!r) return;
  const S = r.S,
    GW = r.CW * WALK_CHUNK,
    GH = r.CH * WALK_CHUNK,
    seen = r.seen,
    wt = walkWeight(r);
  seen.clear();
  for (let k = 1; k < pts.length; k++) {
    const ax = pts[k - 1][0],
      ay = pts[k - 1][1],
      dx = pts[k][0] - ax,
      dy = pts[k][1] - ay,
      n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (S * 0.5)));
    for (let s = k === 1 ? 0 : 1; s <= n; s++) {
      const gx = Math.floor((ax + (dx * s) / n - r.x0) / S),
        gy = Math.floor((ay + (dy * s) / n - r.y0) / S);
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const c = gy * GW + gx;
      if (seen.has(c)) continue;
      seen.add(c);
      const ch = walkChunk(r, Math.floor(gy / WALK_CHUNK) * r.CW + Math.floor(gx / WALK_CHUNK));
      if (!ch) {
        r.full = true;
        continue;
      }
      ch.n[(gy % WALK_CHUNK) * WALK_CHUNK + (gx % WALK_CHUNK)] += wt;
      ch.dirty = true;
    }
  }
  r.n++;
}
function walkPaint(r, ch, fade, lt) {
  const g = ch.canvas.getContext('2d'),
    img = g.createImageData(WALK_CHUNK, WALK_CHUNK),
    px = img.data;
  for (let c = 0; c < ch.n.length; c++) {
    const v = ch.n[c] * fade;
    if (!(v > 0)) continue;
    const [cr, cg, cb] = walkRamp(v <= 1 ? 0 : Math.log10(v) / lt);
    px[4 * c] = cr;
    px[4 * c + 1] = cg;
    px[4 * c + 2] = cb;
    const t = v <= 1 ? 0 : Math.min(1, Math.log10(v) / lt);
    px[4 * c + 3] = Math.round(255 * (0.15 + 0.75 * t ** 1.5) * (v >= 1 ? 1 : Math.max(0.5, v)));
  }
  g.putImageData(img, 0, 0);
  ch.tex.source.update();
  ch.dirty = false;
}
function drawWalks() {
  const r = walks;
  walksAt = time;
  if (!r) return;
  const H = VB['sim/walking'].PATHS.halfLifeDays;
  // the weights grown past 2^16: every count scaled down to today's, `base` moved up to today
  if (walkDay() - r.base > 16 * H) {
    const k = 2 ** -((walkDay() - r.base) / H);
    for (const ch of r.chunks) if (ch) ch.n.forEach((v, i) => (ch.n[i] = v * k));
    r.base = walkDay();
  }
  const fade = 2 ** -((walkDay() - r.base) / H);
  let max = 0;
  for (const ch of r.chunks) if (ch) for (const v of ch.n) if (v > max) max = v;
  const top = Math.max(10, 10 ** Math.ceil(Math.log10(Math.max(1, max * fade)) - 1e-9)),
    all = top !== r.top || Math.abs(fade / r.fade - 1) > 0.02;
  if (all) {
    r.top = top;
    r.fade = fade;
  }
  const lt = Math.log10(r.top);
  for (const ch of r.chunks) if (ch && (all || ch.dirty)) walkPaint(r, ch, r.fade, lt);
  walksKey(r);
}
// The key: the ramp with its counts (1, 10, 100, ...) and the game days collected; the words are in the titles, a tap away.
function walksKey(r) {
  const days = Math.floor(walkDay() - r.from),
    marks = [];
  for (let v = 1; v <= r.top; v *= 10) marks.push(v);
  const stops = WALK_STOPS.map(([t]) => `rgb(${walkRamp(t).join(',')}) ${Math.round(t * 100)}%`).join(', ');
  $('walksKey').innerHTML =
    `<h2 class="menu-label">${ICON.walks} Walks</h2>` +
    `<div class="walks-ramp" title="Walks through a spot, on a log scale" style="height:10px;border-radius:3px;` +
    `background:linear-gradient(to right, ${stops})"></div>` +
    `<div class="walks-marks" style="display:flex;justify-content:space-between">${marks.map((v) => `<span>${v}</span>`).join('')}</div>` +
    `<div title="Game days collected since the mode was switched on, halving each year">` +
    `<span id="walksDays">${days}</span> d · <span id="walksN" title="Walks drawn">${r.n}</span>` +
    `${r.full ? ' <span title="The raster is full: walks over new land are not drawn">!</span>' : ''}</div>`;
}
function dropWalks() {
  VB['sim/legs'].listenWalks(null);
  if (walks) for (const ch of walks.chunks) if (ch) ch.spr.destroy({ texture: true, textureSource: true });
  L.walks.removeChildren();
  walks = null;
}
function startWalks() {
  dropWalks();
  if (!w || !st) return;
  walks = walkRaster();
  VB['sim/legs'].listenWalks(walkSeen);
  drawWalks();
}
function setWalks(on) {
  walksOn = on;
  L.walks.visible = on;
  if (on) startWalks();
  else dropWalks();
}
// Each frame while the overlay is on: drawn again at most twice a second.
function refreshWalks() {
  if (walksOn && time - walksAt >= 0.5) drawWalks();
}
// A new world: what was collected on the old one is dropped; collecting starts afresh if the mode is on.
function resetWalks() {
  if (walksOn) startWalks();
  else dropWalks();
}
registerOverlay({
  id: 'walks',
  name: 'Walks',
  icon: 'walks',
  group: 'ways',
  set: setWalks,
  refresh: refreshWalks,
  reset: resetWalks,
  layer: L.walks,
  keyEl: $('walksKey'),
});
