// @sys sim/hosting [agency]: a guest's bed in another household's house (VB-1151; design.md, Sleeping away from home): whether a head will have
// a pawn as a guest (hostWhy, the rule of the verb lodge's guest), the households a visitor asks for a bed at the village he visits
// (askBed); split from sim/away (VB-1474)
VB['sim/hosting'] = (() => {
  const Kin = VB['sim/records'];
  const { opinionOf } = VB['sim/relations'];
  // @tunable HOSTING: a guest's bed (VB-1151): asks, the households a visitor asks for a bed, one after the other, before he sleeps at the green
  const HOSTING = { asks: 3 };
  // The households of village v a visitor asks for a bed, in the order he asks (VB-1151): the house of the woman he came for (an unmarried
  // woman of the village's queue) and of his kin, before any other; each by its pawn's id. Read from the village's asking queue, a few
  // dozen at most; at most HOSTING.asks are asked, by the rule the lodge verb's guest has (hostWhy: the head's yes, by its opinion of him).
  function askBed(st, id, v) {
    const p = st.pawns[id],
      own = st.households[p.household],
      seen = new Set(),
      want = [];
    for (const e of VB['sim/wishes'].askingIn(st, v)) {
      const q = st.pawns[e.pawn],
        hid = q.household;
      if (!q.alive || hid === null || hid === own.id || seen.has(hid)) continue;
      const kin = Kin.kinship(st, id, q.id) > 0;
      if (kin || q.sex !== p.sex) {
        seen.add(hid);
        want.push({ hid, kin: kin ? 1 : 0, at: e.pawn });
      }
    }
    want.sort((x, y) => y.kin - x.kin || x.at - y.at);
    for (const w of want.slice(0, HOSTING.asks)) {
      const host = st.households[w.hid];
      if (!hostWhy(st, id, host)) return host;
    }
    return null;
  }
  // Why household host will not have pawn id as a guest, or null: it stands, has a farm and a living head who does not dislike him.
  function hostWhy(st, id, host) {
    if (!host || host.dissolved || host.farmstead === null) return 'there is no household to stay with';
    if (host.holder === null || !st.pawns[host.holder].alive) return `household ${host.id} has no head to ask`;
    if (opinionOf(st, host.holder, id) < 0)
      return `the head of household ${host.id} will not have pawn ${id} as a guest`;
    return null;
  }
  return { HOSTING, askBed, hostWhy };
})();
