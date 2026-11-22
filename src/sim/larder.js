// @sys sim/larder: household lots of perishable stored food, their withdrawal and expiry
VB['sim/larder'] = (() => {
  const { DAY } = VB['sim/rules'];
  const { keepsDays } = VB['sim/goods'];

  // @state household.larder: lots {kind, n (rations), until (game hours)} of stored food (VB-134)
  // A lot of n rations put in now, spoiling by its food's keeping (sim/goods), or in `days` (a lot that has kept part of its time, sim/fair).
  // The callers book the movement in the stores' ledger (sim/stores record), as they do the takes and the losses (VB-683).
  function addFood(st, hh, kind, n, days) {
    if (n > 0) hh.larder.push({ kind, n, until: st.t + (days === undefined ? keepsDays(kind) : days) * DAY });
  }
  function larderOf(hh, kind) {
    let s = 0;
    for (const l of hh.larder) s += !kind || l.kind === kind ? l.n : 0;
    return s;
  } // the review asks it hourly
  // Takes up to `want` rations from the larder, the lots that spoil first first; only those within `soon` hours of spoiling when soon is
  // given. If a kind is specified, only lots of that kind are considered. Returns what it took; `by`, when given, has what it took of each
  // kind added ({[kind]: rations}), for the ledger.
  function takeFood(st, hh, want, soon = Infinity, kind, by) {
    const lots = kind === undefined ? [...hh.larder] : hh.larder.filter((l) => l.kind === kind);
    let got = 0;
    for (const l of lots.sort((a, b) => a.until - b.until)) {
      if (got >= want || l.until - st.t > soon) break;
      const k = Math.min(l.n, want - got);
      l.n -= k;
      got += k;
      if (by && k > 0) by[l.kind] = (by[l.kind] || 0) + k;
    }
    if (kind === undefined || got > 0) hh.larder = hh.larder.filter((l) => l.n > 1e-9);
    return got;
  }
  function takeAll(hh, kind) {
    const n = larderOf(hh, kind);
    hh.larder = hh.larder.filter((l) => l.kind !== kind);
    return n;
  }
  function spoilFood(st, hh) {
    const spoilt = hh.larder.filter((l) => l.until <= st.t);
    if (spoilt.length) hh.larder = hh.larder.filter((l) => l.until > st.t);
    return spoilt;
  }
  return { addFood, larderOf, takeFood, takeAll, spoilFood };
})();
