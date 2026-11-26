// @sys sim/playerplan: a pawn's plan (VB-1646; Kim, 24 Nov; any pawn's, its controller's, since VB-1746): a daily routine of job kinds,
//   the sleeping hours and an ordered list of tasks, edited by its controller (Sim.plan(st, pawn, op, args)); its writes: the ops, the
//   feeder's (planDay, planBegun, called by sim/player's playerStep for each pawn whose controller holds a plan) and a fell task's loads
//   home (the event timberHome). The chains of a task at a tile are sim/planchains, what the plan has the pawn do
//   next and why each task waits sim/plannext, the page's reads sim/planview (VB-1657)
VB['sim/playerplan'] = (() => {
  const { DAY } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'];
  const { eligible } = VB['sim/eligibility'];
  const { living } = VB['sim/records'];
  const { on, emit } = VB['sim/events'];
  const { CHAINS, chainOf, chainWhy, chainGone, chainSteps, taskAt, pileOf } = VB['sim/planchains'];
  const { timberOf } = VB['sim/chores'];
  // The plan itself is the controller's (pawn.control.plan, its @state in sim/controller, VB-1746): any pawn's, played or not.
  const { PLAN_MAX, emptyPlan: empty, planOf, attach, plansIn } = VB['sim/controller'];
  const today = (st) => Math.floor(st.t / DAY);
  // Whether hour h is within the sleeping hours s (from `from` up to `until`, across midnight when from > until).
  const asleepAt = (s, h) => !!s && (s.from < s.until ? h >= s.from && h < s.until : h >= s.from || h < s.until);
  // ---- the controller's act: Sim.plan(st, id, op, args) on pawn id's plan, true or why not ----
  const hourOf = (h) => typeof h === 'number' && h >= 0 && h < 24;
  const index = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
  function plan(st, id, op, args) {
    if (!Number.isInteger(id) || !st.pawns[id]) return `there is no pawn ${id}`;
    const dead = living(st, id);
    if (dead) return dead;
    const g = args || {},
      pp = planOf(st, id) || empty(st);
    const name = op === 'add' ? Object.keys(CHAINS).find((k) => g[k] !== undefined) : undefined;
    if (name) {
      const tile = g[name],
        why = chainWhy(st, id, name, tile);
      if (why) return why;
      // one task a chain a tile, but for one of a different `what` there (VB-1668: a barn and a byre at the house side by side)
      if (pp.tasks.some((x) => chainOf(x) === name && x[name] === tile && x.what === g.what))
        return `the ${CHAINS[name].noun} at ${tile} is already planned`;
      if (pp.tasks.length >= PLAN_MAX) return `the plan is full (${PLAN_MAX} tasks)`;
      const at = g.at === undefined || g.at === null ? pp.tasks.length : g.at;
      if (!(Number.isInteger(at) && at >= 0 && at <= pp.tasks.length)) return `there is no place ${g.at} in the plan`;
      const more = CHAINS[name].args ? CHAINS[name].args(g, st, id) : null;
      if (typeof more === 'string') return more;
      pp.tasks.splice(at, 0, { [name]: tile, kind: name, site: tile, ...more });
    } else if (op === 'add') {
      const j = st.jobs.get(g.key);
      if (!j) return `there is no job ${g.key}`;
      if (!eligible(st, j, st.pawns[id])) return `job ${g.key} is not the pawn's to take`;
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
    attach(st, id).plan = pp; // the plan is the controller's (made if the pawn has none)
    return true;
  }
  // A trip of timber is home from `tile` with its `loads` (sim/chores' wood, the event timberHome): a fell task there of a plan of the
  // household's members counts its loads, not its trips (VB-1662: a cart's trip brings several).
  on('timberHome', (st, { household, tile, loads }) => {
    if (!plansIn(st, household).length) return;
    const t = taskAt(st, household, 'fell', tile);
    if (t && t.got < t.n) t.got = Math.min(t.n, t.got + (loads || 1));
  });
  // ---- the feeder's writes (sim/player's playerStep), on pawn id's plan ----
  // A new day clears the routine's `done`; a task whose job is finished or gone leaves the plan, the last one kept in `last`; a task at a
  // tile leaves when its chain says (chainGone).
  function planDay(st, id) {
    const pp = planOf(st, id),
      hid = st.pawns[id].household,
      d = today(st);
    if (pp.day !== d) {
      pp.day = d;
      pp.done = [];
    }
    for (let i = pp.tasks.length - 1; i >= 0; i--) {
      const t = pp.tasks[i];
      const name = chainOf(t);
      if (name) {
        const which = chainGone(st, hid, name, t[name], t);
        if (which) {
          pp.tasks.splice(i, 1);
          pp.last = { [name]: t[name], kind: name, site: t.site, t: st.t, which };
        }
        continue;
      }
      if (st.jobs.has(t.key)) continue;
      pp.tasks.splice(i, 1);
      pp.last = { key: t.key, kind: t.kind, t: st.t };
    }
    askCutting(st, hid, pp);
    askFarmstead(st, hid, pp);
  }
  // A farmstead task whose next step (the move's droving and fetching, the shelter's raising once its timber is in) is open but not posted:
  // the plan asks its head now (planAsks, as askCutting), so that a step does not wait days for the household's planning day (VB-1670:
  // the shelter's raising had waited 34 hours for it on the tiny map). Only while the plan's review is not asked already.
  function askFarmstead(st, hid, pp) {
    const hh = hid === null ? null : st.households[hid],
      t = hh && !hh.dissolved ? pp.tasks.find((k) => k.key === undefined && k.kind === 'farmstead') : null,
      plan = t && st.plans && st.plans.households.get(hid);
    if (!plan || plan.dirty) return;
    const s = chainSteps(st, hid, 'farmstead', t.farmstead, t),
      y = s && !s.where.camp ? s.steps[0] : null;
    if (y && !y.job && y.from <= st.t) emit(st, 'planAsks', { household: hid });
  }
  // A firewood task whose cutting the head's rule would post (sim/chores: timber home, the pile below the season's goal or the house
  // cold) but has not: the plan asks its head now (the event planAsks; sim/stores wakes the plan's review, at most one such a day), so
  // that the task does not wait for the household's planning day (VB-1661: up to three days by its head's diligence, sim/plandays).
  function askCutting(st, hid, pp) {
    const hh = hid === null ? null : st.households[hid];
    if (!hh || hh.dissolved || !pp.tasks.some((t) => t.key === undefined && t.kind === 'firewood')) return;
    if (timberOf(hh) > 0 && (hh.cold > 0 || pileOf(st, hh).short) && !st.jobs.has(`firewood:h${hid}`))
      emit(st, 'planAsks', { household: hid });
  }
  // A routine kind's command was begun by pawn id: it is done for the day.
  function planBegun(st, id, mark) {
    const pp = planOf(st, id);
    if (mark.from === 'routine' && pp && !pp.done.includes(mark.kind)) pp.done.push(mark.kind);
  }
  return { PLAN_MAX, plan, planDay, planBegun, asleepAt, empty, today };
})();
