// @sys sim/cottage: a finished cottage becomes a farmstead and a household (start in life from shares); owed shares are paid down
VB['sim/cottage'] = (() => {
  const { personEvent, log, fullName, spouseOf, childrenOf, isHolder } = VB['sim/records'];
  const { makeHousehold } = VB['sim/records'];
  const { makeFarmstead } = VB['sim/layout'];
  const { setOwner } = VB['sim/ownership'];
  const { SHARES } = VB['sim/rules'];
  const { moveTo, refreshRoles } = VB['sim/heirs'];
  const farmName = (st, v) => {
    let n = 1; while (st.farmsteads.some((g) => g.village === v.id && g.name === (n === 1 ? 'Nybygget' : `Nybygget ${n}`))) n++;
    return n === 1 ? 'Nybygget' : `Nybygget ${n}`;
  };
  // The roof is on: the plot's holder and spouse (and their minor children) move into a new farmstead of the plot's house and field.
  // Their stakes (shares already paid out, VB-032) become the household's grain; shares still owed stay a debt of the farm they came from.
  function finishCottage(st, plot) {
    const v = st.villages[plot.village], holder = st.pawns[plot.holder], sp = spouseOf(st, holder.id);
    if (!holder.alive || isHolder(st, holder.id)) { // the holder died or took another farm meanwhile: the roof stands, nobody is to live there
      plot.holder = null; log(st, `The new cottage in ${v.name} stands empty.`); return;
    }
    plot.built = true;
    const house = plot.tiles.find((t) => t.kind === 'house').tile, field = plot.tiles.find((t) => t.kind === 'field').tile;
    const f = makeFarmstead(st.w, st.farmsteads.length, house, [field], v, st.used);
    f.name = farmName(st, v); f.woodlot = v.commonsWood; f.state = 'occupied'; f.condition = 1; f.emptySince = null; f.fence = null;
    st.farmsteads.push(f); v.farmsteads.push(f.id); plot.farmstead = f.id;
    const members = [holder.id];
    if (sp !== null && st.pawns[sp].alive) members.push(sp);
    const from = new Set(members.map((id) => st.pawns[id].household));
    for (const id of [...members]) {
      for (const c of childrenOf(st, id)) {
        const q = st.pawns[c];
        if (q.alive && q.age < 18 && from.has(q.household) && !members.includes(c)) members.push(c);
      }
    }
    const hh = makeHousehold({ pawns: st.pawns }, st.households.length, f, [], holder.id);
    hh.grain = members.reduce((s, id) => s + (st.pawns[id].stake || 0), 0); hh.rations = 0;
    for (const id of members) st.pawns[id].stake = 0;
    st.households.push(hh);
    setOwner(st, house, { type: 'household', id: hh.id }); setOwner(st, field, { type: 'household', id: hh.id });
    for (const id of members) {
      const was = st.pawns[id].household;
      if (was !== null) moveTo(st, id, hh.id);
      else { hh.members.push(id); st.pawns[id].household = hh.id; }
      st.rigDirty.add(id);
    }
    hh.rations = 0;
    personEvent(st, holder.id, 'moved', `Moved into the new farmstead ${f.name}`);
    log(st, `${fullName(holder)} moves into the new farmstead ${f.name} in ${v.name}.`);
    refreshRoles(st); st.biomeDirty.add(house); st.visualDirty = true;
  }
  // At the moving round: shares still owed are paid from the debtor farm's grain above its reserve (the seed and the winter's food).
  // The payment goes to the pawn's household, or to its stake while it has none.
  function payOwed(st) {
    for (const p of st.pawns) {
      if (!p.alive || !(p.owed > 0) || p.owedFrom === undefined || p.owedFrom === null) continue;
      const hh = st.households[p.owedFrom]; if (!hh || hh.dissolved) continue;
      const reserve = SHARES.reserveBase + hh.members.length * SHARES.reservePerMember;
      const pay = Math.min(p.owed, Math.max(0, Math.floor(hh.grain - reserve)));
      if (pay <= 0) continue;
      hh.grain -= pay; p.owed -= pay;
      if (p.household !== null && p.household !== hh.id) st.households[p.household].grain += pay; else p.stake = (p.stake || 0) + pay;
      personEvent(st, p.id, 'share', `Was paid ${pay} rations of the share owed${p.owed ? `, ${p.owed} still owed` : ''}`);
    }
  }
  return { farmName, finishCottage, payOwed };
})();
