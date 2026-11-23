// @sys sim/seasonal: a household's seasonal plan and its targets (design.md section 7, How a holder chooses: the year, foresight; VB-252,
// VB-254): its culture's template of the year as rules, compiled at the season's turn; the head who plans, its bias and the horizon its
// skill gives; the targets copied from the template, times the bias, with what the horizon projects and the head's own choices over them
VB['sim/seasonal'] = (() => {
  const { HERD, SEASON_DAYS, YEAR_DAYS, FIELDS, cal } = VB['sim/rules'],
    { CROPS } = VB['sim/crops'];
  const Rules = VB['sim/registry'];
  const Traits = VB['sim/traits'];
  const { KINDS } = VB['sim/kinds'];
  const { fieldsWanted, fieldsWorkable } = VB['sim/fieldplans'];
  const { on } = VB['sim/events'];
  const Targets = VB['sim/targets'];
  // @state st.plans.seasons (VB-252): a household's seasonal plan, {holder, kind: 'season', year, season (of cal), made (the day), steps (the
  //   season's routines in the template's order: kinds of sim/kinds), by (absent, or 'head' once its head set the order: VB-253's verb)};
  //   one per undissolved household, made with its standing plan and again
  //   at the standing plan's first review in each season, from its culture's template; dropped with it. The order is recorded, not yet
  //   enforced beyond what the role rankings do (VB-023 enforces the first order).
  // @state plan.head (a household's; VB-254): its head as planner, {pawn (the holder), since (game hours: when it became head), bias: {wood,
  //   hay, seed, fields, hours}: its multipliers on the template's targets (hours, VB-476: its lean, on the hours its estimate gives a
  //   task), each within Traits.HEAD.bias × (1 - its skill then) of 1}; drawn once
  //   from the stream `traits` when the plan is made and when the holder changes (sim/heirs' event newHead), never at a review; null while
  //   the household has no holder.
  // @state plan.targets (a household's; VB-248, VB-252): {wood: [the woodpile's goal by season], woodSecond (a second hand cuts below it),
  //   hayWinters (hay is made while the barn holds less than this many winters' need), seed (grain kept back for each field not yet sown),
  //   perHand (fields a working adult can till): copied from the template when its seasonal plan is made, each times its head's bias (VB-254);
  //   fields, workable (the fields wanted, times the bias, and those its hands can till, written at each review, which takes the land step);
  //   ahead (VB-254): {season, wood, hay}, what the head's horizon added at the last review to that season's woodpile goal and to the hay,
  //   taken off again at the next}; goods (VB-698): {[made good]: the head's target on it, its choice or its household's need (sim/targets),
  //   compiled at each review, at a retarget and when the head sets one; absent before the first}. Read by wood (sim/kinds), hayWanted
  //   (sim/meadows), seedNeed (sim/hunger), the review and its land step; goods by the makers' rules through Targets.target.
  // ---- the template of the year (design.md section 7, How a holder chooses: the year; VB-252) ----
  // A culture's year as rules of sim/registry, so that a culture, a head's foresight (VB-254) or the player (VB-253) changes one row: for
  // each season the routines in the order the work is done (year.order: a routine's place in the season, -1 when it is not done then), and
  // a target for each store. Its first values are those of the code before it, the same for every culture: the woodpile is laid in for
  // winter from summer on, so its goal is higher in summer and autumn; hay for two winters; a field's seed; FIELDS.perHand fields a hand.
  // ctx: {culture (an index of st.cenv.cultures; -1 for a household of none), season, routine (a kind of sim/kinds)}.
  const HAY_WINTERS = 2;
  const ROUTINES = [
    [
      'manure',
      'plow',
      'sow',
      'rake',
      'reclaim',
      'clear',
      'break',
      'meadow',
      'thresh',
      'wood',
      'mend',
      'water',
      'cook',
      'fodder',
      'milk',
      'fish',
    ],
    [
      'weed',
      'mow',
      'hay',
      'reclaim',
      'clear',
      'break',
      'meadow',
      'wood',
      'mend',
      'water',
      'cook',
      'fodder',
      'milk',
      'fish',
      'gather',
    ],
    [
      'reap',
      'haul',
      'mow',
      'hay',
      'thresh',
      'slaughter',
      'salt',
      'wood',
      'reclaim',
      'clear',
      'break',
      'meadow',
      'mend',
      'water',
      'cook',
      'fodder',
      'milk',
      'fish',
      'gather',
      'brew',
    ], // fishing last, gathering after it (VB-118), as a household checks it (VB-117); not in winter, under the ice
    ['thresh', 'wood', 'slaughter', 'salt', 'mend', 'water', 'cook', 'fodder', 'milk', 'brew'],
  ];
  const ROUTINE_KINDS = [...new Set(ROUTINES.flat())];
  for (const k of ROUTINE_KINDS) if (!KINDS[k]) throw new Error('The template names an unknown kind: ' + k);
  const year = (id, base) => Rules.declare({ id: 'year.' + id, owner: 'sim/seasonal', combine: 'sum', base });
  year('order', (st, x) => ROUTINES[x.season].indexOf(x.routine));
  year('wood', (st, x) => (x.season === 1 || x.season === 2 ? st.ECON.woodWinter : st.ECON.woodTarget));
  year('woodSecond', (st) => st.ECON.woodTarget * 0.4);
  year('hayWinters', () => HAY_WINTERS);
  year('seed', () => CROPS.barley.seed);
  year('perHand', () => FIELDS.perHand);
  // The template compiled at the season's turn (Rules for cost, 6): per culture {wood: [by season], and of this season woodSecond,
  // hayWinters, seed, perHand, steps: the routines in order}, made at its first need in a season, so a seasonal plan copies arrays and
  // reads no rule (the woodpile's goal is kept for every season, since the kinds read it by the season of the hour). A
  // cache of the rules, not state: never saved; a loaded run compiles it again from the same rules (one ctx, reused: value() allocates
  // nothing, and neither does its caller per rule read).
  const compiled = new WeakMap(),
    CTX = { culture: -1, season: 0, routine: '' };
  const seasonKey = (c) => c.year * 4 + c.season;
  const rule = (st, id) => Rules.value(st, 'year.' + id, CTX);
  function templateOf(st, culture, c) {
    let cache = compiled.get(st);
    if (!cache || cache.key !== seasonKey(c)) compiled.set(st, (cache = { key: seasonKey(c), by: new Map() }));
    let T = cache.by.get(culture);
    if (T) return T;
    CTX.culture = culture;
    CTX.season = 0;
    CTX.routine = '';
    T = { wood: [0, 0, 0, 0], woodSecond: 0, hayWinters: 0, seed: 0, perHand: 0, steps: null };
    for (let s = 0; s < 4; s++) {
      CTX.season = s;
      T.wood[s] = rule(st, 'wood');
    }
    CTX.season = c.season;
    T.woodSecond = rule(st, 'woodSecond');
    T.hayWinters = rule(st, 'hayWinters');
    T.seed = rule(st, 'seed');
    T.perHand = rule(st, 'perHand');
    const ranked = [];
    for (const k of ROUTINE_KINDS) {
      CTX.routine = k;
      const n = rule(st, 'order');
      if (n >= 0) ranked.push([n, k]);
    }
    T.steps = ranked.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    cache.by.set(culture, T);
    return T;
  }
  // The culture of a household's village (-1: no farm, or no culture yet).
  function cultureOf(st, hh) {
    const s = hh.farmstead !== null && st.cenv ? st.cenv.settlements[st.farmsteads[hh.farmstead].village] : null;
    return s ? s.culture : -1;
  }
  // The household's seasonal plan for the season of c, from its culture's template, and the standing plan's targets copied from it; from
  // then on the review reads the plan, never the template, so a later change to one household's plan touches no other.
  function seasonal(st, plan, c) {
    const id = plan.holder.id,
      T = templateOf(st, cultureOf(st, st.households[id]), c),
      P = plan.targets;
    biased(plan, T);
    P.perHand = T.perHand;
    chosenTargets(plan);
    project(st, plan, c);
    const sp = {
      holder: { type: 'household', id },
      kind: 'season',
      year: c.year,
      season: c.season,
      made: c.day,
      steps: [...T.steps],
    };
    st.plans.seasons.set(id, sp);
    return sp;
  }
  const seasonOf = (st, id) => st.plans.seasons.get(id);
  // ---- foresight (design.md section 7, How a holder chooses: foresight; VB-254) ----
  // A head's skill (Traits.skill) sets how far ahead it looks: under HORIZON[0] it reacts, working a store only once it has crossed its
  // target; from HORIZON[0] it projects each store to the season's end; from HORIZON[1] a season further. Under ORDER_LEAST it does not keep
  // the template's order (none is enforced yet: VB-023 was closed unmerged). Its bias, drawn once, multiplies the template's targets.
  const HORIZON = Object.freeze([0.33, 0.67]),
    ORDER_LEAST = 0.1,
    UNBIASED = Object.freeze({ wood: 1, hay: 1, seed: 1, fields: 1, hours: 1 });
  // The household's plan has a new head (its making, a succession): its record and bias, drawn now from the stream `traits`.
  function newHead(st, plan) {
    if (st.rng.seed) return; // while a scenario is seeded (its one stream): startHeads draws them once the streams are split
    const id = st.households[plan.holder.id].holder;
    if (id === null || id === undefined) {
      plan.head = null;
      return;
    }
    const s = Traits.skill(st, id, st.t),
      bias = {};
    for (const k of Object.keys(UNBIASED)) bias[k] = Traits.biasOf(st, s);
    plan.head = { pawn: id, since: st.t, bias };
  }
  // The household's targets made again for its new head, at once (VB-485): the template's of this season times the new head's bias, its
  // projection, and the fields it wants, so that none waits for the next season or review. The season's plan itself is kept: its order
  // of routines (the template's, or one set by the player or the old head, sp.by 'head') and its making day stand to the season's end, as
  // a target the head chose does (plan.chosen), since a succession changes who plans, not what the season's work was set to be.
  function retarget(st, plan) {
    const hh = st.households[plan.holder.id],
      T = plan.targets,
      c = cal(st.t);
    if (!seasonOf(st, hh.id)) {
      seasonal(st, plan, c);
    } else {
      const M = templateOf(st, cultureOf(st, hh), c);
      biased(plan, M);
      T.perHand = M.perHand;
      chosenTargets(plan);
      project(st, plan, c);
    }
    if (hh.farmstead !== null) {
      T.workable = fieldsWorkable(st, hh, T.perHand);
      T.fields = fieldsWanted(st, hh, T.workable, headBias(plan));
      chosenTargets(plan);
    }
    goodTargets(st, plan, hh);
  }
  // Every household's head at the start of a run, once the streams are split and the living have their traits; its targets made again.
  function startHeads(st) {
    for (const plan of st.plans.households.values()) {
      newHead(st, plan);
      retarget(st, plan);
    }
  }
  on('newHead', (st, d) => {
    const plan = st.plans && st.plans.households.get(d.household);
    if (!plan) return;
    newHead(st, plan);
    retarget(st, plan);
  });
  // The skill of the head of household id's plan now; the middle for a household with no head.
  function headSkill(st, id) {
    const plan = st.plans.households.get(id),
      H = plan && plan.head;
    return H ? Traits.skill(st, H.pawn, H.since) : 0.5;
  }
  // Seasons ahead the head looks: 0 (it reacts), 1 (to the season's end) or 2 (a season further).
  const horizonOf = (s) => (s < HORIZON[0] ? 0 : s < HORIZON[1] ? 1 : 2);
  // The days from today to the end of the head's horizon (0 for a head that reacts).
  const daysAhead = (c, hz) => (hz ? SEASON_DAYS - c.sday + (hz - 1) * SEASON_DAYS : 0);
  // The head's targets from the template's T, at the making of its seasonal plan: each times the head's bias. The review reads them from
  // the plan from then on (VB-252); only what it projects ahead (project, below) is added at each review.
  function biased(plan, T) {
    const P = plan.targets,
      b = plan.head ? plan.head.bias : UNBIASED;
    for (let s = 0; s < 4; s++) P.wood[s] = T.wood[s] * b.wood;
    P.woodSecond = T.woodSecond * b.wood;
    P.hayWinters = T.hayWinters * b.hay;
    P.seed = T.seed * b.seed;
    P.ahead = { season: 0, wood: 0, hay: 0 };
  }
  // What the household will burn and feed from today to the end of horizon hz (seasons ahead: 0 none, 1 to the season's end, 2 a season
  // further): the hearth's ECON.woodUse by season, and the stall days within it over a winter's (in winters' need of hay).
  function burnAhead(st, c, hz) {
    const use = st.ECON.woodUse,
      days = daysAhead(c, hz);
    let stall = 0;
    for (let d = 0; d < days; d++) {
      const doy = (c.doy + d) % YEAR_DAYS;
      if (doy >= HERD.stall[0] || doy < HERD.stall[1]) stall++;
    }
    const wood = hz ? use[c.season] * (SEASON_DAYS - c.sday) + (hz > 1 ? use[(c.season + 1) % 4] * SEASON_DAYS : 0) : 0;
    return [wood, stall / HERD.stallDays];
  }
  // What the head projects the household will burn and feed before its horizon ends, at a review (design.md, How a holder chooses:
  // foresight: a poor head reacts when a store crosses its target, a good one projects ahead): the template's target is the reserve
  // every head keeps; a head that reacts projects nothing, and one that projects lays in besides what the hearth will burn and the herd
  // eat in the stall days to its horizon's end (burnAhead). Kept in targets.ahead so that the next review takes it off before adding its
  // own; none on a target the head chose (VB-253). The seed is held back from the harvest by every head (Reservations: the seed kept for
  // sowing is the first), so the horizon does not move it; only the bias does. A few multiplications and a walk over the horizon's days;
  // draws nothing. (VB-485 had put the horizon in place of the template's look-ahead; withdrawn by the orchestrator, 16 Nov, as against
  // the Decided mechanism: backlog/VB-485.md.)
  function project(st, plan, c) {
    const P = plan.targets,
      A = P.ahead || (P.ahead = { season: c.season, wood: 0, hay: 0 }),
      C = plan.chosen;
    P.wood[A.season] -= A.wood;
    P.hayWinters -= A.hay;
    let [wood, hay] = burnAhead(st, c, horizonOf(headSkill(st, plan.holder.id)));
    if (C && C.wood !== null) wood = 0;
    if (C && C.hay !== null) hay = 0;
    P.wood[c.season] += wood;
    P.hayWinters += hay;
    A.season = c.season;
    A.wood = wood;
    A.hay = hay;
  }
  // The head's bias on the fields its household's food asks (sim/fields' fieldsWanted applies it to the sown fields, whole, before the
  // hands cap them and the fallow ones go on top: VB-485, so that a hands-limited household's head is not cut by a low bias more often
  // than it is raised by a high one; VB-350).
  const headBias = (plan) => (plan.head ? plan.head.bias.fields : 1);
  // The head's targets over the plan's (at its making each season, at each review and when one is set): the woodpile's goal in every season.
  function chosenTargets(plan) {
    const C = plan.chosen,
      T = plan.targets;
    if (!C) return;
    if (C.hay !== null) T.hayWinters = C.hay;
    if (C.wood !== null) for (let s = 0; s < 4; s++) T.wood[s] = C.wood;
    if (T.ahead && C.hay !== null) T.ahead.hay = 0; // what was projected is gone with the target it was on (VB-254)
    if (T.ahead && C.wood !== null) T.ahead.wood = 0;
    if (C.fields !== null) T.fields = Math.min(C.fields, T.workable);
  }
  // The head's target on each good its household makes (VB-698): its choice, else its rule's need now (sim/targets). On the head's
  // planning day, at a retarget and when one is chosen: a few reads a made good, never in a step.
  function goodTargets(st, plan, hh) {
    const G = plan.targets.goods || (plan.targets.goods = {}),
      C = plan.chosen && plan.chosen.goods;
    for (const good of Targets.MADE.keys()) {
      const n = C ? C[good] : undefined;
      // beyond the need, what the head reckons it can place of the asks it read (sim/asks, VB-699: plan.placed)
      G[good] =
        (n === undefined || n === null ? Targets.need(st, hh, good) : n) +
        ((plan.placed && plan.placed.goods[good]) || 0);
    }
  }
  // A household's targets at its plan's making (and at the load of a save without them): its head, its seasonal plan and the fields it
  // wants.
  function begin(st, plan, hh) {
    plan.targets = { wood: [0, 0, 0, 0], woodSecond: 0, hayWinters: 0, seed: 0, perHand: 0, fields: 0, workable: 0 };
    if (plan.head === undefined) newHead(st, plan);
    seasonal(st, plan, cal(st.t));
    const T = plan.targets;
    if (hh.farmstead !== null) {
      T.workable = fieldsWorkable(st, hh, T.perHand);
      T.fields = fieldsWanted(st, hh, T.workable, headBias(plan));
    }
  }
  // The targets of today's values at a review: the fields wanted (which the land step reads), the head's choices over them, what its
  // horizon projects, and the made goods'.
  function reviewTargets(st, plan, hh, c) {
    const T = plan.targets;
    T.workable = fieldsWorkable(st, hh, T.perHand);
    T.fields = fieldsWanted(st, hh, T.workable, headBias(plan));
    chosenTargets(plan);
    project(st, plan, c);
    goodTargets(st, plan, hh);
  }
  // A dissolved household's seasonal plan goes with its standing plan.
  function dropSeason(st, id) {
    st.plans.seasons.delete(id);
  }
  // The season's routines in the head's order, until the next season's plan is made (recorded; VB-023's enforcement was not merged).
  function setOrder(st, id, steps) {
    const sp = st.plans.seasons.get(id);
    sp.steps = [...steps];
    sp.by = 'head';
  }
  return {
    ROUTINES,
    cultureOf,
    seasonOf,
    templateOf,
    seasonal,
    startHeads,
    headSkill,
    horizonOf,
    ORDER_LEAST,
    chosenTargets,
    goodTargets,
    begin,
    reviewTargets,
    dropSeason,
    setOrder,
  };
})();
