// @sys page/stookart: art of the field and the yard's piles: stooks, haystack, manure, smoke puff, glow, the map's trees and shrubs
function stookCanvas(v) {
  const K = artKit(20, 24, 20 + v),
    { g, ink, line } = K;
  K.shadow(11, 21.5, 8, 2.2);
  K.poly([
    [2.5, 21.5],
    [7.6, 6.5],
    [6, 2.5],
    [10, 4.2],
    [14, 2.5],
    [12.4, 6.5],
    [17.5, 21.5],
  ]);
  ink(MP.straw, 0.6);
  for (const x of [6, 10, 14]) {
    g.beginPath();
    g.moveTo(x, 20.5);
    g.lineTo(10 + (x - 10) * 0.3, 8.5);
    line(MP.thatchDk, 0.7, 0.8);
  }
  g.beginPath();
  g.rect(7.2, 6.6, 5.6, 1.8);
  ink(v ? MP.eave : MP.thatchDk, 0.4);
  return K.c;
}
function haystackCanvas(level) {
  const K = artKit(40, 44, 41 + level),
    { g, r, ink, line, pole } = K;
  K.shadow(20, 41, 17, 3);
  pole(20, 41, 20, level ? 4 : 18, MP.post, 1.6);
  if (level) {
    const h = [0, 14, 24, 33][level],
      wdt = [0, 11, 14, 16][level];
    g.beginPath();
    g.moveTo(20 - wdt, 41);
    g.quadraticCurveTo(20 - wdt * 0.95, 41 - h * 0.75, 20, 41 - h);
    g.quadraticCurveTo(20 + wdt * 0.95, 41 - h * 0.75, 20 + wdt, 41);
    g.closePath();
    ink(MP.hay, 0.8);
    for (let k = 0; k < 6 + level * 2; k++) {
      const x = 20 + (r() - 0.5) * wdt * 1.3,
        y = 40 - r() * h * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 2, y - 3.4);
      line(MP.hayDk, 0.8);
    }
  }
  return K.c;
}
// The manure heap by the byre (VB-137): small, middling and large by the loads on it; dark dung under a few wisps of straw bedding.
function manureCanvas(level) {
  const K = artKit(36, 20, 53 + level),
    { g, r, ink, line } = K,
    wdt = [9, 12, 15][level],
    h = [5, 8, 11][level];
  K.shadow(18, 17.5, wdt + 2, 2.5);
  g.beginPath();
  g.moveTo(18 - wdt, 17.5);
  g.quadraticCurveTo(18 - wdt * 0.6, 17.5 - h * 1.1, 18, 17.5 - h);
  g.quadraticCurveTo(18 + wdt * 0.7, 17.5 - h * 1.05, 18 + wdt, 17.5);
  g.closePath();
  ink(MP.dung, 0.7);
  for (let k = 0; k < 4 + level * 2; k++) {
    const x = 18 + (r() - 0.5) * wdt * 1.2,
      y = 16.5 - r() * h * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 4, y - 1 + r() * 2);
    line(MP.straw, 0.8);
  }
  return K.c;
}
// Smoke as the vault painters drew cloud: a pale round with a contour, so that a rising string of them makes a scalloped plume.
function puffCanvas() {
  const K = artKit(24, 24, 2),
    { g } = K;
  g.beginPath();
  g.arc(12, 12, 9.4, 0, 7);
  g.fillStyle = 'rgb(244,238,224)';
  g.fill();
  g.strokeStyle = 'rgba(70,56,50,0.55)';
  g.lineWidth = 1.6;
  g.stroke();
  g.beginPath();
  g.arc(12, 12, 5, Math.PI * 1.1, Math.PI * 1.9);
  g.strokeStyle = 'rgba(70,56,50,0.3)';
  g.lineWidth = 1.1;
  g.stroke();
  return K.c;
}
// Firelight: a warm round that fades to nothing, added over the ground and the wall by the cottage's openings.
function glowCanvas() {
  const c = makeCanvas(64, 64),
    g = c.getContext('2d'),
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,196,96,0.95)');
  gr.addColorStop(0.35, 'rgba(255,150,60,0.45)');
  gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}
