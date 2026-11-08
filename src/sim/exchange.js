// @sys sim/exchange: deals between parties, the gift for now (VB-216): whether one goes ahead (the floor, allowance), and settling it through
// sim/stores and sim/relations; owns no state
VB['sim/exchange'] = (() => {
  const Stores = VB['sim/stores'];
  const Rules = VB['sim/registry'];
  const { strengthenTie } = VB['sim/relations'];
  const { HELP } = VB['sim/rules'];
  const { personEvent, atHousehold } = VB['sim/records'];
  const { floorOf } = VB['sim/hunger'];
  // A gift {from, to, good, n, source}: from and to are households or villages (a village gives from its store, or takes the yearly
  // filling). Sizes are compared with a tolerance, since the size help asks for is reckoned apart from the allowance's sum.
  const TOLERANCE = 1e-9;
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
  // The gift's moves and records, as help made them (help.js, VB-039): the receiver's grain and its holder's event, then the giver's,
  // and the tie between the two holders.
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
      if (hf && ht && hf.ties && ht.ties) for (const [a, b] of [[hf, ht], [ht, hf]]) strengthenTie(st, a.id, b.id, HELP.tieGain);
    }
  }
  // Settles an accepted gift; only the verb `give` calls it (tests/commands.js).
  function settleGift(st, o) {
    if (!isHousehold(o.to)) Stores.move(st, o.from, o.to, 'grain', o.n, { kind: 'gift', to: 'the village store' }); // the yearly filling
    else if (!isHousehold(o.from)) { // the village store's gift
      Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }); receive(st, null, o.to, o.n, o.from.name);
    } else receive(st, o.from, o.to, o.n, st.farmsteads[o.from.farmstead].name);
  }
  return { assessGift, settleGift };
})();
