// @sys sim/exchange [agency]: deals between parties, the gift for now (VB-216): whether one goes ahead (the floor, allowance), and settling it through
// sim/stores and sim/relations, its worth booked as goodwill between the two holders (VB-217); a household's want of a cow, the deal or
// the start in life that meets it and the job that leads the animal home (VB-390); whom a household deals with first, its kin
VB['sim/exchange'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/exchange', {
    gift: { keep: 'generation', personal: true, skip: 'help' },
  });
  const Goods = VB['sim/goods'],
    Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'];
  const { book, balance, remember } = VB['sim/relations'],
    { addTie } = VB['sim/ties'];
  const { HELP, GOODWILL, HERD, TRAVEL, stalled } = VB['sim/rules'];
  const { withinDay, byLand } = VB['sim/villagehours'];
  const { agentWhy } = VB['sim/decisions'];
  const { personEvent, atHousehold, holdingOf, age, childrenOf, siblingsOf, log, fullName, mindsWhy } =
    VB['sim/records'];
  const { herdsOf, winterNeed } = VB['sim/herds'];
  const { payInAnimals } = VB['sim/droving'];
  const { floorOf, dailyNeed, servedLast } = VB['sim/hunger'],
    { daysOfFood } = VB['sim/foodneed'];
  const Norms = VB['sim/norms'];
  const Offers = VB['sim/offers'];
  const { issue } = VB['sim/commands'],
    { emit } = VB['sim/events'];
  const { MOOD, level: moodOf, word: moodWord } = VB['sim/mood'];
  // allowance's goodwill term (design.md, The gift: Allowance), relations' quantity, contributed here because its limit needs the receiving
  // household's need: plus what the giver owes the receiver, minus what the receiver owes beyond GOODWILL.limitDays of its household's
  // need. Switched on by GOODWILL.acts (VB-220).
  const goodwillTerm = (st, c) => {
    if (!GOODWILL.acts || c.giver === null || c.receiver === null) return 0;
    const owed = balance(st, c.giver, c.receiver); // > 0: the receiver owes the giver
    return owed < 0 ? -owed : -Math.max(0, owed - GOODWILL.limitDays * dailyNeed(st, c.to));
  };
  // allowance's opinion term (design.md, The gift: Allowance; Kim, 10 Nov): the giver's opinion of the receiver, -1 to 1, times
  // GOODWILL.opinionRations. Coupled with goodwill, which colours opinion (gratitude): a high opinion lets a deal through.
  const opinionTerm = (st, c) =>
    !GOODWILL.acts || c.giver === null || c.receiver === null
      ? 0
      : GOODWILL.opinionRations * Offers.answerOpinion(st, c.giver, c.receiver);
  // A deal's allowance (VB-302; target-v2 5.1 and 5.2): what one side lets a swap cost it toward the other, its goodwill and its opinion
  // only, so that between strangers it is near zero (a gift's allowance adds the giver's grain above its floor and its reserve, the size
  // of a gift). It may be below zero: a side owed beyond the limit wants a gain. Context as allowance's: {giver, receiver, from, to}.
  Rules.declare({ id: 'dealAllowance', owner: 'sim/exchange', combine: 'sum', base: () => 0 });
  for (const rule of ['allowance', 'dealAllowance']) {
    const tunables = ['GOODWILL.acts'];
    Rules.contribute({
      rule,
      source: 'sim/exchange',
      key: 'goodwill',
      label: 'Goodwill',
      tunables: [...tunables, 'GOODWILL.limitDays'],
      value: goodwillTerm,
    });
    Rules.contribute({
      rule,
      source: 'sim/exchange',
      key: 'opinion',
      label: 'Opinion of them',
      tunables: [...tunables, 'GOODWILL.opinionRations'],
      value: opinionTerm,
    });
  }
  // allowance's mood term (VB-875; design.md, Traits, talk and stories: Mood): the giving holder's mood moves what it would give up, by
  // MOOD.gives.days of its household's need at the ends of the scale: a holder low in spirits holds on to what it has. Read when a gift,
  // an ask or help is weighed, so mood is read where an answer is given and nowhere else (no pass; sim/mood's level allocates nothing).
  function moodTerm(st, c) {
    const m = c.giver === null ? null : moodOf(st, c.giver);
    return m === null ? 0 : (MOOD.gives.days * (m - MOOD.base) * dailyNeed(st, c.from)) / MOOD.base;
  }
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/exchange',
    key: 'mood',
    label: 'Mood',
    tunables: ['MOOD.gives.days'],
    value: moodTerm,
  });
  // A gift {from, to, good, n, source}: from and to are households or villages (a village gives from its store, or takes the yearly
  // filling). Sizes are compared with a tolerance, since the size help asks for is reckoned apart from the allowance's sum.
  const TOLERANCE = 1e-9;
  // Customary worth in rations a unit, until worth is a norm (slice 4; design.md, The gift: Unit and decay).
  const WORTH = { grain: 1 };
  const isHousehold = (x) => 'farmstead' in x;
  const nameOf = (st, x) => (isHousehold(x) ? st.farmsteads[x.farmstead].name : x.name);
  const ctx = { giver: null, receiver: null, from: null, to: null }; // reused, so allowance's value allocates nothing
  // Whether a gift goes ahead: a giving household keeps its floor and gives no more than its allowance toward the receiver; a village
  // store has neither and gives what it holds. The player's pawn passes both (The gift: the player's gift; the warning is VB-221's).
  // {floorOk, allowance, accept, why}: why is null when the gift is accepted, else the reason.
  function assessGift(st, o) {
    let floorOk,
      allowance = Infinity;
    if (isHousehold(o.from)) {
      floorOk = Stores.grainOf(o.from) - o.n >= floorOf(st, o.from) - TOLERANCE;
      ctx.giver = o.from.holder;
      ctx.receiver = isHousehold(o.to) ? o.to.holder : null;
      ctx.from = o.from;
      ctx.to = o.to;
      allowance = Rules.value(st, 'allowance', ctx);
    } else floorOk = o.n <= Stores.grainOf(o.from) + TOLERANCE;
    const player = o.source === 'player',
      within = o.keep === true || o.n <= allowance + TOLERANCE; // the keep is a due of custom: held to the floor, not the allowance
    const why =
      !floorOk && (!player || !isHousehold(o.from))
        ? `it would take ${nameOf(st, o.from)} below its floor`
        : !within && !player
          ? `${nameOf(st, o.from)} would give at most ${Math.round(allowance)} rations`
          : null;
    return { floorOk, allowance, accept: why === null, why };
  }
  // What the player is told before its pawn's household gives n below its floor (VB-221; The gift: the player's gift): null when the
  // gift leaves the floor whole, else {below (rations under the floor after it), days (the floor's days of need), hungry (the members
  // its feed order serves last, as pawn ids)}. Reads only; the gift itself is the verb's.
  function giftWarning(st, from, n) {
    if (!isHousehold(from)) return null;
    const below = floorOf(st, from) - (Stores.grainOf(from) - n);
    return below > TOLERANCE ? { below, days: HELP.floorDays, hungry: servedLast(st, from) } : null;
  }
  // The gift's moves and records, as help made them (help.js, VB-039): the receiver's grain (in the crops the giver's take gave, `parts`)
  // and its records (booked).
  function receive(st, from, to, n, fromName, parts) {
    Stores.put(st, to, 'grain', n, { kind: 'gift', from: fromName }, parts);
    booked(st, from, to, n, fromName);
  }
  // A gift's records: the receiving holder's event, then the giver's, the tie between the two holders, and the goodwill booked between
  // them. Rights move at once (AGENTS.md, the hard rule): a gift that is fetched is booked at the ask, its grain at each arrival (VB-461).
  // A village's store gives through its alderman, the village's agent (VB-314): `from` is then the village, and he is the giver booked; with
  // no alderman (a village with no holder) nothing is booked, as before.
  const giverOf = (st, from) =>
    isHousehold(from) ? from.holder : from.alderman != null && st.pawns[from.alderman].alive ? from.alderman : null;
  function booked(st, from, to, n, fromName) {
    const ht = to.holder !== null ? st.pawns[to.holder] : null,
      gid = from ? giverOf(st, from) : null;
    if (ht)
      personEvent(st, ht.id, 'gift', `Received ${Math.round(n)} grain from ${fromName}`, {
        n: Math.round(n),
        other: gid,
        ...atHousehold(st, to),
      });
    if (from) {
      const hf = gid !== null ? st.pawns[gid] : null;
      if (hf)
        personEvent(
          st,
          hf.id,
          'gift',
          `Gave ${Math.round(n)} grain to ${st.farmsteads[to.farmstead].name}`,
          ht
            ? false
            : {
                n: Math.round(n),
                ...atHousehold(st, to),
              },
        ); // with a receiving holder, recorded above
      const two = hf && ht && hf.id !== ht.id; // one holder of both (a guardian's two, a holder who moved): nothing between them (VB-1362)
      if (two && hf.ties && ht.ties)
        for (const [a, b] of [
          [hf, ht],
          [ht, hf],
        ])
          addTie(st, a.id, b.id, HELP.tieGain);
      if (two) book(st, hf.id, ht.id, n * WORTH.grain); // the giver is owed the gift's worth (Who books: the two holders)
      // a household's gift is a deed the village sees, the grain carried across it (VB-705): its giver's standing (sim/society)
      if (two && isHousehold(from)) emit(st, 'giftGiven', { giver: hf.id, receiver: ht.id, worth: n * WORTH.grain });
    }
  }
  VB.counter(
    'giftUncarried',
    'Grain a gift settled at once between two farmsteads, or from a village store to a household: none, by the hard rule (sim/exchange; ' +
      'VB-461)',
  );
  // Settles an accepted gift between two households of one farmstead, which is one place (the hard rule): what goes between places is
  // carried, hauled or fetched (sim/away) and booked by `receive` as it arrives (VB-1111). Only the verb `deliver` calls it (tests/commands.js).
  function settleGift(st, o) {
    // grain that changes place at once between two farmsteads (VB-461, VB-849: the verb has it fetched or hauled; tests/lib/invariants.js holds this at 0)
    if (!isHousehold(o.to) ? isHousehold(o.from) : !isHousehold(o.from) || o.from.farmstead !== o.to.farmstead)
      VB.count.giftUncarried += o.n;
    if (!isHousehold(o.to))
      Stores.move(st, o.from, o.to, 'grain', o.n, { kind: 'gift', to: 'the village store' }); // the yearly filling
    else if (o.loan) {
      // a loan within one farmstead (VB-312): it changes owner where it lies, and books an obligation (sim/loans), not goodwill
      const parts = {};
      Stores.take(st, o.from, 'grain', o.n, { kind: 'loan', to: st.farmsteads[o.to.farmstead].name }, parts);
      Stores.put(st, o.to, 'grain', o.n, { kind: 'loan', from: st.farmsteads[o.from.farmstead].name }, parts);
    } else {
      // the giver's grain goes in the proportion it holds its crops (VB-347): taken first, then received
      const parts = {},
        fromName = isHousehold(o.from) ? st.farmsteads[o.from.farmstead].name : o.from.name;
      Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }, parts);
      receive(st, o.from, o.to, o.n, fromName, parts);
    }
  }
  // ---- the goods bases of sim/offers (VB-690): a gift, and an ask ----
  // The receiving party a gift's `to` names, as giftOf's target: the household a pawn holds, a household with no holder, or a village; or
  // why there is none
  function receiverOf(st, to) {
    if (Number.isInteger(to)) {
      const hh = st.pawns[to] && st.pawns[to].died === null ? holdingOf(st, to) : null;
      return hh ? hh.id : `pawn ${to} holds no household`;
    }
    if (to && to.household !== undefined && st.households[to.household] && st.households[to.household].holder !== null)
      return `household ${to.household} takes through its holder`;
    return to && to.household !== undefined ? to.household : to;
  }
  // gift: {gives: {good, n, carrier?}}: a household (its holder), or the village store, gives goods; the receiver's holder answers, and
  // takes a gift (no rule refuses one yet). The giver weighs it before making it: its floor and its allowance (assessGift; the player's
  // pawn passes both). A yes delivers it, carried by gives.carrier or settled where it lies; the worth is booked as goodwill (receive).
  Offers.basis('gift', {
    books: 'goodwill',
    wait: () => HELP.answerDays,
    check: (st, o, c) => {
      if (o.wants) return 'a gift wants nothing';
      const t = receiverOf(st, o.to),
        g = typeof t === 'string' ? t : Offers.giftOf(st, o.from, t, o.gives, c.source);
      if (typeof g === 'string') return g;
      const why = assessGift(st, g).why;
      if (why) return why;
      return { parties: { from: Offers.refOf(g.from), to: Offers.refOf(g.to) } };
    },
    answers: (st, o) => (Number.isInteger(o.to) ? [{ key: 'to', by: o.to, yes: null }] : []),
    weigh: () => true,
    settle: (st, o) =>
      issue(st, {
        actor: o.from,
        verb: 'deliver',
        target: o.parties.to.household !== undefined ? o.parties.to.household : o.parties.to,
        args: o.gives,
        source: 'offer',
      }),
  });
  // ask: {wants: {good, n, store?}}: a pawn asks a holder, or with wants.store a village's alderman for its store (VB-691), for grain for
  // its own household. The one asked answers by its floor and allowance (assessGift's; a store by its rule: its grain above the seed of
  // its common fields) and gives what they allow, up to n: at least HELP.askLeast, or it says no; a no is remembered only by one who had
  // grain above its floor to give (as hands, VB-470: an honest cannot is not resented), and told only then.
  // What is given is set aside where it lies and fetched by the asker's household (VB-461): with no one of the asker's free to fetch, the
  // yes lapses (VB-861: the verb deliver refuses it); from kin beyond a day's walk by land it is carried by one of the giver's own, a
  // back-load at most (VB-291), and with no one free to go the yes lapses. The worth is booked as goodwill, as a gift's.
  // The youngest adult of 14 to 59 of household hh who is not on the road (VB-291), or -1: the one who carries a far gift; never the
  // last one at home with a child under 7 (VB-1602: sim/records mindsWhy)
  function carrierOf(st, hh) {
    let best = -1;
    for (const id of hh.members) {
      const p = st.pawns[id];
      if (!p.alive || p.age < 14 || p.age >= 60 || st.agents[id].away !== undefined) continue;
      if (mindsWhy(st, id)) continue;
      if (best < 0 || p.age < st.pawns[best].age) best = id;
    }
    return best;
  }
  // Whether the asked party `from` lies beyond a day's walk of the asker's household `to` (its gift is carried), null when beyond reach by land
  function farOf(st, from, to) {
    if (!isHousehold(from)) return false;
    const a = st.farmsteads[from.farmstead].village,
      b = st.farmsteads[to.farmstead].village;
    return withinDay(st, a, b) ? false : byLand(st, a, b) ? true : null;
  }
  // What `from` (a household or a village store) would give to an ask of n grain by household `to`: what its floor and allowance allow,
  // up to n; under ASK.least, 0
  function askGives(st, from, to, n) {
    const most = isHousehold(from)
      ? Math.min(assessGift(st, { from, to, n: 0, source: 'ask' }).allowance, Stores.grainOf(from) - floorOf(st, from))
      : Stores.grainOf(from) - Stores.reserved(st, from, 'grain');
    const k = Math.min(n, most);
    return k >= HELP.askLeast - TOLERANCE ? k : 0;
  }
  Offers.basis('ask', {
    books: 'goodwill',
    wait: () => HELP.answerDays,
    check: (st, o) => {
      const p = Number.isInteger(o.from) && st.pawns[o.from],
        want = o.wants,
        vid = want && want.store;
      if (!p || p.died !== null) return 'the ask is made by a living pawn';
      if (p.household === null || st.households[p.household].dissolved) return `pawn ${o.from} lives in no household`;
      if (o.gives) return 'an ask gives nothing';
      if (!(want && want.good === 'grain')) return 'only grain is asked for';
      if (!(Number.isFinite(want.n) && want.n > 0)) return `cannot ask for ${want.n}`;
      let to;
      if (vid !== undefined) {
        if (!st.villages[vid]) return `there is no village ${vid}`;
        const why = agentWhy(st, vid, o.to); // the store answers through its alderman, at home (VB-673)
        if (why) return why;
        to = st.villages[vid];
      } else {
        to = Number.isInteger(o.to) && st.pawns[o.to] && st.pawns[o.to].died === null ? holdingOf(st, o.to) : null;
        if (!to || to.dissolved) return `pawn ${o.to} holds no household`;
        if (to.id === p.household) return "one cannot ask one's own household";
        if (farOf(st, to, st.households[p.household]) === null) return `${nameOf(st, to)} is beyond reach by land`;
      }
      return { parties: { from: { household: p.household }, to: Offers.refOf(to) } };
    },
    answers: (st, o) => [{ key: 'to', by: o.to, yes: null }],
    weigh: (st, o) => {
      const from = Offers.partyOf(st, o.parties.to),
        to = Offers.partyOf(st, o.parties.from);
      return !from.dissolved && !to.dissolved && askGives(st, from, to, o.wants.n) > 0;
    },
    refused: (st, o, no) => {
      const from = Offers.partyOf(st, o.parties.to);
      const above = isHousehold(from)
        ? Stores.grainOf(from) - floorOf(st, from)
        : Stores.grainOf(from) - Stores.reserved(st, from, 'grain');
      if (o.from === no.by || above < HELP.askLeast) return; // nothing to give: an honest cannot
      remember(st, o.from, no.by, 'refusedUs');
      remember(st, no.by, o.from, 'refusedThem');
      // could give and would not: a lord who does fails his follower (sim/followers); not the village's store, which is not his to give
      if (isHousehold(from)) emit(st, 'askRefused', { asker: o.from, by: no.by });
      log(st, `${fullName(st.pawns[no.by])} refused ${Offers.what(st, o)}.`, {
        kind: 'offerRefused',
        pawn: no.by,
        other: o.from,
        ...atHousehold(st, Offers.partyOf(st, o.parties.from)),
      });
    },
    settle: (st, o) => {
      const from = Offers.partyOf(st, o.parties.to),
        to = Offers.partyOf(st, o.parties.from),
        far = farOf(st, from, to);
      const n = from.dissolved || to.dissolved ? 0 : askGives(st, from, to, o.wants.n);
      if (!(n > 0)) return `${nameOf(st, from)} has nothing to spare now`;
      const args = { good: o.wants.good, n };
      if (far) {
        const c = carrierOf(st, from);
        if (c < 0) return `no one of ${nameOf(st, from)} is free to carry it`;
        args.carrier = c;
        args.n = Math.min(n, TRAVEL.load);
      }
      if (!isHousehold(from)) args.store = from.id;
      // the grain is set aside where it lies and fetched by the asker's household (VB-461, VB-861), or carried by the giver's man from far
      return issue(st, {
        actor: !isHousehold(from) ? o.to : from.holder !== null ? from.holder : { household: from.id },
        verb: 'deliver',
        target: to.id,
        args,
        source: 'offer',
      });
    },
  });
  // For the panel (VB-218): what giver would give up to receiver (pawn ids) in one deal toward receiver's household, and its parts, as
  // Rules.explain returns them; null unless giver holds a household and receiver lives in another. Reads only; its own context.
  function explainAllowance(st, giver, receiver) {
    const from = holdingOf(st, giver),
      h = st.pawns[receiver].household,
      to = h !== null ? st.households[h] : null;
    if (!from || !to || to === from || to.dissolved) return null;
    const out = Rules.explain(st, 'allowance', { giver, receiver, from, to }),
      word = VB['sim/traits'].wordOf(st, giver, 'generosity'); // "own reserve: open-handed" (VB-520; design.md, The twelve traits)
    if (word) for (const q of out.parts) if (q.key === 'reserve') q.label += ': ' + word;
    for (const q of out.parts) if (q.key === 'mood') q.label += ': ' + moodWord(moodOf(st, giver)); // "Mood: low" (VB-875)
    return out;
  }
  // ---- goods at the fair (VB-299; design.md, The fair: Need and Keeping goods; target-v2 5.1). VB-302's deals read these. ----
  // need's term for ale (sim/hunger declares the rule; tar's is sim/tar's, VB-301): ale its worth with an occasion ahead (a wedding, a
  // funeral ale, hosting), half otherwise, and no household has an occasion ahead until occasions come (VB-126, VB-305).
  const ALE = { noOccasion: 0.5 };
  Rules.contribute({
    rule: 'need',
    source: 'sim/exchange',
    key: 'ale',
    label: 'Ale, for an occasion ahead (occasions from VB-126)',
    tunables: ['ALE.noOccasion'],
    value: (st, c) => (c.good.id === 'ale' ? ALE.noOccasion * c.n * Norms.norm('worth', 'ale') : 0),
  });
  // A keeping good is worth its customary worth to a taker with no need of it, for the quanta that keep what it holds to pass on within
  // KEEPING.cap rations' worth (one back load; design.md, The fair, Keeping goods).
  const KEEPING = { cap: 30 };
  const needCtx = { hh: null, good: null, n: 0, kept: 0 }; // reused, so needValue allocates nothing
  // What n quanta of a good are worth to household hh now, in rations of its welfare (n below 0: what giving them up costs it, as a negative);
  // kept: the customary worth of the keeping goods it already holds to pass on. The greater of its need and, taking a keeping good, its
  // worth as one.
  function needValue(st, hh, good, n, kept = 0) {
    const g = Goods.goodOf(good);
    needCtx.hh = hh;
    needCtx.good = g;
    needCtx.n = n;
    needCtx.kept = kept;
    const v = Rules.value(st, 'need', needCtx);
    needCtx.hh = null;
    if (!(n > 0) || !g.keeping) return v;
    const worth = Norms.norm('worth', good),
      keep = Math.min(n, Math.floor((KEEPING.cap - kept) / worth + 1e-9));
    return keep > 0 ? Math.max(v, keep * worth) : v;
  }
  // What custom calls household hh giving a quantum of `give` for one of `take` (a word of Norms.PROPER): within a class ordinary, food
  // for an animal admired, an animal (a ware) given for food while hh holds fewer than Norms.NORMS.hardBelowDays of its need a hard
  // bargain, land in no deal. A deal is called by the worse of its two sides' words.
  const propriety = (st, hh, give, take) =>
    Norms.norm('proper', Goods.goodOf(give).class, Goods.goodOf(take).class, daysOfFood(st, hh));
  // households holding a parent, child or sibling of a member, closest first (parents and children before siblings, then by id); food help
  // asks them first (sim/help), and so does a household that wants a cow (VB-390)
  function kinHouseholds(st, hh) {
    const rank = new Map();
    const note = (id, r) => {
      const q = st.pawns[id];
      if (!q.alive || q.household === null || q.household === hh.id || st.households[q.household].dissolved) return;
      rank.set(q.household, Math.min(rank.get(q.household) ?? 9, r));
    };
    for (const id of hh.members) {
      const p = st.pawns[id];
      for (const par of [p.father, p.mother]) if (par !== null) note(par, 1);
      for (const c of childrenOf(st, id)) note(c, 1);
      for (const s of siblingsOf(st, id)) note(s, 2);
    }
    return [...rank].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map((x) => x[0]);
  }
  // ---- a cow for a household with a meadow and none (VB-390; QUESTION_ARCHIVE.md, VB-284, question 5) ----
  // @state plan.want (a household's standing plan; VB-390): {what: 'cow', from (the household that gives it, or null while none is found),
  //   kind ('heifer' | 'cow', or null), by ('kin': a start in life at a marriage, 'deal', or null)} while the household has HERD.want.hands
  //   working hands or more, holds a meadow and has no cattle; null or absent otherwise. Written only here: at the plan's review (sim/plans
  //   calls reviewWant), at a marriage (startInLife) and when the animal is led home (the kind `lead`).
  const ASKED = ['heifer', 'cow']; // what a household asks for, the cheaper first
  const wantOf = (st, hh) => {
    const plan = st.plans.households.get(hh.id);
    return plan && plan.want ? plan.want : null;
  };
  const hasCattle = (st, hh) =>
    hh.herds.some((id) => st.herds[id].species === 'cattle' && st.herds[id].head.length > 0);
  // The head's choice of a cow (sim/plans' plan.chosen.cow, its verb `target`; VB-253): 0 none, 1 wanted, null the rule's.
  const chosenCow = (st, hh) => {
    const plan = st.plans.households.get(hh.id);
    return plan && plan.chosen ? plan.chosen.cow : null;
  };
  // A household wants a cow while it has HERD.want.hands working hands (14 to 59, not retired, as sim/fields counts them), holds a hay
  // meadow and has no cattle; its head's choice comes first (none, or wanted whatever its hands while it holds a meadow and has no cattle).
  function cowWanted(st, hh) {
    const f = hh.dissolved || hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
      choice = f ? chosenCow(st, hh) : 0;
    if (choice === 0 || !f.meadows.length || hasCattle(st, hh)) return false;
    if (choice === 1) return true;
    let hands = 0;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = age(st, p);
      if (p.died === null && a >= 14 && a < 60 && !p.retired && ++hands >= HERD.want.hands) return true;
    }
    return false;
  }
  // Whether hh can spare an animal of `kind` above its own plan: sim/herds' giveAnimal's rule read ahead (it keeps a cow, so its own want
  // is met, and its winter's hay); giveAnimal checks it again when the animal is led away.
  function spares(st, hh, kind) {
    if (hh.dissolved) return false;
    let has = false,
      cows = 0;
    for (const hd of herdsOf(st, hh))
      if (hd.species === 'cattle')
        for (const h of hd.head) {
          if (h.kind === kind) has = true;
          if (h.kind === 'cow') cows++;
        }
    return (
      has && (kind === 'cow' ? cows - 1 : cows) >= 1 && hh.hay >= winterNeed(st, hh) - HERD.hay[kind] * HERD.stallDays
    );
  }
  const worthOf = (kind) => Norms.norm('worth', 'cattle/' + kind); // the one table of customary worth (VB-299)
  VB.counter(
    'cowSeek',
    "Households of its village weighed by a household's open want of a cow, on its planning day (sim/exchange; VB-390)",
  );
  // A deal for the want: among the households of its village, kin first (kinHouseholds), then the others in the order of its farms, the first that spares a
  // heifer, or else a cow, and whose allowance toward the household covers its customary worth (the gift for now: the animal is given and
  // its worth booked as goodwill when it is home). Sets the want's giver, or leaves it open.
  function seek(st, hh, w) {
    const v = st.villages[st.farmsteads[hh.farmstead].village],
      mine = new Set();
    for (const fid of v.farmsteads) {
      const id = st.farmsteads[fid].household;
      if (id !== null && id !== hh.id) mine.add(id);
    }
    const order = kinHouseholds(st, hh).filter((id) => mine.has(id));
    for (const id of mine) if (!order.includes(id)) order.push(id);
    for (const id of order) {
      VB.count.cowSeek++;
      const from = st.households[id];
      for (const kind of ASKED) {
        if (!spares(st, from, kind)) continue;
        if (assessGift(st, { from, to: hh, n: worthOf(kind) }).allowance + TOLERANCE < worthOf(kind)) break;
        w.from = id;
        w.kind = kind;
        w.by = 'deal';
        return;
      }
    }
  }
  const open = (w) => {
    w.from = null;
    w.kind = null;
    w.by = null;
  };
  // At each review of the household's standing plan (sim/plans): the want made or dropped by cowWanted; a giver that can no longer spare its
  // animal let go; on its planning day (why 'day'), an open want looks for a deal.
  function reviewWant(st, plan, hh, why) {
    if (!cowWanted(st, hh)) {
      if (plan.want) plan.want = null;
      return;
    }
    if (!plan.want) plan.want = { what: 'cow', from: null, kind: null, by: null };
    const w = plan.want;
    if (w.from !== null && !spares(st, st.households[w.from], w.kind)) open(w);
    if (w.from === null && why === 'day') seek(st, hh, w);
  }
  // A marriage (sim/lifecycle): the household `to` the couple lives in wants a cow, and `from`, the old household of the spouse who moved
  // in, of the same village, spares a heifer: she is its start in life, given and not booked (as a new household's start, sim/cottage). True
  // when promised; the household's own members lead her home.
  function startInLife(st, to, from) {
    const plan = st.plans.households.get(to.id);
    if (!plan || !from || from === to || from.dissolved || !cowWanted(st, to)) return false;
    if (plan.want && plan.want.from !== null) return false;
    if (st.farmsteads[from.farmstead].village !== st.farmsteads[to.farmstead].village || !spares(st, from, 'heifer'))
      return false;
    plan.want = { what: 'cow', from: from.id, kind: 'heifer', by: 'kin' };
    return true;
  }
  // The animal is home: taken from the giver's herd into the household's (sim/herds; with hay above the giver's winter need), its worth
  // booked as goodwill in a deal, the want met. The giver that can no longer spare it leaves the want open.
  function ledHome(st, j, hh) {
    const w = wantOf(st, hh);
    if (!w || w.from !== j.from) return;
    const from = st.households[w.from],
      kind = w.kind,
      worth = worthOf(kind);
    // a deal is between two living holders: when one has died on the way, it lapses and the want is open again
    if (w.by === 'deal' && [from.holder, hh.holder].some((h) => h !== null && !st.pawns[h].alive)) {
      open(w);
      return;
    }
    if (!(payInAnimals(st, from, hh, worth, [kind], true) > 0)) {
      open(w);
      return;
    }
    const plan = st.plans.households.get(hh.id);
    plan.want = null;
    const name = st.farmsteads[from.farmstead].name,
      home = st.farmsteads[hh.farmstead].name;
    if (w.by === 'deal' && from.holder !== null && hh.holder !== null && from.holder !== hh.holder)
      book(st, from.holder, hh.holder, worth);
    const how = w.by === 'kin' ? 'as a start in life' : 'in a deal';
    if (hh.holder !== null)
      personEvent(st, hh.holder, w.by === 'kin' ? 'share' : 'gift', `Was given a ${kind} from ${name} ${how}`, {
        n: worth,
        other: from.holder,
        ...atHousehold(st, hh),
      });
    if (from.holder !== null)
      personEvent(st, from.holder, w.by === 'kin' ? 'share' : 'gift', `Gave a ${kind} to ${home} ${how}`, {
        n: worth,
        other: hh.holder,
        ...atHousehold(st, from),
      });
  }
  // The kind `lead` (sim/kinds): a member walks to the giver's byre and leads the animal home (no animal appears where it has not walked).
  // Posted at the household's farm while its want has a giver and the herds are out of the byre (an animal led home in winter would come to
  // a barn without its hay).
  const KIND = {
    verb: 'Haltering the animal',
    go: 'Going to fetch a cow',
    name: 'Fetch a cow',
    at: ['farm'],
    needs: ['cattle'],
    gives: ['cattle'],
    label: 'Fetching a cow',
    anim: null,
    hours: 0.5,
    hands: 1,
    type: 'husbandry',
    spot: (st, a, j) => [st.w.hx[j.site] - 20 + a.ox * 0.3, st.w.hy[j.site] + 5 + a.oy * 0.2], // by the giver's byre door
    urgency: (st, j, c, U) => U.other,
    available: (st, hh, f, c, post) => {
      const w = wantOf(st, hh);
      if (!w || w.from === null || stalled(c)) return;
      const from = st.households[w.from];
      if (from.dissolved || from.farmstead === null) return;
      post(`lead:h${hh.id}:${w.from}`, st.farmsteads[from.farmstead].house, { farm: f, from: w.from });
    },
  }; // the animals haltered at the site and led home, as a load in hand: set down at the door by the kind's delivery (VB-1750)
  VB['sim/methods'].carry(KIND, 'lead', {
    look: 'cow',
    words: 'Leading the cow home',
    deliver: (st, j, hh) => ledHome(st, j, hh), // left at the door (VB-1748): the animal led is paid at the door, not a load made
    name: 'led',
    op: 'halter',
    led: true,
    run: (st, j, g, at, a) => {
      a.load = 1;
    },
    met: (st, g) => (g.job.made || 0) > 0,
  });

  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['explainAllowance', 'giftWarning'],
    carrierOf,
    assessGift,
    settleGift,
    receive,
    booked,
    explainAllowance,
    giftWarning,
    needValue,
    propriety,
    KEEPING,
    ALE,
    kinHouseholds,
    cowWanted,
    reviewWant,
    startInLife,
    KIND,
  };
})();
