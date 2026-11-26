// @sys sim/fieldwork: the job kinds of a farm's fields: hoeing, sowing, weeding, reaping, bringing in, threshing, carting manure, clearing
// an overgrown field, and the two steps that make a new one (clear, break); each ends in one of sim/fields' transitions (or sim/newground's, sim/soil's)
// VB-418: the fields' domain in two modules: sim/fields is the field's state and its year, this the work a household does on it. It writes
// no field itself. sim/kinds joins KINDS into the registry, where a kind's fields are described; for a common field sim/commons wraps
// the three kinds whose end is the village's (haul, clear, break).
VB['sim/fieldwork'] = (() => {
  const { targetOf } = VB['sim/steps'];
  const Stores = VB['sim/stores'];
  const { WORK, SEASON_DAYS, TRAVEL, DAY, YEAR, cal } = VB['sim/rules'],
    { CROPS, ROTATIONS } = VB['sim/crops'];
  const { sowOpen, frostExpected, frostSeen } = VB['sim/weather'];
  const { courseFor } = VB['sim/rotations'];
  const { log, atFarm } = VB['sim/records'];
  const { scrubHours, SPREAD } = VB['sim/spread'];
  const { onProject, landProject } = VB['sim/projects'],
    { workStake } = VB['sim/claims'];
  const { finishClear, finishBreak } = VB['sim/newground'],
    { manureWanted, manureDone } = VB['sim/soil'];
  const { hoed, sown, reaped, standing, carried, laidDown, binned, reclaimed, weeded } = VB['sim/fields'];
  const { fieldsWorkable, fieldProject } = VB['sim/fieldplans'];
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
  const handsCap = (st, hh) => {
    const plan = st.plans.households.get(hh.id);
    return Math.max(1, targetOf(plan, 'fields') ? targetOf(plan, 'fields').workable : fieldsWorkable(st, hh));
  };
  function underHands(st, hh, fd, c, home) {
    if (home === hh) return true; // a common field, the village's own (sim/commons passes the village as both): it sows by its own rule
    const cap = handsCap(st, hh),
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
  // The fields household hh's hands till when field fd of its farm f is beyond them now (underHands), else null (VB-1652: the reason the
  // player's plan gives for a hoeing or a sowing not posted).
  const beyondHands = (st, hh, fd, f) =>
    underHands(st, hh, fd, cal(st.t), homeOf(st, hh, f)) ? null : handsCap(st, hh);
  // Hoeing and sowing grow more urgent as the sowing window runs out.
  const inWindow = (st, j, c, U) => U.field + c.sday / U.fieldPerDay;
  // Reaping and hauling the sheaves grow more urgent as the frost the head expects nears (sim/weather frostExpected, VB-354, VB-1175):
  // in autumn, by the days gone of a season that ended at the frost (as by the autumn's day when the frost fell on its last).
  const frostNear = (st, c, U) =>
    c.season === 2 ? Math.max(0, SEASON_DAYS - 1 - (frostExpected(st) - c.sday)) / U.reapFrostPerDay : 0;
  const KINDS = {
    plow: {
      verb: 'Hoeing a field',
      go: 'Going to hoe a field',
      name: 'Hoe a field',
      at: ['field'],
      needs: [],
      gives: [],
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
      at: ['field'],
      needs: ['seed'],
      gives: [],
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
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'plowed' && sowWhy(st, hh, fd, c) === null && underHands(st, hh, fd, c, homeOf(st, hh, f)))
          post('sow:' + fieldKey(f, fd), fd.tile, fieldJob(f, fd, 'sow'));
      },
    },
    reap: {
      verb: 'Reaping',
      go: 'Going to reap',
      name: 'Reap a field',
      at: ['field'],
      needs: [],
      gives: ['sheaves'],
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
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'ripe') post('reap:' + fieldKey(f, fd), fd.tile, reapJob(st, f, fd));
      },
    },
    haul: {
      verb: 'Bringing in the sheaves',
      go: 'Going for the sheaves',
      name: 'Bring in sheaves',
      at: ['field'],
      needs: ['sheaves'],
      gives: ['sheaves'],
      label: 'Hauling sheaves',
      anim: 'gather',
      hours: 0.7,
      hands: Infinity,
      type: 'harvest',
      window: { from: WORK[0] - 1 }, // dry by the morning
      spot: (st, a, j) => [st.w.hx[j.site] + a.ox * 0.6, st.w.hy[j.site] + a.oy * 0.6],
      urgency: (st, j, c, U) => U.haul + frostNear(st, c, U),
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'stooks' && c.day >= fd.reaped + st.ECON.dryDays)
          post('haul:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f, crop: fd.crop });
      },
    },
    weed: {
      verb: 'Weeding a field',
      go: 'Going to weed a field',
      name: 'Weed a field',
      at: ['field'],
      needs: [],
      gives: [],
      label: 'Weed',
      anim: 'gather',
      hours: HOURS.weed,
      hands: Infinity,
      type: 'tending',
      field: true,
      spot: onField,
      done: (st, j) => weeded(j.field),
      // a growing field whose weeding is open (sim/fields)
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'growing' && fd.weedOpen) post('weed:' + fieldKey(f, fd), fd.tile, fieldJob(f, fd, 'weed'));
      },
    },
    thresh: {
      verb: 'Threshing in the barn',
      go: 'Going to the barn to thresh',
      name: 'Thresh the grain',
      at: ['barn'],
      needs: ['sheaves'],
      gives: ['grain'],
      label: 'Threshing',
      anim: null,
      hours: HOURS.thresh,
      hands: Infinity,
      type: 'threshing',
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
      at: ['land'],
      needs: [],
      gives: ['stone'],
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
      at: ['land'],
      needs: [],
      gives: ['field'],
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
      at: ['field'],
      needs: [],
      gives: ['field'],
      label: 'Reclaim',
      anim: 'hoe',
      hours: 10,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      done: (st, j) => reclaimed(st, j.field),
      // a field gone to grass or scrub while the farm stood empty is cleared again (VB-033)
      available: (st, hh, fd, c, post, f) => {
        if (fd.stage === 'fallow' || fd.stage === 'scrub')
          post('reclaim:' + fieldKey(f, fd), fd.tile, { field: fd, farm: f, hours: reclaimHours(st, fd) });
      },
    },
    manure: {
      verb: 'Spreading manure on the field',
      go: 'Carting manure to the field',
      name: 'Cart manure',
      at: ['field'],
      needs: ['manure'],
      gives: [],
      label: 'Manure',
      anim: 'gather',
      hours: 1,
      hands: Infinity,
      type: 'tilling',
      field: true,
      spot: onField,
      urgency: (st, j, c, U) => (j.spare ? U.manureSurplus : U.manure),
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
  // worked indoors (VB-1820: the work step says it, sim/methods labour; no field of the kind)
  VB['sim/methods'].labour(KINDS.thresh, { inside: true });
  // The field stages each field kind is asked at (sim/kinds' ASK.fieldAt, sim/jobs' due rules, the guide): the asking order's, declared
  // here beside the kinds' `available`, which reads the stage again (VB-1820: no field of the kind)
  const STAGES = {
    plow: ['stubble'],
    sow: ['plowed'],
    reap: ['ripe'],
    haul: ['stooks'],
    weed: ['growing'],
    reclaim: ['fallow', 'scrub'],
  };
  // ---- the sheaves and the manure as goals (VB-1812; design.md section 7, The task as a plan): read from the world at each leg's end ----
  const Methods = VB['sim/methods'];
  // The sheaves: the stooks pitched on the cart (fetched first while they are more than a back load) or the back, carried to the barn (a
  // common field's to the green, `j.dest`: VB-100), and back for more while stooks stand; a load cut at the field goes back with them,
  // one cut elsewhere lies as the household's pile, which the stray method of its sheaves' goal fetches.
  const stooks = (g) => (g.job.field.stage === 'stooks' ? g.job.field.held : 0);
  Methods.carry(KINDS.haul, 'haul', {
    look: 'sheaf',
    words: 'Carrying sheaves to the barn',
    deliver: (st, j, hh, f, a) => {
      // the crop the task was posted for: the field goes on to its next course once its last load is taken up (VB-350); a load
      // left lying goes to the barn entry of its harvest, as the pile recorded it (`j.bin`, sim/lying lay), the field's own entry
      // untouched once it is sown anew (VB-1814: as the fetch kinds had it)
      const seq = Stores.sheaf(st, hh, a.load, j.bin ?? j.field.bin ?? -1, j.crop ?? j.field.crop);
      if (j.bin === undefined || j.bin === j.field.bin) binned(j.field, seq);
      if (
        f.fields.every((q) => q.stage !== 'ripe' && q.stage !== 'stooks') &&
        !hh.members.some((id) => id !== a.id && st.agents[id].load > 0 && st.agents[id].load > 0)
      )
        log(st, `${f.name} has brought in its harvest.`, { kind: 'harvest', ...atFarm(f) });
    },
    name: 'from the stooks',
    op: 'pitch',
    source: true,
    why: 'no stooks on the field',
    cart: true,
    to: 'barn',
    setDown: (st, j, a) => laidDown(j.field, a.load), // a load cut at the field goes back with the stooks
    run: (st, j, g, at, a, cap) => {
      a.load = carried(j.field, cap);
    },
    met: (st, g) => g.job.field.stage !== 'stooks',
  });
  Object.assign(KINDS.haul, {
    places: { barn: (st, g, v) => (g.job.common ? g.job.dest : v.storeOf(st, g.owner)) },
    can: { source: (st, g) => stooks(g) > 0, cartPays: (st, g) => stooks(g) > TRAVEL.load },
  });
  // The manure: carted from the heap to the field (the cart fetched first where one is free) and spread there; no load in hand.
  Methods.tend(KINDS.manure, {
    name: 'carted',
    op: 'spread',
    cart: true,
    carted: true, // faster with a cart (sim/carts)
    run: (st, j, g) => manureDone(st, j.field, st.households[g.owner], j.hours),
  });
  KINDS.manure.can = { cartPays: () => true };
  // ---- goals (VB-1777): a task at a tile carried through several steps by these kinds' methods (sim/kinds GOALS joins them) ----
  // A field from its clearing to its sowing (plant, VB-1649) and its crop from its reaping until its sheaves are in (harvest, VB-1650),
  // at a field of the household's farms, its own first and those it holds; a field project's tile, a marked one or a free one is the
  // registry's reading (sim/kinds goalWhere: `mark`, `project`).
  const SOWN = ['sown', 'growing', 'ripe', 'stooks'];
  const yearOf = (st) => Math.floor(st.t / YEAR) * YEAR;
  // The farms of household hid, its own first and those it holds (a household's farms are few), or [] for none.
  function farmsOf(st, hid) {
    const hh = hid === null || hid === undefined ? null : st.households[hid];
    if (!hh || hh.dissolved) return [];
    const home = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    return home ? [home, ...heldFarms(st, hid)] : heldFarms(st, hid);
  }
  // The field at `tile` of household hid's farms, as {f, fd}, or null.
  function fieldAt(st, hid, tile) {
    for (const f of farmsOf(st, hid)) for (const fd of f.fields) if (fd.tile === tile) return { f, fd };
    return null;
  }
  // The crop the field at `where` is sown with: its own, or for a project's the course a new field beside the farm's would take.
  function plantCrop(st, hid, where) {
    if (where.fd) return where.fd.crop;
    const { key, i } = courseFor(st, where.f ? where.f.fields : [], st.households[hid]);
    return ROTATIONS[key].courses[i];
  }
  const sowable = (k) => !CROPS[k].fallow && !!CROPS[k].sow && CROPS[k].seed > 0;
  // Crop k's sowing window this year, or next year's once this year's has shut: {opens, close (game hours; its first day's start of work,
  // the thaw not reckoned, and its last day's end of work), next (whether next year's)}; null for a crop not sown.
  function sowWindow(st, k) {
    if (!CROPS[k] || !sowable(k)) return null;
    const W = CROPS[k].sow,
      y0 = yearOf(st),
      close = (y) => y + (W[0] * SEASON_DAYS + W[2]) * DAY + WORK[1],
      y = close(y0) >= st.t ? y0 : y0 + YEAR;
    return { opens: y + (W[0] * SEASON_DAYS + W[1]) * DAY + WORK[0], close: close(y), next: y > y0 };
  }
  // Whether this year's sowing window of crop k has shut: its last day is past (sim/reasons windowLeft's count).
  const shut = (st, k) => {
    const W = CROPS[k].sow,
      c = cal(st.t);
    return c.season * SEASON_DAYS + c.sday > W[0] * SEASON_DAYS + W[2];
  };
  // The loads of a carrying: `amount` (rations of sheaves) at a back's load (TRAVEL.load rations).
  const loads = (amount, per) => Math.max(1, Math.ceil(amount / per - 1e-9));
  // Whether the year's frost has come (sim/weather frostSeen: seen fallen, not foreseen, VB-1686; what a stage reached at it means).
  const frosted = (st) => frostSeen(st) !== null;
  const plant = {
    noun: 'field',
    mark: 'field',
    project: fieldProject,
    kinds: ['fell', 'grub', 'clear', 'break', 'plow', 'sow'],
    which: ['sown', 'closed', 'fallow', 'gone'],
    at: fieldAt,
    none: (tile) => `there is no field of the household's nor a field project at ${tile}`,
    // a field not yet sown this year with its sowing window not shut
    why: (st, { fd }, tile) => {
      if (!sowable(fd.crop)) return `the field at ${tile} lies ${fd.crop} this year`;
      if (fd.stage !== 'stubble' && fd.stage !== 'plowed')
        return SOWN.includes(fd.stage) ? `the field at ${tile} is sown` : `the field at ${tile} is ${fd.stage}`;
      if (shut(st, fd.crop)) return `the ${fd.crop} sowing is over for this year`;
      return null;
    },
    // after a project, the hoeing and the sowing of the crop the new field would take; a field's hoeing (in stubble) and sowing; the
    // hoeing and the sowing laid no earlier than the window's opening
    steps: (st, hid, where) => {
      const crop = plantCrop(st, hid, where),
        C = CROPS[crop],
        win = sowWindow(st, crop),
        open = !where.fd;
      if (!sowable(crop) || !(open || where.fd.stage === 'stubble' || where.fd.stage === 'plowed')) return [];
      const out = open || where.fd.stage === 'stubble' ? ['plow', 'sow'] : ['sow'];
      return out.map((kind) => ({
        kind,
        hours: C.hours[kind] ?? KINDS[kind].hours,
        n: 1,
        from: win.opens,
        what: `the ${crop} sowing`,
      }));
    },
    // sown; this year's window shut with it unsown; the field made lies fallow
    gone: (st, { fd }) => {
      if (SOWN.includes(fd.stage)) return 'sown';
      if (!sowable(fd.crop)) return 'fallow';
      if (fd.stage !== 'stubble' && fd.stage !== 'plowed') return 'gone';
      return shut(st, fd.crop) ? 'closed' : null;
    },
    deadline: (st, hid, where) => {
      const crop = plantCrop(st, hid, where),
        win = sowWindow(st, crop);
      return win ? { t: win.close, what: `the end of the ${crop} sowing${win.next ? ' next year' : ''}` } : null;
    },
    // the household's rule that holds a field's hoeing or sowing back: the field beyond what its hands till (the plan's
    // targets.workable), or its sowing refused (the seed, the thaw)
    hold: (st, hid, where, y, tile) => {
      if (!where.fd || (y.kind !== 'plow' && y.kind !== 'sow')) return null;
      const hh = st.households[hid],
        cap = beyondHands(st, hh, where.fd, where.f);
      if (cap !== null) return ['hands', cap, tile];
      const why = y.kind === 'sow' && where.fd.stage === 'plowed' ? sowWhy(st, hh, where.fd, cal(st.t)) : null;
      return why ? ['sowing', why] : null;
    },
  };
  // The day a field's crop is expected ripe: its sowing and the crop's days to ripen (the year's weather, a draw, not reckoned).
  const ripeDay = (fd) => fd.sown + CROPS[fd.crop].ripe;
  const harvest = {
    noun: 'harvest',
    mark: null,
    kinds: ['reap', 'haul'],
    which: ['in', 'lost', 'gone'],
    at: fieldAt,
    none: (tile) => `there is no field of the household's at ${tile}`,
    why: (st, { fd }, tile) => (SOWN.includes(fd.stage) ? null : `the field at ${tile} is not sown`),
    // the reaping once ripe (expected), then the carrying once the sheaves are dry, by its loads; in stooks, the carrying left
    steps: (st, hid, { fd }) => {
      const dry = st.ECON.dryDays,
        haul = KINDS.haul.hours;
      if (fd.stage === 'stooks')
        return [
          {
            kind: 'haul',
            hours: haul,
            n: loads(fd.held, TRAVEL.load),
            from: (fd.reaped + dry) * DAY + WORK[0] - 1,
            what: 'the sheaves dry',
          },
        ];
      if (!SOWN.includes(fd.stage)) return [];
      const ripe = fd.stage === 'ripe' ? st.t : ripeDay(fd) * DAY + WORK[0];
      return [
        {
          kind: 'reap',
          hours: CROPS[fd.crop].hours.reap ?? KINDS.reap.hours,
          n: 1,
          from: ripe,
          what: `the ${fd.crop} ripe`,
        },
        {
          kind: 'haul',
          hours: haul,
          n: loads(standing(st, fd), TRAVEL.load),
          from: ripe + dry * DAY,
          what: 'the sheaves dry',
        },
      ];
    },
    // the sheaves in (the field reaped this year and back in stubble before the frost), or the crop lost to the frost or left standing
    gone: (st, { fd }) => {
      if (SOWN.includes(fd.stage)) return null;
      const y = Math.floor(st.t / YEAR) * (YEAR / DAY);
      return fd.reaped !== null && fd.reaped !== undefined && fd.reaped >= y && !frosted(st) ? 'in' : 'lost';
    },
    // the frost the head expects (`frost`, an autumn day), or the crop's day of loss left standing when that comes first; next year's for
    // a crop not ripe before this year's
    deadline: (st, hid, { fd }, frost) => {
      if (!SOWN.includes(fd.stage)) return null;
      const L = CROPS[fd.crop].lost,
        at = (y) => {
          const f = y + (2 * SEASON_DAYS + frost) * DAY + WORK[1];
          if (!L) return { t: f, what: 'the frost' };
          const l = y + (L[0] * SEASON_DAYS + L[1] - 1) * DAY + WORK[1];
          return l < f ? { t: l, what: `the ${fd.crop} lost standing` } : { t: f, what: 'the frost' };
        },
        d = at(yearOf(st));
      return fd.stage === 'stooks' || ripeDay(fd) * DAY < d.t ? d : at(yearOf(st) + YEAR);
    },
  };
  const GOALS = { plant, harvest };
  return { KINDS, STAGES, GOALS, sowWhy, beyondHands, rowAngle, onField, fieldKey, farmsOf };
})();
