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
  const { line: thirstLine } = VB['sim/thirst'];
  const { reasonOf, reasonLine } = VB['sim/reasons']; // who chose a pawn's act, and why, for its card (VB-1551)
  const { seedReserve } = VB['sim/hunger'],
    { grainOf } = VB['sim/stores'],
    { shareOwed } = VB['sim/obligations'];
  const { fieldView } = VB['sim/rotations'];
  const { fieldsWanted, harvestEstimate } = VB['sim/fieldplans'],
    { tilthOf } = VB['sim/soil'];
  const { plotProgress } = VB['sim/expansion'];
  const { ownerOf, setOwner } = VB['sim/ownership'];
  const { heirRanking } = VB['sim/heirranking'],
    { wantsOut, refreshRoles, countDemand } = VB['sim/heirs'];
  const { updateTies, refreshInterests, hooks, standingParts } = VB['sim/society'];
  const { of: moodOf, word: moodWord } = VB['sim/mood']; // a pawn's mood and its modifiers, for its card (VB-062)
  const { labelsOf: traitLabels, act: traitAct } = VB['sim/traits']; // a pawn's traits in words, for its card (VB-519); one's act (VB-520)
  const { save, load } = VB['sim/saves'];
  const { issue: command } = VB['sim/commands'];
  const { inhabit, uninhabit, queue, unqueue, setAuto, wish, answer, head, sheetNotes } = VB['sim/player'];
  const { headView } = VB['sim/plans'];
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
  const { compat, bond, bondWord, opinionOf, opinionWord, relationsOf, reasonsOf, goodwillOf } = VB['sim/relations'];
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
  const DEBUG = ['setOwner', 'killPawn', 'retireHolder', 'holdMeetings', 'movingRound'];
  const { killPawn, retireHolder } = VB['sim/lifecycle'],
    { holdMeetings } = VB['sim/meetings'],
    { movingRound } = VB['sim/round'];
  const { seed } = VB['sim/scenarios'];
  const { advance } = VB['sim/clock'];
  const { HERD, CLAIMS } = VB['sim/rules'],
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

  return {
    seed,
    landing: VB['sim/landing'],
    advance,
    save,
    load,
    recordOf,
    command,
    DEBUG,
    head,
    headView,
    inhabit,
    sheetNotes,
    uninhabit,
    queue,
    unqueue,
    setAuto,
    wish,
    wishesOf,
    opportunities,
    offerPreview,
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
    thirstLine,
    reasonOf,
    reasonLine,
    RIVER,
    byRiver,
    tilthOf, // a field's tilth now, closed form (VB-717): the field, farm and village cards (VB-719)
    compat,
    bond, // what b is to a: spouse, parent, child, sibling, housemate or null (the page's bond badges, VB-1026)
    bondWord,
    opinionOf,
    opinionWord,
    relationsOf,
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
    // VB-1172: the tiles of the booths staked and not yet raised (each its maker's plan), for the page's ring of stakes
    stakedBooths: (st) => {
      const out = [];
      stakedEach(st, (plan) => out.push(plan.tile));
      return out;
    },
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
