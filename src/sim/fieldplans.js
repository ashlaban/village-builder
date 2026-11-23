// @sys sim/fieldplans: field demand, site selection, clearing projects and the head's harvest estimate
VB['sim/fieldplans'] = (() => {
  const { B } = VB['gen'];
  const { ECON, FIELDS, cal, YEAR_DAYS } = VB['sim/rules'],
    { CROPS, ROTATIONS, GROUND, farmable, fertility } = VB['sim/crops'],
    { groundKey } = VB['sim/fieldrec'];
  const { rotationOf, courseFor } = VB['sim/rotations'];
  const { age } = VB['sim/records'];
  const { team } = VB['sim/herds'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'];
  const { nextTo, farmedLand, FIELD_NEAR } = VB['sim/layout'];
  const { freeFor } = VB['sim/territory'];
  const { stake, contest, contestable } = VB['sim/stakes'];
  const Projects = VB['sim/projects'],
    Stores = VB['sim/stores'];
  const { scrubHours } = VB['sim/spread'];
  const { seedPer } = VB['sim/hunger'];
  const { trusted } = VB['sim/yields'];
  const REACH = 4,
    SCRUB_HOURS = 10,
    STONE_HOURS = 20,
    BREAK_HOURS = 30;
  // Rations a household eats in a full year of 48 days.
  function yearlyRations(st, hh) {
    let n = 0;
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died === null) n += age(st, p) >= 14 ? ECON.ration.adult : ECON.ration.child;
    }
    return n * YEAR_DAYS;
  }
  // Fields its hands can till: perHand for each working adult (the plan's target, from its culture's template, sim/plans; FIELDS.perHand
  // before the household has a plan), and more with a team of oxen.
  function handsOf(st, hh) {
    let hands = 0;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = age(st, p);
      if (p.died === null && a >= 14 && a < 60 && !p.retired) hands++;
    }
    return hands;
  }
  function fieldsWorkable(st, hh, perHand = FIELDS.perHand) {
    const hands = handsOf(st, hh);
    return Math.floor(hands * perHand + (team(st, hh) ? FIELDS.oxenHands : 0));
  }
  // Fields a household wants: sown fields enough for its food (FIELDS.want of its rations at FIELDS.expect of the full yield, net of the
  // seed a field takes back, VB-389; its rotation's sown courses by their mean, VB-350), times the head's `bias` (sim/plans, VB-485), as
  // many as its hands can till; and its rotation's fallow courses on top, in their share of its courses (VB-350; design.md, The rotation,
  // Fallow and the hands: two courses, as many again; three, half as many again).
  // The food the fields must grow is the year's rations less what the head trusts its other sources to bring (sim/yields' trusted, VB-768:
  // its animals, nets, hunting and gathering, days of work and gifts, by its own memory and caution); none when they cover it, else at
  // least 1 sown field. `others` false leaves them out (the fields it would want on its fields alone: the cap on letting fields go).
  // `workable`: fieldsWorkable(st, hh), when the caller has it (the plan's review writes both, sim/plans).
  function fieldsWanted(st, hh, workable = fieldsWorkable(st, hh), bias = 1, others = true) {
    const R = ROTATIONS[rotationOf(st, hh)].courses;
    let net = 0,
      n = 0;
    for (const k of R)
      if (!CROPS[k].fallow) {
        net += FIELDS.expect * CROPS[k].yield - CROPS[k].seed;
        n++;
      }
    const need = FIELDS.want * yearlyRations(st, hh) - (others ? trusted(st, hh).total : 0),
      food = need > 0 ? Math.max(1, Math.ceil(need / (net / n))) : 0,
      sown = food ? Math.max(1, Math.min(workable, bias === 1 ? food : Math.round(food * bias))) : 0;
    return n < R.length ? Math.ceil((sown * R.length) / n) : sown;
  }
  // ---- fields let go (VB-768; design.md, Fields a household wants) ----
  const IDLE = new Set(['stubble', 'fallow', 'scrub']);
  // Why field fd of farm f cannot be let go now, or null: it bears no crop and no sheaves (stubble, fallow or scrub, nothing held), and no
  // job of its household stands on it (VB.count.letGoJobs), so letting it go touches no work and no store.
  function letGoWhy(st, f, fd) {
    if (!f.fields.includes(fd)) return `field ${fd.id} is not a field of ${f.name}`;
    if (!IDLE.has(fd.stage) || fd.held > 0)
      return `the field is ${fd.stage}: only a field with no crop and no sheaves is let go`;
    const mine = st.jobsBy.get(`household:${f.household}`);
    if (mine)
      for (const j of mine) {
        VB.count.letGoJobs++;
        if (j.field === fd) return 'a task stands on the field';
      }
    return null;
  }
  // The fields the household would want on its fields alone, by its head's bias (fieldsWanted with others false).
  const alone = (st, plan, hh) =>
    fieldsWanted(st, hh, plan.targets.workable, plan.head ? plan.head.bias.fields : 1, false);
  // Whether the head counts on its other sources for a field's food or more (its target under the fields it would want on its fields
  // alone): its ambition then breaks no field beyond the target (sim/aims), which it would let go again.
  const freesFields = (st, plan, hh) => alone(st, plan, hh) > plan.targets.fields;
  // The field the head lets go this year, or null (at its planning day after the harvest, sim/plans): only the fields its other sources
  // free, those it would want on its fields alone (fieldsWanted with others false; so a household shrunk by a death or a marriage keeps
  // its fields, as before), over those it wants now; none while its head has chosen its fields (the head's own target governs, VB-253), and
  // at most FIELDS.letGo a year. Of the idle fields, the poorest (fertility by soil), the last made first on a tie.
  function fieldToLetGo(st, plan, f, hh, c) {
    const T = plan.targets,
      L = f.left;
    if (plan.chosen && plan.chosen.fields !== null && plan.chosen.fields !== undefined) return null;
    if (L && L.year === c.year && L.inYear >= FIELDS.letGo) return null;
    if (Math.min(f.fields.length, alone(st, plan, hh)) - T.fields <= FIELDS.slack) return null;
    let best = null;
    for (const fd of f.fields)
      if (letGoWhy(st, f, fd) === null && (!best || fd.fert * fd.soil <= best.fert * best.soil)) best = fd;
    return best;
  }
  // Hours of clearing a tile: brush, plus its ground (GROUND.clear), the stones in proportion and the scrub grown on it (sim/spread, VB-091).
  const clearHours = (st, tile) =>
    SCRUB_HOURS +
    (GROUND[st.w.biome[tile]]?.clear ?? 0) +
    (STONE_HOURS * st.w.stones[tile]) / 255 +
    scrubHours(st, tile);
  // Houses and greens, standing or planned (a plot's house): no field is made next to one (VB-113).
  function builtTiles(st) {
    const out = new Set(st.villages.map((v) => v.center));
    for (const f of st.farmsteads) out.add(f.house);
    for (const v of st.villages) {
      // plots built, and under way (their village's project plans, VB-123)
      for (const p of v.plots || []) for (const tr of p.tiles) if (tr.kind === 'house') out.add(tr.tile);
      for (const p of Projects.projectsOf(st, 'village', v.id))
        if (p.what === 'plot') for (const tr of p.steps[0].places) if (tr.kind === 'house') out.add(tr.tile);
    }
    // and the plots households clear for their heirs (VB-255)
    if (st.plans && st.plans.projects)
      for (const p of st.plans.projects.heirPlots)
        for (const tr of p.steps[0].places) if (tr.kind === 'house') out.add(tr.tile);
    return out;
  }
  // Why tile t cannot be a field of farm f, beyond its reach (one of a few fixed words, so the search allocates nothing), or null:
  // farmable, `free` (the household may take it in), no house or green on or planned for it (`built`), not in use, and where farmed land
  // may lie (`may`, sim/layout's farmedLand). The one list of checks of chooseTile's search and of the head's verb (fieldWhy; VB-253).
  const fieldBar = (st, t, free, built, may) =>
    !farmable(st.w, t)
      ? 'the land there cannot be tilled'
      : !free(t)
        ? 'the land there is claimed'
        : built.has(t)
          ? 'a house or the green is there'
          : st.used.has(t)
            ? 'the land there is in use'
            : !may(t)
              ? "the land there is outside the farm's block"
              : null;
  // The best farmable tile within reach of the house that the household may take in (its village's outland or wilderness, sim/territory),
  // not on a river, and where farmed land may lie (sim/layout, farmedLand: beside a house, but off the ring round a green and no nearer
  // the green than the house): fertile (watered by one), few stones, near, and 1 better when it touches one of the
  // farm's fields, so the fields grow as one block (VB-109). Open meadow always comes first; heath, hills or marsh (poorer, by GROUND)
  // only when no meadow is free (balance review: where land ran short, poorer land was taken in). -1 when there is none. `free`: whether the
  // household may take a tile in (a stake it may contest, for sim/stakes).
  // `built`: builtTiles(st), when the caller has it (the review asks every farm in one hour, VB-227).
  function chooseTile(st, f, free = (t) => freeFor(st, t, f.village), built = builtTiles(st)) {
    const w = st.w,
      own = new Set(f.fields.map((fd) => fd.tile)),
      may = farmedLand(w, st.villages, st.villages[f.village], f.house, st);
    let best = -1,
      bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, walkable(w)).dist) {
      if (d < 1 || fieldBar(st, t, free, built, may) !== null) continue;
      const s =
        fertility(w, t) -
        (0.5 * w.stones[t]) / 255 -
        FIELD_NEAR * d +
        (nextTo(w, t, own) ? 1 : 0) -
        (w.biome[t] === B.MEADOW ? 0 : 2);
      if (s > bs) {
        bs = s;
        best = t;
      }
    }
    return best;
  }
  // May household hh, whose farm is f, take tile t in: free, or a stake of its village left unworked that it may contest (sim/stakes).
  const mayTake = (st, f, hh) => (t) => freeFor(st, t, f.village) || contestable(st, t, f.village, hh.id) !== null;
  // Why tile t cannot be the next field of household hh, whose farm is f, or null: the checks of chooseTile (fieldBar), and within REACH
  // steps' walk of the house. The check of the head's verb, the player's and the holder's alike (sim/commands, VB-253).
  function fieldWhy(st, f, hh, t, built = builtTiles(st)) {
    if (!(Number.isInteger(t) && t >= 0 && t < st.w.N)) return `there is no tile ${t}`;
    const d = bfs(st.w, f.house, REACH, walkable(st.w)).dist.get(t);
    if (d === undefined) return `the tile is not within ${REACH} steps' walk of the house`;
    if (d < 1) return 'the house stands there';
    return fieldBar(
      st,
      t,
      mayTake(st, f, hh),
      built,
      farmedLand(st.w, st.villages, st.villages[f.village], f.house, st),
    );
  }
  // The holder's own choice of its next field's tile (VB-248's land step): the best free tile, or with none, the best stake it may contest;
  // -1 for none.
  function pickField(st, f, hh, built = builtTiles(st)) {
    const tile = chooseTile(st, f, undefined, built);
    return tile >= 0 ? tile : chooseTile(st, f, (t) => contestable(st, t, f.village, hh.id) !== null, built);
  }
  // The project plan of a new field on `tile`, as sim/plans makes it (makeProject; VB-123): clearing, then breaking, both under the
  // household's stake; it holds back the seed the field will want (released when the field is made, when the standing plan's seed counts it).
  const fieldProject = (st, hh, tile) => ({
    what: 'field',
    ground: groundKey(st.w, tile), // the biome it has now, before the clearing (VB-1490)
    steps: [
      { kind: 'clear', place: tile, hours: clearHours(st, tile), stake: 'field' },
      { kind: 'break', place: tile, hours: BREAK_HOURS, stake: 'field' },
    ],
    hold: newFieldSeed(st, hh),
  });
  // The seed a new field of hh's farm holds back: that of the course placeField would give it now (VB-999), read at the project's start; a
  // field to lie fallow holds none. Barley's is the household's seed a field (seedPer), another crop's its rule's.
  function newFieldSeed(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
      { key, i } = courseFor(st, f ? f.fields : [], hh),
      crop = ROTATIONS[key].courses[i];
    if (CROPS[crop].fallow) return {};
    return { [Stores.grainGood(crop)]: crop === 'barley' ? seedPer(st, hh) : CROPS[crop].seed };
  }
  // The new field begun on `tile` (sim/plans' beginLand, the head's verb): a stake of another household is contested first (sim/stakes),
  // and nothing is begun when the contest is lost; else the tile is staked. Returns the project plan for sim/plans to make (fieldProject),
  // or null.
  function beginField(st, f, hh, tile) {
    if (!freeFor(st, tile, f.village) && !contest(st, f, hh, tile, 'field')) return null;
    stake(st, hh, tile, 'field');
    return fieldProject(st, hh, tile);
  }
  // The head's estimate (principle 14: the head's own reckoning, by the hands it counts, not the simulation's knowledge) of the harvest
  // before the frost, for household hh in autumn: {fields (ripe, to reap), days (of work they ask of its hands, HARVEST_DAY hours a hand a
  // day), left (days to the frost), late (the work asks more than the days left)}, or null out of autumn or with nothing ripe.
  const HARVEST_DAY = 8;
  function harvestEstimate(st, hh) {
    const c = cal(st.t);
    if (c.season !== 2 || hh.farmstead === null || hh.farmstead === undefined) return null;
    let n = 0,
      hours = 0;
    for (const fd of st.farmsteads[hh.farmstead].fields)
      if (fd.stage === 'ripe') {
        n++;
        hours += CROPS[fd.crop].hours.reap;
      }
    if (!n) return null;
    const hands = handsOf(st, hh),
      days = hands ? Math.ceil(hours / (hands * HARVEST_DAY)) : Infinity,
      left = Math.max(0, VB['sim/weather'].frostDay(st) - c.sday);
    return { fields: n, days, left, late: days > left, hands };
  }
  return {
    yearlyRations,
    fieldsWorkable,
    fieldsWanted,
    clearHours,
    BREAK_HOURS,
    builtTiles,
    fieldWhy,
    pickField,
    chooseTile,
    beginField,
    fieldProject,
    newFieldSeed,
    harvestEstimate,
    letGoWhy,
    fieldToLetGo,
    freesFields,
  };
})();
