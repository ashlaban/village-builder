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
  walkStep: 'Agent records walked by the six-minute step (the awake ones, sim/agents)',
  walkAwake: 'Agent records walked to rebuild the awake list, once a game hour (VB-205)',
  idleStroll: 'Idle pawns sent strolling by idleAbout when the planner found them no work (VB-205)',
  companyWeighed: 'Idle pawns drawn and weighed as company in companyFor (VB-205)',
  walkPoint: 'Path points walked past by moveAgent (VB-205)',
  walkDaily: 'Pawn records walked by dailyLife and Culture.dailyStep',
  walkTies:
    "Ties walked to put a pawn's ties back on today's scale, or to make room under the cap (sim/relations, VB-127)",
  tiePairs:
    'Pairs given familiarity for waking hours at home (daily) or a job finished together (sim/relations, VB-127)',
  roundPairs: 'Candidate man/woman pairs visited in the moving round',
  heirRank: 'All heirRanking calls, including nested rankings and indirect callers',
  storeWalk: 'Village stores and retained ledger entries visited for spoilage and pruning',
  recordFold: 'Record slots passed by the yearly fold of routine events (sim/records, VB-199)',
  ruleValue: 'Rule values read (explanations excluded)',
  oppAsk:
    "Calls of a kind's `available` rule: by the reviews of the plans, the due-queue and members looking for work (sim/jobs; VB-258, VB-249)",
  planReview:
    "Plans reviewed: on each holder's planning day, when a window closes or a store crosses a target (sim/plans; VB-258, VB-249)",
  matchBid:
    'Idle pawn and job pairs weighed by matching, each pawn with the jobs of its household and village (sim/jobs, planRound; VB-227)',
  helpOffer:
    "Jobs of a village's households weighed for the offer to helpers, once a village a round with a helper (sim/jobs, offered; VB-106)",
  helpBid: 'Helper and offered job pairs weighed by the help round (sim/jobs, helpRound; VB-106)',
  bidNoRoute: 'Winning bids refused for want of a way by land to the job (sim/jobs, assign; VB-329)',
  lookUpJob:
    'Jobs weighed by pawns at work looking up from their job, each with the jobs of its household and village (sim/jobs, lookUp; VB-227)',
  occasionAsked:
    "Pawns weighed as guests of an occasion: a village's people at its meeting, kin and housemates at a wedding or a death " +
    '(sim/occasions, VB-126)',
  takeInWeighed:
    'Pawns of st.demand weighed for a household short of people whose ask for food fell short, as kin and then as servants ' +
    '(sim/service, takeIn; VB-308)',
  labourWeighed:
    'Households short of labour weighed for a landless adult with hands to spare at home, at the moving round (sim/service, ' +
    'serveWhereShort; VB-090)',
  cookFarm:
    'Farms visited by callCooks, from 14:00 to the end of work, for a household short of cooked food (sim/jobs; VB-227)',
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
  frontTile: 'Tiles of the forest front visited by spreadForest, once a game day (sim/spread; VB-091)',
  deerCrop:
    'Fields of villages with a broken fence stretch tested for roe deer in the crop, once a summer day (sim/deer; VB-139)',
};
VB.count = {};
VB.noWay = ''; // the last walk refused for want of a way by land (sim/agents walkTo; VB-329): read by the invariants only
VB.resetCounts = () => {
  for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0;
};
VB.resetCounts();
