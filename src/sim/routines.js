// @sys sim/routines: the village's routines (design.md section 7, Village routines; VB-257): the village work a meeting may choose, how
// it chooses, the founders' first choice, the meeting's verb that sets them, and the steps the village's review takes for them (the
// green's project, a common field's and its seed)
VB['sim/routines'] = (() => {
  const { cal } = VB['sim/rules'];
  const { settlement, unplanned } = VB['sim/records'];
  const { agentOf, agentWhy } = VB['sim/decisions'];
  const Stores = VB['sim/stores'],
    SEED_CROP = 'barley',
    SEED = Stores.grainGood(SEED_CROP);
  const { seedNeed } = VB['sim/hunger'];
  const { makeProject } = VB['sim/projectplans'];
  const { register, issue } = VB['sim/commands'];
  const Green = VB['sim/green'],
    Workdays = VB['sim/workdays'],
    Commons = VB['sim/commons'],
    Tar = VB['sim/tar'];
  // @state plan.routines (a village's; VB-257): the keys of VILLAGE_ROUTINES the village does this year, at most MAX_ROUTINES, each a source
  //   of the village's tasks (sim/jobs asks only their kinds); plan.routinesBy: how they were set, 'founded' (the founders' choice, until
  //   the first meeting), 'meeting' (the meeting decided), or, when it did not decide, its culture's practice noDecision ('nothing',
  //   'asLastYear'); plan.routinesYear: the year of cal they were set. Written only by setRoutines, through the meeting's verb.
  // The village work a meeting may choose from, in the order it is weighed: each routine names the kinds it is the source of (asked at
  // the village's review, sim/jobs), whether the village has that work this year, and how much it weighs at the meeting (`need`, a
  // stand-in for the voices' support until slice 5's Decisions, VB-313). The fence's stretches are the first; the green and well (VB-058),
  // a common field (VB-100) and work days (VB-120) add theirs.
  const VILLAGE_ROUTINES = Object.freeze({
    fence: Object.freeze({
      label: 'Keeping the village fence',
      kinds: Object.freeze(['mend']),
      available: (st, v) => v.fence.length > 0,
      need: (st, v) => {
        let n = 0;
        for (const s of v.fence) n += 1 - s.cond;
        return n;
      },
    }),
    // the green and well (VB-058): while the village has two or more occupied farms and no well, or its green is under way; weighed by
    // the farms that would draw water there
    green: Object.freeze({
      label: 'Laying out the green and digging the well',
      kinds: Object.freeze(['green', 'wellstone', 'well', 'sweep']),
      available: (st, v) => Green.wanted(st, v),
      need: (st, v) => Green.houses(st, v).length,
    }),
    // work days (VB-120): while the village has a fence to close; weighed, as the green, by the farms that would turn out. Set only by a
    // meeting, for the coming year (Kim, 10 Nov): the founders' first routines hold none
    workdays: Object.freeze({
      label: 'Work days at the fence and the commons',
      meeting: true,
      kinds: Object.freeze(['workfence', 'workclear']),
      available: (st, v) => Workdays.wanted(st, v),
      need: (st, v) => Green.houses(st, v).length,
    }),
    // a common field (VB-100; Kim, 10 Nov): while the village has common fields to work, one under way, or would make one (sim/commons:
    // three or more farms, its store short, meadow near the green); weighed, as the green, by its farms. Set only by a meeting. Its jobs
    // are posted by one shared rule (sim/kinds' commonWork), which asks the routine itself
    commons: Object.freeze({
      label: 'A common field for the village store',
      meeting: true,
      kinds: Object.freeze([]),
      available: (st, v) => Commons.available(st, v),
      need: (st, v) => Green.houses(st, v).length,
    }),
  });
  const MAX_ROUTINES = 4;
  // The routines chosen from candidates [[need, key]], most needed first and in their order of declaration between equals: at most
  // MAX_ROUTINES, or null when the last place is tied with the first left out (the meeting does not decide). Pure.
  function rankRoutines(cands) {
    const order = Object.keys(VILLAGE_ROUTINES),
      sorted = [...cands].sort((a, b) => b[0] - a[0] || order.indexOf(a[1]) - order.indexOf(b[1]));
    if (sorted.length > MAX_ROUTINES && sorted[MAX_ROUTINES - 1][0] === sorted[MAX_ROUTINES][0]) return null;
    return sorted.slice(0, MAX_ROUTINES).map((c) => c[1]);
  }
  // The routines a village would choose from its work available now, or null for a tie; its founders (`founders`) choose none that only a
  // meeting sets (`meeting`).
  function chooseRoutines(st, v, founders = false) {
    const cands = [];
    for (const k of Object.keys(VILLAGE_ROUTINES)) {
      const R = VILLAGE_ROUTINES[k];
      if (!(founders && R.meeting) && R.available(st, v)) cands.push([R.need(st, v), k]);
    }
    return rankRoutines(cands);
  }
  // Why a list of routines may not be a village's, or null: each a known routine, once, at most MAX_ROUTINES.
  function routinesWhy(list) {
    if (!Array.isArray(list)) return 'the routines are not a list';
    if (list.length > MAX_ROUTINES) return `at most ${MAX_ROUTINES} routines`;
    for (const k of list) if (!Object.hasOwn(VILLAGE_ROUTINES, k)) return `there is no routine ${k}`;
    return new Set(list).size === list.length ? null : 'a routine is named twice';
  }
  // The village's routines become `list`, set `by` ('founded', 'meeting', 'nothing', 'asLastYear'): the one writer (the meeting's verb,
  // sim/commands, and the plan's making). They post from the village's next review on; those no longer chosen are taken down at it.
  function setRoutines(st, vid, list, by) {
    const plan = st.plans.villages.get(vid);
    plan.routines = [...list];
    plan.routinesBy = by;
    plan.routinesYear = cal(st.t).year;
  }
  // Does the village's plan ask kind k this year: is it a kind of one of its routines. Allocates nothing.
  function routineAsks(plan, k) {
    const list = plan.routines;
    for (let i = 0; i < list.length; i++) if (VILLAGE_ROUTINES[list[i]].kinds.includes(k)) return true;
    return false;
  }
  // A village's first routines, until its first meeting: what its founders would choose from the work it has (a tie: all of it, the first
  // MAX_ROUTINES in their order). Also at the load of a save made before routines.
  function founded(st, plan) {
    const v = st.villages[plan.holder.id],
      list = chooseRoutines(st, v, true);
    setRoutines(
      st,
      v.id,
      list ||
        Object.keys(VILLAGE_ROUTINES)
          .filter((k) => !VILLAGE_ROUTINES[k].meeting && VILLAGE_ROUTINES[k].available(st, v))
          .slice(0, MAX_ROUTINES),
      'founded',
    );
  }
  // ---- what the meeting decided, carried out by the alderman (VB-673): the routines are the meeting's decision (plan.routines, plain data
  // set by its verb below); at the village's review its alderman, at home, begins the work they hold, each by a verb whose actor he is. With
  // no alderman, or one away, nothing of the village's is begun and the act waits for a later review. The played pawn as alderman has the
  // same verbs; while it is unplanned its own rule begins nothing ----
  // The project a routine lays out for village v now, or null: the green and well (sim/green, VB-058), a common field (sim/commons, VB-100).
  const LAYOUTS = {
    green: { project: (st, v) => Green.greenProject(st, v), made: (st, v, p) => Green.laidOut(st, v, p) },
    commons: { project: (st, v) => Commons.project(st, v), made: (st, v, p) => Commons.begun(st, v, p) },
  };
  // Why the actor may not act for village `vid` on routine `what`, or null: he is its alderman, at home, and its meeting chose the routine.
  function routineWhy(st, c, what) {
    const vid = c.target,
      plan = Number.isInteger(vid) ? st.plans.villages.get(vid) : undefined;
    if (!plan) return `village ${vid} has no plan`;
    return (
      agentWhy(st, vid, c.actor) ||
      (plan.routines.includes(what) ? null : `the meeting of ${st.villages[vid].name} did not choose the ${what}`)
    );
  }
  // layOut(village, {what}) (VB-673): the alderman lays out the green and well, or a common field, where the routine has one to make.
  register('layOut', {
    check: (st, c) => {
      const what = c.args && c.args.what;
      if (!LAYOUTS[what]) return `there is nothing to lay out called ${what}`;
      return (
        routineWhy(st, c, what) ||
        (LAYOUTS[what].project(st, st.villages[c.target])
          ? null
          : `there is no ${what} to lay out in village ${c.target}`)
      );
    },
    run: (st, c) => {
      const v = st.villages[c.target],
        L = LAYOUTS[c.args.what],
        made = makeProject(st, 'village', v.id, L.project(st, v));
      if (made) L.made(st, v, made);
    },
  });
  // The pawn who acts for village v now by its own rule: its alderman, at home and planned (VB-673), or null.
  const actorFor = (st, v) => {
    const a = agentOf(st, v.id);
    return a !== null && !unplanned(st, a) ? a : null;
  };
  // A village's review while its routines hold the green and well and it has none under way: its alderman lays out its green where a
  // tile is found (sim/green, VB-058).
  function greenStep(st, plan, a) {
    if (!plan.routines.includes('green')) return;
    const v = st.villages[plan.holder.id];
    if (Green.greenProject(st, v))
      issue(st, { actor: a, verb: 'layOut', target: v.id, args: { what: 'green' }, source: 'pawn' });
  }
  // A village's review while its routines hold the commons (VB-100): its alderman lays out a common field where the village would make
  // one (sim/commons); the village store holds back the seed of its common fields not yet sown, alderman or none (the store's own rule).
  function commonsStep(st, plan, a) {
    if (!plan.routines.includes('commons')) return;
    const v = st.villages[plan.holder.id];
    if (a !== null && Commons.project(st, v))
      issue(st, { actor: a, verb: 'layOut', target: v.id, args: { what: 'commons' }, source: 'pawn' });
    if (Commons.fieldsOf(v).length) Stores.reserve(st, v, plan, SEED, seedNeed(st, v, SEED_CROP), 'seed');
  }
  // A village's review on a work day of its routines: its alderman calls the village out (sim/workdays, VB-120).
  function workdayStep(st, plan, a) {
    if (!plan.routines.includes('workdays') || !Workdays.dayOf(cal(st.t))) return;
    issue(st, { actor: a, verb: 'callWorkday', target: plan.holder.id, source: 'pawn' });
  }
  // routines({routines, by}): the village's routines this year (VB-257) become args.routines, set by the meeting's decision (by
  // 'meeting') or, when it did not decide, by its culture's practice (by 'nothing' or 'asLastYear'; sim/lifecycle)
  register('routines', {
    check: (st, c) =>
      settlement(st, c) ||
      (!st.plans.villages.has(c.actor.settlement)
        ? `village ${c.actor.settlement} has no plan`
        : !(c.args && ['meeting', 'nothing', 'asLastYear'].includes(c.args.by))
          ? `routines cannot be set by ${c.args && c.args.by}`
          : routinesWhy(c.args.routines)),
    run: (st, c) => setRoutines(st, c.actor.settlement, c.args.routines, c.args.by),
  });
  // A village's review: the steps of its routines (greenStep, commonsStep, workdayStep), taken by its alderman, and his charge of the
  // tar pit to a household (sim/tar, VB-673).
  function villageSteps(st, plan) {
    const v = st.villages[plan.holder.id],
      a = actorFor(st, v);
    if (a !== null) greenStep(st, plan, a);
    commonsStep(st, plan, a);
    if (a !== null) workdayStep(st, plan, a);
    if (a !== null) Tar.chargeStep(st, v, a);
  }
  return {
    VILLAGE_ROUTINES,
    MAX_ROUTINES,
    rankRoutines,
    chooseRoutines,
    routinesWhy,
    setRoutines,
    routineAsks,
    founded,
    villageSteps,
    routineWhy,
  };
})();
