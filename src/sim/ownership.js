// @sys sim/ownership: who owns each tile: a household, a village, or nobody; and which farms are held in trust (read only; VB-309)
VB['sim/ownership'] = (() => {
  // @state st.owner: Int32Array, one per tile; 0 = nobody, n > 0 = household n - 1, n < 0 = village -n - 1
  const ownerOf = (st, tile) => {
    const n = st.owner[tile];
    return n === 0 ? null : n > 0 ? { type: 'household', id: n - 1 } : { type: 'village', id: -n - 1 };
  };
  // owner is {type: 'household'|'village', id} or null; the tile is marked for the Land overlay (st.landDirty, sim/claims)
  const setOwner = (st, tile, owner) => {
    st.owner[tile] = !owner ? 0 : owner.type === 'household' ? owner.id + 1 : -owner.id - 1;
    if (st.landDirty) st.landDirty.add(tile);
  };
  // Seeding: house and fields belong to the household, or to the village when the farm stands empty; the centre (unless it is a house)
  // belongs to the village. Its wood is claimed as outland (sim/territory, VB-326).
  function seedOwners(st) {
    st.owner = new Int32Array(st.w.N);
    for (const v of st.villages) {
      setOwner(st, v.center, { type: 'village', id: v.id });
    }
    for (const f of st.farmsteads) {
      const o = f.household === null ? { type: 'village', id: f.village } : { type: 'household', id: f.household };
      setOwner(st, f.house, o);
      for (const fd of f.fields) setOwner(st, fd.tile, o);
    }
  }
  // A farm that stands empty passes to its village, with its fields and meadows.
  function farmToVillage(st, f) {
    const o = { type: 'village', id: f.village };
    setOwner(st, f.house, o);
    for (const fd of f.fields) setOwner(st, fd.tile, o);
    for (const m of f.meadows || []) setOwner(st, m.tile, o);
  }
  // ---- farms held in trust (VB-309; st.trusts and st.liveTrusts, written by sim/trust) ----
  // A farm held in trust is worked by a kin household that does not own it: the owner stays the household that holds it. Read here, by the
  // systems loaded before sim/trust (the job board, the plans, the clock); a few live trusts at most, so a walk over them allocates nothing.
  const NONE = [];
  // The live trust of the farm of household hhId, or null.
  function trustOf(st, hhId) {
    const live = st.liveTrusts || NONE;
    for (let i = 0; i < live.length; i++) if (st.trusts[live[i]].household === hhId) return st.trusts[live[i]];
    return null;
  }
  // The live trust whose farm pawn `id` holds (it lives with the trustee), or null.
  function trustOfHolder(st, id) {
    const live = st.liveTrusts || NONE;
    for (let i = 0; i < live.length; i++)
      if (st.households[st.trusts[live[i]].household].holder === id) return st.trusts[live[i]];
    return null;
  }
  // The farms household hhId holds in trust for kin, in the order of the trusts (none: a shared empty list).
  function heldFarms(st, hhId) {
    const live = st.liveTrusts || NONE;
    let out = NONE;
    for (let i = 0; i < live.length; i++) {
      const t = st.trusts[live[i]];
      if (t.trustee !== hhId) continue;
      if (out === NONE) out = [];
      out.push(st.farmsteads[st.households[t.household].farmstead]);
    }
    return out;
  }
  return { ownerOf, setOwner, seedOwners, farmToVillage, trustOf, trustOfHolder, heldFarms };
})();
