// @sys sim/points: the decision points open to a pawn's controller (VB-1757; design.md section 15, Decision points;
//   docs/plans/four-scales/README.md, 3.6): where the pawn's own rule, or the default author of a body it is agent of, would next act,
//   each with its deadline in game hours, past which that rule answers as it does with no controller. A view computed when asked
//   (Sim.decisions): nothing is stored, no simulation module reads it, and a run whose controllers never ask does no work here
VB['sim/points'] = (() => {
  const { DAY, SEASON_DAYS, YEAR_DAYS, WORK, cal, TICKS } = VB['sim/rules'],
    { MATCH } = VB['sim/roles'];
  const { cadence, nextSlot } = VB['sim/plandays'];
  const { pawnPlan } = VB['sim/steps'];
  const { agentOf } = VB['sim/decisions'];
  const { controlOf } = VB['sim/controller'];
  const { unbound, travelling } = VB['sim/pose'];
  const { MEETING } = VB['sim/meetings'];
  const { weighDay } = VB['sim/day'];
  const { allotted } = VB['sim/fit'];
  const Levies = VB['sim/levies'];
  const SEASON = SEASON_DAYS * DAY,
    YEAR = YEAR_DAYS * DAY;
  // The hours of the day's two allotments (sim/jobs refreshJobs, sim/day allot): the morning's, an hour before work, and the afternoon's.
  const ALLOTS = [WORK[0] - 1, MATCH.day.afternoon];
  // The game hour of the next year's meetings after t: the agenda closes as they begin (sim/meetings MEETING).
  function meetingAfter(t) {
    const m = Math.floor(t / YEAR) * YEAR + (MEETING.season * SEASON_DAYS + MEETING.sday) * DAY + MEETING.hour;
    return m > t ? m : m + YEAR;
  }
  // When an offer due at hour `due` is answered by the judgement of those who have not: at the turn of the day it is due by (sim/offers
  // dueOffers, the calendar's daily row), or earlier where its basis concludes it out of its time (the moving round's).
  const dueAt = (due) => Math.ceil(due / DAY) * DAY;
  // The next allotment after t, and which.
  function allotAfter(t) {
    const day = Math.floor(t / DAY);
    for (let d = day; ; d++)
      for (let i = 0; i < ALLOTS.length; i++) if (d * DAY + ALLOTS[i] > t) return { at: d * DAY + ALLOTS[i], which: i };
  }
  // The first review of household plan `plan` in the season after its present one: its next planning day after the season's turn (sim/plandays
  // nextSlot, by its head's cadence); the present season's while the plan has not been reviewed since its turn (its next review). A review
  // out of turn (a window closing, a store's target crossed) may come before it.
  function seasonReview(st, plan) {
    const s0 = Math.floor(st.t / SEASON) * SEASON;
    if (plan.reviewed === null || plan.reviewed === undefined || plan.reviewed < s0) return plan.nextReview;
    return nextSlot(plan, cadence(st, plan), s0 + SEASON - 1);
  }
  // Whether the rule's day would put work on a member it did not stand for (tasks done since, or no longer owed, drop out of the day and
  // change nothing): some member's list holds a task not in its standing list.
  function moved(would, standing) {
    for (const id in would) {
      const had = new Set(standing[id] || []);
      for (const t of would[id]) if (!had.has(t)) return true;
    }
    return false;
  }
  // Whether the head has a choice in its next allotment (VB-1884): the day the rule would allot (sim/day weighDay, as of the hour of the
  // allotment) moves work to a member the day standing did not give it (who does what); else the rule's day is the day standing, and
  // there is nothing to choose. A household with no day standing yet: its allotted members, if any.
  function choice(st, hh, plan) {
    let n = 0;
    for (const id of hh.members) if (st.pawns[id].died === null && allotted(st, st.pawns[id])) n++;
    if (!plan.day) return n > 0;
    return moved(weighDay(st, hh, cal(allotAfter(st.t).at)).lists, plan.day.lists);
  }
  // The points of pawn id, living, as agent of household hid's plan (its head): the year's review (the meeting's agenda closing), the
  // season's (its first review), the days ahead (its planning day), and the next of the day's two allotments (a household on a farm).
  function headPoints(st, hid, out) {
    const hh = st.households[hid],
      plan = st.plans && st.plans.households.get(hid);
    if (!plan || hh.dissolved) return;
    const body = { kind: 'household', id: hid };
    out.push({ point: 'year', body, deadline: meetingAfter(st.t) });
    out.push({ point: 'season', body, deadline: seasonReview(st, plan) });
    out.push({ point: 'ahead', body, deadline: plan.nextReview });
    const a = allotAfter(st.t);
    if (hh.farmstead !== null && choice(st, hh, plan)) {
      out.push({ point: 'allot', body, which: a.which ? 'afternoon' : 'morning', deadline: a.at });
      // work at risk with the levies spent (VB-1779): demand more, or not, by the hour
      const risk = plan.day && plan.day.risk;
      if (risk && plan.day.made === Math.floor(st.tick / TICKS))
        for (const [key, work] of risk)
          if (st.jobs.has(key)) out.push({ point: 'demand', body, key, work, deadline: Math.floor(st.t) + 1 });
    }
  }
  // Sim.decisions(st, id): the decision points open to pawn id's controller now, by deadline (then as listed), each {point, deadline (a
  // game hour; st.t: at once), and its own fields}; none for a pawn that is dead or no pawn. Read only.
  //   year, season, ahead (body {kind, id}): the reviews of a body it is agent of: a household it heads (all three), a village it is the
  //     alderman of (the year's only: its plan's daily review carries out the meeting's routines by rule and asks no choice of him);
  //   allot (body, which: 'morning' | 'afternoon'): the head's next allotment of its household's day;
  //   ahead (body the pawn's own): a pawn that plans for itself (sim/steps pawnPlan), at its household's next review, which weighs its steps;
  //   risk (step: its id, short, by): a step of its own plan at risk (VB-1755), until that review, where the default author may take it back;
  //   leg: its automatic behaviour off, its queue empty and nothing in hand: at once;
  //   ask (offer: its id, basis): an offer it has an answer to give, until the day's turn after it falls due (sim/offers), when its judgement
  //     answers.
  //   demand (body, key, work): work at risk its allotment left with the levies spent (VB-1779), the head's to demand or not, by the hour;
  //   demanded (offer): a demand of its head's past its levy (an offer on the basis `demand`), to comply with or refuse, at once (its
  //     judgement answers at the day's turn);
  //   take (levy): hours of its levy left today, a levied member's to take for itself (the verb breach) or not, at once.
  // The levy's other points join this list (VB-1763, VB-1769).
  function decisions(st, id) {
    const p = Number.isInteger(id) ? st.pawns[id] : null;
    if (!p || p.died !== null) return [];
    const out = [],
      hid = p.household,
      hh = hid === null || hid === undefined ? null : st.households[hid];
    if (hh && hh.holder === id) headPoints(st, hid, out);
    for (const v of st.villages)
      if (agentOf(st, v.id) === id)
        out.push({ point: 'year', body: { kind: 'village', id: v.id }, deadline: meetingAfter(st.t) });
    const pp = pawnPlan(st, id),
      plan = hh && !hh.dissolved && st.plans ? st.plans.households.get(hid) : null;
    if (pp && plan) {
      const body = { kind: 'pawn', id };
      out.push({ point: 'ahead', body, deadline: plan.nextReview });
      // the review at which the default author would answer: the first review hour past the step's by (VB-1892)
      const riskAnswer = (by) => (by + 1) * DAY + WORK[0] - 1;
      for (const s of pp.steps)
        if (s.state === 'at-risk')
          out.push({ point: 'risk', step: s.id, short: s.risk.short, by: s.by, deadline: riskAnswer(s.by) });
    }
    // hours of its levy left today, in the working day, at home and not taking already (sim/day takeWhy, read only here)
    const left = hh && hh.holder !== null && hh.holder !== id ? Levies.leftToday(st, p) : null,
      ag = st.agents[id],
      hour = st.t % DAY;
    if (
      left > 1e-9 &&
      hour >= WORK[0] &&
      hour < WORK[1] &&
      !(ag.taking > st.tick) &&
      !travelling(ag) &&
      ag.away === undefined
    )
      out.push({ point: 'take', levy: Math.min(left, WORK[1] - hour), deadline: st.t });
    const c = controlOf(st, id);
    if (!c.auto && !c.queue.length && unbound(st.agents[id])) out.push({ point: 'leg', deadline: st.t });
    for (const o of st.offers) {
      VB.count.pointOffer++;
      if (o.answers.some((a) => a.by === id && a.yes === null))
        out.push(
          o.basis === 'demand'
            ? { point: 'demanded', offer: o.id, key: o.wants.key, hours: o.wants.hours, deadline: dueAt(o.due) }
            : { point: 'ask', offer: o.id, basis: o.basis, deadline: dueAt(o.due) },
        );
    }
    return out
      .map((x, i) => [x, i])
      .sort((a, b) => a[0].deadline - b[0].deadline || a[1] - b[1])
      .map((x) => x[0]);
  }
  return { decisions, meetingAfter };
})();
