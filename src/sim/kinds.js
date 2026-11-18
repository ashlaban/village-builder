// @sys sim/kinds: job kinds, one record each: hours, type of work, labels, where to stand, urgency, and what finishing and delivering do
VB['sim/kinds'] = (() => {
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'],
    { target } = VB['sim/targets'];
  const { ROLES, WORK, FISH, FORAGE, BREW, CROPS, cal, HOUSE, houseCondition, PEAT } = VB['sim/rules'],
    Carts = VB['sim/carts'];
  const { log, atFarm } = VB['sim/records'];
  const { fellTree, drawWood } = VB['sim/forest'];
  const { scrubHours, SPREAD } = VB['sim/spread'];
  const { dailyNeed, floorOf, spareDays, spareUrgency } = VB['sim/hunger'],
    { reserved } = Stores;
  const Fieldwork = VB['sim/fieldwork'];
  const Meadows = VB['sim/meadows'],
    { meadowWork } = Meadows;
  const Byre = VB['sim/byre'],
    { byreWork } = Byre;
  const Expansion = VB['sim/expansion'],
    { plotWork } = Expansion;
  const { workStake } = VB['sim/claims'],
    { onProject, landProject } = Projects,
    { doneOf } = VB['sim/progress'];
  const Farmclaims = VB['sim/farmclaims'],
    { claimWork } = Farmclaims;
  const Building = VB['sim/building'],
    Pot = VB['sim/pot'],
    Green = VB['sim/green'],
    Workdays = VB['sim/workdays'],
    Commons = VB['sim/commons'],
    Lying = VB['sim/lying'];
  const { ground: forageGround, gather } = VB['sim/forage'],
    Drying = VB['sim/drying'];
  // A kind's fields:
  //   verb, go, back: what the pawn panel says while working, walking there and carrying home; name: the job in the settlers panel;
  //   label: the job in the line that says why a pawn is idle; anim: the page's work animation; hours: work hours to finish;
  //   hands: how many pawns may work one job at once (VB-102: field, land and threshing work takes the whole household);
  //   type: the type of work, which roles rank (ROLES in sim/rules); field: worked row by row across the tile, at `pace` map units an hour;
  //   inside: worked in the house; carry: what is carried home when the work is done, to the cottage door, the woodpile or the barn (`to`);
  //   spot(st, a, j): where on the site the pawn stands; urgency(st, j, c, U): the job's weight in a bid (U is MATCH.urgency; 1 without it);
  //   done(st, j, hh, c): what finishing the work does; deliver(st, j, hh, f, a): what arriving home with a load does;
  //   load(st, a, j, cap): a trip's load from the field; again(j): the job stays open for the next (haul, VB-335);
  //   draw(st, j): the site of a job of the kind, drawn when it is first posted, in place of the site its rule names (VB-326: firewood);
  //   worked(st, j, dt, a, from): what dt hours of work by pawn a do besides the progress, run as the task is reckoned (from: its hours done
  //   before; VB-472); project: true for a stage of a land project, whose job ends with
  //   the project (sim/jobs drops it, its hands freed, once it is no longer posted);
  //   available(st, holder, at, c, post, f): where the kind could be done now (VB-208); it calls post(key, site, extra) for each job it
  //   would post. holder is the household (or the village), at the field, farm or village asked about, f the household's farm. sim/jobs'
  //   refreshJobs asks the rules in the order of ASK, below. A rule shared by the kinds a module posts together names each job's kind,
  //   post(key, site, extra, kind), and the owner of a job not the household's, post(key, site, extra, kind, owner). A kind posted by two
  //   rules names its household's: clear and break, also a plot's steps, and the cottage's stages, also a plot's (plotWork).
  //   stages: a field kind's, the field stages at which it can be available; refreshJobs asks it only at a field in one of them.
  //   window: a time-bound kind's (VB-249), {from: the hour of the day its work can first fall due}: the due-queue (sim/plans) asks it for
  //   each household from that hour, and again each hour while it gives work, so it waits for no review of the plan.
  //   attention: `full` (the default), `partial` (left and returned to within the hour) or `background` (done at the side, at `rate` of
  //   the pawn's hours, only within `reach` steps of the task's site); a pawn holds one task, and besides one partial and one background
  //   (VB-251; sim/agents; herd the first, VB-136); held(st, j, a, c): what taking it up does; worked(st, j, dt, null, from), as it is reckoned; minAge.
  //   late: a job of the kind under way, its worker walking there or at work, is finished after the end of work (VB-119: the cook).
  //   together: worked by all together (VB-120: a work day): a bid does not fall for the hands already at the job (MATCH.join, sim/jobs).
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
  // ---- the rules shared by the kinds a module posts together; each names its jobs' kinds ----
  // The village's common fields (VB-100): their kinds, as at a farm's fields, while its meeting chose the routine.
  function commonWork(st, v, at, c, post) {
    if (st.plans.villages.get(v.id).routines.includes('commons')) Commons.work(st, v, c, post, ASK.fieldAt);
  }
  // Gathering: from summer day FORAGE.from + 1 to the end of autumn.
  const gathering = (c) => (c.season === 1 && c.sday >= FORAGE.from) || c.season === 2;
  // The field's kinds, and for a common field the three whose end is the village's (sim/commons).
  const F = Commons.common(Fieldwork.KINDS);
  const KINDS = {
    plow: F.plow,
    sow: F.sow,
    reap: F.reap,
    haul: F.haul,
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
      // from 14:00, the cook's hour, above cooking's (VB-331): the hand that would cook fetches the water first
      urgency: (st, j, c, U) =>
        c.hour >= U.waterLateHour ? U.waterLate : c.hour < U.waterMorningHour ? U.waterMorning : U.water,
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
      window: { from: 14 },
      late: true, // a pot under way is finished after the end of work (VB-119; Kim, 11 Nov)
      urgency: (st, j, c, U) => (c.hour >= U.cookEveningHour ? U.cookEvening : U.cook),
      // the meals still missing for the coming day, cooked in the pot: fresh food, dried fish in winter, grain, the seed it would eat (sim/pot)
      done: (st, j, hh, c) => {
        Pot.cookMeal(st, hh, dailyNeed(st, hh));
        hh.cookDay = j.day ?? c.day;
      },
      // from 14:00 to the end of work, while the household is short of meals and has grain or fresh food to cook (cookWanted)
      available: (st, hh, f, c, post) => {
        if (c.hour >= 14 && c.hour < WORK[1] && cookWanted(st, hh, c))
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
    weed: F.weed,
    thresh: F.thresh,
    clear: F.clear,
    break: F.break,
    meadow: Meadows.KINDS.meadow,
    reclaim: F.reclaim,
    restore: Farmclaims.KINDS.restore,
    rake: Meadows.KINDS.rake,
    mow: Meadows.KINDS.mow,
    hay: { ...Meadows.KINDS.hay, ...Carts.HAY }, // by the load: sim/carts imports sim/meadows, so the cart's part joins here
    fodder: Byre.KINDS.fodder,
    manure: F.manure,
    milk: Byre.KINDS.milk,
    slaughter: Byre.KINDS.slaughter,
    salt: Byre.KINDS.salt,
    fell: Expansion.KINDS.fell,
    grub: Expansion.KINDS.grub,
    ...Building.KINDS, // the cottage's stages and the timber its walls take (sim/building)
    ...Green.KINDS, // the village green and well (sim/green, VB-058)
    ...Workdays.KINDS, // the village's work days (sim/workdays, VB-120)
    mend: Building.UPKEEP.mend,
    repair: Building.UPKEEP.repair,
    fish: Drying.KINDS.fish,
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
  KINDS.dig = VB['sim/dig'].KIND; // digging clay and bog iron (VB-359): its record is sim/dig's
  KINDS.herd = VB['sim/grazing'].KIND;
  KINDS.lead = VB['sim/exchange'].KIND;
  Object.assign(KINDS, VB['sim/quern'].KINDS); // grinding and hewing a quern (VB-009): their records are sim/quern's
  KINDS.hunt = VB['sim/deer'].KIND; // hunting roe deer (VB-139): its record is sim/deer's
  Object.assign(KINDS, Drying.KINDS, Carts.KINDS); // herding (VB-136); drying fish and the boat (VB-300): their modules'
  Object.assign(KINDS, VB['sim/tar'].KINDS); // the tar pit, burning tar, tarring the house and the boat (VB-301): sim/tar's
  // a load left lying where its carrier fell is fetched by its owner (VB-611): a fetch kind for each kind that carries a load (sim/lying)
  for (const [k, K] of Object.entries(KINDS))
    if (K.carry && (K.load || K.stack)) KINDS[Lying.fetchKey(k)] = Lying.fetchKind(k, K);
  // A job is open while it has work left and fewer workers than hands; a carried job whose work is done waits for its carrier.
  const isOpen = (st, j) =>
    j.claims.length < KINDS[j.kind].hands &&
    doneOf(st, j, j.hours ?? KINDS[j.kind].hours) < (j.hours ?? KINDS[j.kind].hours);
  // Each role's rank of every kind: its exception for the kind (a fetch kind's: the kind it fetches for, VB-611), else its rank of the
  // kind's type of work, else 0.
  for (const r of Object.values(ROLES))
    r.prio = Object.fromEntries(
      Object.entries(KINDS).map(([k, K]) => [k, r.except[k] ?? r.except[K.fetch] ?? r.work[K.type] ?? 0]),
    );
  // Where refreshJobs (sim/jobs) asks, in this order: for each occupied farm in turn, at each of its fields (field), at the farm (farm),
  // and at the farm again after the household's plans for land (farmAfterPlans); then at each village (village), then once for the island
  // (island). An entry is [kind, rule]: a kind's own rule posts that kind; a shared rule (kind null) names its jobs' kinds. A job's id is its
  // posting order and matching visits jobs by id, so this order is part of the behaviour: two jobs new in the same hour keep their order.
  // fieldAt: the field's rules by the field's stage (each kind's `stages`), in the order of `field`; refreshJobs asks only those.
  const rule = (k) => (typeof k === 'string' ? [k, KINDS[k].available] : [null, k]);
  const ASK = {
    field: ['plow', 'sow', 'weed', 'reap', 'haul', 'reclaim'].map(rule),
    farm: [meadowWork, 'manure', byreWork, 'herd'].map(rule),
    farmAfterPlans: [
      landProject,
      Building.boothWork,
      'wood',
      'thresh',
      'water',
      'cook',
      'brew',
      'mend',
      'repair',
      'fish',
      'gather',
      Building.stoneWork,
    ].map(rule),
    // the green's rule posts each of its kinds (sim/green); the work day's both (sim/workdays); the common fields' (sim/commons, VB-100) the
    // open step of the one under way and the field kinds of each one's stage, while the meeting chose them
    village: ['mend', 'green', 'workfence', commonWork].map(rule),
    island: [plotWork, claimWork, Building.timberWork].map(rule),
    fieldAt: {},
  };
  // VB-359, VB-300, sim/carts (a boat or a cart is a project's step), VB-139 (hunting roe deer), VB-390 (a cow led home, sim/exchange)
  ASK.farmAfterPlans.push(rule('dig'), rule('rackfish'), rule('dry'), rule('mendcart'), rule('hunt'), rule('lead'));
  ASK.farmAfterPlans.push(rule('grind'), rule('hewQuern')); // the hand quern (VB-009, sim/quern)
  ASK.farmAfterPlans.push(rule('burntar'), rule('tarhouse'), rule('tarboat')); // tar (VB-301, sim/tar)
  (ASK.farmAfterPlans.push(rule(Lying.fetchWork)), ASK.village.push(rule(Lying.fetchWork))); // loads left lying (VB-611)
  for (const e of ASK.field) for (const g of KINDS[e[0]].stages) (ASK.fieldAt[g] ||= []).push(e);
  return { KINDS, ASK, cookWanted, isOpen, fuelFree };
})();
