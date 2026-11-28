// @sys sim/ironwork [material]: iron tools, a first version (VB-701): a household's tools and their condition, worn by field work and felling and
// slowing it, never barring it; bog ore smelted with firewood in a pit at the farm into a bloom; a winter's mending with iron
// Design: design.md, Goods, production and animals (Goods of place; Skill and tools); AGENTS.md, Deciding without Kim (7, 9, 16). Kim, 16
// Nov: the wear is the recurring sink, and the place is the bog. A farm's tools keep one condition (VB-762 adds the grade of the set's
// ironwork: the wear and the tools' share of the rate each take its multiplier here, wearOf and shareOf). VB-364 builds the bloomery as a
// facility, with a better yield; VB-121 the winter crafts (the mending's autumn rule and a ceiling without iron); VB-743 the whetstone's
// multiplier on the wear.
VB['sim/ironwork'] = (() => {
  const Rules = VB['sim/registry'];
  const Stores = VB['sim/stores'],
    Targets = VB['sim/targets'],
    Goods = VB['sim/goods'];
  // @tunable TOOLS: a household's tools (VB-701; Proposed, the numbers of VB-121's plan, no source but the reckoning here, for the tuning
  // run). kinds: the job kinds the tools wear at and speed (ploughing and breaking ground, reaping, felling for a plot, firewood and timber:
  // the plough's share, the spade, the sickle and the axe); wear: the condition an hour of that work takes (a tenth in 100 hours, about a
  // farm's year of it: docs/tuning.md); share: the part of a hand's rate at that work its tools give, by their condition (at 0 the work
  // goes at 1 - share: a wooden spade still digs); mend: the condition a mending restores; mendHours: its hours, by one hand in the house;
  // mendIron: the blooms a mending takes (a bloom mends the whole set from nothing); seasons: when tools are mended (winter: the slack).
  const TOOLS = {
    kinds: ['plow', 'break', 'reap', 'fell', 'wood', 'timber'],
    wear: 0.001,
    share: 0.15,
    mend: 0.1,
    mendHours: 4,
    mendIron: 0.1,
    seasons: [3],
  };
  // @tunable IRON: smelting bog ore in a pit at the farm (VB-701; Proposed, VB-364's numbers for the pit, which its bloomery betters): ore,
  // the loads of bog ore a bloom takes (DIG.stock's four: the household's dug stock); wood, the loads of firewood burnt (charcoal and the
  // pit's fire); hours, the work by all hands at it; hands, how many may work it; seasons, autumn and winter (after the harvest, the bog
  // ore dug in the slack of summer); urgency: a side craft's (MATCH.urgency's scale), as digging's, tar's and salt's.
  const IRON = { ore: 4, wood: 6, hours: 10, hands: 2, seasons: [2, 3], urgency: 0.5 };
  const TOOLED = Object.freeze(Object.fromEntries(TOOLS.kinds.map((k) => [k, true])));
  // @state household.tools: the condition of the household's tools, 0 (worn out: wood and stone) to 1 (sound), undefined for sound (a new
  //   household's first set is its own, made of what its members brought); written only here
  const condition = (hh) => (hh.tools === undefined ? 1 : hh.tools);
  // The seams for the set's grade (VB-762) and the whetstone (VB-743): what an hour wears, and the tools' share of the rate. 1 and TOOLS.share now.
  const wearOf = () => TOOLS.wear;
  const shareOf = () => TOOLS.share;
  // The household a job's tools are of: its owner's, where a household owns it; null for a village's work (its common fields: the tools
  // its households bring are not reckoned) and for any kind the tools do not touch.
  const toolsOf = (st, j) =>
    TOOLED[j.kind] && j.owner && j.owner.type === 'household' ? st.households[j.owner.id] : null;
  // The factor on a hand's rate at job j (sim/work manning, sim/estimate): 1 - share + share × condition at a tooled kind, 1 otherwise.
  // Allocates nothing.
  function rate(st, j) {
    const hh = toolsOf(st, j);
    if (!hh) return 1;
    const s = shareOf(st, hh);
    return 1 - s + s * condition(hh);
  }
  // `hours` of work done at job j (as sim/work reckons it: the hours of progress) wear its household's tools.
  function wear(st, j, hours) {
    const hh = toolsOf(st, j);
    if (!hh || !(hours > 0)) return;
    hh.tools = Math.max(0, condition(hh) - hours * wearOf(st, hh));
  }
  // ---- iron ----
  const ironOf = (hh) => hh.iron || 0;
  // The blooms the household's mending wants: what would mend its tools whole from their condition now (the head's target by default, VB-698).
  const mendingNeed = (hh) => ((1 - condition(hh)) * TOOLS.mendIron) / TOOLS.mend;
  const wants = (st, hh) => ironOf(hh) < Targets.target(st, hh, 'iron');
  // Iron as a made good (VB-698): its need the mending's; beyond it what the household's spare hours smelt, where its digging ground has bog
  // ore (as last searched, sim/dig: the view reads no new search; a ground not yet searched is taken to have it).
  Targets.made({
    good: 'iron',
    unit: 'bloom',
    whole: false,
    need: (st, hh) => mendingNeed(hh),
    most: (st, hh, f, spare) =>
      !hh.digAt || !f || hh.digAt.house !== f.house || hh.digAt.bogOre >= 0 ? Math.floor(spare / IRON.hours) : 0,
    held: (st, hh) => ironOf(hh),
  });
  // Iron as a good of the fair (design.md, Quanta and worth: a bloom at the culture's worth, VB-364's 30 rations; it keeps, and every
  // household's tools wear, so it is a keeping good). Not eaten.
  Goods.declareGood({
    id: 'iron',
    kind: 'iron',
    class: 'wares',
    unit: 'bloom',
    quantum: 1,
    lump: 'bloom',
    rations: 0,
    weight: 5,
    perish: null,
    keeping: true,
  });
  // Iron's need term (the rule sim/foodneed declares): what a household lacks of its target (by default its mending need) is worth the
  // good's customary worth a bloom, so a village with no bog takes iron at the fair and as a gift; beyond the target it is a keeping good.
  const worthCtx = { good: null }; // reused: the term allocates nothing
  const lack = (due, n) => (due > n ? due - n : 0);
  Rules.contribute({
    rule: 'need',
    source: 'sim/ironwork',
    key: 'iron',
    label: 'Iron, for mending the tools',
    tunables: ['TOOLS.mendIron', 'TOOLS.mend'],
    value: (st, c) => {
      if (c.good.id !== 'iron' || !c.hh) return 0;
      const due = Targets.target(st, c.hh, 'iron'),
        n = ironOf(c.hh);
      worthCtx.good = c.good;
      return (Rules.value(st, 'worth', worthCtx) / c.good.quantum) * (lack(due, n) - lack(due, Math.max(0, n + c.n)));
    },
  });
  // The firewood the household may burn in the pit: its pile less what a project holds back.
  const freeWood = (st, hh) => (hh.wood || 0) - Stores.reserved(st, hh, 'wood');
  const canSmelt = (st, hh) => (hh.bogOre || 0) >= IRON.ore && freeWood(st, hh) >= IRON.wood;
  // A smelting finished: the ore and the wood are taken and a bloom put in the store; none if either was used meanwhile.
  function smelted(st, hh) {
    if (!canSmelt(st, hh)) return 0;
    Stores.take(st, hh, 'bogOre', IRON.ore, 'smelt');
    Stores.take(st, hh, 'wood', IRON.wood, 'smelt');
    return Stores.put(st, hh, 'iron', 1, 'smelt');
  }
  // A mending finished: a tenth of a bloom taken, the tools a tenth sounder, up to whole; nothing without the iron.
  function mended(st, hh) {
    if (ironOf(hh) < TOOLS.mendIron - 1e-9) return 0;
    Stores.take(st, hh, 'iron', Math.min(ironOf(hh), TOOLS.mendIron), 'mendtools');
    hh.tools = Math.min(1, condition(hh) + TOOLS.mend);
    return 1;
  }
  const needsMending = (hh) => condition(hh) < 1 - TOOLS.mend / 2;
  const atHouse = (dx, dy) => (st, a, j) => [st.w.hx[j.site] + dx + a.ox * 0.3, st.w.hy[j.site] + dy + a.oy * 0.3];
  // The job kinds (sim/kinds registers them; their fields are described there).
  const KINDS = {
    smelt: {
      verb: 'Smelting bog ore',
      go: 'Going to the smelting pit',
      name: 'Smelt bog ore',
      at: ['farm'],
      needs: ['ore', 'firewood'],
      gives: ['iron'],
      label: 'Smelting',
      anim: 'mallet',
      hours: IRON.hours,
      hands: IRON.hands,
      type: 'upkeep',
      craft: 'smelting',
      spot: atHouse(-12, 8),
      urgency: () => IRON.urgency,
      done: (st, j, hh) => {
        smelted(st, hh);
      },
      // in autumn and winter, while the household wants iron and holds the ore and the wood for a bloom
      available: (st, hh, f, c, post) => {
        if (IRON.seasons.includes(c.season) && wants(st, hh) && canSmelt(st, hh))
          post(`smelt:h${hh.id}`, f.house, { farm: f });
      },
    },
    mendtools: {
      verb: 'Mending the tools',
      go: 'Going home to mend the tools',
      name: 'Mend the tools',
      at: ['house'],
      needs: ['iron'],
      gives: ['tools'],
      label: 'Mending',
      anim: 'mallet',
      hours: TOOLS.mendHours,
      hands: 1,
      type: 'upkeep',
      craft: 'smithing',
      spot: atHouse(0, 0),
      urgency: () => IRON.urgency,
      done: (st, j, hh) => {
        mended(st, hh);
      },
      // in winter, while the tools are worn by more than half a mending and the household holds the iron for one
      available: (st, hh, f, c, post) => {
        if (TOOLS.seasons.includes(c.season) && needsMending(hh) && ironOf(hh) >= TOOLS.mendIron - 1e-9)
          post(`mendtools:h${hh.id}`, f.house, { farm: f });
      },
    },
  };
  // worked indoors (VB-1820: the work step says it, sim/methods labour; no field of the kind)
  VB['sim/methods'].labour(KINDS.mendtools, { inside: true });
  return { TOOLS, IRON, KINDS, condition, rate, wear, wants, mendingNeed, smelted, mended };
})();
