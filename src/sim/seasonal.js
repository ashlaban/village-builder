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
  const { fireOf } = VB['sim/house'];
  const Steps = VB['sim/steps'],
    { targetOf } = Steps;
  // @state plan.season (a household's; VB-252, VB-1752): its season's steps in the plan record (sim/steps), by the default author: the
  //   targets first, each {target} with why {custom: 'template'}, then the season's routines ({routine: a kind of sim/kinds}) in the
  //   template's order, each with why the target it serves ({step, of}: wood's, hay's) or {custom: 'template'}, its author 'pawn' once its
  //   head set the order (VB-253's verb); each step from (the day it was made) and by (the season's last day). Made with the standing plan
  //   and again at its first review in each season from its culture's template, the last season's steps folded then (the fields' and the
  //   made goods' targets carried into the new); gone with the standing plan. The order is recorded, not yet enforced beyond what the role
  //   rankings do (VB-023 enforces the first order).
  // @state plan.head (a household's; VB-254): its head as planner, {pawn (the holder), since (game hours: when it became head), bias: {wood,
  //   hay, seed, fields, hours}: its multipliers on the template's targets (hours, VB-476: its lean, on the hours its estimate gives a
  //   task), each within Traits.HEAD.bias × (1 - its skill then) of 1}; drawn once
  //   from the stream `traits` when the plan is made and when the holder changes (sim/heirs' event newHead), never at a review; null while
  //   the household has no holder.
  // The targets of plan.season (VB-248, VB-252, VB-1752; read through Steps.targetOf(plan, store)): wood {store, seasons: [the woodpile's
  //   goal by season], second (a second hand cuts below it), ahead: {season, wood}}; hay {store, level (hay is made while the barn holds less
  //   than this many winters' need), ahead}; seed {store, level (grain kept back for each field not yet sown)}; fields {store, level (the
  //   fields wanted, times the bias), workable (those its hands can till), perHand (fields a working adult can till)}: wood's, hay's and
  //   seed's copied from the template when the season's steps are made, each times its head's bias (VB-254), perHand from it; fields and
  //   workable written at each review, which takes the land step; ahead (VB-254): what the head's horizon added at the last review to that
  //   season's woodpile goal and to the hay, taken off again at the next. A made good's (VB-698) {store: the good, good, level: the head's
  //   target on it, its choice or its household's need (sim/targets)}, compiled at each review, at a retarget and when the head sets one;
  //   none before the first. Read by wood (sim/kinds), hayWanted (sim/meadows), seedNeed (sim/hunger), the review and its land step; the
  //   goods' by the makers' rules through Targets.target.
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
  // The routines that serve a target (their why): the woodpile's and the hay's; the others serve the custom's template.
  const SERVES = { wood: 'wood', mow: 'hay', hay: 'hay' };
  // The index of the first routine of a season's steps (the targets come first).
  function targetsEnd(S) {
    let i = 0;
    while (i < S.length && S[i].what.target) i++;
    return i;
  }
  // The season's routines of household plan `plan`, in their order: the kinds.
  const routinesOf = (plan) => plan.season.slice(targetsEnd(plan.season)).map((s) => s.what.routine);
  // The household's season steps for the season of c, from its culture's template, its targets copied from it; from then on the review
  // reads the plan, never the template, so a later change to one household's plan touches no other. The last season's steps are folded:
  // their fields' and made goods' targets carried into the new ones.
  function seasonal(st, plan, c) {
    const id = plan.holder.id,
      T = templateOf(st, cultureOf(st, st.households[id]), c),
      F = targetOf(plan, 'fields'),
      of = Steps.keyOf(plan.body),
      from = c.day,
      by = c.day - c.sday + SEASON_DAYS - 1,
      list = [];
    const target = (t) => {
      const s = Steps.make(st, { target: t }, { custom: 'template' }, { from, by, left: { lo: 0, mid: 0, hi: 0 } });
      list.push(s);
      return s;
    };
    const wood = target({ store: 'wood', seasons: [0, 0, 0, 0], second: 0, ahead: { season: 0, wood: 0 } }),
      hay = target({ store: 'hay', level: 0, ahead: 0 });
    target({ store: 'seed', level: 0 });
    target({ store: 'fields', level: F ? F.level : 0, workable: F ? F.workable : 0, perHand: 0 });
    for (const good of Targets.MADE.keys()) {
      const G = targetOf(plan, good);
      if (G) target({ store: good, good, level: G.level });
    }
    for (const k of T.steps) {
      const t = SERVES[k] === 'wood' ? wood : SERVES[k] === 'hay' ? hay : null;
      list.push(
        Steps.make(st, { routine: k }, t ? { step: t.id, of } : { custom: 'template' }, {
          from,
          by,
          left: { lo: 0, mid: 0, hi: 0 },
        }),
      );
    }
    plan.season = list;
    biased(st, plan, T);
    chosenTargets(plan);
    project(st, plan, c);
    return list;
  }
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
  // projection, and the fields it wants, so that none waits for the next season or review. The season's steps themselves are kept: the
  // order of its routines (the template's, or one set by the player or the old head) and their making day stand to the season's end, as
  // a target the head chose does (plan.chosen), since a succession changes who plans, not what the season's work was set to be.
  function retarget(st, plan) {
    const hh = st.households[plan.holder.id],
      c = cal(st.t);
    if (!plan.season) {
      seasonal(st, plan, c);
    } else {
      biased(st, plan, templateOf(st, cultureOf(st, hh), c));
      chosenTargets(plan);
      project(st, plan, c);
    }
    if (hh.farmstead !== null) {
      const F = targetOf(plan, 'fields');
      F.workable = fieldsWorkable(st, hh, F.perHand);
      F.level = fieldsWanted(st, hh, F.workable, headBias(plan));
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
  // The head's targets from the template's T, at the making of its season's steps: each times the head's bias, and the fields a hand can
  // till. The review reads them from the plan from then on (VB-252); only what it projects ahead (project, below) is added at each review.
  // The woodpile's are a cottage's times the house's own fire (sim/house fireOf: a timber house burns less, so its household cuts less;
  // VB-1669).
  function biased(st, plan, T) {
    const W = targetOf(plan, 'wood'),
      H = targetOf(plan, 'hay'),
      S = targetOf(plan, 'seed'),
      F = targetOf(plan, 'fields'),
      b = plan.head ? plan.head.bias : UNBIASED,
      w = b.wood * fireOf(st, st.households[plan.holder.id]);
    for (let s = 0; s < 4; s++) W.seasons[s] = T.wood[s] * w;
    W.second = T.woodSecond * w;
    H.level = T.hayWinters * b.hay;
    S.level = T.seed * b.seed;
    W.ahead = { season: 0, wood: 0 };
    H.ahead = 0;
    F.perHand = T.perHand;
  }
  // What the household will burn and feed from today to the end of horizon hz (seasons ahead: 0 none, 1 to the season's end, 2 a season
  // further): the hearth's ECON.woodUse by season times the house's own fire (fire, sim/house fireOf), and the stall days within it over a
  // winter's (in winters' need of hay).
  function burnAhead(st, c, hz, fire) {
    const use = st.ECON.woodUse,
      days = daysAhead(c, hz);
    let stall = 0;
    for (let d = 0; d < days; d++) {
      const doy = (c.doy + d) % YEAR_DAYS;
      if (doy >= HERD.stall[0] || doy < HERD.stall[1]) stall++;
    }
    const wood = hz
      ? fire * (use[c.season] * (SEASON_DAYS - c.sday) + (hz > 1 ? use[(c.season + 1) % 4] * SEASON_DAYS : 0))
      : 0;
    return [wood, stall / HERD.stallDays];
  }
  // What the head projects the household will burn and feed before its horizon ends, at a review (design.md, How a holder chooses:
  // foresight: a poor head reacts when a store crosses its target, a good one projects ahead): the template's target is the reserve
  // every head keeps; a head that reacts projects nothing, and one that projects lays in besides what the hearth will burn and the herd
  // eat in the stall days to its horizon's end (burnAhead). Kept in the targets' ahead so that the next review takes it off before adding its
  // own; none on a target the head chose (VB-253). The seed is held back from the harvest by every head (Reservations: the seed kept for
  // sowing is the first), so the horizon does not move it; only the bias does. A few multiplications and a walk over the horizon's days;
  // draws nothing. (VB-485 had put the horizon in place of the template's look-ahead; withdrawn by the orchestrator, 16 Nov, as against
  // the Decided mechanism: backlog/VB-485.md.)
  function project(st, plan, c) {
    const W = targetOf(plan, 'wood'),
      H = targetOf(plan, 'hay'),
      A = W.ahead,
      C = plan.chosen;
    W.seasons[A.season] -= A.wood;
    H.level -= H.ahead;
    let [wood, hay] = burnAhead(
      st,
      c,
      horizonOf(headSkill(st, plan.holder.id)),
      fireOf(st, st.households[plan.holder.id]),
    );
    if (C && C.wood !== null) wood = 0;
    if (C && C.hay !== null) hay = 0;
    W.seasons[c.season] += wood;
    H.level += hay;
    A.season = c.season;
    A.wood = wood;
    H.ahead = hay;
  }
  // The head's bias on the fields its household's food asks (sim/fields' fieldsWanted applies it to the sown fields, whole, before the
  // hands cap them and the fallow ones go on top: VB-485, so that a hands-limited household's head is not cut by a low bias more often
  // than it is raised by a high one; VB-350).
  const headBias = (plan) => (plan.head ? plan.head.bias.fields : 1);
  // The head's targets over the plan's (at its making each season, at each review and when one is set): the woodpile's goal in every season.
  function chosenTargets(plan) {
    const C = plan.chosen;
    if (!C) return;
    const W = targetOf(plan, 'wood'),
      H = targetOf(plan, 'hay'),
      F = targetOf(plan, 'fields');
    if (C.hay !== null) H.level = C.hay;
    if (C.wood !== null) for (let s = 0; s < 4; s++) W.seasons[s] = C.wood;
    if (C.hay !== null) H.ahead = 0; // what was projected is gone with the target it was on (VB-254)
    if (C.wood !== null) W.ahead.wood = 0;
    if (C.fields !== null) F.level = Math.min(C.fields, F.workable);
  }
  // The head's target on each good its household makes (VB-698): its choice, else its rule's need now (sim/targets), a target step of
  // the season's (made at its first compiling, after the other targets). On the head's planning day, at a retarget and when one is
  // chosen: a few reads a made good, never in a step.
  function goodTargets(st, plan, hh) {
    const C = plan.chosen && plan.chosen.goods,
      S = plan.season;
    for (const good of Targets.MADE.keys()) {
      const n = C ? C[good] : undefined,
        // beyond the need, what the head reckons it can place of the asks it read (sim/asks, VB-699: plan.placed)
        level =
          (n === undefined || n === null ? Targets.need(st, hh, good) : n) +
          ((plan.placed && plan.placed.goods[good]) || 0),
        G = targetOf(plan, good);
      if (G) G.level = level;
      else {
        const s = Steps.make(
          st,
          { target: { store: good, good, level } },
          { custom: 'template' },
          { from: S[0].from, by: S[0].by, left: { lo: 0, mid: 0, hi: 0 } },
        );
        S.splice(targetsEnd(S), 0, s);
      }
    }
  }
  // A household's targets at its plan's making: its head, its season's steps and the fields it wants.
  function begin(st, plan, hh) {
    plan.season = null;
    if (plan.head === undefined) newHead(st, plan);
    seasonal(st, plan, cal(st.t));
    if (hh.farmstead !== null) {
      const F = targetOf(plan, 'fields');
      F.workable = fieldsWorkable(st, hh, F.perHand);
      F.level = fieldsWanted(st, hh, F.workable, headBias(plan));
    }
  }
  // The targets of today's values at a review: the fields wanted (which the land step reads), the head's choices over them, what its
  // horizon projects, and the made goods'.
  function reviewTargets(st, plan, hh, c) {
    const F = targetOf(plan, 'fields');
    F.workable = fieldsWorkable(st, hh, F.perHand);
    F.level = fieldsWanted(st, hh, F.workable, headBias(plan));
    chosenTargets(plan);
    project(st, plan, c);
    goodTargets(st, plan, hh);
  }
  // Whether household plan `plan`'s season steps are of the season of c (made in it: `by` is its last day).
  const seasonNow = (plan, c) => !!plan.season && plan.season.length > 0 && plan.season[0].by >= c.day;
  // The season's routines in the head's order, until the next season's steps are made (recorded; VB-023's enforcement was not merged):
  // each routine's step kept, its author the head's verb.
  function setOrder(st, id, steps) {
    const S = st.plans.households.get(id).season,
      n = targetsEnd(S),
      by = new Map();
    for (let i = n; i < S.length; i++) by.set(S[i].what.routine, S[i]);
    S.length = n;
    for (const k of steps) {
      const s = by.get(k);
      s.author = 'pawn';
      S.push(s);
    }
  }
  return {
    ROUTINES,
    cultureOf,
    routinesOf,
    seasonNow,
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
    setOrder,
  };
})();
