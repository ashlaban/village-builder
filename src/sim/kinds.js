// @sys sim/kinds: job kinds, one record each: hours, type of work, labels, where to stand, urgency, and what finishing and delivering do
VB['sim/kinds'] = (() => {
  const Stores = VB['sim/stores'];
  const { ROLES, WORK, FISH, FORAGE, BREW, cal, HOUSE, houseCondition } = VB['sim/rules'];
  const { log, atFarm } = VB['sim/records'];
  const { fellTree } = VB['sim/forest'];
  const { dailyNeed, floorOf } = VB['sim/hunger'], { reserved } = Stores;
  const { finishClear, finishBreak, manureWanted, manureDone, hoed, sown, reaped, hauled, reclaimed, weeded } = VB['sim/fields'];
  const { finishMeadow, hayDay, hayWanted, meadowJobs, mowDone, hayIn } = VB['sim/meadows'];
  const { slaughterDone, saltDone, milkDone, fodderDone, byreJobs } = VB['sim/byre'];
  const { finishBoothStage, plotJobs, boothJob } = VB['sim/expansion'];
  const { renewClaim } = VB['sim/claims'];
  const { workClaim, restored, claimJobs } = VB['sim/farmclaims'];
  const { ground, landCatch } = VB['sim/fish'], { ground: forageGround, gather } = VB['sim/forage'];
  // A kind's fields:
  //   verb, go, back: what the pawn panel says while working, walking there and carrying home; name: the job in the settlers panel;
  //   label: the job in the line that says why a pawn is idle; anim: the page's work animation; hours: work hours to finish;
  //   hands: how many pawns may work one job at once (VB-102: field, land and threshing work takes the whole household);
  //   type: the type of work, which roles rank (ROLES in sim/rules); field: worked row by row across the tile, at `pace` map units an hour;
  //   inside: worked in the house; carry: what is carried home when the work is done, to the cottage door, the woodpile or the barn (`to`);
  //   spot(st, a, j): where on the site the pawn stands; urgency(st, j, c, U): the job's weight in a bid (U is MATCH.urgency; 1 without it);
  //   done(st, j, hh, c): what finishing the work does; deliver(st, j, hh, f): what arriving home with the load does;
  //   worked(st, j): what each step of work does besides the progress; project: true for a stage of a land project, whose job ends with
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
  //   (VB-251; sim/agents). No kind of the game declares one yet.
  // The woodpile's goal this season, and the level under which a second hand cuts: the household's standing plan's targets (sim/plans).
  const woodTargets = (st, hh) => st.plans.households.get(hh.id).targets;
  const rowAngle = (j) => (j.farm ? j.farm.rowAngle : 0);
  // Several hands on one field start on different rows: the nth worker on row -12 + 6n, five rows across the tile.
  const firstRow = (j, a) => -12 + 6 * (Math.max(0, j.claims.indexOf(a.id)) % 5);
  // The start of the pawn's first row on a field tile.
  function onField(st, a, j) {
    const w = st.w, th = rowAngle(j), row = firstRow(j, a);
    return [w.hx[j.site] - Math.cos(th) * 13 - Math.sin(th) * row, w.hy[j.site] - Math.sin(th) * 13 + Math.cos(th) * row];
  }
  // The job's project still stands at this stage on its tile (it was not given up or contested away meanwhile, sim/stakes).
  const onProject = (j) => !!j.farm.project && j.farm.project.tile === j.site && j.farm.project.stage === j.kind;
  // Work on a land project renews the household's stake on its tile (sim/stakes).
  const workStake = (st, j) => { renewClaim(st, j.site, j.owner); };
  // By the byre door, left of the cottage (the page draws the byre there).
  const byreSpot = (st, a, j) => [st.w.hx[j.farm.house] - 20 + a.ox * 0.3, st.w.hy[j.farm.house] + 5 + a.oy * 0.2];
  const RECLAIM = { fallow: 10, scrub: 20 }; // hours to clear a field gone to grass or to scrub (Kim, 30 Oct)
  // The spring sowing window, when fields are hoed and sown.
  const sowing = (E, c) => c.season === 0 && c.sday >= E.sowWindow[0] && c.sday <= E.sowWindow[1];
  const fieldKey = (f, fd) => `f${f.id}.${fd.id}`;
  // The household has fewer meals than the coming meal needs, and grain to cook it from.
  const cookWanted = (st, hh, c) => hh.cookDay !== c.day && hh.meals < dailyNeed(st, hh) && hh.grain - reserved(st, hh, 'grain') > 0;
  // Ale is wanted (VB-305) while the household holds fewer than BREW.stock barrels and has the grain for one above its floor (which holds the
  // seed reserve): a household never brews grain it needs.
  const brewWanted = (st, hh) => Stores.aleOf(st, hh) < BREW.stock && hh.grain - floorOf(st, hh) >= BREW.grain;
  // ---- the rules shared by the kinds a module posts together; each names its jobs' kinds ----
  // A meadow is raked in early spring and mown in the haymaking window while the household wants hay; its hay is carried in once dry
  // (sim/meadows). Asked at the farm: whether hay is wanted is the household's, once for all its meadows.
  function meadowWork(st, hh, f, c, post) {
    // whether hay is wanted, asked once, and only when a meadow could be raked or mown now (VB-227)
    let hayW = null;
    const want = () => (hayW === null ? (hayW = hayWanted(st, f, hh)) : hayW);
    for (const m of f.meadows) for (const [key, kind] of meadowJobs(f, m, c, want)) post(key, m.tile, { meadow: m, farm: f }, kind);
  }
  // The byre's work at the cottage, for a household with herds or meat in its larder: fodder, slaughter, salting, milking (sim/byre).
  function byreWork(st, hh, f, c, post) {
    if (hh.herds.length || hh.larder.length) for (const [key, kind, extra] of byreJobs(st, hh, c)) post(key, f.house, { farm: f, ...extra }, kind);
  }
  // The farm's land project, a new field or meadow, at its present stage (clear, break, meadow) on its tile (sim/fields, sim/meadows).
  function landProject(st, hh, f, c, post) {
    if (f.project) post(`${f.project.stage}:f${f.id}`, f.project.tile, { farm: f, hours: f.project.hours }, f.project.stage);
  }
  // Settlers build their cottage (sim/settle): the open stage while the farm's booth stands (sim/expansion).
  function boothWork(st, hh, f, c, post) {
    const bj = boothJob(st, f); if (bj) post(bj[0], f.house, bj[2], bj[1]);
  }
  // Asked once for the island, not per village: the open step of each tile of every active plot, then each building plot's cottage stage,
  // owned by the plot's village (sim/expansion).
  function plotWork(st, holder, at, c, post) {
    for (const [key, kind, site, extra] of plotJobs(st)) post(key, site, extra, kind, { type: 'village', id: extra.plot.village });
  }
  // Asked once for the island: empty farms being restored, each by its claimant's household while the claim holds (sim/farmclaims).
  function claimWork(st, holder, at, c, post) {
    for (const [key, kind, owner, site, extra] of claimJobs(st)) post(key, site, extra, kind, owner);
  }
  // The household's spare food in days of its need: grain above the seed reserve and cooked meals (fish go into meals until VB-119).
  const spareDays = (st, hh) => {
    const need = dailyNeed(st, hh);
    return need > 0 ? (Math.max(0, hh.grain - reserved(st, hh, 'grain')) + hh.meals) / need : Infinity;
  };
  // Fishing: from spring day FISH.from + 1 to the end of autumn; the water is ice in winter.
  const fishing = (c) => (c.season === 0 && c.sday >= FISH.from) || c.season === 1 || c.season === 2;
  // Fishing's and gathering's urgency: fishCalm while spare food covers fishCalmDays of need or more, rising in a line to fishLean at none.
  const spareUrgency = (st, j, U) => {
    const d = spareDays(st, st.households[j.farm.household]);
    return d >= U.fishCalmDays ? U.fishCalm : U.fishLean - (U.fishLean - U.fishCalm) * d / U.fishCalmDays;
  };
  // Gathering: from summer day FORAGE.from + 1 to the end of autumn.
  const gathering = (c) => (c.season === 1 && c.sday >= FORAGE.from) || c.season === 2;
  // Hoeing and sowing grow more urgent as the sowing window runs out.
  const inWindow = (st, j, c, U) => U.field + c.sday / U.fieldPerDay;
  const KINDS = {
    plow: {
      verb: 'Hoeing a field', go: 'Going to hoe a field', name: 'Hoe a field', label: 'Hoeing', anim: 'hoe', hours: 20, hands: Infinity, type: 'tilling',
      field: true, spot: onField, urgency: inWindow, done: (st, j) => hoed(j.field),
      // a field in stubble, in the sowing window
      stages: ['stubble'], available: (st, hh, fd, c, post, f) => {
        if (sowing(st.ECON, c) && fd.stage === 'stubble') post('plow:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f });
      },
    },
    sow: {
      verb: 'Sowing', go: 'Going to sow', name: 'Sow a field', label: 'Sowing', anim: 'sow', hours: 2, hands: Infinity, type: 'tending',
      field: true, pace: 9,
      spot: onField, urgency: inWindow,
      done: (st, j, hh, c) => {
        const E = st.ECON;
        if (hh.grain < E.seedPerField) return;
        Stores.take(st, hh, 'grain', E.seedPerField, 'seed'); sown(j.field, c);
      },
      // a hoed field, in the sowing window, while the household has the seed for it
      stages: ['plowed'], available: (st, hh, fd, c, post, f) => {
        const E = st.ECON;
        if (sowing(E, c) && fd.stage === 'plowed' && hh.grain >= E.seedPerField) post('sow:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f });
      },
    },
    reap: {
      verb: 'Reaping', go: 'Going to reap', name: 'Reap a field', label: 'Reaping', anim: 'reap', hours: 5, hands: Infinity, type: 'harvest',
      field: true,
      spot: onField, urgency: (st, j, c, U) => U.reap + (c.season === 2 ? c.sday / U.reapFrostPerDay : 0),
      done: (st, j, hh, c) => reaped(st, j.field, c),
      // a ripe field
      stages: ['ripe'], available: (st, hh, fd, c, post, f) => { if (fd.stage === 'ripe') post('reap:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f }); },
    },
    haul: {
      verb: 'Bringing in the sheaves', go: 'Going for the sheaves', back: 'Carrying sheaves to the barn', name: 'Bring in sheaves', label: 'Hauling sheaves',
      anim: 'gather', hours: 0.7, hands: Infinity, type: 'harvest', carry: 'sheaf', to: 'barn', window: { from: WORK[0] - 1 }, // dry by the morning
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6], urgency: (st, j, c, U) => U.haul,
      deliver: (st, j, hh, f) => {
        Stores.sheaf(st, hh, j.field.held);
        if (f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks' || q === j.field)) log(st, `${f.name} has brought in its harvest.`, {
          kind: 'harvest', ...atFarm(f) });
        hauled(j.field);
      },
      // a field's stooks, once they have dried dryDays since the reaping
      stages: ['stooks'], available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'stooks' && c.day >= fd.reaped + st.ECON.dryDays) post('haul:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f });
      },
    },
    wood: {
      verb: 'Cutting firewood', go: 'Heading to the woods', back: 'Carrying firewood home', name: 'Cut firewood', label: 'Firewood', anim: 'chop',
      hours: 3, hands: 1, type: 'wood', carry: 'logs', to: 'woodpile',
      spot: (st, a, j) => [st.w.hx[j.site] - 8 + a.ox * 0.4, st.w.hy[j.site] + 6],
      // 2.2 when the pile is nearly out; else its shortfall of the goal, and more in autumn
      urgency: (st, j, c, U) => {
        const hh = st.households[j.farm.household];
        if (hh.wood < U.woodLow) return U.woodLowUrgency;
        const goal = woodTargets(st, hh).wood[c.season];
        return (goal - hh.wood) / goal + (c.season === 2 ? U.woodSummer : 0);
      },
      deliver: (st, j, hh) => { hh.wood += st.ECON.woodPerTrip; fellTree(st, j.farm); },
      // from a farm with a woodlot while the pile is below the plan's goal for the season; a second job while it is below the plan's woodSecond
      available: (st, hh, f, c, post) => {
        if (f.woodlot < 0) return;
        const T = woodTargets(st, hh);
        if (hh.wood < T.wood[c.season]) {
          post(`wood:h${hh.id}`, f.woodlot, { farm: f });
          if (hh.wood < T.woodSecond) post(`wood:h${hh.id}b`, f.woodlot, { farm: f });
        }
      },
    },
    water: {
      verb: 'Drawing water', go: 'Going for water', back: 'Carrying water home', name: 'Fetch water', label: 'Water', anim: 'draw', hours: 0.5,
      hands: 1, type: 'household', carry: 'buckets', to: 'door', window: { from: WORK[0] - 1 },
      spot: (st, a, j) => {
        const w = st.w;
        return st.villages[j.farm.village].well ? [w.hx[j.site] - 10 + a.ox * 0.2, w.hy[j.site] + 8] : [w.hx[j.site] - 1, w.hy[j.site] + 4];
      },
      urgency: (st, j, c, U) => (c.hour < U.waterMorningHour ? U.waterMorning : U.water),
      deliver: (st, j, hh) => { hh.waterDay = cal(st.t).day; },
      // once a day, from the hour before work until its end, at the village well if it has one, else by the house
      available: (st, hh, f, c, post) => {
        const inWork = c.hour >= WORK[0] - 1 && c.hour < WORK[1];
        if (inWork && hh.waterDay !== c.day) post(`water:h${hh.id}:${c.day}`,
          st.villages[f.village].well ? st.villages[f.village].center : f.house, { farm: f });
      },
    },
    cook: {
      verb: 'Cooking at the hearth', go: 'Going home to cook', name: 'Cook', label: 'Cook', anim: null, hours: 2, hands: 1, type: 'household',
      inside: true, window: { from: 14 },
      urgency: (st, j, c, U) => (c.hour >= U.cookEveningHour ? U.cookEvening : U.cook),
      // grain above the seed reserve is cooked into the meals still missing for the coming day (sim/stores cook, by FOODS)
      done: (st, j, hh, c) => {
        const make = Math.max(0, Math.min(dailyNeed(st, hh) - hh.meals, hh.grain - reserved(st, hh, 'grain')));
        Stores.cook(st, hh, 'grain', make); hh.cookDay = c.day;
      },
      // from 14:00 to the end of work, while the household is short of meals and has grain to cook (cookWanted)
      available: (st, hh, f, c, post) => {
        if (c.hour >= 14 && c.hour < WORK[1] && cookWanted(st, hh, c)) post(`cook:h${hh.id}:${c.day}`, f.house, { farm: f });
      },
    },
    brew: {
      verb: 'Brewing ale', go: 'Going home to brew', name: 'Brew ale', label: 'Brewing', anim: null, hours: BREW.hours, hands: 1, type: 'household',
      inside: true, urgency: (st, j, c, U) => U.brew,
      // a barrel from the grain, if it is still surplus when the work is done
      done: (st, j, hh) => { if (hh.grain - floorOf(st, hh) >= BREW.grain) Stores.brew(st, hh); },
      // in autumn and winter, once the harvest is in, while ale is wanted (brewWanted)
      available: (st, hh, f, c, post) => {
        if ((c.season === 2 || c.season === 3) && brewWanted(st, hh)) post(`brew:h${hh.id}:${c.day}`, f.house, { farm: f });
      },
    },
    weed: {
      verb: 'Weeding a field', go: 'Going to weed a field', name: 'Weed a field', label: 'Weed', anim: 'gather', hours: 2, hands: Infinity, type: 'tending',
      field: true, spot: onField, done: (st, j) => weeded(j.field),
      // a growing field whose weeding is open (sim/fields)
      stages: ['growing'], available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'growing' && fd.weedOpen) post('weed:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f });
      },
    },
    thresh: {
      verb: 'Threshing in the barn', go: 'Going to the barn to thresh', name: 'Thresh the grain', label: 'Threshing', anim: null, hours: 6,
      hands: Infinity, type: 'threshing', inside: true, window: { from: WORK[0] - 1 }, done: (st, j, hh) => { Stores.thresh(st, hh); },
      // while the barn holds unthreshed sheaves
      available: (st, hh, f, c, post) => { if (hh.unthreshed.length) post(`thresh:h${hh.id}`, f.house, { farm: f }); },
    },
    clear: {
      verb: 'Clearing scrub and stones', go: 'Going to clear land', name: 'Clear a new field', label: 'Clear', anim: 'hoe', hours: 10, hands: Infinity,
      type: 'tilling', field: true, spot: onField, project: true, worked: workStake, done: (st, j, hh) => onProject(j) && finishClear(st, j.farm, hh),
      available: landProject, // also a plot's step (plotWork)
    },
    break: {
      verb: 'Breaking new ground', go: 'Going to break new ground', name: 'Break new ground', label: 'Break', anim: 'hoe', hours: 30, hands: Infinity,
      type: 'tilling', field: true, spot: onField, project: true, worked: workStake, done: (st, j) => onProject(j) && finishBreak(st, j.farm),
      available: landProject, // also a plot's step (plotWork)
    },
    meadow: {
      verb: 'Clearing a hay meadow', go: 'Going to clear a meadow', name: 'Clear a hay meadow', label: 'Meadow', anim: 'hoe', hours: 4, hands: Infinity,
      type: 'tilling', field: true, spot: onField, project: true, worked: workStake, done: (st, j, hh) => onProject(j) && finishMeadow(st, j.farm, hh),
      available: landProject,
    },
    reclaim: {
      verb: 'Clearing an overgrown field', go: 'Going to clear an overgrown field', name: 'Clear an overgrown field', label: 'Reclaim', anim: 'hoe',
      hours: 10, hands: Infinity, type: 'tilling', field: true, spot: onField,
      done: (st, j) => reclaimed(st, j.field),
      // a field gone to grass or scrub while the farm stood empty is cleared again (VB-033)
      stages: ['fallow', 'scrub'], available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'fallow' || fd.stage === 'scrub') post('reclaim:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f, hours: RECLAIM[fd.stage] });
      },
    },
    restore: { // an empty farm's house mended by its claimant (sim/farmclaims); its hours by the condition when claimed
      verb: 'Mending an empty farm', go: 'Going to mend an empty farm', name: 'Mend an empty farm', label: 'Mending a farm', anim: 'mallet', hours: 20,
      hands: Infinity, type: 'wood', project: true, worked: workClaim, done: restored, available: claimWork,
    },
    rake: {
      verb: 'Raking the meadow clean', go: 'Going to rake a meadow', name: 'Rake a meadow', label: 'Raking', anim: 'gather', hours: 2, hands: Infinity,
      type: 'harvest', field: true, spot: onField, urgency: (st, j, c, U) => U.rake, done: (st, j) => { j.meadow.raked = true; }, available: meadowWork,
    },
    mow: {
      verb: 'Mowing hay', go: 'Going to mow a meadow', name: 'Mow a meadow', label: 'Mowing', anim: 'mow', hours: 16, hands: Infinity, type: 'harvest',
      field: true, spot: onField, urgency: (st, j, c, U) => U.mow + Math.max(0, hayDay(c)) / U.mowPerDay, done: (st, j, hh, c) => mowDone(st, j.meadow, c),
      available: meadowWork,
    },
    hay: {
      verb: 'Gathering the hay', go: 'Going for the hay', back: 'Carrying hay to the barn', name: 'Bring in hay', label: 'Hauling hay', anim: 'gather',
      hours: 4, hands: Infinity, type: 'harvest', carry: 'hay', to: 'barn',
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6], urgency: (st, j, c, U) => U.haul,
      deliver: (st, j, hh, f) => hayIn(st, j.meadow, hh, f), available: meadowWork,
    },
    fodder: {
      verb: 'Feeding and mucking out in the byre', go: 'Going to the byre', name: 'Fodder the animals', label: 'Byre', anim: 'gather', hours: 1,
      hands: 1, type: 'husbandry', spot: byreSpot, window: { from: WORK[0] - 1 }, urgency: (st, j, c, U) => U.fodder, done: (st, j, hh, c) =>
        fodderDone(st, hh, c), available: byreWork,
    },
    manure: {
      verb: 'Spreading manure on the field', go: 'Carting manure to the field', name: 'Cart manure', label: 'Manure', anim: 'gather', hours: 1,
      hands: Infinity, type: 'tilling', field: true, spot: onField, urgency: (st, j, c, U) => U.manure,
      done: (st, j, hh) => manureDone(st, j.field, hh, j.hours),
      // in spring, while the heap holds a load: the farm's poorest field not yet sown, for the loads it takes (manureWanted, VB-137)
      available: (st, hh, f, c, post) => {
        const dung = manureWanted(f, hh, c);
        if (dung) post(`manure:f${f.id}.${dung[0].id}`, dung[0].tile, { field: dung[0], farm: f, hours: dung[1] });
      },
    },
    milk: {
      verb: 'Milking the cows', go: 'Going to milk the cows', name: 'Milk the cows', label: 'Milking', anim: 'milk', hours: 0.5, hands: 1,
      type: 'husbandry', spot: byreSpot, window: { from: WORK[0] }, urgency: (st, j, c, U) => (c.hour < U.milkLateHour ? U.milk : U.milkLate),
      done: (st, j, hh, c) => milkDone(st, hh, c), available: byreWork,
    },
    slaughter: {
      verb: 'Slaughtering', go: 'Going to slaughter', name: 'Slaughter an animal', label: 'Slaughter', anim: 'mallet', hours: 3, hands: 2,
      type: 'husbandry', spot: byreSpot, urgency: (st, j, c, U) => (j.entry.lean ? U.slaughterNow : U.slaughter),
      done: (st, j, hh) => slaughterDone(st, j.herd, j.entry, hh), available: byreWork,
    },
    salt: {
      verb: 'Salting meat', go: 'Going home to salt the meat', name: 'Salt the meat', label: 'Salting', anim: null, hours: 1, hands: 1, type: 'household',
      inside: true, urgency: (st, j, c, U) => U.salt, done: (st, j, hh) => saltDone(st, hh), available: byreWork,
    },
    fell: { verb: 'Felling trees', go: 'Going to fell trees', name: 'Fell trees', label: 'Fell', anim: 'chop', hours: 10, hands: Infinity, type: 'wood',
      available: plotWork },
    grub: {
      verb: 'Grubbing out stumps', go: 'Going to grub out stumps', name: 'Grub out stumps', label: 'Grub', anim: 'hoe', hours: 6, hands: Infinity,
      type: 'tilling', field: true, spot: onField, available: plotWork,
    },
    // the cottage's stages: a plot's are finished by sim/expansion (j.plot); a booth's (j.booth, settlers) here
    foundation: { verb: 'Laying the foundation', go: 'Going to lay a foundation', name: 'Lay the foundation', label: 'Foundation', anim: 'mallet', hours: 30,
      hands: Infinity, type: 'wood', done: (st, j) => { if (j.booth) finishBoothStage(st, j); }, available: boothWork }, // also a plot's (plotWork)
    walls: { verb: 'Raising the log walls', go: 'Going to raise the walls', name: 'Raise the walls', label: 'Walls', anim: 'chop', hours: 60, hands: Infinity,
      type: 'wood', done: (st, j) => { if (j.booth) finishBoothStage(st, j); }, available: boothWork },
    roof: { verb: 'Laying the turf roof', go: 'Going to lay the roof', name: 'Lay the roof', label: 'Roof', anim: 'mallet', hours: 30, hands: Infinity,
      type: 'wood', done: (st, j) => { if (j.booth) finishBoothStage(st, j); }, available: boothWork },
    mend: {
      verb: 'Mending the fence', go: 'Going to mend the fence', name: 'Mend the fence', label: 'Mending', anim: 'mallet', hours: 2.5, hands: 1,
      type: 'upkeep',
      spot: (st, a, j) => {
        const w = st.w, s = j.stretch;
        return [s.mx + (w.hx[j.site] - s.mx) * 0.25, s.my + (w.hy[j.site] - s.my) * 0.25 + 3];
      },
      urgency: (st, j, c, U) => (1 - j.stretch.cond) * U.mendPerCond,
      done: (st, j) => { j.stretch.cond = 1; j.stretch.dirty = true; },
      // a stretch worn below fenceMendBelow: of the farm's fence, the household's; asked at a village (no farm), of the village's own
      available: (st, holder, at, c, post, f) => {
        const E = st.ECON;
        if (f) { if (f.fence) for (const s of f.fence) if (s.cond < E.fenceMendBelow) post(`mend:f${f.id}.${s.id}`, s.tile, { stretch: s, farm: f }); return; }
        for (const s of at.fence) if (s.cond < E.fenceMendBelow) post(`mend:v${at.id}.${s.id}`, s.tile, { stretch: s }, 'mend', { type: 'village', id: at.id });
      },
    },
    repair: { // the house's upkeep (VB-306): 4 work hours raise its condition 0.1, offered once it is under 0.8
      verb: 'Mending the house', go: 'Going to mend the house', name: 'Mend the house', label: 'House', anim: 'mallet', hours: HOUSE.hours, hands: 1,
      type: 'upkeep', urgency: (st, j, c, U) => U.repair,
      done: (st, j) => { const f = j.farm; f.condition = Math.min(1, houseCondition(st, f) + HOUSE.raise); f.condAt = st.t; },
      available: (st, hh, f, c, post) => {
        if (f.household === hh.id && !f.booth && houseCondition(st, f) < HOUSE.mendBelow) post(`repair:f${f.id}`, f.house, { farm: f });
      },
    },
    fish: {
      verb: 'Fishing', go: 'Going fishing', back: 'Carrying the catch home', name: 'Go fishing', label: 'Fishing', anim: 'fish', hours: 3, hands: 1,
      type: 'foraging', carry: 'fish', to: 'door',
      // at the water's edge: the edge of the lake or sea tile, or by the brook that runs through the middle of a river tile
      spot: (st, a, j) => {
        const w = st.w, x = w.hx[j.site], y = w.hy[j.site], k = w.water[j.water] ? 0.45 : 0.7;
        return [x + (w.hx[j.water] - x) * k + a.ox * 0.15, y + (w.hy[j.water] - y) * k + a.oy * 0.1];
      },
      // fishCalm while spare food covers fishCalmDays of need or more, rising in a line to fishLean at none
      urgency: (st, j, c, U) => spareUrgency(st, j, U),
      // the catch goes straight into the household's meals until fresh food (VB-119)
      deliver: (st, j, hh) => { Stores.put(st, hh, 'meals', landCatch(st, j.water), 'catch'); },
      // in the fishing season, at the house's fishing ground (sim/fish): one trip, two while spare food covers fewer than FISH.secondDays
      available: (st, hh, f, c, post) => {
        if (!fishing(c)) return;
        const g = ground(st, f.house);
        if (!g) return;
        // the key names the bank, so a ground fished out is left for the next one at the following review
        post(`fish:h${hh.id}:${g.shore}`, g.shore, { farm: f, water: g.water });
        if (spareDays(st, hh) < FISH.secondDays) post(`fish:h${hh.id}:${g.shore}b`, g.shore, { farm: f, water: g.water });
      },
    },
    gather: {
      verb: 'Gathering berries, mushrooms and nuts', go: 'Going to the woods to gather', back: 'Carrying the baskets home', name: 'Gather wild food',
      label: 'Gathering', anim: 'forage', hours: 3, hands: 1, type: 'foraging', carry: 'basket', to: 'door',
      urgency: (st, j, c, U) => spareUrgency(st, j, U),
      // the baskets go straight into the household's meals until fresh food (VB-119)
      deliver: (st, j, hh) => { Stores.put(st, hh, 'meals', gather(st, j.site), 'gathering'); },
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
  // A job is open while it has work left and fewer workers than hands; a carried job whose work is done waits for its carrier.
  const isOpen = (j) => j.claims.length < KINDS[j.kind].hands && j.done < (j.hours ?? KINDS[j.kind].hours);
  // Each role's rank of every kind: its exception for the kind, else its rank of the kind's type of work, else 0.
  for (const r of Object.values(ROLES)) r.prio = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, r.except[k] ?? r.work[K.type] ?? 0]));
  // Where refreshJobs (sim/jobs) asks, in this order: for each occupied farm in turn, at each of its fields (field), at the farm (farm),
  // and at the farm again after the household's plans for land (farmAfterPlans); then at each village (village), then once for the island
  // (island). An entry is [kind, rule]: a kind's own rule posts that kind; a shared rule (kind null) names its jobs' kinds. A job's id is its
  // posting order and matching visits jobs by id, so this order is part of the behaviour: two jobs new in the same hour keep their order.
  // fieldAt: the field's rules by the field's stage (each kind's `stages`), in the order of `field`; refreshJobs asks only those.
  const rule = (k) => (typeof k === 'string' ? [k, KINDS[k].available] : [null, k]);
  const ASK = {
    field: ['plow', 'sow', 'weed', 'reap', 'haul', 'reclaim'].map(rule),
    farm: [meadowWork, 'manure', byreWork].map(rule),
    farmAfterPlans: [landProject, boothWork, 'wood', 'thresh', 'water', 'cook', 'brew', 'mend', 'repair', 'fish', 'gather'].map(rule),
    village: ['mend'].map(rule),
    island: [plotWork, claimWork].map(rule),
    fieldAt: {},
  };
  for (const e of ASK.field) for (const g of KINDS[e[0]].stages) (ASK.fieldAt[g] ||= []).push(e);
  return { KINDS, ASK, cookWanted, rowAngle, firstRow, isOpen };
})();
