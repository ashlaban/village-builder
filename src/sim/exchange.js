// @sys sim/exchange: deals between parties, the gift for now (VB-216): whether one goes ahead (the floor, allowance), and settling it through
// sim/stores and sim/relations, its worth booked as goodwill between the two holders (VB-217); a household's want of a cow, the deal or
// the start in life that meets it and the job that leads the animal home (VB-390); whom a household deals with first, its kin
VB['sim/exchange'] = (() => {
  const Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'];
  const { addTie, book, balance, opinionOf } = VB['sim/relations'];
  const { HELP, GOODWILL, HERD, stalled } = VB['sim/rules'];
  const { personEvent, atHousehold, holdingOf, age, childrenOf, siblingsOf } = VB['sim/records'];
  const { herdsOf, winterNeed, payInAnimals } = VB['sim/herds'];
  const { floorOf, dailyNeed, servedLast, daysOfFood } = VB['sim/hunger'];
  const Culture = VB['culture'];
  // allowance's goodwill term (design.md, The gift: Allowance), relations' quantity, contributed here because its limit needs the receiving
  // household's need: plus what the giver owes the receiver, minus what the receiver owes beyond GOODWILL.limitDays of its household's
  // need. Switched on by GOODWILL.acts (VB-220).
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/exchange',
    key: 'goodwill',
    label: 'Goodwill',
    tunables: ['GOODWILL.acts', 'GOODWILL.limitDays'],
    value: (st, c) => {
      if (!GOODWILL.acts || c.giver === null || c.receiver === null) return 0;
      const owed = balance(st, c.giver, c.receiver); // > 0: the receiver owes the giver
      return owed < 0 ? -owed : -Math.max(0, owed - GOODWILL.limitDays * dailyNeed(st, c.to));
    },
  });
  // allowance's opinion term (design.md, The gift: Allowance; Kim, 10 Nov): the giver's opinion of the receiver, -1 to 1, times
  // GOODWILL.opinionRations. Coupled with goodwill, which colours opinion (gratitude): a high opinion lets a deal through.
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/exchange',
    key: 'opinion',
    label: 'Opinion of them',
    tunables: ['GOODWILL.acts', 'GOODWILL.opinionRations'],
    value: (st, c) =>
      !GOODWILL.acts || c.giver === null || c.receiver === null
        ? 0
        : GOODWILL.opinionRations * opinionOf(st, c.giver, c.receiver),
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
      within = o.n <= allowance + TOLERANCE;
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
  // and its holder's event, then the giver's, the tie between the two holders, and the goodwill booked between them.
  function receive(st, from, to, n, fromName, parts) {
    Stores.put(st, to, 'grain', n, { kind: 'gift', from: fromName }, parts);
    const ht = to.holder !== null ? st.pawns[to.holder] : null;
    if (ht)
      personEvent(st, ht.id, 'gift', `Received ${Math.round(n)} grain from ${fromName}`, {
        n: Math.round(n),
        other: from && from.holder !== null ? from.holder : null,
        ...atHousehold(st, to),
      });
    if (from) {
      const hf = from.holder !== null ? st.pawns[from.holder] : null;
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
      if (hf && ht && hf.ties && ht.ties)
        for (const [a, b] of [
          [hf, ht],
          [ht, hf],
        ])
          addTie(st, a.id, b.id, HELP.tieGain);
      if (hf && ht) book(st, hf.id, ht.id, n * WORTH.grain); // the giver is owed the gift's worth (Who books: the two holders)
    }
  }
  // Settles an accepted gift; only the verb `give` calls it (tests/commands.js).
  function settleGift(st, o) {
    if (!isHousehold(o.to))
      Stores.move(st, o.from, o.to, 'grain', o.n, { kind: 'gift', to: 'the village store' }); // the yearly filling
    else {
      // the giver's grain goes in the proportion it holds its crops (VB-347): taken first, then received
      const parts = {},
        fromName = isHousehold(o.from) ? st.farmsteads[o.from.farmstead].name : o.from.name;
      Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }, parts);
      receive(st, isHousehold(o.from) ? o.from : null, o.to, o.n, fromName, parts);
    }
  }
  // For the panel (VB-218): what giver would give up to receiver (pawn ids) in one deal toward receiver's household, and its parts, as
  // Rules.explain returns them; null unless giver holds a household and receiver lives in another. Reads only; its own context.
  function explainAllowance(st, giver, receiver) {
    const from = holdingOf(st, giver),
      h = st.pawns[receiver].household,
      to = h !== null ? st.households[h] : null;
    if (!from || !to || to === from || to.dissolved) return null;
    return Rules.explain(st, 'allowance', { giver, receiver, from, to });
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
    value: (st, c) => (c.good.id === 'ale' ? ALE.noOccasion * c.n * Culture.norm('worth', 'ale') : 0),
  });
  // A keeping good is worth its customary worth to a taker with no need of it, for the quanta that keep what it holds to pass on within
  // KEEPING.cap rations' worth (one back load; design.md, The fair, Keeping goods).
  const KEEPING = { cap: 30 };
  const needCtx = { hh: null, good: null, n: 0, kept: 0 }; // reused, so needValue allocates nothing
  // What n quanta of a good are worth to household hh now, in rations of its welfare (n below 0: what giving them up costs it, as a negative);
  // kept: the customary worth of the keeping goods it already holds to pass on. The greater of its need and, taking a keeping good, its
  // worth as one.
  function needValue(st, hh, good, n, kept = 0) {
    const g = Stores.goodOf(good);
    needCtx.hh = hh;
    needCtx.good = g;
    needCtx.n = n;
    needCtx.kept = kept;
    const v = Rules.value(st, 'need', needCtx);
    needCtx.hh = null;
    if (!(n > 0) || !g.keeping) return v;
    const worth = Culture.norm('worth', good),
      keep = Math.min(n, Math.floor((KEEPING.cap - kept) / worth + 1e-9));
    return keep > 0 ? Math.max(v, keep * worth) : v;
  }
  // What custom calls household hh giving a quantum of `give` for one of `take` (a word of Culture.PROPER): within a class ordinary, food
  // for an animal admired, an animal (a ware) given for food while hh holds fewer than Culture.NORMS.hardBelowDays of its need a hard
  // bargain, land in no deal. A deal is called by the worse of its two sides' words.
  const propriety = (st, hh, give, take) =>
    Culture.norm('proper', Stores.goodOf(give).class, Stores.goodOf(take).class, daysOfFood(st, hh));
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
  // A household wants a cow while it has HERD.want.hands working hands (14 to 59, not retired, as sim/fields counts them), holds a hay
  // meadow and has no cattle.
  function cowWanted(st, hh) {
    const f = hh.dissolved || hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || !f.meadows.length || hasCattle(st, hh)) return false;
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
  const worthOf = (kind) => Culture.norm('worth', 'cattle/' + kind); // the one table of customary worth (VB-299)
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
    if (!(payInAnimals(st, from, hh, worth, [kind]) > 0)) {
      open(w);
      return;
    }
    const plan = st.plans.households.get(hh.id);
    plan.want = null;
    const name = st.farmsteads[from.farmstead].name,
      home = st.farmsteads[hh.farmstead].name;
    if (w.by === 'deal' && from.holder !== null && hh.holder !== null) book(st, from.holder, hh.holder, worth);
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
    back: 'Leading the cow home',
    name: 'Fetch a cow',
    label: 'Fetching a cow',
    anim: null,
    hours: 0.5,
    hands: 1,
    type: 'husbandry',
    carry: 'cow',
    to: 'barn',
    spot: (st, a, j) => [st.w.hx[j.site] - 20 + a.ox * 0.3, st.w.hy[j.site] + 5 + a.oy * 0.2], // by the giver's byre door
    urgency: (st, j, c, U) => U.other,
    deliver: (st, j, hh) => ledHome(st, j, hh),
    available: (st, hh, f, c, post) => {
      const w = wantOf(st, hh);
      if (!w || w.from === null || stalled(c)) return;
      const from = st.households[w.from];
      if (from.dissolved || from.farmstead === null) return;
      post(`lead:h${hh.id}:${w.from}`, st.farmsteads[from.farmstead].house, { farm: f, from: w.from });
    },
  };
  return {
    assessGift,
    settleGift,
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
