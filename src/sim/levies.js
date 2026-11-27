// @sys sim/levies: the household's levy on its members (VB-1760; design.md section 7, The levy and own hours): the hours a day by season
// each member owes its household by custom (sim/customs LEVY) or contract, times its hands, compiled on the household's plan; and the
// levy left today, the head's day's capacity for a member (sim/day allot). Owns plan.levies; and
// the booking of a pawn's working hours into the six parts at each leg's end (VB-1761; Own hours, booked; Whose an hour is), the six
// days behind (agent.book) and the household's season's tally (plan.tally)
VB['sim/levies'] = (() => {
  const { cal, DAY, WORK, AGES, TICKS } = VB['sim/rules'],
    { CHILD, MATCH } = VB['sim/roles'];
  const { age, spouseOf, villageOf } = VB['sim/records'];
  const { levyNorm } = VB['sim/customs'];
  const { planOf } = VB['sim/plans'];
  const { workedToday } = VB['sim/work'];
  const { on, emit } = VB['sim/events'];
  const { SEASON_DAYS, YEAR_DAYS, GOODWILL } = VB['sim/rules'];
  const { CROPS } = VB['sim/crops'];
  const { of: traitOf } = VB['sim/traits'];
  const { opinionOf, balance, book: bookGoodwill } = VB['sim/relations'];
  const { KINDS } = VB['sim/kinds'];
  const { windowEnd } = VB['sim/hands'];
  const { VOICE } = VB['sim/grants'];
  const { ASK } = VB['sim/rules'],
    { MADE } = VB['sim/targets'];
  const Obligations = VB['sim/obligations'],
    Days = VB['sim/days'];
  const Stores = VB['sim/stores'];
  const { floorOf } = VB['sim/hunger'];
  const { isOpen } = VB['sim/kinds'];
  const { register, issue } = VB['sim/commands'];
  const { workOfTarget, fieldYield } = VB['sim/estimate'];
  const { fullName, log, atFarm, unplanned } = VB['sim/records'];
  const Norms = VB['sim/norms'],
    { goodOf } = VB['sim/goods'];
  const { grantsOf, inForce, seasonKey, handsOf } = VB['sim/grants'];
  // @state plan.levies (a household's plan's; sim/plans holds the plan): absent until first read, then {at (the season compiled: year × 4
  //   + season), of: {pawn id: [hours (the row's hours a day, by the clock; null for one not levied: the head pair, a child under 7), hands
  //   (age and health, as compiled), role (the pawn's role then)]}}: each member's levy in force this season, compiled at the season's
  //   turn and when a member is new to it or its role has changed (membership; a grant, VB-1763), and read as one lookup. Plain data,
  //   saved with the plan; a member gone is passed over and dropped at the next season's compile. Written only here.
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
  // levyOf(st, pawn, day): the hours a day pawn `pawn` (an id) owes its household on game day `day` (default today), its levy in force
  // (its row less its head's grants) times its hands; null when it is not levied or in no household. This season's from the compiled
  // entry; another season's worked out, not written.
  function levyOf(st, pawn, day = Math.floor(st.t / DAY)) {
    const p = st.pawns[pawn],
      hh = p && p.died === null && p.household !== null ? st.households[p.household] : null;
    if (!hh || hh.dissolved) return null;
    const c = cal(day * DAY + WORK[0]),
      now = cal(st.t);
    const e = seasonKey(c) === seasonKey(now) ? entry(st, hh, p, now) : compileRead(st, hh, p, c.season);
    return !e || e[0] === null ? null : inForce(grantsOf(st, hh), p.id, day, e[0]) * e[1];
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
  // The hours of its levy pawn id has taken today (a breach, VB-1779), by the clock: its booking's, the hours times hands over its hands.
  function takenToday(st, id, day) {
    const a = st.agents[id],
      r = a && a.book;
    return r && r.day === day && r.hands > 0 ? r.p[5] / r.hands : 0;
  }
  // The head's day's capacity for member p of household hh at calendar c, in hours of its working day by the clock (sim/day allot): its
  // levy left today, the levy in force less the hours of the household's work and of outer levies it has done today and those it has
  // taken (VB-1779), at most the
  // working day left; for the head pair, not levied, the working hours of the allotment's horizon as before (MATCH.day.horizon).
  // A clock hour of a member is its hands' worth of the levy, so the levy left in clock hours is the row's hours less the hours done.
  function capacity(st, hh, p, c) {
    const e = entry(st, hh, p, c);
    if (!e || e[0] === null) return MATCH.day.horizon * (WORK[1] - WORK[0]);
    const day = Math.floor(st.t / DAY),
      left =
        inForce(grantsOf(st, hh), p.id, day, e[0]) -
        workedToday(st, p.id, day) -
        owedToday(st, p.id, day) -
        takenToday(st, p.id, day),
      dayLeft = WORK[1] - Math.min(WORK[1], Math.max(WORK[0], c.hour));
    return Math.max(0, Math.min(left, dayLeft));
  }
  // ---- the member's judgement and the head's demand (VB-1779; design.md section 7, The levy and own hours: The member's judgement, The
  // head's demand, Demand and take, What a breach costs) ----
  // @tunable GIVE: the member's judgement J = base + diligence × (2d − 1) + need × n + opinion × o + goodwill × g − want × w (The member's
  // judgement); open: n for a task merely open; court: w while it courts; press: a demand is complied with when J + press > 0; hold: a
  // levied leg's hours are taken when J < −hold. Starting values, Proposed (VB-1759).
  const GIVE = {
    base: 0,
    diligence: 0.6,
    need: 0.6,
    opinion: 0.3,
    goodwill: 0.3,
    want: 0.6,
    open: 0.3,
    court: 0.8,
    press: 0.4,
    hold: 0.8,
  };
  // @tunable DEMAND: weight, the head demands h hours when the work at risk R > weight × h × V + G (The head's demand): the goodwill booked
  // and as much again for the giving it will lose.
  const DEMAND = { weight: 2 };
  const unit = (x) => Math.max(-1, Math.min(1, x));
  const DAYWORK = GOODWILL.hour * 8; // a day's work in rations (the worth table's: 3)
  // The need member p of household hh sees in task j (n): 1 when j has a deadline today (`late`) or a window closing within
  // VOICE.closing days, or a member of its household went hungry yesterday; GIVE.open when j is merely open; 0 for no task.
  function needOf(st, hh, j, c = cal(st.t)) {
    if (!j) return 0;
    if (KINDS[j.kind].late) return 1;
    const end = windowEnd(st, j, c);
    if (end !== null && end - (c.season * SEASON_DAYS + c.sday) < VOICE.closing) return 1;
    for (const id of hh.members) {
      const q = st.pawns[id],
        log = q.died === null && q.hungerLog;
      if (log && log.length && log[log.length - 1] > 0.01) return 1;
    }
    return GIVE.open;
  }
  // What member p wants its hours for (w), the strongest of: rest, the hours it has worked today over its working day's 12; a visit owed,
  // the days since it sat with near kin or a close friend (pawn.sat) over VOICE.days, at most 1; courting, GIVE.court; an aim's step, 0
  // until built.
  function wantOf(st, p) {
    const day = Math.floor(st.t / DAY),
      rest = (workedToday(st, p.id, day) + owedToday(st, p.id, day)) / (WORK[1] - WORK[0]),
      visit = Number.isInteger(p.sat) ? Math.min(1, (day - p.sat) / VOICE.days) : 0;
    return Math.max(rest, visit, Number.isInteger(p.courting) ? GIVE.court : 0);
  }
  // judgement(st, hh, p, n): member p's judgement J of household hh's head, by what it knows now, for a task of need n (needOf); null for
  // one with no head to judge. No draw.
  function judgement(st, hh, p, n) {
    const h = hh.holder;
    if (h === null || h === p.id || !st.pawns[h] || st.pawns[h].died !== null) return null;
    VB.count.giveJudged++;
    return (
      GIVE.base +
      GIVE.diligence * (2 * traitOf(st, p.id, 'diligence') - 1) +
      GIVE.need * n +
      GIVE.opinion * unit(opinionOf(st, p.id, h)) +
      GIVE.goodwill * unit(balance(st, h, p.id) / DAYWORK) -
      GIVE.want * wantOf(st, p)
    );
  }
  // Does member p give one leg of task j, the first of its list past the levy with room, of its own hours (J > 0: What own hours are for;
  // VB-1762): read when it comes to its own hours, and again at each given leg's end; `view` (sim/fit explainIdle) reads it and counts no
  // leg. One with no head to judge gives nothing.
  function gives(st, hh, p, j, view = false) {
    if (!((judgement(st, hh, p, needOf(st, hh, j)) ?? 0) > 0)) return false;
    if (!view) {
      VB.count.giveLeg++;
    }
    return true;
  }
  // Does member p comply with a demand of task j (J + GIVE.press > 0); and would it take a levied leg of task j (J < −GIVE.hold).
  const complies = (st, hh, p, j) => (judgement(st, hh, p, needOf(st, hh, j)) ?? 0) + GIVE.press > 0;
  const takes = (st, hh, p, j) => (judgement(st, hh, p, needOf(st, hh, j)) ?? 0) < -GIVE.hold;
  // Whether the head of household hh demands h hours of member p for work at risk worth R rations (The head's demand): R > weight × h ×
  // V + G, V an hour's worth (GOODWILL.hour), G the goodwill it already owes the member, in rations.
  const demands = (st, hh, p, h, R) =>
    R > DEMAND.weight * h * GOODWILL.hour + (hh.holder === null ? 0 : balance(st, p.id, hh.holder));
  // ---- own hours, booked (VB-1761; design.md section 7, The levy and own hours: Own hours, booked; Whose an hour is; Sovereignty) ----
  // The six parts, in this order: owed (an outer levy, hands lent), levied (the household's work within the levy left), demanded (its
  // work past it, at the head's call), given (the same of the pawn's own accord, and the head pair's), kept (its own: a pastime, a visit,
  // rest, leave, a walk or a wait with no task, a task of its own such as its drink, any working hour in no leg) and taken (levy hours
  // kept by a breach, VB-1779).
  const PARTS = ['owed', 'levied', 'demanded', 'given', 'kept', 'taken'];
  const BEHIND = 6; // the strip's six days behind (Sim.hours)
  const TD = DAY * TICKS;
  // @state agent.book (VB-1761): absent until the pawn's first leg ends, then {day (the game day booked), at (the tick booked to), hands
  //   (its hands at the day's first booking: the day's H is 12 times them), levy (its levy that day in hours times hands; null for the head
  //   pair, who are not levied, and one in no household), p: [owed, levied, demanded, given, kept, taken] (hours times hands so far
  //   today), past: up to six [day, hands, levy, ...the six parts] of the days before, the latest first; gw, gwTo (VB-1779): absent, or
  //   the goodwill in rations gathered toward its head gwTo and not yet booked, under a ration}. Everything from `at` on is
  //   unbooked; each working hour (06:00 to 18:00) of a day is booked once, at a leg's end, so a day closed sums to 12 times its hands;
  //   the night is unbooked. Of the parts nothing older than the six days behind is kept: they are what Sim.hours shows of the past (the
  //   strip's days behind), and the season's count is the tally's. Written only here; plain data, saved.
  // @state plan.tally (VB-1761; a household's plan's): absent until a member's first hour demanded or given, then {at (the season: year
  //   × 4 + season), of: {pawn id: [demanded, taken, given]} (this season's, hours times hands), year: {at (the year of the seasons
  //   folded), of: {pawn id: [demanded, taken, given]}}}: the season's tally by member (the head pair have none), folded into the year's
  //   count by the first booking of a later season (a later year's begins the count afresh). Written only here; plain data, saved.
  const isHead = (st, hh, p) => p.id === hh.holder || (hh.holder !== null && spouseOf(st, hh.holder) === p.id);
  // Pawn p's levy on game day `day`, in hours of the clock (the row's), never written: this season's compiled entry where there is one,
  // else worked out (so the booking compiles nothing the allotment would compile later, with other hands); null for the head pair or one
  // in no household, 0 for one not levied (a child under 7). The booking takes it times the day's hands, the same hands its booked
  // hours are counted in, so its levy line falls where the allotment's capacity does: the row's clock hours (One quantity, one reckoning).
  function levyOn(st, p, day) {
    const hh = p.household === null ? null : st.households[p.household];
    if (!hh || hh.dissolved || isHead(st, hh, p)) return null;
    const c = cal(day * DAY + WORK[0]),
      plan = planOf(st, 'household', hh.id),
      L = plan && plan.levies,
      f = L && L.at === seasonKey(c) ? L.of[p.id] : null,
      e = f && f[2] === p.role ? f : compileRead(st, hh, p, c.season);
    return e[0] === null ? 0 : inForce(plan && plan.grants, p.id, day, e[0]);
  }
  const byHands = (row, hands) => (row === null ? null : row * hands);
  const handsNow = (st, p) => Math.max(0, handsOf(st, p));
  // Pawn p's levy left today in clock hours, read only (compiling nothing, for a view: sim/points), as capacity reckons it: 0 for one
  // not levied, null for the head pair or one in no household.
  function leftToday(st, p) {
    const row = levyOn(st, p, Math.floor(st.t / DAY));
    if (row === null) return null;
    const day = Math.floor(st.t / DAY);
    return Math.max(0, row - workedToday(st, p.id, day) - owedToday(st, p.id, day) - takenToday(st, p.id, day));
  }
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
    r.levy = byHands(levyOn(st, p, day), r.hands);
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
    T.last = { at: T.at, of: T.of };
    T.at = key;
    T.of = {};
  }
  // h hours times hands of a leg opened by `by` ('owed', 'head', 'pawn', 'taken' (a breach's: VB-1779), or none: the pawn's own) booked
  // into record r of pawn p: up to the levy left today (the levy less the hours booked owed, levied and taken) owed, levied or taken, the
  // rest demanded (owed or the head's), given (the pawn's) or kept (taken past the levy); the head pair's household work given, their
  // outer days owed; one in no household keeps its hours. Two parts at most. Hours demanded and taken are goodwill between the member and
  // its head (What a breach costs): `tallied` (a booking, not Sim.hours' copy) books them.
  function put(st, p, r, h, by, tallied) {
    const P = r.p,
      hh = p.household === null ? null : st.households[p.household];
    if (!by || !hh || hh.dissolved) {
      P[4] += h;
      return;
    }
    if (r.levy === null) {
      P[by === 'owed' ? 0 : by === 'taken' ? 4 : 3] += h;
      return;
    }
    const left = Math.max(0, r.levy - P[0] - P[1] - P[5]),
      within = Math.min(h, left),
      past = h - within;
    if (by === 'taken') {
      P[5] += within;
      P[4] += past;
      if (tallied && within > 0) {
        tally(st, hh, p, 1, within, r.day);
        owe(st, hh, p, r, -within);
      }
      return;
    }
    P[by === 'owed' ? 0 : 1] += within;
    if (past <= 0) return;
    const k = by === 'pawn' ? 3 : 2;
    P[k] += past;
    if (tallied) tally(st, hh, p, k === 2 ? 0 : 2, past, r.day);
    if (tallied && k === 2 && by !== 'owed') owe(st, hh, p, r, past);
  }
  // Goodwill between member p and its head for h hours times hands (> 0 demanded: the head owes; < 0 taken: the member owes), in a day's
  // work's units (The gift: GOODWILL.hour rations an hour), gathered on the record (r.gw) and booked once it comes to a whole ration
  // (GOODWILL.forget: less would be forgotten as it is booked).
  function owe(st, hh, p, r, h) {
    const head = hh.holder;
    if (head === null || head === p.id || !st.pawns[head] || !st.pawns[head].alive) return;
    if (r.gwTo !== head) [r.gw, r.gwTo] = [0, head];
    r.gw += h * GOODWILL.hour;
    if (Math.abs(r.gw) < GOODWILL.forget) return;
    VB.count.breachBooked++;
    if (r.gw > 0) bookGoodwill(st, p.id, head, r.gw);
    else bookGoodwill(st, head, p.id, -r.gw);
    r.gw = 0;
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
    const from = Math.min(Math.max(r.at, l.t), st.tick),
      // the hours of a breach (agent.taking, VB-1779) are taken while it lasts, in a leg of the pawn's own or in none
      tk = Number.isFinite(a.taking) ? Math.min(a.taking, st.tick) : -Infinity;
    if (from > r.at) spanTaking(st, p, r, r.at, from, undefined, tk);
    spanTaking(st, p, r, from, st.tick, l.by, tk);
    if (Number.isFinite(a.taking) && a.taking <= st.tick) delete a.taking;
  }
  function spanTaking(st, p, r, from, to, by, tk) {
    if (by || tk <= from) return span(st, p, r, from, to, by);
    span(st, p, r, from, Math.min(to, tk), 'taken');
    if (tk < to) span(st, p, r, tk, to, by);
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
  // six behind is left out. Read only: a day not yet closed (no leg has ended since) is closed in a copy, the leg in progress booked by
  // who opened it and the hours in no leg kept, as its end will book them.
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
    if (r && p.alive && r.day !== null && r.day < today) {
      // closed in the copy as the leg in progress will close it: its hours by who opened it, the rest in no leg, kept
      const end = (today * DAY + WORK[0]) * TICKS,
        l = a.leg,
        from = l ? Math.min(Math.max(r.at, l.t), end) : end;
      if (from > r.at) span(st, p, r, r.at, from, undefined, false);
      span(st, p, r, from, end, l ? l.by : undefined, false);
    }
    const held = new Map();
    if (r && r.day !== null) {
      for (const e of r.past) held.set(e[0], dayOf(e[0], e[1], e[2], e.slice(3), 'past'));
      held.set(r.day, dayOf(r.day, r.hands, r.levy, r.p, r.day < today ? 'past' : 'today'));
    }
    for (let d = from; d <= until; d++) {
      if (held.has(d)) out.push(held.get(d));
      else if (d >= today && p.alive)
        out.push(
          dayOf(d, handsNow(st, p), byHands(levyOn(st, p, d), handsNow(st, p)), null, d === today ? 'today' : 'ahead'),
        );
    }
    return out;
  }
  // The season's tally of household hh by member, and the year's count: {season, of, year, yearOf}, read only; this season's empty where
  // nothing has been booked in it yet (a tally of an earlier season, not yet folded, is counted in the year's).
  function tallyOf(st, hh, c = cal(st.t)) {
    const plan = planOf(st, 'household', hh.id),
      T = plan && plan.tally,
      key = seasonKey(c);
    if (!T) return { season: key, of: {}, year: c.year, yearOf: {}, before: {} };
    const before = T.at === key - 1 ? T.of : T.at === key && T.last && T.last.at === key - 1 ? T.last.of : {};
    if (T.at >= key) return { season: key, of: T.of, year: T.year.at, yearOf: T.year.of, before };
    const U = { at: T.at, of: T.of, year: { at: T.year.at, of: copyOf(T.year.of) } };
    fold(U, key);
    return { season: key, of: U.of, year: U.year.at, yearOf: U.year.of, before };
  }
  const copyOf = (o) => Object.fromEntries(Object.entries(o).map(([k, e]) => [k, e.slice()]));
  // ---- the labour budget (VB-1778; design.md section 7, The levy and own hours: The labour budget, A season that does not fit) ----
  // @state plan.budget (a household's plan's): absent until its first review, then {at (the season: year × 4 + season), from (the day
  //   of the season, 0 to SEASON_DAYS - 1, it was reckoned from), sig (the members, their roles and the outer days it was reckoned on),
  //   weeks: [the levy hours of each of the season's three game weeks from `from` on, hours times hands, less the outer levies' days in
  //   it, at least 0], total (their sum), outer (the adult-days of outer levies counted out)}: reckoned at the season's first review and
  //   again at a review that finds the members, a role or the outer days changed. Plain data, saved with the plan. Written only here.
  // @state plan.fit (a household's plan's): absent until its first review, then {at (the season), short (the hours its steps' hours left,
  //   by the head's estimate's mid, exceed the budget by, at the worst game week counted from the season's start: 0 when the season fits),
  //   week (that game week, 0 to 2), servant (the game year of the moving round at which it would take a servant, or absent), and where
  //   short: help [[step id, kind, from day, until day (game days), hours]] (the help it plans to ask in each short step's window),
  //   lowered {store: what it gave up, in the store's units}, demand (the hours left to demand day by day)}: judged once, at the season's
  //   first review. Plain data, saved with the plan. Written only here; sim/seasonal lowerTargets applies `lowered` (told by the event
  //   targetsLowered), sim/hands plannedHelp reads `help`, sim/service `servant`; a standing grant (VB-1763) is not renewed while `short`.
  const WEEK = SEASON_DAYS / 3;
  // The levy hours a day member p brings its household's season plan, times its hands: its levy (levyOf); for the head pair, not levied
  // (the plan is theirs), the adult row's hours times their hands, the hours of their own they give the household's work by custom.
  function budgetHours(st, hh, p, c, day) {
    const head = isHead(st, hh, p);
    if (!head && rowOf(st, hh, p) === null) return 0; // a child under 7, compiled only where it is allotted
    const e = entry(st, hh, p, c);
    if (!e) return 0;
    if (e[0] !== null) return inForce(grantsOf(st, hh), p.id, day, e[0]) * e[1];
    return head && !p.retired ? levyNorm(st, 'adult', c.season, villageOf(st, p)) * e[1] : 0;
  }
  // The outer levies' days of household hh this season from day `from` on, by game week, each in its window (VB-1767): each day
  // named in its week, and the days asked and not yet named in the first week they could be named for (their notice ahead, within the
  // window); [days a week, total]. Days not yet asked are not charged to any season until their levier asks them.
  function outerDays(st, hh, c, from) {
    const first = c.day - c.sday,
      w = [0, 0, 0];
    let n = 0;
    for (const o of Obligations.due(st, { kind: 'household', id: hh.id }, 'debtor', 'days')) {
      if (!o.window) continue;
      for (const e of o.named) {
        const d = e.day - first;
        if (d < from || d >= SEASON_DAYS) continue;
        w[Math.floor(d / WEEK)]++;
        n++;
      }
      const u = Math.max(0, Math.ceil(Math.min(o.asked, Obligations.left(o)) - 1e-9) - o.named.length),
        d = Math.max(c.sday + o.terms.notice, o.window[0] - first);
      if (u > 0 && d < SEASON_DAYS && o.window[1] - first >= from) {
        w[Math.floor(Math.min(d, o.window[1] - first, SEASON_DAYS - 1) / WEEK)] += u;
        n += u;
      }
    }
    return [w, n];
  }
  // What household hh's budget was reckoned on: its members, their roles, and the outer days owed (called or not).
  function sigOf(st, hh) {
    let s = '';
    for (const id of hh.members) if (st.pawns[id].died === null) s += id + st.pawns[id].role[0] + ',';
    const G = grantsOf(st, hh);
    if (G) {
      // the grants themselves, not their count: a grant pruned and another written in one call change the budget
      for (const g of G.dated) s += `d${g[0]}.${g[1]}.${g[2]}.${g[3]}`;
      for (const id of Object.keys(G.season)) s += `s${id}.${G.season[id][0]}.${G.season[id][1]}`;
    }
    for (const o of Obligations.due(st, { kind: 'household', id: hh.id }, 'debtor', 'days'))
      if (Obligations.isLive(o))
        s += `o${o.id}.${Math.round(Obligations.left(o) * 100)}.${Math.round(o.asked * 100)}.${o.named.length}`;
    return s;
  }
  // budget(st, hh, c): household hh's labour budget for the season of c (plan.budget), reckoned where it is a new season or what it
  // was reckoned on has changed; null where it has no plan. A standing grant comes out of its member's hours a day, and each dated grant
  // its hours of the levy out of its day's game week (Leave, and a stay away: the labour budget counts them out of its season).
  function budget(st, hh, c = cal(st.t)) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan) return null;
    const key = seasonKey(c),
      sig = sigOf(st, hh),
      B = plan.budget;
    if (B && B.at === key && B.sig === sig) return B;
    VB.count.budgetReckoned++;
    const from = c.sday,
      [weeks, outer] = weeksOf(st, hh, c);
    return (plan.budget = { at: key, from, sig, weeks, total: weeks[0] + weeks[1] + weeks[2], outer });
  }
  // The levy hours of household hh's members in each game week of the season of c, from its day on, less the outer levies' days: [weeks,
  // the outer days owed].
  function weeksOf(st, hh, c) {
    const from = c.sday,
      first = c.day - c.sday,
      weeks = [0, 0, 0];
    for (let d = from; d < SEASON_DAYS; d++)
      for (const id of hh.members) {
        VB.count.budgetDay++;
        const p = st.pawns[id];
        if (p.died === null) weeks[Math.floor(d / WEEK)] += budgetHours(st, hh, p, c, first + d);
      }
    const [w, outer] = outerDays(st, hh, c, from);
    for (let k = 0; k < 3; k++) weeks[k] = Math.max(0, weeks[k] - w[k] * OUTER.hours);
    return [weeks, outer];
  }
  // The hours of plan's season due by each game week against `weeks` (levy hours a week), by the cumulative weekly comparison of fit:
  // {short (the largest shortfall), week (where it falls), rows ([week, step]), ends}.
  function shortOf(st, plan, hh, c, weeks) {
    const ends = new Map();
    for (const j of st.jobsBy.get(`household:${hh.id}`) || []) {
      if (j.step === undefined || j.step === null) continue;
      const e = windowEnd(st, j, c);
      if (e !== null && !(ends.get(j.step) <= e)) ends.set(j.step, e);
    }
    const need = [0, 0, 0],
      rows = [];
    for (const s of plan.season || []) {
      if (!s.left || !(s.left.mid > 0)) continue;
      VB.count.fitRow++;
      const k = weekOf(s, c, ends),
        R = s.what && s.what.routine;
      if (R && KINDS[R] && KINDS[R].daily) {
        // a daily routine's hours are due day by day (VB-1906): spread evenly over the days from today to its last, by game week
        const last = Math.min(SEASON_DAYS - 1, s.by - (c.day - c.sday)),
          n = Math.max(1, last - c.sday + 1);
        for (let d = c.sday; d <= Math.max(c.sday, last); d++) need[Math.floor(d / WEEK)] += s.left.mid / n;
      } else need[k] += s.left.mid;
      rows.push([k, s]);
    }
    let short = 0,
      week = 2,
      n = 0,
      b = 0;
    for (let k = 0; k < 3; k++) {
      n += need[k];
      b += weeks[k];
      if (n - b > short + 1e-9) [short, week] = [n - b, k];
    }
    return { short, week, rows, ends };
  }
  // fitsLess(st, hh, id, hours, c): would household hh's season, from today, still fit by fit's weekly comparison were member id's levy
  // `hours` a day by the clock lower for the rest of it (hours times hands, at most its levy in force each day). Reckoned afresh: the
  // budget from today against the hours left now. False where it has no plan, or is short already.
  function fitsLess(st, hh, id, hours, c = cal(st.t)) {
    const plan = planOf(st, 'household', hh.id);
    if (!plan || !plan.season) return false;
    const [weeks] = weeksOf(st, hh, c),
      first = c.day - c.sday,
      hands = Math.max(0, handsOf(st, st.pawns[id]));
    for (let d = c.sday; d < SEASON_DAYS; d++) {
      const k = Math.floor(d / WEEK);
      weeks[k] = Math.max(0, weeks[k] - Math.min(levyOf(st, id, first + d) || 0, hours * hands));
    }
    return !(shortOf(st, plan, hh, c, weeks).short > 1e-9);
  }
  // The game week (0 to 2) of the season of c by which step s is due: a routine's, the earliest window its open tasks close in (sim/hands
  // windowEnd: the sowing, the frost before the harvest is in; `ends`, a day of the year by step id), else the step's last day; never
  // a week already past.
  function weekOf(s, c, ends) {
    const first = c.day - c.sday;
    let d = Math.min(SEASON_DAYS - 1, s.by - first);
    const e = ends.get(s.id);
    if (e !== undefined) d = Math.min(d, e - c.season * SEASON_DAYS);
    return Math.max(Math.floor(c.sday / WEEK), Math.floor(Math.max(0, d) / WEEK));
  }
  // What the hours of target step s buy, in rations an hour, by the head's reckoning, and what its store lacks: {perHour, lack}, or null
  // for one it would not lower: the seed, which every head holds back first (Reservations); the woodpile and the hay, which custom puts
  // no worth on (a winter's fire and fodder, not priced against an hour); a target the head chose. A field: its crop less its seed in a
  // year (sim/estimate fieldYield of barley, the one reckoning the head's demand weighs a field step's yield by); a made good: custom's
  // worth a unit.
  function yieldOf(st, plan, hh, c, s) {
    const T = s.what.target,
      C = plan.chosen;
    let worth = null;
    if (T.store === 'fields' && !(C && C.fields !== null)) worth = fieldYield('barley');
    else if (T.good && !(C && C.goods && C.goods[T.good] != null)) {
      const q = Norms.norm('worth', T.good);
      if (q !== undefined) worth = q / goodOf(T.good).quantum;
    }
    if (worth === null) return null;
    const w = workOfTarget(st, hh, c, s);
    return w && w.lack > 0 && s.left.mid > 0 ? { perHour: (worth * w.lack) / s.left.mid, lack: w.lack } : null;
  }
  const r1 = (x) => Math.round(x);
  // The head of household hh judges its season against its budget, at the season's first review (after its estimate of each step's
  // hours left, sim/estimate setLeft): by each game week, the hours due by its end against the budget's to its end, so a short game week
  // is seen as the season's total is. Where it does not fit, its default author answers in design.md's order, each by its estimate: help
  // asked in each short step's window that help takes (MATCH.help.kinds; sim/day asks it, sim/hands plannedHelp) and a servant at the
  // moving round (sim/service), counted on until given by neither; then a target lowered, the one whose hours buy least first, while an hour of it
  // buys less than a demanded hour costs (DEMAND.weight × GOODWILL.hour); then the rest demanded day by day (sim/day, VB-1779). The
  // answer is said in a line of the record. A head on its own commands (unplanned) is told the shortfall, and answers it itself.
  function fit(st, plan, hh, c) {
    const key = seasonKey(c);
    VB.count.fitJudged++;
    const B = budget(st, hh, c),
      { short, week, rows, ends } = shortOf(st, plan, hh, c, B.weeks);
    const was = plan.fit,
      F = (plan.fit = { at: key, short, week });
    if (was && Number.isInteger(was.servant) && was.servant >= c.year) F.servant = was.servant;
    if (!(short > 1e-9)) return F;
    F.help = [];
    F.lowered = {};
    F.demand = short;
    const head = hh.holder,
      by = rows.filter((r) => r[0] <= week).map((r) => r[1]);
    if (head !== null && unplanned(st, head)) {
      // the head on its own commands is told the shortfall only: how to answer it is its own decision (Every act is a pawn's)
      delete F.servant;
      F.demand = 0;
      say(st, hh, head, F);
      return F;
    }
    // (1) hands asked: in the window of each step due by the short week that help takes, the earliest due first, until the help planned
    // covers the shortfall (never more than it); and a servant at the next moving round (autumn's, ASK.day)
    const first = c.day - c.sday;
    let ask = short;
    for (const [, s] of rows.filter((r) => r[0] <= week).sort((x, y) => x[0] - y[0] || x[1].id - y[1].id)) {
      const k = s.what.routine;
      if (!(ask > 1e-9)) break;
      if (!k || !MATCH.help.kinds.includes(k)) continue;
      const until = ends.has(s.id) ? Math.min(s.by, first + ends.get(s.id) - c.season * SEASON_DAYS) : s.by,
        h = Math.min(s.left.mid, ask);
      F.help.push([s.id, k, c.day, Math.max(c.day, until), h]);
      ask -= h;
    }
    F.servant = c.season < 2 || (c.season === 2 && c.sday < ASK.day) ? c.year : c.year + 1;
    // (2) a target lowered, the cheapest first, while an hour of it buys less than a demanded hour would cost
    const bar = DEMAND.weight * GOODWILL.hour,
      cand = [];
    for (const s of by) {
      if (!s.what.target) continue;
      const y = yieldOf(st, plan, hh, c, s);
      if (y && y.perHour < bar) cand.push([y.perHour, s, y.lack]);
    }
    cand.sort((x, y) => x[0] - y[0] || x[1].id - y[1].id);
    let rest = short;
    for (const [, s, lack] of cand) {
      if (!(rest > 1e-9)) break;
      const store = s.what.target.store,
        M = store === 'fields' ? null : MADE.get(store),
        per = s.left.mid / lack; // the hours a unit of the store's lack costs
      let n = (lack * Math.min(rest, s.left.mid)) / s.left.mid;
      // a store counted whole (a field, a whole good) is lowered by whole units, one where the cut reaches most of one; the rest is demanded
      if (store === 'fields' || (M && M.whole)) n = Math.min(lack, Math.round(n));
      if (!(n > 1e-9)) continue;
      F.lowered[store] = n;
      rest -= n * per;
    }
    if (Object.keys(F.lowered).length) emit(st, 'targetsLowered', { plan, c }); // sim/seasonal lowerTargets
    // (3) the rest, demanded day by day
    F.demand = Math.max(0, rest);
    say(st, hh, head, F);
    return F;
  }
  // The line of the record that says how the head answered a season that did not fit.
  function say(st, hh, head, F) {
    if (hh.farmstead === null) return;
    const f = st.farmsteads[hh.farmstead],
      who = head === null ? `The household of ${f.name}` : `${fullName(st.pawns[head])} of ${f.name}`,
      parts = [];
    if (F.help.length)
      parts.push(`will ask for help with the ${F.help.map((h) => KINDS[h[1]].label.toLowerCase()).join(', ')}`);
    if (F.servant !== undefined) parts.push('will take a servant at the moving round if one is to be had');
    const L = Object.keys(F.lowered);
    if (L.length) parts.push(`lowered its target of ${L.join(', ')}`);
    if (F.demand > 1e-9) parts.push(`will ask ${r1(F.demand)} hours more of the household`);
    log(
      st,
      `${who} reckoned the season's work ${r1(F.short)} hours more than the household owes it by the ` +
        `${['first', 'second', 'third'][F.week]} week${parts.length ? `, and ${parts.join('; ')}` : ''}.`,
      { kind: 'seasonShort', pawn: head ?? undefined, ...atFarm(f) },
    );
  }
  // At every review of a household's plan, after its steps' hours left (sim/estimate, whose listener comes first): its budget, reckoned
  // where something has changed, and at the season's first review its fit judged.
  on('planReviewed', (st, d) => {
    if (d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id];
    if (hh.dissolved || !d.plan.season) return;
    budget(st, hh, d.c);
    if (!d.plan.fit || d.plan.fit.at !== seasonKey(d.c)) {
      fit(st, d.plan, hh, d.c);
      emit(st, 'seasonJudged', { hh, c: d.c }); // the season's turn: the members' asks of a lighter levy (sim/voice, VB-1763)
    }
  });
  // ---- outer levies (VB-1767; design.md, Outer levies): laid with their terms, asked by season, named by the levied, worked ----
  const today = (st) => Math.floor(st.t / DAY);
  const { OUTER, TERMS } = Days;
  // The sources whose levier asks their days season by season (design.md's table); a routine's and a due's are laid with their window.
  const ASKED = new Set(['keep', 'debt', 'patron']);
  const hhRef = (id) => ({ kind: 'household', id });
  // The pawn who acts for body party: a household's holder, a village's alderman; null for none.
  function agentOf(st, party) {
    if (party.kind === 'household') {
      const hh = st.households[party.id];
      return hh && !hh.dissolved ? hh.holder : null;
    }
    if (party.kind === 'village') {
      const v = st.villages[party.id];
      return v && v.alderman !== undefined ? v.alderman : null;
    }
    return null;
  }
  // The days of levy o still to be named: those asked (whole days, a day part worked counted whole) less those named and those on
  // duty today.
  function unnamed(st, o) {
    const d = st.daysToday;
    let n = o.named.length;
    if (d && d.day === today(st)) for (const k in d.by) if (d.by[k][0] === o.id && d.by[k][1] < OUTER.hours - 1e-9) n++;
    return Math.max(0, Math.ceil(Math.min(o.asked, Obligations.left(o)) - 1e-9) - n);
  }
  // An adult of household hh who may be sent: alive, a member, not retired, of the age help takes.
  const able = (st, hh, id) => {
    const p = st.pawns[id];
    return !!p && p.alive && p.household === hh.id && !p.retired && age(st, p) >= MATCH.help.minAge;
  };
  // ---- the verb levy: a levier's agent lays a levy with its terms ----
  // args: {debtor (a party: a household, or a village whose lots are its households'), creditor (default: the actor's household), source
  // (a key of TERMS), days, window ([first, last] game day; a keep's, a debt's and a patron's are asked by season instead), due (the hour
  // its term ends; default its window's end, else its kind's), terms (any of TERMS' fields, over the source's)}.
  function creditorOf(st, actor, a) {
    if (a.creditor) return a.creditor;
    const p = st.pawns[actor];
    return p && p.household !== null ? hhRef(p.household) : null;
  }
  function levyWhy(st, actor, a) {
    if (!a || !TERMS[a.source]) return 'a levy names its source';
    if (!(a.days > 0)) return 'a levy is of a day of work or more';
    const cr = creditorOf(st, actor, a);
    if (!cr || agentOf(st, cr) !== actor) return 'only the one who acts for the body owed lays its levy';
    const db = a.debtor,
      body = db && (db.kind === 'household' ? st.households[db.id] : db.kind === 'village' ? st.villages[db.id] : null);
    if (!body || body.dissolved) return 'there is no such household or village to levy';
    if (db.kind === cr.kind && db.id === cr.id) return 'a body does not levy itself';
    if (a.window && !(a.window[0] <= a.window[1] && a.window[1] >= today(st))) return 'its window is past';
    return null;
  }
  // A village's levy split into its households' lots by fields (design.md, Lots: the custom's default), whole days by the largest
  // remainder, ties in turn by the household's id against the year; a household with no fields owes none. [[household id, days]].
  function lotsOf(st, vid, D) {
    const hs = [];
    for (const fid of st.villages[vid].farmsteads) {
      const f = st.farmsteads[fid],
        hh = f.household === null ? null : st.households[f.household];
      if (hh && !hh.dissolved && f.fields.length) hs.push([hh.id, f.fields.length]);
    }
    const F = hs.reduce((s, h) => s + h[1], 0);
    if (!F) return [];
    const y = cal(st.t).year,
      lots = hs.map(([id, n]) => [id, Math.floor((D * n) / F), (D * n) / F - Math.floor((D * n) / F)]);
    let rest = D - lots.reduce((s, l) => s + l[1], 0);
    const order = lots
      .slice()
      .sort((a, b) => b[2] - a[2] || ((a[0] + y) % hs.length) - ((b[0] + y) % hs.length) || a[0] - b[0]);
    for (const l of order) if (rest-- > 0) l[1]++;
    return lots.filter((l) => l[1] > 0).map((l) => [l[0], l[1]]);
  }
  register('levy', {
    check: (st, c) => levyWhy(st, c.actor, c.args),
    run: (st, c) => {
      const a = c.args,
        creditor = creditorOf(st, c.actor, a),
        due = a.due ?? (a.window ? (a.window[1] + 1) * DAY : undefined),
        draft = (debtor, days) => ({
          kind: 'days',
          debtor,
          creditor,
          owes: { days },
          due,
          source: a.source,
          terms: { ...TERMS[a.source], ...(a.terms || {}) },
          window: a.window,
        });
      // on a village, on top of the levies already laid on its households (design.md, An estate's levy): each lot its own record
      const parts =
        a.debtor.kind === 'village'
          ? lotsOf(st, a.debtor.id, a.days).map(([id, n]) => [hhRef(id), n])
          : [[a.debtor, a.days]];
      for (const [debtor, n] of parts) {
        Obligations.create(st, draft(debtor, n));
        VB.count.leviesLaid++;
      }
    },
  });
  // ---- the ask: the levier's default author, at its season's turn ----
  // A keep's or a patron's: the days its household's season plan falls short of its labour budget (plan.fit.short over OUTER.hours,
  // rounded up), a day at a time from the levy with most days left; a debt's a quarter of its days; at summer's turn, the year's last
  // season, whatever is still owed. The window: from today to the season's last day, within the levy's term.
  function ask(st, hh, c) {
    const L = Obligations.due(st, hhRef(hh.id), 'creditor', 'days').filter((o) => ASKED.has(o.source));
    if (!L.length) return;
    const last = c.day - c.sday + SEASON_DAYS - 1,
      summer = c.season === 1,
      plan = planOf(st, 'household', hh.id),
      whole = (o) => Math.ceil(Obligations.left(o) - 1e-9),
      n = new Map(L.map((o) => [o.id, 0]));
    let short = plan && plan.fit && plan.fit.short > 0 ? Math.ceil(plan.fit.short / OUTER.hours - 1e-9) : 0;
    for (const o of L) {
      VB.count.leviesAsked++;
      if (summer) n.set(o.id, whole(o));
      else if (o.source === 'debt') n.set(o.id, Math.min(whole(o), Math.ceil(o.owes.days / 4 - 1e-9)));
    }
    const shared = L.filter((o) => o.source !== 'debt');
    while (!summer && short > 0) {
      let best = null;
      for (const o of shared)
        if (n.get(o.id) < whole(o) && (!best || whole(o) - n.get(o.id) > whole(best) - n.get(best.id))) best = o;
      if (!best) break;
      n.set(best.id, n.get(best.id) + 1);
      short--;
    }
    for (const o of L)
      Obligations.setLevy(st, o.id, {
        window: [c.day, Math.min(last, Math.floor((o.due - 1) / DAY))],
        asked: Math.max(n.get(o.id), o.named.length), // the days named still to come stay asked
      });
  }
  on('seasonJudged', (st, d) => ask(st, d.hh, d.c));
  // ---- naming: the levied head's rule, or the verb name ----
  // What naming day d displaces of household hh's windowed work, by its head's reckoning: for each open task whose window (sim/hands
  // windowEnd) is still open on d, the hours of it left past what the household's hands can do from d to the window's end less the day's.
  function displaced(st, hh, c, d, cap) {
    const dy = c.season * SEASON_DAYS + c.sday + (d - c.day);
    let n = 0;
    for (const j of st.jobsBy.get(`household:${hh.id}`) || []) {
      VB.count.leviesWeighed++;
      const e = windowEnd(st, j, c);
      if (e === null || e < dy || !isOpen(st, j)) continue;
      const left = Math.max(0, (j.hours ?? KINDS[j.kind].hours ?? 0) - (j.done || 0));
      n += Math.min(OUTER.hours, Math.max(0, left - (cap * (e - dy + 1) - OUTER.hours)));
    }
    return n;
  }
  // The hours a day of hh's adults: each one's levy in force (the head pair the working day).
  const capOf = (st, hh, D) =>
    hh.members.reduce((s, id) => s + (able(st, hh, id) ? (levyOf(st, id, D) ?? WORK[1] - WORK[0]) : 0), 0);
  // The adult of hh to send on day d: the one whose levy leaves least undone, the lowest levy that day (the head pair's the working day).
  function adultFor(st, hh, d) {
    let best = null,
      bh = Infinity;
    for (const id of hh.members) {
      if (!able(st, hh, id)) continue;
      const h = levyOf(st, id, d) ?? WORK[1] - WORK[0];
      if (h < bh) [best, bh] = [id, h];
    }
    return best;
  }
  // The days of levy o's window still to name, by the default author of whoever names them: the levied's, each the day that displaces
  // least of its windowed work (the earliest of equals), never a day another adult of its household is named for; the levier's, the
  // earliest days at the notice, the one sent picked on the day.
  function nameDays(st, o, D) {
    const hh = st.households[o.debtor.id];
    if (!hh || hh.dissolved || o.terms.names === 'together') return; // one date for all: the alderman's (VB-1768)
    const byLevier = o.terms.names === 'levier',
      actor = byLevier ? agentOf(st, o.creditor) : hh.holder,
      from = Math.max(D + o.terms.notice, o.window[0]),
      to = o.window[1];
    if (actor === null || actor === undefined || from > to) return;
    const taken = new Set();
    for (const x of Obligations.due(st, hhRef(hh.id), 'debtor', 'days')) for (const e of x.named) taken.add(e.day);
    const c = cal(st.t),
      cap = byLevier ? 0 : capOf(st, hh, D);
    for (let k = unnamed(st, o); k > 0; k--) {
      let day = null,
        least = Infinity;
      for (let d = from; d <= to; d++) {
        if (taken.has(d)) continue;
        const x = byLevier ? 0 : displaced(st, hh, c, d, cap);
        if (x < least - 1e-9) [day, least] = [d, x];
        if (byLevier || least <= 0) break;
      }
      if (day === null) return;
      const pawn = byLevier ? null : adultFor(st, hh, day);
      if (issue(st, { actor, verb: 'name', target: o.id, args: { day, pawn }, source: 'planner' }) !== true) return;
      taken.add(day);
    }
  }
  // Why `actor` cannot name day args.day of levy id (for args.pawn, or null: picked on the day), or null; with args.from, a day named
  // moved to another (the ladder's second rung, VB-1769).
  function nameWhy(st, actor, id, a) {
    const o = st.obligations && st.obligations[id];
    if (!o || o.kind !== 'days' || !Obligations.isLive(o)) return `there are no days owed under ${id}`;
    if (!o.window) return 'no day of it is asked yet';
    const hh = st.households[o.debtor.id];
    if (o.terms.names === 'together') return 'its day is the one date for all';
    const who = o.terms.names === 'levier' ? agentOf(st, o.creditor) : hh ? hh.holder : null;
    if (who === null || who !== actor)
      return `its days are named by the ${o.terms.names === 'levier' ? 'levier' : 'levied head'}`;
    const day = a && a.day;
    if (!Number.isInteger(day)) return 'a day is named by its game day';
    if (day < today(st) + o.terms.notice) return `a day is named at least ${o.terms.notice} days ahead`;
    if (day < o.window[0] || day > o.window[1]) return "the day is outside the levy's window";
    const from = a.from;
    if (from !== undefined && !o.named.some((e) => e.day === from))
      return 'no adult is named for the day it moves from';
    if (from === undefined && !(unnamed(st, o) > 0)) return 'every day asked is named already';
    if (o.named.some((e) => e.day === day)) return 'an adult is named for that day of this levy already';
    if (a.pawn !== null && a.pawn !== undefined && !able(st, hh, a.pawn)) return 'no adult of that household can come';
    return null;
  }
  register('name', {
    check: (st, c) => nameWhy(st, c.actor, c.target, c.args),
    run: (st, c) => {
      const o = st.obligations[c.target],
        day = c.args.day,
        rest = o.named.filter((e) => e.day !== c.args.from);
      Obligations.setLevy(st, o.id, {
        named: [
          ...rest.filter((e) => e.day < day),
          { day, pawn: c.args.pawn ?? null },
          ...rest.filter((e) => e.day > day),
        ],
      });
      VB.count.daysNamed++;
    },
  });
  // Whether the levied head of levy o names its own days now: its default author does, unless the head is on its own commands, whose
  // days are named by the default author only once the window has no more days left than the days unnamed and the notice.
  function namesNow(st, o, D) {
    if (o.terms.names !== 'levied') return true;
    const hh = st.households[o.debtor.id],
      head = hh ? hh.holder : null;
    return head === null || !unplanned(st, head) || o.window[1] - D + 1 <= unnamed(st, o) + o.terms.notice;
  }
  // The pawn of household hh sent on day named e of levy o, once its head's ladder has answered (keepDay), or null: the one named, or
  // where it cannot come and the terms allow (or none was named), another adult; none where nobody can (the day stays owed).
  function sentOf(st, o, e, by) {
    const hh = st.households[o.debtor.id];
    if (!hh || hh.dissolved) return null;
    const ok = (id) => comes(st, hh, id, by);
    if (e.pawn !== null && ok(e.pawn)) return e.pawn;
    if (e.pawn !== null && !o.terms.substitute) return null;
    return hh.members.find(ok) ?? null;
  }
  // ---- the ladder before a breach (VB-1769; design.md, Outer levies, The terms, the ladder and the breach) ----
  // An adult of hh who can come today: able, not ill, at home (not away), not on another levy's duty today.
  const comes = (st, hh, id, by) =>
    able(st, hh, id) && !st.pawns[id].ill && !!st.agents[id] && st.agents[id].away === undefined && !(by && by[id]);
  // K: what keeping day d of an outer levy costs household hh with adult id sent (null: any adult, a whole day), in rations, by its
  // head's reckoning, as its demand reckons work at risk (sim/day atRisk): for each open task whose window (sim/hands windowEnd) is still
  // open on d, the hours the day takes from it past what the household's levied hours to the window's end less the day's cover, times
  // its yield over its hours left (a field's crop, sim/estimate fieldYield; a task due today, a ration a member); weighed by
  // OUTER.hunger below its floor. The hours the day takes: the day's, at most the adult's own levy that day.
  function costOf(st, hh, d, id = null) {
    VB.count.outerCost++;
    const c = cal(st.t),
      dy = c.season * SEASON_DAYS + c.sday + (d - c.day),
      own = id === null ? null : (levyOf(st, id, d) ?? WORK[1] - WORK[0]),
      taken = own === null ? OUTER.hours : Math.min(OUTER.hours, own),
      cap = capOf(st, hh, d),
      mouths = hh.members.filter((m) => st.pawns[m].died === null).length;
    let K = 0;
    for (const j of st.jobsBy.get(`household:${hh.id}`) || []) {
      VB.count.leviesWeighed++;
      const e = windowEnd(st, j, c);
      if (e === null || e < dy || !isOpen(st, j)) continue;
      const left = Math.max(0, (j.hours ?? KINDS[j.kind].hours ?? 0) - (j.done || 0)),
        x = Math.min(taken, Math.max(0, left - (cap * (e - dy + 1) - taken)));
      if (!(x > 0) || !(left > 0)) continue;
      const R = KINDS[j.kind].late ? mouths : j.field && CROPS[j.field.crop] ? fieldYield(j.field.crop) : 0;
      K += (R * x) / left;
    }
    return Stores.grainOf(hh) < floorOf(st, hh) ? K * OUTER.hunger : K;
  }
  // B: what levy o does to those who breach it, in rations, read from its terms' onBreach: the day's worth booked as goodwill to its
  // levier's agent, weighed by OUTER.breach (the goodwill, and the opinion that follows); a debt's day also stays owed, its worth again.
  // A fine, a case, an estate's penalty and eviction are named in the terms and not built: each reads as the memory for now.
  const breachCost = (o) => OUTER.worth * OUTER.breach + (o.source === 'debt' ? OUTER.worth : 0);
  // K where nobody can be sent: the day cannot be kept at any cost short of the levier's own answer.
  const CANNOT = 1e6;
  // W: the day's worth to the levier of o on day d, by its agent's reckoning: the keep's, the work at risk a day's hands would save his
  // household's own plan (costOf, on his household); a routine's, a debt's, a patron's, a due's, the day's worth (a routine's lots
  // weighed against its work left wait for VB-1768).
  function worthTo(st, o, d) {
    if (o.source === 'keep' && o.creditor.kind === 'household') {
      const cr = st.households[o.creditor.id];
      return cr && !cr.dissolved ? costOf(st, cr, d) : 0;
    }
    return OUTER.worth;
  }
  // The agent of levy o's levier grants an ask for a day (a release, or its transfer) by need and opinion: when K × (1 + its opinion of
  // the asker's head) > W + the goodwill that head already owes it; the same rule lets a breach be forgiven (the agent's planning day).
  function grants(st, o, agent, head, K, d) {
    if (agent === null || agent === undefined || !st.pawns[agent] || !st.pawns[agent].alive) return false;
    const G = Math.max(0, balance(st, agent, head));
    return K * (1 + opinionOf(st, agent, head)) > worthTo(st, o, d) + G;
  }
  // The levied head's default author, on the day's first step, for the day named e of levy o: where the one named can come and keeping
  // the day costs no more than its worth, it is kept; else the ladder, each rung by the verbs and their checks: (1) substitute the adult
  // whose K is least, where it is below the day's worth; (2) name another day of the window whose K is below it; (3) ask the levier's
  // agent for a release; (4) commute, where the terms give a rate, K passes it and the household holds it above its floor; (5) breach,
  // when K > B; else the day is kept as named. A head on its own commands had the decision point `keep` before the day.
  function keepDay(st, o, e, by) {
    const hh = st.households[o.debtor.id];
    if (!hh || hh.dissolved) return;
    const D = e.day,
      head = hh.holder,
      W = OUTER.worth,
      first = e.pawn !== null ? e.pawn : hh.members.find((id) => comes(st, hh, id, by));
    VB.count.outerDayJudged++;
    let K = first !== undefined && first !== null && comes(st, hh, first, by) ? costOf(st, hh, D, first) : CANNOT;
    if (K <= W || head === null || !st.pawns[head] || !st.pawns[head].alive) return;
    VB.count.ladderTried++;
    const act = (verb, args, target = o.id) =>
      issue(st, { actor: head, verb, target, args: { day: D, ...args }, source: 'planner' }) === true;
    const still = () => o.named.some((x) => x.day === D);
    // (1) another adult
    if (o.terms.substitute) {
      let best = null,
        bk = Infinity;
      for (const id of hh.members) {
        if (id === first || !comes(st, hh, id, by)) continue;
        const k = costOf(st, hh, D, id);
        if (k < bk) [best, bk] = [id, k];
      }
      if (best !== null && bk < W && act('substitute', { pawn: best })) return;
      if (best !== null && K === CANNOT) K = bk; // what keeping it costs is then what sending the next adult costs
    }
    // (2) another day, where the levied names and the notice allows: the first whose K is below the day's worth
    if (o.terms.names === 'levied') {
      const taken = new Set();
      for (const x of Obligations.due(st, hhRef(hh.id), 'debtor', 'days')) for (const y of x.named) taken.add(y.day);
      for (let d = Math.max(D + o.terms.notice, o.window[0]); d <= o.window[1]; d++) {
        if (taken.has(d)) continue;
        const id = adultFor(st, hh, d);
        if (id === null) break;
        if (costOf(st, hh, d, id) < W) {
          if (act('name', { day: d, pawn: id, from: D })) return;
          break;
        }
      }
    }
    // (3) a release asked of the levier's agent, its reckoning carried with the ask
    const agent = agentOf(st, o.creditor);
    if (agent !== null && agent !== undefined && agent !== head && st.pawns[agent] && st.pawns[agent].alive) {
      VB.count.releaseAsked++;
      act('ask', { basis: 'release', wants: { levy: o.id, day: D, K } }, agent);
      if (!still()) return;
    }
    // (4) commuted at the terms' rate, from the store above its floor
    const rate = o.terms.commute;
    if (
      rate !== null &&
      rate !== undefined &&
      K > rate &&
      Stores.grainOf(hh) - floorOf(st, hh) >= rate &&
      act('commute', {})
    )
      return;
    // (5) breached, when keeping it costs more than what the levier does
    if (K > breachCost(o)) act('breach', { levy: o.id, K });
  }
  // The day named `day` of levy o, or null; the days named without it.
  const namedOn = (o, day) => o.named.find((e) => e.day === day) || null;
  const without = (o, day) => o.named.filter((e) => e.day !== day);
  // Why `actor` may not act on day a.day of levy id on the levied side (substitute, commute, breach), or null: only its levied head.
  function leviedWhy(st, actor, id, a) {
    const o = st.obligations && st.obligations[id];
    if (!o || o.kind !== 'days' || !Obligations.isLive(o)) return `there are no days owed under ${id}`;
    const hh = o.debtor.kind === 'household' ? st.households[o.debtor.id] : null;
    if (!hh || hh.dissolved || hh.holder !== actor) return 'only the levied head acts on its days';
    if (!a || !Number.isInteger(a.day) || !namedOn(o, a.day)) return 'no adult is named for that day';
    return null;
  }
  // substitute({day, pawn}): another adult sent on a day named, where the terms allow.
  register('substitute', {
    check: (st, c) => {
      const why = leviedWhy(st, c.actor, c.target, c.args);
      if (why) return why;
      const o = st.obligations[c.target],
        hh = st.households[o.debtor.id];
      if (!o.terms.substitute) return 'its terms send the one named, and no other';
      return able(st, hh, c.args.pawn) ? null : 'no adult of that household can come';
    },
    run: (st, c) => {
      const o = st.obligations[c.target];
      Obligations.setLevy(st, o.id, {
        named: o.named.map((e) => (e.day === c.args.day ? { day: e.day, pawn: c.args.pawn } : e)),
      });
      VB.count.daySubstituted++;
    },
  });
  // commute({day}): the day named paid for in goods at the terms' rate, from the household's store to the levier's (a debt's against it).
  register('commute', {
    check: (st, c) => {
      const why = leviedWhy(st, c.actor, c.target, c.args);
      if (why) return why;
      const o = st.obligations[c.target],
        rate = o.terms.commute;
      if (rate === null || rate === undefined) return 'its terms take the day, not goods for it';
      const cr = o.creditor.kind === 'household' ? st.households[o.creditor.id] : null;
      if (!cr || cr.dissolved) return 'there is no store of the levier to pay into';
      return Stores.grainOf(st.households[o.debtor.id]) >= rate ? null : `the household does not hold ${rate} rations`;
    },
    run: (st, c) => {
      const o = st.obligations[c.target],
        hh = st.households[o.debtor.id],
        n = Math.min(1, Obligations.left(o));
      Obligations.setLevy(st, o.id, { named: without(o, c.args.day) });
      // the rate's rations move by sim/stores; the day is booked as paid (not worked) against the levy
      Obligations.fulfil(st, o.id, n, 'commute', {
        from: hh,
        to: st.households[o.creditor.id],
        good: 'grain',
        n: o.terms.commute,
      });
      VB.count.dayCommuted++;
    },
  });
  // The breach of the day named a.day of levy a.levy by its levied head (the verb breach with {levy, day, K}; sim/day's breach of a
  // member's own levy is the other): its onBreach booked at once, the day's worth the head owes the levier's agent, opinion following;
  // a debt's day stays owed (named again), any other's is struck. Told in the record with K and B; the agent answers at its next
  // planning day.
  function breachWhy(st, actor, a) {
    return (
      leviedWhy(st, actor, a.levy, a) || (a.K !== undefined && !(a.K >= 0) ? 'a breach carries its reckoning' : null)
    );
  }
  function breach(st, actor, a) {
    const o = st.obligations[a.levy],
      hh = st.households[o.debtor.id],
      agent = agentOf(st, o.creditor),
      K = Math.min(CANNOT, a.K ?? costOf(st, hh, a.day)),
      B = breachCost(o);
    Obligations.setLevy(st, o.id, { named: without(o, a.day) });
    VB.count.dayBreached++;
    if (o.source !== 'debt') Obligations.lapse(st, o.id, 'breached', Math.min(1, Obligations.left(o)));
    const live =
      Obligations.isLive(o) && agent !== null && agent !== undefined && agent !== actor && st.pawns[agent].alive;
    if (agent !== null && agent !== undefined && agent !== actor && st.pawns[agent].alive)
      bookGoodwill(st, agent, actor, OUTER.worth);
    if (live) Obligations.setLevy(st, o.id, { breaches: [...o.breaches, { day: a.day, K, by: actor }] });
    if (hh.farmstead !== null) {
      const f = st.farmsteads[hh.farmstead],
        to = agent !== null && agent !== undefined && agent !== actor ? ` to ${fullName(st.pawns[agent])}` : '';
      log(
        st,
        `${fullName(st.pawns[actor])} of ${f.name} kept back the day of ${o.source} owed${to}: keeping it would have cost ` +
          `${r1(K)} rations, the breach ${B}${o.source === 'debt' ? '; the day is still owed' : ''}.`,
        { kind: 'levyBreached', pawn: actor, ...atFarm(f) },
      );
    }
  }
  // Why `actor` may not act for the levier of levy id (release, transfer, forgive), or null: only its agent.
  function levierWhy(st, actor, id) {
    const o = st.obligations && st.obligations[id];
    if (!o || o.kind !== 'days' || !Obligations.isLive(o)) return `there are no days owed under ${id}`;
    return agentOf(st, o.creditor) === actor ? null : 'only the one who acts for the levier answers for its days';
  }
  // release({day} or {days}): the levier's agent strikes a day named, or n days of what is left (a levy about to lapse, let go).
  register('release', {
    check: (st, c) => {
      const why = levierWhy(st, c.actor, c.target);
      if (why) return why;
      const o = st.obligations[c.target],
        a = c.args || {};
      if (Number.isInteger(a.day)) return namedOn(o, a.day) ? null : 'no adult is named for that day';
      return a.days > 0 && a.days <= Obligations.left(o) + 1e-9 ? null : 'a release names a day or the days let go';
    },
    run: (st, c) => {
      const o = st.obligations[c.target],
        a = c.args;
      if (Number.isInteger(a.day)) Obligations.setLevy(st, o.id, { named: without(o, a.day) });
      Obligations.forgive(st, o.id, c.actor, Number.isInteger(a.day) ? Math.min(1, Obligations.left(o)) : a.days);
      VB.count.dayReleased++;
    },
  });
  // transfer({day, to}): the levier's agent lends the day named to household `to` of the levied's village: the day worked there on the
  // basis `owed`, a levy of one day of its own (the alderman lends a day of his keep to a household in need).
  register('transfer', {
    check: (st, c) => {
      const why = levierWhy(st, c.actor, c.target);
      if (why) return why;
      const o = st.obligations[c.target],
        a = c.args || {},
        to = Number.isInteger(a.to) ? st.households[a.to] : null,
        from = st.households[o.debtor.id];
      if (!Number.isInteger(a.day) || !namedOn(o, a.day)) return 'no adult is named for that day';
      if (
        !to ||
        to.dissolved ||
        !from ||
        to.id === from.id ||
        (o.creditor.kind === 'household' && to.id === o.creditor.id)
      )
        return 'a day is lent to another household';
      return from.farmstead !== null &&
        to.farmstead !== null &&
        st.farmsteads[from.farmstead].village === st.farmsteads[to.farmstead].village
        ? null
        : 'a day is lent within the village';
    },
    run: (st, c) => {
      const o = st.obligations[c.target],
        e = namedOn(o, c.args.day);
      Obligations.setLevy(st, o.id, { named: without(o, e.day) });
      Obligations.forgive(st, o.id, c.actor, Math.min(1, Obligations.left(o)));
      const id = Obligations.create(st, {
        kind: 'days',
        debtor: o.debtor,
        creditor: hhRef(c.args.to),
        owes: { days: 1 },
        due: (e.day + 1) * DAY,
        source: o.source,
        terms: { ...o.terms, carry: false },
        window: [e.day, e.day],
      });
      const d = st.daysToday;
      if (e.day === today(st) && d && d.day === e.day) {
        const hh = st.households[o.debtor.id],
          p = e.pawn !== null && comes(st, hh, e.pawn, d.by) ? e.pawn : hh.members.find((x) => comes(st, hh, x, d.by));
        if (p !== undefined && p !== null) Days.seat(st, p, id);
      } else Obligations.setLevy(st, id, { named: [e] });
      VB.count.dayTransferred++;
    },
  });
  // forgive({day}): the levier's agent forgives a breach still to answer: the goodwill it booked is struck (design.md also books the
  // day's worth to the agent's credit as a gift, which would undo the striking; VB-1769 strikes it only, a note to design). The day a
  // debt still owes stays owed.
  register('forgive', {
    check: (st, c) => {
      const why = levierWhy(st, c.actor, c.target);
      if (why) return why;
      const o = st.obligations[c.target];
      return o.breaches.some((b) => b.day === (c.args && c.args.day))
        ? null
        : 'there is no breach of that day to answer';
    },
    run: (st, c) => {
      const o = st.obligations[c.target],
        b = o.breaches.find((x) => x.day === c.args.day);
      Obligations.setLevy(st, o.id, { breaches: o.breaches.filter((x) => x !== b) });
      if (st.pawns[b.by].alive && st.pawns[c.actor].alive) bookGoodwill(st, b.by, c.actor, OUTER.worth);
      VB.count.breachForgiven++;
    },
  });
  // At the levier's agent's planning day (a review of the levier's plan): each breach still to answer forgiven where its release would
  // have been granted (grants), else let stand.
  on('planReviewed', (st, d) => {
    const H = d.plan.holder;
    if (H.type !== 'household' && H.type !== 'village') return;
    for (const o of Obligations.due(st, { kind: H.type, id: H.id }, 'creditor', 'days')) {
      if (!o.breaches.length) continue;
      const agent = agentOf(st, o.creditor);
      for (const b of o.breaches.slice()) {
        VB.count.breachAnswered++;
        if (agent !== null && agent !== undefined && st.pawns[b.by].alive && grants(st, o, agent, b.by, b.K, b.day))
          issue(st, { actor: agent, verb: 'forgive', target: o.id, args: { day: b.day }, source: 'planner' });
      }
      if (o.breaches.length) Obligations.setLevy(st, o.id, { breaches: [] }); // the rest let stand
    }
  });
  // ---- the asks of the levied: the bases `release` and `transfer` (sim/offers), answered by the levier's agent ----
  // wants {levy, day, K (the asker's reckoning of the day), to (transfer: the household the day is to be worked for)}.
  function askCheck(st, o) {
    const w = o.wants,
      L = w && st.obligations && st.obligations[w.levy];
    if (!L || L.kind !== 'days' || !Obligations.isLive(L)) return 'an ask for a day names a levy';
    const hh = L.debtor.kind === 'household' ? st.households[L.debtor.id] : null;
    if (!hh || hh.holder !== o.from) return 'only the levied head asks for its days';
    if (agentOf(st, L.creditor) !== o.to) return "the day is asked of its levier's agent";
    if (!Number.isInteger(w.day) || !namedOn(L, w.day)) return 'no adult is named for that day';
    if (!(w.K >= 0)) return 'an ask for a day carries its reckoning';
    if (o.basis === 'transfer' && (!Number.isInteger(w.to) || !st.households[w.to]))
      return 'a transfer names the household';
    return {};
  }
  // A grant: by transfer where the basis asks it, or where the agent holds an ask for hands from another household of the village
  // (sim/hands); else a release; either booked as the agent's goodwill.
  function askSettle(st, o) {
    const L = st.obligations[o.wants.levy];
    if (!Obligations.isLive(L) || !namedOn(L, o.wants.day)) return 'the day is answered already';
    let to = o.basis === 'transfer' ? o.wants.to : null;
    if (to === null)
      for (const x of st.offers)
        if (
          x.basis === 'help' &&
          x.household !== L.debtor.id &&
          x.answers.some((a) => a.by === o.to && a.yes === null)
        ) {
          to = x.household;
          break;
        }
    const by = (verb, args) => issue(st, { actor: o.to, verb, target: L.id, args, source: 'planner' });
    const r =
      to !== null && by('transfer', { day: o.wants.day, to }) === true ? true : by('release', { day: o.wants.day });
    if (r !== true) return r;
    if (st.pawns[o.from].alive && st.pawns[o.to].alive) bookGoodwill(st, o.to, o.from, OUTER.worth);
    VB.count.releaseGranted++;
    return true;
  }
  const askWords = (st, o) => {
    const L = st.obligations[o.wants.levy];
    return `an ask by ${fullName(st.pawns[o.from])} to be let off a day of ${L ? L.source : 'days'} owed`;
  };
  for (const name of ['release', 'transfer'])
    VB['sim/offers'].basis(name, {
      asked: name, // by the verb ask (sim/offers)
      books: 'nothing',
      wait: () => 1,
      check: askCheck,
      answers: (st, o) => [{ key: 'agent', by: o.to, yes: null }],
      weigh: (st, o) => grants(st, st.obligations[o.wants.levy], o.to, o.from, o.wants.K, o.wants.day),
      settle: askSettle,
      what: askWords,
    });
  // ---- a debt's days unworked (design.md, A debt's days unworked; Remedies) ----
  // On the last day of a debt's year (its due before the next day's first step), its days left are not struck by a breach: what
  // remains is laid as a new year's `debt` levy by the creditor's agent (the field that passes under "labour, then land" for a debt
  // left of half a field's worth waits for the land remedy, VB-1921).
  function relay(st, o) {
    const n = Obligations.left(o),
      agent = agentOf(st, o.creditor),
      debtor = o.debtor.kind === 'household' ? st.households[o.debtor.id] : null;
    if (!(n > 1e-9) || agent === null || agent === undefined || !debtor || debtor.dissolved) return;
    const again = { debtor: o.debtor, creditor: o.creditor, days: n, due: o.due + YEAR_DAYS * DAY };
    again.source = 'debt';
    const laid =
      issue(st, {
        actor: agent,
        verb: 'levy',
        args: again,
        source: 'planner',
      }) === true;
    if (!laid) return;
    VB.count.debtRelaid++;
    Obligations.lapse(st, o.id, 'what was left is laid again as a new year of days owed');
  }
  // A day's first step, through the due-queue's outer levies (Rules for cost, 4): the days named for today come on duty (those of
  // days past are over: what was not worked stays owed and is named again); the days still unnamed are named. Then those who have
  // given their hours are told so (`dayGiven`): their working day is over, and sim/agents' rule for it (a load in hand carried to the
  // levier's store first, then home) is theirs; nobody is sent home here (VB-1749).
  function step(st) {
    const D = today(st);
    let d = st.daysToday;
    if (!d || d.day !== D) {
      d = Days.begin(st, D);
      for (const id of (st.obligationsDue || []).slice()) {
        const o = st.obligations[id];
        if (o.kind !== 'days') continue;
        VB.count.leviesLooked++;
        if (o.source === 'debt' && o.due <= (D + 1) * DAY) {
          relay(st, o);
          if (!Obligations.isLive(o)) continue;
        }
        if (o.named.length && o.named[0].day === D) keepDay(st, o, o.named[0], d.by);
        while (o.named.length && o.named[0].day <= D) {
          const e = o.named[0];
          Obligations.setLevy(st, o.id, { named: o.named.slice(1) });
          const pawn = e.day === D ? sentOf(st, o, e, d.by) : null;
          if (pawn !== null) Days.seat(st, pawn, o.id);
        }
        if (o.window && D <= o.window[1] && unnamed(st, o) > 0 && namesNow(st, o, D)) nameDays(st, o, D);
      }
    }
    for (const [id, e] of Object.entries(d.by))
      if (e[1] >= OUTER.hours - 1e-9 && !e[2]) {
        // a load on the road is brought in first, by the rule for a load in hand: the day is given once it is in (VB-1548)
        const ag = st.agents[+id];
        if (ag && ag.load > 0 && ag.job) continue;
        Days.markGiven(st, +id);
        emit(st, 'dayGiven', { pawn: +id });
      }
  }
  // The levies body party lays and bears (VB-1767), read through the actor view: {lays, bears}, each a copy with its terms.
  function leviesOf(st, party) {
    const copy = (o) => ({
      id: o.id,
      source: o.source,
      debtor: { ...o.debtor },
      creditor: { ...o.creditor },
      days: o.owes.days,
      left: Obligations.left(o),
      status: o.status,
      due: o.due,
      window: o.window && o.window.slice(),
      asked: o.asked,
      terms: { ...o.terms },
      named: o.named.map((e) => ({ ...e })),
      worked: o.worked,
    });
    return {
      lays: Obligations.due(st, party, 'creditor', 'days').map(copy),
      bears: Obligations.due(st, party, 'debtor', 'days').map(copy),
    };
  }
  return {
    step,
    OUTER,
    TERMS,
    leviesOf,
    lotsOf,
    costOf,
    keepDay,
    unnamed,
    breachCost,
    breach,
    breachWhy,
    comes,
    rowOf,
    levyOf,
    levied,
    capacity,
    fitsLess,
    PARTS,
    hours,
    tallyOf,
    leftToday,
    GIVE,
    DEMAND,
    gives,
    complies,
    takes,
    demands,
  };
})();
