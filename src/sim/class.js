// @sys sim/class [social]: a household's class, a view the simulation does not store as truth (VB-318; design.md, Households and other bodies:
// Class): by land (tenant, cottager, peasant: derived at each read from the fields it works and owns) and by livelihood (elite, landed: held
// with hysteresis, the counts of years running, from the year's income from others and from land against the household's need). It feeds no
// rule: what elite stood for acts through two rule contributions, each reading the measure behind it (a year's income from others against
// the year's need), never the label.
VB['sim/class'] = (() => {
  const { YEAR_DAYS } = VB['sim/rules'];
  const Rules = VB['sim/registry'];
  const { on, emit } = VB['sim/events'];
  const Own = VB['sim/ownership'];
  const Fields = VB['sim/fields'];
  const { dailyNeed } = VB['sim/hunger'];
  // @tunable CLASS: the livelihood's cut points (Kim, 15 Nov: 1.25 in, 0.75 out "for now"), as shares of a year's need; `years`, the year
  // ends running a count takes to turn; `prio`, the holder's priority for field work (of 10) at the level that made a household elite;
  // `standing`, the standing it adds there (VB-318, Kim 11 Nov).
  const CLASS = { eliteIn: 1.25, eliteOut: 0.75, years: 3, prio: 2, standing: 0.2 };
  // @state household.livelihood: absent until the household first takes in or pays what counts, else {elite, landed (the hysteresis counts of elite
  //   and landed: 0..years-1 the years running toward, years..2*years-1 on, and that many minus years the years running under), rent, keep,
  //   interest, hours, wages (the year's parts, in rations, since the village's last meeting), last (the year before's parts, with its need,
  //   m (its income from others in shares of its need) and ml (its income from land), or null)}. Written only here, at the village's autumn
  //   meeting (VB-318: a village a step).
  // @notstock household.livelihood: the year's income in rations and counts of years, not goods held (what moved is in sim/stores' ledgers)
  const lv = (hh) =>
    hh.livelihood ||
    (hh.livelihood = { elite: 0, landed: 0, rent: 0, keep: 0, interest: 0, hours: 0, wages: 0, last: null });
  // A count's next value after a year's measure m: off, it counts the years at or above `in` and turns on at `years` running; on, it counts the
  // years under `out` and turns off at `years` running.
  function step(n, m) {
    const Y = CLASS.years;
    if (n >= Y) return m < CLASS.eliteOut ? (n + 1 >= 2 * Y ? 0 : n + 1) : Y;
    return m >= CLASS.eliteIn ? (n + 1 >= Y ? Y : n + 1) : 0;
  }
  const isElite = (hh) => !!hh.livelihood && hh.livelihood.elite >= CLASS.years;
  const isLanded = (hh) => !!hh.livelihood && hh.livelihood.landed >= CLASS.years;
  const partsOf = (L) => ({
    others: L.rent + L.keep + L.interest + L.hours - L.wages,
    land: L.rent + L.hours - L.wages,
  });
  // The year's income so far: from others and from land, in rations (the parts are the household's own, in `livelihood`).
  const incomeOf = (hh) => (hh.livelihood ? partsOf(hh.livelihood) : { others: 0, land: 0 });
  // The measure behind what elite stood for: the household's income from others last year in shares of its need (0 before the first year).
  const measureOf = (hh) => (hh.livelihood && hh.livelihood.last ? Math.max(0, hh.livelihood.last.m) : 0);
  // The class by land: fields worked (those of its farm whose user it is, and of farms it holds a use of) against fields owned.
  function byLand(st, hh) {
    if (hh.dissolved || hh.farmstead === null) return null;
    const farms = new Set([hh.farmstead]);
    if (st.titles)
      for (const t of st.titles.values())
        if (t.user && t.user.type === 'household' && t.user.id === hh.id) farms.add(t.farm);
    let worked = 0;
    for (const id of farms) for (const fd of st.farmsteads[id].fields) if (st.owner[fd.tile] === hh.id + 1) worked++;
    const owned = Own.fieldsOwned(st, hh.id);
    return {
      worked,
      owned,
      name: worked > owned ? 'tenant' : worked <= 1 ? 'cottager' : owned * 2 > worked ? 'peasant' : 'tenant',
    };
  }
  // The class of household hh: {land: 'tenant'|'cottager'|'peasant', elite, landed, worked, owned, m, ml, parts}. Read, never stored.
  function classOf(st, hh) {
    const lb = byLand(st, hh),
      L = hh.livelihood;
    return {
      land: lb ? lb.name : null,
      worked: lb ? lb.worked : 0,
      owned: lb ? lb.owned : 0,
      elite: isElite(hh),
      landed: isLanded(hh),
      m: L && L.last ? L.last.m : 0,
      ml: L && L.last ? L.last.ml : 0,
      parts: L && L.last ? L.last : null,
    };
  }
  // ---- the year's income, booked as it comes (events: the payments, the sheaves, the keep) ----
  const hhOf = (st, party) =>
    party.kind === 'household' && !st.households[party.id].dissolved ? st.households[party.id] : null;
  // A rent paid, the interest of a loan repaid, and a wage paid: the part of a payment that is income (the loan's grain lent is not).
  on('paid', (st, { o, part }) => {
    if (o.kind === 'rent' || o.kind === 'loan') {
      const hh = hhOf(st, o.creditor);
      if (!hh) return;
      if (o.kind === 'rent') lv(hh).rent += part;
      else if (o.lent > 0 && o.owes.rations > o.lent) lv(hh).interest += part * (1 - o.lent / o.owes.rations);
    } else if (o.kind === 'wage') {
      const hh = hhOf(st, o.debtor);
      if (hh) lv(hh).wages += part;
    }
  });
  // The alderman's household was given its keep in grain (sim/keep).
  on('keepGrain', (st, { hh, n }) => {
    if (!hh.dissolved) lv(hh).keep += n;
  });
  // A load of sheaves into a barn: on a field the household owns and works, the share of the year's work hours that hands not of its own gave
  // (sim/fields' hoursOther against hoursOwn) is income from others, and from land.
  on('sheavesIn', (st, { hh, field, n }) => {
    const total = (field.hoursOwn || 0) + (field.hoursOther || 0);
    if (!(field.hoursOther > 0) || !(total > 0)) return;
    const o = Own.ownerOf(st, field.tile);
    if (!o || o.type !== 'household' || o.id !== hh.id) return;
    lv(hh).hours += (n * field.hoursOther) / total;
  });
  // ---- the year's reckoning, at a village's autumn meeting ----
  VB.counter('classReckoned', "Households' livelihoods reckoned at their village's meeting (sim/class, VB-318)");
  function reckon(st, hh) {
    VB.count.classReckoned++;
    const L = lv(hh),
      need = dailyNeed(st, hh) * YEAR_DAYS,
      { others, land } = partsOf(L);
    const m = need > 0 ? others / need : 0,
      ml = need > 0 ? land / need : 0;
    L.elite = step(L.elite, m);
    L.landed = step(L.landed, ml);
    L.last = { rent: L.rent, keep: L.keep, interest: L.interest, hours: L.hours, wages: L.wages, need, m, ml };
    L.rent = L.keep = L.interest = L.hours = L.wages = 0;
    for (const fd of st.farmsteads[hh.farmstead].fields) Fields.book(fd, null);
  }
  // Village s's meeting: each live household of its farms reckons its year, and the standing of its holders follows (sim/society).
  function meeting(st, s) {
    const out = [];
    for (const fid of st.villages[s.id].farmsteads) {
      const id = st.farmsteads[fid].household;
      if (id === null || st.households[id].dissolved) continue;
      reckon(st, st.households[id]);
      out.push(st.households[id]);
    }
    emit(st, 'livelihood', { households: out });
  }
  // ---- what elite stood for, as contributions to the rules that read the measure (never the label) ----
  // The holder's priority for field work (sim/fit): from its role's, falling with the measure to CLASS.prio of 10 at CLASS.eliteIn.
  Rules.contribute({
    rule: 'fieldPrio',
    source: 'sim/class',
    key: 'others',
    label: 'Others work its land and pay it',
    tunables: ['CLASS.eliteIn', 'CLASS.prio'],
    range: [0, 1],
    value: (st, c) => {
      const m = measureOf(c.hh);
      if (!(m > 0) || !(c.pr > CLASS.prio)) return 1;
      return (c.pr + (CLASS.prio - c.pr) * Math.min(1, m / CLASS.eliteIn)) / c.pr;
    },
  });
  // The standing of a holder (sim/society): up to CLASS.standing at the measure that made a household elite.
  Rules.contribute({
    rule: 'standing.livelihood',
    source: 'sim/class',
    key: 'others',
    label: 'Lives on others',
    tunables: ['CLASS.eliteIn', 'CLASS.standing'],
    value: (st, c) => CLASS.standing * Math.min(1, measureOf(c.hh) / CLASS.eliteIn),
  });
  return { CLASS, classOf, incomeOf, measureOf, isElite, isLanded, meeting, reckon };
})();
