// ======== The town mock's art and placing (docs/mocks/town): spliced into the page's closure by town.js, never part of the game ========
// The buildings are drawn with the farm art's own brushes (artKit, logWall, turfRoof, shingleRoof, plankDoor: page/farmart), at its scale
// (ART_S world units per art unit) and in its manner: a heavy dark contour round flat ochre, red oxide and green earth. What is new is
// what a town had and a farm had not: houses gable to the street, a shop hatch, brick and limewash, a church, booths, a quay and ships.
const TM = {
  brick: [178, 86, 62],
  brickDk: [126, 56, 42],
  daub: [240, 230, 206],
  timber: [104, 58, 42],
  tile: [192, 94, 64],
  tileDk: [134, 60, 44],
  lime: [238, 234, 220],
  limeDk: [200, 192, 176],
  tar: [112, 92, 80],
  tarDk: [62, 50, 44],
  hull: [138, 92, 58],
  hullDk: [92, 60, 40],
  sail: [238, 226, 196],
  clay: [196, 140, 96],
  glow: [255, 176, 72],
  water: [92, 132, 160],
  fish: [206, 210, 204],
  cabbage: [118, 160, 96],
  awn: [
    [190, 64, 46],
    [232, 190, 70],
    [88, 120, 150],
    [126, 156, 84],
  ],
};
const tmTex = {};
const tmT = (key, make) => tmTex[key] || (tmTex[key] = texFrom(make(), { autoGenerateMipmaps: true, resolution: ARTK }));

