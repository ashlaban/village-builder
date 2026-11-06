// @sys sim/fields: new fields, crop lifecycle and daily growth, weeding, frost and abandonment; soil and manure
VB['sim/fields'] = (() => {
  const { B } = VB['gen'];
  const { next: rnd } = VB['sim/rng'];
  const { ECON, FIELDS, SOIL, farmable, fertility, DAY, SEASON_DAYS, YEAR_DAYS, YEAR } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { age, log, atFarm } = VB['sim/records'];
  const { nextTo } = VB['sim/layout'];
  const { freeFor } = VB['sim/territory'];
  const { stake, realiseStake, contestable, contest } = VB['sim/stakes'];
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
  // The best farmable tile within reach of the house that the household may take in (its village's outland or wilderness, sim/territory),
  // not on a river and not next to a house or green: fertile (watered by one), few stones, near, and 1 better when it touches one of the
  // farm's fields, so the fields grow as one block (VB-109). Open meadow always comes first; heath, hills or marsh (poorer, by FERTILITY)
  // only when no meadow is free (balance review: where land ran short, poorer land was taken in). -1 when there is none. `free`: whether the
  // household may take a tile in (a stake it may contest, for sim/stakes).
  function chooseTile(st, f, free = (t) => freeFor(st, t, f.village)) {
    const w = st.w, built = builtTiles(st), own = new Set(f.fields.map((fd) => fd.tile));
    let best = -1, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, walkable(w)).dist) {
      if (d < 1 || !farmable(w, t) || !free(t) || built.has(t) || st.used.has(t) || nextTo(w, t, built)) continue;
      const s = fertility(w, t) - 0.5 * w.stones[t] / 255 - 0.15 * d + (nextTo(w, t, own) ? 1 : 0) - (w.biome[t] === B.MEADOW ? 0 : 2);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  // A household with fewer fields than it wants, none in progress, picks a tile and stakes it (sim/stakes): the project starts with clearing.
  // With no free tile within reach, it may contest the best tile another household of its village staked and left unworked.
  function startProject(st, f, hh) {
    if (f.project || f.fields.length >= fieldsWanted(st, hh)) return;
    let tile = chooseTile(st, f);
    if (tile < 0) {
      tile = chooseTile(st, f, (t) => contestable(st, t, f.village, hh.id) !== null);
      if (tile < 0 || !contest(st, f, hh, tile, 'field')) return;
    }
    stake(st, hh, tile, 'field');
    f.project = { tile, stage: 'clear', hours: clearHours(st, tile) };
  }
  // Clearing done: the stones go to the household's store, the tile is bare ground.
  function finishClear(st, f, hh) {
    const w = st.w, tile = f.project.tile;
    hh.stone += Math.round(w.stones[tile] / STONES_PER_LOAD);
    w.stones[tile] = 0; f.project.stage = 'break'; f.project.hours = BREAK_HOURS;
    st.biomeDirty.add(tile);
  }
  // Breaking done: the stake is the household's own land, a field in stubble; on ground never farmed (w.dev 0) its soil starts fresh
  // (SOIL.fresh, VB-149).
  function finishBreak(st, f) {
    const w = st.w, tile = f.project.tile;
    realiseStake(st, st.households[f.household], tile);
    f.fields.push({ id: f.fields.length, tile, stage: 'stubble', sown: null, reaped: null, held: 0, fert: fertility(w, tile),
      soil: w.dev[tile] ? SOIL.start : SOIL.fresh, weedOpen: false, weedPosted: null, weedMiss: 0 });
    f.project = null; st.used.add(tile); w.dev[tile] = 1;
    st.visualDirty = true; st.biomeDirty.add(tile);
    log(st, `${f.name} has broken a new field.`, { kind: 'field', ...atFarm(f) });
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
  // The manure is spread: each load the job carried raises the soil, as far as the heap still holds it; never below a fresh field's soil.
  function manureDone(st, fd, hh, loads) {
    const n = Math.max(0, Math.min(loads, hh.manure));
    hh.manure -= n; fd.soil = Math.max(fd.soil, Math.min(SOIL.cap, fd.soil + n * SOIL.perLoad));
  }
  // @state farmstead.fields[]: crop stage, sown/reaped days, held sheaves and weeding progress; changed only here after seeding.
  const hoed = (fd) => { fd.stage = 'plowed'; };
  function sown(fd, c) {
    fd.stage = 'sown'; fd.sown = c.day;
    fd.weedOpen = false; fd.weedPosted = null; fd.weedMiss = 0;
  }
  function reaped(st, fd, c) {
    const E = st.ECON;
    fd.stage = 'stooks'; fd.reaped = c.day;
    fd.held = Math.round(E.fieldYield * fd.fert * fd.soil * st.weather * (0.9 + rnd(st.rng.fields) * 0.2)
      * (1 - Math.min(E.weedCutMax, E.weedCut * fd.weedMiss)));
    wearSoil(fd); // the crop takes from the soil (VB-137)
    fd.weedOpen = false; fd.weedPosted = null; fd.weedMiss = 0;
  }
  const hauled = (fd) => { fd.held = 0; fd.stage = 'stubble'; fd.sown = null; };
  function reclaimed(st, fd) {
    if (fd.stage === 'fallow' || fd.stage === 'scrub') { fd.stage = 'stubble'; st.visualDirty = true; }
  }
  const weeded = (fd) => { fd.weedOpen = false; };
  function abandoned(f) {
    for (const fd of f.fields) { if (fd.stage !== 'stubble') fd.held = 0; fd.stage = 'stubble'; fd.sown = null; }
  }
  // Scrub is the first step of forest spread, so it only comes to fields with woodland within 2 steps.
  function nearForest(w, tile) {
    for (const j of bfs(w, tile, 2, () => true).dist.keys()) if (w.biome[j] === B.FOREST || w.biome[j] === B.PINE) return true;
    return false;
  }
  // Daily crop rules, after routes and before buildings and fences decay. No random draws.
  function fieldsDay(st, c) {
    const E = st.ECON;
    const day = Math.floor(st.t / DAY);
    for (const f of st.farmsteads) for (const fd of f.fields) {
      if (f.household === null || fd.sown === null || fd.stage === 'stooks') continue;
      const g = day - fd.sown;
      if (g >= E.ripeAfterDays) fd.stage = 'ripe';
      else if (g >= 3 && fd.stage === 'sown') fd.stage = 'growing';
    }
    // upkeep: a growing field wants weeding every E.weedEvery days; a job still open when the next falls due counts as missed
    for (const f of st.farmsteads) for (const fd of f.fields) {
      if (f.household === null || fd.stage !== 'growing') continue;
      if (fd.weedPosted !== null && day - fd.weedPosted < E.weedEvery) continue;
      if (fd.weedOpen) fd.weedMiss++;
      fd.weedOpen = true; fd.weedPosted = day;
    }
    if (c.season === 2 && c.sday === SEASON_DAYS - 1) for (const f of st.farmsteads) for (const fd of f.fields) {
      if (f.household !== null && ['ripe', 'growing', 'stooks'].includes(fd.stage)) {
        fd.stage = 'stubble'; fd.sown = null; fd.held = 0; log(st, `A crop at ${f.name} was lost to frost.`, { kind: 'frost', ...atFarm(f) });
      }
    }
    // Untended fields go to grass and then scrub, unless a claimant is restoring the farm.
    for (const f of st.farmsteads) if (f.household === null && !f.claim) {
      const yrs = (st.t - f.emptySince) / YEAR;
      for (const fd of f.fields) {
        const want = yrs > 8 && nearForest(st.w, fd.tile) || fd.stage === 'scrub' ? 'scrub' : yrs > 1 ? 'fallow' : fd.stage;
        if (fd.stage !== want) { fd.stage = want; st.visualDirty = true; }
      }
    }
  }
  return { hoed, sown, reaped, hauled, reclaimed, weeded, abandoned, fieldsDay, BREAK_HOURS, clearHours, yearlyRations, fieldsWorkable, fieldsWanted,
    builtTiles, chooseTile, startProject, finishClear, finishBreak, wearSoil,
    manureWanted, manureDone };
})();
