// @sys sim/routines [agency]: the village's routines (design.md section 7, Village routines; VB-257): the village work a meeting may choose, how
// it chooses, the founders' first choice, the meeting's verb that sets them, and the steps the village's review takes for them, each
// by its alderman at home (VB-673: the green's project and a common field's, verb layOut; the work day's call; the tar pit's charge), and
// the common fields' seed
VB['sim/routines'] = (() => {
  const { cal, DAY, SEASON_DAYS, YEAR_DAYS } = VB['sim/rules'];
  const Days = VB['sim/days'];
  const { log, fullName } = VB['sim/records'];
  const Steps = VB['sim/steps'];
  const { emit } = VB['sim/events'];
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
    Tar = VB['sim/tar'],
    Facilities = VB['sim/facilities'];
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
      together: true, // its days fall on the one date the alderman names (sim/workdays, VB-1768)
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
      common: true, // its tasks: the village's on its common fields
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
  // A meeting weighs besides the work a routine left undone at its windows' ends since the routines were set (plan.routineLeft, sim/levies,
  // in days, VB-1768).
  // `proposed` ({routine: holders who proposed it}, VB-1770): what the meeting took up of the holders' proposals weighs that much more, each
  // holder's word being one.
  function chooseRoutines(st, v, founders = false, proposed = null) {
    const cands = [],
      plan = st.plans.villages.get(v.id),
      R = plan && plan.routineLeft,
      left = R && R.by === plan.routinesBy + plan.routinesYear ? R.days : {};
    for (const k of Object.keys(VILLAGE_ROUTINES)) {
      const R = VILLAGE_ROUTINES[k];
      if (!(founders && R.meeting) && R.available(st, v))
        cands.push([R.need(st, v) + (founders ? 0 : left[k] || 0) + (proposed && proposed[k] ? proposed[k] : 0), k]);
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
  // Each routine is a step of the village's year (VB-1768; author `custom`, its `why` the decision that set it, {custom: by}); the
  // work left that the meeting heard is cleared once it has chosen.
  function setRoutines(st, vid, list, by) {
    const plan = st.plans.villages.get(vid);
    plan.routines = [...list];
    plan.routinesBy = by;
    plan.routinesYear = cal(st.t).year;
    Steps.setRoutines(
      st,
      plan,
      list.map((k) => ({ routine: k, kinds: [...VILLAGE_ROUTINES[k].kinds] })),
      by,
    );
  }
  // The year step of routine k in a village's plan, or null (a routine's levy's `why`, VB-1768).
  const stepOf = (plan, k) => (plan.year || []).find((s) => s.what.kinds && s.what.routine === k) || null;
  // Whose tasks are routine R's: the village's of its kinds, or on its common fields.
  const owns = (R, j) => (R.common ? !!j.common : R.kinds.includes(j.kind));
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
  // ---- work days called (VB-120, VB-673, VB-1768; sim/workdays holds the day, its work and its judging) ----
  // The custom's days of the year of game day D and the next, each {of (game day), what}.
  function customDays(D) {
    const y0 = D - (D % YEAR_DAYS),
      out = [];
    for (const y of [y0, y0 + YEAR_DAYS])
      for (const [season, sday, what] of Workdays.WORKDAY.days) out.push({ of: y + season * SEASON_DAYS + sday, what });
    return out;
  }
  // The work day village v's alderman is to call next (VB-1768), or null: {day (the date he names), of (the custom's day it stands for),
  // what, at (the game day to call it: OUTER.notice before the custom's day)}: the custom's day not yet called whose call is due; one
  // whose call day has passed unmade (the alderman away, the routine chosen late) is named for the first day the notice allows, while
  // its season lasts.
  function nextCall(st, v) {
    const D = Math.floor(st.t / DAY),
      n = Days.OUTER.notice;
    for (const x of customDays(D)) {
      if (v.workday && v.workday.of === x.of) continue;
      const end = x.of - (x.of % SEASON_DAYS) + SEASON_DAYS - 1;
      if (x.of - n >= D) return { day: x.of, of: x.of, what: x.what, at: x.of - n };
      if (D + n <= end) return { day: D + n, of: x.of, what: x.what, at: D };
    }
    return null;
  }
  // callWorkday(village, {day, of}) (VB-673, VB-1768): the alderman, at home, calls out his village for game day `day`, at least
  // OUTER.notice days ahead: the work day standing for the custom's day `of` (default: `day`, a custom's day). Its levy's lots are laid
  // for that one date (sim/levies layLots, terms `together`): the day's work over OUTER.hours, rounded up, so many adult-days. The
  // day's jobs are posted on it until the end of work, and it is judged then.
  const seasonOf = (d) => Math.floor(d / SEASON_DAYS);
  function callWhy(st, c) {
    const vid = c.target,
      plan = Number.isInteger(vid) ? st.plans.villages.get(vid) : undefined,
      a = c.args || {},
      D = Math.floor(st.t / DAY),
      n = Days.OUTER.notice,
      of = a.of ?? a.day,
      x = Number.isInteger(of) ? customDays(of - (of % YEAR_DAYS)).find((y) => y.of === of) : null;
    if (!plan) return `village ${vid} has no plan`;
    const v = st.villages[vid];
    return (
      agentWhy(st, vid, c.actor) ||
      (!plan.routines.includes('workdays')
        ? `the meeting of ${v.name} did not choose work days`
        : !Number.isInteger(a.day) || a.day < D + n
          ? `a work day is called at least ${n} days ahead`
          : !x
            ? 'it stands for no work day of the custom'
            : seasonOf(a.day) !== seasonOf(of)
              ? "a work day is held in its custom's season"
              : v.workday && v.workday.of === of
                ? 'the work day is called'
                : null)
    );
  }
  register('callWorkday', {
    check: callWhy,
    run: (st, c) => {
      const v = st.villages[c.target],
        of = c.args.of ?? c.args.day,
        what = customDays(of - (of % YEAR_DAYS)).find((y) => y.of === of).what;
      Workdays.begin(v, c.args.day, what, of);
      const D = Math.ceil(Workdays.workOf(st, v, what) / Days.OUTER.hours - 1e-9);
      // its lots, by sim/levies (the village's custom of lots, OUTER.lotMax)
      if (D > 0) emit(st, 'workdayCalled', { v, actor: c.actor, days: D, day: c.args.day });
      log(
        st,
        `${fullName(st.pawns[c.actor])} called ${v.name} out for its work day ${Workdays.TASK[what]} in ${c.args.day - Math.floor(st.t / DAY)} days.`,
        {
          kind: 'workday',
          village: v.id,
          pawn: c.actor,
        },
      );
    },
  });
  // A village's review while its routines hold work days: its alderman calls the next, OUTER.notice days ahead (sim/workdays nextCall:
  // the custom's day, or, called late, the first day the notice allows), and lays its lots for that one date (VB-1768).
  function workdayStep(st, plan, a) {
    if (!plan.routines.includes('workdays')) return;
    const v = st.villages[plan.holder.id],
      call = nextCall(st, v);
    if (call && call.at <= Math.floor(st.t / DAY))
      issue(st, { actor: a, verb: 'callWorkday', target: v.id, args: { day: call.day, of: call.of }, source: 'pawn' });
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
    if (a !== null) emit(st, 'routinesReviewed', { plan, v, a }); // the season's lots of its routines, and those done released (sim/levies, VB-1768)
    if (a !== null) greenStep(st, plan, a);
    commonsStep(st, plan, a);
    if (a !== null) workdayStep(st, plan, a);
    if (a !== null) Tar.chargeStep(st, v, a);
    if (a !== null) Facilities.villageUpkeep(st, v, a); // its facilities' upkeep (VB-361)
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
    stepOf,
    owns,
    nextCall,
  };
})();
