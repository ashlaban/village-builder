// @sys sim/clock: the hourly step, end of day, new year and Sim.advance
VB['sim/clock'] = (() => {
  const { DAY, SEASON_DAYS, YEAR_DAYS, YEAR, cal, WORK } = VB['sim/rules'];
  const { log, age } = VB['sim/records'];
  const { growTrees } = VB['sim/forest'];
  const { B } = VB['gen'];
  const { bfs } = VB['sim/hex'];
  const { refreshRoutes } = VB['sim/routes'];
  const { feedHousehold } = VB['sim/hunger'];
  const { homeSpot, release, wantsWork, idleAbout, goHome, stepWork, moveAgent } = VB['sim/agents'];
  const { refreshJobs, callCooks, planRound } = VB['sim/jobs'];
  const { noteContacts } = VB['sim/society'];
  const { holdMeetings, movingRound, dailyLife } = VB['sim/lifecycle'];
  const { dailyBirths } = VB['sim/births'];
  // Scrub is the first step of forest spread, so it only comes to fields with woodland within 2 steps.
  function nearForest(w, tile) {
    for (const j of bfs(w, tile, 2, () => true).dist.keys()) if (w.biome[j] === B.FOREST || w.biome[j] === B.PINE) return true;
    return false;
  }
  function onHour(st, h, c) {
    if (st.cenv) noteContacts(st);
    if (st.cenv && c.season === 2 && c.sday === 9 && h === 12) holdMeetings(st);
    if (st.cenv && c.season === 2 && c.sday === 10 && h === 12) movingRound(st);
    if (h === 6) for (const a of st.agents) if (a.inside && !a.job && st.pawns[a.id].alive) { const [x, y] = homeSpot(st, a); a.x = x; a.y = y; }
    if (h >= WORK[0] - 1 && h <= WORK[1]) refreshJobs(st, c);
    if (h >= 14 && h < WORK[1]) callCooks(st, c);
    if (h === WORK[1]) for (const a of st.agents) {
      if (st.pawns[a.id].died) continue;
      if (a.phase === 'back') continue; // finish the delivery first
      release(st, a);
      if (!a.inside) { goHome(st, a); a.phase = 'home'; }
    }
    if (h === 0) { endOfDay(st, c); if (st.cenv) { dailyLife(st, c); dailyBirths(st); } if (c.doy === 0) newYear(st, c); }
  }
  function endOfDay(st, c) {
    const E = st.ECON;
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      feedHousehold(st, hh);
      hh.wood = Math.max(0, hh.wood - E.woodUse[c.season]);
    }
    growTrees(st);
    refreshRoutes(st);
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
        fd.stage = 'stubble'; fd.sown = null; fd.held = 0; log(st, `A crop at ${f.name} was lost to frost.`);
      }
    }
    const decay = E.fenceDecay[c.season];
    const all = [...st.villages.flatMap((v) => v.fence), ...st.farmsteads.flatMap((f) => f.fence || [])];
    // empty farms decay: buildings lose about 8% a year, untended fields go to grass and then scrub
    for (const f of st.farmsteads) if (f.household === null) {
      f.condition = Math.max(0, (f.condition ?? 1) - 0.08 / YEAR_DAYS);
      const yrs = (st.t - f.emptySince) / YEAR;
      if (f.state === 'derelict' && f.condition < 0.15) { f.state = 'ruin'; st.visualDirty = true; }
      for (const fd of f.fields) {
        const want = yrs > 8 && nearForest(st.w, fd.tile) || fd.stage === 'scrub' ? 'scrub' : yrs > 1 ? 'fallow' : fd.stage;
        if (fd.stage !== want) { fd.stage = want; st.visualDirty = true; }
      }
    }
    for (const s of all) {
      const before = s.cond; s.cond = Math.max(0, s.cond - decay * (0.5 + st.rand())); if ((before >= 0.45) !== (s.cond >= 0.45)) s.dirty = true;
    }
  }
  function newYear(st, c) {
    st.weather = 0.75 + st.rand() * 0.45;
    const word = st.weather > 1.05 ? 'promises a good year' : st.weather < 0.88 ? 'looks poor' : 'looks ordinary';
    log(st, `Year ${c.year} begins. The weather ${word}.`);
    for (const hh of st.households) hh.ledger = hh.ledger.filter((e) => st.t - e.t < YEAR * 3);
  }
  function advance(st, hours) {
    let left = hours;
    while (left > 1e-9) {
      const step = Math.min(left, 0.1);
      const before = Math.floor(st.t + 1e-9);
      st.t += step; left -= step;
      const after = Math.floor(st.t + 1e-9);
      for (let hh = before + 1; hh <= after; hh++) onHour(st, ((hh % DAY) + DAY) % DAY, cal(hh));
      const c = cal(st.t), idle = [];
      for (const a of st.agents) {
        if (st.pawns[a.id].died) continue;
        if (a.path) moveAgent(st, a, step);
        else if (a.phase === 'work') stepWork(st, a, step);
        else if (wantsWork(st, a, c)) idle.push(a);
      }
      if (idle.length) { const got = planRound(st, idle, c); for (const a of idle) if (!got.has(a)) idleAbout(st, a); }
    }
  }
  return { onHour, endOfDay, newYear, advance };
})();
