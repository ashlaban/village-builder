// @sys gen/paths: how worn paths look: a trail through each worn tile towards its worn neighbours, painted into the map chunks
// ===== Worn paths on the map (VB-094). The simulation counts and fades the wear (sim/paths); this module only reads w.worn. =====
// Listed before gen/rivers.js and gen.js: the chunk bake keeps trees and stones off paths and lanes through `thin`.
VB['gen/paths'] = (() => {
  // By stage (0 none, 1 trodden ground, 2 path, 3 lane): the trail's width in map units, the colours of its worn edge and bare core,
  // and the coarsest level of detail (ArchGen.LV index) that still shows it: trodden only up close, lanes on the overview too.
  const LOOK = {
    width: [0, 5, 8, 12],
    edge: [null, 'rgba(150,150,96,0.28)', 'rgba(150,140,92,0.4)', 'rgba(146,130,88,0.5)'],
    core: [null, 'rgba(184,172,124,0.3)', 'rgba(192,170,122,0.62)', 'rgba(198,174,126,0.82)'],
    level: [-1, 0, 1, 2],
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
  // The trail of tile i as half-segments [x0, y0, x1, y1, width, stage]: from its bend to the joint with each neighbour it leads to,
  // halfway to that neighbour's bend (its centre if it draws no trail). Both halves of a joint have the same width, the mean of the two
  // tiles' widths, so trails of different stages meet smoothly. A lone worn tile is a patch at its bend.
  function segments(w, i) {
    if (!trail(w, i)) return [];
    const s = w.worn[i], [bx, by] = bend(w, i), out = [];
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (!leadsTo(w, j)) continue;
      const t = trail(w, j), [jx, jy] = t ? bend(w, j) : [w.hx[j], w.hy[j]], wd = t ? (LOOK.width[s] + LOOK.width[w.worn[j]]) / 2 : LOOK.width[s];
      out.push([bx, by, (bx + jx) / 2, (by + jy) / 2, wd, t ? Math.min(s, w.worn[j]) : s]);
    }
    if (!out.length) out.push([bx, by, bx + 0.01, by, LOOK.width[s], s]);
    return out;
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
      if (w.worn[i] && LOOK.level[w.worn[i]] >= l) for (const g of segments(w, i)) if (LOOK.level[g[5]] >= l) segs.push(g);
    }
    if (!segs.length) return;
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    ctx.globalCompositeOperation = 'source-atop'; // only on land already painted
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const minW = 1.2 / sc; // at least a texel or so wide on the coarser levels
    for (const [layer, k] of [['edge', 1.6], ['core', 1]]) for (let s = 1; s <= 3; s++) {
      ctx.strokeStyle = LOOK[layer][s];
      for (const g of segs) {
        if (g[5] !== s) continue;
        ctx.lineWidth = Math.max(minW, g[4] * k);
        ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); ctx.stroke();
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
        for (const g of cache.get(i)) if (g[5] >= 2 && dist2(x, y, g[0], g[1], g[2], g[3]) < (g[4] / 2 + 3) ** 2) return true;
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
