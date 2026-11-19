// @sys sim/plans: holders' plans (design.md section 7; VB-258, VB-248, VB-249, VB-252, VB-257): a standing plan per live household and village, a
// seasonal plan per live household from its culture's template of the year; targets, land step, seed; planning days by the head's
// diligence, and the due-queue that opens the time-bound kinds at their hours; the village's routines, set by its meeting
VB['sim/plans'] = (() => {
  const { rotationWhy, takeRotation, turnWhy, outOfTurn } = VB['sim/fields'];
  const { living, home, settlement } = VB['sim/records'];
  const { WORK, DAY, TICKS, HERD, SEASON_DAYS, YEAR_DAYS, FIELDS, CROPS, ROTATIONS, TRAVEL, cal } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  const Traits = VB['sim/traits'];
  const Stores = VB['sim/stores'],
    SEED_CROP = 'barley',
    SEED = Stores.grainGood(SEED_CROP), // the seed reserved: barley's, and each other crop's its rotation sows (VB-350)
    OTHER_CROPS = Stores.CROP_LIST.filter((k) => k !== SEED_CROP);
  const { KINDS } = VB['sim/kinds'];
  const { seedNeed } = VB['sim/hunger'];
  const { fieldsWanted, rotationChoice, fieldsWorkable, fieldWhy, pickField, beginField } = VB['sim/fields'];
  const Projects = VB['sim/projects'],
    { on, emit } = VB['sim/events'],
    { log } = VB['sim/records'];
  const { meadowWhy, pickMeadow, beginMeadow, wantsMeadow, wantsFirstMeadow } = VB['sim/meadows'];
  const { issue, register } = VB['sim/commands'];
  const { reviewWant } = VB['sim/exchange'];
  const Lying = VB['sim/lying'];
  const Targets = VB['sim/targets'];
  const { buildStep } = VB['sim/building'];
  const Green = VB['sim/green'],
    Workdays = VB['sim/workdays'],
    Commons = VB['sim/commons'];
  const { heldFarms } = VB['sim/ownership'];
  // @state st.plans: {households: Map of household id to plan, villages: Map of village id to plan, seasons: Map of household id to its
  //   seasonal plan, due: the due-queue, projects and projectSeq: the project plans (sim/projects, VB-123)}; a standing plan is
  //   {holder: {type: 'household' | 'village', id}, kind: 'standing', nextReview (game hours: its next planning day's review), last (the day
  //   of its last review), woke (the day of its last review woken by a store), looked (the day a member last looked for work outside the
  //   plan's tasks), dirty (sim/stores: a store crossed a target since the last review), reserved, reasons (sim/stores' reservations)}, and a
  //   household's also {targets, tiles, counted}. One standing plan per undissolved household and per village; a dissolved household's plan
  //   is dropped with it, so the maps hold only live holders (Rules for cost, 1). Its review asks each kind where it is available for the
  //   holder (refreshJobs, sim/jobs) on the holder's planning day, and out of turn when a window closes or a store crosses a target.
  // @state st.plans.seasons (VB-252): a household's seasonal plan, {holder, kind: 'season', year, season (of cal), made (the day), steps (the
  //   season's routines in the template's order: kinds of sim/kinds), by (absent, or 'head' once its head set the order: VB-253's verb)};
  //   one per undissolved household, made with its standing plan and again
  //   at the standing plan's first review in each season, from its culture's template; dropped with it. The order is recorded, not yet
  //   enforced beyond what the role rankings do (VB-023 enforces the first order).
  // @state st.plans.due: [[hour, household id, index in WINDOWED]], sorted by hour, then id, then index: one entry per live household and
  //   time-bound kind, the hour its kind is next asked for the household (VB-249; Rules for cost, 4). Written only here.
  // @state plan.head (a household's; VB-254): its head as planner, {pawn (the holder), since (game hours: when it became head), bias: {wood,
  //   hay, seed, fields}: its multipliers on the template's targets, each within Traits.HEAD.bias × (1 - its skill then) of 1}; drawn once
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
  // @state plan.tiles: {field, meadow}: the tile the plan names for its next field or meadow in place of the holder's choice, -1 for none;
  //   named by the head's verb `tile` (VB-253), used once and cleared by the land step, or cleared there when it no longer passes.
  //   plan.counted: the year its herds were last counted for the cull (sim/byre), or null.
  // @state plan.chosen (a household's; VB-253): absent until its head first chooses through a verb (the player as head), then {hay (winters),
  //   fields, wood (loads), cow (0 or 1), goods ({[made good]: n}, VB-698; absent until one is chosen): the head's targets in place of the
  //   template's and the holder's rule's, each null for none;
  //   project: 'none' (no project of the household's is begun by its own rule until cleared) or null}. Each lasts until cleared.
  //   Written only by the head's verbs (setTarget, holdProject), applied by seasonal and reviewed; cow is read by sim/exchange.
  // @state plan.routines (a village's; VB-257): the keys of VILLAGE_ROUTINES the village does this year, at most MAX_ROUTINES, each a source
  //   of the village's tasks (sim/jobs asks only their kinds); plan.routinesBy: how they were set, 'founded' (the founders' choice, until
  //   the first meeting), 'meeting' (the meeting decided), or, when it did not decide, its culture's practice noDecision ('nothing',
  //   'asLastYear'); plan.routinesYear: the year of cal they were set. Written only by setRoutines, through the meeting's verb.
  // @state plan.build (a household's; VB-332): its building step, {tile, kind 'pick' | 'quarry' | null} (where its stone comes from; -1 and
  //   null for nowhere in reach) while it means to raise its house onto stone, else null or absent; set at each review (sim/building's buildStep).
  // ---- project plans (VB-123; design.md section 7): their record and reads are sim/projects'; only this section writes them ----
  const { projectsOf, projectOf, holderOf } = Projects;
  function remove(st, plan) {
    const map = st.plans.projects[plan.holder.type],
      list = map.get(plan.holder.id) || [],
      i = list.indexOf(plan);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) map.delete(plan.holder.id);
    const k = st.plans.projects.heirPlots.indexOf(plan);
    if (k >= 0) st.plans.projects.heirPlots.splice(k, 1);
  }
  // A project plan for holder {type, id}, from {what, steps, hold, ...its own fields} (sim/fields' fieldProject, sim/meadows', a plot): what
  // its steps spend is reserved from the holder's free stock (null, and no plan, when another plan holds it), `hold` kept back for after it.
  function makeProject(st, type, id, { what, steps, hold = null, ...own }) {
    const holder = holderOf(st, { type, id }),
      P = st.plans.projects,
      spend = {};
    const plan = {
      id: ++st.plans.projectSeq,
      holder: { type, id },
      kind: 'project',
      what,
      ...own,
      steps,
      open: 0,
      reserved: {},
      reasons: {},
    };
    if (!P[type].has(id)) P[type].set(id, []);
    P[type].get(id).push(plan);
    if (type === 'household' && what === 'plot') P.heirPlots.push(plan);
    for (const s of steps) for (const good in s.spends || {}) spend[good] = (spend[good] || 0) + s.spends[good];
    for (const good in spend)
      if (!Stores.reserve(st, holder, plan, good, spend[good], 'build')) {
        dropProject(st, plan);
        return null;
      }
    for (const good in hold || {}) Stores.reserve(st, holder, plan, good, hold[good], 'field');
    return plan;
  }
  // The open step done: what it spends taken from the store with its reservation, the next step open; after the last, the plan finished.
  function advance(st, plan) {
    const s = plan.steps[plan.open],
      holder = holderOf(st, plan.holder);
    for (const good in s.spends || {}) {
      const left = plan.reserved[good] - s.spends[good];
      if (left > 1e-9) Stores.reserve(st, holder, plan, good, left, 'build');
      else Stores.release(st, holder, plan, good, 'build');
      Stores.take(st, holder, good, s.spends[good], 'build');
    }
    if (++plan.open >= plan.steps.length) {
      Stores.releaseAll(plan);
      remove(st, plan);
    }
  }
  // The plan is given up: its reservations released, the plan removed, and `text` told as a notable event when given.
  function dropProject(st, plan, text = null, at = {}) {
    Stores.releaseAll(plan);
    remove(st, plan);
    leftWood(st, plan);
    if (text) log(st, text, { kind: 'projectDropped', ...at });
    emit(st, 'planDropped', { plan }); // a head's aim on it ends at once (sim/aims, VB-1224), not at its next review
  }
  // Timber carried to a step at its household's house and not yet built in (a barn's walls, a cart's: VB-255) goes onto that farm's
  // woodpile as the plan is dropped: the farmstead is one place, so nothing is carried, and nothing vanishes.
  function leftWood(st, plan) {
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    for (let i = plan.open; i < plan.steps.length && f; i++) {
      const s = plan.steps[i];
      if (s.place === f.house && s.wood > 0) Stores.put(st, hh, 'wood', s.wood, 'timber');
      // timber carried to a boat's shore (VB-300) lies there, for its household to fetch home or for the frost (sim/lying; VB-645)
      else if (s.wood > 0)
        Lying.leave(st, 'leftTimber', (s.wood / st.ECON.woodPerTrip) * TRAVEL.load, s.place, plan.holder);
    }
  }
  // Why the plan's open step is no longer possible, or null: its holder is gone; the claim it works under is lost (contested away, lapsed;
  // st.claims read as sim/claims keeps it); the holder's stock no longer covers what its steps will spend (the reserved good lost).
  function impossible(st, plan) {
    const h = holderOf(st, plan.holder),
      s = plan.steps[plan.open],
      by = plan.holder;
    if (!h || h.dissolved || (by.type === 'pawn' && !h.alive)) return 'its holder is gone';
    const c = s.stake && (st.claims.get(s.place) || []).find((x) => x.by.type === by.type && x.by.id === by.id);
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
  // The plan reviewed at once when a store or a right of its holder changed: while its step is possible it stands; else it is dropped and
  // told, in its own words (dropWords), in `text` and `at` given by the change, or not at all when `told`. True when it stands.
  function review(st, plan, told = false, text = null, at = null) {
    const why = impossible(st, plan);
    if (!why) return true;
    if (!told && !text) [text, at] = dropWords(st, plan, why);
    dropProject(st, plan, told ? null : text, at || {});
    return false;
  }
  // Every plan of a holder that ends (a household dissolved), without a word: the end of its holder is told.
  // A household's plot for its heir is not dropped but passes to its village (the verb plotToVillage; VB-255), its tiles and work with it.
  const dropAll = (st, type, id) => {
    for (const plan of [...projectsOf(st, type, id)])
      if (plan.what === 'plot' && type === 'household')
        issue(st, {
          actor: null,
          verb: 'plotToVillage',
          target: id,
          args: { plan: plan.id, why: 'the household is no more' },
          source: 'construction',
        });
      else dropProject(st, plan);
  };
  // A claim lost on a tile (sim/stakes; -1: all; `told`, or `text` and `at`); a store short (sim/stores); a step done (sim/fields,
  // sim/meadows, sim/expansion, sim/cottage: `plan` names it when the holder has several); a plot begun (sim/expansion).
  on('rightLost', (st, d) => {
    for (const plan of [...projectsOf(st, d.type, d.id)]) {
      if (d.tile < 0 || plan.steps.some((s) => s.place === d.tile))
        review(st, plan, !!d.told, d.text || null, d.at || null);
    }
  });
  on('storeShort', (st, d) => {
    for (const plan of [...projectsOf(st, d.type, d.id)]) if (plan.reasons[d.good] === 'build') review(st, plan);
  });
  on('stepDone', (st, d) => {
    const plan = d.plan || projectOf(st, d.type, d.id);
    if (plan) advance(st, plan);
  });
  on('projectBegun', (st, d) => {
    makeProject(st, d.type, d.id, d.project);
  });
  // A plan passes to another holder (sim/expansion: a household's plot for its heir, to its village; VB-255), its steps and work with it.
  on('projectHanded', (st, d) => {
    const P = st.plans.projects,
      plan = d.plan;
    remove(st, plan);
    plan.holder = { type: d.type, id: d.id };
    if (!P[d.type].has(d.id)) P[d.type].set(d.id, []);
    P[d.type].get(d.id).push(plan);
  });
  // A village gives up a cleared plot nobody came for (sim/expansion, VB-646): the plan goes, its reservations released.
  on('plotReleased', (st, d) => dropProject(st, d.plan));
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
  const year = (id, base) => Rules.declare({ id: 'year.' + id, owner: 'sim/plans', combine: 'sum', base });
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
    UNBIASED = Object.freeze({ wood: 1, hay: 1, seed: 1, fields: 1 });
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
  // The hours at which plans may be reviewed and the due-queue is asked: every hour from one before work starts to the end of work
  // (sim/clock calls refreshJobs then).
  const reviewHour = (h) => h >= WORK[0] - 1 && h <= WORK[1];
  // The first review hour after the hour of time t.
  function reviewAfter(t) {
    const day = Math.floor(t / DAY),
      h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  // ---- the village's routines (design.md section 7, Village routines; VB-257) ----
  // The village work a meeting may choose from, in the order it is weighed: each routine names the kinds it is the source of (asked at
  // the village's review, sim/jobs), whether the village has that work this year, and how much it weighs at the meeting (`need`, a
  // stand-in for the voices' support until slice 5's Decisions, VB-313). The fence's stretches are the first; the green and well (VB-058),
  // a common field (VB-100) and work days (VB-120) add theirs.
  const VILLAGE_ROUTINES = Object.freeze({
    fence: Object.freeze({
      label: 'Keeping the village fence',
      kinds: Object.freeze(['mend']),
      available: (st, v) => v.fence.length > 0,
      need: (st, v) => {
        let n = 0;
        for (const s of v.fence) n += 1 - s.cond;
        return n;
      },
    }),
    // the green and well (VB-058): while the village has two or more occupied farms and no well, or its green is under way; weighed by
    // the farms that would draw water there
    green: Object.freeze({
      label: 'Laying out the green and digging the well',
      kinds: Object.freeze(['green', 'wellstone', 'well', 'sweep']),
      available: (st, v) => Green.wanted(st, v),
      need: (st, v) => Green.houses(st, v).length,
    }),
    // work days (VB-120): while the village has a fence to close; weighed, as the green, by the farms that would turn out. Set only by a
    // meeting, for the coming year (Kim, 10 Nov): the founders' first routines hold none
    workdays: Object.freeze({
      label: 'Work days at the fence and the commons',
      meeting: true,
      kinds: Object.freeze(['workfence', 'workclear']),
      available: (st, v) => Workdays.wanted(st, v),
      need: (st, v) => Green.houses(st, v).length,
    }),
    // a common field (VB-100; Kim, 10 Nov): while the village has common fields to work, one under way, or would make one (sim/commons:
    // three or more farms, its store short, meadow near the green); weighed, as the green, by its farms. Set only by a meeting. Its jobs
    // are posted by one shared rule (sim/kinds' commonWork), which asks the routine itself
    commons: Object.freeze({
      label: 'A common field for the village store',
      meeting: true,
      kinds: Object.freeze([]),
      available: (st, v) => Commons.available(st, v),
      need: (st, v) => Green.houses(st, v).length,
    }),
  });
  const MAX_ROUTINES = 4;
  // The routines chosen from candidates [[need, key]], most needed first and in their order of declaration between equals: at most
  // MAX_ROUTINES, or null when the last place is tied with the first left out (the meeting does not decide). Pure.
  function rankRoutines(cands) {
    const order = Object.keys(VILLAGE_ROUTINES),
      sorted = [...cands].sort((a, b) => b[0] - a[0] || order.indexOf(a[1]) - order.indexOf(b[1]));
    if (sorted.length > MAX_ROUTINES && sorted[MAX_ROUTINES - 1][0] === sorted[MAX_ROUTINES][0]) return null;
    return sorted.slice(0, MAX_ROUTINES).map((c) => c[1]);
  }
  // The routines a village would choose from its work available now, or null for a tie; its founders (`founders`) choose none that only a
  // meeting sets (`meeting`).
  function chooseRoutines(st, v, founders = false) {
    const cands = [];
    for (const k of Object.keys(VILLAGE_ROUTINES)) {
      const R = VILLAGE_ROUTINES[k];
      if (!(founders && R.meeting) && R.available(st, v)) cands.push([R.need(st, v), k]);
    }
    return rankRoutines(cands);
  }
  // Why a list of routines may not be a village's, or null: each a known routine, once, at most MAX_ROUTINES.
  function routinesWhy(list) {
    if (!Array.isArray(list)) return 'the routines are not a list';
    if (list.length > MAX_ROUTINES) return `at most ${MAX_ROUTINES} routines`;
    for (const k of list) if (!Object.hasOwn(VILLAGE_ROUTINES, k)) return `there is no routine ${k}`;
    return new Set(list).size === list.length ? null : 'a routine is named twice';
  }
  // The village's routines become `list`, set `by` ('founded', 'meeting', 'nothing', 'asLastYear'): the one writer (the meeting's verb,
  // sim/commands, and the plan's making). They post from the village's next review on; those no longer chosen are taken down at it.
  function setRoutines(st, vid, list, by) {
    const plan = st.plans.villages.get(vid);
    plan.routines = [...list];
    plan.routinesBy = by;
    plan.routinesYear = cal(st.t).year;
  }
  // Does the village's plan ask kind k this year: is it a kind of one of its routines. Allocates nothing.
  function routineAsks(plan, k) {
    const list = plan.routines;
    for (let i = 0; i < list.length; i++) if (VILLAGE_ROUTINES[list[i]].kinds.includes(k)) return true;
    return false;
  }
  const mapOf = (st, type) => (type === 'household' ? st.plans.households : st.plans.villages);
  // ---- planning days (design.md section 7, Planning days; VB-249) ----
  const FIRST = WORK[0] - 1,
    HOURS = WORK[1] - FIRST + 1; // the review hours, 5:00 to 18:00
  // Days between a holder's reviews: by its head's diligence, every third day (the lowest third), every second, or daily; a village's daily.
  function cadence(st, plan) {
    if (plan.holder.type !== 'household') return 1;
    const head = st.households[plan.holder.id].holder;
    if (head === null || head === undefined) return 1;
    const d = Traits.of(st, head, 'diligence');
    return d < 1 / 3 ? 3 : d < 2 / 3 ? 2 : 1;
  }
  // The holder's next planning hour after `hour`: its hour of the working day and its day in the cycle are offset by its id, so reviews
  // spread over the days and over the hours of work (rule 5); a village is offset from the household of the same id.
  function nextSlot(plan, cad, hour) {
    const id = plan.holder.id + (plan.holder.type === 'household' ? 0 : 7),
      h = FIRST + ((id * 5) % HOURS);
    let day = Math.floor(hour / DAY);
    if (day * DAY + h <= hour) day++;
    while ((day + id) % cad) day++;
    return day * DAY + h;
  }
  // Days on which a window is about to close, or has just closed, and every holder is reviewed at its first review hour: the last day of
  // sowing and the day after it (its hoeing and sowing taken down), the two last days of autumn (the harvest before the frost), and the first
  // day of winter (the ice: fishing taken down, VB-117).
  const SOWN = Object.keys(CROPS).filter((k) => !CROPS[k].fallow && CROPS[k].sow);
  // Barley's window closes for every holder; another crop's (rye's in autumn, VB-999) only for a household whose farm sows it.
  const closes = (k, c) => {
    const W = CROPS[k].sow;
    return c.season === W[0] && (c.sday === W[2] || c.sday === W[2] + 1);
  };
  function closing(st, c, plan) {
    return (
      closes('barley', c) ||
      (c.season === 2 && c.sday >= SEASON_DAYS - 2) ||
      (c.season === 3 && c.sday === 0) ||
      (!!plan && cropClosing(st, c, plan))
    );
  }
  function cropClosing(st, c, plan) {
    if (plan.holder.type !== 'household' || !SOWN.some((k) => closes(k, c))) return false;
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    return (
      !!f &&
      f.fields.some((fd) => ROTATIONS[fd.rotation || 'every'].courses.some((k) => SOWN.includes(k) && closes(k, c)))
    );
  }
  // A household whose field is ripe, or that has a field still to hoe or sow while the sowing window is open, at the first review hour:
  // its fields' window is closing on it (a crop that waits for a planning day meets the frost; VB-322). Walks its own fields and those of a
  // farm it holds in trust (VB-309).
  function fieldsDue(st, plan, c) {
    if (plan.holder.type !== 'household' || c.hour !== FIRST) return false;
    const hh = st.households[plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return false;
    const due = (g) =>
      g.fields.some((fd) => {
        const W = CROPS[fd.crop].sow,
          sow = c.season === W[0] && c.sday >= W[1] && c.sday <= W[2];
        const idle = fd.stage === 'plowed' || (fd.stage === 'stubble' && !(CROPS[fd.crop].fallow && fd.rest === 1)); // fallow: tilled once
        return fd.stage === 'ripe' || (sow && idle);
      });
    return due(f) || heldFarms(st, hh.id).some(due);
  }
  // A village whose meeting chose work days, at the first review hour of a work day: it calls its village out (VB-120).
  const workdayDue = (plan, c) =>
    plan.holder.type === 'village' && c.hour === FIRST && !!Workdays.dayOf(c) && plan.routines.includes('workdays');
  // Why the holder's plan is reviewed at this hour, or null: its planning day ('day'); a window closing today, its fields due today, or a
  // village's work day, once ('window'); a store that crossed a target, at most one such review a day ('store').
  function reviewWhy(st, plan, hour, c) {
    if (hour >= plan.nextReview) return 'day';
    if (plan.last !== c.day && (closing(st, c, plan) || fieldsDue(st, plan, c) || workdayDue(plan, c))) return 'window';
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
    const q = st.plans.due,
      end = Math.floor(hour / DAY) * DAY + WORK[1];
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
  // A household's targets, seasonal plan, tiles, cull record and reservation of seed, at its plan's making and at the load of a save
  // without them.
  function household(st, plan) {
    const hh = st.households[plan.holder.id];
    plan.targets = { wood: [0, 0, 0, 0], woodSecond: 0, hayWinters: 0, seed: 0, perHand: 0, fields: 0, workable: 0 };
    if (plan.head === undefined) newHead(st, plan);
    seasonal(st, plan, cal(st.t));
    const T = plan.targets;
    if (hh.farmstead !== null) {
      T.workable = fieldsWorkable(st, hh, T.perHand);
      T.fields = fieldsWanted(st, hh, T.workable, headBias(plan));
    }
    plan.tiles = { field: -1, meadow: -1 };
    plan.counted = null;
    reserveSeed(st, hh, plan);
  }
  // The seed a household's plan holds back (VB-350; design.md, Seed, The reserve): of each crop of its farm's rotation, for the fields
  // that sow it next (sim/hunger's seedNeed, which the stores follow between reviews); a crop it no longer sows is no longer held back.
  function reserveSeed(st, hh, plan) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
      R = f && f.fields.length ? ROTATIONS[f.fields[0].rotation].courses : [];
    Stores.reserve(st, hh, plan, SEED, f ? seedNeed(st, hh, SEED_CROP) : 0, 'seed');
    for (const k of OTHER_CROPS) {
      const g = Stores.grainGood(k);
      if (R.includes(k) || (f && f.keeps && f.keeps.includes(k)))
        Stores.reserve(st, hh, plan, g, seedNeed(st, hh, k), 'seed');
      else if (plan.reasons[g] === 'seed') Stores.release(st, hh, plan, g, 'seed');
    }
  }
  // A village's first routines, until its first meeting: what its founders would choose from the work it has (a tie: all of it, the first
  // MAX_ROUTINES in their order). Also at the load of a save made before routines.
  function founded(st, plan) {
    const v = st.villages[plan.holder.id],
      list = chooseRoutines(st, v, true);
    setRoutines(
      st,
      v.id,
      list ||
        Object.keys(VILLAGE_ROUTINES)
          .filter((k) => !VILLAGE_ROUTINES[k].meeting && VILLAGE_ROUTINES[k].available(st, v))
          .slice(0, MAX_ROUTINES),
      'founded',
    );
  }
  // A holder's standing plan, made when the household is founded or the village is (and for every holder at seed and load). Its first
  // review is at the next review hour, whatever its planning day.
  function makePlan(st, type, id) {
    const plan = {
      holder: { type, id },
      kind: 'standing',
      nextReview: reviewAfter(Math.floor(st.tick / TICKS) - 1),
      last: null,
      woke: null,
      looked: null,
      dirty: false,
      reserved: {},
      reasons: {},
    };
    mapOf(st, type).set(id, plan);
    if (type === 'household') {
      household(st, plan);
      enqueue(st, id);
    } else founded(st, plan);
    return plan;
  }
  // A dissolved household's plan goes with it, its reservations with the plan, and its entries leave the due-queue.
  function dropPlan(st, type, id) {
    mapOf(st, type).delete(id);
    dropAll(st, type, id); // its project plans with it
    if (type === 'household') {
      st.plans.seasons.delete(id);
      st.plans.due = st.plans.due.filter((e) => e[1] !== id);
    }
  }
  const planOf = (st, type, id) => mapOf(st, type).get(id);
  // The plans of every live holder, at seed, and at the load of a save made before plans (VB-258).
  function seedPlans(st) {
    st.plans = {
      households: new Map(),
      villages: new Map(),
      seasons: new Map(),
      due: [],
      projects: Projects.emptyProjects(),
      projectSeq: 0,
    };
    for (const id of st.liveHouseholds) makePlan(st, 'household', id);
    for (const v of st.villages) makePlan(st, 'village', v.id);
  }
  // A save made before the plans' targets and reservations (VB-248), before planning days and the due-queue (VB-249), or before seasonal
  // plans (VB-252): its plans get them as made now.
  function fillPlans(st) {
    if (!st.plans.seasons) st.plans.seasons = new Map();
    if (!st.plans.projects) {
      st.plans.projects = Projects.emptyProjects();
      st.plans.projectSeq = 0;
    } // VB-123: project plans
    if (!st.plans.projects.heirPlots) st.plans.projects.heirPlots = []; // VB-255: nor the index of the households' plots
    for (const plan of [...st.plans.households.values(), ...st.plans.villages.values()]) {
      if (!plan.reserved) {
        // a save made before reservations gets empty ones (sim/stores writes them)
        plan.reserved = {}; // lint-allow: owner an old save's migration
        plan.reasons = {}; // lint-allow: owner an old save's migration
        if (plan.holder.type === 'household') household(st, plan);
      }
      if (plan.holder.type === 'household' && plan.head === undefined) newHead(st, plan); // VB-254: nor heads
      if (plan.holder.type === 'household' && !st.plans.seasons.has(plan.holder.id)) seasonal(st, plan, cal(st.t));
      if (plan.holder.type === 'village' && !plan.routines) founded(st, plan); // VB-257: nor routines
      if (plan.last === undefined) {
        plan.last = null;
        plan.woke = null;
        plan.looked = null;
        plan.dirty = false; // lint-allow: owner a save made before the flag gets it clear (sim/stores sets it)
      }
    }
    if (!st.plans.due) {
      st.plans.due = [];
      for (const id of st.plans.households.keys()) enqueue(st, id);
    }
  }
  // A plan reviewed now, for `why` (reviewWhy): on its planning day its next is set by its cadence; a review out of turn leaves it. The
  // flag of a store is cleared. A household's first review in a season makes its seasonal plan from the template (VB-252); every review
  // reads the targets from the plan, writes those of today's values (the fields wanted, which the land step reads), notes the year's count
  // of its herds once it is held, and reserves the seed its unsown fields and its land project need (sim/stores counts it again when read).
  function reviewed(st, plan, c, why = 'day') {
    const hour = Math.floor(st.tick / TICKS);
    VB.count.planReview++;
    if (hour >= plan.nextReview) plan.nextReview = nextSlot(plan, cadence(st, plan), hour);
    plan.last = c.day;
    if (why === 'store') plan.woke = c.day;
    plan.dirty = false; // lint-allow: owner the review has read the stores whose crossing sim/stores flagged
    if (plan.holder.type !== 'household') {
      greenStep(st, plan);
      commonsStep(st, plan);
      return;
    }
    const hh = st.households[plan.holder.id],
      T = plan.targets,
      sp = seasonOf(st, hh.id);
    if (sp.year !== c.year || sp.season !== c.season) seasonal(st, plan, c);
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    const turn = f && f.household === hh.id ? rotationChoice(st, f, hh, c) : null; // the rotation it holds (VB-350), by its rule
    if (turn)
      issue(st, {
        actor: hh.holder === null ? { household: hh.id } : hh.holder,
        verb: 'rotation',
        target: hh.id,
        args: { rotation: turn.to, short: turn.short },
        source: 'pawn',
      }); // through the verb the played head has (VB-355)
    T.workable = fieldsWorkable(st, hh, T.perHand);
    T.fields = fieldsWanted(st, hh, T.workable, headBias(plan));
    chosenTargets(plan);
    project(st, plan, c);
    goodTargets(st, plan, hh);
    if (c.doy >= HERD.countDay && plan.counted !== c.year && hh.herds.length) plan.counted = c.year;
    reserveSeed(st, hh, plan);
    reviewWant(st, plan, hh, why); // a cow wanted (VB-390): plan.want, sim/exchange's
    plan.build = buildStep(st, plan, hh); // the building step (VB-332): open while the house is to be raised onto stone, and where its stone comes from
    emit(st, 'planReviewed', { plan, c, why }); // the head's projects (sim/aims, VB-255), its supply outlook (sim/outlook, VB-666)
  }
  // A village's review: while its routines hold the green and well and it has none under way, its green's project plan is made where a
  // tile is found (sim/green, VB-058).
  function greenStep(st, plan) {
    if (plan.holder.type !== 'village' || !plan.routines.includes('green')) return;
    const v = st.villages[plan.holder.id],
      p = Green.greenProject(st, v);
    if (!p) return;
    const made = makeProject(st, 'village', v.id, p);
    if (made) Green.laidOut(st, v, made);
  }
  // A village's review while its routines hold the commons (VB-100): a common field's project plan is made where the village would make
  // one (sim/commons), and the village store holds back the seed of its common fields not yet sown.
  function commonsStep(st, plan) {
    if (!plan.routines.includes('commons')) return;
    const v = st.villages[plan.holder.id],
      p = Commons.project(st, v);
    if (p) {
      const made = makeProject(st, 'village', v.id, p);
      if (made) Commons.begun(st, v, made);
    }
    if (Commons.fieldsOf(v).length) Stores.reserve(st, v, plan, SEED, seedNeed(st, v, SEED_CROP), 'seed');
  }
  // The land step (at each review of a household's plan): a new field while the household has fewer than the plan's target, else a hay
  // meadow while it is short of one; none while its head holds off projects (VB-253). The tile is the one the plan names, while it still
  // passes the verb's check (cleared when it no longer does), else the holder's choice (pickField, pickMeadow); the field or meadow is
  // begun through the head's verb `project`, the holder's rule as the player's (source 'pawn'; VB-253). `built`: the houses and greens,
  // once for every farm's look (sim/fields, builtTiles).
  function landStep(st, plan, f, hh, built) {
    if (!(plan.chosen && plan.chosen.project === 'none')) {
      if (!Projects.projectOf(st, 'household', hh.id) && f.fields.length < plan.targets.fields)
        landBy(st, plan, f, hh, 'field', built);
      if (!Projects.projectOf(st, 'household', hh.id) && (wantsMeadow(st, f, hh) || wantsFirstMeadow(st, f, hh)))
        landBy(st, plan, f, hh, 'meadow', built);
    }
    reserveSeed(st, hh, plan); // a project begun holds its seed from now
  }
  // The holder's rule for the land project `what`: the plan's named tile, or its own pick, begun through the verb.
  function landBy(st, plan, f, hh, what, built) {
    let tile = plan.tiles[what];
    if (tile >= 0 && (what === 'field' ? fieldWhy : meadowWhy)(st, f, hh, tile, built)) tile = plan.tiles[what] = -1;
    if (tile < 0) tile = (what === 'field' ? pickField : pickMeadow)(st, f, hh, built);
    if (tile < 0) return;
    const actor = hh.holder === null ? { household: hh.id } : hh.holder;
    issue(st, { actor, verb: 'project', target: hh.id, args: { what, tile }, source: 'pawn' });
  }
  // ---- the player as head (VB-253; design.md section 7, The player as head; section 15, Parity of command) ----
  // The head's choices of its plan, each the act of a verb of sim/commands (setTarget, nameTile, setOrder, holdProject, beginLand,
  // giveUp), which checks it first: a target, the tile of the next field or meadow, the order of the season's routines, the project.
  // A target's bounds, [least, most], for the household's plan now: hay 0 to 3 winters' need, fields 0 to what its hands can till, the
  // woodpile 0 to twice the winter's goal, a cow 0 (none wanted) or 1 (wanted while it holds a meadow and has no cattle).
  const HAY_MOST = 3;
  // A made good's (VB-698): 0 to its need and what the place and the hands allow beyond it (sim/targets).
  function targetBounds(st, plan, store) {
    if (Targets.isMade(store)) return Targets.bounds(st, st.households[plan.holder.id], store);
    if (store === 'hay') return [0, HAY_MOST];
    if (store === 'fields') return [0, plan.targets.workable];
    if (store === 'wood') return [0, 2 * st.ECON.woodWinter];
    if (store === 'cow') return [0, 1];
    return null;
  }
  // Why n may not be the target of `store` in household id's plan, or null (n null: the choice cleared, the holder's rule again).
  function targetWhy(st, id, store, n) {
    const plan = st.plans.households.get(id),
      b = plan && targetBounds(st, plan, store);
    if (!b) return `there is no target ${store}`;
    if (n === null) return null;
    if (!Number.isFinite(n) || n < b[0] || n > b[1]) return `${store} must be from ${b[0]} to ${b[1]}`;
    const whole = store === 'fields' || store === 'cow' || (Targets.isMade(store) && Targets.MADE.get(store).whole);
    return whole && !Number.isInteger(n) ? `${store} must be a whole number` : null;
  }
  const choices = (plan) =>
    plan.chosen || (plan.chosen = { hay: null, fields: null, wood: null, cow: null, project: null });
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
  // The target of `store` becomes n (null: the template's and the holder's rule's again, from the next season's plan or review; a made
  // good's at once).
  function setTarget(st, id, store, n) {
    const plan = st.plans.households.get(id),
      C = choices(plan);
    if (Targets.isMade(store)) {
      (C.goods || (C.goods = {}))[store] = n;
      goodTargets(st, plan, st.households[id]);
      return;
    }
    C[store] = n;
    chosenTargets(plan);
  }
  // The head's target on each good its household makes (VB-698): its choice, else its rule's need now (sim/targets). On the head's
  // planning day, at a retarget and when one is chosen: a few reads a made good, never in a step.
  function goodTargets(st, plan, hh) {
    const G = plan.targets.goods || (plan.targets.goods = {}),
      C = plan.chosen && plan.chosen.goods;
    for (const good of Targets.MADE.keys()) {
      const n = C ? C[good] : undefined;
      G[good] = n === undefined || n === null ? Targets.need(st, hh, good) : n;
    }
  }
  // The tile of the next field or meadow (`what`) becomes `tile`, or none (-1): the land step takes it when the household wants one.
  function nameTile(st, id, what, tile) {
    st.plans.households.get(id).tiles[what] = tile;
  }
  // Why `steps` may not be the order of household id's routines this season, or null: the same routines as its seasonal plan's, each once.
  function orderWhy(st, id, steps) {
    const sp = st.plans.seasons.get(id);
    if (!sp) return `household ${id} has no seasonal plan`;
    if (!Array.isArray(steps) || steps.length !== sp.steps.length || new Set(steps).size !== steps.length)
      return `the order must name each of the season's ${sp.steps.length} routines once`;
    for (const k of steps) if (!sp.steps.includes(k)) return `${k} is not a routine of the season`;
    return null;
  }
  // The season's routines in the head's order, until the next season's plan is made (recorded; VB-023's enforcement was not merged).
  function setOrder(st, id, steps) {
    const sp = st.plans.seasons.get(id);
    sp.steps = [...steps];
    sp.by = 'head';
  }
  // The head holds off projects (on true) or lets its rule take them again (false).
  function holdProject(st, id, on) {
    choices(st.plans.households.get(id)).project = on ? 'none' : null;
  }
  // Why household hh may not begin the land project `what` on `tile` now, or null: a farm of its own, no project under way, and the
  // tile's check (fieldWhy, meadowWhy: claims, reach, the farm's block).
  function landWhy(st, hh, what, tile) {
    if (what !== 'field' && what !== 'meadow') return `there is no land project ${what}`;
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `household ${hh.id} has no farm of its own`;
    const p = Projects.projectOf(st, 'household', hh.id);
    if (p) return `household ${hh.id} has a ${p.what} under way`;
    return (what === 'field' ? fieldWhy : meadowWhy)(st, f, hh, tile);
  }
  // The new field or meadow begun on `tile` (sim/fields' beginField, sim/meadows' beginMeadow: staked, or a stake contested), its project
  // plan made; the plan's named tile used. Nothing is begun when a contest is lost.
  function beginLand(st, hh, what, tile) {
    const f = st.farmsteads[hh.farmstead],
      p = what === 'field' ? beginField(st, f, hh, tile) : beginMeadow(st, f, hh, tile);
    if (!p) return;
    makeProject(st, 'household', hh.id, p);
    const plan = st.plans.households.get(hh.id);
    if (plan.tiles[what] === tile) plan.tiles[what] = -1;
  }
  // The household's project under way given up by its head, and told; the stake it worked under is dropped with it (sim/claims: a stake
  // is its household's project, sim/stakes), and the ground stays as the work left it.
  function giveUp(st, hh, plan) {
    const [text, at] = dropWords(st, plan, 'its head chose to');
    for (const s of plan.steps) if (s.stake) VB['sim/claims'].dropClaim(st, s.place, plan.holder);
    dropProject(st, plan, text, at);
  }
  // What the head may choose, for the page (VB-256): the targets now (the head's, by its foresight and bias: VB-254), the custom's (its
  // culture's template, unbiased; the fields its household's food asks), the head's own choices, their bounds, the named tiles, the
  // season's order and the project under way; the head's skill and horizon; or null for a household with no plan. Plain data, a copy.
  function headView(st, id) {
    const plan = st.plans.households.get(id),
      sp = st.plans.seasons.get(id);
    if (!plan || !sp) return null;
    const T = plan.targets,
      C = plan.chosen || {},
      p = Projects.projectOf(st, 'household', id),
      c = cal(st.t),
      hh = st.households[id],
      M = templateOf(st, cultureOf(st, hh), c),
      skill = headSkill(st, id);
    const target = (store, now, custom) => ({
      now,
      custom,
      chosen: C[store] ?? null,
      bounds: targetBounds(st, plan, store),
    });
    // the custom's fields beside the head's: both capped at what the hands can till; the head's bias is applied before that cap (VB-485),
    // so the two differ only where the bias moves the fields under it
    const wanted = hh.farmstead === null ? 0 : fieldsWanted(st, hh, T.workable);
    return {
      targets: {
        hay: target('hay', T.hayWinters, M.hayWinters),
        fields: target('fields', T.fields, wanted),
        wood: target('wood', T.wood[c.season], M.wood[c.season]),
        cow: target('cow', plan.want ? 1 : 0, null),
      },
      goods: Targets.view(st, hh, C.goods),
      head: plan.head
        ? { pawn: plan.head.pawn, skill, horizon: horizonOf(skill), keepsOrder: skill >= ORDER_LEAST }
        : null,
      tiles: { ...plan.tiles },
      order: [...sp.steps],
      orderBy: sp.by || 'template',
      project: p ? { id: p.id, what: p.what, step: p.steps[p.open].kind } : null,
      heldOff: C.project === 'none',
    };
  }
  // The head of household c.target, or why the actor is not: a living pawn that holds it, or {household} for a household with no holder
  // (its own rule); the household has a standing plan (VB-253).
  function heads(st, c) {
    const id = c.target;
    if (!home(st, id) || !st.plans.households.has(id)) return `there is no household ${id} with a plan`;
    const hh = st.households[id];
    if (Number.isInteger(c.actor))
      return (
        living(st, c.actor) ||
        (hh.holder !== c.actor
          ? `pawn ${c.actor} is not the head of household ${id}: only its head changes its plan`
          : null)
      );
    return c.actor && c.actor.household === id && hh.holder === null
      ? null
      : `only the head of household ${id} changes its plan`;
  }
  const farmOf = (st, c) => {
    const hh = st.households[c.target];
    return hh.farmstead !== null && st.farmsteads[hh.farmstead].household === hh.id
      ? null
      : `household ${c.target} has no farm of its own`;
  };
  const landWhat = (what) => (what === 'field' || what === 'meadow' ? null : `there is no land project ${what}`);
  // The tile a land project `what` is begun on: args.tile, else the tile the plan names, else the holder's own pick (-1: none).
  function landTile(st, hh, args) {
    if (Number.isInteger(args.tile)) return args.tile;
    const named = st.plans.households.get(hh.id).tiles[args.what];
    if (named >= 0) return named;
    return args.what === 'field'
      ? pickField(st, st.farmsteads[hh.farmstead], hh)
      : pickMeadow(st, st.farmsteads[hh.farmstead], hh);
  }
  // ---- the head's plan (VB-253; design.md section 7, The player as head; section 15, Parity of command): household `target`'s head
  // chooses, the player in it (source 'player') or its own rule (source 'pawn'; the actor {household} for a household with no holder), and
  // the same check binds both. A target or the hold on projects lasts until cleared, a tile until it is used, an order until the season's
  // plan is made again ----
  // target({store, n}): the plan's target of `store` becomes n, within its bounds (sim/plans' targetBounds: hay 0 to 3 winters, fields 0
  // to what the hands can till, wood 0 to twice the winter's goal, cow 0 or 1); n null clears it, and the holder's rule sets it again
  register('target', {
    check: (st, c) =>
      heads(st, c) ||
      (!c.args || c.args.n === undefined
        ? 'a target names n, or null to clear it'
        : targetWhy(st, c.target, c.args.store, c.args.n)),
    run: (st, c) => setTarget(st, c.target, c.args.store, c.args.n),
  });
  // tile({what, tile}): the tile of the next field or meadow (what) becomes `tile`, under the checks of the holder's own choice (sim/fields'
  // fieldWhy, sim/meadows' meadowWhy: claims, reach, the farm's block); tile null or -1 clears it
  register('tile', {
    check: (st, c) => {
      const why = heads(st, c) || farmOf(st, c) || landWhat(c.args && c.args.what);
      if (why || c.args.tile === null || c.args.tile === -1) return why;
      const hh = st.households[c.target];
      return c.args.what === 'field'
        ? fieldWhy(st, st.farmsteads[hh.farmstead], hh, c.args.tile)
        : meadowWhy(st, st.farmsteads[hh.farmstead], hh, c.args.tile);
    },
    run: (st, c) => nameTile(st, c.target, c.args.what, c.args.tile === null ? -1 : c.args.tile),
  });
  // order({steps}): the season's routines in this order (the seasonal plan's, each once), until the next season's plan
  register('order', {
    check: (st, c) => heads(st, c) || orderWhy(st, c.target, c.args && c.args.steps),
    run: (st, c) => setOrder(st, c.target, c.args.steps),
  });
  // project({what, tile}): begin a new field or meadow (what) now, on `tile`, else the tile the plan names, else the holder's own pick;
  // refused while a project is under way, and under the tile's checks. The land step is the holder's rule for it (sim/plans, source
  // 'pawn'). what 'none': the head holds off projects (its rule begins none: the land step, the boat, the tar pit); null clears that.
  // VB-255's menu of projects adds its own whats.
  register('project', {
    check: (st, c) => {
      const what = c.args && c.args.what,
        why = heads(st, c);
      if (why || what === 'none' || what === null) return why;
      const bad = farmOf(st, c) || landWhat(what);
      if (bad) return bad;
      const hh = st.households[c.target],
        tile = landTile(st, hh, c.args);
      return tile < 0 ? `no tile within reach can be taken in for a ${what}` : landWhy(st, hh, what, tile);
    },
    run: (st, c) => {
      const what = c.args.what;
      if (what === 'none' || what === null) holdProject(st, c.target, what === 'none');
      else beginLand(st, st.households[c.target], what, landTile(st, st.households[c.target], c.args));
    },
  });
  // dropProject({id, hold}): give up the household's project under way (args.id, the plan's id, when given: a field, a meadow, a boat,
  // a tar pit, ...), and with hold, hold off projects as project 'none' does
  register('dropProject', {
    check: (st, c) => {
      const why = heads(st, c);
      if (why) return why;
      const p = Projects.projectOf(st, 'household', c.target);
      return !p
        ? `household ${c.target} has no project under way`
        : c.args && c.args.id !== undefined && c.args.id !== p.id
          ? `household ${c.target} has no project ${c.args.id} under way`
          : null;
    },
    run: (st, c) => {
      giveUp(st, st.households[c.target], Projects.projectOf(st, 'household', c.target));
      if (c.args && c.args.hold) holdProject(st, c.target, true);
    },
  });
  // rotation({rotation, hold, short}): the household's farm takes the rotation, any of the rules it has seed for, its fields staggered
  // anew (VB-355; sim/fields' takeRotation, its checks rotationWhy: the seed of every crop of it, and no field under a crop it has
  // not). hold: the head keeps it against the village's usual one; rotation null gives the choosing back to its rule, which reaches
  // this verb with source 'pawn' (sim/plans; short: the crop whose seed ran out, when it falls back).
  register('rotation', {
    check: (st, c) => {
      const why = heads(st, c) || farmOf(st, c);
      if (why || !c.args || !('rotation' in c.args)) return why || 'a rotation is named';
      const hh = st.households[c.target];
      return rotationWhy(st, st.farmsteads[hh.farmstead], hh, c.args.rotation);
    },
    run: (st, c) => {
      const hh = st.households[c.target];
      takeRotation(st, st.farmsteads[hh.farmstead], hh, c.args.rotation, c.args);
    },
  });
  // sowOutOfTurn({tile, crop}): the field on `tile` bears `crop` this year in place of its course, and then goes on in its rotation
  // (VB-355; sim/fields' outOfTurn, its checks turnWhy: the field free, the crop's window open, a field's seed of it in the store).
  // crop 'fallow' rests it a year; the field's own course puts it back to its turn.
  register('sowOutOfTurn', {
    check: (st, c) => {
      const why = heads(st, c) || farmOf(st, c);
      if (why) return why;
      const hh = st.households[c.target],
        a = c.args || {};
      return turnWhy(st, st.farmsteads[hh.farmstead], hh, a.tile, a.crop, cal(st.t));
    },
    run: (st, c) => outOfTurn(st, st.farmsteads[st.households[c.target].farmstead], c.args.tile, c.args.crop),
  });
  // routines({routines, by}): the village's routines this year (VB-257) become args.routines, set by the meeting's decision (by
  // 'meeting') or, when it did not decide, by its culture's practice (by 'nothing' or 'asLastYear'; sim/lifecycle)
  register('routines', {
    check: (st, c) =>
      settlement(st, c) ||
      (!st.plans.villages.has(c.actor.settlement)
        ? `village ${c.actor.settlement} has no plan`
        : !(c.args && ['meeting', 'nothing', 'asLastYear'].includes(c.args.by))
          ? `routines cannot be set by ${c.args && c.args.by}`
          : routinesWhy(c.args.routines)),
    run: (st, c) => setRoutines(st, c.actor.settlement, c.args.routines, c.args.by),
  });
  return {
    heads,
    reviewHour,
    makePlan,
    dropPlan,
    planOf,
    seasonOf,
    seedPlans,
    startHeads,
    fillPlans,
    reviewed,
    landStep,
    targetWhy,
    setTarget,
    nameTile,
    orderWhy,
    setOrder,
    holdProject,
    landWhy,
    beginLand,
    giveUp,
    headView,
    reviewWhy,
    mayLook,
    closing,
    cadence,
    headSkill,
    horizonOf,
    WINDOWED,
    dueNow,
    again,
    ROUTINES,
    cultureOf,
    VILLAGE_ROUTINES,
    MAX_ROUTINES,
    rankRoutines,
    chooseRoutines,
    routinesWhy,
    setRoutines,
    routineAsks,
    projectOf,
    projectsOf,
    openOf: Projects.openOf,
    makeProject,
    advance,
    drop: dropProject,
    review,
    dropAll,
    impossible,
  }; // VB-123's project plans
})();
