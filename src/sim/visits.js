// @sys sim/visits: the suitor's visit, planned (VB-289; design.md, Between villages: The suitor's visit): a man who found nobody to ask
//   within a day's walk at his village's round chooses the nearest village beyond it that holds a woman he could marry (seekVisit) and
//   plans a visit there by the verb `visit`; the plans wait in a due-queue and are set out in winter (visitsDue), as journeys of sim/away;
//   the villages any pawn might visit (visitChoices), a visit's state for its sheet and the played pawn's order for one (VB-292)
VB['sim/visits'] = (() => {
  const Due = VB['sim/due'],
    dueKey = (e) => e.due; // its order (sim/due): by due, after those due at the same time
  const { living } = VB['sim/records'];
  const { DAY, YEAR, SEASON_DAYS, YEAR_DAYS, WORK, HUNGER, MARRIAGE, ASK, TRAVEL } = VB['sim/rules'];
  const { on } = VB['sim/events'];
  const { log, personEvent, age, spouseOf, wasWidowed, settlementIdOf, practice, fullName, atHousehold, spokesmanOf } =
    VB['sim/records'];
  const { hoursBetween } = VB['sim/villagehours'];
  const { dailyNeed, rationOf } = VB['sim/hunger'];
  const Stores = VB['sim/stores'];
  const { travelling, stayOf, placeOf, tileAt } = VB['sim/pose'];
  const { hasRoute } = VB['sim/routes'];
  const { visit, visitDays } = VB['sim/away'];
  const { kinOk, matchScore, matchRules, meansOf, roundYear } = VB['sim/matching'];
  const { wishOf, askingIn } = VB['sim/wishes'];
  const { issue, register } = VB['sim/commands'];
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
      due = dueOf(st, hh);
    Due.append(st.visits, { pawn: id, village: v, due, household: hh.id }, due, dueKey);
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
  // Those pawn p of village v might marry who live beyond a day's walk of it and within walking reach, the nearest village first: the
  // unmarried of the other sex, of age, fed, not retired, not wishing otherwise, each {f (the pawn), fv (its village), h (the hours)}.
  // Read from the queue's part of each village beyond a day's walk (askingIn), the nearest village first, the pawns of one by id, village
  // by village as asked for, so that a visit found at the nearest is the only one read; `counted`: a visit sought at the round (visitWalk).
  function* farSingles(st, p, v, counted) {
    const far = [];
    for (let w = 0; w < st.villages.length; w++) {
      const h = w === v ? 0 : hoursBetween(st, v, w);
      if (h > TRAVEL.dayWalk && h < Infinity) far.push({ w, h });
    }
    far.sort((a, b) => a.h - b.h || a.w - b.w);
    for (const { w: fv, h } of far) {
      const cands = [];
      for (const e of askingIn(st, fv)) {
        if (counted) {
          VB.count.visitWalk++;
        }
        const f = st.pawns[e.pawn];
        if (f.sex === p.sex || !f.alive || f.retired || f.household === null || f.hunger >= HUNGER.marryBelow) continue;
        if (age(st, f) < (f.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom) || spouseOf(st, f.id) !== null)
          continue;
        if (f.wish && wishOf(st, f.id, 'match') === false) continue;
        cands.push({ f, fv, h });
      }
      cands.sort((a, b) => a.f.id - b.f.id);
      yield* cands;
    }
  }
  // Whether pawns p and q, a man and a woman, could be matched by the round's rules but for the way between them: the kin limit of the
  // man's village's custom; a home under the residence custom; the score, its noise at the mean, reaching MARRIAGE.minScore.
  function suits(st, p, q, rules) {
    const [m, f] = p.sex === 'm' ? [p, q] : [q, p],
      cu = practice(st, settlementIdOf(st, m));
    if (!kinOk(st, m.id, f.id, cu) || rules.homeFor(m, f, cu, rules.place(m.id)) === null) return false;
    const widowed = wasWidowed(st, m.id) || wasWidowed(st, f.id);
    return matchScore(st, { ...m, age: age(st, m) }, { ...f, age: age(st, f) }, 0.5, widowed) >= MARRIAGE.minScore;
  }
  // Man id found nobody he could ask at his village's round (sim/round): the nearest village beyond a day's walk and within walking reach
  // that holds a free woman he could marry (farSingles, suits), and his plan to visit it, by the verb. A man whose household cannot
  // spare the food stays, and the log says so. `rules`: the round's memos of homes and heirs (sim/matching matchRules).
  function seekVisit(st, id, rules = matchRules(st)) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      v = settlementIdOf(st, p);
    if (!hh || v === null || p.servant || st.visits.some((e) => e.pawn === id)) return;
    for (const { f, fv } of farSingles(st, p, v, true)) {
      if (!suits(st, p, f, rules)) continue;
      if (!spares(st, hh, visitDays(hoursFrom(st, hh, fv)) * rationOf(st, p))) return keptHome(st, p, hh, fv);
      const head = spokesmanOf(st, id);
      // a son or daughter of the house goes at its head's sending (VB-1168), the head weighing the hands it keeps at home
      if (head === id) issue(st, { actor: id, verb: 'visit', target: fv, source: 'round' });
      else issue(st, { actor: head, verb: 'sendVisit', target: id, args: { village: fv }, source: 'round' });
      return;
    }
  }
  // The villages pawn id might visit (VB-292; what sim/opportunities lists, for any pawn): those beyond a day's walk and within walking
  // reach that hold one it could marry (farSingles, suits), the nearest first, at most VISIT_CHOICES, each {village, days (away, there and
  // back and as a guest), rations (its pack, from its household's grain)}: the pawn's own reckoning of the way (principle 14). None for
  // one married, under age or of no household. Read-only, and not counted: it is asked for a view, never by a step.
  const VISIT_CHOICES = 5;
  function visitChoices(st, id) {
    const p = st.pawns[id],
      hh = p.household === null ? null : st.households[p.household],
      v = settlementIdOf(st, p),
      out = [];
    if (!p.alive || !hh || hh.dissolved || hh.farmstead === null || v === null || spouseOf(st, id) !== null) return out;
    if (age(st, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) return out;
    const seen = new Set();
    let rules = null;
    for (const { f, fv } of farSingles(st, p, v, false)) {
      if (seen.has(fv) || !suits(st, p, f, rules || (rules = matchRules(st)))) continue;
      seen.add(fv);
      const days = visitDays(hoursFrom(st, hh, fv));
      out.push({ village: fv, days, rations: days * rationOf(st, p) });
      if (out.length >= VISIT_CHOICES) break;
    }
    return out;
  }
  // Pawn id's visit, as its sheet shows it (VB-292): null, or {village, state: 'planned', due (the game time it sets out)}, or {village,
  // state: 'away', daysLeft: the days its pack still feeds it, which is the visitor's own estimate of the days until it is home}.
  function visitState(st, id) {
    const e = st.visits.find((x) => x.pawn === id);
    if (e) return { village: e.village, state: 'planned', due: e.due };
    const a = st.agents[id],
      j = a && a.away !== undefined ? stayOf(st, id) : null;
    if (!j || j.why !== 'visit' || j.village === undefined) return null;
    return {
      village: j.village,
      state: 'away',
      daysLeft: Math.max(1, Math.ceil(j.food / rationOf(st, st.pawns[id]) - 1e-9)),
    };
  }
  // Why head `actor` cannot send pawn id to village v (the verb `sendVisit`'s check, which holds for any pawn): it speaks for id, an
  // unmarried son or daughter of its house; another grown hand stays at home, home and not retired; and id's own visit is possible.
  function sendWhy(st, actor, id, v) {
    const q = st.pawns[id],
      h = st.pawns[actor];
    if (!q) return `there is no pawn ${id}`;
    if (id === actor || spokesmanOf(st, id) !== actor) return `${fullName(h)} does not speak for ${fullName(q)}`;
    const a = (m) => st.agents[m],
      hands = st.households[h.household].members.filter((m) => {
        const x = st.pawns[m];
        return m !== id && x.alive && !x.retired && age(st, x) >= MARRIAGE.womenFrom && a(m) && a(m).away === undefined;
      });
    if (hands.length < 1) return `${fullName(h)} cannot spare ${fullName(q)}: no other hand would stay at home`;
    return visitWhy(st, id, v);
  }
  // The played pawn plans a winter's visit (VB-292; design.md, Between villages: The player's journey), for itself or, where it speaks
  // for an unmarried son or daughter of its house (sim/records spokesmanOf), for that one: the visit is the visitor's own act, by the
  // verb `visit`, whose check holds for any pawn; at once, not queued (a plan takes no time). True, or why not.
  function orderVisit(st, who, v) {
    const pl = st.player,
      q = st.pawns[who];
    if (!pl) return 'no pawn is played';
    if (!q) return `there is no pawn ${who}`;
    if (who !== pl.pawn && spokesmanOf(st, who) !== pl.pawn)
      return `${fullName(st.pawns[pl.pawn])} does not speak for ${fullName(q)}`;
    if (who !== pl.pawn)
      return issue(st, { actor: pl.pawn, verb: 'sendVisit', target: who, args: { village: v }, source: 'player' });
    return issue(st, { actor: who, verb: 'visit', target: v, source: 'player' });
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
      // the table's hours are green to green: from where he stands the way may lie beyond the route search's reach (VB-436), and he does not
      // set out to walk it straight
      if (!hasRoute(st, tileAt(st, ...placeOf(st, a)), st.villages[e.village].center)) {
        VB.count.visitNoRoute++;
        continue;
      }
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
    // one married while on the road (the round's match, made while away) arrives a guest, but courts no more (the invariant: no
    // visited kept by one married)
    if (spouseOf(st, d.pawn) === null) st.pawns[d.pawn].visited = { village: d.village, year: roundYear(st.t) };
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
  // visit(village) (VB-289; design.md, Between villages: The suitor's visit): an unmarried pawn plans a winter's visit to a village beyond
  // a day's walk, there and back on its household's food; it sets out on its winter morning (sim/visits)
  register('visit', {
    check: (st, c) => living(st, c.actor) || visitWhy(st, c.actor, c.target),
    run: (st, c) => planVisit(st, c.actor, c.target),
  });
  // sendVisit(son or daughter; args.village) (VB-1168): a head sends an unmarried child of its house on a winter's visit: the head's
  // choice, which every head makes at the round (seekVisit); the visit is then planned as the child's own
  register('sendVisit', {
    check: (st, c) => living(st, c.actor) || sendWhy(st, c.actor, c.target, c.args.village),
    run: (st, c) => planVisit(st, c.target, c.args.village),
  });
  return { visitWhy, sendWhy, planVisit, seekVisit, visitsDue, visitChoices, visitState, orderVisit };
})();
