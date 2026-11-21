// @sys sim/projects: the project plans' record and its reads (VB-123; design.md section 7, Holders and plans), for every module: a holder's
// plans of steps, each opening when the one before is done; sim/plans writes them; what a building site lacks (VB-1407); and who may
// begin a project of its own and how a step's job ends (VB-1408)
VB['sim/projects'] = (() => {
  const { emit } = VB['sim/events'];
  // @state st.plans.projects (VB-123): {household, village, pawn: Map of a holder's id to its project plans, in the order made}; a project
  //   plan is {id, holder: {type, id}, kind: 'project', what ('field' | 'meadow' | 'boat' | 'cottage' ...: what it makes), steps: [{kind (an
  //   opportunity kind of sim/kinds), place (a tile), hours (of work), stake (the why of the holder's claim the step works under, or absent),
  //   spends ({[good]: n} taken from the holder's store when the step is done, or absent), timber and wood (loads it needs at its site and
  //   loads brought, or absent; VB-300's boat), done (hours worked on a stage kept while its job is dropped, or absent)}], open (the index of
  //   the open step), reserved, reasons (sim/stores)}. A settler household's cottage (VB-1411; sim/expansion's cottagePlan, made by
  //   sim/settle) is 'cottage', with the plot's three stages and `farmstead` (the farm it is kept with: its village holds it while the farm
  //   waits for a household, sim/plans' dropAll); it is not of the household's choosing (ownOf). A small construction (a cart, a boat, a tar
  //   pit: a few days' work; Kim, 21 Nov 2026) is marked `small: true` by the starter that makes it: begun and built beside any other plan,
  //   in a booth as in a house, one of a making (`what`) at a time (mayBegin), and not of the household's large projects (ownOf).
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
  // The household's large project of its own choosing under way (a field, a meadow, a barn, a plot for its heir), or null: the guards' one
  // read of it (the aims' menu, the land step, landWhy, buildStep, barnWhy, heirWhy, the verb dropProject). That a head begins no second
  // large project is today's limit, not the design's (the limit of one project removed, Kim, 21 Nov 2026; how parallel projects are
  // limited and ranked is VB-1410's). A settler household's cottage is not of its choosing: those guards that refused a farm with a booth
  // still do (f.booth), and the others never counted it; a small construction (plan.small) is beside it as the cottage is. Allocates nothing.
  function ownOf(st, id) {
    for (const plan of projectsOf(st, 'household', id)) if (plan.what !== 'cottage' && !plan.small) return plan;
    return null;
  }
  // The open step of the household's large project of its own choosing (ownOf), or null. Allocates nothing.
  const openOf = (st, id) => {
    const plan = ownOf(st, id);
    return plan ? plan.steps[plan.open] : null;
  };
  // The plan of the holder whose open step is of `kind`, at `place` unless place is undefined, or null: the plan a job belongs to (by its
  // kind and place). Allocates nothing.
  function planAt(st, type, id, kind, place) {
    for (const plan of projectsOf(st, type, id)) {
      const s = plan.steps[plan.open];
      if (s && s.kind === kind && (place === undefined || s.place === place)) return plan;
    }
    return null;
  }
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
  // The timber sites of farm f's household's open project steps that carry `timber` (a boat at its shore, VB-300; a cart, a barn's walls at
  // the house, VB-255), one for every such plan (a barn, a cart and a boat may be under way at once, VB-1414): [{key (its plan's own),
  // site, need, dest, owner}] for sim/building's timber trips, in the order of the plans; an empty list (not allocated) for none.
  function timberOf(st, f) {
    if (f.household === null) return NONE;
    let out = NONE;
    for (const plan of projectsOf(st, 'household', f.household)) {
      const s = plan.steps[plan.open];
      if (!s || !s.timber) continue;
      if (out === NONE) out = [];
      out.push({
        key: `timber:b${f.id}.${plan.id}`,
        site: s,
        need: s.timber,
        dest: s.place,
        owner: { type: 'household', id: f.household },
      });
    }
    return out;
  }
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
  // Whether household hh may begin the small construction `what` now (VB-1408, VB-1414; a cart, a boat, a tar pit): it lives, is not
  // dissolved, its head does not hold off projects, and it has no plan of that making under way. Neither a booth nor another project
  // stops it (Kim, 21 Nov 2026: small constructions are built beside any other). The one read of it for the yearly starters (sim/tar's
  // pit, sim/drying's boat, sim/carts' cart), each of which then asks its own rule of when its construction is wanted. Allocates nothing.
  function mayBegin(st, hh, what) {
    if (!hh || hh.dissolved || heldOff(st, hh.id)) return false;
    for (const plan of projectsOf(st, 'household', hh.id)) if (plan.what === what) return false;
    return true;
  }
  // The one way the job j of household hh's project step ends (VB-1408): when an open step of hh's project plans is still j's (its kind,
  // and its tile unless `ask` is { place: false }: sim/carts' cart today), the domain's effect(st, j, hh, plan, step) runs and the step is
  // done (stepDone, naming that plan: sim/plans opens the next or finishes the plan). Whether it ended. hh is the step's holder, which the
  // caller names (the hand's household, or a barn's j.owner).
  const END = { place: true };
  function stepEnds(st, j, hh, effect, ask = END) {
    const plan = hh ? planAt(st, 'household', hh.id, j.kind, ask.place ? j.site : undefined) : null;
    if (!plan) return false;
    effect(st, j, hh, plan, plan.steps[plan.open]);
    emit(st, 'stepDone', { type: 'household', id: hh.id, plan });
    return true;
  }
  // The empty record, at seed (sim/plans makes st.plans) and at the load of a save made before project plans.
  const emptyProjects = () => ({ household: new Map(), village: new Map(), pawn: new Map(), heirPlots: [] });
  // The plan of the job's household whose open step the job still is (not given up or contested away meanwhile; sim/plans, sim/stakes), or
  // null: the one read of it, for the land steps' finishers (which end that plan) and sim/jobs' hourly sweep of project tasks.
  const onProject = (st, j) => planAt(st, 'household', j.owner.id, j.kind, j.site);
  // The open steps of the household's project plans but a plot's and a cottage's (a new field's clear and break, a meadow, a boat...), each
  // posted once the step before it is done, and not while it waits for timber (VB-300). A plot the household clears for its heir (VB-255) is
  // posted as every plot is (plotWork), a settler household's cottage by sim/building's boothWork. The key is the step's kind at the farm:
  // the plans posted here open steps of kinds of their own (one large plan, and at most one small one of each making, mayBegin), so
  // the keys of several plans under way do not meet (VB-1414).
  const landProject = (st, hh, f, c, post) => {
    for (const p of projectsOf(st, 'household', hh.id)) {
      const s = p.what !== 'plot' && p.what !== 'cottage' ? p.steps[p.open] : null;
      if (s && supplied(s)) post(`${s.kind}:f${f.id}`, s.place, { farm: f, hours: s.hours }, s.kind);
    }
  };
  return {
    onProject,
    landProject,
    projectsOf,
    ownOf,
    openOf,
    stepOf,
    lacks,
    timberOf,
    forEach,
    holderOf,
    onFarm,
    heldOff,
    mayBegin,
    stepEnds,
    emptyProjects,
  };
})();
