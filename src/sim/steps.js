// @sys sim/steps: the plan record (design.md section 7, Plans at four scales: The plan record, Authors, How a step becomes work; VB-1752):
// every body's plan as lists of steps by horizon, each step with its author and its one link upward; the steps made, found by id, folded
// and linked to the projects they hold; the step a task is opened by; and the chain of steps above a task, for its card (Reasons shown)
VB['sim/steps'] = (() => {
  // @state plan.body, plan.year, plan.season, plan.ahead, plan.reviewed (VB-1752): the plan record of a household's and a village's
  //   standing plan (sim/plans) and of a pawn's (st.plans.pawns): body {kind: 'household' | 'village' | 'pawn', id}; its agent (the pawn
  //   that plans for it: the head, the alderman, the pawn itself) is not kept but read from the body when the record is shown (Sim.plans),
  //   so that no copy of it goes stale; year, season, ahead: its steps by horizon, in the
  //   order the planner set them (saved behaviour); reviewed (the game hour of its last review, null before it). A step is {id (of
  //   st.plans.stepSeq, never reused), what (one of {target: {store, level, ...}} (sim/seasonal), {routine: a kind of sim/kinds},
  //   {project: a project plan's id}), who (bodies within the planner's authority it is given to; empty: whoever the day allots), why
  //   (the one link upward: {step, of: the key of the plan holding it}, {custom: a word}, {levy} or null), author ('custom': the body's
  //   rule; 'pawn': through a verb by whoever controls its agent), state (STATES), and from, by (days) and left ({lo, mid, hi}: the hours
  //   still to do by the planner's estimate, season and year steps)}. A project plan's own steps (st.plans.projects, sim/projectplans) are
  //   the steps under its year step: each also carries id, why ({step} of the project's year step), who, author and state, beside its
  //   goal (kind, place, hours and the site's fields). Done steps leave the lists; a season's are folded at its end (sim/seasonal).
  // @state st.plans.pawns (VB-1752): a pawn's plan record, made once it holds a step (a claimant's restoration, sim/farmclaims) and gone
  //   when it holds none. st.plans.stepSeq: the last step's id.
  const STATES = Object.freeze(['planned', 'open', 'at-risk', 'done', 'failed', 'dropped']),
    AUTHORS = Object.freeze(['custom', 'pawn']),
    LISTS = Object.freeze(['year', 'season', 'ahead']);
  const keyOf = (body) => `${body.kind}:${body.id}`;
  const mapOf = (st, kind) => {
    const P = st.plans;
    if (!P) return null;
    return kind === 'household' ? P.households : kind === 'village' ? P.villages : kind === 'pawn' ? P.pawns : null;
  };
  // The plan of body {kind, id}, or null. Allocates nothing.
  function planFor(st, kind, id) {
    const map = mapOf(st, kind);
    return (map && map.get(id)) || null;
  }
  // The plan a key names ('household:3'), or null.
  function planByKey(st, key) {
    const i = key.indexOf(':');
    return planFor(st, key.slice(0, i), Number(key.slice(i + 1)));
  }
  const NONE = [];
  // The record's lists on a plan made for body {kind, id} (its agent and review are its maker's, sim/plans; a household's season list
  // sim/seasonal's: a village's and a pawn's plan has none until one is planned).
  function record(plan, kind, id) {
    plan.body = { kind, id };
    plan.year = [];
    plan.ahead = [];
    return plan;
  }
  // A new step: `what`, `why`, by the default author, planned; `extra` its own fields (from, by, left, state).
  function make(st, what, why, extra) {
    VB.count.planSteps++;
    return { id: ++st.plans.stepSeq, what, who: [], why, author: 'custom', state: 'planned', ...extra };
  }
  // The step of id in `plan`'s lists or under its projects, or null: a few dozen at most, a view's read and the invariants'.
  function find(st, plan, id) {
    if (!plan || id === null || id === undefined) return null;
    for (const k of LISTS) for (const s of plan[k] || NONE) if (s.id === id) return s;
    const P = st.plans.projects,
      list = P && P[plan.body.kind] && P[plan.body.kind].get(plan.body.id);
    if (list) for (const p of list) for (const s of p.steps) if (s.id === id) return s;
    return null;
  }
  // The hours still to do of project p's steps from its open one: their own hours less those worked on a stage kept (the planner's
  // estimate is the step's hours as laid out, so its range is that one figure).
  function rest(p) {
    let h = 0;
    for (let i = p.open; i < p.steps.length; i++) h += Math.max(0, (p.steps[i].hours || 0) - (p.steps[i].done || 0));
    return { lo: h, mid: h, hi: h };
  }
  const yearOf = (plan, p) => {
    for (const y of plan.year) if (y.what.project === p.id) return y;
    return null;
  }; // ---- the projects' steps (sim/projectplans calls these) ----
  // Project plan p linked into its holder's plan: a year step {project} by the default author, and each of p's steps under it. A
  // household's plan not yet made (a settler's cottage) is linked when it is (sim/plans makePlan); a pawn's is made now.
  function link(st, p) {
    const { type, id } = p.holder;
    let plan = planFor(st, type, id);
    if (!plan && type === 'pawn') st.plans.pawns.set(id, (plan = record({ reviewed: null }, 'pawn', id)));
    if (!plan || yearOf(plan, p)) return;
    const y = make(st, { project: p.id }, { custom: p.what }, { state: 'open', left: rest(p) });
    plan.year.push(y);
    const of = keyOf(plan.body);
    for (let i = 0; i < p.steps.length; i++) {
      const s = p.steps[i];
      if (s.id === undefined) s.id = ++st.plans.stepSeq;
      s.why = { step: y.id, of };
      s.who = [];
      if (s.author === undefined) s.author = 'custom';
      s.state = i < p.open ? 'done' : i === p.open ? 'open' : 'planned';
    }
  }
  // Project plan p's open step `done` is done and the next open (sim/projectplans advance): its year step's hours left with them.
  function advanced(st, p, s) {
    s.state = 'done';
    s = p.steps[p.open];
    if (s) s.state = 'open';
    const plan = planFor(st, p.holder.type, p.holder.id),
      y = plan && yearOf(plan, p);
    if (y) y.left = rest(p);
  }
  // Project plan p's year step leaves its holder's plan (p finished, dropped or handed on); a pawn's plan with no step left goes.
  function unlink(st, p) {
    const plan = planFor(st, p.holder.type, p.holder.id);
    if (!plan) return;
    const i = plan.year.findIndex((s) => s.what.project === p.id);
    if (i >= 0) plan.year.splice(i, 1);
    if (p.holder.type === 'pawn' && !plan.year.length && !(plan.season || NONE).length && !plan.ahead.length)
      st.plans.pawns.delete(p.holder.id);
  }
  // ---- a task's step ----
  // The id of the step that opens a task of `kind` at `site` for `owner`, or null: the open step of the owner's project of that kind (at
  // the site, else any), else its season's routine of that kind. At a task's posting (sim/jobs post). Allocates nothing.
  function stepFor(st, owner, kind, site) {
    if (!owner || !st.plans) return null;
    const P = st.plans.projects,
      list = P && P[owner.type] && P[owner.type].get(owner.id);
    let any = null;
    if (list)
      for (const p of list) {
        const s = p.steps[p.open];
        if (!s || s.kind !== kind) continue;
        if (s.place === site) return s.id ?? null;
        if (any === null) any = s.id ?? null;
      }
    if (any !== null) return any;
    const plan = planFor(st, owner.type, owner.id);
    if (plan) for (const s of plan.season || NONE) if (s.what.routine === kind) return s.id;
    return null;
  }
  // A step as a view shows it: a copy, with the body whose plan holds it.
  const shown = (s, body) => ({
    id: s.id,
    what: s.what ? { ...s.what } : { goal: { kind: s.kind, place: s.place } },
    of: { ...body },
    author: s.author,
    state: s.state,
    why: s.why ? { ...s.why } : null,
    ...(s.left ? { left: { ...s.left } } : {}),
  });
  // The chain of steps above task j, the step that opened it first, each a copy (shown), up to the one whose `why` is a custom, a levy
  // or none; empty for a task no step opened. A task posted before its season's steps were folded serves this season's step of its kind.
  // A view's read: a few steps, each found in its plan.
  function chain(st, j) {
    const out = [];
    if (!j || !j.owner || !st.plans) return out;
    let plan = planFor(st, j.owner.type, j.owner.id),
      s = find(st, plan, j.step);
    if (plan && !s) s = find(st, plan, stepFor(st, j.owner, j.kind, j.site));
    while (s && out.length < LISTS.length + 2) {
      out.push(shown(s, plan.body));
      const w = s.why;
      if (!w || w.step === undefined) break;
      plan = planByKey(st, w.of);
      s = find(st, plan, w.step);
    }
    return out;
  }
  // The plan record of body {kind, id} as a view shows it, a copy; null for a body with none.
  function recordOf(st, body) {
    const plan = body && planFor(st, body.kind, body.id);
    if (!plan || !plan.body) return null;
    const list = (k) => (plan[k] || NONE).map((s) => shown(s, plan.body));
    return {
      body: { ...plan.body },
      year: list('year'),
      season: list('season'),
      ahead: list('ahead'),
      reviewed: plan.reviewed,
    };
  }
  // The target of `store` in `plan`'s season ({store, level, ...}: sim/seasonal), or null. The target steps come first in a season's
  // list, so the walk stops at the first routine. Allocates nothing.
  function targetOf(plan, store) {
    if (!plan || !plan.season) return null;
    for (const s of plan.season) {
      const T = s.what.target;
      if (!T) return null;
      if (T.store === store) return T;
    }
    return null;
  }
  return {
    STATES,
    AUTHORS,
    keyOf,
    planFor,
    record,
    make,
    find,
    link,
    advanced,
    unlink,
    stepFor,
    chain,
    recordOf,
    targetOf,
  };
})();
