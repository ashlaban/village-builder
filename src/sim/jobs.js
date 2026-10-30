// @sys sim/jobs: job board: posting, ownership checks, urgency and bidding
VB['sim/jobs'] = (() => {
  const { WORK, ROLES, CHILD, PLOT_PRIO, MATCH, cal } = VB['sim/rules'];
  const { dailyNeed, seedReserve } = VB['sim/hunger'];
  const { hexSteps } = VB['sim/hex'];
  const { villageOf, age } = VB['sim/records'];
  const { start, release, ownerKey, dropJob } = VB['sim/agents'];
  const { startProject } = VB['sim/fields'];
  const { plotJobs } = VB['sim/expansion'];
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  function post(st, key, kind, owner, site, extra) {
    let j = st.jobs.get(key);
    if (!j) { j = { id: ++st.jobSeq, key, kind, owner, site, done: 0, claim: null, posted: st.t, ...extra }; st.jobs.set(key, j);
      const ok = ownerKey(owner); if (!st.jobsBy.has(ok)) st.jobsBy.set(ok, new Set());
      st.jobsBy.get(ok).add(j); }
    j.live = true;
    return j;
  }
  // The household has less cooked food than the coming meal needs, and grain to cook it from.
  const cookWanted = (st, hh, c) => hh.cookDay !== c.day && hh.rations < dailyNeed(st, hh) && hh.grain - seedReserve(st, hh) > 0;
  // From 14:00 a household short of rations calls its best cook off other work, unless that cook is idle (then matching sends them home).
  // The job it leaves is kept as it stands, with its progress.
  function callCooks(st, c) {
    for (const f of st.farmsteads) {
      const hh = f.household === null ? null : st.households[f.household];
      const j = hh && st.jobs.get(`cook:h${hh.id}:${c.day}`);
      if (!j || j.claim !== null || !cookWanted(st, hh, c)) continue;
      let best = null, top = 0;
      for (const id of hh.members) {
        const p = st.pawns[id], pr = ROLES[p.role].prio.cook || 0;
        if (p.died === null && pr > top) { best = st.agents[id]; top = pr; }
      }
      if (best && best.job && (best.phase === 'work' || best.phase === 'go')) { release(st, best); start(st, best, j); }
    }
  }
  // Firewood is laid in for the winter from summer on, so the pile is topped up higher then.
  const woodGoal = (E, c) => (c.season === 1 || c.season === 2 ? E.woodWinter : E.woodTarget);
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
      if (f.woodlot >= 0 && hh.wood < woodGoal(E, c)) {
        post(st, `wood:h${hh.id}`, 'wood', own, f.woodlot, { farm: f });
        if (hh.wood < E.woodTarget * 0.4) post(st, `wood:h${hh.id}b`, 'wood', own, f.woodlot, { farm: f });
      }
      if (hh.unthreshed.length) post(st, `thresh:h${hh.id}`, 'thresh', own, f.house, { farm: f });
      if (inWork && hh.waterDay !== c.day) post(st, `water:h${hh.id}:${c.day}`, 'water', own,
        st.villages[f.village].well ? st.villages[f.village].center : f.house, { farm: f });
      if (c.hour >= 14 && c.hour < WORK[1] && cookWanted(st, hh, c)) post(st, `cook:h${hh.id}:${c.day}`, 'cook', own, f.house, { farm: f });
      if (f.fence) for (const s of f.fence) if (s.cond < E.fenceMendBelow) post(st, `mend:f${f.id}.${s.id}`, 'mend', own, s.tile, { stretch: s, farm: f });
    }
    for (const v of st.villages) for (const s of v.fence) if (s.cond < E.fenceMendBelow) {
      post(st, `mend:v${v.id}.${s.id}`, 'mend', { type: 'village', id: v.id }, s.tile, { stretch: s });
    }
    for (const [key, kind, site, extra] of plotJobs(st)) post(st, key, kind, { type: 'village', id: extra.plot.village }, site, extra);
    for (const j of st.jobs.values()) if (!j.live && j.claim === null) dropJob(st, j);
  }
  function mayTake(st, p, j) {
    if (j.owner.type === 'household') return j.owner.id === p.household;
    if (j.owner.type === 'village') return villageOf(st, p) === j.owner.id;
    return true;
  }
  function urgency(st, j, c) {
    const E = st.ECON, U = MATCH.urgency, hh = j.farm ? st.households[j.farm.household] : null;
    switch (j.kind) {
      case 'plow': case 'sow': return U.field + c.sday / U.fieldPerDay;
      case 'reap': return U.reap + (c.season === 2 ? c.sday / U.reapFrostPerDay : 0);
      case 'haul': return U.haul;
      case 'wood': return hh.wood < U.woodLow ? U.woodLowUrgency : (woodGoal(E, c) - hh.wood) / woodGoal(E, c) + (c.season === 2 ? U.woodSummer : 0);
      case 'water': return c.hour < U.waterMorningHour ? U.waterMorning : U.water;
      case 'cook': return c.hour >= U.cookEveningHour ? U.cookEvening : U.cook;
      case 'mend': return (1 - j.stretch.cond) * U.mendPerCond;
    }
    return U.other;
  }
  // Matching, not first-come: every idle pawn bids for every open job it may take, and the best fits are
  // assigned first. A poor fit (role priority 2 or less) only bids once the job has waited two hours.
  const plotPrio = (st, p) => (st.demand.includes(p.id) ? PLOT_PRIO.waiting : PLOT_PRIO[p.role] || 0);
  const floored = (pr, v) => (pr > MATCH.poorFit ? Math.max(v, MATCH.floor) : v);
  function bid(st, a, j, c) {
    const p = st.pawns[a.id];
    if (j.claim !== null || !mayTake(st, p, j) || (p.role === 'child' && age(st, p) < CHILD.from)) return -1;
    const pr = j.plot ? plotPrio(st, p) : ROLES[p.role].prio[j.kind] || 0;
    if (pr <= 0 || (pr <= MATCH.poorFit && st.t - j.posted < MATCH.poorFitWaitHours)) return -1;
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    return floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight) + st.rand() * MATCH.noise;
  }
  // Why a pawn gets no job: every open job it may take with its noise-free bid, or the reason it gets none. Best first. Draws no random
  // numbers and writes nothing to st.
  const clockText = (t) => {
    const m = Math.ceil((((t % 24) + 24) % 24) * 60);
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  function explainIdle(st, id) {
    const p = st.pawns[id], c = cal(st.t), out = [];
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    for (const j of st.jobs.values()) {
      if (!mayTake(st, p, j)) continue;
      const pr = j.plot ? plotPrio(st, p) : ROLES[p.role].prio[j.kind] || 0, row = { job: j.key, kind: j.kind, bid: null, reason: null };
      if (j.claim !== null) row.reason = 'taken';
      else if (pr <= 0 || (p.role === 'child' && age(st, p) < CHILD.from)) row.reason = 'not their work';
      else if (pr <= MATCH.poorFit && st.t - j.posted < MATCH.poorFitWaitHours) {
        row.reason = `poor fit, waits until ${clockText(j.posted + MATCH.poorFitWaitHours)}`;
      } else {
        row.bid = floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
        if (row.bid + MATCH.noise <= 0) { row.reason = 'not worth the walk'; row.bid = null; }
      }
      out.push(row);
    }
    return out.sort((x, y) => (y.bid ?? -Infinity) - (x.bid ?? -Infinity));
  }
  // One line for the pawn panel: the best reason an idle adult has no work; null when it has a job or it is not working time.
  const LABEL = {
    plow: 'Hoeing', sow: 'Sowing', reap: 'Reaping', haul: 'Hauling sheaves', wood: 'Firewood', water: 'Water',
    thresh: 'Threshing', mend: 'Mending',
  };
  function idleLine(st, id) {
    const a = st.agents[id], p = st.pawns[id], c = cal(st.t);
    if (!p.alive || a.job || a.phase === 'home' || c.hour < WORK[0] || c.hour >= WORK[1] || age(st, p) < CHILD.from) return null;
    const rows = explainIdle(st, id).filter((r) => r.reason !== 'taken' && r.reason !== 'not their work');
    if (!rows.length) return `No work for ${ROLES[p.role].title.toLowerCase()} at ${st.farmsteads[st.households[p.household].farmstead].name}`;
    const r = rows.find((x) => x.reason);
    if (!r) return null;
    return `${LABEL[r.kind] || r.kind.replace(/^./, (ch) => ch.toUpperCase())}: ${r.reason}`;
  }
  // Two sets of jobs, each in increasing id, as one list in increasing id: the order st.jobs iterates in.
  function mergeById(x, y) {
    const a = [...x], b = [...y], out = [];
    let i = 0, k = 0;
    while (i < a.length || k < b.length) out.push(k >= b.length || (i < a.length && a[i].id < b[k].id) ? a[i++] : b[k++]);
    return out;
  }
  function planRound(st, idle, c) {
    const bids = [];
    const none = new Set();
    for (const a of idle) {
      const p = st.pawns[a.id], hj = st.jobsBy.get(`household:${p.household}`) || none, vj = st.jobsBy.get(`village:${villageOf(st, p)}`) || none;
      for (const j of mergeById(hj, vj)) { const s = bid(st, a, j, c); if (s > 0) bids.push([s, a, j]); }
    }
    bids.sort((x, y) => y[0] - x[0]);
    const busy = new Set();
    for (const [, a, j] of bids) { if (busy.has(a) || j.claim !== null) continue; start(st, a, j); busy.add(a); }
    return busy;
  }
  return { post, refreshJobs, callCooks, mayTake, urgency, bid, planRound, explainIdle, idleLine };
})();
