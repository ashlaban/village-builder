// @sys sim/saltpan: salt boiled at a salt spring (VB-700): a household's spring within reach, the boiling as a job kind (brine boiled
// in a pan over wood cut at the spring, the salt carried home), and salt as a made good and a good of the fair
// Design: design.md, Goods, production and animals (Goods of place; In the ground: salt springs, rare, inland on limestone or sandstone,
// which flow on); AGENTS.md, Deciding without Kim (7, 9, 16). Salt is boiled, never dug: brine from the spring is boiled down in an iron
// or clay pan over a fire, which needs neither a skill nor a facility (Kim, 16 Nov). The spring does not run out (gen/geology ENDLESS).
// Sea salt is not made: the island's shore is cold and its sea brackish (a Baltic of a few parts in a thousand against a spring's tens),
// so boiling sea water would take ten times the wood a measure, and the sun does not dry it in pans; the medieval north bought its
// salt or boiled it at springs (Lüneburg). The salt is used up by the salting (sim/byre); without it the meat is smoked and keeps less.
VB['sim/saltpan'] = (() => {
  const { YEAR_DAYS, DAY } = VB['sim/rules'];
  const { DEPOSIT } = VB['world/geology'];
  const { bfs } = VB['sim/hex'],
    { passable } = VB['sim/walking'],
    { fellTree } = VB['sim/forest'];
  const Rules = VB['sim/registry'];
  const Stores = VB['sim/stores'],
    Targets = VB['sim/targets'],
    Goods = VB['sim/goods'],
    { mayDig } = VB['sim/dig'];
  // @tunable SALT: the boiling at a salt spring (VB-700; Proposed, no source but the reckoning here, for the tuning run). reach: walking
  // steps from the house to a spring a household boils at (DIG.reach's, a long half day there and back); hours: a boiling's work by one
  // hand, the wood cut and the pan kept on the boil; yield: measures of salt a boiling gives (a measure weighs a ration of load: a pan
  // of about 80 litres boils down some 10 litres of weak brine an hour, a measure from it); fuel: steps from the spring within which the
  // boiling's wood is cut (one tree a boiling, of the spring's tile or a neighbour's: a pan's day burns a tree's lop and top); stock: the
  // measures a household with animals keeps, by default (its head's target, VB-698): a boiling, which salts 100 rations of meat
  // (HERD.saltPerRation), a household's year of slaughter at most; seasons: the seasons a household boils in (spring to autumn: the fire
  // is kept outdoors); urgency: a side craft's (MATCH.urgency's scale), as digging's and tar's: done in the household's slack.
  const SALT = { reach: 12, hours: 10, yield: 10, fuel: 1, stock: 10, seasons: [0, 1, 2], urgency: 0.5 };
  const today = (st) => Math.floor(st.t / DAY);
  const isSpring = (w, t) => !!w.deposit && w.deposit[t] === DEPOSIT.SALT;
  // @state household.saltAt: {house, year, tile} or undefined: the household's salt spring, searched from its house in the game year named,
  //   the nearest spring tile it may use within SALT.reach walking steps (-1 with none). Searched when the want opens and kept (rule 4):
  //   again only for a new house, a new year with none found, or a spring no longer the household's to use.
  function search(st, hh, f) {
    const w = st.w,
      { dist } = bfs(w, f.house, SALT.reach, (j) => passable(w, j)),
      at = { house: f.house, year: Math.floor(today(st) / YEAR_DAYS), tile: -1 };
    VB.count.saltGround += dist.size;
    for (const t of dist.keys())
      if (isSpring(w, t) && mayDig(st, hh, f, t)) {
        at.tile = t;
        break;
      }
    hh.saltAt = at;
    return at;
  }
  // The spring household hh boils at, or -1: as last searched, searched again when stale.
  function springOf(st, hh, f) {
    let at = hh.saltAt;
    const year = Math.floor(today(st) / YEAR_DAYS);
    if (!at || at.house !== f.house || (at.tile < 0 ? at.year !== year : !mayDig(st, hh, f, at.tile)))
      at = search(st, hh, f);
    return at.tile;
  }
  // The tile whose tree a boiling at spring s burns: the spring's, else the first neighbour's (in the grid's order) with trees standing
  // that the household may cut on; -1 with none (the spring is not boiled at until the wood grows back).
  function fuelTile(st, hh, f, s) {
    const w = st.w;
    if (w.trees[s] > 0) return s;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[s * 6 + k];
      if (j >= 0 && w.trees[j] > 0 && mayDig(st, hh, f, j)) return j;
    }
    return -1;
  }
  const held = (hh) => hh.salt || 0;
  // Whether household hh wants salt: it holds less than its head's target (by default SALT.stock while it keeps animals, none without).
  const wants = (st, hh) => held(hh) < Targets.target(st, hh, 'salt');
  // Salt as a made good (VB-698): a household with animals keeps a boiling's worth; beyond that, what its spare hours boil, where it has a
  // spring in reach (as last searched: the view reads no new search; a ground not yet searched is taken to have one).
  Targets.made({
    good: 'salt',
    unit: 'measure',
    whole: false,
    need: (st, hh) => (hh.herds.length ? SALT.stock : 0),
    most: (st, hh, f, spare) =>
      !hh.saltAt || !f || hh.saltAt.house !== f.house || hh.saltAt.tile >= 0
        ? Math.floor(spare / SALT.hours) * SALT.yield
        : 0,
    held: (st, hh) => held(hh),
  });
  // Salt as a good of the fair (design.md, Quanta and worth: a sack of 10 measures at the culture's worth; it keeps, and every household
  // that slaughters can use it, so it is a keeping good). Not eaten: it gives no rations.
  Goods.declareGood({
    id: 'salt',
    kind: 'salt',
    class: 'wares',
    unit: 'measure',
    quantum: 10,
    lump: 'sack',
    rations: 0,
    weight: 1,
    perish: null,
    keeping: true,
  });
  // Salt's need term (the rule sim/foodneed declares): what a household lacks of its target (by default SALT.stock while it keeps animals)
  // is worth the good's customary worth a measure, so a village with no spring takes salt at the fair (sim/fair) and as a gift; beyond the
  // target it is a keeping good only (sim/exchange).
  const worthCtx = { good: null }; // reused: the term allocates nothing
  const lack = (due, n) => (due > n ? due - n : 0);
  Rules.contribute({
    rule: 'need',
    source: 'sim/saltpan',
    key: 'salt',
    label: 'Salt, for the salting',
    tunables: ['SALT.stock'],
    value: (st, c) => {
      if (c.good.id !== 'salt' || !c.hh) return 0;
      const due = Targets.target(st, c.hh, 'salt'),
        n = held(c.hh);
      worthCtx.good = c.good;
      return (Rules.value(st, 'worth', worthCtx) / c.good.quantum) * (lack(due, n) - lack(due, Math.max(0, n + c.n)));
    },
  });
  // The job kind (sim/kinds registers it; its fields are described there): a boiling at the spring, its salt carried home in a basket.
  const KINDS = {
    boilsalt: {
      verb: 'Boiling salt',
      go: 'Going to the salt spring',
      back: 'Carrying the salt home',
      name: 'Boil salt at the spring',
      at: ['spring'],
      needs: ['firewood'],
      gives: ['salt'],
      label: 'Salt',
      anim: 'axe',
      hours: SALT.hours,
      hands: 1,
      type: 'upkeep',
      carry: 'basket',
      to: 'door',
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.4, st.w.hy[j.site] + a.oy * 0.4],
      urgency: () => SALT.urgency,
      // home with the salt: the tree its fire burnt is felled (none if it was cut meanwhile: the pan was fed with brush), and the boiling's
      // measures go into the store while the household still wants them
      deliver: (st, j, hh) => {
        if (j.fuel >= 0 && st.w.trees[j.fuel] > 0) fellTree(st, j.fuel);
        if (!wants(st, hh)) return 0;
        return Stores.put(st, hh, 'salt', SALT.yield, 'saltboil');
      },
      // from spring to autumn, while the household wants salt and a spring in reach has wood beside it
      available: (st, hh, f, c, post) => {
        if (!SALT.seasons.includes(c.season) || !wants(st, hh)) return;
        const s = springOf(st, hh, f);
        if (s < 0) return;
        const fuel = fuelTile(st, hh, f, s);
        if (fuel >= 0) post(`boilsalt:h${hh.id}`, s, { farm: f, fuel });
      },
    },
  };
  return { SALT, KINDS, isSpring, springOf, wants };
})();
