// @sys gen/rivers: rivers traced over the generated terrain, from hills, mountains and marsh through lakes to the sea, and drawn on the map
// ===== Rivers: drainage by priority flood, catchment, sources per island, courses to the sea; their curves on the map =====
// Listed before gen.js, which calls trace; it reads no other module, so gen.js passes in the arrays, a random source and the biome codes.
VB['gen/rivers'] = (() => {
  // perTiles: land tiles of an island per river source (rounded); fromWater: least steps from a source to any water;
  // spacing: least steps between two sources; own: least land tiles a new river runs before it meets water or another river;
  // longEnough: a course of this many land tiles counts as long, so beyond it the noise (up to `noise`) spreads sources over the island.
  const RIVERS = { perTiles: 700, fromWater: 3, spacing: 10, own: 3, longEnough: 15, noise: 10 };

  // A binary min-heap of tile indexes by key[i], ties broken by the lower index, so the order is the same on every run.
  function minHeap(key) {
    const a = [];
    const less = (i, j) => key[i] < key[j] || (key[i] === key[j] && i < j);
    return {
      get size() { return a.length; },
      push(i) {
        let c = a.push(i) - 1;
        while (c > 0) { const p = (c - 1) >> 1; if (!less(a[c], a[p])) break; [a[c], a[p]] = [a[p], a[c]]; c = p; }
      },
      pop() {
        const top = a[0], last = a.pop();
        if (a.length) {
          a[0] = last;
          for (let c = 0; ;) {
            const l = 2 * c + 1, r = l + 1;
            let m = c;
            if (l < a.length && less(a[l], a[m])) m = l;
            if (r < a.length && less(a[r], a[m])) m = r;
            if (m === c) break;
            [a[c], a[m]] = [a[m], a[c]]; c = m;
          }
        }
        return top;
      },
    };
  }

  // Every land and lake tile drains to one neighbour (down) on a path to the sea that never climbs above its spill level: a priority flood
  // from the sea (Barnes, Lehman and Mulla 2014), with a tiny rise per step so flats and lakes drain toward their outlet.
  // order lists the tiles as the flood reached them, so a tile always comes after the tile it drains to.
  function drainage({ N, nb, he, ocean }) {
    const fill = new Float64Array(N), down = new Int32Array(N).fill(-1), seen = new Uint8Array(N), order = [], h = minHeap(fill);
    for (let i = 0; i < N; i++) {
      if (!ocean[i]) continue;
      seen[i] = 1; fill[i] = he[i];
      for (let k = 0; k < 6; k++) { const j = nb[i * 6 + k]; if (j >= 0 && !ocean[j]) { h.push(i); break; } }
    }
    while (h.size) {
      const i = h.pop();
      for (let k = 0; k < 6; k++) {
        const j = nb[i * 6 + k];
        if (j < 0 || seen[j]) continue;
        seen[j] = 1; fill[j] = Math.max(he[j], fill[i] + 1e-7); down[j] = i; order.push(j); h.push(j);
      }
    }
    return { down, order };
  }

  // Tiles within r steps of `from` (any terrain), by breadth-first search; calls f(tile) for each.
  function around(nb, from, r, f) {
    const q = [from], d = new Map([[from, 0]]);
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; f(i);
      if (d.get(i) >= r) continue;
      for (let k = 0; k < 6; k++) { const j = nb[i * 6 + k]; if (j >= 0 && !d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } }
    }
  }

  // The rivers of a world. t: {N, nb, he, hm, water, ocean, biome} as made by ArchGen.generate; rand: a seeded source of numbers in [0, 1);
  // sources: biome codes rivers rise in. Returns {river, riverTo}.
  function trace(t, rand, sources) {
    const { N, nb, hm, water, ocean, biome } = t;
    const { down, order } = drainage(t);
    // catchment: each tile's own rain (land 0.5 + moisture, lakes 1) plus all that drains through it
    const acc = new Float64Array(N);
    for (const i of order) acc[i] = water[i] ? 1 : 0.5 + hm[i];
    for (let k = order.length - 1; k >= 0; k--) { const i = order[k], d = down[i]; if (!ocean[d]) acc[d] += acc[i]; }
    // course length: land tiles from a tile to the sea
    const len = new Int32Array(N);
    for (const i of order) len[i] = (water[i] ? 0 : 1) + (ocean[down[i]] ? 0 : len[down[i]]);
    // steps to the nearest water, and islands (land joined through land neighbours) with their sizes
    const wet = new Int32Array(N).fill(-1), q = [];
    for (let i = 0; i < N; i++) if (water[i]) { wet[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) for (let k = 0; k < 6; k++) {
      const j = nb[q[h] * 6 + k]; if (j >= 0 && wet[j] < 0) { wet[j] = wet[q[h]] + 1; q.push(j); }
    }
    const island = new Int32Array(N).fill(-1), left = [];
    for (let s = 0; s < N; s++) {
      if (water[s] || island[s] >= 0) continue;
      const c = left.length, iq = [s]; island[s] = c;
      for (let h = 0; h < iq.length; h++) for (let k = 0; k < 6; k++) {
        const j = nb[iq[h] * 6 + k]; if (j >= 0 && !water[j] && island[j] < 0) { island[j] = c; iq.push(j); }
      }
      left.push(Math.round(iq.length / RIVERS.perTiles));
    }
    // sources: long courses first, with noise so they spread over the island instead of crowding the one longest drainage
    const cand = [], score = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (water[i] || !sources.includes(biome[i]) || wet[i] < RIVERS.fromWater) continue;
      score[i] = Math.min(len[i], RIVERS.longEnough) + RIVERS.noise * rand(); cand.push(i);
    }
    cand.sort((a, b) => score[b] - score[a] || a - b);
    const river = new Uint16Array(N), riverTo = new Int32Array(N).fill(-1), blocked = new Uint8Array(N);
    for (const s of cand) {
      if (left[island[s]] <= 0 || blocked[s] || riverTo[s] >= 0) continue;
      let own = 0;
      for (let i = s; !ocean[i] && riverTo[i] < 0; i = down[i]) if (!water[i]) own++;
      if (own < RIVERS.own) continue;
      for (let i = s; !ocean[i] && riverTo[i] < 0; i = down[i]) {
        riverTo[i] = down[i];
        if (!water[i]) river[i] = Math.min(65535, Math.max(1, Math.round(acc[i])));
      }
      left[island[s]]--;
      around(nb, s, RIVERS.spacing - 1, (j) => { blocked[j] = 1; });
    }
    // @state w.river: Uint16Array per tile; catchment of a land tile a river runs through (tiles, weighted by moisture), 0 elsewhere
    // @state w.riverTo: Int32Array per tile; next tile down a river's course (river tile, lake on the course, or sea), -1 off every course
    return { river, riverTo };
  }

  // ---- drawing: a curve per river tile, from the edge it enters by, bending near the centre, to the edge it leaves by ----
  // Width of the river through tile i, in map units: a brook at its source, at most three quarters of a hex wide.
  const width = (w, i) => Math.min(0.75 * w.HW, 2.5 + 0.9 * Math.sqrt(w.river[i]));
  // What the tile card calls the water through tile i, or null.
  const kind = (w, i) => (!w.river[i] ? null : width(w, i) < 8 ? 'Brook' : width(w, i) < 16 ? 'Stream' : 'River');
  // Where the river bends in tile i: near the centre on land (a fixed offset by tile, up to 0.2 R), the centre on water.
  function bend(w, i) {
    if (w.water[i]) return [w.hx[i], w.hy[i]];
    const h = Math.imul(i ^ 0x5bd1e995, 2654435761) >>> 0, a = ((h & 1023) / 1024) * 2 * Math.PI, d = (((h >>> 10) & 1023) / 1024) * 0.2 * w.R;
    return [w.hx[i] + Math.cos(a) * d, w.hy[i] + Math.sin(a) * d];
  }
  // The pieces of river in land tile i, each [from, bend, to]: one per course coming in (from the joint with the tile upstream),
  // or one from the bend itself at a source. Joints sit halfway between two bends, so neighbouring pieces meet with one tangent.
  function pieces(w, i) {
    if (!w.river[i] || w.water[i]) return [];
    const b = bend(w, i), joint = (j) => { const c = bend(w, j); return [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]; };
    const out = joint(w.riverTo[i]), res = [];
    for (let k = 0; k < 6; k++) { const j = w.nb[i * 6 + k]; if (j >= 0 && w.riverTo[j] === i) res.push([joint(j), b, out]); }
    if (!res.length) res.push([b, b, out]);
    return res;
  }
  // Paints the rivers of one map chunk onto ctx, over the baked land and under the decorations. lv: ArchGen.LV[level]; full: level 0.
  function drawChunk(w, ctx, lv, cx, cy, full) {
    const { R, HW, AP, COLS, ROWS } = w, sc = lv.scale, x0 = cx * lv.size, y0 = cy * lv.size, x1 = x0 + lv.size, y1 = y0 + lv.size, M = 2 * R;
    const r0 = Math.max(0, Math.floor((y0 - M - R) / (1.5 * R))), r1 = Math.min(ROWS - 1, Math.ceil((y1 + M - R) / (1.5 * R)));
    const c0 = Math.max(0, Math.floor((x0 - M - AP) / HW)), c1 = Math.min(COLS - 1, Math.ceil((x1 + M - AP) / HW));
    const ps = [];
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const i = row * COLS + col;
      for (const p of pieces(w, i)) ps.push([p, width(w, i)]);
    }
    if (!ps.length) return;
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const minW = (full ? 0.6 : 0.9) / sc; // at least this many texels wide, so brooks still show on the overview
    const pass = (style, wf, add, minWidth) => {
      ctx.strokeStyle = style;
      for (const [[a, b, c], wd] of ps) {
        ctx.lineWidth = Math.max(minWidth, wd * wf + add);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
      }
    };
    pass('rgba(74,86,54,0.5)', 1, 3, minW * 1.6); // wet, darker banks
    pass('rgb(80,142,156)', 1, 0, minW);
    if (sc >= 1 / 3) pass('rgba(186,222,226,0.3)', 0.3, 0, 0); // a light streak down the middle
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Squared distance from point (x, y) to the segment a-b.
  function dist2(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0, px = a[0] + t * dx - x, py = a[1] + t * dy - y;
    return px * px + py * py;
  }
  // Drops the decoration items ({x, y, ...}) that stand in a river, in place, and returns the array. loc: ArchGen.hexLocator(w).
  function thin(w, items, loc) {
    const o = [0, 0], near = (x, y) => {
      const t = loc(x, y, o);
      if (t < 0) return false;
      for (let k = -1; k < 6; k++) {
        const i = k < 0 ? t : w.nb[t * 6 + k];
        if (i < 0 || !w.river[i]) continue;
        const r = width(w, i) / 2 + 4;
        for (const [a, b, c] of pieces(w, i)) if (dist2(x, y, a, b) < r * r || dist2(x, y, b, c) < r * r) return true;
      }
      return false;
    };
    let n = 0;
    for (const it of items) if (!near(it.x, it.y)) items[n++] = it;
    items.length = n;
    return items;
  }

  return { RIVERS, trace, width, kind, pieces, drawChunk, thin };
})();
