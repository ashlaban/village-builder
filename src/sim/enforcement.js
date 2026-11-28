// @sys sim/enforcement [agency]: a loan defaulted ends somewhere (VB-315; design.md, Loans, obligations and cases: Pressing; Cases at the
// meeting; Remedies; Partial failure; target-v2 4.5): on its planning day the creditor's holder presses, extends a year or forgives it
// (the verbs press, extend, forgive); a debt pressed is a case on the agenda of the debtor's village's next meeting, heard there by the
// village's practice (sim/decisions); upheld, the debtor household owes days of work (an outer levy of source `debt`, sim/levies), each
// day worked or commuted booked against the loan; not upheld, the loan is extended a year and its creditor's holder remembers it. Land
// as a remedy is VB-316's.
VB['sim/enforcement'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/enforcement', {
    debtPressed: {}, // a debt defaulted pressed by its creditor
    debtExtended: {}, // a debt defaulted extended a year, by its creditor or a hearing
    debtForgiven: {}, // a debt defaulted forgiven by its creditor
    case: {}, // a case heard at a village's meeting, and its ruling
  });
  const Obligations = VB['sim/obligations'];
  const { register, issue } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  const { YEAR, YEAR_DAYS } = VB['sim/rules'];
  const { dailyNeed } = VB['sim/hunger'];
  const { opinionOf, remember, book } = VB['sim/relations'];
  const Traits = VB['sim/traits'];
  const { inForce, IDX, OFF } = VB['sim/customs'];
  const { defineKind, ask } = VB['sim/decisions'];
  const { personEvent, log, fullName, atHousehold, holdingOf, unplanned, voiceOf } = VB['sim/records'];
  const { OUTER } = VB['sim/days'];
  const { SOCIAL } = VB['sim/ties'];
  const { harvestAfter } = VB['sim/loans'];
  // @tunable CASE: pressing and hearing a debt (design.md, Pressing; Cases at the meeting). The creditor's holder weighs debt × (the debt
  // left over its own household's year's need) + ambition × (its ambition − 0.5) − opinion × (its opinion of the debtor's holder): it
  // presses above `press`, forgives below `forgive`, and extends a year between. A voice upholds when base + its opinion of the
  // creditor's holder − its opinion of the debtor's − owing (its household owes a debt itself) + leaning × (its attitude to "land" less
  // that to "labour" on "Debts are paid with") is above 0. The agent's starting values (VB-315), not measured.
  const CASE = { debt: 2, ambition: 1, opinion: 1, press: 0, forgive: -0.3, base: 0.1, owing: 0.3, leaning: 1 };
  // the memory a creditor's holder keeps of a debtor whose debt it was refused at a hearing, or that lapsed with its household
  Object.assign(SOCIAL.memories, {
    debtUnpaid: { label: 'Left a debt to us unpaid', v: -0.15, cap: -0.45, days: 3 * YEAR_DAYS },
  });
  // @state st.cases: the debts pressed and not yet heard, absent until the first: [{loan (the id of a loan defaulted, sim/obligations),
  //   by (the pawn who pressed it), since (the hour)}], one a loan, in the order pressed. Heard at the debtor's village's meeting and
  //   dropped there, or when the loan closes (forgiven, paid, lapsed). Written only here.
  const cases = (st) => st.cases || (st.cases = []);
  const caseOf = (st, id) => (st.cases ? st.cases.find((c) => c.loan === id) : undefined);
  function drop(st, id) {
    if (!st.cases) return;
    const at = st.cases.findIndex((c) => c.loan === id);
    if (at >= 0) st.cases.splice(at, 1);
  }
  const hhName = (st, hh) => st.farmsteads[hh.farmstead].name;
  const villageOfHh = (st, hh) => (hh.farmstead === null ? null : st.farmsteads[hh.farmstead].village);
  // The pawn who acts for a party: a household's holder, a village's alderman; null for none living
  function agentFor(st, party) {
    const id =
      party.kind === 'household'
        ? st.households[party.id] && !st.households[party.id].dissolved
          ? st.households[party.id].holder
          : null
        : party.kind === 'village' && st.villages[party.id] && st.villages[party.id].alderman !== undefined
          ? st.villages[party.id].alderman
          : null;
    return id !== null && id !== undefined && st.pawns[id].alive ? id : null;
  }
  const nameOfParty = (st, party) =>
    party.kind === 'village' ? `${st.villages[party.id].name}'s store` : hhName(st, st.households[party.id]);
  // The debtor household's holder, or null
  const debtorHolder = (st, o) => {
    const hh = st.households[o.debtor.id];
    return hh && !hh.dissolved && hh.holder !== null && st.pawns[hh.holder].alive ? hh.holder : null;
  };
  // The days owed that work off loan o (sim/levies' levies of source `debt` with o's id), live
  const levies = (st, o) => Obligations.due(st, o.creditor, 'creditor', 'days').filter((x) => x.debt === o.id);
  // A loan defaulted waits for its creditor's choice: no case pressed, no levy of its days still running (one overdue, its year over
  // with days unworked, goes back to the choice: design.md, Remedies)
  const waiting = (st, o) =>
    o.status === 'defaulted' && !caseOf(st, o.id) && !levies(st, o).some((x) => x.status !== 'overdue');
  const isDebt = (st, id) => !!(st.obligations && st.obligations[id] && st.obligations[id].kind === 'loan');
  // Why pawn `actor` may not choose for loan id now (press, extend), or null
  function choiceWhy(st, actor, id) {
    const o = isDebt(st, id) ? st.obligations[id] : null;
    if (!o || o.status !== 'defaulted') return `there is no loan ${id} defaulted`;
    if (agentFor(st, o.creditor) !== actor) return 'only the one who acts for the creditor chooses';
    if (!waiting(st, o)) return 'the debt is pressed already';
    const hh = st.households[o.debtor.id];
    if (!hh || hh.dissolved || villageOfHh(st, hh) === null) return 'the household that owes it is gone';
    return null;
  }
  VB.counter('debtsPressed', 'Debts defaulted pressed by their creditors, a case each (sim/enforcement, VB-315)');
  VB.counter(
    'debtsExtended',
    'Debts defaulted extended a year, by their creditors or a hearing (sim/enforcement, VB-315)',
  );
  VB.counter('debtsForgiven', 'Debts defaulted forgiven by their creditors (sim/enforcement, VB-315)');
  VB.counter(
    'debtsWeighed',
    "Loans defaulted weighed at their creditor's holder's planning day (sim/enforcement, VB-315)",
  );
  // An event's detail: the debt left, at the debtor's household
  const at = (st, o) => ({ n: Math.round(Obligations.left(o)), ...atHousehold(st, st.households[o.debtor.id]) });
  // press(target: a loan defaulted): a case on the agenda of the debtor's village's next meeting
  register('press', {
    check: (st, c) => choiceWhy(st, c.actor, c.target),
    run: (st, c) => {
      const o = st.obligations[c.target];
      cases(st).push({ loan: o.id, by: c.actor, since: st.t });
      VB.count.debtsPressed++;
      const debt = `${Math.round(Obligations.left(o))} grain`,
        text = `Pressed ${hhName(st, st.households[o.debtor.id])} for a debt of ${debt}, to be heard at its village's meeting`;
      personEvent(st, c.actor, 'debtPressed', text, at(st, o));
    },
  });
  // The loan extended a year: due again at the first harvest at least half a year on, defaulted if unpaid there
  function extendLoan(st, o) {
    Obligations.extend(st, o.id, harvestAfter(st.t + YEAR / 2));
    VB.count.debtsExtended++;
  }
  // extend(target: a loan defaulted): its creditor's agent gives it a year more
  register('extend', {
    check: (st, c) => choiceWhy(st, c.actor, c.target),
    run: (st, c) => {
      const o = st.obligations[c.target];
      extendLoan(st, o);
      const text = `Gave ${hhName(st, st.households[o.debtor.id])} a year more to repay ${Math.round(Obligations.left(o))} grain`;
      personEvent(st, c.actor, 'debtExtended', text, at(st, o));
    },
  });
  // forgive(target: a loan defaulted), through sim/levies' verb: its creditor's agent lets the debt go, its worth booked as goodwill to
  // its credit with the debtor's holder (The gift)
  function forgiveWhy(st, c) {
    const o = st.obligations[c.target];
    if (o.status !== 'defaulted') return `there is no loan ${o.id} defaulted`;
    return agentFor(st, o.creditor) === c.actor ? null : 'only the one who acts for the creditor forgives';
  }
  function forgiveDebt(st, c) {
    const o = st.obligations[c.target],
      n = Obligations.left(o),
      dh = debtorHolder(st, o),
      name = hhName(st, st.households[o.debtor.id]);
    drop(st, o.id);
    for (const x of levies(st, o)) Obligations.lapse(st, x.id, 'the debt they worked off was forgiven');
    Obligations.forgive(st, o.id, c.actor);
    if (dh !== null && dh !== c.actor && n > 0) book(st, c.actor, dh, n);
    VB.count.debtsForgiven++;
    personEvent(st, c.actor, 'debtForgiven', `Forgave ${name} a debt of ${Math.round(n)} grain`, {
      n: Math.round(n),
      other: dh,
      ...atHousehold(st, st.households[o.debtor.id]),
    });
  }
  // The creditor's holder's choice for loan o (design.md, Pressing): the verb it issues
  function choose(st, by, o) {
    const dh = debtorHolder(st, o),
      own = holdingOf(st, by),
      need = own ? dailyNeed(st, own) * YEAR_DAYS : 0,
      left = Obligations.left(o),
      x =
        CASE.debt * (need > 0 ? left / need : 1) +
        CASE.ambition * (Traits.of(st, by, 'ambition') - 0.5) -
        CASE.opinion * (dh !== null ? opinionOf(st, by, dh) : 0);
    return x > CASE.press ? 'press' : x < CASE.forgive ? 'forgive' : 'extend';
  }
  // At a household's planning day its holder chooses for each loan defaulted it is owed, and, as alderman, for its village store's
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || !st.obligationsBy) return;
    const hh = st.households[d.plan.holder.id],
      by = hh.holder;
    if (hh.dissolved || by === null || !st.pawns[by].alive || unplanned(st, by)) return;
    const v = villageOfHh(st, hh),
      owed = [{ kind: 'household', id: hh.id }];
    if (v !== null && st.villages[v].alderman === by) owed.push({ kind: 'village', id: v });
    for (const party of owed)
      for (const o of Obligations.due(st, party, 'creditor', 'loan')) {
        if (o.status !== 'defaulted') continue;
        VB.count.debtsWeighed++;
        if (choiceWhy(st, by, o.id) === null)
          issue(st, { actor: by, verb: choose(st, by, o), target: o.id, args: {}, source: 'planner' });
      }
  });
  // ---- the hearing (design.md, Cases at the meeting) ----
  VB.counter('casesHeard', "Cases heard at a village's meeting (sim/enforcement, VB-315)");
  VB.counter('casesUpheld', "Cases upheld at a village's meeting (sim/enforcement, VB-315)");
  VB.counter(
    'caseBallots',
    "Voices weighed on a case at a village's meeting, at most its voices a case (sim/enforcement, VB-315)",
  );
  // Pawn id's leaning on case q: above 0 it upholds
  function lean(st, id, q) {
    const p = st.pawns[id],
      k = OFF[IDX.debtsPaid];
    let x = CASE.base + CASE.leaning * (p.att[k + 2] - p.att[k]);
    if (id === q.creditor) x += 1;
    else if (q.creditor !== null) x += opinionOf(st, id, q.creditor);
    if (id === q.debtor) x -= 1;
    else if (q.debtor !== null) x -= opinionOf(st, id, q.debtor);
    if (p.household !== null && Obligations.due(st, { kind: 'household', id: p.household }, 'debtor').length)
      x -= CASE.owing;
    return x;
  }
  defineKind('case', {
    procedure: 'vote',
    procedureOf: (st, body) => (inForce(st, 'judges', body) === 'alderman' ? 'agent' : 'vote'),
    // options: 0 not upheld (extended), 1 upheld; each voice one ballot
    evaluate: (st, q) => {
      const S = [0, 0];
      for (const id of q.voices) {
        VB.count.caseBallots++;
        S[lean(st, id, q) > 0 ? 1 : 0]++;
      }
      return { support: S, need: [0, 0] };
    },
    choose: (st, q, p) => (lean(st, p, q) > 0 ? 1 : 0),
    fallback: () => 0, // no alderman to break the tie: extended
  });
  // The days of work a debt of n rations is worth: a day for each OUTER.worth (3) rations, the last part counted whole
  const daysFor = (n) => Math.ceil(n / OUTER.worth - 1e-9);
  VB.counter('debtDaysOwed', 'Days of work owed for debts upheld at a hearing (sim/enforcement, VB-315)');
  // Upheld: the debtor household owes days of work to the creditor within a year (an outer levy of source `debt`, asked by the
  // creditor's holder by season). "Debts are paid with" land, and labour then land, take a field only through VB-316; until then, and
  // where no field can be taken (Partial failure), what is owed stands as labour. True when laid.
  function remedy(st, o) {
    const by = agentFor(st, o.creditor),
      days = daysFor(Obligations.left(o));
    if (by === null || !(days > 0)) return false;
    for (const x of levies(st, o)) Obligations.lapse(st, x.id, 'laid anew at the hearing');
    const r = issue(st, {
      actor: by,
      verb: 'levy',
      args: { debtor: o.debtor, creditor: o.creditor, source: 'debt', days, due: st.t + YEAR, debt: o.id },
      source: 'planner',
    });
    if (r !== true) return false;
    VB.count.debtDaysOwed += days;
    return days;
  }
  // Village s's cases, at its meeting (sim/meetings, before its alderman's office is settled): each debt pressed whose debtor lives in
  // it, put to its voices (those of `people` with a voice, the parties' households standing aside unless "One's own cause" lets them
  // vote) or to its alderman. The lines for the meeting log.
  function hear(st, s, people) {
    if (!st.cases || !st.cases.length) return [];
    const out = [];
    for (const c of st.cases.slice()) {
      const o = st.obligations[c.loan];
      if (o.status !== 'defaulted') {
        drop(st, o.id);
        continue;
      }
      const hh = st.households[o.debtor.id];
      if (villageOfHh(st, hh) !== s.id) continue;
      drop(st, o.id);
      const creditor = agentFor(st, o.creditor),
        debtor = debtorHolder(st, o),
        aside = inForce(st, 'ownCause', s.id) === 'aside',
        parties = new Set([o.debtor.id, o.creditor.kind === 'household' ? o.creditor.id : -1]),
        voices = people
          .filter((p) => voiceOf(st, p, s) > 0 && !(aside && p.household !== null && parties.has(p.household)))
          .map((p) => p.id);
      const upheld =
        ask(st, { kind: 'case', body: s.id, current: null, options: 2, loan: o.id, creditor, debtor, voices }) === 1;
      VB.count.casesHeard++;
      const b = st.decisionLog && st.decisionLog[0],
        votes = b && b.kind === 'case' && b.procedure === 'vote' ? `, by ${b.support[1]} to ${b.support[0]}` : '',
        who = creditor !== null ? `${fullName(st.pawns[creditor])}'s` : `${nameOfParty(st, o.creditor)}'s`,
        against = debtor !== null ? fullName(st.pawns[debtor]) : hhName(st, hh);
      let days = upheld ? remedy(st, o) : false,
        txt;
      if (days) {
        VB.count.casesUpheld++;
        const unpaid = Math.round(Obligations.left(o));
        txt =
          `At the ${s.name} meeting: ${who} case against ${against} was upheld${votes}; ` +
          `${hhName(st, hh)} owes ${days} days of work for the ${unpaid} grain unpaid.`;
      } else {
        extendLoan(st, o);
        if (creditor !== null && debtor !== null) remember(st, creditor, debtor, 'debtUnpaid');
        const ruled = upheld ? 'upheld, with none to call the days' : 'not upheld';
        txt = `At the ${s.name} meeting: ${who} case against ${against} was ${ruled}${votes}; the debt is extended a year.`;
      }
      log(st, txt, { kind: 'case', pawn: creditor, other: debtor, n: days || 0, ...atHousehold(st, hh) });
      out.push(txt);
    }
    return out;
  }
  // ---- the days worked off (design.md, Remedies: each hour is booked against the debt) ----
  VB.counter(
    'debtDaysGiven',
    'Days of work given against a debt, worked or commuted, in days (sim/enforcement, VB-315)',
  );
  Obligations.onPaid('days', (st, x, n, why) => {
    if (x.debt === undefined) return;
    const o = st.obligations[x.debt];
    VB.count.debtDaysGiven += n;
    if (!Obligations.isLive(o)) return;
    const r = Math.min(n * OUTER.worth, Obligations.left(o));
    if (r > 0) Obligations.fulfil(st, o.id, r, why === 'days worked' ? 'debt worked' : 'debt commuted');
  });
  // A loan paid in part, by its days or in grain: its days owed at most what is left of it is worth, and none once it is met
  Obligations.onPaid('loan', (st, o) => {
    for (const x of levies(st, o)) {
      if (!Obligations.isLive(x)) continue;
      const over = Obligations.left(x) - (Obligations.isLive(o) ? daysFor(Obligations.left(o)) : 0);
      if (over > 1e-9)
        Obligations.lapse(st, x.id, 'the debt they worked off is paid', Obligations.isLive(o) ? over : null);
    }
    if (!Obligations.isLive(o)) drop(st, o.id);
  });
  return { CASE, hear, isDebt, forgiveWhy, forgiveDebt, daysFor };
})();
