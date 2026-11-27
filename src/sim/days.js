// @sys sim/days: days of work owed (VB-462; design.md, Loans, obligations and cases: Remedies; Households and other bodies: The alderman's keep):
// the creditor's holder calls a day on its planning day, for a day at least DAYS.notice ahead, from one adult of an owing household; the
// called adult takes tasks of the creditor's plan on the basis `owed` for DAYS.hours of work, walking there and home; each hour worked
// is booked against the obligation (kind `days` of sim/obligations). A debt, the alderman's keep and a patron's due are its sources.
VB['sim/days'] = (() => {
  const { DAY } = VB['sim/rules'];
  const Obligations = VB['sim/obligations'];
  // @tunable DAYS: a day of work owed, and the notice it is called with
  // Days owed (VB-462; design.md, Remedies, The alderman's keep): a day is `hours` of work of one adult, called for a day at least `notice`
  // days ahead by the creditor's holder, as tasks of its plan.
  const DAYS = { notice: 3, hours: 8 };
  // @state st.daysCalls: [[day (game day), pawn id, obligation id]], sorted by day, then pawn: the days called and not yet come, absent until
  //   the first call (a due-queue, Rules for cost, 4). Written only here.
  // @state st.daysToday: {day, by: {pawn id: [obligation id, hours worked today, 1 once its day is given]}}: the pawns on duty today, the compiled
  //   index of a task's check (Rules for cost, 6); a cache rebuilt from daysCalls at each day's first step. Written only here.
  const today = (st) => Math.floor(st.t / DAY);
  // The household a pawn works for today, or null: one lookup, for the check of every task.
  function on(st, id) {
    const d = st.daysToday;
    if (!d || d.day !== today(st)) return null;
    const e = d.by[id];
    return e && e[1] < DAYS.hours - 1e-9 ? st.obligations[e[0]].creditor.id : null;
  }
  // Whether pawn id has booked its day's hours today: its day owed is given (sim/agents' hours a pawn may work now read it)
  function given(st, id) {
    const d = st.daysToday,
      e = d && d.day === today(st) ? d.by[id] : null;
    return !!e && e[1] >= DAYS.hours - 1e-9;
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
  // The day's index begun for game day D, empty (sim/levies' step seats its pawns): the index itself.
  function begin(st, D) {
    st.daysToday = { day: D, by: {} };
    return st.daysToday;
  }
  // Pawn id is on duty today under obligation oid; its hours are given (sim/levies' step, once its load is in).
  function seat(st, id, oid) {
    st.daysToday.by[id] = [oid, 0, 0];
  }
  function markGiven(st, id) {
    st.daysToday.by[id][2] = 1;
  }
  return { DAYS, on, given, worked, begin, seat, markGiven };
})();
