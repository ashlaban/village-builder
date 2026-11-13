// @sys sim/clock: the calendar (one ordered table of what runs each step, hour, day, season and year) and Sim.advance
VB['sim/clock'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, SEASON_DAYS, YEAR_DAYS, TICKS, cal, WORK, dark, SOCIAL, HERD, FISH } = VB['sim/rules'];
  const { log, startFold, foldHistory } = VB['sim/records'];
  const { growTrees } = VB['sim/forest'];
  const { spreadForest } = VB['sim/spread'];
  const { fieldsDay, fieldsFrost } = VB['sim/fields'];
  const { refreshRoutes, costChanged, refreshHoursStep, ROW_STEPS } = VB['sim/routes'];
  const { fadeWear } = VB['sim/paths'];
  const { feedHousehold, spoilGrain } = VB['sim/hunger'];
  const Stores = VB['sim/stores'];
  const { shareFood } = VB['sim/help'];
  const Workdays = VB['sim/workdays'];
  const { placeByDoor, release, dropJob, stepAgents, travelling, dueJourneys, stopJourneys, feedTravellers } =
    VB['sim/agents'];
  const { refreshJobs, callCooks, lookUp, planRound, idleAbout, lookForWork } = VB['sim/jobs'];
  const { issue, commanded, unplanned, playerStep } = VB['sim/commands'];
  const { talkHour, fadeRelations } = VB['sim/relations'];
  const { outdoors } = VB['sim/society'];
  const {
    meetingStage,
    MEETING_STAGES,
    roundPhase,
    ROUND_STEPS,
    dailyLife,
    dailyDeaths,
    nightCulture,
    NIGHT_STEPS,
    dueOffers,
  } = VB['sim/lifecycle'];
  const { dailyBirths } = VB['sim/births'];
  const { herdsDay, spring } = VB['sim/herds'];
  const { meadowsSpring, meadowsFrost } = VB['sim/meadows'];
  const { byreDay, autumnCounts, strays, shearing } = VB['sim/byre'];
  const { herdsBack, halveGraze } = VB['sim/grazing'];
  const { recount, deerGraze, browseCrops } = VB['sim/deer'];
  const { lapseClaims } = VB['sim/claims'];
  const { lapsedStakes } = VB['sim/stakes'];
  const { lapsedFarmClaims } = VB['sim/farmclaims'];
  const { occasionsDue, callMeetings } = VB['sim/occasions'];
  const { takeIn } = VB['sim/service'];
  const { trustOf } = VB['sim/ownership'];
  const { boatYear } = VB['sim/drying'],
    { tarYear } = VB['sim/tar'],
    { cartsYear } = VB['sim/carts'],
    { KINDS } = VB['sim/kinds'];

  // ---- the calendar (VB-241) ----
  // CALENDAR is everything the clock runs, in the order it runs: each 6-minute step walks the table once, top to bottom, and runs each
  // entry whose cadence and place the step reached and whose guard holds. The order decides outcomes (target-v2 3.3), so it is written
  // here and nowhere else; tests/clock.js checks required ordering relationships; tests/spread.js exercises scheduled phases.
  // An entry: {every, at, when, owner, run, note}.
  //   every: 'step' | 'hour' | 'day' | 'season' | 'year', how often it comes round.
  //   at: its place within that cadence, {hour, tick, season, sday, doy}. hour is the hour of the day; tick the 6-minute step counted
  //     from the start of that hour (of hour 0 when no hour is given), so a tick may run past its hour (the night's culture, steps 1 to 40
  //     of the day); either may be a range [from, to), to excluded. Left out: a 'step' entry runs on every step and an 'hour' entry at
  //     the first step of every hour; a 'day', 'season' or 'year' entry at midnight (hour 0, tick 0). The date is for the long cadences
  //     only: a 'season' entry runs on day sday of each season (0 when left out); a 'year' entry on day doy of the year, or on day sday
  //     of season, (day 0 of the year when neither is given).
  //   when: (st, c) => boolean, a guard that is not a place in the calendar: st.cenv, a list that is not empty, or a time that moves
  //     with the date (the dark's end). Left out: always.
  //   owner: the module whose rule the entry runs (a module of src/manifest.json); note: what it is, in a few words.
  //   run: (st, c, n): c is cal() of the step's hour (null for a 'step' entry with no date and no guard, which reads its own time), n
  //     the step of the day (0 to DAY * TICKS - 1).
  // It is code, never saved: compiled and frozen as this module loads (the last module before Sim, so nothing can register later).
  // To add an entry: insert it below where it should run, add a focused test for any new scheduling relationship.
  const STEPS_A_DAY = DAY * TICKS,
    mod = (x, m) => ((x % m) + m) % m;
  const cenv = (st) => !!st.cenv;
  // Households short of people whose ask for food fell short today (sim/help, VB-308): written by shareFood's entry and read by takeIn's
  // later in the same step, so it is never seen across a save.
  let short = [];
  const AUTUMN = 2,
    FROST = { season: AUTUMN, sday: SEASON_DAYS - 1 };
  const CALENDAR = [
    // ---- each hour, at its first step ----
    {
      every: 'hour',
      at: { hour: [SOCIAL.talk.from, SOCIAL.talk.to] },
      when: cenv,
      owner: 'sim/relations',
      note: 'talk, and the hours at home',
      run: (st, c) => talkHour(st, c.hour, outdoors(st)),
    },
    {
      every: 'hour',
      when: (st, c) => c.hour === Math.ceil(dark(c)[1]),
      owner: 'sim/agents',
      note: 'the dark ends: everyone indoors is by their door',
      run: (st) => {
        for (const id of st.living) {
          const a = st.agents[id];
          if (a.inside && !a.job) placeByDoor(st, a);
        }
      },
    },
    {
      every: 'hour',
      at: { hour: [WORK[0] - 1, WORK[1] + 1] },
      owner: 'sim/jobs',
      note: 'the review of the standing plans (sim/plans reviewHour)',
      run: (st, c) => refreshJobs(st, c),
    },
    {
      every: 'hour',
      at: { hour: [14, WORK[1]] },
      owner: 'sim/jobs',
      note: 'cooks called for the evening meal',
      run: (st, c) => callCooks(st, c),
    },
    {
      every: 'hour',
      at: { hour: [WORK[0], WORK[1]] },
      owner: 'sim/jobs',
      note: 'more urgent work interrupts a job (VB-107)',
      run: (st, c) => lookUp(st, c),
    },
    {
      every: 'hour',
      at: { hour: WORK[0] },
      when: (st) => st.journeys.length > 0,
      owner: 'sim/agents',
      note: "a journey's leg due sets out (VB-287)",
      run: (st) => dueJourneys(st),
    },
    {
      every: 'hour',
      at: { hour: WORK[1] },
      when: (st) => st.journeys.length > 0,
      owner: 'sim/agents',
      note: 'those on the road stop where they stand for the night (VB-287)',
      run: (st) => stopJourneys(st),
    },
    {
      every: 'hour',
      at: { hour: WORK[1] },
      owner: 'sim/agents',
      note: 'the work day ends: everyone free goes home',
      run: (st) => {
        for (const liveId of st.living) {
          const a = st.agents[liveId];
          if (st.pawns[a.id].died) continue;
          if (a.phase === 'back') continue; // finish the delivery first
          if (commanded(st, a.id)) continue; // the player's command says otherwise (VB-169)
          if (a.occasion !== null) continue; // at an occasion until its end (sim/occasions, VB-126)
          if (travelling(a)) continue; // on the road it sleeps where it stopped (VB-287)
          if (a.job && KINDS[a.job.kind].late && (a.phase === 'go' || a.phase === 'work')) continue; // a pot under way is finished (VB-119)
          release(st, a);
          if (!a.inside) issue(st, { actor: a.id, verb: 'goHome', source: 'planner' });
        }
      },
    },
    {
      every: 'hour',
      at: { hour: WORK[1] },
      when: (st, c) => !!Workdays.dayOf(c),
      owner: 'sim/workdays',
      note: "a village's work day ends: who turned out and who stayed away (VB-120); its jobs left free are taken down",
      run: (st, c) => {
        const called = new Set();
        for (const j of st.jobs.values()) if (Workdays.isWorkdayJob(j)) called.add(j.village);
        for (const v of st.villages) Workdays.judge(st, v, c, called.has(v.id));
        for (const j of [...st.jobs.values()]) if (Workdays.isWorkdayJob(j) && !j.claims.length) dropJob(st, j);
      },
    },
    // ---- each day, at midnight: the households, the land ----
    {
      every: 'day',
      owner: 'sim/help',
      note: 'kin and the village give food to the short',
      run: (st) => {
        short = shareFood(st);
      },
    },
    {
      every: 'day',
      owner: 'sim/hunger',
      note: 'the fire burns wood (a house without is cold), meals, grain and ale spoil',
      run: (st, c) => {
        for (const liveId of st.liveHouseholds) {
          const hh = st.households[liveId];
          if (hh.dissolved) continue;
          feedHousehold(st, hh, c.season); // the day's fire first, then the meal (VB-327: the cold reaches health)
          spoilGrain(st, hh);
          Stores.spoilAle(st, hh);
        }
      },
    },
    {
      every: 'day',
      when: (st) => st.journeys.length > 0,
      owner: 'sim/agents',
      note: 'those on the road eat what they carry (VB-287)',
      run: (st) => feedTravellers(st),
    },
    { every: 'day', owner: 'sim/stores', note: 'the village store spoils too', run: (st) => Stores.villageDay(st) },
    { every: 'day', owner: 'sim/forest', note: 'trees grow', run: (st) => growTrees(st) },
    {
      every: 'day',
      owner: 'sim/spread',
      note: 'the forest spreads into open land it borders, unless kept open (VB-091)',
      run: (st) => spreadForest(st),
    },
    {
      every: 'day',
      owner: 'sim/claims',
      note: 'unworked claims lapse, and the stakes and farm claims on them',
      run: (st) => {
        const lapsed = lapseClaims(st);
        lapsedStakes(st, lapsed);
        lapsedFarmClaims(st, lapsed);
      },
    },
    {
      every: 'day',
      owner: 'sim/paths',
      note: 'paths fade; a changed stage changes the cost of walking it',
      run: (st) => fadeWear(st, (tile) => costChanged(st, tile)),
    },
    { every: 'day', owner: 'sim/routes', note: 'cached routes refreshed', run: (st) => refreshRoutes(st) },
    {
      every: 'day',
      owner: 'sim/fields',
      note: 'crops grow, weeding falls due, untended fields go wild',
      run: (st, c) => fieldsDay(st, c),
    },
    {
      every: 'year',
      at: FROST,
      owner: 'sim/fields',
      note: 'the autumn frost takes the crops still out',
      run: (st) => fieldsFrost(st),
    },
    {
      every: 'day',
      owner: 'sim/clock',
      note: 'empty farms decay, about 8% a year',
      run: (st) => {
        // not while a claimant mends the farm (VB-033); a house held in trust stands empty and decays as an empty farm's (VB-309)
        for (const f of st.farmsteads)
          if ((f.household === null || trustOf(st, f.household)) && !VB['sim/projects'].onFarm(st, f.id)) {
            // its restoration (VB-123)
            f.condition = Math.max(0, (f.condition ?? 1) - 0.08 / YEAR_DAYS);
            if (f.state === 'derelict' && f.condition < 0.15) {
              f.state = 'ruin';
              st.visualDirty = true;
            }
          }
      },
    },
    {
      every: 'day',
      owner: 'sim/clock',
      note: 'fences decay',
      run: (st, c) => {
        const decay = st.ECON.fenceDecay[c.season];
        for (const v of st.villages) for (const s of v.fence) decayFence(st, s, decay);
        for (const f of st.farmsteads) for (const s of f.fence || []) decayFence(st, s, decay);
      },
    },
    // ---- the animals ----
    {
      every: 'day',
      owner: 'sim/herds',
      note: 'a new grazing spot for a herd whose old one was built on',
      run: (st, c) => herdsDay(st, c),
    },
    {
      every: 'year',
      at: { doy: HERD.springDay },
      owner: 'sim/herds',
      note: 'spring: the animals age, die, calve and lamb',
      run: (st) => spring(st),
    },
    {
      every: 'year',
      at: { doy: HERD.shear },
      owner: 'sim/byre',
      note: 'summer day 1: the sheep are shorn',
      run: (st) => shearing(st),
    },
    { every: 'year', owner: 'sim/meadows', note: 'the meadows are grass again', run: (st) => meadowsSpring(st) },
    {
      every: 'year',
      at: FROST,
      owner: 'sim/meadows',
      note: 'the autumn frost rots hay still lying',
      run: (st) => meadowsFrost(st),
    },
    {
      every: 'day',
      owner: 'sim/byre',
      note: 'food spoils, manure rots, the stalled herds eat their hay',
      run: (st, c) => byreDay(st, c),
    },
    {
      every: 'year',
      at: { season: 0, sday: FISH.from },
      owner: 'sim/drying',
      note: 'the ice is gone: households by the sea begin a boat (VB-300)',
      run: (st) => boatYear(st),
    },
    {
      every: 'year',
      at: { season: 1, sday: 0 },
      owner: 'sim/tar',
      note: 'summer: a village with pine and no tar pit has one dug (VB-301)',
      run: (st) => tarYear(st),
    },
    {
      every: 'year',
      at: { season: 3, sday: 0 },
      owner: 'sim/carts',
      note: 'the winter begins: a head short of carts in the year has one built',
      run: (st) => cartsYear(st),
    },
    {
      every: 'year',
      at: { doy: HERD.countDay },
      owner: 'sim/byre',
      note: 'the autumn count: what goes to slaughter',
      run: (st) => autumnCounts(st),
    },
    {
      every: 'day',
      owner: 'sim/byre',
      note: 'cattle left unherded yesterday may stray into a crop (VB-136)',
      run: (st, c) => strays(st, c),
    },
    {
      every: 'day',
      owner: 'sim/grazing',
      note: 'every herd back by its farm for the night (VB-136)',
      run: (st) => herdsBack(st),
    },
    { every: 'year', owner: 'sim/grazing', note: 'the grazing pressure halves (VB-136)', run: (st) => halveGraze(st) },
    {
      every: 'year',
      owner: 'sim/deer',
      note: "the forest edges counted again: each region's capacity for roe deer (VB-139)",
      run: (st) => recount(st),
    },
    {
      every: 'day',
      owner: 'sim/deer',
      note: 'the roe deer graze the forest edges (VB-139)',
      run: (st, c) => deerGraze(st, c),
    },
    {
      every: 'day',
      when: (st, c) => c.season === 1,
      owner: 'sim/deer',
      note: 'in summer, roe deer may get into a crop by a wood through a broken fence (VB-139)',
      run: (st) => browseCrops(st),
    },
    // ---- the people ----
    {
      every: 'day',
      when: cenv,
      owner: 'sim/lifecycle',
      note: "ages, coming of age, orphans, the day's ties",
      run: (st) => dailyLife(st),
    },
    {
      every: 'season',
      when: cenv,
      owner: 'sim/relations',
      note: 'faded memories forgotten, ties to the dead dropped',
      run: (st) => fadeRelations(st),
    },
    {
      every: 'day',
      when: (st) => !!st.cenv && !!st.naturalDeaths,
      owner: 'sim/lifecycle',
      note: 'the death rolls',
      run: (st) => dailyDeaths(st),
    },
    { every: 'day', when: cenv, owner: 'sim/births', note: 'births', run: (st) => dailyBirths(st) },
    {
      every: 'day',
      when: cenv,
      owner: 'sim/lifecycle',
      note: 'marriage offers due close (VB-293)',
      run: (st) => dueOffers(st),
    },
    {
      every: 'day',
      when: (st) => !!st.cenv && short.length > 0,
      owner: 'sim/service',
      note: 'the short of people taken in (VB-308)',
      run: (st) => takeIn(st, short),
    },
    // autumn day 9 from noon (sday 8), before the meetings of day 10 whose tie may read the table (VB-290): a village a step (VB-286)
    {
      every: 'year',
      at: { season: AUTUMN, sday: 8, hour: 12, tick: [0, ROW_STEPS] },
      owner: 'sim/routes',
      note: 'the walking hours between villages, a row a step (VB-286)',
      run: (st, c, n) => refreshHoursStep(st, n - 12 * TICKS),
    },
    {
      every: 'year',
      at: { season: AUTUMN, sday: 9 },
      when: cenv,
      owner: 'sim/occasions',
      note: "the meeting's people called to the green (VB-126)",
      run: (st) => callMeetings(st),
    },
    // ---- the year ----
    { every: 'year', owner: 'sim/clock', note: 'the year begins: its weather', run: (st, c) => newYear(st, c) },
    {
      every: 'year',
      owner: 'sim/stores',
      note: 'ledgers of dissolved households expire',
      run: (st) => Stores.prune(st),
    },
    {
      every: 'year',
      owner: 'sim/records',
      note: "the record's fold of past years begins (VB-199)",
      run: (st) => startFold(st),
    },
    {
      every: 'day',
      owner: 'sim/records',
      note: 'the fold goes on, a slice a day (VB-199)',
      run: (st) => foldHistory(st),
    },
    // ---- each step ----
    {
      every: 'step',
      owner: 'sim/occasions',
      note: 'those asked set out, and occasions end (VB-126)',
      run: (st) => occasionsDue(st),
    },
    {
      every: 'step',
      at: { tick: [1, NIGHT_STEPS + 1] },
      when: cenv,
      owner: 'sim/lifecycle',
      note: "the night's culture, a settlement a step (VB-201)",
      run: (st, c, n) => nightCulture(st, n),
    },
    // ---- autumn: the meetings' stages from noon of day 10 (customs, then the outland; VB-206), the moving round's from noon of day 11:
    // a village a step, then its three island-wide phases from 18:00 (VB-201, VB-277) ----
    ...Array.from({ length: MEETING_STAGES }, (_, r) => ({
      every: 'year',
      at: { season: AUTUMN, sday: 9, hour: 12, tick: r },
      when: cenv,
      owner: 'sim/lifecycle',
      note: `the meetings, stage ${r}`,
      run: (st) => meetingStage(st, r),
    })),
    {
      every: 'year',
      at: { season: AUTUMN, sday: 10, hour: 12, tick: [0, ROUND_STEPS] },
      when: cenv,
      owner: 'sim/lifecycle',
      note: "the moving round: a village's round a step, then demand, settlement and service (VB-277)",
      run: (st, c, n) => roundPhase(st, n - 12 * TICKS),
    },
  ];
  function decayFence(st, s, decay) {
    const before = s.cond;
    s.cond = Math.max(0, s.cond - decay * (0.5 + rnd(st.rng.fences)));
    if (before >= 0.45 !== s.cond >= 0.45) s.dirty = true;
  }
  function newYear(st, c) {
    st.weather = 0.75 + rnd(st.rng.weather) * 0.45;
    const word = st.weather > 1.05 ? 'promises a good year' : st.weather < 0.88 ? 'looks poor' : 'looks ordinary';
    log(st, `Year ${c.year} begins. The weather ${word}.`, { kind: 'year', n: c.year });
  }
  // Compiled once: each entry's steps of the day as a mask, and its date. A malformed entry fails here, at load.
  const CADENCES = ['step', 'hour', 'day', 'season', 'year'],
    AT = ['hour', 'tick', 'season', 'sday', 'doy'];
  function span(x, hi, what, note) {
    const r = Array.isArray(x) ? x : [x, x + 1];
    if (!(
      r.length === 2 &&
      Number.isInteger(r[0]) &&
      Number.isInteger(r[1]) &&
      r[0] >= 0 &&
      r[0] < r[1] &&
      r[1] <= hi
    )) {
      throw new Error(`calendar: ${note}: ${what} ${JSON.stringify(x)} is not in 0 to ${hi - 1}`);
    }
    return r;
  }
  function compile(e) {
    const at = e.at || {},
      every = e.every,
      no = (k) => at[k] === undefined,
      bad = (why) => new Error(`calendar: ${e.note}: ${why}`);
    if (!CADENCES.includes(every)) throw bad(`no cadence ${every}`);
    if (typeof e.run !== 'function' || typeof e.owner !== 'string' || typeof e.note !== 'string')
      throw bad('an entry needs run, owner and note');
    for (const k of Object.keys(at)) if (!AT.includes(k)) throw bad(`no place at.${k}`);
    const dated = !no('season') || !no('sday') || !no('doy');
    if (dated && every !== 'season' && every !== 'year') throw bad('a date is for a season or a year entry');
    if (every === 'season' && (!no('season') || !no('doy'))) throw bad('a season entry takes sday only');
    if (every === 'year' && !no('doy') && (!no('season') || !no('sday'))) throw bad('doy, or season and sday');
    if (every === 'year' && no('season') !== no('sday')) throw bad('season and sday together');
    const steps = new Uint8Array(STEPS_A_DAY);
    if (every === 'step' && no('hour') && no('tick')) steps.fill(1);
    else if (every === 'hour' && no('hour')) {
      const [t0, t1] = span(at.tick ?? 0, TICKS, 'tick', e.note);
      for (let n = 0; n < STEPS_A_DAY; n++) if (n % TICKS >= t0 && n % TICKS < t1) steps[n] = 1;
    } else {
      const [h0, h1] = span(at.hour ?? 0, DAY, 'hour', e.note);
      const [t0, t1] = span(at.tick ?? 0, h1 - h0 > 1 ? TICKS : STEPS_A_DAY - h0 * TICKS, 'tick', e.note);
      for (let h = h0; h < h1; h++) for (let t = t0; t < t1; t++) steps[h * TICKS + t] = 1;
    }
    return Object.freeze({
      steps,
      run: e.run,
      when: e.when || null,
      bare: every === 'step' && !dated && !e.when,
      doy: every === 'year' && no('season') ? (at.doy ?? 0) : -1,
      season: every === 'year' ? (at.season ?? -1) : -1,
      sday: every === 'season' ? (at.sday ?? 0) : every === 'year' ? (at.sday ?? -1) : -1,
    });
  }
  const compiled = Object.freeze(CALENDAR.map(compile));
  for (const e of CALENDAR) {
    if (e.at) Object.freeze(e.at);
    Object.freeze(e);
  }
  Object.freeze(CALENDAR);
  // The table as rows, in order (tools/sim.js --report calendar, tests/clock.js): cadence, place, guard, owner, note.
  const place = (at) =>
    Object.entries(at || {})
      .map(([k, v]) => `${k} ${Array.isArray(v) ? `${v[0]}-${v[1] - 1}` : v}`)
      .join(', ');
  const calendarRows = () =>
    CALENDAR.map((e) => ({
      every: e.every,
      at: place(e.at),
      when: e.when ? 'guarded' : '',
      owner: e.owner,
      note: e.note,
    }));

  // ---- the clock (VB-235) ----
  // @state st.tick: integer >= 0; the 6-minute steps done since hour 0, the clock's source of truth: an hour begins when st.tick % TICKS
  //   is 0, and the hour, the day and the year the clock is working through are read from it (Math.floor(st.tick / TICKS) is the hour).
  // @state st.t is st.tick / TICKS, written here only.
  // Each 6-minute step that ends here runs the calendar's entries the step reached, in the table's order. The step of the day says what is
  // due, so a save between two steps goes on. Nothing is allocated but the step's date, once, when an entry reads it.
  function stepEnds(st) {
    const k = st.tick,
      hour = Math.floor(k / TICKS),
      n = mod(k, STEPS_A_DAY);
    let c = null;
    for (let i = 0; i < compiled.length; i++) {
      const e = compiled[i];
      if (!e.steps[n]) continue;
      if (e.bare) {
        e.run(st, null, n);
        continue;
      }
      if (c === null) c = cal(hour);
      if (
        (e.doy >= 0 && c.doy !== e.doy) ||
        (e.season >= 0 && c.season !== e.season) ||
        (e.sday >= 0 && c.sday !== e.sday)
      )
        continue;
      if (e.when !== null && !e.when(st, c)) continue;
      e.run(st, c, n);
    }
  }
  // The clock's arithmetic: moves st by `hours`, which must be whole 6-minute steps, a step at a time, calling each(st) after each. The
  // page keeps the part of a step its frames have asked for and draws the pawns between steps (VB-244), so a seed is the same run in the
  // page at any frame rate as headless. hours * TICKS is a float (0.7 * 10 is 7.000000000000001): it is taken as the whole number it is
  // meant to be, so a run is the same by any chunks of whole steps. Any other number of hours, or a negative one, is refused with an
  // error, not rounded (the orchestrator's choice for Kim, VB-244).
  function stepsIn(hours) {
    const x = hours * TICKS,
      n = Math.round(x);
    if (!(Math.abs(x - n) < 1e-6) || n < 0)
      throw new Error(`advance: ${hours} hours is not a whole number of 6-minute steps`);
    return n;
  }
  function ticking(st, hours, each) {
    for (let n = stepsIn(hours); n > 0; n--) {
      st.tick++;
      st.t = st.tick / TICKS;
      each(st);
    }
  }
  function step(st) {
    stepEnds(st);
    playerStep(st); // the player's queue goes before the pawn's own logic (VB-169)
    const c = cal(st.t),
      all = stepAgents(st, c),
      idle = st.player ? all.filter((a) => !unplanned(st, a.id)) : all;
    if (idle.length) {
      const got = planRound(st, idle, c);
      // those the plan's tasks did not employ look at the household's opportunities, and are matched again (VB-249)
      const looked =
        got.size < idle.length
          ? lookForWork(
              st,
              idle.filter((a) => !got.has(a)),
              c,
            )
          : [];
      if (looked.length) for (const a of planRound(st, looked, c)) got.add(a);
      for (const a of idle) if (!got.has(a)) idleAbout(st, a);
    }
  }
  const advance = (st, hours) => ticking(st, hours, step);
  return { CALENDAR, calendarRows, advance, ticking, stepsIn };
})();
