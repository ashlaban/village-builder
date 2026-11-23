// @sys sim/allotment: who gets a plot (VB-032, VB-142, VB-646): the village's pick by its custom `newLand`, a household's heir's, the
// allotment told, a cleared plot allotted afresh at each moving round and given up when nobody comes; and the moving round's plots, each who
// waits asking for one (startPlots); it hears sim/expansion's plots cleared and handed to the village (VB-1475)
VB['sim/allotment'] = (() => {
  const { issue } = VB['sim/commands'];
  const { YEAR } = VB['sim/rules'];
  const { on } = VB['sim/events'];
  const { landed, mayHoldFarm, contribute } = VB['sim/holding'];
  const { log, fullName, spouseOf, settlementIdOf, personEvent, practice } = VB['sim/records'];
  const { villageOf } = VB['sim/cottageplan'];
  const { livePlots, activePlots, building, cottageAt, findSite, startPlot, handToVillage, releasePlot, MAX_PLOTS } =
    VB['sim/expansion'];
  const VACANT_YEARS = 2; // moving rounds a cleared plot waits for someone to have it before the village gives it up (VB-646)
  // A plot already waits for the pawn, or for their spouse, until a cottage stands on it (VB-032): no second plot.
  function hasPlot(st, id) {
    const sp = spouseOf(st, id);
    const mine = (p) => (p.open < 1 ? p.intended === id : p.to === id || (sp !== null && p.to === sp));
    const built = (p) => p.holder === id || (sp !== null && p.holder === sp);
    return st.villages.some((v) => v.plots.some(built) || livePlots(st, v).some(mine));
  }
  // At the moving round: the caller filters out farm claimants; two plots are cleared at a time per village. Each who waits, in turn,
  // asks for a plot at the site the village would clear next (`ask`: the round's, the basis `land` of sim/farmclaims, due at once;
  // VB-692; by default the plot is begun); none found, the village stops. One who holds an open offer about its future takes part only in that offer's step.
  function startPlots(st, mayStart = () => true, ask = (v, id, site) => startPlot(st, v, id, null, site)) {
    for (const v of st.villages) {
      reallot(st, v);
      const waiting = st.demand.filter(
        (id) =>
          st.pawns[id].alive &&
          settlementIdOf(st, st.pawns[id]) === v.id &&
          mayStart(id) &&
          !hasPlot(st, id) &&
          (st.pawns[id].ask === undefined || st.pawns[id].ask === null),
      );
      for (const id of waiting) {
        if (activePlots(st, v).filter((p) => p.holder.type === 'village').length >= MAX_PLOTS) break;
        if (hasPlot(st, id)) continue;
        const site = findSite(st, v);
        if (!site) break;
        ask(v, id, site);
      }
    }
  }
  // A village's plot cleared (or roofed) with nobody to have it waits for the one the round finds then (VB-646): at each moving round it is
  // allotted afresh, to one then waiting; the first round that finds it unclaimed stamps `vacant`, and once VACANT_YEARS rounds have passed
  // unclaimed the village gives the ground back (releasePlot). The wait is the rounds in which someone might come for it.
  function reallot(st, v) {
    for (const plot of [...livePlots(st, v)]) {
      if (plot.open < 1 || plot.to !== null || plot.by !== undefined) continue;
      const pick = allot(st, v, plot);
      if (pick !== null) {
        plot.to = pick;
        delete plot.vacant;
        allotted(st, v, plot);
        if (cottageAt(plot) === 3)
          issue(st, {
            actor: null,
            verb: 'finishCottage',
            target: plot.plot,
            args: { village: v.id },
            source: 'construction',
          });
      } else if (plot.vacant === undefined) plot.vacant = st.t;
      else if (st.t - plot.vacant >= VACANT_YEARS * YEAR) releasePlot(st, v, plot);
    }
  }
  // The pawn, or their spouse, is already to have a cleared plot whose cottage is not yet built.
  function awaitsCottage(st, id) {
    const sp = spouseOf(st, id);
    return st.villages.some((u) =>
      livePlots(st, u).some((p) => building(p) && (p.to === id || (sp !== null && p.to === sp))),
    );
  }
  // The village's pick among those still waiting, by `village` rule: married couples first, then by age, single adults once no couple waits.
  // A pawn with a farm already (landed), who holds a cleared plot, or is meant to have another still being cleared, is not allotted a second
  // (VB-142): the way `plot` of sim/holding's table, whose bar `plot` this module gives.
  contribute('plot', hasPlot); // a cottage awaited is a plot hasPlot finds
  const open = (st, id) => mayHoldFarm(st, id, 'plot');
  function byVillage(st, v, ids) {
    const live = ids.filter((id) => st.pawns[id].alive && open(st, id));
    const couple = (id) => {
      const sp = spouseOf(st, id);
      return sp !== null && st.pawns[sp].alive ? 0 : 1;
    };
    live.sort((a, b) => couple(a) - couple(b) || st.pawns[a].born - st.pawns[b].born || a - b);
    return live.length ? live[0] : null;
  }
  // A household's plot for its heir (VB-255) goes to the heir it was cleared for while that pawn is alive and still without a farm; else
  // to nobody (the cottage stands empty), since the household built it for its own.
  const heirOpen = (st, plot) => (st.pawns[plot.intended].alive && open(st, plot.intended) ? plot.intended : null);
  function allot(st, v, plot) {
    const waiting = st.demand.filter((id) => settlementIdOf(st, st.pawns[id]) === v.id);
    const rule = practice(st, v.id).newLand,
      worked = Object.keys(plot.hours)
        .map(Number)
        .filter((id) => st.pawns[id].alive && open(st, id));
    let pick = null;
    if (rule === 'intended' && st.pawns[plot.intended].alive && open(st, plot.intended)) pick = plot.intended;
    else if (rule === 'labour' && worked.length) {
      worked.sort((a, b) => plot.hours[b] - plot.hours[a] || st.pawns[a].born - st.pawns[b].born || a - b);
      pick = worked[0];
    }
    if (pick === null) pick = byVillage(st, v, [plot.intended, ...waiting]);
    return pick;
  }
  // A plot's tiles are cleared (sim/expansion): a household's goes to the heir it was cleared for, or passes to the village; the village's
  // as it allots.
  on('plotCleared', (st, { plot }) => {
    const v = st.villages[villageOf(plot)];
    if (plot.by !== undefined) {
      plot.to = heirOpen(st, plot);
      if (plot.to === null) return handToVillage(st, plot, 'the heir it was cleared for cannot take it');
    } else plot.to = allot(st, v, plot);
    allotted(st, v, plot);
  });
  // A household's plot passed to its village (sim/expansion, handToVillage): cleared, it goes to the pawn it was to go to while that one can
  // still take it, else as the village allots its plots.
  on('plotPassed', (st, { plot }) => {
    const v = st.villages[villageOf(plot)];
    if (plot.open >= 1 && !(plot.to !== null && st.pawns[plot.to].alive && !landed(st, plot.to))) {
      plot.to = null;
      plot.to = allot(st, v, plot);
      allotted(st, v, plot);
    }
  });
  // A cleared plot's allotment told: to nobody, or to plot.to.
  function allotted(st, v, plot) {
    if (plot.to === null) {
      log(st, `${v.name} has cleared a new plot; nobody is left to claim it.`, { kind: 'plot', village: v.id });
      return;
    }
    personEvent(st, plot.to, 'plot', `Was allotted a cleared plot in ${v.name}`, false); // recorded below
    log(st, `${v.name} has cleared a new plot, and ${fullName(st.pawns[plot.to])} is to have it.`, {
      kind: 'plot',
      pawn: plot.to,
      village: v.id,
    });
  }
  return { hasPlot, awaitsCottage, startPlots };
})();
