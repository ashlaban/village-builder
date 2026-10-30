// @sys sim/fields: making new fields: how many a household wants, choosing a meadow tile, clearing it and breaking the ground
VB['sim/fields'] = (() => {
  const { B } = VB['gen'];
  const { ECON, FERTILITY, DAY, YEAR_DAYS } = VB['sim/rules'];
  const { bfs, land } = VB['sim/hex'];
  const { age, log } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const MAX_FIELDS = 4, REACH = 4, SCRUB_HOURS = 10, STONE_HOURS = 20, BREAK_HOURS = 30, STONES_PER_LOAD = 25;
  // Rations a household eats in a full year of 48 days.
  function yearlyRations(st, hh) {
    let n = 0;
    for (const id of hh.members) { const p = st.pawns[id]; if (p.died === null) n += age(st, p) >= 14 ? ECON.ration.adult : ECON.ration.child; }
    return n * YEAR_DAYS;
  }
  // Fields a household wants: enough for 110% of its rations at three quarters of the full yield, at most four.
  const fieldsWanted = (st, hh) => Math.min(MAX_FIELDS, Math.ceil((1.1 * yearlyRations(st, hh)) / (0.75 * ECON.fieldYield)));
  // Hours of clearing a tile: scrub, plus the stones in proportion.
  const clearHours = (st, tile) => SCRUB_HOURS + (STONE_HOURS * st.w.stones[tile]) / 255;
  // The best unowned meadow tile within reach of the house: fertile, few stones, near. -1 when there is none.
  function chooseTile(st, f) {
    const w = st.w, centres = new Set(st.villages.map((v) => v.center));
    let best = -1, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, land(w)).dist) {
      if (d < 1 || w.biome[t] !== B.MEADOW || st.owner[t] !== 0 || centres.has(t) || st.used.has(t)) continue;
      const s = FERTILITY[B.MEADOW] - 0.5 * w.stones[t] / 255 - 0.15 * d;
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  // A household with fewer fields than it wants, none in progress, picks a tile and takes it: the project starts with clearing.
  function startProject(st, f, hh) {
    if (f.project || f.fields.length >= fieldsWanted(st, hh)) return;
    const tile = chooseTile(st, f);
    if (tile < 0) return;
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.project = { tile, stage: 'clear', hours: clearHours(st, tile) };
  }
  // Clearing done: the stones go to the household's store, the tile is bare ground.
  function finishClear(st, f, hh) {
    const w = st.w, tile = f.project.tile;
    hh.stone += Math.round(w.stones[tile] / STONES_PER_LOAD);
    w.stones[tile] = 0; f.project.stage = 'break'; f.project.hours = BREAK_HOURS;
    st.biomeDirty.add(tile);
  }
  // Breaking done: the tile is a field in stubble.
  function finishBreak(st, f) {
    const w = st.w, tile = f.project.tile;
    f.fields.push({ id: f.fields.length, tile, stage: 'stubble', sown: null, reaped: null, held: 0, fert: FERTILITY[w.biome[tile]],
      weedOpen: false, weedPosted: null, weedMiss: 0 });
    f.project = null; st.used.add(tile); w.dev[tile] = 1;
    st.visualDirty = true; st.biomeDirty.add(tile);
    log(st, `${f.name} has broken a new field.`);
  }
  return { BREAK_HOURS, clearHours, yearlyRations, fieldsWanted, chooseTile, startProject, finishClear, finishBreak };
})();
