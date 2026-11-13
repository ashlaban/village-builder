// @sys sim/dig: digging clay and bog iron (VB-359): the loads a deposit tile has left, bog iron growing back, and a household's digging ground
// What shows at the surface and needs no facility is dug: clay and bog iron. The hidden ores, peat, flint, amber and salt wait for their goods
// (design.md, Goods of place and side crafts, In the ground). The loads go into the household's store (sim/stores dig) and nothing uses them
// until slice 6 (VB-185), so a household digs in its slack, and only up to DIG.stock loads of each.
VB['sim/dig'] = (() => {
  const { YEAR_DAYS, DAY } = VB['sim/rules'];
  const Geo = VB['gen/geology'],
    { DEPOSIT, ENDLESS } = Geo;
  const { bfs } = VB['sim/hex'],
    { passable } = VB['sim/routes'];
  const { isOutland } = VB['sim/territory'],
    Stores = VB['sim/stores'];
  // Proposed (VB-359, 11 Nov), until slice 6's plan gives the goods a use: hours a load; reach, walking steps from the house; stock,
  // the loads of each good a household keeps and no more; regrow, the loads a worked bog iron tile regains a year, up to its first amount;
  // urgency, the job's weight in a bid (MATCH.urgency's scale): the house's upkeep's, so that it is done in the household's slack.
  const DIG = { hours: 3, reach: 12, stock: 4, regrow: 1, urgency: 0.5 };
  // The goods dug, by deposit: the household's store (hh[good]) and the ledger's good.
  const GOODS = { [DEPOSIT.CLAY]: 'clay', [DEPOSIT.BOG_IRON]: 'bogOre' };
  const DUG = Object.values(GOODS);
  const goodOf = (w, i) => (w.deposit ? GOODS[w.deposit[i]] || null : null); // a world made without the ground layers has nothing to dig
  const today = (st) => Math.floor(st.t / DAY);
  // @state w.depositFull: Uint16Array per tile; the loads the tile's deposit began with (gen/geology's amount), set at its first digging,
  //   0 on a tile never dug; made with w.dugDay at the first digging of the run (a world never dug has neither)
  // @state w.dugDay: Int32Array per tile; the game day of the tile's last digging plus 1, 0 on a tile never dug
  function marks(w) {
    if (!w.dugDay) {
      w.dugDay = new Int32Array(w.N);
      w.depositFull = new Uint16Array(w.N);
    }
  }
  // The loads tile i has left now: w.depositLeft as of its last digging, and for bog iron DIG.regrow a whole year since, up to its first
  // amount (rule 3: read in closed form, no yearly pass). Clay does not grow back; an ENDLESS tile never falls.
  function left(st, i) {
    const w = st.w,
      n = w.depositLeft ? w.depositLeft[i] : 0;
    if (n === ENDLESS || w.deposit[i] !== DEPOSIT.BOG_IRON || !w.dugDay || !w.dugDay[i]) return n;
    const years = Math.floor((today(st) - (w.dugDay[i] - 1)) / YEAR_DAYS);
    return Math.min(w.depositFull[i], n + years * DIG.regrow);
  }
  // One load is dug from tile i: its loads left fall by 1 (a tile at 0 keeps its deposit's kind: it is spent, not gone). Returns the
  // loads got, 1 or 0 when the tile was spent meanwhile. The only writer of w.depositLeft, w.depositFull and w.dugDay.
  function digLoad(st, i) {
    const w = st.w,
      n = left(st, i);
    if (!goodOf(w, i) || n <= 0) return 0;
    if (n === ENDLESS) return 1;
    marks(w);
    if (!w.dugDay[i]) w.depositFull[i] = w.depositLeft[i];
    w.depositLeft[i] = n - 1;
    w.dugDay[i] = today(st) + 1;
    return 1;
  }
  // Whether the household may dig on tile t: its own land, its village's outland, or wilderness.
  const mayDig = (st, hh, f, t) => {
    const o = st.owner[t];
    return o === 0 || o === hh.id + 1 || isOutland(st, t, f.village);
  };
  const diggable = (st, hh, f, t, good) => goodOf(st.w, t) === good && left(st, t) > 0 && mayDig(st, hh, f, t);
  // The goods the household still wants: those it holds fewer than DIG.stock loads of.
  const wants = (hh, good) => (hh[good] || 0) < DIG.stock;
  // @state household.digAt: {house, year, clay, bogOre} or undefined: the household's digging ground, searched from its house in the game
  //   year named, for each good the nearest tile it may dig within DIG.reach walking steps (-1 with none). Searched when the want opens and
  //   kept (rule 4): again only for a new house, a new year with a good not found, or a tile no longer to be dug.
  function search(st, hh, f) {
    const w = st.w,
      { dist } = bfs(w, f.house, DIG.reach, (j) => passable(w, j)),
      at = { house: f.house, year: Math.floor(today(st) / YEAR_DAYS) };
    VB.count.digGround += dist.size;
    for (const good of DUG) at[good] = -1;
    for (const t of dist.keys()) {
      const good = goodOf(w, t);
      if (good && at[good] < 0 && diggable(st, hh, f, t, good)) at[good] = t;
    }
    hh.digAt = at;
    return at;
  }
  // The tile the household would dig next, and its good, or null: the good it holds fewer loads of among those it wants and has in reach.
  function digSite(st, hh, f) {
    if (!DUG.some((g) => wants(hh, g))) return null;
    let at = hh.digAt;
    const year = Math.floor(today(st) / YEAR_DAYS);
    const stale =
      !at ||
      at.house !== f.house ||
      DUG.some((g) => wants(hh, g) && (at[g] >= 0 ? !diggable(st, hh, f, at[g], g) : at.year !== year));
    if (stale) at = search(st, hh, f);
    let best = null;
    for (const g of DUG) if (wants(hh, g) && at[g] >= 0 && (!best || (hh[g] || 0) < (hh[best] || 0))) best = g;
    return best ? { tile: at[best], good: best } : null;
  }
  // The job kind (sim/kinds registers it as KINDS.dig; its fields are described there): a load a trip, carried home, in the slack.
  const KIND = {
    verb: 'Digging',
    go: 'Going to dig',
    back: 'Carrying the load home',
    name: 'Dig clay or bog iron',
    label: 'Digging',
    anim: 'hoe',
    hours: DIG.hours,
    hands: 1,
    type: 'upkeep',
    carry: 'basket',
    to: 'door',
    spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.4, st.w.hy[j.site] + a.oy * 0.4],
    urgency: () => DIG.urgency,
    // the load: the tile falls by one, the store rises by what it gave (none if the tile was spent meanwhile, or the stock is full)
    deliver: (st, j, hh) => {
      if (wants(hh, j.good) && digLoad(st, j.site)) Stores.dug(st, hh, j.good, 1);
    },
    // the household's digging ground: the nearest tile within reach of the good it holds fewest loads of, while it wants one
    available: (st, hh, f, c, post) => {
      const at = digSite(st, hh, f);
      if (at) post(`dig:h${hh.id}:${at.tile}`, at.tile, { farm: f, good: at.good });
    },
  };
  return { DIG, KIND, GOODS, DUG, goodOf, left, digLoad, mayDig, wants, digSite };
})();
