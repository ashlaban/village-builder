// @sys sim/carts: the household's carts (the distance review, Kim, 12 Nov): hand carts and ox carts as items that carry a larger load home,
// wear with each trip and are mended; the head counts the loads that found no cart free and has another built, as a project at the house
// Design: design.md, Carts. A pawn taking a load from the field takes the household's best free cart: an ox cart if its team is free, else a
// hand cart, else the load goes on the back (TRAVEL). Today only sheaves are carried by the load (sim/kinds, haul); hay, firewood and manure
// are to follow. Reads sim/herds (the team), sim/projects; writes household.carts and household.cartMiss, and begins and ends the cart's project.
VB['sim/carts'] = (() => {
  const { TRAVEL } = VB['sim/rules'],
    { hayLoad } = VB['sim/meadows'];
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
    reload: 1.5,
  };
  const { hasTeam } = VB['sim/herds'],
    Projects = VB['sim/projects'],
    { emit } = VB['sim/events'];
  const { log, atFarm } = VB['sim/records'];
  // @state household.carts[]: {kind ('hand' | 'ox'), cond (1 new; mended below CART.mendAt; gone at 0), built (game hour), by (the pawn
  //   that has it out with a load, or null)}: the household's carts, in the order they were made. Written only here.
  // @state household.cartMiss: loads taken on the back this year because no cart was free while more waited (the head's count); 0 at each
  //   winter's start. Written only here.
  // A cart is out while the pawn named in `by` is at the job it took it for: carrying a load home, cutting a further load of firewood
  // beside it, or carting dung; a `by` left by a pawn that died or dropped the job is free again.
  const out = (st, c) => {
    const a = c.by === null ? null : st.agents[c.by];
    return !!a && !!a.job && (a.phase === 'back' || a.phase === 'work');
  };
  const free = (st, hh, kind) => hh.carts.find((c) => c.kind === kind && !out(st, c)) || null;
  const cartOf = (st, hh, id) => hh.carts.find((c) => c.by === id && out(st, c)) || null;
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
  function leave(st, hh, id) {
    const i = hh.carts.findIndex((c) => c.by === id);
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
  // The ox cart is out (the team with it).
  const oxOut = (st, hh) => hh.carts.some((c) => c.kind === 'ox' && out(st, c));
  // How fast a laden pawn walks, of an unladen one's pace: with the load on its back, with a hand cart, or beside the oxen.
  function pace(st, a) {
    if (!(a.load > TRAVEL.load)) return TRAVEL.pace.back;
    const c = cartOf(st, st.households[st.pawns[a.id].household], a.id);
    return c ? TRAVEL.pace[c.kind] : TRAVEL.pace.back;
  }
  // A load is home: the cart it came on wears, and one worn out is gone.
  function home(st, hh, id) {
    const i = hh.carts.findIndex((c) => c.by === id);
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
  // At the winter's start the head counts the year's misses: at CART.misses or more, and with no project under way, the household builds
  // another cart: an ox cart if it keeps a team and has none, else a hand cart. The count starts again.
  function cartsYear(st) {
    for (const v of st.villages)
      for (const fid of v.farmsteads) {
        const f = st.farmsteads[fid],
          hh = f.household === null ? null : st.households[f.household];
        if (!hh || hh.dissolved) continue;
        const n = hh.cartMiss;
        hh.cartMiss = 0;
        if (n < CART.misses || !v.wood.length || f.booth || Projects.projectOf(st, 'household', hh.id)) continue;
        const kind = hasTeam(st, hh) && !hh.carts.some((c) => c.kind === 'ox') ? 'ox' : 'hand';
        emit(st, 'projectBegun', {
          type: 'household',
          id: hh.id,
          project: {
            what: 'cart',
            cart: kind,
            steps: [{ kind: 'cart', place: f.house, hours: CART.hours[kind], wood: 0, timber: CART.timber[kind] }],
          },
        });
      }
  }
  function cartBuilt(st, j, hh) {
    const plan = Projects.projectOf(st, 'household', hh.id),
      s = plan && Projects.openStep(plan);
    if (!s || s.kind !== 'cart') return;
    const f = st.farmsteads[hh.farmstead];
    hh.carts.push({ kind: plan.cart, cond: 1, built: st.t, by: null });
    log(st, `${f.name} has built ${plan.cart === 'ox' ? 'an ox cart' : 'a hand cart'}.`, {
      kind: 'cartBuilt',
      ...atFarm(f),
    });
    emit(st, 'stepDone', { type: 'household', id: hh.id });
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
  // What the kinds of sim/kinds take from here. Hay goes by the load, as sheaves: the first is raked together in the job's hours, a
  // further one loaded in CART.reload (1.5 hours a load, as the job's own).
  // loads: the back loads a pawn brings home (firewood: one for each trip's cutting stacked on its cart).
  const HAY = {
    load: (st, a, j, cap) => (a.load = hayLoad(j.meadow, cap)),
    again: (j) => j.meadow.held > 0,
    reload: CART.reload,
  };
  const loads = (a) => Math.max(1, Math.round((a ? a.load : 0) / TRAVEL.load));
  // ---- the job kinds (sim/kinds registers them) ----
  const atHouse = (st, a, j) => [st.w.hx[j.farm.house] + 6 + a.ox * 0.3, st.w.hy[j.farm.house] + 4 + a.oy * 0.2];
  const worst = (st, hh) => hh.carts.filter((c) => !out(st, c)).sort((a, b) => a.cond - b.cond)[0] || null;
  const KINDS = {
    cart: {
      verb: 'Building a cart',
      go: 'Going to build the cart',
      name: 'Build a cart',
      label: 'Cart',
      anim: 'mallet',
      hours: CART.hours.hand,
      hands: 2,
      type: 'wood',
      project: true,
      spot: atHouse,
      done: (st, j, hh) => cartBuilt(st, j, hh),
    },
    mendcart: {
      verb: 'Mending the cart',
      go: 'Going to mend the cart',
      name: 'Mend the cart',
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
  return { KINDS, CART, HAY, loads, take, holds, leave, carting, pace, home, missed, oxOut, cartsYear, seedCarts };
})();
