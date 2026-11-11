// @sys sim/building: the cottage's stages as job kinds, and what building takes (VB-328): timber felled in the village's wood and carried to
// a cottage's or a booth's site whose felled tiles gave too little for its walls, and the plot's wood shared out when the plot is given
VB['sim/building'] = (() => {
  const Stores = VB['sim/stores'];
  const { BUILD, ECON } = VB['sim/rules'];
  const { fellTree, drawWood } = VB['sim/forest'];
  const { building, COTTAGE, boothJob, finishBoothStage } = VB['sim/expansion'];
  // Design (Land and ecology, Timber; Agreed, Kim, 10 Nov): a cottage's walls take BUILD.timber loads (six trees, 3 loads a tree as a firewood
  // trip's); a plot's felled tiles give their trees as its wood (sim/expansion, plot.wood); a cottage or booth short of it fells the rest in
  // the village's wood before its walls are raised, as firewood trips whose load goes to the site (site.wood: plot.wood, or f.booth.wood).
  const WALLS = COTTAGE.indexOf('walls');
  // Loads the site still lacks for its walls: none once they stand.
  const short = (site, stage) => (stage <= WALLS ? Math.max(0, BUILD.timber - (site.wood || 0)) : 0);
  // Asked once for the island: for each cottage being built on a plot (the village's job) and each booth's cottage (its household's) short of
  // timber, a trip for each load of it still lacking, at most two at a time; none where the village has no wood (sim/territory).
  function timberWork(st, holder, at, c, post) {
    const ask = (key, v, site, stage, dest, owner) => {
      const n = Math.min(2, Math.ceil(short(site, stage) / ECON.woodPerTrip));
      for (let k = 0; k < n; k++) post(`${key}${k ? 'b' : ''}`, v.wood[0], { village: v.id, timberFor: site, dest }, 'timber', owner);
    };
    for (const v of st.villages) {
      if (!v.wood.length) continue;
      for (const plot of v.plots) {
        if (building(plot)) ask(`timber:v${v.id}.${plot.id}`, v, plot, plot.cottage.i, plot.tiles[0].tile, { type: 'village', id: v.id });
      }
      for (const id of v.farmsteads) {
        const f = st.farmsteads[id];
        if (f.booth && f.household !== null) ask(`timber:f${f.id}`, v, f.booth, f.booth.i, f.house, { type: 'household', id: f.household });
      }
    }
  }
  // Settlers build their cottage (sim/settle): the open stage while the farm's booth stands (sim/expansion).
  function boothWork(st, hh, f, c, post) {
    const bj = boothJob(st, f); if (bj) post(bj[0], f.house, bj[2], bj[1]);
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
    plot.wood = 0;
    return left;
  }
  return { KINDS, boothWork, timberWork, shareWood };
})();
