// @sys sim/building: the cottage's stages as job kinds, and what building takes (VB-328): timber felled in the village's wood and carried to
// a cottage's or a booth's site whose felled tiles gave too little for its walls, and the plot's wood shared out when the plot is given;
// raising a house onto a stone foundation, with stone picked or quarried for it (VB-332)
VB['sim/building'] = (() => {
  const Stores = VB['sim/stores'], Projects = VB['sim/projects'];
  const { BUILD, ECON, SEASON_DAYS, SPEED, houseCondition } = VB['sim/rules'];
  const { B } = VB['gen'];
  const { bfs } = VB['sim/hex'];
  const { walkable, findRoute } = VB['sim/routes'];
  const { log, atFarm } = VB['sim/records'];
  const { fellTree, drawWood } = VB['sim/forest'];
  const { building, livePlots, COTTAGE, boothJob, finishBoothStage } = VB['sim/expansion'];
  // Design (Land and ecology, Timber; Agreed, Kim, 10 Nov): a cottage's walls take BUILD.timber loads (six trees, 3 loads a tree as a firewood
  // trip's); a plot's felled tiles give their trees as its wood (sim/expansion, plot.wood); a cottage or booth short of it fells the rest in
  // the village's wood before its walls are raised, as firewood trips whose load goes to the site (site.wood: plot.wood, or f.booth.wood).
  const WALLS = COTTAGE.indexOf('walls');
  // Loads the site still lacks for its walls: none once they stand.
  const short = (site, stage) => (stage <= WALLS ? Math.max(0, (site.timber ?? BUILD.timber) - (site.wood || 0)) : 0);
  // Asked once for the island: for each cottage being built on a plot (the village's job) and each booth's cottage (its household's) short of
  // timber, and each household's boat being built (VB-300), a trip for each load of it still lacking, at most two at a time; none where the
  // village has no wood (sim/territory).
  function timberWork(st, holder, at, c, post) {
    const ask = (key, v, site, stage, dest, owner) => {
      const n = Math.min(2, Math.ceil(short(site, stage) / ECON.woodPerTrip));
      for (let k = 0; k < n; k++) post(`${key}${k ? 'b' : ''}`, v.wood[0], { village: v.id, timberFor: site, dest }, 'timber', owner);
    };
    for (const v of st.villages) {
      if (!v.wood.length) continue;
      for (const plot of livePlots(st, v)) { // the site's timber is the walls step's (sim/expansion)
        if (building(plot)) ask(`timber:v${v.id}.${plot.plot}`, v, plot.steps[2], plot.open - 1, plot.steps[1].place, { type: 'village', id: v.id });
      }
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id];
        if (f.booth && f.household !== null) ask(`timber:f${f.id}`, v, f.booth, f.booth.i, f.house, { type: 'household', id: f.household });
        const s = f.household !== null && Projects.openOf(st, 'household', f.household); // a boat's timber, carried to its shore (VB-300)
        if (s && (s.kind === 'boat' || s.kind === 'cart')) ask(`timber:b${f.id}`, v, s, 0, s.place, { type: 'household', id: f.household }); // and a cart's, to the house
      }
    }
  }
  // Settlers build their cottage (sim/settle): the open stage while the farm's booth stands (sim/expansion).
  function boothWork(st, hh, f, c, post) {
    const bj = boothJob(st, f); if (bj) post(bj[0], f.house, bj[2], bj[1]);
  }
  // ---- a stone foundation (VB-332; design, Land and ecology, Stone, and Goods of place, A well-kept house) ----
  // A house is built on the bare ground (f.grade 'ground'); its household may raise it onto stone ('stone'), which lifts its prestige term and
  // slows its wear (HOUSE, sim/rules). Stone is wanted only while the household means to raise its house: its plan's building step
  // (plan.build, opened at a review by sim/plans from buildStep), not a standing target, so heaps do not grow without use.
  const STONES_PER_LOAD = 25; // as clearing loads them (sim/fields, sim/meadows)
  const pickable = (w, t) => w.biome[t] === B.MEADOW && w.stones[t] > BUILD.keepStones;
  const quarry = (w, t) => w.biome[t] === B.HILLS || w.biome[t] === B.MOUNTAIN;
  // Where the household's stone comes from: the nearest tile within BUILD.stoneReach walking steps of its house where a load may be picked (a
  // meadow tile of its own land or its village's outland holding more than a meadow keeps), else the nearest hills or mountain tile, not
  // another's land, to quarry; {tile, kind ('pick' | 'quarry')}, or {tile: -1, kind: null} when there is none (its heap may still fill
  // from clearing). One search, when the step opens or its tile is picked down.
  function stoneSource(st, f) {
    const w = st.w, own = (t) => st.owner[t] === f.household + 1 || (st.owner[t] === -f.village - 1 && !st.used.has(t));
    // Proposed (merge of VB-332 with VB-359, 11 Nov): the tile is also within BUILD.stoneWalk hours' walk of the house, so that a trip up a
    // steep slope does not end in the dark (tests/daylight.js); the nearest few of each kind are tried, nearest first.
    const near = (t) => findRoute(w, f.house, t, BUILD.stoneWalk * SPEED) !== null, picks = [], rocks = [];
    for (const [t, d] of bfs(w, f.house, BUILD.stoneReach, walkable(w)).dist) {
      if (pickable(w, t) && own(t)) picks.push([d, t]);
      else if (quarry(w, t) && (st.owner[t] === 0 || own(t))) rocks.push([d, t]);
    }
    const first = (list) => { const c = list.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 6).find((e) => near(e[1])); return c ? c[1] : -1; };
    const pick = first(picks), rock = pick >= 0 ? -1 : first(rocks);
    return pick >= 0 ? { tile: pick, kind: 'pick' } : { tile: rock, kind: rock >= 0 ? 'quarry' : null };
  }
  // The building step a household's plan holds after a review: open while its house stands on the ground, lived in by it, and it has no
  // land project under way when the step would open (a household makes its land first); its source kept while a load can still be got there.
  function buildStep(st, plan, hh) {
    const f = hh.farmstead !== null ? st.farmsteads[hh.farmstead] : null, old = plan.build || null;
    if (!f || f.household !== hh.id || f.booth || f.grade !== 'ground' || (!old && Projects.projectOf(st, 'household', hh.id))) return null;
    if (old && (old.kind !== 'pick' || pickable(st.w, old.tile))) return old;
    return stoneSource(st, f);
  }
  // The slack of the year, when a house is raised: the first half of summer, and winter.
  const slack = (c) => (c.season === 1 && c.sday < SEASON_DAYS / 2) || c.season === 3;
  // The household's building step: loads to its heap, two trips at a time, while it lacks the foundation's stone; then, in the slack, the
  // raising itself. Read from its plan; nothing is searched here.
  function stoneWork(st, hh, f, c, post) {
    const plan = st.plans.households.get(hh.id), step = plan && plan.build;
    if (!step || f.household !== hh.id) return;
    if (hh.stone >= BUILD.foundationStone) { if (slack(c)) post(`raise:f${f.id}`, f.house, { farm: f }, 'raise'); return; }
    if (step.tile < 0) return;
    post(`${step.kind}:h${hh.id}`, step.tile, { farm: f }, step.kind);
    if (hh.stone + 1 < BUILD.foundationStone) post(`${step.kind}:h${hh.id}b`, step.tile, { farm: f }, step.kind);
  }
  // A load carried home onto the heap; a picked load off its tile, as clearing takes them.
  function stoneHome(st, j, hh) {
    if (j.kind === 'pick') { st.w.stones[j.site] = Math.max(0, st.w.stones[j.site] - STONES_PER_LOAD); st.biomeDirty.add(j.site); }
    Stores.put(st, hh, 'stone', 1, j.kind);
  }
  // The house raised: the foundation's stone off the heap, and the house on stone from now (its condition carried over at this hour, so the
  // closed form wears it at the stone's rate from here).
  function raised(st, j, hh) {
    const f = j.farm;
    if (f.grade !== 'ground' || hh.stone < BUILD.foundationStone) return;
    Stores.take(st, hh, 'stone', BUILD.foundationStone, 'foundation');
    f.condition = houseCondition(st, f); f.condAt = st.t; f.grade = 'stone'; st.biomeDirty.add(f.house); st.visualDirty = true;
    log(st, `The house at ${f.name} is raised onto a stone foundation.`, { kind: 'cottage', ...atFarm(f) });
  }
  // The job kinds of building (sim/kinds takes them in). The cottage's stages: a plot's are finished by sim/expansion (j.plot), a booth's
  // (j.booth, settlers) here; a plot's are posted by sim/kinds' plotWork.
  const stage = (verb, go, name, label, anim, hours) => ({ verb, go, name, label, anim, hours, hands: Infinity, type: 'wood',
    done: (st, j) => { if (j.booth) finishBoothStage(st, j); }, available: boothWork });
  const KINDS = {
    foundation: stage('Laying the foundation', 'Going to lay a foundation', 'Lay the foundation', 'Foundation', 'mallet', 30),
    walls: stage('Raising the log walls', 'Going to raise the walls', 'Raise the walls', 'Walls', 'chop', 60),
    roof: stage('Laying the turf roof', 'Going to lay the roof', 'Lay the roof', 'Roof', 'mallet', 30),
    timber: {
      verb: 'Felling timber', go: 'Heading to the woods for timber', back: 'Carrying timber to the building site', name: 'Fell timber', label: 'Timber',
      anim: 'chop', hours: 3, hands: 1, type: 'wood', carry: 'logs', to: 'site',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      draw: (st, j) => drawWood(st, st.villages[j.village]),
      // a tree felled on the drawn tile; its load lies at the site, and the ledger of the village or household building says so
      deliver: (st, j) => {
        const v = st.villages[j.village];
        fellTree(st, st.w.trees[j.site] > 0 ? j.site : drawWood(st, v));
        j.timberFor.wood = (j.timberFor.wood || 0) + ECON.woodPerTrip;
        Stores.record(st, j.owner.type === 'village' ? v : st.households[j.owner.id], 'timber', ECON.woodPerTrip, 'timber');
      },
      available: timberWork,
    },
    pick: { verb: 'Picking stones', go: 'Going to pick stones', back: 'Carrying stones home', name: 'Pick stones', label: 'Stones', anim: 'hoe',
      hours: BUILD.pickHours, hands: 1, type: 'tilling', carry: 'basket', to: 'barn', urgency: (st, j, c, U) => U.repair, deliver: stoneHome,
      available: stoneWork },
    quarry: { verb: 'Breaking stone', go: 'Going to the quarry', back: 'Carrying stone home', name: 'Quarry stone', label: 'Quarry', anim: 'mallet',
      hours: BUILD.quarryHours, hands: 1, type: 'tilling', carry: 'basket', to: 'barn', urgency: (st, j, c, U) => U.repair, deliver: stoneHome,
      available: stoneWork },
    raise: { verb: 'Laying a stone foundation', go: 'Going to raise the house', name: 'Raise the house onto stone', label: 'Foundation',
      anim: 'mallet', hours: BUILD.foundationHours, hands: 2, type: 'upkeep', urgency: (st, j, c, U) => U.repair,
      spot: (st, a, j) => [st.w.hx[j.site] - 4 + a.ox * 0.4, st.w.hy[j.site] + 14], done: (st, j) => raised(st, j, st.households[j.farm.household]),
      available: stoneWork },
  };
  // The wood a given plot leaves once its new household has had its share (`left` loads): to the woodpiles of the households that worked
  // the plot, most hours first, each up to its winter goal (ECON.woodWinter); the rest is burnt where it lies. Returns the loads burnt.
  function shareWood(st, plot, left) {
    const by = new Map();
    for (const [id, h] of Object.entries(plot.hours)) {
      const p = st.pawns[id], hh = p && p.alive && p.household !== null ? st.households[p.household] : null;
      if (hh && !hh.dissolved) by.set(hh, (by.get(hh) || 0) + h);
    }
    for (const [hh] of [...by].sort((a, b) => b[1] - a[1] || a[0].id - b[0].id)) {
      if (left <= 0) break;
      const n = Math.min(left, Math.max(0, ECON.woodWinter - hh.wood));
      if (n > 0) { Stores.put(st, hh, 'wood', n, 'plot'); left -= n; }
    }
    plot.steps[2].wood = 0;
    return left;
  }
  return { KINDS, boothWork, timberWork, shareWood, stoneWork, buildStep, stoneSource };
})();
