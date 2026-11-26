// @sys sim/plans: holders' standing plans (design.md section 7; VB-258, VB-248, VB-253): a standing plan per live household and village,
// made, reviewed (its seasonal plan and targets, sim/seasonal; its rotation and sowing; its land step; the seed it holds back; a
// village's routines' steps, sim/routines) and dropped; and the head's choices of its plan, each through a verb of sim/commands
VB['sim/plans'] = (() => {
  const { rotationWhy, turnWhy, swapWhy, fieldsChoice } = VB['sim/rotations'],
    { takeRotation, outOfTurn, swapSteps } = VB['sim/courses'];
  const { living, home } = VB['sim/records'];
  const { TICKS, HERD, cal } = VB['sim/rules'],
    { ROTATIONS } = VB['sim/crops'];
  const Stores = VB['sim/stores'],
    SEED_CROP = 'barley',
    SEED = Stores.grainGood(SEED_CROP), // the seed reserved: barley's, and each other crop's its rotation sows (VB-350)
    OTHER_CROPS = Stores.CROP_LIST.filter((k) => k !== SEED_CROP);
  const { seedNeed } = VB['sim/hunger'];
  const { rotationChoice } = VB['sim/rotations'];
  const { fieldsWanted, fieldWhy, pickField, beginField, letGoWhy, fieldToLetGo } = VB['sim/fieldplans'];
  const { letGo } = VB['sim/fields'];
  const { trusted } = VB['sim/yields'];
  const { makingOf } = VB['sim/makings'];
  const Projects = VB['sim/projects'],
    { projectsOf } = Projects,
    { emit } = VB['sim/events'],
    { makeProject, drop: dropProject, dropAll, dropWords } = VB['sim/projectplans'];
  const { meadowWhy, pickMeadow, beginMeadow, wantsMeadow, wantsFirstMeadow } = VB['sim/meadows'];
  const { issue, register } = VB['sim/commands'];
  const { reviewWant } = VB['sim/exchange'];
  const Targets = VB['sim/targets'];
  const { buildStep } = VB['sim/building'];
  const { founded, villageSteps } = VB['sim/routines'];
  const { reviewAfter, cadence, nextSlot, enqueue, dequeue } = VB['sim/plandays'];
  const Steps = VB['sim/steps'];
  const { seasonOf, seasonal, templateOf, cultureOf, headSkill, horizonOf, ORDER_LEAST } = VB['sim/seasonal'],
    { chosenTargets, goodTargets, begin, reviewTargets, dropSeason, setOrder } = VB['sim/seasonal'];
  // @state st.plans: {households: Map of household id to plan, villages: Map of village id to plan, seasons: Map of household id to its
  //   seasonal plan, due: the due-queue, projects and projectSeq: the project plans (sim/projects, VB-123)}; a standing plan is
  //   {holder: {type: 'household' | 'village', id}, kind: 'standing', nextReview (game hours: its next planning day's review), last (the day
  //   of its last review), woke (the day of its last review woken by a store), looked (the day a member last looked for work outside the
  //   plan's tasks), dirty (sim/stores: a store crossed a target since the last review), reserved, reasons (sim/stores' reservations)}, and a
  //   household's also {targets, tiles, counted}. One standing plan per undissolved household and per village; a dissolved household's plan
  //   is dropped with it, so the maps hold only live holders (Rules for cost, 1). Its review asks each kind where it is available for the
  //   holder (refreshJobs, sim/jobs) on the holder's planning day, and out of turn when a window closes or a store crosses a target.
  // @state plan.tiles: {field, meadow}: the tile the plan names for its next field or meadow in place of the holder's choice, -1 for none;
  //   named by the head's verb `tile` (VB-253), used once and cleared by the land step, or cleared there when it no longer passes.
  //   plan.counted: the year its herds were last counted for the cull (sim/byre), or null.
  // @state plan.chosen (a household's; VB-253): absent until its head first chooses through a verb (the player as head), then {hay (winters),
  //   fields, wood (loads), cow (0 or 1), goods ({[made good]: n}, VB-698; absent until one is chosen): the head's targets in place of the
  //   template's and the holder's rule's, each null for none;
  //   project: 'none' (no project of the household's is begun by its own rule until cleared) or null}. Each lasts until cleared.
  //   Written only by the head's verbs (setTarget, holdProject), applied by seasonal and reviewed; cow is read by sim/exchange.
  // @state plan.build (a household's; VB-332): its building step, {tile, kind 'pick' | 'quarry' | null} (where its stone comes from; -1 and
  //   null for nowhere in reach) while it means to raise its house onto stone, else null or absent; set at each review (sim/building's buildStep).
  const mapOf = (st, type) => (type === 'household' ? st.plans.households : st.plans.villages);
  // A household's targets, seasonal plan, tiles, cull record and reservation of seed, at its plan's making and at the load of a save
  // without them.
  function household(st, plan) {
    const hh = st.households[plan.holder.id];
    begin(st, plan, hh);
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
      reviewed: null,
    };
    Steps.record(plan, type, id); // its record of steps (VB-1752)
    mapOf(st, type).set(id, plan);
    for (const p of projectsOf(st, type, id)) Steps.link(st, p); // projects made before it (a settler's cottage)
    if (type === 'household') {
      const f = st.farmsteads[st.households[id].farmstead], // a cottage left on its farm (dropAll) is the new household's
        left =
          f &&
          f.booth &&
          projectsOf(st, 'village', f.village).find((p) => p.what === 'cottage' && p.farmstead === f.id);
      if (left) emit(st, 'projectHanded', { plan: left, type, id });
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
      dropSeason(st, id);
      dequeue(st, id);
    }
  }
  const planOf = (st, type, id) => mapOf(st, type).get(id);
  // The plans of every live holder, at seed, and at the load of a save made before plans (VB-258).
  function seedPlans(st) {
    st.plans = {
      households: new Map(),
      villages: new Map(),
      seasons: new Map(),
      pawns: new Map(),
      due: [],
      projects: Projects.emptyProjects(),
      projectSeq: 0,
      stepSeq: 0,
    };
    for (const id of st.liveHouseholds) makePlan(st, 'household', id);
    for (const v of st.villages) makePlan(st, 'village', v.id);
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
    plan.reviewed = hour;
    if (why === 'store') plan.woke = c.day;
    plan.dirty = false; // lint-allow: owner the review has read the stores whose crossing sim/stores flagged
    if (plan.holder.type !== 'household') {
      villageSteps(st, plan);
      return;
    }
    const hh = st.households[plan.holder.id],
      sp = seasonOf(st, hh.id);
    if (sp.year !== c.year || sp.season !== c.season) seasonal(st, plan, c);
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    const own = f && f.household === hh.id,
      H = plan.head ? { skill: headSkill(st, hh.id), pawn: plan.head.pawn } : null, // its foresight (VB-351)
      turn = own ? rotationChoice(st, f, hh, c, H) : null, // the rotation it holds (VB-350), by its rule
      actor = hh.holder === null ? { household: hh.id } : hh.holder;
    if (turn)
      issue(st, {
        actor,
        verb: 'rotation',
        target: hh.id,
        args: { rotation: turn.to, short: turn.short },
        source: 'pawn',
      }); // through the verb the played head has (VB-355)
    const act = own ? fieldsChoice(st, f, hh, c, H) : null; // what it sows where (VB-351)
    if (act) issue(st, { actor, verb: act.verb, target: hh.id, args: act.args, source: 'pawn' });
    reviewTargets(st, plan, hh, c);
    // a field its other sources free is let go, on its planning day after the harvest (VB-768), through the head's verb
    const gone = own && why === 'day' && c.season === 3 ? fieldToLetGo(st, plan, f, hh, c) : null;
    if (gone) issue(st, { actor, verb: 'letField', target: hh.id, args: { field: gone.id }, source: 'pawn' });
    if (c.doy >= HERD.countDay && plan.counted !== c.year && hh.herds.length) plan.counted = c.year;
    reserveSeed(st, hh, plan);
    reviewWant(st, plan, hh, why); // a cow wanted (VB-390): plan.want, sim/exchange's
    plan.build = buildStep(st, plan, hh); // the building step (VB-332): open while the house is to be raised onto stone, and where its stone comes from
    emit(st, 'planReviewed', { plan, c, why }); // the head's projects (sim/aims, VB-255), its supply outlook (sim/outlook, VB-666)
  }
  // The land step (at each review of a household's plan): a new field while the household has fewer than the plan's target, else a hay
  // meadow while it is short of one; none while its head holds off projects (VB-253; sim/projects' heldOff: also the played head with
  // automatic behaviour off, VB-1651). The tile is the one the plan names, while it still
  // passes the verb's check (cleared when it no longer does), else the holder's choice (pickField, pickMeadow); the field or meadow is
  // begun through the head's verb `project`, the holder's rule as the player's (source 'pawn'; VB-253). `built`: the houses and greens,
  // once for every farm's look (sim/fields, builtTiles).
  function landStep(st, plan, f, hh, built) {
    if (!Projects.heldOff(st, hh.id)) {
      // the head's prudence, its own choice and not a refusal (VB-1668): it begins a field or a meadow only with no large project under way
      if (!Projects.ownOf(st, hh.id) && f.fields.length < plan.targets.fields) landBy(st, plan, f, hh, 'field', built);
      if (!Projects.ownOf(st, hh.id) && (wantsMeadow(st, f, hh) || wantsFirstMeadow(st, f, hh)))
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
  // The tile of the next field or meadow (`what`) becomes `tile`, or none (-1): the land step takes it when the household wants one.
  function nameTile(st, id, what, tile) {
    st.plans.households.get(id).tiles[what] = tile;
  }
  // Why `steps` may not be the order of household id's routines this season, or null: the same routines as its seasonal plan's, each once.
  function orderWhy(st, id, steps) {
    const sp = st.plans.seasons.get(id);
    if (!sp) return `the household has no seasonal plan`;
    if (!Array.isArray(steps) || steps.length !== sp.steps.length || new Set(steps).size !== steps.length)
      return `the order must name each of the season's ${sp.steps.length} routines once`;
    for (const k of steps) if (!sp.steps.includes(k)) return `${k} is not a routine of the season`;
    return null;
  }
  // The head holds off projects (on true) or lets its rule take them again (false).
  function holdProject(st, id, on) {
    choices(st.plans.households.get(id)).project = on ? 'none' : null;
  }
  // Why household hh may not begin the land project `what` on `tile` now, or null: a farm of its own, no project of the household's at
  // the tile, and the tile's check (fieldWhy, meadowWhy: claims, reach, the farm's block). For every head, beside any other project
  // (VB-1651, VB-1668): whether a head begins one beside another is its own rule's (the land step).
  function landWhy(st, hh, what, tile) {
    if (what !== 'field' && what !== 'meadow') return `there is no land project ${what}`;
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || f.household !== hh.id) return `the household has no farm of its own`;
    for (const q of projectsOf(st, 'household', hh.id))
      if (q.steps.some((x) => x.place === tile)) return `a ${q.what} of the household's is under way at ${tile}`;
    return (what === 'field' ? fieldWhy : meadowWhy)(st, f, hh, tile);
  }
  // The new field or meadow begun on `tile` (sim/fields' beginField, sim/meadows' beginMeadow: staked, or a stake contested), its project
  // plan made (marked `side` by makeProject when begun beside another of its kinds, VB-1668); the plan's named tile used. Nothing is
  // begun when a contest is lost.
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
  // season's order and the project under way (the large one, ownOf; `projects` every large one, VB-1651, VB-1668: side by side, each
  // {id, what, step, tile}) and the small constructions beside it (VB-1414); the head's skill
  // and horizon; or null for a household with no plan. Plain data, a copy.
  function headView(st, id) {
    const plan = st.plans.households.get(id),
      sp = st.plans.seasons.get(id);
    if (!plan || !sp) return null;
    const T = plan.targets,
      C = plan.chosen || {},
      p = Projects.ownOf(st, id),
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
        // what the head counts on besides its fields, by source (VB-768: its own estimate, sim/yields' trusted), rations a year
        fields: { ...target('fields', T.fields, wanted), counts: hh.farmstead === null ? [] : countsOn(st, hh) },
        wood: target('wood', T.wood[c.season], M.wood[c.season]),
        cow: target('cow', plan.want ? 1 : 0, null),
      },
      goods: Targets.view(st, hh, C.goods, plan.placed && plan.placed.goods),
      head: plan.head
        ? { pawn: plan.head.pawn, skill, horizon: horizonOf(skill), keepsOrder: skill >= ORDER_LEAST }
        : null,
      tiles: { ...plan.tiles },
      order: [...sp.steps],
      orderBy: sp.by || 'template',
      project: p ? { id: p.id, what: p.what, step: p.steps[p.open].kind } : null,
      projects: Projects.projectsOf(st, 'household', id)
        .filter((q) => q.what !== 'cottage' && !q.small)
        .map((q) => ({ id: q.id, what: q.what, step: q.steps[q.open].kind, tile: q.steps[q.open].place })),
      small: Projects.projectsOf(st, 'household', id)
        .filter((q) => q.small)
        .map((q) => ({ id: q.id, what: q.what, step: q.steps[q.open].kind, tile: q.steps[q.open].place })),
      heldOff: C.project === 'none',
    };
  }
  // The rations a year the head counts on from each source besides its fields, the largest first, those of a ration or more (VB-768).
  function countsOn(st, hh) {
    const by = trusted(st, hh).by;
    return Object.keys(by)
      .filter((s) => by[s] >= 1)
      .sort((a, b) => by[b] - by[a])
      .map((source) => ({ source, rations: Math.round(by[source]) }));
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
          ? `pawn ${c.actor} is not the head of the household: only its head changes its plan`
          : null)
      );
    return c.actor && c.actor.household === id && hh.holder === null
      ? null
      : `only the head of the household changes its plan`;
  }
  const farmOf = (st, c) => {
    const hh = st.households[c.target];
    return hh.farmstead !== null && st.farmsteads[hh.farmstead].household === hh.id
      ? null
      : `the household has no farm of its own`;
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
  // project({what, tile, ...}): begin a new field or meadow (what) now, on `tile`, else the tile the plan names, else the holder's own pick;
  // beside any other project, one a tile (VB-1651, VB-1668), and under the tile's checks. The land step is the holder's rule for it (sim/plans, source
  // 'pawn'). what 'none': the head holds off projects (its rule begins none: the land step, its yearly look at a boat, a cart, a tar pit,
  // its menu); null clears that. Any other what is a making of sim/makings (VB-678: a boat, a cart, a tar pit, a barn, a farm for the heir
  // with args.heir), under that making's one check, the same for every head, played or not; its plan is made here.
  const making = (what) => makingOf(what) || `there is no project ${what}`;
  register('project', {
    check: (st, c) => {
      const what = c.args && c.args.what,
        why = heads(st, c);
      if (why || what === 'none' || what === null) return why;
      const bad = farmOf(st, c);
      if (bad) return bad;
      const hh = st.households[c.target];
      if (what !== 'field' && what !== 'meadow') {
        const M = making(what);
        return typeof M === 'string' ? M : M.why(st, hh, st.farmsteads[hh.farmstead], c.args);
      }
      const tile = landTile(st, hh, c.args);
      return tile < 0 ? `no tile within reach can be taken in for a ${what}` : landWhy(st, hh, what, tile);
    },
    run: (st, c) => {
      const what = c.args.what,
        hh = st.households[c.target];
      if (what === 'none' || what === null) holdProject(st, c.target, what === 'none');
      else if (what === 'field' || what === 'meadow') beginLand(st, hh, what, landTile(st, hh, c.args));
      else beginMaking(st, hh, makingOf(what), c.args);
    },
  });
  // letField({field}) (VB-768): the head lets field `field` (its id) of its farm go, its tile back to the village (sim/fields' letGo): a
  // field with no crop, sheaves or task on it (sim/fieldplans' letGoWhy); the same for every head, played or not.
  register('letField', {
    check: (st, c) => {
      const why = heads(st, c) || farmOf(st, c);
      if (why) return why;
      const f = st.farmsteads[st.households[c.target].farmstead],
        id = c.args && c.args.field,
        fd = f.fields.find((x) => x.id === id);
      return fd ? letGoWhy(st, f, fd) : `${f.name} has no field ${id}`;
    },
    run: (st, c) => {
      const f = st.farmsteads[st.households[c.target].farmstead];
      letGo(
        st,
        f,
        f.fields.find((x) => x.id === c.args.field),
        cal(st.t),
      );
    },
  });
  // A making begun (the verb project): the plan its module gives, made for the household (a small construction marked so), or begun by
  // its module itself (heirFarm's plot, sim/expansion).
  function beginMaking(st, hh, M, args) {
    const p = M.begin(st, hh, st.farmsteads[hh.farmstead], args);
    if (p) makeProject(st, 'household', hh.id, M.small ? { ...p, what: M.what, small: true } : { ...p, what: M.what });
  }
  // The household's project of its own choosing that the verb dropProject gives up: the one of id when given (a field, a meadow, a barn, a
  // boat, a cart, a tar pit...; never a settler household's cottage), else its large project (ownOf), else the first small one under way.
  function droppable(st, hid, id) {
    const mine = (p) => p.what !== 'cottage' && (id === undefined || p.id === id);
    return (
      (id === undefined && Projects.ownOf(st, hid)) || Projects.projectsOf(st, 'household', hid).find(mine) || null
    );
  }
  // dropProject({id, hold}): give up a project of the household's under way (args.id, the plan's id, when given: a field, a meadow, a boat,
  // a tar pit, ...; the others under way stand), and with hold, hold off projects as project 'none' does
  register('dropProject', {
    check: (st, c) => {
      const why = heads(st, c);
      if (why) return why;
      const id = c.args ? c.args.id : undefined;
      return droppable(st, c.target, id)
        ? null
        : id === undefined
          ? `the household has no project under way`
          : `the household has no project ${id} under way`;
    },
    run: (st, c) => {
      giveUp(st, st.households[c.target], droppable(st, c.target, c.args ? c.args.id : undefined));
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
  // courses({a, b}): the fields on tiles a and b exchange their courses (VB-351; sim/fields' swapSteps, its checks swapWhy: two free fields
  // of the farm at different steps), so that the worn field rests first and fresh land takes the crop
  register('courses', {
    check: (st, c) => {
      const why = heads(st, c) || farmOf(st, c);
      if (why) return why;
      const a = c.args || {};
      return swapWhy(st.farmsteads[st.households[c.target].farmstead], a.a, a.b);
    },
    run: (st, c) => swapSteps(st, st.farmsteads[st.households[c.target].farmstead], c.args.a, c.args.b),
  });
  return {
    heads,
    makePlan,
    dropPlan,
    planOf,
    seedPlans,
    reviewed,
    landStep,
    targetWhy,
    setTarget,
    nameTile,
    orderWhy,
    holdProject,
    landWhy,
    beginLand,
    giveUp,
    headView,
  };
})();
