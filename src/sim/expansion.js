// @sys sim/expansion: clearing a new plot for those who want to move out, and building its cottage: trigger, site, jobs, progress and who gets it;
// a plot under way is a project plan of its village (sim/plans, VB-123), a plot built a record in village.plots
VB['sim/expansion'] = (() => {
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd);
  const { B } = VB['gen'];
  const { fertility, farmable, FIELDS, BUILD, ECON } = VB['sim/rules'];
  const Stores = VB['sim/stores'], Projects = VB['sim/projects'], { emit } = VB['sim/events'];
  const { bfs, hexSteps, cutsOff, rimFull } = VB['sim/hex'];
  const { walkable, costChanged } = VB['sim/routes'];
  const { log, fullName, spouseOf, isHolder, settlementIdOf, personEvent, practice, atFarm } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { freeFor, woodTaken } = VB['sim/territory'];
  const { clearTile } = VB['sim/forest'];
  const { BREAK_HOURS, clearHours, builtTiles } = VB['sim/fields'];
  const { FIELD_REACH, nextTo } = VB['sim/layout'];
  const COTTAGE = ['foundation', 'walls', 'roof'], COTTAGE_HOURS = { foundation: 30, walls: 60, roof: 30 }; // stages in order; hours as in KINDS
  const MAX_PLOTS = 2, REACH = 6, FELL_HOURS = 10, GRUB_HOURS = 6;
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // @state village.plots[]: the village's plots built, {id, village, intended, holder (who moved in), started, farmstead, tiles: [{tile, kind
  //   'house' | 'field'}]}, appended when the cottage's household moves in (sim/cottage). A plot under way is a project plan of its village
  //   (st.plans.projects; a village's only kind of project), {..., what: 'plot', plot (its number in the village: the plots built and under
  //   way before it), intended, to (the pawn it is allotted to once cleared, or null), hours ({pawn: hours worked on it}), started, steps}:
  //   the steps are its clearing, of several places (each {tile, kind 'house' | 'field', steps (fell, grub, clear, break), i, fresh}, one
  //   task a place, worked side by side), then the cottage's stages at the house ({kind, place, hours, done (hours worked)}; the walls also
  //   `wood`, the timber brought to the site, which nothing else may take: VB-328).
  const livePlots = (st, v) => Projects.projectsOf(st, 'village', v.id);
  const tilesOf = (p) => (p.steps ? p.steps[0].places : p.tiles);
  const activePlots = (st, v) => livePlots(st, v).filter((p) => p.open < 1);
  const building = (p) => p.open >= 1 && p.to !== null;
  // The cottage's stage the plot stands at (as COTTAGE's index; 3 once the roof is on), or -1 while it is cleared.
  const cottageAt = (p) => (p.open < 1 ? -1 : p.open - 1 + (p.steps[p.open].done >= p.steps[p.open].hours && p.open === p.steps.length - 1 ? 1 : 0));
  // A site's walls wait until BUILD.timber loads of wood lie there (VB-328; site: a plot, or a booth).
  const waitsForTimber = (site, i) => COTTAGE[i] === 'walls' && (site.wood || 0) < BUILD.timber;
  const stepsFor = (w, tile, kind) => [...wooded(w, tile) ? ['fell', 'grub'] : [], 'clear', ...kind === 'field' ? ['break'] : []];
  const stepHours = (st, tr) => {
    const s = tr.steps[tr.i];
    return s === 'fell' ? FELL_HOURS : s === 'grub' ? GRUB_HOURS : s === 'clear' ? clearHours(st, tr.tile) : BREAK_HOURS;
  };
  // A house tile and one field tile within REACH steps of the green: the village's outland or wilderness (sim/territory), passable, off the
  // rivers, in the village's region or one touching it. The house grows on the village (it may touch other houses, never a field); the field
  // lies 2 to FIELD_REACH steps from it, next to no house or green (VB-113); and the farm has room (roomAt). Null when there is no room.
  // Room for a farm whose house is h (VB-154): free farmable tiles within FIELD_REACH walking steps of h, unused and free for village vid
  // (its outland or wilderness; vid null: wilderness only, for a new village; sim/territory), that `taken` does not exclude; counted up to
  // FIELDS.room. A farm needs FIELDS.room of them besides its first field for more fields, meadow and pasture.
  function roomAt(st, h, taken = () => false, vid = null) {
    const w = st.w; let n = 0;
    for (const [t] of bfs(w, h, FIELD_REACH, walkable(w)).dist) {
      if (farmable(w, t) && freeFor(st, t, vid) && !st.used.has(t) && !taken(t) && ++n >= FIELDS.room) break;
    }
    return n;
  }
  function findSite(st, v) {
    const w = st.w, vreg = w.region[v.center], cand = [], built = builtTiles(st), fields = new Set();
    for (const f of st.farmsteads) {
      for (const fd of f.fields) fields.add(fd.tile);
      const s = f.household !== null && Projects.openOf(st, 'household', f.household); if (s) fields.add(s.place); // its project (sim/projects)
    }
    for (const u of st.villages) for (const p of [...u.plots || [],
      ...livePlots(st, u)]) for (const tr of tilesOf(p)) if (tr.kind === 'field') fields.add(tr.tile);
    const near = (t) => {
      if (w.region[t] === vreg) return true;
      for (let k = 0; k < 6; k++) { const n = w.nb[t * 6 + k]; if (n >= 0 && w.region[n] === vreg) return true; }
      return false;
    };
    for (const [t, d] of bfs(w, v.center, REACH, walkable(w)).dist) {
      if (d < 1 || !freeFor(st, t, v.id) || st.used.has(t) || v.wood.includes(t) || w.river[t]) continue;
      if (w.biome[t] === B.MOUNTAIN || w.biome[t] === B.SNOW || !near(t)) continue;
      cand.push([t, d]);
    }
    const dist = new Map(cand), fieldScore = (t) => fertility(w, t) - 0.5 * w.stones[t] / 255 - 0.15 * dist.get(t);
    const fieldOk = (t) => farmable(w, t) && !wooded(w, t) && !nextTo(w, t, built);
    const fieldCandidates = cand.filter(([t]) => fieldOk(t)).map(([t]) => [t, fieldScore(t)]);
    const walk = walkable(w), house = (j) => w.dev[j] === 3, shut = (j) => j < 0 || !walk(j) || house(j);
    let best = null, bs = -Infinity;
    for (const [h, d] of cand) {
      if (nextTo(w, h, fields)) continue;
      // a house may not close a way, since no route crosses one, nor close the green in (VB-396)
      if (cutsOff(w, h, shut, house) || (v.green && rimFull(w, v.center, h, house))) continue;
      let f = -1, fs = -Infinity;
      for (const [t, score] of fieldCandidates) {
        const steps = hexSteps(w, h, t);
        if (steps < 2 || steps > FIELD_REACH) continue;
        const sc = score - 0.15 * steps;
        if (sc > fs) { fs = sc; f = t; }
      }
      if (f >= 0 && roomAt(st, h, (t) => t === f || t === h || fields.has(t) || built.has(t), v.id) < FIELDS.room) continue;
      let touch = 0; for (let k = 0; k < 6; k++) if (built.has(w.nb[h * 6 + k])) touch++;
      const s = -0.2 * d - (wooded(w, h) ? 0.5 : 0) + (f >= 0 ? 1 : 0) + 0.3 * Math.min(touch, 3);
      if (s > bs) { bs = s; best = { house: h, field: f }; }
    }
    return !best || best.field < 0 ? null : best;
  }
  function startPlot(st, v, intended) {
    const site = findSite(st, v); if (!site) return false;
    const w = st.w, tiles = [{ tile: site.house, kind: 'house' }, { tile: site.field, kind: 'field' }];
    for (const tr of tiles) {
      tr.steps = stepsFor(w, tr.tile, tr.kind); tr.i = 0;
      setOwner(st, tr.tile, { type: 'village', id: v.id }); st.used.add(tr.tile); woodTaken(st, tr.tile);
      if (tr.kind === 'house') { w.dev[tr.tile] = 3; costChanged(st, tr.tile); } // the house's ground: routes go round it from now on
    }
    // its project plan, made by sim/plans: the clearing of its tiles, then the cottage's stages
    const cottage = COTTAGE.map((kind) => ({ kind, place: site.house, hours: COTTAGE_HOURS[kind], done: 0, ...kind === 'walls' ? { wood: 0 } : {} }));
    emit(st, 'projectBegun', { type: 'village', id: v.id, project: { what: 'plot', plot: v.plots.length + livePlots(st, v).length, intended, to: null,
      hours: {}, started: st.t, steps: [{ kind: 'clear', places: tiles }, ...cottage] } });
    st.visualDirty = true;
    log(st, `${v.name} sets out to clear a plot for ${fullName(st.pawns[intended])}.`, { kind: 'plotStarted', pawn: intended, village: v.id });
    return true;
  }
  // A plot already waits for the pawn, or for their spouse, until a cottage stands on it (VB-032): no second plot.
  function hasPlot(st, id) {
    const sp = spouseOf(st, id);
    const mine = (p) => (p.open < 1 ? p.intended === id : p.to === id || (sp !== null && p.to === sp));
    const built = (p) => p.holder === id || (sp !== null && p.holder === sp);
    return st.villages.some((v) => v.plots.some(built) || livePlots(st, v).some(mine));
  }
  // At the moving round: the caller filters out farm claimants; two plots are cleared at a time per village.
  function startPlots(st, mayStart = () => true) {
    for (const v of st.villages) {
      const waiting = st.demand.filter((id) => st.pawns[id].alive && settlementIdOf(st, st.pawns[id]) === v.id
        && mayStart(id) && !hasPlot(st, id));
      for (const id of waiting) {
        if (activePlots(st, v).length >= MAX_PLOTS) break;
        if (hasPlot(st, id)) continue;
        if (!startPlot(st, v, id)) break;
      }
    }
  }
  // The open jobs of all active plots: one per tile, for the tile's current step. [key, kind, site, extra]
  function plotJobs(st) {
    const out = [];
    for (const v of st.villages) for (const plot of activePlots(st, v)) for (const tr of tilesOf(plot)) {
      if (tr.i >= tr.steps.length) continue;
      out.push([`plot:v${v.id}.${plot.plot}.${tr.tile}`, tr.steps[tr.i], tr.tile, { plot, tr, hours: stepHours(st, tr) }]);
    }
    for (const v of st.villages) for (const plot of livePlots(st, v).filter(building)) {
      const k = plot.steps[plot.open], key = `plot:v${v.id}.${plot.plot}.cottage`, live = st.jobs.get(key);
      if (cottageAt(plot) >= COTTAGE.length) continue; // the roof is on
      if (live) k.done = live.done; // hours worked on the open stage persist while the job is dropped and posted again
      if (waitsForTimber(plot.steps[2], plot.open - 1)) continue; // the walls wait for their timber (sim/building)
      out.push([key, k.kind, k.place, { plot, cottage: true, done: k.done, hours: k.hours }]);
    }
    return out;
  }
  // 0..1: finished steps of the plot's tiles, with the hours already worked on the open ones.
  function plotProgress(st, plot) {
    let total = 0, got = 0;
    for (const tr of tilesOf(plot)) {
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
    return st.villages.some((u) => livePlots(st, u).some((p) => building(p) && (p.to === id || (sp !== null && p.to === sp))));
  }
  // The village's pick among those still waiting, by `village` rule: married couples first, then by age, single adults once no couple waits.
  // A pawn with a farm already: a holder, or married to one (who lives on the spouse's farm; VB-153).
  const landed = (st, id) => { const sp = spouseOf(st, id); return isHolder(st, id) || (sp !== null && isHolder(st, sp)); };
  // A pawn who holds a cleared plot, or is meant to have another still being cleared, is not allotted a second (VB-142).
  const open = (st, id) => !landed(st, id) && !awaitsCottage(st, id) && !hasPlot(st, id);
  function byVillage(st, v, ids) {
    const live = ids.filter((id) => st.pawns[id].alive && open(st, id));
    const couple = (id) => { const sp = spouseOf(st, id); return sp !== null && st.pawns[sp].alive ? 0 : 1; };
    live.sort((a, b) => couple(a) - couple(b) || st.pawns[a].born - st.pawns[b].born || a - b);
    return live.length ? live[0] : null;
  }
  function allot(st, v, plot) {
    const waiting = st.demand.filter((id) => settlementIdOf(st, st.pawns[id]) === v.id);
    const rule = practice(st, v.id).newLand, worked = Object.keys(plot.hours).map(Number)
      .filter((id) => st.pawns[id].alive && open(st, id));
    let pick = null;
    if (rule === 'intended' && st.pawns[plot.intended].alive && open(st, plot.intended)) pick = plot.intended;
    else if (rule === 'labour' && worked.length) {
      worked.sort((a, b) => plot.hours[b] - plot.hours[a] || st.pawns[a].born - st.pawns[b].born || a - b); pick = worked[0];
    }
    if (pick === null) pick = byVillage(st, v, [plot.intended, ...waiting]);
    return pick;
  }
  // A tile's step is done: stumps stay after felling (its trees the plot's wood), grubbing turns the wood into meadow, clearing takes the
  // stones, breaking turns the soil.
  function finishStep(st, j) {
    if (j.cottage) return finishCottageStage(st, j);
    const w = st.w, { plot, tr } = j, step = tr.steps[tr.i], v = st.villages[plot.holder.id], walls = plot.steps[2];
    if (step === 'fell') { // the trees felled are the plot's wood, 3 loads a tree, kept for its walls (VB-328)
      walls.wood += Math.floor(w.trees[tr.tile]) * ECON.woodPerTrip;
      w.trees[tr.tile] = 0; st.regrow.delete(tr.tile); st.treeDirty.add(tr.tile);
    }
    else if (step === 'grub') clearTile(st, tr.tile);
    else if (step === 'clear') w.stones[tr.tile] = 0;
    else if (tr.kind === 'field') { tr.fresh = !w.dev[tr.tile]; w.dev[tr.tile] = 1; } // ground never farmed starts fresh (VB-149)
    tr.i++; st.biomeDirty.add(tr.tile); st.visualDirty = true;
    if (!tilesOf(plot).every((q) => q.i >= q.steps.length)) return;
    emit(st, 'stepDone', { type: 'village', id: v.id, plan: plot }); // its tiles cleared: the cottage's first stage opens (sim/plans)
    plot.to = allot(st, v, plot);
    if (plot.to === null) { log(st, `${v.name} has cleared a new plot; nobody is left to claim it.`, { kind: 'plot', village: v.id }); return; }
    personEvent(st, plot.to, 'plot', `Was allotted a cleared plot in ${v.name}`, false); // recorded below
    log(st, `${v.name} has cleared a new plot, and ${fullName(st.pawns[plot.to])} is to have it.`, { kind: 'plot', pawn: plot.to, village: v.id });
  }
  // A cottage stage is done: the last one hands the plot to sim/cottage, which makes the farmstead and household.
  function finishCottageStage(st, j) {
    const plot = j.plot, k = plot.steps[plot.open]; if (k.kind === 'walls') k.wood -= BUILD.timber; // the walls took their timber (VB-328)
    st.biomeDirty.add(k.place); st.visualDirty = true;
    if (plot.open < plot.steps.length - 1) { emit(st, 'stepDone', { type: 'village', id: plot.holder.id, plan: plot }); return; } // the next stage
    k.done = k.hours; // the roof is on: the household moves in, and the plan is finished (sim/cottage)
    issue(st, { actor: null, verb: 'finishCottage', target: plot.plot, args: { village: plot.holder.id }, source: 'construction' });
  }
  // ---- the cottage of a household living in a booth (settlers, sim/settle): the same stages, as the household's own work ----
  // The open stage of farm f's cottage while f.booth stands: [key, kind, extra], or null. Hours on the stage persist while its job is dropped.
  function boothJob(st, f) {
    const k = f.booth; if (!k) return null;
    const key = `booth:f${f.id}`, live = st.jobs.get(key);
    if (live) k.done = live.done;
    if (waitsForTimber(k, k.i)) return null;
    return [key, COTTAGE[k.i], { farm: f, booth: true, done: k.done, hours: COTTAGE_HOURS[COTTAGE[k.i]] }];
  }
  // A stage of a booth's cottage is done; with the roof on, the household leaves the booth for its cottage.
  function finishBoothStage(st, j) {
    const f = j.farm, k = f.booth; if (!k) return;
    if (COTTAGE[k.i] === 'walls') k.wood -= BUILD.timber; // the walls took their timber (VB-328)
    k.i++; k.done = 0; st.biomeDirty.add(f.house); st.visualDirty = true;
    if (k.i < COTTAGE.length) return;
    const hh = f.household !== null ? st.households[f.household] : null;
    if (hh && k.wood > 0) Stores.put(st, hh, 'wood', k.wood, 'timber'); // timber left over goes to the woodpile
    f.booth = null;
    log(st, `The new cottage at ${f.name} in ${st.villages[f.village].name} has its roof${hh ? `; ${fullName(st.pawns[hh.holder])} leaves the booth` : ''}.`, {
      kind: 'cottage', pawn: hh ? hh.holder : null, ...atFarm(f) });
  }
  return {
    COTTAGE, building, livePlots, tilesOf, cottageAt, roomAt, findSite, hasPlot, awaitsCottage, startPlots, plotJobs, plotProgress, finishStep, activePlots,
      boothJob,
    finishBoothStage,
  };
})();
