// @sys sim/routes: least-cost path searches and the daily invalidation of the run's bounded route cache
VB['sim/routes'] = (() => {
  const { ROUTE } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { through, stepCost, invalidateReach } = VB['sim/walking'];

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

  // ---- the cache: bounded, first in first out in Map order (oldest first), emptied each day a tile changed; the way back is the way there, reversed ----
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
      return p;
    }
    const bk = to * N + from,
      back = st.pathCache.get(bk);
    if (back && back[0] === to) {
      VB.count.routeHit++;
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
  // Whether a pawn can walk from tile `from` to `to` by land within ROUTE.reach (VB-436): asked before an act sends it there, so that it
  // never walks a fallback's straight line. A route found is kept in the cache, which the walk then reads; none found is not kept and not
  // counted as a fallback (st.routeFallbacks counts walks, not questions).
  function hasRoute(st, from, to) {
    if (from === to) return true;
    const N = st.w.N,
      p = st.pathCache.get(from * N + to);
    if (p) return p[0] === from;
    const back = st.pathCache.get(to * N + from);
    if (back) return back[0] === to;
    const found = findRoute(st.w, from, to);
    if (!found) return false;
    st.pathCache.set(from * N + to, found);
    trimRoutes(st);
    return true;
  }
  // A tile whose walking cost changed (a felled wood turned meadow, a path that reached another stage): the cache is emptied at the end of
  // the day. Dropping only the routes the tile could change took as long as the searches it saved (VB-236): the late fixtures change a
  // tile on nearly every day, and the cache refills with a tenth of the routes held.
  const costChanged = (st, tile) => {
    st.routeDirty.add(tile);
    invalidateReach(st.w, tile);
  };
  // Once a game day: when any tile changed cost, empty the cache (the straight-walk fallbacks with it).
  function refreshRoutes(st) {
    if (!st.routeDirty.size) return;
    VB.count.routeRefresh += st.pathCache.size;
    st.pathCache.clear();
    st.routeDirty.clear();
  }

  return { findRoute, routeCost, reachCosts, route, hasRoute, costChanged, refreshRoutes };
})();
