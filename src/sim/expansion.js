// @sys sim/expansion: clearing a new plot for those who want to move out: trigger, site, jobs, progress and who gets it
VB['sim/expansion'] = (() => {
  const { B } = VB['gen'];
  const { FERTILITY, farmable } = VB['sim/rules'];
  const { bfs, land } = VB['sim/hex'];
  const { log, fullName, spouseOf, isHolder, settlementIdOf, personEvent, practice } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { clearTile } = VB['sim/forest'];
  const { BREAK_HOURS, clearHours } = VB['sim/fields'];
  const MAX_PLOTS = 2, REACH = 6, FELL_HOURS = 10, GRUB_HOURS = 6;
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // Whether the pawn may claim an empty farm instead of waiting for a plot. Null until claiming empty farms is built (VB-033).
  const claimableFarm = (st, pawnId) => null; // eslint-disable-line no-unused-vars
  const activePlots = (v) => v.plots.filter((p) => !p.done);
  const stepsFor = (w, tile, kind) => [...wooded(w, tile) ? ['fell', 'grub'] : [], 'clear', ...kind === 'field' ? ['break'] : []];
  const stepHours = (st, tr) => {
    const s = tr.steps[tr.i];
    return s === 'fell' ? FELL_HOURS : s === 'grub' ? GRUB_HOURS : s === 'clear' ? clearHours(st, tr.tile) : BREAK_HOURS;
  };
  // A house tile and one field tile within REACH steps of the green: unowned, passable, in the village's region or one touching it.
  // A farmable tile next to the house is preferred; the house may stand next to other houses. Null when there is no room.
  function findSite(st, v) {
    const w = st.w, vreg = w.region[v.center], cand = [];
    const near = (t) => {
      if (w.region[t] === vreg) return true;
      for (let k = 0; k < 6; k++) { const n = w.nb[t * 6 + k]; if (n >= 0 && w.region[n] === vreg) return true; }
      return false;
    };
    for (const [t, d] of bfs(w, v.center, REACH, land(w)).dist) {
      if (d < 1 || st.owner[t] !== 0 || st.used.has(t) || t === v.commonsWood || w.biome[t] === B.MOUNTAIN || w.biome[t] === B.SNOW || !near(t)) continue;
      cand.push([t, d]);
    }
    const dist = new Map(cand), fieldScore = (t) => FERTILITY[w.biome[t]] - 0.5 * w.stones[t] / 255 - 0.15 * dist.get(t);
    const farmableAt = (t) => dist.has(t) && farmable(w, t) && !wooded(w, t);
    let best = null, bs = -Infinity;
    for (const [h, d] of cand) {
      let f = -1, fs = -Infinity;
      for (let k = 0; k < 6; k++) { const n = w.nb[h * 6 + k]; if (n >= 0 && farmableAt(n) && fieldScore(n) > fs) { fs = fieldScore(n); f = n; } }
      const s = -0.2 * d - (wooded(w, h) ? 0.5 : 0) + (f >= 0 ? 1 : 0);
      if (s > bs) { bs = s; best = { house: h, field: f }; }
    }
    if (!best) return null;
    if (best.field < 0) {
      let fs = -Infinity;
      for (const [t] of cand) if (t !== best.house && farmableAt(t) && fieldScore(t) > fs) { fs = fieldScore(t); best.field = t; }
    }
    return best.field < 0 ? null : best;
  }
  function startPlot(st, v, intended) {
    const site = findSite(st, v); if (!site) return false;
    const w = st.w, plot = { id: v.plots.length, village: v.id, intended, hours: {}, done: false, holder: null, started: st.t,
      tiles: [{ tile: site.house, kind: 'house' }, { tile: site.field, kind: 'field' }] };
    for (const tr of plot.tiles) {
      tr.steps = stepsFor(w, tr.tile, tr.kind); tr.i = 0;
      setOwner(st, tr.tile, { type: 'village', id: v.id }); st.used.add(tr.tile);
    }
    v.plots.push(plot); st.visualDirty = true;
    log(st, `${v.name} sets out to clear a plot for ${fullName(st.pawns[intended])}.`);
    return true;
  }
  // A plot already waits for the pawn, or for their spouse, until a cottage stands on it (VB-032): no second plot.
  function hasPlot(st, id) {
    const sp = spouseOf(st, id);
    const mine = (p) => (!p.done ? p.intended === id : p.holder === id || (sp !== null && p.holder === sp));
    return st.villages.some((v) => v.plots.some(mine));
  }
  // At the moving round: villagers who want out and cannot claim an empty farm get a plot cleared, two projects at a time per village.
  function startPlots(st) {
    for (const v of st.villages) {
      const waiting = st.demand.filter((id) => st.pawns[id].alive && settlementIdOf(st, st.pawns[id]) === v.id
        && claimableFarm(st, id) === null && !hasPlot(st, id));
      for (const id of waiting) {
        if (activePlots(v).length >= MAX_PLOTS) break;
        if (hasPlot(st, id)) continue;
        if (!startPlot(st, v, id)) break;
      }
    }
  }
  // The open jobs of all active plots: one per tile, for the tile's current step. [key, kind, site, extra]
  function plotJobs(st) {
    const out = [];
    for (const v of st.villages) for (const plot of activePlots(v)) for (const tr of plot.tiles) {
      if (tr.i >= tr.steps.length) continue;
      out.push([`plot:v${v.id}.${plot.id}.${tr.tile}`, tr.steps[tr.i], tr.tile, { plot, tr, hours: stepHours(st, tr) }]);
    }
    return out;
  }
  // 0..1: finished steps of the plot's tiles, with the hours already worked on the open ones.
  function plotProgress(st, plot) {
    let total = 0, got = 0;
    for (const tr of plot.tiles) {
      total += tr.steps.length; got += tr.i;
      if (tr.i < tr.steps.length) {
        for (const j of st.jobs.values()) if (j.tr === tr) got += Math.min(1, j.done / j.hours);
      }
    }
    return total ? got / total : 1;
  }
  // The village's pick among those still waiting, by `village` rule: married couples first, then by age, single adults once no couple waits.
  function byVillage(st, v, ids) {
    const live = ids.filter((id) => st.pawns[id].alive && !isHolder(st, id));
    const couple = (id) => { const sp = spouseOf(st, id); return sp !== null && st.pawns[sp].alive ? 0 : 1; };
    live.sort((a, b) => couple(a) - couple(b) || st.pawns[a].born - st.pawns[b].born || a - b);
    return live.length ? live[0] : null;
  }
  function allot(st, v, plot) {
    const waiting = st.demand.filter((id) => settlementIdOf(st, st.pawns[id]) === v.id);
    const rule = practice(st, v.id).newLand, worked = Object.keys(plot.hours).map(Number).filter((id) => st.pawns[id].alive);
    let pick = null;
    if (rule === 'intended' && st.pawns[plot.intended].alive && !isHolder(st, plot.intended)) pick = plot.intended;
    else if (rule === 'labour' && worked.length) {
      worked.sort((a, b) => plot.hours[b] - plot.hours[a] || st.pawns[a].born - st.pawns[b].born || a - b); pick = worked[0];
    }
    if (pick === null) pick = byVillage(st, v, [plot.intended, ...waiting]);
    return pick;
  }
  // A tile's step is done: stumps stay after felling, grubbing turns the wood into meadow, clearing takes the stones, breaking turns the soil.
  function finishStep(st, j) {
    const w = st.w, { plot, tr } = j, step = tr.steps[tr.i], v = st.villages[plot.village];
    if (step === 'fell') { w.trees[tr.tile] = 0; st.regrow.delete(tr.tile); st.treeDirty.add(tr.tile); }
    else if (step === 'grub') clearTile(st, tr.tile);
    else if (step === 'clear') w.stones[tr.tile] = 0;
    else if (tr.kind === 'field') w.dev[tr.tile] = 1;
    tr.i++; st.biomeDirty.add(tr.tile); st.visualDirty = true;
    if (!plot.tiles.every((q) => q.i >= q.steps.length)) return;
    plot.done = true; plot.holder = allot(st, v, plot);
    if (plot.holder === null) { log(st, `${v.name} has cleared a new plot; nobody is left to claim it.`); return; }
    personEvent(st, plot.holder, 'plot', `Was allotted a cleared plot in ${v.name}`);
    log(st, `${v.name} has cleared a new plot, and ${fullName(st.pawns[plot.holder])} is to have it.`);
  }
  return { claimableFarm, startPlots, plotJobs, plotProgress, finishStep, activePlots };
})();
