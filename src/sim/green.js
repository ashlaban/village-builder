// @sys sim/green: the village green and well, built by the village (VB-058; Kim, 30 Oct): a village of two or more occupied farms and no
// well may choose the work as a routine at its meeting (VB-257); its review then makes it a project plan of the village (VB-123): the
// green's tile chosen and taken, the green cleared, stone carried to it from the households' heaps, the well dug and lined, the sweep
// raised; then the village has its green and well, its centre on the green
VB['sim/green'] = (() => {
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { BUILD } = VB['sim/rules'];
  const { B } = VB['gen'];
  const { bfs } = VB['sim/hex'];
  const { walkable, costChanged } = VB['sim/routes'];
  const { setOwner } = VB['sim/ownership'];
  const { freeFor } = VB['sim/territory'];
  const { log } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  // @state the green's project plan (st.plans.projects.village; sim/projects): {what: 'green', started (game hours), steps: [{kind 'green',
  //   place, hours}, {kind 'well', place, hours, brought (loads of stone carried to the green)}, {kind 'sweep', place, hours}]}, at most one
  //   a village. Its tile is the village's (st.owner) and in use (st.used) from the plan's making; v.center, v.green and v.well change when
  //   the sweep is raised (sim/layout and sim/byhand set them at seeding).
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
  // Whether the village has the work: no well yet, and two or more occupied farms or the green under way (the routine's `available`).
  const wanted = (st, v) => !v.well && (!!greenOf(st, v) || houses(st, v).length >= 2);
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
  // The green's tile: of the open tiles within BUILD.greenReach walking steps of an occupied farm's house, the nearest to the houses' mean
  // position (so it lies between them), the lowest id between equals; -1 for none, or fewer than two farms.
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
    let best = -1,
      bd = Infinity;
    for (const h of hs)
      for (const t of bfs(w, h, BUILD.greenReach, walkable(w)).dist.keys()) {
        if (!open(st, v, t, wood)) continue;
        const d = (w.hx[t] - mx) ** 2 + (w.hy[t] - my) ** 2;
        if (d < bd || (d === bd && t < best)) {
          best = t;
          bd = d;
        }
      }
    return best;
  }
  // The green's project plan for the village, as sim/plans makes it (makeProject), or null: none while the village has no such work, has
  // one under way, or finds no tile. It spends nothing from the village's store: the well's stone comes from the households' heaps.
  function greenProject(st, v) {
    if (v.well || greenOf(st, v) || houses(st, v).length < 2) return null;
    const t = greenSite(st, v);
    if (t < 0) return null;
    return {
      what: 'green',
      started: st.t,
      steps: [
        { kind: 'green', place: t, hours: BUILD.greenHours },
        { kind: 'well', place: t, hours: BUILD.wellHours, brought: 0 },
        { kind: 'sweep', place: t, hours: BUILD.sweepHours },
      ],
    };
  }
  // The plan made: its tile is the village's and in use from now, and the village's log tells it.
  function laidOut(st, v, plan) {
    const t = plan.steps[0].place;
    setOwner(st, t, VILLAGE(v));
    st.used.add(t);
    st.visualDirty = true;
    log(st, `${v.name} sets out to lay out a green and dig a well between its farms.`, {
      kind: 'green',
      village: v.id,
    });
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
    stepDone(st, v, plan);
  }
  // A load of stone laid at the green: the well's, or, once it has all it takes, left lying on the green (stones in the ground, which a
  // meadow keeps; never more than a tile holds).
  function stoneLaid(st, j) {
    const s = j.step;
    if (s.brought < BUILD.wellStone) s.brought++;
    else {
      st.w.stones[s.place] = Math.min(255, st.w.stones[s.place] + STONES_PER_LOAD);
      st.biomeDirty.add(s.place);
    }
  }
  // A load taken off a household's heap for the well, at its house: 1, or 0 when the heap no longer holds one free, or the well has its stone.
  function stoneTaken(st, j) {
    const hh = st.households[j.from],
      s = j.step;
    if (!hh || hh.dissolved || s.brought >= BUILD.wellStone || (hh.stone || 0) - Stores.reserved(st, hh, 'stone') < 1)
      return 0;
    Stores.take(st, hh, 'stone', 1, 'well');
    return 1;
  }
  // The well dug and lined with its stone.
  function dug(st, j) {
    const v = st.villages[j.village],
      plan = greenOf(st, v);
    if (!plan || plan.steps[plan.open] !== j.step) return;
    stepDone(st, v, plan);
  }
  // The sweep raised: the village has its green and well from now, its centre on the green (water is drawn there, sim/kinds; the map
  // draws the green, the sweep and the village's name there).
  function raised(st, j) {
    const v = st.villages[j.village],
      plan = greenOf(st, v);
    if (!plan || plan.steps[plan.open] !== j.step) return;
    v.center = j.site;
    v.green = true;
    v.well = true;
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
      const n = hh ? (hh.stone || 0) - Stores.reserved(st, hh, 'stone') : 0;
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
    if (s.kind === 'well' && s.brought < BUILD.wellStone) {
      const from = heaps(st, v),
        n = Math.min(2, BUILD.wellStone - s.brought, from.length);
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
    post(`${s.kind}:v${v.id}`, s.place, { village: v.id, step: s }, s.kind, own);
  }
  // Where the pawn stands at the green's work: round the tile's middle, the well a little below it (where the page draws the sweep).
  const spot = (dy) => (st, a, j) => [st.w.hx[j.site] + a.ox * 0.5, st.w.hy[j.site] + dy + a.oy * 0.3];
  // The job kinds (sim/kinds takes them in), a village duty (ROLES' `duty`, sim/rules).
  const KINDS = {
    green: {
      verb: 'Clearing the village green',
      go: 'Going to clear the green',
      name: 'Clear the green',
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
      back: 'Carrying stone to the well',
      name: 'Carry stone to the well',
      label: 'Stone',
      anim: 'gather',
      hours: 0.25,
      hands: 1,
      type: 'duty',
      carry: 'basket',
      to: 'site',
      load: (st, a, j) => stoneTaken(st, j),
      again: () => false,
      deliver: (st, j) => stoneLaid(st, j),
      available: greenWork,
    },
    well: {
      verb: 'Digging and lining the well',
      go: 'Going to dig the well',
      name: 'Dig the well',
      label: 'Well',
      anim: 'hoe',
      hours: BUILD.wellHours,
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
      label: 'Sweep',
      anim: 'mallet',
      hours: BUILD.sweepHours,
      hands: 3,
      type: 'duty',
      spot: spot(10),
      done: raised,
      available: greenWork,
    },
  };
  return { KINDS, greenWork, greenOf, greenSite, greenProject, laidOut, wanted, houses };
})();
