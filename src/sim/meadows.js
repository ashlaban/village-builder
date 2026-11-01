// @sys sim/meadows: hay meadows as built land: a tile's worth as meadow, choosing one, the meadow project, and the meadows of generated farms
VB['sim/meadows'] = (() => {
  const { B } = VB['gen'];
  const { byRiver, SEASON_DAYS } = VB['sim/rules'];
  const { bfs } = VB['sim/hex'];
  const { walkable } = VB['sim/routes'];
  const { log } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const { nextTo } = VB['sim/layout'];
  const { winterNeed } = VB['sim/herds'];
  const { builtTiles } = VB['sim/fields'];
  // A meadow tile yields HAY × its site value a year in an ordinary year (VB-132): open meadow 1, marsh 0.8, heath 0.6, and 1.3 times that on
  // wet ground by a river or open water. A household with animals wants meadows for WANT × its winter's need, at most MAX; it looks for them
  // within REACH walking steps. Clearing takes CLEAR_HOURS and up to STONE_HOURS for the stones, down to KEEP_STONES of 255.
  const HAY = 30, WANT = 1.2, MAX = 6, START_MAX = 4, REACH = 6, CLEAR_HOURS = 4, STONE_HOURS = 10, KEEP_STONES = 80, STONES_PER_LOAD = 25;
  const SITE = { [B.MEADOW]: 1, [B.MARSH]: 0.8, [B.HEATH]: 0.6 };
  function wetBank(w, i) {
    if (byRiver(w, i)) return true;
    for (let k = 0; k < 6; k++) { const j = w.nb[i * 6 + k]; if (j >= 0 && w.water[j]) return true; }
    return false;
  }
  const meadowFert = (w, i) => (SITE[w.biome[i]] || 0) * (wetBank(w, i) ? 1.3 : 1);
  // Hay a farm's meadows give in an ordinary year, before raking and weather.
  const expectedHay = (f) => f.meadows.reduce((s, m) => s + HAY * m.fert, 0);
  // The best free tile for a hay meadow within REACH of the house, or -1: open meadow, marsh or heath, not a river or water tile, unowned
  // and unused, not next to a house or green; by site value, near, few stones, beside the farm's meadows, and away from its fields' block.
  function chooseMeadow(st, f) {
    const w = st.w, built = builtTiles(st), own = new Set(f.meadows.map((m) => m.tile)), fields = new Set(f.fields.map((fd) => fd.tile));
    let best = -1, bs = -Infinity;
    for (const [t, d] of bfs(w, f.house, REACH, walkable(w)).dist) {
      if (d < 1 || !SITE[w.biome[t]] || w.river[t] || w.water[t] || st.owner[t] !== 0 || st.used.has(t) || built.has(t) || nextTo(w, t, built)) continue;
      const s = meadowFert(w, t) - 0.06 * d - (0.3 * w.stones[t]) / 255 + (nextTo(w, t, own) ? 0.3 : 0) - (nextTo(w, t, fields) ? 0.5 : 0);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  const wantsMeadow = (st, f, hh) => hh.herds.length > 0 && f.meadows.length < MAX && expectedHay(f) < WANT * winterNeed(st, hh);
  // The tile becomes the household's meadow: owned, in use, developed (no path wears on it, the settlement layer draws it).
  function addMeadow(st, f, hh, tile) {
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.meadows.push({ id: f.meadows.length, tile, stage: 'grass', fert: meadowFert(st.w, tile), raked: false, mown: null, held: 0 });
    st.used.add(tile); st.w.dev[tile] = 1; st.biomeDirty.add(tile);
  }
  // A household with animals and no land project, short of meadow for its herds' winter, claims a tile and starts clearing it (founders).
  function startMeadow(st, f, hh) {
    if (f.project || !wantsMeadow(st, f, hh)) return;
    const tile = chooseMeadow(st, f);
    if (tile < 0) return;
    setOwner(st, tile, { type: 'household', id: hh.id });
    f.project = { tile, stage: 'meadow', hours: CLEAR_HOURS + (STONE_HOURS * Math.max(0, st.w.stones[tile] - KEEP_STONES)) / (255 - KEEP_STONES) };
  }
  // Cleared: the worst stones go to the household's store and the tile is a meadow from now on.
  function finishMeadow(st, f, hh) {
    const w = st.w, tile = f.project.tile, gone = Math.max(0, w.stones[tile] - KEEP_STONES);
    hh.stone += Math.round(gone / STONES_PER_LOAD); w.stones[tile] -= gone;
    f.project = null;
    addMeadow(st, f, hh, tile);
    st.visualDirty = true;
    log(st, `${f.name} has made a new hay meadow.`);
  }
  // Generated farms (populous, heirs) have stood a while: each with animals has its meadows already, at most START_MAX.
  function placeMeadows(st) {
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const f = st.farmsteads[hh.farmstead];
      while (f.meadows.length < START_MAX && wantsMeadow(st, f, hh)) {
        const tile = chooseMeadow(st, f);
        if (tile < 0) break;
        addMeadow(st, f, hh, tile);
      }
    }
  }
  // ---- haymaking (VB-133): rake in spring, mow from summer day 1 to autumn day 3, dry a day, carry to the barn ----
  // Raking (fagning) on spring days 1-10; a meadow not raked gives UNRAKED of its hay.
  const RAKE_DAYS = 10, UNRAKED = 0.8, MOW_LAST = 2, DRY_DAYS = 1;
  // Days into the haymaking window, or -1 outside it.
  const hayDay = (c) => (c.season === 1 ? c.sday : c.season === 2 && c.sday <= MOW_LAST ? SEASON_DAYS + c.sday : -1);
  // Hay is wanted while the barn and the hay lying mown hold less than ENOUGH winters' need of the household's animals now; a household with
  // none mows nothing (balance review: a farm whose herds were gone mowed 3,893 hay that nothing would eat).
  const ENOUGH = 2;
  function hayWanted(st, f, hh) {
    const need = winterNeed(st, hh);
    return need > 0 && hh.hay + f.meadows.reduce((s, m) => s + (m.stage === 'mown' ? m.held : 0), 0) < ENOUGH * need;
  }
  // The jobs a meadow posts now: [key, kind, extra]; refreshJobs posts them for the meadow's household. Raking and mowing only while hay is
  // wanted (`want`); hay already mown is always carried in.
  function meadowJobs(f, m, c, want = true) {
    const k = `f${f.id}.m${m.id}`, out = [];
    if (want && m.stage === 'grass' && !m.raked && c.season === 0 && c.sday < RAKE_DAYS) out.push(['rake:' + k, 'rake']);
    if (want && m.stage === 'grass' && hayDay(c) >= 0) out.push(['mow:' + k, 'mow']);
    if (m.stage === 'mown' && c.day >= m.mown + DRY_DAYS) out.push(['hay:' + k, 'hay']);
    return out;
  }
  // Mown: the meadow holds its year's hay, by site, weather and raking.
  function mowDone(st, m, c) {
    m.stage = 'mown'; m.mown = c.day;
    m.held = Math.round(HAY * m.fert * st.weather * (m.raked ? 1 : UNRAKED) * (0.9 + st.rand() * 0.2));
  }
  // Carried home: the hay goes into the household's barn; once the farm's last meadow is in, the log says how it stands for the winter.
  function hayIn(st, m, hh, f) {
    hh.hay += m.held; m.held = 0; m.stage = 'aftermath';
    if (f.meadows.some((q) => q.stage !== 'aftermath')) return;
    const need = winterNeed(st, hh), short = need > hh.hay;
    log(st, `${f.name} has its hay in: ${Math.round(hh.hay)} for a winter's need of ${Math.round(need)}${short ? '; it is short' : ''}.`);
  }
  // Once a game day, at its start: each spring the meadows are grass again; hay still lying at the autumn frost rots.
  function meadowsDay(st, c) {
    for (const f of st.farmsteads) for (const m of f.meadows) {
      if (c.doy === 0) { m.stage = 'grass'; m.raked = false; m.mown = null; m.held = 0; }
      if (c.season === 2 && c.sday === SEASON_DAYS - 1 && m.stage === 'mown') {
        m.stage = 'aftermath'; m.held = 0;
        if (f.household !== null) log(st, `Hay left lying at ${f.name} has rotted.`);
      }
    }
  }
  return {
    HAY, UNRAKED, ENOUGH, hayDay, hayWanted, meadowJobs, mowDone, hayIn, meadowsDay, meadowFert, expectedHay, chooseMeadow, wantsMeadow, addMeadow, startMeadow,
    finishMeadow, placeMeadows,
  };
})();
