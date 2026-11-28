// @sys sim/routes: least-cost path searches and the daily invalidation of the run's bounded route cache, which keeps the routes no
// changed tile could have touched
VB['sim/routes'] = (() => {
  const { hexSteps } = VB['sim/hex'];
  const { through, gateMiss, stepCost, trailStep, discomfort, invalidateReach, recost, PATHS, DISCOMFORT } =
    VB['sim/walking'];
  const { SPEED } = VB['sim/rules'];
  // @tunable ROUTE: the route search's bounds and its cache
  // hours: the longest walk the villages' table and a pawn's route search reach (design.md, The journey scale: 67 hours, the far side of
  // the medium island; VB-444's plan, section 6); reach: the same bound in meadow steps, hours x SPEED (536), the dearest route searched
  // for (beyond it a pawn walks straight); minStep: the cheapest step there is, a lane over meadow. cacheMax: entries, first in first
  // out; the cache is emptied each day a tile changes cost (VB-236), and the most it held over 48 days after the first emptying was
  // 4,028 at medium-ref and 2,779 at small-y40: twice the larger, for a run of quiet days.
  // keepDays: the emptyings a route searched is set aside for, to be taken back if untouched (VB-1563): a bound on the log and on what
  // is set aside; it changes only how many searches are saved (16: tried at 1, 4, 8, 16 and 48, populous small, seed 7, task notes).
  const ROUTE = { cacheMax: 8000, hours: 67, reach: 67 * SPEED, minStep: 1 / PATHS.speed[3], keepDays: 16 };

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
        time: new Float64Array(w.N),
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
  VB.counter('routeSearch', 'A* searches started');
  VB.counter('routeExpand', 'Tiles removed from the A* heap (including duplicates)');
  // The route from `from` to `to` a walker of load class `cls` (sim/walking DISCOMFORT.load: 0 unladen, 1 on the back, 2 with a cart)
  // chooses, both ends included, or null when every route takes more than maxCost. It is the one least costly to choose (choiceCost:
  // its time weighed with its discomfort, VB-448), which with DISCOMFORT.weight 0 is the quickest; maxCost bounds its time, as before,
  // so that what is in reach does not move with the weight (a route is pruned by its time on the way the choice took to each tile).
  // The two ends may be closed tiles (a pawn stands where it stands; a job's site is where it is); every tile between is passable.
  // `step` is a step's time: stepCost, the ground as it stands, or sim/walking's trailStep for the route a trail would take (VB-447: a
  // wooded tile at a path's cost; its least step is a path's, above minStep, so the bound holds).
  function findRoute(w, from, to, maxCost = ROUTE.reach, cls = 0, step = stepCost) {
    if (from === to) return [from];
    VB.count.routeSearch++;
    let expanded = 0;
    const S = buffers(w),
      { g, prev, mark, shut, time } = S,
      run = ++S.run,
      open = heap(),
      lo = ROUTE.minStep,
      k = DISCOMFORT.weight * DISCOMFORT.load[cls];
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
    time[from] = 0;
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
        S.found = g[to]; // the route's key at the goal, its choice cost: what bounds the tiles this search popped (kept, below)
        return p.reverse();
      }
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run || (j !== to && !through(w, j)) || gateMiss(w, i, j)) continue; // a house's gate (VB-1951)
        const t = step(w, i, j),
          tj = time[i] + t,
          gj = g[i] + (k ? t * (1 + (k * (discomfort(w, i) + discomfort(w, j))) / 2) : t);
        if (tj > maxCost || (mark[j] === run && gj >= g[j])) continue;
        g[j] = gj;
        time[j] = tj;
        prev[j] = i;
        mark[j] = run;
        open.push(gj + h(j), j);
      }
    }
    VB.count.routeExpand += expanded;
    return null;
  }
  VB.counter(
    'reachSettled',
    'Tiles settled by the searches of the walking hours between villages (sim/routes reachCosts, VB-286)',
  );
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
        if (j < 0 || shut[j] === run || (tgt[j] !== run && !through(w, j)) || gateMiss(w, i, j)) continue;
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
  VB.counter(
    'settleReach',
    "Tiles settled by a crowded village's search for new land within SETTLE.hours along a trail, one a round where someone " +
      'leads (sim/routes trailReach, VB-786)',
  );
  // The cost from tile `from` to every passable tile within maxCost along a trail (VB-786; sim/walking trailStep: a wooded tile with no
  // path at a path's cost), by one bounded Dijkstra search as reachCosts's: a Map of tile to cost, `from` at 0, in the order settled. A
  // house is reached, never walked through. Reuses the world's scratch buffers and heap; the tiles it settles are counted in
  // VB.count.settleReach (one search a crowded village where someone leads, at its moving round: sim/settle).
  function trailReach(w, from, maxCost) {
    const S = buffers(w),
      { g, mark, shut } = S,
      run = ++S.run,
      open = S.open || (S.open = heap()),
      out = new Map();
    open.clear();
    g[from] = 0;
    mark[from] = run;
    open.push(0, from);
    while (open.size) {
      const i = open.pop();
      if (shut[i] === run) continue;
      shut[i] = run;
      out.set(i, g[i]);
      if (i !== from && !through(w, i)) continue;
      for (let d = 0; d < 6; d++) {
        const j = w.nb[i * 6 + d];
        if (j < 0 || shut[j] === run || !(through(w, j) || (w.dev && w.dev[j] === 3)) || gateMiss(w, i, j)) continue;
        const gj = g[i] + trailStep(w, i, j);
        if (gj > maxCost || (mark[j] === run && gj >= g[j])) continue;
        g[j] = gj;
        mark[j] = run;
        open.push(gj, j);
      }
    }
    VB.count.settleReach += out.size;
    return out;
  }
  // Cost of a route (a list of neighbouring tiles), by the costs in force now.
  function routeCost(w, p) {
    let c = 0;
    for (let s = 1; s < p.length; s++) c += stepCost(w, p[s - 1], p[s]);
    return c;
  }

  VB.counter('routeEvict', 'Cached routes evicted to enforce the bound (including legacy loads)');
  // ---- the cache: bounded, first in first out in Map order (oldest first), emptied each day a tile changed; the way back is the way there, reversed ----
  // Also used on load: pre-VB-198 saves may hold more entries than the current bound.
  function trimRoutes(st) {
    while (st.pathCache.size > ROUTE.cacheMax) {
      const k = st.pathCache.keys().next().value;
      st.pathCache.delete(k);
      costs(st).delete(k);
      VB.count.routeEvict++;
    }
  }
  // ---- the routes kept over the day's emptying (VB-1563) ----
  // A* pops only tiles whose key, the cost so far plus the bound to the goal, is at most the goal's own key, the route's choice cost C
  // (the heap's order is total: keys, then tile indexes). A tile t's key is at least (hexSteps(from, t) + hexSteps(t, to)) x minStep,
  // whatever the ground costs, since no step costs less. So when every tile changed since a route was searched has that bound above C,
  // no changed tile was popped then nor would be now, and a search now pops the same tiles in the same order: it finds the same route.
  // At the day's emptying the routes searched are set aside (st.routeKept), with the tiles changed that day (its log, one list an
  // emptying, for ROUTE.keepDays emptyings); a route set aside is taken back into the cache the first time it is asked for, once the test
  // has passed against every tile changed since its day (the log from there, and st.routeDirty): what is taken is what the search would
  // find, so nothing a walker does changes, only the searches saved. It is tested only when asked for: a test of every route set aside
  // at each emptying cost what it saved. A route from the way back reversed, a fallback, and a route from before a load (its cost not
  // known) are not set aside. st.routeKept and st.routeCosts are derived, not saved (sim/saves DERIVED): a run loaded searches again, and
  // finds the same routes.
  const costs = (st) => st.routeCosts || (st.routeCosts = new Map());
  const kept = (st) => st.routeKept || (st.routeKept = { routes: new Map(), log: [], today: new Map(), epoch: 0 });
  // The changed tiles, by cell of CELL x CELL tiles: a Map of cell to its tiles' axial coordinates, q and r in turn (sim/hex hexSteps's),
  // so that a route is tested only against the tiles changed near it, and the test grows with the routes, not with the island's changes.
  const CELL = 16;
  const qOf = (cols, i) => {
    const y = (i / cols) | 0;
    return (i % cols) - ((y - (y & 1)) >> 1);
  };
  function note(cells, cols, t) {
    const y = (t / cols) | 0,
      c = (y >> 4) * ((cols + CELL - 1) >> 4) + ((t % cols) >> 4),
      a = cells.get(c);
    if (a) a.push(qOf(cols, t), y);
    else cells.set(c, [qOf(cols, t), y]);
  }
  // Whether the route p, of choice cost c, is untouched by the changed tiles `cells` (above) of a world `cols` tiles wide: the bound above,
  // with a margin for rounding, in twice hexSteps so as to stay in integers. A tile within the bound is at most R = r2 / 2 steps from
  // either end, so within R rows of both and 1.5 R + 1 columns (offset rows shift by half a tile a row): only those cells are read.
  const LO2 = 2 / ROUTE.minStep;
  VB.counter(
    'routeCheck',
    'Changed tiles and cells read in testing a route set aside before it is taken back (sim/routes untouched, VB-1563)',
  );
  function untouched(cols, p, c, cells) {
    if (!cells.size) return true;
    const from = p[0],
      to = p[p.length - 1],
      fy = (from / cols) | 0,
      ty = (to / cols) | 0,
      fx = from % cols,
      tx = to % cols,
      fq = fx - ((fy - (fy & 1)) >> 1),
      tq = tx - ((ty - (ty & 1)) >> 1),
      r2 = (c * (1 + 1e-9) + 1e-9) * LO2,
      R = Math.ceil(r2 / 2),
      X = Math.ceil(1.5 * R) + 1,
      cw = (cols + CELL - 1) >> 4,
      y0 = Math.max(0, Math.max(fy, ty) - R) >> 4,
      y1 = (Math.min(fy, ty) + R) >> 4,
      x0 = Math.max(0, Math.max(fx, tx) - X) >> 4,
      x1 = Math.min(cols - 1, Math.min(fx, tx) + X) >> 4;
    const near = (at) => {
      VB.count.routeCheck += at.length >> 1;
      for (let k = 0; k < at.length; k += 2) {
        const aq = fq - at[k],
          ar = fy - at[k + 1],
          bq = at[k] - tq,
          br = at[k + 1] - ty;
        if (Math.abs(aq) + Math.abs(ar) + Math.abs(aq + ar) + Math.abs(bq) + Math.abs(br) + Math.abs(bq + br) <= r2)
          return true;
      }
      return false;
    };
    if (y1 < y0 || x1 < x0) return true;
    if ((y1 - y0 + 1) * (x1 - x0 + 1) > cells.size) {
      // fewer cells changed than the box holds: read those
      for (const [cell, at] of cells) {
        const cy = (cell / cw) | 0,
          cx = cell - cy * cw;
        VB.count.routeCheck++;
        if (cy >= y0 && cy <= y1 && cx >= x0 && cx <= x1 && near(at)) return false;
      }
      return true;
    }
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        VB.count.routeCheck++;
        const at = cells.get(cy * cw + cx);
        if (at && near(at)) return false;
      }
    return true;
  }
  VB.counter(
    'routeHit',
    'Routes served from the cache, in either direction, or taken back from the routes set aside at its emptying (VB-1563)',
  );
  // The route under key k set aside at an emptying, taken into the cache if untouched since, or null. Its entry: [path, cost, epoch],
  // the epoch the emptying's number; the log holds the emptyings from epoch - log.length + 1 to epoch, and `today` the tiles changed
  // since the last (st.routeDirty, by cell).
  function takeKept(st, k) {
    const K = st.routeKept,
      e = K && K.routes.get(k);
    if (!e) return null;
    K.routes.delete(k);
    const cols = st.w.COLS,
      first = K.epoch - K.log.length + 1;
    if (e[2] < first) return null;
    for (let i = e[2] - first; i < K.log.length; i++) if (!untouched(cols, e[0], e[1], K.log[i])) return null;
    if (!untouched(cols, e[0], e[1], K.today)) return null;
    VB.count.routeHit++;
    costs(st).set(k, e[1]);
    return e[0];
  }
  // A route just searched for: its cost noted, so that it can be set aside.
  function searched(st, k, p) {
    if (p.length > 1) costs(st).set(k, buffers(st.w).found);
  }
  // The route a walker of load class `cls` takes (findRoute), from the cache: keyed by the class as well while discomfort weighs (VB-448),
  // so a laden walk and an unladen one between the same tiles are two entries under the one bound; with DISCOMFORT.weight 0 every class
  // takes the quickest route, and shares one entry.
  function route(st, from, to, cls = 0) {
    const c = DISCOMFORT.weight ? cls : 0,
      N = st.w.N,
      o = c * N * N,
      k = o + from * N + to;
    let p = st.pathCache.get(k);
    if (p) {
      VB.count.routeHit++;
      return p;
    }
    const bk = o + to * N + from,
      back = st.pathCache.get(bk);
    if (back && back[0] === to) {
      VB.count.routeHit++;
      p = back.slice().reverse();
    } else if (!(p = takeKept(st, k))) {
      p = findRoute(st.w, from, to, ROUTE.reach, c);
      if (!p) {
        p = [to];
        st.routeFallbacks++;
      } else searched(st, k, p);
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
    const k = from * N + to;
    let found = takeKept(st, k);
    if (!found) {
      found = findRoute(st.w, from, to);
      if (!found) return false;
      searched(st, k, found);
    }
    st.pathCache.set(k, found);
    trimRoutes(st);
    return true;
  }
  // A tile whose walking cost changed (a felled wood turned meadow, a path that reached another stage): the cache is emptied at the end of
  // the day. Dropping only the routes the tile could change took as long as the searches it saved (VB-236): the late fixtures change a
  // tile on nearly every day, and the cache refills with a tenth of the routes held.
  const costChanged = (st, tile) => {
    if (!st.routeDirty.has(tile)) note(kept(st).today, st.w.COLS, tile);
    st.routeDirty.add(tile);
    recost(st.w, tile); // the compiled ground (sim/walking, VB-808)
    invalidateReach(st.w, tile);
  };
  VB.counter('routeRefresh', 'Cached routes tested for invalidation');
  // The ground of a band changed with the season (VB-808: a winter's date, sim/climate): the routes cached are emptied now, not at the
  // day's end, and none set aside is taken back (thousands of tiles changed at once).
  function groundChanged(st) {
    VB.count.routeRefresh += st.pathCache.size;
    st.pathCache.clear();
    st.routeCosts = null;
    st.routeKept = null;
    st.routeDirty.clear();
  }
  // Once a game day: when any tile changed cost, empty the cache (the straight-walk fallbacks with it), setting aside the routes searched
  // (above), newest last, with the day's changed tiles in the log; at most ROUTE.cacheMax routes, and none older than the log, the oldest
  // dropped first.
  function refreshRoutes(st) {
    if (!st.routeDirty.size) return;
    const K = kept(st),
      m = K.routes,
      c = costs(st),
      epoch = ++K.epoch;
    K.log.push(K.today);
    K.today = new Map();
    if (K.log.length > ROUTE.keepDays) K.log.shift();
    for (const [k, p] of st.pathCache) {
      const cost = c.get(k);
      if (cost === undefined) continue;
      m.delete(k);
      m.set(k, [p, cost, epoch]);
    }
    const first = epoch - K.log.length + 1;
    for (const [k, e] of m) {
      if (m.size <= ROUTE.cacheMax && e[2] >= first) break;
      m.delete(k);
    }
    VB.count.routeRefresh += st.pathCache.size;
    st.pathCache.clear();
    c.clear();
    st.routeDirty.clear();
  }

  return {
    ROUTE,
    findRoute,
    routeCost,
    reachCosts,
    trailReach,
    route,
    hasRoute,
    costChanged,
    groundChanged,
    refreshRoutes,
  };
})();
