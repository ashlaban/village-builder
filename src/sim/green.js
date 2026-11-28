// @sys sim/green [material]: the village green and well, built by the village (VB-058; Kim, 30 Oct): a village of two or more occupied farms and no
// well may choose the work as a routine at its meeting (VB-257); its review then makes it a project plan of the village (VB-123): the
// green's tile chosen and taken, the green cleared, stone carried to it from the households' heaps, the well dug and lined, the sweep
// raised; then the village has its green and well, its centre on the green. The well's hours and stone are by the depth of the green's
// ground (world/water's one rule, VB-1584), the green lies where the villagers reckon the water shallowest, and a green whose ground has
// no well is laid out without one
VB['sim/green'] = (() => {
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { BUILD } = VB['sim/rules'];
  const { B } = VB['world/biomes'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/walking'],
    { costChanged } = VB['sim/routes'];
  const { setOwner } = VB['sim/ownership'];
  const { freeFor, reckonWood } = VB['sim/territory'];
  const { log } = VB['sim/records'];
  const { emit, on } = VB['sim/events'];
  const { wellDug } = VB['sim/water'];
  const { NO_WELL, band, bandMid, wellHours, wellStone } = VB['world/water'];
  // @state the green's project plan (st.plans.projects.village; sim/projects): {what: 'green', started (game hours), steps: [{kind 'green',
  //   place, hours}, {kind 'well', place, hours, stone (the loads its lining takes: both by the depth of the tile, VB-1584), brought (loads of
  //   stone carried to the green)}, {kind 'sweep', place, hours}]}, or the first step alone where the green's ground has no well; at most one
  //   a village. Its tile is the village's (st.owner) and in use (st.used) from the plan's making; v.center, v.green and v.well change when
  //   the sweep is raised (a green with no well: when it is cleared) (sim/layout and sim/byhand set them at seeding); v.center also when
  //   a lone farm's house moves (VB-1667).
  // A lone farm's village follows its house (VB-1667): in a village of one farm and no green, its centre is that farm's house (sim/layout
  // seeds it so); when the house moves (sim/camp's placing), the centre moves with it, the old tile free to graze and farm again, the
  // village's wood reckoned again from the new centre, and its next meeting claims outland round it (sim/territory claimOutland).
  on('houseMoved', (st, { f, from }) => {
    const v = st.villages[f.village];
    if (v.green || v.farmsteads.length !== 1 || v.center !== from) return;
    v.center = f.house;
    reckonWood(st, v);
    st.visualDirty = true;
  });
  const STONES_PER_LOAD = 25; // as clearing and picking load them (sim/fields, sim/building)
  const VILLAGE = (v) => ({ type: 'village', id: v.id });
  // The village's green under way, or null.
  function greenOf(st, v) {
    for (const p of Projects.projectsOf(st, 'village', v.id)) if (p.what === 'green') return p;
    return null;
  }
  // The occupied farms' houses of the village.
  function houses(st, v) {
    const out = [];
    for (const id of v.farmsteads) if (st.farmsteads[id].household !== null) out.push(st.farmsteads[id].house);
    return out;
  }
  // Whether the village has the work: no green yet, and two or more occupied farms or the green under way (the routine's `available`).
  const wanted = (st, v) => !v.green && (!!greenOf(st, v) || houses(st, v).length >= 2);
  // Ground a green may lie on: open meadow or heath, not water or a river's course, not in use (a house, field, meadow, plot), not in the
  // village's wood, and land the village may take in (its outland, or wilderness nobody claims; sim/territory).
  const OPEN = new Set([B.MEADOW, B.HEATH]);
  const open = (st, v, t, wood) => {
    const w = st.w;
    return (
      OPEN.has(w.biome[t]) &&
      !w.water[t] &&
      !w.river[t] &&
      !w.dev[t] &&
      !st.used.has(t) &&
      !wood.has(t) &&
      t !== v.center &&
      freeFor(st, t, v.id)
    );
  };
  // The green's tile: of the open tiles within BUILD.greenReach walking steps of an occupied farm's house, none beside a field, the one
  // where the water is shallowest as the villagers reckon it, by the ground's band (world/water: the estimate, never the metres;
  // VB-1584); within a band the nearest to the houses' mean position (so it lies between them), the lowest id between equals; -1 for
  // none, or fewer than two farms.
  function greenSite(st, v) {
    const w = st.w,
      hs = houses(st, v);
    if (hs.length < 2) return -1;
    let mx = 0,
      my = 0;
    for (const h of hs) {
      mx += w.hx[h] / hs.length;
      my += w.hy[h] / hs.length;
    }
    const wood = new Set(v.wood);
    // tiles beside a field of any farm: a field is next to no green (VB-109)
    const byField = new Set();
    for (const f of st.farmsteads)
      for (const fd of f.fields) for (let k = 0; k < 6; k++) byField.add(w.nb[fd.tile * 6 + k]);
    let best = -1,
      bk = Infinity,
      bd = Infinity;
    for (const h of hs)
      for (const t of bfs(w, h, BUILD.greenReach, walkable(w)).dist.keys()) {
        if (byField.has(t) || !open(st, v, t, wood)) continue;
        const k = band(w.waterDepth[t]),
          d = (w.hx[t] - mx) ** 2 + (w.hy[t] - my) ** 2;
        if (k < bk || (k === bk && (d < bd || (d === bd && t < best)))) {
          best = t;
          bk = k;
          bd = d;
        }
      }
    return best;
  }
  // The green's project plan for the village, as sim/plans makes it (makeProject), or null: none while the village has no such work, has
  // one under way, or finds no tile. It spends nothing from the village's store: the well's stone comes from the households' heaps.
  // The well's hours and stone are its tile's depth's; a green whose ground has no well is the clearing alone.
  function greenProject(st, v) {
    if (v.green || greenOf(st, v) || houses(st, v).length < 2) return null;
    const t = greenSite(st, v);
    if (t < 0) return null;
    const depth = st.w.waterDepth[t],
      steps = [{ kind: 'green', place: t, hours: BUILD.greenHours }];
    if (depth < NO_WELL)
      steps.push(
        { kind: 'well', place: t, hours: wellHours(depth), stone: wellStone(depth), brought: 0 },
        { kind: 'sweep', place: t, hours: BUILD.sweepHours },
      );
    return { what: 'green', started: st.t, steps };
  }
  // The loads of stone the well's step takes (a step of a save before VB-1584 has none named: the six a well took then).
  const stoneOf = (s) => s.stone ?? 6;
  // The plan made: its tile is the village's and in use from now, and the village's log tells it.
  function laidOut(st, v, plan) {
    const t = plan.steps[0].place;
    setOwner(st, t, VILLAGE(v));
    st.used.add(t);
    st.visualDirty = true;
    const dig = plan.steps.length > 1;
    log(
      st,
      `${v.name} sets out to lay out a green${dig ? ' and dig a well' : ''} between its farms${dig ? '' : ': its ground has no well'}.`,
      {
        kind: 'green',
        village: v.id,
      },
    );
  }
  // The open step done: told to the village's plan (sim/plans advances it).
  const stepDone = (st, v, plan) => emit(st, 'stepDone', { type: 'village', id: v.id, plan });
  // The green cleared: open ground that the ways cross (sim/paths: no path wears on it; sim/routes walk it as meadow).
  function cleared(st, j) {
    const v = st.villages[j.village],
      plan = greenOf(st, v);
    if (!plan || plan.steps[plan.open] !== j.step) return;
    st.w.dev[j.site] = 2;
    costChanged(st, j.site);
    st.biomeDirty.add(j.site);
    if (plan.steps.length === 1) {
      // a green whose ground has no well: the village has its green from now, its centre on it, and no well
      v.center = j.site;
      v.green = true;
      st.visualDirty = true;
      log(st, `${v.name} has laid out its green; no well can be dug in its ground.`, { kind: 'green', village: v.id });
    }
    stepDone(st, v, plan);
  }
  // A load of stone laid at the green: the well's, or, once it has all it takes, left lying on the green (stones in the ground, which a
  // meadow keeps; never more than a tile holds).
  function stoneLaid(st, j) {
    const s = j.step;
    if (s.brought < stoneOf(s)) s.brought++;
    else {
      st.w.stones[s.place] = Math.min(255, st.w.stones[s.place] + STONES_PER_LOAD);
      st.biomeDirty.add(s.place);
    }
  }
  // A load taken off a household's heap for the well, at its house: 1, or 0 when the heap no longer holds one free, or the well has its stone.
  const stoneFree = (st, j) => {
    const hh = st.households[j.from],
      s = j.step;
    return (
      !!hh &&
      !hh.dissolved &&
      s.brought < stoneOf(s) &&
      Stores.heldOf(hh, 'stone') - Stores.reserved(st, hh, 'stone') >= 1
    );
  };
  function stoneTaken(st, j) {
    if (!stoneFree(st, j)) return 0;
    Stores.take(st, st.households[j.from], 'stone', 1, 'well');
    return 1;
  }
  // The well dug and lined with its stone.
  function dug(st, j) {
    const v = st.villages[j.village],
      plan = greenOf(st, v);
    if (!plan || plan.steps[plan.open] !== j.step) return;
    stepDone(st, v, plan);
  }
  // The sweep raised: the village has its green and well from now, its centre on the green (its farms may draw there, sim/water; the map
  // draws the green, the sweep and the village's name there).
  function raised(st, j) {
    const v = st.villages[j.village],
      plan = greenOf(st, v);
    if (!plan || plan.steps[plan.open] !== j.step) return;
    v.center = j.site;
    v.green = true;
    v.well = j.site;
    wellDug(st, v.well, v); // a source on the map: the village's farms find their sources again (VB-1582)
    st.visualDirty = true;
    log(st, `The well sweep is raised on the new green of ${v.name}: the farms draw their water at one well.`, {
      kind: 'green',
      village: v.id,
    });
    stepDone(st, v, plan);
  }
  // The households whose heaps hold stone the well may take, most first, then by id.
  function heaps(st, v) {
    const out = [];
    for (const id of v.farmsteads) {
      const f = st.farmsteads[id],
        hh = f.household === null ? null : st.households[f.household];
      const n = hh ? Stores.heldOf(hh, 'stone') - Stores.reserved(st, hh, 'stone') : 0;
      if (n >= 1) out.push([n, hh.id, f.house]);
    }
    return out.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  }
  // Asked at the village's review while its meeting chose the routine (sim/jobs): the open step of its green, owned by the village; while
  // the well lacks stone, a trip to carry a load to the green from each of the two fullest heaps (one when one load is lacking), in place
  // of the digging. Nothing while no heap holds stone: the well waits for it.
  function greenWork(st, v, at, c, post) {
    const plan = greenOf(st, v);
    if (!plan) return;
    const s = plan.steps[plan.open],
      own = VILLAGE(v);
    if (s.kind === 'well' && s.brought < stoneOf(s)) {
      const from = heaps(st, v),
        n = Math.min(2, stoneOf(s) - s.brought, from.length);
      for (let k = 0; k < n; k++)
        post(
          `wellstone:v${v.id}${k ? 'b' : ''}`,
          from[k][2],
          { village: v.id, step: s, from: from[k][1], dest: s.place },
          'wellstone',
          own,
        );
      return;
    }
    post(`${s.kind}:v${v.id}`, s.place, { village: v.id, step: s, hours: s.hours }, s.kind, own);
  }
  // Where the pawn stands at the green's work: round the tile's middle, the well a little below it (where the page draws the sweep).
  const spot = (dy) => (st, a, j) => [st.w.hx[j.site] + a.ox * 0.5, st.w.hy[j.site] + dy + a.oy * 0.3];
  // The job kinds (sim/kinds takes them in), a village duty (ROLES' `duty`, sim/roles).
  const KINDS = {
    green: {
      verb: 'Clearing the village green',
      go: 'Going to clear the green',
      name: 'Clear the green',
      at: ['green'],
      needs: [],
      gives: ['green'],
      label: 'Green',
      anim: 'hoe',
      hours: BUILD.greenHours,
      hands: 3,
      type: 'duty',
      spot: spot(0),
      done: cleared,
      available: greenWork,
    },
    wellstone: {
      verb: 'Loading stone for the well',
      go: 'Going for stone for the well',
      name: 'Carry stone to the well',
      at: ['green'],
      needs: ['stone'],
      gives: [],
      label: 'Stone',
      anim: 'gather',
      hours: 0.25,
      hands: 1,
      type: 'duty',
      available: greenWork,
    },
    well: {
      verb: 'Digging and lining the well',
      go: 'Going to dig the well',
      name: 'Dig the well',
      at: ['green'],
      needs: ['stone'],
      gives: ['well'],
      label: 'Well',
      anim: 'hoe',
      hours: bandMid(1), // a job's are its step's, by the depth
      hands: 2,
      type: 'duty',
      spot: spot(10),
      done: dug,
      available: greenWork,
    },
    sweep: {
      verb: 'Raising the well sweep',
      go: 'Going to raise the well sweep',
      name: 'Raise the well sweep',
      at: ['green'],
      needs: [],
      gives: ['well'],
      label: 'Sweep',
      anim: 'mallet',
      hours: BUILD.sweepHours,
      hands: 3,
      type: 'duty',
      craft: 'building', // VB-360
      spot: spot(10),
      done: raised,
      available: greenWork,
    },
  };
  // The stone for the well as a goal (VB-1812; design.md section 7, The task as a plan): a load taken off the household's heap at its
  // house, carried to the well (`j.dest`) and laid there; one that falls lies as the village's pile, which the stray method fetches.
  VB['sim/methods'].carry(KINDS.wellstone, 'wellstone', {
    look: 'basket',
    words: 'Carrying stone to the well',
    deliver: (st, j) => stoneLaid(st, j),
    name: 'to the well',
    op: 'take',
    source: true,
    why: 'no stone free on the heap',
    to: 'well',
    run: (st, j, g, at, a) => {
      a.load = stoneTaken(st, j);
    },
    met: (st, g) => (g.job.made || 0) > 0,
  });
  Object.assign(KINDS.wellstone, {
    places: { well: (st, g) => g.job.dest },
    can: { source: (st, g) => stoneFree(st, g.job) },
  });
  return { KINDS, greenWork, greenOf, greenSite, greenProject, laidOut, wanted, houses };
})();
