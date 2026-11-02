// @sys page/settlement: building the settlement layer: farms, pawns, labels, booths, fences and herd sprites
  const place = (tex, x, y, ax, ay, layer = L.objects, sc = 0.27) => { const s = new PIXI.Sprite(tex); s.anchor.set(ax, ay); s.scale.set(sc); s.position.set(x, y); s.zIndex = y; layer.addChild(s); return s; };

  function clearSettlement() {
    labelsReady = false;
    // the selection ring is shared across settlements and re-added later, so it must survive the clean-up
    for (const s of [...L.fields.removeChildren(), ...L.fences.removeChildren(), ...L.objects.removeChildren(), ...L.labels.removeChildren()]) if (s !== ring) s.destroy({ children: true });
    fieldSprites = []; rigs = []; houseInfo = []; fences = []; labels = []; selPawn = -1; herdSprites = new Map(); meadowSprites = []; teamDraw = new Map();
  }
  async function buildSettlement(wd, s) {
    clearSettlement();
    st = s;
    if (!st) return;
    if (!art) makeArt(wd.R);
    buildFarms(wd);
    try { await Promise.race([document.fonts.load('italic 700 30px Alegreya'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* the fallback font is fine */ }
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
    const mkLabel = (text, x, y, size) => {
      const t = new PIXI.Text({ text, style: { fontFamily: 'Alegreya, Georgia, serif', fontStyle: 'italic', fontWeight: '700', fontSize: size, fill: 0xfff4e2, stroke: { color: 0x1a2e2a, width: size / 6, join: 'round' } }, resolution: 2 });
      t.anchor.set(0.5, 1); L.labels.addChild(t); labels.push({ t, x, y });
    };
    for (const v of st.villages) {
      if (byName(v)) mkLabel(v.name, wd.hx[v.center], wd.hy[v.center] - wd.R * 1.7, v.green ? 30 : 26);
      else for (const id of v.farmsteads) { const f = st.farmsteads[id]; mkLabel(f.name, wd.hx[f.house], wd.hy[f.house] - wd.R * 1.5, 24); }
    }
  }
  // A settlers' booth (bod) of leaning poles and bark by the house tile, and beside it the cottage by stage, as on a plot: foundation stones,
  // rising log walls, the turf roof; a ring while the work goes on (VB-148).
  function drawBooth(wd, f, empty) {
    const x = wd.hx[f.house], y = wd.hy[f.house], g = new PIXI.Graphics(), n = f.booth.i;
    g.poly([x + 6, y + 8, x + 15, y - 6, x + 24, y + 8]).fill(0x6b5135).stroke({ width: 1, color: 0x3e2c1c });
    for (const dx of [-3, 0, 3]) g.moveTo(x + 15 + dx, y - 6).lineTo(x + 15 + dx * 2.6, y - 10).stroke({ width: 1.2, color: 0x4a3524 });
    g.rect(x + 13, y + 2, 4, 6).fill(0x2a1e14); // the opening
    const cx = x - 8, cy = y + 2;
    if (n >= 1) for (const [dx, dy] of [[-9, 3], [-3, 6], [4, 6], [10, 3], [-9, -3], [10, -3]]) g.ellipse(cx + dx, cy + dy, 3, 2).fill(0x8b8a84);
    if (n >= 2) g.rect(cx - 9, cy - 7, 19, 12).fill(0x7a5a38).stroke({ width: 1, color: 0x4a3524 });
    if (!empty) g.ellipse(cx, cy + 2, 16, 9).stroke({ width: 1.5, color: 0xf2e6c4, alpha: 0.7 });
    if (empty) g.alpha = 0.55;
    g.zIndex = y + 8; L.objects.addChild(g);
  }
  // Farms and pawns; rebuilt whenever households change (a death, a marriage, a farm left empty).
  function buildFarms(wd) {
    for (const s2 of [...L.fields.removeChildren(), ...L.fences.removeChildren(), ...L.objects.removeChildren()]) if (s2 !== ring) s2.destroy({ children: true });
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
      const yard = place(art.yard, hx, hy + 2, 0.5, 0.5, L.fields); if (empty) yard.alpha = ruin ? 0.2 : 0.35;
      const v = f.id % 3;
      // an empty farm greys; a ruin keeps only the cottage's lower walls (proper decay art comes with claims)
      const tint = empty ? (ruin ? 0x6e6a66 : 0x8e8a86) : 0xffffff;
      if (f.booth) drawBooth(wd, f, empty);
      else {
        const lada = place(art.lada, hx - 3, hy - 13, 0.5, 0.93), harbre = place(art.harbre, hx + 16, hy - 1, 0.5, 0.95), stuga = place(art.stuga[v], hx - 7, hy + 10, 0.5, 0.92);
        for (const b of [lada, harbre, stuga]) { b.tint = tint; if (empty && !ruin) b.alpha = 0.9; }
        if (ruin) { lada.visible = harbre.visible = false; stuga.scale.y = 0.27 * 0.55; stuga.alpha = 0.85; }
      }
      const wood = place(art.wood[0], hx + 13, hy + 16, 0.5, 0.9); wood.visible = !empty;
      const herds = !empty && st.households[f.household].herds.length > 0;
      if (herds) place(art.byre, hx - 25, hy + 2, 0.5, 0.92);
      const stack = herds || (!empty && st.households[f.household].hay > 0) ? place(art.haystack[0], hx - 36, hy + 12, 0.5, 0.93) : null;
      const heap = herds ? place(art.manure[0], hx - 21, hy + 14, 0.5, 0.88) : null; // the dung heap by the byre door (VB-137)
      if (!st.villages[f.village].well) place(art.curb, hx + 3, hy + 3, 0.5, 0.85);
      if (!empty) {
        const puffs = [];
        for (let k = 0; k < 6; k++) { const p = new PIXI.Sprite(art.puff); p.anchor.set(0.5); p.zIndex = 1e6; L.objects.addChild(p); puffs.push(p); }
        // smoke from the cottage's smoke hole, or from the booth's fire while the cottage is built
        houseInfo.push({ f, puffs, wood, stack, heap, cx: f.booth ? hx + 15 : hx - 7 + (67 - 52) * 0.27, cy: f.booth ? hy - 2 : hy + 10 + (9 - 73.6) * 0.27 });
      }
      if (f.fence) for (const s2 of f.fence) addFence(s2);
    }
    for (const v of st.villages) {
      if (v.well) place(art.sweep, wd.hx[v.center] + 1, wd.hy[v.center] + 10, 0.44, 0.95);
      for (const s2 of v.fence) addFence(s2);
      for (const plot of v.plots.filter((q) => !q.built)) for (const tr of plot.tiles) {
        // stumps while the wood is felled but not grubbed out, turned soil once the ground is broken, a ring while the work goes on
        const g = new PIXI.Graphics(), x = wd.hx[tr.tile], y = wd.hy[tr.tile], step = tr.steps[tr.i];
        if (step === 'grub') for (const [dx, dy] of [[-7, 2], [0, -5], [6, 4], [-2, 8]]) g.ellipse(x + dx, y + dy, 2.2, 2.2).fill(0x5a4128);
        if (tr.kind === 'field' && tr.i >= tr.steps.length) g.ellipse(x, y + 2, 14, 8).fill({ color: 0x6b4a2e, alpha: 0.85 });
        if (tr.kind === 'house' && plot.cottage) { // the cottage by stage: foundation stones, rising log walls, then the turf roof
          const n = plot.cottage.i;
          if (n >= 1) for (const [dx, dy] of [[-9, 3], [-3, 6], [4, 6], [10, 3], [-9, -3], [10, -3]]) g.ellipse(x + dx, y + dy, 3, 2).fill(0x8b8a84);
          if (n >= 2) g.rect(x - 9, y - 7, 19, 12).fill(0x7a5a38).stroke({ width: 1, color: 0x4a3524 });
          if (n >= 3) g.poly([x - 11, y - 6, x, y - 17, x + 12, y - 6]).fill(0x5f7a3a);
        }
        if (!plot.done || (plot.cottage && !plot.built)) g.ellipse(x, y + 2, 16, 9).stroke({ width: 1.5, color: 0xf2e6c4, alpha: 0.7 });
        L.fences.addChild(g);
      }
    }
    if (labelsReady && labelSigOf() !== labelSig) buildLabels(wd);
    for (const p of st.pawns) {
      const married = Sim.spouseOf(st, p.id) !== null || (p.sex === 'f' && st.unions.some((u) => u.a === p.id || u.b === p.id));
      const R = makeRig(p, married); R.root.visible = false;
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
  // Herds by the farm (VB-131): in the grazing season, from 6:00 to 20:00, each herd's animals graze around its home tile, wandering slowly and
  // now and then looking up; inside the byre otherwise. Sprites are made per herd and remade only when its animals change.
  const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
  const SHEEP_TINT = [0xffffff, 0xece6da, 0xbab2a6, 0x8c7c6a, 0x5c5248];
  const COW_SCALE = { cow: 0.25, bull: 0.29, ox: 0.29, heifer: 0.22, steer: 0.23, calf: 0.16 };
  function herdAnimals(hd) {
    const out = [];
    if (hd.head) for (const h of hd.head) out.push({ id: h.id, key: h.id * 2 + 1, cow: hash(h.id * 7 + 3) * COATS.length | 0, sc: COW_SCALE[h.kind] });
    else {
      const all = hd.ewes + hd.rams + hd.lambs, n = Math.min(10, all), lambs = all ? Math.round((n * hd.lambs) / all) : 0;
      for (let k = 0; k < n; k++) out.push({ key: hd.id * 1000 + k * 2, tint: SHEEP_TINT[(hash(hd.id * 31 + k) * SHEEP_TINT.length) | 0], sc: k < n - lambs ? 0.25 : 0.17 });
    }
    return out;
  }
