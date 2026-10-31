// @sys sim/ownership: who owns each tile: a household, a village, or nobody
VB['sim/ownership'] = (() => {
  // @state st.owner: Int32Array, one per tile; 0 = nobody, n > 0 = household n - 1, n < 0 = village -n - 1
  const ownerOf = (st, tile) => {
    const n = st.owner[tile];
    return n === 0 ? null : n > 0 ? { type: 'household', id: n - 1 } : { type: 'village', id: -n - 1 };
  };
  // owner is {type: 'household'|'village', id} or null
  const setOwner = (st, tile, owner) => { st.owner[tile] = !owner ? 0 : owner.type === 'household' ? owner.id + 1 : -owner.id - 1; };
  // Seeding: house and fields belong to the household, or to the village when the farm stands empty; the commons wood and the centre
  // (unless it is a house) belong to the village.
  function seedOwners(st) {
    st.owner = new Int32Array(st.w.N);
    for (const v of st.villages) {
      if (v.commonsWood >= 0) setOwner(st, v.commonsWood, { type: 'village', id: v.id });
      setOwner(st, v.center, { type: 'village', id: v.id });
    }
    for (const f of st.farmsteads) {
      const o = f.household === null ? { type: 'village', id: f.village } : { type: 'household', id: f.household };
      setOwner(st, f.house, o); for (const fd of f.fields) setOwner(st, fd.tile, o);
    }
  }
  // A farm that stands empty passes to its village, with its fields and meadows.
  function farmToVillage(st, f) {
    const o = { type: 'village', id: f.village };
    setOwner(st, f.house, o); for (const fd of f.fields) setOwner(st, fd.tile, o);
    for (const m of f.meadows || []) setOwner(st, m.tile, o);
    if (f.project) setOwner(st, f.project.tile, o);
  }
  return { ownerOf, setOwner, seedOwners, farmToVillage };
})();
