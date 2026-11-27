// @sys sim: the public Sim object, assembled from the sim/* modules
const Sim = (() => {
  const Culture = VB['culture'];
  const { cal, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ECON, TRAVEL, WORK, dark } = VB['sim/rules'],
    { ROLES } = VB['sim/roles'],
    { RIVER, byRiver } = VB['sim/crops'],
    { SEASONS } = VB['sim/weather'];
  const { KINDS } = VB['sim/kinds'];
  const {
    age,
    birthYear,
    fullName,
    spouseOf,
    childrenOf,
    siblingsOf,
    spousesOf,
    kinship,
    kinDegree,
    villageOf,
    practice,
    farmPractice,
    isHolder,
    holdingOf,
    settlementIdOf,
    membersOf,
    voiceOf,
  } = VB['sim/records'];
  const {
    recordOf,
    NOTABLE,
    notable,
    eventLine,
    CHRONICLE,
    chronicle,
    villageLog,
    SKIP,
    skipFrom,
    skipStop: skipStopWith,
    gatherings,
  } = VB['sim/notable'];
  const { describe: doing } = VB['sim/agents'],
    { occasionLabel } = VB['sim/occasions'],
    { explainFeast } = VB['sim/feast'],
    { line: pastimeLine, of: pastimeOf } = VB['sim/pastimes'];
  // What a pawn is doing, for its card: at or on its way to an occasion (VB-126), else as sim/agents tells it.
  // its pastime and with whom (sim/pastimes, VB-1552),
  const describe = (st, id) => occasionLabel(st, st.agents[id]) || pastimeLine(st, id) || doing(st, id);
  const { explainIdle, idleLine } = VB['sim/fit'];
  const { levyOf, hours } = VB['sim/levies'];
  const { line: thirstLine } = VB['sim/thirst'];
  const { reasonOf, reasonLine } = VB['sim/reasons']; // who chose a pawn's act, and why, for its card (VB-1551)
  const { seedReserve } = VB['sim/hunger'],
    { grainOf } = VB['sim/stores'],
    { shareOwed } = VB['sim/obligations'];
  const { fieldView } = VB['sim/rotations'];
  const { fieldsWanted, harvestEstimate } = VB['sim/fieldplans'],
    { tilthOf, wetFactor, ditchOf } = VB['sim/soil'];
  const { plotProgress } = VB['sim/expansion'];
  const { ownerOf, setOwner } = VB['sim/ownership'];
  const { heirRanking } = VB['sim/heirranking'],
    { wantsOut, refreshRoles, countDemand } = VB['sim/heirs'];
  const { updateTies, refreshInterests, hooks, standingParts } = VB['sim/society'];
  const { planView, fireView } = VB['sim/planview']; // the plan's and the fire's reads (VB-1646, VB-1653)
  const { sleepOf } = VB['sim/sleep']; // the played pawn's sleep owed, for the page (VB-1643)
  const { of: moodOf, word: moodWord } = VB['sim/mood']; // a pawn's mood and its modifiers, for its card (VB-062)
  const { labelsOf: traitLabels, act: traitAct } = VB['sim/traits']; // a pawn's traits in words, for its card (VB-519); one's act (VB-520)
  const { save, load } = VB['sim/saves'];
  // Sim.command(st, cmd): the one door a controller issues through (VB-1757), keyed by the pawn it acts as (cmd.actor), each command
  // recorded with its game time (sim/controller, st.commanded); Sim.decisions(st, pawn), the points open to its controller (sim/points)
  const { command } = VB['sim/controller'],
    { decisions } = VB['sim/points'];
  const { inhabit, uninhabit, queue, unqueue, setAuto, wish, answer, head, sheetNotes } = VB['sim/player'];
  const { controlOf } = VB['sim/controller']; // a pawn's switch, queue and last refusal (VB-1745)
  const { headView } = VB['sim/plans'];
  const { timetable, callCost, taskLeft, taskFrom, taskStop } = VB['sim/timetable'];
  const { wishesOf } = VB['sim/wishes']; // a pawn's wish at the moving round, kind by kind (VB-680)
  const { actorView, forPawn, successor, succeed, roundChoice } = VB['sim/opportunities'];
  const { visitState, orderVisit } = VB['sim/visits']; // a pawn's visit, planned or under way, and the played pawn's order for one (VB-292)
  const { villageSummary, villageOutlookOf, OVERVIEW } = VB['sim/overview']; // a village at a glance, for its card and tools/sim.js (VB-162)
  const { meansOf, marryBar } = VB['sim/matching']; // the means to marry a home holds, and what stands between a pawn and a marriage (VB-631)
  const { waterOf, siteWater } = VB['sim/water']; // a farm's source and its day's fetch in hours (VB-1582); a site's, before placing (VB-1583)
  const { supplyOutlook, giftOutlook } = VB['sim/outlook']; // how long a household's supplies last, by its head's last review (VB-666)
  // The skip's stop (VB-1101): sim/notable asks, at the round's eve, for a choice the round will read and for the year's food in brief.
  const skipAids = {
    choice: roundChoice,
    brief(st, vid) {
      if (vid === null) return '';
      const s = villageSummary(st, vid);
      return `the last harvest ${Math.round(s.harvest.rations)} rations, the village's food lasts ${Math.round(s.food.days)} days`;
    },
  };
  const skipStop = (st, from) => skipStopWith(st, from, skipAids);
  // What a pawn may do here (and at tile `near`), read through its actor view (sim/opportunities).
  const opportunities = (st, id, near = null) => forPawn(st, actorView(st, id), id, near);
  // The plan record (VB-1752; sim/steps), read through the actor view: why(st, task), the chain of steps above a task, the one that
  // opened it first; plans(st, {kind, id}), a body's record, a copy, with its agent (the head, the alderman, the pawn itself).
  const Steps = VB['sim/steps'];
  const why = (st, j) => Steps.chain(actorView(st), j);
  function plans(st, body) {
    const view = actorView(st),
      r = Steps.recordOf(view, body);
    if (r)
      r.agent =
        body.kind === 'household'
          ? (view.households[body.id].holder ?? null)
          : body.kind === 'village'
            ? (VB['sim/decisions'].agentOf(view, body.id) ?? null)
            : body.id;
    return r;
  }
  const { compat, bond, bondWord, opinionOf, opinionWord, relationsOf, reasonsOf, goodwillOf } = VB['sim/relations'];
  const { heard } = VB['sim/stories']; // what a pawn has heard, as its belief (VB-554)
  const { explainAllowance, giftWarning } = VB['sim/exchange'];
  const { kinHouseholds } = VB['sim/help'];
  // Who of household hh may carry a gift of its holder's to household `to` (VB-1111): its members the verb `give` takes as the carrier,
  // by the verb's own check (sim/offers giftOf), the holder first, then the others by id; none within one farmstead, where nothing is carried.
  const giftCarriers = (st, hh, to) =>
    [hh.holder, ...hh.members.filter((id) => id !== hh.holder)].filter(
      (id) =>
        id !== null &&
        typeof VB['sim/offers'].giftOf(st, hh.holder, to, { good: 'grain', n: 1, carrier: id }, 'player') !== 'string',
    );
  // The facade's direct mutators are debug (VB-681): the world's hand, for the page's debug drawer and the tests, never a pawn's act; a
  // pawn acts by a verb (command, queue, head), whose check asks its right. tests/commands.js holds that none is a verb and that the page
  // calls them only from its drawer.
  // The world's rules run out of turn (refreshRoles, updateTies, refreshInterests, countDemand: the clock runs them) are its hand too (VB-1756).
  const DEBUG = [
    'setOwner',
    'killPawn',
    'retireHolder',
    'holdMeetings',
    'movingRound',
    'refreshRoles',
    'updateTies',
    'refreshInterests',
    'countDemand',
  ];
  const { killPawn, retireHolder } = VB['sim/lifecycle'],
    { holdMeetings } = VB['sim/meetings'],
    { movingRound } = VB['sim/round'];
  const { seed } = VB['sim/scenarios'];
  const { advance } = VB['sim/clock'];
  // Sim.replay(st, entries): the commands recorded since a save (entries of st.commanded, in order: a run's own record past the length the
  // saved state's had), given again on st, the save loaded, each at its game time, the clock advanced to it (VB-1757). The run then goes
  // on as it went, its record again the same. The frame (which pawn is played: Sim.inhabit, uninhabit, succeed), the debug drawer's
  // direct mutators and the page's flags are not commands and are not recorded: a run that changed them since the save is not replayed.
  function replay(st, entries) {
    for (const e of entries) {
      if (e.tick < st.tick) throw new Error(`replay: a command at tick ${e.tick}, the run at ${st.tick}`);
      advance(st, (e.tick - st.tick) / TICKS);
      command(st, JSON.parse(JSON.stringify(e.cmd)));
    }
    return st;
  }
  const { HERD, CLAIMS, TICKS } = VB['sim/rules'],
    { SOIL } = VB['sim/crops'];
  const { herdsOf, dailyHay, winterNeed, stalled, years, describeHerds, herdReport, team, inMilk } = VB['sim/herds'];
  const { withOxen } = VB['sim/work'],
    { placeOf, poseOf } = VB['sim/pose'];
  const { larderOf } = VB['sim/larder'];
  const { yearsLeft: quernYears } = VB['sim/quern']; // VB-009: a household's quern, years left
  const { boothCondition, stakedEach } = VB['sim/building'], // VB-784: a booth's condition now
    { houseTarred } = VB['sim/house'],
    { untarred: boatUntarred } = VB['sim/drying']; // VB-301: a house tarred, a boat's years since its tarring
  const { claimsOn, strength, holdings } = VB['sim/claims'];
  const { knows: knowsDeposit, known: depositKnown } = VB['sim/prospect'];
  const { left: depositLeftNow } = VB['sim/dig']; // VB-359: loads left now, bog iron grown back
  const { woodOf } = VB['sim/territory'];
  const { offerPreview, foodDays } = VB['sim/preview']; // what a yes to an offer would bring, and a household's food in days (VB-1100)
  const { fairSides, swapTerms } = VB['sim/fair']; // the fair the played pawn is at, and a swap's terms, for its dialog (VB-303)

  return {
    seed,
    landing: VB['sim/landing'],
    advance,
    save,
    load,
    recordOf,
    command,
    decisions,
    replay,
    DEBUG,
    head, // (st, pawn, verb, args): the pawn's choice as head (VB-1746: keyed by pawn, as each planning call below)
    headView,
    timetable, // a household's day laid end to end, each task a range by the viewer's estimate (VB-477)
    callCost, // what calling a member off costs: its walk home and the load it leaves (VB-477)
    taskLeft, // a pawn's task in hand: its share done, exact, and the hours left by a viewer's estimate (VB-477)
    taskFrom, // where a run until the inhabited pawn's task ends begins, and its own stops (VB-477): the page's skip adds them
    taskStop,
    inhabit,
    sheetNotes,
    uninhabit,
    queue, // (st, pawn, cmd)
    unqueue, // (st, pawn, i)
    setAuto, // (st, pawn, on)
    controlOf,
    wish, // (st, pawn, kind, value, opts)
    wishesOf,
    opportunities,
    offerPreview,
    fairSides,
    swapTerms,
    foodDays,
    successor,
    villageSummary,
    OVERVIEW,
    supplyOutlook,
    waterOf,
    siteWater,
    giftOutlook,
    harvestEstimate,
    villageOutlook: villageOutlookOf,
    succeed,
    cal,
    age,
    birthYear,
    fullName,
    spouseOf,
    childrenOf,
    siblingsOf,
    spousesOf, // everyone a pawn has been married to, by sim/records' index (VB-095: the family tree)
    kinship,
    kinDegree,
    describe,
    pastimeOf,
    villageOf,
    SEASONS,
    DAY,
    YEAR,
    YEAR_DAYS,
    SEASON_DAYS,
    ECON,
    TRAVEL,
    ROLES,
    KINDS,
    WORK,
    dark,
    killPawn, // debug (DEBUG)
    retireHolder, // debug (DEBUG)
    holdMeetings, // debug (DEBUG)
    movingRound, // debug (DEBUG)
    heirRanking,
    practice,
    farmPractice,
    wantsOut,
    countDemand,
    isHolder,
    holdingOf,
    standingParts,
    moodOf,
    sleepOf,
    // (st, pawn, op, args): pawn's verb `plan` on its own plan (VB-1754; sim/plans, its ops sim/controller's PLAN_OPS), a facade
    plan: (st, id, op, args) =>
      Number.isInteger(id) && st.pawns[id]
        ? command(st, {
            actor: id,
            verb: 'plan',
            target: { kind: 'pawn', id },
            args: { ...(args || {}), op },
            source: 'player',
          })
        : `there is no pawn ${id}`,
    planView, // (st, pawn)
    fireView, // (st, pawn)
    waits: VB['sim/controller'].waitsOf, // (st, pawn): why each task of the pawn's plan waits, and why the plan is idle (VB-1651)
    moodWord,
    traitLabels,
    traitAct,
    settlementIdOf,
    membersOf,
    voiceOf,
    hooks,
    refreshInterests,
    updateTies,
    refreshRoles,
    Culture,
    ownerOf,
    setOwner, // debug (DEBUG)
    seedReserve,
    grainOf,
    shareOwed,
    fieldsWanted,
    fieldView, // a field as its tile's card shows it, with the head's choices (VB-355)
    plotProgress, // a task's progress now (VB-472)
    placeOf, // a pawn's place now, a walker's worked out from its leg (VB-473)
    poseOf, // and its facing and stride, for the page until it draws from legs (VB-474)
    explainIdle,
    idleLine,
    levyOf, // the hours a day a member owes its household by its levy (VB-1760)
    hours, // a pawn's days: the six parts of its working hours, the six behind exact, and its sovereignty (VB-1761)
    thirstLine,
    reasonOf,
    reasonLine,
    why,
    plans,
    agenda: VB['sim/agenda'].agenda, // (st, pawn): the pawn's queue and open work against their deadlines (VB-1644), its plan laid into days (VB-1647)
    planGaps: VB['sim/agenda'].planGaps, // (st, pawn): the windows that press with no task of the plan covering them (VB-1650)
    RIVER,
    byRiver,
    wetFactor, // the share of a field's fertility its wetness and ditch leave now (VB-721): the field's card
    ditchOf, // a field's ditch now, 0 to 1, closed form (VB-721)
    tilthOf, // a field's tilth now, closed form (VB-717): the field, farm and village cards (VB-719)
    compat,
    bond, // what b is to a: spouse, parent, child, sibling, housemate or null (the page's bond badges, VB-1026)
    bondWord,
    opinionOf,
    opinionWord,
    relationsOf,
    heard,
    reasonsOf,
    meansOf,
    marryBar,
    HERD,
    SOIL,
    herdsOf,
    dailyHay,
    winterNeed,
    stalled,
    years,
    describeHerds,
    herdReport,
    larderOf,
    quernYears,
    houseTarred,
    boothCondition,
    // VB-1172: the tiles of the booths staked and not yet raised (each its maker's plan), for the page's ring of stakes; and (VB-1666)
    // the house tiles of the farms whose shelter is being raised (farmstead.shelter, built null), after them
    stakedBooths: (st) => {
      const out = [];
      stakedEach(st, (plan) => out.push(plan.tile));
      for (const f of st.farmsteads) if (f.shelter && f.shelter.built === null) out.push(f.house);
      return out;
    },
    // VB-1655: the build menu, what the played head may build now, and why a tile will not take one (sim/camp); reads only
    buildMenu: VB['sim/agenda'].buildMenu, // (st, pawn): sim/camp's menu with each entry's `work`, the plan's estimate (VB-1658)
    placeWhy: VB['sim/camp'].placeWhy, // (st, pawn, what, tile)
    moveCost: (st, pawn, tile) => VB['sim/camp'].moveCost(st, pawn, tile, VB['sim/weather'].frostExpected(st)), // VB-1667
    farmView: VB['sim/ladder'].farmView, // VB-1659: what stands at a farm, what is being built, what could follow (sim/ladder); reads only
    boatUntarred,
    team,
    withOxen,
    inMilk,
    claimsOn,
    claimStrength: strength,
    holdings,
    CLAIMS,
    knowsDeposit,
    depositKnown,
    goodwillOf,
    explainAllowance,
    inScope: VB['sim/scopes'].inScope, // a scope's pawns, households, villages, tiles and stores (VB-043)
    storesOf: VB['sim/scopes'].storesOf, // the stores of a scope's households, a row each and their total (VB-092)
    explainFeast, // why a household does or does not lay out a feast (VB-458)
    depositLeftNow,
    woodOf,
    giftWarning,
    giftCarriers,
    kinHouseholds,
    NOTABLE,
    notable,
    eventLine,
    CHRONICLE,
    chronicle,
    villageLog,
    SKIP,
    skipFrom,
    skipStop,
    gatherings, // the occasions that concern a pawn, as they begin (VB-1031)
    answer,
    orderVisit,
    visitState,
  };
})();
VB['sim'] = Sim;
if (typeof globalThis !== 'undefined') globalThis.Sim = Sim; // the page script reads it; the bundle (VB-374) keeps the const local
if (typeof module !== 'undefined') module.exports = Sim;
