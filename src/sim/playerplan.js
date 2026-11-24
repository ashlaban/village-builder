// @sys sim/playerplan: the player's plan (VB-1618; Kim, 24 Nov): a daily routine of job kinds, the sleeping hours and an ordered list of
//   tasks, edited by the player (Sim.plan) and read by the page (Sim.planView); `nextOf` is the one choice of what the plan has the pawn
//   do next, which sim/player's feeder queues with automatic behaviour off and the view reads without writing (VB-1619 reads it too)
VB['sim/playerplan'] = (() => {
  const { DAY, cal } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'];
  const { VERBS } = VB['sim/commands'];
  const { eligible } = VB['sim/eligibility'];
  const { living } = VB['sim/records'];
  // @state st.player.plan: absent until the player first plans (an older save reads as empty), else {routine[] (job kinds seen to every
  //   day, in order, at most PLAN_MAX), sleep (null, or {from, until}: hours of the day, the pawn sleeps from `from` to `until`), tasks[]
  //   (at most PLAN_MAX {key (a job's key), kind, site (its tile or -1)}, in order), day (the game day `done` is of), done[] (the routine
  //   kinds begun on day `day`), last (null, or {key, kind, t}: the last task that left the plan, its job finished or gone)}; plain data,
  //   saved with st.player. A command the plan feeds to the queue carries `plan` {from: 'routine' | 'task' | 'sleep', kind, key}
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
    if (op === 'add') {
      const j = st.jobs.get(g.key);
      if (!j) return `there is no job ${g.key}`;
      if (!eligible(st, j, st.pawns[pl.pawn])) return `job ${g.key} is not the pawn's to take`;
      if (pp.tasks.some((x) => x.key === g.key)) return `job ${g.key} is already planned`;
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
    for (const t of pp.tasks)
      if (st.jobs.has(t.key) && VERBS.work.check(st, workCmd(id, t.key)) === null)
        return { ...workCmd(id, t.key), plan: { from: 'task', kind: t.kind, key: t.key } };
    return null;
  }
  // ---- the feeder's writes (sim/player's playerStep) ----
  // A new day clears the routine's `done`; a task whose job is finished or gone leaves the plan, the last one kept in `last`.
  function planDay(st) {
    const pp = st.player.plan,
      d = today(st);
    if (pp.day !== d) {
      pp.day = d;
      pp.done = [];
    }
    for (let i = pp.tasks.length - 1; i >= 0; i--) {
      const t = pp.tasks[i];
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
      tasks: pp.tasks.map((t) => ({ key: t.key, kind: t.kind, site: t.site, stands: st.jobs.has(t.key) })),
      last: pp.last ? { ...pp.last } : null,
      now: mark ? { what: mark.from, kind: mark.kind, key: mark.key } : null,
      next: next ? { what: next.plan.from, kind: next.plan.kind, key: next.plan.key } : null,
      followed: !pl.auto,
    };
  }
  return { PLAN_MAX, plan, planView, nextOf, planDay, planBegun, asleepAt };
})();
