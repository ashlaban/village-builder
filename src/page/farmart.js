// @sys page/farmart: farmstead art after medieval Swedish building: buildings, woodpile, well sweep, stooks, byre, hay, dung, cattle, sheep, fences
  // ======== farmstead art, after medieval Swedish building ========
  // Unpainted log buildings with turf roofs on birch bark and a smoke hole (ljore) instead of a chimney,
  // a storehouse on posts (härbre), a gapped barn (lada), a woodpile, the village well sweep (brunnsvinge),
  // sheaf stooks (skylar) on reaped fields and a roundpole fence (gärdesgård) around the infields. 4 texels per unit.
  function logCourse(g, x0, x1, y, h, base, r) {
    const c = base.map((v) => v * (0.9 + r() * 0.18));
    g.fillStyle = `rgb(${c.map((v) => v | 0)})`; rr(g, x0, y, x1 - x0, h, h / 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(x0 + 2, y + 0.8, x1 - x0 - 4, 1.1);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0 + 1, y + h - 1.4, x1 - x0 - 2, 1.4);
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 0.6;
    for (let k = 0; k < 4; k++) { const x = x0 + 6 + r() * (x1 - x0 - 12); g.beginPath(); g.moveTo(x, y + h * 0.35); g.lineTo(x + 6 + r() * 8, y + h * 0.45); g.stroke(); }
  }
  function logEnds(g, x, y0, n, h, r) {
    for (let k = 0; k < n; k++) {
      const y = y0 + k * h + h / 2;
      g.fillStyle = 'rgb(150,124,94)'; g.beginPath(); g.ellipse(x, y, 2.6, h / 2 - 0.2, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(70,50,30,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(x, y, 1.3, h / 4, 0, 0, 7); g.stroke();
    }
  }
  function turf(g, pts, r, dark) {
    g.fillStyle = dark ? 'rgb(92,104,58)' : 'rgb(104,118,64)'; g.beginPath(); pts.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo'](x, y)); g.closePath(); g.fill();
    g.save(); g.clip();
    for (let k = 0; k < 260; k++) {
      const x = r() * 110, y = r() * 60, l = 2 + r() * 3;
      g.strokeStyle = r() < 0.5 ? 'rgba(70,88,40,0.75)' : 'rgba(150,164,92,0.65)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 1.5, y - l); g.stroke();
    }
    for (let k = 0; k < 10; k++) { g.fillStyle = ['rgba(240,230,120,0.9)', 'rgba(250,250,240,0.9)', 'rgba(200,120,170,0.8)'][k % 3]; g.beginPath(); g.arc(r() * 100, r() * 40, 0.9, 0, 7); g.fill(); }
    g.restore();
  }
  function stugaCanvas(v) {
    const c = makeCanvas(104, 80), g = c.getContext('2d'), r = G.mulberry32(100 + v);
    const logs = [[132, 108, 84], [120, 100, 80], [138, 116, 90]][v % 3];
    g.fillStyle = 'rgba(20,30,20,0.32)'; g.beginPath(); g.ellipse(54, 73, 48, 7, 0, 0, 7); g.fill();
    for (let x = 9; x < 94; x += 7 + r() * 3) { g.fillStyle = `rgb(${[130, 128, 122].map((q) => (q * (0.85 + r() * 0.25)) | 0)})`; g.beginPath(); g.ellipse(x, 69, 4.2, 2.6, 0, 0, 7); g.fill(); }
    for (let k = 0; k < 6; k++) logCourse(g, 11, 93, 36 + k * 5.3, 5.3, logs, r);
    logEnds(g, 9, 36, 6, 5.3, r); logEnds(g, 95, 36, 6, 5.3, r);
    // low plank door with a heavy frame, and a small wind-eye with a shutter
    g.fillStyle = 'rgb(92,70,48)'; g.fillRect(22, 44, 16, 24); g.fillStyle = 'rgb(66,48,32)'; g.fillRect(24, 46, 12, 22);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(28, 46, 0.8, 22); g.fillRect(32, 46, 0.8, 22);
    g.fillStyle = 'rgb(46,40,36)'; g.fillRect(25, 51, 4, 1.4); g.fillRect(25, 62, 4, 1.4);
    g.fillStyle = 'rgb(40,34,30)'; g.fillRect(62, 47, 8, 6); g.fillStyle = 'rgb(96,74,52)'; g.fillRect(70, 46, 5, 8);
    // turf roof on birch bark, held by an eave log; ridge pole ends stick out at the gables
    turf(g, [[3, 39], [101, 39], [89, 13], [15, 13]], r, v % 2);
    g.fillStyle = 'rgb(226,218,200)'; g.fillRect(3, 37.5, 98, 2.5);
    g.fillStyle = 'rgba(60,50,40,0.6)'; for (let x = 6; x < 100; x += 5 + r() * 4) g.fillRect(x, 38, 2, 0.8);
    g.fillStyle = 'rgb(110,86,60)'; rr(g, 2, 39.5, 100, 3.4, 1.7); g.fill();
    g.fillStyle = 'rgb(118,92,64)'; g.beginPath(); g.ellipse(14, 13.5, 2.6, 2.4, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(90, 13.5, 2.6, 2.4, 0, 0, 7); g.fill();
    // smoke hole (ljore) near the ridge
    g.fillStyle = 'rgb(96,74,52)'; g.fillRect(62, 8, 10, 7); g.fillStyle = 'rgb(34,28,24)'; g.fillRect(64, 9.5, 6, 3.5);
    return c;
  }
  function harbreCanvas() {
    const c = makeCanvas(56, 86), g = c.getContext('2d'), r = G.mulberry32(7);
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(30, 81, 24, 4.5, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(126,122,116)'; for (const x of [12, 42]) { g.beginPath(); g.ellipse(x, 79, 5, 3, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgb(104,82,58)'; g.fillRect(10, 64, 4, 15); g.fillRect(40, 64, 4, 15);
    for (let k = 0; k < 4; k++) logCourse(g, 9, 45, 44 + k * 5, 5, [126, 104, 80], r);
    logEnds(g, 7.5, 44, 4, 5, r); logEnds(g, 46.5, 44, 4, 5, r);
    // the upper storey overhangs on all sides, clad in boards
    g.fillStyle = 'rgb(128,104,78)'; g.fillRect(3, 22, 50, 22);
    g.fillStyle = 'rgba(0,0,0,0.16)'; for (let x = 7; x < 53; x += 4.5) g.fillRect(x, 22, 0.9, 22);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3, 42, 50, 2);
    g.fillStyle = 'rgb(70,52,36)'; g.fillRect(22, 26, 11, 15); g.fillStyle = 'rgb(50,40,32)'; g.fillRect(31, 33, 1.6, 1.6);
    g.fillStyle = 'rgb(84,76,70)'; g.beginPath(); g.moveTo(0, 24); g.lineTo(56, 24); g.lineTo(47, 4); g.lineTo(9, 4); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,34,30,0.55)'; g.lineWidth = 0.8;
    for (let y = 8; y < 24; y += 3.2) { const k = (y - 4) / 20; g.beginPath(); g.moveTo(9 - 9 * k, y); g.lineTo(47 + 9 * k, y); g.stroke(); for (let x = 10; x < 46; x += 4) { g.beginPath(); g.moveTo(x + (y % 2) * 2, y); g.lineTo(x + (y % 2) * 2, y - 3); g.stroke(); } }
    // steps up to the door
    g.fillStyle = 'rgb(112,88,62)'; g.save(); g.translate(40, 78); g.rotate(-1.25); g.fillRect(0, 0, 38, 3); g.restore();
    return c;
  }
  function ladaCanvas() {
    const c = makeCanvas(110, 72), g = c.getContext('2d'), r = G.mulberry32(11);
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(56, 67, 50, 6, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(40,32,26)'; g.fillRect(10, 30, 90, 34);
    for (let k = 0; k < 5; k++) logCourse(g, 10, 100, 31 + k * 6.6, 5, [110, 94, 78], r); // gapped logs let the hay breathe
    logEnds(g, 8, 31, 5, 6.6, r); logEnds(g, 102, 31, 5, 6.6, r);
    g.fillStyle = 'rgb(102,80,58)'; g.fillRect(42, 37, 26, 27); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(54.6, 37, 0.9, 27);
    g.strokeStyle = 'rgba(60,44,30,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(43, 63); g.lineTo(54, 38); g.moveTo(56, 38); g.lineTo(67, 63); g.stroke();
    g.fillStyle = 'rgb(116,106,94)'; g.beginPath(); g.moveTo(3, 33); g.lineTo(107, 33); g.lineTo(93, 7); g.lineTo(17, 7); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,54,48,0.5)'; g.lineWidth = 0.9;
    for (let x = 6; x < 106; x += 4.4) { const t = (x - 3) / 104; g.beginPath(); g.moveTo(x, 33); g.lineTo(17 + t * 76, 7); g.stroke(); }
    g.fillStyle = 'rgb(84,74,64)'; g.fillRect(16, 5.5, 78, 3);
    return c;
  }
  function woodpileCanvas(level) {
    const c = makeCanvas(52, 30), g = c.getContext('2d'), r = G.mulberry32(level * 3 + 1);
    g.fillStyle = 'rgba(20,30,20,0.28)'; g.beginPath(); g.ellipse(26, 27, 24, 3.5, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(96,74,50)'; g.fillRect(3, 24, 46, 3);
    const rows = [0, 2, 3, 4][level];
    for (let row = 0; row < rows; row++) for (let x = 6 + (row % 2) * 3; x < 47; x += 5.6) {
      const y = 21 - row * 4.6;
      g.fillStyle = `rgb(${[206, 174, 124].map((q) => (q * (0.88 + r() * 0.2)) | 0)})`; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(110,76,46,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.stroke();
    }
    return c;
  }
  function wellSweepCanvas() {
    const c = makeCanvas(100, 112), g = c.getContext('2d');
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(44, 106, 34, 5.5, 0, 0, 7); g.fill();
    // log well curb
    const r = G.mulberry32(3);
    for (let k = 0; k < 3; k++) logCourse(g, 20, 54, 88 + k * 5, 5, [130, 108, 84], r);
    g.fillStyle = 'rgb(36,50,60)'; g.beginPath(); g.ellipse(37, 88, 15, 3, 0, 0, 7); g.fill();
    // forked post, sweep pole with a stone counterweight, rod and bucket
    g.fillStyle = 'rgb(104,80,56)'; g.fillRect(70, 48, 4.5, 56);
    g.strokeStyle = 'rgb(104,80,56)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(71, 50); g.lineTo(67, 43); g.moveTo(74, 50); g.lineTo(78, 43); g.stroke();
    g.strokeStyle = 'rgb(122,96,66)'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(36, 10); g.lineTo(94, 74); g.stroke();
    g.fillStyle = 'rgb(124,120,114)'; g.beginPath(); g.ellipse(93, 76, 6, 5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgb(86,66,46)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(37, 11); g.lineTo(37, 76); g.stroke();
    g.fillStyle = 'rgb(140,104,66)'; g.beginPath(); g.moveTo(32, 76); g.lineTo(42, 76); g.lineTo(41, 84); g.lineTo(33, 84); g.closePath(); g.fill();
    return c;
  }
  function stookCanvas(v) {
    const c = makeCanvas(20, 24), g = c.getContext('2d'), r = G.mulberry32(20 + v);
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(12, 21.5, 8, 2.2, 0, 0, 7); g.fill();
    for (let k = 0; k < 7; k++) {
      const x = 4 + k * 2, top = 4 + Math.abs(k - 3) * 1.4;
      g.strokeStyle = `rgb(${[214, 180, 96].map((q) => (q * (0.85 + r() * 0.25)) | 0)})`; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x, 21); g.lineTo(10 + (x - 10) * 0.25, top); g.stroke();
    }
    g.fillStyle = 'rgb(236,206,120)'; g.beginPath(); g.ellipse(10, 4, 3, 2.6, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(150,112,60)'; g.fillRect(7.5, 8, 5, 1.6);
    return c;
  }
  function yardCanvas() {
    const c = makeCanvas(170, 116), g = c.getContext('2d'), r = G.mulberry32(5);
    const gr = g.createRadialGradient(85, 58, 8, 85, 58, 80);
    gr.addColorStop(0, 'rgba(146,128,96,0.78)'); gr.addColorStop(0.7, 'rgba(146,128,96,0.4)'); gr.addColorStop(1, 'rgba(146,128,96,0)');
    g.fillStyle = gr; g.save(); g.scale(1, 116 / 170); g.beginPath(); g.arc(85, 85, 82, 0, 7); g.fill(); g.restore();
    for (let k = 0; k < 140; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 70; g.fillStyle = r() < 0.5 ? 'rgba(110,94,70,0.4)' : 'rgba(120,150,80,0.35)'; g.fillRect(85 + Math.cos(a) * d, 58 + Math.sin(a) * d * 0.68, 1.6, 1.6); }
    return c;
  }
  // Byre (fähus): a low log house with a turf roof and a plank door, smaller than the barn; the animals stand in it from autumn to spring.
  function byreCanvas() {
    const c = makeCanvas(86, 62), g = c.getContext('2d'), r = G.mulberry32(17);
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(44, 57, 40, 5, 0, 0, 7); g.fill();
    for (let k = 0; k < 4; k++) logCourse(g, 8, 78, 33 + k * 5.6, 5.6, [118, 98, 76], r);
    logEnds(g, 6, 33, 4, 5.6, r); logEnds(g, 80, 33, 4, 5.6, r);
    g.fillStyle = 'rgb(84,64,44)'; g.fillRect(50, 38, 15, 18); g.fillStyle = 'rgb(60,44,30)'; g.fillRect(52, 40, 11, 16);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(57, 40, 0.8, 16);
    g.fillStyle = 'rgb(40,32,26)'; g.fillRect(20, 40, 9, 4); // a gap for air and light
    turf(g, [[2, 36], [84, 36], [72, 12], [14, 12]], r, 1);
    g.fillStyle = 'rgb(226,218,200)'; g.fillRect(2, 34.5, 82, 2.2);
    g.fillStyle = 'rgb(110,86,60)'; rr(g, 1, 36.5, 84, 3, 1.5); g.fill();
    return c;
  }
  // The haystack by the byre (VB-133): none, low, half and full, by the hay against the winter's need; built round a pole, as stacks were.
  function haystackCanvas(level) {
    const c = makeCanvas(40, 44), g = c.getContext('2d'), r = G.mulberry32(41 + level);
    g.fillStyle = 'rgba(20,30,20,0.28)'; g.beginPath(); g.ellipse(20, 41, 17, 3, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(104,80,56)'; g.fillRect(19, level ? 4 : 18, 2, level ? 37 : 23); // the pole
    if (level) {
      const h = [0, 14, 24, 34][level], wdt = [0, 11, 14, 16][level];
      g.fillStyle = 'rgb(186,170,96)'; g.beginPath(); g.moveTo(20 - wdt, 41); g.quadraticCurveTo(20 - wdt * 0.9, 41 - h * 0.7, 20, 41 - h); g.quadraticCurveTo(20 + wdt * 0.9, 41 - h * 0.7, 20 + wdt, 41); g.fill();
      g.strokeStyle = 'rgba(140,124,62,0.8)'; g.lineWidth = 0.8;
      for (let k = 0; k < 14; k++) { const x = 20 + (r() - 0.5) * wdt * 1.6, y = 41 - r() * h * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 3); g.stroke(); }
      g.fillStyle = 'rgba(255,240,180,0.15)'; g.beginPath(); g.ellipse(16, 41 - h * 0.55, wdt * 0.35, h * 0.25, -0.3, 0, 7); g.fill();
    }
    return c;
  }
  // The manure heap by the byre (VB-137): small, middling and large by the loads on it; dark dung under a few wisps of straw bedding.
  function manureCanvas(level) {
    const c = makeCanvas(36, 20), g = c.getContext('2d'), r = G.mulberry32(53 + level), wdt = [9, 12, 15][level], h = [5, 8, 11][level];
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(18, 17.5, wdt + 2, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(74,54,36)'; g.beginPath(); g.moveTo(18 - wdt, 17.5); g.quadraticCurveTo(18 - wdt * 0.6, 17.5 - h * 1.1, 18, 17.5 - h);
    g.quadraticCurveTo(18 + wdt * 0.7, 17.5 - h * 1.05, 18 + wdt, 17.5); g.fill();
    g.fillStyle = 'rgba(40,28,18,0.6)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(18 + (r() - 0.5) * wdt * 1.3, 17 - r() * h * 0.7, 2, 1.2, 0, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(196,176,110,0.85)'; g.lineWidth = 0.7;
    for (let k = 0; k < 5 + level * 3; k++) { const x = 18 + (r() - 0.5) * wdt * 1.4, y = 17 - r() * h * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 1 + r() * 2); g.stroke(); }
    return c;
  }
  // Cattle and sheep, side on, facing right; `look` 0 grazes with the head down, 1 looks up. Coats after old Nordic landraces:
  // red, brown, black, dun, and white with dark patches.
  const COATS = [[150, 74, 48], [112, 76, 50], [52, 46, 42], [182, 152, 108], 'pied'];
  function cowCanvas(coat, look) {
    const c = makeCanvas(64, 44), g = c.getContext('2d'), r = G.mulberry32(31 + coat * 7);
    const base = COATS[coat] === 'pied' ? [232, 226, 212] : COATS[coat], col = (f) => `rgb(${base.map((v) => (v * f) | 0)})`;
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(32, 41, 24, 3, 0, 0, 7); g.fill();
    g.fillStyle = col(0.72); for (const x of [16, 22, 42, 48]) { rr(g, x, 26, 3.6, 15, 1.4); g.fill(); } // legs
    g.fillStyle = 'rgb(46,38,32)'; for (const x of [16, 22, 42, 48]) g.fillRect(x, 39.5, 3.6, 1.5); // hooves
    g.strokeStyle = col(0.75); g.lineWidth = 1.6; g.beginPath(); g.moveTo(11, 17); g.quadraticCurveTo(7, 24, 8, 32); g.stroke(); // tail
    g.fillStyle = col(0.5); g.beginPath(); g.ellipse(8, 33, 1.6, 2.4, 0, 0, 7); g.fill();
    g.fillStyle = col(1); rr(g, 11, 13, 41, 17, 8); g.fill(); // body
    const hx = 56, hy = look ? 14 : 31;
    g.beginPath(); g.moveTo(44, 15); g.quadraticCurveTo(52, look ? 9 : 20, hx - 3, hy - 2); g.lineTo(hx, hy + 4); g.quadraticCurveTo(50, 28, 44, 27); g.fill(); // neck
    g.beginPath(); g.ellipse(hx, hy + 2, 5, 4.4, look ? 0.5 : 1.2, 0, 7); g.fill(); // head
    g.fillStyle = col(0.62); g.beginPath(); g.ellipse(hx + (look ? 3.5 : 1.5), hy + (look ? 4.5 : 6), 2.6, 2.2, 0, 0, 7); g.fill(); // muzzle
    g.fillStyle = 'rgb(232,222,196)'; g.beginPath(); g.moveTo(hx - 2, hy - 2); g.quadraticCurveTo(hx - 4, hy - 7, hx - 1, hy - 8); g.lineTo(hx - 0.5, hy - 2); g.fill(); // horn
    g.fillStyle = 'rgb(30,26,22)'; g.fillRect(hx + 1, hy, 1.4, 1.4); // eye
    if (COATS[coat] === 'pied') {
      g.save(); rr(g, 11, 13, 41, 17, 8); g.clip();
      g.fillStyle = 'rgb(64,52,44)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(15 + r() * 32, 15 + r() * 12, 4 + r() * 5, 3 + r() * 3, r() * 3, 0, 7); g.fill(); }
      g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(13, 26, 37, 3); // belly shade
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(16, 14, 30, 2);
    return c;
  }
  function sheepCanvas(look) {
    const c = makeCanvas(36, 28), g = c.getContext('2d'), r = G.mulberry32(53);
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(17, 26, 12, 2, 0, 0, 7); g.fill();
    g.fillStyle = 'rgb(58,48,40)'; for (const x of [9, 13, 21, 25]) g.fillRect(x, 17, 2, 9);
    g.fillStyle = '#fff';
    for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(8 + (k % 5) * 4.5 + r() * 1.5, 9 + ((k / 5) | 0) * 6 + r() * 1.5, 5 + r() * 1.2, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.beginPath(); g.ellipse(17, 17, 11, 3, 0, 0, 7); g.fill();
    const hx = 30, hy = look ? 9 : 18;
    g.fillStyle = 'rgb(70,58,48)'; g.beginPath(); g.ellipse(hx, hy, 3.4, 2.8, look ? 0.4 : 1, 0, 7); g.fill();
    g.beginPath(); g.ellipse(hx - 2.5, hy - 2.2, 1.6, 1, -0.6, 0, 7); g.fill(); // ear
    return c;
  }
  // Roundpole fence along a stretch of hex edges: paired posts with slanted rails; a neglected stretch sags and loses rails.
  function drawFence(g, s) {
    g.clear();
    const broken = s.cond < 0.45, r = G.mulberry32(s.id * 97 + (s.edges[0].tile | 0));
    for (const e of s.edges) {
      const dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, n = Math.max(2, Math.round(L / 5.2));
      for (let k = 0; k <= n; k++) {
        const x = e.x1 + dx * (k / n), y = e.y1 + dy * (k / n);
        g.moveTo(x - 0.5, y + 0.6).lineTo(x - 0.5, y - 5.2).moveTo(x + 0.6, y + 0.6).lineTo(x + 0.6, y - 5.2);
      }
      g.stroke({ width: 0.7, color: 0x6e6254, alpha: 0.95 });
      for (let k = 0; k < n * 2; k++) {
        if (broken && r() < 0.45) continue;
        const t0 = (k / (n * 2)), x = e.x1 + dx * t0, y = e.y1 + dy * t0, run = 6.5;
        g.moveTo(x, y - 0.2).lineTo(x + ux * run, y + uy * run - 4.6);
      }
      g.stroke({ width: 0.85, color: 0x9a8c78, alpha: 0.95 });
      if (broken) { for (let k = 0; k < 2; k++) { const t0 = r(), x = e.x1 + dx * t0, y = e.y1 + dy * t0 + 1.5; g.moveTo(x, y).lineTo(x + ux * 6, y + uy * 6 + 0.8); } g.stroke({ width: 0.8, color: 0x8a7c68, alpha: 0.85 }); }
    }
  }