// The roof of a house seen gable on: a broad triangle behind the gable, so that its eaves and verges stand out round it, covered in
// turf, split shingles or tiles.
function gableRoof(K, cx, apex, x0, x1, yE, kind, v) {
  const { g, r, ink, line, poly, col } = K;
  const pts = [
    [x0, yE],
    [cx, apex],
    [x1, yE],
  ];
  const fill = { turf: MP.turf[v % 3], shingle: MP.shingle, tile: TM.tile, tar: TM.tar, thatch: MP.thatch }[kind];
  poly(pts);
  ink(fill, 1.1);
  g.save();
  poly(pts);
  g.clip();
  if (kind === 'turf')
    for (let k = 0; k < 16; k++) {
      const x = x0 + r() * (x1 - x0),
        y = apex + 4 + r() * (yE - apex - 4);
      g.beginPath();
      g.moveTo(x - 1.4, y - 2.3);
      g.lineTo(x, y);
      g.lineTo(x + 1.6, y - 2.5);
      line(k % 2 ? MP.turfDk : MP.turfHi, 1);
    }
  else if (kind === 'thatch')
    for (let x = x0; x < x1; x += 3.6) {
      g.beginPath();
      g.moveTo(cx, apex);
      g.lineTo(x, yE);
      line(MP.thatchDk, 0.7, 0.5);
    }
  else {
    const dk = { shingle: MP.shingleDk, tile: TM.tileDk, tar: TM.tarDk }[kind],
      s = kind === 'tile' ? 4 : 4.6;
    for (let y = apex + s, row = 0; y < yE + s; y += s, row++)
      for (let x = x0 - (row % 2) * (s / 2); x < x1 + s; x += s) {
        g.beginPath();
        g.arc(x, y - s / 2, s / 2, 0, Math.PI);
        line(dk, 0.8, 0.8);
      }
  }
  g.restore();
  if (kind === 'turf') {
    g.fillStyle = col(MP.flowers[v % 4]);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(cx + (k - 1.5) * 6 + r() * 2, apex + 9 + r() * 8, 1.4, 0, 7);
      g.fill();
    }
  }
}
// A town house, gable to the street (Sigtuna's plots, 7 to 8 m wide), as Swedish towns built them until the 1300s: log on a stone
// footing, or (borrowed from the continent) half-timber with daub, or brick. `o`: w, courses, wall (log|daub|brick), roof, shop (a hatch
// whose shutter folds down as the counter), loft (a second storey jutting out), door side.
function gableHouseCanvas(o, v) {
  const W = o.w || 56,
    courses = o.courses || 5,
    wallH = courses * 7 + (o.loft ? 24 : 0),
    gH = W * (o.roof === 'tile' ? 0.75 : 0.56),
    H = wallH + gH + 22,
    CW = W + 16;
  const K = artKit(CW, H, o.seed || 31 + v),
    { g, ink, line, poly, jit } = K;
  const x0 = 8,
    x1 = 8 + W,
    cx = CW / 2,
    yB = H - 6,
    yW = yB - wallH,
    apex = yW - gH;
  K.shadow(cx, yB + 1.5, W / 2 + 4, 3.5);
  footStones(K, x0 + 2, x1 - 2, yB - 0.5);
  const lowTop = o.loft ? yB - courses * 7 : yW;
  // the ground storey
  if (o.wall === 'log' || !o.wall) logWall(K, x0, x1, lowTop, courses, 7, MP.logs[v % 3]);
  else wallPanel(K, x0, x1, lowTop, yB - 1, o.wall);
  // a loft storey jutting out over the street on its beams (loftbod)
  if (o.loft) {
    for (let x = x0 + 3; x < x1; x += 8) {
      g.beginPath();
      g.rect(x, lowTop - 2, 3.4, 4);
      ink(MP.logEnd, 0.5);
    }
    if (o.wall === 'log' || !o.wall) {
      g.beginPath();
      g.rect(x0 - 3, yW, W + 6, lowTop - yW - 1);
      ink(MP.board);
      for (let x = x0; x < x1 + 3; x += 4.6) {
        g.beginPath();
        g.moveTo(x, yW + 1);
        g.lineTo(x, lowTop - 2);
        line(MP.dark, 0.6, 0.3);
      }
    } else wallPanel(K, x0 - 3, x1 + 3, yW, lowTop - 1, o.wall);
    g.beginPath();
    g.rect(cx - 5, yW + 6, 10, 9);
    ink(MP.dark, 0.7);
    g.beginPath();
    g.rect(cx + 5.5, yW + 5, 4.5, 11);
    ink(MP.frame, 0.6);
  }
  gableRoof(K, cx, apex - 5, x0 - 7, x1 + 7, yW + 3, o.roof || 'turf', v);
  // the gable's boards, or the daub or brick carried up
  const gp = [
    [x0 + 2, yW + 0.5],
    [cx, apex + 3],
    [x1 - 2, yW + 0.5],
  ];
  poly(gp);
  if (o.wall === 'brick') ink(TM.brick, 0.8);
  else if (o.wall === 'daub') ink(TM.daub, 0.8);
  else ink(jit(MP.board, 0.04), 0.8);
  g.save();
  poly(gp);
  g.clip();
  if (o.wall === 'daub') {
    for (const [a, b] of [
      [
        [cx, apex + 3],
        [cx, yW],
      ],
      [
        [x0 + 8, yW],
        [cx, apex + 14],
      ],
      [
        [x1 - 8, yW],
        [cx, apex + 14],
      ],
    ]) {
      g.beginPath();
      g.moveTo(...a);
      g.lineTo(...b);
      line(TM.timber, 2.6);
    }
  } else if (o.wall !== 'brick')
    for (let x = x0 + 4; x < x1; x += 4.4) {
      g.beginPath();
      g.moveTo(x, apex);
      g.lineTo(x, yW);
      line(MP.dark, 0.6, 0.3);
    }
  g.restore();
  g.beginPath();
  g.rect(cx - 3.5, apex + gH * 0.45, 7, 6.5); // the loft hatch
  ink(MP.dark, 0.6);
  // door and hatch
  const left = (o.door || v) % 2 === 0,
    dx = left ? x0 + 6 : x1 - 6 - 13;
  plankDoor(K, dx, yB - 22, 13, 21);
  if (o.shop) {
    const hx = left ? x1 - 24 : x0 + 6;
    g.beginPath();
    g.rect(hx, yB - 22, 18, 11);
    ink(MP.dark, 0.7);
    g.beginPath();
    g.rect(hx - 2, yB - 11.5, 22, 3.4);
    ink(MP.board, 0.7); // the shutter let down for a counter
    for (const [k, c] of [
      [0, MP.flowers[1]],
      [1, TM.awn[0]],
      [2, MP.flowers[0]],
    ]) {
      g.beginPath();
      g.arc(hx + 3 + k * 6, yB - 13.4, 2.1, 0, 7);
      ink(c, 0.5);
    }
  } else {
    g.beginPath();
    g.rect(left ? x1 - 16 : x0 + 7, yB - 20, 8, 6.5);
    ink(MP.dark, 0.6);
  }
  if (o.smoke !== false) {
    poly([
      [cx + 4, apex + 4],
      [cx + 5, apex - 6],
      [cx + 13, apex - 6],
      [cx + 14, apex + 9],
    ]);
    ink(MP.board, 0.6);
  }
  return K.c;
}
// A wall of daub in a red-brown frame (half-timber), or of brick in its bond, over the rect x0..x1, y0..y1.
function wallPanel(K, x0, x1, y0, y1, kind) {
  const { g, ink, line } = K;
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  ink(kind === 'brick' ? TM.brick : TM.daub, 0.9);
  g.save();
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.clip();
  if (kind === 'brick')
    for (let y = y0 + 3, row = 0; y < y1; y += 3, row++) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      line(TM.brickDk, 0.4, 0.5);
      for (let x = x0 + (row % 2) * 3; x < x1; x += 6) {
        g.beginPath();
        g.moveTo(x, y - 3);
        g.lineTo(x, y);
        line(TM.brickDk, 0.4, 0.4);
      }
    }
  else {
    const n = Math.max(2, Math.round((x1 - x0) / 13));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      line(TM.timber, 2.6);
      if (k < n) {
        g.beginPath();
        g.moveTo(x, k % 2 ? y0 : y1);
        g.lineTo(x0 + ((x1 - x0) * (k + 1)) / n, k % 2 ? y1 : y0);
        line(TM.timber, 2);
      }
    }
    for (const y of [y0 + 1, (y0 + y1) / 2, y1 - 1]) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      line(TM.timber, 2.4);
    }
  }
  g.restore();
}
// The merchant's house of brick, as Visby's and Stockholm's richer burghers built from the 1200s: a stepped gable to the street, white
// blind niches, cellar door, warehouse lofts above with their hatches and the hoist beam at the peak.
function merchantCanvas(v) {
  const W = 62,
    H = 150,
    CW = W + 12,
    K = artKit(CW, H, 71 + v),
    { g, ink, line, poly, pole } = K;
  const x0 = 6,
    x1 = 6 + W,
    cx = CW / 2,
    yB = H - 6,
    yE = yB - 62;
  K.shadow(cx, yB + 1.5, W / 2 + 4, 3.5);
  const steps = 5,
    sw = W / 2 / steps,
    sh = 11,
    half = [
      [x0, yB],
      [x0, yE],
    ];
  for (let k = 0; k < steps; k++) half.push([x0 + k * sw, yE - (k + 1) * sh], [x0 + (k + 1) * sw, yE - (k + 1) * sh]);
  const pts = half.concat(half.slice().reverse().map(([x, y]) => [2 * cx - x, y]));
  poly(pts);
  ink(v % 2 ? TM.brick : [186, 98, 70], 1.1);
  g.save();
  poly(pts);
  g.clip();
  for (let y = yB - 3, row = 0; y > 0; y -= 3.2, row++) {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    line(TM.brickDk, 0.35, 0.4);
  }
  g.restore();
  // blind niches up the gable, pointed, limewashed
  for (const [x, top, bot] of [
    [cx - 15, yE - 22, yE + 6],
    [cx, yE - 44, yE + 6],
    [cx + 15, yE - 22, yE + 6],
  ]) {
    g.beginPath();
    g.moveTo(x - 4, bot);
    g.lineTo(x - 4, top + 5);
    g.quadraticCurveTo(x - 4, top, x, top - 2);
    g.quadraticCurveTo(x + 4, top, x + 4, top + 5);
    g.lineTo(x + 4, bot);
    g.closePath();
    ink(TM.lime, 0.6);
  }
  // the loft hatches up the middle, the windows of the dwelling storey
  for (const y of [yE - 30, yE - 8]) {
    g.beginPath();
    g.rect(cx - 3.6, y, 7.2, 9);
    ink(MP.board, 0.6);
  }
  for (const x of [x0 + 9, x1 - 17]) {
    g.beginPath();
    g.rect(x, yE + 14, 8, 10);
    ink(MP.dark, 0.6);
    g.beginPath();
    g.rect(x - 3.5, yE + 14, 3.5, 10);
    ink(MP.frame, 0.5);
  }
  g.beginPath();
  g.rect(cx - 4, yE + 14, 8, 10);
  ink(MP.board, 0.6);
  // the arched door and the cellar's
  g.beginPath();
  g.moveTo(x0 + 10, yB);
  g.lineTo(x0 + 10, yB - 17);
  g.quadraticCurveTo(x0 + 17, yB - 26, x0 + 24, yB - 17);
  g.lineTo(x0 + 24, yB);
  g.closePath();
  ink(TM.lime, 0.7);
  plankDoor(K, x0 + 12.5, yB - 18, 9, 18);
  g.beginPath();
  g.rect(x1 - 22, yB - 9, 14, 9);
  ink(MP.dark, 0.6);
  for (const x of [x1 - 30, x1 - 22]) {
    g.beginPath();
    g.rect(x, yB - 30, 7, 9);
    ink(MP.dark, 0.5);
  }
  // the hoist beam and its rope
  pole(cx, yE - steps * sh + 2, cx, yE - steps * sh - 2, MP.post, 2);
  pole(cx - 2, yE - 50, cx + 12, yE - 50, MP.post, 2.6);
  g.beginPath();
  g.moveTo(cx + 11, yE - 49);
  g.lineTo(cx + 11, yE - 18);
  line(MP.dark, 0.7);
  g.beginPath();
  g.rect(cx + 8.5, yE - 19, 5, 4.5);
  ink(MP.board, 0.5);
  return K.c;
}
// The parish church: a nave of fieldstone rubble limewashed white, a lower choir and an apse to the east, a west tower with a tall
// shingled spire (tarred, so dark) and a cockerel, round-arched windows high and small, a portal on the south side. Begun in stone in
// the 1100s and 1200s, like nearly every Swedish parish church.
function churchCanvas() {
  const K = artKit(230, 214, 5),
    { g, r, ink, line, poly, jit, pole } = K;
  const yB = 204;
  K.shadow(118, yB + 2, 108, 7);
  const rubble = (x0, y0, x1, y1) => {
    g.save();
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    for (let k = 0; k < ((x1 - x0) * (y1 - y0)) / 60; k++) {
      g.beginPath();
      g.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 2.4 + r() * 1.8, 1.4 + r(), 0, 0, 7);
      line(TM.limeDk, 0.7, 0.7);
    }
    g.restore();
  };
  const arched = (x, y, w, h, c3 = MP.dark) => {
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + w / 2);
    g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x + w, y + h);
    g.closePath();
    ink(c3, 0.7);
  };
  // the apse and the choir
  g.beginPath();
  g.ellipse(206, yB - 26, 18, 26, 0, -Math.PI / 2, Math.PI / 2);
  g.lineTo(206, yB);
  g.closePath();
  ink(jit(TM.lime, 0.02), 1);
  g.beginPath();
  g.rect(166, yB - 52, 42, 52);
  ink(TM.lime, 1);
  rubble(166, yB - 52, 208, yB);
  roofPath(g, 160, 222, 206, 172, yB - 50, yB - 78, 0);
  ink(TM.tar);
  g.beginPath();
  g.moveTo(166, yB - 64);
  g.lineTo(216, yB - 64);
  line(TM.tarDk, 0.8);
  arched(182, yB - 40, 7, 14);
  // the nave
  g.beginPath();
  g.rect(64, yB - 66, 106, 66);
  ink(TM.lime, 1.1);
  rubble(64, yB - 66, 170, yB);
  for (const x of [66, 164]) {
    for (let y = yB - 64; y < yB; y += 8) {
      g.beginPath();
      g.rect(x - (y % 16 ? 0 : 2), y, 6 + (y % 16 ? 0 : 2), 7);
      ink(MP.stone, 0.45);
    }
  }
  roofPath(g, 56, 178, 160, 74, yB - 64, yB - 116, 0);
  ink(TM.tar, 1.1);
  g.save();
  roofPath(g, 57, 177, 159, 75, yB - 63, yB - 115, 0);
  g.clip();
  for (let y = yB - 112, row = 0; y < yB - 60; y += 5, row++)
    for (let x = 50 + (row % 2) * 2.5; x < 180; x += 5) {
      g.beginPath();
      g.arc(x, y - 2.5, 2.5, 0, Math.PI);
      line(TM.tarDk, 0.8, 0.75);
    }
  g.restore();
  for (const x of [88, 140]) arched(x, yB - 54, 8, 17);
  // the south portal, pointed, with its red-painted door
  g.beginPath();
  g.moveTo(108, yB);
  g.lineTo(108, yB - 24);
  g.quadraticCurveTo(118, yB - 40, 128, yB - 24);
  g.lineTo(128, yB);
  g.closePath();
  ink(MP.stone, 0.9);
  g.beginPath();
  g.moveTo(112, yB);
  g.lineTo(112, yB - 22);
  g.quadraticCurveTo(118, yB - 33, 124, yB - 22);
  g.lineTo(124, yB);
  g.closePath();
  ink(MP.door, 0.7);
  g.beginPath();
  g.moveTo(113, yB - 12);
  g.lineTo(122, yB - 12);
  line(MP.iron, 1.1);
  // the west tower
  g.beginPath();
  g.rect(18, yB - 124, 48, 124);
  ink(jit(TM.lime, 0.02), 1.1);
  rubble(18, yB - 124, 66, yB);
  g.fillStyle = 'rgba(60,50,40,0.12)';
  g.fillRect(52, yB - 124, 14, 124);
  for (let y = yB - 122; y < yB; y += 9) {
    for (const x of [18, 60]) {
      g.beginPath();
      g.rect(x + (y % 18 > 8 ? 0 : 1), y, 6, 8);
      ink(MP.stone, 0.45);
    }
  }
  arched(36, yB - 116, 12, 20); // the belfry's openings
  arched(30, yB - 70, 6, 12);
  for (const [a, b] of [
    [38, 47],
    [46, 40],
  ]) {
    g.beginPath();
    g.moveTo(a, yB - 104);
    g.lineTo(b, yB - 104);
    line(MP.board, 0.8);
  }
  // the spire
  poly([
    [12, yB - 122],
    [42, yB - 200],
    [72, yB - 122],
  ]);
  ink(TM.tar, 1.1);
  g.save();
  poly([
    [12, yB - 122],
    [42, yB - 200],
    [72, yB - 122],
  ]);
  g.clip();
  for (let y = yB - 196, row = 0; y < yB - 118; y += 4.4, row++)
    for (let x = 10 + (row % 2) * 2.2; x < 76; x += 4.4) {
      g.beginPath();
      g.arc(x, y - 2.2, 2.2, 0, Math.PI);
      line(TM.tarDk, 0.7, 0.75);
    }
  g.restore();
  g.fillStyle = 'rgba(30,20,20,0.18)';
  poly([
    [42, yB - 200],
    [72, yB - 122],
    [48, yB - 122],
  ]);
  g.fill();
  pole(42, yB - 199, 42, yB - 208, MP.iron, 1.2);
  poly([
    [39, yB - 207],
    [45, yB - 210],
    [47, yB - 205],
    [42, yB - 204],
  ]);
  ink(MP.flowers[1], 0.5); // the gilt cockerel
  return K.c;
}
// A market booth (bod): a frame of poles under a striped cloth, a counter of planks, and the wares on it.
function boothCanvas(v) {
  const K = artKit(52, 50, 120 + v),
    { g, ink, line, poly, pole, col } = K;
  K.shadow(26, 46, 22, 3);
  for (const x of [6, 46]) pole(x, 46, x, 14, MP.post, 2);
  const c = TM.awn[v % 4];
  poly([
    [2, 18],
    [8, 6],
    [44, 6],
    [50, 18],
  ]);
  ink(c, 0.9);
  g.save();
  poly([
    [2, 18],
    [8, 6],
    [44, 6],
    [50, 18],
  ]);
  g.clip();
  for (let x = 0; x < 54; x += 8) {
    g.fillStyle = col(MP.bark);
    g.beginPath();
    g.moveTo(x, 18);
    g.lineTo(x + 2.5, 6);
    g.lineTo(x + 6.5, 6);
    g.lineTo(x + 4, 18);
    g.closePath();
    g.fill();
  }
  g.restore();
  for (let x = 2; x < 50; x += 6) {
    g.beginPath();
    g.moveTo(x, 18);
    g.lineTo(x + 3, 21);
    g.lineTo(x + 6, 18);
    ink(c, 0.6);
  }
  g.beginPath();
  g.rect(4, 32, 44, 4);
  ink(MP.board, 0.8);
  g.beginPath();
  g.rect(7, 36, 38, 9);
  ink(MP.barn, 0.6);
  const wares = [
    [MP.flowers[1], MP.straw, MP.flowers[1]], // loaves
    [TM.fish, TM.fish, TM.fish], // fish
    [TM.awn[2], TM.awn[0], MP.bark], // cloth
    [TM.clay, [160, 110, 76], TM.clay], // pots
  ][v % 4];
  wares.forEach((w3, k) => {
    g.beginPath();
    if (v % 4 === 1) g.ellipse(14 + k * 12, 29.5, 5, 2, 0.2, 0, 7);
    else if (v % 4 === 2) g.rect(10 + k * 11, 25, 9, 7);
    else g.ellipse(14 + k * 12, 28.5, 4, 3.4, 0, 0, 7);
    ink(w3, 0.55);
  });
  return K.c;
}
// A cog (kogg), the Hanseatic ship: a deep clinker hull, castles fore and aft, one mast and its square sail furled on the yard.
function cogCanvas() {
  const K = artKit(150, 140, 9),
    { g, ink, line, poly, pole } = K;
  const yW = 118;
  g.fillStyle = 'rgba(30,50,70,0.25)';
  g.beginPath();
  g.ellipse(75, yW + 6, 70, 7, 0, 0, 7);
  g.fill();
  pole(78, yW - 6, 78, 8, MP.post, 3.2); // the mast
  pole(50, 24, 108, 24, MP.post, 2.2); // the yard
  rr(g, 50, 22, 58, 7, 3.5);
  ink(TM.sail, 0.7);
  for (const [a, b] of [
    [78, 10],
    [78, 10],
  ]) {
    g.beginPath();
    g.moveTo(a, b);
    g.lineTo(10, yW - 40);
    g.moveTo(a, b);
    g.lineTo(142, yW - 38);
    line(MP.dark, 0.6, 0.7);
  }
  // the hull
  poly([
    [6, yW - 44],
    [24, yW - 30],
    [126, yW - 30],
    [146, yW - 46],
    [134, yW + 4],
    [24, yW + 4],
  ]);
  ink(TM.hull, 1.2);
  g.save();
  poly([
    [6, yW - 44],
    [24, yW - 30],
    [126, yW - 30],
    [146, yW - 46],
    [134, yW + 4],
    [24, yW + 4],
  ]);
  g.clip();
  for (let k = 1; k < 7; k++) {
    g.beginPath();
    g.moveTo(0, yW - 44 + k * 6.6);
    g.quadraticCurveTo(75, yW - 28 + k * 5.2, 150, yW - 46 + k * 7);
    line(TM.hullDk, 0.9, 0.8);
  }
  g.restore();
  // the castles
  for (const [x0, x1] of [
    [16, 44],
    [112, 140],
  ]) {
    g.beginPath();
    g.rect(x0, yW - 56, x1 - x0, 16);
    ink(MP.board, 0.9);
    for (let x = x0 + 3; x < x1; x += 5) {
      g.beginPath();
      g.moveTo(x, yW - 54);
      g.lineTo(x, yW - 43);
      line(MP.dark, 0.6, 0.4);
    }
  }
  pole(78, 10, 78, 2, MP.post, 1.4);
  poly([
    [79, 2],
    [96, 5],
    [79, 8],
  ]);
  ink(TM.awn[0], 0.5);
  return K.c;
}
// A boat of the archipelago: a small clinker rowing boat, or a sailing boat (storbåt) with a mast and a brown square sail.
function boatCanvas(v) {
  const K = artKit(64, 54, 40 + v),
    { g, ink, line, poly, pole } = K,
    yW = 44;
  g.fillStyle = 'rgba(30,50,70,0.25)';
  g.beginPath();
  g.ellipse(32, yW + 4, 28, 4, 0, 0, 7);
  g.fill();
  if (v % 2) {
    pole(32, yW - 6, 32, 4, MP.post, 1.8);
    poly([
      [20, 8],
      [46, 8],
      [48, yW - 12],
      [18, yW - 12],
    ]);
    ink([176, 128, 84], 0.8);
  }
  const hull = [
    [3, yW - 14],
    [14, yW - 8],
    [50, yW - 8],
    [61, yW - 15],
    [52, yW + 1],
    [12, yW + 1],
  ];
  poly(hull);
  ink(v % 3 ? TM.hull : MP.logs[0].map((q) => q * 0.8), 1);
  g.beginPath();
  g.moveTo(8, yW - 6);
  g.quadraticCurveTo(32, yW, 57, yW - 7);
  line(TM.hullDk, 0.8);
  if (!(v % 2)) {
    pole(22, yW - 9, 8, yW - 2, MP.post, 1.2);
    pole(42, yW - 9, 56, yW - 2, MP.post, 1.2);
  }
  return K.c;
}
// The net shed and boathouse at the water (sjöbod): a small log house on piles, its door to the water, under turf.
function sjobodCanvas(v) {
  const K = artKit(64, 64, 60 + v),
    { g, ink, pole } = K;
  for (const x of [12, 30, 50]) pole(x, 62, x, 46, MP.post, 2.6);
  logWall(K, 8, 56, 26, 3, 6.6, MP.logs[(v + 1) % 3].map((q) => q * 0.9));
  g.beginPath();
  g.rect(6, 45, 52, 3);
  ink(MP.board, 0.6);
  plankDoor(K, 24, 30, 14, 15);
  turfRoof(K, 2, 62, 52, 12, 26, 6, v);
  return K.c;
}
// A smithy, on the edge of town for its fire: a low log house with a stone forge in its open side, the glow, an anvil on its block.
function smithyCanvas() {
  const K = artKit(90, 66, 13),
    { g, ink, line, poly } = K;
  K.shadow(45, 61, 40, 5);
  footStones(K, 10, 80, 59);
  logWall(K, 8, 80, 34, 3, 7.4, MP.logs[2].map((q) => q * 0.9));
  g.beginPath();
  g.rect(38, 36, 30, 21);
  ink(MP.dark, 0.8);
  g.beginPath();
  g.rect(42, 46, 18, 11);
  ink(MP.stone, 0.7);
  g.fillStyle = 'rgb(255,170,70)';
  g.beginPath();
  g.ellipse(51, 46, 6, 2.6, 0, 0, 7);
  g.fill();
  turfRoof(K, 1, 88, 74, 14, 34, 12, 2);
  poly([
    [62, 15],
    [63, 3],
    [72, 3],
    [73, 18],
  ]);
  ink(MP.stone, 0.7);
  g.beginPath();
  g.rect(18, 50, 7, 8);
  ink(MP.post, 0.6);
  poly([
    [14, 50],
    [30, 50],
    [28, 46],
    [16, 46],
  ]);
  ink(MP.iron, 0.6);
  g.beginPath();
  g.moveTo(16, 46);
  g.lineTo(10, 47);
  line(MP.iron, 1.6);
  return K.c;
}
// A clay oven or kiln, domed, with its mouth and a stoker's wood: for the baker's bread, the potter's pots or burnt lime.
function kilnCanvas(v) {
  const K = artKit(50, 40, 80 + v),
    { g, ink } = K;
  K.shadow(25, 36, 22, 3.5);
  g.beginPath();
  g.ellipse(25, 34, 20, 18, 0, Math.PI, 0);
  g.closePath();
  ink(v ? [210, 196, 170] : TM.clay, 1);
  g.beginPath();
  g.ellipse(25, 34, 7, 8, 0, Math.PI, 0);
  g.closePath();
  ink(MP.dark, 0.6);
  g.fillStyle = 'rgba(255,170,70,0.9)';
  g.beginPath();
  g.ellipse(25, 33, 4, 2.5, 0, 0, 7);
  g.fill();
  for (const [x, y] of [
    [8, 26],
    [40, 24],
  ]) {
    g.beginPath();
    g.ellipse(x, y, 2.5, 1.6, 0, 0, 7);
    ink(MP.stone, 0.4);
  }
  return K.c;
}
// Barrels (the cooper's work, and what fish, butter and salt travelled in), stood and laid.
function barrelsCanvas(n) {
  const K = artKit(56, 34, 90 + n),
    { g, ink, line } = K;
  K.shadow(28, 31, 25, 3);
  for (let k = 0; k < n; k++) {
    const x = 9 + (k % 3) * 14 + (k >= 3 ? 7 : 0),
      y = k >= 3 ? 12 : 22;
    g.beginPath();
    g.ellipse(x, y + 4, 6.5, 8.5, 0, 0, 7);
    ink(MP.barn, 0.8);
    for (const d of [-4, 4]) {
      g.beginPath();
      g.moveTo(x - 6, y + 4 + d);
      g.lineTo(x + 6, y + 4 + d);
      line(MP.iron, 1);
    }
  }
  return K.c;
}
// Salt and grain in sacks.
function sacksCanvas() {
  const K = artKit(44, 28, 93),
    { g, ink } = K;
  K.shadow(22, 25, 20, 3);
  for (const [x, y] of [
    [10, 18],
    [22, 19],
    [34, 18],
    [16, 10],
    [28, 10],
  ]) {
    g.beginPath();
    g.ellipse(x, y, 6.5, 5.5, 0, 0, 7);
    ink(x === 22 ? MP.bark : [222, 204, 164], 0.7);
  }
  return K.c;
}
// A tanner's vats, sunk in the ground by the river, below the town: tan bark and hides in brown water.
function vatsCanvas() {
  const K = artKit(60, 30, 94),
    { g, ink } = K;
  for (const [x, y] of [
    [12, 14],
    [30, 18],
    [48, 13],
  ]) {
    g.beginPath();
    g.ellipse(x, y, 9, 5, 0, 0, 7);
    ink(MP.barn, 0.8);
    g.beginPath();
    g.ellipse(x, y - 0.5, 7, 3.4, 0, 0, 7);
    ink([96, 66, 40], 0.4);
  }
  g.beginPath();
  g.rect(18, 22, 14, 5);
  ink([196, 150, 110], 0.6); // a hide laid over a beam
  return K.c;
}
// Fish hung to dry on a rack of poles (hjällar), as the coast still does.
function rackCanvas() {
  const K = artKit(60, 40, 95),
    { g, line, pole, ink } = K;
  K.shadow(30, 37, 26, 2.5);
  for (const x of [6, 30, 54]) {
    pole(x - 4, 37, x + 1, 6, MP.post, 1.5);
    pole(x + 4, 37, x - 1, 6, MP.post, 1.5);
  }
  pole(3, 9, 57, 9, MP.post, 1.8);
  for (let x = 7; x < 54; x += 4.5) {
    g.beginPath();
    g.ellipse(x, 15, 1.7, 5, 0, 0, 7);
    ink(TM.fish, 0.5);
  }
  pole(3, 23, 57, 23, MP.post, 1.5);
  for (let x = 9; x < 52; x += 5) {
    g.beginPath();
    g.ellipse(x, 28.5, 1.6, 4.6, 0, 0, 7);
    ink([214, 196, 150], 0.5);
  }
  return K.c;
}
// The stone tower (kastal) that watches the harbour mouth: round, of rubble, its door high up and reached by a wooden stair, a
// wooden hoarding round its top under a shingled cone.
function kastalCanvas() {
  const K = artKit(84, 170, 3),
    { g, r, ink, line, poly, pole } = K;
  const yB = 162,
    x0 = 14,
    x1 = 70;
  K.shadow(42, yB + 2, 36, 5);
  g.beginPath();
  g.moveTo(x0, yB);
  g.lineTo(x0 + 2, 46);
  g.lineTo(x1 - 2, 46);
  g.lineTo(x1, yB);
  g.ellipse(42, yB, 28, 5, 0, 0, Math.PI);
  g.closePath();
  ink(MP.stone, 1.1);
  g.save();
  g.clip();
  const grad = g.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(40,30,30,0.28)');
  g.fillStyle = grad;
  g.fillRect(x0, 40, x1 - x0, yB);
  for (let k = 0; k < 110; k++) {
    g.beginPath();
    g.ellipse(x0 + r() * (x1 - x0), 46 + r() * (yB - 46), 2.6 + r() * 2, 1.6 + r(), 0, 0, 7);
    line([150, 140, 124], 0.7, 0.8);
  }
  g.restore();
  for (const y of [70, 104]) {
    g.beginPath();
    g.rect(40, y, 4, 11);
    ink(MP.dark, 0.5);
  }
  plankDoor(K, 30, 116, 12, 17);
  pole(36, 133, 64, yB, MP.post, 2.6); // the stair
  for (let k = 1; k < 7; k++) {
    const x = 36 + (28 * k) / 7,
      y = 133 + (29 * k) / 7;
    g.beginPath();
    g.moveTo(x - 2, y);
    g.lineTo(x + 2, y);
    line(MP.dark, 0.9);
  }
  // the hoarding and the cone
  g.beginPath();
  g.rect(x0 - 4, 32, x1 - x0 + 8, 16);
  ink(MP.board, 1);
  for (let x = x0; x < x1 + 4; x += 5) {
    g.beginPath();
    g.moveTo(x, 34);
    g.lineTo(x, 46);
    line(MP.dark, 0.6, 0.4);
  }
  for (let x = x0 + 2; x < x1; x += 11) {
    g.beginPath();
    g.rect(x, 37, 3, 6);
    ink(MP.dark, 0.4);
  }
  poly([
    [x0 - 9, 34],
    [42, 2],
    [x1 + 9, 34],
  ]);
  ink(MP.shingle, 1);
  g.save();
  poly([
    [x0 - 9, 34],
    [42, 2],
    [x1 + 9, 34],
  ]);
  g.clip();
  for (let y = 6, row = 0; y < 38; y += 4.6, row++)
    for (let x = 0 + (row % 2) * 2.3; x < 84; x += 4.6) {
      g.beginPath();
      g.arc(x, y - 2.3, 2.3, 0, Math.PI);
      line(MP.shingleDk, 0.7, 0.8);
    }
  g.restore();
  pole(42, 3, 42, -4, MP.post, 1);
  return K.c;
}
// A post mill (stubbkvarn), on a rise outside the town: a box of boards on one great post, its trestle, four sails of lattice and cloth,
// and the tail pole by which the miller turns it to the wind. The later Middle Ages, on Öland and Gotland first.
function postMillCanvas() {
  const K = artKit(110, 140, 21),
    { g, ink, line, poly, pole } = K;
  K.shadow(55, 134, 30, 4);
  pole(55, 134, 55, 92, MP.post, 4);
  pole(36, 134, 55, 104, MP.post, 2.4);
  pole(74, 134, 55, 104, MP.post, 2.4);
  pole(60, 96, 86, 132, MP.post, 2.2); // the tail pole
  g.beginPath();
  g.rect(38, 46, 34, 50);
  ink(MP.board, 1);
  for (let x = 42; x < 72; x += 4.6) {
    g.beginPath();
    g.moveTo(x, 47);
    g.lineTo(x, 95);
    line(MP.dark, 0.6, 0.35);
  }
  poly([
    [35, 48],
    [55, 34],
    [75, 48],
  ]);
  ink(MP.shingle, 0.9);
  plankDoor(K, 50, 76, 10, 20);
  const hub = [46, 56],
    a0 = 0.5;
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2,
      ux = Math.cos(a),
      uy = Math.sin(a),
      L0 = 6,
      L1 = 44,
      wx = -uy * 9,
      wy = ux * 9;
    poly([
      [hub[0] + ux * L0, hub[1] + uy * L0],
      [hub[0] + ux * L1, hub[1] + uy * L1],
      [hub[0] + ux * L1 + wx, hub[1] + uy * L1 + wy],
      [hub[0] + ux * L0 + wx, hub[1] + uy * L0 + wy],
    ]);
    ink(TM.sail, 0.8);
    for (let t = L0 + 6; t < L1; t += 6) {
      g.beginPath();
      g.moveTo(hub[0] + ux * t, hub[1] + uy * t);
      g.lineTo(hub[0] + ux * t + wx, hub[1] + uy * t + wy);
      line(MP.post, 0.7, 0.8);
    }
    pole(hub[0], hub[1], hub[0] + ux * (L1 + 2), hub[1] + uy * (L1 + 2), MP.post, 1.8);
  }
  g.beginPath();
  g.arc(hub[0], hub[1], 3, 0, 7);
  ink(MP.post, 0.6);
  return K.c;
}
// The little water mill on the stream (skvaltkvarn): a log hut on posts over the race, its wheel turning flat underneath.
function waterMillCanvas() {
  const K = artKit(60, 60, 23),
    { g, ink, line, pole } = K;
  for (const x of [12, 48]) pole(x, 58, x, 40, MP.post, 2.6);
  g.fillStyle = 'rgba(220,236,240,0.7)';
  g.beginPath();
  g.ellipse(30, 52, 16, 4, 0, 0, 7);
  g.fill();
  g.beginPath();
  g.moveTo(16, 50);
  g.lineTo(44, 50);
  line(MP.post, 2);
  logWall(K, 10, 50, 22, 3, 6.4, MP.logs[0].map((q) => q * 0.88));
  g.beginPath();
  g.rect(8, 41, 44, 3);
  ink(MP.board, 0.6);
  plankDoor(K, 23, 26, 12, 15);
  shingleRoof(K, 3, 57, 47, 13, 23, 5);
  return K.c;
}
// The town gate in the palisade: a timber tower over the way, with a shingled roof.
function gateCanvas() {
  const K = artKit(70, 110, 27),
    { g, ink, line, poly } = K;
  K.shadow(35, 106, 30, 4);
  for (const x of [6, 52]) {
    g.beginPath();
    g.rect(x, 38, 12, 68);
    ink(MP.logs[1], 1);
    for (let y = 42; y < 104; y += 6) {
      g.beginPath();
      g.moveTo(x + 1, y);
      g.lineTo(x + 11, y);
      line(MP.dark, 0.6, 0.35);
    }
  }
  g.beginPath();
  g.rect(4, 30, 62, 26);
  ink(MP.board, 1);
  for (let x = 8; x < 64; x += 4.6) {
    g.beginPath();
    g.moveTo(x, 31);
    g.lineTo(x, 55);
    line(MP.dark, 0.6, 0.35);
  }
  for (const x of [16, 30, 44]) {
    g.beginPath();
    g.rect(x, 38, 6, 8);
    ink(MP.dark, 0.5);
  }
  poly([
    [0, 32],
    [35, 6],
    [70, 32],
  ]);
  ink(MP.shingle, 1);
  g.beginPath();
  g.rect(18, 56, 34, 50);
  ink(MP.dark, 0);
  g.fillStyle = 'rgba(40,30,24,0.55)';
  g.fillRect(18, 56, 34, 50);
  return K.c;
}
// A tub of cabbages and a bed: the kålgård behind a house; drawn straight on the map, below.

