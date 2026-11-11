// @sys sim/exchange: deals between parties, the gift for now (VB-216): whether one goes ahead (the floor, allowance), and settling it through
// sim/stores and sim/relations, its worth booked as goodwill between the two holders (VB-217); owns no state
VB['sim/exchange'] = (() => {
  const Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'];
  const { addTie, book, balance } = VB['sim/relations'];
  const { HELP, GOODWILL } = VB['sim/rules'];
  const { personEvent, atHousehold, holdingOf } = VB['sim/records'];
  const { floorOf, dailyNeed, servedLast, daysOfFood } = VB['sim/hunger'];
  const Culture = VB['culture'];
  // allowance's goodwill term (design.md, The gift: Allowance), relations' quantity, contributed here because its limit needs the receiving
  // household's need: plus what the giver owes the receiver, minus what the receiver owes beyond GOODWILL.limitDays of its household's
  // need. 0 until slice 4 switches it on (GOODWILL.acts, VB-220).
  Rules.contribute({ rule: 'allowance', source: 'sim/exchange', key: 'goodwill', label: GOODWILL.acts ? 'Goodwill' : 'Goodwill (acts from slice 4)',
    tunables: ['GOODWILL.acts', 'GOODWILL.limitDays'],
    value: (st, c) => {
      if (!GOODWILL.acts || c.giver === null || c.receiver === null) return 0;
      const owed = balance(st, c.giver, c.receiver); // > 0: the receiver owes the giver
      return owed < 0 ? -owed : -Math.max(0, owed - GOODWILL.limitDays * dailyNeed(st, c.to));
    } });
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
    let floorOk, allowance = Infinity;
    if (isHousehold(o.from)) {
      floorOk = o.from.grain - o.n >= floorOf(st, o.from) - TOLERANCE;
      ctx.giver = o.from.holder; ctx.receiver = isHousehold(o.to) ? o.to.holder : null; ctx.from = o.from; ctx.to = o.to;
      allowance = Rules.value(st, 'allowance', ctx);
    } else floorOk = o.n <= o.from.grain + TOLERANCE;
    const player = o.source === 'player', within = o.n <= allowance + TOLERANCE;
    const why = !floorOk && (!player || !isHousehold(o.from)) ? `it would take ${nameOf(st, o.from)} below its floor`
      : !within && !player ? `${nameOf(st, o.from)} would give at most ${Math.round(allowance)} rations` : null;
    return { floorOk, allowance, accept: why === null, why };
  }
  // What the player is told before its pawn's household gives n below its floor (VB-221; The gift: the player's gift): null when the
  // gift leaves the floor whole, else {below (rations under the floor after it), days (the floor's days of need), hungry (the members
  // its feed order serves last, as pawn ids)}. Reads only; the gift itself is the verb's.
  function giftWarning(st, from, n) {
    if (!isHousehold(from)) return null;
    const below = floorOf(st, from) - (from.grain - n);
    return below > TOLERANCE ? { below, days: HELP.floorDays, hungry: servedLast(st, from) } : null;
  }
  // The gift's moves and records, as help made them (help.js, VB-039): the receiver's grain and its holder's event, then the giver's,
  // the tie between the two holders, and the goodwill booked between them.
  function receive(st, from, to, n, fromName) {
    Stores.put(st, to, 'grain', n, { kind: 'gift', from: fromName });
    const ht = to.holder !== null ? st.pawns[to.holder] : null;
    if (ht) personEvent(st, ht.id, 'gift', `Received ${Math.round(n)} grain from ${fromName}`, {
      n: Math.round(n), other: from && from.holder !== null ? from.holder : null, ...atHousehold(st, to) });
    if (from) {
      Stores.take(st, from, 'grain', n, { kind: 'gift', to: st.farmsteads[to.farmstead].name });
      const hf = from.holder !== null ? st.pawns[from.holder] : null;
      if (hf) personEvent(st, hf.id, 'gift', `Gave ${Math.round(n)} grain to ${st.farmsteads[to.farmstead].name}`, ht ? false : {
        n: Math.round(n), ...atHousehold(st, to) }); // with a receiving holder, recorded above
      if (hf && ht && hf.ties && ht.ties) for (const [a, b] of [[hf, ht], [ht, hf]]) addTie(st, a.id, b.id, HELP.tieGain);
      if (hf && ht) book(st, hf.id, ht.id, n * WORTH.grain); // the giver is owed the gift's worth (Who books: the two holders)
    }
  }
  // Settles an accepted gift; only the verb `give` calls it (tests/commands.js).
  function settleGift(st, o) {
    if (!isHousehold(o.to)) Stores.move(st, o.from, o.to, 'grain', o.n, { kind: 'gift', to: 'the village store' }); // the yearly filling
    else if (!isHousehold(o.from)) { // the village store's gift
      Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }); receive(st, null, o.to, o.n, o.from.name);
    } else receive(st, o.from, o.to, o.n, st.farmsteads[o.from.farmstead].name);
  }
  // For the panel (VB-218): what giver would give up to receiver (pawn ids) in one deal toward receiver's household, and its parts, as
  // Rules.explain returns them; null unless giver holds a household and receiver lives in another. Reads only; its own context.
  function explainAllowance(st, giver, receiver) {
    const from = holdingOf(st, giver), h = st.pawns[receiver].household, to = h !== null ? st.households[h] : null;
    if (!from || !to || to === from || to.dissolved) return null;
    return Rules.explain(st, 'allowance', { giver, receiver, from, to });
  }
  // ---- goods at the fair (VB-299; design.md, The fair: Need and Keeping goods; target-v2 5.1). VB-302's deals read these. ----
  // need's terms for tar and ale (sim/hunger declares the rule): tar is worth its worth when a boat or the house is due, which nothing is
  // until boats and the house's condition come (VB-300, VB-301, VB-306), so only as a keeping good; ale its worth with an occasion ahead (a
  // wedding, a funeral ale, hosting), half otherwise, and no household has an occasion ahead until occasions come (VB-126, VB-305).
  const ALE = { noOccasion: 0.5 };
  Rules.contribute({ rule: 'need', source: 'sim/exchange', key: 'tar', label: 'Tar, for a boat or the house due (from VB-301)', range: [0, 0],
    tunables: [], value: () => 0 });
  Rules.contribute({ rule: 'need', source: 'sim/exchange', key: 'ale', label: 'Ale, for an occasion ahead (occasions from VB-126)', 
    tunables: ['ALE.noOccasion'], value: (st, c) => (c.good.id === 'ale' ? ALE.noOccasion * c.n * Culture.norm('worth', 'ale') : 0) });
  // A keeping good is worth its customary worth to a taker with no need of it, for the quanta that keep what it holds to pass on within
  // KEEPING.cap rations' worth (one back load; design.md, The fair, Keeping goods).
  const KEEPING = { cap: 30 };
  const needCtx = { hh: null, good: null, n: 0, kept: 0 }; // reused, so needValue allocates nothing
  // What n quanta of a good are worth to household hh now, in rations of its welfare (n below 0: what giving them up costs it, as a negative);
  // kept: the customary worth of the keeping goods it already holds to pass on. The greater of its need and, taking a keeping good, its
  // worth as one.
  function needValue(st, hh, good, n, kept = 0) {
    const g = Stores.goodOf(good);
    needCtx.hh = hh; needCtx.good = g; needCtx.n = n; needCtx.kept = kept;
    const v = Rules.value(st, 'need', needCtx);
    needCtx.hh = null;
    if (!(n > 0) || !g.keeping) return v;
    const worth = Culture.norm('worth', good), keep = Math.min(n, Math.floor((KEEPING.cap - kept) / worth + 1e-9));
    return keep > 0 ? Math.max(v, keep * worth) : v;
  }
  // What custom calls household hh giving a quantum of `give` for one of `take` (a word of Culture.PROPER): within a class ordinary, food
  // for an animal admired, an animal (a ware) given for food while hh holds fewer than Culture.NORMS.hardBelowDays of its need a hard
  // bargain, land in no deal. A deal is called by the worse of its two sides' words.
  const propriety = (st, hh, give, take) => Culture.norm('proper', Stores.goodOf(give).class, Stores.goodOf(take).class, daysOfFood(st, hh));
  return { assessGift, settleGift, explainAllowance, giftWarning, needValue, propriety, KEEPING, ALE };
})();
