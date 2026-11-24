// @sys sim/wells: a household's well (VB-1553): the making `well`, dug at the house on the house's own tile in the hours its ground's depth
// asks and lined with stone off the household's heap; the head's test of whether a well pays, on its planning day, and the stone it wants
// on its heap for one; the well finished is a source on the map (sim/water)
// Design: design.md, Goods and the farming year, Water by the site (Wells: A household's well). The well's cost is world/water's one rule
// (wellHours, wellStone), which the village's well reads too (sim/green). What a head knows before it digs is the ground's band, never
// the depth: it weighs the band's middle, sets aside the band's most stone, and meets the depth when water is struck.
VB['sim/wells'] = (() => {
  const { FRESH, WELL, NO_WELL, BANDS, band, bandMid, bandStone, wellHours, wellStone } = VB['world/water'];
  const { YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
  const { WATER, dayFetch, waterOf, wellDug } = VB['sim/water'];
  const Stores = VB['sim/stores'],
    Projects = VB['sim/projects'];
  const { declare } = VB['sim/makings'];
  const { issue } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  const { log, atFarm } = VB['sim/records'];
  // The loads of stone on household hh's heap that no plan holds.
  const free = (st, hh) => Stores.heldOf(hh, 'stone') - Stores.reserved(st, hh, 'stone');
  // Whether farm f has a well of its own, on its house's tile.
  const hasWell = (st, f) => st.w.fresh[f.house] === FRESH.WELL;
  // Why household hh, holding farm f, may not begin a well now, but for its stone; or null. The ground has none (mountain, snow, water
  // deeper than WELL.deepest), the farm has one, one is being dug, or the household has a project of its own under way (VB-1553's
  // criterion: with no project under way; the well is long work).
  function ground(st, hh, f) {
    if (!(st.w.waterDepth[f.house] < NO_WELL)) return `there is no well in the ground of ${f.name}`;
    if (hasWell(st, f)) return `${f.name} has a well`;
    if (Projects.underWay(st, hh.id, 'well')) return `${f.name} has a well under way`;
    return Projects.ownOf(st, hh.id) ? `household ${hh.id} has a project under way` : null;
  }
  // The stone a well on farm f's ground is begun with: the most its band may take, since the depth is not known before the digging.
  const lining = (st, f) => bandStone(band(st.w.waterDepth[f.house]));
  // The verb's one check, for every head (sim/makings): the ground's, and the lining's stone free on the heap.
  function why(st, hh, f) {
    const no = ground(st, hh, f);
    if (no) return no;
    const need = lining(st, f),
      have = Math.floor(free(st, hh) + 1e-9);
    return have >= need
      ? null
      : `a ${BANDS[band(st.w.waterDepth[f.house])].name} well may take ${need} loads of stone for its lining, and the heap holds ${have} free`;
  }
  // Whether a well of its own pays farm f's household (design.md, A household's well): the hours of fetching it saves in WELL.payYears,
  // the household's day's fetch as it is made (VB-1573; sim/water waterOf: the trips its people at home make at its source as found,
  // farmstead.water, with its cart where that is the cheaper) against the drawing at the door for each trip, are more than the well's
  // hours at the head's estimate, the middle of the ground's band. A farm with no water in reach reckons the farthest fetch a farm
  // makes. Numbers the farm's source already holds, and the household's members counted: nothing is searched.
  function pays(st, f) {
    const d = st.w.waterDepth[f.house];
    if (!f.water || !(d < NO_WELL) || hasWell(st, f)) return false;
    const W = waterOf(st, f),
      fetch = W.none ? dayFetch(WATER.search, W.people, W.kind).hours : W.hours;
    return (fetch - dayFetch(0, W.people, W.kind).hours) * WELL.payYears * YEAR_DAYS > bandMid(band(d));
  }
  // A household makes its land first (as its building step does, sim/building): while it has fewer fields than its plan wants, or
  // keeps animals with no meadow to mow for them, its head's rule begins no well (tests/meadows.js: a founder's first meadow is late
  // as it is). Two comparisons; the played head digs when it likes.
  function landFirst(st, hh, f) {
    const plan = st.plans.households.get(hh.id);
    return (
      (!!plan && !!plan.targets && f.fields.length < plan.targets.fields) || (hh.herds.length > 0 && !f.meadows.length)
    );
  }
  // Whether the head of household hh, holding farm f, means to dig: a well pays, its ground and its plans allow one, its land is
  // made, and it does not hold off projects (sim/projects mayBegin).
  const means = (st, hh, f) =>
    f.household === hh.id &&
    pays(st, f) &&
    Projects.mayBegin(st, hh, 'well') &&
    ground(st, hh, f) === null &&
    !landFirst(st, hh, f);
  // The loads of stone household hh's heap lacks for the well its head means to dig, 0 when it means none or has them: its building
  // step gathers them (sim/building: picked or quarried, as the foundation's), since a heap holds little that no work asked for.
  const stoneLacking = (st, hh, f) =>
    means(st, hh, f) ? Math.max(0, lining(st, f) - Math.floor(free(st, hh) + 1e-9)) : 0;
  declare('well', {
    small: true,
    why,
    begin: (st, hh, f) => ({
      steps: [
        {
          kind: 'housewell',
          place: f.house,
          hours: wellHours(st.w.waterDepth[f.house]),
          spends: { stone: lining(st, f) },
        },
      ],
    }),
  });
  // The slack of the year, when the head's rule begins the digging: the first half of summer, between the sowing and the haymaking,
  // and winter, as a house is raised onto stone then (sim/building's slack); a well begun in the hay harvest cost a byre its hay
  // (tests/byre.js). The played head digs when it likes.
  const slack = (c) => (c.season === 1 && c.sday < SEASON_DAYS / 2) || c.season === 3;
  // On the household's planning day in the slack its head weighs a well: begun, through the verb every head has, when it pays and the
  // verb's check passes (the stone on its heap). A comparison of numbers a planning day; no search.
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || !slack(d.c)) return;
    const hh = st.households[d.plan.holder.id],
      f = hh.farmstead === null ? null : st.farmsteads[hh.farmstead];
    if (!f || hh.holder === null || hh.holder === undefined || !means(st, hh, f) || why(st, hh, f) !== null) return;
    issue(st, { actor: hh.holder, verb: 'project', target: hh.id, args: { what: 'well' }, source: 'pawn' });
  });
  // Water is struck and the well lined: the lining takes the stone its depth asks, of what was set aside (the rest stays on the heap);
  // the well is a source on the map, on the house's tile, and the farm finds its source again.
  function struck(st, j, hh, plan, s) {
    const f = j.farm,
      depth = st.w.waterDepth[s.place];
    // the depth met: what the lining takes of the stone set aside, which sim/projectplans spends as the step ends
    plan.steps[plan.open].spends.stone = Math.min(s.spends.stone, wellStone(depth)); // lint-allow: owner the step's own module names its spend
    wellDug(st, s.place, null, f);
    st.visualDirty = true;
    log(st, `${f.name} has struck water and lined a well by its house.`, { kind: 'wellDug', ...atFarm(f) });
  }
  const byHouse = (st, a, j) => [st.w.hx[j.farm.house] + 1 + a.ox * 0.3, st.w.hy[j.farm.house] + 19 + a.oy * 0.2];
  // The job kind (sim/kinds registers it): the open step of the household's well, posted with its hours by sim/projects' landProject.
  const KINDS = {
    housewell: {
      verb: 'Digging and lining a well',
      go: 'Going to dig the well',
      name: 'Dig a well by the house',
      at: ['farm'],
      needs: ['stone'],
      gives: ['well'],
      label: 'Well',
      anim: 'hoe',
      hours: bandMid(1),
      hands: 2,
      type: 'wood', // as a cart's building and a tar pit's digging
      project: true,
      spot: byHouse,
      done: (st, j, hh) => Projects.stepEnds(st, j, hh, struck),
    },
  };
  return { KINDS, pays, stoneLacking };
})();
