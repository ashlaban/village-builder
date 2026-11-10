// @sys sim/plans: holders' plans (design.md, section 7; VB-258): one standing plan per live household and per village, made and dropped with its holder
VB['sim/plans'] = (() => {
  const { WORK, DAY } = VB['sim/rules'];
  // @state st.plans: {households: Map of household id to plan, villages: Map of village id to plan}; a plan is
  //   {holder: {type: 'household' | 'village', id}, kind: 'standing', nextReview (game hours)}. One standing plan per undissolved household
  //   and per village; a dissolved household's plan is dropped with it, so the maps hold only live holders (Rules for cost, 1). Its review
  //   is the hourly pass that asks each kind where it is available (refreshJobs, sim/jobs); nothing else reads a plan yet.
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
  // A holder's standing plan, made when the household is founded or the village is (and for every holder at seed and load).
  function makePlan(st, type, id) {
    const plan = { holder: { type, id }, kind: 'standing', nextReview: reviewAfter(st.t - 1) };
    mapOf(st, type).set(id, plan);
    return plan;
  }
  // A dissolved household's plan goes with it.
  function dropPlan(st, type, id) { mapOf(st, type).delete(id); }
  const planOf = (st, type, id) => mapOf(st, type).get(id);
  // The plans of every live holder, at seed, and at the load of a save made before plans (VB-258).
  function seedPlans(st) {
    st.plans = { households: new Map(), villages: new Map() };
    for (const id of st.liveHouseholds) makePlan(st, 'household', id);
    for (const v of st.villages) makePlan(st, 'village', v.id);
  }
  // A plan reviewed now: its next review is the next review hour.
  function reviewed(st, plan) { VB.count.planReview++; plan.nextReview = reviewAfter(st.t); }
  return { reviewHour, makePlan, dropPlan, planOf, seedPlans, reviewed };
})();
