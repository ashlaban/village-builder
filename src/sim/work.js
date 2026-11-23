// @sys sim/work: a task's work as a block: its progress reckoned in closed form from the rate of the hands at it (or a background task's
// holders minding it), its end in the due-queue st.workDue, a hand's rate and the ox team; split from sim/agents (VB-422)
VB['sim/work'] = (() => {
  const { cal, TICKS, HUNGER, HEALTH, HERD } = VB['sim/rules'],
    { workRate } = VB['sim/roles'];
  const HANDS = VB['sim/rules'].AGES.hands;
  const { age } = VB['sim/records'];
  const { hexSteps } = VB['sim/hex'];
  const Days = VB['sim/days'],
    Hands = VB['sim/hands'],
    { book: bookHours } = VB['sim/fields'];
  const { hasTeam } = VB['sim/herds'];
  const Carts = VB['sim/carts'];
  const { KINDS } = VB['sim/kinds'],
    Progress = VB['sim/progress'],
    { workTick } = Progress;
  const Due = VB['sim/due'];
  const Skills = VB['sim/skills'];
  const { tileAt, endTile } = VB['sim/pose'];
  // st.jobs by key, and st.jobsBy by owner ('household:3', 'village:1'); every job leaves both together.
  const ownerKey = (o) => `${o.type}:${o.id}`;
  const attentionOf = (j) => KINDS[j.kind].attention || 'full';
  // The held task a is within reach of from tile `at`, or beyond it (a background task only).
  const inReach = (st, j, at) => at >= 0 && hexSteps(st.w, at, j.site) <= KINDS[j.kind].reach;
  // Work hours a pawn does in an hour: by role and age (children), slowed by hunger and poor health.
  const rateOf = (st, p) =>
    workRate(p.role, age(st, p)) * (1 - HUNGER.slow * p.hunger) * (1 - (HEALTH.slow * (100 - p.health)) / 100);
  // The pawn drives the household's oxen (VB-138): it is the first hand on the household's earliest hoeing or breaking job that has hands,
  // and the household has a team. Derived each time, so the team is never in two fields.
  function withOxen(st, a) {
    const j = a.job;
    if (
      !j ||
      a.phase !== 'work' ||
      j.claims[0] !== a.id ||
      j.owner.type !== 'household' ||
      !HERD.team.kinds.includes(j.kind)
    )
      return false;
    let first = null;
    for (const q of st.jobsBy.get(ownerKey(j.owner)) || [])
      if (HERD.team.kinds.includes(q.kind) && q.claims.length && (!first || q.id < first.id)) first = q;
    return first === j && hasTeam(st, st.households[j.owner.id]);
  }
  // The household's team may draw the ox cart: it has a team, at no plough and with no other cart on the road (VB-335; sim/carts).
  function teamFree(st, hh) {
    if (!hasTeam(st, hh) || Carts.oxOut(st, hh)) return false;
    for (const id of hh.members) if (withOxen(st, st.agents[id])) return false;
    return true;
  }
  // ---- work as a block (VB-472; design.md section 7, A leg, and its end; docs/review-blocks.md, step 2): a worker is not stepped ----
  // @state job.done, job.at, job.rate: the task's hours done when it was last reckoned, the tick it was reckoned at, and the hours of work
  //   its hands at work (or a background task's holders minding it) do together in a game hour since; its progress now is
  //   done + rate × the hours since (doneOf; sim/progress holds its closed form, read by every other module). Reckoned, and its end queued again, when a
  //   hand joins or leaves, when a hand's rate may have changed (after the meal; an ox team gone to another task), at the end of work, at
  //   its end, and at a cut. `done` is exact while no hand is at work, and below the task's hours otherwise. at and rate are absent until the
  //   task is first reckoned. Written only here; plain data, saved.
  // @state job.due: the tick at whose step the task's work is done, as last reckoned, or null with no hands at work (absent until reckoned).
  // @state st.workDue: the tasks under work (full attention with a hand at work, or background with a holder minding it; rate > 0), each
  //   once, sorted by due, then id: a due-queue (Rules for cost 4), bounded by the tasks under work; plain data, saved; absent until the
  //   first. A step takes what is due (dueWork) and nothing else.
  // A step's work is done as the step's legs begin to be taken (stepAgents, dueWork): the tick up to which the hands have worked, so a hand
  // leaving at the calendar's hour (before the legs) does not work that step, and one joining in or after them works from the next. Between
  // steps (a fresh or a loaded run, st.stepAt absent or both its marks at the tick) the step now has been worked.
  // @state agent.pace (VB-475): the hand's pace over its work leg, a multiplier on its rate (rateOf) at full attention: its skill at the
  //   kind's type of work and the leg's mishap, and its level at the kind's craft (sim/skills workPace), drawn as the work leg begins
  //   (arrived); the level read then holds for the leg, the hours practised raising it as the task is reckoned (settle); read only while it is at
  //   work; absent until its first work leg (it reads 1). Written only here.
  const hoursOfJob = (j) => j.hours ?? KINDS[j.kind].hours;
  const atWork = (st, j, id) => {
    const b = st.agents[id];
    return b.job === j && b.phase === 'work';
  };
  // A holder minds its background task while it stands free (where it last stood was in reach), stands at other work within reach, or
  // walks a leg that begins and ends within reach; one walking into reach keeps it, unworked (sideCheck lets go one walking out of reach).
  // Constant over a leg, so the task's rate is told again only as its holders' legs begin and end.
  function minding(st, b, j) {
    if (!b.side || b.side.background !== j) return false;
    const l = b.leg;
    if (b.path && l && l.kind === 'walk') return inReach(st, j, tileAt(st, l.x, l.y)) && inReach(st, j, endTile(st, b));
    return b.phase === null || inReach(st, j, tileAt(st, b.x, b.y));
  }
  // The hours of work j's hands do together in a game hour now: rateOf, the ox team and the cart's part in carting (a hand at carting
  // takes a free cart as it is reckoned, as it did each step); a background task's kind rate for each holder minding it. `take` false
  // reads only.
  function manning(st, j, take = false) {
    const K = KINDS[j.kind];
    let rate = 0;
    if (attentionOf(j) !== 'full') {
      if (attentionOf(j) === 'background')
        for (const id of j.claims || []) if (minding(st, st.agents[id], j)) rate += K.rate;
      return rate;
    }
    for (const id of j.claims || []) {
      if (!atWork(st, j, id)) continue;
      const a = st.agents[id],
        hh = K.carted ? st.households[st.pawns[id].household] : null;
      rate +=
        rateOf(st, st.pawns[id]) *
        (a.pace ?? 1) *
        (withOxen(st, a) ? HERD.team.rate : 1) *
        (hh ? (take ? Carts.carting : Carts.cartingRate)(st, hh, id, teamFree(st, hh)) : 1);
    }
    return rate;
  }
  // The task's progress brought up to tick t (the hands' work so far, at the rate last reckoned), with its kind's `worked` for each hand
  // at work (a background task's once) over the hours since, and a plot's hours by pawn. Before its hands change.
  function settle(st, j, t = workTick(st)) {
    if (j.at === undefined || j.at === null) {
      j.at = t;
      j.rate = 0;
      return;
    }
    if (!(t > j.at)) return;
    const dt = (t - j.at) / TICKS,
      from = j.done;
    j.at = t;
    if (!(j.rate > 0)) return;
    VB.count.workReckon++;
    const K = KINDS[j.kind];
    j.done = from + dt * j.rate;
    if (attentionOf(j) !== 'full') {
      if (K.worked) K.worked(st, j, dt, null, from);
      return;
    }
    for (const id of j.claims) {
      if (!atWork(st, j, id)) continue;
      if (K.worked) K.worked(st, j, dt, st.agents[id], from);
      if (j.plot) j.plot.hours[id] = (j.plot.hours[id] || 0) + dt;
      countWork(st, id, dt, t);
      if (K.craft) Skills.practise(st, id, K.craft, dt); // hours at a craft raise the hand's skill at it (VB-360)
      if (j.field && j.farm) bookHours(j.field, st.pawns[id].household === j.farm.household, dt); // VB-462: the class reads it
      if (st.agents[id].basis === 'owed') Days.worked(st, id, dt);
      else if (st.agents[id].basis === 'helper') Hands.worked(st, id, dt);
    }
  }
  // @state household.workHours (VB-255): [season (year * 4 + season of cal, of the hours counted), hours, last]: the hours its working hands
  //   (Traits' hands: 14 to 59, not retired) worked at full attention on any task this season, and `last` those of the season before (0
  //   when that season was not the one before); absent until its first hour of work. Counted as a task's work is reckoned (settle), so it
  //   costs an addition a hand; read by sim/aims (idleShare) at a head's review. Written only here.
  function countWork(st, id, dt, t) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || p.retired || p.age < HANDS[0] || p.age >= HANDS[1]) return;
    const c = cal(t / TICKS),
      key = c.year * 4 + c.season,
      W = hh.workHours;
    if (!W) hh.workHours = [key, dt, 0];
    else if (W[0] === key) W[1] += dt;
    else {
      W[2] = W[0] === key - 1 ? W[1] : 0;
      W[0] = key;
      W[1] = dt;
    }
  }
  const teamKind = (j) => j.owner && j.owner.type === 'household' && HERD.team.kinds.includes(j.kind);
  // The rate after the hands changed (settle first), and the end queued again; the household's other tasks under the ox team are
  // reckoned again too, as the team goes to its earliest task with hands (withOxen).
  function rerate(st, j, others = true) {
    if (j.at === undefined || j.at === null) settle(st, j);
    j.rate = manning(st, j, true);
    queue(st, j);
    if (!others || !teamKind(j)) return;
    for (const q of st.jobsBy.get(ownerKey(j.owner)) || [])
      if (q !== j && q.rate > 0 && teamKind(q)) {
        settle(st, q);
        rerate(st, q, false);
      }
  }
  // The ox team or a cart of household hh is free again (a team task dropped, a cart home or left): its tasks under work that the team or
  // a cart speeds are reckoned again, so the next takes them up at once, as the stepping did at its next step.
  function retune(st, hh) {
    if (!hh || hh.dissolved) return;
    for (const q of [...(st.jobsBy.get(`household:${hh.id}`) || [])])
      if (q.rate > 0 && (teamKind(q) || KINDS[q.kind].carted)) {
        settle(st, q);
        rerate(st, q, false);
      }
  }
  // st.workDue's order (sim/due): by the job's due step, then its id.
  const jobDue = (j) => j.due,
    jobId = (j) => j.id;
  function unqueue(st, j) {
    const q = st.workDue;
    if (!q || j.due === null || j.due === undefined) return;
    Due.remove(q, j, j.due, j.id, jobDue, jobId);
  }
  // The task is taken down (sim/agents dropJob): its end is out of the queue.
  function dequeue(st, j) {
    unqueue(st, j);
    j.due = null;
  }
  // The task's end from its progress and rate: the step whose work finishes it (whole steps: the clock stands), into the queue.
  function queue(st, j) {
    unqueue(st, j);
    if (!(j.rate > 0)) {
      j.due = null;
      return;
    }
    const left = hoursOfJob(j) - j.done;
    j.due = j.at + Math.max(1, Math.ceil((left / j.rate) * TICKS - 1e-7));
    const q = st.workDue || (st.workDue = []);
    Due.insert(q, j, j.due, j.id, jobDue, jobId);
  }
  // Every task under work reckoned now (the end of work, after the meal: a hand's rate may have changed).
  function reckonAll(st) {
    for (const j of [...(st.workDue || [])]) {
      settle(st, j);
      rerate(st, j, false);
    }
  }
  // The job's hours done now, worked out from its last reckoning with no stepping.
  const doneOf = (st, j) => Progress.doneOf(st, j, hoursOfJob(j));
  // The tasks whose end is due at this step (sim/agents stepAgents, as its legs begin to be taken): each is reckoned, finished, and
  // ended by its first hand at work, end(st, a), a background task by its first holder, sideEnd(st, j, a) (what the end means is
  // sim/agents'); one with no hand at work, or no holder, is taken out of the queue.
  function dueWork(st, end, sideEnd) {
    const q = st.workDue;
    while (q && q.length && q[0].due <= st.tick) {
      const j = q[0];
      settle(st, j);
      if (attentionOf(j) === 'background') {
        let a = null;
        for (const id of j.claims) {
          const b = st.agents[id];
          if (b.side && b.side.background === j && (!a || id < a.id)) a = b;
        }
        if (!a) {
          unqueue(st, j);
          j.rate = 0;
          j.due = null;
        } else {
          if (j.done < hoursOfJob(j)) j.done = hoursOfJob(j); // the due step's work finishes it (rounding)
          sideEnd(st, j, a);
        }
        if (q[0] === j && j.due <= st.tick) unqueue(st, j); // a guard: an end never waits on itself
        continue;
      }
      const id = j.claims.find((x) => atWork(st, j, x));
      if (id === undefined) {
        q.shift();
        j.rate = 0;
        j.due = null;
        continue;
      }
      if (j.done < hoursOfJob(j)) j.done = hoursOfJob(j); // the due step's work finishes it (rounding)
      end(st, st.agents[id]);
      if (q[0] === j && j.due <= st.tick) unqueue(st, j); // a guard: an end never waits on itself
    }
  }
  // The work of a's task is done (dueWork): its load is taken home, it cuts another, or the task is complete.
  return {
    attentionOf,
    inReach,
    manning,
    settle,
    rerate,
    retune,
    dequeue,
    teamKind,
    ownerKey,
    rateOf,
    withOxen,
    teamFree,
    doneOf,
    reckonAll,
    dueWork,
  };
})();
