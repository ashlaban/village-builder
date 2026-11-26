// @sys sim/voice: a member's voice (VB-1555; design.md section 7, A member's voice): a member asks its head for leave, free hours today
//   from now or from an hour named to the end of the working day: an offer on the basis `leave` (sim/offers), answered by the head's day
//   (no when it gave the member hours at a task with a deadline today or a window closing today) and else by its opinion of the member and
//   its own diligence; a yes takes the member out of the day's allotment for those hours (sim/fit allotted) and they are its own time
//   (sim/pastimes); a no is a memory of the member's. A pawn asks of its own accord after the morning's allotment, for the afternoon, when
//   it courts or has not visited near kin or a close friend for VOICE.days, at most once in that time, and spends the leave on a visit.
// @state st.leaves: absent until the first leave is given, then {day (game day), by: {pawn id: [from, until (game hours), begun (0 or 1),
//   with (the pawn it means to visit, or null)]}}: today's leaves; a new day's first look closes yesterday's. Written only here.
// @state pawn.voiced: absent, or the game day the pawn last asked its head for leave of its own accord (VOICE.days). Written only here.
VB['sim/voice'] = (() => {
  const { unbound } = VB['sim/pose'];
  const { DAY, WORK, SEASON_DAYS, cal } = VB['sim/rules'],
    { CHILD, MATCH } = VB['sim/roles'];
  const Offers = VB['sim/offers'];
  const { issue } = VB['sim/commands'];
  const { opinionOf, remember } = VB['sim/relations'];
  const { age, fullName, log, atHousehold, living, unplanned } = VB['sim/records'];
  const { of: traitOf } = VB['sim/traits'];
  const { KINDS } = VB['sim/kinds'];
  const { planOf } = VB['sim/plans'];
  const Hands = VB['sim/hands'],
    Days = VB['sim/days'];
  const Pastimes = VB['sim/pastimes'];
  const { release } = VB['sim/agents'];
  // @tunable VOICE: a member's voice (VB-1555; design.md section 7, A member's voice)
  // days: a pawn asks of its own accord when it has not visited near kin or a close friend for this many days, at most once in them;
  // from: the hour its own ask's leave begins (the afternoon's allotment, MATCH.day.afternoon); wait: the days the played head has to
  // answer; closing: a window that closes within this many days wants the hands the head gave it; base, diligence: the head says yes
  // when base + its opinion of the member - diligence * (its diligence - 0.5) * 2 is above 0.
  const VOICE = { days: 6, from: MATCH.day.afternoon, wait: 0.125, base: 0.2, diligence: 0.3, closing: 3 };
  const today = (st) => Math.floor(st.t / DAY);
  const endOfWork = (st) => today(st) * DAY + WORK[1];
  const leaves = (st) => {
    const d = st.leaves;
    return d && d.day === today(st) ? d : null;
  };
  function todays(st) {
    let d = leaves(st);
    if (!d) d = st.leaves = { day: today(st), by: {} };
    return d;
  }
  // Is pawn id on leave now: one lookup, for the allotment of every member (sim/fit allotted).
  function on(st, id) {
    const d = leaves(st),
      e = d && d.by[id];
    return !!e && st.t >= e[0] && st.t < e[1];
  }
  // The leave pawn id holds today, [from, until, begun, with], or null
  const leaveOf = (st, id) => {
    const d = leaves(st);
    return (d && d.by[id]) || null;
  };
  // The household pawn id is a member of with a head other than itself, or null
  function homeOf(st, id) {
    const p = st.pawns[id],
      hh = p && p.alive && p.household !== null ? st.households[p.household] : null;
    return hh && !hh.dissolved && hh.farmstead !== null && hh.holder !== null && hh.holder !== id ? hh : null;
  }

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
  // Would head h give member id leave: by its day, else by its opinion of the member and its own diligence (no draw).
  function willing(st, h, id, c) {
    const hh = homeOf(st, id);
    if (!hh || hh.holder !== h || wanted(st, hh, id, c)) return false;
    return VOICE.base + opinionOf(st, h, id) - VOICE.diligence * (traitOf(st, h, 'diligence') - 0.5) * 2 > 0;
  }

  // ---- the basis `leave` ----
  const words = (st, o) =>
    `an ask of leave by ${fullName(st.pawns[o.from])}${o.wants.from > st.t ? ` from ${o.wants.from % DAY}:00` : ''}`;
  // Why the ask o may not be made, or its own fields: the asker is a member of working age of the asked's household, not its head, on no
  // road, with no leave today; within the working day, from now or an hour named before its end.
  function check(st, o) {
    const hh = homeOf(st, o.from);
    if (!hh || hh.holder !== o.to) return `pawn ${o.to} is not the head of pawn ${o.from}'s household`;
    const p = st.pawns[o.from];
    if (age(st, p) < CHILD.from) return `${fullName(p)} is too young to be given work, or leave`;
    if (st.agents[o.from].away !== undefined || Days.on(st, o.from) !== null || Hands.on(st, o.from) !== null)
      return `${fullName(p)} is not at home today`;
    if (leaveOf(st, o.from)) return `${fullName(p)} has had leave today`;
    const w = o.wants;
    if (!w || !Number.isFinite(w.from)) return 'a leave names the hour it begins';
    const from = Math.max(st.t, w.from);
    if (from >= endOfWork(st) || st.t < today(st) * DAY + WORK[0] - 1) return 'leave is asked in the working day';
    if (w.with !== undefined && w.with !== null && !Number.isInteger(w.with)) return `cannot visit ${w.with}`;
    return { household: hh.id };
  }
  // A yes: the leave from its hour to the end of the working day; begun at once when its hour is now
  function settle(st, o) {
    const hh = homeOf(st, o.from);
    if (!hh || hh.holder !== o.to) return 'the head has changed';
    const from = Math.max(st.t, o.wants.from);
    if (from >= endOfWork(st)) return 'the working day is over';
    const d = todays(st);
    d.by[o.from] = [from, endOfWork(st), 0, Number.isInteger(o.wants.with) ? o.wants.with : null];
    VB.count.leaveGiven++;
    if (from <= st.t) begin(st, o.from);
    return true;
  }
  // A no: the member remembers it (design.md: a no is a memory of the member's); told only where the player is one of the two
  function refused(st, o, no) {
    VB.count.leaveRefused++;
    if (living(st, o.from) === null && living(st, no.by) === null) remember(st, o.from, no.by, 'refusedUs');
    const me = st.player ? st.player.pawn : null;
    if (me !== null && (me === o.from || me === no.by))
      log(st, `${fullName(st.pawns[no.by])} refused ${words(st, o)}.`, {
        kind: 'offerRefused',
        pawn: no.by,
        other: o.from,
        ...atHousehold(st, st.households[o.household]),
      });
  }
  Offers.basis('leave', {
    books: 'nothing',
    wait: () => VOICE.wait,
    check,
    answers: (st, o) => [{ key: 'head', by: o.to, yes: null }],
    weigh: (st, o) => willing(st, o.to, o.from, cal(st.t)),
    settle,
    refused,
    what: words,
  });

  // ---- the leave taken ----
  // Pawn id's leave begins: it leaves the task in hand and spends the hours at its own time (sim/pastimes): the visit it asked leave for,
  // where the one it means is at home; else its own choice. The played pawn on its own commands chooses for itself.
  function begin(st, id) {
    const e = leaveOf(st, id);
    if (!e || e[2]) return;
    e[2] = 1;
    if (unplanned(st, id)) return;
    const a = st.agents[id];
    if (e[3] !== null && Pastimes.why(st, id, 'visit', { with: e[3], until: e[1] }) === null) {
      if (a.job) release(st, a);
      if (
        issue(st, {
          actor: id,
          verb: 'pastime',
          target: 'visit',
          args: { with: e[3], until: e[1] },
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
  // After the morning's allotment: each member of working age, not the head nor the played pawn on its own commands, whom the day gave
  // work and who has a reason, asks its head for the afternoon (VOICE.from). A pass over the living a day (members x 1 a day, a few lookups each).
  function morning(st) {
    const day = today(st),
      from = day * DAY + VOICE.from;
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      if (hh.holder === null || hh.farmstead === null) continue;
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
  // Pawn id asks its head for leave from hour `from` (game hours), to visit `with` (or null)
  function ask(st, id, from, w = null) {
    const hh = homeOf(st, id);
    if (!hh) return 'it has no head to ask';
    VB.count.leaveAsked++;
    // the played head left to itself (on its own, no command waiting) answers by its pawn's judgement at once, as an unplayed head would:
    // an inhabited pawn given no command changes nothing (tests/player.js)
    if (st.player && st.player.pawn === hh.holder && !unplanned(st, hh.holder)) {
      const o = { from: id, to: hh.holder, basis: 'leave', wants: { from, with: w }, made: st.t, due: st.t };
      const r = Offers.cannotOffer(st, {
        actor: id,
        verb: 'offer',
        target: hh.holder,
        args: { basis: 'leave', wants: o.wants },
      });
      if (r) return r;
      o.household = hh.id;
      if (willing(st, hh.holder, id, cal(st.t))) return settle(st, o);
      refused(st, o, { key: 'head', by: hh.holder });
      return 'no';
    }
    return issue(st, {
      actor: id,
      verb: 'offer',
      target: hh.holder,
      args: { basis: 'leave', wants: { from, with: w } },
      source: 'planner',
    });
  }
  // Each hour of the working day: the leaves whose hour has come begin; after the morning's allotment, the members' own asks.
  function hour(st, c) {
    if (c.hour === WORK[0] - 1) morning(st);
    const d = leaves(st);
    if (!d) return;
    for (const [id, e] of Object.entries(d.by)) if (!e[2] && st.t >= e[0] && st.t < e[1]) begin(st, +id);
  }
  // The likely answer of pawn id's head to an ask of leave from `from`, as pawn id sees it (principle "The future is someone's estimate"; everyone knows
  // everything for
  // now: sim/opportunities actorView): true, false, or null when it has no head to ask.
  function likely(st, id) {
    const hh = homeOf(st, id);
    return hh ? willing(st, hh.holder, id, cal(st.t)) : null;
  }
  return { VOICE, on, leaveOf, likely, hour, ask, wanted };
})();
