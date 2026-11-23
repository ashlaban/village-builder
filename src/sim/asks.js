// @sys sim/asks: the asks for goods (VB-699; AGENTS.md, Deciding without Kim, 9, 14, 16): a household that lacks a good it needs and
//   cannot make where it lives asks for it, an ask open until met or a year old; a head whose place gives the good reads, once a year after
//   the harvest, the asks of the villages it gathers with, and reckons what it can place beyond its own need: its estimate, never a price
// Principle 9 by mechanism (Kim, 16 Nov): place decides who can make, the asks decide who does. Nothing here moves a good: an ask is met
// at the fair (the basis `swap`, sim/fair) or by a gift, and is closed when the asker next finds it holds its need. The reckoning is the
// head's (principle 14): the asks it hears of (a poor head only its own village's), times its lean, within its spare hands and a back load.
// @state st.asks: absent until the first ask, else {open ({[good]: [{household, n (units wanted), made (game hours), basis ('swap' or
//   'gift')}]}: the open asks indexed by good, at most ASKS.cap a household, none older than a year once its asker or a reader has looked;
//   tally ({[good]: {asked, met, lapsed}}: counts since the start)}. Written only here; plain data, saved.
// @state plan.placed (a household's standing plan): absent until its head first reads the asks, else {year (the year it read them), goods
//   ({[good]: n}: what the head reckons it can place beyond its need, read by sim/seasonal's goodTargets), heard (asks it heard of)}.
VB['sim/asks'] = (() => {
  const Targets = VB['sim/targets'];
  const { FAIR } = VB['sim/fair'];
  const Goods = VB['sim/goods'];
  const { YEAR, TRAVEL } = VB['sim/rules'];
  const { district } = VB['sim/gathering'];
  const { headSkill, goodTargets } = VB['sim/seasonal'];
  const { on } = VB['sim/events'];
  // @tunable ASKS (VB-699; the agent's starting values): cap, the open asks a household holds at once (one a good it cannot make: there are
  //   two such goods today, tar and dried fish); hears, the head's skill from which it hears of the asks of the villages its own gathers
  //   with (below it, only its own village's); season, the season from whose first review the head reads the asks (autumn: after the
  //   harvest, before the gathering its dealer carries the goods to).
  const ASKS = Object.freeze({ cap: 3, hears: 0.5, season: 2 });
  const TOLERANCE = 1e-9;
  const farmOf = (st, hh) => (hh.farmstead === null ? null : st.farmsteads[hh.farmstead]);
  const villageOf = (st, hh) => {
    const f = farmOf(st, hh);
    return f ? f.village : null;
  };
  const live = (st, id) => !!st.households[id] && !st.households[id].dissolved;
  // A made good is asked for only where it is carried to the fair (where an ask is met): a good of FAIR.goods with a finite need.
  const traded = (good) => FAIR.goods.includes(good);
  const asksOf = (st) => st.asks || (st.asks = { open: {}, tally: {} });
  const tally = (st, good) => {
    const T = asksOf(st).tally;
    return T[good] || (T[good] = { asked: 0, met: 0, lapsed: 0 });
  };
  const listOf = (st, good) => {
    const O = asksOf(st).open;
    return O[good] || (O[good] = []);
  };
  // What the household holds of a good, and what it needs (sim/targets' rule); whether it can make the good where it lives (the place's
  // bound beyond the need: 0 where there is no shore, no pit or no pine in reach).
  const heldOf = (st, hh, good) => Targets.MADE.get(good).held(st, hh);
  const needOf = (st, hh, good) => Targets.need(st, hh, good);
  const canMake = (st, hh, good) =>
    Targets.MADE.get(good).most(st, hh, farmOf(st, hh), Targets.hands(st, hh) * Targets.TARGET.spareHours) > 0;
  // The ask at index i of a good's list closes: met or lapsed.
  function close(st, good, i, how) {
    listOf(st, good).splice(i, 1);
    tally(st, good)[how]++;
  }
  // An ask still open: its household live, not a year old
  const stale = (st, a) => !live(st, a.household) || a.made + YEAR <= st.t;
  // At household hh's review: its asks that are met (it holds its need) or a year old close; then it asks for each traded good it needs,
  // lacks and cannot make, one ask a good, up to ASKS.cap. A few reads a made good.
  function review(st, hh) {
    let mine = 0;
    for (const good of Targets.MADE.keys()) {
      if (!traded(good)) continue;
      const L = st.asks && st.asks.open[good];
      let open = false;
      if (L)
        for (let i = L.length - 1; i >= 0; i--) {
          const a = L[i];
          if (a.household !== hh.id) continue;
          if (heldOf(st, hh, good) >= needOf(st, hh, good) - TOLERANCE) close(st, good, i, 'met');
          else if (a.made + YEAR <= st.t) close(st, good, i, 'lapsed');
          else {
            open = true;
            mine++;
          }
        }
      if (open) continue;
      const need = needOf(st, hh, good);
      if (!Number.isFinite(need) || need <= 0 || mine >= ASKS.cap) continue;
      const lack = need - heldOf(st, hh, good);
      if (lack <= TOLERANCE || canMake(st, hh, good)) continue;
      listOf(st, good).push({ household: hh.id, n: lack, made: st.t, basis: basisOf(st, hh) });
      tally(st, good).asked++;
      mine++;
    }
  }
  // The basis an ask is met on: a swap where the household has something to carry to the fair, else a gift.
  function basisOf(st, hh) {
    if ((hh.grain || 0) > 0 || (hh.tar || 0) > 0 || (hh.hides || 0) > 0) return 'swap';
    for (const x of hh.larder || []) if (x.n > TOLERANCE) return 'swap';
    return 'gift';
  }
  // The villages whose asks household hh's head hears of: its own, and, from a skill of ASKS.hears, those its village gathers with (the
  // district of the gathering it went to or goes to). An array of village ids.
  function heardFrom(st, hh, skill) {
    const v = villageOf(st, hh);
    if (v === null) return [];
    const g = st.villages[v].gathering;
    if (skill < ASKS.hears || !g || g.host === null || g.host === undefined) return [v];
    const d = district(st, g.host);
    return d.includes(v) ? d : [v, ...d];
  }
  // What a back load holds of a good, in its units, less the room left for what the dealer takes (sim/fair's packing)
  function carried(good) {
    const G = Goods.goodOf(good),
      per = FAIR.weight[G.lump];
    return per ? Math.floor((TRAVEL.load - FAIR.room + TOLERANCE) / per) * G.quantum : 0;
  }
  // The head of household hh reads the asks for each good it can make, once a year from its first review of autumn: the units the asks of
  // the villages it hears of want (stale ones close as lapsed as it passes them), times its lean (plan.head.bias.hours: the lean of its
  // estimates, VB-476), within what its spare hands make beyond its need (sim/targets' bound) and what its dealer carries. Each ask read is
  // VB.count.asksRead. Its targets are made again with what it reckons.
  function read(st, plan, hh, c) {
    if (c.season < ASKS.season || (plan.placed && plan.placed.year === c.year)) return;
    const skill = headSkill(st, hh.id),
      lean = plan.head ? plan.head.bias.hours : 1,
      vs = heardFrom(st, hh, skill),
      goods = {};
    let heard = 0;
    const f = farmOf(st, hh);
    for (const good of Targets.MADE.keys()) {
      if (!traded(good) || !st.asks || !st.asks.open[good] || !canMake(st, hh, good)) continue;
      const L = st.asks.open[good];
      let want = 0;
      for (let i = L.length - 1; i >= 0; i--) {
        VB.count.asksRead++;
        const a = L[i];
        if (stale(st, a)) {
          close(st, good, i, 'lapsed');
          continue;
        }
        if (a.household === hh.id) continue;
        const v = villageOf(st, st.households[a.household]);
        if (!vs.includes(v)) continue;
        want += a.n;
        heard++;
      }
      if (want <= TOLERANCE) continue;
      const M = Targets.MADE.get(good),
        most = M.most(st, hh, f, Targets.hands(st, hh) * Targets.TARGET.spareHours);
      let n = Math.min(want * lean, most, carried(good));
      n = M.whole ? Math.floor(n + TOLERANCE) : Math.round(n * 10) / 10;
      if (n > 0) goods[good] = n;
    }
    plan.placed = { year: c.year, goods, heard };
    goodTargets(st, plan, hh);
  }
  // What household hh's head reckons it can place of a good beyond its need (0 for none): the panel's line
  const placedOf = (plan, good) => (plan && plan.placed && plan.placed.goods[good]) || 0;
  on('planReviewed', (st, d) => {
    const plan = d.plan;
    if (plan.holder.type !== 'household') return;
    const hh = st.households[plan.holder.id];
    if (!hh || hh.dissolved) return;
    review(st, hh);
    read(st, plan, hh, d.c);
  });
  // The open asks of a good, live ones (for the page and the measures); allocates.
  const openOf = (st, good) => ((st.asks && st.asks.open[good]) || []).filter((a) => !stale(st, a));
  return { ASKS, review, read, placedOf, openOf, heardFrom, carried };
})();
