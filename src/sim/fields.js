// @sys sim/fields: new fields (each a project plan of sim/plans), crop lifecycle and daily growth, weeding, frost and abandonment; rotations (a
//   field's courses, the holder's and the village's usual one, VB-350); soil and manure; tilth
VB['sim/fields'] = (() => {
  const { B } = VB['gen'];
  const { next: rnd } = VB['sim/rng'];
  const {
    ECON,
    CROPS,
    ROTATIONS,
    FIELDS,
    SOIL,
    TILTH,
    HERD,
    DEER,
    farmable,
    fertility,
    cal,
    DAY,
    SEASON_DAYS,
    YEAR_DAYS,
    YEAR,
  } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable, costChanged } = VB['sim/routes'];
  const { age, log, atFarm } = VB['sim/records'];
  const { nextTo, farmedLand, FIELD_NEAR } = VB['sim/layout'];
  const { freeFor, woodTaken } = VB['sim/territory'];
  const { stake, realiseStake, contestable, contest } = VB['sim/stakes'];
  const { team } = VB['sim/herds'];
  const Stores = VB['sim/stores'];
  const Projects = VB['sim/projects'],
    { emit } = VB['sim/events'];
  const { seedPer } = VB['sim/hunger'];
  const { scrubHours, clearScrub, tended, SPREAD } = VB['sim/spread'];
  const REACH = 4,
    SCRUB_HOURS = 10,
    STONE_HOURS = 20,
    BREAK_HOURS = 30,
    STONES_PER_LOAD = 25;
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
  // `workable`: fieldsWorkable(st, hh), when the caller has it (the plan's review writes both, sim/plans).
  function fieldsWanted(st, hh, workable = fieldsWorkable(st, hh), bias = 1) {
    const R = ROTATIONS[rotationOf(st, hh)].courses;
    let net = 0,
      n = 0;
    for (const k of R)
      if (!CROPS[k].fallow) {
        net += FIELDS.expect * CROPS[k].yield - CROPS[k].seed;
        n++;
      }
    const food = Math.max(1, Math.ceil((FIELDS.want * yearlyRations(st, hh)) / (net / n))),
      sown = Math.max(1, Math.min(workable, bias === 1 ? food : Math.round(food * bias)));
    return n < R.length ? Math.ceil((sown * R.length) / n) : sown;
  }
  // Hours of clearing a tile: brush, plus the stones in proportion, plus the scrub the forest has grown on it (sim/spread, VB-091).
  const clearHours = (st, tile) => SCRUB_HOURS + (STONE_HOURS * st.w.stones[tile]) / 255 + scrubHours(st, tile);
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
  // farm's fields, so the fields grow as one block (VB-109). Open meadow always comes first; heath, hills or marsh (poorer, by FERTILITY)
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
  // Clearing done: the stones go to the household's store, the tile is bare ground; the project's next step, breaking, opens.
  function finishClear(st, f, hh) {
    const tile = Projects.openOf(st, 'household', f.household).place;
    clearStones(st, tile, hh);
    emit(st, 'stepDone', { type: 'household', id: f.household }); // the project's next step opens (sim/plans)
  }
  // The stones cleared off `tile` go to household hh's heap (VB-332: through the stores; a common field's to the household of the one who
  // finished the clearing, VB-100), and the tile is bare ground.
  function clearStones(st, tile, hh) {
    const w = st.w,
      loads = Math.round(w.stones[tile] / STONES_PER_LOAD);
    if (loads > 0 && hh) Stores.put(st, hh, 'stone', loads, 'clear');
    w.stones[tile] = 0;
    clearScrub(st, tile); // its scrub too, and it is tended (VB-091)
    st.biomeDirty.add(tile);
  }
  // Breaking done: the stake is the household's own land, a field in stubble; on ground never farmed (w.dev 0) its soil starts fresh
  // (SOIL.fresh, VB-149). The project is finished.
  function finishBreak(st, f) {
    const tile = Projects.openOf(st, 'household', f.household).place;
    realiseStake(st, st.households[f.household], tile);
    const fd = broken(st, tile, f.fields.length);
    f.fields.push(fd);
    placeField(st, f, st.households[f.household], fd);
    emit(st, 'stepDone', { type: 'household', id: f.household }); // the project is finished (sim/plans)
    log(st, `${f.name} has broken a new field.`, { kind: 'field', ...atFarm(f) });
  }
  // A new field in stubble on `tile`, its ground broken: farmed land from now. A farm's (finishBreak) or a village's common field (VB-100,
  // sim/commons), whose holder adds it to its list.
  function broken(st, tile, id) {
    const w = st.w,
      fd = {
        id,
        tile,
        crop: 'barley',
        rotation: 'every',
        step: 0,
        stage: 'stubble',
        sown: null,
        reaped: null,
        held: 0,
        fert: fertility(w, tile),
        soil: w.dev[tile] ? SOIL.start : SOIL.fresh,
        tilth: 0,
        tilthAt: st.t,
        weedOpen: false,
        weedPosted: null,
        weedMiss: 0,
      };
    tended(st, tile); // VB-091
    st.used.add(tile);
    woodTaken(st, tile); // a wood tile broken to a field leaves its village's wood (VB-326)
    if (!w.dev[tile]) costChanged(st, tile); // developed ground walks as open ground (sim/routes, tileCost)
    w.dev[tile] = 1;
    st.visualDirty = true;
    st.biomeDirty.add(tile);
    return fd;
  }
  // ---- rotations (VB-350; design.md, Crops and rotations, The rotation) ----
  // @state farmstead.fields[].rotation: a key of ROTATIONS (sim/rules), the same on every field of a farm; step: the field's place in it,
  //   whose course is the field's crop. A village's common fields (VB-100) hold barley every year.
  // @state village.rotation: the village's usual rotation, a key of ROTATIONS: the one most of its farms hold, brought up to date at its
  //   autumn meeting and at no other time (usualRotation; Kim, 11 Nov). Owned here, as a reading of its farms' fields (target-v2 4.3).
  // @state farmstead.fields[].turn: absent, or true: the field's crop was chosen out of turn for a year (the verb sowOutOfTurn, VB-355) and
  //   is not its step's course; cleared when the field goes on to its next step, or its farm changes rotation.
  // @state farmstead.rotationBy: absent, or the id of the household whose head chose the farm's rotation to keep (the verb rotation with
  //   hold, VB-355): while that household holds the farm, its rule (rotationChoice) leaves the rotation alone.
  // @state farmstead.firstRotation: absent, or a key of ROTATIONS: the rotation the farm's first fields take where its own differs from its
  //   village's (the scenarios' crops, VB-353; rotationOf)
  // @state farmstead.keeps: absent, or crops[] the farm holds a field's seed of and does not sow (the founders' backup farm; sim/hunger
  //   seedNeed, sim/plans reserveSeed)
  const underCrop = (fd) =>
    fd.stage === 'sown' || fd.stage === 'growing' || fd.stage === 'ripe' || fd.stage === 'stooks';
  // The field goes on to its next step: its crop is in, or lost, or its window passed with it unsown, or its fallow year is over. A field
  // hoed for a crop it will not bear now lies in stubble (a fallow field is never hoed).
  function nextStep(fd) {
    const R = ROTATIONS[fd.rotation].courses;
    if (fd.turn)
      delete fd.turn; // its year out of turn is over (VB-355): back to the rotation, at the next step
    else if (R.length === 1) return; // barley every year: as it was
    fd.step = (fd.step + 1) % R.length;
    fd.crop = R[fd.step];
    if (!underCrop(fd)) delete fd.weeds;
    if (CROPS[fd.crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble';
  }
  // The days after the crops' sowing windows close: [season, day, crop].
  const CLOSED = Object.keys(CROPS)
    .filter((k) => CROPS[k].seed > 0)
    .map((k) => {
      const [s, , last] = CROPS[k].sow;
      return last + 1 < SEASON_DAYS ? [s, last + 1, k] : [(s + 1) % 4, 0, k];
    });
  // A crop's course whose sowing window closed with its field unsown is a year lost: the field goes on to its next step, so that the farm's
  // fields stay staggered. Walked on those days only.
  function unsown(st, c) {
    for (const [s, d, k] of CLOSED) {
      if (c.season !== s || c.sday !== d) continue;
      for (const f of st.farmsteads)
        if (f.household !== null)
          for (const fd of f.fields)
            if (fd.crop === k && (fd.stage === 'stubble' || fd.stage === 'plowed')) nextStep(fd);
    }
  }
  // The rotation a farm's household holds: its fields' (the same on each); with no field yet, its village's usual one where it has the
  // seed, else barley every year.
  function rotationOf(st, hh) {
    const f = hh.farmstead === null || hh.farmstead === undefined ? null : st.farmsteads[hh.farmstead];
    if (!f) return 'every';
    if (f.fields.length) return f.fields[0].rotation;
    if (f.firstRotation && hasSeed(st, f, hh, f.firstRotation)) return f.firstRotation; // the farm's own (VB-353), else its village's
    const v = f.village === null ? null : st.villages[f.village];
    return v && v.rotation && hasSeed(st, f, hh, v.rotation) ? v.rotation : 'every';
  }
  // Has household hh crop k: a field's seed of it in store, or a field of its farm f bearing it now (its seed is in the ground).
  const hasCrop = (st, f, hh, k) =>
    Stores.grainOf(hh, k) >= CROPS[k].seed || f.fields.some((fd) => fd.crop === k && underCrop(fd));
  // Has it every crop of rotation `key` (design.md, The rotation, Seed bounds them).
  const hasSeed = (st, f, hh, key) => ROTATIONS[key].courses.every((k) => CROPS[k].fallow || hasCrop(st, f, hh, k));
  // The crop of a field due for sowing, in its window, that the household holds less than a field's seed of; null for none.
  function shortOf(f, hh, c) {
    for (const fd of f.fields) {
      const C = CROPS[fd.crop];
      if (!(C.seed > 0) || fd.turn || (fd.stage !== 'stubble' && fd.stage !== 'plowed')) continue; // a field out of turn waits (VB-355)
      if (c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2] && Stores.grainOf(hh, fd.crop) < C.seed)
        return fd.crop;
    }
    return null;
  }
  // The rotation a holder short of crop `short` falls back on: of those without it that it has seed for, the one that keeps most of its
  // sown crops, then one with a fallow course (the field it cannot sow lies fallow), then the first in ROTATIONS; null for none (it keeps
  // what it holds, and the field waits unsown: barley is in every rotation).
  function fallback(st, f, hh, from, short) {
    const was = ROTATIONS[from].courses;
    let best = null,
      bs = -1;
    for (const key in ROTATIONS) {
      if (ROTATIONS[key].courses.includes(short) || !hasSeed(st, f, hh, key)) continue;
      const R = ROTATIONS[key].courses;
      let s = R.some((k) => CROPS[k].fallow) ? 1 : 0;
      for (const k of R) if (!CROPS[k].fallow && was.includes(k)) s += 2;
      if (s > bs) {
        bs = s;
        best = key;
      }
    }
    return best;
  }
  // How well a step's course suits a field when the farm changes rotation: its own crop first, then fallow.
  const suits = (course, crop) => (course === crop ? 2 : CROPS[course].fallow ? 1 : 0);
  // The farm's fields take rotation `key`, staggered: a field under a crop keeps it (the caller checks the rotation has it); each other
  // field, in order, takes a step fewest of the fields are at, the one that suits it best, else the first.
  function restagger(f, key) {
    const R = ROTATIONS[key].courses;
    for (const fd of f.fields) {
      delete fd.turn;
      fd.rotation = key;
      fd.step = underCrop(fd) ? R.indexOf(fd.crop) : -1; // -1: placed below
    }
    const at = (j) => f.fields.filter((q) => q.step === j).length;
    for (const fd of f.fields) {
      if (fd.step >= 0) continue;
      const n = R.map((k, j) => at(j)),
        least = Math.min(...n);
      let i = -1;
      for (let j = 0; j < R.length; j++)
        if (n[j] === least && (i < 0 || suits(R[j], fd.crop) > suits(R[i], fd.crop))) i = j;
      fd.step = i;
      fd.crop = R[i];
      delete fd.weeds; // no crop stands: a lost crop's weeding goes with it (VB-999's reviews at rye's close met it)
      if (CROPS[fd.crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble';
    }
  }
  // A new field takes the farm's rotation (with no field yet, the household's: rotationOf) and the step fewest of the farm's fields are
  // at; of those, the course sown soonest from today (fallow last), then the first.
  function placeField(st, f, hh, fd) {
    const { key, i } = courseFor(
      st,
      f.fields.filter((q) => q !== fd),
      hh,
    );
    fd.rotation = key;
    fd.step = i;
    fd.crop = ROTATIONS[key].courses[i];
  }
  // The rotation and course a new field beside `others` takes (placeField's rule): {key, i}.
  function courseFor(st, others, hh) {
    const key = others.length ? others[0].rotation : hh ? rotationOf(st, hh) : 'every',
      R = ROTATIONS[key].courses,
      at = R.map((k, i) => others.filter((q) => q.step === i).length),
      least = Math.min(...at),
      c = cal(st.t),
      wait = (k) => {
        const W = CROPS[k].sow,
          first = W[0] * SEASON_DAYS + W[1],
          last = W[0] * SEASON_DAYS + W[2];
        return CROPS[k].fallow
          ? Infinity
          : c.doy >= first && c.doy <= last
            ? 0
            : (first - c.doy + YEAR_DAYS) % YEAR_DAYS;
      }; // days until course k is sown
    let i = -1;
    for (let j = 0; j < R.length; j++) if (at[j] === least && (i < 0 || wait(R[j]) < wait(R[i]))) i = j;
    return { key, i };
  }
  // The holder's rule for its rotation, at each review of its plan (the simplest head, VB-350): it takes its village's usual rotation when
  // it has the seed for it; short of a crop's seed at its sowing, it falls back on a rotation it has seed for, and the field at that course
  // lies fallow. A change waits while a field stands under a crop the new rotation has not. {to, short} for the verb `rotation`, which
  // carries it out (sim/plans issues it, source 'pawn'; VB-355), or null: no change, or its head chose the rotation to keep (rotationBy).
  function rotationChoice(st, f, hh, c) {
    if (!f.fields.length || f.rotationBy === hh.id) return null;
    const from = f.fields[0].rotation,
      v = f.village === null ? null : st.villages[f.village],
      usual = (v && v.rotation) || 'every';
    let to = null,
      short = null;
    if (usual !== from && hasSeed(st, f, hh, usual)) to = usual;
    else if ((short = shortOf(f, hh, c)) !== null) to = fallback(st, f, hh, from, short);
    return to === null || waitsFor(f, to) ? null : { to, short };
  }
  // The field of farm f under a crop that rotation `key` has not, for which a change to it waits; undefined for none.
  const waitsFor = (f, key) => f.fields.find((fd) => underCrop(fd) && !ROTATIONS[key].courses.includes(fd.crop));
  // ---- the head's choice (VB-355; design.md, How the head chooses what to sow, The player as head): the checks and the acts of the verbs
  // `rotation` and `sowOutOfTurn` (sim/commands), which bind any holder alike: the seed, the window, a free field ----
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const windowOf = (k) => `in ${SEASONS[CROPS[k].sow[0]]}, days ${CROPS[k].sow[1] + 1} to ${CROPS[k].sow[2] + 1}`;
  const noSeed = (f, hh, k) =>
    `${f.name} has no seed of ${k}: a field takes ${CROPS[k].seed} and its store holds ${Math.floor(Stores.grainOf(hh, k))}`;
  // Why household hh cannot take rotation `key` on its farm f, or null. null as the key gives the choice back to its rule.
  function rotationWhy(st, f, hh, key) {
    if (key === null) return null;
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(ROTATIONS, key))
      return `there is no rotation ${key}`;
    if (!f.fields.length) return `${f.name} has no field yet`;
    const lacks = ROTATIONS[key].courses.find((k) => !CROPS[k].fallow && !hasCrop(st, f, hh, k));
    if (lacks) return noSeed(f, hh, lacks);
    const fd = waitsFor(f, key);
    return fd
      ? `a field stands under ${fd.crop}, which ${ROTATIONS[key].label} has not: the change waits for its harvest`
      : null;
  }
  // Farm f takes rotation `key` (rotationWhy holds), its fields staggered anew when it changes. hold: its head keeps it against the
  // village's usual one, until it chooses again; key null, or a choice without hold, gives the choosing back to the rule. short: the crop
  // whose seed ran out, when the rule falls back (logged once, at the change).
  function takeRotation(st, f, hh, key, { hold = false, short = null } = {}) {
    const changed = key !== null && f.fields[0].rotation !== key;
    if (changed) restagger(f, key);
    if (hold && key !== null) f.rotationBy = hh.id;
    else if (f.rotationBy === hh.id) delete f.rotationBy;
    if (!changed || (short === null && !hold)) return;
    log(
      st,
      short !== null
        ? `${f.name} has no seed of ${short} to sow and falls back on ${ROTATIONS[key].label}.`
        : `${f.name} now farms ${ROTATIONS[key].label}, by its head's choice.`,
      { kind: 'field', ...atFarm(f) },
    );
  }
  const fieldAt = (f, tile) => f.fields.find((fd) => fd.tile === tile);
  // Why the field of farm f on `tile` cannot bear `crop` (a crop of the table, or fallow: a year's rest) out of turn this year, or null:
  // the field is free (in stubble or hoed), the crop's sowing window is open today and the store holds a field's seed of it. Its own
  // course is a choice too, while it stands out of turn: back to its turn.
  function turnWhy(st, f, hh, tile, crop, c) {
    const fd = fieldAt(f, tile);
    if (!fd) return `${f.name} has no field on tile ${tile}`;
    if (typeof crop !== 'string' || !Object.prototype.hasOwnProperty.call(CROPS, crop))
      return `there is no crop ${crop}`;
    if (fd.stage !== 'stubble' && fd.stage !== 'plowed')
      return underCrop(fd)
        ? `the field is under ${fd.crop}: it is free when its crop is in`
        : 'the field is untended: it is reclaimed first';
    if (fd.crop === crop) return `the field bears ${crop} next as it is`;
    const C = CROPS[crop];
    if (C.fallow) return null;
    if (!(c.season === C.sow[0] && c.sday >= C.sow[1] && c.sday <= C.sow[2]))
      return `${crop} is sown ${windowOf(crop)}`;
    return Stores.grainOf(hh, crop) < C.seed ? noSeed(f, hh, crop) : null;
  }
  // The field on `tile` bears `crop` this year, out of turn (turnWhy holds): its step stays, and when the crop is in, or lost, or its
  // window closes, the field goes on to its next step as after any course. Nothing is sown here: the household's work does that.
  function outOfTurn(st, f, tile, crop) {
    const fd = fieldAt(f, tile);
    fd.crop = crop;
    if (ROTATIONS[fd.rotation].courses[fd.step] === crop) delete fd.turn;
    else fd.turn = true;
    if (CROPS[crop].fallow && fd.stage === 'plowed') fd.stage = 'stubble';
    log(
      st,
      fd.turn
        ? `${f.name} ${CROPS[crop].fallow ? 'rests a field' : `sows a field with ${crop}`} out of turn this year.`
        : `${f.name} puts a field back to its turn: ${crop}.`,
      { kind: 'field', ...atFarm(f) },
    );
  }
  // A farm's field as its tile's card shows it (the page; VB-355): its crop and whether it stands out of turn, its rotation and step, what
  // is sown on it next and when, the seed its household holds of each crop, and, for its head, each rotation and each crop out of turn
  // with why it cannot be chosen today (the verbs' own checks). Computed when asked, stored nowhere; null where no farm has a field.
  function fieldView(st, tile) {
    const f = st.farmsteads.find((q) => fieldAt(q, tile));
    if (!f) return null;
    const fd = fieldAt(f, tile),
      hh = f.household === null ? null : st.households[f.household],
      R = ROTATIONS[fd.rotation].courses,
      c = cal(st.t),
      free = fd.stage === 'stubble' || fd.stage === 'plowed';
    let next = free && CROPS[fd.crop].seed > 0 ? fd.crop : null;
    for (let i = 1; next === null && i <= R.length; i++) {
      const k = R[(fd.step + i) % R.length];
      if (CROPS[k].seed > 0) next = k;
    }
    return {
      farm: f.id,
      household: f.household,
      crop: fd.crop,
      stage: fd.stage,
      turn: fd.turn === true,
      rotation: fd.rotation,
      label: ROTATIONS[fd.rotation].label,
      courses: [...R],
      step: fd.step,
      kept: hh !== null && f.rotationBy === hh.id,
      next: next === null ? null : { crop: next, when: windowOf(next) },
      seed: hh
        ? Object.keys(CROPS)
            .filter((k) => CROPS[k].seed > 0)
            .map((k) => ({ crop: k, held: Stores.grainOf(hh, k), field: CROPS[k].seed }))
        : [],
      rotations: hh
        ? Object.keys(ROTATIONS).map((key) => ({
            key,
            label: ROTATIONS[key].label,
            courses: [...ROTATIONS[key].courses],
            why: rotationWhy(st, f, hh, key),
          }))
        : [],
      crops: hh ? Object.keys(CROPS).map((k) => ({ crop: k, why: turnWhy(st, f, hh, tile, k, c) })) : [],
    };
  }
  // The village's usual rotation, a step of its autumn meeting (sim/meetings): the one most of its occupied farms hold; a tie keeps the
  // one it has, else the first in ROTATIONS.
  function usualRotation(st, v) {
    const n = {};
    VB.count.rotationWalk += v.farmsteads.length;
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id];
      if (f.household !== null && f.fields.length) n[f.fields[0].rotation] = (n[f.fields[0].rotation] || 0) + 1;
    }
    let best = v.rotation,
      bn = n[v.rotation] || 0;
    for (const key in ROTATIONS)
      if ((n[key] || 0) > bn) {
        best = key;
        bn = n[key];
      }
    if (best === v.rotation) return;
    v.rotation = best;
    log(st, `${v.name} now farms ${ROTATIONS[best].label} as a rule.`, { kind: 'custom', village: v.id });
  }
  // ---- soil and manure (VB-137) ----
  // A reaped crop wears the field's soil.
  const wearSoil = (fd) => {
    const C = CROPS[fd.crop];
    fd.soil = C.gain
      ? Math.max(fd.soil, Math.min(SOIL.start, fd.soil + C.gain))
      : Math.max(SOIL.floor, fd.soil - C.wear); // peas mend it (VB-349)
  };
  // In spring, while the heap holds a load, manure goes to the field with the poorest soil that is not yet sown: [field, loads] or null.
  function manureWanted(f, hh, c) {
    if (c.season !== 0 || c.sday < SOIL.window[0] || c.sday > SOIL.window[1] || !(hh.manure >= 1)) return null;
    let best = null;
    for (const fd of f.fields) {
      if ((fd.stage !== 'stubble' && fd.stage !== 'plowed') || fd.soil >= SOIL.cap - 1e-9) continue;
      if (!best || fd.soil < best.soil) best = fd;
    }
    return best ? [best, Math.min(hh.manure, (SOIL.cap - best.soil) / SOIL.perLoad)] : null;
  }
  // The manure is spread: each load the job carried raises the soil, as far as the heap still holds it; never below a fresh field's soil.
  function manureDone(st, fd, hh, loads) {
    const n = Math.max(0, Math.min(loads, hh.manure));
    hh.manure -= n;
    fd.soil = Math.max(fd.soil, Math.min(SOIL.cap, fd.soil + n * SOIL.perLoad));
    fd.tilth = tilthOf(st, fd) + n * TILTH.perLoad; // the ground's slow soil, whatever the soil (VB-717)
    fd.tilthAt = st.t;
  }
  // @state farmstead.fields[].tilth: the field's tilth when last set (0 or more); tilthAt: the tick it was set; it fades as e^-(t/TILTH.years),
  //   read in closed form by tilthOf, and written only at manuring (VB-717). A field starts at 0 in every scenario.
  function tilthOf(st, fd) {
    VB.count.tilthRead++;
    return fd.tilth * Math.exp(-(st.t - fd.tilthAt) / (TILTH.years * YEAR));
  }
  // @state farmstead.fields[]: crop (a key of CROPS, sim/rules: a crop, or the course fallow, VB-348), stage, sown/reaped days, held sheaves and
  // weeding progress; changed only here after seeding.
  //   trampled: absent, or the times cattle got into the standing crop since it was sown (VB-136; each takes HERD.stray.loss of its yield)
  //   hoursOwn, hoursOther (VB-462): absent, or the year's work hours given by the user household's own members and by others
  //   weeds: absent, or the rounds of weeding posted since sowing (CROPS weeds; VB-334, VB-348)
  //   rest: absent, or a fallow field's rest this year (VB-348): 0.5 once it stood fallow at the summer's start, 1 once tilled; credited
  //   to the soil at the year's end, whatever the field bears by then (rye is sown on it in autumn)
  // A stubble field hoed for its crop; a fallow field (the course, not the stage) is tilled and stays in stubble.
  //   browsed: absent, or the times roe deer got into it since it was sown (VB-139; each takes DEER.crop.loss of its yield)
  const hoed = (fd) => {
    if (CROPS[fd.crop].fallow) fd.rest = 1;
    else fd.stage = 'plowed';
  };
  function sown(fd, c) {
    fd.stage = 'sown';
    fd.sown = c.day;
    fd.weedOpen = false;
    fd.weedPosted = null;
    fd.weedMiss = 0;
    delete fd.trampled;
    delete fd.weeds;
    delete fd.browsed;
  }
  // farmstead.fields[] also has hoursOwn (VB-462): the year's work hours given by its user household's own members, and
  // hoursOther: those given by others (owed days, later the hired: VB-319); absent until the first; zeroed after the class is reckoned (VB-318).
  //   Written only here, as work is reckoned (sim/agents).
  const book = (fd, own, dt) => {
    const k = own ? 'hoursOwn' : 'hoursOther';
    fd[k] = (fd[k] || 0) + dt;
  };
  // Cattle got into the standing crop (sim/byre, VB-136), or roe deer (`deer`; sim/deer, VB-139).
  const trample = (fd, deer = false) => {
    if (deer) fd.browsed = (fd.browsed || 0) + 1;
    else fd.trampled = (fd.trampled || 0) + 1;
  };
  function reaped(st, fd, c) {
    const E = st.ECON;
    if (fd.weedOpen) fd.weedMiss++;
    fd.stage = 'stooks';
    fd.reaped = c.day;
    fd.held = Math.round(
      CROPS[fd.crop].yield *
        fd.fert *
        fd.soil *
        (1 + tilthOf(st, fd)) *
        st.weather *
        (0.9 + rnd(st.rng.fields) * 0.2) *
        (1 - Math.min(E.weedCutMax, E.weedCut * fd.weedMiss)) *
        (1 - HERD.stray.loss) ** (fd.trampled || 0) *
        (1 - DEER.crop.loss) ** (fd.browsed || 0),
    );
    delete fd.trampled;
    delete fd.browsed;
    delete fd.bin;
    delete fd.weeds;
    wearSoil(fd); // the crop takes from the soil (VB-137)
    fd.weedOpen = false;
    fd.weedPosted = null;
    fd.weedMiss = 0;
  }
  const hauled = (fd) => {
    fd.held = 0;
    fd.stage = 'stubble';
    fd.sown = null;
    nextStep(fd); // the crop is in (VB-350)
  };
  // A load of at most `cap` rations is taken from the stooks (VB-335); the field is hauled when the last is gone. `bin` is the barn entry
  // (sim/stores sheaf) holding the field's loads so far.
  function carried(fd, cap) {
    const n = Math.min(cap, fd.held);
    fd.held -= n;
    if (fd.held <= 0) hauled(fd);
    return n;
  }
  // A load set down by a carrier released on the road (VB-581) lies with the stooks for the next hand: the field is not hauled after all.
  function laidDown(fd, n) {
    fd.held += n;
    fd.stage = 'stooks';
  }
  const binned = (fd, seq) => {
    fd.bin = seq;
  };
  function reclaimed(st, fd) {
    clearScrub(st, fd.tile); // the forest's scrub on it is cleared with the grass (VB-091)
    if (fd.stage === 'fallow' || fd.stage === 'scrub') {
      fd.stage = 'stubble';
      st.visualDirty = true;
    }
  }
  const weeded = (fd) => {
    fd.weedOpen = false;
  };
  function abandoned(f) {
    for (const fd of f.fields) {
      if (fd.stage !== 'stubble') fd.held = 0;
      fd.stage = 'stubble';
      fd.sown = null;
    }
  }
  // A ripe field still standing on its crop's `lost` day is lost (rye by the autumn's first day; VB-348).
  function lostRipe(st, f, fd, c) {
    const L = CROPS[fd.crop].lost;
    if (!L || fd.stage !== 'ripe' || c.season !== L[0] || c.sday !== L[1]) return;
    fd.stage = 'stubble';
    fd.sown = null;
    fd.weedOpen = false;
    delete fd.weeds;
    delete fd.trampled;
    nextStep(fd); // the crop is lost: the field goes on to its next course (VB-350)
    st.visualDirty = true;
    log(st, `A crop at ${placeName(f)} was lost, left standing too long.`, { kind: 'frost', ...placeOf(f) });
  }
  // A field's holder as its log line names it: a farm, or a village for its common fields (VB-100).
  const isVillage = (x) => 'center' in x;
  const placeName = (x) => (isVillage(x) ? `the common field of ${x.name}` : x.name);
  const placeOf = (x) => (isVillage(x) ? { village: x.id } : atFarm(x));
  // The fields being worked: each occupied farm's, then each village's common fields (VB-100), as fn(holder, field).
  function eachWorked(st, fn) {
    for (const f of st.farmsteads) if (f.household !== null) for (const fd of f.fields) fn(f, fd);
    for (const v of st.villages) if (v.commonFields) for (const fd of v.commonFields) fn(v, fd);
  }
  // Fallow's rest (VB-348): marked on the summer's first day on each fallow field of an occupied farm (tilled since: 1), credited on the
  // year's last day: CROPS.fallow.mend times the mark, to at most SOIL.start (a field manured above it keeps its soil).
  // A fallow course whose field stood the summer (its rest marked) ends on the autumn's first day, and the field goes on to its next step:
  // in three courses, rye sown that autumn (VB-350).
  function rest(st, c) {
    const summer = c.season === 1 && c.sday === 0,
      autumn = c.season === 2 && c.sday === 0,
      end = c.season === 3 && c.sday === SEASON_DAYS - 1;
    if (!summer && !end && !autumn) return;
    for (const f of st.farmsteads)
      for (const fd of f.fields) {
        if (summer && f.household !== null && CROPS[fd.crop].fallow && fd.rest === undefined) fd.rest = 0.5;
        if (autumn && CROPS[fd.crop].fallow && fd.rest !== undefined) nextStep(fd);
        if (end && fd.rest !== undefined) {
          fd.soil = Math.max(fd.soil, Math.min(SOIL.start, fd.soil + CROPS.fallow.mend * fd.rest));
          delete fd.rest;
        }
      }
  }
  // Daily crop rules, after routes and before buildings and fences decay. No random draws.
  function fieldsDay(st, c) {
    const E = st.ECON;
    const day = Math.floor(st.t / DAY);
    eachWorked(st, (f, fd) => {
      if (fd.sown === null || fd.stage === 'stooks') return;
      const g = day - fd.sown;
      if (g >= CROPS[fd.crop].ripe) fd.stage = 'ripe';
      else if (g >= 3 && fd.stage === 'sown') fd.stage = 'growing';
      lostRipe(st, f, fd, c);
    });
    // upkeep: a growing field wants its crop's rounds of weeding (CROPS weeds), the next falling due E.weedDays[round] days after sowing; a
    // round still open when the next falls due, or at ripening (reaped), counts as missed
    eachWorked(st, (f, fd) => {
      if (fd.stage !== 'growing') return;
      const n = fd.weeds || 0;
      if (n >= CROPS[fd.crop].weeds || day - fd.sown < E.weedDays[n]) return;
      if (fd.weedOpen) fd.weedMiss++;
      fd.weedOpen = true;
      fd.weedPosted = day;
      fd.weeds = n + 1;
    });
    rest(st, c);
    unsown(st, c);
    // Untended fields go to grass, unless a claimant is restoring the farm; a field the forest has grown into is scrub (sim/spread, VB-091).
    for (const f of st.farmsteads)
      if (f.household === null && !Projects.onFarm(st, f.id)) {
        const yrs = (st.t - f.emptySince) / YEAR;
        for (const fd of f.fields) {
          const w = st.w,
            scrub = w.treesMax[fd.tile] > 0 && w.trees[fd.tile] >= SPREAD.scrub * w.treesMax[fd.tile];
          const want = scrub ? 'scrub' : yrs > 1 || fd.stage === 'scrub' ? 'fallow' : fd.stage;
          if (fd.stage !== want) {
            fd.stage = want;
            st.visualDirty = true;
          }
        }
      }
  }
  // The autumn frost, on the season's last day (sim/clock, CALENDAR: fieldsFrost, after fieldsDay): a crop still standing or in stooks is lost;
  // a winter crop (rye) standing green is not (VB-348).
  function fieldsFrost(st) {
    const lost = new Map(); // one line a holder, not one a field: holder -> {stage: count}
    eachWorked(st, (f, fd) => {
      if (CROPS[fd.crop].winter && fd.stage === 'growing') return;
      if (['ripe', 'growing', 'stooks'].includes(fd.stage)) {
        const k = fd.crop + ' ' + (STOOD[fd.stage] || fd.stage);
        if (!lost.has(f)) lost.set(f, new Map());
        lost.get(f).set(k, (lost.get(f).get(k) || 0) + 1);
        fd.stage = 'stubble';
        fd.sown = null;
        fd.held = 0;
        fd.weedOpen = false;
        delete fd.weeds; // the crop is gone, and its weeding with it (a lost barley field going fallow kept its rounds)
        delete fd.trampled;
        delete fd.browsed;
        nextStep(fd); // VB-350
      }
    });
    for (const [f, m] of lost) {
      const what = [...m].map(([k]) => k.split(' ')),
        crops = [...new Set(what.map((w) => w[0]))],
        stood = [...new Set(what.map((w) => w.slice(1).join(' ')))];
      log(st, `Frost took the ${crops.join(' and ')} at ${placeName(f)}, ${stood.join(' and ')}.`, {
        kind: 'frost',
        ...placeOf(f),
      });
    }
  }
  const STOOD = { ripe: 'ripe and not yet reaped', stooks: 'in stooks', growing: 'still growing' };
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
      left = SEASON_DAYS - 1 - c.sday;
    return { fields: n, days, left, late: days > left, hands };
  }
  const rowAngle = (j) => (j.farm ? j.farm.rowAngle : 0);
  // Several hands on one field start on different rows: the nth worker on row -12 + 6n, five rows across the tile.
  const firstRow = (j, a) => -12 + 6 * (Math.max(0, j.claims.indexOf(a.id)) % 5);
  // The start of the pawn's first row on a field tile.
  function onField(st, a, j) {
    const w = st.w,
      th = rowAngle(j),
      row = firstRow(j, a);
    return [
      w.hx[j.site] - Math.cos(th) * 13 - Math.sin(th) * row,
      w.hy[j.site] - Math.sin(th) * 13 + Math.cos(th) * row,
    ];
  }
  return {
    rowAngle,
    book,
    firstRow,
    onField,
    hoed,
    sown,
    trample,
    reaped,
    tilthOf,
    carried,
    laidDown,
    binned,
    reclaimed,
    weeded,
    abandoned,
    fieldsDay,
    fieldsFrost,
    harvestEstimate,
    BREAK_HOURS,
    clearHours,
    yearlyRations,
    fieldsWorkable,
    fieldsWanted,
    rotationChoice,
    rotationWhy,
    takeRotation,
    turnWhy,
    outOfTurn,
    fieldView,
    usualRotation,
    restagger,
    builtTiles,
    chooseTile,
    fieldWhy,
    pickField,
    beginField,
    fieldProject,
    newFieldSeed,
    finishClear,
    clearStones,
    finishBreak,
    broken,
    manureWanted,
    manureDone,
  };
})();
