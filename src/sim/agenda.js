// @sys sim/agenda: the played pawn's agenda (VB-1616; docs/ui2/HANDOFF.md): its queue laid end to end from now and the open work it may
// take, each with the hours the pawn itself reckons it takes (sim/estimate; principle 14: what is shown of the future is some pawn's
// estimate), the deadline that presses (a field's sowing window, the frost the head expects, the haymaking window) and whether it ends in
// time; for a step of a project making a field, the steps left before the field can be sown. A view computed when the page asks, as
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
    return { queue, open, day: { left, queued: work } };
  }
  return { agenda, after };
})();
