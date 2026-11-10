// @sys sim/exchange: deals between parties, the gift for now (VB-216): whether one goes ahead (the floor, allowance), and settling it through
// sim/stores and sim/relations, its worth booked as goodwill between the two holders (VB-217); owns no state
VB['sim/exchange'] = (() => {
  const Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'];
  const { addTie, book, balance, ALLOWANCE_BOUND } = VB['sim/relations'];
  const { HELP, GOODWILL } = VB['sim/rules'];
  const { personEvent, atHousehold, holdingOf } = VB['sim/records'];
  const { floorOf, dailyNeed, servedLast } = VB['sim/hunger'];
  // allowance's goodwill term (design.md, The gift: Allowance), relations' quantity, contributed here because its limit needs the receiving
  // household's need: plus what the giver owes the receiver, minus what the receiver owes beyond GOODWILL.limitDays of its household's
  // need. 0 until slice 4 switches it on (GOODWILL.acts, VB-220).
  Rules.contribute({ rule: 'allowance', source: 'sim/relations', key: 'goodwill', label: GOODWILL.acts ? 'Goodwill' : 'Goodwill (acts from slice 4)',
    range: [-ALLOWANCE_BOUND, ALLOWANCE_BOUND], tunables: ['GOODWILL.acts', 'GOODWILL.limitDays'],
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
  return { assessGift, settleGift, explainAllowance, giftWarning };
})();
