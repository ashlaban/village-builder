// @sys sim/gifts: how a gift gets from here to there (VB-228): the verbs `give`, the offer of a gift, and `deliver`, what a yes settles: carried,
// hauled or fetched (sim/away) between places, booked at once within one farmstead (sim/exchange)
VB['sim/gifts'] = (() => {
  const { setOut, addFetchStop } = VB['sim/away'];
  const { cannotOffer, giftOf, make, delivery } = VB['sim/offers'];
  const { age, home } = VB['sim/records'];
  const { booked, settleGift } = VB['sim/exchange'];
  const { register } = VB['sim/commands'];
  const HANDS = VB['sim/rules'].AGES.hands;
  const Stores = VB['sim/stores'];
  const { hoursBetween } = VB['sim/villagehours'];
  const { setDown } = VB['sim/agents'];
  // A gift of n grain from household `from` to household `to`, further than a day's walk (VB-291; Kim, 10 Nov: carried, not sent): the
  // grain leaves the giver's store as the carrier, one of its adults, sets out; the receiver books it when he arrives (delivered).
  // Only the verb `deliver` calls it.
  function carryGift(st, o) {
    const a = st.agents[o.carrier],
      parts = {};
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: st.farmsteads[o.to.farmstead].name }, parts);
    setDown(st, a);
    const hours = hoursBetween(st, st.farmsteads[o.from.farmstead].village, st.farmsteads[o.to.farmstead].village);
    setOut(st, a, o.from, o.to, false, hours, { to: o.to.id, n: o.n, parts });
  }
  // ---- a gift fetched (VB-461; AGENTS.md, the hard rule: a gift changes owner where it lies and waits there until someone fetches it) ----
  // A gift to household hh from another farmstead, or from a village store, is set aside where it lies (the giver's house, the green where
  // the store stands) as hh's, and a member of hh fetches it, TRAVEL.load a trip, walking home with each load; it is hh's to eat as each
  // load comes in. One member fetches all of hh's gifts of the day, a stop after the other.
  // j.gift of a fetch: {to (household), held (the grain on his back, 0 on the way out), parts, stops: [{at (tile), from (household id, or
  // null), village (the store's village, or null), name, left (grain still lying there), parts}]}.
  // The member of household hh who fetches its gift: the one already fetching, else its youngest of 14 or more who is not away nor
  // carrying a load home; -1 when none can go.
  function fetcherOf(st, hh) {
    for (const j of st.away)
      if (j.why === 'fetch' && j.gift && j.gift.to === hh.id && st.pawns[j.pawn].household === hh.id) return j.pawn;
    return haulerOf(st, hh);
  }
  // The youngest member of household hh of 14 or more who is not away nor carrying a load home, or -1: who goes for a gift, or takes the
  // household's quarter to the green (VB-849)
  function haulerOf(st, hh) {
    let best = -1;
    for (const id of hh.members) {
      const p = st.pawns[id],
        a = st.agents[id];
      if (!p.alive || age(st, p) < HANDS[0] || a.away !== undefined || a.phase === 'back') continue;
      if (best < 0 || age(st, p) < age(st, st.pawns[best])) best = id;
    }
    return best;
  }
  // The verb `give`'s gift o {from, to, n} set aside and fetched by o.fetcher (fetcherOf): its records at once (sim/exchange booked), its
  // grain taken from the giver to lie where it is, a stop of the fetcher's journey.
  function fetchGift(st, o) {
    const store = !('farmstead' in o.from),
      name = store ? o.from.name + "'s store" : st.farmsteads[o.from.farmstead].name,
      parts = {},
      to = st.farmsteads[o.to.farmstead];
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: to.name }, parts);
    booked(st, o.from, o.to, o.n, name);
    const stop = {
      at: store ? o.from.center : st.farmsteads[o.from.farmstead].house,
      from: store ? null : o.from.id,
      village: store ? o.from.id : null,
      name,
      left: o.n,
      parts,
    };
    const a = st.agents[o.fetcher];
    if (addFetchStop(st, a.id, stop)) return;
    setDown(st, a);
    const v = store ? o.from.id : st.farmsteads[o.from.farmstead].village;
    setOut(st, a, o.to, o.to, false, hoursBetween(st, to.village, v), {
      to: o.to.id,
      held: 0,
      parts: {},
      stops: [stop],
    });
  }
  // A household's quarter for its village's store (VB-849: the yearly filling, carried): grain of o.from, o.n of it, is set aside at its
  // house, and o.hauler, one of its members (haulerOf), carries it to the green (`v.center`) TRAVEL.load a trip; it is in the store only as
  // each load arrives. The journey's gift is a fetch's, reversed: {to (the giving household), village, held, parts, stops: [its house]}.
  function haulGift(st, o) {
    const parts = {},
      house = st.farmsteads[o.from.farmstead];
    Stores.take(st, o.from, 'grain', o.n, { kind: 'gift', to: 'the village store' }, parts);
    const a = st.agents[o.hauler];
    setDown(st, a);
    setOut(st, a, o.from, o.from, false, 1, {
      to: o.from.id,
      village: o.to.id,
      haul: true,
      held: 0,
      parts: {},
      stops: [{ at: house.house, from: o.from.id, village: null, name: house.name, left: o.n, parts }],
    });
  }
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
