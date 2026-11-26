// @sys sim/planview: the page's reads of a pawn's plan (Sim.planView(st, pawn), VB-1746: the routine, the sleeping hours, the tasks with why each waits,
//   what the plan has the pawn on and does next) and of the fire (Sim.fireView, VB-1653); views computed when the page asks, as sim/agenda
//   is: they write nothing and no simulation module reads them (VB-1646; VB-1657 split them from sim/playerplan;
//   the pawn's own steps of its plan record since VB-1754)
VB['sim/planview'] = (() => {
  const { cal, DAY } = VB['sim/rules'];
  const { timberOf } = VB['sim/chores'];
  const { chainOf, chainSteps, pileOf } = VB['sim/planchains'];
  const { pawnPlan: planOf } = VB['sim/steps'];
  const { controlOf, nextOf, waitsOf } = VB['sim/controller'];
  const today = (st) => Math.floor(st.t / DAY);
  const empty = (st) => ({ routine: [], sleep: null, tasks: [], steps: [], day: today(st), done: [], last: null });
  const { supplyOutlook, reckon } = VB['sim/outlook'];
  const { fireOf } = VB['sim/house'];
  // ---- the page's read: Sim.planView(st, id) ----
  // A task at a tile as the view shows it: its tile (under its chain's name), the kind of the step open or next (`step`, null with none
  // left), whether that step's job is posted (`stands`), and its job's key (null while not posted).
  function chainView(st, hid, t) {
    const s = chainSteps(st, hid, t.kind, t[t.kind], t),
      x = s && s.steps[0];
    return {
      [t.kind]: t[t.kind],
      kind: t.kind,
      site: t.site,
      key: x && x.job ? x.job.key : null,
      step: x ? x.kind : null,
      stands: !!(x && x.job),
      ...(t.n !== undefined ? { n: t.n, got: t.got } : {}), // a fell task's trips planned and home (VB-1653)
    };
  }
  // The routine, each kind with whether it is done today and whether a job of it is posted for the household; the sleeping hours; the
  // tasks, each with whether its job stands and why it waits (`waits`, VB-1651); why the plan has the pawn idle (`idle`); the last task
  // that left; what the plan has the pawn on now (the queue's head, if the plan
  // fed it) and what it would feed next. null when id is no pawn.
  function planView(st, id) {
    if (!Number.isInteger(id) || !st.pawns[id]) return null;
    const pp = planOf(st, id) || empty(st),
      hid = st.pawns[id].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`),
      done = pp.day === today(st) ? pp.done : [];
    const posted = (k) => {
      if (js) for (const j of js) if (j.kind === k) return true;
      return false;
    };
    const head = controlOf(st, id).queue[0],
      mark = head && head.plan,
      next = nextOf(st, id),
      W = waitsOf(st, id);
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
      followed: !controlOf(st, id).auto,
    };
  }
  // ---- the page's read of the fire (VB-1653): Sim.fireView(st, id) ----
  // How the fire stands for pawn id's household: wood (firewood held), timber (held, not yet cut), peat (held), free (the pile's
  // free fuel, sim/chores fuelFree: what a project holds back left out, peat at its worth), goal (the season's, the head's plan's), nights
  // (whole nights the free pile lasts at the season's use, ECON.woodUse, times the house's own fire, sim/house fireOf), cold (the house
  // went cold last night), short (the house cold, or the fuel of the supply outlook not lasting its frame), state, lasts, season (VB-1661: the
  // outlook's fuel, its state, its `with`
  // and its first short season, the one reckoning the page shows; null season when it lasts), below (the pile below the season's goal,
  // the head's target for its cutting), mend (what would mend it, in order: [] when not short; 'firewood' first when timber is home and
  // the pile is below its goal or the house cold, 'fell' when no timber is or what is home falls short of the goal or of the frame),
  // planned ({fell, firewood}: whether its plan holds a task of each). null when id is no pawn, or with no household with a farm. Plain data;
  // writes nothing.
  // One reckoning of the fire (VB-1661): `short` reads the outlook's fuel (sim/outlook: the pile and the timber the plan cuts, walked
  // against each season's use over the frame), not the pile against the season's goal, which is only the head's target for its cutting
  // and was short on a hand start's first morning while the outlook counted the head's cutting and said it lasted the year.
  function fireView(st, id) {
    if (!Number.isInteger(id) || !st.pawns[id]) return null;
    const hid = st.pawns[id].household,
      hh = hid === null ? null : st.households[hid];
    if (!hh || hh.dissolved || hh.farmstead === null) return null;
    const p = pileOf(st, hh),
      timber = timberOf(hh),
      use = st.ECON.woodUse[cal(st.t).season] * fireOf(st, hh),
      cold = hh.cold > 0,
      O = supplyOutlook(st, hid),
      fuel = O ? O.fuel : reckon(st, hh, st.plans.households.get(hid)).fuel, // before the household's first review
      short = cold || fuel.state !== 'safe',
      mend = [],
      tasks = planOf(st, id) ? planOf(st, id).tasks : [];
    if (short) {
      const cut = timber > 0 && (cold || p.short);
      if (cut) mend.push('firewood');
      if (!cut || p.free + timber < p.goal) mend.push('fell');
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
      state: fuel.state,
      lasts: fuel.with,
      season: fuel.season,
      below: p.short,
      mend,
      planned: {
        fell: tasks.some((t) => t.key === undefined && t.kind === 'fell'),
        firewood: tasks.some((t) => t.key === undefined && t.kind === 'firewood'),
      },
    };
  }
  return { planView, fireView };
})();
