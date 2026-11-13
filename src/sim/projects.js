// @sys sim/projects: the project plans' record and its reads (VB-123; design.md section 7, Holders and plans), for every module: a holder's
// plans of steps, each opening when the one before is done; sim/plans writes them
VB['sim/projects'] = (() => {
  // @state st.plans.projects (VB-123): {household, village, pawn: Map of a holder's id to its project plans, in the order made}; a project
  //   plan is {id, holder: {type, id}, kind: 'project', what ('field' | 'meadow' | 'boat': what it makes), steps: [{kind (an opportunity kind of
  //   sim/kinds), place (a tile), hours (of work), stake (the why of the holder's claim the step works under, or absent), spends ({[good]: n}
  //   taken from the holder's store when the step is done, or absent), timber and wood (loads it needs at its site and loads brought, or
  //   absent; VB-300's boat)}], open (the index of the open step), reserved, reasons (sim/stores)}.
  //   A finished or dropped plan is removed, and a holder with none has no entry (Rules for cost, 1). st.plans.projectSeq: the last plan's id.
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
  const openStep = (plan) => plan.steps[plan.open];
  // Whether a step has what it waits for at its site: a step with `timber` (loads it needs, VB-300's boat) once `wood` (loads brought) reaches it.
  const supplied = (s) => !(s.timber > (s.wood || 0));
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
  // Why the plan's open step is no longer possible, or null: its holder is gone; the claim it works under is lost (contested away, lapsed;
  // st.claims read as sim/claims keeps it); the holder's stock no longer covers what its steps will spend (the reserved good lost).
  function impossible(st, plan) {
    const h = holderOf(st, plan.holder),
      s = plan.steps[plan.open],
      by = plan.holder;
    if (!h || h.dissolved || (by.type === 'pawn' && !h.alive)) return 'its holder is gone';
    const c = s.stake && (st.claims.get(s.place) || NONE).find((x) => x.by.type === by.type && x.by.id === by.id);
    if (s.stake && (!c || c.why !== s.stake)) return 'its claim on the land is lost';
    for (const good in plan.reasons)
      if (plan.reasons[good] === 'build' && plan.reserved[good] > (h[good] || 0) + 1e-9) return `its ${good} is gone`;
    return null;
  }
  // How a plan dropped for `why` is told: [text, the event's place].
  function dropWords(st, plan, why) {
    const h = holderOf(st, plan.holder),
      house = plan.holder.type === 'household',
      f = house ? st.farmsteads[h.farmstead] : null;
    const text = `${house ? f.name : h.name} gives up its ${plan.what === 'meadow' ? 'new hay meadow' : 'new ' + plan.what}: ${why}.`;
    return [text, house ? { household: h.id, farm: f.id, village: f.village } : { [plan.holder.type]: plan.holder.id }];
  }
  // The restoration under way on farm id (a claimant's project plan, sim/farmclaims), or null: the claimants' plans are few.
  function onFarm(st, id) {
    const P = st.plans && st.plans.projects;
    if (P) for (const list of P.pawn.values()) for (const plan of list) if (plan.farm === id) return plan;
    return null;
  }
  // The empty record, at seed (sim/plans makes st.plans) and at the load of a save made before project plans.
  const emptyProjects = () => ({ household: new Map(), village: new Map(), pawn: new Map() });
  return {
    projectsOf,
    projectOf,
    openStep,
    supplied,
    openOf,
    forEach,
    holderOf,
    onFarm,
    impossible,
    dropWords,
    emptyProjects,
  };
})();
