// @sys sim/doing: the game's view for sim/methods (VB-1775): the readers `next` asks of the world (where a pawn stands, what it carries,
// the cart it holds, the piles with title of sim/lying, a household's store), a task's goal read from its job, and the effects of the
// steps that move goods (a cart taken, a load taken up from a pile, set down in its owner's store or where the pawn stands, a work leg's
// effect). Walking and the work legs, and the one switch between a kind with methods and one on its phases, are sim/agents'.
VB['sim/doing'] = (() => {
  const Methods = VB['sim/methods'];
  const { KINDS } = VB['sim/kinds'];
  const Carts = VB['sim/carts'],
    Lying = VB['sim/lying'],
    Stores = VB['sim/stores'];
  const { TRAVEL } = VB['sim/rules'];
  const { here } = VB['sim/pose'];
  const { teamFree } = VB['sim/work'];
  const { emit } = VB['sim/events'];
  // The goods a method carries: the kind its piles lie as (sim/lying), the load drawn (agent.carry), its store, and the store's units a
  // load of TRAVEL.load holds. A load in hand is agent.load (TRAVEL's units) of its task's owner's.
  const GOODS = {
    timber: { lying: 'wood', carry: 'logs', store: 'timber', per: (st) => st.ECON.woodPerTrip },
  };
  const BY_CARRY = { logs: 'timber' };
  const plans = Methods.compile(KINDS);
  const hhOf = (st, owner) => (owner === null || owner === undefined ? null : st.households[owner]);
  const titled = (owner) => ({ type: 'household', id: owner });
  // The goal of task j taken by pawn a: its kind, tile and owner (the household it is for: its own, or the pawn's for a village's).
  const ownerOf = (st, j, a) =>
    j.owner && j.owner.type === 'household' ? j.owner.id : a ? st.pawns[a.id].household : null;
  const goalOf = (st, a, j = a.job) => ({ kind: j.kind, at: j.site, owner: ownerOf(st, j, a), amount: 0, job: j });
  const storeOf = (st, owner) => {
    const hh = hhOf(st, owner);
    return hh && !hh.dissolved && hh.farmstead !== null && st.farmsteads[hh.farmstead]
      ? st.farmsteads[hh.farmstead].house
      : null;
  };
  const cartHeld = (st, a) => {
    const hh = hhOf(st, st.pawns[a.id].household);
    return hh ? Carts.holds(st, hh, a.id) : 0;
  };
  // The loads (TRAVEL's units) the pawn takes up at once: its cart's, no more than its task still wants; else a back load.
  function cap(st, a) {
    const c = cartHeld(st, a);
    if (!c || !a.job || !KINDS[a.job.kind].need) return TRAVEL.load;
    return Math.max(TRAVEL.load, Math.min(c, KINDS[a.job.kind].need(st, a.job) * TRAVEL.load));
  }
  // a cart of the household not out, the ox cart only with its team free (sim/carts take)
  const canTake = (st, hh) => {
    const tf = teamFree(st, hh);
    return hh.carts.some((c) => !Carts.out(st, c) && (c.kind === 'hand' || tf));
  };
  const VIEW = {
    plans,
    at: (st, a) => here(st, a),
    hands: (st, a) =>
      a.load > 0 && a.job && BY_CARRY[a.carry]
        ? { good: BY_CARRY[a.carry], n: a.load, owner: ownerOf(st, a.job, a) }
        : null,
    held: (st, a) => (cartHeld(st, a) ? 'cart' : null),
    has: (st, a, thing) => thing === 'cart' && cartHeld(st, a) > 0,
    // one of the goal's owner's carts is free to fetch, for one of its own (a helper brings no cart of another household)
    free: (st, g, a, thing) => {
      const hh = hhOf(st, g.owner);
      return thing === 'cart' && !!hh && st.pawns[a.id].household === g.owner && canTake(st, hh);
    },
    place: (st, g, a, name) => {
      if (name === 'cart') return storeOf(st, g.owner); // a cart not out stands at its house
      const P = KINDS[g.kind].places;
      return P && P[name] ? P[name](st, g) : null;
    },
    pile: (st, at, good, owner) => Lying.amountAt(st, at, GOODS[good].lying, titled(owner)),
    store: (st, owner, good) => {
      const hh = hhOf(st, owner),
        n = hh ? hh[GOODS[good].store] || 0 : 0;
      return n > 1e-9 ? n : 0;
    },
    storeOf,
    cap: (st, a) => cap(st, a),
    stage: () => false,
    stray: (st, g, good, x, y) => Lying.strayOf(st, titled(g.owner), GOODS[good].lying, x, y),
  };
  // The pawn's next leg toward its task (sim/methods next): a step, Methods.DONE, or {blocked}.
  function ask(st, a, g = goalOf(st, a)) {
    VB.count.methodAsk++;
    return Methods.next(st, g, a, VIEW);
  }
  // Where step s goes, or is done: a tile, or null (the cart's keeping place is its house).
  const placeOf = (st, a, s, g = goalOf(st, a)) =>
    s.at === 'kept' ? storeOf(st, ownerOf(st, a.job, a)) : Methods.placeOf(st, s, g, a, VIEW);
  // The cart fetched at the house (sim/carts take): its capacity, TRAVEL.load when none was free after all.
  function takeCart(st, a) {
    const hh = hhOf(st, st.pawns[a.id].household);
    return hh ? Carts.take(st, hh, a.id, teamFree(st, hh)) : TRAVEL.load;
  }
  // A load taken up from the owner's pile where the pawn stands: what was taken.
  function load(st, a, s, g = goalOf(st, a)) {
    const G = GOODS[s.good],
      n = Lying.takeAt(st, here(st, a), G.lying, titled(g.owner), cap(st, a));
    if (n > 0) {
      a.load = n;
      a.carry = G.carry;
    }
    return n;
  }
  // The load in hand set down: in its owner's store (the store's units), or, its store gone or the pawn unable to walk on, as a pile with
  // title where the pawn stands (at x, y).
  function unload(st, a, s, x, y) {
    const good = BY_CARRY[a.carry],
      G = GOODS[good],
      owner = ownerOf(st, a.job, a),
      n = a.load,
      at = here(st, a);
    if (!(n > 0)) return;
    if (s === Methods.RULE.drop || storeOf(st, owner) === null)
      Lying.put(st, G.lying, n, at, titled(owner), { x, y, of: { src: at } });
    else {
      Stores.put(st, hhOf(st, owner), G.store, (n / TRAVEL.load) * G.per(st), 'felling');
      emit(st, 'timberHome', { household: owner, tile: a.job.site, loads: Math.max(1, Math.round(n / TRAVEL.load)) });
    }
    a.load = 0;
    a.carry = null;
  }
  // The work leg of step s is done, at the tile where the pawn stands: its kind's effect (KINDS[kind].ops).
  function work(st, a, s) {
    const j = a.job;
    KINDS[j.kind].ops[s.op].run(st, j, goalOf(st, a), here(st, a));
  }
  const hoursOf = (j, s) => KINDS[j.kind].ops[s.op].hours;
  return { VIEW, GOODS, goalOf, ask, placeOf, takeCart, load, unload, work, hoursOf };
})();
