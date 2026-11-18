// @sys sim/gifts: how a gift gets from here to there (VB-228): the verbs `give`, the offer of a gift, and `deliver`, what a yes settles: carried,
// hauled or fetched (sim/away) between places, booked at once within one farmstead (sim/exchange)
VB['sim/gifts'] = (() => {
  const { haulerOf, fetcherOf, carryGift, haulGift, fetchGift } = VB['sim/away'];
  const { cannotOffer, giftOf, make, delivery } = VB['sim/offers'];
  const { home } = VB['sim/records'];
  const { settleGift } = VB['sim/exchange'];
  const { register } = VB['sim/commands'];
  // Why gift g (sim/offers giftOf) cannot be fetched, or null: one to a household from another farmstead or a village store, with no
  // carrier, is set aside where it lies and fetched by a member of the receiving household (VB-461), who must be free to go.
  const fetched = (g) =>
    !g.carrier && 'farmstead' in g.to && !('farmstead' in g.from && g.from.farmstead === g.to.farmstead);
  // A household's gift to its village's store, with no carrier, is carried to the green by a member of the giving household (VB-849).
  const hauled = (g) => !g.carrier && 'farmstead' in g.from && !('farmstead' in g.to);
  function fetchWhy(st, g) {
    if (typeof g !== 'string' && hauled(g))
      return haulerOf(st, g.from) < 0 ? 'no one of the household can carry it' : null;
    // a store's grain goes to a household, never at once to another store (VB-1111: what is left for settleGift is within one farmstead)
    if (typeof g !== 'string' && !('farmstead' in g.from) && !('farmstead' in g.to))
      return 'a village store gives only to a household';
    if (typeof g === 'string' || !fetched(g)) return null;
    return fetcherOf(st, g.to) < 0 ? 'no one of the household can fetch it' : null;
  }
  // A `give` command as the offer of a gift (VB-690): to the receiving household's holder, or the household or village itself where no pawn
  // holds it; the terms are the command's args
  function giftOffer(st, c) {
    const t = c.target,
      hh = Number.isInteger(t) && home(st, t) ? st.households[t] : null,
      to = hh && hh.holder !== null ? hh.holder : Number.isInteger(t) ? { household: t } : t;
    return { actor: c.actor, verb: 'offer', target: to, args: { basis: 'gift', gives: c.args }, source: c.source };
  }
  // give(target, {good, n, carrier}) (source 'help', 'player'; VB-216): the offer of a gift, made by the actor's household, or its village
  // store, to household `target` or the village store (target {village}); refused when it would take the giver below its floor or beyond
  // its allowance (sim/exchange). The receiver's holder answers it; a yes delivers it.
  register('give', {
    check: (st, c) =>
      cannotOffer(st, giftOffer(st, c)) || fetchWhy(st, giftOf(st, c.actor, c.target, c.args, c.source)),
    // help (source 'help') answers a hungry household's ask (sim/help): its receiver said yes in asking
    run: (st, c) => make(st, giftOffer(st, c), c.source === 'help' ? ['to'] : []),
  });
  // deliver(target, {good, n, carrier}) (source 'offer' only: what a yes settles): the actor's household, or village store, hands over n
  // of good to household `target` or the village store; with a carrier (a pawn of the giving household) it is carried to the receiver
  // and booked there when he arrives (VB-291); from another farmstead or a village store with none, it is set aside where it lies and
  // fetched by a member of the receiving household (VB-461: fetchWhy). Refused when the goods are no longer there.
  register('deliver', {
    check: (st, c) => {
      if (c.source !== 'offer') return 'goods are delivered only as an offer settles';
      const g = delivery(st, c);
      return typeof g === 'string' ? g : fetchWhy(st, g);
    },
    run: (st, c) => {
      const g = delivery(st, c);
      if (g.carrier !== undefined) carryGift(st, g);
      else if (hauled(g))
        haulGift(st, Object.assign(g, { hauler: haulerOf(st, g.from) })); // set aside, carried to the green (VB-849)
      else if (fetched(g))
        fetchGift(st, Object.assign(g, { fetcher: fetcherOf(st, g.to) })); // set aside, fetched (VB-461)
      else settleGift(st, g);
    },
  });
  return {};
})();
