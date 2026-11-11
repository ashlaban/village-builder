// @sys sim/plans: holders' plans (design.md section 7; VB-258, VB-248, VB-249): a standing plan per live household and village; targets, land
// step, seed; planning days by the head's diligence, and the due-queue that opens the time-bound kinds at their hours
VB['sim/plans'] = (() => {
  const { WORK, DAY, TICKS, HERD, SEASON_DAYS } = VB['sim/rules'];
  const { next: rnd } = VB['sim/rng'];
  const Stores = VB['sim/stores'];
  const { KINDS } = VB['sim/kinds'];
  const { seedNeed } = VB['sim/hunger'];
  const { fieldsWanted, fieldsWorkable, startProject } = VB['sim/fields'];
  const { startMeadow } = VB['sim/meadows'];
  // @state st.plans: {households: Map of household id to plan, villages: Map of village id to plan, due: the due-queue}; a plan is
  //   {holder: {type: 'household' | 'village', id}, kind: 'standing', nextReview (game hours: its next planning day's review), last (the day
  //   of its last review), woke (the day of its last review woken by a store), looked (the day a member last looked for work outside the
  //   plan's tasks), dirty (sim/stores: a store crossed a target since the last review), reserved, reasons (sim/stores' reservations)}, and a
  //   household's also {targets, tiles, counted}. One standing plan per undissolved household and per village; a dissolved household's plan
  //   is dropped with it, so the maps hold only live holders (Rules for cost, 1). Its review asks each kind where it is available for the
  //   holder (refreshJobs, sim/jobs) on the holder's planning day, and out of turn when a window closes or a store crosses a target.
  // @state st.plans.due: [[hour, household id, index in WINDOWED]], sorted by hour, then id, then index: one entry per live household and
  //   time-bound kind, the hour its kind is next asked for the household (VB-249; Rules for cost, 4). Written only here.
  // @state pawn.diligence: a number in [0, 1) from the stream `traits`, drawn once, when the pawn first heads a household's review (a
  //   stand-in until VB-254); its thirds give the planning day's cadence (every third day, every second, daily).
  // @state plan.targets (a household's; VB-248): {wood: [the woodpile's goal by season], woodSecond (a second hand cuts below it), hayWinters
  //   (hay is made while the barn holds less than this many winters' need), fields, workable (the fields wanted and those its hands can
  //   till, written at each review, which takes the land step)}. Read by wood (sim/kinds), hayWanted (sim/meadows), the land step.
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
  // The hours at which plans may be reviewed and the due-queue is asked: every hour from one before work starts to the end of work
  // (sim/clock calls refreshJobs then).
  const reviewHour = (h) => h >= WORK[0] - 1 && h <= WORK[1];
  // The first review hour after the hour of time t.
  function reviewAfter(t) {
    const day = Math.floor(t / DAY), h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  const mapOf = (st, type) => (type === 'household' ? st.plans.households : st.plans.villages);
  // ---- planning days (design.md section 7, Planning days; VB-249) ----
  const FIRST = WORK[0] - 1, HOURS = WORK[1] - FIRST + 1; // the review hours, 5:00 to 18:00
  // The head's diligence, drawn once (a stand-in until VB-254).
  function diligence(st, id) {
    const p = st.pawns[id];
    if (p.diligence === undefined) p.diligence = rnd(st.rng.traits);
    return p.diligence;
  }
  // Days between a holder's reviews: by its head's diligence, every third day (the lowest third), every second, or daily; a village's daily.
  function cadence(st, plan) {
    if (plan.holder.type !== 'household') return 1;
    const head = st.households[plan.holder.id].holder;
    if (head === null || head === undefined) return 1;
    const d = diligence(st, head);
    return d < 1 / 3 ? 3 : d < 2 / 3 ? 2 : 1;
  }
  // The holder's next planning hour after `hour`: its hour of the working day and its day in the cycle are offset by its id, so reviews
  // spread over the days and over the hours of work (rule 5); a village is offset from the household of the same id.
  function nextSlot(plan, cad, hour) {
    const id = plan.holder.id + (plan.holder.type === 'household' ? 0 : 7), h = FIRST + (id * 5) % HOURS;
    let day = Math.floor(hour / DAY);
    if (day * DAY + h <= hour) day++;
    while ((day + id) % cad) day++;
    return day * DAY + h;
  }
  // Days on which a window is about to close, or has just closed, and every holder is reviewed at its first review hour: the last day of
  // sowing and the day after it (its hoeing and sowing taken down), and the two last days of autumn (the harvest before the frost).
  function closing(st, c) {
    const last = st.ECON.sowWindow[1];
    return (c.season === 0 && (c.sday === last || c.sday === last + 1)) || (c.season === 2 && c.sday >= SEASON_DAYS - 2);
  }
  // Why the holder's plan is reviewed at this hour, or null: its planning day ('day'); a window closing today, once ('window'); a store
  // that crossed a target, at most one such review a day ('store').
  function reviewWhy(st, plan, hour, c) {
    if (hour >= plan.nextReview) return 'day';
    if (plan.last !== c.day && closing(st, c)) return 'window';
    return plan.dirty && plan.woke !== c.day ? 'store' : null;
  }
  // A member without a task looks at the household's opportunities: true at most once a household a day (VB-249).
  function mayLook(plan, day) {
    if (plan.looked === day) return false;
    plan.looked = day;
    return true;
  }
  // ---- the due-queue (Rules for cost, 4): each time-bound kind (its `window`, sim/kinds) is asked for a household from its window's hour,
  // and again the next hour while it gives work and the day's work goes on; else at its next opening ----
  const WINDOWED = Object.keys(KINDS).filter((k) => KINDS[k].window);
  const byDue = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  // The first hour after `hour` at which the window of WINDOWED[k] opens.
  function opens(k, hour) {
    const from = KINDS[WINDOWED[k]].window.from;
    let day = Math.floor(hour / DAY);
    if (day * DAY + from <= hour) day++;
    return day * DAY + from;
  }
  // The entries due by this hour, taken off the queue (they are its first).
  function dueNow(st, hour) {
    const q = st.plans.due;
    let n = 0;
    while (n < q.length && q[n][0] <= hour) n++;
    return n ? q.splice(0, n) : [];
  }
  // The entries asked at this hour, back on the queue: the next hour while the kind gave work (gave[i]) and the day's work goes on, else at
  // the window's next opening. An entry of a household whose plan is gone is dropped.
  function again(st, entries, gave, hour) {
    const q = st.plans.due, end = Math.floor(hour / DAY) * DAY + WORK[1];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!st.plans.households.has(e[1])) continue;
      e[0] = gave[i] && hour + 1 <= end ? hour + 1 : opens(e[2], hour);
      q.push(e);
    }
    if (entries.length) q.sort(byDue);
  }
  // A household's entries, one per time-bound kind, at their next openings.
  function enqueue(st, id) {
    const hour = Math.floor(st.tick / TICKS);
    for (let k = 0; k < WINDOWED.length; k++) st.plans.due.push([opens(k, hour), id, k]);
    st.plans.due.sort(byDue);
  }
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
  // A holder's standing plan, made when the household is founded or the village is (and for every holder at seed and load). Its first
  // review is at the next review hour, whatever its planning day.
  function makePlan(st, type, id) {
    const plan = { holder: { type, id }, kind: 'standing', nextReview: reviewAfter(Math.floor(st.tick / TICKS) - 1), last: null, woke: null,
      looked: null, dirty: false, reserved: {}, reasons: {} };
    mapOf(st, type).set(id, plan);
    if (type === 'household') { household(st, plan); enqueue(st, id); }
    return plan;
  }
  // A dissolved household's plan goes with it, its reservations with the plan, and its entries leave the due-queue.
  function dropPlan(st, type, id) {
    mapOf(st, type).delete(id);
    if (type === 'household') st.plans.due = st.plans.due.filter((e) => e[1] !== id);
  }
  const planOf = (st, type, id) => mapOf(st, type).get(id);
  // The plans of every live holder, at seed, and at the load of a save made before plans (VB-258).
  function seedPlans(st) {
    st.plans = { households: new Map(), villages: new Map(), due: [] };
    for (const id of st.liveHouseholds) makePlan(st, 'household', id);
    for (const v of st.villages) makePlan(st, 'village', v.id);
  }
  // A save made before the plans' targets and reservations (VB-248), or before planning days and the due-queue (VB-249): its plans get
  // them as made now.
  function fillPlans(st) {
    for (const plan of [...st.plans.households.values(), ...st.plans.villages.values()]) {
      if (!plan.reserved) {
        plan.reserved = {}; plan.reasons = {}; // lint-allow: owner a save made before reservations gets empty ones (sim/stores writes them)
        if (plan.holder.type === 'household') household(st, plan);
      }
      if (plan.last === undefined) {
        plan.last = null; plan.woke = null; plan.looked = null;
        plan.dirty = false; // lint-allow: owner a save made before the flag gets it clear (sim/stores sets it)
      }
    }
    if (!st.plans.due) { st.plans.due = []; for (const id of st.plans.households.keys()) enqueue(st, id); }
  }
  // A plan reviewed now, for `why` (reviewWhy): on its planning day its next is set by its cadence; a review out of turn leaves it. The
  // flag of a store is cleared. A household's plan writes its targets with today's values (the fields wanted, which the land step reads),
  // notes the year's count of its herds once it is held, and reserves the seed its unsown fields and its land project need (sim/stores
  // counts it again when read).
  function reviewed(st, plan, c, why = 'day') {
    const hour = Math.floor(st.tick / TICKS);
    VB.count.planReview++;
    if (hour >= plan.nextReview) plan.nextReview = nextSlot(plan, cadence(st, plan), hour);
    plan.last = c.day;
    if (why === 'store') plan.woke = c.day;
    plan.dirty = false; // lint-allow: owner the review has read the stores whose crossing sim/stores flagged
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id], T = plan.targets;
    template(st, T);
    T.workable = fieldsWorkable(st, hh); T.fields = fieldsWanted(st, hh, T.workable);
    if (c.doy >= HERD.countDay && plan.counted !== c.year && hh.herds.length) plan.counted = c.year;
    Stores.reserve(st, hh, plan, 'grain', seedNeed(st, hh), 'seed');
  }
  // The land step (at each review of a household's plan): a new field while the household has fewer than the plan's target, else a hay
  // meadow while it is short of one; the tile is the holder's choice (chooseTile, chooseMeadow) unless the plan names one.
  // `built`: the houses and greens, once for every farm's look (sim/fields, builtTiles).
  function landStep(st, plan, f, hh, built) {
    startProject(st, f, hh, built, plan.targets.fields, plan.tiles.field);
    startMeadow(st, f, hh, built, plan.tiles.meadow);
    Stores.reserve(st, hh, plan, 'grain', seedNeed(st, hh), 'seed'); // a project begun holds its seed from now
  }
  return { reviewHour, makePlan, dropPlan, planOf, seedPlans, fillPlans, reviewed, landStep, reviewWhy, mayLook, closing, cadence, WINDOWED, dueNow,
    again };
})();
