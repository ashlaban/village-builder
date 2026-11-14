// @sys sim/routes: walking costs by terrain and slope, the route search (A*) and the route cache with its daily refresh
VB['sim/routes'] = (() => {
  const { TERRAIN, SLOPE, ROUTE, PATHS, SPEED } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { B } = VB['gen'];
  // ---- walking costs: a step costs the mean of the two tiles' costs and the slope between them, so a route costs the same both ways ----
  // Cost of walking across tile i, relative to meadow; Infinity where nobody walks (water, snowfields, a river away from its fords and
  // bridges, VB-112) and a house (w.dev 3): a walk starts or ends at a house and goes round the others, so the ways bend round
  // buildings (VB-402). Greens, fields and meadows cost 1. A worn tile is walked faster by its stage (VB-110), a field or meadow too;
  // the green (w.dev 2) wears no path.
  function tileCost(w, i, preference = false) {
    if (w.water[i]) return Infinity;
    let c;
    if (w.dev && w.dev[i]) {
      c = w.dev[i] === 3 ? Infinity : w.dev[i] === 1 && w.worn ? 1 / PATHS.speed[w.worn[i]] : 1;
    } else {
      c =
        w.river && w.river[i]
          ? w.crossing[i] === 1
            ? TERRAIN.ford
            : w.crossing[i] === 2
              ? TERRAIN.bridge
              : Infinity
          : (TERRAIN[w.biome[i]] ?? 1);
      if (w.worn) c /= PATHS.speed[w.worn[i]];
    }
    return preference && c < Infinity ? c * effortFactor(w, i) : c;
  }
  // A preference allowance grounded in surface-energy measurements, not an estimate of individual calorie use. Persistent
  // moisture is the generator's rainfall/valley-wetness proxy, not today's rain; st.weather is a harvest factor and is not read.
  function effortFactor(w, i) {
    const e = PATHS.effort;
    if (e.weight === 0 || (w.river && w.river[i] && w.crossing[i] === 2)) return 1;
    const developed = w.dev && w.dev[i],
      biome = w.biome[i],
      ground = developed ? e.firm : (e.ground[biome] ?? e.firm),
      excess = Math.max(0, ground - e.firm),
      soft = !developed && (biome === B.BEACH || biome === B.MARSH),
      remaining = developed === 2 ? 0 : e.remaining[w.worn ? w.worn[i] : 0],
      moisture = w.hm ? Math.min(1, Math.max(0, (w.hm[i] - e.wetAbove) / (1 - e.wetAbove))) : 0,
      wet = e.wetExtra * moisture;
    return 1 + e.weight * (e.firm - 1 + (soft ? Math.max(excess, wet) : excess * remaining + wet));
  }
  // Every route within a physical budget has choice cost below this conservative bound. The allowance never changes reach hours.
  const choiceBound = (budget) =>
    budget *
    (1 +
      PATHS.effort.weight *
        (Math.max(PATHS.effort.firm, ...Object.values(PATHS.effort.ground)) - 1 + PATHS.effort.wetExtra));
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
  const stepCost = (w, a, b, preference = false) => {
    const ca = tileCost(w, a, preference),
      cb = tileCost(w, b, preference);
    return (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) * slopeFactor(w, a, b);
  };

  const STRAIGHT = 1e-3; // see findRoute: what a tile's width off the straight line adds to a tile's key, in steps
  // ---- the search: A* (Hart, Nilsson and Raphael 1968) with the hex distance times the cheapest step as the bound ----
  // Scratch arrays per world, reused by every search. Compiled tile costs are stamped per search, so even direct edits during
  // generation, an editor session or load cannot leave stale terrain costs. Slope rows persist across searches, checked against
  // their endpoint heights before use. These derived buffers are not world/state truth and are never saved (VB-440).
  const scratch = new WeakMap();
  function buffers(w) {
    let s = scratch.get(w);
    if (!s) {
      s = {
        g: new Float64Array(w.N),
        time: new Float64Array(w.N),
        walking: new Float64Array(w.N),
        choice: new Float64Array(w.N),
        costMark: new Uint32Array(w.N),
        heights: new Float64Array(w.N).fill(NaN),
        slopeReady: new Uint8Array(w.N),
        slopes: null,
        heightmap: null,
        slopeRule: '',
        prev: new Int32Array(w.N),
        mark: new Uint32Array(w.N),
        shut: new Uint32Array(w.N),
        tgt: new Uint32Array(w.N),
        run: 0,
        open: null,
      };
      scratch.set(w, s);
    }
    const rule = `${SLOPE.tobler}/${SLOPE.grade}/${SLOPE.max}`;
    if (s.heightmap !== w.he || s.slopeRule !== rule) {
      s.heightmap = w.he;
      s.slopeRule = rule;
      s.slopeReady.fill(0);
      s.heights.fill(NaN);
      if (w.he && !s.slopes) s.slopes = new Float64Array(w.N * 6);
    }
    return s;
  }
  // Compile physical time and active effort preference separately. Movement reads physical cost; choice adds an effort allowance.
  // The stage speed bonus remains a physical-time rule; the obstruction term represents extra effort at a given walking pace.
  function compileTile(w, s, i) {
    if (s.costMark[i] === s.run) return;
    s.walking[i] = tileCost(w, i);
    s.choice[i] = s.walking[i] < Infinity ? s.walking[i] * effortFactor(w, i) : Infinity;
    s.costMark[i] = s.run;
    VB.count.routeCostTile++;
  }
  function checkHeight(w, s, i) {
    if (s.heights[i] === w.he[i]) return;
    s.heights[i] = w.he[i];
    s.slopeReady[i] = 0;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j >= 0) s.slopeReady[j] = 0;
    }
  }
  // Each expanded tile checks its seven heights. An unchanged row costs only lookups; a changed height invalidates neighbouring
  // rows too. Thus slopes compile at most once per row until relief/rules change, without relying on terrain-change notifications.
  function compileSlopes(w, s, i) {
    if (!w.he) return;
    checkHeight(w, s, i);
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j >= 0) checkHeight(w, s, j);
    }
    if (s.slopeReady[i]) return;
    let edges = 0;
    for (let d = 0; d < 6; d++) {
      const j = w.nb[i * 6 + d];
      if (j < 0) continue;
      s.slopes[i * 6 + d] = slopeFactor(w, i, j);
      edges++;
    }
    s.slopeReady[i] = 1;
    VB.count.routeSlopeEdge += edges;
  }
  // Same arithmetic as stepCost, including the meadow allowance for a closed endpoint. Choice points stay separate from time.
  const compiledStep = (w, s, costs, i, j, d) => {
    const ca = costs[i],
      cb = costs[j];
    return (((ca < Infinity ? ca : 1) + (cb < Infinity ? cb : 1)) / 2) * (w.he ? s.slopes[i * 6 + d] : 1);
  };
  // A binary heap: preference first, physical time second, straightness third, then tile index.
  function heap() {
    const k = [],
      n = [],
      time = [],
      straight = [];
    const less = (a, b) =>
      k[a] < k[b] ||
      (k[a] === k[b] &&
        (time[a] < time[b] ||
          (time[a] === time[b] && (straight[a] < straight[b] || (straight[a] === straight[b] && n[a] < n[b])))));
    const swap = (a, b) => {
      [k[a], k[b]] = [k[b], k[a]];
      [n[a], n[b]] = [n[b], n[a]];
      [time[a], time[b]] = [time[b], time[a]];
      [straight[a], straight[b]] = [straight[b], straight[a]];
    };
    return {
      get size() {
        return n.length;
      },
      clear() {
        k.length = 0;
        n.length = 0;
        time.length = 0;
        straight.length = 0;
      },
      push(key, tile, hours = 0, bias = 0) {
        let c = k.push(key) - 1;
        n.push(tile);
        time.push(hours);
        straight.push(bias);
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
          ln = n.pop(),
          lt = time.pop(),
          ls = straight.pop();
        if (n.length) {
          k[0] = lk;
          n[0] = ln;
          time[0] = lt;
          straight[0] = ls;
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
  // Prefer the least effort-adjusted cost. maxCost is still a physical walking budget in meadow-step units: if the preferred
  // route exceeds it, use the fastest feasible route instead. This preserves reach without a costly multi-label constrained search.
  // prefer=false is the physical fallback and the reference mode for diagnostics/tests.
  // The two ends may be closed tiles (a pawn stands where it stands; a job's site is where it is); every tile between is passable.
  function findRoute(w, from, to, maxCost = ROUTE.reach, prefer = true) {
    if (from === to) return [from];
    VB.count.routeSearch++;
    let expanded = 0;
    const S = buffers(w),
      { g, prev, mark, shut } = S,
      run = ++S.run,
      open = heap(),
      lo = ROUTE.minStep,
      limit = prefer ? choiceBound(maxCost) : maxCost;
    // Among routes that cost the same (on open ground there are many: every staircase between two tiles), the one nearest the straight
    // line is taken: STRAIGHT times its offset is a tertiary tie-break, after choice and physical time. It never inflates the
    // admissible heuristic or overrides a cheaper route. This concentrates equal-cost trips without changing their objective (VB-441).
    const flat = !!w.hx,
      fx = flat ? w.hx[from] : 0,
      fy = flat ? w.hy[from] : 0,
      lx = flat ? w.hx[to] - fx : 0,
      ly = flat ? w.hy[to] - fy : 0;
    const off = flat ? STRAIGHT / ((Math.hypot(lx, ly) || 1) * w.HW) : 0; // a world with no tile centres (a test's bare grid) has no line
    const h = (i) => hexSteps(w, i, to) * lo;
    const bias = (i) => (flat ? Math.abs((w.hx[i] - fx) * ly - (w.hy[i] - fy) * lx) * off : 0);
    g[from] = 0;
    S.time[from] = 0;
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
        p.reverse();
        if (prefer && S.time[to] > maxCost) {
          VB.count.routeBudgetFallback++;
          return findRoute(w, from, to, maxCost, false);
        }
        return p;
      }
      compileTile(w, S, i);
      compileSlopes(w, S, i);
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run) continue;
        compileTile(w, S, j);
        if (j !== to && S.walking[j] === Infinity) continue;
        const time = S.time[i] + compiledStep(w, S, S.walking, i, j, d),
          gj = g[i] + compiledStep(w, S, prefer ? S.choice : S.walking, i, j, d);
        if (gj > limit || (mark[j] === run && (gj > g[j] || (gj === g[j] && time >= S.time[j])))) continue;
        g[j] = gj;
        S.time[j] = time;
        prev[j] = i;
        mark[j] = run;
        open.push(gj + h(j), j, time + h(j), bias(j));
      }
    }
    VB.count.routeExpand += expanded;
    return null;
  }
  // The cheapest cost from tile `from` to each of the tiles `targets` (a list), by one Dijkstra search over passable tiles: the cost to
  // targets[i] goes to out[i], or null when it lies beyond maxCost or cannot be reached. The search stops at maxCost, or once every target is
  // settled. As in findRoute, `from` and the targets may be closed tiles (a closed target is reached, never walked through). It reuses the
  // world's scratch buffers and one heap, and allocates nothing per tile; the tiles it settles are counted in VB.count.reachSettled.
  // Output is physical walking cost along preferred routes, never preference points. A fastest-route fallback for targets whose
  // preferred route exceeds maxCost preserves the physical reach budget, as in findRoute. Equal choice costs prefer less walking.
  function reachCosts(w, from, maxCost, targets, out = new Array(targets.length), prefer = true) {
    const S = buffers(w),
      { g, mark, shut, tgt } = S,
      run = ++S.run,
      open = S.open || (S.open = heap()),
      limit = prefer ? choiceBound(maxCost) : maxCost;
    let left = 0,
      settled = 0;
    for (let i = 0; i < targets.length; i++)
      if (tgt[targets[i]] !== run) {
        tgt[targets[i]] = run;
        left++;
      }
    open.clear();
    g[from] = 0;
    S.time[from] = 0;
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
      compileTile(w, S, i);
      compileSlopes(w, S, i);
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run) continue;
        compileTile(w, S, j);
        if (tgt[j] !== run && S.walking[j] === Infinity) continue;
        const time = S.time[i] + compiledStep(w, S, S.walking, i, j, d),
          gj = g[i] + compiledStep(w, S, prefer ? S.choice : S.walking, i, j, d);
        if (gj > limit || (mark[j] === run && (gj > g[j] || (gj === g[j] && time >= S.time[j])))) continue;
        g[j] = gj;
        S.time[j] = time;
        mark[j] = run;
        open.push(gj, j, time);
      }
    }
    VB.count.reachSettled += settled;
    const fallback = [],
      slots = [];
    for (let i = 0; i < targets.length; i++) {
      out[i] = shut[targets[i]] === run ? S.time[targets[i]] : null;
      if (prefer && out[i] > maxCost) {
        fallback.push(targets[i]);
        slots.push(i);
      }
    }
    if (fallback.length) {
      VB.count.routeBudgetFallback += fallback.length;
      const times = reachCosts(w, from, maxCost, fallback, undefined, false);
      for (let i = 0; i < slots.length; i++) out[slots[i]] = times[i];
    }
    return out;
  }
  // Cost of a route (a list of neighbouring tiles), by the costs in force now.
  function routeCost(w, p, preference = false) {
    let c = 0;
    for (let s = 1; s < p.length; s++) c += stepCost(w, p[s - 1], p[s], preference);
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
  // A tile whose time or effort cost changed (a felled wood, a new path stage, edited moisture): the routes it could change
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
      maxChoiceStep = choiceBound(MAX_STEP),
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
      if (near > (steps * maxChoiceStep) / ROUTE.minStep + 1) continue;
      // Bounded journeys can use the physical fallback. Invalidation must cover both objectives, including newly attractive
      // tiles outside the old route. Choice cost bounds physical cost from above, so it is conservative for either selection.
      if (near < steps - 1 || near <= routeCost(w, p, true) / ROUTE.minStep) st.pathCache.delete(k);
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
