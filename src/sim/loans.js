// @sys sim/loans [agency]: grain loans (VB-312; design.md, Loans, obligations and cases: Grain loans, Interest and due, Overdue and default): a
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
  const { floorOf, dailyNeed, sownNext, seedPer } = VB['sim/hunger'];
  const { targetOf } = VB['sim/steps'];
  const { CROPS } = VB['sim/crops'],
    { CROP_LIST } = VB['sim/goods'];
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
  VB.counter(
    'loanComing',
    'Journeys looked over for the grain on its way to a household short of the harvest (sim/loans coming, VB-312)',
  );
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
  // What lender `from` lends household `to` of the n it lacks: in whole sacks, at most what it spares; 0 when it refuses. Seed
  // (VB-1973) is lent in the sacks that cover what is short, a field's seed being of no use in part.
  function lends(st, from, by, to, n, seed = false) {
    if (refuses(st, from, by, to)) return 0;
    const most = Math.floor(spareOf(st, from) / LOAN.sack + 1e-9);
    return Math.min(most, seed ? Math.ceil(n / LOAN.sack - 1e-9) : Math.floor(n / LOAN.sack + 1e-9)) * LOAN.sack;
  }
  // ---- a seed loan (VB-1973; design.md, Loans of seed; Kim, 28 Nov: borrowed as a grain loan, kept for the sowing, repaid in grain at
  // the end of autumn) ----
  // The hour a crop's sowing window [season, first, last] next closes after hour t, and its asking from the start of the season before
  function windowOf(t, sow) {
    const [s, , last] = sow,
      close = (Math.floor(t / YEAR) * YEAR_DAYS + s * SEASON_DAYS + last + 1) * DAY,
      end = close > t ? close : close + YEAR;
    return { end, from: end - (SEASON_DAYS + last + 1) * DAY };
  }
  // The seed household hh lacks for its sowings to come, those whose asking is open (from the season before the window to its close):
  // each crop's seed its fields to be sown want (in stubble or hoed, sown with it next: sim/hunger sownNext; barley's a field the plan's,
  // seedPer, as the reserve's) above what it holds of it, less the grain on its way to it; and the hour the last of those windows
  // closes. The seed a rotation keeps of a crop no field sows next is not asked for, nor that of more fields of a crop than its hands
  // till (the plan's fields.workable, as sim/fieldwork's handsCap). {n, until}
  function seedShort(st, hh) {
    const fields = st.farmsteads[hh.farmstead].fields,
      F = targetOf(st.plans && st.plans.households.get(hh.id), 'fields'),
      cap = F ? Math.max(1, F.workable) : Infinity;
    let n = 0,
      until = 0;
    const by = {}; // the short of each crop (VB-2045): a seed loan names them
    for (const k of CROP_LIST) {
      const C = CROPS[k];
      if (!(C.seed > 0) || !C.sow) continue;
      const w = windowOf(st.t, C.sow);
      if (st.t < w.from) continue;
      let want = 0,
        m = 0;
      for (const fd of fields)
        if ((fd.stage === 'stubble' || fd.stage === 'plowed') && sownNext(fd) === k && m++ < cap)
          want += k === 'barley' ? seedPer(st, hh) : C.seed;
      const short = want - Stores.grainOf(hh, k);
      if (short <= 1e-9) continue;
      n += short;
      by[k] = short;
      until = Math.max(until, w.end);
    }
    return { n: n > 0 ? Math.max(0, n - coming(st, hh)) : 0, until, by };
  }
  // Of n lent as seed, what each crop short is asked for, in whole rations, at most its short: {crop: rations}; the rest of n is the
  // lender's proportion (sim/gifts fetchGift). VB-2045
  function cropsFor(by, n) {
    const out = {};
    let left = n;
    for (const k of CROP_LIST) {
      const x = Math.min(left, Math.ceil(by[k] || 0));
      if (x > 0) {
        out[k] = x;
        left -= x;
      }
    }
    return out;
  }
  // @state household.seedLent: absent, or the seed loan held for the coming sowing: {lent, sown, until}: the rations lent as seed, of
  //   them those sown since (the event seedSown, sim/fieldwork), and the hour the last sowing window it was lent for closes. What is
  //   lent and not sown is held as seed: the meal and the cook do not eat it (sim/hunger seedKept, sim/pot); from `until` it is the
  //   household's grain again (freed at its next review); the loan is repaid in grain at the end of autumn, as a grain loan is. Written
  //   only here.
  // @notstock household.seedLent: ledgers and statistics of what moved (sim/stores, sim/hunger)
  function lendSeed(st, hh, n, until) {
    const r = hh.seedLent;
    if (r) {
      r.lent += n;
      r.until = Math.max(r.until, until);
    } else hh.seedLent = { lent: n, sown: 0, until };
    VB.count.seedLent += n;
  }
  // A field of household hh sown with n of seed: the loan's seed is sown first
  on('seedSown', (st, { hh, n }) => {
    const r = hh.seedLent;
    if (!r || st.t >= r.until) return;
    const k = Math.min(n, r.lent - r.sown);
    r.sown += k;
    VB.count.seedLentSown += k;
  });
  // The sowing over (its window closed): what was lent and not sown is the seed of no field
  function seedFreed(st, hh) {
    const r = hh.seedLent;
    if (!r || st.t < r.until) return;
    VB.count.seedLentFreed += r.lent - r.sown;
    delete hh.seedLent;
  }
  // What household `to` asks of an offer o: the seed it lacks for its sowing (wants.seed), or what it lacks of the next harvest
  const wantOf = (st, o, to) => Math.min(o.wants.n, o.wants.seed ? seedShort(st, to).n : lack(st, to));
  VB.counter('loansMade', 'Loans of grain made (sim/loans, VB-312)');
  VB.counter('loanLent', 'Grain lent, in rations (sim/loans, VB-312)');
  VB.counter(
    'seedAsks',
    'Seed loans asked before a sowing by a household short of seed, once a season (sim/loans, VB-1973)',
  );
  VB.counter('seedLent', 'Grain lent as seed for a sowing, in rations (sim/loans lendSeed, VB-1973)');
  VB.counter('seedLentSown', 'Grain lent as seed and sown, in rations (sim/loans, VB-1973)');
  VB.counter(
    'seedLentFreed',
    'Grain lent as seed and not sown by the close of its sowing window, in rations (sim/loans seedFreed, VB-1973)',
  );
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
      return lends(st, from, o.to, to, wantOf(st, o, to), o.wants.seed) > 0;
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
    what: (st, o) =>
      `a loan of ${Math.round(o.wants.n)} ${o.wants.seed ? 'seed corn' : 'grain'} to ${fullName(st.pawns[o.from])}`,
    // a yes: the grain set aside as the borrower's and fetched (the verb deliver, args.loan), and the obligation booked: one or nothing
    settle: (st, o) => {
      const from = Offers.partyOf(st, o.parties.to),
        to = Offers.partyOf(st, o.parties.from);
      const seed = o.wants.seed === true,
        short = seed ? seedShort(st, to) : null,
        n = lends(st, from, o.to, to, wantOf(st, o, to), seed); // at most what it lacks now (a later yes: others lent meanwhile)
      if (!(n > 0)) return `${nameOf(st, from)} has nothing to lend now`;
      const args = { good: 'grain', n, loan: true };
      if (seed) args.crops = cropsFor(short.by, n); // the crop short, where the lender holds it (VB-2045)
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
      if (seed) lendSeed(st, to, n, short.until); // kept as seed for the sowing (sim/hunger)
      personEvent(
        st,
        o.from,
        'loan',
        `Borrowed ${n} ${seed ? 'seed corn' : 'grain'} from ${nameOf(st, from)}, to repay ${Math.round(back)} at the harvest`,
        { n, other: o.to, ...atHousehold(st, to) },
      );
      personEvent(st, o.to, 'loan', `Lent ${n} grain to ${nameOf(st, to)}`, false);
      return true;
    },
  });
  VB.counter(
    'loanLenders',
    'Households and stores weighed as lenders by a household short after help, once a season, over its village (sim/loans, VB-312)',
  );
  // ---- borrowing (design.md, Grain loans) ----
  // @state household.borrowedIn: the season (game seasons since the start) in which the household's holder last asked to borrow, or
  //   absent; written only here. It asks at most once a season.
  // @notstock household.borrowedIn: ledgers and statistics of what moved (sim/stores, sim/hunger)
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
  // @state household.seedAskedIn: the season in which the household's holder last asked a seed loan (VB-1973), or absent; written only
  //   here. It asks at most once a season.
  // @notstock household.seedAskedIn: ledgers and statistics of what moved (sim/stores, sim/hunger)
  // Household hh's holder asks a seed loan before its sowing (VB-1973): while the seed it holds is short of its fields to be sown
  // (seedShort) by any of it, once a season, of the same lenders as a grain loan, in the same order, each for what is still short. True
  // when it asked.
  function borrowSeed(st, hh) {
    const season = seasonOf(st.t),
      by = hh.holder;
    if (hh.dissolved || hh.seedAskedIn === season || by === null || by === undefined || !st.pawns[by].alive)
      return false;
    if (hh.farmstead === null || unplanned(st, by)) return false;
    if (st.offers.some((o) => o.basis === 'loan' && o.from === by)) return false; // a loan asked, not yet answered
    let want = seedShort(st, hh).n;
    if (want <= 1e-9) return false;
    hh.seedAskedIn = season;
    VB.count.seedAsks++;
    const ask = (party, target, store) => {
      const before = Stores.grainOf(party),
        wants = { good: 'grain', n: Math.max(LOAN.sack, want), seed: true };
      if (store !== undefined) wants.store = store;
      issue(st, { actor: by, verb: 'offer', target, args: { basis: 'loan', wants }, source: 'planner' });
      want -= Math.max(0, before - Stores.grainOf(party));
    };
    const v = villageOf(st, hh);
    for (const k of lenders(st, v, hh)) {
      if (want <= 1e-9) return true;
      ask(k, k.holder);
    }
    const alderman = agentOf(st, v);
    if (want > 1e-9 && alderman !== null && spareOf(st, st.villages[v]) >= LOAN.sack) ask(st.villages[v], alderman, v);
    for (const k of partners(st, by, hh)) {
      if (want <= 1e-9) return true;
      ask(k, k.holder);
    }
    return true;
  }
  on('planReviewed', (st, d) => {
    if ((d.why !== 'day' && d.why !== 'store') || d.plan.holder.type !== 'household') return;
    const hh = st.households[d.plan.holder.id];
    if (hh.seedLent) seedFreed(st, hh);
    borrowSeed(st, hh); // the seed first: what is lent for the sowing is kept for it, and counts in what it lacks
    borrow(st, hh);
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
  VB.counter('loanRepaid', 'Grain of loans repaid, in rations (sim/loans, VB-312)');
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
  VB.counter(
    'loanDefaulted',
    'Grain of loans defaulted, in rations unpaid after the second harvest (sim/loans, VB-312)',
  );
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
  return { LOAN, borrow, borrowSeed, seedShort, windowOf, lack, spareOf, lends, refuses, harvestAfter };
})();
