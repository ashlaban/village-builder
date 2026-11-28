// @sys sim/fields: a field's crop year: hoed, sown, growing, weeded, ripe, reaped, carried, lost to the frost or left standing; fallow's rest
VB['sim/fields'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/fields', {
    fieldLeft: {}, // a field a household let go, its tile back to the village (VB-768)
    frost: { keep: 'generation', notice: 'farm', skip: 'farm' },
  });
  const { next: rnd } = VB['sim/rng'];
  const { HERD, DEER, DAY, SEASON_DAYS, YEAR, YEAR_DAYS } = VB['sim/rules'],
    { CROPS } = VB['sim/crops'];
  const { log, atFarm } = VB['sim/records'];
  const { cropFactor, ripeShift } = VB['sim/weather'];
  const Projects = VB['sim/projects'];
  const { clearScrub, lapse, wild, SPREAD, LAPSE } = VB['sim/spread'];
  const { nextStep, failed } = VB['sim/courses'];
  const { wearSoil, rested, tilthOf, wetFactor } = VB['sim/soil'];
  const { emit } = VB['sim/events'];
  const { setOwner } = VB['sim/ownership'];
  const { lossOver } = VB['sim/lying'];
  // A farm's window missed with the task that would have met it still on the board (sim/estimate, VB-476: the head's estimate read against
  // the truth): told before the field moves on, while the task stands. A village's common field has no head to have misjudged it.
  const missed = (st, f, fd, kind, why) => {
    if (!isVillage(f)) emit(st, 'windowMissed', { farm: f, field: fd, kind, why });
  };
  // The days after the crops' sowing windows close: [season, day, crop].
  const CLOSED = Object.keys(CROPS)
    .filter((k) => CROPS[k].seed > 0)
    .map((k) => {
      const [s, , last] = CROPS[k].sow;
      return last + 1 < SEASON_DAYS ? [s, last + 1, k] : [(s + 1) % 4, 0, k];
    });
  // A crop's course whose sowing window closed with its field unsown is a year lost: the field goes on to its next step, so that the farm's
  // fields stay staggered. Walked on those days only.
  function unsown(st, c) {
    for (const [s, d, k] of CLOSED) {
      if (c.season !== s || c.sday !== d) continue;
      for (const f of st.farmsteads)
        if (f.household !== null)
          for (const fd of f.fields)
            if (fd.crop === k && (fd.stage === 'stubble' || fd.stage === 'plowed')) {
              missed(st, f, fd, fd.stage === 'stubble' ? 'plow' : 'sow', `the window for sowing ${k} closed`);
              nextStep(fd);
            }
    }
  }
  // @state farmstead.fields[]: crop (a key of CROPS, sim/crops: a crop, or the course fallow, VB-348), stage, sown/reaped days, held sheaves and
  // weeding progress; changed only here after seeding, but for its course (rotation, step, crop, turn: sim/courses) and its soil (soil,
  // tilth, tilthAt, surplus, surplusYear: sim/soil), each part's owner in src/owners.json (VB-1479); made by sim/newground's broken.
  //   trampled: absent, or the times cattle got into the standing crop since it was sown (VB-136; each takes HERD.stray.loss of its yield)
  //   hoursOwn, hoursOther (VB-462): absent, or the year's work hours given by the user household's own members and by others
  //   weeds: absent, or the rounds of weeding posted since sowing (CROPS weeds; VB-334, VB-348)
  //   used: absent, or the game day of the field's last use (sown, reaped, a fallow course, reclaimed, broken; VB-1527): LAPSE.years
  //   after it the field goes back to the land (lapseFields)
  //   rest: absent, or a fallow field's rest this year (VB-348): 0.5 once it stood fallow at the summer's start, 1 once tilled; credited
  //   to the soil at the year's end, whatever the field bears by then (rye is sown on it in autumn)
  // A stubble field hoed for its crop; a fallow field (the course, not the stage) is tilled and stays in stubble.
  //   browsed: absent, or the times roe deer got into it since it was sown (VB-139; each takes DEER.crop.loss of its yield)
  const hoed = (fd) => {
    if (CROPS[fd.crop].fallow) fd.rest = 1;
    else fd.stage = 'plowed';
  };
  function sown(fd, c) {
    fd.stage = 'sown';
    fd.sown = c.day;
    fd.used = c.day;
    fd.weedOpen = false;
    fd.weedPosted = null;
    fd.weedMiss = 0;
    delete fd.trampled;
    delete fd.weeds;
    delete fd.browsed;
  }
  // farmstead.fields[] also has hoursOwn (VB-462): the year's work hours given by its user household's own members, and
  // hoursOther: those given by others (owed days, later the hired: VB-319); absent until the first; zeroed after the class is reckoned (VB-318).
  //   Written only here, as work is reckoned (sim/agents).
  const book = (fd, own, dt) => {
    const k = own ? 'hoursOwn' : 'hoursOther';
    fd[k] = (fd[k] || 0) + dt;
  };
  // Cattle got into the standing crop (sim/byre, VB-136), or roe deer (`deer`; sim/deer, VB-139).
  const trample = (fd, deer = false) => {
    if (deer) fd.browsed = (fd.browsed || 0) + 1;
    else fd.trampled = (fd.trampled || 0) + 1;
  };
  // The crop as it stands on field fd, in rations (VB-475): what the field would give at reaping but for the reaping's own draw: its
  // crop's yield by the field's fertility, wetness (VB-721), soil and tilth, its crop's reading of the seasons (sim/weather, VB-354), the weeding missed
  // (`missed` more rounds: the one open at reaping), the strays' trampling and the deer's browsing. Read by the reaping's hours
  // (sim/fieldwork) and by the reaping.
  function standing(st, fd, missed = 0) {
    const E = st.ECON;
    return (
      CROPS[fd.crop].yield *
      fd.fert *
      fd.soil *
      wetFactor(st, fd) *
      (1 + tilthOf(st, fd)) *
      cropFactor(st, fd.crop) *
      (1 - Math.min(E.weedCutMax, E.weedCut * (fd.weedMiss + missed))) *
      (1 - HERD.stray.loss) ** (fd.trampled || 0) *
      (1 - DEER.crop.loss) ** (fd.browsed || 0)
    );
  }
  // A reaping ends on a field still ripe; one whose crop was lost meanwhile, to the frost or left standing (fieldsFrost, lostRipe: in
  // stubble, gone on to its next course), is reaped of nothing (VB-356: a lost crop was reaped all the same, and a next course of fallow
  // gave a NaN load).
  function reaped(st, fd, c) {
    if (fd.stage !== 'ripe') return;
    if (fd.weedOpen) fd.weedMiss++;
    fd.stage = 'stooks';
    fd.reaped = c.day;
    fd.used = c.day;
    fd.held = Math.round(standing(st, fd) * (0.9 + rnd(st.rng.fields) * 0.2));
    delete fd.trampled;
    delete fd.browsed;
    delete fd.bin;
    delete fd.weeds;
    wearSoil(fd); // the crop takes from the soil (VB-137)
    fd.weedOpen = false;
    fd.weedPosted = null;
    fd.weedMiss = 0;
  }
  const hauled = (fd) => {
    fd.held = 0;
    fd.stage = 'stubble';
    fd.sown = null;
    nextStep(fd); // the crop is in (VB-350)
  };
  // A load of at most `cap` rations is taken from the stooks (VB-335); the field is hauled when the last is gone. `bin` is the barn entry
  // (sim/stores sheaf) holding the field's loads so far.
  function carried(fd, cap) {
    const n = Math.min(cap, fd.held);
    fd.held -= n;
    if (fd.held <= 0) hauled(fd);
    return n;
  }
  // A load set down by a carrier released on the road (VB-581) lies with the stooks for the next hand: the field is not hauled after all.
  function laidDown(fd, n) {
    fd.held += n;
    fd.stage = 'stooks';
  }
  const binned = (fd, seq) => {
    fd.bin = seq;
  };
  function reclaimed(st, fd) {
    clearScrub(st, fd.tile); // the forest's scrub on it is cleared with the grass (VB-091)
    fd.used = Math.floor(st.t / DAY);
    if (fd.stage === 'fallow' || fd.stage === 'scrub') fd.stage = 'stubble'; // its picture follows the stage (page/animate)
  }
  const weeded = (fd) => {
    fd.weedOpen = false;
  };
  function abandoned(f) {
    for (const fd of f.fields) {
      if (fd.stage !== 'stubble') fd.held = 0;
      fd.stage = 'stubble';
      fd.sown = null;
    }
  }
  // @state farmstead.left (VB-768): absent, or {gone (fields the farm has let go, ever), year (the game year of the last), inYear (let go in
  //   that year, at most FIELDS.letGo)}; a new field's id is the farm's fields made so far, fields.length + gone, so no id is used again
  // A field let go (the head's verb letField, sim/plans; VB-768): it leaves the farm's list and its tile passes back to the village, in
  // stubble or fallow as it lay: developed ground, outland any household of the village may take in again (sim/territory's freeFor). Only
  // an idle field is let go (the verb checks it: no crop, no sheaves, no job on it), so no work and no store is touched.
  function letGo(st, f, fd, c) {
    const i = f.fields.indexOf(fd);
    if (i < 0) return;
    f.fields.splice(i, 1);
    const L = f.left || (f.left = { gone: 0, year: c.year, inYear: 0 });
    if (L.year !== c.year) L.inYear = 0;
    L.gone++;
    L.year = c.year;
    L.inYear++;
    st.used.delete(fd.tile);
    setOwner(st, fd.tile, { type: 'village', id: f.village });
    lapse(st, fd.tile, fd.used); // developed ground until LAPSE.years from its last use, then its terrain again (sim/spread, VB-1527)
    st.farmDirty.add(f.id);
    st.biomeDirty.add(fd.tile);
    log(st, `${f.name} lets a field go: its household no longer needs its grain.`, { kind: 'fieldLeft', ...atFarm(f) });
  }
  // Field fd of farm `from` becomes farm f's (VB-034: an heir's field, as its house stands; sim/heirland settle): it leaves the list of the
  // farm it was split from, whose ids it does not give again (`left`, as a field let go), and is f's last, its id the next of f's; its
  // sheaves' barn entry was the old household's. Work on it was stopped by the caller.
  function passField(st, fromId, fd, toId, c) {
    const f = st.farmsteads[fromId],
      g = st.farmsteads[toId],
      i = f.fields.indexOf(fd);
    if (i < 0) return;
    f.fields.splice(i, 1);
    const L = f.left || (f.left = { gone: 0, year: c.year, inYear: 0 });
    L.gone++;
    delete fd.bin;
    fd.id = g.fields.length + ((g.left && g.left.gone) || 0);
    g.fields.push(fd);
    st.farmDirty.add(f.id);
    st.farmDirty.add(g.id);
  }
  VB.counter(
    'fieldLapse',
    "Fields weighed for their years unused on the year's last day (sim/fields' lapseFields; VB-1527)",
  );
  // A field unused goes back to the land, whatever farm it lies on (Kim, 23 Nov: reverting is a natural property of the ground, not tied
  // to a pawn or a household; VB-1527): on the year's last day, a field of any farm, held or empty, whose last use (fd.used: sown, reaped,
  // a fallow course, reclaimed, broken) is LAPSE.years back, that bears no crop and no sheaves and has no task on it, leaves the farm's
  // list and is wild ground of its terrain at once (sim/spread's wild). A field with no use recorded (laid out, or an older save's) counts
  // from the day its farm emptied, or from today. A farm under restoration keeps its fields (a claimant is reclaiming them).
  function lapseFields(st, c) {
    const day = Math.floor(st.t / DAY);
    for (const f of st.farmsteads) {
      if (!f.fields.length || Projects.onFarm(st, f.id)) continue;
      const jobs = f.household === null ? null : st.jobsBy.get(`household:${f.household}`);
      let n = 0;
      for (const fd of [...f.fields]) {
        VB.count.fieldLapse++;
        if (fd.used === undefined)
          fd.used = f.household === null && typeof f.emptySince === 'number' ? Math.floor(f.emptySince / DAY) : day;
        if (day - fd.used < LAPSE.years * YEAR_DAYS || !LIES.has(fd.stage) || fd.held > 0) continue;
        if (jobs && [...jobs].some((j) => j.field === fd)) continue;
        f.fields.splice(f.fields.indexOf(fd), 1);
        const L = f.left || (f.left = { gone: 0, year: c.year, inYear: 0 });
        L.gone++; // its id is not used again (VB-768)
        st.used.delete(fd.tile);
        setOwner(st, fd.tile, { type: 'village', id: f.village });
        wild(st, fd.tile);
        n++;
      }
      if (!n) continue;
      st.farmDirty.add(f.id);
      log(
        st,
        `${n === 1 ? 'A field' : `${n} fields`} of ${f.name}, unused ${LAPSE.years} years, ${n === 1 ? 'has' : 'have'} gone back to the land.`,
        {
          kind: 'fieldLeft',
          ...atFarm(f),
        },
      );
    }
  }
  const LIES = new Set(['stubble', 'fallow', 'scrub']);
  // A ripe field still standing on its crop's `lost` day is lost (rye by the autumn's first day; VB-348).
  function lostRipe(st, f, fd, c) {
    const L = CROPS[fd.crop].lost;
    if (!L || fd.stage !== 'ripe' || c.season !== L[0] || c.sday !== L[1]) return;
    missed(st, f, fd, 'reap', `the ${fd.crop} was lost, left standing too long`);
    fd.stage = 'stubble';
    fd.sown = null;
    fd.weedOpen = false;
    delete fd.weeds;
    delete fd.trampled;
    failed(st, f, fd);
    nextStep(fd); // the crop is lost: the field goes on to its next course (VB-350)
    log(st, `A crop at ${placeName(f)} was lost, left standing too long.`, { kind: 'frost', ...placeOf(f) });
  }
  // A field's holder as its log line names it: a farm, or a village for its common fields (VB-100).
  const isVillage = (x) => 'center' in x;
  const placeName = (x) => (isVillage(x) ? `the common field of ${x.name}` : x.name);
  const placeOf = (x) => (isVillage(x) ? { village: x.id } : atFarm(x));
  // The fields being worked: each occupied farm's, then each village's common fields (VB-100), as fn(holder, field).
  function eachWorked(st, fn) {
    for (const f of st.farmsteads) if (f.household !== null) for (const fd of f.fields) fn(f, fd);
    for (const v of st.villages) if (v.commonFields) for (const fd of v.commonFields) fn(v, fd);
  }
  // Fallow's rest (VB-348): marked on the summer's first day on each fallow field of an occupied farm (tilled since: 1), credited on the
  // year's last day: CROPS.fallow.mend times the mark, to at most SOIL.start (a field manured above it keeps its soil).
  // A fallow course whose field stood the summer (its rest marked) ends on the autumn's first day, and the field goes on to its next step:
  // in three courses, rye sown that autumn (VB-350).
  function rest(st, c) {
    const summer = c.season === 1 && c.sday === 0,
      autumn = c.season === 2 && c.sday === 0,
      end = c.season === 3 && c.sday === SEASON_DAYS - 1;
    if (!summer && !end && !autumn) return;
    for (const f of st.farmsteads)
      for (const fd of f.fields) {
        if (summer && f.household !== null && CROPS[fd.crop].fallow && fd.rest === undefined) {
          fd.rest = 0.5;
          fd.used = c.day; // a fallow course is the field's use that year
        }
        if (autumn && CROPS[fd.crop].fallow && fd.rest !== undefined) nextStep(fd);
        if (end && fd.rest !== undefined) {
          rested(fd);
          delete fd.rest;
        }
      }
  }
  // Daily crop rules, after routes and before buildings and fences decay. No random draws.
  function fieldsDay(st, c) {
    const E = st.ECON;
    const day = Math.floor(st.t / DAY);
    eachWorked(st, (f, fd) => {
      if (fd.sown === null || fd.stage === 'stooks') return;
      const g = day - fd.sown;
      if (g >= CROPS[fd.crop].ripe + ripeShift(st, fd.crop)) fd.stage = 'ripe';
      else if (g >= 3 && fd.stage === 'sown') fd.stage = 'growing';
      lostRipe(st, f, fd, c);
    });
    // upkeep: a growing field wants its crop's rounds of weeding (CROPS weeds), the next falling due E.weedDays[round] days after sowing; a
    // round still open when the next falls due, or at ripening (reaped), counts as missed
    eachWorked(st, (f, fd) => {
      if (fd.stage !== 'growing') return;
      const n = fd.weeds || 0;
      if (n >= CROPS[fd.crop].weeds || day - fd.sown < E.weedDays[n]) return;
      if (fd.weedOpen) fd.weedMiss++;
      fd.weedOpen = true;
      fd.weedPosted = day;
      fd.weeds = n + 1;
    });
    rest(st, c);
    unsown(st, c);
    if (c.season === 3 && c.sday === SEASON_DAYS - 1) lapseFields(st, c);
    // Untended fields go to grass, unless a claimant is restoring the farm; a field the forest has grown into is scrub (sim/spread, VB-091).
    for (const f of st.farmsteads)
      if (f.household === null && !Projects.onFarm(st, f.id)) {
        const yrs = (st.t - f.emptySince) / YEAR;
        for (const fd of f.fields) {
          const w = st.w,
            scrub = w.treesMax[fd.tile] > 0 && w.trees[fd.tile] >= SPREAD.scrub * w.treesMax[fd.tile];
          const want = scrub ? 'scrub' : yrs > 1 || fd.stage === 'scrub' ? 'fallow' : fd.stage;
          fd.stage = want;
        }
      }
  }
  // The autumn frost, on the year's frost day (sim/weather frostDay; sim/clock, CALENDAR: fieldsFrost, after fieldsDay): a crop still
  // standing is lost; a winter crop (rye) standing green is not (VB-348). Stooks are not lost at once: they wear a share a day from
  // today (stooksDecay, VB-2001).
  function fieldsFrost(st) {
    const lost = new Map(); // one line a holder, not one a field: holder -> {stage: count}
    eachWorked(st, (f, fd) => {
      if (CROPS[fd.crop].winter && fd.stage === 'growing') return;
      if (['ripe', 'growing'].includes(fd.stage)) {
        const k = fd.crop + ' ' + (STOOD[fd.stage] || fd.stage);
        if (fd.stage === 'ripe') missed(st, f, fd, 'reap', `frost took the ${fd.crop}`);
        if (!lost.has(f)) lost.set(f, new Map());
        lost.get(f).set(k, (lost.get(f).get(k) || 0) + 1);
        fd.stage = 'stubble';
        fd.sown = null;
        fd.held = 0;
        fd.weedOpen = false;
        delete fd.weeds; // the crop is gone, and its weeding with it (a lost barley field going fallow kept its rounds)
        delete fd.trampled;
        delete fd.browsed;
        failed(st, f, fd);
        nextStep(fd); // VB-350
      }
    });
    for (const [f, m] of lost) {
      const what = [...m].map(([k]) => k.split(' ')),
        crops = [...new Set(what.map((w) => w[0]))],
        stood = [...new Set(what.map((w) => w.slice(1).join(' ')))];
      log(st, `Frost took the ${crops.join(' and ')} at ${placeName(f)}, ${stood.join(' and ')}.`, {
        kind: 'frost',
        ...placeOf(f),
      });
    }
  }
  const STOOD = { ripe: 'ripe and not yet reaped', growing: 'still growing' };
  VB.counter(
    'outDecay',
    "Worked fields and meadows read for stooks and mown hay lying out, each day from the autumn frost to the year's end (sim/fields " +
      'stooksDecay, sim/meadows hayDecay; VB-2001)',
  );
  // Stooks out after the frost (VB-2001; design.md, Goods and the farming year, Risk; Kim, 27 Nov): each game day from the frost's to the
  // year's end (sim/clock), the sheaves standing in a worked field's stooks lose a share, by sim/lying's lossOver as a load lying out
  // does, booked to the field's holder as that load's loss is (the event lyingSpoilt, grain in rations); worn under LYING.quantum, what
  // is left is lost, the field goes on to its next course, and the frost is told. `days` over one: so many days at once (a test).
  function stooksDecay(st, days = 1) {
    const gone = new Map(); // holder -> [crop]
    eachWorked(st, (f, fd) => {
      VB.count.outDecay++;
      if (fd.stage !== 'stooks' || !(fd.held > 0)) return;
      const n = lossOver(fd.held, days);
      if (!(n > 0)) return;
      const owner = isVillage(f) ? { type: 'village', id: f.id } : { type: 'household', id: f.household };
      emit(st, 'lyingSpoilt', { owner, good: 'grain', n });
      if (n < fd.held - 1e-9) {
        fd.held -= n;
        return;
      }
      if (!gone.has(f)) gone.set(f, new Set());
      gone.get(f).add(fd.crop);
      fd.stage = 'stubble';
      fd.sown = null;
      fd.held = 0;
      failed(st, f, fd);
      nextStep(fd); // the crop is lost (VB-350)
    });
    for (const [f, crops] of gone)
      log(st, `Frost took the ${[...crops].join(' and ')} at ${placeName(f)}, left in stooks.`, {
        kind: 'frost',
        ...placeOf(f),
      });
  }
  return {
    passField,
    book,
    hoed,
    sown,
    trample,
    reaped,
    standing,
    carried,
    laidDown,
    binned,
    reclaimed,
    weeded,
    abandoned,
    letGo,
    lapseFields,
    fieldsDay,
    fieldsFrost,
    stooksDecay,
  };
})();
