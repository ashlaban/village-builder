// @sys sim/legs: a pawn's leg (a walk, a wait or work) and the one due-queue of walks and waits: a walk set out on, begun, cut, its pace
// told again and ended, its tiles trodden; split from sim/agents (VB-422). What a walk's end means for the pawn is sim/agents'
VB['sim/legs'] = (() => {
  const { DAY, TICKS, WORK, SPEED, HERD, TRAVEL } = VB['sim/rules'];
  const { route } = VB['sim/routes'],
    { stepCost, tileCost, iced } = VB['sim/walking'];
  const { tread } = VB['sim/paths'];
  const { driven, droveRoute } = VB['sim/grazing'];
  const Carts = VB['sim/carts'];
  const Due = VB['sim/due'];
  const { emit } = VB['sim/events'];
  const { tileAt, along, poseAt } = VB['sim/pose'];
  const { workTick } = VB['sim/progress'];
  // ---- legs (VB-471, VB-473; design.md section 7, A leg, and its end; docs/review-blocks.md, step 3): a pawn is touched when its leg is due ----
  // @state agent.leg: the leg the pawn is in, or null (none: free, waiting for the working day's start; or dead):
  //   a walk {kind 'walk', t, x, y, seg, pace, h, end, due, s}: a.path walked from point seg, begun at place (x, y) after the step of tick t
  //     (it moves from step t + 1), at `pace` (map units of meadow a game hour); h[k] the hours from its start to path point seg + 1 + k;
  //     `end` the step it arrives at, `due` the step it ends at (its end, or a journey's stop for the night); s the stride at its start (the page's);
  //   a wait {kind 'wait', t, due}: a free pawn (or one resting on the road) whose pause ends at step `due`, in the working hours;
  //   work {kind 'work', t, x, y, seg 0}: the tick and place its work began (its end is its task's, in st.workDue; the page walks a
  //     field's rows from it).
  //   Written only here, at a leg's start and end; plain data, saved.
  // @state st.legDue: the ids of the pawns whose walk or wait is under way, each once, sorted by their leg's due, then id: one due-queue for
  //   walks, waits and the legs of journeys (Rules for cost 4), bounded by the living; plain data, saved; built from the pawns' state when
  //   absent (a fresh run, an older save). A step takes what is due (stepAgents) and nothing else.
  // A walk begun before or while the step's legs are taken moves this step (its start is the step before); one begun after, from the next.
  const walkTick = (st) => (!st.stepAt || st.stepAt.walked === st.tick ? st.tick : st.tick - 1);
  // The first step a pawn freed now may look for work at: this one while its legs are being taken (or before), else the next.
  const pollTick = (st) => (!st.stepAt || st.stepAt.walked === st.tick ? st.tick + 1 : st.tick);
  // The first step at or after game time u (a pause ends when st.t reaches it).
  function tickOf(u) {
    let k = Math.ceil(u * TICKS);
    if ((k - 1) / TICKS >= u) k--;
    if (k / TICKS < u) k++;
    return k;
  }
  const working = (k) => {
    const h = Math.floor(k / TICKS) % DAY;
    return h >= WORK[0] && h < WORK[1];
  };
  // The pace of a walking pawn in map units of meadow a game hour.
  // (one on its way out with a cart taken at the house, the water's barrel, goes at the cart's pace too: VB-1586)
  const paceOf = (st, a) => SPEED * st.w.HW * Carts.pace(st, a);
  // st.legDue's order (sim/due): by the pawn's leg's due, then its id.
  const legAt = (id, st) => st.agents[id].leg.due,
    pawnId = (id) => id;
  // The queue, built from the pawns' state the first time it is needed (a fresh run, an older save).
  function legsOf(st) {
    if (!st.legDue) {
      st.legDue = [];
      for (const p of st.pawns) {
        const a = st.agents[p.id];
        if (!p.alive || !a) continue;
        const was = a.leg;
        a.leg = null;
        if (a.phase === 'road') roadWait(st, a);
        else if (a.path)
          begin(st, a); // from where it stands now
        else if (a.phase === 'work')
          a.leg = was && was.t !== undefined ? { kind: 'work', t: was.t, x: was.x, y: was.y, seg: 0 } : workLeg(st, a);
        else if (a.phase === null) waitLeg(st, a);
      }
    }
    return st.legDue;
  }
  const workLeg = (st, a) => ({ kind: 'work', t: st.tick, x: a.x, y: a.y, seg: 0 });
  function enqueue(st, a) {
    const q = st.legDue;
    if (!Number.isFinite(a.leg.due)) throw new Error(`pawn ${a.id}'s ${a.leg.kind} leg is due at no step`); // a NaN jams the queue (VB-255)
    Due.insert(q, a.id, a.leg.due, a.id, legAt, pawnId, st);
  }
  // The pawn's leg is over (or replaced): out of the queue.
  function unleg(st, a) {
    const l = a.leg,
      q = st.legDue;
    if (l && (l.kind === 'walk' || l.kind === 'wait') && q) {
      Due.remove(q, a.id, l.due, a.id, legAt, pawnId, st);
    }
    a.leg = null;
  }
  // A free pawn (no walk, no task in hand) waits: until its pause ends, and at least until step `from`; a wait that would end outside the
  // working hours is none, and the working day's start takes it (dayStart).
  function waitLeg(st, a, from = pollTick(st)) {
    legsOf(st);
    unleg(st, a);
    if (!st.pawns[a.id].alive) return;
    const due = Math.max(from, tickOf(a.idleUntil));
    if (working(due)) {
      a.leg = { kind: 'wait', t: st.tick, due };
      enqueue(st, a);
    }
    emit(st, 'legChanged', a); // a side task held is looked at as the leg begins (sim/agents sideCheck)
  }
  // A pawn on a journey rests on the road until its next leg, at the next 6:00 (VB-287).
  function roadWait(st, a) {
    legsOf(st);
    unleg(st, a);
    a.leg = { kind: 'wait', t: st.tick, due: nextLeg(st.t) * TICKS };
    enqueue(st, a);
  }
  // The walk along a.path from where the pawn is (a.x, a.y, past point a.seg) is a leg: the hours to each point at its pace, its end the
  // step they reach (whole steps: the clock stands), cut short on a journey at the night's stop (the last step before WORK[1]).
  function begin(st, a) {
    legsOf(st);
    unleg(st, a);
    const P = a.path,
      pace = paceOf(st, a),
      h = [];
    let s = 0,
      x = a.x,
      y = a.y;
    for (let i = a.seg + 1; i < P.length; i++) {
      const p = P[i];
      s += (Math.hypot(p[0] - x, p[1] - y) * (p[2] === undefined ? 1 : p[2])) / pace;
      h.push(s);
      x = p[0];
      y = p[1];
    }
    const t = walkTick(st),
      end = t + Math.max(1, Math.ceil(s * TICKS - 1e-9));
    let due = end;
    if (a.phase === 'journey') {
      const day = Math.floor((t + 1) / (DAY * TICKS));
      due = Math.min(end, Math.max(t + 1, (day * DAY + WORK[1]) * TICKS - 1));
      if (due < end) due = ashore(st, a, h, t, due);
    }
    a.leg = { kind: 'walk', t, x: a.x, y: a.y, seg: a.seg, pace, h, end, due };
    if (st.pawns[a.id].alive) enqueue(st, a);
    emit(st, 'legChanged', a); // a side task held is looked at as the leg begins (sim/agents sideCheck)
  }
  // Nobody sleeps on the ice (VB-808; design.md, The ground by season): a journey's leg that would stop for the night on ice, or on the
  // way onto it, stops instead at the end of the last stretch of its walk wholly on land, the shore, to cross in the morning. Segment k
  // of the walk runs from point k - 1 (the start for k = 0) to point k, reached at h[k] hours; a point's tile is the one it entered.
  function ashore(st, a, h, t, due) {
    const w = st.w,
      P = a.path,
      tiles = [tileAt(st, a.x, a.y)];
    for (let k = 0; k < h.length; k++) {
      const p = P[a.seg + 1 + k];
      tiles.push(p[3] !== undefined && p[3] >= 0 ? p[3] : tiles[k]);
    }
    const e = (due - t) / TICKS,
      wet = (k) => iced(w, tiles[k]) || iced(w, tiles[k + 1]);
    let k = 0;
    while (k < h.length && h[k] <= e) k++;
    if (k >= h.length || !wet(k)) return due;
    let j = k - 1;
    while (j >= 0 && wet(j)) j--;
    return j < 0 ? due : Math.max(t + 1, t + Math.floor(h[j] * TICKS));
  }
  // The tiles entered from point `from` to point `to` are trodden; the herds a herder drives wear the way too (VB-136): only a herder out
  // with them, or bringing them home, can drive any.
  function treadTo(st, a, from, to) {
    for (let i = from + 1; i <= to; i++) {
      VB.count.walkPoint++;
      const t = a.path[i][3] ?? -1;
      if (t >= 0) tread(st.w, t, a.side || a.phase === 'home' ? 1 + HERD.herding.move * driven(st, a.id) : 1);
    }
  }
  // hours reach, facing the way it went (a.x, a.y, a.seg, and the page's face and stride: written at a leg's start and end only).
  function stopAt(st, a, l, e) {
    const [i, x, y] = along(a, l, e);
    treadTo(st, a, l.seg, i);
    [a.x, a.y, a.face, a.stride] = poseAt(a, l, e, i, x, y);
    a.seg = i;
  }
  // A walk is cut where it has come to; `keep` keeps its route, to walk on from there (a pace changed); `quiet` leaves its side task to
  // the walk that follows.
  function halt(st, a, keep = false, quiet = false) {
    const l = a.leg;
    if (!l || l.kind !== 'walk') {
      if (!keep) a.path = null; // a route kept on the road, dropped
      return;
    }
    unleg(st, a);
    stopAt(st, a, l, Math.max(0, workTick(st) - l.t) / TICKS);
    if (!keep) a.path = null;
    if (!quiet) emit(st, 'legChanged', a);
  }
  // A walk's pace changed (what it carries): it goes on from where it has come to, at the new pace.
  function repace(st, a) {
    if (!a.path || !a.leg || a.leg.kind !== 'walk' || paceOf(st, a) === a.leg.pace) return;
    halt(st, a, true, true);
    begin(st, a);
  }
  // The load class a route is chosen for (sim/walking DISCOMFORT.load, VB-448): 0 unladen, 1 a load on the back, 2 with a cart.
  // As Carts.pace reads it: a load beyond the back's with a cart out for it goes by the cart.
  const loadClass = (st, a) => (!a.carry ? 0 : Carts.pace(st, a) < TRAVEL.pace.back ? 2 : 1);
  // The next 6:00 after game time t (t itself excluded at 6:00 sharp).
  function nextLeg(t) {
    const day = Math.floor(t / DAY);
    return day * DAY + WORK[0] + (t - day * DAY < WORK[0] ? 0 : DAY);
  }
  // The way to (x, y) in `tile`: each point [x, y, cost, tile] carries the cost of the step that ends there, so a pawn walks slower over
  // rough ground, and the tile it enters there (-1 when it stays in the tile), whose wear the step adds to (sim/paths).
  // `near` (an idle stroll, VB-468): to a neighbouring tile it walks straight over, with no route search.
  // A walk in hand is cut first, where it has come to; the new one is a leg from there (begin). sim/agents' walkTo sets the pawn out.
  function setOut(st, a, tile, x, y, near) {
    if (a.path) halt(st, a, false, true);
    const w = st.w,
      from = tileAt(st, a.x, a.y),
      k = near && from >= 0 ? w.nb.indexOf(tile, from * 6) : -1,
      step = k >= from * 6 && k < from * 6 + 6,
      cls = loadClass(st, a),
      // a herder with its herds goes by its village's way out (sim/grazing, VB-446)
      p = step
        ? [from, tile]
        : from >= 0 && from !== tile
          ? droveRoute(st, a, from, tile, cls) || route(st, from, tile, cls)
          : null;
    const ok = p && p[0] === from,
      tiles = ok ? p.slice(1, -1) : [],
      cost = (i) => (i >= 0 && tileCost(w, i) < Infinity ? tileCost(w, i) : 1);
    a.path = [[a.x, a.y]];
    for (let s = 0; s < tiles.length; s++) {
      const t = tiles[s];
      a.path.push([w.hx[t] + a.ox * 0.4, w.hy[t] + a.oy * 0.4, stepCost(w, p[s], t), t]);
    }
    a.path.push([x, y, ok ? stepCost(w, p[p.length - 2], tile) : cost(tile), ok ? tile : -1]);
    a.seg = 0;
    begin(st, a);
  }
  // The pawn is put at (x, y) (by the door of its bed; a newborn where its mother is), its leg and route left as they are.
  function putAt(st, a, x, y) {
    a.x = x;
    a.y = y;
  }
  // The pawn has come to its task: its work leg begins, here and now (the page walks a field's rows from it).
  function workAt(st, a) {
    a.leg = workLeg(st, a);
  }
  // Walk leg l is due (sim/agents walkEnd): at its route's end, the pawn stands there, every tile of the rest of the way trodden, and true;
  // on a journey, stopped for the night, it stands where it has come to, and false.
  function walked(st, a, l) {
    if (l.due >= l.end) {
      stopAt(st, a, l, l.h.length ? l.h[l.h.length - 1] : 0); // at its route's end
      a.path = null;
      return true;
    }
    stopAt(st, a, l, (l.due - l.t) / TICKS);
    return false;
  }
  // The legs due at this step are taken from the queue, in order, each pawn's leg ended (null) and given to fn(st, a, leg) (sim/agents
  // stepAgents): what the pawn does next is fn's.
  function dueLegs(st, fn) {
    const q = st.legDue;
    while (q.length && legAt(q[0], st) <= st.tick) {
      const a = st.agents[q.shift()],
        l = a.leg;
      a.leg = null;
      VB.count.walkStep++;
      fn(st, a, l);
    }
  }
  return { legsOf, waitLeg, roadWait, unleg, halt, begin, repace, setOut, putAt, workAt, walked, dueLegs };
})();
