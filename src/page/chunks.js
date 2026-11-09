// @sys page/chunks: level-of-detail map chunks painted on demand, the hex grid built lazily, and region borders
  // ---- level-of-detail chunks ----
  // Level 2 covers the map in 6 chunks and is always resident; levels 1 and 0 are painted on demand.
  const chunks = new Map();
  let job = null, frameNo = 0, T = 2, pending = 0;
  const ckey = (l, cx, cy) => l * 1e6 + cy * 1000 + cx;
  const nCols = (l) => Math.ceil(w.W / LV[l].size), nRows = (l) => Math.ceil(w.H / LV[l].size);
  function rangeIn(l, r) {
    const s = LV[l].size;
    return [Math.max(0, Math.floor(r[0] / s)), Math.max(0, Math.floor(r[1] / s)), Math.min(nCols(l) - 1, Math.floor(r[2] / s)),
      Math.min(nRows(l) - 1, Math.floor(r[3] / s))];
  }
  const TH0 = 0.63, TH1 = 0.22, HY = 1.06;
  function levelFor(z, cur) {
    let l = z >= TH0 ? 0 : z >= TH1 ? 1 : 2;
    if (cur === 0 && l !== 0 && z >= TH0 / HY) l = 0;
    if (cur === 1 && l === 0 && z < TH0 * HY) l = 1;
    if (cur === 1 && l === 2 && z >= TH1 / HY) l = 1;
    if (cur === 2 && l === 1 && z < TH1 * HY) l = 2;
    return l;
  }
  function* chunkJob(wd, l, cx, cy, canvas) {
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(TEX, TEX);
    yield* G.bakeChunk(wd, l, cx, cy, img);
    ctx.putImageData(img, 0, 0);
    yield 1;
    Rivers.drawChunk(wd, ctx, LV[l], cx, cy, l === 0);
    Paths.drawChunk(wd, ctx, LV[l], cx, cy, l);
    yield 1;
    G.decorateChunk(wd, ctx, l, cx, cy, SPR || (SPR = landSprites()));
  }
  function addChunk(l, cx, cy, canvas) {
    const s = LV[l].size;
    const spr = new PIXI.Sprite(texFrom(canvas, { autoGenerateMipmaps: true, mipmapFilter: 'linear' }));
    spr.position.set(cx * s, cy * s); spr.scale.set(s / TEX); spr.visible = false;
    lodLayer[l].addChild(spr);
    chunks.set(ckey(l, cx, cy), { l, cx, cy, spr, canvas, seen: frameNo });
  }
  function dropChunk(k) {
    const ch = chunks.get(k);
    if (!ch) return;
    ch.spr.destroy({ texture: true, textureSource: true });
    chunks.delete(k);
  }
  // Repaint what the simulation changed on the map: tiles whose tree density stage changed or that turned to meadow.
  // Levels 0 and 1 are dropped and painted again on demand; the always-resident overview (level 2) is only recoloured, in place.
  function refreshTrees() {
    const reach = 36 + 2 * w.R;
    const overChunks = (tile, l) => {
      const [x0, y0, x1, y1] = rangeIn(l, [w.hx[tile] - reach, w.hy[tile] - reach, w.hx[tile] + reach, w.hy[tile] + reach]);
      const out = []; for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
      return out;
    };
    for (const tile of st.treeDirty) for (const l of [0, 1]) for (const [cx, cy] of overChunks(tile, l)) dropChunk(ckey(l, cx, cy));
    for (const tile of st.biomeDirty) {
      for (const [cx, cy] of overChunks(tile, 2)) {
        const ch = chunks.get(ckey(2, cx, cy));
        if (!ch) continue;
        for (const _ of chunkJob(w, 2, cx, cy, ch.canvas));
        ch.spr.texture.source.update();
      }
    }
    st.treeDirty.clear(); st.biomeDirty.clear();
  }
  // Repaint worn paths whose stage changed (sim/paths): the close levels around them are dropped and painted again on demand, within
  // the frame budget; the overview shows no paths.
  function refreshPaths() {
    const reach = 2 * w.R;
    for (const tile of st.pathDirty) for (const l of [0, 1]) {
      const [a, b, c, d] = rangeIn(l, [w.hx[tile] - reach, w.hy[tile] - reach, w.hx[tile] + reach, w.hy[tile] + reach]);
      for (let cy = b; cy <= d; cy++) for (let cx = a; cx <= c; cx++) dropChunk(ckey(l, cx, cy));
    }
    st.pathDirty.clear();
  }
  function wantedList() {
    const out = [], seen = new Set();
    const add = (l, rect, bias) => {
      if (l > 1) return;
      const [a, b, c, d] = rangeIn(l, rect), mx = (rect[0] + rect[2]) / 2, my = (rect[1] + rect[3]) / 2, s = LV[l].size;
      for (let cy = b; cy <= d; cy++) for (let cx = a; cx <= c; cx++) {
        const k = ckey(l, cx, cy);
        if (chunks.has(k) || seen.has(k)) continue;
        seen.add(k);
        out.push({ l, cx, cy, k, d: Math.hypot((cx + 0.5) * s - mx, (cy + 0.5) * s - my) + bias });
      }
    };
    if (intro) {
      // during the opening glide, paint the destination: a few mid-level chunks first as a fallback, then full detail
      if (intro.T === 0) add(1, intro.rect, 0);
      add(intro.T, intro.rect, 1e7);
    }
    else {
      add(T, viewRect(LV[T].size * 0.25), 0);
      // once the close view is done, paint the mid level under it too, so zooming out is instant
      if (T === 0) add(1, viewRect(0), 1e7);
    }
    out.sort((p, q) => p.d - q.d);
    return out;
  }
  function schedule(budget) {
    const want = wantedList();
    pending = want.length + (job ? 1 : 0);
    if (job && !want.some((q) => q.k === job.k) && job.rows < 0.5) job = null; // panned away: drop half-done work
    const t0 = performance.now();
    while (performance.now() - t0 < budget) {
      if (!job) {
        while (want.length && chunks.has(want[0].k)) want.shift();
        const nx = want.shift();
        if (!nx) break;
        const canvas = makeCanvas(TEX, TEX);
        job = { ...nx, canvas, wd: w, rows: 0, gen: chunkJob(w, nx.l, nx.cx, nx.cy, canvas) };
      }
      const r = job.gen.next();
      if (r.done) {
        if (job.wd === w) addChunk(job.l, job.cx, job.cy, job.canvas);
        job = null;
      } else job.rows = r.value;
    }
  }
  function visit(l, cx, cy, view) {
    const ch = chunks.get(ckey(l, cx, cy));
    if (ch) ch.seen = frameNo;
    if (l === T) { if (ch) { ch.spr.visible = true; return true; } return false; }
    const s = LV[l].size;
    const r = [Math.max(view[0], cx * s), Math.max(view[1], cy * s), Math.min(view[2], (cx + 1) * s - 0.01), Math.min(view[3], (cy + 1) * s - 0.01)];
    const [a, b, c, d] = rangeIn(l - 1, r);
    let all = true;
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) if (!visit(l - 1, x, y, view)) all = false;
    if (!all && ch) ch.spr.visible = true;
    return all || !!ch;
  }
  function display() {
    for (const ch of chunks.values()) ch.spr.visible = false;
    const view = viewRect(0), [a, b, c, d] = rangeIn(2, view);
    for (let cy = b; cy <= d; cy++) for (let cx = a; cx <= c; cx++) visit(2, cx, cy, view);
    // keep memory bounded: evict the least recently seen chunks of levels 0 and 1
    for (const l of [0, 1]) {
      const [a2, b2, c2, d2] = rangeIn(l, viewRect(LV[l].size * 0.25));
      const cap = Math.ceil((c2 - a2 + 1) * (d2 - b2 + 1) * 1.6) + 8;
      const list = [...chunks.values()].filter((ch) => ch.l === l);
      if (list.length <= cap) continue;
      list.sort((p, q) => p.seen - q.seen);
      for (let k = 0; k < list.length - cap; k++) if (list[k].seen < frameNo) dropChunk(ckey(l, list[k].cx, list[k].cy));
    }
  }

  // ---- grid, built lazily in pieces of one level-1 chunk each ----
  const gridPieces = new Map();
  function gridPiece(cx, cy) {
    const k = cy * 1000 + cx;
    let g = gridPieces.get(k);
    if (g) return g;
    g = new PIXI.Graphics();
    const s = LV[1].size, R = w.R, vx = [], vy = [];
    for (let j = 0; j < 6; j++) { const a = (Math.PI / 180) * (30 + 60 * j); vx.push(Math.cos(a) * R); vy.push(Math.sin(a) * R); }
    const r0 = Math.max(0, Math.floor((cy * s - R) / (1.5 * R))), r1 = Math.min(w.ROWS - 1, Math.ceil(((cy + 1) * s - R) / (1.5 * R)));
    for (let row = r0; row <= r1; row++) for (let col = 0; col < w.COLS; col++) {
      const i = row * w.COLS + col, x = w.hx[i], y = w.hy[i];
      if (x < cx * s || x >= (cx + 1) * s || y < cy * s || y >= (cy + 1) * s) continue;
      g.moveTo(x + vx[2], y + vy[2]).lineTo(x + vx[3], y + vy[3]).lineTo(x + vx[4], y + vy[4]).lineTo(x + vx[5], y + vy[5]);
    }
    g.stroke({ width: 1, color: 0x0a2830, alpha: 0.22, pixelLine: true });
    L.grid.addChild(g); gridPieces.set(k, g);
    return g;
  }
  let gridOn = true;
  function updateGrid() {
    const a = gridOn ? clamp((w.HW * cam.z - 18) / 22, 0, 1) : 0;
    L.grid.visible = a > 0.01;
    if (!L.grid.visible) return;
    L.grid.alpha = a;
    for (const g of gridPieces.values()) g.visible = false;
    const [a1, b1, c1, d1] = rangeIn(1, viewRect(0));
    for (let cy = b1; cy <= d1; cy++) for (let cx = a1; cx <= c1; cx++) gridPiece(cx, cy).visible = true;
  }

  // ---- region borders: tile edges between different regions, where at least one side is land ----
  function buildRegions(wd) {
    const g = new PIXI.Graphics(), R = wd.R, NA = [0, -60, -120];
    for (let i = 0; i < wd.N; i++) for (let d = 0; d < 3; d++) {
      const j = wd.nb[i * 6 + d];
      if (j < 0 || wd.region[i] === wd.region[j] || (wd.water[i] && wd.water[j])) continue;
      const a0 = ((NA[d] - 30) * Math.PI) / 180, a1 = ((NA[d] + 30) * Math.PI) / 180;
      g.moveTo(wd.hx[i] + Math.cos(a0) * R, wd.hy[i] + Math.sin(a0) * R).lineTo(wd.hx[i] + Math.cos(a1) * R, wd.hy[i] + Math.sin(a1) * R);
    }
    g.stroke({ width: 1, color: 0xfff1d0, alpha: 0.75, pixelLine: true });
    return g;
  }

