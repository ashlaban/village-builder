// @sys sim/cottage: a finished cottage becomes a farmstead and a household (start in life from shares); owed shares are paid down
VB['sim/cottage'] = (() => {
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder, atHousehold } = VB['sim/records'];
  const { makeFarmstead } = VB['sim/layout'];
  const { SHARES, SOIL } = VB['sim/rules'];
  const { foundHousehold } = VB['sim/membership'];
  const Stores = VB['sim/stores'];
  const names = VB['sim/names'];
  // A new farm's name (VB-026): by the generators the village's culture prefers (compass, landmark, owner), not one another farm of the
  // village has; owner is its first holder. Drawn from the house tile's own stream, not st.rng.
  const farmName = (st, v, f, owner = null) => names.farmName({ w: st.w, f, village: v, owner },
    new Set(v.farmsteads.filter((id) => id !== f.id).map((id) => st.farmsteads[id].name)), names.tileRand(f.house), names.prefsOf(st, v.id).farm);
  // The roof is on: the plot's holder and spouse (and their minor children) move into a new farmstead of the plot's house and field.
  // Their stakes (shares already paid out, VB-032) become the household's grain; shares still owed stay a debt of the farm they came from.
  function finishCottage(st, plot) {
    const v = st.villages[plot.village], holder = st.pawns[plot.holder], sp = spouseOf(st, holder.id);
    // the holder died, or took another farm or married onto one (VB-153) meanwhile: the roof stands, nobody is to live there
    if (!holder.alive || isHolder(st, holder.id) || (sp !== null && st.pawns[sp].alive && isHolder(st, sp))) {
      plot.holder = null; log(st, `The new cottage in ${v.name} stands empty.`, { kind: 'empty', village: v.id }); return;
    }
    plot.built = true;
    const house = plot.tiles.find((t) => t.kind === 'house').tile, field = plot.tiles.find((t) => t.kind === 'field').tile;
    const f = makeFarmstead(st.w, st.farmsteads.length, house, [field], v, st.used);
    if (plot.tiles.find((t) => t.kind === 'field').fresh) f.fields[0].soil = SOIL.fresh; // broken on ground never farmed (VB-149)
    f.name = farmName(st, v, f, holder); f.woodlot = v.commonsWood; f.state = 'occupied'; f.condition = 1; f.emptySince = null; f.fence = null;
    st.farmsteads.push(f); v.farmsteads.push(f.id); plot.farmstead = f.id;
    const members = [holder.id];
    if (sp !== null && st.pawns[sp].alive) members.push(sp);
    const from = new Set(members.map((id) => st.pawns[id].household));
    for (const id of [...members]) {
      for (const c of childrenOf(st, id)) {
        const q = st.pawns[c];
        if (q.alive && q.age < 18 && from.has(q.household) && !members.includes(c) && !isHolder(st, c)) members.push(c);
      }
    }
    const hh = foundHousehold(st, f, members, holder.id, { stakes: true, unhomed: true });
    personEvent(st, holder.id, 'moved', `Moved into the new farmstead ${f.name}`, false); // recorded below
    log(st, `${fullName(holder)} moves into the new farmstead ${f.name} in ${v.name}.`, { kind: 'cottage', pawn: holder.id, ...atHousehold(st, hh) });
  }
  // At the moving round: shares still owed are paid from the debtor farm's grain above its reserve (the seed and the winter's food).
  // The payment goes to the pawn's household, or to its stake while it has none.
  function payOwed(st) {
    for (const liveId of st.living) {
      const p = st.pawns[liveId];
      if (!p.alive || !(p.owed > 0) || p.owedFrom === undefined || p.owedFrom === null) continue;
      const hh = st.households[p.owedFrom]; if (!hh || hh.dissolved) continue;
      const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember;
      const pay = Math.min(p.owed, Math.max(0, Math.floor(hh.grain - reserve)));
      if (pay <= 0) continue;
      p.owed -= pay;
      const to = p.household !== null && p.household !== hh.id ? st.households[p.household] : p;
      Stores.move(st, hh, to, 'grain', pay, { kind: 'share', pawn: p.id });
      personEvent(st, p.id, 'share', `Was paid ${pay} rations of the share owed${p.owed ? `, ${p.owed} still owed` : ''}`, { n: pay, ...atHousehold(st, hh) });
    }
  }
  return { farmName, finishCottage, payOwed };
})();
