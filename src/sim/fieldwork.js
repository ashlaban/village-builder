// @sys sim/fieldwork: the job kinds of a farm's fields: hoeing, sowing, weeding, reaping, bringing in, threshing, carting manure, clearing
// an overgrown field, and the two steps that make a new one (clear, break); each ends in one of sim/fields' transitions (or sim/newground's, sim/soil's)
// VB-418: the fields' domain in two modules: sim/fields is the field's state and its year, this the work a household does on it. It writes
// no field itself. sim/kinds joins KINDS into the registry, where a kind's fields are described; for a common field sim/commons wraps
// the three kinds whose end is the village's (haul, clear, break).
VB['sim/fieldwork'] = (() => {
  const Stores = VB['sim/stores'];
  const { WORK, SEASON_DAYS } = VB['sim/rules'],
    { CROPS } = VB['sim/crops'];
  const { sowOpen, frostDay } = VB['sim/weather'];
  const { log, atFarm } = VB['sim/records'];
  const { scrubHours, SPREAD } = VB['sim/spread'];
  const { onProject, landProject } = VB['sim/projects'],
    { workStake } = VB['sim/claims'];
  const { finishClear, finishBreak } = VB['sim/newground'],
    { manureWanted, manureDone } = VB['sim/soil'];
  const { hoed, sown, reaped, standing, carried, laidDown, binned, reclaimed, weeded } = VB['sim/fields'];
  const { fieldsWorkable } = VB['sim/fieldplans'];
  const { heldFarms } = VB['sim/ownership'];
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
  const RECLAIM = { fallow: 10, scrub: 20 }; // hours to clear a field gone to grass or to scrub (Kim, 30 Oct)
  // A field the forest has grown into at half cover or more is felled and grubbed besides (sim/spread, VB-091).
  const reclaimHours = (st, fd) => {
    const h = scrubHours(st, fd.tile);
    return RECLAIM[fd.stage] + (h > SPREAD.scrubHours ? h : 0);
  };
  // The sowing window of a field's crop, when it is hoed and sown (the row's `sow`: [season, first day, last day]), and in spring not
  // before the year's thaw (sim/weather, VB-354).
  const sowing = (st, fd, c) => sowOpen(st, fd.crop, c);
  // The hours of a stage are the crop's row (CROPS, sim/crops): the kinds hold barley's, and a field's job carries its crop's where they
  // differ (rye's weeding, fallow's tilling; VB-348), so a barley field's job is as it was.
  const HOURS = CROPS.barley.hours;
  const fieldKey = (f, fd) => `f${f.id}.${fd.id}`;
  const fieldJob = (f, fd, k) => {
    const h = CROPS[fd.crop].hours[k];
    return h === undefined || h === HOURS[k] ? { field: fd, farm: f } : { field: fd, farm: f, hours: h };
  };
  // ---- the crop's size (VB-475; Kim, 15 Nov: the time taken has causes the world can show) ----
  // Reaping and threshing take the crop's hours (CROPS hours, else the kind's) times the crop over a normal crop, within SIZE.range: a
  // normal crop is the crop's yield (CROPS yield) times SIZE.normal, what a field of middling fertility, soil and tilth gives in an
  // ordinary year. The carrying goes by loads already (haul).
  const SIZE = Object.freeze({ normal: 1, range: Object.freeze([0.5, 1.5]) });
  const sized = (crop, k, n) =>
    Math.round(
      (CROPS[crop].hours[k] ?? HOURS[k]) *
        Math.min(SIZE.range[1], Math.max(SIZE.range[0], n / (CROPS[crop].yield * SIZE.normal))) *
        1,
    ) / 1;
  // the reaping of field fd, its hours by the crop standing (the weeding round open at reaping is missed)
  const reapJob = (st, f, fd) => ({
    field: fd,
    farm: f,
    hours: sized(fd.crop, 'reap', standing(st, fd, fd.weedOpen ? 1 : 0)),
  });
  // the threshing of the sheaves first in household hh's barn (one field's crop), its hours by what they hold
  const threshJob = (hh, f) => ({
    farm: f,
    hours: sized(hh.sheafCrops?.[0] || 'barley', 'thresh', hh.unthreshed[0] || 0),
  });
  // Why household hh cannot sow field fd today, or null (VB-348): the course is not sown, the window is shut (or the thaw not come, VB-354),
  // the field is not hoed, or the household holds less than a field's seed of the crop, which is taken from its own grain (seed rye is rye).
  function sowWhy(st, hh, fd, c) {
    const C = CROPS[fd.crop];
    if (!(C.seed > 0)) return `a field in ${fd.crop} is not sown`;
    if (!sowing(st, fd, c)) return `${fd.crop} is not sown in this season, or the ground is not thawed`;
    if (fd.stage !== 'plowed') return 'the field is not hoed';
    const has = Stores.grainOf(hh, fd.crop);
    return has < C.seed
      ? `the household holds ${Math.floor(has)} of the ${C.seed} rations of ${fd.crop} a field's seed takes`
      : null;
  }
  // The farm household hh works from: its own, or field fd's farm f where it has none of its own here.
  const homeOf = (st, hh, f) => (hh.farmstead === null || hh.farmstead === undefined ? f : st.farmsteads[hh.farmstead]);
  // Whether household hh's hands can take on field fd (VB-1186): a household hoes and sows no more fields than its hands can till, its plan's
  // targets.workable (FIELDS.perHand a working adult and more for a team, sim/fields; at least one field, as fieldsWanted), so that what it
  // sows it can reap before the frost; the rest lie in stubble this year. Counted are its fields of the same harvest under a crop and, for
  // hoeing, those hoed, with those ahead of fd in its farms' order at fd's own stage (in stubble in the window, or hoed): the first are
  // worked. A winter crop sown in autumn is next year's harvest, so it counts only the winter crop's fields; a spring crop counts the
  // winter crop growing since the autumn. A household's fields are few (its hands' share and the fallow), so the walk is short.
  function underHands(st, hh, fd, c, home) {
    if (home === hh) return true; // a common field, the village's own (sim/commons passes the village as both): it sows by its own rule
    const plan = st.plans.households.get(hh.id),
      cap = Math.max(1, plan && plan.targets ? plan.targets.workable : fieldsWorkable(st, hh)),
      winter = !!CROPS[fd.crop].winter,
      at = fd.stage;
    let n = 0,
      ahead = true;
    for (const g of [home, ...heldFarms(st, hh.id)])
      for (const x of g.fields) {
        if (x === fd) {
          ahead = false;
          continue;
        }
        const C = CROPS[x.crop];
        if (C.fallow || (winter && !C.winter)) continue;
        if (x.stage === 'sown' || x.stage === 'growing' || (x.stage === 'plowed' && at === 'stubble')) n++;
        else if (ahead && x.stage === at && (at === 'plowed' || sowing(st, x, c))) n++;
        if (n >= cap) return false;
      }
    return true;
  }
  // Hoeing and sowing grow more urgent as the sowing window runs out.
  const inWindow = (st, j, c, U) => U.field + c.sday / U.fieldPerDay;
  // Reaping and hauling the sheaves grow more urgent as the year's frost nears (sim/weather frostDay, VB-354): in autumn, by the days gone
  // of a season that ended at the frost (as by the autumn's day when the frost fell on its last).
  const frostNear = (st, c, U) =>
    c.season === 2 ? Math.max(0, SEASON_DAYS - 1 - (frostDay(st) - c.sday)) / U.reapFrostPerDay : 0;
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
        if (
          sowing(st, fd, c) &&
          fd.stage === 'stubble' &&
          !(CROPS[fd.crop].fallow && fd.rest === 1) &&
          (CROPS[fd.crop].fallow || underHands(st, hh, fd, c, homeOf(st, hh, f)))
        )
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
        // the window shut while it was sown: the field went on to its next course (a fallow one has no seed), and is not sown now
        if (j.field.stage !== 'plowed' || !(CROPS[j.field.crop].seed > 0)) return;
        if (Stores.grainOf(from, j.field.crop) < CROPS[j.field.crop].seed) return; // the seed eaten since it was posted
        Stores.take(st, from, Stores.grainGood(j.field.crop), CROPS[j.field.crop].seed, 'seed');
        sown(j.field, c);
      },
      // a hoed field, in the sowing window, while the household has the seed for it (sowWhy)
      stages: ['plowed'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'plowed' && sowWhy(st, hh, fd, c) === null && underHands(st, hh, fd, c, homeOf(st, hh, f)))
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
      norm: (st, j) => CROPS[j.field.crop].hours.reap ?? HOURS.reap, // a normal crop's hours (the head's estimate, VB-476)
      urgency: (st, j, c, U) => U.reap + frostNear(st, c, U),
      done: (st, j, hh, c) => reaped(st, j.field, c),
      // a ripe field
      stages: ['ripe'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'ripe') post('reap:' + fieldKey(f, fd), fd.tile, reapJob(st, f, fd));
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
      urgency: (st, j, c, U) => U.haul + frostNear(st, c, U),
      load: (st, a, j, cap) => (a.load = carried(j.field, cap)),
      again: (j) => j.field.stage === 'stooks',
      setDown: (st, j, a) => laidDown(j.field, a.load),
      deliver: (st, j, hh, f, a) => {
        // the crop the task was posted for: the field goes on to its next course once its last load is taken up (VB-350)
        binned(j.field, Stores.sheaf(st, hh, a.load, j.field.bin ?? -1, j.crop ?? j.field.crop));
        if (
          f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks') &&
          !hh.members.some((id) => id !== a.id && st.agents[id].load > 0 && st.agents[id].phase === 'back')
        )
          log(st, `${f.name} has brought in its harvest.`, { kind: 'harvest', ...atFarm(f) });
      },
      stages: ['stooks'],
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'stooks' && c.day >= fd.reaped + st.ECON.dryDays)
          post('haul:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f, crop: fd.crop });
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
      norm: (st, j) => CROPS[st.households[j.owner.id].sheafCrops?.[0] || 'barley'].hours.thresh ?? HOURS.thresh,
      window: { from: WORK[0] - 1 },
      done: (st, j, hh) => {
        Stores.thresh(st, hh);
      },
      // while the barn holds unthreshed sheaves, one field's crop at a time
      available: (st, hh, f, c, post) => {
        if (hh.unthreshed.length) post(`thresh:h${hh.id}`, f.house, threshJob(hh, f));
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
      done: (st, j, hh) => {
        const plan = onProject(st, j); // a common field's: sim/commons' (common)
        if (plan) finishClear(st, j.farm, hh, plan);
      },
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
      done: (st, j) => {
        const plan = onProject(st, j); // a common field's: sim/commons' (common)
        if (plan) finishBreak(st, j.farm, plan);
      },
      available: landProject, // also a plot's step (plotWork)
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
          post('reclaim:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f, hours: reclaimHours(st, fd) });
      },
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
      urgency: (st, j, c, U) => (j.spare ? U.manureSurplus : U.manure),
      carted: true, // faster with a cart (sim/carts)
      done: (st, j, hh) => manureDone(st, j.field, hh, j.hours),
      // in spring, while the heap holds a load: the farm's poorest field not yet sown, for the loads it takes (manureWanted, VB-137)
      available: (st, hh, f, c, post) => {
        const dung = manureWanted(st, f, hh, c);
        if (dung && dung[1] > 0)
          post(`manure:f${f.id}.${dung[0].id}`, dung[0].tile, {
            field: dung[0],
            farm: f,
            hours: dung[1],
            spare: dung[2],
          });
      },
    },
  };
  return { KINDS, sowWhy, rowAngle, onField, fieldKey };
})();
