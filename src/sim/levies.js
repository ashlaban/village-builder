// @sys sim/levies: the household's levy on its members (VB-1760; design.md section 7, The levy and own hours): the hours a day by season
// each member owes its household by custom (sim/customs LEVY) or contract, times its hands, compiled on the household's plan; and the
// levy left today, the head's day's capacity for a member (sim/day allot). Owns plan.levies; and
// the booking of a pawn's working hours into the six parts at each leg's end (VB-1761; Own hours, booked; Whose an hour is), the six
// days behind (agent.book) and the household's season's tally (plan.tally)
VB['sim/levies'] = (() => {
  const { cal, DAY, WORK, HEALTH, AGES, TICKS } = VB['sim/rules'],
    { CHILD, MATCH, workRate } = VB['sim/roles'];
  const { age, spouseOf, villageOf } = VB['sim/records'];
  const { levyNorm } = VB['sim/customs'];
  const { planOf } = VB['sim/plans'];
  const { workedToday } = VB['sim/work'];
  const { on } = VB['sim/events'];
  // @state plan.levies (a household's plan's; sim/plans holds the plan): absent until first read, then {at (the season compiled: year × 4
  //   + season), of: {pawn id: [hours (the row's hours a day, by the clock; null for one not levied: the head pair, a child under 7), hands
  //   (age and health, as compiled), role (the pawn's role then)]}}: each member's levy in force this season, compiled at the season's
  //   turn and when a member is new to it or its role has changed (membership; a grant, VB-1763), and read as one lookup. Plain data,
  //   saved with the plan; a member gone is passed over and dropped at the next season's compile. Written only here.
  const seasonKey = (c) => c.year * 4 + c.season;
  // The row of the custom's (or the contract's) table pawn p owes household hh by, or null when it is not levied: the head pair (the
  // household's plan is theirs), a child under 7 (not levied and not allotted). An elder under a retirement contract owes the contract's
  // row (none names hours); a servant the row of its contract (the adult row); a child of 7 to 13 the child row; any other member, whatever
  // its position, the adult row. A lodger (neither kin nor under contract) has no way in yet (VB-1803), so none is classed one.
  function rowOf(st, hh, p) {
    if (p.id === hh.holder || (hh.holder !== null && spouseOf(st, hh.holder) === p.id)) return null;
    const a = age(st, p);
    if (a < CHILD.from) return null;
    if (p.retired) return 'elder';
    if (a < AGES.hands[0]) return 'child';
    return p.servant ? 'servant' : 'adult';
  }
  // A pawn's hands: its rate by age (a child's, sim/roles workRate) by its health; hunger, which passes, is the rate's, not the levy's.
  const handsOf = (st, p) => workRate(p.role, age(st, p)) * (1 - (HEALTH.slow * (100 - p.health)) / 100);
  // Pawn p's levy entry as compiled now: [hours a day by the clock (null: not levied), hands, role].
  function compile(st, hh, p, season) {
    VB.count.levyCompile++;
    const row = rowOf(st, hh, p),
      at = villageOf(st, p);
    return [row === null ? null : levyNorm(st, row, season, at), handsOf(st, p), p.role];
  }
  // Pawn p's compiled entry for this season on household hh's plan, compiled where the season has turned, the pawn is new to it or its
  // role has changed; one lookup otherwise. Null where the household has no plan.
  function entry(st, hh, p, c = cal(st.t)) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan) return null;
    const key = seasonKey(c);
    let L = plan.levies;
    if (!L || L.at !== key) L = plan.levies = { at: key, of: {} };
    let e = L.of[p.id];
    if (!e || e[2] !== p.role) e = L.of[p.id] = compile(st, hh, p, c.season);
    return e;
  }
  // levyOf(st, pawn, day): the hours a day pawn `pawn` (an id) owes its household on game day `day` (default today), by its row times
  // its hands; null when it is not levied or in no household. The head's grant (VB-1763) and a contract's own hours come first when built.
  // This season's from the compiled entry; another season's worked out, not written.
  function levyOf(st, pawn, day = Math.floor(st.t / DAY)) {
    const p = st.pawns[pawn],
      hh = p && p.died === null && p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    const c = cal(day * DAY + WORK[0]),
      now = cal(st.t);
    const e = seasonKey(c) === seasonKey(now) ? entry(st, hh, p, now) : compileRead(st, hh, p, c.season);
    return !e || e[0] === null ? null : e[0] * e[1];
  }
  function compileRead(st, hh, p, season) {
    const row = rowOf(st, hh, p);
    return [row === null ? null : levyNorm(st, row, season, villageOf(st, p)), handsOf(st, p), p.role];
  }
  // Whether member p of household hh is levied this season (not the head pair, not a child under 7).
  function levied(st, hh, p) {
    const e = entry(st, hh, p);
    return !!e && e[0] !== null;
  }
  // The hours of an outer levy pawn id has worked today: a day owed (sim/days) or lent (sim/hands), by the clock.
  function owedToday(st, id, day) {
    const d = st.daysToday,
      e = d && d.day === day ? d.by[id] : null,
      h = st.handsToday,
      f = h && h.day === day ? h.by[id] : null;
    return (e ? e[1] : 0) + (f ? f[2] : 0);
  }
  // The head's day's capacity for member p of household hh at calendar c, in hours of its working day by the clock (sim/day allot): its
  // levy left today, the levy in force less the hours of the household's work and of outer levies it has done today, at most the
  // working day left; for the head pair, not levied, the working hours of the allotment's horizon as before (MATCH.day.horizon).
  // A clock hour of a member is its hands' worth of the levy, so the levy left in clock hours is the row's hours less the hours done.
  function capacity(st, hh, p, c) {
    const e = entry(st, hh, p, c);
    if (!e || e[0] === null) return MATCH.day.horizon * (WORK[1] - WORK[0]);
    const day = Math.floor(st.t / DAY),
      left = e[0] - workedToday(st, p.id, day) - owedToday(st, p.id, day),
      dayLeft = WORK[1] - Math.min(WORK[1], Math.max(WORK[0], c.hour));
    return Math.max(0, Math.min(left, dayLeft));
  }
  // ---- own hours, booked (VB-1761; design.md section 7, The levy and own hours: Own hours, booked; Whose an hour is; Sovereignty) ----
  // The six parts, in this order: owed (an outer levy, hands lent), levied (the household's work within the levy left), demanded (its
  // work past it, at the head's call), given (the same of the pawn's own accord, and the head pair's), kept (its own: a pastime, a visit,
  // rest, leave, a walk or a wait with no task, a task of its own such as its drink, any working hour in no leg) and taken (levy hours
  // kept by a breach: none until a member's take is built, VB-1762).
  const PARTS = ['owed', 'levied', 'demanded', 'given', 'kept', 'taken'];
  const BEHIND = 6; // the strip's six days behind (Sim.hours)
  const TD = DAY * TICKS;
  // @state agent.book (VB-1761): absent until the pawn's first leg ends, then {day (the game day booked), at (the tick booked to), hands
  //   (its hands at the day's first booking: the day's H is 12 times them), levy (its levy that day in hours times hands; null for the head
  //   pair, who are not levied, and one in no household), p: [owed, levied, demanded, given, kept, taken] (hours times hands so far
  //   today), past: up to six [day, hands, levy, ...the six parts] of the days before, the latest first}. Everything from `at` on is
  //   unbooked; each working hour (06:00 to 18:00) of a day is booked once, at a leg's end, so a day closed sums to 12 times its hands;
  //   the night is unbooked. Of the parts nothing older than the six days behind is kept: they are what Sim.hours shows of the past (the
  //   strip's days behind), and the season's count is the tally's. Written only here; plain data, saved.
  // @state plan.tally (VB-1761; a household's plan's): absent until a member's first hour demanded or given, then {at (the season: year
  //   × 4 + season), of: {pawn id: [demanded, taken, given]} (this season's, hours times hands), year: {at (the year of the seasons
  //   folded), of: {pawn id: [demanded, taken, given]}}}: the season's tally by member (the head pair have none), folded into the year's
  //   count by the first booking of a later season (a later year's begins the count afresh). Written only here; plain data, saved.
  const isHead = (st, hh, p) => p.id === hh.holder || (hh.holder !== null && spouseOf(st, hh.holder) === p.id);
  // Pawn p's levy on game day `day`, in hours times hands, never written: this season's compiled entry where there is one, else worked
  // out (so the booking compiles nothing the allotment would compile later, with other hands); null for the head pair or one in no
  // household, 0 for one not levied (a child under 7).
  function levyOn(st, p, day) {
    const hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || isHead(st, hh, p)) return null;
    const c = cal(day * DAY + WORK[0]),
      plan = planOf(st, 'household', hh.id),
      L = plan && plan.levies,
      f = L && L.at === seasonKey(c) ? L.of[p.id] : null,
      e = f && f[2] === p.role ? f : compileRead(st, hh, p, c.season);
    return e[0] === null ? 0 : e[0] * e[1];
  }
  const handsNow = (st, p) => Math.max(0, handsOf(st, p));
  // The day `day`'s record begins: the one before goes into the days behind (the oldest's array reused).
  function roll(st, p, r, day) {
    if (r.day !== null) {
      const old = r.past.length >= BEHIND ? r.past.pop() : [];
      old.length = 0;
      old.push(r.day, r.hands, r.levy, ...r.p);
      r.past.unshift(old);
    }
    r.day = day;
    r.hands = handsNow(st, p);
    r.levy = levyOn(st, p, day);
    r.p = [0, 0, 0, 0, 0, 0];
  }
  // The season's tally of household hh: member p's `k` (0 demanded, 1 taken, 2 given) grows by h, on game day `day`.
  function tally(st, hh, p, k, h, day) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan) return;
    const key = seasonKey(cal(day * DAY + WORK[0]));
    let T = plan.tally;
    if (!T) T = plan.tally = { at: key, of: {}, year: { at: Math.floor(key / 4), of: {} } };
    if (T.at < key) fold(T, key);
    const e = T.of[p.id] || (T.of[p.id] = [0, 0, 0]);
    e[k] += h;
  }
  // The season's tally folded into the year's count, and the season `key` begun.
  function fold(T, key) {
    const y = Math.floor(T.at / 4);
    if (T.year.at !== y) T.year = { at: y, of: {} };
    for (const [id, e] of Object.entries(T.of)) {
      const sum = T.year.of[id] || (T.year.of[id] = [0, 0, 0]);
      for (let i = 0; i < 3; i++) sum[i] += e[i];
    }
    T.at = key;
    T.of = {};
  }
  // h hours times hands of a leg opened by `by` ('owed', 'head', 'pawn', or none: the pawn's own) booked into record r of pawn p: up to
  // the levy left today (the levy less the hours booked owed and levied) owed or levied, the rest demanded (owed or the head's) or given
  // (the pawn's); the head pair's household work given, their outer days owed; one in no household keeps its hours. Two parts at most.
  function put(st, p, r, h, by, tallied) {
    const P = r.p,
      hh = p.household === null ? null : st.households[p.household];
    if (!by || !hh || hh.dissolved) {
      P[4] += h;
      return;
    }
    if (r.levy === null) {
      P[by === 'owed' ? 0 : 3] += h;
      return;
    }
    const left = Math.max(0, r.levy - P[0] - P[1]),
      within = Math.min(h, left),
      past = h - within;
    P[by === 'owed' ? 0 : 1] += within;
    if (past <= 0) return;
    const k = by === 'pawn' ? 3 : 2;
    P[k] += past;
    if (tallied) tally(st, hh, p, k === 2 ? 0 : 2, past, r.day);
  }
  // The ticks [from, to) booked to `by` in record r: each day's working hours in it, a day's record begun as the span passes into it.
  function span(st, p, r, from, to, by, tallied = true) {
    while (from < to) {
      const d = Math.floor(from / TD);
      if (r.day === null || d > r.day) roll(st, p, r, d);
      const e = Math.min(to, (d + 1) * TD),
        lo = Math.max(from, d * TD + WORK[0] * TICKS),
        hi = Math.min(e, d * TD + WORK[1] * TICKS);
      if (hi > lo) put(st, p, r, ((hi - lo) / TICKS) * r.hands, by, tallied);
      from = e;
    }
    r.at = Math.max(r.at, to);
  }
  // A leg of pawn a has ended (sim/legs emits 'legOver' with a.leg the leg): the hours from the last booking to the leg's start are the
  // pawn's own (in no leg), the leg's own by who opened it (leg.by), up to now. One booking a leg's end (hoursBook).
  function book(st, a) {
    const l = a.leg,
      p = st.pawns[a.id];
    if (!l || !p || !p.alive) return;
    VB.count.hoursBook++;
    let r = a.book;
    if (!r) {
      const d = Math.floor(Math.min(l.t, st.tick) / TD);
      r = a.book = { day: null, at: d * TD, hands: 0, levy: null, p: null, past: [] };
    }
    const from = Math.min(Math.max(r.at, l.t), st.tick);
    if (from > r.at) span(st, p, r, r.at, from, undefined);
    span(st, p, r, from, st.tick, l.by);
  }
  on('legOver', book);
  // A day's six parts as Sim.hours shows them, and its sovereignty: by right 1 less the levy over H, as lived the hours demanded, given
  // and kept over H, beside those taken (Sovereignty). A measure read, never a switch: no rule reads it.
  function dayOf(day, hands, levy, P, state) {
    const H = 12 * hands,
      o = {
        day,
        state,
        H,
        levy: levy === null ? 0 : levy,
        right: H > 0 ? Math.min(1, Math.max(0, 1 - (levy || 0) / H)) : 1,
      };
    if (P) {
      PARTS.forEach((k, i) => (o[k] = P[i]));
      o.lived = H > 0 ? (P[2] + P[3] + P[4]) / H : 1;
    }
    return o;
  }
  // hours(st, pawn, from, until): pawn `pawn`'s days from game day `from` to `until`, each {day, state ('past': exact; 'today': booked so
  // far; 'ahead': only the levy in force), H, levy, right, and for a past day or today the six parts and lived}; a past day older than the
  // six behind is left out. Read only: a day not yet closed (no leg has ended since) is closed in a copy, its hours in no leg kept.
  function hours(st, pawn, from, until) {
    const p = st.pawns[pawn],
      a = st.agents[pawn],
      today = Math.floor(st.t / DAY),
      out = [];
    if (!p) return out;
    const b = a && a.book,
      r = b
        ? {
            day: b.day,
            at: b.at,
            hands: b.hands,
            levy: b.levy,
            p: b.p && b.p.slice(),
            past: b.past.map((e) => e.slice()),
          }
        : null;
    if (r && p.alive && r.day !== null && r.day < today)
      span(st, p, r, r.at, (today * DAY + WORK[0]) * TICKS, undefined, false);
    const held = new Map();
    if (r && r.day !== null) {
      for (const e of r.past) held.set(e[0], dayOf(e[0], e[1], e[2], e.slice(3), 'past'));
      held.set(r.day, dayOf(r.day, r.hands, r.levy, r.p, r.day < today ? 'past' : 'today'));
    }
    for (let d = from; d <= until; d++) {
      if (held.has(d)) out.push(held.get(d));
      else if (d >= today && p.alive)
        out.push(dayOf(d, handsNow(st, p), levyOn(st, p, d), null, d === today ? 'today' : 'ahead'));
    }
    return out;
  }
  // The season's tally of household hh by member, and the year's count: {season, of, year, yearOf}, read only; this season's empty where
  // nothing has been booked in it yet (a tally of an earlier season, not yet folded, is counted in the year's).
  function tallyOf(st, hh, c = cal(st.t)) {
    const plan = planOf(st, 'household', hh.id),
      T = plan && plan.tally,
      key = seasonKey(c);
    if (!T) return { season: key, of: {}, year: c.year, yearOf: {} };
    if (T.at >= key) return { season: key, of: T.of, year: T.year.at, yearOf: T.year.of };
    const U = { at: T.at, of: T.of, year: { at: T.year.at, of: copyOf(T.year.of) } };
    fold(U, key);
    return { season: key, of: U.of, year: U.year.at, yearOf: U.year.of };
  }
  const copyOf = (o) => Object.fromEntries(Object.entries(o).map(([k, e]) => [k, e.slice()]));
  return { rowOf, levyOf, levied, capacity, owedToday, PARTS, hours, tallyOf };
})();
