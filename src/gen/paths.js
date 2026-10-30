// @sys gen/paths: how worn paths look: a trail through each worn tile towards its worn neighbours, painted into the map chunks
// ===== Worn paths on the map (VB-094). The simulation counts and fades the wear (sim/paths); this module only reads w.worn. =====
// Listed before gen/rivers.js and gen.js: the chunk bake keeps trees and stones off paths and lanes through `thin`.
VB['gen/paths'] = (() => {
  // By stage (0 none, 1 trodden ground, 2 path, 3 lane): the trail's width in map units, the colours of its flattened edge and bare core,
  // and the coarsest level of detail (ArchGen.LV index) that still shows it: trodden ground only up close, paths and lanes at the middle
  // level too. The overview shows none, so a path that changes stage never repaints it (a full overview chunk takes about 60 ms).
  const LOOK = {
    width: [0, 5, 7, 10],
    edge: [null, 'rgba(124,128,70,0.22)', 'rgba(122,112,70,0.34)', 'rgba(114,98,62,0.46)'],
    core: [null, 'rgba(176,164,110,0.34)', 'rgba(170,146,100,0.72)', 'rgba(166,138,94,0.88)'],
    level: [-1, 0, 1, 1],
  };
  // Where the trail bends in tile i: a fixed offset by tile, up to 0.22 R from the centre, so trails wander a little.
  function bend(w, i) {
    const h = Math.imul(i ^ 0x2c1b3c6d, 2246822519) >>> 0, a = ((h & 1023) / 1024) * 2 * Math.PI, d = (((h >>> 10) & 1023) / 1024) * 0.22 * w.R;
    return [w.hx[i] + Math.cos(a) * d, w.hy[i] + Math.sin(a) * d];
  }
  // A worn tile that draws its own trail: worn land that is not a house, field, green or river.
  const trail = (w, i) => i >= 0 && w.worn[i] > 0 && !w.dev[i] && !w.water[i] && !w.river[i];
  // What a trail runs on to: another trail, a worn ford, or a house, field or green (the end of the way, drawn by the settlement layer).
  const leadsTo = (w, j) => j >= 0 && !w.water[j] && (trail(w, j) || (w.river[j] ? w.crossing[j] > 0 && w.worn[j] > 0 : w.dev[j] === 1));
  // The trail of tile i as curves [x0, y0, cx, cy, x1, y1, width, stage] (quadratic, cx, cy the control point). Each way out of the tile
  // ends at its joint with the neighbour it leads to, halfway to that neighbour's bend (its centre if it draws no trail). A tile with two
  // ways out runs one smooth curve from joint to joint, bent towards its own bend, so a trail through many tiles flows; a lone end or a
  // fork runs straight from the bend to each joint. Both sides of a joint have the same width, the mean of the two tiles' widths.
  function segments(w, i) {
    if (!trail(w, i)) return [];
    const s = w.worn[i], [bx, by] = bend(w, i), ends = [];
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (!leadsTo(w, j)) continue;
      const t = trail(w, j), [jx, jy] = t ? bend(w, j) : [w.hx[j], w.hy[j]], wd = t ? (LOOK.width[s] + LOOK.width[w.worn[j]]) / 2 : LOOK.width[s];
      ends.push([(bx + jx) / 2, (by + jy) / 2, wd, t ? Math.min(s, w.worn[j]) : s]);
    }
    if (!ends.length) return [[bx, by, bx, by, bx + 0.01, by, LOOK.width[s], s]];
    if (ends.length !== 2) return ends.map(([x, y, wd, st]) => [bx, by, (bx + x) / 2, (by + y) / 2, x, y, wd, st]);
    // the curve from joint a through the bend to joint b, split at its middle m so each half keeps the width of its own joint
    const [a, b] = ends, mx = (a[0] + 2 * bx + b[0]) / 4, my = (a[1] + 2 * by + b[1]) / 4;
    return [[a[0], a[1], (a[0] + bx) / 2, (a[1] + by) / 2, mx, my, a[2], a[3]], [mx, my, (bx + b[0]) / 2, (by + b[1]) / 2, b[0], b[1], b[2], b[3]]];
  }
  // Paints the trails of one chunk onto ctx, over the rivers and under the decorations. lv: ArchGen.LV[level]; l: the level.
  function drawChunk(w, ctx, lv, cx, cy, l) {
    if (!w.worn) return;
    const { R, HW, AP, COLS, ROWS } = w, sc = lv.scale, x0 = cx * lv.size, y0 = cy * lv.size, x1 = x0 + lv.size, y1 = y0 + lv.size, M = R;
    const r0 = Math.max(0, Math.floor((y0 - M - R) / (1.5 * R))), r1 = Math.min(ROWS - 1, Math.ceil((y1 + M - R) / (1.5 * R)));
    const c0 = Math.max(0, Math.floor((x0 - M - AP) / HW)), c1 = Math.min(COLS - 1, Math.ceil((x1 + M - AP) / HW));
    const segs = [];
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const i = row * COLS + col;
      if (w.worn[i] && LOOK.level[w.worn[i]] >= l) for (const g of segments(w, i)) if (LOOK.level[g[7]] >= l) segs.push(g);
    }
    if (!segs.length) return;
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    ctx.globalCompositeOperation = 'source-atop'; // only on land already painted
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const minW = 1.2 / sc; // at least a texel or so wide on the coarser levels
    for (const [layer, k] of [['edge', 1.6], ['core', 1]]) for (let s = 1; s <= 3; s++) {
      ctx.strokeStyle = LOOK[layer][s];
      for (const g of segs) {
        if (g[7] !== s) continue;
        ctx.lineWidth = Math.max(minW, g[6] * k);
        ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.quadraticCurveTo(g[2], g[3], g[4], g[5]); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // Squared distance from (x, y) to the segment (ax, ay)-(bx, by).
  function dist2(x, y, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    const px = ax + t * dx - x, py = ay + t * dy - y;
    return px * px + py * py;
  }
  // Drops, in place, the decoration items ({t, x, y, ...}) that stand on a path or lane (a tree by its foot), and returns the array.
  // Trodden ground keeps its grass, flowers and stones. loc: ArchGen.hexLocator(w).
  function thin(w, items, loc) {
    if (!w.worn) return items;
    const o = [0, 0], cache = new Map(), on = (x, y) => {
      const t = loc(x, y, o);
      if (t < 0) return false;
      for (let k = -1; k < 6; k++) {
        const i = k < 0 ? t : w.nb[t * 6 + k];
        if (i < 0 || w.worn[i] < 2) continue;
        if (!cache.has(i)) cache.set(i, segments(w, i));
        for (const g of cache.get(i)) {
          if (g[7] < 2) continue;
          const qx = (g[0] + 2 * g[2] + g[4]) / 4, qy = (g[1] + 2 * g[3] + g[5]) / 4, r2 = (g[6] / 2 + 3) ** 2; // the curve's middle point
          if (dist2(x, y, g[0], g[1], qx, qy) < r2 || dist2(x, y, qx, qy, g[4], g[5]) < r2) return true;
        }
      }
      return false;
    };
    let n = 0;
    for (const it of items) if (!on(it.x, it.y)) items[n++] = it;
    items.length = n;
    return items;
  }
  return { LOOK, bend, segments, drawChunk, thin };
})();
