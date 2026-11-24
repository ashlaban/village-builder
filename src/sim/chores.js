// @sys sim/chores: the job kinds of the household's daily work at the house: felling timber and cutting it to firewood, fetching water, cooking, brewing and
// gathering wild food; what turns something of the world (a tree, the well, the woods' berries) into something in the house
// VB-418: these kinds have no domain module of their own. Each takes from one module (sim/forest, sim/forage: the world) and puts into
// another (sim/stores, sim/pot), so it lives above both, in the material layer: the beginning of target-v2's production (4.3). `brew`
// goes to the ale's module when sim/stores is split (VB-416). sim/kinds joins KINDS into the registry, where a kind's fields are described.
VB['sim/chores'] = (() => {
  const Stores = VB['sim/stores'],
    { reserved } = Stores,
    { target } = VB['sim/targets'];
  const { WORK, FISH, BREW, PEAT, TRAVEL, cal } = VB['sim/rules'],
    { FORAGE } = VB['sim/forage'],
    Carts = VB['sim/carts'],
    { hasTeam } = VB['sim/herds'],
    AFTERNOON = VB['sim/roles'].MATCH.day.afternoon, // the afternoon's hour, when the head allots the day again (sim/day; VB-1546)
    EVENING = VB['sim/roles'].MATCH.day.evening; // the hour past which no evening task is begun (VB-1547)
  const { fellTree, drawWood } = VB['sim/forest'];
  const { emit } = VB['sim/events'];
  const { dailyNeed, floorOf, spareDays, spareUrgency } = VB['sim/hunger'],
    Pot = VB['sim/pot'];
  const { ground: forageGround, gather } = VB['sim/forage'];
  const Water = VB['sim/water'],
    { WATER, atHome } = Water,
    { FRESH } = VB['world/water'];
  const { age } = VB['sim/records'];
  // The woodpile's goal this season, and the level under which a second hand cuts: the household's standing plan's targets (sim/plans).
  const woodTargets = (st, hh) => st.plans.households.get(hh.id).targets;
  // The fuel pile in wood loads: the woodpile less what a project plan holds back, and the peat held at PEAT.worth (VB-367).
  const fuelFree = (st, hh) => hh.wood - reserved(st, hh, 'wood') + PEAT.worth * (hh.peat || 0);
  // The timber the household holds, felled and home, not yet cut (VB-1625; absent: none), in the woodpile's loads.
  const timberOf = (hh) => (hh.timber > 1e-9 ? hh.timber : 0);
  // The loads a fell task of the played pawn's plan at `tile` has still to bring home (0 when there is none; sim/planchains' fell).
  const plannedLeft = (st, tile) => {
    const pp = st.player && st.player.plan,
      t = pp && pp.tasks.find((x) => x.key === undefined && x.kind === 'fell' && x.fell === tile);
    return t ? (t.n || 1) - (t.got || 0) : 0;
  };
  // The house is cold, or its pile will not feed tonight's fire (VB-1547): the wood kinds' vital rule.
  const fireShort = (st, hh) => hh.cold > 0 || fuelFree(st, hh) < st.ECON.woodUse[cal(st.t).season];
  // @tunable WOOD_HOURS (VB-1625): the hours of one load of firewood in its two steps, felling a tree and cutting its timber at home; they
  //   sum to the firewood trip's 3 hours before the split, so a load costs the labour it did.
  const WOOD_HOURS = Object.freeze({ fell: 2, cut: 1 });
  // The pile's urgency below the season's goal, `have` what counts towards it (VB-327): 2.2 when nearly out; else its shortfall of the
  // goal, and more in autumn.
  const pileUrgency = (st, hh, c, U, have) => {
    if (have < U.woodLow) return U.woodLowUrgency;
    const goal = woodTargets(st, hh).wood[c.season];
    return (goal - have) / goal + (c.season === 2 ? U.woodSummer : 0);
  };
  // The household has fewer meals than the coming meal needs, grain, fresh food (VB-119) or seed it would eat (VB-388) to cook it from, and
  // wood in the pile (VB-327: an empty pile cannot cook; the pot burns no wood of its own, the day's use is the hearth's) and the day's water
  // in (VB-331: a dry day's meal is eaten uncooked).
  const cookWanted = (st, hh, c) =>
    hh.cookDay !== c.day && hh.waterDay === c.day && hh.wood > 0 && Pot.cookable(st, hh, dailyNeed(st, hh));
  // Ale is wanted (VB-305) while the household holds fewer barrels than its head's target (VB-698; BREW.stock by default) and has the grain
  // for one above its floor (which holds the seed reserve): a household never brews grain it needs.
  const brewWanted = (st, hh) =>
    Stores.aleOf(st, hh) < target(st, hh, 'ale') && Stores.grainOf(hh) - floorOf(st, hh) >= BREW.grain;
  // Gathering: from summer day FORAGE.from + 1 to the end of autumn.
  const gathering = (c) => (c.season === 1 && c.sday >= FORAGE.from) || c.season === 2;
  // ---- the day's water, which grows with the household (VB-1586; design.md, Water by the site, The fetch grows with the household) ----
  // @state household.waterFor: absent until the household's first load is brought (its first day counts as fetched, for all), then
  //   the people the loads of day `waterDay` cover: WATER.hand a trip by hand, WATER.child a child's, WATER.cart a cart's barrel. The
  //   day's water does not keep: the first load of a day begins the count anew (sim/chores, the water's deliver; sim/hunger reads it)
  // The people today's loads cover.
  const waterIn = (hh, day) => (hh.waterDay !== day ? 0 : (hh.waterFor ?? Infinity));
  // The household's people at home, those its water is for: sim/water's atHome, which the panel and the well's test read too.
  // What a trip under way brings: its hand's load (`cover`, set as it sets out).
  const coverOf = (j) => j.cover ?? WATER.hand;
  // The head's choice (Above the first): for `need` people still without water a cart of `kind` is the cheaper in hours than the trips
  // by hand its barrel saves; never for those one trip by hand covers. The reckoning is sim/water's (dayFetch, VB-1604): the trip is
  // the cart's when the day's fetch of those people would begin with one.
  const cartPays = (walk, need, kind) => need > WATER.hand && Water.dayFetch(walk, need, kind).cart > 0;
  // The cart a barrel would go on now: a free hand cart, the faster with the same barrel, else the ox cart if its team is free
  // (design.md, Carts, Taking a cart; `team`: as sim/work's teamFree says when a hand sets out, and as the head reckons before: it
  // keeps a team and its ox cart is in); null with none. A cart goes where a walker does, until carts mind the ground (VB-810).
  const barrelCart = (st, hh, team = hasTeam(st, hh)) =>
    hh.carts.find((c) => c.kind === 'hand' && !Carts.out(st, c)) ||
    (team && hh.carts.find((c) => c.kind === 'ox' && !Carts.out(st, c))) ||
    null;
  // The household's water trips: its jobs of the kind (a household's jobs, a few tens at most).
  const waterTrips = (st, hh) => {
    const out = [],
      mine = st.jobsBy.get(`household:${hh.id}`);
    if (mine) for (const j of mine) if (j.kind === 'water') out.push(j);
    return out;
  };
  const KINDS = {
    // Wood in two steps (VB-1625; Kim, 24 Nov 2026: "Fell timber at the forest tile, and then cut firewood in the home"): a tree felled
    // in the woods and its load carried home as timber (wood), and the timber cut into firewood at the house (firewood). The hours of a
    // load are the old trip's, WOOD_HOURS.fell + WOOD_HOURS.cut; the urgency and the vital rule of the old trip are the step's that mends
    // the fire: a cold house cuts the timber it holds first, else fells.
    wood: {
      verb: 'Felling timber',
      go: 'Heading to the woods',
      back: 'Carrying timber home',
      name: 'Fell timber',
      at: ['woods'],
      needs: [],
      gives: ['timber'],
      label: 'Timber',
      anim: 'chop',
      hours: WOOD_HOURS.fell,
      hands: 1,
      type: 'wood',
      carry: 'logs',
      to: 'woodpile',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      // lived by while the house is cold or the pile will not feed tonight's fire (VB-1547) and no timber is home to cut: a load felled is
      // carried home after work
      vital: (st, j) => {
        const hh = st.households[j.farm.household];
        return !timberOf(hh) && fireShort(st, hh);
      },
      // 3 in a cold house with no timber to cut (VB-327: above cooking's 2.2); 2.2 when the pile and the timber are nearly out; else
      // their shortfall of the goal, and more in autumn
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        if (hh.cold > 0 && !timberOf(hh)) return U.woodColdUrgency;
        return pileUrgency(st, hh, c, U, fuelFree(st, hh) + timberOf(hh));
      },
      // a tree felled on the job's tile (drawn from the village's wood when the job was posted, VB-326, or the one the plan chose), or on one
      // drawn now if it was cut bare; the timber home (sim/playerplan counts a planned task's loads by the event `timberHome`). A load
      // is one tree of the tile's count felled and ECON.woodPerTrip units of timber at home; a trip brings one load on the back, or the
      // loads cut and stacked on a cart (sim/carts) (VB-1634).
      deliver: (st, j, hh, f, a) => {
        const loads = Carts.loads(a);
        for (let k = loads; k > 0; k--) {
          Stores.put(st, hh, 'timber', st.ECON.woodPerTrip, 'felling');
          fellTree(st, st.w.trees[j.site] > 0 ? j.site : drawWood(st, st.villages[j.farm.village]));
        }
        emit(st, 'timberHome', { household: hh.id, tile: j.site, loads });
      },
      // another load cut onto the cart: on a trip the plan sent, while its task has loads left beyond those on the cart (VB-1634: before,
      // the pile's goal, so a cart brought more than the task's loads); else while the pile with the timber home is below the goal
      stack: (st, j, hh, c, load) =>
        j.chosen
          ? plannedLeft(st, j.site) > Carts.loads({ load })
          : fuelFree(st, hh) + timberOf(hh) + st.ECON.woodPerTrip * Carts.loads({ load }) <
            woodTargets(st, hh).wood[c.season],
      // a tile drawn from the village's wood, but for a trip the plan sent to a tile of its choosing (`chosen`)
      draw: (st, j) => (j.chosen ? -1 : drawWood(st, st.villages[j.farm.village])),
      // while the village has a wood and the pile's free wood (VB-123) with the timber home is below the plan's goal for the season; a
      // second job below its woodSecond. For the played pawn's household, a trip to the tile of each `fell` task of its plan with trips
      // left and trees standing (sim/playerplan), whatever the pile.
      available: (st, hh, f, c, post) => {
        const wood = st.villages[f.village].wood,
          T = woodTargets(st, hh),
          have = fuelFree(st, hh) + timberOf(hh);
        if (wood.length && have < T.wood[c.season]) {
          post(`wood:h${hh.id}`, wood[0], { farm: f });
          if (have < T.woodSecond) post(`wood:h${hh.id}b`, wood[0], { farm: f });
        }
        const pl = st.player;
        if (pl && pl.plan && st.pawns[pl.pawn].household === hh.id)
          for (const t of pl.plan.tasks)
            if (t.kind === 'fell' && t.key === undefined && (t.got || 0) < (t.n || 1) && st.w.trees[t.fell] > 0)
              post(`wood:h${hh.id}:t${t.fell}`, t.fell, { farm: f, chosen: true });
      },
    },
    water: {
      verb: 'Drawing water',
      go: 'Going for water',
      back: 'Carrying water home',
      name: 'Fetch water',
      at: ['water'],
      needs: [],
      gives: ['water'],
      label: 'Water',
      anim: 'draw',
      hours: Water.WATER.draw, // the drawing; the walk out and the walk home laden are walked (VB-1582)
      hands: 1,
      type: 'household',
      carry: 'buckets',
      to: 'door',
      window: { from: WORK[0] - 1 },
      vital: true, // a dry day costs the meal's cooking and health (VB-331): a fetch begun is finished after work (VB-1547)
      evening: true, // and one not yet begun may be, until MATCH.day.evening (Kim, 23 November: water after dark)
      first: true, // water first: it heads the list of the member best fit for it at the allotment (VB-1582)
      // the hours of the trip besides the drawing, which the head counts in its hand's day: the walk out and home laden
      trip: (st, j) => {
        const s = j.farm.water;
        if (!s || s.tile !== j.site) return 0;
        return j.cart ? (2 * s.walk) / TRAVEL.pace[j.cart] : Water.dayFetch(s.walk, 1).hours - WATER.draw;
      },
      // As its hand sets out (sim/agents start): what the trip will cover (j.cover: a child under WATER.childUnder carries one
      // bucket), and, where more people are still without water than a trip by hand covers, the cart: the head takes the household's
      // free cart when its barrel is the cheaper in hours (j.cart, its kind; the filling, j.hours), and the hand goes out and comes
      // home at the cart's pace, the cart out until it is home and worn as by any trip (sim/carts). With no cart free where one
      // would be the cheaper, a load went on the back while more waited: a miss the head counts. Returns the load it sets out with.
      setOut: (st, a, j, teamFree) => {
        const p = st.pawns[a.id],
          hh = st.households[j.owner.id],
          s = j.farm.water,
          young = age(st, p) < WATER.childUnder;
        delete j.cart;
        delete j.hours;
        j.cover = young ? WATER.child : WATER.hand;
        if (young || p.household !== hh.id || !s || s.tile !== j.site) return 0;
        let need = atHome(st, hh) - waterIn(hh, cal(st.t).day);
        for (const q of waterTrips(st, hh)) if (q !== j && q.claims.length) need -= coverOf(q);
        if (need <= WATER.hand) return 0;
        const c = barrelCart(st, hh, !!teamFree && teamFree(st, hh));
        if (!c || !cartPays(s.walk, need, c.kind)) {
          if (!c && cartPays(s.walk, need, 'hand')) Carts.missed(st, hh);
          return 0;
        }
        Carts.take(st, hh, a.id, c.kind === 'ox');
        j.cart = c.kind;
        j.hours = WATER.fill;
        j.cover = WATER.cart;
        return TRAVEL.hand; // the barrel: three back loads, as a hand cart carries
      },
      // by the curb of a well of the farm's own; by the sweep of a well on a green; else at the water's edge
      spot: (st, a, j) => {
        const w = st.w;
        return j.site === j.farm.house
          ? [w.hx[j.site] - 1, w.hy[j.site] + 4]
          : w.fresh[j.site] === FRESH.WELL
            ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8]
            : [w.hx[j.site] + a.ox * 0.2, w.hy[j.site] + 4];
      },
      // from the afternoon (14:00), the cook's hour, above cooking's (VB-331): the hand that would cook fetches the water first
      urgency: (st, j, c, U) =>
        c.hour >= AFTERNOON ? U.waterLate : c.hour < U.waterMorningHour ? U.waterMorning : U.water,
      // a load is in, and the day's water with the first, for the people it covers (VB-1586: the household cooks once the first load
      // is in); marsh water is poor, and costs those it covers some health that day (sim/hunger; VB-1582); who drew it drank at the
      // source (sim/thirst, VB-1585)
      deliver: (st, j, hh, f, a) => {
        const day = cal(st.t).day;
        // (a day counted as fetched with no load brought, the household's first, has water for all: the count stays absent)
        if (hh.waterDay !== day) hh.waterFor = coverOf(j);
        else if (hh.waterFor !== undefined) hh.waterFor += coverOf(j);
        hh.waterDay = day;
        if (j.poor) hh.marshDay = hh.waterDay;
        if (a) VB['sim/thirst'].drank(st, st.pawns[a.id]);
      },
      // once a day, from the hour before work until the evening's (VB-1547: the due-queue's last ask, at the end of work, leaves it
      // standing for the evening), at the farm's source (sim/water: the nearest source or well its household may draw at; found on the
      // farm's first morning); a farm with no source in reach posts none (VB-1582). The trips its people at home need (VB-1586),
      // each a job of its own: those under way stand; for whom they and the day's loads do not cover, a cart's trip where the
      // household's free cart is the cheaper, and trips by hand for the rest (the head's reckoning: who sets out decides, setOut).
      // Cost: a household that has its water is one comparison; else its members and its jobs, once an ask.
      available: (st, hh, f, c, post) => {
        if (c.hour < WORK[0] - 1 || c.hour >= EVENING || waterIn(hh, c.day) >= hh.members.length) return;
        const s = Water.sourceOf(st, f);
        if (s.tile < 0) return;
        const extra = s.cls === FRESH.MARSH ? { farm: f, poor: true } : { farm: f },
          open = [];
        let need = atHome(st, hh) - waterIn(hh, c.day);
        for (const j of waterTrips(st, hh)) {
          if (!j.claims.length) open.push(j);
          else {
            need -= coverOf(j);
            post(j.key, j.site, extra);
          }
        }
        let cart = need > WATER.hand ? barrelCart(st, hh) : null;
        for (let k = 0, i = 0; need > 0; k++) {
          if (cart && cartPays(s.walk, need, cart.kind)) need -= WATER.cart;
          else need -= WATER.hand;
          cart = null;
          if (k < open.length) {
            post(open[k].key, open[k].site, extra);
            continue;
          }
          let key;
          do key = `water:h${hh.id}:${c.day}${i++ ? `:${i}` : ''}`;
          while (st.jobs.has(key));
          post(key, s.tile, extra);
        }
      },
    },
    cook: {
      verb: 'Cooking at the hearth',
      go: 'Going home to cook',
      name: 'Cook',
      at: ['house'],
      needs: ['grain', 'water', 'firewood'],
      gives: ['meals'],
      label: 'Cook',
      anim: null,
      hours: 2,
      hands: 1,
      type: 'household',
      inside: true,
      window: { from: AFTERNOON },
      late: true, // the meal's deadline is today: unmanned, it calls its hand (sim/day)
      vital: true, // the day's meal: a pot under way is finished after the end of work (VB-119; Kim, 11 Nov; VB-1547)
      urgency: (st, j, c, U) => (c.hour >= U.cookEveningHour ? U.cookEvening : U.cook),
      // the meals still missing for the coming day, cooked in the pot: fresh food, dried fish in winter, grain, the seed it would eat (sim/pot)
      done: (st, j, hh, c) => {
        Pot.cookMeal(st, hh, dailyNeed(st, hh));
        hh.cookDay = j.day ?? c.day;
      },
      // from 14:00 to the end of work, while the household is short of meals and has grain or fresh food to cook (cookWanted)
      available: (st, hh, f, c, post) => {
        if (c.hour >= AFTERNOON && c.hour < WORK[1] && cookWanted(st, hh, c))
          post(`cook:h${hh.id}:${c.day}`, f.house, { farm: f, day: c.day });
      },
    },
    brew: {
      verb: 'Brewing ale',
      go: 'Going home to brew',
      name: 'Brew ale',
      at: ['house'],
      needs: ['grain', 'firewood'],
      gives: ['ale'],
      label: 'Brewing',
      anim: null,
      hours: BREW.hours,
      hands: 1,
      type: 'household',
      inside: true,
      urgency: (st, j, c, U) => U.brew,
      // a barrel from the grain, if it is still surplus when the work is done
      done: (st, j, hh) => {
        if (Stores.grainOf(hh) - floorOf(st, hh) >= BREW.grain) Stores.brew(st, hh);
      },
      // in autumn and winter, once the harvest is in, while ale is wanted (brewWanted)
      available: (st, hh, f, c, post) => {
        if ((c.season === 2 || c.season === 3) && brewWanted(st, hh))
          post(`brew:h${hh.id}:${c.day}`, f.house, { farm: f });
      },
    },
    gather: {
      verb: 'Gathering berries, mushrooms and nuts',
      go: 'Going to the woods to gather',
      back: 'Carrying the baskets home',
      name: 'Gather wild food',
      at: ['woods'],
      needs: [],
      gives: ['wild food'],
      label: 'Gathering',
      anim: 'forage',
      hours: 3,
      hands: 1,
      type: 'foraging',
      carry: 'basket',
      to: 'door',
      urgency: (st, j, c, U) => spareUrgency(st, j, U),
      // the baskets are fresh food, cooked in the pot or eaten as they are on a day without meals (sim/pot, VB-119)
      deliver: (st, j, hh) => {
        Pot.putFresh(st, hh, 'gathered', gather(st, j.site), 'gathering');
      },
      // in the gathering season, at the house's gathering ground (sim/forage): one trip, two while spare food covers fewer than FISH.secondDays
      available: (st, hh, f, c, post) => {
        if (!gathering(c)) return;
        const t = forageGround(st, f.house);
        if (t < 0) return;
        // the key names the tile, so a ground picked bare is left for the next one at the following review
        post(`gather:h${hh.id}:${t}`, t, { farm: f });
        if (spareDays(st, hh) < FISH.secondDays) post(`gather:h${hh.id}:${t}b`, t, { farm: f });
      },
    },
    firewood: {
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
      // as the trip to the woods was before the split: lived by while the house is cold or the pile will not feed tonight's fire; and
      // then begun after work too, until MATCH.day.evening (sim/day eveningCall), as the load of the old trip came home with its wood
      vital: (st, j) => fireShort(st, st.households[j.farm.household]),
      evening: (st, j) => fireShort(st, st.households[j.farm.household]),
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        return hh.cold > 0 ? U.woodColdUrgency : pileUrgency(st, hh, c, U, fuelFree(st, hh));
      },
      // a load of the timber home (ECON.woodPerTrip, or what is left) cut and stacked on the woodpile
      done: (st, j, hh) => {
        const n = Stores.take(st, hh, 'timber', Math.min(timberOf(hh), st.ECON.woodPerTrip), 'cutting');
        if (n > 0) Stores.put(st, hh, 'wood', n, 'cutting');
      },
      // at the house, while timber is home and the house is cold or the pile's free wood is below the season's goal; a second job below
      // its woodSecond with more than a load home
      available: (st, hh, f, c, post) => {
        const timber = timberOf(hh);
        if (!timber) return;
        const T = woodTargets(st, hh),
          free = fuelFree(st, hh);
        if (hh.cold > 0 || free < T.wood[c.season]) {
          post(`firewood:h${hh.id}`, f.house, { farm: f });
          if (free < T.woodSecond && timber > st.ECON.woodPerTrip) post(`firewood:h${hh.id}b`, f.house, { farm: f });
        }
      },
    },
  };
  return { KINDS, WOOD_HOURS, fuelFree, timberOf, cookWanted };
})();