// ---- on the map ----
const tmPlace = (tex, x, y, ay = 0.92, sc = ART_S, layer = L.objects) => place(tex, x, y, 0.5, ay, layer, sc);
const TWAY = [
  [1.8, 'rgba(146,132,76,0.2)'],
  [1.35, 'rgba(86,70,42,0.48)'],
  [1, 'rgba(182,152,106,0.95)'],
  [0.42, 'rgba(212,188,140,0.55)'],
];
const rgbaOf = (s) => {
  const m = s.match(/[\d.]+/g).map(Number);
  return { color: (m[0] << 16) | (m[1] << 8) | m[2], alpha: m[3] };
};
// A street or lane in the colours of draw/paths' lanes: verge, rim, bare earth and the packed middle.
function tmWay(pts, wd = 9) {
  const g = new PIXI.Graphics();
  for (const [k, c] of TWAY) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    const { color, alpha } = rgbaOf(c);
    g.stroke({ width: wd * k, color, alpha, cap: 'round', join: 'round' });
  }
  L.fences.addChild(g);
  return g;
}
// An open place of trodden earth: the market square, a yard.
function tmGround(pts, a = 0.9) {
  const g = new PIXI.Graphics();
  g.poly(pts.flat()).fill({ color: 0x92844c, alpha: 0.28 * a });
  g.poly(pts.flat()).stroke({ width: 6, color: 0x92844c, alpha: 0.22 * a, join: 'round' });
  g.poly(pts.flat()).fill({ color: 0xb6986a, alpha: 0.85 * a });
  L.fences.addChild(g);
  return g;
}
// Cobbles over the market's middle.
function tmCobbles(cx, cy, rx, ry, seed) {
  const g = new PIXI.Graphics(),
    r = Noise.mulberry32(seed);
  for (let k = 0; k < (rx * ry) / 6; k++) {
    const a = r() * 7,
      d = Math.sqrt(r());
    g.ellipse(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 1.1 + r() * 0.5, 0.8);
  }
  g.fill({ color: 0xd2c09a, alpha: 0.8 }).stroke({ width: 0.3, color: INK, alpha: 0.35 });
  L.fences.addChild(g);
}
// A quay: a deck of planks on log cribs filled with stone, built out over the water.
function tmQuay(x0, y0, x1, y1) {
  const g = new PIXI.Graphics();
  g.rect(x0, y0, x1 - x0, y1 - y0)
    .fill({ color: 0xc8a064 })
    .stroke({ width: 0.9, color: INK });
  const w = x1 - x0,
    h = y1 - y0;
  if (w > h)
    for (let x = x0 + 2.2; x < x1; x += 2.2) g.moveTo(x, y0 + 0.4).lineTo(x, y1 - 0.4);
  else for (let y = y0 + 2.2; y < y1; y += 2.2) g.moveTo(x0 + 0.4, y).lineTo(x1 - 0.4, y);
  g.stroke({ width: 0.35, color: 0x7a5636, alpha: 0.7 });
  // the cribs' faces below the deck on the water side
  g.rect(x0, y1, x1 - x0, 2.6)
    .fill({ color: 0x8a6440 })
    .stroke({ width: 0.6, color: INK });
  for (let x = x0 + 1.5; x < x1; x += 6) g.circle(x, y1 + 1.3, 0.9);
  g.fill({ color: 0xe8d6a8 }).stroke({ width: 0.3, color: INK });
  g.zIndex = y0 - 3;
  L.objects.addChild(g);
}
// A palisade of pointed stakes along a line, the town's defence before (and in most Swedish towns instead of) a wall.
function tmPalisade(pts) {
  const g = new PIXI.Graphics();
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k],
      [x1, y1] = pts[k + 1],
      n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.6));
    for (let j = 0; j < n; j++) {
      const x = x0 + ((x1 - x0) * j) / n,
        y = y0 + ((y1 - y0) * j) / n;
      g.poly([x - 0.8, y, x - 0.8, y - 5.5, x, y - 6.8, x + 0.8, y - 5.5, x + 0.8, y]);
    }
  }
  g.fill({ color: 0xb4824e }).stroke({ width: 0.4, color: INK });
  g.zIndex = Math.max(...pts.map((p) => p[1])) - 6;
  L.objects.addChild(g);
}
// A low wall of fieldstone round the churchyard, with its roofed gate (stiglucka).
function tmStoneWall(pts) {
  const g = new PIXI.Graphics();
  for (let k = 0; k < pts.length; k++) {
    const [x0, y0] = pts[k],
      [x1, y1] = pts[(k + 1) % pts.length],
      n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.5));
    for (let j = 0; j < n; j++) g.ellipse(x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n - 0.6, 1.1, 0.9);
  }
  g.fill({ color: 0xd8d0c0 }).stroke({ width: 0.35, color: INK });
  L.fences.addChild(g);
}
// A bridge of planks on trestles over the river.
function tmBridge(x0, y0, x1, y1, wd = 6) {
  const g = new PIXI.Graphics(),
    L0 = Math.hypot(x1 - x0, y1 - y0),
    ux = (x1 - x0) / L0,
    uy = (y1 - y0) / L0,
    nx = -uy * (wd / 2),
    ny = ux * (wd / 2);
  g.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny])
    .fill({ color: 0xc8a064 })
    .stroke({ width: 0.8, color: INK });
  for (let t = 1.4; t < L0; t += 1.6) g.moveTo(x0 + ux * t + nx, y0 + uy * t + ny).lineTo(x0 + ux * t - nx, y0 + uy * t - ny);
  g.stroke({ width: 0.3, color: 0x7a5636, alpha: 0.8 });
  for (const s of [1, -1]) g.moveTo(x0 + nx * s, y0 + ny * s).lineTo(x1 + nx * s, y1 + ny * s);
  g.stroke({ width: 0.9, color: 0x96462f });
  g.zIndex = Math.max(y0, y1) - 4;
  L.objects.addChild(g);
}
// A kitchen garden behind a house: beds of cabbage, beans and onions, and a wattle hedge round it.
function tmGarden(x, y, w, h, seed) {
  const g = new PIXI.Graphics(),
    r = Noise.mulberry32(seed);
  g.rect(x, y, w, h).fill({ color: 0x8a6a46, alpha: 0.85 });
  for (let yy = y + 1.6; yy < y + h - 0.8; yy += 2.4)
    for (let xx = x + 1.4; xx < x + w - 0.8; xx += 2.2) g.circle(xx + r() * 0.4, yy, 0.85 + r() * 0.3);
  g.fill({ color: 0x78a060 }).stroke({ width: 0.25, color: 0x3c5a34 });
  g.rect(x, y, w, h).stroke({ width: 0.9, color: 0x96703e });
  g.rect(x, y, w, h).stroke({ width: 0.3, color: INK, alpha: 0.7 });
  L.fences.addChild(g);
}
// A game fence (page/beastart drawFence) along a line of points: the roundpole fence round the town's fields.
function tmFence(pts, id) {
  const edges = [];
  for (let k = 0; k + 1 < pts.length; k++) edges.push({ x1: pts[k][0], y1: pts[k][1], x2: pts[k + 1][0], y2: pts[k + 1][1], tile: id });
  const g = new PIXI.Graphics();
  drawFence(g, { id, cond: 1, edges });
  L.fences.addChild(g);
}
// The market cross: a stone shaft on steps, where the town law was read and the market's peace proclaimed.
function tmCross(x, y) {
  const g = new PIXI.Graphics();
  g.ellipse(x, y, 5, 2.4).fill({ color: 0xd8d0c0 }).stroke({ width: 0.6, color: INK });
  g.ellipse(x, y - 1.2, 3.4, 1.6).fill({ color: 0xe4ddce }).stroke({ width: 0.5, color: INK });
  g.rect(x - 0.8, y - 13, 1.6, 12).fill({ color: 0xe4ddce }).stroke({ width: 0.5, color: INK });
  g.rect(x - 3, y - 11, 6, 1.4).fill({ color: 0xe4ddce }).stroke({ width: 0.5, color: INK });
  g.zIndex = y;
  L.objects.addChild(g);
}
// People: small figures in the market and on the quay, in the pawns' manner (a body, a head, a hood), standing.
function tmPerson(x, y, c, seed) {
  const g = new PIXI.Graphics(),
    r = Noise.mulberry32(seed);
  const cols = [0xa0463a, 0x5a7aa0, 0x8a9a5a, 0xd8c08a, 0x7a5a46, 0xe8e0cc];
  const body = cols[(c ?? (r() * cols.length)) | 0];
  g.ellipse(x, y + 0.2, 2.2, 0.8).fill({ color: 0x1e2c1e, alpha: 0.3 });
  g.poly([x - 1.6, y, x - 1.1, y - 4.6, x + 1.1, y - 4.6, x + 1.6, y])
    .fill({ color: body })
    .stroke({ width: 0.45, color: INK });
  g.circle(x, y - 5.6, 1.15).fill({ color: 0xeac8a0 }).stroke({ width: 0.4, color: INK });
  if (r() < 0.5) g.moveTo(x + 1.25, y - 5.8).arc(x, y - 5.8, 1.25, 0, Math.PI, true).closePath().fill({ color: r() < 0.5 ? 0xe8e0cc : 0x6a4a36 });
  g.zIndex = y;
  L.objects.addChild(g);
}
function tmCows(x, y, n, seed) {
  const r = Noise.mulberry32(seed);
  for (let k = 0; k < n; k++) {
    const s = new PIXI.Sprite(art.cow[(r() * art.cow.length) | 0][r() < 0.5 ? 0 : 1]);
    s.anchor.set(0.5, 0.9);
    s.scale.set(0.21 * (r() < 0.5 ? -1 : 1), 0.21);
    s.position.set(x + (r() - 0.5) * 30, y + (r() - 0.5) * 18);
    s.zIndex = s.y;
    L.objects.addChild(s);
  }
}
function tmSmoke(x, y, n = 3) {
  for (let k = 0; k < n; k++) {
    const p = new PIXI.Sprite(art.puff);
    p.anchor.set(0.5);
    p.position.set(x + k * 1.6, y - k * 3.2);
    p.scale.set(0.12 + k * 0.05);
    p.alpha = 0.7 - k * 0.18;
    p.zIndex = 1e6;
    L.objects.addChild(p);
  }
}

