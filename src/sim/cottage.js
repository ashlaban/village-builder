// @sys sim/cottage: a finished cottage becomes a farmstead and a household (start in life from shares); owed shares are paid down
VB['sim/cottage'] = (() => {
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder, atHousehold } = VB['sim/records'];
  const { makeFarmstead } = VB['sim/layout'];
  const { SHARES, SOIL, ECON } = VB['sim/rules'];
  const { foundHousehold } = VB['sim/membership'];
  const { reckonWood } = VB['sim/territory'];
  const { shareWood } = VB['sim/building'];
  const { startHerd, payInAnimals } = VB['sim/herds'];
  const Stores = VB['sim/stores'],
    Obligations = VB['sim/obligations'],
    { emit } = VB['sim/events'];
  const names = VB['sim/names'];
  const { issue } = VB['sim/commands'];
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
  // Whether pawn id can move into a new farm: alive, and neither it nor a living spouse holds one (VB-153).
  function canMoveIn(st, id) {
    if (id === null || !st.pawns[id].alive || isHolder(st, id)) return false;
    const sp = spouseOf(st, id);
    return !(sp !== null && st.pawns[sp].alive && isHolder(st, sp));
  }
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
      sp = spouseOf(st, holder.id),
      tiles = plot.steps[0].places;
    // the holder died, or took another farm or married onto one (VB-153) meanwhile: the roof stands, nobody is to live there
    if (!holder.alive || isHolder(st, holder.id) || (sp !== null && st.pawns[sp].alive && isHolder(st, sp))) {
      plot.to = null;
      log(st, `The new cottage in ${v.name} stands empty.`, { kind: 'empty', village: v.id });
      return;
    }
    const house = tiles.find((t) => t.kind === 'house').tile,
      field = tiles.find((t) => t.kind === 'field').tile;
    const f = makeFarmstead(st.w, st.farmsteads.length, house, [field], v, st.used);
    if (tiles.find((t) => t.kind === 'field').fresh) f.fields[0].soil = SOIL.fresh; // broken on ground never farmed (VB-149)
    f.name = farmName(st, v, f, holder);
    f.state = 'occupied';
    f.condition = 1;
    f.condAt = st.t;
    f.emptySince = null;
    f.fence = null;
    st.farmsteads.push(f);
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
    });
    emit(st, 'stepDone', { type: plot.holder.type, id: plot.holder.id, plan: plot }); // the roof on: the plan is finished (sim/plans)
    const members = [holder.id];
    if (sp !== null && st.pawns[sp].alive) members.push(sp);
    const from = new Set(members.map((id) => st.pawns[id].household));
    for (const id of [...members]) {
      for (const c of childrenOf(st, id)) {
        const q = st.pawns[c];
        if (q.alive && q.age < 18 && from.has(q.household) && !members.includes(c) && !isHolder(st, c)) members.push(c);
      }
    }
    // the plot's wood (VB-328): the new household's pile up to its winter goal, then the piles of those who worked the plot; the rest is burnt
    const left = Math.max(0, plot.steps[2].wood || 0),
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
  // sibling's id; a sibling's shares are one farm's (oweShare). What a dead sibling was owed lapses.
  function payOwed(st) {
    const why = (id) => ({ kind: 'share', pawn: id }),
      open = (id) => Obligations.due(st, { kind: 'pawn', id }, 'creditor', 'share').map((o) => o.id);
    for (const [id, shares] of Obligations.openShares(st)) {
      const p = st.pawns[id];
      if (!p.alive) {
        for (const o of shares) Obligations.lapse(st, o.id, 'the one owed has died');
        continue;
      }
      const hh = st.households[shares[0].debtor.id],
        owed = Obligations.shareOwed(st, id);
      if (!hh || hh.dissolved) continue;
      const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember;
      const pay = Math.min(owed, Math.max(0, Math.floor(Stores.grainOf(hh) - reserve)));
      const own = p.household !== null && p.household !== hh.id ? st.households[p.household] : null;
      // grain first; what grain cannot cover is paid in animals to the pawn's household, when it has another (VB-140)
      const animals = own && !own.dissolved && owed - pay > 0 ? payInAnimals(st, hh, own, owed - pay) : 0;
      if (pay <= 0 && animals <= 0) continue;
      const rest = owed - pay - animals;
      if (animals > 0) {
        Obligations.fulfil(st, open(id), animals, why(id)); // led by sim/herds: booked only
        personEvent(
          st,
          p.id,
          'share',
          `Was paid animals worth ${animals} rations of the share owed${rest ? `, ${rest} still owed` : ''}`,
          { n: animals, ...atHousehold(st, hh) },
        );
      }
      if (pay <= 0) continue;
      const to = own || p;
      Obligations.fulfil(st, open(id), pay, why(id), { from: hh, to, good: 'grain' });
      personEvent(st, p.id, 'share', `Was paid ${pay} rations of the share owed${rest ? `, ${rest} still owed` : ''}`, {
        n: pay,
        ...atHousehold(st, hh),
      });
    }
  }
  return { farmName, finishCottage, payOwed };
})();
