// @sys sim/meadows: hay meadows as built land: a tile's worth as meadow, choosing one, the meadow project (a project plan of
// sim/plans), and the meadows of generated farms
VB['sim/meadows'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { B } = VB['world/biomes'];
  const { SEASON_DAYS, TRAVEL, HERD, BUILD, cal } = VB['sim/rules'],
    { dayLoss } = VB['sim/goods'],
    { byRiver } = VB['sim/crops'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'],
    { costChanged } = VB['sim/routes'];
  const { log, atFarm, atHousehold, age } = VB['sim/records'];
  const { factor } = VB['sim/weather'];
  const { setOwner } = VB['sim/ownership'];
  const { nextTo, farmedLand } = VB['sim/layout'];
  const { HAND_REACH } = VB['sim/byhand'];
  const { hexSteps } = VB['sim/hex'];
  const { winterNeed } = VB['sim/herds'];
  const { builtTiles } = VB['sim/fieldplans'],
    { onField } = VB['sim/fieldwork'];
  const { workStake } = VB['sim/claims'];
  const { freeFor, woodTaken } = VB['sim/territory'];
  const { stake, realiseStake, contestable, contest } = VB['sim/stakes'];
  const Stores = VB['sim/stores'];
  const Projects = VB['sim/projects'],
    { onProject, landProject } = Projects,
    { emit } = VB['sim/events'];
  const { seedPer } = VB['sim/hunger'];
  const { scrubHours, clearScrub } = VB['sim/spread'];
  // A meadow tile yields HAY × its site value a year in an ordinary year (VB-132): open meadow 1, marsh 0.8, heath 0.6, and 1.3 times that on
  // wet ground by a river or open water. A household with animals wants meadows for WANT × its winter's need, at most MAX; it looks for them
  // within REACH walking steps. Clearing takes CLEAR_HOURS and up to STONE_HOURS for the stones, down to KEEP_STONES of 255.
  const HAY = 30,
    WANT = 1.2,
    MAX = 6,
    START_MAX = 4,
    REACH = 6,
    CLEAR_HOURS = 4,
    STONE_HOURS = 10,
    KEEP_STONES = 80,
    STONES_PER_LOAD = 25;
  const SITE = { [B.MEADOW]: 1, [B.MARSH]: 0.8, [B.HEATH]: 0.6 };
  function wetBank(w, i) {
    if (byRiver(w, i)) return true;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k];
      if (j >= 0 && w.water[j]) return true;
    }
    return false;
  }
  const meadowFert = (w, i) => (SITE[w.biome[i]] || 0) * (wetBank(w, i) ? 1.3 : 1);
  // Hay a farm's meadows give in an ordinary year, before raking and weather.
  const expectedHay = (f) => f.meadows.reduce((s, m) => s + HAY * m.fert, 0);
  // Why tile t cannot be a meadow of farm f, beyond its reach (fixed words, so the search allocates nothing), or null: chooseMeadow's checks
  // (VB-253: the head's verb asks the same, meadowWhy).
  const meadowBar = (st, t, free, built, may) =>
    !SITE[st.w.biome[t]]
      ? 'only open meadow, marsh or heath makes a hay meadow'
      : st.w.river[t] || st.w.water[t]
        ? 'the tile is water'
        : !free(t)
          ? 'the land there is claimed'
          : st.used.has(t)
            ? 'the land there is in use'
            : built.has(t)
              ? 'a house or the green is there'
              : !may(t)
                ? "the land there is outside the farm's block"
                : null;
  // The best free tile for a hay meadow within REACH of the house, or -1: open meadow, marsh or heath, not a river or water tile, its
  // village's outland or wilderness (sim/territory) and unused, where farmed land may lie (sim/layout, farmedLand); by site value, near, few stones, beside the
  // farm's meadows, and away from its fields' block. `free`: whether the household may take a tile in (as for chooseTile, sim/fields).
  function chooseMeadow(st, f, free = (t) => freeFor(st, t, f.village), built = builtTiles(st)) {
    const w = st.w,
      own = new Set(f.meadows.map((m) => m.tile)),
      fields = new Set(f.fields.map((fd) => fd.tile));
    const may = farmedLand(w, st.villages, st.villages[f.village], f.house, st);
    let best = -1,
      bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, walkable(w)).dist) {
      if (d < 1 || meadowBar(st, t, free, built, may) !== null) continue;
      const s =
        meadowFert(w, t) -
        0.06 * d -
        (0.3 * w.stones[t]) / 255 +
        (nextTo(w, t, own) ? 0.3 : 0) -
        (nextTo(w, t, fields) ? 0.5 : 0);
      if (s > bs) {
        bs = s;
        best = t;
      }
    }
    return best;
  }
  const mayTake = (st, f, hh) => (t) => freeFor(st, t, f.village) || contestable(st, t, f.village, hh.id) !== null;
  // Why tile t cannot be the next hay meadow of household hh, whose farm is f, or null: chooseMeadow's checks, within REACH steps' walk of
  // the house, and fewer than MAX meadows. The check of the head's verb (sim/commands, VB-253).
  function meadowWhy(st, f, hh, t, built = builtTiles(st)) {
    if (!(Number.isInteger(t) && t >= 0 && t < st.w.N)) return `there is no tile ${t}`;
    if (f.meadows.length >= MAX) return `the farm has ${MAX} meadows, the most it keeps`;
    const d = bfs(st.w, f.house, REACH, walkable(st.w)).dist.get(t);
    if (d === undefined) return `the tile is not within ${REACH} steps' walk of the house`;
    if (d < 1) return 'the house stands there';
    return meadowBar(
      st,
      t,
      mayTake(st, f, hh),
      built,
      farmedLand(st.w, st.villages, st.villages[f.village], f.house, st),
    );
  }
  // The holder's own choice of its next meadow's tile: the best free tile, or with none, the best stake it may contest; -1 for none.
  function pickMeadow(st, f, hh, built = builtTiles(st)) {
    const tile = chooseMeadow(st, f, undefined, built);
    return tile >= 0 ? tile : chooseMeadow(st, f, (t) => contestable(st, t, f.village, hh.id) !== null, built);
  }
  const wantsMeadow = (st, f, hh) =>
    hh.herds.length > 0 && f.meadows.length < MAX && expectedHay(f) < WANT * winterNeed(st, hh);
  // A first meadow (VB-428): a household with no herd and no meadow yet, with the hands for a cow (HERD.want.hands working hands, as
  // sim/exchange's cowWanted counts them), makes one at its land step, so that the want of a cow (VB-390) can come true. Not at generation.
  function wantsFirstMeadow(st, f, hh) {
    if (hh.herds.length > 0 || f.meadows.length > 0) return false;
    let hands = 0;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = age(st, p);
      if (p.died === null && a >= 14 && a < 60 && !p.retired && ++hands >= HERD.want.hands) return true;
    }
    return false;
  }
  // The tile becomes the household's meadow: owned, in use, developed (no path wears on it, the settlement layer draws it).
  function addMeadow(st, f, hh, tile) {
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.meadows.push({
      id: f.meadows.length,
      tile,
      stage: 'grass',
      fert: meadowFert(st.w, tile),
      raked: false,
      mown: null,
      held: 0,
    });
    st.used.add(tile);
    woodTaken(st, tile); // a wood tile made a meadow leaves its village's wood (VB-326)
    if (!st.w.dev[tile]) costChanged(st, tile); // developed ground walks as open ground (sim/routes, tileCost)
    st.w.dev[tile] = 1;
    st.biomeDirty.add(tile);
  }
  // A household with animals and no land project, short of meadow for its herds' winter, stakes a tile and starts clearing it (sim/stakes);
  // with no free tile within reach, it may contest a stake another household of its village left unworked.
  // The land step of its standing plan (sim/plans, VB-248), after the field's: `given` a tile the plan names in place of chooseMeadow's (-1: none).
  // The project plan of a new meadow on `tile`, as sim/plans makes it (makeProject; VB-123): one step of clearing, under the household's
  // stake. It holds back a field's seed, as the seed reserve counted any land project before project plans (kept so the run is the same;
  // VB-123's notes).
  function meadowProject(st, hh, tile) {
    const hours =
      CLEAR_HOURS +
      (STONE_HOURS * Math.max(0, st.w.stones[tile] - KEEP_STONES)) / (255 - KEEP_STONES) +
      scrubHours(st, tile); // and the forest's scrub on it (VB-091)
    return {
      what: 'meadow',
      steps: [{ kind: 'meadow', place: tile, hours, stake: 'meadow' }],
      hold: { [Stores.grainGood('barley')]: seedPer(st, hh) },
    };
  }
  // The new meadow begun on `tile` (sim/plans' beginLand, the head's verb): a stake of another household contested first, nothing begun when
  // the contest is lost; else the tile staked. The project plan for sim/plans to make (meadowProject), or null.
  function beginMeadow(st, f, hh, tile) {
    if (!freeFor(st, tile, f.village) && !contest(st, f, hh, tile, 'meadow')) return null;
    stake(st, hh, tile, 'meadow');
    return meadowProject(st, hh, tile);
  }
  // Cleared: the worst stones go to the household's store, and the stake is its own land, a meadow from now on; the project is finished.
  // `plan` is the household's meadow plan whose step the job was (sim/projects' onProject).
  function finishMeadow(st, f, hh, plan) {
    const w = st.w,
      tile = plan.steps[plan.open].place,
      gone = Math.max(0, w.stones[tile] - KEEP_STONES);
    realiseStake(st, hh, tile);
    const loads = Math.round(gone / STONES_PER_LOAD);
    if (loads > 0) Stores.put(st, hh, 'stone/granite', loads, 'clear'); // VB-332: through the stores; cleared stone is granite (VB-733)
    w.stones[tile] -= gone;
    clearScrub(st, tile); // its scrub cleared too, and it is tended (VB-091)
    emit(st, 'stepDone', { type: 'household', id: f.household, plan }); // the project is finished (sim/plans)
    addMeadow(st, f, hh, tile);
    st.farmDirty.add(f.id);
    log(st, `${f.name} has made a new hay meadow.`, { kind: 'meadow', ...atFarm(f) });
  }
  // A hay meadow on this very tile, placed by hand (the archipelago editor) on a run just seeded: of the live household whose house is
  // nearest within HAND_REACH steps, with fewer than MAX meadows. False where the tile cannot be a meadow (as for chooseMeadow) or no such
  // farm is near enough.
  function meadowAt(st, tile, built = builtTiles(st)) {
    const w = st.w;
    if (
      !SITE[w.biome[tile]] ||
      w.river[tile] ||
      w.water[tile] ||
      st.used.has(tile) ||
      built.has(tile) ||
      !farmedLand(w, st.villages, null, tile)(tile)
    )
      return false;
    let f = null,
      fd = HAND_REACH + 1;
    for (const id of st.liveHouseholds) {
      const g = st.farmsteads[st.households[id].farmstead],
        d = hexSteps(w, g.house, tile);
      if (d < fd && g.meadows.length < MAX && freeFor(st, tile, g.village)) {
        fd = d;
        f = g;
      }
    }
    if (!f) return false;
    addMeadow(st, f, st.households[f.household], tile);
    return true;
  }
  // Generated farms (populous, heirs) have stood a while: each with animals has its meadows already, at most START_MAX.
  function placeMeadows(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead];
      while (f.meadows.length < START_MAX && wantsMeadow(st, f, hh)) {
        const tile = chooseMeadow(st, f);
        if (tile < 0) break;
        addMeadow(st, f, hh, tile);
      }
    }
  }
  // ---- haymaking (VB-133): rake in spring, mow from summer day 1 to autumn day 3, dry a day, carry to the barn ----
  // Raking (fagning) on spring days 1-10; a meadow not raked gives UNRAKED of its hay.
  const RAKE_DAYS = 10,
    UNRAKED = 0.8,
    MOW_LAST = 2,
    DRY_DAYS = 1;
  // Days into the haymaking window, or -1 outside it.
  const hayDay = (c) => (c.season === 1 ? c.sday : c.season === 2 && c.sday <= MOW_LAST ? SEASON_DAYS + c.sday : -1);
  // Hay is wanted while the barn and the hay lying mown hold less than the standing plan's target of winters' need (targets.hayWinters,
  // sim/plans) of the household's animals now, with what the stack loses before the winter (VB-1561: a target met early in the window was
  // fed and spoilt under it by the winter's first day): the stall days still to come before it (sim/byre, HERD.stall) and its spoilage until
  // then, as a stack at the target would spoil (sim/goods dayLoss; a barn's BUILD.barn.loss). A household with no animals mows nothing
  // (balance review: a farm whose herds were gone mowed 3,893 hay that nothing would eat).
  function hayWanted(st, f, hh) {
    const need = winterNeed(st, hh);
    if (!(need > 0)) return false;
    const target = st.plans.households.get(hh.id).targets.hayWinters * need;
    return (
      hh.hay + f.meadows.reduce((s, m) => s + (m.stage === 'mown' ? m.held : 0), 0) <
      target + hayLostToWinter(st, f, target, need)
    );
  }
  // What a stack of `target` hay loses from today to the winter's first day: the stall days before it, fed at the herds' daily hay (a
  // winter's need over its stall days), and its days of spoilage. In the winter itself nothing is reckoned.
  function hayLostToWinter(st, f, target, need) {
    const doy = cal(st.t).doy,
      winter = 3 * SEASON_DAYS;
    if (doy >= winter) return 0;
    const stall = Math.max(0, HERD.stall[1] - doy) + Math.max(0, winter - Math.max(doy, HERD.stall[0]));
    const spoil = dayLoss(st, 'hay', target, need) * (f.barn ? BUILD.barn.loss : 1);
    return (stall * need) / HERD.stallDays + (winter - doy) * spoil;
  }
  // The jobs a meadow posts now: [key, kind, extra]; refreshJobs posts them for the meadow's household. Raking and mowing only while hay is
  // wanted (`want`: a boolean, or a function asked only when a raking or mowing could be posted, VB-227); hay already mown is always carried in.
  function meadowJobs(f, m, c, want = true) {
    const out = [],
      rake = m.stage === 'grass' && !m.raked && c.season === 0 && c.sday < RAKE_DAYS,
      mow = m.stage === 'grass' && hayDay(c) >= 0;
    const hay = m.stage === 'mown' && c.day >= m.mown + DRY_DAYS;
    if (!rake && !mow && !hay) return out;
    const k = `f${f.id}.m${m.id}`,
      wanted = (rake || mow) && (typeof want === 'function' ? want() : want);
    if (wanted && rake) out.push(['rake:' + k, 'rake']);
    if (wanted && mow) out.push(['mow:' + k, 'mow']);
    if (hay) out.push(['hay:' + k, 'hay']);
    return out;
  }
  // Hay's reading of the seasons (VB-354; design.md, Crops and the weather), terms as a crop's row's (CROPS weather): a wet spring helps
  // it, a wet summer hurts it on the swathes.
  const HAY_WEATHER = [
    [0, 'r', 0.15],
    [1, 'wet', 0.15],
  ];
  // Mown: the meadow holds its year's hay, by site, its reading of the seasons and raking.
  function mowDone(st, m, c) {
    m.stage = 'mown';
    m.mown = c.day;
    m.held = Math.round(
      HAY * m.fert * factor(st, HAY_WEATHER) * (m.raked ? 1 : UNRAKED) * (0.9 + rnd(st.rng.fields) * 0.2),
    );
  }
  // Carried home: the hay goes into the household's barn; once the farm's last meadow is in, the log says how it stands for the winter.
  // Hay is carried by the load (sim/carts): what a pawn takes of the meadow's lying hay, as a load in rations (TRAVEL.hay units of hay a
  // ration: `cap` is the back's or a cart's); the meadow is aftermath once its last hay is taken.
  function hayLoad(m, cap) {
    const take = Math.min(m.held, cap * TRAVEL.hay, TRAVEL.hayCart);
    m.held -= take;
    if (m.held <= 1e-9) {
      m.held = 0;
      m.stage = 'aftermath';
    }
    return take / TRAVEL.hay;
  }
  // A load of hay set down by a carrier released on the road (VB-581) lies in the mown meadow for the next hand.
  function hayLaid(m, n) {
    m.held += n * TRAVEL.hay;
    m.stage = 'mown';
  }
  // A load of hay is in the barn; with the farm's last one, the log tells how the hay stands against the winter.
  function hayIn(st, m, hh, f, a) {
    hh.hay += a.load * TRAVEL.hay;
    if (
      f.meadows.some((q) => q.stage !== 'aftermath') ||
      hh.members.some(
        (id) =>
          id !== a.id && st.agents[id].load > 0 && st.agents[id].phase === 'back' && st.agents[id].carry === 'hay',
      )
    )
      return;
    const need = winterNeed(st, hh),
      short = need > hh.hay;
    log(
      st,
      `${f.name} has its hay in: ${Math.round(hh.hay)} for a winter's need of ${Math.round(need)}${short ? '; it is short' : ''}.`,
      {
        kind: 'hay',
        n: Math.round(hh.hay),
        ...atHousehold(st, hh),
      },
    );
  }
  // At the year's start (sim/clock, CALENDAR: meadowsSpring): the meadows are grass again.
  function meadowsSpring(st) {
    for (const f of st.farmsteads)
      for (const m of f.meadows) {
        m.stage = 'grass';
        m.raked = false;
        m.mown = null;
        m.held = 0;
      }
  }
  // At the autumn frost, the year's frost day (sim/weather frostDay; sim/clock, CALENDAR: meadowsFrost): hay still lying rots.
  function meadowsFrost(st) {
    for (const f of st.farmsteads)
      for (const m of f.meadows) {
        if (m.stage !== 'mown') continue;
        m.stage = 'aftermath';
        m.held = 0;
        if (f.household !== null)
          log(st, `Hay left lying at ${f.name} has rotted.`, { kind: 'hayRotted', ...atFarm(f) });
      }
  }
  // A meadow is raked in early spring and mown in the haymaking window while the household wants hay; its hay is carried in once dry
  // (sim/meadows). Asked at the farm: whether hay is wanted is the household's, once for all its meadows.
  function meadowWork(st, hh, f, c, post) {
    // whether hay is wanted, asked once, and only when a meadow could be raked or mown now (VB-227)
    let hayW = null;
    const want = () => (hayW === null ? (hayW = hayWanted(st, f, hh)) : hayW);
    for (const m of f.meadows)
      for (const [key, kind] of meadowJobs(f, m, c, want)) post(key, m.tile, { meadow: m, farm: f }, kind);
  }
  // The job kinds (sim/kinds joins them into KINDS; a kind's fields are described there).
  const KINDS = {
    meadow: {
      verb: 'Clearing a hay meadow',
      go: 'Going to clear a meadow',
      name: 'Clear a hay meadow',
      at: ['land'],
      needs: [],
      gives: ['meadow', 'stone'],
      label: 'Meadow',
      anim: 'hoe',
      hours: 4,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      project: true,
      worked: workStake,
      done: (st, j, hh) => {
        const plan = onProject(st, j);
        if (plan) finishMeadow(st, j.farm, hh, plan);
      },
      available: landProject,
    },
    rake: {
      verb: 'Raking the meadow clean',
      go: 'Going to rake a meadow',
      name: 'Rake a meadow',
      at: ['meadow'],
      needs: [],
      gives: [],
      label: 'Raking',
      anim: 'gather',
      hours: 2,
      hands: Infinity,
      type: 'harvest',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => U.rake,
      done: (st, j) => {
        j.meadow.raked = true;
      },
      available: meadowWork,
    },
    mow: {
      verb: 'Mowing hay',
      go: 'Going to mow a meadow',
      name: 'Mow a meadow',
      at: ['meadow'],
      needs: [],
      gives: ['hay'],
      label: 'Mowing',
      anim: 'mow',
      hours: 16,
      hands: Infinity,
      type: 'harvest',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => U.mow + Math.max(0, hayDay(c)) / U.mowPerDay,
      done: (st, j, hh, c) => mowDone(st, j.meadow, c),
      available: meadowWork,
    },
    hay: {
      verb: 'Gathering the hay',
      go: 'Going for the hay',
      back: 'Carrying hay to the barn',
      name: 'Bring in hay',
      at: ['meadow'],
      needs: ['hay'],
      gives: ['hay'],
      label: 'Hauling hay',
      anim: 'gather',
      hours: 1.5,
      hands: Infinity,
      type: 'harvest',
      carry: 'hay',
      to: 'barn',
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6],
      urgency: (st, j, c, U) => U.haul,
      deliver: (st, j, hh, f, a) => hayIn(st, j.meadow, hh, f, a),
      available: meadowWork, // by the load (sim/carts)
    },
  };
  return {
    KINDS,
    MOW_LAST, // the haymaking window's last autumn day (sim/agenda's deadline, VB-1616)
    DRY_DAYS, // the days mown hay dries before it is carried (sim/playerplan's hay task, VB-1622)
    meadowWork,
    HAY,
    UNRAKED,
    hayWanted,
    hayLostToWinter,
    hayLoad,
    hayLaid,
    meadowsSpring,
    meadowsFrost,
    meadowFert,
    expectedHay,
    chooseMeadow,
    meadowWhy,
    pickMeadow,
    beginMeadow,
    wantsMeadow,
    wantsFirstMeadow,
    addMeadow,
    meadowProject,
    placeMeadows,
    meadowAt,
  };
})();
