// @sys sim/agenda: the played pawn's agenda (VB-1616; docs/ui2/HANDOFF.md): its queue laid end to end from now and the open work it may
// take, each with the hours the pawn itself reckons it takes (sim/estimate; principle 14: what is shown of the future is some pawn's
// estimate), the deadline that presses (a field's sowing window, the frost the head expects, the haymaking window) and whether it ends in
// time; for a step of a project making a field, the steps left before the field can be sown; and the player's plan (sim/playerplan) laid
// into today and the next two days by the feeder's rule (VB-1619: days, plan, owed, routine). A view computed when the page asks, as
// sim/reasons is: it writes nothing, draws nothing, and no simulation module reads it (tests/agenda.js)
VB['sim/agenda'] = (() => {
  const { DAY, SEASON_DAYS, YEAR, WORK, SPEED, cal } = VB['sim/rules'];
  const { CROPS, ROTATIONS } = VB['sim/crops'];
  const { KINDS } = VB['sim/kinds'];
  const { estimate } = VB['sim/estimate'];
  const { windowLeft, cause } = VB['sim/reasons'];
  const { projectsOf } = VB['sim/projects'];
  const { courseFor } = VB['sim/rotations'];
  const { MOW_LAST } = VB['sim/meadows'];
  const { workFor } = VB['sim/opportunities'];
  const { here, walkHours } = VB['sim/pose'];
  const { toAxial, hexDist } = VB['world/grid'];
  const { asleepAt, plantSteps, sowWindow } = VB['sim/playerplan'];
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
  // ---- the plan laid into days (VB-1619): the feeder's rule (sim/playerplan nextOf, sim/player feed) followed forward in time ----
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
    const K = KINDS[j.kind] || {},
      e = estimate(st, id, j, [id]),
      trip = at !== null && K.trip && j.farm ? K.trip(st, j) : 0,
      w = at === null || trip > 0 ? 0 : (walk(st, at, j.site) ?? 0),
      back = trip > 0 ? trip : K.back ? (walk(st, j.site, home) ?? 0) : 0;
    return { e, w, back, hours: w + e.mid + back, ends: K.back && home >= 0 ? home : (j.site ?? at) };
  }
  // The job of kind k posted for household hid (a household's jobs, a few tens), or null.
  function postedJob(st, hid, k) {
    const js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (js) for (const j of js) if (j.kind === k) return j;
    return null;
  }
  // The job of routine kind k, or where none is posted a step of the kind's hours, at the household's water for a kind drawn there.
  function routineJob(st, hid, k) {
    const j = postedJob(st, hid, k);
    if (j) return j;
    const s = step(k, KINDS[k].hours ?? 0, hid),
      f = hid === null || st.households[hid].farmstead === null ? null : st.farmsteads[st.households[hid].farmstead];
    if (f && f.water && (KINDS[k].at || []).includes('water')) Object.assign(s, { farm: f, site: f.water.tile });
    return s;
  }
  // A plant task's steps left (sim/playerplan plantSteps, VB-1621) as parts of its work: {kind, key (its job's, null while not posted), e
  // (the pawn's estimate: of the job posted, else of the step's hours), rough (not posted), from (the hour it may begin: a hoeing or a
  // sowing not posted at its sowing window's opening)}; with the window and the crop.
  function plantParts(st, id, hid, tk) {
    const s = plantSteps(st, hid, tk.plant);
    if (!s) return { parts: [], win: null, crop: null };
    const win = sowWindow(st, s.crop);
    const parts = s.steps.map((x) => ({
      kind: x.kind,
      key: x.job ? x.job.key : null,
      e: estimate(st, id, x.job || step(x.kind, x.hours, hid), [id]),
      rough: !x.job,
      from: !x.job && win && (x.kind === 'plow' || x.kind === 'sow') ? win.opens : -Infinity,
    }));
    return { parts, win, crop: s.crop };
  }
  // The plan laid from now: {days (NDAYS lists of segments {from, to, what, kind, key, site}; a plant task's by the kind and key of its
  // step), plan (each task's entry where the layout puts it; a plant task's with its steps left, as `then` lays a project's), owed (the
  // hours of sleep owed at each day's end), routine ([{kind, hours}]: a day's work of each routine kind, from home)}.
  // Hand-queued commands first, end to end; then, the plan followed (automatic behaviour off), the sleeping hours, the routine once a day
  // in order (a kind with no job posted now waits for its window; on the days after, a kind with a window is taken from its opening, one
  // without from the day's start if a job of it is posted now), the tasks in order, broken off at the sleeping hour; else free.
  // Bounded by the queue, the plan's length and the days laid (at most NDAYS + BEYOND).
  function layout(st, id, entries) {
    const pl = st.player,
      a = st.agents[id],
      pp = pl.plan || null,
      followed = !!pp && !pl.auto,
      hid = st.pawns[id].household,
      hh = hid === null ? null : st.households[hid],
      home = (hh && hh.farmstead !== null ? st.farmsteads[hh.farmstead].house : -1) ?? -1,
      d0 = Math.floor(st.t / DAY),
      end = (d0 + NDAYS) * DAY,
      far = end + BEYOND * DAY,
      sl = followed ? pp.sleep : null,
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
    const hand = pl.queue.some((q) => !q.plan),
      begun = new Set();
    pl.queue.forEach((q, i) => {
      if (q.plan && (hand || q.plan.from !== 'routine')) return; // the sleeping hours and the tasks are laid below
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
    const head = pl.queue[0],
      mark = !hand && head && head.plan && head.plan.from === 'task' && head.begun !== null ? head.plan : null,
      underWay = mark ? mark.key : null,
      underWayAt = (tk) =>
        !!mark && (tk.plant !== undefined ? mark.plant === tk.plant : mark.plant === undefined && underWay === tk.key);
    // each task's parts (a task by key: its job; a plant task: its steps left), the part laid now and its hours left
    const parts = [],
      part = [],
      pleft = [];
    if (pp)
      for (const tk of pp.tasks) {
        if (tk.plant !== undefined) {
          const { parts: ps, win, crop } = plantParts(st, id, hid, tk),
            sum = (k) => ps.reduce((n, x) => n + x.e[k], 0);
          parts.push(ps);
          part.push(0);
          pleft.push(ps.length ? ps[0].e.mid : 0);
          left.push(sum('mid'));
          plan.push({
            plant: tk.plant,
            kind: 'plant',
            site: tk.site,
            key: ps.length ? ps[0].key : null,
            step: ps.length ? ps[0].kind : null,
            stands: ps.length > 0 && !ps[0].rough,
            hours: ps.length ? { lo: sum('lo'), mid: sum('mid'), hi: sum('hi') } : null,
            starts: null,
            ends: null,
            deadline: win
              ? { t: win.close, what: `the end of the ${crop} sowing${win.next ? ' next year' : ''}` }
              : null,
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
        parts.push(e ? [{ kind: tk.kind, key: tk.key, e, rough: false, from: -Infinity }] : []);
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
      // the first task with work left whose part may begin now (a plant task's hoeing waits for its sowing window)
      const i = left.findIndex((l, n) => l > 1e-9 && parts[n][part[n]].from <= t + 1e-9);
      if (i >= 0) {
        const tk = pp.tasks[i],
          P = parts[i][part[i]],
          j = P.key === null ? null : st.jobs.get(P.key),
          site = j ? (j.site ?? tk.site) : tk.site,
          w = (underWayAt(tk) && plan[i].starts === null) || at === site ? 0 : (walk(st, at, site) ?? 0),
          to = Math.min(t + w + pleft[i], bed, far),
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
      if (e.kind === 'plant') {
        // a plant task: its parts not laid reckoned on past the days searched, each from its own opening; the chain's verdict
        if (!followed || !parts[i].length) continue;
        if (e.ends === null) {
          let u = Math.max(t, far, parts[i][part[i]].from);
          if (e.starts === null) e.starts = u;
          u = past(u, pleft[i], sl);
          for (const P of parts[i].slice(part[i] + 1)) u = past(Math.max(u, P.from), P.e.mid, sl);
          e.ends = u;
        }
        e.verdict = verdict(e.deadline, e.ends, past(e.ends, e.hours.hi - e.hours.mid, sl));
        continue;
      }
      if (!e.stands || !followed) continue;
      if (e.ends === null) e.ends = past(Math.max(t, far), left[i], sl);
      if (e.starts === null) e.starts = Math.max(t, far);
      const hi = past(e.ends, e.hours.hi - e.hours.mid, sl),
        j = st.jobs.get(e.key);
      e.verdict = verdict(e.deadline, e.ends, hi);
      e.then = thenOf(st, id, j, j.owner && j.owner.id, e.ends, hi);
    }
    // the hours of sleep owed at each day's end (VB-1615): an hour asleep pays one, an hour awake owes AWAKE; free hours outside the
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
  // The agenda of the played pawn, or null with none played (or its pawn dead): {queue, open, day}. Over its own queue and its household's
  // and village's open work only.
  function agenda(st) {
    const pl = st.player;
    if (!pl || !st.pawns[pl.pawn] || st.pawns[pl.pawn].died !== null) return null;
    const id = pl.pawn,
      a = st.agents[id],
      c = cal(st.t),
      now = here(st, a);
    const queue = [],
      queued = new Set();
    let t = st.t,
      at = now,
      work = 0;
    for (const cmd of pl.queue) {
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
  return { agenda, after, past };
})();
