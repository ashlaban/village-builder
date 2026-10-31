// @sys sim/help: food help between households: gifts from kin and the village store, and the village store's filling
VB['sim/help'] = (() => {
  const { HELP } = VB['sim/rules'];
  const { personEvent, childrenOf, siblingsOf } = VB['sim/records'];
  const { seedReserve, dailyNeed } = VB['sim/hunger'];
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
  function gift(st, from, to, n, fromName) {
    to.grain += n; to.ledger.push({ t: st.t, kind: 'gift', n, from: fromName });
    const ht = to.holder !== null ? st.pawns[to.holder] : null;
    if (ht) personEvent(st, ht.id, 'gift', `Received ${Math.round(n)} grain from ${fromName}`);
    if (from) {
      from.grain -= n; from.ledger.push({ t: st.t, kind: 'gift', n: -n, to: st.farmsteads[to.farmstead].name });
      const hf = from.holder !== null ? st.pawns[from.holder] : null;
      if (hf) personEvent(st, hf.id, 'gift', `Gave ${Math.round(n)} grain to ${st.farmsteads[to.farmstead].name}`);
      if (hf && ht && hf.ties && ht.ties) for (const [a, b] of [[hf, ht], [ht, hf]]) a.ties.set(b.id, (a.ties.get(b.id) || 0) + HELP.tieGain);
    }
  }
  // Each day, a household whose spare grain covers fewer than HELP.askBelow days asks kin, then the village store, for HELP.askDays days of food.
  function shareFood(st) {
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const need = dailyNeed(st, hh); if (need <= 0 || spare(st, hh) >= HELP.askBelow * need) continue;
      let want = HELP.askDays * need - spare(st, hh);
      for (const k of kinHouseholds(st, hh)) {
        const give = Math.min(want, surplus(st, st.households[k])); if (give <= 1e-9) continue;
        gift(st, st.households[k], hh, give, st.farmsteads[st.households[k].farmstead].name); want -= give;
        if (want <= 1e-9) break;
      }
      const v = st.villages[st.farmsteads[hh.farmstead].village], give = Math.min(want, v.grain);
      if (give > 1e-9) { v.grain -= give; gift(st, null, hh, give, v.name); }
    }
  }
  // At the moving round every household gives a share of its surplus to its village's store.
  function fillStores(st) {
    for (const hh of st.households) {
      if (hh.dissolved) continue;
      const give = surplus(st, hh) * HELP.storeShare; if (give <= 1e-9) continue;
      hh.grain -= give; hh.ledger.push({ t: st.t, kind: 'gift', n: -give, to: 'the village store' });
      st.villages[st.farmsteads[hh.farmstead].village].grain += give;
    }
  }
  return { surplus, kinHouseholds, shareFood, fillStores };
})();