// The trees and shrubs of the map, in the shape gen's decorateChunk draws them from (broad 28 by 30, pine 20 by 34, shrub 12 by 10): a
// crown of rounds or tiers of boughs inside one contour, in green earth, as the trees of a painted vault stand for a whole wood.
function landSprites() {
  const S = { broad: [], pine: [], shrub: [] },
    T = 3;
  const mk = (w, h, seed, fn) => {
    const c = makeCanvas(w * T, h * T),
      g = c.getContext('2d');
    g.scale(T, T);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    fn(g, Noise.mulberry32(seed));
    return c;
  };
  const col = (c3, f = 1) => `rgb(${c3.map((v) => Math.min(255, v * f) | 0)})`;
  const trunk = (g, x, y, wd, h) => {
    g.beginPath();
    g.rect(x, y, wd, h);
    g.fillStyle = col(MP.post);
    g.fill();
    g.strokeStyle = MP.line;
    g.lineWidth = 0.8;
    g.stroke();
  };
  const leafs = [
    [104, 148, 84],
    [122, 162, 84],
    [92, 136, 88],
    [136, 166, 80],
    [152, 164, 78],
  ];
  for (let v = 0; v < 10; v++)
    S.broad.push(
      mk(28, 30, 1000 + v, (g, r) => {
        const leaf = leafs[v % leafs.length],
          pts = [];
        trunk(g, 12.7, 17, 2.8, 10);
        for (let k = 0, n = 4 + ((r() * 3) | 0); k < n; k++)
          pts.push([14 + (r() - 0.5) * 10, 12.5 + (r() - 0.5) * 8, 4.6 + r() * 2.6]);
        g.strokeStyle = MP.line;
        g.lineWidth = 2;
        for (const [x, y, rad] of pts) {
          g.beginPath();
          g.arc(x, y, rad, 0, 7);
          g.stroke();
        }
        g.fillStyle = col(leaf);
        for (const [x, y, rad] of pts) {
          g.beginPath();
          g.arc(x, y, rad, 0, 7);
          g.fill();
        }
        g.strokeStyle = col(leaf, 0.72);
        g.lineWidth = 0.9;
        for (const [x, y, rad] of pts) {
          g.beginPath();
          g.arc(x, y + 0.4, rad * 0.55, Math.PI * 0.15, Math.PI * 0.85);
          g.stroke();
        }
        g.fillStyle = col(leaf, 1.3);
        for (const [x, y, rad] of pts) {
          g.beginPath();
          g.arc(x - rad * 0.3, y - rad * 0.4, 0.9, 0, 7);
          g.fill();
        }
      }),
    );
  const needles = [
    [70, 112, 84],
    [80, 122, 84],
    [62, 102, 88],
    [88, 122, 78],
  ];
  for (let v = 0; v < 8; v++)
    S.pine.push(
      mk(20, 34, 2000 + v, (g, r) => {
        const leaf = needles[v % needles.length],
          tall = 0.85 + r() * 0.3,
          top = 33 - 29 * tall;
        trunk(g, 9, 25, 2, 7.4);
        for (let t = 2; t >= 0; t--) {
          const y0 = top + (t * (26 * tall)) / 3,
            y1 = y0 + 13 * tall,
            hw = 3.6 + t * 2.3;
          g.beginPath();
          g.moveTo(10, y0);
          g.lineTo(10 + hw, y1);
          g.quadraticCurveTo(10, y1 - 2.4, 10 - hw, y1);
          g.closePath();
          g.fillStyle = col(leaf, 1 + (2 - t) * 0.06);
          g.fill();
          g.strokeStyle = MP.line;
          g.lineWidth = 0.9;
          g.stroke();
        }
      }),
    );
  const heath = [
    [152, 142, 86],
    [130, 136, 78],
    [166, 126, 98],
    [138, 114, 86],
  ];
  for (let v = 0; v < 4; v++)
    S.shrub.push(
      mk(12, 10, 3000 + v, (g, r) => {
        const pts = [];
        for (let k = 0; k < 3; k++) pts.push([4 + r() * 4, 5.2 + r() * 2, 2 + r() * 1.4]);
        g.strokeStyle = MP.line;
        g.lineWidth = 1.3;
        for (const [x, y, rad] of pts) {
          g.beginPath();
          g.arc(x, y, rad, 0, 7);
          g.stroke();
        }
        g.fillStyle = col(heath[v]);
        for (const [x, y, rad] of pts) {
          g.beginPath();
          g.arc(x, y, rad, 0, 7);
          g.fill();
        }
      }),
    );
  return S;
}
// Cattle and sheep, side on, facing right; `look` 0 grazes with the head down, 1 looks up. Coats after old Nordic landraces:
// red, brown, black, dun, and white with dark patches.
