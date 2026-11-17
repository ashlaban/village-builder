// @sys sim: the public Sim object, assembled from the sim/* modules
const Sim = (() => {
  const Culture = VB['culture'];
  const { cal, SEASONS, DAY, YEAR, YEAR_DAYS, SEASON_DAYS, ECON, ROLES, WORK, dark, RIVER, byRiver } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'];
  const {
    age,
    birthYear,
    fullName,
    spouseOf,
    childrenOf,
    siblingsOf,
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
  const { recordOf, NOTABLE, notable, eventLine, CHRONICLE, chronicle, villageLog, SKIP, skipFrom, skipStop } =
    VB['sim/notable'];
  const { describe: doing } = VB['sim/agents'],
    { occasionLabel } = VB['sim/occasions'];
  // What a pawn is doing, for its card: at or on its way to an occasion (VB-126), else as sim/agents tells it.
  const describe = (st, id) => occasionLabel(st, st.agents[id]) || doing(st, id);
  const { explainIdle, idleLine } = VB['sim/jobs'];
  const { seedReserve } = VB['sim/hunger'],
    { grainOf } = VB['sim/stores'];
  const { fieldsWanted } = VB['sim/fields'];
  const { plotProgress } = VB['sim/expansion'];
  const { ownerOf, setOwner } = VB['sim/ownership'];
  const { heirRanking, wantsOut, refreshRoles, countDemand } = VB['sim/heirs'];
  const { updateTies, refreshInterests, hooks, prestigeParts } = VB['sim/society'];
  const { of: moodOf, word: moodWord } = VB['sim/mood']; // a pawn's mood and its modifiers, for its card (VB-062)
  const { labelsOf: traitLabels, act: traitAct } = VB['sim/traits']; // a pawn's traits in words, for its card (VB-519); one's act (VB-520)
  const { save, load } = VB['sim/saves'];
  const { issue: command, inhabit, uninhabit, queue, unqueue, setAuto, wish, answer, head } = VB['sim/commands'];
  const { headView } = VB['sim/plans'];
  const { wishesOf } = VB['sim/wishes']; // a pawn's wish at the moving round, kind by kind (VB-680)
  const { actorView, forPawn, successors, succeed } = VB['sim/opportunities'];
  const { villageSummary, OVERVIEW } = VB['sim/overview']; // a village at a glance, for its card and tools/sim.js (VB-162)
  const { supplyOutlook } = VB['sim/outlook']; // how long a household's supplies last, by its head's last review (VB-666)
  // What a pawn may do here (and at tile `near`), read through its actor view (sim/opportunities).
  const opportunities = (st, id, near = null) => forPawn(st, actorView(st, id), id, near);
  const { compat, standingWord, opinionOf, opinionWord, relationsOf, reasonsOf, goodwillOf } = VB['sim/relations'];
  const { explainAllowance, giftWarning } = VB['sim/exchange'];
  const { kinHouseholds } = VB['sim/help'];
  const { killPawn, holdMeetings, movingRound, retireHolder } = VB['sim/lifecycle'];
  const { seed } = VB['sim/scenarios'];
  const { advance } = VB['sim/clock'];
  const { HERD, SOIL, CLAIMS } = VB['sim/rules'];
  const { herdsOf, dailyHay, winterNeed, stalled, years, describeHerds, herdReport, team, inMilk } = VB['sim/herds'];
  const { withOxen, doneOf, placeOf, poseOf } = VB['sim/agents'];
  const { larderOf } = VB['sim/hunger'];
  const { yearsLeft: quernYears } = VB['sim/quern']; // VB-009: a household's quern, years left
  const { houseTarred } = VB['sim/rules'],
    { untarred: boatUntarred } = VB['sim/drying']; // VB-301: a house tarred, a boat's years since its tarring
  const { claimsOn, strength, holdings } = VB['sim/claims'];
  const { knows: knowsDeposit, known: depositKnown } = VB['sim/prospect'];
  const { left: depositLeftNow } = VB['sim/dig']; // VB-359: loads left now, bog iron grown back
  const { woodOf } = VB['sim/territory'];

  return {
    seed,
    advance,
    save,
    load,
    recordOf,
    command,
    head,
    headView,
    inhabit,
    uninhabit,
    queue,
    unqueue,
    setAuto,
    wish,
    wishesOf,
    opportunities,
    successors,
    villageSummary,
    OVERVIEW,
    supplyOutlook,
    succeed,
    cal,
    age,
    birthYear,
    fullName,
    spouseOf,
    childrenOf,
    siblingsOf,
    kinship,
    kinDegree,
    describe,
    villageOf,
    SEASONS,
    DAY,
    YEAR,
    YEAR_DAYS,
    SEASON_DAYS,
    ECON,
    ROLES,
    KINDS,
    WORK,
    dark,
    killPawn,
    retireHolder,
    holdMeetings,
    movingRound,
    heirRanking,
    practice,
    farmPractice,
    wantsOut,
    countDemand,
    isHolder,
    holdingOf,
    prestigeParts,
    moodOf,
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
    setOwner,
    seedReserve,
    grainOf,
    fieldsWanted,
    plotProgress: (st, plot) => plotProgress(st, plot, (j) => doneOf(st, j)), // a task's progress now (VB-472)
    placeOf, // a pawn's place now, a walker's worked out from its leg (VB-473)
    poseOf, // and its facing and stride, for the page until it draws from legs (VB-474)
    explainIdle,
    idleLine,
    RIVER,
    byRiver,
    compat,
    standingWord,
    opinionOf,
    opinionWord,
    relationsOf,
    reasonsOf,
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
    depositLeftNow,
    woodOf,
    giftWarning,
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
    answer,
  };
})();
VB['sim'] = Sim;
if (typeof globalThis !== 'undefined') globalThis.Sim = Sim; // the page script reads it; the bundle (VB-374) keeps the const local
if (typeof module !== 'undefined') module.exports = Sim;
