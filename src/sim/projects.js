// @sys sim/projects: the project plans' record and its reads (VB-123; design.md section 7, Holders and plans), for every module: a holder's
// plans of steps, each opening when the one before is done; sim/plans writes them; what a building site lacks (VB-1407); and who may
// begin a project of its own and how a step's job ends (VB-1408)
VB['sim/projects'] = (() => {
  const { emit } = VB['sim/events'];
  // @state st.plans.projects (VB-123): {household, village, pawn: Map of a holder's id to its project plans, in the order made}; a project
  //   plan is {id, holder: {type, id}, kind: 'project', what ('field' | 'meadow' | 'boat': what it makes), steps: [{kind (an opportunity kind of
  //   sim/kinds), place (a tile), hours (of work), stake (the why of the holder's claim the step works under, or absent), spends ({[good]: n}
  //   taken from the holder's store when the step is done, or absent), timber and wood (loads it needs at its site and loads brought, or
  //   absent; VB-300's boat)}], open (the index of the open step), reserved, reasons (sim/stores)}.
  //   A finished or dropped plan is removed, and a holder with none has no entry (Rules for cost, 1). st.plans.projectSeq: the last plan's id.
  //   st.plans.projects.heirPlots (VB-255): the households' plots for their heirs under way (the same plans as in `household`), an index
  //   of the live ones so that a village's plots are found without walking its households; written with the record, by sim/plans.
  //   Written only by sim/plans (which hears the lower modules' changes by events: a step done, a right lost, a store short); read here.
  // The plans a holder has (an empty list for none; never written to).
  const NONE = [];
  function projectsOf(st, type, id) {
    const P = st.plans && st.plans.projects,
      list = P && P[type].get(id);
    return list || NONE;
  }
  // The holder's first project plan, or null: a household has at most one (design.md section 7, Holders and plans).
  const projectOf = (st, type, id) => {
    const list = projectsOf(st, type, id);
    return list.length ? list[0] : null;
  };
  // A plan's step by its kind (the first of that kind), or undefined: a plot's walls are stepOf(plot, 'walls') (VB-1407). Allocates nothing.
  function stepOf(plan, kind) {
    for (const s of plan.steps) if (s.kind === kind) return s;
    return undefined;
  }
  // What a building site lacks (VB-1407): the loads of timber still to bring to `site` (its `wood`, loads brought) for `need`, the loads its
  // stage needs, which the site's module says (a project step's `timber`, a cottage's walls BUILD.timber, a staked booth's BOOTH.wood; none
  // once its walls stand). The one read of it: sim/building posts the trips by it, and each site waits by it.
  const lacks = (site, need) => Math.max(0, (need || 0) - (site.wood || 0));
  // Whether a step has what it waits for at its site: a step with `timber` (loads it needs, VB-300's boat) once it lacks none.
  const supplied = (s) => lacks(s, s.timber) === 0;
  // The timber site of farm f's household's open project step, when that step carries `timber` (a boat at its shore, VB-300; a cart, a barn's
  // walls at the house, VB-255): {key, site, need, dest, owner} for sim/building's timber trips, or null.
  function timberOf(st, f) {
    const s = f.household !== null && openOf(st, 'household', f.household);
    return s && s.timber
      ? {
          key: `timber:b${f.id}`,
          site: s,
          need: s.timber,
          dest: s.place,
          owner: { type: 'household', id: f.household },
        }
      : null;
  }
  // The open step of a holder's first project plan, or null. Allocates nothing (the review and the kinds read it hourly).
  const openOf = (st, type, id) => {
    const plan = projectOf(st, type, id);
    return plan ? plan.steps[plan.open] : null;
  };
  // Every live project plan, in the order of holders' types and ids (a few per village at most).
  function forEach(st, fn) {
    if (!st.plans || !st.plans.projects) return;
    for (const type of ['household', 'village', 'pawn'])
      for (const list of st.plans.projects[type].values()) for (const plan of list) fn(plan);
  }
  // The holder a plan names: a household, a village or a pawn.
  const holderOf = (st, ref) =>
    (ref.type === 'household' ? st.households : ref.type === 'village' ? st.villages : st.pawns)[ref.id];
  // The restoration under way on farm id (a claimant's project plan, sim/farmclaims), or null: the claimants' plans are few.
  function onFarm(st, id) {
    const P = st.plans && st.plans.projects;
    if (P) for (const list of P.pawn.values()) for (const plan of list) if (plan.farm === id) return plan;
    return null;
  }
  // Whether household id's head holds off projects (VB-253: the player chose none, plan.chosen.project, sim/plans): no project of the
  // household's is begun by its own rule (the land step, the boat, the tar pit) until the choice is cleared. Allocates nothing.
  function heldOff(st, id) {
    const plan = st.plans && st.plans.households.get(id);
    return !!(plan && plan.chosen && plan.chosen.project === 'none');
  }
  // Whether household hh, of farm f, may begin a project of its own now (VB-1408): it lives, is not dissolved, its farm has no booth, it
  // has no project plan under way, and its head does not hold off projects. The one read of it for the yearly starters (sim/tar's pit,
  // sim/drying's boat, sim/carts' cart), each of which then asks its own rule of when its project is wanted. A starter that asks less
  // says so by `ask`: { heldOff: false } leaves the head's choice unasked (sim/carts today; VB-678 closes that gap). Allocates nothing.
  const BEGIN = { heldOff: true };
  const mayBegin = (st, hh, f, ask = BEGIN) =>
    !!hh && !hh.dissolved && !f.booth && !projectOf(st, 'household', hh.id) && !(ask.heldOff && heldOff(st, hh.id));
  // The one way the job j of household hh's project step ends (VB-1408): when the open step of hh's project plan is still j's (its kind, and
  // its tile unless `ask` is { place: false }: sim/carts' cart today), the domain's effect(st, j, hh, plan, step) runs and the step is
  // done (stepDone: sim/plans opens the next or finishes the plan). Whether it ended. hh is the step's holder, which the caller names
  // (the hand's household, or a barn's j.owner).
  const END = { place: true };
  function stepEnds(st, j, hh, effect, ask = END) {
    const plan = hh ? projectOf(st, 'household', hh.id) : null,
      s = plan && plan.steps[plan.open];
    if (!s || s.kind !== j.kind || (ask.place && s.place !== j.site)) return false;
    effect(st, j, hh, plan, s);
    emit(st, 'stepDone', { type: 'household', id: hh.id });
    return true;
  }
  // The empty record, at seed (sim/plans makes st.plans) and at the load of a save made before project plans.
  const emptyProjects = () => ({ household: new Map(), village: new Map(), pawn: new Map(), heirPlots: [] });
  // The job is still the open step of its household's project plan (not given up or contested away meanwhile; sim/plans, sim/stakes): the
  // one read of it, for the land steps' finishers and sim/jobs' hourly sweep of project tasks.
  const onProject = (st, j) => {
    const s = openOf(st, 'household', j.owner.id);
    return !!s && s.place === j.site && s.kind === j.kind;
  };
  // The open step of the household's project plan (a new field's clear and break, a meadow; sim/projects): made once the one before is done.
  // A plot the household clears for its heir (VB-255) is posted as every plot is (plotWork).
  const landProject = (st, hh, f, c, post) => {
    const p = projectOf(st, 'household', hh.id),
      s = p && p.what !== 'plot' ? p.steps[p.open] : null; // not while it waits for timber (VB-300)
    if (s && supplied(s)) post(`${s.kind}:f${f.id}`, s.place, { farm: f, hours: s.hours }, s.kind);
  };
  return {
    onProject,
    landProject,
    projectsOf,
    projectOf,
    stepOf,
    lacks,
    timberOf,
    openOf,
    forEach,
    holderOf,
    onFarm,
    heldOff,
    mayBegin,
    stepEnds,
    emptyProjects,
  };
})();
