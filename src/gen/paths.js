// @sys gen/paths: how worn paths look: a trail through each worn tile towards its worn neighbours, painted into the map chunks and over the fields
// ===== Worn paths on the map (VB-094). The simulation counts and fades the wear (sim/paths); this module only reads w.worn. =====
// Listed before gen/rivers.js and gen.js: the chunk bake keeps trees and stones off paths and lanes through `thin`.
VB['gen/paths'] = (() => {
  // By stage (0 none, 1 trodden ground, 2 path, 3 lane): the trail's width in map units, and the coarsest level of detail (ArchGen.LV
  // index) that still shows it: trodden ground only up close, paths and lanes at the middle level too. The overview shows none, so a path
  // that changes stage never repaints it (a full overview chunk takes about 60 ms).
  // A trail is painted in layers, widest first, each [times the width, colour by stage]: the verge of dry, flattened grass, the darker
  // rim where the turf breaks, the bare earth, and on paths and lanes a paler middle where the ground is packed hardest.
  const LOOK = {
    ways: 2, // the worn neighbours a tile's way keeps to (keeps, below)
    // trampled ground: how wide its earth is drawn, in tile radii; how far a layer's unit lies outside it; how far it reaches towards
    // the end of a way that comes to it, as a share of the way there
    ground: 1.05, rim: 7, reach: 0.45,
    groundLayers: ['rgba(150,142,80,0.20)', 'rgba(104,90,54,0.16)', 'rgba(188,164,118,0.60)', null], // its verge, rim and earth
    from: 2, // the stage from which a way is drawn: 2, a path (PATHS.at[2] crossings, about four a day kept up)
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
  // A worn tile that draws its own trail: land, a field or a meadow (w.dev 0 and 1) worn to LOOK.from or more, not a green, a house or
  // a river. Trodden ground is walked, counted and quicker (sim/paths, sim/routes) and is not drawn (Kim, VB-396): the small ways
  // everyone takes across the grass are too slight for the map, and drawn they hid the roads.
  const trail = (w, i) => i >= 0 && w.worn[i] >= LOOK.from && w.dev[i] < 2 && !w.water[i] && !w.river[i];
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
  // Where a whole patch is worn (a village's middle, where everyone walks every way), a trail to every worn neighbour is a net, not a
  // road. A way runs where the most feet go: tile i keeps to its LOOK.ways most worn trail neighbours, by their count of crossings (a
  // fixed number by pair settles ties), and two tiles are tied when either keeps to the other, so a side way still joins the main one.
  function keeps(w, i, j) {
    let above = 0;
    for (let k = 0; k < 6; k++) {
      const m = w.nb[i * 6 + k];
      if (m === j || !trail(w, m)) continue;
      if (w.wear[m] > w.wear[j] || (w.wear[m] === w.wear[j] && pairHash(i, m) > pairHash(i, j))) above++;
    }
    return above < LOOK.ways;
  }
  // Trail tiles i and its neighbour j in direction k are joined unless a tile touching both has stronger links to each.
  function joined(w, i, j, k) {
    if (!keeps(w, i, j) && !keeps(w, j, i)) return false;
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
  // A house's door (VB-396): the one worn tile beside it that its way runs to, the most worn of them (a fixed number by pair settles
  // ties), or the green if the house stands on one; -1 where nothing beside it is worn. A way ends at a house, and never goes on
  // through it: the house draws no trail of its own.
  function door(w, h) {
    let best = -1, bs = -1;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[h * 6 + k];
      if (j < 0) continue;
      if (w.dev[j] === 2) return j;
      if (!trail(w, j)) continue;
      const sc = w.worn[j] + pairHash(h, j) / 2 ** 33;
      if (sc > bs) { bs = sc; best = j; }
    }
    return best;
  }
  // How far into a house's tile its way runs, from the trail's bend towards the house: under the yard's edge, short of the buildings.
  const DOOR = 0.7;
  // Trampled ground (Kim, VB-396): between the houses of a village everyone walks every way, and the tiles there are worn side by side,
  // a net of ways if each is drawn. Such a tile is drawn as bare earth instead, as a village's yard was: a trail tile on open land
  // beside a house or the green, with two trail tiles beside it that touch each other (worn in a patch, not in a line).
  function trampled(w, i) {
    if (!trail(w, i) || w.dev[i]) return false;
    let yard = false, patch = false;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j < 0) continue;
      if (w.dev[j] > 1) yard = true;
      else if (trail(w, j) && trail(w, w.nb[i * 6 + ((k + 1) % 6)])) patch = true;
    }
    return yard && patch;
  }
  // The directions (0..5) in which tile i's trail leaves it: to each linked trail neighbour and worn ford; and, when that makes it a
  // dead end, on into the unworn field or meadow that lies straightest ahead, since that is where the way was going. A lone worn tile
  // between such tiles joins the two most opposite. So a way along a row of fields does not send a spur into each. A house is
  // reached only by its door.
  function exits(w, i) {
    const out = [], built = [], yard = trampled(w, i);
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j < 0 || w.water[j]) continue;
      if (trail(w, j)) { if (yard || trampled(w, j) || linked(w, i, j, k)) out.push(k); } // every way beside trampled ground runs onto it
      else if (w.river[j]) { if (w.crossing[j] > 0 && w.worn[j] > 0) out.push(k); }
      else if (w.dev[j] === 2) out.push(k); // a green: the way goes on across it
      else if (w.dev[j] === 3) { if (door(w, j) === i) out.push(k); } // a house whose door this is: a way ends there
      else if (w.dev[j]) built.push(k); // a field or meadow that is not worn
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
  // of a joint have the same width, the mean of the two tiles' widths. The two ways out most nearly opposite are the main way, one
  // smooth curve bent towards the tile's own bend, so a trail through many tiles flows; every other way out joins it at its middle.
  // A dead end runs from its joint to the bend, narrowing.
  // A green (w.dev 2) wears no path of its own, but the ways that run into it, from any of its six sides, go on over it: each from its
  // joint to the open ground by the well, at that way's width and stage; and so does the way from the door of each house on the green.
  function segments(w, i) {
    const green = i >= 0 && w.dev[i] === 2;
    if (!green && !trail(w, i)) return [];
    const s = w.worn[i], [bx, by] = green ? [w.hx[i] + 0.3 * w.R, w.hy[i] + 0.34 * w.R] : bend(w, i), ends = [];
    const end = (x, y, wd, st) => { const l = Math.hypot(x - bx, y - by) || 1; ends.push([x, y, wd, st, (x - bx) / l, (y - by) / l]); };
    if (green) {
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j >= 0 && w.dev[j] === 3) { // a house on the green: its way runs from its door onto the green
          end(w.hx[i] + (w.hx[j] - w.hx[i]) * (0.5 + DOOR / 2), w.hy[i] + (w.hy[j] - w.hy[i]) * (0.5 + DOOR / 2), LOOK.width[2] * 0.8, 2);
          continue;
        }
        if (!trail(w, j) || !exits(w, j).includes((k + 3) % 6)) continue;
        const [jx, jy] = trampled(w, j) ? [w.hx[j], w.hy[j]] : bend(w, j);
        end((jx + w.hx[i]) / 2, (jy + w.hy[i]) / 2, LOOK.width[w.worn[j]], w.worn[j]);
      }
      // every way onto the green runs to the open ground by the well, where they meet: one place, not a mesh of crossings
      return ends.map(([x, y, wd, st]) => [x, y, (x + bx) / 2, (y + by) / 2, bx, by, wd, st]);
    } else for (const k of exits(w, i)) {
      const j = w.nb[i * 6 + k], t = trail(w, j), [jx, jy] = t && !trampled(w, j) ? bend(w, j) : [w.hx[j], w.hy[j]];
      if (w.dev[j] === 3) end(bx + (jx - bx) * DOOR, by + (jy - by) * DOOR, LOOK.width[s] * 0.8, s); // the way to a house's door, a little narrower
      else end((bx + jx) / 2, (by + jy) / 2, t ? (LOOK.width[s] + LOOK.width[w.worn[j]]) / 2 : LOOK.width[s], t ? Math.min(s, w.worn[j]) : s);
    }
    if (trampled(w, i)) {
      // bare earth about the tile's middle, reaching to each trampled tile beside it so that the patch is one ground (a ninth number
      // marks it for the painter), all of it one width and painted as a path's earth, so that it is one stroke with no seams; no way
      // is drawn on it, and the houses beside it open onto it
      const cx = w.hx[i], cy = w.hy[i], wide = LOOK.ground * w.R, out = [[cx - 1, cy, cx, cy, cx + 1, cy, wide, LOOK.from, 1]];
      for (const k of exits(w, i)) {
        const j = w.nb[i * 6 + k];
        if (!trampled(w, j)) continue;
        const mx = (cx + w.hx[j]) / 2, my = (cy + w.hy[j]) / 2;
        out.push([cx, cy, (cx + mx) / 2, (cy + my) / 2, mx, my, wide, LOOK.from, 1]);
      }
      for (const k of exits(w, i)) { // towards a way that comes to it, the ground reaches out to meet the way's end
        const j = w.nb[i * 6 + k];
        if (!trail(w, j) || trampled(w, j)) continue;
        const [jx, jy] = bend(w, j), ex = cx + ((cx + jx) / 2 - cx) * LOOK.reach, ey = cy + ((cy + jy) / 2 - cy) * LOOK.reach;
        out.push([cx, cy, (cx + ex) / 2, (cy + ey) / 2, ex, ey, wide, LOOK.from, 1]);
      }
      return out;
    }
    if (!ends.length) return [[bx - 2, by, bx, by + 1, bx + 2, by, LOOK.width[s] * 0.8, s]];
    if (ends.length === 1) {
      const [x, y, wd, st] = ends[0], mx = (x + bx) / 2, my = (y + by) / 2;
      return [[x, y, (x + mx) / 2, (y + my) / 2, mx, my, wd, st], [mx, my, (mx + bx) / 2, (my + by) / 2, bx, by, wd * 0.7, st]];
    }
    // the main way through the tile: the two ways out most nearly opposite (the lowest cosine between them, seen from the bend), the
    // more worn pair where two are as straight; drawn as one curve from joint A to joint B, its control point the bend, drawn in
    // towards the chord where the two ways are close together (a sharp turn rounds off instead of doubling back), and split at its
    // middle so each half keeps the width and stage of its own joint
    let a = 0, b = 1, bd = Infinity;
    for (let x = 0; x < ends.length; x++) for (let y = x + 1; y < ends.length; y++) {
      const d = ends[x][4] * ends[y][4] + ends[x][5] * ends[y][5] - 0.05 * Math.min(ends[x][3], ends[y][3]);
      if (d < bd) { bd = d; a = x; b = y; }
    }
    const A = ends[a], B = ends[b], pull = Math.max(0, 0.5 + A[4] * B[4] + A[5] * B[5]) * 0.6;
    const qx = bx + ((A[0] + B[0]) / 2 - bx) * pull, qy = by + ((A[1] + B[1]) / 2 - by) * pull, mx = (A[0] + 2 * qx + B[0]) / 4,
      my = (A[1] + 2 * qy + B[1]) / 4;
    const out = [[A[0], A[1], (A[0] + qx) / 2, (A[1] + qy) / 2, mx, my, A[2], A[3]], [mx, my, (qx + B[0]) / 2, (qy + B[1]) / 2, B[0], B[1], B[2], B[3]]];
    // every other way joins the main one at its middle, one meeting place a tile: a fork, not a knot of crossings (VB-396)
    for (let c = 0; c < ends.length; c++) {
      if (c === a || c === b) continue;
      const E = ends[c];
      out.push([E[0], E[1], (E[0] + mx) / 2, (E[1] + my) / 2, mx, my, E[2], E[3]]);
    }
    return out;
  }
  // The trail curves of one chunk at level l (lv: ArchGen.LV[l]), and its worn fields and meadows.
  function chunkSegments(w, lv, cx, cy, l) {
    const { R, HW, AP, COLS, ROWS } = w, x0 = cx * lv.size, y0 = cy * lv.size, x1 = x0 + lv.size, y1 = y0 + lv.size, M = R;
    const r0 = Math.max(0, Math.floor((y0 - M - R) / (1.5 * R))), r1 = Math.min(ROWS - 1, Math.ceil((y1 + M - R) / (1.5 * R)));
    const c0 = Math.max(0, Math.floor((x0 - M - AP) / HW)), c1 = Math.min(COLS - 1, Math.ceil((x1 + M - AP) / HW));
    const segs = [], sown = [];
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
      const i = row * COLS + col;
      if (!(w.worn[i] && LOOK.level[w.worn[i]] >= l) && !(w.dev && w.dev[i] === 2)) continue;
      if (w.dev && w.dev[i] === 1) sown.push(i);
      for (const g of segments(w, i)) if (LOOK.level[g[7]] >= l) segs.push(g);
    }
    return { segs, sown };
  }
  // Strokes the curves in their layers; ctx is set to map units.
  function paint(ctx, segs, sc) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const minW = 1.2 / sc; // at least a texel or so wide on the coarser levels
    const stroke = (gs, wd) => {
      ctx.lineWidth = Math.max(minW, wd);
      ctx.beginPath();
      for (const g of gs) { ctx.moveTo(g[0], g[1]); ctx.quadraticCurveTo(g[2], g[3], g[4], g[5]); }
      ctx.stroke();
    };
    const ground = segs.filter((g) => g[8]);
    LOOK.layers.forEach(([k, colours], n) => {
      // trampled ground (a ninth number): one stroke a layer, as wide as it is, its verge and rim a little outside it, in its own
      // paler colours, and with no packed middle; under the ways of the same layer, which run into it
      if (ground.length && LOOK.groundLayers[n]) { ctx.strokeStyle = LOOK.groundLayers[n]; stroke(ground, ground[0][6] + (k - 1) * LOOK.rim); }
      for (let s = 1; s <= 3; s++) {
        if (!colours[s]) continue;
        ctx.strokeStyle = colours[s];
        // one path a layer and stage for each width, so curves that meet or cross blend as one stroke, with no darker overlaps
        const byWidth = new Map();
        for (const g of segs) if (g[7] === s && !g[8]) { if (!byWidth.has(g[6])) byWidth.set(g[6], []); byWidth.get(g[6]).push(g); }
        for (const [wd, gs] of byWidth) stroke(gs, wd * k);
      }
    });
  }
  // Paints the trails of one chunk onto ctx, over the rivers and under the decorations. lv: ArchGen.LV[level]; l: the level.
  function drawChunk(w, ctx, lv, cx, cy, l) {
    if (!w.worn) return;
    const { segs } = chunkSegments(w, lv, cx, cy, l);
    if (!segs.length) return;
    const sc = lv.scale;
    ctx.setTransform(sc, 0, 0, sc, -cx * lv.size * sc, -cy * lv.size * sc);
    ctx.globalCompositeOperation = 'source-atop'; // only on land already painted
    paint(ctx, segs, sc);
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // The same trails where they cross fields and meadows, which the page draws over the chunks: painted on a clear canvas of the chunk's
  // size (from make(), asked for only if a field or meadow of the chunk is worn) and kept only inside those tiles' panes (FIELD_PANE of
  // the tile's radius, as the field art is cut), so the two paintings meet at the pane's edge with nothing painted twice. The canvas, or null.
  const FIELD_PANE = 0.92;
  function drawOver(w, lv, cx, cy, l, make) {
    if (!w.worn) return null;
    const { segs, sown } = chunkSegments(w, lv, cx, cy, l);
    if (!sown.length || !segs.length) return null;
    const canvas = make(), ctx = canvas.getContext('2d'), sc = lv.scale;
    ctx.setTransform(sc, 0, 0, sc, -cx * lv.size * sc, -cy * lv.size * sc);
    paint(ctx, segs, sc);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    for (const i of sown) for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (30 + 60 * k), x = w.hx[i] + Math.cos(a) * w.R * FIELD_PANE, y = w.hy[i] + Math.sin(a) * w.R * FIELD_PANE;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      if (k === 5) ctx.closePath();
    }
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
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
  return { LOOK, bend, door, trampled, exits, segments, drawChunk, drawOver, thin };
})();
