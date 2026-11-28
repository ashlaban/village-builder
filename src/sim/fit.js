// @sys sim/fit [agency]: a posted job weighed for a pawn: the job's urgency, the pawn's priority for it by role, plot, claim or custom, its score
// less the walk, the bars to taking it, the bid; why an idle pawn has no work. Read-only, drawing nothing: read by the head's day and the
// pawn on duty (sim/day) and by the Actions list (sim/opportunities), which choose by it and take with the one command (workCommand)
VB['sim/fit'] = (() => {
  const { WORK, cal } = VB['sim/rules'],
    { ROLES, CHILD, MATCH, absentMask } = VB['sim/roles'];
  const { hexSteps } = VB['sim/hex'];
  const { villageOf, age, unplanned } = VB['sim/records'];
  const { bed } = VB['sim/pose'],
    { offerWhy } = VB['sim/attention'],
    { attentionOf } = VB['sim/work'];
  const { eligible } = VB['sim/eligibility'];
  const { KINDS, isOpen, carriedOn } = VB['sim/kinds'];
  const Days = VB['sim/days'];
  const Hands = VB['sim/hands'],
    Grants = VB['sim/grants'];
  const { claimPrio } = VB['sim/farmclaims'];
  const { commonPrio } = VB['sim/commons'];
  const Levies = VB['sim/levies'],
    { planOf } = VB['sim/plans'];
  // @tunable PLOT_PRIO: who clears a new plot, by role
  // Who clears a new plot for the village (see sim/expansion): by role; those waiting for the plot take 9 whatever their role.
  const PLOT_PRIO = { waiting: 9, farmhand: 7, maid: 7, son: 5, daughter: 5, farmer: 3 };
  // A job's weight in a bid, as its kind says (sim/kinds).
  // `memo`, a Map the caller makes for one allotment or one round of help, holds the urgencies worked out in it (VB-453): a job's urgency
  // takes no pawn, so each is worked out once and read for every bid; the caller drops it with the call.
  const urgency = (st, j, c, memo) => {
    if (!memo) return urgencyOf(st, j, c);
    let u = memo.get(j);
    if (u === undefined) memo.set(j, (u = urgencyOf(st, j, c)));
    return u;
  };
  const urgencyOf = (st, j, c) =>
    KINDS[j.kind].urgency ? KINDS[j.kind].urgency(st, j, c, MATCH.urgency) : MATCH.urgency.other;
  // A pawn's fit for a job: its role's priority for the kind times the job's urgency, less the walk; a job of a kind the household lives
  // by (`vital`, sim/kinds carriedOn) is weighed with no walk taken off, since it must be done wherever it lies (VB-1582; design.md,
  // Water by the site, How it is ranked). The head allots by it (allot); a
  // pawn on duty or lent bids it for the tasks of the household it works for, where a job that k pawns already work gets join^k of the
  // bid (VB-102).
  // A site's job (VB-787; sim/sites, j.party its party): its members of 14 and over, but a mother who nurses, at the first of PLOT_PRIO;
  // nobody else.
  const sitePrio = (st, p, j) =>
    j.party.includes(p.id) && p.age >= 14 && !(p.nursingUntil > st.t) ? PLOT_PRIO.waiting : 0;
  const plotPrio = (st, p) => (st.demand.includes(p.id) ? PLOT_PRIO.waiting : PLOT_PRIO[p.role] || 0);
  // Role priority for a job: by plot, by claim on an empty farm (sim/farmclaims), by the village's custom on a common field (sim/commons,
  // VB-100), by the kind's own `rank` where it declares one (VB-362: spinning and weaving, by a practice and the pawn's sex), else by
  // role and kind, the holder's with the ranks of the roles its household lacks (`stand`, the mask of sim/roles absentMask its caller
  // made for the holder, else 0; VB-1545).
  const prioOf = (st, p, j, stand = 0) =>
    j.party
      ? sitePrio(st, p, j)
      : j.plot
        ? plotPrio(st, p)
        : j.claim
          ? claimPrio(st, p, j)
          : j.common
            ? commonPrio(st, p, j)
            : KINDS[j.kind].rank
              ? KINDS[j.kind].rank(st, p, j, stand)
              : ROLES[p.role].ranks[stand][j.kind] || 0;
  // Whether the head allots member id the day: not a child under 7, one away from home (VB-287, VB-783), the player's pawn while it is
  // commanded, or one on a day owed elsewhere (sim/days) or lent as a hand.
  const allotted = (st, p) =>
    age(st, p) >= CHILD.from &&
    st.agents[p.id].away === undefined &&
    !unplanned(st, p.id) &&
    Days.on(st, p.id) === null &&
    Hands.on(st, p.id) === null &&
    !Grants.on(st, p.id) && // on leave (VB-1555; its head's dated grant, VB-1763)
    p.ill === undefined; // ill (VB-1758: an illness keeps its pawn from work)
  // The stand mask of pawn p (VB-1545): the roles its household lacks today when p is the holder at work, else 0. A pass over the
  // household's members, for a reader outside an allotment (fit); allot makes it once from its own list.
  function standOf(st, p) {
    const hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.holder !== p.id || !allotted(st, p)) return 0;
    return absentMask(
      p.id,
      hh.members.map((id) => st.pawns[id]).filter((q) => q.died === null && allotted(st, q)),
    );
  }
  // The join factor for n hands already at job j: MATCH.join ** n, or 1 for a kind worked all together (VB-120: a work day).
  const joined = (j, n) => (KINDS[j.kind].together ? 1 : MATCH.join ** n);
  const floored = (pr, v) => (pr > MATCH.poorFit ? Math.max(v, MATCH.floor) : v);
  // A pawn's score for a job, before the join factor; null when the pawn will not take it: a child under 7, younger than the kind's
  // minAge (VB-136: herding from 8), or not its work.
  const tooYoung = (st, p, j) =>
    (p.role === 'child' && age(st, p) < CHILD.from) || (KINDS[j.kind].minAge && age(st, p) < KINDS[j.kind].minAge);
  function score(st, p, j, c, memo, stand = 0) {
    if (tooYoung(st, p, j)) return null;
    const pr = prioOf(st, p, j, stand);
    if (pr <= 0) return null;
    const here = bed(st, st.agents[p.id]); // the walk from where its day starts (VB-783)
    const walk = KINDS[j.kind].vital && carriedOn(st, j) ? 0 : hexSteps(st.w, here, j.site) * MATCH.distanceWeight;
    return floored(pr, pr * urgency(st, j, c, memo) - walk);
  }
  // ---- a posted job weighed for a pawn (VB-1405): one evaluation, read-only and drawing nothing, for the matcher and the Actions list
  // (sim/opportunities); each adds its own policy of choosing: the matcher ranks and takes, the player chooses ----
  // Why pawn a may not take posted job j now, or null: it has no room, or it is not the pawn's to take (sim/eligibility).
  const takeBar = (st, a, j) =>
    !isOpen(st, j) ? 'taken' : !eligible(st, j, st.pawns[a.id]) ? 'not theirs to take' : null;
  // The matcher's bar besides: a task held at the side, or a task that would take one held out of reach (offerWhy). The player may still
  // order such a one (the verb work checks the side, not the reach): a policy of the matcher, not the evaluation.
  const matchBar = (st, a, j) =>
    takeBar(st, a, j) || ((a.mind || attentionOf(j) !== 'full') && offerWhy(st, a, j)) || null;
  // Pawn a's appraisal of posted job j: its bid, a number above 0 (its score, by the hands already at the job), or why it would not
  // bid, a string: the bar's (takeBar by default), 'not their work' or 'not worth the walk'. `stand`: the holder's mask where its caller
  // has it (VB-1545), else 0.
  function appraise(st, a, j, c, memo, bar = takeBar, stand = 0) {
    const why = bar(st, a, j);
    if (why) return why;
    const s = score(st, st.pawns[a.id], j, c, memo, stand);
    if (s === null) return 'not their work';
    return s > 0 ? s * joined(j, j.claims.length) : 'not worth the walk';
  }
  // The matcher's bid of pawn a for job j: its appraisal, or -1 when it would not bid.
  function bid(st, a, j, c, memo) {
    const r = appraise(st, a, j, c, memo, matchBar);
    return typeof r === 'number' ? r : -1;
  }
  // The command that sets pawn id to work at the job with key `key`, the same whoever chooses it.
  const workCommand = (id, key, source) => ({ actor: id, verb: 'work', target: key, source });
  // The jobs a pawn may bid for: its household's and its village's, in increasing id.
  const none = new Set();
  // When one of the two is empty, the other as it stands (VB-227: most villages post nothing of their own); callers only read it.
  function jobsFor(st, p) {
    const x = st.jobsBy.get(`household:${p.household}`) || none,
      y = st.jobsBy.get(`village:${villageOf(st, p)}`) || none;
    return y.size === 0 ? x : x.size === 0 ? y : mergeById(x, y);
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
  // Pawn p's fit for a job it may take, its appraisal as a row: {bid (null when it would not bid), reason (why not, or null)}; `stand`,
  // the holder's mask (standOf).
  function fit(st, p, j, c, stand = 0) {
    const r = appraise(st, st.agents[p.id], j, c, undefined, takeBar, stand);
    return typeof r === 'number' ? { bid: r, reason: null } : { bid: null, reason: r };
  }
  // Why a pawn gets no job: every open job it may take with its bid, or the reason it gets none. Best first. A levied member with no
  // levy left today, or at a job its list holds past its levy, is on its own hours (VB-1762): a job it would bid for and that its
  // judgement gives nothing to says so, the choice its own (sim/levies gives). Draws no random numbers and writes nothing to st.
  const KEPT = 'its own hours: it gives none';
  // The keys of levied member p's list the allotment gave no hours (fit < 0): past its levy even with levy left, as sim/day takeDay
  // reads them (review of VB-1762, F1).
  function pastLevy(st, hh, p, levied) {
    const out = new Set(),
      plan = levied ? planOf(st, 'household', hh.id) : null,
      day = plan && plan.day,
      list = day && day.lists[p.id],
      fits = day && day.fits && day.fits[p.id];
    if (list && fits) for (let i = 0; i < list.length; i++) if (fits[i] !== null && fits[i] < 0) out.add(list[i]);
    return out;
  }
  function explainIdle(st, id) {
    const p = st.pawns[id],
      c = cal(st.t),
      out = [],
      stand = standOf(st, p),
      hh = p.household === null ? null : st.households[p.household],
      levied = !!hh && !hh.dissolved && age(st, p) >= CHILD.from && Levies.levied(st, hh, p),
      own = levied && !(Levies.capacity(st, hh, p, c) > 1e-9),
      past = pastLevy(st, hh, p, levied);
    for (const j of st.jobs.values())
      if (eligible(st, j, p)) {
        const r = fit(st, p, j, c, stand),
          mine = own || past.has(j.key);
        out.push({
          job: j.key,
          kind: j.kind,
          ...(mine && r.bid !== null && !Levies.gives(st, hh, p, j, true) ? { bid: null, reason: KEPT } : r),
        });
      }
    return out.sort((x, y) => (y.bid ?? -Infinity) - (x.bid ?? -Infinity));
  }
  // One line for the pawn panel: the best reason an idle adult has no work; null when it has a job or it is not working time.
  function idleLine(st, id) {
    const a = st.agents[id],
      p = st.pawns[id],
      c = cal(st.t);
    if (!p.alive || a.job || !!a.homeward || c.hour < WORK[0] || c.hour >= WORK[1] || age(st, p) < CHILD.from)
      return null;
    const rows = explainIdle(st, id).filter((r) => r.reason !== 'taken' && r.reason !== 'not their work');
    if (!rows.length)
      return `No work for ${ROLES[p.role].title.toLowerCase()} at ${st.farmsteads[st.households[p.household].farmstead].name}`;
    const r = rows.find((x) => x.reason);
    if (!r) return null;
    return `${KINDS[r.kind].label}: ${r.reason}`;
  }
  // PAGE: what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
  return {
    score,
    bid,
    appraise,
    matchBar,
    joined,
    allotted,
    standOf,
    explainIdle,
    idleLine,
    workCommand,
    jobsFor,
    PAGE: ['explainIdle', 'idleLine'],
  };
})();
