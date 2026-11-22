// @sys sim/days: days of work owed (VB-462; design.md, Loans, obligations and cases: Remedies; Households and other bodies: The alderman's keep):
// the creditor's holder calls a day on its planning day, for a day at least DAYS.notice ahead, from one adult of an owing household; the
// called adult takes tasks of the creditor's plan on the basis `owed` for DAYS.hours of work, walking there and home; each hour worked
// is booked against the obligation (kind `days` of sim/obligations). A debt, the alderman's keep and a patron's due are its sources.
VB['sim/days'] = (() => {
  const { DAY, MATCH } = VB['sim/rules'];
  const Obligations = VB['sim/obligations'];
  const Stores = VB['sim/stores'];
  const { floorOf } = VB['sim/hunger'];
  const { age } = VB['sim/records'];
  const { KINDS, isOpen } = VB['sim/kinds'];
  const { on: onEvent } = VB['sim/events'];
  const { register, issue } = VB['sim/commands'];
  // @tunable DAYS: a day of work owed, and the notice it is called with
  // Days owed (VB-462; design.md, Remedies, The alderman's keep): a day is `hours` of work of one adult, called for a day at least `notice`
  // days ahead by the creditor's holder, as tasks of its plan.
  const DAYS = { notice: 3, hours: 8 };
  // @state st.daysCalls: [[day (game day), pawn id, obligation id]], sorted by day, then pawn: the days called and not yet come, absent until
  //   the first call (a due-queue, Rules for cost, 4). Written only here.
  // @state st.daysToday: {day, by: {pawn id: [obligation id, hours worked today, 1 once sent home]}}: the pawns on duty today, the compiled
  //   index of a task's check (Rules for cost, 6); a cache rebuilt from daysCalls at each day's first step. Written only here.
  const today = (st) => Math.floor(st.t / DAY);
  // The household a pawn works for today, or null: one lookup, for the check of every task.
  function on(st, id) {
    const d = st.daysToday;
    if (!d || d.day !== today(st)) return null;
    const e = d.by[id];
    return e && e[1] < DAYS.hours - 1e-9 ? st.obligations[e[0]].creditor.id : null;
  }
  const farmOf = (st, hh) => (hh.farmstead === null ? null : st.farmsteads[hh.farmstead]);
  // The hours of work the household has open now: its tasks with room, what is left of each.
  function openHours(st, hh) {
    let n = 0;
    for (const j of st.jobsBy.get(`household:${hh.id}`) || []) {
      if (!isOpen(st, j)) continue;
      n += Math.max(0, (j.hours ?? KINDS[j.kind].hours ?? 0) - (j.done || 0));
    }
    return n;
  }
  // Why household hh sends no hand, or null: below its floor, or its own harvest waiting (the day stays owed).
  function sendsNone(st, hh) {
    if (Stores.grainOf(hh) - floorOf(st, hh) < 0) return 'its household is below its floor';
    for (const j of st.jobsBy.get(`household:${hh.id}`) || [])
      if (KINDS[j.kind].type === 'harvest' && isOpen(st, j)) return 'its household has its own harvest waiting';
    return null;
  }
  const inQueue = (st, day, hid) => (st.daysCalls || []).some(([d, p]) => d === day && st.pawns[p].household === hid);
  // The adult of the debtor household called for `day`: the pawn asked for, or the first fit; {pawn} or {why}.
  function pick(st, o, day, asked) {
    const hh = st.households[o.debtor.id];
    if (hh.dissolved) return { why: 'the household owing is gone' };
    const why = sendsNone(st, hh);
    if (why) return { why };
    if (inQueue(st, day, hh.id)) return { why: 'an adult of that household is called for that day already' };
    const ids = asked !== undefined && asked !== null ? [asked] : hh.members;
    for (const id of ids) {
      const p = st.pawns[id];
      if (p && p.alive && p.household === hh.id && !p.retired && age(st, p) >= MATCH.help.minAge) return { pawn: id };
    }
    return { why: 'no adult of that household can come' };
  }
  // Why the holder `actor` cannot call a day of obligation id for `day`, or null.
  function callWhy(st, actor, id, day, asked) {
    const o = st.obligations && st.obligations[id];
    if (!o || o.kind !== 'days' || !Obligations.isLive(o)) return `there are no days owed under ${id}`;
    const p = st.pawns[actor],
      hh = p && p.alive && p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.holder !== actor || o.creditor.id !== hh.id)
      return 'only the holder of the household owed calls its days';
    if (Obligations.left(o) - o.called < 1e-9) return 'every day owed is called already';
    if (day < today(st) + DAYS.notice) return `a day is called at least ${DAYS.notice} days ahead`;
    const a = farmOf(st, hh),
      b = farmOf(st, st.households[o.debtor.id]);
    if (!a || !b || a.village !== b.village) return 'the household owing is not of its village';
    const pending = Obligations.due(st, o.creditor, 'creditor', 'days').reduce((s, x) => s + x.called, 0);
    if (openHours(st, hh) < (pending + 1) * DAYS.hours) return 'there is no work for another hand';
    return pick(st, o, day, asked).why || null;
  }
  const dayOf = (st, c) => (c.args && c.args.day !== undefined ? c.args.day : today(st) + DAYS.notice);
  // callDays: the holder calls a day of the days owed it (target: the obligation), for args.day (default: DAYS.notice ahead), from args.pawn
  register('callDays', {
    check: (st, c) => callWhy(st, c.actor, c.target, dayOf(st, c), c.args && c.args.pawn),
    run: (st, c) => {
      const day = dayOf(st, c),
        o = st.obligations[c.target],
        { pawn } = pick(st, o, day, c.args && c.args.pawn);
      const q = st.daysCalls || (st.daysCalls = []);
      let at = q.length;
      while (at > 0 && (q[at - 1][0] > day || (q[at - 1][0] === day && q[at - 1][1] > pawn))) at--;
      q.splice(at, 0, [day, pawn, o.id]);
      Obligations.setCalled(st, o.id, 1);
      VB.count.daysCalled++;
    },
  });
  // On a household's planning day its holder calls a day from each household that owes it days (the planner's own use of the verb).
  onEvent('planReviewed', (st, d) => {
    const hold = d.plan.holder;
    if (d.why !== 'day' || hold.type !== 'household' || !st.obligationsBy) return;
    const hh = st.households[hold.id];
    if (hh.dissolved || hh.holder === null) return;
    for (const o of Obligations.due(st, { kind: 'household', id: hh.id }, 'creditor', 'days'))
      issue(st, { actor: hh.holder, verb: 'callDays', target: o.id, args: {}, source: 'planner' });
  });
  // A day's first step: yesterday's calls are over (what was not worked stays owed); today's come on duty, unless their household sends
  // none. Then those who have given their hours go home.
  function step(st) {
    const D = today(st);
    let d = st.daysToday;
    if (!d || d.day !== D) {
      if (d) for (const e of Object.values(d.by)) Obligations.setCalled(st, e[0], -1);
      d = st.daysToday = { day: D, by: {} };
      const q = st.daysCalls || [];
      while (q.length && q[0][0] <= D) {
        const [day, pawn, oid] = q.shift(),
          o = st.obligations[oid];
        if (!Obligations.isLive(o)) continue;
        const p = st.pawns[pawn];
        if (
          day < D ||
          d.by[pawn] ||
          !p.alive ||
          p.household !== o.debtor.id ||
          sendsNone(st, st.households[p.household])
        )
          Obligations.setCalled(st, oid, -1);
        else d.by[pawn] = [oid, 0, 0];
      }
    }
    for (const [id, e] of Object.entries(d.by))
      if (e[1] >= DAYS.hours - 1e-9 && !e[2]) {
        e[2] = 1;
        issue(st, { actor: +id, verb: 'goHome', source: 'planner' });
      }
  }
  // Pawn id has worked dt hours on a task of its creditor's: booked against the days owed, at most DAYS.hours a day.
  function worked(st, id, dt) {
    const d = st.daysToday,
      e = d && d.by[id];
    if (!e) return;
    const n = Math.min(dt, DAYS.hours - e[1]);
    if (!(n > 0)) return;
    e[1] += n;
    const o = st.obligations[e[0]];
    if (Obligations.isLive(o))
      Obligations.fulfil(st, o.id, Math.min(n / DAYS.hours, Obligations.left(o)), 'days worked');
  }
  return { DAYS, on, worked, step };
})();
