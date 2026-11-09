// @sys page/storybook: story-book painters of the farm buildings (cottage, storehouse, barn, byre), by art style
  // ======== story-book building art ========
  // The same buildings as page/farmart, on the same canvases and anchors, drawn as a picture book would: few bold shapes that read at
  // the map's size, bright earth and plant colours, and nothing a medieval Swedish farm did not have (unpainted logs, turf on birch bark,
  // straw thatch held by crossed ridge poles, split shingles). SBK texels per classic texel, so the lines stay crisp on a dense screen.
  const SBK = 2;
  const SB_STYLES = {
    // ink and watercolour wash: a warm brown line round soft, light-filled colour
    ink: { line: '#4e3528', lw: 1.5, mode: 'wash',
      logs: [[222, 170, 104], [206, 150, 90], [232, 186, 122]], logEnd: [246, 214, 160], barn: [196, 150, 100],
      turf: [[126, 184, 84], [110, 170, 84], [140, 190, 76]], turfDk: [78, 138, 62], turfHi: [186, 220, 110], bark: [252, 246, 230],
      eave: [150, 104, 66], frame: [140, 92, 58], door: [176, 112, 64], iron: [70, 60, 58], board: [214, 164, 104], post: [160, 116, 74],
      shingle: [190, 174, 152], shingleDk: [130, 112, 96], thatch: [240, 204, 110], thatchDk: [196, 154, 66], stone: [204, 200, 190],
      dark: [74, 52, 40], flowers: [[255, 255, 250], [250, 214, 80], [236, 130, 160], [110, 150, 220]] },
    // cut paper and gouache: no line, flat saturated shapes with one hard shadow
    cut: { line: null, lw: 1.5, mode: 'facet',
      logs: [[226, 150, 84], [208, 130, 72], [236, 168, 96]], logEnd: [250, 216, 152], barn: [190, 128, 84],
      turf: [[104, 178, 92], [86, 164, 98], [128, 186, 78]], turfDk: [58, 128, 76], turfHi: [176, 220, 104], bark: [255, 248, 232],
      eave: [128, 80, 52], frame: [120, 70, 46], door: [92, 54, 40], iron: [50, 42, 46], board: [222, 150, 86], post: [150, 96, 60],
      shingle: [156, 158, 170], shingleDk: [108, 110, 128], thatch: [246, 200, 84], thatchDk: [206, 150, 50], stone: [200, 200, 206],
      dark: [60, 40, 48], flowers: [[255, 255, 250], [255, 214, 60], [246, 120, 150], [90, 140, 230]] },
    // church mural (after the painted vaults of the 1400s): a heavy dark contour, flat ochre, red oxide and green earth, ordered ornament
    mural: { line: '#2c201c', lw: 2, mode: 'flat',
      logs: [[216, 166, 82], [206, 152, 74], [224, 176, 94]], logEnd: [240, 220, 170], barn: [200, 150, 84],
      turf: [[112, 150, 84], [100, 140, 88], [124, 156, 80]], turfDk: [70, 104, 62], turfHi: [164, 186, 110], bark: [244, 236, 212],
      eave: [150, 70, 48], frame: [160, 72, 50], door: [184, 90, 60], iron: [44, 36, 34], board: [220, 180, 104], post: [150, 70, 48],
      shingle: [196, 184, 156], shingleDk: [120, 104, 84], thatch: [232, 192, 98], thatchDk: [176, 124, 56], stone: [216, 208, 192],
      dark: [48, 36, 32], flowers: [[250, 246, 232], [232, 190, 70], [186, 62, 44], [250, 246, 232]] },
  };
  function sbKit(w, h, seed) {
    const c = makeCanvas(w * SBK, h * SBK), g = c.getContext('2d'), S = SB_STYLES[ART_STYLE], r = G.mulberry32(seed);
    c.artK = SBK; g.scale(SBK, SBK); g.lineJoin = 'round'; g.lineCap = 'round';
    const col = (c3, f = 1) => `rgb(${c3.map((v) => Math.max(0, Math.min(255, v * f)) | 0)})`;
    const jit = (c3, a = 0.07) => { const f = 1 - a + r() * 2 * a; return c3.map((v) => v * f); };
    const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], k) => g[k ? 'lineTo' : 'moveTo'](x, y)); g.closePath(); };
    // Paints the current path: its colour, the style's shading inside it (over the box x0..x1, y0..y1), and its outline.
    const ink = (c3, x0, y0, x1, y1, o = {}) => {
      g.fillStyle = col(c3); g.fill();
      if (!o.flat && S.mode !== 'flat') {
        g.save(); g.clip();
        if (S.mode === 'wash') {
          const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(255,250,220,0.24)'); gr.addColorStop(0.5, 'rgba(255,250,220,0)');
          gr.addColorStop(1, 'rgba(60,30,40,0.2)'); g.fillStyle = gr; g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
        } else { g.fillStyle = 'rgba(30,20,50,0.17)'; g.fillRect(x0 + (x1 - x0) * 0.66, y0 - 2, x1 - x0, y1 - y0 + 4); }
        g.restore();
      }
      if (S.line && o.lw !== 0) { g.strokeStyle = S.line; g.lineWidth = (o.lw || 1) * S.lw; g.stroke(); }
    };
    const line = (c3, lw, alpha = 1) => { g.globalAlpha = alpha; g.strokeStyle = col(c3); g.lineWidth = lw; g.stroke(); g.globalAlpha = 1; };
    const shadow = (x, y, rx, ry) => { g.fillStyle = 'rgba(30,50,30,0.28)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
    return { c, g, S, r, col, jit, poly, ink, line, shadow };
  }
  function sbStones(K, x0, x1, y) {
    const { g, S, r, jit, ink } = K;
    for (let x = x0; x < x1; x += 7 + r() * 2.5) {
      g.beginPath(); g.ellipse(x, y, 4.4, 2.7, 0, 0, 7); ink(jit(S.stone, 0.06), x - 4, y - 3, x + 4, y + 3, { lw: 0.6 }); }
  }
  // A wall of n log courses, each h tall (less `gap`, for a barn that breathes), with the log ends of the corner joints.
  function sbLogWall(K, x0, x1, y0, n, h, base, gap = 0) {
    const { g, S, col, jit, ink, line } = K, lh = h - gap;
    for (let k = 0; k < n; k++) {
      const y = y0 + k * h, c3 = jit(base, S.mode === 'flat' ? 0.02 : 0.06).map((q) => q * (S.mode === 'facet' && k % 2 ? 0.92 : 1));
      rr(g, x0, y, x1 - x0, lh, lh / 2.6); ink(c3, x0, y, x1, y + h, { flat: true, lw: 0.5 });
      if (S.mode !== 'flat') { g.fillStyle = 'rgba(255,244,214,0.3)'; g.fillRect(x0 + 2.5, y + 1, x1 - x0 - 5, 1.2); }
    }
    if (S.mode === 'wash') {
      const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(255,250,220,0.16)'); gr.addColorStop(0.5, 'rgba(255,250,220,0)');
      gr.addColorStop(1, 'rgba(60,30,40,0.18)'); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, n * h - gap);
    } else if (S.mode === 'facet') { g.fillStyle = 'rgba(30,20,50,0.16)'; g.fillRect(x0 + (x1 - x0) * 0.7, y0, (x1 - x0) * 0.3, n * h - gap); }
    g.fillStyle = 'rgba(50,24,30,0.22)'; g.fillRect(x0, y0, x1 - x0, 3.2); // the shadow under the eaves
    for (let k = 0; k < n; k++) for (const x of [x0 - 1.4, x1 + 1.4]) {
      const y = y0 + k * h + lh / 2, rad = lh / 2 - 0.2;
      g.beginPath(); g.arc(x, y, rad, 0, 7); ink(S.logEnd, x - rad, y - rad, x + rad, y + rad, { flat: true, lw: 0.6 });
      g.beginPath(); g.arc(x, y, rad * 0.45, 0, 7); line(S.eave, 0.7, 0.6);
    }
  }
  const sbRoofPath = (g, e0, e1, r1, r0, yE, yR, sag) => {
    g.beginPath(); g.moveTo(e0, yE); g.lineTo(e1, yE); g.lineTo(r1, yR); g.quadraticCurveTo((r0 + r1) / 2, yR + sag, r0, yR); g.closePath(); };
  // Turf on birch bark: the bark's pale edge and the eave log that holds the turf, tufts and meadow flowers, and grass hanging over the eave.
  function sbTurfRoof(K, e0, e1, r1, r0, yE, yR, v) {
    const { g, S, r, col, ink, line } = K, base = S.turf[v % S.turf.length];
    g.beginPath(); g.rect(e0 + 2, yE - 1, e1 - e0 - 4, 2.6); ink(S.bark, e0, yE, e1, yE + 3, { flat: true, lw: 0.5 });
    rr(g, e0 + 1, yE + 1.2, e1 - e0 - 2, 3.6, 1.8); ink(S.eave, e0, yE, e1, yE + 5, { flat: true, lw: 0.6 });
    sbRoofPath(g, e0, e1, r1, r0, yE, yR, 2.2); ink(base, e0, yR, e1, yE);
    g.save(); sbRoofPath(g, e0 + 1, e1 - 1, r1 - 1, r0 + 1, yE - 1, yR + 1, 2.2); g.clip();
    for (let k = 0; k < 24; k++) {
      const x = e0 + r() * (e1 - e0), y = yR + 4 + r() * (yE - yR - 6);
      g.beginPath(); g.moveTo(x - 1.5, y - 2.5); g.lineTo(x, y); g.lineTo(x + 1.7, y - 2.7); line(k % 2 ? S.turfDk : S.turfHi, 1.1);
    }
    const n = 9;
    for (let k = 0; k < n; k++) {
      const t = S.mode === 'flat' ? (k + 0.5) / n : r(), row = S.mode === 'flat' ? (k % 2) * 0.7 + 0.15 : r();
      const y = yR + 5 + row * (yE - yR - 11), u = (yE - y) / (yE - yR), x0 = e0 + (r0 - e0) * u + 5, x1 = e1 + (r1 - e1) * u - 5;
      g.fillStyle = col(S.flowers[k % S.flowers.length]); g.beginPath(); g.arc(x0 + t * (x1 - x0), y, 1.6, 0, 7); g.fill();
    }
    g.restore();
    for (let x = e0 + 3.4; x < e1 - 2; x += 5.2) {
      g.beginPath(); g.arc(x + r() * 0.8, yE - 0.4, 2.9, 0, Math.PI); g.closePath(); ink(S.turfDk, x - 3, yE, x + 3, yE + 3, { flat: true, lw: 0.55 }); }
  }
  // Straw thatch in two layers, a combed eave, and crossed poles astride the ridge to hold it against the wind.
  function sbThatchRoof(K, e0, e1, r1, r0, yE, yR) {
    const { g, S, poly, ink, line } = K;
    sbRoofPath(g, e0, e1, r1, r0, yE, yR, 1.6); ink(S.thatch, e0, yR, e1, yE);
    g.save(); sbRoofPath(g, e0 + 1, e1 - 1, r1 - 1, r0 + 1, yE - 1, yR + 1, 1.6); g.clip();
    for (let x = e0 + 3; x < e1; x += 4.2) {
      const t = (x - e0) / (e1 - e0); g.beginPath(); g.moveTo(x, yE); g.lineTo(r0 + t * (r1 - r0), yR); line(S.thatchDk, 0.8, 0.55); }
    const ym = (yE + yR) / 2 + 1.5; g.beginPath(); g.moveTo(e0, ym);
    for (let x = e0, k = 0; x <= e1; x += 3, k++) g.lineTo(x, ym + (k % 2 ? 1.8 : 0));
    line(S.thatchDk, 1.1);
    g.restore();
    const pts = [[e0 + 1, yE - 0.5]]; for (let x = e0 + 1, k = 0; x <= e1 - 1; x += 3, k++) pts.push([x, yE + (k % 2 ? 2.4 : 0.4)]);
    pts.push([e1 - 1, yE - 0.5]); poly(pts); ink(S.thatchDk, e0, yE, e1, yE + 3, { flat: true, lw: 0.55 });
    rr(g, r0 - 2, yR - 2.2, r1 - r0 + 4, 4.4, 2.2); ink(S.thatchDk, r0, yR - 2, r1, yR + 2, { flat: true, lw: 0.7 });
    for (let x = r0 + 7; x < r1 - 4; x += 12.5) for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(x + d * 4.4, yR + 8); g.lineTo(x - d * 2.8, yR - 5.5);
      if (S.line) { g.strokeStyle = S.line; g.lineWidth = 2.9; g.stroke(); }
      line(S.post, 1.6);
    }
  }
  // Split shingles in overlapping rows under a ridge board.
  function sbShingleRoof(K, e0, e1, r1, r0, yE, yR) {
    const { g, S, ink, line } = K;
    sbRoofPath(g, e0, e1, r1, r0, yE, yR, 0); ink(S.shingle, e0, yR, e1, yE);
    g.save(); sbRoofPath(g, e0 + 1, e1 - 1, r1 - 1, r0 + 1, yE - 1, yR + 1, 0); g.clip();
    for (let y = yR + 5.6, row = 0; y < yE + 2; y += 5.3, row++) for (let x = e0 - (row % 2) * 2.7; x < e1 + 3; x += 5.4) {
      g.beginPath(); g.arc(x, y - 2.7, 2.7, 0, Math.PI); line(S.shingleDk, 0.9, 0.85); }
    g.restore();
    rr(g, r0 - 1.5, yR - 1.8, r1 - r0 + 3, 3.4, 1.4); ink(S.eave, r0, yR - 2, r1, yR + 2, { flat: true, lw: 0.6 });
  }
  // A plank door in a heavy frame, on iron strap hinges.
  function sbDoor(K, x, y, w, h) {
    const { g, S, ink, line } = K;
    g.beginPath(); g.rect(x, y, w, h); ink(S.frame, x, y, x + w, y + h, { flat: true, lw: 0.7 });
    g.beginPath(); g.rect(x + 2, y + 2, w - 4, h - 2); ink(S.door, x, y, x + w, y + h, { lw: 0.5 });
    for (let px = x + 2 + (w - 4) / 3; px < x + w - 3; px += (w - 4) / 3) {
      g.beginPath(); g.moveTo(px, y + 3); g.lineTo(px, y + h - 0.5); line(S.dark, 0.6, 0.45); }
    for (const f of [0.3, 0.76]) { g.beginPath(); g.moveTo(x + 2.4, y + h * f); g.lineTo(x + 2 + (w - 4) * 0.62, y + h * f); line(S.iron, 1.2); }
  }
  // The cottage (stuga): four fat log courses on a stone footing, a low door, a wind-eye with its shutter, a turf roof and its smoke hole.
  function sbStuga(v) {
    const K = sbKit(104, 80, 100 + v), { g, S, ink, line } = K;
    K.shadow(54, 73, 48, 7); sbStones(K, 15, 92, 69.6);
    sbLogWall(K, 13, 91, 41, 4, 7, S.logs[v % 3]);
    sbDoor(K, 22, 46, 17, 23);
    g.beginPath(); g.rect(61, 49, 9.5, 7.5); ink(S.dark, 61, 49, 71, 57, { flat: true, lw: 0.7 });
    g.beginPath(); g.rect(71.4, 48, 5.2, 9.5); ink(S.board, 71, 48, 77, 58, { lw: 0.6 });
    sbTurfRoof(K, 2, 102, 86, 18, 40, 11, v);
    for (const x of [17.5, 86.5]) { g.beginPath(); g.arc(x, 12.4, 2.9, 0, 7); ink(S.logEnd, x - 3, 9, x + 3, 15, { flat: true, lw: 0.6 }); }
    K.poly([[59.5, 14.5], [61, 5.5], [72, 5.5], [73.5, 14.5]]); ink(S.board, 59, 5, 74, 15, { lw: 0.7 });
    g.beginPath(); g.rect(63, 8, 7, 4.4); ink(S.dark, 63, 8, 70, 12, { flat: true, lw: 0 });
    g.beginPath(); g.moveTo(63, 8); g.lineTo(70, 8); line(S.dark, 0.5);
    return K.c;
  }
  // The storehouse (härbre): a small log box on posts and stones, away from damp and mice, under a boarded storey that juts out, and shingles.
  function sbHarbre() {
    const K = sbKit(56, 86, 7), { g, S, ink, line } = K;
    K.shadow(30, 81, 24, 4.5);
    for (const x of [12.2, 43.8]) {
      g.beginPath(); g.rect(x - 2.3, 63, 4.6, 16); ink(S.post, x - 2, 63, x + 2, 79, { lw: 0.6 });
      g.beginPath(); g.ellipse(x, 79.4, 5.2, 2.9, 0, 0, 7); ink(S.stone, x - 5, 76, x + 5, 82, { lw: 0.6 });
    }
    sbLogWall(K, 10, 46, 44.5, 3, 6.6, S.logs[1]);
    g.beginPath(); g.rect(3, 23, 50, 22); ink(S.board, 3, 23, 53, 45);
    for (let x = 8; x < 52; x += 5) { g.beginPath(); g.moveTo(x, 24.5); g.lineTo(x, 44); line(S.dark, 0.6, 0.35); }
    g.fillStyle = 'rgba(50,24,30,0.2)'; g.fillRect(3.5, 23.5, 49, 3);
    sbDoor(K, 21.5, 28, 12, 17);
    // a notched log for a ladder
    g.beginPath(); g.moveTo(41, 79); g.lineTo(51.5, 45);
    if (S.line) { g.strokeStyle = S.line; g.lineWidth = 4.6; g.stroke(); }
    line(S.post, 3.2);
    for (let k = 1; k < 6; k++) {
      const x = 41 + 10.5 * (k / 6), y = 79 - 34 * (k / 6); g.beginPath(); g.moveTo(x - 1.4, y - 0.4); g.lineTo(x + 1.4, y + 0.4); line(S.dark, 0.8, 0.7); }
    sbShingleRoof(K, 0.8, 55.2, 46, 10, 25, 4.5);
    return K.c;
  }
  // The barn (lada): gapped logs to let the hay and the unthreshed sheaves breathe, a wide double door, and straw thatch.
  function sbLada() {
    const K = sbKit(110, 72, 11), { g, S, ink, line } = K;
    K.shadow(56, 67, 50, 6);
    g.beginPath(); g.rect(11, 32, 88, 32.5); ink(S.dark, 11, 32, 99, 64, { flat: true, lw: 0 });
    sbLogWall(K, 10, 100, 32, 5, 6.6, S.barn, 1.7);
    g.beginPath(); g.rect(41, 38, 28, 26.5); ink(S.frame, 41, 38, 69, 64, { flat: true, lw: 0.7 });
    g.beginPath(); g.rect(43, 40, 24, 24.5); ink(S.board, 43, 40, 67, 64, { lw: 0.5 });
    g.beginPath(); g.moveTo(55, 40); g.lineTo(55, 64.5); line(S.dark, 0.9, 0.8);
    g.beginPath(); g.moveTo(44, 63); g.lineTo(54, 41); g.moveTo(56, 41); g.lineTo(66, 63); line(S.frame, 1.5);
    sbThatchRoof(K, 2, 108, 92, 18, 34, 7);
    return K.c;
  }
  // The byre (fähus): a low log house under turf, a plank door and a gap for air and light.
  function sbByre() {
    const K = sbKit(86, 62, 17), { g, S, ink } = K;
    K.shadow(44, 57, 40, 5); sbStones(K, 11, 78, 56.6);
    sbLogWall(K, 9, 77, 34.5, 3, 7.2, S.logs[1].map((q) => q * 0.95));
    sbDoor(K, 49.5, 37.5, 16, 18.6);
    g.beginPath(); g.rect(19.5, 41.5, 10, 4.2); ink(S.dark, 19, 41, 30, 46, { flat: true, lw: 0.7 });
    sbTurfRoof(K, 1, 85, 72, 14, 33.5, 10.5, 1);
    return K.c;
  }

