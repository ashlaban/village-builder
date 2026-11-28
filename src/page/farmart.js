// @sys page/farmart: farmstead art after medieval Swedish building, as a church mural: buildings, well sweep, yard (field and beasts: stookart, beastart)
// ======== farmstead art, after medieval Swedish building, in the manner of a painted church vault of the 1400s ========
// A heavy dark contour round flat ochre, red oxide and green earth, with ordered ornament; few bold shapes, so that a farm reads at the
// map's size. Nothing a medieval farm did not have: unpainted log buildings, turf roofs on birch bark with a smoke hole (ljore) and no
// chimney, a storehouse on posts (härbre) under split shingles, a gapped barn (lada) under straw thatch held by crossed ridge poles,
// a woodpile, the village well sweep (brunnsvinge), sheaf stooks (skylar) and a roundpole fence (gärdesgård) round the infields.
// ARTK texels per unit of the art's own grid (a quarter of a world unit at the buildings' scale), so that lines stay crisp on a dense screen.
const ARTK = 2;
const MP = {
  line: '#2c201c',
  lw: 2,
  logs: [
    [222, 172, 88],
    [210, 156, 78],
    [230, 184, 102],
  ],
  logEnd: [242, 222, 172],
  barn: [204, 154, 88],
  turf: [
    [122, 162, 88],
    [108, 150, 92],
    [134, 168, 84],
  ],
  turfDk: [72, 108, 64],
  turfHi: [170, 194, 114],
  bark: [244, 236, 212],
  eave: [150, 70, 48],
  frame: [160, 72, 50],
  door: [186, 92, 62],
  iron: [44, 36, 34],
  board: [224, 184, 108],
  post: [150, 70, 48],
  shingle: [200, 188, 160],
  shingleDk: [120, 104, 84],
  thatch: [236, 196, 100],
  thatchDk: [180, 128, 58],
  stone: [218, 210, 194],
  dark: [48, 36, 32],
  water: [70, 104, 134],
  straw: [232, 198, 106],
  hay: [206, 190, 108],
  hayDk: [150, 132, 64],
  dung: [96, 66, 46],
  flowers: [
    [250, 246, 232],
    [232, 190, 70],
    [190, 64, 46],
    [250, 246, 232],
  ],
};
// A canvas of w by h art units and its brushes. `ink` paints the current path, colour and contour; `under` lays the contour of a whole
// figure first, so that parts filled over it share one outline with no lines inside.
function artKit(w, h, seed) {
  const c = makeCanvas(w * ARTK, h * ARTK),
    g = c.getContext('2d'),
    r = Noise.mulberry32(seed);
  c.artK = ARTK;
  g.scale(ARTK, ARTK);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const col = (c3, f = 1) => `rgb(${c3.map((v) => Math.max(0, Math.min(255, v * f)) | 0)})`;
  const jit = (c3, a = 0.03) => {
    const f = 1 - a + r() * 2 * a;
    return c3.map((v) => v * f);
  };
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo'](x, y));
    g.closePath();
  };
  const ink = (c3, lw = 1) => {
    g.fillStyle = col(c3);
    g.fill();
    if (lw) {
      g.strokeStyle = MP.line;
      g.lineWidth = lw * MP.lw;
      g.stroke();
    }
  };
  const line = (c3, lw, alpha = 1) => {
    g.globalAlpha = alpha;
    g.strokeStyle = col(c3);
    g.lineWidth = lw;
    g.stroke();
    g.globalAlpha = 1;
  };
  // a pole or rope from one point to another, with its contour
  const pole = (x0, y0, x1, y1, c3, wd) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokeStyle = MP.line;
    g.lineWidth = wd + 1.5;
    g.stroke();
    line(c3, wd);
  };
  const under = (shapes, lw = 1) => {
    g.strokeStyle = MP.line;
    g.lineWidth = lw * MP.lw * 2;
    for (const [, path] of shapes) {
      path();
      g.stroke();
    }
    for (const [c3, path] of shapes) {
      path();
      g.fillStyle = col(c3);
      g.fill();
    }
  };
  const shadow = (x, y, rx, ry) => {
    g.fillStyle = 'rgba(30,44,30,0.3)';
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, 7);
    g.fill();
  };
  return { c, g, r, col, jit, poly, ink, line, pole, under, shadow };
}
function footStones(K, x0, x1, y) {
  const { g, r, jit, ink } = K;
  for (let x = x0; x < x1; x += 7 + r() * 2.5) {
    g.beginPath();
    g.ellipse(x, y, 4.4, 2.7, 0, 0, 7);
    ink(jit(MP.stone, 0.05), 0.6);
  }
}
// A wall of n log courses, each h tall (less `gap`, for a barn that breathes), with the log ends of the corner joints.
function logWall(K, x0, x1, y0, n, h, base, gap = 0) {
  const { g, jit, ink, line } = K,
    lh = h - gap;
  for (let k = 0; k < n; k++) {
    rr(g, x0, y0 + k * h, x1 - x0, lh, lh / 2.6);
    ink(jit(base, 0.025), 0.5);
  }
  g.fillStyle = 'rgba(50,24,30,0.22)';
  g.fillRect(x0, y0, x1 - x0, 3.2); // the shadow under the eaves
  for (let k = 0; k < n; k++)
    for (const x of [x0 - 1.4, x1 + 1.4]) {
      const y = y0 + k * h + lh / 2,
        rad = lh / 2 - 0.2;
      g.beginPath();
      g.arc(x, y, rad, 0, 7);
      ink(MP.logEnd, 0.6);
      g.beginPath();
      g.arc(x, y, rad * 0.45, 0, 7);
      line(MP.eave, 0.7, 0.6);
    }
}
const roofPath = (g, e0, e1, r1, r0, yE, yR, sag) => {
  g.beginPath();
  g.moveTo(e0, yE);
  g.lineTo(e1, yE);
  g.lineTo(r1, yR);
  g.quadraticCurveTo((r0 + r1) / 2, yR + sag, r0, yR);
  g.closePath();
};
// Snow on a roof (VB-083): set while page/fieldart makes the buildings' snowy textures, each roof then drawn under a white blanket with a
// blue-grey edge, so a farm in winter reads as one under snow. The drawing is the roof's own, so nothing else of the building moves.
let roofSnow = false;
function snowOnRoof(K, e0, e1, r1, r0, yE, yR, sag) {
  if (!roofSnow) return;
  const { g } = K;
  roofPath(g, e0 - 0.5, e1 + 0.5, r1 + 0.5, r0 - 0.5, yE - 1.2, yR - 1, sag);
  g.fillStyle = 'rgb(238,242,247)';
  g.fill();
  g.strokeStyle = 'rgb(138,154,174)';
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.moveTo(e0 + 3, yE - 2.6);
  g.lineTo(e1 - 3, yE - 2.6);
  g.strokeStyle = 'rgba(150,170,192,0.6)';
  g.lineWidth = 1;
  g.stroke();
}
// Turf on birch bark: the bark's pale edge and the eave log that holds the turf, tufts and meadow flowers in rows, grass over the eave.
function turfRoof(K, e0, e1, r1, r0, yE, yR, v) {
  const { g, r, col, ink, line } = K;
  g.beginPath();
  g.rect(e0 + 2, yE - 1, e1 - e0 - 4, 2.6);
  ink(MP.bark, 0.5);
  rr(g, e0 + 1, yE + 1.2, e1 - e0 - 2, 3.6, 1.8);
  ink(MP.eave, 0.6);
  roofPath(g, e0, e1, r1, r0, yE, yR, 2.2);
  ink(MP.turf[v % MP.turf.length]);
  g.save();
  roofPath(g, e0 + 1, e1 - 1, r1 - 1, r0 + 1, yE - 1, yR + 1, 2.2);
  g.clip();
  for (let k = 0; k < 22; k++) {
    const x = e0 + r() * (e1 - e0),
      y = yR + 4 + r() * (yE - yR - 6);
    g.beginPath();
    g.moveTo(x - 1.5, y - 2.5);
    g.lineTo(x, y);
    g.lineTo(x + 1.7, y - 2.7);
    line(k % 2 ? MP.turfDk : MP.turfHi, 1.1);
  }
  const n = 9;
  for (let k = 0; k < n; k++) {
    const y = yR + 5 + ((k % 2) * 0.7 + 0.15) * (yE - yR - 11),
      u = (yE - y) / (yE - yR),
      x0 = e0 + (r0 - e0) * u + 5,
      x1 = e1 + (r1 - e1) * u - 5;
    g.fillStyle = col(MP.flowers[(k + v) % MP.flowers.length]);
    g.beginPath();
    g.arc(x0 + ((k + 0.5) / n) * (x1 - x0), y, 1.6, 0, 7);
    g.fill();
  }
  g.restore();
  for (let x = e0 + 3.4; x < e1 - 2; x += 5.2) {
    g.beginPath();
    g.arc(x + r() * 0.8, yE - 0.4, 2.9, 0, Math.PI);
    g.closePath();
    ink(MP.turfDk, 0.55);
  }
  snowOnRoof(K, e0, e1, r1, r0, yE, yR, 2.2);
}
// Straw thatch in two layers, a combed eave, and crossed poles astride the ridge to hold it against the wind.
function thatchRoof(K, e0, e1, r1, r0, yE, yR) {
  const { g, poly, ink, line, pole } = K;
  roofPath(g, e0, e1, r1, r0, yE, yR, 1.6);
  ink(MP.thatch);
  g.save();
  roofPath(g, e0 + 1, e1 - 1, r1 - 1, r0 + 1, yE - 1, yR + 1, 1.6);
  g.clip();
  for (let x = e0 + 3; x < e1; x += 4.2) {
    const t = (x - e0) / (e1 - e0);
    g.beginPath();
    g.moveTo(x, yE);
    g.lineTo(r0 + t * (r1 - r0), yR);
    line(MP.thatchDk, 0.8, 0.55);
  }
  const ym = (yE + yR) / 2 + 1.5;
  g.beginPath();
  g.moveTo(e0, ym);
  for (let x = e0, k = 0; x <= e1; x += 3, k++) g.lineTo(x, ym + (k % 2 ? 1.8 : 0));
  line(MP.thatchDk, 1.1);
  g.restore();
  const pts = [[e0 + 1, yE - 0.5]];
  for (let x = e0 + 1, k = 0; x <= e1 - 1; x += 3, k++) pts.push([x, yE + (k % 2 ? 2.4 : 0.4)]);
  pts.push([e1 - 1, yE - 0.5]);
  poly(pts);
  ink(MP.thatchDk, 0.55);
  rr(g, r0 - 2, yR - 2.2, r1 - r0 + 4, 4.4, 2.2);
  ink(MP.thatchDk, 0.7);
  for (let x = r0 + 7; x < r1 - 4; x += 12.5)
    for (const d of [-1, 1]) pole(x + d * 4.4, yR + 8, x - d * 2.8, yR - 5.5, MP.post, 1.5);
  snowOnRoof(K, e0, e1, r1, r0, yE, yR, 1.6);
}
// Split shingles in overlapping rows under a ridge board.
function shingleRoof(K, e0, e1, r1, r0, yE, yR) {
  const { g, ink, line } = K;
  roofPath(g, e0, e1, r1, r0, yE, yR, 0);
  ink(MP.shingle);
  g.save();
  roofPath(g, e0 + 1, e1 - 1, r1 - 1, r0 + 1, yE - 1, yR + 1, 0);
  g.clip();
  for (let y = yR + 5.6, row = 0; y < yE + 2; y += 5.3, row++)
    for (let x = e0 - (row % 2) * 2.7; x < e1 + 3; x += 5.4) {
      g.beginPath();
      g.arc(x, y - 2.7, 2.7, 0, Math.PI);
      line(MP.shingleDk, 0.9, 0.85);
    }
  g.restore();
  rr(g, r0 - 1.5, yR - 1.8, r1 - r0 + 3, 3.4, 1.4);
  ink(MP.eave, 0.6);
  snowOnRoof(K, e0, e1, r1, r0, yE, yR, 0);
}
// A plank door in a heavy frame, on iron strap hinges.
function plankDoor(K, x, y, w, h) {
  const { g, ink, line } = K;
  g.beginPath();
  g.rect(x, y, w, h);
  ink(MP.frame, 0.7);
  g.beginPath();
  g.rect(x + 2, y + 2, w - 4, h - 2);
  ink(MP.door, 0.5);
  for (let px = x + 2 + (w - 4) / 3; px < x + w - 3; px += (w - 4) / 3) {
    g.beginPath();
    g.moveTo(px, y + 3);
    g.lineTo(px, y + h - 0.5);
    line(MP.dark, 0.6, 0.45);
  }
  for (const f of [0.3, 0.76]) {
    g.beginPath();
    g.moveTo(x + 2.4, y + h * f);
    g.lineTo(x + 2 + (w - 4) * 0.62, y + h * f);
    line(MP.iron, 1.2);
  }
}
// The cottage (stuga): four fat log courses on a stone footing, a low door, a wind-eye with its shutter, a turf roof and its smoke hole.
// STUGA names where its openings are, in art units, for the smoke and the firelight (page/settlement).
const STUGA = { w: 104, h: 80, door: [30.5, 58], eye: [65.7, 52.7], hole: [66.5, 8] };
function stugaCanvas(v) {
  const K = artKit(STUGA.w, STUGA.h, 100 + v),
    { g, ink, line } = K;
  K.shadow(54, 73, 48, 7);
  footStones(K, 15, 92, 69.6);
  logWall(K, 13, 91, 41, 4, 7, MP.logs[v % 3]);
  plankDoor(K, 22, 46, 17, 23);
  g.beginPath();
  g.rect(61, 49, 9.5, 7.5);
  ink(MP.dark, 0.7);
  g.beginPath();
  g.rect(71.4, 48, 5.2, 9.5);
  ink(MP.board, 0.6);
  turfRoof(K, 2, 102, 86, 18, 40, 11, v);
  for (const x of [17.5, 86.5]) {
    g.beginPath();
    g.arc(x, 12.4, 2.9, 0, 7);
    ink(MP.logEnd, 0.6);
  }
  K.poly([
    [59.5, 14.5],
    [61, 5.5],
    [72, 5.5],
    [73.5, 14.5],
  ]);
  ink(MP.board, 0.7);
  g.beginPath();
  g.rect(63, 8, 7, 4.4);
  ink(MP.dark, 0);
  g.beginPath();
  g.moveTo(63, 8);
  g.lineTo(70, 8);
  line(MP.dark, 0.5);
  return K.c;
}
// The cottage's openings lit from within by the hearth: the wind-eye, the crack round the door and the smoke hole, to lay over it at night.
function stugaLitCanvas() {
  const K = artKit(STUGA.w, STUGA.h, 1),
    { g } = K;
  g.fillStyle = 'rgb(255,214,120)';
  g.fillRect(61.6, 49.6, 8.3, 6.3);
  g.fillRect(63.4, 8.4, 6.2, 3.6);
  g.fillStyle = 'rgb(255,190,96)';
  g.fillRect(24, 48, 13, 1.3);
  g.fillRect(24, 48, 1.2, 20.5);
  g.fillRect(35.8, 48, 1.2, 20.5);
  return K.c;
}
// The storehouse (härbre): a small log box on posts and stones, away from damp and mice, under a boarded storey that juts out, and shingles.
function harbreCanvas() {
  const K = artKit(56, 86, 7),
    { g, ink, line, pole } = K;
  K.shadow(30, 81, 24, 4.5);
  for (const x of [12.2, 43.8]) {
    g.beginPath();
    g.rect(x - 2.3, 63, 4.6, 16);
    ink(MP.post, 0.6);
    g.beginPath();
    g.ellipse(x, 79.4, 5.2, 2.9, 0, 0, 7);
    ink(MP.stone, 0.6);
  }
  logWall(K, 10, 46, 44.5, 3, 6.6, MP.logs[1]);
  g.beginPath();
  g.rect(3, 23, 50, 22);
  ink(MP.board);
  for (let x = 8; x < 52; x += 5) {
    g.beginPath();
    g.moveTo(x, 24.5);
    g.lineTo(x, 44);
    line(MP.dark, 0.6, 0.35);
  }
  g.fillStyle = 'rgba(50,24,30,0.2)';
  g.fillRect(3.5, 23.5, 49, 3);
  plankDoor(K, 21.5, 28, 12, 17);
  pole(41, 79, 51.5, 45, MP.post, 3.1); // a notched log for a ladder
  for (let k = 1; k < 6; k++) {
    const x = 41 + 10.5 * (k / 6),
      y = 79 - 34 * (k / 6);
    g.beginPath();
    g.moveTo(x - 1.4, y - 0.4);
    g.lineTo(x + 1.4, y + 0.4);
    line(MP.dark, 0.8, 0.7);
  }
  shingleRoof(K, 0.8, 55.2, 46, 10, 25, 4.5);
  return K.c;
}
// The barn (lada): gapped logs to let the hay and the unthreshed sheaves breathe, a wide double door, and straw thatch.
function ladaCanvas() {
  const K = artKit(110, 72, 11),
    { g, ink, line } = K;
  K.shadow(56, 67, 50, 6);
  g.beginPath();
  g.rect(11, 32, 88, 32.5);
  ink(MP.dark, 0);
  logWall(K, 10, 100, 32, 5, 6.6, MP.barn, 1.7);
  g.beginPath();
  g.rect(41, 38, 28, 26.5);
  ink(MP.frame, 0.7);
  g.beginPath();
  g.rect(43, 40, 24, 24.5);
  ink(MP.board, 0.5);
  g.beginPath();
  g.moveTo(55, 40);
  g.lineTo(55, 64.5);
  line(MP.dark, 0.9, 0.8);
  g.beginPath();
  g.moveTo(44, 63);
  g.lineTo(54, 41);
  g.moveTo(56, 41);
  g.lineTo(66, 63);
  line(MP.frame, 1.5);
  thatchRoof(K, 2, 108, 92, 18, 34, 7);
  return K.c;
}
// The byre (fähus): a low log house under turf, a plank door and a gap for air and light; the animals stand in it from autumn to spring.
function byreCanvas() {
  const K = artKit(86, 62, 17),
    { g, ink } = K;
  K.shadow(44, 57, 40, 5);
  footStones(K, 11, 78, 56.6);
  logWall(
    K,
    9,
    77,
    34.5,
    3,
    7.2,
    MP.logs[1].map((q) => q * 0.95),
  );
  plankDoor(K, 49.5, 37.5, 16, 18.6);
  g.beginPath();
  g.rect(19.5, 41.5, 10, 4.2);
  ink(MP.dark, 0.7);
  turfRoof(K, 1, 85, 72, 14, 33.5, 10.5, 1);
  return K.c;
}
function woodpileCanvas(level) {
  const K = artKit(52, 30, level * 3 + 1),
    { g, jit, ink, line, pole } = K;
  K.shadow(26, 27, 24, 3.5);
  rr(g, 3, 23.6, 46, 3.2, 1.4);
  ink(MP.post, 0.6);
  const rows = [0, 2, 3, 4][level];
  if (rows) for (const x of [4.5, 47.5]) pole(x, 24, x, 22 - rows * 4.8, MP.post, 1.6);
  for (let row = 0; row < rows; row++)
    for (let x = 8.6 + (row % 2) * 2.9; x < 45; x += 5.8) {
      const y = 20.6 - row * 4.9;
      g.beginPath();
      g.arc(x, y, 2.9, 0, 7);
      ink(jit(MP.logEnd, 0.06), 0.55);
      g.beginPath();
      g.arc(x, y, 1.2, 0, 7);
      line(MP.eave, 0.6, 0.6);
    }
  return K.c;
}
// A cart seen from the side, facing right (VB-410): the hand cart a box on one wheel with shafts to push, the ox cart longer, with a
// yoke pole ahead; `load` heaps sheaves, hay or logs on its bed; a `worn` one is greyed, with a plank gone and the wheel out of true.
function cartCanvas(kind, load, worn) {
  const ox = kind === 'ox',
    W = ox ? 52 : 40,
    K = artKit(W, 28, (ox ? 7 : 3) + (worn ? 1 : 0)),
    { g, ink, pole, jit, poly } = K,
    wood = worn ? [150, 128, 104] : MP.logs[1],
    bx = ox ? 8 : 6,
    bw = ox ? 28 : 20;
  K.shadow(W / 2 - 3, 25, W / 2 - 6, 2.6);
  if (load === 'sheaf') {
    for (let k = 0; k < (ox ? 4 : 3); k++) {
      poly([
        [bx + 1 + k * 7, 15],
        [bx + 2.5 + k * 7, 7],
        [bx + 5 + k * 7, 5.5],
        [bx + 8 + k * 7, 15],
      ]);
      ink(jit(MP.straw, 0.05), 0.5);
    }
  } else if (load === 'hay') {
    g.beginPath();
    g.ellipse(bx + bw / 2, 11, bw / 2 + 1, 6, 0, 0, 7);
    ink(jit(MP.straw, 0.05), 0.55);
  } else if (load === 'logs') {
    const n = ox ? 6 : 4;
    for (let k = 0; k < n; k++) {
      g.beginPath();
      g.arc(bx + 3 + (k * (bw - 6)) / (n - 1), 12.5 - (k % 2) * 3, 2.6, 0, 7);
      ink(jit(MP.logEnd, 0.06), 0.5);
    }
  }
  g.beginPath();
  g.rect(bx, 15, bw, 5);
  ink(wood, 0.6);
  if (worn) {
    g.beginPath();
    g.rect(bx + bw * 0.55, 15.4, 5, 2.2);
    g.fillStyle = 'rgba(40,30,24,0.8)';
    g.fill();
  }
  const fx = bx + bw;
  pole(fx - 2, 19, fx + (ox ? 14 : 9), 17.5, MP.post, 1.5);
  pole(bx - (ox ? 0 : 4), 14, bx + 2, 19, MP.post, 1.2);
  if (ox) pole(fx + 13, 14.5, fx + 13, 21, MP.post, 1.3);
  const wr = ox ? 5.2 : 4.4,
    wx = bx + bw * 0.45,
    tilt = worn ? 0.12 : 0;
  g.beginPath();
  g.ellipse(wx, 20.5, wr * (1 - tilt), wr, 0, 0, 7);
  ink(worn ? [110, 92, 74] : MP.dark, 0.7);
  g.beginPath();
  g.ellipse(wx, 20.5, wr * 0.35, wr * 0.35, 0, 0, 7);
  ink(MP.post, 0.4);
  return K.c;
}
function wellSweepCanvas() {
  const K = artKit(100, 112, 3),
    { g, ink, pole } = K;
  K.shadow(44, 106, 34, 5.5);
  logWall(K, 21, 53, 88, 3, 5.4, MP.logs[0]);
  g.beginPath();
  g.ellipse(37, 88, 15.5, 3.4, 0, 0, 7);
  ink(MP.water, 0.6);
  // forked post, sweep pole with a stone counterweight, rod and bucket
  pole(72.2, 104, 72.2, 50, MP.post, 4);
  pole(71, 51, 67, 43, MP.post, 2.4);
  pole(74, 51, 78, 43, MP.post, 2.4);
  pole(36, 10, 94, 74, MP.logs[1], 3.2);
  g.beginPath();
  g.ellipse(93, 76, 6, 5, 0, 0, 7);
  ink(MP.stone, 0.7);
  pole(37, 11, 37, 76, MP.dark, 0.6);
  K.poly([
    [32, 76],
    [42, 76],
    [41, 84.5],
    [33, 84.5],
  ]);
  ink(MP.board, 0.6);
  return K.c;
}
// The curb of a farm's own well, where the village has none.
function curbCanvas() {
  const K = artKit(40, 30, 9),
    { g, ink } = K;
  K.shadow(20, 26, 17, 3.5);
  logWall(K, 5, 35, 10, 3, 5.2, MP.logs[0]);
  g.beginPath();
  g.ellipse(20, 10, 15, 3.2, 0, 0, 7);
  ink(MP.water, 0.6);
  return K.c;
}
// The trodden ground of the yard, to lie inside the farm's hex.
function yardCanvas() {
  const c = makeCanvas(150, 120),
    g = c.getContext('2d'),
    r = Noise.mulberry32(5);
  const gr = g.createRadialGradient(75, 75, 10, 75, 75, 74);
  gr.addColorStop(0, 'rgba(206,176,120,0.8)');
  gr.addColorStop(0.72, 'rgba(206,176,120,0.5)');
  gr.addColorStop(1, 'rgba(206,176,120,0)');
  g.fillStyle = gr;
  g.save();
  g.scale(1, 120 / 150);
  g.beginPath();
  g.arc(75, 75, 74, 0, 7);
  g.fill();
  g.restore();
  for (let k = 0; k < 40; k++) {
    const a = r() * 6.28,
      d = Math.sqrt(r()) * 56;
    g.fillStyle = k % 2 ? 'rgba(150,110,70,0.5)' : 'rgba(126,156,84,0.5)';
    g.beginPath();
    g.arc(75 + Math.cos(a) * d, 60 + Math.sin(a) * d * 0.7, 1.4, 0, 7);
    g.fill();
  }
  return c;
}
// The haystack by the byre (VB-133): none, low, half and full, by the hay against the winter's need; built round a pole, as stacks were.
