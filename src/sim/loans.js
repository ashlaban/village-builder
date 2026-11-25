// @sys sim/loans: grain loans (VB-312; design.md, Loans, obligations and cases: Grain loans, Interest and due, Overdue and default): a
// household still short of the next harvest after help has gone round borrows, once a season, an offer on the basis `loan` (Kim,
// 16 Nov: the borrower wants grain now and gives a promise) to a lender of its village, its store, then a trade partner; a yes sets the
// grain aside as the borrower's and has it fetched, and books an obligation of kind `loan`, repaid at the end of autumn (the verb
// `repay`), overdue at the first harvest unpaid, defaulted at the second
VB['sim/loans'] = (() => {
  const Offers = VB['sim/offers'],
    Obligations = VB['sim/obligations'],
    Stores = VB['sim/stores'];
  const { issue, register } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  const { HELP, DAY, YEAR, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
  const { floorOf, dailyNeed } = VB['sim/hunger'];
  const { opinionOf, remember } = VB['sim/relations'];
  const { inForce } = VB['sim/customs'];
  const { agentOf, agentWhy } = VB['sim/decisions'];
  const { withinDay, byLand } = VB['sim/villagehours'];
  const { personEvent, log, fullName, atHousehold, holdingOf, unplanned } = VB['sim/records'];
  const { askDaysAt, seasonOf } = VB['sim/help'];
  const { setAside } = VB['sim/gifts'];
  // @tunable LOAN: grain loans (design.md, Grain loans; Interest and due; Overdue and default)
  // A loan is lent in whole sacks; a lender refuses one whose holder it holds below `enmity` in opinion; what custom adds to what is
  // repaid, by the practice "Loans of grain are repaid"; the harvests a loan falls due at before it is defaulted.
  const LOAN = { sack: 10, enmity: -0.3, adds: { quarter: 0.25, asLent: 0 }, dues: 2 };
  const AUTUMN = 2;
  const isHousehold = (x) => 'farmstead' in x;
  const nameOf = (st, x) => (isHousehold(x) ? st.farmsteads[x.farmstead].name : x.name + "'s store");
  const villageOf = (st, hh) => st.farmsteads[hh.farmstead].village;
  // The end of autumn after hour t, when the harvest is threshed: a loan's due
  const harvestAfter = (t) => {
    const end = (Math.floor(t / YEAR) * YEAR_DAYS + (AUTUMN + 1) * SEASON_DAYS) * DAY;
    return end > t ? end : end + YEAR;
  };
  // Grain on its way to household hh: what its members fetch and have not yet brought in (a gift set aside, a loan), and a gift a giver's
  // man carries to it from beyond a day (sim/gifts carryGift)
  function coming(st, hh) {
    let n = 0;
    for (const j of st.away) {
      VB.count.loanComing++;
      if (!j.gift || j.gift.to !== hh.id) continue;
      if (j.why === 'carry') n += j.gift.n || 0;
      if (j.why !== 'fetch') continue;
      n += j.gift.held || 0;
      for (const s of j.gift.stops) n += s.left;
    }
    return n;
  }
  // What household hh lacks to reach the next harvest with its floor (help's days to the harvest, sim/help askDaysAt), counting what is
  // on its way to it
  const lack = (st, hh) => floorOf(st, hh) + askDaysAt(st) * dailyNeed(st, hh) - Stores.grainOf(hh) - coming(st, hh);
  // What a lender spares: a household its grain above its floor and its own need to the next harvest; a village's store its grain above
  // the seed of its common fields
  const spareOf = (st, x) =>
    Math.max(
      0,
      isHousehold(x)
        ? Stores.grainOf(x) - floorOf(st, x) - askDaysAt(st) * dailyNeed(st, x)
        : Stores.grainOf(x) - Stores.reserved(st, x, 'grain'),
    );
  const unpaid = (st, hh) => Obligations.due(st, { kind: 'household', id: hh.id }, 'debtor', 'loan').length > 0;
  // Why lender `from` (answered for by pawn `by`) lends nothing to household `to`, or null
  function refuses(st, from, by, to) {
    if (from.dissolved || to.dissolved) return 'the household is gone';
    if (to.holder !== null && opinionOf(st, by, to.holder) < LOAN.enmity) return 'enmity';
    if (st.farmsteads[to.farmstead].fields.length === 0 && unpaid(st, to)) return 'no field, and a loan unpaid';
    return null;
  }
  // What lender `from` lends household `to` of the n it lacks: in whole sacks, at most what it spares; 0 when it refuses
  function lends(st, from, by, to, n) {
    if (refuses(st, from, by, to)) return 0;
    return Math.floor(Math.min(n, spareOf(st, from)) / LOAN.sack + 1e-9) * LOAN.sack;
  }
  // ---- the basis `loan` (sim/offers): the borrower's holder wants {good: 'grain', n, store?} and gives its promise ----
  Offers.basis('loan', {
    books: 'an obligation',
    wait: () => HELP.answerDays,
    check: (st, o) => {
      const p = Number.isInteger(o.from) && st.pawns[o.from],
        want = o.wants,
        hh = p && p.died === null ? holdingOf(st, o.from) : null;
      if (!hh || hh.dissolved) return `pawn ${o.from} holds no household`;
      if (o.gives) return 'a loan is asked for with a promise only';
      if (!(want && want.good === 'grain')) return 'only grain is lent';
      if (!(Number.isFinite(want.n) && want.n >= LOAN.sack)) return `cannot borrow ${want.n}: a sack at least`;
      let from;
      if (want.store !== undefined) {
        if (!st.villages[want.store]) return `there is no village ${want.store}`;
        const why = agentWhy(st, want.store, o.to); // the store lends through its alderman, at home (VB-673)
        if (why) return why;
        from = st.villages[want.store];
      } else {
        from = Number.isInteger(o.to) && st.pawns[o.to] && st.pawns[o.to].died === null ? holdingOf(st, o.to) : null;
        if (!from || from.dissolved) return `pawn ${o.to} holds no household`;
        if (from.id === hh.id) return "one cannot borrow from one's own household";
        const a = villageOf(st, from),
          b = villageOf(st, hh);
        if (a !== b && !(withinDay(st, a, b) && byLand(st, a, b))) return `${nameOf(st, from)} is beyond a day's walk`;
      }
      return { parties: { from: { household: hh.id }, to: Offers.refOf(from) } };
    },
    answers: (st, o) => [{ key: 'to', by: o.to, yes: null }],
    weigh: (st, o) => {
      const from = Offers.partyOf(st, o.parties.to),
        to = Offers.partyOf(st, o.parties.from);
      return lends(st, from, o.to, to, Math.min(o.wants.n, lack(st, to))) > 0;
    },
    // a no is remembered only where the lender had a sack to spare (an honest cannot is not resented, as an ask's)
    refused: (st, o, no) => {
      const from = Offers.partyOf(st, o.parties.to);
      if (o.from === no.by || spareOf(st, from) < LOAN.sack) return;
      remember(st, o.from, no.by, 'refusedUs');
      remember(st, no.by, o.from, 'refusedThem');
      log(st, `${fullName(st.pawns[no.by])} refused ${fullName(st.pawns[o.from])} a loan of grain.`, {
        kind: 'offerRefused',
        pawn: no.by,
        other: o.from,
        ...atHousehold(st, Offers.partyOf(st, o.parties.from)),
      });
    },
    what: (st, o) => `a loan of ${Math.round(o.wants.n)} grain to ${fullName(st.pawns[o.from])}`,
    // a yes: the grain set aside as the borrower's and fetched (the verb deliver, args.loan), and the obligation booked: one or nothing
    settle: (st, o) => {
      const from = Offers.partyOf(st, o.parties.to),
        to = Offers.partyOf(st, o.parties.from);
      const n = lends(st, from, o.to, to, Math.min(o.wants.n, lack(st, to))); // at most what it lacks now (a later yes: others lent meanwhile)
      if (!(n > 0)) return `${nameOf(st, from)} has nothing to lend now`;
      const args = { good: 'grain', n, loan: true };
      if (!isHousehold(from)) args.store = from.id;
      const r = issue(st, {
        actor: !isHousehold(from) ? o.to : from.holder !== null ? from.holder : { household: from.id },
        verb: 'deliver',
        target: to.id,
        args,
        source: 'offer',
      });
      if (r !== true) return r;
      const back = n * (1 + LOAN.adds[inForce(st, 'loans', villageOf(st, to))]);
      Obligations.create(st, {
        kind: 'loan',
        debtor: { kind: 'household', id: to.id },
        creditor: isHousehold(from) ? { kind: 'household', id: from.id } : { kind: 'village', id: from.id },
        owes: { rations: back },
        enforcer: { kind: 'village', id: villageOf(st, to) },
        lent: n,
      });
      VB.count.loansMade++;
      VB.count.loanLent += n;
      personEvent(
        st,
        o.from,
        'loan',
        `Borrowed ${n} grain from ${nameOf(st, from)}, to repay ${Math.round(back)} at the harvest`,
        { n, other: o.to, ...atHousehold(st, to) },
      );
      personEvent(st, o.to, 'loan', `Lent ${n} grain to ${nameOf(st, to)}`, false);
      return true;
    },
  });
  // ---- borrowing (design.md, Grain loans) ----
  // @state household.borrowedIn: the season (game seasons since the start) in which the household's holder last asked to borrow, or
  //   absent; written only here. It asks at most once a season.
  // The households of village v with a farm, in order of what they spare (most first, then by id), each with it
  function lenders(st, v, hh) {
    const out = [];
    for (const fid of st.villages[v].farmsteads) {
      const f = st.farmsteads[fid];
      if (f.household === null || f.household === hh.id) continue;
      const k = st.households[f.household];
      VB.count.loanLenders++;
      if (k.dissolved || k.holder === null || !st.pawns[k.holder].alive) continue;
      const n = spareOf(st, k);
      if (n >= LOAN.sack) out.push([n, k]);
    }
    return out.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id).map((x) => x[1]);
  }
  // The households of the holder's trade partners (those it has a balance of goodwill with, met at a gathering or its fair: sim/relations;
  // at most GOODWILL.cap) of another village within a day's walk by land, in order of what they spare
  function partners(st, by, hh) {
    const g = st.pawns[by].goodwill,
      v = villageOf(st, hh),
      out = [];
    if (!g) return out;
    for (const [id] of g) {
      const q = st.pawns[id];
      VB.count.loanLenders++;
      if (!q.alive || q.household === null) continue;
      const k = st.households[q.household];
      if (k.dissolved || k.holder !== id) continue;
      const a = villageOf(st, k);
      if (a === v || !withinDay(st, a, v) || !byLand(st, a, v)) continue;
      const n = spareOf(st, k);
      if (n >= LOAN.sack && !out.some((x) => x[1] === k)) out.push([n, k]);
    }
    return out.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id).map((x) => x[1]);
  }
  // Household hh's holder asks to borrow, after help has gone round at its plan's review (help's subscriber runs first): while it lacks
  // a sack or more of reaching the next harvest with its floor, and has not asked this season, it asks the households of its village by
  // what they spare, then its village's store through the alderman, then its trade partners', each for what it still lacks. True when
  // it asked.
  function borrow(st, hh) {
    const season = seasonOf(st.t),
      by = hh.holder;
    if (hh.dissolved || hh.borrowedIn === season || by === null || by === undefined || !st.pawns[by].alive)
      return false;
    if (unplanned(st, by)) return false;
    // help has gone round: it asked this season, or it is below what makes it ask (sim/help askFood); and no ask waits for an answer
    const need = dailyNeed(st, hh);
    if (hh.askedIn !== season && Stores.grainOf(hh) - Stores.reserved(st, hh, 'grain') >= HELP.askBelow * need)
      return false;
    if (st.offers.some((o) => o.basis === 'ask' && o.from === by)) return false;
    let want = lack(st, hh);
    if (want < LOAN.sack) return false;
    if (st.offers.some((o) => o.basis === 'loan' && o.from === by)) return false; // asked already, not yet answered
    hh.borrowedIn = season;
    const ask = (party, target, wants) => {
      const before = Stores.grainOf(party);
      issue(st, { actor: by, verb: 'offer', target, args: { basis: 'loan', wants }, source: 'planner' });
      want -= Math.max(0, before - Stores.grainOf(party));
    };
    const v = villageOf(st, hh);
    for (const k of lenders(st, v, hh)) {
      if (want < LOAN.sack) return true;
      ask(k, k.holder, { good: 'grain', n: want });
    }
    const alderman = agentOf(st, v);
    if (want >= LOAN.sack && alderman !== null && spareOf(st, st.villages[v]) >= LOAN.sack)
      ask(st.villages[v], alderman, { good: 'grain', n: want, store: v });
    for (const k of partners(st, by, hh)) {
      if (want < LOAN.sack) return true;
      ask(k, k.holder, { good: 'grain', n: want });
    }
    return true;
  }
  on('planReviewed', (st, d) => {
    if ((d.why !== 'day' && d.why !== 'store') || d.plan.holder.type !== 'household') return;
    borrow(st, st.households[d.plan.holder.id]);
  });
  // ---- repayment, overdue and default (design.md, Interest and due; Overdue and default) ----
  // The debtor's actor: its holder, or the household itself without one
  const actorOf = (hh) => (hh.holder !== null ? hh.holder : { household: hh.id });
  const creditorOf = (st, o) =>
    o.creditor.kind === 'village' ? st.villages[o.creditor.id] : st.households[o.creditor.id];
  // What household hh can repay now of loan o: its grain above its floor, in whole rations, at most what is left
  const canPay = (st, hh, o) =>
    Math.min(Obligations.left(o), Math.max(0, Math.floor(Stores.grainOf(hh) - floorOf(st, hh) + 1e-9)));
  // repay(target: a loan's id, {n}): the debtor household's actor pays n of it from its grain above its floor, set aside at its house as
  // the creditor's and carried back (sim/gifts setAside); booked against the loan at once (a right moves at once)
  function repayWhy(st, c) {
    const o = st.obligations && st.obligations[c.target],
      n = c.args && c.args.n;
    if (!o || o.kind !== 'loan' || !Obligations.isLive(o)) return `there is no loan ${c.target} unpaid`;
    const hh = st.households[o.debtor.id];
    if (hh.dissolved) return 'the household that owes it is gone';
    const actor = actorOf(hh);
    if (Number.isInteger(actor) ? c.actor !== actor : !(c.actor && c.actor.household === hh.id))
      return 'a loan is repaid by its debtor';
    if (!(Number.isFinite(n) && n > 0 && n <= canPay(st, hh, o))) return `cannot repay ${n}`;
    const to = creditorOf(st, o);
    if (!to || (isHousehold(to) && to.dissolved)) return 'the one owed is gone';
    return null;
  }
  register('repay', {
    check: repayWhy,
    run: (st, c) => {
      const o = st.obligations[c.target],
        hh = st.households[o.debtor.id],
        to = creditorOf(st, o),
        n = c.args.n;
      const r = setAside(st, hh, to, n);
      if (r !== true) return r;
      Obligations.fulfil(st, o.id, n, { kind: 'loan', id: o.id });
      VB.count.loanRepaid += n;
      const left = Obligations.left(o),
        text = `Repaid ${n} grain of a loan to ${nameOf(st, to)}${left > 1e-9 ? `, ${Math.round(left)} still owed` : ''}`;
      if (hh.holder !== null) personEvent(st, hh.holder, 'loanRepaid', text, { n, ...atHousehold(st, hh) });
      else log(st, `${nameOf(st, hh)}: ${text}.`, { kind: 'loanRepaid', pawn: null, ...atHousehold(st, hh) });
      return true;
    },
  });
  // A party gone: a household's successor on its farm owes, or is owed (design.md, Partial failure); with none the loan lapses. True
  // when it still stands.
  function successor(st, o) {
    for (const as of ['debtor', 'creditor']) {
      if (o[as].kind !== 'household' || !st.households[o[as].id].dissolved) continue;
      const old = st.households[o[as].id],
        f = old.farmstead === null ? null : st.farmsteads[old.farmstead],
        heir = f && f.household !== null && f.household !== old.id ? st.households[f.household] : null;
      if (heir && !heir.dissolved) Obligations.transfer(st, o.id, { [as]: { kind: 'household', id: heir.id } });
      else {
        Obligations.lapse(st, o.id, `the household that ${as === 'debtor' ? 'owed' : 'was owed'} it is gone`);
        return false;
      }
    }
    return true;
  }
  Obligations.kind('loan', {
    every: null,
    dues: LOAN.dues,
    term: harvestAfter,
    // at its due, the end of autumn: the debtor repays what it can; unpaid, it is overdue and due at the next harvest, or defaulted
    ended: (st, o) => {
      if (!successor(st, o)) return 'lapsed';
      const hh = st.households[o.debtor.id],
        n = canPay(st, hh, o);
      // the played holder repays by the verb as it chooses (design.md, Every act is a pawn): unpaid now, it is overdue
      if (hh.holder !== null && unplanned(st, hh.holder)) return 'overdue';
      if (n > 0) issue(st, { actor: actorOf(hh), verb: 'repay', target: o.id, args: { n }, source: 'pawn' });
      return 'overdue';
    },
    // at the second harvest unpaid: told (VB-315's cases will hear it, emitting the event it subscribes to)
    defaulted: (st, o) => {
      const hh = st.households[o.debtor.id],
        left = Math.round(Obligations.left(o)),
        to = creditorOf(st, o),
        text = `efaulted on a loan from ${to ? nameOf(st, to) : 'another'}: ${left} grain unpaid after two harvests`;
      VB.count.loanDefaulted += left;
      if (hh.holder !== null)
        personEvent(st, hh.holder, 'loanDefaulted', `D${text}`, { n: left, ...atHousehold(st, hh) });
      else log(st, `${nameOf(st, hh)} d${text}.`, { kind: 'loanDefaulted', pawn: null, ...atHousehold(st, hh) });
    },
  });
  return { LOAN, borrow, lack, spareOf, lends, refuses, harvestAfter };
})();
