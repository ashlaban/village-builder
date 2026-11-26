// @sys sim/carts: the household's carts (the distance review, Kim, 12 Nov): hand carts and ox carts as items that carry a larger load home,
// wear with each trip and are mended; the head counts the loads that found no cart free and begins another through the verb project (VB-678)
// Design: design.md, Carts. A pawn taking a load from the field takes the household's best free cart: an ox cart if its team is free, else a
// hand cart, else the load goes on the back (TRAVEL). Today only sheaves are carried by the load (sim/kinds, haul); hay, firewood and manure
// are to follow. Reads sim/herds (the team), sim/projects; writes household.carts and household.cartMiss, and declares the cart's making and ends its project.
VB['sim/carts'] = (() => {
  const { TRAVEL, SEASON_DAYS } = VB['sim/rules'];
  // The tunables (the distance review, Kim, 12 Nov): a load is `load` rations on the back, `hand` on a hand cart and `cart` on an ox
  // cart (it was 90 with two oxen: Kim, 10 Nov; a back load is 25 to 30 kg, a hand cart's 100 to 150 kg on a track, an ox cart's 500 to
  // 800 kg, halved here since sheaves and hay fill a cart before they weigh it down; from memory, unchecked). pace: a laden pawn's speed
  // of an unladen one's. A cart is `hours` of work at the house and `timber` loads of the village's wood (a tree gives 3); each trip wears
  // it by `wear`, it is mended (mendHours) below `mendAt`, and at 0 it is gone. A head whose household took `misses` loads on the back in
  // a year, with no cart free and more waiting, has another built. What a load is, by what is carried: sheaves in rations; hay at
  // TRAVEL.hay units a ration of load, an ox cart at most TRAVEL.hayCart (10 on the back, 30 on a hand cart,
  // 60 on an ox cart: a meadow's 30 is three trips on the back; VB-394); firewood a trip's cutting
  // (ECON.woodPerTrip) a back load, so a cart lets a pawn stay and cut further loads while the pile is short and the day lasts;
  // manure is carted `manure` times as fast with a cart (as the team's rate at the plough)
  const CART = {
    hours: { hand: 12, ox: 30 },
    timber: { hand: 3, ox: 6 },
    wear: 0.02,
    mendAt: 0.5,
    mendHours: 3,
    misses: 6,
    manure: { hand: 1.5, ox: 2.5 },
  };
  const { hasTeam } = VB['sim/herds'],
    Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { log, atFarm } = VB['sim/records'];
  const { on } = VB['sim/events'],
    Lying = VB['sim/lying'];
  // @state household.carts[]: {kind ('hand' | 'ox'), cond (1 new; mended below CART.mendAt; gone at 0), built (game hour), by (the pawn
  //   that has it out with a load, or null)}: the household's carts, in the order they were made. Written only here.
  // @state household.cartMiss: loads taken on the back because no cart was free while more waited, since the head's last yearly look at a
  //   cart or the last cart begun (the head's count; VB-678). Written only here.
  // A cart is out while the pawn named in `by` is at the job it took it for: carrying a load home, cutting a further load of firewood
  // beside it, or carting dung; or on its way out with a cart taken at the house (the water's barrel, sim/chores: a load beyond the
  // back's on the way to the work, VB-1586); a `by` left by a pawn that died or dropped the job is free again.
  // @state household.carts[].at: absent, or {tile, x, y, t}: a cart left standing where its carrier was released on the road with a load
  //   (VB-649: it dies or its household dissolves), until a hand of the household fetches it home (the lying load 'leftCart', sim/lying);
  //   while it stands the cart is out, and the team that drew it stands with it. Written only here; removed at the autumn frost if nobody
  //   came (sim/lying), unless `kept`: a cart its household left standing at the landing when its house moved (VB-1667), on its own land
  //   and not abandoned, which the frost does not take.
  const out = (st, c) => {
    if (c.at) return true;
    const a = c.by === null ? null : st.agents[c.by];
    // out with its pawn on a task (a cart set out with, or fetched for a method's trip and walked empty: VB-1775)
    return !!a && !!a.job; // a cart out is with its task's hand, walking or at work (VB-1751)
  };
  const free = (st, hh, kind) => hh.carts.find((c) => c.kind === kind && !out(st, c)) || null;
  const cartOf = (st, hh, id) => hh.carts.find((c) => c.by === id && !c.at && out(st, c)) || null;
  // The load pawn `id` of household hh may take now, and the cart it takes for it: `teamFree` says whether the team could draw the ox cart
  // (sim/agents: the household has one, and it is at no plough and no other cart).
  function take(st, hh, id, teamFree) {
    const i = hh.carts.indexOf((teamFree && free(st, hh, 'ox')) || free(st, hh, 'hand'));
    if (i < 0) return TRAVEL.load;
    const c = hh.carts[i];
    c.by = id;
    return c.kind === 'ox' ? TRAVEL.cart : TRAVEL.hand;
  }
  // What the cart pawn `id` has out holds, or 0; and the pawn gives its cart up (a load that fits the back needs none).
  const holds = (st, hh, id) => {
    const c = cartOf(st, hh, id);
    return c ? (c.kind === 'ox' ? TRAVEL.cart : TRAVEL.hand) : 0;
  };
  // The pawn is released on the road with its load: the cart it has out stands where it is (tile, x, y), with the team that drew it (VB-649);
  // that cart, or null when it had none. Its fetching is the lying load the caller puts down.
  function strand(st, hh, id, { tile, x, y }) {
    const c = hh.carts.find((q) => q.by === id && !q.at && out(st, q));
    if (!c) return null;
    c.by = null;
    c.at = { tile, x, y, t: st.t };
    return c;
  }
  // The house of household hh moved from `from` (sim/camp's placing, VB-1667): each cart not out stands there (`kept`), with a lying
  // leftCart, marked moving and kept, for its hands to fetch (sim/lying keeps it at the frost; cartsFrost below).
  on('houseMoved', (st, { f, from, walk }) => {
    const hh = f.household === null ? null : st.households[f.household];
    if (!hh) return;
    for (const c of hh.carts)
      if (!out(st, c)) {
        const x = st.w.hx[from] - 10,
          y = st.w.hy[from] + 10;
        c.by = null;
        c.at = { tile: from, x, y, t: st.t, kept: true };
        Lying.leave(
          st,
          'leftCart',
          1,
          from,
          { type: 'household', id: hh.id },
          { x, y, of: { moving: true, kept: true, walk, cart: { kind: c.kind, built: c.built } } },
        );
      }
  });
  // The cart (kind, built) standing out is fetched home: it is free again, with its team; or it is lost, by the frost, and is gone.
  const standing = (hh, kind, built) => hh.carts.find((c) => c.at && c.kind === kind && c.built === built) || null;
  function fetched(st, hh, kind, built) {
    const c = standing(hh, kind, built);
    if (c) delete c.at;
    return c;
  }
  // A cart left standing that nobody fetched is lost at the frost, and named.
  function lost(st, hh, c) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    hh.carts.splice(hh.carts.indexOf(c), 1);
    if (f)
      log(
        st,
        `${f.name}'s ${c.kind === 'ox' ? 'ox cart' : 'hand cart'}, left standing on the road, was lost to the frost.`,
        {
          kind: 'cartGone',
          ...atFarm(f),
        },
      );
  }
  function leave(st, hh, id, at = null) {
    if (at) return strand(st, hh, id, at);
    const i = hh.carts.findIndex((c) => c.by === id && !c.at);
    if (i >= 0) {
      const c = hh.carts[i];
      c.by = null;
    }
  }
  // Carting dung (sim/agents, each step of the work): the rate with the cart the pawn has, or takes now; 1 with none.
  function carting(st, hh, id, teamFree) {
    let c = cartOf(st, hh, id);
    if (!c && take(st, hh, id, teamFree) > TRAVEL.load) c = cartOf(st, hh, id);
    return c ? CART.manure[c.kind] : 1;
  }
  // The same rate read only: with the cart the pawn has, or the one it would take now (teamFree as for `take`); 1 with none.
  function cartingRate(st, hh, id, teamFree) {
    const c = cartOf(st, hh, id) || (teamFree && free(st, hh, 'ox')) || free(st, hh, 'hand');
    return c ? CART.manure[c.kind] : 1;
  }
  // The ox cart is out (the team with it).
  const oxOut = (st, hh) => hh.carts.some((c) => c.kind === 'ox' && out(st, c));
  // How fast a laden pawn walks, of an unladen one's pace: with the load on its back, with a hand cart, or beside the oxen.
  // A pawn's pace a walk (sim/legs): a cart it holds walks at the cart's pace, laden or not (the water's barrel out, VB-1586; a goal's cart
  // fetched before its load, VB-1812); else a load in hand at the back's, and none at 1.
  function pace(st, a) {
    const p = st.pawns[a.id],
      c = p.household !== null ? cartOf(st, st.households[p.household], a.id) : null;
    if (c) return TRAVEL.pace[c.kind];
    return a.carry || a.load > TRAVEL.load ? TRAVEL.pace.back : 1;
  }
  // A load is home: the cart it came on wears, and one worn out is gone.
  function home(st, hh, id) {
    const i = hh.carts.findIndex((c) => c.by === id && !c.at);
    if (i < 0) return;
    const c = hh.carts[i],
      f = st.farmsteads[hh.farmstead];
    c.by = null;
    c.cond -= CART.wear;
    if (c.cond > 1e-9) return;
    hh.carts.splice(i, 1);
    log(st, `${f.name}'s ${c.kind === 'ox' ? 'ox cart' : 'hand cart'} is worn out.`, {
      kind: 'cartGone',
      ...atFarm(f),
    });
  }
  // A load went on the back while more waited and no cart was free.
  function missed(st, hh) {
    hh.cartMiss++;
  }
  // A cart left standing that nobody fetched is lost at the autumn frost (VB-649).
  function cartsFrost(st) {
    for (const hh of st.households) for (const c of hh.carts.filter((q) => q.at && !q.at.kept)) lost(st, hh, c);
  }
  // The cart, a making the head begins through the verb project (VB-678; sim/projects' declare): possible with no cart under way and a
  // village wood to fell its timber in; args.kind 'hand' or 'ox', else an ox cart if the household keeps a team and has none, else a hand
  // cart. The head weighs it once a year from the winter's start, counting the loads taken on the back since its last look with no cart
  // free and more waiting, and wants one at CART.misses or more; the count starts again then, and when a cart is begun. A small
  // construction, beside any other project and in a booth as in a house (VB-1414).
  const kindOf = (st, hh, args) =>
    (args && args.kind) || (hasTeam(st, hh) && !hh.carts.some((c) => c.kind === 'ox') ? 'ox' : 'hand');
  declare('cart', {
    small: true,
    why: (st, hh, f, args) => {
      const v = st.villages[f.village];
      if (args && args.kind !== undefined && !Object.hasOwn(CART.hours, args.kind))
        return `there is no cart ${args.kind}`;
      if (Projects.underWay(st, hh.id, 'cart')) return `the household has a cart under way`;
      return v.wood.length ? null : `${v.name} has no wood to fell its timber in`;
    },
    begin: (st, hh, f, args) => {
      const kind = kindOf(st, hh, args);
      hh.cartMiss = 0;
      return {
        cart: kind,
        steps: [{ kind: 'cart', place: f.house, hours: CART.hours[kind], wood: 0, timber: CART.timber[kind] }],
      };
    },
    look: {
      from: 3 * SEASON_DAYS,
      want: (st, hh) => {
        const n = hh.cartMiss;
        hh.cartMiss = 0;
        return n >= CART.misses ? {} : null;
      },
    },
  });
  // The cart built: the household's.
  function cartBuilt(st, j, hh, plan) {
    const f = st.farmsteads[hh.farmstead];
    hh.carts.push({ kind: plan.cart, cond: 1, built: st.t, by: null });
    log(st, `${f.name} has built ${plan.cart === 'ox' ? 'an ox cart' : 'a hand cart'}.`, {
      kind: 'cartBuilt',
      ...atFarm(f),
    });
  }
  // The carts a scenario's households start with: an ox cart where there is a team to draw it, and a hand cart on every farm that has
  // stood for years (not the founders', who land with what they carry).
  function seedCarts(st, standing) {
    for (const id of st.liveHouseholds) {
      const hh = st.households[id];
      if (standing) hh.carts.push({ kind: 'hand', cond: 1, built: st.t, by: null });
      if (hasTeam(st, hh)) hh.carts.push({ kind: 'ox', cond: 1, built: st.t, by: null });
    }
  }
  // loads: the back loads a pawn brings home (firewood: one for each trip's cutting stacked on its cart).
  const loads = (a) => Math.max(1, Math.round((a ? a.load : 0) / TRAVEL.load));
  // ---- the job kinds (sim/kinds registers them) ----
  const atHouse = (st, a, j) => [st.w.hx[j.farm.house] + 6 + a.ox * 0.3, st.w.hy[j.farm.house] + 4 + a.oy * 0.2];
  const worst = (st, hh) => hh.carts.filter((c) => !out(st, c)).sort((a, b) => a.cond - b.cond)[0] || null;
  const KINDS = {
    // A cart left standing on the road (VB-649): a goal of the household's while one stands (sim/lying BRING, VB-1814), its lying carts
    // the stray method's. A hand walks to it, takes it up with the team and leads both home; it is free (and the team) once at the house.
    leftCart: {
      verb: 'Taking up the cart',
      go: 'Going for a cart left standing',
      name: 'Fetch a cart left standing',
      at: ['road'],
      needs: [],
      gives: ['cart'],
      hours: 0.5,
      label: 'Cart',
      back: 'Leading the cart and its team home',
      type: 'upkeep',
      carry: 'sack',
      to: 'barn',
      hands: 1,
      urgency: (st, j, c, U) => U.haul,
      deliver: (st, j, hh) => fetched(st, hh, j.cart.kind, j.cart.built),
    },
    cart: {
      verb: 'Building a cart',
      go: 'Going to build the cart',
      name: 'Build a cart',
      at: ['farm'],
      needs: ['timber'],
      gives: ['cart'],
      label: 'Cart',
      anim: 'mallet',
      hours: CART.hours.hand,
      hands: 2,
      type: 'wood',
      craft: 'building', // VB-360
      project: true,
      spot: atHouse,
      done: (st, j, hh) => Projects.stepEnds(st, j, hh, cartBuilt),
    },
    mendcart: {
      verb: 'Mending the cart',
      go: 'Going to mend the cart',
      name: 'Mend the cart',
      at: ['farm'],
      needs: ['cart'],
      gives: ['cart'],
      label: 'Cart',
      anim: 'mallet',
      hours: CART.mendHours,
      hands: 1,
      type: 'upkeep',
      spot: atHouse,
      urgency: (st, j, c, U) => U.repair,
      done: (st, j, hh) => {
        const i = hh.carts.indexOf(worst(st, hh)),
          c = hh.carts[i];
        if (c && c.cond < CART.mendAt) c.cond = 1;
      },
      available: (st, hh, f, c, post) => {
        const w = f.household === hh.id ? worst(st, hh) : null;
        if (w && w.cond < CART.mendAt) post(`mendcart:f${f.id}`, f.house, { farm: f });
      },
    },
  };
  VB['sim/methods'].bring(KINDS.leftCart, 'leftCart');
  // Pawn `id` takes up a cart of household hh standing at `tile` for its goal there (VB-993: its hand released at the work; VB-1814: the
  // goal's next hand, not a fetch home): out with it, its lying cart gone; its capacity, 0 when none stands there. A cart stands where its
  // lying cart lies: one whose lying cart a hand has taken up is led away, though it is free (c.at cleared) only once home (VB-1814 review).
  function takeUp(st, hh, id, tile) {
    const l = Lying.pileAt(st, tile, 'leftCart', { type: 'household', id: hh.id }),
      w = l && l.of.cart;
    if (!w) return 0;
    const c = hh.carts.find((q) => q.at && q.kind === w.kind && q.built === w.built);
    if (!c) return 0;
    Lying.take(st, l.id, 1);
    delete c.at;
    c.by = id;
    return c.kind === 'ox' ? TRAVEL.cart : TRAVEL.hand;
  }
  return {
    KINDS,
    CART,
    takeUp,
    loads,
    take,
    holds,
    leave,
    carting,
    cartingRate,
    pace,
    home,
    missed,
    oxOut,
    out,
    cartOf,
    cartsFrost,
    seedCarts,
  };
})();
