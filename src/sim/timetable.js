// @sys sim/timetable: the timetable (VB-477; design.md section 7, The timetable): a household's day as a view, worked out when asked and
//   never in a step: each member's list laid end to end with its walks, each task a range by the estimate of the pawn who looks (the one the
//   player inhabits: flaws and all); progress so far is exact. With it the cost of calling a member off, named before the call, and the
//   stops of a run until the inhabited pawn's task ends. Writes nothing
// Principle (AGENTS.md, Deciding without Kim, 14): what is shown of the future is some pawn's estimate (sim/estimate).
VB['sim/timetable'] = (() => {
  const { SPEED } = VB['sim/rules'];
  const { findRoute, routeCost } = VB['sim/routes'];
  const { placeOf, tileAt } = VB['sim/pose'];
  const { KINDS } = VB['sim/kinds'];
  const { attentionOf, doneOf } = VB['sim/work'];
  const { planOf } = VB['sim/plans'];
  const Estimate = VB['sim/estimate'];
  const { cal } = VB['sim/rules'];
  const { winterNeed } = VB['sim/herds'];
  const { fullName } = VB['sim/records'];
  // The walking hours between two tiles by the route a pawn would take; every judgement reckons with the walk.
  // A view writes nothing (VB-477 review, F1): a route the cache holds, either way, is read; else one is searched and not kept, so that
  // looking at the page never changes the saved cache, nor what its bound would evict. None found: the walk's own fallback.
  function walkHours(st, from, to) {
    if (from === to || from < 0 || to < 0) return 0;
    const N = st.w.N,
      back = st.pathCache.get(to * N + from),
      p = st.pathCache.get(from * N + to) ||
        (back && back[0] === to ? back.slice().reverse() : null) ||
        findRoute(st.w, from, to) || [to]; // none found: as the walk's own fallback
    return routeCost(st.w, p) / SPEED;
  }
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
  // Pawn id's task in hand as pawn `viewer` reckons it (the pawn itself when null): {key, label, done (the share done, exact), left
  // ({lo, mid, hi}, the hours its work left takes, or null for a task held beside its work)}, or null with none. For the pawn's card.
  function taskLeft(st, id, viewer = null) {
    const j = st.agents[id].job;
    if (!j) return null;
    const who = viewer === null || viewer === undefined ? id : viewer,
      r = attentionOf(j) === 'full' ? Estimate.estimate(st, who, j) : null;
    return {
      key: j.key,
      label: KINDS[j.kind].label,
      done: shareDone(st, j),
      left: r && Number.isFinite(r.mid) ? { lo: r.lo, mid: r.mid, hi: r.hi } : null,
    };
  }
  // ---- until my task ends (Kim, 15 Nov; VB-477): the stops of a run ahead that the page's skip adds to its own (sim/notable skipStop,
  // which already stops at a death, a wedding or funeral ale, the first help received, an offer waiting for the pawn) when the player asks
  // to run until the inhabited pawn's task ends. Not a verb: the cursor is the page's plain data, and nothing here writes to st, so the
  // run is the same with or without it. ----
  // A leg as the cursor keeps it: its kind and the step it began (a walk or work; a wait is no leg of a task), or null.
  const legOf = (a) => (a.leg && a.leg.kind !== 'wait' ? { kind: a.leg.kind, t: a.leg.t } : null);
  // Is household hh above its targets of hay (winters of the herds' need) and firewood (this season's loads): [hay, wood], or null.
  function aboveTargets(st, hh) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan || !plan.targets) return null;
    const need = winterNeed(st, hh),
      wood = plan.targets.wood ? plan.targets.wood[cal(st.t).season] : null;
    return [need > 0 ? hh.hay / need >= plan.targets.hayWinters : null, wood === null ? null : hh.wood >= wood];
  }
  // Where a run until the inhabited pawn's task ends begins: {pawn, key (its task in hand, or null: the next it takes is adopted), leg,
  // hid, edited (the hour of the head's last change of the day), offer (the next offer's id), above (aboveTargets)}; null when no pawn is
  // played or it is dead.
  function taskFrom(st) {
    const pl = st.player;
    if (!pl || st.pawns[pl.pawn].died !== null) return null;
    const a = st.agents[pl.pawn],
      hid = st.pawns[pl.pawn].household,
      hh = hid === null ? null : st.households[hid],
      plan = hh ? planOf(st, 'household', hid) : null;
    return {
      pawn: pl.pawn,
      key: a.job ? a.job.key : null,
      leg: legOf(a),
      hid,
      edited: plan && plan.day && plan.day.edited ? plan.day.edited.t : null,
      offer: st.offerSeq,
      above: hh ? aboveTargets(st, hh) : null,
    };
  }
  // Has a run begun at `from` (taskFrom) reached a stop of its own: null, or {why, text}. Asked after each step; it moves the cursor on
  // (the task and leg adopted, the offers looked at) and writes nothing to st. The stops: the pawn's task ended or cut; the walk or work it
  // was in ended or cut; another changed its household's day (a call); a request for help made or asked of its household; one of the
  // household's stores crossing its target.
  function taskStop(st, from) {
    const pl = st.player;
    if (!pl || pl.pawn !== from.pawn || st.pawns[from.pawn].died !== null)
      return { why: 'none', text: 'The pawn you played is gone.' };
    const p = st.pawns[from.pawn],
      a = st.agents[from.pawn],
      key = a.job ? a.job.key : null,
      leg = legOf(a),
      name = fullName(p);
    if (from.key !== null && key !== from.key)
      return { why: 'task', text: key === null ? `${name}'s task has ended.` : `${name} has turned to another task.` };
    if (from.leg && (!leg || leg.kind !== from.leg.kind || leg.t !== from.leg.t))
      return {
        why: 'leg',
        text: from.leg.kind === 'walk' ? `${name} has come to the end of its walk.` : `${name} has stopped working.`,
      };
    from.key = key; // a task, or a leg, taken since: the next stop is its end
    from.leg = leg;
    const hid = p.household,
      hh = hid === null ? null : st.households[hid];
    if (hid !== from.hid) {
      from.hid = hid;
      from.above = hh ? aboveTargets(st, hh) : null;
      return { why: 'household', text: `${name} has a new household.` };
    }
    if (!hh) return null;
    const plan = planOf(st, 'household', hid),
      ed = plan && plan.day && plan.day.edited ? plan.day.edited : null;
    if (ed && ed.t !== from.edited) {
      from.edited = ed.t;
      if (ed.by !== from.pawn)
        return { why: 'day', text: 'The head has changed the household’s day: a call, or a task given.' };
    }
    for (const o of st.offers) {
      if (!(o.id >= from.offer)) continue;
      from.offer = o.id + 1;
      const ours = (r) => Number.isInteger(r) && hh.members.includes(r);
      if (o.basis === 'ask' && (ours(o.from) || ours(o.to)))
        return {
          why: 'help',
          text: ours(o.from)
            ? `${fullName(st.pawns[o.from])} has asked for help.`
            : `${fullName(st.pawns[o.to])} is asked for help.`,
        };
    }
    const now = aboveTargets(st, hh),
      was = from.above;
    from.above = now;
    if (now && was)
      for (let i = 0; i < 2; i++)
        if (now[i] !== null && was[i] !== null && now[i] !== was[i])
          return {
            why: 'store',
            text: `The ${i ? 'firewood' : 'hay'} is now ${now[i] ? 'above' : 'below'} the household’s target.`,
          };
    return null;
  }
  return { timetable, callCost, taskLeft, taskFrom, taskStop };
})();
