// @sys sim/ladder: the main building's rungs (a camp, a booth, a cottage, a cottage on stone) and the outbuildings (a barn) as data, each
//   what it is built from, needs and gives, read from the rules that build it; the rung a farm stands at (rungOf), derived from its state;
//   and the farm's view for the page (farmView): what stands, what is being built, what could follow and why not now (VB-1631). Reads only.
VB['sim/ladder'] = (() => {
  const { BOOTH, BUILD } = VB['sim/rules'];
  const { HOUSE } = VB['sim/house'];
  const { hexSteps } = VB['sim/hex'];
  const { doneOf } = VB['sim/progress'];
  const Projects = VB['sim/projects'],
    Stores = VB['sim/stores'];
  const { COTTAGE, COTTAGE_HOURS, cottageOf } = VB['sim/cottageplan'];
  const { roofless, stakedEach, raiseBoothWhy } = VB['sim/building'];
  const { BUILDS, campWhy } = VB['sim/camp'];
  const { barnWhy } = VB['sim/aims'];
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  // ---- the tables: later rungs (a timber house) and outbuildings (a byre) are added here, with the rules that build them ----
  // Each rung: `from` the rung it is built from (null: the first), `needs` {timber (loads), stone (loads), hours (of work, its stages'
  // sum)}, `gives` in the sim's own terms: `roof` (sim/hunger's: 'none' the open sky, 'booth', 'house'), `sleeps` (null: its household,
  // however many), `wear` (a year, of its condition 0..1), `standing` (the house's term, sim/house; 0 none).
  const RUNGS = Object.freeze({
    camp: {
      from: null,
      needs: { timber: 0, stone: 0, hours: 0 },
      gives: { roof: 'none', sleeps: 0, wear: 0, standing: 0 },
    },
    booth: {
      from: 'camp',
      needs: { timber: BOOTH.wood, stone: 0, hours: BOOTH.hours },
      gives: { roof: 'booth', sleeps: BOOTH.sleeps, wear: BOOTH.wear, standing: 0 },
    },
    cottage: {
      from: 'booth',
      needs: { timber: BUILD.timber, stone: 0, hours: sum(COTTAGE.map((k) => COTTAGE_HOURS[k])) },
      gives: { roof: 'house', sleeps: null, wear: HOUSE.wear, standing: HOUSE.term },
    },
    stone: {
      from: 'cottage',
      needs: { timber: 0, stone: BUILD.foundationStone, hours: BUILD.foundationHours },
      gives: { roof: 'house', sleeps: null, wear: HOUSE.wearStone, standing: HOUSE.termStone },
    },
  });
  // Each outbuilding: `from` the rung the farm must stand at, `needs` as a rung's, `gives` in the sim's terms (a barn: the grain's and
  // the hay's spoilage times `loss`, sim/hunger, sim/byre).
  const OUTBUILDINGS = Object.freeze({
    barn: {
      from: 'cottage',
      needs: { timber: BUILD.barn.timber, stone: 0, hours: sum(BUILD.barn.hours) },
      gives: { store: true, loss: BUILD.barn.loss },
    },
  });
  // ---- the rung a farm stands at, from its state as it is ----
  // A farm with no cottage yet (f.booth): a camp while its household sleeps under the open sky (sim/building roofless: its camp, or its
  // booth staked and not yet raised, or rotted), else a booth (raised; or the mark of sim/settle's settlers, who sleep as in a house). A
  // farm with its cottage: a cottage on the ground, or on stone (f.grade).
  const householdOf = (st, f) => (f.household === null ? null : st.households[f.household]);
  function rungOf(st, f) {
    if (f.camp === true) return 'camp';
    if (f.booth) {
      const hh = householdOf(st, f);
      return hh && roofless(st, hh) ? 'camp' : 'booth';
    }
    return f.grade === 'stone' ? 'stone' : 'cottage';
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
  // The booth plan staked by a member of household hh beside farm f's house, or null.
  function homeStake(st, hh, f) {
    let out = null;
    stakedEach(st, (p) => {
      if (out === null && st.pawns[p.holder.id].household === hh.id && hexSteps(st.w, p.tile, f.house) <= 1) out = p;
    });
    return out;
  }
  const stoneUnderWay = (st, hh, f) => !f.booth && f.grade === 'ground' && !!st.plans.households.get(hh.id)?.build;
  // What farm f's household is building now, the main building first: {what, step (the open step's kind), hoursLeft}, or null.
  function building(st, hh, f) {
    if (!hh) return null;
    const b = f.booth ? homeStake(st, hh, f) : null;
    if (b) return { what: 'booth', step: b.steps[b.open || 0].kind, hoursLeft: hoursLeft(st, b, `booth:o${b.booth}`) };
    const c = cottageOf(st, hh.id);
    if (c) return { what: 'cottage', step: c.steps[c.open].kind, hoursLeft: hoursLeft(st, c, `booth:f${f.id}`) };
    if (stoneUnderWay(st, hh, f)) {
      const step = st.plans.households.get(hh.id).build,
        heap = Stores.heldOf(hh, 'stone') >= BUILD.foundationStone,
        j = st.jobs.get(`raise:f${f.id}`);
      const done = j ? doneOf(st, j, BUILD.foundationHours) : 0;
      return { what: 'stone', step: heap ? 'raise' : step.kind, hoursLeft: BUILD.foundationHours - done };
    }
    if (Projects.underWay(st, hh.id, 'barn')) {
      const p = Projects.projectsOf(st, 'household', hh.id).find((q) => q.what === 'barn'),
        s = p.steps[p.open];
      return { what: 'barn', step: s.kind, hoursLeft: hoursLeft(st, p, `${s.kind}:f${f.id}`) };
    }
    return null;
  }
  // ---- why a rung cannot be begun now, in its own checks' words (null: it can) ----
  const own = (st, hh, f) => (!hh || f.household !== hh.id ? `farm ${f.id} has no household of its own` : null);
  const busy = (st, hh) => {
    const p = Projects.ownOf(st, hh.id);
    return p ? `household ${hh.id} has a ${p.what} under way` : null;
  };
  const WHY = {
    camp: () => 'a camp is not built',
    // the camp's head places the farmstead (sim/camp, the build menu's farmstead); a booth farm with none (rotted) stakes one beside the house as any pawn
    // may (sim/building raiseBoothWhy), unless one is staked there
    booth: (st, hh, f) => {
      if (own(st, hh, f)) return own(st, hh, f);
      if (f.camp === true) return st.player ? BUILDS.farmstead.why(st, hh.holder) : campWhy(st, hh.holder);
      const b = homeStake(st, hh, f);
      if (b) return `a booth is staked on tile ${b.tile}`;
      let why = `there is no open ground beside tile ${f.house} for the booth`;
      for (let d = 0; d < 6; d++) {
        const n = st.w.nb[f.house * 6 + d];
        if (n < 0) continue;
        const w = raiseBoothWhy(st, hh.holder, n);
        if (w === null) return null;
        why = w;
      }
      return why;
    },
    // a cottage is begun on a booth farm whose household has none planned (sim/cottageplan cottagePlan)
    cottage: (st, hh, f) =>
      own(st, hh, f) ||
      (!f.booth
        ? `${f.name} has a cottage`
        : cottageOf(st, hh.id)
          ? `household ${hh.id} has a cottage under way`
          : null),
    // the stone foundation's step (sim/building buildStep): a cottage on the ground, no land project under way, none begun
    stone: (st, hh, f) =>
      own(st, hh, f) ||
      (f.booth
        ? `${f.name} has no cottage yet`
        : f.grade !== 'ground'
          ? `the house at ${f.name} stands on stone`
          : stoneUnderWay(st, hh, f)
            ? `household ${hh.id} has a stone foundation under way`
            : busy(st, hh)),
  };
  const OUT_WHY = { barn: (st, hh, f) => own(st, hh, f) || barnWhy(st, hh) };
  // Sim.farmView(st, farmId): plain data for the page, writing nothing: {rung, building (null, or {what, step, hoursLeft}), next: [{what,
  // needs, ok, why}] (the rungs built from the one standing), outbuildings: [{what, built, ok, why}]}; null for no such farm.
  function farmView(st, id) {
    const f = st.farmsteads[id];
    if (!f) return null;
    const hh = householdOf(st, f),
      rung = rungOf(st, f);
    const next = Object.keys(RUNGS)
      .filter((k) => RUNGS[k].from === rung)
      .map((what) => {
        const why = WHY[what](st, hh, f);
        return { what, needs: { ...RUNGS[what].needs }, ok: why === null, why };
      });
    const outbuildings = Object.keys(OUTBUILDINGS).map((what) => {
      const built = !!f[what],
        why = built ? `${f.name} has a ${what}` : OUT_WHY[what](st, hh, f);
      return { what, built, ok: why === null, why };
    });
    return { rung, building: building(st, hh, f), next, outbuildings };
  }
  return { RUNGS, OUTBUILDINGS, rungOf, farmView };
})();
