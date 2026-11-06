// @sys sim/membership: founding a household on a farm, coordinating records, supplies, land and moving
VB['sim/membership'] = (() => {
  const { makeHousehold, joinHousehold, setServant } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const Stores = VB['sim/stores'];
  const { moveTo, refreshRoles } = VB['sim/heirs'];
  // Found on an existing farm. Supplies are booked before membership changes so stakes remain in the old household's ledger.
  function foundHousehold(st, f, members, holder, { grain = 0, stakes = false, text = null, followers = [], unhomed = false } = {}) {
    const hh = makeHousehold(st, st.households.length, f, [], holder);
    Stores.start(st, hh, grain);
    if (stakes) for (const id of members) Stores.move(st, st.pawns[id], hh, 'grain', st.pawns[id].stake || 0,
      { kind: 'provisions', pawn: id });
    st.households.push(hh);
    for (const t of [f.house, ...f.fields.map((fd) => fd.tile), ...f.meadows.map((m) => m.tile)]) {
      setOwner(st, t, { type: 'household', id: hh.id });
    }
    for (const id of members) {
      if (unhomed && st.pawns[id].household === null) joinHousehold(st, hh, id);
      else moveTo(st, id, hh.id, text);
      st.rigDirty.add(id);
    }
    for (const id of followers) setServant(st, id, true);
    refreshRoles(st); st.biomeDirty.add(f.house); st.visualDirty = true;
    return hh;
  }
  return { foundHousehold };
})();
