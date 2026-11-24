// @sys sim/timetable: the timetable (VB-477; design.md section 7, The timetable): a household's day as a view, worked out when asked and
//   never in a step: each member's list laid end to end with its walks, each task a range by the estimate of the pawn who looks (the one the
//   player inhabits: flaws and all); progress so far is exact. With it the cost of calling a member off, named before the call. Writes nothing
// Principle (AGENTS.md, Deciding without Kim, 14): what is shown of the future is some pawn's estimate (sim/estimate).
VB['sim/timetable'] = (() => {
  const { SPEED } = VB['sim/rules'];
  const { route, routeCost } = VB['sim/routes'];
  const { placeOf, tileAt } = VB['sim/pose'];
  const { KINDS } = VB['sim/kinds'];
  const { attentionOf, doneOf } = VB['sim/work'];
  const { planOf } = VB['sim/plans'];
  const Estimate = VB['sim/estimate'];
  // The walking hours between two tiles by the route a pawn would take; every judgement reckons with the walk.
  const walkHours = (st, from, to) =>
    from === to || from < 0 || to < 0 ? 0 : routeCost(st.w, route(st, from, to)) / SPEED;
  // The tile pawn id stands on, or works at.
  function tileOf(st, id) {
    const a = st.agents[id];
    if (a.job && a.phase === 'work') return a.job.site;
    const [x, y] = placeOf(st, a);
    return tileAt(st, x, y);
  }
  // The exact share done of task j, 0 to 1 (progress so far is seen, and exact).
  const shareDone = (st, j) => {
    const h = j.hours ?? KINDS[j.kind].hours ?? 0;
    return h > 0 ? Math.min(1, doneOf(st, j) / h) : 0;
  };
  // Who is given task key in the day: the members whose list holds it among their tasks given hands (fit null or above 0).
  function handsOf(day, key) {
    const out = [];
    for (const id of Object.keys(day.lists)) {
      const i = day.lists[id].indexOf(key);
      if (i >= 0 && (!day.fits || day.fits[id][i] === null || day.fits[id][i] > 0)) out.push(Number(id));
    }
    return out;
  }
  // Household hh's timetable as pawn `viewer` reckons it (its head when null), or null with no day: {household, viewer, made (the hour
  // the day was allotted), edited (the head's last change, standing until the day is next allotted, or null), members: [{id, now (the
  // key of the task in hand, or null), entries, rest (the keys of its list it was given no hours of: taken when the others are done or
  // closed), free (its hours of the horizon given no task)}]}. An entry: {key, kind, label, site, walk (hours from the last place),
  // lo, mid, hi (its hours, the viewer's range), start and end ({lo, mid, hi}, hours from now, laid end to end), part (the member is
  // given a part of it: its range is the share of the head's hours), side (a task held beside its work: no hours of its own), done (the
  // share done, exact), unseen (the causes the viewer's judgement does not reckon with)}.
  function timetable(st, hh, viewer = null) {
    const plan = planOf(st, 'household', hh.id),
      day = plan && plan.day;
    if (!day) return null;
    const head = plan.head ? plan.head.pawn : null,
      who = viewer === null || viewer === undefined ? head : viewer,
      members = [];
    for (const id of hh.members) {
      if (st.pawns[id].died !== null || !day.lists[id]) continue;
      const a = st.agents[id],
        list = day.lists[id],
        entries = [],
        rest = [],
        t = { lo: 0, mid: 0, hi: 0 };
      let at = tileOf(st, id);
      for (let i = 0; i < list.length; i++) {
        VB.count.timetableEntry++;
        const key = list[i],
          j = st.jobs.get(key);
        if (!j) continue; // its task is gone
        const fit = day.fits ? day.fits[id][i] : null;
        if (fit !== null && fit < 0) {
          rest.push(key);
          continue;
        }
        const e = { key, kind: j.kind, label: KINDS[j.kind].label, site: j.site, done: shareDone(st, j), part: false };
        if (attentionOf(j) !== 'full') {
          Object.assign(e, { walk: 0, lo: 0, mid: 0, hi: 0, side: true, unseen: [] });
        } else {
          const hands = handsOf(day, key),
            r = Estimate.estimate(st, who, j, hands.length ? hands : [id]),
            given = day.hours ? day.hours[id][i] : 0;
          let f = 1;
          // a member given fewer hours than the task takes is given its part: the viewer's range at the head's share
          if (given > 0) {
            const h = who === head ? r : Estimate.estimate(st, head, j, hands.length ? hands : [id]);
            if (Number.isFinite(h.mid) && given < h.mid - 1e-9) f = given / h.mid;
          }
          Object.assign(e, {
            walk: walkHours(st, at, j.site),
            lo: r.lo * f,
            mid: r.mid * f,
            hi: r.hi * f,
            part: f < 1,
            side: false,
            unseen: r.unseen,
          });
          at = j.site;
        }
        e.start = { lo: t.lo + e.walk, mid: t.mid + e.walk, hi: t.hi + e.walk };
        t.lo = e.start.lo + e.lo;
        t.mid = e.start.mid + e.mid;
        t.hi = e.start.hi + e.hi;
        e.end = { lo: t.lo, mid: t.mid, hi: t.hi };
        entries.push(e);
      }
      members.push({
        id,
        now: a.job ? a.job.key : null,
        entries,
        rest,
        free: day.free && id in day.free ? day.free[id] : null,
      });
    }
    return { household: hh.id, viewer: who, made: day.made, edited: day.edited || null, members };
  }
  // What calling member id off costs, as pawn `viewer` reckons it (the household's head when null), named before the call (the verb
  // dayCall, sim/day): walk, the hours of its walk home from where it stands; load, what it carries home now and would put down where it
  // stands (0 when none); task, the key of its task in hand (or null) and left, the viewer's range of that task's hours left with its hands
  // ({lo, mid, hi}, or null).
  function callCost(st, id, viewer = null) {
    const p = st.pawns[id],
      a = st.agents[id],
      hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.farmstead === null) return null;
    const plan = planOf(st, 'household', hh.id),
      who = viewer === null || viewer === undefined ? (plan && plan.head ? plan.head.pawn : null) : viewer,
      house = st.farmsteads[hh.farmstead].house,
      j = a.job,
      left = j && attentionOf(j) === 'full' ? Estimate.estimate(st, who, j) : null;
    return {
      walk: a.inside ? 0 : walkHours(st, tileOf(st, id), house),
      load: a.load > 0 && a.phase === 'back' ? a.load : 0,
      task: j ? j.key : null,
      left: left && { lo: left.lo, mid: left.mid, hi: left.hi },
    };
  }
  return { timetable, callCost };
})();
