// @sys sim/newground: new ground made: a field's site felled and grubbed when it is a wood (VB-1525), cleared of its stones, its ground
// broken, and the new field it becomes (VB-149, VB-332)
VB['sim/newground'] = (() => {
  const { DAY } = VB['sim/rules'];
  const { SOIL } = VB['sim/crops'];
  const { ECON, TRAVEL } = VB['sim/rules'];
  const { fellAll, clearTile } = VB['sim/forest'];
  const Lying = VB['sim/lying'];
  const { newField } = VB['sim/fieldrec'];
  const { costChanged } = VB['sim/routes'];
  const { log, atFarm } = VB['sim/records'];
  const { woodTaken } = VB['sim/territory'];
  const { realiseStake } = VB['sim/stakes'];
  const Stores = VB['sim/stores'];
  const { emit } = VB['sim/events'];
  const { clearScrub, tended } = VB['sim/spread'];
  const { placeField } = VB['sim/courses'];
  const STONES_PER_LOAD = 25;
  // Felling done on a wood broken to a field (VB-1525; Kim, 23 Nov): every tree standing on it is felled (sim/forest's fellAll, as a plot's
  // are) and its wood, ECON.woodPerTrip a tree, lies at the site as timber left lying, the household's (sim/lying, sim/building's
  // leftTimber): its hands carry it home to the woodpile a load a trip, or it rots at the frost. The project's next step, grubbing, opens.
  function finishFell(st, f, hh, plan) {
    const tile = plan.steps[plan.open].place,
      wood = fellAll(st, tile) * ECON.woodPerTrip;
    woodTaken(st, tile); // felled, it leaves its village's wood (sim/territory), as a plot's tile does when it is cleared
    if (wood > 0)
      Lying.leave(st, 'leftTimber', (wood / ECON.woodPerTrip) * TRAVEL.load, tile, { type: 'household', id: hh.id });
    emit(st, 'stepDone', { type: 'household', id: f.household, plan });
  }
  // Grubbing done: the stumps are out, the tile is meadow and leaves its village's wood (sim/forest's clearTile); clearing opens.
  function finishGrub(st, f, hh, plan) {
    clearTile(st, plan.steps[plan.open].place);
    emit(st, 'stepDone', { type: 'household', id: f.household, plan });
  }
  // Clearing done: the stones go to the household's store, the tile is bare ground; the project's next step, breaking, opens.
  // `plan` is the household's field plan whose step the job was (sim/projects' onProject).
  function finishClear(st, f, hh, plan) {
    const tile = plan.steps[plan.open].place;
    clearStones(st, tile, hh);
    emit(st, 'stepDone', { type: 'household', id: f.household, plan }); // the project's next step opens (sim/plans)
  }
  // The stones cleared off `tile` go to household hh's heap (VB-332: through the stores; a common field's to the household of the one who
  // finished the clearing, VB-100), and the tile is bare ground.
  function clearStones(st, tile, hh) {
    const w = st.w,
      loads = Math.round(w.stones[tile] / STONES_PER_LOAD);
    if (loads > 0 && hh) Stores.put(st, hh, 'stone/granite', loads, 'clear'); // cleared stone is granite (VB-733)
    w.stones[tile] = 0;
    clearScrub(st, tile); // its scrub too, and it is tended (VB-091)
    st.biomeDirty.add(tile);
  }
  // Breaking done: the stake is the household's own land, a field in stubble; on ground never farmed (w.dev 0) its soil starts fresh
  // (SOIL.fresh, VB-149). The project is finished.
  function finishBreak(st, f, plan) {
    const tile = plan.steps[plan.open].place;
    realiseStake(st, st.households[f.household], tile);
    const fd = broken(st, tile, f.fields.length + (f.left ? f.left.gone : 0), plan.ground); // the fields made so far, those let go among them (VB-768)
    f.fields.push(fd); // lint-allow: owner a new field joins its farm's list where its ground is broken (sim/fields' record)
    placeField(st, f, st.households[f.household], fd);
    st.farmDirty.add(f.id); // its new field is drawn (VB-442)
    emit(st, 'stepDone', { type: 'household', id: f.household, plan }); // the project is finished (sim/plans)
    log(st, `${f.name} has broken a new field.`, { kind: 'field', ...atFarm(f) });
  }
  // A new field in stubble on `tile`, its ground broken: farmed land from now. A farm's (finishBreak) or a village's common field (VB-100,
  // sim/commons), whose holder adds it to its list. `ground`: the plan's, the biome the tile had when the project began (a plan from an older
  // save has none: the tile's now).
  function broken(st, tile, id, ground) {
    const w = st.w,
      fd = newField(w, id, tile, w.dev[tile] ? SOIL.start : SOIL.fresh, st.t, ground);
    fd.used = Math.floor(st.t / DAY); // broken today: its years unused count from now (sim/fields, VB-1527)
    tended(st, tile); // VB-091
    st.used.add(tile);
    woodTaken(st, tile); // a wood tile broken to a field leaves its village's wood (VB-326)
    const fresh = !w.dev[tile];
    w.dev[tile] = 1;
    if (fresh) costChanged(st, tile); // developed ground walks as open ground (sim/routes, tileCost)
    st.biomeDirty.add(tile);
    return fd;
  }
  return { finishFell, finishGrub, finishClear, clearStones, finishBreak, broken };
})();
