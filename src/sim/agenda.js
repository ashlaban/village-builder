// @sys sim/agenda: a pawn's agenda (VB-1644; docs/ui2/HANDOFF.md; keyed by pawn, VB-1746): its queue laid end to end from now and the open work it may
// take, each with the hours the pawn itself reckons it takes (sim/estimate; principle "The future is someone's estimate": what is shown of the future is
// some pawn's
// estimate), the deadline that presses (a field's sowing window, the frost the head expects, the haymaking window) and whether it ends in
// time; for a step of a project making a field, the steps left before the field can be sown; and the player's plan (its own steps, sim/steps;
// sim/controller nextOf) laid
// into today and the next two days by the feeder's rule (VB-1647: days, plan, owed, routine); and the windows that press at the household's
// tiles with no task of the plan covering them (VB-1650: planGaps). A view computed when the page asks, as
// sim/reasons is: it writes nothing, draws nothing, and no simulation module reads it (tests/agenda.js)
VB['sim/agenda'] = (() => {
  const { DAY, SEASON_DAYS, YEAR, WORK, SPEED, cal } = VB['sim/rules'];
  const { CROPS, ROTATIONS } = VB['sim/crops'];
  const { KINDS } = VB['sim/kinds'];
  const { says } = VB['sim/methods'];
  const { carriesTo } = VB['sim/doing'];
  const { estimate } = VB['sim/estimate'];
  const { windowLeft, cause } = VB['sim/reasons'];
  const { frostExpected } = VB['sim/weather'];
  const { projectsOf } = VB['sim/projects'];
  const { courseFor } = VB['sim/rotations'];
  const { MOW_LAST, hayWanted } = VB['sim/meadows'];
  const { workFor } = VB['sim/opportunities'];
  const { here, walkHours } = VB['sim/pose'];
  const { toAxial, hexDist } = VB['world/grid'];
  const { CHAINS, chainOf, chainSteps } = VB['sim/planchains'];
  const { controlOf, waitsOf, asleepAt } = VB['sim/controller'];
  const { pawnPlan: planOf } = VB['sim/steps'];
  const { heldFarms } = VB['sim/ownership'];
  const Camp = VB['sim/camp'],
    Water = VB['sim/water'];
  const { AWAKE, SLEEP, owedBy } = VB['sim/sleep'];
  const LEN = WORK[1] - WORK[0];
  // ---- time: work and walks are laid in working hours ----
  // The game hour at which h working hours begun at t are spent: the hours outside WORK[0]..WORK[1] are skipped. Closed form, no loop.
  function after(t, h) {
    if (!Number.isFinite(h)) return Infinity;
    let day = Math.floor(t / DAY),
      hr = t - day * DAY;
    if (hr >= WORK[1]) {
      day++;
      hr = WORK[0];
    } else if (hr < WORK[0]) hr = WORK[0];
    if (!(h > 0)) return day * DAY + hr;
    const room = WORK[1] - hr;
    if (h <= room) return day * DAY + hr + h;
    const rest = h - room,
      days = Math.ceil(rest / LEN);
    return (day + days) * DAY + WORK[0] + (rest - (days - 1) * LEN);
  }
  // The end of work on the day `left` days from today (a window's last day, as sim/reasons windowLeft counts them).
  const closeOf = (t, left) => (Math.floor(t / DAY) + left) * DAY + WORK[1];
  // The walk from tile a to tile b, as the crow flies at a meadow's pace (SPEED): cheap to reckon, never above the road's; null for no tile.
  function walk(st, a, b) {
    if (!(a >= 0) || !(b >= 0)) return null;
    const C = st.w.COLS,
      [q1, r1] = toAxial(a % C, Math.floor(a / C)),
      [q2, r2] = toAxial(b % C, Math.floor(b / C));
    return hexDist(q1, r1, q2, r2) / SPEED;
  }
  // ---- deadlines ----
  // What presses at job j, {t (game hour), what}, or null: the sowing window of its field's crop for hoeing and sowing, the frost the head
  // expects for reaping and carrying in (sim/reasons windowLeft: the head's estimate, never this year's draw), the haymaking window for
  // mowing.
  function deadlineOf(st, j, c) {
    if (j.field && ['plow', 'sow', 'reap', 'haul'].includes(j.kind)) {
      const left = windowLeft(st, j, c);
      if (left === null) return null;
      const what = j.kind === 'reap' || j.kind === 'haul' ? 'the frost' : `the end of the ${j.field.crop} sowing`;
      return { t: closeOf(st.t, left), what };
    }
    if (j.kind === 'mow') {
      const t = Math.floor(st.t / YEAR) * YEAR + (2 * SEASON_DAYS + MOW_LAST) * DAY + WORK[1];
      return t >= st.t ? { t, what: 'the end of haymaking' } : null;
    }
    return null;
  }
  // `late` when the middle of the range ends past the deadline, `tight` when its top does, else `in time`; null with no deadline.
  const verdict = (d, mid, hi) => (!d ? null : mid > d.t ? 'late' : hi > d.t ? 'tight' : 'in time');
  // ---- what a step leads to ----
  // A pseudo task of kind k and `hours`, for the pawn's estimate of a step whose job is not posted (nothing of it is done).
  const step = (kind, hours, hid) => ({
    key: `${kind}:agenda`,
    kind,
    hours,
    done: 0,
    claims: [],
    owner: { type: 'household', id: hid },
  });
  // For job j, a step of household hid's project making a field: {steps: [{kind, hours, rough}] (the steps after it, then the hoeing and
  // the sowing of the crop the new field would take, whose jobs are not posted: estimated at the crop's hours, rough), crop, deadline (the
  // close of its next sowing window), verdict (of the whole chain, from j's end)}; else null.
  function thenOf(st, id, j, hid, from, fromHi) {
    if (!j.owner || j.owner.type !== 'household') return null;
    const plan = projectsOf(st, 'household', hid).find((p) => {
      const s = p.steps[p.open];
      return p.what === 'field' && s && s.kind === j.kind && s.place === j.site;
    });
    if (!plan) return null;
    const hh = st.households[hid],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    const { key, i } = courseFor(st, f ? f.fields : [], hh),
      crop = ROTATIONS[key].courses[i],
      C = CROPS[crop];
    const steps = [],
      lay = (s, mid, hi) => [after(mid, s.hours.mid), after(hi, s.hours.hi)];
    let [mid, hi] = [from, fromHi];
    for (const s of plan.steps.slice(plan.open + 1)) {
      const e = estimate(st, id, step(s.kind, s.hours, hid), [id]);
      steps.push({ kind: s.kind, hours: { lo: e.lo, mid: e.mid, hi: e.hi }, rough: false });
      [mid, hi] = lay(steps[steps.length - 1], mid, hi);
    }
    if (C.fallow || !C.sow) return { steps, crop, deadline: null, verdict: null };
    // the window this year, else the next: it opens on its first day (the thaw, a draw, is not reckoned) and closes with its last
    const y0 = Math.floor(st.t / YEAR) * YEAR,
      close = (y) => y + (C.sow[0] * SEASON_DAYS + C.sow[2]) * DAY + WORK[1],
      y = close(y0) >= st.t ? y0 : y0 + YEAR,
      opens = y + (C.sow[0] * SEASON_DAYS + C.sow[1]) * DAY + WORK[0];
    [mid, hi] = [Math.max(mid, opens), Math.max(hi, opens)];
    for (const k of ['plow', 'sow']) {
      const e = estimate(st, id, step(k, C.hours[k], hid), [id]);
      steps.push({ kind: k, hours: { lo: e.lo, mid: e.mid, hi: e.hi }, rough: true });
      [mid, hi] = lay(steps[steps.length - 1], mid, hi);
    }
    const deadline = { t: close(y), what: `the end of the ${crop} sowing${y > y0 ? ' next year' : ''}` };
    return { steps, crop, deadline, ends: mid, verdict: verdict(deadline, mid, hi) };
  }
  // ---- the entries ----
  // The entry for job j begun at game hour `starts` from tile `at`: its key, kind, tile, hours, walk, starts and ends, deadline, verdict,
  // then. The pawn's own estimate with its own hands.
  function entry(st, id, j, at, starts, c) {
    const e = estimate(st, id, j, [id]),
      w = walk(st, at, j.site) ?? 0,
      ends = after(starts, w + e.mid),
      endsHi = after(starts, w + e.hi),
      deadline = deadlineOf(st, j, c);
    return {
      key: j.key,
      kind: j.kind,
      site: j.site ?? -1,
      hours: { lo: e.lo, mid: e.mid, hi: e.hi },
      walk: w,
      starts,
      ends,
      deadline,
      verdict: verdict(deadline, ends, endsHi),
      then: thenOf(st, id, j, j.owner && j.owner.id, ends, endsHi),
    };
  }
  // ---- the plan laid into days (VB-1647): the feeder's rule (sim/controller nextOf, sim/player feed) followed forward in time ----
  const NDAYS = 3, // today and the next two
    BEYOND = 30; // days a task's end is still sought past them, for its verdict
  // The next game hour from t (t itself included) at which the day's clock reads h.
  const nextAt = (t, h) => {
    const u = Math.floor(t / DAY) * DAY + h;
    return u >= t ? u : u + DAY;
  };
  // The game hour h awake hours begun at t are spent, the sleeping hours s skipped (any 24 hours hold the same awake hours).
  function past(t, h, s) {
    if (!Number.isFinite(h) || !Number.isFinite(t)) return Infinity;
    if (!s) return t + h;
    const A = 24 - ((s.until - s.from + 24) % 24),
      full = Math.floor(h / A);
    t += full * DAY;
    h -= full * A;
    for (let i = 0; i < 4 && h > 1e-9; i++) {
      if (asleepAt(s, t - Math.floor(t / DAY) * DAY)) t = nextAt(t, s.until);
      const room = nextAt(t + 1e-9, s.from) - t;
      if (h <= room) return t + h;
      h -= room;
      t += room;
    }
    return t + h;
  }
  // A piece of work at job j begun at tile `at` (null: under way, already there), for a pawn of home `home`: its walk there, its work at
  // the pawn's own estimate (e), the walk home of a kind that carries home (a water trip's both ways, as sim/day counts it), and the tile
  // it ends on.
  function piece(st, id, j, at, home) {
    const T = says(KINDS[j.kind], 'trip'), // its method's go step's (VB-1821)
      e = estimate(st, id, j, [id]),
      trip = at !== null && T && j.farm ? T(st, j) : 0,
      w = at === null || trip > 0 ? 0 : (walk(st, at, j.site) ?? 0),
      carries = carriesTo(j.kind) !== null, // a kind whose method sets a load down (VB-1820: not a field `back`)
      back = trip > 0 ? trip : carries ? (walk(st, j.site, home) ?? 0) : 0;
    return { e, w, back, hours: w + e.mid + back, ends: carries && home >= 0 ? home : (j.site ?? at) };
  }
  // The job of kind k posted for household hid (a household's jobs, a few tens), or null.
  function postedJob(st, hid, k) {
    const js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (js) for (const j of js) if (j.kind === k) return j;
    return null;
  }
  // The job of routine kind k, or where none is posted a step of the kind's hours, at the household's water for a kind drawn there.
  function routineJob(st, hid, k) {
    const j = postedJob(st, hid, k),
      f = hid === null || st.households[hid].farmstead === null ? null : st.farmsteads[st.households[hid].farmstead],
      // VB-1670: a house just moved has its water found on its first morning (sim/water find): the agenda reads where it will be, and a
      // job posted at the water of the house before it moved is not the days' to come
      water =
        f && (KINDS[k].at || []).includes('water')
          ? f.water || Water.source(st.w, f.house, st.villages[f.village])
          : null;
    if (j && !(water && j.site !== water.tile)) return j;
    const s = step(k, KINDS[k].hours ?? 0, hid);
    if (water) Object.assign(s, { farm: f.water ? f : { ...f, water }, site: water.tile });
    return s;
  }
  // A task at a tile's steps left (sim/planchains chainSteps; VB-1649, VB-1650) as parts of its work: {kind, key (its job's, null while
  // not posted), e (the pawn's estimate: of the job posted, else of the step's hours; a carrying's by its loads), rough (not posted), from
  // (the hour it may begin: a step not posted at its window's opening, or when its crop is expected ripe, its hay dry)}; with its
  // chain's deadline (`frost`: the autumn day of the frost the head expects).
  function chainParts(st, id, hid, tk, frost) {
    const s = chainSteps(st, hid, tk.kind, tk[tk.kind], tk);
    if (!s) return { parts: [], deadline: null };
    const on = s.where.fd ? { field: s.where.fd, farm: s.where.f } : null; // a field's step, whose normal hours are its crop's
    const parts = s.steps.map((x) => {
      // VB-1670: a trip of the move, its walks by the way's route (sim/camp moveTrips), laid whole: it is not left for the sleeping hours
      if (x.trip) {
        const one = x.trip.go + x.trip.lift + x.trip.back;
        return {
          kind: x.kind,
          key: x.job ? x.job.key : null,
          e: { lo: one * x.n, mid: one * x.n, hi: one * x.n },
          rough: !x.job,
          from: x.job ? -Infinity : x.from,
          trip: one,
        };
      }
      const e = estimate(
        st,
        id,
        x.job || (on ? { ...step(x.kind, x.hours, hid), ...on } : step(x.kind, x.hours, hid)),
        [id],
      );
      return {
        kind: x.kind,
        key: x.job ? x.job.key : null,
        e: x.n === 1 ? e : { lo: e.lo * x.n, mid: e.mid * x.n, hi: e.hi * x.n },
        rough: !x.job,
        from: x.job ? -Infinity : x.from,
      };
    });
    return { parts, deadline: CHAINS[tk.kind].deadline(st, hid, s.where, frost) };
  }
  // The plan laid from now: {days (NDAYS lists of segments {from, to, what, kind, key, site}; a task at a tile's by the kind and key of
  // its step), plan (each task's entry where the layout puts it; a task at a tile's with its steps left, as `then` lays a project's), owed (the
  // hours of sleep owed at each day's end), routine ([{kind, hours}]: a day's work of each routine kind, from home)}.
  // Hand-queued commands first, end to end; then, the plan followed (automatic behaviour off), the sleeping hours, the routine once a day
  // in order (a kind with no job posted now waits for its window; on the days after, a kind with a window is taken from its opening, one
  // without from the day's start if a job of it is posted now), the tasks in order, broken off at the sleeping hour; else free.
  // Bounded by the queue, the plan's length and the days laid (at most NDAYS + BEYOND).
  function layout(st, id, entries) {
    const a = st.agents[id],
      pp = planOf(st, id),
      ctl = controlOf(st, id),
      followed = !!pp && !ctl.auto,
      hid = st.pawns[id].household,
      hh = hid === null ? null : st.households[hid],
      home = (hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead].house : -1) ?? -1,
      d0 = Math.floor(st.t / DAY),
      end = (d0 + NDAYS) * DAY,
      far = end + BEYOND * DAY,
      sl = followed ? pp.sleep : null,
      barred = followed ? waitsOf(st, id).tasks.map((w) => !!w && w.why === 'refused') : [], // VB-1651: a task its verb refuses is not laid
      c = cal(st.t),
      hourOf = (t) => t - Math.floor(t / DAY) * DAY;
    const days = Array.from({ length: NDAYS }, () => []);
    // a segment, cut at midnight, joined to the one before when it goes on
    const put = (from, to, what, kind, key, site) => {
      to = Math.min(to, end);
      while (to > from + 1e-9) {
        const d = Math.floor(from / DAY),
          cut = Math.min(to, (d + 1) * DAY),
          list = days[d - d0],
          last = list[list.length - 1];
        if (last && last.what === what && last.key === key && last.kind === kind && Math.abs(last.to - from) < 1e-9)
          list.splice(-1, 1, { ...last, to: cut });
        else list.push({ from, to: cut, what, kind, key, site });
        from = cut;
      }
    };
    let t = st.t,
      at = here(st, a);
    // the commands queued: by hand (the plan's give way to one), or the plan's routine work under way
    const hand = ctl.queue.some((q) => !q.plan),
      begun = new Set();
    ctl.queue.forEach((q, i) => {
      if (q.plan && (hand || (q.plan.from !== 'routine' && q.plan.from !== 'vital'))) return; // the sleeping hours and the tasks are laid below
      const e = entries[i];
      let to;
      if (q.verb === 'sleep') {
        const g = q.args || {};
        to =
          q.begun !== null && q.ref ? q.ref.until : g.hours !== undefined ? t + g.hours : nextAt(t, g.until ?? WORK[0]);
      } else if (q.verb === 'idle' && q.args && q.args.until !== undefined) to = Math.max(t, q.args.until);
      else if (q.plan) {
        begun.add(q.plan.kind);
        const j = st.jobs.get(q.target),
          p = j ? piece(st, id, j, q.begun !== null && j === a.job ? null : at, home) : null;
        to = p ? t + p.hours : t;
        if (sl) to = Math.min(to, asleepAt(sl, hourOf(t)) ? t : nextAt(t, sl.from));
        if (p) at = p.ends;
      } else to = t + e.walk + (e.hours ? e.hours.mid : 0);
      const what = q.verb === 'sleep' ? 'sleep' : q.plan ? 'routine' : 'queue';
      put(t, to, what, q.plan ? q.plan.kind : e.kind, q.verb === 'work' ? q.target : null, e.site);
      if (!q.plan && e.site >= 0) at = e.site;
      t = Math.max(t, Number.isFinite(to) ? to : far);
    });
    const routine = [],
      plan = [],
      left = [];
    if (pp)
      for (const k of pp.routine)
        routine.push({ kind: k, hours: piece(st, id, routineJob(st, hid, k), home >= 0 ? home : at, home).hours });
    // the tasks: their work left at the pawn's estimate, laid in order; the one under way is begun where the pawn is
    const head = ctl.queue[0],
      mark = !hand && head && head.plan && head.plan.from === 'task' && head.begun !== null ? head.plan : null,
      underWay = mark ? mark.key : null,
      underWayAt = (tk) =>
        !!mark &&
        (chainOf(tk) ? mark.chain === tk.kind && mark[tk.kind] === tk[tk.kind] : !mark.chain && underWay === tk.key);
    // each task's parts (a task by key: its job; a task at a tile: its steps left), the part laid now and its hours left
    const parts = [],
      part = [],
      pleft = [],
      frost = pp && pp.tasks.some((tk) => tk.kind === 'harvest' || tk.kind === 'farmstead') ? frostExpected(st) : null;
    if (pp)
      for (const tk of pp.tasks) {
        if (chainOf(tk)) {
          const { parts: ps, deadline } = chainParts(st, id, hid, tk, frost),
            sum = (k) => ps.reduce((n, x) => n + x.e[k], 0);
          parts.push(barred[parts.length] ? ps.map((x) => ({ ...x, from: Infinity })) : ps);
          part.push(0);
          pleft.push(ps.length ? ps[0].e.mid : 0);
          left.push(sum('mid'));
          plan.push({
            [tk.kind]: tk[tk.kind],
            kind: tk.kind,
            site: tk.site,
            key: ps.length ? ps[0].key : null,
            step: ps.length ? ps[0].kind : null,
            stands: ps.length > 0 && !ps[0].rough,
            hours: ps.length ? { lo: sum('lo'), mid: sum('mid'), hi: sum('hi') } : null,
            starts: null,
            ends: null,
            deadline,
            verdict: null,
            then: null,
            rough: ps.some((x) => x.rough),
            steps: ps.map((x) => ({
              kind: x.kind,
              key: x.key,
              hours: { lo: x.e.lo, mid: x.e.mid, hi: x.e.hi },
              rough: x.rough,
            })),
          });
          continue;
        }
        const j = st.jobs.get(tk.key),
          e = j ? estimate(st, id, j, [id]) : null;
        parts.push(
          e ? [{ kind: tk.kind, key: tk.key, e, rough: false, from: barred[parts.length] ? Infinity : -Infinity }] : [],
        );
        part.push(0);
        pleft.push(e ? e.mid : 0);
        left.push(e ? e.mid : 0);
        plan.push({
          key: tk.key,
          kind: tk.kind,
          site: tk.site,
          stands: !!j,
          hours: e ? { lo: e.lo, mid: e.mid, hi: e.hi } : null,
          starts: null,
          ends: null,
          deadline: j ? deadlineOf(st, j, c) : null,
          verdict: null,
          then: null,
        });
      }
    // when routine kind k may be taken on day d: today, posted now or at its window's opening later today; after, as said above
    const posted = new Set(pp ? pp.routine.filter((k) => postedJob(st, hid, k)) : []);
    const opens = (k, d) => {
      const w = KINDS[k].window;
      if (d === d0) return posted.has(k) ? st.t : w && c.hour < w.from ? d * DAY + w.from : Infinity;
      return w ? d * DAY + w.from : posted.has(k) ? d * DAY : Infinity;
    };
    let day = d0,
      done = new Set([...(pp && pp.day === d0 ? pp.done : []), ...begun]),
      n = 0;
    while (followed && t < far - 1e-9 && n++ < 64 * (NDAYS + BEYOND)) {
      const d = Math.floor(t / DAY),
        h = t - d * DAY;
      if (d !== day) {
        day = d;
        done = new Set();
      }
      if (t >= end - 1e-9 && !left.some((l) => l > 1e-9)) break;
      if (asleepAt(sl, h)) {
        const u = nextAt(t, sl.until);
        put(t, u, 'sleep', null, null, home);
        t = u;
        if (home >= 0) at = home;
        continue;
      }
      const bed = sl ? nextAt(t + 1e-9, sl.from) : Infinity;
      const k = pp.routine.find((r) => !done.has(r) && opens(r, d) <= t + 1e-9);
      if (k) {
        done.add(k);
        const j = routineJob(st, hid, k),
          p = piece(st, id, j, at, home),
          to = Math.min(t + p.hours, bed);
        put(t, to, 'routine', k, j.key === `${k}:agenda` ? null : j.key, j.site ?? -1);
        t = to;
        at = to < bed ? p.ends : (j.site ?? at);
        continue;
      }
      // the first task with work left whose part may begin now (a plant task's hoeing waits for its sowing window, a hay task's mowing
      // for the haymaking, a harvest task's reaping for the crop to ripen)
      const i = left.findIndex((l, n) => l > 1e-9 && parts[n][part[n]].from <= t + 1e-9);
      if (i >= 0) {
        const tk = pp.tasks[i],
          P = parts[i][part[i]],
          j = P.key === null ? null : st.jobs.get(P.key),
          site = j ? (j.site ?? tk.site) : tk.site,
          w = (underWayAt(tk) && plan[i].starts === null) || at === site || P.trip ? 0 : (walk(st, at, site) ?? 0),
          // a trip of the move goes on through the sleeping hours to its end (sim/player onTrip), one trip at a time
          to = P.trip ? Math.min(t + Math.min(pleft[i], P.trip), far) : Math.min(t + w + pleft[i], bed, far),
          did = Math.max(0, to - t - w);
        if (plan[i].starts === null) plan[i].starts = t;
        put(t, to, 'task', P.kind, P.key, tk.site);
        left[i] = Math.max(0, left[i] - did);
        pleft[i] = Math.max(0, pleft[i] - did);
        if (!(pleft[i] > 1e-9) && part[i] + 1 < parts[i].length) pleft[i] = parts[i][++part[i]].e.mid;
        if (!(left[i] > 1e-9)) plan[i].ends = to;
        t = to;
        at = site ?? at;
        continue;
      }
      if (t >= end - 1e-9) break;
      // nothing to do: free until bed, a routine kind's window opening, the next day's routine, or a waiting task's part
      let to = Math.min(bed, (d + 1) * DAY);
      for (const r of pp.routine) if (!done.has(r) && opens(r, d) > t) to = Math.min(to, opens(r, d));
      left.forEach((l, n) => {
        if (l > 1e-9) to = Math.min(to, parts[n][part[n]].from);
      });
      put(t, to, 'free', null, null, -1);
      t = to;
    }
    if (t < end) put(t, end, 'free', null, null, -1);
    // the tasks' ends and verdicts; one not ended within the days searched is reckoned on past them, the routine aside
    for (let i = 0; i < plan.length; i++) {
      const e = plan[i];
      if (chainOf(pp.tasks[i])) {
        // a task at a tile: its parts not laid reckoned on past the days searched, each from its own opening; the chain's verdict
        if (!followed || !parts[i].length || barred[i]) continue;
        if (e.ends === null) {
          let u = Math.max(t, parts[i][part[i]].from); // the loop stops at far, or earlier with nothing to begin before this part's opening
          if (e.starts === null) e.starts = u;
          u = past(u, pleft[i], sl);
          for (const P of parts[i].slice(part[i] + 1)) u = past(Math.max(u, P.from), P.e.mid, sl);
          e.ends = u;
        }
        e.verdict = verdict(e.deadline, e.ends, past(e.ends, e.hours.hi - e.hours.mid, sl));
        continue;
      }
      if (!e.stands || !followed || barred[i]) continue;
      if (e.ends === null) e.ends = past(Math.max(t, far), left[i], sl);
      if (e.starts === null) e.starts = Math.max(t, far);
      const hi = past(e.ends, e.hours.hi - e.hours.mid, sl),
        j = st.jobs.get(e.key);
      e.verdict = verdict(e.deadline, e.ends, hi);
      e.then = thenOf(st, id, j, j.owner && j.owner.id, e.ends, hi);
    }
    // the hours of sleep owed at each day's end (VB-1643): an hour asleep pays one, an hour awake owes AWAKE; free hours outside the
    // working day are slept, as the pawn goes home at dark and sleeps there with nothing in hand
    let owe = owedBy(st, id);
    const owed = days.map((list) => {
      for (const s of list) {
        const d = Math.floor(s.from / DAY) * DAY,
          parts =
            s.what !== 'free'
              ? [[s.from, s.to, s.what === 'sleep']]
              : [
                  [s.from, Math.min(s.to, d + WORK[0]), true],
                  [Math.max(s.from, d + WORK[0]), Math.min(s.to, d + WORK[1]), false],
                  [Math.max(s.from, d + WORK[1]), s.to, true],
                ];
        for (const [f, u, asleep] of parts)
          if (u > f) owe = Math.min(SLEEP.cap, Math.max(0, owe + (asleep ? -1 : AWAKE) * (u - f)));
      }
      return owe;
    });
    return { days, plan, owed, routine };
  }
  // The agenda of pawn id (Sim.agenda(st, pawn), VB-1746), or null when it is no pawn or dead: {queue, open, day}. Over its own queue
  // and its household's and village's open work only.
  function agenda(st, id) {
    if (!Number.isInteger(id) || !st.pawns[id] || st.pawns[id].died !== null) return null;
    const a = st.agents[id],
      c = cal(st.t),
      now = here(st, a);
    const queue = [],
      queued = new Set();
    let t = st.t,
      at = now,
      work = 0;
    for (const cmd of controlOf(st, id).queue) {
      const j = cmd.verb === 'work' ? st.jobs.get(cmd.target) : null;
      let e;
      if (j) {
        queued.add(j.key);
        e = entry(st, id, j, cmd.begun !== null && j === a.job ? null : at, t, c); // under way: from its work left, already there
        work += e.hours.mid;
        at = j.site ?? at;
      } else {
        // a verb with no hours of work: a walk, going home, idling, by its walk or its time alone; another act, at once
        const to =
          cmd.verb === 'walkTo'
            ? cmd.target
            : cmd.verb === 'goHome'
              ? (st.farmsteads[st.households[st.pawns[id].household]?.farmstead]?.house ?? -1)
              : -1;
        const w = cmd.begun !== null && a.path ? walkHours(st, a) : (walk(st, at, to) ?? 0),
          until = cmd.verb === 'idle' && cmd.args ? Math.max(t, cmd.args.until) : null;
        e = {
          key: cmd.verb === 'work' ? cmd.target : null,
          kind: null,
          site: to,
          hours: null,
          walk: w,
          starts: t,
          ends: until ?? after(t, w),
          deadline: null,
          verdict: null,
          then: null,
        };
        if (to >= 0) at = to;
      }
      work += e.walk;
      queue.push({ verb: cmd.verb, begun: cmd.begun !== null, ...e });
      t = e.ends;
    }
    const open = [];
    for (const o of workFor(st, id)) {
      const j = st.jobs.get(o.target);
      if (!j || queued.has(j.key) || j === a.job) continue;
      open.push({ ...entry(st, id, j, now, st.t, c), why: cause(st, j, c), barred: o.why });
    }
    const left = c.hour >= WORK[1] ? 0 : WORK[1] - Math.max(c.hour, WORK[0]);
    return { queue, open, day: { left, queued: work }, ...layout(st, id, queue) };
  }
  // ---- the windows that press with nothing planned (VB-1650): Sim.planGaps(st, pawn), for the page's warnings ----
  // @tunable GAPS (VB-1650): ripeDays, the days before a sown field's crop is expected ripe from which it is listed with no harvest task.
  const GAPS = Object.freeze({ ripeDays: 3 });
  // The windows that press at pawn id's household's tiles with no task of its plan covering them (a task at the tile of the
  // chain, or a task by key whose job is of the chain's kinds there): [{tile, chain, deadline {t, what}, days (left: whole days to the
  // deadline's day)}], by deadline: a field unsown in its open sowing window (plant); a meadow unmown in the haymaking window while the
  // household wants hay (hay: it mows only then, sim/meadows hayWanted); a sown field ripe, in stooks, or within GAPS.ripeDays of its
  // expected ripening (harvest). [] when id is no living pawn, or with no household. Over its farms' fields and meadows, a few tens;
  // writes nothing.
  function planGaps(st, id) {
    if (!Number.isInteger(id) || !st.pawns[id] || st.pawns[id].died !== null) return [];
    const hid = st.pawns[id].household,
      hh = hid === null ? null : st.households[hid];
    if (!hh || hh.dissolved) return [];
    const tasks = planOf(st, id) ? planOf(st, id).tasks : [],
      c = cal(st.t),
      d0 = Math.floor(st.t / DAY),
      home = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
      farms = home ? [home, ...heldFarms(st, hid)] : heldFarms(st, hid),
      out = [];
    let frost = null;
    const covered = (name, tile) =>
      tasks.some((t) =>
        chainOf(t) ? t.kind === name && t[name] === tile : t.site === tile && CHAINS[name].kinds.includes(t.kind),
      );
    const gap = (name, tile, where) => {
      if (covered(name, tile)) return;
      if ((name === 'harvest' || name === 'farmstead') && frost === null) frost = frostExpected(st); // VB-1667: the move's loads
      const deadline = CHAINS[name].deadline(st, hid, where, frost);
      if (deadline) out.push({ tile, chain: name, deadline, days: Math.floor(deadline.t / DAY) - d0 });
    };
    const doy = c.season * SEASON_DAYS + c.sday;
    for (const f of farms) {
      for (const fd of f.fields) {
        const C = CROPS[fd.crop];
        if ((fd.stage === 'stubble' || fd.stage === 'plowed') && !C.fallow && C.sow && C.seed > 0) {
          const W = C.sow;
          if (doy >= W[0] * SEASON_DAYS + W[1] && doy <= W[0] * SEASON_DAYS + W[2]) gap('plant', fd.tile, { f, fd });
        } else if (
          fd.stage === 'ripe' ||
          fd.stage === 'stooks' ||
          ((fd.stage === 'sown' || fd.stage === 'growing') && fd.sown + C.ripe - d0 <= GAPS.ripeDays)
        )
          gap('harvest', fd.tile, { f, fd });
      }
      const haying = c.season === 1 || (c.season === 2 && c.sday <= MOW_LAST);
      let want = null;
      for (const m of f.meadows)
        if (m.stage === 'grass' && haying && (want ?? (want = hayWanted(st, f, hh)))) gap('hay', m.tile, { f, m });
    }
    return out.sort((a, b) => a.deadline.t - b.deadline.t || a.tile - b.tile);
  }
  // Sim.buildMenu(st, pawn) (VB-1655; VB-1658): sim/camp's build menu for pawn id, each entry with `work`, the whole of it as the plan
  // reckons it: the hours of the steps its task would carry (its chain's, at the house: the timber trips with the raising), by the pawn's
  // own estimate (the middle of its range, as the plan's task shows it); `hours` stays the raising alone. Reads only.
  function buildMenu(st, id) {
    const menu = Camp.buildMenu(st, id);
    if (!menu.length) return menu;
    const hid = st.pawns[id].household,
      hh = hid === null ? null : st.households[hid],
      tile = hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead].house : -1;
    return menu.map((e) => {
      const ps =
          CHAINS[e.what] && tile >= 0 ? chainParts(st, id, hid, { kind: e.what, [e.what]: tile }, null).parts : [],
        work = ps.reduce((n, x) => n + x.e.mid, 0);
      return { ...e, work: ps.length ? Math.round(work * 10) / 10 : e.hours };
    });
  }
  return { agenda, after, past, planGaps, buildMenu };
})();
