// @sys sim/days: the day's duty of the outer levies (VB-462, VB-1767; design.md, Outer levies, Worked): the compiled index of the pawns
// on a day named today, read by the check of every task (the basis `owed`) and by the modules below sim/levies, which seats it at the
// day's first step; each hour a pawn on duty works is booked here against its household's levy (kind `days` of sim/obligations).
VB['sim/days'] = (() => {
  const { DAY } = VB['sim/rules'];
  const Obligations = VB['sim/obligations'];
  // @tunable OUTER: an outer levy's day (VB-1767; design.md, Outer levies, The terms, the ladder and the breach): a day is `hours` work
  // hours of one adult, named at least `notice` days ahead; `worth` rations its worth (the worth table's day's work, every commuting
  // source's rate); `hunger`, `breach` and `lotMax` are the head's breach judgement's and the routine's lots' (VB-1768, VB-1769).
  const OUTER = { hours: 8, notice: 3, worth: 3, hunger: 2, breach: 2, lotMax: 3 };
  // The terms of an outer levy by its source (design.md's table): who names the day, the notice, whether another adult may be sent,
  // the rate it may be commuted at (null: not for sale), whether the days unworked at the window's end carry over, what a breach costs.
  const TERMS = {
    routine: {
      names: 'levied',
      notice: OUTER.notice,
      substitute: true,
      commute: null,
      carry: false,
      onBreach: 'memory',
    },
    keep: {
      names: 'levied',
      notice: OUTER.notice,
      substitute: true,
      commute: OUTER.worth,
      carry: false,
      onBreach: 'memory',
    },
    debt: {
      names: 'levied',
      notice: OUTER.notice,
      substitute: true,
      commute: OUTER.worth,
      carry: false,
      onBreach: 'memory',
    },
    patron: {
      names: 'levied',
      notice: OUTER.notice,
      substitute: true,
      commute: OUTER.worth,
      carry: false,
      onBreach: 'memory',
    },
    due: { names: 'levier', notice: OUTER.notice, substitute: false, commute: null, carry: true, onBreach: 'memory' },
  };
  // @state st.daysToday: {day, by: {pawn id: [obligation id, hours worked today, 1 once its day is given]}}: the pawns on duty today, the compiled
  //   index of a task's check (Rules for cost, 6); a cache rebuilt from the levies' days named at each day's first step (sim/levies step).
  //   Written only here.
  const today = (st) => Math.floor(st.t / DAY);
  // The household a pawn works for today, or null: one lookup, for the check of every task.
  function on(st, id) {
    const d = st.daysToday;
    if (!d || d.day !== today(st)) return null;
    const e = d.by[id];
    return e && e[1] < OUTER.hours - 1e-9 ? st.obligations[e[0]].creditor.id : null;
  }
  // The kind of the body pawn id works for today ('household' | 'village'), or null: Days.on's id is of that kind (VB-1768: a routine's
  // day is the village's).
  function kindOn(st, id) {
    const d = st.daysToday;
    if (!d || d.day !== today(st)) return null;
    const e = d.by[id];
    return e && e[1] < OUTER.hours - 1e-9 ? st.obligations[e[0]].creditor.kind : null;
  }
  // Pawn id's duty today is over before its hours (a routine's work done, its days released, VB-1768): nothing more is booked.
  function release(st, id) {
    const d = st.daysToday,
      e = d && d.day === today(st) ? d.by[id] : null;
    if (e) e[1] = OUTER.hours;
  }
  // Whether pawn id has booked its day's hours today: its day owed is given (sim/agents' hours a pawn may work now read it)
  function given(st, id) {
    const d = st.daysToday,
      e = d && d.day === today(st) ? d.by[id] : null;
    return !!e && e[1] >= OUTER.hours - 1e-9;
  }
  // Pawn id has worked dt hours on a task of its creditor's: booked against the days owed, at most OUTER.hours a day.
  function worked(st, id, dt) {
    const d = st.daysToday,
      e = d && d.by[id];
    if (!e) return;
    const n = Math.min(dt, OUTER.hours - e[1]);
    if (!(n > 0)) return;
    e[1] += n;
    const o = st.obligations[e[0]];
    if (Obligations.isLive(o))
      Obligations.fulfil(st, o.id, Math.min(n / OUTER.hours, Obligations.left(o)), 'days worked');
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
  return { OUTER, TERMS, on, kindOn, release, given, worked, begin, seat, markGiven };
})();
