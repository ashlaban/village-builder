// @sys sim/jobs: job board: posting and the reviews' asks; the head's day (VB-466): a household's tasks allotted to its members, and taken
// from each member's list; fit and urgency; the round of bids for help between households
VB['sim/jobs'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { WORK, ROLES, CHILD, PLOT_PRIO, MATCH, IDLE, TICKS, cal } = VB['sim/rules'];
  const HELP = MATCH.help;
  const { hexSteps } = VB['sim/hex'];
  const { villageOf, age, kinNear } = VB['sim/records'];
  const { freeHands, ownerKey, dropJob, rateOf, tileAt, offerWhy, attentionOf, heldAt, workSpot, travelling, doneOf } =
    VB['sim/agents'];
  const { companyFor, opinionOf } = VB['sim/relations'];
  const { issue, unplanned } = VB['sim/commands'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, ASK, isOpen } = VB['sim/kinds'];
  const { builtTiles } = VB['sim/fields'];
  const { claimPrio } = VB['sim/farmclaims'];
  const { commonPrio } = VB['sim/commons'];
  const { trustOf, heldFarms } = VB['sim/ownership'];
  const { planOf, reviewed, landStep, reviewWhy, mayLook, WINDOWED, dueNow, again, routineAsks, openOf } =
    VB['sim/plans'];
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  // The holders whose tasks were posted or taken down during the review or the look under way: their days are allotted anew at its end
  // (allotChanged). Null between calls: nothing is kept here from one step to the next.
  let changed = null;
  const changedFor = (owner) => {
    if (changed && owner) changed.add(ownerKey(owner));
  };
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
      changedFor(owner);
    }
    j.live = true;
    return j;
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
    changedFor(j.owner);
    dropJob(st, j);
  }
  // Each review hour (VB-249; design.md section 7, Planning days): the due-queue opens the time-bound kinds that fall due (sim/plans); each
  // holder whose plan is due a review (its planning day, a window closing, a store crossing a target) has it reviewed: each kind says where
  // it is available for the holder (sim/kinds, `available`), asked in the order of ASK, which is the jobs' ids; what it reports is posted
  // and the holder's tasks it no longer reports are taken down. Between reviews the tasks stand. `everyone` reviews every holder now (tests).
  function refreshJobs(st, c, everyone = false) {
    const hour = Math.floor(st.tick / TICKS);
    changed = new Set();
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
      if (f && f.household === id && !trustOf(st, id)) {
        const mine = st.jobsBy.get(`household:${id}`);
        if (mine) for (const j of mine) if (j.kind === K) j.live = false;
        only = K;
        own = { type: 'household', id };
        const rule = DUE_RULES[k];
        if (KINDS[K].stages) {
          for (const fd of f.fields) if (KINDS[K].stages.includes(fd.stage)) ask(rule, hh, fd, f);
          // the fields of a farm it holds in trust, as its own (VB-309)
          for (const g of heldFarms(st, id))
            for (const fd of g.fields) if (KINDS[K].stages.includes(fd.stage)) ask(rule, hh, fd, g);
        } else ask(rule, hh, f, f);
        only = null;
        const now = st.jobsBy.get(`household:${id}`);
        if (now) for (const j of now) if (j.kind === K && !j.claims.length) sweep(st, j);
        // a task with a deadline today that waits unmanned: its hand is called (allot)
        if (gave && KINDS[K].late && now && [...now].some((j) => j.kind === K && !j.claims.length))
          changed.add(`household:${id}`);
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
      changed.add(`${type}:${id}`); // a review reads the stores anew, so its tasks' urgency
      return plan;
    };
    const takeDown = (type, id) => {
      const mine = st.jobsBy.get(`${type}:${id}`);
      if (mine) for (const j of mine) if (!islandJob(j)) sweep(st, j);
    };
    for (const f of st.farmsteads) {
      // a farm held in trust posts nothing of its own: its trustee works its fields as its own (VB-309)
      if (f.household === null || trustOf(st, f.household)) continue;
      const hh = st.households[f.household],
        plan = review('household', hh.id);
      if (!plan) continue;
      own = { type: 'household', id: hh.id };
      for (const g of [f, ...heldFarms(st, hh.id)])
        for (const fd of g.fields) {
          const rules = ASK.fieldAt[fd.stage];
          if (rules) ask(rules, hh, fd, g);
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
    // each morning every household's day is allotted; in the day, those whose tasks or whose village's changed, or that were reviewed
    if (c.hour === WORK[0] - 1 || everyone) for (const id of st.liveHouseholds) changed.add(`household:${id}`);
    allotChanged(st, c);
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
    changed = new Set();
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
      for (const g of [f, ...heldFarms(st, hh.id)])
        for (const fd of g.fields) {
          const rules = LOOK.fieldAt[fd.stage];
          if (rules) ask(rules, hh, fd, g);
        }
      ask(LOOK.farm, hh, f, f);
      ask(LOOK.farmAfterPlans, hh, f, f);
      out.push(a);
    }
    allotChanged(st, c);
    return out;
  }
  // A job's weight in a bid, as its kind says (sim/kinds).
  const urgency = (st, j, c) =>
    KINDS[j.kind].urgency ? KINDS[j.kind].urgency(st, j, c, MATCH.urgency) : MATCH.urgency.other;
  // A pawn's fit for a job: its role's priority for the kind times the job's urgency, less the walk. The head allots by it (allot); a
  // helper bids it for a neighbour's job, where a job that k pawns already work gets join^k of the bid (VB-102, VB-106).
  const plotPrio = (st, p) => (st.demand.includes(p.id) ? PLOT_PRIO.waiting : PLOT_PRIO[p.role] || 0);
  // Role priority for a job: by plot, by claim on an empty farm (sim/farmclaims), by the village's custom on a common field (sim/commons,
  // VB-100), else by role and kind.
  const prioOf = (st, p, j) =>
    j.plot
      ? plotPrio(st, p)
      : j.claim
        ? claimPrio(st, p, j)
        : j.common
          ? commonPrio(st, p, j)
          : ROLES[p.role].prio[j.kind] || 0;
  // The join factor for n hands already at job j: MATCH.join ** n, or 1 for a kind worked all together (VB-120: a work day).
  const joined = (j, n) => (KINDS[j.kind].together ? 1 : MATCH.join ** n);
  const floored = (pr, v) => (pr > MATCH.poorFit ? Math.max(v, MATCH.floor) : v);
  // A pawn's score for a job, before the join factor; null when the pawn will not take it: a child under 7, younger than the kind's
  // minAge (VB-136: herding from 8), or not its work.
  const tooYoung = (st, p, j) =>
    (p.role === 'child' && age(st, p) < CHILD.from) || (KINDS[j.kind].minAge && age(st, p) < KINDS[j.kind].minAge);
  function score(st, p, j, c) {
    if (tooYoung(st, p, j)) return null;
    const pr = prioOf(st, p, j);
    if (pr <= 0) return null;
    const here = st.farmsteads[st.households[p.household].farmstead].house;
    return floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
  }
  function bid(st, a, j, c) {
    const p = st.pawns[a.id];
    if (!isOpen(j) || !eligible(st, j, p) || ((a.side || attentionOf(j) !== 'full') && offerWhy(st, a, j))) return -1;
    const s = score(st, p, j, c);
    return s === null ? -1 : (s + rnd(st.rng.work) * MATCH.noise) * joined(j, j.claims.length);
  }
  // The jobs a pawn may bid for: its household's and its village's, in increasing id.
  const none = new Set();
  // When one of the two is empty, the other as it stands (VB-227: most villages post nothing of their own); callers only read it.
  function jobsFor(st, p) {
    const x = st.jobsBy.get(`household:${p.household}`) || none,
      y = st.jobsBy.get(`village:${villageOf(st, p)}`) || none;
    return y.size === 0 ? x : x.size === 0 ? y : mergeById(x, y);
  }
  // Why a pawn gets no job: every open job it may take with its noise-free bid, or the reason it gets none. Best first. Draws no random
  // numbers and writes nothing to st.
  // Pawn p's fit for a job it may take: {bid (noise-free, null when it would not bid), reason (why not, or null)}.
  function fit(st, p, j, c) {
    const pr = prioOf(st, p, j),
      row = { bid: null, reason: null };
    if (!isOpen(j)) row.reason = 'taken';
    else if (pr <= 0 || tooYoung(st, p, j)) row.reason = 'not their work';
    else {
      const here = st.farmsteads[st.households[p.household].farmstead].house;
      row.bid = floored(pr, pr * urgency(st, j, c) - hexSteps(st.w, here, j.site) * MATCH.distanceWeight);
      if (row.bid <= 0) {
        row.reason = 'not worth the walk';
        row.bid = null;
      } else row.bid *= joined(j, j.claims.length);
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
  // Assign the bids, best first, one job a pawn; a bid on a job others joined earlier in the round falls by join for each and waits its
  // turn again.
  function assign(st, bids, busy) {
    bids.sort((x, y) => y[0] - x[0]);
    for (let i = 0; i < bids.length; i++) {
      const [s, a, j, k] = bids[i];
      if (busy.has(a) || !isOpen(j)) continue;
      if (j.claims.length > k) {
        const b = [s * joined(j, j.claims.length - k), a, j, j.claims.length];
        bids.splice(slot(bids, i + 1, b[0]), 0, b);
        continue;
      }
      issue(st, { actor: a.id, verb: 'work', target: j.key, source: 'planner' });
      busy.add(a);
    }
  }
  // ---- the head's day (VB-466; design.md section 7, The day's work) ----
  // @state plan.day (a household's standing plan's; sim/plans holds the plan): absent until first allotted, then {made (the game hour),
  //   lists: {pawn id: [job keys]}}: for each living member the tasks the head gave it, in the order it takes them; a member too young has
  //   an empty list. Written only by allot, whole, each time; a key whose job is gone is passed over. Plain data, saved with the plan.
  const dayHours = (st, p) => MATCH.day.horizon * (WORK[1] - WORK[0]) * rateOf(st, p);
  const hoursLeft = (st, j) => (j.hours ?? KINDS[j.kind].hours ?? 0) - doneOf(st, j);
  // The head allots the household's day. Every member is weighed for every task of the household and of its village that it may take, by
  // its fit (score); best fit first, a further hand on a task counting for less (join), a task is given hands until they finish it within
  // the horizon, each member up to its own working
  // hours of the horizon; then each member's list goes on with the other tasks it may take, by its fit, so that no one stands idle while
  // there is work (design.md section 7, Work beats idling). No random draw. Then the head calls: a member at work leaves its task for the
  // first of its list when that is much more urgent (switchRatio, switchMargin; VB-107), a task with a deadline today (`late`: the meal)
  // calls its hand from work, from the road or from idling. The others take their tasks when they next look for work (takeDay).
  function allot(st, hh, c) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan || hh.farmstead === null) return;
    const lists = {},
      members = [];
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (p.died !== null) continue;
      lists[id] = [];
      // not a child under 7, one on a journey, or the player's pawn while it is commanded: the head allots around them
      if (age(st, p) >= CHILD.from && !travelling(st.agents[id]) && !unplanned(st, id)) members.push(p);
    }
    const pairs = [];
    if (members.length) {
      const jobs = jobsFor(st, members[0]);
      VB.count.dayPair += (jobs.length ?? jobs.size) * members.length;
      for (const j of jobs) {
        if (attentionOf(j) === 'full' && hoursLeft(st, j) <= 0) continue; // only its load is on the road
        for (const p of members) {
          if (!eligible(st, j, p)) continue;
          const s = score(st, p, j, c);
          if (s !== null && s > 0) pairs.push([s, p.id, j]);
        }
      }
    }
    pairs.sort((x, y) => y[0] - x[0] || x[2].id - y[2].id || x[1] - y[1]);
    const cap = new Map(members.map((p) => [p.id, dayHours(st, p)])),
      manned = new Map(), // job -> [hours given, hands]
      given = new Map(), // pawn -> its first task of the first pass, with its fit
      due = new Map(), // pawn -> the task with a deadline today it is the hand for
      spare = [];
    // best first; a pair whose task has gained hands since it was weighed falls by `join` for each (VB-102: the hands spread over the
    // tasks that can be worked at once) and waits its turn again
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i],
        [s, id, j, k = 0] = pair,
        full = attentionOf(j) === 'full',
        m = manned.get(j) || [0, 0],
        left = full ? hoursLeft(st, j) : 0;
      if (m[1] >= KINDS[j.kind].hands || (full && (cap.get(id) <= 0 || m[0] >= left)) || (!full && m[1] > 0)) {
        spare.push(pair);
        continue;
      }
      if (m[1] > k) {
        const again = [s * joined(j, m[1] - k), id, j, m[1]];
        pairs.splice(slot(pairs, i + 1, again[0]), 0, again);
        continue;
      }
      const h = full ? Math.min(cap.get(id), left - m[0]) : 0;
      cap.set(id, cap.get(id) - h);
      manned.set(j, [m[0] + h, m[1] + 1]);
      // a task with a deadline today that waits unmanned goes first in its hand's list, whatever its fit, and calls it (below)
      if (KINDS[j.kind].late && !j.claims.length && !due.has(id)) {
        due.set(id, j);
        lists[id].unshift(j.key);
      } else lists[id].push(j.key);
      if (full && !given.has(id)) given.set(id, [s, j]);
    }
    for (const [, id, j] of spare) lists[id].push(j.key);
    plan.day = { made: Math.floor(st.tick / TICKS), lists };
    for (const p of members) {
      const a = st.agents[p.id],
        dj = due.get(p.id),
        top = given.get(p.id),
        busy = !!a.job && attentionOf(a.job) === 'full';
      if (dj && a.job !== dj && isOpen(dj) && c.hour <= WORK[1]) {
        // the deadline calls: from work, from the road to it, or from idling (waiting, or out for company; not at an occasion)
        if (busy ? a.phase === 'work' || a.phase === 'go' : !a.job && a.phase === null && a.occasion === null)
          issue(st, { actor: a.id, verb: 'work', target: dj.key, source: 'planner' });
        continue;
      }
      if (!top || !busy || a.phase !== 'work' || a.job === top[1] || !isOpen(top[1])) continue;
      if (
        hoursLeft(st, a.job) > rateOf(st, p) &&
        top[0] > MATCH.switchRatio * (score(st, p, a.job, c) ?? 0) + MATCH.switchMargin
      )
        issue(st, { actor: a.id, verb: 'work', target: top[1].key, source: 'planner' });
    }
  }
  // The days of the holders noted as changed, in the order of their ids: a household's own, and for a village's tasks each of its
  // households'.
  function allotChanged(st, c) {
    const ids = new Set();
    for (const key of changed) {
      const [type, n] = key.split(':'),
        id = Number(n);
      if (type === 'household') ids.add(id);
      else if (type === 'village' && st.villages[id])
        for (const fid of st.villages[id].farmsteads) {
          const hid = st.farmsteads[fid].household;
          if (hid !== null) ids.add(hid);
        }
    }
    changed = null;
    for (const id of [...ids].sort((x, y) => x - y)) {
      const hh = st.households[id];
      if (hh && !hh.dissolved) allot(st, hh, c);
    }
  }
  // Whether pawn a can take job j of its list now: there is room, it still may, and a task held at the side is in reach.
  const canTake = (st, a, j) =>
    isOpen(j) && !!eligible(st, j, st.pawns[a.id]) && !((a.side || attentionOf(j) !== 'full') && offerWhy(st, a, j));
  // Each idle pawn takes the first task of its list that it can (a task held at the side leaves it free for the next one, next step). A
  // household with no day yet, or a member its day does not know (it moved in, or was born, since), has its day allotted first. The
  // pawns that got work.
  function takeDay(st, idle, c) {
    const got = new Set();
    for (const a of idle) {
      const p = st.pawns[a.id],
        hh = p.household === null ? null : st.households[p.household],
        plan = hh && planOf(st, 'household', hh.id);
      if (!plan || hh.farmstead === null) continue;
      if (!plan.day || !plan.day.lists[a.id]) allot(st, hh, c);
      if (a.job || a.path) {
        got.add(a); // the allotment called it
        continue;
      }
      const list = plan.day.lists[a.id];
      if (!list) continue;
      for (const key of list) {
        VB.count.dayTake++;
        const j = st.jobs.get(key);
        if (!j || !canTake(st, a, j)) continue;
        if (issue(st, { actor: a.id, verb: 'work', target: key, source: 'planner' }) === true) {
          got.add(a);
          break;
        }
      }
    }
    return got;
  }
  // The idle pawns the day gave nothing bid to help the other households of their village (helpRound); `busy` gains those who go.
  function helpers(st, idle, busy, c) {
    helpRound(st, idle, none, busy, c);
    return busy;
  }
  // Help between households (VB-106): a pawn with no bid of its own this round bids on the jobs the other households of its village offer,
  // each its most urgent open job of each kind help takes (MATCH.help), at its bid times factor, + kin for near kin of the holder, + its
  // opinion of the holder. Bids on the helper basis only (sim/eligibility).
  function helpRound(st, idle, bidding, busy, c) {
    const offers = new Map(),
      bids = [];
    for (const a of idle) {
      const p = st.pawns[a.id];
      if (bidding.has(a) || busy.has(a) || age(st, p) < HELP.minAge) continue;
      const v = villageOf(st, p);
      if (!offers.has(v)) offers.set(v, offered(st, v, c));
      const kin = kinNear(st, p.id);
      for (const j of offers.get(v)) {
        VB.count.helpBid++;
        const hh = st.households[j.owner.id];
        if (hh.id === p.household) continue;
        const s = bid(st, a, j, c);
        if (s <= 0) continue;
        const f =
          HELP.factor +
          (hh.holder !== null ? (kin.includes(hh.holder) ? HELP.kin : 0) + opinionOf(st, p.id, hh.holder) : 0);
        if (f > 0) bids.push([s * f, a, j, j.claims.length]);
      }
    }
    if (bids.length) assign(st, bids, busy);
  }
  // What the households of village v offer helpers: each its most urgent open job of each kind help takes, waited long enough, in id order.
  function offered(st, v, c) {
    const out = [];
    for (const fid of st.villages[v].farmsteads) {
      const hid = st.farmsteads[fid].household,
        js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
      if (!js) continue;
      const best = new Map();
      for (const j of js) {
        VB.count.helpOffer++;
        if (!HELP.kinds.includes(j.kind) || !isOpen(j) || attentionOf(j) !== 'full') continue;
        if (st.t - j.posted < HELP.waitHours) continue;
        const b = best.get(j.kind);
        if (!b || urgency(st, j, c) > urgency(st, b, c)) best.set(j.kind, j);
      }
      for (const j of best.values()) out.push(j);
    }
    return out.sort((x, y) => x.id - y.id);
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
    allot,
    takeDay,
    helpers,
    urgency,
    score,
    bid,
    idleAbout,
    explainIdle,
    idleLine,
    fit,
    jobsFor,
  };
})();
