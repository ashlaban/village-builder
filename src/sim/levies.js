// @sys sim/levies: the household's levy on its members (VB-1760; design.md section 7, The levy and own hours): the hours a day by season
// each member owes its household by custom (sim/customs LEVY) or contract, times its hands, compiled on the household's plan; and the
// levy left today, the head's day's capacity for a member (sim/day allot). Owns plan.levies
VB['sim/levies'] = (() => {
  const { cal, DAY, WORK, HEALTH, AGES } = VB['sim/rules'],
    { CHILD, MATCH, workRate } = VB['sim/roles'];
  const { age, spouseOf, villageOf } = VB['sim/records'];
  const { levyNorm } = VB['sim/customs'];
  const { planOf } = VB['sim/plans'];
  const { workedToday } = VB['sim/work'];
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
  return { rowOf, levyOf, levied, capacity, owedToday };
})();
