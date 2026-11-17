// @sys page/beastart: art of beasts and fences: cattle and sheep by coat, the roundpole fence
const COATS = [[178, 82, 52], [140, 94, 60], [70, 60, 56], [214, 176, 116], 'pied'];
function cowCanvas(coat, look) {
  const K = artKit(64, 44, 31 + coat * 7),
    { g, r, col, under, line } = K;
  const base = COATS[coat] === 'pied' ? [240, 232, 214] : COATS[coat],
    sh = (f) => base.map((v) => v * f);
  const hx = 56,
    hy = look ? 14 : 31;
  const body = () => rr(g, 11, 13, 41, 17, 8);
  K.shadow(32, 41, 24, 3);
  under(
    [
      ...[16, 22, 42, 48].map((x) => [sh(0.78), () => rr(g, x, 26, 3.8, 15, 1.4)]),
      [
        sh(0.8),
        () => {
          g.beginPath();
          g.moveTo(11.5, 16);
          g.quadraticCurveTo(6.5, 24, 7.5, 33);
          g.lineTo(9.6, 33);
          g.quadraticCurveTo(9, 24, 13, 18);
          g.closePath();
        },
      ],
      [base, body],
      [
        base,
        () => {
          g.beginPath();
          g.moveTo(44, 15);
          g.quadraticCurveTo(52, look ? 9 : 20, hx - 3, hy - 2);
          g.lineTo(hx, hy + 4);
          g.quadraticCurveTo(50, 28, 44, 27);
          g.closePath();
        },
      ],
      [
        [240, 228, 200],
        () => {
          g.beginPath();
          g.moveTo(hx - 2.4, hy - 1);
          g.quadraticCurveTo(hx - 4.6, hy - 7.5, hx - 0.6, hy - 8.6);
          g.lineTo(hx, hy - 1);
          g.closePath();
        },
      ],
      [
        base,
        () => {
          g.beginPath();
          g.ellipse(hx, hy + 2, 5, 4.4, look ? 0.5 : 1.2, 0, 7);
        },
      ],
    ],
    0.55,
  );
  g.fillStyle = col(MP.dark);
  for (const x of [16, 22, 42, 48]) g.fillRect(x, 39.3, 3.8, 1.7); // hooves
  g.beginPath();
  g.ellipse(hx + (look ? 3.5 : 1.5), hy + (look ? 4.5 : 6), 2.5, 2.1, 0, 0, 7);
  g.fillStyle = col(sh(0.64));
  g.fill(); // muzzle
  g.fillStyle = col(MP.dark);
  g.beginPath();
  g.arc(hx + 1.4, hy + 0.6, 1, 0, 7);
  g.fill(); // eye
  if (COATS[coat] === 'pied') {
    g.save();
    body();
    g.clip();
    g.fillStyle = 'rgb(76,60,52)';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(15 + r() * 32, 15 + r() * 12, 4 + r() * 5, 3 + r() * 3, r() * 3, 0, 7);
      g.fill();
    }
    g.restore();
  }
  g.beginPath();
  g.moveTo(15, 27.6);
  g.quadraticCurveTo(31, 30.4, 48, 27.6);
  line(sh(0.62), 1.1, 0.7); // the belly's line
  return K.c;
}
// A sheep is painted white and tinted by its fleece (page/settlement); its face and legs are dark either way.
function sheepCanvas(look) {
  const K = artKit(36, 28, 53),
    { g, r, under } = K,
    hx = 30,
    hy = look ? 9 : 18,
    face = [86, 68, 56];
  K.shadow(17, 26, 12, 2);
  const curls = [];
  for (let k = 0; k < 9; k++)
    curls.push([8 + (k % 5) * 4.5 + r() * 1.5, 9.5 + ((k / 5) | 0) * 6 + r() * 1.5, 5 + r() * 1.2]);
  under(
    [
      ...[9, 13, 21, 25].map((x) => [
        face,
        () => {
          g.beginPath();
          g.rect(x, 17, 2.2, 9);
        },
      ]),
      ...curls.map(([x, y, rad]) => [
        [255, 255, 255],
        () => {
          g.beginPath();
          g.arc(x, y, rad, 0, 7);
        },
      ]),
      [
        face,
        () => {
          g.beginPath();
          g.ellipse(hx - 2.5, hy - 2.2, 1.7, 1.1, -0.6, 0, 7);
        },
      ],
      [
        face,
        () => {
          g.beginPath();
          g.ellipse(hx, hy, 3.4, 2.8, look ? 0.4 : 1, 0, 7);
        },
      ],
    ],
    0.5,
  );
  g.strokeStyle = 'rgba(0,0,0,0.2)';
  g.lineWidth = 0.9;
  for (const [x, y, rad] of curls.slice(0, 5)) {
    g.beginPath();
    g.arc(x, y + 1, rad * 0.5, Math.PI * 0.1, Math.PI * 0.9);
    g.stroke();
  }
  return K.c;
}
// Roundpole fence along a stretch of hex edges: paired posts with slanted rails; a neglected stretch sags and loses rails. Each is drawn
// twice, a dark contour under the wood's own colour.
function drawFence(g, s) {
  g.clear();
  const broken = s.cond < 0.45;
  for (const pass of [0, 1]) {
    const r = G.mulberry32(s.id * 97 + (s.edges[0].tile | 0));
    for (const e of s.edges) {
      const dx = e.x2 - e.x1,
        dy = e.y2 - e.y1,
        L = Math.hypot(dx, dy),
        ux = dx / L,
        uy = dy / L,
        n = Math.max(2, Math.round(L / 5.2));
      for (let k = 0; k < n * 2; k++) {
        if (broken && r() < 0.45) continue;
        const t0 = k / (n * 2),
          x = e.x1 + dx * t0,
          y = e.y1 + dy * t0,
          run = 6.5;
        g.moveTo(x, y - 0.2).lineTo(x + ux * run, y + uy * run - 4.6);
      }
      g.stroke(pass ? { width: 0.75, color: 0xd8b070 } : { width: 1.5, color: 0x2c201c, alpha: 0.9 });
      for (let k = 0; k <= n; k++) {
        const x = e.x1 + dx * (k / n),
          y = e.y1 + dy * (k / n);
        g.moveTo(x - 0.5, y + 0.6)
          .lineTo(x - 0.5, y - 5.2)
          .moveTo(x + 0.6, y + 0.6)
          .lineTo(x + 0.6, y - 5.2);
      }
      g.stroke(pass ? { width: 0.6, color: 0x96462f } : { width: 1.3, color: 0x2c201c, alpha: 0.9 });
      if (broken) {
        for (let k = 0; k < 2; k++) {
          const t0 = r(),
            x = e.x1 + dx * t0,
            y = e.y1 + dy * t0 + 1.5;
          g.moveTo(x, y).lineTo(x + ux * 6, y + uy * 6 + 0.8);
        }
        g.stroke(pass ? { width: 0.75, color: 0xc49a5c } : { width: 1.5, color: 0x2c201c, alpha: 0.8 });
      }
    }
  }
}
