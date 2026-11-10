// @sys gen/paths: how worn paths look: a trail through each worn tile towards its worn neighbours, painted into the map chunks
// ===== Worn paths on the map (VB-094). The simulation counts and fades the wear (sim/paths); this module only reads w.worn. =====
// Listed before gen/rivers.js and gen.js: the chunk bake keeps trees and stones off paths and lanes through `thin`.
VB['gen/paths'] = (() => {
  // By stage (0 none, 1 trodden ground, 2 path, 3 lane): the trail's width in map units, and the coarsest level of detail (ArchGen.LV
  // index) that still shows it: trodden ground only up close, paths and lanes at the middle level too. The overview shows none, so a path
  // that changes stage never repaints it (a full overview chunk takes about 60 ms).
  // A trail is painted in layers, widest first, each [times the width, colour by stage]: the verge of dry, flattened grass, the darker
  // rim where the turf breaks, the bare earth, and on paths and lanes a paler middle where the ground is packed hardest.
  const LOOK = {
    width: [0, 4.5, 6.5, 9.5],
    level: [-1, 0, 1, 1],
    layers: [
      [2.3, [null, 'rgba(150,146,78,0.16)', 'rgba(150,140,78,0.22)', 'rgba(146,132,76,0.28)']],
      [1.35, [null, 'rgba(98,92,52,0.20)', 'rgba(92,78,46,0.38)', 'rgba(86,70,42,0.48)']],
      [1, [null, 'rgba(172,154,104,0.50)', 'rgba(178,150,104,0.86)', 'rgba(182,152,106,0.95)']],
      [0.42, [null, null, 'rgba(206,182,134,0.40)', 'rgba(212,188,140,0.55)']],
    ],
  };
  // Where the trail bends in tile i: a fixed offset by tile, up to 0.22 R from the centre, so trails wander a little.
  function bend(w, i) {
    const h = Math.imul(i ^ 0x2c1b3c6d, 2246822519) >>> 0, a = ((h & 1023) / 1024) * 2 * Math.PI, d = (((h >>> 10) & 1023) / 1024) * 0.22 * w.R;
    return [w.hx[i] + Math.cos(a) * d, w.hy[i] + Math.sin(a) * d];
  }
  // A worn tile that draws its own trail: worn land that is not a house, field, green or river.
  const trail = (w, i) => i >= 0 && w.worn[i] > 0 && !w.dev[i] && !w.water[i] && !w.river[i];
  // ---- which ways a trail leaves its tile ----
  // Worn tiles lie in patches as well as in lines (round a house, where ways part), and a trail to every worn neighbour would draw a
  // mesh of triangles there. So of three worn tiles that all touch, the weakest link is not drawn: strength is the lower stage of the two
  // tiles, and a fixed number by pair settles ties. The rule looks no further than a tile's own neighbours, so a tile that changes
  // stage changes only the trails of the tiles within two steps of it (the page repaints that far).
  const pairHash = (i, j) => { const a = Math.min(i, j), b = Math.max(i, j); return (Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b, 40503)) >>> 0; };
  const stronger = (w, a, b, c, d) => { // is the link a-b stronger than c-d?
    const s = Math.min(w.worn[a], w.worn[b]), t = Math.min(w.worn[c], w.worn[d]);
    return s !== t ? s > t : pairHash(a, b) > pairHash(c, d);
  };
  // Trail tiles i and its neighbour j in direction k are joined unless a tile touching both has stronger links to each.
  function joined(w, i, j, k) {
    for (const d of [1, 5]) {
      const m = w.nb[i * 6 + ((k + d) % 6)];
      if (trail(w, m) && stronger(w, i, m, i, j) && stronger(w, m, j, i, j)) return false;
    }
    return true;
  }
  // That leaves rings of four (two rows of worn tiles side by side draw as a ladder): of four joined trail tiles in a ring, the weakest
  // side is not drawn either. i and j are linked when they are joined and their link is the weakest side of no such ring. The four
  // rings with i-j as a side have their other side one step away in direction k + 1, k + 2, k + 4 or k + 5.
  function linked(w, i, j, k) {
    if (!joined(w, i, j, k)) return false;
    for (const d of [1, 2, 4, 5]) {
      const q = (k + d) % 6, a = w.nb[i * 6 + q], b = w.nb[j * 6 + q]; // the ring i, j, b, a
      if (!trail(w, a) || !trail(w, b) || !joined(w, i, a, q) || !joined(w, j, b, q) || !joined(w, a, b, k)) continue;
      if (stronger(w, i, a, i, j) && stronger(w, j, b, i, j) && stronger(w, a, b, i, j)) return false;
    }
    return true;
  }
  // The directions (0..5) in which tile i's trail leaves it: to each linked trail neighbour and worn ford; and, when that makes it a
  // dead end, on into the house, field or green that lies straightest ahead, since that is where the way was going. A lone worn tile
  // between built tiles joins the two most opposite. So a way along a row of fields does not send a spur into each.
  function exits(w, i) {
    const out = [], built = [];
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j < 0 || w.water[j]) continue;
      if (trail(w, j)) { if (linked(w, i, j, k)) out.push(k); }
      else if (w.river[j]) { if (w.crossing[j] > 0 && w.worn[j] > 0) out.push(k); }
      else if (w.dev[j] === 2) out.push(k); // a green: the way goes on across it
      else if (w.dev[j] === 1) built.push(k);
    }
    while (out.length < 2 && built.length) {
      // the built neighbour most opposite the ways out so far (the first: the lowest fixed number by pair)
      let best = 0, bs = -Infinity;
      for (let n = 0; n < built.length; n++) {
        let s = pairHash(i, w.nb[i * 6 + built[n]]) / 2 ** 34; // under a quarter: only settles ties
        for (const k of out) { const turn = Math.abs(((built[n] - k + 9) % 6) - 3); s += 3 - turn; } // 3 straight on, 0 back the same way
        if (s > bs) { bs = s; best = n; }
      }
      const k = built.splice(best, 1)[0];
      if (out.length && Math.abs(((k - out[0] + 9) % 6) - 3) > 1) break; // nothing ahead: the way ends here
      out.push(k);
    }
    return out;
  }
  // The trail of tile i as curves [x0, y0, cx, cy, x1, y1, width, stage] (quadratic, cx, cy the control point). Each way out of the tile
  // ends at its joint with the neighbour it leads to, halfway to that neighbour's bend (its centre if it draws no trail), and both sides
  // of a joint have the same width, the mean of the two tiles' widths. Every way out runs one smooth curve to the way most nearly
  // opposite it, bent towards the tile's own bend: so a trail through many tiles flows, and at a fork the side way swings into the
  // main one as a footpath does, with no spokes. A dead end runs from its joint to the bend, narrowing.
  // A green (w.dev 2) wears no path of its own, but the ways that run into it cross it: each from its joint, round the well in the
  // middle, on to the way most nearly opposite, at that way's width and stage.
  function segments(w, i) {
    const green = i >= 0 && w.dev[i] === 2;
    if (!green && !trail(w, i)) return [];
    const s = w.worn[i], [bx, by] = green ? [w.hx[i] + 0.3 * w.R, w.hy[i] + 0.34 * w.R] : bend(w, i), ends = [];
    const end = (x, y, wd, st) => { const l = Math.hypot(x - bx, y - by) || 1; ends.push([x, y, wd, st, (x - bx) / l, (y - by) / l]); };
    if (green) {
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (!trail(w, j) || !exits(w, j).includes((k + 3) % 6)) continue;
        const [jx, jy] = bend(w, j);
        end((jx + w.hx[i]) / 2, (jy + w.hy[i]) / 2, LOOK.width[w.worn[j]], w.worn[j]);
      }
      if (!ends.length) return [];
    } else for (const k of exits(w, i)) {
      const j = w.nb[i * 6 + k], t = trail(w, j), [jx, jy] = t ? bend(w, j) : [w.hx[j], w.hy[j]];
      end((bx + jx) / 2, (by + jy) / 2, t ? (LOOK.width[s] + LOOK.width[w.worn[j]]) / 2 : LOOK.width[s], t ? Math.min(s, w.worn[j]) : s);
    }
    if (!ends.length) return [[bx - 2, by, bx, by + 1, bx + 2, by, LOOK.width[s] * 0.8, s]];
    if (ends.length === 1) {
      const [x, y, wd, st] = ends[0], mx = (x + bx) / 2, my = (y + by) / 2;
      return [[x, y, (x + mx) / 2, (y + my) / 2, mx, my, wd, st], [mx, my, (mx + bx) / 2, (my + by) / 2, bx, by, wd * 0.7, st]];
    }
    const out = [], done = new Set();
    for (let a = 0; a < ends.length; a++) {
      let b = -1, bd = Infinity;
      for (let c = 0; c < ends.length; c++) { // the way most nearly opposite: the lowest cosine between them, seen from the bend
        if (c === a) continue;
        const d = ends[a][4] * ends[c][4] + ends[a][5] * ends[c][5];
        if (d < bd) { bd = d; b = c; }
      }
      const key = a < b ? a * 8 + b : b * 8 + a;
      if (done.has(key)) continue;
      done.add(key);
      // the curve from joint A to joint B, its control point the bend, drawn in towards the chord where the two ways are close together
      // (a sharp turn rounds off instead of doubling back); split at its middle so each half keeps the width and stage of its own joint
      const A = ends[a], B = ends[b], pull = Math.max(0, 0.5 + bd) * 0.6;
      const qx = bx + ((A[0] + B[0]) / 2 - bx) * pull, qy = by + ((A[1] + B[1]) / 2 - by) * pull, mx = (A[0] + 2 * qx + B[0]) / 4,
        my = (A[1] + 2 * qy + B[1]) / 4;
      out.push([A[0], A[1], (A[0] + qx) / 2, (A[1] + qy) / 2, mx, my, A[2], A[3]], [mx, my, (qx + B[0]) / 2, (qy + B[1]) / 2, B[0], B[1], B[2], B[3]]);
    }
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
      if ((w.worn[i] && LOOK.level[w.worn[i]] >= l) || (w.dev && w.dev[i] === 2)) for (const g of segments(w, i)) if (LOOK.level[g[7]] >= l) segs.push(g);
    }
    if (!segs.length) return;
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    ctx.globalCompositeOperation = 'source-atop'; // only on land already painted
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const minW = 1.2 / sc; // at least a texel or so wide on the coarser levels
    for (const [k, colours] of LOOK.layers) for (let s = 1; s <= 3; s++) {
      if (!colours[s]) continue;
      ctx.strokeStyle = colours[s];
      // one path a layer and stage for each width, so curves that meet or cross blend as one stroke, with no darker overlaps
      const byWidth = new Map();
      for (const g of segs) if (g[7] === s) { if (!byWidth.has(g[6])) byWidth.set(g[6], []); byWidth.get(g[6]).push(g); }
      for (const [wd, gs] of byWidth) {
        ctx.lineWidth = Math.max(minW, wd * k);
        ctx.beginPath();
        for (const g of gs) { ctx.moveTo(g[0], g[1]); ctx.quadraticCurveTo(g[2], g[3], g[4], g[5]); }
        ctx.stroke();
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
  return { LOOK, bend, exits, segments, drawChunk, thin };
})();
