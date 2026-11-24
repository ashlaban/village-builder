// @sys page/fieldart: field and meadow art by stage, and the art atlas of the settlement
function hexClip(g, cx, cy, r) {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (30 + 60 * k);
    g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}
// Fields and meadows as a mural's ground: a flat earth or crop colour, the rows and what grows in them as ordered marks, and a brown
// contour round the tile, so that the infields lie like leaded panes.
const FIELD_P = {
  stubble: { base: [222, 198, 126], row: [182, 146, 80], hi: [240, 222, 160] },
  plowed: { base: [152, 104, 70], row: [110, 72, 48], hi: [186, 136, 94] },
  sown: { base: [162, 114, 78], row: [122, 82, 54], hi: [240, 218, 152] },
  young: { base: [164, 120, 80], row: [126, 86, 56], hi: [132, 182, 86] },
  growing: { base: [128, 168, 82], row: [90, 134, 62], hi: [176, 206, 108] },
  ripe: { base: [238, 198, 94], row: [204, 152, 56], hi: [252, 228, 138] },
  fallow: { base: [158, 174, 98], row: [114, 142, 72], hi: [200, 204, 124] },
  scrub: { base: [138, 158, 88], row: [82, 116, 64], hi: [168, 184, 106] },
  // each crop at its stage (VB-355), drawn as the stage `as` in its own colours; barley's are the stages above. Rye stands green in
  // autumn and under snow in winter, bluer than barley as it grows and paler ripe; peas flower white and ripen olive; a fallow course
  // lies in weedy stubble (lea) until it is tilled.
  'wheat-young': { as: 'young', base: [152, 119, 76], row: [110, 86, 55], hi: [158, 207, 114] },
  'wheat-growing': { as: 'growing', base: [143, 159, 75], row: [104, 116, 54], hi: [198, 224, 149] },
  'wheat-ripe': { as: 'ripe', base: [205, 154, 56], row: [149, 112, 40], hi: [255, 231, 158] },
  'oats-young': { as: 'young', base: [142, 119, 84], row: [103, 86, 61], hi: [158, 207, 114] },
  'oats-growing': { as: 'growing', base: [116, 155, 129], row: [84, 113, 94], hi: [198, 224, 149] },
  'oats-ripe': { as: 'ripe', base: [201, 192, 151], row: [146, 140, 110], hi: [249, 241, 208] },
  'rye-young': { as: 'young', base: [146, 172, 92], row: [108, 142, 68], hi: [188, 216, 122] },
  'rye-snow': { as: 'young', base: [236, 240, 244], row: [204, 213, 224], hi: [112, 160, 88] },
  'rye-growing': { as: 'growing', base: [112, 156, 108], row: [78, 122, 84], hi: [166, 198, 146] },
  'rye-ripe': { as: 'ripe', base: [226, 208, 144], row: [186, 164, 96], hi: [246, 234, 182] },
  'peas-young': { as: 'young', base: [164, 120, 80], row: [126, 86, 56], hi: [104, 166, 98] },
  'peas-growing': { as: 'growing', base: [100, 154, 92], row: [66, 120, 68], hi: [244, 244, 238], dot: true },
  'peas-ripe': { as: 'ripe', base: [184, 176, 102], row: [138, 132, 68], hi: [222, 214, 142] },
  lea: { as: 'stubble', base: [200, 194, 124], row: [140, 156, 82], hi: [164, 190, 104] },
  tilled: { as: 'plowed', base: [128, 90, 64], row: [92, 62, 44], hi: [164, 120, 86] },
};
function drawCropPlant(g, crop, stage, x, y, stem, light) {
  const young = stage === 'young';
  const height = (crop === 'rye' ? 10 : crop === 'peas' ? 5 : 8) * (young ? 0.55 : 1);
  const lean = crop === 'barley' ? 2.5 : crop === 'rye' ? 1 : 0;
  const tip = x + lean,
    top = y - height;
  function leaf(dx, dy, width, length, tilt) {
    g.beginPath();
    g.ellipse(dx, dy, width, length, tilt, 0, Math.PI * 2);
    g.fill();
  }
  function stroke(ax, ay, bx, by) {
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
  }
  g.strokeStyle = stem;
  g.lineWidth = 1.2;
  stroke(x, y, tip, top);
  g.fillStyle = young && crop === 'peas' ? '#89bc77' : light;
  if (crop === 'peas') {
    leaf(x - 1.4, y - 1.4, 1.3, 2, -0.9);
    leaf(x + 1.5, top + 1, 1.3, stage === 'ripe' ? 3 : 1.8, 0.6);
    if (stage === 'growing') leaf(x - 1, top, 1.6, 1.5, 0);
  } else if (young) {
    leaf(tip, top + 1, crop === 'wheat' ? 1.5 : 0.75, 2, lean * 0.2);
    stroke(x, y, x - (crop === 'oats' ? 3.5 : 1.5), y - 2.8);
  } else if (crop === 'oats') {
    for (const side of [-1, 1]) {
      const end = tip + side * 3.3,
        drop = top + (side < 0 ? 2 : 3.5);
      stroke(tip, top, end, drop);
      leaf(end, drop + 1, 1, 1.8, -side * 0.18);
    }
  } else if (crop === 'wheat') {
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      leaf(tip + side * 0.9, top + i * 0.95, 1, 1.7, side * 0.5);
    }
  } else if (crop === 'barley') {
    leaf(tip, top + 1, 1.25, 2.3, 0.8);
    g.strokeStyle = light;
    g.lineWidth = 0.85;
    for (let i = 0; i < 3; i++) stroke(tip + i - 1, top + 2 - i, tip + i * 1.3, top - 2.5);
  } else {
    leaf(tip, top + 1, 0.9, 3.1, 0.12);
  }
}
function fieldCanvas(look, R) {
  const S = 2,
    Wc = Math.ceil(Math.sqrt(3) * R * S) + 2,
    Hc = Math.ceil(2 * R * S) + 2,
    c = makeCanvas(Wc, Hc),
    g = c.getContext('2d');
  const cx = Wc / 2,
    cy = Hc / 2,
    rr0 = R * S * 0.92,
    stage = FIELD_P[look].as || look,
    r = Noise.mulberry32(stage.length * 977 + 5),
    crop = look.includes('-') ? look.split('-')[0] : 'barley',
    P = FIELD_P[look];
  const rgb = (a, f = 1) => `rgb(${(a[0] * f) | 0},${(a[1] * f) | 0},${(a[2] * f) | 0})`;
  g.save();
  hexClip(g, cx, cy, rr0);
  g.clip();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = rgb(P.base);
  g.fillRect(0, 0, Wc, Hc);
  for (let y = 5, row = 0; y < Hc; y += 9, row++) {
    const off = (row % 2) * 3.5;
    if (stage === 'fallow') {
      // tufts of grass and weeds in loose rows
      for (let x = off + r() * 3; x < Wc; x += 8 + r() * 3) {
        const yy = y + (r() - 0.5) * 3;
        g.strokeStyle = rgb(r() < 0.3 ? P.hi : P.row);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(x - 1.6, yy - 3);
        g.lineTo(x, yy);
        g.lineTo(x + 1.8, yy - 3.2);
        g.stroke();
      }
      continue;
    }
    if (stage === 'scrub') {
      // young bushes taking the field back, each with its contour
      for (let x = off * 2 + r() * 6; x < Wc; x += 13 + r() * 8)
        if (r() < 0.6) {
          const yy = y + (r() - 0.5) * 5,
            rad = 2.6 + r() * 2.2;
          g.beginPath();
          g.arc(x, yy, rad, 0, 7);
          g.fillStyle = rgb(P.row, 0.95 + r() * 0.15);
          g.fill();
          g.strokeStyle = 'rgba(44,32,28,0.6)';
          g.lineWidth = 1;
          g.stroke();
        }
      continue;
    }
    // the furrow, or the row of the crop
    g.strokeStyle = rgb(P.row);
    g.lineWidth = stage === 'growing' || stage === 'ripe' ? 4.6 : 2.2;
    g.beginPath();
    for (let x = 0; x <= Wc; x += 6) g[x ? 'lineTo' : 'moveTo'](x, y + Math.sin(x * 0.2 + y) * 0.7);
    g.stroke();
    if (stage === 'plowed') {
      g.strokeStyle = rgb(P.hi);
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(0, y - 3.4);
      g.lineTo(Wc, y - 3.4);
      g.stroke();
    }
    for (let x = off + 2; x < Wc; x += stage === 'ripe' || stage === 'growing' ? 10 : 7) {
      if (stage === 'stubble') {
        g.strokeStyle = rgb(P.hi);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(x, y + 1);
        g.lineTo(x + 0.8, y - 3);
        g.stroke();
      } else if (stage === 'sown') {
        g.fillStyle = rgb(P.hi);
        g.beginPath();
        g.arc(x + 1.5, y - 0.2, 0.9, 0, 7);
        g.fill();
      } else {
        drawCropPlant(g, crop, stage, x, y + r() * 1.2, rgb(P.row, 0.73), rgb(P.hi));
      }
    }
  }
  g.restore();
  hexClip(g, cx, cy, rr0);
  g.strokeStyle = 'rgba(70,44,30,0.55)';
  g.lineWidth = 2.2;
  g.stroke();
  return c;
}
// A hay meadow (VB-132): flowering grass, the flowers set as a painter strews them; mown, with windrows of drying hay and haycocks;
// aftermath, short regrowth.
function meadowCanvas(stage, R) {
  const S = 2,
    Wc = Math.ceil(Math.sqrt(3) * R * S) + 2,
    Hc = Math.ceil(2 * R * S) + 2,
    c = makeCanvas(Wc, Hc),
    g = c.getContext('2d');
  const cx = Wc / 2,
    cy = Hc / 2,
    rr0 = R * S * 0.92,
    r = Noise.mulberry32(stage.length * 131 + 9);
  const base = { grass: [130, 174, 90], mown: [178, 188, 106], aftermath: [148, 180, 94] }[stage];
  const rgb = (a, f = 1) => `rgb(${a.map((v) => Math.min(255, v * f) | 0)})`;
  g.save();
  hexClip(g, cx, cy, rr0);
  g.clip();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, Wc, Hc);
  const step = stage === 'grass' ? 8 : stage === 'aftermath' ? 11 : 15,
    tall = stage === 'grass' ? 4 : 2.4;
  for (let y = 4, row = 0; y < Hc; y += step, row++)
    for (let x = (row % 2) * step * 0.5 + r() * 2; x < Wc; x += step) {
      const xx = x + (r() - 0.5) * 3,
        yy = y + (r() - 0.5) * 3;
      g.strokeStyle = rgb(base, r() < 0.35 ? 1.2 : 0.78);
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(xx - 1.6, yy - tall);
      g.lineTo(xx, yy);
      g.lineTo(xx + 1.8, yy - tall - 0.3);
      g.stroke();
    }
  if (stage !== 'mown') {
    const gap = stage === 'grass' ? 13 : 30,
      cols = [
        [250, 246, 232],
        [236, 194, 72],
        [192, 66, 48],
        [96, 124, 176],
        [250, 246, 232],
      ];
    for (let y = 7, row = 0; y < Hc; y += gap, row++)
      for (let x = (row % 2) * gap * 0.5 + 3; x < Wc; x += gap) {
        const xx = x + (r() - 0.5) * 6,
          yy = y + (r() - 0.5) * 6,
          k = (r() * cols.length) | 0;
        g.fillStyle = rgb(cols[k]);
        g.beginPath();
        g.arc(xx, yy, 1.9, 0, 7);
        g.fill();
        if (k % 4 === 0) {
          g.fillStyle = rgb(cols[1]);
          g.beginPath();
          g.arc(xx, yy, 0.8, 0, 7);
          g.fill();
        }
      }
  } else {
    for (let y = 10; y < Hc; y += 16) {
      // windrows
      g.beginPath();
      for (let x = 0; x <= Wc; x += 6) g[x ? 'lineTo' : 'moveTo'](x, y + Math.sin(x * 0.08 + y) * 2.5);
      g.strokeStyle = 'rgba(70,54,34,0.7)';
      g.lineWidth = 6.4;
      g.stroke();
      g.strokeStyle = 'rgb(222,204,118)';
      g.lineWidth = 4.4;
      g.stroke();
    }
    for (let k = 0; k < 7; k++) {
      // haycocks
      const x = cx + (r() - 0.5) * Wc * 0.6,
        y = cy + (r() - 0.5) * Hc * 0.55;
      g.fillStyle = 'rgba(30,44,30,0.3)';
      g.beginPath();
      g.ellipse(x + 1, y + 4, 7, 2.6, 0, 0, 7);
      g.fill();
      g.fillStyle = 'rgb(214,196,112)';
      g.beginPath();
      g.moveTo(x - 7, y + 4);
      g.quadraticCurveTo(x, y - 12, x + 7, y + 4);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(44,32,28,0.85)';
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
  g.restore();
  hexClip(g, cx, cy, rr0);
  g.strokeStyle = 'rgba(60,84,40,0.5)';
  g.lineWidth = 2;
  g.stroke();
  return c;
}
function makeArt(R) {
  const T = (c) => texFrom(c, { autoGenerateMipmaps: true, resolution: c.artK || 1 });
  fieldTex = {};
  for (const k of Object.keys(FIELD_P)) fieldTex[k] = T(fieldCanvas(k, R));
  for (const k of ['grass', 'mown', 'aftermath']) fieldTex['meadow-' + k] = T(meadowCanvas(k, R));
  art = {
    stuga: [0, 1, 2].map((v) => T(stugaCanvas(v))),
    harbre: T(harbreCanvas()),
    lada: T(ladaCanvas()),
    wood: [0, 1, 2, 3].map((l) => T(woodpileCanvas(l))),
    sweep: T(wellSweepCanvas()),
    curb: T(curbCanvas()),
    stook: [0, 1].map((v) => T(stookCanvas(v))),
    yard: T(yardCanvas()),
    cart: Object.fromEntries(
      ['hand', 'ox'].map((kind) => [
        kind,
        Object.fromEntries(
          ['none', 'sheaf', 'hay', 'logs'].map((load) => [
            load,
            [false, true].map((worn) => T(cartCanvas(kind, load, worn))),
          ]),
        ),
      ]),
    ),
    puff: T(puffCanvas()),
    byre: T(byreCanvas()),
    lit: T(stugaLitCanvas()),
    glow: T(glowCanvas()),
    haystack: [0, 1, 2, 3].map((l) => T(haystackCanvas(l))),
    manure: [0, 1, 2].map((l) => T(manureCanvas(l))),
    cow: COATS.map((_, k) => [T(cowCanvas(k, 0)), T(cowCanvas(k, 1))]),
    sheep: [T(sheepCanvas(0)), T(sheepCanvas(1))],
    deer: [0, 1].map((coat) => [T(deerCanvas(coat, 0)), T(deerCanvas(coat, 1))]), // roe deer (VB-139, page/deer)
  };
  atlas = buildAtlas();
}
