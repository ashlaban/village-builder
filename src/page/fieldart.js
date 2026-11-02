// @sys page/fieldart: field and meadow art by stage, and the art atlas of the settlement
  function hexClip(g, cx, cy, r) {
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = (Math.PI / 180) * (30 + 60 * k); g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath();
  }
  function fieldCanvas(stage, R) {
    const S = 2, Wc = Math.ceil(Math.sqrt(3) * R * S) + 2, Hc = Math.ceil(2 * R * S) + 2, c = makeCanvas(Wc, Hc), g = c.getContext('2d');
    const cx = Wc / 2, cy = Hc / 2, rr0 = R * S * 0.92, r = G.mulberry32(stage.length * 977 + 5);
    const P = {
      stubble: { base: [182, 164, 106], row: [150, 128, 78], hi: [204, 188, 130] },
      plowed: { base: [108, 80, 54], row: [80, 58, 40], hi: [138, 106, 74] },
      sown: { base: [118, 90, 62], row: [96, 72, 50], hi: [146, 116, 82] },
      young: { base: [112, 94, 62], row: [98, 128, 60], hi: [132, 172, 78] },
      growing: { base: [96, 116, 58], row: [80, 128, 52], hi: [128, 168, 78] },
      ripe: { base: [190, 154, 74], row: [222, 190, 98], hi: [240, 214, 130] },
      fallow: { base: [134, 150, 82], row: [146, 160, 88], hi: [176, 176, 104] },
      scrub: { base: [116, 136, 74], row: [124, 142, 78], hi: [150, 160, 92] },
    }[stage];
    const rgb = (a, f = 1) => `rgb(${(a[0] * f) | 0},${(a[1] * f) | 0},${(a[2] * f) | 0})`;
    g.save(); hexClip(g, cx, cy, rr0); g.clip();
    g.fillStyle = rgb(P.base); g.fillRect(0, 0, Wc, Hc);
    for (let y = 4; y < Hc; y += 9) {
      if (stage === 'fallow' || stage === 'scrub') {
        for (let x = r() * 4; x < Wc; x += 2 + r() * 4) {
        if (stage === 'fallow' && r() < 0.35) {
        g.strokeStyle = r() < 0.5 ? 'rgba(196,186,120,0.8)' : 'rgba(90,120,56,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 2);
        g.lineTo(x + (r() - 0.5) * 2, y - 3); g.stroke(); } else if (stage === 'scrub' && r() < 0.14) {
        g.fillStyle = r() < 0.5 ? 'rgba(70,96,52,0.9)' : 'rgba(96,110,60,0.9)'; g.beginPath(); g.arc(x, y, 2.5 + r() * 2.5, 0, 7); g.fill(); } } continue; }
      g.strokeStyle = rgb(P.row); g.lineWidth = stage === 'growing' || stage === 'ripe' ? 5 : stage === 'plowed' ? 4 : 3;
      g.beginPath(); for (let x = 0; x <= Wc; x += 6) g[x ? 'lineTo' : 'moveTo'](x, y + Math.sin(x * 0.2 + y) * 0.8); g.stroke();
      if (stage !== 'stubble') { g.strokeStyle = rgb(P.hi); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, y - 2); g.lineTo(Wc, y - 2); g.stroke(); }
      for (let x = r() * 6; x < Wc; x += stage === 'young' ? 1.5 + r() * 2 : 3 + r() * 5) {
        if (stage === 'stubble') {
          g.strokeStyle = rgb(P.hi, 0.95 + r() * 0.1); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 0.6, y - 2); g.stroke(); }
        else if (stage === 'sown' && r() < 0.22) { g.fillStyle = 'rgba(214,196,140,0.8)'; g.fillRect(x, y - 1, 1.4, 1.4); }
        else if (stage === 'plowed' && r() < 0.3) { g.fillStyle = 'rgba(60,44,30,0.6)'; g.fillRect(x, y + 1, 2.4, 1.6); }
        else if (stage === 'young') { g.fillStyle = rgb(P.hi, 0.9 + r() * 0.2); g.fillRect(x, y - 2.5, 2.2, 3.5); }
        else if (stage === 'ripe' && r() < 0.6) { g.fillStyle = rgb(P.hi); g.beginPath(); g.ellipse(x, y - 2, 1.2, 2, 0.3, 0, 7); g.fill(); }
      }
    }
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`; g.fillRect(r() * Wc, r() * Hc, 1.5, 1.5); }
    g.restore();
    hexClip(g, cx, cy, rr0); g.strokeStyle = 'rgba(70,58,34,0.45)'; g.lineWidth = 2; g.stroke();
    return c;
  }
  // A hay meadow (VB-132): tall flowering grass; mown, with windrows of drying hay and haycocks; aftermath, short regrowth.
  function meadowCanvas(stage, R) {
    const S = 2, Wc = Math.ceil(Math.sqrt(3) * R * S) + 2, Hc = Math.ceil(2 * R * S) + 2, c = makeCanvas(Wc, Hc), g = c.getContext('2d');
    const cx = Wc / 2, cy = Hc / 2, rr0 = R * S * 0.92, r = G.mulberry32(stage.length * 131 + 9);
    const base = { grass: [104, 138, 58], mown: [150, 160, 84], aftermath: [122, 150, 70] }[stage];
    g.save(); hexClip(g, cx, cy, rr0); g.clip();
    g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, Wc, Hc);
    const blades = stage === 'grass' ? 1400 : stage === 'aftermath' ? 700 : 300, tall = stage === 'grass' ? 6 : 2.2;
    for (let k = 0; k < blades; k++) {
      const x = r() * Wc, y = r() * Hc, f = 0.8 + r() * 0.45;
      g.strokeStyle = `rgb(${base.map((v) => Math.min(255, v * f) | 0)})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2.5, y - tall * (0.6 + r() * 0.6)); g.stroke();
    }
    if (stage !== 'mown') {
      const flowers = stage === 'grass' ? 160 : 30,
        cols = ['rgba(250,250,240,0.95)', 'rgba(244,214,80,0.95)', 'rgba(170,110,190,0.9)', 'rgba(120,140,220,0.9)', 'rgba(230,120,140,0.85)'];
      for (let k = 0; k < flowers; k++) {
        g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.arc(r() * Wc, r() * Hc, 1.1 + r() * 0.8, 0, 7); g.fill(); }
    } else {
      for (let y = 10; y < Hc; y += 16) { // windrows
        g.strokeStyle = 'rgb(196,182,108)'; g.lineWidth = 5; g.beginPath();
        for (let x = 0; x <= Wc; x += 6) g[x ? 'lineTo' : 'moveTo'](x, y + Math.sin(x * 0.08 + y) * 2.5);
        g.stroke(); g.strokeStyle = 'rgba(150,132,70,0.7)'; g.lineWidth = 1.2; g.stroke();
      }
      for (let k = 0; k < 7; k++) { // haycocks
        const x = cx + (r() - 0.5) * Wc * 0.6, y = cy + (r() - 0.5) * Hc * 0.55;
        g.fillStyle = 'rgba(30,40,20,0.3)'; g.beginPath(); g.ellipse(x + 1, y + 4, 7, 2.6, 0, 0, 7); g.fill();
        g.fillStyle = 'rgb(206,190,116)'; g.beginPath(); g.moveTo(x - 7, y + 4); g.quadraticCurveTo(x, y - 12, x + 7, y + 4); g.fill();
        g.strokeStyle = 'rgba(140,120,60,0.8)'; g.lineWidth = 0.8; g.stroke();
      }
    }
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; g.fillRect(r() * Wc, r() * Hc, 1.5, 1.5); }
    g.restore();
    hexClip(g, cx, cy, rr0); g.strokeStyle = 'rgba(80,90,40,0.35)'; g.lineWidth = 1.5; g.stroke();
    return c;
  }
  function curbCanvas() {
    const c = makeCanvas(40, 30), g = c.getContext('2d'), r = G.mulberry32(9);
    g.fillStyle = 'rgba(20,30,20,0.3)'; g.beginPath(); g.ellipse(20, 26, 17, 3.5, 0, 0, 7); g.fill();
    for (let k = 0; k < 3; k++) logCourse(g, 3, 37, 10 + k * 5, 5, [130, 108, 84], r);
    g.fillStyle = 'rgb(36,50,60)'; g.beginPath(); g.ellipse(20, 10, 15, 3, 0, 0, 7); g.fill();
    return c;
  }
  function puffCanvas() {
    const c = makeCanvas(24, 24), g = c.getContext('2d'), gr = g.createRadialGradient(12, 12, 0, 12, 12, 12);
    gr.addColorStop(0, 'rgba(225,225,220,0.9)'); gr.addColorStop(1, 'rgba(225,225,220,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 24, 24);
    return c;
  }
  function makeArt(R) {
    const T = (c) => texFrom(c, { autoGenerateMipmaps: true });
    fieldTex = {}; for (const k of ['stubble', 'plowed', 'sown', 'young', 'growing', 'ripe', 'fallow', 'scrub']) fieldTex[k] = T(fieldCanvas(k, R));
    for (const k of ['grass', 'mown', 'aftermath']) fieldTex['meadow-' + k] = T(meadowCanvas(k, R));
    art = {
      stuga: [0, 1, 2].map((v) => T(stugaCanvas(v))), harbre: T(harbreCanvas()), lada: T(ladaCanvas()),
      wood: [0, 1, 2, 3].map((l) => T(woodpileCanvas(l))), sweep: T(wellSweepCanvas()), curb: T(curbCanvas()),
      stook: [0, 1].map((v) => T(stookCanvas(v))), yard: T(yardCanvas()), puff: T(puffCanvas()), byre: T(byreCanvas()),
      haystack: [0, 1, 2, 3].map((l) => T(haystackCanvas(l))),
      manure: [0, 1, 2].map((l) => T(manureCanvas(l))),
      cow: COATS.map((_, k) => [T(cowCanvas(k, 0)), T(cowCanvas(k, 1))]), sheep: [T(sheepCanvas(0)), T(sheepCanvas(1))],
    };
    atlas = buildAtlas();
  }
