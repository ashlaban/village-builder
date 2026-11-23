// @sys sim/chores: the job kinds of the household's daily work at the house: cutting firewood, fetching water, cooking, brewing and
// gathering wild food; what turns something of the world (a tree, the well, the woods' berries) into something in the house
// VB-418: these kinds have no domain module of their own. Each takes from one module (sim/forest, sim/forage: the world) and puts into
// another (sim/stores, sim/pot), so it lives above both, in the material layer: the beginning of target-v2's production (4.3). `brew`
// goes to the ale's module when sim/stores is split (VB-416). sim/kinds joins KINDS into the registry, where a kind's fields are described.
VB['sim/chores'] = (() => {
  const Stores = VB['sim/stores'],
    { reserved } = Stores,
    { target } = VB['sim/targets'];
  const { WORK, FISH, BREW, PEAT, cal } = VB['sim/rules'],
    { FORAGE } = VB['sim/forage'],
    Carts = VB['sim/carts'],
    AFTERNOON = VB['sim/roles'].MATCH.day.afternoon; // the afternoon's hour, when the head allots the day again (sim/jobs; VB-1543)
  const { fellTree, drawWood } = VB['sim/forest'];
  const { dailyNeed, floorOf, spareDays, spareUrgency } = VB['sim/hunger'],
    Pot = VB['sim/pot'];
  const { ground: forageGround, gather } = VB['sim/forage'];
  // The woodpile's goal this season, and the level under which a second hand cuts: the household's standing plan's targets (sim/plans).
  const woodTargets = (st, hh) => st.plans.households.get(hh.id).targets;
  // The fuel pile in wood loads: the woodpile less what a project plan holds back, and the peat held at PEAT.worth (VB-367).
  const fuelFree = (st, hh) => hh.wood - reserved(st, hh, 'wood') + PEAT.worth * (hh.peat || 0);
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
  const KINDS = {
    wood: {
      verb: 'Cutting firewood',
      go: 'Heading to the woods',
      back: 'Carrying firewood home',
      name: 'Cut firewood',
      label: 'Firewood',
      anim: 'chop',
      hours: 3,
      hands: 1,
      type: 'wood',
      carry: 'logs',
      to: 'woodpile',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      // 3 in a cold house (VB-327: above cooking's 2.2); 2.2 when the pile is nearly out; else its shortfall of the goal, and more in autumn
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        if (hh.cold > 0) return U.woodColdUrgency;
        const free = fuelFree(st, hh); // what a project plan holds back is not for the fire (VB-123)
        if (free < U.woodLow) return U.woodLowUrgency;
        const goal = woodTargets(st, hh).wood[c.season];
        return (goal - free) / goal + (c.season === 2 ? U.woodSummer : 0);
      },
      // a tree felled on the tile drawn from the village's wood when the job was posted (VB-326), or on one drawn now if it was cut bare
      deliver: (st, j, hh, f, a) => {
        // a tree felled, and its wood home, for each load cut and stacked on the cart (sim/carts); one on the back
        for (let k = Carts.loads(a); k > 0; k--) {
          Stores.put(st, hh, 'wood', st.ECON.woodPerTrip, 'firewood');
          fellTree(st, st.w.trees[j.site] > 0 ? j.site : drawWood(st, st.villages[j.farm.village]));
        }
      },
      stack: (st, j, hh, c, load) =>
        fuelFree(st, hh) + st.ECON.woodPerTrip * Carts.loads({ load }) < woodTargets(st, hh).wood[c.season],
      draw: (st, j) => drawWood(st, st.villages[j.farm.village]),
      // while the village has a wood and the pile's free wood (VB-123) is below the plan's goal for the season; a second job below its woodSecond
      available: (st, hh, f, c, post) => {
        const wood = st.villages[f.village].wood,
          T = woodTargets(st, hh),
          free = fuelFree(st, hh);
        if (wood.length && free < T.wood[c.season]) {
          post(`wood:h${hh.id}`, wood[0], { farm: f });
          if (free < T.woodSecond) post(`wood:h${hh.id}b`, wood[0], { farm: f });
        }
      },
    },
    water: {
      verb: 'Drawing water',
      go: 'Going for water',
      back: 'Carrying water home',
      name: 'Fetch water',
      label: 'Water',
      anim: 'draw',
      hours: 0.5,
      hands: 1,
      type: 'household',
      carry: 'buckets',
      to: 'door',
      window: { from: WORK[0] - 1 },
      spot: (st, a, j) => {
        const w = st.w;
        return st.villages[j.farm.village].well
          ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8]
          : [w.hx[j.site] - 1, w.hy[j.site] + 4];
      },
      // from the afternoon (14:00), the cook's hour, above cooking's (VB-331): the hand that would cook fetches the water first
      urgency: (st, j, c, U) =>
        c.hour >= AFTERNOON ? U.waterLate : c.hour < U.waterMorningHour ? U.waterMorning : U.water,
      deliver: (st, j, hh) => {
        hh.waterDay = cal(st.t).day;
      },
      // once a day, from the hour before work until its end, at the village well if it has one, else by the house
      available: (st, hh, f, c, post) => {
        const inWork = c.hour >= WORK[0] - 1 && c.hour < WORK[1];
        if (inWork && hh.waterDay !== c.day)
          post(`water:h${hh.id}:${c.day}`, st.villages[f.village].well ? st.villages[f.village].center : f.house, {
            farm: f,
          });
      },
    },
    cook: {
      verb: 'Cooking at the hearth',
      go: 'Going home to cook',
      name: 'Cook',
      label: 'Cook',
      anim: null,
      hours: 2,
      hands: 1,
      type: 'household',
      inside: true,
      window: { from: AFTERNOON },
      late: true, // a pot under way is finished after the end of work (VB-119; Kim, 11 Nov)
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
  };
  return { KINDS, fuelFree, cookWanted };
})();
