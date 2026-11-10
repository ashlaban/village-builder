// @sys vb: module namespace and the convention for registering modules
// ===== Module namespace =====
// src/<path>.js registers as VB['<path>'] (e.g. src/sim/hex.js is VB['sim/hex']):
//   VB['sim/hex'] = (() => { ...; return { ... }; })();
// and reads what it needs at the top of its IIFE: const { bfs } = VB['sim/hex'];
// A module reads only modules listed before it in src/manifest.json. Grep a key to find the module and its users.
var VB = globalThis.VB = globalThis.VB || {};
// Work measurements only: never part of st or an input to a simulation decision.
VB.COUNTERS = {
  routeSearch: 'A* searches started',
  routeExpand: 'Tiles removed from the A* heap (including duplicates)',
  routeHit: 'Routes served from the cache, in either direction',
  routeRefresh: 'Cached routes tested for invalidation',
  routeEvict: 'Cached routes evicted to enforce the bound (including legacy loads)',
  talkWeighed: 'Eligible partners weighed in talkHour',
  walkStep: 'Agent records walked by the six-minute step (the awake ones, sim/agents)',
  walkAwake: 'Agent records walked to rebuild the awake list, once a game hour (VB-205)',
  idleStroll: 'Idle pawns sent strolling by idleAbout when the planner found them no work (VB-205)',
  companyWeighed: 'Idle pawns drawn and weighed as company in companyFor (VB-205)',
  walkPoint: 'Path points walked past by moveAgent (VB-205)',
  walkDaily: 'Pawn records walked by dailyLife and Culture.dailyStep',
  walkTies: 'Ties walked to put a pawn\'s ties back on today\'s scale, or to make room under the cap (sim/relations, VB-127)',
  tiePairs: 'Pairs given familiarity for waking hours at home (daily) or a job finished together (sim/relations, VB-127)',
  roundPairs: 'Candidate man/woman pairs visited in the moving round',
  heirRank: 'All heirRanking calls, including nested rankings and indirect callers',
  storeWalk: 'Village stores and retained ledger entries visited for spoilage and pruning',
  recordFold: 'Record slots passed by the yearly fold of routine events (sim/records, VB-199)',
  ruleValue: 'Rule values read (explanations excluded)',
  oppAsk: 'Calls of a kind\'s `available` rule: by the reviews of the plans, the due-queue and members looking for work (sim/jobs; VB-258, VB-249)',
  planReview: 'Plans reviewed: on each holder\'s planning day, when a window closes or a store crosses a target (sim/plans; VB-258, VB-249)',
  matchBid: 'Idle pawn and job pairs weighed by matching, each pawn with the jobs of its household and village (sim/jobs, planRound; VB-227)',
  lookUpJob: 'Jobs weighed by pawns at work looking up from their job, each with the jobs of its household and village (sim/jobs, lookUp; VB-227)',
  cookFarm: 'Farms visited by callCooks, from 14:00 to the end of work, for a household short of cooked food (sim/jobs; VB-227)',
};
VB.count = {};
VB.resetCounts = () => { for (const name of Object.keys(VB.COUNTERS)) VB.count[name] = 0; };
VB.resetCounts();
