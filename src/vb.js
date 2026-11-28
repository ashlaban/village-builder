// @sys vb: module namespace and the convention for registering modules
// ===== Module namespace =====
// src/<path>.js registers as VB['<path>'] (e.g. src/sim/hex.js is VB['sim/hex']):
//   VB['sim/hex'] = (() => { ...; return { ... }; })();
// and reads what it needs at the top of its IIFE: const { bfs } = VB['sim/hex'];
// A module reads only modules listed before it in src/manifest.json. Grep a key to find the module and its users.
var VB = (globalThis.VB = globalThis.VB || {});
// Work measurements only: never part of st or an input to a simulation decision.
VB.COUNTERS = {
  methodAsk:
    "A task's next leg read from the world, at each leg's end or cut (sim/methods next, through sim/doing; VB-1775)",
  planRead: 'Members of a household read for those that plan for themselves (sim/steps plannersIn, VB-1834)',
  campLook: 'Households read each working hour for a camp left to itself (sim/upgrade ownRung, VB-1658)',
  letGoJobs:
    "Jobs read to see whether a field a household might let go has a task on it, on its head's planning day after the harvest " +
    '(sim/fieldplans letGoWhy, VB-768)',
  drainAsk:
    "Fields read by a head's yearly look at ditching a wet field, once a year a farm after the harvest (sim/drain bestField, VB-721)",
  facilityAsk: "An owner's facilities read on its planning day for their upkeep (sim/facilities offerUpkeep, VB-361)",
  loanComing:
    'Journeys looked over for the grain on its way to a household short of the harvest (sim/loans coming, VB-312)',
  tilthRead: "Reads of a field's tilth, at manuring and reaping only (sim/fields tilthOf, VB-717)",
  routeSearch: 'A* searches started',
  graphBuild:
    "Edges read to build the membership graph's live index, at its first use after a seed or load (sim/graph, VB-043)",
  graphScan:
    "Edges read back along st.edges for a pawn kept on a dissolved household's record that leaves it (sim/graph leave, VB-043)",
  passageRead:
    "Fields and meadows read by the day's sweep of passage on foot, once a day (sim/passage passageDay, VB-816)",
  visitNoRoute:
    "Visits that did not set out: no route within the search's reach from where the visitor stood (sim/visits, visitsDue; VB-436)",
  moveNoRoute:
    'Moves to a new home refused for want of a way by land between the two villages (sim/heirs, the move verb; VB-436)',
  routeExpand: 'Tiles removed from the A* heap (including duplicates)',
  routeHit:
    'Routes served from the cache, in either direction, or taken back from the routes set aside at its emptying (VB-1563)',
  routeRefresh: 'Cached routes tested for invalidation',
  reachSettled: 'Tiles settled by the searches of the walking hours between villages (sim/routes reachCosts, VB-286)',
  settleReach:
    "Tiles settled by a crowded village's search for new land within SETTLE.hours along a trail, one a round where someone " +
    'leads (sim/routes trailReach, VB-786)',
  routeEvict: 'Cached routes evicted to enforce the bound (including legacy loads)',
  routeCheck:
    'Changed tiles and cells read in testing a route set aside before it is taken back (sim/routes untouched, VB-1563)',
  gatherDrawn:
    'Partners drawn at a day of the gathering, read against the cap on new contacts (sim/encounters, VB-296)',
  gatherMet: 'New contacts made at the gathering (sim/encounters, VB-296)',
  splitCandidate: 'Cultures reported at the year as filling more than one gathering (sim/meetings, VB-296)',
  talkWeighed: 'Eligible partners weighed in talkHour',
  storyMade: 'Stories made, a witnessed event each (sim/stories, VB-523)',
  storyWeighed: 'Held stories weighed by a teller at its telling in a talk (sim/stories, VB-523)',
  storyTold: 'Stories told in a talk, believed or not (sim/stories, VB-523)',
  lieChance: 'Talk turns of a pawn with an enemy, a chance to make up a story each (sim/stories, VB-554)',
  lieInvented: 'Lies made up, by pawns and the player (sim/stories, VB-554)',
  lieExposed: 'Lies told to one who knew better (sim/stories, VB-554)',
  daysNamed:
    "Days of an outer levy named, by the levied head's rule, the verb name or the levier (sim/levies, VB-1767)",
  leviesLaid: 'Outer levies laid through the verb levy, a record a household (sim/levies, VB-1767)',
  leviesAsked: "Outer levies asked by their levier's default author at its season's turn (sim/levies ask, VB-1767)",
  leviesLooked:
    "Outer levies read at a day's first step, through the obligations' due-queue (sim/levies step, VB-1767)",
  leviesWeighed: 'Tasks of a household weighed for the windowed work a day named would displace (sim/levies, VB-1767)',
  routineWeighed:
    "Village tasks weighed for a routine's hours left, at its lots and at its work done (sim/routines, VB-1768)",
  routineLots:
    "A routine's levy split into its households' lots, a household weighed a round (sim/levies split, VB-1768)",
  routineMissed:
    "Days of a routine's levy on duty weighed at the day's turn for work not done (sim/levies step, VB-1768)",
  pointLevy: 'Outer levies read for the decision points of a pawn its controller asks for (sim/points, VB-1769)',
  outerCost: "A levied head's reckoning of what keeping a day of an outer levy costs, K (sim/levies costOf, VB-1769)",
  outerDayJudged:
    'Days of an outer levy come, judged by the levied head before it sends its adult (sim/levies keepDay, VB-1769)',
  ladderTried:
    'Days of an outer levy whose keeping cost passed its worth, the ladder tried (sim/levies keepDay, VB-1769)',
  daySubstituted: 'Days of an outer levy sent another adult through the verb substitute (sim/levies, VB-1769)',
  releaseAsked: "Asks for the release of an outer levy's day made by the levied head's rule (sim/levies, VB-1769)",
  releaseGranted: "Asks for an outer levy's day granted, by release or transfer (sim/levies, VB-1769)",
  dayReleased: "Days of an outer levy struck by its levier's agent through the verb release (sim/levies, VB-1769)",
  dayTransferred:
    "Days of an outer levy lent by its levier's agent to another household (sim/levies transfer, VB-1769)",
  dayCommuted: "Days of an outer levy paid in grain at the terms' rate through the verb commute (sim/levies, VB-1769)",
  dayBreached: 'Days of an outer levy breached by the levied head (sim/levies breach, VB-1769)',
  breachAnswered: "Breaches answered by the levier's agent at its planning day (sim/levies, VB-1769)",
  breachForgiven: "Breaches forgiven by the levier's agent through the verb forgive (sim/levies, VB-1769)",
  debtRelaid: "A debt's days left at its year's end laid again as a new year's levy (sim/levies, VB-1769)",
  obligationsDue: 'Obligations whose term ended at a step, taken off the due-queue (sim/obligations, VB-310)',
  asksRead: 'Open asks for a good passed by a head reading them, once a year a head (sim/asks, VB-699)',
  termsValued:
    'Households valued for a match offered, its dowry and its morning gift: two an offer (sim/terms, VB-276)',
  loanLenders:
    'Households and stores weighed as lenders by a household short after help, once a season, over its village (sim/loans, VB-312)',
  loansMade: 'Loans of grain made (sim/loans, VB-312)',
  loanLent: 'Grain lent, in rations (sim/loans, VB-312)',
  loanRepaid: 'Grain of loans repaid, in rations (sim/loans, VB-312)',
  loanDefaulted: 'Grain of loans defaulted, in rations unpaid after the second harvest (sim/loans, VB-312)',
  offerWeighed: 'Answers to an offer weighed by the pawn asked, at the due time (sim/offers, VB-690)',
  offersAnswered: 'Open offers answered at a village step of the moving round, a day of it each (sim/round, VB-692)',
  adviceOffered: 'Advice offered by a retired member to its head, at its spring planning day (sim/advice, VB-1316)',
  adviceTaken: 'Advice taken by a head and carried out (sim/advice, VB-1316)',
  adviceStanding: 'Members of a village read for its mean standing, an advice weighed (sim/advice weightOf, VB-1316)',
  adviceMatchWalk:
    "Entries of the asking queue read for a grandchild's match, a retired grandparent's advice (sim/advice, VB-1316)",
  askings: 'Askings held: a pawn who seeks, on its asking day once a season (sim/asking, VB-823)',
  asksMade: 'Offers made at an asking (sim/asking, VB-823)',
  asksNobody: 'Askings whose rungs found nobody to ask (sim/asking, VB-823)',
  asksWeighed:
    'Candidates weighed at an asking or an ask anew, by either side: at most ASK.pool a call (sim/asking askMatch, VB-823, VB-693)',
  askWalk:
    'Entries of the asking queue read for the unmarried of the other sex within reach, a match asked (sim/asking askMatch, VB-823)',
  visits: 'Visits arrived at the village visited (sim/visits, VB-289)',
  visitWalk:
    "Entries of the asking queue read for the unmarried women beyond a day's walk, a visit sought (sim/visits seekVisit, VB-289)",
  guestWalk:
    "Entries of the asking queue read at a village's round for the women who visited it (sim/matching poolFor, VB-292)",
  talkTurn:
    'Pawns asked by the talk round at their talk turn, every SOCIAL.talk.every waking hours (sim/relations, VB-521)',
  talkBucket: 'Living walked to rebuild the talk turns when the living changed (sim/relations, VB-521)',
  walkStep:
    'Legs a step takes from the due-queue as they end: walks and waits (sim/legs dueLegs, for sim/agents stepAgents; VB-473)',
  sleepReckon:
    'Pawns whose sleep owed was reckoned: each living pawn once an hour, the played pawn each step (sim/sleepers, VB-1645)',
  queueRun:
    'Queues run by the queue step: each step, one a pawn whose controller holds a command (sim/controller queueStep, VB-1745)',
  pointOffer:
    'Open offers looked at by Sim.decisions: each offer, a call a controller makes for its pawn (sim/points decisions, VB-1757)',
  planFeed:
    'Plans looked at by the feeder: each step, one a pawn whose controller holds a plan (sim/player playerStep, VB-1746)',
  sleepOwn:
    "Sleeps begun by a pawn's own rule, one that owed a whole night and was free in the working day (sim/sleepers, VB-1645)",
  walkAwake:
    "Pawn records looked at by the working day's start, for those waiting for it, once a day (sim/agents dayStart; VB-473)",
  idleStroll:
    'Pawns the planner found no work given their own time by ownTime: a pastime chosen, a route begun for its walk (VB-205, VB-1552)',
  visitWeighed:
    'Near kin and close friends looked at as ones to call on, in the choice of a pastime (sim/pastimes callers, VB-1552)',
  companyWeighed: 'Idle pawns drawn and weighed as company in companyFor (VB-205)',
  workReckon:
    'Tasks under work reckoned, with their hours since (sim/work settle: a hand joins or leaves, the end of work, the meal; VB-472)',
  walkPoint: 'Path points passed, their tiles trodden as a walk ends or is cut (sim/legs treadTo; VB-205, VB-473)',
  crowdScan: 'Passes over the farms to find the households near a house, at a membership change (VB-766)',
  walkPlace: 'Places worked out along a walk (placeOf of a walking pawn: talk, nearness, company, a cut; VB-473)',
  walkDaily: 'Pawn records walked by dailyLife and Attitudes.dailyStep',
  walkTies:
    "Ties walked to put a pawn's ties back on today's scale, or to make room under the cap (sim/relations, VB-127)",
  tiePairs:
    'Pairs given familiarity for waking hours at home (daily) or a job finished together (sim/relations, VB-127)',
  courtCheck: 'Good talks read for the start of a courtship: one check a good talk (sim/courting, VB-036)',
  courtWalk: 'Courting couples walked at the moving round: its review, and those a head refused (sim/courting, VB-036)',
  roundPairs:
    'Candidate man/woman pairs visited in the moving round: none since the round chooses nobody (VB-693; see asksWeighed)',
  kinPairs:
    "Free pawn and candidate pairs read by a village's kin pressure at the end of its round, each can() (sim/round kinPressure, VB-1170)",
  roundWalk: "Pawn records walked by a village's round to build its pool, once a village (sim/lifecycle, VB-277)",
  previewWalk:
    "Live households ranked for their first heir by an offer's preview, when the page shows it (sim/preview, VB-1100)",
  wishWalk: "Pawn records walked by the pawns' own choosing of their wishes, once a moving round (sim/wishes, VB-680)",
  gatherChoice: "Villages weighed as hosts by a village's choice of gathering, at its meeting (sim/gathering, VB-294)",
  gatherDisposition:
    "Counterparts of a village's holders read for the pull between villages, at its meeting (sim/gathering, VB-294)",
  gatherKin: "Kin households read for a village's choice of gathering, at its meeting (sim/gathering, VB-294)",
  gatherSettle: 'Hosts named and asked in the settling of the gatherings, once a year (sim/gathering, VB-294)',
  gatherPlan: "Members read by a household's plan of who goes to the gathering, once a year (sim/gathering, VB-295)",
  gatherLodge: 'Beds tried for the goers lodged at a gathering, once a year (sim/gathering, VB-295)',
  fairPack: "A good weighed for a dealer's load as it sets out for the gathering, once a year (sim/fair, VB-302)",
  fairWeigh:
    'A swap weighed by a dealer at the fair: the dealers present times their proposals, three days a year (sim/fair, VB-302)',
  meetingWalk:
    "Pawn records walked by a village's meeting: its living, and at the first village's the island's (sim/lifecycle, VB-278)",
  followerBonds:
    "A pawn's balances and followers read for its ties, at its lord's planning days after harvest (sim/followers, VB-708)",
  followerWalk: 'Steps up a chain of lords, to refuse a cycle (sim/followers, VB-708)',
  followerTies: 'Ties of a follower to a lord begun (sim/followers, VB-708)',
  patronDays:
    "Client households made to owe their patron's household its days, once a year each (sim/followers, VB-464)",
  patronWeighed:
    "Households of its village weighed for the richest patron by a hungry household's ask, a season (sim/help, VB-464)",
  followerFailed: 'Ties broken by a lord who refused his follower in need (sim/followers, VB-708)',
  aldermanBallots:
    "Voices times candidates weighed when a village's meeting elects its alderman: once a vacancy, never daily (sim/meetings, VB-314)",
  rotationWalk: "Farms walked by a village's meeting for its usual rotation, a village a year (sim/fields, VB-350)",
  overviewWalk:
    'Pawn records walked by a village overview, once a summary asked (a view, never a step: sim/overview, VB-162)',
  heirRank: 'All heirRanking calls, including nested rankings and indirect callers',
  storeWalk: 'Village stores and retained ledger entries visited for spoilage and pruning',
  recordFold: 'Record slots passed by the yearly fold of routine events (sim/records, VB-199)',
  ruleValue: 'Rule values read (explanations excluded)',
  oppAsk:
    "Calls of a kind's `available` rule: by the reviews of the plans, the due-queue and members looking for work (sim/jobs; VB-258, VB-249)",
  planReview:
    "Plans reviewed: on each holder's planning day, when a window closes or a store crosses a target (sim/plans; VB-258, VB-249)",
  planSteps:
    "Plan steps made: a household's season steps at each season's plan, a project's year step (sim/steps; VB-1752)",
  dayPair:
    "Member and task pairs weighed when a household's day is allotted: its members with the tasks of the household and its village " +
    "(sim/day, allot; VB-466), with a task slotted in and the household's own tasks at its review (reweigh, VB-1854)",
  dayLost:
    "Tasks of a member lost to its household's day (dead, ill, lent, on leave, away) slotted to the others (sim/day lostHolder, VB-1758)",
  dayRose:
    "Tasks a household's review made more urgent, slotted again into the day's lists as they stand (sim/day reweigh, VB-1854)",
  giveJudged:
    "A member's judgement read: a demand answered, a levied leg's start weighed for a take, its own hours weighed for giving " +
    '(sim/levies judgement, VB-1779, VB-1762)',
  giveLeg:
    "Legs of a member's own hours given to its household's or village's work by its judgement (sim/levies gives, VB-1762)",
  breachBooked:
    'Goodwill booked between a member and its head for hours demanded or taken, a ration at a time (sim/levies, VB-1779)',
  riskWeighed: 'Tasks of an allotment weighed for work at risk the levies leave unmanned (sim/day atRisk, VB-1779)',
  demandMade:
    'Demands past the levy made by a head of a member: its own at the allotment, an assign or a call (sim/day, VB-1779)',
  demandMet: 'Demands complied with (sim/day, VB-1779)',
  demandRefused: 'Demands refused, a memory of the head (sim/day, VB-1779)',
  breachTaken: 'Hours of the levy taken by a member for itself, a breach each (sim/day breach, VB-1779)',
  hoursBook: "Legs' ends whose working hours were booked into the six parts of a pawn's day (sim/levies book, VB-1761)",
  budgetReckoned:
    "Households' labour budgets reckoned: at the season's first review and when the members or the outer days change (sim/levies budget, VB-1778)",
  fitJudged:
    "Households' seasons judged against their labour budget, once a season at its first review (sim/levies fit, VB-1778)",
  fitRow: 'Season steps with hours left set against the labour budget at a fit (sim/levies fit, VB-1778)',
  levyCompile:
    "Members' levies compiled on their household's plan: at the season's turn, a member new to it or of a changed role (sim/levies, VB-1760)",
  dayAllot:
    "Households' days allotted whole: at the morning, at 14:00, and when a slot-in finds nobody (sim/day, allot; VB-1758)",
  dayWould:
    "Days weighed without being allotted: a head's allotment point asked whether the rule would change the day standing (sim/points, VB-1848)",
  vitalAsk:
    'Open tasks of its household passed by a pawn on its own plan, for a daily one the day leaves unmanned (sim/controller, VB-1755)',
  riskCheck:
    "Authored task steps weighed for their `by` at the household's review: none in a run with nothing authored (sim/day, VB-1755)",
  dayTake: 'Tasks of its list an idle pawn passes or takes (sim/day, takeDay; VB-466)',
  timetableEntry:
    "Entries of a member's list laid out in a timetable, a view asked by the page (sim/timetable, VB-477)",
  eveningAsk:
    "Households' tasks read for one that may be begun after work, from its end to the evening (sim/day eveningCall, VB-1547)",
  handsAsked: 'Asks for hands made by a head short of hands, at the morning allotment (sim/hands askFor, VB-470)',
  foodAsked: 'Asks for food made by a hungry head at its plan review, one an asked party (sim/help askFood, VB-691)',
  handsWeighed: 'Farms of the village read by a head short of hands, to choose whom to ask (sim/hands askFor, VB-470)',
  handsLent: 'Hands lent by a head asked for help, a pawn a day (sim/hands, VB-470)',
  handsHired: 'Hands hired by a head still short after its asks, a pawn a day (sim/hands, VB-319)',
  wagesHired: 'Rations of wage owed hired hands at the end of a day (sim/hands, VB-319)',
  wagesPaidHired: 'Rations of wage paid hired hands at the end of a day (sim/hands, VB-319)',
  leaveLook: "Members looked at after the morning's allotment for a reason to ask leave (sim/voice, VB-1555)",
  leaveWeighed: "Entries of a member's day read by its head weighing an ask of leave (sim/voice, VB-1555)",
  leaveAsked: 'Asks of leave made by a member of its head (sim/voice, VB-1555)',
  leaveGiven: 'Leaves given by a head (sim/voice, VB-1555)',
  leaveRefused: 'Asks of leave refused by a head (sim/voice, VB-1555)',
  grantGiven:
    "Grants of a member's levy written on its household's plan: a head's, standing or dated, and a servant's free day (sim/levies, VB-1763)",
  grantLook:
    "Dated grants on a household's plan looked at, for a member's levy in force, the budget or a leave begun (sim/levies, sim/voice; VB-1763)",
  budgetDay:
    "Members' days of a season read for their levy in force by a household's labour budget reckoned (sim/levies budget, VB-1763)",
  dailyDay:
    "Days of a season left read for a household's daily byre work by its head's estimate at a plan review (sim/estimate dailyLeft, VB-1906)",
  lighterLook: "Members looked at at the season's turn for an ask of a lighter levy (sim/voice, VB-1763)",
  lighterAsked: 'Asks of a lighter levy made by a member of its head (sim/voice, VB-1763)',
  lighterGiven: 'Lighter levies granted by a head (sim/voice, VB-1763)',
  occasionAsked:
    "Pawns weighed as guests of an occasion: a village's people at its meeting, kin and housemates at a wedding or a death " +
    '(sim/occasions, VB-126), the adults asked to an ale evening and to the rite (VB-522)',
  callWalk:
    'The asking queue read for a pawn whose asking found nobody, to find a farm to call at (sim/asking callAround, VB-1119)',
  harvestCalled: 'Harvest homes called (sim/occasions harvestHome, VB-459)',
  aleCalled: 'Ale evenings called, each one pass over the live households (sim/occasions callAle, VB-522)',
  riteCalled: "Rites called on the villages' greens, three days a year (sim/occasions callRites, VB-522)",
  feastServed:
    'Pawns served at a feast, each eating its portion and its household booked at most once (sim/occasions, VB-458)',
  keepGiven:
    "The alderman's keep: households' shares set aside at a moving round, and days owed at an autumn meeting (sim/keep, VB-463)",
  giftTiesWeighed:
    'Ties of a holder weighed for the good-year gift, at most 32, on its one planning day a year (sim/help, VB-460)',
  takeInWeighed:
    'Pawns of st.demand weighed for a household short of people whose ask for food fell short, as kin and then as servants ' +
    '(sim/service, takeIn; VB-308)',
  wagesWeighed:
    'Members of the households weighed for a servant who has served a year, owed its wage at the moving round (sim/service, ' +
    'oweWages; VB-637)',
  labourWeighed:
    'Households short of labour weighed for a landless adult with hands to spare at home, at the moving round (sim/service, ' +
    'serveWhereShort; VB-090)',
  forageGround:
    'Tiles within reach of a house searched for its gathering ground, when its gathering is asked for (sim/forage; VB-118)',
  fishGround:
    'Tiles within reach of a house searched for its fishing ground, when its fishing is asked for (sim/fish; VB-117)',
  fishReach:
    "Tiles within reach of a house searched for fishing water: a village's reach test when it has a new farm, a household's shore " +
    'for a boat (sim/drying; VB-300)',
  tarAsk:
    "Farms asked once a year whether a boat is lost for want of tar or a tar pit is begun, and pine tiles of a village's wood walked " +
    'for tar (sim/drying, sim/tar; VB-301)',
  boatAsk:
    'Farms of villages by fishing water asked whether their household begins a boat, once a year (sim/drying; VB-300)',
  saltGround:
    'Tiles within reach of a house searched for its salt spring, when its want opens, at most once a year (sim/saltpan; VB-700)',
  digGround:
    'Tiles within reach of a house searched for its digging ground, when its want opens, at most once a year (sim/dig; VB-359)',
  cowSeek:
    "Households of its village weighed by a household's open want of a cow, on its planning day (sim/exchange; VB-390)",
  pastureTiles:
    "Tiles within reach of a house searched for its herds' pasture, once a grazing day a household (sim/herds; VB-136), and of a " +
    "green for its herds' way out, once a season a village (sim/grazing wayOf; VB-446)",
  droveWays:
    'Ways out to the outland chosen, a route search each, once a season a village with herds (sim/grazing wayOf; VB-446)',
  deerGround:
    'Tiles within reach of a house searched for its hunting ground, when its hunting is asked for in autumn and winter (sim/deer; VB-139)',
  workdayHolders:
    'Holders of a village weighed by a household that stayed away from its work day, twice a year (sim/workdays; VB-120)',
  plotWalk:
    "Holders with a project plan under way walked for the households' plots for their heirs, as a village's plots are asked for " +
    '(sim/expansion livePlots; VB-255)',
  aimMenu:
    "A head's menu of projects computed (its options' tiles and sites), for a holder with a surplus and no project, at most once a " +
    'year and when a project ends (sim/aims; VB-255)',
  frontTile: 'Tiles of the forest front visited by spreadForest, once a game day (sim/spread; VB-091)',
  fieldLapse: "Fields weighed for their years unused on the year's last day (sim/fields' lapseFields; VB-1527)",
  lapsedTile:
    'Tiles of fields let go visited by spreadForest, once a game day, until they revert or are used again (sim/spread; VB-1527)',
  giftUncarried:
    'Grain a gift settled at once between two farmsteads, or from a village store to a household: none, by the hard rule (sim/exchange; ' +
    'VB-461)',
  awayMeals:
    'Meals eaten from a pack by the pawns away from home, on a journey or lodging, a meal a day each (sim/away feedAway; VB-783)',
  waterSettled:
    "Tiles settled by the two searches of the map's fresh water, once a world: the rise above the nearest water surface (gen/water) " +
    'and the walk to fresh water (sim/water; VB-1581)',
  sourceSettled:
    "Tiles settled by the searches for a farm's source of water: one a farm on its first morning, at a well's finishing in its village " +
    'and once a year on its planning day, each stopping at the first source (sim/water; VB-1582)',
  childMinded:
    'Times one about to leave home was found the last of 7 or over there with a child under 7, and stayed: a lodger, a carrier, a ' +
    'fetcher or hauler of a gift, a suitor (sim/records mindsWhy; VB-1602)',
  thirstDue:
    'Entries of the thirsty pawns taken when due: a pawn that ended a day without a drink, at 36 hours without one, and one that ' +
    'drank at night and goes in (sim/drinking; VB-1585)',
  boothWater:
    "Stays read for the booths' water, each review hour while any booth stands: the fetch of each booth somebody sleeps in " +
    '(sim/building; VB-1601)',
  leatherWear: 'Households whose shoes and harness wear a day, once a day (sim/leather wearDay; VB-911)',
  deerCrop:
    'Fields of villages with a broken fence stretch tested for roe deer in the crop, once a summer day (sim/deer; VB-139)',
};
VB.count = {};
VB.resetCounts = () => {
  for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0;
};
VB.resetCounts();
