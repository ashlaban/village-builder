// @sys page/portraits: portraits of pawns and icons of farms and villages for the panels, from the map's own rig parts and building art
  // ======== portraits and icons ========
  // A portrait is the pawn's bust as the map draws it, larger: the same parts, colours and headgear (lookOf, page/rigs), in profile. An icon
  // is a building as it stands on the map. Both are data URLs for <img>, cached; the caches are the page's own and are cleared with the map.
  const FACE = 3, BUST = 40; // texels per rig unit; the bust is a 40-unit square of the rig: head and shoulders
  let faceParts = null;
  const faceCache = new Map(), iconCache = new Map(), FACE_CAP = 600;
  function clearPortraits() { faceCache.clear(); }
  const wedded = (p) => Sim.spouseOf(st, p.id) !== null || (p.sex === 'f' && st.unions.some((u) => u.a === p.id || u.b === p.id));
  const rgb = (c, f = 1) => `rgb(${c.map((v) => Math.min(255, Math.round(v * f))).join(',')})`;
  // A grey part multiplied by a colour, as a sprite's tint does on the map.
  function tinted(part, colour) {
    if (!colour) return part;
    const c = makeCanvas(part.width, part.height), g = c.getContext('2d');
    g.drawImage(part, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = colour; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(part, 0, 0);
    return c;
  }
  // Positions, anchors and order follow makeRig (page/rigs); the origin is the rig's hip, y grows downward.
  function drawFace(p, married, winter) {
    if (!faceParts) faceParts = partCanvases(FACE);
    const look = lookOf(p), c = makeCanvas(BUST * FACE, BUST * FACE), g = c.getContext('2d'), k = 0.6 + 0.4 * sizeAt(p.age);
    g.scale(FACE, FACE); g.translate(BUST / 2, BUST); g.scale(k, k); g.translate(-1, 16); // a child's bust is smaller, standing on the same edge
    const put = (name, colour, x, y, ax = 0.5, ay = 0, sx = 1, rot = 0) => {
      const part = faceParts[name], pw = part.width / FACE, ph = part.height / FACE;
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, 1); g.drawImage(tinted(part, colour), -ax * pw, -ay * ph, pw, ph); g.restore();
    };
    const cloth = rgb(look.cloth), hx = 1, hy = -27;
    put('sleeve', rgb(look.cloth, 0.74), -3, -24);
    if (p.sex === 'f') { put('dress', cloth, 0, -27); put('apron', rgb(LINEN, 0.97), 5.5, -14); put('belt', null, 0.5, -15, 0.5, 0, 0.78); }
    else { put('tunic', cloth, 0, -27); put('belt', null, 0, -11); }
    if (p.sex === 'f' && !married) put('braid', rgb(look.hair, 0.9), hx - 9, hy - 16);
    put('head', rgb(look.skin), hx, hy, 0.46, 1);
    if (p.sex === 'm') {
      if (look.beard) put('beard', rgb(look.hair, 0.95), hx + 3, hy - 9);
      if (look.hood || winter) put('hood', rgb(look.hoodCol), hx, hy + 7, 0.47, 1);
      else put('hair', rgb(look.hair), hx, hy - 2.5, 0.46, 1);
    } else if (married) put('headcloth', rgb(LINEN), hx, hy + 5, 0.46, 1);
    else { put('hair', rgb(look.hair), hx, hy - 2.5, 0.46, 1); put('band', null, hx, hy - 19, 0.5, 0.5, 1, -0.15); }
    put('sleeve', cloth, 3, -24);
    return c.toDataURL('image/png');
  }
  // A pawn's portrait: redrawn only when what it wears or its size changes, looked at once a game day.
  function faceOf(id) {
    const p = st.pawns[id], day = Math.floor(st.t / Sim.DAY);
    let e = faceCache.get(id);
    if (e && e.day === day) return e.url;
    const married = wedded(p), winter = Sim.cal(st.t).season === 3, sig = `${married}|${winter}|${sizeAt(p.age)}`;
    if (!e || e.sig !== sig) {
      if (faceCache.size >= FACE_CAP) faceCache.clear();
      let url = '';
      try { url = drawFace(p, married, winter); } catch (err) { /* no canvas here: the panels do without portraits */ }
      e = { sig, url }; faceCache.set(id, e);
    }
    e.day = day;
    return e.url;
  }
  const faceImg = (id, cls = 'face') => {
    const url = faceOf(id); return url ? `<img class="${cls}${st.pawns[id].died !== null ? ' gone' : ''}" src="${url}" alt="">` : ''; };
  function icon(key, draw) {
    if (!iconCache.has(key)) {
      let url = '';
      try { const c = makeCanvas(120, 120); draw(c.getContext('2d')); url = c.toDataURL('image/png'); } catch (err) { /* as for portraits */ }
      iconCache.set(key, url);
    }
    return iconCache.get(key);
  }
  // A farm by its cottage (one of three, as on the map), its settlers' booth while the cottage is built, or the low walls of a ruin.
  function farmIcon(f) {
    if (f.booth) return icon('booth', (g) => {
      g.translate(60, 70); g.scale(4.4, 4.4); g.translate(-15, -1);
      g.fillStyle = '#6b5135'; g.strokeStyle = '#3e2c1c'; g.lineWidth = 1; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(6, 8); g.lineTo(15, -6); g.lineTo(24, 8); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#4a3524'; g.lineWidth = 1.2;
      for (const dx of [-3, 0, 3]) { g.beginPath(); g.moveTo(15 + dx, -6); g.lineTo(15 + dx * 2.6, -10); g.stroke(); }
      g.fillStyle = '#2a1e14'; g.fillRect(13, 2, 4, 6);
    });
    const v = f.id % 3, ruin = f.state === 'ruin';
    return icon(`stuga${v}${ruin ? 'r' : ''}`, (g) => {
      const b = stugaCanvas(v);
      if (ruin) g.drawImage(b, 8, 100 - b.height * 0.55, b.width, b.height * 0.55); else g.drawImage(b, 8, 100 - b.height);
    });
  }
  // A village by a cluster of its buildings: barn and storehouse behind a cottage, and the well sweep where it has a well.
  function villageIcon(v) {
    return icon(`village${v.well ? 'w' : ''}`, (g) => {
      const at = (b, x, y, s) => g.drawImage(b, x, y - b.height * s, b.width * s, b.height * s);
      at(ladaCanvas(), 2, 70, 0.62); at(harbreCanvas(), 78, 80, 0.62);
      if (v.well) at(wellSweepCanvas(), 52, 74, 0.5);
      at(stugaCanvas(1), 18, 114, 0.72);
    });
  }
  const iconImg = (url, cls = 'badge') => (url ? `<img class="${cls}" src="${url}" alt="">` : '');
