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
};
function fieldCanvas(stage, R) {
  const S = 2,
    Wc = Math.ceil(Math.sqrt(3) * R * S) + 2,
    Hc = Math.ceil(2 * R * S) + 2,
    c = makeCanvas(Wc, Hc),
    g = c.getContext('2d');
  const cx = Wc / 2,
    cy = Hc / 2,
    rr0 = R * S * 0.92,
    r = G.mulberry32(stage.length * 977 + 5),
    P = FIELD_P[stage];
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
    for (let x = off + 2; x < Wc; x += 7) {
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
      } else if (stage === 'young') {
        g.strokeStyle = rgb(P.hi);
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(x - 1.5, y - 3.4);
        g.lineTo(x, y);
        g.lineTo(x + 1.6, y - 3.6);
        g.stroke();
      } else if (stage === 'growing') {
        g.strokeStyle = rgb(P.hi);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(x - 1.8, y - 3);
        g.lineTo(x, y + 0.6);
        g.lineTo(x + 1.8, y - 3);
        g.stroke();
      } else if (stage === 'ripe') {
        g.fillStyle = rgb(P.hi);
        g.beginPath();
        g.ellipse(x, y - 1.6, 1.4, 2.5, 0.35, 0, 7);
        g.fill();
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
    r = G.mulberry32(stage.length * 131 + 9);
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
  for (const k of ['stubble', 'plowed', 'sown', 'young', 'growing', 'ripe', 'fallow', 'scrub'])
    fieldTex[k] = T(fieldCanvas(k, R));
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
    puff: T(puffCanvas()),
    byre: T(byreCanvas()),
    lit: T(stugaLitCanvas()),
    glow: T(glowCanvas()),
    haystack: [0, 1, 2, 3].map((l) => T(haystackCanvas(l))),
    manure: [0, 1, 2].map((l) => T(manureCanvas(l))),
    cow: COATS.map((_, k) => [T(cowCanvas(k, 0)), T(cowCanvas(k, 1))]),
    sheep: [T(sheepCanvas(0)), T(sheepCanvas(1))],
  };
  atlas = buildAtlas();
}
