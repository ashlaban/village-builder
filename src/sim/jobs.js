// @sys sim/jobs: the job board: a task posted and taken down; each review hour the due-queue's and the reviews' asks of the kinds' rules
// (sim/kinds), and the asks of a member without a task; the holders whose tasks changed have their days allotted anew (sim/day)
VB['sim/jobs'] = (() => {
  const { WORK, TICKS } = VB['sim/rules'],
    { CHILD, MATCH } = VB['sim/roles'];
  const { age } = VB['sim/records'];
  const { freeHands, dropJob } = VB['sim/agents'],
    { ownerKey } = VB['sim/work'];
  const { KINDS, ASK } = VB['sim/kinds'];
  const { builtTiles } = VB['sim/fieldplans'];
  const { trustOf, heldFarms } = VB['sim/ownership'];
  const { planOf, reviewed, landStep } = VB['sim/plans'],
    { routineAsks } = VB['sim/routines'],
    { reviewWhy, mayLook, WINDOWED, dueNow, again } = VB['sim/plandays'];
  const { onProject } = VB['sim/projects'];
  const { allotChanged } = VB['sim/day'];
  // Sources (fields, households, village fences) post jobs; each job names an owner. A pawn may take a job
  // owned by its own household, or by its village if it lives there. Servants count as household members.
  // The holders whose tasks were posted or taken down during the review or the look under way: their days are allotted anew at its end
  // (allotChanged). Null between calls: nothing is kept here from one step to the next.
  let changed = null;
  // The review or the look is over: the days of the holders it noted are allotted anew (sim/day).
  const allotNoted = (st, c) => {
    const noted = changed;
    changed = null;
    allotChanged(st, noted, c);
  };
  const changedFor = (owner) => {
    if (changed && owner) changed.add(ownerKey(owner));
  };
  function post(st, key, kind, owner, site, extra) {
    if (!Number.isInteger(site)) throw new Error(`a task ${key} posted on no tile (${site})`); // fails where it is made (VB-255)
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
  const islandJob = (j) => !!j.plot || j.kind === 'restore' || j.kind === 'booth'; // a staked booth's raising (VB-1172)
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
    // each morning, and again in the afternoon when its urgencies change (MATCH.day.afternoon; VB-1546), every household's day is
    // allotted; in the day, those whose tasks or whose village's changed, or that were reviewed
    if (c.hour === WORK[0] - 1 || c.hour === MATCH.day.afternoon || everyone)
      for (const id of st.liveHouseholds) changed.add(`household:${id}`);
    allotNoted(st, c);
  }
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
    allotNoted(st, c);
    return out;
  }
  return { post, refreshJobs, lookForWork };
})();
