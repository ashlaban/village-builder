// @sys sim/plans: holders' plans (design.md section 7; VB-258, VB-248): a standing plan per live household and village; targets, land step, seed
VB['sim/plans'] = (() => {
  const { WORK, DAY, TICKS, HERD } = VB['sim/rules'];
  const Stores = VB['sim/stores'];
  const { seedNeed } = VB['sim/hunger'];
  const { fieldsWanted, fieldsWorkable, startProject } = VB['sim/fields'];
  const { startMeadow } = VB['sim/meadows'];
  // @state st.plans: {households: Map of household id to plan, villages: Map of village id to plan}; a plan is
  //   {holder: {type: 'household' | 'village', id}, kind: 'standing', nextReview (game hours), reserved, reasons (sim/stores' reservations)}, and a
  //   household's also {targets, tiles, counted}. One standing plan per undissolved household and per village; a dissolved household's plan
  //   is dropped with it, so the maps hold only live holders (Rules for cost, 1). Its review is the hourly pass that asks each kind where it
  //   is available (refreshJobs, sim/jobs).
  // @state plan.targets (a household's; VB-248): {wood: [the woodpile's goal by season], woodSecond (a second hand cuts below it), hayWinters
  //   (hay is made while the barn holds less than this many winters' need), fields, workable (the fields wanted and those its hands can
  //   till, written at the day's first work review, which takes the land step)}. Read by wood (sim/kinds), hayWanted (sim/meadows), the land step.
  // @state plan.tiles: {field, meadow}: the tile the plan names for its next field or meadow in place of the holder's choice, -1 for none
  //   (nothing names one yet: VB-253's verb). plan.counted: the year its herds were last counted for the cull (sim/byre), or null.
  // The template of the year, one for every culture until foresight (VB-254): the woodpile is laid in for winter from summer on, so its
  // goal is higher in summer and autumn; hay for two winters.
  const HAY_WINTERS = 2;
  function template(st, T) {
    const E = st.ECON;
    T.wood[0] = E.woodTarget; T.wood[1] = E.woodWinter; T.wood[2] = E.woodWinter; T.wood[3] = E.woodTarget;
    T.woodSecond = E.woodTarget * 0.4; T.hayWinters = HAY_WINTERS;
  }
  // The hours a standing plan is reviewed: every hour from one before work starts to the end of work (sim/clock calls refreshJobs then).
  const reviewHour = (h) => h >= WORK[0] - 1 && h <= WORK[1];
  // The first review hour after the hour of time t.
  function reviewAfter(t) {
    const day = Math.floor(t / DAY), h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  const mapOf = (st, type) => (type === 'household' ? st.plans.households : st.plans.villages);
  // A household's targets, tiles, cull record and reservation of seed, at its plan's making and at the load of a save without them.
  function household(st, plan) {
    const hh = st.households[plan.holder.id];
    plan.targets = { wood: [0, 0, 0, 0], woodSecond: 0, hayWinters: 0, fields: 0, workable: 0 };
    template(st, plan.targets);
    if (hh.farmstead !== null) { plan.targets.workable = fieldsWorkable(st, hh); plan.targets.fields = fieldsWanted(st, hh, plan.targets.workable); }
    plan.tiles = { field: -1, meadow: -1 };
    plan.counted = null;
    Stores.reserve(st, hh, plan, 'grain', hh.farmstead !== null ? seedNeed(st, hh) : 0, 'seed');
  }
  // A holder's standing plan, made when the household is founded or the village is (and for every holder at seed and load).
  function makePlan(st, type, id) {
    const plan = { holder: { type, id }, kind: 'standing', nextReview: reviewAfter(Math.floor(st.tick / TICKS) - 1), reserved: {}, reasons: {} };
    mapOf(st, type).set(id, plan);
    if (type === 'household') household(st, plan);
    return plan;
  }
  // A dissolved household's plan goes with it, and its reservations with the plan.
  function dropPlan(st, type, id) { mapOf(st, type).delete(id); }
  const planOf = (st, type, id) => mapOf(st, type).get(id);
  // The plans of every live holder, at seed, and at the load of a save made before plans (VB-258).
  function seedPlans(st) {
    st.plans = { households: new Map(), villages: new Map() };
    for (const id of st.liveHouseholds) makePlan(st, 'household', id);
    for (const v of st.villages) makePlan(st, 'village', v.id);
  }
  // A save made before the plans' targets and reservations (VB-248): its plans get them as made now.
  function fillPlans(st) {
    for (const plan of [...st.plans.households.values(), ...st.plans.villages.values()]) if (!plan.reserved) {
      plan.reserved = {}; plan.reasons = {}; // lint-allow: owner a save made before reservations gets empty ones (sim/stores writes them)
      if (plan.holder.type === 'household') household(st, plan);
    }
  }
  // A plan reviewed now: its next review is the next review hour. A household's plan writes its targets with today's values (the fields
  // only at the day's first work review, the one the land step reads them at), notes the year's count of its herds, and reserves the seed
  // its unsown fields and its land project need (sim/stores counts it again when read).
  function reviewed(st, plan, c) {
    VB.count.planReview++; plan.nextReview = reviewAfter(Math.floor(st.tick / TICKS));
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id], T = plan.targets;
    template(st, T);
    if (c.hour === WORK[0]) { T.workable = fieldsWorkable(st, hh); T.fields = fieldsWanted(st, hh, T.workable); }
    if (c.doy === HERD.countDay && hh.herds.length) plan.counted = c.year;
    Stores.reserve(st, hh, plan, 'grain', seedNeed(st, hh), 'seed');
  }
  // The land step (once a day at the start of work, from the review): a new field while the household has fewer than the plan's target,
  // else a hay meadow while it is short of one; the tile is the holder's choice (chooseTile, chooseMeadow) unless the plan names one.
  // `built`: the houses and greens, once for every farm's look (sim/fields, builtTiles).
  function landStep(st, plan, f, hh, built) {
    startProject(st, f, hh, built, plan.targets.fields, plan.tiles.field);
    startMeadow(st, f, hh, built, plan.tiles.meadow);
    Stores.reserve(st, hh, plan, 'grain', seedNeed(st, hh), 'seed'); // a project begun holds its seed from now
  }
  return { reviewHour, makePlan, dropPlan, planOf, seedPlans, fillPlans, reviewed, landStep };
})();
