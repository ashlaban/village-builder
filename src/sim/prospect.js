// @sys sim/prospect: what each village knows of the ores in its uplands (VB-358): a hidden vein is found by work done near it
// Bedrock, clay, peat, bog iron, flint, amber and salt springs show at the surface and are known to all. The upland ores (the deposits
// marked `hidden` in gen/geology) are not: a village knows a vein once one of its pawns has come on it while working within reach.
VB['sim/prospect'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { villageOf, fullName, log, atHousehold } = VB['sim/records'];
  const Geo = VB['gen/geology'];
  // hours: work hours within reach of a vein (w.veinNear: 2 tiles) for an even chance times two of finding it: a finished job of h work
  // hours finds it with chance h / hours, at most 1. Drawn as the work ends, so no tally of hours is kept (Rules for cost 3).
  const PROSPECT = { hours: 60 };
  const hidden = (w, tile) => !!Geo.DEPOSITS[w.deposit[tile]].hidden;
  // Does the village know the deposit on this tile? Every village knows what shows at the surface. A village's finds are at most the
  // map's hidden veins, some tens (the declared cap of this list).
  function knows(st, village, tile) {
    const w = st.w;
    if (!w.deposit[tile] || !hidden(w, tile)) return true;
    const found = st.finds.get(village);
    return !!found && found.includes(w.vein[tile]);
  }
  // Does any village know it? (the watcher's view)
  function known(st, tile) {
    const w = st.w;
    if (!w.deposit[tile] || !hidden(w, tile)) return true;
    for (const found of st.finds.values()) if (found.includes(w.vein[tile])) return true;
    return false;
  }
  // A pawn has finished `hours` of work on `tile`: with a hidden vein within reach that its village does not know, it may come on it.
  function worked(st, pawnId, tile, hours) {
    const w = st.w,
      vein = tile >= 0 && w.veinNear ? w.veinNear[tile] : 0;
    if (!vein) return;
    const p = st.pawns[pawnId];
    if (p.household === null) return;
    const hh = st.households[p.household],
      v = villageOf(st, p);
    // @state st.finds: Map of village id to the vein ids (w.vein) the village has found, in the order found; a village with none has no entry
    let found = st.finds.get(v);
    if (!found) st.finds.set(v, (found = []));
    if (found.includes(vein) || rnd(st.rng.prospect) >= hours / PROSPECT.hours) return;
    found.push(vein);
    const ore = Geo.DEPOSITS[w.veinKind[vein]].name.toLowerCase();
    st.visualDirty = true;
    log(
      st,
      `${fullName(p)} of ${st.farmsteads[hh.farmstead].name} has come on ${ore} in the hills: ${st.villages[v].name} knows of it now.`,
      { kind: 'oreFound', pawn: pawnId, ...atHousehold(st, hh) },
    );
  }
  return { PROSPECT, knows, known, worked };
})();
