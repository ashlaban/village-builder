// @sys sim/jobs: job board: posting, ownership checks, urgency, bidding, and leaving a job for a more urgent one
VB['sim/jobs'] = (() => {
  const { WORK, ROLES, CHILD, PLOT_PRIO, MATCH, cal } = VB['sim/rules'];
  const { dailyNeed, seedReserve } = VB['sim/hunger'];
  const { hexSteps } = VB['sim/hex'];
  const { villageOf, age } = VB['sim/records'];
  const { start, release, ownerKey, dropJob, rateOf } = VB['sim/agents'];
  const { KINDS, woodGoal, isOpen } = VB['sim/kinds'];
  const { startProject, manureWanted } = VB['sim/fields'];
  const { startMeadow, meadowJobs, hayWanted } = VB['sim/meadows'];
  const { byreJobs } = VB['sim/byre'];
  const { plotJobs } = VB['sim/expansion'];
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  function post(st, key, kind, owner, site, extra) {
    let j = st.jobs.get(key);
    if (!j) { j = { id: ++st.jobSeq, key, kind, owner, site, done: 0, claims: [], posted: st.t, ...extra }; st.jobs.set(key, j);
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
      if (!j || j.claims.length || !cookWanted(st, hh, c)) continue;
      let best = null, top = 0;
      for (const id of hh.members) {
        const p = st.pawns[id], pr = ROLES[p.role].prio.cook || 0;
        if (p.died === null && pr > top) { best = st.agents[id]; top = pr; }
      }
      if (best && best.job && (best.phase === 'work' || best.phase === 'go')) { release(st, best); start(st, best, j); }
    }
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
      const hayW = f.meadows.length ? hayWanted(st, f, hh) : false;
      for (const m of f.meadows) for (const [key, kind] of meadowJobs(f, m, c, hayW)) post(st, key, kind, own, m.tile, { meadow: m, farm: f });
      const dung = manureWanted(f, hh, c); // VB-137
      if (dung) post(st, `manure:f${f.id}.${dung[0].id}`, 'manure', own, dung[0].tile, { field: dung[0], farm: f, hours: dung[1] });
      if (hh.herds.length || hh.larder.length) for (const [key, kind, extra] of byreJobs(st, hh, c)) post(st, key, kind, own, f.house, { farm: f, ...extra });
      // a household looks for land for a new field, or a meadow once the fields are enough, once a day at the start of work (balance review:
      // households in every scenario look, and those short of land searched in vain every hour)
      if (st.makeFields && c.hour === WORK[0]) { startProject(st, f, hh); startMeadow(st, f, hh); }
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
    for (const j of st.jobs.values()) if (!j.live && !j.claims.length) dropJob(st, j);
  }
  function mayTake(st, p, j) {
    if (j.owner.type === 'household') return j.owner.id === p.household;
    if (j.owner.type === 'village') return villageOf(st, p) === j.owner.id;
    return true;
  }
  // A job's weight in a bid, as its kind says (sim/kinds).
  const urgency = (st, j, c) => (KINDS[j.kind].urgency ? KINDS[j.kind].urgency(st, j, c, MATCH.urgency) : MATCH.urgency.other);
  // Matching, not first-come: every idle pawn bids for every open job it may take, and the best fits are
  // assigned first. A poor fit (role priority 2 or less) only bids once the job has waited two hours. A job that k pawns already
  // work gets join^k of the bid (VB-102).
  const plotPrio = (st, p) => (st.demand.includes(p.id) ? PLOT_PRIO.waiting : PLOT_PRIO[p.role] || 0);
  const floored = (pr, v) => (pr > MATCH.poorFit ? Math.max(v, MATCH.floor) : v);
  // A pawn's noise-free score for a job, before the join factor; null when the pawn will not take it: a child under 7, not its work,
  // or a poor fit for a job that has not waited long enough.
  function score(st, p, j, c) {
    if (p.role === 'child' && age(st, p) < CHILD.from) return null;
    const pr = j.plot ? plotPrio(st, p) : ROLES[p.role].prio[j.kind] || 0;
    if (pr <= 0 || (pr <= MATCH.poorFit && st.t - j.posted < MATCH.poorFitWaitHours)) return null;
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    return floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
  }
  function bid(st, a, j, c) {
    const p = st.pawns[a.id];
    if (!isOpen(j) || !mayTake(st, p, j)) return -1;
    const s = score(st, p, j, c);
    return s === null ? -1 : (s + st.rand() * MATCH.noise) * MATCH.join ** j.claims.length;
  }
  // The jobs a pawn may bid for: its household's and its village's, in increasing id.
  const none = new Set();
  const jobsFor = (st, p) => mergeById(st.jobsBy.get(`household:${p.household}`) || none, st.jobsBy.get(`village:${villageOf(st, p)}`) || none);
  // VB-107: at each full hour of the working day, a pawn at work (not walking there, not carrying home) looks up from its job. When an open
  // job it may take bids, without noise, above switchRatio × its own job's bid + switchMargin, it leaves its job, which keeps its progress,
  // and starts the other. A job it would finish within the hour at its own rate is not left. Draws no random numbers.
  function lookUp(st, c) {
    for (const a of st.agents) {
      const p = st.pawns[a.id], j = a.job;
      if (a.phase !== 'work' || !j || p.died !== null) continue;
      if (((j.hours ?? KINDS[j.kind].hours) - j.done) <= rateOf(st, p)) continue;
      const own = (score(st, p, j, c) ?? 0) * MATCH.join ** (j.claims.length - 1);
      let best = null, top = MATCH.switchRatio * own + MATCH.switchMargin;
      for (const k of jobsFor(st, p)) {
        if (k === j || !isOpen(k)) continue;
        const s = score(st, p, k, c), b = s === null ? -1 : s * MATCH.join ** k.claims.length;
        if (b > top) { top = b; best = k; }
      }
      if (best) { release(st, a); start(st, a, best); }
    }
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
      if (!isOpen(j)) row.reason = 'taken';
      else if (pr <= 0 || (p.role === 'child' && age(st, p) < CHILD.from)) row.reason = 'not their work';
      else if (pr <= MATCH.poorFit && st.t - j.posted < MATCH.poorFitWaitHours) {
        row.reason = `poor fit, waits until ${clockText(j.posted + MATCH.poorFitWaitHours)}`;
      } else {
        row.bid = floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
        if (row.bid + MATCH.noise <= 0) { row.reason = 'not worth the walk'; row.bid = null; } else row.bid *= MATCH.join ** j.claims.length;
      }
      out.push(row);
    }
    return out.sort((x, y) => (y.bid ?? -Infinity) - (x.bid ?? -Infinity));
  }
  // One line for the pawn panel: the best reason an idle adult has no work; null when it has a job or it is not working time.
  function idleLine(st, id) {
    const a = st.agents[id], p = st.pawns[id], c = cal(st.t);
    if (!p.alive || a.job || a.phase === 'home' || c.hour < WORK[0] || c.hour >= WORK[1] || age(st, p) < CHILD.from) return null;
    const rows = explainIdle(st, id).filter((r) => r.reason !== 'taken' && r.reason !== 'not their work');
    if (!rows.length) return `No work for ${ROLES[p.role].title.toLowerCase()} at ${st.farmsteads[st.households[p.household].farmstead].name}`;
    const r = rows.find((x) => x.reason);
    if (!r) return null;
    return `${KINDS[r.kind].label}: ${r.reason}`;
  }
  // Two sets of jobs, each in increasing id, as one list in increasing id: the order st.jobs iterates in.
  function mergeById(x, y) {
    const a = [...x], b = [...y], out = [];
    let i = 0, k = 0;
    while (i < a.length || k < b.length) out.push(k >= b.length || (i < a.length && a[i].id < b[k].id) ? a[i++] : b[k++]);
    return out;
  }
  // Where a bid of score s goes in bids[from..], which is sorted best first: after every bid at least as good.
  function slot(bids, from, s) {
    let lo = from, hi = bids.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (bids[m][0] >= s) lo = m + 1; else hi = m; }
    return lo;
  }
  function planRound(st, idle, c) {
    const bids = [];
    for (const a of idle) for (const j of jobsFor(st, st.pawns[a.id])) { const s = bid(st, a, j, c); if (s > 0) bids.push([s, a, j, j.claims.length]); }
    bids.sort((x, y) => y[0] - x[0]);
    const busy = new Set();
    for (let i = 0; i < bids.length; i++) {
      const [s, a, j, k] = bids[i];
      if (busy.has(a) || !isOpen(j)) continue;
      // others joined the job earlier in this round: the bid falls by join for each, and waits its turn again
      if (j.claims.length > k) {
        const b = [s * MATCH.join ** (j.claims.length - k), a, j, j.claims.length];
        bids.splice(slot(bids, i + 1, b[0]), 0, b); continue;
      }
      start(st, a, j); busy.add(a);
    }
    return busy;
  }
  return { post, refreshJobs, callCooks, mayTake, urgency, score, bid, lookUp, planRound, explainIdle, idleLine };
})();
