// @sys sim/crowding: a household's crowding (VB-766), the people within CROWD.steps of its house, and the death.hazard factor it gives, kept as arrays
VB['sim/crowding'] = (() => {
  const { CROWD } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  // @state st.crowdN: people (members of undissolved households) living within CROWD.steps hex steps of each household's house, its own
  //   among them, by household id; a cache owned here, rebuilt at seed and load, never read by a rule.
  // @state st.crowd: the death.hazard factor of each household by id, 1 + CROWD.per * max(0, n - CROWD.free), at most CROWD.max; a cache
  //   owned here (the same writer), read by the death roll; a house stands where it was founded, so only a household's members and its
  //   founding or ending change it, and they change it at once, never by a daily pass.
  const factorOf = (n) => Math.min(CROWD.max, 1 + CROWD.per * Math.max(0, n - CROWD.free));
  // The households of farms near the tile of house `house`: a pass over the farms, at a membership change (not a pair pass).
  function each(st, house, fn) {
    VB.count.crowdScan++;
    for (const f of st.farmsteads) {
      if (f.household !== null && hexSteps(st.w, house, f.house) <= CROWD.steps) fn(f.household);
    }
  }
  const set = (st, id, n) => {
    st.crowdN[id] = n;
    st.crowd[id] = factorOf(n);
  };
  function rebuild(st) {
    st.crowdN = [];
    st.crowd = [];
    for (const hh of st.households) set(st, hh.id, 0);
    for (const hh of st.households) {
      if (hh.dissolved || !hh.members.length) continue;
      each(st, st.farmsteads[hh.farmstead].house, (id) => set(st, id, st.crowdN[id] + hh.members.length));
    }
  }
  // Members came (n > 0) or went (n < 0) at household hh.
  function moved(st, hh, n) {
    if (!st.crowdN || n === 0) return;
    each(st, st.farmsteads[hh.farmstead].house, (id) => set(st, id, st.crowdN[id] + n));
  }
  // A household just founded on farm f (f.household is set), with its members listed: its own count, and its members added to the near ones.
  function founded(st, hh) {
    if (!st.crowdN) return;
    set(st, hh.id, 0);
    const house = st.farmsteads[hh.farmstead].house;
    let n = 0;
    each(st, house, (id) => {
      if (id !== hh.id) n += st.households[id].members.length;
    });
    set(st, hh.id, n + hh.members.length);
    if (hh.members.length) each(st, house, (id) => id !== hh.id && set(st, id, st.crowdN[id] + hh.members.length));
  }
  // A household dissolved: it counts no one, and no one counts it.
  function ended(st, hh) {
    if (st.crowdN) set(st, hh.id, 0);
  }
  // The factor the death roll reads for a pawn: no household, none.
  const factor = (st, p) => (p.household === null || p.household === undefined ? 1 : st.crowd[p.household]);
  const note = (st, p) =>
    `crowded: ${p.household === null ? 0 : st.crowdN[p.household]} people within ${CROWD.steps} steps`;
  // A fresh count, for the invariant: the households of live farms, by their members.
  function fresh(st, id) {
    const hh = st.households[id],
      house = st.farmsteads[hh.farmstead].house;
    let n = 0;
    for (const g of st.households) {
      if (g.dissolved) continue;
      if (hexSteps(st.w, house, st.farmsteads[g.farmstead].house) <= CROWD.steps) n += g.members.length;
    }
    return n;
  }
  return { rebuild, moved, founded, ended, factor, note, factorOf, fresh };
})();
