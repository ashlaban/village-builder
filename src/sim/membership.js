// @sys sim/membership: founding a household on a farm, coordinating records, supplies, land and moving
VB['sim/membership'] = (() => {
  const { makeHousehold, joinHousehold, setServant } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const Stores = VB['sim/stores'];
  const { ECON, MATCH } = VB['sim/rules'];
  const { makePlan } = VB['sim/plans'];
  const { moveTo, refreshRoles } = VB['sim/heirs'];
  // Found on an existing farm. Supplies are booked before membership changes so stakes remain in the old household's ledger.
  // Its first wood (VB-328): `wood` loads from its plot (a cottage's), then from the piles of the homes its members leave, up to ECON.startWood
  // in all and never leaving a pile under MATCH.urgency.woodLow; settlers (`carry` false) bring none and cut on arrival.
  function foundHousehold(
    st,
    f,
    members,
    holder,
    { grain = {}, stakes = false, text = null, followers = [], unhomed = false, wood = 0, carry = true } = {},
  ) {
    const hh = makeHousehold(st, st.households.length, f, [], holder);
    Stores.start(st, hh, grain);
    if (wood > 0) Stores.put(st, hh, 'wood', wood, 'plot');
    const homes = new Set(
      members.map((id) => st.pawns[id].household).filter((h) => h !== null && !st.households[h].dissolved),
    );
    for (const h of carry ? homes : []) {
      const old = st.households[h],
        n = Math.min(ECON.startWood - hh.wood, old.wood - MATCH.urgency.woodLow);
      if (n > 0) Stores.move(st, old, hh, 'wood', n, 'start');
    }
    if (stakes)
      for (const id of members)
        Stores.move(st, st.pawns[id], hh, 'grain', st.pawns[id].stake || 0, { kind: 'provisions', pawn: id });
    st.households.push(hh);
    makePlan(st, 'household', hh.id);
    for (const t of [f.house, ...f.fields.map((fd) => fd.tile), ...f.meadows.map((m) => m.tile)]) {
      setOwner(st, t, { type: 'household', id: hh.id });
    }
    for (const id of members) {
      if (unhomed && st.pawns[id].household === null) joinHousehold(st, hh, id);
      else moveTo(st, id, hh.id, text, carry);
      st.rigDirty.add(id);
    }
    for (const id of followers) setServant(st, id, true);
    refreshRoles(st);
    st.biomeDirty.add(f.house);
    st.visualDirty = true;
    return hh;
  }
  return { foundHousehold };
})();
