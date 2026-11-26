// @sys sim/authored: an authored step and the default author (VB-1755; design.md section 7, Plans at four scales: Authors; A step at
// risk, and the take-back): the expected hours of a household's daily work reserved before anything authored (reserveOf, ownHours), the
// check of the verb plan's add and date on a pawn's own plan that refuses a task that cannot be done by its `by`, the `by` an undated task
// is given, and at the household's review the at-risk check of its members' authored tasks and the take-back
VB['sim/authored'] = (() => {
  const { WORK, TICKS, DAY } = VB['sim/rules'],
    { CHILD } = VB['sim/roles'];
  const { age } = VB['sim/records'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, dailyNow } = VB['sim/kinds'];
  const { says } = VB['sim/methods'];
  const { planOp } = VB['sim/plans'];
  const Estimate = VB['sim/estimate'];
  const { allotted } = VB['sim/fit'];
  const { slotIn } = VB['sim/day'];
  const Steps = VB['sim/steps'],
    { PLAN_OPS } = VB['sim/controller'],
    { on } = VB['sim/events'];
  const none = new Set();
  // The default author fills what is not authored and does not rewrite what is, on its conditions: the household's daily work (sim/kinds
  // `daily`) is slotted in before anything authored, its expected hours reserved by the check of the verb `plan`; an authored task
  // carries a `by`; and at the household's review a task its head's estimate says will not be done by then is at risk, asked of its
  // author's controller, and taken back by the default author once its `by` is past unanswered, unless it is kept. The estimate is the
  // head's (The future is someone's estimate), of a task by key: a task at a tile has no task to estimate yet and is left undated.
  const SPAN = WORK[1] - WORK[0];
  const today = (st) => Math.floor(st.t / DAY);
  // Whether pawn id plans for itself and its plan, not its household's day, has its hours (its own logic off).
  const onOwn = (st, id) => {
    const c = st.pawns[id].control;
    return !!c && !c.auto && !!Steps.pawnPlan(st, id);
  };
  let every = null;
  const EVERY = () => every || (every = Object.keys(KINDS).filter((k) => KINDS[k].daily && KINDS[k].vital === true));
  // The expected hours a day of household hh's daily kinds by its head's judgement H: of each such task open now, its work left and its
  // trip; of a daily kind the household lives by every day (`vital` true: the water, the meal) with none open, the kind's hours. A pass
  // over the household's open tasks.
  function reserveOf(st, hh, H = Estimate.headOf(st, hh)) {
    let h = 0;
    const seen = new Set();
    for (const j of st.jobsBy.get(`household:${hh.id}`) || none) {
      const K = KINDS[j.kind];
      if (!dailyNow(st, j)) continue;
      seen.add(j.kind);
      const trip = says(K, 'trip');
      h += Estimate.workFor(st, H, j) + (trip ? trip(st, j) : 0);
    }
    for (const k of EVERY()) if (!seen.has(k)) h += KINDS[k].hours || 0;
    return h;
  }
  // The working hours a day pawn id of household hh has for its own steps: a day's, less its share of the daily work the household's
  // other members (those its day allots) leave over, shared among the members on their own plans, and less its routine's other kinds.
  function ownHours(st, hh, id, H = Estimate.headOf(st, hh)) {
    let others = 0,
      own = 0;
    for (const m of hh.members) {
      const p = st.pawns[m];
      if (p.died !== null || age(st, p) < CHILD.from) continue;
      if (m === id || onOwn(st, m)) own++;
      else if (allotted(st, p)) others += SPAN;
    }
    const pp = Steps.pawnPlan(st, id);
    let routine = 0;
    if (pp) for (const k of pp.routine) if (!KINDS[k].daily) routine += KINDS[k].hours || 0;
    return Math.max(0, SPAN - Math.max(0, reserveOf(st, hh, H) - others) / Math.max(1, own) - routine);
  }
  // The hours a pawn with `per` own hours a day has from now to the end of day `by`.
  function until(st, by, per) {
    const h = st.t % DAY,
      rest = Math.min(1, Math.max(0, (WORK[1] - h) / SPAN));
    return Math.max(0, (by - today(st) + rest) * per);
  }
  const roundH = (h) => (Number.isFinite(h) ? Math.round(h * 10) / 10 : 9999);
  // The hours of work by the head's estimate of pawn id's task steps by key, from the first up to the i-th (exclusive).
  function needOf(st, head, id, steps, i) {
    let need = 0;
    for (let k = 0; k < i && k < steps.length; k++) {
      const g = steps[k].what.goal,
        j = g && g.key !== undefined ? st.jobs.get(g.key) : null;
      if (j) need += Estimate.estimate(st, head, j, [id]).mid;
    }
    return need;
  }
  // Pawn c.target's household, and the work by its head's estimate of its plan's tasks before place `at` and of the task of `key`, with
  // the pawn's own hours a day; null for a pawn of no household or a task gone.
  function weighed(st, c, at, key) {
    const id = c.target,
      p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      j = key === undefined ? null : st.jobs.get(key);
    if (!hh || hh.dissolved || !j) return null;
    const pp = Steps.pawnPlan(st, id),
      H = Estimate.headOf(st, hh);
    return {
      need: needOf(st, H.id, id, pp ? pp.steps : [], at) + Estimate.estimate(st, H.id, j, [id]).mid,
      per: ownHours(st, hh, id, H),
    };
  }
  // The check of the ops add and date of the verb `plan` on a pawn's own plan, after their own: a task by key dated `by` whose work, with
  // its plan's tasks before it, does not fit in the pawn's own hours to then, the household's daily work reserved, is refused.
  function reserveWhy(st, c, at, key) {
    const by = c.args.by,
      w = by === undefined || by === null ? null : weighed(st, c, at, key);
    if (!w) return null;
    const have = until(st, by, w.per);
    return w.need > have
      ? `pawn ${c.target} cannot do job ${key} by day ${by}: ${roundH(w.need)} hours of work, ${roundH(have)} of its own ` +
          "with its household's water, meal, fire and beasts seen to first"
      : null;
  }
  // The `by` a task by key added undated is given: the day its work, with the plan's tasks before it, is done in the pawn's own hours.
  function byOf(st, c, at, key) {
    const w = weighed(st, c, at, key);
    if (!w || !(w.per > 0) || !Number.isFinite(w.need)) return undefined;
    const d = today(st),
      first = until(st, d, w.per),
      from = Number.isInteger(c.args.from) ? Math.max(c.args.from, d) : d;
    return Math.max(from, d + (w.need <= first ? 0 : Math.ceil((w.need - first) / w.per)));
  }
  const atOf = (st, c) => {
    const pp = Steps.pawnPlan(st, c.target);
    return Number.isInteger(c.args.at) ? c.args.at : pp ? pp.tasks.length : 0;
  };
  planOp('pawn', 'add', {
    check: (st, c) => PLAN_OPS.add.check(st, c) || reserveWhy(st, c, atOf(st, c), c.args.key),
    run: (st, c) => {
      const by = c.args.by ?? (c.args.key !== undefined ? byOf(st, c, atOf(st, c), c.args.key) : undefined);
      PLAN_OPS.add.run(st, by === undefined ? c : { ...c, args: { ...c.args, by } });
    },
  });
  planOp('pawn', 'date', {
    check: (st, c) =>
      PLAN_OPS.date.check(st, c) || reserveWhy(st, c, c.args.i, Steps.pawnPlan(st, c.target).tasks[c.args.i].key),
    run: PLAN_OPS.date.run,
  });
  // At the review of household plan's plan (sim/plans' planReviewed): the steps the default author took back leave once their task is
  // done or gone; each task by key of its members' own plans is weighed, in its plan's order, by the head's estimate against its `by`:
  // short, it is at risk (its `risk` the hours short and the hour first found); no longer short, planned again; at risk since an earlier
  // review, past its `by` and not kept, the default author takes it back (takeBack). Its members' own task steps only: no work in a run
  // where none plans for itself.
  function reviewAuthored(st, plan, c) {
    const hid = plan.holder.id,
      hh = st.households[hid];
    if (!hh || hh.dissolved) return;
    for (const s of plan.ahead.slice()) if (s.tookBack && !st.jobs.has(s.what.goal.key)) Steps.dropTaken(st, hid, s);
    const ids = Steps.plannersIn(st, hid);
    if (!ids.length) return;
    const H = Estimate.headOf(st, hh),
      d = today(st),
      hour = Math.floor(st.tick / TICKS);
    for (const id of ids) {
      const pp = Steps.pawnPlan(st, id),
        per = ownHours(st, hh, id, H);
      let need = 0;
      for (const s of pp.steps) {
        const g = s.what.goal,
          j = g.key !== undefined ? st.jobs.get(g.key) : null;
        if (!j) continue;
        VB.count.riskCheck++;
        const e = Estimate.estimate(st, H.id, j, [id]).mid;
        need += e;
        if (s.by === undefined) continue;
        const short = need - until(st, s.by, per);
        if (short <= 0) {
          if (s.state === 'at-risk') Steps.atRisk(st, s, null);
        } else if (s.state === 'at-risk' && d > s.by && !s.kept && s.risk.since < hour) {
          need -= e;
          takeBack(st, hh, id, s, j, H, c);
        } else Steps.atRisk(st, s, { short: roundH(short), since: s.risk ? s.risk.since : hour });
      }
    }
  }
  // The default author takes step s of pawn id's plan back (its task j): the step becomes the household's, due by the day its head's
  // estimate says the members its day allots finish it in (the step moved), and the task is slotted into the day as it stands, so that it
  // is given hands now (the day weighs it at its next allotment if the slot cannot).
  function takeBack(st, hh, id, s, j, H, c) {
    const hands = hh.members.filter((m) => {
        const p = st.pawns[m];
        return p.died === null && allotted(st, p) && eligible(st, j, p);
      }),
      e = hands.length ? Estimate.estimate(st, H.id, j, hands).mid : Infinity;
    Steps.takeBack(st, id, s, hh.id, today(st) + (Number.isFinite(e) ? Math.ceil(e / SPAN) : 0));
    slotIn(st, hh, j, c);
  }
  on('planReviewed', (st, d) => {
    if (d.plan.holder.type === 'household') reviewAuthored(st, d.plan, d.c);
  });
  return { reserveOf, ownHours };
})();
