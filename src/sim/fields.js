// @sys sim/fields: making new fields: how many a household wants, choosing a tile, clearing it and breaking the ground; soil and manure
VB['sim/fields'] = (() => {
  const { B } = VB['gen'];
  const { ECON, FIELDS, SOIL, farmable, fertility, DAY, YEAR_DAYS } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { age, log } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { nextTo } = VB['sim/layout'];
  const { team } = VB['sim/herds'];
  const REACH = 4, SCRUB_HOURS = 10, STONE_HOURS = 20, BREAK_HOURS = 30, STONES_PER_LOAD = 25;
  // Rations a household eats in a full year of 48 days.
  function yearlyRations(st, hh) {
    let n = 0;
    for (const id of hh.members) { const p = st.pawns[id]; if (p.died === null) n += age(st, p) >= 14 ? ECON.ration.adult : ECON.ration.child; }
    return n * YEAR_DAYS;
  }
  // Fields its hands can till: FIELDS.perHand for each working adult, and more with a team of oxen.
  function fieldsWorkable(st, hh) {
    let hands = 0;
    for (const id of hh.members) { const p = st.pawns[id], a = age(st, p); if (p.died === null && a >= 14 && a < 60 && !p.retired) hands++; }
    return Math.floor(hands * FIELDS.perHand + (team(st, hh) ? FIELDS.oxenHands : 0));
  }
  // Fields a household wants: enough for its food (FIELDS.want of its rations at FIELDS.expect of the full yield), as many as its hands can till.
  const fieldsWanted = (st, hh) => Math.max(1, Math.min(fieldsWorkable(st, hh),
    Math.ceil((FIELDS.want * yearlyRations(st, hh)) / (FIELDS.expect * ECON.fieldYield))));
  // Hours of clearing a tile: scrub, plus the stones in proportion.
  const clearHours = (st, tile) => SCRUB_HOURS + (STONE_HOURS * st.w.stones[tile]) / 255;
  // Houses and greens, standing or planned (a plot's house): no field is made next to one (VB-113).
  function builtTiles(st) {
    const out = new Set(st.villages.map((v) => v.center));
    for (const f of st.farmsteads) out.add(f.house);
    for (const v of st.villages) for (const p of v.plots || []) for (const tr of p.tiles) if (tr.kind === 'house') out.add(tr.tile);
    return out;
  }
  // The best unowned farmable tile within reach of the house, not on a river and not next to a house or green: fertile (watered by one),
  // few stones, near, and 1 better when it touches one of the farm's fields, so the fields grow as one block (VB-109). Open meadow always
  // comes first; heath, hills or marsh (poorer, by FERTILITY) only when no meadow is free (balance review: where land ran short, poorer land
  // was taken in). -1 when there is none.
  function chooseTile(st, f) {
    const w = st.w, built = builtTiles(st), own = new Set(f.fields.map((fd) => fd.tile));
    let best = -1, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, walkable(w)).dist) {
      if (d < 1 || !farmable(w, t) || st.owner[t] !== 0 || built.has(t) || st.used.has(t) || nextTo(w, t, built)) continue;
      const s = fertility(w, t) - 0.5 * w.stones[t] / 255 - 0.15 * d + (nextTo(w, t, own) ? 1 : 0) - (w.biome[t] === B.MEADOW ? 0 : 2);
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
    f.fields.push({ id: f.fields.length, tile, stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, tile),
      soil: SOIL.start, weedOpen: false, weedPosted: null, weedMiss: 0 });
    f.project = null; st.used.add(tile); w.dev[tile] = 1;
    st.visualDirty = true; st.biomeDirty.add(tile);
    log(st, `${f.name} has broken a new field.`);
  }
  // ---- soil and manure (VB-137) ----
  // A reaped crop wears the field's soil.
  const wearSoil = (fd) => { fd.soil = Math.max(SOIL.floor, fd.soil - SOIL.wear); };
  // In spring, while the heap holds a load, manure goes to the field with the poorest soil that is not yet sown: [field, loads] or null.
  function manureWanted(f, hh, c) {
    if (c.season !== 0 || c.sday < SOIL.window[0] || c.sday > SOIL.window[1] || !(hh.manure >= 1)) return null;
    let best = null;
    for (const fd of f.fields) {
      if ((fd.stage !== 'stubble' && fd.stage !== 'plowed') || fd.soil >= SOIL.cap - 1e-9) continue;
      if (!best || fd.soil < best.soil) best = fd;
    }
    return best ? [best, Math.min(hh.manure, (SOIL.cap - best.soil) / SOIL.perLoad)] : null;
  }
  // The manure is spread: each load the job carried raises the soil, as far as the heap still holds it.
  function manureDone(st, fd, hh, loads) {
    const n = Math.max(0, Math.min(loads, hh.manure));
    hh.manure -= n; fd.soil = Math.min(SOIL.cap, fd.soil + n * SOIL.perLoad);
  }
  return { BREAK_HOURS, clearHours, yearlyRations, fieldsWorkable, fieldsWanted, builtTiles, chooseTile, startProject, finishClear, finishBreak, wearSoil,
    manureWanted, manureDone };
})();
