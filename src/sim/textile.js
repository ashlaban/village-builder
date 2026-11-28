// @sys sim/textile [material]: wool to cloth (VB-362): a fleece spun into a skein of yarn as background work at the house, two skeins woven into a
// length of cloth at the household's loom, the loom a small making; the practice "Spinning and weaving are" and the ranks it gives
// Design: design.md, Goods, production and animals (The mill and the loom, the kiln and the quarry: Wool to cloth, Who spins; Decided
// 11 Nov, the numbers Proposed); backlog/VB-185.md. The fleeces are shorn at the fold (sim/byre); the cloth waits for dress (VB-363).
VB['sim/textile'] = (() => {
  const { SEASON_DAYS } = VB['sim/rules'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    Customs = VB['sim/customs'],
    Skills = VB['sim/skills'];
  const { declare } = VB['sim/makings'];
  const { draw } = VB['sim/workmanship'];
  const { log, atFarm } = VB['sim/records'];
  // @tunable TEXTILE: wool to cloth (VB-362; Proposed by slice 6's plan, in the game's work hours, 576 an adult a year; dress for six,
  // about two lengths a year, then takes some 180 hours, a third of one adult's year, nearly all of it spinning: acoup, "Clothing, How
  // Did They Make It?", III). spinHours: a skein from one fleece; yarnStock: the skeins a household spins up to; reach: the steps from the
  // house within which the spinner spins (0: at the house, beside minding it, the pot and the byre); rate: the hours of spinning an hour
  // held; weaveHours: a length from `skeins` skeins at the loom; loomHours, loomTimber: the loom's making, once; urgency: spinning's and
  // weaving's weight in a bid (MATCH.urgency's scale: a side craft's, as the leather's and the tools' mending).
  const TEXTILE = {
    spinHours: 40,
    yarnStock: 4,
    reach: 0,
    rate: 1,
    weaveHours: 12,
    skeins: 2,
    loomHours: 12,
    loomTimber: 2,
    urgency: 0.5,
  };
  // @tunable SPINNERS: who spins and weaves, by the practice "Spinning and weaving are" (VB-362; Decided, 11 Nov): a rank by role for a
  // woman, and for a man (`men`) only where it is everyone's indoor work. A woman holding the farm ranks as the mistress; a child none.
  const SPINNERS = { women: { wife: 7, maid: 7, daughter: 6, retired: 5, farmer: 7 }, men: 4 };
  // @state household.loom: absent until the household has built its loom, then {built (game hour)}; written only here
  const hasLoom = (hh) => !!hh.loom;
  const woolOf = (hh) => hh.wool || 0;
  const yarnOf = (hh) => Stores.heldOf(hh, 'yarn');
  const clothOf = (hh) => Stores.heldOf(hh, 'cloth');
  // The practice of household hh's village: 'women' (the default) or 'everyone'.
  function practice(st, hh) {
    const f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead],
      s = f && st.cenv ? st.cenv.settlements[f.village] : null;
    return Customs.practiceOf(s && st.cenv.cultures[s.culture], 'spinning');
  }
  // Pawn p's rank of spinning and weaving (sim/fit prioOf reads a kind's `rank`): by its role, its sex and the practice; a holder standing
  // in for an absent mistress (`stand`, sim/roles STAND) takes her rank (VB-1545).
  function rank(st, p, j, stand) {
    if (p.role === 'child') return 0;
    const own = p.sex === 'f' ? SPINNERS.women[p.role] || 0 : 0,
      hh = p.household === null ? null : st.households[p.household],
      men = p.sex === 'm' && hh && practice(st, hh) === 'everyone' ? SPINNERS.men : 0;
    return Math.max(own, men, stand & 1 ? SPINNERS.women.wife : 0);
  }
  // A fleece spun into a skein: one fleece taken, one skein put; nothing without a fleece.
  function spun(st, hh) {
    if (woolOf(hh) < 1) return 0;
    Stores.take(st, hh, 'wool', 1, 'spin');
    Stores.put(st, hh, 'yarn', 1, 'spin');
    return 1;
  }
  // Two skeins woven into a length, of the grade the weaver's skill draws (sim/workmanship); nothing without the skeins.
  function woven(st, hh, maker) {
    if (yarnOf(hh) < TEXTILE.skeins) return 0;
    Stores.take(st, hh, 'yarn', TEXTILE.skeins, 'weave');
    Stores.put(st, hh, 'cloth', 1, { kind: 'weave', grade: maker == null ? 1 : draw(st, maker, 'weaving') });
    return 1;
  }
  // The loom, a making the head begins through the verb project (sim/makings): possible with none and none under way, and a village wood
  // to fell its timber in. The head weighs it once a year from the winter's start, and wants it when the household holds the yarn of a
  // length spun and waiting (so settlers build theirs once the spinning is under way, not in their first busy winter). A small
  // construction, beside any other project (VB-1414).
  declare('loom', {
    small: true,
    why: (st, hh, f) => {
      if (hasLoom(hh)) return `the household has a loom`;
      if (Projects.underWay(st, hh.id, 'loom')) return `the household has a loom under way`;
      return st.villages[f.village].wood.length
        ? null
        : `${st.villages[f.village].name} has no wood to fell its timber in`;
    },
    begin: (st, hh, f) => ({
      steps: [{ kind: 'loom', place: f.house, hours: TEXTILE.loomHours, wood: 0, timber: TEXTILE.loomTimber }],
    }),
    look: {
      from: 3 * SEASON_DAYS,
      want: (st, hh, f) =>
        !hasLoom(hh) && st.villages[f.village].wood.length && yarnOf(hh) >= TEXTILE.skeins ? {} : null,
    },
  });
  // The looms a scenario's households start with: every farm that has stood for years has one (not the founders', who land with what
  // they carry), as its hand cart (sim/carts seedCarts).
  function seedLooms(st) {
    for (const id of st.liveHouseholds)
      if (st.households[id].farmstead !== null) st.households[id].loom = { built: st.t };
  }
  // The fleeces a scenario's households start with (VB-363): a household with sheep holds the year's, one for each, as the fold shears them.
  function seedFleeces(st) {
    const now = st.t;
    st.t = 0; // booked at the start, as the households' provisions are
    for (const hd of st.herds) {
      if (hd.species !== 'sheep' || hd.household === null || !st.households[hd.household]) continue;
      const hh = st.households[hd.household];
      if (hh.farmstead !== null) Stores.put(st, hh, 'wool', hd.ewes + hd.rams, 'start');
    }
    st.t = now;
  }
  function loomBuilt(st, j, hh) {
    const f = st.farmsteads[hh.farmstead];
    hh.loom = { built: st.t };
    log(st, `${f.name} has built a loom.`, { kind: 'loomBuilt', ...atFarm(f) });
  }
  const atHouse = (dx, dy) => (st, a, j) => [st.w.hx[j.site] + dx + a.ox * 0.3, st.w.hy[j.site] + dy + a.oy * 0.3];
  // The job kinds (sim/kinds registers them; their fields are described there).
  const KINDS = {
    spin: {
      verb: 'Spinning',
      go: 'Going home to spin',
      name: 'Spin the wool',
      at: ['house'],
      needs: ['fleece'],
      gives: ['yarn'],
      label: 'Spinning',
      anim: null,
      hours: TEXTILE.spinHours,
      hands: 1,
      type: 'household',
      craft: 'spinning',
      yields: true,
      reach: TEXTILE.reach,
      rate: TEXTILE.rate,
      rank,
      spot: atHouse(-3, 3),
      urgency: () => TEXTILE.urgency,
      // the hours spun are practice at the craft for each holder minding it (a background task's hands are reckoned once, sim/work)
      worked: (st, j, dt) => {
        for (const id of j.claims) Skills.practise(st, id, 'spinning', dt * TEXTILE.rate);
      },
      done: (st, j, hh) => {
        spun(st, hh);
      },
      // while the household holds a fleece and fewer skeins than its stock
      available: (st, hh, f, c, post) => {
        if (woolOf(hh) >= 1 && yarnOf(hh) < TEXTILE.yarnStock) post(`spin:h${hh.id}`, f.house, { farm: f });
      },
    },
    weave: {
      verb: 'Weaving',
      go: 'Going home to weave',
      name: 'Weave cloth',
      at: ['house'],
      needs: ['yarn', 'loom'],
      gives: ['cloth'],
      label: 'Weaving',
      anim: null,
      hours: TEXTILE.weaveHours,
      hands: 1,
      type: 'household',
      craft: 'weaving',
      rank,
      spot: atHouse(3, 3),
      urgency: () => TEXTILE.urgency,
      done: (st, j, hh, c, maker) => {
        woven(st, hh, maker);
      },
      // while the household has its loom and the skeins of a length
      available: (st, hh, f, c, post) => {
        if (hasLoom(hh) && yarnOf(hh) >= TEXTILE.skeins) post(`weave:h${hh.id}`, f.house, { farm: f });
      },
    },
    loom: {
      verb: 'Building a loom',
      go: 'Going to build the loom',
      name: 'Build a loom',
      at: ['house'],
      needs: ['timber'],
      gives: ['loom'],
      label: 'Loom',
      anim: 'mallet',
      hours: TEXTILE.loomHours,
      hands: 1,
      type: 'upkeep',
      craft: 'building',
      project: true,
      spot: atHouse(3, 3),
      done: (st, j, hh) => Projects.stepEnds(st, j, hh, loomBuilt),
    },
  };
  // worked indoors (VB-1820: the work step says it, sim/methods labour; no field of the kind)
  VB['sim/methods'].labour(KINDS.weave, { inside: true });
  VB['sim/methods'].labour(KINDS.loom, { inside: true });
  VB['sim/methods'].mind(KINDS.spin); // spinning minded beside other work, a charge held (VB-1750)
  return { TEXTILE, SPINNERS, KINDS, practice, rank, hasLoom, yarnOf, clothOf, spun, woven, seedLooms, seedFleeces };
})();
