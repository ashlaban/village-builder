// @sys sim/ladder: the main building's rungs (a camp, a shelter, a cottage, a timber house: VB-1636), its stone foundation (a property
//   of the house, not a rung; VB-1635) and the outbuildings (a barn) as data, each what it is built from, needs and gives, read from the
//   rules that build it; the rung a farm stands at (rungOf), derived from its state (but the timber house, stored: farmstead.rung,
//   sim/timberhouse); and the farm's view for the page (farmView): what stands, what is being built, what could follow and why not now
//   (VB-1631); the plan tasks' checks (rungWhy, upgradeWhy, VB-1632; foundationWhy, outWhy, VB-1635; sim/upgrade). Reads only.
VB['sim/ladder'] = (() => {
  const { BOOTH, BUILD } = VB['sim/rules'];
  const { HOUSE, ROOM } = VB['sim/house'];
  const { timberWhy } = VB['sim/timberhouse'];
  const { hexSteps } = VB['sim/hex'];
  const { doneOf } = VB['sim/progress'];
  const Projects = VB['sim/projects'],
    Stores = VB['sim/stores'];
  const { COTTAGE, COTTAGE_HOURS, cottageOf } = VB['sim/cottageplan'];
  const { roofless, stakedEach, barnSteps } = VB['sim/building'];
  const { BUILDS, campWhy } = VB['sim/camp'];
  const { barnWhy } = VB['sim/aims'];
  const { byreWhy, byreSteps } = VB['sim/byrehouse'];
  const { HERD } = VB['sim/rules'];
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  // ---- the tables: later rungs (a timber house) and outbuildings (a byre) are added here, with the rules that build them ----
  // Each rung: `from` the rung it is built from (null: the first), `needs` {timber (loads), stone (loads), hours (of work, its stages'
  // sum)}, `gives` in the sim's own terms: `roof` (sim/hunger's: 'none' the open sky, 'booth' a booth's roof, 'house'), `sleeps` (the
  // house's room, sim/house ROOM: a household over it is crowded), `fire` (the day's firewood over a cottage's),
  // `wear` (a year, of its condition 0..1), `standing` (the house's term, sim/house; 0 none).
  const RUNGS = Object.freeze({
    camp: {
      from: null,
      needs: { timber: 0, stone: 0, hours: 0 },
      gives: { roof: 'none', sleeps: 0, wear: 0, standing: 0 },
    },
    // the shelter on the house tile (VB-1638): poles, bark and turf, a booth's cost, roof, room and wear (BOOTH), built up in place
    shelter: {
      from: 'camp',
      needs: { timber: BOOTH.wood, stone: 0, hours: BOOTH.hours },
      gives: { roof: 'booth', sleeps: BOOTH.sleeps, wear: BOOTH.wear, standing: 0 },
    },
    cottage: {
      from: 'shelter',
      needs: { timber: BUILD.timber, stone: 0, hours: sum(COTTAGE.map((k) => COTTAGE_HOURS[k])) },
      gives: { roof: 'house', sleeps: ROOM.cottage, fire: 1, wear: HOUSE.wear, standing: HOUSE.term },
    },
    // the timber house (VB-1636): built up from the cottage by a project of its own (the making `timberhouse`, sim/timberhouse), more room
    // and a smaller fire; it wears and stands as a cottage does
    timber: {
      from: 'cottage',
      needs: { timber: BUILD.timberHouse.timber, stone: 0, hours: sum(BUILD.timberHouse.hours) },
      gives: { roof: 'house', sleeps: ROOM.timber, fire: ROOM.timberFire, wear: HOUSE.wear, standing: HOUSE.term },
    },
  });
  // The stone foundation (VB-332; Kim, 24 Nov 2026: "Maybe have the foundation as a separate property. It is also more prestigious"): not
  // a rung but a property of the main building (farmstead.grade, 'ground' or 'stone'), laid under a house of any rung from the cottage
  // up and kept when it is built up; `gives` its house's wear a year and standing term on stone (sim/house), against the ground's.
  const FOUNDATION = Object.freeze({
    from: 'cottage',
    needs: { timber: 0, stone: BUILD.foundationStone, hours: BUILD.foundationHours },
    gives: { wear: HOUSE.wearStone, standing: HOUSE.termStone },
  });
  // Each outbuilding: `from` the rung the farm must stand at, `needs` as a rung's, `gives` in the sim's terms (a barn: the grain's and
  // the hay's spoilage times `loss`, sim/hunger, sim/byre); `kinds` its stages' job kinds. The making of the same name (sim/makings)
  // begins it, and the farm records it built as f[what]: sim/upgrade's chain `outbuilding` builds any of them so (VB-1635).
  const OUTBUILDINGS = Object.freeze({
    barn: {
      from: 'cottage',
      needs: { timber: BUILD.barn.timber, stone: 0, hours: sum(BUILD.barn.hours) },
      gives: { store: true, loss: BUILD.barn.loss },
      kinds: barnSteps(-1).map((s) => s.kind),
    },
    // the byre (VB-1637): the animals' places through the stall winter (HERD.byre, sim/byre); a farm without one winters them in the open
    byre: {
      from: 'cottage',
      needs: { timber: BUILD.byre.timber, stone: 0, hours: sum(BUILD.byre.hours) },
      gives: { places: HERD.byre },
      kinds: byreSteps(-1).map((s) => s.kind),
    },
  });
  // ---- the rung a farm stands at, from its state as it is ----
  // A farm with no cottage yet (f.booth): a camp while its household sleeps under the open sky (sim/building roofless: its camp, or its
  // shelter being raised or worn to nothing; in a save before VB-1638 its booth staked and not yet raised, or rotted), else a shelter
  // (standing; or, in such a save, its booth raised, or the mark of sim/settle's settlers, who slept as in a house). A
  // farm with its cottage: a cottage, on the ground or on stone (f.grade: the foundation, a property of the house, VB-1635); or the rung
  // stored where it cannot be derived (f.rung: the timber house, VB-1636).
  const householdOf = (st, f) => (f.household === null ? null : st.households[f.household]);
  function rungOf(st, f) {
    if (f.camp === true) return 'camp';
    if (f.booth) {
      const hh = householdOf(st, f);
      return hh && roofless(st, hh) ? 'camp' : 'shelter';
    }
    return f.rung || 'cottage';
  }
  // ---- what is being built now ----
  // The hours left of plan p from its open step on, the open step's done hours read from its live job (posted under `key`) or its record.
  function hoursLeft(st, p, key) {
    let left = 0;
    for (let i = p.open || 0; i < p.steps.length; i++) left += p.steps[i].hours;
    const s = p.steps[p.open || 0],
      j = key ? st.jobs.get(key) : null;
    return Math.max(0, left - (j ? doneOf(st, j, s.hours) : s.done || 0));
  }
  // The booth plan staked by a member of household hh beside farm f's house, or null (a save before VB-1638).
  function homeStake(st, hh, f) {
    let out = null;
    stakedEach(st, (p) => {
      if (out === null && st.pawns[p.holder.id].household === hh.id && hexSteps(st.w, p.tile, f.house) <= 1) out = p;
    });
    return out;
  }
  // ---- the plan's tasks that cover a part of the farm ----
  // Whether a task of the played pawn's plan covers rung `what` of farm f: the shelter by the farmstead task, a later rung by an upgrade task
  // of the house's tile naming it; the stone foundation (`foundation`) by the foundation task of the house's tile, an outbuilding by an
  // outbuilding task there naming it (VB-1635).
  function planned(st, f, what) {
    const pp = st.player && st.player.plan;
    if (!pp) return false;
    if (what === 'shelter') return pp.tasks.some((t) => t.kind === 'farmstead');
    if (what === 'foundation') return pp.tasks.some((t) => t.kind === 'foundation' && t.foundation === f.house);
    const kind = Object.hasOwn(OUTBUILDINGS, what) ? 'outbuilding' : 'upgrade';
    return pp.tasks.some((t) => t.kind === kind && t[kind] === f.house && t.what === what);
  }
  // the stone foundation under way: the building step of the household's plan (sim/building buildStep), which a head holding off projects
  // has none of (VB-1633: read at once, not at its next review, once the player takes the plan by hand) but for its foundation task
  const stoneUnderWay = (st, hh, f) =>
    !f.booth &&
    f.grade === 'ground' &&
    !!st.plans.households.get(hh.id)?.build &&
    (!Projects.heldOff(st, hh.id) || planned(st, f, 'foundation'));
  // The stone foundation under way at farm f: {what: 'foundation', step (its building step's kind, 'raise' once the heap holds the
  // stone), hoursLeft (the raising's)}, or null.
  function stoneBuilding(st, hh, f) {
    if (!hh || !stoneUnderWay(st, hh, f)) return null;
    const step = st.plans.households.get(hh.id).build,
      heap = Stores.heldOf(hh, 'stone') >= BUILD.foundationStone,
      j = st.jobs.get(`raise:f${f.id}`);
    const done = j ? doneOf(st, j, BUILD.foundationHours) : 0;
    return { what: 'foundation', step: heap ? 'raise' : step.kind, hoursLeft: BUILD.foundationHours - done };
  }
  // Outbuilding `what` under way at farm f (its household's project of that making; the timber house's, the making `timberhouse`, as
  // the rung `timber`): {what, step (its open stage's kind), hoursLeft}, or null.
  function outBuilding(st, hh, f, what, making = what) {
    const p = hh ? Projects.projectsOf(st, 'household', hh.id).find((q) => q.what === making) : null;
    if (!p) return null;
    const s = p.steps[p.open];
    return { what, step: s.kind, hoursLeft: hoursLeft(st, p, `${s.kind}:f${f.id}`) };
  }
  // What farm f's household is building now, the main building first, then its foundation, then an outbuilding: {what, step (the open
  // step's kind), hoursLeft}, or null.
  function building(st, hh, f) {
    if (!hh) return null;
    const s = f.booth ? f.shelter : null;
    if (s && s.built === null) {
      const j = st.jobs.get(`shelter:f${f.id}`),
        left = BOOTH.hours - (j ? doneOf(st, j, BOOTH.hours) : s.done);
      return {
        what: 'shelter',
        step: Projects.lacks(s, BOOTH.wood) > 0 ? 'timber' : 'shelter',
        hoursLeft: Math.max(0, left),
      };
    }
    const b = f.booth && !s ? homeStake(st, hh, f) : null;
    if (b)
      return { what: 'shelter', step: b.steps[b.open || 0].kind, hoursLeft: hoursLeft(st, b, `booth:o${b.booth}`) };
    const c = cottageOf(st, hh.id);
    if (c) return { what: 'cottage', step: c.steps[c.open].kind, hoursLeft: hoursLeft(st, c, `booth:f${f.id}`) };
    const timber = outBuilding(st, hh, f, 'timber', 'timberhouse');
    if (timber) return timber;
    const stone = stoneBuilding(st, hh, f);
    if (stone) return stone;
    for (const what of Object.keys(OUTBUILDINGS)) {
      const o = outBuilding(st, hh, f, what);
      if (o) return o;
    }
    return null;
  }
  // ---- why a rung cannot be begun now, in its own checks' words (null: it can) ----
  const own = (st, hh, f) => (!hh || f.household !== hh.id ? `farm ${f.id} has no household of its own` : null);
  const WHY = {
    camp: () => 'a camp is not built',
    // the camp's head places the farmstead (sim/camp, the build menu's farmstead), which begins the shelter on the house tile; one begun
    // (or worn to nothing, and raised again) is raised by its household's work (sim/building), not begun again
    shelter: (st, hh, f) => {
      if (own(st, hh, f)) return own(st, hh, f);
      if (f.camp === true && !f.shelter)
        return st.player ? BUILDS.farmstead.why(st, hh.holder) : campWhy(st, hh.holder);
      if (f.shelter || homeStake(st, hh, f)) return `the shelter at ${f.name} is being raised`;
      return null;
    },
    // a cottage is begun on a booth farm whose household has none planned (sim/cottageplan cottagePlan)
    cottage: (st, hh, f) =>
      own(st, hh, f) ||
      (!f.booth ? `${f.name} has a cottage` : cottageOf(st, hh.id) ? `the household has a cottage under way` : null),
    // a timber house is begun from a cottage by its making (sim/timberhouse timberWhy), one at a time
    timber: (st, hh, f) => own(st, hh, f) || timberRule(st, hh),
  };
  const timberRule = (st, hh) =>
    Projects.underWay(st, hh.id, 'timberhouse') ? `the household has a timber house under way` : timberWhy(st, hh);
  // the stone foundation's step (sim/building buildStep): a house from the cottage up on the ground, none begun; beside any other project
  // (VB-1640)
  const stoneWhy = (st, hh, f) =>
    own(st, hh, f) ||
    (f.booth
      ? `${f.name} has no cottage yet`
      : f.grade !== 'ground'
        ? `the house at ${f.name} stands on stone`
        : stoneUnderWay(st, hh, f)
          ? `the household has a stone foundation under way`
          : null);
  // an outbuilding: none built, none under way, and its making's own check (a barn: sim/aims barnWhy)
  const OUT_WHY = {
    barn: (st, hh, f) => own(st, hh, f) || barnWhy(st, hh),
    byre: (st, hh, f) => own(st, hh, f) || byreWhy(st, hh),
  };
  const outRule = (st, hh, f, what) =>
    f[what]
      ? `${f.name} has a ${what}`
      : hh && Projects.underWay(st, hh.id, what)
        ? `the household has a ${what} under way`
        : OUT_WHY[what](st, hh, f);
  // ---- the plan tasks' checks: the played head builds up its farm as tasks of its plan (VB-1632, VB-1635) ----
  // The head's check, shared by the tasks: the farm's own household, pawn id its head.
  function headWhy(st, id, f) {
    const hh = householdOf(st, f);
    return own(st, hh, f) || (hh.holder !== id ? 'only the head of the household builds up its house' : null);
  }
  // Why pawn id cannot begin rung `what` of farm f now, or null (sim/upgrade's verb beginCottage): the head of the farm's household; a rung
  // of RUNGS that follows the one standing, the farm no longer a camp; the cottage (none under way) and the timber house (its making's
  // check, none under way) are built today, a later rung not yet ('not yet').
  function rungWhy(st, id, f, what) {
    const why = headWhy(st, id, f);
    if (why) return why;
    if (!Object.hasOwn(RUNGS, what)) return `there is no rung ${what}`;
    const rung = rungOf(st, f);
    if (rung === 'camp')
      return f.camp === true
        ? `${f.name} is still a camp: place the farmstead first`
        : `${f.name} has no roof: raise its shelter first`;
    if (RUNGS[what].from !== rung) return `a ${what} is built from a ${RUNGS[what].from}, and ${f.name} is a ${rung}`;
    if (what === 'timber') return timberRule(st, householdOf(st, f));
    if (what !== 'cottage') return 'not yet';
    return cottageOf(st, f.household) ? `the household has a cottage under way` : null;
  }
  // Why the played pawn id cannot plan the upgrade of farm f to `what`, or null: rungWhy, and none planned already.
  const upgradeWhy = (st, id, f, what) =>
    rungWhy(st, id, f, what) || (planned(st, f, what) ? `the ${what} is planned already` : null);
  // Why the played pawn id cannot plan farm f's stone foundation, or null (VB-1635): the head, the step's own check (stoneWhy), none planned.
  const foundationWhy = (st, id, f) =>
    headWhy(st, id, f) ||
    stoneWhy(st, householdOf(st, f), f) ||
    (planned(st, f, 'foundation') ? 'the stone foundation is planned already' : null);
  // Why the played pawn id cannot plan outbuilding `what` at farm f, or null (VB-1635): one of OUTBUILDINGS, the head, none built or
  // under way, its making's check, none planned.
  const outWhy = (st, id, f, what) =>
    (Object.hasOwn(OUTBUILDINGS, what) ? null : `there is no outbuilding ${what}`) ||
    headWhy(st, id, f) ||
    outRule(st, householdOf(st, f), f, what) ||
    (planned(st, f, what) ? `the ${what} is planned already` : null);
  // Sim.farmView(st, farmId): plain data for the page, writing nothing: {rung, building (null, or {what, step, hoursLeft}; what a rung,
  // 'foundation' or an outbuilding), next: [{what, needs, ok, why, planned}] (the rungs built from the one standing), foundation: {grade,
  // needs, ok, why, planned, building (null, or as building's)}, outbuildings: [{what, built, needs, ok, why, planned, building}]}; null for
  // no such farm. For the played head ok and why are its plan task's check; for any other household the head's own rule's.
  function farmView(st, id) {
    const f = st.farmsteads[id];
    if (!f) return null;
    const hh = householdOf(st, f),
      rung = rungOf(st, f),
      hand = !!st.player && !!hh && hh.holder === st.player.pawn;
    const next = Object.keys(RUNGS)
      .filter((k) => RUNGS[k].from === rung)
      .map((what) => {
        const why = hand && what !== 'shelter' ? upgradeWhy(st, st.player.pawn, f, what) : WHY[what](st, hh, f);
        return { what, needs: { ...RUNGS[what].needs }, ok: why === null, why, planned: planned(st, f, what) };
      });
    const fwhy = hand ? foundationWhy(st, st.player.pawn, f) : stoneWhy(st, hh, f);
    const foundation = {
      grade: f.grade || 'ground',
      needs: { ...FOUNDATION.needs },
      ok: fwhy === null,
      why: fwhy,
      planned: planned(st, f, 'foundation'),
      building: stoneBuilding(st, hh, f),
    };
    const outbuildings = Object.keys(OUTBUILDINGS).map((what) => {
      const why = hand ? outWhy(st, st.player.pawn, f, what) : outRule(st, hh, f, what);
      return {
        what,
        built: !!f[what],
        needs: { ...OUTBUILDINGS[what].needs },
        ok: why === null,
        why,
        planned: planned(st, f, what),
        building: outBuilding(st, hh, f, what),
      };
    });
    return { rung, building: building(st, hh, f), next, foundation, outbuildings };
  }
  return { RUNGS, FOUNDATION, OUTBUILDINGS, rungOf, rungWhy, upgradeWhy, foundationWhy, outWhy, farmView };
})();
