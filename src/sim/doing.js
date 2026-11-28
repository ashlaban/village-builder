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
  const { here, placeOf: poseOf } = VB['sim/pose'];
  const { teamFree } = VB['sim/work'];
  const { emit } = VB['sim/events'];
  // The goods a method carries: the kind its piles lie as (sim/lying), its store, and the store's units a load of TRAVEL.load holds. A load
  // in hand is agent.load (TRAVEL's units) of its task's owner's; what it is drawn as (agent.carry), the haul leg's words and its delivery
  // are said by the method that carries it (sim/methods: its haul and unload steps, VB-1820). A good not named here is a trip's (sim/methods
  // trip, VB-1749): named for its kind, it lies as that kind, is carried in the kind's units (a.load as its `make` gives it), taken up
  // whole, and set down in the store by the kind's delivery (its method's `deliver`), reading the task, or the pile's record it was taken
  // from. A good with a `kind` is set down by that kind's delivery, not into a store: the building's timber (VB-1812), carried to its site
  // and lying as `timber` when its carrier is cut.
  // The goods left lying with no goal of their own (sim/lying BRING, VB-1814) and the hay are taken up a load at a time (`loads`: the
  // cart's or the back's, hay by the rule of every load of hay), not whole as a trip's pile.
  const GOODS = {
    timber: { lying: 'wood', store: 'timber', per: (st) => st.ECON.woodPerTrip },
    sitetimber: { lying: 'timber', kind: 'timber' },
    leftTimber: { lying: 'leftTimber', kind: 'leftTimber', loads: true },
    leftGrain: { lying: 'leftGrain', kind: 'leftGrain', loads: true },
    leftCart: { lying: 'leftCart', kind: 'leftCart', loads: true },
    hay: { lying: 'hay', kind: 'hay', loads: true, hay: true },
  };
  // A good named by what it is is a trip's pile by default (VB-1813: stone, fish, game, not the kind that made it): `trip`, set down and
  // delivered by the kind of the task that carries it
  const goodOf = (good) => GOODS[good] || { lying: good, trip: true };
  const byKind = (good) => !!goodOf(good).trip || !!goodOf(good).kind;
  const plans = Methods.compile(KINDS);
  // A kind's plan, compiled on its first ask when the kind was added after load, or its record replaced (a test's kind, declared with its
  // methods as a module's are; VB-1750): the plan is the record's, never a stale one of the same name
  const planOf = (k) => {
    const K = KINDS[k];
    if (!K) return null;
    const P = plans[k];
    return P && P.kind === K ? P : Object.assign(plans, Methods.compile({ [k]: K }))[k];
  };
  // The good a load in hand for a task of kind k is: the one its methods take up (one a kind).
  const loaded = (k) => {
    const P = planOf(k);
    return P && P.uses.length ? P.uses[0] : null;
  };
  // What kind k's methods say of a load of good (its first loaded good): {look, words, deliver}, or null (VB-1820).
  const said = (k, good = loaded(k)) => {
    const P = planOf(k);
    return P && good !== null ? P.goods[good] || null : null;
  };
  // the load drawn (agent.carry) and the haul leg's words of a load in hand for a task of kind k, or null
  const lookOf = (k, good) => (said(k, good) || {}).look ?? null;
  const wordsOf = (k) => (said(k) || {}).words ?? null;
  // where kind k's loads are set down (its method's first unload: 'store', a place of the kind's), or null for a kind that carries none
  const carriesTo = (k) => {
    const P = KINDS[k] ? planOf(k) : null;
    return P ? P.to : null;
  };
  const hhOf = (st, owner) => (owner === null || owner === undefined ? null : st.households[owner]);
  const titled = (owner) => ({ type: 'household', id: owner });
  // A pile's title for a task: a village's task keeps its own (its timber, its well stone lie as the village's: title moves at once, design.md
  // section 1), a household's, or one with no owner, the household's (VB-1812 revision)
  const titleOf = (j, owner) => (j && j.owner && j.owner.type !== 'household' ? j.owner : titled(owner));
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
  function cap(st, a, good) {
    const c = cartHeld(st, a),
      G = good ? goodOf(good) : null;
    if (G && G.loads) return G.hay ? Math.min(c || TRAVEL.load, TRAVEL.hayCart / TRAVEL.hay) : c || TRAVEL.load;
    if (G && (G.kind || G.trip)) return Infinity; // a trip's pile, taken up whole
    if (!c || !a.job || !KINDS[a.job.kind].need) return TRAVEL.load;
    return Math.max(TRAVEL.load, Math.min(c, KINDS[a.job.kind].need(st, a.job) * TRAVEL.load));
  }
  // a cart of the household not out, the ox cart only with its team free (sim/carts take)
  const canTake = (st, hh) => {
    const tf = teamFree(st, hh);
    return hh.carts.some((c) => !Carts.out(st, c) && (c.kind === 'hand' || tf));
  };
  // a cart of household hh standing at `tile`: its lying cart lies there (sim/carts takeUp; one a hand has taken up is led away)
  const stands = (st, hh, tile) => Lying.amountAt(st, tile, 'leftCart', titled(hh.id)) > 0;
  const VIEW = {
    plans,
    // where the pawn stands: its tile, or its task's site when it stands at the task's spot there (a fishing spot by the water may lie on
    // the tile beside the site's; VB-1749)
    at: (st, a) => {
      const t = here(st, a),
        j = a.job;
      if (!j || t === j.site || !KINDS[j.kind].spot || a.path) return t;
      const [x, y] = KINDS[j.kind].spot(st, a, j),
        [px, py] = poseOf(st, a);
      return Math.abs(px - x) + Math.abs(py - y) < 1e-6 ? j.site : t;
    },
    hands: (st, a) =>
      a.load > 0 && a.job && loaded(a.job.kind)
        ? { good: loaded(a.job.kind), n: a.load, owner: ownerOf(st, a.job, a) }
        : null,
    held: (st, a) => (cartHeld(st, a) ? 'cart' : null),
    // a hand of the goal holds a load of it (sim/methods carry: the goal is not met while one is on its way)
    carrying: (st, g) => {
      const c = g.job.claims;
      for (let i = 0; i < c.length; i++) {
        const b = st.agents[c[i]];
        if (b && b.job === g.job && b.load > 0) return true;
      }
      return false;
    },
    has: (st, a, thing) => thing === 'cart' && cartHeld(st, a) > 0,
    // one of the goal's owner's carts is free to fetch, for one of its own (a helper brings no cart of another household): at the house,
    // or standing at the goal's site, where a hand of it was released (VB-993; VB-1814: taken up by the goal's next hand)
    free: (st, g, a, thing) => {
      const hh = hhOf(st, g.owner);
      return (
        thing === 'cart' && !!hh && st.pawns[a.id].household === g.owner && (canTake(st, hh) || stands(st, hh, g.at))
      );
    },
    place: (st, g, a, name) => {
      if (name === 'cart') {
        // a cart standing at the goal's site first (VB-1814), else a cart not out at its house
        const hh = hhOf(st, g.owner);
        return hh && stands(st, hh, g.at) ? g.at : storeOf(st, g.owner);
      }
      const P = KINDS[g.kind].places;
      return P && P[name] ? P[name](st, g, VIEW) : null;
    },
    pile: (st, at, good, g) => Lying.amountAt(st, at, goodOf(good).lying, titleOf(g.job, g.owner)),
    store: (st, owner, good) => {
      const hh = hhOf(st, owner),
        n = hh && GOODS[good] ? hh[GOODS[good].store] || 0 : 0;
      return n > 1e-9 ? n : 0;
    },
    storeOf,
    cap: (st, a, good) => cap(st, a, good),
    stage: () => false,
    stray: (st, g, good, x, y) => Lying.strayOf(st, titleOf(g.job, g.owner), goodOf(good).lying, x, y),
  };
  VB.counter(
    'methodAsk',
    "A task's next leg read from the world, at each leg's end or cut (sim/methods next, through sim/doing; VB-1775)",
  );
  // The pawn's next leg toward its task (sim/methods next): a step, Methods.DONE, or {blocked}.
  function ask(st, a, g = goalOf(st, a)) {
    VB.count.methodAsk++;
    if (!plans[g.kind]) planOf(g.kind);
    return Methods.next(st, g, a, VIEW);
  }
  // Where step s goes, or is done: a tile, or null (the cart's keeping place is its house).
  const placeOf = (st, a, s, g = goalOf(st, a)) =>
    s.at === 'kept' ? storeOf(st, ownerOf(st, a.job, a)) : Methods.placeOf(st, s, g, a, VIEW);
  // The cart fetched: the one standing where the pawn is (sim/carts takeUp, VB-1814), else one at the house (sim/carts take); its capacity,
  // TRAVEL.load when none was free after all.
  function takeCart(st, a) {
    const hh = hhOf(st, st.pawns[a.id].household);
    if (!hh) return TRAVEL.load;
    return Carts.takeUp(st, hh, a.id, here(st, a)) || Carts.take(st, hh, a.id, teamFree(st, hh));
  }
  // @state agent.loadOf: absent or null, or the record of the pile a load in hand was taken up from (sim/lying's `of`: the task's tile,
  //   field, farm, what was dug), which its delivery reads in place of the task's (VB-1749); written by sim/doing's load and unload and a
  //   trip's work (sim/methods trip), which makes the load in hand
  // A load taken up from the owner's pile where the pawn stands: what was taken.
  function load(st, a, s, g = goalOf(st, a)) {
    const more = wanted(st, a, g),
      G = goodOf(s.good),
      title = titleOf(g.job, g.owner),
      l = Lying.pileAt(st, VIEW.at(st, a), G.lying, title),
      of = l ? l.of : null,
      n = l ? Lying.takeAt(st, l.tile, G.lying, title, cap(st, a, s.good)) : 0;
    if (n > 0) {
      a.load = n;
      a.carry = lookOf(a.job.kind, s.good);
      a.loadOf = byKind(s.good) ? of : null;
      if (more) backLoad(st, a, g);
    }
    return n;
  }
  // The task a trip's load is delivered for: the task, as the pile it was taken from recorded it (sim/lying fetchKind's reading).
  const deliveredFor = (j, of, kind) =>
    of ? { ...j, ...of, kind, site: of.src ?? j.site } : j.kind === kind ? j : { ...j, kind };
  // The load in hand set down: in its owner's store (the store's units), or, its store gone or the pawn unable to walk on, as a pile with
  // title where the pawn stands (at x, y).
  function unload(st, a, s, x, y) {
    const good = loaded(a.job.kind),
      G = goodOf(good),
      owner = ownerOf(st, a.job, a),
      n = a.load,
      at = VIEW.at(st, a);
    if (!(n > 0)) return;
    const drop = s === Methods.RULE.drop || storeOf(st, owner) === null;
    const K = KINDS[a.job.kind],
      S = said(a.job.kind, good);
    if (drop && S && S.setDown && at === a.job.site)
      S.setDown(st, a.job, a); // set down at its site: back with the stooks or the cocks there (VB-1812; its load step's, VB-1821)
    else if (drop && K.spills) {
      // a load no pile keeps (the water in its buckets or barrel, VB-1604) is spilt: nothing lies
    } else if (drop && K.led) {
      // animals led, let go on the road (VB-1750 review, F1): they were never taken from the giver's herd (sim/exchange and sim/droving
      // move them at the door), so nothing lies, and the goal is unmet again: its next hand halters them anew
      a.job.made = Math.max(0, (a.job.made || 0) - 1);
    } else if (G.kind || G.trip) {
      // a trip's good: delivered by its kind, or set down where the pawn stands with what its delivery reads (sim/lying lay); a task's
      // owner kept (a village's timber is the village's, and lies as the village's), a pile's its title's
      // a good left lying with no goal of its own keeps its title (a village's grain to the village's store, VB-1814)
      const kind = G.kind || a.job.kind,
        j = {
          ...deliveredFor(a.job, a.loadOf, kind),
          owner: K.strays ? titleOf(a.job, owner) : a.loadOf || !a.job.owner ? titled(owner) : a.job.owner,
        };
      if (drop) Lying.lay(st, a, { ...j, owner: titleOf(a.job, owner) }, G.lying, at, x, y);
      else {
        const hh = hhOf(st, owner),
          got = said(kind, good).deliver(st, j, hh, st.farmsteads[hh.farmstead], a);
        // the played pawn's sheet tells what the trip brought (sim/player, VB-1118), as sim/agents' deposit does
        if (st.player && st.player.pawn === a.id)
          emit(st, 'yielded', {
            pawn: a.id,
            kind,
            farm: a.job.farm ?? null,
            good: lookOf(a.job.kind, good),
            n: typeof got === 'number' ? got : n,
          });
      }
    } else if (drop) Lying.put(st, G.lying, n, at, titleOf(a.job, owner), { x, y, of: { src: at } });
    else {
      Stores.put(st, hhOf(st, owner), G.store, (n / TRAVEL.load) * G.per(st), 'felling');
      emit(st, 'timberHome', { household: owner, tile: a.job.site, loads: Math.max(1, Math.round(n / TRAVEL.load)) });
    }
    a.load = 0;
    a.carry = null;
    a.loadOf = null;
  }
  // The work leg of step s is done, at the tile where the pawn stands: its kind's effect (KINDS[kind].ops).
  function work(st, a, s) {
    const j = a.job,
      g = goalOf(st, a),
      more = wanted(st, a, g);
    KINDS[j.kind].ops[s.op].run(st, j, g, VIEW.at(st, a), a, cartHeld(st, a) || TRAVEL.load);
    if (more) backLoad(st, a, g);
  }
  // A load that goes home on a cart (its cart's step says `miss`: sheaves, hay, timber), made or taken up on the back by a hand of its
  // owner with no cart in hand while more waited (the kind's cartPays, read before): a miss the head counts (sim/carts missed; VB-1810).
  // The water's barrel counts its own (sim/chores setOut). Whether a cart was wanted: the hand of the owner holds none and one pays.
  function wanted(st, a, g) {
    const K = KINDS[a.job.kind];
    if (!Methods.says(K, 'miss') || !K.can || !K.can.cartPays || a.load > 0) return false;
    return (
      st.pawns[a.id].household === g.owner &&
      !!hhOf(st, g.owner) &&
      !cartHeld(st, a) &&
      !!K.can.cartPays(st, g, a, VIEW)
    );
  }
  const backLoad = (st, a, g) => {
    if (a.load > 0) Carts.missed(st, hhOf(st, g.owner));
  };
  // a work leg's hours: its op's, else the task's (a trip's hours as it was posted), else its kind's
  const hoursOf = (j, s) => KINDS[j.kind].ops[s.op].hours ?? j.hours ?? KINDS[j.kind].hours;
  return {
    VIEW,
    GOODS,
    planOf,
    said,
    lookOf,
    wordsOf,
    carriesTo,
    goalOf,
    ask,
    placeOf,
    takeCart,
    load,
    unload,
    work,
    hoursOf,
  };
})();
