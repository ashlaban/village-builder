// @sys sim/visits: the suitor's visit, planned (VB-289; design.md, Between villages: The suitor's visit): a man who found nobody to ask
//   within a day's walk at his village's round chooses the nearest village beyond it that holds a woman he could marry (seekVisit) and
//   plans a visit there by the verb `visit`; the plans wait in a due-queue and are set out in winter (visitsDue), as journeys of sim/away
VB['sim/visits'] = (() => {
  const { DAY, YEAR, SEASON_DAYS, YEAR_DAYS, WORK, HUNGER, MARRIAGE, ASK, TRAVEL } = VB['sim/rules'];
  const { on } = VB['sim/events'];
  const { log, personEvent, age, spouseOf, wasWidowed, settlementIdOf, practice, fullName, atHousehold } =
    VB['sim/records'];
  const { hoursBetween } = VB['sim/routes'];
  const { dailyNeed, rationOf } = VB['sim/hunger'];
  const Stores = VB['sim/stores'];
  const { travelling } = VB['sim/agents'];
  const { visit, visitDays } = VB['sim/away'];
  const { kinOk, matchScore, matchRules, meansOf, roundYear } = VB['sim/matching'];
  const { wishOf } = VB['sim/wishes'];
  const { issue } = VB['sim/commands'];
  const WINTER = 3,
    SPREAD = 6; // the days from winter's first over which the visits planned at the round set out, by household (Rules for cost, 5)
  // @state st.visits[]: the visits planned and not yet set out, in the order of `due`, then of planning: {pawn, village, due, household}:
  //   who goes, where, the game time he sets out (a 6:00 in winter) and the household he was of when he planned it, which gives his
  //   pack; at most one a pawn. Plain data, saved; a save without it has none. Read from its head at 6:00 (visitsDue).
  // The first day of this year's moving round, at 0:00: a visit is planned from then on, for the winter that follows it.
  const roundStart = (t) => Math.floor(t / YEAR) * YEAR + (2 * SEASON_DAYS + ASK.day) * DAY;
  // When a visit planned now by a pawn of household hh sets out: 6:00 of winter day 1 + (the household's id mod SPREAD), or the next 6:00
  // if that is past.
  function dueOf(st, hh) {
    const d = Math.floor(st.t / YEAR) * YEAR + (WINTER * SEASON_DAYS + (hh.id % SPREAD)) * DAY + WORK[0];
    if (d >= st.t) return d;
    const day = Math.floor(st.t / DAY) * DAY + WORK[0];
    return day >= st.t ? day : day + DAY;
  }
  // Whether household hh can give `rations` for a visit: from its grain above its seed (the pack is taken there, sim/away provide), and
  // keeping the means to marry (sim/matching meansOf: a home of fewer than two adults is asked for none).
  function spares(st, hh, rations) {
    const grain = rations / st.ECON.uncooked;
    if (Math.max(0, Stores.grainOf(hh) - Stores.reserved(st, hh, 'grain')) + 1e-9 < grain) return false;
    const m = meansOf(st, hh.id);
    return m.exempt || m.held - grain / (YEAR_DAYS * (dailyNeed(st, hh) + st.ECON.ration.adult)) >= m.asked;
  }
  const hoursFrom = (st, hh, v) => hoursBetween(st, st.farmsteads[hh.farmstead].village, v);
  // Why pawn id cannot plan a visit to village v now (the verb `visit`'s check, which holds for any pawn), or null: it is unmarried, of
  // age to marry, not retired, in no service, of a household that has a farm (it may be out on an errand now: the plan is for winter);
  // the village lies beyond a day's walk and within
  // walking reach; it is the moving round or later in the year; it has planned no visit and made none since the last round; and its
  // household can spare the visit's food above its seed and its means.
  function visitWhy(st, id, v) {
    const p = st.pawns[id],
      nm = fullName(p),
      hh = p.household === null ? null : st.households[p.household];
    if (spouseOf(st, id) !== null) return `${nm} is married`;
    if (age(st, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) return `${nm} is too young to marry`;
    if (p.retired) return `${nm} is retired`;
    if (p.servant) return `${nm} is in service`;
    if (!hh || hh.dissolved || hh.farmstead === null) return `${nm} has no home to go out from`;
    if (!Number.isInteger(v) || !st.villages[v]) return `there is no village ${v}`;
    const hours = hoursFrom(st, hh, v);
    if (!(hours < Infinity)) return `${st.villages[v].name} lies beyond walking reach`;
    if (!(hours > TRAVEL.dayWalk)) return `${st.villages[v].name} lies within a day's walk: it needs no visit`;
    if (st.t < roundStart(st.t)) return 'a visit is made in winter, and planned from the moving round on';
    if (st.visits.some((e) => e.pawn === id)) return `${nm} has planned a visit already`;
    if (p.visited && p.visited.year === roundYear(dueOf(st, hh))) return `${nm} has made this winter's visit`;
    if (!spares(st, hh, visitDays(hours) * rationOf(st, p)))
      return `${st.farmsteads[hh.farmstead].name} cannot spare the food for the visit`;
    return null;
  }
  // Pawn id plans a visit to village v (the verb `visit`, its only caller): the plan waits in st.visits for its winter morning.
  function planVisit(st, id, v) {
    const hh = st.households[st.pawns[id].household],
      due = dueOf(st, hh),
      q = st.visits;
    let k = q.length;
    while (k > 0 && q[k - 1].due > due) k--;
    q.splice(k, 0, { pawn: id, village: v, due, household: hh.id });
  }
  // The log's line for a man kept home by his household's food (once a man a year: at the round, or on the morning he would have gone).
  function keptHome(st, p, hh, v) {
    const farm = st.farmsteads[hh.farmstead].name;
    log(
      st,
      `${fullName(p)} of ${farm} stays home this winter: the farm cannot spare the food for a visit to ${st.villages[v].name}.`,
      { kind: 'visitOff', pawn: p.id, ...atHousehold(st, hh) },
    );
  }
  // Man id found nobody he could ask at his village's round (sim/round): the nearest village beyond a day's walk and within walking reach
  // that holds a free woman he could marry (unmarried, of age, fed, not retired, not wishing otherwise; the kin limit of his village's
  // custom; a home under the residence custom; the score, its noise at the mean, reaching MARRIAGE.minScore), and his plan to visit it,
  // by the verb. The unmarried women are read from the asking queue (visitWalk), as an asking reads them. A man whose household cannot
  // spare the food stays, and the log says so. `rules`: the round's memos of homes and heirs (sim/matching matchRules).
  function seekVisit(st, id, rules = matchRules(st)) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      v = settlementIdOf(st, p);
    if (!hh || v === null || p.servant || st.visits.some((e) => e.pawn === id)) return;
    const cands = [];
    for (const e of st.asking) {
      VB.count.visitWalk++;
      const f = st.pawns[e.pawn];
      if (f.sex !== 'f' || !f.alive || f.retired || f.household === null || f.hunger >= HUNGER.marryBelow) continue;
      if (age(st, f) < MARRIAGE.womenFrom || spouseOf(st, f.id) !== null) continue;
      if (f.wish && wishOf(st, f.id, 'match') === false) continue;
      const fv = settlementIdOf(st, f),
        h = fv === null || fv === v ? 0 : hoursBetween(st, v, fv);
      if (h > TRAVEL.dayWalk && h < Infinity) cands.push({ f, fv, h });
    }
    cands.sort((a, b) => a.h - b.h || a.fv - b.fv || a.f.id - b.f.id);
    const cu = practice(st, v),
      pm = rules.place(id),
      me = { ...p, age: age(st, p) };
    for (const { f, fv } of cands) {
      if (!kinOk(st, id, f.id, cu) || rules.homeFor(p, f, cu, pm) === null) continue;
      const widowed = wasWidowed(st, id) || wasWidowed(st, f.id);
      if (matchScore(st, me, { ...f, age: age(st, f) }, 0.5, widowed) < MARRIAGE.minScore) continue;
      if (!spares(st, hh, visitDays(hoursFrom(st, hh, fv)) * rationOf(st, p))) return keptHome(st, p, hh, fv);
      issue(st, { actor: id, verb: 'visit', target: fv, source: 'round' });
      return;
    }
  }
  // Daily at 6:00: the visits due, from the head of the queue (Rules for cost, 4). A plan is dropped where its man has died, married,
  // retired, changed household (he took a farm, his home dissolved) or is away; one whose household can no longer spare the food, or who
  // is hungry himself, stays home, and the log says so; else he sets out (sim/away visit).
  function visitsDue(st) {
    while (st.visits.length && st.visits[0].due <= st.t) {
      const e = st.visits.shift(),
        p = st.pawns[e.pawn],
        a = st.agents[e.pawn],
        hh = st.households[e.household];
      if (!p.alive || spouseOf(st, p.id) !== null || p.retired || p.servant || p.household !== e.household) continue;
      if (hh.dissolved || !a || a.away !== undefined || travelling(a)) continue;
      const hours = hoursFrom(st, hh, e.village);
      if (!(hours > TRAVEL.dayWalk && hours < Infinity)) continue; // the way has changed since (the table is a year's)
      if (!(p.hunger < HUNGER.marryBelow) || !spares(st, hh, visitDays(hours) * rationOf(st, p))) {
        keptHome(st, p, hh, e.village);
        continue;
      }
      visit(st, a, e.village);
    }
  }
  // @state pawn.visited: null, or {village, year}: the village the pawn last visited, and the year of the moving round the visit followed
  //   (sim/matching roundYear at its arrival), so that it counts until the next round is over (sim/matching reads it); overwritten by the
  //   next visit, cleared at its marriage and its death
  // The visitor has arrived at the other village's green (sim/away): the visit is his, and on his record.
  on('visited', (st, d) => {
    st.pawns[d.pawn].visited = { village: d.village, year: roundYear(st.t) };
    VB.count.visits++;
    const name = st.villages[d.village].name;
    personEvent(st, d.pawn, 'visited', `Visited ${name}, its guest for a day`, { village: d.village });
  });
  on('wed', (st, d) => {
    st.pawns[d.a].visited = st.pawns[d.b].visited = null;
  });
  on('died', (st, d) => {
    st.pawns[d.pawn].visited = null;
  });
  return { visitWhy, planVisit, seekVisit, visitsDue };
})();
