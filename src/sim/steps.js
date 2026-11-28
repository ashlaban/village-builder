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
  // @state st.plans.pawns (VB-1752): a pawn's plan record, made once it holds a step (a claimant's restoration, sim/farmclaims; a step
  //   its own controller authors, VB-1754) and gone when it holds none and no `lastTask`. st.plans.stepSeq: the last step's id.
  // @state plan.lastTask (a pawn's record; VB-1754, pawn.control.plan's before): absent until the pawn first plans for itself through the
  //   verb `plan` (sim/plans), then null or the last task that left its plan: {key, kind, t} (its job finished or gone) or {kind (a
  //   goal kind), site (its tile), t, which (one of the goal kind's `which`, sim/kinds GOALS)}. A pawn's own steps, in its record's `ahead`, by
  //   author 'pawn', in this order: its routine ({routine: a job kind}, each kind once, at most sim/controller's PLAN_MAX; `begun`: the game day its
  //   command was last begun, absent before), its sleeping hours ({sleep: {from, until}}, hours of the day, at most one step), its
  //   tasks ({goal}, at most sim/controller's PLAN_MAX, in the order they are done: a task by key {key (a job's key), kind, site (its tile or -1)} or a
  //   task at a tile, a goal its kind's methods carry (VB-1777) {kind (a goal kind of sim/kinds GOALS), site (its tile), and a fell
  //   task's n and got, an upgrade's or outbuilding's what}, one a goal kind a tile and a what; from, by: game days, a dated task's).
  //   Written here only (the verb's ops, sim/controller's
  //   checks; the feeder's planDay and planBegun; a fell task's loads home); read through pawnPlan, plansIn and planners
  const STATES = Object.freeze(['planned', 'open', 'at-risk', 'done', 'failed', 'dropped']),
    AUTHORS = Object.freeze(['custom', 'pawn']),
    LISTS = Object.freeze(['year', 'season', 'ahead']);
  const { DAY } = VB['sim/rules'];
  const { on } = VB['sim/events'];
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
  VB.counter(
    'planSteps',
    "Plan steps made: a household's season steps at each season's plan, a project's year step (sim/steps; VB-1752)",
  );
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
    if (
      p.holder.type === 'pawn' &&
      !plan.year.length &&
      !(plan.season || NONE).length &&
      !plan.ahead.length &&
      plan.lastTask === undefined
    )
      st.plans.pawns.delete(p.holder.id);
  }
  // A village's routines as steps of its year (sim/routines, VB-1768): each `what` {routine, kinds}, by the default author, open, its
  // `why` the decision that set them ({custom: by}); a routine set again keeps its step (its id, which the levies' why name), the others
  // leave.
  function setRoutines(st, plan, whats, by) {
    if (!plan.year) return;
    const had = new Map(plan.year.filter((s) => s.what.kinds).map((s) => [s.what.routine, s]));
    plan.year = plan.year.filter((s) => !s.what.kinds);
    for (const what of whats) {
      const s = had.get(what.routine);
      if (s) Object.assign(s, { what, why: { custom: by } });
      plan.year.push(s || make(st, what, { custom: by }, { state: 'open' }));
    }
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
    // a village's routine of the year (sim/routines, VB-1768), by the kinds it is the source of
    if (plan && owner.type === 'village')
      for (const s of plan.year || NONE) if (s.what.kinds && s.what.kinds.includes(kind)) return s.id;
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
    ...(s.risk ? { risk: { ...s.risk } } : {}),
    ...(s.kept ? { kept: true } : {}),
    ...(s.tookBack ? { tookBack: { ...s.tookBack } } : {}),
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
  // ---- a pawn's own plan (VB-1754; design.md section 7, The player's plan): the steps its controller authors through the verb `plan` ----
  const today = (st) => Math.floor(st.t / DAY);
  // Pawn id's plan as its readers see it, or null until it first plans for itself: {routine (its kinds), sleep (null or {from, until}),
  // tasks (the goals, the steps' own objects), steps (the task steps, by the same index), day (today), done (the routine's kinds begun
  // today), last}. Allocates a few arrays: read where a plan is asked of, never over all pawns.
  function pawnPlan(st, id) {
    const plan = planFor(st, 'pawn', id);
    if (!plan || plan.lastTask === undefined) return null;
    const d = today(st),
      v = { routine: [], sleep: null, tasks: [], steps: [], day: d, done: [], last: plan.lastTask };
    for (const s of plan.ahead) {
      const w = s.what;
      if (w.routine !== undefined) {
        v.routine.push(w.routine);
        if (s.begun === d) v.done.push(w.routine);
      } else if (w.sleep) v.sleep = w.sleep;
      else if (w.goal) {
        v.tasks.push(w.goal);
        v.steps.push(s);
      }
    }
    return v;
  }
  // The pawns that plan for themselves, ascending: from the pawns' records (a claimant's and a planner's, a few), so a run where no pawn
  // has planned does no work here.
  function planners(st) {
    const out = [];
    if (!st.plans || !st.plans.pawns.size) return out;
    for (const [id, plan] of st.plans.pawns) if (plan.lastTask !== undefined) out.push(id);
    return out.sort((a, b) => a - b);
  }
  // The plans of household hid's members that plan for themselves, by their pawns' ids ([] with none).
  function plansIn(st, hid) {
    const out = [];
    if (hid === null || hid === undefined || !st.plans || !st.plans.pawns.size) return out;
    for (const id of plannersIn(st, hid)) out.push(pawnPlan(st, id));
    return out;
  }
  // The task at a tile of goal kind `name` at `tile` in a plan of household hid's members (plansIn's order), the first by its pawn's
  // id, or null.
  const taskAt = (st, hid, name, tile) => {
    for (const pp of plansIn(st, hid)) {
      const t = pp.tasks.find((x) => x.key === undefined && x.kind === name && x.site === tile);
      if (t) return t;
    }
    return null;
  };
  // The writes (the verb's ops, sim/controller's checks before them; the feeder's): on pawn id's record, made if it has none.
  function own(st, id) {
    let plan = planFor(st, 'pawn', id);
    if (!plan) st.plans.pawns.set(id, (plan = record({ reviewed: null }, 'pawn', id)));
    if (plan.lastTask === undefined) plan.lastTask = null;
    return plan;
  }
  const authored = (st, what, extra) => ({ ...make(st, what, null, extra), author: 'pawn' });
  // The index in `ahead` of the i-th task step, or -1 past the last (the tasks are the list's last steps).
  function goalAt(plan, i) {
    let n = 0;
    for (let k = 0; k < plan.ahead.length; k++) if (plan.ahead[k].what.goal && n++ === i) return k;
    return -1;
  }
  const put = (list, k, s) => (k < 0 ? list.push(s) : list.splice(k, 0, s));
  // The routine becomes `kinds`, in order; a kind kept keeps the day it was begun.
  function setRoutine(st, id, kinds) {
    const plan = own(st, id),
      old = plan.ahead.filter((s) => s.what.routine !== undefined);
    plan.ahead = [
      ...kinds.map((k) => old.find((s) => s.what.routine === k) || authored(st, { routine: k }, {})),
      ...plan.ahead.filter((s) => s.what.routine === undefined),
    ];
  }
  // The sleeping hours become s ({from, until}), or none (null).
  function setSleep(st, id, s) {
    const plan = own(st, id),
      i = plan.ahead.findIndex((x) => x.what.sleep);
    if (i >= 0) plan.ahead.splice(i, 1);
    if (!s) return;
    let k = 0;
    while (k < plan.ahead.length && plan.ahead[k].what.routine !== undefined) k++;
    plan.ahead.splice(k, 0, authored(st, { sleep: { from: s.from, until: s.until } }, {}));
  }
  // Task `goal` enters the tasks at place `at`, dated by `when` ({from, by}, either absent).
  function addTask(st, id, goal, at, when) {
    const plan = own(st, id);
    put(plan.ahead, goalAt(plan, at), authored(st, { goal }, when));
  }
  // Task i leaves the plan; `last`, if given, is kept as the last task that left.
  function dropTask(st, id, i, last) {
    const plan = own(st, id);
    plan.ahead.splice(goalAt(plan, i), 1);
    if (last) plan.lastTask = last;
  }
  function moveTask(st, id, from, to) {
    const plan = own(st, id),
      s = plan.ahead.splice(goalAt(plan, from), 1)[0];
    put(plan.ahead, goalAt(plan, to), s);
  }
  // Task i is kept (on) or not: a kept step the default author never takes back (VB-1755).
  function keepTask(st, id, i, on) {
    const s = own(st, id).ahead[goalAt(planFor(st, 'pawn', id), i)];
    if (on) s.kept = true;
    else delete s.kept;
  }
  // Task i is dated anew by `when` ({from, by}, either absent: undated that way).
  function dateTask(st, id, i, when) {
    const s = own(st, id).ahead[goalAt(planFor(st, 'pawn', id), i)];
    delete s.from;
    delete s.by;
    Object.assign(s, when);
  }
  // ---- an authored step at risk, and the take-back (VB-1755; design.md section 7, A step at risk, and the take-back; sim/day writes them
  // at the household's review) ----
  // @state step.risk, step.kept, step.tookBack (VB-1755): a pawn's task step at risk (state 'at-risk': its planner's estimate says it is not
  //   done by its `by`) has risk {short (the hours short, by that estimate), since (the game hour it was first found at risk)}: its author's
  //   controller is to be asked (a decision point, VB-1757); kept: true on a step its controller marked through the verb `plan` (op keep),
  //   never taken back, absent else; tookBack: on a step the default author took back from a pawn's plan into its household's `ahead` (author
  //   'custom'), {from (the pawn), t (the game hour), by (its `by` then)}, gone with its task. Written here only.
  // Step s of a pawn's plan is at risk by `risk` ({short, since}), or no longer (null: planned again).
  function atRisk(st, s, risk) {
    if (risk) {
      s.state = 'at-risk';
      s.risk = risk;
    } else {
      s.state = 'planned';
      delete s.risk;
    }
  }
  // Step s leaves pawn id's plan and the default author takes it: into household hid's `ahead`, its author the rule's, due by `by`.
  function takeBack(st, id, s, hid, by, why) {
    let plan = planFor(st, 'pawn', id);
    plan.ahead.splice(plan.ahead.indexOf(s), 1);
    s.tookBack = { from: id, t: st.t, by: s.by };
    if (why) s.tookBack.why = why; // its holder could not work (VB-1894): 'fell ill', 'was called away', 'died'
    s.author = 'custom';
    s.state = 'open';
    s.why = { custom: 'taken back' };
    s.by = by;
    delete s.risk;
    delete s.kept;
    plan = planFor(st, 'household', hid);
    plan.ahead.push(s);
  }
  // A step the default author took back leaves household hid's plan (its task done or gone).
  function dropTaken(st, hid, s) {
    const plan = planFor(st, 'household', hid);
    plan.ahead.splice(plan.ahead.indexOf(s), 1);
  }
  // ---- duties (VB-1771; design.md section 7, Plans at four scales: The days ahead; Standing duties) ----
  // @state a duty: a step of a household's `ahead` {what: {duty: a type of recurring work without a window (sim/day dutyTypes)}, who:
  //   [the member that holds it]}, open, at most one a type; by the default author ({custom: 'duty'}, given at the head's review) or
  //   'pawn' (why null: through the verb assign with a duty, by whoever controls the head). It stands until its holder is absent (ill,
  //   called away, dead, no longer a member), when it lapses (sim/day). Written here only (giveDuty, dropDuty), by sim/day.
  // The duty step of `type` in household plan `plan`, or null: a pass over its few days-ahead steps.
  function dutyOf(plan, type) {
    for (const s of plan.ahead) if (s.what.duty === type) return s;
    return null;
  }
  // Member `pawn` holds the duty `type` of household plan `plan`, by `author` (the one it held before, if any, given to it).
  function giveDuty(st, plan, type, pawn, author = 'custom') {
    const why = author === 'custom' ? { custom: 'duty' } : null;
    const s = dutyOf(plan, type);
    if (s) return Object.assign(s, { who: [pawn], author, why });
    const n = make(st, { duty: type }, why, { who: [pawn], state: 'open', author });
    plan.ahead.push(n);
    return n;
  }
  // Duty step s leaves household plan `plan` (it lapses).
  function dropDuty(plan, s) {
    plan.ahead.splice(plan.ahead.indexOf(s), 1);
  }
  VB.counter(
    'planRead',
    'Members of a household read for those that plan for themselves (sim/steps plannersIn, VB-1834)',
  );
  // The pawns of household hid that plan for themselves, ascending ([] with none: no work in a run where none has planned).
  function plannersIn(st, hid) {
    if (hid === null || hid === undefined || !st.plans || !st.plans.pawns.size) return NONE;
    const hh = st.households[hid],
      out = [];
    if (!hh) return out;
    VB.count.planRead += hh.members.length;
    for (const id of hh.members) {
      const plan = st.plans.pawns.get(id);
      if (plan && plan.lastTask !== undefined && st.pawns[id].household === hid) out.push(id);
    }
    return out.sort((a, b) => a - b);
  }
  // The step whose goal is the task of `key` among household hid's: one the default author took back ({s, pawn: null}), else one of a
  // member's own plan ({s, pawn}); null for none. A card's read (sim/reasons).
  function stepOfKey(st, hid, key) {
    const hp = hid === null || hid === undefined ? null : planFor(st, 'household', hid);
    if (!hp) return null;
    for (const s of hp.ahead) if (s.tookBack && s.what.goal && s.what.goal.key === key) return { s, pawn: null };
    for (const id of plannersIn(st, hid))
      for (const s of planFor(st, 'pawn', id).ahead) if (s.what.goal && s.what.goal.key === key) return { s, pawn: id };
    return null;
  }
  // The routine's kind was begun today by its command.
  function routineBegun(st, id, kind) {
    const plan = planFor(st, 'pawn', id),
      s = plan && plan.ahead.find((x) => x.what.routine === kind);
    if (s) s.begun = today(st);
  }
  // A trip of timber is home from `tile` with its `loads` (sim/chores' wood, the event timberHome): a fell task there of a plan of the
  // household's members counts its loads, not its trips (VB-1662: a cart's trip brings several); the first by its pawn's id.
  on('timberHome', (st, { household, tile, loads }) => {
    for (const pp of plansIn(st, household)) {
      const t = pp.tasks.find((x) => x.key === undefined && x.kind === 'fell' && x.site === tile);
      if (!t) continue;
      if (t.got < t.n) t.got = Math.min(t.n, t.got + (loads || 1));
      return;
    }
  });
  // At a death the pawn's own steps leave its record, with its last task; the record goes if it holds nothing more. Before that the
  // default author (sim/authored, VB-1894) takes back the open tasks, through onGone.
  let gone = null;
  const onGone = (fn) => (gone = fn);
  on('died', (st, d) => {
    if (gone) gone(st, d.pawn);
    const plan = planFor(st, 'pawn', d.pawn);
    if (!plan || plan.lastTask === undefined) return;
    plan.ahead = plan.ahead.filter((s) => s.author !== 'pawn');
    delete plan.lastTask;
    if (!plan.year.length && !(plan.season || NONE).length && !plan.ahead.length) st.plans.pawns.delete(d.pawn);
  });
  return {
    pawnPlan,
    planners,
    plansIn,
    taskAt,
    setRoutine,
    setSleep,
    addTask,
    dropTask,
    moveTask,
    routineBegun,
    keepTask,
    dateTask,
    atRisk,
    takeBack,
    onGone,
    dropTaken,
    dutyOf,
    giveDuty,
    dropDuty,
    plannersIn,
    stepOfKey,
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
    setRoutines,
    chain,
    recordOf,
    targetOf,
  };
})();
