// @sys sim/carts: the household's carts (the distance review, Kim, 12 Nov): hand carts and ox carts as items that carry a larger load home,
// wear with each trip and are mended; the head counts the loads that found no cart free and has another built, as a project at the house
// Design: design.md, Carts. A pawn taking a load from the field takes the household's best free cart: an ox cart if its team is free, else a
// hand cart, else the load goes on the back (TRAVEL). Today only sheaves are carried by the load (sim/kinds, haul); hay, firewood and manure
// are to follow. Reads sim/herds (the team), sim/projects; writes household.carts and household.cartMiss, and begins and ends the cart's project.
VB['sim/carts'] = (() => {
  const { TRAVEL, CART } = VB['sim/rules'];
  const { hasTeam } = VB['sim/herds'], Projects = VB['sim/projects'], { emit } = VB['sim/events'];
  const { log, atFarm } = VB['sim/records'];
  // @state household.carts[]: {kind ('hand' | 'ox'), cond (1 new; mended below CART.mendAt; gone at 0), built (game hour), by (the pawn
  //   that has it out with a load, or null)}: the household's carts, in the order they were made. Written only here.
  // @state household.cartMiss: loads taken on the back this year because no cart was free while more waited (the head's count); 0 at each
  //   winter's start. Written only here.
  // A cart is out while the pawn named in `by` still carries its load home; a `by` left by a pawn that died or dropped the load is free again.
  const out = (st, c) => { const a = c.by === null ? null : st.agents[c.by]; return !!a && a.phase === 'back' && a.load > TRAVEL.load; };
  const free = (st, hh, kind) => hh.carts.find((c) => c.kind === kind && !out(st, c)) || null;
  const cartOf = (st, hh, id) => hh.carts.find((c) => c.by === id && out(st, c)) || null;
  // The load pawn `id` of household hh may take now, and the cart it takes for it: `teamFree` says whether the team could draw the ox cart
  // (sim/agents: the household has one, and it is at no plough and no other cart).
  function take(st, hh, id, teamFree) {
    const c = (teamFree && free(st, hh, 'ox')) || free(st, hh, 'hand');
    if (!c) return TRAVEL.load;
    c.by = id;
    return c.kind === 'ox' ? TRAVEL.cart : TRAVEL.hand;
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
    const c = hh.carts[i], f = st.farmsteads[hh.farmstead];
    c.by = null; c.cond -= CART.wear;
    if (c.cond > 1e-9) return;
    hh.carts.splice(i, 1);
    log(st, `${f.name}'s ${c.kind === 'ox' ? 'ox cart' : 'hand cart'} is worn out.`, { kind: 'cartGone', ...atFarm(f) });
  }
  // A load went on the back while more waited and no cart was free.
  function missed(st, hh) { hh.cartMiss++; }
  // At the winter's start the head counts the year's misses: at CART.misses or more, and with no project under way, the household builds
  // another cart: an ox cart if it keeps a team and has none, else a hand cart. The count starts again.
  function cartsYear(st) {
    for (const v of st.villages) for (const fid of v.farmsteads) {
      const f = st.farmsteads[fid], hh = f.household === null ? null : st.households[f.household];
      if (!hh || hh.dissolved) continue;
      const n = hh.cartMiss; hh.cartMiss = 0;
      if (n < CART.misses || !v.wood.length || f.booth || Projects.projectOf(st, 'household', hh.id)) continue;
      const kind = hasTeam(st, hh) && !hh.carts.some((c) => c.kind === 'ox') ? 'ox' : 'hand';
      emit(st, 'projectBegun', { type: 'household', id: hh.id, project: { what: 'cart', cart: kind,
        steps: [{ kind: 'cart', place: f.house, hours: CART.hours[kind], wood: 0, timber: CART.timber[kind] }] } });
    }
  }
  function cartBuilt(st, j, hh) {
    const plan = Projects.projectOf(st, 'household', hh.id), s = plan && Projects.openStep(plan);
    if (!s || s.kind !== 'cart') return;
    const f = st.farmsteads[hh.farmstead];
    hh.carts.push({ kind: plan.cart, cond: 1, built: st.t, by: null });
    log(st, `${f.name} has built ${plan.cart === 'ox' ? 'an ox cart' : 'a hand cart'}.`, { kind: 'cartBuilt', ...atFarm(f) });
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
  // ---- the job kinds (sim/kinds registers them) ----
  const atHouse = (st, a, j) => [st.w.hx[j.farm.house] + 6 + a.ox * 0.3, st.w.hy[j.farm.house] + 4 + a.oy * 0.2];
  const worst = (st, hh) => hh.carts.filter((c) => !out(st, c)).sort((a, b) => a.cond - b.cond)[0] || null;
  const KINDS = {
    cart: {
      verb: 'Building a cart', go: 'Going to build the cart', name: 'Build a cart', label: 'Cart', anim: 'mallet',
      hours: CART.hours.hand, hands: 2, type: 'wood', project: true, spot: atHouse,
      done: (st, j, hh) => cartBuilt(st, j, hh),
    },
    mendcart: {
      verb: 'Mending the cart', go: 'Going to mend the cart', name: 'Mend the cart', label: 'Cart', anim: 'mallet',
      hours: CART.mendHours, hands: 1, type: 'upkeep', spot: atHouse, urgency: (st, j, c, U) => U.repair,
      done: (st, j, hh) => { const c = worst(st, hh); if (c && c.cond < CART.mendAt) c.cond = 1; },
      available: (st, hh, f, c, post) => {
        const w = f.household === hh.id ? worst(st, hh) : null;
        if (w && w.cond < CART.mendAt) post(`mendcart:f${f.id}`, f.house, { farm: f });
      },
    },
  };
  return { KINDS, take, pace, home, missed, oxOut, cartsYear, seedCarts };
})();
