// @sys draw/rivers: rivers drawn on the map, each river tile a curve from joint to joint, its banks, springs and reeds
// ===== Rivers on the map: width by catchment, bends, lines per tile, drawn per chunk; items kept off them =====
// Listed after sim.js, in the presentation layer, before draw/bake, whose decorateChunk calls thin; the page draws each chunk with
// drawChunk (VB-1502, from gen/rivers).
VB['draw/rivers'] = (() => {
  // ---- drawing: each river tile holds a line from the joint upstream, past a bend near its centre, to the joint downstream ----
  // Width of the river through tile i, in map units: a brook at its source, at most three quarters of a hex wide.
  const width = (w, i) => Math.min(0.75 * w.HW, 2.5 + 0.9 * Math.sqrt(w.river[i]));
  // Where the river bends in tile i: near the centre on land (a fixed offset by tile, up to 0.2 R), the centre on water.
  function bend(w, i) {
    if (w.water[i]) return [w.hx[i], w.hy[i]];
    const h = Math.imul(i ^ 0x5bd1e995, 2654435761) >>> 0,
      a = ((h & 1023) / 1024) * 2 * Math.PI,
      d = (((h >>> 10) & 1023) / 1024) * 0.2 * w.R;
    return [w.hx[i] + Math.cos(a) * d, w.hy[i] + Math.sin(a) * d];
  }
  // Smooth value noise in [-1, 1] on a unit lattice, seeded by the world and s; it bends the courses and roughens the banks.
  function noise(w, x, y, s) {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy,
      u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy);
    const h = (a, b) => {
      let k = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s + w.seed, 2246822519);
      k = Math.imul(k ^ (k >>> 13), 1274126177);
      return ((k ^ (k >>> 16)) >>> 0) / 2147483648 - 1;
    };
    const a = h(ix, iy),
      b = h(ix + 1, iy),
      c = h(ix, iy + 1),
      d = h(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // A fixed random number in [0, 1) for a point of the map (to a quarter unit) and a purpose s: places springs, reeds and glints.
  function dot(w, x, y, s) {
    let k =
      Math.imul(Math.round(x * 4), 73856093) ^ Math.imul(Math.round(y * 4), 19349663) ^ Math.imul(s + w.seed, 83492791);
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
  }
  // The tiles that flow into tile i, and the one that carries most water (a lake always does): the river's own course; the rest join it.
  function inflows(w, i) {
    const r = [];
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j >= 0 && w.riverTo[j] === i) r.push(j);
    }
    return r;
  }
  const carries = (w, k) => (w.water[k] ? Infinity : w.river[k]);
  const mainInflow = (w, i) => inflows(w, i).reduce((m, k) => (m < 0 || carries(w, k) > carries(w, m) ? k : m), -1);
  // The joint where water passes from tile a to tile b, halfway between their bends (so on their shared edge), and the river's width
  // there: a mouth or lake outlet opens to 1.6 times the river; the main course takes the mean of the two tiles, a tributary its own.
  const joint = (w, a, b) => {
    const p = bend(w, a),
      q = bend(w, b);
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  function jointWidth(w, a, b) {
    if (w.water[a]) return 1.6 * width(w, b);
    if (w.water[b]) return 1.6 * width(w, a);
    return mainInflow(w, b) === a ? (width(w, a) + width(w, b)) / 2 : width(w, a);
  }
  // Meanders: a smooth warp of the plane at two scales, weaker for wide rivers. Lines that meet at a point of one width move alike there.
  function meander(w, x, y, wd) {
    const a = 0.4 * w.R * Math.max(0.3, 1 - wd / (0.75 * w.HW));
    return [
      x + a * (noise(w, x / 70, y / 70, 1) + 0.45 * noise(w, x / 24, y / 24, 3)),
      y + a * (noise(w, x / 70, y / 70, 2) + 0.45 * noise(w, x / 24, y / 24, 4)),
    ];
  }
  // The river through land tile i as lines of points [x, y, width, dry]: one per inflow, from its joint (or one from the spring at a
  // source), past the bend to the joint downstream. A line runs on into a lake or the sea and widens there, dry falling from 1 to 0,
  // so the banks stop at the shore and the channel fades out.
  function lines(w, i) {
    if (!w.river[i] || w.water[i]) return [];
    const b = bend(w, i),
      wi = width(w, i),
      to = w.riverTo[i],
      c = joint(w, i, to),
      wc = jointWidth(w, i, to),
      main = mainInflow(w, i);
    const q = (u, v, z, t) => (1 - t) * (1 - t) * u + 2 * t * (1 - t) * v + t * t * z;
    const into = (pts, p, wd, before) => {
      // three points on from p, away from the bend, into the water
      const l = Math.hypot(p[0] - b[0], p[1] - b[1]) || 1,
        dx = (p[0] - b[0]) / l,
        dy = (p[1] - b[1]) / l;
      for (let s = 1; s <= 3; s++) {
        const e = (s / 3) * 0.45 * w.R,
          wd2 = wd * (1 + s / 6),
          pt = [...meander(w, p[0] + dx * e, p[1] + dy * e, wd2), wd2, 1 - s / 3];
        if (before) pts.unshift(pt);
        else pts.push(pt);
      }
    };
    const from = inflows(w, i),
      res = [];
    for (const k of from.length ? from : [-1]) {
      const a = k < 0 ? b : joint(w, k, i),
        wa = k < 0 ? 0.8 : jointWidth(w, k, i),
        wm = k < 0 || k === main ? wi : wa,
        pts = [];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10,
          wd = q(wa, wm, wc, t);
        pts.push([...meander(w, q(a[0], b[0], c[0], t), q(a[1], b[1], c[1], t), wd), wd, 1]);
      }
      if (k >= 0 && w.water[k]) into(pts, a, wa, true);
      if (w.water[to]) into(pts, c, wc, false);
      pts.tile = i;
      pts.spring = k < 0;
      pts.trib = k >= 0 && k !== main; // a tributary line runs inside the main course near its end
      res.push(pts);
    }
    return res;
  }
  // Adds to the current path the outline of a line at half-width h(point), with round ends. Every outline winds the same way, so one
  // fill of many outlines paints their union, and where lines overlap the colour does not build up.
  function outline(ctx, pts, h) {
    const n = pts.length,
      left = [],
      right = [],
      tan = [];
    for (let k = 0; k < n; k++) {
      const p = pts[Math.max(0, k - 1)],
        q = pts[Math.min(n - 1, k + 1)],
        l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const tx = (q[0] - p[0]) / l,
        ty = (q[1] - p[1]) / l,
        r = Math.max(0, h(pts[k]));
      tan.push([tx, ty, r]);
      left.push([pts[k][0] - ty * r, pts[k][1] + tx * r]);
      right.push([pts[k][0] + ty * r, pts[k][1] - tx * r]);
    }
    const cap = (p, [tx, ty, r], sgn) => {
      // half a circle from one side round the end to the other
      const a0 = Math.atan2(sgn * tx, -sgn * ty),
        out = [];
      for (let j = 1; j < 6; j++)
        out.push([p[0] + Math.cos(a0 - (Math.PI * j) / 6) * r, p[1] + Math.sin(a0 - (Math.PI * j) / 6) * r]);
      return out;
    };
    const ring = [...left, ...cap(pts[n - 1], tan[n - 1], 1), ...right.reverse(), ...cap(pts[0], tan[0], -1)];
    ctx.moveTo(ring[0][0], ring[0][1]);
    for (let k = 1; k < ring.length; k++) ctx.lineTo(ring[k][0], ring[k][1]);
    ctx.closePath();
  }
  // Adds to the current path an uneven round pool of radius r at (x, y), wound like the outlines.
  function pool(w, ctx, x, y, r) {
    for (let j = 0; j < 14; j++) {
      const a = (-2 * Math.PI * j) / 14,
        rr = r * (1 + 0.2 * noise(w, x / 3 + Math.cos(a), y / 3 + Math.sin(a), 21));
      if (j) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.moveTo(x + rr, y);
    }
    ctx.closePath();
  }
  // Close-zoom life on the water: glints along the current of streams and rivers and, at full detail, reeds on lowland banks.
  function details(w, ctx, all, full) {
    ctx.lineCap = 'round';
    for (const pts of all)
      for (let s = 1; s < pts.length - 1; s++) {
        const p = pts[s],
          q = pts[s + 1],
          o = pts[s - 1],
          l = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1,
          tx = (q[0] - o[0]) / l,
          ty = (q[1] - o[1]) / l;
        const hw = p[2] / 2,
          inside = pts.trib && s > 5; // a tributary's end lies in the main course
        if (hw > 3 && p[3] === 1 && !inside && dot(w, p[0], p[1], 31) < 0.45) {
          // a glint: a short light streak with the current
          const off = (dot(w, p[0], p[1], 32) - 0.5) * hw,
            len = 2 + 3 * dot(w, p[0], p[1], 33),
            x = p[0] - ty * off,
            y = p[1] + tx * off;
          ctx.strokeStyle = 'rgba(222,242,240,0.5)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x - tx * len, y - ty * len);
          ctx.lineTo(x + tx * len, y + ty * len);
          ctx.stroke();
        }
        if (!full || inside || p[3] < 1 || s % 2 || w.hp[pts.tile] > 0.7) continue; // reeds grow on the lowland
        for (const side of [-1, 1]) {
          if (dot(w, p[0], p[1], 34 + side) > 0.55) continue;
          const d = hw + 2 + 1.5 * dot(w, p[0], p[1], 36 + side),
            bx = p[0] - ty * d * side,
            by = p[1] + tx * d * side;
          for (let k = 0; k < 4; k++) {
            // a tuft of blades, darker at the foot
            const lean = (dot(w, bx, by, 40 + k) - 0.5) * 3,
              h = 3 + 2.5 * dot(w, bx, by, 44 + k),
              fx = bx + (k - 1.5) * 0.9;
            ctx.strokeStyle = k % 2 ? 'rgba(96,104,50,0.9)' : 'rgba(138,140,70,0.9)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(fx, by);
            ctx.lineTo(fx + lean, by - h);
            ctx.stroke();
          }
        }
      }
  }
  // Fords at the two closest zooms: a riffle of pale gravel across the main course at the middle of the tile, and stepping stones on it.
  function crossings(w, ctx, all) {
    for (const pts of all) {
      if (pts.trib || w.crossing[pts.tile] !== 1) continue;
      const p = pts[5],
        o = pts[4],
        q = pts[6],
        l = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1,
        tx = (q[0] - o[0]) / l,
        ty = (q[1] - o[1]) / l;
      const half = p[2] / 2 + 3,
        n = Math.max(3, Math.round(p[2] / 3)),
        ang = Math.atan2(tx, -ty);
      ctx.fillStyle = 'rgba(184,198,170,0.75)';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], half, 6, ang, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(206,212,186,0.6)';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], half - 2, 3.5, ang, 0, 2 * Math.PI);
      ctx.fill();
      for (let k = 0; k < n; k++) {
        // the stones, each with a shadow on its downstream side
        const u = ((k + 0.5) / n) * 2 - 1,
          j = (dot(w, p[0] + k, p[1], 50) - 0.5) * 2.4,
          x = p[0] - ty * u * (half - 2) + tx * j;
        const y = p[1] + tx * u * (half - 2) + ty * j,
          r = 1.9 + 0.9 * dot(w, x, y, 51);
        ctx.fillStyle = 'rgba(40,60,60,0.45)';
        ctx.beginPath();
        ctx.ellipse(x + tx * 0.9 + 0.3, y + ty * 0.9 + 0.6, r, r * 0.8, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgb(148,144,132)';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.8, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(214,210,196,0.7)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.3, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
  // Paints the rivers of one map chunk onto ctx, over the baked land and under the decorations. lv: draw/bake LV[level]; full: level 0.
  // The paint only takes where the chunk already holds land (or the foam along a shore), so a river ends at the painted coastline.
  // look: the rows' season looks (draw/season rowLooks), or none: a river is iced as a lake is, by its tile's row (VB-083).
  function drawChunk(w, ctx, lv, cx, cy, full, look = null) {
    const { R, HW, AP, COLS, ROWS } = w,
      sc = lv.scale,
      x0 = cx * lv.size,
      y0 = cy * lv.size,
      x1 = x0 + lv.size,
      y1 = y0 + lv.size,
      M = 2 * R;
    const r0 = Math.max(0, Math.floor((y0 - M - R) / (1.5 * R))),
      r1 = Math.min(ROWS - 1, Math.ceil((y1 + M - R) / (1.5 * R)));
    const c0 = Math.max(0, Math.floor((x0 - M - AP) / HW)),
      c1 = Math.min(COLS - 1, Math.ceil((x1 + M - AP) / HW));
    const all = [],
      ice = []; // the ice of each line, by its tile's row
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) {
        const ls = lines(w, row * COLS + col),
          k = look ? VB['draw/season'].lakeOf(look[row]) : 0;
        for (const pts of ls) {
          all.push(pts);
          ice.push(k);
        }
      }
    if (!all.length) return;
    const minH = (full ? 0.35 : 0.45) / sc; // a half-width of at least this many texels, so brooks still show on the overview
    const dry = all.map((pts) => pts.filter((p) => p[3] === 1));
    // [colour, half-width at a point, land only]: a stream as a mural draws one, flat inside a dark contour, a pale line down its middle
    const lw = Math.max(0.9, 0.6 / sc);
    const layers = [
      ['rgb(44,32,28)', (p) => Math.max(minH, p[2] / 2 + 0.5 * noise(w, p[0] / 5, p[1] / 5, 9)) + lw, true],
      ['rgb(126,164,164)', (p) => Math.max(minH, p[2] / 2 + 0.5 * noise(w, p[0] / 5, p[1] / 5, 9)), false],
      ['rgb(226,232,218)', (p) => (p[2] > 5 ? 0.45 : 0) * p[3], false],
    ];
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    ctx.globalCompositeOperation = 'source-atop';
    // open water in its colours; ice in the ice's (draw/season ICE_CSS), with no pale line down the middle
    const iceCss = VB['draw/season'].ICE_CSS;
    for (let li = 0; li < layers.length; li++) {
      const [colour, h, landOnly] = layers[li];
      for (let k = 0; k < 3; k++) {
        if (k && li === 2) continue;
        let any = false;
        ctx.beginPath();
        all.forEach((pts, n) => {
          if (ice[n] !== k) return;
          const p = landOnly ? dry[n] : pts;
          if (p.length > 1) {
            outline(ctx, p, h);
            any = true;
          }
          if (pts.spring) {
            // a small pool where the river rises
            const sp = [pts[0][0], pts[0][1], 2 * (3.5 + 2.5 * dot(w, pts[0][0], pts[0][1], 30)), 1];
            if (h(sp) > 0) {
              pool(w, ctx, sp[0], sp[1], h(sp));
              any = true;
            }
          }
        });
        if (!any) continue;
        ctx.fillStyle = k && li === 1 ? iceCss[k] : colour;
        ctx.fill();
      }
    }
    if (sc >= 1 / 3) {
      crossings(w, ctx, all);
      details(w, ctx, all, full);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Squared distance from point (x, y) to the segment a-b.
  function dist2(x, y, a, b) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0,
      px = a[0] + t * dx - x,
      py = a[1] + t * dy - y;
    return px * px + py * py;
  }
  // Drops the decoration items ({t, x, y, ...}) that stand in a river or on its bank, or whose crown (a tree's, 10 units above its foot)
  // would hide one, in place, and returns the array. loc: world/grid's hexLocator(w).
  function thin(w, items, loc) {
    const o = [0, 0],
      cache = new Map(),
      near = (x, y) => {
        const t = loc(x, y, o);
        if (t < 0) return false;
        for (let k = -1; k < 6; k++) {
          const i = k < 0 ? t : w.nb[t * 6 + k];
          if (i < 0 || !w.river[i]) continue;
          if (!cache.has(i)) cache.set(i, lines(w, i));
          for (const pts of cache.get(i))
            for (let s = 1; s < pts.length; s++) {
              const r = Math.max(pts[s - 1][2], pts[s][2]) / 2 + 5;
              if (dist2(x, y, pts[s - 1], pts[s]) < r * r) return true;
            }
        }
        return false;
      };
    let n = 0;
    for (const it of items)
      if (!near(it.x, it.y) && !((it.t === 'broad' || it.t === 'pine') && near(it.x, it.y - 10))) items[n++] = it;
    items.length = n;
    return items;
  }
  return { width, lines, drawChunk, thin };
})();
