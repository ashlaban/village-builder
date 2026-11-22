// @sys sim/membership: founding a household on a farm, coordinating records, supplies, land and moving; the village's alderman (VB-314)
// @state village.alderman: the pawn (a holder of the village) who holds its office, or null/absent; aldermanSince (hours), aldermanYear (the year
//   chosen; a term by turns ends with it), aldermanFarm (the farmstead whose holder served last by turns)
VB['sim/membership'] = (() => {
  const { living } = VB['sim/records'];
  const { makeHousehold, joinHousehold, setServant } = VB['sim/records'];
  const { setOwner } = VB['sim/ownership'];
  const Stores = VB['sim/stores'];
  const { ECON, cal } = VB['sim/rules'],
    { MATCH } = VB['sim/roles'];
  const { makePlan } = VB['sim/plans'];
  const { refreshRoles } = VB['sim/heirs'];
  const { issue, register } = VB['sim/commands'];
  const { onFarm } = VB['sim/projects'];
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
      else {
        const args = { reason: carry ? 'found' : 'settle', ...(text !== null ? { text } : {}) };
        issue(st, { actor: id, verb: 'move', target: hh.id, args, source: 'found' });
      }
      st.rigDirty.add(id);
    }
    for (const id of followers) setServant(st, id, true);
    refreshRoles(st);
    st.biomeDirty.add(f.house);
    st.visualDirty = true;
    return hh;
  }
  // A restored farm gains its household; construction keeps plot/farm-specific steps in their owners.
  register('foundHousehold', {
    check: (st, c) => {
      const f = st.farmsteads[c.target],
        a = c.args || {};
      if (!f || f.household !== null) return 'there is no empty farm';
      const p = onFarm(st, f.id); // the claimant's restoration (sim/farmclaims' claimOn reads the same plan)
      if (c.source !== 'debug' && !(p && p.holder.type === 'pawn' && p.holder.id === c.actor))
        return `pawn ${c.actor} has no claim on farm ${f.id}`;
      if (!Array.isArray(a.members) || !a.members.includes(c.actor) || new Set(a.members).size !== a.members.length) {
        return 'the household must include its holder and unique members';
      }
      for (const id of a.members) {
        const dead = living(st, id);
        if (dead) return dead;
      }
      return Stores.partsOk(a.grain) ? null : 'invalid provisions';
    },
    run: (st, c) =>
      foundHousehold(st, st.farmsteads[c.target], c.args.members, c.actor, {
        grain: c.args.grain,
      }),
  });
  // The village's office (VB-314; design.md, The alderman): who holds it, when (hours; the year, for a term by turns) and from which farm
  // (the last turn's). The meeting chooses him and the office is vacated by `id` null (sim/meetings).
  function setAlderman(st, v, id, farm = null) {
    v.alderman = id;
    v.aldermanSince = id === null ? null : st.t;
    v.aldermanYear = id === null ? null : cal(st.t).year;
    if (farm !== null) v.aldermanFarm = farm;
  }
  return { foundHousehold, setAlderman };
})();
