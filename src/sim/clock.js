// @sys sim/clock: the hourly step, end of day, new year and Sim.advance
VB['sim/clock'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, YEAR_DAYS, YEAR, cal, WORK, dark, SOCIAL } = VB['sim/rules'];
  const { log, foldHistory } = VB['sim/records'];
  const { growTrees } = VB['sim/forest'];
  const { fieldsDay } = VB['sim/fields'];
  const { refreshRoutes, costChanged } = VB['sim/routes'];
  const { fadeWear } = VB['sim/paths'];
  const { feedHousehold, spoilGrain } = VB['sim/hunger'];
  const Stores = VB['sim/stores'];
  const { reviewHour } = VB['sim/plans'];
  const { shareFood } = VB['sim/help'];
  const { placeByDoor, release, stepAgents } = VB['sim/agents'];
  const { refreshJobs, callCooks, lookUp, planRound, idleAbout } = VB['sim/jobs'];
  const { issue, commanded, unplanned, playerStep } = VB['sim/commands'];
  const { talkHour } = VB['sim/relations'];
  const { outdoors } = VB['sim/society'];
  const { meetingStage, MEETING_STAGES, movingRound, dailyLife } = VB['sim/lifecycle'];
  const { dailyBirths } = VB['sim/births'];
  const { herdsDay } = VB['sim/herds'];
  const { meadowsDay } = VB['sim/meadows'];
  const { byreDay } = VB['sim/byre'];
  const { lapseClaims } = VB['sim/claims'];
  const { lapsedStakes } = VB['sim/stakes'];
  const { lapsedFarmClaims } = VB['sim/farmclaims'];
  function onHour(st, h, c) {
    if (st.cenv && h >= SOCIAL.talk.from && h < SOCIAL.talk.to) talkHour(st, h, outdoors(st)); // talk, and the hours at home (sim/relations)
    if (st.cenv && c.season === 2 && c.sday === 10 && h === 12) movingRound(st);
    if (h === Math.ceil(dark(c)[1])) { // the dark ends: everyone indoors is by their door
      for (const id of st.living) {
        const a = st.agents[id];
        if (a.inside && !a.job) placeByDoor(st, a);
      }
    }
    if (reviewHour(h)) refreshJobs(st, c); // the review of the standing plans (sim/plans)
    if (h >= 14 && h < WORK[1]) callCooks(st, c);
    if (h >= WORK[0] && h < WORK[1]) lookUp(st, c); // more urgent work interrupts a job (VB-107)
    if (h === WORK[1]) for (const liveId of st.living) {
      const a = st.agents[liveId];
      if (st.pawns[a.id].died) continue;
      if (a.phase === 'back') continue; // finish the delivery first
      if (commanded(st, a.id)) continue; // the player's command says otherwise (VB-169)
      release(st, a);
      if (!a.inside) issue(st, { actor: a.id, verb: 'goHome', source: 'planner' });
    }
    if (h === 0) {
      endOfDay(st, c); herdsDay(st, c); meadowsDay(st, c); byreDay(st, c); // the animals (sim/herds, sim/meadows, sim/byre)
      if (st.cenv) { dailyLife(st, c); dailyBirths(st); }
      if (c.doy === 0) newYear(st, c);
      foldHistory(st, c); // the record's routine events, folded over the year's first days (sim/records, VB-199)
    }
  }
  function endOfDay(st, c) {
    const E = st.ECON;
    shareFood(st);
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      feedHousehold(st, hh); spoilGrain(st, hh);
      hh.wood = Math.max(0, hh.wood - E.woodUse[c.season]);
    }
    Stores.villageDay(st); // it spoils too (balance review)
    growTrees(st);
    const lapsed = lapseClaims(st); // unworked claims fade out after 3 years (sim/claims)
    lapsedStakes(st, lapsed); lapsedFarmClaims(st, lapsed); // a lapsed stake ends its project, a lapsed claim on an empty farm the claim
    fadeWear(st, (tile) => costChanged(st, tile)); // a path that changes stage changes the cost of walking it
    refreshRoutes(st);
    fieldsDay(st, c);
    const decay = E.fenceDecay[c.season];
    const all = [...st.villages.flatMap((v) => v.fence), ...st.farmsteads.flatMap((f) => f.fence || [])];
    // Empty buildings lose about 8% a year; not while a claimant mends the farm (VB-033).
    for (const f of st.farmsteads) if (f.household === null && !f.claim) {
      f.condition = Math.max(0, (f.condition ?? 1) - 0.08 / YEAR_DAYS);
      if (f.state === 'derelict' && f.condition < 0.15) { f.state = 'ruin'; st.visualDirty = true; }
    }
    for (const s of all) {
      const before = s.cond; s.cond = Math.max(0, s.cond - decay * (0.5 + rnd(st.rng.fences))); if ((before >= 0.45) !== (s.cond >= 0.45)) s.dirty = true;
    }
  }
  function newYear(st, c) {
    st.weather = 0.75 + rnd(st.rng.weather) * 0.45;
    const word = st.weather > 1.05 ? 'promises a good year' : st.weather < 0.88 ? 'looks poor' : 'looks ordinary';
    log(st, `Year ${c.year} begins. The weather ${word}.`, { kind: 'year', n: c.year });
    // Historical ledgers of dissolved households still expire at the new year.
    Stores.prune(st);
  }
  const TICKS = 10; // 6-minute steps an hour
  function advance(st, hours) {
    let left = hours;
    while (left > 1e-9) {
      const step = Math.min(left, 0.1);
      const before = Math.floor(st.t + 1e-9), tick = Math.floor(st.t * TICKS + 1e-4);
      st.t += step; left -= step;
      const after = Math.floor(st.t + 1e-9), ticked = Math.floor(st.t * TICKS + 1e-4);
      for (let hh = before + 1; hh <= after; hh++) onHour(st, ((hh % DAY) + DAY) % DAY, cal(hh));
      // The autumn meetings (customs, then the outland), a stage on each of the 6-minute steps from noon of autumn day 10 (sim/lifecycle, VB-206);
      // the step of the day says what is due, so a save between two stages goes on.
      if (st.cenv) for (let k = tick + 1; k <= ticked; k++) {
        const r = (((k % (DAY * TICKS)) + DAY * TICKS) % (DAY * TICKS)) - 12 * TICKS;
        if (r >= 0 && r < MEETING_STAGES) { const kc = cal(k / TICKS); if (kc.season === 2 && kc.sday === 9) meetingStage(st, r); }
      }
      playerStep(st); // the player's queue goes before the pawn's own logic (VB-169)
      const c = cal(st.t), all = stepAgents(st, step, c), idle = st.player ? all.filter((a) => !unplanned(st, a.id)) : all;
      if (idle.length) { const got = planRound(st, idle, c); for (const a of idle) if (!got.has(a)) idleAbout(st, a); }
    }
  }
  return { onHour, endOfDay, newYear, advance };
})();
