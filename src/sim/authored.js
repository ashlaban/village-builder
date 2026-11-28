// @sys sim/authored: an authored step and the default author (VB-1755; design.md section 7, Plans at four scales: Authors; A step at
// risk, and the take-back): the expected hours of a household's daily work reserved before anything authored (reserveOf, ownHours), the
// check of the verb plan's add and date on a pawn's own plan that refuses a task that cannot be done by its `by`, the `by` an undated task
// is given, and at the household's review the at-risk check of its members' authored tasks and the take-back
VB['sim/authored'] = (() => {
  const { WORK, TICKS, DAY, cal } = VB['sim/rules'],
    { CHILD } = VB['sim/roles'];
  const { age } = VB['sim/records'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, GOALS, goalGone, dailyNow } = VB['sim/kinds'];
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
  // head's (The future is someone's estimate), of a task by key, or of a task at a tile by the steps its chain has left.
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
  // The hours by the head H's estimate of task t of pawn id's plan: a task by key's job, a task at a tile's steps left (the chain of its
  // goal kind); null for a task gone.
  function costOf(st, H, id, t) {
    if (t.key !== undefined) {
      const j = st.jobs.get(t.key);
      return j ? Estimate.estimate(st, H.id, j, [id]).mid : null;
    }
    const e = goalEst(st, H, id, t);
    return e ? e.mid : null;
  }
  const goalEst = (st, H, id, t) => {
    const hid = st.pawns[id].household;
    return GOALS[t.kind] && hid !== null ? Estimate.goalEstimate(st, H.id, hid, t, [id]) : null;
  };
  // The hours of work by the head's estimate of pawn id's tasks, from the first up to the i-th (exclusive).
  function needOf(st, head, id, tasks, i) {
    let need = 0;
    for (let k = 0; k < i && k < tasks.length; k++) need += costOf(st, head, id, tasks[k]) || 0;
    return need;
  }
  // Pawn c.target's household, and the work by its head's estimate of its plan's tasks before place `at` and of task t (a task by key
  // {key} or a goal at a tile), with the pawn's own hours a day; null for a pawn of no household or a task gone.
  function weighed(st, c, at, t) {
    const id = c.target,
      p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || !t) return null;
    const pp = Steps.pawnPlan(st, id),
      H = Estimate.headOf(st, hh),
      mine = costOf(st, H, id, t);
    if (mine === null) return null;
    const e = t.key === undefined ? goalEst(st, H, id, t) : null;
    return {
      need: needOf(st, H, id, pp ? pp.tasks : [], at) + mine,
      per: ownHours(st, hh, id, H),
      opens: e && Number.isFinite(e.from) ? Math.floor(e.from / DAY) : -Infinity,
    };
  }
  // The check of the ops add and date of the verb `plan` on a pawn's own plan, after their own: a task by key dated `by` whose work, with
  // its plan's tasks before it, does not fit in the pawn's own hours to then, the household's daily work reserved, is refused.
  function reserveWhy(st, c, at, t) {
    const by = c.args.by,
      w = by === undefined || by === null ? null : weighed(st, c, at, t);
    if (!w) return null;
    const have = until(st, by, w.per);
    return w.need > have
      ? `pawn ${c.target} cannot do ${nameOf(t)} by day ${by}: ${roundH(w.need)} hours of work, ${roundH(have)} of its own ` +
          "with its household's water, meal, fire and beasts seen to first"
      : null;
  }
  // The `by` a task by key added undated is given: the day its work, with the plan's tasks before it, is done in the pawn's own hours.
  function byOf(st, c, at, t) {
    const w = weighed(st, c, at, t);
    if (!w || !(w.per > 0) || !Number.isFinite(w.need)) return undefined;
    const d = today(st),
      first = until(st, d, w.per),
      from = Number.isInteger(c.args.from) ? Math.max(c.args.from, d) : d,
      open = Math.max(from, w.opens); // a task at a tile whose chain waits (the crop to ripen, the hay to dry) is dated from then
    if (open > d) return open + Math.max(0, Math.ceil(w.need / w.per) - 1);
    return Math.max(from, d + (w.need <= first ? 0 : Math.ceil((w.need - first) / w.per)));
  }
  const atOf = (st, c) => {
    const pp = Steps.pawnPlan(st, c.target);
    return Number.isInteger(c.args.at) ? c.args.at : pp ? pp.tasks.length : 0;
  };
  // The task the op add names: a goal at a tile ({kind, site, ...}, as sim/controller's add makes it) or a task by key; null if neither.
  function addedOf(st, c) {
    const g = c.args,
      name = Object.keys(GOALS).find((k) => g[k] !== undefined);
    if (name) return { kind: name, site: g[name], ...(GOALS[name].args ? GOALS[name].args(g, st, c.target) : null) };
    return g.key !== undefined ? { key: g.key } : null;
  }
  const nameOf = (t) => (t.key !== undefined ? `job ${t.key}` : `${t.kind} at ${t.site}`);
  planOp('pawn', 'add', {
    check: (st, c) => PLAN_OPS.add.check(st, c) || reserveWhy(st, c, atOf(st, c), addedOf(st, c)),
    run: (st, c) => {
      const t = addedOf(st, c),
        by = c.args.by ?? (t ? byOf(st, c, atOf(st, c), t) : undefined);
      PLAN_OPS.add.run(st, by === undefined ? c : { ...c, args: { ...c.args, by } });
    },
  });
  planOp('pawn', 'date', {
    check: (st, c) =>
      PLAN_OPS.date.check(st, c) || reserveWhy(st, c, c.args.i, Steps.pawnPlan(st, c.target).tasks[c.args.i]),
    run: PLAN_OPS.date.run,
  });
  // Whether the task of step s a household took back is done or gone.
  const over = (st, hid, g) => (g.key !== undefined ? !st.jobs.has(g.key) : !!goalGone(st, hid, g.kind, g.site, g));
  VB.counter(
    'riskCheck',
    "Authored task steps weighed for their `by` at the household's review: none in a run with nothing authored (sim/day, VB-1755)",
  );
  // At the review of household plan's plan (sim/plans' planReviewed): the steps the default author took back leave once their task is
  // done or gone; each task of its members' own plans (by key, or at a tile: its chain's steps left) is weighed, in its plan's order, by
  // the head's estimate against its `by`: short, it is at risk (its `risk` the hours short and the hour first found); no longer short,
  // planned again; still open at the first review past its `by` and not kept, the default author takes it back (takeBack). Its
  // members' own task steps only: no work in a run where none plans for itself.
  function reviewAuthored(st, plan, c) {
    const hid = plan.holder.id,
      hh = st.households[hid];
    if (!hh || hh.dissolved) return;
    for (const s of plan.ahead.slice()) if (s.tookBack && over(st, hid, s.what.goal)) Steps.dropTaken(st, hid, s);
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
        const g = s.what.goal;
        if (g.key !== undefined && !st.jobs.has(g.key)) continue;
        VB.count.riskCheck++;
        const e = costOf(st, H, id, g);
        if (e === null) continue;
        need += e;
        if (s.by === undefined) continue;
        const short = need - until(st, s.by, per);
        if (short <= 0) {
          if (s.state === 'at-risk') Steps.atRisk(st, s, null);
        } else if (d > s.by && !s.kept) {
          if (takeBack(st, hh, id, s, g, H, c)) need -= e;
          else Steps.atRisk(st, s, { short: roundH(short), since: s.risk ? s.risk.since : hour }); // no other hand: it stays, at risk, with its one hand
        } else Steps.atRisk(st, s, { short: roundH(short), since: s.risk ? s.risk.since : hour });
      }
    }
  }
  // The default author takes step s of pawn id's plan back (its task g): the step becomes the household's, due by the day its head's
  // estimate says the members its day allots finish it in (the step moved), and a task by key is slotted into the day as it stands, so
  // that it is given hands now (the day weighs it at its next allotment if the slot cannot); a task at a tile is the day's to take up.
  // Returns false, the step left on the pawn's plan, when no hand of the household's day could work it (a played pawn with auto off works its
  // own plan only: the household's plan has no one to do it).
  function takeBack(st, hh, id, s, g, H, c, why) {
    const j = g.key !== undefined ? st.jobs.get(g.key) : null,
      hands = hh.members.filter((m) => {
        const p = st.pawns[m];
        return p.died === null && allotted(st, p) && (!j || eligible(st, j, p));
      });
    if (!hands.length) return false;
    const e = j
      ? Estimate.estimate(st, H.id, j, hands).mid
      : (Estimate.goalEstimate(st, H.id, hh.id, g, hands) || { mid: Infinity }).mid;
    Steps.takeBack(st, id, s, hh.id, today(st) + (Number.isFinite(e) ? Math.ceil(e / SPAN) : 0), why);
    if (j) slotIn(st, hh, j, c);
    return true;
  }
  // A member on its own plan cannot work (VB-1894; design.md section 7, Authors: a step whose holder cannot work returns to the pool at
  // once): its open steps are taken back now, by the default author, with the card's reason `why`, unless kept (at an illness or leave:
  // it stays, at risk, with the reason). With no other hand in the household's day it keeps them; at a death `dead`, a step kept or
  // with no hand is dropped with the plan (sim/steps).
  function giveBack(st, id, why, dead) {
    const p = st.pawns[id],
      hh = p && p.household != null ? st.households[p.household] : null;
    if (!hh || hh.dissolved || !Steps.plannersIn(st, hh.id).includes(id)) return;
    const pp = Steps.pawnPlan(st, id),
      H = Estimate.headOf(st, hh),
      c = cal(st.t),
      hour = Math.floor(st.tick / TICKS);
    for (const s of pp.steps.slice()) {
      const g = s.what.goal;
      if (g.key !== undefined && !st.jobs.has(g.key)) continue;
      VB.count.riskCheck++;
      if (!s.kept && takeBack(st, hh, id, s, g, H, c, why)) continue;
      if (!dead) Steps.atRisk(st, s, { short: 0, since: s.risk ? s.risk.since : hour, why });
    }
  }
  on('fellIll', (st, d) => giveBack(st, d.pawn, 'fell ill', false));
  on('leftDay', (st, d) => giveBack(st, d.pawn, 'was called away', false));
  Steps.onGone((st, id) => giveBack(st, id, 'died', true));
  on('planReviewed', (st, d) => {
    if (d.plan.holder.type === 'household') reviewAuthored(st, d.plan, d.c);
  });
  return { reserveOf, ownHours };
})();
