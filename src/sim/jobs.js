// @sys sim/jobs: job board: posting, ownership checks, urgency, bidding, and leaving a job for a more urgent one
VB['sim/jobs'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { WORK, ROLES, CHILD, PLOT_PRIO, MATCH, IDLE, TICKS, cal } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { villageOf, age } = VB['sim/records'];
  const { freeHands, ownerKey, dropJob, rateOf, tileAt, offerWhy, attentionOf, heldAt, workSpot } = VB['sim/agents'];
  const { companyFor } = VB['sim/relations'];
  const { issue, unplanned } = VB['sim/commands'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, ASK, cookWanted, isOpen } = VB['sim/kinds'];
  const { builtTiles } = VB['sim/fields'];
  const { claimPrio } = VB['sim/farmclaims'];
  const { planOf, reviewed, landStep, reviewWhy, mayLook, WINDOWED, dueNow, again, routineAsks, openOf } =
    VB['sim/plans'];
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  function post(st, key, kind, owner, site, extra) {
    let j = st.jobs.get(key);
    if (!j) {
      j = { id: ++st.jobSeq, key, kind, owner, site, done: 0, claims: [], posted: st.t, ...extra };
      st.jobs.set(key, j);
      if (KINDS[kind].draw) {
        const t = KINDS[kind].draw(st, j);
        if (t >= 0) j.site = t;
      }
      const ok = ownerKey(owner);
      if (!st.jobsBy.has(ok)) st.jobsBy.set(ok, new Set());
      st.jobsBy.get(ok).add(j);
    }
    j.live = true;
    return j;
  }
  // From 14:00 a household short of meals calls its best cook off other work, or from idling (waiting or out for company; not on its way
  // to an occasion): an idle cook looked for work only when its wait ended, often too late to finish the 2 hours before the end of work, and
  // the household ate uncooked (VB-119). The job it leaves is kept as it stands, with its progress.
  function callCooks(st, c) {
    VB.count.cookFarm += st.farmsteads.length;
    for (const f of st.farmsteads) {
      const hh = f.household === null ? null : st.households[f.household];
      const j = hh && st.jobs.get(`cook:h${hh.id}:${c.day}`);
      if (!j || j.claims.length || !cookWanted(st, hh, c)) continue;
      let best = null,
        top = 0;
      for (const id of hh.members) {
        const p = st.pawns[id],
          pr = ROLES[p.role].prio.cook || 0;
        if (p.died === null && pr > top && !unplanned(st, id)) {
          best = st.agents[id];
          top = pr;
        }
      }
      const idle = best && !best.job && best.phase === null && best.occasion === null;
      const called = best && (idle || (best.job && (best.phase === 'work' || best.phase === 'go')));
      if (called) issue(st, { actor: best.id, verb: 'work', target: j.key, source: 'planner' });
    }
  }
  // A plot's steps and an empty farm's restoration are asked for the whole island, every review hour, whoever owns them.
  const islandJob = (j) => !!j.plot || j.kind === 'restore';
  // The due-queue's ask of each time-bound kind: its own rule (a shared rule, as the byre's, posts only that kind there).
  const DUE_RULES = WINDOWED.map((k) => [[k, KINDS[k].available]]);
  // What a member without a task asks: the household's kinds but those the due-queue opens.
  const unwindowed = (rules) => rules.filter((e) => !WINDOWED.includes(e[0]));
  const LOOK = { farm: unwindowed(ASK.farm), farmAfterPlans: unwindowed(ASK.farmAfterPlans), fieldAt: {} };
  for (const [g, rules] of Object.entries(ASK.fieldAt)) {
    const kept = unwindowed(rules);
    if (kept.length) LOOK.fieldAt[g] = kept;
  }
  // A job no longer posted goes once nobody works it; a land project's at once, its hands freed (its project ended, sim/stakes).
  function sweep(st, j) {
    if (j.live || (j.claims.length && !KINDS[j.kind].project)) return;
    if (j.claims.length) freeHands(st, j, -1);
    dropJob(st, j);
  }
  // Each review hour (VB-249; design.md section 7, Planning days): the due-queue opens the time-bound kinds that fall due (sim/plans); each
  // holder whose plan is due a review (its planning day, a window closing, a store crossing a target) has it reviewed: each kind says where
  // it is available for the holder (sim/kinds, `available`), asked in the order of ASK, which is the jobs' ids; what it reports is posted
  // and the holder's tasks it no longer reports are taken down. Between reviews the tasks stand. `everyone` reviews every holder now (tests).
  function refreshJobs(st, c, everyone = false) {
    const hour = Math.floor(st.tick / TICKS);
    // a rule calls put for each job it would post: of the kind asked, owned by the farm's household, unless it names them; `only` keeps
    // the due-queue's ask to its kind
    let kind = null,
      own = null,
      only = null,
      gave = false;
    const put = (key, site, extra, k = kind, owner = own) => {
      if (only && k !== only) return;
      gave = true;
      post(st, key, k, owner, site, extra);
    };
    const ask = (rules, holder, at, f) => {
      VB.count.oppAsk += rules.length;
      for (let i = 0; i < rules.length; i++) {
        kind = rules[i][0];
        rules[i][1](st, holder, at, c, put, f);
      }
    };
    // ---- the due-queue: each entry asks its kind for its household, and takes down that kind's tasks it no longer reports ----
    const due = dueNow(st, hour),
      gaveAt = [];
    for (const [, id, k] of due) {
      const hh = st.households[id],
        K = WINDOWED[k],
        f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
      gave = false;
      if (f && f.household === id) {
        const mine = st.jobsBy.get(`household:${id}`);
        if (mine) for (const j of mine) if (j.kind === K) j.live = false;
        only = K;
        own = { type: 'household', id };
        const rule = DUE_RULES[k];
        if (KINDS[K].stages) {
          for (const fd of f.fields) if (KINDS[K].stages.includes(fd.stage)) ask(rule, hh, fd, f);
        } else ask(rule, hh, f, f);
        only = null;
        const now = st.jobsBy.get(`household:${id}`);
        if (now) for (const j of now) if (j.kind === K && !j.claims.length) sweep(st, j);
      }
      gaveAt.push(gave);
    }
    again(st, due, gaveAt, hour);
    // ---- the reviews ----
    // The houses and greens no field or meadow is made next to, once an hour for the farms' looks for land, when one looks: no house is
    // built during the review (VB-227: each farm built the set anew, farms times farms a day).
    let built = null;
    const review = (type, id) => {
      const plan = planOf(st, type, id),
        why = plan && (everyone ? 'day' : reviewWhy(st, plan, hour, c));
      if (!why) return null;
      const mine = st.jobsBy.get(`${type}:${id}`);
      if (mine) for (const j of mine) if (!islandJob(j)) j.live = false;
      reviewed(st, plan, c, why);
      return plan;
    };
    const takeDown = (type, id) => {
      const mine = st.jobsBy.get(`${type}:${id}`);
      if (mine) for (const j of mine) if (!islandJob(j)) sweep(st, j);
    };
    for (const f of st.farmsteads) {
      if (f.household === null) continue;
      const hh = st.households[f.household],
        plan = review('household', hh.id);
      if (!plan) continue;
      own = { type: 'household', id: hh.id };
      for (const fd of f.fields) {
        const rules = ASK.fieldAt[fd.stage];
        if (rules) ask(rules, hh, fd, f);
      }
      ask(ASK.farm, hh, f, f);
      // A choice, not an availability: the plan's land step, a new field, or a meadow once the fields are enough, at the review (balance
      // review: households in every scenario look, and those short of land searched in vain every hour; sim/plans).
      if (st.makeFields) landStep(st, plan, f, hh, built || (built = builtTiles(st)));
      ask(ASK.farmAfterPlans, hh, f, f);
      takeDown('household', hh.id);
    }
    own = null;
    // a village's review asks only the kinds of the routines its meeting chose this year (VB-257); the others post nothing
    for (const v of st.villages) {
      const plan = review('village', v.id);
      if (!plan) continue;
      VB.count.oppAsk += ASK.village.length;
      for (let i = 0; i < ASK.village.length; i++) {
        kind = ASK.village[i][0];
        if (kind === null || routineAsks(plan, kind)) ASK.village[i][1](st, v, v, c, put, undefined);
      }
      takeDown('village', v.id);
    }
    // ---- the island: plots, and empty farms being restored, every review hour; and a farm's land project that has ended (given up,
    // or contested away, sim/stakes) takes its task down at once, its hands freed, whatever the holder's planning day ----
    for (const j of st.jobs.values()) if (islandJob(j)) j.live = false;
    ask(ASK.island, null, null);
    for (const j of st.jobs.values()) {
      if (islandJob(j)) sweep(st, j);
      else if (KINDS[j.kind].project && j.farm && !onProject(st, j)) {
        j.live = false;
        sweep(st, j);
      }
    }
  }
  // A land project's task whose project plan still stands at this step on its tile (sim/plans, projectOf).
  const onProject = (st, j) => {
    const s = openOf(st, 'household', j.owner.id);
    return !!s && s.place === j.site && s.kind === j.kind;
  };
  // A member without a task acts on the household's opportunities (design.md section 7, Acting without the plan; VB-249): when matching
  // gave it none of the plan's tasks, the kinds of its household's fields and farm are asked as a review asks them, at most once a
  // household a day (sim/plans, mayLook), and what they report is posted for it to take; nothing is taken down. The pawns whose household
  // looked, to be matched again.
  function lookForWork(st, idle, c) {
    const out = [],
      looked = new Set();
    let kind = null,
      own = null;
    const put = (key, site, extra, k = kind, owner = own) => {
      post(st, key, k, owner, site, extra);
    };
    const ask = (rules, holder, at, f) => {
      VB.count.oppAsk += rules.length;
      for (let i = 0; i < rules.length; i++) {
        kind = rules[i][0];
        rules[i][1](st, holder, at, c, put, f);
      }
    };
    for (const a of idle) {
      const p = st.pawns[a.id],
        hh = p.household === null ? null : st.households[p.household];
      if (!hh || hh.dissolved || hh.farmstead === null || age(st, p) < CHILD.from) continue;
      const f = st.farmsteads[hh.farmstead],
        plan = planOf(st, 'household', hh.id);
      if (f.household !== hh.id || !plan) continue;
      if (looked.has(hh.id)) {
        out.push(a);
        continue;
      }
      if (!mayLook(plan, c.day)) continue;
      looked.add(hh.id);
      own = { type: 'household', id: hh.id };
      for (const fd of f.fields) {
        const rules = LOOK.fieldAt[fd.stage];
        if (rules) ask(rules, hh, fd, f);
      }
      ask(LOOK.farm, hh, f, f);
      ask(LOOK.farmAfterPlans, hh, f, f);
      out.push(a);
    }
    return out;
  }
  // A job's weight in a bid, as its kind says (sim/kinds).
  const urgency = (st, j, c) =>
    KINDS[j.kind].urgency ? KINDS[j.kind].urgency(st, j, c, MATCH.urgency) : MATCH.urgency.other;
  // Matching, not first-come: every idle pawn bids for every open job it may take, and the best fits are
  // assigned first. A poor fit (role priority 2 or less) only bids once the job has waited two hours. A job that k pawns already
  // work gets join^k of the bid (VB-102).
  const plotPrio = (st, p) => (st.demand.includes(p.id) ? PLOT_PRIO.waiting : PLOT_PRIO[p.role] || 0);
  // Role priority for a job: by plot, by claim on an empty farm (sim/farmclaims), else by role and kind.
  const prioOf = (st, p, j) =>
    j.plot ? plotPrio(st, p) : j.claim ? claimPrio(st, p, j) : ROLES[p.role].prio[j.kind] || 0;
  const floored = (pr, v) => (pr > MATCH.poorFit ? Math.max(v, MATCH.floor) : v);
  // A pawn's noise-free score for a job, before the join factor; null when the pawn will not take it: a child under 7, younger than the
  // kind's minAge (VB-136: herding from 8), not its work, or a poor fit for a job that has not waited long enough.
  const tooYoung = (st, p, j) =>
    (p.role === 'child' && age(st, p) < CHILD.from) || (KINDS[j.kind].minAge && age(st, p) < KINDS[j.kind].minAge);
  function score(st, p, j, c) {
    if (tooYoung(st, p, j)) return null;
    const pr = prioOf(st, p, j);
    if (pr <= 0 || (pr <= MATCH.poorFit && st.t - j.posted < MATCH.poorFitWaitHours)) return null;
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    return floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
  }
  function bid(st, a, j, c) {
    const p = st.pawns[a.id];
    if (!isOpen(j) || !eligible(st, j, p) || ((a.side || attentionOf(j) !== 'full') && offerWhy(st, a, j))) return -1;
    const s = score(st, p, j, c);
    return s === null ? -1 : (s + rnd(st.rng.work) * MATCH.noise) * MATCH.join ** j.claims.length;
  }
  // The jobs a pawn may bid for: its household's and its village's, in increasing id.
  const none = new Set();
  // When one of the two is empty, the other as it stands (VB-227: most villages post nothing of their own); callers only read it.
  function jobsFor(st, p) {
    const x = st.jobsBy.get(`household:${p.household}`) || none,
      y = st.jobsBy.get(`village:${villageOf(st, p)}`) || none;
    return y.size === 0 ? x : x.size === 0 ? y : mergeById(x, y);
  }
  // VB-107: at each full hour of the working day, a pawn at work (not walking there, not carrying home) looks up from its job. When an open
  // job it may take bids, without noise, above switchRatio × its own job's bid + switchMargin, it leaves its job, which keeps its progress,
  // and starts the other. A job it would finish within the hour at its own rate is not left. Draws no random numbers.
  function lookUp(st, c) {
    for (const liveId of st.living) {
      const a = st.agents[liveId];
      const p = st.pawns[a.id],
        j = a.job;
      if (a.phase !== 'work' || !j || p.died !== null || unplanned(st, a.id)) continue;
      if ((j.hours ?? KINDS[j.kind].hours) - j.done <= rateOf(st, p)) continue;
      const own = (score(st, p, j, c) ?? 0) * MATCH.join ** (j.claims.length - 1);
      let best = null,
        top = MATCH.switchRatio * own + MATCH.switchMargin;
      for (const k of jobsFor(st, p)) {
        VB.count.lookUpJob++;
        if (k === j || !isOpen(k) || attentionOf(k) !== 'full') continue;
        const s = score(st, p, k, c),
          b = s === null ? -1 : s * MATCH.join ** k.claims.length;
        if (b > top) {
          top = b;
          best = k;
        }
      }
      if (best) issue(st, { actor: a.id, verb: 'work', target: best.key, source: 'planner' });
    }
  }
  // Why a pawn gets no job: every open job it may take with its noise-free bid, or the reason it gets none. Best first. Draws no random
  // numbers and writes nothing to st.
  const clockText = (t) => {
    const m = Math.ceil((((t % 24) + 24) % 24) * 60);
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  // Pawn p's fit for a job it may take: {bid (noise-free, null when it would not bid), reason (why not, or null)}.
  function fit(st, p, j, c) {
    const pr = prioOf(st, p, j),
      row = { bid: null, reason: null };
    if (!isOpen(j)) row.reason = 'taken';
    else if (pr <= 0 || tooYoung(st, p, j)) row.reason = 'not their work';
    else if (pr <= MATCH.poorFit && st.t - j.posted < MATCH.poorFitWaitHours) {
      row.reason = `poor fit, waits until ${clockText(j.posted + MATCH.poorFitWaitHours)}`;
    } else {
      const here = st.farmsteads[st.households[p.household].farmstead].house;
      row.bid = floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
      if (row.bid + MATCH.noise <= 0) {
        row.reason = 'not worth the walk';
        row.bid = null;
      } else row.bid *= MATCH.join ** j.claims.length;
    }
    return row;
  }
  function explainIdle(st, id) {
    const p = st.pawns[id],
      c = cal(st.t),
      out = [];
    for (const j of st.jobs.values())
      if (eligible(st, j, p)) out.push({ job: j.key, kind: j.kind, ...fit(st, p, j, c) });
    return out.sort((x, y) => (y.bid ?? -Infinity) - (x.bid ?? -Infinity));
  }
  // One line for the pawn panel: the best reason an idle adult has no work; null when it has a job or it is not working time.
  function idleLine(st, id) {
    const a = st.agents[id],
      p = st.pawns[id],
      c = cal(st.t);
    if (!p.alive || a.job || a.phase === 'home' || c.hour < WORK[0] || c.hour >= WORK[1] || age(st, p) < CHILD.from)
      return null;
    const rows = explainIdle(st, id).filter((r) => r.reason !== 'taken' && r.reason !== 'not their work');
    if (!rows.length)
      return `No work for ${ROLES[p.role].title.toLowerCase()} at ${st.farmsteads[st.households[p.household].farmstead].name}`;
    const r = rows.find((x) => x.reason);
    if (!r) return null;
    return `${KINDS[r.kind].label}: ${r.reason}`;
  }
  // Two sets of jobs, each in increasing id, as one list in increasing id: the order st.jobs iterates in.
  function mergeById(x, y) {
    const a = [...x],
      b = [...y],
      out = [];
    let i = 0,
      k = 0;
    while (i < a.length || k < b.length)
      out.push(k >= b.length || (i < a.length && a[i].id < b[k].id) ? a[i++] : b[k++]);
    return out;
  }
  // Where a bid of score s goes in bids[from..], which is sorted best first: after every bid at least as good.
  function slot(bids, from, s) {
    let lo = from,
      hi = bids.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (bids[m][0] >= s) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  function planRound(st, idle, c) {
    const bids = [];
    for (const a of idle) {
      const js = jobsFor(st, st.pawns[a.id]);
      VB.count.matchBid += js.length ?? js.size;
      for (const j of js) {
        const s = bid(st, a, j, c);
        if (s > 0) bids.push([s, a, j, j.claims.length]);
      }
    }
    bids.sort((x, y) => y[0] - x[0]);
    const busy = new Set();
    for (let i = 0; i < bids.length; i++) {
      const [s, a, j, k] = bids[i];
      if (busy.has(a) || !isOpen(j)) continue;
      // others joined the job earlier in this round: the bid falls by join for each, and waits its turn again
      if (j.claims.length > k) {
        const b = [s * MATCH.join ** (j.claims.length - k), a, j, j.claims.length];
        bids.splice(slot(bids, i + 1, b[0]), 0, b);
        continue;
      }
      issue(st, { actor: a.id, verb: 'work', target: j.key, source: 'planner' });
      busy.add(a);
    }
    return busy;
  }
  // Nothing suitable: join someone it likes who idles in the village (sim/relations), or drift to the green or the yard; look again in a while.
  function idleAbout(st, a) {
    VB.count.idleStroll++;
    const bg = heldAt(a, 'background'),
      go = (tile, x, y) => issue(st, { actor: a.id, verb: 'walkTo', target: tile, args: { x, y }, source: 'planner' });
    const mate = !bg && st.cenv ? companyFor(st, a) : null;
    // a herder waits by its herds, within reach of the pasture (VB-136)
    if (bg) {
      const [x, y] = workSpot(st, a, bg);
      go(bg.site, x + (rnd(st.rng.work) - 0.5) * 16, y + (rnd(st.rng.work) - 0.5) * 8);
    } else if (mate)
      go(tileAt(st, mate.x, mate.y), mate.x + (rnd(st.rng.work) - 0.5) * 16, mate.y + (rnd(st.rng.work) - 0.5) * 8);
    else {
      const p = st.pawns[a.id],
        f = st.farmsteads[st.households[p.household].farmstead];
      const v = st.villages[f.village],
        spot = v.green && rnd(st.rng.work) < 0.5 ? v.center : f.house;
      go(spot, st.w.hx[spot] + (rnd(st.rng.work) - 0.5) * 26, st.w.hy[spot] + 6 + (rnd(st.rng.work) - 0.5) * 12);
    }
    issue(st, {
      actor: a.id,
      verb: 'idle',
      args: { until: st.t + IDLE.wait[0] + rnd(st.rng.work) * (IDLE.wait[1] - IDLE.wait[0]) },
      source: 'planner',
    });
  }
  return {
    post,
    refreshJobs,
    lookForWork,
    callCooks,
    urgency,
    score,
    bid,
    lookUp,
    planRound,
    idleAbout,
    explainIdle,
    idleLine,
    fit,
    jobsFor,
  };
})();
