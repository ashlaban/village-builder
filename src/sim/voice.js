// @sys sim/voice [agency]: a member's voice (VB-1555, VB-1763; design.md section 7, A member's voice; The levy and own hours, Grant and ask): a
//   member asks its head, the verb ask, an offer answered once by the head: on the basis `leave`, levy hours of a day, from an hour
//   named (or now) to the end of the working day, or whole days (a stay away of its own); on the basis `lighter`, a standing grant of
//   VOICE.lighter hours a day for the season. The head says no to leave when its day gave the member hours at a task with a deadline
//   that day or a window closing within VOICE.closing days, and to a lighter levy when its labour budget less the hours asked would not
//   fit its season (sim/levies fitsLess); else by its opinion of the member and its own diligence. A yes is the head's grant on the
//   household's plan (sim/levies grant): the levy in force falls by it, the allotment goes around the member on leave (sim/fit
//   allotted), and the hours are its own time (sim/pastimes); a no is a memory of the member's. A pawn asks leave of its own accord after
//   the morning's allotment, for the afternoon, when it courts or has not visited near kin or a close friend for VOICE.days, at most once
//   in that time, and spends the leave on a visit; and a lighter levy at the season's turn (its first review) when it took levy hours in
//   the season before.
// @state pawn.voiced: absent, or the game day the pawn last asked its head for leave of its own accord (VOICE.days). Written only here.
VB['sim/voice'] = (() => {
  const { emit, on } = VB['sim/events'];
  const { unbound } = VB['sim/pose'];
  const { DAY, WORK, SEASON_DAYS, cal } = VB['sim/rules'],
    { CHILD, MATCH } = VB['sim/roles'];
  const Offers = VB['sim/offers'];
  const { issue } = VB['sim/commands'];
  const { opinionOf, remember } = VB['sim/relations'];
  const { age, fullName, log, atHousehold, living, unplanned } = VB['sim/records'];
  const { of: traitOf } = VB['sim/traits'];
  const { KINDS, dutyTypes } = VB['sim/kinds'];
  const { planOf } = VB['sim/plans'];
  const Hands = VB['sim/hands'],
    Days = VB['sim/days'];
  const Pastimes = VB['sim/pastimes'];
  const { release } = VB['sim/agents'];
  const Grants = VB['sim/grants'],
    Levies = VB['sim/levies'];
  const { GOODWILL } = VB['sim/rules'];
  const { book: bookGoodwill } = VB['sim/relations'];
  const { register } = VB['sim/commands'];
  const { VOICE } = Grants;
  const today = (st) => Math.floor(st.t / DAY);
  const endOfWork = (st) => today(st) * DAY + WORK[1];
  const { grantOf, startOf } = Grants;
  // The household pawn id is a member of with a head other than itself, or null
  function homeOf(st, id) {
    const p = st.pawns[id],
      hh = p && p.alive && p.household !== null ? st.households[p.household] : null;
    return hh && !hh.dissolved && hh.farmstead !== null && hh.holder !== null && hh.holder !== id ? hh : null;
  }

  VB.counter(
    'leaveWeighed',
    "Entries of a member's day read by its head weighing an ask of leave (sim/voice, VB-1555)",
  );
  // ---- the head's answer ----
  // Does the head's day want pawn id's hours: it gave the member hours (the first pass, or the head of its list) at a task with a deadline
  // today (`late`, the meal) or whose window closes within VOICE.closing days (sim/hands windowEnd: the sowing, the frost), as its estimate saw them when it
  // allotted the day. A member its day does not know is wanted for nothing.
  function wanted(st, hh, id, c) {
    const plan = planOf(st, 'household', hh.id),
      day = plan && plan.day,
      list = day && day.lists[id];
    if (!list) return null;
    const now = c.season * SEASON_DAYS + c.sday,
      fits = day.fits[id] || [];
    for (let i = 0; i < list.length; i++) {
      VB.count.leaveWeighed++;
      const f = fits[i];
      if (f !== null && f !== undefined && f <= 0) continue; // the rest of the list, after the hours it was given
      const j = st.jobs.get(list[i]);
      if (!j) continue;
      if (KINDS[j.kind].late) return j;
      const end = Hands.windowEnd(st, j, c);
      if (end !== null && end - now < VOICE.closing) return j;
    }
    return null;
  }
  // Does the head's estimate want pawn id's hours on a day ahead, `day`: a task of the household whose window closes within VOICE.closing
  // days of it (its day for that day is not made yet). One pass over the household's tasks.
  function wantedAhead(st, hh, day, c) {
    const at = cal(day * DAY + WORK[0]),
      then = at.season * SEASON_DAYS + at.sday;
    for (const j of st.jobsBy.get(`household:${hh.id}`) || []) {
      VB.count.leaveWeighed++;
      const end = Hands.windowEnd(st, j, c);
      if (end !== null && end - then < VOICE.closing && end >= then) return j;
    }
    return null;
  }
  // The head's own leaning toward member id, by its opinion of the member and its own diligence (no draw)
  const leaning = (st, h, id) =>
    VOICE.base + opinionOf(st, h, id) - VOICE.diligence * (traitOf(st, h, 'diligence') - 0.5) * 2 > 0;
  // Would head h give member id leave on game day `day` (default today): by its day, else by its leaning.
  function willing(st, h, id, c, day = today(st)) {
    const hh = homeOf(st, id);
    if (!hh || hh.holder !== h) return false;
    if (day === today(st) ? wanted(st, hh, id, c) : wantedAhead(st, hh, day, c)) return false;
    return leaning(st, h, id);
  }
  // Would head h lighten member id's levy by `hours` a day for the rest of the season: no where its season, from today, would not fit
  // by its weekly comparison less them (sim/levies fitsLess), else by its leaning.
  function lightens(st, h, id, hours, c) {
    const hh = homeOf(st, id);
    if (!hh || hh.holder !== h) return false;
    return Levies.fitsLess(st, hh, id, hours, c) && leaning(st, h, id);
  }

  // ---- the head's grant (VB-1763; design.md, The levy and own hours: Grant and ask) ----
  // Grants of household hh's plan of a season or a day past, or of a pawn no longer its member, dropped.
  function prune(st, hh, G) {
    const today = Math.floor(st.t / DAY),
      key = Grants.seasonKey(cal(st.t)),
      member = (id) => st.pawns[id] && st.pawns[id].died === null && st.pawns[id].household === hh.id;
    for (const id of Object.keys(G.season)) if (G.season[id][0] < key || !member(+id)) delete G.season[id];
    G.dated = G.dated.filter((g) => g[1] + g[2] > today && member(g[0]));
  }
  // At every review of a household's plan, after its budget (sim/levies, whose listener comes first; a grant past counts in no
  // budget): its grants past dropped.
  on('planReviewed', (st, d) => {
    if (d.plan.holder.type !== 'household' || !d.plan.grants) return;
    const hh = st.households[d.plan.holder.id];
    if (!hh.dissolved) prune(st, hh, d.plan.grants);
  });
  // Why head `head` may not grant member id of its household `terms`, or null: {hours, season (default this season's key)}, a standing
  // grant of hours a day by the clock for a season not past, one a season; or {day (default today), days (whole days, default 1), from
  // (the game hour it begins on its first day; default that day's start, a whole day; several days are whole days), with (a pawn to
  // visit, or null)}, a dated grant from now or a day ahead, overlapping none of the member's. `contract` (a servant's free day,
  // sim/service; args.term): the head grants it by the contract, to a servant only.
  function grantWhy(st, head, id, terms, contract = false) {
    const p = Number.isInteger(id) ? st.pawns[id] : null,
      hh = p && p.died === null && p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved || hh.holder !== head) return `pawn ${head} is not the head of pawn ${id}'s household`;
    if (Levies.rowOf(st, hh, p) === null) return `${fullName(p)} owes its household no hours`;
    const T = terms || {},
      now = cal(st.t),
      today = Math.floor(st.t / DAY),
      G = Grants.grantsOf(st, hh);
    if ((contract || T.term !== undefined) && !(T.term === true && p.servant && T.hours === undefined))
      return "a free day at its term is a servant's, by its contract";
    if (T.hours !== undefined) {
      const key = T.season === undefined ? Grants.seasonKey(now) : T.season;
      if (!(Number.isFinite(T.hours) && T.hours > 0 && T.hours <= WORK[1] - WORK[0]))
        return `cannot grant ${T.hours} hours a day`;
      if (!Number.isInteger(key) || key < Grants.seasonKey(now) || key > Grants.seasonKey(now) + 1)
        return 'a standing grant is of this season or the next';
      // one standing grant a member, never withdrawn within the season it names (design.md, A season that does not fit)
      const held = G && G.season[id];
      if (held && held[0] >= Grants.seasonKey(now))
        return held[0] === key
          ? `${fullName(p)} has a grant for that season`
          : `${fullName(p)} has a standing grant in force`;
      return null;
    }
    const day = T.day === undefined ? today : T.day,
      days = T.days === undefined ? 1 : T.days,
      from = T.from === undefined ? day * DAY : T.from;
    if (!Number.isInteger(day) || day < today) return 'leave is of today or a day ahead';
    if (!Number.isInteger(days) || days < 1 || days > SEASON_DAYS) return `cannot grant ${days} days`;
    if (!Number.isFinite(from) || from < day * DAY || Math.max(st.t, from) >= day * DAY + WORK[1])
      return 'leave begins within the working day it is of';
    if (days > 1 && from !== day * DAY) return 'leave of several days is of whole days';
    if (T.with !== undefined && T.with !== null && !(Number.isInteger(T.with) && st.pawns[T.with]))
      return `cannot visit ${T.with}`;
    for (let d = day; d < day + days; d++) if (Grants.datedOn(G, id, d)) return `${fullName(p)} has leave on day ${d}`;
    return null;
  }
  VB.counter(
    'grantGiven',
    "Grants of a member's levy written on its household's plan: a head's, standing or dated, and a servant's free day (sim/levies, VB-1763)",
  );
  // grant(st, head, id, terms, contract): the grant written onto the household's plan (grantWhy's terms; true, or why not). A grant of the
  // head's books goodwill to its credit, the worth of the levy hours it gives (GOODWILL.hour an hour: 3 rations for 8), and opinion follows;
  // a contract's books none. A leave from now begins at once (sim/voice begin).
  function grant(st, head, id, terms, contract = false) {
    const why = grantWhy(st, head, id, terms, contract);
    if (why) return why;
    const p = st.pawns[id],
      hh = st.households[p.household],
      plan = planOf(st, 'household', hh.id);
    if (!plan) return 'the household has no plan';
    const G = plan.grants || (plan.grants = { season: {}, dated: [] }),
      now = cal(st.t),
      T = terms,
      hands = Math.max(0, Grants.handsOf(st, p)),
      today = Math.floor(st.t / DAY);
    prune(st, hh, G);
    VB.count.grantGiven++;
    let h = 0, // levy hours given (hours times hands), at most the levy in force they come off
      g = null;
    if (T.hours !== undefined) {
      const key = T.season === undefined ? Grants.seasonKey(now) : T.season,
        day = key === Grants.seasonKey(now) ? today : today + SEASON_DAYS - now.sday;
      h =
        Math.min(Levies.levyOf(st, id, day) || 0, T.hours * hands) *
        (key === Grants.seasonKey(now) ? SEASON_DAYS - now.sday : SEASON_DAYS);
      G.season[id] = [key, T.hours];
    } else {
      const day = T.day === undefined ? today : T.day,
        from = Math.max(st.t, T.from === undefined ? day * DAY : T.from);
      g = [id, day, T.days === undefined ? 1 : T.days, from, Number.isInteger(T.with) ? T.with : null, -1];
      for (let d = day; d < day + g[2]; d++)
        h += Math.min(Levies.levyOf(st, id, d) || 0, Grants.grantHours(g, d) * hands);
      G.dated.push(g);
    }
    const rations = h * GOODWILL.hour;
    if (!contract && rations > 0 && hh.holder !== null) bookGoodwill(st, hh.holder, id, rations);
    if (g && g[1] * DAY <= st.t && g[3] <= st.t) begin(st, id);
    return true;
  }
  // grant: the verb (3.6): the head lowers a member's levy, a standing grant or a dated one (grantWhy's terms as args).
  register('grant', {
    check: (st, c) => grantWhy(st, c.actor, c.target, c.args),
    run: (st, c) => {
      grant(st, c.actor, c.target, c.args, c.args.term === true);
    },
  });
  // ---- the basis `leave` ----
  // The day and the grant's terms an ask of leave o names: {day, days, from, with}; from now when its hour has passed.
  function termsOf(st, o) {
    const w = o.wants,
      from = Math.max(st.t, w.from),
      day = Math.floor(from / DAY);
    return { day, days: w.days === undefined ? 1 : w.days, from, with: Number.isInteger(w.with) ? w.with : null };
  }
  const words = (st, o) =>
    `an ask of leave by ${fullName(st.pawns[o.from])}${
      o.wants.days > 1
        ? ` for ${o.wants.days} days`
        : o.wants.from > st.t && o.wants.from % DAY
          ? ` from ${o.wants.from % DAY}:00`
          : ''
    }`;
  // Why the ask o may not be made, or its own fields: the asker is a member of working age of the asked's household, not its head, at
  // home for leave today; within a working day, from now, an hour named or a day ahead's start, of the terms its head could grant
  // (sim/levies grantWhy: of one levied, whole days for several, overlapping no leave of its).
  function check(st, o) {
    const hh = homeOf(st, o.from);
    if (!hh || hh.holder !== o.to) return `pawn ${o.to} is not the head of pawn ${o.from}'s household`;
    const p = st.pawns[o.from];
    if (age(st, p) < CHILD.from) return `${fullName(p)} is too young to be given work, or leave`;
    const w = o.wants;
    if (!w || !Number.isFinite(w.from)) return 'a leave names the hour it begins';
    if (w.with !== undefined && w.with !== null && !Number.isInteger(w.with)) return `cannot visit ${w.with}`;
    const T = termsOf(st, o);
    if (T.day === today(st)) {
      if (st.agents[o.from].away !== undefined || Days.on(st, o.from) !== null || Hands.on(st, o.from) !== null)
        return `${fullName(p)} is not at home today`;
      if (grantOf(st, o.from)) return `${fullName(p)} has had leave today`;
      if (T.from >= endOfWork(st) || st.t < today(st) * DAY + WORK[0] - 1) return 'leave is asked in the working day';
    }
    const why = grantWhy(st, o.to, o.from, T);
    return why || { household: hh.id };
  }
  VB.counter('leaveGiven', 'Leaves given by a head (sim/voice, VB-1555)');
  // A yes: the head's dated grant (sim/levies grant), begun at once when its hour is now
  function settle(st, o) {
    const hh = homeOf(st, o.from);
    if (!hh || hh.holder !== o.to) return 'the head has changed';
    const r = grant(st, o.to, o.from, termsOf(st, o));
    if (r === true) {
      VB.count.leaveGiven++;
    }
    return r;
  }
  VB.counter('leaveRefused', 'Asks of leave refused by a head (sim/voice, VB-1555)');
  // A no: the member remembers it (design.md: a no is a memory of the member's); told only where the player is one of the two
  function refused(st, o, no) {
    VB.count.leaveRefused++;
    if (living(st, o.from) === null && living(st, no.by) === null) remember(st, o.from, no.by, 'refusedUs');
    const me = st.player ? st.player.pawn : null;
    if (me !== null && (me === o.from || me === no.by))
      log(st, `${fullName(st.pawns[no.by])} refused ${BASES_WORDS[o.basis](st, o)}.`, {
        kind: 'offerRefused',
        pawn: no.by,
        other: o.from,
        ...atHousehold(st, st.households[o.household]),
      });
  }
  Offers.basis('leave', {
    asked: 'leave', // by the verb ask (sim/offers)
    books: 'nothing',
    wait: () => VOICE.wait,
    check,
    answers: (st, o) => [{ key: 'head', by: o.to, yes: null }],
    weigh: (st, o) => willing(st, o.to, o.from, cal(st.t), termsOf(st, o).day),
    settle,
    refused,
    what: words,
  });
  // ---- the basis `lighter` (VB-1763): a standing grant of wants.hours a day off the member's levy for the rest of this season ----
  const lighterWords = (st, o) => `an ask of a lighter levy by ${fullName(st.pawns[o.from])}`;
  const BASES_WORDS = { leave: words, lighter: lighterWords };
  function lighterCheck(st, o) {
    const hh = homeOf(st, o.from);
    if (!hh || hh.holder !== o.to) return `pawn ${o.to} is not the head of pawn ${o.from}'s household`;
    const w = o.wants;
    if (!w || !Number.isFinite(w.hours)) return 'a lighter levy names its hours a day';
    const why = grantWhy(st, o.to, o.from, { hours: w.hours });
    return why || { household: hh.id };
  }
  VB.counter('lighterGiven', 'Lighter levies granted by a head (sim/voice, VB-1763)');
  Offers.basis('lighter', {
    asked: 'lighter', // by the verb ask (sim/offers)
    books: 'nothing',
    wait: () => VOICE.wait,
    check: lighterCheck,
    answers: (st, o) => [{ key: 'head', by: o.to, yes: null }],
    weigh: (st, o) => lightens(st, o.to, o.from, o.wants.hours, cal(st.t)),
    settle: (st, o) => {
      const hh = homeOf(st, o.from);
      if (!hh || hh.holder !== o.to) return 'the head has changed';
      const r = grant(st, o.to, o.from, { hours: o.wants.hours });
      if (r === true) {
        VB.count.lighterGiven++;
      }
      return r;
    },
    refused,
    what: lighterWords,
  });

  // ---- the leave taken ----
  // Pawn id's leave begins: it leaves the task in hand and spends the hours at its own time (sim/pastimes): the visit it asked leave for,
  // where the one it means is at home; else its own choice. The played pawn on its own commands chooses for itself.
  function begin(st, id) {
    const g = grantOf(st, id);
    if (!g || g[5] === today(st)) return;
    g[5] = today(st); // begun today
    const until = endOfWork(st),
      w = g[4];
    emit(st, 'leftDay', { pawn: id }); // its tasks to the others (sim/day; VB-1758)
    if (unplanned(st, id)) return;
    const a = st.agents[id];
    if (w !== null && Pastimes.why(st, id, 'visit', { with: w, until }) === null) {
      if (a.job) release(st, a);
      if (
        issue(st, {
          actor: id,
          verb: 'pastime',
          target: 'visit',
          args: { with: w, until },
          source: 'planner',
        }) === true
      )
        return;
    }
    if (a.job) release(st, a); // a hand that leaves a task is released from it (VB-1565)
    if (unbound(a) && !a.job) Pastimes.ownTime(st, a);
  }
  // A pawn's own reason to ask, and whom it means to visit: it courts (the one it courts), or it has not visited near kin or a close friend
  // for VOICE.days (pawn.sat, sim/pastimes) and has someone in its village to visit (sim/pastimes someoneToVisit); and it has not asked
  // of its own accord in VOICE.days. [true, the one it means or null], or null for no reason.
  function reason(st, p, day) {
    if (Number.isInteger(p.voiced) && day - p.voiced < VOICE.days) return null;
    if (Number.isInteger(p.courting)) return p.courting;
    if (Number.isInteger(p.sat) && day - p.sat < VOICE.days) return null;
    return Pastimes.someoneToVisit(st, p);
  }
  VB.counter(
    'leaveLook',
    "Members looked at after the morning's allotment for a reason to ask leave (sim/voice, VB-1555)",
  );
  // After the morning's allotment: each member of working age, not the head nor the played pawn on its own commands, whom the day gave
  // work and who has a reason, asks its head for the afternoon (VOICE.from). A pass over the living a day (members x 1 a day, a few lookups each).
  function morning(st) {
    const day = today(st),
      from = day * DAY + VOICE.from;
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      if (hh.holder === null || hh.farmstead === null) continue;
      dutyLook(st, hh, day);
      const plan = planOf(st, 'household', id),
        lists = plan && plan.day && plan.day.lists;
      if (!lists) continue;
      for (const pid of hh.members) {
        VB.count.leaveLook++;
        const p = st.pawns[pid];
        if (pid === hh.holder || unplanned(st, pid) || p.died !== null || !lists[pid] || !lists[pid].length) continue;
        if (age(st, p) < Pastimes.PASTIME.visit) continue;
        const target = reason(st, p, day);
        if (target === null) continue;
        p.voiced = day;
        ask(st, pid, from, target);
      }
    }
  }
  VB.counter('leaveAsked', 'Asks of leave made by a member of its head (sim/voice, VB-1555)');
  // Pawn id asks its head for leave from hour `from` (game hours), to visit `with` (or null), for `days` whole days (from a day's start)
  // where more than one: the verb ask, by its own rule (source 'pawn', the default author; any controller issues the same verb, VB-1756)
  function ask(st, id, from, w = null, days = 1) {
    const hh = homeOf(st, id);
    if (!hh) return 'it has no head to ask';
    VB.count.leaveAsked++;
    // any head answers by its pawn's judgement at once, an unplanned one by its controller (sim/offers make, VB-1776)
    return issue(st, {
      actor: id,
      verb: 'ask',
      target: hh.holder,
      args: { basis: 'leave', wants: days > 1 ? { from, with: w, days } : { from, with: w } },
      source: 'pawn',
    });
  }
  VB.counter(
    'grantLook',
    "Dated grants on a household's plan looked at, for a member's levy in force, the budget or a leave begun (sim/levies, sim/voice; VB-1763)",
  );
  // Each hour of the working day: the leaves whose hour has come begin (the dated grants of each household's plan); after the morning's
  // allotment, the members' own asks.
  function hour(st, c) {
    if (c.hour === WORK[0] - 1) morning(st);
    const d = today(st);
    for (const hid of st.liveHouseholds) {
      const hh = st.households[hid];
      for (const g of Grants.datedOf(st, hh)) {
        VB.count.grantLook++;
        if (g[5] !== d && d >= g[1] && d < g[1] + g[2] && st.t >= startOf(st, g) && st.t < endOfWork(st))
          begin(st, g[0]);
      }
    }
  }
  VB.counter('lighterLook', "Members looked at at the season's turn for an ask of a lighter levy (sim/voice, VB-1763)");
  // At household hh's season's turn (its first review, sim/levies): each levied member not on its own commands that took hours of its
  // levy in the season before asks its head a lighter levy of VOICE.lighter hours a day for this season, by its own rule (the default
  // author). One look a member a season.
  function lighter(st, hh, c) {
    if (hh.holder === null || hh.farmstead === null) return;
    const L = Levies,
      before = L.tallyOf(st, hh, c).before;
    for (const pid of hh.members) {
      VB.count.lighterLook++;
      const p = st.pawns[pid];
      if (pid === hh.holder || p.died !== null || unplanned(st, pid) || L.rowOf(st, hh, p) === null) continue;
      if (!(before[pid] && before[pid][1] > 0)) continue;
      askLighter(st, pid, VOICE.lighter);
    }
  }
  on('seasonJudged', (st, d) => lighter(st, d.hh, d.c));
  VB.counter('lighterAsked', 'Asks of a lighter levy made by a member of its head (sim/voice, VB-1763)');
  // Pawn id asks its head a lighter levy of `hours` a day for the rest of the season: the verb ask, by its own rule (source 'pawn').
  function askLighter(st, id, hours) {
    const hh = homeOf(st, id);
    if (!hh) return 'it has no head to ask';
    VB.count.lighterAsked++;
    return issue(st, {
      actor: id,
      verb: 'ask',
      target: hh.holder,
      args: { basis: 'lighter', wants: { hours } },
      source: 'pawn',
    });
  }
  // ---- the basis `duty` (VB-1556): a member asks its head for a type of recurring work without a window as its own ----
  // @state pawn.dutied: absent, or the game day the pawn was last seen holding a duty (the morning's look); pawn.dutyAsked: absent, or the
  //   game day it last asked for a duty of its own accord (once a season, VOICE.dutyDays). Written only here.
  const dutyWords = (st, o) => `an ask of the ${o.wants.duty} duty by ${fullName(st.pawns[o.from])}`;
  BASES_WORDS.duty = dutyWords;
  function dutyCheck(st, o) {
    const hh = homeOf(st, o.from);
    if (!hh || hh.holder !== o.to) return `pawn ${o.to} is not the head of pawn ${o.from}'s household`;
    if (age(st, st.pawns[o.from]) < CHILD.from) return `${fullName(st.pawns[o.from])} is too young for a duty`;
    if (!o.wants || !dutyTypes().has(o.wants.duty)) return 'a duty is of a type of recurring work without a window';
    return { household: hh.id };
  }
  // Would head h give member id the duty `type`: where none holds it, yes; where another does, only if member id is more skilled at the
  // type as the head sees it (sim/estimate skillSeen) than the holder.
  function dutyWilling(st, h, id, type) {
    const hh = homeOf(st, id);
    if (!hh || hh.holder !== h) return false;
    const s = VB['sim/steps'].dutyOf(planOf(st, 'household', hh.id), type);
    if (!s) return true;
    if (s.who[0] === id) return false;
    const { skillSeen } = VB['sim/estimate'];
    return skillSeen(st, h, id, type) > skillSeen(st, h, s.who[0], type);
  }
  VB.counter('dutyGiven', 'Duties given by a head to a member that asked (sim/voice, VB-1556)');
  VB.counter('dutyRefused', 'Asks of a duty refused by a head (sim/voice, VB-1556)');
  VB.counter('dutyAsked', 'Asks of a duty made by a member of its head (sim/voice, VB-1556)');
  VB.counter('dutyLook', 'Members looked at in the morning for an ask of a duty (sim/voice, VB-1556)');
  Offers.basis('duty', {
    asked: 'duty', // by the verb ask (sim/offers)
    books: 'nothing',
    wait: () => VOICE.wait,
    check: dutyCheck,
    answers: (st, o) => [{ key: 'head', by: o.to, yes: null }],
    weigh: (st, o) => dutyWilling(st, o.to, o.from, o.wants.duty),
    settle: (st, o) => {
      const hh = homeOf(st, o.from);
      if (!hh || hh.holder !== o.to) return 'the head has changed';
      if (!dutyTypes().has(o.wants.duty)) return 'no such duty';
      VB['sim/steps'].giveDuty(st, planOf(st, 'household', hh.id), o.wants.duty, o.from, 'pawn');
      VB.count.dutyGiven++;
      return true;
    },
    // a no is a memory of the member's; no line in the village's log (a duty asked is a small matter, a leave a larger)
    refused: (st, o, no) => {
      VB.count.dutyRefused++;
      if (living(st, o.from) === null && living(st, no.by) === null) remember(st, o.from, no.by, 'refusedUs');
    },
    what: dutyWords,
  });
  // Pawn id asks its head for the duty `type`: the verb ask, by its own rule (source 'pawn').
  function askDuty(st, id, type) {
    const hh = homeOf(st, id);
    if (!hh) return 'it has no head to ask';
    VB.count.dutyAsked++;
    return issue(st, {
      actor: id,
      verb: 'ask',
      target: hh.holder,
      args: { basis: 'duty', wants: { duty: type } },
      source: 'pawn',
    });
  }
  // The morning's look at household hh: those holding a duty are marked (pawn.dutied); each member of working age, not the head nor on
  // its own commands, that holds none and has held none for a season (VOICE.dutyDays) and has not asked for one in that time, asks for the type
  // it is most skilled at, where its head would give it (the lower type on a tie). A pass over the members and the duties.
  function dutyLook(st, hh, day) {
    if (!VOICE.duties) return; // off until Kim's answer on duties (sim/day SWITCH.duties, VB-1771): given, they raised the hunger of a populous run
    const plan = planOf(st, 'household', hh.id);
    if (!plan || !plan.ahead) return;
    for (const s of plan.ahead) if (s.what.duty !== undefined && st.pawns[s.who[0]]) st.pawns[s.who[0]].dutied = day;
    const { skillOf } = VB['sim/skills'],
      types = [...dutyTypes().keys()];
    for (const pid of hh.members) {
      VB.count.dutyLook++;
      const p = st.pawns[pid];
      if (pid === hh.holder || p.died !== null || unplanned(st, pid) || age(st, p) < CHILD.from) continue;
      if (Number.isInteger(p.dutied) && day - p.dutied < VOICE.dutyDays) continue;
      if (Number.isInteger(p.dutyAsked) && day - p.dutyAsked < VOICE.dutyDays) continue;
      let best = null;
      for (const T of types) if (best === null || skillOf(st, pid, T) > skillOf(st, pid, best)) best = T;
      if (best === null || !dutyWilling(st, hh.holder, pid, best)) continue; // it asks where it would be given (everyone knows what the head sees)
      p.dutyAsked = day;
      askDuty(st, pid, best);
    }
  }
  // The likely answer of pawn id's head to an ask of the duty `type`, as pawn id sees it: true, false, or null with no head.
  function dutyLikely(st, id, type) {
    const hh = homeOf(st, id);
    return hh ? dutyWilling(st, hh.holder, id, type) : null;
  }
  // The likely answer of pawn id's head to an ask of leave from `from`, as pawn id sees it (principle "The future is someone's estimate"; everyone knows
  // everything for
  // now: sim/opportunities actorView): true, false, or null when it has no head to ask.
  function likely(st, id) {
    const hh = homeOf(st, id);
    return hh ? willing(st, hh.holder, id, cal(st.t)) : null;
  }
  return {
    VOICE,
    on: Grants.on,
    leaveOf: Grants.leaveOf,
    likely,
    hour,
    ask,
    askLighter,
    askDuty,
    dutyLikely,
    dutyWilling,
    lighter,
    begin,
    wanted,
    grant,
    grantWhy,
  };
})();
