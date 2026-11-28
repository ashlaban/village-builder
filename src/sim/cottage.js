// @sys sim/cottage [social]: a finished cottage becomes a farmstead and a household (start in life from shares); owed shares are paid down
VB['sim/cottage'] = (() => {
  const { livePlots, cottageAt } = VB['sim/expansion'],
    { stepOf } = VB['sim/projects'];
  const { personEvent, log, fullName, atHousehold } = VB['sim/records'];
  const { landed, goesWith } = VB['sim/holding'];
  const { makeFarmstead } = VB['sim/layout'];
  const { SHARES, ECON } = VB['sim/rules'],
    { SOIL } = VB['sim/crops'];
  const { foundHousehold } = VB['sim/membership'];
  const { reckonWood } = VB['sim/territory'];
  const { shareWood } = VB['sim/building'];
  const { startHerd, payInAnimals } = VB['sim/droving'];
  const Stores = VB['sim/stores'],
    Obligations = VB['sim/obligations'],
    { emit } = VB['sim/events'];
  const names = VB['sim/names'],
    { heldOf, settle } = VB['sim/heirland'];
  const { issue, register } = VB['sim/commands'];
  // A new farm's name (VB-026, VB-401): by the generators the village's culture prefers, their order drawn by weight, not one another
  // farm of the village has; owner is its first holder. Drawn from the house tile's own stream, not st.rng.
  function farmName(st, v, f, owner = null) {
    const rand = names.tileRand(f.house),
      others = v.farmsteads.filter((id) => id !== f.id).map((id) => st.farmsteads[id]);
    return names.farmName(
      { w: st.w, f, village: v, owner, farms: [f, ...others], fresh: true },
      new Set(others.map((g) => g.name)),
      rand,
      names.farmOrder(names.prefsOf(st, v.id).farm, rand),
    );
  }
  // Whether pawn id can move into a new farm: alive, and neither it nor its spouse holds one (VB-153; sim/holding's bar `landed`).
  const canMoveIn = (st, id) => id !== null && st.pawns[id].alive && !landed(st, id);
  // The roof is on: the plot's holder and spouse (and their minor children) move into a new farmstead of the plot's house and field.
  // Their stakes (shares already paid out, VB-032) become the household's grain; shares still owed stay a debt of the farm they came from.
  // `plot`: the plot's project plan (sim/plans), finished here and kept as the village's record of the plot (village.plots, sim/expansion).
  function finishCottage(st, plot) {
    // a household's plot whose heir can no longer take it passes to the village, which allots it (VB-255)
    if (plot.by !== undefined && !canMoveIn(st, plot.to))
      issue(st, {
        actor: null,
        verb: 'plotToVillage',
        target: plot.by,
        args: { plan: plot.id, why: 'the heir it was built for cannot take it' },
        source: 'construction',
      });
    const v = st.villages[plot.village !== undefined ? plot.village : plot.holder.id]; // a household's plot for its heir names it (VB-255)
    if (plot.to === null) {
      log(st, `The new cottage in ${v.name} stands empty.`, { kind: 'empty', village: v.id });
      return;
    }
    const holder = st.pawns[plot.to],
      tiles = plot.steps[0].places;
    // the holder died, or took another farm or married onto one (VB-153) meanwhile: the roof stands, nobody is to live there
    if (!canMoveIn(st, holder.id)) {
      plot.to = null;
      log(st, `The new cottage in ${v.name} stands empty.`, { kind: 'empty', village: v.id });
      return;
    }
    // a house by an heir's fields (VB-034) whose fields it no longer owns (it died meanwhile: they went back) stands empty
    if (plot.split && !heldOf(st, plot).length) {
      plot.to = null;
      log(st, `The new cottage in ${v.name} stands empty.`, { kind: 'empty', village: v.id });
      return;
    }
    const house = tiles.find((t) => t.kind === 'house').tile,
      fieldTr = plot.split ? null : tiles.find((t) => t.kind === 'field'); // a plot begun before VB-1951 has its field; a new one has none (Kim, 27 Nov)
    const f = makeFarmstead(st.w, st.farmsteads.length, house, fieldTr ? [fieldTr.tile] : [], v, st.used);
    if (fieldTr && fieldTr.fresh) f.fields[0].soil = SOIL.fresh; // broken on ground never farmed (VB-149)
    f.name = farmName(st, v, f, holder);
    f.state = 'occupied';
    f.condition = 1;
    f.condAt = st.t;
    f.emptySince = null;
    f.fence = null;
    st.farmsteads.push(f);
    if (plot.split) settle(st, plot, f); // its fields leave the farm they were split from (sim/heirland)
    v.farmsteads.push(f.id);
    v.plots.push({
      id: plot.plot,
      village: v.id,
      intended: plot.intended,
      holder: holder.id,
      started: plot.started,
      farmstead: f.id,
      tiles: tiles.map((t) => ({ tile: t.tile, kind: t.kind })),
      ...(plot.by !== undefined ? { by: plot.by } : {}), // built by a household for its heir (VB-255)
      ...(plot.split ? { split: true } : {}), // by fields split off to an heir (VB-034)
    });
    emit(st, 'stepDone', { type: plot.holder.type, id: plot.holder.id, plan: plot }); // the roof on: the plan is finished (sim/plans)
    const members = goesWith(st, holder.id), // the start in life every way to a farm shares (sim/holding)
      from = new Set(members.map((id) => st.pawns[id].household));
    // the plot's wood (VB-328): the new household's pile up to its winter goal, then the piles of those who worked the plot; the rest is burnt
    const left = Math.max(0, stepOf(plot, 'walls').wood || 0),
      mine = Math.min(left, ECON.woodWinter);
    const hh = foundHousehold(st, f, members, holder.id, { stakes: true, unhomed: true, wood: mine });
    const burnt = shareWood(st, plot, left - mine);
    reckonWood(st, v); // a farm founded: the village's wood is reckoned again (VB-326)
    // a cow and two ewes from the old household, when that leaves it a cow and its winter hay (VB-140)
    const oldId = [...from].find((id) => id !== null && id !== hh.id),
      oldHh = oldId === undefined ? null : st.households[oldId];
    if (oldHh && !oldHh.dissolved) startHerd(st, oldHh, hh);
    personEvent(st, holder.id, 'moved', `Moved into the new farmstead ${f.name}`, false); // recorded below
    const smoke = burnt > 0 ? `; ${Math.round(burnt)} loads of the plot's wood are burnt where they lie` : '';
    log(st, `${fullName(holder)} moves into the new farmstead ${f.name} in ${v.name}${smoke}.`, {
      kind: 'cottage',
      pawn: holder.id,
      ...atHousehold(st, hh),
    });
  }
  // At the moving round: shares still owed are paid from the debtor farm's grain above its reserve (the seed and the winter's food).
  // The payment goes to the pawn's household, or to its stake while it has none. A walk over the open shares (sim/obligations), by the
  // sibling's id, then each farm's shares by the share's id: each farm pays its own (VB-1155). What a dead sibling was owed lapses. A
  // debtor household dissolved: its farm pays (design.md, Shares still owed), so the shares pass to the household that took the farm, and
  // lapse when the farm was abandoned.
  function payOwed(st) {
    const why = (id) => ({ kind: 'share', pawn: id });
    for (const [id, shares] of Obligations.openShares(st)) {
      const p = st.pawns[id];
      if (!p.alive) {
        for (const o of shares) Obligations.lapse(st, o.id, 'the one owed has died');
        continue;
      }
      const byFarm = new Map();
      for (const o of [...shares].sort((a, b) => a.id - b.id)) {
        if (!byFarm.has(o.debtor.id)) byFarm.set(o.debtor.id, []);
        byFarm.get(o.debtor.id).push(o);
      }
      for (const [debtor, list] of byFarm) payShares(st, p, st.households[debtor], list, why(id));
    }
  }
  function payShares(st, p, hh, list, why) {
    if (!hh) return;
    if (hh.dissolved) {
      const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
        heir = f && f.household !== null && f.household !== hh.id ? st.households[f.household] : null;
      if (heir && !heir.dissolved)
        for (const o of list) Obligations.transfer(st, o.id, { debtor: { kind: 'household', id: heir.id } });
      else if (!f || f.state === 'derelict')
        for (const o of list) Obligations.lapse(st, o.id, 'the farm that owed it was abandoned');
      return; // paid by the farm's new household from the next round
    }
    const ids = list.map((o) => o.id),
      owed = list.reduce((s, o) => s + Obligations.left(o), 0);
    const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember;
    const pay = Math.min(owed, Math.max(0, Math.floor(Stores.grainOf(hh) - reserve)));
    const own = p.household !== null && p.household !== hh.id ? st.households[p.household] : null;
    // grain first; what grain cannot cover is paid in animals to the pawn's household, when it has another (VB-140)
    const animals = own && !own.dissolved && owed - pay > 0 ? payInAnimals(st, hh, own, owed - pay) : 0;
    if (pay <= 0 && animals <= 0) return;
    const rest = owed - pay - animals;
    if (animals > 0) {
      Obligations.fulfil(st, ids, animals, why); // led by sim/herds: booked only
      personEvent(
        st,
        p.id,
        'share',
        `Was paid animals worth ${animals} rations of the share owed${rest ? `, ${rest} still owed` : ''}`,
        { n: animals, ...atHousehold(st, hh) },
      );
    }
    if (pay <= 0) return;
    const to = own || p;
    Obligations.fulfil(
      st,
      list.filter((o) => Obligations.isLive(o)).map((o) => o.id),
      pay,
      why,
      { from: hh, to, good: 'grain' },
    );
    personEvent(st, p.id, 'share', `Was paid ${pay} rations of the share owed${rest ? `, ${rest} still owed` : ''}`, {
      n: pay,
      ...atHousehold(st, hh),
    });
  }
  register('finishCottage', {
    check: (st, c) => {
      const v = st.villages[c.args && c.args.village],
        plot = v && livePlots(st, v).find((p) => p.plot === c.target);
      return plot && cottageAt(plot) >= 3 ? null : 'there is no finished cottage';
    },
    run: (st, c) =>
      finishCottage(
        st,
        livePlots(st, st.villages[c.args.village]).find((p) => p.plot === c.target),
      ),
  });
  return { farmName, finishCottage, payOwed };
})();
