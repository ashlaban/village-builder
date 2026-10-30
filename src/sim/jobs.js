// @sys sim/jobs: job board: posting, ownership checks, urgency and bidding
VB['sim/jobs'] = (() => {
  const { WORK, ROLES } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { villageOf } = VB['sim/records'];
  const { start } = VB['sim/agents'];
  const { startProject } = VB['sim/fields'];
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  function post(st, key, kind, owner, site, extra) {
    let j = st.jobs.get(key);
    if (!j) { j = { id: ++st.jobSeq, key, kind, owner, site, done: 0, claim: null, posted: st.t, ...extra }; st.jobs.set(key, j); }
    j.live = true;
    return j;
  }
  function refreshJobs(st, c) {
    const E = st.ECON;
    for (const j of st.jobs.values()) j.live = false;
    const inWork = c.hour >= WORK[0] - 1 && c.hour < WORK[1];
    for (const f of st.farmsteads) {
      if (f.household === null) continue;
      const hh = st.households[f.household], own = { type: 'household', id: hh.id };
      for (const fd of f.fields) {
        const fk = `f${f.id}.${fd.id}`;
        const sowing = c.season === 0 && c.sday >= E.sowWindow[0] && c.sday <= E.sowWindow[1];
        if (sowing && fd.stage === 'stubble') post(st, 'plow:' + fk, 'plow', own, fd.tile, { field: fd, farm: f });
        if (sowing && fd.stage === 'plowed' && hh.grain >= E.seedPerField) post(st, 'sow:' + fk, 'sow', own, fd.tile, { field: fd, farm: f });
        if (fd.stage === 'growing' && fd.weedOpen) post(st, 'weed:' + fk, 'weed', own, fd.tile, { field: fd, farm: f });
        if (fd.stage === 'ripe') post(st, 'reap:' + fk, 'reap', own, fd.tile, { field: fd, farm: f });
        if (fd.stage === 'stooks' && c.day >= fd.reaped + E.dryDays) post(st, 'haul:' + fk, 'haul', own, fd.tile, { field: fd, farm: f });
      }
      if (st.makeFields) startProject(st, f, hh);
      if (f.project) post(st, `${f.project.stage}:f${f.id}`, f.project.stage, own, f.project.tile, { farm: f, hours: f.project.hours });
      if (f.woodlot >= 0 && hh.wood < E.woodTarget) {
        post(st, `wood:h${hh.id}`, 'wood', own, f.woodlot, { farm: f });
        if (hh.wood < E.woodTarget * 0.4) post(st, `wood:h${hh.id}b`, 'wood', own, f.woodlot, { farm: f });
      }
      if (hh.unthreshed.length) post(st, `thresh:h${hh.id}`, 'thresh', own, f.house, { farm: f });
      if (inWork && hh.waterDay !== c.day) post(st, `water:h${hh.id}:${c.day}`, 'water', own,
        st.villages[f.village].well ? st.villages[f.village].center : f.house, { farm: f });
      if (c.hour >= 14 && c.hour < WORK[1] && hh.cookDay !== c.day) post(st, `cook:h${hh.id}:${c.day}`, 'cook', own, f.house, { farm: f });
      if (f.fence) for (const s of f.fence) if (s.cond < E.fenceMendBelow) post(st, `mend:f${f.id}.${s.id}`, 'mend', own, s.tile, { stretch: s, farm: f });
    }
    for (const v of st.villages) for (const s of v.fence) if (s.cond < E.fenceMendBelow) {
      post(st, `mend:v${v.id}.${s.id}`, 'mend', { type: 'village', id: v.id }, s.tile, { stretch: s });
    }
    for (const [k, j] of st.jobs) if (!j.live && j.claim === null) st.jobs.delete(k);
  }
  function mayTake(st, p, j) {
    if (j.owner.type === 'household') return j.owner.id === p.household;
    if (j.owner.type === 'village') return villageOf(st, p) === j.owner.id;
    return true;
  }
  function urgency(st, j, c) {
    const E = st.ECON, hh = j.farm ? st.households[j.farm.household] : null;
    switch (j.kind) {
      case 'plow': case 'sow': return 1 + c.sday / 8;
      case 'reap': return 1.3 + (c.season === 2 ? c.sday / 5 : 0);
      case 'haul': return 1.1;
      case 'wood': return hh.wood < 8 ? 2.2 : (E.woodTarget - hh.wood) / E.woodTarget + (c.season === 2 ? 0.5 : 0);
      case 'water': return c.hour < 10 ? 1.4 : 1;
      case 'cook': return c.hour >= 15 ? 2.2 : 0.6;
      case 'mend': return (1 - j.stretch.cond) * 2;
    }
    return 1;
  }
  // Matching, not first-come: every idle pawn bids for every open job it may take, and the best fits are
  // assigned first. A poor fit (role priority 2 or less) only bids once the job has waited two hours.
  function bid(st, a, j, c) {
    const p = st.pawns[a.id];
    if (j.claim !== null || !mayTake(st, p, j)) return -1;
    const pr = ROLES[p.role].prio[j.kind] || 0;
    if (pr <= 0 || (pr <= 2 && st.t - j.posted < 2)) return -1;
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    return pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * 0.15 + st.rand() * 0.3;
  }
  function planRound(st, idle, c) {
    const bids = [];
    for (const a of idle) for (const j of st.jobs.values()) { const s = bid(st, a, j, c); if (s > 0) bids.push([s, a, j]); }
    bids.sort((x, y) => y[0] - x[0]);
    const busy = new Set();
    for (const [, a, j] of bids) { if (busy.has(a) || j.claim !== null) continue; start(st, a, j); busy.add(a); }
    return busy;
  }
  return { post, refreshJobs, mayTake, urgency, bid, planRound };
})();
