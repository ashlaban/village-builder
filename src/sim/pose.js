// @sys sim/pose: where a pawn is, read only: the tile at a map point, and a walker's place, pose and hours left, worked out from its leg
// (sim/legs) at any moment between its start and its end, and its bed; split from sim/agents (VB-422)
VB['sim/pose'] = (() => {
  const { TICKS } = VB['sim/rules'];
  const { workTick } = VB['sim/progress'];
  // The tile at map point (x, y), or -1 off the map.
  function tileAt(st, x, y) {
    const w = st.w,
      R = w.R,
      HW = w.HW,
      AP = w.AP;
    const px = x - AP,
      py = y - R,
      qf = ((Math.sqrt(3) / 3) * px - py / 3) / R,
      rf = ((2 / 3) * py) / R,
      sf = -qf - rf;
    let q = Math.round(qf),
      r = Math.round(rf),
      s = Math.round(sf);
    const dq = Math.abs(q - qf),
      dr = Math.abs(r - rf),
      ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    const col = q + ((r - (r & 1)) >> 1);
    return r >= 0 && r < w.ROWS && col >= 0 && col < w.COLS ? r * w.COLS + col : -1;
  }
  // The tile the pawn is on now (placeOf: a walker along its leg).
  const here = (st, a) => {
    const [x, y] = placeOf(st, a);
    return tileAt(st, x, y);
  };
  // The tile the pawn's walk ends on (the last point of a.path).
  const endTile = (st, a) => {
    const p = a.path[a.path.length - 1];
    return tileAt(st, p[0], p[1]);
  };
  // How far walk leg l has come e hours after its start: [the last path point passed, x, y].
  function along(a, l, e) {
    const h = l.h,
      P = a.path;
    if (!(e > 0) || !h.length) return [l.seg, l.x, l.y];
    if (e >= h[h.length - 1]) {
      const p = P[P.length - 1];
      return [P.length - 1, p[0], p[1]];
    }
    let lo = 0,
      hi = h.length - 1; // the first point not yet reached: h[lo] > e (halving: Rules for cost)
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (h[m] <= e) lo = m + 1;
      else hi = m;
    }
    const i = l.seg + 1 + lo,
      h0 = lo > 0 ? h[lo - 1] : 0,
      p0 = lo > 0 ? P[i - 1] : [l.x, l.y],
      p1 = P[i],
      r = h[lo] > h0 ? (e - h0) / (h[lo] - h0) : 0;
    return [i - 1, p0[0] + (p1[0] - p0[0]) * r, p0[1] + (p1[1] - p0[1]) * r];
  }
  // Where the pawn is now, worked out from its leg: for a walk, the hours since its start along its route; else where it stands (a pawn at
  // work stands at its task's spot: the rows of a field are the page's).
  function placeOf(st, a) {
    const l = a.leg;
    if (!a.path || !l || l.kind !== 'walk') return [a.x, a.y];
    VB.count.walkPlace++;
    const [, x, y] = along(a, l, (workTick(st) - l.t) / TICKS);
    return [x, y];
  }
  // The way the pawn faces and the stride it has come to, e hours into walk leg l, standing at point i, (x, y) (the page's pose).
  function poseAt(a, l, e, i, x, y) {
    const P = a.path,
      dx = i + 1 < P.length ? P[i + 1][0] - x : x - (i > l.seg ? P[i - 1][0] : l.x);
    return [x, y, Math.abs(dx) > 0.3 ? Math.sign(dx) : a.face, (a.stride || 0) + (e * l.pace) / 3.4];
  }
  // Walk leg l ends e hours in (its end, a cut, a journey's night): the tiles entered so far are trodden, and the pawn stands where its
  // The hours a walk still takes from now.
  function walkHours(st, a) {
    const l = a.leg;
    if (!a.path || !l || l.kind !== 'walk' || !l.h.length) return 0;
    return Math.max(0, l.h[l.h.length - 1] - (workTick(st) - l.t) / TICKS);
  }
  // The page's view of a pawn at time `at` (a tick, fractional: the page draws between steps, VB-474; the step now if absent): [x, y,
  // face, stride], a walker's worked out from its leg, ahead of the simulation by less than a step and never past the leg's due; read only.
  function poseOf(st, a, at = workTick(st)) {
    const l = a.leg;
    if (!a.path || !l || l.kind !== 'walk') return [a.x, a.y, a.face, a.stride || 0];
    const e = Math.max(0, Math.min(at, l.due) - l.t) / TICKS,
      [i, x, y] = along(a, l, e);
    return poseAt(a, l, Math.min(e, l.h.length ? l.h[l.h.length - 1] : 0), i, x, y);
  }
  // ---- the bed (VB-783; design.md, Sleeping away from home): where a pawn's day starts and ends; the stays are sim/away's ----
  // A pawn on a journey is in agent.journey 'walk' while it walks a leg and 'rest' before its first leg and between legs, when it rests and
  // keeps its route (a.path, a.seg).
  const travelling = (a) => a.journey === 'walk' || a.journey === 'rest';
  // A pawn's state for its task is read from its leg and its hands, never kept (VB-1751; design.md section 7, The task as a plan): at
  // its work, in a work leg; a load in hand, a.load > 0, which only a task's hand holds; else out for it, walking. Bound for nothing: no
  // task in hand, not walking home to its bed, on no journey (the pawn's own time, and the planner's to offer).
  const atWork = (a) => !!a.job && !!a.leg && a.leg.kind === 'work';
  const unbound = (a) => !a.job && !a.homeward && !travelling(a);
  // The open stay of pawn id (st.away, by the index agent.away), or null.
  function stayOf(st, id) {
    const k = st.agents[id].away;
    if (k === undefined) return null;
    for (const s of st.away) if (s.id === k) return s;
    return null;
  }
  // The bed (design: Sleeping away from home, The bed): the tile pawn a's day starts from and ends at. Its household's house; away, its
  // stay's bed; on the road, where it stands; walking home from a stay, the house again.
  function bed(st, a) {
    const s = a.away === undefined ? null : stayOf(st, a.id);
    if (s !== null && s.bed === null) return here(st, a);
    if (s !== null && !s.back) return s.bed;
    return st.farmsteads[st.households[st.pawns[a.id].household].farmstead].house;
  }
  return { tileAt, here, endTile, along, poseAt, placeOf, walkHours, poseOf, travelling, atWork, unbound, stayOf, bed };
})();
