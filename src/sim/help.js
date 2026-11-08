// @sys sim/help: food help between households: whom a hungry household asks (kin, then the village store) and for how much, and the
// village store's yearly filling; each gift is a command `give`, settled by sim/exchange (VB-216)
VB['sim/help'] = (() => {
  const issue = (st, cmd) => VB['sim/commands'].issue(st, cmd); // sim/commands loads after this module
  const { HELP } = VB['sim/rules'];
  const { childrenOf, siblingsOf } = VB['sim/records'];
  const { seedReserve, dailyNeed } = VB['sim/hunger'];
  const Rules = VB['sim/registry'], { ALLOWANCE_BOUND } = VB['sim/relations'];
  // allowance's second term (VB-216): the holder's own reserve beyond the floor, from 0 to 40 days of the household's need, a stand-in for
  // generosity until traits; a household without a holder keeps the most, as surplus does
  Rules.contribute({ rule: 'allowance', source: 'sim/help', key: 'reserve', label: 'Own reserve', range: [-ALLOWANCE_BOUND, 0],
    tunables: ['HELP.bufferDays', 'HELP.floorDays'],
    value: (st, c) => -((c.giver !== null ? st.pawns[c.giver].buffer : HELP.bufferDays[1]) - HELP.floorDays) * dailyNeed(st, c.from) });
  // grain a household would give: what is above its holder's buffer and its seed reserve
  const surplus = (st, hh) => {
    const holder = hh.holder !== null ? st.pawns[hh.holder] : null, buffer = (holder ? holder.buffer : HELP.bufferDays[1]) * dailyNeed(st, hh);
    return Math.max(0, hh.grain - seedReserve(st, hh) - buffer);
  };
  const spare = (st, hh) => Math.max(0, hh.grain - seedReserve(st, hh));
  // households holding a parent, child or sibling of a member, closest first (parents and children before siblings, then by id)
  function kinHouseholds(st, hh) {
    const rank = new Map();
    const note = (id, r) => {
      const q = st.pawns[id]; if (!q.alive || q.household === null || q.household === hh.id || st.households[q.household].dissolved) return;
      rank.set(q.household, Math.min(rank.get(q.household) ?? 9, r));
    };
    for (const id of hh.members) {
      const p = st.pawns[id];
      for (const par of [p.father, p.mother]) if (par !== null) note(par, 1);
      for (const c of childrenOf(st, id)) note(c, 1);
      for (const s of siblingsOf(st, id)) note(s, 2);
    }
    return [...rank].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map((x) => x[0]);
  }
  // A gift of n grain, as the command `give` (source 'help'): its actor is the giver's holder, or the household or village itself
  // without one; true when it was given.
  const actorOf = (x) => ('farmstead' in x ? (x.holder !== null ? x.holder : { household: x.id }) : { village: x.id });
  const give = (st, from, to, n) => issue(st, { actor: actorOf(from), verb: 'give', target: 'farmstead' in to ? to.id : { village: to.id },
    args: { good: 'grain', n }, source: 'help' }) === true;
  // Each day, a household whose spare grain covers fewer than HELP.askBelow days asks kin, then the village store, for HELP.askDays days of food.
  function shareFood(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      const need = dailyNeed(st, hh); if (need <= 0 || spare(st, hh) >= HELP.askBelow * need) continue;
      let want = HELP.askDays * need - spare(st, hh);
      for (const k of kinHouseholds(st, hh)) {
        const n = Math.min(want, surplus(st, st.households[k])); if (n <= 1e-9) continue;
        if (give(st, st.households[k], hh, n)) want -= n;
        if (want <= 1e-9) break;
      }
      const v = st.villages[st.farmsteads[hh.farmstead].village], n = Math.min(want, v.grain);
      if (n > 1e-9) give(st, v, hh, n);
    }
  }
  // At the moving round every household gives a share of its surplus to its village's store.
  function fillStores(st) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId];
      if (hh.dissolved) continue;
      const n = surplus(st, hh) * HELP.storeShare; if (n <= 1e-9) continue;
      give(st, hh, st.villages[st.farmsteads[hh.farmstead].village], n);
    }
  }
  return { surplus, kinHouseholds, shareFood, fillStores };
})();
