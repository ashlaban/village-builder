// @sys vb: module namespace and the convention for registering modules
// ===== Module namespace =====
// src/<path>.js registers as VB['<path>'] (e.g. src/sim/hex.js is VB['sim/hex']):
//   VB['sim/hex'] = (() => { ...; return { ... }; })();
// and reads what it needs at the top of its IIFE: const { bfs } = VB['sim/hex'];
// A module reads only modules listed before it in src/manifest.json. Grep a key to find the module and its users.
var VB = (globalThis.VB = globalThis.VB || {});
// Work measurements only: never part of st or an input to a simulation decision.
VB.COUNTERS = {
  routeSearch: 'A* searches started',
  routeExpand: 'Tiles removed from the A* heap (including duplicates)',
  routeHit: 'Routes served from the cache, in either direction',
  routeRefresh: 'Cached routes tested for invalidation',
  reachSettled: 'Tiles settled by the searches of the walking hours between villages (sim/routes reachCosts, VB-286)',
  routeEvict: 'Cached routes evicted to enforce the bound (including legacy loads)',
  talkWeighed: 'Eligible partners weighed in talkHour',
  offerWeighed: 'Answers to an offer weighed by the pawn asked, at the due time (sim/offers, VB-690)',
  offersAnswered: 'Open offers answered at a village step of the moving round, a day of it each (sim/round, VB-692)',
  talkTurn:
    'Pawns asked by the talk round at their talk turn, every SOCIAL.talk.every waking hours (sim/relations, VB-521)',
  talkBucket: 'Living walked to rebuild the talk turns when the living changed (sim/relations, VB-521)',
  walkStep: 'Legs a step takes from the due-queue as they end: walks and waits (sim/agents stepAgents; VB-473)',
  walkAwake:
    "Pawn records looked at by the working day's start, for those waiting for it, once a day (sim/agents dayStart; VB-473)",
  idleStroll: 'Idle pawns sent strolling by idleAbout when the planner found them no work (VB-205)',
  companyWeighed: 'Idle pawns drawn and weighed as company in companyFor (VB-205)',
  workReckon:
    'Tasks under work reckoned, with their hours since (sim/agents settle: a hand joins or leaves, the end of work, the meal; VB-472)',
  walkPoint: 'Path points passed, their tiles trodden as a walk ends or is cut (sim/agents treadTo; VB-205, VB-473)',
  walkPlace: 'Places worked out along a walk (placeOf of a walking pawn: talk, nearness, company, a cut; VB-473)',
  walkDaily: 'Pawn records walked by dailyLife and Culture.dailyStep',
  walkTies:
    "Ties walked to put a pawn's ties back on today's scale, or to make room under the cap (sim/relations, VB-127)",
  tiePairs:
    'Pairs given familiarity for waking hours at home (daily) or a job finished together (sim/relations, VB-127)',
  roundPairs: 'Candidate man/woman pairs visited in the moving round',
  roundWalk: "Pawn records walked by a village's round to build its pool, once a village (sim/lifecycle, VB-277)",
  wishWalk: "Pawn records walked by the pawns' own choosing of their wishes, once a moving round (sim/wishes, VB-680)",
  gatherChoice: "Villages weighed as hosts by a village's choice of gathering, at its meeting (sim/gathering, VB-294)",
  gatherDisposition:
    "Counterparts of a village's holders read for the pull between villages, at its meeting (sim/gathering, VB-294)",
  gatherKin: "Kin households read for a village's choice of gathering, at its meeting (sim/gathering, VB-294)",
  gatherSettle: 'Hosts named and asked in the settling of the gatherings, once a year (sim/gathering, VB-294)',
  meetingWalk:
    "Pawn records walked by a village's meeting: its living, and at the first village's the island's (sim/lifecycle, VB-278)",
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
  dayPair:
    "Member and task pairs weighed when a household's day is allotted: its members with the tasks of the household and its village " +
    '(sim/jobs, allot; VB-466)',
  dayTake: 'Tasks of its list an idle pawn passes or takes (sim/jobs, takeDay; VB-466)',
  helpOffer:
    "Jobs of a village's households weighed for the offer to helpers, once a village a round with a helper (sim/jobs, offered; VB-106)",
  helpBid: 'Helper and offered job pairs weighed by the help round (sim/jobs, helpRound; VB-106)',
  occasionAsked:
    "Pawns weighed as guests of an occasion: a village's people at its meeting, kin and housemates at a wedding or a death " +
    '(sim/occasions, VB-126), the adults asked to an ale evening and to the rite (VB-522)',
  aleCalled: 'Ale evenings called, each one pass over the live households (sim/occasions callAle, VB-522)',
  riteCalled: "Rites called on the villages' greens, three days a year (sim/occasions callRites, VB-522)",
  feastServed:
    'Pawns served at a feast, each eating its portion and its household booked at most once (sim/occasions, VB-458)',
  takeInWeighed:
    'Pawns of st.demand weighed for a household short of people whose ask for food fell short, as kin and then as servants ' +
    '(sim/service, takeIn; VB-308)',
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
  digGround:
    'Tiles within reach of a house searched for its digging ground, when its want opens, at most once a year (sim/dig; VB-359)',
  cowSeek:
    "Households of its village weighed by a household's open want of a cow, on its planning day (sim/exchange; VB-390)",
  pastureTiles:
    "Tiles within reach of a house searched for its herds' pasture, once a grazing day a household (sim/herds; VB-136)",
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
  giftUncarried:
    'Grain a gift settled at once between two farmsteads, or from a village store to a household: none, by the hard rule (sim/exchange; ' +
    'VB-461)',
  awayMeals:
    'Meals eaten from a pack by the pawns away from home, on a journey or lodging, a meal a day each (sim/away feedAway; VB-783)',
  deerCrop:
    'Fields of villages with a broken fence stretch tested for roe deer in the crop, once a summer day (sim/deer; VB-139)',
};
VB.count = {};
VB.resetCounts = () => {
  for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0;
};
VB.resetCounts();
