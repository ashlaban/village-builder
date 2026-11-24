// @sys sim/planview: the page's reads of the player's plan (Sim.planView: the routine, the sleeping hours, the tasks with why each waits,
//   what the plan has the pawn on and does next) and of the fire (Sim.fireView, VB-1625); views computed when the page asks, as sim/agenda
//   is: they write nothing and no simulation module reads them (VB-1618; VB-1629 split them from sim/playerplan)
VB['sim/planview'] = (() => {
  const { cal } = VB['sim/rules'];
  const { timberOf } = VB['sim/chores'];
  const { chainOf, chainSteps, pileOf } = VB['sim/planchains'];
  const { empty, today } = VB['sim/playerplan'];
  const { nextOf, waitsOf } = VB['sim/plannext'];
  // ---- the page's read: Sim.planView(st) ----
  // A task at a tile as the view shows it: its tile (under its chain's name), the kind of the step open or next (`step`, null with none
  // left), whether that step's job is posted (`stands`), and its job's key (null while not posted).
  function chainView(st, hid, t) {
    const s = chainSteps(st, hid, t.kind, t[t.kind]),
      x = s && s.steps[0];
    return {
      [t.kind]: t[t.kind],
      kind: t.kind,
      site: t.site,
      key: x && x.job ? x.job.key : null,
      step: x ? x.kind : null,
      stands: !!(x && x.job),
      ...(t.n !== undefined ? { n: t.n, got: t.got } : {}), // a fell task's trips planned and home (VB-1625)
    };
  }
  // The routine, each kind with whether it is done today and whether a job of it is posted for the household; the sleeping hours; the
  // tasks, each with whether its job stands and why it waits (`waits`, VB-1623); why the plan has the pawn idle (`idle`); the last task
  // that left; what the plan has the pawn on now (the queue's head, if the plan
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
      next = nextOf(st),
      W = waitsOf(st);
    return {
      routine: pp.routine.map((k) => ({ kind: k, done: done.includes(k), open: posted(k) })),
      sleep: pp.sleep ? { from: pp.sleep.from, until: pp.sleep.until } : null,
      tasks: pp.tasks.map((t, i) => ({
        ...(chainOf(t)
          ? chainView(st, hid, t)
          : { key: t.key, kind: t.kind, site: t.site, stands: st.jobs.has(t.key) }),
        waits: W.tasks[i] || null,
      })),
      idle: W.idle,
      last: pp.last ? { ...pp.last } : null,
      now: mark ? { what: mark.from, kind: mark.kind, key: mark.key } : null,
      next: next ? { what: next.plan.from, kind: next.plan.kind, key: next.plan.key } : null,
      followed: !pl.auto,
    };
  }
  // ---- the page's read of the fire (VB-1625): Sim.fireView(st) ----
  // How the fire stands for the played pawn's household: wood (firewood held), timber (held, not yet cut), peat (held), free (the pile's
  // free fuel, sim/chores fuelFree: what a project holds back left out, peat at its worth), goal (the season's, the head's plan's), nights
  // (whole nights the free pile lasts at the season's use, ECON.woodUse), cold (the house went cold last night), short (the pile below the
  // goal, or the house cold), mend (what would mend it, in order: [] when not short; 'firewood' first when timber is home, 'fell' when
  // none is or what is home falls short of the goal), planned ({fell, firewood}: whether the plan holds a task of each). null with no
  // pawn played or no household with a farm. Plain data; writes nothing.
  function fireView(st) {
    const pl = st.player;
    if (!pl) return null;
    const hid = st.pawns[pl.pawn].household,
      hh = hid === null ? null : st.households[hid];
    if (!hh || hh.dissolved || hh.farmstead === null) return null;
    const p = pileOf(st, hh),
      timber = timberOf(hh),
      use = st.ECON.woodUse[cal(st.t).season],
      cold = hh.cold > 0,
      short = cold || p.short,
      mend = [],
      tasks = pl.plan ? pl.plan.tasks : [];
    if (short) {
      if (timber > 0) mend.push('firewood');
      if (!timber || p.free + timber < p.goal) mend.push('fell');
      if (!timber) mend.push('firewood');
    }
    return {
      wood: hh.wood,
      timber,
      peat: hh.peat || 0,
      free: p.free,
      goal: p.goal,
      nights: use > 0 ? Math.floor(Math.max(0, p.free) / use + 1e-9) : Infinity,
      cold,
      short,
      mend,
      planned: {
        fell: tasks.some((t) => t.key === undefined && t.kind === 'fell'),
        firewood: tasks.some((t) => t.key === undefined && t.kind === 'firewood'),
      },
    };
  }
  return { planView, fireView };
})();
