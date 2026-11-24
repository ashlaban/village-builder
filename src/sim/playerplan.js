// @sys sim/playerplan: the player's plan (VB-1618; Kim, 24 Nov): a daily routine of job kinds, the sleeping hours and an ordered list of
//   tasks, edited by the player (Sim.plan) and read by the page (Sim.planView); `nextOf` is the one choice of what the plan has the pawn
//   do next, which sim/player's feeder queues with automatic behaviour off and the view reads without writing (VB-1619 reads it too);
//   a plant task (VB-1621) carries one field from its clearing to its sowing
VB['sim/playerplan'] = (() => {
  const { DAY, SEASON_DAYS, YEAR, WORK, cal } = VB['sim/rules'];
  const { CROPS, ROTATIONS } = VB['sim/crops'];
  const { projectsOf } = VB['sim/projects'];
  const { courseFor } = VB['sim/rotations'];
  const { heldFarms } = VB['sim/ownership'];
  const { KINDS } = VB['sim/kinds'];
  const { VERBS } = VB['sim/commands'];
  const { eligible } = VB['sim/eligibility'];
  const { living } = VB['sim/records'];
  // @state st.player.plan: absent until the player first plans (an older save reads as empty), else {routine[] (job kinds seen to every
  //   day, in order, at most PLAN_MAX), sleep (null, or {from, until}: hours of the day, the pawn sleeps from `from` to `until`), tasks[]
  //   (at most PLAN_MAX, in order: a task by key {key (a job's key), kind, site (its tile or -1)}, or a plant task {plant (a tile), kind:
  //   'plant', site (the same tile)}, VB-1621), day (the game day `done` is of), done[] (the routine kinds begun on day `day`), last (null,
  //   or the last task that left the plan: {key, kind, t}, its job finished or gone; or {plant, kind: 'plant', site, t, which: 'sown' |
  //   'closed' (its sowing window shut, the field unsown) | 'fallow' (the field made lies fallow this year) | 'gone' (no field nor project
  //   there now)})}; plain data, saved with st.player. A command the plan feeds to the queue carries `plan` {from: 'routine' | 'task' |
  //   'sleep', kind, key}, and `plant` (its tile) when a plant task fed it
  const PLAN_MAX = 24;
  const empty = (st) => ({ routine: [], sleep: null, tasks: [], day: Math.floor(st.t / DAY), done: [], last: null });
  const today = (st) => Math.floor(st.t / DAY);
  // Whether hour h is within the sleeping hours s (from `from` up to `until`, across midnight when from > until).
  const asleepAt = (s, h) => !!s && (s.from < s.until ? h >= s.from && h < s.until : h >= s.from || h < s.until);
  const workCmd = (id, key) => ({ actor: id, verb: 'work', target: key, args: null, source: 'player' });
  // ---- the player's act: Sim.plan(st, op, args), true or why not ----
  const hourOf = (h) => typeof h === 'number' && h >= 0 && h < 24;
  const index = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
  function plan(st, op, args) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    const dead = living(st, pl.pawn);
    if (dead) return dead;
    const g = args || {},
      pp = pl.plan || empty(st);
    if (op === 'add' && g.plant !== undefined) {
      const why = plantWhy(st, st.pawns[pl.pawn].household, g.plant);
      if (why) return why;
      if (pp.tasks.some((x) => x.plant === g.plant)) return `the field at ${g.plant} is already planned`;
      if (pp.tasks.length >= PLAN_MAX) return `the plan is full (${PLAN_MAX} tasks)`;
      const at = g.at === undefined || g.at === null ? pp.tasks.length : g.at;
      if (!(Number.isInteger(at) && at >= 0 && at <= pp.tasks.length)) return `there is no place ${g.at} in the plan`;
      pp.tasks.splice(at, 0, { plant: g.plant, kind: 'plant', site: g.plant });
    } else if (op === 'add') {
      const j = st.jobs.get(g.key);
      if (!j) return `there is no job ${g.key}`;
      if (!eligible(st, j, st.pawns[pl.pawn])) return `job ${g.key} is not the pawn's to take`;
      if (pp.tasks.some((x) => x.key !== undefined && x.key === g.key)) return `job ${g.key} is already planned`;
      if (pp.tasks.length >= PLAN_MAX) return `the plan is full (${PLAN_MAX} tasks)`;
      const at = g.at === undefined || g.at === null ? pp.tasks.length : g.at;
      if (!(Number.isInteger(at) && at >= 0 && at <= pp.tasks.length)) return `there is no place ${g.at} in the plan`;
      pp.tasks.splice(at, 0, { key: j.key, kind: j.kind, site: Number.isInteger(j.site) ? j.site : -1 });
    } else if (op === 'remove') {
      if (!index(g.i, pp.tasks.length)) return `the plan has no task ${g.i}`;
      pp.tasks.splice(g.i, 1);
    } else if (op === 'move') {
      if (!index(g.from, pp.tasks.length) || !index(g.to, pp.tasks.length))
        return `the plan cannot move task ${g.from} to ${g.to}`;
      pp.tasks.splice(g.to, 0, pp.tasks.splice(g.from, 1)[0]);
    } else if (op === 'routine') {
      const ks = g.kinds;
      if (!Array.isArray(ks) || ks.length > PLAN_MAX) return 'a routine is a list of job kinds';
      const bad = ks.find((k) => typeof k !== 'string' || !KINDS[k]);
      if (bad !== undefined) return `there is no job kind ${bad}`;
      if (new Set(ks).size !== ks.length) return 'a kind is in the routine twice';
      pp.routine = ks.slice();
      pp.done = pp.done.filter((k) => ks.includes(k));
    } else if (op === 'sleep') {
      if (args === null || args === undefined) pp.sleep = null;
      else if (!hourOf(g.from) || !hourOf(g.until) || g.from === g.until)
        return `cannot sleep from ${g.from} until ${g.until}`;
      else pp.sleep = { from: g.from, until: g.until };
    } else return `there is no plan op ${op}`;
    pl.plan = pp;
    return true;
  }
  // ---- a plant task (VB-1621; Kim, 24 Nov 2026): one field carried from its clearing to its sowing ----
  // The steps of a field in the order the work goes: a project's clearing and breaking, then the field's hoeing (or ploughing) and sowing.
  const SOWN = ['sown', 'growing', 'ripe', 'stooks'];
  // What stands at `tile` for household hid: {f, fd} (a field of its farm or of a farm it holds), {plan, f} (its open project making a
  // field there; f its farm), or null. A household's farms and fields are few.
  function plantAt(st, hid, tile) {
    const hh = hid === null || hid === undefined ? null : st.households[hid];
    if (!hh || hh.dissolved || !Number.isInteger(tile)) return null;
    const home = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    for (const f of home ? [home, ...heldFarms(st, hid)] : heldFarms(st, hid))
      for (const fd of f.fields) if (fd.tile === tile) return { f, fd };
    for (const p of projectsOf(st, 'household', hid)) {
      const s = p.steps[p.open];
      if (p.what === 'field' && s && s.place === tile) return { plan: p, f: home };
    }
    return null;
  }
  // The crop the field at `where` is sown with: its own, or for a project's the course a new field beside the farm's would take.
  function plantCrop(st, hid, where) {
    if (where.fd) return where.fd.crop;
    const { key, i } = courseFor(st, where.f ? where.f.fields : [], st.households[hid]);
    return ROTATIONS[key].courses[i];
  }
  const sowable = (k) => !CROPS[k].fallow && !!CROPS[k].sow && CROPS[k].seed > 0;
  // Crop k's sowing window this year, or next year's once this year's has shut: {opens, close (game hours; its first day's start of work,
  // the thaw not reckoned, and its last day's end of work), next (whether next year's)}; null for a crop not sown.
  function sowWindow(st, k) {
    if (!CROPS[k] || !sowable(k)) return null;
    const W = CROPS[k].sow,
      y0 = Math.floor(st.t / YEAR) * YEAR,
      close = (y) => y + (W[0] * SEASON_DAYS + W[2]) * DAY + WORK[1],
      y = close(y0) >= st.t ? y0 : y0 + YEAR;
    return { opens: y + (W[0] * SEASON_DAYS + W[1]) * DAY + WORK[0], close: close(y), next: y > y0 };
  }
  // Whether this year's sowing window of crop k has shut: its last day is past (sim/reasons windowLeft's count).
  const shut = (st, k) => {
    const W = CROPS[k].sow,
      c = cal(st.t);
    return c.season * SEASON_DAYS + c.sday > W[0] * SEASON_DAYS + W[2];
  };
  // Why household hid cannot plan a field at `tile`, or null: a field of its not yet sown this year with its sowing window not shut, or
  // the place of its open project making a field.
  function plantWhy(st, hid, tile) {
    const where = plantAt(st, hid, tile);
    if (!where) return `there is no field of the household's nor a field project at ${tile}`;
    if (where.plan) return null;
    const fd = where.fd;
    if (!sowable(fd.crop)) return `the field at ${tile} lies ${fd.crop} this year`;
    if (fd.stage !== 'stubble' && fd.stage !== 'plowed')
      return SOWN.includes(fd.stage) ? `the field at ${tile} is sown` : `the field at ${tile} is ${fd.stage}`;
    if (shut(st, fd.crop)) return `the ${fd.crop} sowing is over for this year`;
    return null;
  }
  // The steps left of a plant task at `tile` for household hid, in the order the work goes (a project's clearing and breaking, then the
  // field's hoeing and sowing): {where, crop, steps: [{kind, job (its job posted at the tile, or null), hours (of a step not posted: the
  // project step's, else the crop's)}]}; null where nothing of the household's stands there. Reads only.
  function plantSteps(st, hid, tile) {
    const where = plantAt(st, hid, tile);
    if (!where) return null;
    const crop = plantCrop(st, hid, where),
      C = CROPS[crop],
      kinds = where.plan
        ? where.plan.steps.slice(where.plan.open).map((s) => ({ kind: s.kind, hours: s.hours }))
        : where.fd.stage === 'stubble'
          ? [{ kind: 'plow' }]
          : [];
    if (sowable(crop) && (where.plan || where.fd.stage === 'stubble' || where.fd.stage === 'plowed')) {
      if (where.plan) kinds.push({ kind: 'plow' });
      kinds.push({ kind: 'sow' });
    }
    const js = st.jobsBy.get(`household:${hid}`),
      steps = kinds.map((s) => {
        let job = null;
        if (js) for (const j of js) if (j.kind === s.kind && j.site === tile) job = j;
        return { kind: s.kind, job, hours: s.hours ?? C.hours[s.kind] ?? KINDS[s.kind].hours };
      });
    return { where, crop, steps };
  }
  // Why a plant task leaves the plan now, or null: its field is sown; this year's window shut with it unsown; the field made lies fallow;
  // nothing of the household's stands there. A project's tile stays until its field is broken, whatever the season.
  function plantGone(st, hid, tile) {
    const where = plantAt(st, hid, tile);
    if (!where) return 'gone';
    if (where.plan) return null;
    const fd = where.fd;
    if (SOWN.includes(fd.stage)) return 'sown';
    if (!sowable(fd.crop)) return 'fallow';
    if (fd.stage !== 'stubble' && fd.stage !== 'plowed') return 'gone';
    return shut(st, fd.crop) ? 'closed' : null;
  }
  // The step of plant task tk the pawn may take now: the first step posted at its tile, in the order the work goes, if its `work` verb
  // lets the pawn take it; else null (the task stands).
  function plantJob(st, id, tk) {
    const s = plantSteps(st, st.pawns[id].household, tk.plant),
      first = s && s.steps.find((x) => x.job);
    return first && VERBS.work.check(st, workCmd(id, first.job.key)) === null ? first.job : null;
  }
  // ---- what comes next ----
  const handQueued = (pl) => pl.queue.some((c) => !c.plan);
  // The first job of kind k of the pawn's household that its `work` verb would let it take now, or null.
  function routineJob(st, id, k) {
    const hid = st.pawns[id].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (js) for (const j of js) if (j.kind === k && VERBS.work.check(st, workCmd(id, j.key)) === null) return j;
    return null;
  }
  // What the plan has the played pawn do next, as a command with its `plan` mark, or null: in its sleeping hours, sleep until `until`;
  // else the first routine kind not begun today with a job of its household it may take; else the first task whose job stands and may
  // be taken now. A command queued by hand goes first: with one queued, null. Reads only; writes nothing.
  function nextOf(st) {
    const pl = st.player,
      pp = pl && pl.plan;
    if (!pp || living(st, pl.pawn) || handQueued(pl)) return null;
    const id = pl.pawn;
    if (asleepAt(pp.sleep, cal(st.t).hour)) {
      const cmd = { actor: id, verb: 'sleep', target: null, args: { until: pp.sleep.until }, source: 'player' };
      return VERBS.sleep.check(st, cmd) === null ? { ...cmd, plan: { from: 'sleep', kind: null, key: null } } : null;
    }
    const done = pp.day === today(st) ? pp.done : [];
    for (const k of pp.routine) {
      if (done.includes(k)) continue;
      const j = routineJob(st, id, k);
      if (j) return { ...workCmd(id, j.key), plan: { from: 'routine', kind: k, key: j.key } };
    }
    for (const t of pp.tasks) {
      if (t.plant !== undefined) {
        const j = plantJob(st, id, t);
        if (j) return { ...workCmd(id, j.key), plan: { from: 'task', kind: j.kind, key: j.key, plant: t.plant } };
      } else if (st.jobs.has(t.key) && VERBS.work.check(st, workCmd(id, t.key)) === null)
        return { ...workCmd(id, t.key), plan: { from: 'task', kind: t.kind, key: t.key } };
    }
    return null;
  }
  // ---- the feeder's writes (sim/player's playerStep) ----
  // A new day clears the routine's `done`; a task whose job is finished or gone leaves the plan, the last one kept in `last`; a plant task
  // leaves when its field is sown or its window shut (plantGone).
  function planDay(st) {
    const pp = st.player.plan,
      d = today(st);
    if (pp.day !== d) {
      pp.day = d;
      pp.done = [];
    }
    for (let i = pp.tasks.length - 1; i >= 0; i--) {
      const t = pp.tasks[i];
      if (t.plant !== undefined) {
        const which = plantGone(st, st.pawns[st.player.pawn].household, t.plant);
        if (which) {
          pp.tasks.splice(i, 1);
          pp.last = { plant: t.plant, kind: 'plant', site: t.site, t: st.t, which };
        }
        continue;
      }
      if (st.jobs.has(t.key)) continue;
      pp.tasks.splice(i, 1);
      pp.last = { key: t.key, kind: t.kind, t: st.t };
    }
  }
  // A routine kind's command was begun: it is done for the day.
  function planBegun(st, mark) {
    const pp = st.player.plan;
    if (mark.from === 'routine' && pp && !pp.done.includes(mark.kind)) pp.done.push(mark.kind);
  }
  // ---- the page's read: Sim.planView(st) ----
  // A plant task as the view shows it: its tile, the kind of the step open or next (`step`, null with none left), whether that step's job
  // is posted (`stands`), and its job's key (null while not posted).
  function plantView(st, hid, t) {
    const s = plantSteps(st, hid, t.plant),
      x = s && s.steps[0];
    return {
      plant: t.plant,
      kind: 'plant',
      site: t.site,
      key: x && x.job ? x.job.key : null,
      step: x ? x.kind : null,
      stands: !!(x && x.job),
    };
  }
  // The routine, each kind with whether it is done today and whether a job of it is posted for the household; the sleeping hours; the
  // tasks, each with whether its job stands; the last task that left; what the plan has the pawn on now (the queue's head, if the plan
  // fed it) and what it would feed next. null with no pawn played.
  function planView(st) {
    const pl = st.player;
    if (!pl) return null;
    const pp = pl.plan || empty(st),
      hid = st.pawns[pl.pawn].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`),
      done = pp.day === today(st) ? pp.done : [];
    const posted = (k) => {
      if (js) for (const j of js) if (j.kind === k) return true;
      return false;
    };
    const head = pl.queue[0],
      mark = head && head.plan,
      next = nextOf(st);
    return {
      routine: pp.routine.map((k) => ({ kind: k, done: done.includes(k), open: posted(k) })),
      sleep: pp.sleep ? { from: pp.sleep.from, until: pp.sleep.until } : null,
      tasks: pp.tasks.map((t) =>
        t.plant !== undefined
          ? plantView(st, hid, t)
          : { key: t.key, kind: t.kind, site: t.site, stands: st.jobs.has(t.key) },
      ),
      last: pp.last ? { ...pp.last } : null,
      now: mark ? { what: mark.from, kind: mark.kind, key: mark.key } : null,
      next: next ? { what: next.plan.from, kind: next.plan.kind, key: next.plan.key } : null,
      followed: !pl.auto,
    };
  }
  return { PLAN_MAX, plan, planView, nextOf, planDay, planBegun, asleepAt, plantSteps, sowWindow };
})();
