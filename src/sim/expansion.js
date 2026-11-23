// @sys sim/expansion: clearing a new plot for those who want to move out, and posting its cottage's stages: site, jobs, progress, release;
// a plot under way is a project plan of its village (sim/plans, VB-123), a plot built a record in village.plots; who gets a plot, and the
// moving round's plots, are sim/allotment's; the cottage's stages themselves, a plot's and a settler household's, sim/cottageplan's
VB['sim/expansion'] = (() => {
  const { B } = VB['world/biomes'];
  const { doneOf, keptDone } = VB['sim/progress'];
  const { FIELDS, ECON } = VB['sim/rules'],
    { fertility, openGround: farmable, clearable } = VB['sim/crops'];
  const Projects = VB['sim/projects'],
    { emit, on } = VB['sim/events'];
  const { bfs, hexSteps, cutsOff, rimFull } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'],
    { costChanged } = VB['sim/routes'];
  const { log, fullName } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { freeFor, woodTaken } = VB['sim/territory'];
  const { clearTile, fellAll, FELL_HOURS, GRUB_HOURS } = VB['sim/forest'];
  const { thick, clearScrub, tended } = VB['sim/spread'];
  const { BREAK_HOURS, clearHours, builtTiles } = VB['sim/fieldplans'],
    { onField } = VB['sim/fieldwork'],
    { finishFell, finishGrub } = VB['sim/newground'],
    { workStake } = VB['sim/claims'];
  const { FIELD_REACH, FIELD_NEAR, HOUSE, farmedLand, houseScore } = VB['sim/layout'];
  const { COTTAGE, villageOf, wallsOf, timberNeed, waitsForTimber, cottageSteps, finishCottageStage, cottageOf } =
    VB['sim/cottageplan'];
  const Stores = VB['sim/stores'];
  const MAX_PLOTS = 2,
    REACH = 6;
  const wooded = (w, t) => w.biome[t] === B.FOREST || w.biome[t] === B.PINE;
  // @state village.plots[]: the village's plots built, {id, village, intended, holder (who moved in), started, farmstead, tiles: [{tile, kind
  //   'house' | 'field'}]}, appended when the cottage's household moves in (sim/cottage). A plot under way is a project plan of its village
  //   (st.plans.projects; a village's other project is its green, sim/green), {..., what: 'plot', plot (its number in the village: the plots built and under
  //   way before it), intended, to (the pawn it is allotted to once cleared, or null), hours ({pawn: hours worked on it}), started, steps}:
  //   the steps are its clearing, of several places (each {tile, kind 'house' | 'field', steps (fell, grub, clear, break), i, fresh}, one
  //   task a place, worked side by side), then the cottage's stages at the house ({kind, place, hours, done (hours worked)}; the walls also
  //   `wood`, the timber brought to the site, which nothing else may take: VB-328).
  //   A plot for a head's heir (VB-255: a project of the head, sim/aims) is a project plan of the heir's household with the same steps,
  //   and `village` (the village it lies in) and `by` (the household building it); `village` is on every plot made since (a village's
  //   plot without it lies in its holder's village: villageOf). A household's plot whose heir cannot take it, or that the household gives
  //   up or leaves behind as it dissolves, passes to its village as a plot of the village's own (handToVillage), with its tiles, its
  //   work and its timber where they lie.
  // The plots under way in village v: its own (not its green, VB-058), then those its households build for their heirs (VB-255), from the
  // index of the latter (st.plans.projects.heirPlots: VB.count.plotWalk, an entry each).
  function livePlots(st, v) {
    const out = Projects.projectsOf(st, 'village', v.id).filter((p) => p.what === 'plot'),
      H = st.plans && st.plans.projects && st.plans.projects.heirPlots;
    if (H)
      for (const p of H) {
        VB.count.plotWalk++;
        if (p.village === v.id) out.push(p);
      }
    return out;
  }
  const tilesOf = (p) => (p.steps ? p.steps[0].places : p.tiles);
  const activePlots = (st, v) => livePlots(st, v).filter((p) => p.open < 1);
  const building = (p) => p.open >= 1 && p.to !== null;
  // The cottage's stage the plot stands at (as COTTAGE's index; 3 once the roof is on), or -1 while it is cleared.
  const cottageAt = (p) =>
    p.open < 1
      ? -1
      : p.open - 1 + (p.steps[p.open].done >= p.steps[p.open].hours && p.open === p.steps.length - 1 ? 1 : 0);
  // The cottages being built in village v that need timber, for sim/building's trips (VB-328, VB-1407): {key, site, need, dest, owner}, each
  // plot's (the village's, or a household's for its heir, VB-255), its wood on its walls step.
  const plotTimber = (st, v) =>
    livePlots(st, v)
      .filter(building)
      .map((plot) => ({
        key: `timber:v${v.id}.${plot.plot}`,
        site: wallsOf(plot),
        need: timberNeed(plot.open - 1),
        dest: wallsOf(plot).place,
        owner: plot.holder,
      }));
  const stepsFor = (w, tile, kind) => [
    ...(wooded(w, tile) || thick(w, tile) ? ['fell', 'grub'] : []), // thick scrub as forest (VB-091)
    'clear',
    ...(kind === 'field' ? ['break'] : []),
  ];
  const stepHours = (st, tr) => {
    const s = tr.steps[tr.i];
    return s === 'fell'
      ? FELL_HOURS
      : s === 'grub'
        ? GRUB_HOURS
        : s === 'clear'
          ? clearHours(st, tr.tile)
          : BREAK_HOURS;
  };
  // A house tile and one field tile within REACH steps of the green: the village's outland or wilderness (sim/territory), passable, off the
  // rivers, in the village's region or one touching it. The house stands where the generator would put it (sim/layout, HOUSE: near the
  // green, not crowded, where its field is worth most and its own tile least; Kim, 12 Nov); the field lies 1 to FIELD_REACH steps from it,
  // where farmed land may lie (farmedLand: beside a house, off the ring round the green, no nearer the green than the house); and the
  // farm has room (roomAt). Null when there is no room.
  // Room for a farm whose house is h (VB-154): free farmable tiles within FIELD_REACH walking steps of h, unused and free for village vid
  // (its outland or wilderness; vid null: wilderness only, for a new village; sim/territory), that `taken` does not exclude; counted up to
  // FIELDS.room. A farm needs FIELDS.room of them besides its first field for more fields, meadow and pasture.
  // cleared: a wooded tile counts as the meadow it becomes when grubbed (sim/crops clearable; a new village's site, VB-786).
  function roomAt(st, h, taken = () => false, vid = null, cleared = false) {
    const w = st.w,
      may = cleared ? clearable : farmable;
    let n = 0;
    for (const [t] of bfs(w, h, FIELD_REACH, walkable(w)).dist) {
      if (may(w, t) && freeFor(st, t, vid) && !st.used.has(t) && !taken(t) && ++n >= FIELDS.room) break;
    }
    return n;
  }
  function findSite(st, v) {
    const w = st.w,
      vreg = w.region[v.center],
      cand = [],
      built = builtTiles(st),
      fields = new Set();
    for (const f of st.farmsteads) {
      for (const fd of f.fields) fields.add(fd.tile);
      if (f.household !== null)
        for (const p of Projects.projectsOf(st, 'household', f.household)) fields.add(p.steps[p.open].place); // its projects (sim/projects)
    }
    for (const u of st.villages)
      for (const p of [...(u.plots || []), ...livePlots(st, u)])
        for (const tr of tilesOf(p)) if (tr.kind === 'field') fields.add(tr.tile);
    const near = (t) => {
      if (w.region[t] === vreg) return true;
      for (let k = 0; k < 6; k++) {
        const n = w.nb[t * 6 + k];
        if (n >= 0 && w.region[n] === vreg) return true;
      }
      return false;
    };
    for (const [t, d] of bfs(w, v.center, REACH, walkable(w)).dist) {
      if (d < 1 || !freeFor(st, t, v.id) || st.used.has(t) || v.wood.includes(t) || w.river[t]) continue;
      if (w.biome[t] === B.MOUNTAIN || w.biome[t] === B.SNOW || !near(t)) continue;
      cand.push([t, d]);
    }
    const fieldScore = (t) => fertility(w, t) - (0.5 * w.stones[t]) / 255;
    const fieldOk = (t) => farmable(w, t) && !wooded(w, t) && !built.has(t);
    const fieldCandidates = cand.filter(([t]) => fieldOk(t)).map(([t]) => [t, fieldScore(t)]);
    const walk = walkable(w),
      house = (j) => w.dev[j] === 3,
      shut = (j) => j < 0 || !walk(j) || house(j);
    let best = null,
      bs = -Infinity;
    for (const [h, d] of cand) {
      const may = farmedLand(w, st.villages, v, h, st);
      // a house may not close a way, since no route crosses one, nor close the green in (VB-402)
      if (cutsOff(w, h, shut, house) || (v.green && rimFull(w, v.center, h, house))) continue;
      let f = -1,
        fs = -Infinity;
      for (const [t, score] of fieldCandidates) {
        const steps = hexSteps(w, h, t);
        if (steps < 1 || steps > FIELD_REACH || fields.has(t) || !may(t)) continue;
        const sc = score - FIELD_NEAR * steps;
        if (sc > fs) {
          fs = sc;
          f = t;
        }
      }
      if (f >= 0 && roomAt(st, h, (t) => t === f || t === h || fields.has(t) || built.has(t), v.id) < FIELDS.room)
        continue;
      let touch = 0;
      for (let k = 0; k < 6; k++) if (built.has(w.nb[h * 6 + k])) touch++;
      // the generator's score of a house site (sim/layout houseScore), where its field is worth most and its own tile least
      const s = houseScore(w, h, d, touch) + (f >= 0 ? HOUSE.byLand * fs - HOUSE.spare * fertility(w, h) : -Infinity);
      if (s > bs) {
        bs = s;
        best = { house: h, field: f };
      }
    }
    return !best || best.field < 0 ? null : best;
  }
  // A plot begun in village v for pawn `intended`: the village's, or (by, a household id) that household's project for its heir (VB-255).
  function startPlot(st, v, intended, by = null, site = findSite(st, v)) {
    if (!site) return false;
    const w = st.w,
      tiles = [
        { tile: site.house, kind: 'house' },
        { tile: site.field, kind: 'field' },
      ];
    for (const tr of tiles) {
      tr.steps = stepsFor(w, tr.tile, tr.kind);
      tr.i = 0;
      setOwner(st, tr.tile, { type: 'village', id: v.id });
      st.used.add(tr.tile);
      woodTaken(st, tr.tile);
      if (tr.kind === 'house') {
        w.dev[tr.tile] = 3;
        costChanged(st, tr.tile);
      } // the house's ground: routes go round it from now on
    }
    // its project plan, made by sim/plans: the clearing of its tiles, then the cottage's stages
    const cottage = cottageSteps(site.house);
    emit(st, 'projectBegun', {
      type: by === null ? 'village' : 'household',
      id: by === null ? v.id : by,
      project: {
        what: 'plot',
        village: v.id,
        ...(by === null ? {} : { by }),
        plot: plotNumber(st, v),
        intended,
        to: null,
        hours: {},
        started: st.t,
        steps: [{ kind: 'clear', places: tiles }, ...cottage],
      },
    });
    st.villageDirty.add(v.id);
    if (by === null)
      log(st, `${v.name} sets out to clear a plot for ${fullName(st.pawns[intended])}.`, {
        kind: 'plotStarted',
        pawn: intended,
        village: v.id,
      }); // a household's for its heir is told as its head's project (sim/aims)
    return true;
  }
  // The next plot's number in village v: one past the highest of its plots built and under way, so no two live plots share one (a
  // household's plot given up leaves no gap to be numbered twice while it stands).
  function plotNumber(st, v) {
    let n = -1;
    for (const p of v.plots) n = Math.max(n, p.id);
    for (const p of livePlots(st, v)) n = Math.max(n, p.plot);
    return n + 1;
  }
  // A household's plot passes to its village (VB-255): the village holds it as a plot of its own from now (sim/plans moves the record);
  // cleared, it goes to the pawn it was to go to while that one can still take it, else as the village allots its plots (sim/allotment).
  function handToVillage(st, plot, why) {
    const v = st.villages[villageOf(plot)],
      by = plot.by;
    emit(st, 'projectHanded', { plan: plot, type: 'village', id: v.id });
    delete plot.by;
    const hh = st.households[by],
      f = hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null;
    log(st, `${f ? `${f.name}'s` : 'A'} plot for its heir in ${v.name} passes to the village: ${why}.`, {
      kind: 'plot',
      village: v.id,
    });
    emit(st, 'plotPassed', { plot }); // cleared, who is to have it now (sim/allotment)
  }
  // The verb plotToVillage (sim/commands, below this module, tells it by an event): household d.household's plot d.plan passes to its
  // village (the head gives it up, the household dissolves, its heir cannot take it).
  on('plotToVillage', (st, d) => {
    const plot = Projects.projectsOf(st, 'household', d.household).find((p) => p.id === d.plan);
    if (plot) handToVillage(st, plot, d.why);
  });
  // A head's farm for its heir (VB-255): the verb heirFarm (sim/commands, below this module, tells it by an event) begins the plot as
  // the household's project.
  on('heirFarm', (st, d) => {
    startPlot(st, st.villages[d.village], d.heir, d.by);
  });
  // A plot asked for at the moving round and granted (the basis `land`, sim/farmclaims; VB-692): begun for the asker at the site the
  // round found, or, with none named, at one found now.
  on('plotGranted', (st, d) => {
    const v = st.villages[d.village];
    startPlot(st, v, d.pawn, null, d.site || findSite(st, v));
  });
  // The village gives a plot up: its tiles go back to the common ground (owner, st.used, w.dev), the plan is dropped, and what was built on
  // it, its cleared ground, its walls' timber and the cottage's stages, is left to the weather: told.
  function releasePlot(st, v, plot) {
    for (const tr of tilesOf(plot)) {
      setOwner(st, tr.tile, null);
      st.used.delete(tr.tile);
      st.w.dev[tr.tile] = 0;
      costChanged(st, tr.tile);
      st.biomeDirty.add(tr.tile);
    }
    emit(st, 'plotReleased', { plan: plot });
    st.villageDirty.add(v.id);
    log(st, `${v.name} gives up a cleared plot that nobody came for.`, { kind: 'plot', village: v.id });
  }
  // The open jobs of all active plots: one per tile, for the tile's current step. [key, kind, site, extra]
  function plotJobs(st) {
    const out = [];
    for (const v of st.villages)
      for (const plot of activePlots(st, v))
        for (const tr of tilesOf(plot)) {
          if (tr.i >= tr.steps.length) continue;
          out.push([
            `plot:v${v.id}.${plot.plot}.${tr.tile}`,
            tr.steps[tr.i],
            tr.tile,
            { plot, tr, hours: stepHours(st, tr) },
          ]);
        }
    for (const v of st.villages)
      for (const plot of livePlots(st, v).filter(building)) {
        const k = plot.steps[plot.open],
          key = `plot:v${v.id}.${plot.plot}.cottage`;
        if (cottageAt(plot) >= COTTAGE.length) continue; // the roof is on
        k.done = keptDone(st, key, k.hours, k.done); // hours worked on the open stage persist while the job is dropped and posted again
        if (waitsForTimber(wallsOf(plot), plot.open - 1)) continue; // the walls wait for their timber (sim/building)
        out.push([key, k.kind, k.place, { plot, cottage: true, done: k.done, hours: k.hours }]);
      }
    return out;
  }
  // 0..1: finished steps of the plot's tiles, with the hours already worked on the open ones (a task's progress now, sim/progress).
  function plotProgress(st, plot) {
    let total = 0,
      got = 0;
    for (const tr of tilesOf(plot)) {
      total += tr.steps.length;
      got += tr.i;
      if (tr.i < tr.steps.length) {
        for (const j of st.jobs.values()) if (j.tr === tr) got += Math.min(1, doneOf(st, j, j.hours) / j.hours);
      }
    }
    return total ? got / total : 1;
  }
  // A tile's step is done: stumps stay after felling (its trees the plot's wood), grubbing turns the wood into meadow, clearing takes the
  // stones, breaking turns the soil.
  function finishStep(st, j) {
    if (j.cottage) return finishCottageStage(st, j.plot);
    const w = st.w,
      { plot, tr } = j,
      step = tr.steps[tr.i],
      v = st.villages[villageOf(plot)],
      walls = wallsOf(plot);
    if (step === 'fell') {
      // the trees felled are the plot's wood, 3 loads a tree, kept for its walls (VB-328)
      walls.wood += fellAll(st, tr.tile) * ECON.woodPerTrip;
    } else if (step === 'grub') clearTile(st, tr.tile);
    else if (step === 'clear') {
      w.stones[tr.tile] = 0;
      clearScrub(st, tr.tile); // scrub below half cover goes with the clearing (VB-091)
    } else if (tr.kind === 'field') {
      tr.fresh = !w.dev[tr.tile];
      if (tr.fresh) costChanged(st, tr.tile); // developed ground walks as open ground (sim/routes, tileCost)
      w.dev[tr.tile] = 1;
    } // ground never farmed starts fresh (VB-149)
    tended(st, tr.tile); // worked on: kept open from the forest a year (sim/spread)
    tr.i++;
    st.biomeDirty.add(tr.tile);
    st.villageDirty.add(v.id);
    if (!tilesOf(plot).every((q) => q.i >= q.steps.length)) return;
    emit(st, 'stepDone', { type: plot.holder.type, id: plot.holder.id, plan: plot }); // its tiles cleared: the cottage's first stage opens (sim/plans)
    emit(st, 'plotCleared', { plot }); // who is to have it (sim/allotment)
  }
  // A household's own step of felling or grubbing is done (VB-786: a settler's first field and its house on a forest site, sim/fieldplans
  // fellSteps): felling takes the trees, as a plot's does, its timber to the household's cottage walls while it lives in a booth (3 loads a
  // tree, VB-328), else to its woodpile; grubbing turns the wood into meadow. The plan's next step opens.
  function finishOwnClearing(st, j, hh) {
    const plan = Projects.onProject(st, j);
    if (!plan || !hh) return;
    const w = st.w,
      s = plan.steps[plan.open],
      tile = s.place;
    if (s.kind === 'fell') {
      const loads = Math.floor(w.trees[tile]) * ECON.woodPerTrip,
        home = cottageOf(st, hh.id);
      const walls = home ? wallsOf(home) : null;
      if (walls) walls.wood += loads;
      else if (loads > 0) Stores.put(st, hh, 'wood', loads, 'timber');
      w.trees[tile] = 0;
      st.regrow.delete(tile);
      st.treeDirty.add(tile);
    } else clearTile(st, tile);
    tended(st, tile); // worked on: kept open from the forest a year (sim/spread)
    st.biomeDirty.add(tile);
    if (hh.farmstead !== null) st.farmDirty.add(hh.farmstead);
    emit(st, 'stepDone', { type: 'household', id: hh.id, plan }); // the next step opens (sim/plans)
  }
  // Asked once for the island, not per village: the open step of each tile of every active plot, then each building plot's cottage stage,
  // owned by the plot's village (sim/expansion).
  function plotWork(st, holder, at, c, post) {
    for (const [key, kind, site, extra] of plotJobs(st)) post(key, site, extra, kind, extra.plot.holder);
  }
  // The job kinds (sim/kinds joins them into KINDS; a kind's fields are described there).
  const KINDS = {
    fell: {
      verb: 'Felling trees',
      go: 'Going to fell trees',
      name: 'Fell trees',
      label: 'Fell',
      anim: 'chop',
      hours: 10,
      hands: Infinity,
      type: 'wood',
      // also a household's step, on a wood broken to a field (VB-1525; sim/projects' landProject posts it, sim/newground ends it) or on a
      // settler's forest site while it lives in its booth (VB-786: finishOwnClearing); a plot's step ends in finishStep
      project: true,
      worked: (st, j) => j.farm && workStake(st, j),
      done: (st, j, hh) => {
        const plan = Projects.onProject(st, j);
        if (!plan) return;
        if (plan.what === 'field' && j.farm && hh && !cottageOf(st, hh.id)) finishFell(st, j.farm, hh, plan);
        else finishOwnClearing(st, j, hh);
      },
      available: plotWork,
    },
    grub: {
      verb: 'Grubbing out stumps',
      go: 'Going to grub out stumps',
      name: 'Grub out stumps',
      label: 'Grub',
      anim: 'hoe',
      hours: 6,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      // also a household's step, on a wood broken to a field (VB-1525; sim/projects' landProject posts it, sim/newground ends it) or on a
      // settler's forest site while it lives in its booth (VB-786: finishOwnClearing); a plot's step ends in finishStep
      project: true,
      worked: (st, j) => j.farm && workStake(st, j),
      done: (st, j, hh) => {
        const plan = Projects.onProject(st, j);
        if (!plan) return;
        if (plan.what === 'field' && j.farm && hh && !cottageOf(st, hh.id)) finishGrub(st, j.farm, hh, plan);
        else finishOwnClearing(st, j, hh);
      },
      available: plotWork,
    },
  };
  return {
    KINDS,
    plotWork,
    building,
    livePlots,
    startPlot,
    handToVillage,
    releasePlot,
    tilesOf,
    cottageAt,
    roomAt,
    findSite,
    plotJobs,
    plotProgress,
    finishStep,
    activePlots,
    MAX_PLOTS,
    plotTimber,
  };
})();
