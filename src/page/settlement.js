// @sys page/settlement: building the settlement layer: farms, pawns, labels, booths, fences and herd sprites
  // World units per art unit, and where a farm's buildings stand from the centre of its house tile: [x, y of the foot]. The yard is one
  // hex, so the byre and the barn stand at the back, the storehouse and the cottage before them, and the piles in the corners left.
  const ART_S = 0.2;
  const YARD = { byre: [-10, -3], lada: [6, -1], harbre: [14, 7], stuga: [-4, 14], wood: [10, 15], stack: [-14.5, 10.5], heap: [-17.5, -1], curb: [1, 19],
    booth: [10, 6] };
  const INK = 0x2c201c; // the contour of what is drawn straight onto the map, as MP.line of the farm art
  const place = (tex, x, y, ax, ay, layer = L.objects, sc = ART_S) => {
    const s = new PIXI.Sprite(tex); s.anchor.set(ax, ay); s.scale.set(sc); s.position.set(x, y); s.zIndex = y; layer.addChild(s); return s; };

  function clearSettlement() {
    labelsReady = false;
    // the selection ring is shared across settlements and re-added later, so it must survive the clean-up
    for (const s of [...L.fields.removeChildren(), ...L.fences.removeChildren(), ...L.objects.removeChildren(),
      ...L.labels.removeChildren()]) if (s !== ring) s.destroy({ children: true });
    selPawn = -1; selVillage = -1; selFarm = -1; clearPortraits();
    fieldSprites = []; rigs = []; houseInfo = []; fences = []; labels = []; herdSprites = new Map(); meadowSprites = []; teamDraw = new Map();
  }
  async function buildSettlement(wd, s) {
    clearSettlement();
    st = s;
    if (!st) return;
    if (!art) makeArt(wd.R);
    buildFarms(wd);
    try { await Promise.race([document.fonts.load('italic 700 30px Alegreya'), new Promise((r) => setTimeout(r, 1500))]);
      } catch (e) { /* the fallback font is fine */ }
    if (st !== s) return; // another settlement was built while the font loaded
    labelsReady = true; buildLabels(wd);
  }
  // Map labels: a village of two or more farms (or with a green) by its name, at its centre; a lone farm by its farm's name, at the house
  // (a one-farm village bears its farm's name, unique on the island; VB-026). Rebuilt when villages or farm names change (settlers found
  // villages and join them in play; VB-148), once the label font has loaded.
  let labelsReady = false, labelSig = '';
  const byName = (v) => v.green || v.farmsteads.length >= 2;
  const labelSigOf = () => st.villages.map((v) => (byName(v) ? v.name : v.farmsteads.map((id) => st.farmsteads[id].name).join('|'))).join('/');
  function buildLabels(wd) {
    for (const t of L.labels.removeChildren()) t.destroy();
    labels = []; labelSig = labelSigOf();
    const mkLabel = (text, x, y, size, of) => { // `of` names what the label stands for, for a click on it
      const t = new PIXI.Text({
        text, style: { fontFamily: 'Alegreya, Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: size, fill: 0xfff4e2, stroke: {
        color: 0x1a2e2a, width: size / 6, join: 'round' } }, resolution: 2 });
      t.anchor.set(0.5, 1); L.labels.addChild(t); labels.push({ t, x, y, ...of });
    };
    for (const v of st.villages) {
      if (byName(v)) mkLabel(v.name, wd.hx[v.center], wd.hy[v.center] - wd.R * 1.7, v.green ? 30 : 26, { village: v.id });
      else for (const id of v.farmsteads) { const f = st.farmsteads[id]; mkLabel(f.name, wd.hx[f.house], wd.hy[f.house] - wd.R * 1.5, 24, { farm: f.id }); }
    }
  }
  // A cottage in building, by stage: foundation stones, the log walls rising, then the turf roof.
  function cottageStage(g, x, y, n) {
    if (n >= 1) for (const [dx, dy] of [[-8, 3], [-3, 5], [3, 5], [8, 3], [-8, -2], [8, -2]]) g.ellipse(x + dx, y + dy, 2.6, 1.7).fill(0xdad2c2).stroke({
      width: 0.6, color: INK });
    if (n >= 2) for (let k = 0; k < 3; k++) g.roundRect(x - 8.5, y - 5.4 + k * 2.8, 17, 2.8, 1.1).fill(0xdeac58).stroke({ width: 0.6, color: INK });
    if (n >= 3) g.poly([x - 10.5, y - 5, x - 7, y - 12.5, x + 7, y - 12.5, x + 10.5, y - 5]).fill(0x7aa258).stroke({ width: 0.9, color: INK, join: 'round' });
  }
  // A settlers' booth (bod) of leaning poles and bark by the house tile, and beside it the cottage by stage, as on a plot: foundation stones,
  // rising log walls, the turf roof; a ring while the work goes on (VB-148).
  function drawBooth(wd, f, empty) {
    const x = wd.hx[f.house], y = wd.hy[f.house], g = new PIXI.Graphics(), n = f.booth.i, bx = x + YARD.booth[0], by = y + YARD.booth[1];
    for (const dx of [-2.4, 0, 2.4]) g.moveTo(bx + dx, by - 11).lineTo(bx + dx * 2.6, by - 15).stroke({ width: 1.5, color: INK })
      .moveTo(bx + dx, by - 11).lineTo(bx + dx * 2.6, by - 15).stroke({ width: 0.7, color: 0x96462f });
    g.poly([bx - 7.5, by, bx, by - 12, bx + 7.5, by]).fill(0xcc9a58).stroke({ width: 0.9, color: INK, join: 'round' });
    for (const dx of [-3.6, 3.6]) g.moveTo(bx + dx, by - 0.6).lineTo(bx + dx * 0.25, by - 9.5).stroke({ width: 0.5, color: INK, alpha: 0.5 });
    g.poly([bx - 1.9, by, bx - 1.2, by - 5.4, bx + 1.2, by - 5.4, bx + 1.9, by]).fill(0x30241f); // the opening
    cottageStage(g, x + YARD.stuga[0], y + YARD.stuga[1] - 5, n);
    if (!empty) g.ellipse(x, y + 4, 17, 11).stroke({ width: 1.2, color: 0xf6eed8, alpha: 0.7 });
    if (empty) g.alpha = 0.55;
    g.zIndex = y + 8; L.objects.addChild(g);
  }
  // Farms and pawns; rebuilt whenever households change (a death, a marriage, a farm left empty).
  function buildFarms(wd) {
    for (const s2 of [...L.fields.removeChildren(), ...L.fences.removeChildren(), ...L.objects.removeChildren()]) if (s2 !== ring) s2.destroy({
      children: true });
    fieldSprites = []; rigs = []; houseInfo = []; fences = []; herdSprites = new Map(); meadowSprites = []; teamDraw = new Map();
    L.objects.sortableChildren = true;
    for (const f of st.farmsteads) {
      const hx = wd.hx[f.house], hy = wd.hy[f.house], empty = f.household === null, ruin = f.state === 'ruin';
      for (const fd of f.fields) {
        const sp = new PIXI.Sprite(fieldTex[cropStage(fd)] || fieldTex.stubble);
        sp.anchor.set(0.5); sp.scale.set(0.5); sp.rotation = f.rowAngle; sp.position.set(wd.hx[fd.tile], wd.hy[fd.tile]);
        L.fields.addChild(sp);
        const stooks = [], th = f.rowAngle;
        for (let k = 0; k < 9; k++) {
          const u = ((k % 3) - 1) * 12, v = (Math.floor(k / 3) - 1) * 12, jx = Math.sin(k * 7.1) * 2, jy = Math.cos(k * 3.3) * 2;
          const x = wd.hx[fd.tile] + Math.cos(th) * u - Math.sin(th) * v + jx, y = wd.hy[fd.tile] + Math.sin(th) * u + Math.cos(th) * v + jy;
          const sk = place(art.stook[k % 2], x, y + 2, 0.5, 0.9); sk.visible = false; stooks.push(sk);
        }
        fieldSprites.push({ sp, fd, stage: cropStage(fd), stooks });
      }
      for (const m of f.meadows) {
        const sp = new PIXI.Sprite(fieldTex['meadow-' + m.stage]); sp.anchor.set(0.5); sp.scale.set(0.5); sp.position.set(wd.hx[m.tile], wd.hy[m.tile]);
        L.fields.addChild(sp); meadowSprites.push({ sp, m, stage: m.stage });
      }
      const yard = place(art.yard, hx, hy + 1, 0.5, 0.5, L.fields, 0.27); if (empty) yard.alpha = ruin ? 0.2 : 0.35;
      const v = f.id % 3;
      // an empty farm greys; a ruin keeps only the cottage's lower walls (proper decay art comes with claims)
      const tint = empty ? (ruin ? 0x6e6a66 : 0x8e8a86) : 0xffffff;
      if (f.booth) drawBooth(wd, f, empty);
      else {
        const lada = place(art.lada, hx + YARD.lada[0], hy + YARD.lada[1], 0.5, 0.93),
          harbre = place(art.harbre, hx + YARD.harbre[0], hy + YARD.harbre[1], 0.5, 0.95),
          stuga = place(art.stuga[v], hx + YARD.stuga[0], hy + YARD.stuga[1], 0.5, 0.92);
        for (const b of [lada, harbre, stuga]) { b.tint = tint; if (empty && !ruin) b.alpha = 0.9; }
        if (ruin) { lada.visible = harbre.visible = false; stuga.scale.y = ART_S * 0.55; stuga.alpha = 0.85; }
        if (f.grade === 'stone' && !ruin) { // the stone sill a house raised onto a foundation stands on (VB-332)
          const sx = hx + YARD.stuga[0], sy = hy + YARD.stuga[1], sill = new PIXI.Graphics();
          for (let k = 0; k < 7; k++) sill.ellipse(sx - 10.5 + k * 3.5, sy + 0.6 + (k % 2) * 0.3, 2, 1.25);
          sill.fill({ color: empty ? 0x77736e : 0x9a958c }).stroke({ width: 0.35, color: 0x4a463f });
          sill.zIndex = sy + 0.005; L.objects.addChild(sill);
        }
      }
      const wood = place(art.wood[0], hx + YARD.wood[0], hy + YARD.wood[1], 0.5, 0.9); wood.visible = !empty;
      const herds = !empty && st.households[f.household].herds.length > 0;
      if (herds) place(art.byre, hx + YARD.byre[0], hy + YARD.byre[1], 0.5, 0.92);
      const stack = herds || (!empty && st.households[f.household].hay > 0) ? place(art.haystack[0], hx + YARD.stack[0], hy + YARD.stack[1], 0.5, 0.93) : null;
      const heap = herds ? place(art.manure[0], hx + YARD.heap[0], hy + YARD.heap[1], 0.5, 0.88) : null; // the dung heap by the byre (VB-137)
      if (!st.villages[f.village].well) place(art.curb, hx + YARD.curb[0], hy + YARD.curb[1], 0.5, 0.85);
      if (!empty) {
        const puffs = [];
        for (let k = 0; k < 6; k++) { const p = new PIXI.Sprite(art.puff); p.anchor.set(0.5); p.zIndex = 1e6; L.objects.addChild(p); puffs.push(p); }
        // Smoke from the cottage's smoke hole, or from the booth's fire while the cottage is built; and the firelight after dark: the
        // cottage's openings lit over it, and a warm glow on the ground before the door (before the booth, the glow alone).
        const sx = hx + YARD.stuga[0], sy = hy + YARD.stuga[1], at = (q) => [sx + (q[0] - STUGA.w / 2) * ART_S, sy + (q[1] - STUGA.h * 0.92) * ART_S];
        const [cx, cy] = f.booth ? [hx + YARD.booth[0], hy + YARD.booth[1] - 13] : at(STUGA.hole);
        const [gx, gy] = f.booth ? [hx + YARD.booth[0], hy + YARD.booth[1] + 1] : at([48, 62]);
        const lit = f.booth ? null : place(art.lit, sx, sy, 0.5, 0.92); if (lit) { lit.zIndex = sy + 0.01; lit.visible = false; }
        const glow = new PIXI.Sprite(art.glow); glow.anchor.set(0.5); glow.blendMode = 'add'; glow.position.set(gx, gy);
        glow.scale.set(f.booth ? 0.2 : 0.36, f.booth ? 0.13 : 0.23); glow.zIndex = sy + 0.02; glow.visible = false; L.objects.addChild(glow);
        houseInfo.push({ f, puffs, wood, stack, heap, cx, cy, lit, glow, smoke: 0, fire: 0 });
      }
      if (f.fence) for (const s2 of f.fence) addFence(s2);
    }
    for (const v of st.villages) {
      if (v.well) place(art.sweep, wd.hx[v.center] + 1, wd.hy[v.center] + 10, 0.44, 0.95);
      for (const s2 of v.fence) addFence(s2);
      const X = VB['sim/expansion'];
      for (const plot of X.livePlots(st, v)) for (const tr of X.tilesOf(plot)) { // the plots under way: their village's project plans (VB-123)
        // stumps while the wood is felled but not grubbed out, turned soil once the ground is broken, a ring while the work goes on
        const g = new PIXI.Graphics(), x = wd.hx[tr.tile], y = wd.hy[tr.tile], step = tr.steps[tr.i];
        if (step === 'grub') for (const [dx, dy] of [[-7, 2], [0, -5], [6, 4], [-2, 8]]) {
          g.ellipse(x + dx, y + dy, 2.2, 1.7).fill(0xf2deac).stroke({ width: 0.7, color: INK });
            g.ellipse(x + dx, y + dy, 0.9, 0.7).stroke({ width: 0.4, color: 0x96462f }); }
        if (tr.kind === 'field' && tr.i >= tr.steps.length) g.ellipse(x, y + 2, 14, 8).fill({ color: 0x986846, alpha: 0.9 }).stroke({
          width: 0.8, color: INK, alpha: 0.6 });
        if (tr.kind === 'house' && plot.open >= 1) cottageStage(g, x + YARD.stuga[0], y + YARD.stuga[1] - 5, X.cottageAt(plot));
        g.ellipse(x, y + 4, 17, 11).stroke({ width: 1.2, color: 0xf6eed8, alpha: 0.7 });
        L.fences.addChild(g);
      }
    }
    if (labelsReady && labelSigOf() !== labelSig) buildLabels(wd);
    for (const p of st.pawns) {
      const R = makeRig(p, wedded(p)); R.root.visible = false;
      L.objects.addChild(R.root); rigs.push(R);
    }
    L.objects.addChild(ring);
    st.visualDirty = false; st.rigDirty.clear();
  }
  function addFence(s) { const g = new PIXI.Graphics(); drawFence(g, s); L.fences.addChild(g); fences.push({ g, s }); s.dirty = false; }

  function cropStage(fd) {
    if (fd.stage === 'stooks') return 'stubble';
    if (fd.stage === 'fallow' || fd.stage === 'scrub') return fd.stage;
    if (fd.stage !== 'growing') return fd.stage;
    return Math.floor(st.t / Sim.DAY) - fd.sown < 12 ? 'young' : 'growing';
  }
  // Herds by the farm (VB-131): in the grazing season, from 6:00 to 20:00, each herd's animals graze around its home tile, or its pasture when
  // out with a herder (VB-136, page/animate), wandering slowly and now and then looking up; inside the byre otherwise. Sprites are made per
  // herd and remade only when its animals change.
  const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
  const SHEEP_TINT = [0xffffff, 0xece6da, 0xbab2a6, 0x8c7c6a, 0x5c5248];
  const COW_SCALE = { cow: 0.21, bull: 0.245, ox: 0.245, heifer: 0.19, steer: 0.195, calf: 0.135 };
  function herdAnimals(hd) {
    const out = [];
    if (hd.head) for (const h of hd.head) out.push({ id: h.id, key: h.id * 2 + 1, cow: hash(h.id * 7 + 3) * COATS.length | 0, sc: COW_SCALE[h.kind] });
    else {
      const all = hd.ewes + hd.rams + hd.lambs, n = Math.min(10, all), lambs = all ? Math.round((n * hd.lambs) / all) : 0;
      for (let k = 0; k < n;
        k++) out.push({ key: hd.id * 1000 + k * 2, tint: SHEEP_TINT[(hash(hd.id * 31 + k) * SHEEP_TINT.length) | 0], sc: k < n - lambs ? 0.21 : 0.145 });
    }
    return out;
  }
