// @sys sim/routes: walking costs by terrain, the route search (A*) and the route cache with its daily refresh
VB['sim/routes'] = (() => {
  const { TERRAIN, ROUTE, PATHS } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  // ---- walking costs: a step costs the mean of the two tiles' costs, so a route costs the same both ways ----
  // Cost of walking across tile i, relative to meadow; Infinity where nobody walks (water, snowfields, a river away from its fords and
  // bridges, VB-112). Houses and fields cost 1. A worn tile is walked faster by its stage (VB-110).
  function tileCost(w, i) {
    if (w.water[i]) return Infinity;
    if (w.dev && w.dev[i]) return 1;
    const c = w.river && w.river[i] ? (w.crossing[i] === 1 ? TERRAIN.ford : w.crossing[i] === 2 ? TERRAIN.bridge : Infinity) : TERRAIN[w.biome[i]] ?? 1;
    return w.worn ? c / PATHS.speed[w.worn[i]] : c;
  }
  const passable = (w, i) => i >= 0 && tileCost(w, i) < Infinity;
  // The rule for breadth-first searches of what is in walking reach (sim/hex bfs): passable tiles only.
  const walkable = (w) => (j) => passable(w, j);
  // Cost of the step between neighbouring tiles a and b; a closed end (where a route starts or ends) counts as meadow.
  const stepCost = (w, a, b) => {
    const ca = tileCost(w, a), cb = tileCost(w, b);
    return ((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2;
  };

  // ---- the search: A* (Hart, Nilsson and Raphael 1968) with the hex distance times the cheapest step as the bound ----
  // Scratch arrays per world, reused by every search: g (cost so far), prev, and the search that last touched each tile (mark).
  const scratch = new WeakMap();
  function buffers(w) {
    let s = scratch.get(w);
    if (!s) { s = { g: new Float64Array(w.N), prev: new Int32Array(w.N), mark: new Uint32Array(w.N), shut: new Uint32Array(w.N), run: 0 }; scratch.set(w, s); }
    return s;
  }
  // A binary heap of tiles by key, in two plain arrays; the lower key first, ties by the lower tile index.
  function heap() {
    const k = [], n = [];
    const less = (a, b) => k[a] < k[b] || (k[a] === k[b] && n[a] < n[b]);
    const swap = (a, b) => { [k[a], k[b]] = [k[b], k[a]]; [n[a], n[b]] = [n[b], n[a]]; };
    return {
      get size() { return n.length; },
      push(key, tile) {
        let c = k.push(key) - 1; n.push(tile);
        while (c > 0) { const p = (c - 1) >> 1; if (!less(c, p)) break; swap(c, p); c = p; }
      },
      pop() {
        const top = n[0], lk = k.pop(), ln = n.pop();
        if (n.length) {
          k[0] = lk; n[0] = ln;
          for (let c = 0; ;) {
            const l = 2 * c + 1, r = l + 1;
            let m = c;
            if (l < n.length && less(l, m)) m = l;
            if (r < n.length && less(r, m)) m = r;
            if (m === c) break;
            swap(c, m); c = m;
          }
        }
        return top;
      },
    };
  }
  // The cheapest route from `from` to `to`, both ends included, or null when every route costs more than maxCost.
  // The two ends may be closed tiles (a pawn stands where it stands; a job's site is where it is); every tile between is passable.
  function findRoute(w, from, to, maxCost = ROUTE.reach) {
    if (from === to) return [from];
    const S = buffers(w), { g, prev, mark, shut } = S, run = ++S.run, open = heap(), lo = ROUTE.minStep;
    const h = (i) => hexSteps(w, i, to) * lo;
    g[from] = 0; prev[from] = -1; mark[from] = run; open.push(h(from), from);
    while (open.size) {
      const i = open.pop();
      if (shut[i] === run) continue;
      shut[i] = run;
      if (i === to) {
        const p = [to]; for (let j = prev[to]; j >= 0; j = prev[j]) p.push(j);
        return p.reverse();
      }
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run || (j !== to && !passable(w, j))) continue;
        const gj = g[i] + stepCost(w, i, j);
        if (gj > maxCost || (mark[j] === run && gj >= g[j])) continue;
        g[j] = gj; prev[j] = i; mark[j] = run;
        open.push(gj + h(j), j);
      }
    }
    return null;
  }
  // Cost of a route (a list of neighbouring tiles), by the costs in force now.
  function routeCost(w, p) {
    let c = 0;
    for (let s = 1; s < p.length; s++) c += stepCost(w, p[s - 1], p[s]);
    return c;
  }

  // ---- the cache: one route per pair of tiles; the way back is the way there, reversed ----
  function route(st, from, to) {
    const N = st.w.N, k = from * N + to;
    let p = st.pathCache.get(k);
    if (p) return p;
    const back = st.pathCache.get(to * N + from);
    if (back && back[0] === to) p = back.slice().reverse();
    else {
      p = findRoute(st.w, from, to);
      if (!p) { p = [to]; st.routeFallbacks++; }
    }
    st.pathCache.set(k, p);
    return p;
  }
  // A tile whose walking cost changed (a felled wood turned meadow, a path that reached another stage): the routes it could change
  // are dropped at the end of the day.
  const costChanged = (st, tile) => { st.routeDirty.add(tile); };
  // Once a game day: drop the cached routes that a changed tile might now shorten or lengthen, and every straight-walk fallback.
  // A route by tile t costs at least (steps from the start to t + steps from t to the end) times the cheapest step,
  // so a route that costs less than that cannot change because of t.
  // The test is skipped where its outcome is certain without the route's cost: a route of n steps costs at least n minSteps, and at most n
  // times the dearest step (MAX_STEP), so a changed tile nearer than n - 1 always drops it and one beyond n * MAX_STEP / minStep never does.
  // The changed tiles' hex coordinates are worked out once, not once per route (hexSteps in sim/hex, unrolled).
  const MAX_STEP = Math.max(...Object.values(TERRAIN).filter((c) => c < Infinity)) / PATHS.speed[0];
  function refreshRoutes(st) {
    if (!st.routeDirty.size) return;
    const w = st.w, N = w.N, C = w.COLS, n = st.routeDirty.size, dq = new Int32Array(n), dr = new Int32Array(n);
    let i = 0;
    for (const t of st.routeDirty) { const y = (t / C) | 0; dq[i] = (t % C) - ((y - (y & 1)) >> 1); dr[i] = y; i++; }
    const qOf = (t) => { const y = (t / C) | 0; return (t % C) - ((y - (y & 1)) >> 1); };
    for (const [k, p] of st.pathCache) {
      const to = k % N, from = (k - to) / N;
      if (p.length === 1 && from !== to) { st.pathCache.delete(k); continue; }
      const fq = qOf(from), fr = (from / C) | 0, tq = qOf(to), tr = (to / C) | 0;
      let near = Infinity; // the least hexSteps(from, t) + hexSteps(t, to) over the changed tiles t
      for (let j = 0; j < n; j++) {
        const a = fq - dq[j], b = fr - dr[j], c = dq[j] - tq, d = dr[j] - tr;
        const s = (Math.abs(a) + Math.abs(b) + Math.abs(a + b) + Math.abs(c) + Math.abs(d) + Math.abs(c + d)) / 2;
        if (s < near) near = s;
      }
      const steps = p.length - 1;
      if (near > (steps * MAX_STEP) / ROUTE.minStep + 1) continue;
      if (near < steps - 1 || near <= routeCost(w, p) / ROUTE.minStep) st.pathCache.delete(k);
    }
    st.routeDirty.clear();
  }
  return { tileCost, passable, walkable, stepCost, findRoute, routeCost, route, costChanged, refreshRoutes };
})();