// A sea mark (båk) on the point: a tall timber trestle with a cask on top, that the skippers steer by into the harbour.
function bakCanvas() {
  const K = artKit(50, 130, 29),
    { g, ink, pole } = K;
  K.shadow(25, 126, 20, 3.5);
  pole(8, 126, 22, 26, MP.post, 3);
  pole(42, 126, 28, 26, MP.post, 3);
  pole(25, 126, 25, 20, MP.post, 3);
  for (const y of [100, 72, 46]) pole(8 + (126 - y) * 0.14, y, 42 - (126 - y) * 0.14, y, MP.post, 1.8);
  g.beginPath();
  g.ellipse(25, 16, 9, 11, 0, 0, 7);
  ink(MP.barn, 0.9);
  for (const d of [-5, 5]) pole(16.5, 16 + d, 33.5, 16 + d, MP.iron, 1);
  return K.c;
}
// The market toll's bar across the road where it comes into town (tullbom), and the toll-keeper's booth: not a defence, a till.
function tollCanvas() {
  const K = artKit(80, 50, 33),
    { g, ink, line, pole } = K;
  K.shadow(40, 46, 34, 3);
  g.beginPath();
  g.rect(48, 22, 24, 22);
  ink(MP.logs[0], 0.9);
  K.poly([
    [45, 24],
    [60, 10],
    [75, 24],
  ]);
  ink(MP.turf[0], 0.9);
  g.beginPath();
  g.rect(55, 28, 9, 7);
  ink(MP.dark, 0.6);
  pole(8, 46, 8, 26, MP.post, 2.6);
  pole(4, 27, 46, 27, [224, 210, 180], 2.4);
  for (let x = 12; x < 44; x += 8) {
    g.beginPath();
    g.moveTo(x, 27);
    g.lineTo(x + 4, 27);
    line([190, 64, 46], 2.4);
  }
  return K.c;
}
const TM_MAKE = {
  bak: () => bakCanvas(),
  toll: () => tollCanvas(),
  house: (v, o) => gableHouseCanvas(o, v),
  merchant: (v) => merchantCanvas(v),
  church: () => churchCanvas(),
  booth: (v) => boothCanvas(v),
  cog: () => cogCanvas(),
  boat: (v) => boatCanvas(v),
  sjobod: (v) => sjobodCanvas(v),
  smithy: () => smithyCanvas(),
  kiln: (v) => kilnCanvas(v),
  barrels: (v) => barrelsCanvas(v || 5),
  sacks: () => sacksCanvas(),
  vats: () => vatsCanvas(),
  rack: () => rackCanvas(),
  kastal: () => kastalCanvas(),
  postmill: () => postMillCanvas(),
  watermill: () => waterMillCanvas(),
  gate: () => gateCanvas(),
};
// One thing of the plan: {k, at: [col, row], d: [dx, dy] in world units from the tile's middle, v, o, sc, flip}.
function tmThing(w, t) {
  const i = t.at[1] * w.COLS + t.at[0],
    x = w.hx[i] + (t.at[2] || 0),
    y = w.hy[i] + (t.at[3] || 0),
    v = t.v || 0;
  const key = t.k + ':' + v + ':' + JSON.stringify(t.o || {});
  const tex = t.k === 'art' ? (Array.isArray(art[t.name]) ? art[t.name][v] : art[t.name]) : tmT(key, () => TM_MAKE[t.k](v, t.o || {}));
  const s = tmPlace(tex, x, y, t.ay || 0.94, ART_S * (t.sc || 1));
  if (t.flip) s.scale.x *= -1;
  if (t.z !== undefined) s.zIndex = y + t.z;
  return s;
}
// The plan's quarters as hexes (plan-hex.js): each a hex of trodden yard like a farm's, and streets along the edges between two
// town hexes that are not of one group (the church's two hexes share their yard). Neighbours by direction: E, NE, NW, W, SW, SE.
const TM_DIRS = [
  [
    [1, 0],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ],
  [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 1],
  ],
];
const TM_EDGE = [
  [330, 30],
  [270, 330],
  [210, 270],
  [150, 210],
  [90, 150],
  [30, 90],
];
function tmHexes(w, H) {
  const key = (c, r) => c + ',' + r,
    grp = new Map(H.hexes.map((h) => [key(h.at[0], h.at[1]), h.group || key(h.at[0], h.at[1])])),
    R = w.R,
    done = new Set();
  for (const h of H.hexes) {
    const i = h.at[1] * w.COLS + h.at[0],
      x = w.hx[i],
      y = w.hy[i];
    if (h.yard !== false) {
      const s = place(art.yard, x, y + 1, 0.5, 0.5, L.fields, 0.27);
      s.alpha = h.yard || 0.9;
    }
  }
  const segs = [];
  for (const h of H.hexes) {
    const [c, r] = h.at,
      i = r * w.COLS + c,
      x = w.hx[i],
      y = w.hy[i];
    TM_DIRS[r & 1].forEach(([dc, dr], k) => {
      const n = key(c + dc, r + dr),
        e = [key(c, r), n].sort().join('|');
      if (!grp.has(n) || grp.get(n) === grp.get(key(c, r)) || done.has(e)) return;
      done.add(e);
      const p = TM_EDGE[k].map((deg) => [x + R * Math.cos((deg * Math.PI) / 180), y + R * Math.sin((deg * Math.PI) / 180)]);
      segs.push(p);
    });
  }
  if (H.edges !== false) for (const p of segs) tmWay(p, H.street || 7);
}
// Straight streets on the hex grid's lines (Kim, 27 November): each street is a run of tiles in a row or on a diagonal, drawn straight
// through their middles and on to the edges at its ends; a quarter off the streets gets one straight way from its middle to the
// neighbour's (its door, as a farm's). Then each quarter's buildings are placed along the ways through it, on both sides, never on them:
// candidate feet on a grid in the hex, a building's footing (16 wide, 6 deep) clear of every way's band, nearest the way
// first, none overlapping, up to the quarter's count.
function tmStraight(w, S) {
  const C = (c, r) => {
    const i = r * w.COLS + c;
    return [w.hx[i], w.hy[i]];
  };
  const ways = [];
  for (const st0 of S.streets) {
    const pts = st0.tiles.map(([c, r]) => C(c, r));
    const ext = (a, b) => [a[0] + (a[0] - b[0]) * 0.5, a[1] + (a[1] - b[1]) * 0.5];
    const line = [st0.open0 ? ext(pts[0], pts[1]) : pts[0], ...pts, st0.open1 ? ext(pts.at(-1), pts.at(-2)) : pts.at(-1)];
    ways.push({ a: line[0], b: line.at(-1), w: st0.w || 9 });
    tmWay(line, st0.w || 9);
  }
  for (const s of S.spurs || []) {
    const a = C(...s.from),
      b = C(...s.to);
    ways.push({ a, b, w: 6 });
    tmWay([a, b], 6);
  }
  const dSeg = (p, s) => {
    const dx = s.b[0] - s.a[0],
      dy = s.b[1] - s.a[1],
      t = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - s.a[0] - t * dx, p[1] - s.a[1] - t * dy);
  };
  const out = [];
  for (const q of S.quarters) {
    const [cx, cy] = C(...q.at),
      picks = [],
      cand = [];
    for (let y = -10; y <= 24; y += 3)
      for (let x = -18; x <= 18; x += 3) {
        const fx = cx + x,
          fy = cy + y;
        // inside the hex (pointy top, R 28), a little in from its edges
        if (Math.abs(x) > 19 || Math.abs(x) * 0.5 + Math.abs(y) * 0.866 > 23) continue;
        let clear = Infinity;
        for (let sx = -7; sx <= 7; sx += 3.5)
          for (let sy = -6; sy <= 0; sy += 3) // the foot and the ground before the door: a house may stand in front of a way, as seen from above
            for (const wy of ways) clear = Math.min(clear, dSeg([fx + sx, fy + sy], wy) - wy.w / 2);
        if (clear < 1.2) continue;
        cand.push({ x: fx, y: fy, clear });
      }
    cand.sort((a, b) => a.clear - b.clear || a.y - b.y);
    for (const c of cand) {
      if (picks.length >= q.n) break;
      if (picks.some((p) => Math.abs(p.x - c.x) < 15 && Math.abs(p.y - c.y) < 14)) continue;
      picks.push(c);
    }
    picks.sort((a, b) => a.y - b.y || a.x - b.x);
    picks.forEach((p, k) => out.push({ q, k, x: p.x, y: p.y }));
  }
  return out;
}
function townLabels() {
  const w = st.w;
  for (let i = 0; i < w.N; i++) {
    if (w.water[i]) continue;
    const t = new PIXI.Text({
      text: `${i % w.COLS},${(i / w.COLS) | 0}`,
      style: { fontSize: 9, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } },
    });
    t.anchor.set(0.5);
    t.position.set(w.hx[i], w.hy[i]);
    t.zIndex = 1e7;
    L.labels.addChild(t);
  }
}
function townDraw(P) {
  const w = st.w,
    at = (c, r, dx = 0, dy = 0) => {
      const i = r * w.COLS + c;
      return [w.hx[i] + dx, w.hy[i] + dy];
    },
    pts = (list) => list.map((p) => at(...p));
  window.__town.at = at;
  if (P.labels) {
    townLabels();
    return { W: w.W, H: w.H, R: w.R };
  }
  for (const f of P.fields || []) {
    const sp = new PIXI.Sprite(fieldTex[f.look || 'ripe'] || fieldTex.stubble);
    sp.anchor.set(0.5);
    sp.scale.set(0.5);
    sp.rotation = f.rot || 0;
    sp.position.set(...at(...f.at));
    L.fields.addChild(sp);
  }
  for (const m of P.meadows || []) {
    const sp = new PIXI.Sprite(fieldTex['meadow-' + (m.look || 'grass')]);
    sp.anchor.set(0.5);
    sp.scale.set(0.5);
    sp.position.set(...at(...m.at));
    L.fields.addChild(sp);
  }
  if (P.quarters) tmHexes(w, P.quarters);
  for (const gr of P.ground || []) tmGround(pts(gr.pts || gr), gr.a || 1);
  for (const c of P.cobbles || []) tmCobbles(...at(...c.at), c.rx, c.ry, c.seed || 1);
  for (const s of P.streets || []) tmWay(pts(s.pts), s.w || 9);
  for (const gd of P.gardens || []) tmGarden(...at(...gd.at), gd.w, gd.h, gd.seed || 3);
  for (const q of P.quays || []) {
    const [x0, y0] = at(...q.a),
      [x1, y1] = at(...q.b);
    tmQuay(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
  }
  for (const b of P.bridges || []) tmBridge(...at(...b.a), ...at(...b.b), b.w || 6);
  for (const sw of P.stoneWalls || []) tmStoneWall(pts(sw));
  for (const f of P.fences || []) tmFence(pts(f), 9000 + (P.fences.indexOf(f) | 0));
  for (const p of P.palisade || []) tmPalisade(pts(p));
  if (P.straight) {
    const spots = tmStraight(w, P.straight);
    for (const s of spots) {
      const t = s.q.items[s.k];
      if (!t) continue;
      const i = s.q.at[1] * w.COLS + s.q.at[0];
      tmThing(w, { ...t, at: [s.q.at[0], s.q.at[1], s.x - w.hx[i], s.y - w.hy[i]] });
    }
  }
  for (const t of P.things || []) tmThing(w, t);
  for (const c of P.crosses || []) tmCross(...at(...c));
  for (const p of P.people || []) tmPerson(...at(...p.at), p.c, p.seed || 1);
  for (const c of P.cows || []) tmCows(...at(...c.at), c.n, c.seed || 1);
  for (const s of P.smoke || []) tmSmoke(...at(...s));
  if (P.label) {
    const [x, y] = at(...P.label.at),
      t = new PIXI.Text({
        text: P.label.text,
        style: { fontFamily: 'serif', fontSize: 18, fontStyle: 'italic', fontWeight: 'bold', fill: 0xfdf6e3, stroke: { color: 0x2c201c, width: 3 } },
      });
    t.anchor.set(0.5);
    t.position.set(x, y);
    t.zIndex = 1e7;
    L.labels.addChild(t);
  }
  return { W: w.W, H: w.H, R: w.R };
}
