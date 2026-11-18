// @sys sim/fieldwork: the job kinds of a farm's fields: hoeing, sowing, weeding, reaping, bringing in, threshing, carting manure, clearing
// an overgrown field, and the two steps that make a new one (clear, break); each ends in one of sim/fields' transitions
// VB-418: the fields' domain in two modules: sim/fields is the field's state and its year, this the work a household does on it. It writes
// no field itself. sim/kinds joins KINDS into the registry, where a kind's fields are described; for a common field sim/commons wraps
// the three kinds whose end is the village's (haul, clear, break).
VB['sim/fieldwork'] = (() => {
  const Stores = VB['sim/stores'];
  const { WORK, CROPS } = VB['sim/rules'];
  const { log, atFarm } = VB['sim/records'];
  const { scrubHours, SPREAD } = VB['sim/spread'];
  const { onProject, landProject } = VB['sim/projects'],
    { workStake } = VB['sim/claims'];
  const {
    finishClear,
    finishBreak,
    manureWanted,
    manureDone,
    hoed,
    sown,
    reaped,
    carried,
    laidDown,
    binned,
    reclaimed,
    weeded,
    onField,
  } = VB['sim/fields'];
  const RECLAIM = { fallow: 10, scrub: 20 }; // hours to clear a field gone to grass or to scrub (Kim, 30 Oct)
  // A field the forest has grown into at half cover or more is felled and grubbed besides (sim/spread, VB-091).
  const reclaimHours = (st, fd) => {
    const h = scrubHours(st, fd.tile);
    return RECLAIM[fd.stage] + (h > SPREAD.scrubHours ? h : 0);
  };
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
      done: (st, j, hh) => onProject(st, j) && finishClear(st, j.farm, hh), // a common field's: sim/commons' (common)
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
      done: (st, j) => onProject(st, j) && finishBreak(st, j.farm), // a common field's: sim/commons' (common)
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
      urgency: (st, j, c, U) => U.manure,
      carted: true, // faster with a cart (sim/carts)
      done: (st, j, hh) => manureDone(st, j.field, hh, j.hours),
      // in spring, while the heap holds a load: the farm's poorest field not yet sown, for the loads it takes (manureWanted, VB-137)
      available: (st, hh, f, c, post) => {
        const dung = manureWanted(f, hh, c);
        if (dung) post(`manure:f${f.id}.${dung[0].id}`, dung[0].tile, { field: dung[0], farm: f, hours: dung[1] });
      },
    },
  };
  return { KINDS, sowWhy };
})();
