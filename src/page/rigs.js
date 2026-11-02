// @sys page/rigs: pawns: a jointed rig of tintable parts from one atlas, clothing by sex and age, and poses for each animation
  // ======== pawns: a jointed rig of tintable parts from one atlas, so a thousand pawns still batch ========
  // Parts are painted in greys (white = full colour) and tinted per pawn. 4 texels per world unit.
  const PX = 4;
  let atlas = null;
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function shadeRight(g, w, h, a = 0.22) { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
  function partCanvases() {
    const P = {};
    const mk = (name, w, h, fn) => { const c = makeCanvas(w, h), g = c.getContext('2d'); fn(g, w, h); P[name] = c; };
    mk('shadow', 34, 10, (g) => { const gr = g.createRadialGradient(17, 5, 0, 17, 5, 16); gr.addColorStop(0, 'rgba(20,28,18,0.42)'); gr.addColorStop(1, 'rgba(20,28,18,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(17, 5, 16, 4.5, 0, 0, 7); g.fill(); });
    mk('hose', 9, 27, (g, w, h) => { g.fillStyle = '#fff'; rr(g, 0.5, 0, 8, 27, 3.5); g.fill(); shadeRight(g, w, h, 0.25); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(1, 12, 7, 1); });
    mk('shoe', 12, 6, (g) => { g.fillStyle = 'rgb(86,60,40)'; g.beginPath(); g.moveTo(1, 5.5); g.lineTo(1, 1.5); g.quadraticCurveTo(4, 0, 8, 1.2); g.quadraticCurveTo(12, 2.5, 11.5, 5.5); g.closePath(); g.fill(); g.fillStyle = 'rgb(54,38,26)'; g.fillRect(1, 4.5, 10.5, 1.5); });
    mk('tunic', 28, 37, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(5, 1); g.lineTo(23, 1); g.quadraticCurveTo(26, 2, 25.5, 6); g.lineTo(27.5, 35); g.quadraticCurveTo(14, 37.5, 0.5, 35); g.lineTo(2.5, 6); g.quadraticCurveTo(2, 2, 5, 1); g.closePath(); g.fill();
      shadeRight(g, w, h, 0.26);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (const x of [9, 15, 20]) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x + (x - 14) * 0.25, 35); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(17, 2.5, 4, 2, 0, 0, 7); g.fill();
    });
    mk('dress', 34, 55, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(9, 1); g.lineTo(25, 1); g.quadraticCurveTo(28, 2, 27, 7); g.lineTo(33.5, 53); g.quadraticCurveTo(17, 56, 0.5, 53); g.lineTo(7, 7); g.quadraticCurveTo(6, 2, 9, 1); g.closePath(); g.fill();
      shadeRight(g, w, h, 0.26);
      g.strokeStyle = 'rgba(0,0,0,0.11)'; g.lineWidth = 1.2; for (const x of [10, 15, 21, 26]) { g.beginPath(); g.moveTo(x - (x - 17) * 0.2, 20); g.lineTo(x + (x - 17) * 0.45, 53); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(19, 2.5, 4, 2, 0, 0, 7); g.fill();
    });
    mk('apron', 12, 34, (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(2, 0); g.lineTo(10, 0); g.lineTo(11.5, 33); g.lineTo(0.5, 33); g.closePath(); g.fill(); shadeRight(g, w, h, 0.18); g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(5, 4, 1, 28); });
    mk('belt', 26, 4, (g) => { g.fillStyle = 'rgb(96,66,42)'; g.fillRect(0, 0.5, 26, 3); g.fillStyle = 'rgb(196,170,110)'; g.fillRect(17, 0, 4, 4); });
    mk('sleeve', 8, 21, (g, w, h) => { g.fillStyle = '#fff'; rr(g, 0, 0, 8, 21, 3.6); g.fill(); shadeRight(g, w, h, 0.22); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0.5, 18, 7, 1.2); });
    mk('hand', 7, 7, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(3.5, 3.5, 3.3, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.arc(4.6, 4.2, 2, 0, 7); g.fill(); });
    mk('head', 24, 25, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(11, 12.5, 10, 0, 7); g.fill();
      g.beginPath(); g.moveTo(19.5, 10); g.quadraticCurveTo(23.5, 13.5, 20, 15.5); g.fill(); // nose
      const gr = g.createLinearGradient(1, 0, 21, 0); gr.addColorStop(0, 'rgba(0,0,0,0.2)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, 24, 25); g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(8.5, 13.5, 2.2, 3, 0, 0, 7); g.fill(); // ear
      g.fillStyle = 'rgb(40,34,30)'; g.fillRect(15.5, 10.5, 2.2, 2.4); // eye
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(14.8, 8.6, 3.8, 1); // brow
      g.fillStyle = 'rgba(150,60,50,0.35)'; g.fillRect(17, 18, 3, 1.1); // mouth
      g.fillStyle = 'rgba(200,90,80,0.18)'; g.beginPath(); g.arc(16.5, 15, 2.4, 0, 7); g.fill(); // cheek
    });
    mk('hair', 24, 22, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(11, 11.5, 10.6, Math.PI * 0.95, Math.PI * 2.08); g.lineTo(20, 8); g.quadraticCurveTo(13, 6.5, 9, 9); g.quadraticCurveTo(7, 15, 4.5, 20); g.quadraticCurveTo(0.5, 17, 0.5, 11); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; for (const x of [5, 9, 13]) { g.beginPath(); g.moveTo(x, 3); g.quadraticCurveTo(x - 2, 9, x - 3, 15); g.stroke(); } });
    mk('beard', 14, 12, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(1, 0); g.quadraticCurveTo(2, 8, 8, 11.5); g.quadraticCurveTo(13.5, 10, 13, 4); g.lineTo(10.5, 5); g.quadraticCurveTo(8, 3, 6.5, 0.5); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(4, 6, 1, 4); g.fillRect(8, 7, 1, 4); });
    mk('hood', 32, 36, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(15, 0.5); g.quadraticCurveTo(26, 0.5, 27, 12); g.lineTo(25, 12); g.quadraticCurveTo(22, 4.5, 15, 6); g.quadraticCurveTo(16, 16, 22, 23); g.lineTo(31, 26); g.quadraticCurveTo(31, 33, 26, 35); g.lineTo(4, 35); g.quadraticCurveTo(0, 30, 3, 24); g.quadraticCurveTo(1, 12, 5, 6); g.quadraticCurveTo(8, 0.5, 15, 0.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(5, 6); g.quadraticCurveTo(-1, 8, 0.5, 18); g.lineTo(3, 18); g.closePath(); g.fill(); // liripipe tail
      shadeRight(g, w, h, 0.2);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(15, 6); g.quadraticCurveTo(16, 16, 22, 23); g.stroke();
    });
    mk('headcloth', 28, 32, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(13, 0.5); g.quadraticCurveTo(25, 0, 25, 11); g.lineTo(22.5, 11); g.quadraticCurveTo(21, 5, 14, 5.5); g.quadraticCurveTo(14.5, 15, 19, 21); g.lineTo(24, 22); g.quadraticCurveTo(24, 30, 17, 31); g.lineTo(5, 31); g.quadraticCurveTo(0, 22, 1.5, 12); g.quadraticCurveTo(3, 1, 13, 0.5); g.closePath(); g.fill();
      shadeRight(g, w, h, 0.16);
      g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1; for (const y of [12, 20, 27]) { g.beginPath(); g.moveTo(3, y); g.quadraticCurveTo(10, y + 2, 17, y - 1); g.stroke(); }
    });
    mk('braid', 7, 22, (g) => { g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(3.5, 3 + k * 4, 3, 2.6, 0.3, 0, 7); g.fill(); } g.fillStyle = 'rgba(0,0,0,0.15)'; for (let k = 0; k < 5; k++) g.fillRect(1, 4 + k * 4, 5, 0.8); });
    mk('band', 22, 4, (g) => { g.fillStyle = 'rgb(160,60,48)'; rr(g, 0, 0.5, 22, 3, 1.5); g.fill(); g.fillStyle = 'rgba(255,220,140,0.7)'; for (let x = 2; x < 20; x += 4) g.fillRect(x, 1.5, 1.5, 1); });
    // tools and loads, drawn in their own colours; the grip is at the top
    const wood = 'rgb(122,92,60)', iron = 'rgb(120,124,130)', ironHi = 'rgb(186,190,196)';
    mk('hoe', 16, 46, (g) => { g.fillStyle = wood; g.fillRect(3, 0, 2.4, 42); g.fillStyle = iron; g.beginPath(); g.moveTo(3, 40); g.lineTo(15, 41); g.lineTo(15, 45.5); g.lineTo(3, 44); g.closePath(); g.fill(); g.fillStyle = ironHi; g.fillRect(4, 41, 10, 1); });
    mk('axe', 16, 36, (g) => { g.fillStyle = wood; g.fillRect(3, 0, 2.6, 34); g.fillStyle = iron; g.beginPath(); g.moveTo(5, 25); g.quadraticCurveTo(11, 22, 15, 24); g.lineTo(15, 35); g.quadraticCurveTo(10, 34, 5, 32); g.closePath(); g.fill(); g.fillStyle = ironHi; g.fillRect(13.5, 24.5, 1.5, 10); });
    mk('sickle', 18, 22, (g) => { g.fillStyle = wood; g.fillRect(2, 0, 3, 9); g.strokeStyle = iron; g.lineWidth = 2.2; g.beginPath(); g.moveTo(3.5, 9); g.quadraticCurveTo(4, 21, 12, 20); g.quadraticCurveTo(17.5, 18, 16, 11); g.stroke(); g.strokeStyle = ironHi; g.lineWidth = 0.8; g.beginPath(); g.moveTo(5, 10); g.quadraticCurveTo(5.5, 19, 12, 18.5); g.stroke(); });
    mk('mallet', 16, 32, (g) => { g.fillStyle = wood; g.fillRect(3, 0, 2.4, 26); g.fillStyle = 'rgb(140,108,72)'; rr(g, 0, 24, 15, 8, 2.5); g.fill(); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 29.5, 15, 2.5); });
    mk('basket', 16, 12, (g) => { g.fillStyle = 'rgb(170,134,80)'; g.beginPath(); g.moveTo(0.5, 1); g.lineTo(15.5, 1); g.quadraticCurveTo(15, 11.5, 8, 11.5); g.quadraticCurveTo(1, 11.5, 0.5, 1); g.fill(); g.strokeStyle = 'rgba(80,56,30,0.6)'; g.lineWidth = 0.8; for (let y = 3; y < 11; y += 2.5) { g.beginPath(); g.moveTo(1, y); g.lineTo(15, y); g.stroke(); } g.fillStyle = 'rgb(214,190,120)'; g.beginPath(); g.ellipse(8, 1.5, 7, 1.6, 0, 0, 7); g.fill(); });
    mk('bucket', 10, 12, (g) => { g.strokeStyle = 'rgb(60,48,36)'; g.lineWidth = 0.9; g.beginPath(); g.arc(5, 4, 4.5, Math.PI, 0); g.stroke(); g.fillStyle = 'rgb(140,104,66)'; g.beginPath(); g.moveTo(1, 4); g.lineTo(9, 4); g.lineTo(8.2, 11.5); g.lineTo(1.8, 11.5); g.closePath(); g.fill(); g.fillStyle = 'rgb(70,58,48)'; g.fillRect(1.3, 6, 7.4, 0.9); g.fillRect(1.6, 9.5, 6.8, 0.9); g.fillStyle = 'rgb(120,170,190)'; g.fillRect(1.6, 4, 6.8, 1.2); });
    mk('sheaf', 26, 14, (g) => { g.strokeStyle = 'rgb(214,178,92)'; g.lineWidth = 1.4; for (let k = 0; k < 14; k++) { const y = 3 + k * 0.6; g.beginPath(); g.moveTo(1, y + (k % 3)); g.quadraticCurveTo(12, y - 1, 25, y + 2 + (k % 4)); g.stroke(); } g.fillStyle = 'rgb(236,206,120)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(22 + (k % 3), 3 + k * 1.4, 2.2, 1.1, 0.4, 0, 7); g.fill(); } g.fillStyle = 'rgb(150,112,60)'; g.fillRect(10, 2, 2.4, 10); });
    mk('logs', 24, 14, (g) => { const ends = [[5, 9], [11, 10], [17, 9], [8, 4.5], [14, 4.5], [20, 5]]; g.fillStyle = 'rgb(112,84,56)'; rr(g, 2, 2, 21, 11, 3); g.fill(); for (const [x, y] of ends) { g.fillStyle = 'rgb(206,176,124)'; g.beginPath(); g.arc(x, y, 2.9, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,80,48,0.7)'; g.lineWidth = 0.7; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.stroke(); } g.fillStyle = 'rgb(80,60,40)'; g.fillRect(12, 1, 1.5, 12); });
    mk('scythe', 30, 50, (g) => { g.fillStyle = wood; g.fillRect(14, 0, 2.2, 46); g.fillRect(9, 16, 6, 2); g.strokeStyle = iron; g.lineWidth = 2.4; g.beginPath(); g.moveTo(15, 46); g.quadraticCurveTo(24, 47, 29.5, 42); g.stroke(); g.strokeStyle = ironHi; g.lineWidth = 0.8; g.beginPath(); g.moveTo(16, 46.5); g.quadraticCurveTo(24, 47.5, 29, 43); g.stroke(); });
    mk('hay', 28, 18, (g) => { g.fillStyle = 'rgb(196,182,104)'; g.beginPath(); g.ellipse(14, 10, 13, 7.5, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(150,136,70,0.9)'; g.lineWidth = 0.8; for (let k = 0; k < 16; k++) { const x = 3 + k * 1.5; g.beginPath(); g.moveTo(x, 4 + (k % 3)); g.quadraticCurveTo(x + 2, 10, x - 1, 16 - (k % 2)); g.stroke(); } g.strokeStyle = 'rgb(110,86,60)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(5, 6); g.lineTo(23, 14); g.stroke(); });
    return P;
  }
  function buildAtlas() {
    const P = partCanvases(), names = Object.keys(P), W = 256;
    let x = 1, y = 1, rowH = 0;
    const pos = {};
    for (const n of names) { const c = P[n]; if (x + c.width + 1 > W) { x = 1; y += rowH + 2; rowH = 0; } pos[n] = [x, y, c.width, c.height]; x += c.width + 2; rowH = Math.max(rowH, c.height); }
    const canvas = makeCanvas(W, y + rowH + 2), g = canvas.getContext('2d');
    for (const n of names) g.drawImage(P[n], pos[n][0], pos[n][1]);
    const source = new PIXI.CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
    const tex = {};
    for (const n of names) tex[n] = new PIXI.Texture({ source, frame: new PIXI.Rectangle(...pos[n]) });
    return tex;
  }

  // Clothing after medieval Swedish peasant dress: wool kirtles in undyed or plant-dyed colours, hose and turnshoes,
  // hoods for men, a linen headcloth for married women and loose braided hair with a band for unmarried ones.
  const DYES = [[198, 190, 172], [150, 122, 92], [162, 70, 52], [78, 104, 146], [196, 166, 78], [112, 126, 82], [128, 98, 124], [176, 160, 136]];
  const HOSE = [[92, 82, 70], [72, 84, 100], [116, 76, 60], [86, 98, 74], [120, 108, 92]];
  const SKINS = [[242, 208, 182], [232, 194, 164], [220, 180, 150]];
  const HAIRS = [[232, 206, 142], [206, 164, 100], [158, 112, 66], [110, 78, 52], [76, 58, 44]];
  const LINEN = [242, 238, 226];
  const hex = (c, f = 1) => ((Math.min(255, c[0] * f) << 16) | (Math.min(255, c[1] * f) << 8) | Math.min(255, c[2] * f)) >>> 0;
  function makeRig(p, married) {
    const r = G.mulberry32(p.look), pick = (a) => a[(r() * a.length) | 0];
    const look = { cloth: pick(DYES), cloth2: pick(DYES), hose: pick(HOSE), skin: pick(SKINS), hair: pick(HAIRS), beard: p.sex === 'm' && r() < 0.6, hood: p.sex === 'm' && r() < 0.45, hoodCol: pick(DYES) };
    const S = (name, tint, ax = 0.5, ay = 0) => { const s = new PIXI.Sprite(atlas[name]); s.anchor.set(ax, ay); if (tint !== undefined) s.tint = tint; return s; };
    const root = new PIXI.Container(); root.scale.set(1 / PX);
    const shadow = S('shadow', undefined, 0.5, 0.5); root.addChild(shadow);
    const leg = (x, back) => {
      const c = new PIXI.Container(); c.position.set(x, -27);
      const h = S('hose', hex(look.hose, back ? 0.78 : 1)); c.addChild(h);
      const sh = S('shoe', back ? 0xcccccc : undefined, 0.3, 0.5); sh.position.set(1, 25.5); c.addChild(sh);
      root.addChild(c); return c;
    };
    const legB = leg(-2, true), legF = leg(2, false);
    const upper = new PIXI.Container(); upper.position.set(0, -27); root.addChild(upper);
    const arm = (x, back) => {
      const c = new PIXI.Container(); c.position.set(x, -24);
      c.addChild(S('sleeve', hex(p.sex === 'f' ? look.cloth : look.cloth, back ? 0.74 : 1)));
      const hand = new PIXI.Container(); hand.position.set(0, 21); c.addChild(hand);
      hand.addChild(S('hand', hex(look.skin, back ? 0.85 : 1), 0.5, 0.5));
      return { c, hand };
    };
    const aB = arm(-3, true); upper.addChild(aB.c);
    const back = new PIXI.Sprite(); back.anchor.set(0.5, 0.5); back.position.set(-10, -16); upper.addChild(back); // load on the back
    if (p.sex === 'f') {
      const d = S('dress', hex(look.cloth)); d.position.set(0, -27); upper.addChild(d);
      const ap = S('apron', hex(LINEN, 0.97)); ap.position.set(5.5, -14); upper.addChild(ap);
      const bt = S('belt', 0xffffff); bt.scale.x = 0.78; bt.position.set(0.5, -15); upper.addChild(bt);
    } else {
      const t = S('tunic', hex(look.cloth)); t.position.set(0, -27); upper.addChild(t);
      const bt = S('belt', 0xffffff); bt.position.set(0, -11); upper.addChild(bt);
    }
    const head = new PIXI.Container(); head.position.set(1, -27); upper.addChild(head);
    if (p.sex === 'f' && !married) { const b = S('braid', hex(look.hair, 0.9), 0.5, 0); b.position.set(-9, -16); head.addChild(b); }
    head.addChild(S('head', hex(look.skin), 0.46, 1));
    if (p.sex === 'm') {
      if (look.beard) { const bd = S('beard', hex(look.hair, 0.95), 0.5, 0); bd.position.set(3, -9); head.addChild(bd); }
      const hood = S('hood', hex(look.hoodCol), 0.47, 1); hood.position.set(0, 7); hood.visible = look.hood; head.addChild(hood);
      const hair = S('hair', hex(look.hair), 0.46, 1); hair.position.set(0, -2.5); hair.visible = !look.hood; head.addChild(hair);
      look.hoodSprite = hood; look.hairSprite = hair;
    } else if (married) {
      const hc = S('headcloth', hex(LINEN), 0.46, 1); hc.position.set(0, 5); head.addChild(hc);
    } else {
      const hair = S('hair', hex(look.hair), 0.46, 1); hair.position.set(0, -2.5); head.addChild(hair);
      const band = S('band', undefined, 0.5, 0.5); band.position.set(0, -19); band.rotation = -0.15; head.addChild(band);
    }
    const shoulder = new PIXI.Sprite(); shoulder.anchor.set(0.5, 0.75); shoulder.position.set(-1, -26); upper.addChild(shoulder); // load on the shoulder
    const aF = arm(3, false); upper.addChild(aF.c);
    const tool = new PIXI.Sprite(); tool.anchor.set(0.25, 0.05); aF.hand.addChild(tool);
    const heldB = new PIXI.Sprite(); heldB.anchor.set(0.5, 0.1); aB.hand.addChild(heldB);
    const heldF = new PIXI.Sprite(); heldF.anchor.set(0.5, 0.1); aF.hand.addChild(heldF);
    return { root, legB, legF, upper, armB: aB.c, armF: aF.c, head, tool, back, shoulder, heldB, heldF, look, shadow };
  }

  // Poses: angles in radians. Arm 0 hangs down, negative swings forward and up. Upper body leans forward with positive angles.
  const swing = (t, a, b) => a + (b - a) * (0.5 - 0.5 * Math.cos(t));
  function strike(t) { const u = t % 1; return u < 0.7 ? u / 0.7 : 1 - (u - 0.7) / 0.3; } // slow lift, fast blow
  function pose(R, a, t, winter) {
    const s = a.stride * Math.PI, walking = !!a.path, anim = walking ? 'walk' : a.anim === 'hoe' && Sim.withOxen(st, a) ? 'plough' : a.anim;
    let legF = 0, legB = 0, armF = 0.05, armB = 0.05, lean = 0, bob = 0, headR = 0;
    let tool = null, toolR = 0, back = null, shoulder = null, heldF = null, heldB = null;
    if (walking || anim === 'sow' || anim === 'plough') {
      const k = anim === 'sow' && !walking ? 0.35 : 0.5;
      legF = Math.sin(s) * k; legB = -Math.sin(s) * k;
      armF = -Math.sin(s) * 0.42; armB = Math.sin(s) * 0.42;
      bob = -Math.abs(Math.cos(s)) * 1.6; lean = 0.05;
    } else {
      bob = Math.sin(t * 2.1 + a.id) * 0.35; armF = 0.04 + Math.sin(t * 2.1 + a.id) * 0.03; armB = armF;
    }
    const cyc = t * 0.9 + a.id * 0.37;
    if (!walking) switch (anim) {
      case 'hoe': { const k = strike(cyc); lean = 0.3 - k * 0.12; armF = -0.55 - k * 2.0; armB = armF + 0.25; tool = 'hoe'; toolR = -0.15; legF = -0.25; legB = 0.25; break; }
      case 'chop': { const k = strike(cyc * 1.1); lean = 0.12 + (1 - k) * 0.18; armF = -1.0 - k * 2.0; armB = armF + 0.2; tool = 'axe'; toolR = -0.1; legF = -0.3; legB = 0.3; break; }
      case 'mallet': { const k = strike(cyc * 1.2); lean = 0.32; armF = -0.8 - k * 1.6; armB = 0.1; tool = 'mallet'; toolR = -0.05; legF = -0.2; legB = 0.2; break; }
      case 'reap': { lean = 0.62; armF = swing(cyc * 4.2, -0.15, -1.25); armB = -0.9 + Math.sin(cyc * 4.2) * 0.1; tool = 'sickle'; toolR = 0.3; legF = -0.3; legB = 0.32; break; }
      case 'mow': { const k = swing(cyc * 3.2, 0, 1); lean = 0.32; armF = -0.5 - k * 1.1; armB = armF + 0.35; tool = 'scythe'; toolR = -0.6 + k * 1.0; legF = -0.32; legB = 0.32; break; }
      case 'gather': { const k = 0.5 + 0.5 * Math.sin(cyc * 3); lean = 0.25 + k * 0.5; armF = -0.4 - k * 0.3; armB = -0.3 - k * 0.3; legF = -0.2; legB = 0.25; break; }
      case 'draw': { lean = 0.1; armF = swing(cyc * 4, -1.0, -2.4); armB = swing(cyc * 4 + Math.PI, -1.0, -2.4); break; }
      // behind the ard (VB-138): walking the furrow, both hands on the stilt, leaning into it
      case 'plough': { lean = 0.32; armF = -0.95; armB = -0.8; break; }
      // milking (VB-135): crouched on the stool, hands pulling by turns, the pail on the ground beside
      case 'milk': { const k = Math.sin(cyc * 9); lean = 0.5; bob = 2; armF = -0.75 + k * 0.2; armB = -0.75 - k * 0.2; legF = -1.25; legB = -1.0; heldB = 'bucket'; break; }
    }
    if (anim === 'sow') { const k = swing(cyc * 5, -0.15, -1.7); armF = k; armB = -0.55; heldB = 'basket'; }
    if (a.carry === 'sheaf') { shoulder = 'sheaf'; armF = -2.45; }
    if (a.carry === 'hay') { back = 'hay'; armF = -2.3; armB = -2.1; lean += 0.15; }
    if (a.carry === 'logs') { back = 'logs'; armF = -0.35 + armF * 0.3; armB = -0.35 + armB * 0.3; lean += 0.12; }
    if (a.carry === 'buckets') { heldF = 'bucket'; heldB = 'bucket'; armF = armF * 0.25 + 0.05; armB = armB * 0.25 + 0.05; }
    if (!walking && anim === 'idle' && a.id % 3 === 0) headR = Math.sin(t * 0.4 + a.id) * 0.08;
    R.legF.rotation = legF; R.legB.rotation = legB; R.armF.rotation = armF; R.armB.rotation = armB;
    R.upper.rotation = lean; R.upper.y = -27 + bob; R.head.rotation = headR;
    const set = (spr, name) => { if (name) { spr.texture = atlas[name]; spr.visible = true; } else spr.visible = false; };
    set(R.tool, tool); R.tool.rotation = toolR; set(R.back, back); set(R.shoulder, shoulder); set(R.heldF, heldF); set(R.heldB, heldB);
    R.shoulder.scale.set(1.7); R.shoulder.rotation = -0.35; R.back.scale.set(1.5); R.heldF.scale.set(1.35); R.heldB.scale.set(heldB === 'basket' ? 1.45 : 1.35);
    if (R.look.hoodSprite) { const hood = R.look.hood || winter; R.look.hoodSprite.visible = hood; R.look.hairSprite.visible = !hood; }
  }

