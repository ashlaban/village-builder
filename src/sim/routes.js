// @sys sim/routes: walking costs by terrain and slope, the route search (A*) and the route cache with its daily refresh
VB['sim/routes'] = (() => {
  const { TERRAIN, SLOPE, ROUTE, PATHS, SPEED } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  // ---- walking costs: a step costs the mean of the two tiles' costs and the slope between them, so a route costs the same both ways ----
  // Cost of walking across tile i, relative to meadow; Infinity where nobody walks (water, snowfields, a river away from its fords and
  // bridges, VB-112) and a house (w.dev 3): a walk starts or ends at a house and goes round the others, so the ways bend round
  // buildings (VB-402). Greens, fields and meadows cost 1. A worn tile is walked faster by its stage (VB-110), a field or meadow too,
  // and its wear takes away a share of what its ground costs above meadow (PATHS.clear, VB-439; not at a ford or on a bridge);
  // the green (w.dev 2) wears no path.
  function tileCost(w, i) {
    if (w.water[i]) return Infinity;
    if (w.dev && w.dev[i]) return w.dev[i] === 3 ? Infinity : w.dev[i] === 1 && w.worn ? 1 / PATHS.speed[w.worn[i]] : 1;
    const c =
        w.river && w.river[i]
          ? w.crossing[i] === 1
            ? TERRAIN.ford
            : w.crossing[i] === 2
              ? TERRAIN.bridge
              : Infinity
          : 0,
      s = w.worn ? w.worn[i] : 0;
    if (c) return c / PATHS.speed[s];
    return (1 + ((TERRAIN[w.biome[i]] ?? 1) - 1) * (1 - PATHS.clear[s])) / PATHS.speed[s];
  }
  // Land a pawn can stand on: what is in walking reach counts steps over it, a house too (the reach searches of sim/hex end at houses).
  const passable = (w, i) => i >= 0 && (tileCost(w, i) < Infinity || (!!w.dev && w.dev[i] === 3));
  // Land a route may cross: passable, and not a house.
  const through = (w, i) => i >= 0 && tileCost(w, i) < Infinity;
  // The rule for breadth-first searches of what is in walking reach (sim/hex bfs): passable tiles only.
  const walkable = (w) => (j) => passable(w, j);
  // What the slope of the step between a and b multiplies its cost by: Tobler's hiking function made symmetric around the flat (VB-438),
  // exp(SLOPE.tobler |S|) for the slope S = SLOPE.grade times the elevation between them, up or down alike (so the way back costs what
  // the way there does), at most SLOPE.max; 1 on the level. Water lies at sea level; a worn path does not flatten a slope.
  const slopeFactor = (w, a, b) => {
    if (!w.he) return 1;
    const ha = w.he[a],
      hb = w.he[b],
      rise = Math.abs((ha > 0 ? ha : 0) - (hb > 0 ? hb : 0));
    if (rise === 0) return 1;
    const f = Math.exp(SLOPE.tobler * SLOPE.grade * rise);
    return f < SLOPE.max ? f : SLOPE.max;
  };
  // Cost of the step between neighbouring tiles a and b: the mean of their costs times the slope's factor; a closed end (where a
  // route starts or ends) counts as meadow.
  const stepCost = (w, a, b) => {
    const ca = tileCost(w, a),
      cb = tileCost(w, b);
    return (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) * slopeFactor(w, a, b);
  };

  const STRAIGHT = 1e-3; // see findRoute: what a tile's width off the straight line adds to a tile's key, in steps
  // ---- the search: A* (Hart, Nilsson and Raphael 1968) with the hex distance times the cheapest step as the bound ----
  // Scratch arrays per world, reused by every search: g (cost so far), prev, and the search that last touched each tile (mark).
  const scratch = new WeakMap();
  function buffers(w) {
    let s = scratch.get(w);
    if (!s) {
      s = {
        g: new Float64Array(w.N),
        prev: new Int32Array(w.N),
        mark: new Uint32Array(w.N),
        shut: new Uint32Array(w.N),
        tgt: new Uint32Array(w.N),
        run: 0,
        open: null,
      };
      scratch.set(w, s);
    }
    return s;
  }
  // A binary heap of tiles by key, in two plain arrays; the lower key first, ties by the lower tile index.
  function heap() {
    const k = [],
      n = [];
    const less = (a, b) => k[a] < k[b] || (k[a] === k[b] && n[a] < n[b]);
    const swap = (a, b) => {
      [k[a], k[b]] = [k[b], k[a]];
      [n[a], n[b]] = [n[b], n[a]];
    };
    return {
      get size() {
        return n.length;
      },
      clear() {
        k.length = 0;
        n.length = 0;
      },
      push(key, tile) {
        let c = k.push(key) - 1;
        n.push(tile);
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (!less(c, p)) break;
          swap(c, p);
          c = p;
        }
      },
      pop() {
        const top = n[0],
          lk = k.pop(),
          ln = n.pop();
        if (n.length) {
          k[0] = lk;
          n[0] = ln;
          for (let c = 0; ;) {
            const l = 2 * c + 1,
              r = l + 1;
            let m = c;
            if (l < n.length && less(l, m)) m = l;
            if (r < n.length && less(r, m)) m = r;
            if (m === c) break;
            swap(c, m);
            c = m;
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
    VB.count.routeSearch++;
    let expanded = 0;
    const S = buffers(w),
      { g, prev, mark, shut } = S,
      run = ++S.run,
      open = heap(),
      lo = ROUTE.minStep;
    // Among routes that cost the same (on open ground there are many: every staircase between two tiles), the one nearest the straight
    // line is taken, as people walk: STRAIGHT of a step for each tile's width a tile lies off the line is added to its key, far below
    // any difference in cost. So the trips between two places wear one line, not a fan of them, and the ways look like ways (VB-402).
    const flat = !!w.hx,
      fx = flat ? w.hx[from] : 0,
      fy = flat ? w.hy[from] : 0,
      lx = flat ? w.hx[to] - fx : 0,
      ly = flat ? w.hy[to] - fy : 0;
    const off = flat ? STRAIGHT / ((Math.hypot(lx, ly) || 1) * w.HW) : 0; // a world with no tile centres (a test's bare grid) has no line
    const h = (i) => hexSteps(w, i, to) * lo + (flat ? Math.abs((w.hx[i] - fx) * ly - (w.hy[i] - fy) * lx) * off : 0);
    g[from] = 0;
    prev[from] = -1;
    mark[from] = run;
    open.push(h(from), from);
    while (open.size) {
      const i = open.pop();
      expanded++;
      if (shut[i] === run) continue;
      shut[i] = run;
      if (i === to) {
        const p = [to];
        for (let j = prev[to]; j >= 0; j = prev[j]) p.push(j);
        VB.count.routeExpand += expanded;
        return p.reverse();
      }
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run || (j !== to && !through(w, j))) continue;
        const gj = g[i] + stepCost(w, i, j);
        if (gj > maxCost || (mark[j] === run && gj >= g[j])) continue;
        g[j] = gj;
        prev[j] = i;
        mark[j] = run;
        open.push(gj + h(j), j);
      }
    }
    VB.count.routeExpand += expanded;
    return null;
  }
  // The cheapest cost from tile `from` to each of the tiles `targets` (a list), by one Dijkstra search over passable tiles: the cost to
  // targets[i] goes to out[i], or null when it lies beyond maxCost or cannot be reached. The search stops at maxCost, or once every target is
  // settled. As in findRoute, `from` and the targets may be closed tiles (a closed target is reached, never walked through). It reuses the
  // world's scratch buffers and one heap, and allocates nothing per tile; the tiles it settles are counted in VB.count.reachSettled.
  // The costs are findRoute + routeCost's, to rounding (the sums are made the same way, from `from`).
  function reachCosts(w, from, maxCost, targets, out = new Array(targets.length)) {
    const S = buffers(w),
      { g, mark, shut, tgt } = S,
      run = ++S.run,
      open = S.open || (S.open = heap());
    let left = 0,
      settled = 0;
    for (let i = 0; i < targets.length; i++)
      if (tgt[targets[i]] !== run) {
        tgt[targets[i]] = run;
        left++;
      }
    open.clear();
    g[from] = 0;
    mark[from] = run;
    open.push(0, from);
    while (open.size && left > 0) {
      const i = open.pop();
      if (shut[i] === run) continue;
      shut[i] = run;
      settled++;
      if (tgt[i] === run) {
        if (--left === 0) break;
        if (i !== from && !through(w, i)) continue;
      }
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run || (tgt[j] !== run && !through(w, j))) continue;
        const gj = g[i] + stepCost(w, i, j);
        if (gj > maxCost || (mark[j] === run && gj >= g[j])) continue;
        g[j] = gj;
        mark[j] = run;
        open.push(gj, j);
      }
    }
    VB.count.reachSettled += settled;
    for (let i = 0; i < targets.length; i++) out[i] = shut[targets[i]] === run ? g[targets[i]] : null;
    return out;
  }
  // Cost of a route (a list of neighbouring tiles), by the costs in force now.
  function routeCost(w, p) {
    let c = 0;
    for (let s = 1; s < p.length; s++) c += stepCost(w, p[s - 1], p[s]);
    return c;
  }

  // ---- the cache: bounded LRU in Map order (oldest first); the way back is the way there, reversed ----
  // Also used on load: pre-VB-198 saves may hold more entries than the current bound.
  function trimRoutes(st) {
    while (st.pathCache.size > ROUTE.cacheMax) {
      st.pathCache.delete(st.pathCache.keys().next().value);
      VB.count.routeEvict++;
    }
  }
  function route(st, from, to) {
    const N = st.w.N,
      k = from * N + to;
    let p = st.pathCache.get(k);
    if (p) {
      VB.count.routeHit++;
      st.pathCache.delete(k);
      st.pathCache.set(k, p);
      return p;
    }
    const bk = to * N + from,
      back = st.pathCache.get(bk);
    if (back && back[0] === to) {
      VB.count.routeHit++;
      st.pathCache.delete(bk);
      st.pathCache.set(bk, back);
      p = back.slice().reverse();
    } else {
      p = findRoute(st.w, from, to);
      if (!p) {
        p = [to];
        st.routeFallbacks++;
      }
    }
    st.pathCache.set(k, p);
    trimRoutes(st);
    return p;
  }
  // A tile whose walking cost changed (a felled wood turned meadow, a path that reached another stage): the routes it could change
  // are dropped at the end of the day.
  const costChanged = (st, tile) => {
    st.routeDirty.add(tile);
  };
  // Once a game day: drop the cached routes that a changed tile might now shorten or lengthen, and every straight-walk fallback.
  // A route by tile t costs at least (steps from the start to t + steps from t to the end) times the cheapest step,
  // so a route that costs less than that cannot change because of t.
  // The test is skipped where its outcome is certain without the route's cost: a route of n steps costs at least n minSteps, and at most n
  // times the dearest step (MAX_STEP, the dearest terrain on the steepest slope), so a changed tile nearer than n - 1 always drops it and
  // one beyond n * MAX_STEP / minStep never does.
  // The changed tiles' hex coordinates are worked out once, not once per route (hexSteps in sim/hex, unrolled).
  const MAX_STEP = (Math.max(...Object.values(TERRAIN).filter((c) => c < Infinity)) / PATHS.speed[0]) * SLOPE.max;
  function refreshRoutes(st) {
    if (!st.routeDirty.size) return;
    const w = st.w,
      N = w.N,
      C = w.COLS,
      n = st.routeDirty.size,
      dq = new Int32Array(n),
      dr = new Int32Array(n);
    let i = 0;
    for (const t of st.routeDirty) {
      const y = (t / C) | 0;
      dq[i] = (t % C) - ((y - (y & 1)) >> 1);
      dr[i] = y;
      i++;
    }
    const qOf = (t) => {
      const y = (t / C) | 0;
      return (t % C) - ((y - (y & 1)) >> 1);
    };
    VB.count.routeRefresh += st.pathCache.size;
    for (const [k, p] of st.pathCache) {
      const to = k % N,
        from = (k - to) / N;
      if (p.length === 1 && from !== to) {
        st.pathCache.delete(k);
        continue;
      }
      const fq = qOf(from),
        fr = (from / C) | 0,
        tq = qOf(to),
        tr = (to / C) | 0;
      let near = Infinity; // the least hexSteps(from, t) + hexSteps(t, to) over the changed tiles t
      for (let j = 0; j < n; j++) {
        const a = fq - dq[j],
          b = fr - dr[j],
          c = dq[j] - tq,
          d = dr[j] - tr;
        const s = (Math.abs(a) + Math.abs(b) + Math.abs(a + b) + Math.abs(c) + Math.abs(d) + Math.abs(c + d)) / 2;
        if (s < near) near = s;
      }
      const steps = p.length - 1;
      if (near > (steps * MAX_STEP) / ROUTE.minStep + 1) continue;
      if (near < steps - 1 || near <= routeCost(w, p) / ROUTE.minStep) st.pathCache.delete(k);
    }
    st.routeDirty.clear();
  }

  // ---- walking hours between villages (VB-286) ----
  // @state st.villageHours: array, a row for each village id, each of length the number of villages; row[u] the walking hours from village v's
  //   green (its centre) to u's, by the route search's costs over SPEED, or null beyond ROUTE.reach or with no route by land; the diagonal 0.
  //   Symmetric, as the costs are. Compiled a village a step by the calendar (autumn day 9), and at once for a village founded
  //   (sim/routes). Nothing reads it yet: hoursBetween (VB-287, VB-288, VB-290).
  // Village k's row, and column k of every other row, from one search of the villages' centres.
  function refreshHoursRow(st, k) {
    const T = st.villageHours,
      vs = st.villages;
    if (!T || T.length !== vs.length || k >= vs.length) return;
    const targets = vs.map((v) => v.center),
      costs = reachCosts(st.w, vs[k].center, ROUTE.reach, targets),
      row = T[k];
    for (let u = 0; u < costs.length; u++) {
      const h = u === k ? 0 : costs[u] === null ? null : costs[u] / SPEED;
      row[u] = h;
      T[u][k] = h;
    }
  }
  // The whole table: at the seed, and at a load of a save made before it.
  function buildHours(st) {
    const n = st.villages.length;
    st.villageHours = Array.from({ length: n }, () => new Array(n).fill(null));
    for (let k = 0; k < n; k++) refreshHoursRow(st, k);
  }
  // A village was added to st.villages: the table grows by a row and a column, and the new row is found at once.
  function villageAdded(st) {
    if (!st.villageHours) return;
    for (const row of st.villageHours) row.push(null);
    st.villageHours.push(new Array(st.villages.length).fill(null));
    refreshHoursRow(st, st.villages.length - 1);
  }
  // The calendar's entry, autumn day 9 from noon (sim/clock): on step j of the 60 from noon, the rows of the villages k with
  // floor(k * 60 / villages) = j (village j itself while there are 60 or fewer).
  const ROW_STEPS = 60;
  function refreshHoursStep(st, j) {
    const n = st.villages.length;
    if (n <= ROW_STEPS) {
      if (j < n) refreshHoursRow(st, j);
      return;
    }
    for (
      let k = Math.floor((j * n + ROW_STEPS - 1) / ROW_STEPS),
        end = Math.floor(((j + 1) * n + ROW_STEPS - 1) / ROW_STEPS);
      k < end;
      k++
    )
      refreshHoursRow(st, k);
  }
  // Walking hours between two villages' greens: 0 for the same village, Infinity beyond reach or by no land route. Allocates nothing.
  function hoursBetween(st, a, b) {
    if (a === b) return 0;
    const h = st.villageHours[a][b];
    return h === null ? Infinity : h;
  }
  return {
    tileCost,
    passable,
    walkable,
    slopeFactor,
    stepCost,
    findRoute,
    routeCost,
    reachCosts,
    route,
    costChanged,
    refreshRoutes,
    trimRoutes,
    buildHours,
    villageAdded,
    refreshHoursStep,
    hoursBetween,
    ROW_STEPS,
  };
})();
