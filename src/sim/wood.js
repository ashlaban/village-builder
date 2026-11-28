// @sys sim/wood: the wood of the household (VB-2011, split from sim/chores): the job kinds and goals that fell timber in the woods and
//   carry it home (wood; the goal fell), cut it into firewood at the house (firewood) or where it lies (cutpile; the goal firewood, VB-1931),
//   with the woodpile's reads the other modules take (fuelFree, timberOf, pileOf, fireAmount) and the hours of a load (WOOD_HOURS)
// Like sim/chores, it takes from the world (sim/forest's trees, sim/lying's piles) and puts into the house (sim/stores' timber and wood), so
// it lives above both, in the material layer. sim/kinds joins its KINDS and GOALS into the registry.
VB['sim/wood'] = (() => {
  const { targetOf, plansIn, taskAt } = VB['sim/steps'];
  const { woodWhy } = VB['sim/territory'];
  const Stores = VB['sim/stores'],
    { reserved } = Stores;
  const { PEAT, TRAVEL, cal } = VB['sim/rules'];
  const { fellTree, drawWood } = VB['sim/forest'];
  const Lying = VB['sim/lying'];
  const { fireOf } = VB['sim/house'];
  // The woodpile's goal this season, and the level under which a second hand cuts: the household's standing plan's targets (sim/plans).
  const woodTargets = (st, hh) => targetOf(st.plans.households.get(hh.id), 'wood');
  // The fuel pile in wood loads: the woodpile less what a project plan holds back, and the peat held at PEAT.worth (VB-367).
  const fuelFree = (st, hh) => hh.wood - reserved(st, hh, 'wood') + PEAT.worth * (hh.peat || 0);
  // The timber the household holds, felled and home, not yet cut (VB-1653; absent: none), in the woodpile's loads.
  const timberOf = (hh) => (hh.timber > 1e-9 ? hh.timber : 0);
  // ---- firewood cut wherever timber lies (VB-1931; Kim, 27 Nov 2026: "cut should be possible on any tile with timber that you or
  // nobody owns") ----
  // The timber lying as felled ('wood') or left ('leftTimber'); a building's timber on its way to its site is the building's, not cut.
  const CUTTABLE = ['wood', 'leftTimber'];
  // Whose a lying load is for household hid: its own, nobody's (its household gone), or another's (another household's, a village's).
  const titleFor = (st, l, hid) => {
    const o = l.owner;
    if (o.type !== 'household') return 'other';
    if (o.id === hid) return 'own';
    const hh = st.households[o.id];
    return !hh || hh.dissolved ? 'nobody' : 'other';
  };
  // The timber lying at `tile` that household hid may cut, its own first, then nobody's ({piles, n} in TRAVEL's loads), and the loads of
  // another's there.
  function cuttableAt(st, hid, tile) {
    const own = [],
      nobody = [];
    let n = 0,
      other = 0;
    for (const l of Lying.pilesAt(st, tile)) {
      if (!CUTTABLE.includes(l.kind)) continue;
      const who = titleFor(st, l, hid);
      if (who === 'other') other += l.n;
      else {
        (who === 'own' ? own : nobody).push(l);
        n += l.n;
      }
    }
    return { piles: [...own, ...nobody], n: n > 1e-9 ? n : 0, other };
  }
  // The loads a fell task at `tile` of a plan of household hid's members has still to bring home (0 when there is none; the fell goal).
  const plannedLeft = (st, hid, tile) => {
    for (const pp of plansIn(st, hid)) {
      const t = pp.tasks.find((x) => x.key === undefined && x.kind === 'fell' && x.site === tile);
      if (t) return (t.n || 1) - (t.got || 0);
    }
    return 0;
  };
  // The house is cold, or its pile will not feed tonight's fire (VB-1547), the house's own (sim/house fireOf, VB-1669): the wood kinds'
  // vital rule.
  const fireShort = (st, hh) => hh.cold > 0 || fuelFree(st, hh) < st.ECON.woodUse[cal(st.t).season] * fireOf(st, hh);
  // @tunable WOOD_HOURS (VB-1653): the hours of one load of firewood in its two steps, felling a tree and cutting its timber at home; they
  //   sum to the firewood trip's 3 hours before the split, so a load costs the labour it did.
  const WOOD_HOURS = Object.freeze({ fell: 2, cut: 1 });
  // ---- the wood as methods (VB-1775; design.md section 7, The task as a plan): a goal read from the world at each leg's end ----
  // The loads (of ECON.woodPerTrip timber, a tree) a wood task still wants: the played pawn's planned fell task's loads left, else the pile's
  // shortfall of the season's goal, the timber home counted; a firewood task's, the pile's shortfall alone, and one while tonight's fire is short.
  // A wood task's goal is the pile, with the timber home, it was posted to reach (job.amount): a trip's worth, the household's best cart
  // full or a back load, no more than the season's goal wants; so one trip meets it, and a cut one goes on from what the world holds.
  // the timber home a building step does not hold back (timberKept) counts: the walls' timber is no firewood to fell for (VB-2033)
  const timberLoose = (st, hh) => Math.max(0, timberOf(hh) - timberKept(st, hh));
  const woodHave = (st, hh) => fuelFree(st, hh) + timberLoose(st, hh);
  const woodAmount = (st, hh) => {
    const P = st.ECON.woodPerTrip,
      short = Math.ceil((woodTargets(st, hh).seasons[cal(st.t).season] - woodHave(st, hh)) / P - 1e-9),
      trip = hh.carts.reduce((n, c) => Math.max(n, (c.kind === 'ox' ? TRAVEL.cart : TRAVEL.hand) / TRAVEL.load), 1);
    return woodHave(st, hh) + Math.max(0, Math.min(short, trip)) * P;
  };
  const woodNeed = (st, j) => {
    if (j.chosen) return plannedLeft(st, j.owner.id, j.site);
    const hh = st.households[j.owner.id]; // a task of a save from before VB-1775 has no amount: a trip's worth now
    return Math.ceil(((j.amount ?? woodAmount(st, hh)) - woodHave(st, hh)) / st.ECON.woodPerTrip - 1e-9);
  };
  // A firewood task's goal is the pile it was posted to reach (job.amount: the timber home then, cut, up to the season's goal; a cold house
  // one load at least), so it ends when that is cut, and goes to the woods for the rest only when the timber home is gone before.
  // The timber home that a building step of the household counts on (VB-1808): what its open project step, its cottage's walls or its plot's
  // walls still lack, the one read of sim/projects lacks; a firewood goal leaves it, where it would burn the walls' timber first.
  const timberKept = (st, hh) => {
    const { cottageTimber } = VB['sim/cottageplan'],
      sites = [];
    if (hh.farmstead !== null) {
      const f = st.farmsteads[hh.farmstead];
      sites.push(cottageTimber(st, f));
      // every step still to come of its project plans that carries timber, not only the open one (the barn's walls wait on its foundation)
      for (const plan of VB['sim/projects'].projectsOf(st, 'household', hh.id))
        for (let i = plan.open; i < plan.steps.length; i++)
          if (plan.steps[i].timber) sites.push({ site: plan.steps[i], need: plan.steps[i].timber });
      for (const n of VB['sim/expansion'].plotTimber(st, st.villages[f.village]))
        if (n.owner.id === hh.id && n.owner.type === 'household') sites.push(n);
    }
    let kept = 0;
    for (const n of sites) if (n) kept += VB['sim/projects'].lacks(n.site, n.need);
    return kept;
  };
  const fireAmount = (st, hh) => {
    const free = fuelFree(st, hh),
      want = Math.max(woodTargets(st, hh).seasons[cal(st.t).season] - free, hh.cold > 0 ? st.ECON.woodPerTrip : 0);
    return free + Math.min(Math.max(0, timberOf(hh) - timberKept(st, hh)), want);
  };
  const fireNeed = (st, j) => {
    const hh = st.households[j.owner.id]; // a task of a save from before VB-1775 has no amount: the pile's now
    return Math.ceil(((j.amount ?? fireAmount(st, hh)) - fuelFree(st, hh)) / st.ECON.woodPerTrip - 1e-9);
  };
  const titled = (g) => ({ type: 'household', id: g.owner });
  // The facts and steps the two kinds share: a cart fetched when one is free and the goal wants more than a back load; a walk out only for
  // wood to be had there, standing or felled (else the pawn walks out to learn there is none; VB-1747); felled at the work leg, the
  // timber lying at the tile a pile with title (sim/lying) until it is loaded; carried home and set down in the household's store.
  const cartOrNone = { any: [{ has: 'cart' }, { not: { free: 'cart' } }, { not: { can: 'cartPays' } }] };
  const fromWoods = (wood) => {
    const at = wood === 'site' ? 'site' : wood,
      had = { any: [{ can: 'trees' }, { pile: 'timber', at }], why: 'no trees standing' };
    return [
      {
        prim: 'fetch',
        thing: 'cart',
        at: 'cart',
        pre: [{ not: { has: 'cart' } }, { free: 'cart' }, { can: 'cartPays' }, had],
        eff: [cartOrNone],
        miss: true, // the timber goes home on it: one wanted and none free is a miss (sim/doing wanted, VB-1810)
      },
      { prim: 'go', at, pre: [cartOrNone, had], eff: [{ at }] },
      {
        prim: 'work',
        op: 'fell',
        at,
        pre: [{ at }, { can: 'trees', why: 'no trees standing' }],
        eff: [{ any: [{ pile: 'timber', at, min: 'load' }, { carries: 'timber' }] }],
      },
      {
        prim: 'load',
        good: 'timber',
        at,
        pre: [
          { at },
          { carries: null },
          { pile: 'timber', at },
          { any: [{ pile: 'timber', at, min: 'load' }, { not: { can: 'trees' } }] },
        ],
        eff: [{ carries: 'timber' }],
      },
      {
        prim: 'haul',
        good: 'timber',
        at: 'store',
        look: 'logs', // the load drawn in a pawn's arms or on its cart
        words: 'Carrying timber home',
        pre: [{ carries: 'timber' }],
        eff: [{ at: 'store' }],
      },
      {
        prim: 'unload',
        good: 'timber',
        at: 'store',
        pre: [{ carries: 'timber' }, { at: 'store' }],
        eff: [{ not: { carries: 'timber' } }],
      },
    ];
  };
  const cut = {
    prim: 'work',
    op: 'cut',
    at: 'store',
    pre: [{ at: 'store' }, { carries: null }, { store: 'timber', min: 1e-6, why: 'no timber at home' }],
    eff: [{ met: true }],
  };
  // The work legs' effects (sim/agents runs one when its leg ends, at the tile `at` where it was done): a tree of the tile felled and its
  // load of timber lying there, the household's; a load of the timber home cut and stacked on the woodpile.
  const OPS = {
    fell: {
      hours: WOOD_HOURS.fell,
      run: (st, j, g, at) => {
        fellTree(st, at);
        Lying.put(st, 'wood', TRAVEL.load, at, titled(g), {
          x: st.w.hx[at] - 4,
          y: st.w.hy[at] + 10,
          of: { src: at, farm: j.farm },
        });
      },
    },
    cut: {
      hours: WOOD_HOURS.cut,
      run: (st, j, g) => {
        const hh = st.households[g.owner],
          n = Stores.take(st, hh, 'timber', Math.min(timberOf(hh), st.ECON.woodPerTrip), 'cutting');
        if (n > 0) Stores.put(st, hh, 'wood', n, 'cutting');
      },
    },
  };
  const forestOf = (st, j) => (st.villages[j.farm.village].wood.length ? st.villages[j.farm.village].wood[0] : null);
  const treesAt = (st, t) => t !== null && t >= 0 && st.w.trees[t] > 0;
  // The pile's urgency below the season's goal, `have` what counts towards it (VB-327): 2.2 when nearly out; else its shortfall of the
  // goal, and more in autumn.
  const pileUrgency = (st, hh, c, U, have) => {
    if (have < U.woodLow) return U.woodLowUrgency;
    const goal = woodTargets(st, hh).seasons[c.season];
    return (goal - have) / goal + (c.season === 2 ? U.woodSummer : 0);
  };
  const KINDS = {
    // Wood in two steps (VB-1653; Kim, 24 Nov 2026: "Fell timber at the forest tile, and then cut firewood in the home"): a tree felled
    // in the woods and its load carried home as timber (wood), and the timber cut into firewood at the house (firewood). The hours of a
    // load are the old trip's, WOOD_HOURS.fell + WOOD_HOURS.cut; the urgency and the vital rule of the old trip are the step's that mends
    // the fire: a cold house cuts the timber it holds first, else fells.
    wood: {
      verb: 'Felling timber',
      go: 'Heading to the woods',
      name: 'Fell timber',
      at: ['woods'],
      needs: [],
      gives: ['timber'],
      label: 'Timber',
      anim: 'chop',
      hours: WOOD_HOURS.fell,
      hands: 1,
      type: 'wood',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      // a goal (VB-1775): the tile's trees felled, their timber loaded on the cart or the back and carried home, and back for more while the
      // goal wants loads (woodNeed); a cut at any leg goes on from what lies at the tile or is in hand
      need: woodNeed,
      met: (st, g) => woodNeed(st, g.job) <= 0,
      can: {
        trees: (st, g) => treesAt(st, g.at),
        cartPays: (st, g) => woodNeed(st, g.job) > 1,
      },
      ops: OPS,
      methods: [{ name: 'from the forest', steps: fromWoods('site') }],
      // lived by while the house is cold or the pile will not feed tonight's fire (VB-1547) and no timber is home to cut: a load felled is
      // carried home after work
      vital: (st, j) => {
        const hh = st.households[j.farm.household];
        return !timberLoose(st, hh) && fireShort(st, hh);
      },
      // 3 in a cold house with no timber to cut (VB-327: above cooking's 2.2); 2.2 when the pile and the timber are nearly out; else
      // their shortfall of the goal, and more in autumn
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        if (hh.cold > 0 && !timberLoose(st, hh)) return U.woodColdUrgency;
        return pileUrgency(st, hh, c, U, fuelFree(st, hh) + timberLoose(st, hh));
      },
      // a tile drawn from the village's wood, but for a trip the plan sent to a tile of its choosing (`chosen`)
      draw: (st, j) => (j.chosen ? -1 : drawWood(st, st.villages[j.farm.village])),
      // while the village has a wood and the pile's free wood (VB-123) with the timber home is below the plan's goal for the season; a
      // second job below its woodSecond. For each pawn's plan in the household, a trip to the tile of each `fell` task of its plan with trips
      // left and trees standing (sim/steps' plansIn), whatever the pile.
      available: (st, hh, f, c, post0) => {
        const wood = st.villages[f.village].wood;
        // a task that blocked for want of trees is not posted again until a tree stands in the wood (VB-1809)
        const post = (key, ...rest) => {
          const b = hh.blocked && hh.blocked[key];
          if (b && b.why === 'no trees standing' && !wood.some((t) => st.w.trees[t] > 0)) return;
          if (b) delete hh.blocked[key];
          post0(key, ...rest);
        };
        const T = woodTargets(st, hh);
        const have = woodHave(st, hh);
        if (wood.length && have < T.seasons[c.season]) {
          const amount = woodAmount(st, hh);
          post(`wood:h${hh.id}`, wood[0], { farm: f, amount });
          if (have < T.second) post(`wood:h${hh.id}b`, wood[0], { farm: f, amount });
        }
        for (const pp of plansIn(st, hh.id))
          for (const t of pp.tasks)
            if (t.kind === 'fell' && t.key === undefined && (t.got || 0) < (t.n || 1) && st.w.trees[t.site] > 0)
              post(`wood:h${hh.id}:t${t.site}`, t.site, { farm: f, chosen: true });
      },
    },
    firewood: {
      daily: true, // its hours reserved before anything authored (VB-1755)
      verb: 'Cutting firewood',
      go: 'Going home to cut firewood',
      name: 'Cut firewood',
      at: ['farm'],
      needs: ['timber'],
      gives: ['firewood'],
      label: 'Firewood',
      anim: 'chop',
      hours: WOOD_HOURS.cut,
      hands: 1,
      type: 'wood',
      spot: (st, a, j) => [st.w.hx[j.site] + 10 + a.ox * 0.3, st.w.hy[j.site] + 8],
      // a goal (VB-1775), the firewood table of docs/plans/four-scales/README.md 3.2: the timber at home cut while the pile wants loads
      // (fireNeed); with none home, felled in the village's wood, carried home and cut
      need: fireNeed,
      met: (st, g) => fireNeed(st, g.job) <= 0,
      places: { forest: (st, g) => forestOf(st, g.job) },
      can: {
        trees: (st, g) => treesAt(st, forestOf(st, g.job)),
        cartPays: (st, g) => fireNeed(st, g.job) > 1,
      },
      ops: OPS,
      methods: [
        {
          name: 'the timber at home', // cut what lies at home first, from wherever the pawn stands with empty hands
          when: [{ store: 'timber', min: 1e-6 }, { carries: null }],
          steps: [{ prim: 'go', at: 'store', pre: [], eff: [{ at: 'store' }] }, cut],
        },
        { name: 'from the forest', steps: [...fromWoods('forest'), cut] },
      ],
      // as the trip to the woods was before the split: lived by while the house is cold or the pile will not feed tonight's fire; and
      // then begun after work too, until MATCH.day.evening (sim/day eveningCall), as the load of the old trip came home with its wood
      vital: (st, j) => fireShort(st, st.households[j.farm.household]),
      evening: (st, j) => fireShort(st, st.households[j.farm.household]),
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        return hh.cold > 0 ? U.woodColdUrgency : pileUrgency(st, hh, c, U, fuelFree(st, hh));
      },
      // at the house, while timber is home and the pile wants it (fireAmount: below the season's goal, or the house cold); a
      // second job below its woodSecond with more than a load home
      available: (st, hh, f, c, post) => {
        cutAway(st, hh, f, post);
        const timber = timberOf(hh);
        if (!timber) return;
        const T = woodTargets(st, hh),
          free = fuelFree(st, hh);
        const amount = fireAmount(st, hh);
        if (amount > free + 1e-9) {
          post(`firewood:h${hh.id}`, f.house, { farm: f, amount });
          if (free < T.second && timber > st.ECON.woodPerTrip)
            post(`firewood:h${hh.id}b`, f.house, { farm: f, amount });
        }
      },
    },
    // Firewood cut where timber lies (VB-1931): the timber of the household's, or of nobody's, cut into firewood at its tile a load a
    // cutting and carried home to the woodpile; posted only for a firewood task a pawn's plan holds off the house (cutAway).
    cutpile: {
      verb: 'Cutting firewood',
      go: 'Going to cut firewood where timber lies',
      name: 'Cut firewood where timber lies',
      at: ['road'],
      needs: ['timber'],
      gives: ['firewood'],
      label: 'Firewood',
      anim: 'chop',
      hours: WOOD_HOURS.cut,
      hands: 1,
      type: 'wood',
      urgency: (st, j, c, U) => {
        const hh = st.households[j.owner.id];
        return hh.cold > 0 ? U.woodColdUrgency : pileUrgency(st, hh, c, U, fuelFree(st, hh));
      },
    },
  };
  // the cutting where timber lies: a load of it cut at the tile into the hand (its own first, then nobody's), carried home and stacked
  // on the woodpile, while timber the household may cut lies there and the pile wants it (or the house is cold)
  VB['sim/methods'].carry(KINDS.cutpile, 'cutpile', {
    op: 'cut',
    hours: WOOD_HOURS.cut,
    look: 'logs',
    words: 'Carrying firewood home',
    run: (st, j, g, at, a) => {
      let n = 0;
      for (const l of cuttableAt(st, g.owner, at).piles) {
        if (n >= TRAVEL.load - 1e-9) break;
        n += Lying.takeFrom(st, l, TRAVEL.load - n);
      }
      if (n > 0) a.load = n;
    },
    // met once nothing is left to cut there or the pile wants none; never while firewood cut there lies (one set down on its way home:
    // a goal of the owner's, sim/lying BRING)
    met: (st, g) => {
      const hh = st.households[g.owner];
      if (Lying.amountAt(st, g.at, 'cutpile', titled(g)) > 0) return false;
      return !cuttableAt(st, g.owner, g.at).n || !(hh.cold > 0 || pileOf(st, hh).short);
    },
    deliver: (st, j, hh, f, a) => {
      const n = (st.ECON.woodPerTrip * a.load) / TRAVEL.load;
      Stores.put(st, hh, 'wood', n, 'cutting');
      return n;
    },
  });
  // ---- goals (VB-1777): a task at a tile carried through several steps by these kinds' methods (sim/kinds GOALS joins them) ----
  // fell: n loads of timber felled on a forest tile and carried home (VB-1653; Kim, 24 Nov 2026), on any tile the household's village
  // may fell on (sim/territory woodWhy: the tiles the rule of the village's wood may give it, whatever its size, within WOOD.far of its
  // centre; a lone farm's village is its own, so the same rule); the household's farm takes the timber. Its trips home are counted on the
  // task by sim/steps (the event timberHome).
  const FELL_MAX = 20;
  const homeOf = (st, hid) => {
    const hh = st.households[hid];
    return hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
  };
  const fell = {
    noun: 'felling',
    mark: null,
    kinds: ['wood'],
    which: ['home', 'bare', 'gone'],
    args: (g) => {
      const n = g.n === undefined || g.n === null ? 1 : g.n;
      return Number.isInteger(n) && n >= 1 && n <= FELL_MAX
        ? { n, got: 0 }
        : `cannot plan ${g.n} loads to fell (1 to ${FELL_MAX})`;
    },
    at: (st, hid, tile) => {
      const f = homeOf(st, hid);
      if (!f || st.households[hid].dissolved || !st.villages[f.village]) return null;
      const t = taskAt(st, hid, 'fell', tile);
      return { f, tile, n: t ? t.n : 1, got: t ? t.got : 0 };
    },
    none: () => 'the household has no farm to carry timber home to',
    why: (st, { f }, tile) => woodWhy(st, st.villages[f.village], tile),
    // the trips left, each a tree felled and its timber home, while trees stand there
    steps: (st, hid, { tile, n, got }) =>
      st.w.trees[tile] > 0 && got < n ? [{ kind: 'wood', hours: WOOD_HOURS.fell, n: n - got, from: -Infinity }] : [],
    gone: (st, { tile, n, got }) => (got >= n ? 'home' : st.w.trees[tile] > 0 ? null : 'bare'),
    deadline: () => null,
  };
  // firewood: the timber home cut into firewood at the house, until it is all cut or the pile holds the season's goal (VB-1653).
  // The pile's free wood against the season's goal (the head's plan's targets, sim/plans), and whether it is short.
  const pileOf = (st, hh) => {
    const plan = st.plans.households.get(hh.id),
      goal = targetOf(plan, 'wood') ? targetOf(plan, 'wood').seasons[cal(st.t).season] : 0,
      free = fuelFree(st, hh);
    return { free, goal, short: free < goal };
  };
  // Whether a plan of household hid's members holds a fell task with trips left (timber to come home).
  const fellPlanned = (st, hid) =>
    plansIn(st, hid).some((pp) => pp.tasks.some((t) => t.key === undefined && t.kind === 'fell' && t.got < t.n));
  // The cuttings where timber lies (KINDS.cutpile): one for each firewood task off the house of a plan of the household's members, while
  // timber it may cut lies there and the pile wants it or the house is cold; and one at the first pile of firewood cut so and set down on
  // its way home (by the household's index of its piles), whatever the pile, to bring it home.
  function cutAway(st, hh, f, post) {
    const down = (Lying.ownedPiles(st, { type: 'household', id: hh.id }) || []).find((l) => l.kind === 'cutpile');
    if (down) post(`cutpile:h${hh.id}`, down.tile, { farm: f }, 'cutpile');
    const want = hh.cold > 0 || pileOf(st, hh).short;
    if (!want) return;
    for (const pp of plansIn(st, hh.id))
      for (const t of pp.tasks)
        if (t.kind === 'firewood' && t.key === undefined && t.site !== f.house && cuttableAt(st, hh.id, t.site).n > 0)
          post(`cutpile:h${hh.id}:t${t.site}`, t.site, { farm: f }, 'cutpile');
  }
  // the household's timber lying where a cutting of its is planned is kept for it: no goal of the household's takes it up as a stray
  // (VB-1931 review: its felling's stray method fetched it home as timber, the cutting left with nothing to cut)
  Lying.keep(
    (st, l) =>
      CUTTABLE.includes(l.kind) &&
      l.owner.type === 'household' &&
      plansIn(st, l.owner.id).some((pp) =>
        pp.tasks.some((t) => t.key === undefined && t.kind === 'firewood' && t.site === l.tile),
      ),
  );
  const firewood = {
    noun: 'firewood',
    mark: null,
    kinds: ['firewood', 'cutpile'],
    which: ['cut', 'full', 'gone'],
    // at the house; or at a tile where timber lies (`away`, VB-1931) that the household may cut, its own or nobody's (`others`: only
    // another's lies there), and at a tile planned so while the plan holds the task
    at: (st, hid, tile, task) => {
      const f = homeOf(st, hid),
        hh = st.households[hid];
      if (!f || hh.dissolved) return null;
      if (f.house === tile) return { f, hh, tile };
      const c = cuttableAt(st, hid, tile);
      if (c.n > 0 || task) return { f, hh, tile, away: c.n };
      return c.other > 0 ? { f, hh, tile, away: 0, others: true } : null;
    },
    none: (tile) => `the household's house is not at ${tile}, and no timber of its own or of nobody's lies there`,
    // timber home, or a felling planned to bring it; the pile short of the season's goal. Off the house, timber of its own or of nobody's
    // lying there: another household's is not the household's to cut
    why: (st, { hh, tile, away, others }) => {
      if (others) return `the timber at ${tile} is another's: only timber of the household's own or of nobody's is cut`;
      if (away === undefined && !timberOf(hh) && !fellPlanned(st, hh.id))
        return 'no timber is home to cut: fell timber first';
      return pileOf(st, hh).short ? null : "the woodpile holds the season's goal";
    },
    // the loads left to cut: the timber home (off the house, the timber lying there), at most the pile's shortfall, ECON.woodPerTrip a load
    steps: (st, hid, { hh, away }) => {
      const p = pileOf(st, hh);
      if (away !== undefined) {
        const x = Math.min(away, Math.max(0, p.goal - p.free) * (TRAVEL.load / st.ECON.woodPerTrip));
        return x > 0
          ? [{ kind: 'cutpile', hours: WOOD_HOURS.cut, n: Math.ceil(x / TRAVEL.load - 1e-9), from: -Infinity }]
          : [];
      }
      const per = st.ECON.woodPerTrip,
        x = Math.min(timberOf(hh), Math.max(0, p.goal - p.free));
      return x > 0 || fellPlanned(st, hh.id)
        ? [{ kind: 'firewood', hours: WOOD_HOURS.cut, n: Math.max(1, Math.ceil(x / per - 1e-9)), from: -Infinity }]
        : [];
    },
    gone: (st, { hh, away }) => {
      if (!pileOf(st, hh).short) return 'full';
      if (away !== undefined) return away > 0 ? null : 'cut';
      return !timberOf(hh) && !fellPlanned(st, hh.id) ? 'cut' : null;
    },
    deadline: () => null,
    // the household's rule that holds the cutting back: no timber home, or the pile at the season's goal with the house warm
    hold: (st, hid, where, y) => {
      if (y.kind === 'cutpile') return !(where.hh.cold > 0) && !pileOf(st, where.hh).short ? ['woodpile'] : null;
      if (y.kind !== 'firewood') return null;
      if (!timberOf(where.hh)) return ['timber'];
      return !(where.hh.cold > 0) && !pileOf(st, where.hh).short ? ['woodpile'] : null;
    },
    // the plan asks its head at once for a cutting its rule would post but has not (timber home, the pile below the season's goal or
    // the house cold; VB-1661: it waited up to three days for the household's planning day, by its head's diligence, sim/plandays)
    ask: (st, hid, task) => {
      const hh = st.households[hid],
        f = homeOf(st, hid);
      if (task && f && task.site !== f.house)
        return (
          (hh.cold > 0 || pileOf(st, hh).short) &&
          !st.jobs.has(`cutpile:h${hid}:t${task.site}`) &&
          cuttableAt(st, hid, task.site).n > 0
        );
      return timberOf(hh) > 0 && (hh.cold > 0 || pileOf(st, hh).short) && !st.jobs.has(`firewood:h${hid}`);
    },
  };
  const GOALS = { fell, firewood };
  return { KINDS, GOALS, WOOD_HOURS, fireAmount, fuelFree, timberOf, pileOf };
})();
