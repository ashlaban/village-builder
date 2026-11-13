// @sys sim/kinds: job kinds, one record each: hours, type of work, labels, where to stand, urgency, and what finishing and delivering do
VB['sim/kinds'] = (() => {
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { ROLES, WORK, FISH, FORAGE, BREW, CROPS, cal, HOUSE, houseCondition, PEAT } = VB['sim/rules'],
    Carts = VB['sim/carts'];
  const { log, atFarm } = VB['sim/records'];
  const { fellTree, drawWood } = VB['sim/forest'];
  const { dailyNeed, floorOf } = VB['sim/hunger'],
    { reserved } = Stores;
  const { finishClear, finishBreak, manureWanted, manureDone, hoed, sown, reaped, carried, binned, reclaimed, weeded } =
    VB['sim/fields'];
  const { finishMeadow, hayDay, hayWanted, meadowJobs, mowDone, hayIn } = VB['sim/meadows'];
  const { slaughterDone, saltDone, milkDone, fodderDone, byreJobs } = VB['sim/byre'];
  const { plotJobs } = VB['sim/expansion'];
  const { renewClaim } = VB['sim/claims'];
  const { workClaim, restored, claimJobs } = VB['sim/farmclaims'];
  const Building = VB['sim/building'],
    Pot = VB['sim/pot'],
    Green = VB['sim/green'],
    Workdays = VB['sim/workdays'],
    Commons = VB['sim/commons'];
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
  //   worked(st, j, dt, a): what each step of work by pawn a does besides the progress; project: true for a stage of a land project, whose job ends with
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
  //   (VB-251; sim/agents; herd the first, VB-136); held(st, j, a, c): what taking it up does; worked(st, j, dt), each step worked; minAge.
  //   late: a job of the kind under way, its worker walking there or at work, is finished after the end of work (VB-119: the cook).
  //   together: worked by all together (VB-120: a work day): a bid does not fall for the hands already at the job (MATCH.join, sim/jobs).
  // The woodpile's goal this season, and the level under which a second hand cuts: the household's standing plan's targets (sim/plans).
  const woodTargets = (st, hh) => st.plans.households.get(hh.id).targets;
  // The fuel pile in wood loads: the woodpile less what a project plan holds back, and the peat held at PEAT.worth (VB-367).
  const fuelFree = (st, hh) => hh.wood - reserved(st, hh, 'wood') + PEAT.worth * (hh.peat || 0);
  const rowAngle = (j) => (j.farm ? j.farm.rowAngle : 0);
  // Several hands on one field start on different rows: the nth worker on row -12 + 6n, five rows across the tile.
  const firstRow = (j, a) => -12 + 6 * (Math.max(0, j.claims.indexOf(a.id)) % 5);
  // The start of the pawn's first row on a field tile.
  function onField(st, a, j) {
    const w = st.w,
      th = rowAngle(j),
      row = firstRow(j, a);
    return [
      w.hx[j.site] - Math.cos(th) * 13 - Math.sin(th) * row,
      w.hy[j.site] - Math.sin(th) * 13 + Math.cos(th) * row,
    ];
  }
  // The job is still the open step of its household's project plan (not given up or contested away meanwhile; sim/projects, sim/stakes).
  const onProject = (st, j) => {
    const s = Projects.openOf(st, 'household', j.owner.id);
    return !!s && s.place === j.site && s.kind === j.kind;
  };
  // Work on a land project renews the household's stake on its tile (sim/stakes).
  const workStake = (st, j) => {
    renewClaim(st, j.site, j.owner);
  };
  // By the byre door, left of the cottage (the page draws the byre there).
  const byreSpot = (st, a, j) => [st.w.hx[j.farm.house] - 20 + a.ox * 0.3, st.w.hy[j.farm.house] + 5 + a.oy * 0.2];
  const RECLAIM = { fallow: 10, scrub: 20 }; // hours to clear a field gone to grass or to scrub (Kim, 30 Oct)
  // The sowing window of a field's crop, when it is hoed and sown (the row's `sow`: [season, first day, last day]).
  const sowing = (fd, c) => {
    const w = CROPS[fd.crop].sow;
    return c.season === w[0] && c.sday >= w[1] && c.sday <= w[2];
  };
  // The hours of a stage are the crop's row (CROPS, sim/rules): the kinds hold barley's, and a field's job carries its crop's where they
  // differ (rye's weeding, fallow's tilling; VB-348), so a barley field's job is as it was.
  const HOURS = CROPS.barley.hours;
  const fieldKey = (f, fd) => `f${f.id}.${fd.id}`;
  const fieldJob = (f, fd, k) => {
    const h = CROPS[fd.crop].hours[k];
    return h === undefined || h === HOURS[k] ? { field: fd, farm: f } : { field: fd, farm: f, hours: h };
  };
  // Why household hh cannot sow field fd today, or null (VB-348): the course is not sown, the window is shut, the field is not hoed, or the
  // household holds less than a field's seed of the crop, which is taken from its own grain (seed rye is rye).
  function sowWhy(hh, fd, c) {
    const C = CROPS[fd.crop];
    if (!(C.seed > 0)) return `a field in ${fd.crop} is not sown`;
    if (!sowing(fd, c)) return `${fd.crop} is not sown in this season`;
    if (fd.stage !== 'plowed') return 'the field is not hoed';
    const has = Stores.grainOf(hh, fd.crop);
    return has < C.seed
      ? `the household holds ${Math.floor(has)} of the ${C.seed} rations of ${fd.crop} a field's seed takes`
      : null;
  }
  // The household has fewer meals than the coming meal needs, grain, fresh food (VB-119) or seed it would eat (VB-388) to cook it from, and
  // wood in the pile (VB-327: an empty pile cannot cook; the pot burns no wood of its own, the day's use is the hearth's).
  const cookWanted = (st, hh, c) => hh.cookDay !== c.day && hh.wood > 0 && Pot.cookable(st, hh, dailyNeed(st, hh));
  // Ale is wanted (VB-305) while the household holds fewer than BREW.stock barrels and has the grain for one above its floor (which holds the
  // seed reserve): a household never brews grain it needs.
  const brewWanted = (st, hh) =>
    Stores.aleOf(st, hh) < BREW.stock && Stores.grainOf(hh) - floorOf(st, hh) >= BREW.grain;
  // ---- the rules shared by the kinds a module posts together; each names its jobs' kinds ----
  // A meadow is raked in early spring and mown in the haymaking window while the household wants hay; its hay is carried in once dry
  // (sim/meadows). Asked at the farm: whether hay is wanted is the household's, once for all its meadows.
  function meadowWork(st, hh, f, c, post) {
    // whether hay is wanted, asked once, and only when a meadow could be raked or mown now (VB-227)
    let hayW = null;
    const want = () => (hayW === null ? (hayW = hayWanted(st, f, hh)) : hayW);
    for (const m of f.meadows)
      for (const [key, kind] of meadowJobs(f, m, c, want)) post(key, m.tile, { meadow: m, farm: f }, kind);
  }
  // The village's common fields (VB-100): their kinds, as at a farm's fields, while its meeting chose the routine.
  function commonWork(st, v, at, c, post) {
    if (st.plans.villages.get(v.id).routines.includes('commons')) Commons.work(st, v, c, post, ASK.fieldAt);
  }
  // The byre's work at the cottage, for a household with herds or meat in its larder: fodder, slaughter, salting, milking (sim/byre).
  function byreWork(st, hh, f, c, post) {
    if (hh.herds.length || hh.larder.length)
      for (const [key, kind, extra] of byreJobs(st, hh, c)) post(key, f.house, { farm: f, ...extra }, kind);
  }
  // The open step of the household's project plan (a new field's clear and break, a meadow; sim/projects): made once the one before is done.
  const landProject = (st, hh, f, c, post) => {
    const s = Projects.openOf(st, 'household', hh.id); // not while it waits for timber (VB-300)
    if (s && Projects.supplied(s)) post(`${s.kind}:f${f.id}`, s.place, { farm: f, hours: s.hours }, s.kind);
  };
  // Asked once for the island, not per village: the open step of each tile of every active plot, then each building plot's cottage stage,
  // owned by the plot's village (sim/expansion).
  function plotWork(st, holder, at, c, post) {
    for (const [key, kind, site, extra] of plotJobs(st)) post(key, site, extra, kind, extra.plot.holder);
  }
  // Asked once for the island: empty farms being restored, each by its claimant's household while the claim holds (sim/farmclaims).
  function claimWork(st, holder, at, c, post) {
    for (const [key, kind, owner, site, extra] of claimJobs(st)) post(key, site, extra, kind, owner);
  }
  // The household's spare food in days of its need: grain above the seed reserve, cooked meals and fresh food (sim/pot, VB-119).
  const spareDays = (st, hh) => {
    const need = dailyNeed(st, hh);
    return need > 0 ? Pot.spareFood(st, hh) / need : Infinity;
  };
  // Fishing: from spring day FISH.from + 1 to the end of autumn; the water is ice in winter.
  const fishing = (c) => (c.season === 0 && c.sday >= FISH.from) || c.season === 1 || c.season === 2;
  // Fishing's and gathering's urgency: fishCalm while spare food covers fishCalmDays of need or more, rising in a line to fishLean at none.
  const spareUrgency = (st, j, U) => {
    const d = spareDays(st, st.households[j.farm.household]);
    return d >= U.fishCalmDays ? U.fishCalm : U.fishLean - ((U.fishLean - U.fishCalm) * d) / U.fishCalmDays;
  };
  // Gathering: from summer day FORAGE.from + 1 to the end of autumn.
  const gathering = (c) => (c.season === 1 && c.sday >= FORAGE.from) || c.season === 2;
  // Hoeing and sowing grow more urgent as the sowing window runs out.
  const inWindow = (st, j, c, U) => U.field + c.sday / U.fieldPerDay;
  const KINDS = {
    plow: {
      verb: 'Hoeing a field',
      go: 'Going to hoe a field',
      name: 'Hoe a field',
      label: 'Hoeing',
      anim: 'hoe',
      hours: HOURS.plow,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      urgency: inWindow,
      done: (st, j) => hoed(j.field),
      // a field in stubble, in the sowing window (a fallow field: in its tilling window, once a year; VB-348)
      stages: ['stubble'],
      available: (st, hh, fd, c, post, f) => {
        if (sowing(fd, c) && fd.stage === 'stubble' && !(CROPS[fd.crop].fallow && fd.rest === 1))
          post('plow:' + fieldKey(f, fd), fd.tile, fieldJob(f, fd, 'plow'));
      },
    },
    sow: {
      verb: 'Sowing',
      go: 'Going to sow',
      name: 'Sow a field',
      label: 'Sowing',
      anim: 'sow',
      hours: HOURS.sow,
      hands: Infinity,
      type: 'tending',
      field: true,
      pace: 9,
      spot: onField,
      urgency: inWindow,
      done: (st, j, hh, c) => {
        const from = j.common ? st.villages[j.village] : hh; // a common field's seed is the village store's (VB-100)
        if (Stores.grainOf(from, j.field.crop) < CROPS[j.field.crop].seed) return; // the seed eaten since it was posted
        Stores.take(st, from, Stores.grainGood(j.field.crop), CROPS[j.field.crop].seed, 'seed');
        sown(j.field, c);
      },
      // a hoed field, in the sowing window, while the household has the seed for it (sowWhy)
      stages: ['plowed'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'plowed' && sowWhy(hh, fd, c) === null)
          post('sow:' + fieldKey(f, fd), fd.tile, fieldJob(f, fd, 'sow'));
      },
    },
    reap: {
      verb: 'Reaping',
      go: 'Going to reap',
      name: 'Reap a field',
      label: 'Reaping',
      anim: 'reap',
      hours: HOURS.reap,
      hands: Infinity,
      type: 'harvest',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => U.reap + (c.season === 2 ? c.sday / U.reapFrostPerDay : 0),
      done: (st, j, hh, c) => reaped(st, j.field, c),
      // a ripe field
      stages: ['ripe'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'ripe') post('reap:' + fieldKey(f, fd), fd.tile, fieldJob(f, fd, 'reap'));
      },
    },
    haul: {
      verb: 'Bringing in the sheaves',
      go: 'Going for the sheaves',
      back: 'Carrying sheaves to the barn',
      name: 'Bring in sheaves',
      label: 'Hauling sheaves',
      anim: 'gather',
      hours: 0.7,
      hands: Infinity,
      type: 'harvest',
      carry: 'sheaf',
      to: 'barn',
      window: { from: WORK[0] - 1 }, // dry by the morning
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6],
      urgency: (st, j, c, U) => U.haul,
      load: (st, a, j, cap) => (a.load = carried(j.field, cap)),
      again: (j) => j.field.stage === 'stooks',
      deliver: (st, j, hh, f, a) => {
        if (j.common) return Commons.brought(st, j, a); // a common field's, into the village store (VB-100)
        binned(j.field, Stores.sheaf(st, hh, a.load, j.field.bin ?? -1, j.field.crop));
        if (
          f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks') &&
          !hh.members.some((id) => id !== a.id && st.agents[id].load > 0 && st.agents[id].phase === 'back')
        )
          log(st, `${f.name} has brought in its harvest.`, { kind: 'harvest', ...atFarm(f) });
      },
      stages: ['stooks'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'stooks' && c.day >= fd.reaped + st.ECON.dryDays)
          post('haul:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f });
      },
    },
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
      urgency: (st, j, c, U) => (c.hour < U.waterMorningHour ? U.waterMorning : U.water),
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
    weed: {
      verb: 'Weeding a field',
      go: 'Going to weed a field',
      name: 'Weed a field',
      label: 'Weed',
      anim: 'gather',
      hours: HOURS.weed,
      hands: Infinity,
      type: 'tending',
      field: true,
      spot: onField,
      done: (st, j) => weeded(j.field),
      // a growing field whose weeding is open (sim/fields)
      stages: ['growing'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'growing' && fd.weedOpen) post('weed:' + fieldKey(f, fd), fd.tile, fieldJob(f, fd, 'weed'));
      },
    },
    thresh: {
      verb: 'Threshing in the barn',
      go: 'Going to the barn to thresh',
      name: 'Thresh the grain',
      label: 'Threshing',
      anim: null,
      hours: HOURS.thresh,
      hands: Infinity,
      type: 'threshing',
      inside: true,
      window: { from: WORK[0] - 1 },
      done: (st, j, hh) => {
        Stores.thresh(st, hh);
      },
      // while the barn holds unthreshed sheaves
      available: (st, hh, f, c, post) => {
        if (hh.unthreshed.length) post(`thresh:h${hh.id}`, f.house, { farm: f });
      },
    },
    clear: {
      verb: 'Clearing scrub and stones',
      go: 'Going to clear land',
      name: 'Clear a new field',
      label: 'Clear',
      anim: 'hoe',
      hours: 10,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      project: true,
      worked: workStake,
      done: (st, j, hh) => (j.common ? Commons.cleared(st, j, hh) : onProject(st, j) && finishClear(st, j.farm, hh)),
      available: landProject, // also a plot's step (plotWork)
    },
    break: {
      verb: 'Breaking new ground',
      go: 'Going to break new ground',
      name: 'Break new ground',
      label: 'Break',
      anim: 'hoe',
      hours: 30,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      project: true,
      worked: workStake,
      done: (st, j) => (j.common ? Commons.brokenUp(st, j) : onProject(st, j) && finishBreak(st, j.farm)),
      available: landProject, // also a plot's step (plotWork)
    },
    meadow: {
      verb: 'Clearing a hay meadow',
      go: 'Going to clear a meadow',
      name: 'Clear a hay meadow',
      label: 'Meadow',
      anim: 'hoe',
      hours: 4,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      project: true,
      worked: workStake,
      done: (st, j, hh) => onProject(st, j) && finishMeadow(st, j.farm, hh),
      available: landProject,
    },
    reclaim: {
      verb: 'Clearing an overgrown field',
      go: 'Going to clear an overgrown field',
      name: 'Clear an overgrown field',
      label: 'Reclaim',
      anim: 'hoe',
      hours: 10,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      done: (st, j) => reclaimed(st, j.field),
      // a field gone to grass or scrub while the farm stood empty is cleared again (VB-033)
      stages: ['fallow', 'scrub'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'fallow' || fd.stage === 'scrub')
          post('reclaim:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f, hours: RECLAIM[fd.stage] });
      },
    },
    restore: {
      // an empty farm's house mended by its claimant (sim/farmclaims); its hours by the condition when claimed
      verb: 'Mending an empty farm',
      go: 'Going to mend an empty farm',
      name: 'Mend an empty farm',
      label: 'Mending a farm',
      anim: 'mallet',
      hours: 20,
      hands: Infinity,
      type: 'wood',
      project: true,
      worked: workClaim,
      done: restored,
      available: claimWork,
    },
    rake: {
      verb: 'Raking the meadow clean',
      go: 'Going to rake a meadow',
      name: 'Rake a meadow',
      label: 'Raking',
      anim: 'gather',
      hours: 2,
      hands: Infinity,
      type: 'harvest',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => U.rake,
      done: (st, j) => {
        j.meadow.raked = true;
      },
      available: meadowWork,
    },
    mow: {
      verb: 'Mowing hay',
      go: 'Going to mow a meadow',
      name: 'Mow a meadow',
      label: 'Mowing',
      anim: 'mow',
      hours: 16,
      hands: Infinity,
      type: 'harvest',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => U.mow + Math.max(0, hayDay(c)) / U.mowPerDay,
      done: (st, j, hh, c) => mowDone(st, j.meadow, c),
      available: meadowWork,
    },
    hay: {
      verb: 'Gathering the hay',
      go: 'Going for the hay',
      back: 'Carrying hay to the barn',
      name: 'Bring in hay',
      label: 'Hauling hay',
      anim: 'gather',
      hours: 1.5,
      hands: Infinity,
      type: 'harvest',
      carry: 'hay',
      to: 'barn',
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6],
      urgency: (st, j, c, U) => U.haul,
      ...Carts.HAY,
      deliver: (st, j, hh, f, a) => hayIn(st, j.meadow, hh, f, a),
      available: meadowWork, // by the load (sim/carts)
    },
    fodder: {
      verb: 'Feeding and mucking out in the byre',
      go: 'Going to the byre',
      name: 'Fodder the animals',
      label: 'Byre',
      anim: 'gather',
      hours: 1,
      hands: 1,
      type: 'husbandry',
      spot: byreSpot,
      window: { from: WORK[0] - 1 },
      urgency: (st, j, c, U) => U.fodder,
      done: (st, j, hh, c) => fodderDone(st, hh, c),
      available: byreWork,
    },
    manure: {
      verb: 'Spreading manure on the field',
      go: 'Carting manure to the field',
      name: 'Cart manure',
      label: 'Manure',
      anim: 'gather',
      hours: 1,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => U.manure,
      carted: true, // faster with a cart (sim/carts)
      done: (st, j, hh) => manureDone(st, j.field, hh, j.hours),
      // in spring, while the heap holds a load: the farm's poorest field not yet sown, for the loads it takes (manureWanted, VB-137)
      available: (st, hh, f, c, post) => {
        const dung = manureWanted(f, hh, c);
        if (dung) post(`manure:f${f.id}.${dung[0].id}`, dung[0].tile, { field: dung[0], farm: f, hours: dung[1] });
      },
    },
    milk: {
      verb: 'Milking the cows',
      go: 'Going to milk the cows',
      name: 'Milk the cows',
      label: 'Milking',
      anim: 'milk',
      hours: 0.5,
      hands: 1,
      type: 'husbandry',
      spot: byreSpot,
      window: { from: WORK[0] },
      urgency: (st, j, c, U) => (c.hour < U.milkLateHour ? U.milk : U.milkLate),
      done: (st, j, hh, c) => milkDone(st, hh, c),
      available: byreWork,
    },
    slaughter: {
      verb: 'Slaughtering',
      go: 'Going to slaughter',
      name: 'Slaughter an animal',
      label: 'Slaughter',
      anim: 'mallet',
      hours: 3,
      hands: 2,
      type: 'husbandry',
      spot: byreSpot,
      urgency: (st, j, c, U) => (j.entry.lean ? U.slaughterNow : U.slaughter),
      done: (st, j, hh) => slaughterDone(st, j.herd, j.entry, hh),
      available: byreWork,
    },
    salt: {
      verb: 'Salting meat',
      go: 'Going home to salt the meat',
      name: 'Salt the meat',
      label: 'Salting',
      anim: null,
      hours: 1,
      hands: 1,
      type: 'household',
      inside: true,
      urgency: (st, j, c, U) => U.salt,
      done: (st, j, hh) => saltDone(st, hh),
      available: byreWork,
    },
    fell: {
      verb: 'Felling trees',
      go: 'Going to fell trees',
      name: 'Fell trees',
      label: 'Fell',
      anim: 'chop',
      hours: 10,
      hands: Infinity,
      type: 'wood',
      available: plotWork,
    },
    grub: {
      verb: 'Grubbing out stumps',
      go: 'Going to grub out stumps',
      name: 'Grub out stumps',
      label: 'Grub',
      anim: 'hoe',
      hours: 6,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      available: plotWork,
    },
    ...Building.KINDS, // the cottage's stages and the timber its walls take (sim/building)
    ...Green.KINDS, // the village green and well (sim/green, VB-058)
    ...Workdays.KINDS, // the village's work days (sim/workdays, VB-120)
    mend: {
      verb: 'Mending the fence',
      go: 'Going to mend the fence',
      name: 'Mend the fence',
      label: 'Mending',
      anim: 'mallet',
      hours: 2.5,
      hands: 1,
      type: 'upkeep',
      spot: (st, a, j) => {
        const w = st.w,
          s = j.stretch;
        return [s.mx + (w.hx[j.site] - s.mx) * 0.25, s.my + (w.hy[j.site] - s.my) * 0.25 + 3];
      },
      urgency: (st, j, c, U) => (1 - j.stretch.cond) * U.mendPerCond,
      done: (st, j) => {
        j.stretch.cond = 1;
        j.stretch.dirty = true;
      },
      // a stretch worn below fenceMendBelow: of the farm's fence, the household's; asked at a village (no farm), of the village's own
      available: (st, holder, at, c, post, f) => {
        const E = st.ECON;
        if (f) {
          if (f.fence)
            for (const s of f.fence)
              if (s.cond < E.fenceMendBelow) post(`mend:f${f.id}.${s.id}`, s.tile, { stretch: s, farm: f });
          return;
        }
        for (const s of at.fence)
          if (s.cond < E.fenceMendBelow)
            post(`mend:v${at.id}.${s.id}`, s.tile, { stretch: s }, 'mend', { type: 'village', id: at.id });
      },
    },
    repair: {
      // the house's upkeep (VB-306): 4 work hours raise its condition 0.1, offered once it is under 0.8
      verb: 'Mending the house',
      go: 'Going to mend the house',
      name: 'Mend the house',
      label: 'House',
      anim: 'mallet',
      hours: HOUSE.hours,
      hands: 1,
      type: 'upkeep',
      urgency: (st, j, c, U) => U.repair,
      done: (st, j) => {
        const f = j.farm;
        f.condition = Math.min(1, houseCondition(st, f) + HOUSE.raise);
        f.condAt = st.t;
      },
      available: (st, hh, f, c, post) => {
        if (f.household === hh.id && !f.booth && houseCondition(st, f) < HOUSE.mendBelow)
          post(`repair:f${f.id}`, f.house, { farm: f });
      },
    },
    fish: {
      verb: 'Fishing',
      go: 'Going fishing',
      back: 'Carrying the catch home',
      name: 'Go fishing',
      label: 'Fishing',
      anim: 'fish',
      hours: 3,
      hands: 1,
      type: 'foraging',
      carry: 'fish',
      to: 'door',
      // at the water's edge: the edge of the lake or sea tile, or by the brook that runs through the middle of a river tile
      spot: (st, a, j) => {
        const w = st.w,
          x = w.hx[j.site],
          y = w.hy[j.site],
          k = w.water[j.water] ? 0.45 : 0.7;
        return [x + (w.hx[j.water] - x) * k + a.ox * 0.15, y + (w.hy[j.water] - y) * k + a.oy * 0.1];
      },
      // fishCalm while spare food covers fishCalmDays of need or more, rising in a line to fishLean at none
      urgency: (st, j, c, U) => spareUrgency(st, j, U),
      // the catch (twice the bank's from a boat, VB-300) is fresh food, cooked in the pot (sim/pot, VB-119); beyond it, to the rack (VB-388)
      deliver: (st, j, hh) => {
        Drying.potCatch(st, j, hh);
      },
      // in the fishing season, from its boat or the house's fishing ground (sim/drying): one trip, two while spare food is under FISH.secondDays
      available: (st, hh, f, c, post) => {
        if (!fishing(c) || Pot.fishCovered(st, hh, dailyNeed(st, hh))) return; // none while fresh fish covers 2 days (VB-388)
        const g = Drying.fishingPlace(st, hh, f);
        if (!g) return;
        // the key names the bank, so a ground fished out is left for the next one at the following review
        post(`fish:h${hh.id}:${g.shore}`, g.shore, { farm: f, water: g.water, boat: g.boat });
        if (spareDays(st, hh) < FISH.secondDays)
          post(`fish:h${hh.id}:${g.shore}b`, g.shore, { farm: f, water: g.water, boat: g.boat });
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
  KINDS.dig = VB['sim/dig'].KIND; // digging clay and bog iron (VB-359): its record is sim/dig's
  KINDS.herd = VB['sim/grazing'].KIND;
  KINDS.lead = VB['sim/exchange'].KIND;
  Object.assign(KINDS, VB['sim/quern'].KINDS); // grinding and hewing a quern (VB-009): their records are sim/quern's
  // hunting roe deer (VB-139): its record is sim/deer's, its urgency fishing's, by the household's spare food
  KINDS.hunt = { ...VB['sim/deer'].KIND, urgency: (st, j, c, U) => spareUrgency(st, j, U) };
  Object.assign(KINDS, Drying.KINDS, Carts.KINDS); // herding (VB-136); drying fish and the boat (VB-300): their modules'
  // A job is open while it has work left and fewer workers than hands; a carried job whose work is done waits for its carrier.
  const isOpen = (j) => j.claims.length < KINDS[j.kind].hands && j.done < (j.hours ?? KINDS[j.kind].hours);
  // Each role's rank of every kind: its exception for the kind, else its rank of the kind's type of work, else 0.
  for (const r of Object.values(ROLES))
    r.prio = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, r.except[k] ?? r.work[K.type] ?? 0]));
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
  for (const e of ASK.field) for (const g of KINDS[e[0]].stages) (ASK.fieldAt[g] ||= []).push(e);
  return { KINDS, ASK, cookWanted, rowAngle, firstRow, isOpen, sowWhy };
})();
