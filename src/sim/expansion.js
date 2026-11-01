// @sys sim/expansion: clearing a new plot for those who want to move out, and building its cottage: trigger, site, jobs, progress and who gets it
VB['sim/expansion'] = (() => {
  const { B } = VB['gen'];
  const { fertility, farmable, FIELDS } = VB['sim/rules'];
  const { bfs, hexSteps } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { log, fullName, spouseOf, isHolder, settlementIdOf, personEvent, practice } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { clearTile } = VB['sim/forest'];
  const { BREAK_HOURS, clearHours, builtTiles } = VB['sim/fields'];
  const { FIELD_REACH, nextTo } = VB['sim/layout'];
  const COTTAGE = ['foundation', 'walls', 'roof'], COTTAGE_HOURS = { foundation: 30, walls: 60, roof: 30 }; // stages in order; hours as in KINDS
  const MAX_PLOTS = 2, REACH = 6, FELL_HOURS = 10, GRUB_HOURS = 6;
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // Whether the pawn may claim an empty farm instead of waiting for a plot. Null until claiming empty farms is built (VB-033).
  const claimableFarm = (st, pawnId) => null; // eslint-disable-line no-unused-vars
  const activePlots = (v) => v.plots.filter((p) => !p.done);
  const building = (p) => p.done && p.holder !== null && p.cottage && !p.built;
  const stepsFor = (w, tile, kind) => [...wooded(w, tile) ? ['fell', 'grub'] : [], 'clear', ...kind === 'field' ? ['break'] : []];
  const stepHours = (st, tr) => {
    const s = tr.steps[tr.i];
    return s === 'fell' ? FELL_HOURS : s === 'grub' ? GRUB_HOURS : s === 'clear' ? clearHours(st, tr.tile) : BREAK_HOURS;
  };
  // A house tile and one field tile within REACH steps of the green: unowned, passable, off the rivers, in the village's region or one touching it.
  // The house grows on the village (it may touch other houses, never a field); the field lies 2 to FIELD_REACH steps from it, next to
  // no house or green (VB-113); and the farm has room (roomAt). Null when there is no room.
  // Room for a farm whose house is h (VB-154): free farmable tiles within FIELD_REACH walking steps of h, unowned and unused, that `taken` does
  // not exclude; counted up to FIELDS.room. A farm needs FIELDS.room of them besides its first field for more fields, meadow and pasture.
  function roomAt(st, h, taken = () => false) {
    const w = st.w; let n = 0;
    for (const [t] of bfs(w, h, FIELD_REACH, walkable(w)).dist) {
      if (farmable(w, t) && st.owner[t] === 0 && !st.used.has(t) && !taken(t) && ++n >= FIELDS.room) break;
    }
    return n;
  }
  function findSite(st, v) {
    const w = st.w, vreg = w.region[v.center], cand = [], built = builtTiles(st), fields = new Set();
    for (const f of st.farmsteads) { for (const fd of f.fields) fields.add(fd.tile); if (f.project) fields.add(f.project.tile); }
    for (const u of st.villages) for (const p of u.plots || []) for (const tr of p.tiles) if (tr.kind === 'field') fields.add(tr.tile);
    const near = (t) => {
      if (w.region[t] === vreg) return true;
      for (let k = 0; k < 6; k++) { const n = w.nb[t * 6 + k]; if (n >= 0 && w.region[n] === vreg) return true; }
      return false;
    };
    for (const [t, d] of bfs(w, v.center, REACH, walkable(w)).dist) {
      if (d < 1 || st.owner[t] !== 0 || st.used.has(t) || t === v.commonsWood || w.river[t]) continue;
      if (w.biome[t] === B.MOUNTAIN || w.biome[t] === B.SNOW || !near(t)) continue;
      cand.push([t, d]);
    }
    const dist = new Map(cand), fieldScore = (t) => fertility(w, t) - 0.5 * w.stones[t] / 255 - 0.15 * dist.get(t);
    const fieldOk = (t) => farmable(w, t) && !wooded(w, t) && !nextTo(w, t, built);
    let best = null, bs = -Infinity;
    for (const [h, d] of cand) {
      if (nextTo(w, h, fields)) continue;
      let f = -1, fs = -Infinity;
      for (const [t] of cand) {
        const steps = hexSteps(w, h, t);
        if (steps < 2 || steps > FIELD_REACH || !fieldOk(t)) continue;
        const sc = fieldScore(t) - 0.15 * steps;
        if (sc > fs) { fs = sc; f = t; }
      }
      if (f >= 0 && roomAt(st, h, (t) => t === f || t === h || fields.has(t) || built.has(t)) < FIELDS.room) continue;
      let touch = 0; for (let k = 0; k < 6; k++) if (built.has(w.nb[h * 6 + k])) touch++;
      const s = -0.2 * d - (wooded(w, h) ? 0.5 : 0) + (f >= 0 ? 1 : 0) + 0.3 * Math.min(touch, 3);
      if (s > bs) { bs = s; best = { house: h, field: f }; }
    }
    return !best || best.field < 0 ? null : best;
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
    for (const v of st.villages) for (const plot of v.plots.filter(building)) {
      const k = plot.cottage, key = `plot:v${v.id}.${plot.id}.cottage`, live = st.jobs.get(key);
      if (live) k.done = live.done; // hours worked on the open stage persist while the job is dropped and posted again
      out.push([key, COTTAGE[k.i], plot.tiles[0].tile, { plot, cottage: true, done: k.done, hours: COTTAGE_HOURS[COTTAGE[k.i]] }]);
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
  // The pawn, or their spouse, is already to have a cleared plot whose cottage is not yet built.
  function awaitsCottage(st, id) {
    const sp = spouseOf(st, id);
    return st.villages.some((u) => u.plots.some((p) => building(p) && (p.holder === id || (sp !== null && p.holder === sp))));
  }
  // The village's pick among those still waiting, by `village` rule: married couples first, then by age, single adults once no couple waits.
  // A pawn with a farm already: a holder, or married to one (who lives on the spouse's farm; VB-153).
  const landed = (st, id) => { const sp = spouseOf(st, id); return isHolder(st, id) || (sp !== null && isHolder(st, sp)); };
  function byVillage(st, v, ids) {
    const live = ids.filter((id) => st.pawns[id].alive && !landed(st, id) && !awaitsCottage(st, id));
    const couple = (id) => { const sp = spouseOf(st, id); return sp !== null && st.pawns[sp].alive ? 0 : 1; };
    live.sort((a, b) => couple(a) - couple(b) || st.pawns[a].born - st.pawns[b].born || a - b);
    return live.length ? live[0] : null;
  }
  function allot(st, v, plot) {
    const waiting = st.demand.filter((id) => settlementIdOf(st, st.pawns[id]) === v.id);
    const rule = practice(st, v.id).newLand, worked = Object.keys(plot.hours).map(Number)
      .filter((id) => st.pawns[id].alive && !awaitsCottage(st, id) && !landed(st, id));
    let pick = null;
    if (rule === 'intended' && st.pawns[plot.intended].alive && !landed(st, plot.intended)
      && !awaitsCottage(st, plot.intended)) pick = plot.intended;
    else if (rule === 'labour' && worked.length) {
      worked.sort((a, b) => plot.hours[b] - plot.hours[a] || st.pawns[a].born - st.pawns[b].born || a - b); pick = worked[0];
    }
    if (pick === null) pick = byVillage(st, v, [plot.intended, ...waiting]);
    return pick;
  }
  // A tile's step is done: stumps stay after felling, grubbing turns the wood into meadow, clearing takes the stones, breaking turns the soil.
  function finishStep(st, j) {
    if (j.cottage) return finishCottageStage(st, j);
    const w = st.w, { plot, tr } = j, step = tr.steps[tr.i], v = st.villages[plot.village];
    if (step === 'fell') { w.trees[tr.tile] = 0; st.regrow.delete(tr.tile); st.treeDirty.add(tr.tile); }
    else if (step === 'grub') clearTile(st, tr.tile);
    else if (step === 'clear') w.stones[tr.tile] = 0;
    else if (tr.kind === 'field') { tr.fresh = !w.dev[tr.tile]; w.dev[tr.tile] = 1; } // ground never farmed starts fresh (VB-149)
    tr.i++; st.biomeDirty.add(tr.tile); st.visualDirty = true;
    if (!plot.tiles.every((q) => q.i >= q.steps.length)) return;
    plot.done = true; plot.holder = allot(st, v, plot); plot.cottage = { i: 0, done: 0 }; plot.built = false;
    if (plot.holder === null) { log(st, `${v.name} has cleared a new plot; nobody is left to claim it.`); return; }
    personEvent(st, plot.holder, 'plot', `Was allotted a cleared plot in ${v.name}`);
    log(st, `${v.name} has cleared a new plot, and ${fullName(st.pawns[plot.holder])} is to have it.`);
  }
  // A cottage stage is done: the last one hands the plot to sim/cottage, which makes the farmstead and household.
  function finishCottageStage(st, j) {
    const plot = j.plot; plot.cottage.i++; plot.cottage.done = 0; st.biomeDirty.add(plot.tiles[0].tile); st.visualDirty = true;
    if (plot.cottage.i >= COTTAGE.length) VB['sim/cottage'].finishCottage(st, plot);
  }
  // ---- the cottage of a household living in a booth (settlers, sim/settle): the same stages, as the household's own work ----
  // The open stage of farm f's cottage while f.booth stands: [key, kind, extra], or null. Hours on the stage persist while its job is dropped.
  function boothJob(st, f) {
    const k = f.booth; if (!k) return null;
    const key = `booth:f${f.id}`, live = st.jobs.get(key);
    if (live) k.done = live.done;
    return [key, COTTAGE[k.i], { farm: f, booth: true, done: k.done, hours: COTTAGE_HOURS[COTTAGE[k.i]] }];
  }
  // A stage of a booth's cottage is done; with the roof on, the household leaves the booth for its cottage.
  function finishBoothStage(st, j) {
    const f = j.farm, k = f.booth; if (!k) return;
    k.i++; k.done = 0; st.biomeDirty.add(f.house); st.visualDirty = true;
    if (k.i < COTTAGE.length) return;
    f.booth = null;
    const hh = f.household !== null ? st.households[f.household] : null;
    log(st, `The new cottage at ${f.name} in ${st.villages[f.village].name} has its roof${hh ? `; ${fullName(st.pawns[hh.holder])} leaves the booth` : ''}.`);
  }
  return {
    COTTAGE, building, claimableFarm, roomAt, findSite, hasPlot, startPlots, plotJobs, plotProgress, finishStep, activePlots, boothJob, finishBoothStage,
  };
})();
