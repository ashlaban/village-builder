// A mock of two ways to draw the roads (thread "Redesign road layout for hex maps", 27 November 2026): throwaway, not game code.
// Runs in the page, in place of draw/paths' own trail curves (hook.js swaps `segments` and `thin`). The simulation is untouched: the
// road tiles are the lanes it wears (w.worn 3), as today. Only the drawing differs.
//   A  a derived network: the lane tiles are traced into strokes (a way that runs on through a junction by its straightest pair),
//      each stroke straightened (Douglas-Peucker on the tile centres) and rounded (Chaikin); a stroke that ends at a junction joins
//      the through stroke at the point nearest its last bend, so side ways meet as a T, anywhere in the hex. A house gets a short
//      gate lane to the nearest road.
//   B  hex pieces: each road hex is drawn from a fixed set of pieces by the sides its road leaves through (edge midpoints), at most
//      three per hex (Kim, 27 Nov): a dead end, a straight, a bend, or a through way with a branch meeting it as a T.
// Both use the same graph: the lane tiles, their houses and greens, the strongest links first (a maximum spanning tree), short loops
// (a triangle, two rows of worn tiles side by side) left out, long loops (round a field) kept.
(() => {
  const MODE = window.__roadMode;
  if (!MODE) return;
  const TOL = 0.42, // Douglas-Peucker tolerance, in hex radii: a zigzag of hex centres (0.43 R off its line) draws straight
    FILLET = 1.6, // the largest radius a corner is rounded to, in hex radii (a hairpin turns on a half circle, not a square)
    WIDTH = { main: 9.5, side: 7.5, gate: 5.5 };
  let cache = null;
  const sig = (w) => {
    let h = w.N;
    for (let i = 0; i < w.N; i++) h = (Math.imul(h, 31) + w.worn[i] * 7 + w.dev[i]) | 0;
    return h;
  };
  const hash = (a, b) => (Math.imul(Math.min(a, b) ^ 0x9e3779b9, 2654435761) ^ Math.imul(Math.max(a, b), 40503)) >>> 0;

  // ---- the graph ----
  function graph(w) {
    const road = (i) => i >= 0 && !w.water[i] && (w.worn[i] >= 3 || w.dev[i] === 2);
    const nodes = [];
    for (let i = 0; i < w.N; i++) if (road(i)) nodes.push(i);
    const isNode = new Uint8Array(w.N);
    for (const i of nodes) isNode[i] = 1;
    const str = (i) => (w.dev[i] === 2 ? 3e6 : w.worn[i] * 1e6 + (w.wear ? w.wear[i] : 0));
    const edges = [];
    for (const i of nodes)
      for (let k = 0; k < 6; k++) {
        const j = w.nb[i * 6 + k];
        if (j > i && isNode[j]) edges.push({ a: i, b: j, s: Math.min(str(i), str(j)) + hash(i, j) / 2 ** 33 });
      }
    // houses: each linked to its strongest road neighbour (its door)
    const houses = [];
    for (let h = 0; h < w.N; h++) {
      if (w.dev[h] !== 3 || w.water[h]) continue;
      let best = -1, bs = -1;
      for (let k = 0; k < 6; k++) {
        const j = w.nb[h * 6 + k];
        if (j >= 0 && isNode[j] && str(j) + hash(h, j) / 2 ** 33 > bs) { bs = str(j) + hash(h, j) / 2 ** 33; best = j; }
      }
      if (best >= 0) houses.push({ h, door: best });
    }
    edges.sort((x, y) => y.s - x.s);
    const adj = new Map(nodes.map((i) => [i, []])),
      deg = (i) => adj.get(i).length + (MODE === 'B' ? houses.filter((q) => q.door === i).length : 0);
    const parent = new Map(nodes.map((i) => [i, i])),
      find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const cap = MODE === 'B' ? 3 : 99;
    const rest = [];
    for (const e of edges) {
      const ra = find(e.a), rb = find(e.b);
      if (ra === rb) { rest.push(e); continue; }
      if (deg(e.a) >= cap || deg(e.b) >= cap) continue;
      parent.set(ra, rb);
      adj.get(e.a).push(e.b);
      adj.get(e.b).push(e.a);
    }
    // a loop is kept only if it goes round something: a tile inside it that is not on it. A triangle or two rows side by side
    // (a ladder) enclose nothing and are not drawn; a ring round one field is.
    const treePath = (a, b) => {
      const prev = new Map([[a, -1]]), q = [a];
      while (q.length) { const x = q.shift(); if (x === b) break; for (const y of adj.get(x)) if (!prev.has(y)) { prev.set(y, x); q.push(y); } }
      if (!prev.has(b)) return null;
      const out = [];
      for (let x = b; x >= 0; x = prev.get(x)) out.push(x);
      return out;
    };
    const encloses = (loop) => {
      const on = new Set(loop);
      let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
      for (const i of loop) { const c = i % w.COLS, r = (i / w.COLS) | 0; c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
      c0--; c1++; r0--; r1++;
      const inBox = (i) => { const c = i % w.COLS, r = (i / w.COLS) | 0; return c >= c0 && c <= c1 && r >= r0 && r <= r1; };
      const seen = new Set(), q = [];
      for (let r = Math.max(0, r0); r <= r1; r++) for (let c = Math.max(0, c0); c <= c1; c++) {
        if (r !== r0 && r !== r1 && c !== c0 && c !== c1) continue;
        const i = r * w.COLS + c;
        if (c < w.COLS && i < w.N && !on.has(i)) { seen.add(i); q.push(i); }
      }
      while (q.length) { const x = q.pop(); for (let k = 0; k < 6; k++) { const y = w.nb[x * 6 + k]; if (y >= 0 && inBox(y) && !on.has(y) && !seen.has(y)) { seen.add(y); q.push(y); } } }
      for (let r = Math.max(0, r0); r <= r1; r++) for (let c = Math.max(0, c0); c <= Math.min(w.COLS - 1, c1); c++) { const i = r * w.COLS + c; if (!on.has(i) && !seen.has(i)) return true; }
      return false;
    };
    for (const e of rest) {
      if (deg(e.a) >= cap || deg(e.b) >= cap) continue;
      const loop = treePath(e.a, e.b);
      if (!loop || !encloses(loop)) continue;
      adj.get(e.a).push(e.b);
      adj.get(e.b).push(e.a);
    }
    // a stub of one tile left by a triangle (it touches the way it branches from on both sides) is not a way: it is dropped
    const touches = (i, j) => { for (let k = 0; k < 6; k++) if (w.nb[i * 6 + k] === j) return true; return false; };
    for (const i of nodes) {
      const ns = adj.get(i);
      if (ns.length !== 1) continue;
      const x = ns[0], xs = adj.get(x);
      if (xs.length < 3 || !xs.some((y) => y !== i && touches(i, y))) continue;
      ns.length = 0;
      xs.splice(xs.indexOf(i), 1);
    }
    if (MODE === 'B') for (let n = houses.length - 1; n >= 0; n--) if (adj.get(houses[n].door).length + houses.filter((q) => q.door === houses[n].door).length > cap) houses.splice(n, 1);
    return { nodes, adj, houses, str };
  }
  const P = (w, i) => [w.hx[i], w.hy[i]];
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const near = (p, a, b) => { // nearest point to p on segment a-b, and its distance
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1,
      t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)), q = [a[0] + t * dx, a[1] + t * dy];
    return [q, Math.hypot(p[0] - q[0], p[1] - q[1])];
  };
  const nearOn = (p, line) => { let best = null, bd = Infinity; for (let k = 1; k < line.length; k++) { const [q, d] = near(p, line[k - 1], line[k]); if (d < bd) { bd = d; best = q; } } return [best, bd]; };

  // ---- A: strokes ----
  function buildA(w, G) {
    const { adj, str } = G, R = w.R;
    // at each node, which neighbour a way from neighbour a goes on to (the straightest pair, strongest first)
    const cont = new Map();
    for (const [i, ns] of adj) {
      const m = new Map();
      if (ns.length === 2) { m.set(ns[0], ns[1]); m.set(ns[1], ns[0]); }
      else if (ns.length > 2) {
        const pairs = [];
        for (let x = 0; x < ns.length; x++) for (let y = x + 1; y < ns.length; y++) {
          const u = unit(P(w, i), P(w, ns[x])), v = unit(P(w, i), P(w, ns[y])), c = u[0] * v[0] + u[1] * v[1];
          pairs.push({ x: ns[x], y: ns[y], c, s: Math.min(str(ns[x]), str(ns[y])) });
        }
        pairs.sort((p, q) => p.c - q.c || q.s - p.s);
        const used = new Set();
        for (const p of pairs) {
          if (used.has(p.x) || used.has(p.y) || p.c > -0.45) continue; // only a way that runs on fairly straight
          m.set(p.x, p.y); m.set(p.y, p.x); used.add(p.x); used.add(p.y);
        }
      }
      cont.set(i, m);
    }
    const done = new Set(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a), strokes = [];
    const walk = (a, b) => { // from a towards b, on while the way runs on
      const t = [a, b];
      for (;;) {
        const nx = cont.get(t.at(-1)).get(t.at(-2));
        if (nx === undefined || done.has(key(t.at(-1), nx)) || nx === t[0] && t.length > 2) break;
        done.add(key(t.at(-1), nx));
        t.push(nx);
      }
      return t;
    };
    for (const [i, ns] of adj) for (const j of ns) {
      if (done.has(key(i, j))) continue;
      done.add(key(i, j));
      const f = walk(i, j), b = walk(j, i);
      // b runs j, i, ...; f runs i, j, ...: the stroke is reverse(b beyond i), i, j, f beyond j
      strokes.push({ tiles: [...b.slice(2).reverse(), i, j, ...f.slice(2)] });
    }
    for (const s of strokes) s.weight = s.tiles.reduce((a, i) => a + Math.min(str(i), 5e6), 0) / 1e6;
    strokes.sort((a, b) => b.weight - a.weight);
    strokes.forEach((s, k) => { s.rank = k; s.main = s.tiles.length >= 6 || k < 2; });
    // simplify and round
    const dp = (pts, tol) => {
      if (pts.length < 3) return pts;
      let bi = -1, bd = 0;
      for (let k = 1; k < pts.length - 1; k++) { const [, d] = near(pts[k], pts[0], pts.at(-1)); if (d > bd) { bd = d; bi = k; } }
      if (bd <= tol) return [pts[0], pts.at(-1)];
      return [...dp(pts.slice(0, bi + 1), tol).slice(0, -1), ...dp(pts.slice(bi), tol)];
    };
    // each corner rounded by a curve from a point before it to a point after it, as far out as FILLET or half the shorter side
    const fillet = (pts, rmax) => {
      if (pts.length < 3) return pts;
      const o = [pts[0]];
      for (let k = 1; k < pts.length - 1; k++) {
        const A = pts[k - 1], P0 = pts[k], B = pts[k + 1], la = Math.hypot(A[0] - P0[0], A[1] - P0[1]), lb = Math.hypot(B[0] - P0[0], B[1] - P0[1]);
        const d = Math.min(rmax, la / 2, lb / 2), u = unit(P0, A), v = unit(P0, B), p1 = [P0[0] + u[0] * d, P0[1] + u[1] * d], p2 = [P0[0] + v[0] * d, P0[1] + v[1] * d];
        for (let t = 0; t <= 1.0001; t += 1 / 8) o.push([(1 - t) ** 2 * p1[0] + 2 * (1 - t) * t * P0[0] + t * t * p2[0], (1 - t) ** 2 * p1[1] + 2 * (1 - t) * t * P0[1] + t * t * p2[1]]);
      }
      o.push(pts.at(-1));
      return o;
    };
    const chaikin = (pts, n) => {
      for (let r = 0; r < n; r++) {
        if (pts.length < 3) return pts;
        const o = [pts[0]];
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1];
          if (k > 0) o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
          if (k < pts.length - 2) o.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        o.push(pts.at(-1));
        pts = o;
      }
      return pts;
    };
    for (const s of strokes) {
      const loop = s.tiles.length > 2 && s.tiles[0] === s.tiles.at(-1);
      s.line = fillet(dp(s.tiles.map((i) => P(w, i)), TOL * R), FILLET * R);
      s.loop = loop;
    }
    // which stroke runs through each tile, the strongest first
    const through = new Map();
    for (const s of strokes) s.tiles.forEach((i, k) => { if (k > 0 && k < s.tiles.length - 1 && !through.has(i)) through.set(i, s); });
    // a stroke ending where another runs on through joins it as a T: its end moves to the point of that stroke nearest its last bend
    for (const s of [...strokes].reverse()) {
      if (s.loop) continue;
      for (const end of [0, 1]) {
        const i = end ? s.tiles.at(-1) : s.tiles[0], t = through.get(i);
        if (!t || t === s || (adj.get(i).length < 2)) continue;
        const L = s.line, prev = end ? L[Math.max(0, L.length - 2)] : L[Math.min(L.length - 1, 1)];
        const [q] = nearOn(prev, t.line);
        if (!q) continue;
        // drop the rounded points past prev, and run straight from prev to the meeting point
        const k0 = L.indexOf(prev);
        s.line = end ? [...L.slice(0, k0 + 1), q] : [q, ...L.slice(k0)];
      }
    }
    const out = [];
    for (const s of strokes) out.push({ pts: s.line, w: s.main ? WIDTH.main : WIDTH.side, stage: 3 });
    // gate lanes: from the house's edge facing the road to the nearest point on any stroke
    for (const { h, door } of G.houses) {
      const hp = P(w, h), dp0 = P(w, door), u = unit(hp, dp0), gate = [hp[0] + u[0] * 0.55 * R * 1.0, hp[1] + u[1] * 0.55 * R];
      let best = null, bd = Infinity;
      for (const s of strokes) { if (!s.tiles.includes(door) && s.tiles.length) { /* only strokes at the door */ continue; } const [q, d] = nearOn(gate, s.line); if (d < bd) { bd = d; best = q; } }
      if (!best) best = dp0;
      out.push({ pts: [hp.map((v, k) => v + u[k] * 0.32 * R), gate, best], w: WIDTH.gate, stage: 2 });
    }
    return out;
  }

  // ---- B: hex pieces ----
  function buildB(w, G) {
    const { adj, houses } = G, R = w.R, out = [];
    const q = (a, c, b, wd, st = 3) => out.push({ quad: [a, c, b], w: wd, stage: st });
    const doors = new Map();
    for (const hs of houses) { if (!doors.has(hs.door)) doors.set(hs.door, []); doors.get(hs.door).push(hs.h); }
    for (const [i, ns] of adj) {
      const c = P(w, i), mids = [...ns, ...(doors.get(i) || [])].map((j) => { const p = P(w, j); return { j, m: [(c[0] + p[0]) / 2, (c[1] + p[1]) / 2], house: w.dev[j] === 3 }; });
      if (!mids.length) continue;
      const wd = WIDTH.side + 1;
      if (mids.length === 1) { const m = mids[0].m; q(m, [(m[0] + c[0]) / 2, (m[1] + c[1]) / 2], [c[0] * 0.85 + m[0] * 0.15, c[1] * 0.85 + m[1] * 0.15], wd); continue; }
      // the through pair: the most opposite (a house's gate never)
      let a = 0, b = 1, bc = Infinity;
      for (let x = 0; x < mids.length; x++) for (let y = x + 1; y < mids.length; y++) {
        const u = unit(c, mids[x].m), v = unit(c, mids[y].m), cs = u[0] * v[0] + u[1] * v[1] + (mids[x].house || mids[y].house ? 3 : 0);
        if (cs < bc) { bc = cs; a = x; b = y; }
      }
      const A = mids[a].m, B = mids[b].m;
      q(A, c, B, wd);
      for (let x = 0; x < mids.length; x++) {
        if (x === a || x === b) continue;
        const M = mids[x].m;
        // nearest point on the through curve (sampled)
        let best = null, bd = Infinity;
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const p = [(1 - t) ** 2 * A[0] + 2 * (1 - t) * t * c[0] + t * t * B[0], (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * c[1] + t * t * B[1]];
          const d = Math.hypot(p[0] - M[0], p[1] - M[1]);
          if (d < bd) { bd = d; best = p; }
        }
        const n = unit(M, c), ctl = [M[0] + n[0] * bd * 0.5, M[1] + n[1] * bd * 0.5];
        q(M, ctl, best, mids[x].house ? WIDTH.gate : wd, mids[x].house ? 2 : 3);
      }
    }
    // the gate's way on into the house's hex, to its yard
    for (const { h, door } of houses) {
      const hp = P(w, h), dp0 = P(w, door), m = [(hp[0] + dp0[0]) / 2, (hp[1] + dp0[1]) / 2], g = [hp[0] * 0.7 + m[0] * 0.3, hp[1] * 0.7 + m[1] * 0.3];
      q(m, [(m[0] + g[0]) / 2, (m[1] + g[1]) / 2], g, WIDTH.gate, 2);
    }
    return out;
  }

  // ---- to the game's curves, by tile ----
  function build(w) {
    const G = graph(w), ways = MODE === 'A' ? buildA(w, G) : buildB(w, G), R = w.R;
    const byTile = new Map(), chords = [];
    const owners = G.nodes; // tiles the page paints curves for (lanes and greens)
    const isOwner = new Uint8Array(w.N);
    for (const i of owners) isOwner[i] = 1;
    const ownerNear = (x, y) => {
      let best = -1, bd = Infinity;
      for (const i of owners) { const d = (w.hx[i] - x) ** 2 + (w.hy[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
      return best;
    };
    const put = (seg) => {
      const mx = (seg[0] + seg[4]) / 2, my = (seg[1] + seg[5]) / 2, i = ownerNear(mx, my);
      if (i < 0) return;
      if (!byTile.has(i)) byTile.set(i, []);
      byTile.get(i).push(seg);
      chords.push(seg);
    };
    for (const wy of ways) {
      if (wy.quad) {
        const [a, c, b] = wy.quad;
        put([a[0], a[1], c[0], c[1], b[0], b[1], wy.w, wy.stage]);
        continue;
      }
      const pts = wy.pts;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (0.8 * R)));
        for (let s = 0; s < n; s++) {
          const p = [a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n], r = [a[0] + ((b[0] - a[0]) * (s + 1)) / n, a[1] + ((b[1] - a[1]) * (s + 1)) / n];
          put([p[0], p[1], (p[0] + r[0]) / 2, (p[1] + r[1]) / 2, r[0], r[1], wy.w, wy.stage]);
        }
      }
    }
    return { byTile, chords, ways };
  }
  const get = (w) => {
    const s = sig(w);
    if (!cache || cache.sig !== s || cache.w !== w) cache = { sig: s, w, ...build(w) };
    return cache;
  };
  window.__roadsSeg = (w, i) => get(w).byTile.get(i) || [];
  window.__roadsChords = (w) => get(w).chords;
  // decorations off the roads: a tree whose foot is within the road's half width (and a little) is dropped
  window.__roadsThin = (w, items) => {
    const segs = get(w).chords;
    const d2 = (x, y, ax, ay, bx, by) => { const [q] = near([x, y], [ax, ay], [bx, by]); return (q[0] - x) ** 2 + (q[1] - y) ** 2; };
    let n = 0;
    for (const it of items) {
      let on = false;
      for (const g of segs) {
        const r2 = (g[6] / 2 + 3) ** 2, qx = (g[0] + 2 * g[2] + g[4]) / 4, qy = (g[1] + 2 * g[3] + g[5]) / 4;
        if (Math.abs(it.x - qx) > 60 || Math.abs(it.y - qy) > 60) continue;
        if (d2(it.x, it.y, g[0], g[1], qx, qy) < r2 || d2(it.x, it.y, qx, qy, g[4], g[5]) < r2) { on = true; break; }
      }
      if (!on) items[n++] = it;
    }
    items.length = n;
    return items;
  };
})();
